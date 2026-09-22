import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn(), sql: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: state.sql }));
vi.mock('../../netlify/functions/_lib/auth', async original => ({ ...await original<any>(), requireAuth: state.auth }));

import handler from '../../netlify/functions/admin-discord-analytics';
import { discordAnalyticsDays, discordAnalyticsSchemaReady, readDiscordAnalytics } from '../../netlify/functions/_lib/discord-analytics';

const id = (value: number) => `60000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const owner = id(1), teamA = id(10), teamB = id(11), teamC = id(12);
const guild = '100000000000000001', historicGuild = '100000000000000002';
const channel = '100000000000000003', historicChannel = '100000000000000004';
const now = new Date('2026-09-22T12:00:00.000Z');
const context = { deploy: { context: 'production' } } as any;
const rows = async (query: string, params: any[] = []) => (await state.pg.query(query, params)).rows;
const request = (query = '') => new Request(`https://nxt5.example/.netlify/functions/admin-discord-analytics${query}`);

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const filename of ['20260915_discord_publications.sql', '20260921_discord_connection_tests.sql', '20260921_discord_shared_servers.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + filename, import.meta.url), 'utf8'));
  }
}, 30_000);

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('PLATFORM_ADMIN_USER_ID', owner);
  vi.stubEnv('PLATFORM_ADMIN_EMAIL', '');
  state.auth.mockReset().mockResolvedValue({ id: owner });
  state.sql.mockReset().mockImplementation(rows);
  await state.pg.exec('truncate users cascade; truncate discord_interaction_receipts');
  await rows("insert into users(id,account_name,name,password_hash) values($1,'owner','Owner','unused')", [owner]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$4,'Team A','AAA'),($2,$4,'Team B','BBB'),($3,$4,'Historical team','HIS')", [teamA, teamB, teamC, owner]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

async function seedActivity() {
  await rows(`insert into discord_connections(team_id,guild_id,status) values
    ($1,$4,'active'),($2,$4,'paused'),($3,$5,'disconnected')`, [teamA, teamB, teamC, guild, historicGuild]);
  await rows(`insert into discord_routes(id,team_id,guild_id,channel_id,channel_name,enabled,automatic) values
    ($1,$4,$7,$8,'shared-games',true,true),($2,$5,$7,$8,'shared-games',false,false),
    ($3,$6,$9,$10,'old-channel',true,false)`, [id(20), id(21), id(22), teamA, teamB, teamC, guild, channel, historicGuild, historicChannel]);
  await rows(`insert into discord_publications(id,team_id,entity_id,guild_id,channel_id,state,message_id) values
    ($1,$4,$7,$10,$12,'published','known-message-a'),($2,$5,$8,$10,$12,'blocked',null),
    ($3,$6,$9,$11,$13,'withdrawn','known-message-c')`,
    [id(30), id(31), id(32), teamA, teamB, teamC, id(40), id(41), id(42), guild, historicGuild, channel, historicChannel]);
  await rows(`insert into publication_jobs(id,publication_id,team_id,entity_id,source_revision,config_version,status) values
    ($1,$6,$9,$12,1,1,'succeeded'),($2,$6,$9,$12,2,1,'succeeded'),
    ($3,$7,$10,$13,1,1,'blocked'),($4,$8,$11,$14,1,1,'succeeded'),($5,$7,$10,$13,2,1,'queued')`,
    [id(50), id(51), id(52), id(53), id(54), id(30), id(31), id(32), teamA, teamB, teamC, id(40), id(41), id(42)]);
  for (const [publication, job, revision, attempt, status, at, message] of [
    [30, 50, 1, 1, 'retry_wait', '2026-09-20T10:00:00Z', null],
    [30, 50, 1, 2, 'succeeded', '2026-09-20T11:00:00Z', 'known-message-a'],
    [30, 51, 2, 1, 'succeeded', '2026-09-21T10:00:00Z', 'known-message-a'],
    [31, 52, 1, 1, 'blocked', '2026-09-21T10:01:00Z', null],
    [31, 52, 1, 2, 'uncertain', '2026-09-21T10:02:00Z', null],
    [31, 52, 1, 3, 'sending', '2026-09-21T10:03:00Z', null],
    [32, 53, 1, 1, 'withdrawn', '2026-09-10T10:00:00Z', 'known-message-c'],
  ] as const) await rows(`insert into discord_deliveries(publication_id,job_id,source_revision,attempt,status,created_at,message_id,error_message)
    values($1,$2,$3,$4,$5,$6,$7,'private-provider-body')`, [id(publication), id(job), revision, attempt, status, at, message]);
  await rows(`insert into discord_interaction_receipts(interaction_id,guild_id,discord_user_id,command_name,status,response_text,created_at) values
    ('i1',$1,'private-discord-user','statut','completed','private-response','2026-09-22T10:00:00Z'),
    ('i2',$1,'private-discord-user','statut','failed','private-response','2026-09-21T10:00:00Z'),
    ('i3',$2,'private-discord-user','aide','completed','private-response','2026-09-16T13:00:00Z'),
    ('expired',$1,'private-discord-user','connecter','completed','private-response','2026-09-01T10:00:00Z')`, [guild, historicGuild]);
  await rows(`insert into discord_connection_tests(team_id,request_id,route_id,guild_id,channel_id,config_version,status,message_id,created_at,completed_at) values
    ($1,$2,$3,$4,$5,1,'succeeded','test-message','2026-09-21T10:10:00Z','2026-09-21T10:10:01Z'),
    ($1,$6,$3,$4,$5,1,'failed',null,'2026-09-21T10:15:00Z','2026-09-21T10:15:01Z')`,
    [teamA, id(60), id(20), guild, channel, id(61)]);
}

