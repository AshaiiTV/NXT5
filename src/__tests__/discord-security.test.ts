import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), transaction: vi.fn(), auth: vi.fn(), schema: vi.fn(), enqueue: vi.fn(), rate: vi.fn(), preview: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: Object.assign(mocks.sql, { transaction: mocks.transaction }) }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: mocks.auth }));
vi.mock('../../netlify/functions/_lib/discord-queue', () => ({ assertDiscordSchemaReady: mocks.schema, enqueueManualPublication: mocks.enqueue }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: mocks.rate }));
vi.mock('../../netlify/functions/_lib/discord-preview', () => ({ loadDiscordPreview: mocks.preview }));

import { getDiscordConfig, isDiscordEnabled, publicDiscordStatus, signDiscordInternalRequest, verifyDiscordInternalRequest, verifyDiscordInteraction } from '../../netlify/functions/_lib/discord-config';
import { discordRequest, discordPermissions, getDiscordGuild, buildDiscordMessage, findDiscordMessage } from '../../netlify/functions/_lib/discord-client';
import { requireDiscordTeam, discordResponseError } from '../../netlify/functions/_lib/discord-access';
import connection from '../../netlify/functions/team-discord-connection';
import publish from '../../netlify/functions/team-discord-publish';
import preview from '../../netlify/functions/team-discord-preview';

