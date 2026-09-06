import { assertSchemaReady } from './migrations';

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
