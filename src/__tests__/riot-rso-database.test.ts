import { afterEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const { schemaQuery } = vi.hoisted(() => ({ schemaQuery: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: schemaQuery }));
const databases: PGlite[] = [];
const KEY = 'riot-sign-on-20260923-v1';
const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const MISSING = '00000000-0000-4000-8000-000000000099';
const hash = (character: string) => character.repeat(64);
afterEach(async () => {
  await Promise.all(databases.splice(0).map(db => db.close()));
  vi.resetModules();
  schemaQuery.mockReset();
});

async function fixture(beforeRiot = false) {
  const db = new PGlite(); databases.push(db);
  await db.waitReady;
  const client = { query: async (sql: string, params?: unknown[]) => params
    ? db.query(sql, params) : (await db.exec(sql)).at(-1) || { rows: [] } };
  const migrations = (await loadMigrations()).map(m => ({ ...m,
    // UUID generation is built into PGlite; the optional pgcrypto extension is not.
    sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '')
      .replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')")
  }));
  const riotIndex = migrations.findIndex(m => m.key === KEY);
  expect(riotIndex).toBeGreaterThan(0);
  await applyMigrations(client, beforeRiot ? migrations.slice(0, riotIndex) : migrations);
  await db.query(`insert into users(id, account_name, name, password_hash, email)
    values ($1, 'original', 'Original account', 'existing-hash', 'original@example.test'),
           ($2, 'other', 'Other account', 'other-hash', 'other@example.test')`, [USER, OTHER]);
  return { db, client, migrations, riot: migrations[riotIndex] };
}

async function identity(db: PGlite, user = USER, puuid = 'riot-puuid-original') {
  return db.query('insert into riot_identities(user_id, puuid, game_name, tag_line) values ($1,$2,$3,$4) returning *',
    [user, puuid, 'Verified Riot name', 'EUW']);
}

function flowValues(overrides: Record<string, unknown> = {}) {
  return {
    state_hash: hash('a'), browser_hash: hash('b'), flow: 'login', user_id: null,
    session_hash: null, link_revision: null, nonce: 'N'.repeat(43), code_verifier: 'V'.repeat(43),
    remember: false, created_at: '2026-09-23T12:00:00Z', expires_at: '2026-09-23T12:05:00Z', ...overrides
  };
}

async function flow(db: PGlite, overrides: Record<string, unknown> = {}) {
  const values = flowValues(overrides);
  return db.query(`insert into riot_auth_flows (${Object.keys(values).join(',')})
    values (${Object.keys(values).map((_, index) => `$${index + 1}`).join(',')}) returning *`, Object.values(values));
}

async function sessions(db: PGlite) {
  await db.query(`insert into sessions(user_id, token_hash, expires_at) values
    ($1, $3, now() + interval '1 day'), ($1, $4, now() + interval '1 day'),
    ($2, $5, now() + interval '1 day')`, [USER, OTHER, hash('c'), hash('d'), hash('e')]);
}

async function unlink(db: PGlite, user = USER, password = 'existing-hash', session = hash('c')) {
  return db.query('select unlink_riot_identity($1, $2, $3) as unlinked', [user, password, session]);
}

