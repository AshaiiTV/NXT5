import type { Context } from '@netlify/functions';
import { assertSessionSecret } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, json } from './_lib/http';
import { assertRiotSchemaReady } from './_lib/migrations';
import { getRiotRsoConfig } from './_lib/riot-rso-protocol';
import { assertRiotOrigin, localRiotOrigin, optionalRiotUser, riotFailure } from './_lib/riot-rso';
import { readSessionCookie } from './_lib/auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    const config = getRiotRsoConfig();
    if (!config && !readSessionCookie(context)) return json({ enabled: false, linked: false });
    assertRiotOrigin(request, localRiotOrigin());
    assertSessionSecret();
    await assertRiotSchemaReady();
    const user = await optionalRiotUser(request, context);
    const identity = user ? (await sql`select game_name, tag_line, linked_at from riot_identities where user_id = ${user.id}`)[0] : null;
    return json({ enabled: Boolean(config), linked: Boolean(identity), ...(identity ? { identity: { gameName: identity.game_name, tagLine: identity.tag_line, linkedAt: identity.linked_at } } : {}) });
  } catch (err) { return riotFailure(err); }
}
