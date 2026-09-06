import { assertSchemaReady } from './migrations';
import { sql } from './db';
import type { DbUser } from './types';

export const INACTIVITY_DAYS = 90;
const INACTIVITY_MS = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

export function isInactiveSince(lastActiveAt: unknown, now: Date | number = Date.now()): boolean {
  if (lastActiveAt === null || lastActiveAt === undefined || lastActiveAt === '') return false;
  const lastActiveMs = new Date(lastActiveAt as any).getTime();
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return Number.isFinite(lastActiveMs) && Number.isFinite(nowMs) && nowMs >= lastActiveMs && nowMs - lastActiveMs >= INACTIVITY_MS;
}

export async function ensureUserEngagementSchema(): Promise<void> {
  await assertSchemaReady();
}

export async function recordUserActivity<T extends DbUser>(user: T): Promise<T> {
  await ensureUserEngagementSchema();
  const rows = await sql`
    update users
    set inactivity_notice_pending = case
          when last_active_at <= now() - interval '90 days' then true
          else inactivity_notice_pending
        end,
        last_active_at = now()
    where id = ${user.id}
      and (last_active_at is null or last_active_at < now() - interval '5 minutes')
    returning last_active_at, inactivity_notice_pending, notif_inactivity,
              inactivity_email_sent_at, inactivity_email_claimed_at
  `;
  return rows[0] ? { ...user, ...rows[0] } as T : user;
}
