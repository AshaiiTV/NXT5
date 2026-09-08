import React, { useMemo } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, Minus } from "lucide-react";
import { buildTrendEvolution, sortTrendMatches, trendMatchTimestamp } from "../../utils/trends.js";
import { matchDisplayName } from "../../utils/matches.js";
import { cx } from "../../app/helpers.js";
import { Button, Surface } from "../ui/Core.jsx";

const number = (value) => Number.isFinite(value) ? value.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—";
const date = (match) => {
  const timestamp = trendMatchTimestamp(match);
  return timestamp === null ? "Date inconnue" : new Date(timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

export function TrendPeriodFilter({ value, onChange }) {
  return <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Période d’analyse">
    <span className="mr-1 text-xs font-bold text-slate-400">Période</span>
    {[["all", "Tout"], ["5", "5 dernières"], ["10", "10 dernières"], ["20", "20 dernières"]].map(([id, label]) =>
      <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)} className={cx("min-h-11 rounded-xl border px-3 py-1.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200", value === id ? "border-cyan-200/35 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white")}>{label}</button>
    )}
  </div>;
}

export function TrendEvolution({ matches, onOpenMatch, onOpenSources }) {
  const evolution = useMemo(() => buildTrendEvolution(matches), [matches]);
  const recentForm = useMemo(() => sortTrendMatches(matches).slice(0, 10).reverse(), [matches]);
  const { recent, previous, size, metrics } = evolution;
  return <Surface className="mb-4 !p-0"><section aria-labelledby="trend-evolution-title">
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
      <div>
        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-200/80">Dynamique récente</p>
        <h3 id="trend-evolution-title" className="mt-1 text-xl font-black text-white">Ce qui évolue dans ton jeu</h3>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-400">{size ? `${size} dernières games comparées aux ${size} précédentes, dans la sélection active.` : "Il faut au moins 4 games datées pour comparer deux blocs."}</p>
      </div>
      {size > 0 && <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => onOpenSources([...recent, ...previous])}>Voir les {size * 2} games</Button>}
    </div>
    {size > 0 && <div className="nxt5-keep-grid grid grid-cols-2 !gap-px border-y border-white/10 bg-white/10 lg:grid-cols-4">
      {metrics.map((metric) => {
        const roundedDelta = Number.isFinite(metric.delta) ? Math.round(metric.delta * 10) / 10 : null;
        const positive = roundedDelta !== null && (metric.inverse ? roundedDelta < 0 : roundedDelta > 0);
        const neutral = roundedDelta === null || roundedDelta === 0;
        const Icon = roundedDelta > 0 ? ArrowUpRight : roundedDelta < 0 ? ArrowDownRight : Minus;
        return <div key={metric.key} className="bg-[#080e1b] p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-400">{metric.label}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-white">{number(metric.current)}{metric.key === "wr" && metric.current !== null ? "%" : ""}</span>
            <span className="text-xs text-slate-500">avant {number(metric.previous)}{metric.key === "wr" && metric.previous !== null ? "%" : ""}</span>
          </div>
          <div className={cx("mt-2 inline-flex items-center gap-1 text-xs font-bold", neutral ? "text-slate-400" : positive ? "text-emerald-300" : "text-rose-300")}>
            <Icon className="h-4 w-4" />{roundedDelta === null ? "Comparaison indisponible" : roundedDelta === 0 ? "Stable" : `${roundedDelta > 0 ? "+" : ""}${number(roundedDelta)} ${metric.unit}`}
          </div>
          {(metric.count < size || metric.previousCount < size) && <p className="mt-1 text-[0.65rem] leading-4 text-amber-200/80">Données : {metric.count}/{size} récentes · {metric.previousCount}/{size} précédentes</p>}
        </div>;
      })}
    </div>}
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold text-slate-200"><Clock3 className="h-3.5 w-3.5 text-cyan-200" />{recentForm.length} derniers résultats</span>
        <span className="text-[0.65rem] text-slate-500">Plus ancien → plus récent · cliquer pour ouvrir</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentForm.map((match, index) => {
          const win = match.result === "Victoire";
          const loss = match.result === "Défaite";
          const name = matchDisplayName(match);
          return <button key={match.id || match.game_id || index} type="button" onClick={() => onOpenMatch(match)} title={`${name} · ${date(match)} · ${match.result || "Résultat inconnu"}`} aria-label={`Ouvrir ${name}, ${date(match)}, ${match.result || "résultat inconnu"}`} className={cx("group flex min-w-[3.25rem] flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200", win ? "border-emerald-300/20 bg-emerald-300/[0.06] hover:bg-emerald-300/15" : loss ? "border-rose-300/20 bg-rose-300/[0.06] hover:bg-rose-300/15" : "border-white/10 bg-white/5")}>
            <span className={cx("text-sm font-black", win ? "text-emerald-300" : loss ? "text-rose-300" : "text-slate-400")}>{win ? "V" : loss ? "D" : "—"}</span>
            <span className="whitespace-nowrap text-[0.6rem] text-slate-400">{date(match)}</span>
          </button>;
        })}
      </div>
      {size > 0 && <p className="mt-3 text-[0.65rem] leading-5 text-slate-500">Bloc précédent : {date(previous.at(-1))} – {date(previous[0])} · Bloc récent : {date(recent.at(-1))} – {date(recent[0])}. Écarts calculés en fin de game ; ces évolutions restent descriptives.</p>}
    </div>
  </section></Surface>;
}
