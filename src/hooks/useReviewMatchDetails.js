import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";

// Full timelines are large: fetch one game per response and bound concurrency.
const MAX_CONCURRENT_DETAILS_REQUESTS = 3;
const MAX_INACTIVE_CACHE_ENTRIES = 40;

function cacheKey(teamId, matchId, version) {
  return JSON.stringify([teamId, matchId, version]);
}

function cachedMatches(cache, teamId, matchIds, version) {
  return matchIds.map((id) => cache.get(cacheKey(teamId, id, version))).filter(Boolean);
}

function pruneCache(cache, teamId, matchIds, version) {
  const activeKeys = new Set(matchIds.map((id) => cacheKey(teamId, id, version)));
  const inactiveKeys = [];
  for (const key of cache.keys()) {
    const [cachedTeamId, , cachedVersion] = JSON.parse(key);
    // A refreshed team snapshot makes its previous full timelines obsolete.
    if (cachedTeamId === teamId && cachedVersion !== version) cache.delete(key);
    else if (!activeKeys.has(key)) inactiveKeys.push(key);
  }
  // Never evict an active game, including reviews larger than the cache budget.
  for (const key of inactiveKeys.slice(0, Math.max(0, inactiveKeys.length - MAX_INACTIVE_CACHE_ENTRIES))) {
    cache.delete(key);
  }
}

export function useReviewMatchDetails(teamId, matchIds, version = "") {
  const cache = useRef(new Map());
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: "", matches: [], error: "", loading: false });
  const normalizedTeamId = String(teamId ?? "").trim();
  const normalizedVersion = String(version ?? "");
  const ids = [...new Set((Array.isArray(matchIds) ? matchIds : [])
    .map((id) => String(id ?? "").trim()).filter(Boolean))];
  // Value-based dependencies prevent fresh arrays from restarting the same request.
  const key = JSON.stringify([normalizedTeamId, ids, normalizedVersion]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const [activeTeamId, activeIds, activeVersion] = JSON.parse(key);
    pruneCache(cache.current, activeTeamId, activeIds, activeVersion);
    if (!activeTeamId || !activeIds.length) {
      setResult({ key, matches: [], error: "", loading: false });
      return;
    }

    const readMatches = () => cachedMatches(cache.current, activeTeamId, activeIds, activeVersion);
    const missingIds = activeIds.filter((id) => !cache.current.has(cacheKey(activeTeamId, id, activeVersion)));
    if (!missingIds.length) {
      setResult({ key, matches: readMatches(), error: "", loading: false });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setResult({ key, matches: readMatches(), error: "", loading: true });
    const failures = [];
    let absentCount = 0;
    let nextIndex = 0;
    async function loadNextMatches() {
      while (!cancelled && nextIndex < missingIds.length) {
        const matchId = missingIds[nextIndex++];
        try {
          const payload = await apiFetch("match-details", {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({ teamId: activeTeamId, matchIds: [matchId] }),
          });
          if (cancelled) return;
          const rows = Array.isArray(payload?.matches) ? payload.matches : [];
          const match = rows.find((row) => String(row?.id ?? "") === matchId && String(row?.team_id ?? "") === activeTeamId);
          if (match) {
            cache.current.set(cacheKey(activeTeamId, matchId, activeVersion), match);
          } else {
            absentCount += 1;
          }
        } catch (error) {
          if (cancelled) return;
          failures.push(error?.message || "Impossible de charger le détail complet des games de cette review.");
        }
        if (!cancelled) setResult({ key, matches: readMatches(), error: "", loading: true });
      }
    }
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT_DETAILS_REQUESTS, missingIds.length) }, () => loadNextMatches());
    Promise.all(workers).then(() => {
      if (!cancelled) {
        if (absentCount) {
          failures.push(`Détail introuvable pour ${absentCount} game${absentCount > 1 ? "s" : ""} de cette review.`);
        }
        setResult({ key, matches: readMatches(), error: [...new Set(failures)].join(" "), loading: false });
      }
    });

    return () => { cancelled = true; controller.abort(); };
  }, [key, attempt]);

  const matches = !normalizedTeamId ? [] : result.key === key
    ? result.matches
    : cachedMatches(cache.current, normalizedTeamId, ids, normalizedVersion);
  const loading = Boolean(normalizedTeamId && ids.length && (result.key === key ? result.loading : matches.length !== ids.length));
  const error = result.key === key ? result.error : "";
  return { matches, loading, error, retry, complete: !loading && !error && matches.length === ids.length };
}
