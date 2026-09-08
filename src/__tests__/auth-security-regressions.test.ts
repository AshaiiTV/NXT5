import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any,
  userId: '00000000-0000-4000-8000-000000000001',
  statements: [] as string[],
  beforeQuery: null as null | ((query: string) => Promise<void>),
  emails: vi.fn(async (_message: any) => {})
}));

// Execute the handlers' actual parameterized queries in PostgreSQL. Sessions
// and outbound email are the only product behaviors replaced for these tests.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const statement = JSON.parse(options.body);
    try {
      await state.beforeQuery?.(statement.query);
      state.statements.push(statement.query);
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
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {}, ensureMigration: async () => {} }));
vi.mock('../../netlify/functions/_lib/auth', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    assertSessionSecret: () => {},
    ensureEmailVerificationColumns: async () => {},
    requireAuth: async () => (await state.pg.query('select * from users where id = $1', [state.userId])).rows[0]
  };
});
vi.mock('../../netlify/functions/_getTeamMembers.js', () => ({ ensureUserNotificationColumns: async () => {} }));
vi.mock('../../netlify/functions/_lib/email', () => ({ sendEmailVerificationEmail: state.emails }));

import verifyEmail from '../../netlify/functions/verify-email';
import updateProfile from '../../netlify/functions/auth-update-profile';
import changePassword from '../../netlify/functions/auth-change-password';
import resetPassword from '../../netlify/functions/auth-reset-password';
import registerAccount from '../../netlify/functions/auth-register';
import resendVerification from '../../netlify/functions/resend-verify-email';
import { sha256 } from '../../netlify/functions/_lib/auth';
import { assertVerificationEmailRateLimit } from '../../netlify/functions/_lib/rate-limit';
import bootstrap from '../../netlify/functions/bootstrap';
import createTeam from '../../netlify/functions/teams-create';
import joinTeam from '../../netlify/functions/teams-join';
import updateTeam from '../../netlify/functions/teams-update';
import { safeTeam } from '../../netlify/functions/_lib/teams';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const password = 'Correct current password';
const originalToken = 'old-address-verification-token';
const nextToken = 'new-address-verification-token';
const context = { cookies: { set: vi.fn() } } as any;

function profile(email = 'next@example.test', currentPassword: string | undefined = password) {
  return updateProfile(new Request('https://nxt5.test/profile', {
    method: 'POST', body: JSON.stringify({ name: 'Test account', email, currentPassword })
  }), context);
}
function verify(token = originalToken) {
  return verifyEmail(new Request(`https://nxt5.test/verify-email?token=${token}`));
}
function resend() {
  return resendVerification(new Request('https://nxt5.test/resend', { method: 'POST' }), context);
}
function register(email: string) {
  return registerAccount(new Request('https://nxt5.test/register', {
    method: 'POST', body: JSON.stringify({ email, displayName: 'New account', password, acceptLegal: true, legalVersion: '2026-09-05' })
  }), context);
}
async function user() {
  return (await state.pg.query('select * from users where id = $1', [userId])).rows[0];
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
  state.beforeQuery = null;
  state.userId = userId;
  state.emails.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('truncate users cascade; truncate rate_limits');
  for (const [id, email] of [[userId, 'original@example.test'], [otherUserId, 'other@example.test']]) {
    await state.pg.query(`insert into users(id, account_name, name, email, password_hash, email_verified, email_verify_token, email_verify_expires_at)
      values ($1, $2, 'Test account', $3, $4, false, $5, now() + interval '23 hours')`,
    [id, id, email, bcrypt.hashSync(password, 4), id === userId ? sha256(originalToken) : null]);
  }
  state.statements = [];
});
afterAll(async () => { await state.pg?.close(); });

describe('authentication request size limits', () => {
  it.each([
    { route: 'auth-change-password', handler: changePassword, limit: 4096 },
    { route: 'auth-reset-password', handler: resetPassword, limit: 4096 },
    { route: 'auth-update-profile', handler: updateProfile, limit: 8192 }
  ])('$route rejects a body above its limit without relying on Content-Length', async ({ route, handler, limit }) => {
    const emptyBody = JSON.stringify({ padding: '' });
    const body = JSON.stringify({ padding: 'x'.repeat(limit + 1 - Buffer.byteLength(emptyBody)) });
    const request = new Request(`https://nxt5.test/${route}`, { method: 'POST', body });
    expect(request.headers.has('content-length')).toBe(false);

    const response = await handler(request, context);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'REQUEST_TOO_LARGE' });
  });
});

