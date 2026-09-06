import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import download from '../../netlify/functions/importer-download';

const RELEASE_BASE = 'https://github.com/AshaiiTV/NXT5/releases/download/nxt5-match-exporter-latest/';
const fetchRelease = vi.fn();
const asset = (name: string, url = `${RELEASE_BASE}${name}`) => ({ name, browser_download_url: url });
const request = (query = '', method = 'GET') => new Request(`https://nxt5.org/.netlify/functions/importer-download${query}`, { method });
const release = (assets: unknown[]) => fetchRelease.mockResolvedValue(new Response(JSON.stringify({ assets })));

beforeEach(() => {
  fetchRelease.mockReset();
  vi.stubGlobal('fetch', fetchRelease);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('importer download routing', () => {
  it('serves the latest stable Windows version numerically when old links omit parameters', async () => {
    release([
      asset('NXT5-Importer-Windows-0.2.8.exe'),
      asset('NXT5-Importer-Windows-0.2.9.exe'),
      asset('NXT5-Importer-Windows-0.2.11.exe'),
      asset('NXT5-Importer-Mac-arm64-0.3.0.zip'),
      asset('NXT5-Importer-Windows-1.0.0-beta.exe')
    ]);
    const result = await download(request());
    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe(`${RELEASE_BASE}NXT5-Importer-Windows-0.2.11.exe`);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchRelease.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchRelease.mock.calls[0][1].redirect).toBe('error');
  });

  it('matches an explicitly requested version exactly and never substitutes another release', async () => {
    release([asset('NXT5-Importer-Windows-0.2.80.exe'), asset('NXT5-Importer-Windows-0.3.0.exe')]);
    const result = await download(request('?version=0.2.8'));
    expect(result.status).toBe(404);
    expect(await result.json()).toEqual({ error: 'Aucun installateur Windows x64 disponible pour la version 0.2.8.' });
    expect(result.headers.has('Location')).toBe(false);
  });

  it.each(['x64', 'arm64'])('selects the requested %s Mac architecture even if another architecture has a newer release', async (arch) => {
    const otherArch = arch === 'x64' ? 'arm64' : 'x64';
    release([asset(`NXT5-Importer-Mac-${otherArch}-0.4.0.zip`), asset(`NXT5-Importer-Mac-${arch}-0.3.0.zip`)]);
    const result = await download(request(`?platform=mac&arch=${arch}`));
    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe(`${RELEASE_BASE}NXT5-Importer-Mac-${arch}-0.3.0.zip`);
  });

  it('preserves Intel compatibility for legacy Mac links and never substitutes Apple Silicon', async () => {
    release([asset('NXT5-Importer-Mac-arm64-0.3.0.zip'), asset('NXT5-Importer-Mac-x64-0.3.0.zip')]);
    const result = await download(request('?platform=mac'));
    expect(result.headers.get('Location')).toBe(`${RELEASE_BASE}NXT5-Importer-Mac-x64-0.3.0.zip`);
    release([asset('NXT5-Importer-Mac-arm64-0.3.0.zip')]);
    expect((await download(request('?platform=mac'))).status).toBe(404);
  });

  it('can serve legacy exporter assets, preferring the importer name at the same version', async () => {
    release([asset('NXT5-Match-Exporter-Windows-0.3.0.exe'), asset('NXT5-Importer-Windows-0.3.0.exe')]);
    expect((await download(request())).headers.get('Location')).toBe(`${RELEASE_BASE}NXT5-Importer-Windows-0.3.0.exe`);
    release([asset('NXT5-Match-Exporter-Windows-0.2.8.exe')]);
    expect((await download(request('?version=0.2.8'))).headers.get('Location')).toBe(`${RELEASE_BASE}NXT5-Match-Exporter-Windows-0.2.8.exe`);
  });

  it.each([
    '?platform=linux', '?platform=', '?arch=universal', '?arch=', '?platform=windows&arch=arm64',
    '?version=', '?version=latest', '?version=0.3', '?version=0.03.0', '?version=0.3.0-beta',
    '?version=0.3.0%20', '?version=0.3.0&version=0.2.8', '?platform=mac&platform=windows', '?arch=x64&arch=arm64'
  ])('rejects invalid or ambiguous parameters without contacting GitHub: %s', async (query) => {
    expect((await download(request(query))).status).toBe(400);
    expect(fetchRelease).not.toHaveBeenCalled();
  });

  it('rejects mutations and supports HEAD without a response body', async () => {
    const rejected = await download(request('', 'POST'));
    expect(rejected.status).toBe(405);
    expect(rejected.headers.get('Allow')).toBe('GET, HEAD');
    expect(fetchRelease).not.toHaveBeenCalled();
    release([asset('NXT5-Importer-Windows-0.3.0.exe')]);
    const head = await download(request('', 'HEAD'));
    expect(head.status).toBe(302);
    expect(await head.text()).toBe('');
    expect(await (await download(request('?platform=no', 'HEAD'))).text()).toBe('');
  });

  it.each([
    'https://evil.example/NXT5-Importer-Windows-0.3.0.exe',
    'https://github.com.evil.example/AshaiiTV/NXT5/releases/download/nxt5-match-exporter-latest/NXT5-Importer-Windows-0.3.0.exe',
    'https://github.com/another/repo/releases/download/nxt5-match-exporter-latest/NXT5-Importer-Windows-0.3.0.exe',
    `${RELEASE_BASE}NXT5-Importer-Windows-0.3.0.exe?redirect=https://evil.example`,
    `${RELEASE_BASE}NXT5-Importer-Windows-0.2.8.exe`,
    `${RELEASE_BASE.replace('https:', 'http:')}NXT5-Importer-Windows-0.3.0.exe`
  ])('refuses untrusted or mismatched download destinations: %s', async (url) => {
    release([asset('NXT5-Importer-Windows-0.3.0.exe', url)]);
    expect((await download(request())).status).toBe(404);
  });

  it('ignores unrelated, malformed, prerelease, and platform-mismatched assets', async () => {
    release([
      null, {}, { name: 42, browser_download_url: RELEASE_BASE },
      asset('Other-Importer-Windows-4.0.0.exe'), asset('NXT5-Importer-Windows-01.0.0.exe'),
      asset('NXT5-Importer-Windows-4.0.0.zip'), asset('NXT5-Importer-Mac-x64-4.0.0.exe'),
      asset('NXT5-Importer-Windows-4.0.0-rc.1.exe')
    ]);
    expect((await download(request())).status).toBe(404);
  });

  it.each([[404, 404], [403, 503], [429, 503], [500, 503]])('maps upstream %s to a useful %s response', async (upstream, expected) => {
    fetchRelease.mockResolvedValue(new Response('upstream failure', { status: upstream }));
    const result = await download(request());
    expect(result.status).toBe(expected);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(await result.text()).not.toContain('upstream failure');
  });

  it.each([null, {}, { assets: {} }])('rejects malformed release metadata: %j', async (payload) => {
    fetchRelease.mockResolvedValue(new Response(JSON.stringify(payload)));
    expect((await download(request())).status).toBe(502);
  });

  it('returns an upstream error for invalid JSON and network failures', async () => {
    fetchRelease.mockResolvedValue(new Response('not JSON'));
    expect((await download(request())).status).toBe(502);
    fetchRelease.mockRejectedValue(new Error('sensitive infrastructure detail'));
    const result = await download(request());
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain('sensitive');
  });

  it('bounds a stalled upstream request and cleans up its timeout', async () => {
    vi.useFakeTimers();
    fetchRelease.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = download(request());
    await vi.advanceTimersByTimeAsync(8000);
    expect((await pending).status).toBe(504);
    expect(vi.getTimerCount()).toBe(0);
  });
});
