import React, { useId, useState } from "react";
import { ChevronDown, Coins, Eye, Swords, UserRound } from "lucide-react";
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

function TeamIdentity({ snapshot, teamKey, result = "" }) {
  const side = teamKey === "ALLY" ? snapshot?.context?.allySide : snapshot?.context?.enemySide;
  const name = teamName(snapshot, teamKey);
  const relationship = teamKey === "ALLY" ? t("Notre équipe") : t("Adversaires");
  return <span className="mhh-team-identity">
    <strong>{name}</strong>
    <span className="mhh-team-meta">
      {name !== relationship && <span>{relationship}</span>}
      <Badge tone={side === "blue" ? "side-blue" : side === "red" ? "side-red" : "slate"}>{side === "blue" ? t("Côté bleu") : side === "red" ? t("Côté rouge") : t("Côté inconnu")}</Badge>
      {result && <Badge tone={result === "Victoire" ? "green" : "slate"}>{t(result)}</Badge>}
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

function PlayerIdentity({ slot, side, kda, number }) {
  const row = slot.row;
  return <span className={`mhh-player mhh-player-${side || "unknown"}`}>
    <SlotPortrait slot={slot} />
    <span className="mhh-player-text"><strong>{row ? row.name === "Joueur inconnu" || !row.name ? t("Joueur inconnu") : row.name : missingLabel(slot)}</strong>
      <span className="mhh-player-champion">{row ? row.champion ? championDisplayName(row.champion) : t("Champion inconnu") : "—"}</span>
      <span className="mhh-player-stats"><span data-player-stat="kda"><span className="sr-only">{t("Éliminations / morts / assistances")} : </span>{kda(row)}</span><span data-player-stat="cs">{number(measured(row?.cs))} <span>CS</span></span></span>
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
  const detailsId = useId();
  const [details, setDetails] = useState(null);
  const { teams, unresolved } = matchRoleSlots(snapshot);
  const leftKey = snapshot?.context?.allySide === "red" ? "ENEMY" : "ALLY";
  const rightKey = leftKey === "ALLY" ? "ENEMY" : "ALLY";
  const leftSide = snapshot?.context?.allySide === "red" ? "blue" : snapshot?.context?.allySide || "unknown";
  const rightSide = snapshot?.context?.allySide === "red" ? "red" : snapshot?.context?.enemySide || "unknown";
  const rows = ROLES.map((role, index) => ({ role, leftSlot: teams[leftKey][index], rightSlot: teams[rightKey][index] }));
  const difference = (left, right) => left !== null && right !== null ? left - right : null;
  const number = (value, signed = false) => value === null ? "—" : `${signed && value > 0 ? "+" : ""}${value.toLocaleString(getLocale(language), { maximumFractionDigits: 0 })}`;
  const kda = (row) => ["kills", "deaths", "assists"].map((key) => number(measured(row?.[key]))).join("/");
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
  const secondary = [
    { id: "cs10", label: "CS à 10 min", value: (row) => number(measured(row?.cs10)) },
    { id: "cs20", label: "CS à 20 min", value: (row) => number(cs20(row)) },
    { id: "participation", label: "Participation aux éliminations", value: (row) => measured(row?.participation) === null ? "—" : `${number(row.participation)} %` },
    { id: "damage-share", label: "Part des dégâts", value: (row) => share(row, "damage") },
    { id: "gold-share", label: "Part de l'or", value: (row) => share(row, "gold") },
    { id: "vision-share", label: "Part vision", value: (row) => share(row, "vision") },
    { id: "deaths-share", label: "Part des morts", value: (row) => share(row, "deaths") },
  ];
  const selectedRole = details?.snapshot === snapshot && details?.match === match ? details.role : null;
  const teamValue = (teamKey, key) => number(teamTotal(teamKey, key));
  const teamKda = (teamKey) => ["kills", "deaths", "assists"].map((key) => number(teamTotal(teamKey, key))).join("/");
  const teamOutcome = (teamKey) => {
    const result = snapshot?.context?.result;
    if (result !== "Victoire" && result !== "Défaite") return "";
    return teamKey === "ALLY" ? result : result === "Victoire" ? "Défaite" : "Victoire";
  };
  const sideName = (side) => side === "blue" ? t("Côté bleu") : side === "red" ? t("Côté rouge") : t("Côté inconnu");
  const metricCell = (leftSlot, rightSlot, { id, label, title }) => {
    const left = measured(leftSlot.row?.[id]);
    const right = measured(rightSlot.row?.[id]);
    const diff = difference(left, right);
    const strength = diff === null || left + right === 0 ? 0 : Math.min(50, Math.abs(diff) / (left + right) * 50);
    return <div key={id} className="mhh-comparison" data-metric={id} data-tone={diff === null ? "missing" : diff === 0 ? "equal" : diff > 0 ? "left" : "right"}>
      <span className="mhh-mobile-metric-label">{t(label)}</span>
      <span className="sr-only">{t(title)} : {sideName(leftSide)} {number(left)}, {sideName(rightSide)} {number(right)}. {t("Écart")} {number(diff, true)}.</span>
      <div className="mhh-metric-pair" aria-hidden="true"><span>{number(left)}</span><span>{number(right)}</span></div>
      <span className="mhh-balance" aria-hidden="true"><span style={{ width: strength ? `max(4px, ${strength}%)` : 0 }} /></span>
      <span className="mhh-metric-gap" aria-hidden="true">{diff === null ? "—" : diff === 0 ? "=" : `${diff > 0 ? "←" : "→"} ${number(Math.abs(diff))}`}</span>
    </div>;
  };
  return <section className="match-head-to-head" aria-labelledby={titleId}>
    <header className="mhh-heading"><h4 id={titleId}>{t("Face-à-face")}</h4><p>{t("Cinq postes, deux équipes. Ouvrez les détails de chaque poste.")}</p></header>
    <div className="mhh-teams"><div data-side={leftSide}><TeamIdentity snapshot={snapshot} teamKey={leftKey} result={teamOutcome(leftKey)} /><span className="mhh-team-kda">{teamKda(leftKey)} <small>K / D / A</small></span></div><div data-side={rightSide}><TeamIdentity snapshot={snapshot} teamKey={rightKey} result={teamOutcome(rightKey)} /><span className="mhh-team-kda">{teamKda(rightKey)} <small>K / D / A</small></span></div></div>
    <div className="mhh-table-head" aria-hidden="true"><span>{t("Poste")}</span><span>{sideName(leftSide)}</span>{METRICS.map(({ id, label, title, Icon }) => <span key={id} title={t(title)}><Icon />{t(label)}</span>)}<span>{sideName(rightSide)}</span><span /></div>
    <ol className="mhh-rows">{rows.map(({ role, leftSlot, rightSlot }) => {
      const open = selectedRole === role;
      return <li key={role} data-role={role} data-open={open}>
        <div className="mhh-row">
          <span className="mhh-role"><span aria-hidden="true"><RoleIcon role={role} /></span><strong>{role}</strong></span>
          <PlayerIdentity slot={leftSlot} side={leftSide} kda={kda} number={number} />
          <div className="mhh-stat-grid">{METRICS.map((item) => metricCell(leftSlot, rightSlot, item))}</div>
          <PlayerIdentity slot={rightSlot} side={rightSide} kda={kda} number={number} />
          <button type="button" className="mhh-expand" aria-label={t("Repères du rôle {0}", [role])} aria-expanded={open} aria-controls={open ? `${detailsId}-${role}` : undefined} onClick={() => setDetails(open ? null : { role, snapshot, match })}><ChevronDown aria-hidden="true" /></button>
        </div>
        {open && <div className="mhh-details" id={`${detailsId}-${role}`}>
          <div className="mhh-details-intro"><strong>{t("Détails du poste {0}", [role])}</strong><span>{sideName(leftSide)} <span aria-hidden="true">·</span> {sideName(rightSide)}</span></div>
          <div className="mhh-secondary-grid">{secondary.map(({ id, label, value }) => <div key={id} className="mhh-secondary-values" data-metric={id}><span><span className="sr-only">{teamName(snapshot, leftKey)} : </span>{value(leftSlot.row)}</span><span>{t(label)}</span><span><span className="sr-only">{teamName(snapshot, rightKey)} : </span>{value(rightSlot.row)}</span></div>)}</div>
          <div className="mhh-loadouts"><div data-side={leftSide}><strong>{teamName(snapshot, leftKey)}</strong><PlayerLoadout row={leftSlot.row} /></div><div data-side={rightSide}><strong>{teamName(snapshot, rightKey)}</strong><PlayerLoadout row={rightSlot.row} /></div></div>
        </div>}
      </li>;
    })}</ol>
    <div className="mhh-totals"><strong>{t("Totaux d’équipe")}</strong>{METRICS.map(({ id, label }) => <span key={id} data-team-metric={id}><span>{t(label)}</span><b>{teamValue(leftKey, id)}</b><i aria-hidden="true">/</i><b>{teamValue(rightKey, id)}</b></span>)}</div>
    <p className="mhh-scale">{t("Les valeurs se lisent bleu puis rouge ; la flèche indique le côté devant.")} {t("Un tiret indique une donnée indisponible.")}</p>
    <UnresolvedParticipants rows={unresolved} />
  </section>;
}
