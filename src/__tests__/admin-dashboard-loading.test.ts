import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { loadMigrations } from '../../tools/migration-runner.mjs';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn() }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: mocks.sql }));
import handler from '../../netlify/functions/admin-dashboard';

let db: PGlite;
const context = {} as Parameters<typeof handler>[1];
const get = (query = '') => handler(new Request('https://nxt5.test/.netlify/functions/admin-dashboard' + query), context);
const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const queryText = () => mocks.sql.mock.calls.map(([parts]) => parts.join('?')).join('\n');

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  for (const migration of (await loadMigrations()).slice(0, 2)) {
    await db.exec(migration.sql.replace(/create extension if not exists pgcrypto;/g, '')
      .replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')"));
  }
  // One transaction fixes SQL now() so period boundaries do not drift between
  // legacy and view-specific queries. Each request still executes its real SQL.
  await db.exec(`begin; set local timezone = 'UTC';
    insert into users(id, account_name, name, password_hash, email, email_verified, created_at, last_active_at, notif_inactivity, inactivity_email_sent_at)
    values
      ('${id(1)}', 'active', 'Active', 'hash', 'active@example.test', true, now() - interval '2 days', now(), true, null),
      ('${id(2)}', 'eligible', 'Eligible', 'hash', 'eligible@example.test', true, now() - interval '120 days', now() - interval '100 days', true, null),
      ('${id(3)}', 'opted-out', 'Opted out', 'hash', 'opted-out@example.test', true, now() - interval '10 days', now() - interval '100 days', false, null),
      ('${id(4)}', 'unverified', 'Unverified', 'hash', 'unverified@example.test', false, now() - interval '40 days', now() - interval '100 days', true, null),
      ('${id(5)}', 'already-sent', 'Already sent', 'hash', 'sent@example.test', true, now() - interval '110 days', now() - interval '100 days', true, now() - interval '50 days');
    insert into teams(id, owner_id, name, tag, created_at)
    values ('${id(11)}', '${id(1)}', 'Active team', 'ACT', now() - interval '40 days'),
      ('${id(12)}', '${id(2)}', 'Older import', 'OLD', now() - interval '8 days'),
      ('${id(13)}', '${id(1)}', 'Empty team', 'NEW', now() - interval '2 days');
    insert into team_members(team_id, user_id)
    values ('${id(11)}', '${id(1)}'), ('${id(12)}', '${id(1)}'), ('${id(11)}', '${id(2)}');
    insert into players(id, team_id, user_id, name, role)
    values ('${id(21)}', '${id(11)}', '${id(1)}', 'Linked', 'TOP'),
      ('${id(22)}', '${id(11)}', null, 'Unlinked', 'JGL'),
      ('${id(23)}', '${id(12)}', '${id(1)}', 'Other team', 'TOP');
    insert into matches(team_id, game_id, created_at, patch, duration_seconds, result)
    values ('${id(11)}', 'recent', now() - interval '1 hour', '26.18', 1200, 'Victoire'),
      ('${id(11)}', 'incomplete', now() - interval '2 days', '', 0, 'Défaite'),
      ('${id(11)}', 'old', now() - interval '35 days', '26.16', null, 'Analyse'),
      ('${id(12)}', 'second-team', now() - interval '8 days', null, 2000, 'Victoire');
    insert into reports(team_id, title, content) values ('${id(11)}', 'Review one', 'Saved'), ('${id(11)}', 'Review two', 'Saved');
    insert into champion_pool(team_id, player_id, player_name, champion) values ('${id(11)}', '${id(21)}', 'Linked', 'Ahri');
    insert into composition_types(team_id, title) values ('${id(12)}', 'Composition');
    insert into player_availability(team_id, player_id) values ('${id(11)}', '${id(21)}');
    insert into player_goals(team_id, player_id, title, metric, target_value) values ('${id(11)}', '${id(21)}', 'Goal', 'cs', 7);
    insert into inactivity_reminder_deliveries(user_id, recipient_email, inactive_since_at, sent_at)
    values ('${id(1)}', 'active@example.test', now() - interval '120 days', now() - interval '10 days'),
      ('${id(5)}', 'sent@example.test', now() - interval '100 days', now() - interval '50 days');
  `);
}, 15_000);

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ id: 'admin' });
  mocks.sql.mockReset().mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.reduce((text, part, index) => text + part + (index < values.length ? '$' + (index + 1) : ''), '');
    return (await db.query(query, values)).rows;
  });
});
afterAll(async () => { await db?.close(); });

