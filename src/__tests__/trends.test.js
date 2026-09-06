import { describe, expect, it } from "vitest";
import { buildTrendEvolution, hasTrendTimeline, sortTrendMatches, trendMatchTimestamp } from "../utils/trends.js";

function match(day, overrides = {}) {
  return {
    id: `game-${day}`,
    game_date: `2026-08-${String(day).padStart(2, "0")}T12:00:00Z`,
    result: "Victoire",
    participants: ["ALLY", "ENEMY"].flatMap((team) => Array.from({ length: 5 }, (_, index) => ({
      team_key: team,
      participantId: index + (team === "ALLY" ? 1 : 6),
      gold: team === "ALLY" ? 12000 : 10000,
      vision: team === "ALLY" ? 30 : 20,
      deaths: 2,
    }))),
    ...overrides,
  };
}

function metric(evolution, key) {
  return evolution.metrics.find((item) => item.key === key);
}

describe("trend chronology", () => {
  it("uses the played date even when older games are imported later, without mutating input", () => {
    const older = match(1, { raw: { info: { gameStartTimestamp: Date.parse("2026-08-01T12:00:00Z") } }, game_date: "2026-09-05", created_at: "2026-09-06" });
    const newer = match(2, { created_at: "2026-08-03" });
    const source = Object.freeze([Object.freeze(older), Object.freeze(newer)]);
    expect(sortTrendMatches(source)).toEqual([newer, older]);
    expect(source).toEqual([older, newer]);
  });

  it("falls back through valid game timestamps, dates, then import time", () => {
    expect(trendMatchTimestamp({ raw: { info: { gameStartTimestamp: 0, gameCreation: 1785585600000 } }, created_at: "2026-09-06" })).toBe(1785585600000);
    expect(trendMatchTimestamp({ raw: { info: { gameStartTimestamp: "1785585600" } } })).toBe(1785585600000);
    expect(trendMatchTimestamp({ game_date: "bad date", date: "2026-08-02", created_at: "2026-09-06" })).toBe(Date.parse("2026-08-02"));
    expect(trendMatchTimestamp({ game_date: "", date: null, created_at: "2026-09-06" })).toBe(Date.parse("2026-09-06"));
    expect(trendMatchTimestamp({ game_date: " ", date: false, created_at: "invalid" })).toBeNull();
  });

  it("puts unknown dates last and retains stable order for ties", () => {
    const unknownA = { id: "unknown-a" };
    const unknownB = { id: "unknown-b", created_at: "invalid" };
    const a = match(1, { id: "a" });
    const b = match(1, { id: "b" });
    expect(sortTrendMatches([unknownA, a, unknownB, b]).map((row) => row.id)).toEqual(["a", "b", "unknown-a", "unknown-b"]);
  });
});

describe("timeline availability", () => {
  it.each([
    { timeline: { info: { frames: [{}] } } },
    { metadata: { timeline: { info: { frames: [{}] } } } },
    { timeline: { frames: [{}] } },
    { timelineFrames: [{}] },
    { info: { timeline: { frames: [{}] } } },
    { frames: [{}] },
    { nxt5: { timelineSummary: { available: true } } },
    { nxt5: { timelineEvents: [{}] } },
  ])("recognizes a supported imported timeline shape", (raw) => {
    expect(hasTrendTimeline({ raw })).toBe(true);
  });

  it("does not claim a timeline for empty or invalid data", () => {
    expect(hasTrendTimeline(null)).toBe(false);
    expect(hasTrendTimeline({ raw: { timeline: { info: { frames: [] } }, nxt5: { timelineSummary: { available: false }, timelineEvents: [] } } })).toBe(false);
    expect(hasTrendTimeline({ raw: { frames: "missing", nxt5: { timelineSummary: { available: "false" } } } })).toBe(false);
  });
});

