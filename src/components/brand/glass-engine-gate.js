/**
 * When the three.js engine of the glass scene may be downloaded.
 * The static poster stays the LCP element; the engine waits for the page `load`
 * event and an idle period, and never loads on constrained devices or networks.
 */

const SLOW_NETWORKS = new Set(["slow-2g", "2g", "3g"]);
const IDLE_FALLBACK_MS = 1500;
const IDLE_TIMEOUT_MS = 4000;

/** True when data saving, a slow network or a low-memory device should keep the poster alone. */
export function engineConstrained(nav = globalThis.navigator) {
  const connection = nav?.connection;
  if (connection?.saveData) return true;
  if (SLOW_NETWORKS.has(connection?.effectiveType)) return true;
  const memory = nav?.deviceMemory;
  return typeof memory === "number" && memory <= 2;
}

/** Subscribe to network changes (saveData, effectiveType); returns the unsubscribe function. */
export function subscribeEngineConstraints(callback, nav = globalThis.navigator) {
  const connection = nav?.connection;
  if (typeof connection?.addEventListener !== "function") return () => {};
  connection.addEventListener("change", callback);
  return () => connection.removeEventListener("change", callback);
}

let idleReached = false;

/** Resolves once the page has loaded and the main thread is idle; rejects when `signal` aborts. */
export function afterLoadAndIdle(signal) {
  if (idleReached) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    let idleHandle = null;
    let timer = null;
    const cleanup = () => {
      window.removeEventListener("load", waitForIdle);
      if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle);
      if (timer !== null) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const done = () => {
      cleanup();
      idleReached = true;
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    function waitForIdle() {
      window.removeEventListener("load", waitForIdle);
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(done, { timeout: IDLE_TIMEOUT_MS });
      } else {
        timer = setTimeout(done, IDLE_FALLBACK_MS);
      }
    }
    signal?.addEventListener("abort", abort, { once: true });
    if (document.readyState === "complete") waitForIdle();
    else window.addEventListener("load", waitForIdle);
  });
}
