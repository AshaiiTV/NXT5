import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  pg: null as any,
  statements: [] as string[],
  beforeBatch: null as null | (() => Promise<void>)
}));

// Keep the real Neon query builder, parameter encoding and HTTP batch protocol.
// Only its transport is replaced: every statement runs against local PostgreSQL
// (PGlite). A failed batch therefore rolls back in the engine, not in a mock.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      database.statements.push(statement.query);
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if (field.dataTypeID === 114 || field.dataTypeID === 3802) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          if (value instanceof Date) return value.toISOString();
          return String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) {
        const beforeBatch = database.beforeBatch;
        database.beforeBatch = null;
        await beforeBatch?.();
        const results = await database.pg.transaction(async (tx: any) => {
          const rows = [];
          for (const statement of body.queries) rows.push(await execute(tx, statement));
          return rows;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(database.pg, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});

import { persistAnalyzedMatch, rebuildChampionPool } from '../../netlify/functions/_lib/analytics';
import { loadMatchPage } from '../../netlify/functions/_lib/match-page';
import bootstrap from '../../netlify/functions/bootstrap';
import importRiot from '../../netlify/functions/matches-import';
import { fetchRiotMatch } from '../../netlify/functions/_lib/riot';
import importFile from '../../netlify/functions/matches-import-file';
import manageCategories from '../../netlify/functions/match-categories-manage';

vi.mock('../../netlify/functions/_lib/auth', () => ({
  assertSessionSecret: () => {},
  requireAuth: async () => ({ id: '00000000-0000-4000-8000-000000000001' })
}));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: async () => {} }));
vi.mock('../../netlify/functions/_getTeamMembers.js', () => ({ getTeamMemberEmails: async () => [], ensureUserNotificationColumns: async () => {} }));
vi.mock('../../netlify/functions/_mailer.js', () => ({ sendNotification: vi.fn() }));
vi.mock('../../netlify/functions/_lib/riot', () => ({ fetchRiotMatch: vi.fn(() => { throw new Error('Unexpected Riot request in local file import'); }) }));

const userId = '00000000-0000-4000-8000-000000000001';
const teamId = '00000000-0000-4000-8000-000000000002';
const otherTeamId = '00000000-0000-4000-8000-000000000003';
const categoryId = '00000000-0000-4000-8000-000000000004';
const foreignCategoryId = '00000000-0000-4000-8000-000000000005';
const nextCategoryId = '00000000-0000-4000-8000-000000000006';
const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const roster = roles.map((role, index) => ({
  id: `00000000-0000-4000-8000-00000000001${index}`,
  team_id: teamId, role, name: `Player${index}`, riot_id: `Player${index}#EUW`
}));

function importArgs(kills = 1): any {
  return {
    team: { id: teamId, name: 'Audit team' }, userId, gameId: 'EUW1_123456789',
    label: 'First scrim', categoryIds: [categoryId], allyTeamSide: 'BLUE', roster,
    laneAssignments: Object.fromEntries(roles.map((role, index) => [role, `Champion${index}`])),
    enemyLaneAssignments: Object.fromEntries(roles.map((role, index) => [role, `Champion${index + 5}`])),
    playerAssignments: Object.fromEntries(roster.map((player) => [player.role, player.id])),
    match: {
      metadata: { matchId: 'EUW1_123456789' },
      info: {
        gameDuration: 1800, gameVersion: '16.1.1',
        participants: Array.from({ length: 10 }, (_, index) => ({
          participantId: index + 1, teamId: index < 5 ? 100 : 200,
          championName: `Champion${index}`, summonerName: `Player${index}`,
          riotIdGameName: `Player${index}`, riotIdTagline: 'EUW',
          teamPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][index % 5],
          kills, deaths: 1, assists: 2, totalMinionsKilled: 100,
          neutralMinionsKilled: 10, goldEarned: 10000,
          totalDamageDealtToChampions: 12000, visionScore: 10
        })),
        teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }]
      }
    }
  };
}

