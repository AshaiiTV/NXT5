import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { json } from './_lib/http';
import { ensureAccessRequestsSchema } from './_lib/schema';

// Netlify schedules are only invoked by the platform, never through a public URL
// in production. No contact message is sent and no account/team data is affected.
export default async function handler(_request: Request): Promise<Response> {
  try {
    await ensureAccessRequestsSchema();
    const rows = await sql`
      with deleted as (
        delete from access_requests where created_at <= now() - interval '6 months' returning id
      ) select count(*)::integer as deleted from deleted
    `;
    return json({ ok: true, deleted: Number(rows[0]?.deleted || 0) });
  } catch (err: any) {
    // Log only the failure code, never a prospect's details.
    console.error('[access-requests-cleanup] Cleanup failed.', { code: err?.code || 'CLEANUP_FAILED' });
    return json({ error: 'Nettoyage temporairement indisponible.' }, 503);
  }
}

export const config: Config = { schedule: '15 3 * * *' };
