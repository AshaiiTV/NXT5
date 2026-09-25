/** Stable database key; the original champion spelling remains available for display. */
export function championKey(value) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const ROLE_ALIASES = {
  TOP: "TOP", JGL: "JGL", JUNGLE: "JGL", MID: "MID", MIDDLE: "MID",
  ADC: "ADC", BOTTOM: "ADC", BOT: "ADC", SUP: "SUP", SUPPORT: "SUP", UTILITY: "SUP",
};

export function normalizeMatchupRole(value) {
  return ROLE_ALIASES[String(value ?? "").trim().toUpperCase()] || "";
}

/** A duel needs one unambiguous opponent at the recorded role, never an array-index guess. */
export function strictOpponent(row) {
  const role = normalizeMatchupRole(row?.role);
  if (!role) return null;
  const participants = Array.isArray(row?.match?.participants) ? row.match.participants : [];
  const opponents = participants.filter((participant) => participant?.team_key === "ENEMY" && normalizeMatchupRole(participant.role) === role);
  return opponents.length === 1 && championKey(opponents[0].champion) ? opponents[0] : null;
}

function nonnegativeNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function positiveId(value) {
  const number = nonnegativeNumber(value);
  return number !== null && number > 0 && Number.isInteger(number) ? number : null;
}

function storedRaw(row) {
  if (typeof row?.raw !== "string") return row?.raw || {};
  try { return JSON.parse(row.raw) || {}; } catch { return {}; }
}

function participantSources(row) {
  const raw = storedRaw(row);
  return [raw, raw.participant, raw.stats, raw.participant?.stats, row].filter(Boolean);
}

function participantId(row) {
  for (const source of participantSources(row)) {
    const id = positiveId(source.participantId);
    if (id !== null) return id;
  }
  return null;
}

function timelineFrames(match) {
  const raw = storedRaw(match);
  const candidates = [raw.timeline?.info?.frames, raw.metadata?.timeline?.info?.frames,
    raw.timeline?.frames, raw.timeline?.timeline?.info?.frames, raw.timeline?.timeline?.frames,
    raw.timelineFrames, raw.info?.timeline?.frames, raw.frames];
  return candidates.find((frames) => Array.isArray(frames) && frames.length) || [];
}

function durationMs(row) {
  const match = row?.match;
  const raw = storedRaw(match);
  for (const value of [raw.info?.gameDuration, match?.duration_seconds, match?.game_duration, ...participantSources(row).map((source) => source.timePlayed)]) {
    const seconds = nonnegativeNumber(value);
    if (seconds !== null) return seconds * 1000;
  }
  const parts = String(match?.duration ?? "").match(/^(\d+):([0-5]\d)$/);
  return parts ? (Number(parts[1]) * 60 + Number(parts[2])) * 1000 : null;
}

function frameCs(frame) {
  const lane = nonnegativeNumber(frame?.minionsKilled);
  const jungle = nonnegativeNumber(frame?.jungleMinionsKilled);
  return lane !== null && jungle !== null ? lane + jungle : null;
}

function difference(own, opponent) {
  return own !== null && opponent !== null ? own - opponent : null;
}

/** Both sides always use the same observation, at the target or within the following minute. */
function milestoneDifferences(row, minute) {
  const absent = { cs: null, gold: null, xp: null };
  const opponent = strictOpponent(row);
  const ownId = participantId(row);
  const enemyId = participantId(opponent);
  const target = minute * 60_000;
  const duration = durationMs(row);
  if (!opponent || ownId === null || enemyId === null || ownId === enemyId || (duration !== null && duration < target)) return absent;
  const frames = timelineFrames(row.match);
  if (!frames.length) {
    if (minute !== 10 && minute !== 20) return absent;
    const summaries = storedRaw(row.match).nxt5?.timelineSummary?.csMilestones;
    return { ...absent, cs: difference(nonnegativeNumber(summaries?.[String(ownId)]?.[`cs${minute}`]), nonnegativeNumber(summaries?.[String(enemyId)]?.[`cs${minute}`])) };
  }
  const frame = frames.filter((item) => {
    const timestamp = nonnegativeNumber(item?.timestamp);
    return timestamp !== null && timestamp >= target && timestamp <= target + 60_000 && (duration === null || timestamp <= duration);
  }).sort((a, b) => Number(a.timestamp) - Number(b.timestamp))[0];
  const own = frame?.participantFrames?.[String(ownId)];
  const enemy = frame?.participantFrames?.[String(enemyId)];
  if (!own || !enemy) return absent;
  return {
    cs: difference(frameCs(own), frameCs(enemy)),
    gold: difference(nonnegativeNumber(own.totalGold), nonnegativeNumber(enemy.totalGold)),
    xp: difference(nonnegativeNumber(own.xp), nonnegativeNumber(enemy.xp)),
  };
}

