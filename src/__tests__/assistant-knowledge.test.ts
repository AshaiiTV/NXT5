import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_KNOWLEDGE,
  buildFallbackAssistantResponse,
  retrieveAssistantKnowledge,
  safeAssistantRoute,
  sanitizeAssistantActions,
  sanitizeAssistantSuggestions
} from '../../netlify/functions/_lib/assistant-knowledge';
import { DRAFT_DETAIL_IDS } from '../app/trends-navigation';

describe('assistant knowledge', () => {
  it.each([
    ['Comment associer Google à mon compte ?', 'social-sign-in', 'Connexions associées', '/parametres'],
    ['Quelle différence entre connexion Discord et liaison au bot ?', 'social-sign-in', '/nxt compte lier', '/parametres'],
    ['Comment créer un premier mot de passe ?', 'social-sign-in', 'réassocier', '/parametres'],
    ['Comment connecter le serveur Discord ?', 'discord-setup', 'Confirmer l’activation', '/bot-discord'],
    ['Quelles commandes Discord sont disponibles ?', 'discord-commands', 'menu /nxt', '/bot-discord'],
    ['Comment publier une game sur Discord ?', 'discord-commands', 'Préparer l’aperçu', '/bot-discord'],
    ['Pourquoi une commande Discord est refusée ?', 'discord-setup', 'rôle autorisé', '/bot-discord'],
    ['Le bot Discord est-il payant ?', 'subscriptions', 'pas encore lancés', '/parametres'],
    ['Le soutien Ko-fi débloque-t-il des fonctionnalités ?', 'support-nxt5', 'aucun accès', '/soutenir'],
    ['Comment ouvrir l’Importer sur Mac ?', 'importer-download', 'Confidentialité et sécurité', '/games'],
    ['Windows bloque l’Importer, que faire ?', 'importer-download', 'Informations complémentaires', '/games'],
    ['Comment exporter un groupe en PNG ?', 'png-exports', 'Exporter le groupe PNG', '/games'],
    ['Où retrouver les matchups d’un joueur ?', 'profile-champions', 'Statistiques moyennes et adversaires', '/mon-profil/champions'],
    ['Comment lier plusieurs games à une review ?', 'reviews', '20 games', '/rapports'],
    ['J’ai importé du mauvais côté', 'imports-and-games', 'Changer le côté de notre équipe', '/games'],
    ['Comment comparer deux blocs ?', 'trends', 'Bloc de référence', '/tendances'],
    ['Comment ajouter un joueur ?', 'teams-and-roster', 'Gestion équipe', '/gestion-equipe'],
    ['Pourquoi le parcours demande cinq joueurs ?', 'getting-started', 'Subs compris', '/equipes'],
  ])('answers "%s" from an unrelated page with the right action', (question, id, answerPart, path) => {
    for (const route of ['/games', '/equipes', '/parametres', '/bot-discord']) {
      const matches = retrieveAssistantKnowledge(question, route);
      expect(matches[0].id, `${question} from ${route}`).toBe(id);
      const response = buildFallbackAssistantResponse(question, matches);
      expect(response.answer).toContain(answerPart);
      expect(response.actions[0].path).toBe(path);
      expect(response.sources[0].id).toBe(id);
    }
  });

  it.each(DRAFT_DETAIL_IDS)('keeps context for the draft detail %s', (detail) => {
    const path = `/tendances/draft/${detail}`;
    expect(safeAssistantRoute(`${path}?contexte=private-category`)).toBe(path);
    expect(retrieveAssistantKnowledge('Comment utiliser cette page ?', path)[0].id).toBe(`trends-draft-${detail}`);
  });

  it.each([
    ['Quels sont les critères des Picks de confort ?', '/tendances/draft/confort', 'au moins 2 games'],
    ['Quelles paires de rôles sont suivies dans les Duos ?', '/tendances/draft/duos', 'Jungle + Mid'],
    ['Pourquoi un champion apparaît-il sur plusieurs rôles ?', '/tendances/draft/roles', 'compté séparément'],
  ])('does not replace a detailed answer with a broad FAQ: %s', (question, route, answerPart) => {
    const answer = buildFallbackAssistantResponse(question, retrieveAssistantKnowledge(question, route));
    expect(answer.answer).toContain(answerPart);
    expect(answer.actions[0].path).toBe(route);
  });

  it('keeps updated pages navigable without granting administrative or external actions', () => {
    expect(sanitizeAssistantActions([
      { label: 'Bot', path: '/bot-discord?teamId=private' },
      { label: 'Tarifs', path: '/tarifs' },
      { label: 'Abonnements admin', path: '/admin/abonnements' },
      { label: 'Soutenir', path: '/soutenir' },
      { label: 'Paiement', path: 'https://ko-fi.com/nxt5org' },
      { label: 'Duos', path: '/tendances/draft/duos' },
    ])).toEqual([
      { label: 'Bot', path: '/bot-discord' },
      { label: 'Soutenir', path: '/soutenir' },
      { label: 'Duos', path: '/tendances/draft/duos' },
    ]);
    expect(safeAssistantRoute('/tendances/draft/inconnu')).toBe('/equipes');
    expect(safeAssistantRoute('/profil/champions')).toBe('/mon-profil/champions');
    expect(safeAssistantRoute('/mon-profil/matchups')).toBe('/mon-profil/champions');
    for (const entry of ASSISTANT_KNOWLEDGE) {
      expect(sanitizeAssistantActions([{ label: entry.actionLabel, path: entry.path }])).toHaveLength(1);
    }
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
