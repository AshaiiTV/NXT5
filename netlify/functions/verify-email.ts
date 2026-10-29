import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { handleError } from './_lib/http';
import { ensureEmailVerificationColumns, readSessionCookie, sha256 } from './_lib/auth';

function redirectToVerified(params: Record<string, string>): Response {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || 'https://nxt5.org').replace(/\/+$/, '');
  const url = new URL('/verified', siteUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Response(null, { status: 302, headers: {
    Location: url.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY'
  } });
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (request.method !== 'GET') {
      return redirectToVerified({ error: 'invalid' });
    }

    const token = String(new URL(request.url).searchParams.get('token') || '').trim();
    if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) return redirectToVerified({ error: 'invalid' });
    const session = readSessionCookie(context);
    if (!session) return redirectToVerified({ error: 'signin' });
    const tokenHash = sha256(token);
    const sessionHash = sha256(session);
    await ensureEmailVerificationColumns();

    // Mailbox access alone must not activate credentials supplied by somebody
    // else during registration. Require the account's own login in this browser
    // as well, without consuming a link opened in another account or device.
    const accounts = await sql`
      select users.id, users.xmin::text as account_version,
        exists (
          select 1 from sessions where user_id = users.id and token_hash = ${sessionHash}
            and revoked_at is null and expires_at > clock_timestamp()
        ) as session_valid
      from users
      where email_verify_token = ${tokenHash} and email_verify_expires_at > clock_timestamp()
      limit 1
    `;
    const account = accounts[0];
    if (!account) return redirectToVerified({ error: 'invalid' });
    if (!account.session_valid) return redirectToVerified({ error: 'signin' });

    // Use the same account-version and lock order as credential changes. A
    // concurrent login cannot be missed by session revocation; a changed email
    // or a session revoked after the read cannot authorize this write.
    const rows = await sql`
      with verified_account as (
        with authorized_user as materialized (
          select id from users
          where id = ${account.id} and xmin = ${account.account_version}::xid
            and email_verify_token = ${tokenHash} and email_verify_expires_at > clock_timestamp()
          for update
        ), authorized_session as materialized (
          select sessions.user_id from sessions
          join authorized_user on authorized_user.id = sessions.user_id
          where token_hash = ${sessionHash} and revoked_at is null and expires_at > clock_timestamp()
          for update of sessions
        )
        update users
        set email_verified = true,
            email_verify_token = null,
            email_verify_expires_at = null,
            updated_at = now()
        where id in (select user_id from authorized_session)
          and xmin = ${account.account_version}::xid
          and email_verify_token = ${tokenHash} and email_verify_expires_at > clock_timestamp()
        returning id
      ), revoked_sessions as (
        update sessions set revoked_at = now()
        where user_id in (select id from verified_account)
          and token_hash <> ${sessionHash} and revoked_at is null
      )
      select id from verified_account
    `;
    if (!rows.length) return redirectToVerified({ error: 'invalid' });
    return redirectToVerified({ success: 'true' });
  } catch (err) {
    return handleError(err);
  }
}
