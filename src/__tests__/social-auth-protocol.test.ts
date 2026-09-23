import { createHash, generateKeyPairSync } from 'node:crypto';
import { exportJWK, jwtVerify, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSocialAuthorizationUrl, exchangeSocialAuthorizationCode, providerLabel, requireSocialConfig, SOCIAL_PROVIDERS, socialProviderEnabled, type SocialProvider } from '../../netlify/functions/_lib/social-auth-protocol';

const nonce = 'n'.repeat(43);
const codeVerifier = 'v'.repeat(64);
const state = 's'.repeat(43);
const accessToken = 'ephemeral-provider-access-token';
const callback = 'https://nxt5.org/.netlify/functions/auth-social-callback';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const foreignKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const appleClientKeys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const clients = { google: 'nxt5.apps.googleusercontent.com', apple: 'org.nxt5.web', discord: '123456789123456789', riot: 'nxt5-riot-client' };
const issuers = { google: 'https://accounts.google.com', apple: 'https://appleid.apple.com' };
const tokenUrls = { google: 'https://oauth2.googleapis.com/token', apple: 'https://appleid.apple.com/auth/token', discord: 'https://discord.com/api/v10/oauth2/token' };
const jwksUrls = ['https://www.googleapis.com/oauth2/v3/certs', 'https://appleid.apple.com/auth/keys'];
let jwk: any;
let tokenResponses: Record<string, any>;
let discordProfile: any;
let fetchMock: any;

async function signedToken(provider: 'google' | 'apple', overrides: Record<string, any> = {}, key = keys.privateKey, alg = 'RS256') {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, any> = {
    iss: issuers[provider], sub: `${provider}-stable-subject`, aud: clients[provider], iat: now, exp: now + 300, nonce,
    email: 'player@example.com', email_verified: true,
    at_hash: createHash('sha256').update(accessToken).digest().subarray(0, 16).toString('base64url'), ...overrides,
  };
  for (const name of Object.keys(claims)) if (claims[name] === undefined) delete claims[name];
  return new SignJWT(claims).setProtectedHeader({ alg, kid: 'provider-signing-key' }).sign(key);
}

function exchange(provider: SocialProvider) {
  return exchangeSocialAuthorizationCode(requireSocialConfig(provider), { code: 'single-use-code', nonce, codeVerifier });
}

