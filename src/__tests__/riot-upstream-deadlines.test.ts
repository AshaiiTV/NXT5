import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RIOT_UPSTREAM_TIMEOUT_MS } from '../../shared/riot-sync-policy.js';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv('RIOT_API_KEY', 'local-test-key');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function blocked(signal: AbortSignal) {
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

it.each(['headers', 'body'])('bounds Riot %s latency, including response body consumption', async stage => {
  let upstreamSignal!: AbortSignal;
  const fetchMock = vi.fn(async (_url, { signal }) => {
    upstreamSignal = signal;
    if (stage === 'headers') return blocked(signal);
    return { ok: true, status: 200, headers: new Headers(), json: () => blocked(signal) };
  });
  vi.stubGlobal('fetch', fetchMock);
  const { fetchRiotMatch } = await import('../../netlify/functions/_lib/riot');
  const pending = fetchRiotMatch('EUW1_1');
  const expectation = expect(pending).rejects.toMatchObject({ status: 504, code: 'RIOT_UPSTREAM_TIMEOUT' });
  await vi.advanceTimersByTimeAsync(RIOT_UPSTREAM_TIMEOUT_MS);
  await expectation;
  expect(upstreamSignal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['versions', 'champions'])('also bounds Data Dragon %s body reads', async stage => {
  const fetchMock = vi.fn(async (_url, { signal }) => ({
    ok: true,
    json: () => stage === 'champions' && fetchMock.mock.calls.length === 1
      ? Promise.resolve(['16.1.1']) : blocked(signal)
  }));
  vi.stubGlobal('fetch', fetchMock);
  const { getChampionDataMap } = await import('../../netlify/functions/_lib/riot');
  const expectation = expect(getChampionDataMap()).rejects.toMatchObject({ code: 'RIOT_UPSTREAM_TIMEOUT' });
  await vi.advanceTimersByTimeAsync(RIOT_UPSTREAM_TIMEOUT_MS);
  await expectation;
  expect(fetchMock).toHaveBeenCalledTimes(stage === 'versions' ? 1 : 2);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['match', 'timeline', 'account', 'ids', 'matchById', 'champions'])('propagates cancellation through %s helper', async helper => {
  const controller = new AbortController();
  const reason = Object.assign(new Error('Cancelled'), { code: 'CANCELLED_TEST' });
  const fetchMock = vi.fn((_url, { signal }) => blocked(signal));
  vi.stubGlobal('fetch', fetchMock);
  const riot = await import('../../netlify/functions/_lib/riot');
  const options = { signal: controller.signal };
  const calls = {
    match: () => riot.fetchRiotMatch('EUW1_1', options),
    timeline: () => riot.fetchRiotMatchTimeline('EUW1_1', options),
    account: () => riot.fetchAccountByRiotId('One#EUW', 'EUW1', options),
    ids: () => riot.fetchMatchIdsByPuuid('puuid', 'EUW1', options),
    matchById: () => riot.fetchRiotMatchById('EUW1_1', 'EUW1', options),
    champions: () => riot.getChampionDataMap(options)
  };
  const expectation = expect(calls[helper]()).rejects.toBe(reason);
  controller.abort(reason);
  await expectation;
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not start an upstream request for an already aborted caller', async () => {
  const controller = new AbortController();
  controller.abort(new Error('Stopped'));
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const { fetchRiotMatch } = await import('../../netlify/functions/_lib/riot');
  await expect(fetchRiotMatch('EUW1_1', { signal: controller.signal })).rejects.toThrow('Stopped');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('preserves Riot diagnostics and removes the timer after a successful request', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ status: { message: 'Limited' } }, { status: 429, headers: { 'retry-after': '120' } }))
    .mockResolvedValueOnce(Response.json({ metadata: { matchId: 'EUW1_1' } })));
  const { fetchRiotMatch } = await import('../../netlify/functions/_lib/riot');
  await expect(fetchRiotMatch('EUW1_1')).rejects.toMatchObject({ status: 429, code: 'RIOT_RATE_LIMIT', retryAfter: 120 });
  await expect(fetchRiotMatch('EUW1_1')).resolves.toEqual({ metadata: { matchId: 'EUW1_1' } });
  expect(vi.getTimerCount()).toBe(0);
});
