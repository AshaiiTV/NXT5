import { writeFileSync, mkdirSync } from 'node:fs';
import { cpus, platform, arch } from 'node:os';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { renderToString } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { importArgs, roster, teamId, userId, categoryId } from './fixture.mjs';

const database = vi.hoisted(() => ({ pg: null, statements: [], capture: false, tail: Promise.resolve() }));

// Exactly the Neon -> PGlite transport/encoding used in match-import-atomic.
// The queue makes execution and queue wait distinguishable on the single engine.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options) => {
    const body = JSON.parse(options.body);
    async function execute(connection, statement) {
      const start = performance.now();
      const result = await connection.query(statement.query, statement.params);
      const elapsed = performance.now() - start;
      if (database.capture) database.statements.push({ ...statement, ms: elapsed, rows: result.rows.length });
      return {
        fields: result.fields,
        rows: result.rows.map((row) => result.fields.map((field) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if (field.dataTypeID === 114 || field.dataTypeID === 3802) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', field.dataTypeID === 1184 ? '+00' : '');
          return String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length,
      };
    }
    const task = database.tail.then(async () => {
      if (body.queries) {
        const results = await database.pg.transaction(async (tx) => {
          const rows = [];
          for (const statement of body.queries) rows.push(await execute(tx, statement));
          return rows;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(database.pg, body)));
    });
    database.tail = task.catch(() => {});
    try { return await task; }
    catch (error) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/auth', () => ({
  assertSessionSecret: () => {}, requireAuth: async () => ({ id: '00000000-0000-4000-8000-000000000001' }),
}));

import bootstrap from '../../netlify/functions/bootstrap';
import { persistAnalyzedMatch, rebuildChampionPool } from '../../netlify/functions/_lib/analytics';
import { useTeamData } from '../../src/hooks/useTeamData.js';
import { TrendsPage, buildDraftTrendModel } from '../../src/pages/workspace/TrendsPage.jsx';
import { buildTrendEvolution } from '../../src/utils/trends.js';
import { filterImportedGames } from '../../src/utils/imported-games.js';
import { playerIntegratedRows, buildStaffAlerts } from '../../src/pages/workspace/workspace-shared.jsx';
import { loadMigrations } from '../migration-runner.mjs';

const repetitions = Number(process.env.BENCH_HISTORY_RUNS || 3);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20) throw new Error('BENCH_HISTORY_RUNS must be 1..20');
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const round = (x) => Math.round(x * 1000) / 1000;
let pages = [], rawBodies = [], lastStatements = [], migrations;
const origin = 'https://history-benchmark.invalid';

function queryKind(query) {
  if (query.includes('as total') && query.includes('count(*)')) return 'counts';
  if (query.includes('to_jsonb(matches)')) return 'matches';
  if (query.includes('to_jsonb(match_participants)')) return 'participants';
  if (/select reports\.\*/.test(query)) return 'reports';
  return 'other';
}

