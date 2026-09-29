import type { Context } from '@netlify/functions';
import { sha256 } from './auth';
import { sql } from './db';
import { sendSocialSignupEmail } from './email';
import { json } from './http';
import { randomSocialValue, socialCookie, socialError, socialOrigin, SOCIAL_BROWSER_COOKIE, SOCIAL_TICKET_COOKIE } from './social-auth';

export async function requestSocialSignupEmail(context: Context, email: string, displayName: string, legalVersion: string) {
  const token = randomSocialValue();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  // Both branches reserve the same data and retain the same cookies. Only the
  // mailbox owner sees which instructions apply. Retries replace the old link.
  const rows = await sql`
    with ticket as (
      update social_auth_tickets set expires_at=${expires}::timestamptz
      where token_hash=${sha256(socialCookie(context, SOCIAL_TICKET_COOKIE))}
        and browser_hash=${sha256(socialCookie(context, SOCIAL_BROWSER_COOKIE))}
        and purpose='signup' and expires_at>clock_timestamp() returning token_hash
    )
    insert into social_signup_emails(ticket_hash, token_hash, email, display_name, legal_version, expires_at)
    select token_hash, ${sha256(token)}, ${email}, ${displayName}, ${legalVersion}, ${expires}::timestamptz from ticket
    on conflict(ticket_hash) do update set token_hash=excluded.token_hash, email=excluded.email,
      display_name=excluded.display_name, legal_version=excluded.legal_version, expires_at=excluded.expires_at
    returning ticket_hash
  `;
  if (!rows.length) throw socialError(400, 'SOCIAL_EXPIRED', 'Cette inscription a expiré. Recommence la connexion.');
  const exists = (await sql`select id from users where lower(email)=${email} limit 1`).length > 0;
  try {
    await sendSocialSignupEmail({ to: email, signupUrl: exists ? null : `${socialOrigin()}/inscription?social=complete#email_token=${token}` });
  } catch { /* Same acknowledgement even if delivery fails, for both branches. */ }
  for (const name of [SOCIAL_TICKET_COOKIE, SOCIAL_BROWSER_COOKIE]) {
    context.cookies.set({ name, value: socialCookie(context, name), httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 900 });
  }
  return json({ ok: true, emailVerificationRequired: true, message: 'Vérifie ta boîte e-mail pour poursuivre. Si aucun message n’arrive, recommence la connexion.' }, 202);
}
