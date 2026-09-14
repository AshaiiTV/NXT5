import React, { useMemo } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, Minus } from "lucide-react";
import { buildTrendEvolution, sortTrendMatches, trendMatchTimestamp } from "../../utils/trends.js";
import { matchDisplayName } from "../../utils/matches.js";
import { cx } from "../../app/helpers.js";
import { Button, Surface } from "../ui/Core.jsx";
import "./trend-evolution.css";

const number = (value) => Number.isFinite(value) ? value.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—";
const date = (match, year = false) => {
  const timestamp = trendMatchTimestamp(match);
  return timestamp === null ? "Date inconnue" : new Date(timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
};
const dateRange = (games) => `${date(games.at(-1), true)} – ${date(games[0], true)}`;
const metricLabels = { wr: "Taux de victoire", gold: "Écart d’or", deaths: "Morts de l’équipe", vision: "Écart de vision" };
const metricUnits = { wr: "%", gold: "or / game", deaths: "morts / game", vision: "pts / game" };

export function TrendPeriodFilter({ value, onChange }) {
  return <div className="trend-period" role="group" aria-label="Période d’analyse">
    <span className="trend-period-label">Période d’analyse</span>
    <div className="trend-period-options">
      {[["all", "Toutes les games"], ["5", "5 dernières games"], ["10", "10 dernières games"], ["20", "20 dernières games"]].map(([id, label]) =>
        <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)} className="trend-period-option">{label}</button>
      )}
    </div>
  </div>;
}

export function TrendEvolution({ matches, onOpenMatch, onOpenSources }) {
  const evolution = useMemo(() => buildTrendEvolution(matches), [matches]);
  const recentForm = useMemo(() => sortTrendMatches(matches).slice(0, 10).reverse(), [matches]);
  const { recent, previous, size, metrics } = evolution;

  return <Surface className="trend-evolution-surface">
    <section aria-labelledby="trend-evolution-title" className="trend-evolution">
      <div className="trend-evolution-heading">
        <div>
          <p className="trend-evolution-eyebrow">Dynamique récente</p>
          <h3 id="trend-evolution-title">Ce qui évolue dans ton jeu</h3>
          <p className="trend-evolution-description">{size ? `Les ${size} dernières games comparées aux ${size} précédentes, dans la sélection active.` : "Il faut au moins 4 games datées dans la sélection pour comparer deux blocs."}</p>
        </div>
        {size > 0 && <Button variant="ghost" type="button" onClick={() => onOpenSources([...recent, ...previous])} className="trend-evolution-sources">Voir les {size * 2} games sources <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Button>}
      </div>

      {size > 0 && <>
        <dl className="trend-evolution-periods" aria-label="Blocs comparés">
          <div className="trend-evolution-recent-period">
            <dt>Bloc récent <span>{size} games</span></dt>
            <dd>{dateRange(recent)}</dd>
          </div>
          <div>
            <dt>Bloc précédent <span>{size} games</span></dt>
            <dd>{dateRange(previous)}</dd>
          </div>
        </dl>
        <div className="trend-evolution-metrics">
          {metrics.map((metric) => {
            const roundedDelta = Number.isFinite(metric.delta) ? Math.round(metric.delta * 10) / 10 : null;
            const positive = roundedDelta !== null && (metric.inverse ? roundedDelta < 0 : roundedDelta > 0);
            const neutral = roundedDelta === null || roundedDelta === 0;
            const Icon = roundedDelta > 0 ? ArrowUpRight : roundedDelta < 0 ? ArrowDownRight : Minus;
            const deltaUnit = Math.abs(roundedDelta) === 1 && metric.unit === "morts" ? "mort" : metric.unit;
            const status = roundedDelta === null ? "Comparaison indisponible" : roundedDelta === 0 ? "Stable" : positive ? "Évolution favorable" : "Évolution défavorable";
            return <article key={metric.key} className="trend-evolution-metric">
              <h4>{metricLabels[metric.key] || metric.label}</h4>
              <dl className="trend-evolution-values">
                <div className="trend-evolution-current">
                  <dt>Bloc récent</dt>
                  <dd>{number(metric.current)}{Number.isFinite(metric.current) && <span>{metricUnits[metric.key]}</span>}</dd>
                </div>
                <div className="trend-evolution-previous">
                  <dt>Bloc précédent</dt>
                  <dd>{number(metric.previous)}{Number.isFinite(metric.previous) && <span>{metricUnits[metric.key]}</span>}</dd>
                </div>
              </dl>
              <p className={cx("trend-evolution-delta", neutral ? "is-neutral" : positive ? "is-favorable" : "is-unfavorable")}>
                <Icon aria-hidden="true" />
                <span>{roundedDelta !== null && roundedDelta !== 0 && <strong>{roundedDelta > 0 ? "+" : ""}{number(roundedDelta)} {deltaUnit} · </strong>}{status}</span>
              </p>
              {(metric.count < size || metric.previousCount < size) && <p className="trend-evolution-coverage">Données disponibles : {metric.count}/{size} games récentes et {metric.previousCount}/{size} précédentes.</p>}
            </article>;
          })}
        </div>
        <p className="trend-evolution-note">Moyennes en fin de game. Les écarts d’or et de vision comparent ton équipe à l’adversaire. Moins de morts est favorable ; ces évolutions restent descriptives.</p>
      </>}

      <div className="trend-evolution-form">
        <div className="trend-evolution-form-heading">
          <h4><Clock3 aria-hidden="true" />{recentForm.length ? `${recentForm.length} dernier${recentForm.length > 1 ? "s" : ""} résultat${recentForm.length > 1 ? "s" : ""}` : "Derniers résultats"}</h4>
          <p>Plus ancien → plus récent · ouvre une game pour la revoir.</p>
        </div>
        {recentForm.length ? <ol className="trend-evolution-results">
          {recentForm.map((match, index) => {
            const win = match.result === "Victoire";
            const loss = match.result === "Défaite";
            const name = matchDisplayName(match);
            const result = match.result || "Résultat inconnu";
            return <li key={match.id || match.game_id || index}>
              <button type="button" onClick={() => onOpenMatch(match)} title={`${name} · ${date(match, true)} · ${result}`} aria-label={`Ouvrir ${name}, ${date(match, true)}, ${result}`} className={cx("trend-evolution-result", win ? "is-win" : loss ? "is-loss" : "is-unknown")}>
                <span className="trend-evolution-result-label">{result}</span>
                <span className="trend-evolution-result-date">{date(match, true)}</span>
                <span className="trend-evolution-result-name">{name}</span>
              </button>
            </li>;
          })}
        </ol> : <p className="trend-evolution-description">Aucun résultat dans cette sélection.</p>}
      </div>
    </section>
  </Surface>;
}
