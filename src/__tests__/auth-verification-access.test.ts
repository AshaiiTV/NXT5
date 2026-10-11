import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any, queries: [] as string[], emails: vi.fn(async (_message: any) => {}),
  beforeQuery: null as null | ((query: string) => Promise<void>)
}));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {}, assertSocialSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/email', () => ({ sendEmailVerificationEmail: state.emails }));
// Keep the production guard, handlers and parameterized SQL. Only transport and
// email delivery are replaced, so a mocked requireAuth cannot hide a bypass.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const statement = JSON.parse(options.body);
    state.queries.push(statement.query);
    try {
      await state.beforeQuery?.(statement.query);
      const result = await state.pg.query(statement.query, statement.params);
      return new Response(JSON.stringify({
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          return value instanceof Date ? value.toISOString() : String(value);
        })), rowCount: result.affectedRows ?? result.rows.length
      }));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});

import { createSession, requireAuth, sha256, verifyLoginPassword } from '../../netlify/functions/_lib/auth';
import login from '../../netlify/functions/auth-login';
import authMe from '../../netlify/functions/auth-me';
import logout from '../../netlify/functions/auth-logout';
import updateProfile from '../../netlify/functions/auth-update-profile';
import changePassword from '../../netlify/functions/auth-change-password';
import resend from '../../netlify/functions/resend-verify-email';
import verifyEmail from '../../netlify/functions/verify-email';
import createTeam from '../../netlify/functions/teams-create';
import bootstrap from '../../netlify/functions/bootstrap';
import socialStatus from '../../netlify/functions/auth-social-status';

