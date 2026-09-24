import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn(), send: vi.fn(), guild: vi.fn(), getAsset: vi.fn(), putAsset: vi.fn(), render: vi.fn(), rate: vi.fn(), wake: vi.fn() }));
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
vi.mock('../../netlify/functions/_lib/discord-client', async (original) => ({ ...await original<any>(), discordRequest: state.send, getDiscordGuild: state.guild, getDiscordBotUserId: async () => '100000000000000088' }));
vi.mock('../../netlify/functions/_lib/publication-assets', () => ({ getPublicationAsset: state.getAsset, putPublicationAsset: state.putAsset }));
vi.mock('../../netlify/functions/_lib/publication-render', () => ({ renderGamePublicationPng: state.render }));

import deliveries from '../../netlify/functions/team-discord-deliveries';
import publish from '../../netlify/functions/team-discord-publish';
import retry from '../../netlify/functions/team-discord-retry';
import routes from '../../netlify/functions/team-discord-routes';
import asset from '../../netlify/functions/publication-asset';
import { DiscordApiError } from '../../netlify/functions/_lib/discord-client';
import { publicationReference } from '../../netlify/functions/_lib/discord-worker';

const id = (value: number) => `20000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const owner = id(1), otherOwner = id(2), coach = id(3), player = id(4);
const team = id(10), otherTeam = id(11), match = id(20), secondMatch = id(21), otherMatch = id(22);
const route = id(30), otherRoute = id(31), category = id(40), otherCategory = id(41);
const guild = '100000000000000001', channel = '100000000000000002';
const otherGuild = '100000000000000003', otherChannel = '100000000000000004';
const bot = '100000000000000088', message = '100000000000000099', role = '100000000000000077';
const rows = async (sql: string, params: unknown[] = []) => (await state.pg.query(sql, params)).rows as any[];
function get(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`https://nxt5.example/.netlify/functions/${endpoint}`);
  for (const [key, value] of Object.entries({ teamId: team, ...params })) url.searchParams.set(key, value);
  return new Request(url);
}
function post(body: object) {
  return new Request('https://nxt5.example/.netlify/functions/team-discord-retry', { method: 'POST', headers: { origin: 'https://nxt5.example', 'content-type': 'application/json' }, body: JSON.stringify({ teamId: team, ...body }) });
}
async function seedPublication({ publicationId = id(50), jobId = id(60), snapshotId = id(70), targetTeam = team, targetMatch = match, targetRoute = route, targetChannel = channel, targetGuild = guild, status = 'succeeded', publicationState = 'published' } = {}) {
  await rows("insert into discord_publications(id,team_id,entity_id,route_id,channel_id,guild_id,message_id,published_revision,desired_revision,state) values($1,$2,$3,$4,$5,$6,$7,1,1,$8)", [publicationId, targetTeam, targetMatch, targetRoute, targetChannel, targetGuild, message, publicationState]);
  await rows("insert into publication_jobs(id,publication_id,team_id,entity_id,source_revision,config_version,status,attempts) values($1,$2,$3,$4,1,1,$5,1)", [jobId, publicationId, targetTeam, targetMatch, status]);
  await rows("insert into publication_snapshots(id,publication_id,source_revision,content_hash,body,asset_key) values($1,$2,1,'test-hash',$3::jsonb,$4)", [snapshotId, publicationId, JSON.stringify({ entityId: targetMatch, teamId: targetTeam, renderOptions: { includeHints: false } }), `${targetTeam}/${snapshotId}/game.png`]);
  await rows("insert into discord_deliveries(publication_id,job_id,snapshot_id,source_revision,attempt,message_id,status) values($1,$2,$3,1,1,$4,$5)", [publicationId, jobId, snapshotId, message, status === 'uncertain' ? 'uncertain' : 'succeeded']);
  return { publicationId, jobId, snapshotId };
}

