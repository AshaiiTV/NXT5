import { describe, expect, it } from 'vitest';
import { calculateStandings, generateDoubleElimination, generateGroups, generateNexusSixPlayoffs, generatePlayoffBracket,
  generateRoundRobin, generateSwissRound, progressPlayoffs, resolveSeries, validateCustomFixtures } from '../../shared/nexus-tournament.js';

const accepted = (gameId, winner, extra = {}) => ({ gameId, winner, status: 'accepted', ...extra });
const fixture = (key, teamAId, teamBId, winners, bestOf = 1) => ({ key, teamAId, teamBId, bestOf,
  games: winners.map((winner, index) => accepted(`${key}-${index + 1}`, winner, { gameNumber: index + 1 })) });
const findMatch = (bracket, key) => bracket.matches.find(match => match.key === key);
function playBracket(initial, pickWinner = () => 'A') {
  let bracket = progressPlayoffs(initial);
  const games = {}; const played = []; const losses = new Map(initial.seeds.map(team => [team, 0]));
  for (let step = 0; step < 40; step += 1) {
    const ready = bracket.matches.filter(match => match.status === 'ready');
    if (!ready.length) return { bracket, games, played, losses };
    const busy = ready.flatMap(match => [match.teamAId, match.teamBId]);
    expect(new Set(busy).size).toBe(busy.length);
    for (const match of ready) {
      expect(match.teamAId).not.toBe(match.teamBId);
      const winner = pickWinner(match, played.length);
      const loser = winner === 'A' ? match.teamBId : match.teamAId;
      expect(losses.get(loser)).toBeLessThan(2);
      losses.set(loser, losses.get(loser) + 1);
      games[match.key] = Array.from({ length: Math.floor(match.bestOf / 2) + 1 }, (_, index) => accepted(`${match.key}-${index}`, winner, { gameNumber: index + 1 }));
      played.push(match.key);
    }
    bracket = progressPlayoffs(bracket, games);
    expect(bracket.conflicts).toEqual([]);
  }
  throw new Error('Bracket did not terminate');
}

describe('round-robin schedules', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 11, 16])('schedules each pair exactly once with %i teams', count => {
    const teams = Array.from({ length: count }, (_, index) => `team-${index + 1}`);
    const original = [...teams];
    const schedule = generateRoundRobin(teams, { bestOf: 3 });
    expect(teams).toEqual(original);
    expect(schedule.matches).toHaveLength(count * (count - 1) / 2);
    expect(schedule.rounds).toHaveLength(count % 2 ? count : count - 1);
    expect(new Set(schedule.matches.map(match => match.key)).size).toBe(schedule.matches.length);
    expect(new Set(schedule.matches.map(match => [match.teamAId, match.teamBId].sort().join('|'))).size).toBe(schedule.matches.length);
    for (const round of schedule.rounds) {
      const participants = [...round.matches.flatMap(match => [match.teamAId, match.teamBId]), ...round.byes];
      expect(participants).toHaveLength(count);
      expect(new Set(participants)).toEqual(new Set(teams));
      expect(round.byes).toHaveLength(count % 2);
    }
    for (const team of teams) {
      expect(schedule.matches.filter(match => [match.teamAId, match.teamBId].includes(team))).toHaveLength(count - 1);
      expect(schedule.rounds.filter(round => round.byes.includes(team))).toHaveLength(count % 2);
    }
  });

  it.each([3, 4, 7, 8])('reverses every pair exactly once in the return leg for %i teams', count => {
    const schedule = generateRoundRobin(Array.from({ length: count }, (_, index) => String(index)), { doubleRoundRobin: true });
    const first = schedule.matches.filter(match => match.leg === 1);
    const second = schedule.matches.filter(match => match.leg === 2);
    expect(second).toHaveLength(first.length);
    expect(second.map(match => [match.teamAId, match.teamBId])).toEqual(first.map(match => [match.teamBId, match.teamAId]));
  });

  it('rejects duplicate teams and unsupported or contradictory formats', () => {
    expect(() => generateRoundRobin(['a', 'a'])).toThrow();
    expect(() => generateRoundRobin(['a'])).toThrow();
    expect(() => generateRoundRobin(['a', 'b'], { bestOf: 2 })).toThrow();
    expect(() => generateRoundRobin(['a', 'b'], { legs: 1, doubleRoundRobin: true })).toThrow();
  });
});

