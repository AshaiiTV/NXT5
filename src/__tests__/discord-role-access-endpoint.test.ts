import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn(), guild: vi.fn(), rate: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => {
  const query = (statement: string | TemplateStringsArray, params: any[] = []) => {
    if (typeof statement !== 'string') {
      const values = params;
      const sql = statement.reduce((text, chunk, index) => text + (index ? `$${index}` : '') + chunk, '');
      return state.pg.query(sql, values).then((result: any) => result.rows);
    }
    return state.pg.query(statement, params).then((result: any) => result.rows);
  };
  // The schema guard uses a tagged template, while team access and settings
  // use parameterized text queries. Keep both styles backed by real PostgreSQL.
  const sql = (...args: any[]) => {
    if (Array.isArray(args[0]) && 'raw' in args[0]) {
      const strings = args[0] as TemplateStringsArray;
      const text = strings.reduce((value, chunk, index) => value + (index ? `$${index}` : '') + chunk, '');
      return state.pg.query(text, args.slice(1)).then((result: any) => result.rows);
    }
    return query(args[0], args[1]);
  };
  return { sql };
});
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: state.auth }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: state.rate }));
vi.mock('../../netlify/functions/_lib/discord-client', async (original) => ({ ...await original<any>(), getDiscordGuild: state.guild }));

import roleAccess from '../../netlify/functions/team-discord-role-access';

const id = (value: number) => `20000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const ownerA = id(1), ownerB = id(2), coach = id(3), player = id(4);
const teamA = id(10), teamB = id(11);
const guild = '100000000000000001', otherGuild = '100000000000000002';
const roleA = '100000000000000011', roleB = '100000000000000012', missingRole = '100000000000000013';
const rows = async (statement: string, params: unknown[] = []) => (await state.pg.query(statement, params)).rows as any[];
const context = {} as any;
function get(teamId = teamA) {
  return new Request(`https://nxt5.example/.netlify/functions/team-discord-role-access?teamId=${teamId}`);
}
function post(roleIds: unknown, { teamId = teamA, guildId = guild } = {}) {
  return new Request('https://nxt5.example/.netlify/functions/team-discord-role-access', {
    method: 'POST', headers: { origin: 'https://nxt5.example', 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, guildId, roleIds }),
  });
}

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const file of ['20260915_discord_publications.sql', '20260921_discord_connection_tests.sql', '20260921_discord_shared_servers.sql', '20260923_discord_bot_role_access.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + file, import.meta.url), 'utf8'));
  }
  await state.pg.exec("create table app_schema_migrations(migration_key text primary key); insert into app_schema_migrations values('discord-publications-20260915-v1'),('discord-bot-role-access-20260923-v1')");
}, 30_000);
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID']) vi.stubEnv(key, '');
  vi.stubEnv('CONTEXT', 'production');
  vi.stubEnv('PUBLIC_SITE_URL', 'https://nxt5.example');
  state.auth.mockReset(); state.guild.mockReset(); state.rate.mockReset();
  state.auth.mockResolvedValue({ id: ownerA });
  state.rate.mockResolvedValue(undefined);
  state.guild.mockResolvedValue({ guild: { id: guild, name: 'Commun' }, channels: [], roles: [{ id: roleA, name: 'Joueurs' }, { id: roleB, name: 'Staff' }] });
  await state.pg.exec('truncate users cascade');
  for (const user of [ownerA, ownerB, coach, player]) await rows("insert into users(id,account_name,name,password_hash) values($1,$2,$2,'unused')", [user, `test-${user}`]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Équipe A','AAA'),($3,$4,'Équipe B','BBB')", [teamA, ownerA, teamB, ownerB]);
  await rows("insert into team_members(team_id,user_id,role) values($1,$2,'coach'),($1,$3,'player')", [teamA, coach, player]);
  await rows("insert into discord_connections(team_id,guild_id,status,created_by) values($1,$3,'paused',$4),($2,$3,'paused',$5)", [teamA, teamB, guild, ownerA, ownerB]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('Team-specific Discord role access settings', () => {
  it('keeps role policies separate even when two teams share one Discord server', async () => {
    expect((await roleAccess(post([roleA]), context)).status).toBe(200);
    expect(await (await roleAccess(get(), context)).json()).toEqual({ guildId: guild, configuredGuildId: guild, roleIds: [roleA], enabled: true });
    expect((await roleAccess(get(teamB), context)).status).toBe(403);
    state.auth.mockResolvedValue({ id: ownerB });
    expect((await roleAccess(post([roleB], { teamId: teamB }), context)).status).toBe(200);
    expect(await rows('select team_id,guild_id,role_ids from discord_bot_role_access order by team_id')).toEqual([
      { team_id: teamA, guild_id: guild, role_ids: [roleA] },
      { team_id: teamB, guild_id: guild, role_ids: [roleB] },
    ]);
    expect(await (await roleAccess(get(teamB), context)).json()).toMatchObject({ roleIds: [roleB], enabled: true });
  });

  it('allows staff to read but only an owner or captain to change a policy', async () => {
    state.auth.mockResolvedValue({ id: coach });
    expect((await roleAccess(get(), context)).status).toBe(200);
    expect((await roleAccess(post([roleA]), context)).status).toBe(403);
    state.auth.mockResolvedValue({ id: player });
    expect((await roleAccess(get(), context)).status).toBe(403);
    state.auth.mockResolvedValue({ id: ownerA });
    await rows("update team_members set role='captain' where team_id=$1 and user_id=$2", [teamA, coach]);
    state.auth.mockResolvedValue({ id: coach });
    expect((await roleAccess(post([roleA]), context)).status).toBe(200);
    expect(state.guild).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed, duplicate, everyone, foreign, managed and excessive role IDs', async () => {
    for (const values of [null, [roleA, roleA], [guild], [missingRole], Array.from({ length: 26 }, (_, i) => String(100000000000000100n + BigInt(i)))]) {
      const response = await roleAccess(post(values), context);
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect((await roleAccess(post([roleA], { guildId: otherGuild }), context)).status).toBe(409);
    expect(await rows('select * from discord_bot_role_access')).toEqual([]);
  });

  it('retains an old policy across relinking and removes it only for the current server', async () => {
    expect((await roleAccess(post([roleA]), context)).status).toBe(200);
    await rows("update discord_connections set guild_id=$2 where team_id=$1", [teamA, otherGuild]);
    expect(await (await roleAccess(get(), context)).json()).toEqual({ guildId: otherGuild, configuredGuildId: guild, roleIds: [roleA], enabled: true });
    expect((await roleAccess(post([], { guildId: guild }), context)).status).toBe(409);
    expect(await rows('select role_ids from discord_bot_role_access where team_id=$1', [teamA])).toEqual([{ role_ids: [roleA] }]);
    expect((await roleAccess(post([], { guildId: otherGuild }), context)).status).toBe(200);
    expect(await rows('select * from discord_bot_role_access where team_id=$1', [teamA])).toEqual([]);
  });

  it('fails closed while the new schema migration is pending', async () => {
    await rows("delete from app_schema_migrations where migration_key='discord-bot-role-access-20260923-v1'");
    try {
      const response = await roleAccess(get(), context);
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe('DISCORD_BOT_ROLE_ACCESS_SCHEMA_REQUIRED');
    } finally {
      await rows("insert into app_schema_migrations values('discord-bot-role-access-20260923-v1')");
    }
  });
});
