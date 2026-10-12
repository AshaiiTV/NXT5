import { describe, expect, it } from 'vitest';
import { buildDraftIntelligence } from '../utils/draft-intelligence.js';
import { drafterOrderEvidence } from '../../shared/draft-order.js';

const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const blue = ['Ornn', 'Vi', 'Orianna', 'Jinx', 'Lulu'];
const red = ['Gnar', 'Sejuani', 'Ahri', 'Ashe', 'Braum'];
function draft(id = 'draft', row = {}, snapshot = {}) {
  return { id, allySide: 'blue', matchId: id, ...row, snapshot: {
    source: 'drafter.lol', sourceDraftId: id, sourceId: 'series', gameNumber: 1,
    status: 'completed', firstPick: 'blue', patch: '16.20', fearless: false,
    importedAt: '2026-10-12T08:00:00Z', bluePicks: blue, redPicks: red,
    blueBans: ['Rumble', 'Poppy', 'Azir', 'Kalista', 'Thresh'],
    redBans: ['Renekton', 'MonkeyKing', 'Syndra', 'Caitlyn', 'Nautilus'],
    orderEvidence: drafterOrderEvidence({ firstSelection: false, firstPick: 'blue', secondPick: 'red' }, true),
    ...snapshot,
  } };
}
function match(source, overrides = {}) {
  return { id: source.matchId, team_id: 'team', participants: ['ALLY', 'ENEMY'].flatMap(camp => {
    const side = camp === 'ALLY' ? source.allySide : source.allySide === 'blue' ? 'red' : 'blue';
    return source.snapshot[`${side}Picks`].map((champion, index) => ({ champion, role: roles[index], team_key: camp, player_id: camp === 'ALLY' ? `player-${roles[index]}` : null }));
  }), ...overrides };
}
const ban = (model, champion, camp = 'enemy') => model.camps[camp].bans.find(entry => entry.champion === champion);
const player = { id: 'player-MID', team_id: 'team', name: 'Nxt', role: 'MID' };
const pool = (overrides = {}) => ({ id: 'pool', team_id: 'team', player_id: player.id, role: 'MID', source: 'manual', status: 'lock', champion: 'Syndra', ...overrides });

