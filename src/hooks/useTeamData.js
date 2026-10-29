import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";

const MATCH_BATCH_SIZE = 100;
const interrupted = () => new DOMException("Chargement annulé.", "AbortError");

function appendMatches(matches, page, teamId) {
  for (const match of page.matches || []) {
    if (!match.id || match.team_id !== teamId || matches.has(match.id)) {
      throw new Error("Une game reçue ne correspond pas à l’historique de l’équipe active.");
    }
    matches.set(match.id, match);
  }
}

function initialSnapshot(result, teamId, ticket, cached = false) {
  const total = Number(result.pagination?.total ?? result.matches?.length ?? 0);
  const offset = Number(result.pagination?.offset || 0);
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(offset) || offset < 0 || (!cached && offset !== 0)) {
    throw new Error("Le nombre de games reçu est invalide. Réessaie.");
  }
  const matches = new Map();
  appendMatches(matches, result, teamId);
  if (matches.size > total || (!result.pagination?.hasMore && matches.size !== total)) {
    throw new Error("L’historique est incomplet. Réessaie pour analyser toutes les games.");
  }
  if (result.pagination?.hasMore && (Number(result.pagination.nextOffset) !== matches.size || matches.size >= total)) {
    throw new Error("La suite de l’historique reçue est invalide. Réessaie.");
  }
  return { teamId, ticket, total, matches, pagination: result.pagination, complete: matches.size === total, failed: false };
}

async function completeHistory(snapshot, signal, isCurrent, onProgress, pageLimit = Infinity) {
  // Full analyses publish atomically; a manual list request publishes one page.
  const matches = new Map(snapshot.matches);
  let pagination = snapshot.pagination;
  let pages = 0;
  while (pagination?.hasMore && pages < pageLimit) {
    const offset = Number(pagination.nextOffset);
    if (!snapshot.teamId || !Number.isSafeInteger(offset) || offset !== matches.size || offset >= snapshot.total) {
      throw new Error("Impossible de charger l’historique complet. Réessaie.");
    }
    const params = new URLSearchParams({ teamId: snapshot.teamId, limit: String(MATCH_BATCH_SIZE), offset: String(offset), matchesOnly: "1" });
    const page = await apiFetch(`bootstrap?${params}`, { signal });
    if (signal.aborted || !isCurrent()) throw interrupted();
    if (page.selectedTeamId !== snapshot.teamId || Number(page.pagination?.offset) !== offset) {
      throw new Error("La suite de l’historique reçue est invalide. Réessaie.");
    }
    if (Number(page.pagination?.total) !== snapshot.total || !page.matches?.length) {
      throw new Error("L’historique a changé pendant le chargement. Réessaie pour analyser toutes les games.");
    }
    appendMatches(matches, page, snapshot.teamId);
    if (matches.size > snapshot.total) throw new Error("La suite de l’historique reçue est invalide. Réessaie.");
    pagination = page.pagination;
    if (pagination?.hasMore && (Number(pagination.nextOffset) !== matches.size || matches.size >= snapshot.total)) {
      throw new Error("La suite de l’historique reçue est invalide. Réessaie.");
    }
    pages += 1;
    onProgress({ loaded: matches.size, total: snapshot.total });
  }
  if (!pagination?.hasMore && matches.size !== snapshot.total) throw new Error("L’historique est incomplet. Réessaie pour analyser toutes les games.");
  return { matches: [...matches.values()], pagination };
}

