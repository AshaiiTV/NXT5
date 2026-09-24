import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, admin: vi.fn(), request: vi.fn(), guild: vi.fn(), rate: vi.fn(), failReceipt: false }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: async (query: string, params: any[] = []) => {
  if (state.failReceipt && query.includes("set status='sent'")) { state.failReceipt = false; throw new Error('Storage unavailable'); }
  return (await state.pg.query(query, params)).rows;
} }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: state.admin }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: state.rate }));
vi.mock('../../netlify/functions/_lib/discord-client', () => ({ discordRequest: state.request, getDiscordGuild: state.guild }));

import endpoint from '../../netlify/functions/admin-discord-announcements';
import { COMMUNITY_SCHEMA } from '../../netlify/functions/_lib/discord-community-announcements';

const app = '1551574937159073792', bot = '1551574937159073793', guild = '1509552311972790332';
const channel = '1509552311972790333', otherChannel = '1509552311972790334';
const admin = '00000000-0000-4000-8000-000000000001';
const content = '**NXT5**\n\nUne annonce @everyone, <@&123456789012345678>.\n';
const reference = 'patch-2026-09-24';
const context = { deploy: { context: 'production' } } as any;
const messages: any[] = [];
const rows = async (query: string, params: any[] = []) => (await state.pg.query(query, params)).rows as any[];
function request(body?: any, origin = 'https://nxt5.test') {
  return new Request('https://nxt5.test/.netlify/functions/admin-discord-announcements', body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  } : {});
}
async function call(body?: any, ctx = context) {
  const response = await endpoint(request(body), ctx);
  return { status: response.status, body: await response.json() };
}
async function configure() { expect((await call({ action: 'configure', channelId: channel })).status).toBe(200); }
async function preview(text = content, ref = reference) {
  const response = await call({ action: 'preview', content: text, reference: ref });
  expect(response.status).toBe(200);
  return { action: 'publish', content: text, reference: ref, previewToken: response.body.previewToken };
}
function mutations() { return state.request.mock.calls.filter(([, options]) => options?.method === 'POST'); }

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec('create table users(id uuid primary key); create table app_schema_migrations(migration_key text primary key)');
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260924_discord_community_announcements.sql', import.meta.url), 'utf8'));
  await rows('insert into app_schema_migrations values($1)', [COMMUNITY_SCHEMA]);
  await rows('insert into users values($1)', [admin]);
}, 30_000);
afterAll(async () => state.pg?.close());
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
beforeEach(async () => {
  await state.pg.exec('truncate discord_community_announcements,discord_community_settings');
  for (const [key, value] of Object.entries({ PUBLIC_SITE_URL: 'https://nxt5.test', DISCORD_APPLICATION_ID: app,
    DISCORD_BOT_TOKEN: 'test-only-token', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'b'.repeat(40),
    DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_COMMUNITY_GUILD_ID: '', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  messages.length = 0; state.failReceipt = false;
  state.admin.mockReset().mockResolvedValue({ id: admin }); state.rate.mockReset();
  state.guild.mockReset().mockResolvedValue({ guild: { id: guild, name: 'NXT5' }, channels: [
    { id: channel, name: 'annonces', canSend: true }, { id: otherChannel, name: 'contact', canSend: true },
  ] });
  state.request.mockReset().mockImplementation(async (path, options = {}) => {
    if (path === '/users/@me') return { id: bot, bot: true };
    if (path === '/applications/@me') return { id: app, bot: { id: bot } };
    if (options.method === 'POST') {
      const message = { ...options.body, id: '1600000000000000001', channel_id: channel, author: { id: bot } };
      messages.push(message); return message;
    }
    if (path.endsWith('messages?limit=100')) return messages;
    if (path.includes('/messages/')) return messages.find(item => path.endsWith('/' + item.id));
    throw new Error('Unexpected mocked Discord request');
  });
});

describe('community announcements: real SQL, simulated Discord only', () => {
  it('requires platform administration and trusted mutations before reading Discord', async () => {
    state.admin.mockRejectedValue(Object.assign(new Error('Accès refusé'), { status: 403, code: 'PLATFORM_ADMIN_FORBIDDEN' }));
    expect((await call()).status).toBe(403);
    expect((await call({ action: 'configure', channelId: channel })).status).toBe(403);
    expect(state.request).not.toHaveBeenCalled(); expect(state.guild).not.toHaveBeenCalled();
    state.admin.mockResolvedValue({ id: admin });
    expect((await endpoint(request({ action: 'configure', channelId: channel }, 'https://evil.test'), context)).status).toBe(403);
    expect(state.guild).not.toHaveBeenCalled();
  });

  it.each(['deploy-preview', 'branch-deploy', 'dev', 'unknown'])('refuses %s for reads and writes without Discord traffic', async deploy => {
    const ctx = { deploy: { context: deploy } } as any;
    expect((await call(undefined, ctx)).status).toBe(409);
    expect((await call({ action: 'configure', channelId: channel }, ctx)).status).toBe(409);
    expect(state.request).not.toHaveBeenCalled(); expect(state.guild).not.toHaveBeenCalled();
  });

  it('fails closed on disabled publishing, a missing schema, or a missing invocation context', async () => {
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'false'); expect((await call()).status).toBe(409);
    expect(state.request).not.toHaveBeenCalled();
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'true');
    await rows('delete from app_schema_migrations where migration_key=$1', [COMMUNITY_SCHEMA]);
    try { expect((await call()).body.code).toBe('DISCORD_COMMUNITY_SCHEMA_REQUIRED'); }
    finally { await rows('insert into app_schema_migrations values($1)', [COMMUNITY_SCHEMA]); }
    expect((await call(undefined, {} as any)).status).toBe(409); expect(state.request).not.toHaveBeenCalled();
  });

  it('lists only public metadata, configures the destination, and previews exact text without sending', async () => {
    const overview = await call(); expect(overview.body.channelId).toBeNull(); expect(overview.body.channels).toHaveLength(2);
    await configure(); const payload = await preview();
    expect(typeof payload.previewToken).toBe('string'); expect(payload.content).toBe(content);
    expect((await rows('select * from discord_community_announcements')).length).toBe(0);
    expect(mutations()).toHaveLength(0);
    expect(JSON.stringify(overview.body)).not.toMatch(/test-only-token|bbbbbbbb|publicKey|workerSecret/);
  });

  it('rejects wrong application, bot identity, server and unavailable channels', async () => {
    state.request.mockResolvedValueOnce({ id: bot, bot: true }).mockResolvedValueOnce({ id: otherChannel, bot: { id: bot } });
    expect((await call()).body.code).toBe('DISCORD_APPLICATION_MISMATCH');
    state.request.mockResolvedValueOnce({ id: bot, bot: true }).mockResolvedValueOnce({ id: app, bot: { id: otherChannel } });
    expect((await call()).body.code).toBe('DISCORD_APPLICATION_MISMATCH');
    state.guild.mockResolvedValueOnce({ guild: { id: otherChannel }, channels: [] });
    expect((await call()).body.code).toBe('DISCORD_COMMUNITY_GUILD_MISMATCH');
    expect((await call({ action: 'configure', channelId: '999999999999999999' })).status).toBe(409);
    state.guild.mockResolvedValueOnce({ guild: { id: guild }, channels: [{ id: channel, canSend: false }] });
    expect((await call({ action: 'configure', channelId: channel })).status).toBe(409);
    expect(mutations()).toHaveLength(0);
  });

  it('validates lengths and references without silently truncating or modifying Markdown', async () => {
    await configure();
    for (const text of ['', '  ', 'a'.repeat(4097), '\u0000']) expect((await call({ action: 'preview', content: text, reference })).status).toBe(400);
    for (const ref of ['', 'x'.repeat(81), '../test', 'ref with spaces']) expect((await call({ action: 'preview', content, reference: ref })).status).toBe(400);
    await preview('a'.repeat(4096)); expect(mutations()).toHaveLength(0);
  });

  it('binds preview tokens to the content, user, destination, configuration and expiration', async () => {
    await configure(); const payload = await preview();
    expect((await call({ ...payload, content: 'Changed' })).body.code).toBe('DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
    expect((await call({ ...payload, previewToken: payload.previewToken + 'a' })).status).toBe(409);
    state.admin.mockResolvedValueOnce({ id: '00000000-0000-4000-8000-000000000009' });
    expect((await call(payload)).status).toBe(409);
    const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60_000);
    expect((await call(payload)).status).toBe(409); clock.mockRestore();
    await configure(); expect((await call(payload)).status).toBe(409);
    expect(mutations()).toHaveLength(0);
  });

  it('sends one embed with no mentions, returns a verified receipt, and does not duplicate repeated requests', async () => {
    await configure(); const payload = await preview();
    const first = await call(payload); const repeated = await call(payload);
    expect(first.body).toMatchObject({ status: 'sent', reference, verified: true });
    expect(repeated.body.messageUrl).toBe(first.body.messageUrl); expect(mutations()).toHaveLength(1);
    const sent = mutations()[0][1].body;
    expect(sent.embeds).toEqual([{ description: content, color: 0x67e8f9, footer: { text: 'NXT5 · ' + reference } }]);
    expect(sent.allowed_mentions).toEqual({ parse: [], users: [], roles: [], replied_user: false });
    expect(sent.nonce).toMatch(/^[a-f0-9]{24}$/); expect(sent.enforce_nonce).toBe(true);
    expect((await call()).body.announcements).toEqual([expect.objectContaining({ reference, status: 'sent', messageUrl: first.body.messageUrl })]);
    expect(state.request.mock.calls.some(([path]) => path.includes('crosspost'))).toBe(false);
  });

  it('keeps reference identity immutable in the API and database', async () => {
    await configure(); const payload = await preview(); await call(payload);
    expect((await call({ action: 'preview', reference, content: 'Different' })).status).toBe(409);
    await call({ action: 'configure', channelId: otherChannel });
    expect((await call({ action: 'preview', reference, content })).status).toBe(409);
    await expect(rows('update discord_community_announcements set content=$1 where reference=$2', ['Different', reference])).rejects.toThrow('immutable');
    expect(mutations()).toHaveLength(1);
  });

  it('claims concurrently without emitting a second Discord message', async () => {
    await configure(); const payload = await preview();
    const base = state.request.getMockImplementation()!;
    let release!: () => void; let entered!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST') { entered(); await waiting; }
      return base(path, options);
    });
    const first = call(payload); await started;
    const second = await call(payload); expect(second.body.status).toBe('uncertain');
    release(); expect((await first).body.status).toBe('sent');
    expect(mutations()).toHaveLength(1); expect((await rows('select status from discord_community_announcements'))[0].status).toBe('sent');
  });

  it('never retries an uncertain send, even after preview expiry, and reconciles only matching bot content', async () => {
    await configure(); const payload = await preview();
    const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST') throw Object.assign(new Error('Timeout'), { ambiguous: true });
      return base(path, options);
    });
    expect((await call(payload)).body.status).toBe('uncertain');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    expect((await call(payload)).body.status).toBe('uncertain');
    messages.push({ id: '1600000000000000001', channel_id: channel, author: { id: otherChannel }, embeds: [{ description: content, footer: { text: 'NXT5 · ' + reference } }] });
    expect((await call(payload)).body.status).toBe('uncertain');
    messages[0].author.id = bot; messages[0].embeds[0].description = 'Other content';
    expect((await call(payload)).body.status).toBe('uncertain');
    messages[0].embeds[0].description = content;
    expect((await call(payload)).body.status).toBe('sent'); expect(mutations()).toHaveLength(1); clock.mockRestore();
  });

  it('keeps a durable uncertain record when saving a successful delivery fails, then recovers without posting', async () => {
    await configure(); const payload = await preview(); state.failReceipt = true;
    expect((await call(payload)).body.status).toBe('uncertain');
    expect((await call(payload)).body.status).toBe('sent'); expect(mutations()).toHaveLength(1);
  });

  it('recovers a recorded send after configuration changes or expired preview without its original text/token', async () => {
    await configure(); const payload = await preview(); state.failReceipt = true;
    expect((await call(payload)).body.status).toBe('uncertain');
    await call({ action: 'configure', channelId: otherChannel });
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    const recovered = await call({ action: 'recover', reference });
    expect(recovered.body.status).toBe('sent'); expect(recovered.body.messageUrl).toContain('/' + channel + '/');
    expect(mutations()).toHaveLength(1);
    expect((await call({ action: 'recover', reference: 'absent' })).status).toBe(404);
    clock.mockRestore();
  });

  it('allows only explicit retry after a definite refusal and rechecks current permissions', async () => {
    await configure(); const payload = await preview(); const base = state.request.getMockImplementation()!;
    let refused = false;
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST' && !refused) { refused = true; throw Object.assign(new Error('Forbidden'), { status: 403, code: 'DISCORD_FORBIDDEN' }); }
      return base(path, options);
    });
    expect((await call(payload)).status).toBe(403);
    expect((await rows('select status from discord_community_announcements'))[0].status).toBe('failed');
    state.guild.mockResolvedValueOnce({ guild: { id: guild }, channels: [{ id: channel, canSend: false }] });
    expect((await call(payload)).status).toBe(409); expect(mutations()).toHaveLength(1);
    expect((await call(payload)).body.status).toBe('sent'); expect(mutations()).toHaveLength(2);
  });
});
