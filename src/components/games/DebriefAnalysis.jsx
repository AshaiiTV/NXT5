import React, { useMemo, useState } from "react";
import { ChartNoAxesColumn, Coins, Eye, Swords, UserRound } from "lucide-react";
import { Button, ReadingDetails } from "../ui/Core.jsx";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { getMatchRolePairs } from "./MatchHeadToHead.jsx";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import "./debrief-analysis.css";

const METRICS = [
  { id: "gold", label: "Or", title: "Or final", Icon: Coins },
  { id: "damage", label: "Dégâts", title: "Dégâts aux champions", Icon: Swords },
  { id: "vision", label: "Vision", title: "Score de vision", Icon: Eye },
];
const measured = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const format = (value, signed = false) => value === null ? "—" : `${signed && value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString(getLocale(), { maximumFractionDigits: 0 })}`;

function Player({ row, teamKey }) {
  const champion = row?.champion ? championDisplayName(row.champion) : "";
  return <span className="da-player" data-team={teamKey}>
    <span className="da-portrait" aria-hidden="true">{champion ? <ChampionPortrait champion={row.champion} alt={champion} /> : <UserRound />}</span>
    <span>{row ? champion || t("Champion inconnu") : t("Rôle non confirmé")}</span>
  </span>;
}

function AnalysisContent({ snapshot }) {
  const [metricId, setMetricId] = useState("gold");
  const pairs = useMemo(() => getMatchRolePairs(snapshot), [snapshot]);
  const metric = METRICS.find((item) => item.id === metricId);
  const rows = pairs.map((pair) => {
    const ally = measured(pair.ally?.[metricId]);
    const enemy = measured(pair.enemy?.[metricId]);
    return { ...pair, allyValue: ally, enemyValue: enemy, difference: ally === null || enemy === null ? null : ally - enemy };
  });
  const scale = Math.max(0, ...rows.map((row) => Math.abs(row.difference ?? 0)));
  const incomplete = rows.some((row) => row.difference === null);

  return <ReadingDetails className="debrief-analysis" title={<span className="da-title"><ChartNoAxesColumn aria-hidden="true" />{t("Les écarts par poste")}</span>}>
    <div className="da-content">
      <div className="da-toolbar">
        <div className="da-metrics" role="group" aria-label={t("Statistique comparée")}>
          {METRICS.map(({ id, label, title, Icon }) => <Button key={id} type="button" variant="ghost" className="da-metric-button" icon={Icon} aria-pressed={metricId === id} aria-label={t(title)} title={t(title)} onClick={() => setMetricId(id)}>{t(label)}</Button>)}
        </div>
        <span className="da-measure">{t(metric.title)}</span>
      </div>
      <div className="da-legend" aria-hidden="true"><span>{t("Notre équipe")}</span><span>{t("Écart")}</span><span>{t("Adversaires")}</span></div>
      <ol className="da-rows" aria-label={t("Comparaison par poste")}>
        {rows.map(({ role, ally, enemy, allyValue, enemyValue, difference }) => {
          const tone = difference === null ? "missing" : difference > 0 ? "positive" : difference < 0 ? "negative" : "equal";
          const width = difference !== null && scale > 0 ? Math.abs(difference) / scale * 50 : 0;
          return <li className="da-row" key={role} data-role={role}>
            <span className="da-role"><span aria-hidden="true"><RoleIcon role={role} /></span><strong>{role}</strong></span>
            <Player row={ally} teamKey="ALLY" />
            <div className="da-comparison" data-metric={metricId} data-tone={tone}>
              <div className="da-values"><span data-value="ally"><span className="sr-only">{t("Notre équipe")} : </span>{format(allyValue)}</span><strong data-value="difference"><span className="sr-only">{t("Écart : notre équipe − adversaires")} : </span>{format(difference, true)}</strong><span data-value="enemy"><span className="sr-only">{t("Adversaires")} : </span>{format(enemyValue)}</span></div>
              <span className="da-track" aria-hidden="true"><span className="da-fill" style={{ width: `${width}%`, left: difference > 0 ? `${50 - width}%` : "50%" }} /></span>
            </div>
            <Player row={enemy} teamKey="ENEMY" />
          </li>;
        })}
      </ol>
      {incomplete && <p className="da-missing">{t("— : donnée absente ou rôle non confirmé")}</p>}
    </div>
  </ReadingDetails>;
}

export function DebriefAnalysis({ snapshot }) {
  useLanguage();
  return <AnalysisContent snapshot={snapshot} />;
}

export default DebriefAnalysis;