export function useTeamData(planningStore, routeSearch = "", options = {}) {
  const params = new URLSearchParams(routeSearch);
  const linkedTeamId = params.get("team")?.trim() || null;
  const linkedArchiveId = params.get("archive")?.trim() || null;
  const [data, setData] = useState(DEFAULT_DATA);
  const [selectedTeamId, setSelectedId] = useState(linkedTeamId);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [apiError, setApiError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const selected = useRef(linkedTeamId);
  const latestData = useRef(data);
  latestData.current = data;
  const requireHistory = useRef(false);
  requireHistory.current = options.requireHistory === true;
  const generation = useRef(0);
  const pendingTeam = useRef(undefined);
  const request = useRef(null);
  const bootstrapTask = useRef(null);
  const snapshot = useRef(null);
  const historyTask = useRef(null);
  const historyDemanded = useRef(false);
  const historyDemandRevision = useRef(0);
  const refresh = useRef(null);

  const cancelRequests = useCallback(() => {
    request.current?.abort();
    bootstrapTask.current?.finish(false);
    bootstrapTask.current = null;
    historyTask.current?.controller.abort();
    historyTask.current = null;
    setHistoryLoading(false);
  }, []);

  const setSelectedTeamId = useCallback((id) => {
    const changed = selected.current !== id;
    selected.current = id;
    setSelectedId(id);
    if (changed) {
      generation.current += 1;
      cancelRequests();
      pendingTeam.current = undefined;
      historyDemanded.current = false;
      setHistoryError("");
      setLoadingProgress(null);
      setLoading(Boolean(id && latestData.current.selectedTeamId !== id));
      snapshot.current = id && latestData.current.selectedTeamId === id && latestData.current.historyComplete === false
        ? { ...initialSnapshot(latestData.current, id, generation.current, true), baseData: latestData.current }
        : null;
    }
    if (!id) { snapshot.current = null; setData(DEFAULT_DATA); }
  }, [cancelRequests]);

  useEffect(() => {
    if (linkedTeamId && linkedTeamId !== selected.current) setSelectedTeamId(linkedTeamId);
  }, [linkedTeamId, setSelectedTeamId]);

  const startHistory = useCallback((target, nextOnly = false) => {
    const active = historyTask.current;
    if (active?.ticket === target.ticket) {
      if (!nextOnly && active.nextOnly) {
        return active.promise.then(() => {
          if (generation.current !== target.ticket || selected.current !== target.teamId) throw interrupted();
          return startHistory(target);
        });
      }
      return active.promise;
    }
    if (target.complete) return Promise.resolve(true);
    const controller = new AbortController();
    const task = { ticket: target.ticket, controller, promise: null, nextOnly };
    const isCurrent = () => generation.current === target.ticket && selected.current === target.teamId;
    setHistoryLoading(true);
    setHistoryError("");
    historyTask.current = task;
    task.promise = (async () => {
      try {
        const complete = await completeHistory(target, controller.signal, isCurrent, setLoadingProgress, nextOnly ? 1 : Infinity);
        if (!isCurrent() || controller.signal.aborted) throw interrupted();
        target.complete = complete.matches.length === target.total;
        target.failed = false;
        target.matches = new Map(complete.matches.map(match => [match.id, match]));
        target.pagination = complete.pagination;
        setData(current => {
          const base = current.bootstrapRevision === target.ticket ? current : target.baseData;
          return { ...base, ...complete, historyComplete: target.complete,
            availability: planningStore.mergeAvailability(base.availability || [], base.players || []) };
        });
        return true;
      } catch (error) {
        if (isCurrent() && !controller.signal.aborted) {
          target.failed = true;
          if (error?.status === 403) {
            selected.current = null;
            setSelectedId(null);
            setData(DEFAULT_DATA);
            snapshot.current = null;
            historyDemanded.current = false;
            await refresh.current();
          } else setHistoryError(error.message || "Impossible de charger toutes les games de cette équipe.");
        }
        throw error;
      } finally {
        if (historyTask.current === task) { historyTask.current = null; setHistoryLoading(false); }
      }
    })();
    return task.promise;
  }, [planningStore]);

  const refreshAll = useCallback(async (refreshOptions = {}) => {
    const teamId = refreshOptions.teamId ?? selected.current;
    const loadFull = refreshOptions.history ?? (requireHistory.current || historyDemanded.current);
    const demandRevision = historyDemandRevision.current;
    const ticket = ++generation.current;
    cancelRequests();
    const controller = new AbortController();
    request.current = controller;
    const bootstrap = { ticket, finish: null, promise: null };
    bootstrap.promise = new Promise(resolve => { bootstrap.finish = resolve; });
    bootstrapTask.current = bootstrap;
    pendingTeam.current = teamId;
    setLoading(true);
    setLoadingProgress(null);
    setApiError("");
    setHistoryError("");
    const isCurrent = () => ticket === generation.current && selected.current === teamId;
    let initialReady = false;
    try {
      const search = new URLSearchParams({ limit: String(MATCH_BATCH_SIZE), offset: "0" });
      if (teamId) search.set("teamId", teamId);
      if (linkedArchiveId) search.set("archive", linkedArchiveId);
      const result = await apiFetch(`bootstrap?${search}`, { signal: controller.signal });
      if (!isCurrent() || controller.signal.aborted) return false;
      const activeTeam = result.selectedTeamId || result.teams?.[0]?.id || null;
      if (teamId && activeTeam !== teamId) throw new Error("Les données reçues ne correspondent pas à l’équipe active.");
      const next = initialSnapshot(result, activeTeam, ticket);
      next.baseData = { ...DEFAULT_DATA, ...result, selectedTeamId: activeTeam, bootstrapRevision: ticket,
        matches: [...next.matches.values()], historyComplete: next.complete,
        availability: planningStore.mergeAvailability(result.availability || [], result.players || []) };
      snapshot.current = next;
      selected.current = activeTeam;
      setSelectedId(activeTeam);
      // A mutation refresh retains its previous complete analysis atomically.
      // A first visit becomes usable after one bounded page.
      const loadHistoryAfterBootstrap = loadFull || historyDemandRevision.current !== demandRevision;
      const preserveComplete = loadHistoryAfterBootstrap && latestData.current.selectedTeamId === activeTeam && latestData.current.historyComplete === true && !next.complete;
      if (!preserveComplete) setData(next.baseData);
      setLoadingProgress({ loaded: next.matches.size, total: next.total });
      setLoading(false);
      setBootstrapped(true);
      initialReady = true;
      bootstrap.finish(true);
      if (bootstrapTask.current === bootstrap) bootstrapTask.current = null;
      if (loadHistoryAfterBootstrap && !next.complete) { historyDemanded.current = true; await startHistory(next); }
      return true;
    } catch (error) {
      if (ticket !== generation.current || controller.signal.aborted) return false;
      if (!initialReady && teamId && error?.status === 403 && (latestData.current.teams || []).some(team => team.id === teamId)) {
        selected.current = null;
        setSelectedId(null);
        setData(DEFAULT_DATA);
        snapshot.current = null;
        historyDemanded.current = false;
        return refresh.current({ throwOnError: refreshOptions.throwOnError });
      }
      if (!initialReady || latestData.current.historyComplete === true) {
        setApiError(error.message || "Impossible de charger les données de cette équipe.");
      }
      if (refreshOptions.throwOnError) throw error;
      return false;
    } finally {
      bootstrap.finish(false);
      if (bootstrapTask.current === bootstrap) bootstrapTask.current = null;
      if (ticket === generation.current) { pendingTeam.current = undefined; setLoading(false); setBootstrapped(true); }
    }
  }, [planningStore, linkedArchiveId, cancelRequests, startHistory]);
  refresh.current = refreshAll;

  const ensureHistory = useCallback(() => {
    historyDemanded.current = true;
    historyDemandRevision.current += 1;
    const pending = bootstrapTask.current;
    if (pending?.ticket === generation.current) return pending.promise.then(ready => ready ? ensureHistory() : false);
    if (latestData.current.selectedTeamId === selected.current && latestData.current.historyComplete === true) return Promise.resolve(true);
    const target = snapshot.current;
    if (!target || target.ticket !== generation.current || target.teamId !== selected.current) return Promise.resolve(false);
    if (target.failed) return refresh.current({ history: true, throwOnError: true });
    return startHistory(target);
  }, [startHistory]);

  const loadNextPage = useCallback(async () => {
    let target = snapshot.current;
    if (!target || target.ticket !== generation.current || target.teamId !== selected.current) return false;
    if (target.failed) {
      const teamId = target.teamId;
      const reloaded = await refresh.current({ history: false, throwOnError: true });
      if (!reloaded || selected.current !== teamId) return false;
      target = snapshot.current;
      if (!target || target.ticket !== generation.current || target.teamId !== teamId) return false;
    }
    return startHistory(target, true);
  }, [startHistory]);

  useEffect(() => {
    refreshAll();
    return () => { generation.current += 1; request.current?.abort(); bootstrapTask.current?.finish(false); historyTask.current?.controller.abort(); };
  }, [refreshAll]);
  useEffect(() => {
    if (selectedTeamId && data.selectedTeamId !== selectedTeamId && pendingTeam.current !== selectedTeamId) refreshAll({ teamId: selectedTeamId });
  }, [selectedTeamId, data.selectedTeamId, refreshAll]);

  return { data, setData, selectedTeamId, setSelectedTeamId, loading, loadingProgress, bootstrapped,
    bootstrapReady: data.bootstrapRevision !== undefined && data.selectedTeamId === selectedTeamId,
    apiError, refreshAll, historyLoading, historyError, ensureHistory, loadNextPage };
}
