import React, { useId } from "react";
import { Coins, Eye, Swords, UserRound } from "lucide-react";
import { ROLES, canonicalRole } from "../../../shared/roles.js";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Badge } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName, HudIcon, itemIconSources, summonerSpellIconSources } from "../../pages/workspace/workspace-shared.jsx";
import { csAtMinute } from "../../utils/match-timeline.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import "./match-head-to-head.css";

const METRICS = [
  { id: "gold", label: "Or", title: "Or final", Icon: Coins },
  { id: "damage", label: "Dégâts", title: "Dégâts aux champions", Icon: Swords },
  { id: "vision", label: "Vision", title: "Score de vision", Icon: Eye },
];
const measured = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const readObject = (value) => {
  if (typeof value === "string") { try { return JSON.parse(value) || {}; } catch { return {}; } }
  return value && typeof value === "object" ? value : {};
};

/** A slot requires one unambiguous participant; never infer a role from its position. */
export function matchRoleSlots(snapshot) {
  const participants = Array.isArray(snapshot?.participants) ? snapshot.participants : [];
  const ids = new Map();
  for (const row of participants) {
    if (row.participantId) ids.set(row.participantId, (ids.get(row.participantId) || 0) + 1);
  }
  const assigned = new Set();
  const teams = Object.fromEntries(["ALLY", "ENEMY"].map((teamKey) => [teamKey, ROLES.map((role) => {
    const candidates = participants.filter((row) => row.teamKey === teamKey && canonicalRole(row.role) === role);
    const reliable = candidates.length === 1 && (!candidates[0].participantId || ids.get(candidates[0].participantId) === 1);
    if (reliable) assigned.add(candidates[0]);
    return { role, row: reliable ? candidates[0] : null, status: reliable ? "ready" : candidates.length ? "ambiguous" : "missing" };
  })]));
  return { teams, unresolved: participants.filter((row) => !assigned.has(row)) };
}

export function getMatchRolePairs(snapshot) {
  const { teams } = matchRoleSlots(snapshot);
  return ROLES.map((role, index) => ({ role, ally: teams.ALLY[index].row, enemy: teams.ENEMY[index].row }));
}

function teamName(snapshot, teamKey) {
  const name = teamKey === "ALLY" ? snapshot?.context?.teamName : snapshot?.context?.opponentName;
  const fallback = teamKey === "ALLY" ? "Notre équipe" : "Adversaires";
  return !name || name === fallback ? t(fallback) : name;
}

function TeamIdentity({ snapshot, teamKey }) {
  const side = teamKey === "ALLY" ? snapshot?.context?.allySide : snapshot?.context?.enemySide;
  const name = teamName(snapshot, teamKey);
  const relationship = teamKey === "ALLY" ? t("Notre équipe") : t("Adversaires");
  return <span className="mhh-team-identity">
    <strong>{name}</strong>
    <span className="mhh-team-meta">
      {name !== relationship && <span>{relationship}</span>}
      <Badge tone={side === "blue" ? "cyan" : side === "red" ? "red" : "slate"}>{side === "blue" ? t("Côté bleu") : side === "red" ? t("Côté rouge") : t("Côté inconnu")}</Badge>
    </span>
  </span>;
}

function missingLabel(slot) {
  return slot.status === "ambiguous" ? t("Rôle ambigu") : t("Joueur absent");
}

function SlotPortrait({ slot, className = "" }) {
  return <span className={`mhh-portrait ${className}`} data-status={slot.status}>
    {slot.row?.champion ? <ChampionPortrait champion={slot.row.champion} alt={championDisplayName(slot.row.champion)} /> : <UserRound aria-hidden="true" />}
  </span>;
}

function UnresolvedParticipants({ rows }) {
  if (!rows.length) return null;
  return <div className="mhh-unresolved">
    <strong>{t("Postes à confirmer")}</strong>
    <ul>{rows.map((row, index) => <li key={`${row.teamKey}-${row.participantId}-${index}`}>
      <span>{row.name === "Joueur inconnu" || !row.name ? t("Joueur inconnu") : row.name}</span>
      <span>{row.teamKey === "ALLY" ? t("Notre équipe") : row.teamKey === "ENEMY" ? t("Adversaires") : t("Équipe inconnue")}</span>
    </li>)}</ul>
  </div>;
}

