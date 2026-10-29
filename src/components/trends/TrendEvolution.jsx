import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { buildTrendSeries, TREND_SERIES_METRICS } from "../../utils/trends.js";
import { matchDisplayName } from "../../utils/matches.js";
import { cx } from "../../app/helpers.js";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import { analysisCopy } from "./analysis-copy.js";
import "./trend-evolution.css";

const number = (value) => Number.isFinite(value) ? value.toLocaleString(getLocale(), { maximumFractionDigits: 1 }) : "—";
const date = (point, year = false) => point.timestamp === null ? t("Date inconnue") : new Date(point.timestamp).toLocaleDateString(getLocale(), { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const valueLabel = (point, metric) => point.value === null ? t("Donnée indisponible") : `${metric.signed && point.value > 0 ? "+" : ""}${number(point.value)} ${t(metric.unit)}`;
const resultLabel = (point) => point.result === 100 ? "Victoire" : point.result === 0 ? "Défaite" : "Résultat inconnu";
const pageSize = 10;

export function TrendPeriodFilter({ value, onChange }) {
  useLanguage();
  return <div className="trend-period" role="group" aria-label={t("Période d’analyse")}>
    <span className="trend-period-label">{t("Période d’analyse")}</span>
    <div className="trend-period-options">
      {[["all", "Toutes les parties"], ["5", "5 dernières parties"], ["10", "10 dernières parties"], ["20", "20 dernières parties"]].map(([id, label]) =>
        <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)} className="trend-period-option">{t(label)}</button>
      )}
    </div>
  </div>;
}

function SeriesChart({ series, selectedKey, onSelect }) {
  useLanguage();
  const { metric, dated, segments, availableCount } = series;
  if (!dated.length || !availableCount) return <div className="trend-series-empty">
    <h4>{!dated.length ? t("Aucune partie datée à tracer") : t("Aucune valeur disponible pour cette mesure")}</h4>
    <p>{!dated.length ? t("Les parties sans date restent accessibles dans le sélecteur et le relevé ci-dessous.") : t("Choisis une autre mesure ou ouvre les parties pour consulter leurs données.")}</p>
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
    <div className="trend-series-plot-heading"><span>{t(metric.unit)}</span><span>{availableCount}{t(availableCount > 1 ? " valeurs" : " valeur")}{t(" sur ")}{dated.length}{t(dated.length > 1 ? " parties" : " partie")}{t(dated.length > 1 ? " datées" : " datée")}</span></div>
    <div className="trend-series-chart">
      <div className="trend-series-y-axis" aria-hidden="true">{ticks.map((tick, index) => <span key={index} style={{ top: `${y(tick)}px` }}>{axisNumber(tick)}</span>)}</div>
      <div className="trend-series-plot">
        <svg viewBox="0 0 1000 232" preserveAspectRatio="none" role="img" aria-label={t("{0} par partie, dans l’ordre chronologique. {1} valeurs disponibles sur {2} parties datées. Choisis une partie ci-dessous pour sa valeur exacte.", [t(metric.label), availableCount, dated.length])} onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const index = Math.max(0, Math.min(dated.length - 1, Math.round((event.clientX - rect.left) / rect.width * (dated.length - 1))));
          onSelect(dated[index].key);
        }}>
          {ticks.map((tick, index) => <line key={index} x1="0" x2="1000" y1={y(tick)} y2={y(tick)} className={tick === 0 ? "trend-series-zero" : "trend-series-gridline"} vectorEffect="non-scaling-stroke" />)}
          {segments.filter((segment) => segment.length > 1).map((segment) => <polyline key={segment[0].key} points={segment.map((point) => `${x(indices.get(point.key))},${y(point.value)}`).join(" ")} className="trend-series-line" vectorEffect="non-scaling-stroke" />)}
          {selectedIndex >= 0 && <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="4" y2="226" className="trend-series-selection-line" vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="trend-series-dots" aria-hidden="true">{dated.map((point, index) => <span key={point.key} title={t("Partie {0} · {1} · {2}", [index + 1, date(point, true), t(valueLabel(point, metric))])} className={cx("trend-series-dot", point.value === null && "is-missing", selectedKey === point.key && "is-selected")} style={{ left: `${x(index) / 10}%`, top: `${point.value === null ? 224 : y(point.value)}px` }} />)}</div>
        <div className="trend-series-x-axis" aria-hidden="true">{dateIndices.map((index) => <span key={index} style={{ left: `${x(index) / 10}%` }}><strong>{t("Partie ")}{index + 1}</strong>{date(dated[index], true)}</span>)}</div>
      </div>
    </div>
    <figcaption>{availableCount === 1 ? t("Un seul point disponible : il ne suffit pas à dessiner une évolution. ") : ""}{t("Une position par partie, de la plus ancienne à la plus récente. Clique sur la courbe ou utilise le sélecteur ci-dessous.")}{availableCount < dated.length && <span className="trend-series-missing-note">{t(" × Donnée absente : la courbe s’interrompt.")}</span>}</figcaption>
  </figure>;
}

