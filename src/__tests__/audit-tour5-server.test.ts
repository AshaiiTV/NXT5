import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  pg: null as any,
  statements: [] as string[],
  beforeBatch: null as null | (() => Promise<void>)
}));

// Keep the real Neon query builder, parameter encoding and HTTP batch protocol.
// Only its transport is replaced: every statement runs against local PostgreSQL
// (PGlite). A failed batch therefore rolls back in the engine, not in a mock.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      database.statements.push(statement.query);
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if (field.dataTypeID === 114 || field.dataTypeID === 3802) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          if (value instanceof Date) return value.toISOString();
          return String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) {
        const beforeBatch = database.beforeBatch;
        database.beforeBatch = null;
        await beforeBatch?.();
        const results = await database.pg.transaction(async (tx: any) => {
          const rows = [];
          for (const statement of body.queries) rows.push(await execute(tx, statement));
          return rows;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(database.pg, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});


const actor = vi.hoisted(() => ({ id: '00000000-0000-4000-8000-000000000001' }));
const riot = vi.hoisted(() => ({ account: vi.fn(), match: vi.fn(), ids: vi.fn() }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret() {}, requireAuth: async () => actor }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/riot', () => ({
  fetchAccountByRiotId: riot.account, fetchRiotMatchById: riot.match,
  fetchMatchIdsByPuuid: riot.ids, getChampionDataMap: async () => new Map(), platformFromRegion: () => 'euw1',
}));
import sync from '../../netlify/functions/players-sync-most-played';
import update from '../../netlify/functions/players-update';
import memberRole from '../../netlify/functions/team-member-role';
import compositions from '../../netlify/functions/composition-types-manage';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = uuid(1), captain = uuid(2), teamId = uuid(3), playerId = uuid(4), poolId = uuid(5), foreignTeam = uuid(6);
const call = (handler: any, body: any) => handler(new Request('https://nxt5.test/api', { method: 'POST', body: JSON.stringify({ teamId, ...body }) }), {});
const player = async () => (await database.pg.query('select * from players where id=$1', [playerId])).rows[0];
const pool = async () => (await database.pg.query('select * from champion_pool order by id')).rows;
const audits = async () => (await database.pg.query('select * from audit_logs')).rows;

beforeAll(async () => {
  database.pg = new PGlite();
  await database.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
  await database.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
}, 20_000);
afterAll(async () => { await database.pg?.close(); });
beforeEach(async () => {
  database.beforeBatch = null;
  actor.id = owner;
  await database.pg.exec('alter table audit_logs drop constraint if exists reject_audit; truncate users cascade');
  await database.pg.query("insert into users(id,account_name,name,password_hash) values($1,'owner','Owner','hash'),($2,'captain','Captain','hash')", [owner, captain]);
  await database.pg.query("insert into teams(id,owner_id,name,tag,region) values($1,$2,'Team','TM','EUW'),($3,$2,'Foreign','FR','EUW')", [teamId, owner, foreignTeam]);
  await database.pg.query("insert into team_members(team_id,user_id,role) values($1,$2,'captain')", [teamId, captain]);
  await database.pg.query("insert into players(id,team_id,name,riot_id,role,most_played,performance_score,status) values($1,$2,'Old','Old#EUW','MID','[{\"champion\":\"Ahri\"}]',12,'Synchronisé')", [playerId, teamId]);
  await database.pg.query("insert into champion_pool(id,team_id,player_id,player_name,champion,source) values($1,$2,$3,'Old','Ahri','match_history')", [poolId, teamId, playerId]);
  riot.account.mockReset().mockResolvedValue({ puuid: 'old-puuid' });
  riot.ids.mockReset().mockResolvedValue(['EUW1_1']);
  riot.match.mockReset().mockResolvedValue({ info: { participants: [{ puuid: 'old-puuid', championId: 103, championName: 'Ahri', win: true }] } });
  database.statements = [];
});

