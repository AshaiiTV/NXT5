import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertAccountDeletionSchemaReady } from './_lib/migrations';

// Receipts are kept 12 months, as announced in the privacy policy.
export default async function handler(): Promise<Response> {
  await assertAccountDeletionSchemaReady();
  await sql`delete from account_deletion_confirmations where expires_at <= now()`;
  await sql`delete from account_reauthentications where expires_at <= now()`;
  await sql`delete from account_deletion_receipts where completed_at < now() - interval '12 months'`;
  return new Response(null, { status: 204 });
}
export const config: Config = { schedule: '50 3 * * *' };
