// Only the local preview runner aliases auth/db to this module. Never imported
// by the production application or any deployed function.
import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ownerId = '00000000-0000-4000-8000-000000000001';
export const teamId = '00000000-0000-4000-8000-000000000010';
const root = new URL('../../', import.meta.url);
await mkdir(new URL('.nxt5-drafter-prototype/', root), { recursive: true });
export const db = new PGlite(fileURLToPath(new URL('.nxt5-drafter-prototype/db', root)));
await db.waitReady;

const existing = await db.query("select to_regclass('public.app_schema_migrations') as name");
if (!existing.rows[0].name) {
  const schema = await readFile(new URL('database/schema.sql', root), 'utf8');
  await db.transaction(async tx => {
    await tx.exec(schema.replace(/create extension if not exists pgcrypto;/g, '')
      .replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')"));
    await tx.exec('create table app_schema_migrations(migration_key text primary key)');
  });
}
// The initial local runner recorded the runtime marker without applying its
// SQL. A distinct local marker repairs those databases as well as fresh ones.
// This migration is idempotent and depends only on schema.sql above.
const runtimeRepairKey = 'local-prototype-runtime-applied-v1';
if (!(await db.query('select 1 from app_schema_migrations where migration_key=$1', [runtimeRepairKey])).rows.length) {
  const runtimeMigration = await readFile(new URL('database/migrations/20260906_runtime_schema.sql', root), 'utf8');
  await db.transaction(async tx => {
    await tx.exec(runtimeMigration);
    await tx.query('insert into app_schema_migrations(migration_key) values ($1), ($2) on conflict do nothing',
      ['audit-runtime-20260906-v1', runtimeRepairKey]);
  });
}
const migrationKey = 'opponents-drafts-20261012-v1';
if (!(await db.query('select 1 from app_schema_migrations where migration_key=$1', [migrationKey])).rows.length) {
  const migration = await readFile(new URL('database/migrations/20261012_opponents_drafts.sql', root), 'utf8');
  await db.transaction(async tx => {
    await tx.exec(migration);
    await tx.query('insert into app_schema_migrations(migration_key) values ($1) on conflict do nothing', [migrationKey]);
  });
}
await db.query("insert into users(id,account_name,name,password_hash) values($1,'prototype-drafter','Staff de démonstration','disabled-local-account') on conflict(id) do nothing", [ownerId]);
await db.query("insert into teams(id,owner_id,name,tag) values($1,$2,'Équipe de démonstration','DEMO') on conflict(id) do nothing", [teamId, ownerId]);
const matchMigrationKey = 'match-drafts-20261012-v1';
if (!(await db.query('select 1 from app_schema_migrations where migration_key=$1', [matchMigrationKey])).rows.length) {
  const migration = await readFile(new URL('database/migrations/20261012_match_drafts.sql', root), 'utf8');
  await db.transaction(async tx => {
    await tx.exec(migration);
    await tx.query('insert into app_schema_migrations(migration_key) values ($1)', [matchMigrationKey]);
  });
}
const opponentMatchMigrationKey = 'match-opponents-20261012-v1';
if (!(await db.query('select 1 from app_schema_migrations where migration_key=$1', [opponentMatchMigrationKey])).rows.length) {
  const migration = await readFile(new URL('database/migrations/20261012_match_opponents.sql', root), 'utf8');
  await db.transaction(async tx => {
    await tx.exec(migration);
    await tx.query('insert into app_schema_migrations(migration_key) values ($1)', [opponentMatchMigrationKey]);
  });
}
export const matchId = '00000000-0000-4000-8000-000000000020';
await db.query("insert into matches(id,team_id,game_id,opponent,result,created_by,raw) values($1,$2,'DEMO-DRAFTER','OPIF · partie de démonstration','Analyse',$3,$4::jsonb) on conflict(id) do nothing",
  [matchId, teamId, ownerId, JSON.stringify({ nxt5Label: 'OPIF · partie de démonstration' })]);
export async function getDemoData() {
  return { teams: (await db.query('select * from teams where id=$1', [teamId])).rows,
    matches: (await db.query('select * from matches where team_id=$1 order by created_at desc', [teamId])).rows.map(match => ({ ...match, participants: [] })),
    teamMembers: [], players: [], reports: [], matchCategories: [], matchArchives: [], championPool: [], bootstrapRevision: 'drafter-independent-v3' };
}

const statement = parts => parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
export const sql = Object.assign(async (parts, ...values) => (await db.query(statement(parts), values)).rows, {
  transaction: async build => {
    const batch = build((parts, ...values) => ({ text: statement(parts), values }));
    return db.transaction(async tx => {
      const rows = [];
      for (const query of batch) rows.push((await tx.query(query.text, query.values)).rows);
      return rows;
    });
  },
});
export function assertSessionSecret() {
  if ((process.env.SESSION_SECRET || '').length < 64) throw new Error('Local prototype secret missing');
}
export async function requireAuth() {
  return { id: ownerId, name: 'Staff de démonstration', account_name: 'prototype-drafter' };
}
