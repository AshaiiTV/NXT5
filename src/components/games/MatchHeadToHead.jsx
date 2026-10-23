import React, { useId, useState } from "react";
import { Coins, Eye, Swords, ChevronDown, UserRound } from "lucide-react";
import { ROLES, canonicalRole } from "../../../shared/roles.js";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Badge, Button } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
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

export function MatchHeadToHead({ snapshot, selectedRole = "", onSelectRole, detailsId }) {
  const language = useLanguage();
  const titleId = useId();
  const [metricId, setMetricId] = useState("gold");
  const metric = METRICS.find((entry) => entry.id === metricId) || METRICS[0];
  const { teams, unresolved } = matchRoleSlots(snapshot);
  const rows = ROLES.map((role, index) => {
    const allySlot = teams.ALLY[index];
    const enemySlot = teams.ENEMY[index];
    const ally = measured(allySlot.row?.[metric.id]);
    const enemy = measured(enemySlot.row?.[metric.id]);
    return { role, allySlot, enemySlot, ally, enemy, diff: ally !== null && enemy !== null ? ally - enemy : null };
  });
  const maxDiff = Math.max(0, ...rows.map((row) => Math.abs(row.diff ?? 0)));
  const number = (value, signed = false) => value === null ? "—" : `${signed && value > 0 ? "+" : ""}${value.toLocaleString(getLocale(language), { maximumFractionDigits: 0 })}`;
  return <section className="match-head-to-head" aria-labelledby={titleId}>
    <div className="mhh-heading"><h4 id={titleId}>{t("Face-à-face")}</h4>
      <div className="mhh-metrics" role="group" aria-label={t("Statistique à comparer")}>
        {METRICS.map((entry) => <Button key={entry.id} type="button" variant="ghost" icon={entry.Icon} aria-pressed={metric.id === entry.id} onClick={() => setMetricId(entry.id)}>{t(entry.label)}</Button>)}
      </div>
    </div>
    <div className="mhh-teams"><TeamIdentity snapshot={snapshot} teamKey="ALLY" /><TeamIdentity snapshot={snapshot} teamKey="ENEMY" /></div>
    <p className="mhh-legend"><strong>{t(metric.title)}</strong><span>{t("Écart : notre équipe − adversaires")}</span></p>
    <ol className="mhh-rows">{rows.map(({ role, allySlot, enemySlot, ally, enemy, diff }) => {
      const available = diff !== null;
      const selectable = Boolean(onSelectRole && allySlot.row && enemySlot.row);
      const Row = onSelectRole ? "button" : "div";
      const width = available && maxDiff > 0 ? Math.abs(diff) / maxDiff * 50 : 0;
      const tone = !available ? "missing" : diff > 0 ? "positive" : diff < 0 ? "negative" : "equal";
      return <li key={role} data-role={role}>
        <Row className="mhh-row" data-tone={tone} data-selected={selectedRole === role || undefined}
          {...(onSelectRole ? { type: "button", disabled: !selectable, "aria-expanded": selectedRole === role, "aria-controls": selectable && detailsId ? detailsId : undefined, onClick: () => onSelectRole(selectedRole === role ? "" : role) } : {})}>
          <PlayerIdentity slot={allySlot} teamKey="ALLY" />
          <span className="mhh-role"><span aria-hidden="true"><RoleIcon role={role} /></span><strong>{role}</strong>{selectable && <ChevronDown aria-hidden="true" />}</span>
          <PlayerIdentity slot={enemySlot} teamKey="ENEMY" />
          <span className="mhh-comparison">
            <span className="mhh-values"><span><span className="sr-only">{t("Notre équipe")} : </span>{number(ally)}</span>
              <strong className="mhh-difference"><span className="sr-only">{t("Écart")} : </span>{number(diff, true)}</strong>
              <span><span className="sr-only">{t("Adversaires")} : </span>{number(enemy)}</span></span>
            <span className="mhh-track" aria-hidden="true"><span className="mhh-fill" style={{ width: `${width}%`, left: diff > 0 ? `${50 - width}%` : "50%" }} /></span>
            {!available && <span className="mhh-unavailable">{t("Comparaison indisponible")}</span>}
          </span>
        </Row>
      </li>;
    })}</ol>
    <p className="mhh-scale">{t("Même échelle pour les cinq rôles.")}{onSelectRole && <> {t("Sélectionne un rôle pour les détails.")}</>}</p>
    <UnresolvedParticipants rows={unresolved} />
  </section>;
}
