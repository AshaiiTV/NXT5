import type { Context } from "@netlify/functions";
import { json, handleError } from './_lib/http';
import { COOKIE_NAME, assertSessionSecret, ensureEmailVerificationColumns, readSessionCookie, requireAuth, safeUser } from './_lib/auth';
import { sql } from './_lib/db';
import { ensureUserNotificationColumns } from './_getTeamMembers.js';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (!readSessionCookie(context)) {
      context.cookies.set({ name: COOKIE_NAME, value: '', httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 0 });
      throw Object.assign(new Error('Session absente.'), { status: 401 });
    }
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
