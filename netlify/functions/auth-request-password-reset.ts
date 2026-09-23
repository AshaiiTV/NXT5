import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, isValidEmail, normalizeEmail, sha256 } from './_lib/auth';
import { isPasswordEmailConfigured, sendPasswordResetEmail } from './_lib/email';
import { assertRateLimit } from './_lib/rate-limit';

export default async function handler(request: Request): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertRateLimit(request, 'auth-forgot-password', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request);
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email) || email.length > 160) {
      throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    }
    if (!isPasswordEmailConfigured()) {
      throw Object.assign(new Error('Envoi e-mail non configuré. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM dans Netlify.'), { status: 500, code: 'EMAIL_NOT_CONFIGURED' });
    }

    const rows = await sql`select id, email, name, xmin::text as account_version from users where lower(email) = ${email} limit 1`;
    const user = rows[0];

    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const origin = process.env.PUBLIC_SITE_URL || new URL(request.url).origin;
      const resetUrl = `${origin.replace(/\/+$/, '')}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;

      // Share the account version with password changes and redemptions so a
      // recovery link cannot be issued from an account snapshot they replaced.
      const issued = await sql`
        with changed_account as (
          update users set updated_at = now()
          where id = ${user.id} and xmin = ${user.account_version}::xid
            and lower(email) = ${email}
          returning id
        ), invalidated_tokens as (
          update password_reset_tokens set used_at = now()
          where user_id in (select id from changed_account) and used_at is null
        ), issued_token as (
          insert into password_reset_tokens (user_id, token_hash, expires_at)
          select id, ${tokenHash}, ${expiresAt}::timestamptz from changed_account
          returning user_id
        ), logged_request as (
          insert into audit_logs (user_id, action, entity_type, metadata)
          select user_id, 'auth.password_reset_request', 'user', ${JSON.stringify({ email })}::jsonb from issued_token
        )
        select user_id from issued_token
      `;
      // Preserve the same public response for a missing or concurrently changed
      // account; never send a link unless its issuance actually committed.
      if (!issued[0]) return json({ ok: true });
      try {
        await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
      } catch {
        // Delivery availability must not disclose whether an address is
        // registered. Do not log the email, recovery URL or provider response.
        console.error('[password-reset] Email delivery failed.', { code: 'PASSWORD_RESET_EMAIL_FAILED' });
      }
    }

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
