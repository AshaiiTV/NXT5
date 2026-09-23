import { createHash, createPrivateKey, timingSafeEqual, type KeyObject } from 'node:crypto';
import { createLocalJWKSet, jwtVerify, SignJWT } from 'jose';
import { createRiotAuthorizationUrl, exchangeRiotAuthorizationCode, getRiotRsoConfig, type RiotRsoConfig } from './riot-rso-protocol';

export const SOCIAL_PROVIDERS = ['google', 'discord', 'apple', 'riot'] as const;
export type SocialProvider = typeof SOCIAL_PROVIDERS[number];

type BaseConfig = { siteOrigin: string; redirectUri: string; clientId: string };
export type SocialConfig = BaseConfig & (
  { provider: 'google' | 'discord'; clientSecret: string }
  | { provider: 'apple'; teamId: string; keyId: string; privateKey: KeyObject }
  | { provider: 'riot'; riot: RiotRsoConfig }
);
export type VerifiedSocialIdentity = {
  provider: SocialProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

const CALLBACK_PATH = '/.netlify/functions/auth-social-callback';
const PROVIDERS = {
  google: {
    issuer: 'https://accounts.google.com',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    keys: 'https://www.googleapis.com/oauth2/v3/certs',
    scopes: 'openid email',
  },
  apple: {
    issuer: 'https://appleid.apple.com',
    authorize: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    keys: 'https://appleid.apple.com/auth/keys',
    scopes: 'email',
  },
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/v10/oauth2/token',
    profile: 'https://discord.com/api/v10/users/@me',
    scopes: 'identify email',
  },
} as const;

export function providerLabel(provider: SocialProvider): string {
  return { google: 'Google', discord: 'Discord', apple: 'Apple', riot: 'Riot Games' }[provider];
}

function unavailable() {
  return Object.assign(new Error('Cette méthode de connexion n’est pas disponible actuellement.'), { status: 503, code: 'SOCIAL_AUTH_UNAVAILABLE' });
}

function protocolError() {
  // Provider response bodies, codes, tokens and private keys must never escape.
  return Object.assign(new Error('L’authentification n’a pas pu être vérifiée. Réessaie.'), { status: 502, code: 'SOCIAL_AUTH_VALIDATION_FAILED' });
}

function validIdentifier(value: string): boolean {
  return Boolean(value) && value.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(value);
}

function getSocialConfig(provider: SocialProvider): SocialConfig | null {
  try {
    if (!(SOCIAL_PROVIDERS as readonly string[]).includes(provider)) return null;
    const siteOrigin = process.env.SOCIAL_AUTH_SITE_ORIGIN || 'https://nxt5.org';
    const origin = new URL(siteOrigin);
    if (origin.protocol !== 'https:' || origin.origin !== siteOrigin || origin.username || origin.password) return null;
    const redirectUri = `${siteOrigin}${CALLBACK_PATH}`;
    if (provider === 'riot') {
      const riot = getRiotRsoConfig();
      if (!riot || riot.siteOrigin !== siteOrigin) return null;
      // Preserve the exact URI submitted to Riot, including the original RSO
      // callback, so an existing approval request does not need to change.
      return { provider, siteOrigin, redirectUri: riot.redirectUri, clientId: riot.clientId, riot };
    }
    const prefix = `${provider.toUpperCase()}_AUTH_`;
    if (process.env[`${prefix}ENABLED`] !== 'true') return null;
    const clientId = process.env[`${prefix}CLIENT_ID`] || '';
    if (!validIdentifier(clientId)) return null;
    if (provider === 'apple') {
      const teamId = process.env.APPLE_AUTH_TEAM_ID || '';
      const keyId = process.env.APPLE_AUTH_KEY_ID || '';
      if (!/^[A-Z0-9]{10}$/.test(teamId) || !/^[A-Z0-9]{10}$/.test(keyId)) return null;
      const pem = (process.env.APPLE_AUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      if (!pem || pem.length > 16_384) return null;
      const privateKey = createPrivateKey(pem);
      if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ec'
        || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return null;
      return { provider, siteOrigin, redirectUri, clientId, teamId, keyId, privateKey };
    }
    const clientSecret = process.env[`${prefix}CLIENT_SECRET`] || '';
    if (!clientSecret || clientSecret.length > 4096 || /[\u0000-\u001f\u007f]/.test(clientSecret)) return null;
    return { provider, siteOrigin, redirectUri, clientId, clientSecret };
  } catch { return null; }
}

export function socialProviderEnabled(provider: SocialProvider): boolean {
  return getSocialConfig(provider) !== null;
}

export function requireSocialConfig(provider: SocialProvider): SocialConfig {
  const config = getSocialConfig(provider);
  if (!config) throw unavailable();
  return config;
}

function assertVerifier(nonce: string, codeVerifier: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce) || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) throw protocolError();
}

export async function createSocialAuthorizationUrl(
  config: SocialConfig,
  { state, nonce, codeVerifier }: { state: string; nonce: string; codeVerifier: string },
): Promise<string> {
  assertVerifier(nonce, codeVerifier);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(state)) throw protocolError();
  if (config.provider === 'riot') return createRiotAuthorizationUrl(config.riot, { state, nonce, codeVerifier });
  const provider = PROVIDERS[config.provider];
  const url = new URL(provider.authorize);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: provider.scopes, state,
  }).toString();
  if (config.provider !== 'discord') url.searchParams.set('nonce', nonce);
  if (config.provider === 'apple') url.searchParams.set('response_mode', 'form_post');
  if (config.provider === 'google') {
    url.searchParams.set('code_challenge', createHash('sha256').update(codeVerifier).digest('base64url'));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  // Apple discovery and Discord's confidential-client code flow do not
  // advertise PKCE. Do not send unsupported parameters as a security claim.
  return url.toString();
}

