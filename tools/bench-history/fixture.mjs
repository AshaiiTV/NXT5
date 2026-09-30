export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const userId = id(1), teamId = id(2), categoryId = id(3);
const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const champions = ['Ornn', 'Vi', 'Orianna', 'Jinx', 'Nautilus', 'Gnar', 'LeeSin', 'Ahri', 'Ezreal', 'Leona'];
export const roster = roles.map((role, i) => ({ id: id(10 + i), team_id: teamId, role, name: `Player${i}`, riot_id: `Player${i}#EUW` }));

// Same importArgs contract as match-import-atomic.test.ts, extended with a
// deterministic Match-V5 timeline, items, spells, objectives and CS milestones.
export function importArgs(seed) {
  const red = seed % 2 === 1, win = seed % 3 !== 0;
  const duration = 1500 + (seed % 10) * 60;
  const gameId = `EUW1_${1000000000 + seed}`;
  const participants = Array.from({ length: 10 }, (_, i) => ({
    participantId: i + 1, teamId: i < 5 ? 100 : 200,
    championId: [516, 254, 61, 222, 111, 150, 64, 103, 81, 89][(i + seed) % 10],
    championName: champions[(i + seed) % 10],
    summonerName: `Player${i}`, riotIdGameName: `Player${i}`, riotIdTagline: 'EUW',
    puuid: `synthetic-${seed}-${i}`, teamPosition: positions[i % 5], individualPosition: positions[i % 5],
    kills: 2 + (seed + i) % 7, deaths: 1 + (seed + i) % 5, assists: 4 + i,
    totalMinionsKilled: i % 5 === 4 ? 30 : 170 + seed + i,
    neutralMinionsKilled: i % 5 === 1 ? 140 : 8,
    goldEarned: 9500 + seed * 100 + i * 150,
    totalDamageDealtToChampions: 14000 + i * 1100,
    physicalDamageDealtToChampions: 7000 + i * 700,
    magicDamageDealtToChampions: 6000 + i * 300,
    trueDamageDealtToChampions: 1000 + i * 100,
    damageDealtToTurrets: 700 + i * 200, visionScore: 20 + i * 4,
    timePlayed: duration, summoner1Id: 4, summoner2Id: i % 5 === 1 ? 11 : 12,
    item0: 1055, item1: 3006, item2: 3031, item3: 3085, item4: 1036, item5: 2003, item6: 3340,
    challenges: { laneMinionsFirst10Minutes: i % 5 === 4 ? 5 : 60 + i },
    perks: { styles: [{ style: 8000, selections: [{ perk: 8005, var1: 120, var2: 20, var3: 0 }] }] },
  }));
  const frames = Array.from({ length: duration / 60 + 1 }, (_, minute) => ({
    timestamp: minute * 60000,
    participantFrames: Object.fromEntries(participants.map((p, i) => [p.participantId, {
      participantId: p.participantId, minionsKilled: minute * (i % 5 === 4 ? 1 : 6),
      jungleMinionsKilled: minute * (i % 5 === 1 ? 5 : 0),
      totalGold: 500 + minute * 330 + i * 10, xp: minute * 400,
      position: { x: 2500 + minute * 80 + i * 120, y: 3000 + minute * 90 + i * 140 },
    }])),
    events: minute === 0 ? [] : [
      ...participants.map((p) => ({ type: 'ITEM_PURCHASED', timestamp: minute * 60000, participantId: p.participantId, itemId: 1001 + minute % 5 })),
      { type: 'WARD_PLACED', timestamp: minute * 60000, creatorId: 5, wardType: 'YELLOW_TRINKET', position: { x: 7500, y: 6500 } },
      ...(minute % 3 === 0 ? [{ type: 'CHAMPION_KILL', timestamp: minute * 60000, killerId: 1, victimId: 6, assistingParticipantIds: [2, 3], position: { x: 7000, y: 7000 } }] : []),
      ...(minute % 5 === 0 ? [{ type: 'ELITE_MONSTER_KILL', timestamp: minute * 60000, killerId: 2, killerTeamId: 100, monsterType: minute >= 20 ? 'BARON_NASHOR' : 'DRAGON', monsterSubType: 'FIRE_DRAGON' }] : []),
    ],
  }));
  return {
    team: { id: teamId, name: 'History benchmark' }, userId, gameId, roster,
    label: `Scrim ${seed}`, categoryIds: [categoryId], allyTeamSide: red ? 'RED' : 'BLUE',
    laneAssignments: Object.fromEntries(roles.map((role, i) => [role, `participant:${(red ? 5 : 0) + i + 1}`])),
    enemyLaneAssignments: Object.fromEntries(roles.map((role, i) => [role, `participant:${(red ? 0 : 5) + i + 1}`])),
    playerAssignments: Object.fromEntries(roster.map((p) => [p.role, p.id])),
    match: {
      metadata: { matchId: gameId, source: 'import' },
      info: { gameDuration: duration, gameVersion: '16.18.1', gameCreation: Date.parse('2026-01-01') + seed * 3600000,
        participants, teams: [100, 200].map((side) => ({ teamId: side, win: (side === (red ? 200 : 100)) === win,
          objectives: Object.fromEntries(['baron', 'dragon', 'tower', 'riftHerald', 'horde', 'inhibitor', 'champion'].map((kind, i) => [kind, { first: side === 100, kills: i + 1 }])) })) },
      timeline: { info: { frames } },
    },
  };
}
