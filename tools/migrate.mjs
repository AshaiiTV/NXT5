import pg from 'pg';
import { applyMigrations, loadMigrations } from './migration-runner.mjs';

if (process.env.CONTEXT && process.env.CONTEXT !== 'production') {
  throw new Error('Automatic migrations are restricted to the production deploy context. Use an isolated database outside Netlify to prepare previews.');
}
const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required for migrations.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
try {
  await client.connect();
  const applied = await applyMigrations(client, await loadMigrations());
  console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is up to date.');
} catch (error) {
  // Never expose connection strings or database contents in deployment logs.
  console.error('Database migration failed; deployment must stop.', { code: error?.code || 'MIGRATION_FAILED' });
  process.exitCode = 1;
} finally {
  await client.end();
}
