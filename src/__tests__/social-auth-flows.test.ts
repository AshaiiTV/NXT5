import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any, beforeQuery: null as null | ((query: string) => Promise<void>),
  authorize: vi.fn(), exchange: vi.fn(), email: vi.fn(async (_message: any) => {}), rate: vi.fn(async () => {}),
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
        })), rowCount: result.affectedRows ?? result.rows.length,
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
  return { sql: neon('postgresql://test:test@social-flows.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/social-auth-protocol', async original => ({
  ...await original<any>(), createSocialAuthorizationUrl: state.authorize, exchangeSocialAuthorizationCode: state.exchange,
}));
vi.mock('../../netlify/functions/_lib/email', () => ({ sendEmailVerificationEmail: state.email }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({
  assertRateLimit: state.rate, assertSubjectRateLimit: state.rate, assertVerificationEmailRateLimit: state.rate,
}));

import statusHandler from '../../netlify/functions/auth-social-status';
import startHandler from '../../netlify/functions/auth-social-start';
import callbackHandler from '../../netlify/functions/auth-social-callback';
import finishHandler from '../../netlify/functions/auth-social-finish';
import pendingHandler from '../../netlify/functions/auth-social-pending';
import completeHandler from '../../netlify/functions/auth-social-complete';
import unlinkHandler from '../../netlify/functions/auth-social-unlink';
import { COOKIE_NAME, hashPassword, sha256 } from '../../netlify/functions/_lib/auth';
import { LEGAL_VERSION, SOCIAL_BROWSER_COOKIE, SOCIAL_TICKET_COOKIE } from '../../netlify/functions/_lib/social-auth';
import type { SocialProvider, VerifiedSocialIdentity } from '../../netlify/functions/_lib/social-auth-protocol';

const origin = 'https://nxt5.org';
const userId = '81000000-0000-4000-8000-000000000001';
const otherId = '81000000-0000-4000-8000-000000000002';
const teamId = '82000000-0000-4000-8000-000000000001';
const email = 'owner@example.test';
const password = 'Existing secure password!';
const session = 'existing-first-party-session';
const appleKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
let passwordHash: string;
let identity: VerifiedSocialIdentity;
const rows = async (query: string, params: unknown[] = []) => (await state.pg.query(query, params)).rows;
const url = (endpoint: string) => `${origin}/.netlify/functions/auth-social-${endpoint}`;
const get = (endpoint: string) => new Request(url(endpoint));
const post = (endpoint: string, body: unknown, headers: Record<string, string> = {}) => new Request(url(endpoint), {
  method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});

function browser(initial: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initial));
  const set = vi.fn((cookie: any) => { if (cookie.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value); });
  return { jar, context: { cookies: { get: (name: string) => jar.get(name), set } } as any, set };
}
type Browser = ReturnType<typeof browser>;
const copyBrowser = (source: Browser) => browser(Object.fromEntries(source.jar));
const enabled = (provider: SocialProvider = 'google') => vi.stubEnv(`${provider.toUpperCase()}_AUTH_ENABLED`, 'true');