describe('Discord analytics report', () => {
  it('counts shared guilds/channels once and separates real sends, retries, tests and commands', async () => {
    await seedActivity();
    const report = await readDiscordAnalytics(30, now);
    expect(report.summary).toMatchObject({
      connections: 2, activeConnections: 1, pausedConnections: 1, disconnectedConnections: 1,
      guilds: 1, activeGuilds: 1, channels: 1, enabledChannels: 1,
      publications: 2, deliveryAttempts: 7, successfulDeliveries: 3, failedDeliveries: 2,
      pendingDeliveries: 1, uncertainDeliveries: 1, queuedJobs: 1, blockedJobs: 1,
      commands: 3, failedCommands: 1, connectionTests: 2, successRate: 60,
    });
    expect(report.commands).toEqual([
      { name: 'statut', count: 2, completed: 1, failed: 1, processing: 0 },
      { name: 'aide', count: 1, completed: 1, failed: 0, processing: 0 },
    ]);
    expect(report.guilds.find(g => g.guildId === guild)).toMatchObject({
      connections: 2, channels: 1, publications: 1, successfulDeliveries: 2, failedDeliveries: 2, commands: 2,
      teams: [{ teamId: teamA, teamName: 'Team A', status: 'active' }, { teamId: teamB, teamName: 'Team B', status: 'paused' }],
      destinations: [{ channelId: channel, channelName: 'shared-games', enabled: true, automatic: true,
        currentlyConfigured: true, publications: 1, successfulDeliveries: 2, failedDeliveries: 2, teamNames: ['Team A', 'Team B'] }],
    });
    expect(report.daily.reduce((sum, day) => sum + day.publications, 0)).toBe(report.summary.publications);
    expect(report.daily.reduce((sum, day) => sum + day.successfulDeliveries, 0)).toBe(report.summary.successfulDeliveries);
    expect(report.daily.find(day => day.date === '2026-09-21')).toMatchObject({ publications: 0, successfulDeliveries: 1, failedDeliveries: 1 });
    const serialized = JSON.stringify(report);
    for (const secret of ['private-discord-user', 'private-response', 'private-provider-body', 'test-message', 'known-message-a']) expect(serialized).not.toContain(secret);
  });

  it('retains historical usage locations after disconnecting/relinking and deleting their route', async () => {
    await seedActivity();
    const before = await readDiscordAnalytics(30, now);
    expect(before.guilds.find(g => g.guildId === historicGuild).destinations[0].channelName).toBe('old-channel');
    await rows('delete from discord_routes where team_id=$1', [teamC]);
    await rows("update discord_connections set guild_id='100000000000000099',status='active' where team_id=$1", [teamC]);
    const report = await readDiscordAnalytics(30, now);
    expect(report.summary.guilds).toBe(2);
    expect(report.guilds.find(g => g.guildId === historicGuild)).toMatchObject({
      connections: 0, channels: 0, publications: 1, successfulDeliveries: 1, commands: 1, teams: [],
      destinations: [{ channelId: historicChannel, channelName: null, currentlyConfigured: false,
        publications: 1, successfulDeliveries: 1, failedDeliveries: 0, teamNames: ['Historical team'] }],
    });
    expect(report.recentActivity.find(item => item.kind === 'delivery' && item.guildId === historicGuild)).toMatchObject({
      teamName: 'Historical team', channelId: historicChannel, channelName: null, status: 'withdrawn',
    });
  });

  it('applies UTC periods and advertises the seven-day command retention without inventing historical zeroes', async () => {
    await seedActivity();
    const short = await readDiscordAnalytics(7, now);
    expect(short.period).toEqual({ days: 7, from: '2026-09-16T00:00:00.000Z', to: now.toISOString(), timeZone: 'UTC' });
    expect(short.daily).toHaveLength(7);
    expect(short.summary.publications).toBe(1);
    expect(short.coverage.commandsPartial).toBe(false);
    const long = await readDiscordAnalytics(90, now);
    expect(long.daily).toHaveLength(90);
    expect(long.coverage).toMatchObject({ commandsFrom: '2026-09-15T12:00:00.000Z', commandsPartial: true, commandsRetentionDays: 7 });
    expect(long.daily.find(day => day.date === '2026-09-14').commands).toBeNull();
    expect(long.daily.find(day => day.date === '2026-09-15').commands).toBe(0);
    expect(long.summary.commands).toBe(3);
    expect(long.commands.some(command => command.name === 'connecter')).toBe(false);
  });

  it('returns an honest empty state with null success rate and a complete day series', async () => {
    const report = await readDiscordAnalytics(7, now);
    expect(report.summary).toMatchObject({ connections: 0, guilds: 0, channels: 0, publications: 0, deliveryAttempts: 0, commands: 0, successRate: null });
    expect(report.daily).toHaveLength(7);
    expect(report.guilds).toEqual([]);
    expect(report.recentActivity).toEqual([]);
  });

  it('bounds activity to the selected interval and limits recent history without losing aggregated totals', async () => {
    await seedActivity();
    await rows("update discord_deliveries set created_at='2026-09-22T12:00:01Z' where status='sending'");
    await rows("update discord_deliveries set created_at='2026-06-01T00:00:00Z' where status='withdrawn'");
    for (let i = 0; i < 35; i++) {
      await rows(`insert into discord_interaction_receipts(interaction_id,guild_id,discord_user_id,command_name,status,created_at)
        values($1,$2,'private-user','aide','completed','2026-09-22T11:00:00Z')`, ['extra-' + i, guild]);
    }
    const report = await readDiscordAnalytics(30, now);
    expect(report.summary).toMatchObject({ commands: 38, publications: 1, deliveryAttempts: 5, pendingDeliveries: 0 });
    expect(report.recentActivity).toHaveLength(30);
    expect(report.recentActivity.every(item => item.kind === 'command' && item.commandName === 'aide')).toBe(true);
    expect(report.daily.reduce((sum, day) => sum + (day.commands || 0), 0)).toBe(38);
  });
});

