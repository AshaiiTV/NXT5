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

function initialSnapshot(result, teamId, ticket) {
  const total = Number(result.pagination?.total ?? result.matches?.length ?? 0);
  if (!Number.isSafeInteger(total) || total < 0 || Number(result.pagination?.offset || 0) !== 0) {
    throw new Error("Le nombre de games reçu est invalide. Réessaie.");
  }
  const matches = new Map();
  appendMatches(matches, result, teamId);
  if (matches.size > total || (!result.pagination?.hasMore && matches.size !== total)) {
    throw new Error("L’historique est incomplet. Réessaie pour analyser toutes les games.");
  }
  return { teamId, ticket, total, matches, pagination: result.pagination, complete: matches.size === total, failed: false };
}

async function completeHistory(snapshot, signal, isCurrent, onProgress) {
  // Follow-up pages stay private until the complete analysis is validated.
  const matches = new Map(snapshot.matches);
  let pagination = snapshot.pagination;
  while (pagination?.hasMore) {
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
    onProgress({ loaded: matches.size, total: snapshot.total });
    pagination = page.pagination;
  }
  if (matches.size !== snapshot.total) throw new Error("L’historique est incomplet. Réessaie pour analyser toutes les games.");
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
  const snapshot = useRef(null);
  const historyTask = useRef(null);
  const historyDemanded = useRef(false);
  const refresh = useRef(null);

  const cancelRequests = useCallback(() => {
    request.current?.abort();
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
        ? { ...initialSnapshot(latestData.current, id, generation.current), baseData: latestData.current }
        : null;
    }
    if (!id) { snapshot.current = null; setData(DEFAULT_DATA); }
  }, [cancelRequests]);

  useEffect(() => {
    if (linkedTeamId && linkedTeamId !== selected.current) setSelectedTeamId(linkedTeamId);
  }, [linkedTeamId, setSelectedTeamId]);

  const startHistory = useCallback((target) => {
    if (historyTask.current?.ticket === target.ticket) return historyTask.current.promise;
    const controller = new AbortController();
    const task = { ticket: target.ticket, controller, promise: null };
    const isCurrent = () => generation.current === target.ticket && selected.current === target.teamId;
    setHistoryLoading(true);
    setHistoryError("");
    historyTask.current = task;
    task.promise = (async () => {
      try {
        const complete = await completeHistory(target, controller.signal, isCurrent, setLoadingProgress);
        if (!isCurrent() || controller.signal.aborted) throw interrupted();
        target.complete = true;
        target.matches = new Map(complete.matches.map(match => [match.id, match]));
        target.pagination = complete.pagination;
        setData(current => {
          const base = current.bootstrapRevision === target.ticket ? current : target.baseData;
          return { ...base, ...complete, historyComplete: true,
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
    const ticket = ++generation.current;
    cancelRequests();
    const controller = new AbortController();
    request.current = controller;
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
      const preserveComplete = loadFull && latestData.current.selectedTeamId === activeTeam && latestData.current.historyComplete === true && !next.complete;
      if (!preserveComplete) setData(next.baseData);
      setLoadingProgress({ loaded: next.matches.size, total: next.total });
      setLoading(false);
      setBootstrapped(true);
      initialReady = true;
      if (loadFull && !next.complete) { historyDemanded.current = true; await startHistory(next); }
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
      if (ticket === generation.current) { pendingTeam.current = undefined; setLoading(false); setBootstrapped(true); }
    }
  }, [planningStore, linkedArchiveId, cancelRequests, startHistory]);
  refresh.current = refreshAll;

  const ensureHistory = useCallback(() => {
    historyDemanded.current = true;
    if (latestData.current.selectedTeamId === selected.current && latestData.current.historyComplete === true) return Promise.resolve(true);
    const target = snapshot.current;
    if (!target || target.ticket !== generation.current || target.teamId !== selected.current) return Promise.resolve(false);
    if (target.failed) return refresh.current({ history: true, throwOnError: true });
    return startHistory(target);
  }, [startHistory]);

  useEffect(() => {
    refreshAll();
    return () => { generation.current += 1; request.current?.abort(); historyTask.current?.controller.abort(); };
  }, [refreshAll]);
  useEffect(() => {
    if (selectedTeamId && data.selectedTeamId !== selectedTeamId && pendingTeam.current !== selectedTeamId) refreshAll({ teamId: selectedTeamId });
  }, [selectedTeamId, data.selectedTeamId, refreshAll]);

  return { data, setData, selectedTeamId, setSelectedTeamId, loading, loadingProgress, bootstrapped,
    bootstrapReady: data.bootstrapRevision !== undefined && data.selectedTeamId === selectedTeamId,
    apiError, refreshAll, historyLoading, historyError, ensureHistory };
}
