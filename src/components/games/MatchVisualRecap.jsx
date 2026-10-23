import React from "react";
import { ArrowRight, ScanEye, Users } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, Surface } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName, HudIcon, itemIconSources, summonerSpellIconSources } from "../../pages/workspace/workspace-shared.jsx";
import MatchGoldChart from "./MatchGoldChart.jsx";
import { MatchLineups, getMatchRolePairs } from "./MatchHeadToHead.jsx";
import "./match-visual-recap.css";

const finite = Number.isFinite;
export function recapNumber(value, signed = false) {
  return finite(value) ? `${signed && value >= 0 ? "+" : ""}${value.toLocaleString(getLocale(), { maximumFractionDigits: 0 })}` : "—";
}

function reviewPair(snapshot) {
  const candidates = getMatchRolePairs(snapshot).filter(({ ally, enemy }) => finite(ally?.gold) && ally.gold >= 0 && finite(enemy?.gold) && enemy.gold >= 0);
  const deficits = candidates.filter(({ ally, enemy }) => ally.gold < enemy.gold);
  const ranked = deficits.length ? deficits.sort((a, b) => (a.ally.gold - a.enemy.gold) - (b.ally.gold - b.enemy.gold)) : candidates.sort((a, b) => (b.ally.gold - b.enemy.gold) - (a.ally.gold - a.enemy.gold));
  return ranked.find(({ ally, enemy }) => ally.gold !== enemy.gold) || null;
}

export function MatchVisualRecap({ match, snapshot, onCompare }) {
  useLanguage();
  const primaryKey = ["gold", "damage", "vision"].find((key) => finite(snapshot.facts[key].diff));
  const labels = { gold: t("Écart d’or final"), damage: t("Écart de dégâts aux champions"), vision: t("Écart de score de vision") };
  const focus = reviewPair(snapshot);
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
          <p className="match-recap-focus-label"><ScanEye aria-hidden="true" />{t("Point à explorer")}</p>
          <h4>{focus ? t("Le duel {0}", [focus.role]) : t("À revoir ensemble")}</h4>
          {focus ? <>
            <div className="match-recap-duel" aria-label={t("{0} face à {1}", [championDisplayName(focus.ally.champion) || t("Champion inconnu"), championDisplayName(focus.enemy.champion) || t("Champion inconnu")])}>
              <ChampionPortrait row={focus.ally} champion={focus.ally.champion} alt={championDisplayName(focus.ally.champion)} />
              <span>{t("vs")}</span>
              <ChampionPortrait row={focus.enemy} champion={focus.enemy.champion} alt={championDisplayName(focus.enemy.champion)} />
            </div>
            <div className="match-recap-role-stat"><strong>{recapNumber(focus.ally.gold - focus.enemy.gold, true)}</strong><span>{t("or")}</span><p>{t("Écart final du rôle")}</p></div>
            <p className="match-recap-hint">{t("À replacer dans le jeu collectif.")}</p>
          </> : <><Users className="match-recap-collective" aria-hidden="true" /><p className="match-recap-hint">{t("Choisir ensemble une séquence à revoir.")}</p></>}
          <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => onCompare(focus?.role || "")}>{focus ? t("Comparer ce duel") : t("Comparer les équipes")}</Button>
        </div>
      </Surface>
    </div>
    <p className="match-recap-interpretation">{t("Un écart final ne suffit pas à expliquer le résultat.")}</p>
  </section>;
}

function PlayerLoadout({ participant, name }) {
  const playerName = participant.name === "Joueur inconnu" ? t("Joueur inconnu") : participant.name;
  return <div className="match-duel-player">
    <span className="match-duel-team">{name}</span>
    <div className="match-duel-identity"><ChampionPortrait row={participant} champion={participant.champion} alt={championDisplayName(participant.champion)} /><div><strong>{playerName}</strong><span>{championDisplayName(participant.champion) || t("Champion inconnu")}</span></div></div>
    <div className="match-duel-loadout" aria-label={t("Équipements et sorts de {0}", [playerName])}>
      {(participant.spells || []).filter((id) => finite(id) && id > 0).map((id, index) => <HudIcon key={`spell-${index}`} sources={summonerSpellIconSources(id)} label={t("Sort {0}", [id])} fallback="—" emptyText="—" className="h-8 w-8 rounded-lg" />)}
      {[...(participant.items || []), participant.trinket].filter((id) => finite(id) && id > 0).map((id, index) => <HudIcon key={`item-${index}`} sources={itemIconSources(id)} label={t("Objet {0}", [id])} fallback="—" emptyText="—" className="h-8 w-8 rounded-lg" />)}
    </div>
  </div>;
}

export function MatchDuelDetails({ pair, snapshot, id, detailsRef }) {
  useLanguage();
  if (!pair?.ally || !pair?.enemy) return id ? <div id={id} hidden /> : null;
  const { ally, enemy } = pair;
  const rows = [["Or", "gold"], ["Dégâts aux champions", "damage"], ["Score de vision", "vision"], ["CS", "cs"], ["CS à 10 min", "cs10"]];
  const kda = (p) => [p.kills, p.deaths, p.assists].map((v) => recapNumber(v)).join(" / ");
  const teamName = snapshot.context.teamName === "Notre équipe" ? t("Notre équipe") : snapshot.context.teamName;
  const opponentName = snapshot.context.opponentName === "Adversaires" ? t("Adversaires") : snapshot.context.opponentName;
  return <section id={id} ref={detailsRef} tabIndex={-1} className="match-duel-details" aria-label={t("Détail du duel {0}", [pair.role])}>
    <h4>{t("Détail du duel {0}", [pair.role])}</h4>
    <div className="match-duel-players"><PlayerLoadout participant={ally} name={teamName} /><PlayerLoadout participant={enemy} name={opponentName} /></div>
    <div className="match-duel-table-wrap"><table className="match-duel-table"><caption>{t("Statistiques finales et repères disponibles")}</caption><thead><tr><th scope="col">{t("Statistique")}</th><th scope="col">{t("Notre équipe")}</th><th scope="col">{t("Adversaires")}</th></tr></thead><tbody>
      <tr><th scope="row">{t("Éliminations / morts / assistances")}</th><td>{kda(ally)}</td><td>{kda(enemy)}</td></tr>
      {rows.map(([label, key]) => <tr key={key}><th scope="row">{t(label)}</th><td>{recapNumber(ally[key])}</td><td>{recapNumber(enemy[key])}</td></tr>)}
    </tbody></table></div>
    <p className="match-recap-interpretation">{t("Un tiret indique une donnée indisponible.")}</p>
  </section>;
}
