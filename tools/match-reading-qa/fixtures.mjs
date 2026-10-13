// Deterministic invented match data. No exported customer match or account is used.
export const teamId = 'qa-match-reading-team';
export const team = { id: teamId, name: 'Nova Five · équipe fictive', tag: 'QA', region: 'EUW' };
export const scenarios = [
  ['full', 'Partie complète · 27 relevés'],
  ['compact', 'Chronologie résumée · événements seuls'],
  ['no-timeline', 'Sans chronologie'],
  ['partial', 'Statistiques et relevés incomplets'],
  ['long-names', 'Noms et titre longs'],
];
const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const champions = [['Ornn', 'Sejuani', 'Ahri', 'Jinx', 'Rakan'], ['Renekton', 'Viego', 'Syndra', 'Ashe', 'Nautilus']];
const names = [['Atlas', 'Nyx', 'Solis', 'Echo', 'Rune'], ['Quartz', 'Lynx', 'Vega', 'Eclipse', 'Mistral']];
const seconds = value => Math.round(value * 1000);
const kill = (time, killerId, victimId, assistingParticipantIds = [], shutdownBounty = 0) => ({
  type: 'CHAMPION_KILL', timestamp: seconds(time), killerId, victimId, assistingParticipantIds,
  shutdownBounty, position: { x: 7400 + killerId * 80, y: 5200 + victimId * 90 },
});
const monster = (time, monsterType, killerId, monsterSubType) => ({
  type: 'ELITE_MONSTER_KILL', timestamp: seconds(time), monsterType, killerId,
  killerTeamId: killerId <= 5 ? 100 : 200, ...(monsterSubType ? { monsterSubType } : {}),
});
const tower = (time, killerId, teamId, laneType, towerType = 'OUTER_TURRET') => ({
  type: 'BUILDING_KILL', timestamp: seconds(time), killerId, teamId, laneType, towerType, buildingType: 'TOWER_BUILDING',
});
export const events = [
  kill(194, 7, 2, [8]), kill(248, 3, 8, [2]),
  monster(320, 'DRAGON', 7, 'FIRE_DRAGON'),
  ...[361, 366, 372].map(time => monster(time, 'HORDE', 2)),
  kill(455, 4, 9, [5]), kill(461, 4, 10, [5]), kill(470, 7, 5, [9]),
  tower(584, 6, 100, 'TOP_LANE'),
  kill(603, 8, 3, [7], 450),
  monster(651, 'DRAGON', 7, 'WATER_DRAGON'),
  ...[718, 721, 728].map(time => monster(time, 'HORDE', 7)),
  tower(749, 4, 200, 'BOT_LANE'),
  kill(762, 7, 2, [8]), kill(770, 8, 3, [7]), kill(779, 3, 8, [1]),
  tower(822, 8, 100, 'MID_LANE'),
  monster(894, 'RIFTHERALD', 2),
  kill(954, 4, 9, [2, 5]), kill(961, 3, 8, [2]), kill(967, 4, 10, [5]), kill(974, 7, 5, [6]),
  monster(1002, 'DRAGON', 2, 'AIR_DRAGON'),
  tower(1053, 3, 200, 'MID_LANE'),
  kill(1118, 7, 2, [8], 300),
  kill(1241, 3, 8, [2]), kill(1248, 4, 9, [5]), kill(1256, 1, 6, [3]),
  monster(1281, 'BARON_NASHOR', 2),
  monster(1331, 'DRAGON', 2, 'AIR_DRAGON'),
  kill(1451, 4, 10, [5]), kill(1460, 3, 7, [1]), kill(1468, 8, 3, [6]),
  { ...tower(1512, 4, 200, 'MID_LANE', 'BASE_TURRET'), buildingType: 'INHIBITOR_BUILDING' },
  kill(1562, 4, 9, [2, 5]), kill(1570, 4, 8, [1, 5]), kill(1578, 3, 6, [2]),
  tower(1585, 4, 200, 'MID_LANE', 'NEXUS_TURRET'),
].sort((a, b) => a.timestamp - b.timestamp);

function participant(teamIndex, roleIndex) {
  const id = teamIndex * 5 + roleIndex + 1;
  const gold = [11340, 10520, 12310, 14620, 7940, 11210, 11450, 11200, 11980, 7500][id - 1];
  const damage = [16640, 11280, 25700, 32910, 6540, 20300, 18100, 23600, 24210, 7240][id - 1];
  const physical = Math.round(damage * ([0.18, 0.12, 0.05, 0.93, 0.22][roleIndex]));
  const magic = Math.round((damage - physical) * 0.96);
  return {
    id: `qa-participant-${id}`, participant_id: id, player_id: teamIndex ? null : `qa-player-${id}`,
    team_key: teamIndex ? 'ENEMY' : 'ALLY', role: roles[roleIndex], champion: champions[teamIndex][roleIndex],
    summoner_name: names[teamIndex][roleIndex], riot_id: `${names[teamIndex][roleIndex]}#QA`,
    kills: events.filter(event => event.type === 'CHAMPION_KILL' && event.killerId === id).length,
    deaths: events.filter(event => event.type === 'CHAMPION_KILL' && event.victimId === id).length,
    assists: events.filter(event => event.type === 'CHAMPION_KILL' && event.assistingParticipantIds.includes(id)).length,
    gold, damage, vision: [28, 39, 32, 21, 64][roleIndex] - teamIndex * 3,
    cs: [212, 171, 238, 261, 38][roleIndex] - teamIndex * 5,
    raw: {
      participantId: id, teamId: teamIndex ? 200 : 100, championName: champions[teamIndex][roleIndex],
      teamPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][roleIndex],
      physicalDamageDealtToChampions: physical, magicDamageDealtToChampions: magic,
      trueDamageDealtToChampions: damage - physical - magic,
      summoner1Id: 4, summoner2Id: roleIndex === 1 ? 11 : roleIndex === 4 ? 14 : 12,
    },
  };
}

