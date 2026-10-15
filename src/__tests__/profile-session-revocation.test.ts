import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any,
  beforeQuery: null as null | ((query: string) => Promise<void>),
  emails: vi.fn(async (_message: any) => {})
}));

// Keep the real session guard, password check and credential SQL. Substitute
// only PostgreSQL transport, migration readiness, budgets and email delivery.
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
        })), rowCount: result.affectedRows ?? result.rows.length
      }));
    } catch (failure: any) {
      return new Response(JSON.stringify({ message: failure.message, code: failure.code }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: async () => {}, assertVerificationEmailRateLimit: async () => {} }));
vi.mock('../../netlify/functions/_lib/team-member-emails', () => ({ ensureUserNotificationColumns: async () => {} }));
vi.mock('../../netlify/functions/_lib/email', () => ({ sendEmailVerificationEmail: state.emails }));

import updateProfile from '../../netlify/functions/auth-update-profile';
import { sha256 } from '../../netlify/functions/_lib/auth';

const userId = '00000000-0000-4000-8000-000000000001';
const password = 'Current account password';
const session = 'email-change-browser-session';
const sessionHash = sha256(session);
const context = { cookies: { get: () => session, set: vi.fn() } } as any;

function profile() {
  return updateProfile(new Request('https://nxt5.test/auth-update-profile', {
    method: 'POST', headers: { Origin: 'https://nxt5.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated account', email: 'next@example.test', currentPassword: password })
  }), context);
}
async function credentials() {
  return {
    account: (await state.pg.query('select *, xmin::text as version from users where id = $1', [userId])).rows[0],
    recovery: (await state.pg.query('select token_hash, used_at from password_reset_tokens where user_id = $1', [userId])).rows,
    audit: (await state.pg.query('select action from audit_logs where user_id = $1', [userId])).rows
  };
}

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
}, 20_000);
beforeEach(async () => {
  vi.stubEnv('SESSION_SECRET', 'test-secret-'.repeat(8));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.beforeQuery = null;
  state.emails.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('truncate users cascade; truncate audit_logs');
  await state.pg.query(`insert into users(id, account_name, name, email, password_hash, email_verified, last_active_at)
    values ($1, 'test-account', 'Original account', 'original@example.test', $2, true, now())`, [userId, bcrypt.hashSync(password, 4)]);
  await state.pg.query(`insert into sessions(user_id, token_hash, expires_at, last_seen_at)
    values ($1, $2, now() + interval '1 day', now())`, [userId, sessionHash]);
  await state.pg.query(`insert into password_reset_tokens(user_id, token_hash, expires_at)
    values ($1, 'existing-recovery-hash', now() + interval '30 minutes')`, [userId]);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await state.pg?.close(); });

describe('email changes recheck the browser session at commit', () => {
  it('keeps an authorized email change and private response working', async () => {
    const response = await profile();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ user: { email: 'next@example.test', email_verified: false } });
    const saved = await credentials();
    expect(saved.recovery.every((token: any) => token.used_at)).toBe(true);
    expect(saved.audit).toEqual([{ action: 'auth.profile_update' }]);
    expect(state.emails).toHaveBeenCalledTimes(1);
  });

  it.each(['revoked', 'expired', 'deleted'])('does not change credentials or send mail if the session is %s after authentication', async kind => {
    const before = await credentials();
    state.beforeQuery = async query => {
      if (!query.includes("'auth.profile_update'")) return;
      state.beforeQuery = null;
      if (kind === 'deleted') await state.pg.query('delete from sessions where token_hash = $1', [sessionHash]);
      else await state.pg.query(`update sessions set ${kind === 'revoked' ? 'revoked_at = now()' : "expires_at = now() - interval '1 second'"} where token_hash = $1`, [sessionHash]);
    };
    const response = await profile();
    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(await credentials()).toEqual(before);
    expect(state.emails).not.toHaveBeenCalled();
  });
});