async function seedUser(id = userId, address = email, hashedPassword = passwordHash) {
  await rows('insert into users(id,account_name,email,name,password_hash,email_verified) values($1::uuid,$1::text,$2,$3,$4,true)', [id, address, `Player ${id.slice(-1)}`, hashedPassword]);
}
async function seedSession(id = userId, raw = session) {
  await rows("insert into sessions(user_id,token_hash,expires_at) values($1,$2,now() + interval '1 day')", [id, sha256(raw)]);
}
async function seedIdentity(id = userId, provider = identity.provider, subject = identity.subject) {
  await rows('insert into social_identities(user_id,provider,subject,display_name) values($1,$2,$3,$4)', [id, provider, subject, 'External player']);
}
async function begin(target: Browser, body: Record<string, unknown> = {}) {
  const response = await startHandler(post('start', { provider: identity.provider, flow: 'login', ...body }), target.context);
  expect(response.status).toBe(200);
  const { authorizationUrl } = await response.json();
  return new URL(authorizationUrl).searchParams.get('state')!;
}
function callbackRequest(value: string, provider: SocialProvider = identity.provider, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ state: value, code: 'verified-authorization-code', ...extra });
  return provider === 'apple'
    ? new Request(url('callback'), { method: 'POST', headers: { origin: 'https://appleid.apple.com', 'content-type': 'application/x-www-form-urlencoded' }, body: params })
    : new Request(`${url('callback')}?${params}`);
}
async function callback(target: Browser, value: string, provider: SocialProvider = identity.provider) {
  return callbackHandler(callbackRequest(value, provider), target.context);
}
async function prepareSignup(target = browser(), body: Record<string, unknown> = {}) {
  const flowState = await begin(target, { flow: 'register', ...body });
  expect((await callback(target, flowState)).headers.get('location')).toBe('/.netlify/functions/auth-social-finish');
  const finish = await finishHandler(get('finish'), target.context);
  expect(finish.status).toBe(303);
  expect(finish.headers.get('location')).toContain('/inscription?social=complete');
  return target;
}
const complete = (target: Browser, body: Record<string, unknown> = {}) => completeHandler(post('complete', {
  displayName: 'New Player', email: identity.email || 'chosen@example.test', acceptLegal: true, legalVersion: LEGAL_VERSION, ...body,
}), target.context);

beforeAll(async () => {
  state.pg = new PGlite();
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')");
  await state.pg.exec(schema);
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260923_social_auth.sql', import.meta.url), 'utf8'));
  await state.pg.exec(`create table app_schema_migrations(migration_key text primary key);
    insert into app_schema_migrations values('audit-runtime-20260906-v1'), ('social-auth-20260923-v1');`);
  passwordHash = await hashPassword(password);
}, 30_000);
beforeEach(async () => {
  state.beforeQuery = null;
  await state.pg.exec('truncate users, social_auth_flows, social_auth_tickets cascade');
  for (const name of Object.keys(process.env)) if (/^(GOOGLE_AUTH_|APPLE_AUTH_|DISCORD_AUTH_|SOCIAL_AUTH_|RIOT_RSO_)/.test(name)) vi.stubEnv(name, undefined);
  vi.stubEnv('SESSION_SECRET', 's'.repeat(64));
  vi.stubEnv('SOCIAL_AUTH_SITE_ORIGIN', origin);
  vi.stubEnv('GOOGLE_AUTH_CLIENT_ID', 'nxt5.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_AUTH_CLIENT_SECRET', 'google-test-secret');
  vi.stubEnv('DISCORD_AUTH_CLIENT_ID', '123456789123456789');
  vi.stubEnv('DISCORD_AUTH_CLIENT_SECRET', 'discord-test-secret');
  vi.stubEnv('APPLE_AUTH_CLIENT_ID', 'org.nxt5.web');
  vi.stubEnv('APPLE_AUTH_TEAM_ID', 'TEAM123456');
  vi.stubEnv('APPLE_AUTH_KEY_ID', 'KEY1234567');
  vi.stubEnv('APPLE_AUTH_PRIVATE_KEY', appleKey);
  identity = { provider: 'google', subject: 'stable-provider-user', email: 'new-player@example.test', emailVerified: true, name: 'External Player' };
  state.email.mockClear(); state.rate.mockClear(); state.authorize.mockReset(); state.exchange.mockReset();
  state.authorize.mockImplementation(async (config: any, params: any) => `https://provider.example/authorize?${new URLSearchParams({ state: params.state, provider: config.provider })}`);
  state.exchange.mockImplementation(async () => ({ ...identity }));
});
afterEach(() => { state.beforeQuery = null; vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await state.pg?.close(); });

