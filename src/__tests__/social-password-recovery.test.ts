import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any, modern: null as any, legacy: null as any,
  beforeQuery: null as null | ((query: string) => Promise<void>),
  emails: vi.fn(async (_message: any) => {}), verification: vi.fn(async () => {}), rate: vi.fn(async () => {})
}));
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
        })), rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) return new Response(JSON.stringify({ results: await state.pg.transaction(async (tx: any) => {
        const results = []; for (const query of body.queries) results.push(await execute(tx, query)); return results;
      }) }));
      return new Response(JSON.stringify(await execute(state.pg, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@password-recovery.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/auth', async original => ({ ...await original<any>(), assertSessionSecret: () => {} }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/email', () => ({ isPasswordEmailConfigured: () => true, sendPasswordResetEmail: state.emails, sendEmailVerificationEmail: state.verification }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: state.rate, assertVerificationEmailRateLimit: state.rate }));

import resetPassword from '../../netlify/functions/auth-reset-password';
import requestPasswordReset from '../../netlify/functions/auth-request-password-reset';
import login from '../../netlify/functions/auth-login';
import register from '../../netlify/functions/auth-register';
import changePassword from '../../netlify/functions/auth-change-password';
import { hashPassword, sha256, verifyPassword } from '../../netlify/functions/_lib/auth';

const userId = '80000000-0000-4000-8000-000000000001';
const otherId = '80000000-0000-4000-8000-000000000002';
const email = 'victim@example.test';
const token = 'mailbox-ownership-reset-token';
const nextPassword = 'My secure new password';
const rows = async (query: string, params: unknown[] = []) => (await state.pg.query(query, params)).rows;
const account = async () => (await rows('select * from users where id = $1', [userId]))[0];
const post = (path: string, body: unknown) => new Request(`https://nxt5.test/${path}`, {
  method: 'POST', headers: { origin: 'https://nxt5.test', 'content-type': 'application/json' }, body: JSON.stringify(body)
});
const reset = (next = nextPassword, value = token) => resetPassword(post('auth-reset-password', { token: value, nextPassword: next }));
const request = () => requestPasswordReset(post('auth-request-password-reset', { email }));

async function seed(database = state.modern) {
  state.pg = database;
  await state.pg.exec('truncate users cascade');
  for (const [id, address] of [[userId, email], [otherId, 'other@example.test']]) {
    await rows("insert into users(id, account_name, email, name, password_hash, email_verified) values($1,$3,$2,'Test user','',false)", [id, address, id]);
    await rows("insert into sessions(user_id,token_hash,expires_at) values($1,$2,now() + interval '1 day')", [id, sha256(id)]);
    if (database === state.modern) await rows("insert into social_identities(user_id,provider,subject) values($1,'discord',$2)", [id, id]);
  }
  if (database === state.modern) {
    await rows("insert into password_reset_tokens(user_id,token_hash,expires_at,email) values($1,$2,now() + interval '30 minutes',$3)", [userId, sha256(token), email]);
    await rows("insert into social_auth_flows(state_hash,browser_hash,provider,flow,user_id,session_hash,link_revision,nonce,code_verifier,remember) values($1,$2,'google','link',$3,$4,0,'nonce','verifier',true)", [sha256('flow'), sha256('browser'), userId, sha256(userId)]);
    await rows("insert into social_auth_tickets(token_hash,browser_hash,purpose,provider,subject,flow,user_id,session_hash,link_revision,remember,destination) values($1,$2,'callback','google','subject','link',$3,$4,0,true,'/equipes')", [sha256('ticket'), sha256('browser'), userId, sha256(userId)]);
  } else {
    await rows("insert into password_reset_tokens(user_id,token_hash,expires_at) values($1,$2,now() + interval '30 minutes')", [userId, sha256(token)]);
  }
}

beforeAll(async () => {
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')");
  const runtime = readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8');
  const social = readFileSync(new URL('../../database/migrations/20260923_social_auth.sql', import.meta.url), 'utf8');
  state.modern = new PGlite(); state.legacy = new PGlite();
  for (const db of [state.modern, state.legacy]) { await db.exec(schema); await db.exec(runtime); }
  await state.modern.exec(social);
}, 30_000);
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('PUBLIC_SITE_URL', 'https://nxt5.test');
  state.beforeQuery = null;
  state.emails.mockClear(); state.verification.mockClear(); state.rate.mockClear();
  await seed();
});
afterEach(() => { state.beforeQuery = null; vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await state.modern?.close(); await state.legacy?.close(); });

