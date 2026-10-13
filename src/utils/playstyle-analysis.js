import { canonicalRole, ROLES } from "../../shared/roles.js";
import { MILESTONE_TOLERANCE_MS } from "../../shared/timeline-milestones.js";
import { importedGameDurationSeconds } from "./imported-games.js";
import { availableNumber } from "./statistics.js";

const ALIASES = {
  gold: ["gold", "goldEarned"], damage: ["damage", "totalDamageDealtToChampions"],
  vision: ["vision", "vision_score", "visionScore"], kills: ["kills"], deaths: ["deaths"], assists: ["assists"],
};
const object = (value) => {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return {}; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};
const sources = (row) => {
  const raw = object(row?.raw);
  return [row, raw, raw.participant, raw.stats, raw.participant?.stats].filter(Boolean);
};
const number = (value) => {
  const known = availableNumber(value);
  return known !== null && known >= 0 ? known : null;
};
const field = (row, keys) => {
  for (const source of sources(row)) for (const key of keys) {
    const known = number(source[key]);
    if (known !== null) return known;
  }
  return null;
};
const stat = (row, key) => field(row, ALIASES[key] || [key]);
const roleOf = (row) => sources(row).flatMap((source) => [source.role, source.teamPosition, source.individualPosition, source.lane]).map(canonicalRole).find(Boolean) || "";
const participantId = (row) => field(row, ["participantId"]);
const oneRole = (rows, role) => { const found = rows.filter((row) => roleOf(row) === role); return found.length === 1 ? found[0] : null; };

function uniqueIdentities(rows) {
  for (const key of ["participantId", "player_id", "puuid"]) {
    const identities = rows.map((row) => key === "participantId" ? participantId(row) : sources(row).map((source) => source[key]).find((value) => value != null && String(value).trim()));
    const known = identities.filter((value) => value != null && value !== 0).map(String);
    if (new Set(known).size !== known.length) return false;
  }
  return true;
}

const completeRows = (rows) => rows.length === 5 && uniqueIdentities(rows);

function total(rows, key) {
  if (!completeRows(rows)) return null;
  const values = rows.map((row) => stat(row, key));
  if (values.some((value) => value === null)) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Number.isFinite(sum) ? sum : null;
}

function timelineFrames(raw) {
  return [raw.timeline?.info?.frames, raw.metadata?.timeline?.info?.frames, raw.timeline?.frames,
    raw.timeline?.timeline?.info?.frames, raw.timeline?.timeline?.frames]
    .find((frames) => Array.isArray(frames) && frames.length) || [];
}

function teamId(rows, raw) {
  const ids = rows.map((row) => {
    const explicit = field(row, ["teamId"]);
    if (explicit === 100 || explicit === 200) return explicit;
    const id = participantId(row);
    return id > 0 ? number(raw.info?.participants?.find((item) => number(item.participantId) === id)?.teamId) : null;
  }).filter((id) => id === 100 || id === 200);
  return ids.length && new Set(ids).size === 1 ? ids[0] : null;
}

function frameTotal(rows, frame) {
  if (!completeRows(rows) || rows.some((row) => !(participantId(row) > 0))) return null;
  const values = rows.map((row) => number(frame?.participantFrames?.[String(participantId(row))]?.totalGold));
  return values.every((value) => value !== null) ? values.reduce((a, b) => a + b, 0) : null;
}

function cs10(row, frame, frames, raw, duration) {
  if (!row || (duration !== null && duration < 600)) return null;
  const id = participantId(row);
  if (!(id > 0)) return null;
  if (!frames.length) return number(raw.nxt5?.timelineSummary?.csMilestones?.[String(id)]?.cs10);
  const snapshot = frame?.participantFrames?.[String(id)];
  const lane = number(snapshot?.minionsKilled);
  const jungle = number(snapshot?.jungleMinionsKilled);
  return lane !== null && jungle !== null ? lane + jungle : null;
}

