import { logFailure } from './_lib/safe-log';
import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { ensureEmailVerificationColumns } from './_lib/auth';
import { sendInactivityReminderEmail } from './_lib/email';

const BATCH_SIZE = 20;

async function recordSentReminder(userId: string) {
  await sql`
    with pending as (
      delete from inactivity_reminder_pending where user_id=${userId} and state='sent_pending' returning *
    ), delivery as (
      insert into inactivity_reminder_deliveries (user_id, recipient_email, inactive_since_at, sent_at)
      select user_id, recipient_email, inactive_since_at, sent_at from pending returning user_id, sent_at
    )
    update users set inactivity_email_sent_at=delivery.sent_at,
      inactivity_email_claimed_at=null, inactivity_notice_pending=true
    from delivery where users.id=delivery.user_id
  `;
}

export default async function handler(_request: Request): Promise<Response> {
  await ensureEmailVerificationColumns();
  let sent = 0;
  let failed = 0;
  const pending = await sql`select user_id from inactivity_reminder_pending where state='sent_pending' limit ${BATCH_SIZE}`;
  for (const row of pending) {
    try { await recordSentReminder(row.user_id); }
    catch { failed += 1; }
  }
  const candidates = await sql`
    select id, email, name, last_active_at::text as last_active_at
    from users
    where last_active_at <= now() - interval '90 days'
      and coalesce(email_verified, false) = true
      and coalesce(notif_inactivity, true) = true
      and email is not null
      and email <> ''
      and not exists (select 1 from inactivity_reminder_pending p where p.user_id=users.id and p.inactive_since_at >= users.last_active_at)
      and (inactivity_email_sent_at is null or inactivity_email_sent_at < last_active_at)
      and (inactivity_email_claimed_at is null or inactivity_email_claimed_at < now() - interval '1 hour')
    order by last_active_at asc
    limit ${BATCH_SIZE}
  `;

  for (const candidate of candidates) {
    const claimed = await sql`
      update users
      set inactivity_email_claimed_at = now()
      where id = ${candidate.id}
        and last_active_at = ${candidate.last_active_at}
        and last_active_at <= now() - interval '90 days'
        and coalesce(email_verified, false) = true
        and coalesce(notif_inactivity, true) = true
        and not exists (select 1 from inactivity_reminder_pending p where p.user_id=users.id and p.inactive_since_at >= users.last_active_at)
        and (inactivity_email_sent_at is null or inactivity_email_sent_at < last_active_at)
        and (inactivity_email_claimed_at is null or inactivity_email_claimed_at < now() - interval '1 hour')
      returning id
    `;
    if (!claimed.length) continue;

    // Persist the no-resend barrier BEFORE contacting the provider. If the
    // process stops after sending, expiry of the old claim cannot resend it.
    const reserved = await sql`
      insert into inactivity_reminder_pending (user_id, recipient_email, inactive_since_at, state)
      values (${candidate.id}, ${String(candidate.email).trim().toLowerCase()}, ${candidate.last_active_at}, 'sending')
      on conflict (user_id) do update
      set recipient_email=excluded.recipient_email, inactive_since_at=excluded.inactive_since_at,
        state='sending', sent_at=null
      where inactivity_reminder_pending.inactive_since_at < excluded.inactive_since_at
        and inactivity_reminder_pending.state='sending'
      returning user_id
    `;
    if (!reserved.length) continue;
    try {
      await sendInactivityReminderEmail({ to: candidate.email, name: candidate.name });
    } catch (error: any) {
      failed += 1;
      logFailure('[inactivity-reminders] Delivery failed.', error);
      // Only explicit provider rejection/configuration failure proves no send.
      // Network interruptions are ambiguous and retain the durable barrier.
      if (['EMAIL_DELIVERY_FAILED', 'EMAIL_NOT_CONFIGURED'].includes(error?.code)) {
        await sql`delete from inactivity_reminder_pending where user_id=${candidate.id} and state='sending' and inactive_since_at=${candidate.last_active_at}`;
        await sql`update users set inactivity_email_claimed_at = null where id = ${candidate.id}`;
      }
      continue;
    }
    sent += 1;
    try {
      await sql`update inactivity_reminder_pending set state='sent_pending', sent_at=now() where user_id=${candidate.id} and inactive_since_at=${candidate.last_active_at}`;
      await recordSentReminder(candidate.id);
    } catch {
      // Retry only accounting on the next run. Never release a sent reservation.
      failed += 1;
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
