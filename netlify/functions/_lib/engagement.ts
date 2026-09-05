import { sql } from './db';
import { ensureMigration } from './migrations';
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
  await ensureMigration('user-engagement-2026-09-05-v1', async () => {
    await sql`alter table sessions add column if not exists last_seen_at timestamptz`;
    await sql`alter table users add column if not exists last_active_at timestamptz`;
    await sql`alter table users add column if not exists inactivity_email_sent_at timestamptz`;
    await sql`alter table users add column if not exists inactivity_email_claimed_at timestamptz`;
    await sql`alter table users add column if not exists inactivity_notice_pending boolean not null default false`;
    await sql`alter table users add column if not exists notif_inactivity boolean not null default true`;
    await sql`
      update users
      set last_active_at = coalesce(
        (select max(coalesce(sessions.last_seen_at, sessions.created_at)) from sessions where sessions.user_id = users.id),
        users.updated_at,
        users.created_at,
        now()
      )
      where last_active_at is null
    `;
    await sql`alter table users alter column last_active_at set default now()`;
    await sql`alter table users alter column last_active_at set not null`;
    await sql`
      create index if not exists idx_users_inactivity_reminder
      on users(last_active_at)
      where email_verified is true and notif_inactivity is true
    `;
  });
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