describe('series results', () => {
  it.each([1, 3, 5])('awards BO%i only at the win threshold', bestOf => {
    const winsNeeded = Math.floor(bestOf / 2) + 1;
    const match = fixture('m', 'a', 'b', Array(winsNeeded - 1).fill('A'), bestOf);
    expect(resolveSeries(match).winnerTeamId).toBeNull();
    match.games.push(accepted('last', 'A'));
    // Unnumbered collections have no presumed arrival order.
    match.games.forEach(game => { delete game.gameNumber; });
    expect(resolveSeries(match)).toMatchObject({ status: 'complete', winnerTeamId: 'a', loserTeamId: 'b', winsA: winsNeeded });
  });

  it('ignores unaccepted games and counts a repeated identical game only once', () => {
    const match = fixture('m', 'a', 'b', [], 3);
    match.games = [accepted('one', 'A'), accepted('one', 'A'), { gameId: 'two', winner: 'A', status: 'pending' }, { gameId: 'three', winner: 'B', status: 'rejected' }];
    expect(resolveSeries(match)).toMatchObject({ status: 'in-progress', gamesPlayed: 1, winnerTeamId: null, issues: [{ code: 'duplicate-game', gameId: 'one' }] });
  });

  it('blocks conflicting duplicate winners, invalid IDs and foreign opponents', () => {
    const match = { teamAId: 'a', teamBId: 'b', bestOf: 1 };
    for (const games of [[accepted('x', 'A'), accepted('x', 'B')], [accepted('', 'A')], [accepted('x', 'A', { teamAId: 'c' })]])
      expect(resolveSeries(match, games)).toMatchObject({ status: 'conflict', winnerTeamId: null });
  });

  it('reads validated submission summaries', () => {
    expect(resolveSeries({ teamAId: 'a', teamBId: 'b' }, [{ gameId: 'EUW1_123', status: 'accepted', summary: { winner: 'B' } }])).toMatchObject({ status: 'complete', winnerTeamId: 'b' });
  });

  it('blocks missing or overlapping sequence slots', () => {
    const match = { teamAId: 'a', teamBId: 'b', bestOf: 3 };
    for (const indices of [[1, 3], [1, 1], [1, null]])
      expect(resolveSeries(match, indices.map((gameNumber, index) => accepted(String(index), 'A', { gameNumber })))).toMatchObject({ status: 'conflict', winnerTeamId: null });
  });

  it('detects games played after the series ended, even within the BO limit', () => {
    const result = resolveSeries(fixture('m', 'a', 'b', ['A', 'A', 'B'], 3));
    expect(result).toMatchObject({ status: 'conflict', overflow: true, winnerTeamId: null });
    expect(result.issues).toContainEqual({ code: 'games-after-series-end', gameId: 'm-3' });
    expect(resolveSeries(fixture('m', 'a', 'b', ['A', 'B', 'A'], 3))).toMatchObject({ status: 'complete', winnerTeamId: 'a' });
  });

  it.each(['gameCreation', 'gameEndTimestamp'])('uses measured %s rather than upload order', timestampKey => {
    const games = [accepted('third', 'B', { [timestampKey]: 3000 }), accepted('first', 'A', { [timestampKey]: 1000 }), accepted('second', 'A', { [timestampKey]: 2000 })];
    const original = JSON.stringify(games);
    expect(resolveSeries({ teamAId: 'a', teamBId: 'b', bestOf: 3 }, games)).toMatchObject({ status: 'conflict', overflow: true });
    expect(JSON.stringify(games)).toBe(original);
  });

  it('does not invent chronology from upload time or partial/tied timestamps', () => {
    const match = { teamAId: 'a', teamBId: 'b', bestOf: 3 };
    for (const timestamps of [[null, null, null], [1000, 1000, 1000], [1000, 2000, null]]) {
      const games = ['A', 'A', 'B'].map((winner, index) => accepted(String(index), winner, { gameCreation: timestamps[index], createdAt: 1000 + index }));
      expect(resolveSeries(match, games)).toMatchObject({ status: 'complete', winsA: 2, winsB: 1 });
    }
  });

  it('rejects total game overflow with no chronological metadata', () => {
    expect(resolveSeries({ teamAId: 'a', teamBId: 'b', bestOf: 3 }, ['A', 'B', 'A', 'B'].map((winner, index) => accepted(String(index), winner)))).toMatchObject({ status: 'conflict', overflow: true });
  });
});

