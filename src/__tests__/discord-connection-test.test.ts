import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn(), send: vi.fn(), guild: vi.fn(), getAsset: vi.fn(), putAsset: vi.fn(), render: vi.fn(), rate: vi.fn(), wake: vi.fn(), find: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  // Exercise the real Neon query/transaction serialization against local PostgreSQL.
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return { fields: result.fields, rows: result.rows.map((row: any) => result.fields.map((field: any) => {
        const value = row[field.name];
        if (value === null || value === undefined) return null;
        if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
        if (typeof value === 'boolean') return value ? 't' : 'f';
        if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '+00');
        return String(value);
      })), rowCount: result.affectedRows ?? result.rows.length };
    }
    try {
      if (body.queries) return new Response(JSON.stringify({ results: await state.pg.transaction(async (tx: any) => {
        const results = []; for (const query of body.queries) results.push(await execute(tx, query)); return results;
      }) }));
      return new Response(JSON.stringify(await execute(state.pg, body)));
    } catch (error: any) { return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 }); }
  };
  return { sql: neon('postgresql://test:test@endpoint-tests.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: state.auth }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: state.rate }));
vi.mock('../../netlify/functions/_lib/discord-wake', () => ({ wakeDiscordPublications: state.wake }));
vi.mock('../../netlify/functions/_lib/discord-client', async (original) => ({ ...await original<any>(), discordRequest: state.send, getDiscordGuild: state.guild, findDiscordMessage: state.find, getDiscordBotUserId: async () => '100000000000000088' }));
vi.mock('../../netlify/functions/_lib/publication-assets', () => ({ getPublicationAsset: state.getAsset, putPublicationAsset: state.putAsset }));
vi.mock('../../netlify/functions/_lib/publication-render', () => ({ renderGamePublicationPng: state.render }));

import connectionTest from '../../netlify/functions/team-discord-test';
import connection from '../../netlify/functions/team-discord-connection';
import routesEndpoint from '../../netlify/functions/team-discord-routes';
import { executeDiscordCommand } from '../../netlify/functions/discord-interactions';
import { withDiscordContext } from '../../netlify/functions/_lib/discord-runtime';
import { DiscordApiError } from '../../netlify/functions/_lib/discord-client';
import { buildDiscordDemoSnapshot } from '../../shared/publications/discord-demo.js';

const id = (value: number) => `30000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const owner = id(1), otherOwner = id(2), coach = id(3), player = id(4), captain = id(5);
const team = id(10), otherTeam = id(11), route = id(30), otherRoute = id(31), requestId = id(40);
const guild = '100000000000000001', channel = '100000000000000002', otherGuild = '100000000000000003', otherChannel = '100000000000000004';
const commandChannel = '100000000000000005';
const messageId = '100000000000000099';
const captainDiscordId = '100000000000000087';
const rows = async (sql: string, params: unknown[] = []) => (await state.pg.query(sql, params)).rows as any[];
const context = { deploy: { context: 'production' } } as any;
function get(endpoint = 'team-discord-test', teamId = team) {
  return new Request(`https://nxt5.example/.netlify/functions/${endpoint}?teamId=${teamId}`);
}
function post(body = {}, origin = 'https://nxt5.example') {
  return new Request('https://nxt5.example/.netlify/functions/team-discord-test', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ teamId: team, routeId: route, requestId, ...body }),
  });
}
function postConnection(body: Record<string, unknown>, teamId = team) {
  return new Request('https://nxt5.example/.netlify/functions/team-discord-connection', {
    method: 'POST', headers: { origin: 'https://nxt5.example', 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, action: 'command-channel', expectedGuildId: guild, expectedConfigVersion: 1, ...body }),
  });
}
const send = (body = {}) => connectionTest(post(body), context);
const receipts = () => rows('select * from discord_connection_tests order by created_at, request_id');

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const filename of ['20260915_discord_publications.sql', '20260921_discord_shared_servers.sql', '20260921_discord_connection_tests.sql', '20260922_discord_bot_identity.sql', '20260922_discord_bot_workflows.sql', '20260923_discord_bot_role_access.sql', '20260924_discord_command_channel.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + filename, import.meta.url), 'utf8'));
  }
  await state.pg.exec("create table app_schema_migrations(migration_key text primary key); insert into app_schema_migrations values('discord-publications-20260915-v1'),('discord-connection-tests-20260921-v1'),('discord-bot-identity-20260922-v1'),('discord-bot-workflows-20260922-v1'),('discord-bot-role-access-20260923-v1'),('discord-command-channel-20260924-v1')");
}, 30_000);
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const [key, value] of Object.entries({ CONTEXT: 'production', PUBLIC_SITE_URL: 'https://nxt5.example', DISCORD_APPLICATION_ID: '100000000000000010', DISCORD_BOT_TOKEN: 'test-only', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'test-only-worker-secret-longer-than-32', DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  for (const key of ['auth', 'send', 'guild', 'find', 'render', 'rate']) state[key].mockReset();
  state.auth.mockResolvedValue({ id: owner });
  state.send.mockResolvedValue({ id: messageId, channel_id: channel });
  state.find.mockResolvedValue(null);
  state.rate.mockResolvedValue(undefined);
  state.render.mockResolvedValue({ bytes: Buffer.from([137, 80, 78, 71]), mimeType: 'image/png', width: 1440, height: 2500, filename: 'nxt5-game-demo-game.png' });
  state.guild.mockResolvedValue({ guild: { id: guild, name: 'Test guild' }, channels: [
    { id: channel, name: 'scrims', canSend: true }, { id: commandChannel, name: 'nxt', canSend: true },
  ], roles: [] });
  await state.pg.exec('truncate users cascade');
  for (const user of [owner, otherOwner, coach, player, captain]) await rows("insert into users(id,account_name,name,password_hash) values($1,$2,$2,'unused')", [user, `test-${user}`]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Private real team','AAA'),($3,$4,'Other team','BBB')", [team, owner, otherTeam, otherOwner]);
  await rows("insert into team_members(team_id,user_id,role) values($1,$2,'coach'),($1,$3,'player'),($1,$4,'captain')", [team, coach, player, captain]);
  await rows("insert into discord_user_links(discord_user_id,user_id,discord_label) values($1,$2,'Test captain')", [captainDiscordId, captain]);
  await rows("insert into discord_connections(team_id,guild_id,status,created_by) values($1,$2,'paused',$3),($4,$5,'paused',$6)", [team, guild, owner, otherTeam, otherGuild, otherOwner]);
  await rows('update discord_connections set command_channel_id=$2 where team_id=$1', [team, commandChannel]);
  await rows("insert into discord_routes(id,team_id,guild_id,channel_id,channel_name,automatic,mention_role_id) values($1,$2,$3,$4,'scrims',false,'100000000000000077'),($5,$6,$7,$8,'private',false,null)", [route, team, guild, channel, otherRoute, otherTeam, otherGuild, otherChannel]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('Explicit fictitious Discord connection tests', () => {
  it('sends a synthetic PNG and message to a saved paused connection without mentions or game links', async () => {
    const response = await send();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ test: { requestId, routeId: route, guildId: guild, channelId: channel, configVersion: 1,
      status: 'succeeded', messageUrl: `https://discord.com/channels/${guild}/${channel}/${messageId}`, completedAt: expect.any(String) } });
    expect(state.send).toHaveBeenCalledOnce();
    const [path, options] = state.send.mock.calls[0];
    expect(path).toBe(`/channels/${channel}/messages`);
    expect(options).toMatchObject({ method: 'POST', body: { content: expect.stringContaining('données fictives'),
      allowed_mentions: { parse: [], roles: [], users: [], replied_user: false }, components: [], enforce_nonce: true,
      embeds: [{ title: 'TEST NXT5 · Exemple fictif', url: 'https://nxt5.example/bot-discord' }] },
      files: [{ name: 'nxt5-game-demo-game.png', bytes: expect.any(Uint8Array) }] });
    expect(JSON.stringify(options.body)).not.toContain('Private real team');
    expect(JSON.stringify(options.body)).not.toContain('/statistiques');
    expect((await rows('select * from publication_jobs'))).toEqual([]);
    expect((await rows('select status,enabled_at from discord_connections where team_id=$1', [team]))[0]).toEqual({ status: 'paused', enabled_at: null });
    expect((await rows("select metadata from audit_logs where action='discord.connection_test_requested'"))[0].metadata).toMatchObject({ requestId, routeId: route });
  });
  it('shows the same synthetic preview and persisted test after reload without sending or loading real games', async () => {
    const snapshot = buildDiscordDemoSnapshot();
    expect(snapshot.context.teamName).toContain('fictive');
    expect(snapshot.context.gameId).toBe('EXEMPLE FICTIF');
    expect(snapshot.participants).toHaveLength(10);
    expect(snapshot.participants.every((row) => row.name.includes('fictif'))).toBe(true);
    await send(); state.send.mockClear();
    const preview = await (await connectionTest(get(), context)).json();
    expect(preview.message.content).toContain('données fictives');
    expect(preview.imageDataUrl).toBe('data:image/png;base64,iVBORw==');
    expect(preview.latestTest.status).toBe('succeeded');
    expect(preview.latestTest.requestId).toBe(requestId);
    expect(state.send).not.toHaveBeenCalled();
    expect((await receipts())).toHaveLength(1);
  });
  it('never duplicates a completed request after response loss or double click', async () => {
    const first = await (await send()).json();
    const second = await (await send()).json();
    expect(second).toEqual(first);
    expect(state.send).toHaveBeenCalledOnce();
    expect(await receipts()).toHaveLength(1);
    expect(state.rate.mock.calls.filter(([key]) => key === 'discord-connection-test')).toHaveLength(1);
  });
  it('canonicalizes UUID case so persisted receipts can reconcile the original message reference', async () => {
    const uppercase = 'ABCDEF00-0000-4000-8000-000000000040';
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    await send({ requestId: uppercase });
    const originalReference = state.send.mock.calls[0][1].body.embeds[0].footer.text;
    await send({ requestId: uppercase.toLowerCase() });
    expect('NXT5 · ' + state.find.mock.calls[0][1].reference).toBe(originalReference);
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('fences concurrent requests with the same UUID and a second UUID for that channel', async () => {
    let release!: (value: object) => void;
    let started!: () => void;
    const reachedSend = new Promise<void>((resolve) => { started = resolve; });
    state.send.mockImplementationOnce(async () => { started(); return new Promise((resolve) => { release = resolve; }); });
    const first = send(); await reachedSend;
    const duplicate = await send();
    expect(duplicate.status).toBe(202);
    expect(await duplicate.json()).toMatchObject({ test: { status: 'sending', requestId } });
    const other = await send({ requestId: id(41) });
    expect(other.status).toBe(202);
    expect(await other.json()).toMatchObject({ test: { status: 'sending', requestId } });
    release({ id: messageId, channel_id: channel });
    expect((await first).status).toBe(200);
    expect(state.send).toHaveBeenCalledOnce();
    expect(await receipts()).toHaveLength(1);
  });
  it('persists ambiguous delivery and only confirms the same bot reference on a repeated request', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    expect(await (await send()).json()).toMatchObject({ test: { status: 'uncertain', errorCode: 'DISCORD_UNAVAILABLE', messageUrl: null } });
    expect(await (await send()).json()).toMatchObject({ test: { status: 'uncertain' } });
    expect(state.find).toHaveBeenCalledWith(channel, { reference: `connection-test:${team}:${requestId}`, after: expect.any(Date) });
    state.find.mockResolvedValueOnce({ id: messageId, channel_id: channel });
    expect(await (await send()).json()).toMatchObject({ test: { status: 'succeeded', messageUrl: expect.stringContaining(messageId) } });
    expect(state.send).toHaveBeenCalledOnce();
    expect((await receipts())[0].status).toBe('succeeded');
  });
  it('cannot treat a message from another channel or a failed reconciliation as confirmation', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    await send();
    state.find.mockResolvedValueOnce({ id: messageId, channel_id: otherChannel });
    expect(await (await send()).json()).toMatchObject({ test: { status: 'uncertain', messageUrl: null } });
    state.find.mockRejectedValueOnce(new DiscordApiError(403, 'DISCORD_FORBIDDEN'));
    expect(await (await send()).json()).toMatchObject({ test: { status: 'uncertain', messageUrl: null } });
    expect(await (await send({ requestId: id(42) })).json()).toMatchObject({ test: { status: 'uncertain', requestId } });
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('converts a stale sending receipt to visible uncertainty without permitting a resend', async () => {
    await rows("insert into discord_connection_tests(team_id,request_id,route_id,guild_id,channel_id,config_version,status,created_at) values($1,$2,$3,$4,$5,1,'sending',now()-interval '2 minutes')", [team, requestId, route, guild, channel]);
    const preview = await (await connectionTest(get(), context)).json();
    expect(preview.latestTest).toMatchObject({ status: 'uncertain', errorCode: 'DISCORD_TEST_UNCONFIRMED' });
    expect(await (await send()).json()).toMatchObject({ test: { status: 'uncertain' } });
    expect(state.send).not.toHaveBeenCalled();
    expect(state.find).toHaveBeenCalledOnce();
  });
  it('records definitive rejection, returns it for the same UUID and permits an explicit new test', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(403, 'DISCORD_FORBIDDEN'));
    const failed = await (await send()).json();
    expect(failed).toMatchObject({ test: { status: 'failed', errorCode: 'DISCORD_FORBIDDEN', completedAt: expect.any(String) } });
    expect(await (await send()).json()).toEqual(failed);
    expect(await (await send({ requestId: id(41) })).json()).toMatchObject({ test: { status: 'succeeded' } });
    expect(state.send).toHaveBeenCalledTimes(2);
  });
  it('preserves uncertainty for malformed successful responses instead of blindly retrying', async () => {
    state.send.mockResolvedValueOnce({ id: messageId, channel_id: otherChannel });
    expect(await (await send()).json()).toMatchObject({ test: { status: 'uncertain', errorCode: 'DISCORD_INVALID_RESPONSE' } });
    await send();
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('retains the original config version so reconfigured destinations invalidate onboarding evidence', async () => {
    await send();
    await rows('update discord_connections set config_version=config_version+1 where team_id=$1', [team]);
    const receipt = (await (await connectionTest(get(), context)).json()).latestTest;
    expect(receipt.configVersion).toBe(1);
    expect((await rows('select config_version from discord_connections where team_id=$1', [team]))[0].config_version).toBe(2);
    expect((await send({ routeId: otherRoute })).status).toBe(409);
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('restores an older unconfirmed destination after another channel test succeeds', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    await send();
    await rows("insert into discord_connection_tests(team_id,request_id,route_id,guild_id,channel_id,config_version,status,message_id,completed_at) values($1,$2,$3,$4,$5,1,'succeeded',$6,now())", [team, id(41), id(32), guild, otherChannel, messageId]);
    const preview = await (await connectionTest(get(), context)).json();
    expect(preview.latestTest.requestId).toBe(id(41));
    expect(preview.pendingTests).toHaveLength(1);
    expect(preview.pendingTests[0]).toMatchObject({ requestId, status: 'uncertain', routeId: route, guildId: guild, channelId: channel });
    expect(await (await send({ requestId: id(42) })).json()).toMatchObject({ test: { requestId, status: 'uncertain' } });
    expect(state.send).toHaveBeenCalledOnce();
    await rows('delete from discord_routes where id=$1', [route]);
    await rows("insert into discord_routes(id,team_id,guild_id,channel_id,channel_name) values($1,$2,$3,$4,'recreated')", [id(33), team, guild, channel]);
    expect((await (await connectionTest(get(), context)).json()).pendingTests[0].routeId).toBe(route);
    await rows("update discord_connections set status='disconnected' where team_id=$1", [team]);
    expect((await (await connectionTest(get(), context)).json()).pendingTests).toEqual([]);
    expect(state.send).toHaveBeenCalledOnce();
  });
});

describe('Connection test permissions and environment boundaries', () => {
  it('permits captain management and staff preview but rejects coach/player sends and foreign teams', async () => {
    state.auth.mockResolvedValue({ id: coach });
    expect((await connectionTest(get(), context)).status).toBe(200);
    expect((await send()).status).toBe(403);
    state.auth.mockResolvedValue({ id: player });
    expect((await connectionTest(get(), context)).status).toBe(403);
    expect((await send()).status).toBe(403);
    state.auth.mockResolvedValue({ id: otherOwner });
    expect((await send()).status).toBe(403);
    state.auth.mockResolvedValue({ id: captain });
    expect((await send()).status).toBe(200);
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('rejects forged origins, preview invocations, malformed UUIDs, and foreign route IDs before sending', async () => {
    expect((await connectionTest(post({}, 'https://attacker.example'), context)).status).toBe(403);
    expect((await connectionTest(post(), { deploy: { context: 'deploy-preview' } } as any)).status).toBe(409);
    expect((await send({ requestId: 'invalid' })).status).toBe(400);
    expect((await send({ routeId: otherRoute })).status).toBe(409);
    expect(state.send).not.toHaveBeenCalled();
    expect(await receipts()).toEqual([]);
  });
  it('keeps the global publishing switch authoritative and makes preview safe while disabled', async () => {
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'false');
    expect((await send()).status).toBe(409);
    expect((await connectionTest(get(), context)).status).toBe(200);
    expect(state.guild).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
    expect(await receipts()).toEqual([]);
  });
  it('does not reconcile through Discord while the global switch is disabled', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    await send(); vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'false');
    expect(await (await send()).json()).toMatchObject({ test: { status: 'uncertain' } });
    expect(state.find).not.toHaveBeenCalled();
  });
  it.each(['disconnected', 'pending'])('does not send for connection status %s', async (status) => {
    await rows('update discord_connections set status=$2 where team_id=$1', [team, status]);
    expect((await send()).status).toBe(409);
    expect(state.guild).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
  });
  it('rejects disabled, relinked and inaccessible channels', async () => {
    await rows('update discord_routes set enabled=false where id=$1', [route]);
    expect((await send()).status).toBe(409);
    await rows('update discord_routes set enabled=true,guild_id=$2 where id=$1', [route, otherGuild]);
    expect((await send()).status).toBe(409);
    await rows('update discord_routes set guild_id=$2 where id=$1', [route, guild]);
    state.guild.mockResolvedValue({ guild: { id: guild }, channels: [{ id: channel, canSend: false }], roles: [] });
    expect((await send()).status).toBe(409);
    expect(state.send).not.toHaveBeenCalled();
    expect(await receipts()).toEqual([]);
  });
  it('stops if destination configuration changes during live permission checks', async () => {
    state.guild.mockImplementationOnce(async () => {
      await rows('update discord_connections set config_version=config_version+1 where team_id=$1', [team]);
      return { guild: { id: guild }, channels: [{ id: channel, canSend: true }], roles: [] };
    });
    expect((await send()).status).toBe(409);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('enforces a shared team budget before inspecting guild or sending', async () => {
    state.rate.mockRejectedValueOnce(Object.assign(new Error('Attends.'), { status: 429, retryAfter: 60 }));
    expect((await send()).status).toBe(429);
    expect(state.rate).toHaveBeenCalledWith('discord-connection-test', team, { limit: 3, windowSeconds: 300 });
    expect(state.guild).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
  });
  it('fails with a safe maintenance error when the additive migration is missing', async () => {
    await rows("delete from app_schema_migrations where migration_key='discord-connection-tests-20260921-v1'");
    try {
      const response = await send();
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'DISCORD_TEST_SCHEMA_REQUIRED' });
      expect(state.send).not.toHaveBeenCalled();
    } finally { await rows("insert into app_schema_migrations values('discord-connection-tests-20260921-v1')"); }
  });
  it('reports independently verified connection health and safe error state', async () => {
    expect(await (await connection(get('team-discord-connection'), context)).json()).toMatchObject({ health: { checkedAt: expect.any(String), verified: true, errorCode: null } });
    state.guild.mockRejectedValueOnce(new Error('private upstream detail'));
    const unhealthy = await (await connection(get('team-discord-connection'), context)).json();
    expect(unhealthy.health).toMatchObject({ verified: false, errorCode: 'DISCORD_UNAVAILABLE' });
    expect(unhealthy.connectionError).not.toContain('private');
  });
  it('retains receipts after route deletion and cascades them only with the owning team', async () => {
    await send();
    await rows('delete from discord_routes where id=$1', [route]);
    expect((await receipts())[0].route_id).toBe(route);
    await rows('delete from teams where id=$1', [team]);
    expect(await receipts()).toEqual([]);
  });
});

describe('Dedicated command channel configuration', () => {
  it('saves a verified channel without changing publication config version', async () => {
    const response = await connection(postConnection({ channelId: channel }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await rows('select command_channel_id,config_version from discord_connections where team_id=$1', [team]))[0])
      .toEqual({ command_channel_id: channel, config_version: 1 });
    expect(await (await connection(get('team-discord-connection'), context)).json())
      .toMatchObject({ connection: { commandChannelId: channel, configVersion: 1 } });
    expect((await rows("select metadata from audit_logs where action='discord.command_channel_updated'"))[0].metadata)
      .toEqual({ channelId: channel });
  });

  it('refuses an invalid, inaccessible or stale command channel', async () => {
    expect((await connection(postConnection({ channelId: 'invalid' }), context)).status).toBe(400);
    const stale = await connection(postConnection({ channelId: channel, expectedConfigVersion: 2 }), context);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'DISCORD_CONFIG_CHANGED' });
    state.guild.mockResolvedValueOnce({ guild: { id: guild }, channels: [{ id: channel, canSend: false }], roles: [] });
    const unavailable = await connection(postConnection({ channelId: channel }), context);
    expect(unavailable.status).toBe(409);
    expect(await unavailable.json()).toMatchObject({ code: 'DISCORD_COMMAND_CHANNEL_UNAVAILABLE' });
    expect((await rows('select command_channel_id from discord_connections where team_id=$1', [team]))[0].command_channel_id)
      .toBe(commandChannel);
  });

  it('cannot reserve a channel already assigned to another team on the same server', async () => {
    const competingTeam = id(12);
    await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Competing team','CCC')", [competingTeam, otherOwner]);
    await rows("insert into discord_connections(team_id,guild_id,status,created_by) values($1,$2,'paused',$3)", [competingTeam, guild, otherOwner]);
    state.auth.mockResolvedValue({ id: otherOwner });
    const taken = await connection(postConnection({ channelId: commandChannel }, competingTeam), context);
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ code: 'DISCORD_COMMAND_CHANNEL_TAKEN' });
    expect((await rows('select command_channel_id from discord_connections where team_id=$1', [competingTeam]))[0].command_channel_id)
      .toBeNull();
  });
});

