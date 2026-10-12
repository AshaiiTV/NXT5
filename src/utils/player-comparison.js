import { canonicalRole, ROLES } from "../../shared/roles.js";
import { importedGameDurationSeconds } from "./imported-games.js";
import { normalizeProfileKey, participantSources, participantStoredRaw, playerIntegratedRows, teamRows } from "../pages/workspace/workspace-shared.jsx";

const METRICS = ["kills", "deaths", "assists", "kda", "kp", "cs", "csPerMin", "vision", "visionPerMin", "damage", "damagePerMin", "gold", "goldPerMin"];
const ALIASES = {
  cs: ["cs", "creep_score", "total_cs"],
  csPerMin: ["cs_per_min", "csPerMin", "csPerMinute"],
  vision: ["vision", "vision_score", "visionScore"],
  visionPerMin: ["vision_per_min", "visionPerMin", "visionScorePerMinute"],
  damage: ["damage", "totalDamageDealtToChampions"],
  damagePerMin: ["damage_per_min", "damagePerMin", "damagePerMinute", "dpm"],
  gold: ["gold", "goldEarned"],
  goldPerMin: ["gold_per_min", "goldPerMin", "goldPerMinute"],
};

function measuredNumber(value) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function stat(row, key) {
  for (const source of participantSources(row)) {
    for (const alias of ALIASES[key] || [key]) {
      const value = measuredNumber(source[alias]);
      if (value !== null) return value;
    }
  }
  return null;
}

function identity(row) {
  const sources = participantSources(row);
  const text = (...keys) => sources.flatMap((source) => keys.map((key) => source[key])).find((value) => typeof value === "string" && value.trim())?.trim() || "";
  const gameName = text("riotIdGameName");
  const tag = text("riotIdTagline");
  const recordedRiotId = text("riot_id", "riotId");
  const fullRiotId = /^.+#[^#]+$/.test(recordedRiotId) ? recordedRiotId : gameName && tag ? `${gameName}#${tag}` : "";
  return {
    playerId: String(row.player_id ?? "").trim(),
    puuid: text("puuid"),
    riotId: fullRiotId || recordedRiotId,
    name: text("summoner_name", "summonerName", "player_name") || gameName,
  };
}

function identityKey(row) {
  const { playerId, puuid, riotId, name } = identity(row);
  if (playerId) return `player:${playerId}`;
  if (puuid) return `puuid:${puuid}`;
  if (riotId) return `riot:${normalizeProfileKey(riotId)}`;
  return name ? `name:${normalizeProfileKey(name)}` : "";
}

function accountKeys(row) {
  const { puuid, riotId } = identity(row);
  return [puuid ? `puuid:${puuid}` : "", riotId ? `riot:${normalizeProfileKey(riotId)}` : ""].filter(Boolean);
}

function normalizeMatches(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    if (!match || typeof match !== "object") return false;
    const key = String(match.id ?? "").trim() ? `id:${match.id}` : String(match.game_id ?? "").trim() ? `game:${match.game_id}` : match;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((match, matchIndex) => {
    const participantKeys = new Set();
    const participants = (Array.isArray(match.participants) ? match.participants : []).filter(Boolean).map((row, rowIndex) => {
      const known = identity(row);
      const normalized = { ...row, raw: participantStoredRaw(row), riot_id: known.riotId, summoner_name: known.name };
      const role = participantSources(normalized).map((source) => canonicalRole(source.role || source.teamPosition || source.individualPosition || source.lane)).find(Boolean) || "";
      return { ...normalized, role, comparisonRowKey: `${matchIndex}:${rowIndex}` };
    }).filter((row) => {
      const participantId = stat(row, "participantId");
      const participantKey = participantId !== null && participantId > 0 ? `participant:${participantId}` : identityKey(row);
      if (!participantKey) return true;
      const key = `${row.team_key}:${participantKey}`;
      if (participantKeys.has(key)) return false;
      participantKeys.add(key);
      return true;
    });
    // Give anonymous imported games distinct keys for the existing identity helper.
    return { ...match, id: match.id || match.game_id || `comparison-match:${matchIndex}`, raw: participantStoredRaw(match), participants, comparisonMatchIndex: matchIndex, comparisonSourceMatch: match };
  });
}

