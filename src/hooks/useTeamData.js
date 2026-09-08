import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";

const MATCH_BATCH_SIZE = 100;

export function useTeamData(planningStore) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [selectedTeamId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [apiError, setApiError] = useState("");
  const selected = useRef(null);
  const latestData = useRef(data);
  latestData.current = data;
  const generation = useRef(0);
  const pendingTeam = useRef(undefined);
  const request = useRef(null);

  const setSelectedTeamId = useCallback((id) => {
    selected.current = id;
    setSelectedId(id);
    if (id && latestData.current.selectedTeamId === id && pendingTeam.current !== undefined && pendingTeam.current !== id) {
      generation.current += 1;
      request.current?.abort();
      pendingTeam.current = undefined;
      setLoading(false);
      setLoadingProgress(null);
    }
  }, []);

  const refreshAll = useCallback(async (options = {}) => {
    const teamId = options.teamId ?? selected.current;
    const ticket = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    pendingTeam.current = teamId;
    setLoading(true);
    setLoadingProgress(null);
    setApiError("");
    const isCurrent = () => ticket === generation.current && selected.current === teamId;
    try {
      const params = new URLSearchParams({ limit: String(MATCH_BATCH_SIZE), offset: "0" });
      if (teamId) params.set("teamId", teamId);
      const result = await apiFetch(`bootstrap?${params}`, { signal: controller.signal });
      if (!isCurrent()) return;
      const activeTeam = result.selectedTeamId || result.teams?.[0]?.id || null;
      if (teamId && activeTeam !== teamId) throw new Error("Les données reçues ne correspondent pas à l’équipe active.");
      const total = Number(result.pagination?.total ?? result.matches?.length ?? 0);
      if (!Number.isSafeInteger(total) || total < 0) throw new Error("Le nombre de games reçu est invalide. Réessaie.");
      const matches = new Map();
      const append = (page) => {
        for (const match of page.matches || []) {
          if (!match.id || match.team_id !== activeTeam) throw new Error("Une game reçue ne correspond pas à l’équipe active.");
          matches.set(match.id, match);
        }
      };
      append(result);
      setLoadingProgress({ loaded: matches.size, total });
      let pagination = result.pagination;
      while (pagination?.hasMore) {
        const offset = Number(pagination.nextOffset);
        if (!activeTeam || !Number.isSafeInteger(offset) || offset <= Number(pagination.offset) || offset >= total) {
          throw new Error("Impossible de charger l’historique complet. Réessaie.");
        }
        const pageParams = new URLSearchParams({ teamId: activeTeam, limit: String(MATCH_BATCH_SIZE), offset: String(offset), matchesOnly: "1" });
        const page = await apiFetch(`bootstrap?${pageParams}`, { signal: controller.signal });
        if (!isCurrent()) return;
        if (page.selectedTeamId !== activeTeam || Number(page.pagination?.offset) !== offset) {
          throw new Error("La suite de l’historique reçue est invalide. Réessaie.");
        }
        if (Number(page.pagination?.total) !== total || !page.matches?.length) {
          throw new Error("L’historique a changé pendant le chargement. Réessaie pour analyser toutes les games.");
        }
        append(page);
        setLoadingProgress({ loaded: matches.size, total });
        pagination = page.pagination;
      }
      if (matches.size !== total) {
        throw new Error("L’historique est incomplet. Réessaie pour analyser toutes les games.");
      }
      // Keep pages private until every game is available. Analysis screens only
      // receive a complete snapshot, including after imports and team switches.
      setData({ ...DEFAULT_DATA, ...result, matches: [...matches.values()], pagination,
        selectedTeamId: activeTeam, bootstrapRevision: ticket, historyComplete: true,
        availability: planningStore.mergeAvailability(result.availability || [], result.players || []) });
      selected.current = activeTeam;
      setSelectedId(activeTeam);
    } catch (error) {
      if (isCurrent()) setApiError(error.message || "Impossible de charger toutes les games de cette équipe.");
    } finally {
      if (ticket === generation.current) {
        pendingTeam.current = undefined;
        setLoading(false);
        setBootstrapped(true);
      }
    }
  }, [planningStore]);

  useEffect(() => { refreshAll(); return () => { generation.current += 1; request.current?.abort(); }; }, [refreshAll]);
  useEffect(() => {
    if (selectedTeamId && data.selectedTeamId !== selectedTeamId && pendingTeam.current !== selectedTeamId) refreshAll({ teamId: selectedTeamId });
  }, [selectedTeamId, data.selectedTeamId, refreshAll]);

  return { data, setData, selectedTeamId, setSelectedTeamId, loading, loadingProgress, bootstrapped,
    bootstrapReady: data.historyComplete === true, apiError, refreshAll };
}