describe('provider discovery and request initiation', () => {
  it('renders disabled public providers without accessing the database', async () => {
    state.beforeQuery = async () => { throw new Error('No database should be required'); };
    const target = browser();
    const response = await statusHandler(get('status'), target.context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ providers: [
      { id: 'google', label: 'Google', enabled: false }, { id: 'discord', label: 'Discord', enabled: false },
      { id: 'apple', label: 'Apple', enabled: false }, { id: 'riot', label: 'Riot Games', enabled: false },
    ] });
  });

  it('requires enabled providers, a same-origin JSON POST and authentication for linking', async () => {
    const target = browser();
    expect((await startHandler(post('start', { provider: 'google', flow: 'login' }), target.context)).status).toBe(503);
    enabled();
    expect((await startHandler(post('start', { provider: 'google', flow: 'login' }, { origin: 'https://attacker.example' }), target.context)).status).toBe(403);
    expect((await startHandler(post('start', { provider: 'google', flow: 'login' }, { 'content-type': 'text/plain' }), target.context)).status).toBe(400);
    expect((await startHandler(post('start', { provider: 'google', flow: 'link' }), target.context)).status).toBe(401);
    expect((await startHandler(get('start'), target.context)).status).toBe(405);
    expect(await rows('select * from social_auth_flows')).toHaveLength(0);
    expect(state.authorize).not.toHaveBeenCalled();
  });

  it('stores hashed correlation values, safe defaults and browser cookie properties', async () => {
    enabled();
    const target = browser();
    const value = await begin(target, { next: 'https://attacker.example' });
    const [flow] = await rows('select * from social_auth_flows');
    expect(flow).toMatchObject({ state_hash: sha256(value), browser_hash: sha256(target.jar.get(SOCIAL_BROWSER_COOKIE)!), remember: true, destination: '/equipes', flow: 'login', user_id: null });
    expect(flow.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(flow.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(target.set).toHaveBeenCalledWith(expect.objectContaining({ name: SOCIAL_BROWSER_COOKIE, httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 300 }));
    const second = await begin(target, { flow: 'register', rememberMe: false, invite: 'TEAM_valid_123' });
    expect(await rows('select * from social_auth_flows where state_hash=$1', [sha256(value)])).toHaveLength(0);
    expect((await rows('select * from social_auth_flows where state_hash=$1', [sha256(second)]))[0]).toMatchObject({ remember: false, destination: '/equipes?invite=TEAM_valid_123' });
  });
});

describe('callback correlation and first-party finalization', () => {
  it('binds the flow to the browser and consumes it before any provider exchange', async () => {
    enabled();
    const target = browser();
    const value = await begin(target);
    const wrongBrowser = browser({ [SOCIAL_BROWSER_COOKIE]: 'x'.repeat(43) });
    expect((await callback(wrongBrowser, value)).headers.get('location')).toBe('/connexion?social=expired');
    expect(state.exchange).not.toHaveBeenCalled();
    const pending = (await rows('select * from social_auth_flows'))[0];
    expect((await callback(target, value)).headers.get('location')).toBe('/.netlify/functions/auth-social-finish');
    expect(state.exchange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ provider: 'google' }), {
      code: 'verified-authorization-code', nonce: pending.nonce, codeVerifier: pending.code_verifier,
    });
    expect((await callback(target, value)).headers.get('location')).toBe('/connexion?social=expired');
    expect(state.exchange).toHaveBeenCalledTimes(1);
    expect(await rows('select * from social_auth_flows')).toHaveLength(0);
    expect(await rows("select * from social_auth_tickets where purpose='callback'")).toHaveLength(1);
  });

  it('handles Apple POST without the Lax session and links only after its first-party return', async () => {
    identity.provider = 'apple'; enabled('apple');
    await seedUser(); await seedSession();
    const target = browser({ [COOKIE_NAME]: session });
    const value = await begin(target, { flow: 'link' });
    expect(target.set).toHaveBeenCalledWith(expect.objectContaining({ name: SOCIAL_BROWSER_COOKIE, sameSite: 'None', secure: true }));
    const applePost = copyBrowser(target); applePost.jar.delete(COOKIE_NAME);
    const response = await callback(applePost, value, 'apple');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/.netlify/functions/auth-social-finish');
    expect(await rows('select * from social_identities')).toHaveLength(0);
    for (const [cookie] of applePost.set.mock.calls) target.context.cookies.set(cookie);
    expect(target.jar.get(COOKIE_NAME)).toBe(session);
    expect((await finishHandler(get('finish'), target.context)).headers.get('location')).toBe('/parametres?social=linked&provider=apple');
    expect(await rows('select * from social_identities')).toMatchObject([{ user_id: userId, provider: 'apple', subject: identity.subject }]);
    expect(await rows('select * from sessions')).toHaveLength(1);
    expect(target.jar.has(SOCIAL_TICKET_COOKIE)).toBe(false);
    expect(target.jar.has(SOCIAL_BROWSER_COOKIE)).toBe(false);
  });

  it.each(['different-account', 'different-session'])('rejects link completion after %s takes over the browser', async kind => {
    enabled(); await seedUser(); await seedSession(); await seedUser(otherId, 'other@example.test');
    await seedSession(kind === 'different-account' ? otherId : userId, 'replacement-session');
    const target = browser({ [COOKIE_NAME]: session });
    const value = await begin(target, { flow: 'link' });
    await callback(target, value);
    target.jar.set(COOKIE_NAME, 'replacement-session');
    expect((await finishHandler(get('finish'), target.context)).headers.get('location')).toBe('/parametres?social=account_changed&provider=google');
    expect(await rows('select * from social_identities')).toHaveLength(0);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(0);
    expect((await finishHandler(get('finish'), target.context)).headers.get('location')).toBe('/connexion?social=expired');
  });

  it('consumes cancelled authorization and rejects provider mixups', async () => {
    enabled();
    const target = browser();
    const cancelled = await begin(target);
    const response = await callbackHandler(callbackRequest(cancelled, 'google', { error: 'access_denied' }), target.context);
    expect(response.headers.get('location')).toBe('/connexion?social=cancelled&provider=google');
    expect(state.exchange).not.toHaveBeenCalled();
    const mismatched = await begin(target);
    identity.provider = 'discord';
    expect((await callback(target, mismatched, 'google')).headers.get('location')).toBe('/connexion?social=failed&provider=google');
    expect(await rows('select * from social_auth_tickets')).toHaveLength(0);
  });
});