const APP = '100000000000000001';
const BOT = '100000000000000002';
const GUILD = '100000000000000003';
const CHANNEL = '100000000000000004';
const ROLE = '100000000000000005';
const ROLE2 = '100000000000000006';
const MESSAGE = '100000000000000007';
const USER = '100000000000000008';
const TEAM = '10000000-0000-4000-8000-000000000001';
const OTHER_TEAM = '10000000-0000-4000-8000-000000000002';
const MATCH = '10000000-0000-4000-8000-000000000003';
const ROUTE = '10000000-0000-4000-8000-000000000004';
const CLOCK = Date.parse('2026-09-15T12:00:00Z');
const SECRET = 'test-only-worker-secret-that-is-long-enough';
const PERMISSIONS = 1024n | 2048n | 16384n | 32768n | 65536n;
const fetchMock = vi.fn();
const jsonResponse = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });
function request(body?: object, endpoint = 'team-discord-publish', extraHeaders = {}) {
  return new Request(`https://nxt5.example/.netlify/functions/${endpoint}${body ? '' : `?teamId=${TEAM}`}`, {
    method: body ? 'POST' : 'GET', headers: { origin: 'https://nxt5.example', 'content-type': 'application/json', ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const baseTeam = (role: string, owner = false) => ({ id: TEAM, owner_id: owner ? USER : 'another-owner', name: 'Équipe de test', role });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock.mockReset());
  vi.stubGlobal('Netlify', undefined);
  // These tests select a local context; CI may itself define Netlify build vars.
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID']) vi.stubEnv(key, '');
  for (const [key, value] of Object.entries({ DISCORD_APPLICATION_ID: APP, DISCORD_BOT_TOKEN: 'test-only-bot-token', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: SECRET, PUBLIC_SITE_URL: 'https://nxt5.example', DISCORD_ENVIRONMENT: 'production', DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_LOCAL_PILOT: 'false', CONTEXT: 'production' })) vi.stubEnv(key, value);
  vi.spyOn(Date, 'now').mockReturnValue(CLOCK);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.auth.mockResolvedValue({ id: USER });
  mocks.schema.mockResolvedValue(undefined);
  mocks.rate.mockResolvedValue(undefined);
  mocks.enqueue.mockResolvedValue([{ id: 'job-test', status: 'queued' }]);
  mocks.sql.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (items) => Promise.all(items));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('Discord signatures and environment isolation', () => {
  it('authenticates exact raw HMAC bodies and rejects modified, expired and future proofs', () => {
    const body = '{ "job": "123" }';
    const headers = signDiscordInternalRequest(body);
    const req = new Request('https://nxt5.example/internal', { method: 'POST', headers, body });
    expect(verifyDiscordInternalRequest(req, body)).toBe(true);
    expect(verifyDiscordInternalRequest(req, JSON.stringify(JSON.parse(body)))).toBe(false);
    for (const delta of [-121, 121]) {
      const timestamp = String(Math.floor(CLOCK / 1000) + delta);
      const signature = createHmac('sha256', SECRET).update(timestamp + '.' + body).digest('hex');
      expect(verifyDiscordInternalRequest(new Request(req.url, { headers: { 'x-nxt5-discord-timestamp': timestamp, 'x-nxt5-discord-signature': signature } }), body)).toBe(false);
    }
    expect(verifyDiscordInternalRequest(new Request(req.url, { headers: { ...headers, 'x-nxt5-discord-signature': '00' } }), body)).toBe(false);
    expect(verifyDiscordInternalRequest(new Request(req.url), body)).toBe(false);
  });
  it('verifies real Ed25519 signatures over timestamp + raw body, never parsed JSON', () => {
    const keys = generateKeyPairSync('ed25519');
    vi.stubEnv('DISCORD_PUBLIC_KEY', keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex'));
    const body = '{ "type": 1, "text": "équipe" }';
    const timestamp = String(Math.floor(CLOCK / 1000));
    const signature = sign(null, Buffer.from(timestamp + body), keys.privateKey).toString('hex');
    const req = new Request('https://nxt5.example/interaction', { headers: { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': signature } });
    expect(verifyDiscordInteraction(req, body)).toBe(true);
    expect(verifyDiscordInteraction(req, body.replace('équipe', 'autre'))).toBe(false);
    expect(verifyDiscordInteraction(req, JSON.stringify(JSON.parse(body)))).toBe(false);
    const stale = String(Number(timestamp) - 301);
    expect(verifyDiscordInteraction(new Request(req.url, { headers: { 'x-signature-timestamp': stale, 'x-signature-ed25519': sign(null, Buffer.from(stale + body), keys.privateKey).toString('hex') } }), body)).toBe(false);
    vi.stubEnv('DISCORD_PUBLIC_KEY', 'invalid');
    expect(verifyDiscordInteraction(req, body)).toBe(false);
  });
  it.each(['deploy-preview', 'branch-deploy'])('removes every usable secret in %s including DELETE and configuration calls', async (context) => {
    vi.stubEnv('CONTEXT', context);
    vi.stubEnv('DISCORD_LOCAL_PILOT', 'true');
    vi.stubEnv('DISCORD_ENVIRONMENT', 'test');
    const config = getDiscordConfig();
    expect(config.configured).toBe(false);
    expect([config.botToken, config.workerSecret, config.publicKey]).toEqual(['', '', '']);
    expect(isDiscordEnabled()).toBe(false);
    expect(() => signDiscordInternalRequest('{}')).toThrow('SECRET_MISSING');
    await expect(discordRequest(`/channels/${CHANNEL}/messages/${MESSAGE}`, { method: 'DELETE' })).rejects.toMatchObject({ code: 'DISCORD_NOT_CONFIGURED' });
    await expect(getDiscordGuild(GUILD)).rejects.toMatchObject({ code: 'DISCORD_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('only enables a configured production deployment or an explicit local test pilot', () => {
    expect(isDiscordEnabled()).toBe(true);
    const publicStatus = publicDiscordStatus();
    expect(JSON.stringify(publicStatus)).not.toMatch(/test-only|aaaaaaaa/);
    expect(new URL(publicStatus.installUrl!).searchParams.get('permissions')).toBe(String(PERMISSIONS));
    vi.stubEnv('CONTEXT', 'dev');
    expect(isDiscordEnabled()).toBe(false);
    vi.stubEnv('DISCORD_ENVIRONMENT', 'test');
    vi.stubEnv('DISCORD_LOCAL_PILOT', 'true');
    vi.stubEnv('PUBLIC_SITE_URL', 'http://localhost:9999');
    expect(isDiscordEnabled()).toBe(true);
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'false');
    expect(isDiscordEnabled()).toBe(false);
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'true');
    vi.stubEnv('PUBLIC_SITE_URL', 'http://remote.example');
    expect(isDiscordEnabled()).toBe(false);
  });
});

describe('Discord effective channel permissions', () => {
  const guild = { id: GUILD, owner_id: USER };
  const member = { user: { id: BOT }, roles: [ROLE, ROLE2] };
  const roles = [{ id: GUILD, permissions: String(PERMISSIONS) }, { id: ROLE, permissions: '0' }, { id: ROLE2, permissions: '0' }];
  it('applies everyone, aggregate role overwrites and member overwrites in order', () => {
    const channel = { permission_overwrites: [
      { id: GUILD, type: 0, deny: '2048', allow: '0' },
      { id: ROLE, type: 0, deny: '0', allow: '2048' },
      { id: ROLE2, type: 0, deny: '2048', allow: '0' },
    ] };
    expect(discordPermissions(guild, roles, member, channel) & 2048n).toBe(2048n);
    channel.permission_overwrites.push({ id: BOT, type: 1, deny: '2048', allow: '0' });
    expect(discordPermissions(guild, roles, member, channel) & 2048n).toBe(0n);
    expect(discordPermissions(guild, roles, member, { permission_overwrites: [{ id: ROLE, type: 0, deny: '1024', allow: '0' }] }) & 1024n).toBe(0n);
  });
  it('honors real owner and administrator but fails closed on malformed identity or bitsets', () => {
    expect(discordPermissions(guild, roles, { user: { id: USER }, roles: [] }) & PERMISSIONS).toBe(PERMISSIONS);
    expect(discordPermissions(guild, [...roles, { id: ROLE, permissions: '8' }], member, { permission_overwrites: [{ id: BOT, type: 1, deny: String(PERMISSIONS), allow: '0' }] }) & PERMISSIONS).toBe(PERMISSIONS);
    expect(discordPermissions({}, roles, { user: {} })).toBe(0n);
    expect(discordPermissions(guild, [{ id: GUILD, permissions: '-1' }], member)).toBe(0n);
    expect(discordPermissions(guild, roles, member, { permission_overwrites: [{ id: BOT, type: 1, allow: '-1', deny: '0' }] })).toBe(0n);
    expect(discordPermissions(guild, roles, { ...member, communication_disabled_until: '2026-09-15T12:01:00Z' }) & 2048n).toBe(0n);
  });
  it('filters non-text and foreign-guild channels and checks all needed rights', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/users/@me')) return jsonResponse({ id: BOT, bot: true });
      if (url.endsWith('/roles')) return jsonResponse(roles);
      if (url.includes('/members/')) return jsonResponse(member);
      if (url.endsWith('/channels')) return jsonResponse([
        { id: CHANNEL, name: 'allowed', guild_id: GUILD, type: 0, permission_overwrites: [] },
        { id: MESSAGE, name: 'denied', guild_id: GUILD, type: 5, permission_overwrites: [{ id: BOT, type: 1, deny: '32768', allow: '0' }] },
        { id: ROLE, name: 'voice', guild_id: GUILD, type: 2 },
        { id: ROLE2, name: 'foreign', guild_id: APP, type: 0 },
      ]);
      return jsonResponse(guild);
    });
    const result = await getDiscordGuild(GUILD);
    expect(result.channels.map((channel) => [channel.name, channel.canSend])).toEqual([['allowed', true], ['denied', false]]);
  });
});

describe('Discord transport and message safety', () => {
  it('uses one fixed API origin and refuses redirects or arbitrary credential destinations', async () => {
    for (const path of ['https://evil.example', '//evil.example', `/channels/${CHANNEL}/messages#evil`, `/channels/${CHANNEL}/../../users/@me`]) await expect(discordRequest(path)).rejects.toMatchObject({ code: 'DISCORD_INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(jsonResponse({ id: MESSAGE }));
    await discordRequest(`/channels/${CHANNEL}/messages`, { method: 'post', body: { content: '@everyone' } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://discord.com/api/v10/channels/${CHANNEL}/messages`);
    expect(options.redirect).toBe('error');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bot test-only-bot-token');
    expect(JSON.parse(options.body).allowed_mentions.parse).toEqual([]);
  });
  it('preserves fractional rate-limit delays even for non-JSON responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ retry_after: 1.25 }, 429));
    await expect(discordRequest(`/channels/${CHANNEL}/messages`, { method: 'POST', body: {} })).rejects.toMatchObject({ status: 429, code: 'DISCORD_RATE_LIMITED', retryAfterMs: 1250, uncertain: false });
    fetchMock.mockResolvedValueOnce(new Response('limited', { status: 429, headers: { 'retry-after': '2.5' } }));
    await expect(discordRequest(`/channels/${CHANNEL}/messages`)).rejects.toMatchObject({ retryAfter: 2.5 });
    fetchMock.mockResolvedValueOnce(jsonResponse({ retry_after: 'Infinity' }, 429));
    await expect(discordRequest(`/channels/${CHANNEL}/messages`)).rejects.toMatchObject({ retryAfter: 1 });
  });
  it.each([500, 502, 503])('marks POST/PATCH %s responses uncertain even when their body is HTML', async (status) => {
    fetchMock.mockImplementation(async () => new Response('<html>gateway failure</html>', { status }));
    await expect(discordRequest(`/channels/${CHANNEL}/messages`, { method: 'POST', body: {} })).rejects.toMatchObject({ status, code: 'DISCORD_UNAVAILABLE', ambiguous: true });
    await expect(discordRequest(`/channels/${CHANNEL}/messages/${MESSAGE}`, { method: 'PATCH', body: {} })).rejects.toMatchObject({ status, ambiguous: true });
    await expect(discordRequest(`/channels/${CHANNEL}/messages`)).rejects.toMatchObject({ status, ambiguous: false });
  });
  it('classifies timeout and invalid success bodies as uncertain sends, never exposing raw errors', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('SECRET_TIMEOUT_DETAIL', 'TimeoutError'));
    await expect(discordRequest(`/channels/${CHANNEL}/messages`, { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'DISCORD_UNAVAILABLE', uncertain: true });
    fetchMock.mockResolvedValueOnce(new Response('malformed', { status: 200 }));
    await expect(discordRequest(`/channels/${CHANNEL}/messages`, { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'DISCORD_INVALID_RESPONSE', uncertain: true });
    fetchMock.mockResolvedValueOnce(jsonResponse({ secret: 'UPSTREAM_SECRET' }, 403));
    try { await discordRequest(`/channels/${CHANNEL}/messages`); } catch (error: any) {
      expect(error.message).not.toContain('UPSTREAM_SECRET');
      const response = discordResponseError(error);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain('UPSTREAM_SECRET');
    }
  });
  it('sends PATCH multipart as a replacement image without create-only nonce fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: MESSAGE }));
    const body = { content: '', attachments: [{ id: 0, filename: 'new.png' }], nonce: 'creation-only', enforce_nonce: true, allowed_mentions: { parse: [], roles: [], users: [] } };
    await discordRequest(`/channels/${CHANNEL}/messages/${MESSAGE}`, { method: 'PATCH', body, files: [{ name: 'new.png', bytes: new Uint8Array([137, 80, 78, 71]) }] });
    const options = fetchMock.mock.calls[0][1];
    expect(options.headers['Content-Type']).toBeUndefined();
    const payload = JSON.parse(options.body.get('payload_json'));
    expect(payload.attachments).toEqual([{ id: 0, filename: 'new.png' }]);
    expect(payload).not.toHaveProperty('nonce');
    expect(payload).not.toHaveProperty('enforce_nonce');
    expect(body.nonce).toBe('creation-only');
    expect(options.body.get('files[0]').name).toBe('new.png');
    fetchMock.mockClear();
    await expect(discordRequest(`/channels/${CHANNEL}/messages`, { method: 'POST', files: [{ name: 'huge.png', bytes: new Uint8Array(8 * 1024 * 1024 + 1) }] })).rejects.toMatchObject({ code: 'DISCORD_FILE_TOO_LARGE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('bounds hostile content below embed limits and allows only the explicitly requested role', () => {
    const snapshot = { teamId: TEAM, entityId: MATCH, context: { teamName: '@everyone <@' + USER + '> ' + 'x'.repeat(500), opponentName: '<@&' + ROLE + '>', categories: Array.from({ length: 100 }, () => ({ name: 'Category'.repeat(100) })) }, reviewHints: [{ observation: 'x'.repeat(2000), action: 'y'.repeat(2000) }, { observation: 'z'.repeat(2000), action: 'w'.repeat(2000) }] };
    const message = buildDiscordMessage(snapshot, { reference: 'publication-test', siteUrl: 'https://nxt5.example', includeHints: true, mentionRoleId: ROLE, hasImage: true });
    expect(message.content).toBe(`<@&${ROLE}>`);
    expect(message.allowed_mentions).toEqual({ parse: [], users: [], roles: [ROLE], replied_user: false });
    const embed = message.embeds[0];
    expect(embed.title).toContain('\\<');
    expect(embed.description.length).toBeLessThanOrEqual(4096);
    expect(embed.fields.every((field) => field.value.length > 0 && field.value.length <= 1024)).toBe(true);
    const total = embed.title.length + embed.description.length + embed.footer.text.length + embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0);
    expect(total).toBeLessThanOrEqual(6000);
    expect(message.nonce.length).toBeLessThanOrEqual(25);
    const url = new URL(message.components[0].components[0].url);
    expect(url.searchParams.get('team')).toBe(TEAM);
    expect(url.searchParams.get('match')).toBe(MATCH);
    expect(buildDiscordMessage(snapshot, { reference: 'plain', siteUrl: 'https://nxt5.example' }).allowed_mentions.roles).toEqual([]);
  });
  it('reconciles only a matching bot-authored message with the exact reference and time window', async () => {
    fetchMock.mockImplementation(async (url) => url.endsWith('/users/@me') ? jsonResponse({ id: BOT, bot: true }) : jsonResponse([
      { id: 'foreign', author: { id: USER }, timestamp: '2026-09-15T12:00:00Z', embeds: [{ footer: { text: 'NXT5 · ref' } }] },
      { id: 'old', author: { id: BOT }, timestamp: '2026-09-14T12:00:00Z', embeds: [{ footer: { text: 'NXT5 · ref' } }] },
      { id: MESSAGE, author: { id: BOT }, timestamp: '2026-09-15T12:00:00Z', embeds: [{ footer: { text: 'NXT5 · ref' } }] },
    ]));
    expect((await findDiscordMessage(CHANNEL, { reference: 'ref', after: '2026-09-15T11:59:00Z' })).id).toBe(MESSAGE);
  });
});

describe('NXT5 authentication and team action boundaries', () => {
  it('binds the membership query to the signed-in user and requested team, not user-supplied roles', async () => {
    mocks.sql.mockImplementation(async (statement, params) => statement.startsWith('select t.') && params[0] === USER && params[1] === TEAM ? [baseTeam('coach')] : []);
    const allowed = await requireDiscordTeam(request(), {} as any, TEAM, 'staff');
    expect(allowed.canManage).toBe(false);
    expect(allowed.canPublish).toBe(true);
    await expect(requireDiscordTeam(request(), {} as any, OTHER_TEAM, 'staff')).rejects.toMatchObject({ status: 403, code: 'DISCORD_TEAM_FORBIDDEN' });
    expect(mocks.sql.mock.calls[0][1]).toEqual([USER, TEAM]);
    await expect(requireDiscordTeam(request(), {} as any, `${TEAM}' or true--`, 'read')).rejects.toMatchObject({ status: 400 });
  });
  it.each(['player', 'unknown', 'COACH'])('denies publishing privileges for the stored role %s', async (role) => {
    mocks.sql.mockResolvedValue([baseTeam(role)]);
    await expect(requireDiscordTeam(request(), {} as any, TEAM, 'staff')).rejects.toMatchObject({ code: 'DISCORD_ROLE_FORBIDDEN' });
    expect(mocks.schema).not.toHaveBeenCalled();
  });
  it.each(['coach', 'assistant', 'analyst', 'manager', 'board'])('allows staff publication but refuses connection management for %s', async (role) => {
    mocks.sql.mockResolvedValue([baseTeam(role)]);
    expect((await requireDiscordTeam(request(), {} as any, TEAM, 'staff')).canPublish).toBe(true);
    await expect(requireDiscordTeam(request(), {} as any, TEAM, 'manage')).rejects.toMatchObject({ status: 403 });
  });
  it('allows the actual owner and captain to manage while failing closed on missing auth/schema', async () => {
    mocks.sql.mockResolvedValue([baseTeam('player', true)]);
    expect((await requireDiscordTeam(request(), {} as any, TEAM, 'manage')).canManage).toBe(true);
    mocks.sql.mockResolvedValue([baseTeam('captain')]);
    expect((await requireDiscordTeam(request(), {} as any, TEAM, 'manage')).canManage).toBe(true);
    mocks.schema.mockRejectedValueOnce(Object.assign(new Error('migration'), { status: 503 }));
    await expect(requireDiscordTeam(request(), {} as any, TEAM, 'staff')).rejects.toMatchObject({ status: 503 });
    mocks.auth.mockRejectedValueOnce(Object.assign(new Error('Unauthenticated'), { status: 401 }));
    mocks.sql.mockClear();
    await expect(requireDiscordTeam(request(), {} as any, TEAM, 'read')).rejects.toMatchObject({ status: 401 });
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('blocks cross-site mutations before auth or database operations', async () => {
    const response = await connection(request({ teamId: TEAM, action: 'pause' }, 'team-discord-connection', { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), {} as any);
    expect(response.status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('enforces staff/manage boundaries in the real HTTP handlers and requires an approved revision', async () => {
    mocks.sql.mockImplementation(async (statement) => statement.startsWith('select t.') ? [baseTeam('coach')] : []);
    const deniedManage = await connection(request({ teamId: TEAM, action: 'pause' }, 'team-discord-connection'), {} as any);
    expect(deniedManage.status).toBe(403);
    const noPreview = await publish(request({ teamId: TEAM, matchId: MATCH, routeId: ROUTE }), {} as any);
    expect(noPreview.status).toBe(409);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    const sent = await publish(request({ teamId: TEAM, matchId: MATCH, routeId: ROUTE, snapshotRevision: 3 }), {} as any);
    expect(sent.status).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith({ teamId: TEAM, matchId: MATCH, routeId: ROUTE, expectedRevision: 3 });
    mocks.sql.mockResolvedValue([baseTeam('player')]);
    const deniedPreview = await preview(request(undefined, 'team-discord-preview'), {} as any);
    expect(deniedPreview.status).toBe(403);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it('prevents configuration link creation and publication on a deploy preview', async () => {
    mocks.sql.mockResolvedValue([baseTeam('captain')]);
    vi.stubEnv('CONTEXT', 'deploy-preview');
    const link = await connection(request({ teamId: TEAM, action: 'create-link' }, 'team-discord-connection'), {} as any);
    expect(link.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    const pause = await connection(request({ teamId: TEAM, action: 'pause' }, 'team-discord-connection'), {} as any);
    expect(pause.status).toBe(409);
    expect(mocks.sql).not.toHaveBeenCalled();
    const sent = await publish(request({ teamId: TEAM, matchId: MATCH, routeId: ROUTE, snapshotRevision: 3 }), {} as any);
    expect(sent.status).toBe(409);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
