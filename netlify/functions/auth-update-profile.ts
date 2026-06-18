import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, isValidEmail, normalizeEmail, requireAuth, safeUser } from './_lib/auth';
import { sendEmailVerificationEmail } from './_lib/email';
import { ensureUserNotificationColumns } from './_getTeamMembers.js';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(body.email);

    if (name.length < 3 || name.length > 32) {
      throw Object.assign(new Error('Le pseudo doit faire entre 3 et 32 caractères.'), { status: 400 });
    }
    if (!isValidEmail(email) || email.length > 160) {
      throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    }

    await ensureUserNotificationColumns(sql);
    await ensureEmailVerificationColumns();
    const currentRows = await sql`
      select email
      from users
      where id = ${user.id}
      limit 1
    `;
    const emailChanged = normalizeEmail(currentRows[0]?.email) !== email;
    const verifyToken = emailChanged ? crypto.randomBytes(32).toString('hex') : null;
    const verifyExpiresAt = emailChanged ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    const rows = emailChanged ? await sql`
      update users
      set name = ${name},
          email = ${email},
          email_verified = false,
          email_verify_token = ${verifyToken},
          email_verify_expires_at = ${verifyExpiresAt},
          updated_at = now()
      where id = ${user.id}
      returning id, account_name, email, email_verified, name, notif_match, notif_report, created_at
    ` : await sql`
      update users
      set name = ${name},
          updated_at = now()
      where id = ${user.id}
      returning id, account_name, email, email_verified, name, notif_match, notif_report, created_at
    `;

    if (emailChanged) {
      await sendEmailVerificationEmail({ to: email, token: verifyToken });
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.profile_update', 'user', ${JSON.stringify({ name, email, emailChanged })}::jsonb)
    `;

    return json({ user: safeUser(rows[0]) });
  } catch (err) {
    if (String(err.message || '').includes('idx_users_email_lower')) err.message = 'Cet e-mail est déjà utilisé.';
    return handleError(err);
  }
}
