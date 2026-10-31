import { applyMigrations, loadMigrations } from "./migration-runner.mjs";

export const NEXUS_MIGRATION_KEYS = Object.freeze([
  "nexus-import-20261031-v1",
  "nexus-tournament-20261101-v1",
]);

const nativeColumns = {
  users: { id: "uuid" },
  teams: { id: "uuid", owner_id: "uuid", name: "text" },
  players: {
    id: "uuid",
    team_id: "uuid",
    name: "text",
    riot_id: "text",
    role: "text",
    roster_status: "text",
  },
  team_members: { team_id: "uuid", user_id: "uuid", role: "text" },
};
const importColumns = {
  nexus_fixtures: {
    id: "uuid",
    label: "text",
    team_a: "text",
    team_b: "text",
    team_a_id: "uuid",
    team_b_id: "uuid",
    platform: "text",
    starts_at: "timestamptz",
    ends_at: "timestamptz",
    roster: "jsonb",
    created_at: "timestamptz",
  },
  nexus_import_pairings: {
    id: "uuid",
    fixture_id: "uuid",
    uploader_riot_id: "text",
    code_hash: "text",
    code_expires_at: "timestamptz",
    token_hash: "text",
    connected_at: "timestamptz",
    expires_at: "timestamptz",
    revoked_at: "timestamptz",
    created_at: "timestamptz",
  },
  nexus_submissions: {
    id: "uuid",
    fixture_id: "uuid",
    pairing_id: "uuid",
    game_id: "text",
    idempotency_key: "text",
    payload_hash: "text",
    payload: "jsonb",
    summary: "jsonb",
    source: "text",
    status: "text",
    reviewed_at: "timestamptz",
    created_at: "timestamptz",
  },
};
const tournamentColumns = {
  nexus_fixtures: {
    season_id: "uuid",
    stage: "text",
    fixture_key: "text",
    round: "int4",
    best_of: "int4",
    player_ids: "jsonb",
    bracket_group: "text",
    group_id: "text",
  },
  nexus_seasons: {
    id: "uuid",
    name: "text",
    status: "text",
    legs: "int4",
    regular_best_of: "int4",
    playoff_size: "int4",
    format: "text",
    playoff_enabled: "bool",
    group_count: "int4",
    advance_per_group: "int4",
    swiss_rounds: "int4",
    swiss_state: "jsonb",
    double_variant: "text",
    upper_final_best_of: "int4",
    reset_final: "bool",
    playoff_format: "text",
    final_best_of: "int4",
    rules_confirmed: "bool",
    playoff_best_of: "int4",
    schedule_generated: "bool",
    playoff_bracket: "jsonb",
    tie_resolution_note: "text",
    revision: "int4",
    created_at: "timestamptz",
  },
  nexus_registrations: {
    id: "uuid",
    season_id: "uuid",
    team_id: "uuid",
    registered_by: "uuid",
    roster_player_ids: "jsonb",
    roster_riot_ids: "jsonb",
    status: "text",
    reviewed_at: "timestamptz",
    created_at: "timestamptz",
  },
  nexus_season_players: {
    season_id: "uuid",
    riot_id_key: "text",
    registration_id: "uuid",
    player_id: "uuid",
  },
};
const importTables = Object.keys(importColumns);
const tournamentTables = Object.keys(tournamentColumns).filter(
  (name) => !importTables.includes(name),
);
const allTables = [
  ...Object.keys(nativeColumns),
  ...importTables,
  ...tournamentTables,
  "app_schema_migrations",
];

function fail(code, count = 1) {
  throw Object.assign(new Error(code), { code, migrationCheck: { count } });
}

function selectNexusMigrations(definitions) {
  return NEXUS_MIGRATION_KEYS.map((key) => {
    const matching = definitions.filter((row) => row.key === key);
    if (
      matching.length !== 1 ||
      !matching[0].sql ||
      matching[0].run ||
      !/^[a-f0-9]{64}$/.test(matching[0].checksum)
    ) {
      fail("NEXUS_MIGRATION_DEFINITION_INVALID");
    }
    return matching[0];
  });
}

function checkColumns(actual, expected, code) {
  const missing = Object.entries(expected).flatMap(([table, columns]) =>
    Object.entries(columns).filter(
      ([name, type]) => actual.get(`${table}.${name}`) !== type,
    ),
  );
  if (missing.length) fail(code, missing.length);
}

