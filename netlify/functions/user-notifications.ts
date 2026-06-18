import type { Context, Config } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth, safeUser } from './_lib/auth';
import { ensureUserNotificationColumns } from './_getTeamMembers.js';

function asBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'PATCH');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    await ensureUserNotificationColumns(sql);
    const currentRows = await sql`select notif_match, notif_report from users where id = ${user.id} limit 1`;
    const current = currentRows[0] || {};
    const notifMatch = asBoolean(body.notif_match, current.notif_match ?? true);
    const notifReport = asBoolean(body.notif_report, current.notif_report ?? true);

    const rows = await sql`
      update users
      set notif_match = ${notifMatch},
          notif_report = ${notifReport},
          updated_at = now()
      where id = ${user.id}
      returning id, account_name, email, email_verified, name, notif_match, notif_report, created_at
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.notification_preferences', 'user', ${JSON.stringify({ notif_match: notifMatch, notif_report: notifReport })}::jsonb)
    `;

    return json({ user: safeUser(rows[0]) });
  } catch (err) {
    return handleError(err);
  }
}

export const config: Config = {
  path: '/api/user/notifications'
};