const userId = '00000000-0000-4000-8000-000000000001';
const token = 'authenticated-unverified-session';
const password = 'Current account password';
const verificationToken = 'verification-token-delivered-by-email';
let cookie = token;
const context = { cookies: { get: () => cookie, set: vi.fn((value: any) => { if (value.name === 'rb_session') cookie = value.value; }) } } as any;
const request = (route: string, body?: any) => new Request(`https://nxt5.test/.netlify/functions/${route}`, body === undefined ? {} : {
  method: 'POST', headers: { Origin: 'https://nxt5.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const create = () => createTeam(request('teams-create', { name: 'Verified team', tag: 'NXT', region: 'EUW' }), context);
const profile = (email = 'corrected@example.test') => updateProfile(request('auth-update-profile', { name: 'Test account', email, currentPassword: password }), context);
const account = async () => (await state.pg.query('select * from users where id = $1', [userId])).rows[0];

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
  await state.pg.exec(`alter table users add column social_link_revision bigint not null default 0;
    create table social_identities (user_id uuid references users(id), provider text, subject text, display_name text, linked_at timestamptz default now());`);
}, 20_000);

beforeEach(async () => {
  vi.stubEnv('SESSION_SECRET', 'test-secret-'.repeat(8));
  state.beforeQuery = null;
  cookie = token;
  context.cookies.set.mockClear();
  state.emails.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('truncate users cascade; truncate rate_limits');
  await state.pg.query(`insert into users(id, account_name, name, email, password_hash, email_verified, email_verify_token, email_verify_expires_at)
    values ($1, 'test-account', 'Test account', 'test@example.test', $2, false, $3, now() + interval '23 hours')`,
  [userId, bcrypt.hashSync(password, 4), sha256(verificationToken)]);
  await state.pg.query(`insert into sessions(user_id, token_hash, expires_at, last_seen_at)
    values ($1, $2, now() + interval '1 day', now())`, [userId, sha256(token)]);
  state.queries = [];
});
afterAll(async () => { vi.unstubAllEnvs(); await state.pg?.close(); });

describe('verified email is required by the real business API guard', () => {
  it.each([
    { email: 'test@example.test', verified: false },
    { email: 'test@example.test', verified: null },
    { email: null, verified: false },
    { email: null, verified: true },
    { email: '', verified: true }
  ])('denies reads and mutations for email=$email verified=$verified', async ({ email, verified }) => {
    await state.pg.query('update users set email = $1, email_verified = $2 where id = $3', [email, verified, userId]);
    for (const response of [await create(), await bootstrap(request('bootstrap'), context)]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' });
    }
    expect((await state.pg.query('select count(*)::int as count from teams')).rows[0].count).toBe(0);
    expect(state.queries.every(query => /from sessions/.test(query))).toBe(true);
    expect(context.cookies.set).not.toHaveBeenCalled();
  });

  it('keeps password login and session inspection available until the current address is verified', async () => {
    expect((await login(request('auth-login', { accountName: 'test-account', password }), context)).status).toBe(200);
    expect(cookie).not.toBe(token);
    const response = await authMe(request('auth-me'), context);
    expect(response.status).toBe(200);
    expect((await response.json()).user).toMatchObject({ email_verified: false });
    expect((await create()).status).toBe(403);
    expect((await verifyEmail(request(`verify-email?token=${verificationToken}`), context)).headers.get('location')).toContain('success=true');
    expect((await create()).status).toBe(200);
  });

  it('immediately removes business access from an existing session when its address changes', async () => {
    await state.pg.exec('update users set email_verified = true');
    expect((await bootstrap(request('bootstrap'), context)).status).toBe(200);
    expect((await profile()).status).toBe(200);
    expect((await create()).status).toBe(403);
    expect((await authMe(request('auth-me'), context)).status).toBe(200);
    const delivery = state.emails.mock.calls[0][0];
    expect((await verifyEmail(request(`verify-email?token=${delivery.token}`), context)).headers.get('location')).toContain('success=true');
    expect((await create()).status).toBe(200);
  });

  it('lets an old account without an address add one and finish verification', async () => {
    await state.pg.exec("update users set email = null, email_verify_token = null, email_verify_expires_at = null");
    expect((await authMe(request('auth-me'), context)).status).toBe(200);
    expect((await profile()).status).toBe(200);
    expect((await account()).email_verified).toBe(false);
    expect((await create()).status).toBe(403);
    const delivery = state.emails.mock.calls[0][0];
    await verifyEmail(request(`verify-email?token=${delivery.token}`), context);
    expect((await create()).status).toBe(200);
  });

  it('keeps resend, account security and logout available to an unverified session', async () => {
    expect((await resend(request('resend-verify-email', {}), context)).status).toBe(200);
    expect(state.emails).toHaveBeenCalledTimes(1);
    const status = await socialStatus(request('auth-social-status'), context);
    expect(status.status).toBe(200);
    expect((await status.json()).hasPassword).toBe(true);
    expect((await changePassword(request('auth-change-password', { currentPassword: password, nextPassword: 'New safe account password' }), context)).status).toBe(200);
    expect((await logout(request('auth-logout', {}), context)).status).toBe(200);
    expect(cookie).toBe('');
    expect((await create()).status).toBe(401);
  });

  it('applies the same access rule to a social-only session', async () => {
    await state.pg.exec("update users set email_verified = true, password_hash = ''");
    await state.pg.query("insert into social_identities(user_id, provider, subject) values ($1, 'google', 'social-subject')", [userId]);
    await createSession({ userId, context, request: request('auth-social-finish'), socialIdentity: { provider: 'google', subject: 'social-subject', revision: 0 } });
    expect((await create()).status).toBe(200);
    await state.pg.exec('update users set email_verified = false');
    expect((await create()).status).toBe(403);
    const status = await socialStatus(request('auth-social-status'), context);
    expect(status.status).toBe(200);
    expect((await status.json()).hasPassword).toBe(false);
  });

  it.each(['expired', 'revoked'])('never lets verification exceptions accept a %s session', async (kind) => {
    await state.pg.exec(kind === 'revoked' ? 'update sessions set revoked_at = now()' : "update sessions set expires_at = now() - interval '1 second'");
    await expect(requireAuth(request('auth-me'), context, { allowUnverifiedEmail: true })).rejects.toMatchObject({ status: 401 });
    expect(cookie).toBe('');
  });

  it('limits password guesses on the security endpoint even for a valid unverified session', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await changePassword(request('auth-change-password', { currentPassword: 'wrong password', nextPassword: 'New account password' }), context)).status).toBe(401);
    }
    const response = await changePassword(request('auth-change-password', { currentPassword: password, nextPassword: 'New account password' }), context);
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await bcrypt.compare(password, (await account()).password_hash)).toBe(true);
  });
});

