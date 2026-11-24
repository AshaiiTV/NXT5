import { useEffect, useState } from "react";
import { apiFetch } from "./client.js";

// The bootstrap inlines report contents up to a size budget. Older rows come
// with `content: null, content_omitted: true` and are fetched here on demand.
const MAX_CACHED_REPORTS = 50;
const cache = new Map();

export function reportContentOmitted(report) {
  return Boolean(report?.content_omitted);
}

function cacheKey(report) {
  return `${report.id}:${report.updated_at || report.created_at || ""}`;
}

/** Full report row (content and original_debrief included). */
export function loadFullReport(teamId, report) {
  if (!reportContentOmitted(report)) return Promise.resolve(report);
  const key = cacheKey(report);
  if (!cache.has(key)) {
    const request = apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: "get", teamId, reportId: report.id }) })
      .then((result) => {
        if (!result?.report || typeof result.report.content !== "string") throw new Error("La note n’a pas pu être chargée. Réessaie dans quelques instants.");
        return { ...report, ...result.report, content_omitted: false };
      });
    cache.set(key, request);
    request.catch(() => { if (cache.get(key) === request) cache.delete(key); });
    while (cache.size > MAX_CACHED_REPORTS) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

/**
 * Replaces omitted reports by their full rows once loaded. Rows still loading
 * (or failed) stay in `pending` and keep `content_omitted: true`.
 */
export function useFullReports(teamId, reports) {
  const omitted = reports.filter(reportContentOmitted);
  const signature = omitted.map(cacheKey).join("|");
  const [loaded, setLoaded] = useState({});
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!omitted.length) return undefined;
    let active = true;
    setError("");
    Promise.allSettled(omitted.map((report) => loadFullReport(teamId, report))).then((results) => {
      if (!active) return;
      const next = {};
      let failure = null;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") next[cacheKey(omitted[index])] = result.value;
        else failure = failure || result.reason;
      });
      setLoaded((current) => ({ ...current, ...next }));
      if (failure) setError(failure.message || "La note n’a pas pu être chargée.");
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, signature, attempt]);
  const merged = reports.map((report) => reportContentOmitted(report) ? loaded[cacheKey(report)] || report : report);
  const pending = merged.some(reportContentOmitted);
  return { reports: merged, loading: pending && !error, error: pending ? error : "", retry: () => setAttempt((value) => value + 1) };
}
