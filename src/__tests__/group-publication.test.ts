import { describe, expect, it, vi } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { publicationFixture } from '../../shared/publications/fixtures.js';
import { buildGroupPublicationSnapshot } from '../../shared/publications/group-publication.js';
import { GROUP_PUBLICATION_PNG_MAX_HEIGHT, renderGroupPublicationCanvas } from '../../shared/publications/group-publication-canvas.js';
import { renderGroupPublicationPng } from '../../netlify/functions/_lib/publication-render';

function fixture(count = 3) {
  const seed = publicationFixture();
  const matches = Array.from({ length: count }, (_, index) => {
    const match = structuredClone(seed.match);
    match.id = `game-${index + 1}`;
    match.opponent = `Adversaires exemple ${index + 1}`;
    match.result = ['Victoire', 'Défaite', 'Résultat inconnu'][index % 3];
    match.raw.info.gameStartTimestamp += index * 86400000;
    return match;
  });
  return { team: seed.team, archive: { id: 'group-example', team_id: seed.team.id, name: 'Exemple fictif · Scrims de septembre', description: 'Groupe de démonstration', match_ids: matches.map((match) => match.id) }, matches, categories: seed.categories, sourceRevision: 'example-1' };
}

async function trace(snapshot) {
  const drawn: { text: string; x: number; y: number; width: number; align: string }[] = [];
  const output = await renderGroupPublicationCanvas(snapshot, {
    createCanvas(width, height) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const original = ctx.fillText.bind(ctx);
      vi.spyOn(ctx, 'fillText').mockImplementation((...args) => {
        drawn.push({ text: String(args[0]), x: args[1], y: args[2], width: ctx.measureText(String(args[0])).width, align: ctx.textAlign });
        return original(...args);
      });
      return canvas;
    },
    loadLogo: async () => null,
  });
  return { ...output, drawn, text: drawn.map((entry) => entry.text).join(' ') };
}

describe('factual Discord group publication', () => {
  it('preserves archive order and counts only known results in the win rate', () => {
    const input = fixture();
    input.matches.reverse();
    const snapshot = buildGroupPublicationSnapshot(input);
    expect(snapshot).toMatchObject({ schemaVersion: 1, kind: 'group', entityId: input.archive.id, sourceRevision: 'example-1', facts: { games: 3, wins: 1, losses: 1, unknown: 1, knownResults: 2, winRate: 50, datedGames: 3 } });
    expect(snapshot.games.map((game) => game.entityId)).toEqual(input.archive.match_ids);
    expect(snapshot.games[0].facts.kills).toMatchObject({ ally: 24, enemy: 18 });
    expect(snapshot.facts.periodStart).toBe(snapshot.games[0].playedAt);
    expect(snapshot.facts.periodEnd).toBe(snapshot.games[2].playedAt);
    for (const match of input.matches) match.result = '';
    expect(buildGroupPublicationSnapshot(input).facts.winRate).toBeNull();
  });

  it('keeps absent totals and dates absent, measured zeroes intact, and excludes private data', () => {
    const input = fixture(1);
    const match = input.matches[0];
    match.raw.info.gameStartTimestamp = null;
    Object.assign(match, { notes: 'PRIVATE_GAME_NOTE', created_at: '2026-09-24T10:00:00Z' });
    Object.assign(input.archive, { private_notes: 'PRIVATE_ARCHIVE_NOTE', created_by: 'PRIVATE_OWNER' });
    Object.assign(match.raw, { notes: 'PRIVATE_RAW_NOTE' });
    match.participants = match.participants.slice(0, 8);
    match.participants.filter((row) => row.team_key === 'ALLY').forEach((row) => { row.kills = 0; });
    const snapshot = buildGroupPublicationSnapshot(input);
    expect(snapshot.games[0].facts.kills.ally).toBe(0);
    expect(snapshot.games[0].facts.kills.enemy).toBeNull();
    expect(snapshot.games[0].playedAt).toBeNull();
    expect(snapshot.facts).toMatchObject({ datedGames: 0, periodStart: null, periodEnd: null });
    expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE_|created_at|created_by|"raw"|"coach"|"participants"|reviewHints/);
  });

  it('refuses incomplete, extra, duplicated or foreign games instead of silently changing the group', () => {
    const input = fixture();
    expect(() => buildGroupPublicationSnapshot({ ...input, matches: input.matches.slice(1) })).toThrow('absentes');
    expect(() => buildGroupPublicationSnapshot({ ...input, archive: { ...input.archive, match_ids: input.archive.match_ids.slice(1) } })).toThrow('absentes');
    expect(() => buildGroupPublicationSnapshot({ ...input, matches: [input.matches[0], input.matches[0], input.matches[2]] })).toThrow('dupliquées');
    expect(() => buildGroupPublicationSnapshot({ ...input, archive: { ...input.archive, team_id: 'foreign-team' } })).toThrow('équipe');
    input.matches[0].team_id = 'foreign-team';
    expect(() => buildGroupPublicationSnapshot(input)).toThrow('équipe');
  });

  it('accepts database JSON ids and includes every game in a large group', () => {
    const input = fixture(80);
    const snapshot = buildGroupPublicationSnapshot({ ...input, archive: { ...input.archive, match_ids: JSON.stringify(input.archive.match_ids) } });
    expect(snapshot.facts.games).toBe(80);
    expect(snapshot.games.map((game) => game.entityId)).toEqual(input.archive.match_ids);
  });
});