describe('standings', () => {
  it.each([{ teams: [] }, { teams: ['a'] }])('renders a draft before enough teams are approved', ({ teams }) => {
    expect(calculateStandings(teams, [], { qualificationCount: 4 })).toMatchObject({ complete: false, qualificationBlocked: true });
    expect(calculateStandings(teams, [], { qualificationCount: 4 }).rows).toHaveLength(teams.length);
  });

  it('counts games in partial series but awards no points or winner', () => {
    const result = calculateStandings(['a', 'b'], [fixture('m', 'a', 'b', ['A'], 3)], { qualificationCount: 1 });
    expect(result).toMatchObject({ complete: false, qualificationBlocked: true });
    expect(result.rows[0]).toMatchObject({ seriesPlayed: 0, seriesWon: 0, gamesWon: 1, gamesLost: 0, points: 0, qualified: null });
  });

  it('supports explicit points and keeps series and game records separate', () => {
    const result = calculateStandings(['a', 'b'], [fixture('m', 'a', 'b', ['A', 'B', 'A'], 3)], { winPoints: 5, lossPoints: 1, qualificationCount: 1 });
    expect(result).toMatchObject({ complete: true, qualificationBlocked: false });
    expect(result.rows[0]).toMatchObject({ teamId: 'a', seriesWon: 1, gamesWon: 2, gamesLost: 1, points: 5, rank: 1, qualified: true });
    expect(result.rows[1]).toMatchObject({ teamId: 'b', seriesLost: 1, gamesWon: 1, gamesLost: 2, points: 1, qualified: false });
  });

  it('leaves a qualification tie explicit, preserving input order only for display', () => {
    const result = calculateStandings(['z', 'a', 'b'], [fixture('za', 'z', 'a', ['A']), fixture('ab', 'a', 'b', ['A']), fixture('bz', 'b', 'z', ['A'])], { qualificationCount: 2 });
    expect(result).toMatchObject({ complete: true, qualificationBlocked: true });
    expect(result.rows.map(row => [row.teamId, row.rank, row.qualified])).toEqual([['z', 1, null], ['a', 1, null], ['b', 1, null]]);
    expect(result.ties).toEqual([{ rank: 1, fromPosition: 1, toPosition: 3, teamIds: ['z', 'a', 'b'], resolved: false, crossesQualification: true }]);
  });

  it('applies game difference only when configured', () => {
    const fixtures = [fixture('ab', 'a', 'b', ['A', 'A'], 3), fixture('bc', 'b', 'c', ['A', 'B', 'A'], 3), fixture('ca', 'c', 'a', ['A', 'B', 'A'], 3)];
    expect(calculateStandings(['a', 'b', 'c'], fixtures, { qualificationCount: 1 }).qualificationBlocked).toBe(true);
    const result = calculateStandings(['a', 'b', 'c'], fixtures, { qualificationCount: 1, tieBreakers: ['gameDifference'] });
    expect(result.rows[0]).toMatchObject({ teamId: 'a', qualified: true });
    expect(result.qualificationBlocked).toBe(false);
  });

  it('excludes both fixtures when the same accepted game is reused', () => {
    const fixtures = [fixture('ab', 'a', 'b', ['A']), fixture('ac', 'a', 'c', ['A'])];
    fixtures[1].games[0].gameId = fixtures[0].games[0].gameId;
    const result = calculateStandings(['a', 'b', 'c'], fixtures);
    expect(result.complete).toBe(false);
    expect(result.rows.every(row => row.points === 0 && row.gamesPlayed === 0)).toBe(true);
    expect(result.issues).toHaveLength(2);
  });
});

