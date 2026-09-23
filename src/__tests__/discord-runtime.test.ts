import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(), auth: vi.fn(), schema: vi.fn(), dispatch: vi.fn(), run: vi.fn(), reconcile: vi.fn(),
  maintain: vi.fn(), store: vi.fn(), get: vi.fn(), set: vi.fn(), preview: vi.fn(), image: vi.fn(),
}));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: Object.assign(mocks.sql, { transaction: vi.fn() }) }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: mocks.auth }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('../../netlify/functions/_lib/discord-queue', () => ({ assertDiscordSchemaReady: mocks.schema, enqueueManualPublication: vi.fn() }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: vi.fn() }));
vi.mock('../../netlify/functions/_lib/discord-preview', () => ({ loadDiscordPreview: mocks.preview }));
vi.mock('../../netlify/functions/_lib/publication-image', () => ({ getOrRenderPublicationImage: mocks.image }));
vi.mock('../../netlify/functions/_lib/discord-worker', () => ({ dispatchPublicationBatch: mocks.dispatch, runPublicationBatch: mocks.run, reconcilePublications: mocks.reconcile }));
vi.mock('../../netlify/functions/_lib/discord-maintenance', () => ({ maintainDiscordPublications: mocks.maintain }));
vi.mock('@netlify/blobs', () => ({ getStore: mocks.store }));

import { getDiscordDeployContext, withDiscordContext } from '../../netlify/functions/_lib/discord-runtime';
import { getDiscordConfig, isDiscordEnabled, signDiscordInternalRequest } from '../../netlify/functions/_lib/discord-config';
import { getPublicationAsset, putPublicationAsset } from '../../netlify/functions/_lib/publication-assets';
import { wakeDiscordPublications } from '../../netlify/functions/_lib/discord-wake';
import publish from '../../netlify/functions/team-discord-publish';
import connection from '../../netlify/functions/team-discord-connection';
import routes from '../../netlify/functions/team-discord-routes';
import retry from '../../netlify/functions/team-discord-retry';
import preview from '../../netlify/functions/team-discord-preview';
import deliveries from '../../netlify/functions/team-discord-deliveries';
import admin from '../../netlify/functions/admin-discord';
import asset from '../../netlify/functions/publication-asset';
import interactions from '../../netlify/functions/discord-interactions';
import dispatch from '../../netlify/functions/discord-dispatch';
import reconcile from '../../netlify/functions/discord-reconcile';
import background from '../../netlify/functions/discord-publish-background';
import maintenance from '../../netlify/functions/discord-maintenance';
import maintenanceBackground from '../../netlify/functions/discord-maintenance-background';
import setup from '../../netlify/functions/discord-setup';
import connectionTest from '../../netlify/functions/team-discord-test';

