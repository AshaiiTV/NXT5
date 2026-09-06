import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";

export function useMatchDetails(teamId, matchId, version = "") {
  const cache = useRef(new Map());
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: "", detail: null, error: "", loading: false });
  const key = teamId && matchId ? `${teamId}|${matchId}|${version}` : "";
  const retry = useCallback(() => { cache.current.delete(key); setAttempt((value) => value + 1); }, [key]);

  useEffect(() => {
    if (!key) return;
    if (cache.current.has(key)) {
      setResult({ key, detail: cache.current.get(key), error: "", loading: false });
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setResult({ key, detail: null, error: "", loading: true });
    apiFetch("match-details", { method: "POST", signal: controller.signal, body: JSON.stringify({ teamId, matchIds: [matchId] }) })
      .then((payload) => {
        if (cancelled) return;
        const detail = payload?.matches?.find((match) => String(match.id) === String(matchId) && String(match.team_id) === String(teamId));
        if (!detail) throw new Error("Détail introuvable pour cette game.");
        cache.current.set(key, detail);
        if (cache.current.size > 20) cache.current.delete(cache.current.keys().next().value);
        setResult({ key, detail, error: "", loading: false });
      })
      .catch((error) => {
        if (!cancelled) setResult({ key, detail: null, error: error.message || "Impossible de charger le détail complet.", loading: false });
      });
    // No pending-request lock survives cancellation: returning to a game restarts it.
    return () => { cancelled = true; controller.abort(); };
  }, [key, teamId, matchId, attempt]);

  return {
    detail: key && result.key === key ? result.detail : cache.current.get(key) || null,
    error: key && result.key === key ? result.error : "",
    loading: Boolean(key && (result.key !== key || result.loading)),
    retry,
  };
}
