import React, { useMemo, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { Button, SelectInput } from "../ui/Core.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { canonicalChampion, championDisplayName } from "../../../shared/champions.js";
import { canonicalRole, ROLES } from "../../../shared/roles.js";
import { matchCategoryIds, matchDisplayName } from "../../utils/matches.js";
import { buildDraftAssistance } from "../../utils/draft-assistance.js";
import { resolveCompositionPick } from "../../utils/planning.js";
import { openAppPath } from "../../app/routing.js";
import { ChampionPortrait, POOL_TIER_LABELS } from "../../pages/workspace/workspace-shared.jsx";
import "./draft-assistance.css";

const EMPTY = [];
const championKey = value => canonicalChampion(value).toLowerCase();
const MOBALYTICS_ROLES = { TOP: "top", JGL: "jungle", MID: "mid", ADC: "adc", SUP: "support" };

function Results({ label, summary, number }) {
  return <div className="nxt5-draft-assistance-metric">
    <dt>{label}</dt>
    <dd>{summary.games ? <>
      <strong>{summary.known ? t("{0} % de victoires", [number.format(summary.winrate)]) : t("Résultat indisponible")}</strong>
      <span>{t("{0} résultats connus sur {1} parties", [summary.known, summary.games])}</span>
    </> : <span>{t("Aucune partie renseignée")}</span>}</dd>
  </div>;
}

export default function DraftAssistance({ data, teamId, slots, champions, onPick, disabled = false }) {
  const language = useLanguage();
  const [role, setRole] = useState("TOP");
  const [opponent, setOpponent] = useState("");
  const [category, setCategory] = useState("");
  const [patch, setPatch] = useState("");
  const number = useMemo(() => new Intl.NumberFormat(getLocale(language), { maximumFractionDigits: 1 }), [language]);
  const players = useMemo(() => (data.players || EMPTY).filter(player => String(player.team_id) === String(teamId)), [data.players, teamId]);
  const rolePlayers = players.filter(player => canonicalRole(player.role) === role);
  const player = rolePlayers.find(item => String(item.id) === String(slots[role]?.playerId)) || rolePlayers[0];
  const matches = useMemo(() => (data.matches || EMPTY).filter(match => String(match.team_id) === String(teamId)), [data.matches, teamId]);
  const patches = useMemo(() => [...new Set(matches.map(match => String(match.patch || "").trim()).filter(Boolean))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })), [matches]);
  const categories = (data.matchCategories || EMPTY).filter(item => String(item.team_id) === String(teamId));
  const activePatch = patches.includes(patch) ? patch : "";
  const activeCategory = categories.some(item => String(item.id) === category) ? category : "";
  const scopedMatches = useMemo(() => matches.filter(match => (!activePatch || String(match.patch || "").trim() === activePatch) && (!activeCategory || matchCategoryIds(match).map(String).includes(activeCategory))), [matches, activePatch, activeCategory]);
  const pool = data.championPool || EMPTY;
  const excludedChampions = useMemo(() => Object.entries(slots).filter(([position]) => position !== role).map(([, slot]) => resolveCompositionPick(slot, pool)?.champion).filter(Boolean), [slots, role, pool]);
  const suggestions = useMemo(() => buildDraftAssistance({ teamId, player, role, opponentChampion: opponent, championPool: pool, matches: scopedMatches, excludedChampions }), [teamId, player, role, opponent, pool, scopedMatches, excludedChampions]);
  const opponentName = championDisplayName(opponent);
  const sourceUrl = opponent ? `https://mobalytics.gg/lol/champions/${championKey(opponent)}/counters/${MOBALYTICS_ROLES[role]}` : null;

  return <section className="nxt5-draft-assistance" aria-label={t("Aide au choix des champions")}>
    <p className="nxt5-draft-assistance-intro">{t("Compare les champions du joueur choisi pour ce poste. La maîtrise déclarée passe en premier, puis le nombre de parties au résultat connu dans cette équipe.")}</p>
    <div className="nxt5-draft-assistance-filters">
      <SelectInput label={t("Poste à préparer")} value={role} onChange={setRole}>{ROLES.map(position => <option key={position} value={position}>{position}</option>)}</SelectInput>
      <SelectInput label={t("Champion adverse (facultatif)")} value={opponent} onChange={setOpponent}>
        <option value="">{t("Adversaire encore inconnu")}</option>
        {champions.map(champion => <option key={champion} value={champion}>{championDisplayName(champion)}</option>)}
      </SelectInput>
      <SelectInput label={t("Catégorie des parties")} value={activeCategory} onChange={setCategory}>
        <option value="">{t("Toutes les catégories")}</option>
        {categories.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
      </SelectInput>
      <SelectInput label={t("Patch des parties")} value={activePatch} onChange={setPatch}>
        <option value="">{t("Tous les patches")}</option>
        {patches.map(value => <option key={value} value={value}>{value}</option>)}
      </SelectInput>
    </div>
    <p className="nxt5-draft-assistance-context">{player ? t("Pool de {0} · {1}", [player.name, role]) : t("Aucun joueur à ce poste")}</p>
    <p className="nxt5-draft-assistance-help">{t("Pour changer de joueur, utilise le poste correspondant dans la composition. Les résultats portent sur la partie entière ; ils ne prouvent pas qu’un champion gagne sa lane.")}</p>
    <div role="status" aria-live="polite" className="nxt5-draft-assistance-count">{t("{0} choix disponibles", [suggestions.length])}</div>
    {!suggestions.length && <p className="nxt5-draft-assistance-empty">{player ? t("Aucun champion disponible dans ce pool. Ajoute un champion au joueur ou vérifie les choix déjà occupés et l’adversaire sélectionné.") : t("Ajoute un profil à ce poste pour préparer ses choix.")}</p>}
    <ul className="nxt5-draft-assistance-list">
      {suggestions.map(suggestion => {
        const selected = String(slots[role]?.poolId) === String(suggestion.poolRow.id);
        const sources = opponent ? suggestion.matchup.matches : suggestion.experience.matches;
        return <li key={suggestion.poolRow.id} className="nxt5-draft-assistance-choice">
          <div className="nxt5-draft-assistance-champion">
            <ChampionPortrait champion={suggestion.champion} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <div><h4>{championDisplayName(suggestion.champion)}</h4><p>{t(POOL_TIER_LABELS[suggestion.mastery.status] || "En validation")}</p></div>
          </div>
          <dl className="nxt5-draft-assistance-results">
            <Results label={t("Avec ce joueur dans l’équipe")} summary={suggestion.experience} number={number} />
            {opponent && <Results label={t("Face à {0} au même poste", [opponentName])} summary={suggestion.matchup} number={number} />}
          </dl>
          <Button type="button" variant="ghost" icon={selected ? Check : undefined} disabled={disabled || selected} aria-label={t("Choisir {0} en {1}", [championDisplayName(suggestion.champion), role])} onClick={() => onPick(role, { playerId: player.id, poolId: suggestion.poolRow.id })}>{selected ? t("Dans la composition") : t("Choisir")}</Button>
          {!!sources.length && <details className="nxt5-draft-assistance-sources">
            <summary>{t("Voir les {0} parties sources", [sources.length])}</summary>
            <ul>{sources.map((match, index) => <li key={match.id || `unlinked-${index}`}>{String(match.id || "").trim() ? <button type="button" onClick={() => openAppPath(`/games?match=${encodeURIComponent(match.id)}`)}>{matchDisplayName(match)}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></button> : <span>{matchDisplayName(match)} · {t("Partie sans lien disponible")}</span>}</li>)}</ul>
          </details>}
        </li>;
      })}
    </ul>
    {sourceUrl && <div className="nxt5-draft-assistance-external">
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{t("Consulter les counters de {0} sur Mobalytics", [opponentName])}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></a>
      <p>{t("Source externe, dans un nouvel onglet. Vérifie le poste, le patch, le rang et le nombre de parties sur Mobalytics. Ces statistiques ne sont pas importées et ne modifient pas le classement ci-dessus.")}</p>
    </div>}
    <p className="nxt5-draft-assistance-help">{t("Choisir un champion modifie le brouillon. Enregistre la composition pour la partager avec l’équipe.")}</p>
  </section>;
}
