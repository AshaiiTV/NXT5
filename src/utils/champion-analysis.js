import { canonicalChampion } from "../../shared/champions.js";
import { canonicalRole, normalizeRole, ROLES } from "../../shared/roles.js";
import { availableNumber, matchResult, resultSummary } from "./statistics.js";

const championKey = (value) => canonicalChampion(value).toLowerCase();
const rowRole = (row) => canonicalRole(row?.role || row?.raw?.teamPosition || row?.raw?.individualPosition || row?.raw?.lane);
const pickRole = (row) => rowRole(row) || normalizeRole(row?.role).trim() || "ROLE";
const pickKey = (row) => `${championKey(row?.champion)}|${pickRole(row)}`;

// Missing IDs must not make unrelated imported matches collapse into one source.
const matchKey = (match) => {
  const id = match?.id ?? match?.game_id ?? match?.match_id;
  return id === undefined || id === null || id === "" ? match : `${match.team_id || ""}|${id}`;
};
const summarize = (matches) => {
  // Every caller uses the unique draft index, including associations and signals.
  const summary = resultSummary(matches);
  return { ...summary, wr: summary.winrate, matches };
};
const ordered = (rows) => rows.sort((left, right) => right.games - left.games || right.known - left.known || String(left.champion || left.label || "").localeCompare(String(right.champion || right.label || ""), "fr"));
const append = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};
const prepareRow = (row) => {
  const champion = canonicalChampion(row?.champion);
  const role = rowRole(row);
  return { row, champion, role, key: `${champion.toLowerCase()}|${role || normalizeRole(row?.role).trim() || "ROLE"}` };
};

/** Observations from the selected team's drafts; five known results is a practical display threshold, not statistical certainty. */
export function buildChampionAnalysis(active = {}) {
  const draftMap = new Map();
  const draftsByPick = new Map();
  const draftsByRole = new Map(ROLES.map((role) => [role, []]));
  const comparableByRole = new Map(ROLES.map((role) => [role, []]));
  for (const entry of active?.matchDrafts || []) {
    if (!entry?.match) continue;
    const key = matchKey(entry.match);
    if (draftMap.has(key)) continue;
    const rows = Array.isArray(entry.rows) ? entry.rows : (entry.match.participants || []).filter((row) => row.team_key === "ALLY");
    const prepared = rows.map(prepareRow);
    const rowsByRole = new Map();
    const rowsByPick = new Map();
    const opponentsByRole = new Map();
    for (const row of prepared) {
      append(rowsByRole, row.role, row);
      append(rowsByPick, row.key, row);
    }
    for (const row of entry.match.participants || []) {
      if (row.team_key === "ENEMY") {
        const opponent = prepareRow(row);
        append(opponentsByRole, opponent.role, opponent);
      }
    }
    const complete = prepared.length === ROLES.length && rowsByRole.size === ROLES.length && prepared.every((row) => row.role && row.champion);
    const draft = { ...entry, key, rowsByRole, rowsByPick, opponentsByRole, complete };
    draftMap.set(key, draft);
    for (const pickId of rowsByPick.keys()) append(draftsByPick, pickId, draft);
    for (const role of ROLES) {
      const knownRows = (rowsByRole.get(role) || []).filter((row) => row.champion);
      if (knownRows.length) draftsByRole.get(role).push(draft);
      if (knownRows.length === 1) comparableByRole.get(role).push(draft);
    }
  }
  const drafts = [...draftMap.values()];
  const completeGames = drafts.filter((entry) => entry.complete).length;

  // Keep the existing tags and aggregates, but derive evidence counts from unique games.
  const pickMap = new Map();
  for (const pick of active?.picks || []) {
    if (!canonicalChampion(pick?.champion)) continue;
    const key = pickKey(pick);
    if (!pickMap.has(key)) pickMap.set(key, { ...pick, champion: canonicalChampion(pick.champion), role: pickRole(pick) });
  }
  const picks = ordered([...pickMap.entries()].map(([key, pick]) => {
    const entries = draftsByPick.get(key) || [];
    const summary = summarize(entries.map((entry) => entry.match));
    const selectedKeys = new Set(entries.map((entry) => entry.key));
    const role = canonicalRole(pick.role);
    const otherPicks = summarize(role ? comparableByRole.get(role).filter((entry) => !selectedKeys.has(entry.key)).map((entry) => entry.match) : []);
    const matchups = new Map();
    const partners = new Map();
    const addAssociation = (map, row, match) => {
      const associationKey = row.key;
      const group = map.get(associationKey) || { champion: row.champion, role: row.role, matches: [] };
      group.matches.push(match);
      map.set(associationKey, group);
    };
    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let kdaGames = 0;
    for (const entry of entries) {
      const ownRows = entry.rowsByPick.get(key);
      if (ownRows.length === 1) {
        const values = ["kills", "deaths", "assists"].map((field) => availableNumber(ownRows[0].row[field]));
        if (values.every((value) => value !== null && value >= 0)) {
          kills += values[0];
          deaths += values[1];
          assists += values[2];
          kdaGames += 1;
        }
      }
      // No role inference, and ambiguous positions never become a claimed matchup.
      if (!role || entry.rowsByRole.get(role)?.length !== 1) continue;
      const opponents = entry.opponentsByRole.get(role) || [];
      if (opponents.length === 1 && opponents[0].champion) addAssociation(matchups, opponents[0], entry.match);
      for (const partnerRole of ROLES) {
        if (partnerRole === role) continue;
        const allies = entry.rowsByRole.get(partnerRole) || [];
        if (allies.length === 1 && allies[0].champion) addAssociation(partners, allies[0], entry.match);
      }
    }
    const associations = (map) => ordered([...map.values()].map((entry) => ({ ...entry, ...summarize(entry.matches) })));
    return {
      ...pick,
      ...summary,
      id: `${pick.champion}|${pick.role}`,
      status: summary.known < 5 ? "explore" : summary.wr < 50 ? "review" : "replay",
      usage: active?.games > 0 ? summary.games / active.games * 100 : 0,
      otherPicks,
      matchups: associations(matchups),
      partners: associations(partners),
      lossMatches: summary.matches.filter((match) => matchResult(match) === 0),
      kda: kdaGames ? Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)) : null,
      kdaGames,
    };
  }));
  const roleCoverage = ROLES.map((role) => {
    const rolePicks = picks.filter((pick) => pick.role === role);
    return {
      role,
      games: draftsByRole.get(role).length,
      picks: rolePicks,
      repeated: rolePicks.filter((pick) => pick.known >= 2).length,
    };
  });
  const signalMap = new Map();
  for (const entry of drafts.filter((draft) => draft.complete)) {
    for (const label of new Set(entry.identity?.gaps || [])) {
      if (!label) continue;
      const matches = signalMap.get(label) || [];
      matches.push(entry.match);
      signalMap.set(label, matches);
    }
  }
  const signals = ordered([...signalMap.entries()].map(([label, matches]) => ({ label, ...summarize(matches) })));
  return { picks, roleCoverage, signals, completeGames, incompleteGames: drafts.length - completeGames };
}
