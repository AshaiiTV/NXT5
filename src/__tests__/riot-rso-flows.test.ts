import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';

const fixture = vi.hoisted(() => ({ db: null as any, enabled: true, exchange: vi.fn(), beforeQuery: null as any }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const statement = JSON.parse(options.body);
    try {
      await fixture.beforeQuery?.(statement.query);
      const result = await fixture.db.query(statement.query, statement.params);
      return new Response(JSON.stringify({ fields: result.fields, rows: result.rows.map((row: any) => result.fields.map((field: any) => {
        const value = row[field.name];
        if (value == null) return null;
        if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
        if (typeof value === 'boolean') return value ? 't' : 'f';
        return value instanceof Date ? value.toISOString() : String(value);
      })), rowCount: result.affectedRows ?? result.rows.length }));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {}, assertRiotSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/riot-rso-protocol', () => {
  const config = { siteOrigin: 'https://nxt5.org', redirectUri: 'https://nxt5.org/.netlify/functions/auth-riot-callback' };
  return {
    getRiotRsoConfig: () => fixture.enabled ? config : null,
    requireRiotRsoConfig: () => { if (!fixture.enabled) throw Object.assign(new Error('Disabled'), { status: 503, code: 'RIOT_RSO_UNAVAILABLE' }); return config; },
    createRiotAuthorizationUrl: async (_config: any, values: any) => `https://auth.riotgames.com/authorize?${new URLSearchParams({ state: values.state, nonce: values.nonce })}`,
    exchangeRiotAuthorizationCode: fixture.exchange,
  };
});

import start from '../../netlify/functions/auth-riot-start';
import callback from '../../netlify/functions/auth-riot-callback';
import status from '../../netlify/functions/auth-riot-status';
import unlink from '../../netlify/functions/auth-riot-unlink';
import cleanup from '../../netlify/functions/auth-riot-cleanup';
import { COOKIE_NAME, sha256, requireAuth } from '../../netlify/functions/_lib/auth';
import { RIOT_FLOW_COOKIE } from '../../netlify/functions/_lib/riot-rso';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const password = 'NXT5 strong password';
const origin = 'https://nxt5.org';
const identity = { puuid: 'verified-puuid', gameName: 'Player', tagLine: 'EUW' };
function context() {
  const jar = new Map<string, string>();
  return { jar, cookies: { get: (name: string) => jar.get(name), set: vi.fn((cookie: any) => { if (cookie.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value); }) } } as any;
}
function req(endpoint: string, body?: object, headers: Record<string, string> = {}) {
  return new Request(`${origin}/.netlify/functions/${endpoint}`, body ? { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) } : undefined);
}
async function session(ctx: any, userId = first, raw = `session-${userId}`) {
  await fixture.db.query(`insert into sessions(user_id,token_hash,expires_at) values($1,$2,now()+interval '1 day') on conflict(token_hash) do nothing`, [userId, sha256(raw)]);
  ctx.jar.set(COOKIE_NAME, raw);
  return raw;
}
async function begin(ctx: any, flow = 'login', extra = {}) {
  const response = await start(req('auth-riot-start', { flow, ...extra }), ctx);
  expect(response.status).toBe(200);
  return new URL((await response.json()).authorizationUrl).searchParams.get('state')!;
}
function finish(ctx: any, state: string, extra = 'code=valid-code') {
  return callback(req(`auth-riot-callback?state=${state}&${extra}`), ctx);
}
async function count(table: string) { return Number((await fixture.db.query(`select count(*) as count from ${table}`)).rows[0].count); }

beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 's'.repeat(64));
  fixture.db = new PGlite();
  for (const file of ['schema.sql', 'migrations/20260906_runtime_schema.sql', 'migrations/20260923_riot_sign_on.sql']) {
    await fixture.db.exec(readFileSync(new URL(`../../database/${file}`, import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  }
}, 30_000);
beforeEach(async () => {
  fixture.enabled = true;
  fixture.beforeQuery = null;
  fixture.exchange.mockReset().mockResolvedValue(identity);
  await fixture.db.exec('truncate users cascade; truncate rate_limits');
  for (const id of [first, second]) await fixture.db.query(`insert into users(id, account_name, name, password_hash) values($1::uuid,$1::text,'Name',$2)`, [id, bcrypt.hashSync(password, 4)]);
});
afterAll(async () => { await fixture.db?.close(); vi.unstubAllEnvs(); });

describe('official Riot entry points (provider simulated only in this test)', () => {
  it('stays inactive and rejects endpoints without approved configuration', async () => {
    fixture.enabled = false;
    expect(await (await status(req('auth-riot-status'), context())).json()).toEqual({ enabled: false, linked: false });
    for (const response of [await start(req('auth-riot-start', { flow: 'login' }), context()), await finish(context(), 'x')]) expect(response.status).toBe(503);
    expect((await unlink(req('auth-riot-unlink', { currentPassword: password }), context())).status).toBe(401);
    expect(fixture.exchange).not.toHaveBeenCalled();
    expect(await count('riot_auth_flows')).toBe(0);
  });
  it('requires exact same-origin JSON POST, a known flow and an authenticated link', async () => {
    expect((await start(req('auth-riot-start', { flow: 'link' }), context())).status).toBe(401);
    expect((await start(req('auth-riot-start', { flow: 'other' }), context())).status).toBe(400);
    expect((await start(req('auth-riot-start', { flow: 'login' }, { Origin: 'https://evil.test' }), context())).status).toBe(403);
    expect((await start(req('auth-riot-start', { flow: 'login' }, { Origin: '' }), context())).status).toBe(403);
    expect((await start(req('auth-riot-start', { flow: 'login' }, { 'Sec-Fetch-Site': 'cross-site' }), context())).status).toBe(403);
    expect((await start(req('auth-riot-start'), context())).status).toBe(405);
  });
  it('creates secure browser binding, hashes state and stores only short-lived verifier data', async () => {
    const ctx = context(); const state = await begin(ctx);
    expect(ctx.cookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: RIOT_FLOW_COOKIE, secure: true, httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 300 }));
    const row = (await fixture.db.query('select * from riot_auth_flows')).rows[0];
    expect(row.state_hash).toBe(sha256(state));
    expect(row.browser_hash).toBe(sha256(ctx.jar.get(RIOT_FLOW_COOKIE)));
    expect(new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()).toBe(300000);
    expect(row.user_id).toBeNull();
  });
  it('bounds JSON requests and applies the project rate limit before opening Riot', async () => {
    expect((await start(req('auth-riot-start', { flow: 'login', padding: 'x'.repeat(1024) }), context())).status).toBe(413);
    for (let attempt = 0; attempt < 4; attempt++) await begin(context());
    const response = await start(req('auth-riot-start', { flow: 'login' }), context());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await count('riot_auth_flows')).toBe(4);
  });
  it('explicitly links without changing roster, account, team or rights; login reuses its internal user/session', async () => {
    await fixture.db.query(`insert into teams(id,owner_id,name,tag) values($1,$2,'Team','T')`, [second, first]);
    await fixture.db.query(`insert into team_members(team_id,user_id,role) values($1,$2,'captain')`, [second, first]);
    await fixture.db.query(`insert into players(team_id,user_id,name,riot_id,role) values($1,$2,'Roster','Declarative#ID','TOP')`, [second, first]);
    const before = await Promise.all(['users', 'teams', 'team_members', 'players'].map(table => fixture.db.query(`select row_to_json(t) as data from ${table} t order by 1::text`)));
    const ctx = context(); await session(ctx);
    expect((await finish(ctx, await begin(ctx, 'link'))).headers.get('location')).toBe('/parametres?riot=linked');
    expect(await count('riot_identities')).toBe(1);
    expect((await status(req('auth-riot-status'), ctx)).status).toBe(200);
    // requireAuth legitimately records activity; identity, credentials and privileges stay unchanged.
    const after = await Promise.all(['users', 'teams', 'team_members', 'players'].map(table => fixture.db.query(`select row_to_json(t) as data from ${table} t order by 1::text`)));
    expect(after.slice(1)).toEqual(before.slice(1));
    expect(after[0].rows.map((x: any) => [x.data.id, x.data.password_hash, x.data.email])).toEqual(before[0].rows.map((x: any) => [x.data.id, x.data.password_hash, x.data.email]));
    const login = context();
    expect((await finish(login, await begin(login, 'login', { rememberMe: false, next: 'https://evil.test' }))).headers.get('location')).toBe('/equipes');
    expect(login.cookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: COOKIE_NAME, httpOnly: true, secure: true, maxAge: 43200 }));
    expect((await requireAuth(req('bootstrap'), login)).id).toBe(first);
  });
  it('never creates or merges an NXT5 account for an unassociated PUUID', async () => {
    const ctx = context();
    expect((await finish(ctx, await begin(ctx))).headers.get('location')).toBe('/connexion?riot=not_linked');
    expect(await count('users')).toBe(2); expect(await count('sessions')).toBe(0); expect(await count('riot_identities')).toBe(0);
  });
  it('handles two simultaneous identity claims atomically without disclosing the other account', async () => {
    const one = context(); const two = context(); await session(one); await session(two, second);
    const a = await begin(one, 'link'); const b = await begin(two, 'link');
    const responses = await Promise.all([finish(one, a), finish(two, b)]);
    expect(responses.map(r => r.headers.get('location')).sort()).toEqual(['/parametres?riot=conflict', '/parametres?riot=linked']);
    expect(await count('riot_identities')).toBe(1);
    expect(responses.every(r => !r.headers.get('location')?.includes(first) && !r.headers.get('location')?.includes(second))).toBe(true);
  });
  it('does not replace a different identity already linked to the same NXT5 user', async () => {
    const ctx = context(); await session(ctx);
    await fixture.db.query('insert into riot_identities(user_id,puuid) values($1,$2)', [first, 'previous-puuid']);
    expect((await finish(ctx, await begin(ctx, 'link'))).headers.get('location')).toBe('/parametres?riot=account_already_linked');
    expect((await fixture.db.query('select puuid from riot_identities')).rows[0].puuid).toBe('previous-puuid');
  });
  it('rejects expiration, browser mismatch and replay; only one concurrent callback exchanges a code', async () => {
    const ctx = context(); const state = await begin(ctx);
    expect((await finish(context(), state)).headers.get('location')).toContain('expired');
    expect(fixture.exchange).not.toHaveBeenCalled();
    const twin = context(); twin.jar.set(RIOT_FLOW_COOKIE, ctx.jar.get(RIOT_FLOW_COOKIE));
    const results = await Promise.all([finish(ctx, state), finish(twin, state)]);
    expect(results.map(r => r.headers.get('location')).sort()).toEqual(['/connexion?riot=expired', '/connexion?riot=not_linked']);
    expect(fixture.exchange).toHaveBeenCalledTimes(1);
    const expired = context(); const old = await begin(expired);
    await fixture.db.query("update riot_auth_flows set created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute'");
    expect((await finish(expired, old)).headers.get('location')).toContain('expired');
    expect(fixture.exchange).toHaveBeenCalledTimes(1);
    expect((await cleanup()).status).toBe(200); expect(await count('riot_auth_flows')).toBe(0);
  });
  it('rejects login/link confusion and a changed NXT5 account/session', async () => {
    const ctx = context(); await session(ctx); const link = await begin(ctx, 'link');
    await session(ctx, second);
    expect((await finish(ctx, link, 'code=x&flow=login')).headers.get('location')).toBe('/parametres?riot=account_changed');
    const login = context(); const state = await begin(login); await session(login);
    expect((await finish(login, state, 'code=x&flow=link')).headers.get('location')).toBe('/connexion?riot=account_changed');
    expect(fixture.exchange).not.toHaveBeenCalled();
    expect((await start(req('auth-riot-start', { flow: 'login' }), login)).status).toBe(409);
  });
  it.each(['error=access_denied', 'error=provider_error', 'iss=https://evil.test&code=x', 'code=a&code=b'])('consumes state on rejection (%s)', async extra => {
    const ctx = context(); const state = await begin(ctx);
    const cookie = ctx.jar.get(RIOT_FLOW_COOKIE);
    const response = await finish(ctx, state, extra);
    expect(response.headers.get('location')).toMatch(/riot=(cancelled|failed)$/);
    ctx.jar.set(RIOT_FLOW_COOKIE, cookie);
    expect((await finish(ctx, state)).headers.get('location')).toContain('expired');
    expect(fixture.exchange).not.toHaveBeenCalled();
  });
  it('consumes state on exchange/validation failure without logging or returning provider secrets', async () => {
    fixture.exchange.mockRejectedValue(new Error('sensitive-code-and-token'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = context(); const response = await finish(ctx, await begin(ctx));
    expect(response.headers.get('location')).toBe('/connexion?riot=failed');
    expect(await response.text()).not.toContain('sensitive'); expect(log).not.toHaveBeenCalled();
    expect(await count('riot_auth_flows')).toBe(0); expect(await count('sessions')).toBe(0); log.mockRestore();
  });
  it('requires password reauthentication to unlink, preserves its usable session and revokes others', async () => {
    const ctx = context(); await session(ctx); await session(context(), first, 'other-session');
    await finish(ctx, await begin(ctx, 'link'));
    expect((await unlink(req('auth-riot-unlink', { currentPassword: 'bad' }), ctx)).status).toBe(401);
    expect(await count('riot_identities')).toBe(1);
    fixture.enabled = false;
    expect(await (await status(req('auth-riot-status'), ctx)).json()).toMatchObject({ enabled: false, linked: true });
    expect((await unlink(req('auth-riot-unlink', { currentPassword: password }), ctx)).status).toBe(200);
    expect(await count('riot_identities')).toBe(0);
    expect((await requireAuth(req('bootstrap'), ctx)).id).toBe(first);
    expect((await fixture.db.query('select revoked_at from sessions where token_hash=$1', [sha256('other-session')])).rows[0].revoked_at).not.toBeNull();
  });
  it('prevents an association already exchanging its code from undoing unlink', async () => {
    const ctx = context(); await session(ctx); const state = await begin(ctx, 'link');
    fixture.exchange.mockImplementationOnce(async () => {
      expect((await unlink(req('auth-riot-unlink', { currentPassword: password }), ctx)).status).toBe(200);
      return identity;
    });
    expect((await finish(ctx, state)).headers.get('location')).toBe('/parametres?riot=account_changed');
    expect(await count('riot_identities')).toBe(0);
  });
  it('rejects a session revoked while exchanging the association code', async () => {
    const ctx = context(); const token = await session(ctx); const state = await begin(ctx, 'link');
    fixture.exchange.mockImplementationOnce(async () => {
      await fixture.db.query('update sessions set revoked_at=now() where token_hash=$1', [sha256(token)]);
      return identity;
    });
    expect((await finish(ctx, state)).headers.get('location')).toBe('/parametres?riot=account_changed');
    expect(await count('riot_identities')).toBe(0);
  });
  it('prevents a login from issuing a session after the association was removed', async () => {
    const owner = context(); await session(owner); await finish(owner, await begin(owner, 'link'));
    const ctx = context(); const state = await begin(ctx);
    fixture.beforeQuery = async (query: string) => {
      if (!query.includes('with authorized_user')) return;
      fixture.beforeQuery = null;
      expect((await unlink(req('auth-riot-unlink', { currentPassword: password }), owner)).status).toBe(200);
    };
    expect((await finish(ctx, state)).headers.get('location')).toBe('/connexion?riot=account_changed');
    expect(ctx.jar.get(COOKIE_NAME)).toBeUndefined(); expect(await count('sessions')).toBe(1);
  });
  it('cascades identity and pending link cleanup when an account is deleted', async () => {
    const ctx = context(); await session(ctx); await finish(ctx, await begin(ctx, 'link')); await begin(ctx, 'link');
    await fixture.db.query('delete from users where id=$1', [first]);
    expect(await count('riot_identities')).toBe(0); expect(await count('riot_auth_flows')).toBe(0);
    expect(await count('sessions')).toBe(0);
  });
});