describe('signup completion and ownership', () => {
  it('exposes a pending profile, requires current legal consent and creates one account without password', async () => {
    enabled();
    const target = await prepareSignup();
    const pending = await pendingHandler(get('pending'), target.context);
    expect(await pending.json()).toEqual({ provider: 'google', email: identity.email, emailVerified: true, name: 'External Player', destination: '/equipes?create=1' });
    for (const body of [{ acceptLegal: false }, { legalVersion: 'old-version' }]) {
      const response = await complete(target, body);
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('LEGAL_ACCEPTANCE_REQUIRED');
    }
    expect(await rows('select * from users')).toHaveLength(0);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(1);
    const replay = copyBrowser(target);
    const result = await complete(target);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ user: { email: identity.email, email_verified: true, name: 'New Player' }, destination: '/equipes?create=1', verificationEmailSent: true });
    const [account] = await rows('select * from users');
    expect(account).toMatchObject({ email: identity.email, email_verified: true, password_hash: '', legal_version: LEGAL_VERSION, email_verify_token: null });
    expect(account.legal_accepted_at).not.toBeNull();
    expect(await rows('select * from social_identities')).toMatchObject([{ user_id: account.id, provider: 'google', subject: identity.subject }]);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(0);
    expect(await rows("select * from audit_logs where action='auth.social_register'")).toHaveLength(1);
    expect((await complete(replay)).status).toBe(400);
    expect(await rows('select * from users')).toHaveLength(1);
    expect(state.email).not.toHaveBeenCalled();
    expect(target.set).toHaveBeenCalledWith(expect.objectContaining({ name: COOKIE_NAME, httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60 }));
  });

  it('allows only one competing redemption of the same signup ticket', async () => {
    enabled();
    const first = await prepareSignup(); const second = copyBrowser(first);
    const responses = await Promise.all([complete(first, { email: 'first@example.test' }), complete(second, { email: 'second@example.test' })]);
    expect(responses.map(result => result.status).sort()).toEqual([200, 400]);
    expect(await rows('select * from users')).toHaveLength(1);
    expect(await rows('select * from social_identities')).toHaveLength(1);
    expect(await rows('select * from sessions')).toHaveLength(1);
  });

  it('never merges a verified provider email into an existing NXT5 account', async () => {
    enabled(); await seedUser(); identity.email = email;
    const target = await prepareSignup();
    const response = await complete(target);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('SOCIAL_EMAIL_EXISTS');
    expect(await rows('select * from users')).toMatchObject([{ id: userId, email }]);
    expect(await rows('select * from social_identities')).toHaveLength(0);
    expect(await rows('select * from sessions')).toHaveLength(0);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(1);
  });

  it('rolls back account creation when a competing signup already claimed the provider identity', async () => {
    enabled();
    const first = await prepareSignup(); const second = await prepareSignup();
    expect((await complete(first, { email: 'first@example.test' })).status).toBe(200);
    const response = await complete(second, { email: 'second@example.test' });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('SOCIAL_CONFLICT');
    expect(await rows('select email from users')).toEqual([{ email: 'first@example.test' }]);
    expect(await rows('select * from social_identities')).toHaveLength(1);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(1);
  });

  it.each(['unverified-provider-email', 'different-chosen-email'])('does not inherit verification for %s', async kind => {
    enabled();
    if (kind === 'unverified-provider-email') identity.emailVerified = false;
    const chosenEmail = kind === 'different-chosen-email' ? 'different@example.test' : identity.email!;
    const target = await prepareSignup();
    expect((await complete(target, { email: chosenEmail })).status).toBe(200);
    const [account] = await rows('select * from users');
    expect(account.email_verified).toBe(false);
    expect(account.email_verify_token).toMatch(/^[0-9a-f]{64}$/);
    expect(state.email).toHaveBeenCalledExactlyOnceWith({ to: chosenEmail, token: expect.any(String) });
    expect(sha256(state.email.mock.calls[0][0].token)).toBe(account.email_verify_token);
  });

  it('keeps a committed unverified account usable if sending the verification email fails', async () => {
    enabled(); identity.emailVerified = false;
    state.email.mockRejectedValueOnce(new Error('Email provider unavailable'));
    const target = await prepareSignup();
    const response = await complete(target);
    expect(response.status).toBe(200);
    expect((await response.json()).verificationEmailSent).toBe(false);
    expect(await rows('select * from users')).toHaveLength(1);
    expect(await rows('select * from sessions')).toHaveLength(1);
    expect(target.jar.has(COOKIE_NAME)).toBe(true);
  });
});

