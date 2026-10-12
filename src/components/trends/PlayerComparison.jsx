import React, { useId, useMemo, useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { buildPlayerComparison } from "../../utils/player-comparison.js";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { SelectInput } from "../ui/Core.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import "./player-comparison.css";

const EMPTY = [];
const METRICS = [
  { id: "vision", label: "Score de vision", unit: "Par partie", digits: 1, description: "Score de vision moyen par partie." },
  { id: "visionPerMin", label: "Vision / min", unit: "Par minute", digits: 2, description: "Score de vision divisé par la durée de chaque partie, puis moyenné." },
  { id: "kills", label: "Kills", unit: "Par partie", digits: 1, description: "Nombre moyen de champions adverses éliminés par partie." },
  { id: "deaths", label: "Morts", unit: "Par partie", digits: 1, description: "Nombre moyen de morts par partie. Une valeur plus basse peut être préférable selon le contexte." },
  { id: "assists", label: "Assists", unit: "Par partie", digits: 1, description: "Nombre moyen d’assistances par partie." },
  { id: "kda", label: "KDA", unit: "Ratio global", digits: 2, description: "Total des kills et assists divisé par le total des morts, avec un minimum de 1 au dénominateur." },
  { id: "kp", label: "Participation aux kills", unit: "% des kills d’équipe", digits: 1, percent: true, description: "Part des kills de l’équipe auxquels le joueur participe, en moyenne par partie." },
  { id: "cs", label: "CS", unit: "Par partie", digits: 1, description: "Nombre moyen de sbires et monstres tués par partie." },
  { id: "csPerMin", label: "CS / min", unit: "Par minute", digits: 2, description: "Sbires et monstres tués divisés par la durée de chaque partie, puis moyennés." },
  { id: "damage", label: "Dégâts aux champions", unit: "Par partie", digits: 0, description: "Dégâts infligés aux champions adverses, en moyenne par partie." },
  { id: "damagePerMin", label: "Dégâts / min", unit: "Par minute", digits: 0, description: "Dégâts aux champions divisés par la durée de chaque partie, puis moyennés." },
  { id: "gold", label: "Or gagné", unit: "Par partie", digits: 0, description: "Or gagné en moyenne par partie." },
  { id: "goldPerMin", label: "Or / min", unit: "Par minute", digits: 0, description: "Or gagné divisé par la durée de chaque partie, puis moyenné." },
];
const QUICK_METRICS = ["vision", "kills", "csPerMin", "damagePerMin", "kp"];
const THEMES = [
  { id: "all", label: "Tous les thèmes", metrics: METRICS.map((metric) => metric.id) },
  { id: "vision", label: "Vision", metrics: ["vision", "visionPerMin"] },
  { id: "combat", label: "Combat", metrics: ["kills", "deaths", "assists", "kda", "kp", "damage", "damagePerMin"] },
  { id: "farm", label: "Farm (CS)", metrics: ["cs", "csPerMin"] },
  { id: "economy", label: "Économie", metrics: ["gold", "goldPerMin"] },
];

function metricValue(metric, value, locale) {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale, {
    style: metric.percent ? "percent" : "decimal",
    minimumFractionDigits: metric.digits,
    maximumFractionDigits: metric.digits,
  }).format(metric.percent ? value / 100 : value);
}

