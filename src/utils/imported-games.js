import { matchCategoryIds, matchDisplayName } from "./matches.js";
import { trendMatchTimestamp } from "./trends.js";

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
const dateFormats = [
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
];

/** Resolve the allied side without treating an unknown side as red. */
export function importedGameSide(match) {
  const ally = (match?.participants || []).find((row) => row.team_key === "ALLY");
  const teamId = Number(ally?.raw?.teamId ?? ally?.teamId);
  if (teamId === 100) return "blue";
  if (teamId === 200) return "red";
  const side = normalize(match?.side).trim();
  if (/\b(blue|bleu)\b/.test(side)) return "blue";
  if (/\b(red|rouge)\b/.test(side)) return "red";
  return "";
}

function positiveNumber(value) {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Unknown/empty durations remain null, including zero from incomplete imports. */
export function importedGameDurationSeconds(match) {
  const seconds = positiveNumber(match?.duration_seconds);
  if (seconds !== null) return seconds;
  const clock = String(match?.duration || "").trim().match(/^(?:(\d+):)?(\d+):([0-5]\d)$/);
  if (clock && (!clock[1] || Number(clock[2]) < 60)) {
    const duration = Number(clock[1] || 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    if (duration > 0) return duration;
  }
  return positiveNumber(match?.raw?.info?.gameDuration);
}

/** Use import metadata only; a played date does not establish an import date. */
export function importedGameImportTimestamp(match) {
  for (const value of [match?.imported_at, match?.created_at, match?.createdAt]) {
    const timestamp = trendMatchTimestamp({ date: value });
    if (timestamp !== null) return timestamp;
  }
  return null;
}

function searchableDates(match) {
  const values = [
    match?.game_date, match?.date, match?.created_at, match?.createdAt, match?.imported_at,
    match?.raw?.info?.gameStartTimestamp, match?.raw?.info?.gameCreation,
  ];
  return values.flatMap((value) => {
    if (value == null || value === "") return [];
    const timestamp = trendMatchTimestamp({ date: value });
    return timestamp === null ? [String(value)] : [String(value), ...dateFormats.map((format) => format.format(timestamp))];
  });
}

function searchableText(match, categoryNames) {
  const participants = (match.participants || []).flatMap((row) => [
    row.summoner_name, row.riot_id, row.player_name, row.champion, row.role,
    row.raw?.summonerName, row.raw?.riotIdGameName, row.raw?.riotIdTagline,
    row.raw?.championName, row.raw?.teamPosition,
  ]);
  const side = importedGameSide(match);
  // Read only searchable metadata, never stringify potentially large raw timelines.
  return normalize([
    matchDisplayName(match), match.title, match.label, match.game_id, match.opponent,
    match.result, match.duration, match.patch, match.side,
    match.created_by_name, match.created_by_account,
    match.raw?.nxt5Label, match.raw?.label, match.raw?.opponent,
    match.raw?.metadata?.label, match.raw?.metadata?.opponent,
    side === "blue" ? "côté bleu blue" : side === "red" ? "côté rouge red" : "",
    ...participants, ...matchCategoryIds(match).map((id) => categoryNames.get(id)),
    ...searchableDates(match),
  ].filter((value) => value != null && value !== "").join(" "));
}

/** Filter the loaded history; sort copies only and keep unknown values last. */
export function filterImportedGames(matches = [], { query = "", result = "", review = "", side = "", category = "", sort = "newest" } = {}, categories = []) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const categoryNames = new Map(categories.map((category) => [String(category.id), category.name]));
  const categoryId = String(category ?? "").trim();
  const byDuration = sort === "longest" || sort === "shortest";
  const byImport = sort === "import-newest" || sort === "import-oldest";
  const valueForMatch = byDuration ? importedGameDurationSeconds : byImport ? importedGameImportTimestamp : trendMatchTimestamp;
  const ascending = sort === "oldest" || sort === "shortest" || sort === "import-oldest";
  return matches.map((match, index) => ({ match, index }))
    .filter(({ match }) => {
      if (categoryId) {
        const matchIds = matchCategoryIds(match);
        if (categoryId === "__uncategorized__" ? matchIds.length > 0 : !matchIds.includes(categoryId)) return false;
      }
      if (result && normalize(match.result).trim() !== normalize(result).trim()) return false;
      const reviewStatus = normalize(match.review_status || "todo").trim() === "done" ? "done" : "todo";
      if (review && reviewStatus !== review) return false;
      if (side && importedGameSide(match) !== side) return false;
      if (!words.length) return true;
      const text = searchableText(match, categoryNames);
      return words.every((word) => text.includes(word));
    })
    .map((entry) => ({ ...entry, value: valueForMatch(entry.match) }))
    .sort((a, b) => {
      if (a.value === b.value) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return ascending ? a.value - b.value : b.value - a.value;
    })
    .map(({ match }) => match);
}
