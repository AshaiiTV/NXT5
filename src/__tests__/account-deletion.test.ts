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
// (docs/suppression-compte-2026-11-24.md). A new foreign key fails this test
// until its treatment is decided in nxt5_delete_account and documented.
const FOREIGN_KEY_DECISIONS: Record<string, 'delete' | 'transfer' | 'null' | 'anonymize-profile'> = {
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
  'player_matchup_notebooks.updated_by': 'null', 'players.user_id': 'anonymize-profile',
  'reports.created_by': 'null', 'sessions.user_id': 'delete',
  'social_auth_flows.user_id': 'delete', 'social_auth_tickets.user_id': 'delete',
  'social_identities.user_id': 'delete', 'team_invite_codes.created_by': 'null',
  'team_members.user_id': 'delete', 'teams.owner_id': 'transfer',
  // Added to main after #110 (October and November 2026).
  'draft_rooms.created_by': 'null', 'nexus_registrations.registered_by': 'null',
  'opponent_drafts.imported_by': 'null', 'scrim_offers.created_by': 'null',
  'scrim_requests.created_by': 'null', 'team_import_links.created_by': 'null',
  'team_opponents.created_by': 'null',
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
    discord_interaction_receipts, discord_account_link_requests, nexus_seasons, discord_community_settings, discord_community_batches cascade`);
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
    expect(inspected.teams).toEqual([{ id: teamId, name: 'Team 10', members: [{ id: coachId, name: 'coach', eligible: true, nameTaken: false }, { id: successorId, name: 'successor', eligible: true, nameTaken: false }] }]);
    const token = await prepare(target, { [teamId]: successorId });
    const response = await remove(target, token);
    expect(response.status).toBe(200);
    const { receipt } = await response.json();
    expect(receipt.summary).toMatchObject({ teamsTransferred: 1, teamsDeleted: 0, membershipsRemoved: 2,
      profilesAnonymized: 1, participantsAnonymized: 1, sessionsClosed: 1, sharedHistoryRetained: true });

    expect(await account()).toMatchObject({ email: null, name: 'Compte supprimé', account_name: `deleted-${ownerId}`,
      password_hash: '!deleted', email_verified: false, notif_match: false, notif_inactivity: false, legal_version: null });
    expect((await account()).deleted_at).toBeTruthy();
    // The team and every other member's data are intact: never cascaded.
    expect(await rows('select id, owner_id from teams order by id')).toEqual([{ id: teamId, owner_id: successorId }, { id: otherTeamId, owner_id: successorId }]);
    expect(await rows('select team_id, user_id, role from team_members order by team_id, user_id')).toEqual([
      { team_id: teamId, user_id: successorId, role: 'captain' }, { team_id: teamId, user_id: coachId, role: 'coach' },
      { team_id: otherTeamId, user_id: successorId, role: 'captain' },
    ]);
    // The linked profile stays in its team, detached and anonymised, with the team data attached to it.
    expect(await rows('select id, user_id, name, riot_id, role from players order by name')).toEqual([
      { id: ownerPlayerId, user_id: null, name: 'Joueur supprimé', riot_id: null, role: 'TOP' },
      { id: successorPlayerId, user_id: successorId, name: 'Successor player', riot_id: 'Successor#EUW', role: 'MID' },
    ]);
    for (const table of ['champion_pool', 'player_availability', 'player_coaching_notes', 'player_goals', 'player_matchup_notebooks']) {
      expect((await rows(`select player_id from ${table} order by player_id`)).map((row: any) => row.player_id)).toEqual([ownerPlayerId, successorPlayerId]);
    }
    expect(await rows('select player_name from champion_pool order by player_id')).toEqual([{ player_name: 'Joueur supprimé' }, { player_name: 'Successor player' }]);
    expect(await rows('select updated_by from player_coaching_notes')).toEqual([{ updated_by: null }, { updated_by: null }]);
    expect(await rows('select created_by, reviewed_by from matches')).toEqual([{ created_by: null, reviewed_by: null }]);
    const participants = await rows('select player_id, summoner_name, riot_id, raw from match_participants order by champion');
    expect(participants[0]).toEqual({ player_id: ownerPlayerId, summoner_name: 'Joueur supprimé', riot_id: null, raw: { championName: 'Ahri', item0: 3089 } });
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
    // Written by another member: only the value designating the deleted account is removed.
    expect(logs.find((log: any) => log.action === 'team_member.role_update')).toMatchObject({ user_id: successorId, entity_id: teamId, metadata: { targetUserId: null, role: 'player' } });
    expect(logs.find((log: any) => log.action === 'old.action')).toMatchObject({ user_id: null, metadata: { email: null } });
    expect(logs.find((log: any) => log.action === 'auth.account_deleted')).toMatchObject({ id: receipt.reference, user_id: null });
    expect(JSON.stringify(receipt)).not.toContain(ownerId);
    expect(target.set).toHaveBeenCalledWith(expect.objectContaining({ name: COOKIE_NAME, maxAge: 0 }));
  });

  it('scrubs only exact values designating the account in other accounts\' audit logs', async () => {
    const annId = '93000000-0000-4000-8000-000000000006';
    await seedUser(annId, 'ann', passwordHash, 'ann@x.fr');
    await seedSession(annId, 'ann-session');
    await rows("insert into audit_logs(user_id, action, metadata) values ($1,'profile.update','{\"email\":\"joann@x.fr\"}')", [successorId]);
    await rows("insert into audit_logs(user_id, action, metadata) values ($1,'team.invite',$2)",
      [successorId, JSON.stringify({ invited: [{ email: 'ANN@X.FR' }, { email: 'joann@x.fr' }], note: 'ann@x.fr et joann@x.fr', team: 'Kept' })]);
    await rows("insert into audit_logs(user_id, action, metadata) values ($1,'profile.update','{\"email\":\"ann@x.fr\"}')", [annId]);
    const target = browser({ [COOKIE_NAME]: 'ann-session' });
    expect((await remove(target, await prepare(target))).status).toBe(200);
    const logs = await rows("select user_id, metadata from audit_logs where action <> 'auth.account_deleted' order by action, user_id");
    expect(logs).toEqual([
      { user_id: successorId, metadata: { email: 'joann@x.fr' } },
      { user_id: null, metadata: { email: null } },
      { user_id: successorId, metadata: { invited: [{ email: null }, { email: 'joann@x.fr' }], note: 'ann@x.fr et joann@x.fr', team: 'Kept' } },
    ]);
  });

  it('keeps the linked profile and the data other members wrote about it in another team', async () => {
    await seedTeam(otherTeamId, successorId, [[successorId, 'captain'], [coachId, 'coach'], [ownerId, 'player']]);
    await rows("insert into players(id, team_id, user_id, name, riot_id, opgg_url, role, most_played) values ($1,$2,$3,'Owner player','Owner#EUW','https://op.gg/owner','ADC','[{\"champion\":\"Jinx\"}]')",
      [ownerPlayerId, otherTeamId, ownerId]);
    await rows("insert into player_coaching_notes(team_id, player_id, content, updated_by) values ($1,$2,'Coach feedback',$3)", [otherTeamId, ownerPlayerId, coachId]);
    const [goal] = await rows("insert into player_goals(team_id, player_id, title, metric, target_value, created_by) values ($1,$2,'CS','cs',8,$3) returning id", [otherTeamId, ownerPlayerId, coachId]);
    await rows("insert into discord_player_goal_updates(team_id, goal_id, user_id, note) values ($1,$2,$3,'Coach update')", [otherTeamId, goal.id, coachId]);
    await rows("insert into player_matchup_notebooks(team_id, player_id, champion, opponent_champion, role, updated_by) values ($1,$2,'jinx','caitlyn','ADC',$3)", [otherTeamId, ownerPlayerId, coachId]);
    await rows("insert into player_availability(team_id, player_id, week_start, notes, updated_by) values ($1,$2,'2026-09-28','Team planning',$3)", [otherTeamId, ownerPlayerId, coachId]);
    await rows("insert into matches(id, team_id, game_id) values ($1,$2,'EUW1_3')", [matchId, otherTeamId]);
    await rows("insert into match_participants(match_id, player_id, team_key, summoner_name, riot_id, champion, raw) values ($1,$2,'ALLY','Owner player','Owner#EUW','Jinx','{\"puuid\":\"PRIVATE\"}')", [matchId, ownerPlayerId]);

    const target = browser();
    const response = await remove(target, await prepare(target));
    expect(response.status).toBe(200);
    expect((await response.json()).receipt.summary).toMatchObject({ profilesAnonymized: 1, participantsAnonymized: 1 });
    expect(await rows('select team_id, user_id, name, riot_id, opgg_url, role, roster_status, most_played from players')).toEqual([
      { team_id: otherTeamId, user_id: null, name: 'Joueur supprimé', riot_id: null, opgg_url: null, role: 'ADC', roster_status: 'MAIN', most_played: [] },
    ]);
    expect(await rows('select content, updated_by from player_coaching_notes')).toEqual([{ content: 'Coach feedback', updated_by: coachId }]);
    expect(await rows('select player_id, created_by from player_goals')).toEqual([{ player_id: ownerPlayerId, created_by: coachId }]);
    expect(await rows('select note, user_id from discord_player_goal_updates')).toEqual([{ note: 'Coach update', user_id: coachId }]);
    expect(await rows('select player_id from player_matchup_notebooks')).toEqual([{ player_id: ownerPlayerId }]);
    expect(await rows('select notes from player_availability')).toEqual([{ notes: 'Team planning' }]);
    expect(await rows('select player_id, summoner_name, riot_id, raw from match_participants')).toEqual([
      { player_id: ownerPlayerId, summoner_name: 'Joueur supprimé', riot_id: null, raw: {} },
    ]);
    expect(await allReferencesTo(ownerId)).toEqual([]);
  });

  it('reports an unexpected unique conflict without blaming a team name', async () => {
    const target = browser();
    const token = await prepare(target);
    state.beforeQuery = async (query) => {
      if (!query.includes('nxt5_delete_account')) return;
      throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    };
    const response = await remove(target, token);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('DELETION_CONFLICT');
    expect(body.error).not.toMatch(/nom|équipe de ce nom/);
    expect(body.error).toContain('Aucune suppression effectuée');
    expect((await account()).deleted_at).toBeNull();
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
    // Linked at sign-up, before the current session was opened.
    await rows("insert into social_identities(user_id, provider, subject, display_name, linked_at) values ($1,'google',$2,'Social player',now() - interval '1 day')", [socialId, subject]);
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

  it('forces a fresh provider login only for the reauthentication flow', async () => {
    await seedSocialAccount();
    const target = socialBrowser();
    await reauthenticate(target);
    expect(state.authorize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ freshLogin: true }));
  });

  it('refuses a provider linked after the current session was opened', async () => {
    await seedSocialAccount();
    const target = socialBrowser();
    const token = await prepare(target);
    // An identity added through the « link » flow from this session proves nothing.
    await rows("update social_identities set linked_at = now() + interval '1 minute'");
    expect((await inspect(target)).reauthentication.providers).toEqual([]);
    const started = await startSocial(new Request(`${origin}/.netlify/functions/auth-social-start`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'google', flow: 'reauth' }),
    }), target.context);
    expect(started.status).toBe(409);
    expect((await started.json()).code).toBe('SOCIAL_REAUTH_PROVIDER');

    // Linked between the start and the provider's answer: no proof is recorded.
    await rows("update social_identities set linked_at = now() - interval '1 day'");
    state.beforeQuery = async (query) => {
      if (!query.includes('account_reauthentications')) return;
      state.beforeQuery = null;
      await state.pg.query("update social_identities set linked_at = now() + interval '1 minute'");
    };
    expect(await reauthenticate(target)).toBe('/parametres?reauth=mismatch&provider=google');
    expect(await rows('select * from account_reauthentications')).toHaveLength(0);

    // Even with a proof in place, the SQL function checks when the identity was linked.
    await rows('insert into account_reauthentications(session_hash, user_id, provider) values ($1,$2,$3)', [sha256('social-session'), socialId, 'google']);
    const refused = await remove(target, token, { currentPassword: undefined });
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe('DELETION_REAUTH_REQUIRED');
    expect((await account(socialId)).deleted_at).toBeNull();
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
    await rows("insert into audit_logs(user_id, action, entity_type, entity_id, metadata) values ($1,'discord.connected','team',$2,$3)",
      [successorId, teamId, JSON.stringify({ guildId: '111111111111111111', discordUserId: discordSnowflake, interactionId: 'interaction-1' })]);

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
    expect(await rows("select metadata from audit_logs where action = 'discord.command'")).toEqual([{ metadata: { discordUserId: null } }]);
    // Written for the team owner when the server was connected: author and other details stay.
    expect(await rows("select user_id, entity_id, metadata from audit_logs where action = 'discord.connected'")).toEqual([
      { user_id: successorId, entity_id: teamId, metadata: { guildId: '111111111111111111', discordUserId: null, interactionId: 'interaction-1' } },
    ]);
    expect(await rows('select owner_id from teams')).toEqual([{ owner_id: successorId }]);
    expect(await allReferencesTo(discordUserId)).toEqual([]);
  });
});

describe('foreign keys added after the first version (#110)', { timeout: 30_000 }, () => {
  const seasonId = '93000000-0000-4000-8000-000000000040';
  const offerId = '93000000-0000-4000-8000-000000000041';
  async function seedRecentTables(team = teamId, seasonStatus = 'completed') {
    await rows("insert into team_opponents(team_id, name, normalized_name, created_by) values ($1,'Orion','orion',$2)", [team, ownerId]);
    await rows(`insert into opponent_drafts(team_id, ally_side, source_id, game_number, source_url, snapshot, imported_by)
      values ($1,'blue','draft-1',1,'https://example.test/draft','{}'::jsonb,$2)`, [team, ownerId]);
    await rows('insert into nexus_seasons(id, name, status) values ($1,$2,$3)', [seasonId, 'Saison test', seasonStatus]);
    await rows("insert into nexus_registrations(season_id, team_id, registered_by, status) values ($1,$2,$3,'approved')", [seasonId, team, ownerId]);
    await rows("insert into scrim_offers(id, team_id, starts_at, level_min, level_max, created_by) values ($1,$2,now() + interval '1 day','gold','diamond',$3)", [offerId, team, ownerId]);
    await rows('insert into scrim_requests(offer_id, team_id, created_by) values ($1,$2,$3)', [offerId, team, ownerId]);
    await rows("insert into team_import_links(team_id, created_by, code_expires_at, expires_at) values ($1,$2,now() + interval '1 hour',now() + interval '30 days')", [team, ownerId]);
    await rows("insert into draft_rooms(team_id, creation_key, ally_side, blue_name, red_name, created_by) values ($1,$2,'blue','NXT','Orion',$3)", [team, '93000000-0000-4000-8000-000000000042', ownerId]);
    await rows("insert into match_archives(team_id, name, created_by) values ($1,'Archive',$2)", [team, ownerId]);
  }
  const RECENT: [string, string][] = [['team_opponents', 'created_by'], ['opponent_drafts', 'imported_by'], ['nexus_registrations', 'registered_by'],
    ['scrim_offers', 'created_by'], ['scrim_requests', 'created_by'], ['team_import_links', 'created_by'], ['draft_rooms', 'created_by'], ['match_archives', 'created_by']];

  it('keeps the rows of a transferred team and only removes the author', async () => {
    await seedTeam();
    await seedRecentTables();
    const target = browser();
    const response = await remove(target, await prepare(target, { [teamId]: successorId }));
    expect(response.status).toBe(200);
    for (const [table, column] of RECENT) {
      expect(await rows(`select team_id, ${column} as author from ${table}`)).toEqual([{ team_id: teamId, author: null }]);
    }
    expect(await rows('select status from nexus_registrations')).toEqual([{ status: 'approved' }]);
    expect(await allReferencesTo(ownerId)).toEqual([]);
  });

  it('keeps the account-administration rows written by the account, without their author', async () => {
    await rows('update account_subscriptions set updated_by = $1 where user_id = $2', [ownerId, successorId]);
    await rows(`insert into access_requests(contact_name, email, team_name, team_key, role, plan_code, payer, purchase_intent, consent_version, updated_by)
      values ('Other','other@example.test','Team','team','manager','structure','association','maybe','test',$1)`, [ownerId]);
    await rows("insert into inactivity_reminder_pending(user_id, recipient_email, inactive_since_at, state) values ($1,'owner@example.test',now(),'sending')", [ownerId]);
    await rows("update users set pending_email = 'next@example.test', pending_email_token = 'pending-token', pending_email_expires_at = now() + interval '1 hour' where id = $1", [ownerId]);
    const target = browser();
    expect((await remove(target, await prepare(target))).status).toBe(200);
    expect(await rows('select updated_by from account_subscriptions where user_id = $1', [successorId])).toEqual([{ updated_by: null }]);
    expect(await rows('select email, updated_by from access_requests')).toEqual([{ email: 'other@example.test', updated_by: null }]);
    expect(await rows('select * from inactivity_reminder_pending')).toHaveLength(0);
    expect(await account()).toMatchObject({ pending_email: null, pending_email_token: null, pending_email_expires_at: null });
    expect(await allReferencesTo(ownerId)).toEqual([]);
  });

  it('removes the rows of a team deleted with its only member', async () => {
    await seedTeam(teamId, ownerId, [[ownerId, 'captain']]);
    await seedRecentTables();
    const target = browser();
    expect((await remove(target, await prepare(target, { [teamId]: 'delete' }, true))).status).toBe(200);
    for (const [table] of RECENT) expect(await rows(`select * from ${table}`)).toHaveLength(0);
  });

  it('refuses to delete a team engaged in a running Nexus Rising season', async () => {
    await seedTeam(teamId, ownerId, [[ownerId, 'captain']]);
    await seedRecentTables(teamId, 'running');
    const target = browser();
    const response = await remove(target, await prepare(target, { [teamId]: 'delete' }, true));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('NEXUS_TEAM_ENGAGED');
    expect((await account()).deleted_at).toBeNull();
    expect(await rows('select owner_id from teams')).toEqual([{ owner_id: ownerId }]);
    expect(await rows('select registered_by from nexus_registrations')).toEqual([{ registered_by: ownerId }]);
  });

  it('covers the remaining bot, community and social sign-in references', async () => {
    await seedTeam(teamId, successorId, [[successorId, 'captain'], [ownerId, 'player']]);
    const guild = '111111111111111111', channel = '222222222222222222', app = '333333333333333333';
    await rows('insert into discord_connections(team_id, guild_id) values ($1,$2)', [teamId, guild]);
    const [route] = await rows('insert into discord_routes(team_id, guild_id, channel_id) values ($1,$2,$3) returning id', [teamId, guild, channel]);
    await rows(`insert into discord_connection_tests(team_id, request_id, route_id, guild_id, channel_id, config_version, status, created_by)
      values ($1,$2,$3,$4,$5,1,'failed',$6)`, [teamId, '93000000-0000-4000-8000-000000000050', route.id, guild, channel, ownerId]);
    await rows(`insert into discord_group_exports(team_id, request_id, archive_id, route_id, application_id, guild_id, channel_id, channel_name, config_version, source_hash, status, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,'general',1,$8,'failed',$9)`, [teamId, '93000000-0000-4000-8000-000000000051', '93000000-0000-4000-8000-000000000052', route.id, app, guild, channel, 'a'.repeat(64), ownerId]);
    await rows(`insert into discord_community_batches(reference, application_id, bot_id, content, content_hash, destinations)
      values ('ref-1',$1,$1,'Annonce',$2,$3)`, [app, 'b'.repeat(64), JSON.stringify([{ guildId: guild, channelId: channel }])]);
    await rows(`insert into discord_community_announcements(reference, application_id, bot_id, guild_id, channel_id, content, content_hash, status, created_by)
      values ('ref-1',$1,$1,$2,$3,'Annonce',$4,'failed',$5)`, [app, guild, channel, 'b'.repeat(64), ownerId]);
    await rows('insert into discord_community_settings(updated_by) values ($1)', [ownerId]);
    await rows("insert into discord_team_goals(id, team_id, title, created_by) values ($1,$2,'Team goal',$3)", [goalId, teamId, ownerId]);
    await rows("insert into players(id, team_id, name, role) values ($1,$2,'Other player','SUP')", [successorPlayerId, teamId]);
    const [playerGoal] = await rows("insert into player_goals(team_id, player_id, title, metric, target_value) values ($1,$2,'Vision','vision',30) returning id", [teamId, successorPlayerId]);
    await rows("insert into discord_player_goal_updates(team_id, goal_id, user_id, note) values ($1,$2,$3,'Shared progress')", [teamId, playerGoal.id, ownerId]);
    const session = sha256(sessionToken), browserHash = 'c'.repeat(64);
    await rows(`insert into social_auth_flows(state_hash, browser_hash, provider, flow, user_id, session_hash, link_revision, nonce, code_verifier, remember, destination, expires_at)
      values ($1,$2,'google','link',$3,$4,0,'nonce','verifier',false,'/parametres',now() + interval '5 minutes')`, ['d'.repeat(64), browserHash, ownerId, session]);
    await rows(`insert into social_auth_tickets(token_hash, browser_hash, purpose, provider, subject, flow, user_id, session_hash, link_revision, remember, destination, expires_at)
      values ($1,$2,'callback','google','subject','link',$3,$4,0,false,'/parametres',now() + interval '5 minutes')`, ['e'.repeat(64), browserHash, ownerId, session]);

    const target = browser();
    expect((await remove(target, await prepare(target))).status).toBe(200);
    for (const table of ['discord_connection_tests', 'discord_group_exports', 'discord_community_announcements']) {
      expect(await rows(`select created_by from ${table}`)).toEqual([{ created_by: null }]);
    }
    expect(await rows('select updated_by from discord_community_settings')).toEqual([{ updated_by: null }]);
    expect(await rows('select title, created_by from discord_team_goals')).toEqual([{ title: 'Team goal', created_by: null }]);
    expect(await rows('select note, user_id from discord_player_goal_updates')).toEqual([{ note: 'Shared progress', user_id: null }]);
    expect(await rows('select * from social_auth_flows')).toHaveLength(0);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(0);
    expect(await allReferencesTo(ownerId)).toEqual([]);
  });

  it('lets only the administrative deletion lift the shared-team guard, for its own transaction', async () => {
    await seedTeam();
    await expect(state.pg.query('delete from users where id = $1', [ownerId])).rejects.toThrow('ACCOUNT_OWNS_SHARED_TEAM');
    await state.pg.transaction(async (tx: any) => {
      await tx.query("select set_config('nxt5.admin_account_delete','on',true)");
      await tx.query('delete from users where id = $1', [ownerId]);
    });
    expect(await rows('select * from teams')).toHaveLength(0);
    // The setting is local to that transaction: the guard applies again afterwards.
    await seedTeam(otherTeamId, coachId, [[coachId, 'captain'], [successorId, 'player']]);
    await expect(state.pg.query('delete from users where id = $1', [coachId])).rejects.toThrow('ACCOUNT_OWNS_SHARED_TEAM');
  });
});

describe('review of #315', { timeout: 30_000 }, () => {
  it('lets an account with an unverified address delete itself', async () => {
    await rows('update users set email_verified = false where id = $1', [ownerId]);
    const target = browser();
    expect((await call(target, { action: 'inspect' })).status).toBe(200);
    expect((await remove(target, await prepare(target))).status).toBe(200);
    expect((await account()).deleted_at).toBeTruthy();
  });

  it('refuses a successor who already owns a team with the same name, before and at deletion', async () => {
    await seedTeam();
    await rows("insert into teams(owner_id, name, tag) values ($1,'Team 10','DUP')", [successorId]);
    const target = browser();
    const inspected = await inspect(target);
    expect(inspected.teams[0].members.find((member: any) => member.id === successorId)).toMatchObject({ eligible: true, nameTaken: true });
    const refused = await call(target, { action: 'prepare', acknowledged: true, teamPlan: { [teamId]: successorId } });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: 'DELETION_TEAM_NAME_TAKEN', error: expect.stringContaining('Renomme cette équipe') });

    // The duplicate appears after the first confirmation: the SQL function refuses with the same code.
    await rows("update teams set name = 'Other name' where owner_id = $1", [successorId]);
    const token = await prepare(target, { [teamId]: successorId });
    await rows("update teams set name = 'Team 10' where owner_id = $1 and id <> $2", [successorId, teamId]);
    const response = await remove(target, token);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('DELETION_TEAM_NAME_TAKEN');
    expect((await account()).deleted_at).toBeNull();
    expect(await rows('select owner_id from teams where id = $1', [teamId])).toEqual([{ owner_id: ownerId }]);
  });

  it.each(['suspended', 'unverified'])('refuses a %s successor, before and at deletion', async (kind) => {
    const block = kind === 'suspended' ? 'update users set suspended_at = now() where id = $1' : 'update users set email_verified = false where id = $1';
    const unblock = kind === 'suspended' ? 'update users set suspended_at = null where id = $1' : 'update users set email_verified = true where id = $1';
    await seedTeam();
    await rows(block, [successorId]);
    const target = browser();
    expect((await inspect(target)).teams[0].members.find((member: any) => member.id === successorId)).toMatchObject({ eligible: false });
    const refused = await call(target, { action: 'prepare', acknowledged: true, teamPlan: { [teamId]: successorId } });
    expect(refused.status).toBe(409);
    expect((await refused.json()).code).toBe('DELETION_SUCCESSOR_INELIGIBLE');

    await rows(unblock, [successorId]);
    const token = await prepare(target, { [teamId]: successorId });
    await rows(block, [successorId]);
    const response = await remove(target, token);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('DELETION_SUCCESSOR_INELIGIBLE');
    expect((await account()).deleted_at).toBeNull();
  });

  it('never treats an empty address as a value to scrub in other accounts\' logs', async () => {
    await rows("update users set email = '' where id = $1", [ownerId]);
    await rows("insert into audit_logs(user_id, action, metadata) values ($1,'profile.update','{\"email\":\"\",\"note\":\"\"}')", [successorId]);
    const target = browser();
    expect((await remove(target, await prepare(target))).status).toBe(200);
    expect(await rows("select metadata from audit_logs where action = 'profile.update'")).toEqual([{ metadata: { email: '', note: '' } }]);
  });

  it('locks the account and the planned successors together, in identifier order', async () => {
    // A concurrent administrative transfer locks (previous owner, new owner) in id order
    // before the team; the deletion takes the same locks first, in the same order.
    const source = (await rows("select prosrc from pg_proc where proname = 'nxt5_delete_account'"))[0].prosrc as string;
    const lockAll = source.indexOf('order by id for update;');
    expect(lockAll).toBeGreaterThan(-1);
    expect(lockAll).toBeLessThan(source.indexOf('select * into account from users where id = account_id for update'));
    expect(lockAll).toBeLessThan(source.indexOf('perform 1 from teams where owner_id = account_id order by id for update'));
    await seedTeam();
    const target = browser();
    expect((await remove(target, await prepare(target, { [teamId]: successorId }))).status).toBe(200);
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
