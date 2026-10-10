import { subscribeLanguage } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { Nxt5Wordmark } from "../brand/BrandAssets.jsx";
import { Badge, Button, Surface } from "./Core.jsx";

// Last resort for the whole application, including a failed download of the
// main module and public pages. Placed above AppLoadingProvider so the loading
// screen is released; exception details are never shown.
export class AppErrorBoundary extends React.Component {
  state = { failed: false };
  heading = React.createRef();
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidMount() { this.unsubscribeLanguage = subscribeLanguage(() => this.forceUpdate()); }
  componentWillUnmount() { this.unsubscribeLanguage?.(); }
  componentDidCatch() { this.heading.current?.focus(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="relative min-h-screen text-white">
      {/* Same markup as AmbientBackground, which lives in the lazy app chrome. */}
      <div className="nxt5-ambient-bg nxt5-ambient-calm" aria-hidden="true"><div className="nxt5-ambient-light" /></div>
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-4 py-8">
        <Nxt5Wordmark className="h-10 w-40 object-left sm:h-11 sm:w-44" />
        <Surface>
          <Badge tone="red">{t("Affichage interrompu")}</Badge>
          <h1 data-app-error ref={this.heading} tabIndex={-1} className="mt-4 text-2xl font-black text-white">{t("NXT5 n’a pas pu afficher cette page.")}</h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-slate-300">{t("Cela arrive après une mise à jour du site ou une coupure réseau. Recharge la page pour réessayer. Si le problème continue, reviens à l’accueil.")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={() => window.location.reload()}>{t("Recharger la page")}</Button>
            <Button type="button" variant="ghost" onClick={() => window.location.assign("/")}>{t("Retour à l’accueil")}</Button>
          </div>
        </Surface>
      </main>
    </div>;
  }
}