export function MatchLineups({ snapshot }) {
  useLanguage();
  const { teams, unresolved } = matchRoleSlots(snapshot);
  return <section className="match-lineups" aria-label={t("Les deux compositions")}>
    <div className="ml-teams">{["ALLY", "ENEMY"].map((teamKey) => <div className="ml-team" key={teamKey} data-team={teamKey}>
      <TeamIdentity snapshot={snapshot} teamKey={teamKey} />
      <ol className="ml-slots">{teams[teamKey].map((slot) => <li key={slot.role} data-role={slot.role} data-status={slot.status}>
        <span className="ml-role"><span aria-hidden="true"><RoleIcon role={slot.role} /></span><span>{slot.role}</span></span>
        <SlotPortrait slot={slot} />
        <strong className="ml-champion" title={slot.row?.name || undefined}>{slot.row ? slot.row.champion ? championDisplayName(slot.row.champion) : t("Champion inconnu") : missingLabel(slot)}</strong>
      </li>)}</ol>
    </div>)}</div>
    <UnresolvedParticipants rows={unresolved} />
  </section>;
}

function PlayerIdentity({ slot, teamKey }) {
  const row = slot.row;
  return <span className={`mhh-player mhh-player-${teamKey.toLowerCase()}`}>
    <SlotPortrait slot={slot} />
    <span className="mhh-player-text"><strong>{row ? row.name === "Joueur inconnu" || !row.name ? t("Joueur inconnu") : row.name : missingLabel(slot)}</strong>
      <span>{row ? row.champion ? championDisplayName(row.champion) : t("Champion inconnu") : "—"}</span>
    </span>
  </span>;
}

function PlayerLoadout({ row }) {
  if (!row) return null;
  const name = !row.name || row.name === "Joueur inconnu" ? t("Joueur inconnu") : row.name;
  return <div className="mhh-loadout" aria-label={t("Équipements et sorts de {0}", [name])}>
    {(row.spells || []).filter((id) => Number.isFinite(id) && id > 0).map((id, index) => <HudIcon key={`spell-${index}`} sources={summonerSpellIconSources(id)} label={t("Sort {0}", [id])} fallback="—" emptyText="—" className="mhh-loadout-icon" />)}
    {[...(row.items || []), row.trinket].filter((id) => Number.isFinite(id) && id > 0).map((id, index) => <HudIcon key={`item-${index}`} sources={itemIconSources(id)} label={t("Objet {0}", [id])} fallback="—" emptyText="—" className="mhh-loadout-icon" />)}
  </div>;
}

