import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const riot = vi.hoisted(() => ({ fetchRiotMatch: vi.fn(), fetchRiotMatchTimeline: vi.fn() }));
const limits = vi.hoisted(() => ({ assertRateLimit: vi.fn(), assertSubjectRateLimit: vi.fn() }));

vi.mock('../../netlify/functions/_lib/riot', () => riot);
vi.mock('../../netlify/functions/_lib/rate-limit', () => limits);

const URL_BASE = 'https://nxt5.test/.netlify/functions/riot-match-export';
const notFound = () => Object.assign(new Error('introuvable'), { status: 404 });

async function call(query: string, init: RequestInit = {}) {
  const { default: handler } = await import('../../netlify/functions/riot-match-export');
  const response = await handler(new Request(`${URL_BASE}?${query}`, init));
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  vi.resetModules();
  riot.fetchRiotMatch.mockReset();
  riot.fetchRiotMatchTimeline.mockReset().mockResolvedValue({ info: { frames: [] } });
  limits.assertRateLimit.mockReset().mockResolvedValue(undefined);
  limits.assertSubjectRateLimit.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

it('charges every Riot lookup of a regional fallback to the IP and global budgets', async () => {
  riot.fetchRiotMatch.mockRejectedValueOnce(notFound()).mockRejectedValueOnce(notFound()).mockResolvedValue({ info: {} });
  const { status, body } = await call('gameId=7123456789&fallback=1');
  expect(status).toBe(200);
  expect(body.gameId).toBe('TR1_7123456789');
  const lookups = limits.assertRateLimit.mock.calls.filter(([, endpoint]) => endpoint === 'riot-match-export-lookup');
  expect(lookups).toHaveLength(3);
  expect(limits.assertSubjectRateLimit).toHaveBeenCalledTimes(3);
  expect(limits.assertSubjectRateLimit).toHaveBeenCalledWith('riot-match-export-global', 'riot-api', { limit: 1500, windowSeconds: 3600 });
});

it('stops before calling Riot once the platform-wide budget is spent', async () => {
  vi.stubEnv('RIOT_EXPORT_HOURLY_LIMIT', '40');
  limits.assertSubjectRateLimit.mockRejectedValue(Object.assign(new Error('Trop de tentatives.'), { status: 429, retryAfter: 120 }));
  const { status, body } = await call('gameId=EUW1_7123456789');
  expect(status).toBe(429);
  expect(body.code).toBe('NXT5_EXPORT_BUSY');
  expect(limits.assertSubjectRateLimit).toHaveBeenCalledWith('riot-match-export-global', 'riot-api', { limit: 40, windowSeconds: 3600 });
  expect(riot.fetchRiotMatch).not.toHaveBeenCalled();
});

it('rejects a configured export token passed in the query string', async () => {
  vi.stubEnv('RIOT_EXPORT_TOKEN', 'secret-token');
  const viaQuery = await call('gameId=EUW1_1&token=secret-token');
  expect(viaQuery.status).toBe(401);
  expect(viaQuery.body.error).toBe('Export Riot non autorisé.');
  riot.fetchRiotMatch.mockResolvedValue({ info: {} });
  const viaHeader = await call('gameId=EUW1_1', { headers: { 'x-nxt5-export-token': 'secret-token' } });
  expect(viaHeader.status).toBe(200);
});

it('validates the Game ID before spending any Riot budget', async () => {
  const { status } = await call('gameId=not-an-id');
  expect(status).toBe(400);
  expect(limits.assertSubjectRateLimit).not.toHaveBeenCalled();
  expect(riot.fetchRiotMatch).not.toHaveBeenCalled();
});
