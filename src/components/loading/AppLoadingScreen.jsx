import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useId } from "react";
import { Check } from "lucide-react";
import { Nxt5Wordmark, ResponsiveImage, RoleIcon } from "../brand/BrandAssets.jsx";
import "./AppLoadingScreen.css";

const ROLES = [
  { name: "TOP", color: "#67e8f9", x: 175, y: 430, path: "M175 430 460 286 504 257", beam: "M108 444 181 468 513 271 493 258Z" },
  { name: "JGL", color: "#71d5ff", x: 360, y: 462, path: "M360 462 495 309 531 265", beam: "M310 494 374 506 541 275 526 266Z" },
  { name: "MID", color: "#a4bbff", x: 550, y: 480, path: "M550 480V278", beam: "M523 525 577 525 557 278 543 278Z" },
  { name: "ADC", color: "#c4b5fd", x: 740, y: 462, path: "M740 462 605 309 569 265", beam: "M726 506 790 494 574 266 559 275Z" },
  { name: "SUP", color: "#e879f9", x: 925, y: 430, path: "M925 430 640 286 596 257", beam: "M919 468 992 444 607 258 587 271Z" },
];

const PHASES = [
  { id: "app", label: "Ouverture", status: "Ouverture de NXT5", detail: "Chargement de ton espace d’équipe." },
  { id: "session", label: "Connexion", status: "Connexion à ton espace", detail: "On retrouve ton équipe." },
  { id: "bootstrap", label: "Synchronisation", status: "Synchronisation en cours", detail: "Chargement des joueurs, parties et débriefs." },
];

