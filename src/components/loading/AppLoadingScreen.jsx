import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useId } from "react";
import { Check } from "lucide-react";
import { Nxt5Wordmark, ResponsiveImage, RoleIcon } from "../brand/BrandAssets.jsx";
import "./AppLoadingScreen.css";

const ROLES = [
  { name: "TOP", color: "#67e8f9", x: 130, path: "M130 356C130 268 329 291 482 183", beam: "M110 356C110 250 329 260 482 183L550 160C347 322 160 289 150 356Z" },
  { name: "JGL", color: "#71d5ff", x: 340, path: "M340 356C340 285 456 273 517 217", beam: "M320 356C320 271 448 250 517 217L550 160C503 297 362 294 360 356Z" },
  { name: "MID", color: "#a4bbff", x: 550, path: "M550 356V218", beam: "M527 356L550 160L573 356Z" },
  { name: "ADC", color: "#c4b5fd", x: 760, path: "M760 356C760 285 644 273 583 217", beam: "M780 356C780 271 652 250 583 217L550 160C597 297 738 294 740 356Z" },
  { name: "SUP", color: "#e879f9", x: 970, path: "M970 356C970 268 771 291 618 183", beam: "M990 356C990 250 771 260 618 183L550 160C753 322 940 289 950 356Z" },
];

const PHASES = [
  { id: "app", label: "Ouverture", status: "Ouverture de NXT5", detail: "Ton espace d’équipe se prépare." },
  { id: "session", label: "Connexion", status: "Connexion à ton espace", detail: "On retrouve ton équipe." },
  { id: "bootstrap", label: "Synchronisation", status: "Synchronisation en cours", detail: "Tes joueurs, tes parties et tes débriefs." },
];

function TeamConvergence() {
  useLanguage();
  const id = useId().replaceAll(":", "");
  return (
    <div className="nxt5-sync-art" aria-hidden="true">
      <div className="nxt5-sync-horizon" />
      <div className="nxt5-sync-art-aura" />
      <div className="nxt5-sync-art-grid" />
      <div className="nxt5-sync-art-caption"><span>{t("05 RÔLES")}</span><span>{t("01 ÉQUIPE")}</span></div>
      <div className="nxt5-sync-stage">
        <svg className="nxt5-sync-circuit" viewBox="0 0 1100 440" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${id}-floor`} x1="140" y1="290" x2="960" y2="360" gradientUnits="userSpaceOnUse">
              <stop stopColor="#67e8f9" stopOpacity=".65" />
              <stop offset=".5" stopColor="#a4bbff" stopOpacity=".08" />
              <stop offset="1" stopColor="#e879f9" stopOpacity=".65" />
            </linearGradient>
            {ROLES.map((role) => <linearGradient key={role.name} id={`${id}-${role.name}`} x1={role.x} y1="356" x2="550" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor={role.color} stopOpacity=".02" /><stop offset=".65" stopColor={role.color} stopOpacity=".24" /><stop offset="1" stopColor={role.color} stopOpacity=".03" /></linearGradient>)}
          </defs>
          <path d="M40 344L550 92L1060 344M142 397L550 170L958 397M278 420L550 210L822 420" stroke={`url(#${id}-floor)`} strokeOpacity=".3" />
          <path d="M195 265H905M121 300H979M44 344H1056M143 397H957" stroke={`url(#${id}-floor)`} strokeOpacity=".2" />
          <ellipse cx="550" cy="276" rx="184" ry="36" stroke={`url(#${id}-floor)`} />
          <ellipse cx="550" cy="276" rx="131" ry="22" stroke={`url(#${id}-floor)`} strokeOpacity=".5" />
          {ROLES.map((role, index) => (
            <g key={role.name} style={{ "--sync-delay": `${index * -440}ms` }}>
              <path d={role.beam} fill={`url(#${id}-${role.name})`} />
              <path d={role.path} stroke={role.color} strokeOpacity=".06" strokeWidth="20" />
              <path d={role.path} stroke={role.color} strokeOpacity=".18" strokeWidth="6" />
              <path d={role.path} stroke={role.color} strokeOpacity=".6" strokeWidth="1" />
              <path className="nxt5-sync-signal" d={role.path} pathLength="100" stroke={role.color} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={role.x} cy="356" r="3" fill={role.color} />
            </g>
          ))}
        </svg>
        {ROLES.map((role, index) => <div key={role.name} className="nxt5-sync-role" style={{ "--role-x": `${role.x / 11}%`, "--sync-color": role.color, "--arrival-delay": `${index * 65 + 120}ms` }}>
          <div className="nxt5-sync-role-emblem"><RoleIcon role={role.name} className="nxt5-sync-role-icon" /></div>
          <span className="nxt5-sync-role-name">{role.name}</span>
        </div>)}
      </div>
      <div className="nxt5-sync-core">
        <div className="nxt5-sync-core-glow" />
        <div className="nxt5-sync-core-arrival">
          <div className="nxt5-sync-core-float">
            <div className="nxt5-sync-core-frame" />
            <ResponsiveImage src="/assets/nxt5-loader-favicon.png" sources={[{ srcSet: "/assets/nxt5-loader-favicon-256.webp" }]} alt="" width="512" height="512" loading="eager" decoding="async" />
          </div>
        </div>
      </div>
      <div className="nxt5-sync-sparks"><i /><i /><i /><i /><i /><i /></div>
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
      <div className="nxt5-sync-ambient" aria-hidden="true"><i /><i /><i /></div>
      <div className="nxt5-sync-shell">
        <header className="nxt5-sync-header">
          <Nxt5Wordmark className="nxt5-sync-wordmark" loading="eager" />
          <div className="nxt5-sync-header-label"><span />{t(" ESPACE D’ÉQUIPE")}</div>
        </header>
        <main className="nxt5-sync-main">
          {teamConvergence}
          <div className="nxt5-sync-copy">
            <p className="nxt5-sync-eyebrow">{t("LA SUITE SE JOUE ENSEMBLE")}</p>
            <h1><span className="nxt5-sync-title-intro">{t("Cinq rôles.")}</span><span className="nxt5-sync-title-impact">{t("Une même ")}<span>{t("direction.")}</span></span></h1>
            <p className="nxt5-sync-description">{t("Tes joueurs, tes parties, tes prochaines décisions.")}</p>
          </div>
          <section className="nxt5-sync-loading" aria-label={t("Chargement de ton espace")}>
            <div className="nxt5-sync-status-row">
              <div className="nxt5-sync-status" role="status" aria-live="polite" aria-atomic="true">
                <span className="nxt5-sync-status-light" aria-hidden="true"><i /><i /><i /></span>
                <div><p>{t(current.status)}</p><span>{t(current.detail)}</span></div>
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