it.each(['riot', 'role', 'region', 'permission', 'removed'])('T5-03 refuses stale Riot results after %s changes during collection', async change => {
  actor.id = captain;
  riot.account.mockImplementationOnce(async () => {
    if (change === 'riot') await database.pg.query("update players set riot_id='New#EUW',status='À synchroniser' where id=$1", [playerId]);
    if (change === 'role') await database.pg.query("update players set role='TOP' where id=$1", [playerId]);
    if (change === 'region') await database.pg.query("update teams set region='NA' where id=$1", [teamId]);
    if (change === 'permission') await database.pg.query("update team_members set role='player' where team_id=$1 and user_id=$2", [teamId, captain]);
    if (change === 'removed') await database.pg.query('delete from players where id=$1', [playerId]);
    return { puuid: 'old-puuid' };
  });
  const beforePool = await pool();
  const response = await call(sync, { playerId });
  expect(response.status).toBe(200);
  expect((await response.json()).results[0]).toMatchObject({ ok: false, code: 'PLAYER_CHANGED' });
  if (change !== 'removed') {
    expect(await player()).toMatchObject({ most_played: [{ champion: 'Ahri' }], performance_score: '12', status: change === 'riot' ? 'À synchroniser' : 'Synchronisé' });
    expect(await pool()).toEqual(beforePool);
  }
});

it('T5-03 does not overwrite the new account status when Riot fails', async () => {
  riot.account.mockImplementationOnce(async () => {
    await database.pg.query("update players set riot_id='New#EUW',status='À synchroniser' where id=$1", [playerId]);
    throw new Error('Network');
  });
  expect((await (await call(sync, { playerId })).json()).results[0]).toMatchObject({ ok: false, code: 'PLAYER_CHANGED' });
  expect((await player()).status).toBe('À synchroniser');
});

it('T5-03 saves current results and cleans the pool atomically', async () => {
  const before = await player();
  await database.pg.exec("create function reject_pool_delete() returns trigger language plpgsql as $$ begin raise exception 'pool unavailable'; end $$; create trigger reject_pool_delete before delete on champion_pool for each row execute function reject_pool_delete()");
  try {
    expect((await (await call(sync, { playerId })).json()).results[0].ok).toBe(false);
    expect(await player()).toMatchObject({ most_played: before.most_played, performance_score: before.performance_score });
    expect(await pool()).toHaveLength(1);
  } finally {
    await database.pg.exec('drop trigger reject_pool_delete on champion_pool; drop function reject_pool_delete()');
  }
  expect((await (await call(sync, { playerId })).json()).results[0].ok).toBe(true);
  expect((await player()).performance_score).toBe('1');
  expect(await pool()).toHaveLength(0);
});

it.each([
  { stage: 'account', status: 400, message: 'Riot ID invalide : Old#EUW', code: null },
  { stage: 'account', status: 404, message: 'Compte Riot introuvable : Old#EUW', code: null },
  { stage: 'ids', status: 502, message: 'Erreur Riot API 503.', code: 'RIOT_API_ERROR' },
  { stage: 'empty', status: undefined, message: 'Aucun match SoloQ trouvé sur la saison courante.', code: null },
  { stage: 'account', status: 429, message: 'Rate limit Riot atteint. Réessaie plus tard.', code: 'RIOT_RATE_LIMIT' },
  { stage: 'account', status: undefined, message: 'Internal connection details', code: null },
  { stage: 'match', status: 502, message: 'Erreur Riot API 503.', code: 'RIOT_API_ERROR' },
])('R6-02 reports the correct diagnostic for $stage / $status / $code and preserves stored stats', async ({ stage, status, message, code }) => {
  const before = await player();
  const beforePool = await pool();
  if (stage === 'empty') riot.ids.mockResolvedValueOnce([]);
  else riot[stage].mockRejectedValueOnce(Object.assign(new Error(message), { status, code, retryAfter: code === 'RIOT_RATE_LIMIT' ? 90 : undefined }));
  const response = await call(sync, { playerId });
  expect(response.status).toBe(200);
  const expectedMessage = stage === 'match' || (stage === 'account' && !status) ? 'Synchronisation incomplète' : message;
  expect((await response.json()).results).toEqual([{
    playerId, riotId: 'Old#EUW', ok: false, error: expectedMessage,
    code: stage === 'match' ? 'RIOT_SYNC_INCOMPLETE' : code,
    retryAfter: code === 'RIOT_RATE_LIMIT' ? 90 : null,
  }]);
  expect(await player()).toMatchObject({ most_played: before.most_played, performance_score: before.performance_score, status: expectedMessage });
  expect(await pool()).toEqual(beforePool);
});

