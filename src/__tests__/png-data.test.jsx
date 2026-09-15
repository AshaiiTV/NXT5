import { describe, expect, it } from "vitest";
import { buildTrendsPngData } from "../pages/workspace/TrendsPage.jsx";
import { playerProfilePngData } from "../pages/workspace/PlayerUltimateProfile.jsx";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const champions = ["Ornn", "Sejuani", "Orianna", "Jinx", "Lulu"];

function game(overrides = {}) {
  return {
    id: "game-1",
    result: "Victoire",
    side: "Blue Side",
    game_duration: 1800,
    participants: ["ALLY", "ENEMY"].flatMap((team, teamIndex) => roles.map((role, index) => ({
      team_key: team,
      role,
      champion: champions[index],
      kills: 2,
      deaths: 0,
      assists: 4,
      gold: team === "ALLY" ? 11000 : 10000,
      raw: { participantId: teamIndex * 5 + index + 1, teamId: teamIndex ? 200 : 100 },
    }))),
    ...overrides,
  };
}

function playerRow(match, index = 0) {
  return { ...match.participants[index], match };
}

function profileMeasure(report, label) {
  return report.measures.find((measure) => measure.label === label);
}

function frameGame(participant, minute = 10) {
  return game({ raw: { timeline: { info: { frames: [{ timestamp: minute * 60000, participantFrames: { "1": participant } }] } } } });
}

function summaryGame(value) {
  return game({ raw: { nxt5: { timelineSummary: { csMilestones: { "1": { cs10: value } } } } } });
}

describe("PNG export result samples", () => {
  it("excludes unknown results from team, side, champion and player win rates", () => {
    const games = [game(), game({ result: "Défaite" }), game({ result: "" })];
    const trends = buildTrendsPngData(games);
    const profile = playerProfilePngData(games.map((match) => playerRow(match)));

    expect(trends).toMatchObject({ games: 3, known: 2, wins: 1, losses: 1, unknown: 1, winrate: 50 });
    expect(trends.sides.find((side) => side.key === "Blue")).toMatchObject({ games: 3, known: 2, winrate: 50 });
    expect(trends.champions.find((entry) => entry.champion === "Ornn")).toMatchObject({ games: 3, known: 2, winrate: 50 });
    expect(profile.results).toEqual({ count: 2, wins: 1, losses: 1, rate: 50 });
    expect(profile.champions[0].results).toEqual(profile.results);
  });

  it("preserves absent win rates when every result is unknown", () => {
    const match = game({ result: undefined });
    expect(buildTrendsPngData([match])).toMatchObject({ games: 1, known: 0, winrate: null });
    expect(playerProfilePngData([playerRow(match)]).results).toEqual({ count: 0, wins: 0, losses: 0, rate: null });
  });

  it("does not invent measurements for an empty selection", () => {
    const trends = buildTrendsPngData([]);
    const profile = playerProfilePngData([]);
    expect(trends).toMatchObject({ games: 0, winrate: null, gold: { value: null, count: 0 }, deaths: { value: null, count: 0 }, kills: { value: null, count: 0 } });
    expect(trends.roles.every((role) => role.kdaCount === 0 && role.kills === null && role.cs10.value === null)).toBe(true);
    expect(profile.kda).toMatchObject({ ratio: null, count: 0 });
    expect(profile.participation).toEqual({ value: null, count: 0 });
    expect(profile.measures.every((measure) => measure.value === null && measure.count === 0)).toBe(true);
  });
});

