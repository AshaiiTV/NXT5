import { sql } from './db';

const migrationPromises = new Map<string, Promise<void>>();

export function ensureMigration(migrationKey: string, migrate: () => Promise<void>): Promise<void> {
  const cached = migrationPromises.get(migrationKey);
  if (cached) return cached;

  const migration = (async () => {
    await sql`
      create table if not exists app_schema_migrations (
        migration_key text primary key,
        applied_at timestamptz not null default now()
      )
    `;
    const applied = await sql`
      select migration_key
      from app_schema_migrations
      where migration_key = ${migrationKey}
      limit 1
    `;
    if (applied.length) return;
    await migrate();
    await sql`
      insert into app_schema_migrations (migration_key)
      values (${migrationKey})
      on conflict (migration_key) do nothing
    `;
  })();

  const guarded = migration.catch((error) => {
    migrationPromises.delete(migrationKey);
    throw error;
  });
  migrationPromises.set(migrationKey, guarded);
  return guarded;
}