describe('additive Riot database migration', () => {
  it('preserves credentials, memberships, players and subscriptions, and reruns without changing linked identities', async () => {
    const { db, client, migrations, riot } = await fixture(true);
    await sessions(db);
    const team = (await db.query<{ id: string }>(`insert into teams(owner_id, name, tag)
      values ($1, 'Preserved team', 'NXT') returning id`, [USER])).rows[0].id;
    await db.query(`insert into team_members(team_id, user_id, role) values ($1,$2,'captain'),($1,$3,'analyst')`, [team, USER, OTHER]);
    await db.query(`insert into players(team_id, user_id, name, riot_id, role)
      values ($1,$2,'Unverified roster name','Manual name#TAG','MID')`, [team, USER]);
    const tables = ['users', 'sessions', 'teams', 'team_members', 'players', 'account_subscriptions'];
    const before = Object.fromEntries(await Promise.all(tables.map(async table => [table, (await db.query(`select * from ${table} order by 1`)).rows])));
    expect(await applyMigrations(client, migrations)).toEqual([KEY]);
    expect((await db.query('select riot_link_revision from users')).rows).toEqual([{ riot_link_revision: 0 }, { riot_link_revision: 0 }]);
    for (const table of tables) {
      const rows = (await db.query<Record<string, unknown>>(`select * from ${table} order by 1`)).rows;
      expect(table === 'users' ? rows.map(({ riot_link_revision: _revision, ...row }) => row) : rows).toEqual(before[table]);
    }
    expect((await db.query('select * from riot_identities')).rows).toEqual([]);
    await identity(db);
    const linked = (await db.query('select * from riot_identities')).rows;
    expect(await applyMigrations(client, migrations)).toEqual([]);
    await db.exec(riot.sql);
    expect((await db.query('select * from riot_identities')).rows).toEqual(linked);
  }, 30_000);

  it('enforces PUUID ownership and one identity per NXT5 user for independent competing claims', async () => {
    const { db } = await fixture();
    // PGlite serializes its clients; these independently submitted statements
    // exercise PostgreSQL uniqueness, not real multi-connection lock contention.
    const claims = await Promise.all([USER, OTHER].map(user => db.query(
      'insert into riot_identities(user_id, puuid) values ($1,$2) on conflict do nothing returning user_id', [user, 'shared-puuid'])));
    expect(claims.flatMap(result => result.rows)).toHaveLength(1);
    const winner = (await db.query<{ user_id: string }>('select user_id from riot_identities')).rows[0].user_id;
    const loser = winner === USER ? OTHER : USER;
    await expect(identity(db, loser, 'shared-puuid')).rejects.toMatchObject({ code: '23505' });
    await expect(identity(db, winner, 'new-puuid')).rejects.toMatchObject({ code: '23505' });
    await identity(db, loser, 'independent-puuid');
    await expect(db.query('update riot_identities set puuid = $1 where user_id = $2', ['shared-puuid', loser])).rejects.toMatchObject({ code: '23505' });
    expect((await db.query('select count(*)::integer as count from riot_identities')).rows).toEqual([{ count: 2 }]);
  });

  it('bounds identity metadata and revisions and requires existing account references', async () => {
    const { db } = await fixture();
    for (const puuid of ['', 'x'.repeat(129)]) await expect(identity(db, USER, puuid)).rejects.toMatchObject({ code: '23514' });
    await expect(identity(db, MISSING)).rejects.toMatchObject({ code: '23503' });
    await identity(db);
    await expect(db.query('update riot_identities set game_name = $1', ['x'.repeat(101)])).rejects.toMatchObject({ code: '23514' });
    await expect(db.query('update riot_identities set tag_line = $1', ['x'.repeat(33)])).rejects.toMatchObject({ code: '23514' });
    await db.query('update riot_identities set game_name = null, tag_line = null');
    await expect(db.query('update users set riot_link_revision = -1 where id = $1', [USER])).rejects.toMatchObject({ code: '23514' });
  });

  it('enforces login/link separation, secret formats and the five-minute state lifetime', async () => {
    const { db } = await fixture();
    const invalid = [
      { state_hash: hash('A') }, { state_hash: 'a'.repeat(63) }, { browser_hash: hash('z') },
      { nonce: 'n'.repeat(42) }, { nonce: 'n'.repeat(129) }, { code_verifier: 'v'.repeat(42) },
      { code_verifier: `${'v'.repeat(42)}+` }, { flow: 'unknown' }, { user_id: USER },
      { session_hash: hash('c') }, { link_revision: 0 }, { flow: 'link' },
      { flow: 'link', user_id: USER, session_hash: hash('c') },
      { flow: 'link', user_id: USER, session_hash: hash('c'), link_revision: -1 },
      { expires_at: '2026-09-23T12:00:00Z' }, { expires_at: '2026-09-23T11:59:59Z' },
      { expires_at: '2026-09-23T12:05:00.001Z' }
    ];
    for (const values of invalid) await expect(flow(db, values)).rejects.toMatchObject({ code: '23514' });
    await flow(db);
    await flow(db, { state_hash: hash('f'), flow: 'link', user_id: USER, session_hash: hash('c'), link_revision: 0 });
    expect((await db.query('select flow, remember from riot_auth_flows order by flow')).rows)
      .toEqual([{ flow: 'link', remember: false }, { flow: 'login', remember: false }]);
    await expect(flow(db, { state_hash: hash('0'), flow: 'link', user_id: MISSING, session_hash: hash('c'), link_revision: 0 }))
      .rejects.toMatchObject({ code: '23503' });
  });

  it('consumes matching unexpired state once across independent callbacks', async () => {
    const { db } = await fixture();
    const now = new Date();
    await flow(db, { created_at: now.toISOString(), expires_at: new Date(now.getTime() + 300_000).toISOString() });
    const consume = (browser: string) => db.query(`delete from riot_auth_flows
      where state_hash = $1 and browser_hash = $2 and expires_at > now() returning *`, [hash('a'), browser]);
    expect((await consume(hash('f'))).rows).toEqual([]);
    const claims = await Promise.all([consume(hash('b')), consume(hash('b'))]);
    expect(claims.flatMap(result => result.rows)).toHaveLength(1);
    expect((await consume(hash('b'))).rows).toEqual([]);
    await flow(db, { created_at: new Date(now.getTime() - 300_000).toISOString(), expires_at: new Date(now.getTime() - 1).toISOString() });
    expect((await consume(hash('b'))).rows).toEqual([]);
  });

  it('cascades account deletion to the association and link state without touching another account or login state', async () => {
    const { db } = await fixture();
    await identity(db); await identity(db, OTHER, 'other-puuid'); await sessions(db);
    await flow(db);
    await flow(db, { state_hash: hash('f'), flow: 'link', user_id: USER, session_hash: hash('c'), link_revision: 0 });
    await db.query('delete from users where id = $1', [USER]);
    expect((await db.query('select user_id from riot_identities')).rows).toEqual([{ user_id: OTHER }]);
    expect((await db.query('select flow from riot_auth_flows')).rows).toEqual([{ flow: 'login' }]);
    expect((await db.query('select user_id from sessions')).rows).toEqual([{ user_id: OTHER }]);
  });

  it('rolls back an incomplete deployment including its marker and the new account column', async () => {
    const { db, client, migrations, riot } = await fixture(true);
    const before = (await db.query('select * from users order by id')).rows;
    const broken = migrations.map(m => m.key === KEY ? { ...m, sql: `${riot.sql}\nselect * from missing_riot_deployment_table;` } : m);
    await expect(applyMigrations(client, broken)).rejects.toMatchObject({ code: '42P01' });
    expect((await db.query('select * from users order by id')).rows).toEqual(before);
    expect((await db.query('select migration_key from app_schema_migrations where migration_key = $1', [KEY])).rows).toEqual([]);
    expect((await db.query("select to_regclass('riot_identities') as identity, to_regclass('riot_auth_flows') as flows")).rows)
      .toEqual([{ identity: null, flows: null }]);
    expect(await applyMigrations(client, migrations)).toEqual([KEY]);
  });
});

