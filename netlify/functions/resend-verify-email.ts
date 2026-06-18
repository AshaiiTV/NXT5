import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, assertMethod } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, requireAuth, safeUser } from './_lib/auth';
import { sendEmailVerificationEmail } from './_lib/email';

function verificationErrorResponse(err: any, stage: string): Response {
  console.error('Email verification resend failed', { stage, err });
  const status = err?.status || 500;
  const code = err?.code || 'EMAIL_VERIFY_FAILED';
  const message = String(err?.publicMessage || err?.message || 'Erreur serveur.').trim();
  const payload: Record<string, unknown> = {
    error: status >= 500 ? `${message} Étape: ${stage}. Code: ${code}.` : message,
    code,
    stage
  };
  if (err?.retryAfter) payload.retryAfter = err.retryAfter;
  return json(payload, status);
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  let stage = 'init';
  try {
    stage = 'config';
    assertSessionSecret();
    assertMethod(request, 'POST');
    stage = 'schema';
    await ensureEmailVerificationColumns();
    stage = 'auth';
    const user = await requireAuth(request, context);
    stage = 'load-user';
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
    stage = 'store-token';
    const updated = await sql`
      update users
      set email_verified = false,
          email_verify_token = ${token},
          email_verify_expires_at = ${nextExpiresAt},
          updated_at = now()
      where id = ${current.id}
      returning id, account_name, email, coalesce(email_verified, false) as email_verified, name, created_at
    `;

    try {
      stage = 'send-email';
      await sendEmailVerificationEmail({ to: current.email, token });
    } catch (emailError) {
      stage = 'cleanup-token';
      await sql`
        update users
        set email_verify_token = null,
            email_verify_expires_at = null,
            updated_at = now()
        where id = ${current.id}
      `;
      throw emailError;
    }
    return json({ user: safeUser(updated[0]), sent: true });
  } catch (err) {
    return verificationErrorResponse(err, stage);
  }
}
