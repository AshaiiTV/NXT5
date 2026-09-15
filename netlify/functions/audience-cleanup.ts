import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { json } from './_lib/http';
import { assertAudienceReady, audienceFailure } from './_lib/audience';

export default async function handler(_request: Request): Promise<Response> {
  try {
    await assertAudienceReady();
    const rows = await sql`
      with events as (delete from audience_events where created_at < now() - interval '180 days' returning event_id),
      pages as (delete from audience_pages where viewed_at < now() - interval '180 days' returning page_id),
      sessions as (delete from audience_sessions where last_seen_at < now() - interval '180 days' returning id),
      proofs as (delete from audience_consents where expires_at <= now() or created_at < now() - interval '180 days' returning receipt_hash)
      select (select count(*) from events)::integer as events, (select count(*) from pages)::integer as pages,
        (select count(*) from sessions)::integer as sessions, (select count(*) from proofs)::integer as proofs
    `;
    return json({ ok: true, deleted: rows[0] });
  } catch (err) { return audienceFailure(err); }
}

export const config: Config = { schedule: '35 3 * * *' };
