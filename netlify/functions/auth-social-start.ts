import type { Context } from '@netlify/functions';
import { assertSessionSecret, readSessionCookie, sha256 } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, json, readJson } from './_lib/http';
import { assertSocialSchemaReady } from './_lib/migrations';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { createSocialAuthorizationUrl, requireSocialConfig } from './_lib/social-auth-protocol';
import { assertSocialOrigin, optionalSocialUser, parseSocialProvider, randomSocialValue, setSocialCookie, socialCookie, socialDestination, socialError, socialFailure, SOCIAL_BROWSER_COOKIE, SOCIAL_TICKET_COOKIE } from './_lib/social-auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertSocialOrigin(request, true);
    assertSessionSecret();
    await assertSocialSchemaReady();
    await assertRateLimit(request, 'auth-social-start', { limit: 8, windowSeconds: 60 });
    const body = await readJson(request, 4096);
    const provider = parseSocialProvider(body.provider);
    const config = requireSocialConfig(provider);
    if (!['login', 'register', 'link'].includes(body.flow)) throw socialError(400, 'SOCIAL_FLOW', 'Parcours de connexion invalide.');
    const user = await optionalSocialUser(request, context);
    if (body.flow === 'link' && !user) throw socialError(401, 'SOCIAL_LOGIN_REQUIRED', 'Connecte-toi avant d’associer un compte.');
    if (body.flow !== 'link' && user) throw socialError(409, 'SOCIAL_ALREADY_SIGNED_IN', 'Tu es déjà connecté. Associe ce compte depuis tes paramètres.');
    if (user) await assertSubjectRateLimit('auth-social-link', user.id, { limit: 5, windowSeconds: 60 });
    const state = randomSocialValue(), browser = randomSocialValue(), nonce = randomSocialValue(), codeVerifier = randomSocialValue();
    const authorizationUrl = await createSocialAuthorizationUrl(config, { state, nonce, codeVerifier });
    const oldBrowser = sha256(socialCookie(context, SOCIAL_BROWSER_COOKIE));
    await sql`delete from social_auth_flows where expires_at <= now() or browser_hash = ${oldBrowser}`;
    await sql`delete from social_auth_tickets where expires_at <= now() or browser_hash = ${oldBrowser}`;
    const revision = user ? (await sql`select social_link_revision from users where id = ${user.id}`)[0]?.social_link_revision : null;
    if (user && revision == null) throw socialError(401, 'SOCIAL_ACCOUNT_CHANGED', 'Ta session a changé. Recommence.');
    await sql`insert into social_auth_flows (state_hash, browser_hash, provider, flow, user_id, session_hash, link_revision, nonce, code_verifier, remember, destination)
      values (${sha256(state)}, ${sha256(browser)}, ${provider}, ${body.flow}, ${user?.id || null},
        ${user ? sha256(readSessionCookie(context) || '') : null}, ${revision}, ${nonce}, ${codeVerifier}, ${body.rememberMe !== false},
        ${socialDestination(body.next, body.invite, body.flow === 'register')})`;
    setSocialCookie(context, SOCIAL_BROWSER_COOKIE, browser, provider === 'apple');
    setSocialCookie(context, SOCIAL_TICKET_COOKIE, '');
    return json({ authorizationUrl });
  } catch (err) { return socialFailure(err); }
}
