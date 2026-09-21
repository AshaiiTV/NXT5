import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import type { Context } from '@netlify/functions';

const { query, transaction, auth, logger } = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), auth: vi.fn(), logger: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: Object.assign(query, { transaction }) }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: auth, assertSessionSecret: vi.fn() }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: vi.fn() }));
import handler from '../../netlify/functions/player-matchups';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = id(1), LINKED = id(2), STAFF = id(3), VIEWER = id(4), FOREIGN = id(5), SAME_NAME = id(6);
const TEAM = id(10), OTHER_TEAM = id(11), PLAYER = id(20), OTHER_PLAYER = id(21), FOREIGN_PLAYER = id(22);
const MATCH = id(30), EXPERIMENT = id(90);
let db: PGlite;
let beforeBatch: (() => Promise<void>) | undefined;
const statement = (parts: TemplateStringsArray) => parts.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, '');

const emptyPlan = () => ({ lanePlan: '', vigilance: '', toKeep: '' });
const saveBody = (overrides: Record<string, any> = {}) => ({
  action: 'save', teamId: TEAM, playerId: PLAYER, champion: 'Orianna', opponentChampion: 'Syndra', role: 'MID',
  expectedRevision: 0, plan: emptyPlan(), experiments: [], ...overrides
});
const experiment = (matchIds = [MATCH]) => ({
  id: EXPERIMENT, title: 'Premier achat défensif', plan: 'Tester un achat anticipé.',
  observation: 'Lane stabilisée.', conclusion: '', status: 'active', matchIds
});
const request = (body: unknown, options: { method?: string; headers?: Record<string, string> } = {}) => handler(new Request('https://nxt5.test/.netlify/functions/player-matchups', {
  method: 'POST', headers: { 'content-type': 'application/json', ...options.headers }, body: JSON.stringify(body), ...options
}), {} as Context);
function asUser(userId: string) { auth.mockResolvedValue({ id: userId, name: userId === SAME_NAME ? 'Player' : 'Camille', account_name: `user-${userId}` }); }

beforeAll(async () => {
  vi.spyOn(console, 'error').mockImplementation(logger);
  db = new PGlite();
  await db.waitReady;
  const baseline = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  await db.exec(baseline.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')"));
  await db.exec(await readFile(new URL('../../database/migrations/20260915_player_matchups.sql', import.meta.url), 'utf8'));
  await db.exec("create table app_schema_migrations(migration_key text primary key); insert into app_schema_migrations values ('player-matchups-20260915-v1')");
  query.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    return (await db.query(statement(parts), values)).rows;
  });
  transaction.mockImplementation(async (build: any) => {
    const hook = beforeBatch;
    beforeBatch = undefined;
    await hook?.();
    const batch = build((parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: statement(parts), values }));
    return db.transaction(async connection => {
      const results = [];
      for (const item of batch) results.push((await connection.query(item.sql, item.values)).rows);
      return results;
    });
  });
}, 30_000);

beforeEach(async () => {
  logger.mockClear();
  query.mockClear();
  transaction.mockClear();
  beforeBatch = undefined;
  await db.exec('truncate users, teams, team_members, players, matches, match_participants, player_matchup_notebooks cascade');
  for (const userId of [OWNER, LINKED, STAFF, VIEWER, FOREIGN, SAME_NAME]) {
    await db.query('insert into users(id, account_name, name, password_hash) values ($1,$2,$3,$4)', [userId, `user-${userId}`, userId === SAME_NAME ? 'Player' : 'Camille', 'hash']);
  }
  await db.query("insert into teams(id,owner_id,name,tag) values ($1,$2,'Team','NXT'),($3,$4,'Other','OTH')", [TEAM, OWNER, OTHER_TEAM, FOREIGN]);
  await db.query("insert into team_members(team_id,user_id,role) values ($1,$2,'player'),($1,$3,'coach'),($1,$4,'viewer'),($1,$5,'player')", [TEAM, LINKED, STAFF, VIEWER, SAME_NAME]);
  await db.query(`insert into players(id,team_id,user_id,name,role,roster_status) values
    ($1,$2,$3,'Player','MID','MAIN'),($4,$2,null,'Other player','MID','SUB'),($5,$6,$7,'Foreign player','MID','MAIN')`,
  [PLAYER, TEAM, LINKED, OTHER_PLAYER, FOREIGN_PLAYER, OTHER_TEAM, FOREIGN]);
  await addGame(MATCH);
  asUser(OWNER);
});

afterAll(async () => { await db?.close(); vi.restoreAllMocks(); });

