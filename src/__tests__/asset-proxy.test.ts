import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { config } from '../../netlify/functions/asset-proxy';
import { draftSpotlight, spotlightWidths } from '../../shared/draft-spotlight.js';
import champions from '../../shared/riot-champion-ids.json';

const url = 'https://ddragon.leagueoflegends.com/cdn/16.18.1/data/fr_FR/runesReforged.json';
const imageUrl = 'https://raw.communitydragon.org/latest/game/assets/ux/announcements/baron_circle.png';
const request = (target = url, method = 'GET') => handler(new Request(`https://nxt5.test/.netlify/functions/asset-proxy?url=${encodeURIComponent(target)}`, { method }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('champion voices', () => {
  const voice = (name: string, lang: string, kind: string) => handler(new Request(
    'https://nxt5.test/.netlify/functions/asset-proxy?' + new URLSearchParams({ voice: name, lang, kind })
  ));

  it.each([
    ['MonkeyKing', 'fr', 'ban', 'fr_fr/v1/champion-ban-vo/62.ogg'],
    ['Leblanc', 'en', 'pick', 'default/v1/champion-choose-vo/7.ogg'],
    ['Nunu', 'es', 'pick', 'es_es/v1/champion-choose-vo/20.ogg'],
  ])('serves the localized %s line for %s/%s', async (name, lang, kind, path) => {
    const fetch = vi.fn().mockResolvedValue(new Response('OggS', { headers: { 'Content-Type': 'audio/ogg' } }));
    vi.stubGlobal('fetch', fetch);
    const result = await voice(name, lang, kind);
    expect(fetch).toHaveBeenCalledWith('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/' + path,
      expect.objectContaining({ redirect: 'manual' }));
    expect(result.headers.get('content-type')).toBe('audio/ogg');
    expect(await result.text()).toBe('OggS');
  });

  it('limits voices to the roster, locale, action, upstream type and clip size', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const args of [['Other', 'fr', 'ban'], ['Jinx', 'de', 'pick'], ['Jinx', 'en', 'preview']]) {
      expect((await voice(args[0], args[1], args[2])).status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValueOnce(new Response('page', { headers: { 'content-type': 'text/html' } }));
    expect((await voice('Jinx', 'fr', 'ban')).status).toBe(415);
    fetch.mockResolvedValueOnce(new Response(new Uint8Array(256 * 1024 + 1), { headers: { 'content-type': 'audio/ogg' } }));
    expect((await voice('Jinx', 'fr', 'ban')).status).toBe(413);
    fetch.mockResolvedValueOnce(new Response('OggS', { headers: { 'content-type': 'audio/ogg' } }));
    expect((await request(imageUrl)).status).toBe(415);
  });
});

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

describe('draft spotlight art', () => {
  const spotlight = (champion: string, width: number) => handler(new Request(
    `https://nxt5.test/.netlify/functions/asset-proxy?spotlight=${encodeURIComponent(champion)}&w=${width}`,
  ));

  it('has a usable face anchor and bounded source widths for every draftable champion', () => {
    for (const [,champion] of champions) {
      const art = draftSpotlight(champion);
      expect(art, String(champion)).toBeTruthy();
      expect(art.x).toBeGreaterThan(0);
      expect(art.x).toBeLessThan(1);
      expect(art.y).toBeGreaterThan(0);
      expect(art.y).toBeLessThan(1);
      const widths = spotlightWidths(art);
      expect(widths).toEqual([...new Set(widths)].sort((a,b) => a-b));
      expect(widths.at(-1)).toBe(Math.min(3840, art.width));
    }
  });

  it('uses Riot’s wider composition when an edge-framed original reaches its native width', () => {
    const normal = draftSpotlight('Taric', 750);
    const panoramic = draftSpotlight('Taric', 2200);
    expect(normal.asset).toContain('universe/');
    expect(panoramic).toMatchObject({ centered: true, asset: 'centered/Taric_0.jpg', width: 1280, height: 720 });
    expect(spotlightWidths(panoramic)).toEqual([1280]);
    expect(draftSpotlight('Qiyana', 2200).width).toBe(4000);
  });

  it('serves only known originals at their available sizes', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('illustration', { headers: { 'content-type': 'image/webp' } }));
    vi.stubGlobal('fetch', fetch);
    expect((await spotlight('Syndra', 3840)).status).toBe(400);
    expect((await spotlight('not-in-the-roster', 768)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    const response = await spotlight('Qiyana', 3840);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    const source = new URL(fetch.mock.calls[0][0]);
    expect(source.origin).toBe('https://cmsassets.rgpub.io');
    expect(source.pathname).toMatch(/\/sanity\/images\/dsfx7636\/universe(?:_live)?\/[a-f0-9]+-4000x\d+\.jpg$/);
    expect(source.searchParams.get('w')).toBe('3840');
  });
});