describe('Discord group PNG', () => {
  it('renders a single deterministic PNG with bundled assets and no external requests', async () => {
    const snapshot = buildGroupPublicationSnapshot(fixture());
    const before = JSON.stringify(snapshot);
    const fetchSpy = vi.fn(() => { throw new Error('Only bundled assets are permitted.'); });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const first = await renderGroupPublicationPng(snapshot);
      const second = await renderGroupPublicationPng(snapshot);
      expect(first.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(first.bytes.equals(second.bytes)).toBe(true);
      expect(first.mimeType).toBe('image/png');
      expect(first.filename).toBe('nxt5-group-group-example.png');
      expect(first.width).toBe(960);
      expect(first.bytes.readUInt32BE(16)).toBe(first.width);
      expect(first.bytes.readUInt32BE(20)).toBe(first.height);
      expect(first.bytes.length).toBeLessThan(3 * 1024 * 1024);
      expect(JSON.stringify(snapshot)).toBe(before);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it('draws every game in order, all unknown states, and no automatic advice', async () => {
    const input = fixture(80);
    input.matches[1].participants = [];
    const image = await trace(buildGroupPublicationSnapshot(input));
    expect(image.height).toBeLessThanOrEqual(GROUP_PUBLICATION_PNG_MAX_HEIGHT);
    for (const match of input.matches) expect(image.text).toContain(`vs ${match.opponent}`);
    expect(image.drawn.filter((entry) => /^Partie \d+$/.test(entry.text)).map((entry) => entry.text)).toEqual(input.matches.map((_, index) => `Partie ${index + 1}`));
    expect(image.text).toContain('Kills : — / —');
    expect(image.text).toContain('Résultat inconnu');
    expect(image.text).not.toMatch(/NaN|undefined|null|Infinity|VOD|Piste de review/);
  });

  it('wraps long names and descriptions completely without text leaving the image', async () => {
    const input = fixture();
    input.team.name = 'Équipe de démonstration au nom particulièrement long '.repeat(3);
    input.archive.name = 'Groupe de démonstration au nom particulièrement long '.repeat(3).slice(0, 140);
    input.archive.description = 'Description factuelle de ce groupe de démonstration. '.repeat(18);
    input.matches[0].opponent = 'AdversaireAvecUnNomSansEspaces'.repeat(7);
    const snapshot = buildGroupPublicationSnapshot(input);
    const image = await trace(snapshot);
    for (const value of [snapshot.context.teamName, snapshot.context.groupName, snapshot.context.description, ...snapshot.games.map((game) => game.context.opponentName)]) {
      expect(image.text.replace(/\s/g, '')).toContain(value.replace(/\s/g, ''));
    }
    for (const entry of image.drawn) {
      const left = entry.x - (entry.align === 'right' ? entry.width : 0);
      expect(left, entry.text).toBeGreaterThanOrEqual(0);
      expect(left + entry.width, entry.text).toBeLessThanOrEqual(image.width + 1);
      expect(entry.y, entry.text).toBeGreaterThan(0);
      expect(entry.y, entry.text).toBeLessThan(image.height);
    }
  });

  it('rejects an oversized image clearly before allocating its full canvas', async () => {
    const input = fixture(120);
    input.matches.forEach((match) => { match.opponent = 'Adversaires au nom très long '.repeat(10); });
    const snapshot = buildGroupPublicationSnapshot(input);
    const canvasFactory = vi.fn(createCanvas);
    await expect(renderGroupPublicationCanvas(snapshot, { createCanvas: canvasFactory, loadLogo: async () => null })).rejects.toMatchObject({ code: 'GROUP_PNG_TOO_LARGE' });
    expect(canvasFactory).toHaveBeenCalledExactlyOnceWith(960, 1);
  });
});
