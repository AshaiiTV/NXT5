import React, { useId } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import { Nxt5Wordmark, ResponsiveImage } from "../brand/BrandAssets.jsx";
import "./AppLoadingScreen.css";

const ROLES = [
  { name: "TOP", color: "#67e8f9", x: 76, path: "M76 98V174Q76 206 108 224L266 308" },
  { name: "JGL", color: "#71d5ff", x: 198, path: "M198 98V184Q198 213 220 238L291 309" },
  { name: "MID", color: "#a4bbff", x: 320, path: "M320 98V301" },
  { name: "ADC", color: "#b8a0ff", x: 442, path: "M442 98V184Q442 213 420 238L349 309" },
  { name: "SUP", color: "#e5a0ff", x: 564, path: "M564 98V174Q564 206 532 224L374 308" },
];

const PHASES = [
  { id: "app", label: "Ouverture", status: "Ouverture de NXT5", detail: "Ton espace d’équipe se prépare." },
  { id: "session", label: "Connexion", status: "Connexion à ton espace", detail: "On retrouve ton équipe." },
  { id: "bootstrap", label: "Synchronisation", status: "Synchronisation en cours", detail: "Roster, games, draft et review." },
];

function TeamConvergence() {
  const id = useId().replaceAll(":", "");
  return (
    <div className="nxt5-sync-art" aria-hidden="true">
      <div className="nxt5-sync-art-grid" />
      <div className="nxt5-sync-art-caption"><span>05 RÔLES</span><span>01 ÉQUIPE</span></div>
      <svg className="nxt5-sync-circuit" viewBox="0 0 640 490" fill="none">
        <defs>
          <linearGradient id={`${id}-ring`} x1="218" y1="260" x2="422" y2="442" gradientUnits="userSpaceOnUse">
            <stop stopColor="#67e8f9" stopOpacity=".6" />
            <stop offset=".48" stopColor="#9caaff" stopOpacity=".12" />
            <stop offset="1" stopColor="#d995ff" stopOpacity=".55" />
          </linearGradient>
          <radialGradient id={`${id}-core`}>
            <stop stopColor="#172c48" />
            <stop offset="1" stopColor="#070e1d" />
          </radialGradient>
        </defs>
        <path d="M28 120V42H136M504 42H612V120M28 376V454H136M504 454H612V376" stroke="#c9e7ff" strokeOpacity=".14" />
        <path d="M36 42H60M580 454H604" stroke="#b3d8ff" strokeOpacity=".65" />
        <path d="M28 350H612M320 30V466" stroke="#c9e7ff" strokeOpacity=".065" strokeDasharray="2 7" />
        <circle cx="320" cy="350" r="115" stroke="#9eb8e2" strokeOpacity=".11" />
        <circle cx="320" cy="350" r="102" stroke={`url(#${id}-ring)`} strokeDasharray="44 9 2 9" />
        {ROLES.map((role, index) => (
          <g key={role.name} style={{ "--sync-color": role.color, "--sync-delay": `${index * -480}ms` }}>
            <path d={role.path} stroke={role.color} strokeOpacity=".11" strokeWidth="9" />
            <path d={role.path} stroke={role.color} strokeOpacity=".4" strokeWidth="1" />
            <path className="nxt5-sync-signal" d={role.path} pathLength="100" stroke={role.color} strokeWidth="2" strokeLinecap="round" />
            <rect x={role.x - 26} y="57" width="52" height="40" rx="10" fill="#0a1426" stroke={role.color} strokeOpacity=".35" />
            <text x={role.x} y="82" fill={role.color} textAnchor="middle" fontSize="12" fontWeight="800" letterSpacing="1">{role.name}</text>
            <circle cx={role.x} cy="111" r="2" fill={role.color} />
          </g>
        ))}
        <rect x="256" y="286" width="128" height="128" rx="30" fill={`url(#${id}-core)`} stroke={`url(#${id}-ring)`} transform="rotate(45 320 350)" />
        <rect x="265" y="295" width="110" height="110" rx="25" stroke="#a9d7ff" strokeOpacity=".07" transform="rotate(45 320 350)" />
        <path d="M207 350H213M427 350H433M320 237V243M320 457V463" stroke="#c2e2ff" strokeOpacity=".6" />
      </svg>
      <div className="nxt5-sync-core">
        <ResponsiveImage src="/assets/nxt5-loader-favicon.png" sources={[{ srcSet: "/assets/nxt5-loader-favicon-256.webp" }]} alt="" width="512" height="512" loading="eager" decoding="async" />
      </div>
    </div>
  );
}