beforeAll(async () => {
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID']) vi.stubEnv(key, '');
  vi.stubEnv('CONTEXT', 'dev');
  process.stdout.write('Starting PostgreSQL setup\n');
  database.pg = new PGlite();
  // Same pgcrypto substitutions as the integration tests; all repository
  // migrations are applied in deployment order, including their real indexes.
  migrations = await loadMigrations();
  await database.pg.exec('create table app_schema_migrations(migration_key text primary key, checksum text)');
  for (const migration of migrations) {
    await database.pg.exec(migration.sql.replaceAll('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
    await database.pg.query('insert into app_schema_migrations values ($1,$2)', [migration.key, migration.checksum]);
  }
  await database.pg.query('insert into users(id,account_name,name,password_hash) values ($1,$2,$3,$4)', [userId, 'bench', 'Benchmark', 'unused']);
  await database.pg.query('insert into teams(id,owner_id,name,tag) values ($1,$2,$3,$4)', [teamId, userId, 'History benchmark', 'BENCH']);
  for (const p of roster) await database.pg.query('insert into players(id,team_id,name,riot_id,role) values ($1,$2,$3,$4,$5)', [p.id, teamId, p.name, p.riot_id, p.role]);
  await database.pg.query('insert into match_categories(id,team_id,name) values ($1,$2,$3)', [categoryId, teamId, 'Scrim']);
  // Ten genuine imports create template rows, archives and automatic reports.
  // Cloning their persisted records avoids timing thousands of pool rebuilds.
  for (let seed = 0; seed < 10; seed++) {
    const saved = await persistAnalyzedMatch(importArgs(seed));
    expect(saved.warnings).toEqual([]);
  }
  await database.pg.exec(`
    create temp table bench_matches as select row_number() over(order by game_id)-1 as variant, to_jsonb(m) as payload from matches m;
    create temp table bench_participants as select b.variant, to_jsonb(p) as payload from match_participants p join bench_matches b on p.match_id=(b.payload->>'id')::uuid;
    create temp table bench_reports as select b.variant, to_jsonb(r) as payload from reports r join bench_matches b on r.match_id=(b.payload->>'id')::uuid;
    truncate matches cascade;
  `);
  // Same Request/Response boundary as the existing endpoint integration tests.
  // No listening socket, real network or Netlify/Neon latency is claimed.
  process.stdout.write('PostgreSQL setup complete\n');
  vi.stubGlobal('fetch', measuredRequest);

});

afterAll(async () => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs();

  await database.pg?.close();
});

async function measuredRequest(url, options = {}) {
  if (!String(url).startsWith('/.netlify/functions/bootstrap?')) throw new Error(`Unexpected network call: ${url}`);
  database.statements = [];
  database.capture = true;
  let result, serverMs;
  try {
    const start = performance.now();
    result = await bootstrap(new Request(`${origin}${url}`, options), {});
    serverMs = performance.now() - start; // Includes JSON.stringify in json().
  } finally { database.capture = false; }
  const body = await result.clone().text();
  if (result.status !== 200) throw new Error(`Bootstrap ${result.status}: ${body}`);
  lastStatements = database.statements;
  const sql = Object.fromEntries(['counts', 'matches', 'participants', 'reports', 'other'].map((kind) => [kind,
    { count: lastStatements.filter((q) => queryKind(q.query) === kind).length,
      ms: sum(lastStatements.filter((q) => queryKind(q.query) === kind).map((q) => q.ms)) }]));
  pages.push({ offset: Number(new URL(`${origin}${url}`).searchParams.get('offset')), serverMs, sql,
    sqlCount: lastStatements.length, bytes: Buffer.byteLength(body) });
  rawBodies.push(body);
  return result;
}

async function seedRange(from, to) {
  await database.pg.transaction(async (tx) => {
    await tx.query(`insert into matches select r.* from generate_series($1::int,$2::int) n join bench_matches b on b.variant=n%10
      cross join lateral jsonb_populate_record(null::matches, b.payload || jsonb_build_object(
      'id', md5('bench-match-'||n)::uuid, 'game_id', 'EUW1_'||(2000000000::bigint+n),
      'created_at', timestamptz '2026-01-01' + n*interval '1 hour',
      'raw', jsonb_set(jsonb_set(b.payload->'raw','{metadata,matchId}',to_jsonb('EUW1_'||(2000000000::bigint+n))),
        '{info,gameCreation}',to_jsonb(1767225600000::bigint+n::bigint*3600000))
    )) r`, [from, to]);
    await tx.query(`insert into match_participants select r.* from generate_series($1::int,$2::int) n join bench_participants b on b.variant=n%10
      cross join lateral jsonb_populate_record(null::match_participants, b.payload || jsonb_build_object(
      'id', md5('bench-participant-'||n||'-'||(b.payload->'raw'->>'participantId'))::uuid,
      'match_id', md5('bench-match-'||n)::uuid
    )) r`, [from, to]);
    await tx.query(`insert into match_raw_archives(id,team_id,match_id,game_id,source,payload,created_at)
      select md5('bench-archive-'||n)::uuid,m.team_id,m.id,m.game_id,'import',m.raw,m.created_at
      from generate_series($1::int,$2::int) n join matches m on m.id=md5('bench-match-'||n)::uuid`, [from, to]);
    await tx.query(`insert into reports select r.* from generate_series($1::int,$2::int) n join bench_reports b on b.variant=n%10
      cross join lateral jsonb_populate_record(null::reports, b.payload || jsonb_build_object(
      'id', md5('bench-report-'||n)::uuid, 'match_id', md5('bench-match-'||n)::uuid,
      'match_ids',jsonb_build_array(md5('bench-match-'||n)::uuid),
      'title','Review — History benchmark — EUW1_'||(2000000000::bigint+n),
      'created_at', timestamptz '2026-01-01' + n*interval '1 hour'
    )) r`, [from, to]);
  });
  await rebuildChampionPool(teamId);
  await database.pg.exec('analyze');
  for (const [table, expected] of [['matches', to], ['match_participants', to * 10], ['reports', to], ['match_raw_archives', to]]) {
    expect((await database.pg.query(`select count(*)::int as n from ${table}`)).rows[0].n).toBe(expected);
  }
}

// Mount the unmodified hook: it decides offsets, validates all pages, builds
// the Map and publishes only a complete snapshot. No reimplemented load loop.
async function loadHistory(n) {
  pages = []; rawBodies = [];
  let state, renderer;
  const store = { mergeAvailability: (rows) => rows };
  const snapshots = [];
  function Probe() {
    state = useTeamData(store, `?team=${teamId}`);
    snapshots.push(state.data.matches.length);
    return null;
  }
  const start = performance.now();
  try {
    act(() => { renderer = TestRenderer.create(<Probe />); });
    // React flushes state updates when each act ends. Waiting inside act for a
    // promise resolved by a future render can deadlock with newer renderers.
    while (!state.bootstrapped || state.loading) {
      if (performance.now() - start > 300_000) throw new Error('History hook did not complete within five minutes');
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    }
    const elapsedMs = performance.now() - start;
    expect(state.apiError).toBe('');
    expect(state.bootstrapReady).toBe(true);
    expect(state.data.historyComplete).toBe(true);
    expect(state.data.matches).toHaveLength(n);
    expect(snapshots.every((count) => count === 0 || count === n)).toBe(true);
    expect(pages.map((page) => page.offset)).toEqual(Array.from({ length: n / 100 }, (_, i) => i * 100));
    expect(state.data.matches.every((m) => m.participants.length === 10 && m.raw.nxt5.timelineSummary.csMilestones['1'])).toBe(true);
    return { data: state.data, elapsedMs, pages: [...pages], bodies: [...rawBodies] };
  } finally { if (renderer) act(() => renderer.unmount()); }
}

// Fixed workspace-relative artifact: never consumes DATABASE_URL or writes elsewhere.
function writeResults(output) {
  mkdirSync('docs/bench-history', { recursive: true });
  writeFileSync('docs/bench-history/results-2026-10-06.json', JSON.stringify(output, null, 2) + '\n');
}

function measureCpu(fn) {
  fn(); // warm-up
  const samples = [];
  for (let i = 0; i < 5; i++) { const start = performance.now(); fn(); samples.push(performance.now() - start); }
  return { medianMs: median(samples), samplesMs: samples };
}

it('measures complete team history at 100, 500, 1000 and 3000 matches', async () => {
  const output = {
    methodVersion: 2, transport: 'in-process Request/Response; no TCP, authentication or WAN latency', recordedAt: new Date().toISOString(),
    environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
      postgres: (await database.pg.query('select version()')).rows[0].version, pglite: '0.5.8' },
    repetitions, migrations: migrations.map(({ key, checksum }) => ({ key, checksum })), records: [], explain: [],
    indexes: (await database.pg.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('matches','match_participants','reports') order by tablename,indexname")).rows,
  };
  let previous = 0;
  for (const n of [100, 500, 1000, 3000]) {
    process.stdout.write(`Seeding ${n} matches…\n`);
    await seedRange(previous + 1, n); previous = n;
    process.stdout.write(`Loading ${n} matches…\n`);
    const warmup = await loadHistory(n);
    const runs = [];
    let loaded;
    for (let repetition = 0; repetition < repetitions; repetition++) {
      loaded = await loadHistory(n);
      runs.push({ elapsedMs: loaded.elapsedMs, serverMs: sum(loaded.pages.map((p) => p.serverMs)), pages: loaded.pages });
    }
    const { data, bodies } = loaded;
    const byteSize = (value) => Buffer.byteLength(JSON.stringify(value));
    const record = {
      n, warmupServerMs: sum(warmup.pages.map((p) => p.serverMs)), runs,
      serverMedianMs: median(runs.map((r) => r.serverMs)), elapsedMedianMs: median(runs.map((r) => r.elapsedMs)),
      httpRequests: bodies.length, jsonBytes: sum(bodies.map((b) => Buffer.byteLength(b))),
      gzipBytes: sum(bodies.map((b) => gzipSync(b).length)),
      payload: { matchesBytes: byteSize(data.matches), participantsBytes: sum(data.matches.map((m) => byteSize(m.participants))),
        matchRawBytes: sum(data.matches.map((m) => byteSize(m.raw))), reportsBytes: byteSize(data.reports),
        averageMatchBytes: byteSize(data.matches) / n, reports: data.reports.length },
      cpu: {
        parseAllPages: measureCpu(() => bodies.map((b) => JSON.parse(b))),
        mapAndValidate: measureCpu(() => {
          const map = new Map();
          for (const m of data.matches) { if (!m.id || m.team_id !== teamId) throw new Error('Invalid match'); map.set(m.id, m); }
          if (map.size !== n) throw new Error('Incomplete');
          return [...map.values()];
        }),
        importedGamesFilterSort: measureCpu(() => filterImportedGames(data.matches)),
        trendEvolution: measureCpu(() => buildTrendEvolution(data.matches)),
        fivePlayerIntegratedRows: measureCpu(() => roster.map((p) => playerIntegratedRows(p, data.matches))),
        draftModel: measureCpu(() => buildDraftTrendModel(data.matches)),
        staffAlerts: measureCpu(() => buildStaffAlerts(data.matches, roster)),
        trendsOverviewSsr: measureCpu(() => renderToString(<TrendsPage data={data} selectedTeamId={teamId} />)),
      },
    };
    output.records.push(record);
    writeResults(output); // Partial results survive an interrupted long run.
    process.stdout.write(JSON.stringify({ n, serverMs: round(record.serverMedianMs), http: record.httpRequests, bytes: record.jsonBytes,
      trendsSsrMs: round(record.cpu.trendsOverviewSsr.medianMs) }) + '\n');
    if (n === 3000) {
      // Capture the actual production SQL/parameters, never a hand-copied query.
      for (const offset of [0, 2900]) {
        await measuredRequest(`/.netlify/functions/bootstrap?teamId=${teamId}&limit=100&offset=${offset}&matchesOnly=1`).then((r) => r.text());
        for (const statement of lastStatements.filter((q) => ['matches', 'counts', 'participants'].includes(queryKind(q.query)))) {
          const plans = [];
          for (let i = 0; i < 3; i++) plans.push((await database.pg.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement.query}`, statement.params)).rows[0]['QUERY PLAN'][0]);
          output.explain.push({ offset, kind: queryKind(statement.query), query: statement.query, params: statement.params, plans });
          if (queryKind(statement.query) === 'matches') {
            // Diagnostic control, not a proposed production query: keep the
            // membership predicate, join, ordering, LIMIT and OFFSET, removing
            // only the JSON projection to isolate its cost from row selection.
            const projection = statement.query.indexOf('select to_jsonb(matches)');
            const from = statement.query.indexOf('\n        from match_page matches\n');
            if (projection < 0 || from < 0) throw new Error('Main query changed; review projection control');
            const query = statement.query.slice(0, projection)
              + 'select matches.id, users.name, users.account_name' + statement.query.slice(from);
            const controlPlans = [];
            for (let i = 0; i < 3; i++) controlPlans.push((await database.pg.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`, statement.params)).rows[0]['QUERY PLAN'][0]);
            output.explain.push({ offset, kind: 'matchesIdentityOnly', query, params: statement.params, plans: controlPlans });
            // Same-machine comparison with the pre-fix placement of LIMIT/OFFSET.
            // The projection stays byte-for-byte the one used in production.
            const previousQuery = statement.query.slice(projection)
              .replace('from match_page matches', 'from matches')
              .replace('order by matches.created_at desc, matches.id desc',
                'where matches.team_id = $1 order by matches.created_at desc, matches.id desc limit $2 offset $3');
            expect((await database.pg.query(previousQuery, statement.params)).rows)
              .toEqual((await database.pg.query(statement.query, statement.params)).rows);
            const previousPlans = [];
            for (let i = 0; i < 3; i++) previousPlans.push((await database.pg.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${previousQuery}`, statement.params)).rows[0]['QUERY PLAN'][0]);
            output.explain.push({ offset, kind: 'matchesBeforePaginationFix', query: previousQuery, params: statement.params, plans: previousPlans });
          }
        }
      }
      output.rawStorage = (await database.pg.query('select avg(octet_length(raw::text)) as raw_text_bytes,avg(pg_column_size(raw)) as stored_raw_bytes from matches')).rows[0];
    }
  }
  writeResults(output);
});
