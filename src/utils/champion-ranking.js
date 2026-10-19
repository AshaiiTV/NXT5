import { championDisplayName } from "../../shared/champions.js";

const RANKING_CRITERIA = ["games", "winrate", "kda"];

function rankingNumber(value) {
  if (value === null || value === undefined || !["number", "string"].includes(typeof value) || (typeof value === "string" && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Rank the full champion context before applying a search, so its maxima stay stable. */
export function rankChampionMetrics(rows = [], criteria = ["games"], direction = "desc") {
  const selected = [...new Set((Array.isArray(criteria) ? criteria : []).filter((criterion) => RANKING_CRITERIA.includes(criterion)))];
  if (!selected.length) selected.push("games");
  const metrics = rows.map((row) => ({
    row,
    games: rankingNumber(row.games),
    winrate: rankingNumber(row.winrate),
    kda: rankingNumber(row.kda),
  }));
  const maxGames = metrics.reduce((maximum, metric) => Math.max(maximum, metric.games ?? 0), 0);
  const maxKda = metrics.reduce((maximum, metric) => Math.max(maximum, metric.kda ?? 0), 0);
  const contribution = (metric, criterion) => {
    if (criterion === "winrate") return Math.min(100, metric.winrate) / 100;
    const maximum = criterion === "games" ? maxGames : maxKda;
    return maximum ? metric[criterion] / maximum : 0;
  };
  return metrics.map((metric) => ({
    ...metric.row,
    rankingScore: selected.some((criterion) => metric[criterion] === null)
      ? null
      : selected.reduce((sum, criterion) => sum + contribution(metric, criterion), 0) / selected.length * 100,
  })).sort((left, right) => {
    if (left.rankingScore === null && right.rankingScore !== null) return 1;
    if (right.rankingScore === null && left.rankingScore !== null) return -1;
    const difference = left.rankingScore === null ? 0 : left.rankingScore - right.rankingScore;
    return (direction === "asc" ? difference : -difference)
      || championDisplayName(left.champion).localeCompare(championDisplayName(right.champion), "fr");
  });
}