async function requestJson(url: string, options: RequestInit = {}): Promise<Record<string, any>> {
  try {
    const response = await fetch(url, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json', ...options.headers },
    });
    if (!response.ok || !response.body) throw protocolError();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 131_072) {
        await reader.cancel();
        throw protocolError();
      }
      chunks.push(value);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw protocolError();
    return payload;
  } catch { throw protocolError(); }
}

function sameText(first: string, second: string): boolean {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}

function optionalText(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw protocolError();
  return value;
}

function optionalEmail(value: unknown): string | null {
  const email = optionalText(value, 254);
  if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw protocolError();
  return email;
}

function emailVerification(value: unknown, provider: 'google' | 'apple' | 'discord'): boolean {
  if (value === true || value === false) return value;
  if (provider === 'apple' && (value === 'true' || value === 'false')) return value === 'true';
  if (value === undefined || value === null) return false;
  throw protocolError();
}

/** Only verified identity fields leave this function. Provider tokens are ephemeral. */
export async function exchangeSocialAuthorizationCode(
  config: SocialConfig,
  { code, nonce, codeVerifier }: { code: string; nonce: string; codeVerifier: string },
): Promise<VerifiedSocialIdentity> {
  assertVerifier(nonce, codeVerifier);
  if (!code || code.length > 4096 || /[\s\u0000-\u001f\u007f]/.test(code)) throw protocolError();
  if (config.provider === 'riot') {
    const identity = await exchangeRiotAuthorizationCode(config.riot, { code, nonce, codeVerifier });
    return { provider: 'riot', subject: identity.puuid, name: identity.gameName, email: null, emailVerified: false };
  }
  const provider = PROVIDERS[config.provider];
  const form = new URLSearchParams({
    grant_type: 'authorization_code', code, client_id: config.clientId, redirect_uri: config.redirectUri,
  });
  if (config.provider === 'apple') {
    const now = Math.floor(Date.now() / 1000);
    const secret = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
      .setIssuer(config.teamId).setSubject(config.clientId).setAudience(PROVIDERS.apple.issuer)
      .setIssuedAt(now).setExpirationTime(now + 300).sign(config.privateKey);
    form.set('client_secret', secret);
  } else form.set('client_secret', config.clientSecret);
  if (config.provider === 'google') form.set('code_verifier', codeVerifier);
  const tokens = await requestJson(provider.token, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(),
  });
  if (typeof tokens.access_token !== 'string' || !tokens.access_token || tokens.access_token.length > 32768
    || /[\s\u0000-\u001f\u007f]/.test(tokens.access_token)
    || typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer') throw protocolError();

  if (config.provider === 'discord') {
    // The authenticated stable snowflake is the identity; usernames and email
    // addresses can change and must never serve as the account key.
    if (typeof tokens.scope !== 'string' || !tokens.scope.split(' ').includes('identify')) throw protocolError();
    const profile = await requestJson(PROVIDERS.discord.profile, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (typeof profile.id !== 'string' || !/^[0-9]{17,20}$/.test(profile.id) || profile.bot === true) throw protocolError();
    const email = optionalEmail(profile.email);
    const verified = emailVerification(profile.verified, 'discord');
    return {
      provider: 'discord', subject: profile.id, email, emailVerified: email !== null && verified,
      name: optionalText(profile.global_name, 128) || optionalText(profile.username, 128),
    };
  }

  if (typeof tokens.id_token !== 'string' || !tokens.id_token || tokens.id_token.length > 32768) throw protocolError();
  const oidc = PROVIDERS[config.provider];
  const keys = await requestJson(oidc.keys);
  if (!Array.isArray(keys.keys) || keys.keys.length < 1 || keys.keys.length > 32) throw protocolError();
  try {
    const { payload } = await jwtVerify(tokens.id_token, createLocalJWKSet({ keys: keys.keys }), {
      issuer: config.provider === 'google' ? [oidc.issuer, 'accounts.google.com'] : oidc.issuer,
      audience: config.clientId, algorithms: ['RS256'],
      requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'], clockTolerance: 30, maxTokenAge: '10 minutes',
    });
    if (typeof payload.sub !== 'string' || !validIdentifier(payload.sub)
      || typeof payload.nonce !== 'string' || !sameText(payload.nonce, nonce)
      || (payload.azp !== undefined && payload.azp !== config.clientId)
      || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) throw protocolError();
    if (payload.at_hash !== undefined) {
      const expected = createHash('sha256').update(tokens.access_token).digest().subarray(0, 16).toString('base64url');
      if (typeof payload.at_hash !== 'string' || !sameText(payload.at_hash, expected)) throw protocolError();
    }
    const email = optionalEmail(payload.email);
    const verified = emailVerification(payload.email_verified, config.provider);
    return {
      provider: config.provider, subject: payload.sub, email, emailVerified: email !== null && verified,
      // Apple returns the name separately as unsigned first-login form data.
      // The account onboarding asks for a display name instead of trusting it.
      name: config.provider === 'google' ? optionalText(payload.name, 128) : null,
    };
  } catch { throw protocolError(); }
}
