import React, { useId } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { DISCOVERY_TRIAL_DAYS, PASS_FEATURES, getPassFeatureAccess } from "../../app/pass-access.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import "./pass-feature-gate.css";

// An isolated visual preview: the blurred background contains decorative shapes only.
// Never mount protected content beneath an overlay or treat a CSS blur as authorization.
export function PassFeaturePreview({ feature = "workspace", onSubscribe }) {
  const titleId = useId();
  const details = PASS_FEATURES[feature] || PASS_FEATURES.workspace;
  return (
    <Surface className="pass-feature-preview">
      <section className="pass-feature-preview-layout" aria-labelledby={titleId}>
        <div className="pass-feature-preview-backdrop" aria-hidden="true">
          <div className="pass-feature-preview-bars"><span /><span /><span /></div>
          <div className="pass-feature-preview-chart">{[38, 58, 45, 76, 62, 88, 72, 94].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
          <div className="pass-feature-preview-lines"><span /><span /><span /></div>
        </div>
        <div className="pass-feature-preview-message">
          <LockKeyhole aria-hidden="true" className="h-6 w-6 text-cyan-200" />
          <Badge tone="purple">{details.label} · Pass Équipe</Badge>
          <h2 id={titleId} className="text-2xl font-black leading-tight tracking-tight">Continue avec ton équipe</h2>
          <p className="text-sm leading-6 text-slate-300">Après les {DISCOVERY_TRIAL_DAYS} jours d’accès complet de Découverte, prends le Pass Équipe pour {details.benefit}.</p>
          <p className="text-sm font-bold text-cyan-100">9,90 € TTC / mois / équipe</p>
          {onSubscribe ? <Button type="button" icon={ArrowRight} onClick={onSubscribe}>Prendre le Pass Équipe</Button> : <a href="/tarifs" className="nxt5-cyber-button nxt5-control nxt5-button-primary pass-feature-preview-link">Prendre le Pass Équipe<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></a>}
        </div>
      </section>
    </Surface>
  );
}

export default function PassFeatureGate({ feature = "workspace", hasTeamPass = false, hasActiveTrial = false, onSubscribe, children }) {
  const access = getPassFeatureAccess(feature, { hasTeamPass, hasActiveTrial });
  if (access.allowed) return children;
  return <PassFeaturePreview feature={feature} onSubscribe={onSubscribe} />;
}
