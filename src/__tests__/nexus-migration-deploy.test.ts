import { afterEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  applyMigrations,
  loadMigrations,
} from "../../tools/migration-runner.mjs";
import {
  applyNexusMigrations,
  NEXUS_MIGRATION_KEYS,
} from "../../tools/nexus-migration-runner.mjs";

const databases: PGlite[] = [];
const originalExitCode = process.exitCode;
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.close()));
  process.exitCode = originalExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const module of [
    "pg",
    "../../tools/migration-runner.mjs",
    "../../tools/nexus-migration-runner.mjs",
    "../../tools/review-backfill-generator.mjs",
    "../../tools/review-backfill-runner.mjs",
  ])
    vi.doUnmock(module);
});

async function fixture() {
  const db = new PGlite();
  databases.push(db);
  await db.waitReady;
  await db.exec(`
    create table users(id uuid primary key, name text);
    create table teams(id uuid primary key, owner_id uuid references users(id), name text);
    create table players(id uuid primary key,team_id uuid references teams(id),name text,riot_id text,role text,roster_status text);
    create table team_members(team_id uuid references teams(id),user_id uuid references users(id),role text);
    insert into users values('00000000-0000-4000-8000-000000000001','Private user name');
    insert into teams values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Private native team');
    insert into players values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','Private player','Private#EUW','TOP','MAIN');
    insert into team_members values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','captain');
  `);
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) =>
      params
        ? db.query(sql, params)
        : (await db.exec(sql)).at(-1) || { rows: [] },
    ),
  };
  const definitions = await loadMigrations();
  const migrations = definitions.filter((m) =>
    NEXUS_MIGRATION_KEYS.includes(m.key),
  );
  return { db, client, definitions, migrations };
}

async function nativeRows(db: PGlite) {
  return Promise.all(
    ["users", "teams", "players", "team_members"].map((table) =>
      db.query(`select * from ${table}`),
    ),
  );
}

async function legacyCaptures(db: PGlite, duplicate = false) {
  const roster = JSON.stringify(
    Array.from({ length: 10 }, (_, index) => `Player${index}#EUW`),
  );
  for (let i = 1; i <= 2; i++) {
    const fixtureId = `00000000-0000-4000-8000-${String(10 + i).padStart(12, "0")}`;
    const pairingId = `00000000-0000-4000-8000-${String(20 + i).padStart(12, "0")}`;
    await db.query(
      "insert into nexus_fixtures(id,label,team_a,team_b,platform,starts_at,ends_at,roster) values($1,'Private match','A','B','EUW1',now(),now()+interval '1 hour',$2::jsonb)",
      [fixtureId, roster],
    );
    await db.query(
      "insert into nexus_import_pairings(id,fixture_id,uploader_riot_id,code_expires_at,expires_at) values($1,$2,'Private#EUW',now(),now())",
      [pairingId, fixtureId],
    );
    await db.query(
      "insert into nexus_submissions(fixture_id,pairing_id,game_id,idempotency_key,payload_hash,payload,summary,source,status) values($1,$2,$3,'key','hash','{\"secret\":\"private-payload\"}','{}','lcu-match-history','accepted')",
      [
        fixtureId,
        pairingId,
        duplicate ? "EUW1_PRIVATE_DUPLICATE" : `EUW1_PRIVATE_${i}`,
      ],
    );
  }
}