export function MatchHeadToHead({ snapshot, match }) {
  const language = useLanguage();
  const titleId = useId();
  const { teams, unresolved } = matchRoleSlots(snapshot);
  const rows = ROLES.map((role, index) => ({ role, allySlot: teams.ALLY[index], enemySlot: teams.ENEMY[index] }));
  const difference = (ally, enemy) => ally !== null && enemy !== null ? ally - enemy : null;
  const scales = Object.fromEntries(METRICS.map(({ id }) => [id, Math.max(0, ...rows.map(({ allySlot, enemySlot }) => Math.abs(difference(measured(allySlot.row?.[id]), measured(enemySlot.row?.[id])) ?? 0)))]));
  const number = (value, signed = false) => value === null ? "—" : `${signed && value > 0 ? "+" : ""}${value.toLocaleString(getLocale(language), { maximumFractionDigits: 0 })}`;
  const kda = (row) => ["kills", "deaths", "assists"].map((key) => number(measured(row?.[key]))).join(" / ");
  const raw = readObject(match?.raw);
  const frames = [raw.timeline?.info, raw.metadata?.timeline?.info, raw.timeline, raw.timeline?.timeline?.info, raw.timeline?.timeline].find((source) => Array.isArray(source?.frames) && source.frames.length)?.frames;
  const cs20 = (row) => {
    if (!row?.participantId || !match) return null;
    return measured(csAtMinute({ participantId: row.participantId, match: { ...match, raw: frames ? { ...raw, timeline: { info: { frames } } } : raw } }, 20));
  };
  const teamTotal = (teamKey, key) => {
    const players = snapshot.participants.filter((row) => row.teamKey === teamKey);
    if (players.length !== 5 || players.some((row) => measured(row[key]) === null || (row.participantId && snapshot.participants.filter((other) => other.participantId === row.participantId).length !== 1))) return null;
    const total = players.reduce((sum, row) => sum + row[key], 0);
    return Number.isFinite(total) ? total : null;
  };
  const share = (row, key) => {
    const total = row ? teamTotal(row.teamKey, key) : null;
    return measured(row?.[key]) === null || total === null || total === 0 ? "—" : `${number(row[key] / total * 100)} %`;
  };
  const teamValue = (teamKey, key) => <><span className="sr-only">{teamName(snapshot, teamKey)} : </span>{number(teamTotal(teamKey, key))}</>;
  const teamKda = (teamKey) => ["kills", "deaths", "assists"].map((key) => number(teamTotal(teamKey, key))).join(" / ");
  const secondary = [
    { id: "cs", label: "CS", value: (row) => number(measured(row?.cs)) },
    { id: "cs10", label: "CS à 10 min", value: (row) => number(measured(row?.cs10)) },
    { id: "cs20", label: "CS à 20 min", value: (row) => number(cs20(row)) },
    { id: "participation", label: "Participation aux éliminations", value: (row) => measured(row?.participation) === null ? "—" : `${number(row.participation)} %` },
    { id: "damage-share", label: "Part des dégâts", value: (row) => share(row, "damage") },
    { id: "gold-share", label: "Part de l'or", value: (row) => share(row, "gold") },
    { id: "vision-share", label: "Part vision", value: (row) => share(row, "vision") },
    { id: "deaths-share", label: "Part des morts", value: (row) => share(row, "deaths") },
  ];
  return <section className="match-head-to-head" aria-labelledby={titleId}>
    <h4 id={titleId} className="sr-only">{t("Face-à-face")}</h4>
    <div className="mhh-teams"><TeamIdentity snapshot={snapshot} teamKey="ALLY" /><TeamIdentity snapshot={snapshot} teamKey="ENEMY" /></div>
    <div className="mhh-team-summary" aria-label={t("Totaux des équipes")}>
      <div className="mhh-secondary-values"><strong><span className="sr-only">{teamName(snapshot, "ALLY")} : </span>{teamKda("ALLY")}</strong><span aria-label={t("Éliminations / morts / assistances")}>K / D / A</span><strong><span className="sr-only">{teamName(snapshot, "ENEMY")} : </span>{teamKda("ENEMY")}</strong></div>
      <div className="mhh-stat-grid">{METRICS.map(({ id, title, Icon }) => <div key={id} data-team-metric={id}><span className="mhh-stat-title"><Icon aria-hidden="true" />{t(title)}</span><div className="mhh-values"><span>{teamValue("ALLY", id)}</span><strong className="mhh-difference">{number(difference(teamTotal("ALLY", id), teamTotal("ENEMY", id)), true)}</strong><span>{teamValue("ENEMY", id)}</span></div></div>)}</div>
    </div>
    <p className="mhh-legend">{t("Écart : notre équipe − adversaires")}</p>
    <ol className="mhh-rows">{rows.map(({ role, allySlot, enemySlot }) => <li key={role} data-role={role}>
      <div className="mhh-row">
        <div className="mhh-player-block"><PlayerIdentity slot={allySlot} teamKey="ALLY" /><PlayerLoadout row={allySlot.row} /></div>
        <span className="mhh-role"><span aria-hidden="true"><RoleIcon role={role} /></span><strong>{role}</strong></span>
        <div className="mhh-player-block mhh-player-block-enemy"><PlayerIdentity slot={enemySlot} teamKey="ENEMY" /><PlayerLoadout row={enemySlot.row} /></div>
        <div className="mhh-kda mhh-secondary-values" data-metric="kda"><strong><span className="sr-only">{teamName(snapshot, "ALLY")} : </span>{kda(allySlot.row)}</strong><span aria-label={t("Éliminations / morts / assistances")}>K / D / A</span><strong><span className="sr-only">{teamName(snapshot, "ENEMY")} : </span>{kda(enemySlot.row)}</strong></div>
        <div className="mhh-stat-grid">{METRICS.map(({ id, title, Icon }) => {
          const ally = measured(allySlot.row?.[id]);
          const enemy = measured(enemySlot.row?.[id]);
          const diff = difference(ally, enemy);
          const width = diff !== null && scales[id] > 0 ? Math.abs(diff) / scales[id] * 50 : 0;
          return <div key={id} className="mhh-comparison" data-metric={id} data-tone={diff === null ? "missing" : diff > 0 ? "positive" : diff < 0 ? "negative" : "equal"}>
            <span className="mhh-stat-title"><Icon aria-hidden="true" />{t(title)}</span>
            <span className="mhh-values"><span><span className="sr-only">{t("Notre équipe")} : </span>{number(ally)}</span><strong className="mhh-difference"><span className="sr-only">{t("Écart")} : </span>{number(diff, true)}</strong><span><span className="sr-only">{t("Adversaires")} : </span>{number(enemy)}</span></span>
            <span className="mhh-track" aria-hidden="true"><span className="mhh-fill" style={{ width: `${width}%`, left: diff > 0 ? `${50 - width}%` : "50%" }} /></span>
          </div>;
        })}</div>
        <div className="mhh-secondary-grid">{secondary.map(({ id, label, value }) => <div key={id} className="mhh-secondary-values" data-metric={id}><span><span className="sr-only">{teamName(snapshot, "ALLY")} : </span>{value(allySlot.row)}</span><span>{t(label)}</span><span><span className="sr-only">{teamName(snapshot, "ENEMY")} : </span>{value(enemySlot.row)}</span></div>)}</div>
      </div>
    </li>)}</ol>
    <p className="mhh-scale">{t("Même échelle pour les cinq rôles.")} {t("Un tiret indique une donnée indisponible.")}</p>
    <UnresolvedParticipants rows={unresolved} />
  </section>;
}