describe('existing identities and guarded login sessions', () => {
  it('logs in the linked account by subject even after provider email changes', async () => {
    enabled(); await seedUser(); await seedIdentity();
    const target = browser(); const value = await begin(target, { rememberMe: false, next: '/planning' });
    await callback(target, value);
    expect((await finishHandler(get('finish'), target.context)).headers.get('location')).toBe('/planning');
    const [savedSession] = await rows('select * from sessions');
    expect(savedSession.user_id).toBe(userId);
    expect(savedSession.token_hash).toBe(sha256(target.jar.get(COOKIE_NAME)!));
    expect(target.set).toHaveBeenCalledWith(expect.objectContaining({ name: COOKIE_NAME, maxAge: 12 * 60 * 60, sameSite: 'Lax', httpOnly: true, secure: true }));
    expect((await rows('select email from users where id=$1', [userId]))[0].email).toBe(email);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(0);
  });

  it('refuses to create a session if the identity is removed after account lookup', async () => {
    enabled(); await seedUser(); await seedIdentity();
    const target = browser(); const value = await begin(target); await callback(target, value);
    state.beforeQuery = async query => {
      if (!query.includes('insert into sessions')) return;
      state.beforeQuery = null;
      await rows('update users set social_link_revision=social_link_revision+1 where id=$1', [userId]);
      await rows('delete from social_identities where user_id=$1', [userId]);
    };
    expect((await finishHandler(get('finish'), target.context)).headers.get('location')).toBe('/connexion?social=account_changed&provider=google');
    expect(await rows('select * from sessions')).toHaveLength(0);
    expect(target.jar.has(COOKIE_NAME)).toBe(false);
  });
});

