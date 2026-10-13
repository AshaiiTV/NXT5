import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { Check } from "lucide-react";
import { Nxt5Wordmark, ResponsiveImage, RoleIcon } from "../brand/BrandAssets.jsx";
import "./AppLoadingScreen.css";

const ROLES = [
  { name: "TOP", color: "#67e8f9" },
  { name: "JGL", color: "#71d5ff" },
  { name: "MID", color: "#a4bbff" },
  { name: "ADC", color: "#c4b5fd" },
  { name: "SUP", color: "#e879f9" },
];

const PHASES = [
  { id: "app", label: "Ouverture", status: "Ouverture de NXT5", detail: "Chargement de ton espace d’équipe." },
  { id: "session", label: "Connexion", status: "Connexion à ton espace", detail: "On retrouve ton équipe." },
  { id: "bootstrap", label: "Synchronisation", status: "Synchronisation en cours", detail: "Chargement des joueurs, parties et débriefs." },
];

const GLASS_FACETS = [
  { x: "14%", y: "24%", size: "13px", turn: "-24deg", delay: "-1.3s", duration: "7.2s" },
  { x: "79%", y: "19%", size: "10px", turn: "28deg", delay: "-4.6s", duration: "8.4s" },
  { x: "7%", y: "47%", size: "8px", turn: "14deg", delay: "-3.1s", duration: "7.8s" },
  { x: "88%", y: "48%", size: "15px", turn: "-32deg", delay: "-.8s", duration: "9.2s" },
  { x: "23%", y: "69%", size: "9px", turn: "38deg", delay: "-5.4s", duration: "8.8s" },
  { x: "76%", y: "71%", size: "8px", turn: "-12deg", delay: "-2.5s", duration: "7.6s" },
];

function GlassOrbit({ front = false }) {
  const gradientId = React.useId();
  const path = front
    ? "M 71 335 C 102 393 236 417 369 386 C 479 361 547 312 524 274"
    : "M 547 282 A 247 100 0 1 1 53 282 A 247 100 0 1 1 547 282";
  return <svg className={`nxt5-sync-energy ${front ? "is-front" : "is-rear"}`} viewBox="0 0 600 560" fill="none" focusable="false">
    <defs>
      <linearGradient id={gradientId} x1="70" y1="180" x2="510" y2="400" gradientUnits="userSpaceOnUse">
        <stop stopColor="#67e8f9" />
        <stop offset=".46" stopColor="#e4dbff" />
        <stop offset=".72" stopColor="#bda0ff" />
        <stop offset="1" stopColor="#e879f9" />
      </linearGradient>
    </defs>
    <g transform={front ? "rotate(9 300 320)" : "rotate(-21 300 282)"} stroke={`url(#${gradientId})`}>
      <path className="nxt5-sync-energy-track" d={path} />
      <path className="nxt5-sync-energy-glow" d={path} pathLength="100" />
      <path className="nxt5-sync-energy-trail" d={path} pathLength="100" />
      <path className="nxt5-sync-energy-glint" d={path} pathLength="100" />
    </g>
  </svg>;
}