describe("targeted Nexus production migration", { timeout: 30_000 }, () => {
  it("only applies both Nexus definitions, preserves native rows and proves an empty replay", async () => {
    const { db, client, definitions } = await fixture();
    const before = await nativeRows(db);
    const result = await applyNexusMigrations(client, definitions);
    expect(result.applied).toEqual(NEXUS_MIGRATION_KEYS);
    expect(result.replayAppliedCount).toBe(0);
    expect(result.before.counts).toMatchObject({
      users: 1,
      teams: 1,
      players: 1,
      team_members: 1,
    });
    expect(result.after.appliedMarkers).toBe(2);
    expect(await nativeRows(db)).toEqual(before);
    expect(
      (
        await db.query(
          "select migration_key from app_schema_migrations order by migration_key",
        )
      ).rows.map((row: any) => row.migration_key),
    ).toEqual(NEXUS_MIGRATION_KEYS);
    const output = JSON.stringify(result);
    for (const privateValue of [
      "Private user name",
      "Private native team",
      "Private#EUW",
      "00000000-0000-4000-8000-000000000001",
    ])
      expect(output).not.toContain(privateValue);
    expect((await applyNexusMigrations(client, definitions)).applied).toEqual(
      [],
    );
  });

  it("upgrades a marked initial importer while preserving every legacy capture", async () => {
    const { db, client, definitions, migrations } = await fixture();
    await applyMigrations(client, migrations.slice(0, 1));
    await legacyCaptures(db);
    const before = (
      await db.query("select * from nexus_submissions order by game_id")
    ).rows;
    const result = await applyNexusMigrations(client, definitions);
    expect(result.applied).toEqual([NEXUS_MIGRATION_KEYS[1]]);
    expect(
      (await db.query("select * from nexus_submissions order by game_id")).rows,
    ).toEqual(before);
    expect(
      (await db.query("select distinct stage from nexus_fixtures")).rows,
    ).toEqual([{ stage: "legacy" }]);
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE|private-payload|Private match/,
    );
  });

  it("refuses mismatched native UUID columns before beginning any migration", async () => {
    const { db, client, definitions } = await fixture();
    await db.exec(
      "alter table players alter column id type text using id::text",
    );
    await expect(
      applyNexusMigrations(client, definitions),
    ).rejects.toMatchObject({ code: "NEXUS_NATIVE_SCHEMA_INCOMPATIBLE" });
    expect(
      (
        await db.query(
          "select to_regclass('public.nexus_fixtures') as relation",
        )
      ).rows,
    ).toEqual([{ relation: null }]);
    expect(client.query.mock.calls.some(([query]) => query === "begin")).toBe(
      false,
    );
  });

  it("refuses unmarked tables, partial upgrades and mismatched checksums", async () => {
    const { db, client, definitions, migrations } = await fixture();
    await db.exec("create table nexus_seasons(id uuid)");
    await expect(
      applyNexusMigrations(client, definitions),
    ).rejects.toMatchObject({ code: "NEXUS_PARTIAL_SCHEMA" });
    await db.exec("drop table nexus_seasons");
    await applyMigrations(client, migrations.slice(0, 1));
    await db.exec("alter table nexus_fixtures add column season_id uuid");
    await expect(
      applyNexusMigrations(client, definitions),
    ).rejects.toMatchObject({ code: "NEXUS_PARTIAL_SCHEMA" });
    await db.exec("alter table nexus_fixtures drop column season_id");
    await db.exec("update app_schema_migrations set checksum=repeat('0',64)");
    await expect(
      applyNexusMigrations(client, definitions),
    ).rejects.toMatchObject({ code: "NEXUS_MIGRATION_CHECKSUM_MISMATCH" });
  });

  it("refuses accepted duplicates without exposing their game identifiers or modifying evidence", async () => {
    const { db, client, definitions, migrations } = await fixture();
    await applyMigrations(client, migrations.slice(0, 1));
    await legacyCaptures(db, true);
    const before = (
      await db.query("select * from nexus_submissions order by id")
    ).rows;
    const error = await applyNexusMigrations(client, definitions).catch(
      (error) => error,
    );
    expect(error).toMatchObject({
      code: "NEXUS_DUPLICATE_ACCEPTED_GAMES",
      migrationCheck: { count: 1 },
    });
    expect(String(error)).not.toContain("EUW1_PRIVATE_DUPLICATE");
    expect(
      (await db.query("select * from nexus_submissions order by id")).rows,
    ).toEqual(before);
    expect(
      (await db.query("select to_regclass('public.nexus_seasons') as relation"))
        .rows,
    ).toEqual([{ relation: null }]);
  });

  it("rolls back the first migration and its marker when the second migration fails", async () => {
    const { db, client, definitions } = await fixture();
    const broken = definitions.map((row) =>
      row.key === NEXUS_MIGRATION_KEYS[1]
        ? { ...row, sql: row.sql + "\nselect 1/0;" }
        : row,
    );
    await expect(applyNexusMigrations(client, broken)).rejects.toMatchObject({
      code: "22012",
    });
    expect(
      (
        await db.query(
          "select to_regclass('public.nexus_fixtures') as fixtures,to_regclass('public.nexus_seasons') as seasons,to_regclass('public.app_schema_migrations') as ledger",
        )
      ).rows,
    ).toEqual([{ fixtures: null, seasons: null, ledger: null }]);
  });

  it("rejects a completed marker whose required uniqueness index has disappeared", async () => {
    const { db, client, definitions } = await fixture();
    await applyNexusMigrations(client, definitions);
    await db.exec("drop index nexus_accepted_game_once");
    await expect(
      applyNexusMigrations(client, definitions),
    ).rejects.toMatchObject({ code: "NEXUS_INTEGRITY_CHECK_MISSING" });
  });
});