describe('email verification belongs to the current address', () => {
  it('consumes a current unexpired token exactly once', async () => {
    const responses = await Promise.all([verify(), verify()]);
    const locations = responses.map(response => response.headers.get('location'));
    expect(locations.filter(location => location?.includes('success=true'))).toHaveLength(1);
    expect(locations.filter(location => location?.includes('error=invalid'))).toHaveLength(1);
    expect(await user()).toMatchObject({ email_verified: true, email_verify_token: null, email_verify_expires_at: null });
    expect(state.statements.every(query => /update\s+users/i.test(query))).toBe(true);
  });

  it.each(['expired', 'missing'])('rejects a token with %s expiration', async (kind) => {
    await state.pg.query(`update users set email_verify_expires_at = ${kind === 'missing' ? 'null' : "now() - interval '1 second'"} where id = $1`, [userId]);
    expect((await verify()).headers.get('location')).toContain('error=invalid');
    expect((await user()).email_verified).toBe(false);
  });

  it('cannot confirm the new address when it changes just before the verification write', async () => {
    state.beforeQuery = async query => {
      if (!/set\s+email_verified = true/i.test(query)) return;
      state.beforeQuery = null;
      expect((await profile()).status).toBe(200);
    };
    expect((await verify()).headers.get('location')).toContain('error=invalid');
    const current = await user();
    expect(current).toMatchObject({ email: 'next@example.test', email_verified: false });
    expect(current.email_verify_token).not.toBe(sha256(originalToken));
    expect(state.emails).toHaveBeenCalledTimes(1);
  });

  it('does not put a token for an old address onto a concurrently changed address during resend', async () => {
    state.beforeQuery = async query => {
      if (!/set\s+email_verified = false/i.test(query)) return;
      state.beforeQuery = null;
      await state.pg.query('update users set email = $1, email_verify_token = $2 where id = $3', ['changed@example.test', sha256(nextToken), userId]);
    };
    expect((await resend()).status).toBe(409);
    expect(await user()).toMatchObject({ email: 'changed@example.test', email_verify_token: sha256(nextToken), email_verified: false });
    expect(state.emails).not.toHaveBeenCalled();
  });

  it('never clears a newer token when delivery of an older token fails', async () => {
    state.emails.mockImplementationOnce(async () => {
      await state.pg.query('update users set email_verify_token = $1 where id = $2', [sha256(nextToken), userId]);
      throw new Error('Simulated delivery failure');
    });
    expect((await resend()).status).toBe(500);
    expect((await user()).email_verify_token).toBe(sha256(nextToken));
  });
});

describe('email changes require the current password', () => {
  it.each([undefined, 'wrong password'])('rejects missing or incorrect reauthentication without changing the account', async value => {
    const before = await user();
    const request = new Request('https://nxt5.test/profile', {
      method: 'POST', body: JSON.stringify({ name: 'Changed name', email: 'next@example.test', currentPassword: value })
    });
    const response = await updateProfile(request, context);
    expect(response.status).toBe(401);
    expect(await user()).toEqual(before);
    expect(state.emails).not.toHaveBeenCalled();
  });

  it('updates a display name without requiring a password when normalized email is unchanged', async () => {
    const response = await updateProfile(new Request('https://nxt5.test/profile', {
      method: 'POST', body: JSON.stringify({ name: 'Changed display name', email: 'ORIGINAL@example.test' })
    }), context);
    expect(response.status).toBe(200);
    expect(state.emails).not.toHaveBeenCalled();
    expect(await user()).toMatchObject({ email: 'original@example.test', email_verify_token: sha256(originalToken) });
  });

  it('changes the address and rotates verification after successful reauthentication', async () => {
    const response = await profile();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.user).toMatchObject({ email: 'next@example.test', email_verified: false });
    expect(JSON.stringify(payload)).not.toContain(password);
    expect(payload.user).not.toHaveProperty('password_hash');
    expect(payload.user).not.toHaveProperty('email_verify_token');
    expect(state.emails).toHaveBeenCalledTimes(1);
    expect((await user()).email_verify_token).toBe(sha256(state.emails.mock.calls[0][0].token));
  });

  it('rejects a password reset that occurs after reauthentication but before the address write', async () => {
    state.beforeQuery = async query => {
      if (!/set\s+name =/i.test(query)) return;
      state.beforeQuery = null;
      await state.pg.query('update users set password_hash = $1 where id = $2', [bcrypt.hashSync('New password', 4), userId]);
    };
    expect((await profile()).status).toBe(409);
    expect((await user()).email).toBe('original@example.test');
    expect(state.emails).not.toHaveBeenCalled();
  });
});

const teamId = '00000000-0000-4000-8000-000000000003';
const inviteCode = 'NXT5-ABC123';

async function seedTeam(role?: string) {
  await state.pg.query('insert into teams(id, owner_id, name, tag, invite_code, invite_expires_at) values ($1, $2, $3, $4, $5, now() + interval \'1 hour\')', [teamId, otherUserId, 'Private team', 'PVT', inviteCode]);
  await state.pg.query('insert into team_invite_codes(team_id, created_by, code, expires_at) values ($1, $2, $3, now() + interval \'1 hour\')', [teamId, otherUserId, inviteCode]);
  if (role) await state.pg.query('insert into team_members(team_id, user_id, role) values ($1, $2, $3)', [teamId, userId, role]);
}
function expectPublicTeam(team: any) {
  expect(team).toHaveProperty('id');
  expect(team).toHaveProperty('owner_id');
  expect(team).not.toHaveProperty('invite_code');
  expect(team).not.toHaveProperty('invite_expires_at');
  expect(JSON.stringify(team)).not.toContain(inviteCode);
}

