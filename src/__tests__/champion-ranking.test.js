import { describe, expect, it } from "vitest";
import { rankChampionMetrics } from "../utils/champion-ranking.js";

const champions = [
  { champion: "Ahri", games: 100, winrate: 20, kda: 2 },
  { champion: "Lux", games: 10, winrate: 100, kda: 1 },
  { champion: "Hwei", games: 70, winrate: 75, kda: 8 },
];
const names = (rows) => rows.map((row) => row.champion);

describe("combined champion ranking", () => {
  it("balances volume and winrate instead of applying either criterion first", () => {
    expect(names(rankChampionMetrics(champions, ["games"]))).toEqual(["Ahri", "Hwei", "Lux"]);
    expect(names(rankChampionMetrics(champions, ["winrate"]))).toEqual(["Lux", "Hwei", "Ahri"]);
    const combined = rankChampionMetrics(champions, ["games", "winrate"]);
    expect(names(combined)).toEqual(["Hwei", "Ahri", "Lux"]);
    expect(combined[0].rankingScore).toBeCloseTo(72.5);
    expect(combined[1].rankingScore).toBeCloseTo(60);
    expect(combined[2].rankingScore).toBeCloseTo(55);
  });

  it("gives the KDA an equal share when it joins the selected criteria", () => {
    const context = [...champions, { champion: "Annie", games: 20, winrate: 60, kda: 50 }];
    expect(names(rankChampionMetrics(context, ["games", "winrate"]))).toEqual(["Hwei", "Ahri", "Lux", "Annie"]);
    const combined = rankChampionMetrics(context, ["games", "winrate", "kda"]);
    expect(names(combined)).toEqual(["Annie", "Hwei", "Ahri", "Lux"]);
    expect(combined[0].rankingScore).toBeCloseTo(60);
  });

  it("keeps unknown results distinct from zero wins in both directions", () => {
    const context = [
      { champion: "Ahri", games: 30, winrate: null, kda: 3 },
      { champion: "Lux", games: 4, winrate: 0, kda: 0 },
      { champion: "Hwei", games: 10, winrate: 50, kda: 2 },
    ];
    const descending = rankChampionMetrics(context, ["winrate"]);
    expect(names(descending)).toEqual(["Hwei", "Lux", "Ahri"]);
    expect(descending.map((row) => row.rankingScore)).toEqual([50, 0, null]);
    expect(names(rankChampionMetrics(context, ["winrate"], "asc"))).toEqual(["Lux", "Hwei", "Ahri"]);
    expect(rankChampionMetrics(context, ["games", "winrate"])[2].rankingScore).toBeNull();
    expect(names(rankChampionMetrics(context, ["games"]))).toEqual(["Ahri", "Hwei", "Lux"]);
  });

  it("handles an entirely zero context without dividing by zero", () => {
    const context = ["Lux", "Hwei", "Ahri"].map((champion) => ({ champion, games: 0, winrate: 0, kda: 0 }));
    const result = rankChampionMetrics(context, ["games", "winrate", "kda"]);
    expect(names(result)).toEqual(["Ahri", "Hwei", "Lux"]);
    expect(result.map((row) => row.rankingScore)).toEqual([0, 0, 0]);
    expect(names(rankChampionMetrics(context, ["games", "winrate", "kda"], "asc"))).toEqual(["Ahri", "Hwei", "Lux"]);
  });

  it("treats invalid active metrics as missing and ignores missing inactive ones", () => {
    const context = [
      { champion: "Ahri", games: 10, winrate: 50, kda: null },
      { champion: "Lux", games: 10, winrate: 50, kda: -1 },
      { champion: "Hwei", games: 10, winrate: 50, kda: Infinity },
      { champion: "Annie", games: 10, winrate: 50, kda: "" },
      { champion: "Zyra", games: 10, winrate: 50, kda: 0 },
    ];
    expect(rankChampionMetrics(context, ["games", "winrate"]).every((row) => row.rankingScore === 75)).toBe(true);
    const result = rankChampionMetrics(context, ["kda"], "asc");
    expect(names(result)).toEqual(["Zyra", "Ahri", "Annie", "Hwei", "Lux"]);
    expect(result.map((row) => row.rankingScore)).toEqual([0, null, null, null, null]);
  });

  it("reverses the combined score and sorts ties by the displayed champion name", () => {
    expect(names(rankChampionMetrics(champions, ["games", "winrate"], "asc"))).toEqual(["Lux", "Ahri", "Hwei"]);
    const tied = ["MonkeyKing", "XinZhao", "Velkoz"].map((champion) => ({ champion, games: 5, winrate: 50, kda: 2 }));
    expect(names(rankChampionMetrics(tied))).toEqual(["Velkoz", "MonkeyKing", "XinZhao"]);
    expect(names(rankChampionMetrics(tied, ["games"], "asc"))).toEqual(["Velkoz", "MonkeyKing", "XinZhao"]);
  });

  it("preserves inputs and row data, deduplicates criteria, and defaults an empty selection to games", () => {
    const context = Object.freeze(champions.map((row) => Object.freeze({ ...row, marker: row.champion })));
    const criteria = Object.freeze(["games", "winrate", "games"]);
    const combined = rankChampionMetrics(context, criteria);
    expect(combined[0]).toMatchObject({ champion: "Hwei", marker: "Hwei", rankingScore: 72.5 });
    expect(context[0]).not.toHaveProperty("rankingScore");
    expect(names(context)).toEqual(["Ahri", "Lux", "Hwei"]);
    expect(criteria).toEqual(["games", "winrate", "games"]);
    expect(rankChampionMetrics(context, [])).toEqual(rankChampionMetrics(context));
    expect(rankChampionMetrics([])).toEqual([]);
  });
});
