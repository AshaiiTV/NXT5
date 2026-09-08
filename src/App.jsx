import React, { Suspense, lazy } from "react";
import { AppLoadingProvider } from "./components/loading/AppLoadingProvider.jsx";

const NXT5App = lazy(() => import("./AppContent.jsx"));

export default function NXT5() {
  return (
    <AppLoadingProvider>
      <Suspense fallback={null}>
        <NXT5App />
      </Suspense>
    </AppLoadingProvider>
  );
}
