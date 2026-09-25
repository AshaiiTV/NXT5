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
const secondGuild = '1509552311972790342', thirdGuild = '1509552311972790352';
const channel = '1509552311972790333', otherChannel = '1509552311972790334', secondChannel = '1509552311972790343';
const thirdChannel = '1509552311972790353';
const admin = '00000000-0000-4000-8000-000000000001';
const content = '**NXT5**\n\nUne annonce @everyone, <@&123456789012345678>.\n';
const reference = 'patch-2026-09-24';
const context = { deploy: { context: 'production' } } as any;
const single = [{ guildId: guild, channelId: channel }];
const pair = [...single, { guildId: secondGuild, channelId: secondChannel }];
const messages: any[] = [];
let joinedGuilds: { id: string; name: string }[] = [];
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
async function configure(destinations = single) {
  const response = await call({ action: 'configure', destinations });
  expect(response.status).toBe(200);
  return response.body;
}
async function preview(destinations = single, text = content, ref = reference) {
  const response = await call({ action: 'preview', content: text, reference: ref, destinations });
  expect(response.status).toBe(200);
  return { action: 'publish', content: text, reference: ref, destinations, previewToken: response.body.previewToken };
}
function mutations() { return state.request.mock.calls.filter(([, options]) => options?.method === 'POST'); }
function delivery(response: any, guildId = guild) { return response.body.results.find((item: any) => item.guildId === guildId); }
function channelFromPath(path: string) { return path.match(/^\/channels\/([0-9]+)/)?.[1]; }

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec('create table users(id uuid primary key); create table app_schema_migrations(migration_key text primary key)');
  for (const file of ['20260924_discord_community_announcements.sql', '20260925_discord_community_destinations.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + file, import.meta.url), 'utf8'));
  }
  await rows('insert into app_schema_migrations values($1)', [COMMUNITY_SCHEMA]);
  await rows('insert into users values($1)', [admin]);
}, 30_000);
afterAll(async () => state.pg?.close());
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
beforeEach(async () => {
  await state.pg.exec('truncate discord_community_announcements,discord_community_batches,discord_community_settings');
  for (const [key, value] of Object.entries({ PUBLIC_SITE_URL: 'https://nxt5.test', DISCORD_APPLICATION_ID: app,
    DISCORD_BOT_TOKEN: 'test-only-token', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'b'.repeat(40),
    DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_COMMUNITY_GUILD_ID: '', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  messages.length = 0; state.failReceipt = false;
  joinedGuilds = [{ id: guild, name: 'NXT5' }, { id: secondGuild, name: 'Équipe' }, { id: thirdGuild, name: 'Autre équipe' }];
  state.admin.mockReset().mockResolvedValue({ id: admin }); state.rate.mockReset();
  state.guild.mockReset().mockImplementation(async (id: string) => {
    const item = joinedGuilds.find(item => item.id === id);
    if (!item) throw Object.assign(new Error('Unknown guild'), { status: 404, code: 'DISCORD_NOT_FOUND' });
    return { guild: item, channels: id === guild ? [
      { id: channel, name: 'annonces', canSend: true }, { id: otherChannel, name: 'contact', canSend: true },
    ] : [{ id: id === secondGuild ? secondChannel : thirdChannel, name: 'actualités', canSend: true }] };
  });
  state.request.mockReset().mockImplementation(async (path, options = {}) => {
    if (path === '/users/@me') return { id: bot, bot: true };
    if (path === '/applications/@me') return { id: app, bot: { id: bot } };
    if (path.startsWith('/users/@me/guilds')) return joinedGuilds;
    const channelId = channelFromPath(path);
    if (options.method === 'POST') {
      const message = { ...options.body, id: String(1600000000000000001n + BigInt(messages.length)), channel_id: channelId, author: { id: bot } };
      messages.push(message); return message;
    }
    if (path.endsWith('messages?limit=100')) return messages.filter(item => item.channel_id === channelId);
    if (path.includes('/messages/')) return messages.find(item => item.channel_id === channelId && path.endsWith('/' + item.id));
    throw new Error('Unexpected mocked Discord request: ' + path);
  });
});

describe('multi-server announcements: real SQL, simulated Discord only', () => {
  it('requires platform administration and trusted mutations before reading Discord', async () => {
    state.admin.mockRejectedValue(Object.assign(new Error('Accès refusé'), { status: 403, code: 'PLATFORM_ADMIN_FORBIDDEN' }));
    expect((await call()).status).toBe(403);
    expect((await call({ action: 'configure', destinations: single })).status).toBe(403);
    expect(state.request).not.toHaveBeenCalled(); expect(state.guild).not.toHaveBeenCalled();
    state.admin.mockResolvedValue({ id: admin });
    expect((await endpoint(request({ action: 'configure', destinations: single }, 'https://evil.test'), context)).status).toBe(403);
    expect(state.guild).not.toHaveBeenCalled();
  });

  it.each(['deploy-preview', 'branch-deploy', 'dev', 'unknown'])('refuses %s for reads and writes without Discord traffic', async deploy => {
    const ctx = { deploy: { context: deploy } } as any;
    expect((await call(undefined, ctx)).status).toBe(409);
    expect((await call({ action: 'configure', destinations: single }, ctx)).status).toBe(409);
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

  it('lists joined servers when the community bot has not joined and offers a targeted installation link', async () => {
    joinedGuilds = joinedGuilds.filter(item => item.id !== guild);
    const overview = await call();
    expect(overview.status).toBe(200);
    expect(overview.body.guilds.map((item: any) => item.id)).toEqual([secondGuild, thirdGuild]);
    expect(overview.body.community).toMatchObject({ guildId: guild, joined: false });
    const install = new URL(overview.body.community.installUrl);
    expect(install.origin).toBe('https://discord.com');
    expect(install.searchParams.get('guild_id')).toBe(guild);
    expect(install.searchParams.get('client_id')).toBe(app);
    expect(overview.body.installUrl).toContain('oauth2/authorize');
    expect(overview.body.destinations).toEqual([]);
    await configure([{ guildId: secondGuild, channelId: secondChannel }]);
    expect((await call(await preview([{ guildId: secondGuild, channelId: secondChannel }]))).body.status).toBe('sent');
    expect(mutations().map(([path]) => path)).toEqual([`/channels/${secondChannel}/messages`]);
    expect(state.guild.mock.calls.every(([id]) => id !== guild)).toBe(true);
  });

  it('returns an empty server list and invitation when the bot has joined no server', async () => {
    joinedGuilds = [];
    const overview = await call();
    expect(overview.status).toBe(200); expect(overview.body.guilds).toEqual([]);
    expect(overview.body.community.joined).toBe(false); expect(overview.body.installUrl).toContain('oauth2/authorize');
    expect(mutations()).toHaveLength(0);
  });

  it('discovers destinations beyond the first Discord guild page', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({ id: String(1700000000000000000n + BigInt(index)), name: 'Serveur ' + index }));
    joinedGuilds = [...firstPage, { id: secondGuild, name: 'Équipe' }];
    const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => {
      if (path.startsWith('/users/@me/guilds')) {
        const query = new URL('https://discord.com' + path).searchParams;
        return query.has('after') ? [joinedGuilds[200]] : firstPage;
      }
      return base(path, options);
    });
    const overview = await call(); expect(overview.status).toBe(200);
    expect(overview.body.guilds).toHaveLength(201);
    expect(overview.body.guilds).toContainEqual(expect.objectContaining({ id: secondGuild, name: 'Équipe' }));
    const pages = state.request.mock.calls.filter(([path]) => path.startsWith('/users/@me/guilds'));
    expect(pages).toHaveLength(2);
    expect(new URL('https://discord.com' + pages[1][0]).searchParams.get('after')).toBe(firstPage[199].id);
    expect(mutations()).toHaveLength(0);
  });

  it('stops a Discord pagination cursor that does not advance', async () => {
    const repeatedPage = Array.from({ length: 200 }, (_, index) => ({ id: String(1700000000000000000n + BigInt(index)), name: 'Serveur ' + index }));
    const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => path.startsWith('/users/@me/guilds') ? repeatedPage : base(path, options));
    const overview = await call();
    expect(overview.status).toBe(502); expect(overview.body.code).toBe('DISCORD_INVALID_RESPONSE');
    expect(state.request.mock.calls.filter(([path]) => path.startsWith('/users/@me/guilds'))).toHaveLength(2);
    expect(state.guild).not.toHaveBeenCalled(); expect(mutations()).toHaveLength(0);
  });

  it('keeps other servers selectable when permissions cannot be read for one server', async () => {
    const base = state.guild.getMockImplementation()!;
    state.guild.mockImplementation(async id => {
      if (id === guild) throw Object.assign(new Error('Forbidden'), { status: 403, code: 'DISCORD_FORBIDDEN' });
      return base(id);
    });
    const overview = await call(); expect(overview.status).toBe(200);
    expect(overview.body.guilds.find((item: any) => item.id === guild)).toMatchObject({ channels: [], error: expect.any(String) });
    expect(overview.body.guilds.find((item: any) => item.id === secondGuild).channels).toHaveLength(1);
    await configure([{ guildId: secondGuild, channelId: secondChannel }]);
  });

  it('saves multiple destinations and previews their names and exact Markdown without sending', async () => {
    await configure(pair);
    const overview = await call(); expect(overview.body.destinations).toEqual(pair);
    expect(overview.body.guilds.find((item: any) => item.id === secondGuild).channelId).toBe(secondChannel);
    expect(overview.body.community.joined).toBe(true);
    const result = await call({ action: 'preview', content, reference, destinations: pair });
    expect(result.status).toBe(200); expect(result.body.content).toBe(content);
    expect(result.body.destinations).toEqual([
      expect.objectContaining({ guildId: guild, channelId: channel, guildName: 'NXT5', channelName: 'annonces' }),
      expect.objectContaining({ guildId: secondGuild, channelId: secondChannel, guildName: 'Équipe', channelName: 'actualités' }),
    ]);
    expect(typeof result.body.previewToken).toBe('string');
    expect(await rows('select * from discord_community_announcements')).toEqual([]); expect(mutations()).toHaveLength(0);
    expect(JSON.stringify(overview.body)).not.toMatch(/test-only-token|bbbbbbbb|publicKey|workerSecret/);
    await configure([]); expect((await call()).body.destinations).toEqual([]);
  });

  it('rejects mismatched application or bot identity before offering destinations', async () => {
    state.request.mockResolvedValueOnce({ id: bot, bot: true }).mockResolvedValueOnce({ id: otherChannel, bot: { id: bot } });
    expect((await call()).body.code).toBe('DISCORD_APPLICATION_MISMATCH');
    state.request.mockResolvedValueOnce({ id: bot, bot: true }).mockResolvedValueOnce({ id: app, bot: { id: otherChannel } });
    expect((await call()).body.code).toBe('DISCORD_APPLICATION_MISMATCH'); expect(mutations()).toHaveLength(0);
  });

  it('validates every selected server and salon before changing saved destinations or sending', async () => {
    await configure(single);
    for (const destinations of [
      [...single, { guildId: secondGuild, channelId: channel }],
      [...single, { guildId: '999999999999999999', channelId: secondChannel }],
      [...single, { guildId: secondGuild, channelId: '999999999999999999' }],
      [...single, { guildId: guild, channelId: otherChannel }],
    ]) expect((await call({ action: 'configure', destinations })).status).toBeGreaterThanOrEqual(400);
    const base = state.guild.getMockImplementation()!;
    state.guild.mockImplementation(async id => {
      const live = await base(id);
      if (id === secondGuild) live.channels = live.channels.map((item: any) => ({ ...item, canSend: false }));
      return live;
    });
    expect((await call({ action: 'configure', destinations: pair })).status).toBe(409);
    expect((await call()).body.destinations).toEqual(single); expect(mutations()).toHaveLength(0);
  });

  it('validates lengths, references and explicit destinations without altering Markdown', async () => {
    await configure();
    for (const text of ['', '  ', 'a'.repeat(4097), '\u0000']) expect((await call({ action: 'preview', content: text, reference, destinations: single })).status).toBe(400);
    for (const ref of ['', 'x'.repeat(81), '../test', 'ref with spaces']) expect((await call({ action: 'preview', content, reference: ref, destinations: single })).status).toBe(400);
    for (const destinations of [undefined, [], [{ guildId: guild, channelId: 'invalid' }]]) {
      expect((await call({ action: 'preview', content, reference, destinations })).status).toBeGreaterThanOrEqual(400);
    }
    await preview(single, 'a'.repeat(4096)); expect(mutations()).toHaveLength(0);
  });

  it('binds preview tokens to content, user, the complete destination set, configuration and expiration', async () => {
    await configure(pair); const payload = await preview(pair);
    expect((await call({ ...payload, content: 'Changed' })).body.code).toBe('DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
    expect((await call({ ...payload, destinations: single })).status).toBe(409);
    expect((await call({ ...payload, destinations: [...pair, { guildId: thirdGuild, channelId: thirdChannel }] })).status).toBe(409);
    expect((await call({ ...payload, destinations: [{ guildId: guild, channelId: otherChannel }, pair[1]] })).status).toBe(409);
    expect((await call({ ...payload, previewToken: payload.previewToken + 'a' })).status).toBe(409);
    state.admin.mockResolvedValueOnce({ id: '00000000-0000-4000-8000-000000000009' });
    expect((await call(payload)).status).toBe(409);
    const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60_000);
    expect((await call(payload)).status).toBe(409); clock.mockRestore();
    await configure(pair); expect((await call(payload)).status).toBe(409); expect(mutations()).toHaveLength(0);
  });

  it('publishes once to every selected server, excludes unselected servers and returns independent receipts', async () => {
    await configure(pair); const payload = await preview(pair);
    const first = await call(payload); const repeated = await call(payload);
    expect(first.body).toMatchObject({ status: 'sent', reference }); expect(first.body.results).toHaveLength(2);
    expect(repeated.body.results).toEqual(first.body.results); expect(mutations()).toHaveLength(2);
    expect(mutations().map(([path]) => path).sort()).toEqual([`/channels/${channel}/messages`, `/channels/${secondChannel}/messages`].sort());
    expect(new Set(mutations().map(([, options]) => options.body.nonce)).size).toBe(2);
    for (const [path, options] of mutations()) {
      const sent = options.body;
      expect(sent.embeds).toEqual([{ description: content, color: 0x67e8f9, footer: { text: 'NXT5 · ' + reference } }]);
      expect(sent.allowed_mentions).toEqual({ parse: [], users: [], roles: [], replied_user: false });
      expect(sent.nonce).toMatch(/^[a-f0-9]{24}$/); expect(sent.enforce_nonce).toBe(true);
      expect(first.body.results).toContainEqual(expect.objectContaining({ channelId: channelFromPath(path), status: 'sent', verified: true }));
    }
    const history = (await call()).body.announcements;
    expect(history).toHaveLength(2); expect(history.map((item: any) => item.guildId).sort()).toEqual([guild, secondGuild].sort());
    expect(delivery(first).messageUrl).toContain(`/${guild}/${channel}/`);
    expect(delivery(first, secondGuild).messageUrl).toContain(`/${secondGuild}/${secondChannel}/`);
    expect(state.request.mock.calls.some(([path]) => path.includes('crosspost'))).toBe(false);
  });

  it('treats destination order as irrelevant to the preview and delivery identity', async () => {
    await configure(pair); const payload = await preview(pair);
    expect((await call({ ...payload, destinations: [...pair].reverse() })).body.status).toBe('sent');
    expect((await call(payload)).body.status).toBe('sent'); expect(mutations()).toHaveLength(2);
  });

  it('keeps a reference content and original destination set immutable in the API and database', async () => {
    await configure(pair); const payload = await preview(pair); await call(payload);
    expect((await call({ action: 'preview', reference, content: 'Different', destinations: pair })).status).toBe(409);
    expect((await call({ action: 'preview', reference, content, destinations: single })).status).toBe(409);
    await configure([{ guildId: guild, channelId: otherChannel }, pair[1]]);
    expect((await call({ action: 'preview', reference, content, destinations: [{ guildId: guild, channelId: otherChannel }, pair[1]] })).status).toBe(409);
    await expect(rows('update discord_community_announcements set content=$1 where reference=$2', ['Different', reference])).rejects.toThrow('immutable');
    expect(mutations()).toHaveLength(2);
  });

  it('claims all selected deliveries before sending and prevents concurrent duplicate messages', async () => {
    await configure(pair); const payload = await preview(pair); const base = state.request.getMockImplementation()!;
    let release!: () => void; let entered!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST' && path === `/channels/${channel}/messages`) { entered(); await waiting; }
      return base(path, options);
    });
    const first = call(payload); await started;
    try {
      expect(await rows('select guild_id from discord_community_announcements where reference=$1', [reference])).toHaveLength(2);
      const second = await call(payload); expect(['uncertain', 'partial']).toContain(second.body.status);
    } finally { release(); }
    expect((await first).body.status).toBe('sent'); expect(mutations()).toHaveLength(2);
    expect(await rows("select * from discord_community_announcements where status <> 'sent'")).toEqual([]);
  });

  it('retries a definite refusal only for the failed server and preserves successful receipts', async () => {
    await configure(pair); const payload = await preview(pair); const base = state.request.getMockImplementation()!;
    let refused = false;
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST' && path === `/channels/${secondChannel}/messages` && !refused) {
        refused = true; throw Object.assign(new Error('Forbidden'), { status: 403, code: 'DISCORD_FORBIDDEN' });
      }
      return base(path, options);
    });
    const first = await call(payload);
    expect(first.body.status).toBe('partial'); expect(delivery(first).status).toBe('sent'); expect(delivery(first, secondGuild).status).toBe('failed');
    expect(await rows('select * from discord_community_announcements where reference=$1', [reference])).toHaveLength(2);
    const guildBase = state.guild.getMockImplementation()!;
    state.guild.mockImplementation(async id => {
      const live = await guildBase(id);
      if (id === secondGuild) live.channels = live.channels.map((item: any) => ({ ...item, canSend: false }));
      return live;
    });
    expect((await call(payload)).status).toBe(409); expect(mutations()).toHaveLength(2);
    state.guild.mockImplementation(guildBase);
    const retried = await call(payload); expect(retried.body.status).toBe('sent');
    expect(delivery(retried).messageUrl).toBe(delivery(first).messageUrl);
    expect(mutations().filter(([path]) => path === `/channels/${channel}/messages`)).toHaveLength(1);
    expect(mutations().filter(([path]) => path === `/channels/${secondChannel}/messages`)).toHaveLength(2);
    expect(mutations()[1][1].body.nonce).toBe(mutations()[2][1].body.nonce);
  });

  it('rechecks every selected channel permission before a fresh multi-server send', async () => {
    await configure(pair); const payload = await preview(pair); const base = state.guild.getMockImplementation()!;
    state.guild.mockImplementation(async id => {
      const live = await base(id);
      if (id === secondGuild) live.channels = live.channels.map((item: any) => ({ ...item, canSend: false }));
      return live;
    });
    expect((await call(payload)).status).toBe(409); expect(mutations()).toHaveLength(0);
  });

  it('never retries uncertain sends, including after preview expiry, and matches the original bot and content', async () => {
    await configure(pair); const payload = await preview(pair); const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST' && path === `/channels/${secondChannel}/messages`) throw Object.assign(new Error('Timeout'), { ambiguous: true });
      return base(path, options);
    });
    const first = await call(payload); expect(first.body.status).toBe('partial'); expect(delivery(first, secondGuild).status).toBe('uncertain');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    expect(delivery(await call(payload), secondGuild).status).toBe('uncertain');
    const candidate = { id: '1600000000000000009', channel_id: secondChannel, author: { id: otherChannel }, embeds: [{ description: content, footer: { text: 'NXT5 · ' + reference } }] };
    messages.push(candidate);
    expect(delivery(await call(payload), secondGuild).status).toBe('uncertain');
    candidate.author.id = bot; candidate.embeds[0].description = 'Other content';
    expect(delivery(await call(payload), secondGuild).status).toBe('uncertain');
    candidate.embeds[0].description = content;
    expect((await call(payload)).body.status).toBe('sent'); expect(mutations()).toHaveLength(2); clock.mockRestore();
  });

  it('keeps a durable uncertain receipt after storage failure and recovers without posting again', async () => {
    await configure(); const payload = await preview(); state.failReceipt = true;
    expect((await call(payload)).body.status).toBe('uncertain');
    expect((await call(payload)).body.status).toBe('sent'); expect(mutations()).toHaveLength(1);
  });

  it('recovers a selected receipt after configuration changes without a preview or a Discord send', async () => {
    await configure(pair); const payload = await preview(pair); state.failReceipt = true;
    const first = await call(payload); expect(first.body.status).toBe('partial');
    await configure([{ guildId: thirdGuild, channelId: thirdChannel }]);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    const recovered = await call({ action: 'recover', reference, guildId: guild });
    expect(recovered.body.status).toBe('sent'); expect(recovered.body.results).toHaveLength(1);
    expect(delivery(recovered).messageUrl).toContain('/' + channel + '/'); expect(mutations()).toHaveLength(2);
    expect((await call({ action: 'recover', reference })).body.status).toBe('sent');
    expect((await call({ action: 'recover', reference: 'absent' })).status).toBe(404);
    expect((await call({ action: 'recover', reference, guildId: thirdGuild })).status).toBe(404);
    expect(mutations()).toHaveLength(2); clock.mockRestore();
  });

  it('recovery reports definite failures without retrying them', async () => {
    await configure(pair); const payload = await preview(pair); const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST' && path === `/channels/${secondChannel}/messages`) throw Object.assign(new Error('Forbidden'), { status: 403, code: 'DISCORD_FORBIDDEN' });
      return base(path, options);
    });
    expect((await call(payload)).body.status).toBe('partial');
    const recovered = await call({ action: 'recover', reference });
    expect(recovered.body.status).toBe('partial'); expect(delivery(recovered, secondGuild).status).toBe('failed');
    expect(mutations()).toHaveLength(2);
  });

  it('restores the exact historical draft and receipts without changing settings or reading Discord channels', async () => {
    await configure(pair); const payload = await preview(pair); const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST' && path === `/channels/${secondChannel}/messages`) throw Object.assign(new Error('Timeout'), { ambiguous: true });
      return base(path, options);
    });
    expect((await call(payload)).body.status).toBe('partial');
    await configure([{ guildId: thirdGuild, channelId: thirdChannel }]);
    const beforeSettings = await rows('select * from discord_community_settings');
    const beforeReceipts = await rows('select * from discord_community_announcements order by guild_id');
    state.guild.mockClear(); state.request.mockClear();
    const restored = await call({ action: 'restore', reference });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ reference, content, destinations: pair, status: 'partial' });
    expect(restored.body.results).toHaveLength(2);
    expect(delivery(restored).status).toBe('sent'); expect(delivery(restored, secondGuild).status).toBe('uncertain');
    expect(restored.body.previewToken).toBeUndefined();
    expect(await rows('select * from discord_community_settings')).toEqual(beforeSettings);
    expect(await rows('select * from discord_community_announcements order by guild_id')).toEqual(beforeReceipts);
    expect(state.guild).not.toHaveBeenCalled();
    expect(state.request.mock.calls.map(([path]) => path).sort()).toEqual(['/applications/@me', '/users/@me']);
    expect((await call({ action: 'restore', reference: 'absent' })).status).toBe(404);
    expect((await call({ action: 'restore', reference: '../invalid' })).status).toBe(400);
    expect(mutations()).toHaveLength(0);
  });

  it.each(['application', 'bot'])('refuses restoration or saved-selection restoration after the %s identity changes', async changed => {
    await configure(pair); await call(await preview(pair));
    const beforeSettings = await rows('select * from discord_community_settings');
    const newApp = changed === 'application' ? thirdGuild : app;
    const newBot = changed === 'bot' ? otherChannel : bot;
    vi.stubEnv('DISCORD_APPLICATION_ID', newApp);
    const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => {
      if (path === '/users/@me') return { id: newBot, bot: true };
      if (path === '/applications/@me') return { id: newApp, bot: { id: newBot } };
      return base(path, options);
    });
    state.guild.mockClear(); state.request.mockClear();
    for (const action of [{ action: 'restore', reference }, { action: 'configure', reference, destinations: pair }]) {
      const rejected = await call(action);
      expect(rejected.status).toBe(409); expect(rejected.body.code).toBe('DISCORD_ANNOUNCEMENT_CONFIGURATION_CHANGED');
      expect(rejected.body.content).toBeUndefined();
    }
    expect(await rows('select * from discord_community_settings')).toEqual(beforeSettings);
    expect(state.guild).not.toHaveBeenCalled(); expect(mutations()).toHaveLength(0);
  });

  it('requires the complete immutable destination set when restoring saved selection by reference', async () => {
    await configure(pair); await call(await preview(pair));
    await configure([{ guildId: thirdGuild, channelId: thirdChannel }]);
    const beforeSettings = await rows('select * from discord_community_settings');
    state.guild.mockClear();
    for (const destinations of [[], single, [...pair, { guildId: thirdGuild, channelId: thirdChannel }], [{ guildId: guild, channelId: otherChannel }, pair[1]]]) {
      const rejected = await call({ action: 'configure', reference, destinations });
      expect(rejected.status).toBe(409); expect(rejected.body.code).toBe('DISCORD_ANNOUNCEMENT_REFERENCE_CONFLICT');
    }
    expect((await call({ action: 'configure', reference: 'absent', destinations: pair })).status).toBe(404);
    expect(await rows('select * from discord_community_settings')).toEqual(beforeSettings);
    expect(state.guild).not.toHaveBeenCalled(); expect(mutations()).toHaveLength(2);
  });

  it('restores and retries failed delivery after the already-delivered server becomes inaccessible', async () => {
    await configure(pair); const payload = await preview(pair); const base = state.request.getMockImplementation()!;
    let refused = false;
    state.request.mockImplementation(async (path, options) => {
      if (options?.method === 'POST' && path === `/channels/${secondChannel}/messages` && !refused) {
        refused = true; throw Object.assign(new Error('Forbidden'), { status: 403, code: 'DISCORD_FORBIDDEN' });
      }
      if (path.startsWith(`/channels/${channel}/messages/`) && !joinedGuilds.some(item => item.id === guild)) {
        throw Object.assign(new Error('Unknown guild'), { status: 403, code: 'DISCORD_FORBIDDEN' });
      }
      return base(path, options);
    });
    const first = await call(payload); expect(first.body.status).toBe('partial');
    await configure([{ guildId: thirdGuild, channelId: thirdChannel }]);
    joinedGuilds = joinedGuilds.filter(item => item.id !== guild);
    state.guild.mockClear();
    const restored = await call({ action: 'restore', reference }); expect(restored.status).toBe(200);
    expect((await call({ action: 'configure', reference, destinations: restored.body.destinations })).status).toBe(200);
    const retried = await call(await preview(restored.body.destinations, restored.body.content, restored.body.reference));
    expect(retried.body.status).toBe('sent');
    expect(delivery(retried)).toMatchObject({ status: 'sent', messageUrl: delivery(first).messageUrl, verified: false });
    expect(delivery(retried, secondGuild)).toMatchObject({ status: 'sent', verified: true });
    expect(state.guild.mock.calls.map(([id]) => id)).toEqual([secondGuild, secondGuild, secondGuild]);
    expect(mutations().filter(([path]) => path === `/channels/${channel}/messages`)).toHaveLength(1);
    expect(mutations().filter(([path]) => path === `/channels/${secondChannel}/messages`)).toHaveLength(2);
  });

  it('keeps unattempted destinations queued at the deadline and requires a fresh preview after expiry to resume them', async () => {
    await configure(pair); const payload = await preview(pair);
    const startedAt = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(startedAt);
    const base = state.guild.getMockImplementation()!;
    state.guild.mockImplementation(async id => {
      const live = await base(id);
      clock.mockReturnValue(startedAt + 41_000);
      return live;
    });
    const interrupted = await call(payload);
    expect(interrupted.status).toBe(200); expect(interrupted.body.status).toBe('uncertain');
    expect(interrupted.body.results.map((item: any) => item.status)).toEqual(['queued', 'queued']);
    expect(await rows("select guild_id from discord_community_announcements where status='queued'")).toHaveLength(2);
    expect(mutations()).toHaveLength(0);
    state.guild.mockImplementation(base);
    expect((await call({ action: 'recover', reference })).body.results.map((item: any) => item.status)).toEqual(['queued', 'queued']);
    const restored = await call({ action: 'restore', reference });
    expect(restored.body.results.map((item: any) => item.status)).toEqual(['queued', 'queued']);
    clock.mockReturnValue(startedAt + 11 * 60_000);
    const expired = await call(payload);
    expect(expired.status).toBe(409); expect(expired.body.code).toBe('DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
    expect(mutations()).toHaveLength(0);
    const resumedPayload = await preview(restored.body.destinations, restored.body.content, restored.body.reference);
    expect((await call(resumedPayload)).body.status).toBe('sent');
    expect((await call(resumedPayload)).body.status).toBe('sent'); expect(mutations()).toHaveLength(2);
  });

  it('refuses new claims when identity preflight consumes the publishing time budget', async () => {
    await configure(pair); const payload = await preview(pair);
    const startedAt = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(startedAt);
    const base = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path, options) => {
      const result = await base(path, options);
      if (path === '/applications/@me') clock.mockReturnValue(startedAt + 41_000);
      return result;
    });
    state.guild.mockClear();
    const rejected = await call(payload);
    expect(rejected.status).toBe(503); expect(rejected.body.code).toBe('DISCORD_UNAVAILABLE');
    expect(await rows('select * from discord_community_batches')).toEqual([]);
    expect(await rows('select * from discord_community_announcements')).toEqual([]);
    expect(state.guild).not.toHaveBeenCalled(); expect(mutations()).toHaveLength(0);
  });

  it('migrates existing selection and delivered announcements without losing their identity or receipt', async () => {
    const legacy = new PGlite();
    try {
      await legacy.exec('create table users(id uuid primary key)');
      await legacy.exec(readFileSync(new URL('../../database/migrations/20260924_discord_community_announcements.sql', import.meta.url), 'utf8'));
      await legacy.query('insert into users values($1)', [admin]);
      await legacy.query('insert into discord_community_settings(guild_id,channel_id,config_version,updated_by) values($1,$2,7,$3)', [guild, channel, admin]);
      await legacy.query(`insert into discord_community_announcements(reference,application_id,bot_id,guild_id,channel_id,content,content_hash,status,message_id,created_by)
        values($1,$2,$3,$4,$5,$6,$7,'sent',$8,$9)`, [reference, app, bot, guild, channel, content, 'a'.repeat(64), '1600000000000000001', admin]);
      const original = (await legacy.query('select * from discord_community_announcements')).rows[0];
      await legacy.exec(readFileSync(new URL('../../database/migrations/20260925_discord_community_destinations.sql', import.meta.url), 'utf8'));
      expect((await legacy.query('select * from discord_community_announcements')).rows).toEqual([original]);
      expect((await legacy.query('select * from discord_community_settings')).rows[0]).toMatchObject({ destinations: single, config_version: 7, updated_by: admin });
      expect((await legacy.query('select * from discord_community_batches')).rows[0]).toMatchObject({ reference, content, application_id: app, bot_id: bot, destinations: single });
      await expect(legacy.query('update discord_community_batches set destinations=$1::jsonb where reference=$2', [JSON.stringify(pair), reference])).rejects.toThrow('immutable');
    } finally { await legacy.close(); }
  });
});
