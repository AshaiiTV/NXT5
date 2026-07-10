import React, { Suspense, lazy } from "react";

const NXT5App = lazy(() => import("./AppContent.jsx"));

function AppShellFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020511] px-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,216,255,.16),transparent_30%),radial-gradient(circle_at_85%_8%,rgba(217,0,255,.13),transparent_32%)]" />
      <div className="relative flex flex-col items-center text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-200/20 border-t-cyan-200 shadow-[0_0_24px_rgba(34,211,238,.22)]" />
        <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-cyan-100/80">Chargement NXT5</p>
      </div>
    </div>
  );
}

export default function NXT5() {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <NXT5App />
    </Suspense>
  );
}
