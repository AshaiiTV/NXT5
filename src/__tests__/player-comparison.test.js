import { describe, expect, it } from "vitest";
import { buildPlayerComparison } from "../utils/player-comparison.js";

const player = (overrides = {}) => ({ id: "p1", name: "Nova", riot_id: "Nova#EUW", role: "MID", ...overrides });
const row = (overrides = {}) => ({ team_key: "ALLY", player_id: "p1", summoner_name: "Nova", role: "MID", ...overrides });
const match = (id, participants, overrides = {}) => ({ id, duration: "30:00", participants, ...overrides });
const nova = (model) => model.players.find((entry) => entry.player?.id === "p1");

describe("buildPlayerComparison", () => {
  it("averages per player and per available metric, preserving measured zero", () => {
    const model = buildPlayerComparison([
      match("a", [row({ kills: 8, deaths: 2, assists: 4, cs: 240, vision: 30, damage: 18000, gold: 12000 })]),
      match("b", [row({ kills: 0, deaths: 0, assists: 6, cs: null, vision: "", damage: 30000, gold: 15000 })], { duration: "40:00" }),
      match("c", [row({ kills: null, deaths: false, assists: "invalid", cs: -1, vision: true })]),
    ], [player()]);
    const result = nova(model);
    expect(result.games).toBe(3);
    expect(result.metrics.kills).toEqual({ value: 4, count: 2 });
    expect(result.metrics.deaths).toEqual({ value: 1, count: 2 });
    expect(result.metrics.cs).toEqual({ value: 240, count: 1 });
    expect(result.metrics.csPerMin).toEqual({ value: 8, count: 1 });
    expect(result.metrics.visionPerMin).toEqual({ value: 1, count: 1 });
    expect(result.metrics.damagePerMin).toEqual({ value: 675, count: 2 });
    expect(result.metrics.goldPerMin).toEqual({ value: 387.5, count: 2 });
    expect(result.metrics.kda).toEqual({ value: 9, count: 2 });
  });

  it("never borrows the enemy or a different player in the same role", () => {
    const result = nova(buildPlayerComparison([match("a", [
      row({ team_key: "ENEMY", kills: 100 }),
      row({ player_id: "other", kills: 50 }),
      row({ player_id: "", summoner_name: "Elsewhere", kills: 30 }),
    ])], [player()]));
    expect(result.games).toBe(0);
    expect(result.metrics.kills).toEqual({ value: null, count: 0 });
  });

  it("uses linked identity across role swaps and keeps unplayed roster members", () => {
    const model = buildPlayerComparison([
      match("a", [row({ role: "TOP", kills: 3 })]),
      match("b", [row({ player_id: undefined, riot_id: " NOVA #euw ", role: "BOTTOM", kills: 5 })]),
    ], [player(), player({ id: "p2", name: "Reserve", riot_id: "Reserve#EUW", role: "SUB" })]);
    expect(nova(model).games).toBe(2);
    expect(nova(model).metrics.kills.value).toBe(4);
    expect(model.players.find((entry) => entry.player?.id === "p2").games).toBe(0);
    expect(model.players).toHaveLength(2);
  });

  it("deduplicates matches and participant rows without counting unknown games together", () => {
    const first = match("a", [row({ kills: 4 }), row({ kills: 4 })]);
    const model = buildPlayerComparison([first, { ...first }, match(undefined, [row({ kills: 2 })]), match(undefined, [row({ kills: 6 })])], [player()]);
    expect(model.games).toBe(3);
    expect(nova(model).games).toBe(3);
    expect(nova(model).metrics.kills).toEqual({ value: 4, count: 3 });
    expect(nova(model).matches).toHaveLength(3);
  });

  it("reads nested Riot imports and includes named allied players without a roster", () => {
    const model = buildPlayerComparison([match("a", [{ team_key: "ALLY", raw: JSON.stringify({ participant: {
      riotIdGameName: "Guest", riotIdTagline: "EUW", teamPosition: "JUNGLE", kills: 2, assists: 7, deaths: 3,
      totalMinionsKilled: 30, neutralMinionsKilled: 150, visionScore: 45, totalDamageDealtToChampions: 12000,
      goldEarned: 9000, challenges: { killParticipation: 0.75 },
    } }) }, { team_key: "ENEMY", summoner_name: "Enemy", kills: 99 }, { team_key: "ALLY", role: "SUP", champion: "Lux" }])]);
    expect(model.players).toHaveLength(1);
    const guest = model.players[0];
    expect(guest.name).toBe("Guest#EUW");
    expect(guest.role).toBe("JGL");
    expect(guest.metrics.cs).toEqual({ value: 180, count: 1 });
    expect(guest.metrics.csPerMin.value).toBe(6);
    expect(guest.metrics.vision.value).toBe(45);
    expect(guest.metrics.kp.value).toBe(75);
  });

  it("does not turn partial CS or an absent duration into a computed rate", () => {
    const model = buildPlayerComparison([
      match("a", [row({ raw: { totalMinionsKilled: 160 }, vision: 40, cs_per_min: "7.2" })], { duration: "" }),
      match("b", [row({ raw: { totalMinionsKilled: 100, neutralMinionsKilled: 0 }, vision: 0 })], { duration: "", duration_seconds: 0 }),
    ], [player()]);
    expect(nova(model).metrics.cs).toEqual({ value: 100, count: 1 });
    expect(nova(model).metrics.csPerMin).toEqual({ value: 7.2, count: 1 });
    expect(nova(model).metrics.visionPerMin).toEqual({ value: null, count: 0 });
  });

  it("computes KP from five complete allied rows, with null for a zero-kill team", () => {
    const team = [row({ kills: 3, assists: 6 }), ...[1, 2, 3, 4].map((id) => row({ player_id: `other${id}`, kills: 3 }))];
    const model = buildPlayerComparison([match("a", team), match("b", team.map((item) => ({ ...item, kills: 0, assists: 0 })))], [player()]);
    expect(nova(model).metrics.kp).toEqual({ value: 60, count: 1 });
  });

  it("uses recorded KP for incomplete teams and rejects malformed percentages", () => {
    const model = buildPlayerComparison([
      match("a", [row({ kp: "50%" })]), match("b", [row({ kp: 0.8 })]),
      match("c", [row({ kp: 150 })]), match("d", [row({ kp: false })]),
    ], [player()]);
    expect(nova(model).metrics.kp).toEqual({ value: 65, count: 2 });
  });

  it("gives an exact Riot ID priority over a shared display name", () => {
    const model = buildPlayerComparison([match("a", [row({ player_id: undefined, riot_id: "Nova#EUW", kills: 4 })])], [
      player(), player({ id: "p2", riot_id: "Nova#NA" }),
    ]);
    expect(nova(model).games).toBe(1);
    expect(model.players.find((entry) => entry.player?.id === "p2").games).toBe(0);
  });

  it("uses a global KDA on complete K/D/A rows only", () => {
    const model = buildPlayerComparison([
      match("a", [row({ kills: 4, assists: 4, deaths: 1 })]),
      match("b", [row({ kills: 2, assists: 2, deaths: 3 })]),
      match("c", [row({ kills: 100, deaths: 1 })]),
    ], [player()]);
    expect(nova(model).metrics.kda).toEqual({ value: 3, count: 2 });
  });

  it("links a known PUUID across imports without overriding a conflicting player ID", () => {
    const model = buildPlayerComparison([
      match("a", [row({ raw: { puuid: "account-1" }, kills: 2 })]),
      match("b", [row({ player_id: undefined, summoner_name: "New name", raw: { puuid: "account-1" }, kills: 6 })]),
      match("c", [row({ player_id: "another-player", summoner_name: "New name", raw: { puuid: "account-1" }, kills: 99 })]),
    ], [player()]);
    expect(nova(model).games).toBe(2);
    expect(nova(model).metrics.kills.value).toBe(4);
    expect(model.players.find((entry) => entry.id === "imported:player:another-player").games).toBe(1);
  });

  it("does not assign a shared ambiguous PUUID or a different explicit Riot ID", () => {
    const model = buildPlayerComparison([
      match("a", [row({ raw: { puuid: "shared" }, kills: 2 })]),
      match("b", [row({ player_id: "p2", raw: { puuid: "shared" }, kills: 3 })]),
      match("c", [row({ player_id: undefined, summoner_name: "Unknown", raw: { puuid: "shared" }, kills: 99 })]),
      match("d", [row({ player_id: undefined, riot_id: "Nova#OTHER", kills: 99 })]),
    ], [player(), player({ id: "p2", name: "Second", riot_id: "Second#EUW" })]);
    expect(nova(model).games).toBe(1);
    expect(model.players.find((entry) => entry.player?.id === "p2").games).toBe(1);
  });

  it("distinguishes imported homonyms with their complete Riot IDs", () => {
    const model = buildPlayerComparison([match("a", [
      row({ player_id: undefined, riot_id: "Nova#EUW", kills: 2 }),
      row({ player_id: undefined, riot_id: "Nova", raw: { riotIdGameName: "Nova", riotIdTagline: "NA" }, kills: 8 }),
    ])]);
    expect(model.players.map((entry) => entry.name)).toEqual(["Nova#EUW", "Nova#NA"]);
    expect(model.players.map((entry) => entry.metrics.kills.value)).toEqual([2, 8]);
  });

  it("finds a display name across imports while never exposing an internal identifier as a name", () => {
    const model = buildPlayerComparison([
      match("a", [{ team_key: "ALLY", riot_id: "Alias", raw: { puuid: "known-account" }, kills: 2 }]),
      match("b", [{ team_key: "ALLY", raw: { puuid: "known-account", summonerName: "Alias" }, kills: 4 }]),
      match("c", [{ team_key: "ALLY", raw: { puuid: "known-account", riotIdGameName: "Alias", riotIdTagline: "EUW" }, kills: 6 }]),
      match("d", [{ team_key: "ALLY", raw: { puuid: "private-puuid" }, kills: 1 }]),
      match("e", [{ team_key: "ALLY", player_id: "private-player-id", kills: 1 }]),
    ]);
    const named = model.players.find((entry) => entry.name === "Alias#EUW");
    expect(named.games).toBe(3);
    expect(named.metrics.kills.value).toBe(4);
    expect(model.players.filter((entry) => !entry.name)).toHaveLength(2);
    expect(model.players.every((entry) => !entry.name.includes("private"))).toBe(true);
  });

  it("rejects non-finite statistics and durations instead of inventing zero rates", () => {
    const model = buildPlayerComparison([
      match("a", [row({ vision: 50, cs: 100, kills: Infinity, assists: "Infinity", deaths: NaN })], { duration: "", duration_seconds: Infinity, raw: { info: { gameDuration: Infinity } } }),
      match("b", [row({ vision: 50, cs: 100, kills: "NaN" })], { duration: `${"9".repeat(400)}:00:00` }),
      match("c", [row({ vision: 50, cs: 100 })], { duration: "", duration_seconds: Number.MIN_VALUE }),
    ], [player()]);
    expect(nova(model).metrics.visionPerMin).toEqual({ value: null, count: 0 });
    expect(nova(model).metrics.csPerMin).toEqual({ value: null, count: 0 });
    expect(nova(model).metrics.kills).toEqual({ value: null, count: 0 });
    expect(Object.values(nova(model).metrics).every((item) => item.value === null || Number.isFinite(item.value))).toBe(true);
  });

  it("keeps aggregated means finite and discards ratios whose sums overflow", () => {
    const model = buildPlayerComparison([
      match("a", [row({ kills: Number.MAX_VALUE, assists: Number.MAX_VALUE, deaths: 1 })]),
      match("b", [row({ kills: Number.MAX_VALUE, assists: Number.MAX_VALUE, deaths: 2 })]),
    ], [player()]);
    expect(nova(model).metrics.kills).toEqual({ value: Number.MAX_VALUE, count: 2 });
    expect(nova(model).metrics.kda).toEqual({ value: null, count: 0 });
    expect(Object.values(nova(model).metrics).every((item) => item.value === null || Number.isFinite(item.value))).toBe(true);
  });

  it("keeps the input selection and raw objects unchanged", () => {
    const games = [match("a", [row({ raw: { visionScore: 10 }, kills: 2 })])];
    const players = [player()];
    const before = JSON.stringify({ games, players });
    buildPlayerComparison(games, players);
    expect(JSON.stringify({ games, players })).toBe(before);
  });
});