describe('draft intelligence', () => {
  it('identifies opposing bans as bans against us, independently of our map side', () => {
    const first = draft('blue'); const second = draft('red', { allySide: 'red' });
    const model = buildDraftIntelligence([first, second]);
    expect(model.coverage).toMatchObject({ total: 2, ordered: 2, linked: 2, roleLinked: 0 });
    expect(ban(model, 'Syndra')).toMatchObject({ count: 1, total: 2, rate: 50, observed: 1, sources: [first], unknownPhase: 0, phase1: { count: 1, total: 2 }, phase2: { count: 0, total: 2 } });
    expect(ban(model, 'Azir')).toMatchObject({ count: 1, total: 2, sources: [second] });
    expect(ban(model, 'Syndra', 'ally').sources).toEqual([second]);
  });

  it('preserves independent denominators, explicit skipped bans and unknown chronology', () => {
    const complete = draft('full');
    const partial = draft('partial', {}, { redBans: ['Renekton', 'MonkeyKing', 'Syndra', 'Caitlyn', null] });
    const skipped = draft('skip', {}, { redBans: ['Renekton', 'MonkeyKing', 'Syndra', 'Caitlyn', null], banStates: { red: ['selected', 'selected', 'selected', 'selected', 'skipped'] } });
    const legacy = draft('old', {}, { orderEvidence: undefined });
    const model = buildDraftIntelligence([complete, partial, skipped, legacy]);
    expect(model.camps.enemy.coverage).toEqual({ bans: 3, phase1: 3, phase2: 2 });
    expect(ban(model, 'Syndra')).toMatchObject({ observed: 4, count: 3, total: 3, unknownPhase: 1,
      phase1: { count: 3, total: 3 }, phase2: { count: 0, total: 2 } });
    expect(ban(model, 'Nautilus').slots[4]).toMatchObject({ slot: 5, count: 1, total: 2 });
    expect(model.camps.enemy.bans.every(entry => entry.champion && entry.champion !== 'None')).toBe(true);
    expect(model.rotations.find(entry => entry.id === 'opening-1').count).toBe(3);
  });

  it('uses the latest source snapshot once, normalizes aliases and rejects duplicate sets', () => {
    const older = draft('same', {}, { importedAt: '2026-10-11T08:00:00Z' });
    const newer = draft('same', { id: 'new-id', allySide: 'red' });
    for (const sources of [[older, newer], [newer, older], [newer, newer]]) {
      const model = buildDraftIntelligence(sources);
      expect(model.drafts).toEqual([newer]);
      expect(ban(model, 'Azir')).toMatchObject({ count: 1, total: 1 });
    }
    const model = buildDraftIntelligence([draft('alias', {}, { redBans: ['Renekton', 'Wukong', 'Syndra', 'Caitlyn', 'Nautilus'] }),
      draft('duplicate', {}, { redBans: ['Wukong', 'MonkeyKing', 'Syndra', 'Caitlyn', 'Nautilus'] })]);
    expect(ban(model, 'MonkeyKing')).toMatchObject({ observed: 2, count: 1, total: 1 });
    expect(ban(model, 'Wukong')).toBeUndefined();
    expect(model.camps.enemy.coverage.phase1).toBe(1);
  });

  it('groups actual pick blocks, including mirrored red opening and our responding rotations', () => {
    const first = draft('blue-opening');
    const mirrored = draft('red-opening', { allySide: 'red' }, { firstPick: 'red', orderEvidence: drafterOrderEvidence({ firstSelection: true, firstPick: 'red', secondPick: 'blue' }, true) });
    const response = draft('blue-response', {}, { firstPick: 'red', orderEvidence: drafterOrderEvidence({ firstSelection: true, firstPick: 'red', secondPick: 'blue' }, true) });
    const model = buildDraftIntelligence([first, mirrored, response], [match(first), match(mirrored), match(response)]);
    const open = model.rotations.find(entry => entry.id === 'opening-1');
    expect(open).toMatchObject({ count: 2, total: 2, labels: ['B1', 'R1'], roleCoverage: 2 });
    expect(open.champions).toEqual(expect.arrayContaining([expect.objectContaining({ champion: 'Ornn', count: 1, total: 2 }), expect.objectContaining({ champion: 'Gnar', count: 1, total: 2 })]));
    expect(open.roles).toEqual([expect.objectContaining({ role: 'TOP', count: 2, total: 2 })]);
    const duo = model.rotations.find(entry => entry.id === 'responding-1');
    expect(duo).toMatchObject({ count: 1, labels: ['B1–B2'], phase: 1, slots: [1, 2] });
    expect(duo.champions.map(entry => entry.champion).sort()).toEqual(['Ornn', 'Vi']);
    expect(model.rotations.find(entry => entry.id === 'responding-4')).toMatchObject({ count: 1, phase: 2, labels: ['B5'] });
  });

  it('keeps historical role evidence separate from current explicitly declared player pools', () => {
    const source = draft();
    const history = { id: 'history', team_id: 'team', participants: [{ team_key: 'ALLY', champion: 'Syndra', role: 'MIDDLE', player_id: player.id }] };
    const options = { teamId: 'team', players: [player, { ...player, id: 'foreign', team_id: 'elsewhere' }], championPool: [pool(), pool({ id: 'alias' }), pool({ source: 'riot' }), pool({ id: 'unknown-role', role: 'UNK' }), pool({ id: 'name-only', player_id: null, player_name: player.name }), pool({ id: 'foreign', player_id: 'foreign' }), pool({ id: 'other-team', team_id: 'other' })] };
    const model = buildDraftIntelligence([source], [history, history, { ...history, id: 'wrong-team', team_id: 'other' }, match(source)], options);
    expect(ban(model, 'Syndra').roles).toEqual([{ role: 'MID', games: 1, players: ['Nxt'], matches: [history] }]);
    expect(ban(model, 'Syndra').poolPlayers).toEqual([{ id: player.id, name: 'Nxt', role: 'MID', status: 'lock' }]);
    expect(ban(model, 'Syndra').alternatives).toEqual([expect.objectContaining({ champion: 'Orianna', role: 'MID', count: 1, total: 1, sources: [source] })]);
    expect(model.camps.ally.bans.every(entry => entry.poolPlayers.length === 0)).toBe(true);
    expect(ban(buildDraftIntelligence([source], [], options), 'Syndra').roles).toEqual([]);
  });

  it('honors explicit off-role and substitute pools without inventing a role for a substitute', () => {
    const substitute = { id: 'substitute', team_id: 'team', name: 'Sub', role: 'SUB' };
    const options = { teamId: 'team', players: [player, substitute], championPool: [
      pool(), pool({ id: 'offrole', role: 'TOP' }),
      pool({ id: 'sub', player_id: substitute.id, role: 'SUP', source: 'riot_manual', status: 'pocket' }),
      pool({ id: 'unknown-sub-role', player_id: substitute.id, role: '' }),
    ] };
    expect(ban(buildDraftIntelligence([draft()], [], options), 'Syndra').poolPlayers).toEqual([
      { id: player.id, name: 'Nxt', role: 'MID', status: 'lock' },
      { id: player.id, name: 'Nxt', role: 'TOP', status: 'lock' },
      { id: substitute.id, name: 'Sub', role: 'SUP', status: 'pocket' },
    ]);
  });

  it('counts exposed player drafts once when multiple prepared champions are banned together', () => {
    const first = draft('first');
    const second = draft('second', {}, { redBans: ['Renekton', 'MonkeyKing', 'Azir', 'Caitlyn', 'Nautilus'] });
    const untouched = { ...player, id: 'untouched', name: 'Untouched' };
    const options = { teamId: 'team', players: [player, untouched], championPool: [
      pool(), pool({ id: 'second-pick', champion: 'Nautilus' }),
      pool({ id: 'duplicate-pick', champion: 'Syndra' }),
      pool({ id: 'untouched-pool', player_id: untouched.id, champion: 'Ahri' }),
    ] };
    const model = buildDraftIntelligence([first, second], [], options);
    expect(model.poolCoverage).toBe(2);
    expect(model.poolPressure).toHaveLength(1);
    expect(model.poolPressure[0]).toMatchObject({ id: player.id, name: player.name, role: 'MID', count: 2, total: 2 });
    expect(new Set(model.poolPressure[0].sources)).toEqual(new Set([first, second]));
    expect(model.poolPressure[0].champions).toEqual(expect.arrayContaining([
      { champion: 'Syndra', count: 1, sources: [first] },
      { champion: 'Nautilus', count: 2, sources: [first, second] },
    ]));
  });

  it('retains explicit partial-ban exposure and valid substitute coverage without inventing missing bans', () => {
    const partial = draft('partial', {}, { redBans: [null, null, 'Syndra', null, null] });
    const unknown = draft('unknown', {}, { redBans: [null, null, null, null, null] });
    const substitute = { ...player, id: 'substitute', name: 'Sub', role: 'SUB' };
    const options = { teamId: 'team', players: [substitute], championPool: [pool({ player_id: substitute.id, role: 'SUP' })] };
    const model = buildDraftIntelligence([partial, unknown], [], options);
    expect(model.camps.enemy.coverage.bans).toBe(0);
    expect(model.poolCoverage).toBe(1);
    expect(model.poolPressure).toEqual([{
      id: substitute.id, name: 'Sub', role: 'SUP', count: 1, total: 2, sources: [partial],
      champions: [{ champion: 'Syndra', count: 1, sources: [partial] }],
    }]);
    expect(buildDraftIntelligence([partial])).toMatchObject({ poolPressure: [], poolCoverage: 0 });
    expect(buildDraftIntelligence([partial], [], { teamId: 'team', players: [player], championPool: [
      pool({ source: 'riot' }), pool({ id: '' }), pool({ id: 'unknown-role', role: 'UNK' }),
      pool({ id: 'no-player', player_id: '' }), pool({ id: 'wrong-team', team_id: 'other' }), pool({ id: 'no-champion', champion: '' }),
    ] })).toMatchObject({ poolPressure: [], poolCoverage: 0 });
  });

  it('does not enrich mismatched, incomplete or ambiguous played compositions with draft roles', () => {
    const good = draft('good'); const bad = draft('bad'); const missing = draft('missing'); const ambiguous = draft('ambiguous');
    const mismatch = match(bad); mismatch.participants[0] = { ...mismatch.participants[0], champion: 'Malphite' };
    const noRole = match(missing); noRole.participants[0] = { ...noRole.participants[0], role: '' };
    const duplicateRole = match(ambiguous); duplicateRole.participants[1] = { ...duplicateRole.participants[1], role: 'TOP' };
    const model = buildDraftIntelligence([good, bad, missing, ambiguous], [match(good), mismatch, noRole, duplicateRole]);
    expect(model.coverage).toMatchObject({ matched: 4, roleLinked: 3, mismatched: 1 });
    const opening = model.rotations.find(entry => entry.id === 'opening-1');
    expect(opening.champions).toEqual([expect.objectContaining({ champion: 'Ornn', count: 4, total: 4 })]);
    expect(opening.roles).toEqual([expect.objectContaining({ role: 'TOP', count: 1, total: 1, sources: [good] })]);
    expect(opening.roleCoverage).toBe(1);
  });

  it('derives observed responses only from linked compatible source games and known unique roles', () => {
    const good = draft('good'); const bad = draft('bad'); const unknown = draft('unknown');
    const history = { id: 'history', participants: [{ team_key: 'ALLY', champion: 'Syndra', role: 'MID' }, { team_key: 'ENEMY', champion: 'Azir', role: 'MID' }] };
    const mismatch = match(bad); mismatch.participants[6].champion = 'LeeSin';
    const noRole = match(unknown); noRole.participants[2].role = 'UNKNOWN';
    const model = buildDraftIntelligence([good, bad, unknown], [history, match(good), mismatch, noRole]);
    expect(ban(model, 'Syndra').alternatives).toEqual([expect.objectContaining({ champion: 'Orianna', count: 1, total: 1, sources: [good] })]);
    expect(ban(model, 'Azir', 'ally').alternatives).toEqual([expect.objectContaining({ champion: 'Ahri', count: 2, total: 2, sources: [good, unknown] })]);
  });

  it('does not invent role intent, results or pool associations from missing evidence', () => {
    const input = [draft('normal'), draft('fearless', {}, { fearless: true, patch: '16.19' }), draft('invalid', { allySide: '' })];
    const before = JSON.stringify(input);
    const model = buildDraftIntelligence(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(model.warnings).toHaveLength(1);
    expect(model.patches).toEqual(['16.19', '16.20']); expect(model.modes).toEqual(['fearless', 'standard']);
    expect(model.camps.enemy.bans.every(entry => entry.roles.length === 0 && entry.alternatives.length === 0 && entry.poolPlayers.length === 0)).toBe(true);
    expect(model).not.toHaveProperty('winrate');
    expect(buildDraftIntelligence()).toMatchObject({ drafts: [], coverage: { total: 0 }, camps: { enemy: { bans: [] } } });
  });
});
