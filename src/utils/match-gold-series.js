import { availableNumber } from "./statistics.js";

const object = (value) => {
  if (typeof value === "string") {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return value && typeof value === "object" ? value : {};
};

function timelineSource(raw) {
  const candidates = [raw.timeline?.info, raw.metadata?.timeline?.info, raw.timeline, raw.timeline?.timeline?.info, raw.timeline?.timeline];
  return candidates.find((source) => Array.isArray(source?.frames) && source.frames.length) || null;
}

function durationMilliseconds(match, publication, raw) {
  for (const value of [publication?.context?.duration, match?.duration]) {
    const parts = /^(\d+):(\d{2})$/.exec(String(value || ""));
    if (parts && Number(parts[2]) < 60) return (Number(parts[1]) * 60 + Number(parts[2])) * 1000;
  }
  const seconds = availableNumber(raw.info?.gameDuration ?? match?.game_duration);
  return seconds !== null && seconds > 0 ? seconds * 1000 : null;
}

/**
 * Actual Riot gold samples, oriented to our team. Never extends a sample to the
 * end of the game or substitutes final participant gold for timeline gold.
 * A null sample or a missing frame interval starts a new line segment.
 */
export function buildMatchGoldSeries(match = {}, publication = {}) {
  const raw = object(match?.raw);
  const source = timelineSource(raw);
  const durationMs = durationMilliseconds(match, publication, raw);
  const empty = { points: [], segments: [], durationMs, domainEndMs: durationMs ?? 0, partial: false, lastTimestamp: null };
  if (!source) return { ...empty, status: "missing" };

  const participants = Array.isArray(publication?.participants) ? publication.participants : [];
  const ally = participants.filter((row) => row.teamKey === "ALLY");
  const enemy = participants.filter((row) => row.teamKey === "ENEMY");
  const ids = [...ally, ...enemy].map((row) => availableNumber(row.participantId));
  if (ally.length !== 5 || enemy.length !== 5 || ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== 10) {
    return { ...empty, status: "participants" };
  }

  const total = (frame, rows) => {
    const values = rows.map((row) => availableNumber(frame.participantFrames?.[String(row.participantId)]?.totalGold));
    if (!values.every((value) => value !== null && value >= 0)) return null;
    const sum = values.reduce((result, value) => result + value, 0);
    return Number.isFinite(sum) ? sum : null;
  };
  const byTimestamp = new Map();
  let invalidTimestamp = false;
  for (const frame of source.frames) {
    const timestamp = availableNumber(frame?.timestamp);
    if (timestamp === null || timestamp < 0) { invalidTimestamp = true; continue; }
    const allyGold = total(frame, ally);
    const enemyGold = total(frame, enemy);
    const point = allyGold !== null && enemyGold !== null ? { timestamp, ally: allyGold, enemy: enemyGold, diff: allyGold - enemyGold } : null;
    if (byTimestamp.has(timestamp)) {
      const previous = byTimestamp.get(timestamp);
      // Conflicting copies cannot establish which value was actually observed.
      if (!previous || !point || previous.ally !== point.ally || previous.enemy !== point.enemy) byTimestamp.set(timestamp, null);
    } else byTimestamp.set(timestamp, point);
  }

  const interval = availableNumber(source.frameInterval);
  const maxGap = (interval !== null && interval > 0 ? interval : 60000) * 1.5;
  const points = [];
  const segments = [];
  let segment = [];
  let partial = invalidTimestamp;
  for (const [timestamp, point] of [...byTimestamp].sort(([a], [b]) => a - b)) {
    const previous = segment.at(-1);
    if (!point || (previous && timestamp - previous.timestamp > maxGap)) {
      if (segment.length) segments.push(segment);
      segment = [];
      partial = true;
    }
    if (point) { points.push(point); segment.push(point); }
  }
  if (segment.length) segments.push(segment);
  const lastTimestamp = points.at(-1)?.timestamp ?? null;
  if (points.length && (points[0].timestamp > 0 || (durationMs !== null && durationMs - lastTimestamp > maxGap / 1.5))) partial = true;
  return {
    points, segments, durationMs, lastTimestamp, partial,
    domainEndMs: Math.max(durationMs ?? 0, lastTimestamp ?? 0),
    status: points.length ? "available" : "incomplete",
  };
}