async function preflight(client, migrations) {
  const schema = (
    await client.query(
      "select current_schema() as schema, to_regprocedure('gen_random_uuid()') is not null as uuid_available",
    )
  ).rows[0];
  if (schema?.schema !== "public" || !schema.uuid_available)
    fail("NEXUS_DATABASE_PREREQUISITE_MISSING");
  const tables = (
    await client.query(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name=any($1::text[])",
      [allTables],
    )
  ).rows.map((row) => row.table_name);
  const columns = (
    await client.query(
      "select table_name,column_name,udt_name from information_schema.columns where table_schema='public' and table_name=any($1::text[])",
      [allTables],
    )
  ).rows;
  const columnMap = new Map(
    columns.map((row) => [
      `${row.table_name}.${row.column_name}`,
      row.udt_name,
    ]),
  );
  checkColumns(columnMap, nativeColumns, "NEXUS_NATIVE_SCHEMA_INCOMPATIBLE");
  let ledger = [];
  if (tables.includes("app_schema_migrations")) {
    checkColumns(
      columnMap,
      { app_schema_migrations: { migration_key: "text", checksum: "text" } },
      "NEXUS_LEDGER_INCOMPATIBLE",
    );
    ledger = (
      await client.query(
        "select migration_key,checksum from app_schema_migrations where migration_key=any($1::text[])",
        [NEXUS_MIGRATION_KEYS],
      )
    ).rows;
  }
  for (const row of ledger) {
    if (
      migrations.find((migration) => migration.key === row.migration_key)
        ?.checksum !== row.checksum
    )
      fail("NEXUS_MIGRATION_CHECKSUM_MISMATCH");
  }
  const hasImport = ledger.some(
    (row) => row.migration_key === NEXUS_MIGRATION_KEYS[0],
  );
  const hasTournament = ledger.some(
    (row) => row.migration_key === NEXUS_MIGRATION_KEYS[1],
  );
  if (hasTournament && !hasImport) fail("NEXUS_MIGRATION_ORDER_INVALID");
  if (
    importTables.some((name) => tables.includes(name) !== hasImport) ||
    tournamentTables.some((name) => tables.includes(name) !== hasTournament)
  )
    fail("NEXUS_PARTIAL_SCHEMA");
  // An unmarked upgrade must not already have modified the initial fixture shape.
  if (
    !hasTournament &&
    Object.keys(tournamentColumns.nexus_fixtures).some((name) =>
      columnMap.has(`nexus_fixtures.${name}`),
    )
  )
    fail("NEXUS_PARTIAL_SCHEMA");
  if (hasImport)
    checkColumns(columnMap, importColumns, "NEXUS_IMPORT_SCHEMA_INCOMPATIBLE");
  if (hasTournament) {
    checkColumns(
      columnMap,
      tournamentColumns,
      "NEXUS_TOURNAMENT_SCHEMA_INCOMPATIBLE",
    );
    const integrity = (
      await client.query(`select
      (select count(*) from pg_constraint where conrelid='public.nexus_fixtures'::regclass and convalidated and conname in ('nexus_fixture_native_teams','nexus_fixture_roster_window')) as constraints,
      (select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('nexus_fixture_generation_key','nexus_accepted_game_once') and i.indisvalid and i.indisunique) as indexes`)
    ).rows[0];
    if (Number(integrity.constraints) !== 2 || Number(integrity.indexes) !== 2)
      fail("NEXUS_INTEGRITY_CHECK_MISSING");
  }
  let duplicateAcceptedGames = 0;
  if (hasImport) {
    duplicateAcceptedGames = Number(
      (
        await client.query(
          "select count(*) as count from (select game_id from nexus_submissions where status='accepted' group by game_id having count(*)>1) duplicates",
        )
      ).rows[0].count,
    );
    if (duplicateAcceptedGames)
      fail("NEXUS_DUPLICATE_ACCEPTED_GAMES", duplicateAcceptedGames);
  }
  // Only fixed table names from this module reach the query; no row identifiers,
  // names, game payloads, access tokens or connection details enter the report.
  const counts = {};
  for (const table of allTables.filter(
    (name) => tables.includes(name) && name !== "app_schema_migrations",
  )) {
    counts[table] = Number(
      (await client.query(`select count(*) as count from public.${table}`))
        .rows[0].count,
    );
  }
  return { appliedMarkers: ledger.length, duplicateAcceptedGames, counts };
}

export async function applyNexusMigrations(client, definitions) {
  const migrations = selectNexusMigrations(
    definitions ?? (await loadMigrations()),
  );
  // Bound inspection queries too; applyMigrations has its own transaction-local
  // limits and serializes concurrent deployments with the existing advisory lock.
  await client.query("set statement_timeout = '120s'");
  const before = await preflight(client, migrations);
  const applied = await applyMigrations(client, migrations);
  const after = await preflight(client, migrations);
  const replayed = await applyMigrations(client, migrations);
  if (replayed.length)
    fail("NEXUS_MIGRATION_REPLAY_NOT_EMPTY", replayed.length);
  return {
    scope: "nexus-rising",
    before,
    applied,
    after,
    replayAppliedCount: replayed.length,
  };
}
