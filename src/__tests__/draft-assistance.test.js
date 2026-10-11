import { describe, expect, it } from "vitest";
import { buildDraftAssistance } from "../utils/draft-assistance.js";

const player = { id: "player", team_id: "team", role: "MID", name: "Nxt", riot_id: "Nxt#EUW" };
const pool = (champion, extra = {}) => ({ id: `pool-${champion}`, team_id: "team", player_id: "player", role: "MID", champion, source: "manual", status: "lock", ...extra });
const ally = (champion = "Ahri", extra = {}) => ({ team_key: "ALLY", role: "MID", player_id: "player", champion, ...extra });
const enemy = (champion = "Leblanc", extra = {}) => ({ team_key: "ENEMY", role: "MID", champion, ...extra });
const game = (id, result = "Victoire", participants = [ally(), enemy()], extra = {}) => ({ id, team_id: "team", result, participants, ...extra });
const build = (extra = {}) => buildDraftAssistance({ teamId: "team", player, role: "MID", opponentChampion: "LeBlanc", championPool: [pool("Ahri")], ...extra });

describe("draft assistance", () => {
  it("only suggests the selected player's manual pool at the selected team and role", () => {
    const rows = [
      pool("Ahri"),
      pool("Orianna", { source: "riot_manual" }),
      pool("Syndra", { source: "riot" }),
      pool("Vex", { team_id: "other-team" }),
      pool("Lux", { player_id: "other-player", player_name: player.name }),
      pool("Zed", { player_id: null, player_name: player.name }),
      pool("Galio", { role: "TOP" }),
      pool("Taliyah", { role: "UNKNOWN" }),
      pool("Karma", { team_id: null }),
      pool("", { source: "manual" }),
    ];
    expect(build({ championPool: rows }).map((entry) => entry.champion)).toEqual(["Ahri", "Orianna"]);
    expect(build({ player: { ...player, team_id: "another" } })).toEqual([]);
    expect(build({ player: { ...player, id: null } })).toEqual([]);
    expect(build({ teamId: "" })).toEqual([]);
    expect(build({ role: "UNKNOWN" })).toEqual([]);
    expect(buildDraftAssistance()).toEqual([]);
  });

  it("rejects pool rows without an actionable identifier", () => {
    const rows = [pool("Ahri", { id: undefined }), pool("Orianna", { id: null }), pool("Vex", { id: "" }), pool("Galio", { id: "   " }), pool("Syndra")];
    expect(build({ championPool: rows }).map((entry) => entry.champion)).toEqual(["Syndra"]);
  });

  it("canonicalizes aliases, deduplicates champions and excludes all already selected champions including the enemy", () => {
    const adc = { ...player, role: "BOTTOM" };
    const rows = [pool("Kai'Sa", { role: "BOT" }), pool("Kaisa", { role: "ADC" }), pool("Miss Fortune", { role: "" }), pool("Ashe", { role: "BOTTOM" })];
    const result = build({ player: adc, role: "ADC", championPool: rows, opponentChampion: "ASHE", excludedChampions: ["missfortune"] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ champion: "Kaisa", poolRow: rows[0], mastery: { status: "lock", rank: 0 } });
  });

  it("gives declared mastery precedence and orders experience by known game count, never imported or pool win rates", () => {
    const rows = [pool("Ahri", { games: 999, wins: 999 }), pool("Orianna"), pool("Syndra", { status: "pocket" }), pool("Vex", { status: "not-a-status" }), pool("Zed", { status: "danger" })];
    const matches = [game("ahri", "Victoire"), ...Array.from({ length: 3 }, (_, i) => game(`orianna-${i}`, "Défaite", [ally("Orianna"), enemy()])), ...Array.from({ length: 8 }, (_, i) => game(`syndra-${i}`, "Victoire", [ally("Syndra"), enemy()]))];
    const result = build({ championPool: rows, matches });
    expect(result.map((entry) => entry.champion)).toEqual(["Orianna", "Ahri", "Syndra", "Vex", "Zed"]);
    expect(result[0].experience).toMatchObject({ games: 3, known: 3, losses: 3, winrate: 0 });
    expect(result[1].experience).toMatchObject({ games: 1, known: 1, wins: 1, winrate: 100 });
    expect(result[3].mastery).toEqual({ status: "work", rank: 2 });
    expect(result[4].experience).toMatchObject({ games: 0, known: 0, winrate: null });
  });

  it("scopes evidence to explicit team, player and role associations without inferring names or Riot IDs", () => {
    const accepted = game("accepted", "Victoire", [ally("Ahri", { role: "MIDDLE" }), enemy()]);
    const rejected = [
      game("other-team", "Victoire", [ally(), enemy()], { team_id: "other" }),
      game("no-team", "Victoire", [ally(), enemy()], { team_id: null }),
      game("other-player", "Victoire", [ally("Ahri", { player_id: "another", summoner_name: player.name, riot_id: player.riot_id }), enemy()]),
      game("no-player", "Victoire", [ally("Ahri", { player_id: null, summoner_name: player.name, riot_id: player.riot_id }), enemy()]),
      game("wrong-side", "Victoire", [ally("Ahri", { team_key: "ENEMY" }), enemy()]),
      game("off-role", "Victoire", [ally("Ahri", { role: "TOP" }), enemy()]),
      game("unknown-role", "Victoire", [ally("Ahri", { role: "UNKNOWN" }), enemy()]),
      game("no-role", "Victoire", [ally("Ahri", { role: null }), enemy()]),
      game("ambiguous-player", "Victoire", [ally(), ally("Orianna"), enemy()]),
    ];
    const result = build({ matches: [...rejected, accepted] })[0];
    expect(result.experience).toMatchObject({ games: 1, known: 1, matches: [accepted] });
    expect(result.matchup.matches).toEqual([accepted]);
  });

  it("counts each imported game once and retains distinct ID-less games", () => {
    const first = game("first", "Victoire", [ally(), ally(), enemy()], { game_id: "EUW1_123" });
    const second = game("second", "Défaite");
    const noIdOne = game(undefined);
    const noIdTwo = game(undefined, "Défaite");
    const result = build({ matches: [first, { ...first, id: "duplicate-import" }, second, { ...second }, noIdOne, noIdOne, noIdTwo] })[0];
    expect(result.experience).toMatchObject({ games: 4, known: 4, wins: 2, losses: 2, matches: [first, second, noIdOne, noIdTwo] });
    // The duplicate allied role cannot be represented as a verified matchup.
    expect(result.matchup.games).toBe(3);
  });

  it("keeps unknown outcomes visible as coverage without treating them as defeats or ranking evidence", () => {
    const known = game("known", "Défaite", [ally("Orianna"), enemy()]);
    const unknown = Array.from({ length: 6 }, (_, i) => game(`unknown-${i}`, i % 2 ? "pending" : ""));
    const result = build({ championPool: [pool("Ahri"), pool("Orianna")], matches: [...unknown, known] });
    expect(result.map((entry) => entry.champion)).toEqual(["Orianna", "Ahri"]);
    expect(result[1].experience).toMatchObject({ games: 6, known: 0, unknown: 6, wins: 0, losses: 0, winrate: null });
    expect(result[1].matchup).toMatchObject({ games: 6, known: 0, winrate: null });
  });

  it("observes a matchup only when both sides have exactly one explicit participant at that role", () => {
    const paired = game("paired", "Défaite", [ally("Ahri", { role: "", raw: { teamPosition: "MIDDLE" } }), enemy("LeBlanc", { role: "MIDDLE" })]);
    const others = [
      game("different-opponent", "Victoire", [ally(), enemy("Lux")]),
      game("opponent-off-role", "Victoire", [ally(), enemy("Leblanc", { role: "TOP" })]),
      game("ambiguous-enemies", "Victoire", [ally(), enemy(), enemy("Lux")]),
      game("ambiguous-allies", "Victoire", [ally(), ally("Lux", { player_id: "another" }), enemy()]),
      game("missing-opponent-role", "Victoire", [ally(), enemy("Leblanc", { role: "UNKNOWN" })]),
    ];
    const result = build({ matches: [...others, paired] })[0];
    expect(result.experience.games).toBe(6);
    expect(result.matchup).toMatchObject({ games: 1, known: 1, wins: 0, losses: 1, winrate: 0, matches: [paired] });
    expect(build({ opponentChampion: "", matches: [paired] })[0].matchup.games).toBe(0);
  });

  it("does not mutate input arrays, player, pool rows or imported matches", () => {
    const rows = Object.freeze([Object.freeze(pool("Ahri"))]);
    const match = Object.freeze(game("game", "Victoire", Object.freeze([Object.freeze(ally()), Object.freeze(enemy())])));
    const matches = Object.freeze([match]);
    const selectedPlayer = Object.freeze({ ...player });
    const result = build({ player: selectedPlayer, championPool: rows, matches, excludedChampions: Object.freeze([]) });
    expect(result[0].poolRow).toBe(rows[0]);
    expect(result[0].experience.matches[0]).toBe(match);
    expect(rows[0]).not.toHaveProperty("experience");
  });
});