it('T5-04 a demoted captain cannot restore their own role with an in-flight request', async () => {
  actor.id = captain;
  database.beforeBatch = () => database.pg.query("update team_members set role='player' where team_id=$1 and user_id=$2", [teamId, captain]);
  expect((await call(memberRole, { userId: captain, role: 'captain' })).status).toBe(403);
  expect((await database.pg.query('select role from team_members where team_id=$1 and user_id=$2', [teamId, captain])).rows[0].role).toBe('player');
  expect(await audits()).toHaveLength(0);
});
it('T5-04 missing target returns 404 without audit; audit failure rolls back role', async () => {
  database.beforeBatch = () => database.pg.query('delete from team_members where team_id=$1 and user_id=$2', [teamId, captain]);
  expect((await call(memberRole, { userId: captain, role: 'coach' })).status).toBe(404);
  expect(await audits()).toHaveLength(0);
  await database.pg.query("insert into team_members(team_id,user_id,role) values($1,$2,'captain')", [teamId, captain]);
  await database.pg.exec("alter table audit_logs add constraint reject_audit check(action <> 'team_member.role_update')");
  expect((await call(memberRole, { userId: captain, role: 'coach' })).status).toBe(500);
  expect((await database.pg.query('select role from team_members where team_id=$1 and user_id=$2', [teamId, captain])).rows[0].role).toBe('captain');
});
it('T5-04 owner can change a member with one audit', async () => {
  expect((await call(memberRole, { userId: captain, role: 'coach' })).status).toBe(200);
  expect(await audits()).toHaveLength(1);
});

it.each([[], null, { TOP: 3 }, { TOP: [] }, { TOP: { poolId: 'invalid' } }, { TOP: { other: '' } }, { UNKNOWN: null }])('T5-05 rejects malformed slots %j', async slots => {
  expect((await call(compositions, { title: 'Invalid', slots })).status).toBe(400);
  expect((await database.pg.query('select * from composition_types')).rows).toHaveLength(0);
});
it('T5-05 normalizes null slots and rejects foreign player/pool on create and update', async () => {
  actor.id = captain;
  await database.pg.query("update team_members set role='player' where team_id=$1 and user_id=$2", [teamId, captain]);
  const response = await call(compositions, { title: 'Valid', slots: { TOP: null, MID: { playerId, poolId } } });
  expect(response.status).toBe(200);
  const { composition } = await response.json();
  expect(composition.slots).toEqual({ TOP: { playerId: '', poolId: '' }, MID: { playerId, poolId } });
  const foreignPlayer = uuid(7), foreignPool = uuid(8);
  await database.pg.query("insert into players(id,team_id,name,role) values($1,$2,'Other','TOP')", [foreignPlayer, foreignTeam]);
  await database.pg.query("insert into champion_pool(id,team_id,player_id,player_name,champion) values($1,$2,$3,'Other','Ornn')", [foreignPool, foreignTeam, foreignPlayer]);
  for (const action of ['create', 'update']) for (const slot of [{ playerId: foreignPlayer }, { poolId: foreignPool }]) {
    expect((await call(compositions, { action, compositionId: composition.id, title: 'Invalid', slots: { TOP: slot } })).status).toBe(400);
  }
  expect((await database.pg.query('select title from composition_types')).rows).toEqual([{ title: 'Valid' }]);
});

it('N5-02 changing Riot ID invalidates derived stats; a name-only update keeps them', async () => {
  const body = { playerId, name: 'Renamed', riotId: 'Old#EUW' };
  expect((await call(update, body)).status).toBe(200);
  expect(await player()).toMatchObject({ most_played: [{ champion: 'Ahri' }], performance_score: '12', status: 'Synchronisé' });
  expect((await call(update, { ...body, riotId: 'New#EUW' })).status).toBe(200);
  expect(await player()).toMatchObject({ riot_id: 'New#EUW', most_played: [], performance_score: null, status: 'À synchroniser' });
});
