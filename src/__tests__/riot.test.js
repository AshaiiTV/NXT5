import { describe, expect, it } from "vitest";
import { buildChampionPool, isValidGameId, isValidRiotId, normalizeRiotId, parseGameId } from "../utils/riot.js";

describe("Game ID parsing", () => {
  it("accepts an EUW1 Riot match id", () => {
    expect(parseGameId(" euw1_7123456789 ")).toEqual({
      gameId: "EUW1_7123456789",
      platform: "EUW1",
      numericId: "7123456789",
    });
  });

  it("rejects malformed ids", () => {
    expect(isValidGameId("7123456789")).toBe(false);
    expect(isValidGameId("NA1_7123456789")).toBe(false);
    expect(() => parseGameId("EUW1_abc")).toThrow(/Game ID invalide/);
  });
});

describe("Riot ID validation", () => {
  it("accepts Pseudo#TAG and normalizes spaces around the separator", () => {
    expect(normalizeRiotId("Ashaii # EUW")).toBe("Ashaii#EUW");
    expect(isValidRiotId("Ashaii#EUW")).toBe(true);
  });

  it("rejects missing or invalid tags", () => {
    expect(isValidRiotId("Ashaii")).toBe(false);
    expect(isValidRiotId("Ashaii#")).toBe(false);
    expect(isValidRiotId("#EUW")).toBe(false);
  });
});

describe("Champion pool calculation", () => {
  it("groups games by player and champion with winrate and KDA", () => {
    const pool = buildChampionPool([
      { player_id: "p1", player_name: "Top", champion: "Maokai", result: "Victoire", kills: 2, deaths: 1, assists: 8 },
      { player_id: "p1", player_name: "Top", champion: "Maokai", result: "Défaite", kills: 1, deaths: 2, assists: 3 },
      { player_id: "p1", player_name: "Top", champion: "Darius", win: true, kills: 8, deaths: 2, assists: 4 },
    ]);

    expect(pool[0]).toMatchObject({
      player_id: "p1",
      champion: "Maokai",
      games: 2,
      wins: 1,
      losses: 1,
      winrate: 50,
      kda: 6,
    });
    expect(pool[1]).toMatchObject({ champion: "Darius", games: 1, winrate: 100, kda: 6 });
  });
});
