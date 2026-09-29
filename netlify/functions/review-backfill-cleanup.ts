import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';

export default async function handler(): Promise<Response> {
  try {
    await sql`delete from nxt5_review_backfill_backups where backed_up_at <= now() - interval '30 days'`;
  } catch (error) {
    // The backfill creates this optional table only when it runs in production.
    if (error?.code !== '42P01') throw error;
  }
  return new Response(null, { status: 204 });
}

export const config: Config = { schedule: '55 3 * * *' };
