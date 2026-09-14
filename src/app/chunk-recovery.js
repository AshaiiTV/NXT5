const RELOAD_KEY = "nxt5-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;

/** Recover an old tab after deployment, without an endless reload loop. */
export function installChunkRecovery(browser = window) {
  const recover = (event) => {
    if (browser.navigator?.onLine === false) return;
    try {
      const now = Date.now();
      const previous = Number(browser.sessionStorage.getItem(RELOAD_KEY));
      if (previous && now - previous < RELOAD_COOLDOWN_MS) return;
      // Without storage, leave recovery manual to avoid a reload loop.
      browser.sessionStorage.setItem(RELOAD_KEY, String(now));
      browser.location.reload();
      event.preventDefault();
    } catch {
      // Let React's error boundary offer the recovery actions.
    }
  };
  browser.addEventListener("vite:preloadError", recover);
  return () => browser.removeEventListener("vite:preloadError", recover);
}