function TeamConvergence() {
  useLanguage();
  const id = useId().replaceAll(":", "");
  return (
    <div className="nxt5-sync-art" aria-hidden="true">
      <div className="nxt5-sync-art-aura" />
      <div className="nxt5-sync-stage">
        <svg className="nxt5-sync-circuit" viewBox="0 0 1100 580" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${id}-floor`} x1="160" y1="320" x2="920" y2="550" gradientUnits="userSpaceOnUse"><stop stopColor="#67e8f9" stopOpacity=".11" /><stop offset=".35" stopColor="#8b5cf6" stopOpacity=".07" /><stop offset=".7" stopColor="#8061af" stopOpacity=".28" /><stop offset="1" stopColor="#e879f9" stopOpacity=".11" /></linearGradient>
            <linearGradient id={`${id}-rim`} x1="30" y1="480" x2="1060" y2="520" gradientUnits="userSpaceOnUse"><stop stopColor="#67e8f9" stopOpacity=".05" /><stop offset=".2" stopColor="#67e8f9" stopOpacity=".65" /><stop offset=".53" stopColor="#c4b5fd" stopOpacity=".85" /><stop offset=".8" stopColor="#e879f9" stopOpacity=".6" /><stop offset="1" stopColor="#e879f9" stopOpacity=".03" /></linearGradient>
            <linearGradient id={`${id}-depth`} x1="550" y1="330" x2="550" y2="580" gradientUnits="userSpaceOnUse"><stop stopColor="#b4a0ed" stopOpacity=".3" /><stop offset="1" stopColor="#472a77" stopOpacity="0" /></linearGradient>
            {ROLES.map((role) => <linearGradient key={role.name} id={`${id}-${role.name}`} x1={role.x} y1={role.y + 40} x2="550" y2="260" gradientUnits="userSpaceOnUse"><stop stopColor={role.color} stopOpacity=".02" /><stop offset=".55" stopColor={role.color} stopOpacity=".11" /><stop offset="1" stopColor={role.color} stopOpacity=".04" /></linearGradient>)}
          </defs>
          <g className="nxt5-sync-floor">
            <path d="M-110 438 538 245 1210 462 567 674Z" fill={`url(#${id}-floor)`} />
            <path d="M-110 438 538 245 1210 462M-110 438 567 636 1210 462" stroke={`url(#${id}-rim)`} strokeWidth="1.5" />
            <path d="M-110 438 567 636 1210 462 1210 491 567 675-110 470Z" fill={`url(#${id}-depth)`} />
            <path d="M-200 340 349 250 448 263 17 399Z" fill={`url(#${id}-floor)`} stroke={`url(#${id}-rim)`} strokeOpacity=".28" />
            <path d="M680 278 1400 322 1116 441 644 294Z" fill={`url(#${id}-floor)`} stroke={`url(#${id}-rim)`} strokeOpacity=".32" />
            <path d="M-70 495 538 302 1180 517" stroke={`url(#${id}-rim)`} strokeOpacity=".12" />
          </g>
          {ROLES.map((role, index) => (
            <g key={role.name} style={{ "--sync-delay": `${index * -520}ms` }}>
              <path d={role.beam} fill={`url(#${id}-${role.name})`} />
              <path d={role.path} stroke={role.color} strokeOpacity=".035" strokeWidth="16" />
              <path d={role.path} stroke={role.color} strokeOpacity=".08" strokeWidth="5" />
              <path d={role.path} stroke={role.color} strokeOpacity=".38" strokeWidth="1" />
              <path className="nxt5-sync-signal" d={role.path} pathLength="100" stroke={role.color} strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ))}
        </svg>
        {ROLES.map((role, index) => <div key={role.name} className="nxt5-sync-role" style={{ "--role-x": `${role.x / 11}%`, "--role-y": `${role.y / 5.8}%`, "--sync-color": role.color, "--arrival-delay": `${index * 45 + 80}ms` }}>
          <div className="nxt5-sync-role-emblem"><RoleIcon role={role.name} className="nxt5-sync-role-icon" /></div>
          <span className="nxt5-sync-role-name">{role.name}</span>
        </div>)}
      </div>
      <div className="nxt5-sync-core">
        <div className="nxt5-sync-core-glow" />
        <div className="nxt5-sync-core-arrival">
          <div className="nxt5-sync-core-float">
            <ResponsiveImage src="/assets/nxt5-loader-favicon.png" sources={[{ srcSet: "/assets/nxt5-loader-favicon-256.webp 256w, /assets/nxt5-loader-favicon-512.webp 512w" }]} sizes="(max-width: 760px) 180px, 320px" alt="" width="512" height="512" loading="eager" decoding="async" />
          </div>
        </div>
      </div>
    </div>
  );
}

// The decorative scene stays identical while the real loading state changes.
const teamConvergence = <TeamConvergence />;

export default function AppLoadingScreen({ phase = "app", progress = null }) {
  useLanguage();
  const index = Math.max(0, PHASES.findIndex((step) => step.id === phase));
  const current = PHASES[index];
  const determinate = phase === "bootstrap" && Number.isFinite(progress?.total) && progress.total > 0 && Number.isFinite(progress?.loaded);
  const loaded = determinate ? Math.max(0, Math.min(progress.total, progress.loaded)) : 0;
  const ratio = determinate ? loaded / progress.total : 0;

  return (
    <div className="nxt5-sync-screen" data-phase={current.id}>
      <div className="nxt5-sync-ambient" aria-hidden="true"><div className="nxt5-sync-atmosphere" /><div className="nxt5-sync-light" /><div className="nxt5-sync-glass-wing is-left" /><div className="nxt5-sync-glass-wing is-right" /></div>
      <div className="nxt5-sync-shell">
        <header className="nxt5-sync-header">
          <Nxt5Wordmark className="nxt5-sync-wordmark" loading="eager" />
        </header>
        <main className="nxt5-sync-main">
          {teamConvergence}
          <section className="nxt5-sync-loading" aria-label={t("Chargement de ton espace")}>
            <div className="nxt5-sync-status-row">
              <div className="nxt5-sync-status" role="status" aria-live="polite" aria-atomic="true">
                <div><h1>{t(current.status)}</h1><span>{t(current.detail)}</span></div>
              </div>
              <div className="nxt5-sync-count" aria-hidden="true">
                {determinate ? <><strong>{loaded}<span> / {progress.total}</span></strong><span>{t("PARTIES REÇUES")}</span></> : <><strong>0{index + 1}<span> / 03</span></strong><span>{t("ÉTAPE EN COURS")}</span></>}
              </div>
            </div>
            <div className={`nxt5-sync-progress${determinate ? " is-determinate" : ""}`} role="progressbar" aria-label={determinate ? t("Chargement des parties") : t(current.status)} aria-valuemin={determinate ? 0 : undefined} aria-valuemax={determinate ? progress.total : undefined} aria-valuenow={determinate ? loaded : undefined} aria-valuetext={determinate ? t("{0} parties reçues sur {1}", [loaded, progress.total]) : t("Étape {0} sur 3 : {1}", [index + 1, t(current.label)])}>
              <span style={determinate ? { transform: `scaleX(${ratio})` } : undefined} />
            </div>
            <ol className="nxt5-sync-steps" aria-label={t("Étapes du chargement")}>
              {PHASES.map((step, stepIndex) => (
                <li key={step.id} className={stepIndex === index ? "is-current" : stepIndex < index ? "is-done" : ""} aria-current={stepIndex === index ? "step" : undefined}>
                  <span className="nxt5-sync-step-number" aria-hidden="true">{stepIndex < index ? <Check size={12} /> : `0${stepIndex + 1}`}</span>
                  <span>{t(step.label)}</span>
                  {stepIndex < index && <span className="sr-only">{t(" : terminé")}</span>}
                </li>
              ))}
            </ol>
          </section>
        </main>
        <footer className="nxt5-sync-footer"><p className="nxt5-sync-signature">{t("PLAY. LEARN. ")}<span>{t("REPEAT.")}</span></p></footer>
      </div>
    </div>
  );
}
