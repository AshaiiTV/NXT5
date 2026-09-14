import React from "react";
import { ArrowRight, FileText, Target } from "lucide-react";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { ROSTER_ROLE_ORDER } from "../../pages/workspace/workspace-shared.jsx";

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
    <div className="trends-tabs" role="tablist" aria-label="Sections Tendances">
      {items.map(([id, label, Icon, description], index) => <button key={id} id={`trend-tab-${id}`} type="button" role="tab" aria-selected={id === activeId} aria-controls={`trend-panel-${id}`} tabIndex={id === activeId ? 0 : -1} onKeyDown={(event) => move(event, index)} onClick={() => onChange(id)}>
        <Icon aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span>
      </button>)}
    </div>
  </div>;
}

export function TrendsOverview({ objective, plan, roles, briefs, alerts, onOpenSources, onObjectives }) {
  const open = (item) => onOpenSources({ title: item.label || item.title, subtitle: item.title, games: item.sourceGames });
  return <div className="trends-overview">
    <header className="trends-overview-intro"><h3>Le briefing de la review</h3><p>Les pistes à discuter en équipe et les games qui permettent de les vérifier.</p></header>

    <Surface><section className="trends-priority" aria-labelledby="trend-priority-title">
      <div><p className="trends-eyebrow"><Target aria-hidden="true" /> Axe de travail proposé</p><h3 id="trend-priority-title">{objective.title}</h3><p className="trends-copy">{objective.why}</p><button type="button" className="trends-text-action" onClick={() => onOpenSources({ title: "Sources objectif", subtitle: objective.title, games: objective.sourceGames })}><FileText aria-hidden="true" /> Voir les games sources</button></div>
      <div className="trends-priority-target"><p className="trends-eyebrow">Préparer la suite</p><strong>Transformer ce constat en consignes</strong><p>Retrouve les cibles de l’équipe et de chaque joueur dans Objectifs.</p><Button type="button" variant="ghost" icon={ArrowRight} onClick={onObjectives}>Voir les objectifs par rôle</Button></div>
    </section></Surface>

    <Surface><section aria-labelledby="trend-plan-title">
      <div className="trends-section-heading"><div><p className="trends-eyebrow">Plan de jeu récurrent</p><h3 id="trend-plan-title">{plan.title}</h3></div><Badge tone={plan.toneName}>{plan.value}</Badge></div>
      <p className="trends-copy">{plan.text}</p>
      <button type="button" className="trends-text-action" onClick={() => open(plan)}><FileText aria-hidden="true" /> Examiner les games de ce plan</button>
      <details className="trends-role-details"><summary>Comprendre la contribution des rôles</summary><p className="trends-copy">Les ressources et les champions éclairent la place de chacun dans ce plan de jeu.</p>
      <div className="trends-role-columns" aria-hidden="true"><span>Rôle et champions</span><span>Lecture du rôle</span><span>Part d’or</span><span>Part de dégâts</span><span>Sources</span></div>
      <div className="trends-roles">{[...roles].sort((a, b) => ROSTER_ROLE_ORDER.indexOf(a.role) - ROSTER_ROLE_ORDER.indexOf(b.role)).map((row) => <article className="trends-role" key={row.role}>
        <div className="trends-role-name"><RoleIcon role={row.role} lightweight /><div><h5>{roleLabel(row.role)}</h5><p>{row.championText || "Champions non renseignés"}</p></div></div>
        <div className="trends-role-function"><strong>{row.functionLabel}</strong><p>{row.games} game{row.games > 1 ? "s" : ""} · {row.wr}% de victoires</p></div>
        <div className="trends-role-number"><span>Part d’or</span><b>{row.goldShare === null ? "—" : `${Math.round(row.goldShare)}%`}</b></div>
        <div className="trends-role-number"><span>Part de dégâts</span><b>{row.damageShare === null ? "—" : `${Math.round(row.damageShare)}%`}</b></div>
        <button type="button" className="trends-text-action" aria-label={`Voir les sources du rôle ${roleLabel(row.role)}`} onClick={() => onOpenSources({ title: roleLabel(row.role), subtitle: row.functionLabel, games: row.sourceGames })}><FileText aria-hidden="true" /><span>Sources</span></button>
      </article>)}</div>
      {!roles.length && <p className="trends-copy">Les participants ne sont pas encore renseignés sur cette sélection.</p>}
      </details>
    </section></Surface>

    <Surface><section aria-labelledby="trend-review-title"><div className="trends-section-heading"><div><h3 id="trend-review-title">Les points à vérifier en review</h3><p>Ouvre un axe pour lire le constat et retrouver ses sources.</p></div></div>
      <div className="trends-review-list">{briefs.filter((brief) => !["Bilan", "Plan de jeu"].includes(brief.label)).map((brief) => <details key={brief.label}><summary><span className="trends-eyebrow">{brief.label}</span><strong>{brief.title}</strong><span>{brief.sourceGames?.length || 0} games</span></summary><div className="trends-review-content"><p>{brief.text}</p>{brief.evidence?.length > 0 && <ul>{brief.evidence.map((item) => <li key={item}>{item}</li>)}</ul>}<button type="button" className="trends-text-action" onClick={() => open(brief)}><FileText aria-hidden="true" /> Voir les games sources</button></div></details>)}</div>
      {alerts.length > 0 && <div className="trends-alerts"><h4>Points de vigilance</h4>{alerts.slice(0, 3).map((alert) => <article key={alert.title}><alert.icon aria-hidden="true" /><div><h5>{alert.title}</h5><p>{alert.text}</p><p>{alert.action}</p></div></article>)}</div>}
    </section></Surface>

  </div>;
}
