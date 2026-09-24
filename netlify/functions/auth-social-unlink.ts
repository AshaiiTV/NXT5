import type { Context } from '@netlify/functions';
import { assertSessionSecret, readSessionCookie, requireAuth, sha256, verifyPassword } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, json, readJson } from './_lib/http';
import { assertSocialSchemaReady } from './_lib/migrations';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { assertSocialOrigin, parseSocialProvider, socialError, socialFailure } from './_lib/social-auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertSocialOrigin(request, true);
    assertSessionSecret();
    await assertSocialSchemaReady();
    await assertRateLimit(request, 'auth-social-unlink');
    const user = await requireAuth(request, context);
    await assertSubjectRateLimit('auth-social-unlink', user.id, { limit: 5, windowSeconds: 60 });
    const body = await readJson(request, 2048);
    const provider = parseSocialProvider(body.provider);
    const current = (await sql`select password_hash from users where id = ${user.id}`)[0];
    if (!current?.password_hash) throw socialError(409, 'SOCIAL_PASSWORD_REQUIRED', 'Définis d’abord un mot de passe NXT5 pour conserver un accès à ton compte.');
    const password = String(body.currentPassword || '');
    if (!password || password.length > 128 || !await verifyPassword(password, current.password_hash)) throw socialError(401, 'SOCIAL_PASSWORD_INVALID', 'Mot de passe actuel incorrect.');
    const result = await sql`select unlink_social_identity(${user.id}::uuid, ${provider}, ${current.password_hash}, ${sha256(readSessionCookie(context) || '')}) as removed`;
    if (!result[0]?.removed) throw socialError(409, 'SOCIAL_ACCOUNT_CHANGED', 'Ton compte a changé. Reconnecte-toi avant de réessayer.');
    return json({ ok: true });
  } catch (err) { return socialFailure(err); }
}
