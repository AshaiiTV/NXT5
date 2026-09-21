import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  pg: null as any,
  beforeBatch: null as null | (() => Promise<void>)
}));

// Preserve Neon parameter encoding and HTTP transactions. Only replace the
// transport with PostgreSQL in memory; constraints and rollbacks remain real.
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
      return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});

vi.mock('../../netlify/functions/_lib/auth', () => ({
  assertSessionSecret: () => {},
  requireAuth: async () => ({ id: '00000000-0000-4000-8000-000000000001' })
}));
vi.mock('../../netlify/functions/_getTeamMembers.js', () => ({ getTeamMemberEmails: async () => [] }));
vi.mock('../../netlify/functions/_mailer.js', () => ({ sendNotification: vi.fn() }));

import manageMatches from '../../netlify/functions/matches-manage';
import manageReports from '../../netlify/functions/reports-manage';
import manageArchives from '../../netlify/functions/match-archives-manage';

const userId = '00000000-0000-4000-8000-000000000001';
const teamId = '00000000-0000-4000-8000-000000000002';
const otherTeamId = '00000000-0000-4000-8000-000000000003';
const matchA = '00000000-0000-4000-8000-0000000000aa';
const matchB = '00000000-0000-4000-8000-0000000000bb';
const matchC = '00000000-0000-4000-8000-0000000000cc';
const foreignMatch = '00000000-0000-4000-8000-0000000000dd';

async function call(handler: any, body: Record<string, any>) {
  return handler(new Request('https://nxt5.test/.netlify/functions/manage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, ...body })
  }), {});
}
const removeMatch = (id = matchA) => call(manageMatches, { action: 'delete', matchId: id });

async function seedReport(primary: string | null, ids: string[], owner = teamId) {
  const { rows } = await database.pg.query(`insert into reports (team_id, match_id, match_ids, created_by, title, content)
    values ($1, $2, $3, $4, $5, $6) returning *`,
  [owner, primary, JSON.stringify(ids), userId, 'Review manuelle', 'Décision conservée et action de coaching.']);
  return rows[0];
}
async function seedArchive(ids: string[], owner = teamId) {
  const { rows } = await database.pg.query(`insert into match_archives (team_id, created_by, name, match_ids)
    values ($1, $2, $3, $4) returning *`, [owner, userId, 'Bloc scrim', JSON.stringify(ids)]);
  return rows[0];
}
async function rows(table: string) {
  return (await database.pg.query(`select * from ${table} order by id`)).rows;
}
async function snapshot() {
  return Object.fromEntries(await Promise.all(['matches', 'match_participants', 'match_raw_archives', 'match_archives', 'reports', 'audit_logs']
    .map(async (table) => [table, await rows(table)])));
}

beforeAll(async () => {
  database.pg = new PGlite();
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')");
  await database.pg.exec(schema);
  await database.pg.exec(`create table app_schema_migrations (migration_key text primary key);
    insert into app_schema_migrations values ('audit-runtime-20260906-v1')`);
}, 20_000);

beforeEach(async () => {
  database.beforeBatch = null;
  await database.pg.exec('alter table audit_logs drop constraint if exists reject_match_delete; truncate users cascade');
  await database.pg.query('insert into users (id, account_name, name, password_hash) values ($1, $2, $3, $4)',
    [userId, 'test', 'Audit account', 'unused']);
  for (const id of [teamId, otherTeamId]) {
    await database.pg.query('insert into teams (id, owner_id, name, tag) values ($1, $2, $3, $4)', [id, userId, id, 'TEST']);
  }
  for (const id of [matchA, matchB, matchC, foreignMatch]) {
    await database.pg.query('insert into matches (id, team_id, game_id, created_by) values ($1, $2, $3, $4)',
      [id, id === foreignMatch ? otherTeamId : teamId, `EUW1_${id.slice(-2)}`, userId]);
  }
  await database.pg.query(`insert into match_participants (match_id, team_key, champion) values ($1, 'ALLY', 'Ahri')`, [matchA]);
  await database.pg.query(`insert into match_raw_archives (team_id, match_id, game_id, payload) values ($1, $2, $3, $4)`,
    [teamId, matchA, 'EUW1_aa', JSON.stringify({ retained: 'until successful deletion' })]);
});

