import type { Context } from '@netlify/functions';
import { assertSessionSecret, readSessionCookie, requireAuth, sha256, verifyPassword } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, json, readJson } from './_lib/http';
import { assertRiotSchemaReady } from './_lib/migrations';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { assertRiotOrigin, localRiotOrigin, riotError, riotFailure, setRiotCookie } from './_lib/riot-rso';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    // Local password reauthentication permits removal even during a Riot outage
    // or after disabling RSO. No provider call or credential is needed.
    assertRiotOrigin(request, localRiotOrigin(), true);
    assertSessionSecret();
    await assertRiotSchemaReady();
    await assertRateLimit(request, 'auth-riot-unlink', { limit: 5, windowSeconds: 60 });
    const user = await requireAuth(request, context);
    await assertSubjectRateLimit('auth-riot-unlink', user.id, { limit: 5, windowSeconds: 60 });
    const body = await readJson(request, 1024);
    const password = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const account = (await sql`select password_hash, account_name from users where id = ${user.id}`)[0];
    if (!password || password.length > 128 || !account?.account_name || !account.password_hash || !await verifyPassword(password, account.password_hash)) {
      throw riotError(401, 'RIOT_REAUTH_REQUIRED', 'Confirme ton mot de passe NXT5 actuel pour dissocier Riot.');
    }
    const rows = await sql`select unlink_riot_identity(${user.id}::uuid, ${account.password_hash}, ${sha256(readSessionCookie(context) || '')}) as unlinked`;
    if (!rows[0]?.unlinked) throw riotError(409, 'RIOT_ACCOUNT_CHANGED', 'Le compte ou la session a changé. Recommence depuis les paramètres.');
    setRiotCookie(context, '');
    return json({ ok: true });
  } catch (err) { return riotFailure(err); }
}
