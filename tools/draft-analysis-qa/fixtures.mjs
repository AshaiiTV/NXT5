// Entirely fictional, deterministic data for local UI verification only.
export const teamId = 'qa-draft-team';
export const team = { id: teamId, name: 'NXT5 · équipe fictive', tag: 'QA', region: 'EUW' };
export const scenarios = ['full', 'missing-order', 'partial-bans', 'no-pools', 'unlinked', 'empty', 'error', 'loading', 'no-team'];
export const opponentScenarios = ['full', 'readonly', 'no-opponents', 'empty-dossier', 'error', 'loading', 'no-team'];

const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const names = ['Atlas', 'Nyx', 'Solis', 'Echo', 'Rune'];
export const players = roles.map((role, index) => ({
  id: `qa-player-${index + 1}`, team_id: teamId, name: names[index], role, status: 'starter',
}));
const pools = [
  ['Aatrox', 'Gwen', 'Jax', 'Gnar'],
  ['Poppy', 'Viego', 'Sejuani', 'MonkeyKing'],
  ['Ahri', 'Orianna', 'Syndra', 'Azir'],
  ['Jinx', 'Kaisa', 'Ezreal', 'Xayah'],
  ['Rakan', 'Nautilus', 'Braum', 'Thresh'],
];
export const championPool = players.flatMap((player, roleIndex) => pools[roleIndex].map((champion, index) => ({
  id: `qa-pool-${roleIndex}-${index}`, team_id: teamId, player_id: player.id, role: player.role,
  champion, status: ['lock', 'lock', 'pocket', 'work'][index], source: 'manual',
})));
export const opponents = [
  { id: 'qa-orion', name: 'Orion Academy · fictif' },
  { id: 'qa-helix', name: 'Helix · fictif' },
  { id: 'qa-long-name', name: 'Association esport des champions du vendredi soir · fictif' },
  { id: 'qa-no-drafts', name: 'Équipe sans draft · fictif' },
];

