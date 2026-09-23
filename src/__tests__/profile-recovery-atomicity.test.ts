import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any,
  beforeQuery: null as null | ((query: string) => Promise<void>),
  verificationEmails: vi.fn(async (_message: any) => {}),
  recoveryEmails: vi.fn(async (_message: any) => {})
}));

// Production parameterized SQL runs in PostgreSQL; identity, delivery and
// budgets are substituted so each test isolates the credential transaction.
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
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/auth', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    assertSessionSecret: () => {},
    ensureEmailVerificationColumns: async () => {},
    requireAuth: async () => ({ id: '00000000-0000-4000-8000-000000000001' })
  };
});
vi.mock('../../netlify/functions/_getTeamMembers.js', () => ({ ensureUserNotificationColumns: async () => {} }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({
  assertRateLimit: async () => {},
  assertSubjectRateLimit: async () => {},
  assertVerificationEmailRateLimit: async () => {}
}));
vi.mock('../../netlify/functions/_lib/email', () => ({
  isPasswordEmailConfigured: () => true,
  sendEmailVerificationEmail: state.verificationEmails,
  sendPasswordResetEmail: state.recoveryEmails
}));

import updateProfile from '../../netlify/functions/auth-update-profile';
import resetPassword from '../../netlify/functions/auth-reset-password';
import requestReset from '../../netlify/functions/auth-request-password-reset';
import { sha256 } from '../../netlify/functions/_lib/auth';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const currentPassword = 'Correct current password';
const oldToken = 'link-delivered-to-old-email';
const otherToken = 'second-link-delivered-to-old-email';
const context = {} as any;
function request(path: string, body: object) {
  return new Request(`https://nxt5.test/${path}`, { method: 'POST', body: JSON.stringify(body) });
}
function profile(email = 'next@example.test') {
  return updateProfile(request('profile', { email, name: 'Updated account', currentPassword }), context);
}
function reset(token = oldToken) {
  return resetPassword(request('reset', { token, nextPassword: 'A new secure password' }));
}
function issue(email = 'original@example.test') {
  return requestReset(request('request-reset', { email }));
}
async function accountState() {
  return {
    account: (await state.pg.query('select *, xmin::text as account_version from users where id = $1', [userId])).rows[0],
    tokens: (await state.pg.query('select token_hash, used_at from password_reset_tokens where user_id = $1 order by token_hash', [userId])).rows,
    audit: (await state.pg.query('select action from audit_logs where user_id = $1 order by action', [userId])).rows
  };
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
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.beforeQuery = null;
  state.verificationEmails.mockReset().mockResolvedValue(undefined);
  state.recoveryEmails.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('alter table audit_logs drop constraint if exists simulated_audit_failure; truncate users cascade; truncate audit_logs');
  for (const [id, email] of [[userId, 'original@example.test'], [otherUserId, 'other@example.test']]) {
    await state.pg.query("insert into users(id, account_name, name, email, password_hash, email_verified) values ($1, $2, 'Original account', $3, $4, true)", [id, id, email, bcrypt.hashSync(currentPassword, 4)]);
  }
  for (const [id, token] of [[userId, oldToken], [userId, otherToken], [otherUserId, 'unrelated-token']]) {
    await state.pg.query("insert into password_reset_tokens(user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 minutes')", [id, sha256(token)]);
  }
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await state.pg?.close(); });

describe('email changes invalidate recovery to the old address', () => {
  it('consumes all prior recovery links atomically and preserves other accounts', async () => {
    expect((await profile()).status).toBe(200);
    const saved = await accountState();
    expect(saved.account).toMatchObject({ email: 'next@example.test', email_verified: false });
    expect(saved.tokens.every((token: any) => token.used_at)).toBe(true);
    expect(saved.audit).toEqual([{ action: 'auth.profile_update' }]);
    expect(state.verificationEmails).toHaveBeenCalledTimes(1);
    expect((await reset()).status).toBe(400);
    expect((await reset(otherToken)).status).toBe(400);
    expect((await state.pg.query('select used_at from password_reset_tokens where user_id = $1', [otherUserId])).rows).toEqual([{ used_at: null }]);
  });

  it('preserves recovery links when only the display name changes', async () => {
    const before = await accountState();
    expect((await profile('ORIGINAL@example.test')).status).toBe(200);
    expect((await accountState()).tokens).toEqual(before.tokens);
    expect(state.verificationEmails).not.toHaveBeenCalled();
    expect((await reset()).status).toBe(200);
  });

  it('rolls back the email, verification token and recovery invalidation if audit writing fails', async () => {
    const before = await accountState();
    await state.pg.exec("alter table audit_logs add constraint simulated_audit_failure check (action <> 'auth.profile_update')");
    const response = await profile();
    expect(response.status).toBe(500);
    expect(await accountState()).toEqual(before);
    expect(state.verificationEmails).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(before.account.password_hash);
  });

  it('rejects a pending redemption after the email change commits', async () => {
    state.beforeQuery = async query => {
      if (!query.includes("'auth.password_reset_complete'")) return;
      state.beforeQuery = null;
      expect((await profile()).status).toBe(200);
    };
    expect((await reset()).status).toBe(400);
    expect((await accountState()).account.email).toBe('next@example.test');
  });

  it('rejects a pending email change when recovery issuance advances the account version', async () => {
    state.beforeQuery = async query => {
      if (!query.includes("'auth.profile_update'")) return;
      state.beforeQuery = null;
      expect((await issue()).status).toBe(200);
    };
    const response = await profile();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect((await accountState()).account.email).toBe('original@example.test');
    expect(state.verificationEmails).not.toHaveBeenCalled();
    expect(state.recoveryEmails).toHaveBeenCalledTimes(1);
  });

  it('does not issue a pending recovery link to the old address after the email changes', async () => {
    state.beforeQuery = async query => {
      if (!query.includes("'auth.password_reset_request'")) return;
      state.beforeQuery = null;
      expect((await profile()).status).toBe(200);
    };
    const response = await issue();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.recoveryEmails).not.toHaveBeenCalled();
    expect((await accountState()).tokens.every((token: any) => token.used_at)).toBe(true);
  });

  it('allows new recovery only through the current email address after the change', async () => {
    expect((await profile()).status).toBe(200);
    expect((await issue()).status).toBe(200);
    expect(state.recoveryEmails).not.toHaveBeenCalled();
    expect((await issue('next@example.test')).status).toBe(200);
    expect(state.recoveryEmails).toHaveBeenCalledTimes(1);
    const sent = state.recoveryEmails.mock.calls[0][0];
    expect(sent.to).toBe('next@example.test');
    const token = new URL(sent.resetUrl).searchParams.get('token')!;
    expect((await reset(token)).status).toBe(200);
  });
});