describe('atomic Riot unlinking', () => {
  it('removes the identity and pending links, revokes other sessions, and prevents a delayed session from an old revision', async () => {
    const { db } = await fixture();
    await identity(db); await sessions(db); await flow(db);
    await flow(db, { state_hash: hash('f'), flow: 'link', user_id: USER, session_hash: hash('c'), link_revision: 0 });
    expect((await unlink(db)).rows).toEqual([{ unlinked: true }]);
    expect((await db.query('select * from riot_identities')).rows).toEqual([]);
    expect((await db.query('select flow from riot_auth_flows')).rows).toEqual([{ flow: 'login' }]);
    expect((await db.query('select token_hash, revoked_at is not null as revoked from sessions order by token_hash')).rows)
      .toEqual([{ token_hash: hash('c'), revoked: false }, { token_hash: hash('d'), revoked: true }, { token_hash: hash('e'), revoked: false }]);
    expect((await db.query('select riot_link_revision, password_hash, account_name from users where id = $1', [USER])).rows)
      .toEqual([{ riot_link_revision: 1, password_hash: 'existing-hash', account_name: 'original' }]);
    // Even relinking the same PUUID cannot resurrect an authorization that was
    // started before unlinking: its saved epoch is permanently stale.
    await identity(db);
    const delayed = await db.query(`with locked_user as (
      select id from users where id = $1 and riot_link_revision = 0 for update
    ) insert into sessions(user_id, token_hash, expires_at)
      select id, $2, now() + interval '1 day' from locked_user returning id`, [USER, hash('f')]);
    expect(delayed.rows).toEqual([]);
    const definition = (await db.query<{ prosecdef: boolean; provolatile: string }>(
      "select prosecdef, provolatile from pg_proc where proname = 'unlink_riot_identity'"
    )).rows[0];
    expect(definition).toEqual({ prosecdef: false, provolatile: 'v' });
  });

  it('rejects a changed password, another account, expired/revoked sessions, and unusable password credentials', async () => {
    const { db } = await fixture(); await identity(db); await sessions(db);
    for (const values of [[USER, 'wrong', hash('c')], [MISSING, 'existing-hash', hash('c')], [USER, 'existing-hash', hash('e')]]) {
      expect((await unlink(db, ...values as [string, string, string])).rows).toEqual([{ unlinked: false }]);
    }
    await db.query("update sessions set expires_at = now() - interval '1 second' where token_hash = $1", [hash('c')]);
    expect((await unlink(db)).rows).toEqual([{ unlinked: false }]);
    await db.query("update sessions set expires_at = now() + interval '1 day', revoked_at = now() where token_hash = $1", [hash('c')]);
    expect((await unlink(db)).rows).toEqual([{ unlinked: false }]);
    await db.query('update sessions set revoked_at = null where token_hash = $1', [hash('c')]);
    await db.query("update users set account_name = ' ' where id = $1", [USER]);
    expect((await unlink(db)).rows).toEqual([{ unlinked: false }]);
    await db.query("update users set account_name = 'original', password_hash = '' where id = $1", [USER]);
    expect((await unlink(db, USER, '')).rows).toEqual([{ unlinked: false }]);
    expect((await db.query('select riot_link_revision from users where id = $1', [USER])).rows).toEqual([{ riot_link_revision: 0 }]);
    expect((await db.query('select user_id from riot_identities')).rows).toEqual([{ user_id: USER }]);
  });

  it('rolls back identity removal, epoch change and state removal when session revocation fails', async () => {
    const { db } = await fixture(); await identity(db); await sessions(db);
    await flow(db, { flow: 'link', user_id: USER, session_hash: hash('c'), link_revision: 0 });
    const before = (await db.query('select * from riot_identities')).rows;
    await db.exec(`create function fail_riot_session_revocation() returns trigger language plpgsql as $$
      begin raise exception 'test revocation failed'; end; $$;
      create trigger test_failed_revocation before update on sessions for each row execute function fail_riot_session_revocation();`);
    await expect(unlink(db)).rejects.toMatchObject({ code: 'P0001' });
    expect((await db.query('select * from riot_identities')).rows).toEqual(before);
    expect((await db.query('select riot_link_revision from users where id = $1', [USER])).rows).toEqual([{ riot_link_revision: 0 }]);
    expect((await db.query('select flow from riot_auth_flows')).rows).toEqual([{ flow: 'link' }]);
    expect((await db.query('select revoked_at from sessions')).rows).toEqual([{ revoked_at: null }, { revoked_at: null }, { revoked_at: null }]);
  });
});