describe('social account recovery proves mailbox ownership and removes other access', () => {
  it('does not restore a registration session after the email owner recovers the new account', async () => {
    const registrationEmail = 'new-victim@example.test';
    const registrationToken = 'registration-recovery-token';
    const context = { cookies: { set: vi.fn() } } as any;
    let recoveredId: string | undefined;
    state.beforeQuery = async query => {
      if (!/insert into sessions/i.test(query)) return;
      state.beforeQuery = null;
      recoveredId = (await rows('select id from users where email=$1', [registrationEmail]))[0].id;
      await rows("insert into password_reset_tokens(user_id,token_hash,expires_at,email) values($1,$2,now()+interval '1 hour',$3)", [recoveredId, sha256(registrationToken), registrationEmail]);
      expect((await reset(nextPassword, registrationToken)).status).toBe(200);
    };
    const response = await register(post('auth-register', { email: registrationEmail, displayName: 'New victim', password: 'Attacker initial password', acceptLegal: true, legalVersion: '2026-09-23' }), context);
    expect(recoveredId).toBeTruthy();
    expect(response.status).toBe(401);
    expect(context.cookies.set).not.toHaveBeenCalled();
    expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [recoveredId])).toHaveLength(0);
    expect(await verifyPassword(nextPassword, (await rows('select password_hash from users where id=$1', [recoveredId]))[0].password_hash)).toBe(true);
  });

  it.each(['recovery', 'revoked-session'])('rejects a pending password change after %s', async interruption => {
    const oldPassword = 'Compromised old password';
    await rows('update users set password_hash=$1 where id=$2', [await hashPassword(oldPassword), userId]);
    const context = { cookies: { get: () => userId, set: vi.fn() } } as any;
    let interrupted = false;
    state.beforeQuery = async query => {
      if (!/set\s+password_hash/i.test(query)) return;
      state.beforeQuery = null;
      interrupted = true;
      if (interruption === 'recovery') expect((await reset()).status).toBe(200);
      else await rows('update sessions set revoked_at=now() where user_id=$1', [userId]);
    };
    const response = await changePassword(post('auth-change-password', { currentPassword: oldPassword, nextPassword: 'Attacker replacement password' }), context);
    expect(interrupted).toBe(true);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ACCOUNT_CHANGED');
    expect(await verifyPassword(interruption === 'recovery' ? nextPassword : oldPassword, (await account()).password_hash)).toBe(true);
  });

  it('allows a password change with the current password and exact live session', async () => {
    const oldPassword = 'Current account password';
    await rows('update users set password_hash=$1 where id=$2', [await hashPassword(oldPassword), userId]);
    await rows("insert into sessions(user_id,token_hash,expires_at) values($1,$2,now()+interval '1 day')", [userId, sha256('second-session')]);
    const context = { cookies: { get: () => userId, set: vi.fn() } } as any;
    const response = await changePassword(post('auth-change-password', { currentPassword: oldPassword, nextPassword }), context);
    expect(response.status).toBe(200);
    expect(await verifyPassword(nextPassword, (await account()).password_hash)).toBe(true);
    expect(await rows('select token_hash from sessions where user_id=$1 and revoked_at is null', [userId])).toEqual([{ token_hash: sha256(userId) }]);
  });

  it('does not create a new session from a password verified before recovery', async () => {
    const oldPassword = 'Compromised old password';
    await rows('update users set password_hash=$1 where id=$2', [await hashPassword(oldPassword), userId]);
    const context = { cookies: { set: vi.fn() } } as any;
    let interrupted = false;
    state.beforeQuery = async query => {
      if (!/insert into sessions/i.test(query)) return;
      state.beforeQuery = null;
      interrupted = true;
      expect((await reset()).status).toBe(200);
    };
    const response = await login(post('auth-login', { accountName: email, password: oldPassword }), context);
    expect(interrupted).toBe(true);
    expect(response.status).toBe(401);
    expect(context.cookies.set).not.toHaveBeenCalled();
    expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [userId])).toHaveLength(0);
  });

  it('sets the first password, verifies the mailbox, and revokes every existing and pending social connection', async () => {
    await rows("update users set email_verify_token='old-token',email_verify_expires_at=now()+interval '1 day' where id=$1", [userId]);
    expect((await reset()).status).toBe(200);
    const current = await account();
    expect(await verifyPassword(nextPassword, current.password_hash)).toBe(true);
    expect(current).toMatchObject({ email_verified: true, email_verify_token: null, email_verify_expires_at: null });
    expect(Number(current.social_link_revision)).toBe(1);
    for (const table of ['social_identities', 'social_auth_flows', 'social_auth_tickets']) {
      expect(await rows(`select * from ${table} where user_id=$1`, [userId])).toHaveLength(0);
    }
    expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [userId])).toHaveLength(0);
    expect(await rows('select * from social_identities where user_id=$1', [otherId])).toHaveLength(1);
    expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [otherId])).toHaveLength(1);
  });

  it('allows exactly one of two competing redemptions and invalidates sibling links', async () => {
    await rows("insert into password_reset_tokens(user_id,token_hash,expires_at,email) values($1,$2,now()+interval '1 hour',$3)", [userId, sha256('another-token'), email]);
    const candidates = ['First chosen password', 'Second chosen password'];
    const results = await Promise.all(candidates.map(value => reset(value)));
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    expect(await verifyPassword(candidates[results.findIndex(result => result.status === 200)], (await account()).password_hash)).toBe(true);
    expect(await rows('select * from password_reset_tokens where user_id=$1 and used_at is null', [userId])).toHaveLength(0);
    expect(await rows("select * from audit_logs where user_id=$1 and action='auth.password_reset_complete'", [userId])).toHaveLength(1);
  });

  it.each(['expired', 'used', 'missing-address', 'changed-address'])('rejects %s tokens without revoking account access', async kind => {
    if (kind === 'expired') await rows("update password_reset_tokens set expires_at=now()-interval '1 second'");
    if (kind === 'used') await rows('update password_reset_tokens set used_at=now()');
    if (kind === 'missing-address') await rows('update password_reset_tokens set email=null');
    if (kind === 'changed-address') await rows("update users set email='changed@example.test' where id=$1", [userId]);
    expect((await reset()).status).toBe(400);
    expect((await account()).password_hash).toBe('');
    expect(await rows('select * from social_identities where user_id=$1', [userId])).toHaveLength(1);
    expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [userId])).toHaveLength(1);
  });

  it('rolls back token consumption, password, and access revocation if the transaction fails', async () => {
    await state.pg.exec(`create function reject_recovery_audit() returns trigger language plpgsql as $$ begin raise exception 'simulated storage failure'; end $$;
      create trigger reject_recovery before insert on audit_logs for each row execute function reject_recovery_audit();`);
    try {
      expect((await reset()).status).toBe(500);
      expect((await account()).password_hash).toBe('');
      expect(await rows('select * from password_reset_tokens where user_id=$1 and used_at is null', [userId])).toHaveLength(1);
      expect(await rows('select * from social_identities where user_id=$1', [userId])).toHaveLength(1);
      expect(await rows('select * from social_auth_flows where user_id=$1', [userId])).toHaveLength(1);
      expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [userId])).toHaveLength(1);
    } finally {
      await state.pg.exec('drop trigger reject_recovery on audit_logs; drop function reject_recovery_audit()');
    }
  });

  it('fails closed when social tables exist without the recovery function', async () => {
    await state.pg.exec('alter function nxt5_reset_password(text,text) rename to recovery_temporarily_missing');
    try {
      expect((await reset()).status).toBe(503);
      expect((await request()).status).toBe(503);
      expect((await account()).password_hash).toBe('');
      expect(state.emails).not.toHaveBeenCalled();
    } finally {
      await state.pg.exec('alter function recovery_temporarily_missing(text,text) rename to nxt5_reset_password');
    }
  });
});

