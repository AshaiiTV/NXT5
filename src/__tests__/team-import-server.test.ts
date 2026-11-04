import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const db = vi.hoisted(() => ({ pg: null as any }));
const identity = vi.hoisted(() => ({ userId: '' }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret: () => {}, requireAuth: async () => ({ id: identity.userId }) }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: async () => {}, assertSubjectRateLimit: async () => {} }));
vi.mock('../../netlify/functions/_lib/schema', () => ({ ensureAuditLogsSchema: async () => {}, ensureWorkflowSchema: async () => {} }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/safe-log', () => ({ logFailure: vi.fn() }));
vi.mock('../../netlify/functions/_lib/discord-wake', () => ({ wakeDiscordPublications: vi.fn() }));
vi.mock('../../netlify/functions/_lib/riot', () => ({ fetchRiotMatch: vi.fn(() => { throw new Error('Unexpected Riot request'); }) }));
vi.mock('../../netlify/functions/_lib/team-member-emails', () => ({ getTeamMemberEmails: async () => [] }));
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
        const results = await db.pg.transaction(async (tx: any) => { const out = []; for (const query of body.queries) out.push(await execute(tx, query)); return out; });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(db.pg, body)));
    } catch (err: any) {
      return new Response(JSON.stringify({ message: err.message, code: err.code, constraint: err.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/team-import') };
});

import linkHandler from '../../netlify/functions/team-import-link';
import connectHandler from '../../netlify/functions/team-import-connect';
import sessionHandler from '../../netlify/functions/team-import-session';
import submitHandler from '../../netlify/functions/team-import-submissions';
import fileImportHandler from '../../netlify/functions/matches-import-file';
import { resolveAutoAssignments } from '../../netlify/functions/_lib/team-import';

const users = { owner: randomUUID(), coach: randomUUID(), player: randomUUID(), stranger: randomUUID() };
const team = randomUUID();
const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const roster = roles.map((role, index) => ({ id: randomUUID(), role, name: `Ally${index}`, riotId: `Ally ${index}#EUW` }));
const rows = async (query: string, values: any[] = []) => (await db.pg.query(query, values)).rows;
const context = { deploy: { context: 'production' } } as any;
const origin = 'https://nxt5.org';
async function staff(userId: string, body?: any) {
  identity.userId = userId;
  const response = await linkHandler(new Request(`${origin}/.netlify/functions/team-import-link${body ? '' : `?teamId=${team}`}`, body ? { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: team, ...body }) } : {}), context);
  return { status: response.status, body: await response.json() };
}
async function connect(code: string, label = 'PC de Coach') {
  const response = await connectHandler(new Request(`${origin}/.netlify/functions/team-import-connect`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code, label }) }), context);
  return { status: response.status, body: await response.json() };
}
async function session(token: string) {
  const response = await sessionHandler(new Request(`${origin}/.netlify/functions/team-import-session`, { headers: { Authorization: `Bearer ${token}` } }));
  return { status: response.status, body: await response.json() };
}
async function submit(token: string, match: any, key = randomUUID(), timeline: any = null) {
  const response = await submitHandler(new Request(`${origin}/.netlify/functions/team-import-submissions`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: JSON.stringify({ payload: { match, timeline } }) }), context);
  return { status: response.status, body: await response.json() };
}
let gameNumber = 7000000000;
function customGame({ allies = roster.map((p) => p.riotId), positions = true, side = 100 }: { allies?: string[]; positions?: boolean; side?: 100 | 200 } = {}) {
  const id = `EUW1_${++gameNumber}`;
  const names = (teamId: number, index: number) => teamId === side ? allies[index] || `Guest ${index}#EUW` : `Enemy ${index}#EUW`;
  return {
    metadata: { matchId: id },
    info: {
      gameCreation: Date.now() - 3600_000, gameDuration: 1900, gameVersion: '16.21.1', gameType: 'CUSTOM_GAME', queueId: 0, mapId: 11,
      participants: Array.from({ length: 10 }, (_, i) => {
        const teamId = i < 5 ? 100 : 200;
        const riotId = names(teamId, i % 5);
        return {
          participantId: i + 1, teamId, championName: `Champion${i}`, championId: i + 1,
          riotIdGameName: riotId.split('#')[0], riotIdTagline: riotId.split('#')[1], summonerName: riotId.split('#')[0],
          ...(positions ? { teamPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][i % 5] } : { summoner1Id: i % 5 === 1 ? 11 : 4, summoner2Id: 12 }),
          kills: 2, deaths: 1, assists: 3, totalMinionsKilled: 120, neutralMinionsKilled: 8, goldEarned: 11000, totalDamageDealtToChampions: 14000, visionScore: 20,
        };
      }),
      teams: [{ teamId: 100, win: side === 100 }, { teamId: 200, win: side !== 100 }],
    },
  };
}

