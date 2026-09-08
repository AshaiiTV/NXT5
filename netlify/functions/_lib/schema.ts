import { assertSchemaReady } from './migrations';
import { sql } from './db';

export const ACCESS_REQUESTS_SCHEMA_VERSION = 'pricing-access-requests-20260908-v1';
let accessRequestsReady: Promise<void> | undefined;

// Keep this feature's migration independent from existing account/workspace routes.
// Runtime only checks the ledger; tools/migrate.mjs owns all DDL.
export function ensureAccessRequestsSchema(): Promise<void> {
  if (accessRequestsReady) return accessRequestsReady;
  accessRequestsReady = (async () => {
    await assertSchemaReady();
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${ACCESS_REQUESTS_SCHEMA_VERSION}`;
    if (!rows.length) throw new Error('Missing access requests schema version');
  })().catch(() => {
    accessRequestsReady = undefined;
    throw Object.assign(new Error('Mise à jour de la base requise pour les demandes d’accès.'), {
      status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'Service en cours de mise à jour.'
    });
  });
  return accessRequestsReady;
}

export async function ensureReportsSchema() {
  await assertSchemaReady();
}

export async function ensureCompositionTypesSchema() {
  await assertSchemaReady();
}

export async function ensureAuditLogsSchema() {
  await assertSchemaReady();
}

export async function ensureWorkflowSchema() {
  await assertSchemaReady();
}
