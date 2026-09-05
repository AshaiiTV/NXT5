import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, createSession, ensureEmailVerificationColumns, normalizeAccountName, normalizeEmail, safeUser, verifyPassword } from './_lib/auth';
import { recordUserActivity } from './_lib/engagement';
import { assertRateLimit } from './_lib/rate-limit';
import type { DbUser } from './_lib/types';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertRateLimit(request, 'auth-login', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request);
    const accountName = normalizeAccountName(body.accountName);
    const identifier = accountName.includes('@') ? normalizeEmail(body.accountName) : accountName;
    const password = String(body.password || '');
    const remember = body.rememberMe !== false;

    if (!accountName || !password) {
      throw Object.assign(new Error('Identifiants requis.'), { status: 400 });
    }
    if (password.length > 128) {
      throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });
    }

    await ensureEmailVerificationColumns();
    const rows = accountName.includes('@')
      ? await sql`select * from users where lower(email) = ${identifier} limit 1`
      : await sql`select * from users where account_name = ${identifier} limit 1`;
    const user = rows[0] as (DbUser & { password_hash: string }) | undefined;
    if (!user) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });

    const activeUser = await recordUserActivity(user);
    await createSession({ userId: user.id, context, request, remember });
    return json({ user: safeUser(activeUser) });
  } catch (err) {
    return handleError(err);
  }
}
