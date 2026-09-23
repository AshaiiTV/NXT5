import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any,
  beforeQuery: null as null | ((query: string) => Promise<void>)
}));

// Execute the production parameterized SQL through Neon against PostgreSQL.
// PGlite serializes queries; hooks exercise both commit orders around the
// credential/session write, including a pending change's stale account version.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const statement = JSON.parse(options.body);
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
        })),
        rowCount: result.affectedRows ?? result.rows.length
      }));
    } catch (failure: any) {
      return new Response(JSON.stringify({ message: failure.message, code: failure.code }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: async () => {} }));

import login from '../../netlify/functions/auth-login';
import resetPassword from '../../netlify/functions/auth-reset-password';
import changePassword from '../../netlify/functions/auth-change-password';
import { createSession, sha256, verifyPassword } from '../../netlify/functions/_lib/auth';

const userId = '00000000-0000-4000-8000-000000000001';
const currentPassword = 'Correct current password';
const nextPassword = 'Replacement secure password';
const recoveryToken = 'recovery-link';
const existingSession = 'existing-browser-session';

function context(token?: string) {
  return { cookies: { get: () => token, set: vi.fn() } } as any;
}
function request(path: string, body: object, userAgent = 'test-browser') {
  return new Request(`https://nxt5.test/${path}`, {
    method: 'POST', headers: { 'User-Agent': userAgent }, body: JSON.stringify(body)
  });
}
function signIn(cookieContext = context(), password = currentPassword, identifier = 'test-account', rememberMe = true) {
  return login(request('auth-login', { accountName: identifier, password, rememberMe }), cookieContext);
}
function reset() {
  return resetPassword(request('auth-reset-password', { token: recoveryToken, nextPassword }));
}
function change() {
  return changePassword(request('auth-change-password', { currentPassword, nextPassword }), context(existingSession));
}
async function account() {
  return (await state.pg.query('select password_hash, xmin::text as version from users where id = $1', [userId])).rows[0];
}
async function sessions() {
  return (await state.pg.query('select token_hash, revoked_at from sessions where user_id = $1 order by token_hash', [userId])).rows;
}

beforeAll(async () => {
  state.pg = new PGlite();
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')");
  await state.pg.exec(schema);
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
}, 20_000);
beforeEach(async () => {
  vi.stubEnv('SESSION_SECRET', 's'.repeat(64));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.beforeQuery = null;
  await state.pg.exec('alter table sessions drop constraint if exists simulated_session_failure; truncate users cascade; truncate audit_logs');
  await state.pg.query(`insert into users(id, account_name, name, email, password_hash, last_active_at)
    values ($1, 'test-account', 'Test account', 'test@example.test', $2, now())`,
  [userId, bcrypt.hashSync(currentPassword, 4)]);
  await state.pg.query("insert into password_reset_tokens(user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 minutes')", [userId, sha256(recoveryToken)]);
  await state.pg.query("insert into sessions(user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')", [userId, sha256(existingSession)]);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await state.pg?.close(); });

describe('session issuance serializes with credential changes', () => {
  it.each([
    { identifier: 'test-account', remember: true, maxAge: 30 * 24 * 60 * 60 },
    { identifier: 'test@example.test', remember: false, maxAge: 12 * 60 * 60 }
  ])('keeps $identifier login and its cookie lifetime working', async ({ identifier, remember, maxAge }) => {
    const cookieContext = context();
    const before = await account();
    const response = await signIn(cookieContext, currentPassword, identifier, remember);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toMatchObject({ id: userId, account_name: 'test-account' });
    expect(body.user).not.toHaveProperty('password_hash');
    expect(cookieContext.cookies.set).toHaveBeenCalledTimes(1);
    const cookie = cookieContext.cookies.set.mock.calls[0][0];
    expect(cookie).toMatchObject({ name: 'rb_session', httpOnly: true, secure: true, sameSite: 'Lax', maxAge });
    expect(await sessions()).toContainEqual({ token_hash: sha256(cookie.value), revoked_at: null });
    expect((await account()).version).not.toBe(before.version);
    expect((await account()).password_hash).toBe(before.password_hash);
  });

  it('does not issue a cookie or session for an incorrect password', async () => {
    const cookieContext = context();
    const before = await account();
    expect((await signIn(cookieContext, 'wrong-password')).status).toBe(401);
    expect(cookieContext.cookies.set).not.toHaveBeenCalled();
    expect(await sessions()).toHaveLength(1);
    expect(await account()).toEqual(before);
  });

  it.each([
    { kind: 'password reset', run: reset },
    { kind: 'password change', run: change }
  ])('rejects a verified old password when a $kind commits before session insertion', async ({ run }) => {
    const cookieContext = context();
    state.beforeQuery = async query => {
      if (!/with\s+authenticated_account/i.test(query)) return;
      state.beforeQuery = null;
      expect((await run()).status).toBe(200);
    };
    const response = await signIn(cookieContext);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Identifiants incorrects.' });
    expect(cookieContext.cookies.set).not.toHaveBeenCalled();
    expect(await sessions()).toHaveLength(1);
    expect(await verifyPassword(nextPassword, (await account()).password_hash)).toBe(true);
  });

  it.each([
    { action: 'auth.password_reset_complete', run: reset, rejectedStatus: 400 },
    { action: 'auth.password_change', run: change, rejectedStatus: 409 }
  ])('makes pending $action retry after a login commits, then revokes that session on retry', async ({ action, run, rejectedStatus }) => {
    const cookieContext = context();
    state.beforeQuery = async query => {
      if (!query.includes(`'${action}'`)) return;
      state.beforeQuery = null;
      expect((await signIn(cookieContext)).status).toBe(200);
    };
    expect((await run()).status).toBe(rejectedStatus);
    expect(await verifyPassword(currentPassword, (await account()).password_hash)).toBe(true);
    const issuedHash = sha256(cookieContext.cookies.set.mock.calls[0][0].value);
    expect(await sessions()).toContainEqual({ token_hash: issuedHash, revoked_at: null });
    expect((await run()).status).toBe(200);
    expect((await sessions()).find((session: any) => session.token_hash === issuedHash).revoked_at).not.toBeNull();
    expect(await verifyPassword(nextPassword, (await account()).password_hash)).toBe(true);
  });

  it('rolls back the account version update when session insertion fails', async () => {
    await state.pg.exec("alter table sessions add constraint simulated_session_failure check (user_agent <> 'reject-insert')");
    const before = await account();
    const cookieContext = context();
    const response = await login(request('auth-login', { accountName: 'test-account', password: currentPassword }, 'reject-insert'), cookieContext);
    expect(response.status).toBe(500);
    expect(cookieContext.cookies.set).not.toHaveBeenCalled();
    expect(await account()).toEqual(before);
    expect(await sessions()).toHaveLength(1);
  });

  it('keeps simultaneous valid logins compatible', async () => {
    const contexts = [context(), context()];
    expect((await Promise.all(contexts.map(cookieContext => signIn(cookieContext)))).map(response => response.status)).toEqual([200, 200]);
    expect(await sessions()).toHaveLength(3);
    expect(new Set(contexts.map(cookieContext => cookieContext.cookies.set.mock.calls[0][0].value)).size).toBe(2);
  });

  it('preserves the registration session call without an expected credential', async () => {
    const cookieContext = context();
    await createSession({ userId, context: cookieContext, request: request('auth-register', {}) });
    expect(cookieContext.cookies.set).toHaveBeenCalledTimes(1);
    expect(await sessions()).toHaveLength(2);
  });
});
