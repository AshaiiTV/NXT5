import React, { useId, useMemo, useRef, useState } from "react";
import { ChartNoAxesCombined, ChevronDown } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { buildMatchGoldSeries } from "../../utils/match-gold-series.js";
import "./match-gold-chart.css";

const clock = (timestamp) => `${Math.floor(timestamp / 60000)}:${String(Math.floor(timestamp / 1000) % 60).padStart(2, "0")}`;
const signed = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString(getLocale(), { maximumFractionDigits: 0 })}`;
const compact = (value) => new Intl.NumberFormat(getLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value);
const displayName = (value, fallback) => !value || value === fallback ? t(fallback) : value;
const W = 560;
const H = 180;
const INSET = 8;

export default function MatchGoldChart({ match, publication, teamName }) {
  useLanguage();
  const id = useId();
  const series = useMemo(() => buildMatchGoldSeries(match, publication), [match, publication]);
  const svgRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const allyName = displayName(teamName || publication?.context?.teamName, "Notre équipe");
  const enemyName = displayName(publication?.context?.opponentName, "Adversaires");

  if (!series.points.length) return <div className="match-gold-chart-empty">
    <ChartNoAxesCombined aria-hidden="true" />
    <div><p>{t("Courbe d’or indisponible")}</p><span>{t(series.status === "participants" ? "Participants incomplets ou non identifiables" : series.status === "incomplete" ? "Relevés d’or incomplets" : "Aucun relevé d’or enregistré")}</span></div>
  </div>;

  const maximum = Math.max(1000, ...series.points.map((point) => Math.abs(point.diff)));
  const limit = Math.ceil(maximum / 1000) * 1000;
  const x = (timestamp) => INSET + timestamp / Math.max(series.domainEndMs, 1) * (W - INSET * 2);
  const y = (value) => H / 2 - value / limit * (H / 2 - INSET);
  const coords = (point) => `${x(point.timestamp).toFixed(1)},${y(point.diff).toFixed(1)}`;
  const last = series.points.at(-1);
  const summary = t("{0} relevés · dernier à {1}", [series.points.length, clock(last.timestamp)]);
  const middle = series.domainEndMs / 2;
  const selectedIndex = selection?.series === series ? selection.index : series.points.length - 1;
  const selected = series.points[selectedIndex];
  const inspecting = hovered || focused;
  const selectPoint = (index) => setSelection((current) => current?.series === series && current.index === index ? current : { series, index });
  const inspectPointer = (event) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds?.width || !Number.isFinite(event.clientX)) return;
    // Use the SVG's live width, not the event target: axes and points also bubble here.
    const ratio = Math.max(0, Math.min(1, ((event.clientX - bounds.left) / bounds.width * W - INSET) / (W - INSET * 2)));
    const timestamp = ratio * series.domainEndMs;
    const index = series.points.reduce((nearest, point, candidate) => Math.abs(point.timestamp - timestamp) < Math.abs(series.points[nearest].timestamp - timestamp) ? candidate : nearest, 0);
    selectPoint(index);
    setHovered(true);
  };
  const inspectKey = (event) => {
    const next = { ArrowLeft: selectedIndex - 1, ArrowDown: selectedIndex - 1, ArrowRight: selectedIndex + 1, ArrowUp: selectedIndex + 1, Home: 0, End: series.points.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectPoint(Math.max(0, Math.min(series.points.length - 1, next)));
  };
  const gold = (value) => t("{0} or", [value.toLocaleString(getLocale())]);
  const valueText = `${t("Relevé à {0}", [clock(selected.timestamp)])}. ${t("Écart d’or")} : ${gold(signed(selected.diff))}. ${allyName} : ${gold(selected.ally)}. ${enemyName} : ${gold(selected.enemy)}.`;

  return <figure className="match-gold-chart">
    <figcaption>
      <p className="match-gold-chart-title">{t("Évolution de l’écart d’or")}</p>
      <div className="match-gold-chart-legend"><span><i aria-hidden="true">+</i>{allyName}</span>
        <span><i aria-hidden="true">−</i>{enemyName}</span></div>
    </figcaption>
    <p id={`${id}-keys`} className="sr-only">{t("Utilisez les flèches pour parcourir les relevés d’or.")}</p>
    <div className="match-gold-chart-plot" role="slider" tabIndex={0}
      aria-label={t("Évolution de l’écart d’or")} aria-describedby={`${id}-keys`}
      aria-valuemin={0} aria-valuemax={series.points.length - 1} aria-valuenow={selectedIndex} aria-valuetext={valueText}
      onPointerMove={inspectPointer} onPointerDown={inspectPointer}
      onPointerLeave={() => setHovered(false)} onPointerCancel={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setHovered(false); }} onKeyDown={inspectKey}>
      <div aria-hidden="true" className="match-gold-chart-yaxis"><span>+{compact(limit)}</span><span>0</span><span>−{compact(limit)}</span></div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{t("Évolution de l’écart d’or")}</title>
        <desc id={`${id}-description`}>{t("Valeur positive : notre équipe mène. Valeur négative : l’adversaire mène.")} {summary}. {series.partial ? t("Les interruptions du tracé signalent des relevés manquants.") : ""}</desc>
        <line className="match-gold-chart-grid" x1={INSET} y1={INSET} x2={W - INSET} y2={INSET} />
        <line className="match-gold-chart-baseline" x1={INSET} y1={H / 2} x2={W - INSET} y2={H / 2} />
        <line className="match-gold-chart-grid" x1={INSET} y1={H - INSET} x2={W - INSET} y2={H - INSET} />
        {series.segments.filter((segment) => segment.length > 1).map((segment) => <polyline key={segment[0].timestamp} className="match-gold-chart-line" points={segment.map(coords).join(" ")} vectorEffect="non-scaling-stroke" />)}
        {series.points.map((point) => <circle key={point.timestamp} className="match-gold-chart-sample" cx={x(point.timestamp)} cy={y(point.diff)} r={2} />)}
        <circle className="match-gold-chart-end" data-tone={last.diff < 0 ? "negative" : last.diff > 0 ? "positive" : "neutral"} cx={x(last.timestamp)} cy={y(last.diff)} r={5} vectorEffect="non-scaling-stroke" />
        {inspecting && <g aria-hidden="true" className="match-gold-chart-selection">
          <line className="match-gold-chart-cursor" x1={x(selected.timestamp)} x2={x(selected.timestamp)} y1={0} y2={H} vectorEffect="non-scaling-stroke" />
          <circle className="match-gold-chart-selected" cx={x(selected.timestamp)} cy={y(selected.diff)} r={5} vectorEffect="non-scaling-stroke" />
        </g>}
      </svg>
      <div aria-hidden="true" className="match-gold-chart-xaxis"><span>0:00</span>{series.domainEndMs > 0 && <><span>{clock(middle)}</span><span>{clock(series.domainEndMs)}</span></>}</div>
      {inspecting && <div className="match-gold-chart-readout" aria-hidden="true" data-edge={x(selected.timestamp) > W / 2 ? "left" : "right"}>
        <span className="match-gold-chart-time">{t("Relevé à {0}", [clock(selected.timestamp)])}</span>
        <div className="match-gold-chart-difference"><span>{t("Écart d’or")}</span><strong data-tone={selected.diff < 0 ? "negative" : selected.diff > 0 ? "positive" : "neutral"}>{gold(signed(selected.diff))}</strong></div>
        <div><span>{allyName}</span><b>{gold(selected.ally)}</b></div>
        <div><span>{enemyName}</span><b>{gold(selected.enemy)}</b></div>
      </div>}
    </div>
    <div className="match-gold-chart-footer">
      <span>{summary}{series.partial ? ` · ${t("Relevés incomplets")}` : ""}</span>
      <details className="match-gold-chart-details">
        <summary>{t("Voir les relevés")}<ChevronDown aria-hidden="true" /></summary>
        <div className="match-gold-chart-data" tabIndex={0} role="region" aria-label={t("Relevés d’or")}>
          <table><caption>{t("Écart d’or : notre équipe moins l’adversaire")}</caption><thead><tr><th scope="col">{t("Temps")}</th><th scope="col">{t("Écart d’or")}</th></tr></thead><tbody>{series.points.map((point) => <tr key={point.timestamp}><th scope="row">{clock(point.timestamp)}</th><td>{signed(point.diff)}</td></tr>)}</tbody></table>
        </div>
      </details>
    </div>
  </figure>;
}
