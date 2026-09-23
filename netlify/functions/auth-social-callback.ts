import type { Context } from '@netlify/functions';
import { assertSessionSecret } from './_lib/auth';
import { assertSocialSchemaReady } from './_lib/migrations';
import { assertRateLimit } from './_lib/rate-limit';
import { exchangeSocialAuthorizationCode, requireSocialConfig, type SocialProvider } from './_lib/social-auth-protocol';
import { assertSocialOrigin, consumeSocialFlow, issueSocialTicket, setSocialCookie, socialCookie, socialNotice, socialRedirect, SOCIAL_BROWSER_COOKIE, SOCIAL_TICKET_COOKIE } from './_lib/social-auth';

async function callbackParams(request: Request): Promise<URLSearchParams> {
  if (request.method === 'GET') return new URL(request.url).searchParams;
  if (request.method !== 'POST' || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') throw new Error('Invalid callback method');
  if (Number(request.headers.get('content-length') || 0) > 16384 || !request.body) throw new Error('Invalid callback size');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new Error('Invalid callback size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  let flow = 'login'; let provider: SocialProvider | undefined;
  try {
    // Apple posts from its own origin; validate state + the browser cookie here,
    // then inspect the NXT5 session only after a first-party redirect.
    assertSocialOrigin(request);
    if (!['/.netlify/functions/auth-social-callback', '/.netlify/functions/auth-riot-callback'].includes(new URL(request.url).pathname)) return socialNotice(flow, 'failed');
    assertSessionSecret();
    await assertSocialSchemaReady();
    await assertRateLimit(request, 'auth-social-callback', { limit: 20, windowSeconds: 60 });
    const params = await callbackParams(request);
    if (params.getAll('state').length !== 1) return socialNotice(flow, 'expired');
    const browser = socialCookie(context, SOCIAL_BROWSER_COOKIE);
    const pending = await consumeSocialFlow(params.get('state') || '', browser);
    if (!pending) return socialNotice(flow, 'expired');
    flow = pending.flow; provider = pending.provider;
    if ((provider === 'apple') !== (request.method === 'POST')) return socialNotice(flow, 'failed', provider);
    const config = requireSocialConfig(provider);
    if (new URL(request.url).pathname !== new URL(config.redirectUri).pathname) return socialNotice(flow, 'failed', provider);
    if (params.has('iss')) {
      const issuer = { riot: 'https://auth.riotgames.com', google: 'https://accounts.google.com', apple: 'https://appleid.apple.com', discord: null }[provider];
      if (params.getAll('iss').length !== 1 || params.get('iss') !== issuer) return socialNotice(flow, 'failed', provider);
    }
    if (params.has('error')) return socialNotice(flow, params.get('error') === 'access_denied' ? 'cancelled' : 'failed', provider);
    const code = params.get('code') || '';
    if (params.getAll('code').length !== 1 || !code || code.length > 4096) return socialNotice(flow, 'failed', provider);
    const identity = await exchangeSocialAuthorizationCode(config, { code, nonce: pending.nonce, codeVerifier: pending.code_verifier });
    if (identity.provider !== provider) return socialNotice(flow, 'failed', provider);
    const ticket = await issueSocialTicket(pending, identity, browser, 'callback');
    setSocialCookie(context, SOCIAL_TICKET_COOKIE, ticket);
    setSocialCookie(context, SOCIAL_BROWSER_COOKIE, browser);
    return socialRedirect('/.netlify/functions/auth-social-finish');
  } catch { return socialNotice(flow, 'failed', provider); }
}
