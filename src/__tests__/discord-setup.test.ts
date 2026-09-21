import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import setup from '../../netlify/functions/discord-setup';
import { DISCORD_INSTALL_PERMISSIONS, DISCORD_INSTALL_SCOPES, nxtDiscordCommand } from '../../shared/discord-command.js';

const APP = '100000000000000001';
const KEY = 'a'.repeat(64);
const TOKEN = 'setup-test-only-bot-token';
const SECRET = 'setup-test-only-worker-secret-over-32-characters';
const ENDPOINT = 'https://nxt5.example/.netlify/functions/discord-interactions';
const BASE = 'https://discord.com/api/v10';
const context = (name = 'production') => ({ deploy: { context: name }, site: { id: 'test-site' } }) as any;
const fetchMock = vi.fn();
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const params = () => ({ scopes: [...DISCORD_INSTALL_SCOPES], permissions: DISCORD_INSTALL_PERMISSIONS });
const application = () => ({ id: APP, name: 'NXT5', verify_key: KEY, bot_public: true, bot_require_code_grant: false,
  interactions_endpoint_url: ENDPOINT, install_params: params(), integration_types_config: { '0': { oauth2_install_params: params() } },
  client_secret: 'never-return-this', bot: { token: TOKEN }, owner: { email: 'private@example.test' }, team: { members: ['private-member'] } });
const command = () => ({ ...nxtDiscordCommand(), id: '100000000000000002', application_id: APP, version: '123' });

function signed(body: unknown = { action: 'inspect', expectedApplicationId: APP }, age = 0, overrides: Record<string, string> = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  return new Request('https://nxt5.example/.netlify/functions/discord-setup', { method: 'POST', body: raw, headers: {
    'content-type': 'application/json', 'x-nxt5-discord-timestamp': timestamp,
    'x-nxt5-discord-signature': createHmac('sha256', SECRET).update(timestamp + '.' + raw).digest('hex'), ...overrides,
  } });
}
function mockDiscord(initial = application()) {
  let current: any = structuredClone(initial);
  let commands: any[] = [command(), { id: '100000000000000003', type: 1, name: 'existing-command' }];
  fetchMock.mockImplementation(async (url: string, options: any) => {
    if (url === BASE + '/applications/@me') {
      if (options.method === 'PATCH') current = { ...current, ...JSON.parse(options.body) };
      return response(current);
    }
    if (url === BASE + '/applications/' + APP + '/commands') {
      if (options.method === 'POST') {
        const upserted = { ...JSON.parse(options.body), id: '100000000000000002' };
        commands = [upserted, ...commands.filter((item) => item.name !== upserted.name)];
        return response(upserted);
      }
      return response(commands);
    }
    throw new Error('Unexpected route');
  });
}

