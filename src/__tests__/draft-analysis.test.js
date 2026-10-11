import { describe, expect, it } from 'vitest';
import { buildDraftAnalysis } from '../utils/draft-analysis.js';
import { drafterOrderEvidence } from '../../shared/draft-order.js';

function row(id = 'draft-1', overrides = {}, snapshotOverrides = {}) {
  return { id, opponentId: 'opponent', allySide: 'blue', ...overrides, snapshot: {
    source: 'drafter.lol', sourceDraftId: id, sourceId: 'series', gameNumber: 1, status: 'completed', firstPick: 'blue',
    bluePicks: ['Aatrox', 'Zeri', 'Braum', 'DrMundo', 'Locke'], redPicks: ['Yunara', 'Lulu', 'Anivia', 'Kennen', 'Maokai'],
    blueBans: ['Jhin', 'Khazix', 'JarvanIV', 'Gnar', 'Sylas'], redBans: ['MonkeyKing', 'Poppy', 'Thresh', 'Syndra', 'Diana'],
    orderEvidence: drafterOrderEvidence({ firstSelection: false, firstPick: 'blue', secondPick: 'red' }, true),
    importedAt: '2026-10-12T08:00:00Z', ...snapshotOverrides,
  } };
}

describe('descriptive draft analysis', () => {
  it('separates our side and the enemy and exposes evidence coverage without fabricating outcomes', () => {
    const model = buildDraftAnalysis([row('one', { matchId: 'match' }), row('two', { allySide: 'red' })]);
    expect(model).toMatchObject({ total: 2, ordered: 2, linked: 1 });
    expect(model.ally.picks).toContainEqual({ champion: 'Aatrox', count: 1, total: 2 });
    expect(model.ally.picks).toContainEqual({ champion: 'Yunara', count: 1, total: 2 });
    expect(model.enemy.bans).toContainEqual({ champion: 'MonkeyKing', count: 1, total: 2 });
    expect(model.ally.coverage.picks).toBe(2);
    expect(model).not.toHaveProperty('winrate');
    expect(model.ally).not.toHaveProperty('wins');
  });

  it('counts the first global pick only for the camp that opened, and own first choice separately', () => {
    const model = buildDraftAnalysis([row()]);
    expect(model.ally.firstPicks).toEqual([{ champion: 'Aatrox', count: 1, total: 1 }]);
    expect(model.ally.coverage.firstPicks).toBe(1);
    expect(model.enemy.firstPicks).toEqual([]);
    expect(model.enemy.coverage.firstPicks).toBe(0);
    expect(model.enemy.pickSlots[1]).toEqual([{ champion: 'Yunara', count: 1, total: 1 }]);
    expect(model.enemy.pickSlots[5]).toEqual([{ champion: 'Maokai', count: 1, total: 1 }]);
  });

  it('uses the mirrored chronology when the enemy red camp opens', () => {
    const model = buildDraftAnalysis([row('red-first', {}, { firstPick: 'red', orderEvidence: drafterOrderEvidence({ firstSelection: true, firstPick: 'red', secondPick: 'blue' }, true) })]);
    expect(model.enemy.firstPicks).toEqual([{ champion: 'Yunara', count: 1, total: 1 }]);
    expect(model.ally.firstPicks).toEqual([]);
    expect(model.enemy.banPhases[2].map(entry => entry.champion).sort()).toEqual(['Diana', 'Syndra']);
  });

  it('excludes incomplete global bans but keeps an independently complete first ban phase', () => {
    const model = buildDraftAnalysis([
      row('full'),
      row('partial', {}, { redBans: ['MonkeyKing', 'Poppy', 'Thresh', 'Syndra', null] }),
    ]);
    expect(model.enemy.coverage.bans).toBe(1);
    expect(model.enemy.bans).toContainEqual({ champion: 'MonkeyKing', count: 1, total: 1 });
    expect(model.enemy.coverage.banPhases).toEqual({ 1: 2, 2: 1 });
    expect(model.enemy.banPhases[1]).toContainEqual({ champion: 'MonkeyKing', count: 2, total: 2 });
    expect(model.enemy.banPhases[2]).toContainEqual({ champion: 'Diana', count: 1, total: 1 });
  });

  it('treats a recorded skipped ban as known coverage without counting a champion', () => {
    const model = buildDraftAnalysis([row('skip', {}, {
      redBans: ['MonkeyKing', 'Poppy', 'Thresh', 'Syndra', null],
      banStates: { red: ['selected', 'selected', 'selected', 'selected', 'skipped'] },
    })]);
    expect(model.enemy.coverage.bans).toBe(1);
    expect(model.enemy.coverage.banPhases[2]).toBe(1);
    expect(model.enemy.bans).toHaveLength(4);
    expect(model.enemy.bans.some(entry => !entry.champion || entry.champion === 'None')).toBe(false);
  });

  it('keeps legacy picks and bans but does not assign phases, pick slots or first picks from unproven order', () => {
    const model = buildDraftAnalysis([row('legacy', {}, { orderEvidence: undefined })]);
    expect(model.total).toBe(1); expect(model.ordered).toBe(0);
    expect(model.enemy.picks).toHaveLength(5); expect(model.enemy.bans).toHaveLength(5);
    expect(model.ally.coverage.firstPicks).toBe(0);
    expect(model.enemy.coverage.banPhases).toEqual({ 1: 0, 2: 0 });
    expect(model.ally.pickSlots[1]).toEqual([]);
  });

  it('deduplicates source drafts using the newest imported snapshot, independent of row order', () => {
    const older = row('source', { id: 'saved-1' });
    const newer = row('source', { id: 'saved-2', matchId: 'match', allySide: 'red', importedAt: '2026-10-12T09:00:00Z' });
    for (const input of [[older, newer], [newer, older], [newer, newer]]) {
      const model = buildDraftAnalysis(input);
      expect(model).toMatchObject({ total: 1, ordered: 1, linked: 1 });
      expect(model.ally.picks).toContainEqual({ champion: 'Yunara', count: 1, total: 1 });
      expect(model.enemy.firstPicks).toContainEqual({ champion: 'Aatrox', count: 1, total: 1 });
    }
  });

  it('normalizes aliases, counts a champion at most once per draft and rejects ambiguous duplicate bans', () => {
    const model = buildDraftAnalysis([
      row('one'),
      row('two', {}, { redBans: ['Wukong', 'Poppy', 'Thresh', 'Syndra', 'Diana'] }),
      row('duplicate', {}, { redBans: ['Wukong', 'MonkeyKing', 'Thresh', 'Syndra', 'Diana'] }),
    ]);
    expect(model.enemy.bans).toContainEqual({ champion: 'MonkeyKing', count: 2, total: 2 });
    expect(model.enemy.coverage.bans).toBe(2);
  });

  it('excludes records with unknown ally camps, unfinished snapshots or unidentifiable sources', () => {
    const invalid = [row('bad-side', { allySide: 'toString' }), row('pending', {}, { status: 'in-progress' }), row('', {}, { sourceId: null })];
    expect(buildDraftAnalysis(invalid)).toMatchObject({ total: 0, linked: 0, ordered: 0, ally: { picks: [], bans: [] } });
    expect(buildDraftAnalysis(invalid).warnings).toHaveLength(1);
    expect(buildDraftAnalysis([]).warnings).toEqual([]);
  });
});
