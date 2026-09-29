import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';

export default async function handler(): Promise<Response> {
  try {
    // Older installations may not yet have a migration ledger. Preserve V3
    // evidence until the classification migration has actually committed.
    const ledger = await sql`select to_regclass('public.app_schema_migrations') as relation`;
    const applied = ledger[0]?.relation
      ? await sql`select 1 from app_schema_migrations where migration_key='report-source-v3-20260929-v1'`
      : [];
    if (applied.length) {
      await sql`delete from nxt5_review_backfill_backups where backed_up_at <= now() - interval '30 days'`;
    } else {
      await sql`delete from nxt5_review_backfill_backups where backed_up_at <= now() - interval '30 days'
        and operation_key is distinct from 'automatic-review-v3-20260908'`;
    }
  } catch (error) {
    // The backfill creates this optional table only when it runs in production.
    if (error?.code !== '42P01') throw error;
  }
  return new Response(null, { status: 204 });
}

export const config: Config = { schedule: '55 3 * * *' };
