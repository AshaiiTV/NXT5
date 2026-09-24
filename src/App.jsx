import React, { lazy, Suspense } from "react";
import { AppLoadingProvider } from "./components/loading/AppLoadingProvider.jsx";

let appModule;
export function preloadApp() {
  appModule ||= import("./AppContent.jsx");
  return appModule;
}
const LazyApp = lazy(preloadApp);

export default function NXT5({ initialApp: InitialApp }) {
  return (
    <AppLoadingProvider>
      {InitialApp ? <InitialApp /> : <Suspense fallback={null}><LazyApp /></Suspense>}
    </AppLoadingProvider>
  );
}
