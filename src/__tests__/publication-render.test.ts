import { describe, expect, it, vi } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { buildGamePublicationSnapshot } from '../../shared/publications/game-publication.js';
import { publicationFixture } from '../../shared/publications/fixtures.js';
import { renderGamePublicationCanvas } from '../../shared/publications/game-publication-canvas.js';
import { renderGamePublicationPng } from '../../netlify/functions/_lib/publication-render';

describe('server publication PNG', () => {
  it('encodes a real deterministic PNG from exactly one snapshot without a DOM or HTTP', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const first = await renderGamePublicationPng(snapshot);
    const second = await renderGamePublicationPng(snapshot);
    expect(first.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(first.width).toBe(1200);
    expect(first.bytes.readUInt32BE(16)).toBe(first.width);
    expect(first.bytes.readUInt32BE(20)).toBe(first.height);
    expect(first.bytes.byteLength).toBeLessThan(8 * 1024 * 1024);
    expect(first.mimeType).toBe('image/png');
  });
  it('excludes all observations and review hints when the destination requests facts only', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const before = JSON.stringify(snapshot);
    const drawnText: string[] = [];
    const tracedCanvas = (width, height) => {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const original = ctx.fillText.bind(ctx);
      vi.spyOn(ctx, 'fillText').mockImplementation((...args) => { drawnText.push(String(args[0])); return original(...args); });
      return canvas;
    };
    const compact = await renderGamePublicationCanvas(snapshot, { createCanvas: tracedCanvas, loadLogo: async () => null, includeHints: false });
    expect(drawnText.join(' ')).not.toMatch(/Lecture NXT5|Piste de review|setup reproductible|VOD/);
    expect(drawnText.join(' ')).toContain('Kills');
    const native = await renderGamePublicationPng(snapshot, { includeHints: false });
    const complete = await renderGamePublicationPng(snapshot);
    expect(native.height).toBe(compact.height);
    expect(native.height).toBeLessThan(complete.height);
    expect(native.bytes.equals(complete.bytes)).toBe(false);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it('grows for long names, renders absent metrics and tolerates a missing optional logo', async () => {
    const short = await renderGamePublicationCanvas(buildGamePublicationSnapshot(publicationFixture()), { createCanvas, loadLogo: async () => null });
    const long = await renderGamePublicationCanvas(buildGamePublicationSnapshot(publicationFixture({ longNames: true, timeline: false, incomplete: true })), { createCanvas, loadLogo: async () => null });
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.height).toBeLessThan(4000);
    expect(long.canvas.toBuffer('image/png').length).toBeGreaterThan(10000);
  });
});
