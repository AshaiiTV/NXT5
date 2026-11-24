import { apiFetch } from "./client.js";

export async function loadDraftHistory(teamId, signal) {
  const page = after => apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({action:"list", teamId, ...(after ? {after} : {})}), signal });
  const first = await page();
  if (!first.nextDraftPage) return first;
  const drafts = [...first.drafts];
  let after = first.nextDraftPage;
  while (after) {
    const more = await page(after);
    drafts.push(...more.drafts);
    after = more.nextDraftPage;
  }
  return { ...first, drafts, nextDraftPage: null };
}

// Last opponent collection per account and team, kept for this page session so
// the Teams directory opens on known data and refreshes in the background.
const remembered = new Map();
const inFlight = new Map();
const historyKey = (teamId, userId) => (teamId ? JSON.stringify([String(teamId), String(userId || "")]) : "");

export function peekDraftHistory(teamId, userId) {
  return remembered.get(historyKey(teamId, userId)) || null;
}

export function rememberDraftHistory(teamId, userId, result) {
  const key = historyKey(teamId, userId);
  if (key && result) remembered.set(key, result);
}

export function forgetDraftHistory(teamId, userId) {
  remembered.delete(historyKey(teamId, userId));
}

/** Read the full collection. A background warm-up still running is reused
 * (aborting `signal` then only stops waiting for it); otherwise the read is
 * the caller's own and `signal` cancels it. */
export function fetchDraftHistory(teamId, userId, signal) {
  const key = historyKey(teamId, userId);
  const warming = inFlight.get(key);
  if (!warming) return loadDraftHistory(teamId, signal).then((result) => { rememberDraftHistory(teamId, userId, result); return result; });
  if (!signal) return warming;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", stop, { once: true });
    warming.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

export function prefetchDraftHistory(teamId, userId) {
  const key = historyKey(teamId, userId);
  if (!key || remembered.has(key) || inFlight.has(key)) return;
  const pending = loadDraftHistory(teamId)
    .then((result) => { rememberDraftHistory(teamId, userId, result); return result; })
    .finally(() => { if (inFlight.get(key) === pending) inFlight.delete(key); });
  inFlight.set(key, pending);
  pending.catch(() => {});
}

export function clearDraftHistoryMemory() {
  remembered.clear();
  inFlight.clear();
}