function durationSeconds(row) {
  const seconds = importedGameDurationSeconds(row.match);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  for (const value of [row.match.game_duration, ...participantSources(row).map((source) => source.timePlayed)]) {
    const known = measuredNumber(value);
    if (known !== null && known > 0) return known;
  }
  return null;
}

function creepScore(row) {
  const total = stat(row, "cs");
  if (total !== null) return total;
  const lane = stat(row, "totalMinionsKilled");
  const jungle = stat(row, "neutralMinionsKilled");
  return lane !== null && jungle !== null ? lane + jungle : null;
}

function participation(row, kills, assists) {
  const allies = teamRows(row.match);
  const killCounts = allies.map((ally) => stat(ally, "kills"));
  if (allies.length === 5 && killCounts.every((value) => value !== null) && kills !== null && assists !== null) {
    const total = killCounts.reduce((sum, value) => sum + value, 0);
    const value = total > 0 && Number.isFinite(total) ? measuredNumber((kills + assists) / total * 100) : null;
    return value !== null && value <= 100 ? value : null;
  }
  for (const source of participantSources(row)) {
    for (const key of ["kill_participation", "kp", "killParticipation"]) {
      const raw = source[key];
      const percent = typeof raw === "string" && raw.includes("%");
      const number = measuredNumber(percent ? raw.replace("%", "").trim() : raw);
      if (number === null) continue;
      const value = percent || number > 1 ? number : number * 100;
      if (value <= 100) return value;
    }
  }
  return null;
}

function observation(row) {
  const seconds = durationSeconds(row);
  const minutes = seconds === null ? null : seconds / 60;
  const kills = stat(row, "kills");
  const deaths = stat(row, "deaths");
  const assists = stat(row, "assists");
  const cs = creepScore(row);
  const vision = stat(row, "vision");
  const damage = stat(row, "damage");
  const gold = stat(row, "gold");
  const perMinute = (key, total) => stat(row, key) ?? (total !== null && minutes !== null ? measuredNumber(total / minutes) : null);
  return {
    kills, deaths, assists, cs, vision, damage, gold,
    kp: participation(row, kills, assists),
    csPerMin: perMinute("csPerMin", cs),
    visionPerMin: perMinute("visionPerMin", vision),
    damagePerMin: perMinute("damagePerMin", damage),
    goldPerMin: perMinute("goldPerMin", gold),
  };
}

function average(values) {
  const known = values.filter((value) => value !== null && Number.isFinite(value));
  // Incremental means avoid overflowing the sum of otherwise finite measurements.
  const value = known.length ? measuredNumber(known.reduce((mean, item, index) => mean + (item - mean) / (index + 1), 0)) : null;
  return { value, count: value === null ? 0 : known.length };
}

