// Fictitious game of the Discord tutorial: the Importer tutorial's game (../../tuto/fixtures/game.cjs, same players,
// champions, final stats and game ID) with a full timeline, so the NXT5 publication visual has its combat summary.
// - Frames every minute from 0:00 to 25:00 (gold, CS, level, position per participant).
// - 33 CHAMPION_KILL events (22 for « Équipe Démo », 11 for the opponent) that add up exactly to every player's
//   final kills, deaths and assists, grouped into fights (kills ≤ 24 s apart).
// - Objectives matching the final team objectives (towers, inhibitor, dragons, herald, baron) and a few wards.
// Deterministic (no Math.random). `node game-discord.cjs` writes nxt5-EUW1_7861632138.json next to this file: the
// file the owner imports into the demo team before publishing it to Discord (BRIEF-CAPTURES-DISCORD.md).
const base = require('../../tuto/fixtures/game.cjs');

const MIN = 60000;
const at = (m, s) => (m * 60 + s) * 1000;

// Participant ids: 1 Kairo (top), 2 Lynx (jungle), 3 Vesper (mid), 4 Orion (ADC), 5 Sora (support) for Équipe Démo,
// blue side; 6 Rook, 7 Ember, 8 Nova, 9 Mira, 10 Quill for the opponent, red side.
// Fights: [start, place, ally kills, enemy kills]. Totals must be 22 and 11 (checked below).
const FIGHTS = [
  [at(3, 12), 'topRiver', 1, 0],
  [at(5, 41), 'bot', 0, 1],
  [at(7, 5), 'bot', 2, 1],
  [at(9, 48), 'mid', 0, 1],
  [at(11, 14), 'dragon', 1, 2],
  [at(13, 26), 'top', 1, 0],
  [at(14, 6), 'dragon', 3, 1],
  [at(16, 32), 'mid', 2, 2],
  [at(18, 3), 'redJungle', 3, 1],
  [at(19, 37), 'dragon', 2, 0],
  [at(21, 9), 'bot', 1, 1],
  [at(22, 24), 'baron', 3, 1],
  [at(24, 8), 'redBase', 3, 0],
];
const PLACES = {
  topRiver: [4300, 9600], top: [2100, 11800], mid: [7400, 7300], bot: [12000, 2400], dragon: [9800, 4400],
  redJungle: [10200, 9100], baron: [5000, 10400], redBase: [12600, 12800],
};
// Objectives: [time, type, killer participant, extra fields]. Towers and inhibitor: `teamId` is the team that LOSES it.
const OBJECTIVES = [
  [at(8, 31), 'ELITE_MONSTER_KILL', 2, { monsterType: 'DRAGON', monsterSubType: 'FIRE_DRAGON', place: 'dragon' }],
  [at(10, 2), 'BUILDING_KILL', 4, { buildingType: 'TOWER_BUILDING', laneType: 'BOT_LANE', towerType: 'OUTER_TURRET', teamId: 200, place: 'bot' }],
  [at(11, 20), 'ELITE_MONSTER_KILL', 7, { monsterType: 'DRAGON', monsterSubType: 'WATER_DRAGON', place: 'dragon' }],
  [at(12, 40), 'BUILDING_KILL', 6, { buildingType: 'TOWER_BUILDING', laneType: 'TOP_LANE', towerType: 'OUTER_TURRET', teamId: 100, place: 'top' }],
  [at(13, 5), 'ELITE_MONSTER_KILL', 2, { monsterType: 'RIFTHERALD', place: 'baron' }],
  [at(14, 30), 'ELITE_MONSTER_KILL', 2, { monsterType: 'DRAGON', monsterSubType: 'AIR_DRAGON', place: 'dragon' }],
  [at(15, 10), 'BUILDING_KILL', 3, { buildingType: 'TOWER_BUILDING', laneType: 'MID_LANE', towerType: 'OUTER_TURRET', teamId: 200, place: 'mid' }],
  [at(15, 48), 'BUILDING_KILL', 8, { buildingType: 'TOWER_BUILDING', laneType: 'MID_LANE', towerType: 'OUTER_TURRET', teamId: 100, place: 'mid' }],
  [at(17, 12), 'BUILDING_KILL', 1, { buildingType: 'TOWER_BUILDING', laneType: 'TOP_LANE', towerType: 'OUTER_TURRET', teamId: 200, place: 'top' }],
  [at(18, 40), 'BUILDING_KILL', 4, { buildingType: 'TOWER_BUILDING', laneType: 'BOT_LANE', towerType: 'INNER_TURRET', teamId: 200, place: 'bot' }],
  [at(19, 58), 'ELITE_MONSTER_KILL', 2, { monsterType: 'DRAGON', monsterSubType: 'EARTH_DRAGON', place: 'dragon' }],
  [at(20, 35), 'BUILDING_KILL', 9, { buildingType: 'TOWER_BUILDING', laneType: 'BOT_LANE', towerType: 'OUTER_TURRET', teamId: 100, place: 'bot' }],
  [at(21, 50), 'BUILDING_KILL', 3, { buildingType: 'TOWER_BUILDING', laneType: 'MID_LANE', towerType: 'INNER_TURRET', teamId: 200, place: 'mid' }],
  [at(22, 51), 'ELITE_MONSTER_KILL', 2, { monsterType: 'BARON_NASHOR', place: 'baron' }],
  [at(23, 40), 'BUILDING_KILL', 4, { buildingType: 'TOWER_BUILDING', laneType: 'BOT_LANE', towerType: 'BASE_TURRET', teamId: 200, place: 'redBase' }],
  [at(24, 2), 'BUILDING_KILL', 4, { buildingType: 'INHIBITOR_BUILDING', laneType: 'BOT_LANE', teamId: 200, place: 'redBase' }],
  [at(24, 30), 'BUILDING_KILL', 3, { buildingType: 'TOWER_BUILDING', laneType: 'MID_LANE', towerType: 'NEXUS_TURRET', teamId: 200, place: 'redBase' }],
  [at(24, 44), 'BUILDING_KILL', 4, { buildingType: 'TOWER_BUILDING', laneType: 'MID_LANE', towerType: 'NEXUS_TURRET', teamId: 200, place: 'redBase' }],
];
const WARDS = [
  [at(2, 40), 2, 'YELLOW_TRINKET', 5600, 8900], [at(6, 15), 5, 'CONTROL_WARD', 9300, 4900], [at(9, 58), 5, 'YELLOW_TRINKET', 9800, 4400],
  [at(13, 50), 2, 'CONTROL_WARD', 9100, 5200], [at(17, 30), 5, 'SIGHT_WARD', 10400, 8600], [at(21, 40), 3, 'CONTROL_WARD', 5400, 10100],
  [at(8, 5), 10, 'YELLOW_TRINKET', 9600, 4700], [at(15, 20), 7, 'CONTROL_WARD', 5300, 10700],
];

