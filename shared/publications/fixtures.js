/** Synthetic, explicitly labelled fixtures; never taken from an account or private game. */
export function publicationFixture({ timeline = true, longNames = false, incomplete = false, side = 'blue' } = {}) {
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const champions = ['Gnar', 'Viego', 'Ahri', 'Jinx', 'Nautilus', 'Ornn', 'Vi', 'Orianna', 'Ashe', 'Leona'];
  const participants = champions.map((champion, index) => ({
    team_key: index < 5 ? 'ALLY' : 'ENEMY', role: roles[index % 5], player_name: longNames ? `Joueur d’exemple au nom particulièrement long ${index + 1}` : `Joueur exemple ${index + 1}`, champion,
    kills: index < 5 ? [3, 6, 5, 8, 2][index] : [2, 4, 3, 7, 2][index - 5],
    deaths: index < 5 ? [4, 2, 3, 3, 6][index] : [4, 6, 5, 3, 6][index - 5],
    assists: index < 5 ? 8 + index : 3 + (index % 5) * 2, gold: (index < 5 ? 13000 : 12000) + (index % 5) * 125,
    damage: 19000 + index * 750, vision: 17 + index * 5, cs: index % 5 === 4 ? 38 : 160 + index * 8,
    raw: { participantId: index + 1, teamId: (index < 5) === (side === 'blue') ? 100 : 200, summoner1Id: 4, summoner2Id: index % 5 === 0 ? 12 : index % 5 === 1 ? 11 : 14, item0: 3006, item1: 3031, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340 },
  }));
  const match = { id: 'example-match', team_id: 'example-team', game_id: 'EXEMPLE_2026', result: 'Victoire', side: side.toUpperCase(), duration: '31:42', patch: '16.18', category_ids: ['scrims'], opponent: longNames ? 'Adversaires de démonstration avec un nom de groupe très long' : 'Équipe démo B', participants,
    raw: { info: { gameDuration: 1902, gameStartTimestamp: 1789480800000, teams: [100, 200].map((teamId) => ({ teamId, objectives: { dragon: { kills: teamId === 100 ? 3 : 1 }, baron: { kills: teamId === 100 ? 1 : 0 }, tower: { kills: teamId === 100 ? 8 : 4 }, riftHerald: { kills: 0 }, horde: { kills: 3 } } })) } },
  };
  if (timeline) match.raw.timeline = { info: { frames: [{ timestamp: 600000, participantFrames: Object.fromEntries(participants.map((row) => [row.raw.participantId, { minionsKilled: 70, jungleMinionsKilled: 10, totalGold: 3500 }])), events: [
    { type: 'CHAMPION_KILL', timestamp: 602000, killerId: 4, victimId: 7, assistingParticipantIds: [3, 5] },
    { type: 'CHAMPION_KILL', timestamp: 615000, killerId: 3, victimId: 8, assistingParticipantIds: [4] },
  ] }] } };
  if (incomplete) { match.participants = participants.slice(0, 8); match.participants[0].gold = null; match.raw.info.teams[0].objectives.dragon.kills = null; }
  return { team: { id: 'example-team', name: longNames ? 'NXT5 · Équipe de démonstration au nom particulièrement long' : 'NXT5 · Équipe démo A' }, match, categories: [{ id: 'scrims', name: 'Exemple fictif · Scrims' }], sourceRevision: 'fixture-1', generatedAt: '2026-09-15T12:00:00Z' };
}
