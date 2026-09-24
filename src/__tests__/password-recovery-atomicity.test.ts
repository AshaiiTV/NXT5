import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any,
  beforeQuery: null as null | ((query: string) => Promise<void>),
  emails: vi.fn(async (_message: any) => {})
}));

// Run production SQL through the Neon transport against PostgreSQL/PGlite.
// Only authenticated identity, rate budgets and email delivery are substituted.
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
vi.mock('../../netlify/functions/_lib/auth', async importOriginal => {
  const actual: any = await importOriginal();
  return { ...actual, assertSessionSecret: () => {}, requireAuth: async () => ({ id: '00000000-0000-4000-8000-000000000001' }) };
});
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: async () => {} }));
vi.mock('../../netlify/functions/_lib/email', () => ({ isPasswordEmailConfigured: () => true, sendPasswordResetEmail: state.emails }));

import changePassword from '../../netlify/functions/auth-change-password';
import resetPassword from '../../netlify/functions/auth-reset-password';
import requestReset from '../../netlify/functions/auth-request-password-reset';
import { sha256, verifyPassword } from '../../netlify/functions/_lib/auth';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const currentPassword = 'Correct current password';
const nextPassword = 'New secure password';
const firstToken = 'first-recovery-link';
const secondToken = 'second-recovery-link';
const currentSession = 'current-browser-session';
const context = { cookies: { get: () => currentSession } } as any;

function request(path: string, body: object) {
  return new Request(`https://nxt5.test/${path}`, { method: 'POST', body: JSON.stringify(body) });
}
function reset(token = firstToken, password = nextPassword) {
  return resetPassword(request('auth-reset-password', { token, nextPassword: password }));
}
function change(password = nextPassword) {
  return changePassword(request('auth-change-password', { currentPassword, nextPassword: password }), context);
}
function issue(email = 'original@example.test') {
  return requestReset(request('auth-request-password-reset', { email }));
}
async function accountState() {
  return {
    account: (await state.pg.query('select password_hash, xmin::text as version from users where id = $1', [userId])).rows[0],
    tokens: (await state.pg.query('select token_hash, used_at from password_reset_tokens where user_id = $1 order by token_hash', [userId])).rows,
    sessions: (await state.pg.query('select token_hash, revoked_at from sessions where user_id = $1 order by token_hash', [userId])).rows,
    audit: (await state.pg.query('select action from audit_logs where user_id = $1 order by action', [userId])).rows
  };
}

// Both requests finish reading the same account version before either write.
function synchronizeChanges() {
  let arrived = 0;
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  state.beforeQuery = async query => {
    if (!/with\s+changed_account/i.test(query)) return;
    if (++arrived === 2) release();
    await ready;
  };
}

beforeAll(async () => {
  state.pg = new PGlite();
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')");
  await state.pg.exec(schema);
}, 20_000);
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.beforeQuery = null;
  state.emails.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('alter table audit_logs drop constraint if exists simulated_audit_failure; truncate users cascade; truncate audit_logs');
  for (const [id, email] of [[userId, 'original@example.test'], [otherUserId, 'other@example.test']]) {
    await state.pg.query("insert into users(id, account_name, name, email, password_hash) values ($1, $2, 'Test account', $3, $4)", [id, id, email, bcrypt.hashSync(currentPassword, 4)]);
  }
  for (const [id, token] of [[userId, firstToken], [userId, secondToken], [otherUserId, 'another-account-token']]) {
    await state.pg.query("insert into password_reset_tokens(user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 minutes')", [id, sha256(token)]);
  }
  for (const [id, token] of [[userId, currentSession], [userId, 'other-browser-session'], [otherUserId, 'another-account-session']]) {
    await state.pg.query("insert into sessions(user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')", [id, sha256(token)]);
  }
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await state.pg?.close(); });

