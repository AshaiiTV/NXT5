import { canonicalChampion } from '../../shared/champions.js';
import { buildDraftAnalysis } from './draft-analysis.js';

const OTHER = { blue: 'red', red: 'blue' };
function champions(values) {
  return Array.isArray(values) ? values.filter(value => typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'none').map(canonicalChampion).filter(Boolean) : [];
}
function complete(values) {
  const picks = champions(values);
  return Array.isArray(values) && values.length === 5 && picks.length === 5 && new Set(picks.map(value => value.toLowerCase())).size === 5;
}
function isPlayed(match) { return match.enemyPicksComplete === true && complete(match.enemyPicks); }
function frequency(observations, source) {
  const included = observations.filter(item => item.pickSource === source);
  const counts = new Map();
  for (const item of included) for (const champion of new Set(item.picks)) counts.set(champion, (counts.get(champion) || 0) + 1);
  return [...counts].map(([champion, count]) => ({ champion, count, total: included.length }))
    .sort((a, b) => b.count - a.count || a.champion.localeCompare(b.champion, 'en'));
}
function imported(draft) {
  const value = Date.parse(draft.importedAt || draft.snapshot?.importedAt || '');
  return Number.isFinite(value) ? value : 0;
}

/** A dossier observes played games. A linked draft can fill missing picks, but
 * remains a separate source and never creates another observation of a game. */
export function buildOpponentObservations(opponentId, opponentMatches = [], drafts = []) {
  const games = new Map();
  const gameByMatch = new Map();
  for (const match of opponentMatches) {
    if (!match?.id || match.opponentId !== opponentId) continue;
    const key = match.gameId ? `game:${match.gameId}` : `match:${match.id}`;
    const previous = games.get(key);
    if (!previous || (!isPlayed(previous) && isPlayed(match))) games.set(key, match);
    gameByMatch.set(String(match.id), key);
  }
  const linkedByGame = new Map();
  for (const draft of drafts) {
    if (!draft?.matchId || draft.opponentId !== opponentId || !OTHER[draft.allySide]
      || draft.snapshot?.source !== 'drafter.lol' || draft.snapshot.status !== 'completed') continue;
    const key = gameByMatch.get(String(draft.matchId));
    if (!key) continue;
    const previous = linkedByGame.get(key);
    if (!previous || imported(draft) > imported(previous)) linkedByGame.set(key, draft);
  }
  const observations = [...games].map(([key, match]) => {
    const draft = linkedByGame.get(key);
    const draftPicks = draft?.snapshot[`${OTHER[draft.allySide]}Picks`];
    const pickSource = isPlayed(match) ? 'match' : complete(draftPicks) ? 'draft' : 'unknown';
    return { ...match, picks: champions(pickSource === 'draft' ? draftPicks : match.enemyPicks), pickSource };
  }).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const bans = buildDraftAnalysis([...linkedByGame.values()]).enemy;
  return {
    total: observations.length,
    observations,
    playedPicks: frequency(observations, 'match'),
    draftPicks: frequency(observations, 'draft'),
    bans: bans.bans,
    coverage: {
      played: observations.filter(item => item.pickSource === 'match').length,
      draft: observations.filter(item => item.pickSource === 'draft').length,
      unknown: observations.filter(item => item.pickSource === 'unknown').length,
      bans: bans.coverage.bans,
    },
  };
}
