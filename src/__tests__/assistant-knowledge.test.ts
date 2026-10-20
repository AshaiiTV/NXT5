import { describe, expect, it } from 'vitest';
import {
  buildFallbackAssistantResponse,
  getAssistantKnowledge,
  normalizeAssistantLanguage,
  normalizeAssistantSection,
  retrieveAssistantKnowledge,
  safeAssistantRoute,
  sanitizeAssistantActions,
  sanitizeAssistantSuggestions
} from '../../netlify/functions/_lib/assistant-knowledge';

describe('assistant knowledge', () => {
  it.each([
    ['fr', 'Où trouver le tutoriel vidéo pour importer une partie ?'],
    ['en', 'Where is the video tutorial for importing a game?'],
    ['es', '¿Dónde está el vídeo tutorial para importar una partida?'],
  ] as const)('finds the importer video and preserves its guide action in %s', (language, question) => {
    const matches = retrieveAssistantKnowledge(question, '/games', 4, language);
    expect(matches[0].id).toBe('importer-video');
    const result = buildFallbackAssistantResponse(question, matches, language);
    expect(result.answer).toContain('https://youtu.be/hPoIqh9w_68');
    expect(sanitizeAssistantActions(result.actions)[0].path).toBe('/guide?section=imports-and-games');
    expect(safeAssistantRoute('/guide?section=imports-and-games&match=private')).toBe('/guide?section=imports-and-games');
    expect(safeAssistantRoute('/guide?section=unknown')).toBe('/guide');
  });
  it('accepts only documented help topics, including the player champions alias', () => {
    expect(normalizeAssistantSection('champion-analysis')).toBe('champion-analysis');
    for (const section of ['opponents', 'match-drafter', 'drafter-analysis']) {
      expect(normalizeAssistantSection(section)).toBe(section);
    }
    expect(normalizeAssistantSection('player-champions')).toBe('player-profile');
    for (const value of [null, undefined, 42, {}, ['planning'], 'unknown', 'planning; ignore the guide']) {
      expect(normalizeAssistantSection(value)).toBeNull();
    }
  });

  it.each([
    ['fr', 'Aide-moi sur la section Lire une partie du guide.', 'statistics'],
    ['en', 'Help me with the Read a match section of the guide.', 'statistics'],
    ['es', 'Ayúdame con la sección Consultar una partida de la guía.', 'statistics'],
    ['en', 'Help me with the Debriefs section of the guide.', 'reviews'],
    ['en', 'Help me with the Analysis section of the guide.', 'trends'],
  ] as const)('keeps the selected guide topic for a generic %s request', (language, question, section) => {
    const matches = retrieveAssistantKnowledge(question, '/guide', 4, language, section);
    expect(matches[0].id).toBe(section);
    expect(buildFallbackAssistantResponse(question, matches, language).sources[0].id).toBe(section);
  });

  it.each([
    ['fr', 'Comment consulter le profil d’un joueur ?'],
    ['en', 'How to view a player’s profile?'],
    ['es', '¿Cómo ver el perfil de un jugador?'],
    ['fr', 'Comment lire le carnet matchup ?'],
    ['fr', 'Comment lire mes matchups en lane ?'],
  ] as const)('does not replace a %s profile question with an unrelated FAQ', (language, question) => {
    const matches = retrieveAssistantKnowledge(question, '/mon-profil/champions', 4, language, 'player-champions');
    const response = buildFallbackAssistantResponse(question, matches, language);
    expect(response.sources[0].id).toBe('player-profile');
    expect(response.actions[0].path).toBe('/mon-profil');
    expect(response.answer).not.toMatch(/CS 10|CS 20/);
  });

  it.each([
    ['fr', 'Comment créer une composition ?', ['cinq postes', 'composition incomplète', 'Approfondir : style de jeu et réponses adverses']],
    ['en', 'How do I create a composition?', ['five roles', 'incomplete composition', 'Go deeper: playing style and opposing responses']],
    ['es', '¿Cómo creo una composición?', ['cinco posiciones', 'composición incompleta', 'Profundizar: estilo de juego y respuestas del rival']],
  ] as const)('explains the deployed composition workflow in %s', (language, question, facts) => {
    const matches = retrieveAssistantKnowledge(question, '/draft/compositions', 4, language, 'compositions');
    expect(matches[0].id).toBe('compositions');
    const response = buildFallbackAssistantResponse(question, matches, language);
    for (const fact of facts) expect(response.answer).toContain(fact);
    expect(response.sources[0].id).toBe('compositions');
    expect(response.actions[0].path).toBe('/draft/compositions');
  });

  it.each([
    ['fr', 'Comment utiliser l’aide au choix des champions ?', ['Aide au choix : pool et parties de l’équipe', 'brouillon', 'enregistre la composition']],
    ['en', 'How do I use champion choice assistance?', ['Pick assistance: champion pool and team games', 'draft', 'save the composition']],
    ['es', '¿Cómo utilizo la ayuda para elegir campeones?', ['Ayuda para elegir: repertorio y partidas del equipo', 'borrador', 'guarda la composición']],
    ['fr', 'Comment sont classés les choix de champions ?', ['maîtrise déclarée', 'Le taux de victoire ne détermine pas l’ordre']],
    ['fr', 'Comment sont classées les suggestions de champions ?', ['maîtrise déclarée', 'Le taux de victoire ne détermine pas l’ordre']],
    ['en', 'How are champion picks ranked?', ['declared proficiency', 'Win rate does not determine the order']],
    ['es', '¿Cómo se ordenan las opciones de campeones?', ['dominio declarado', 'El porcentaje de victorias no determina el orden']],
    ['fr', 'Pourquoi mon champion n’apparaît pas dans les choix disponibles ?', ['pool manuel', 'sont exclus']],
    ['en', 'Why is my champion missing from available choices?', ['manual pool', 'are excluded']],
    ['es', '¿Por qué mi campeón no aparece en las opciones disponibles?', ['repertorio manual', 'Se excluyen']],
    ['fr', 'Les statistiques Mobalytics sont-elles utilisées dans les suggestions ?', ['ne sont pas importées', 'ne modifient pas le classement']],
    ['en', 'Are Mobalytics statistics used in the suggestions?', ['not imported', 'do not affect the NXT5 ranking']],
    ['es', '¿Se utilizan las estadísticas de Mobalytics en las sugerencias?', ['no se importan', 'ni modifican la clasificación']],
  ] as const)('explains current champion pick assistance in %s: %s', (language, question, facts) => {
    const matches = retrieveAssistantKnowledge(question, '/draft/compositions', 4, language, 'compositions');
    expect(matches[0].id).toBe('compositions');
    const response = buildFallbackAssistantResponse(question, matches, language);
    for (const fact of facts) expect(response.answer).toContain(fact);
    expect(response.sources[0].id).toBe('compositions');
    expect(response.actions[0].path).toBe('/draft/compositions');
  });

  it.each([
    ['fr', 'Où trouver Dupliquer et Supprimer pour un débrief ?', ['engrenage Gérer ce débrief', 'Éditer reste disponible séparément']],
    ['en', 'Where do I find Duplicate and Delete for a debrief?', ['Manage this review gear icon', 'Edit remains available separately']],
    ['es', '¿Dónde encuentro Duplicar y Eliminar un análisis postpartida?', ['engranaje Gestionar este análisis postpartida', 'Editar sigue disponible por separado']],
    ['fr', 'Pourquoi le débrief reprend-il le nom du groupe ?', ['exactement', 'Une sélection partielle']],
    ['en', 'Why does the debrief use the group’s name?', ['exactly match', 'A partial selection']],
    ['es', '¿Por qué el análisis postpartida usa el nombre del grupo?', ['coinciden exactamente', 'Una selección parcial']],
    ['fr', 'Où retrouver l’analyse automatique d’un débrief ?', ['Notes de l’équipe apparaissent en premier', 'Analyse automatique des parties']],
    ['en', 'Where can I find a debrief’s automated analysis?', ['Team notes appear first', 'Automated match analysis']],
    ['es', '¿Dónde encuentro el análisis automático de un análisis postpartida?', ['Notas del equipo aparece primero', 'Análisis automático de las partidas']],
    ['fr', 'Comment réunir plusieurs parties dans un débrief ?', ['20 au maximum', 'enregistre']],
    ['en', 'How do I combine several games in a debrief?', ['up to 20', 'save']],
    ['es', '¿Cómo reúno varias partidas en un análisis postpartida?', ['máximo 20', 'guarda']],
  ] as const)('explains current debrief controls in %s: %s', (language, question, facts) => {
    const matches = retrieveAssistantKnowledge(question, '/guide', 4, language, 'reviews');
    expect(matches[0].id).toBe('reviews');
    const response = buildFallbackAssistantResponse(question, matches, language);
    for (const fact of facts) expect(response.answer).toContain(fact);
    expect(response.sources[0].id).toBe('reviews');
    expect(response.actions[0].path).toBe('/rapports');
  });

  it('follows an explicit question about another feature despite the current topic', () => {
    const question = 'Comment lier mon compte Discord ?';
    const matches = retrieveAssistantKnowledge(question, '/guide', 4, 'fr', 'compositions');
    expect(matches[0].id).toBe('discord');
    expect(buildFallbackAssistantResponse(question, matches).actions[0].path).toBe('/bot-discord');
  });

  it('links the FAQ answer to its own source even if the current-page article ranks first', () => {
    const question = 'Pourquoi la chronologie est-elle incomplète ?';
    const matches = getAssistantKnowledge().filter(entry => ['statistics', 'troubleshooting'].includes(entry.id)).map(entry => ({ ...entry, score: entry.id === 'statistics' ? 50 : 40 }));
    const response = buildFallbackAssistantResponse(question, matches);
    expect(response.sources[0].id).toBe('troubleshooting');
    expect(response.actions[0].path).toBe('/parametres');
    expect(response.suggestions).toEqual(matches[1].suggestions);
  });

  it('preserves the Champions view in actions without exposing private query values', () => {
    const route = '/tendances?rubrique=draft&team=private-team&categorie=private-category#private-anchor';
    expect(safeAssistantRoute(route)).toBe('/tendances?rubrique=draft');
    expect(sanitizeAssistantActions([{ label: 'Champions', path: route }])).toEqual([{ label: 'Champions', path: '/tendances?rubrique=draft' }]);
    expect(safeAssistantRoute('/tendances?rubrique=unknown')).toBe('/tendances');
    const matches = retrieveAssistantKnowledge('Comment utiliser cette page ?', '/tendances?rubrique=draft');
    expect(matches[0].id).toBe('champion-analysis');
  });

  it.each([
    ['statistics', 'statistics'],
    ['playstyle', 'playstyle'],
    ['ai-objectives', 'playstyle'],
  ])('preserves the %s analysis action and canonicalises old objective links', (panel, canonical) => {
    const route = `/tendances?rubrique=${panel}&contexte=private-category&periode=5&team=private-team#private-anchor`;
    const expected = `/tendances?rubrique=${canonical}`;
    expect(safeAssistantRoute(route)).toBe(expected);
    expect(sanitizeAssistantActions([{ label: 'Ouvrir', path: route }])).toEqual([{ label: 'Ouvrir', path: expected }]);
    for (const language of ['fr', 'en', 'es'] as const) {
      expect(retrieveAssistantKnowledge('Comment utiliser cette page ?', route, 4, language)[0].id).toBe('trends');
    }
  });

  it.each([
    ['fr', 'Statistiques', 'Style de jeu'],
    ['en', 'Statistics', 'Playstyle'],
    ['es', 'Estadísticas', 'Estilo de juego'],
  ] as const)('describes the statistics and playstyle panels in %s', (language, statistics, playstyle) => {
    const summary = getAssistantKnowledge(language).find(entry => entry.id === 'trends')?.summary;
    expect(summary).toContain(statistics);
    expect(summary).toContain(playstyle);
  });

  it.each([
    ['/games?view=teams&team=private-team&match=private-match#private-anchor', '/games?view=teams', 'opponents'],
    ['/tendances?rubrique=drafts&draft=private-draft&opponent=private-opponent', '/tendances?rubrique=drafts', 'drafter-analysis'],
  ])('preserves the public view and strips private context from %s', (route, expected, section) => {
    expect(safeAssistantRoute(route)).toBe(expected);
    expect(sanitizeAssistantActions([{ label: 'Ouvrir', path: route }])).toEqual([{ label: 'Ouvrir', path: expected }]);
    const matches = retrieveAssistantKnowledge('Comment utiliser cette page ?', route);
    expect(matches[0].id).toBe(section);
    expect(buildFallbackAssistantResponse('Comment utiliser cette page ?', matches).actions[0].path).toBe(expected);
  });

  it('does not preserve arbitrary view selectors or private identifiers', () => {
    for (const path of ['/games?view=unknown', '/games?view=drafts&match=private', '/games?opponent=private']) {
      expect(safeAssistantRoute(path)).toBe('/games');
    }
    expect(safeAssistantRoute('/tendances?rubrique=drafter&draft=private')).toBe('/tendances');
    expect(safeAssistantRoute('/tendances?rubrique=drafts-private')).toBe('/tendances');
    expect(safeAssistantRoute('/tendances?rubrique=playstyle-private')).toBe('/tendances');
    expect(safeAssistantRoute('/tendances?rubrique=statistics-private')).toBe('/tendances');
    expect(safeAssistantRoute('/games?view=teams-private')).toBe('/games');
    expect(sanitizeAssistantActions([{ label: 'Drafter', path: 'https://drafter.lol/draft/private' }])).toEqual([]);
  });

  it.each([
    ['Comment créer une fiche adverse ?', '/games?view=teams', 'opponents'],
    ['Comment associer une équipe adverse à une partie ?', '/games?view=teams', 'opponents'],
    ['D’où viennent les champions d’une fiche adverse ?', '/games?view=teams', 'opponents'],
    ['Comment rattacher une draft Drafter à une partie ?', '/games', 'match-drafter'],
    ['Faut-il une équipe adverse pour importer une draft ?', '/games', 'match-drafter'],
    ['Que devient une draft détachée de sa partie ?', '/games', 'match-drafter'],
    ['Comment analyser les picks et bans ?', '/tendances?rubrique=drafts', 'drafter-analysis'],
    ['Pourquoi l’ordre de sélection est-il indisponible ?', '/tendances?rubrique=drafts', 'drafter-analysis'],
    ['Comment retrouver une draft sans partie liée ?', '/tendances?rubrique=drafts', 'drafter-analysis'],
    ['Comment sont classées les suggestions de champions ?', '/draft/compositions', 'compositions'],
  ])('answers the new visible prompt from its page and the guide: %s', (question, route, expected) => {
    for (const [currentRoute, section] of [[route, null], ['/guide', expected]]) {
      const matches = retrieveAssistantKnowledge(question, currentRoute, 4, 'fr', section);
      expect(matches[0].id).toBe(expected);
      const response = buildFallbackAssistantResponse(question, matches);
      expect(response.sources[0].id).toBe(expected);
      expect(response.actions[0].path).toBe(matches[0].path);
    }
  });

  it.each([
    ['fr', 'Comment rattacher une partie à une équipe adverse ?', '/games', 'opponents', 'créer la fiche seul ne rattache pas la partie'],
    ['en', 'How do I link a game to an opponent team?', '/games', 'opponents', 'creating the profile alone does not link the game'],
    ['es', '¿Cómo vinculo una partida a un equipo rival?', '/games', 'opponents', 'crear la ficha por sí solo no vincula la partida'],
    ['fr', 'Faut-il un lien Drafter pour associer un adversaire ?', '/games', 'opponents', 'facultatives et indépendantes'],
    ['en', 'Do I need a Drafter link to associate an opponent?', '/games', 'opponents', 'optional and independent'],
    ['es', '¿Necesito un enlace de Drafter para asociar un rival?', '/games', 'opponents', 'opcionales e independientes'],
    ['fr', 'Comment importer un lien Drafter dans une partie ?', '/games', 'match-drafter', 'L’aperçu seul ne sauvegarde rien'],
    ['en', 'How do I import a Drafter link into a game?', '/games', 'match-drafter', 'The preview alone does not save anything'],
    ['es', '¿Cómo importo un enlace de Drafter en una partida?', '/games', 'match-drafter', 'La vista previa por sí sola no guarda nada'],
    ['fr', 'Faut-il une équipe adverse pour importer une draft ?', '/games', 'match-drafter', 'facultatifs et indépendants'],
    ['en', 'Do I need an opponent team to import a draft?', '/games', 'match-drafter', 'optional and independent'],
    ['es', '¿Necesito un equipo rival para importar un draft?', '/games', 'match-drafter', 'opcionales e independientes'],
    ['fr', 'Que devient une draft remplacée ou détachée ?', '/games', 'match-drafter', 'reste dans l’historique'],
    ['en', 'What happens to a replaced or unlinked draft?', '/games', 'match-drafter', 'remains in the'],
    ['es', '¿Qué ocurre con un draft reemplazado o desvinculado?', '/games', 'match-drafter', 'permanece en el historial'],
    ['fr', 'Comment consulter l’ordre des picks et des bans ?', '/tendances', 'drafter-analysis', 'rôles réellement joués restent distincts'],
    ['en', 'How do I view the pick and ban order?', '/tendances', 'drafter-analysis', 'roles actually played remain separate'],
    ['es', '¿Cómo consulto el orden de selecciones y bloqueos?', '/tendances', 'drafter-analysis', 'roles realmente jugados siguen siendo independientes'],
    ['fr', 'Pourquoi l’ordre de sélection est-il indisponible ?', '/tendances', 'drafter-analysis', 'L’aperçu seul ne met pas l’historique à jour'],
    ['en', 'Why is the selection order unavailable?', '/tendances', 'drafter-analysis', 'The preview alone does not update the history'],
    ['es', '¿Por qué no está disponible el orden de selección?', '/tendances', 'drafter-analysis', 'La vista previa por sí sola no actualiza el historial'],
    ['fr', 'Que signifient les fréquences et le premier pick global ?', '/tendances', 'drafter-analysis', 'données incomplètes sont exclues'],
    ['en', 'What do frequencies and the first overall pick mean?', '/tendances', 'drafter-analysis', 'Incomplete data is excluded'],
    ['es', '¿Qué significan las frecuencias y la primera selección global?', '/tendances', 'drafter-analysis', 'datos incompletos se excluyen'],
  ] as const)('explains opponent and Drafter workflows in %s: %s', (language, question, route, expected, fact) => {
    const matches = retrieveAssistantKnowledge(question, route, 4, language);
    expect(matches[0].id).toBe(expected);
    const response = buildFallbackAssistantResponse(question, matches, language);
    expect(response.sources[0].id).toBe(expected);
    expect(response.answer).toContain(fact);
  });

  it('keeps explicit game help even when a private match selector accompanies the public teams view', () => {
    const matches = retrieveAssistantKnowledge('Comment utiliser cette page ?', '/games?view=teams&match=private-id', 4, 'fr', 'statistics');
    expect(matches[0].id).toBe('statistics');
    expect(buildFallbackAssistantResponse('Comment utiliser cette page ?', matches).actions[0].path).toBe('/games');
  });

  it.each([
    ['fr', 'Comment choisir une équipe adverse pendant l’import ?', 'imports-and-games', ['confirmation de l’import', 'annuler ne crée pas cette fiche adverse', 'conserve le lien']],
    ['en', 'How do I choose an opponent team during import?', 'imports-and-games', ['confirm the import', 'does not create that opponent profile', 'preserves an existing link']],
    ['es', '¿Cómo elijo un equipo rival durante la importación?', 'imports-and-games', ['confirmar la importación', 'no crea esa ficha rival', 'conserva el vínculo']],
    ['fr', 'Une catégorie est-elle obligatoire pour importer ?', 'imports-and-games', ['au moins une catégorie', 'reste facultatif']],
    ['en', 'Is a category required to import?', 'imports-and-games', ['at least one category', 'remains optional']],
    ['es', '¿Es obligatoria una categoría para importar?', 'imports-and-games', ['al menos una categoría', 'sigue siendo opcional']],
    ['fr', 'Comment associer une équipe adverse à un groupe ?', 'opponents', ['Enregistrer le lien', 'ajoutées ensuite', 'sans modification partielle']],
    ['en', 'How do I associate an opponent team with a group?', 'opponents', ['Save link', 'added later', 'without partial changes']],
    ['es', '¿Cómo asocio un equipo rival a un grupo?', 'opponents', ['Guardar vínculo', 'añadidas después', 'sin cambios parciales']],
    ['fr', 'Que devient l’adversaire des parties si je retire le lien du groupe ?', 'opponents', ['conserve l’adversaire', 'autres groupes liés', 'Drafter reste indépendant']],
    ['en', 'What happens to game opponents if I remove the group link?', 'opponents', ['preserves the opponents', 'other linked groups', 'Drafter link stays independent']],
    ['es', '¿Qué ocurre con los rivales de las partidas al quitar el vínculo del grupo?', 'opponents', ['conserva los rivales', 'otros grupos vinculados', 'Drafter sigue siendo independiente']],
    ['fr', 'Comment parcourir le dossier d’une équipe adverse ?', 'opponents', ['Vue d’ensemble', 'résultat de notre équipe', 'source ou la partie liée']],
    ['en', 'How do I browse an opponent team’s dossier?', 'opponents', ['Overview', 'our team’s result', 'source or linked game']],
    ['es', '¿Cómo recorro el dossier de un equipo rival?', 'opponents', ['Vista general', 'resultado de nuestro equipo', 'fuente o partida vinculada']],
    ['fr', 'Comment analyser les bans contre nous et les rôles concernés ?', 'drafter-analysis', ['Rôle concerné', 'pools déclarés actuels', 'Chaque taux garde son propre échantillon']],
    ['en', 'How do I analyze bans against us and affected roles?', 'drafter-analysis', ['Affected role', 'current declared pools', 'Each rate keeps its own sample']],
    ['es', '¿Cómo analizo los bloqueos contra nosotros y los roles afectados?', 'drafter-analysis', ['Rol afectado', 'repertorios declarados actuales', 'Cada tasa conserva su propia muestra']],
    ['fr', 'Comment lire les rotations de picks ?', 'drafter-analysis', ['picks consécutifs', 'partie liée compatible', 'ne sont pas les rôles joués']],
    ['en', 'How do I read pick rotations?', 'drafter-analysis', ['consecutive picks', 'compatible linked game', 'not played roles']],
    ['es', '¿Cómo leo las rotaciones de selecciones?', 'drafter-analysis', ['selecciones consecutivas', 'partida vinculada compatible', 'no son roles jugados']],
    ['fr', 'D’où viennent les champions d’une fiche adverse ?', 'opponents', ['participants', 'Choix de draft non confirmés en partie']],
    ['en', 'Where do champions in an opponent profile come from?', 'opponents', ['participants', 'Draft picks not confirmed in game']],
    ['es', '¿De dónde vienen los campeones de una ficha rival?', 'opponents', ['participantes', 'Selecciones del draft no confirmadas en partida']],
    ['fr', 'Comment retrouver une draft sans partie liée ?', 'drafter-analysis', ['Affiner le périmètre', 'Sans partie liée', 'aucune partie ni aucun résultat']],
    ['en', 'How do I find a draft without a linked game?', 'drafter-analysis', ['Refine the scope', 'No linked match', 'no game or result']],
    ['es', '¿Cómo encuentro un draft sin partida vinculada?', 'drafter-analysis', ['Ajustar el alcance', 'Sin partida vinculada', 'ninguna partida ni resultado']],
  ] as const)('explains current import, group and draft workflows in %s: %s', (language, question, expected, facts) => {
    const matches = retrieveAssistantKnowledge(question, '/guide', 4, language, expected);
    expect(matches[0].id).toBe(expected);
    const response = buildFallbackAssistantResponse(question, matches, language);
    expect(response.sources[0].id).toBe(expected);
    for (const fact of facts) expect(response.answer).toContain(fact);
  });

  it.each([
    ['en', 'How do I indicate a champion mastery level?', '/draft/pool', 'champion-pool', 'Players’ champions'],
    ['es', '¿Cómo indico el nivel de dominio de un campeón?', '/draft/pool', 'champion-pool', 'Campeones de los jugadores'],
    ['en', 'How do I organise starters and substitutes?', '/equipes', 'teams-and-roster', 'Team, players and access'],
    ['es', '¿Cómo organizo a los titulares y suplentes?', '/equipes', 'teams-and-roster', 'Equipo, jugadores y acceso'],
  ] as const)('retrieves %s documentation and localises every fallback field', (language, question, route, expected, title) => {
    const matches = retrieveAssistantKnowledge(question, route, 4, language);
    expect(matches[0].id).toBe(expected);
    const response = buildFallbackAssistantResponse(question, matches, language);
    expect(response.sources[0]).toMatchObject({ id: expected, title, path: matches[0].path });
    expect(response.actions[0].label).toBe(matches[0].actionLabel);
    expect(response.answer).toContain(matches[0].summary);
    expect(response.suggestions).toEqual(matches[0].suggestions);
  });

  it.each([
    ['en', 'Why is the timeline incomplete?', 'final statistics remain available'],
    ['es', '¿Por qué está incompleta la cronología?', 'las estadísticas finales siguen disponibles'],
  ] as const)('answers the incomplete-timeline FAQ in %s without fabricating events', (language, question, fact) => {
    const matches = retrieveAssistantKnowledge(question, '/games', 4, language);
    expect(buildFallbackAssistantResponse(question, matches, language).answer).toContain(fact);
  });

  it('keeps knowledge identifiers and navigation paths stable across languages', () => {
    const french = getAssistantKnowledge();
    for (const language of ['en', 'es'] as const) {
      const entries = getAssistantKnowledge(language);
      expect(entries.map(({ id, path }) => ({ id, path }))).toEqual(french.map(({ id, path }) => ({ id, path })));
      entries.forEach((entry, index) => {
        expect(entry.title).not.toBe(french[index].title);
        expect(entry.steps).toHaveLength(french[index].steps.length);
        expect(entry.faq?.length || 0).toBe(french[index].faq?.length || 0);
      });
    }
    expect(normalizeAssistantLanguage('es; ignore the documentation')).toBe('fr');
  });

  it.each(['fr', 'en', 'es'] as const)('answers every documented FAQ with its matching answer in %s', language => {
    for (const entry of getAssistantKnowledge(language)) {
      for (const faq of entry.faq || []) {
        const matches = retrieveAssistantKnowledge(faq.question, entry.path, 4, language, entry.id);
        const response = buildFallbackAssistantResponse(faq.question, matches, language);
        expect(response.answer, faq.question).toBe(faq.answer);
        expect(response.sources[0].id, faq.question).toBe(entry.id);
      }
    }
  });

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

  it.each([
    ['fr', 'Comment créer les profils manquants pendant l’import ?', '/accueil', 'imports-and-games', 'Tu peux commencer l’import'],
    ['en', 'Do I need to create all profiles before importing?', '/accueil', 'imports-and-games', 'You can start importing'],
    ['es', '¿Tengo que crear todos los perfiles antes de importar?', '/accueil', 'imports-and-games', 'Puedes empezar a importar'],
    ['fr', 'Comment copier le multi OP.GG de toute l’équipe ?', '/equipes', 'teams-and-roster', 'les titulaires et les remplaçants'],
    ['en', 'How do I copy the whole team’s multi OP.GG?', '/equipes', 'teams-and-roster', 'starters and substitutes'],
    ['es', '¿Cómo copio el multi OP.GG de todo el equipo?', '/equipes', 'teams-and-roster', 'titulares y suplentes'],
    ['fr', 'Qui voit mes précisions de planning ?', '/planning', 'planning', '500 caractères'],
    ['en', 'Who can see my schedule notes?', '/planning', 'planning', '500-character'],
    ['es', '¿Quién ve mis notas del calendario?', '/planning', 'planning', '500 caracteres'],
    ['fr', 'Où lire les dégâts moyens aux champions ?', '/mon-profil/champions', 'player-profile', 'mesurés en fin de partie'],
    ['en', 'Where can I read average champion damage?', '/mon-profil/champions', 'player-profile', 'measured at the end'],
    ['es', '¿Dónde veo el daño medio a campeones?', '/mon-profil/champions', 'player-profile', 'se miden al final'],
    ['fr', 'Comment enregistrer un carnet de matchup ?', '/mon-profil/champions', 'player-profile', 'Enregistrer le carnet'],
    ['en', 'How do I save a matchup notebook?', '/mon-profil/champions', 'player-profile', 'Save notebook'],
    ['es', '¿Cómo guardo un cuaderno de enfrentamiento?', '/mon-profil/champions', 'player-profile', 'Guardar cuaderno'],
    ['fr', 'Comment lier mon compte Discord ?', '/parametres', 'discord', '/nxt lier'],
    ['en', 'How do I link my Discord account?', '/parametres', 'discord', '/nxt lier'],
    ['es', '¿Cómo vinculo mi cuenta de Discord?', '/parametres', 'discord', '/nxt lier'],
    ['fr', 'Que partagent les publications Discord ?', '/bot-discord', 'discord', 'notes privées du staff ne sont pas incluses'],
    ['en', 'What do Discord publications share?', '/bot-discord', 'discord', 'Private staff notes are not included'],
    ['es', '¿Qué comparten las publicaciones de Discord?', '/bot-discord', 'discord', 'notas privadas del cuerpo técnico no se incluyen'],
  ] as const)('answers the current workflow in %s: %s', (language, question, route, expected, fact) => {
    const matches = retrieveAssistantKnowledge(question, route, 4, language);
    expect(matches[0].id).toBe(expected);
    expect(buildFallbackAssistantResponse(question, matches, language).answer).toContain(fact);
  });

  it.each([
    ['fr', 'Comment retrouver les défaites d’un champion ?', '/tendances', 'champion-analysis', 'Revoir les défaites'],
    ['en', 'How do I find a champion’s losses?', '/tendances', 'champion-analysis', 'Review losses'],
    ['es', '¿Cómo encuentro las derrotas de un campeón?', '/tendances', 'champion-analysis', 'Revisar derrotas'],
    ['fr', 'Comment exporter ma carte en PNG ?', '/mon-profil', 'player-showcase', 'PNG'],
    ['en', 'How do I export my card as a PNG?', '/mon-profil', 'player-showcase', 'PNG'],
    ['es', '¿Cómo exporto mi tarjeta en PNG?', '/mon-profil', 'player-showcase', 'PNG'],
    ['fr', 'Où voir les réponses adverses à préparer ?', '/draft/compositions', 'compositions', 'champions adverses'],
    ['en', 'Where can I see enemy responses to prepare for?', '/draft/compositions', 'compositions', 'enemy champions'],
    ['es', '¿Dónde veo las respuestas rivales que preparar?', '/draft/compositions', 'compositions', 'campeones rivales'],
    ['fr', 'Comment exporter ma carte joueur ?', '/mon-profil/carte', 'player-showcase', 'PNG'],
    ['fr', 'Comment enregistrer un carnet de matchups ?', '/mon-profil/champions', 'player-profile', 'Enregistrer le carnet'],
    ['fr', 'Comment analyser les champions de l’équipe ?', '/tendances', 'champion-analysis', 'Champions'],
    ['en', 'How do I analyse the team’s champions?', '/tendances', 'champion-analysis', 'Champions'],
    ['es', '¿Cómo analizar los campeones del equipo?', '/tendances', 'champion-analysis', 'Campeones'],
    ['fr', 'Où comparer ses champions aux champions adverses ?', '/mon-profil/champions', 'player-profile', 'Matchups'],
    ['en', 'Where can I compare my champions with enemy champions?', '/mon-profil/champions', 'player-profile', 'Matchups'],
    ['es', '¿Dónde comparo mis campeones con los campeones rivales?', '/mon-profil/champions', 'player-profile', 'Enfrentamientos'],
  ] as const)('finds the updated instructions in %s: %s', (language, question, route, expected, fact) => {
    const matches = retrieveAssistantKnowledge(question, route, 4, language);
    expect(matches[0].id).toBe(expected);
    const response = buildFallbackAssistantResponse(question, matches, language);
    expect(response.answer).toContain(fact);
    expect(response.actions[0].path).toBe(matches[0].path);
  });

  it('keeps the adaptive home and new destinations available without allowing arbitrary paths', () => {
    for (const path of ['/accueil', '/bot-discord', '/mon-profil/carte']) {
      expect(safeAssistantRoute(path)).toBe(path);
      expect(sanitizeAssistantActions([{ label: 'Ouvrir', path }])).toEqual([{ label: 'Ouvrir', path }]);
    }
    expect(safeAssistantRoute('/mon-profil/secret')).toBe('/mon-equipe');
    expect(sanitizeAssistantActions([{ label: 'Indisponible', path: '/bot-discord/admin' }])).toEqual([]);
    const matches = retrieveAssistantKnowledge('Quel est mon prochain pas sur l’accueil ?', '/accueil');
    expect(matches[0].id).toBe('getting-started');
    expect(buildFallbackAssistantResponse('Quel est mon prochain pas sur l’accueil ?', matches).answer).toContain('selon ton rôle');
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
    expect(safeAssistantRoute('/secret')).toBe('/mon-equipe');
    expect(safeAssistantRoute('https://example.com')).toBe('/mon-equipe');
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