beforeAll(async () => {
  state.pg = new PGlite();
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')");
  await state.pg.exec(schema);
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260915_discord_publications.sql', import.meta.url), 'utf8'));
  await state.pg.exec("create table app_schema_migrations(migration_key text primary key); insert into app_schema_migrations values('discord-publications-20260915-v1')");
}, 30_000);
beforeEach(async () => {
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID']) vi.stubEnv(key, '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const [key, value] of Object.entries({ CONTEXT: 'production', PUBLIC_SITE_URL: 'https://nxt5.example', DISCORD_APPLICATION_ID: '100000000000000010', DISCORD_BOT_TOKEN: 'test-only', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'test-only-worker-secret-longer-than-32', DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  for (const key of ['auth', 'send', 'guild', 'getAsset', 'putAsset', 'render', 'rate', 'wake']) state[key].mockReset();
  state.auth.mockResolvedValue({ id: owner });
  state.send.mockResolvedValue(null);
  state.rate.mockResolvedValue(undefined);
  state.getAsset.mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
  state.putAsset.mockResolvedValue({ key: `${team}/${id(70)}/game.png` });
  state.render.mockResolvedValue({ bytes: new Uint8Array([137, 80, 78, 71]), mimeType: 'image/png', width: 100, height: 100, filename: 'game.png' });
  state.guild.mockResolvedValue({ guild: { id: guild, name: 'Test' }, channels: [{ id: channel, name: 'scrims', canSend: true, canMentionRoles: false }], roles: [{ id: role, name: 'Players', mentionable: false }] });
  await state.pg.exec('truncate users cascade');
  for (const user of [owner, otherOwner, coach, player]) await rows("insert into users(id,account_name,name,password_hash) values($1,$2,$2,'unused')", [user, `test-${user}`]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Team A','AAA'),($3,$4,'Team B','BBB')", [team, owner, otherTeam, otherOwner]);
  await rows("insert into team_members(team_id,user_id,role) values($1,$2,'coach'),($1,$3,'player')", [team, coach, player]);
  await rows("insert into match_categories(id,team_id,name) values($1,$2,'Scrims'),($3,$4,'Private')", [category, team, otherCategory, otherTeam]);
  await rows("insert into discord_connections(team_id,guild_id,status,enabled_at,created_by) values($1,$2,'active',now()-interval '1 hour',$3),($4,$5,'active',now()-interval '1 hour',$6)", [team, guild, owner, otherTeam, otherGuild, otherOwner]);
  await rows("insert into discord_routes(id,team_id,guild_id,channel_id,channel_name,automatic) values($1,$2,$3,$4,'scrims',false),($5,$6,$7,$8,'private',false)", [route, team, guild, channel, otherRoute, otherTeam, otherGuild, otherChannel]);
  await rows("insert into matches(id,team_id,game_id,opponent) values($1,$2,'TEST_A1','A1'),($3,$2,'TEST_A2','A2'),($4,$5,'TEST_B','Private B')", [match, team, secondMatch, otherMatch, otherTeam]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('Immediate manual Discord publication', () => {
  const request = (overrides: object = {}) => post({ matchId: match, routeId: route, snapshotRevision: 1, ...overrides });

  it('sends the requested game immediately, ignores older backlog and returns the confirmed Discord link', async () => {
    const backlog = await seedPublication({ targetMatch: secondMatch, status: 'queued', publicationState: 'pending' });
    state.send.mockResolvedValue({ id: message });
    const response = await publish(request(), {} as any);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({ status: 'succeeded', matchId: match, channelId: channel,
      routeId: route, configVersion: 1, revision: 1, errorCode: null, lastError: null,
      messageUrl: `https://discord.com/channels/${guild}/${channel}/${message}` });
    expect(result.jobs[0].updatedAt).toBeTruthy();
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.send).toHaveBeenCalledWith(`/channels/${channel}/messages`, expect.objectContaining({ method: 'POST' }));
    expect(await rows('select status,attempts from publication_jobs where id=$1', [backlog.jobId])).toEqual([{ status: 'queued', attempts: 1 }]);
    expect(state.wake).toHaveBeenCalledTimes(1);
  });

  it('returns the actual failure category and lets the same explicit share recover after the token is fixed', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(401, 'DISCORD_UNAUTHORIZED'));
    const failed = await (await publish(request(), {} as any)).json();
    expect(failed.jobs[0]).toMatchObject({ status: 'blocked', errorCode: 'DISCORD_UNAUTHORIZED', messageUrl: null });
    expect(failed.jobs[0].lastError).toContain('jeton du bot');
    const history = await (await deliveries(get('team-discord-deliveries', { matchId: match }), {} as any)).json();
    expect(history.deliveries[0]).toMatchObject({ id: failed.jobs[0].id, errorCode: 'DISCORD_UNAUTHORIZED',
      channelId: channel, routeId: route, configVersion: 1, revision: 1, updatedAt: failed.jobs[0].updatedAt });
    state.send.mockResolvedValue({ id: message });
    const retried = await (await publish(request(), {} as any)).json();
    expect(retried.jobs[0]).toMatchObject({ id: failed.jobs[0].id, status: 'succeeded', errorCode: null, lastError: null });
    expect(await rows('select status,attempts,retry_base_attempts from publication_jobs')).toEqual([{ status: 'succeeded', attempts: 2, retry_base_attempts: 1 }]);
    expect(await rows('select attempt,status from discord_deliveries order by attempt')).toEqual([{ attempt: 1, status: 'blocked' }, { attempt: 2, status: 'succeeded' }]);
  });

  it('never double-sends during another request, after confirmation, or after an uncertain acknowledgement', async () => {
    let announce!: () => void;
    let release!: () => void;
    const sending = new Promise<void>(resolve => { announce = resolve; });
    const complete = new Promise<void>(resolve => { release = resolve; });
    state.send.mockImplementationOnce(async () => { announce(); await complete; return { id: message }; });
    const first = publish(request(), {} as any);
    await sending;
    try {
      const concurrent = await publish(request(), {} as any);
      expect(concurrent.status).toBe(202);
      expect((await concurrent.json()).jobs[0]).toMatchObject({ status: 'sending', messageUrl: null });
      expect(state.send).toHaveBeenCalledTimes(1);
    } finally { release(); }
    expect((await (await first).json()).jobs[0].status).toBe('succeeded');
    expect((await (await publish(request(), {} as any)).json()).jobs[0].status).toBe('succeeded');
    expect(state.send).toHaveBeenCalledTimes(1);

    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    const uncertain = await (await publish(request({ matchId: secondMatch }), {} as any)).json();
    expect(uncertain.jobs[0]).toMatchObject({ status: 'uncertain', messageUrl: null });
    expect(uncertain.jobs[0].lastError).toContain('Vérifie le salon');
    expect((await (await publish(request({ matchId: secondMatch }), {} as any)).json()).jobs[0].status).toBe('uncertain');
    expect(state.send).toHaveBeenCalledTimes(2);
  });

  it('preserves Discord rate-limit backoff when publish is clicked again', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(429, 'DISCORD_RATE_LIMITED', { retryAfter: 30 }));
    const first = await publish(request(), {} as any);
    expect(first.status).toBe(202);
    const job = (await first.json()).jobs[0];
    expect(job).toMatchObject({ status: 'retry_wait', errorCode: 'DISCORD_RATE_LIMITED', messageUrl: null });
    const second = await publish(request(), {} as any);
    expect(second.status).toBe(202);
    expect((await second.json()).jobs[0]).toMatchObject({ id: job.id, status: 'retry_wait' });
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it('does not expose raw rendering errors and refuses foreign destinations before sending', async () => {
    expect((await publish(request({ routeId: otherRoute }), {} as any)).status).toBe(404);
    expect((await publish(request({ matchId: otherMatch }), {} as any)).status).toBe(404);
    expect(state.send).not.toHaveBeenCalled();
    state.render.mockRejectedValueOnce(new Error('SECRET_PROVIDER_DEBUG'));
    const failed = await publish(request(), {} as any);
    expect(failed.status).toBe(202);
    const text = await failed.text();
    expect(text).not.toContain('SECRET_PROVIDER_DEBUG');
    expect(JSON.parse(text).jobs[0]).toMatchObject({ status: 'retry_wait', errorCode: 'DISCORD_PUBLICATION_FAILED', messageUrl: null });
    expect(state.send).not.toHaveBeenCalled();
  });

  it('correlates polling with this explicit request instead of an old blocked job or another team', async () => {
    const requestId = id(90);
    const old = await seedPublication({ status: 'blocked', publicationState: 'blocked' });
    const lookup = () => deliveries(get('team-discord-deliveries', { matchId: match, requestId }), {} as any);
    expect((await (await lookup()).json()).deliveries).toEqual([]);
    // Even a matching request identifier on another team cannot attach an old job.
    await rows("insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values($1,'discord.publish_requested','team',$2,$3::jsonb)",
      [otherOwner, otherTeam, JSON.stringify({ requestId, jobIds: [old.jobId] })]);
    expect((await (await lookup()).json()).deliveries).toEqual([]);
    state.send.mockResolvedValue({ id: message });
    const response = await (await publish(request({ requestId }), {} as any)).json();
    expect(response.requestId).toBe(requestId);
    const found = (await (await lookup()).json()).deliveries;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: response.jobs[0].id, status: 'succeeded' });
    expect((await (await deliveries(get('team-discord-deliveries', { requestId: id(91) }), {} as any)).json()).deliveries).toEqual([]);
    expect((await deliveries(get('team-discord-deliveries', { requestId: 'not-a-uuid' }), {} as any)).status).toBe(400);
    expect((await publish(request({ requestId: 'not-a-uuid' }), {} as any)).status).toBe(400);
  });
});

describe('Discord withdrawal HTTP lifecycle', () => {
  it('preserves pending removal after a network error, retries idempotent DELETE, and never republishes', async () => {
    const record = await seedPublication();
    await rows("insert into publication_jobs(id,publication_id,team_id,entity_id,source_revision,config_version,status) values($1,$2,$3,$4,2,1,'queued')", [id(61), record.publicationId, team, match]);
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    const failed = await retry(post({ action: 'remove', deliveryId: record.jobId }), {} as any);
    expect(failed.status).toBe(503);
    expect(await rows('select state from discord_publications where id=$1', [record.publicationId])).toEqual([{ state: 'withdrawn' }]);
    expect((await rows('select status,last_error_code from publication_jobs order by source_revision'))).toEqual([
      { status: 'succeeded', last_error_code: 'WITHDRAW_RETRY_REQUIRED' }, { status: 'cancelled', last_error_code: 'WITHDRAW_RETRY_REQUIRED' },
    ]);
    const pending = await (await deliveries(get('team-discord-deliveries', { matchId: match }), {} as any)).json();
    expect(pending.deliveries).toHaveLength(2);
    expect(pending.deliveries.every((row) => row.status === 'withdrawal_pending' && row.canRemove && !row.canRetry && row.messageUrl?.includes(message))).toBe(true);
    await rows("update matches set opponent='corrected' where id=$1", [match]);
    expect((await rows('select * from publication_jobs'))).toHaveLength(2);
    state.send.mockRejectedValueOnce(new DiscordApiError(404, 'DISCORD_NOT_FOUND'));
    expect((await retry(post({ action: 'remove', deliveryId: record.jobId }), {} as any)).status).toBe(200);
    expect(state.send.mock.calls.every(([path, options]) => path === `/channels/${channel}/messages/${message}` && options.method === 'DELETE')).toBe(true);
    expect(await rows('select distinct last_error_code from publication_jobs')).toEqual([{ last_error_code: 'PUBLICATION_WITHDRAWN' }]);
    expect(await rows('select status from discord_deliveries')).toEqual([{ status: 'withdrawn' }]);
    const done = await (await deliveries(get('team-discord-deliveries'), {} as any)).json();
    expect(done.deliveries.every((row) => row.status === 'withdrawn' && !row.canRemove && !row.canRetry && !row.messageUrl)).toBe(true);
    expect((await retry(post({ action: 'retry', deliveryId: id(61) }), {} as any)).status).toBe(409);
  });
  it('refuses deletion during an active lease or uncertainty, and refuses foreign-team jobs', async () => {
    const own = await seedPublication();
    const foreign = await seedPublication({ publicationId: id(51), jobId: id(62), snapshotId: id(72), targetTeam: otherTeam, targetMatch: otherMatch, targetRoute: otherRoute, targetGuild: otherGuild, targetChannel: otherChannel });
    await rows("update discord_publications set lease_expires_at=now()+interval '1 minute' where id=$1", [own.publicationId]);
    expect((await retry(post({ action: 'remove', deliveryId: own.jobId }), {} as any)).status).toBe(409);
    expect((await retry(post({ action: 'remove', deliveryId: foreign.jobId }), {} as any)).status).toBe(409);
    await rows("update discord_publications set state='uncertain',lease_expires_at=null where id=$1", [own.publicationId]);
    expect((await retry(post({ action: 'remove', deliveryId: own.jobId }), {} as any)).status).toBe(409);
    expect(state.send).not.toHaveBeenCalled();
    expect((await rows('select state from discord_publications where id=$1', [foreign.publicationId]))[0].state).toBe('published');
    // A damaged cross-team job link must not defeat the endpoint's own scope.
    await rows("insert into publication_jobs(id,publication_id,team_id,entity_id,source_revision,config_version,status) values($1,$2,$3,$4,2,1,'succeeded')", [id(65), foreign.publicationId, team, match]);
    expect((await retry(post({ action: 'remove', deliveryId: id(65) }), {} as any)).status).toBe(409);
    const history = await (await deliveries(get('team-discord-deliveries'), {} as any)).json();
    expect(history.deliveries.every((row) => row.id !== id(65))).toBe(true);
    expect(state.send).not.toHaveBeenCalled();
  });
});

describe('Discord history and reconciliation endpoint scoping', () => {
  it('filters by both team and match and retains a removable reference after game deletion', async () => {
    await seedPublication();
    await seedPublication({ publicationId: id(51), jobId: id(61), snapshotId: id(71), targetMatch: secondMatch });
    await seedPublication({ publicationId: id(52), jobId: id(62), snapshotId: id(72), targetTeam: otherTeam, targetMatch: otherMatch, targetRoute: otherRoute, targetGuild: otherGuild, targetChannel: otherChannel });
    const filtered = await (await deliveries(get('team-discord-deliveries', { matchId: match }), {} as any)).json();
    expect(filtered.deliveries.map((row) => row.matchId)).toEqual([match]);
    const foreign = await (await deliveries(get('team-discord-deliveries', { matchId: otherMatch }), {} as any)).json();
    expect(foreign.deliveries).toEqual([]);
    expect((await deliveries(get('team-discord-deliveries', { teamId: otherTeam }), {} as any)).status).toBe(403);
    expect((await deliveries(get('team-discord-deliveries', { matchId: 'bad-id' }), {} as any)).status).toBe(400);
    await rows('delete from matches where id=$1', [match]);
    const deleted = await (await deliveries(get('team-discord-deliveries', { matchId: match }), {} as any)).json();
    expect(deleted.deliveries[0]).toMatchObject({ matchLabel: 'Game supprimée', canRemove: true });
    expect(deleted.deliveries[0].messageUrl).toContain(message);
  });
  it('requires staff access and the exact source team before reconciling an uncertain message', async () => {
    const own = await seedPublication({ status: 'uncertain', publicationState: 'uncertain' });
    const foreign = await seedPublication({ publicationId: id(51), jobId: id(61), snapshotId: id(71), targetTeam: otherTeam, targetMatch: otherMatch, targetRoute: otherRoute, targetGuild: otherGuild, targetChannel: otherChannel, status: 'uncertain', publicationState: 'uncertain' });
    state.auth.mockResolvedValue({ id: player });
    expect((await retry(post({ action: 'resolve', deliveryId: own.jobId, messageId: message }), {} as any)).status).toBe(403);
    state.auth.mockResolvedValue({ id: coach });
    expect((await retry(post({ action: 'resolve', deliveryId: foreign.jobId, messageId: message }), {} as any)).status).toBe(409);
    expect(state.send).not.toHaveBeenCalled();
    state.send.mockResolvedValue({ id: message, channel_id: channel, author: { id: bot }, embeds: [{ footer: { text: `NXT5 · ${publicationReference(own.publicationId, 1)}` } }] });
    expect((await retry(post({ action: 'resolve', deliveryId: own.jobId, messageId: message }), {} as any)).status).toBe(200);
    expect((await rows('select state from discord_publications where id=$1', [own.publicationId]))[0].state).toBe('published');
    expect((await rows('select status from publication_jobs where id=$1', [own.jobId]))[0].status).toBe('succeeded');
    expect((await rows("select action from audit_logs where action='discord.publication_reconciled'"))).toHaveLength(1);
    expect(state.wake).toHaveBeenCalled();
  });
});

describe('Discord route edits and retained publications', () => {
  it('deletes a destination without losing the known message and cancels pending revisions', async () => {
    const own = await seedPublication();
    await rows("insert into publication_jobs(id,publication_id,team_id,entity_id,source_revision,config_version,status) values($1,$2,$3,$4,2,1,'queued')", [id(61), own.publicationId, team, match]);
    const response = await routes(post({ routes: [] }), {} as any);
    expect(response.status).toBe(200);
    expect(await rows('select id from discord_routes where team_id=$1', [team])).toEqual([]);
    expect((await rows('select route_id,message_id from discord_publications where id=$1', [own.publicationId]))[0]).toEqual({ route_id: null, message_id: message });
    expect((await rows('select status from publication_jobs where id=$1', [id(61)]))[0].status).toBe('cancelled');
    const history = await (await deliveries(get('team-discord-deliveries'), {} as any)).json();
    expect(history.deliveries[0].canRemove).toBe(true);
    expect(history.deliveries[0].channelName).toBe(channel);
    expect((await retry(post({ action: 'remove', deliveryId: own.jobId }), {} as any)).status).toBe(200);
  });
  it('rejects malformed destinations, foreign categories and unauthorized mentions before changing policy', async () => {
    const valid = { channelId: channel, categoryIds: [category], includeHints: false, enabled: true };
    expect((await routes(post({ routes: [null] }), {} as any)).status).toBe(400);
    expect((await routes(post({ routes: [{ ...valid, categoryIds: [otherCategory] }] }), {} as any)).status).toBe(403);
    expect((await routes(post({ routes: [{ ...valid, mentionRoleId: role }] }), {} as any)).status).toBe(400);
    expect((await routes(post({ routes: [valid, valid] }), {} as any)).status).toBe(400);
    expect((await rows('select config_version from discord_connections where team_id=$1', [team]))[0].config_version).toBe(1);
    expect((await rows('select * from discord_routes where team_id=$1', [team]))).toHaveLength(1);
    state.auth.mockResolvedValue({ id: coach });
    expect((await routes(post({ routes: [valid] }), {} as any)).status).toBe(403);
  });
});

describe('Authenticated publication image endpoint', () => {
  it('serves only an accessible active snapshot and does not access storage for withdrawn, deleted or foreign images', async () => {
    const own = await seedPublication();
    const foreign = await seedPublication({ publicationId: id(51), jobId: id(61), snapshotId: id(71), targetTeam: otherTeam, targetMatch: otherMatch, targetRoute: otherRoute, targetGuild: otherGuild, targetChannel: otherChannel });
    state.auth.mockResolvedValue({ id: player });
    const image = await asset(get('publication-asset', { snapshotId: own.snapshotId }), {} as any);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('cache-control')).toBe('private, no-store');
    state.getAsset.mockClear();
    expect((await asset(get('publication-asset', { snapshotId: foreign.snapshotId }), {} as any)).status).toBe(404);
    expect(state.getAsset).not.toHaveBeenCalled();
    await rows("update discord_publications set state='withdrawn' where id=$1", [own.publicationId]);
    expect((await asset(get('publication-asset', { snapshotId: own.snapshotId }), {} as any)).status).toBe(404);
    await rows('delete from matches where id=$1', [match]);
    expect((await asset(get('publication-asset', { snapshotId: own.snapshotId }), {} as any)).status).toBe(404);
    expect(state.getAsset).not.toHaveBeenCalled();
    expect(state.render).not.toHaveBeenCalled();
  });
  it('rebuilds a purged image using the retained snapshot render policy', async () => {
    const own = await seedPublication();
    state.getAsset.mockResolvedValue(null);
    const response = await asset(get('publication-asset', { snapshotId: own.snapshotId }), {} as any);
    expect(response.status).toBe(200);
    expect(state.render).toHaveBeenCalledWith(expect.objectContaining({ teamId: team, renderOptions: { includeHints: false } }), { includeHints: false });
    expect(state.putAsset).toHaveBeenCalledWith(expect.objectContaining({ teamId: team, snapshotId: own.snapshotId }));
  });
});
