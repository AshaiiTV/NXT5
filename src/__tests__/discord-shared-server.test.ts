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
import deliveries from '../../netlify/functions/team-discord-deliveries';
import { DiscordApiError } from '../../netlify/functions/_lib/discord-client';
import { claimPublicationJob, enqueueManualPublication } from '../../netlify/functions/_lib/discord-queue';

const id = (value: number) => `40000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const ownerA = id(1), ownerB = id(2), teamA = id(10), teamB = id(11), routeA = id(20), routeB = id(21);
const categoryA = id(30), categoryB = id(31), matchA = id(40), matchB = id(41), requestId = id(50);
const guild = '100000000000000001', channel = '100000000000000002', messageA = '100000000000000003', messageB = '100000000000000004';
const context = { deploy: { context: 'production' } } as any;
const rows = async (query: string, values: unknown[] = []) => (await state.pg.query(query, values)).rows as any[];
const get = (endpoint: string, teamId = teamA) => new Request(`https://nxt5.example/.netlify/functions/${endpoint}?teamId=${teamId}`);
const post = (endpoint: string, body: object) => new Request(`https://nxt5.example/.netlify/functions/${endpoint}`, {
  method: 'POST', headers: { origin: 'https://nxt5.example', 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const testSend = (teamId = teamA, routeId = routeA) => connectionTest(post('team-discord-test', { teamId, routeId, requestId }), context);

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const filename of ['20260915_discord_publications.sql', '20260921_discord_connection_tests.sql', '20260921_discord_shared_servers.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + filename, import.meta.url), 'utf8'));
  }
  await state.pg.exec("create table app_schema_migrations(migration_key text primary key); insert into app_schema_migrations values('discord-publications-20260915-v1'),('discord-connection-tests-20260921-v1'),('discord-shared-servers-20260921-v1')");
}, 30_000);
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const [key, value] of Object.entries({ CONTEXT: 'production', PUBLIC_SITE_URL: 'https://nxt5.example', DISCORD_APPLICATION_ID: '100000000000000010', DISCORD_BOT_TOKEN: 'test-only', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'test-only-worker-secret-longer-than-32', DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  for (const key of ['auth', 'send', 'guild', 'find', 'render', 'rate']) state[key].mockReset();
  state.auth.mockResolvedValue({ id: ownerA });
  state.send.mockResolvedValue({ id: messageA, channel_id: channel });
  state.find.mockResolvedValue(null);
  state.rate.mockResolvedValue(undefined);
  state.render.mockResolvedValue({ bytes: Buffer.from([137, 80, 78, 71]), mimeType: 'image/png', width: 1440, height: 2500, filename: 'nxt5-demo.png' });
  state.guild.mockResolvedValue({ guild: { id: guild, name: 'Shared organisation' }, channels: [{ id: channel, name: 'shared-games', canSend: true }], roles: [] });
  await state.pg.exec('truncate users cascade');
  await rows("insert into users(id,account_name,name,password_hash) values($1,'owner-a','Owner A','unused'),($2,'owner-b','Owner B','unused')", [ownerA, ownerB]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Team A','AAA'),($3,$4,'Team B','BBB')", [teamA, ownerA, teamB, ownerB]);
  await rows("insert into match_categories(id,team_id,name) values($1,$2,'Scrims A'),($3,$4,'Scrims B')", [categoryA, teamA, categoryB, teamB]);
  await rows("insert into discord_connections(team_id,guild_id,status,created_by) values($1,$3,'paused',$4),($2,$3,'paused',$5)", [teamA, teamB, guild, ownerA, ownerB]);
  await rows("insert into discord_routes(id,team_id,guild_id,channel_id,channel_name,automatic) values($1,$2,$5,$6,'shared-games',true),($3,$4,$5,$6,'shared-games',true)", [routeA, teamA, routeB, teamB, guild, channel]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('Several NXT5 teams in one Discord server', () => {
  it('keeps destination settings and their versions scoped to the managed team, even for the exact same channel', async () => {
    const otherBefore = (await rows('select * from discord_routes where team_id=$1', [teamB]))[0];
    const response = await routesEndpoint(post('team-discord-routes', { teamId: teamA, routes: [{
      channelId: channel, categoryIds: [categoryA], includeHints: true, enabled: false,
    }] }), context);
    expect(response.status).toBe(200);
    expect((await rows('select * from discord_routes where team_id=$1', [teamB]))[0]).toEqual(otherBefore);
    expect(await (await routesEndpoint(get('team-discord-routes'), context)).json()).toMatchObject({
      guildId: guild, configVersion: 2, routes: [{ id: routeA, channelId: channel, categoryIds: [categoryA], includeHints: true, enabled: false }],
    });
    state.auth.mockResolvedValue({ id: ownerB });
    expect(await (await routesEndpoint(get('team-discord-routes', teamB), context)).json()).toMatchObject({
      guildId: guild, configVersion: 1, routes: [{ id: routeB, channelId: channel, categoryIds: [], includeHints: false, enabled: true }],
    });
    expect((await rows('select * from discord_routes where guild_id=$1 and channel_id=$2', [guild, channel]))).toHaveLength(2);
  });
  it('does not grant another NXT5 team access merely because its Discord server is shared', async () => {
    expect((await routesEndpoint(get('team-discord-routes', teamB), context)).status).toBe(403);
    expect((await connection(get('team-discord-connection', teamB), context)).status).toBe(403);
    expect((await connectionTest(get('team-discord-test', teamB), context)).status).toBe(403);
    expect((await deliveries(get('team-discord-deliveries', teamB), context)).status).toBe(403);
    expect((await testSend(teamA, routeB)).status).toBe(409);
    expect((await testSend(teamB, routeB)).status).toBe(403);
    expect((await routesEndpoint(post('team-discord-routes', { teamId: teamA, routes: [{ channelId: channel, categoryIds: [categoryB] }] }), context)).status).toBe(403);
    expect(state.send).not.toHaveBeenCalled();
    expect(await rows('select * from discord_connection_tests')).toEqual([]);
  });
  it('allows separate tests for each team with the same request UUID and channel, without sharing uncertainty or message references', async () => {
    state.send.mockRejectedValueOnce(new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: true }));
    expect(await (await testSend()).json()).toMatchObject({ test: { requestId, status: 'uncertain', routeId: routeA } });
    state.auth.mockResolvedValue({ id: ownerB });
    state.send.mockResolvedValueOnce({ id: messageB, channel_id: channel });
    expect(await (await testSend(teamB, routeB)).json()).toMatchObject({ test: { requestId, status: 'succeeded', routeId: routeB, messageUrl: expect.stringContaining(messageB) } });
    expect(state.send).toHaveBeenCalledTimes(2);
    const [first, second] = state.send.mock.calls.map(([, options]) => options.body);
    expect(first.embeds[0].footer.text).toContain(teamA);
    expect(second.embeds[0].footer.text).toContain(teamB);
    expect(first.nonce).not.toBe(second.nonce);
    const previewB = await (await connectionTest(get('team-discord-test', teamB), context)).json();
    expect(previewB.latestTest.status).toBe('succeeded'); expect(previewB.pendingTests).toEqual([]);
    state.auth.mockResolvedValue({ id: ownerA });
    const previewA = await (await connectionTest(get('team-discord-test'), context)).json();
    expect(previewA.latestTest.status).toBe('uncertain');
    expect(previewA.pendingTests).toHaveLength(1);
    expect(previewA.pendingTests[0].routeId).toBe(routeA);
    await testSend();
    expect(state.find).toHaveBeenCalledWith(channel, expect.objectContaining({ reference: `connection-test:${teamA}:${requestId}` }));
    expect(state.send).toHaveBeenCalledTimes(2);
    expect(await rows('select team_id,status from discord_connection_tests order by team_id')).toEqual([
      { team_id: teamA, status: 'uncertain' }, { team_id: teamB, status: 'succeeded' },
    ]);
  });
  it('queues and corrects the same imported game independently for each team and pauses only the selected team', async () => {
    await rows("update discord_connections set status='active',enabled_at=now()-interval '1 hour'");
    for (const [match, team] of [[matchA, teamA], [matchB, teamB]]) {
      await rows("insert into matches(id,team_id,game_id,opponent) values($1,$2,'SAME_IMPORTED_GAME','Opponent')", [match, team]);
    }
    const publications = await rows('select id,team_id,entity_id,route_id,channel_id,guild_id from discord_publications order by team_id');
    expect(publications).toEqual([
      expect.objectContaining({ team_id: teamA, entity_id: matchA, route_id: routeA, channel_id: channel, guild_id: guild }),
      expect.objectContaining({ team_id: teamB, entity_id: matchB, route_id: routeB, channel_id: channel, guild_id: guild }),
    ]);
    expect(publications[0].id).not.toBe(publications[1].id);
    const jobsBefore = await rows('select * from publication_jobs where team_id=$1', [teamB]);
    await expect(enqueueManualPublication({ teamId: teamA, matchId: matchA, routeId: routeB, expectedRevision: 1 })).rejects.toMatchObject({ status: 404 });
    await rows("update matches set opponent='Corrected A' where id=$1", [matchA]);
    expect((await rows('select source_revision from publication_jobs where team_id=$1 order by source_revision', [teamA]))).toEqual([{ source_revision: 1 }, { source_revision: 2 }]);
    expect(await rows('select * from publication_jobs where team_id=$1', [teamB])).toEqual(jobsBefore);
    expect((await connection(post('team-discord-connection', { teamId: teamA, action: 'pause' }), context)).status).toBe(200);
    expect(await rows('select team_id,status from discord_connections order by team_id')).toEqual([
      { team_id: teamA, status: 'paused' }, { team_id: teamB, status: 'active' },
    ]);
    await rows("update publication_jobs set available_at=now()-interval '1 second'");
    const claimed = await claimPublicationJob();
    expect(claimed).toMatchObject({ team_id: teamB, entity_id: matchB, publication_id: publications[1].id, status: 'preparing' });
    expect(await claimPublicationJob()).toBeNull();
    const history = await (await deliveries(get('team-discord-deliveries'), context)).json();
    expect(history.deliveries).toHaveLength(2);
    expect(history.deliveries.every((item) => item.matchId === matchA)).toBe(true);
  });
  it('disconnects one team without changing another connection, route, job or test on the shared server', async () => {
    await rows("update discord_connections set status='active',enabled_at=now()-interval '1 hour'");
    for (const [match, team] of [[matchA, teamA], [matchB, teamB]]) await rows("insert into matches(id,team_id,game_id,opponent) values($1,$2,'SAME_GAME','Opponent')", [match, team]);
    await testSend();
    state.auth.mockResolvedValue({ id: ownerB });
    await testSend(teamB, routeB);
    state.auth.mockResolvedValue({ id: ownerA });
    const otherState = async () => Promise.all(['discord_connections', 'discord_routes', 'publication_jobs', 'discord_connection_tests']
      .map((table) => rows(`select * from ${table} where team_id=$1`, [teamB])));
    const before = await otherState();
    expect((await connection(post('team-discord-connection', { teamId: teamA, action: 'disconnect' }), context)).status).toBe(200);
    expect(await otherState()).toEqual(before);
    expect((await rows('select status from discord_connections where team_id=$1', [teamA]))[0].status).toBe('disconnected');
    expect((await rows('select status from publication_jobs where team_id=$1', [teamA]))[0].status).toBe('cancelled');
    await rows('delete from teams where id=$1', [teamA]);
    expect(await otherState()).toEqual(before);
  });
});