async function addGame(matchId: string, options: { teamId?: string; playerId?: string; champion?: string; enemy?: string; role?: string; enemyRole?: string } = {}) {
  const teamId = options.teamId || TEAM;
  await db.query('insert into matches(id,team_id,game_id) values ($1,$2,$3)', [matchId, teamId, `EUW1-${matchId}`]);
  await db.query(`insert into match_participants(match_id,player_id,team_key,champion,role) values
    ($1,$2,'ALLY',$3,$4),($1,null,'ENEMY',$5,$6)`,
  [matchId, options.playerId || PLAYER, options.champion || 'Orianna', options.role || 'MIDDLE', options.enemy || 'Syndra', options.enemyRole || 'MID']);
}

describe('matchup notebook endpoint with PostgreSQL', () => {
  it('shares team notebooks with viewers but restricts edits to the linked player, staff or owner', async () => {
    const saved = await request(saveBody({ plan: { ...emptyPlan(), lanePlan: 'Préparer le retour.' } }));
    expect(saved.status).toBe(200);
    const { notebook } = await saved.json();
    expect(notebook).toMatchObject({ champion: 'orianna', opponentChampion: 'syndra', revision: 1, updatedByName: 'Camille' });
    expect(notebook.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(notebook).sort()).toEqual(['id', 'champion', 'opponentChampion', 'role', 'plan', 'experiments', 'revision', 'updatedAt', 'updatedByName'].sort());

    asUser(VIEWER);
    const listed = await request({ action: 'list', teamId: TEAM, playerId: PLAYER, champion: 'ORIANNA' });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ notebooks: [notebook], canEdit: false });
    expect((await request(saveBody({ expectedRevision: 1 }))).status).toBe(403);

    asUser(SAME_NAME);
    expect((await request(saveBody({ expectedRevision: 1 }))).status).toBe(403);
    asUser(LINKED);
    expect((await request(saveBody({ expectedRevision: 1 }))).status).toBe(200);
    for (const [index, role] of ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].entries()) {
      await db.query('update team_members set role=$1 where user_id=$2', [role, STAFF]);
      asUser(STAFF);
      expect((await request(saveBody({ expectedRevision: index + 2 }))).status).toBe(200);
    }
  });

  it('rejects outsiders, a foreign profile, and a formerly linked player without membership', async () => {
    asUser(FOREIGN);
    for (const body of [saveBody(), { action: 'list', teamId: TEAM, playerId: PLAYER, champion: 'Orianna' }]) {
      expect((await request(body)).status).toBe(403);
    }
    asUser(OWNER);
    expect((await request(saveBody({ playerId: FOREIGN_PLAYER }))).status).toBe(404);
    await db.query('delete from team_members where user_id=$1', [LINKED]);
    asUser(LINKED);
    expect((await request(saveBody())).status).toBe(403);
  });

  it('associates only unambiguous games from the exact team, player, champions and role', async () => {
    const valid = await request(saveBody({ experiments: [experiment()] }));
    expect(valid.status).toBe(200);
    expect((await valid.json()).notebook.experiments).toEqual([experiment()]);

    await addGame(id(31), { teamId: OTHER_TEAM, playerId: FOREIGN_PLAYER });
    await addGame(id(32), { playerId: OTHER_PLAYER });
    await addGame(id(33), { champion: 'Ahri' });
    await addGame(id(34), { enemy: 'Ahri' });
    await addGame(id(35), { role: 'TOP', enemyRole: 'TOP' });
    await addGame(id(36));
    await db.query("insert into match_participants(match_id,team_key,champion,role) values ($1,'ENEMY','Ahri','MIDDLE')", [id(36)]);
    await addGame(id(37), { enemyRole: 'UNKNOWN' });
    await addGame(id(38));
    await db.query("update match_participants set player_id=null, summoner_name='Player' where match_id=$1 and team_key='ALLY'", [id(38)]);
    for (const badId of [id(31), id(32), id(33), id(34), id(35), id(36), id(37), id(38), id(39)]) {
      const response = await request(saveBody({ expectedRevision: 1, experiments: [experiment([badId])] }));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('INVALID_MATCHUP_GAMES');
    }
    expect((await db.query('select revision from player_matchup_notebooks')).rows).toEqual([{ revision: 1 }]);
  });

  it('normalizes champion punctuation and role aliases without merging notebook roles or profiles', async () => {
    await db.query("update match_participants set champion=case when team_key='ALLY' then 'Kai’Sa' else 'Kog''Maw' end, role=case when team_key='ALLY' then 'BOTTOM' else 'ADC' end where match_id=$1", [MATCH]);
    const response = await request(saveBody({ champion: 'Kai’Sa', opponentChampion: "Kog'Maw", role: 'ADC', experiments: [experiment()] }));
    expect(response.status).toBe(200);
    expect((await response.json()).notebook).toMatchObject({ champion: 'kaisa', opponentChampion: 'kogmaw', role: 'ADC' });
    expect((await request(saveBody({ champion: 'Kaisa', opponentChampion: 'KogMaw', role: 'ADC' }))).status).toBe(409);
    expect((await request(saveBody({ champion: 'Kaisa', opponentChampion: 'KogMaw', role: 'MID' }))).status).toBe(200);
    expect((await request(saveBody({ playerId: OTHER_PLAYER, champion: 'Kaisa', opponentChampion: 'KogMaw', role: 'ADC' }))).status).toBe(200);
    const listed = await request({ action: 'list', teamId: TEAM, playerId: PLAYER, champion: 'Kai Sa' });
    expect((await listed.json()).notebooks).toHaveLength(2);
  });

  it('keeps one winner for concurrent first saves and updates, preserving the newer revision', async () => {
    const first = await Promise.all(['first', 'second'].map(lanePlan => request(saveBody({ plan: { ...emptyPlan(), lanePlan } }))));
    expect(first.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await first.find(response => response.status === 409)!.json()).code).toBe('NOTEBOOK_REVISION_CONFLICT');
    const updates = await Promise.all(['third', 'fourth'].map(lanePlan => request(saveBody({ expectedRevision: 1, plan: { ...emptyPlan(), lanePlan } }))));
    expect(updates.map(response => response.status).sort()).toEqual([200, 409]);
    const accepted = (await updates.find(response => response.status === 200)!.json()).notebook;
    const stale = await request(saveBody({ expectedRevision: 1, plan: { ...emptyPlan(), lanePlan: 'lost' } }));
    expect(stale.status).toBe(409);
    const stored = (await db.query('select revision, plan from player_matchup_notebooks')).rows;
    expect(stored).toEqual([{ revision: 2, plan: accepted.plan }]);
    expect((await request(saveBody({ opponentChampion: 'Ahri', expectedRevision: 5 }))).status).toBe(409);
  });

  it.each([
    ['the enemy role changes', "update match_participants set role='TOP' where match_id=$1 and team_key='ENEMY'"],
    ['the enemy champion changes', "update match_participants set champion='Ahri' where match_id=$1 and team_key='ENEMY'"],
    ['the allied profile link changes', "update match_participants set player_id=null where match_id=$1 and team_key='ALLY'"],
    ['a second enemy makes the lane ambiguous', "insert into match_participants(match_id,team_key,champion,role) values ($1,'ENEMY','Syndra','MID')"],
    ['a match is deleted', 'delete from matches where id=$1'],
  ])('rolls back a save when %s after validation', async (_label, mutation) => {
    expect((await request(saveBody({ plan: { ...emptyPlan(), lanePlan: 'Conserver cette version.' } }))).status).toBe(200);
    beforeBatch = async () => { await db.query(mutation, [MATCH]); };
    const response = await request(saveBody({ expectedRevision: 1, experiments: [experiment()] }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('NOTEBOOK_REFERENCE_CHANGED');
    expect((await db.query('select revision, plan, experiments from player_matchup_notebooks')).rows).toEqual([
      { revision: 1, plan: { ...emptyPlan(), lanePlan: 'Conserver cette version.' }, experiments: [] }
    ]);
  });

  it.each([
    [STAFF, "update team_members set role='viewer' where user_id=$1"],
    [LINKED, 'delete from team_members where user_id=$1'],
    [LINKED, 'update players set user_id=null where user_id=$1'],
  ])('rechecks edit permission at commit for user %s', async (userId, mutation) => {
    asUser(userId);
    beforeBatch = async () => { await db.query(mutation, [userId]); };
    const response = await request(saveBody());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('NOTEBOOK_REFERENCE_CHANGED');
    expect((await db.query('select * from player_matchup_notebooks')).rows).toEqual([]);
  });

  it('rejects a deleted profile after validation without leaking SQL diagnostics', async () => {
    beforeBatch = async () => { await db.query('delete from players where id=$1', [PLAYER]); };
    const response = await request(saveBody());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('NOTEBOOK_REFERENCE_CHANGED');
    expect((await db.query('select * from player_matchup_notebooks')).rows).toEqual([]);
  });

  it('validates strict fields, UUIDs, text bounds and duplicate links before writing', async () => {
    const goodExperiment = experiment();
    const invalidBodies = [
      saveBody({ extra: true }), saveBody({ teamId: 'not-a-uuid' }), saveBody({ playerId: 7 }), saveBody({ champion: '!!!' }),
      saveBody({ role: 'MIDDLE' }), saveBody({ expectedRevision: -1 }), saveBody({ expectedRevision: 1.5 }),
      saveBody({ plan: { ...emptyPlan(), extra: 'ignored?' } }), saveBody({ plan: { ...emptyPlan(), lanePlan: 'x'.repeat(4001) } }),
      saveBody({ plan: { ...emptyPlan(), lanePlan: 42 } }), saveBody({ plan: { ...emptyPlan(), lanePlan: '\u0000' } }),
      saveBody({ experiments: [goodExperiment, goodExperiment] }),
      saveBody({ experiments: [{ ...goodExperiment, id: 'wrong' }] }),
      saveBody({ experiments: [{ ...goodExperiment, status: 'arbitrary' }] }),
      saveBody({ experiments: [{ ...goodExperiment, title: '   ' }] }),
      saveBody({ experiments: [{ ...goodExperiment, title: 'x'.repeat(121) }] }),
      saveBody({ experiments: [{ ...goodExperiment, observation: 'x'.repeat(2001) }] }),
      saveBody({ experiments: [{ ...goodExperiment, matchIds: [MATCH, MATCH] }] }),
      saveBody({ experiments: [{ ...goodExperiment, matchIds: ['invalid'] }] }),
      saveBody({ experiments: [{ ...goodExperiment, matchIds: Array.from({ length: 51 }, (_, i) => id(100 + i)) }] }),
      saveBody({ experiments: Array.from({ length: 21 }, (_, i) => ({ ...goodExperiment, id: id(100 + i) })) }),
      { action: 'list', teamId: TEAM, playerId: PLAYER, champion: 'Orianna', plan: emptyPlan() }
    ];
    for (const body of invalidBodies) expect((await request(body)).status).toBe(400);
    expect((await db.query('select * from player_matchup_notebooks')).rows).toEqual([]);
    expect((await request(saveBody())).status).toBe(200);
  });

  it('rejects oversized and cross-site payloads and redacts database diagnostics from logs', async () => {
    expect((await request(saveBody({ plan: { ...emptyPlan(), lanePlan: 'x'.repeat(262145) } }))).status).toBe(413);
    expect((await request(saveBody(), { headers: { origin: 'https://evil.test' } })).status).toBe(403);
    logger.mockClear();
    const privateText = 'PRIVATE COACHING NOTE';
    query.mockRejectedValueOnce(Object.assign(new Error(`SQL error ${privateText}`), { detail: privateText, parameters: [privateText] }));
    const response = await request(saveBody({ plan: { ...emptyPlan(), lanePlan: privateText } }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(privateText);
    expect(logger).toHaveBeenCalledOnce();
    expect(logger.mock.calls[0][0].message).toBe('Player matchup request failed.');
    expect(logger.mock.calls[0][0]).not.toHaveProperty('parameters');
    expect(logger.mock.calls[0][0]).not.toHaveProperty('detail');
  });

  it('enforces team/profile consistency in SQL and cascades notebooks while retaining notes after author deletion', async () => {
    const insert = "insert into player_matchup_notebooks(team_id,player_id,champion,opponent_champion,role) values ($1,$2,'orianna','syndra','MID')";
    await expect(db.query(insert, [TEAM, FOREIGN_PLAYER])).rejects.toMatchObject({ code: '23503' });
    asUser(STAFF);
    expect((await request(saveBody())).status).toBe(200);
    await db.query('delete from users where id=$1', [STAFF]);
    expect((await db.query('select updated_by, revision from player_matchup_notebooks')).rows).toEqual([{ updated_by: null, revision: 1 }]);
    asUser(OWNER);
    const listed = await request({ action: 'list', teamId: TEAM, playerId: PLAYER, champion: 'Orianna' });
    expect((await listed.json()).notebooks[0].updatedByName).toBeNull();
    await db.query('delete from users where id=$1', [LINKED]);
    expect((await db.query('select user_id from players where id=$1', [PLAYER])).rows).toEqual([{ user_id: null }]);
    expect((await db.query('select revision from player_matchup_notebooks')).rows).toEqual([{ revision: 1 }]);
    await db.query('delete from players where id=$1', [PLAYER]);
    expect((await db.query('select * from player_matchup_notebooks')).rows).toEqual([]);
    expect((await request(saveBody({ playerId: OTHER_PLAYER }))).status).toBe(200);
    await db.query('delete from teams where id=$1', [TEAM]);
    expect((await db.query('select * from player_matchup_notebooks')).rows).toEqual([]);
  });
});