async function scriptMocks(scope: string) {
  vi.resetModules();
  vi.stubEnv("CONTEXT", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://not-a-real-test-credential");
  vi.stubEnv("MIGRATION_DATABASE_URL", "");
  vi.stubEnv("NXT5_MIGRATION_SCOPE", scope);
  const client = { connect: vi.fn(), end: vi.fn() };
  const applyAll = vi.fn(async () => ["unrelated-migration"]);
  const applyNexus = vi.fn(async () => ({
    scope: "nexus-rising",
    replayAppliedCount: 0,
  }));
  const backfill = vi.fn(async () => ({
    scanned: 0,
    updated: 0,
    unchanged: 0,
  }));
  vi.doMock("pg", () => ({
    default: {
      Client: class {
        constructor() {
          return client;
        }
      },
    },
  }));
  vi.doMock("../../tools/migration-runner.mjs", () => ({
    applyMigrations: applyAll,
    loadMigrations: vi.fn(async () => []),
  }));
  vi.doMock("../../tools/nexus-migration-runner.mjs", () => ({
    applyNexusMigrations: applyNexus,
  }));
  vi.doMock("../../tools/review-backfill-generator.mjs", () => ({
    loadReviewBackfillGenerator: vi.fn(async () => ({})),
  }));
  vi.doMock("../../tools/review-backfill-runner.mjs", () => ({
    runReviewBackfill: backfill,
  }));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return { client, applyAll, applyNexus, backfill, log, error };
}

describe("migration deployment scope", () => {
  it("routes the Nexus scope exclusively to targeted migration and skips the historical backfill", async () => {
    const mocks = await scriptMocks("nexus-rising");
    await import("../../tools/migrate.mjs");
    expect(mocks.applyNexus).toHaveBeenCalledOnce();
    expect(mocks.applyAll).not.toHaveBeenCalled();
    expect(mocks.backfill).not.toHaveBeenCalled();
    expect(mocks.client.end).toHaveBeenCalledOnce();
  });
  it("keeps the existing full production migration and backfill behavior when no scope is set", async () => {
    const mocks = await scriptMocks("");
    await import("../../tools/migrate.mjs");
    expect(mocks.applyAll).toHaveBeenCalledOnce();
    expect(mocks.backfill).toHaveBeenCalledOnce();
    expect(mocks.applyNexus).not.toHaveBeenCalled();
  });
  it("rejects an unknown scope before opening a database connection", async () => {
    const mocks = await scriptMocks("nexsu-rising");
    await expect(import("../../tools/migrate.mjs")).rejects.toMatchObject({
      code: "MIGRATION_SCOPE_INVALID",
    });
    expect(mocks.client.connect).not.toHaveBeenCalled();
  });
  it("stops a failed scoped deployment and only logs the error code and aggregate check", async () => {
    const mocks = await scriptMocks("nexus-rising");
    mocks.applyNexus.mockRejectedValueOnce(
      Object.assign(new Error("Secret connection and private payload"), {
        code: "NEXUS_DUPLICATE_ACCEPTED_GAMES",
        migrationCheck: { count: 2 },
      }),
    );
    await import("../../tools/migrate.mjs");
    expect(process.exitCode).toBe(1);
    expect(mocks.error.mock.calls).toEqual([
      [
        "Database migration failed; deployment must stop.",
        { code: "NEXUS_DUPLICATE_ACCEPTED_GAMES", check: { count: 2 } },
      ],
    ]);
    expect(mocks.backfill).not.toHaveBeenCalled();
    expect(mocks.client.end).toHaveBeenCalledOnce();
  });
});
