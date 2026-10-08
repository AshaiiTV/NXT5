import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const { query, requireAdmin } = vi.hoisted(() => ({ query: vi.fn(), requireAdmin: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: requireAdmin }));
import consent from '../../netlify/functions/audience-consent';
import collect from '../../netlify/functions/audience-events';
import dashboard from '../../netlify/functions/admin-audience';
import cleanup, { config } from '../../netlify/functions/audience-cleanup';
import { AUDIENCE_SCHEMA_VERSION, COOKIE, CONSENT_SECONDS, GOALS } from '../../netlify/functions/_lib/audience';
import { audiencePeriod, loadAudienceReport } from '../../netlify/functions/_lib/audience-report';
import { recordRegistrationSignup } from '../../netlify/functions/_lib/audience-registration';
import { canonicalAudiencePath, sanitizeCampaignValue } from '../app/audience-paths.js';

let db: PGlite;
let beforeCollection: (() => Promise<void>) | null = null;
const uid = () => crypto.randomUUID();

function browser(ip = '198.51.100.42') {
  const jar = new Map<string,string>();
  const set = vi.fn((cookie: any) => cookie.maxAge === 0 ? jar.delete(cookie.name) : jar.set(cookie.name,cookie.value));
  return { jar, context: { ip, geo: { country: { code: 'FR' } }, cookies: { get: (name: string) => jar.get(name), set } } as any, set };
}

