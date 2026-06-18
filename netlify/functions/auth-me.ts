import type { Context } from "@netlify/functions";
import { json, handleError } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, requireAuth, safeUser } from './_lib/auth';
import { sql } from './_lib/db';
import { ensureUserNotificationColumns } from './_getTeamMembers.js';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    await ensureEmailVerificationColumns();
    const user = await requireAuth(request, context);
    await ensureUserNotificationColumns(sql);
    const rows = await sql`select notif_match, notif_report from users where id = ${user.id} limit 1`;
    return json({ user: safeUser({ ...user, ...(rows[0] || {}) }) });
  } catch (err) {
    return handleError(err);
  }
}
