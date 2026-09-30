import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const state = vi.hoisted(() => ({
  pg: null as any,
  beforeQuery: null as null | ((query: string) => Promise<void>),
  authorize: vi.fn(), exchange: vi.fn(),
}));

// Keep the real Neon query builder and HTTP protocol; only its transport runs
// against local PostgreSQL (PGlite), with the complete migration history.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      await state.beforeQuery?.(statement.query);
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          return value instanceof Date ? value.toISOString() : String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length,
      };
    }
    try {
      if (body.queries) return new Response(JSON.stringify({ results: await state.pg.transaction(async (tx: any) => {
        const results = []; for (const query of body.queries) results.push(await execute(tx, query)); return results;
      }) }));
      return new Response(JSON.stringify(await execute(state.pg, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@account-deletion.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/social-auth-protocol', async (original) => ({
  ...await original<any>(), createSocialAuthorizationUrl: state.authorize, exchangeSocialAuthorizationCode: state.exchange,
}));

import deleteAccount from '../../netlify/functions/auth-delete-account';
import cleanup from '../../netlify/functions/auth-account-deletion-cleanup';
import login from '../../netlify/functions/auth-login';
import startSocial from '../../netlify/functions/auth-social-start';
import socialCallback from '../../netlify/functions/auth-social-callback';
import finishSocial from '../../netlify/functions/auth-social-finish';
import { COOKIE_NAME, createSession, requireAuth, sha256 } from '../../netlify/functions/_lib/auth';

const origin = 'https://nxt5.org';
const ownerId = '93000000-0000-4000-8000-000000000001';
const successorId = '93000000-0000-4000-8000-000000000002';
const coachId = '93000000-0000-4000-8000-000000000003';
const socialId = '93000000-0000-4000-8000-000000000004';
const discordUserId = '93000000-0000-4000-8000-000000000005';
const teamId = '93000000-0000-4000-8000-000000000010';
const otherTeamId = '93000000-0000-4000-8000-000000000011';
const ownerPlayerId = '93000000-0000-4000-8000-000000000020';
const successorPlayerId = '93000000-0000-4000-8000-000000000021';
const matchId = '93000000-0000-4000-8000-000000000030';
const reportId = '93000000-0000-4000-8000-000000000031';
const eventId = '93000000-0000-4000-8000-000000000032';
const goalId = '93000000-0000-4000-8000-000000000033';
const discordSnowflake = '123456789012345678';
const password = 'Current account password';
const sessionToken = 'current-session-token';
let passwordHash: string;

// Every foreign key to users and its documented treatment
// (docs/suppression-compte-2026-09-30.md). A new foreign key fails this test
// until its treatment is decided in nxt5_delete_account and documented.
const FOREIGN_KEY_DECISIONS: Record<string, 'delete' | 'transfer' | 'null' | 'purge-profile'> = {
  'access_requests.updated_by': 'null', 'account_deletion_confirmations.user_id': 'delete',
  'account_reauthentications.user_id': 'delete', 'account_subscriptions.updated_by': 'null',
  'account_subscriptions.user_id': 'delete', 'audit_logs.user_id': 'null',
  'composition_types.created_by': 'null', 'discord_account_link_requests.user_id': 'delete',
  'discord_community_announcements.created_by': 'null', 'discord_community_settings.updated_by': 'null',
  'discord_connection_tests.created_by': 'null', 'discord_connections.created_by': 'null',
  'discord_draft_notes.author_id': 'null', 'discord_event_responses.user_id': 'delete',
  'discord_goal_updates.user_id': 'null', 'discord_group_exports.created_by': 'null',
  'discord_link_codes.created_by': 'delete', 'discord_player_goal_updates.user_id': 'null',
  'discord_review_reads.user_id': 'delete', 'discord_review_recipients.user_id': 'delete',
  'discord_routes.created_by': 'null', 'discord_team_events.created_by': 'null',
  'discord_team_goals.created_by': 'null', 'discord_user_links.user_id': 'delete',
  'inactivity_reminder_deliveries.user_id': 'delete', 'inactivity_reminder_pending.user_id': 'delete',
  'match_archives.created_by': 'null', 'match_categories.created_by': 'null',
  'matches.created_by': 'null', 'matches.reviewed_by': 'null',
  'password_reset_tokens.user_id': 'delete', 'player_availability.updated_by': 'null',
  'player_coaching_notes.updated_by': 'null', 'player_goals.created_by': 'null',
  'player_matchup_notebooks.updated_by': 'null', 'players.user_id': 'purge-profile',
  'reports.created_by': 'null', 'sessions.user_id': 'delete',
  'social_auth_flows.user_id': 'delete', 'social_auth_tickets.user_id': 'delete',
  'social_identities.user_id': 'delete', 'team_invite_codes.created_by': 'null',
  'team_members.user_id': 'delete', 'teams.owner_id': 'transfer',
};

const rows = async (query: string, params: unknown[] = []) => (await state.pg.query(query, params)).rows;
function browser(initial: Record<string, string> = { [COOKIE_NAME]: sessionToken }) {
  const jar = new Map(Object.entries(initial));
  const set = vi.fn((cookie: any) => { if (cookie.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value); });
  return { jar, set, context: { cookies: { get: (name: string) => jar.get(name), set } } as any };
}
type Browser = ReturnType<typeof browser>;
const endpoint = `${origin}/.netlify/functions/auth-delete-account`;
const call = (target: Browser, body: unknown, headers: Record<string, string> = {}) => deleteAccount(new Request(endpoint, {
  method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
}), target.context);
async function inspect(target: Browser) {
  const response = await call(target, { action: 'inspect' });
  expect(response.status).toBe(200);
  return response.json();
}
async function prepare(target: Browser, teamPlan: Record<string, string> = {}, deleteEmptyTeams = false) {
  const response = await call(target, { action: 'prepare', acknowledged: true, teamPlan, deleteEmptyTeams });
  expect(response.status).toBe(200);
  return (await response.json()).confirmationToken as string;
}
const remove = (target: Browser, token: string, overrides: Record<string, unknown> = {}) => call(target, {
  action: 'delete', confirmationToken: token, currentPassword: password, confirmation: 'SUPPRIMER', acknowledged: true, ...overrides,
});
const account = async (id = ownerId) => (await rows('select * from users where id = $1', [id]))[0];

async function seedUser(id: string, name: string, hash = passwordHash, email = `${name}@example.test`) {
  await rows(`insert into users(id, account_name, name, email, password_hash, email_verified)
    values ($1, $2, $2, $3, $4, true)`, [id, email, email, hash]);
  await rows('update users set name = $2 where id = $1', [id, name]);
}
async function seedSession(id = ownerId, token = sessionToken) {
  await rows("insert into sessions(user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')", [id, sha256(token)]);
}
async function seedTeam(id = teamId, owner = ownerId, members: [string, string][] = [[ownerId, 'captain'], [successorId, 'player'], [coachId, 'coach']]) {
  await rows('insert into teams(id, owner_id, name, tag) values ($1, $2, $3, $4)', [id, owner, `Team ${id.slice(-2)}`, 'NXT']);
  for (const [user, role] of members) await rows('insert into team_members(team_id, user_id, role) values ($1, $2, $3)', [id, user, role]);
}
async function allReferencesTo(id: string) {
  const keys = await rows(`select c.conrelid::regclass::text as table_name, a.attname as column_name
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = 'users'::regclass`);
  const found: string[] = [];
  for (const key of keys) {
    const [{ count }] = await rows(`select count(*)::int as count from ${key.table_name} where ${key.column_name} = $1`, [id]);
    if (count) found.push(`${key.table_name}.${key.column_name}`);
  }
  return found;
}

beforeAll(async () => {
  state.pg = new PGlite();
  const client = { query: async (query: string, params?: unknown[]) => params
    ? state.pg.query(query, params) : ((await state.pg.exec(query)).at(-1) || { rows: [] }) };
  const migrations = (await loadMigrations()).map((migration: any) => ({ ...migration,
    // PGlite includes UUID generation but not the optional pgcrypto extension.
    sql: migration.sql.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
  await applyMigrations(client, migrations);
  passwordHash = bcrypt.hashSync(password, 4);
}, 60_000);

beforeEach(async () => {
  state.beforeQuery = null;
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID', 'PLATFORM_ADMIN_USER_ID', 'PLATFORM_ADMIN_EMAIL']) vi.stubEnv(key, '');
  vi.stubEnv('CONTEXT', 'dev');
  vi.stubEnv('SESSION_SECRET', 's'.repeat(64));
  vi.stubEnv('SOCIAL_AUTH_SITE_ORIGIN', origin);
  vi.stubEnv('GOOGLE_AUTH_ENABLED', 'true');
  vi.stubEnv('GOOGLE_AUTH_CLIENT_ID', 'nxt5.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_AUTH_CLIENT_SECRET', 'google-test-secret');
  state.authorize.mockReset();
  state.exchange.mockReset();
  state.authorize.mockImplementation(async (_config: any, params: any) => `https://provider.example/authorize?${new URLSearchParams({ state: params.state })}`);
  await state.pg.exec(`truncate users, rate_limits, audit_logs, account_deletion_receipts, access_requests,
    discord_interaction_receipts, discord_account_link_requests cascade`);
  await seedUser(ownerId, 'owner');
  await seedUser(successorId, 'successor');
  await seedUser(coachId, 'coach');
  await seedSession();
});
afterEach(() => { state.beforeQuery = null; vi.unstubAllEnvs(); });
afterAll(async () => { await state.pg?.close(); });

// PostgreSQL WASM replays the whole migration history; SQL suites run concurrently.

describe('account deletion API protections', { timeout: 30_000 }, () => {
  it('requires a trusted POST, a known action and an authenticated session', async () => {
    const target = browser();
    expect((await deleteAccount(new Request(endpoint), target.context)).status).toBe(405);
    expect((await call(target, { action: 'inspect' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call(target, { action: 'inspect' }, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await call(target, { action: 'erase' })).status).toBe(400);
    expect((await call(browser({}), { action: 'inspect' })).status).toBe(401);
    expect((await account()).deleted_at).toBeNull();
  });

  it('requires both confirmations and the current password, then limits password attempts', async () => {
    const target = browser();
    expect((await call(target, { action: 'prepare', teamPlan: {} })).status).toBe(400);
    const token = await prepare(target);
    expect((await remove(target, token, { confirmation: 'supprimer' })).status).toBe(400);
    expect((await remove(target, token, { acknowledged: false })).status).toBe(400);
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await remove(target, token, { currentPassword: 'wrong' })).status).toBe(401);
    expect((await remove(target, token)).status).toBe(429);
    expect((await account()).deleted_at).toBeNull();
    expect(await rows('select * from account_deletion_receipts')).toHaveLength(0);
  });

  it.each(['expired', 'other-session', 'changed-password'])('changes nothing when the confirmation is %s', async (kind) => {
    const target = browser();
    const token = await prepare(target);
    if (kind === 'expired') await rows("update account_deletion_confirmations set expires_at = now() - interval '1 second'");
    if (kind === 'other-session') await rows('update account_deletion_confirmations set session_hash = $1', [sha256('another-session')]);
    if (kind === 'changed-password') state.beforeQuery = async (query) => {
      if (!query.includes('nxt5_delete_account')) return;
      state.beforeQuery = null;
      await state.pg.query('update users set password_hash = $1 where id = $2', [bcrypt.hashSync('New password', 4), ownerId]);
    };
    expect((await remove(target, token)).status).toBe(409);
    expect((await account()).deleted_at).toBeNull();
    expect(await rows('select * from sessions where user_id = $1', [ownerId])).toHaveLength(1);
  });

  it('refuses to delete the configured platform administrator', async () => {
    vi.stubEnv('PLATFORM_ADMIN_USER_ID', ownerId);
    const response = await call(browser(), { action: 'inspect' });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('DELETION_PLATFORM_ADMIN');
  });
});

describe('owner of a team with other members', { timeout: 30_000 }, () => {
  async function seedSharedHistory() {
    await seedTeam();
    await seedTeam(otherTeamId, successorId, [[successorId, 'captain'], [ownerId, 'player']]);
    await rows("insert into players(id, team_id, user_id, name, riot_id, role) values ($1,$2,$3,'Owner player','Owner#EUW','TOP'), ($4,$2,$5,'Successor player','Successor#EUW','MID')",
      [ownerPlayerId, teamId, ownerId, successorPlayerId, successorId]);
    await rows("insert into champion_pool(team_id, player_id, player_name, champion) values ($1,$2,'Owner player','Ahri'), ($1,$3,'Successor player','Orianna')", [teamId, ownerPlayerId, successorPlayerId]);
    await rows("insert into player_availability(team_id, player_id, week_start, notes) values ($1,$2,'2026-09-28','Private schedule'), ($1,$3,'2026-09-28','Team schedule')", [teamId, ownerPlayerId, successorPlayerId]);
    await rows("insert into player_coaching_notes(team_id, player_id, content, updated_by) values ($1,$2,'Private coaching',$3), ($1,$4,'Coaching written by the owner',$3)", [teamId, ownerPlayerId, ownerId, successorPlayerId]);
    await rows("insert into player_goals(team_id, player_id, title, metric, target_value, created_by) values ($1,$2,'Owner goal','cs',8,$3), ($1,$4,'Successor goal','cs',7,$3)", [teamId, ownerPlayerId, ownerId, successorPlayerId]);
    await rows("insert into player_matchup_notebooks(team_id, player_id, champion, opponent_champion, role, updated_by) values ($1,$2,'ahri','zed','MID',$3), ($1,$4,'orianna','syndra','MID',$3)", [teamId, ownerPlayerId, ownerId, successorPlayerId]);
    await rows("insert into matches(id, team_id, game_id, created_by, reviewed_by) values ($1,$2,'EUW1_1',$3,$3)", [matchId, teamId, ownerId]);
    await rows(`insert into match_participants(match_id, player_id, team_key, summoner_name, riot_id, champion, raw) values
      ($1,$2,'ALLY','Owner player','Owner#EUW','Ahri','{"puuid":"PRIVATE","riotIdGameName":"Owner","riotIdTagline":"EUW","championName":"Ahri","item0":3089}'),
      ($1,$3,'ALLY','Successor player','Successor#EUW','Orianna','{"puuid":"KEPT","championName":"Orianna"}')`, [matchId, ownerPlayerId, successorPlayerId]);
    await rows("insert into reports(id, team_id, match_id, created_by, title, content, updated_at) values ($1,$2,$3,$4,'Débrief','Contenu partagé','2026-09-01T10:00:00Z')", [reportId, teamId, matchId, ownerId]);
    await rows("insert into composition_types(team_id, created_by, title) values ($1,$2,'Compo')", [teamId, ownerId]);
    await rows("insert into match_categories(team_id, created_by, name) values ($1,$2,'Scrims')", [teamId, ownerId]);
    await rows("insert into team_invite_codes(team_id, created_by, code, expires_at) values ($1,$2,'INVITE-1',now() + interval '1 day')", [teamId, ownerId]);
    await rows("insert into discord_team_events(id, team_id, title, event_type, starts_at, duration_minutes, created_by) values ($1,$2,'Scrim','scrim',now(),60,$3)", [eventId, teamId, ownerId]);
    await rows("insert into discord_draft_notes(team_id, event_id, author_id, note) values ($1,$2,$3,'Draft idea')", [teamId, eventId, ownerId]);
    await rows("insert into password_reset_tokens(user_id, token_hash, expires_at, email) values ($1,'reset',now() + interval '1 hour','owner@example.test')", [ownerId]);
    await rows("insert into inactivity_reminder_deliveries(user_id, recipient_email, inactive_since_at) values ($1,'owner@example.test',now())", [ownerId]);
    await rows("insert into audit_logs(user_id, action, metadata) values ($1,'old.action','{\"email\":\"owner@example.test\"}')", [ownerId]);
    await rows("insert into audit_logs(user_id, action, entity_type, entity_id, metadata) values ($1,'team_member.role_update','team',$2,$3)", [successorId, teamId, JSON.stringify({ targetUserId: ownerId, role: 'player' })]);
    await rows("insert into audit_logs(user_id, action, metadata) values ($1,'team.create','{\"name\":\"Kept\"}')", [successorId]);
    await rows(`insert into access_requests(contact_name, email, team_name, team_key, role, plan_code, payer, purchase_intent, consent_version)
      values ('Owner','owner@example.test','Team','team','manager','structure','association','maybe','test')`);
  }

  it('transfers the team to the chosen member, keeps the shared history and purges the account data', async () => {
    await seedSharedHistory();
    const target = browser();
    const inspected = await inspect(target);
    expect(inspected).toMatchObject({ hasPassword: true, discordLinked: false });
    expect(inspected.teams).toEqual([{ id: teamId, name: 'Team 10', members: [{ id: coachId, name: 'coach' }, { id: successorId, name: 'successor' }] }]);
    const token = await prepare(target, { [teamId]: successorId });
    const response = await remove(target, token);
    expect(response.status).toBe(200);
    const { receipt } = await response.json();
    expect(receipt.summary).toMatchObject({ teamsTransferred: 1, teamsDeleted: 0, membershipsRemoved: 2,
      profilesPurged: 1, participantsAnonymized: 1, sessionsClosed: 1, sharedHistoryRetained: true });

    expect(await account()).toMatchObject({ email: null, name: 'Compte supprimé', account_name: `deleted-${ownerId}`,
      password_hash: '!deleted', email_verified: false, notif_match: false, notif_inactivity: false, legal_version: null });
    expect((await account()).deleted_at).toBeTruthy();
    // The team and every other member's data are intact: never cascaded.
    expect(await rows('select id, owner_id from teams order by id')).toEqual([{ id: teamId, owner_id: successorId }, { id: otherTeamId, owner_id: successorId }]);
    expect(await rows('select team_id, user_id, role from team_members order by team_id, user_id')).toEqual([
      { team_id: teamId, user_id: successorId, role: 'captain' }, { team_id: teamId, user_id: coachId, role: 'coach' },
      { team_id: otherTeamId, user_id: successorId, role: 'captain' },
    ]);
    expect(await rows('select id from players')).toEqual([{ id: successorPlayerId }]);
    for (const table of ['champion_pool', 'player_availability', 'player_coaching_notes', 'player_goals', 'player_matchup_notebooks']) {
      expect((await rows(`select player_id from ${table}`)).map((row: any) => row.player_id)).toEqual([successorPlayerId]);
    }
    expect(await rows('select updated_by from player_coaching_notes')).toEqual([{ updated_by: null }]);
    expect(await rows('select created_by, reviewed_by from matches')).toEqual([{ created_by: null, reviewed_by: null }]);
    const participants = await rows('select player_id, summoner_name, riot_id, raw from match_participants order by champion');
    expect(participants[0]).toEqual({ player_id: null, summoner_name: 'Joueur supprimé', riot_id: null, raw: { championName: 'Ahri', item0: 3089 } });
    expect(participants[1]).toMatchObject({ player_id: successorPlayerId, summoner_name: 'Successor player', raw: { puuid: 'KEPT' } });
    const [report] = await rows('select created_by, content, updated_at from reports');
    expect(report).toMatchObject({ created_by: null, content: 'Contenu partagé' });
    expect(new Date(report.updated_at).toISOString()).toBe('2026-09-01T10:00:00.000Z');
    for (const [table, column] of [['composition_types', 'created_by'], ['match_categories', 'created_by'], ['team_invite_codes', 'created_by'],
      ['discord_team_events', 'created_by'], ['discord_draft_notes', 'author_id']]) {
      expect(await rows(`select ${column} as author from ${table}`)).toEqual([{ author: null }]);
    }
    for (const table of ['sessions', 'password_reset_tokens', 'inactivity_reminder_deliveries', 'account_subscriptions', 'account_deletion_confirmations']) {
      expect(await rows(`select * from ${table} where user_id = $1`, [ownerId])).toHaveLength(0);
    }
    expect(await rows('select * from access_requests')).toHaveLength(0);
    expect(await allReferencesTo(ownerId)).toEqual([]);

    const logs = await rows('select * from audit_logs order by created_at, action');
    expect(JSON.stringify(logs)).not.toContain(ownerId);
    expect(JSON.stringify(logs)).not.toContain('owner@example.test');
    expect(logs.find((log: any) => log.action === 'team.create')).toMatchObject({ user_id: successorId, metadata: { name: 'Kept' } });
    expect(logs.find((log: any) => log.action === 'team_member.role_update')).toMatchObject({ user_id: null, entity_id: teamId, metadata: {} });
    expect(logs.find((log: any) => log.action === 'auth.account_deleted')).toMatchObject({ id: receipt.reference, user_id: null });
    expect(JSON.stringify(receipt)).not.toContain(ownerId);
    expect(target.set).toHaveBeenCalledWith(expect.objectContaining({ name: COOKIE_NAME, maxAge: 0 }));
  });

  it('refuses a direct DELETE of an owner whose team has other members', async () => {
    await seedTeam();
    await expect(state.pg.query('delete from users where id = $1', [ownerId])).rejects.toThrow('ACCOUNT_OWNS_SHARED_TEAM');
    expect(await rows('select id from teams')).toEqual([{ id: teamId }]);
    expect(await rows('select user_id from team_members where team_id = $1', [teamId])).toHaveLength(3);
  });

  it('requires a successor who is still a member of the team', async () => {
    await seedTeam();
    const target = browser();
    expect((await call(target, { action: 'prepare', acknowledged: true, teamPlan: { [teamId]: 'delete' }, deleteEmptyTeams: true })).status).toBe(400);
    expect((await call(target, { action: 'prepare', acknowledged: true, teamPlan: { [teamId]: ownerId } })).status).toBe(400);
    const token = await prepare(target, { [teamId]: successorId });
    await rows('delete from team_members where user_id = $1', [successorId]);
    expect((await remove(target, token)).status).toBe(409);
    expect((await account()).deleted_at).toBeNull();
    expect(await rows('select owner_id from teams')).toEqual([{ owner_id: ownerId }]);
  });

  it('removes a team without other members only with a separate consent', async () => {
    await seedTeam(teamId, ownerId, [[ownerId, 'captain']]);
    await rows("insert into matches(team_id, game_id, created_by) values ($1,'EUW1_2',$2)", [teamId, ownerId]);
    const target = browser();
    expect((await call(target, { action: 'prepare', acknowledged: true, teamPlan: { [teamId]: 'delete' } })).status).toBe(400);
    const token = await prepare(target, { [teamId]: 'delete' }, true);
    const response = await remove(target, token);
    expect(response.status).toBe(200);
    expect((await response.json()).receipt.summary).toMatchObject({ teamsDeleted: 1, teamsTransferred: 0 });
    expect(await rows('select * from teams')).toHaveLength(0);
    expect(await rows('select * from matches')).toHaveLength(0);
  });

  it('rolls everything back when a member joined a team approved for removal', async () => {
    await seedTeam(teamId, ownerId, [[ownerId, 'captain']]);
    const target = browser();
    const token = await prepare(target, { [teamId]: 'delete' }, true);
    await rows("insert into team_members(team_id, user_id, role) values ($1,$2,'player')", [teamId, successorId]);
    expect((await remove(target, token)).status).toBe(409);
    expect((await account()).deleted_at).toBeNull();
    expect(await rows('select * from teams')).toHaveLength(1);
    expect(await rows('select * from sessions')).toHaveLength(1);
  });

  it('rolls back transfers and purges when the audit event cannot be written', async () => {
    await seedTeam();
    const target = browser();
    const token = await prepare(target, { [teamId]: successorId });
    await rows("alter table audit_logs add constraint simulate_audit_failure check (action <> 'auth.account_deleted')");
    try {
      expect((await remove(target, token)).status).toBe(503);
      expect((await account()).deleted_at).toBeNull();
      expect(await rows('select owner_id from teams')).toEqual([{ owner_id: ownerId }]);
      expect(await rows('select * from team_members where user_id = $1', [ownerId])).toHaveLength(1);
      expect(await rows('select * from account_deletion_receipts')).toHaveLength(0);
    } finally { await rows('alter table audit_logs drop constraint simulate_audit_failure'); }
  });
});

describe('account connected only through a provider', { timeout: 30_000 }, () => {
  const subject = 'google-subject-social-only';
  async function seedSocialAccount() {
    await seedUser(socialId, 'social', '');
    await rows("insert into social_identities(user_id, provider, subject, display_name) values ($1,'google',$2,'Social player')", [socialId, subject]);
    await seedSession(socialId, 'social-session');
  }
  function socialBrowser() { return browser({ [COOKIE_NAME]: 'social-session' }); }
  async function reauthenticate(target: Browser, providerSubject = subject) {
    state.exchange.mockResolvedValueOnce({ provider: 'google', subject: providerSubject, email: 'social@example.test', emailVerified: true, name: 'Social player' });
    const started = await startSocial(new Request(`${origin}/.netlify/functions/auth-social-start`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'google', flow: 'reauth' }),
    }), target.context);
    expect(started.status).toBe(200);
    const flowState = new URL((await started.json()).authorizationUrl).searchParams.get('state')!;
    const callback = await socialCallback(new Request(`${origin}/.netlify/functions/auth-social-callback?${new URLSearchParams({ state: flowState, code: 'verified-code' })}`), target.context);
    expect(callback.headers.get('location')).toBe('/.netlify/functions/auth-social-finish');
    const finished = await finishSocial(new Request(`${origin}/.netlify/functions/auth-social-finish`), target.context);
    return finished.headers.get('location');
  }

  it('requires a fresh reauthentication with the linked provider instead of a password', async () => {
    await seedSocialAccount();
    const target = socialBrowser();
    expect(await inspect(target)).toMatchObject({ hasPassword: false, reauthentication: { providers: ['google'], verifiedWith: null } });
    const token = await prepare(target);
    const refused = await remove(target, token, { currentPassword: undefined });
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe('DELETION_REAUTH_REQUIRED');

    // Another account at the same provider does not prove anything.
    expect(await reauthenticate(target, 'somebody-else')).toBe('/parametres?reauth=mismatch&provider=google');
    expect((await remove(target, token, { currentPassword: undefined })).status).toBe(403);
    expect((await account(socialId)).deleted_at).toBeNull();

    expect(await reauthenticate(target)).toBe('/parametres?reauth=verified&provider=google');
    expect((await inspect(target)).reauthentication.verifiedWith).toBe('google');
    const response = await remove(target, token, { currentPassword: undefined });
    expect(response.status).toBe(200);
    expect((await response.json()).receipt.summary).toMatchObject({ externalConnectionsRemoved: 1, sessionsClosed: 1 });
    expect(await rows('select * from social_identities')).toHaveLength(0);
    expect(await rows('select * from account_reauthentications')).toHaveLength(0);
    expect(await allReferencesTo(socialId)).toEqual([]);
    expect(await account(socialId)).toMatchObject({ email: null, password_hash: '!deleted' });
  });

  it('does not start a reauthentication with a provider that is not linked', async () => {
    await seedSocialAccount();
    await rows('delete from social_identities');
    const response = await startSocial(new Request(`${origin}/.netlify/functions/auth-social-start`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'google', flow: 'reauth' }),
    }), socialBrowser().context);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('SOCIAL_REAUTH_PROVIDER');
  });

  it('keeps a reauthentication bound to the session that obtained it', async () => {
    await seedSocialAccount();
    const target = socialBrowser();
    const token = await prepare(target);
    expect(await reauthenticate(target)).toBe('/parametres?reauth=verified&provider=google');
    await rows('update account_reauthentications set session_hash = $1', [sha256('another-session')]);
    expect((await remove(target, token, { currentPassword: undefined })).status).toBe(403);
    await rows("update account_reauthentications set session_hash = $1, expires_at = now() - interval '1 second'", [sha256('social-session')]);
    expect((await remove(target, token, { currentPassword: undefined })).status).toBe(403);
    expect(await cleanup()).toHaveProperty('status', 204);
    expect(await rows('select * from account_reauthentications')).toHaveLength(0);
    expect((await account(socialId)).deleted_at).toBeNull();
  });
});