function participation(row, allyKills) {
  if (!row) return null;
  const kills = stat(row, "kills");
  const assists = stat(row, "assists");
  // No team kills means the ratio is undefined, even when a stored fallback says 0%.
  if (allyKills === 0) return null;
  if (allyKills !== null && kills !== null && assists !== null) {
    const value = (kills + assists) / allyKills * 100;
    return value <= 100 ? value : null;
  }
  for (const source of sources(row)) for (const key of ["kill_participation", "kp", "killParticipation"]) {
    const raw = source[key];
    const percent = typeof raw === "string" && raw.includes("%");
    const known = number(percent ? raw.replace("%", "").trim() : raw);
    if (known !== null) {
      const value = percent || known > 1 ? known : known * 100;
      if (value <= 100) return value;
    }
  }
  return null;
}

function objectiveCount(raw, id, keys) {
  if (id === null) return null;
  const teams = Array.isArray(raw.info?.teams) ? raw.info.teams.filter((team) => number(team.teamId) === id) : [];
  if (teams.length !== 1) return null;
  for (const key of keys) {
    const value = number(teams[0].objectives?.[key]?.kills);
    if (value !== null && Number.isInteger(value)) return value;
  }
  return null;
}

function observation(match) {
  const raw = object(match.raw);
  const rows = Array.isArray(match.participants) ? match.participants.filter(Boolean) : [];
  const ally = rows.filter((row) => row.team_key === "ALLY");
  const enemy = rows.filter((row) => row.team_key === "ENEMY");
  const distinctTeams = uniqueIdentities([...ally, ...enemy]);
  const duration = importedGameDurationSeconds({ ...match, raw });
  const minutes = duration !== null ? duration / 60 : null;
  const paired = (key) => { const a = total(ally, key); const b = total(enemy, key); return distinctTeams && a !== null && b !== null ? a - b : null; };
  const frames = timelineFrames(raw);
  const frame = frames.find((item) => number(item.timestamp) >= 600000 && number(item.timestamp) <= 600000 + MILESTONE_TOLERANCE_MS);
  const earlyAlly = duration !== null && duration < 600 ? null : frameTotal(ally, frame);
  const earlyEnemy = duration !== null && duration < 600 ? null : frameTotal(enemy, frame);
  const allyGold = total(ally, "gold");
  const allyDamage = total(ally, "damage");
  const allyKills = total(ally, "kills");
  const enemyKills = total(enemy, "kills");
  const allyId = teamId(ally, raw);
  const enemyId = teamId(enemy, raw);
  const knownIds = allyId !== null && enemyId !== null && allyId !== enemyId;
  const objectives = (keys, share = true) => {
    if (!knownIds) return null;
    const a = objectiveCount(raw, allyId, keys); const b = objectiveCount(raw, enemyId, keys);
    return a !== null && b !== null ? share ? a + b > 0 ? a / (a + b) * 100 : null : a - b : null;
  };
  const roles = ROLES.map((role) => {
    const row = oneRole(ally, role);
    const opposing = oneRole(enemy, role);
    const ownCs = cs10(row, frame, frames, raw, duration);
    const theirCs = cs10(opposing, frame, frames, raw, duration);
    const gold = row ? stat(row, "gold") : null;
    const damage = row ? stat(row, "damage") : null;
    const vision = row ? stat(row, "vision") : null;
    return { role, row,
      goldShare: allyGold > 0 && gold !== null ? gold / allyGold * 100 : null,
      damageShare: allyDamage > 0 && damage !== null ? damage / allyDamage * 100 : null,
      cs10Diff: distinctTeams && ownCs !== null && theirCs !== null ? ownCs - theirCs : null,
      kp: participation(row, allyKills),
      visionPerMin: vision !== null && minutes !== null ? vision / minutes : null,
      deaths: row ? stat(row, "deaths") : null,
    };
  });
  const allRoles = roles.every((role) => role.row && role.goldShare !== null);
  const sortedGold = allRoles ? roles.slice().sort((a, b) => b.goldShare - a.goldShare) : [];
  // Ties remain ties: participant order cannot manufacture a resource focus.
  const goldLeader = sortedGold.length && sortedGold[0].goldShare > sortedGold[1].goldShare ? sortedGold[0].role : null;
  return { match, roles, goldLeader, resourceAvailable: allRoles,
    gold10: distinctTeams && earlyAlly !== null && earlyEnemy !== null ? earlyAlly - earlyEnemy : null,
    fightPace: distinctTeams && allyKills !== null && enemyKills !== null && minutes !== null ? (allyKills + enemyKills) / minutes : null,
    deaths: total(ally, "deaths"), deathDiff: paired("deaths"),
    visionDiffPerMin: paired("vision") !== null && minutes !== null ? paired("vision") / minutes : null,
    dragonShare: objectives(["dragon"]), baronShare: objectives(["baron", "baronNashor"]), towerDiff: objectives(["tower", "towers"], false),
  };
}

