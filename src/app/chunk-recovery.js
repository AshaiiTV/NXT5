const RELOAD_KEY = "nxt5-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;

// After a deployment, an open tab still references the previous build files.
// Vite reports the failed dynamic import with `vite:preloadError`: reload once
// to fetch the new build, without looping when the failure persists.
export function installChunkRecovery(browser = window) {
  const recover = (event) => {
    if (browser.navigator?.onLine === false) return;
    try {
      const now = Date.now();
      const previous = Number(browser.sessionStorage.getItem(RELOAD_KEY));
      if (previous && now - previous < RELOAD_COOLDOWN_MS) return;
      // Without storage, keep recovery manual to avoid a reload loop.
      browser.sessionStorage.setItem(RELOAD_KEY, String(now));
      browser.location.reload();
      event.preventDefault();
    } catch {
      // The error boundaries offer the reload action instead.
    }
  };
  browser.addEventListener("vite:preloadError", recover);
  return () => browser.removeEventListener("vite:preloadError", recover);
}