beforeEach(() => {
  vi.stubGlobal('Netlify', undefined);
  vi.stubGlobal('fetch', fetchMock.mockReset());
  for (const [key, value] of Object.entries({ CONTEXT: 'production', AWS_LAMBDA_FUNCTION_NAME: 'test-function', SITE_ID: 'test-site',
    DISCORD_APPLICATION_ID: APP, DISCORD_BOT_TOKEN: TOKEN, DISCORD_PUBLIC_KEY: KEY, DISCORD_WORKER_SECRET: SECRET,
    PUBLIC_SITE_URL: 'https://nxt5.example', DISCORD_PUBLISHING_ENABLED: 'false', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  mockDiscord();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('Explicit Discord operator setup authorization', () => {
  it.each(['deploy-preview', 'branch-deploy', 'dev', '', 'unknown'])('refuses %s before any network access', async (name) => {
    const result = await setup(signed(), context(name));
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: 'DISCORD_SETUP_PRODUCTION_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('requires real production metadata rather than environment or request headers', async () => {
    const result = await setup(signed(undefined, 0, { 'x-nf-deploy-context': 'production' }), {} as any);
    expect(result.status).toBe(409); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('is POST-only', async () => {
    expect((await setup(new Request(ENDPOINT), context())).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([121, -121])('rejects a valid HMAC outside the 120-second window (%s)', async (age) => {
    expect((await setup(signed(undefined, age), context())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['', '0'.repeat(64)])('rejects missing or incorrect HMAC %s', async (signature) => {
    expect((await setup(signed(undefined, 0, { 'x-nxt5-discord-signature': signature }), context())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('binds the signature to the exact action and target body', async () => {
    const original = signed();
    const altered = new Request(original.url, { method: 'POST', headers: original.headers, body: JSON.stringify({ action: 'configure', expectedApplicationId: APP }) });
    expect((await setup(altered, context())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([{}, [], { action: 'publish' }, { action: 'inspect', expectedApplicationId: '100000000000000099' }, { action: 'configure' }])('rejects an invalid action or target %j before network access', async (body) => {
    expect([400, 409]).toContain((await setup(signed(body), context())).status);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects malformed and oversized signed bodies', async () => {
    expect((await setup(signed('{'), context())).status).toBe(400);
    expect((await setup(signed('a'.repeat(4097)), context())).status).toBe(413);
    expect((await setup(signed(undefined, 0, { 'content-length': '9000' }), context())).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not contact Discord until the server configuration is complete', async () => {
    vi.stubEnv('DISCORD_BOT_TOKEN', '');
    expect((await setup(signed(), context())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Discord application identity and public inspection', () => {
  it.each([
    [{ id: '100000000000000099' }, 'DISCORD_APPLICATION_MISMATCH'],
    [{ verify_key: 'b'.repeat(64) }, 'DISCORD_PUBLIC_KEY_MISMATCH'],
    [{ verify_key: undefined }, 'DISCORD_PUBLIC_KEY_MISMATCH'],
  ])('refuses configuration on identity mismatch %j without a mutation', async (changes, code) => {
    mockDiscord({ ...application(), ...changes } as any);
    const result = await setup(signed({ action: 'configure', expectedApplicationId: APP }), context());
    expect(result.status).toBe(409); expect(await result.json()).toMatchObject({ code });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
  it('returns only bounded public metadata and performs no mutations while sends are disabled', async () => {
    const result = await setup(signed(undefined, 119), context());
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body).toMatchObject({ action: 'inspect', ready: true, application: { id: APP, name: 'NXT5', botPublic: true, botRequireCodeGrant: false } });
    expect(Object.keys(body.application).sort()).toEqual(['id', 'name', 'botPublic', 'botRequireCodeGrant', 'interactionsEndpointUrl', 'expectedInteractionsEndpointUrl', 'installParams', 'guildInstall'].sort());
    const serialized = JSON.stringify(body);
    for (const secret of [KEY, TOKEN, SECRET, 'never-return-this', 'private@example.test', 'private-member']) expect(serialized).not.toContain(secret);
    expect(fetchMock.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toMatch(/^https:\/\/discord.com\/api\/v10\/applications\//);
      expect(options).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bot ' + TOKEN } });
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it('does not expose credentials or query parameters from a previous endpoint URL', async () => {
    mockDiscord({ ...application(), interactions_endpoint_url: 'https://example.test/previous?token=private-token#fragment' });
    const result = await (await setup(signed(), context())).json();
    expect(result.application.interactionsEndpointUrl).toBe('https://example.test/previous');
    expect(JSON.stringify(result)).not.toContain('private-token');
  });
});

describe('Single-command setup and verification', () => {
  it.each([{ '0': 'invalid' }, { '0': { oauth2_install_params: [] } }])('rejects malformed existing installation contexts before changing the application', async (integration_types_config) => {
    mockDiscord({ ...application(), integration_types_config } as any);
    const result = await setup(signed({ action: 'configure', expectedApplicationId: APP }), context());
    expect(result.status).toBe(502);
    expect(await result.json()).toMatchObject({ code: 'DISCORD_SETUP_INVALID_RESPONSE' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
  it('preserves other application contexts and commands, then verifies live results', async () => {
    const initial: any = application();
    initial.interactions_endpoint_url = null;
    initial.description = 'Keep this description';
    initial.integration_types_config['1'] = { oauth2_install_params: { scopes: ['applications.commands'], permissions: '0' } };
    mockDiscord(initial);
    const result = await setup(signed({ action: 'configure', expectedApplicationId: APP, endpoint: 'https://attacker.example' }), context());
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.ready).toBe(true);
    expect(body.commands.map((item: any) => item.name)).toEqual(['nxt', 'existing-command']);
    expect(fetchMock.mock.calls.map(([url, options]) => [url.replace(BASE, ''), options.method])).toEqual([
      ['/applications/@me', 'GET'], ['/applications/@me', 'PATCH'], ['/applications/' + APP + '/commands', 'POST'],
      ['/applications/@me', 'GET'], ['/applications/' + APP + '/commands', 'GET'],
    ]);
    const patch = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(Object.keys(patch).sort()).toEqual(['install_params', 'integration_types_config', 'interactions_endpoint_url']);
    expect(patch).toMatchObject({ interactions_endpoint_url: ENDPOINT, install_params: params(), integration_types_config: {
      '0': { oauth2_install_params: params() }, '1': initial.integration_types_config['1'],
    } });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(nxtDiscordCommand());
  });
  it('reports manual public-bot switches as incomplete without changing them', async () => {
    mockDiscord({ ...application(), bot_public: false, bot_require_code_grant: true });
    const result = await (await setup(signed({ action: 'configure', expectedApplicationId: APP }), context())).json();
    expect(result).toMatchObject({ ready: false, checks: { publicBot: false, codeGrantDisabled: false, globalCommand: true } });
    const patch = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(patch).not.toHaveProperty('bot_public'); expect(patch).not.toHaveProperty('bot_require_code_grant');
  });
  it('stops before command upsert if PATCH returns a different application', async () => {
    fetchMock.mockReset().mockResolvedValueOnce(response(application())).mockResolvedValueOnce(response({ ...application(), id: '100000000000000099' }));
    const result = await setup(signed({ action: 'configure', expectedApplicationId: APP }), context());
    expect(result.status).toBe(409); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not claim success when the command re-read lacks the required definition', async () => {
    fetchMock.mockImplementation(async (url: string, options: any) => response(url.endsWith('/commands') && options.method === 'GET' ? [] : application()));
    const result = await setup(signed({ action: 'configure', expectedApplicationId: APP }), context());
    expect(result.status).toBe(502); expect(await result.json()).toMatchObject({ code: 'DISCORD_SETUP_VERIFICATION_FAILED' });
  });
  it('uses the same individual upsert in the operator CLI', async () => {
    const argv = process.argv;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      process.argv = ['node', 'register-discord-commands.mjs', '--global'];
      await import('../../tools/register-discord-commands.mjs');
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe(BASE + '/applications/' + APP + '/commands');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(nxtDiscordCommand());
    } finally { process.argv = argv; }
  });
});

describe('Sanitized upstream errors', () => {
  it.each([401, 403, 400, 500])('does not return raw Discord HTTP %s bodies', async (status) => {
    fetchMock.mockResolvedValueOnce(response({ message: TOKEN, client_secret: SECRET }, status));
    const result = await setup(signed(), context());
    expect(result.status).toBe(502);
    const body = await result.text();
    expect(body).not.toContain(TOKEN); expect(body).not.toContain(SECRET);
  });
  it('returns a bounded retry delay for Discord throttling', async () => {
    fetchMock.mockResolvedValueOnce(response({ retry_after: 999999999, message: TOKEN }, 429));
    const result = await setup(signed(), context());
    expect(result.status).toBe(429); expect(result.headers.get('retry-after')).toBe('86400');
    expect(await result.json()).toMatchObject({ code: 'DISCORD_RATE_LIMITED', retryAfter: 86400 });
  });
  it('does not leak network error details or accept malformed successful responses', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failed: ' + TOKEN));
    const result = await setup(signed(), context());
    expect(result.status).toBe(502); expect(await result.text()).not.toContain(TOKEN);
    fetchMock.mockResolvedValueOnce(response(null));
    expect((await setup(signed(), context())).status).toBe(502);
  });
});
