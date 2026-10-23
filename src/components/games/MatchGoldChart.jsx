import React, { useId, useMemo } from "react";
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

  return <figure className="match-gold-chart">
    <figcaption>
      <p className="match-gold-chart-title">{t("Évolution de l’écart d’or")}</p>
      <div className="match-gold-chart-legend"><span><i aria-hidden="true">+</i>{allyName}</span>
        <span><i aria-hidden="true">−</i>{enemyName}</span></div>
    </figcaption>
    <div className="match-gold-chart-plot">
      <div aria-hidden="true" className="match-gold-chart-yaxis"><span>+{compact(limit)}</span><span>0</span><span>−{compact(limit)}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{t("Évolution de l’écart d’or")}</title>
        <desc id={`${id}-description`}>{t("Valeur positive : notre équipe mène. Valeur négative : l’adversaire mène.")} {summary}. {series.partial ? t("Les interruptions du tracé signalent des relevés manquants.") : ""}</desc>
        <line className="match-gold-chart-grid" x1={INSET} y1={INSET} x2={W - INSET} y2={INSET} />
        <line className="match-gold-chart-baseline" x1={INSET} y1={H / 2} x2={W - INSET} y2={H / 2} />
        <line className="match-gold-chart-grid" x1={INSET} y1={H - INSET} x2={W - INSET} y2={H - INSET} />
        {series.segments.filter((segment) => segment.length > 1).map((segment) => <polyline key={segment[0].timestamp} className="match-gold-chart-line" points={segment.map(coords).join(" ")} vectorEffect="non-scaling-stroke" />)}
        {series.points.map((point) => <circle key={point.timestamp} className="match-gold-chart-sample" cx={x(point.timestamp)} cy={y(point.diff)} r={2} />)}
        <circle className="match-gold-chart-end" data-tone={last.diff < 0 ? "negative" : last.diff > 0 ? "positive" : "neutral"} cx={x(last.timestamp)} cy={y(last.diff)} r={5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div aria-hidden="true" className="match-gold-chart-xaxis"><span>0:00</span>{series.domainEndMs > 0 && <><span>{clock(middle)}</span><span>{clock(series.domainEndMs)}</span></>}</div>
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
