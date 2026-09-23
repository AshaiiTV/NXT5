import type { Context } from '@netlify/functions';
import { assertSessionSecret, readSessionCookie, sha256 } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, json, readJson } from './_lib/http';
import { assertRiotSchemaReady } from './_lib/migrations';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { createRiotAuthorizationUrl, requireRiotRsoConfig } from './_lib/riot-rso-protocol';
import { assertRiotOrigin, optionalRiotUser, randomRiotValue, readRiotCookie, riotError, riotFailure, setRiotCookie } from './_lib/riot-rso';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    const config = requireRiotRsoConfig();
    assertRiotOrigin(request, config, true);
    assertSessionSecret();
    await assertRiotSchemaReady();
    await assertRateLimit(request, 'auth-riot-start', { limit: 5, windowSeconds: 60 });
    const body = await readJson(request, 1024);
    if (!['login', 'link'].includes(body.flow)) throw riotError(400, 'RIOT_FLOW', 'Parcours Riot invalide.');
    const user = await optionalRiotUser(request, context);
    if (body.flow === 'link' && !user) throw riotError(401, 'RIOT_LOGIN_REQUIRED', 'Connecte-toi à NXT5 avant d’associer Riot.');
    if (body.flow === 'login' && user) throw riotError(409, 'RIOT_ALREADY_SIGNED_IN', 'Tu es déjà connecté. Associe Riot depuis les paramètres de ton compte.');
    if (user) await assertSubjectRateLimit('auth-riot-link', user.id, { limit: 5, windowSeconds: 60 });
    const state = randomRiotValue();
    const browser = randomRiotValue();
    const nonce = randomRiotValue();
    const codeVerifier = randomRiotValue();
    const authorizationUrl = await createRiotAuthorizationUrl(config, { state, nonce, codeVerifier });
    const oldBrowser = readRiotCookie(context);
    await sql`delete from riot_auth_flows where expires_at <= now() or browser_hash = ${sha256(oldBrowser)}`;
    const revision = user ? (await sql`select riot_link_revision from users where id = ${user.id}`)[0]?.riot_link_revision : null;
    if (user && revision == null) throw riotError(401, 'RIOT_ACCOUNT_CHANGED', 'La session NXT5 a changé. Recommence l’association.');
    await sql`
      insert into riot_auth_flows (state_hash, browser_hash, flow, user_id, session_hash, link_revision, nonce, code_verifier, remember, expires_at)
      values (${sha256(state)}, ${sha256(browser)}, ${body.flow}, ${user?.id || null},
        ${user ? sha256(readSessionCookie(context) || '') : null}, ${revision}, ${nonce}, ${codeVerifier}, ${body.rememberMe !== false}, now() + interval '5 minutes')
    `;
    setRiotCookie(context, browser);
    return json({ authorizationUrl });
  } catch (err) { return riotFailure(err); }
}
