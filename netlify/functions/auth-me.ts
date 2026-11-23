import type { Context } from "@netlify/functions";
import { json, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, readSessionCookie, requireAuth, safeUser } from './_lib/auth';
import { sql } from './_lib/db';
import { ensureUserNotificationColumns } from './_lib/team-member-emails';
import { isPlatformAdmin } from './_lib/platform-admin';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    // No session cookie at all is the ordinary anonymous visitor: answer the
    // session probe without an error and without touching the database. Any
    // cookie that is present is still fully checked by requireAuth below, so
    // an invalid, expired or revoked session keeps its 401 (and is cleared).
    if (!readSessionCookie(context)) return json({ user: null });
    assertSessionSecret();
    await ensureEmailVerificationColumns();
    const user = await requireAuth(request, context, { allowUnverifiedEmail: true });
    await ensureUserNotificationColumns(sql);
    const rows = await sql`
      select notif_match, notif_report, notif_inactivity, inactivity_notice_pending
      from users
      where id = ${user.id}
      limit 1
    `;
    return json({
      user: safeUser({
        ...user,
        ...(rows[0] || {}),
        is_platform_admin: isPlatformAdmin(user)
      })
    });
  } catch (err) {
    return handleError(err);
  }
}
