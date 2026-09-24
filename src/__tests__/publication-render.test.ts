import { describe, expect, it, vi } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { buildGamePublicationSnapshot } from '../../shared/publications/game-publication.js';
import { publicationFixture } from '../../shared/publications/fixtures.js';
import { renderGamePublicationCanvas } from '../../shared/publications/game-publication-canvas.js';
import { renderDiscordPublicationCanvas } from '../../shared/publications/discord-publication-canvas.js';
import { renderGamePublicationPng } from '../../netlify/functions/_lib/publication-render';

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

async function traceDiscord(snapshot) {
  const trace = traceCanvas();
  const image = await renderDiscordPublicationCanvas(snapshot, { createCanvas: trace.createCanvas, loadLogo: async () => null });
  return { ...image, drawn: trace.drawn, text: trace.drawn.map((entry) => entry.text).join(' ') };
}

describe('compact Discord publication PNG', () => {
  it('encodes a deterministic, self-contained PNG within the Discord attachment budget', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const before = JSON.stringify(snapshot);
    const fetchSpy = vi.fn(() => { throw new Error('Publication rendering must use bundled assets only.'); });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const first = await renderGamePublicationPng(snapshot);
      const second = await renderGamePublicationPng(snapshot, { includeHints: true });
      const factual = await renderGamePublicationPng(snapshot, { includeHints: false });
      expect(first.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(first.bytes.equals(second.bytes)).toBe(true);
      expect(first.bytes.equals(factual.bytes)).toBe(true);
      expect(first.width).toBe(960);
      expect(first.height).toBeLessThan(1400);
      expect(first.bytes.readUInt32BE(16)).toBe(first.width);
      expect(first.bytes.readUInt32BE(20)).toBe(first.height);
      expect(first.bytes.byteLength).toBeLessThan(3 * 1024 * 1024);
      expect(first.mimeType).toBe('image/png');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(snapshot)).toBe(before);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows team essentials and five allied players without builds, spells, enemy rows or advice', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const { text, drawn } = await traceDiscord(snapshot);
    expect(text).toContain(snapshot.context.teamName);
    expect(text).toContain(snapshot.context.opponentName);
    expect(text).toContain(snapshot.context.duration);
    expect(text).toMatch(/Kills/i);
    expect(text).toMatch(/Or/i);
    expect(text).toMatch(/Tours/i);
    expect(text).toMatch(/Dragons/i);
    expect(text).toMatch(/Nashors/i);
    expect(text).toMatch(/Dégâts/i);
    expect(text).toMatch(/Participation|KP/i);
    for (const player of snapshot.participants.filter((row) => row.teamKey === 'ALLY')) {
      expect(text).toContain(player.name);
      expect(text).toContain(player.champion);
      expect(text.replace(/\s/g, '')).toContain(`${player.kills}/${player.deaths}/${player.assists}`);
    }
    for (const player of snapshot.participants.filter((row) => row.teamKey === 'ENEMY')) {
      expect(text).not.toContain(player.name);
      expect(drawn.map((entry) => entry.text)).not.toContain(player.champion);
    }
    expect(text).not.toMatch(/Lecture NXT5|Piste de review|setup reproductible|VOD|Téléportation|Sorts|Objets|3006|3031/);
  });

  it('keeps allied scores first on red side and colors victory independently of map side', async () => {
    const red = await traceDiscord(buildGamePublicationSnapshot(publicationFixture({ side: 'red' })));
    const blue = await traceDiscord(buildGamePublicationSnapshot(publicationFixture({ side: 'blue' })));
    const textAfter = (label) => red.drawn[red.drawn.findIndex((entry) => entry.text === label) + 1]?.text;
    expect(textAfter('Tours')).toBe('4 / 8');
    expect(textAfter('Dragons')).toBe('1 / 3');
    expect(textAfter('Nashors')).toBe('0 / 1');
    expect(red.text).toContain('24 — 18');
    expect(red.text).toContain('Côté rouge');
    const victory = red.drawn.find((entry) => entry.text === 'Victoire');
    expect(victory?.color).toBe(blue.drawn.find((entry) => entry.text === 'Victoire')?.color);
    expect(victory?.color).not.toBe(red.drawn.find((entry) => entry.text === 'Côté rouge')?.color);
  });

  it.each(['damage', 'participation'])('distinguishes a real zero from absent player %s', async (metric) => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture({ incomplete: true, timeline: false }));
    const player = snapshot.participants.find((row) => row.teamKey === 'ALLY');
    player[metric] = 0;
    const zero = await traceDiscord(snapshot);
    player[metric] = null;
    const missing = await traceDiscord(snapshot);
    const removed = zero.drawn.map((entry) => entry.text).filter((value, index) => value !== missing.drawn[index]?.text);
    const added = missing.drawn.map((entry) => entry.text).filter((value, index) => value !== zero.drawn[index]?.text);
    expect(removed.join(' ')).toMatch(/0/);
    expect(added.join(' ')).toContain('—');
    expect(missing.text).not.toMatch(/NaN|undefined|null|Infinity/);
  });

  it('wraps maximum-length identities while keeping all text inside a compact image', async () => {
    const fixture = publicationFixture({ longNames: true, incomplete: true, timeline: false });
    const realistic = await traceDiscord(buildGamePublicationSnapshot(fixture));
    expect(realistic.height).toBeLessThan(2200);
    fixture.team.name = 'Équipe au nom extrêmement long '.repeat(8);
    fixture.match.opponent = 'Adversaires au nom particulièrement long '.repeat(8);
    fixture.match.participants[0].player_name = 'JoueurAuNomSansEspace'.repeat(12);
    fixture.match.participants[1].player_name = 'Joueur au nom très long '.repeat(10);
    const snapshot = buildGamePublicationSnapshot(fixture);
    const image = await traceDiscord(snapshot);
    expect(image.height).toBeLessThan(2800);
    expect(image.canvas.toBuffer('image/png').byteLength).toBeLessThan(3 * 1024 * 1024);
    expect(image.text).not.toMatch(/NaN|undefined|null|Infinity/);
    for (const name of [snapshot.context.teamName, snapshot.context.opponentName, ...snapshot.participants.filter((row) => row.teamKey === 'ALLY').map((row) => row.name)]) {
      expect(image.text.replace(/\s/g, '')).toContain(name.replace(/\s/g, ''));
    }
    for (const drawn of image.drawn) {
      const left = drawn.x - (drawn.align === 'right' || drawn.align === 'end' ? drawn.width : drawn.align === 'center' ? drawn.width / 2 : 0);
      expect(left, drawn.text).toBeGreaterThanOrEqual(0);
      expect(left + drawn.width, drawn.text).toBeLessThanOrEqual(image.width + 1);
      expect(drawn.y, drawn.text).toBeGreaterThan(0);
      expect(drawn.y, drawn.text).toBeLessThan(image.height);
    }
  });
});