function measure(observations, valueFor) {
  const values = observations.map((item) => ({ match: item.match, value: valueFor(item) })).filter((item) => Number.isFinite(item.value));
  const value = values.length ? values.reduce((mean, item, index) => mean + (item.value - mean) / (index + 1), 0) : null;
  return { value, count: values.length, positive: values.filter((item) => item.value > 0).length,
    negative: values.filter((item) => item.value < 0).length, equal: values.filter((item) => item.value === 0).length,
    observations: values, matches: values.map((item) => item.match) };
}

/** A product reading threshold, never a claim of statistical significance. */
export const repeatedPlaystyle = (count, total) => total >= 3 && count / total >= 2 / 3;

/** Observable facts only: missing participants/fields never contribute invented zeros. */
export function buildPlaystyleAnalysis(matches = [], players = []) {
  const seen = new Set();
  const selection = matches.filter((match) => {
    if (!match || typeof match !== "object") return false;
    const key = match.id != null && String(match.id).trim() ? `id:${match.id}` : match.game_id != null && String(match.game_id).trim() ? `game:${match.game_id}` : match;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const observations = selection.map(observation);
  const keys = ["gold10", "fightPace", "deaths", "deathDiff", "visionDiffPerMin", "dragonShare", "baronShare", "towerDiff"];
  const metrics = Object.fromEntries(keys.map((key) => [key, measure(observations, (item) => item[key])]));
  const roles = ROLES.map((role) => {
    const matching = observations.map((item) => ({ ...item.roles.find((value) => value.role === role), match: item.match }));
    return { role, games: matching.filter((item) => item.row).length,
      // Names are roster context only; these role totals can include substitutes.
      players: players.filter((player) => canonicalRole(player.role) === role).map((player) => player.name || player.riot_id).filter(Boolean),
      metrics: Object.fromEntries(["goldShare", "damageShare", "cs10Diff", "kp", "visionPerMin", "deaths"].map((key) => [key, measure(matching, (item) => item[key])])),
    };
  });
  const resourceGames = observations.filter((item) => item.resourceAvailable);
  const focusCounts = ROLES.map((role) => ({ role, count: resourceGames.filter((item) => item.goldLeader === role).length })).sort((a, b) => b.count - a.count || ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  const resourceFocus = focusCounts[0].count > 0 && focusCounts[0].count > focusCounts[1].count ? { ...focusCounts[0], total: resourceGames.length } : null;
  const metricsAvailable = Object.values(metrics).some((metric) => metric.count) || roles.some((role) => Object.values(role.metrics).some((metric) => metric.count));
  const early = metrics.gold10; const deaths = metrics.deathDiff; const vision = metrics.visionDiffPerMin;
  const dragons = metrics.dragonShare;
  const lowerDragonShare = dragons.observations.filter((item) => item.value < 50).length;
  const priority = repeatedPlaystyle(early.negative, early.count) ? "early"
    : repeatedPlaystyle(deaths.positive, deaths.count) ? "combat"
    : repeatedPlaystyle(vision.negative, vision.count) ? "vision"
    : repeatedPlaystyle(lowerDragonShare, dragons.count) ? "objectives"
    : resourceFocus && repeatedPlaystyle(resourceFocus.count, resourceFocus.total) ? "resources"
    : metricsAvailable ? "observe" : "data";
  return { matches: selection, games: selection.length, metrics, roles, resourceFocus,
    resourceGames: resourceGames.map((item) => item.match), resourceTies: resourceGames.filter((item) => item.goldLeader === null).length,
    lowerDragonShare, priority, metricsAvailable };
}