const TEAM = '10000000-0000-4000-8000-000000000001';
const SNAPSHOT = '10000000-0000-4000-8000-000000000002';
const TOKEN = 'runtime-test-only-token';
const state = () => ({ context: getDiscordDeployContext(), enabled: isDiscordEnabled(), configured: getDiscordConfig().configured });
const netlifyContext = (context: string) => ({ deploy: { context, id: 'deploy-test', published: context === 'production' }, site: { id: 'site-test' }, requestId: 'request-test' }) as any;
const request = (method = 'GET', body?: string, headers = {}) => new Request('https://nxt5.example/.netlify/functions/test', {
  method, headers: { origin: 'https://nxt5.example', 'content-type': 'application/json', ...headers }, ...(body ? { body } : {}),
});
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('Netlify', undefined);
  vi.stubGlobal('fetch', fetchMock.mockReset());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const [key, value] of Object.entries({
    CONTEXT: '', AWS_LAMBDA_FUNCTION_NAME: 'netlify-function', LAMBDA_TASK_ROOT: '', SITE_ID: 'site-test',
    DISCORD_APPLICATION_ID: '100000000000000001', DISCORD_BOT_TOKEN: TOKEN, DISCORD_PUBLIC_KEY: 'a'.repeat(64),
    DISCORD_WORKER_SECRET: 'runtime-test-only-worker-secret-long-enough', PUBLIC_SITE_URL: 'https://nxt5.example',
    DISCORD_PUBLISHING_ENABLED: 'true', DISCORD_ENVIRONMENT: 'production', DISCORD_LOCAL_PILOT: 'false',
  })) vi.stubEnv(key, value);
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.auth.mockImplementation(async () => { throw Object.assign(new Error('Session requise.'), { status: 401 }); });
  mocks.schema.mockResolvedValue(undefined);
  mocks.sql.mockResolvedValue([]);
  for (const mock of [mocks.dispatch, mocks.run, mocks.reconcile, mocks.maintain]) mock.mockImplementation(async () => state());
  mocks.store.mockReturnValue({ get: mocks.get, set: mocks.set });
  mocks.get.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  mocks.set.mockResolvedValue(undefined);
  fetchMock.mockResolvedValue(new Response('{}', { status: 202 }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('Netlify invocation context, independent from build variables', () => {
  it('enables a configured production invocation without CONTEXT in the runtime environment', () => {
    expect(withDiscordContext(netlifyContext('production'), state)).toEqual({ context: 'production', enabled: true, configured: true });
    expect(getDiscordDeployContext()).toBe('unknown');
    expect(getDiscordConfig().botToken).toBe('');
  });
  it.each(['deploy-preview', 'branch-deploy', '', 'unexpected'])('isolates runtime context %s even with production build variables and an explicit local pilot', (context) => {
    vi.stubEnv('CONTEXT', 'production'); vi.stubEnv('DISCORD_ENVIRONMENT', 'test'); vi.stubEnv('DISCORD_LOCAL_PILOT', 'true');
    withDiscordContext(netlifyContext(context), () => {
      expect(isDiscordEnabled()).toBe(false);
      const config = getDiscordConfig();
      expect([config.botToken, config.workerSecret, config.publicKey]).toEqual(['', '', '']);
      expect(() => signDiscordInternalRequest('{}')).toThrow('SECRET_MISSING');
    });
  });
  it('trusts production metadata over a stale preview environment and fails closed if hosted metadata is absent', () => {
    vi.stubEnv('CONTEXT', 'deploy-preview');
    expect(withDiscordContext(netlifyContext('production'), isDiscordEnabled)).toBe(true);
    vi.stubEnv('CONTEXT', 'production');
    for (const context of [undefined, {}, { site: { id: 'site-test' } }, { requestId: 'request-test' }]) {
      expect(withDiscordContext(context, state)).toEqual({ context: 'unknown', enabled: false, configured: false });
    }
    expect(isDiscordEnabled()).toBe(false);
  });
  it('keeps local environment fallback available only outside a hosted invocation', () => {
    for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID']) vi.stubEnv(key, '');
    vi.stubEnv('CONTEXT', 'production');
    expect(withDiscordContext({}, isDiscordEnabled)).toBe(true);
    expect(withDiscordContext({ requestId: 'hosted-without-context' }, isDiscordEnabled)).toBe(false);
    vi.stubEnv('CONTEXT', 'dev'); vi.stubEnv('DISCORD_ENVIRONMENT', 'test'); vi.stubEnv('DISCORD_LOCAL_PILOT', 'true');
    expect(withDiscordContext({}, isDiscordEnabled)).toBe(true);
  });
  it('preserves concurrent invocation contexts across promise and timer boundaries without a global leak', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const production = withDiscordContext(netlifyContext('production'), async () => {
      await gate; await new Promise((resolve) => setTimeout(resolve, 1));
      expect(state()).toEqual({ context: 'production', enabled: true, configured: true });
      expect(getDiscordConfig().botToken).toBe(TOKEN);
    });
    const isolated = withDiscordContext(netlifyContext('deploy-preview'), async () => {
      await Promise.resolve(); release(); await gate;
      expect(state()).toEqual({ context: 'deploy-preview', enabled: false, configured: false });
      expect(getDiscordConfig().botToken).toBe('');
    });
    await Promise.all([production, isolated]);
    expect(getDiscordDeployContext()).toBe('unknown');
  });
});

describe('Actual Discord HTTP entry points receive trusted invocation metadata', () => {
  it('applies trusted production metadata to the fifteenth handler: operator setup', async () => {
    const body = JSON.stringify({ action: 'inspect', expectedApplicationId: '100000000000000001' });
    const headers = withDiscordContext(netlifyContext('production'), () => signDiscordInternalRequest(body));
    const isolated = await setup(request('POST', body, headers), netlifyContext('deploy-preview'));
    expect(isolated.status).toBe(409);
    expect(await isolated.json()).toMatchObject({ code: 'DISCORD_SETUP_PRODUCTION_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
    const production = await setup(request('POST', body, headers), netlifyContext('production'));
    // The placeholder upstream body fails app identity, proving the signed
    // production request reached Discord without reading a build CONTEXT.
    expect(production.status).toBe(409);
    expect(await production.json()).toMatchObject({ code: 'DISCORD_APPLICATION_MISMATCH' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each([['publish', publish], ['connection', connection], ['routes', routes], ['retry', retry], ['connection test', connectionTest]] as const)('rejects preview %s mutations before authentication, database or network access', async (_name, handler) => {
    vi.stubEnv('CONTEXT', 'production');
    const response = await handler(request('POST', JSON.stringify({ teamId: TEAM })), netlifyContext('deploy-preview'));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DISCORD_DEPLOY_PREVIEW_DISABLED' });
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.sql).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
    const production = await handler(request('POST', JSON.stringify({ teamId: TEAM })), netlifyContext('production'));
    expect(production.status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledOnce();
  });
  it('does not allow request headers to claim production and explains missing deployment metadata', async () => {
    const response = await publish(request('POST', '{}', { 'x-nf-deploy-context': 'production', CONTEXT: 'production' }), {} as any);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DISCORD_DEPLOY_CONTEXT_UNAVAILABLE' });
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it('blocks preview asset regeneration before it can read or mutate a production snapshot', async () => {
    const response = await asset(request(), netlifyContext('deploy-preview'));
    expect(response.status).toBe(409);
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled(); expect(mocks.store).not.toHaveBeenCalled();
  });
  it.each([['admin', admin], ['connection', connection], ['routes', routes], ['preview', preview], ['deliveries', deliveries], ['connection test', connectionTest]] as const)('retains effective preview context during authenticated read-only %s requests', async (_name, handler) => {
    mocks.auth.mockImplementationOnce(async () => {
      expect(state()).toEqual({ context: 'deploy-preview', enabled: false, configured: false });
      throw Object.assign(new Error('Session requise.'), { status: 401 });
    });
    expect((await handler(request(), netlifyContext('deploy-preview'))).status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledOnce();
  });
  it('accepts signed interaction PING only with the production invocation public key', async () => {
    const keys = generateKeyPairSync('ed25519');
    vi.stubEnv('DISCORD_PUBLIC_KEY', keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex'));
    const body = JSON.stringify({ type: 1 }); const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': sign(null, Buffer.from(timestamp + body), keys.privateKey).toString('hex') };
    expect(await (await interactions(request('POST', body, headers), netlifyContext('production'))).json()).toEqual({ type: 1 });
    expect((await interactions(request('POST', body, headers), netlifyContext('deploy-preview'))).status).toBe(401);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});

describe('Signed Discord team autocomplete', () => {
  function autocomplete(overrides: Record<string, unknown> = {}) {
    const keys = generateKeyPairSync('ed25519');
    vi.stubEnv('DISCORD_PUBLIC_KEY', keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex'));
    const body = JSON.stringify({ type: 4, id: '100000000000000009', application_id: '100000000000000001', guild_id: '100000000000000003', token: 'interaction-test',
      member: { permissions: '32', user: { id: '100000000000000004' } }, data: { name: 'nxt', options: [{ name: 'pause', options: [{ name: 'equipe', value: 'academy', focused: true }] }] }, ...overrides });
    const timestamp = String(Math.floor(Date.now() / 1000));
    return request('POST', body, { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': sign(null, Buffer.from(timestamp + body), keys.privateKey).toString('hex') });
  }
  it('answers autocomplete directly with names and stable IDs without running a command', async () => {
    mocks.sql.mockResolvedValueOnce([{ id: SNAPSHOT, user_id: TEAM }])
      .mockResolvedValueOnce([{ id: TEAM, name: 'Academy', tag: 'ACA', owner_id: TEAM }]);
    const waitUntil = vi.fn();
    const result = await interactions(autocomplete(), { ...netlifyContext('production'), waitUntil });
    expect(await result.json()).toEqual({ type: 8, data: { choices: [{ name: 'Academy [ACA] · 00000001', value: TEAM }] } });
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(mocks.sql.mock.calls[1][0]).toContain('c.guild_id=$2');
    expect(mocks.sql.mock.calls[1][0]).toContain('tm.user_id=$1');
    expect(mocks.sql.mock.calls[1][1]).toEqual([TEAM, '100000000000000003', SNAPSHOT]);
    expect(waitUntil).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not suggest a foreign team to a Discord server manager', async () => {
    mocks.sql.mockResolvedValueOnce([{ id: SNAPSHOT, user_id: TEAM }])
      .mockResolvedValueOnce([
        { id: TEAM, name: 'Academy', tag: 'ACA', owner_id: TEAM },
        { id: '10000000-0000-4000-8000-000000000099', name: 'Foreign', tag: 'BBB', owner_id: SNAPSHOT, role: null },
      ]);
    const result = await interactions(autocomplete({ data: { name: 'nxt', options: [{ name: 'pause', options: [{ name: 'equipe', value: '', focused: true }] }] } }), netlifyContext('production'));
    expect(await result.json()).toEqual({ type: 8, data: { choices: [{ name: 'Academy [ACA] · 00000001', value: TEAM }] } });
  });
  it.each([
    { member: { permissions: '0', user: { id: '100000000000000004' } } },
    { application_id: '100000000000000099' },
    { data: { name: 'foreign', options: [] } },
    { data: { name: 'nxt', options: [{ name: 'connecter', options: [{ name: 'code', value: 'x', focused: true }] }] } },
  ])('returns no suggestions to an unauthorized or unrelated interaction: %j', async (overrides) => {
    const result = await interactions(autocomplete(overrides), netlifyContext('production'));
    expect(await result.json()).toEqual({ type: 8, data: { choices: [] } });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.schema).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects an unsigned autocomplete before requesting team information', async () => {
    const original = autocomplete();
    const unsigned = new Request(original.url, { method: 'POST', body: await original.text() });
    expect((await interactions(unsigned, netlifyContext('production'))).status).toBe(401);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('returns an empty list within two seconds if the database is slow', async () => {
    vi.useFakeTimers();
    try {
      mocks.sql.mockImplementation(() => new Promise(() => {}));
      const pending = interactions(autocomplete(), netlifyContext('production'));
      await vi.advanceTimersByTimeAsync(2000);
      expect(await (await pending).json()).toEqual({ type: 8, data: { choices: [] } });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('returns no choices on a schema failure without leaking an error', async () => {
    mocks.schema.mockRejectedValue(new Error('private database detail'));
    expect(await (await interactions(autocomplete(), netlifyContext('production'))).json()).toEqual({ type: 8, data: { choices: [] } });
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});

describe('Scheduled, background and import wake propagation', () => {
  it.each([['dispatch', dispatch, mocks.dispatch], ['reconcile', reconcile, mocks.reconcile]] as const)('propagates runtime context into scheduled %s processing', async (_name, handler, operation) => {
    const production = await (handler as any)(request(), netlifyContext('production'));
    expect(await production.json()).toEqual({ context: 'production', enabled: true, configured: true });
    const isolated = await (handler as any)(request(), netlifyContext('deploy-preview'));
    expect(await isolated.json()).toEqual({ context: 'deploy-preview', enabled: false, configured: false });
    expect(operation).toHaveBeenCalledTimes(2);
  });
  it.each([['publish', background, mocks.run], ['maintenance', maintenanceBackground, mocks.maintain]] as const)('verifies signed %s callbacks using the invocation context', async (_name, handler, operation) => {
    const body = '{}';
    const headers = withDiscordContext(netlifyContext('production'), () => signDiscordInternalRequest(body));
    const response = await (handler as any)(request('POST', body, headers), netlifyContext('production'));
    expect(await response.json()).toEqual({ context: 'production', enabled: true, configured: true });
    expect((await (handler as any)(request('POST', body, headers), netlifyContext('deploy-preview'))).status).toBe(401);
    expect(operation).toHaveBeenCalledOnce();
  });
  it('dispatches scheduled maintenance in a configured production invocation while publication is paused', async () => {
    vi.stubEnv('DISCORD_PUBLISHING_ENABLED', 'false');
    expect(await (await (maintenance as any)(request(), netlifyContext('production'))).json()).toEqual({ dispatched: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers['x-nxt5-discord-signature']).toMatch(/^[a-f0-9]{64}$/);
    expect(await (await (maintenance as any)(request(), netlifyContext('deploy-preview'))).json()).toEqual({ enabled: false });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('retains the import invocation context after waitUntil returns and skips preview wakeups', async () => {
    const waitUntil = vi.fn();
    mocks.dispatch.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(state()).toEqual({ context: 'production', enabled: true, configured: true });
      return { dispatched: true };
    });
    wakeDiscordPublications({ ...netlifyContext('production'), waitUntil });
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(getDiscordDeployContext()).toBe('unknown');
    wakeDiscordPublications({ ...netlifyContext('deploy-preview'), waitUntil });
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0][0];
    expect(mocks.dispatch).toHaveBeenCalledWith({ allowSoon: true });
  });
  it('uses a separate asset store from invocation metadata even if the build context is misleading', async () => {
    vi.stubEnv('CONTEXT', 'production');
    await withDiscordContext(netlifyContext('deploy-preview'), () => getPublicationAsset(`${TEAM}/${SNAPSHOT}/game.png`));
    expect(mocks.store).toHaveBeenLastCalledWith({ name: 'nxt5-discord-preview', consistency: 'strong' });
    vi.stubEnv('CONTEXT', 'deploy-preview');
    await withDiscordContext(netlifyContext('production'), () => putPublicationAsset({ teamId: TEAM, snapshotId: SNAPSHOT, bytes: new Uint8Array([1, 2, 3]), filename: 'game.png', mimeType: 'image/png' }));
    expect(mocks.store).toHaveBeenLastCalledWith({ name: 'nxt5-discord-production', consistency: 'strong' });
    expect(mocks.set).toHaveBeenCalledOnce();
  });
});
