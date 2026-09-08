import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function loadMigrations() {
  const definitions = [
    ['baseline-20260906-v1', '../database/schema.sql'],
    ['audit-runtime-20260906-v1', '../database/migrations/20260906_runtime_schema.sql'],
    ['pricing-access-requests-20260908-v1', '../database/migrations/20260908_access_requests.sql'],
    ['pricing-access-requests-structure-20260908-v1', '../database/migrations/20260908_access_requests_structure.sql'],
    ['account-subscriptions-20260908-v1', '../database/migrations/20260908_account_subscriptions.sql'],
    ['account-subscriptions-discovery-default-20260908-v1', '../database/migrations/20260908_account_subscriptions_discovery_default.sql'],
  ];
  return Promise.all(definitions.map(async ([key, file]) => {
    const sql = await readFile(new URL(file, import.meta.url), 'utf8');
    return { key, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

// The dedicated connection keeps the lock and all DDL in one transaction.
// A failure also rolls back the migration ledger.
export async function applyMigrations(client, migrations) {
  await client.query('begin');
  try {
    await client.query("set local lock_timeout = '30s'");
    await client.query("set local statement_timeout = '120s'");
    await client.query('select pg_advisory_xact_lock($1)', [1853387829]);
    await client.query(`create table if not exists app_schema_migrations (
      migration_key text primary key,
      applied_at timestamptz not null default now(),
      checksum text
    )`);
    await client.query('alter table app_schema_migrations add column if not exists checksum text');
    const applied = [];
    for (const migration of migrations) {
      const result = await client.query('select checksum from app_schema_migrations where migration_key = $1', [migration.key]);
      if (result.rows.length) {
        if (result.rows[0].checksum !== migration.checksum) throw new Error(`Migration already applied with a different checksum: ${migration.key}`);
        continue;
      }
      await client.query(migration.sql);
      await client.query('insert into app_schema_migrations (migration_key, checksum) values ($1, $2)', [migration.key, migration.checksum]);
      applied.push(migration.key);
    }
    await client.query('commit');
    return applied;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
