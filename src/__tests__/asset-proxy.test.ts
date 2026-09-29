import { afterEach, expect, it, vi } from 'vitest';
import { handler } from '../../netlify/functions/asset-proxy';
const url = 'https://ddragon.leagueoflegends.com/cdn/16.18.1/data/fr_FR/runesReforged.json';
const request = (target = url) => handler({ queryStringParameters: { url: target } } as any, {} as any, () => {}) as Promise<any>;
afterEach(() => vi.unstubAllGlobals());

it('E1: proxies the single rune catalogue with cache, timeout and no redirects', async () => {
  const body = JSON.stringify([{ id: 8200, name: 'Sorcellerie' }]);
  const fetch = vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8' } }));
  vi.stubGlobal('fetch', fetch);
  const result = await request();
  expect(result).toMatchObject({ statusCode: 200, body, isBase64Encoded: false });
  expect(result.headers['Cache-Control']).toContain('max-age=86400');
  expect(result.headers['Content-Type']).toContain('application/json');
  expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
});

it.each([
  url.replace('ddragon.leagueoflegends.com', 'raw.communitydragon.org'),
  url.replace('runesReforged', 'champion'), url.replace('fr_FR', 'en_US'),
  url.replace('16.18.1', 'latest'), url + '?anything=1', url + '#fragment',
  url.replace('https://', 'http://'), url.replace('https://', 'https://user:pass@'),
  url.replace('.com/', '.com:8443/'),
])('E1: refuses an unapproved JSON URL before fetching (%s)', async target => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect((await request(target)).statusCode).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['{}', 'invalid JSON'])('E1: rejects malformed catalogues without caching (%s)', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'application/json' } })));
  expect(await request()).toMatchObject({ statusCode: 502, headers: { 'Cache-Control': 'no-store' } });
});

it.each(['image/svg+xml', 'text/html'])('E1: refuses non-JSON catalogue content (%s)', async type => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { headers: { 'content-type': type } })));
  expect((await request()).statusCode).toBe(415);
});

it.each([true, false])('E1: bounds size with or without Content-Length (%s)', async declared => {
  const cancel = vi.fn();
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(512 * 1024 + 1)); }, cancel });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'application/json', ...(declared ? { 'content-length': String(512 * 1024 + 1) } : {}) } })));
  expect(await request()).toMatchObject({ statusCode: 413, headers: { 'Cache-Control': 'no-store' } });
  expect(cancel).toHaveBeenCalledOnce();
});

it('E1: retains raster image support and refuses JSON outside the exception', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('png', { headers: { 'content-type': 'image/png' } }))
    .mockResolvedValueOnce(new Response('[]', { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  expect(await request('https://raw.communitydragon.org/image.png')).toMatchObject({ statusCode: 200, isBase64Encoded: true });
  expect((await request('https://ddragon.leagueoflegends.com/anything')).statusCode).toBe(415);
});
