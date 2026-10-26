import React, { useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, Clock3, Coins, Crosshair, Flag, Loader2, Swords, Users, X } from "lucide-react";
import { buildGamePublicationSnapshot } from "../../../shared/publications/game-publication.js";
import { buildDebriefMoments } from "../../utils/debrief-moments.js";
import { matchDisplayName } from "../../utils/matches.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Badge, Button, ReadingDetails, Surface } from "../ui/Core.jsx";
import { ModalDialog } from "../ui/ModalDialog.jsx";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import MatchGoldChart from "./MatchGoldChart.jsx";
import { MatchLineups } from "./MatchHeadToHead.jsx";
import "./visual-debrief.css";

const EMPTY = [];
const OBJECTIVES = [
  { key: "dragons", label: "Dragons", singular: "Dragon", source: "/assets/objectives/dragon.png" },
  { key: "barons", label: "Nashors", singular: "Nashor", source: "/assets/objectives/baron.png" },
  { key: "towers", label: "Tours", singular: "Tour", source: "/assets/objectives/tower.png" },
  { key: "heralds", label: "Hérauts", singular: "Héraut", source: "/assets/objectives/herald.png" },
  { key: "grubs", label: "Larves", singular: "Larve", source: "/assets/objectives/grub.png" },
];
const OBJECTIVE_BY_KEY = Object.fromEntries(OBJECTIVES.map((objective) => [objective.key, objective]));
const clock = (timestamp) => `${Math.floor(timestamp / 60000)}:${String(Math.floor(timestamp / 1000) % 60).padStart(2, "0")}`;
const number = (value) => Number.isFinite(value) ? value.toLocaleString(getLocale(), { maximumFractionDigits: 0 }) : "—";
const signed = (value) => Number.isFinite(value) ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value))}` : "—";
const resultTone = (result) => result === "Victoire" ? "win" : result === "Défaite" ? "loss" : "unknown";
const resultLabel = (result) => result === "Victoire" ? t("Victoire") : result === "Défaite" ? t("Défaite") : t("Résultat inconnu");
const teamLabel = (teamKey) => teamKey === "ALLY" ? t("Notre équipe") : teamKey === "ENEMY" ? t("Adversaires") : t("Équipe indéterminée");
const playerName = (value) => !value || value === "Joueur inconnu" ? t("Joueur inconnu") : value;

function momentTitle(moment) {
  if (moment.kind === "fight") return t("Combat");
  const objective = OBJECTIVE_BY_KEY[moment.objectiveKey];
  return objective ? t(objective.singular) : moment.kind === "building" ? t("Bâtiment détruit") : t("Objectif");
}

function ObjectiveImage({ objectiveKey, className = "" }) {
  const objective = OBJECTIVE_BY_KEY[objectiveKey];
  const [failedSource, setFailedSource] = useState(null);
  if (!objective || failedSource === objective.source) return <Flag aria-hidden="true" className={className} />;
  return <img src={objective.source} alt="" width="40" height="40" className={className} loading="lazy" decoding="async" onError={() => setFailedSource(objective.source)} />;
}

function Status({ loading, error, missing, onRetry, selectedId, onOpenMatch }) {
  return <Surface variant="reading" className="vd-status">
    <div role={error ? "alert" : "status"} className="vd-status-line">
      {loading ? <Loader2 className="vd-loading-icon" aria-hidden="true" /> : <Flag aria-hidden="true" />}
      <div><p>{loading ? t("Préparation du bilan visuel…") : t("Bilan visuel indisponible")}</p>
        <span>{error || (missing ? t("Toutes les parties liées doivent être chargées pour afficher ce débrief.") : t("Aucune partie liée à ce débrief."))}</span></div>
    </div>
    <div className="vd-status-actions">
      {!loading && onRetry && <Button type="button" variant="ghost" onClick={onRetry}>{t("Réessayer")}</Button>}
      {selectedId && onOpenMatch && <Button type="button" variant="ghost" icon={ArrowUpRight} onClick={() => onOpenMatch(selectedId)}>{t("Voir la partie")}</Button>}
    </div>
  </Surface>;
}

function GamePicker({ matches, selectedId, onSelect }) {
  const id = useId();
  if (matches.length <= 1) return null;
  if (matches.length > 4) return <div className="vd-picker-large">
    <label htmlFor={id}>{t("Partie affichée")}</label>
    <div><select id={id} value={selectedId} onChange={(event) => onSelect(event.target.value)}>
      {matches.map((match, index) => <option key={match.id} value={String(match.id)}>{t("Partie {0}", [index + 1])} · {matchDisplayName(match)} · {resultLabel(match.result)}</option>)}
    </select><ChevronDown aria-hidden="true" /></div>
    <span>{t("{0} parties liées", [matches.length])}</span>
  </div>;
  return <div className="vd-games" role="group" aria-label={t("Choisir la partie")} data-count={matches.length}>
    {matches.map((match, index) => <button key={match.id} type="button" className="vd-game" aria-pressed={String(match.id) === selectedId} onClick={() => onSelect(String(match.id))}>
      <span className="vd-game-top"><span>{t("Partie {0}", [index + 1])}</span><span>{match.duration || "—"}</span></span>
      <strong data-result={resultTone(match.result)}>{match.result === "Victoire" ? <Check aria-hidden="true" /> : match.result === "Défaite" ? <X aria-hidden="true" /> : <Flag aria-hidden="true" />}{resultLabel(match.result)}</strong>
      <span className="vd-game-name">{matchDisplayName(match)}</span>
    </button>)}
  </div>;
}

function Objectives({ snapshot }) {
  // A recorded zero is useful; a missing objective is never rendered as zero.
  const objectives = OBJECTIVES.filter(({ key }) => ["dragons", "barons", "towers"].includes(key) || Number.isFinite(snapshot.facts[key]?.ally) || Number.isFinite(snapshot.facts[key]?.enemy));
  return <Surface className="vd-objectives" variant="glass">
    <div className="vd-objectives-heading"><h4>{t("Objectifs")}</h4><span className="vd-objectives-key" aria-hidden="true"><span>{t("Nous")}</span><i>/</i><span>{t("Eux")}</span></span></div>
    <dl className="vd-objective-list" style={{ "--vd-objective-count": objectives.length }}>{objectives.map((objective) => {
        const fact = snapshot.facts[objective.key];
        return <div key={objective.key}><dt><ObjectiveImage objectiveKey={objective.key} /><span>{t(objective.label)}</span></dt>
          <dd><span data-team="ALLY"><span className="sr-only">{t("Notre équipe")} : </span>{number(fact?.ally)}</span><i aria-hidden="true">/</i><span data-team="ENEMY"><span className="sr-only">{t("Adversaires")} : </span>{number(fact?.enemy)}</span></dd></div>;
      })}</dl>
    {objectives.some(({ key }) => !snapshot.facts[key]?.available) && <p className="vd-objective-missing">{t("— : donnée absente")}</p>}
  </Surface>;
}

function StaffFocus({ focus }) {
  const keep = typeof focus?.keep === "string" ? focus.keep.trim() : "";
  const action = typeof focus?.action === "string" ? focus.action.trim() : "";
  if (!keep && !action) return null;
  return <section className="vd-staff-focus" aria-label={t("Décisions de l’équipe")} data-count={Number(Boolean(keep)) + Number(Boolean(action))}>
    {keep && <div><h4><CheckCheck aria-hidden="true" />{t("À garder")}</h4><p>{keep}</p></div>}
    {action && <div className="vd-staff-action"><h4><Crosshair aria-hidden="true" />{t("Prochaine partie")}</h4><p>{action}</p></div>}
  </section>;
}

function Actor({ actor, execution = false }) {
  if (!actor) return <span className="vd-actor vd-actor-unknown"><span className="vd-actor-portrait"><Swords aria-hidden="true" /></span><span>{execution ? t("Exécution") : t("Participant inconnu")}</span></span>;
  return <span className="vd-actor"><span className="vd-actor-portrait"><ChampionPortrait champion={actor.champion} alt={championDisplayName(actor.champion) || t("Champion inconnu")} /></span>
    <span><strong>{championDisplayName(actor.champion) || t("Champion inconnu")}</strong><small>{playerName(actor.name)}</small></span></span>;
}

function MomentDialog({ moments, momentId, onSelect, onClose, triggerRef }) {
  const id = useId();
  const index = moments.findIndex((moment) => moment.id === momentId);
  const moment = moments[index];
  if (!moment) return null;
  const previous = () => { if (index > 0) onSelect(moments[index - 1].id); };
  const next = () => { if (index < moments.length - 1) onSelect(moments[index + 1].id); };
  return <ModalDialog returnFocusRef={triggerRef} onClose={onClose} aria-labelledby={`${id}-title`} className="visual-debrief-modal" onKeyDown={(event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    if (event.key === "ArrowRight") { event.preventDefault(); next(); }
  }}>
    <header className="vd-modal-header"><div><p>{t("Moment clé")} · {t("{0} sur {1}", [index + 1, moments.length])}</p><h3 id={`${id}-title`}>{momentTitle(moment)}</h3></div><Button type="button" variant="ghost" icon={X} onClick={onClose} autoFocus>{t("Fermer")}</Button></header>
    <div className="vd-modal-body">
      <div className="vd-moment-hero" data-team={moment.teamKey || "UNKNOWN"}>
        <div className="vd-moment-illustration">{moment.kind === "fight" ? <Swords aria-hidden="true" /> : <ObjectiveImage objectiveKey={moment.objectiveKey} />}</div>
        <div><span className="vd-moment-clock">{clock(moment.timestamp)}{moment.endTimestamp > moment.timestamp ? ` – ${clock(moment.endTimestamp)}` : ""}</span>
          <p>{moment.kind === "fight" ? t("Éliminations pendant ce combat") : teamLabel(moment.teamKey)}</p>
          {moment.kind === "fight" && <div className="vd-moment-score"><span><b>{number(moment.allyKills)}</b>{t("Notre équipe")}</span><i aria-hidden="true">:</i><span><b>{number(moment.enemyKills)}</b>{t("Adversaires")}</span></div>}
        </div>
      </div>
      {moment.kind === "fight" && <ol className="vd-event-list" aria-label={t("Événements du combat")}>{moment.events.map((event, eventIndex) => <li key={event.id || `${event.timestamp}-${eventIndex}`} data-team={event.teamKey || "UNKNOWN"}>
        <time>{clock(event.timestamp)}</time><div className="vd-event-players"><Actor actor={event.killer} execution={event.isExecution} /><span className="vd-event-arrow"><ArrowRight aria-hidden="true" /><span className="sr-only">{t("a éliminé")}</span></span><Actor actor={event.victim} /></div>
        {event.assists?.length > 0 && <div className="vd-event-assists"><span>{t("Assistances")}</span><div>{event.assists.map((actor, assistIndex) => <span key={actor.participantId || assistIndex}><ChampionPortrait champion={actor.champion} alt={`${championDisplayName(actor.champion) || t("Champion inconnu")} · ${playerName(actor.name)}`} /></span>)}</div></div>}
      </li>)}</ol>}
      {moment.kind !== "fight" && <div className="vd-objective-event"><span>{moment.kind === "building" ? t("Bâtiment détruit") : t("Objectif sécurisé")}</span><strong>{teamLabel(moment.teamKey)}</strong>{moment.events[0]?.killer && <Actor actor={moment.events[0].killer} />}</div>}
      {(moment.allyKills === null || moment.enemyKills === null) && moment.kind === "fight" && <p className="vd-data-note">{t("Certains événements ne peuvent pas être attribués à une équipe.")}</p>}
      <p className="vd-modal-source">{t("Faits enregistrés dans la chronologie de la partie.")}</p>
      <span className="sr-only" role="status" aria-live="polite">{t("Moment à {0} : {1}", [clock(moment.timestamp), momentTitle(moment)])}</span>
    </div>
    <footer className="vd-modal-footer"><Button type="button" variant="ghost" icon={ArrowLeft} aria-disabled={index === 0} onClick={previous}>{t("Précédent")}</Button><span>{t("{0} sur {1}", [index + 1, moments.length])}</span><Button type="button" variant="ghost" aria-disabled={index === moments.length - 1} onClick={next}>{t("Suivant")}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Button></footer>
  </ModalDialog>;
}

function Moments({ match, snapshot }) {
  const data = useMemo(() => buildDebriefMoments(match, snapshot), [match, snapshot]);
  const [momentId, setMomentId] = useState(null);
  const triggerRef = useRef(null);
  return <section className="vd-moments" aria-label={t("Moments clés")}>
    <div className="vd-section-title"><h4>{t("Moments clés")}</h4>{data.moments.length > 0 && <span>{data.totalMoments > data.moments.length ? t("{0} moments sélectionnés", [data.moments.length]) : t("À ouvrir pour revoir les faits")}</span>}</div>
    {data.moments.length ? <div className="vd-moment-grid">{data.moments.map((moment) => <button key={moment.id} type="button" className="vd-moment-button" data-team={moment.teamKey || "UNKNOWN"} aria-haspopup="dialog" onClick={(event) => { triggerRef.current = event.currentTarget; setMomentId(moment.id); }}>
      <span className="vd-moment-icon">{moment.kind === "fight" ? <Swords aria-hidden="true" /> : <ObjectiveImage objectiveKey={moment.objectiveKey} />}</span>
      <span className="vd-moment-copy"><time>{clock(moment.timestamp)}</time><strong>{momentTitle(moment)}</strong><span>{moment.kind === "fight" ? t("{0} – {1} éliminations", [number(moment.allyKills), number(moment.enemyKills)]) : teamLabel(moment.teamKey)}</span></span><ArrowRight className="vd-moment-open" aria-hidden="true" />
    </button>)}</div> : <div className="vd-moments-empty"><Clock3 aria-hidden="true" /><span>{data.coverage === "missing" || data.coverage === "milestones" ? t("Les événements de cette partie ne sont pas disponibles.") : t("Aucun combat groupé ni objectif exploitable dans la chronologie.")}</span></div>}
    {(data.partial || data.hasUnattributedEvents) && <p className="vd-data-note">{t("Chronologie incomplète : seuls les faits disponibles sont affichés.")}</p>}
    {momentId && <MomentDialog moments={data.moments} momentId={momentId} onSelect={setMomentId} onClose={() => setMomentId(null)} triggerRef={triggerRef} />}
  </section>;
}

function Session({ matches, team, categories, focus, selectedId, onSelect, onOpenMatch }) {
  const match = matches.find((item) => String(item.id) === selectedId) || matches[0];
  const snapshot = useMemo(() => buildGamePublicationSnapshot({ match, team, categories }), [match, team, categories]);
  const actualId = String(match.id);
  const result = snapshot.context.result;
  return <>
    <h3 className="vd-title"><Clock3 aria-hidden="true" />{t("En 10 secondes")}</h3>
    <GamePicker matches={matches} selectedId={actualId} onSelect={onSelect} />
    <div className="vd-context"><div><Badge tone={result === "Victoire" ? "green" : result === "Défaite" ? "red" : "slate"}>{resultLabel(result)}</Badge><span><Clock3 aria-hidden="true" />{snapshot.context.duration || t("Durée inconnue")}</span><span>{snapshot.context.allySide === "blue" ? t("Côté bleu") : snapshot.context.allySide === "red" ? t("Côté rouge") : t("Côté inconnu")}</span></div>
      <div className="vd-context-actions">{Number.isFinite(snapshot.facts.kills.ally) && Number.isFinite(snapshot.facts.kills.enemy) && <span className="vd-score" aria-label={t("Éliminations : notre équipe {0}, adversaires {1}", [snapshot.facts.kills.ally, snapshot.facts.kills.enemy])}><Swords aria-hidden="true" /><b>{number(snapshot.facts.kills.ally)}</b><span>–</span><b>{number(snapshot.facts.kills.enemy)}</b></span>}
        {onOpenMatch && <Button type="button" variant="ghost" className="vd-open-match" icon={ArrowUpRight} onClick={() => onOpenMatch(actualId)}>{t("Voir la partie")}</Button>}</div>
    </div>
    <div className="vd-overview">
      <Surface variant="glass" className="vd-economy">
        <div className="vd-economy-heading"><div><h4><Coins aria-hidden="true" />{t("Écart d’or final")}</h4><span>{t("Notre équipe − adversaires")}</span></div><strong data-tone={snapshot.facts.gold.diff < 0 ? "negative" : snapshot.facts.gold.diff > 0 ? "positive" : "neutral"}>{signed(snapshot.facts.gold.diff)}</strong></div>
        <div className="vd-chart-wrap" title={`${snapshot.context.teamName} / ${snapshot.context.opponentName}`}><MatchGoldChart key={actualId} match={match} publication={snapshot} teamName={snapshot.context.teamName} /></div>
      </Surface>
      <Objectives snapshot={snapshot} />
    </div>
    <StaffFocus focus={focus} />
    <Moments key={actualId} match={match} snapshot={snapshot} />
    <ReadingDetails key={`players-${actualId}`} className="vd-players" title={<span className="vd-players-title"><Users aria-hidden="true" />{t("Les joueurs de la partie")}</span>}>
      <MatchLineups snapshot={snapshot} />
      <div className="vd-player-stats">{["ALLY", "ENEMY"].map((teamKey) => <div key={teamKey}><h5>{teamLabel(teamKey)}</h5><div className="vd-player-stat-head"><span>{t("Joueur")}</span><span>{t("Éliminations / morts / assistances")}</span></div>{snapshot.participants.filter((row) => row.teamKey === teamKey).map((row, index) => <div key={`${row.participantId}-${index}`} className="vd-player-stat"><span><RoleIcon role={row.role} className="vd-player-role" /><span>{playerName(row.name)}</span></span><strong>{number(row.kills)} / {number(row.deaths)} / {number(row.assists)}</strong></div>)}</div>)}</div>
    </ReadingDetails>
  </>;
}

function DebriefScope({ matches, ids, complete, loading, error, onRetry, team, categories, focus, initialMatchId, onOpenMatch }) {
  // The selected game survives a refresh, even while its data is unavailable.
  const [selectedId, setSelectedId] = useState(() => initialMatchId || ids[0]);
  return !complete || loading || error
    ? <Status loading={loading} error={error} missing={ids.length > 0} onRetry={onRetry} selectedId={selectedId} onOpenMatch={onOpenMatch} />
    : <Session matches={matches} team={team} categories={categories} focus={focus} selectedId={selectedId} onSelect={setSelectedId} onOpenMatch={onOpenMatch} />;
}

export function VisualDebrief({ matches = EMPTY, matchIds = EMPTY, team, categories = EMPTY, loading = false, error = "", onRetry, focus, initialMatchId, onOpenMatch }) {
  useLanguage();
  const ids = [...new Set(matchIds.map((id) => String(id ?? "")).filter(Boolean))];
  const byId = new Map(matches.filter((match) => match && (!team?.id || !match.team_id || String(match.team_id) === String(team.id))).map((match) => [String(match.id), match]));
  const linked = ids.map((id) => byId.get(id)).filter(Boolean);
  const complete = linked.length === ids.length && ids.length > 0;
  const requestedId = ids.includes(String(initialMatchId)) ? String(initialMatchId) : null;
  const scope = JSON.stringify([team?.id || "", [...ids].sort(), requestedId]);
  return <section className="visual-debrief" aria-label={t("Bilan visuel du débrief")} aria-busy={loading || undefined}>
    <DebriefScope key={scope} ids={ids} complete={complete} matches={linked} team={team} categories={categories} focus={focus} loading={loading} error={error} onRetry={onRetry} initialMatchId={requestedId} onOpenMatch={onOpenMatch} />
  </section>;
}

export default VisualDebrief;