describe('explicit seeded single-elimination playoffs', () => {
  it.each([4, 8])('creates a complete %i-team bracket with no opponents invented', count => {
    const bracket = generatePlayoffBracket(Array.from({ length: count }, (_, index) => `t${index + 1}`));
    expect(bracket.matches).toHaveLength(count - 1);
    expect(bracket.matches.filter(match => match.round > 1).every(match => match.teamAId === null && match.teamBId === null && match.status === 'waiting')).toBe(true);
    const order = count === 4 ? [['t1', 't4'], ['t2', 't3']] : [['t1', 't8'], ['t4', 't5'], ['t2', 't7'], ['t3', 't6']];
    expect(bracket.rounds[0].matches.map(match => [match.teamAId, match.teamBId])).toEqual(order);
  });

  it('requires explicit distinct seeds and supported bracket sizes', () => {
    expect(() => generatePlayoffBracket(['a', 'b', 'c', 'd', 'e', 'f'])).toThrow();
    expect(() => generatePlayoffBracket(['a', 'a', 'c', 'd'])).toThrow();
  });

  it('advances complete winners, preserving unknown opposing slots', () => {
    const initial = generatePlayoffBracket(['a', 'b', 'c', 'd'], { bestOf: 1 });
    const partial = progressPlayoffs(initial, { 'po-r1-m1': [accepted('one', 'A')] });
    expect(findMatch(partial, 'po-r2-m1')).toMatchObject({ teamAId: 'a', teamBId: null, status: 'waiting' });
    const ready = progressPlayoffs(partial, { 'po-r1-m1': [accepted('one', 'A')], 'po-r1-m2': [accepted('two', 'B')] });
    expect(findMatch(ready, 'po-r2-m1')).toMatchObject({ teamAId: 'a', teamBId: 'c', status: 'ready' });
    const complete = progressPlayoffs(ready, { 'po-r1-m1': [accepted('one', 'A')], 'po-r1-m2': [accepted('two', 'B')], 'po-r2-m1': [accepted('final', 'B')] });
    expect(complete.winnerTeamId).toBe('c');
    expect(initial.matches.every(match => match.result === null)).toBe(true);
  });

  it('prevents any submission before both participants are known', () => {
    const initial = generatePlayoffBracket(['a', 'b', 'c', 'd'], { bestOf: 1 });
    const result = progressPlayoffs(initial, { 'po-r2-m1': [{ gameId: 'premature', status: 'pending' }] });
    expect(result.winnerTeamId).toBeNull();
    expect(result.conflicts[0]).toMatchObject({ code: 'games-before-teams-known', matchKey: 'po-r2-m1' });
  });

  it('changes a downstream opponent safely while no downstream game exists', () => {
    const initial = generatePlayoffBracket(['a', 'b', 'c', 'd'], { bestOf: 1 });
    const originalGames = { 'po-r1-m1': [accepted('one', 'A')], 'po-r1-m2': [accepted('two', 'A')] };
    const ready = progressPlayoffs(initial, originalGames);
    const corrected = progressPlayoffs(ready, { ...originalGames, 'po-r1-m1': [accepted('one', 'B')] });
    expect(findMatch(corrected, 'po-r2-m1')).toMatchObject({ teamAId: 'd', teamBId: 'b', status: 'ready' });
    expect(corrected.conflicts).toEqual([]);
  });

  it.each(['pending', 'accepted', 'rejected'])('blocks upstream corrections when a downstream %s submission exists', status => {
    const initial = generatePlayoffBracket(['a', 'b', 'c', 'd'], { bestOf: 1 });
    const originalGames = { 'po-r1-m1': [accepted('one', 'A')], 'po-r1-m2': [accepted('two', 'A')] };
    const ready = progressPlayoffs(initial, originalGames);
    const corrected = progressPlayoffs(ready, { ...originalGames, 'po-r1-m1': [accepted('one', 'B')], 'po-r2-m1': [accepted('final', 'A', { status })] });
    expect(findMatch(corrected, 'po-r2-m1')).toMatchObject({ teamAId: 'a', teamBId: 'b', status: 'conflict', result: null });
    expect(corrected).toMatchObject({ winnerTeamId: null, invalidatedMatchKeys: ['po-r2-m1'] });
    expect(corrected.conflicts[0]).toMatchObject({ code: 'downstream-teams-changed', expectedTeamAId: 'd' });
  });

  it('revoking an upstream winner invalidates later results and the champion', () => {
    const initial = generatePlayoffBracket(['a', 'b', 'c', 'd'], { bestOf: 1 });
    const games = { 'po-r1-m1': [accepted('one', 'A')], 'po-r1-m2': [accepted('two', 'A')] };
    const ready = progressPlayoffs(initial, games);
    const complete = progressPlayoffs(ready, { ...games, 'po-r2-m1': [accepted('final', 'A')] });
    const revoked = progressPlayoffs(complete, { 'po-r1-m2': games['po-r1-m2'], 'po-r2-m1': [accepted('final', 'A')] });
    expect(revoked.winnerTeamId).toBeNull();
    expect(findMatch(revoked, 'po-r2-m1')).toMatchObject({ status: 'conflict', result: null });
  });

  it('does not advance games reused across different fixtures', () => {
    const bracket = generatePlayoffBracket(['a', 'b', 'c', 'd'], { bestOf: 1 });
    const result = progressPlayoffs(bracket, { 'po-r1-m1': [accepted('same', 'A')], 'po-r1-m2': [accepted('same', 'B')] });
    expect(result.conflicts).toHaveLength(2);
    expect(findMatch(result, 'po-r2-m1')).toMatchObject({ teamAId: null, teamBId: null, status: 'waiting' });
  });
});