export function TrendEvolution({ matches = [], onOpenMatch }) {
  useLanguage();
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
          <p className="trend-evolution-eyebrow">{t("Trajectoire de l’équipe")}</p>
          <h3 id={headingId}>{t("Une mesure, partie après partie")}</h3>
          <p className="trend-evolution-description">{t("Repère les pics, les creux et les ruptures dans toute la sélection, puis ouvre la partie concernée.")}</p>
        </div>
        <div className="trend-series-metric-control"><SelectInput label={t("Mesure à suivre")} value={metricKey} onChange={setMetricKey} aria-label={t("Mesure à suivre")}>{TREND_SERIES_METRICS.map(({ key, label }) => <option key={key} value={key}>{t(label)}</option>)}</SelectInput></div>
      </div>
      <p className="trend-series-definition">{t(analysisCopy(metric.description))}</p>
      {points.length ? <>
        <SeriesChart series={series} selectedKey={selected?.key} onSelect={selectPoint} />
        {undated.length > 0 && <p className="trend-series-date-note">{undated.length}{t(undated.length > 1 ? " parties" : " partie")}{t(undated.length > 1 ? " sans date : consultables" : " sans date : consultable")}{t(" ci-dessous, hors de la courbe.")}</p>}
        <div className="trend-series-inspector"><div className="trend-series-navigation">
          <SelectInput label={t("Partie à examiner")} value={selected.key} onChange={selectPoint} aria-label={t("Partie à examiner")}>
            {dated.length > 0 && <optgroup label={t("Parties dans l’ordre chronologique")}>{dated.map((point, index) => <option key={point.key} value={point.key}>{index + 1}. {date(point, true)} · {matchDisplayName(point.match)}</option>)}</optgroup>}
            {undated.length > 0 && <optgroup label={t("Date inconnue · hors courbe")}>{undated.map((point) => <option key={point.key} value={point.key}>{matchDisplayName(point.match)}{t(" · Date inconnue")}</option>)}</optgroup>}
          </SelectInput>
          <div className="trend-series-step-controls">
            <Button variant="ghost" type="button" icon={ArrowLeft} onClick={() => selectPoint(points[selectedIndex - 1].key)} disabled={selectedIndex === 0} aria-label={t("Partie précédente")}>{t("Précédente")}</Button>
            <Button variant="ghost" type="button" onClick={() => selectPoint(points[selectedIndex + 1].key)} disabled={selectedIndex === points.length - 1} aria-label={t("Partie suivante")}>{t("Suivante ")}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Button>
          </div>
        </div>
        <div className="trend-series-selected">
          <div className="trend-series-selected-content" aria-live="polite" aria-atomic="true">
            <div className="trend-series-selected-context"><span>{selected.timestamp === null ? t("Hors courbe") : t("Partie {0} sur {1}", [selectedIndex + 1, dated.length])}</span><Badge tone={selected.result === 100 ? "green" : selected.result === 0 ? "red" : "slate"}>{t(resultLabel(selected))}</Badge></div>
            <h4>{matchDisplayName(selected.match)}</h4>
            <p>{date(selected, true)}</p>
            <dl><dt>{t(metric.label)}</dt><dd>{t(valueLabel(selected, metric))}</dd></dl>
          </div>
          <Button variant="ghost" type="button" onClick={() => onOpenMatch?.(selected.match)}>{t("Ouvrir cette partie ")}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Button>
        </div>
        </div>
        <details className="trend-series-details" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
          <summary>{t("Relevé des ")}{points.length}{t(points.length > 1 ? " parties" : " partie")}</summary>
          {detailsOpen && <div className="trend-series-records">
            <p>{t("Valeurs exactes de « ")}{t(metric.label)}{t(" ». Les parties sans date figurent à la fin.")}</p>
            <ol start={currentPage * pageSize + 1}>{currentRows.map((point, rowIndex) => <li key={point.key}>
              <div className="trend-series-record-identity"><strong>{currentPage * pageSize + rowIndex + 1}. {matchDisplayName(point.match)}</strong><span>{date(point, true)} · {t(resultLabel(point))}</span></div>
              <span className="trend-series-record-value">{t(valueLabel(point, metric))}</span>
              <Button variant="ghost" type="button" aria-label={t("Ouvrir {0}", [matchDisplayName(point.match)])} onClick={() => onOpenMatch?.(point.match)}>{t("Ouvrir")}</Button>
            </li>)}</ol>
            {pageCount > 1 && <div className="trend-series-pagination"><p aria-live="polite">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, points.length)}{t(" sur ")}{points.length}</p><div><Button type="button" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label={t("Page précédente du relevé")}>{t("Précédente")}</Button><Button type="button" variant="ghost" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label={t("Page suivante du relevé")}>{t("Suivante")}</Button></div></div>}
          </div>}
        </details>
        <p className="trend-evolution-note">{t("Les dates de partie sont utilisées en priorité, puis la date d’import si nécessaire. Chaque mesure exige les données des cinq joueurs concernés ; une absence de données ne vaut jamais zéro.")}</p>
      </> : <div className="trend-series-empty"><h4>{t("Aucune partie dans cette sélection")}</h4><p>{t("Élargis les filtres ou importe des parties pour suivre leur évolution.")}</p></div>}
    </section>
  </Surface>;
}
