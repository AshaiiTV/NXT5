import { describe, expect, it } from 'vitest';
import {
  buildFallbackAssistantResponse,
  retrieveAssistantKnowledge,
  safeAssistantRoute,
  sanitizeAssistantActions,
  sanitizeAssistantSuggestions
} from '../../netlify/functions/_lib/assistant-knowledge';

describe('assistant knowledge', () => {
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
      { label: 'Stats détaillées', path: '/statistiques' },
      { label: 'Reviews', path: '/rapports' }
    ]);
  });

  it('falls back to the guide for an unknown route', () => {
    expect(safeAssistantRoute('/secret')).toBe('/guide');
    expect(safeAssistantRoute('https://example.com')).toBe('/guide');
    expect(safeAssistantRoute('/mon-profil/coaching')).toBe('/mon-profil/coaching');
  });

  it('bounds and deduplicates follow-up suggestions', () => {
    expect(sanitizeAssistantSuggestions(['Question valide', 'Question valide', '', 'Deuxième question', 'Troisième question', 'Quatrième question'])).toEqual([
      'Question valide',
      'Deuxième question',
      'Troisième question'
    ]);
  });
});
