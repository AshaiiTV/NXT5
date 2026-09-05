import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { ensureEmailVerificationColumns } from './_lib/auth';
import { sendInactivityReminderEmail } from './_lib/email';

const BATCH_SIZE = 20;

export default async function handler(_request: Request): Promise<Response> {
  await ensureEmailVerificationColumns();
  const candidates = await sql`
    select id, email, name, last_active_at
    from users
    where last_active_at <= now() - interval '90 days'
      and coalesce(email_verified, false) = true
      and coalesce(notif_inactivity, true) = true
      and email is not null
      and email <> ''
      and (inactivity_email_sent_at is null or inactivity_email_sent_at < last_active_at)
      and (inactivity_email_claimed_at is null or inactivity_email_claimed_at < now() - interval '1 hour')
    order by last_active_at asc
    limit ${BATCH_SIZE}
  `;

  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const claimed = await sql`
      update users
      set inactivity_email_claimed_at = now()
      where id = ${candidate.id}
        and last_active_at <= now() - interval '90 days'
        and coalesce(email_verified, false) = true
        and coalesce(notif_inactivity, true) = true
        and (inactivity_email_sent_at is null or inactivity_email_sent_at < last_active_at)
        and (inactivity_email_claimed_at is null or inactivity_email_claimed_at < now() - interval '1 hour')
      returning id
    `;
    if (!claimed.length) continue;

    try {
      await sendInactivityReminderEmail({ to: candidate.email, name: candidate.name });
      await sql`
        update users
        set inactivity_email_sent_at = now(),
            inactivity_email_claimed_at = null,
            inactivity_notice_pending = true
        where id = ${candidate.id}
      `;
      sent += 1;
    } catch (error: any) {
      failed += 1;
      console.error('[inactivity-reminders] Delivery failed.', { userId: candidate.id, code: error?.code || null });
      await sql`update users set inactivity_email_claimed_at = null where id = ${candidate.id}`;
    }
  }

  return new Response(JSON.stringify({ processed: candidates.length, sent, failed }), {
    status: failed && !sent ? 503 : 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export const config: Config = {
  schedule: '0 9 * * *'
};