beforeAll(async () => { jwk = { ...await exportJWK(keys.publicKey), kid: 'provider-signing-key', use: 'sig', alg: 'RS256' }; });
beforeEach(async () => {
  for (const name of Object.keys(process.env)) if (/^(GOOGLE_AUTH_|APPLE_AUTH_|DISCORD_AUTH_|SOCIAL_AUTH_|RIOT_RSO_)/.test(name)) vi.stubEnv(name, undefined);
  for (const provider of ['google', 'apple', 'discord'] as const) {
    const prefix = `${provider.toUpperCase()}_AUTH_`;
    vi.stubEnv(`${prefix}ENABLED`, 'true');
    vi.stubEnv(`${prefix}CLIENT_ID`, clients[provider]);
    if (provider !== 'apple') vi.stubEnv(`${prefix}CLIENT_SECRET`, `${provider}-confidential-secret`);
  }
  vi.stubEnv('APPLE_AUTH_TEAM_ID', 'TEAM123456');
  vi.stubEnv('APPLE_AUTH_KEY_ID', 'KEY1234567');
  vi.stubEnv('APPLE_AUTH_PRIVATE_KEY', appleClientKeys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
  tokenResponses = {};
  for (const provider of ['google', 'apple'] as const) tokenResponses[provider] = {
    access_token: accessToken, token_type: 'Bearer', id_token: await signedToken(provider), refresh_token: 'must-not-escape',
  };
  tokenResponses.discord = { access_token: accessToken, token_type: 'Bearer', scope: 'identify email', refresh_token: 'must-not-escape' };
  discordProfile = { id: '123456789123456789', global_name: 'Joueur', username: 'joueur', email: 'player@example.com', verified: true };
  fetchMock = vi.fn(async (url: string) => {
    const provider = (Object.keys(tokenUrls) as (keyof typeof tokenUrls)[]).find(provider => tokenUrls[provider] === url);
    if (provider) return Response.json(tokenResponses[provider]);
    if (jwksUrls.includes(url)) return Response.json({ keys: [jwk] });
    if (url === 'https://discord.com/api/v10/users/@me') return Response.json(discordProfile);
    throw new Error('Unexpected external request');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('server-only provider configuration and authorization', () => {
  it('declares only the supported providers', () => {
    expect(SOCIAL_PROVIDERS).toEqual(['google', 'discord', 'apple', 'riot']);
    expect(SOCIAL_PROVIDERS.map(providerLabel)).toEqual(['Google', 'Discord', 'Apple', 'Riot Games']);
    expect(socialProviderEnabled('unknown' as SocialProvider)).toBe(false);
  });

  it.each(['google', 'apple', 'discord'] as const)('requires explicit %s enablement and credentials', provider => {
    const prefix = `${provider.toUpperCase()}_AUTH_`;
    expect(socialProviderEnabled(provider)).toBe(true);
    vi.stubEnv(`${prefix}ENABLED`, undefined);
    expect(socialProviderEnabled(provider)).toBe(false);
    expect(() => requireSocialConfig(provider)).toThrowError(expect.objectContaining({ status: 503, code: 'SOCIAL_AUTH_UNAVAILABLE' }));
    vi.stubEnv(`${prefix}ENABLED`, '1');
    expect(socialProviderEnabled(provider)).toBe(false);
    vi.stubEnv(`${prefix}ENABLED`, 'true');
    vi.stubEnv(`${prefix}CLIENT_ID`, undefined);
    expect(socialProviderEnabled(provider)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['http://nxt5.org', 'https://nxt5.org/', 'https://nxt5.org/path', 'https://nxt5.org?next=evil', 'https://secret@nxt5.org'])('refuses noncanonical origin %s', origin => {
    vi.stubEnv('SOCIAL_AUTH_SITE_ORIGIN', origin);
    expect(socialProviderEnabled('google')).toBe(false);
  });

  it('allows only a P-256 Apple signing key with an explicit team and key id', () => {
    vi.stubEnv('APPLE_AUTH_PRIVATE_KEY', keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
    expect(socialProviderEnabled('apple')).toBe(false);
    vi.stubEnv('APPLE_AUTH_PRIVATE_KEY', appleClientKeys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
    vi.stubEnv('APPLE_AUTH_TEAM_ID', 'missing');
    expect(socialProviderEnabled('apple')).toBe(false);
    vi.stubEnv('APPLE_AUTH_TEAM_ID', 'TEAM123456');
    vi.stubEnv('APPLE_AUTH_KEY_ID', 'missing');
    expect(socialProviderEnabled('apple')).toBe(false);
  });

  it.each(['google', 'apple', 'discord'] as const)('uses exact %s callback, state and minimal permissions', async provider => {
    const url = new URL(await createSocialAuthorizationUrl(requireSocialConfig(provider), { state, nonce, codeVerifier }));
    expect(url.searchParams.get('redirect_uri')).toBe(callback);
    expect(url.searchParams.get('client_id')).toBe(clients[provider]);
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe({ google: 'openid email', apple: 'email', discord: 'identify email' }[provider]);
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(url.searchParams.has('code_verifier')).toBe(false);
    if (provider === 'google') {
      expect(url.searchParams.get('nonce')).toBe(nonce);
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(codeVerifier).digest('base64url'));
    } else {
      expect(url.searchParams.has('code_challenge')).toBe(false);
      expect(url.searchParams.has('nonce')).toBe(provider === 'apple');
    }
    if (provider === 'apple') expect(url.searchParams.get('response_mode')).toBe('form_post');
  });

  it('rejects short or malformed correlation values before network access', async () => {
    await expect(createSocialAuthorizationUrl(requireSocialConfig('google'), { state: 'short', nonce, codeVerifier })).rejects.toThrow();
    await expect(exchangeSocialAuthorizationCode(requireSocialConfig('google'), { code: 'valid-code', nonce: 'short', codeVerifier })).rejects.toThrow();
    await expect(exchangeSocialAuthorizationCode(requireSocialConfig('google'), { code: 'invalid\ncode', nonce, codeVerifier })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe.each(['google', 'apple'] as const)('%s signed identity validation', provider => {
  it('returns stable identity fields only after signature verification', async () => {
    expect(await exchange(provider)).toEqual({ provider, subject: `${provider}-stable-subject`, email: 'player@example.com', emailVerified: true, name: null });
    const call = fetchMock.mock.calls.find((call: any[]) => call[0] === tokenUrls[provider]);
    const body = new URLSearchParams(call[1].body);
    expect(body.get('redirect_uri')).toBe(callback);
    expect(body.get('code')).toBe('single-use-code');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.has('code_verifier')).toBe(provider === 'google');
    expect(call[1].redirect).toBe('error');
    expect(call[1].signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['wrong issuer', { iss: 'https://attacker.example' }],
    ['wrong audience', { aud: 'another-client' }],
    ['wrong authorized party', { azp: 'another-client' }],
    ['multiple audiences without authorized party', { aud: ['nxt5.apps.googleusercontent.com', 'org.nxt5.web'], azp: undefined }],
    ['wrong nonce', { nonce: 'different-nonce' }],
    ['missing nonce', { nonce: undefined }],
    ['expired token', { exp: 1 }],
    ['missing expiry', { exp: undefined }],
    ['old issued-at', { iat: 1 }],
    ['missing issued-at', { iat: undefined }],
    ['missing subject', { sub: undefined }],
    ['invalid subject', { sub: 'bad\nsubject' }],
    ['wrong access-token hash', { at_hash: 'incorrect' }],
    ['malformed email', { email: 'someone@example.com\nheader' }],
    ['invalid verified flag', { email_verified: 1 }],
  ])('rejects %s even with a valid provider signature', async (_label, claims) => {
    tokenResponses[provider].id_token = await signedToken(provider, claims);
    await expect(exchange(provider)).rejects.toThrowError(expect.objectContaining({ code: 'SOCIAL_AUTH_VALIDATION_FAILED' }));
  });

  it('rejects foreign signatures and unadvertised signing algorithms', async () => {
    tokenResponses[provider].id_token = await signedToken(provider, {}, foreignKeys.privateKey);
    await expect(exchange(provider)).rejects.toThrow();
    tokenResponses[provider].id_token = await signedToken(provider, {}, keys.privateKey, 'RS512');
    await expect(exchange(provider)).rejects.toThrow();
  });

  it('accepts a missing optional access-token hash and requires azp when multiple audiences are present', async () => {
    tokenResponses[provider].id_token = await signedToken(provider, { at_hash: undefined, aud: [clients[provider], 'another-audience'], azp: clients[provider] });
    expect((await exchange(provider)).subject).toBe(`${provider}-stable-subject`);
  });

  it('does not mark absent or unverified email as verified', async () => {
    tokenResponses[provider].id_token = await signedToken(provider, { email_verified: false });
    expect((await exchange(provider)).emailVerified).toBe(false);
    tokenResponses[provider].id_token = await signedToken(provider, { email: undefined, email_verified: true });
    expect(await exchange(provider)).toMatchObject({ email: null, emailVerified: false });
  });
});

describe('Apple client authentication and private email', () => {
  it('signs an ES256 short-lived client secret with the registered team, Services ID and key', async () => {
    await exchange('apple');
    const form = new URLSearchParams(fetchMock.mock.calls.find((call: any[]) => call[0] === tokenUrls.apple)[1].body);
    const { payload, protectedHeader } = await jwtVerify(form.get('client_secret')!, appleClientKeys.publicKey, {
      issuer: 'TEAM123456', audience: issuers.apple, subject: clients.apple, algorithms: ['ES256'],
    });
    expect(protectedHeader.kid).toBe('KEY1234567');
    expect(payload.exp! - payload.iat!).toBe(300);
    expect(form.has('code_verifier')).toBe(false);
  });

  it('accepts Apple string booleans and private relay addresses without trusting unsigned name input', async () => {
    tokenResponses.apple.id_token = await signedToken('apple', { email: 'hidden@privaterelay.appleid.com', email_verified: 'true', is_private_email: 'true', name: 'Ignored Apple Name' });
    expect(await exchange('apple')).toMatchObject({ email: 'hidden@privaterelay.appleid.com', emailVerified: true, name: null });
    tokenResponses.apple.id_token = await signedToken('apple', { email_verified: 'false' });
    expect((await exchange('apple')).emailVerified).toBe(false);
  });
});

describe('Discord authenticated user profile', () => {
  it('uses the stable snowflake and authenticates the profile call with the ephemeral access token', async () => {
    expect(await exchange('discord')).toEqual({ provider: 'discord', subject: discordProfile.id, email: discordProfile.email, emailVerified: true, name: 'Joueur' });
    expect(fetchMock).toHaveBeenCalledWith('https://discord.com/api/v10/users/@me', expect.objectContaining({
      redirect: 'error', headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
    }));
    const form = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(form.get('client_secret')).toBe('discord-confidential-secret');
    expect(form.has('code_verifier')).toBe(false);
  });

  it.each([
    { id: 123456789123456789 }, { id: 'mutable-user-name' }, { verified: 'true' }, { bot: true }, { email: 'not-an-email' },
  ])('rejects malformed or nonhuman profile %j', async changes => {
    Object.assign(discordProfile, changes);
    await expect(exchange('discord')).rejects.toThrow();
  });

  it('preserves unverified and absent email as unverified', async () => {
    discordProfile.verified = false;
    expect((await exchange('discord')).emailVerified).toBe(false);
    discordProfile.email = null;
    discordProfile.verified = true;
    expect(await exchange('discord')).toMatchObject({ email: null, emailVerified: false });
  });

  it('refuses responses that do not grant identify', async () => {
    tokenResponses.discord.scope = 'email';
    await expect(exchange('discord')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('bounded external responses', () => {
  it('rejects oversized responses without leaking the response body', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'provider-secret'.repeat(12_000) })));
    await expect(exchange('google')).rejects.toThrowError(expect.objectContaining({ message: 'L’authentification n’a pas pu être vérifiée. Réessaie.' }));
  });

  it.each([null, [], 'invalid', 42])('refuses a non-object response %j', async body => {
    fetchMock.mockImplementationOnce(async () => Response.json(body));
    await expect(exchange('google')).rejects.toThrow();
  });

  it('does not expose network errors or malformed token types', async () => {
    fetchMock.mockRejectedValueOnce(new Error('secret request body'));
    await expect(exchange('google')).rejects.toThrowError(expect.objectContaining({ message: 'L’authentification n’a pas pu être vérifiée. Réessaie.' }));
    tokenResponses.google.token_type = 'Basic';
    await expect(exchange('google')).rejects.toThrow();
  });
});

describe('Riot remains behind its explicit approval gate', () => {
  it('requires approval and credentials while preserving the exact Riot callback on the same origin', () => {
    expect(socialProviderEnabled('riot')).toBe(false);
    vi.stubEnv('RIOT_RSO_ENABLED', 'true');
    vi.stubEnv('RIOT_RSO_CLIENT_ID', clients.riot);
    vi.stubEnv('RIOT_RSO_CLIENT_AUTH_METHOD', 'client_secret_basic');
    vi.stubEnv('RIOT_RSO_CLIENT_SECRET', 'riot-secret');
    expect(socialProviderEnabled('riot')).toBe(false);
    vi.stubEnv('RIOT_RSO_APPROVAL_CONFIRMED', 'true');
    const originalCallback = 'https://nxt5.org/.netlify/functions/auth-riot-callback';
    expect(requireSocialConfig('riot')).toMatchObject({ redirectUri: originalCallback, riot: { redirectUri: originalCallback } });
    for (const redirectUri of [originalCallback, callback]) {
      vi.stubEnv('RIOT_RSO_REDIRECT_URI', redirectUri);
      expect(requireSocialConfig('riot')).toMatchObject({ redirectUri, riot: { redirectUri } });
    }
    vi.stubEnv('RIOT_RSO_REDIRECT_URI', undefined);
    vi.stubEnv('SOCIAL_AUTH_SITE_ORIGIN', 'https://another.example');
    expect(socialProviderEnabled('riot')).toBe(false);
  });

  it('maps the authenticated ACCOUNT-V1 PUUID rather than the signed OIDC subject', async () => {
    vi.stubEnv('RIOT_RSO_ENABLED', 'true');
    vi.stubEnv('RIOT_RSO_APPROVAL_CONFIRMED', 'true');
    vi.stubEnv('RIOT_RSO_CLIENT_ID', clients.riot);
    vi.stubEnv('RIOT_RSO_CLIENT_AUTH_METHOD', 'client_secret_basic');
    vi.stubEnv('RIOT_RSO_CLIENT_SECRET', 'riot-secret');
    const issuer = 'https://auth.riotgames.com';
    const idToken = await signedToken('google', { iss: issuer, aud: clients.riot, sub: 'oidc-subject-is-not-puuid' });
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${issuer}/.well-known/openid-configuration`) return Response.json({
        issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks.json`,
        response_types_supported: ['code'], response_modes_supported: ['query'], grant_types_supported: ['authorization_code'],
        scopes_supported: ['openid'], code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'], id_token_signing_alg_values_supported: ['RS256'],
      });
      if (url === `${issuer}/token`) return Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer', scope: 'openid' });
      if (url === `${issuer}/jwks.json`) return Response.json({ keys: [jwk] });
      if (url === 'https://europe.api.riotgames.com/riot/account/v1/accounts/me') return Response.json({ puuid: 'authenticated-puuid', gameName: 'Joueur', tagLine: 'EUW' });
      throw new Error('Unexpected external request');
    });
    expect(await exchange('riot')).toEqual({ provider: 'riot', subject: 'authenticated-puuid', name: 'Joueur', email: null, emailVerified: false });
  });
});
