import React, { createContext, useContext, useLayoutEffect, useState } from "react";
import { isAppPath } from "../../app/routing.js";
import AppLoadingScreen from "./AppLoadingScreen.jsx";

const AppLoadingContext = createContext(null);

// Keep the visual outside Suspense: resolving the application module or the
// session only updates this one screen instead of mounting another loader.
export function AppLoadingProvider({ children }) {
  const [loading, setLoading] = useState(() => ({
    phase: isAppPath(window.location.pathname) ? "app" : null,
    progress: null,
  }));

  return (
    <AppLoadingContext.Provider value={setLoading}>
      {children}
      {loading.phase && <AppLoadingScreen phase={loading.phase} progress={loading.progress} />}
    </AppLoadingContext.Provider>
  );
}

// undefined hands control to the mounted workspace; null releases the screen.
// Layout effects transfer ownership before paint, without delaying ready data.
export function useAppLoading(phase, progress = null) {
  const setLoading = useContext(AppLoadingContext);
  const loaded = progress?.loaded;
  const total = progress?.total;

  useLayoutEffect(() => {
    if (!setLoading || phase === undefined) return;
    setLoading((previous) => {
      if (previous.phase === phase && previous.progress?.loaded === loaded && previous.progress?.total === total) return previous;
      return { phase, progress: loaded === undefined || total === undefined ? null : { loaded, total } };
    });
  }, [phase, loaded, total, setLoading]);
}