describe('view-specific administration data', () => {
  it.each([
    ['overview', 6, ['generatedAt', 'totals', 'growth', 'activity', 'attention', 'adoption', 'accountFunnel', 'inactivityReminders', 'daily']],
    ['teams', 2, ['generatedAt', 'totals', 'teamDirectory']],
    ['usage', 4, ['generatedAt', 'totals', 'adoption', 'accountFunnel', 'matchHealth']],
    ['reminders', 2, ['generatedAt', 'inactivityReminders']]
  ] as const)('loads %s with %i queries and preserves the legacy values', async (view, queryCount, fields) => {
    const legacy = await (await get()).json();
    expect(mocks.sql).toHaveBeenCalledTimes(14);
    mocks.sql.mockClear();
    const response = await get('?view=' + view);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.sql).toHaveBeenCalledTimes(queryCount);
    const { generatedAt, ...data } = await response.json();
    expect(Number.isFinite(Date.parse(generatedAt))).toBe(true);
    expect([...Object.keys(data), 'generatedAt'].sort()).toEqual([...fields].sort());
    expect(legacy).toMatchObject(data);
    if (view !== 'reminders') {
      expect(queryText()).not.toContain('inactivity_reminder_deliveries');
      expect(JSON.stringify(data)).not.toContain('recipientEmail');
      expect(queryText()).not.toContain('from sessions');
    }
  });

  it('keeps overview counts, distinct-team metrics and zero-filled calendar days correct', async () => {
    const data = await (await get('?view=overview')).json();
    expect(data.totals).toEqual({ teams: 3, users: 5 });
    expect(data.growth).toEqual({ days7: { teams: 1, matches: 2 }, days30: { teams: 2, users: 2, matches: 3 } });
    expect(data.activity).toEqual({ activeTeams30d: 2 });
    expect(data.attention).toEqual({ teamsWithoutPlayers: 1 });
    expect(data.adoption).toEqual({ matches: 2, reports: 1 });
    expect(data.accountFunnel).toEqual({ verified: 4, usersInTeam: 2 });
    expect(data.inactivityReminders).toEqual({ awaitingDelivery: 1 });
    expect(data.daily).toHaveLength(30);
    expect(new Set(data.daily.map(row => row.date)).size).toBe(30);
    expect(data.daily.reduce((totals, row) => ({ users: totals.users + row.users, teams: totals.teams + row.teams, matches: totals.matches + row.matches }), { users: 0, teams: 0, matches: 0 }))
      .toEqual({ users: 2, teams: 2, matches: 3 });
    expect(data.daily.some(row => row.users === 0 && row.teams === 0 && row.matches === 0)).toBe(true);
  });

  it('keeps empty teams in the directory and orders by last import or creation', async () => {
    const data = await (await get('?view=teams')).json();
    expect(data.totals).toEqual({ teams: 3 });
    expect(data.teamDirectory.map(team => team.id)).toEqual([id(11), id(13), id(12)]);
    expect(data.teamDirectory[0]).toMatchObject({ players: 2, matches: 3 });
    expect(data.teamDirectory[1]).toMatchObject({ players: 0, matches: 0, lastActivityAt: null });
    expect(data.teamDirectory[2]).toMatchObject({ players: 1, matches: 1 });
  });

  it('includes the first midnight and excludes the midnight after the chart period', async () => {
    const before = await (await get('?view=overview')).json();
    await db.exec('savepoint chart_boundaries');
    try {
      await db.exec(`insert into matches(team_id, game_id, created_at) values
        ('${id(11)}', 'before-chart', date_trunc('day', now()) - interval '29 days' - interval '1 microsecond'),
        ('${id(11)}', 'chart-start', date_trunc('day', now()) - interval '29 days'),
        ('${id(11)}', 'chart-end', date_trunc('day', now()) + interval '1 day' - interval '1 microsecond'),
        ('${id(11)}', 'after-chart', date_trunc('day', now()) + interval '1 day');`);
      const after = await (await get('?view=overview')).json();
      expect(after.daily).toHaveLength(30);
      expect(after.daily[0].matches).toBe(before.daily[0].matches + 1);
      expect(after.daily.at(-1).matches).toBe(before.daily.at(-1).matches + 1);
      expect(after.daily.reduce((sum, row) => sum + row.matches, 0)).toBe(5);
    } finally {
      await db.exec('rollback to chart_boundaries; release chart_boundaries');
    }
  });

  it('counts adoption once per team and users once across multiple teams', async () => {
    const data = await (await get('?view=usage')).json();
    expect(data.totals).toEqual({ teams: 3, users: 5, matches: 4 });
    expect(data.adoption).toEqual({ roster: 2, matches: 2, championPool: 1, compositions: 1, reports: 1, planning: 1, goals: 1, archives: 0 });
    expect(data.accountFunnel).toEqual({ verified: 4, usersInTeam: 2, usersLinkedToPlayer: 1 });
    expect(data.matchHealth).toEqual({ imports24h: 1, matchesWithPatch: 2, matchesWithDuration: 2 });
  });

  it('preserves reminder eligibility, recipient history and return status', async () => {
    const { inactivityReminders: data } = await (await get('?view=reminders')).json();
    expect(data).toMatchObject({ deliveries: 2, recipients: 2, deliveries30d: 1, awaitingDelivery: 1 });
    expect(data.recent).toHaveLength(2);
    expect(data.recent[0]).toMatchObject({ recipientEmail: 'active@example.test', returnedAfterReminder: true });
    expect(data.recent[1]).toMatchObject({ recipientEmail: 'sent@example.test', returnedAfterReminder: false });
  });

  it('keeps the existing team detail route available', async () => {
    const response = await get('?view=team&teamId=' + id(11));
    expect(response.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(5);
    expect(await response.json()).toMatchObject({ team: { id: id(11) }, totals: { players: 2, matches: 3 }, matches: { last30d: 2 } });
  });

  it('still authenticates after a successful read and does not reuse protected data', async () => {
    expect((await get('?view=reminders')).status).toBe(200);
    mocks.sql.mockClear();
    mocks.auth.mockRejectedValueOnce(Object.assign(new Error('Accès refusé'), { status: 403 }));
    const response = await get('?view=reminders');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Accès refusé' });
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it.each(['?view=unknown', '?view=', '?view=constructor', '?view=team&teamId=bad'])('rejects invalid parameters before dashboard queries: %s', async query => {
    expect((await get(query)).status).toBe(400);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('rejects writes without querying dashboard data', async () => {
    const response = await handler(new Request('https://nxt5.test/.netlify/functions/admin-dashboard?view=overview', { method: 'POST' }), context);
    expect(response.status).toBe(405);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