describe('additional tournament families', () => {
  it.each([2, 4, 8, 16])('completes a %i-team single-elimination bracket', count => {
    const teams = Array.from({ length: count }, (_, index) => `t${index + 1}`);
    const { bracket, played, losses } = playBracket(generatePlayoffBracket(teams, { bestOf: 1 }));
    expect(bracket.winnerTeamId).toBe('t1');
    expect(played).toHaveLength(count - 1);
    for (const team of teams) expect(losses.get(team)).toBe(team === 't1' ? 0 : 1);
  });

  it.each([3, 5, 6, 7, 9, 15])('advances explicit byes without inventing games for %i teams', count => {
    const teams = Array.from({ length: count }, (_, index) => `t${index + 1}`);
    const initial = generatePlayoffBracket(teams, { bestOf: 1, allowByes: true });
    expect(initial.matches.filter(match => match.status === 'bye')).toHaveLength(2 ** Math.ceil(Math.log2(count)) - count);
    expect(initial.matches.filter(match => match.status === 'bye').every(match => match.result.gamesPlayed === 0 && match.result.acceptedGameIds.length === 0)).toBe(true);
    const { bracket, played } = playBracket(initial);
    expect(bracket.winnerTeamId).toBe('t1');
    expect(played).toHaveLength(count - 1);
  });

  it.each([4, 8, 16])('eliminates every defeated team after two losses in %i-team double elimination', count => {
    const teams = Array.from({ length: count }, (_, index) => `t${index + 1}`);
    for (const pickWinner of [() => 'A', () => 'B', (_, index) => index % 3 ? 'B' : 'A']) {
      const { bracket, played, losses } = playBracket(generateDoubleElimination(teams, { bestOf: 1, finalBestOf: 1 }), pickWinner);
      expect(bracket.winnerTeamId).toBeTruthy();
      expect(played.length).toBeGreaterThanOrEqual(2 * count - 2);
      expect(played.length).toBeLessThanOrEqual(2 * count - 1);
      for (const team of teams) {
        if (team === bracket.winnerTeamId) expect(losses.get(team)).toBeLessThan(2);
        else expect(losses.get(team)).toBe(2);
      }
    }
  });

  it('requires the reset only if the lower-bracket finalist wins the first grand final', () => {
    const initial = generateDoubleElimination(['a', 'b', 'c', 'd'], { bestOf: 1, finalBestOf: 1 });
    const upperWins = playBracket(initial);
    expect(findMatch(upperWins.bracket, 'de-reset').status).toBe('skipped');
    expect(upperWins.played).not.toContain('de-reset');
    const lowerWins = playBracket(initial, () => 'B');
    expect(findMatch(lowerWins.bracket, 'de-reset').status).toBe('complete');
    expect(lowerWins.played).toContain('de-reset');
    const noReset = playBracket(generateDoubleElimination(['a', 'b', 'c', 'd'], { bestOf: 1, finalBestOf: 1, resetFinal: false }), () => 'B');
    expect(noReset.bracket.matches).toHaveLength(6);
    expect(noReset.bracket.winnerTeamId).toBeTruthy();
  });

  it('does not accept a reset game while its activation is still pending', () => {
    let bracket = generateDoubleElimination(['a', 'b', 'c', 'd'], { bestOf: 1, finalBestOf: 1 });
    const games = {};
    while (findMatch(bracket, 'de-final').status !== 'ready') {
      for (const match of bracket.matches.filter(match => match.status === 'ready')) games[match.key] = [accepted(match.key, 'A')];
      bracket = progressPlayoffs(bracket, games);
    }
    expect(findMatch(bracket, 'de-reset').status).toBe('waiting');
    const premature = progressPlayoffs(bracket, { ...games, 'de-final': [accepted('grand-final', 'B')], 'de-reset': [accepted('reset-game', 'B')] });
    expect(premature.winnerTeamId).toBeNull();
    expect(premature.conflicts).toContainEqual({ code: 'conditional-game-before-activation', matchKey: 'de-reset' });
  });

  it.each(['site', 'pdf'])('keeps the six-team beta %s variant explicit and playable', variant => {
    const bracket = generateNexusSixPlayoffs(['a', 'b', 'c', 'd', 'e', 'f'], { variant, firstSeedOpponent: 3 });
    expect(findMatch(bracket, 'nx-m1')).toMatchObject({ teamAId: 'a', teamBId: 'c', bestOf: 3 });
    expect(findMatch(bracket, 'nx-m2')).toMatchObject({ teamAId: 'b', teamBId: 'd' });
    expect(findMatch(bracket, 'nx-m6').bestOf).toBe(variant === 'site' ? 3 : 5);
    expect(findMatch(bracket, 'nx-m8').bestOf).toBe(5);
    const { bracket: complete, played } = playBracket(bracket);
    expect(complete.winnerTeamId).toBe('a');
    expect(played).toHaveLength(8);
  });

  it('distinguishes the published lower-bracket paths of the beta variants', () => {
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'];
    const site = generateNexusSixPlayoffs(teams, { variant: 'site' });
    const pdf = generateNexusSixPlayoffs(teams, { variant: 'pdf' });
    expect(findMatch(site, 'nx-m3')).toMatchObject({ sourceA: { type: 'seed', seed: 6 }, sourceB: { type: 'loser', matchKey: 'nx-m1' } });
    expect(findMatch(site, 'nx-m4')).toMatchObject({ sourceA: { type: 'seed', seed: 5 }, sourceB: { type: 'loser', matchKey: 'nx-m2' } });
    expect(findMatch(pdf, 'nx-m3')).toMatchObject({ teamAId: 'e', teamBId: 'f' });
    expect(findMatch(pdf, 'nx-m4')).toMatchObject({ sourceA: { type: 'winner', matchKey: 'nx-m3' }, sourceB: { type: 'loser', matchKey: 'nx-m1' } });
    expect(findMatch(pdf, 'nx-m5')).toMatchObject({ sourceA: { type: 'winner', matchKey: 'nx-m4' }, sourceB: { type: 'loser', matchKey: 'nx-m2' } });
  });

  it('invalidates both winner and loser descendants after an upper-bracket correction', () => {
    const { bracket, games } = playBracket(generateDoubleElimination(['a', 'b', 'c', 'd'], { bestOf: 1, finalBestOf: 1 }));
    const corrected = progressPlayoffs(bracket, { ...games, 'de-u1-m1': [accepted('de-u1-m1-0', 'B')] });
    expect(corrected.winnerTeamId).toBeNull();
    expect(corrected.invalidatedMatchKeys).toContain('de-u2-m1');
    expect(corrected.invalidatedMatchKeys).toContain('de-l1-m1');
    expect(findMatch(corrected, 'de-final').result).toBeNull();
  });

  it('creates disjoint balanced groups with unique fixtures and odd-team byes', () => {
    const teams = Array.from({ length: 10 }, (_, index) => `t${index + 1}`);
    const tournament = generateGroups(teams, { groupCount: 3, legs: 2, bestOf: 3 });
    expect(tournament.groups.map(group => group.teamIds.length)).toEqual([3, 3, 4]);
    expect(tournament.groups.flatMap(group => group.teamIds).sort()).toEqual([...teams].sort());
    expect(new Set(tournament.matches.map(match => match.key)).size).toBe(tournament.matches.length);
    for (const group of tournament.groups) {
      expect(group.matches).toHaveLength(group.teamIds.length * (group.teamIds.length - 1));
      expect(group.matches.every(match => match.groupId === group.id && group.teamIds.includes(match.teamAId) && group.teamIds.includes(match.teamBId))).toBe(true);
    }
    expect(() => generateGroups(['a', 'b', 'c'], { groupCount: 2 })).toThrow();
  });

  it('validates custom fixtures against existing teams and round occupancy', () => {
    const teams = ['a', 'b', 'c'];
    const custom = validateCustomFixtures(teams, [{ teamAId: 'a', teamBId: 'b', round: 1 }, { teamAId: 'a', teamBId: 'b', round: 2, bestOf: 5 }]);
    expect(custom.matches).toHaveLength(2);
    expect(custom.matches[1].bestOf).toBe(5);
    expect(() => validateCustomFixtures(teams, [{ teamAId: 'a', teamBId: 'x' }])).toThrow();
    expect(() => validateCustomFixtures(teams, [{ teamAId: 'a', teamBId: 'a' }])).toThrow();
    expect(() => validateCustomFixtures(teams, [{ teamAId: 'a', teamBId: 'b' }, { teamAId: 'b', teamBId: 'c' }])).toThrow();
  });
});

