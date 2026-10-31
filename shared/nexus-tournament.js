// Draft tournament rules. These helpers do not establish official Nexus Rising
// rules, grant team access or persist/publish anything. Team IDs must be resolved
// against the application's existing teams by the caller.

function invalid(message) { throw new Error(message); }
function teamList(value, minimum = 2, maximum = 128) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
      value.some(id => typeof id !== 'string' || !id.trim()) || new Set(value).size !== value.length)
    invalid(`Entre ${minimum} et ${maximum} équipes distinctes sont requises.`);
  return [...value];
}
function seriesLength(value = 1) {
  if (![1, 3, 5].includes(value)) invalid('Le format doit être BO1, BO3 ou BO5.');
  return value;
}
function sides(fixture) {
  const teamAId = fixture?.teamAId ?? fixture?.homeTeamId;
  const teamBId = fixture?.teamBId ?? fixture?.awayTeamId;
  teamList([teamAId, teamBId], 2, 2);
  return { teamAId, teamBId };
}
function gameTimestamp(game, key) {
  const value = game[key] ?? game.summary?.[key] ?? game.payload?.match?.info?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Circle method: no fixture is created for a bye; return leg reverses sides. */
export function generateRoundRobin(teamIds, { legs, doubleRoundRobin = false, bestOf = 1 } = {}) {
  const teams = teamList(teamIds);
  const count = legs ?? (doubleRoundRobin ? 2 : 1);
  if (![1, 2].includes(count) || (legs != null && doubleRoundRobin && legs !== 2))
    invalid('Une phase régulière comporte un ou deux passages.');
  seriesLength(bestOf);
  let rotation = teams.length % 2 ? [...teams, null] : [...teams];
  const firstLeg = [];
  for (let index = 0; index < rotation.length - 1; index += 1) {
    const matches = [];
    const byes = [];
    for (let slot = 0; slot < rotation.length / 2; slot += 1) {
      let a = rotation[slot];
      let b = rotation[rotation.length - slot - 1];
      if (a === null || b === null) { byes.push(a ?? b); continue; }
      if ((index + slot) % 2) [a, b] = [b, a];
      matches.push({ teamAId: a, teamBId: b });
    }
    firstLeg.push({ matches, byes });
    rotation = [rotation[0], rotation.at(-1), ...rotation.slice(1, -1)];
  }
  const rounds = [];
  for (let leg = 1; leg <= count; leg += 1) {
    for (let index = 0; index < firstLeg.length; index += 1) {
      const round = (leg - 1) * firstLeg.length + index + 1;
      rounds.push({ round, leg, byes: [...firstLeg[index].byes], matches: firstLeg[index].matches.map((match, position) => {
        const teamAId = leg === 1 ? match.teamAId : match.teamBId;
        const teamBId = leg === 1 ? match.teamBId : match.teamAId;
        return { key: `rr-${leg}-${index + 1}-${position + 1}`, round, leg, position: position + 1,
          teamAId, teamBId, homeTeamId: teamAId, awayTeamId: teamBId, bestOf };
      }) });
    }
  }
  return { teams, legs: count, bestOf, rounds, matches: rounds.flatMap(round => round.matches) };
}

/** Only accepted, distinct game IDs count. gameNumber is optional but, when
 * supplied, must describe the complete ordered sequence; unnumbered inputs are
 * treated as an unordered set, never as a presumed chronological history. */
export function resolveSeries(fixture, games = fixture?.games || []) {
  const { teamAId, teamBId } = sides(fixture);
  const bestOf = seriesLength(fixture.bestOf ?? 1);
  if (!Array.isArray(games)) invalid('La liste des parties est invalide.');
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const issues = [];
  const distinct = new Map();
  for (const game of games) {
    if (game?.status !== 'accepted') continue;
    const gameId = game.gameId;
    const winner = game.winner ?? game.summary?.winner;
    if (typeof gameId !== 'string' || !gameId.trim() || !['A', 'B'].includes(winner)) {
      issues.push({ code: 'invalid-accepted-game', gameId: typeof gameId === 'string' ? gameId : null });
      continue;
    }
    if ((game.teamAId != null && game.teamAId !== teamAId) || (game.teamBId != null && game.teamBId !== teamBId)) {
      issues.push({ code: 'game-teams-mismatch', gameId });
      continue;
    }
    const previous = distinct.get(gameId);
    if (previous) {
      if (previous.winner !== winner || (previous.gameNumber != null && game.gameNumber != null && previous.gameNumber !== game.gameNumber))
        issues.push({ code: 'conflicting-game', gameId });
      else issues.push({ code: 'duplicate-game', gameId });
      continue;
    }
    distinct.set(gameId, { gameId, winner, gameNumber: game.gameNumber,
      gameCreation: gameTimestamp(game, 'gameCreation'), gameEndTimestamp: gameTimestamp(game, 'gameEndTimestamp') });
  }
  let accepted = [...distinct.values()];
  const numbered = accepted.some(game => game.gameNumber != null);
  if (numbered) {
    if (accepted.some(game => !Number.isInteger(game.gameNumber) || game.gameNumber < 1) ||
        new Set(accepted.map(game => game.gameNumber)).size !== accepted.length)
      issues.push({ code: 'invalid-game-sequence' });
    else {
      accepted = accepted.sort((a, b) => a.gameNumber - b.gameNumber);
      if (accepted.some((game, index) => game.gameNumber !== index + 1)) issues.push({ code: 'incomplete-game-sequence' });
    }
  }
  // Reception time is deliberately ignored: queued uploads can arrive in any
  // order. Use a common measured timestamp only when it orders every game.
  const timeKey = ['gameCreation', 'gameEndTimestamp'].find(key => accepted.length > 0 &&
    accepted.every(game => game[key] !== null) && new Set(accepted.map(game => game[key])).size === accepted.length);
  if (!numbered && timeKey) accepted.sort((a, b) => a[timeKey] - b[timeKey]);
  if (numbered || timeKey) {
    let a = 0; let b = 0;
    for (const game of accepted) {
      if (a >= winsNeeded || b >= winsNeeded) issues.push({ code: 'games-after-series-end', gameId: game.gameId });
      if (game.winner === 'A') a += 1; else b += 1;
    }
  }
  const winsA = accepted.filter(game => game.winner === 'A').length;
  const winsB = accepted.length - winsA;
  const overflow = accepted.length > bestOf || winsA > winsNeeded || winsB > winsNeeded ||
    (winsA >= winsNeeded && winsB >= winsNeeded) || issues.some(issue => issue.code === 'games-after-series-end');
  if (overflow) issues.push({ code: 'series-overflow' });
  const conflict = issues.some(issue => issue.code !== 'duplicate-game');
  const complete = !conflict && (winsA === winsNeeded || winsB === winsNeeded);
  return {
    bestOf, winsNeeded, winsA, winsB, gamesPlayed: accepted.length,
    status: conflict ? 'conflict' : complete ? 'complete' : accepted.length ? 'in-progress' : 'pending',
    winnerTeamId: complete ? (winsA === winsNeeded ? teamAId : teamBId) : null,
    loserTeamId: complete ? (winsA === winsNeeded ? teamBId : teamAId) : null,
    acceptedGameIds: accepted.map(game => game.gameId), overflow, issues,
  };
}
export const getSeriesResult = resolveSeries;

/** By default only league points order the table. Extra tie-breakers require an
 * explicit configured rule. Input order provides display stability, never a
 * decisive alphabetical/ID tie-break for qualification. */
export function calculateStandings(teamIds, fixtures, {
  winPoints = 3, lossPoints = 0, qualificationCount = null, tieBreakers = [], byes = [], byePoints = winPoints,
} = {}) {
  // Draft seasons can exist before their first team is approved.
  const teams = teamList(teamIds, 0);
  if (!Array.isArray(fixtures) || !Number.isFinite(winPoints) || !Number.isFinite(lossPoints) || !Number.isFinite(byePoints) || !Array.isArray(byes) ||
      !Array.isArray(tieBreakers) || tieBreakers.some(key => !['headToHead', 'gameDifference', 'seriesWon', 'gamesWon'].includes(key)) ||
      new Set(tieBreakers).size !== tieBreakers.length ||
      (qualificationCount != null && (!Number.isInteger(qualificationCount) || qualificationCount < 1 || qualificationCount > 128)))
    invalid('Les règles de classement sont invalides.');
  const rowsById = new Map(teams.map(teamId => [teamId, { teamId, seriesPlayed: 0, seriesWon: 0, seriesLost: 0,
    gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gameDifference: 0, byes: 0, points: 0, rank: null, tied: false, qualified: null }]));
  const byeKeys = new Set();
  for (const bye of byes) {
    const key = `${bye?.round}:${bye?.teamId}`;
    if (!rowsById.has(bye?.teamId) || !Number.isInteger(bye.round) || bye.round < 1 || byeKeys.has(key)) invalid('Les exemptions de ronde sont invalides.');
    byeKeys.add(key);
    const row = rowsById.get(bye.teamId); row.byes += 1; row.points += byePoints;
  }
  const issues = [];
  const keys = new Set();
  const gamesUsedBy = new Map();
  const prepared = fixtures.map((fixture, index) => {
    const key = fixture.key ?? fixture.id ?? `fixture-${index + 1}`;
    if (keys.has(key)) invalid('Une rencontre figure plusieurs fois dans le classement.');
    keys.add(key);
    const { teamAId, teamBId } = sides(fixture);
    if (!rowsById.has(teamAId) || !rowsById.has(teamBId)) invalid('Une rencontre comporte une équipe hors de la saison.');
    const result = resolveSeries(fixture, fixture.games || []);
    for (const gameId of result.acceptedGameIds) {
      if (!gamesUsedBy.has(gameId)) gamesUsedBy.set(gameId, new Set());
      gamesUsedBy.get(gameId).add(key);
    }
    return { key, teamAId, teamBId, result };
  });
  let complete = prepared.length > 0;
  for (const { key, teamAId, teamBId, result } of prepared) {
    const reused = result.acceptedGameIds.filter(gameId => gamesUsedBy.get(gameId).size > 1);
    if (reused.length) issues.push({ code: 'game-reused-across-fixtures', fixtureKey: key, gameIds: reused });
    issues.push(...result.issues.map(issue => ({ ...issue, fixtureKey: key })));
    if (result.status !== 'complete' || reused.length) complete = false;
    if (result.status === 'conflict' || reused.length) continue;
    const a = rowsById.get(teamAId); const b = rowsById.get(teamBId);
    a.gamesWon += result.winsA; a.gamesLost += result.winsB;
    b.gamesWon += result.winsB; b.gamesLost += result.winsA;
    if (result.status === 'complete') {
      const winner = rowsById.get(result.winnerTeamId); const loser = rowsById.get(result.loserTeamId);
      winner.seriesWon += 1; loser.seriesLost += 1;
      winner.points += winPoints; loser.points += lossPoints;
    }
  }
  const baseRows = [...rowsById.values()].map(row => ({ ...row,
    seriesPlayed: row.seriesWon + row.seriesLost, gamesPlayed: row.gamesWon + row.gamesLost,
    gameDifference: row.gamesWon - row.gamesLost,
  }));
  const criteria = ['points', ...tieBreakers];
  const rankGroup = (group, criterionIndex) => {
    if (group.length < 2 || criterionIndex >= criteria.length) return [group];
    const criterion = criteria[criterionIndex];
    const scores = new Map(group.map(row => [row.teamId, criterion === 'headToHead' ? 0 : row[criterion]]));
    if (criterion === 'headToHead') {
      // Mini-table of the completed meetings between the tied teams. Never
      // infer an unplayed head-to-head result. Reapplication is not implicit.
      const meetings = prepared.filter(match => scores.has(match.teamAId) && scores.has(match.teamBId));
      const pairs = new Set(meetings.map(match => [match.teamAId, match.teamBId].sort().join('\u0000')));
      const ready = pairs.size === group.length * (group.length - 1) / 2 && meetings.every(match =>
        match.result.status === 'complete' && match.result.acceptedGameIds.every(id => gamesUsedBy.get(id).size === 1));
      if (ready) for (const match of meetings) {
        scores.set(match.result.winnerTeamId, scores.get(match.result.winnerTeamId) + winPoints);
        scores.set(match.result.loserTeamId, scores.get(match.result.loserTeamId) + lossPoints);
      }
      else issues.push({ code: 'incomplete-head-to-head', teamIds: group.map(row => row.teamId) });
      group.forEach(row => { row.headToHeadPoints = ready ? scores.get(row.teamId) : null; });
    }
    const ordered = [...group].sort((a, b) => scores.get(b.teamId) - scores.get(a.teamId));
    const buckets = [];
    for (const row of ordered) {
      const last = buckets.at(-1);
      if (last && scores.get(last[0].teamId) === scores.get(row.teamId)) last.push(row);
      else buckets.push([row]);
    }
    return buckets.flatMap(bucket => rankGroup(bucket, criterionIndex + 1));
  };
  const rankedGroups = rankGroup(baseRows, 0);
  const rows = rankedGroups.flat();
  const ties = [];
  let index = 0;
  for (const group of rankedGroups) {
    const end = index + group.length;
    const tied = group.length > 1;
    for (let cursor = index; cursor < end; cursor += 1) { rows[cursor].rank = index + 1; rows[cursor].tied = tied; }
    if (tied) ties.push({ rank: index + 1, fromPosition: index + 1, toPosition: end,
      teamIds: rows.slice(index, end).map(row => row.teamId), resolved: false,
      crossesQualification: qualificationCount != null && index < qualificationCount && end > qualificationCount });
    index = end;
  }
  const qualificationBlocked = qualificationCount != null && (!complete || qualificationCount > teams.length || ties.some(tie => tie.crossesQualification));
  if (qualificationCount != null && !qualificationBlocked)
    rows.forEach((row, index) => { row.qualified = index < qualificationCount; });
  return { rows, ties, complete, qualificationBlocked, qualificationCount, issues };
}

function seedOrder(size) {
  let order = [1, 2];
  for (let count = 4; count <= size; count *= 2) order = order.flatMap(seed => [seed, count + 1 - seed]);
  return order;
}
const seedSource = (seeds, seed) => ({ type: 'seed', seed, teamId: seeds[seed - 1] ?? null });
const winnerSource = matchKey => ({ type: 'winner', matchKey });
const loserSource = matchKey => ({ type: 'loser', matchKey });
function bracketNode(key, round, position, bestOf, sourceA, sourceB, stage = 'upper', extra = {}) {
  seriesLength(bestOf);
  return { key, round, position, stage, bestOf, sourceA, sourceB,
    teamAId: sourceA.teamId ?? null, teamBId: sourceB.teamId ?? null,
    status: sourceA.teamId && sourceB.teamId ? 'ready' : 'waiting', result: null, ...extra };
}
function bracketRounds(matches) {
  const groups = new Map();
  for (const match of matches) {
    const key = `${match.stage || 'upper'}-${match.round}`;
    if (!groups.has(key)) groups.set(key, { round: match.round, stage: match.stage || 'upper', matches: [] });
    groups.get(key).matches.push(match);
  }
  return [...groups.values()];
}
function packBracket(seeds, matches, extra) {
  const ordered = matches.map((match, index) => ({ ...match, order: index + 1 }));
  return { size: seeds.length, bracketSize: seeds.length, seeds, matches: ordered, rounds: bracketRounds(ordered),
    conflicts: [], invalidatedMatchKeys: [], ...extra };
}

export function generatePlayoffBracket(seedTeamIds, { bestOf = 3, allowByes = false } = {}) {
  const seeds = teamList(seedTeamIds, 2, 16);
  const bracketSize = 2 ** Math.ceil(Math.log2(seeds.length));
  if (!allowByes && bracketSize !== seeds.length) invalid('Un tableau sans exemption nécessite 2, 4, 8 ou 16 seeds.');
  const order = seedOrder(bracketSize);
  const matches = [];
  for (let round = 1, count = bracketSize / 2; count >= 1; round += 1, count /= 2) {
    for (let position = 1; position <= count; position += 1) {
      const source = offset => round === 1 ? seedSource(seeds, order[2 * (position - 1) + offset])
        : winnerSource(`po-r${round - 1}-m${2 * position - 1 + offset}`);
      matches.push(bracketNode(`po-r${round}-m${position}`, round, position, bestOf, source(0), source(1)));
    }
  }
  const bracket = packBracket(seeds, matches, { format: 'single-elimination', bracketSize,
    finalMatchKey: `po-r${Math.log2(bracketSize)}-m1` });
  return allowByes ? progressPlayoffs(bracket) : bracket;
}
export const generatePlayoffs = generatePlayoffBracket;

/** Standard double elimination, including the optional reset when the upper
 * bracket winner receives its first defeat in the grand final. */
export function generateDoubleElimination(seedTeamIds, { bestOf = 3, finalBestOf = 5, resetFinal = true } = {}) {
  const seeds = teamList(seedTeamIds, 4, 16);
  if (![4, 8, 16].includes(seeds.length)) invalid('La double élimination standard nécessite 4, 8 ou 16 seeds.');
  if (typeof resetFinal !== 'boolean') invalid('La règle de seconde finale est invalide.');
  const order = seedOrder(seeds.length);
  const depth = Math.log2(seeds.length);
  const matches = [];
  for (let round = 1; round <= depth; round += 1) {
    for (let position = 1; position <= seeds.length / 2 ** round; position += 1) {
      const source = offset => round === 1 ? seedSource(seeds, order[2 * (position - 1) + offset])
        : winnerSource(`de-u${round - 1}-m${2 * position - 1 + offset}`);
      matches.push(bracketNode(`de-u${round}-m${position}`, round, position, bestOf, source(0), source(1)));
    }
  }
  for (let position = 1; position <= seeds.length / 4; position += 1)
    matches.push(bracketNode(`de-l1-m${position}`, 1, position, bestOf,
      loserSource(`de-u1-m${2 * position - 1}`), loserSource(`de-u1-m${2 * position}`), 'lower'));
  for (let round = 2; round <= depth; round += 1) {
    const count = seeds.length / 2 ** round;
    const lowerRound = 2 * round - 2;
    for (let position = 1; position <= count; position += 1) {
      // Cross neighbouring paths before the next merge to avoid immediate
      // rematches against the corresponding upper-bracket opponent.
      const upperPosition = count > 1 ? ((position - 1) ^ 1) + 1 : position;
      matches.push(bracketNode(`de-l${lowerRound}-m${position}`, lowerRound, position, bestOf,
        winnerSource(`de-l${lowerRound - 1}-m${position}`), loserSource(`de-u${round}-m${upperPosition}`), 'lower'));
    }
    if (round < depth) for (let position = 1; position <= count / 2; position += 1)
      matches.push(bracketNode(`de-l${lowerRound + 1}-m${position}`, lowerRound + 1, position, bestOf,
        winnerSource(`de-l${lowerRound}-m${2 * position - 1}`), winnerSource(`de-l${lowerRound}-m${2 * position}`), 'lower'));
  }
  const upperWinner = winnerSource(`de-u${depth}-m1`);
  const lowerWinner = winnerSource(`de-l${2 * depth - 2}-m1`);
  matches.push(bracketNode('de-final', 1, 1, finalBestOf, upperWinner, lowerWinner, 'final'));
  if (resetFinal) matches.push(bracketNode('de-reset', 1, 1, finalBestOf, upperWinner, lowerWinner, 'reset',
    { condition: { type: 'if-lower-wins', matchKey: 'de-final' } }));
  return packBracket(seeds, matches, { format: 'double-elimination', finalMatchKey: 'de-final', resetMatchKey: resetFinal ? 'de-reset' : null });
}

/** Published beta sources disagree. Both variants remain explicit draft
 * choices; neither is silently assumed to be the Season I rules. */
export function generateNexusSixPlayoffs(seedTeamIds, { variant = 'site', firstSeedOpponent = 4,
  upperFinalBestOf = variant === 'pdf' ? 5 : 3, finalBestOf = 5 } = {}) {
  const seeds = teamList(seedTeamIds, 6, 6);
  if (!['site', 'pdf'].includes(variant) || ![3, 4].includes(firstSeedOpponent)) invalid('La variante Nexus à six équipes est invalide.');
  const s = seed => seedSource(seeds, seed);
  const w = number => winnerSource(`nx-m${number}`);
  const l = number => loserSource(`nx-m${number}`);
  const m = (number, round, position, bo, a, b, stage) => bracketNode(`nx-m${number}`, round, position, bo, a, b, stage);
  const matches = [m(1, 1, 1, 3, s(1), s(firstSeedOpponent), 'upper'),
    m(2, 1, 2, 3, s(2), s(firstSeedOpponent === 3 ? 4 : 3), 'upper')];
  if (variant === 'site') matches.push(m(3, 1, 1, 3, s(6), l(1), 'lower'), m(4, 1, 2, 3, s(5), l(2), 'lower'), m(5, 2, 1, 3, w(3), w(4), 'lower'));
  else matches.push(m(3, 1, 1, 3, s(5), s(6), 'lower'), m(4, 2, 1, 3, w(3), l(1), 'lower'), m(5, 3, 1, 3, w(4), l(2), 'lower'));
  matches.push(m(6, 2, 1, upperFinalBestOf, w(1), w(2), 'upper'),
    m(7, variant === 'site' ? 3 : 4, 1, finalBestOf, l(6), w(5), 'lower'), m(8, 1, 1, finalBestOf, w(6), w(7), 'final'));
  return packBracket(seeds, matches, { format: 'nexus-six', variant, firstSeedOpponent, upperFinalBestOf, finalBestOf, finalMatchKey: 'nx-m8' });
}

/** Recompute a bracket from upstream accepted results. Existing downstream
 * submissions lock their recorded participants; corrections cannot silently
 * transplant those games to new opponents or advance an invalidated winner. */
export function progressPlayoffs(bracket, gamesByMatchKey = {}, { previous = bracket } = {}) {
  if (!bracket || !Array.isArray(bracket.matches) || !Number.isInteger(bracket.size) || bracket.size < 2 || bracket.size > 16) invalid('Le tableau de playoffs est invalide.');
  teamList(bracket.seeds, bracket.size, bracket.size);
  const format = bracket.format || 'single-elimination';
  const expected = format === 'single-elimination' ? (bracket.bracketSize || bracket.size) - 1
    : format === 'double-elimination' ? 2 * bracket.size - 2 + (bracket.resetMatchKey ? 1 : 0) : format === 'nexus-six' ? 8 : 0;
  if (!expected || bracket.matches.length !== expected) invalid('Le tableau de playoffs est incomplet.');
  if (!gamesByMatchKey || typeof gamesByMatchKey !== 'object' || Array.isArray(gamesByMatchKey)) invalid('Les parties du tableau sont invalides.');
  const original = new Map((previous?.matches || []).map(match => [match.key, match]));
  const resolved = new Map();
  const conflicts = [];
  const invalidatedMatchKeys = [];
  const keys = new Set();
  const sorted = [...bracket.matches].sort((a, b) => (a.order ?? a.round) - (b.order ?? b.round) || a.position - b.position);
  const gamesUsedBy = new Map();
  for (const match of sorted) {
    const games = gamesByMatchKey[match.key] || [];
    if (!Array.isArray(games)) invalid('Les parties du tableau sont invalides.');
    for (const game of games) if (game?.status === 'accepted' && typeof game.gameId === 'string') {
      if (!gamesUsedBy.has(game.gameId)) gamesUsedBy.set(game.gameId, new Set());
      gamesUsedBy.get(game.gameId).add(match.key);
    }
  }
  for (const match of sorted) {
    if (!match.key || keys.has(match.key)) invalid('Les références du tableau de playoffs sont invalides.');
    keys.add(match.key);
    const fromSource = source => {
      if (source?.type === 'seed') {
        if (!Number.isInteger(source.seed) || source.seed < 1 || source.seed > (bracket.bracketSize || bracket.size) ||
            (bracket.seeds[source.seed - 1] ?? null) !== source.teamId) invalid('Un seed du tableau est incohérent.');
        return { teamId: source.teamId, known: true };
      }
      if (!['winner', 'loser'].includes(source?.type) || !resolved.has(source.matchKey)) invalid('Une rencontre dépend d’une source inconnue ou future.');
      const result = resolved.get(source.matchKey).result;
      return { teamId: result?.[source.type === 'winner' ? 'winnerTeamId' : 'loserTeamId'] || null, known: result?.status === 'complete' };
    };
    const sourceA = fromSource(match.sourceA); const sourceB = fromSource(match.sourceB);
    const teamAId = sourceA.teamId; const teamBId = sourceB.teamId;
    const games = gamesByMatchKey[match.key] || [];
    if (!Array.isArray(games)) invalid('Les parties du tableau sont invalides.');
    const before = original.get(match.key);
    const changed = before && (before.teamAId !== teamAId || before.teamBId !== teamBId);
    const node = { ...match, teamAId, teamBId, result: null, status: 'waiting' };
    let condition = true;
    if (match.condition) {
      if (match.condition.type !== 'if-lower-wins' || !resolved.has(match.condition.matchKey)) invalid('La condition de seconde finale est invalide.');
      const prior = resolved.get(match.condition.matchKey);
      condition = prior.result?.status === 'complete' ? prior.result.winnerTeamId === prior.teamBId : null;
    }
    if (condition !== true) {
      node.status = condition === false ? 'skipped' : 'waiting';
      if (games.length) {
        conflicts.push({ code: 'unexpected-conditional-game', matchKey: match.key });
        invalidatedMatchKeys.push(match.key); node.status = 'conflict';
      }
    } else if (match.condition && before && ['waiting', 'skipped', 'bye'].includes(before.status) && games.length) {
      conflicts.push({ code: 'conditional-game-before-activation', matchKey: match.key });
      invalidatedMatchKeys.push(match.key); node.status = 'conflict';
    } else if ((!teamAId || !teamBId || changed) && games.length) {
      const code = !teamAId || !teamBId ? 'games-before-teams-known' : 'downstream-teams-changed';
      conflicts.push({ code, matchKey: match.key, previousTeamAId: before?.teamAId || null,
        previousTeamBId: before?.teamBId || null, expectedTeamAId: teamAId, expectedTeamBId: teamBId });
      invalidatedMatchKeys.push(match.key);
      node.teamAId = before?.teamAId || null; node.teamBId = before?.teamBId || null;
      node.status = 'conflict';
    } else if (sourceA.known && sourceB.known && (!teamAId || !teamBId)) {
      node.status = 'bye';
      node.result = { status: 'complete', winnerTeamId: teamAId || teamBId, loserTeamId: null, bye: true, acceptedGameIds: [], gamesPlayed: 0 };
    } else if (teamAId && teamBId) {
      const result = resolveSeries(node, games);
      const reused = result.acceptedGameIds.filter(id => gamesUsedBy.get(id).size > 1);
      if (reused.length) {
        result.issues.push({ code: 'game-reused-across-fixtures', gameIds: reused });
        result.status = 'conflict'; result.winnerTeamId = null; result.loserTeamId = null;
      }
      node.result = result;
      node.status = result.status === 'pending' ? 'ready' : result.status;
      if (result.status === 'conflict') {
        conflicts.push(...result.issues.filter(issue => issue.code !== 'duplicate-game').map(issue => ({ ...issue, matchKey: match.key })));
        invalidatedMatchKeys.push(match.key);
      }
    }
    resolved.set(match.key, node);
  }
  const matches = [...resolved.values()];
  const rounds = bracketRounds(matches);
  const final = resolved.get(bracket.finalMatchKey || `po-r${Math.log2(bracket.size)}-m1`);
  const reset = bracket.resetMatchKey ? resolved.get(bracket.resetMatchKey) : null;
  const winner = reset && reset.status !== 'skipped' ? reset.result?.winnerTeamId : final?.result?.winnerTeamId;
  return { ...bracket, matches, rounds, conflicts, invalidatedMatchKeys,
    winnerTeamId: conflicts.length ? null : winner || null };
}

/** Input order is the explicit seeding order. Snake distribution alternates
 * direction at each row; it does not infer seeds from alphabetical team names. */
export function generateGroups(teamIds, { groupCount = 2, legs = 1, bestOf = 1, assignment = 'snake' } = {}) {
  const teams = teamList(teamIds, 2);
  if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > Math.floor(teams.length / 2) ||
      !['snake', 'sequential'].includes(assignment)) invalid('La répartition des groupes est invalide.');
  const groups = Array.from({ length: groupCount }, (_, index) => ({ id: `group-${index + 1}`, teamIds: [] }));
  teams.forEach((teamId, index) => {
    const column = index % groupCount;
    const group = assignment === 'snake' && Math.floor(index / groupCount) % 2 ? groupCount - 1 - column : column;
    groups[group].teamIds.push(teamId);
  });
  for (const group of groups) {
    const schedule = generateRoundRobin(group.teamIds, { legs, bestOf });
    group.rounds = schedule.rounds.map(round => ({ ...round, groupId: group.id, matches: round.matches.map(match => ({ ...match, key: `${group.id}-${match.key}`, groupId: group.id })) }));
    group.matches = group.rounds.flatMap(round => round.matches);
  }
  return { format: 'groups', teams, groupCount, legs, bestOf, assignment, groups, matches: groups.flatMap(group => group.matches) };
}