describe('atomic password changes and recovery', () => {
  it('redeems a link once and invalidates all recovery links and sessions for that account', async () => {
    expect((await reset()).status).toBe(200);
    const saved = await accountState();
    expect(await verifyPassword(nextPassword, saved.account.password_hash)).toBe(true);
    expect(saved.tokens.every((token: any) => token.used_at)).toBe(true);
    expect(saved.sessions.every((session: any) => session.revoked_at)).toBe(true);
    expect(saved.audit).toEqual([{ action: 'auth.password_reset_complete' }]);
    expect((await reset()).status).toBe(400);
    expect((await reset(secondToken)).status).toBe(400);
    expect((await state.pg.query('select used_at from password_reset_tokens where user_id = $1', [otherUserId])).rows).toEqual([{ used_at: null }]);
    expect((await state.pg.query('select revoked_at from sessions where user_id = $1', [otherUserId])).rows).toEqual([{ revoked_at: null }]);
  });

  it('invalidates recovery links and other sessions when changing a password, preserving the current session', async () => {
    expect((await change()).status).toBe(200);
    const saved = await accountState();
    expect(await verifyPassword(nextPassword, saved.account.password_hash)).toBe(true);
    expect(saved.tokens.every((token: any) => token.used_at)).toBe(true);
    expect(saved.sessions.filter((session: any) => !session.revoked_at)).toEqual([{ token_hash: sha256(currentSession), revoked_at: null }]);
    expect(saved.audit).toEqual([{ action: 'auth.password_change' }]);
    expect((await reset(firstToken)).status).toBe(400);
  });

  it.each([firstToken, secondToken])('accepts only one concurrent redemption, including competing token %s', async token => {
    synchronizeChanges();
    const responses = await Promise.all([reset(), reset(token, 'Competing new password')]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    const saved = await accountState();
    expect(saved.audit).toEqual([{ action: 'auth.password_reset_complete' }]);
    const winningPassword = responses[0].status === 200 ? nextPassword : 'Competing new password';
    expect(await verifyPassword(winningPassword, saved.account.password_hash)).toBe(true);
    expect(saved.tokens.every((entry: any) => entry.used_at)).toBe(true);
  });

  it('rejects stale reauthentication after a reset commits', async () => {
    state.beforeQuery = async query => {
      if (!query.includes("'auth.password_change'")) return;
      state.beforeQuery = null;
      expect((await reset(firstToken, 'Password from reset')).status).toBe(200);
    };
    const response = await change();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(await verifyPassword('Password from reset', (await accountState()).account.password_hash)).toBe(true);
  });

  it('rejects a pending reset after an authenticated password change commits', async () => {
    state.beforeQuery = async query => {
      if (!query.includes("'auth.password_reset_complete'")) return;
      state.beforeQuery = null;
      expect((await change('Password from settings')).status).toBe(200);
    };
    expect((await reset()).status).toBe(400);
    expect(await verifyPassword('Password from settings', (await accountState()).account.password_hash)).toBe(true);
  });

  it('rejects stale account versions even when the password hash has not changed', async () => {
    const before = await accountState();
    state.beforeQuery = async query => {
      if (!query.includes("'auth.password_change'")) return;
      state.beforeQuery = null;
      await state.pg.query("update users set name = 'Concurrent profile edit' where id = $1", [userId]);
    };
    expect((await change()).status).toBe(409);
    const saved = await accountState();
    expect(saved.account.password_hash).toBe(before.account.password_hash);
    expect(saved.account.version).not.toBe(before.account.version);
    expect(saved.tokens).toEqual(before.tokens);
    expect(saved.sessions).toEqual(before.sessions);
    expect(saved.audit).toEqual([]);
  });

  it.each([
    { action: 'auth.password_reset_complete', run: reset },
    { action: 'auth.password_change', run: change },
    { action: 'auth.password_reset_request', run: issue }
  ])('rolls back every credential/revocation change if the $action audit insert fails', async ({ action, run }) => {
    const before = await accountState();
    await state.pg.exec(`alter table audit_logs add constraint simulated_audit_failure check (action <> '${action}')`);
    expect((await run()).status).toBe(500);
    expect(await accountState()).toEqual(before);
    expect(state.emails).not.toHaveBeenCalled();
  });

  it('issues a hashed recovery link while invalidating prior links and advancing the account version', async () => {
    const before = await accountState();
    expect((await issue()).status).toBe(200);
    const token = new URL(state.emails.mock.calls[0][0].resetUrl).searchParams.get('token')!;
    const saved = await accountState();
    expect(saved.account.version).not.toBe(before.account.version);
    expect(saved.account.password_hash).toBe(before.account.password_hash);
    expect(saved.sessions).toEqual(before.sessions);
    expect(saved.tokens.filter((entry: any) => !entry.used_at)).toEqual([{ token_hash: sha256(token), used_at: null }]);
    expect(saved.audit).toEqual([{ action: 'auth.password_reset_request' }]);
    expect((await reset(token)).status).toBe(200);
  });

  it('does not issue a link from a stale account snapshot after a password reset', async () => {
    state.beforeQuery = async query => {
      if (!query.includes("'auth.password_reset_request'")) return;
      state.beforeQuery = null;
      expect((await reset()).status).toBe(200);
    };
    const response = await issue();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.emails).not.toHaveBeenCalled();
    expect((await accountState()).tokens.every((token: any) => token.used_at)).toBe(true);
  });

  it('rejects a pending redemption when a newer recovery link is issued', async () => {
    state.beforeQuery = async query => {
      if (!query.includes("'auth.password_reset_complete'")) return;
      state.beforeQuery = null;
      expect((await issue()).status).toBe(200);
    };
    expect((await reset()).status).toBe(400);
    const token = new URL(state.emails.mock.calls[0][0].resetUrl).searchParams.get('token')!;
    expect((await reset(token)).status).toBe(200);
  });

  it('issues only one usable link for requests concurrently using the same account version', async () => {
    synchronizeChanges();
    const responses = await Promise.all([issue(), issue()]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(state.emails).toHaveBeenCalledTimes(1);
    expect((await accountState()).tokens.filter((entry: any) => !entry.used_at)).toHaveLength(1);
  });

  it('keeps the same public response for known and unknown recipient addresses', async () => {
    const known = await issue();
    const unknown = await issue('unknown@example.test');
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(await known.json()).toEqual({ ok: true });
    expect(await unknown.json()).toEqual({ ok: true });
    expect(state.emails).toHaveBeenCalledTimes(1);
  });

  it('keeps delivery failures indistinguishable from unknown recipients and logs no provider details', async () => {
    state.emails.mockRejectedValueOnce(Object.assign(new Error('private recipient and provider token'), {
      status: 502, details: { authorization: 'Bearer private-secret' }
    }));
    const known = await issue();
    const unknown = await issue('unknown@example.test');
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(await known.json()).toEqual({ ok: true });
    expect(await unknown.json()).toEqual({ ok: true });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('[password-reset] Email delivery failed.', { code: 'PASSWORD_RESET_EMAIL_FAILED' });
  });
});