describe('unlink authentication and transaction effects', () => {
  it.each(['wrong-password', 'passwordless'])('rejects %s without altering access', async kind => {
    await seedUser(userId, email, kind === 'passwordless' ? '' : passwordHash); await seedSession(); await seedIdentity();
    const target = browser({ [COOKIE_NAME]: session });
    const response = await unlinkHandler(post('unlink', { provider: 'google', currentPassword: 'wrong-password' }), target.context);
    expect(response.status).toBe(kind === 'passwordless' ? 409 : 401);
    expect((await response.json()).code).toBe(kind === 'passwordless' ? 'SOCIAL_PASSWORD_REQUIRED' : 'SOCIAL_PASSWORD_INVALID');
    expect(await rows('select * from social_identities')).toHaveLength(1);
    expect((await rows('select social_link_revision from users'))[0].social_link_revision).toBe(0);
    expect(await rows('select * from sessions where revoked_at is null')).toHaveLength(1);
  });

  it('removes one provider, revokes other sessions and pending associations, and preserves teams', async () => {
    enabled(); await seedUser(); await seedSession(); await seedIdentity();
    await seedSession(userId, 'other-active-session');
    await seedIdentity(userId, 'discord', '123456789123456789');
    await seedUser(otherId, 'other@example.test'); await seedSession(otherId, 'unrelated-session');
    await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'NXT5 Test Team','TEST')", [teamId, userId]);
    await rows("insert into team_members(team_id,user_id,role) values($1,$2,'captain'),($1,$3,'player')", [teamId, userId, otherId]);
    const teamSnapshot = await rows('select * from teams'); const membershipSnapshot = await rows('select * from team_members order by user_id');
    const target = browser({ [COOKIE_NAME]: session });
    const callbackTarget = browser({ [COOKIE_NAME]: session });
    const value = await begin(callbackTarget, { flow: 'link' }); await callback(callbackTarget, value);
    await begin(target, { flow: 'link' });
    expect(await rows('select * from social_auth_tickets')).toHaveLength(1);
    expect(await rows('select * from social_auth_flows')).toHaveLength(1);
    const response = await unlinkHandler(post('unlink', { provider: 'google', currentPassword: password }), target.context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(await rows('select provider from social_identities where user_id=$1', [userId])).toEqual([{ provider: 'discord' }]);
    expect((await rows('select social_link_revision from users where id=$1', [userId]))[0].social_link_revision).toBe(1);
    expect(await rows('select * from social_auth_flows')).toHaveLength(0);
    expect(await rows('select * from social_auth_tickets')).toHaveLength(0);
    expect(await rows('select token_hash from sessions where user_id=$1 and revoked_at is null', [userId])).toEqual([{ token_hash: sha256(session) }]);
    expect(await rows('select * from sessions where user_id=$1 and revoked_at is null', [otherId])).toHaveLength(1);
    expect(await rows("select * from audit_logs where action='auth.social_unlink'")).toHaveLength(1);
    expect(await rows('select * from teams')).toEqual(teamSnapshot);
    expect(await rows('select * from team_members order by user_id')).toEqual(membershipSnapshot);
    expect((await finishHandler(get('finish'), callbackTarget.context)).headers.get('location')).toBe('/connexion?social=expired');
  });
});