/** Validate an explicitly scheduled custom phase. Rematches are permitted in
 * different rounds; automatic simultaneous participation is rejected. */
export function validateCustomFixtures(teamIds, fixtures, { allowMultiplePerRound = false } = {}) {
  const teams = teamList(teamIds);
  if (!Array.isArray(fixtures)) invalid('Le calendrier personnalisé est invalide.');
  const keys = new Set(); const appearances = new Set();
  const matches = fixtures.map((fixture, index) => {
    const { teamAId, teamBId } = sides(fixture);
    const key = fixture.key ?? fixture.id ?? `custom-${index + 1}`;
    const round = fixture.round ?? 1;
    const bestOf = seriesLength(fixture.bestOf ?? 1);
    if (typeof key !== 'string' || !key || keys.has(key) || !Number.isInteger(round) || round < 1 ||
        !teams.includes(teamAId) || !teams.includes(teamBId)) invalid('Une rencontre personnalisée est invalide.');
    keys.add(key);
    for (const teamId of [teamAId, teamBId]) {
      const appearance = `${round}:${teamId}`;
      if (!allowMultiplePerRound && appearances.has(appearance)) invalid('Une équipe participe plusieurs fois à la même ronde.');
      appearances.add(appearance);
    }
    return { ...fixture, key, round, bestOf, teamAId, teamBId };
  });
  return { format: 'custom', teams, matches, valid: true, issues: [] };
}