afterAll(async () => { await database.pg?.close(); });

describe('match deletion preserves reviews', () => {
  it.each([
    ['primary', matchA, [matchA, matchC, matchB], matchC, [matchC, matchB]],
    ['secondary', matchB, [matchB, matchA, matchC], matchB, [matchB, matchC]],
    ['single match', matchA, [matchA], null, []],
    ['duplicate references', matchA, [matchA, matchB, matchA], matchB, [matchB]],
    ['legacy primary absent from JSON', matchA, [matchB], matchB, [matchB]],
    ['legacy primary only', matchA, [], null, []],
    ['legacy JSON only', null, [matchA, matchB], matchB, [matchB]]
  ])('keeps title/content and fixes %s references', async (_case, primary, ids, nextPrimary, nextIds) => {
    const report = await seedReport(primary as string | null, ids as string[]);
    expect((await removeMatch()).status).toBe(200);
    const remaining = await rows('reports');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: report.id, title: report.title, content: report.content,
      created_by: userId, match_id: nextPrimary, match_ids: nextIds, created_at: report.created_at });
  });

  it('cleans groups and cascaded data without changing unrelated teams or reviews', async () => {
    const own = await seedReport(matchB, [matchB]);
    const other = await seedReport(foreignMatch, [foreignMatch], otherTeamId);
    const group = await seedArchive([matchA, matchB, matchC]);
    await seedArchive([matchA]);
    const otherGroup = await seedArchive([foreignMatch], otherTeamId);
    expect((await removeMatch(matchA.toUpperCase())).status).toBe(200);
    expect(await rows('reports')).toEqual([own, other].sort((a, b) => a.id.localeCompare(b.id)));
    expect(await rows('match_archives')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: group.id, match_ids: [matchB, matchC] }), otherGroup
    ]));
    expect(await rows('match_archives')).toHaveLength(2);
    expect(await rows('match_participants')).toEqual([]);
    expect(await rows('match_raw_archives')).toEqual([]);
    expect((await rows('matches')).map((row: any) => row.id)).toEqual([matchB, matchC, foreignMatch]);
    expect(await rows('audit_logs')).toEqual([expect.objectContaining({ action: 'matches.delete', entity_id: matchA })]);
  });

  it('refuses a match belonging to another team without any changes', async () => {
    const before = await snapshot();
    expect((await removeMatch(foreignMatch)).status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });

  it('rolls back references, groups, raw data and the match if the final audit insert fails', async () => {
    await seedReport(matchA, [matchA, matchB]);
    await seedReport(matchA, [matchA]);
    await seedArchive([matchA, matchB]);
    await seedArchive([matchA]);
    const before = await snapshot();
    await database.pg.exec("alter table audit_logs add constraint reject_match_delete check (action <> 'matches.delete')");
    expect((await removeMatch()).status).toBe(500);
    expect(await snapshot()).toEqual(before);
  });

  it('uses the latest committed review edit when deletion acquires the team lock', async () => {
    const report = await seedReport(matchA, [matchA, matchB]);
    database.beforeBatch = async () => {
      const response = await call(manageReports, { action: 'update', reportId: report.id, title: 'Review enrichie',
        content: 'Texte modifié pendant la suppression.', matchIds: [matchA, matchC, matchB] });
      expect(response.status).toBe(200);
    };
    expect((await removeMatch()).status).toBe(200);
    expect(await rows('reports')).toEqual([expect.objectContaining({ id: report.id, title: 'Review enrichie',
      content: 'Texte modifié pendant la suppression.', match_id: matchC, match_ids: [matchC, matchB] })]);
  });
});

