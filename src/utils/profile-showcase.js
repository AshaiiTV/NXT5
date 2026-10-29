import { getLocale } from "../i18n/locale.js";
import { t } from "../i18n/translate.js";
import { canonicalChampion } from "../../shared/champions.js";
import { canonicalRole } from "../../shared/roles.js";
import { importedGameDurationSeconds } from "./imported-games.js";
import { matchDisplayName } from "./matches.js";
import { pngNumeric } from "./png-report.js";

const dateFormat = () => new Intl.DateTimeFormat(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
const aliases = {
  damage: ["damage", "totalDamageDealtToChampions"],
  vision: ["vision", "visionScore"],
  csPerMin: ["cs_per_min", "csPerMin"],
  damagePerMin: ["damage_per_min", "damagePerMinute", "dpm"],
  cs: ["cs", "creep_score", "total_cs"],
};

function rawObject(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return value && typeof value === "object" ? value : {};
}

function sources(row) {
  const raw = rawObject(row?.raw);
  return [row, raw, raw.stats, raw.participant, raw.participant?.stats].filter(Boolean);
}

function measuredNumber(value) {
  if (typeof value === "string" && value.includes("%")) return null;
  const number = pngNumeric(value);
  return number !== null && number >= 0 ? number : null;
}

function stat(row, field) {
  for (const source of sources(row)) {
    for (const key of aliases[field] || [field]) {
      const value = measuredNumber(source[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function duration(row) {
  const match = row?.match || {};
  const normalized = { ...match, raw: rawObject(match.raw) };
  const seconds = importedGameDurationSeconds(normalized);
  if (seconds !== null) return seconds;
  for (const value of [match.game_duration, ...sources(row).map((source) => source.timePlayed)]) {
    const known = measuredNumber(value);
    if (known !== null && known > 0) return known;
  }
  return null;
}

function participation(row) {
  for (const source of sources(row)) {
    for (const key of ["kill_participation", "kp", "killParticipation"]) {
      const raw = source[key];
      const known = pngNumeric(raw);
      if (known === null || known < 0 || known > 100) continue;
      const value = typeof raw === "string" && raw.includes("%") ? known : known <= 1 ? known * 100 : known;
      return value;
    }
  }
  // Riot records the ratio in challenges in some complete match payloads.
  for (const source of sources(row)) {
    const value = measuredNumber(source.challenges?.killParticipation);
    if (value !== null && value <= 1) return value * 100;
  }
  return null;
}

function csPerMinute(row, seconds) {
  const recorded = stat(row, "csPerMin");
  if (recorded !== null) return recorded;
  if (seconds === null) return null;
  let cs = stat(row, "cs");
  if (cs === null) {
    const lane = stat(row, "totalMinionsKilled");
    const jungle = stat(row, "neutralMinionsKilled");
    if (lane === null || jungle === null) return null;
    cs = lane + jungle;
  }
  return cs / (seconds / 60);
}

function damagePerMinute(row, seconds) {
  const recorded = stat(row, "damagePerMin");
  if (recorded !== null) return recorded;
  const damage = stat(row, "damage");
  if (damage !== null && seconds !== null) return damage / (seconds / 60);
  for (const source of sources(row)) {
    const value = measuredNumber(source.challenges?.damagePerMinute);
    if (value !== null) return value;
  }
  return null;
}

function playedAt(row) {
  const match = row?.match || {};
  const raw = rawObject(match.raw);
  // An import timestamp cannot establish when a game was played.
  for (const candidate of [raw.info?.gameStartTimestamp, raw.info?.gameCreation, match.game_date, match.date]) {
    if (candidate === null || candidate === undefined || typeof candidate === "boolean") continue;
    if (typeof candidate === "string" && !candidate.trim()) continue;
    const timestamp = candidate instanceof Date ? candidate.getTime()
      : typeof candidate === "number" || /^\d+(?:\.\d+)?$/.test(String(candidate).trim())
        ? Number(candidate) * (Number(candidate) < 100_000_000_000 ? 1000 : 1)
        : Date.parse(String(candidate));
    if (Number.isFinite(timestamp) && timestamp > 0 && timestamp <= 8.64e15) return timestamp;
  }
  return null;
}

function result(row) {
  const label = String(row?.match?.result ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["victoire", "win", "victory"].includes(label)) return "win";
  if (["defaite", "loss", "defeat"].includes(label)) return "loss";
  return "unknown";
}

function results(observations) {
  const wins = observations.filter((entry) => entry.result === "win").length;
  const losses = observations.filter((entry) => entry.result === "loss").length;
  const known = wins + losses;
  return { wins, losses, unknown: observations.length - known, known, rate: known ? wins / known * 100 : null };
}

function average(values) {
  const known = values.filter((value) => value !== null && Number.isFinite(value));
  return { value: known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null, count: known.length };
}

function observation(row, index) {
  const seconds = duration(row);
  const kills = stat(row, "kills");
  const deaths = stat(row, "deaths");
  const assists = stat(row, "assists");
  const vision = stat(row, "vision");
  const timestamp = playedAt(row);
  return {
    row, index, seconds, timestamp, kills, deaths, assists, vision,
    champion: canonicalChampion(row?.champion),
    matchId: row?.match?.id == null ? "" : String(row.match.id),
    result: result(row),
    dateLabel: timestamp === null ? t("Date inconnue") : dateFormat().format(timestamp),
    kda: [kills, deaths, assists].every((value) => value !== null) ? (kills + assists) / Math.max(1, deaths) : null,
    csPerMin: csPerMinute(row, seconds),
    kp: participation(row),
    damagePerMin: damagePerMinute(row, seconds),
    visionPerMin: vision !== null && seconds !== null ? vision / (seconds / 60) : null,
  };
}

function evolution(observations, role) {
  const key = role === "SUP" ? "visionPerMin" : "csPerMin";
  const eligible = observations.filter((entry) => entry.timestamp !== null && entry[key] !== null)
    .sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
  const half = Math.floor(eligible.length / 2);
  if (half < 3) return null;
  const first = eligible.slice(0, half);
  const last = eligible.slice(half);
  // Identical game timestamps provide no chronological comparison.
  if (first[first.length - 1].timestamp >= last[0].timestamp) return null;
  const early = average(first.map((entry) => entry[key]));
  const recent = average(last.map((entry) => entry[key]));
  const period = (entries) => ({
    startDateLabel: entries[0].dateLabel,
    endDateLabel: entries[entries.length - 1].dateLabel,
  });
  return {
    key, label: role === "SUP" ? "Vision par minute" : "Sbires par minute",
    unit: role === "SUP" ? "vision / min" : "CS / min",
    early: { ...early, ...period(first) }, recent: { ...recent, ...period(last) }, delta: recent.value - early.value,
    series: eligible.map((entry) => ({ value: entry[key], dateLabel: entry.dateLabel, timestamp: entry.timestamp, matchId: entry.matchId })),
    count: eligible.length, excludedCount: observations.length - eligible.length,
    title: "Évolution sur la sélection",
  };
}

/** The input is already scoped to a player and context by PlayerUltimateProfile. */
export function buildProfileShowcase({ player = {}, rows = [], teamName = "", category = "", teammates = [] } = {}) {
  const observations = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === "object").map(observation);
  const games = observations.length;
  const role = canonicalRole(player?.role) || String(player?.role || "").trim().toUpperCase();
  const complete = observations.filter((entry) => entry.kda !== null);
  const sum = (key) => complete.length ? complete.reduce((total, entry) => total + entry[key], 0) : null;
  const totals = { kills: sum("kills"), deaths: sum("deaths"), assists: sum("assists"), count: complete.length };
  const groups = new Map();
  for (const entry of observations) {
    if (!entry.champion) continue;
    const key = entry.champion.toLowerCase();
    const group = groups.get(key) || { champion: entry.champion, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  const champions = [...groups.values()].map((group) => ({ champion: group.champion, games: group.entries.length, ...results(group.entries) }))
    .sort((a, b) => b.games - a.games || (b.rate ?? -1) - (a.rate ?? -1) || a.champion.localeCompare(b.champion, "fr"));
  const dates = observations.map((entry) => entry.timestamp).filter((value) => value !== null).sort((a, b) => a - b);
  const dateLabel = !dates.length ? t("Dates non renseignées")
    : dateFormat().format(dates[0]) === dateFormat().format(dates[dates.length - 1]) ? dateFormat().format(dates[0])
      : `${dateFormat().format(dates[0])} – ${dateFormat().format(dates[dates.length - 1])}`;
  const recentResults = observations.slice().sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0) || a.index - b.index).slice(-12)
    .map((entry) => ({ result: entry.result, matchId: entry.matchId, dateLabel: entry.dateLabel }));
  const victories = complete.filter((entry) => entry.result === "win");
  const best = (victories.length ? victories : complete).slice().sort((a, b) => b.kda - a.kda || (b.timestamp ?? 0) - (a.timestamp ?? 0) || a.index - b.index)[0];
  const highlight = best ? {
    matchId: best.matchId, champion: best.champion, result: best.result,
    title: matchDisplayName(best.row.match, t("Partie")), dateLabel: best.dateLabel,
    kills: best.kills, deaths: best.deaths, assists: best.assists, kda: best.kda,
    csPerMin: best.csPerMin, damagePerMin: best.damagePerMin, kp: best.kp,
    durationSeconds: best.seconds,
    selectionReason: victories.length ? "Meilleur KDA parmi les victoires renseignées" : "Meilleur KDA parmi les parties renseignées",
  } : null;
  const timed = observations.filter((entry) => entry.seconds !== null);
  const seenTeammates = new Set();
  const roster = (Array.isArray(teammates) ? teammates : []).flatMap((member) => {
    const name = String(member?.name || member?.riot_id || "").trim();
    const id = member?.id == null ? "" : String(member.id);
    const memberRole = canonicalRole(member?.role) || String(member?.role || "").trim().toUpperCase();
    const key = id || `${name}|${memberRole}`;
    if (!name || seenTeammates.has(key)) return [];
    seenTeammates.add(key);
    return [{ id, name, role: memberRole }];
  });
  return {
    playerId: player?.id == null ? "" : String(player.id),
    playerName: String(player?.name || player?.riot_id || t("Joueur")), role,
    teamName: String(teamName || t("Équipe")), contextLabel: String(category || t("Tous les contextes")),
    dateLabel, datedGames: dates.length, games,
    results: results(observations),
    metrics: {
      kda: { value: complete.length ? (totals.kills + totals.assists) / Math.max(1, totals.deaths) : null, count: complete.length },
      csPerMin: average(observations.map((entry) => entry.csPerMin)),
      kp: average(observations.map((entry) => entry.kp)),
      damagePerMin: average(observations.map((entry) => entry.damagePerMin)),
      vision: average(observations.map((entry) => entry.vision)),
    },
    totals,
    playTime: { seconds: timed.length ? timed.reduce((total, entry) => total + entry.seconds, 0) : null, count: timed.length },
    signature: champions[0] || null, champions,
    recentResults, recentResultsCount: recentResults.length,
    highlight, progression: evolution(observations, role),
    teammates: roster,
  };
}
