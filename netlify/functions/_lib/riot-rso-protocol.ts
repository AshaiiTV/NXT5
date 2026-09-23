import { createHash, createPrivateKey, randomBytes, timingSafeEqual, type KeyObject } from 'node:crypto';
import { createLocalJWKSet, jwtVerify, SignJWT } from 'jose';
import { riotRsoEnv } from './riot-rso-env';

const ISSUER = 'https://auth.riotgames.com';
const AUTHORIZE_URL = `${ISSUER}/authorize`;
const TOKEN_URL = `${ISSUER}/token`;
const JWKS_URL = `${ISSUER}/jwks.json`;
const CALLBACK_PATH = '/.netlify/functions/auth-riot-callback';
const POST_LOGOUT_PATH = '/connexion';
const SIGNING_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
const NETWORK_TIMEOUT_MS = 10_000;

export type RiotRsoConfig = {
  siteOrigin: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  clientId: string;
  accountRegion: 'europe' | 'americas' | 'asia';
  auth: { method: 'client_secret_basic'; secret: string }
    | { method: 'private_key_jwt'; privateKey: KeyObject; keyId: string; assertionAudience: string };
};

export type VerifiedRiotIdentity = {
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
};

function unavailable() {
  return Object.assign(new Error('La connexion Riot n’est pas disponible actuellement.'), { status: 503, code: 'RIOT_RSO_UNAVAILABLE' });
}

function protocolError(code = 'RIOT_RSO_VALIDATION_FAILED') {
  // Never expose provider response bodies, JWTs, codes, keys or nested errors.
  return Object.assign(new Error('L’authentification Riot n’a pas pu être vérifiée. Réessaie.'), { status: 502, code });
}

function exactHttpsUrl(value: string, origin: string, path: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.origin === origin && url.pathname === path && url.href === value;
  } catch { return false; }
}

/** Configuration is server-only. A production API key is not RSO approval. */
export function getRiotRsoConfig(): RiotRsoConfig | null {
  if (riotRsoEnv('RIOT_RSO_ENABLED') !== 'true' || riotRsoEnv('RIOT_RSO_APPROVAL_CONFIRMED') !== 'true') return null;
  try {
    const siteOrigin = riotRsoEnv('RIOT_RSO_SITE_ORIGIN') || 'https://nxt5.org';
    const origin = new URL(siteOrigin);
    if (origin.protocol !== 'https:' || origin.origin !== siteOrigin || origin.username || origin.password) return null;
    const redirectUri = riotRsoEnv('RIOT_RSO_REDIRECT_URI') || `${siteOrigin}${CALLBACK_PATH}`;
    const postLogoutRedirectUri = riotRsoEnv('RIOT_RSO_POST_LOGOUT_REDIRECT_URI') || `${siteOrigin}${POST_LOGOUT_PATH}`;
    if (!exactHttpsUrl(redirectUri, siteOrigin, CALLBACK_PATH) || !exactHttpsUrl(postLogoutRedirectUri, siteOrigin, POST_LOGOUT_PATH)) return null;
    const clientId = riotRsoEnv('RIOT_RSO_CLIENT_ID');
    if (!clientId || clientId.length > 256 || /[\s\u0000-\u001f\u007f]/.test(clientId)) return null;
    const accountRegion = riotRsoEnv('RIOT_RSO_ACCOUNT_REGION') || 'europe';
    if (!['europe', 'americas', 'asia'].includes(accountRegion)) return null;
    let auth: RiotRsoConfig['auth'];
    if (riotRsoEnv('RIOT_RSO_CLIENT_AUTH_METHOD') === 'client_secret_basic') {
      const secret = riotRsoEnv('RIOT_RSO_CLIENT_SECRET');
      if (!secret || secret.length > 4096 || /[\u0000-\u001f\u007f]/.test(secret)) return null;
      auth = { method: 'client_secret_basic', secret };
    } else if (riotRsoEnv('RIOT_RSO_CLIENT_AUTH_METHOD') === 'private_key_jwt') {
      const keyId = riotRsoEnv('RIOT_RSO_PRIVATE_KEY_ID');
      if (!keyId || keyId.length > 256 || /[\s\u0000-\u001f\u007f]/.test(keyId)) return null;
      // The public tutorial does not specify the supplied client assertion's
      // audience. Confirm it with the approved client; never guess or fall back.
      const assertionAudience = riotRsoEnv('RIOT_RSO_PRIVATE_KEY_AUDIENCE');
      if (![ISSUER, TOKEN_URL].includes(assertionAudience)) return null;
      const pem = riotRsoEnv('RIOT_RSO_PRIVATE_KEY').replace(/\\n/g, '\n');
      if (pem.length > 16_384) return null;
      const privateKey = createPrivateKey(pem);
      if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'rsa'
        || (privateKey.asymmetricKeyDetails?.modulusLength || 0) < 2048) return null;
      auth = { method: 'private_key_jwt', privateKey, keyId, assertionAudience };
    } else return null;
    return { siteOrigin, redirectUri, postLogoutRedirectUri, clientId, accountRegion: accountRegion as RiotRsoConfig['accountRegion'], auth };
  } catch { return null; }
}

export function requireRiotRsoConfig(): RiotRsoConfig {
  const config = getRiotRsoConfig();
  if (!config) throw unavailable();
  return config;
}