describe('Activation confirms the reviewed destinations', () => {
  const resume = (values = {}) => connection(post({ action: 'resume', expectedGuildId: guild, expectedConfigVersion: 1, ...values }), context);
  const command = (interactionId: string) => withDiscordContext(context, () => executeDiscordCommand({
    id: interactionId, guild_id: guild, channel_id: commandChannel,
    member: { user: { id: captainDiscordId }, permissions: '32' },
    data: { options: [{ name: 'reprendre' }] },
  }));
  it('returns destination data together with its exact connection version, including an empty route list', async () => {
    const first = await (await routesEndpoint(get('team-discord-routes'), context)).json();
    expect(first).toMatchObject({ guildId: guild, configVersion: 1, routes: [{ id: route, channelId: channel }] });
    await state.pg.transaction(async (tx) => {
      await tx.query('update discord_connections set config_version=2 where team_id=$1', [team]);
      await tx.query('delete from discord_routes where team_id=$1', [team]);
    });
    expect(await (await routesEndpoint(get('team-discord-routes'), context)).json()).toEqual({ guildId: guild, configVersion: 2, routes: [] });
  });
  it('activates the reviewed configuration and preserves its first activation time on a repeated request', async () => {
    expect((await resume()).status).toBe(200);
    const first = (await rows('select status,enabled_at from discord_connections where team_id=$1', [team]))[0];
    expect(first.status).toBe('active'); expect(first.enabled_at).toBeInstanceOf(Date);
    expect((await resume()).status).toBe(200);
    expect((await rows('select enabled_at from discord_connections where team_id=$1', [team]))[0].enabled_at).toEqual(first.enabled_at);
  });
  it.each([{ expectedGuildId: otherGuild }, { expectedConfigVersion: 2 }, { expectedGuildId: null }, { expectedConfigVersion: null }])('refuses a missing or stale configuration before the live permission check: %j', async (values) => {
    const response = await resume(values);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DISCORD_CONFIG_CHANGED' });
    expect(state.guild).not.toHaveBeenCalled();
    expect((await rows('select status,enabled_at from discord_connections where team_id=$1', [team]))[0]).toEqual({ status: 'paused', enabled_at: null });
  });
  it('does not activate if another manager changes configuration during the live check', async () => {
    state.guild.mockImplementationOnce(async () => {
      await rows('update discord_connections set config_version=config_version+1 where team_id=$1', [team]);
      return { guild: { id: guild }, channels: [{ id: channel, canSend: true }], roles: [] };
    });
    const response = await resume();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DISCORD_CONFIG_CHANGED' });
    expect((await rows('select status,enabled_at from discord_connections where team_id=$1', [team]))[0]).toEqual({ status: 'paused', enabled_at: null });
    expect((await rows("select * from audit_logs where action='discord.resume'"))).toEqual([]);
  });
  it('does not revive a connection disconnected during the live check', async () => {
    state.guild.mockImplementationOnce(async () => {
      await rows("update discord_connections set status='disconnected',config_version=config_version+1 where team_id=$1", [team]);
      return { guild: { id: guild }, channels: [{ id: channel, canSend: true }], roles: [] };
    });
    expect((await resume()).status).toBe(409);
    expect((await rows('select status from discord_connections where team_id=$1', [team]))[0].status).toBe('disconnected');
  });
  it('blocks HTTP activation and slash resume during global suspension', async () => {
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'false');
    const response = await resume();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DISCORD_PUBLISHING_DISABLED' });
    expect(await command('100000000000000070')).toContain('suspendus');
    expect(state.guild).not.toHaveBeenCalled();
    expect((await rows('select status,enabled_at from discord_connections where team_id=$1', [team]))[0]).toEqual({ status: 'paused', enabled_at: null });
  });
  it('retains the slash-command protocol and its existing version guard', async () => {
    expect(await command('100000000000000071')).toContain('Connexion active');
    expect((await rows('select status from discord_connections where team_id=$1', [team]))[0].status).toBe('active');
  });
});
