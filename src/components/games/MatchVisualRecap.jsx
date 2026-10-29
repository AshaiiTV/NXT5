import React from "react";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Surface } from "../ui/Core.jsx";
import MatchGoldChart from "./MatchGoldChart.jsx";
import { MatchLineups } from "./MatchHeadToHead.jsx";
import { MatchKillMap } from "./MatchKillMap.jsx";
import "./match-visual-recap.css";

const finite = Number.isFinite;
export function recapNumber(value, signed = false) {
  return finite(value) ? `${signed && value >= 0 ? "+" : ""}${value.toLocaleString(getLocale(), { maximumFractionDigits: 0 })}` : "—";
}

export function MatchVisualRecap({ match, snapshot, loading = false, error = "", teamFilter, onTeamFilterChange }) {
  useLanguage();
  const primaryKey = ["gold", "damage", "vision"].find((key) => finite(snapshot.facts[key].diff));
  const labels = { gold: t("Écart d’or final"), damage: t("Écart de dégâts aux champions"), vision: t("Écart de score de vision") };
  const value = primaryKey ? snapshot.facts[primaryKey].diff : null;
  return <section className="match-recap" aria-label={t("Bilan de la partie")}>
    <MatchLineups snapshot={snapshot} />
    <div className="match-recap-grid">
      <Surface variant="reading" className="match-recap-chart">
        <div className="match-recap-stat">
          {primaryKey ? <><div><h4>{labels[primaryKey]}</h4><p>{t("Notre équipe − adversaires")}</p></div><strong data-tone={value < 0 ? "negative" : value > 0 ? "positive" : "neutral"}>{recapNumber(value, true)}</strong></> : <div><h4>{t("Statistiques incomplètes")}</h4><p>{t("Les données disponibles ne permettent pas de comparer les totaux des deux équipes.")}</p></div>}
        </div>
        <MatchGoldChart match={match} publication={snapshot} teamName={snapshot.context.teamName} />
      </Surface>
      <MatchKillMap match={match} allyName={snapshot.context.teamName} enemyName={snapshot.context.opponentName} loading={loading} error={error} teamFilter={teamFilter} onTeamFilterChange={onTeamFilterChange} />
    </div>
  </section>;
}