/** Deterministic score-adjacent Swiss pairing. This deliberately does not
 * claim FIDE/Dutch rules, colour balancing or automatic tiebreak qualification.
 * History must include every prior round and explicit bye awards. */
export function generateSwissRound(teamIds, previousFixtures = [], {
  round = 1, bestOf = 1, winPoints = 3, lossPoints = 0, byePoints = winPoints,
  previousByes = [], avoidRematches = true,
} = {}) {
  const teams = teamList(teamIds, 2, 128);
  seriesLength(bestOf);
  if (!Number.isInteger(round) || round < 1 || !Array.isArray(previousFixtures) || !Array.isArray(previousByes) ||
      !Number.isFinite(winPoints) || !Number.isFinite(lossPoints) || !Number.isFinite(byePoints) || typeof avoidRematches !== 'boolean') invalid('Les règles suisses sont invalides.');
  const blocked = (code, detail = {}) => ({ round, matches: [], byes: [], standings: null, blocked: true, issues: [{ code, ...detail }] });
  const appearances = new Map();
  const meetings = new Map(teams.map(team => [team, new Set()]));
  const byeCount = new Map(teams.map(team => [team, 0]));
  const noteAppearance = (atRound, team) => {
    if (!appearances.has(atRound)) appearances.set(atRound, new Set());
    const seen = appearances.get(atRound);
    if (seen.has(team)) return false;
    seen.add(team); return true;
  };
  for (const fixture of previousFixtures) {
    const { teamAId, teamBId } = sides(fixture);
    if (!meetings.has(teamAId) || !meetings.has(teamBId) || !Number.isInteger(fixture.round) || fixture.round < 1 || fixture.round >= round)
      return blocked('invalid-round-history');
    if (!noteAppearance(fixture.round, teamAId) || !noteAppearance(fixture.round, teamBId)) return blocked('repeat-team-in-round');
    if (resolveSeries(fixture).status !== 'complete') return blocked('incomplete-previous-round', { previousRound: fixture.round });
    if (avoidRematches && meetings.get(teamAId).has(teamBId)) return blocked('rematch-in-history');
    meetings.get(teamAId).add(teamBId); meetings.get(teamBId).add(teamAId);
  }
  const byeRounds = new Set();
  for (const bye of previousByes) {
    if (!byeCount.has(bye?.teamId) || !Number.isInteger(bye.round) || bye.round < 1 || bye.round >= round || teams.length % 2 !== 1 || byeRounds.has(bye.round))
      return blocked('invalid-bye-history');
    if (!noteAppearance(bye.round, bye.teamId)) return blocked('repeat-team-in-round');
    byeRounds.add(bye.round); byeCount.set(bye.teamId, byeCount.get(bye.teamId) + 1);
    if (byeCount.get(bye.teamId) > 1) return blocked('repeat-bye-in-history');
  }
  if (appearances.size !== round - 1) return blocked('missing-previous-round');
  for (let previousRound = 1; previousRound < round; previousRound += 1) {
    if (appearances.get(previousRound)?.size !== teams.length) return blocked('incomplete-round-participants', { previousRound });
    if (teams.length % 2 && !byeRounds.has(previousRound)) return blocked('missing-bye-history', { previousRound });
  }
  const standings = calculateStandings(teams, previousFixtures, { winPoints, lossPoints, byes: previousByes, byePoints });
  if (standings.issues.some(issue => issue.code !== 'duplicate-game')) return { ...blocked('conflicting-round-results'), standings };
  const ranked = standings.rows.map(row => row.teamId);
  const rank = new Map(ranked.map((teamId, index) => [teamId, index]));
  const points = new Map(standings.rows.map(row => [row.teamId, row.points]));
  let visits = 0; let exhausted = false;
  const pair = remaining => {
    visits += 1;
    if (visits > 100000) { exhausted = true; return null; }
    if (!remaining.length) return [];
    let chosen = null; let candidates = null;
    for (const team of remaining) {
      const possible = remaining.filter(other => other !== team && (!avoidRematches || !meetings.get(team).has(other)));
      if (!possible.length) return null;
      if (!candidates || possible.length < candidates.length) { chosen = team; candidates = possible; }
    }
    candidates.sort((a, b) => Math.abs(points.get(a) - points.get(chosen)) - Math.abs(points.get(b) - points.get(chosen)) ||
      Math.abs(rank.get(a) - rank.get(chosen)) - Math.abs(rank.get(b) - rank.get(chosen)) || rank.get(a) - rank.get(b));
    for (const other of candidates) {
      const rest = pair(remaining.filter(team => team !== chosen && team !== other));
      if (rest) return [[chosen, other], ...rest];
      if (exhausted) return null;
    }
    return null;
  };
  const byeCandidates = teams.length % 2 ? [...ranked].reverse().filter(team => byeCount.get(team) === 0) : [null];
  if (!byeCandidates.length) return { ...blocked('no-eligible-bye'), standings };
  let pairing = null; let bye = null;
  for (const candidate of byeCandidates) {
    pairing = pair(ranked.filter(team => team !== candidate));
    if (pairing) { bye = candidate; break; }
    if (exhausted) break;
  }
  if (!pairing) return { ...blocked(exhausted ? 'pairing-search-limit' : 'no-pairing-without-rematch'), standings };
  const matches = pairing.map(([teamAId, teamBId], index) => ({ key: `swiss-r${round}-m${index + 1}`, round, position: index + 1, teamAId, teamBId, bestOf }));
  return { round, matches, byes: bye ? [bye] : [], standings, blocked: false, issues: [] };
}