describe("trend evolution", () => {
  it("compares consecutive equally sized blocks, skipping unknown dates and an odd trailing game", () => {
    const evolution = buildTrendEvolution([match(2), { id: "undated" }, match(5), match(1), match(4), match(3)]);
    expect(evolution.size).toBe(2);
    expect(evolution.recent.map((row) => row.id)).toEqual(["game-5", "game-4"]);
    expect(evolution.previous.map((row) => row.id)).toEqual(["game-3", "game-2"]);
    expect(evolution.recent.some((row) => evolution.previous.includes(row))).toBe(false);
  });

  it("caps each block at five games", () => {
    const evolution = buildTrendEvolution(Array.from({ length: 12 }, (_, index) => match(index + 1)));
    expect(evolution.size).toBe(5);
    expect(evolution.recent.map((row) => row.id)).toEqual(["game-12", "game-11", "game-10", "game-9", "game-8"]);
    expect(evolution.previous.map((row) => row.id)).toEqual(["game-7", "game-6", "game-5", "game-4", "game-3"]);
  });

  it.each([0, 1, 2, 3])("does not compare with only %i dated games", (count) => {
    expect(buildTrendEvolution([...Array.from({ length: count }, (_, index) => match(index + 1)), {}, {}]))
      .toEqual({ recent: [], previous: [], size: 0, metrics: [] });
  });

  it("uses known results only and reports final team averages with their coverage", () => {
    const games = [match(1, { result: "Défaite" }), match(2), match(3, { result: "Inconnu" }), match(4)];
    const evolution = buildTrendEvolution(games);
    expect(metric(evolution, "wr")).toMatchObject({ current: 100, previous: 50, delta: 50, unit: "pts", count: 1, previousCount: 2 });
    expect(metric(evolution, "gold")).toMatchObject({ current: 10000, previous: 10000, delta: 0, count: 2, previousCount: 2 });
    expect(metric(evolution, "deaths")).toMatchObject({ current: 10, delta: 0, inverse: true });
    expect(metric(evolution, "vision")).toMatchObject({ current: 50, delta: 0 });
  });

  it("keeps missing stats and missing results unavailable instead of coercing them to zero", () => {
    const games = Array.from({ length: 4 }, (_, index) => match(index + 1, { participants: [], result: null }));
    for (const item of buildTrendEvolution(games).metrics) {
      expect(item).toMatchObject({ current: null, previous: null, delta: null, count: 0, previousCount: 0 });
    }
  });

  it("requires both complete teams for differences and five allies for deaths", () => {
    const incompleteEnemy = match(4);
    incompleteEnemy.participants.pop();
    const incompleteAlly = match(3);
    incompleteAlly.participants.shift();
    const evolution = buildTrendEvolution([match(1), match(2), incompleteAlly, incompleteEnemy]);
    expect(metric(evolution, "gold")).toMatchObject({ current: null, previous: 10000, delta: null, count: 0, previousCount: 2 });
    expect(metric(evolution, "vision")).toMatchObject({ current: null, delta: null, count: 0 });
    expect(metric(evolution, "deaths")).toMatchObject({ current: 10, count: 1, previousCount: 2 });
  });

  it("excludes an entire game for a missing participant stat and preserves real zeroes", () => {
    const missing = match(4);
    missing.participants[0].gold = null;
    missing.participants[0].vision = " ";
    missing.participants[0].deaths = undefined;
    const zeros = match(3);
    zeros.participants.forEach((row) => { row.gold = 0; row.vision = "0"; row.deaths = 0; });
    const evolution = buildTrendEvolution([match(1), match(2), zeros, missing]);
    expect(metric(evolution, "gold")).toMatchObject({ current: 0, previous: 10000, delta: -10000, count: 1 });
    expect(metric(evolution, "vision")).toMatchObject({ current: 0, previous: 50, delta: -50, count: 1 });
    expect(metric(evolution, "deaths")).toMatchObject({ current: 0, previous: 10, delta: -10, count: 1 });
  });

  it("can read preserved Riot values when normalized statistics are absent", () => {
    const rawGame = (day) => match(day, { participants: match(day).participants.map(({ team_key, gold, vision, deaths }) => ({ team_key, raw: { goldEarned: gold, visionScore: vision, deaths } })) });
    const evolution = buildTrendEvolution([rawGame(1), rawGame(2), rawGame(3), rawGame(4)]);
    expect(metric(evolution, "gold")).toMatchObject({ current: 10000, count: 2 });
    expect(metric(evolution, "vision")).toMatchObject({ current: 50, count: 2 });
    expect(metric(evolution, "deaths")).toMatchObject({ current: 10, count: 2 });
  });
});
