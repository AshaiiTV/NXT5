import React from "react";
import { Button, Surface } from "./Core.jsx";

export class WorkspaceErrorBoundary extends React.Component {
  state = { failed: false };
  heading = React.createRef();
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.heading.current?.focus(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <Surface className="p-5 sm:p-7">
      <h2 data-workspace-error ref={this.heading} tabIndex={-1} className="text-xl font-bold text-white">Cette rubrique n’a pas pu s’afficher.</h2>
      <p role="alert" className="mt-3 text-sm leading-6 text-slate-300">Recharge la page pour réessayer. Tu peux aussi ouvrir une autre rubrique depuis le menu.</p>
      <Button type="button" className="mt-5" onClick={() => window.location.reload()}>Recharger</Button>
    </Surface>;
  }
}