function knownResult(row) {
  const result = String(row?.match?.result ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["victoire", "win", "victory"].includes(result)) return true;
  if (["defaite", "loss", "defeat"].includes(result)) return false;
  return null;
}

function resultsFor(rows) {
  const results = rows.map(knownResult).filter((value) => value !== null);
  const wins = results.filter(Boolean).length;
  return { wins, losses: results.length - wins, count: results.length, rate: results.length ? 100 * wins / results.length : null };
}

function mean(values) {
  const known = values.filter((value) => value !== null);
  return { value: known.length ? known.reduce((total, value) => total + value, 0) / known.length : null, count: known.length };
}

export function notebookStats(rows = []) {
  return {
    results: resultsFor(rows),
    milestones: [10, 15, 20].map((minute) => {
      const observations = rows.map((row) => milestoneDifferences(row, minute));
      return { minute, cs: mean(observations.map((value) => value.cs)), gold: mean(observations.map((value) => value.gold)), xp: mean(observations.map((value) => value.xp)) };
    }),
  };
}

/** Input rows belong to one player/champion; role remains part of each duel's identity. */
export function buildMatchups(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const opponent = strictOpponent(row);
    if (!opponent) continue;
    const role = normalizeMatchupRole(row.role);
    const opponentKey = championKey(opponent.champion);
    const key = `${role}|${opponentKey}`;
    const group = groups.get(key) || { key, opponentChampion: opponent.champion, opponentKey, role, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, games: group.rows.length, results: resultsFor(group.rows), cs10: mean(group.rows.map((row) => milestoneDifferences(row, 10).cs)) }))
    .sort((a, b) => b.games - a.games || a.opponentChampion.localeCompare(b.opponentChampion) || a.role.localeCompare(b.role));
}

/** Normalize Riot perk pages and the LCU's flat perk fields without inventing absent choices. */
export function participantRunes(row) {
  const sources = participantSources(row);
  const perks = sources.map((source) => source.perks).find((value) => value && typeof value === "object" && !Array.isArray(value));
  const styles = Array.isArray(perks?.styles) ? perks.styles : [];
  // Named pages can be partial or reordered. Positional fallback is reserved
  // for older pages with no named styles, so a secondary tree never fills a
  // missing primary tree (or the reverse).
  const hasNamedStyles = styles.some((style) => ["primaryStyle", "subStyle"].includes(style?.description));
  const primary = styles.find((style) => style?.description === "primaryStyle") || (!hasNamedStyles ? styles[0] : undefined);
  const secondary = styles.find((style) => style?.description === "subStyle") || (!hasNamedStyles ? styles[1] : undefined);
  const flatId = (...keys) => {
    for (const source of sources) {
      for (const key of keys) {
        const id = positiveId(source[key]);
        if (id !== null) return id;
      }
    }
    return null;
  };
  const selections = styles.flatMap((style) => Array.isArray(style?.selections) ? style.selections : []).map((selection) => positiveId(selection?.perk)).filter((id) => id !== null);
  const statPerks = perks?.statPerks;
  const shards = [statPerks?.offense, statPerks?.flex, statPerks?.defense].map(positiveId).filter((id) => id !== null);
  return {
    primaryStyle: positiveId(primary?.style) ?? flatId("perkPrimaryStyle"),
    secondaryStyle: positiveId(secondary?.style) ?? flatId("perkSubStyle"),
    selections: selections.length ? selections : Array.from({ length: 6 }, (_, index) => flatId(`perk${index}`)).filter((id) => id !== null),
    shards: shards.length ? shards : Array.from({ length: 3 }, (_, index) => flatId(`statPerk${index}`)).filter((id) => id !== null),
  };
}

export function skillOrder(row) {
  const id = participantId(row);
  if (id === null) return [];
  const frames = timelineFrames(row?.match);
  const raw = storedRaw(row?.match);
  const events = frames.length ? frames.flatMap((frame) => Array.isArray(frame?.events) ? frame.events : []) : raw.nxt5?.timelineEvents;
  return (Array.isArray(events) ? events : [])
    .filter((event) => event?.type === "SKILL_LEVEL_UP" && positiveId(event.participantId) === id && (!event.levelUpType || event.levelUpType === "NORMAL"))
    .map((event) => ({ slot: positiveId(event.skillSlot), timestamp: nonnegativeNumber(event.timestamp) }))
    .filter((event) => event.slot !== null && event.slot <= 4 && event.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}