async function storedMatch() {
  const matches = await database.pg.query('select * from matches order by id');
  const participants = await database.pg.query('select * from match_participants order by id');
  const archives = await database.pg.query('select * from match_raw_archives order by id');
  return { matches: matches.rows, participants: participants.rows, archives: archives.rows };
}

beforeAll(async () => {
  database.pg = new PGlite();
  // PGlite omits pgcrypto. Only invitation-code entropy is substituted; the
  // tables, constraints, indexes and triggers are the production schema.
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')");
  await database.pg.exec(schema);
  await database.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
  await database.pg.exec(`create table if not exists app_schema_migrations (
    migration_key text primary key, applied_at timestamptz not null default now(), checksum text
  ); insert into app_schema_migrations(migration_key) values ('audit-runtime-20260906-v1')`);
}, 20_000);

beforeEach(async () => {
  database.beforeBatch = null;
  await database.pg.exec('alter table match_participants drop constraint if exists reject_test_stat; alter table champion_pool drop constraint if exists reject_pool_refresh; truncate users cascade');
  await database.pg.query('insert into users(id, account_name, name, password_hash) values ($1, $2, $3, $4)', [userId, 'test', 'Test account', 'unused']);
  for (const id of [teamId, otherTeamId]) {
    await database.pg.query('insert into teams(id, owner_id, name, tag) values ($1, $2, $3, $4)', [id, userId, id, 'TEST']);
  }
  for (const player of roster) {
    await database.pg.query('insert into players(id, team_id, name, riot_id, role) values ($1, $2, $3, $4, $5)', [player.id, teamId, player.name, player.riot_id, player.role]);
  }
  for (const [id, team, name] of [[categoryId, teamId, 'Scrim'], [nextCategoryId, teamId, 'Tournament'], [foreignCategoryId, otherTeamId, 'Other team']]) {
    await database.pg.query('insert into match_categories(id, team_id, name) values ($1, $2, $3)', [id, team, name]);
  }
  database.statements = [];
});

afterAll(async () => { await database.pg?.close(); });