beforeAll(async () => {
  db.pg = new PGlite();
  await db.pg.waitReady;
  const client = { query: async (sql: string, params?: unknown[]) => params ? db.pg.query(sql, params) : ((await db.pg.exec(sql)).at(-1) || { rows: [] }) };
  const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
  await applyMigrations(client, migrations);
}, 60_000);
afterAll(async () => { await db.pg?.close(); });
beforeEach(async () => {
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID', 'CONTEXT']) vi.stubEnv(key, '');
  await db.pg.exec('truncate users cascade; truncate audit_logs;');
  for (const [key, id] of Object.entries(users)) await rows("insert into users(id, account_name, name, password_hash) values ($1, $2, $2, 'hash')", [id, key]);
  await rows("insert into teams(id, owner_id, name, tag) values ($1, $2, 'Arcane Horizon', 'AH')", [team, users.owner]);
  await rows("insert into team_members(team_id, user_id, role) values ($1, $2, 'coach'), ($1, $3, 'player')", [team, users.coach, users.player]);
  for (const player of roster) await rows('insert into players(id, team_id, name, riot_id, role) values ($1, $2, $3, $4, $5)', [player.id, team, player.name, player.riotId, player.role]);
});

describe('linking NXT5 Importer to a team', () => {
  it('lets the staff create a single-use code, refuses players and strangers, and connects once', async () => {
    expect((await staff(users.player, { action: 'create' })).status).toBe(403);
    expect((await staff(users.stranger, { action: 'create' })).status).toBe(403);
    const created = await staff(users.coach, { action: 'create' });
    expect(created.status).toBe(201);
    expect(created.body.code).toMatch(/^[A-F0-9]{4}(-[A-F0-9]{4}){5}$/);
    expect((await connect('ZZZZ-ZZZZ')).status).toBe(401);
    const linked = await connect(created.body.code);
    expect(linked.status).toBe(200);
    expect(linked.body.token).toMatch(/^ti_[a-f0-9]{64}$/);
    expect(linked.body.binding).toMatchObject({ teamId: team, teamName: 'Arcane Horizon', teamTag: 'AH', minRoster: 4 });
    expect(linked.body.binding.roster.map((p: any) => p.riotId).sort()).toEqual(roster.map((p) => p.riotId).sort());
    expect((await connect(created.body.code)).status).toBe(401);
    expect((await session(linked.body.token)).body.valid).toBe(true);
    expect((await session('ti_' + '0'.repeat(64))).status).toBe(401);
    const listing = await staff(users.player);
    expect(listing.body.canManage).toBe(false);
    expect(listing.body.links).toHaveLength(1);
    expect(listing.body.links[0]).toMatchObject({ status: 'connected', label: 'PC de Coach' });
  });

  it('caps active links and revokes a link, which ends its sessions', async () => {
    for (let index = 0; index < 5; index++) expect((await staff(users.owner, { action: 'create' })).status).toBe(201);
    expect(await staff(users.owner, { action: 'create' })).toMatchObject({ status: 409, body: { code: 'TEAM_IMPORT_LIMIT' } });
    const listing = await staff(users.owner);
    expect((await staff(users.player, { action: 'revoke', linkId: listing.body.links[0].id })).status).toBe(403);
    expect((await staff(users.owner, { action: 'revoke', linkId: listing.body.links[0].id })).status).toBe(200);
    const created = await staff(users.owner, { action: 'create' });
    const linked = await connect(created.body.code);
    expect((await staff(users.owner, { action: 'revoke', linkId: linked.body.binding.linkId })).status).toBe(200);
    expect((await session(linked.body.token)).status).toBe(401);
    expect((await submit(linked.body.token, customGame())).status).toBe(401);
  });
});

