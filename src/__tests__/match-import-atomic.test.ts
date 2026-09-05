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

import { persistAnalyzedMatch } from '../../netlify/functions/_lib/analytics';
import importFile from '../../netlify/functions/matches-import-file';
import manageCategories from '../../netlify/functions/match-categories-manage';

vi.mock('../../netlify/functions/_lib/auth', () => ({
  assertSessionSecret: () => {},
  requireAuth: async () => ({ id: '00000000-0000-4000-8000-000000000001' })
}));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: async () => {} }));
vi.mock('../../netlify/functions/_getTeamMembers.js', () => ({ getTeamMemberEmails: async () => [] }));
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
}, 20_000);

beforeEach(async () => {
  database.beforeBatch = null;
  await database.pg.exec('alter table match_participants drop constraint if exists reject_test_stat; truncate users cascade');
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
    // Derived pool refreshes still run after commit. Their existing independent
    // concurrency behavior must not obscure assertions on the atomic core data.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await Promise.all([persistAnalyzedMatch(importArgs(2)), persistAnalyzedMatch(importArgs(3))]);
      for (const [message] of errors.mock.calls) {
        expect(message).toBe('[match-import] champion pool rebuild failed after match persistence.');
      }
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
