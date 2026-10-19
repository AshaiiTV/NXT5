// Single source of truth for the fictitious game used by the tutorial captures (team « Équipe Démo », coach « Coach Démo »).
// - buildExportFile(): the nxt5-EUW1_7861632138.json file « exported » by NXT5 Importer (v5 envelope, Riot match-v5 shape).
// - participantsRows(): the same game as stored by NXT5 after the import (match_participants rows of the intercepted API).
// Champions are single-word names with plausible lanes (no label that renders oddly, e.g. no « Fiddle Sticks »).
const GAME_ID = 'EUW1_7861632138';
const GAME_CREATION = Date.parse('2026-10-18T19:05:00Z'); // 21:05, heure de Paris
const DURATION = 1500; // 25 min 00, as shown by the Importer
const EXPORTED_AT = '2026-10-18T19:42:00.000Z';
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const NXT5_ROLES = { TOP: 'TOP', JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

// [name, champion, championId, k, d, a, minions, neutral, gold, damage, vision, items, spells]
const ALLIES = [
  ['Kairo', 'Garen', 86, 4, 2, 6, 182, 8, 10400, 18500, 18, [3047, 3071, 3053, 6631, 1036, 0, 3340], [4, 12]],
  ['Lynx', 'Sejuani', 113, 3, 2, 12, 24, 128, 8700, 9800, 32, [3111, 3068, 3075, 1011, 0, 0, 3364], [4, 11]],
  ['Vesper', 'Ahri', 103, 7, 3, 8, 204, 6, 11200, 22600, 21, [3020, 6655, 4645, 1058, 0, 0, 3340], [4, 14]],
  ['Orion', 'Jinx', 222, 8, 2, 7, 226, 4, 11800, 24100, 17, [3006, 3031, 3046, 3094, 0, 0, 3363], [4, 7]],
  ['Sora', 'Thresh', 412, 0, 2, 15, 28, 0, 6900, 6200, 64, [3117, 3190, 3109, 0, 0, 0, 3364], [4, 3]],
];
const ENEMIES = [
  ['Rook', 'Darius', 122, 3, 5, 4, 171, 4, 8900, 15200, 14, [3047, 3078, 3053, 0, 0, 0, 3340], [4, 12]],
  ['Ember', 'Vi', 254, 2, 4, 6, 22, 108, 7600, 9100, 24, [3111, 6692, 3071, 0, 0, 0, 3364], [4, 11]],
  ['Nova', 'Orianna', 61, 3, 5, 5, 193, 2, 9400, 16800, 15, [3020, 6653, 3157, 0, 0, 0, 3340], [4, 12]],
  ['Mira', 'Caitlyn', 51, 3, 4, 4, 201, 4, 9800, 15900, 13, [3006, 3031, 3036, 0, 0, 0, 3363], [4, 7]],
  ['Quill', 'Lulu', 117, 0, 4, 8, 25, 0, 6000, 5400, 48, [3158, 6617, 3504, 0, 0, 0, 3364], [4, 3]],
];
const TAG = { ally: 'NXT5', enemy: 'DEMO' };

function players() {
  return [...ALLIES.map((p, i) => ({ p, i, ally: true })), ...ENEMIES.map((p, i) => ({ p, i, ally: false }))].map(({ p, i, ally }, index) => {
    const [name, champion, championId, kills, deaths, assists, minions, neutral, gold, damage, vision, items, spells] = p;
    return { participantId: index + 1, teamId: ally ? 100 : 200, ally, role: ROLES[i], name, tag: ally ? TAG.ally : TAG.enemy, champion, championId,
      kills, deaths, assists, minions, neutral, gold, damage, vision, items, spells };
  });
}

function buildExportFile() {
  const list = players();
  const participants = list.map((x) => ({
    participantId: x.participantId, teamId: x.teamId, championId: x.championId, championName: x.champion,
    summonerName: x.name, riotIdGameName: x.name, riotIdTagline: x.tag, teamPosition: x.role, individualPosition: x.role,
    lane: x.role === 'UTILITY' || x.role === 'BOTTOM' ? 'BOTTOM' : x.role, kills: x.kills, deaths: x.deaths, assists: x.assists,
    totalMinionsKilled: x.minions, neutralMinionsKilled: x.neutral, goldEarned: x.gold, totalDamageDealtToChampions: x.damage, visionScore: x.vision,
    ...Object.fromEntries(x.items.map((id, n) => [`item${n}`, id])), summoner1Id: x.spells[0], summoner2Id: x.spells[1], win: x.ally,
  }));
  const teams = [
    { teamId: 100, win: true, bans: [], objectives: { baron: { kills: 1 }, champion: { kills: 22 }, dragon: { kills: 3 }, riftHerald: { kills: 1 }, inhibitor: { kills: 1 }, tower: { kills: 8 } } },
    { teamId: 200, win: false, bans: [], objectives: { baron: { kills: 0 }, champion: { kills: 11 }, dragon: { kills: 1 }, riftHerald: { kills: 0 }, inhibitor: { kills: 0 }, tower: { kills: 3 } } },
  ];
  const frameAt = (minute) => ({
    timestamp: minute * 60000,
    participantFrames: Object.fromEntries(list.map((x) => {
      const share = Math.min(1, (minute * 60) / DURATION);
      return [String(x.participantId), { participantId: x.participantId, minionsKilled: Math.round(x.minions * share), jungleMinionsKilled: Math.round(x.neutral * share),
        totalGold: Math.round(500 + (x.gold - 500) * share), level: Math.max(1, Math.round(18 * share * 0.95)), position: { x: x.teamId === 100 ? 2400 : 12400, y: x.teamId === 100 ? 2400 : 12400 } }];
    })),
    events: minute === 10 ? [{ type: 'WARD_PLACED', timestamp: 598000, creatorId: 5, wardType: 'YELLOW_TRINKET', position: { x: 9800, y: 4400 } }] : [],
  });
  const timeline = { metadata: { matchId: GAME_ID }, info: { frameInterval: 60000, frames: [0, 10, 20, 25].map(frameAt) } };
  const csMilestones = Object.fromEntries(list.map((x) => [String(x.participantId), { participantId: x.participantId, champion: x.champion, summonerName: x.name,
    cs10: Math.round((x.minions + x.neutral) * 0.36), cs20: Math.round((x.minions + x.neutral) * 0.78) }]));
  return {
    source: 'nxt5-match-exporter', version: 5, gameId: GAME_ID, platform: 'EUW1', requestedGameId: GAME_ID, exportedAt: EXPORTED_AT,
    importerSource: 'nxt5-riot-match-export',
    match: { metadata: { matchId: GAME_ID, source: 'riot-match-v5' }, info: { gameCreation: GAME_CREATION, gameDuration: DURATION, gameId: 7861632138,
      gameMode: 'CLASSIC', gameType: 'CUSTOM_GAME', gameVersion: '26.20.1', mapId: 11, participants, teams } },
    timeline,
    nxt5: { importer: 'NXT5 Importer', timelineSummary: { available: true, frameCount: timeline.info.frames.length, csMilestones,
      wards: [{ timestamp: 598000, minute: 10, creatorId: 5, teamId: 100, wardType: 'YELLOW_TRINKET', positionSource: 'event', x: 9800, y: 4400, normalizedX: 0.6533, normalizedY: 0.2933 }], wardCount: 1 } },
  };
}

// Rows of match_participants as returned by the (intercepted) NXT5 API after the import.
function participantsRows(matchId, teamId) {
  const list = players();
  return list.map((x) => {
    const role = NXT5_ROLES[x.role];
    const cs = x.minions + x.neutral;
    return { id: `mp-${x.participantId}`, match_id: matchId, player_id: x.ally ? `p-${role}` : null, team_key: x.ally ? 'ALLY' : 'ENEMY',
      summoner_name: x.name, riot_id: `${x.name}#${x.tag}`, champion: x.champion, role,
      kills: x.kills, deaths: x.deaths, assists: x.assists, cs, gold: x.gold, damage: x.damage, damage_to_turrets: x.ally ? 2400 : 900, vision: x.vision,
      kp: null, kda: ((x.kills + x.assists) / Math.max(1, x.deaths)).toFixed(2), cs_per_min: Math.round((cs / (DURATION / 60)) * 10) / 10,
      gold_per_min: Math.round(x.gold / (DURATION / 60)), kill_participation: null, grade: null, raw: {} };
  });
}

module.exports = { GAME_ID, GAME_CREATION, DURATION, EXPORTED_AT, ALLY_NAMES: ALLIES.map((p) => p[0]), buildExportFile, participantsRows };

if (require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const file = path.join(__dirname, `nxt5-${GAME_ID}.json`);
  fs.writeFileSync(file, JSON.stringify(buildExportFile()));
  console.log('écrit', file, fs.statSync(file).size, 'octets');
}