async function requestJson(url: string, options: RequestInit = {}): Promise<any> {
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      headers: { Accept: 'application/json', ...options.headers },
    });
    if (!response.ok || !response.body) throw protocolError('RIOT_RSO_PROVIDER_ERROR');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 131_072) {
        await reader.cancel();
        throw protocolError('RIOT_RSO_PROVIDER_ERROR');
      }
      chunks.push(value);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw protocolError();
    return payload;
  } catch {
    throw protocolError('RIOT_RSO_PROVIDER_ERROR');
  }
}

async function providerMetadata(config: RiotRsoConfig) {
  const metadata = await requestJson(`${ISSUER}/.well-known/openid-configuration`);
  const includes = (field: string, value: string) => Array.isArray(metadata[field]) && metadata[field].includes(value);
  if (metadata.issuer !== ISSUER || metadata.authorization_endpoint !== AUTHORIZE_URL
    || metadata.token_endpoint !== TOKEN_URL || metadata.jwks_uri !== JWKS_URL
    || !includes('response_types_supported', 'code') || !includes('response_modes_supported', 'query')
    || !includes('grant_types_supported', 'authorization_code') || !includes('scopes_supported', 'openid')
    || !includes('code_challenge_methods_supported', 'S256')
    || !includes('token_endpoint_auth_methods_supported', config.auth.method)
    || (config.auth.method === 'private_key_jwt' && !includes('token_endpoint_auth_signing_alg_values_supported', 'RS256'))) {
    throw unavailable();
  }
  const algorithms = SIGNING_ALGORITHMS.filter(algorithm => includes('id_token_signing_alg_values_supported', algorithm));
  if (!algorithms.length) throw unavailable();
  return { algorithms };
}

function assertVerifier(nonce: string, codeVerifier: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce) || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) throw protocolError();
}

export async function createRiotAuthorizationUrl(
  config: RiotRsoConfig,
  { state, nonce, codeVerifier }: { state: string; nonce: string; codeVerifier: string },
): Promise<string> {
  assertVerifier(nonce, codeVerifier);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(state)) throw protocolError();
  await providerMetadata(config);
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: 'openid',
    state,
    nonce,
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

function sameText(first: string, second: string) {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}

function optionalRiotName(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw protocolError();
  return value;
}

/** All OAuth tokens stay in this call's memory and are discarded on return. */
export async function exchangeRiotAuthorizationCode(
  config: RiotRsoConfig,
  { code, nonce, codeVerifier }: { code: string; nonce: string; codeVerifier: string },
): Promise<VerifiedRiotIdentity> {
  assertVerifier(nonce, codeVerifier);
  if (!code || code.length > 4096 || /[\s\u0000-\u001f\u007f]/.test(code)) throw protocolError();
  const metadata = await providerMetadata(config);
  const form = new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: config.redirectUri, code_verifier: codeVerifier,
  });
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (config.auth.method === 'client_secret_basic') {
    const encode = (value: string) => new URLSearchParams({ value }).toString().slice('value='.length);
    headers.Authorization = `Basic ${Buffer.from(`${encode(config.clientId)}:${encode(config.auth.secret)}`).toString('base64')}`;
  } else {
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: config.auth.keyId })
      .setIssuer(config.clientId).setSubject(config.clientId).setAudience(config.auth.assertionAudience)
      .setIssuedAt(now).setExpirationTime(now + 60).setJti(randomBytes(32).toString('base64url'))
      .sign(config.auth.privateKey);
    form.set('client_id', config.clientId);
    form.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    form.set('client_assertion', assertion);
  }
  const tokens = await requestJson(TOKEN_URL, { method: 'POST', headers, body: form.toString() });
  if (typeof tokens.access_token !== 'string' || !tokens.access_token || tokens.access_token.length > 32768
    || /[\s\u0000-\u001f\u007f]/.test(tokens.access_token)
    || typeof tokens.id_token !== 'string' || tokens.id_token.length > 32768
    || typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer'
    || (tokens.scope !== undefined && (typeof tokens.scope !== 'string' || tokens.scope.trim() !== 'openid'))) {
    throw protocolError();
  }
  const keys = await requestJson(JWKS_URL);
  if (!Array.isArray(keys.keys) || keys.keys.length < 1 || keys.keys.length > 32) throw protocolError();
  try {
    const { payload, protectedHeader } = await jwtVerify(tokens.id_token, createLocalJWKSet(keys), {
      issuer: ISSUER,
      audience: config.clientId,
      algorithms: metadata.algorithms,
      requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'],
      clockTolerance: 30,
      maxTokenAge: '10 minutes',
    });
    if (typeof payload.nonce !== 'string' || !sameText(payload.nonce, nonce)
      || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 512
      || (payload.azp !== undefined && payload.azp !== config.clientId)
      || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) throw protocolError();
    if (payload.at_hash !== undefined) {
      const hash = createHash(`sha${protectedHeader.alg.slice(-3)}`).update(tokens.access_token).digest();
      const expected = hash.subarray(0, hash.length / 2).toString('base64url');
      if (typeof payload.at_hash !== 'string' || !sameText(payload.at_hash, expected)) throw protocolError();
    }
  } catch { throw protocolError(); }

  // The authenticated ACCOUNT-V1 endpoint, not a typed Riot ID or OIDC sub,
  // provides the PUUID used for NXT5's explicit identity association.
  const account = await requestJson(`https://${config.accountRegion}.api.riotgames.com/riot/account/v1/accounts/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (typeof account.puuid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(account.puuid)) throw protocolError();
  return {
    puuid: account.puuid,
    gameName: optionalRiotName(account.gameName, 100),
    tagLine: optionalRiotName(account.tagLine, 32),
  };
}
