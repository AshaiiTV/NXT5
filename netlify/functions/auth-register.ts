import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, hashPassword, isValidEmail, normalizeAccountName, normalizeEmail, sha256 } from './_lib/auth';
import { sendEmailVerificationEmail } from './_lib/email';
import { assertRateLimit, assertVerificationEmailRateLimit } from './_lib/rate-limit';

import { LEGAL_VERSION } from '../../shared/legal.js';

const registrationAccepted = () => json({ ok: true, message: 'Si cette adresse peut être utilisée, tu recevras un e-mail de vérification. Si tu as déjà un compte, connecte-toi ou réinitialise ton mot de passe.' }, 202);

function accountNameFromEmail(email) {
  const base = normalizeAccountName(email.split('@')[0]).replace(/[^a-z0-9._-]/g, '').slice(0, 18) || 'compte';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertRateLimit(request, 'auth-register', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request, 4096);
    const email = normalizeEmail(body.email);
    const displayName = String(body.displayName || '').trim().replace(/\s+/g, ' ');
    const password = String(body.password || '');
    const acceptLegal = body.acceptLegal === true;
    const legalVersion = String(body.legalVersion || '');

    if (!email || !displayName || !password) {
      throw Object.assign(new Error('E-mail, pseudo et mot de passe requis.'), { status: 400 });
    }
    if (displayName.length < 3 || displayName.length > 32) {
      throw Object.assign(new Error('Le pseudo doit faire entre 3 et 32 caractères.'), { status: 400 });
    }
    if (!isValidEmail(email) || email.length > 160) {
      throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    }
    if (password.length < 8) {
      throw Object.assign(new Error('Mot de passe trop court : 8 caractères minimum.'), { status: 400 });
    }
    if (password.length > 128) {
      throw Object.assign(new Error('Mot de passe trop long : 128 caractères maximum.'), { status: 400 });
    }
    if (!acceptLegal || legalVersion !== LEGAL_VERSION) {
      throw Object.assign(new Error('Tu dois accepter les CGU et le règlement en vigueur et reconnaître avoir lu la politique de confidentialité.'), { status: 400, code: 'LEGAL_ACCEPTANCE_REQUIRED' });
    }

    await ensureEmailVerificationColumns();
    // Perform the same password work before the existence check. Neither the
    // response nor a session cookie reveals whether the account was created.
    const passwordHash = await hashPassword(password);
    const existing = await sql`select id from users where lower(email) = ${email} limit 1`;
    if (existing.length) return registrationAccepted();
    // Reserve delivery before creating an account, so a shared recipient limit
    // cannot leave an unexpected registered account behind a 429 response.
    const userId = crypto.randomUUID();
    try {
      await assertVerificationEmailRateLimit(userId, email);
    } catch (failure: any) {
      if (failure?.status === 429) return registrationAccepted();
      throw failure;
    }
    const accountName = accountNameFromEmail(email);
    const verifyToken = crypto.randomBytes(32).toString('base64url');
    const verifyTokenHash = sha256(verifyToken);
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const users = await sql`
      insert into users (id, account_name, email, name, password_hash, email_verified, email_verify_token, email_verify_expires_at)
      values (${userId}, ${accountName}, ${email}, ${displayName}, ${passwordHash}, false, ${verifyTokenHash}, ${verifyExpiresAt})
      returning id, account_name, email, coalesce(email_verified, false) as email_verified, name, created_at
    `;

    const user = users[0];
    await sql`
      update users
      set legal_accepted_at = now(), legal_version = ${LEGAL_VERSION}
      where id = ${user.id}
    `;
    const delivery = sendEmailVerificationEmail({ to: email, token: verifyToken }).catch(() => {
      console.error('[registration] Verification email unavailable.', { code: 'EMAIL_DELIVERY_FAILED' });
    });
    if (typeof (context as any).waitUntil === 'function') (context as any).waitUntil(delivery);
    else await delivery;

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.register', 'user', ${JSON.stringify({ email, displayName })}::jsonb)
    `;

    return registrationAccepted();
  } catch (err) {
    if (err?.code === '23505') return registrationAccepted();
    return handleError(err);
  }
}