describe('full browser publication PNG', () => {
  it('remains available explicitly on the server with the full browser geometry', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const browser = await renderGamePublicationCanvas(snapshot, { createCanvas, loadLogo: async () => null });
    const server = await renderGamePublicationPng(snapshot, { layout: 'full' });
    const discord = await renderGamePublicationPng(snapshot);
    expect([server.width, server.height]).toEqual([browser.width, browser.height]);
    expect(server.width).toBe(1440);
    expect(discord.width * discord.height).toBeLessThan(server.width * server.height * 0.4);
  });
  it('always draws factual PNGs even when legacy payloads request review hints', async () => {
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
    await renderGamePublicationCanvas(snapshot, { createCanvas: tracedCanvas, loadLogo: async () => null, includeHints: false });
    expect(drawnText.join(' ')).not.toMatch(/Lecture NXT5|Piste de review|setup reproductible|VOD/);
    expect(drawnText.join(' ')).toContain('Kills');
    expect(drawnText.join(' ')).toContain('Dégâts champions');
    expect(drawnText.join(' ')).toContain('Participation');
    expect(drawnText.join(' ')).toContain('Téléportation');
    expect(drawnText.join(' ')).not.toContain('3006');
    await renderGamePublicationCanvas(snapshot, { createCanvas: tracedCanvas, loadLogo: async () => null, includeHints: true });
    expect(drawnText.join(' ')).not.toMatch(/Lecture NXT5|Piste de review|setup reproductible|VOD/);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it('enriches the same rows with browser-supplied icons without changing facts or geometry', async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const before = JSON.stringify(snapshot);
    const icon = createCanvas(32, 32);
    icon.getContext('2d').fillRect(0, 0, 32, 32);
    const loadAssets = vi.fn(async () => ({
      champions: new Map(snapshot.participants.map((row) => [row.champion, icon])),
      items: new Map(snapshot.participants.flatMap((row) => [...row.items, row.trinket]).filter(Boolean).map((id) => [id, icon])),
    }));
    const plain = await renderGamePublicationCanvas(snapshot, { createCanvas, loadLogo: async () => null });
    const illustrated = await renderGamePublicationCanvas(snapshot, { createCanvas, loadLogo: async () => null, loadAssets });
    expect(loadAssets).toHaveBeenCalledExactlyOnceWith(snapshot);
    expect([illustrated.width, illustrated.height]).toEqual([plain.width, plain.height]);
    expect(illustrated.canvas.toBuffer('image/png').equals(plain.canvas.toBuffer('image/png'))).toBe(false);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it('grows for long names, renders absent metrics and tolerates a missing optional logo', async () => {
    const short = await renderGamePublicationCanvas(buildGamePublicationSnapshot(publicationFixture({ incomplete: true })), { createCanvas, loadLogo: async () => null });
    const long = await renderGamePublicationCanvas(buildGamePublicationSnapshot(publicationFixture({ longNames: true, timeline: false, incomplete: true })), { createCanvas, loadLogo: async () => null });
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.height).toBeLessThan(4000);
    expect(long.canvas.toBuffer('image/png').length).toBeGreaterThan(10000);
  });
});
