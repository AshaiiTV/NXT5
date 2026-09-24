import { describe, expect, it } from 'vitest';
import {
  buildFallbackAssistantResponse,
  retrieveAssistantKnowledge,
  safeAssistantRoute,
  sanitizeAssistantActions,
  sanitizeAssistantSuggestions
} from '../../netlify/functions/_lib/assistant-knowledge';

describe('assistant knowledge', () => {
  it.each([
    ['Comment préparer un débrief ?', '/rapports', 'reviews'],
    ['Comment organiser les titulaires et les remplaçants ?', '/equipes', 'teams-and-roster'],
    ['Comment indiquer le niveau de maîtrise d’un champion ?', '/draft/pool', 'champion-pool'],
  ])('recognizes the visible wording: %s', (question, route, expected) => {
    const matches = retrieveAssistantKnowledge(question, route);
    expect(matches[0].id).toBe(expected);
    const response = buildFallbackAssistantResponse(question, matches);
    expect(response.actions[0].path).toBe(matches[0].path);
  });

  it('explains an incomplete chronology from the game page without inventing missing events', () => {
    const question = 'Pourquoi la chronologie est-elle incomplète ?';
    const matches = retrieveAssistantKnowledge(question, '/games');
    const response = buildFallbackAssistantResponse(question, matches);
    expect(response.answer).toContain('NXT5 n’invente pas les événements absents du fichier');
    expect(response.answer).toContain('les statistiques finales restent disponibles');
  });

  it('prioritizes the current page and the user intent', () => {
    const matches = retrieveAssistantKnowledge('Comment corriger le mauvais profil de ma game ?', '/integration');
    expect(matches[0].id).toBe('imports-and-games');
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it('answers a known profile-linking issue without AI', () => {
    const matches = retrieveAssistantKnowledge('Pourquoi mon ADC a moins de games que les autres ?', '/equipes');
    const response = buildFallbackAssistantResponse('Pourquoi mon ADC a moins de games que les autres ?', matches);
    expect(response.fallback).toBe(true);
    expect(response.answer).toContain('profil lié');
    expect(response.answer).toContain('Riot ID');
  });

  it('only allows known internal navigation actions', () => {
    expect(sanitizeAssistantActions([
      { label: 'Stats détaillées', path: '/statistiques?match=private-id' },
      { label: 'Site externe', path: 'https://example.com' },
      { label: 'Chemin trompeur', path: '//example.com' },
      { label: 'Admin', path: '/admin' },
      { label: 'Stats en double', path: '/statistiques' },
      { label: 'Reviews', path: '/rapports' }
    ])).toEqual([
      { label: 'Stats détaillées', path: '/games' },
      { label: 'Reviews', path: '/rapports' }
    ]);
  });

  it('falls back to the team page for an unknown route', () => {
    expect(safeAssistantRoute('/secret')).toBe('/equipes');
    expect(safeAssistantRoute('https://example.com')).toBe('/equipes');
    expect(safeAssistantRoute('/mon-profil/coaching')).toBe('/mon-profil/coaching');
    expect(safeAssistantRoute('/guide')).toBe('/guide');
    expect(safeAssistantRoute('/games?match=private-id')).toBe('/games');
    expect(safeAssistantRoute('/integration')).toBe('/games');
    expect(safeAssistantRoute('/statistiques')).toBe('/games');
  });

  it('bounds and deduplicates follow-up suggestions', () => {
    expect(sanitizeAssistantSuggestions(['Question valide', 'Question valide', '', 'Deuxième question', 'Troisième question', 'Quatrième question'])).toEqual([
      'Question valide',
      'Deuxième question',
      'Troisième question'
    ]);
  });
});
