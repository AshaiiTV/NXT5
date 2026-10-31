import pg from 'pg';
import { applyMigrations, loadMigrations } from './migration-runner.mjs';
import { loadReviewBackfillGenerator } from './review-backfill-generator.mjs';
import { runReviewBackfill } from './review-backfill-runner.mjs';
import { applyNexusMigrations } from './nexus-migration-runner.mjs';

if (process.env.CONTEXT && process.env.CONTEXT !== 'production') {
  throw new Error('Automatic migrations are restricted to the production deploy context. Use an isolated database outside Netlify to prepare previews.');
}
const scope = (process.env.NXT5_MIGRATION_SCOPE || '').trim();
if (scope && scope !== 'nexus-rising') {
  throw Object.assign(new Error('Unknown migration scope; no database connection was opened.'), { code: 'MIGRATION_SCOPE_INVALID' });
}
const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required for migrations.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
try {
  await client.connect();
  if (scope === 'nexus-rising') {
    console.log('Nexus migration:', JSON.stringify(await applyNexusMigrations(client)));
  } else {
    const applied = await applyMigrations(client, await loadMigrations());
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is up to date.');
  }
  // Only the production deployment performs this one-time historical rewrite.
  // Local schema setup and deploy previews must not touch existing reviews.
  if (!scope && process.env.CONTEXT === 'production') {
    const result = await runReviewBackfill({ client, ...await loadReviewBackfillGenerator() });
    const skippedByReason = {};
    for (const skipped of result.skipped || []) {
      skippedByReason[skipped.reason] = (skippedByReason[skipped.reason] || 0) + 1;
    }
    console.log('Historical review backfill:', JSON.stringify({
      alreadyCompleted: Boolean(result.alreadyCompleted),
      scanned: result.scanned,
      updated: result.updated,
      unchanged: result.unchanged,
      skippedByReason,
    }));
  }
} catch (error) {
  // Never expose connection strings or database contents in deployment logs.
  console.error('Database migration failed; deployment must stop.', { code: error?.code || 'MIGRATION_FAILED', ...(error?.migrationCheck ? { check: error.migrationCheck } : {}) });
  process.exitCode = 1;
} finally {
  await client.end();
}
