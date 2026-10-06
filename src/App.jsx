import React, { lazy, Suspense } from "react";
import { AppLoadingProvider } from "./components/loading/AppLoadingProvider.jsx";
import { AppErrorBoundary } from "./components/ui/AppErrorBoundary.jsx";

let appModule;
export function preloadApp() {
  appModule ||= import("./AppRouter.jsx");
  return appModule;
}
const LazyApp = lazy(preloadApp);

export default function NXT5({ initialApp: InitialApp, initialRoute, initialDemoPage }) {
  return (
    <AppErrorBoundary>
      <AppLoadingProvider initialPath={initialRoute?.path}>
        {InitialApp ? <InitialApp initialRoute={initialRoute} initialDemoPage={initialDemoPage} /> : <Suspense fallback={null}><LazyApp /></Suspense>}
      </AppLoadingProvider>
    </AppErrorBoundary>
  );
}
