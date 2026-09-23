import type { Context } from '@netlify/functions';
import { assertSessionSecret, createSession, readSessionCookie, sha256 } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod } from './_lib/http';
import { assertRiotSchemaReady } from './_lib/migrations';
import { assertRateLimit } from './_lib/rate-limit';
import { exchangeRiotAuthorizationCode, requireRiotRsoConfig } from './_lib/riot-rso-protocol';
import { assertRiotOrigin, consumeRiotFlow, linkRiotIdentity, optionalRiotUser, readRiotCookie, riotFailure, riotRedirect, setRiotCookie } from './_lib/riot-rso';

export default async function handler(request: Request, context: Context): Promise<Response> {
  let flow: 'login' | 'link' = 'login';
  let claimed = false;
  try {
    assertMethod(request, 'GET');
    const config = requireRiotRsoConfig();
    assertRiotOrigin(request, config);
    assertSessionSecret();
    if (new URL(request.url).pathname !== new URL(config.redirectUri).pathname) return riotRedirect(flow, 'failed');
    await assertRiotSchemaReady();
    await assertRateLimit(request, 'auth-riot-callback', { limit: 15, windowSeconds: 60 });
    const params = new URL(request.url).searchParams;
    const browser = readRiotCookie(context);
    setRiotCookie(context, '');
    if (params.getAll('state').length !== 1) return riotRedirect(flow, 'expired');
    const pending = await consumeRiotFlow(params.get('state') || '', browser);
    if (!pending) return riotRedirect(flow, 'expired');
    claimed = true;
    flow = pending.flow;
    if (params.getAll('iss').length > 1 || (params.has('iss') && params.get('iss') !== 'https://auth.riotgames.com')) return riotRedirect(flow, 'failed');
    // Browser binding alone is insufficient: link is bound to the exact NXT5
    // session, and login cannot switch a browser that signed in in another tab.
    const user = await optionalRiotUser(request, context);
    if ((flow === 'link' && (!user || user.id !== pending.user_id || sha256(readSessionCookie(context) || '') !== pending.session_hash)) || (flow === 'login' && user)) {
      return riotRedirect(flow, 'account_changed');
    }
    if (params.has('error')) return riotRedirect(flow, params.get('error') === 'access_denied' ? 'cancelled' : 'failed');
    const code = params.get('code') || '';
    if (params.getAll('code').length !== 1 || !code || code.length > 4096) return riotRedirect(flow, 'failed');
    const identity = await exchangeRiotAuthorizationCode(config, { code, nonce: pending.nonce, codeVerifier: pending.code_verifier });
    if (flow === 'link') {
      if (!await linkRiotIdentity(pending, identity)) {
        const existing = (await sql`select puuid from riot_identities where user_id = ${pending.user_id}`)[0];
        return riotRedirect(flow, existing && existing.puuid !== identity.puuid ? 'account_already_linked' : 'account_changed');
      }
      return riotRedirect(flow, 'linked');
    }
    const match = (await sql`
      select users.id, users.riot_link_revision from riot_identities
      join users on users.id = riot_identities.user_id where puuid = ${identity.puuid}
    `)[0];
    if (!match) return riotRedirect(flow, 'not_linked');
    await createSession({ userId: match.id, request, context, remember: pending.remember,
      riotIdentity: { puuid: identity.puuid, revision: match.riot_link_revision } });
    return riotRedirect(flow, 'success');
  } catch (err: any) {
    // Never serialize provider messages, tokens, SQL errors or callback URLs.
    if (!claimed) return riotFailure(err);
    return riotRedirect(flow, err?.code === '23505' ? 'conflict' : err?.code === 'RIOT_ACCOUNT_CHANGED' || err?.status === 401 ? 'account_changed' : 'failed');
  }
}