describe('atomic match imports against PostgreSQL', () => {
  it('reimports into the same match with one coherent participant set, archive and metadata', async () => {
    const first = await persistAnalyzedMatch(importArgs());
    const next = importArgs(7);
    next.label = 'Reviewed scrim';
    next.categoryIds = [nextCategoryId];
    const second = await persistAnalyzedMatch(next);
    const saved = await storedMatch();
    expect(second.id).toBe(first.id);
    expect(saved.matches).toHaveLength(1);
    expect(saved.matches[0]).toMatchObject({ id: first.id, created_by: userId, opponent: next.label, category_id: nextCategoryId, category_ids: [nextCategoryId] });
    expect(saved.participants).toHaveLength(10);
    expect(saved.participants.every((row: any) => row.match_id === first.id && row.kills === 7)).toBe(true);
    expect(saved.archives).toHaveLength(1);
    expect(saved.archives[0].payload.info.participants[0].kills).toBe(7);
    expect(saved.matches[0].raw.info.participants[0].kills).toBe(7);
  });

  it('rolls back the match, archive and deletion when PostgreSQL rejects the new participants', async () => {
    await persistAnalyzedMatch(importArgs());
    const before = await storedMatch();
    await database.pg.exec('alter table match_participants add constraint reject_test_stat check (kills <> 666)');
    const next = importArgs(666);
    next.label = 'Must not overwrite';
    next.categoryIds = [nextCategoryId];
    await expect(persistAnalyzedMatch(next)).rejects.toMatchObject({ code: '23514' });
    expect(database.statements.some((query) => /delete from match_participants/i.test(query))).toBe(true);
    expect(await storedMatch()).toEqual(before);
  });

  it('does not migrate legacy categories outside an import that later rolls back', async () => {
    await persistAnalyzedMatch(importArgs());
    await database.pg.query('update match_categories set name = $1 where id = $2', ['Match officiel', categoryId]);
    const before = await storedMatch();
    await database.pg.exec('alter table match_participants add constraint reject_test_stat check (kills <> 666)');
    await expect(persistAnalyzedMatch(importArgs(666))).rejects.toMatchObject({ code: '23514' });
    expect(await storedMatch()).toEqual(before);
    const category = await database.pg.query('select name from match_categories where id = $1', [categoryId]);
    expect(category.rows).toEqual([{ name: 'Match officiel' }]);
  });

  it.each(['not-a-number', -1, 1.5, 2147483648])('rejects invalid persisted statistics (%s) without changing the previous import', async (value) => {
    await persistAnalyzedMatch(importArgs());
    const before = await storedMatch();
    database.statements = [];
    const next = importArgs();
    next.match.info.participants[0].kills = value;
    await expect(persistAnalyzedMatch(next)).rejects.toMatchObject({ status: 400 });
    expect(await storedMatch()).toEqual(before);
    expect(database.statements.some((query) => /\b(insert|update|delete)\b/i.test(query))).toBe(false);
  });

  it('rejects a category belonging to another team before changing any imported data', async () => {
    await persistAnalyzedMatch(importArgs());
    const before = await storedMatch();
    const next = importArgs(2);
    next.categoryIds = [foreignCategoryId];
    await expect(persistAnalyzedMatch(next)).rejects.toMatchObject({ status: 404 });
    expect(await storedMatch()).toEqual(before);
  });

  it('rejects a profile outside the roster instead of silently detaching participants', async () => {
    await persistAnalyzedMatch(importArgs());
    const before = await storedMatch();
    const next = importArgs(2);
    next.playerAssignments.TOP = userId;
    await expect(persistAnalyzedMatch(next)).rejects.toMatchObject({ status: 400 });
    expect(await storedMatch()).toEqual(before);
  });

  it('rechecks a category deleted after validation and preserves the prior match', async () => {
    await persistAnalyzedMatch(importArgs());
    const before = await storedMatch();
    const next = importArgs(2);
    next.categoryIds = [nextCategoryId];
    database.beforeBatch = async () => {
      await database.pg.query('delete from match_categories where id = $1', [nextCategoryId]);
    };
    await expect(persistAnalyzedMatch(next)).rejects.toMatchObject({ status: 409 });
    expect(await storedMatch()).toEqual(before);
  });

  it('keeps one complete version when two callers import the same game', async () => {
    // PGlite serializes connections. This exercises overlapping callers and the
    // real unique constraints; multi-connection row-lock contention needs Neon.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await Promise.all([persistAnalyzedMatch(importArgs(2)), persistAnalyzedMatch(importArgs(3))]);
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
    const saved = await storedMatch();
    expect(saved.matches).toHaveLength(1);
    expect(saved.participants).toHaveLength(10);
    expect(saved.archives).toHaveLength(1);
    const kills = saved.matches[0].raw.info.participants[0].kills;
    expect(saved.participants.every((row: any) => row.kills === kills)).toBe(true);
    expect(saved.archives[0].payload.info.participants[0].kills).toBe(kills);
  });

  it('passes labels and categories from the file endpoint into the atomic import', async () => {
    const args = importArgs();
    const request = new Request('https://nxt5.example/.netlify/functions/matches-import-file', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, payload: { match: args.match }, label: args.label, categoryIds: args.categoryIds,
        laneAssignments: args.laneAssignments, enemyLaneAssignments: args.enemyLaneAssignments,
        playerAssignments: args.playerAssignments, allyTeamSide: args.allyTeamSide })
    });
    const response = await importFile(request, {} as any);
    expect(response.status).toBe(200);
    const saved = await storedMatch();
    expect(saved.matches[0]).toMatchObject({ opponent: args.label, category_ids: [categoryId] });
    expect(saved.archives[0].payload.nxt5Label).toBe(args.label);
    expect(saved.participants).toHaveLength(10);
  });

  it('cleans primary and secondary category references atomically on deletion', async () => {
    const args = importArgs();
    args.categoryIds = [categoryId, nextCategoryId];
    await persistAnalyzedMatch(args);
    for (const [deleted, expected] of [[categoryId, [nextCategoryId]], [nextCategoryId, []]] as const) {
      const request = new Request('https://nxt5.example/.netlify/functions/match-categories-manage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', teamId, categoryId: deleted })
      });
      const response = await manageCategories(request, {} as any);
      expect(response.status).toBe(200);
      const saved = await storedMatch();
      expect(saved.matches[0].category_ids).toEqual(expected);
      expect(saved.matches[0].category_id).toBe(expected[0] ?? null);
      expect(saved.participants).toHaveLength(10);
    }
  });

  it('does not replace another team’s copy of the same Riot game', async () => {
    const first = await persistAnalyzedMatch(importArgs(2));
    const other = importArgs(3);
    other.team = { id: otherTeamId, name: 'Other team' };
    other.categoryIds = [foreignCategoryId];
    other.roster = roster.map((player, index) => ({ ...player, team_id: otherTeamId, id: `00000000-0000-4000-8000-00000000002${index}` }));
    other.playerAssignments = Object.fromEntries(other.roster.map((player: any) => [player.role, player.id]));
    for (const player of other.roster) {
      await database.pg.query('insert into players(id, team_id, name, riot_id, role) values ($1, $2, $3, $4, $5)', [player.id, otherTeamId, player.name, player.riot_id, player.role]);
    }
    const second = await persistAnalyzedMatch(other);
    await persistAnalyzedMatch(importArgs(9));
    const saved = await storedMatch();
    expect(saved.matches).toHaveLength(2);
    expect(saved.archives).toHaveLength(2);
    expect(saved.participants.filter((row: any) => row.match_id === first.id).every((row: any) => row.kills === 9)).toBe(true);
    const otherParticipants = saved.participants.filter((row: any) => row.match_id === second.id);
    expect(otherParticipants).toHaveLength(10);
    expect(otherParticipants.every((row: any) => row.kills === 3)).toBe(true);
    expect(saved.matches.find((row: any) => row.id === second.id).category_ids).toEqual([foreignCategoryId]);
  });
});

