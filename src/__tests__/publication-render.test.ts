import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { buildGamePublicationSnapshot } from '../../shared/publications/game-publication.js';
import { publicationFixture } from '../../shared/publications/fixtures.js';
import { renderGamePublicationCanvas } from '../../shared/publications/game-publication-canvas.js';
import { loadGamePublicationAssets } from '../../shared/publications/game-publication-assets.js';
import { renderGamePublicationPng } from '../../netlify/functions/_lib/publication-render';

const icon = createCanvas(32, 32);
icon.getContext('2d').fillRect(0, 0, 32, 32);
const iconBytes = icon.toBuffer('image/png');
let fetchSpy;
beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response(iconBytes, { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function traceCanvas() {
  const drawn: { text: string; x: number; y: number; width: number; align: string; color: string }[] = [];
  return {
    drawn,
    createCanvas(width, height) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const original = ctx.fillText.bind(ctx);
      vi.spyOn(ctx, 'fillText').mockImplementation((...args) => {
        drawn.push({ text: String(args[0]), x: args[1], y: args[2], width: ctx.measureText(String(args[0])).width, align: ctx.textAlign, color: String(ctx.fillStyle) });
        return original(...args);
      });
      return canvas;
    },
  };
}

describe('single game publication PNG for downloads and Discord', () => {
  it('encodes the complete standard PNG within the Discord attachment budget', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const before = JSON.stringify(snapshot);
    const first = await renderGamePublicationPng(snapshot);
    const second = await renderGamePublicationPng(snapshot, { includeHints: true });
    const factual = await renderGamePublicationPng(snapshot, { includeHints: false });
    expect(first.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(first.bytes.equals(factual.bytes)).toBe(true);
    expect(first.width).toBe(1440);
    expect(first.bytes.readUInt32BE(16)).toBe(first.width);
    expect(first.bytes.readUInt32BE(20)).toBe(first.height);
    expect(first.bytes.byteLength).toBeLessThan(3 * 1024 * 1024);
    expect(first.mimeType).toBe('image/png');
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it.each(['blue', 'red'])('renders identical pixels with the browser layout and icons on %s side', async side => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture({ side }));
    const server = await renderGamePublicationPng(snapshot);
    const browser = await renderGamePublicationCanvas(snapshot, {
      createCanvas, loadLogo: () => loadImage('public/assets/nxt5-wordmark.png'),
      loadAssets: data => loadGamePublicationAssets(data, async () => icon),
    });
    expect([server.width, server.height]).toEqual([browser.width, browser.height]);
    expect(server.bytes.equals(browser.canvas.toBuffer('image/png'))).toBe(true);
    const urls = fetchSpy.mock.calls.map(([url]) => url);
    expect(urls.some(url => url.includes('/img/champion/'))).toBe(true);
    expect(urls.some(url => url.includes('/img/item/'))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    for (const [url, options] of fetchSpy.mock.calls) {
      expect(url).toMatch(/^https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[\d.]+\/img\/(champion|item)\/[A-Za-z0-9]+\.png$/);
      expect(options.redirect).toBe('error');
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('falls back to the next icon source and tolerates unavailable assets', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    fetchSpy.mockImplementation(async url => url.includes('/16.16.1/') ? new Response(null, { status: 404 }) : new Response(iconBytes, { headers: { 'content-type': 'image/png' } }));
    const fallback = await renderGamePublicationPng(snapshot);
    expect(fetchSpy.mock.calls.some(([url]) => url.includes('/16.15.1/'))).toBe(true);
    fetchSpy.mockRejectedValue(new Error('Asset unavailable'));
    const missing = await renderGamePublicationPng(snapshot);
    expect([missing.width, missing.height]).toEqual([fallback.width, fallback.height]);
    expect(missing.bytes.equals(fallback.bytes)).toBe(false);
    expect(missing.bytes.byteLength).toBeLessThan(3 * 1024 * 1024);
  });

  it.each(['type', 'declared-size', 'streamed-size'])('ignores invalid icon responses (%s)', async failure => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    fetchSpy.mockImplementation(async () => new Response(failure === 'streamed-size' ? Buffer.alloc(2 * 1024 * 1024 + 1) : iconBytes, {
      headers: { 'content-type': failure === 'type' ? 'text/html' : 'image/png', ...(failure === 'declared-size' ? { 'content-length': String(2 * 1024 * 1024 + 1) } : {}) },
    }));
    const image = await renderGamePublicationPng(snapshot);
    fetchSpy.mockRejectedValue(new Error('Unavailable'));
    const plain = await renderGamePublicationPng(snapshot);
    expect(image.bytes.equals(plain.bytes)).toBe(true);
  });

  it('shows all ten players, spells and final statistics without review hints', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const before = JSON.stringify(snapshot);
    const trace = traceCanvas();
    await renderGamePublicationCanvas(snapshot, { createCanvas: trace.createCanvas, loadLogo: async () => null, includeHints: true });
    const text = trace.drawn.map(entry => entry.text).join(' ');
    for (const player of snapshot.participants) {
      expect(text).toContain(player.name);
      expect(text).toContain(player.champion);
      expect(text.replace(/\s/g, '')).toContain(`${player.kills}/${player.deaths}/${player.assists}`);
    }
    expect(text).toContain('Dégâts champions');
    expect(text).toContain('Participation');
    expect(text).toContain('Téléportation');
    expect(text).not.toMatch(/Lecture NXT5|Piste de review|setup reproductible|VOD|3006/);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('enriches the same rows with icons without changing facts or geometry', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const before = JSON.stringify(snapshot);
    const loadAssets = vi.fn(data => loadGamePublicationAssets(data, async () => icon));
    const plain = await renderGamePublicationCanvas(snapshot, { createCanvas, loadLogo: async () => null });
    const illustrated = await renderGamePublicationCanvas(snapshot, { createCanvas, loadLogo: async () => null, loadAssets });
    expect(loadAssets).toHaveBeenCalledExactlyOnceWith(snapshot);
    expect([illustrated.width, illustrated.height]).toEqual([plain.width, plain.height]);
    expect(illustrated.canvas.toBuffer('image/png').equals(plain.canvas.toBuffer('image/png'))).toBe(false);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('grows for long names and renders missing metrics within the attachment budget', async () => {
    const short = await renderGamePublicationPng(buildGamePublicationSnapshot(publicationFixture({ incomplete: true })));
    const long = await renderGamePublicationPng(buildGamePublicationSnapshot(publicationFixture({ longNames: true, timeline: false, incomplete: true })));
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.height).toBeLessThan(4000);
    expect(long.bytes.length).toBeGreaterThan(10000);
    expect(long.bytes.length).toBeLessThan(3 * 1024 * 1024);
  });
});