function dominantRole(rows, fallback) {
  const counts = new Map();
  for (const row of rows) if (row.role) counts.set(row.role, (counts.get(row.role) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || ROLES.indexOf(a[0]) - ROLES.indexOf(b[0]))[0]?.[0] || canonicalRole(fallback) || fallback || "";
}

/** Compare allied players on the supplied selection, with a separate sample size per metric. */
export function buildPlayerComparison(matches = [], players = []) {
  const normalized = normalizeMatches(matches);
  const entries = [];
  const candidates = new Map();
  const rosterIds = new Set();
  players.forEach((player, index) => {
    const id = player.id != null ? `roster:${player.id}` : player.riot_id ? `roster-riot:${normalizeProfileKey(player.riot_id)}` : `roster-index:${index}`;
    if (rosterIds.has(id)) return;
    rosterIds.add(id);
    const entry = { id, player, name: player.name || player.riot_id || "", rows: [] };
    entries.push(entry);
    // Identity remains authoritative when a player changes lane or fills in.
    for (const row of playerIntegratedRows({ ...player, role: "SUB" }, normalized)) {
      const score = row.player_id ? 3 : player.riot_id && normalizeProfileKey(row.riot_id) === normalizeProfileKey(player.riot_id) ? 2 : 1;
      if (score === 1 && row.riot_id && player.riot_id) continue;
      const list = candidates.get(row.comparisonRowKey) || [];
      list.push({ entry, score });
      candidates.set(row.comparisonRowKey, list);
    }
  });
  const records = normalized.flatMap((match) => teamRows(match).map((participant) => {
    const row = { ...participant, match };
    const possible = (candidates.get(row.comparisonRowKey) || []).sort((a, b) => b.score - a.score);
    const owner = possible.length && (possible.length === 1 || possible[0].score > possible[1].score) ? possible[0].entry : null;
    return { row, owner };
  }));
  const accountOwners = new Map();
  for (const { row, owner } of records) {
    if (!owner) continue;
    for (const key of accountKeys(row)) {
      if (!accountOwners.has(key)) accountOwners.set(key, new Set());
      accountOwners.get(key).add(owner);
    }
  }
  const imported = new Map();
  for (const record of records) {
    const { row } = record;
    let owner = record.owner;
    if (!owner && !row.player_id) {
      const accountMatches = new Set(accountKeys(row).flatMap((key) => [...(accountOwners.get(key) || [])]));
      if (accountMatches.size === 1) owner = [...accountMatches][0];
    }
    if (owner) {
      owner.rows.push(row);
      continue;
    }
    const key = identityKey(row);
    if (!key) continue; // A role or a champion cannot establish player identity.
    if (!imported.has(key)) {
      const known = identity(row);
      const entry = { id: `imported:${key}`, player: null, name: known.riotId || known.name, rows: [] };
      imported.set(key, entry);
      entries.push(entry);
    }
    imported.get(key).rows.push(row);
  }
  const comparison = entries.map((entry) => {
    const uniqueRows = [...new Map(entry.rows.map((row) => [row.match.comparisonMatchIndex, row])).values()];
    const observations = uniqueRows.map(observation);
    const kdaRows = observations.filter((item) => [item.kills, item.deaths, item.assists].every((value) => value !== null));
    const takedowns = kdaRows.reduce((sum, item) => sum + item.kills + item.assists, 0);
    const deaths = kdaRows.reduce((sum, item) => sum + item.deaths, 0);
    const kdaValue = kdaRows.length && Number.isFinite(takedowns) && Number.isFinite(deaths) ? measuredNumber(takedowns / Math.max(1, deaths)) : null;
    const kda = {
      value: kdaValue,
      count: kdaValue === null ? 0 : kdaRows.length,
    };
    const identities = uniqueRows.map(identity);
    const importedName = identities.find((item) => /^.+#[^#]+$/.test(item.riotId))?.riotId || identities.find((item) => item.riotId)?.riotId || identities.find((item) => item.name)?.name || "";
    return {
      id: entry.id, player: entry.player, name: entry.player ? entry.name || importedName : importedName,
      role: dominantRole(uniqueRows, entry.player?.role), games: uniqueRows.length,
      metrics: Object.fromEntries(METRICS.map((key) => [key, key === "kda" ? kda : average(observations.map((item) => item[key]))])),
      matches: uniqueRows.map((row) => row.match.comparisonSourceMatch),
    };
  }).sort((a, b) => (ROLES.indexOf(a.role) < 0 ? 99 : ROLES.indexOf(a.role)) - (ROLES.indexOf(b.role) < 0 ? 99 : ROLES.indexOf(b.role)) || a.name.localeCompare(b.name, "fr"));
  return { games: normalized.length, players: comparison };
}
