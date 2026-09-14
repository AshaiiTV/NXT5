function parseTimestamp(value) {
  if (value == null || value === "" || typeof value === "boolean") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "string" && !value.trim()) return null;
  const numeric = typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value).trim());
  const timestamp = numeric
    ? Number(value) * (Number(value) < 100_000_000_000 ? 1000 : 1)
    : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= 8.64e15 ? timestamp : null;
}

/** Prefer when the game was played; an import date is only a last resort. */
export function trendMatchTimestamp(match) {
  const candidates = [
    match?.raw?.info?.gameStartTimestamp,
    match?.raw?.info?.gameCreation,
    match?.game_date,
    match?.date,
    match?.created_at,
  ];
  for (const value of candidates) {
    const timestamp = parseTimestamp(value);
    if (timestamp !== null) return timestamp;
  }
  return null;
}

/** Returns a new array, newest first, retaining input order for ties/unknown dates. */
export function sortTrendMatches(matches = []) {
  return matches.map((match, index) => ({ match, index, timestamp: trendMatchTimestamp(match) }))
    .sort((a, b) => {
      if (a.timestamp === b.timestamp) return a.index - b.index;
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;
      return b.timestamp - a.timestamp;
    })
    .map(({ match }) => match);
}

export function hasTrendTimeline(match) {
  return [match?.raw, match].filter(Boolean).some((raw) => {
    const candidates = [
      raw.timeline?.info?.frames,
      raw.metadata?.timeline?.info?.frames,
      raw.timeline?.frames,
      raw.timelineFrames,
      raw.info?.timeline?.frames,
      raw.frames,
      raw.nxt5?.timelineEvents,
    ];
    return candidates.some((frames) => Array.isArray(frames) && frames.length > 0)
      || raw.nxt5?.timelineSummary?.available === true;
  });
}

function participantStat(row, key) {
  const riotKey = { gold: "goldEarned", vision: "visionScore", deaths: "deaths" }[key];
  for (const value of [row?.[key], row?.raw?.[key], row?.[riotKey], row?.raw?.[riotKey]]) {
    if (value == null || typeof value === "boolean" || (typeof value === "string" && !value.trim())) continue;
    if (typeof value !== "number" && typeof value !== "string") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function completeTeamTotal(match, team, key) {
  const rows = (Array.isArray(match?.participants) ? match.participants : []).filter((row) => row?.team_key === team);
  if (rows.length !== 5) return null;
  const values = rows.map((row) => participantStat(row, key));
  return values.every((value) => value !== null) ? values.reduce((total, value) => total + value, 0) : null;
}

function teamDifference(match, key) {
  const ally = completeTeamTotal(match, "ALLY", key);
  const enemy = completeTeamTotal(match, "ENEMY", key);
  return ally !== null && enemy !== null ? ally - enemy : null;
}

function knownResult(match) {
  const result = String(match?.result || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["victoire", "win", "victory"].includes(result)) return 100;
  if (["defaite", "loss", "defeat"].includes(result)) return 0;
  return null;
}

export const TREND_SERIES_METRICS = [
  { key: "gold", label: "Écart d’or", unit: "or", signed: true, description: "Or de ton équipe − or adverse, en fin de game. Au-dessus de zéro : ton équipe termine avec plus d’or." },
  { key: "deaths", label: "Morts de l’équipe", unit: "morts", signed: false, description: "Total des morts de tes cinq joueurs en fin de game. Une valeur plus basse signifie moins de morts." },
  { key: "vision", label: "Écart de vision", unit: "pts de vision", signed: true, description: "Score de vision de ton équipe − score adverse, en fin de game. Au-dessus de zéro : ton équipe a le score le plus élevé." },
];

/** Every selected game, oldest first. Unknown dates remain accessible outside the curve. */
export function buildTrendSeries(matches = [], metricKey = "gold") {
  const metric = TREND_SERIES_METRICS.find(({ key }) => key === metricKey) || TREND_SERIES_METRICS[0];
  const occurrences = new Map();
  const points = matches.map((match, sourceIndex) => {
    const identity = match?.id ?? match?.game_id;
    const base = identity == null ? `row:${sourceIndex}` : `game:${identity}`;
    const occurrence = occurrences.get(base) || 0;
    occurrences.set(base, occurrence + 1);
    return {
      key: `${base}:${occurrence}`,
      match,
      sourceIndex,
      timestamp: trendMatchTimestamp(match),
      value: metric.key === "deaths" ? completeTeamTotal(match, "ALLY", "deaths") : teamDifference(match, metric.key),
      result: knownResult(match),
    };
  }).sort((a, b) => {
    if (a.timestamp === b.timestamp) return a.sourceIndex - b.sourceIndex;
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return a.timestamp - b.timestamp;
  });
  const dated = points.filter(({ timestamp }) => timestamp !== null);
  const undated = points.filter(({ timestamp }) => timestamp === null);
  // Start a new segment after each missing value. A singleton is a point, never a line.
  const segments = [];
  let segment = [];
  for (const point of dated) {
    if (point.value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else {
      segment.push(point);
    }
  }
  if (segment.length) segments.push(segment);
  return { metric, points, dated, undated, segments, availableCount: dated.filter(({ value }) => value !== null).length };
}

function averageMetric(matches, valueForMatch) {
  const values = matches.map(valueForMatch).filter((value) => value !== null);
  return { value: values.length ? values.reduce((total, value) => total + value, 0) / values.length : null, count: values.length };
}

/** Compare consecutive, equally sized blocks; absent data never becomes zero. */
export function buildTrendEvolution(matches = []) {
  const dated = sortTrendMatches(matches).filter((match) => trendMatchTimestamp(match) !== null);
  const size = Math.min(5, Math.floor(dated.length / 2));
  if (size < 2) return { recent: [], previous: [], size: 0, metrics: [] };
  const recent = dated.slice(0, size);
  const previous = dated.slice(size, size * 2);
  const definitions = [
    { key: "wr", label: "Winrate", unit: "pts", inverse: false, value: knownResult },
    { key: "gold", label: "Écart d’or / game", unit: "or", inverse: false, value: (match) => teamDifference(match, "gold") },
    { key: "deaths", label: "Morts / game", unit: "morts", inverse: true, value: (match) => completeTeamTotal(match, "ALLY", "deaths") },
    { key: "vision", label: "Écart vision / game", unit: "pts", inverse: false, value: (match) => teamDifference(match, "vision") },
  ];
  const metrics = definitions.map(({ value, ...definition }) => {
    const current = averageMetric(recent, value);
    const prior = averageMetric(previous, value);
    return {
      ...definition,
      current: current.value,
      previous: prior.value,
      delta: current.value !== null && prior.value !== null ? current.value - prior.value : null,
      count: current.count,
      previousCount: prior.count,
    };
  });
  return { recent, previous, size, metrics };
}
