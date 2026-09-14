import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMigrations } from '../../tools/migration-runner.mjs';

const state = vi.hoisted(() => ({ pg: null as any, beforeQuery: null as null | ((query: string) => Promise<void>) }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const statement = JSON.parse(options.body);
    try {
      await state.beforeQuery?.(statement.query);
      const result = await state.pg.query(statement.query, statement.params);
      return new Response(JSON.stringify({ fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          return value instanceof Date ? value.toISOString() : String(value);
        })), rowCount: result.affectedRows ?? result.rows.length }));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});

import deleteAccount from '../../netlify/functions/auth-delete-account';
import login from '../../netlify/functions/auth-login';
import { createSession, requireAuth, sha256 } from '../../netlify/functions/_lib/auth';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const teamId = '00000000-0000-4000-8000-000000000003';
const playerId = '00000000-0000-4000-8000-000000000004';
const matchId = '00000000-0000-4000-8000-000000000005';
const password = 'Current account password';
const cookie = 'current-session-token';
const context = { cookies: { get: () => cookie, set: vi.fn() } } as any;
const request = () => new Request('https://nxt5.test/auth-delete-account', { method: 'POST' });
const call = (body: any, currentContext = context) => deleteAccount(new Request(request(), { body: JSON.stringify(body) }), currentContext);
async function account() { return (await state.pg.query('select * from users where id = $1', [userId])).rows[0]; }
async function prepare(teamPlan = {}, deleteEmptyTeams = false) {
  const response = await call({ action: 'prepare', acknowledged: true, teamPlan, deleteEmptyTeams });
  expect(response.status).toBe(200);
  return (await response.json()).confirmationToken;
}
const remove = (token: string, overrides = {}) => call({ action: 'delete', confirmationToken: token,
  currentPassword: password, confirmation: 'SUPPRIMER', acknowledged: true, ...overrides });
async function seedTeam(owner = userId, withOtherMember = true) {
  await state.pg.query('insert into teams(id, owner_id, name, tag) values ($1, $2, $3, $4)', [teamId, owner, 'Shared team', 'SHR']);
  await state.pg.query("insert into team_members(team_id, user_id, role) values ($1, $2, 'captain')", [teamId, userId]);
  if (withOtherMember) await state.pg.query("insert into team_members(team_id, user_id, role) values ($1, $2, 'member')", [teamId, otherId]);
}

beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 'a'.repeat(64));
  state.pg = new PGlite();
  await state.pg.exec('create table app_schema_migrations(migration_key text primary key)');
  for (const migration of await loadMigrations()) {
    await state.pg.exec(migration.sql.replace(/create extension if not exists pgcrypto;/g, '')
      .replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')"));
    await state.pg.query('insert into app_schema_migrations values ($1)', [migration.key]);
  }
}, 20_000);
beforeEach(async () => {
  state.beforeQuery = null;
  context.cookies.set.mockClear();
  await state.pg.exec('truncate users cascade; truncate rate_limits, audit_logs, account_deletion_receipts');
  for (const [id, name] of [[userId, 'original'], [otherId, 'successor']]) {
    await state.pg.query(`insert into users(id, account_name, name, email, password_hash, email_verified)
      values ($1, $2, $2, $3, $4, true)`, [id, name, `${name}@example.test`, bcrypt.hashSync(password, 4)]);
  }
  await state.pg.query("insert into sessions(user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')", [userId, sha256(cookie)]);
});
afterAll(async () => { await state.pg?.close(); vi.unstubAllEnvs(); });

