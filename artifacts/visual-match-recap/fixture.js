// Synthetic fixtures: no account, match, or team data is fetched.
const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const champions = [["Ornn", "Sejuani", "Ahri", "Jinx", "Lulu"], ["Gnar", "Viego", "Syndra", "Caitlyn", "Nautilus"]];
const names = [["Atlas", "Nova", "Lune", "Pulse", "Echo"], ["Orion", "Nox", "Solis", "Vega", "Astra"]];

export function syntheticDraft(variant = "complete") {
  if (variant === "incomplete") return null;
  const redSide = variant === "red";
  return {
    id: "synthetic-draft-3", gameNumber: 3, allySide: redSide ? "red" : "blue",
    snapshot: {
      source: "drafter.lol", sourceId: "NXT5demo", sourceUrl: "https://drafter.lol/draft/NXT5demo?game=3", gameNumber: 3,
      blueName: redSide ? "Orion" : "Atlas", redName: redSide ? "Atlas" : "Orion",
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
const kills = [[2, 2, 5, 3, 1], [4, 6, 5, 9, 1]];
const deaths = [[4, 6, 5, 8, 2], [2, 4, 2, 3, 2]];
const events = [
  { timestamp: 7 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", monsterSubType: "FIRE_DRAGON", killerId: 2, killerTeamId: 100 },
  { timestamp: 13 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", monsterSubType: "WATER_DRAGON", killerId: 7, killerTeamId: 200 },
  { timestamp: 19 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", monsterSubType: "AIR_DRAGON", killerId: 7, killerTeamId: 200 },
  { timestamp: 22 * 60000, type: "CHAMPION_KILL", killerId: 9, victimId: 4, assistingParticipantIds: [7, 10], bounty: 300 },
  { timestamp: 25 * 60000, type: "ELITE_MONSTER_KILL", monsterType: "BARON_NASHOR", killerId: 7, killerTeamId: 200 },
];

export function syntheticMatch(variant = "complete") {
  const participants = ["ALLY", "ENEMY"].flatMap((team_key, side) => roles.map((role, index) => ({
    id: `synthetic-${side}-${role}`, team_key, role,
    champion: champions[side][index], summoner_name: names[side][index],
    kills: kills[side][index], deaths: deaths[side][index], assists: 4 + index,
    gold: gold[side][index], damage: damage[side][index], vision: vision[side][index],
    cs: [211, 176, 232, 256, 39][index], kill_participation: 46 + index * 6,
    raw: { participantId: side * 5 + index + 1, teamId: side ? 200 : 100, item0: 3006, item1: 3031, summoner1Id: 4, summoner2Id: 14 },
  })));
  const match = {
    id: "synthetic-recap-1", game_id: "EUW1_DEMO", patch: "16.19", duration: "31:11", side: "blue", result: "Défaite", opponent: "Orion",
    participants,
    raw: {
      nxt5Label: "Atlas vs Orion · Partie 3",
      info: { teams: [
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
  return match;
}
