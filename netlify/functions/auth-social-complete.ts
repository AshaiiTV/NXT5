import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { assertSessionSecret, createSession, isValidEmail, normalizeEmail, safeUser, sha256 } from './_lib/auth';
import { sql } from './_lib/db';
import { sendEmailVerificationEmail } from './_lib/email';
import { assertMethod, json, readJson } from './_lib/http';
import { assertSocialSchemaReady } from './_lib/migrations';
import { assertRateLimit, assertVerificationEmailRateLimit } from './_lib/rate-limit';
import { socialProviderEnabled } from './_lib/social-auth-protocol';
import { assertSocialOrigin, LEGAL_VERSION, optionalSocialUser, setSocialCookie, socialCookie, socialError, socialFailure, socialTicket, SOCIAL_BROWSER_COOKIE, SOCIAL_TICKET_COOKIE } from './_lib/social-auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertSocialOrigin(request, true);
    assertSessionSecret();
    await assertSocialSchemaReady();
    await assertRateLimit(request, 'auth-social-complete', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request, 4096);
    if (await optionalSocialUser(request, context)) throw socialError(409, 'SOCIAL_ACCOUNT_CHANGED', 'Tu es déjà connecté.');
    const pending = await socialTicket(context, 'signup');
    if (!pending || !socialProviderEnabled(pending.provider)) throw socialError(400, 'SOCIAL_EXPIRED', 'Cette inscription a expiré. Recommence la connexion.');
    const displayName = String(body.displayName || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(body.email);
    if (displayName.length < 3 || displayName.length > 32) throw socialError(400, 'SOCIAL_NAME', 'Le pseudo doit faire entre 3 et 32 caractères.');
    if (!isValidEmail(email) || email.length > 160) throw socialError(400, 'SOCIAL_EMAIL', 'Adresse e-mail invalide.');
    if (body.acceptLegal !== true || body.legalVersion !== LEGAL_VERSION) throw socialError(400, 'LEGAL_ACCEPTANCE_REQUIRED', 'Accepte les CGU et le règlement en vigueur et reconnais avoir lu la politique de confidentialité.');
    if ((await sql`select id from users where lower(email) = ${email} limit 1`).length) throw socialError(409, 'SOCIAL_EMAIL_EXISTS', 'Un compte utilise déjà cette adresse. Connecte-toi à ce compte puis associe cette méthode dans Paramètres.');
    const userId = crypto.randomUUID();
    const verified = pending.email_verified && normalizeEmail(pending.email) === email;
    if (!verified) await assertVerificationEmailRateLimit(userId, email);
    const verificationToken = crypto.randomBytes(32).toString('base64url');
    const result = await sql`select complete_social_signup(
      ${sha256(socialCookie(context, SOCIAL_TICKET_COOKIE))}, ${sha256(socialCookie(context, SOCIAL_BROWSER_COOKIE))},
      ${userId}::uuid, ${email}, ${displayName}, ${LEGAL_VERSION}, ${sha256(verificationToken)},
      ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}::timestamptz
    ) as account`;
    const user = result[0]?.account;
    if (!user) throw socialError(400, 'SOCIAL_EXPIRED', 'Cette inscription a expiré. Recommence la connexion.');
    // A delivery failure must not turn a committed signup into a duplicate
    // retry. The signed-in account can request a new verification email.
    let verificationEmailSent = verified;
    if (!verified) {
      try { await sendEmailVerificationEmail({ to: email, token: verificationToken }); verificationEmailSent = true; }
      catch { verificationEmailSent = false; }
    }
    await createSession({ userId: user.id, context, request, remember: pending.remember,
      socialIdentity: { provider: pending.provider, subject: pending.subject, revision: user.social_link_revision } });
    setSocialCookie(context, SOCIAL_TICKET_COOKIE, '');
    setSocialCookie(context, SOCIAL_BROWSER_COOKIE, '');
    return json({ user: safeUser(user), destination: pending.destination, verificationEmailSent });
  } catch (err: any) {
    if (err?.code === '23505') {
      const emailConflict = err.constraint === 'idx_users_email_lower';
      return socialFailure(socialError(409, emailConflict ? 'SOCIAL_EMAIL_EXISTS' : 'SOCIAL_CONFLICT', emailConflict
        ? 'Un compte utilise déjà cette adresse. Connecte-toi à ce compte puis associe cette méthode dans Paramètres.'
        : 'Ce compte externe est déjà associé. Recommence la connexion pour retrouver ton compte.'));
    }
    if (err?.code === 'P0001' && err.message === 'SOCIAL_EXPIRED') return socialFailure(socialError(400, 'SOCIAL_EXPIRED', 'Cette inscription a expiré. Recommence.'));
    if (err?.code === 'P0001' && err.message === 'SOCIAL_EMAIL_EXISTS') return socialFailure(socialError(409, 'SOCIAL_EMAIL_EXISTS', 'Un compte utilise déjà cette adresse. Connecte-toi puis associe cette méthode dans Paramètres.'));
    return socialFailure(err);
  }
}