describe('optional Riot schema readiness', () => {
  it('keeps the existing runtime version ready independently of a missing Riot migration and retries the Riot check', async () => {
    schemaQuery.mockImplementation(async (_strings: TemplateStringsArray, version: string) =>
      version === 'audit-runtime-20260906-v1' ? [{ migration_key: version }] : []);
    const { assertSchemaReady, assertRiotSchemaReady, REQUIRED_SCHEMA_VERSION } = await import('../../netlify/functions/_lib/migrations');
    expect(REQUIRED_SCHEMA_VERSION).toBe('audit-runtime-20260906-v1');
    await expect(assertSchemaReady()).resolves.toBeUndefined();
    await expect(assertRiotSchemaReady()).rejects.toMatchObject({ status: 503, code: 'SCHEMA_MIGRATION_REQUIRED' });
    schemaQuery.mockResolvedValue([{ migration_key: KEY }]);
    await Promise.all([assertRiotSchemaReady(), assertRiotSchemaReady()]);
    await expect(assertSchemaReady()).resolves.toBeUndefined();
    expect(schemaQuery).toHaveBeenCalledTimes(3);
    expect(schemaQuery.mock.calls.map(call => call[1])).toEqual(['audit-runtime-20260906-v1', KEY, KEY]);
    for (const [strings] of schemaQuery.mock.calls) expect(strings.join('?')).toMatch(/^select migration_key/);
  });
});