describe('account linked to Discord', { timeout: 30_000 }, () => {
  it('removes the Discord link and its traces while keeping shared team content', async () => {
    await seedUser(discordUserId, 'discord-player');
    await seedSession(discordUserId, 'discord-session');
    await seedTeam(teamId, successorId, [[successorId, 'captain'], [discordUserId, 'player']]);
    const [link] = await rows("insert into discord_user_links(discord_user_id, user_id, discord_label) values ($1,$2,'player#0001') returning id", [discordSnowflake, discordUserId]);
    await rows("insert into discord_user_team_choices(link_id, guild_id, team_id) values ($1,'111111111111111111',$2)", [link.id, teamId]);
    await rows("insert into discord_bot_pending(token_hash, link_id, guild_id, team_id, command, kind, expires_at) values ('pending',$1,'111111111111111111',$2,'dispo','confirm',now() + interval '5 minutes')", [link.id, teamId]);
    await rows(`insert into discord_account_link_requests(token_hash, discord_user_id, guild_id, discord_label, user_id, expires_at) values
      ('bound',$1,'111111111111111111','player#0001',$2,now() + interval '5 minutes'),
      ('unbound',$1,'111111111111111111','player#0001',null,now() + interval '5 minutes')`, [discordSnowflake, discordUserId]);
    await rows("insert into discord_interaction_receipts(interaction_id, guild_id, discord_user_id, command_name, response_text) values ('interaction','111111111111111111',$1,'dispo','Private answer')", [discordSnowflake]);
    await rows("insert into discord_team_events(id, team_id, title, event_type, starts_at, duration_minutes, created_by) values ($1,$2,'Scrim','scrim',now(),60,$3)", [eventId, teamId, successorId]);
    await rows("insert into discord_event_responses(event_id, user_id, status) values ($1,$2,'present'), ($1,$3,'absent')", [eventId, discordUserId, successorId]);
    await rows("insert into reports(id, team_id, created_by, title, content) values ($1,$2,$3,'Débrief','Contenu')", [reportId, teamId, successorId]);
    await rows('insert into discord_review_reads(team_id, report_id, user_id, report_version) values ($1,$2,$3,1)', [teamId, reportId, discordUserId]);
    await rows('insert into discord_review_recipients(team_id, report_id, user_id, report_version) values ($1,$2,$3,1), ($1,$2,$4,1)', [teamId, reportId, discordUserId, successorId]);
    await rows("insert into discord_link_codes(code_hash, team_id, created_by, expires_at) values ('open',$1,$2,now() + interval '5 minutes')", [teamId, discordUserId]);
    await rows("insert into discord_link_codes(code_hash, team_id, created_by, expires_at, consumed_at) values ('used',$1,$2,now(),now())", [teamId, discordUserId]);
    await rows("insert into discord_connections(team_id, guild_id, created_by) values ($1,'111111111111111111',$2)", [teamId, discordUserId]);
    await rows("insert into discord_routes(team_id, guild_id, channel_id, created_by) values ($1,'111111111111111111','222222222222222222',$2)", [teamId, discordUserId]);
    await rows("insert into discord_team_goals(id, team_id, title, created_by) values ($1,$2,'Team goal',$3)", [goalId, teamId, successorId]);
    await rows("insert into discord_goal_updates(team_id, goal_id, user_id, note) values ($1,$2,$3,'Progress shared with the team')", [teamId, goalId, discordUserId]);
    await rows("insert into audit_logs(action, metadata) values ('discord.command', $1)", [JSON.stringify({ discordUserId: discordSnowflake })]);

    const target = browser({ [COOKIE_NAME]: 'discord-session' });
    expect(await inspect(target)).toMatchObject({ discordLinked: true, teams: [] });
    const token = await prepare(target);
    const response = await remove(target, token);
    expect(response.status).toBe(200);
    expect((await response.json()).receipt.summary).toMatchObject({ discordLinksRemoved: 1, membershipsRemoved: 1 });

    for (const table of ['discord_user_links', 'discord_user_team_choices', 'discord_bot_pending', 'discord_account_link_requests', 'discord_interaction_receipts', 'discord_review_reads']) {
      expect(await rows(`select * from ${table}`)).toHaveLength(0);
    }
    expect((await rows('select user_id from discord_event_responses')).map((row: any) => row.user_id)).toEqual([successorId]);
    expect((await rows('select user_id from discord_review_recipients')).map((row: any) => row.user_id)).toEqual([successorId]);
    expect(await rows('select code_hash, created_by from discord_link_codes')).toEqual([{ code_hash: 'used', created_by: null }]);
    expect(await rows('select created_by from discord_connections')).toEqual([{ created_by: null }]);
    expect(await rows('select created_by from discord_routes')).toEqual([{ created_by: null }]);
    expect(await rows('select user_id, note from discord_goal_updates')).toEqual([{ user_id: null, note: 'Progress shared with the team' }]);
    expect(await rows("select metadata from audit_logs where action = 'discord.command'")).toEqual([{ metadata: {} }]);
    expect(await rows('select owner_id from teams')).toEqual([{ owner_id: successorId }]);
    expect(await allReferencesTo(discordUserId)).toEqual([]);
  });
});