describe('review and group writes serialize with match deletion', () => {
  it.each(['report', 'archive'])('creates and edits %s references with canonical, distinct IDs', async (kind) => {
    const create = kind === 'report'
      ? await call(manageReports, { title: 'Review', content: 'Texte initial', matchIds: [matchB.toUpperCase(), matchB, matchA] })
      : await call(manageArchives, { name: 'Groupe', matchIds: [matchB.toUpperCase(), matchB, matchA] });
    expect(create.status).toBe(200);
    const saved = (await create.json())[kind];
    expect(saved.match_ids).toEqual([matchB, matchA]);
    const edit = kind === 'report'
      ? await call(manageReports, { action: 'update', reportId: saved.id, title: 'Review revue', content: 'Texte final', matchIds: [matchC, matchB] })
      : await call(manageArchives, { action: 'update', archiveId: saved.id, name: 'Groupe revu', matchIds: [matchC, matchB] });
    expect(edit.status).toBe(200);
    expect((await edit.json())[kind]).toMatchObject({ id: saved.id, match_ids: [matchC, matchB] });
    if (kind === 'report') expect((await rows('reports'))[0]).toMatchObject({ match_id: matchC, content: 'Texte final' });
  });

  it.each(['report', 'archive'])('cleans a newly created %s committed before deletion', async (kind) => {
    database.beforeBatch = async () => {
      const response = kind === 'report'
        ? await call(manageReports, { title: 'Nouvelle review', content: 'À conserver', matchIds: [matchB, matchA] })
        : await call(manageArchives, { name: 'Nouveau bloc', matchIds: [matchB, matchA] });
      expect(response.status).toBe(200);
    };
    expect((await removeMatch()).status).toBe(200);
    const saved = await rows(kind === 'report' ? 'reports' : 'match_archives');
    expect(saved).toEqual([expect.objectContaining({ match_ids: [matchB] })]);
    if (kind === 'report') expect(saved[0].match_id).toBe(matchB);
  });

  it.each([
    ['report', 'create'], ['report', 'update'], ['archive', 'create'], ['archive', 'update']
  ])('rejects a stale %s %s when deletion commits first, including a secondary reference', async (kind, action) => {
    const existing = action === 'update'
      ? kind === 'report' ? await seedReport(matchB, [matchB]) : await seedArchive([matchB])
      : null;
    database.beforeBatch = async () => { expect((await removeMatch()).status).toBe(200); };
    const response = kind === 'report'
      ? await call(manageReports, { action, reportId: existing?.id, title: 'Écriture périmée', content: 'Ne pas écraser', matchIds: [matchB, matchA] })
      : await call(manageArchives, { action, archiveId: existing?.id, name: 'Écriture périmée', matchIds: [matchB, matchA] });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'MATCH_REFERENCES_CHANGED' });
    expect(await rows(kind === 'report' ? 'reports' : 'match_archives')).toEqual(existing ? [existing] : []);
    expect(await rows('audit_logs')).toHaveLength(1);
  });

  it.each(['report', 'archive'])('refuses cross-team JSON references for %s writes', async (kind) => {
    const response = kind === 'report'
      ? await call(manageReports, { title: 'Review', content: 'Texte', matchIds: [matchB, foreignMatch] })
      : await call(manageArchives, { name: 'Groupe', matchIds: [matchB, foreignMatch] });
    expect(response.status).toBe(409);
    expect(await rows(kind === 'report' ? 'reports' : 'match_archives')).toEqual([]);
  });

  it('allows a detached review to be edited after its last match was removed', async () => {
    const report = await seedReport(matchA, [matchA]);
    expect((await removeMatch()).status).toBe(200);
    const response = await call(manageReports, { action: 'update', reportId: report.id, title: 'Review conservée',
      content: 'Action toujours utile.', matchIds: [] });
    expect(response.status).toBe(200);
    expect((await response.json()).report).toMatchObject({ id: report.id, match_id: null, match_ids: [], content: 'Action toujours utile.' });
  });
});
