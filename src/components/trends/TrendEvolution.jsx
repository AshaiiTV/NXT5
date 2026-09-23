import React, { useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { buildTrendSeries, TREND_SERIES_METRICS } from "../../utils/trends.js";
import { matchDisplayName } from "../../utils/matches.js";
import { cx } from "../../app/helpers.js";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import "./trend-evolution.css";

const number = (value) => Number.isFinite(value) ? value.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—";
const date = (point, year = false) => point.timestamp === null ? "Date inconnue" : new Date(point.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const valueLabel = (point, metric) => point.value === null ? "Donnée indisponible" : `${metric.signed && point.value > 0 ? "+" : ""}${number(point.value)} ${metric.unit}`;
const resultLabel = (point) => point.result === 100 ? "Victoire" : point.result === 0 ? "Défaite" : "Résultat inconnu";
const pageSize = 10;

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

function SeriesChart({ series, selectedKey, onSelect }) {
  const { metric, dated, segments, availableCount } = series;
  if (!dated.length || !availableCount) return <div className="trend-series-empty">
    <h4>{!dated.length ? "Aucune game datée à tracer" : "Aucune valeur disponible pour cette mesure"}</h4>
    <p>{!dated.length ? "Les games sans date restent accessibles dans le sélecteur et le relevé ci-dessous." : "Choisis une autre mesure ou ouvre les games pour consulter leurs données."}</p>
  </div>;
  const maximum = Math.max(...dated.map(({ value }) => value === null ? 0 : Math.abs(value)), metric.signed ? 1 : 4);
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const bound = Math.ceil(maximum / magnitude) * magnitude;
  const lower = metric.signed ? -bound : 0;
  const y = (value) => 18 + (bound - value) / (bound - lower) * 196;
  const x = (index) => dated.length === 1 ? 500 : index / (dated.length - 1) * 1000;
  const indices = new Map(dated.map((point, index) => [point.key, index]));
  const ticks = Array.from({ length: 5 }, (_, index) => bound - index * (bound - lower) / 4);
  const dateIndices = [...new Set([0, Math.floor((dated.length - 1) / 2), dated.length - 1])];
  const selectedIndex = dated.findIndex(({ key }) => key === selectedKey);
  const axisNumber = (value) => `${metric.signed && value > 0 ? "+" : ""}${Math.abs(value) >= 1000 ? `${number(value / 1000)} k` : number(value)}`;
  return <figure className="trend-series-figure">
    <div className="trend-series-plot-heading"><span>{metric.unit}</span><span>{availableCount} valeur{availableCount > 1 ? "s" : ""} sur {dated.length} game{dated.length > 1 ? "s" : ""} datée{dated.length > 1 ? "s" : ""}</span></div>
    <div className="trend-series-chart">
      <div className="trend-series-y-axis" aria-hidden="true">{ticks.map((tick, index) => <span key={index} style={{ top: `${y(tick)}px` }}>{axisNumber(tick)}</span>)}</div>
      <div className="trend-series-plot">
        <svg viewBox="0 0 1000 232" preserveAspectRatio="none" role="img" aria-label={`${metric.label} par game, dans l’ordre chronologique. ${availableCount} valeurs disponibles sur ${dated.length} games datées. Choisis une game ci-dessous pour sa valeur exacte.`} onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const index = Math.max(0, Math.min(dated.length - 1, Math.round((event.clientX - rect.left) / rect.width * (dated.length - 1))));
          onSelect(dated[index].key);
        }}>
          {ticks.map((tick, index) => <line key={index} x1="0" x2="1000" y1={y(tick)} y2={y(tick)} className={tick === 0 ? "trend-series-zero" : "trend-series-gridline"} vectorEffect="non-scaling-stroke" />)}
          {segments.filter((segment) => segment.length > 1).map((segment) => <polyline key={segment[0].key} points={segment.map((point) => `${x(indices.get(point.key))},${y(point.value)}`).join(" ")} className="trend-series-line" vectorEffect="non-scaling-stroke" />)}
          {selectedIndex >= 0 && <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="4" y2="226" className="trend-series-selection-line" vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="trend-series-dots" aria-hidden="true">{dated.map((point, index) => <span key={point.key} title={`Game ${index + 1} · ${date(point, true)} · ${valueLabel(point, metric)}`} className={cx("trend-series-dot", point.value === null && "is-missing", selectedKey === point.key && "is-selected")} style={{ left: `${x(index) / 10}%`, top: `${point.value === null ? 224 : y(point.value)}px` }} />)}</div>
        <div className="trend-series-x-axis" aria-hidden="true">{dateIndices.map((index) => <span key={index} style={{ left: `${x(index) / 10}%` }}><strong>Game {index + 1}</strong>{date(dated[index], true)}</span>)}</div>
      </div>
    </div>
    <figcaption>{availableCount === 1 ? "Un seul point disponible : il ne suffit pas à dessiner une évolution. " : ""}Une position par game, de la plus ancienne à la plus récente. Clique sur la courbe ou utilise le sélecteur ci-dessous.{availableCount < dated.length && <span className="trend-series-missing-note"> × Donnée absente : la courbe s’interrompt.</span>}</figcaption>
  </figure>;
}

export function TrendEvolution({ matches = [], onOpenMatch }) {
  const [metricKey, setMetricKey] = useState("gold");
  const [selectedKey, setSelectedKey] = useState(null);
  const [page, setPage] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const headingId = useId();
  const series = useMemo(() => buildTrendSeries(matches, metricKey), [matches, metricKey]);
  const { metric, points, dated, undated } = series;
  const selectedIndex = Math.max(0, points.findIndex(({ key }) => key === selectedKey) >= 0 ? points.findIndex(({ key }) => key === selectedKey) : dated.length - 1);
  const selected = points[selectedIndex];
  const pageCount = Math.ceil(points.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const currentRows = points.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectPoint = (key) => setSelectedKey(key);

  return <Surface className="trend-evolution-surface">
    <section aria-labelledby={headingId} className="trend-evolution">
      <div className="trend-evolution-heading">
        <div>
          <p className="trend-evolution-eyebrow">Trajectoire de l’équipe</p>
          <h3 id={headingId}>Une mesure, game après game</h3>
          <p className="trend-evolution-description">Repère les pics, les creux et les ruptures dans toute la sélection, puis ouvre la game concernée.</p>
        </div>
        <div className="trend-series-metric-control"><SelectInput label="Mesure à suivre" value={metricKey} onChange={setMetricKey} aria-label="Mesure à suivre">{TREND_SERIES_METRICS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</SelectInput></div>
      </div>
      <p className="trend-series-definition">{metric.description}</p>
      {points.length ? <>
        <SeriesChart series={series} selectedKey={selected?.key} onSelect={selectPoint} />
        {undated.length > 0 && <p className="trend-series-date-note">{undated.length} game{undated.length > 1 ? "s" : ""} sans date : consultable{undated.length > 1 ? "s" : ""} ci-dessous, hors de la courbe.</p>}
        <div className="trend-series-inspector"><div className="trend-series-navigation">
          <SelectInput label="Game à examiner" value={selected.key} onChange={selectPoint} aria-label="Game à examiner">
            {dated.length > 0 && <optgroup label="Games dans l’ordre chronologique">{dated.map((point, index) => <option key={point.key} value={point.key}>{index + 1}. {date(point, true)} · {matchDisplayName(point.match)}</option>)}</optgroup>}
            {undated.length > 0 && <optgroup label="Date inconnue · hors courbe">{undated.map((point) => <option key={point.key} value={point.key}>{matchDisplayName(point.match)} · Date inconnue</option>)}</optgroup>}
          </SelectInput>
          <div className="trend-series-step-controls">
            <Button variant="ghost" type="button" icon={ArrowLeft} onClick={() => selectPoint(points[selectedIndex - 1].key)} disabled={selectedIndex === 0} aria-label="Game précédente">Précédente</Button>
            <Button variant="ghost" type="button" onClick={() => selectPoint(points[selectedIndex + 1].key)} disabled={selectedIndex === points.length - 1} aria-label="Game suivante">Suivante <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Button>
          </div>
        </div>
        <div className="trend-series-selected">
          <div className="trend-series-selected-content" aria-live="polite" aria-atomic="true">
            <div className="trend-series-selected-context"><span>{selected.timestamp === null ? "Hors courbe" : `Game ${selectedIndex + 1} sur ${dated.length}`}</span><Badge tone={selected.result === 100 ? "green" : selected.result === 0 ? "red" : "slate"}>{resultLabel(selected)}</Badge></div>
            <h4>{matchDisplayName(selected.match)}</h4>
            <p>{date(selected, true)}</p>
            <dl><dt>{metric.label}</dt><dd>{valueLabel(selected, metric)}</dd></dl>
          </div>
          <Button variant="ghost" type="button" onClick={() => onOpenMatch?.(selected.match)}>Ouvrir cette game <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Button>
        </div>
        </div>
        <details className="trend-series-details" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
          <summary>Relevé des {points.length} game{points.length > 1 ? "s" : ""}</summary>
          {detailsOpen && <div className="trend-series-records">
            <p>Valeurs exactes de « {metric.label} ». Les games sans date figurent à la fin.</p>
            <ol start={currentPage * pageSize + 1}>{currentRows.map((point, rowIndex) => <li key={point.key}>
              <div className="trend-series-record-identity"><strong>{currentPage * pageSize + rowIndex + 1}. {matchDisplayName(point.match)}</strong><span>{date(point, true)} · {resultLabel(point)}</span></div>
              <span className="trend-series-record-value">{valueLabel(point, metric)}</span>
              <Button variant="ghost" type="button" aria-label={`Ouvrir ${matchDisplayName(point.match)}`} onClick={() => onOpenMatch?.(point.match)}>Ouvrir</Button>
            </li>)}</ol>
            {pageCount > 1 && <div className="trend-series-pagination"><p aria-live="polite">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, points.length)} sur {points.length}</p><div><Button type="button" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Page précédente du relevé">Précédente</Button><Button type="button" variant="ghost" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label="Page suivante du relevé">Suivante</Button></div></div>}
          </div>}
        </details>
        <p className="trend-evolution-note">Les dates de partie sont utilisées en priorité, puis la date d’import si nécessaire. Chaque mesure exige les données des cinq joueurs concernés ; une absence de données ne vaut jamais zéro.</p>
      </> : <div className="trend-series-empty"><h4>Aucune game dans cette sélection</h4><p>Élargis les filtres ou importe des games pour suivre leur évolution.</p></div>}
    </section>
  </Surface>;
}
