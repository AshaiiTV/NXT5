import { describe, expect, it } from 'vitest';
import { buildDiscordMessage } from '../../netlify/functions/_lib/discord-client';
import { buildDiscordDemoSnapshot } from '../../shared/publications/discord-demo.js';

const options = { reference: 'publication:123:1', siteUrl: 'https://nxt5.example', hasImage: true };

describe('Compact Discord publication', () => {
  it('keeps the result, score and duration readable without repeating the PNG statistics', () => {
    const message = buildDiscordMessage(buildDiscordDemoSnapshot(), options);
    expect(message.embeds[0]).toMatchObject({
      title: 'TEST · Équipe fictive vs Adversaires fictifs',
      description: 'Victoire · 19–13 kills · 28:30\nDÉMONSTRATION · aucune game réelle',
      fields: [], image: { url: 'attachment://nxt5-game.png' },
      footer: { text: 'NXT5 · publication:123:1' },
    });
    expect(message.attachments[0].description).toContain('Or 64 k–61 k · Dragons 3–1 · Tours 8–3');
    expect(message.components[0].components[0]).toMatchObject({ label: 'Voir la game sur NXT5', url: 'https://nxt5.example/statistiques?team=demo-team&match=demo-game' });
  });

  it('provides essential factual text when the image is absent, including genuine zeroes', () => {
    const snapshot = buildDiscordDemoSnapshot();
    snapshot.facts.dragons = { ...snapshot.facts.dragons, ally: 0, enemy: 0 };
    snapshot.facts.towers = { ...snapshot.facts.towers, ally: null, enemy: 3 };
    const message = buildDiscordMessage(snapshot, { ...options, hasImage: false });
    expect(message.embeds[0].fields).toEqual([{ name: 'Notre équipe / adversaire', value: 'Or 64 k–61 k · Dragons 0–0', inline: false }]);
    expect(message.embeds[0].image).toBeUndefined();
    expect(message.attachments).toEqual([]);
    expect(message.components).toHaveLength(1);
    const missing = buildDiscordMessage({ ...snapshot, facts: {} }, { ...options, hasImage: false });
    expect(missing.embeds[0].description).not.toContain('kills');
    expect(missing.embeds[0].fields[0].value).toBe('Statistiques indisponibles.');
  });

  it('limits categories and optional review to one useful, bounded observation', () => {
    const snapshot = { ...buildDiscordDemoSnapshot(), context: { teamName: 'NXT', opponentName: 'Test', categories: [{ name: 'Scrims' }, { name: 'Équipe A' }, { name: '2026' }] },
      reviewHints: [{ availability: 'insufficient', observation: 'Generic missing-data advice' }, { observation: 'Observation '.repeat(100), action: 'Action '.repeat(100) }, { observation: 'Another topic' }] };
    const message = buildDiscordMessage(snapshot, { ...options, includeHints: true });
    expect(message.embeds[0].description).toContain('Scrims · Équipe A · +1');
    expect(message.embeds[0].fields).toHaveLength(1);
    expect(message.embeds[0].fields[0].name).toBe('Piste de review');
    expect(message.embeds[0].fields[0].value.length).toBeLessThanOrEqual(321);
    expect(message.embeds[0].fields[0].value).toContain('…');
    expect(message.embeds[0].fields[0].value).not.toMatch(/Another topic|Generic/);
    expect(buildDiscordMessage({ ...snapshot, reviewHints: [{ availability: 'insufficient', observation: 'Unavailable' }] }, { ...options, includeHints: true }).embeds[0].fields).toEqual([]);
  });
});
