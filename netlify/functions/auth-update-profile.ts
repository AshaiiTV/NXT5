import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, isValidEmail, normalizeEmail, requireAuth, safeUser, sha256, verifyPassword } from './_lib/auth';
import { sendEmailVerificationEmail } from './_lib/email';
import { ensureUserNotificationColumns } from './_getTeamMembers.js';
import { assertSubjectRateLimit, assertVerificationEmailRateLimit } from './_lib/rate-limit';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request, 8192);
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
      select email, password_hash
      from users
      where id = ${user.id}
      limit 1
    `;
    const current = currentRows[0];
    if (!current) throw Object.assign(new Error('Compte introuvable.'), { status: 404 });
    const emailChanged = normalizeEmail(current.email) !== email;
    if (emailChanged) {
      const currentPassword = String(body.currentPassword || '');
      if (!currentPassword) {
        throw Object.assign(new Error('Confirme ton mot de passe actuel pour changer ton adresse e-mail.'), {
          status: 401, code: 'EMAIL_CHANGE_REAUTH_REQUIRED'
        });
      }
      await assertSubjectRateLimit('email-change-reauth', user.id, { limit: 5, windowSeconds: 60 });
      if (currentPassword.length > 128 || !await verifyPassword(currentPassword, current.password_hash)) {
        throw Object.assign(new Error('Mot de passe actuel incorrect.'), { status: 401, code: 'INVALID_PASSWORD' });
      }
      await assertVerificationEmailRateLimit(user.id, email);
    }
    const verifyToken = emailChanged ? crypto.randomBytes(32).toString('base64url') : null;
    const verifyTokenHash = verifyToken ? sha256(verifyToken) : null;
    const verifyExpiresAt = emailChanged ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    const rows = emailChanged ? await sql`
      update users
      set name = ${name},
          email = ${email},
          email_verified = false,
          email_verify_token = ${verifyTokenHash},
          email_verify_expires_at = ${verifyExpiresAt},
          updated_at = now()
      where id = ${user.id}
        and email is not distinct from ${current.email}
        and password_hash = ${current.password_hash}
      returning id, account_name, email, email_verified, name, notif_match, notif_report,
                notif_inactivity, inactivity_notice_pending, created_at
    ` : await sql`
      update users
      set name = ${name},
          updated_at = now()
      where id = ${user.id}
      returning id, account_name, email, email_verified, name, notif_match, notif_report,
                notif_inactivity, inactivity_notice_pending, created_at
    `;

    if (!rows[0]) {
      throw Object.assign(new Error('Ton compte a changé pendant la modification. Recharge la page puis réessaie.'), {
        status: 409, code: 'ACCOUNT_CHANGED'
      });
    }

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