/** Deterministic permutation (multiplicative hash order). */
const mix = (list, salt) => list.map((v, i) => [((i + 1) * 2654435761 + salt * 40503) % 4294967296, v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const expand = (counts) => Object.entries(counts).flatMap(([id, n]) => Array(n).fill(Number(id)));

function killEvents(players) {
  const ally = players.filter((p) => p.ally);
  const enemy = players.filter((p) => !p.ally);
  const tally = (list, key) => Object.fromEntries(list.map((p) => [p.participantId, p[key]]));
  const sides = {
    ally: { killers: mix(expand(tally(ally, 'kills')), 3), victims: mix(expand(tally(enemy, 'deaths')), 7), helpers: tally(ally, 'assists'), team: ally },
    enemy: { killers: mix(expand(tally(enemy, 'kills')), 5), victims: mix(expand(tally(ally, 'deaths')), 11), helpers: tally(enemy, 'assists'), team: enemy },
  };
  const events = [];
  for (const [start, place, a, e] of FIGHTS) {
    const order = [...Array(a).fill('ally'), ...Array(e).fill('enemy')];
    // alternate sides inside a fight so a traded fight reads as a trade
    const seq = order.length > 1 ? mix(order, start / 1000) : order;
    seq.forEach((side, n) => {
      const s = sides[side];
      const [x, y] = PLACES[place];
      events.push({ side, timestamp: start + n * 6000 + ((start / 1000) % 3) * 1000, killerId: s.killers.shift(), victimId: s.victims.shift(),
        position: { x: x + ((n * 397) % 700) - 350, y: y + ((n * 251) % 600) - 300 } });
    });
  }
  // a player never kills a teammate: fix a victim/killer clash cannot happen (victims are always the other team)
  for (const side of ['ally', 'enemy']) {
    const s = sides[side];
    if (s.killers.length || s.victims.length) throw new Error(`${side}: totaux de kills incohérents`);
    const kills = events.filter((k) => k.side === side);
    kills.forEach((k) => { k.assistingParticipantIds = []; });
    // assists: each player's assists go to the kills he did not score, the least-assisted (then earliest) first
    for (const p of s.team) {
      let left = s.helpers[p.participantId];
      const eligible = kills.filter((k) => k.killerId !== p.participantId);
      if (left > eligible.length) throw new Error(`${p.name} : trop d’assists`);
      while (left > 0) {
        const k = eligible.filter((x) => !x.assistingParticipantIds.includes(p.participantId) && x.assistingParticipantIds.length < 4)
          .sort((u, v) => u.assistingParticipantIds.length - v.assistingParticipantIds.length || u.timestamp - v.timestamp)[0];
        if (!k) throw new Error(`${p.name} : assists impossibles à placer`);
        k.assistingParticipantIds.push(p.participantId);
        left -= 1;
      }
    }
  }
  return events.map(({ side, ...k }) => ({ type: 'CHAMPION_KILL', ...k, assistingParticipantIds: k.assistingParticipantIds.sort((a, b) => a - b), bounty: 300, shutdownBounty: 0, victimDamageDealt: [], victimDamageReceived: [] }));
}

function participantFrame(p, minute, final) {
  const t = minute / 25;
  // Équipe Démo pulls ahead from mid game; the opponent starts a little stronger (first drake, early kills)
  const curve = p.ally ? Math.pow(t, 1.06) : Math.pow(t, 0.97);
  const lane = { TOP: [2200, 11600], JUNGLE: [4300, 8000], MIDDLE: [7200, 7200], BOTTOM: [11800, 2600], UTILITY: [11400, 2900] }[p.role];
  const flip = p.ally ? lane : [14820 - lane[0] - 500, 14820 - lane[1] + 500].map((v) => Math.max(400, Math.min(14400, v)));
  const pos = minute === 0 ? (p.ally ? [560, 580] : [14240, 14200]) : [flip[0] + ((minute * 173 + p.participantId * 61) % 900) - 450, flip[1] + ((minute * 97 + p.participantId * 43) % 900) - 450];
  return {
    participantId: p.participantId,
    minionsKilled: Math.round(p.minions * Math.pow(t, 1.02)),
    jungleMinionsKilled: Math.round(p.neutral * t),
    totalGold: Math.round(500 + (p.gold - 500) * curve),
    currentGold: Math.round(((minute * 137 + p.participantId * 89) % 900) + (minute ? 120 : 500)),
    xp: Math.round(final.xp * Math.pow(t, 1.1)),
    level: minute === 0 ? 1 : Math.min(18, Math.max(1, Math.round(1 + 16.5 * Math.pow(t, 0.8)))),
    position: { x: Math.round(pos[0]), y: Math.round(pos[1]) },
  };
}

function buildExportFile() {
  const file = base.buildExportFile();
  const parts = file.match.info.participants;
  const players = parts.map((p) => ({
    participantId: p.participantId, ally: p.teamId === 100, role: p.teamPosition, name: p.riotIdGameName,
    kills: p.kills, deaths: p.deaths, assists: p.assists, minions: p.totalMinionsKilled, neutral: p.neutralMinionsKilled, gold: p.goldEarned,
  }));
  const kills = killEvents(players);
  const objectives = OBJECTIVES.map(([timestamp, type, killerId, extra]) => {
    const { place, ...fields } = extra;
    const [x, y] = PLACES[place];
    return { type, timestamp, killerId, killerTeamId: killerId <= 5 ? 100 : 200, ...fields, position: { x, y } };
  });
  const wards = WARDS.map(([timestamp, creatorId, wardType]) => ({ type: 'WARD_PLACED', timestamp, creatorId, wardType }));
  const all = [...kills, ...objectives, ...wards].sort((a, b) => a.timestamp - b.timestamp);
  const frames = Array.from({ length: 26 }, (_, minute) => ({
    timestamp: minute === 25 ? 1500000 : minute * MIN,
    participantFrames: Object.fromEntries(players.map((p) => [String(p.participantId), participantFrame(p, minute, { xp: 13500 + p.participantId * 40 })])),
    // events of the minute that ends with this frame (Riot puts each event in the frame that follows it)
    events: all.filter((ev) => ev.timestamp > (minute - 1) * MIN && ev.timestamp <= minute * MIN),
  }));
  frames[0].events.unshift({ type: 'PAUSE_END', timestamp: 0, realTimestamp: base.GAME_CREATION });
  frames[25].events.push({ type: 'GAME_END', timestamp: 1500000, winningTeam: 100, gameId: 7861632138 });
  file.timeline = { metadata: { matchId: base.GAME_ID }, info: { frameInterval: MIN, frames } };
  const at10 = frames[10].participantFrames;
  const at20 = frames[20].participantFrames;
  file.nxt5.timelineSummary = {
    available: true,
    frameCount: frames.length,
    csMilestones: Object.fromEntries(players.map((p) => {
      const id = String(p.participantId);
      const champion = parts[p.participantId - 1].championName;
      return [id, { participantId: p.participantId, champion, summonerName: p.name,
        cs10: at10[id].minionsKilled + at10[id].jungleMinionsKilled, cs20: at20[id].minionsKilled + at20[id].jungleMinionsKilled }];
    })),
    wards: WARDS.map(([timestamp, creatorId, wardType, x, y]) => ({ timestamp, minute: Math.floor(timestamp / MIN), creatorId, teamId: creatorId <= 5 ? 100 : 200,
      wardType, positionSource: 'estimate', x, y, normalizedX: Math.round((x / 15000) * 10000) / 10000, normalizedY: Math.round((y / 15000) * 10000) / 10000 })),
    wardCount: WARDS.length,
  };
  return file;
}

/** Totals check: every player's kills, deaths and assists equal the sum of the timeline events. */
function check(file) {
  const kills = file.timeline.info.frames.flatMap((f) => f.events).filter((e) => e.type === 'CHAMPION_KILL');
  const errors = [];
  for (const p of file.match.info.participants) {
    const id = p.participantId;
    const k = kills.filter((e) => e.killerId === id).length;
    const d = kills.filter((e) => e.victimId === id).length;
    const a = kills.filter((e) => e.assistingParticipantIds.includes(id)).length;
    if (k !== p.kills || d !== p.deaths || a !== p.assists) errors.push(`${p.riotIdGameName} : ${k}/${d}/${a} au lieu de ${p.kills}/${p.deaths}/${p.assists}`);
    if (kills.some((e) => e.killerId === id && e.assistingParticipantIds.includes(id))) errors.push(`${p.riotIdGameName} : assiste son propre kill`);
  }
  const team = (lo, hi) => kills.filter((e) => e.killerId >= lo && e.killerId <= hi).length;
  if (team(1, 5) !== 22 || team(6, 10) !== 11) errors.push(`score ${team(1, 5)}–${team(6, 10)} au lieu de 22–11`);
  return errors;
}

module.exports = { ...base, buildExportFile, check };

if (require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const file = buildExportFile();
  const errors = check(file);
  if (errors.length) throw new Error(errors.join('\n'));
  const out = path.join(__dirname, `nxt5-${base.GAME_ID}.json`);
  fs.writeFileSync(out, JSON.stringify(file));
  const ev = file.timeline.info.frames.flatMap((f) => f.events);
  console.log('écrit', out, fs.statSync(out).size, 'octets ·', ev.filter((e) => e.type === 'CHAMPION_KILL').length, 'kills ·', ev.length, 'événements ·', file.timeline.info.frames.length, 'frames');
}