describe('team responses do not disclose invitation credentials', () => {
  it('uses a whitelist for ordinary team fields', () => {
    const team = safeTeam({ id: teamId, name: 'Team', invite_code: inviteCode, invite_expires_at: 'future', future_secret: 'private' });
    expectPublicTeam(team);
    expect(team).not.toHaveProperty('future_secret');
  });

  it.each(['member', 'viewer', 'player', 'coach', 'assistant', 'analyst', 'board', 'captain', 'manager', 'owner'])('keeps invitation listing role-gated for %s', async role => {
    await seedTeam(role === 'owner' ? undefined : role);
    if (role === 'owner') state.userId = otherUserId;
    const response = await bootstrap(new Request(`https://nxt5.test/bootstrap?teamId=${teamId}`), context);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.teams).toHaveLength(1);
    expectPublicTeam(payload.teams[0]);
    expect(payload.inviteCodes).toHaveLength(['captain', 'manager', 'owner'].includes(role) ? 1 : 0);
    if (!['captain', 'manager', 'owner'].includes(role)) expect(JSON.stringify(payload)).not.toContain(inviteCode);
  });

  it('does not disclose the current invitation on the join response', async () => {
    await seedTeam();
    const response = await joinTeam(new Request('https://nxt5.test/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }), context);
    expect(response.status).toBe(200);
    expectPublicTeam((await response.json()).team);
    expect((await state.pg.query('select role from team_members where team_id = $1 and user_id = $2', [teamId, userId])).rows[0].role).toBe('member');
  });

  it('uses the same public projection on team creation and update', async () => {
    const created = await createTeam(new Request('https://nxt5.test/create', { method: 'POST', body: JSON.stringify({ name: 'New team', tag: 'NEW' }) }), context);
    expect(created.status).toBe(200);
    expectPublicTeam((await created.json()).team);
    await seedTeam('manager');
    const updated = await updateTeam(new Request('https://nxt5.test/update', { method: 'POST', body: JSON.stringify({ teamId, name: 'Updated team', tag: 'UPD' }) }), context);
    expect(updated.status).toBe(200);
    expectPublicTeam((await updated.json()).team);
  });
});

describe('shared verification email budgets', () => {
  it('checks a blocked registration recipient before creating the account', async () => {
    await assertVerificationEmailRateLimit(userId, 'reserved@example.test');
    const response = await register('reserved@example.test');
    expect(response.status).toBe(429);
    expect((await state.pg.query('select id from users where email = $1', ['reserved@example.test'])).rows).toHaveLength(0);
    expect(state.emails).not.toHaveBeenCalled();
  });

  it('does not let duplicate registration consume an existing user verification budget', async () => {
    expect((await register('original@example.test')).status).toBe(409);
    await expect(assertVerificationEmailRateLimit(userId, 'original@example.test')).resolves.toBeUndefined();
    expect(state.emails).not.toHaveBeenCalled();
  });

  it('includes first-registration email in the shared resend budget', async () => {
    const response = await register('new-account@example.test');
    expect(response.status).toBe(200);
    state.userId = (await response.json()).user.id;
    await state.pg.query("update users set email_verify_expires_at = now() + interval '23 hours' where id = $1", [state.userId]);
    expect((await resend()).status).toBe(429);
    expect(state.emails).toHaveBeenCalledTimes(1);
  });

  it('blocks the profile route after a resend, even with another recipient', async () => {
    expect((await resend()).status).toBe(200);
    const response = await profile();
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await response.json()).code).toBe('EMAIL_VERIFY_RATE_LIMIT');
    expect(state.emails).toHaveBeenCalledTimes(1);
    expect((await user()).email).toBe('original@example.test');
  });

  it('blocks resend after a profile change even if the old expiry-based cooldown is absent', async () => {
    expect((await profile()).status).toBe(200);
    await state.pg.query("update users set email_verify_expires_at = now() + interval '23 hours' where id = $1", [userId]);
    const response = await resend();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
    expect(state.emails).toHaveBeenCalledTimes(1);
  });

  it('shares the recipient budget across accounts and does not store raw email addresses in keys', async () => {
    await assertVerificationEmailRateLimit(userId, 'Recipient@example.test');
    await expect(assertVerificationEmailRateLimit(otherUserId, ' recipient@EXAMPLE.test ')).rejects.toMatchObject({ status: 429 });
    const limits = await state.pg.query('select * from rate_limits');
    expect(JSON.stringify(limits.rows)).not.toMatch(/recipient@example\.test/i);
  });

  it('permits only one concurrent send reservation per account', async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => assertVerificationEmailRateLimit(userId, `address${index}@example.test`)));
    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(attempt => attempt.status === 'rejected')).toHaveLength(7);
  });

  it('allows a fresh send after the five-minute windows expire', async () => {
    await assertVerificationEmailRateLimit(userId, 'recipient@example.test');
    await state.pg.exec("update rate_limits set window_start = now() - interval '301 seconds'");
    await expect(assertVerificationEmailRateLimit(userId, 'recipient@example.test')).resolves.toBeUndefined();
  });
});
