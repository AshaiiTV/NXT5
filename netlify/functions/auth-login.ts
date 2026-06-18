import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, createSession, ensureEmailVerificationColumns, normalizeAccountName, normalizeEmail, safeUser, verifyPassword } from './_lib/auth';
import { assertRateLimit } from './_lib/rate-limit';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await ensureEmailVerificationColumns();
    await assertRateLimit(request, 'auth-login', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request);
    const accountName = normalizeAccountName(body.accountName);
    const identifier = accountName.includes('@') ? normalizeEmail(body.accountName) : accountName;
    const password = String(body.password || '');
    const remember = body.rememberMe !== false;

    const rows = accountName.includes('@')
      ? await sql`select * from users where lower(email) = ${identifier} limit 1`
      : await sql`select * from users where account_name = ${identifier} limit 1`;
    const user = rows[0];
    if (!user) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });

    await createSession({ userId: user.id, context, request, remember });
    return json({ user: safeUser(user) });
  } catch (err) {
    return handleError(err);
  }
}
