import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any,
  statements: [] as string[],
  omitDueFlags: false,
  beforeQuery: null as null | ((query: string) => Promise<void>),
}));

vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const statement = JSON.parse(options.body);
    state.statements.push(statement.query);
    await state.beforeQuery?.(statement.query);
    const result = await state.pg.query(statement.query, statement.params);
    const fields = result.fields.filter((field: any) => !state.omitDueFlags || !field.name.endsWith('_activity_due'));
    return new Response(JSON.stringify({
      fields,
      rows: result.rows.map((row: any) => fields.map((field: any) => {
        const value = row[field.name];
        if (value === null || value === undefined) return null;
        if (typeof value === 'boolean') return value ? 't' : 'f';
        // Neon receives PostgreSQL's timestamp text, which uses a space.
        return value instanceof Date ? value.toISOString().replace('T', ' ') : String(value);
      })),
      rowCount: result.affectedRows ?? result.rows.length,
    }));
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});

import { requireAuth, sha256 } from '../../netlify/functions/_lib/auth';

const userId = '00000000-0000-4000-8000-000000000001';
const sessionId = '00000000-0000-4000-8000-000000000002';
const token = 'authenticated-session-token';
const context = { cookies: { get: () => token, set: vi.fn() } } as any;
const request = new Request('https://nxt5.test/.netlify/functions/admin-dashboard');
const authenticate = () => requireAuth(request, context);
const activity = async () => (await state.pg.query(`
  select sessions.last_seen_at, users.last_active_at, users.inactivity_notice_pending
  from sessions join users on users.id = sessions.user_id
`)).rows[0];

beforeAll(async () => {
  state.pg = new PGlite();
  // Execute the real authentication and activity SQL, using only its tables.
  await state.pg.exec(`
    create table users (
      id uuid primary key, account_name text, email text, email_verified boolean,
      name text, notif_match boolean, notif_report boolean, notif_inactivity boolean,
      inactivity_notice_pending boolean default false, last_active_at timestamptz,
      inactivity_email_sent_at timestamptz, inactivity_email_claimed_at timestamptz,
      created_at timestamptz default now()
    );
    create table sessions (
      id uuid primary key, user_id uuid references users(id), token_hash text,
      expires_at timestamptz, revoked_at timestamptz, last_seen_at timestamptz
    );
  `);
}, 20_000);

beforeEach(async () => {
  state.omitDueFlags = false;
  state.beforeQuery = null;
  context.cookies.set.mockClear();
  await state.pg.exec('truncate sessions, users');
  await state.pg.query(`insert into users(id, account_name, email, email_verified, name,
      notif_match, notif_report, notif_inactivity, last_active_at)
    values ($1, 'admin', 'admin@example.test', true, 'Admin', true, true, false, now() - interval '1 minute')`, [userId]);
  await state.pg.query(`insert into sessions(id, user_id, token_hash, expires_at, last_seen_at)
    values ($1, $2, $3, now() + interval '1 day', now() - interval '1 minute')`, [sessionId, userId, sha256(token)]);
  state.statements = [];
});

afterAll(async () => { await state.pg?.close(); });

describe('authentication activity query cost', () => {
  it('validates a recent session in one query without rewriting activity or losing user fields', async () => {
    await state.pg.exec('update users set inactivity_notice_pending = true');
    const before = await activity();
    const user = await authenticate();

    expect(state.statements).toHaveLength(1);
    expect(await activity()).toEqual(before);
    expect(user).toMatchObject({ id: userId, email_verified: true, notif_inactivity: false, inactivity_notice_pending: true });
    expect(user).not.toHaveProperty('session_activity_due');
    expect(user).not.toHaveProperty('user_activity_due');
  });

  it.each([
    { sessionDue: true, userDue: false, queries: 2 },
    { sessionDue: false, userDue: true, queries: 2 },
    { sessionDue: true, userDue: true, queries: 3 },
  ])('updates only due activity: session=$sessionDue user=$userDue', async ({ sessionDue, userDue, queries }) => {
    if (sessionDue) await state.pg.exec("update sessions set last_seen_at = now() - interval '6 minutes'");
    if (userDue) await state.pg.exec("update users set last_active_at = now() - interval '6 minutes'");
    const before = await activity();

    const user = await authenticate();

    expect(state.statements).toHaveLength(queries);
    const after = await activity();
    expect(after.last_seen_at.getTime() > before.last_seen_at.getTime()).toBe(sessionDue);
    expect(after.last_active_at.getTime() > before.last_active_at.getTime()).toBe(userDue);
    expect(after.inactivity_notice_pending).toBe(false);
    expect(new Date(user.last_active_at!).getTime()).toBe(after.last_active_at.getTime());
  });

  it('initializes missing activity timestamps without a false inactivity notice', async () => {
    await state.pg.exec('update sessions set last_seen_at = null; update users set last_active_at = null');

    const user = await authenticate();

    expect(state.statements).toHaveLength(3);
    expect(await activity()).toMatchObject({ last_seen_at: expect.any(Date), last_active_at: expect.any(Date), inactivity_notice_pending: false });
    expect(user.inactivity_notice_pending).toBe(false);
  });

  it('keeps the welcome-back notice when a long-inactive user returns', async () => {
    await state.pg.exec("update users set last_active_at = now() - interval '91 days'");

    const user = await authenticate();

    expect(state.statements).toHaveLength(2);
    expect(user.inactivity_notice_pending).toBe(true);
    expect((await activity()).inactivity_notice_pending).toBe(true);
  });

  it.each(['revoked', 'expired'])('revalidates a previously accepted session and rejects it when %s', async (kind) => {
    await authenticate();
    if (kind === 'revoked') await state.pg.exec('update sessions set revoked_at = now()');
    else await state.pg.exec("update sessions set expires_at = now() - interval '1 second'");
    state.statements = [];

    await expect(authenticate()).rejects.toMatchObject({ status: 401 });

    expect(state.statements).toHaveLength(1);
    expect(context.cookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: 'rb_session', value: '', maxAge: 0 }));
  });

  it('keeps SQL guards when concurrent activity makes both updates unnecessary', async () => {
    await state.pg.exec("update sessions set last_seen_at = now() - interval '6 minutes'; update users set last_active_at = now() - interval '91 days'");
    let concurrentActivity: any;
    state.beforeQuery = async (query) => {
      if (!/update sessions/i.test(query)) return;
      state.beforeQuery = null;
      await state.pg.exec('update sessions set last_seen_at = now(); update users set last_active_at = now()');
      concurrentActivity = await activity();
    };

    const user = await authenticate();

    expect(state.statements).toHaveLength(3);
    expect(await activity()).toEqual(concurrentActivity);
    expect(user.inactivity_notice_pending).toBe(false);
  });

  it('retains guarded activity updates when an adapter omits freshness flags', async () => {
    state.omitDueFlags = true;
    const before = await activity();

    await authenticate();

    expect(state.statements).toHaveLength(3);
    expect(await activity()).toEqual(before);
  });
});
