import { availableNumber } from "./statistics.js";
import { canonicalRole } from "../../shared/roles.js";

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => {
  if (typeof value === "string") { try { return object(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};
const text = (value, limit = 160) => ["string", "number"].includes(typeof value) ? String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit) : "";
const teamKey = (value) => ["ALLY", "ENEMY"].includes(value) ? value : null;
const opposite = (value) => value === "ALLY" ? "ENEMY" : value === "ENEMY" ? "ALLY" : null;
const positiveId = (value) => {
  const number = availableNumber(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};
const sourcesFor = (row) => {
  const raw = object(row?.raw);
  return [object(row), raw, object(raw.participant), object(raw.stats), object(raw.participant?.stats)];
};
const numbersFor = (row, key) => [...new Set(sourcesFor(row).map((source) => availableNumber(source[key])).filter((value) => value !== null))];
const firstText = (rows, keys) => rows.flatMap((row) => sourcesFor(row).flatMap((source) => keys.map((key) => text(source[key])))).find(Boolean) || "";

function participantIndex(match, raw, snapshot) {
  const combined = new Map();
  const blocked = new Set();
  // Copies across stored, Riot and publication data describe the same person;
  // duplicate identities within any one source cannot be resolved safely.
  for (const rows of [list(snapshot?.participants), list(match?.participants), list(raw.info?.participants)]) {
    const seen = new Set();
    for (const row of rows) {
      const ids = numbersFor(row, "participantId").filter((id) => positiveId(id) !== null);
      if (ids.length !== 1) { ids.forEach((id) => blocked.add(id)); continue; }
      const id = ids[0];
      if (seen.has(id)) blocked.add(id);
      seen.add(id);
      if (!combined.has(id)) combined.set(id, []);
      combined.get(id).push(row);
    }
  }
  const entries = new Map();
  const bindings = new Map();
  for (const [id, rows] of combined) {
    if (blocked.has(id)) continue;
    const teamIds = [...new Set(rows.flatMap((row) => numbersFor(row, "teamId")))];
    const labels = [...new Set(rows.flatMap((row) => [teamKey(row?.teamKey), teamKey(row?.team_key)]).filter(Boolean))];
    const conflicting = teamIds.length > 1 || labels.length > 1;
    const physicalTeam = teamIds.length === 1 && [100, 200].includes(teamIds[0]) ? teamIds[0] : null;
    const key = !conflicting && labels.length === 1 ? labels[0] : null;
    const participant = {
      participantId: id,
      champion: firstText(rows, ["champion", "championName"]),
      name: firstText(rows, ["name", "player_name", "summoner_name", "riot_id", "riotIdGameName", "summonerName"]),
      role: canonicalRole(firstText(rows, ["role", "teamPosition", "individualPosition"])),
    };
    entries.set(id, { participant, key, physicalTeam, conflicting });
    if (physicalTeam && key) {
      if (!bindings.has(physicalTeam)) bindings.set(physicalTeam, new Set());
      bindings.get(physicalTeam).add(key);
    }
  }
  const known = [...bindings].filter(([, labels]) => labels.size === 1).map(([id, labels]) => [id, [...labels][0]]);
  const conflict = [...bindings.values()].some((labels) => labels.size > 1) || (known.length === 2 && known[0][1] === known[1][1]);
  const sides = conflict ? new Map() : new Map(known);
  if (!conflict && known.length === 1) sides.set(known[0][0] === 100 ? 200 : 100, opposite(known[0][1]));
  if (!bindings.size) {
    const side = text(snapshot?.context?.allySide || match?.side).toLowerCase();
    const allyId = /\b(blue|bleu)\b/.test(side) ? 100 : /\b(red|rouge)\b/.test(side) ? 200 : null;
    if (allyId) { sides.set(allyId, "ALLY"); sides.set(allyId === 100 ? 200 : 100, "ENEMY"); }
  }
  for (const entry of entries.values()) entry.key = conflict || entry.conflicting ? null : entry.key || sides.get(entry.physicalTeam) || null;
  return { entries, sides };
}

function timelineSource(raw) {
  const candidates = [raw.timeline?.info?.frames, raw.metadata?.timeline?.info?.frames, raw.timeline?.frames, raw.timeline?.timeline?.info?.frames, raw.timeline?.timeline?.frames];
  const frames = candidates.find((value) => Array.isArray(value) && value.length);
  if (frames) return { coverage: "detailed", events: frames.flatMap((frame) => list(frame?.events).map((event) => ({ event, frameTimestamp: frame?.timestamp }))) };
  // Legacy compact objective records are a fallback, never a second copy of
  // the detailed or compact timeline. No generated summaries become events.
  const compact = list(raw.nxt5?.timelineEvents);
  const events = compact.length ? compact : list(raw.nxt5?.objectiveEvents);
  return { coverage: events.length ? "events" : raw.nxt5?.timelineSummary?.available ? "milestones" : "missing", events: events.map((event) => ({ event })) };
}

const objectiveKeyFor = (event) => event?.type === "BUILDING_KILL" && event.buildingType === "TOWER_BUILDING" ? "towers"
  : event?.type === "ELITE_MONSTER_KILL" ? ({ DRAGON: "dragons", BARON_NASHOR: "barons", RIFTHERALD: "heralds", HORDE: "grubs" }[text(event.monsterType).toUpperCase()] || null) : null;

function attributedTeam(event, killer, sides) {
  if (event.type === "CHAMPION_KILL") return killer?.key || null;
  const explicit = availableNumber(event.killerTeamId);
  const owner = event.type === "BUILDING_KILL" ? sides.get(availableNumber(event.teamId)) : null;
  const explicitKey = explicit !== null ? sides.get(explicit) || null : null;
  const ownerOpponent = opposite(owner);
  const candidates = [killer?.key, explicitKey, ownerOpponent].filter(Boolean);
  if (new Set(candidates).size > 1) return null;
  // An explicit but invalid team ID cannot be repaired by guessing a side.
  if (event.killerTeamId !== undefined && ![100, 200].includes(explicit)) return null;
  return candidates[0] || null;
}

function normalizeEvent(event, timestamp, id, index, conflict = false) {
  const killerId = availableNumber(event.killerId);
  const victimId = positiveId(event.victimId);
  const killer = Number.isSafeInteger(killerId) && killerId > 0 && !conflict ? index.entries.get(killerId) : null;
  const victim = index.entries.get(victimId);
  const assists = [...new Set(list(event.assistingParticipantIds).map(positiveId).filter((value) => value !== null && value !== killerId && value !== victimId))]
    .map((value) => index.entries.get(value)?.participant).filter(Boolean);
  const attributed = conflict ? null : attributedTeam(event, killer, index.sides);
  const consistentTeam = event.type === "CHAMPION_KILL" && attributed && attributed === victim?.key ? null : attributed;
  return {
    id, type: event.type, timestamp, objectiveKey: objectiveKeyFor(event),
    teamKey: consistentTeam, victimTeamKey: victim?.key || null,
    killerId: Number.isSafeInteger(killerId) && killerId >= 0 ? killerId : null,
    victimId, isExecution: event.type === "CHAMPION_KILL" && killerId === 0 && !conflict,
    killer: killer?.participant || null, victim: victim?.participant || null, assists,
  };
}

function combatMoment(events) {
  const killsKnown = events.every((event) => event.teamKey || event.isExecution);
  const deathsKnown = events.every((event) => event.victimTeamKey);
  const count = (key, value) => events.filter((event) => event[key] === value).length;
  const allyKills = killsKnown ? count("teamKey", "ALLY") : null;
  const enemyKills = killsKnown ? count("teamKey", "ENEMY") : null;
  return {
    id: `fight:${events[0].id}`, kind: "fight", timestamp: events[0].timestamp, endTimestamp: events.at(-1).timestamp,
    teamKey: !killsKnown || allyKills === enemyKills ? null : allyKills > enemyKills ? "ALLY" : "ENEMY", objectiveKey: null,
    allyKills, enemyKills, allyDeaths: deathsKnown ? count("victimTeamKey", "ALLY") : null, enemyDeaths: deathsKnown ? count("victimTeamKey", "ENEMY") : null, events,
  };
}

/**
 * Up to six observed moments, never tactical diagnoses. Combat windows use the
 * publication model's <=24s gap between consecutive eliminations (minimum two).
 * Selection prioritizes Nashors, larger combats, dragons, then other objectives
 * and towers; tied moments prefer the later event. The selected set is returned
 * chronologically. totalMoments discloses omitted candidates to the UI.
 */
export function buildDebriefMoments(match = {}, snapshot = {}) {
  if (snapshot?.entityId && match?.id && String(snapshot.entityId) !== String(match.id)
    || snapshot?.teamId && match?.team_id && String(snapshot.teamId) !== String(match.team_id)) snapshot = {};
  const raw = object(match?.raw);
  const source = timelineSource(raw);
  const index = participantIndex(match, raw, snapshot);
  const unique = new Map();
  let partial = false;
  for (const { event, frameTimestamp } of source.events) {
    if (!event || !["CHAMPION_KILL", "ELITE_MONSTER_KILL", "BUILDING_KILL"].includes(event.type)) continue;
    if (event.type !== "CHAMPION_KILL" && !objectiveKeyFor(event)) continue;
    const timestamp = availableNumber(event.timestamp === undefined ? frameTimestamp : event.timestamp);
    if (timestamp === null || timestamp < 0) { partial = true; continue; }
    const identity = event.type === "CHAMPION_KILL" ? `${timestamp}:kill:${positiveId(event.victimId) ?? `unknown-${availableNumber(event.killerId) ?? "killer"}`}`
      : `${timestamp}:${event.type}:${objectiveKeyFor(event)}:${text(event.monsterSubType)}:${text(event.teamId)}:${text(event.laneType)}:${text(event.towerType)}${objectiveKeyFor(event) === "grubs" ? `:${text(event.position?.x)}:${text(event.position?.y)}` : ""}`;
    const signature = JSON.stringify([availableNumber(event.killerId), availableNumber(event.killerTeamId), [...new Set(list(event.assistingParticipantIds).map(positiveId).filter(Boolean))].sort((a, b) => a - b)]);
    if (unique.has(identity)) {
      const previous = unique.get(identity);
      if (previous.signature !== signature) { previous.conflict = true; partial = true; }
    } else unique.set(identity, { event, timestamp, signature, conflict: false });
  }
  const events = [...unique].map(([id, entry]) => normalizeEvent(entry.event, entry.timestamp, id, index, entry.conflict)).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const kills = events.filter((event) => event.type === "CHAMPION_KILL");
  const groups = [];
  for (const event of kills) {
    const previous = groups.at(-1);
    if (previous && event.timestamp - previous.at(-1).timestamp <= 24000) previous.push(event);
    else groups.push([event]);
  }
  const moments = groups.filter((group) => group.length >= 2).map(combatMoment);
  for (const event of events.filter((entry) => entry.type !== "CHAMPION_KILL")) moments.push({
    id: event.id, kind: event.type === "BUILDING_KILL" ? "building" : "objective", timestamp: event.timestamp, endTimestamp: event.timestamp,
    teamKey: event.teamKey, objectiveKey: event.objectiveKey,
    allyKills: null, enemyKills: null, allyDeaths: null, enemyDeaths: null, events: [event],
  });
  const hasUnattributedEvents = events.some((event) => !event.teamKey && !event.isExecution || event.type === "CHAMPION_KILL" && !event.victimTeamKey);
  const measuredDeaths = availableNumber(snapshot?.facts?.deaths?.ally);
  const measuredEnemyDeaths = availableNumber(snapshot?.facts?.deaths?.enemy);
  if (measuredDeaths !== null && measuredEnemyDeaths !== null && measuredDeaths + measuredEnemyDeaths > kills.length) partial = true;
  const priority = (moment) => moment.kind === "fight" ? 50 + Math.min(moment.events.length, 10) * 4
    : ({ barons: 90, dragons: 70, heralds: 45, grubs: 35, towers: 25 }[moment.objectiveKey] || 0);
  const selected = [...moments].sort((a, b) => priority(b) - priority(a) || b.timestamp - a.timestamp || a.id.localeCompare(b.id)).slice(0, 6)
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  return { moments: selected, totalMoments: moments.length, coverage: source.coverage, hasUnattributedEvents, partial: partial || hasUnattributedEvents };
}
