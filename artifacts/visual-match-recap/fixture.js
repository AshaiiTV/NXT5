// Synthetic fixtures: no account, match, or team data is fetched.
const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const champions = [["Ornn", "Sejuani", "Ahri", "Jinx", "Lulu"], ["Gnar", "Viego", "Syndra", "Caitlyn", "Nautilus"]];
const names = [["Atlas", "Nova", "Lune", "Pulse", "Echo"], ["Orion", "Nox", "Solis", "Vega", "Astra"]];

export function syntheticTeamName(variant = "complete", teamKey = "ALLY") {
  if (variant === "long") return teamKey === "ENEMY"
    ? "Orion · Collectif international des explorateurs de la Faille · Équipe fictive"
    : "Atlas · Académie interrégionale des gardiens du Nexus · Équipe fictive";
  return teamKey === "ENEMY" ? "Orion" : "Atlas";
}

export function syntheticDraft(variant = "complete") {
  if (variant === "incomplete") return null;
  const redSide = variant === "red";
  const allyName = syntheticTeamName(variant);
  const enemyName = syntheticTeamName(variant, "ENEMY");
  return {
    id: "synthetic-draft-3", gameNumber: 3, allySide: redSide ? "red" : "blue",
    snapshot: {
      source: "drafter.lol", sourceId: "NXT5demo", sourceUrl: "https://drafter.lol/draft/NXT5demo?game=3", gameNumber: 3,
      blueName: redSide ? enemyName : allyName, redName: redSide ? allyName : enemyName,
      bluePicks: redSide ? [...champions[1]] : [...champions[0]], redPicks: redSide ? [...champions[0]] : [...champions[1]],
      blueBans: ["Aurora", "Vi", "Rakan", "Poppy", "Yone"], redBans: ["Kalista", "Skarner", "Orianna", "Renekton", "Braum"],
      status: "completed", fearless: false, ironman: false, warnings: [], firstPick: "blue",
      orderEvidence: { version: 1, basis: "reconstructed-public-slots", format: "standard-20", firstPick: "blue", reason: "public-slot-fields-v1" },
    },
  };
}
const gold = [[11800, 10600, 12600, 14000, 9000], [12200, 11900, 13400, 19681, 10303]];
const damage = [[17100, 14100, 27200, 25400, 8800], [19200, 23200, 28500, 38500, 10400]];
const vision = [[25, 41, 30, 27, 88], [28, 38, 35, 32, 96]];
// Known positions are invented for visual QA. Exact overlaps and one execution
// exercise navigation without pretending those events are all separate dots.
const kill = (seconds, killerId, victimId, x, y, assistingParticipantIds = []) => ({
  timestamp: seconds * 1000, type: "CHAMPION_KILL", killerId, victimId,
  assistingParticipantIds, bounty: killerId === 0 ? 0 : 300,
  ...(x === undefined ? {} : { position: { x, y } }),
});
const kills = [
  kill(222, 1, 6, 1550, 11350),
  kill(258, 7, 2, 4800, 8200, [8]),
  kill(337, 3, 8, 7500, 7500, [2]),
  kill(370, 9, 4, 12450, 2800, [10]),
  kill(378, 5, 10, 12450, 2800),
  kill(422, 2, 7, 10000, 4600, [3, 5]),
  kill(526, 6, 1, 2100, 11800, [7]),
  kill(560, 8, 3, 7100, 7200),
  kill(635, 3, 8, 7650, 7800, [2]),
  kill(667, 9, 5, 13100, 3200, [10]),
  kill(770, 4, 9, 11900, 2500, [5]),
  kill(794, 7, 2, 10200, 4800, [8, 10]),
  kill(843, 8, 3, 6500, 6400, [7]),
  kill(912, 1, 6, 1800, 10600),
  kill(960, 2, 10, 4900, 10300, [3]),
  kill(965, 3, 7, 4900, 10300, [2]),
  kill(971, 6, 5, 5300, 10900, [8]),
  kill(1066, 9, 4, 12300, 1700, [10]),
  kill(1110, 0, 1, 4000, 13300),
  kill(1153, 7, 2, 9900, 4450, [8]),
  kill(1158, 8, 3, 9900, 4450, [7, 9]),
  kill(1160, 4, 10, 10300, 4700, [5]),
  kill(1264, 3, 8, 7900, 8100, [2]),
  kill(1320, 9, 4, 11100, 2100, [7, 10]),
  kill(1327, 7, 5, 11100, 2100, [9, 10]),
  kill(1435, 8, 3, 6400, 6600, [10]),
  kill(1508, 7, 2, 4900, 10500, [6, 8]),
  kill(1514, 9, 1, 5350, 10200, [6, 7]),
  kill(1590, 4, 7, 8100, 3700, [3, 5]),
  kill(1635, 1, 6), // Deliberately missing coordinates: never invent a point.
  kill(1713, 8, 3, 4300, 4600, [7]),
  kill(1748, 9, 4, 3600, 2200, [7, 10]),
  kill(1754, 7, 5, 3500, 2500, [9]),
  kill(1830, 9, 2, 1900, 1800, [7, 8, 10]),
  kill(1838, 8, 1, 2200, 2200, [6, 9]),
];
const events = [
  { timestamp: 7 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", monsterSubType: "FIRE_DRAGON", killerId: 2, killerTeamId: 100 },
  { timestamp: 13 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", monsterSubType: "WATER_DRAGON", killerId: 7, killerTeamId: 200 },
  { timestamp: 19 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", monsterSubType: "AIR_DRAGON", killerId: 7, killerTeamId: 200 },
  { timestamp: 25 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "BARON_NASHOR", killerId: 7, killerTeamId: 200 },
  ...kills,
].sort((a, b) => a.timestamp - b.timestamp);

export function syntheticMatch(variant = "complete") {
  const participants = ["ALLY", "ENEMY"].flatMap((team_key, side) => roles.map((role, index) => ({
    id: `synthetic-${side}-${role}`, team_key, role,
    champion: champions[side][index], summoner_name: names[side][index],
    kills: kills.filter((event) => event.killerId === side * 5 + index + 1).length,
    deaths: kills.filter((event) => event.victimId === side * 5 + index + 1).length,
    assists: kills.filter((event) => event.assistingParticipantIds.includes(side * 5 + index + 1)).length,
    gold: gold[side][index], damage: damage[side][index], vision: vision[side][index],
    cs: [211, 176, 232, 256, 39][index],
    raw: { participantId: side * 5 + index + 1, teamId: side ? 200 : 100, item0: 3006, item1: 3031, item2: 3085, item3: 3036, item4: 3072, item5: 3026, item6: 3363, summoner1Id: 4, summoner2Id: 14 },
  })));
  const match = {
    id: "synthetic-recap-1", game_id: "EUW1_DEMO", patch: "16.19", duration: "31:11", side: "blue", result: "Défaite", opponent: "Orion",
    participants,
    raw: {
      nxt5Label: "Atlas vs Orion · Partie 3",
      info: { mapId: 11, teams: [
        { teamId: 100, objectives: { dragon: { kills: 1 }, baron: { kills: 0 }, tower: { kills: 3 } } },
        { teamId: 200, objectives: { dragon: { kills: 3 }, baron: { kills: 1 }, tower: { kills: 9 } } },
      ] },
      timeline: { info: { frames: Array.from({ length: 32 }, (_, minute) => ({
        timestamp: minute * 60000,
        events: events.filter((event) => Math.floor(event.timestamp / 60000) === minute).map((event) => ({ ...event })),
        participantFrames: Object.fromEntries(participants.map((row) => {
          const isAlly = row.team_key === "ALLY";
          const progress = minute / 31;
          const offset = Math.sin(progress * Math.PI) * (isAlly ? 260 : -120);
          return [String(row.raw.participantId), {
            totalGold: Math.round(500 + (row.gold - 500) * progress + offset),
            minionsKilled: Math.round(row.cs * progress), jungleMinionsKilled: 0,
          }];
        })),
      })) } },
    },
  };
  participants.forEach((row) => {
    const teamKills = participants.filter((member) => member.team_key === row.team_key).reduce((total, member) => total + member.kills, 0);
    row.kill_participation = teamKills ? Math.round((row.kills + row.assists) / teamKills * 100) : 0;
  });
  if (variant === "map-partial") {
    match.raw.nxt5Label = "Carte fictive · Positions partiellement disponibles";
    match.raw.timeline.info.frames.forEach((frame) => frame.events.forEach((event) => {
      if (event.type === "CHAMPION_KILL" && event.timestamp % 2000 === 0) delete event.position;
    }));
  }
  if (variant === "map-empty") {
    match.raw.nxt5Label = "Carte fictive · Aucune élimination enregistrée";
    match.participants.forEach((row) => { row.kills = 0; row.deaths = 0; row.assists = 0; row.kill_participation = 0; });
    match.raw.timeline.info.frames.forEach((frame) => { frame.events = frame.events.filter((event) => event.type !== "CHAMPION_KILL"); });
  }
  if (variant === "map-missing") {
    match.raw.nxt5Label = "Carte fictive · Chronologie absente";
    delete match.raw.timeline;
  }
  if (variant === "map-unsupported") {
    match.raw.nxt5Label = "Carte fictive · Mode de jeu non pris en charge";
    match.raw.info.mapId = 12;
  }
  if (variant === "lead-changes") {
    const differences = [0, -500, -900, -400, 600, 1800, 1200, 2200, 3200, 1800, 600, -300, -1200, -500, 600, 2400, 3600, 4200, 3600, 1800, 300, -800, -2200, -3100, -1800, -2400, -4600, -5100, -6200, -7800, -8800, -9484];
    match.raw.timeline.info.frames.forEach((frame, minute) => {
      const enemyTotal = [6, 7, 8, 9, 10].reduce((total, id) => total + frame.participantFrames[id].totalGold, 0);
      const allyTotal = enemyTotal + differences[minute];
      for (let id = 1; id <= 5; id++) frame.participantFrames[id].totalGold = Math.floor(allyTotal / 5) + (id <= allyTotal % 5 ? 1 : 0);
    });
  }
  if (variant === "incomplete") {
    delete match.raw.timeline;
    match.participants = participants.filter((row) => row.team_key === "ENEMY" || row.role === "MID");
    match.participants[0].gold = null;
    match.raw.nxt5Label = "Partie importée · Données incomplètes";
  }
  if (variant === "zero") {
    match.raw.nxt5Label = "Partie fictive · Égalité mesurée";
    match.participants.forEach((row) => { row.gold = 10000; row.damage = 0; row.vision = 0; });
    match.raw.timeline.info.frames.forEach((frame) => Object.values(frame.participantFrames).forEach((row) => { row.totalGold = 1000; }));
  }
  if (variant === "red") {
    match.side = "red";
    match.raw.nxt5Label = "Atlas vs Orion · Côté rouge";
    match.participants.forEach((row) => { row.raw.teamId = row.team_key === "ALLY" ? 200 : 100; });
    match.raw.info.teams.forEach((team) => { team.teamId = team.teamId === 100 ? 200 : 100; });
    match.raw.timeline.info.frames.forEach((frame) => frame.events.forEach((event) => {
      if (event.killerTeamId) event.killerTeamId = event.killerTeamId === 100 ? 200 : 100;
    }));
  }
  if (variant === "long") {
    match.opponent = syntheticTeamName(variant, "ENEMY");
    match.raw.nxt5Label = "Partie fictive · Finale interrégionale des académies Atlas et Orion · Manche décisive";
    match.participants.forEach((row, index) => {
      row.summoner_name = index % 2 === 0
        ? `${row.summoner_name}LeGardienDuNexusAuxMilleConstellations#DEMO`
        : `${row.summoner_name} · Capitaine de l’académie des explorateurs · Joueur fictif`;
    });
  }
  if (variant === "tie") {
    match.raw.nxt5Label = "Partie fictive · Deux leaders de dégâts ex æquo dans chaque équipe";
    match.participants.forEach((row) => {
      if (row.role === "MID" || row.role === "ADC") row.damage = row.team_key === "ALLY" ? 27200 : 38500;
    });
  }
  return match;
}