describe('recovery link issuance and compatibility', () => {
  it('stores the receiving email with the token and invalidates previously issued links', async () => {
    expect((await request()).status).toBe(200);
    const active = await rows('select * from password_reset_tokens where used_at is null');
    expect(active).toHaveLength(1);
    expect(active[0].email).toBe(email);
    expect(state.emails).toHaveBeenCalledOnce();
    const sent = state.emails.mock.calls[0][0];
    expect(sent.to).toBe(email);
    expect(sha256(new URL(sent.resetUrl).searchParams.get('token')!)).toBe(active[0].token_hash);
    expect(await rows('select * from password_reset_tokens where token_hash=$1 and used_at is not null', [sha256(token)])).toHaveLength(1);
  });

  it('does not send a token if the email changes after the account lookup', async () => {
    state.beforeQuery = async query => {
      if (!query.includes('to_regprocedure')) return;
      state.beforeQuery = null;
      await rows("update users set email='new-owner@example.test' where id=$1", [userId]);
    };
    expect((await request()).status).toBe(200);
    expect(state.emails).not.toHaveBeenCalled();
    expect(await rows('select * from password_reset_tokens where used_at is null')).toHaveLength(0);
  });

  it('keeps legacy password reset atomic and usable before the social migration', async () => {
    await seed(state.legacy);
    const responses = await Promise.all([reset(), reset()]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    expect(await verifyPassword(nextPassword, (await account()).password_hash)).toBe(true);
    expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [userId])).toHaveLength(0);
    expect((await request()).status).toBe(200);
    expect(state.emails).toHaveBeenCalledOnce();
  });

  it('expires pre-migration tokens without inventing a mailbox ownership snapshot', async () => {
    await seed(state.legacy);
    await state.pg.exec('alter table password_reset_tokens add column email text');
    try {
      // This is the migration statement itself, against the legacy table.
      const migration = readFileSync(new URL('../../database/migrations/20260923_social_auth.sql', import.meta.url), 'utf8');
      const statement = migration.match(/update password_reset_tokens set used_at = now\(\) where email is null and used_at is null;/)?.[0];
      expect(statement).toBeTruthy();
      await state.pg.exec(statement!);
      expect(await rows('select * from password_reset_tokens where used_at is null')).toHaveLength(0);
    } finally { await state.pg.exec('alter table password_reset_tokens drop column email'); }
  });
});
