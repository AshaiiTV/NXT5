import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ queries: [] as { sql: string; values: any[] }[], fetch: vi.fn() }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret() {}, requireAuth: async () => ({ id: 'owner' }) }));
vi.mock('../../netlify/functions/_lib/riot-sync', async importOriginal => ({
  ...await importOriginal(),
  acquireSyncLease: async () => 'lease', releaseSyncLease: async () => {},
  assertProfileNotFresh: async () => {}, reserveSyncBudget: async () => {},
}));
vi.mock('../../netlify/functions/_lib/db', () => { const sql = async (parts: TemplateStringsArray, ...values: any[]) => {
  const sql = parts.join('?'); state.queries.push({ sql, values });
  if (sql.includes('select distinct teams')) return [{ id: 'team', region: 'EUW' }];
  if (sql.includes('select * from players')) return [{ id: 'p', role: 'MID', riot_id: 'One#EUW' }, { id: 'next', role: 'TOP', riot_id: 'Two#EUW' }];
  return [];
};
  return { sql: Object.assign(sql, { transaction: async callback => Promise.all(callback(sql)) }) };
});
vi.mock('../../netlify/functions/_lib/riot', () => ({
  fetchAccountByRiotId: async () => ({ puuid: 'puuid' }),
  fetchMatchIdsByPuuid: async () => Array.from({ length: 30 }, (_, i) => String(i)),
  fetchRiotMatchById: state.fetch, getChampionDataMap: async () => new Map(), platformFromRegion: () => 'euw1',
}));
import handler from '../../netlify/functions/players-sync-most-played';
beforeEach(() => { state.queries = []; state.fetch.mockReset(); });
it.each(['RIOT_RATE_LIMIT', 'NETWORK_FAILURE'])('T3-G2 preserves previous stats after one successful match and %s', async code => {
  state.fetch.mockImplementation(async id => {
    if (id === '0') return { info: { participants: [{ puuid: 'puuid', championId: 103, championName: 'Ahri', win: true }] } };
    throw Object.assign(new Error('Riot indisponible'), { code, retryAfter: 90 });
  });
  const response = await handler(new Request('https://nxt5.test/test', { method: 'POST', body: JSON.stringify({ teamId: 'team' }) }), {} as any);
  expect(response.status).toBe(200);
  const { results } = await response.json();
  expect(results.every((r: any) => !r.ok)).toBe(true);
  expect(state.queries.some(q => /set most_played|delete from champion_pool/.test(q.sql))).toBe(false);
  if (code === 'RIOT_RATE_LIMIT') {
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ code, retryAfter: 90 });
    expect(state.fetch.mock.calls.length).toBeLessThanOrEqual(11);
  } else {
    expect(results[0]).toMatchObject({ code: 'RIOT_SYNC_INCOMPLETE', error: 'Synchronisation incomplète' });
    expect(state.queries.filter(q => q.sql.includes('set status')).every(q => q.values.includes('Synchronisation incomplète'))).toBe(true);
  }
});
