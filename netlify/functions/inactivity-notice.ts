import type { Context, Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { json, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth, safeUser } from './_lib/auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const rows = await sql`
      update users
      set inactivity_notice_pending = false
      where id = ${user.id}
      returning id, account_name, email, email_verified, name, notif_match, notif_report,
                notif_inactivity, inactivity_notice_pending, created_at
    `;
    return json({ user: safeUser(rows[0] || user) });
  } catch (error) {
    return handleError(error);
  }
}

export const config: Config = {
  path: '/api/user/inactivity-notice'
};