describe("PNG export numeric coverage", () => {
  it.each([undefined, null, "", "   ", false])("keeps missing participant values (%s) out of each metric", (missing) => {
    const match = game();
    Object.assign(match.participants[0], {
      kills: missing, deaths: missing, assists: missing, gold: missing, damage: missing,
      vision: missing, cs_per_min: missing, damage_to_turrets: missing, kp: missing,
    });
    const trends = buildTrendsPngData([match]);
    const profile = playerProfilePngData([playerRow(match)]);

    expect(trends.gold).toEqual({ value: null, count: 0 });
    expect(trends.deaths).toEqual({ value: null, count: 0 });
    expect(trends.kills).toEqual({ value: null, count: 0 });
    expect(trends.roles[0]).toMatchObject({ games: 1, kdaCount: 0, kills: null, kp: { value: null, count: 0 } });
    expect(profile.kda).toMatchObject({ ratio: null, count: 0 });
    expect(profile.participation).toEqual({ value: null, count: 0 });
    expect(profile.measures.every((measure) => measure.value === null && measure.count === 0)).toBe(true);
  });

  it("retains explicit zeroes while computing each metric over its own covered games", () => {
    const complete = game();
    const partial = game({ id: "game-2" });
    partial.participants[0].gold = null;
    partial.participants[0].deaths = null;
    const trends = buildTrendsPngData([complete, partial]);
    const profile = playerProfilePngData([playerRow(complete), playerRow(partial)]);

    expect(trends.gold).toEqual({ value: 5000, count: 1 });
    expect(trends.deaths).toEqual({ value: 0, count: 1 });
    expect(trends.kills).toEqual({ value: 10, count: 2 });
    expect(trends.roles[0]).toMatchObject({ kdaCount: 1, kills: 2, deaths: 0, assists: 4, kp: { value: 60, count: 2 } });
    expect(profileMeasure(profile, "Morts / game")).toMatchObject({ value: 0, count: 1 });
    expect(profileMeasure(profile, "Kills / game")).toMatchObject({ value: 2, count: 2 });
    expect(profileMeasure(profile, "Or gagné / game")).toMatchObject({ value: 11000, count: 1 });
    expect(profile.kda).toMatchObject({ ratio: 6, count: 1 });
  });

  it.each([4, 6])("requires exactly five participants for a team total (%i supplied)", (count) => {
    const match = game();
    const allies = match.participants.filter((row) => row.team_key === "ALLY");
    const enemies = match.participants.filter((row) => row.team_key === "ENEMY");
    match.participants = [...(count === 4 ? allies.slice(0, 4) : [...allies, { ...allies[0] }]), ...enemies];
    const report = buildTrendsPngData([match]);
    expect(report.gold).toEqual({ value: null, count: 0 });
    expect(report.kills).toEqual({ value: null, count: 0 });
    expect(report.deaths).toEqual({ value: null, count: 0 });
  });

  it("requires both full teams for gold difference but only our team for our kills", () => {
    const match = game();
    match.participants = match.participants.slice(0, 9);
    const report = buildTrendsPngData([match]);
    expect(report.gold).toEqual({ value: null, count: 0 });
    expect(report.kills).toEqual({ value: 10, count: 1 });
    expect(report.deaths).toEqual({ value: 0, count: 1 });
  });

  it("uses a measured Riot gold value when the normalized value is absent", () => {
    const match = game();
    match.participants[0].gold = null;
    match.participants[0].raw.goldEarned = 11000;
    expect(buildTrendsPngData([match]).gold).toEqual({ value: 5000, count: 1 });
    expect(profileMeasure(playerProfilePngData([playerRow(match)]), "Or gagné / game")).toMatchObject({ value: 11000, count: 1 });
  });

  it.each(["   ", false])("does not count blank or boolean raw stats (%s) as measured zeroes", (value) => {
    const row = { champion: "Ornn", raw: { stats: { kills: value, deaths: value, assists: value, goldEarned: value } } };
    const profile = playerProfilePngData([row]);
    expect(profile.kda).toMatchObject({ ratio: null, count: 0 });
    for (const label of ["Kills / game", "Morts / game", "Assists / game", "Or gagné / game"]) {
      expect(profileMeasure(profile, label)).toMatchObject({ value: null, count: 0 });
    }
  });

  it("retains explicitly recorded zeroes in raw stats", () => {
    const row = { champion: "Ornn", raw: { stats: { kills: 0, deaths: 0, assists: 0, goldEarned: 0 } } };
    const profile = playerProfilePngData([row]);
    expect(profile.kda).toMatchObject({ ratio: 0, count: 1 });
    for (const label of ["Kills / game", "Morts / game", "Assists / game", "Or gagné / game"]) {
      expect(profileMeasure(profile, label)).toMatchObject({ value: 0, count: 1 });
    }
  });

  it("counts a repeated champion only once in the same team game", () => {
    const match = game();
    match.participants.push({ ...match.participants[0] });
    expect(buildTrendsPngData([match]).champions.find((entry) => entry.champion === "Ornn")).toMatchObject({ games: 1, wins: 1 });
  });

  it("preserves zero participation and distinguishes ratios from percentages", () => {
    const values = [0, "0%", 0.6, "60%", null, "", false];
    const rows = values.map((kp) => ({ champion: "Ornn", kp, match: { result: "Victoire" } }));
    expect(playerProfilePngData(rows).participation).toEqual({ value: 30, count: 4 });
    const matches = rows.map((row) => game({ participants: [{ ...row, role: "TOP", team_key: "ALLY" }] }));
    expect(buildTrendsPngData(matches).roles[0].kp).toEqual({ value: 30, count: 4 });
  });
});

