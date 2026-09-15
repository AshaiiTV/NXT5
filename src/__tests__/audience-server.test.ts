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
import { AUDIENCE_SCHEMA_VERSION, COOKIE, CONSENT_SECONDS } from '../../netlify/functions/_lib/audience';
import { audiencePeriod, loadAudienceReport } from '../../netlify/functions/_lib/audience-report';
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
    for (const bad of [{ path:'/admin' },{ path:'/reinitialiser-mot-de-passe?token=secret' },{ path:'/mon-profil/private-id' },{ type:'event',name:'arbitrary' },{ type:'engagement',durationSeconds:86401 },{ type:'engagement',scrollDepth:-1 }]) {
      expect((await collect(request('audience-events',event(bad)),client.context)).status).toBe(400);
    }
    const response = await collect(request('audience-events',event({ path:'/tarifs?email=alice@example.com#secret',source:'alice@example.com',medium:'paid_social',campaign:'newsletter-septembre',referrer:'https://private.example/alice' })),client.context);
    expect(response.status).toBe(200); expect((await rows('audience_pages'))[0].path).toBe('/tarifs');
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
    expect(report.timeseries).toHaveLength(7); expect(report.goals).toHaveLength(4);
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
    expect(canonicalAudiencePath('/mon-profil/champions?user=secret#private')).toBe('/mon-profil/champions');
    expect(canonicalAudiencePath('/admin/audience')).toBeNull(); expect(canonicalAudiencePath('/verify-email?token=private')).toBeNull();
    expect(canonicalAudiencePath('//evil.example/')).toBeNull(); expect(sanitizeCampaignValue('Alice@example.com')).toBe('');
    expect(sanitizeCampaignValue('campaign-123456789')).toBe(''); expect(sanitizeCampaignValue('Discord_September')).toBe('discord_september');
  });
});
