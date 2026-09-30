import { describe, expect, it } from "vitest";
import { canonicalChampion, championNameKey } from "../../shared/champions.js";

describe("championNameKey", () => {
  it("keeps only lowercase letters and digits", () => {
    expect(championNameKey("Kai'Sa")).toBe("kaisa");
    expect(championNameKey(" Dr. Mundo ")).toBe("drmundo");
    expect(championNameKey("Nunu & Willump")).toBe("nunuwillump");
    expect(championNameKey("Wukong")).toBe("wukong");
  });

  it("does not apply Riot aliases", () => {
    expect(championNameKey("MonkeyKing")).toBe("monkeyking");
  });

  it("turns every falsy value into an empty key", () => {
    for (const value of [undefined, null, "", 0, false]) expect(championNameKey(value)).toBe("");
  });
});

describe("canonicalChampion", () => {
  it("resolves display names through the alias table built on championNameKey", () => {
    expect(canonicalChampion("Wukong")).toBe("MonkeyKing");
    expect(canonicalChampion("Kai'Sa")).toBe("Kaisa");
    expect(canonicalChampion(" Dr. Mundo ")).toBe("DrMundo");
    expect(canonicalChampion("Nunu & Willump")).toBe("Nunu");
  });

  it("strips punctuation from names without alias and keeps their case", () => {
    expect(canonicalChampion("Ahri")).toBe("Ahri");
    expect(canonicalChampion("Miss Fortune")).toBe("MissFortune");
    expect(canonicalChampion("")).toBe("");
  });
});
