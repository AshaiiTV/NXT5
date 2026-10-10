import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { winrateLabel } from "../../utils/statistics.js";
import React from "react";
import { ArrowRight, FileText, Target } from "lucide-react";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { ROSTER_ROLE_ORDER } from "../../pages/workspace/workspace-shared.jsx";
import { analysisCopy } from "./analysis-copy.js";

export function TrendNavigation({ items, activeId, onChange }) {
  useLanguage();
  const move = (event, index) => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index + items.length - 1) % items.length : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next][0]);
    event.currentTarget.parentElement.children[next]?.focus();
  };
  return <div className="trends-navigation">
    <label className="trends-mobile-navigation">{t("Rubrique")}<select aria-label={t("Rubrique")} value={activeId} onChange={(event) => onChange(event.target.value)}>{items.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select>
    </label>
    <div className="trends-tabs" role="tablist" aria-label={t("Rubriques des analyses")}>
      {items.map(([id, label, Icon, description], index) => <button key={id} id={`trend-tab-${id}`} type="button" role="tab" aria-selected={id === activeId} aria-controls={`trend-panel-${id}`} tabIndex={id === activeId ? 0 : -1} onKeyDown={(event) => move(event, index)} onClick={() => onChange(id)}>
        <Icon aria-hidden="true" /><span><strong>{t(label)}</strong><small>{t(description)}</small></span>
      </button>)}
    </div>
  </div>;
}

export function TrendsOverview({ objective, plan, roles, briefs, alerts, onOpenSources, onObjectives }) {
  useLanguage();
  const open = (item) => onOpenSources({ title: item.label || item.title, subtitle: item.title, games: item.sourceGames });
  return <div className="trends-overview">
    <Surface className="trends-priority-surface"><section className="trends-priority" aria-labelledby="trend-priority-title">
      <div><p className="trends-eyebrow"><Target aria-hidden="true" />{t(" À vérifier en débrief")}</p><h3 id="trend-priority-title">{analysisCopy(objective.title)}</h3><p className="trends-copy">{analysisCopy(objective.why)}</p><Button type="button" className="trends-priority-action" icon={FileText} onClick={() => onOpenSources({ title: "Parties liées à cet objectif", subtitle: objective.title, games: objective.sourceGames })}>{t("Vérifier les parties concernées")}</Button></div>
      <div className="trends-priority-target"><p>{t("Après vérification, choisis une consigne pour la prochaine session.")}</p><button type="button" className="trends-text-action" onClick={onObjectives}>{t("Voir les objectifs par rôle ")}<ArrowRight aria-hidden="true" /></button></div>
    </section></Surface>

    <Surface className="trends-plan-surface"><details className="trends-secondary-disclosure">
      <summary><span><strong>{t("Comprendre le plan de jeu récurrent")}</strong><span>{t(analysisCopy(plan.title))}</span></span></summary>
      <div className="trends-disclosure-content"><Badge tone={plan.toneName}>{t(analysisCopy(plan.value))}</Badge>
      <p className="trends-copy">{t(analysisCopy(plan.text))}</p>
      <button type="button" className="trends-text-action" onClick={() => open(plan)}><FileText aria-hidden="true" />{t(" Examiner les parties de ce plan")}</button>
      <details className="trends-role-details"><summary>{t("Comprendre la contribution des rôles")}</summary><p className="trends-copy">{t("Les ressources et les champions éclairent la place de chacun dans ce plan de jeu.")}</p>
      <div className="trends-role-columns" aria-hidden="true"><span>{t("Rôle et champions")}</span><span>{t("Lecture du rôle")}</span><span>{t("Part d’or")}</span><span>{t("Part de dégâts")}</span><span>{t("Sources")}</span></div>
      <div className="trends-roles">{[...roles].sort((a, b) => ROSTER_ROLE_ORDER.indexOf(a.role) - ROSTER_ROLE_ORDER.indexOf(b.role)).map((row) => <article className="trends-role" key={row.role}>
        <div className="trends-role-name"><RoleIcon role={row.role} lightweight /><div><h5>{t(roleLabel(row.role))}</h5><p>{row.championText || t("Champions non renseignés")}</p></div></div>
        <div className="trends-role-function"><strong>{t(row.functionLabel)}</strong><p>{row.games}{t(row.games > 1 ? " parties" : " partie")} · {t(winrateLabel(row.wr))}{t(" de victoires")}</p></div>
        <div className="trends-role-number"><span>{t("Part d’or")}</span><b>{row.goldShare === null ? "—" : `${Math.round(row.goldShare)}%`}</b></div>
        <div className="trends-role-number"><span>{t("Part de dégâts")}</span><b>{row.damageShare === null ? "—" : `${Math.round(row.damageShare)}%`}</b></div>
        <button type="button" className="trends-text-action" aria-label={t("Voir les sources du rôle {0}", [t(roleLabel(row.role))])} onClick={() => onOpenSources({ title: roleLabel(row.role), subtitle: row.functionLabel, games: row.sourceGames })}><FileText aria-hidden="true" /><span>{t("Sources")}</span></button>
      </article>)}</div>
      {!roles.length && <p className="trends-copy">{t("Les participants ne sont pas encore renseignés sur cette sélection.")}</p>}
      </details>
      </div>
    </details></Surface>

    <Surface className="trends-review-surface"><section aria-labelledby="trend-review-title"><div className="trends-section-heading"><h3 id="trend-review-title">{t("Autres pistes pour le débrief")}</h3></div>
      <div className="trends-review-list">{briefs.filter((brief) => !["Bilan", "Plan de jeu"].includes(brief.label)).map((brief) => <details key={brief.label}><summary><span className="trends-eyebrow">{analysisCopy(brief.label)}</span><strong>{analysisCopy(brief.title)}</strong><span>{brief.sourceGames?.length || 0}{t(" parties")}</span></summary><div className="trends-review-content"><p>{analysisCopy(brief.text, { csComparison: true })}</p>{brief.evidence?.length > 0 && <ul>{[...new Set(brief.evidence)].map((item) => <li key={item}>{analysisCopy(item, { csComparison: true })}</li>)}</ul>}<button type="button" className="trends-text-action" onClick={() => open(brief)}><FileText aria-hidden="true" />{t(" Voir les parties sources")}</button></div></details>)}</div>
      {alerts.length > 0 && <details className="trends-alerts trends-secondary-disclosure"><summary><strong>{t("Autres points de vigilance")}</strong><span>{Math.min(alerts.length, 3)}</span></summary>{alerts.slice(0, 3).map((alert) => <article key={alert.title}><alert.icon aria-hidden="true" /><div><h5>{analysisCopy(alert.title)}</h5><p>{analysisCopy(alert.text)}</p><p>{analysisCopy(alert.action)}</p></div></article>)}</details>}
    </section></Surface>

  </div>;
}
