import { createHash, generateKeyPairSync } from 'node:crypto';
import { exportJWK, jwtVerify, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRiotAuthorizationUrl, exchangeRiotAuthorizationCode, getRiotRsoConfig, requireRiotRsoConfig } from '../../netlify/functions/_lib/riot-rso-protocol';

const issuer = 'https://auth.riotgames.com';
const clientId = 'nxt5-test-client';
const nonce = 'n'.repeat(43);
const codeVerifier = 'v'.repeat(64);
const state = 's'.repeat(43);
const accessToken = 'opaque-access-token';
const officialDiscovery = {
  issuer,
  authorization_endpoint: `${issuer}/authorize`,
  token_endpoint: `${issuer}/token`,
  jwks_uri: `${issuer}/jwks.json`,
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code'],
  scopes_supported: ['openid'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'private_key_jwt'],
  token_endpoint_auth_signing_alg_values_supported: ['RS256'],
  id_token_signing_alg_values_supported: ['RS256', 'ES256'],
};

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const foreignKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
let jwk: any;
let token: any;
let discovery: any;
let account: any;
let fetchMock: any;

async function idToken(overrides: Record<string, any> = {}, key = keyPair.privateKey, alg = 'RS256') {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: issuer, sub: 'opaque-oidc-subject-distinct-from-puuid', aud: clientId,
    iat: now, exp: now + 300, nonce,
    at_hash: createHash('sha256').update(accessToken).digest().subarray(0, 16).toString('base64url'),
    ...overrides,
  };
  for (const key of Object.keys(claims)) if (claims[key] === undefined) delete claims[key];
  return new SignJWT(claims).setProtectedHeader({ alg, kid: 'riot-signing-key' }).sign(key);
}

function exchange() {
  return exchangeRiotAuthorizationCode(requireRiotRsoConfig(), { code: 'single-use-code', nonce, codeVerifier });
}

