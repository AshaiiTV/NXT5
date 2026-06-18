import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, requireAuth, safeUser } from './_lib/auth';
import { sendEmailVerificationEmail } from './_lib/email';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await ensureEmailVerificationColumns();
    const rows = await sql`
      select id, account_name, email, coalesce(email_verified, false) as email_verified, email_verify_expires_at, name, created_at
      from users
      where id = ${user.id}
      limit 1
    `;
    const current = rows[0];
    if (!current) throw Object.assign(new Error('Compte introuvable.'), { status: 404 });
    if (!current.email) throw Object.assign(new Error('Ajoute une adresse e-mail avant de demander une vérification.'), { status: 400 });
    if (current.email_verified) return json({ user: safeUser(current), sent: false, alreadyVerified: true });

    const expiresAt = current.email_verify_expires_at ? new Date(current.email_verify_expires_at).getTime() : 0;
    const createdAt = expiresAt ? expiresAt - 24 * 60 * 60 * 1000 : 0;
    const waitMs = createdAt + 5 * 60 * 1000 - Date.now();
    if (waitMs > 0) {
      throw Object.assign(new Error('Attends quelques minutes avant de renvoyer un e-mail de vérification.'), {
        status: 429,
        code: 'EMAIL_VERIFY_RATE_LIMIT',
        retryAfter: Math.ceil(waitMs / 1000)
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const nextExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const updated = await sql`
      update users
      set email_verified = false,
          email_verify_token = ${token},
          email_verify_expires_at = ${nextExpiresAt},
          updated_at = now()
      where id = ${current.id}
      returning id, account_name, email, coalesce(email_verified, false) as email_verified, name, created_at
    `;

    await sendEmailVerificationEmail({ to: current.email, token });
    return json({ user: safeUser(updated[0]), sent: true });
  } catch (err) {
    return handleError(err);
  }
}
