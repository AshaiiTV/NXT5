import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, createSession, ensureEmailVerificationColumns, hashPassword, isValidEmail, normalizeAccountName, normalizeEmail, safeUser } from './_lib/auth';
import { sendEmailVerificationEmail } from './_lib/email';
import { assertRateLimit } from './_lib/rate-limit';

function accountNameFromEmail(email) {
  const base = normalizeAccountName(email.split('@')[0]).replace(/[^a-z0-9._-]/g, '').slice(0, 18) || 'compte';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertRateLimit(request, 'auth-register', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const displayName = String(body.displayName || '').trim().replace(/\s+/g, ' ');
    const password = String(body.password || '');
    const remember = body.rememberMe !== false;

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

    const accountName = accountNameFromEmail(email);
    const passwordHash = await hashPassword(password);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await ensureEmailVerificationColumns();
    const users = await sql`
      insert into users (account_name, email, name, password_hash, email_verified, email_verify_token, email_verify_expires_at)
      values (${accountName}, ${email}, ${displayName}, ${passwordHash}, false, ${verifyToken}, ${verifyExpiresAt})
      returning id, account_name, email, coalesce(email_verified, false) as email_verified, name, created_at
    `;

    const user = users[0];
    await sendEmailVerificationEmail({ to: email, token: verifyToken });

    await sql`
      insert into audit_logs (user_id, action, entity_type, metadata)
      values (${user.id}, 'auth.register', 'user', ${JSON.stringify({ email, displayName })}::jsonb)
    `;

    await createSession({ userId: user.id, context, request, remember });
    return json({ user: safeUser(user) });
  } catch (err) {
    if (String(err.message || '').includes('idx_users_email_lower')) err.message = 'Cet e-mail est déjà utilisé.';
    else if (String(err.message || '').includes('duplicate key')) err.message = 'Ce compte existe déjà.';
    return handleError(err);
  }
}