describe('Swiss rounds and configurable tiebreakers', () => {
  it('uses head-to-head points before global game difference when configured', () => {
    const fixtures = [fixture('ab', 'a', 'b', ['A', 'B', 'A'], 3), fixture('ac', 'a', 'c', ['A', 'B', 'A'], 3),
      fixture('ad', 'a', 'd', ['B', 'B'], 3), fixture('bc', 'b', 'c', ['A', 'A'], 3), fixture('bd', 'b', 'd', ['A', 'A'], 3), fixture('cd', 'c', 'd', ['A', 'A'], 3)];
    const table = calculateStandings(['b', 'a', 'c', 'd'], fixtures, { qualificationCount: 1, tieBreakers: ['headToHead', 'gameDifference'] });
    expect(table.rows[0]).toMatchObject({ teamId: 'a', points: 6, qualified: true, headToHeadPoints: 3 });
    expect(table.rows.find(row => row.teamId === 'b').gameDifference).toBeGreaterThan(table.rows[0].gameDifference);
  });

  it('keeps a cyclic mini-table tie unresolved after all configured criteria', () => {
    const table = calculateStandings(['c', 'a', 'b'], [fixture('ab', 'a', 'b', ['A']), fixture('bc', 'b', 'c', ['A']), fixture('ca', 'c', 'a', ['A'])],
      { qualificationCount: 2, tieBreakers: ['headToHead', 'gameDifference'] });
    expect(table.qualificationBlocked).toBe(true);
    expect(table.rows.every(row => row.headToHeadPoints === 3 && row.rank === 1 && row.qualified === null)).toBe(true);
  });

  it('accounts for a Swiss bye as explicit points without invented games', () => {
    const table = calculateStandings(['a', 'b', 'c'], [fixture('ab', 'a', 'b', ['A'])], { byes: [{ round: 1, teamId: 'c' }], byePoints: 2 });
    expect(table.rows.find(row => row.teamId === 'c')).toMatchObject({ points: 2, byes: 1, seriesPlayed: 0, gamesPlayed: 0, gamesWon: 0 });
    expect(() => calculateStandings(['a', 'b'], [], { byes: [{ round: 1, teamId: 'a' }, { round: 1, teamId: 'a' }] })).toThrow();
  });

  it.each([4, 6, 8])('pairs %i teams without repeats across consecutive Swiss rounds', count => {
    const teams = Array.from({ length: count }, (_, index) => `t${index + 1}`);
    const fixtures = [];
    const pairs = new Set();
    for (let round = 1; round <= 3; round += 1) {
      const next = generateSwissRound(teams, fixtures, { round });
      expect(next.blocked).toBe(false);
      expect(next.matches).toHaveLength(count / 2);
      expect(new Set(next.matches.flatMap(match => [match.teamAId, match.teamBId])).size).toBe(count);
      for (const match of next.matches) {
        const key = [match.teamAId, match.teamBId].sort().join('|');
        expect(pairs.has(key)).toBe(false); pairs.add(key);
        fixtures.push({ ...match, games: [accepted(match.key, 'A')] });
      }
    }
    if (count === 4) expect(generateSwissRound(teams, fixtures, { round: 4 })).toMatchObject({ blocked: true, issues: [{ code: 'no-pairing-without-rematch' }] });
  });

  it('assigns the lowest eligible team a bye and never awards a second bye', () => {
    const teams = ['a', 'b', 'c', 'd', 'e']; const fixtures = []; const previousByes = [];
    for (let round = 1; round <= 5; round += 1) {
      const next = generateSwissRound(teams, fixtures, { round, previousByes });
      expect(next.blocked).toBe(false);
      expect(next.byes).toHaveLength(1);
      if (round === 1) expect(next.byes).toEqual(['e']);
      expect(previousByes.some(bye => bye.teamId === next.byes[0])).toBe(false);
      previousByes.push({ round, teamId: next.byes[0] });
      fixtures.push(...next.matches.map(match => ({ ...match, games: [accepted(match.key, 'A')] })));
    }
    expect(generateSwissRound(teams, fixtures, { round: 6, previousByes }).blocked).toBe(true);
  });

  it('requires complete consecutive rounds and all recorded byes', () => {
    const unfinished = { ...fixture('ab', 'a', 'b', ['A'], 3), round: 1 };
    expect(generateSwissRound(['a', 'b'], [unfinished], { round: 2 })).toMatchObject({ blocked: true, issues: [{ code: 'incomplete-previous-round', previousRound: 1 }] });
    expect(generateSwissRound(['a', 'b'], [], { round: 3 }).blocked).toBe(true);
    const finished = { ...fixture('ab', 'a', 'b', ['A']), round: 1 };
    expect(generateSwissRound(['a', 'b', 'c'], [finished], { round: 2 }).blocked).toBe(true);
    expect(generateSwissRound(['a', 'b'], [finished], { round: 1 }).blocked).toBe(true);
  });

  it('rejects reused accepted games and double participation in historical rounds', () => {
    const ab = { ...fixture('ab', 'a', 'b', ['A']), round: 1 };
    const cd = { ...fixture('cd', 'c', 'd', ['A']), round: 1 };
    cd.games[0].gameId = ab.games[0].gameId;
    expect(generateSwissRound(['a', 'b', 'c', 'd'], [ab, cd], { round: 2 })).toMatchObject({ blocked: true, issues: [{ code: 'conflicting-round-results' }] });
    expect(generateSwissRound(['a', 'b', 'c'], [ab, { ...fixture('ac', 'a', 'c', ['A']), round: 1 }], { round: 2 }).blocked).toBe(true);
  });
});
