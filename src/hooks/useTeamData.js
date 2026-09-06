import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";

export function useTeamData(planningStore) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [selectedTeamId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [apiError, setApiError] = useState("");
  const selected = useRef(null);
  const latestData = useRef(data);
  latestData.current = data;
  const generation = useRef(0);
  const pendingTeam = useRef(undefined);
  const request = useRef(null);
  const pageRequest = useRef(null);
  const paging = useRef(false);

  const setSelectedTeamId = useCallback((id) => {
    selected.current = id;
    setSelectedId(id);
    if (id && latestData.current.selectedTeamId === id && pendingTeam.current !== undefined && pendingTeam.current !== id) {
      generation.current += 1;
      request.current?.abort();
      pendingTeam.current = undefined;
      setLoading(false);
    }
  }, []);
  const refreshAll = useCallback(async (options = {}) => {
    const teamId = options.teamId ?? selected.current;
    const ticket = ++generation.current;
    request.current?.abort();
    pageRequest.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    pendingTeam.current = teamId;
    paging.current = false;
    setLoadingMore(false);
    setLoading(true);
    setApiError("");
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (teamId) params.set("teamId", teamId);
      const result = await apiFetch(`bootstrap?${params}`, { signal: controller.signal });
      if (ticket !== generation.current || (teamId && selected.current !== teamId)) return;
      const activeTeam = result.selectedTeamId || result.teams?.[0]?.id || null;
      setData({ ...DEFAULT_DATA, ...result, selectedTeamId: activeTeam, bootstrapRevision: ticket, availability: planningStore.mergeAvailability(result.availability || [], result.players || []) });
      setSelectedTeamId(activeTeam);
    } catch (error) {
      if (ticket === generation.current) setApiError(error.message || "Impossible de charger cette équipe.");
    } finally {
      if (ticket === generation.current) {
        pendingTeam.current = undefined;
        setLoading(false);
        setBootstrapped(true);
      }
    }
  }, [planningStore, setSelectedTeamId]);

  useEffect(() => { refreshAll(); return () => { generation.current += 1; request.current?.abort(); pageRequest.current?.abort(); }; }, [refreshAll]);
  useEffect(() => {
    if (selectedTeamId && data.selectedTeamId !== selectedTeamId && pendingTeam.current !== selectedTeamId) refreshAll({ teamId: selectedTeamId });
  }, [selectedTeamId, data.selectedTeamId, refreshAll]);

  const loadMore = useCallback(async ({ all = false } = {}) => {
    const initial = latestData.current;
    if (paging.current || !initial.pagination?.hasMore || initial.selectedTeamId !== selected.current) return;
    const teamId = selected.current;
    const ticket = generation.current;
    const controller = new AbortController();
    pageRequest.current = controller;
    paging.current = true;
    setLoadingMore(true);
    setApiError("");
    let pagination = initial.pagination;
    try {
      do {
        const params = new URLSearchParams({ teamId, limit: "50", offset: String(pagination.nextOffset ?? pagination.offset + pagination.limit), matchesOnly: "1" });
        const result = await apiFetch(`bootstrap?${params}`, { signal: controller.signal });
        if (ticket !== generation.current || selected.current !== teamId) return;
        if (result.selectedTeamId !== teamId) throw new Error("La page reçue ne correspond pas à l’équipe active.");
        const pagePagination = result.pagination;
        pagination = pagePagination;
        setData((current) => {
          if (current.selectedTeamId !== teamId) return current;
          const matches = [...new Map([...current.matches, ...(result.matches || [])].map((match) => [match.id, match])).values()];
          return { ...current, matches, pagination: pagePagination };
        });
      } while (all && pagination?.hasMore);
    } catch (error) {
      if (ticket === generation.current) setApiError(error.message || "Impossible de charger les games suivantes.");
    } finally {
      if (ticket === generation.current) { paging.current = false; setLoadingMore(false); }
    }
  }, []);

  return { data, setData, selectedTeamId, setSelectedTeamId, loading, loadingMore, bootstrapped, bootstrapReady: bootstrapped, apiError, refreshAll, loadMore };
}
