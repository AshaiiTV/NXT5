import { sql } from './_lib/db';
import { handleError } from './_lib/http';
import { ensureEmailVerificationColumns, sha256 } from './_lib/auth';

function redirectToVerified(params: Record<string, string>): Response {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || 'https://nxt5.org').replace(/\/+$/, '');
  const url = new URL('/verified', siteUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== 'GET') {
      return redirectToVerified({ error: 'invalid' });
    }

    const token = String(new URL(request.url).searchParams.get('token') || '').trim();
    if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) return redirectToVerified({ error: 'invalid' });
    const tokenHash = sha256(token);
    await ensureEmailVerificationColumns();

    // The token still has to belong to the current address when the row is
    // updated. A concurrent address change replaces it and prevents validation.
    const rows = await sql`
      update users
      set email_verified = true,
          email_verify_token = null,
          email_verify_expires_at = null,
          updated_at = now()
      where email_verify_token in (${tokenHash}, ${token})
        and email_verify_expires_at > now()
      returning id
    `;
    if (!rows.length) return redirectToVerified({ error: 'invalid' });
    return redirectToVerified({ success: 'true' });
  } catch (err) {
    return handleError(err);
  }
}
