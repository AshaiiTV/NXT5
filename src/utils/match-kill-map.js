import { availableNumber } from "./statistics.js";

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => {
  if (typeof value === "string") { try { return object(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};
const participantId = (value) => {
  const id = availableNumber(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const teamKey = (value) => ["ALLY", "ENEMY"].includes(value) ? value : "UNKNOWN";
const opposite = (value) => value === "ALLY" ? "ENEMY" : value === "ENEMY" ? "ALLY" : "UNKNOWN";
const sourcesFor = (row) => {
  const raw = object(row?.raw);
  return [row, raw, raw.participant, raw.stats, raw.participant?.stats].filter(Boolean);
};
const valuesFor = (row, key) => [...new Set(sourcesFor(row).map((source) => availableNumber(source[key])).filter((value) => value !== null))];

function participantIndex(match, raw) {
  const stored = new Map();
  const original = new Map();
  const blocked = new Set();
  for (const [rows, index] of [[list(match?.participants), stored], [list(raw.info?.participants), original]]) {
    for (const row of rows) {
      const ids = valuesFor(row, "participantId").filter((id) => participantId(id) !== null);
      if (ids.length !== 1) { ids.forEach((id) => blocked.add(id)); continue; }
      const id = ids[0];
      if (index.has(id)) blocked.add(id);
      else index.set(id, row);
    }
  }
  const entries = new Map();
  for (const id of new Set([...stored.keys(), ...original.keys()])) {
    if (blocked.has(id)) continue;
    const row = stored.get(id) || original.get(id);
    const teamIds = [...new Set([...(stored.has(id) ? valuesFor(stored.get(id), "teamId") : []), ...(original.has(id) ? valuesFor(original.get(id), "teamId") : [])])];
    entries.set(id, { row, teamId: teamIds.length === 1 && [100, 200].includes(teamIds[0]) ? teamIds[0] : null, conflictingTeam: teamIds.length > 1, teamKey: teamKey(row.team_key) });
  }
  const bindings = new Map();
  for (const entry of entries.values()) {
    if (entry.teamId && entry.teamKey !== "UNKNOWN") {
      if (!bindings.has(entry.teamId)) bindings.set(entry.teamId, new Set());
      bindings.get(entry.teamId).add(entry.teamKey);
    }
  }
  const knownBindings = [...bindings].filter(([, keys]) => keys.size === 1).map(([id, keys]) => [id, [...keys][0]]);
  const conflictingBindings = [...bindings.values()].some((keys) => keys.size > 1)
    || (knownBindings.length === 2 && knownBindings[0][1] === knownBindings[1][1]);
  const side = String(match?.side || "").toLowerCase();
  const sideId = /\b(blue|bleu)\b/.test(side) ? 100 : /\b(red|rouge)\b/.test(side) ? 200 : null;
  const inferred = new Map(knownBindings);
  if (!conflictingBindings && knownBindings.length === 1) inferred.set(knownBindings[0][0] === 100 ? 200 : 100, opposite(knownBindings[0][1]));
  if (!bindings.size && sideId) { inferred.set(sideId, "ALLY"); inferred.set(sideId === 100 ? 200 : 100, "ENEMY"); }
  for (const entry of entries.values()) {
    entry.teamKey = entry.conflictingTeam || conflictingBindings ? "UNKNOWN" : entry.teamKey !== "UNKNOWN" ? entry.teamKey : inferred.get(entry.teamId) || "UNKNOWN";
  }
  return entries;
}

function timelineSource(raw) {
  // Same source priority as matchTimelineFrames, without importing the React
  // workspace module into this pure data utility. Never merge both copies.
  const candidates = [raw.timeline?.info?.frames, raw.metadata?.timeline?.info?.frames, raw.timeline?.frames, raw.timeline?.timeline?.info?.frames, raw.timeline?.timeline?.frames];
  const frames = candidates.find((value) => Array.isArray(value) && value.length);
  if (frames) return { available: true, events: frames.flatMap((frame) => list(frame?.events).map((event) => ({ event, frameTimestamp: frame?.timestamp }))) };
  const events = list(raw.nxt5?.timelineEvents);
  return { available: events.length > 0, events: events.map((event) => ({ event })) };
}

// Community map bounds for the uncropped Data Dragon map11 image, not an
// official Riot calibration: https://hextechdocs.dev/map-data/
const MAP_BOUNDS = { x: [-120, 14870], y: [-120, 14980] };
const coordinate = (value, axis) => {
  const number = availableNumber(value);
  const [min, max] = MAP_BOUNDS[axis];
  return number !== null && number >= min && number <= max ? number : null;
};

function finalCombatCount(match, raw) {
  const rows = list(match?.participants).length ? list(match.participants) : list(raw.info?.participants);
  const totals = ["kills", "deaths"].map((key) => rows.reduce((sum, row) => sum + Math.max(0, valuesFor(row, key)[0] || 0), 0));
  totals.push(list(raw.info?.teams).reduce((sum, team) => sum + Math.max(0, availableNumber(team?.objectives?.champion?.kills) || 0), 0));
  return Math.max(...totals);
}

/**
 * Exact CHAMPION_KILL positions only. x/y remain Cartesian in [0, 1]; the UI
 * flips y when drawing. counts describes plotted points, total recorded events,
 * and unplaced events lacking usable position/time (never estimated or clamped).
 * A missing map ID is accepted for historical Summoner's Rift imports.
 */
export function buildMatchKillMap(match = {}) {
  const raw = object(match?.raw);
  const mapValues = [raw.info?.mapId, raw.mapId, match?.map_id, match?.mapId].filter((value) => value !== null && value !== undefined && value !== "");
  const mapIds = [...new Set(mapValues.map(availableNumber))];
  const mapId = mapIds.length === 1 ? mapIds[0] : null;
  const empty = { points: [], total: 0, unplaced: 0, counts: { ALLY: 0, ENEMY: 0, UNKNOWN: 0 }, partial: false, mapId };
  if (mapValues.length && (mapIds.length !== 1 || mapId !== 11)) return { ...empty, status: "unsupported" };
  const source = timelineSource(raw);
  if (!source.available) return { ...empty, status: raw.nxt5?.timelineSummary?.available ? "unavailable" : "absent" };

  const participants = participantIndex(match, raw);
  const unique = new Map();
  for (const { event, frameTimestamp } of source.events) {
    if (event?.type !== "CHAMPION_KILL") continue;
    const timestamp = availableNumber(event.timestamp === undefined ? frameTimestamp : event.timestamp);
    const killerId = availableNumber(event.killerId);
    const victimId = participantId(event.victimId);
    const x = coordinate(event.position?.x, "x");
    const y = coordinate(event.position?.y, "y");
    const validTime = timestamp !== null && timestamp >= 0;
    const identity = validTime && killerId !== null && victimId !== null ? `${timestamp}:${killerId}:${victimId}` : `unresolved:${unique.size}`;
    const previous = unique.get(identity);
    if (previous) {
      // Repeated frames may contain the same event. Conflicting coordinates
      // cannot establish a location; keep one unplaced event, not two kills.
      if (previous.x !== x || previous.y !== y) previous.conflict = true;
      continue;
    }
    unique.set(identity, { event, timestamp, killerId, victimId, x, y, validTime, conflict: false });
  }
  const points = [];
  for (const [identity, kill] of unique) {
    if (kill.conflict || !kill.validTime || kill.x === null || kill.y === null) continue;
    const killer = participants.get(kill.killerId);
    const victim = participants.get(kill.victimId);
    const assistants = [...new Set(list(kill.event.assistingParticipantIds).map(participantId).filter((id) => id !== null && id !== kill.killerId && id !== kill.victimId))]
      .map((id) => participants.get(id)?.row).filter(Boolean);
    points.push({
      id: `${match?.id || match?.game_id || "match"}:${identity}`,
      timestamp: kill.timestamp, x: (kill.x + 120) / 14990, y: (kill.y + 120) / 15100,
      killerId: kill.killerId,
      teamKey: killer?.teamKey || "UNKNOWN", killer: killer?.row || null, victim: victim?.row || null, assistants,
    });
  }
  points.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const total = unique.size;
  const unplaced = total - points.length;
  const missingEvents = finalCombatCount(match, raw) > total;
  const counts = points.reduce((result, point) => { result[point.teamKey] += 1; return result; }, { ALLY: 0, ENEMY: 0, UNKNOWN: 0 });
  return { points, total, unplaced, counts, partial: unplaced > 0 || missingEvents, mapId,
    status: points.length ? "ready" : total || missingEvents ? "unavailable" : "empty" };
}
