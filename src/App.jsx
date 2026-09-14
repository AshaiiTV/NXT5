import React, { Suspense, lazy } from "react";
import { AppLoadingProvider } from "./components/loading/AppLoadingProvider.jsx";
import { Badge, Button, Surface } from "./components/ui/Core.jsx";

const NXT5App = lazy(() => import("./AppContent.jsx"));

// Includes startup and route failures, releasing the loading screen on error.
export class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error, info) {
    console.error("NXT5 application error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020511] px-4 py-8 text-white">
        <Surface className="w-full max-w-lg">
          <div role="alert" className="space-y-4">
            <Badge tone="red">Chargement interrompu</Badge>
            <h1 className="text-2xl font-black">NXT5 n’a pas pu afficher cette page.</h1>
            <p className="text-sm leading-6 text-slate-300">Vérifie ta connexion, puis recharge la page. Si le problème continue, tu peux revenir à l’accueil.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={() => window.location.reload()}>Recharger la page</Button>
            <Button type="button" variant="ghost" onClick={() => window.location.assign("/")}>Retour à l’accueil</Button>
          </div>
        </Surface>
      </main>
    );
  }
}

export default function NXT5() {
  return (
    <AppErrorBoundary>
      <AppLoadingProvider>
        <Suspense fallback={null}>
          <NXT5App />
        </Suspense>
      </AppLoadingProvider>
    </AppErrorBoundary>
  );
}
