import { sql } from './db';

export const REQUIRED_SCHEMA_VERSION = 'audit-runtime-20260906-v1';
let ready: Promise<void> | undefined;

// Requests only check readiness. DDL and backfills run in tools/migrate.mjs,
// under a PostgreSQL transaction lock, before production deployment.
export function assertSchemaReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${REQUIRED_SCHEMA_VERSION}`;
    if (!rows.length) throw new Error('Missing schema version');
  })().catch(() => {
    ready = undefined;
    throw Object.assign(new Error('Mise à jour de la base requise avant de démarrer cette version.'), {
      status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'Service en cours de mise à jour.'
    });
  });
  return ready;
}
