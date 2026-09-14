import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../netlify/functions/asset-proxy';

const imageUrl = 'https://ddragon.leagueoflegends.com/cdn/image.png';
const request = (url = imageUrl, method = 'GET') => new Request(`https://nxt5.test/.netlify/functions/asset-proxy?url=${encodeURIComponent(url)}`, { method });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('bounded image proxy', () => {
  it.each(['http://ddragon.leagueoflegends.com/image.png', 'https://outside.test/image.png', 'https://user:pass@ddragon.leagueoflegends.com/image.png', 'https://ddragon.leagueoflegends.com:8443/image.png', 'https://raw.githubusercontent.com/repo/file.html', 'invalid'])('blocks %s before fetching', async url => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await handler(request(url))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects mutation methods', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await handler(request(imageUrl, 'POST'));
    expect(result.status).toBe(405);
    expect(result.headers.get('allow')).toBe('GET');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not follow a redirect to an untrusted host', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetch);
    const result = await handler(request());
    expect(result.status).toBe(502);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].redirect).toBe('manual');
    expect(await result.text()).not.toContain('127.0.0.1');
  });

  it('returns allowed images as binary with correct headers', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png' } })));
    const result = await handler(request());
    expect(result.status).toBe(200);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(bytes);
    expect(result.headers.get('content-type')).toBe('image/png');
    expect(result.headers.get('cache-control')).toContain('max-age=86400');
  });

  it('stops streaming at 2 MB even without Content-Length', async () => {
    let reads = 0;
    const cancel = vi.fn();
    const chunks = [new Uint8Array(2 * 1024 * 1024), new Uint8Array(1), new Uint8Array(10)];
    const body = new ReadableStream({ pull(controller) { controller.enqueue(chunks[reads++]); }, cancel }, { highWaterMark: 0 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'image/png' } })));
    expect((await handler(request())).status).toBe(413);
    expect(reads).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('bounds slow requests and hides infrastructure errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('private upstream details'))))));
    const pending = handler(request());
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect(result.status).toBe(504);
    expect(await result.text()).toBe('Asset unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects active content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })));
    expect((await handler(request())).status).toBe(415);
  });
});
