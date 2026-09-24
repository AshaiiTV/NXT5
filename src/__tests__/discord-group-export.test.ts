import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn(), send: vi.fn(), guild: vi.fn(), find: vi.fn(), render: vi.fn(), rate: vi.fn(), failReceipt: false }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: async (query: string | TemplateStringsArray, ...args: any[]) => {
  const statement = typeof query === 'string' ? query : query.reduce((value, part, index) => value + (index ? '$' + index : '') + part, '');
  if (state.failReceipt && statement.includes("set status='succeeded'")) { state.failReceipt = false; throw new Error('Receipt storage unavailable'); }
  return (await state.pg.query(statement, typeof query === 'string' ? args[0] || [] : args)).rows;
} }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: state.auth }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: state.rate }));
vi.mock('../../netlify/functions/_lib/discord-client', async original => ({ ...await original<any>(), discordRequest: state.send, getDiscordGuild: state.guild, findDiscordMessage: state.find, getDiscordBotUserId: async () => '100000000000000088' }));
vi.mock('../../netlify/functions/_lib/publication-render', () => ({ renderGroupPublicationPng: state.render }));

import previewEndpoint from '../../netlify/functions/team-discord-group-preview';
import publishEndpoint from '../../netlify/functions/team-discord-group-publish';
import historyEndpoint from '../../netlify/functions/team-discord-group-deliveries';
import { DiscordApiError } from '../../netlify/functions/_lib/discord-client';

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), outsider = id(2), player = id(3), coach = id(4);
const team = id(10), otherTeam = id(11), archive = id(20), otherArchive = id(21), route = id(30), otherRoute = id(31);
const match = id(40), secondMatch = id(41), foreignMatch = id(42), requestId = id(50), category = id(60);
const guild = '100000000000000001', channel = '100000000000000002', otherChannel = '100000000000000003', messageId = '100000000000000099';
const context = { deploy: { context: 'production' } } as any;
const rows = async (query: string, params: any[] = []) => (await state.pg.query(query, params)).rows as any[];
const receipts = () => rows('select * from discord_group_exports order by created_at,id');
function get(endpoint: string, input: any = {}) {
  const params = new URLSearchParams({ teamId: team, archiveId: archive, routeId: route, ...input });
  return new Request(`https://nxt5.test/.netlify/functions/${endpoint}?${params}`);
}
function post(input: any = {}, origin = 'https://nxt5.test') {
  return new Request('https://nxt5.test/.netlify/functions/team-discord-group-publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ teamId: team, archiveId: archive, routeId: route, requestId, ...input }),
  });
}
async function response(result: Promise<Response>) { const res = await result; return { status: res.status, body: await res.json() }; }
const send = (input: any = {}, ctx = context) => response(publishEndpoint(post(input), ctx));
const verify = (input: any = {}) => send({ action: 'verify', ...input });
async function preview(input = {}) {
  const result = await response(previewEndpoint(get('team-discord-group-preview', input), context));
  expect(result.status).toBe(200);
  return result.body;
}

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const file of ['20260915_discord_publications.sql', '20260921_discord_shared_servers.sql', '20260924_discord_group_exports.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + file, import.meta.url), 'utf8'));
  }
  await state.pg.exec("create table app_schema_migrations(migration_key text primary key); insert into app_schema_migrations values('discord-publications-20260915-v1'),('discord-group-exports-20260924-v1')");
}, 30_000);
afterAll(async () => state.pg?.close());
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const [key, value] of Object.entries({ CONTEXT: 'production', PUBLIC_SITE_URL: 'https://nxt5.test', DISCORD_APPLICATION_ID: '100000000000000010',
    DISCORD_BOT_TOKEN: 'test-only', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'b'.repeat(40), DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  for (const key of ['auth', 'send', 'guild', 'find', 'render', 'rate']) state[key].mockReset();
  state.failReceipt = false;
  state.auth.mockResolvedValue({ id: owner }); state.send.mockResolvedValue({ id: messageId, channel_id: channel }); state.find.mockResolvedValue(null);
  state.guild.mockResolvedValue({ guild: { id: guild, name: 'Équipe' }, channels: [{ id: channel, name: 'scrims', canSend: true }, { id: otherChannel, name: 'autre', canSend: true }] });
  state.render.mockResolvedValue({ bytes: Buffer.from([137, 80, 78, 71]), filename: 'nxt5-group.png', width: 1200, height: 1000 });
  await state.pg.exec('truncate users cascade');
  for (const user of [owner, outsider, player, coach]) await rows("insert into users(id,account_name,name,password_hash) values($1,$2,$2,'unused')", [user, `test-${user}`]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Arcane','ARC'),($3,$4,'Autre','ALT')", [team, owner, otherTeam, outsider]);
  await rows("insert into team_members(team_id,user_id,role) values($1,$2,'player'),($1,$3,'coach')", [team, player, coach]);
  await rows("insert into discord_connections(team_id,guild_id,status,created_by) values($1,$2,'active',$3),($4,$2,'active',$5)", [team, guild, owner, otherTeam, outsider]);
  await rows("insert into discord_routes(id,team_id,guild_id,channel_id,channel_name,automatic,mention_role_id) values($1,$2,$3,$4,'scrims',false,'100000000000000077'),($5,$6,$3,$7,'autre',false,null)", [route, team, guild, channel, otherRoute, otherTeam, otherChannel]);
  await rows("insert into matches(id,team_id,game_id,result,opponent,main_issue) values($1,$2,'GAME1','Victoire','Rivals','PRIVATE NOTE'),($3,$2,'GAME2','Défaite','Other rivals','PRIVATE REVIEW'),($4,$5,'SECRET','Victoire','Secret team',null)", [match, team, secondMatch, foreignMatch, otherTeam]);
  await rows("insert into match_archives(id,team_id,name,match_ids) values($1,$2,'Bloc scrims',$3),($4,$5,'Autre groupe',$6)", [archive, team, JSON.stringify([match, secondMatch]), otherArchive, otherTeam, JSON.stringify([foreignMatch])]);
});

describe('group export endpoints: real PostgreSQL, mocked Discord and PNG', () => {
  it('previews and publishes one factual PNG for the entire group with no mentions or private notes', async () => {
    const prepared = await preview();
    expect(prepared).toMatchObject({ imageDataUrl: 'data:image/png;base64,iVBORw==', sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/), previewToken: expect.any(String), message: { embeds: [{ title: 'Arcane · Bloc scrims', description: '2 games · 1 victoire · 1 défaite' }] } });
    expect(state.send).not.toHaveBeenCalled();
    const sent = await send(prepared);
    expect(sent).toMatchObject({ status: 200, body: { publication: { requestId, status: 'succeeded', channelName: 'scrims', messageUrl: `https://discord.com/channels/${guild}/${channel}/${messageId}` } } });
    expect(state.send).toHaveBeenCalledOnce();
    const [path, options] = state.send.mock.calls[0];
    expect(path).toBe(`/channels/${channel}/messages`);
    expect(options).toMatchObject({ method: 'POST', files: [{ name: 'nxt5-group.png' }], body: { allowed_mentions: { parse: [], roles: [], users: [], replied_user: false }, enforce_nonce: true,
      components: [{ components: [{ label: 'Voir le groupe sur NXT5', url: expect.stringContaining('archive=' + archive) }] }] } });
    expect(JSON.stringify(options)).not.toContain('PRIVATE');
    expect(JSON.stringify(state.render.mock.calls)).not.toContain('PRIVATE');
    expect(await rows('select * from publication_jobs')).toHaveLength(0);
    expect(await receipts()).toHaveLength(1);
  });
  it('deduplicates both a repeated UUID and a fresh UUID for the same source and returns the effective UUID', async () => {
    const prepared = await preview(); const first = await send(prepared);
    expect(await send(prepared)).toEqual(first);
    expect(await send({ ...prepared, requestId: id(51) })).toEqual(first);
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('allows a changed group to publish a new summary after a fresh preview', async () => {
    await send(await preview());
    await rows("update matches set result='Victoire' where id=$1", [secondMatch]);
    const next = await send({ ...await preview(), requestId: id(51) });
    expect(next.body.publication).toMatchObject({ status: 'succeeded', requestId: id(51) });
    expect(state.send).toHaveBeenCalledTimes(2); expect(await receipts()).toHaveLength(2);
  });
  it('rejects stale source, changed destination, expired or tampered previews', async () => {
    let prepared = await preview();
    await rows("update match_archives set name='Changed' where id=$1", [archive]);
    expect((await send(prepared)).status).toBe(409);
    prepared = await preview(); await rows('update discord_connections set config_version=config_version+1 where team_id=$1', [team]);
    expect((await send(prepared)).status).toBe(409);
    prepared = await preview();
    expect((await send({ ...prepared, previewToken: prepared.previewToken + '0' })).status).toBe(409);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    expect((await send(prepared)).status).toBe(409); clock.mockRestore();
    expect(state.send).not.toHaveBeenCalled(); expect(await receipts()).toHaveLength(0);
  });
  it('binds previews to their staff user and team destination', async () => {
    const prepared = await preview(); state.auth.mockResolvedValue({ id: coach });
    expect((await send(prepared)).status).toBe(409);
    expect((await send({ ...prepared, routeId: otherRoute })).status).toBe(404);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('rejects foreign and missing games, empty groups and category-incompatible groups', async () => {
    for (const ids of [[match, foreignMatch], [match, id(99)], []]) {
      await rows('update match_archives set match_ids=$2 where id=$1', [archive, JSON.stringify(ids)]);
      expect((await response(previewEndpoint(get('team-discord-group-preview'), context))).status).toBe(409);
    }
    await rows('update match_archives set match_ids=$2 where id=$1', [archive, JSON.stringify([match, secondMatch])]);
    await rows("insert into match_categories(id,team_id,name) values($1,$2,'Scrim')", [category, team]);
    await rows('update discord_routes set category_ids=$2 where id=$1', [route, JSON.stringify([category])]);
    await rows('update matches set category_ids=$2 where id=$1', [match, JSON.stringify([category])]);
    expect((await response(previewEndpoint(get('team-discord-group-preview'), context))).status).toBe(409);
    await rows('update matches set category_ids=$2 where id=$1', [secondMatch, JSON.stringify([category])]);
    expect((await preview()).sourceHash).toBeTruthy(); expect(state.send).not.toHaveBeenCalled();
  });
  it('permits an honest paused preview but blocks publication while paused or disabled', async () => {
    await rows("update discord_connections set status='paused' where team_id=$1", [team]);
    const prepared = await preview(); expect((await send(prepared)).status).toBe(409);
    await rows("update discord_connections set status='active' where team_id=$1", [team]);
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'false'); expect((await send(prepared)).status).toBe(409);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('revalidates changes made during rendering and before dispatch', async () => {
    const prepared = await preview();
    state.render.mockImplementationOnce(async () => {
      await rows("update match_archives set name='Changed during PNG' where id=$1", [archive]);
      return { bytes: Buffer.from([137, 80]), filename: 'nxt5-group.png' };
    });
    const result = await send(prepared);
    expect(result.body.publication).toMatchObject({ status: 'failed', errorCode: 'DISCORD_GROUP_PREVIEW_REQUIRED' });
    expect(state.send).not.toHaveBeenCalled();
  });
  it('refuses an inaccessible or newly reconfigured destination before claiming an export', async () => {
    const prepared = await preview();
    state.guild.mockResolvedValueOnce({ guild: { id: guild }, channels: [{ id: channel, canSend: false }] });
    expect((await send(prepared)).status).toBe(409);
    state.guild.mockImplementationOnce(async () => {
      await rows('update discord_connections set config_version=config_version+1 where team_id=$1', [team]);
      return { guild: { id: guild }, channels: [{ id: channel, canSend: true }] };
    });
    expect((await send(prepared)).status).toBe(409);
    expect(state.send).not.toHaveBeenCalled(); expect(await receipts()).toHaveLength(0);
  });
  it('fences simultaneous requests with the same and different request UUIDs', async () => {
    const prepared = await preview();
    let release!: (result: any) => void, started!: () => void;
    const reached = new Promise<void>(resolve => { started = resolve; });
    state.send.mockImplementationOnce(async () => { started(); return new Promise(resolve => { release = resolve; }); });
    const first = send(prepared); await reached;
    expect((await send(prepared)).body.publication).toMatchObject({ status: 'sending', requestId });
    expect((await send({ ...prepared, requestId: id(51) })).body.publication).toMatchObject({ status: 'sending', requestId });
    release({ id: messageId, channel_id: channel }); await first;
    expect(state.send).toHaveBeenCalledOnce(); expect(await receipts()).toHaveLength(1);
  });
  it('persists uncertain delivery and blocks new revisions until read-only reconciliation confirms it', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    const prepared = await preview();
    expect((await send(prepared)).body.publication.status).toBe('uncertain');
    await rows("update match_archives set name='Next summary' where id=$1", [archive]);
    expect((await send({ ...await preview(), requestId: id(51) })).body.publication).toMatchObject({ status: 'uncertain', requestId });
    state.find.mockResolvedValueOnce({ id: messageId, channel_id: otherChannel });
    expect((await verify()).body.publication.status).toBe('uncertain');
    state.find.mockResolvedValueOnce({ id: messageId, channel_id: channel });
    expect((await verify()).body.publication).toMatchObject({ status: 'succeeded', requestId });
    expect(state.send).toHaveBeenCalledOnce();
    expect(state.find).toHaveBeenCalledWith(channel, { reference: `group:${team}:${requestId}`, after: expect.any(Date) });
  });
  it('retains the original destination and receipt after route/group deletion', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    await send(await preview());
    await rows('delete from match_archives where id=$1', [archive]); await rows('delete from discord_routes where id=$1', [route]);
    state.find.mockResolvedValueOnce({ id: messageId, channel_id: channel });
    expect((await verify()).body.publication.status).toBe('succeeded');
    expect(state.send).toHaveBeenCalledOnce(); expect(await receipts()).toHaveLength(1);
  });
  it('confirms an exact older message only after checking the bot author, destination and unique footer', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    await send(await preview());
    state.send.mockResolvedValueOnce({ id: messageId, channel_id: channel, author: { id: '100000000000000088' }, embeds: [{ footer: { text: `NXT5 · group:${team}:${requestId}` } }] });
    const result = await verify({ messageId });
    expect(result.body.publication).toMatchObject({ status: 'succeeded', requestId, lastError: null });
    expect(state.send).toHaveBeenLastCalledWith(`/channels/${channel}/messages/${messageId}`);
    expect(state.send.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(state.find).not.toHaveBeenCalled();
  });
  it('keeps uncertainty for another message author, reference, channel or inaccessible exact message', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    await send(await preview());
    const matching = { id: messageId, channel_id: channel, author: { id: '100000000000000088' }, embeds: [{ footer: { text: `NXT5 · group:${team}:${requestId}` } }] };
    for (const wrong of [{ ...matching, author: { id: '100000000000000087' } }, { ...matching, channel_id: otherChannel }, { ...matching, embeds: [{ footer: { text: 'NXT5 · unrelated' } }] }]) {
      state.send.mockResolvedValueOnce(wrong);
      expect((await verify({ messageId })).body.publication).toMatchObject({ status: 'uncertain', errorCode: 'DISCORD_GROUP_MESSAGE_MISMATCH', lastError: expect.stringContaining('ne correspond pas') });
    }
    state.send.mockRejectedValueOnce(new DiscordApiError(404, 'DISCORD_NOT_FOUND'));
    expect((await verify({ messageId })).body.publication).toMatchObject({ status: 'uncertain', errorCode: 'DISCORD_GROUP_VERIFY_FAILED' });
    expect((await verify({ messageId: 'https://discord.com/channels/invalid' })).status).toBe(400);
    expect(state.send.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect((await receipts())[0].status).toBe('uncertain');
  });
  it('recovers successful sends when receipt storage fails without a second Discord mutation', async () => {
    const prepared = await preview(); state.failReceipt = true;
    expect((await send(prepared)).body.publication.status).toBe('uncertain');
    state.find.mockResolvedValueOnce({ id: messageId, channel_id: channel });
    expect((await verify()).body.publication.status).toBe('succeeded'); expect(state.send).toHaveBeenCalledOnce();
  });
  it('never treats a malformed Discord success as permission to resend', async () => {
    state.send.mockResolvedValueOnce({ id: messageId, channel_id: otherChannel });
    const prepared = await preview();
    expect((await send(prepared)).body.publication).toMatchObject({ status: 'uncertain', errorCode: 'DISCORD_INVALID_RESPONSE' });
    expect((await send({ ...prepared, requestId: id(51) })).body.publication.status).toBe('uncertain');
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('shows old sending records as uncertain and preserves the fence', async () => {
    await send(await preview());
    await rows("update discord_group_exports set status='sending',message_id=null,completed_at=null,created_at=now()-interval '2 minutes'");
    expect((await verify()).body.publication).toMatchObject({ status: 'uncertain', errorCode: 'DISCORD_GROUP_UNCONFIRMED' });
    expect((await send({ ...await preview(), requestId: id(51) })).body.publication.status).toBe('uncertain');
    expect(state.send).toHaveBeenCalledOnce();
  });
  it('records definite rejection and permits only an explicit fresh attempt', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(403, 'DISCORD_FORBIDDEN'));
    const prepared = await preview(); const first = await send(prepared);
    expect(first.body.publication).toMatchObject({ status: 'failed', errorCode: 'DISCORD_FORBIDDEN' });
    expect(await send(prepared)).toEqual(first);
    expect((await send({ ...await preview(), requestId: id(51) })).body.publication.status).toBe('succeeded');
    expect(state.send).toHaveBeenCalledTimes(2);
  });
  it('shows and sends the same explicit text fallback for an oversized group', async () => {
    state.render.mockRejectedValue(Object.assign(new Error('Too tall'), { code: 'GROUP_PNG_TOO_LARGE' }));
    const prepared = await preview();
    expect(prepared.imageDataUrl).toBeNull(); expect(prepared.message.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Visuel', value: expect.stringContaining('trop volumineux') }));
    expect((await send(prepared)).body.publication.status).toBe('succeeded');
    expect(state.send.mock.calls[0][1].files).toBeUndefined();
    expect(state.send.mock.calls[0][1].body.embeds[0].fields).toEqual(prepared.message.embeds[0].fields);
  });
  it('requires a fresh preview if the attachment availability changes', async () => {
    const prepared = await preview(); state.render.mockRejectedValueOnce(Object.assign(new Error('Too tall'), { code: 'GROUP_PNG_TOO_LARGE' }));
    expect((await send(prepared)).status).toBe(409); expect(state.send).not.toHaveBeenCalled();
  });
  it('uses the explicit text fallback when PNG bytes exceed the API response budget', async () => {
    state.render.mockResolvedValue({ bytes: Buffer.alloc(3 * 1024 * 1024 + 1), filename: 'nxt5-group.png' });
    const prepared = await preview(); expect(prepared.imageDataUrl).toBeNull();
    expect((await send(prepared)).body.publication.status).toBe('succeeded');
    expect(state.send.mock.calls[0][1].files).toBeUndefined();
  });
  it('provides not_found recovery and team-scoped historical receipts without needing live group data', async () => {
    expect((await verify()).body.publication).toMatchObject({ requestId, status: 'not_found', messageUrl: null });
    await send(await preview());
    const history = await response(historyEndpoint(get('team-discord-group-deliveries'), context));
    expect(history.body.publications).toHaveLength(1); expect(history.body.publications[0].status).toBe('succeeded');
    expect((await response(historyEndpoint(get('team-discord-group-deliveries', { archiveId: otherArchive }), context))).body.publications).toEqual([]);
    expect((await verify({ archiveId: otherArchive })).status).toBe(409);
  });
  it('enforces staff roles, CSRF, preview isolation and schema readiness', async () => {
    const prepared = await preview();
    for (const user of [outsider, player]) {
      state.auth.mockResolvedValue({ id: user }); expect((await send(prepared)).status).toBe(403);
      expect((await response(previewEndpoint(get('team-discord-group-preview'), context))).status).toBe(403);
    }
    state.auth.mockResolvedValue({ id: owner });
    expect((await response(publishEndpoint(post(prepared, 'https://evil.test'), context))).status).toBe(403);
    expect((await send(prepared, { deploy: { context: 'deploy-preview' } })).status).toBe(409);
    await rows("delete from app_schema_migrations where migration_key='discord-group-exports-20260924-v1'");
    expect((await send(prepared)).status).toBe(503);
    await rows("insert into app_schema_migrations values('discord-group-exports-20260924-v1')");
    expect(state.send).not.toHaveBeenCalled();
  });
});
