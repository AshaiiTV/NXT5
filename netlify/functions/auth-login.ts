import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, createSession, ensureEmailVerificationColumns, normalizeAccountName, normalizeEmail, safeUser, verifyLoginPassword } from './_lib/auth';
import { recordUserActivity } from './_lib/engagement';
import { assertRateLimit, assertSubjectRateLimit, releaseSubjectRateLimit } from './_lib/rate-limit';
import type { DbUser } from './_lib/types';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertRateLimit(request, 'auth-login', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request, 4096);
    const accountName = normalizeAccountName(body.accountName);
    const identifier = accountName.includes('@') ? normalizeEmail(body.accountName) : accountName;
    const password = String(body.password || '');
    // Long sessions are opt-in: an absent or malformed field keeps a browser session.
    const remember = body.rememberMe === true;

    if (!accountName || !password || accountName.length > 160) {
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
    // Both aliases share one account budget, independent of IP. Longer windows
    // impose a longer cooldown on sustained attacks without a permanent lock.
    // Each attempt is charged before the password check (concurrent guesses
    // cannot overrun the budget) and given back on success: only failures
    // count, so the owner's own sign-ins never lock the account.
    const subject = user ? `account:${user.id}` : `unknown:${identifier}`;
    const budgets = [
      ['auth-login-account', { limit: 8, windowSeconds: 300 }],
      ['auth-login-account-hour', { limit: 20, windowSeconds: 3600 }]
    ] as const;
    try {
      for (const [endpoint, options] of budgets) await assertSubjectRateLimit(endpoint, subject, options);
    } catch (err: any) {
      if (err?.status === 429) {
        err.code = 'ACCOUNT_LOGIN_RATE_LIMIT';
        err.message = 'Trop de tentatives sur ce compte. Réessaie plus tard, réinitialise ton mot de passe avec « Mot de passe oublié » ou utilise une connexion sociale (Google, Discord…) associée à ce compte.';
      }
      throw err;
    }
    const ok = await verifyLoginPassword(password, user?.password_hash);
    if (!user || !ok) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });
    for (const [endpoint] of budgets) await releaseSubjectRateLimit(endpoint, subject);

    const activeUser = await recordUserActivity(user);
    await createSession({ userId: user.id, context, request, remember, expectedPasswordHash: user.password_hash });
    return json({ user: safeUser(activeUser) });
  } catch (err) {
    return handleError(err);
  }
}
