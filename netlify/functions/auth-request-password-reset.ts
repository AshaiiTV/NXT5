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

    if (!isValidEmail(email)) {
      throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    }
    if (!isPasswordEmailConfigured()) {
      throw Object.assign(new Error('Envoi e-mail non configuré. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM dans Netlify.'), { status: 500, code: 'EMAIL_NOT_CONFIGURED' });
    }

    const rows = await sql`select id, email, name from users where lower(email) = ${email} limit 1`;
    const user = rows[0];

    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const origin = process.env.PUBLIC_SITE_URL || new URL(request.url).origin;
      const resetUrl = `${origin.replace(/\/+$/, '')}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;

      await sql`update password_reset_tokens set used_at = now() where user_id = ${user.id} and used_at is null`;
      await sql`
        insert into password_reset_tokens (user_id, token_hash, expires_at)
        values (${user.id}, ${tokenHash}, ${expiresAt})
      `;
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
      await sql`
        insert into audit_logs (user_id, action, entity_type, metadata)
        values (${user.id}, 'auth.password_reset_request', 'user', ${JSON.stringify({ email })}::jsonb)
      `;
    }

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
