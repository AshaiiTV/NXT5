import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React from "react";

// Shared by the homepage analysis scene and the public demo. The SVG keeps the
// 650 × 228 coordinate system of the homepage; the plot spans x 24…626, y 26…206.
const VIEW_WIDTH = 650;
const VIEW_HEIGHT = 228;
const PLOT_LEFT = 24;
const PLOT_WIDTH = 602;
const PLOT_TOP = 40;
const PLOT_BOTTOM = 196;

export const formatMatchTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
export const formatGoldDifference = (gold) => `${gold > 0 ? "+" : gold < 0 ? "−" : ""}${Math.abs(gold).toLocaleString(getLocale())}`;

export function goldAtTime(timeline, seconds) {
  const endIndex = timeline.findIndex(([time]) => time >= seconds);
  if (endIndex <= 0) return timeline[endIndex === 0 ? 0 : timeline.length - 1][1];
  const [startTime, startGold] = timeline[endIndex - 1];
  const [endTime, endGold] = timeline[endIndex];
  return startGold + ((seconds - startTime) / (endTime - startTime)) * (endGold - startGold);
}

/** Fits the curve and the zero line between the plot margins unless a fixed scale is given. */
export function goldScale(timeline, scale) {
  if (scale) return scale;
  const values = timeline.map(([, gold]) => gold);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const perGold = (PLOT_BOTTOM - PLOT_TOP) / Math.max(1, max - min);
  return { zero: PLOT_TOP + max * perGold, perGold };
}

export function goldGeometry(timeline, durationSeconds, scale) {
  const { zero, perGold } = goldScale(timeline, scale);
  const x = (seconds) => PLOT_LEFT + (seconds / durationSeconds) * PLOT_WIDTH;
  const y = (gold) => zero - gold * perGold;
  const path = timeline.map(([seconds, gold], index) => `${index === 0 ? "M" : "L"}${x(seconds)} ${y(gold)}`).join(" ");
  return { x, y, zero, path };
}

// Positions are applied through the CSSOM after mount: the production CSP
// forbids style attributes in prerendered HTML (style-src-attr 'none').
const place = (left, top) => (node) => {
  if (!node) return;
  node.style.left = `${left / VIEW_WIDTH * 100}%`;
  if (top !== undefined) node.style.top = `${top / VIEW_HEIGHT * 100}%`;
};

export function GoldTimelineChart({ timeline, durationSeconds, objectives = [], seconds, onSecondsChange, scale, idPrefix = "ps", controls, ariaLabel, zeroLine = false, className = "" }) {
  useLanguage();
  const { x, y, zero, path } = goldGeometry(timeline, durationSeconds, scale);
  const gold = goldAtTime(timeline, seconds);
  const displayedGold = Math.round(gold / 10) * 10;
  const time = formatMatchTime(seconds);
  const objective = objectives.find((item) => item.seconds === seconds);
  const ticks = [0, 600, 1200, durationSeconds];
  return (
    <div className={`ps-chart${className ? ` ${className}` : ""}`}>
      <div className="ps-chart-heading"><span className="ps-chart-label">{t("Écart d’or au fil de la partie")}</span><span className="ps-chart-hint">{t("Déplace le curseur")}</span></div>
      <div className="ps-chart-plot">
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={`${idPrefix}-graph-line`} x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#67e8f9" />
              <stop offset=".55" stopColor="#a5b4fc" />
              <stop offset="1" stopColor="#e879f9" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-graph-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#a78bfa" stopOpacity=".22" />
              <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="ps-grid-line" d="M24 44H625M24 98H625M24 152H625M24 206H625" />
          {zeroLine && <path className="ps-zero-line" d={`M24 ${zero}H625`} />}
          <path d={`${path}V206H24Z`} fill={`url(#${idPrefix}-graph-fill)`} />
          <path className="ps-gold-line" d={path} />
          <g className="ps-chart-cursor" transform={`translate(${x(seconds)}, 0)`}>
            <path d="M0 26V206" />
            <circle cy={y(gold)} r="12" className="ps-point-halo" />
            <circle cy={y(gold)} r="4.5" className="ps-point" />
          </g>
        </svg>
        <input className="ps-chart-slider" type="range" min="0" max={durationSeconds} step="15"
          value={seconds} onChange={(event) => onSecondsChange(Number(event.target.value))}
          aria-label={t("Moment de la partie")} aria-controls={controls}
          aria-valuetext={`${t("{0}, {1} or par rapport à l’adversaire", [time, formatGoldDifference(displayedGold)])}${objective ? `, ${t(objective.name)}` : ""}`}
        />
        {objectives.map((item) => (
          <div className="ps-chart-objective" key={item.id} data-objective={item.id} ref={place(x(item.seconds), y(goldAtTime(timeline, item.seconds)))}>
            <button type="button" aria-label={t("{0} à {1}", [t(item.name), item.time])}
              aria-pressed={seconds === item.seconds}
              aria-controls={controls}
              title={`${t(item.name)} · ${item.time}`}
              onClick={() => onSecondsChange(item.seconds)}>
              <img src={`/assets/objectives/${item.id}.png`} width="28" height="28" alt="" />
              <span aria-hidden="true">{t(item.label)}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="ps-chart-axis" aria-hidden="true">
        {ticks.map((tick) => <span key={tick} data-time={tick} ref={place(x(tick))}>{tick === 0 ? "0 min" : tick === durationSeconds ? formatMatchTime(tick) : tick / 60}</span>)}
      </div>
    </div>
  );
}
