import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';
import { DISCORD_MATCH_TIME_SQL } from '../../netlify/functions/_lib/discord-bot-read';
import { isPlanningWeekStart } from '../../netlify/functions/player-availability-manage';

// The inline expression used by Discord reads before 20261123_query_performance.sql.
function legacyDate(key: string) {
  const value = `m.raw->'info'->>'${key}'`;
  return `case when ${value} ~ '^[0-9]{9,13}$' then to_timestamp((${value})::double precision / case when (${value})::numeric < 100000000000 then 1 else 1000 end) end`;
}
const LEGACY_MATCH_TIME = `coalesce(${legacyDate('gameStartTimestamp')},${legacyDate('gameCreation')},m.created_at)`;

const teamId = '70000000-0000-4000-8000-000000000001';
const ownerId = '70000000-0000-4000-8000-000000000002';
let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
  await pg.query("insert into users(id,account_name,name,password_hash) values($1,'perf','Perf','unused')", [ownerId]);
  await pg.query("insert into teams(id,owner_id,name,tag) values($1,$2,'Perf','PERF')", [teamId, ownerId]);
}, 30_000);
afterAll(async () => { await pg?.close(); });

describe('stored played date used by Discord reads', () => {
  it('matches the former inline expression for every timestamp shape', async () => {
    const raws = [
      { info: { gameStartTimestamp: 1789480800000, gameCreation: 1789480000000 } },
      { info: { gameStartTimestamp: 1789480800 } },
      { info: { gameStartTimestamp: 'not a date', gameCreation: 1789480000000 } },
      { info: { gameStartTimestamp: 12345678, gameCreation: '1789480000' } },
      { info: { gameStartTimestamp: 1789480800000.5 } },
      { info: { gameStartTimestamp: 99999999999999 } },
      { info: { gameStartTimestamp: -1789480800000 } },
      { info: 'scalar' },
      { info: [1789480800000] },
      { metadata: {} },
      {},
      [1789480800000],
    ];
    for (const [index, raw] of raws.entries()) {
      await pg.query('insert into matches(team_id,game_id,raw,created_at) values($1,$2,$3::jsonb,$4)',
        [teamId, `EUW1_${index}`, JSON.stringify(raw), new Date(Date.UTC(2026, 0, 1 + index)).toISOString()]);
    }
    const rows = (await pg.query(`select game_id, ${DISCORD_MATCH_TIME_SQL} as stored, ${LEGACY_MATCH_TIME} as legacy,
      nxt5_match_started_at(m.raw) is null as import_date from matches m where m.team_id = $1 order by game_id`, [teamId])).rows as any[];
    expect(rows).toHaveLength(raws.length);
    for (const row of rows) expect(row.stored).toEqual(row.legacy);
    expect(rows.filter(row => row.import_date).map(row => row.game_id).sort()).toEqual(
      ['EUW1_10', 'EUW1_11', 'EUW1_4', 'EUW1_5', 'EUW1_6', 'EUW1_7', 'EUW1_8', 'EUW1_9'].sort());
  });

  it('filters and sorts a team period through the played-date index', async () => {
    await pg.exec('set enable_seqscan = off');
    try {
      const plan = (await pg.query(`explain select m.id from matches m where m.team_id = $1
        and ${DISCORD_MATCH_TIME_SQL} >= $2::timestamptz and ${DISCORD_MATCH_TIME_SQL} <= $3::timestamptz
        order by ${DISCORD_MATCH_TIME_SQL} desc, m.id desc limit 1`, [teamId, '2026-01-01', '2027-01-01'])).rows
        .map((row: any) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('idx_matches_team_played');
      expect(plan).not.toMatch(/\bSort\b/);
    } finally {
      await pg.exec('reset enable_seqscan');
    }
  });
});

describe('query performance migration', () => {
  it('applies after every earlier migration and creates each index once', async () => {
    const db = new PGlite();
    try {
      const client = { query: async (text: string, params?: unknown[]) => params ? db.query(text, params) : (await db.exec(text)).at(-1) || { rows: [] } };
      const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
      const target = migrations.findIndex(migration => migration.key === 'query-performance-20261123-v1');
      expect(target).toBeGreaterThan(0);
      await applyMigrations(client, migrations.slice(0, target));
      await db.query("insert into users(id,account_name,name,password_hash) values($1,'perf','Perf','unused')", [ownerId]);
      await db.query("insert into teams(id,owner_id,name,tag) values($1,$2,'Perf','PERF')", [teamId, ownerId]);
      await db.query(`insert into matches(team_id,game_id,raw) values($1,'EUW1_1','{"info":{"gameCreation":1789480000000}}')`, [teamId]);
      expect(await applyMigrations(client, migrations.slice(0, target + 1))).toEqual(['query-performance-20261123-v1']);
      // Idempotent when replayed by hand, e.g. after preparing an index concurrently.
      await db.exec(migrations[target].sql);
      const indexes = (await db.query(`select indexname from pg_indexes where indexname = any($1::text[]) order by indexname`, [[
        'idx_matches_team_played', 'idx_matches_team_recent', 'idx_matches_created_at', 'idx_opponent_drafts_imported_at',
        'idx_discord_team_events_team_starts', 'idx_discord_team_goals_team_status', 'idx_participants_player',
        'idx_match_raw_archives_match', 'idx_reports_match', 'idx_matches_team',
      ]])).rows.map((row: any) => row.indexname);
      expect(indexes).toEqual(['idx_discord_team_events_team_starts', 'idx_discord_team_goals_team_status', 'idx_match_raw_archives_match',
        'idx_matches_created_at', 'idx_matches_team_played', 'idx_matches_team_recent', 'idx_opponent_drafts_imported_at',
        'idx_participants_player', 'idx_reports_match']);
      expect((await db.query('select nxt5_match_started_at(raw) as started from matches')).rows).toEqual([{ started: new Date(1789480000000) }]);
    } finally {
      await db.close();
    }
  }, 60_000);
});

describe('planning week validation', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  it('accepts the Monday sent by Planning within one year', () => {
    for (const week of ['2026-11-23', '2026-11-30', '2025-11-24', '2027-11-22']) expect(isPlanningWeekStart(week, now)).toBe(true);
  });
  it('rejects other days, impossible dates and weeks beyond one year', () => {
    for (const week of ['2026-11-24', '2026-11-22', '2026-02-31', '2026-13-02', '2025-11-17', '2027-11-29', '0001-01-01', '']) {
      expect(isPlanningWeekStart(week, now)).toBe(false);
    }
  });
});