beforeAll(async () => { jwk = { ...await exportJWK(keyPair.publicKey), kid: 'riot-signing-key', alg: 'RS256', use: 'sig' }; });
beforeEach(async () => {
  for (const key of Object.keys(process.env)) if (key.startsWith('RIOT_RSO_')) vi.stubEnv(key, undefined);
  vi.stubEnv('RIOT_RSO_ENABLED', 'true');
  vi.stubEnv('RIOT_RSO_APPROVAL_CONFIRMED', 'true');
  vi.stubEnv('RIOT_RSO_CLIENT_ID', clientId);
  vi.stubEnv('RIOT_RSO_CLIENT_AUTH_METHOD', 'client_secret_basic');
  vi.stubEnv('RIOT_RSO_CLIENT_SECRET', 'server-secret');
  discovery = structuredClone(officialDiscovery);
  token = { access_token: accessToken, id_token: await idToken(), token_type: 'Bearer', scope: 'openid', refresh_token: 'discard-this-token' };
  account = { puuid: 'authenticated-puuid', gameName: 'Joueur', tagLine: 'EUW' };
  fetchMock = vi.fn(async (url: string) => {
    if (url === `${issuer}/.well-known/openid-configuration`) return Response.json(discovery);
    if (url === `${issuer}/token`) return Response.json(token);
    if (url === `${issuer}/jwks.json`) return Response.json({ keys: [jwk] });
    if (url === 'https://europe.api.riotgames.com/riot/account/v1/accounts/me') return Response.json(account);
    throw new Error('Unexpected external request');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('RSO configuration stays inactive until explicit approval and valid server configuration', () => {
  it.each(['RIOT_RSO_ENABLED', 'RIOT_RSO_APPROVAL_CONFIRMED', 'RIOT_RSO_CLIENT_ID', 'RIOT_RSO_CLIENT_AUTH_METHOD', 'RIOT_RSO_CLIENT_SECRET'])('refuses when %s is absent', key => {
    vi.stubEnv(key, undefined);
    expect(getRiotRsoConfig()).toBeNull();
    expect(() => requireRiotRsoConfig()).toThrowError(expect.objectContaining({ status: 503, code: 'RIOT_RSO_UNAVAILABLE' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    ['RIOT_RSO_ENABLED', '1'], ['RIOT_RSO_APPROVAL_CONFIRMED', 'TRUE'],
    ['RIOT_RSO_CLIENT_AUTH_METHOD', 'none'], ['RIOT_RSO_CLIENT_AUTH_METHOD', 'client_secret_post'],
    ['RIOT_RSO_ACCOUNT_REGION', 'attacker.test'], ['RIOT_RSO_SITE_ORIGIN', 'http://localhost:8888'],
    ['RIOT_RSO_SITE_ORIGIN', 'https://nxt5.org/'], ['RIOT_RSO_SITE_ORIGIN', 'https://nxt5.org/path'],
    ['RIOT_RSO_REDIRECT_URI', 'https://other.example/.netlify/functions/auth-riot-callback'],
    ['RIOT_RSO_REDIRECT_URI', 'https://nxt5.org/.netlify/functions/auth-riot-callback?next=other'],
    ['RIOT_RSO_REDIRECT_URI', 'https://nxt5.org/.netlify/functions/auth-riot-callback#hash'],
    ['RIOT_RSO_REDIRECT_URI', 'https://nxt5.org/wrong-path'],
    ['RIOT_RSO_REDIRECT_URI', 'https://secret@nxt5.org/.netlify/functions/auth-riot-callback'],
    ['RIOT_RSO_POST_LOGOUT_REDIRECT_URI', 'https://other.example/connexion'],
  ])('refuses invalid %s', (key, value) => { vi.stubEnv(key, value); expect(getRiotRsoConfig()).toBeNull(); });
  it('keeps the exact prepared callback and post-logout paths, allowing an explicitly approved HTTPS origin', () => {
    expect(requireRiotRsoConfig()).toMatchObject({ siteOrigin: 'https://nxt5.org', redirectUri: 'https://nxt5.org/.netlify/functions/auth-riot-callback', postLogoutRedirectUri: 'https://nxt5.org/connexion' });
    vi.stubEnv('RIOT_RSO_SITE_ORIGIN', 'https://approved-staging.example');
    vi.stubEnv('RIOT_RSO_REDIRECT_URI', 'https://approved-staging.example/.netlify/functions/auth-riot-callback');
    vi.stubEnv('RIOT_RSO_POST_LOGOUT_REDIRECT_URI', 'https://approved-staging.example/connexion');
    expect(requireRiotRsoConfig().siteOrigin).toBe('https://approved-staging.example');
  });
  it.each(['auth-riot-callback', 'auth-social-callback'])('preserves the explicitly approved %s URI through authorization and token exchange', async path => {
    const redirectUri = `https://nxt5.org/.netlify/functions/${path}`;
    vi.stubEnv('RIOT_RSO_REDIRECT_URI', redirectUri);
    expect(requireRiotRsoConfig().redirectUri).toBe(redirectUri);
    const authorization = new URL(await createRiotAuthorizationUrl(requireRiotRsoConfig(), { state, nonce, codeVerifier }));
    expect(authorization.searchParams.get('redirect_uri')).toBe(redirectUri);
    await exchange();
    const [, request] = fetchMock.mock.calls.find((call: any[]) => call[0] === `${issuer}/token`);
    expect(new URLSearchParams(request.body).get('redirect_uri')).toBe(redirectUri);
    for (const invalid of [`${redirectUri}/`, `${redirectUri}?next=other`, `${redirectUri}#hash`, redirectUri.replace('nxt5.org', 'other.example')]) {
      vi.stubEnv('RIOT_RSO_REDIRECT_URI', invalid);
      expect(getRiotRsoConfig()).toBeNull();
    }
  });
  it('rejects malformed or unsupported private keys without leaking their contents', () => {
    vi.stubEnv('RIOT_RSO_CLIENT_AUTH_METHOD', 'private_key_jwt');
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY_ID', 'client-key');
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY_AUDIENCE', `${issuer}/token`);
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY', 'secret-invalid-key-material');
    expect(getRiotRsoConfig()).toBeNull();
    const weak = generateKeyPairSync('rsa', { modulusLength: 1024 });
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY', weak.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
    expect(getRiotRsoConfig()).toBeNull();
  });
  it.each([undefined, 'https://attacker.example/token'])('requires a confirmed official private assertion audience: %s', audience => {
    vi.stubEnv('RIOT_RSO_CLIENT_AUTH_METHOD', 'private_key_jwt');
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY_ID', 'client-key');
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY', keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY_AUDIENCE', audience);
    expect(getRiotRsoConfig()).toBeNull();
  });
});

describe('RSO authorization code + S256 + nonce', () => {
  it('requests only openid and binds the authorization request to the stored verifier and nonce', async () => {
    const url = new URL(await createRiotAuthorizationUrl(requireRiotRsoConfig(), { state, nonce, codeVerifier }));
    expect(url.origin + url.pathname).toBe(`${issuer}/authorize`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: clientId, redirect_uri: 'https://nxt5.org/.netlify/functions/auth-riot-callback',
      response_type: 'code', response_mode: 'query', scope: 'openid', state, nonce,
      code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'), code_challenge_method: 'S256',
    });
    expect(url.href).not.toContain('server-secret');
    expect(url.href).not.toContain(codeVerifier);
  });
  it.each([
    ['code_challenge_methods_supported', ['plain']],
    ['token_endpoint_auth_methods_supported', ['none']],
    ['id_token_signing_alg_values_supported', ['none', 'HS256']],
    ['issuer', 'https://other.example'],
    ['token_endpoint', 'https://other.example/token'],
    ['jwks_uri', 'https://other.example/jwks'],
  ])('fails closed if discovery changes %s', async (key, value) => {
    discovery[key] = value;
    await expect(createRiotAuthorizationUrl(requireRiotRsoConfig(), { state, nonce, codeVerifier })).rejects.toMatchObject({ code: 'RIOT_RSO_UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([{ state: 'short', nonce, codeVerifier }, { state, nonce: 'short', codeVerifier }, { state, nonce, codeVerifier: 'short' }])('rejects malformed transaction material before network calls', async material => {
    await expect(createRiotAuthorizationUrl(requireRiotRsoConfig(), material)).rejects.toMatchObject({ code: 'RIOT_RSO_VALIDATION_FAILED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('RSO exchanges credentials exclusively on the server', () => {
  it('returns only the authenticated account identity, discarding all tokens', async () => {
    expect(await exchange()).toEqual({ puuid: 'authenticated-puuid', gameName: 'Joueur', tagLine: 'EUW' });
    const request = fetchMock.mock.calls.find(([url]) => url === `${issuer}/token`)[1];
    expect(request.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({ grant_type: 'authorization_code', code: 'single-use-code', redirect_uri: 'https://nxt5.org/.netlify/functions/auth-riot-callback', code_verifier: codeVerifier });
    expect(request.headers.Authorization).toBe(`Basic ${Buffer.from(`${clientId}:server-secret`).toString('base64')}`);
    const accountRequest = fetchMock.mock.calls.find(([url]) => url.includes('/accounts/me'))[1];
    expect(accountRequest.headers.Authorization).toBe(`Bearer ${accessToken}`);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).not.toMatch(/server-secret|single-use-code|opaque-access-token/);
      expect(options.redirect).toBe('error');
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it('uses a new signed one-minute private_key_jwt assertion for each exchange', async () => {
    vi.stubEnv('RIOT_RSO_CLIENT_AUTH_METHOD', 'private_key_jwt');
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY_ID', 'approved-client-key');
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY_AUDIENCE', `${issuer}/token`);
    vi.stubEnv('RIOT_RSO_PRIVATE_KEY', keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
    await exchange();
    await exchange();
    const forms = fetchMock.mock.calls.filter(([url]) => url === `${issuer}/token`).map(([, request]) => {
      expect(request.headers.Authorization).toBeUndefined();
      return new URLSearchParams(request.body);
    });
    const first = await jwtVerify(forms[0].get('client_assertion')!, keyPair.publicKey, { issuer: clientId, audience: `${issuer}/token`, algorithms: ['RS256'] });
    const second = await jwtVerify(forms[1].get('client_assertion')!, keyPair.publicKey);
    expect(forms[0].get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(forms[0].get('client_id')).toBe(clientId);
    expect(first.protectedHeader.kid).toBe('approved-client-key');
    expect(first.payload.sub).toBe(clientId);
    expect(first.payload.exp! - first.payload.iat!).toBe(60);
    expect(first.payload.jti).not.toBe(second.payload.jti);
  });
  it.each(['token', 'jwks.json', 'me'])('maps provider failure at %s to a sanitized error', async route => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, options) => url.endsWith(`/${route}`)
      ? Promise.resolve(Response.json({ error_description: 'server-secret opaque-access-token single-use-code' }, { status: 400 }))
      : original(url, options));
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_PROVIDER_ERROR' });
    try { await exchange(); } catch (error) { expect(String(error)).not.toMatch(/server-secret|opaque-access-token|single-use-code/); }
  });
  it('refuses oversized provider bodies', async () => {
    fetchMock.mockResolvedValueOnce(new Response(' '.repeat(131073)));
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_PROVIDER_ERROR' });
  });
  it.each([undefined, '', 'bad/puuid', 42])('refuses an invalid authenticated PUUID %s', async puuid => {
    account.puuid = puuid;
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_VALIDATION_FAILED' });
  });
  it('accepts an account whose optional Riot ID is absent', async () => {
    account = { puuid: 'authenticated-puuid' };
    expect(await exchange()).toEqual({ puuid: 'authenticated-puuid', gameName: null, tagLine: null });
  });
  it.each([['puuid', 129], ['gameName', 101], ['tagLine', 33]])('rejects %s exceeding the persistence bound', async (field, length) => {
    account[field] = 'a'.repeat(length as number);
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_VALIDATION_FAILED' });
  });
});

describe('RSO OIDC validation', () => {
  it.each([
    ['issuer', { iss: 'https://other.example' }],
    ['audience', { aud: 'other-client' }],
    ['expiration', { exp: Math.floor(Date.now() / 1000) - 60 }],
    ['missing expiration', { exp: undefined }],
    ['missing subject', { sub: undefined }],
    ['future issuance', { iat: Math.floor(Date.now() / 1000) + 300 }],
    ['stale issuance', { iat: Math.floor(Date.now() / 1000) - 3600 }],
    ['nonce', { nonce: 'wrong-nonce' }],
    ['missing nonce', { nonce: undefined }],
    ['access token hash', { at_hash: 'wrong-token-hash' }],
    ['authorized party', { azp: 'other-client' }],
    ['multiple audiences without authorized party', { aud: [clientId, 'other-client'] }],
  ])('rejects invalid %s before requesting the account identity', async (_name, claims) => {
    token.id_token = await idToken(claims);
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_VALIDATION_FAILED' });
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/accounts/me'))).toBe(false);
  });
  it('rejects a tampered signature', async () => {
    token.id_token = await idToken({}, foreignKeyPair.privateKey);
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_VALIDATION_FAILED' });
  });
  it('rejects an unsigned token even when it has valid claims', async () => {
    const claims = token.id_token.split('.')[1];
    token.id_token = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${claims}.`;
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_VALIDATION_FAILED' });
  });
  it('validates a provider ECDSA ID token using the matching official JWKS', async () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const ecJwk = { ...await exportJWK(ec.publicKey), kid: 'riot-signing-key', alg: 'ES256', use: 'sig' };
    token.id_token = await idToken({}, ec.privateKey, 'ES256');
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, options) => url === `${issuer}/jwks.json`
      ? Promise.resolve(Response.json({ keys: [ecJwk] })) : original(url, options));
    expect((await exchange()).puuid).toBe('authenticated-puuid');
  });
  it('accepts several audiences only when the authorized party matches this client', async () => {
    token.id_token = await idToken({ aud: [clientId, 'other-client'], azp: clientId });
    expect((await exchange()).puuid).toBe('authenticated-puuid');
  });
  it.each([
    ['no identity token', { id_token: undefined }], ['wrong token type', { token_type: 'MAC' }],
    ['unexpected offline scope', { scope: 'openid offline_access' }], ['unsafe bearer value', { access_token: 'bad\nheader' }],
  ])('refuses %s', async (_name, fields) => {
    Object.assign(token, fields);
    await expect(exchange()).rejects.toMatchObject({ code: 'RIOT_RSO_VALIDATION_FAILED' });
  });
});
