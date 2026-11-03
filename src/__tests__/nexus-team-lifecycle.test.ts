import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ pg: null as any }));
const identity = vi.hoisted(() => ({ userId: '', admin: null as any }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret: () => {}, requireAuth: async () => ({ id: identity.userId }) }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: async () => identity.admin }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/safe-log', () => ({ logFailure: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value == null) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', field.dataTypeID === 1184 ? '+00' : '');
          return String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) {
        const results = await db.pg.transaction(async (tx: any) => {
          const results = [];
          for (const query of body.queries) results.push(await execute(tx, query));
          return results;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(db.pg, body)));
    } catch (err: any) {
      return new Response(JSON.stringify({ message: err.message, code: err.code, constraint: err.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nexus-lifecycle') };
});

import deleteTeam from '../../netlify/functions/teams-delete';
import accountLifecycle from '../../netlify/functions/admin-account-lifecycle';
import { createSeason, updateSeason, registerTeam, reviewRegistration, generateSchedule } from '../../netlify/functions/_lib/nexus-tournament-store';

const admin = '00000000-0000-4000-8000-000000000001', owner = '00000000-0000-4000-8000-000000000002', other = '00000000-0000-4000-8000-000000000003', session = '00000000-0000-4000-8000-000000000004';
const context = { deploy: { context: 'production' }, cookies: { get: () => 'token', set: vi.fn() } } as any;
const rows = async (query: string, values: any[] = []) => (await db.pg.query(query, values)).rows;
const post = (path: string, body: any) => new Request(`https://nxt5.org/.netlify/functions/${path}`, { method: 'POST', headers: { Origin: 'https://nxt5.org', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const config = { name: 'Saison test', format: 'round_robin', legs: 1, regularBestOf: 1, playoffEnabled: false, playoffSize: 4, playoffBestOf: 1, playoffFormat: 'single_elimination', finalBestOf: 1, rulesConfirmed: true };
const teams: Record<string, { id: string; players: { id: string; riotId: string }[] }> = {};

async function nativeTeam(name: string, ownerId: string) {
  const id = randomUUID();
  await db.pg.query("insert into teams(id, owner_id, name, tag) values ($1, $2, $3, 'TAG')", [id, ownerId, name]);
  const players = [];
  for (let index = 0; index < 5; index++) {
    const player = { id: randomUUID(), riotId: `${name} ${index + 1}#EUW` };
    await db.pg.query('insert into players(id, team_id, name, riot_id, role) values ($1, $2, $3, $4, $5)', [player.id, id, `Joueur ${index + 1}`, player.riotId, ['TOP', 'JGL', 'MID', 'ADC', 'SUP'][index]]);
    players.push(player);
  }
  return (teams[name] = { id, players });
}
async function openSeason() {
  const season = await createSeason(config);
  await updateSeason({ seasonId: season.id, status: 'open' });
  return season;
}
async function removeTeam(teamId: string, userId = owner) {
  identity.userId = userId;
  const response = await deleteTeam(post('teams-delete', { teamId }), context);
  return { status: response.status, body: await response.json() };
}
async function deleteAccount() {
  const snapshot = await (await accountLifecycle(new Request(`https://nxt5.org/.netlify/functions/admin-account-lifecycle?userId=${owner}`, { headers: { Origin: 'https://nxt5.org' } }), context)).json();
  const response = await accountLifecycle(post('admin-account-lifecycle', { action: 'delete', userId: owner, confirmAccount: 'player', expectedRevision: snapshot.account.revision, expectedOwnedTeams: snapshot.ownedTeams }), context);
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  db.pg = new PGlite();
  await db.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  await db.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
}, 30_000);
afterAll(async () => { await db.pg?.close(); });
beforeEach(async () => {
  identity.userId = owner;
  identity.admin = { id: admin, email: 'admin@example.test', session_id: session };
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID']) vi.stubEnv(key, '');
  await db.pg.exec('truncate users cascade; truncate audit_logs; truncate nexus_seasons cascade;');
  await rows("insert into users(id, name, account_name, password_hash, email, email_verified) values ($1, 'Admin', 'admin', 'hash', 'admin@example.test', true), ($2, 'Player', 'player', 'hash', 'player@example.test', true), ($3, 'Other', 'other', 'hash', 'other@example.test', true)", [admin, owner, other]);
  await rows("insert into sessions(id, user_id, token_hash, expires_at) values ($1, $2, 'admin-token', now() + interval '1 day')", [session, admin]);
  await nativeTeam('Alpha', owner);
  await nativeTeam('Beta', other);
});

describe('deleting a team or an account engaged in Nexus Rising', () => {
  it('refuses the owner while the registration is pending or approved in an open or running season', async () => {
    const season = await openSeason();
    const registration = await registerTeam(owner, { seasonId: season.id, teamId: teams.Alpha.id });
    expect(await removeTeam(teams.Alpha.id)).toMatchObject({ status: 409, body: { code: 'NEXUS_TEAM_ENGAGED' } });
    await reviewRegistration({ registrationId: registration.id, status: 'approved' });
    await registerTeam(other, { seasonId: season.id, teamId: teams.Beta.id }).then(row => reviewRegistration({ registrationId: row.id, status: 'approved' }));
    await generateSchedule({ seasonId: season.id });
    await updateSeason({ seasonId: season.id, status: 'running' });
    expect(await removeTeam(teams.Alpha.id)).toMatchObject({ status: 409, body: { code: 'NEXUS_TEAM_ENGAGED' } });
    expect(await rows('select id from teams where id = $1', [teams.Alpha.id])).toHaveLength(1);
    expect(await rows('select id from audit_logs')).toHaveLength(0);
    // A stranger still receives the ownership refusal, never the league state.
    expect((await removeTeam(teams.Alpha.id, other)).status).toBe(403);
  });

  it('deletes the team once its registration is rejected', async () => {
    const season = await openSeason();
    const registration = await registerTeam(owner, { seasonId: season.id, teamId: teams.Alpha.id });
    await reviewRegistration({ registrationId: registration.id, status: 'rejected' });
    expect((await removeTeam(teams.Alpha.id)).status).toBe(200);
    expect(await rows('select id from nexus_registrations')).toHaveLength(0);
    expect(await rows('select id from teams where id = $1', [teams.Alpha.id])).toHaveLength(0);
  });

  it('deletes the team after the season completed and keeps the fixture names without the link', async () => {
    const season = await openSeason();
    for (const [team, user] of [[teams.Alpha, owner], [teams.Beta, other]] as const) {
      const registration = await registerTeam(user, { seasonId: season.id, teamId: team.id });
      await reviewRegistration({ registrationId: registration.id, status: 'approved' });
    }
    await generateSchedule({ seasonId: season.id });
    await rows("update nexus_seasons set status = 'completed'");
    expect((await removeTeam(teams.Alpha.id)).status).toBe(200);
    expect(await rows('select team_id from nexus_registrations')).toEqual([{ team_id: teams.Beta.id }]);
    expect(await rows('select registration_id from nexus_season_players where registration_id not in (select id from nexus_registrations)')).toHaveLength(0);
    // Sides are drawn at generation; the deleted team keeps its name on either side.
    const [fixture] = await rows('select team_a, team_b, team_a_id, team_b_id from nexus_fixtures');
    const sides = [[fixture.team_a, fixture.team_a_id], [fixture.team_b, fixture.team_b_id]].sort(([name]) => (name === 'Alpha' ? -1 : 1));
    expect(sides).toEqual([['Alpha', null], ['Beta', teams.Beta.id]]);
  });

  it('refuses the administrator deletion of an engaged owner, then succeeds once the season completed', async () => {
    const season = await openSeason();
    const registration = await registerTeam(owner, { seasonId: season.id, teamId: teams.Alpha.id });
    await reviewRegistration({ registrationId: registration.id, status: 'approved' });
    expect(await deleteAccount()).toMatchObject({ status: 409, body: { code: 'NEXUS_TEAM_ENGAGED' } });
    expect(await rows('select id from users where id = $1', [owner])).toHaveLength(1);
    await rows("update nexus_seasons set status = 'completed'");
    expect((await deleteAccount()).status).toBe(200);
    expect(await rows('select id from users where id = $1', [owner])).toHaveLength(0);
    expect(await rows('select id from nexus_registrations')).toHaveLength(0);
    expect(await rows("select id from audit_logs where action = 'admin.account.delete'")).toHaveLength(1);
  });
});

describe('season seats of a registration', () => {
  it('frees the players of a rejected registration so another team can enroll them', async () => {
    const season = await openSeason();
    await rows('update players set riot_id = $1 where id = $2', [teams.Alpha.players[0].riotId, teams.Beta.players[0].id]);
    const alpha = await registerTeam(owner, { seasonId: season.id, teamId: teams.Alpha.id });
    const beta = await registerTeam(other, { seasonId: season.id, teamId: teams.Beta.id });
    await reviewRegistration({ registrationId: alpha.id, status: 'approved' });
    await expect(reviewRegistration({ registrationId: beta.id, status: 'approved' })).rejects.toMatchObject({ code: 'NEXUS_PLAYER_ALREADY_REGISTERED' });
    await reviewRegistration({ registrationId: alpha.id, status: 'rejected' });
    expect(await rows('select riot_id_key from nexus_season_players where registration_id = $1', [alpha.id])).toHaveLength(0);
    await reviewRegistration({ registrationId: beta.id, status: 'approved' });
    expect(await rows('select registration_id from nexus_season_players where riot_id_key = $1', [teams.Alpha.players[0].riotId.toLowerCase()])).toEqual([{ registration_id: beta.id }]);
  });
});

describe('nexus-team-lifecycle migration on an existing Nexus schema', () => {
  it('replaces the restrictive link, keeps the integrity constraint name and lets a team deletion cascade', async () => {
    const pg = new PGlite();
    await pg.exec(`
      create table users(id uuid primary key);
      create table teams(id uuid primary key, name text, owner_id uuid references users(id) on delete cascade);
      create table team_members(team_id uuid, user_id uuid, role text);
      create table players(id uuid primary key, team_id uuid references teams(id) on delete cascade, name text, riot_id text, role text, roster_status text);
    `);
    for (const migration of ['20261031_nexus_import.sql', '20261101_nexus_tournament.sql', '20261103_nexus_team_lifecycle.sql']) {
      await pg.exec(readFileSync(new URL(`../../database/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    const [user, teamA, teamB, season] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await pg.query('insert into users values ($1)', [user]);
    await pg.query("insert into teams values ($1, 'A', $3), ($2, 'B', $3)", [teamA, teamB, user]);
    await pg.query("insert into nexus_seasons(id, name, status) values ($1, 'S', 'completed')", [season]);
    await pg.query("insert into nexus_registrations(season_id, team_id, status) values ($1, $2, 'approved'), ($1, $3, 'approved')", [season, teamA, teamB]);
    await pg.query("insert into nexus_fixtures(label, team_a, team_b, team_a_id, team_b_id, platform, roster, season_id, stage, fixture_key) values ('J1', 'A', 'B', $1, $2, 'EUW1', '[]', $3, 'regular', 'r1-1')", [teamA, teamB, season]);
    await expect(pg.query("insert into nexus_fixtures(label, team_a, team_b, team_a_id, team_b_id, platform, roster, season_id, stage, fixture_key) values ('J2', 'A', 'A', $1, $1, 'EUW1', '[]', $2, 'regular', 'r1-2')", [teamA, season])).rejects.toMatchObject({ constraint: 'nexus_fixture_native_teams' });
    await pg.query('delete from teams where id = $1', [teamA]);
    expect((await pg.query('select team_id from nexus_registrations')).rows).toEqual([{ team_id: teamB }]);
    expect((await pg.query('select team_a, team_a_id, team_b_id from nexus_fixtures')).rows).toEqual([{ team_a: 'A', team_a_id: null, team_b_id: teamB }]);
    expect((await pg.query("select count(*)::int as n from pg_constraint where conrelid = 'public.nexus_fixtures'::regclass and convalidated and conname in ('nexus_fixture_native_teams', 'nexus_fixture_roster_window')")).rows).toEqual([{ n: 2 }]);
    expect((await pg.query("select confdeltype from pg_constraint where conname = 'nexus_registrations_team_id_fkey'")).rows).toEqual([{ confdeltype: 'c' }]);
    await pg.close();
  }, 30_000);
});
