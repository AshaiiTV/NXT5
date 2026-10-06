import React, { lazy, Suspense } from "react";
import { AppLoadingProvider } from "./components/loading/AppLoadingProvider.jsx";
import { AppErrorBoundary } from "./components/ui/AppErrorBoundary.jsx";

let appModule;
export function preloadApp() {
  appModule ||= import("./AppRouter.jsx");
  return appModule;
}
const LazyApp = lazy(preloadApp);

export default function NXT5({ initialApp: InitialApp }) {
  return (
    <AppErrorBoundary>
      <AppLoadingProvider>
        {InitialApp ? <InitialApp /> : <Suspense fallback={null}><LazyApp /></Suspense>}
      </AppLoadingProvider>
    </AppErrorBoundary>
  );
}