describe('account deletion security and atomic purge', () => {
  it('requires a trusted POST and an authenticated session', async () => {
    expect((await deleteAccount(new Request(request(), { method: 'GET' }), context)).status).toBe(405);
    expect((await deleteAccount(new Request(request(), { headers: { origin: 'https://evil.test' } }), context)).status).toBe(403);
    expect((await call({ action: 'inspect' }, { cookies: { get: () => null, set: vi.fn() } })).status).toBe(401);
    expect((await account()).deleted_at).toBeNull();
  });

  it('requires both confirmations and the correct password', async () => {
    expect((await call({ action: 'prepare', teamPlan: {} })).status).toBe(400);
    const token = await prepare();
    expect((await remove(token, { confirmation: 'supprimer' })).status).toBe(400);
    expect((await remove(token, { acknowledged: false })).status).toBe(400);
    expect((await remove(token, { currentPassword: 'wrong' })).status).toBe(401);
    expect((await account()).deleted_at).toBeNull();
    expect((await state.pg.query('select * from account_deletion_receipts')).rows).toHaveLength(0);
  });

  it.each(['expired', 'other-session', 'changed-password'])('rolls back when confirmation is %s', async (kind) => {
    const token = await prepare();
    if (kind === 'expired') await state.pg.exec("update account_deletion_confirmations set expires_at = now() - interval '1 second'");
    if (kind === 'other-session') await state.pg.exec("update account_deletion_confirmations set session_hash = 'another-session'");
    if (kind === 'changed-password') state.beforeQuery = async (query) => {
      if (!query.includes('nxt5_delete_account')) return;
      state.beforeQuery = null;
      await state.pg.query('update users set password_hash = $1 where id = $2', [bcrypt.hashSync('New password', 4), userId]);
    };
    expect((await remove(token)).status).toBe(409);
    expect((await account()).deleted_at).toBeNull();
  });

  it('purges personal rows, transfers a shared team and preserves its history', async () => {
    await seedTeam();
    await state.pg.query("insert into players(id, team_id, user_id, name, riot_id, role) values ($1,$2,$3,'Original player','Original#EUW','TOP')", [playerId, teamId, userId]);
    await state.pg.query("insert into champion_pool(team_id, player_id, player_name, champion) values ($1,$2,'Original player','Ahri')", [teamId, playerId]);
    await state.pg.query("insert into player_availability(team_id, player_id, notes) values ($1,$2,'Private schedule')", [teamId, playerId]);
    await state.pg.query("insert into player_coaching_notes(team_id, player_id, content) values ($1,$2,'Private coaching')", [teamId, playerId]);
    await state.pg.query("insert into matches(id, team_id, game_id, created_by) values ($1,$2,'EUW_1',$3)", [matchId, teamId, userId]);
    await state.pg.query("insert into match_participants(match_id, player_id, team_key, summoner_name, riot_id, champion, raw) values ($1,$2,'ALLY','Original player','Original#EUW','Ahri','{\"secret\":true}')", [matchId, playerId]);
    await state.pg.query("insert into password_reset_tokens(user_id, token_hash, expires_at) values ($1,'reset',now() + interval '1 day')", [userId]);
    await state.pg.query("insert into audit_logs(user_id,action,metadata) values ($1,'old.action','{\"email\":\"original@example.test\"}')", [userId]);
    const inspected = await (await call({ action: 'inspect' })).json();
    expect(inspected.teams[0].members).toEqual([{ id: otherId, name: 'successor' }]);
    const token = await prepare({ [teamId]: otherId });
    const response = await remove(token);
    expect(response.status).toBe(200);
    const { receipt } = await response.json();
    expect(receipt.summary).toMatchObject({ teamsTransferred: 1, profilesPurged: 1, sessionsRemoved: 1 });
    expect(await account()).toMatchObject({ email: null, name: 'Compte supprimé', password_hash: '!deleted', notif_match: false, notif_inactivity: false });
    expect((await account()).deleted_at).toBeTruthy();
    for (const table of ['sessions', 'password_reset_tokens', 'players', 'champion_pool', 'player_availability', 'player_coaching_notes', 'account_deletion_confirmations']) {
      expect((await state.pg.query(`select * from ${table}`)).rows).toHaveLength(0);
    }
    expect((await state.pg.query('select owner_id from teams')).rows).toEqual([{ owner_id: otherId }]);
    expect((await state.pg.query('select user_id, role from team_members')).rows).toEqual([{ user_id: otherId, role: 'captain' }]);
    expect((await state.pg.query('select id, created_by from matches')).rows).toEqual([{ id: matchId, created_by: null }]);
    expect((await state.pg.query('select player_id, summoner_name, riot_id, raw from match_participants')).rows)
      .toEqual([{ player_id: null, summoner_name: 'Joueur supprimé', riot_id: null, raw: {} }]);
    const logs = (await state.pg.query('select * from audit_logs')).rows;
    expect(logs.find((log: any) => log.action === 'auth.account_deleted')).toMatchObject({ id: receipt.reference, user_id: null });
    expect(JSON.stringify(logs)).not.toContain('original@example.test');
    expect(JSON.stringify(receipt)).not.toContain(userId);
    expect(context.cookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: 'rb_session', maxAge: 0 }));
  });

  it('requires separate consent for removing a team with no other member', async () => {
    await seedTeam(userId, false);
    expect((await call({ action: 'prepare', acknowledged: true, teamPlan: { [teamId]: 'delete' } })).status).toBe(400);
    const token = await prepare({ [teamId]: 'delete' }, true);
    expect((await remove(token)).status).toBe(200);
    expect((await state.pg.query('select * from teams')).rows).toHaveLength(0);
  });

  it('rolls everything back if a new member joined a team approved for deletion', async () => {
    await seedTeam(userId, false);
    const token = await prepare({ [teamId]: 'delete' }, true);
    await state.pg.query("insert into team_members(team_id,user_id,role) values ($1,$2,'member')", [teamId, otherId]);
    expect((await remove(token)).status).toBe(409);
    expect((await account()).deleted_at).toBeNull();
    expect((await state.pg.query('select * from teams')).rows).toHaveLength(1);
    expect((await state.pg.query('select * from sessions')).rows).toHaveLength(1);
  });

  it('rolls back transfers and purge when writing the audit fails', async () => {
    await seedTeam();
    const token = await prepare({ [teamId]: otherId });
    await state.pg.exec("alter table audit_logs add constraint simulate_audit_failure check(action <> 'auth.account_deleted')");
    try {
      expect((await remove(token)).status).toBe(503);
      expect((await account()).deleted_at).toBeNull();
      expect((await state.pg.query('select owner_id from teams')).rows).toEqual([{ owner_id: userId }]);
      expect((await state.pg.query('select * from account_deletion_receipts')).rows).toHaveLength(0);
    } finally { await state.pg.exec('alter table audit_logs drop constraint simulate_audit_failure'); }
  });

  it('recovers an identical receipt without a session and never repeats the purge', async () => {
    const token = await prepare();
    const first = await (await remove(token)).json();
    const missingSession = { cookies: { get: () => null, set: vi.fn() } };
    const recovered = await (await call({ action: 'status', confirmationToken: token }, missingSession)).json();
    expect(recovered).toEqual(first);
    expect(await (await remove(token)).json()).toEqual(first);
    expect((await state.pg.query('select * from account_deletion_receipts')).rows).toHaveLength(1);
    expect(await (await call({ action: 'status', confirmationToken: 'x'.repeat(43) }, missingSession)).json()).toEqual({ ok: false, pending: true });
  });

  it('blocks login, new sessions, recovery tokens and reactivation after deletion', async () => {
    const token = await prepare();
    expect((await remove(token)).status).toBe(200);
    await expect(requireAuth(request(), context)).rejects.toMatchObject({ status: 401 });
    expect((await login(new Request('https://nxt5.test/auth-login', { method: 'POST', body: JSON.stringify({ accountName: 'original', password }) }), context)).status).toBe(401);
    await expect(createSession({ userId, context, request: request() })).rejects.toThrow('ACCOUNT_DELETED');
    await expect(state.pg.query("update users set name = 'Restore' where id = $1", [userId])).rejects.toThrow('ACCOUNT_DELETED');
    await expect(state.pg.query("insert into password_reset_tokens(user_id, token_hash, expires_at) values ($1,'later',now())", [userId])).rejects.toThrow('ACCOUNT_DELETED');
  });
});