const enemyRolePicks = ['Renekton', 'Maokai', 'Sylas', 'Ashe', 'Leona'];
// Role composition is separate from draft selection order. This lets QA verify
// that a selected slot is never silently presented as a played role.
const configurations = [
  { side: 'blue', first: 'blue', picks: ['Gwen', 'Viego', 'Orianna', 'Jinx', 'Rakan'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Jax'] },
  { side: 'red', first: 'blue', picks: ['Gwen', 'Sejuani', 'Orianna', 'Kaisa', 'Nautilus'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Jax'] },
  { side: 'blue', first: 'blue', picks: ['Gnar', 'Viego', 'Syndra', 'Jinx', 'Rakan'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Gwen'] },
  { side: 'red', first: 'red', picks: ['Gwen', 'Sejuani', 'Orianna', 'Ezreal', 'Nautilus'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Jax'] },
  { side: 'blue', first: 'blue', picks: ['Jax', 'Viego', 'Orianna', 'Jinx', 'Braum'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Gwen'] },
  { side: 'red', first: 'blue', picks: ['Gwen', 'Sejuani', 'Azir', 'Kaisa', 'Rakan'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Orianna'] },
  { side: 'blue', first: 'blue', picks: ['Gnar', 'Viego', 'Orianna', 'Jinx', 'Nautilus'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Jax'] },
  { side: 'red', first: 'red', picks: ['Aatrox', 'Sejuani', 'Syndra', 'Ezreal', 'Braum'], bans: ['Gwen', 'Poppy', 'Kalista', 'Ahri', 'Jax'] },
  { side: 'blue', first: 'blue', picks: ['Gwen', 'Viego', 'Ahri', 'Xayah', 'Rakan'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Syndra', 'Jax'] },
  { side: 'red', first: 'blue', picks: ['Gnar', 'Sejuani', 'Orianna', 'Kaisa', 'Nautilus'], bans: ['Aatrox', 'Poppy', 'Kalista', 'Ahri', 'Jax'], legacy: true },
  { side: 'blue', first: 'blue', picks: ['Gwen', 'Viego', 'Syndra', 'Jinx', 'Braum'], bans: ['Aatrox', 'Poppy', 'Kalista', null, 'Jax'], missing: true },
  { side: 'red', first: 'red', picks: ['Aatrox', 'Sejuani', 'Orianna', 'Ezreal', 'Rakan'], bans: ['Gwen', 'Poppy', 'Kalista', null, 'Jax'], skipped: true },
];
const ownBans = ['Yone', 'Aurora', 'Varus', 'Kennen', 'Vi'];
const selectionOrder = [3, 1, 4, 0, 2];
const reverseSide = side => side === 'blue' ? 'red' : 'blue';

export const drafts = configurations.map((configuration, index) => {
  const { side, first, picks, bans, legacy, skipped } = configuration;
  const enemySide = reverseSide(side);
  const sourceId = `qa-series-${Math.floor(index / 3) + 1}`;
  const gameNumber = index % 3 + 1;
  const opponentId = index < 6 ? opponents[0].id : index < 9 ? opponents[1].id : index === 9 ? opponents[2].id : null;
  const opponentName = opponents.find(opponent => opponent.id === opponentId)?.name || 'Draft sans équipe liée · fictif';
  const snapshot = {
    source: 'drafter.lol', status: 'completed', sourceId, sourceDraftId: `qa-draft-${index + 1}`,
    // Local source URLs deliberately prevent a QA click from opening a live draft.
    sourceUrl: `/tendances?rubrique=drafts&qa=full&draft=qa-draft-${index + 1}`, gameNumber, firstPick: first,
    [`${side}Name`]: team.name, [`${enemySide}Name`]: opponentName,
    [`${side}Picks`]: selectionOrder.map(roleIndex => picks[roleIndex]),
    [`${enemySide}Picks`]: [1, 3, 4, 2, 0].map(roleIndex => enemyRolePicks[roleIndex]),
    [`${side}Bans`]: [...ownBans], [`${enemySide}Bans`]: [...bans],
    ...(!legacy ? { orderEvidence: { version: 1, basis: 'reconstructed-public-slots', format: 'standard-20', firstPick: first, reason: 'public-slot-fields-v1' } } : {}),
    banStates: { [side]: ownBans.map(() => 'selected'), [enemySide]: bans.map(value => value ? 'selected' : skipped ? 'skipped' : 'unknown') },
    warnings: [],
  };
  return {
    id: `qa-draft-${index + 1}`, teamId, sourceId, gameNumber, opponentId, allySide: side, snapshot,
    matchId: index < 10 ? `qa-match-${index + 1}` : null,
    importedAt: `2026-10-${String(12 - index).padStart(2, '0')}T18:00:00.000Z`,
  };
});

export const matches = drafts.filter(draft => draft.matchId).map((draft, index) => ({
  id: draft.matchId, team_id: teamId, game_id: `QA-LOCAL-${index + 1}`, opponent_id: draft.opponentId,
  opponent: `${draft.snapshot[`${reverseSide(draft.allySide)}Name`]} · G${draft.gameNumber}`,
  result: index % 3 ? 'Win' : 'Loss', side: draft.allySide === 'blue' ? 'Blue' : 'Red',
  played_at: draft.importedAt, created_at: draft.importedAt, duration: 1800 + index * 45,
  raw: { nxt5: { side: draft.allySide, allyTeamId: draft.allySide === 'blue' ? 100 : 200 } },
  participants: ['ALLY', 'ENEMY'].flatMap((teamKey, teamIndex) => roles.map((role, roleIndex) => ({
    id: `qa-participant-${index}-${teamIndex}-${roleIndex}`, team_key: teamKey, role,
    player_id: teamKey === 'ALLY' ? players[roleIndex].id : null,
    champion: teamKey === 'ALLY' ? configurations[index].picks[roleIndex] : enemyRolePicks[roleIndex],
    summoner_name: teamKey === 'ALLY' ? names[roleIndex] : `Adversaire fictif ${roleIndex + 1}`,
    kills: 2 + roleIndex, deaths: 2 + (index % 3), assists: 6 + roleIndex,
    gold: 10000 + roleIndex * 300, cs: 80 + roleIndex * 20,
    raw: { participantId: teamIndex * 5 + roleIndex + 1, teamPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][roleIndex] },
  }))),
}));

export function getFixture(scenario = 'full') {
  const selected = scenarios.includes(scenario) ? scenario : 'full';
  let selectedDrafts = drafts;
  if (selected === 'empty') selectedDrafts = [];
  if (selected === 'missing-order') selectedDrafts = drafts.map(draft => ({ ...draft, snapshot: { ...draft.snapshot, orderEvidence: undefined } }));
  if (selected === 'partial-bans') selectedDrafts = drafts.slice(-2);
  if (selected === 'unlinked') selectedDrafts = drafts.map(draft => ({ ...draft, matchId: null, opponentId: null }));
  return {
    scenario: selected,
    payload: { opponents, drafts: selectedDrafts },
    data: { teams: [team], selectedTeamId: selected === 'no-team' ? '' : teamId,
      players, championPool: selected === 'no-pools' ? [] : championPool,
      matches: selected === 'unlinked' ? [] : matches,
      teamMembers: [], reports: [], matchCategories: [], matchArchives: [], availability: [], compositions: [],
      improvements: [], inviteCodes: [], profileCoachingNotes: [], playerGoals: [],
    },
  };
}

// The dossiers endpoint uses a compact camelCase contract distinct from the
// bootstrap match records consumed by GameWorkspace. Keep both faithful.
const dossierOpponents = [
  { ...opponents[0], notes: 'Exemple fictif. Préparer un plan si Poppy et Aatrox sont retirés tôt.\nVérifier en débrief comment leurs premières sélections influencent notre deuxième phase.', createdAt: '2026-09-15T10:00:00.000Z' },
  { ...opponents[1], notes: 'Exemple fictif. Deux séances récentes : regarder les choix de botlane et les options encore disponibles après trois picks.', createdAt: '2026-09-18T10:00:00.000Z' },
  { ...opponents[2], notes: 'Nom volontairement long pour vérifier le retour à la ligne dans l’annuaire, le dossier et les actions. Toutes les observations de ce dossier sont des exemples.', createdAt: '2026-09-21T10:00:00.000Z' },
  { ...opponents[3], notes: 'Premier rendez-vous prévu. Aucun match observé pour le moment.', createdAt: '2026-10-10T10:00:00.000Z' },
  { id: 'qa-aurora', name: 'Aurora Rising · fictif', notes: '', createdAt: '2026-10-10T11:00:00.000Z' },
  { id: 'qa-nova', name: 'Nova Five · fictif', notes: 'À rencontrer prochainement.', createdAt: '2026-10-11T11:00:00.000Z' },
];
const extraEnemyPicks = [
  ['Gnar', 'Viego', 'Orianna', 'Jinx', 'Nautilus'],
  ['Renekton', 'Sejuani', 'Ahri', 'Ashe', 'Leona'],
  ['Gwen', 'Maokai', 'Syndra', 'Ezreal', 'Braum'],
  ['Jax', 'Viego', 'Orianna', 'Kaisa', 'Nami'],
];
const dossierMatches = [
  ...matches.map((match, index) => ({
    ...match,
    result: index === 8 ? 'Analyse' : index % 3 ? 'Victoire' : 'Défaite',
    participants: index === 1 || index === 3 ? match.participants.filter(row => row.team_key === 'ALLY')
      : index === 4 ? match.participants.filter(row => row.team_key === 'ALLY' || row.role === 'ADC') : match.participants,
  })),
  ...extraEnemyPicks.map((picks, index) => {
    const date = `2026-09-${String(28 - index).padStart(2, '0')}T18:30:00.000Z`;
    return { ...matches[index], id: `qa-extra-match-${index + 1}`, game_id: `QA-DOSSIER-${index + 1}`,
      opponent_id: index < 3 ? 'qa-orion' : 'qa-helix',
      opponent: `${index < 3 ? 'Orion Academy' : 'Helix'} · séance précédente G${index + 1} · fictif`,
      created_at: date, played_at: date, result: index === 2 ? 'Analyse' : index % 2 ? 'Victoire' : 'Défaite',
      participants: matches[index].participants.map(row => row.team_key === 'ENEMY' ? { ...row, id: `qa-extra-${index}-${row.team_key}-${row.role}`, champion: picks[roles.indexOf(row.role)] } : { ...row, id: `qa-extra-${index}-${row.team_key}-${row.role}` }),
    };
  }),
];
const dossierDrafts = drafts.map((draft, index) => ({
  ...draft,
  // One incomplete match has no linked draft, so the dossier must retain an
  // explicit unknown observation instead of quietly manufacturing a lineup.
  ...(index === 4 ? { matchId: null, opponentId: null } : {}),
  snapshot: { ...draft.snapshot, patch: index < 6 ? '26.20' : '26.19' },
}));
const dossierGroups = [
  { id: 'qa-group-orion-1', name: 'Orion · préparation du 12 octobre · fictif', opponentId: 'qa-orion', matchIds: ['qa-match-1', 'qa-match-2', 'qa-match-3'], updatedAt: '2026-10-12T20:00:00.000Z' },
  { id: 'qa-group-orion-2', name: 'Orion · deuxième bloc et débrief collectif · fictif', opponentId: 'qa-orion', matchIds: ['qa-match-4', 'qa-match-5', 'qa-match-6'], updatedAt: '2026-10-09T20:00:00.000Z' },
  { id: 'qa-group-orion-review', name: 'Sélection pour le débrief · mêmes parties, aucun doublon statistique', opponentId: 'qa-orion', matchIds: ['qa-match-1', 'qa-match-4'], updatedAt: '2026-10-12T21:00:00.000Z' },
  { id: 'qa-group-helix', name: 'Helix · entraînement du soir · fictif', opponentId: 'qa-helix', matchIds: ['qa-match-7', 'qa-match-8', 'qa-match-9'], updatedAt: '2026-10-06T20:00:00.000Z' },
  { id: 'qa-group-long', name: 'Session de préparation avec l’association esport des champions du vendredi soir · fictif', opponentId: 'qa-long-name', matchIds: ['qa-match-10'], updatedAt: '2026-10-03T20:00:00.000Z' },
  { id: 'qa-group-empty', name: 'Premier scrim à venir · aucune partie pour le moment', opponentId: 'qa-no-drafts', matchIds: [], updatedAt: '2026-10-12T10:00:00.000Z' },
];

export function getOpponentFixture(scenario = 'full') {
  const selected = opponentScenarios.includes(scenario) ? scenario : 'full';
  const base = getFixture(selected);
  const noOpponents = selected === 'no-opponents';
  const selectedOpponents = noOpponents ? [] : dossierOpponents;
  const selectedMatches = noOpponents ? [] : dossierMatches;
  const selectedGroups = noOpponents ? [] : dossierGroups;
  const opponentMatches = selectedMatches.map(match => {
    const enemies = match.participants.filter(row => row.team_key === 'ENEMY');
    const enemyPicks = [...new Set(enemies.map(row => row.champion))];
    return { id: match.id, opponentId: match.opponent_id, gameId: match.game_id, label: match.opponent,
      date: match.played_at, result: match.result, enemyPicks, enemyPicksComplete: enemies.length === 5 && enemyPicks.length === 5 };
  });
  return {
    ...base, scenario: selected, defaultOpponentId: selected === 'empty-dossier' ? 'qa-no-drafts' : '',
    payload: { opponents: selectedOpponents, opponentMatches, opponentGroups: selectedGroups,
      drafts: noOpponents ? [] : dossierDrafts, canEdit: !['readonly', 'no-team'].includes(selected),
      limits: { opponents: 100, drafts: 200, opponentMatches: 2000, opponentGroups: 2000 } },
    data: { ...base.data, matches: selectedMatches,
      matchArchives: selectedGroups.map(group => ({ id: group.id, team_id: teamId, name: group.name,
        description: 'Groupe de démonstration locale. Données entièrement fictives.', match_ids: group.matchIds,
        opponent_id: group.opponentId, opponent_name: selectedOpponents.find(opponent => opponent.id === group.opponentId)?.name,
        updated_at: group.updatedAt, created_at: group.updatedAt, created_by: 'qa-user', created_by_name: 'Coach · QA locale' })),
    },
  };
}