describe('after deletion', { timeout: 30_000 }, () => {
  it('returns the same receipt without a session and never repeats the purge', async () => {
    const target = browser();
    const token = await prepare(target);
    const first = await (await remove(target, token)).json();
    const anonymous = browser({});
    expect(await (await call(anonymous, { action: 'status', confirmationToken: token })).json()).toEqual(first);
    expect(await (await remove(target, token)).json()).toEqual(first);
    expect(await rows('select * from account_deletion_receipts')).toHaveLength(1);
    expect(await (await call(anonymous, { action: 'status', confirmationToken: 'x'.repeat(43) })).json()).toEqual({ ok: false, pending: true });
  });

  it('blocks login, new sessions, recovery links and reactivation', async () => {
    const target = browser();
    expect((await remove(target, await prepare(target))).status).toBe(200);
    await expect(requireAuth(new Request(endpoint), browser().context)).rejects.toMatchObject({ status: 401 });
    const loginResponse = await login(new Request(`${origin}/.netlify/functions/auth-login`, {
      method: 'POST', headers: { origin }, body: JSON.stringify({ accountName: 'owner@example.test', password }),
    }), browser({}).context);
    expect(loginResponse.status).toBe(401);
    await expect(createSession({ userId: ownerId, context: browser({}).context, request: new Request(endpoint) })).rejects.toThrow('ACCOUNT_DELETED');
    await expect(state.pg.query("update users set name = 'Restored' where id = $1", [ownerId])).rejects.toThrow('ACCOUNT_DELETED');
    await expect(state.pg.query("insert into password_reset_tokens(user_id, token_hash, expires_at) values ($1,'later',now())", [ownerId])).rejects.toThrow('ACCOUNT_DELETED');
    await expect(state.pg.query("insert into sessions(user_id, token_hash, expires_at) values ($1,'late',now() + interval '1 hour')", [ownerId])).rejects.toThrow('ACCOUNT_DELETED');
  });

  it('documents a treatment for every foreign key to users', async () => {
    const keys = await rows(`select c.conrelid::regclass::text || '.' || a.attname as key
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f' and c.confrelid = 'users'::regclass order by 1`);
    expect(keys.map((row: any) => row.key)).toEqual(Object.keys(FOREIGN_KEY_DECISIONS).sort());
  });
});