export default function AppLoadingScreen({ phase = "app", progress = null }) {
  const index = Math.max(0, PHASES.findIndex((step) => step.id === phase));
  const current = PHASES[index];
  const determinate = phase === "bootstrap" && Number.isFinite(progress?.total) && progress.total > 0 && Number.isFinite(progress?.loaded);
  const loaded = determinate ? Math.max(0, Math.min(progress.total, progress.loaded)) : 0;
  const ratio = determinate ? loaded / progress.total : 0;

  return (
    <div className="nxt5-sync-screen" data-phase={current.id}>
      <div className="nxt5-sync-ambient" aria-hidden="true" />
      <div className="nxt5-sync-shell">
        <header className="nxt5-sync-header">
          <Nxt5Wordmark className="nxt5-sync-wordmark" />
          <div className="nxt5-sync-header-label"><span /> ESPACE D’ÉQUIPE</div>
        </header>

        <main className="nxt5-sync-main">
          <div className="nxt5-sync-copy">
            <p className="nxt5-sync-eyebrow"><span /> LA SUITE SE JOUE ENSEMBLE</p>
            <h1>Cinq rôles.<br />Une même<br /><span>direction.</span></h1>
            <p className="nxt5-sync-description">Ton roster, tes games, tes prochaines décisions.</p>
            <div className="nxt5-sync-disciplines" aria-label="Roster, games, draft et review">
              <span>ROSTER</span><i /><span>GAMES</span><i /><span>DRAFT</span><i /><span>REVIEW</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </div>
          </div>
          <TeamConvergence />
        </main>

        <footer className="nxt5-sync-footer">
          <div className="nxt5-sync-status-row">
            <div className="nxt5-sync-status" role="status" aria-live="polite" aria-atomic="true">
              <span className="nxt5-sync-status-light" aria-hidden="true"><i /><i /><i /></span>
              <div><p>{current.status}</p><span>{current.detail}</span></div>
            </div>
            <div className="nxt5-sync-count" aria-hidden="true">
              {determinate ? <><strong>{loaded}<span> / {progress.total}</span></strong><span>GAMES REÇUES</span></> : <><strong>0{index + 1}<span> / 03</span></strong><span>ÉTAPE EN COURS</span></>}
            </div>
          </div>

          <div className={`nxt5-sync-progress${determinate ? " is-determinate" : ""}`} role="progressbar" aria-label={determinate ? "Chargement des games" : current.status} aria-valuemin={determinate ? 0 : undefined} aria-valuemax={determinate ? progress.total : undefined} aria-valuenow={determinate ? loaded : undefined} aria-valuetext={determinate ? `${loaded} games reçues sur ${progress.total}` : `Étape ${index + 1} sur 3 : ${current.label}`}>
            <span style={determinate ? { transform: `scaleX(${ratio})` } : undefined} />
          </div>

          <div className="nxt5-sync-footer-bottom">
            <ol className="nxt5-sync-steps" aria-label="Étapes du chargement">
              {PHASES.map((step, stepIndex) => (
                <li key={step.id} className={stepIndex === index ? "is-current" : stepIndex < index ? "is-done" : ""} aria-current={stepIndex === index ? "step" : undefined}>
                  <span className="nxt5-sync-step-number" aria-hidden="true">{stepIndex < index ? <Check size={12} /> : `0${stepIndex + 1}`}</span>
                  <span>{step.label}</span>
                  {stepIndex < index && <span className="sr-only"> : terminé</span>}
                </li>
              ))}
            </ol>
            <p className="nxt5-sync-signature">PLAY. LEARN. <span>REPEAT.</span></p>
          </div>
        </footer>
      </div>
    </div>
  );
}
