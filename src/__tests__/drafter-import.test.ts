import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftOrder } from '../../shared/draft-order.js';
const { query, catalog } = vi.hoisted(() => ({ query: vi.fn(), catalog: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
vi.mock('../../netlify/functions/_lib/riot', () => ({ getChampionDataMap: catalog }));
import { applyStaffSelections, importDrafterDraft, parseDrafterUrl } from '../../netlify/functions/_lib/drafter-import';

const link = 'https://drafter.lol/draft/IiYYZGok?game=2';
const teamId = 'team', matchId = 'match';
const champions = ['Aatrox', 'Anivia', 'Ashe', 'Braum', 'Diana', 'Elise', 'Gnar', 'Ivern', 'Jhin', 'Kennen', 'MonkeyKing'];
const players = champions.slice(0, 10).map((champion, i) => ({ champion, side_id: i < 5 ? '100' : '200' }));
const teams = [{ teamId: 100, bans: [{ championId: 1 }, { championId: -1 }] }, { teamId: 200 }];
const bans = (champions: string[]) => champions.map((id, i) => [i + 1, { id, name: id }] as const);
beforeEach(() => { query.mockReset(); catalog.mockReset().mockResolvedValue(new Map(bans(champions))); });
afterEach(() => { vi.unstubAllGlobals(); });
async function read(overrides: any = {}) {
  query.mockResolvedValueOnce(overrides.saved ? [{ snapshot: overrides.saved }] : [])
    .mockResolvedValueOnce([{ teams: overrides.teams ?? teams, patch: '16.20' }]).mockResolvedValueOnce(overrides.players ?? players);
  return importDrafterDraft(link, teamId, matchId);
}

describe('public Drafter URL boundary', () => {
  it('canonicalizes only the public host and drops UI/control parameters', () => {
    expect(parseDrafterUrl(`${link}&layout=lck&stream=true&team=red#anything`)).toEqual({
      sourceId: 'IiYYZGok', gameNumber: 2, sourceUrl: link,
    });
    expect(parseDrafterUrl('https://drafter.lol/draft/WHcbXs_s').gameNumber).toBe(1);
  });

  it.each([
    'http://drafter.lol/draft/IiYYZGok', 'https://127.0.0.1/draft/IiYYZGok',
    'https://drafter.lol.evil.test/draft/IiYYZGok', 'https://evil.test@drafter.lol/draft/IiYYZGok',
    'https://drafter.lol:8443/draft/IiYYZGok', 'https://drafter.lol/api/draft/IiYYZGok',
    'https://drafter.lol/draft/%49iYYZGok', 'https://drafter.lol/draft/IiYYZGok/more',
    'https://drafter.lol/draft/short', 'https://drafter.lol/draft/IiYYZGok?game=0',
    'https://drafter.lol/draft/IiYYZGok?game=6', 'https://drafter.lol/draft/IiYYZGok?game=2.5',
    'https://drafter.lol/draft/IiYYZGok?game=2&game=1', 'https://drafter.lol/draft/IiYYZGok?game=',
    'https://drafter.lol\\@localhost/draft/IiYYZGok', 'https://drafter.lol/draft/IiYYZGok\n',
  ])('refuses %s before any network request', async url => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(importDrafterDraft(url, teamId, matchId)).rejects.toMatchObject({ code: 'DRAFTER_INVALID_URL', status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('free team draft capture', () => {
  it('uses the linked game and the public champion catalogue, never contacts Drafter', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const snapshot = await read();
    expect(snapshot).toMatchObject({ gameNumber: 2, sourceUrl: link, recordedMatchId: matchId, sourceDraftId: null,
      bluePicks: champions.slice(0, 5), redPicks: champions.slice(5, 10), blueBans: ['Aatrox', null, null, null, null], redBans: [],
      selectionSources: { bluePicks: 'match', redPicks: 'match', blueBans: 'match' },
      banStates: { blue: ['selected', 'skipped', 'unknown', 'unknown', 'unknown'] } });
    expect(draftOrder(snapshot).status).toBe('unknown');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('leaves missing bans and incomplete comps unknown and accepts staff observations', async () => {
    const snapshot = await read({ teams: [], players: [] });
    expect(catalog).not.toHaveBeenCalled();
    const result = await applyStaffSelections(snapshot, { bluePicks: 'Aatrox, Anivia, Ashe, Braum, Diana',
      redPicks: 'Elise, Gnar, Ivern, Jhin, Kennen', blueBans: 'Wukong, -, ?, Ashe, Gnar', redBans: 'Jhin' });
    expect(result).toMatchObject({ redBans: ['Jhin', null, null, null, null], blueBans: ['MonkeyKing', null, null, 'Ashe', 'Gnar'],
      selectionSources: { blueBans: 'staff', redBans: 'staff', bluePicks: 'staff', redPicks: 'staff' },
      banStates: { blue: ['selected', 'skipped', 'unknown', 'selected', 'selected'] } });
    expect(snapshot.bluePicks).toEqual([]);
  });
  it('keeps staff corrections when reopening the draft, including a skipped ban', async () => {
    const saved = await applyStaffSelections(await read(), { redBans: 'Jhin, -' });
    const next = await read({ saved });
    expect(next.redBans).toEqual(saved.redBans);
    expect(next.banStates?.red).toEqual(saved.banStates?.red);
    expect(next.selectionSources?.redBans).toBe('staff');
  });
  it('retains the link and picks if the champion catalogue cannot resolve bans', async () => {
    catalog.mockRejectedValue(new Error('offline'));
    const snapshot = await read();
    expect(snapshot.bluePicks).toHaveLength(5);
    expect(snapshot.banStates?.blue).toEqual(['unknown', 'skipped', 'unknown', 'unknown', 'unknown']);
    await expect(applyStaffSelections(snapshot, { redBans: 'Jhin' })).rejects.toMatchObject({ status: 503 });
  });
  it.each([{ bluePicks: 'Ashe' }, { redBans: 'Nobody' }, { redBans: 'Ashe,Ashe' }, { sourceUrl: link }])('rejects invalid edits', async edit => {
    await expect(applyStaffSelections(await read(), edit)).rejects.toMatchObject({ status: 400 });
  });
});
