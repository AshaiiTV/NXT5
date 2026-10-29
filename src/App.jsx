import React, { lazy, Suspense } from "react";
import { AppLoadingProvider } from "./components/loading/AppLoadingProvider.jsx";
import { AppErrorBoundary } from "./components/ui/AppErrorBoundary.jsx";
import { restoreLanguage } from "./i18n/locale.js";
import { useLanguage } from "./i18n/useLanguage.js";

let appModule;
export function preloadApp() {
  appModule ||= import("./AppRouter.jsx");
  return appModule;
}
const LazyApp = lazy(preloadApp);

export default function NXT5({ initialApp: InitialApp, initialRoute, initialDemoPage }) {
  const language = useLanguage();
  React.useEffect(() => { Promise.resolve(restoreLanguage()).catch(() => {}); }, []);
  React.useEffect(() => { if (globalThis.document?.documentElement) document.documentElement.lang = language; }, [language]);
  return (
    <AppErrorBoundary>
      <AppLoadingProvider initialPath={initialRoute?.path}>
        {InitialApp ? <InitialApp initialRoute={initialRoute} initialDemoPage={initialDemoPage} /> : <Suspense fallback={null}><LazyApp /></Suspense>}
      </AppLoadingProvider>
    </AppErrorBoundary>
  );
}
