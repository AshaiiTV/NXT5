import { describe, expect, it } from 'vitest';
import { buildOpponentObservations } from '../utils/opponent-observations.js';

const picks = ['Gnar', 'Viego', 'Orianna', 'Jinx', 'Nami'];
const draftPicks = ['Yunara', 'Lulu', 'Anivia', 'Kennen', 'Maokai'];
const bans = ['MonkeyKing', 'Poppy', 'Thresh', 'Syndra', 'Diana'];
const game = { id: 'm1', opponentId: 'opif', gameId: 'EUW1_42', date: '2026-10-12T12:00:00Z', enemyPicks: picks, enemyPicksComplete: true };
const draft = { id: 'd1', matchId: 'm1', opponentId: 'opif', allySide: 'blue', snapshot: {
  source: 'drafter.lol', sourceId: 'series01', sourceDraftId: 'draft001', gameNumber: 1, status: 'completed', redPicks: draftPicks, redBans: bans,
} };
const model = (games = [game], drafts = []) => buildOpponentObservations('opif', games, drafts);

describe('opponent game observations', () => {
  it('observes games with no draft independently', () => {
    const result = model();
    expect(result.total).toBe(1); expect(result.coverage).toEqual({ played: 1, draft: 0, unknown: 0, bans: 0 });
    expect(result.playedPicks).toContainEqual({ champion: 'Jinx', count: 1, total: 1 });
  });
  it('does not create a game observation from an unattached or stale opponent draft', () => {
    expect(model([], [draft]).total).toBe(0);
    const result = model([game], [{ ...draft, matchId: null }, { ...draft, matchId: 'another' }, { ...draft, opponentId: 'other' }]);
    expect(result.coverage.bans).toBe(0); expect(result.bans).toEqual([]);
  });
  it('prefers complete played participants to a linked draft', () => {
    const result = model([game], [draft]);
    expect(result.observations[0]).toMatchObject({ pickSource: 'match', picks });
    expect(result.draftPicks).toEqual([]); expect(result.coverage.bans).toBe(1);
  });
  it('uses complete linked picks only as a separately labelled fallback', () => {
    const result = model([{ ...game, enemyPicks: ['Jinx'], enemyPicksComplete: false }], [draft]);
    expect(result.observations[0]).toMatchObject({ pickSource: 'draft', picks: draftPicks });
    expect(result.playedPicks).toEqual([]); expect(result.coverage.draft).toBe(1);
    expect(result.draftPicks).toContainEqual({ champion: 'Yunara', count: 1, total: 1 });
  });
  it('keeps partial participants visible but excludes incomplete champion frequencies', () => {
    const result = model([{ ...game, enemyPicks: ['Jinx'], enemyPicksComplete: false }]);
    expect(result.observations[0]).toMatchObject({ pickSource: 'unknown', picks: ['Jinx'] });
    expect(result.coverage.unknown).toBe(1); expect(result.playedPicks).toEqual([]);
  });
  it('does not treat malformed duplicate champions as a complete composition', () => {
    const result = model([{ ...game, enemyPicks: ['Wukong', 'MonkeyKing', 'Jinx', 'Nami', 'Gnar'] }], [{ ...draft, snapshot: { ...draft.snapshot, redPicks: ['None', ...draftPicks.slice(1)] } }]);
    expect(result.coverage.unknown).toBe(1); expect(result.draftPicks).toEqual([]);
  });
  it('deduplicates game IDs, chooses complete participants, and follows draft links to duplicate rows', () => {
    const result = model([{ ...game, enemyPicks: [], enemyPicksComplete: false }, { ...game, id: 'duplicate' }], [draft, { ...draft, id: 'duplicate-draft', matchId: 'duplicate' }]);
    expect(result.total).toBe(1); expect(result.observations[0].id).toBe('duplicate');
    expect(result.coverage.played).toBe(1); expect(result.coverage.bans).toBe(1);
    expect(result.playedPicks.every(entry => entry.count === 1 && entry.total === 1)).toBe(true);
  });
  it('falls back to match IDs and excludes matches assigned to a different opponent', () => {
    const result = model([{ ...game, gameId: null }, { ...game, id: 'm2', gameId: null }, { ...game, id: 'm3', opponentId: 'other' }]);
    expect(result.total).toBe(2); expect(result.playedPicks[0]).toMatchObject({ count: 2, total: 2 });
  });
  it('chooses the newest draft for one game and uses the opposite of allySide', () => {
    const result = model([{ ...game, enemyPicksComplete: false }], [draft, { ...draft, importedAt: '2026-10-12T13:00:00Z', allySide: 'red', snapshot: { ...draft.snapshot, bluePicks: picks, blueBans: bans } }]);
    expect(result.observations[0].picks).toEqual(picks); expect(result.coverage.bans).toBe(1);
  });
  it('excludes an unknown ban from all global ban counts', () => {
    const result = model([game], [{ ...draft, snapshot: { ...draft.snapshot, redBans: [null, ...bans.slice(1)] } }]);
    expect(result.bans).toEqual([]); expect(result.coverage.bans).toBe(0);
  });
  it('counts explicitly unused bans as known coverage without a None champion', () => {
    const result = model([game], [{ ...draft, snapshot: { ...draft.snapshot, redBans: [null, ...bans.slice(1)], banStates: { red: ['skipped', 'selected', 'selected', 'selected', 'selected'] } } }]);
    expect(result.coverage.bans).toBe(1); expect(result.bans).toHaveLength(4);
    expect(result.bans.every(entry => entry.champion !== 'None' && entry.total === 1)).toBe(true);
  });
});