describe('stable and atomic champion pool refresh', () => {
  it('combines two aliases of one profile and champion into one row', async () => {
    await persistAnalyzedMatch(importArgs(2));
    const next = importArgs(4);
    next.gameId = 'EUW1_987654321';
    next.match.metadata.matchId = next.gameId;
    next.match.info.participants[0].summonerName = 'Renamed summoner';
    next.match.info.participants[0].riotIdGameName = 'Second account';
    const saved = await persistAnalyzedMatch(next);
    expect(saved.warnings).toEqual([]);
    const pool = await database.pg.query('select player_name, games, wins from champion_pool where player_id=$1 and champion=$2', [roster[0].id, 'Champion0']);
    expect(pool.rows).toEqual([{ player_name: 'Player0', games: 2, wins: 2 }]);
  });

  it('preserves manual and riot_manual entries while replacing automatic statistics', async () => {
    await persistAnalyzedMatch(importArgs());
    for (const [index, source] of [[0, 'manual'], [1, 'riot_manual']] as const) {
      await database.pg.query('update champion_pool set source=$1, status=$2, notes=$3 where player_id=$4', [source, 'lock', 'Keep this coaching note', roster[index].id]);
    }
    const before = await database.pg.query("select * from champion_pool where source in ('manual','riot_manual') order by id");
    await rebuildChampionPool(teamId);
    const after = await database.pg.query("select * from champion_pool where source in ('manual','riot_manual') order by id");
    expect(after.rows).toEqual(before.rows);
    const auto = await database.pg.query("select count(*)::int as count from champion_pool where source='riot'");
    expect(auto.rows[0].count).toBe(3);
  });

  it('retains the whole previous pool and returns a warning if recalculation fails after import', async () => {
    await persistAnalyzedMatch(importArgs());
    const before = await database.pg.query('select * from champion_pool order by id');
    await database.pg.exec('alter table champion_pool add constraint reject_pool_refresh check (games <> 2)');
    const next = importArgs(4);
    next.gameId = 'EUW1_987654321';
    next.match.metadata.matchId = next.gameId;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const saved = await persistAnalyzedMatch(next);
      expect(saved.warnings).toEqual([expect.objectContaining({ code: 'CHAMPION_POOL_REBUILD_FAILED' })]);
      expect(saved.game_id).toBe(next.gameId);
    } finally { errors.mockRestore(); }
    expect((await database.pg.query('select * from champion_pool order by id')).rows).toEqual(before.rows);
    expect((await database.pg.query('select count(*)::int as count from matches')).rows[0].count).toBe(2);
  });

  it('accepts required enemy lane assignments through the Riot import endpoint', async () => {
    const args = importArgs();
    vi.mocked(fetchRiotMatch).mockResolvedValueOnce(args.match);
    const response = await importRiot(new Request('https://nxt5.example/.netlify/functions/matches-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        teamId, gameId: args.gameId, label: args.label, categoryIds: args.categoryIds,
        laneAssignments: args.laneAssignments, enemyLaneAssignments: args.enemyLaneAssignments,
        playerAssignments: args.playerAssignments, allyTeamSide: args.allyTeamSide
      })
    }), {} as any);
    expect(response.status).toBe(200);
    expect((await storedMatch()).participants).toHaveLength(10);
  });
});