export function PlayerComparison({ matches = EMPTY, players = EMPTY, categories = EMPTY, category = "", onCategoryChange }) {
  useLanguage();
  const locale = getLocale();
  const id = useId();
  const [metricId, setMetricId] = useState("vision");
  const [themeId, setThemeId] = useState("all");
  const [order, setOrder] = useState("roster");
  const model = useMemo(() => buildPlayerComparison(matches, players), [matches, players]);
  const theme = THEMES.find((item) => item.id === themeId) || THEMES[0];
  const visibleMetrics = METRICS.filter((item) => theme.metrics.includes(item.id));
  const shortcuts = themeId === "all" ? QUICK_METRICS : theme.metrics;
  const metric = METRICS.find((item) => item.id === metricId) || METRICS[0];
  const changeTheme = (nextId) => {
    const nextTheme = THEMES.find((item) => item.id === nextId);
    if (!nextTheme) return;
    setThemeId(nextId);
    if (!nextTheme.metrics.includes(metricId)) setMetricId(nextTheme.metrics[0]);
  };
  const rows = useMemo(() => {
    if (order === "roster") return model.players;
    return [...model.players].sort((a, b) => {
      const av = a.metrics[metric.id].value;
      const bv = b.metrics[metric.id].value;
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      return order === "ascending" ? av - bv : bv - av;
    });
  }, [model, metric.id, order]);
  const measured = rows.filter((row) => row.metrics[metric.id].value != null);
  const max = measured.reduce((value, row) => Math.max(value, row.metrics[metric.id].value), 0);
  // All players share a zero-based scale, including an all-zero selection.
  const ceiling = metric.percent ? 100 : max > 0 ? max : 1;
  const format = (value) => metricValue(metric, value, locale);
  const playerName = (row) => row.name || t("Joueur sans pseudo {0}", [model.players.indexOf(row) + 1]);
  const coverage = (count, games) => t(games === 1 ? "{0} / {1} partie mesurée" : "{0} / {1} parties mesurées", [count, games]);

  return <section className="player-comparison" aria-labelledby={`${id}-title`}>
    <header className="player-comparison-heading">
      <div>
        <h3 id={`${id}-title`}><BarChart3 aria-hidden="true" />{t("Comparer les joueurs")}</h3>
        <p>{t("Vision, combat et farm : les contributions de chacun sur la sélection actuelle.")}</p>
      </div>
      <span className="player-comparison-sample">{t(model.players.length === 1 ? "{0} joueur" : "{0} joueurs", [model.players.length])} · {t(model.games === 1 ? "{0} partie sélectionnée" : "{0} parties sélectionnées", [model.games])}</span>
    </header>

    {(onCategoryChange || model.players.length > 0) && <div className="player-comparison-controls">
        {onCategoryChange && <SelectInput label="Catégorie" value={category} onChange={onCategoryChange} aria-describedby={`${id}-category-help`}>
          <option value="">{t("Toutes les parties")}</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectInput>}
        {model.players.length > 0 && <>
        <SelectInput label="Thème des statistiques" value={theme.id} onChange={changeTheme}>
          {THEMES.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
        </SelectInput>
        <SelectInput label="Statistique" value={metric.id} onChange={setMetricId}>
          {visibleMetrics.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
        </SelectInput>
        <SelectInput label="Ordre des joueurs" value={order} onChange={setOrder}>
          <option value="roster">{t("Par rôle")}</option>
          <option value="descending">{t("Valeur décroissante")}</option>
          <option value="ascending">{t("Valeur croissante")}</option>
        </SelectInput>
        </>}
      </div>}
      {onCategoryChange && <p id={`${id}-category-help`} className="player-comparison-filter-help">{t("La catégorie et la période d’analyse s’appliquent au comparatif et aux objectifs ci-dessous.")}</p>}
    {!model.players.length ? <p className="player-comparison-empty">{t("Les joueurs apparaîtront ici lorsque les participants des parties seront identifiés.")}</p> : <>
      <div className="player-comparison-shortcuts" role="group" aria-label={t(themeId === "all" ? "Statistiques principales" : "Statistiques du thème")}>
        {shortcuts.map((key) => <button key={key} type="button" aria-pressed={metric.id === key} aria-controls={`${id}-chart`} onClick={() => setMetricId(key)}>{t(METRICS.find((item) => item.id === key).label)}</button>)}
      </div>

      <figure id={`${id}-chart`} className="player-comparison-chart" aria-labelledby={`${id}-metric`} aria-describedby={`${id}-description`}>
        <figcaption className="player-comparison-caption">
          <h4 id={`${id}-metric`}>{t(metric.label)}<span>{t(metric.unit)}</span></h4>
          <p>{t("Échelle de 0 à {0}", [format(ceiling)])}</p>
        </figcaption>
        <p id={`${id}-description`} className="player-comparison-description">{t(metric.description)}</p>
        {!measured.length && <p className="player-comparison-empty" role="status">{t("Aucune donnée disponible pour cette statistique dans la sélection.")}</p>}
        <ul className="player-comparison-bars" aria-label={t("Valeurs par joueur")}>
          {rows.map((row) => {
            const measurement = row.metrics[metric.id];
            const width = measurement.value == null ? 0 : Math.min(100, measurement.value / ceiling * 100);
            return <li key={row.id} className="player-comparison-row" data-role={row.role}>
              <div className="player-comparison-identity">
                <span aria-hidden="true"><RoleIcon role={row.role} className="player-comparison-role-icon" lightweight /></span>
                <div><strong>{playerName(row)}</strong><span>{t(roleLabel(row.role))}</span></div>
              </div>
              <div className="player-comparison-track" aria-hidden="true">
                <svg viewBox="0 0 100 12" preserveAspectRatio="none" focusable="false"><rect width={width} height="12" rx="0.5" /></svg>
              </div>
              <div className="player-comparison-value">
                <strong>{format(measurement.value)}</strong>
                <span>{coverage(measurement.count, row.games)}</span>
              </div>
            </li>;
          })}
        </ul>
      </figure>
      <p className="player-comparison-note">{t("Les rôles ont des contributions différentes. Compare les chiffres avec leur contexte ; ils ne constituent pas un classement de performance.")}</p>

      <details className="player-comparison-details">
        <summary>{t(themeId === "all" ? "Voir toutes les statistiques" : "Voir les statistiques de ce thème")}<ChevronDown aria-hidden="true" /></summary>
        <p>{t("Chaque cellule indique la valeur et le nombre de parties mesurées. Une donnée absente reste « — ».")}</p>
        <div className="player-comparison-table-scroll nxt5-responsive-scroll" role="region" tabIndex={0} aria-label={t("Tableau comparatif des joueurs")}>
          <table>
            <caption className="sr-only">{t("Statistiques des joueurs sur la sélection actuelle")}</caption>
            <thead><tr><th scope="col">{t("Joueur")}</th><th scope="col">{t("Parties")}</th>{visibleMetrics.map((item) => <th scope="col" key={item.id} data-selected={item.id === metric.id}>{t(item.label)}<span>{t(item.unit)}</span></th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <th scope="row"><strong>{playerName(row)}</strong><span>{t(roleLabel(row.role))}</span></th>
              <td>{row.games}</td>
              {visibleMetrics.map((item) => <td key={item.id} data-selected={item.id === metric.id}><strong>{metricValue(item, row.metrics[item.id].value, locale)}</strong><span>{coverage(row.metrics[item.id].count, row.games)}</span></td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <p>{t("CS : sbires et monstres tués. Les mesures par minute utilisent une durée connue ou un ratio enregistré. KDA : ratio global sur les parties complètes en kills, morts et assists.")}</p>
      </details>
    </>}
  </section>;
}
