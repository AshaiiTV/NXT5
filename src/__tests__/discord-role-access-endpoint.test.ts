import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn(), guild: vi.fn(), rate: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  // Keep Neon lazy queries and transaction serialization backed by PostgreSQL.
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return { fields: result.fields, rows: result.rows.map((row: any) => result.fields.map((field: any) => {
        const value = row[field.name];
        if (value === null || value === undefined) return null;
        if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
        if (Array.isArray(value)) return `{${value.join(',')}}`;
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
  it.each(['save', 'remove'])('refuses %s after a captain is demoted during the request', async (action) => {
    await rows("update team_members set role='captain' where team_id=$1 and user_id=$2", [teamA, coach]);
    await rows('insert into discord_bot_role_access(team_id,guild_id,role_ids) values($1,$2,$3::text[])', [teamA, guild, [roleB]]);
    const before = await rows('select * from discord_bot_role_access');
    state.auth.mockResolvedValue({ id: coach });
    state.rate.mockImplementationOnce(async () => {
      await rows("update team_members set role='player' where team_id=$1 and user_id=$2", [teamA, coach]);
    });
    expect((await roleAccess(post(action === 'save' ? [roleA] : []), context)).status).toBe(409);
    expect(await rows('select * from discord_bot_role_access')).toEqual(before);
    expect(await rows('select * from audit_logs')).toEqual([]);
  });

  it('refuses a captain removed during the remote role lookup', async () => {
    await rows("update team_members set role='captain' where team_id=$1 and user_id=$2", [teamA, coach]);
    state.auth.mockResolvedValue({ id: coach });
    state.guild.mockImplementationOnce(async () => {
      await rows('delete from team_members where team_id=$1 and user_id=$2', [teamA, coach]);
      return { guild: { id: guild }, roles: [{ id: roleA }] };
    });
    expect((await roleAccess(post([roleA]), context)).status).toBe(409);
    expect(await rows('select * from discord_bot_role_access')).toEqual([]);
    expect(await rows('select * from audit_logs')).toEqual([]);
  });

  it('refuses a policy for a server unlinked during the remote role lookup', async () => {
    state.guild.mockImplementationOnce(async () => {
      await rows('update discord_connections set guild_id=$2 where team_id=$1', [teamA, otherGuild]);
      return { guild: { id: guild }, roles: [{ id: roleA }] };
    });
    expect((await roleAccess(post([roleA]), context)).status).toBe(409);
    expect(await rows('select * from discord_bot_role_access')).toEqual([]);
    expect(await rows('select * from audit_logs')).toEqual([]);
  });

  it.each(['save', 'remove'])('rolls back %s when its audit cannot be persisted', async (action) => {
    await rows('insert into discord_bot_role_access(team_id,guild_id,role_ids) values($1,$2,$3::text[])', [teamA, guild, [roleB]]);
    const before = await rows('select * from discord_bot_role_access');
    await rows("alter table audit_logs add constraint reject_role_audit check(action not like 'discord.bot_role_access_%')");
    try {
      expect((await roleAccess(post(action === 'save' ? [roleA] : []), context)).status).toBe(500);
      expect(await rows('select * from discord_bot_role_access')).toEqual(before);
      expect(await rows('select * from audit_logs')).toEqual([]);
    } finally { await rows('alter table audit_logs drop constraint reject_role_audit'); }
  });

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