function request(endpoint: string, body?: any, headers: Record<string,string> = {}) {
  return new Request(`https://nxt5.org/.netlify/functions/${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://nxt5.org', 'user-agent': 'Mozilla/5.0 Chrome/120.0 TestPrivateAgent', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
const event = (overrides: any = {}) => ({ type: 'pageview', eventId: uid(), pageId: uid(), path: '/', ...overrides });
async function accept(client: ReturnType<typeof browser>) {
  const response = await consent(request('audience-consent', { analytics: true }), client.context);
  expect(response.status).toBe(200);
  return response;
}
async function rows(table: string) { return (await db.query(`select * from ${table}`)).rows as any[]; }

beforeAll(async () => {
  db = new PGlite(); await db.waitReady;
  const client = { query: async (sql: string, params?: unknown[]) => params ? db.query(sql,params) : (await db.exec(sql)).at(-1) || { rows: [] } };
  const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g,'').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
  await applyMigrations(client,migrations);
  query.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const statement = parts.reduce((text,part,index) => text + (index ? `$${index}` : '') + part,'');
    if (statement.includes('select * from audience_record_event') && beforeCollection) {
      const callback = beforeCollection; beforeCollection = null; await callback();
    }
    return (await db.query(statement,values)).rows;
  });
}, 20_000);

beforeEach(async () => {
  await db.exec('truncate audience_consents cascade; delete from rate_limits;');
  await db.query('insert into app_schema_migrations(migration_key) values($1) on conflict do nothing',[AUDIENCE_SCHEMA_VERSION]);
  beforeCollection = null; query.mockClear(); requireAdmin.mockReset().mockResolvedValue({ id: uid() });
  vi.spyOn(console,'error').mockImplementation(() => {});
});
afterAll(async () => { vi.restoreAllMocks(); await db.close(); });

describe('first-party consent and event security', () => {
  it('reads an unknown choice without identifiers, cookie mutation, rate entry or DB request', async () => {
    const client = browser();
    const response = await consent(request('audience-consent'),client.context);
    expect(await response.json()).toEqual({ choice: null, version: '2026-09-14', expiresAt: null });
    expect(client.set).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
    expect((await collect(request('audience-events',event({ analytics: true })),client.context)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('stores opaque hashed consent only after a boolean choice, with fixed HttpOnly cookie lifetimes', async () => {
    const client = browser(); const response = await accept(client);
    const proof = (await rows('audience_consents'))[0];
    expect(proof.analytics).toBe(true); expect(proof.version).toBe('2026-09-14');
    expect(proof.receipt_hash).not.toBe(client.jar.get(COOKIE.receipt));
    expect(proof.receipt_hash).toBe(crypto.createHash('sha256').update(client.jar.get(COOKIE.receipt)!).digest('hex'));
    expect((+new Date(proof.expires_at) - +new Date(proof.created_at)) / 1000).toBe(CONSENT_SECONDS);
    for (const name of [COOKIE.receipt,COOKIE.visitor,COOKIE.session]) {
      expect(client.set.mock.calls.find(([item]: any) => item.name === name)?.[0]).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    }
    expect(await response.json()).toMatchObject({ choice: 'accepted' });
    client.set.mockClear();
    expect(await (await consent(request('audience-consent'),client.context)).json()).toMatchObject({ choice: 'accepted' });
    expect(client.set).not.toHaveBeenCalled();
    const report = await loadAudienceReport({ days: 7, device: 'all', source: 'all' });
    expect(report.totals.sessions).toBe(0); expect(report.filters.sources).toEqual([]);
  });

  it('rejects cross-origin, missing Origin, non-boolean, extra fields and oversized payloads before persistence', async () => {
    const client = browser();
    expect((await consent(request('audience-consent',{ analytics: true },{ origin: 'https://evil.example' }),client.context)).status).toBe(403);
    const noOrigin = request('audience-consent',{ analytics: true }); noOrigin.headers.delete('origin');
    expect((await consent(noOrigin,client.context)).status).toBe(403);
    for (const value of [{ analytics:'true' },{ analytics:true,advertising:true },{}]) expect((await consent(request('audience-consent',value),client.context)).status).toBe(400);
    expect((await consent(request('audience-consent',{ analytics:true,large:'a'.repeat(2048) }),client.context)).status).toBe(413);
    expect(await rows('audience_consents')).toEqual([]); expect(client.set).not.toHaveBeenCalled();
  });

  it('refuses forged receipts/visitors and expired server proof regardless of a client assertion', async () => {
    const client = browser(); await accept(client);
    const savedReceipt = client.jar.get(COOKIE.receipt)!; const savedVisitor = client.jar.get(COOKIE.visitor)!;
    client.jar.set(COOKIE.receipt,crypto.randomBytes(32).toString('base64url'));
    expect((await collect(request('audience-events',event()),client.context)).status).toBe(403);
    client.jar.set(COOKIE.receipt,savedReceipt); client.jar.set(COOKIE.visitor,uid());
    expect((await collect(request('audience-events',event()),client.context)).status).toBe(403);
    client.jar.set(COOKIE.visitor,savedVisitor);
    await db.exec("update audience_consents set expires_at = now() - interval '1 second'");
    expect((await collect(request('audience-events',event()),client.context)).status).toBe(403);
    expect(await rows('audience_pages')).toEqual([]);
  });

  it('withdraws collection, removes analytics cookies and rejects a request queued before withdrawal', async () => {
    const client = browser(); await accept(client);
    beforeCollection = async () => { await db.exec('update audience_consents set revoked_at = now()'); };
    expect((await collect(request('audience-events',event()),client.context)).status).toBe(403);
    expect(await rows('audience_pages')).toEqual([]);
    const response = await consent(request('audience-consent',{ analytics:false }),client.context);
    expect(response.status).toBe(200);
    expect(client.jar.has(COOKIE.visitor)).toBe(false); expect(client.jar.has(COOKIE.session)).toBe(false);
    expect(client.jar.get(COOKIE.optout)).toBe('1');
    expect((await rows('audience_consents')).find(row => !row.analytics)?.visitor_id).toBeNull();
    expect(await (await consent(request('audience-consent'),client.context)).json()).toMatchObject({ choice:'rejected' });
  });

  it('honors the immediate optout even before the refusal can reach storage', async () => {
    const client = browser(); await accept(client); client.jar.set(COOKIE.optout,'1'); query.mockClear();
    expect((await collect(request('audience-events',event()),client.context)).status).toBe(403);
    expect(await (await consent(request('audience-consent'),client.context)).json()).toMatchObject({ choice:'rejected' });
    expect(query).not.toHaveBeenCalled();
    await accept(client); expect(client.jar.has(COOKIE.optout)).toBe(false);
  });

  it('bounds rejection persistence while withdrawal still revokes an accepted proof at the limit', async () => {
    const client = browser(); await accept(client);
    await db.exec("update rate_limits set attempts = 30 where endpoint = 'audience-consent'");
    const response = await consent(request('audience-consent',{ analytics:false }),client.context);
    expect(response.status).toBe(429); expect(client.jar.get(COOKIE.optout)).toBe('1');
    expect((await rows('audience_consents'))[0].revoked_at).not.toBeNull();
    expect(await rows('audience_consents')).toHaveLength(1);
  });

  it('returns actionable migration failure without enabling analytics during a storage outage', async () => {
    const client = browser(); await db.query('delete from app_schema_migrations where migration_key=$1',[AUDIENCE_SCHEMA_VERSION]);
    const response = await consent(request('audience-consent',{ analytics:true }),client.context);
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ code:'AUDIENCE_SCHEMA_MISSING' });
    expect(client.jar.has(COOKIE.visitor)).toBe(false);
  });
});

describe('audience collection correctness', () => {
  it.each(['first_import', 'first_review'])('persists %s only with server consent and rejects every added business identifier', async (name) => {
    const client = browser();
    const view = event({ path: '/games?team=private-team&user=private-account&player=private-player&match=private-match' });
    const goal = { ...view, type: 'event', eventId: uid(), name };
    expect((await collect(request('audience-events', goal), client.context)).status).toBe(403);
    expect(await rows('audience_events')).toEqual([]);
    await accept(client);
    expect((await collect(request('audience-events', view), client.context)).status).toBe(200);
    for (const key of ['teamId', 'userId', 'accountId', 'playerId', 'matchId']) {
      expect((await collect(request('audience-events', { ...goal, [key]: 'private-id' }), client.context)).status).toBe(400);
    }
    expect((await collect(request('audience-events', goal), client.context)).status).toBe(200);
    await collect(request('audience-events', { ...goal, eventId: uid() }), client.context);
    expect((await rows('audience_pages'))[0].path).toBe('/games');
    expect((await rows('audience_events')).filter((entry) => entry.kind === 'event')).toHaveLength(1);
    const persisted = JSON.stringify([await rows('audience_sessions'), await rows('audience_pages'), await rows('audience_events')]);
    expect(persisted).not.toMatch(/private-|team_id|user_id|account_id|player_id|match_id/);
    await consent(request('audience-consent', { analytics: false }), client.context);
    expect((await collect(request('audience-events', { ...goal, eventId: uid() }), client.context)).status).toBe(403);
  });

  it('reports activation objectives separately from historical acquisition conversions after applying the expanded event constraint', async () => {
    const client = browser(); await accept(client);
    const view = event({ path: '/games' });
    await collect(request('audience-events', view), client.context);
    for (const name of ['first_import', 'first_review']) {
      expect((await collect(request('audience-events', { ...view, type: 'event', eventId: uid(), name }), client.context)).status).toBe(200);
    }
    const report = await loadAudienceReport({ days: 7, device: 'all', source: 'all' });
    expect(report.pages).toContainEqual(expect.objectContaining({ path: '/games', views: 1 }));
    expect(report.goals.map((goal: any) => goal.name)).toEqual(GOALS);
    for (const name of ['first_import', 'first_review']) expect(report.goals.find((goal: any) => goal.name === name)).toMatchObject({ events: 1, sessions: 1, conversionRate: 100 });
    expect(report.totals).toMatchObject({ sessions: 1, conversions: 0, conversionRate: 0 });
    expect(report.timeseries.reduce((sum: number, day: any) => sum + day.conversions, 0)).toBe(0);
    const migrations = await db.query("select migration_key from app_schema_migrations where migration_key='audience-activation-20260928-v1'");
    expect(migrations.rows).toHaveLength(1);
    await expect(db.query("update audience_events set name='unsupported_event' where kind='event'")).rejects.toMatchObject({ code: '23514' });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(client.jar.get(COOKIE.visitor));
    expect(serialized).not.toContain((await rows('audience_sessions'))[0].id);
  });

  it('deduplicates views, goals and heartbeats; cumulative engagement never adds a retry twice', async () => {
    const client = browser(); await accept(client); const view = event();
    expect((await collect(request('audience-events',view),client.context)).status).toBe(200);
    await collect(request('audience-events',view),client.context);
    await collect(request('audience-events',{ ...view,eventId:uid() }),client.context);
    expect(await rows('audience_pages')).toHaveLength(1);
    await db.exec("update audience_pages set viewed_at = now() - interval '2 minutes'");
    const heartbeat = { ...view,type:'engagement',eventId:uid(),durationSeconds:45,scrollDepth:60 };
    await collect(request('audience-events',heartbeat),client.context);
    const seen = (await rows('audience_sessions'))[0].last_seen_at;
    await collect(request('audience-events',heartbeat),client.context);
    expect((await rows('audience_sessions'))[0].last_seen_at).toEqual(seen);
    await collect(request('audience-events',{ ...heartbeat,eventId:uid(),durationSeconds:20,scrollDepth:10 }),client.context);
    expect((await rows('audience_pages'))[0]).toMatchObject({ duration_seconds:45,scroll_depth:60 });
    const goal = { ...view,type:'event',eventId:uid(),name:'signup' };
    await collect(request('audience-events',goal),client.context);
    await collect(request('audience-events',{ ...goal,eventId:uid() }),client.context);
    const report = await loadAudienceReport({ days:7,device:'all',source:'all' });
    expect(report.totals).toMatchObject({ visitors:1,sessions:1,pageviews:1,engagedSessions:1,conversions:1,avgDurationSeconds:45,conversionRate:100 });
    expect(report.goals.find((item: any) => item.name === 'signup')).toMatchObject({ events:1,sessions:1,conversionRate:100 });
  });

  it('enforces route/event/duration bounds and strips query strings and personal campaign/referrer payloads', async () => {
    const client = browser(); await accept(client);
    for (const bad of [{ path:'/admin' },{ path:'/tarifs?email=secret' },{ path:'/admin/tarifs' },{ path:'/reinitialiser-mot-de-passe?token=secret' },{ path:'/mon-profil/private-id' },{ type:'event',name:'arbitrary' },{ type:'engagement',durationSeconds:86401 },{ type:'engagement',scrollDepth:-1 }]) {
      expect((await collect(request('audience-events',event(bad)),client.context)).status).toBe(400);
    }
    const response = await collect(request('audience-events',event({ path:'/soutenir?email=alice@example.com#secret',source:'alice@example.com',medium:'paid_social',campaign:'newsletter-septembre',referrer:'https://private.example/alice' })),client.context);
    expect(response.status).toBe(200); expect((await rows('audience_pages'))[0].path).toBe('/soutenir');
    expect((await rows('audience_sessions'))[0]).toMatchObject({ source:'direct',medium:'paid_social',campaign:'newsletter-septembre',device:'desktop',browser:'Chrome',country:'FR' });
    const persisted = JSON.stringify([await rows('audience_consents'),await rows('audience_sessions'),await rows('audience_pages'),await rows('audience_events')]);
    expect(persisted).not.toContain('alice'); expect(persisted).not.toContain('198.51.100.42'); expect(persisted).not.toContain('TestPrivateAgent');
  });

  it('recovers an expired same-page session explicitly without assigning old engagement to a new session', async () => {
    const client = browser(); await accept(client); const view = event();
    await collect(request('audience-events',view),client.context);
    const previousToken = client.jar.get(COOKIE.session);
    await db.exec("update audience_sessions set last_seen_at = now() - interval '31 minutes'");
    const expired = await collect(request('audience-events',{ ...view,eventId:uid(),type:'engagement',durationSeconds:10 }),client.context);
    expect(expired.status).toBe(409); expect(await expired.json()).toMatchObject({ code:'AUDIENCE_SESSION_EXPIRED' });
    expect((await collect(request('audience-events',event()),client.context)).status).toBe(200);
    expect(client.jar.get(COOKIE.session)).not.toBe(previousToken); expect(await rows('audience_sessions')).toHaveLength(2);
  });

  it('skips known bots and keeps the IP only as a one-way security budget subject', async () => {
    const client = browser(); await accept(client);
    expect(await (await collect(request('audience-events',event(),{ 'user-agent':'Googlebot' }),client.context)).json()).toMatchObject({ ignored:true });
    expect(await rows('audience_pages')).toEqual([]);
    expect(JSON.stringify(await rows('rate_limits'))).not.toContain(client.context.ip);
  });

  it('excludes an authenticated platform administrator without storing an account relationship', async () => {
    const client = browser(); await accept(client);
    const userId = uid(); const rawAuth = crypto.randomBytes(48).toString('base64url');
    await db.query('insert into users(id,account_name,name,password_hash) values($1,$2,$3,$4)',[userId,`audience-${userId}`,'Audience admin','hash']);
    await db.query("insert into sessions(user_id,token_hash,expires_at) values($1,$2,now()+interval '1 day')",[userId,crypto.createHash('sha256').update(rawAuth).digest('hex')]);
    client.jar.set('rb_session',rawAuth);
    vi.stubEnv('PLATFORM_ADMIN_USER_ID',userId); vi.stubEnv('PLATFORM_ADMIN_EMAIL','');
    try {
      const response = await collect(request('audience-events',event()),client.context);
      expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok:true,ignored:true });
      expect(await rows('audience_pages')).toEqual([]);
      expect(JSON.stringify(await rows('audience_sessions'))).not.toContain(userId);
    } finally { vi.unstubAllEnvs(); }
  });

  it('applies a per-receipt collection budget before writing additional events', async () => {
    const client = browser(); await accept(client);
    await collect(request('audience-events',event()),client.context);
    await db.exec("update rate_limits set attempts = 120 where endpoint = 'audience-events-receipt'");
    const response = await collect(request('audience-events',event()),client.context);
    expect(response.status).toBe(429); expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await rows('audience_pages')).toHaveLength(1);
  });
});

describe('server-recorded registration audience goals', () => {
  const registrationRequest = () => request('auth-register', {
    email: 'private-registration@example.test', displayName: 'Private registration', password: 'private-registration-password'
  });
  async function measuredClient() {
    const client = browser();
    await accept(client);
    await collect(request('audience-events', event({ path: '/demo', source: 'youtube', medium: 'paid_video', campaign: 'teaser_oct2026' })), client.context);
    client.set.mockClear();
    return client;
  }

  async function authenticate(client: ReturnType<typeof browser>) {
    const userId = uid(); const rawAuth = crypto.randomBytes(48).toString('base64url');
    await db.query('insert into users(id,account_name,name,password_hash) values($1,$2,$3,$4)', [userId, `registration-${userId}`, 'Private registration', 'hash']);
    await db.query("insert into sessions(user_id,token_hash,expires_at) values($1,$2,now()+interval '1 day')", [userId, crypto.createHash('sha256').update(rawAuth).digest('hex')]);
    client.jar.set('rb_session', rawAuth);
    return userId;
  }

  it('attributes a deduplicated signup to the existing campaign without new pages, cookies or account identifiers', async () => {
    const client = await measuredClient();
    await db.exec("update audience_pages set last_seen_at=now()-interval '1 minute',viewed_at=now()-interval '1 minute'");
    const signupPage = event({ path: '/creer-un-compte' });
    await collect(request('audience-events', signupPage), client.context);
    const userId = await authenticate(client);
    const cookiesBefore = [...client.jar]; client.set.mockClear();
    await expect(recordRegistrationSignup(registrationRequest(), client.context)).resolves.toBeUndefined();
    await recordRegistrationSignup(registrationRequest(), client.context);
    expect((await rows('audience_events')).filter(row => row.name === 'signup')).toHaveLength(1);
    expect(client.set).not.toHaveBeenCalled();
    await collect(request('audience-events', { ...signupPage, type: 'event', eventId: uid(), name: 'signup' }), client.context);
    const goals = (await rows('audience_events')).filter(row => row.name === 'signup');
    expect(goals).toHaveLength(1); expect(goals[0].page_id).toBe(signupPage.pageId);
    expect(await rows('audience_sessions')).toHaveLength(1); expect(await rows('audience_pages')).toHaveLength(2);
    const report = await loadAudienceReport({ days: 7, device: 'all', source: 'youtube' });
    expect(report.totals).toMatchObject({ sessions: 1, pageviews: 2, conversions: 1, conversionRate: 100 });
    expect(report.campaigns).toEqual([{ source: 'youtube', medium: 'paid_video', campaign: 'teaser_oct2026', sessions: 1, conversions: 1 }]);
    expect(report.goals.find((goal: any) => goal.name === 'signup')).toMatchObject({ events: 1, sessions: 1, conversionRate: 100 });
    expect([...client.jar]).toEqual(cookiesBefore);
    const stored = JSON.stringify([await rows('audience_consents'), await rows('audience_sessions'), await rows('audience_pages'), await rows('audience_events'), report]);
    expect(stored).not.toContain(userId);
    expect(stored).not.toMatch(/private-registration|Private registration|user_id|account_id/);
  });

  it.each(['unknown', 'refused', 'optout'])('does not collect a signup for %s consent or create identifiers', async (choice) => {
    const client = choice === 'optout' ? await measuredClient() : browser();
    if (choice === 'refused') await consent(request('audience-consent', { analytics: false }), client.context);
    if (choice === 'optout') client.jar.set(COOKIE.optout, '1');
    const eventsBefore = await rows('audience_events');
    const cookiesBefore = [...client.jar]; client.set.mockClear(); query.mockClear();
    await expect(recordRegistrationSignup(registrationRequest(), client.context)).resolves.toBeUndefined();
    expect(await rows('audience_events')).toEqual(eventsBefore);
    expect([...client.jar]).toEqual(cookiesBefore); expect(client.set).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['revoked', 'expired', 'rejected'])('rechecks %s server consent even with intact audience cookies', async (state) => {
    const client = await measuredClient();
    if (state === 'revoked') await db.exec('update audience_consents set revoked_at=now()');
    if (state === 'expired') await db.exec("update audience_consents set expires_at=now()-interval '1 second'");
    if (state === 'rejected') await db.exec('update audience_consents set analytics=false');
    const eventsBefore = await rows('audience_events');
    await expect(recordRegistrationSignup(registrationRequest(), client.context)).resolves.toBeUndefined();
    expect(await rows('audience_events')).toEqual(eventsBefore);
    expect(client.set).not.toHaveBeenCalled();
  });

  it.each([COOKIE.receipt, COOKIE.visitor, COOKIE.session])('rejects a mismatched %s cookie without attributing another session', async (name) => {
    const client = await measuredClient();
    const other = browser('198.51.100.43'); await accept(other);
    await collect(request('audience-events', event({ source: 'discord' })), other.context);
    client.jar.set(name, other.jar.get(name)!);
    const eventsBefore = await rows('audience_events');
    await expect(recordRegistrationSignup(registrationRequest(), client.context)).resolves.toBeUndefined();
    expect(await rows('audience_events')).toEqual(eventsBefore);
    expect((await loadAudienceReport({ days: 7, device: 'all', source: 'all' })).totals.conversions).toBe(0);
    expect(client.set).not.toHaveBeenCalled();
  });

  it.each(['expired', 'without a page'])('does not revive a session that is %s or fabricate a page', async (state) => {
    const client = state === 'expired' ? await measuredClient() : browser();
    if (state === 'expired') await db.exec("update audience_sessions set last_seen_at=now()-interval '31 minutes'");
    else { await accept(client); client.set.mockClear(); }
    const before = { sessions: await rows('audience_sessions'), pages: await rows('audience_pages'), events: await rows('audience_events') };
    await expect(recordRegistrationSignup(registrationRequest(), client.context)).resolves.toBeUndefined();
    expect({ sessions: await rows('audience_sessions'), pages: await rows('audience_pages'), events: await rows('audience_events') }).toEqual(before);
    expect(client.set).not.toHaveBeenCalled();
  });

  it.each(['bot', 'administrator'])('excludes a %s even when its browser already has a measured page', async (kind) => {
    const client = await measuredClient();
    const userId = kind === 'administrator' ? await authenticate(client) : null;
    if (userId) { vi.stubEnv('PLATFORM_ADMIN_USER_ID', userId); vi.stubEnv('PLATFORM_ADMIN_EMAIL', ''); }
    try {
      const signup = registrationRequest();
      if (kind === 'bot') signup.headers.set('user-agent', 'Googlebot');
      const eventsBefore = await rows('audience_events');
      await expect(recordRegistrationSignup(signup, client.context)).resolves.toBeUndefined();
      expect(await rows('audience_events')).toEqual(eventsBefore);
      expect(client.set).not.toHaveBeenCalled();
      if (userId) expect(JSON.stringify(await rows('audience_sessions'))).not.toContain(userId);
    } finally { vi.unstubAllEnvs(); }
  });

  it('honors withdrawal after the page lookup and before the atomic collector', async () => {
    const client = await measuredClient();
    const eventsBefore = await rows('audience_events');
    beforeCollection = async () => { await db.exec('update audience_consents set revoked_at=now()'); };
    await expect(recordRegistrationSignup(registrationRequest(), client.context)).resolves.toBeUndefined();
    expect(beforeCollection).toBeNull();
    expect(await rows('audience_events')).toEqual(eventsBefore);
    expect(client.set).not.toHaveBeenCalled();
  });

  it.each(['missing migration', 'collector failure'])('keeps %s non-blocking and excludes private error details from logs', async (failure) => {
    const client = await measuredClient();
    const privateUserId = uid();
    if (failure === 'missing migration') await db.query('delete from app_schema_migrations where migration_key=$1', [AUDIENCE_SCHEMA_VERSION]);
    else beforeCollection = async () => { throw Object.assign(new Error(`private-registration@example.test ${privateUserId}`), { code: 'XX000', detail: privateUserId, parameters: ['private-registration-password'] }); };
    const eventsBefore = await rows('audience_events');
    vi.mocked(console.error).mockClear();
    await expect(recordRegistrationSignup(registrationRequest(), client.context)).resolves.toBeUndefined();
    expect(await rows('audience_events')).toEqual(eventsBefore);
    expect(client.set).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logs).not.toContain(privateUserId); expect(logs).not.toContain('private-registration');
  });
});

describe('administrator audience reports', () => {
  it.each([401,403])('protects aggregates before any audience query (%s)',async status => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Denied'),{ status }));
    expect((await dashboard(request('admin-audience'),browser().context)).status).toBe(status);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns real zeros and complete UTC daily bins when empty, including a comparable preceding span', async () => {
    const response = await dashboard(request('admin-audience?days=7'),browser().context);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    const report = await response.json();
    expect(Object.values(report.totals)).toEqual(Array(11).fill(0));
    expect(report.timeseries).toHaveLength(7); expect(report.goals.map((goal: any) => goal.name)).toEqual(GOALS);
    expect(report.realtime).toEqual({ visitors:0,sessions:0,windowMinutes:5,pages:[] });
    expect(audiencePeriod(7,new Date('2026-09-14T23:45:00Z'))).toMatchObject({ period:{ from:'2026-09-08',to:'2026-09-14',days:7,timezone:'UTC' },comparison:{ from:'2026-09-01',to:'2026-09-07' } });
  });

  it('applies device/source filters and does not count pricing views or login as conversions', async () => {
    const desktop = browser('198.51.100.1'); const mobile = browser('198.51.100.2');
    await accept(desktop); await accept(mobile);
    const first = event({ source:'newsletter' });
    await collect(request('audience-events',first),desktop.context);
    for (const name of ['pricing_view','login']) await collect(request('audience-events',{ ...first,type:'event',eventId:uid(),name }),desktop.context);
    const second = event({ source:'discord' });
    await collect(request('audience-events',second,{ 'user-agent':'iPhone Mobile Safari' }),mobile.context);
    await collect(request('audience-events',{ ...second,type:'event',eventId:uid(),name:'access_request' }),mobile.context);
    const full = await loadAudienceReport({ days:7,device:'all',source:'all' });
    expect(full.totals).toMatchObject({ visitors:2,sessions:2,pageviews:2,conversions:1,conversionRate:50,bounceRate:50 });
    const selected = await loadAudienceReport({ days:7,device:'desktop',source:'newsletter' });
    expect(selected.totals).toMatchObject({ visitors:1,sessions:1,pageviews:1,conversions:0 });
    expect(selected.realtime.visitors).toBe(1); expect(selected.filters.sources).toEqual(['newsletter']);
    expect((await dashboard(request('admin-audience?days=500'),desktop.context)).status).toBe(400);
  });

  it('allocates cross-midnight activity to its actual period and deduplicates visitors across daily bins', async () => {
    const client = browser(); await accept(client); const first = event();
    await collect(request('audience-events',first),client.context);
    const sessionId = (await rows('audience_sessions'))[0].id;
    const secondPage = uid();
    await db.query("update audience_sessions set started_at='2026-09-07T23:58:00Z',last_seen_at='2026-09-14T11:59:00Z' where id=$1",[sessionId]);
    await db.query("update audience_pages set viewed_at='2026-09-07T23:58:00Z' where session_id=$1",[sessionId]);
    await db.query("update audience_events set created_at='2026-09-07T23:58:00Z' where session_id=$1",[sessionId]);
    await db.query("insert into audience_pages(session_id,page_id,path,viewed_at) values($1,$2,'/tarifs','2026-09-08T00:03:00Z')",[sessionId,secondPage]);
    await db.query("insert into audience_events(event_id,session_id,page_id,kind,name,created_at) values($1,$2,$3,'pageview','','2026-09-08T00:03:00Z'),($4,$2,$3,'event','signup','2026-09-08T00:04:00Z')",[uid(),sessionId,secondPage,uid()]);
    await db.query("insert into audience_events(event_id,session_id,page_id,kind,name,duration_delta,created_at) values($1,$2,$3,'engagement','',15,'2026-09-09T00:04:00Z')",[uid(),sessionId,secondPage]);
    const report = await loadAudienceReport({ days:7,device:'all',source:'all' },new Date('2026-09-14T12:00:00Z'));
    expect(report.totals).toMatchObject({ visitors:1,sessions:1,pageviews:1,conversions:1,returningVisitors:1,avgDurationSeconds:15 });
    expect(report.previous).toMatchObject({ visitors:1,sessions:1,pageviews:1,conversions:0,avgDurationSeconds:0 });
    expect(report.timeseries[0]).toMatchObject({ date:'2026-09-08',visitors:1,sessions:1,pageviews:1,conversions:1 });
    expect(report.timeseries[1]).toMatchObject({ date:'2026-09-09',visitors:1,sessions:1,pageviews:0,conversions:0 });
    expect(report.pages).toHaveLength(1); expect(report.pages[0]).toMatchObject({ path:'/tarifs',views:1 });
    expect(report.heatmap.reduce((total: number,row: any) => total + row.pageviews,0)).toBe(1);
    const exposed = JSON.stringify(report); expect(exposed).not.toContain(sessionId); expect(exposed).not.toContain(client.jar.get(COOKIE.visitor));
  });

  it('purges expired identifiers and their dependent measurements with the scheduled retention job', async () => {
    const client = browser(); await accept(client); await collect(request('audience-events',event()),client.context);
    await db.exec("update audience_consents set created_at=now()-interval '181 days',expires_at=now()-interval '1 day'");
    expect((await cleanup(request('audience-cleanup'))).status).toBe(200);
    expect(await rows('audience_consents')).toEqual([]); expect(await rows('audience_sessions')).toEqual([]); expect(await rows('audience_events')).toEqual([]);
    expect(config.schedule).toBe('35 3 * * *');
  });

  it('shares strict path and campaign sanitizers with the client', () => {
    expect(canonicalAudiencePath('/games?team=secret&match=private')).toBe('/games');
    expect(canonicalAudiencePath('/demo?user=secret')).toBe('/demo');
    expect(canonicalAudiencePath('/guides/importer-premier-scrim#download')).toBe('/guides/importer-premier-scrim');
    expect(canonicalAudiencePath('/guides/preparer-debrief?user=secret')).toBe('/guides/preparer-debrief');
    expect(canonicalAudiencePath('/guides/nonexistent')).toBeNull();
    expect(canonicalAudiencePath('/mon-profil/champions?user=secret#private')).toBe('/mon-profil/champions');
    expect(canonicalAudiencePath('/fonctionnalites?utm_source=search#coaching')).toBe('/fonctionnalites');
    expect(canonicalAudiencePath('/admin/audience')).toBeNull(); expect(canonicalAudiencePath('/verify-email?token=private')).toBeNull();
    expect(canonicalAudiencePath('//evil.example/')).toBeNull(); expect(sanitizeCampaignValue('Alice@example.com')).toBe('');
    expect(sanitizeCampaignValue('campaign-123456789')).toBe(''); expect(sanitizeCampaignValue('Discord_September')).toBe('discord_september');
  });
});
