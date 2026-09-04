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

    const rows = await sql`
      select id, email_verify_expires_at
      from users
      where email_verify_token in (${tokenHash}, ${token})
      limit 1
    `;
    const user = rows[0];
    if (!user) return redirectToVerified({ error: 'invalid' });
    if (new Date(user.email_verify_expires_at).getTime() < Date.now()) {
      return redirectToVerified({ error: 'expired' });
    }

    await sql`
      update users
      set email_verified = true,
          email_verify_token = null,
          email_verify_expires_at = null,
          updated_at = now()
      where id = ${user.id}
    `;

    return redirectToVerified({ success: 'true' });
  } catch (err) {
    return handleError(err);
  }
}