function fullMatch() {
  const participants = [0, 1].flatMap(teamIndex => roles.map((_, roleIndex) => participant(teamIndex, roleIndex)));
  participants.forEach(row => {
    const teamKills = participants.filter(player => player.team_key === row.team_key).reduce((sum, player) => sum + player.kills, 0);
    row.kill_participation = teamKills ? Math.round((row.kills + row.assists) / teamKills * 100) : 0;
  });
  const frames = Array.from({ length: 27 }, (_, minute) => ({
    timestamp: minute * 60000,
    participantFrames: Object.fromEntries(participants.map((row, index) => {
      const ally = index < 5;
      const progress = minute / 26;
      const drift = ally ? (minute < 5 ? minute * 15 : minute < 14 ? -minute * 45 : -630 * (26 - minute) / 12) : 0;
      return [String(index + 1), {
        participantId: index + 1, totalGold: Math.max(500, Math.round(500 + (row.gold - 500) * progress + drift)),
        minionsKilled: Math.round(row.cs * progress * (row.role === 'JGL' ? 0.1 : 0.94)),
        jungleMinionsKilled: Math.round(row.cs * progress * (row.role === 'JGL' ? 0.9 : 0.06)),
        xp: Math.round(minute * (row.role === 'SUP' ? 350 : 520)), level: Math.max(1, Math.min(18, Math.round(minute * 0.6 + 1))),
      }];
    })),
    events: events.filter(event => Math.min(26, Math.ceil(event.timestamp / 60000)) === minute),
  }));
  return {
    id: 'qa-match-reading-full', team_id: teamId, game_id: 'QA-LOCAL-EXAMPLE', patch: '26.20', result: 'Victoire', side: 'blue', duration: '26:42',
    game_date: '2026-10-13T17:00:00.000Z', created_at: '2026-10-13T17:30:00.000Z',
    participants,
    raw: {
      nxt5Label: 'Nova Five × Orion · partie fictive',
      info: { gameDuration: 1602, participants: participants.map(row => row.raw), teams: [
        { teamId: 100, objectives: { dragon: { kills: 2 }, baron: { kills: 1 }, riftHerald: { kills: 1 }, horde: { kills: 3 }, tower: { kills: 7 } } },
        { teamId: 200, objectives: { dragon: { kills: 2 }, baron: { kills: 0 }, riftHerald: { kills: 0 }, horde: { kills: 3 }, tower: { kills: 3 } } },
      ] },
      timeline: { info: { frames } },
    },
  };
}

export function getFixture(requested = 'full') {
  const scenario = scenarios.some(([key]) => key === requested) ? requested : 'full';
  const match = fullMatch();
  const currentTeam = { ...team };
  match.id = `qa-match-reading-${scenario}`;
  if (scenario === 'compact') {
    delete match.raw.timeline;
    match.raw.nxt5 = { timelineEvents: structuredClone(events), timelineSummary: { available: true, csMilestones: {} } };
  }
  if (scenario === 'no-timeline') delete match.raw.timeline;
  if (scenario === 'partial') {
    match.participants = match.participants.filter(row => row.participant_id !== 10);
    for (const key of ['gold', 'damage', 'vision', 'cs']) delete match.participants[1][key];
    delete match.participants[1].raw.physicalDamageDealtToChampions;
    delete match.participants[1].raw.magicDamageDealtToChampions;
    delete match.participants[1].raw.trueDamageDealtToChampions;
    match.raw.timeline.info.frames.forEach(frame => delete frame.participantFrames['2']);
    match.participants[0].vision = 0; // An observed zero must remain distinct from an absent value.
  }
  if (scenario === 'long-names') {
    currentTeam.name = 'Association esport des cinq explorateurs du vendredi soir · équipe fictive';
    match.raw.nxt5Label = 'Session de préparation avec l’Association des joueurs passionnés de la Côte d’Azur · partie et noms fictifs';
    match.participants.forEach((row, index) => { row.summoner_name = `${row.summoner_name} — ${index % 2 ? 'JoueurAuNomTrèsLongSansEspacePourLeTest' : 'le gardien des grandes constellations'}`; });
  }
  return { scenario, team: currentTeam, match };
}