describe("PNG export timeline coverage", () => {
  it.each([{}, { minionsKilled: 65 }, { jungleMinionsKilled: 2 }, { minionsKilled: null, jungleMinionsKilled: 0 }])("does not infer zero CS from a partial frame (%j)", (participant) => {
    const match = frameGame(participant);
    expect(buildTrendsPngData([match]).roles[0].cs10).toEqual({ value: null, count: 0 });
    expect(profileMeasure(playerProfilePngData([playerRow(match)]), "CS à 10 min")).toMatchObject({ value: null, count: 0 });
  });

  it.each([undefined, null, "", "   ", false])("keeps missing compact CS observations (%s) unavailable", (value) => {
    const match = summaryGame(value);
    expect(buildTrendsPngData([match]).roles[0].cs10).toEqual({ value: null, count: 0 });
    expect(profileMeasure(playerProfilePngData([playerRow(match)]), "CS à 10 min")).toMatchObject({ value: null, count: 0 });
  });

  it.each([{}, { minionsKilled: 125 }, { jungleMinionsKilled: 10 }, { minionsKilled: false, jungleMinionsKilled: 0 }])("keeps CS20 unavailable for a partial frame (%j)", (participant) => {
    const match = frameGame(participant, 20);
    expect(profileMeasure(playerProfilePngData([playerRow(match)]), "CS à 20 min")).toMatchObject({ value: null, count: 0 });
  });

  it.each([undefined, null, "", "   ", false])("keeps missing compact CS20 observations (%s) unavailable", (value) => {
    const match = summaryGame(75);
    match.raw.nxt5.timelineSummary.csMilestones["1"].cs20 = value;
    const profile = playerProfilePngData([playerRow(match)]);
    expect(profileMeasure(profile, "CS à 10 min")).toMatchObject({ value: 75, count: 1 });
    expect(profileMeasure(profile, "CS à 20 min")).toMatchObject({ value: null, count: 0 });
  });

  it("retains measured zero CS in full frames and compact summaries", () => {
    const matches = [frameGame({ minionsKilled: 0, jungleMinionsKilled: 0 }), summaryGame(0)];
    expect(buildTrendsPngData(matches).roles[0].cs10).toEqual({ value: 0, count: 2 });
    expect(profileMeasure(playerProfilePngData(matches.map((match) => playerRow(match))), "CS à 10 min")).toMatchObject({ value: 0, count: 2 });
  });

  it("adds measured lane and jungle CS without reusing an earlier frame for CS20", () => {
    const match = frameGame({ minionsKilled: 65, jungleMinionsKilled: 5 });
    expect(buildTrendsPngData([match]).roles[0].cs10).toEqual({ value: 70, count: 1 });
    const profile = playerProfilePngData([playerRow(match)]);
    expect(profileMeasure(profile, "CS à 10 min")).toMatchObject({ value: 70, count: 1 });
    expect(profileMeasure(profile, "CS à 20 min")).toMatchObject({ value: null, count: 0 });
  });
});