describe('receiving games from the desktop app', () => {
  async function link(extra: any = {}) {
    const created = await staff(users.coach, { action: 'create', ...extra });
    return (await connect(created.body.code)).body.token as string;
  }

  it('imports a recognised custom with the roster, side, roles and default tag, idempotently', async () => {
    const token = await link();
    const game = customGame();
    const first = await submit(token, game, 'game-1');
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ accepted: true, imported: true, inserted: true, submission: { status: 'imported', gameId: game.metadata.matchId } });
    const matches = await rows('select id, game_id, side, result, category_ids from matches where team_id = $1', [team]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ game_id: game.metadata.matchId, side: 'Blue Side', result: 'Victoire' });
    expect(matches[0].category_ids).toHaveLength(1);
    const participants = await rows("select team_key, role, player_id from match_participants where match_id = $1 and team_key = 'ALLY' order by role", [matches[0].id]);
    expect(participants.map((p) => p.role).sort()).toEqual([...roles].sort());
    expect(participants.every((p) => roster.some((player) => player.id === p.player_id))).toBe(true);
    const again = await submit(token, game, 'game-1');
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ duplicate: true, submission: { status: 'imported' } });
    expect(await rows('select id from matches where team_id = $1', [team])).toHaveLength(1);
    expect(await rows("select action from audit_logs where action = 'team_import.imported'")).toHaveLength(1);
  });

  it('uses the tag chosen with the link and recognises the red side with a sub', async () => {
    const [category] = await rows("insert into match_categories(team_id, name, color) values ($1, 'Scrim', 'pink') returning id", [team]);
    const token = await link({ categoryId: category.id });
    const game = customGame({ side: 200, allies: [...roster.slice(0, 4).map((p) => p.riotId), 'Sub Player#EUW'] });
    const result = await submit(token, game);
    expect(result.body.submission).toMatchObject({ status: 'pending' });
    expect(result.body.submission.reason).toContain('Sub Player#EUW');
    await rows("insert into players(team_id, name, riot_id, role, roster_status) values ($1, 'Sub', 'Sub Player#EUW', 'SUB', 'SUB')", [team]);
    const retry = await submit(token, customGame({ side: 200, allies: [...roster.slice(0, 4).map((p) => p.riotId), 'Sub Player#EUW'] }));
    expect(retry.body.submission.status).toBe('imported');
    const [match] = await rows('select side, category_ids from matches where id = $1', [retry.body.matchId]);
    expect(match.side).toBe('Red Side');
    expect(match.category_ids).toEqual([category.id]);
  });

  it('skips games that are not the team’s and keeps unresolved games for the staff, who can finalise them with the usual import', async () => {
    const token = await link();
    const foreign = await submit(token, customGame({ allies: ['Someone#EUW', 'Else#EUW', roster[0].riotId] }));
    expect(foreign.body.submission).toMatchObject({ status: 'skipped' });
    expect(await rows('select id from matches where team_id = $1', [team])).toHaveLength(0);
    const unresolved = customGame({ positions: false });
    unresolved.info.participants.forEach((p: any) => { if (p.teamId === 200) { p.summoner1Id = 4; p.summoner2Id = 12; } });
    const pending = await submit(token, unresolved);
    expect(pending.body.submission).toMatchObject({ status: 'pending' });
    expect(pending.body.submission.reason).toContain('adverse');
    const listing = await staff(users.coach);
    expect(listing.body.submissions.map((row: any) => row.status)).toEqual(['pending', 'skipped']);
    expect((await staff(users.player, { action: 'pending', submissionId: pending.body.submission.id })).status).toBe(403);
    const stored = await staff(users.coach, { action: 'pending', submissionId: pending.body.submission.id });
    expect(stored.status).toBe(200);
    expect(stored.body.payload.match.metadata.matchId).toBe(unresolved.metadata.matchId);
    identity.userId = users.coach;
    const [category] = await rows('select id from match_categories where team_id = $1', [team]);
    const manual = await fileImportHandler(new Request(`${origin}/.netlify/functions/matches-import-file`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({
      teamId: team, payload: stored.body.payload, allyTeamSide: 'BLUE', categoryIds: [category.id],
      laneAssignments: Object.fromEntries(roles.map((role, index) => [role, `participant:${index + 1}`])),
      enemyLaneAssignments: Object.fromEntries(roles.map((role, index) => [role, `participant:${index + 6}`])),
      playerAssignments: Object.fromEntries(roster.map((player) => [player.role, player.id])),
    }) }), context);
    expect(manual.status).toBe(200);
    expect((await staff(users.coach)).body.submissions.find((row: any) => row.id === pending.body.submission.id)).toMatchObject({ status: 'imported' });
    expect((await staff(users.coach, { action: 'dismiss', submissionId: pending.body.submission.id })).status).toBe(404);
  });

  it('resolves jungle from Smite and the last free role without positions', () => {
    const game = customGame({ positions: false });
    game.info.participants.forEach((p: any) => { if (p.teamId === 200) p.teamPosition = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][(p.participantId - 1) % 5]; });
    // The jungler is only a substitute profile: Smite settles the role, the last free role goes to the remaining player.
    const subs = roster.map((p, index) => ({ id: p.id, riot_id: p.riotId, role: index === 1 || index === 4 ? 'SUB' : p.role }));
    game.info.participants[4].summoner1Id = 4;
    const plan = resolveAutoAssignments(game, subs);
    expect(plan).toMatchObject({ allyTeamSide: 'BLUE', laneAssignments: { JGL: 'participant:2', SUP: 'participant:5' } });
    const enemy = customGame({ positions: false });
    enemy.info.participants.forEach((p: any) => { if (p.teamId === 200) p.summoner1Id = 4; });
    expect(resolveAutoAssignments(enemy, roster.map((p) => ({ id: p.id, riot_id: p.riotId, role: p.role })))).toMatchObject({ pending: expect.stringContaining('adverse') });
  });
});
