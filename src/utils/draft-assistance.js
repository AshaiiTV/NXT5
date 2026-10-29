import { canonicalChampion } from "../../shared/champions.js";
import { canonicalRole } from "../../shared/roles.js";
import { resultSummary } from "./statistics.js";

const MASTERY_ORDER = ["lock", "pocket", "work", "danger"];
const id = (value) => String(value ?? "").trim();
const championKey = (value) => canonicalChampion(value).toLowerCase();
const participantRole = (row) => canonicalRole(row?.role || row?.raw?.teamPosition || row?.raw?.individualPosition || row?.raw?.lane);
const masteryStatus = (row) => MASTERY_ORDER.includes(row?.status) ? row.status : "work";
const summarize = (matches) => ({ ...resultSummary(matches), matches });

// Imports are unique by team + Riot game ID in storage. Keep unrelated ID-less
// objects separate, while never counting the same object twice.
function uniqueMatches(matches, teamId) {
  const seen = new Set();
  return matches.filter((match) => {
    if (id(match?.team_id) !== teamId) return false;
    const key = id(match.game_id) ? `game:${id(match.game_id)}` : id(match.id) ? `id:${id(match.id)}` : match;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Draft preparation from explicitly declared pools and the selected team's imports.
 * Mastery comes from the player's manual classification, never Riot mastery or an
 * aggregate pool score. Experience and observed matchups are separate evidence.
 * Only known results affect experience ordering; win rates never rank candidates.
 */
export function buildDraftAssistance({
  teamId,
  player,
  role,
  opponentChampion = "",
  championPool = [],
  matches = [],
  excludedChampions = [],
} = {}) {
  const selectedTeamId = id(teamId);
  const selectedPlayerId = id(player?.id);
  const selectedRole = canonicalRole(role);
  if (!selectedTeamId || !selectedPlayerId || !selectedRole || id(player?.team_id) !== selectedTeamId) return [];

  const opponentKey = championKey(opponentChampion);
  const excluded = new Set([...excludedChampions, opponentChampion].map(championKey).filter(Boolean));
  const candidates = new Map();
  for (const row of championPool) {
    if (!id(row?.id)) continue;
    if (id(row?.team_id) !== selectedTeamId || id(row?.player_id) !== selectedPlayerId) continue;
    if (!["manual", "riot_manual"].includes(row.source)) continue;
    if (canonicalRole(row.role || player.role) !== selectedRole) continue;
    const champion = canonicalChampion(row.champion);
    const key = championKey(champion);
    if (!key || excluded.has(key) || candidates.has(key)) continue;
    const status = masteryStatus(row);
    candidates.set(key, {
      champion,
      poolRow: row,
      mastery: { status, rank: MASTERY_ORDER.indexOf(status) },
      experienceMatches: [],
      matchupMatches: [],
    });
  }

  for (const match of uniqueMatches(matches, selectedTeamId)) {
    const participants = Array.isArray(match.participants) ? match.participants : [];
    const alliesAtRole = participants.filter((row) => row?.team_key === "ALLY" && participantRole(row) === selectedRole);
    const playerRows = alliesAtRole.filter((row) => id(row.player_id) === selectedPlayerId);
    // A missing player association is not inferred from a Riot ID or display name.
    const champions = new Set(playerRows.map((row) => championKey(row.champion)));
    if (champions.size !== 1) continue;
    const candidate = candidates.get([...champions][0]);
    if (!candidate) continue;
    candidate.experienceMatches.push(match);

    // Pair explicit, unique roles only: ambiguous drafts must not claim a duel.
    const opponentsAtRole = participants.filter((row) => row?.team_key === "ENEMY" && participantRole(row) === selectedRole);
    if (opponentKey && alliesAtRole.length === 1 && opponentsAtRole.length === 1 && championKey(opponentsAtRole[0].champion) === opponentKey) {
      candidate.matchupMatches.push(match);
    }
  }

  return [...candidates.values()]
    .map(({ experienceMatches, matchupMatches, ...candidate }) => ({
      ...candidate,
      experience: summarize(experienceMatches),
      matchup: summarize(matchupMatches),
    }))
    .sort((left, right) => left.mastery.rank - right.mastery.rank
      || right.experience.known - left.experience.known
      || left.champion.localeCompare(right.champion, "fr"));
}