function GlassStage() {
  return (
    <div className="nxt5-sync-art" aria-hidden="true">
      <div className="nxt5-sync-art-aura" />
      <div className="nxt5-sync-stage">
        <div className="nxt5-sync-stage-halo" />
        <div className="nxt5-sync-orbit is-outer" />
        <div className="nxt5-sync-orbit is-inner" />
        <div className="nxt5-sync-stage-reflection" />
      </div>
      <GlassOrbit />
      <div className="nxt5-sync-facets">
        {GLASS_FACETS.map((facet, index) => <span key={index} className="nxt5-sync-facet" style={{
          "--facet-x": facet.x, "--facet-y": facet.y, "--facet-size": facet.size,
          "--facet-turn": facet.turn, "--facet-delay": facet.delay, "--facet-duration": facet.duration,
        }} />)}
      </div>
      <div className="nxt5-sync-core">
        <div className="nxt5-sync-core-arrival">
          <div className="nxt5-sync-core-float">
            <ResponsiveImage
              src="/assets/home-motion/glass-poster.webp"
              alt=""
              width="729"
              height="665"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      </div>
      <GlassOrbit front />
      <div className="nxt5-sync-roles">
        {ROLES.map((role) => (
          <div key={role.name} className="nxt5-sync-role" style={{ "--sync-color": role.color }}>
            <RoleIcon role={role.name} className="nxt5-sync-role-icon" />
            <span className="nxt5-sync-role-name">{role.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The sculpture stays mounted while the real loading state changes.
const glassStage = <GlassStage />;

export default function AppLoadingScreen({ phase = "app", progress = null }) {
  useLanguage();
  const index = Math.max(0, PHASES.findIndex((step) => step.id === phase));
  const current = PHASES[index];
  const determinate = phase === "bootstrap" && Number.isFinite(progress?.total) && progress.total > 0 && Number.isFinite(progress?.loaded);
  const loaded = determinate ? Math.max(0, Math.min(progress.total, progress.loaded)) : 0;
  const ratio = determinate ? loaded / progress.total : 0;

  return (
    <div className="nxt5-sync-screen" data-phase={current.id}>
      <div className="nxt5-sync-ambient" aria-hidden="true">
        <div className="nxt5-sync-atmosphere" />
        <div className="nxt5-sync-light" />
        <div className="nxt5-sync-horizon" />
      </div>
      <div className="nxt5-sync-shell">
        <header className="nxt5-sync-header">
          <Nxt5Wordmark className="nxt5-sync-wordmark" sizes="132px" loading="eager" />
          <div className="nxt5-sync-phase" aria-hidden="true">
            <span>{t("ÉTAPE EN COURS")}</span>
            <strong>0{index + 1}<span> / 03</span></strong>
          </div>
        </header>
        <main className="nxt5-sync-main">
          {glassStage}
          <section className="nxt5-sync-loading" aria-label={t("Chargement de ton espace")}>
            <div className="nxt5-sync-eyebrow" aria-hidden="true"><span />{t(current.label)}</div>
            <div className="nxt5-sync-status" role="status" aria-live="polite" aria-atomic="true">
              <h1>{t(current.status)}</h1>
              <p>{t(current.detail)}</p>
            </div>
            <div className="nxt5-sync-progress-caption" aria-hidden="true">
              <span>{determinate ? t("PARTIES REÇUES") : t("Chargement de ton espace")}</span>
              <div className="nxt5-sync-count">
                {determinate ? <strong>{loaded}<span> / {progress.total}</span></strong> : <span className="nxt5-sync-waiting"><i /><i /><i /></span>}
              </div>
            </div>
            <div className={`nxt5-sync-progress${determinate ? " is-determinate" : ""}`} role="progressbar" aria-label={determinate ? t("Chargement des parties") : t(current.status)} aria-valuemin={determinate ? 0 : undefined} aria-valuemax={determinate ? progress.total : undefined} aria-valuenow={determinate ? loaded : undefined} aria-valuetext={determinate ? t("{0} parties reçues sur {1}", [loaded, progress.total]) : t("Étape {0} sur 3 : {1}", [index + 1, t(current.label)])}>
              <span style={determinate ? { transform: `scaleX(${ratio})` } : undefined} />
            </div>
            <ol className="nxt5-sync-steps" aria-label={t("Étapes du chargement")}>
              {PHASES.map((step, stepIndex) => (
                <li key={step.id} className={stepIndex === index ? "is-current" : stepIndex < index ? "is-done" : ""} aria-current={stepIndex === index ? "step" : undefined}>
                  <span className="nxt5-sync-step-number" aria-hidden="true">{stepIndex < index ? <Check size={13} /> : `0${stepIndex + 1}`}</span>
                  <span>{t(step.label)}</span>
                  {stepIndex < index && <span className="sr-only">{t(" : terminé")}</span>}
                </li>
              ))}
            </ol>
          </section>
        </main>
        <footer className="nxt5-sync-footer">
          <p className="nxt5-sync-motto">{t("Cinq rôles.")} <span>{t("Une même direction.")}</span></p>
          <p className="nxt5-sync-signature">{t("PLAY. LEARN. ")}<span>{t("REPEAT.")}</span></p>
        </footer>
      </div>
    </div>
  );
}
