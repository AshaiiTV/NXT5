import React from "react";
import { ArrowRight, FileText, Target } from "lucide-react";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { ROSTER_ROLE_ORDER } from "../../pages/workspace/workspace-shared.jsx";
import { analysisCopy } from "./analysis-copy.js";

export function TrendNavigation({ items, activeId, onChange }) {
  const move = (event, index) => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index + items.length - 1) % items.length : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next][0]);
    event.currentTarget.parentElement.children[next]?.focus();
  };
  return <div className="trends-navigation">
    <label className="trends-mobile-navigation">Rubrique
      <select aria-label="Rubrique" value={activeId} onChange={(event) => onChange(event.target.value)}>{items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    </label>
    <div className="trends-tabs" role="tablist" aria-label="Rubriques des analyses">
      {items.map(([id, label, Icon, description], index) => <button key={id} id={`trend-tab-${id}`} type="button" role="tab" aria-selected={id === activeId} aria-controls={`trend-panel-${id}`} tabIndex={id === activeId ? 0 : -1} onKeyDown={(event) => move(event, index)} onClick={() => onChange(id)}>
        <Icon aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span>
      </button>)}
    </div>
  </div>;
}

export function TrendsOverview({ objective, plan, roles, briefs, alerts, onOpenSources, onObjectives }) {
  const open = (item) => onOpenSources({ title: item.label || item.title, subtitle: item.title, games: item.sourceGames });
  return <div className="trends-overview">
    <header className="trends-overview-intro"><h3>Le point de départ du débrief</h3><p>Commence par une piste, vérifie les parties concernées, puis choisis une consigne pour la prochaine session.</p></header>

    <Surface className="trends-priority-surface"><section className="trends-priority" aria-labelledby="trend-priority-title">
      <div><p className="trends-eyebrow"><Target aria-hidden="true" /> Piste proposée · à confirmer</p><h3 id="trend-priority-title">{analysisCopy(objective.title)}</h3><p className="trends-copy">{analysisCopy(objective.why)}</p><button type="button" className="trends-text-action" onClick={() => onOpenSources({ title: "Parties liées à cet objectif", subtitle: objective.title, games: objective.sourceGames })}><FileText aria-hidden="true" /> Vérifier les parties concernées</button></div>
      <div className="trends-priority-target"><p className="trends-eyebrow">Préparer la suite</p><strong>Transformer ce constat en consignes</strong><p>Retrouve les cibles de l’équipe et de chaque joueur dans Objectifs.</p><Button type="button" variant="ghost" icon={ArrowRight} onClick={onObjectives}>Voir les objectifs par rôle</Button></div>
    </section></Surface>

    <Surface className="trends-plan-surface"><details className="trends-secondary-disclosure">
      <summary><span><strong>Comprendre le plan de jeu récurrent</strong><span>{analysisCopy(plan.title)}</span></span></summary>
      <div className="trends-disclosure-content"><Badge tone={plan.toneName}>{analysisCopy(plan.value)}</Badge>
      <p className="trends-copy">{analysisCopy(plan.text)}</p>
      <button type="button" className="trends-text-action" onClick={() => open(plan)}><FileText aria-hidden="true" /> Examiner les parties de ce plan</button>
      <details className="trends-role-details"><summary>Comprendre la contribution des rôles</summary><p className="trends-copy">Les ressources et les champions éclairent la place de chacun dans ce plan de jeu.</p>
      <div className="trends-role-columns" aria-hidden="true"><span>Rôle et champions</span><span>Lecture du rôle</span><span>Part d’or</span><span>Part de dégâts</span><span>Sources</span></div>
      <div className="trends-roles">{[...roles].sort((a, b) => ROSTER_ROLE_ORDER.indexOf(a.role) - ROSTER_ROLE_ORDER.indexOf(b.role)).map((row) => <article className="trends-role" key={row.role}>
        <div className="trends-role-name"><RoleIcon role={row.role} lightweight /><div><h5>{roleLabel(row.role)}</h5><p>{row.championText || "Champions non renseignés"}</p></div></div>
        <div className="trends-role-function"><strong>{row.functionLabel}</strong><p>{row.games} partie{row.games > 1 ? "s" : ""} · {row.wr}% de victoires</p></div>
        <div className="trends-role-number"><span>Part d’or</span><b>{row.goldShare === null ? "—" : `${Math.round(row.goldShare)}%`}</b></div>
        <div className="trends-role-number"><span>Part de dégâts</span><b>{row.damageShare === null ? "—" : `${Math.round(row.damageShare)}%`}</b></div>
        <button type="button" className="trends-text-action" aria-label={`Voir les sources du rôle ${roleLabel(row.role)}`} onClick={() => onOpenSources({ title: roleLabel(row.role), subtitle: row.functionLabel, games: row.sourceGames })}><FileText aria-hidden="true" /><span>Sources</span></button>
      </article>)}</div>
      {!roles.length && <p className="trends-copy">Les participants ne sont pas encore renseignés sur cette sélection.</p>}
      </details>
      </div>
    </details></Surface>

    <Surface className="trends-review-surface"><section aria-labelledby="trend-review-title"><div className="trends-section-heading"><div><h3 id="trend-review-title">Approfondir un point du débrief</h3><p>Ouvre seulement les sujets utiles à la discussion. Chaque constat renvoie aux parties concernées.</p></div></div>
      <div className="trends-review-list">{briefs.filter((brief) => !["Bilan", "Plan de jeu"].includes(brief.label)).map((brief) => <details key={brief.label}><summary><span className="trends-eyebrow">{analysisCopy(brief.label)}</span><strong>{analysisCopy(brief.title)}</strong><span>{brief.sourceGames?.length || 0} parties</span></summary><div className="trends-review-content"><p>{analysisCopy(brief.text, { csComparison: true })}</p>{brief.evidence?.length > 0 && <ul>{brief.evidence.map((item) => <li key={item}>{analysisCopy(item, { csComparison: true })}</li>)}</ul>}<button type="button" className="trends-text-action" onClick={() => open(brief)}><FileText aria-hidden="true" /> Voir les parties sources</button></div></details>)}</div>
      {alerts.length > 0 && <details className="trends-alerts trends-secondary-disclosure"><summary><strong>Autres points de vigilance</strong><span>{Math.min(alerts.length, 3)}</span></summary>{alerts.slice(0, 3).map((alert) => <article key={alert.title}><alert.icon aria-hidden="true" /><div><h5>{analysisCopy(alert.title)}</h5><p>{analysisCopy(alert.text)}</p><p>{analysisCopy(alert.action)}</p></div></article>)}</details>}
    </section></Surface>

  </div>;
}