describe('email verification requires the account login in the mailbox browser', () => {
  const verification = (value: string | undefined) => verifyEmail(request(`verify-email?token=${verificationToken}`), {
    cookies: { get: () => value }
  } as any);

  it('cannot activate a preregistered account when its mailbox owner follows the email without knowing its password', async () => {
    // The seeded password/session belong to the person who preregistered the
    // mailbox. Opening the emailed link in the mailbox owner's other browser
    // must not turn that person's existing session into business access.
    expect((await create()).status).toBe(403);
    const response = await verification(undefined);
    expect(response.headers.get('location')).toContain('error=signin');
    expect(response.headers.get('location')).not.toContain(verificationToken);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await account()).toMatchObject({ email_verified: false, email_verify_token: sha256(verificationToken) });
    expect((await create()).status).toBe(403);
  });

  it.each(['unknown', 'expired', 'revoked', 'another-account'])('keeps the email token intact for a %s browser session', async kind => {
    const otherSession = 'mailbox-browser-session';
    const otherId = '00000000-0000-4000-8000-000000000002';
    if (kind === 'another-account') await state.pg.query("insert into users(id,account_name,name,email,password_hash,email_verified) values ($1,'other','Other','other@example.test','hash',true)", [otherId]);
    if (kind !== 'unknown') await state.pg.query(`insert into sessions(user_id,token_hash,expires_at,revoked_at)
      values ($1,$2,${kind === 'expired' ? "now() - interval '1 second'" : "now() + interval '1 day'"},${kind === 'revoked' ? 'now()' : 'null'})`, [kind === 'another-account' ? otherId : userId, sha256(otherSession)]);
    expect((await verification(otherSession)).headers.get('location')).toContain('error=signin');
    expect(await account()).toMatchObject({ email_verified: false, email_verify_token: sha256(verificationToken) });
    expect((await create()).status).toBe(403);
  });

  it('verifies the signed-in account once and revokes other sessions without touching another account', async () => {
    const otherId = '00000000-0000-4000-8000-000000000002';
    await state.pg.query("insert into users(id,account_name,name,email,password_hash,email_verified) values ($1,'other','Other','other@example.test','hash',true)", [otherId]);
    for (const [id, value] of [[userId, 'old-sibling-session'], [otherId, 'unrelated-session']]) {
      await state.pg.query("insert into sessions(user_id,token_hash,expires_at) values ($1,$2,now() + interval '1 day')", [id, sha256(value)]);
    }
    expect((await verification(cookie)).headers.get('location')).toContain('success=true');
    expect((await verification(cookie)).headers.get('location')).toContain('error=invalid');
    expect((await create()).status).toBe(200);
    const sessions = (await state.pg.query('select token_hash,revoked_at from sessions')).rows;
    expect(sessions.find((row: any) => row.token_hash === sha256('old-sibling-session')).revoked_at).not.toBeNull();
    expect(sessions.find((row: any) => row.token_hash === sha256('unrelated-session')).revoked_at).toBeNull();
    expect(sessions.find((row: any) => row.token_hash === sha256(cookie)).revoked_at).toBeNull();
  });

  it.each(['expired', 'revoked'])('rechecks a session that becomes %s after reading the mailbox token', async kind => {
    state.beforeQuery = async query => {
      if (!query.includes('with verified_account')) return;
      state.beforeQuery = null;
      await state.pg.query(`update sessions set ${kind === 'expired' ? "expires_at=now() - interval '1 second'" : 'revoked_at=now()'} where token_hash=$1`, [sha256(cookie)]);
    };
    expect((await verification(cookie)).headers.get('location')).not.toContain('success=true');
    expect(await account()).toMatchObject({ email_verified: false, email_verify_token: sha256(verificationToken) });
  });

  it('requires a fresh account snapshot if another login is issued during verification, then revokes that session on retry', async () => {
    let newCookie = '';
    state.beforeQuery = async query => {
      if (!query.includes('with verified_account')) return;
      state.beforeQuery = null;
      await createSession({ userId, request: request('auth-login'),
        context: { cookies: { set: (value: any) => { newCookie = value.value; } } } as any,
        expectedPasswordHash: (await account()).password_hash });
    };
    expect((await verification(cookie)).headers.get('location')).not.toContain('success=true');
    expect(newCookie).not.toBe('');
    expect(await account()).toMatchObject({ email_verified: false, email_verify_token: sha256(verificationToken) });
    expect((await verification(cookie)).headers.get('location')).toContain('success=true');
    expect((await state.pg.query('select revoked_at from sessions where token_hash=$1', [sha256(newCookie)])).rows[0].revoked_at).not.toBeNull();
  });

  it('rolls back email activation and link consumption if session revocation fails', async () => {
    await state.pg.query("insert into sessions(user_id,token_hash,expires_at) values ($1,$2,now() + interval '1 day')", [userId, sha256('sibling')]);
    await state.pg.exec('alter table sessions add constraint audit_test_no_revocation check (revoked_at is null)');
    try {
      const response = await verification(cookie);
      expect(response.status).toBe(500);
      expect(await account()).toMatchObject({ email_verified: false, email_verify_token: sha256(verificationToken) });
      const message = await response.text();
      expect(message).not.toContain(verificationToken);
      expect(message).not.toContain('audit_test_no_revocation');
    } finally {
      await state.pg.exec('alter table sessions drop constraint audit_test_no_revocation');
    }
  });
});

describe('login failure paths', () => {
  it('returns the same error and no session for missing, social-only and wrong-password accounts', async () => {
    const responses = [await login(request('auth-login', { accountName: 'does-not-exist', password }), context)];
    responses.push(await login(request('auth-login', { accountName: 'test-account', password: 'wrong password' }), context));
    await state.pg.exec("update users set password_hash = ''");
    responses.push(await login(request('auth-login', { accountName: 'test-account', password }), context));
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Identifiants incorrects.' });
    }
    expect(context.cookies.set).not.toHaveBeenCalled();
  });

  it('never accepts a password without a stored credential', async () => {
    await expect(verifyLoginPassword(password, null)).resolves.toBe(false);
    await expect(verifyLoginPassword(password, '')).resolves.toBe(false);
    await expect(verifyLoginPassword(password, (await account()).password_hash)).resolves.toBe(true);
  });
});
