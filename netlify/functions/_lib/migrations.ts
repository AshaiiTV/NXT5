import { sql } from './db';

export const REQUIRED_SCHEMA_VERSION = 'audit-runtime-20260906-v1';
export const REQUIRED_RIOT_SCHEMA_VERSION = 'riot-sign-on-20260923-v1';
let ready: Promise<void> | undefined;
let riotReady: Promise<void> | undefined;

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

// Only Riot routes require the additive RSO schema. Ordinary email/password
// authentication remains available while this optional feature is deployed.
export function assertRiotSchemaReady(): Promise<void> {
  if (riotReady) return riotReady;
  riotReady = (async () => {
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${REQUIRED_RIOT_SCHEMA_VERSION}`;
    if (!rows.length) throw new Error('Missing Riot schema version');
  })().catch(() => {
    riotReady = undefined;
    throw Object.assign(new Error('Mise à jour de la base requise avant d’activer la connexion Riot.'), {
      status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'Service en cours de mise à jour.'
    });
  });
  return riotReady;
}
