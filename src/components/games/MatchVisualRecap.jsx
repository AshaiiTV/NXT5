import React from "react";
import { ArrowRight, Swords } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, Surface } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import MatchGoldChart from "./MatchGoldChart.jsx";
import { MatchLineups } from "./MatchHeadToHead.jsx";
import { getTeamDamageLeaders } from "./match-impact.js";
import "./match-visual-recap.css";

const finite = Number.isFinite;
export function recapNumber(value, signed = false) {
  return finite(value) ? `${signed && value >= 0 ? "+" : ""}${value.toLocaleString(getLocale(), { maximumFractionDigits: 0 })}` : "—";
}

function TeamDamageLeaders({ snapshot, teamKey }) {
  const { status, leaders } = getTeamDamageLeaders(snapshot, teamKey);
  const relationship = t(teamKey === "ALLY" ? "Notre équipe" : "Adversaires");
  const rawName = teamKey === "ALLY" ? snapshot.context.teamName : snapshot.context.opponentName;
  const name = !rawName || rawName === "Notre équipe" || rawName === "Adversaires" ? relationship : rawName;
  return <section className="match-impact-team" data-team={teamKey} aria-label={name}>
    <div className="match-impact-team-heading"><h5>{name}</h5>{name !== relationship && <span>{relationship}</span>}</div>
    {status === "ready" ? <>
      {leaders.length > 1 && <p className="match-impact-tie">{t("Ex æquo")}</p>}
      <ol className="match-impact-leaders">{leaders.map(({ participant, share }, index) => {
        const champion = championDisplayName(participant.champion) || t("Champion inconnu");
        const playerName = !participant.name || participant.name === "Joueur inconnu" ? t("Joueur inconnu") : participant.name;
        return <li key={participant.participantId || index}>
          <div className="match-impact-player">
            <span className="match-impact-portrait"><ChampionPortrait row={participant} champion={participant.champion} alt={champion} /></span>
            <div className="match-impact-identity"><strong>{playerName}</strong><span>{champion}</span></div>
          </div>
          <div className="match-impact-damage"><strong>{recapNumber(participant.damage)}</strong><span>{t("{0} % de l’équipe", [recapNumber(share)])}</span></div>
          <div className="match-impact-track" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
        </li>;
      })}</ol>
    </> : <p className="match-impact-unavailable">{status === "zero" ? t("Aucun dégât aux champions") : t("Données incomplètes")}</p>}
  </section>;
}
export function MatchVisualRecap({ match, snapshot, onCompare }) {
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
      <Surface variant="glass" className="match-recap-focus">
        <div className="match-recap-focus-inner">
          <div className="match-impact-heading"><h4>{t("Qui a le plus d’impact ?")}</h4><p className="match-recap-focus-label"><Swords aria-hidden="true" />{t("Dégâts aux champions")}</p></div>
          <div className="match-impact-teams">{["ALLY", "ENEMY"].map((teamKey) => <TeamDamageLeaders key={teamKey} snapshot={snapshot} teamKey={teamKey} />)}</div>
          <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => onCompare()}>{t("Comparer les équipes")}</Button>
        </div>
      </Surface>
    </div>
  </section>;
}