describe('Admin analytics access and failure semantics', () => {
  it('requires the configured platform administrator before reading statistics', async () => {
    state.auth.mockResolvedValue({ id: id(999) });
    expect((await handler(request(), context)).status).toBe(403);
    expect(state.sql).not.toHaveBeenCalled();
    state.auth.mockRejectedValue(Object.assign(new Error('Authentification requise.'), { status: 401 }));
    expect((await handler(request(), context)).status).toBe(401);
    expect(state.sql).not.toHaveBeenCalled();
  });

  it('rejects writes and unsupported periods, and keeps responses uncached', async () => {
    expect((await handler(new Request(request(), { method: 'POST' }), context)).status).toBe(405);
    expect((await handler(request('?days=365'), context)).status).toBe(400);
    expect(state.sql).not.toHaveBeenCalled();
    expect(discordAnalyticsDays(null)).toBe(30);
    for (const bad of ['', '30junk', '-7', '007', '30.0']) expect(() => discordAnalyticsDays(bad)).toThrow();
    const response = await handler(request('?days=7'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).schemaReady).toBe(true);
  });

  it('does not present database failures as missing migrations or zero-valued statistics', async () => {
    state.sql.mockResolvedValueOnce([{ ready: false }]);
    const missing = await (await handler(request(), context)).json();
    expect(missing).toMatchObject({ schemaReady: false, code: 'DISCORD_SCHEMA_REQUIRED' });
    expect(missing.summary).toBeUndefined();
    state.sql.mockRejectedValueOnce(Object.assign(new Error('private database detail'), { code: '08006' }));
    const failed = await handler(request(), context);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'Erreur serveur.', code: '08006' });
    expect(await discordAnalyticsSchemaReady()).toBe(true);
  });
});
