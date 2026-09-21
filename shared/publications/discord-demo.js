import { buildGamePublicationSnapshot } from './game-publication.js';

/** Fixed, invented data only: a connection test must never read a team's games. */
export function buildDiscordDemoSnapshot() {
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const champions = ['Gnar', 'Vi', 'Ahri', 'Jinx', 'Braum'];
  const participants = ['ALLY', 'ENEMY'].flatMap((teamKey, side) => roles.map((role, index) => ({
    team_key: teamKey, role, player_name: `Joueur fictif ${side * 5 + index + 1}`, champion: champions[index],
    kills: side ? [2, 3, 4, 3, 1][index] : [3, 4, 5, 6, 1][index],
    deaths: side ? [3, 4, 5, 6, 1][index] : [2, 3, 4, 3, 1][index],
    assists: side ? [3, 4, 3, 2, 8][index] : [6, 7, 6, 5, 12][index],
    gold: 12000 + index * 400 - side * 600, damage: 18000 + index * 1500 - side * 1000,
    vision: 25 + index * 12, cs: 190 + index * 8,
    raw: { participantId: side * 5 + index + 1, teamId: side ? 200 : 100 },
  })));
  return buildGamePublicationSnapshot({
    team: { id: 'demo-team', name: 'TEST · Équipe fictive' },
    match: { id: 'demo-game', team_id: 'demo-team', game_id: 'EXEMPLE FICTIF', opponent: 'Adversaires fictifs',
      result: 'Victoire', duration: '28:30', side: 'blue', participants, category_ids: ['demo'],
      raw: { info: { teams: [
        { teamId: 100, objectives: { dragon: { kills: 3 }, baron: { kills: 1 }, tower: { kills: 8 } } },
        { teamId: 200, objectives: { dragon: { kills: 1 }, baron: { kills: 0 }, tower: { kills: 3 } } },
      ] } } },
    categories: [{ id: 'demo', name: 'DÉMONSTRATION · aucune game réelle' }],
  });
}
