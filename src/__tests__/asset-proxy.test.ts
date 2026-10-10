import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { config } from '../../netlify/functions/asset-proxy';

const url = 'https://ddragon.leagueoflegends.com/cdn/16.18.1/data/fr_FR/runesReforged.json';
const imageUrl = 'https://raw.communitydragon.org/latest/game/assets/ux/announcements/baron_circle.png';
const request = (target = url, method = 'GET') => handler(new Request(`https://nxt5.test/.netlify/functions/asset-proxy?url=${encodeURIComponent(target)}`, { method }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('E1: proxies the single rune catalogue with cache, timeout and no redirects', async () => {
  const body = JSON.stringify([{ id: 8200, name: 'Sorcellerie' }]);
  const fetch = vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8' } }));
  vi.stubGlobal('fetch', fetch);
  const result = await request();
  expect(result.status).toBe(200);
  expect(await result.text()).toBe(body);
  expect(result.headers.get('cache-control')).toContain('max-age=86400');
  expect(result.headers.get('content-type')).toContain('application/json');
  expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
});

it.each([
  url.replace('ddragon.leagueoflegends.com', 'raw.communitydragon.org'),
  url.replace('runesReforged', 'champion'), url.replace('fr_FR', 'de_DE'),
  url.replace('16.18.1', 'latest'), url + '?anything=1', url + '#fragment',
  url.replace('https://', 'http://'), url.replace('https://', 'https://user:pass@'),
  url.replace('.com/', '.com:8443/'),
])('E1: refuses an unapproved JSON URL before fetching (%s)', async target => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect((await request(target)).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['en_US', 'es_ES'])('proxies the supported %s rune catalogue without widening the JSON exception', async locale => {
  const target = url.replace('fr_FR', locale);
  const fetch = vi.fn().mockResolvedValue(new Response('[]', { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  expect((await request(target)).status).toBe(200);
  expect(fetch).toHaveBeenCalledWith(target, expect.objectContaining({ redirect: 'error' }));
});

it.each(['{}', 'invalid JSON'])('E1: rejects malformed catalogues without caching (%s)', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'application/json' } })));
  const result = await request();
  expect(result.status).toBe(502);
  expect(result.headers.get('cache-control')).toBe('no-store');
});

it.each(['image/svg+xml', 'text/html'])('E1: refuses non-JSON catalogue content (%s)', async type => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { headers: { 'content-type': type } })));
  expect((await request()).status).toBe(415);
});

it.each([true, false])('E1: bounds size with or without Content-Length (%s)', async declared => {
  const cancel = vi.fn();
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(512 * 1024 + 1)); }, cancel });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'application/json', ...(declared ? { 'content-length': String(512 * 1024 + 1) } : {}) } })));
  const result = await request();
  expect(result.status).toBe(413);
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(cancel).toHaveBeenCalledOnce();
});

it('E1: retains raster image support and refuses JSON outside the exception', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('png', { headers: { 'content-type': 'image/png' } }))
    .mockResolvedValueOnce(new Response('[]', { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const image = await request('https://raw.communitydragon.org/image.png');
  expect(image.status).toBe(200);
  expect(await image.text()).toBe('png');
  expect((await request('https://ddragon.leagueoflegends.com/anything')).status).toBe(415);
});

// Régression du commit 76dbb10 (branche feat/pricing-validation) : fonction en
// signature Request/Response, sans redirection suivie et avec un délai maximal.
describe('bounded image proxy', () => {
  it('uses the Request/Response signature restricted to GET', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(config).toEqual({ method: 'GET' });
    const result = await request(imageUrl, 'POST');
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(405);
    expect(result.headers.get('allow')).toBe('GET');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    'http://ddragon.leagueoflegends.com/image.png', 'https://outside.test/image.png',
    'https://user:pass@ddragon.leagueoflegends.com/image.png', 'https://ddragon.leagueoflegends.com:8443/image.png',
    'https://raw.githubusercontent.com/repo/file.html', 'invalid',
  ])('blocks %s before fetching', async target => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await request(target)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not follow a redirect out of the allowed hosts', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetch);
    const result = await request(imageUrl);
    expect(result.status).toBe(502);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(imageUrl, expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }));
    expect(await result.text()).not.toContain('127.0.0.1');
  });

  it('returns allowed images as binary with cache headers', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png' } })));
    const result = await request(imageUrl);
    expect(result.status).toBe(200);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(bytes);
    expect(result.headers.get('content-type')).toBe('image/png');
    expect(result.headers.get('cache-control')).toContain('max-age=86400');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('keeps a missing upstream image as 404 and hides other upstream statuses', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('gone', { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(new Response('internal trace', { status: 500, statusText: 'Upstream exploded' })));
    const missing = await request(imageUrl);
    const failed = await request(imageUrl);
    expect(missing.status).toBe(404);
    expect(failed.status).toBe(502);
    expect(await failed.text()).toBe('Asset unavailable');
  });

  it('stops streaming at 2 MB even without Content-Length', async () => {
    let reads = 0;
    const cancel = vi.fn();
    const chunks = [new Uint8Array(2 * 1024 * 1024), new Uint8Array(1), new Uint8Array(10)];
    const body = new ReadableStream({ pull(controller) { controller.enqueue(chunks[reads++]); }, cancel }, { highWaterMark: 0 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'image/png' } })));
    expect((await request(imageUrl)).status).toBe(413);
    expect(reads).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('bounds slow upstreams at 10 s and hides infrastructure errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('private upstream details'))))));
    const pending = request(imageUrl);
    await vi.advanceTimersByTimeAsync(9_999);
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(result.status).toBe(504);
    expect(await result.text()).toBe('Asset unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds the rune catalogue at 4 s', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout'))))));
    const pending = request(url);
    await vi.advanceTimersByTimeAsync(4000);
    expect((await pending).status).toBe(504);
  });

  it('hides network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND internal.host')));
    const result = await request(imageUrl);
    expect(result.status).toBe(502);
    expect(await result.text()).toBe('Asset unavailable');
  });

  it('rejects active content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })));
    expect((await request(imageUrl)).status).toBe(415);
  });
});