describe('team scoped and paginated match loading', () => {
  async function seedHistory() {
    await database.pg.query(`insert into matches(team_id,game_id,result,duration_seconds,raw,created_at)
      select $1, 'EUW1_' || n, case when n % 2 = 0 then 'Victoire' else 'Défaite' end, 900,
        '{"nxt5":{"timelineEvents":[{"type":"CHAMPION_KILL"}],"timelineSummary":{"available":true,"wards":[{"x":10}],"csMilestones":{"1":{"cs10":70,"cs20":114}}}},"timeline":{"info":{"frames":[{"timestamp":900000}]}},"info":{"teams":[]}}'::jsonb,
        '2026-01-01'::timestamptz + n * interval '1 minute' from generate_series(1,62) n`, [teamId]);
    await database.pg.query(`insert into matches(team_id,game_id,result) values ($1,'EUW1_999','Victoire')`, [otherTeamId]);
    await database.pg.query(`insert into match_participants(match_id,team_key,champion,role,raw)
      select id, 'ALLY', 'Ahri', 'MID', '{"participantId":1,"timeline":{"frames":[{"large":"omit"}]}}'::jsonb from matches`);
  }

  it('loads only one team and only participants for the requested page, with global totals', async () => {
    await seedHistory();
    const page = await loadMatchPage(teamId, { limit: 50, offset: 0 });
    const next = await loadMatchPage(teamId, { limit: 50, offset: 50 });
    expect(page.pagination).toEqual({ limit: 50, offset: 0, total: 62, hasMore: true, nextOffset: 50 });
    expect(next.pagination).toEqual({ limit: 50, offset: 50, total: 62, hasMore: false, nextOffset: null });
    expect(page.totals).toEqual({ games: 62, wins: 31, losses: 31 });
    expect(page.matches).toHaveLength(50);
    expect(next.matches).toHaveLength(12);
    expect(new Set([...page.matches, ...next.matches].map(match => match.id)).size).toBe(62);
    for (const match of page.matches) {
      expect(match.team_id).toBe(teamId);
      expect(match.participants).toHaveLength(1);
      expect(match.participants[0].match_id).toBe(match.id);
      expect(match.raw.timeline).toBeUndefined();
      expect(match.raw.nxt5.timelineEvents).toBeUndefined();
      expect(match.raw.nxt5.timelineSummary.wards).toBeUndefined();
      expect(match.raw.nxt5.timelineSummary.csMilestones['1'].cs20).toBeNull();
      expect(match.participants[0].raw.timeline?.frames).toBeUndefined();
    }
  });

  it('applies composition/archive limits to the selected team and returns compact subsequent pages', async () => {
    await seedHistory();
    for (const id of [teamId, otherTeamId]) {
      await database.pg.query("insert into composition_types(team_id,title) select $1, 'Draft ' || n from generate_series(1,60) n", [id]);
      await database.pg.query("insert into match_archives(team_id,name) select $1, 'Archive ' || n from generate_series(1,110) n", [id]);
    }
    const response = await bootstrap(new Request(`https://nxt5.example/.netlify/functions/bootstrap?teamId=${teamId}&limit=1`), {} as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.selectedTeamId).toBe(teamId);
    expect(body.matches).toHaveLength(1);
    expect(body.dashboard.winrateTrend).toBe('5W / 5L sur les 10 dernières');
    expect(body.teams).toHaveLength(2);
    expect(body.teams.every((team: any) => !('invite_code' in team))).toBe(true);
    expect(body.compositions).toHaveLength(50);
    expect(body.matchArchives).toHaveLength(100);
    expect([...body.compositions, ...body.matchArchives, ...body.players].every((row: any) => row.team_id === teamId)).toBe(true);
    const next = await bootstrap(new Request(`https://nxt5.example/.netlify/functions/bootstrap?teamId=${teamId}&limit=50&offset=50&matchesOnly=1`), {} as any);
    const nextBody = await next.json();
    expect(nextBody.matches).toHaveLength(12);
    expect(nextBody.teams).toBeUndefined();
    expect(nextBody.compositions).toBeUndefined();
  });

  it('preserves compact objective timings for trends without transferring full timeline events', async () => {
    const args = importArgs();
    args.match.timeline = { info: { frames: [{ timestamp: 600000, events: [
      { type: 'ELITE_MONSTER_KILL', timestamp: 590000, killerTeamId: 100, killerId: 1, monsterType: 'DRAGON', monsterSubType: 'AIR_DRAGON', position: { x: 10, y: 20 } },
      { type: 'CHAMPION_KILL', timestamp: 591000, killerId: 1, victimId: 6 },
      { type: 'ITEM_PURCHASED', timestamp: 592000, participantId: 1, itemId: 1056 }
    ] }] } };
    await persistAnalyzedMatch(args);
    const expected = [{ type: 'ELITE_MONSTER_KILL', timestamp: 590000, killerTeamId: 100, killerId: 1, monsterType: 'DRAGON', monsterSubType: 'AIR_DRAGON' }];
    const page = await loadMatchPage(teamId, { limit: 50, offset: 0 });
    expect(page.matches[0].raw.nxt5.objectiveEvents).toEqual(expected);
    expect(page.matches[0].raw.nxt5.timelineEvents).toBeUndefined();
    expect(page.matches[0].raw.timeline).toBeUndefined();
    // Legacy files without the stored event index use their frames as source.
    await database.pg.query("update matches set raw = raw #- '{nxt5,timelineEvents}' where team_id=$1", [teamId]);
    expect((await loadMatchPage(teamId, { limit: 50, offset: 0 })).matches[0].raw.nxt5.objectiveEvents).toEqual(expected);
  });

  it('refuses inaccessible teams and invalid pagination before loading their data', async () => {
    const inaccessible = await bootstrap(new Request('https://nxt5.example/.netlify/functions/bootstrap?teamId=ffffffff-ffff-4fff-8fff-ffffffffffff'), {} as any);
    expect(inaccessible.status).toBe(403);
    const invalid = await bootstrap(new Request(`https://nxt5.example/.netlify/functions/bootstrap?teamId=${teamId}&limit=100000`), {} as any);
    expect(invalid.status).toBe(400);
  });
});
