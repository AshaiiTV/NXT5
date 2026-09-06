import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockComparisonPanel, workflowTestables } from "../NextPhase.jsx";

const { blockMatches, blockSnapshot, blockOverlapCount, blockDateRange, blockDelta, evaluateGoal, hasTimeline, reviewReason } = workflowTestables;

function match(id, result, allyGold, enemyGold, createdAt = "2026-07-31T12:00:00.000Z") {
  return {
    id,
    result,
    side: id === "a" ? "Blue Side" : "Red Side",
    created_at: createdAt,
    raw: { metadata: { timeline: { info: { frames: [{ timestamp: 0 }] } } } },
    participants: [
      { team_key: "ALLY", role: "ADC", gold: allyGold, damage: 20000, vision: 20, deaths: 2, cs: 210, kp: 0.65 },
      { team_key: "ENEMY", role: "ADC", gold: enemyGold, damage: 18000, vision: 18, deaths: 4, cs: 190, kp: 0.5 },
    ],
  };
}

describe("workflow calculations", () => {
  it("compares a block from imported participant data", () => {
    const snapshot = blockSnapshot([match("a", "Victoire", 12000, 10000), match("b", "Défaite", 9000, 10000)]);
    expect(snapshot.games).toBe(2);
    expect(snapshot.wr).toBe(50);
    expect(snapshot.gold).toBe(500);
    expect(snapshot.roles.find((row) => row.role === "ADC")?.kp).toBe(65);
  });

  it("keeps empty blocks and missing role observations unavailable", () => {
    const empty = blockSnapshot([]);
    expect(empty).toMatchObject({ games: 0, wr: null, gold: null, damage: null, vision: null, deaths: null });
    expect(empty.roles.every((role) => role.kp === null)).toBe(true);
    expect(blockDelta(empty.wr, 60)).toBeNull();
    const game = match("a", "Victoire", 12000, 10000);
    delete game.participants[0].kp;
    const missing = blockSnapshot([game]);
    expect(missing.roles.find((role) => role.role === "ADC").kp).toBeNull();
    game.participants[0].kp = 0;
    expect(blockSnapshot([game]).roles.find((role) => role.role === "ADC").kp).toBe(0);
  });

  it("compares recent games by play time even when an old game was imported last", () => {
    const games = Array.from({ length: 10 }, (_, index) => ({
      ...match(`game-${index + 1}`, "Victoire", 12000, 10000),
      created_at: index === 0 ? "2026-09-01T12:00:00Z" : "2026-08-01T12:00:00Z",
      raw: { info: { gameStartTimestamp: Date.UTC(2026, 6, index + 1, 12) } },
    }));
    expect(blockMatches(games, [], "recent").map((game) => game.id)).toEqual(["game-10", "game-9", "game-8", "game-7", "game-6"]);
    expect(blockMatches(games, [], "previous").map((game) => game.id)).toEqual(["game-5", "game-4", "game-3", "game-2", "game-1"]);
    expect(blockDateRange(blockMatches(games, [], "recent"))).toContain("2026");
    expect(blockDateRange([{}])).toBe("Dates indisponibles");
  });

  it("counts distinct shared games across overlapping category blocks", () => {
    const shared = { ...match("a", "Victoire", 12000, 10000), category_ids: ["scrim", "bootcamp"] };
    const separate = { ...match("b", "Défaite", 9000, 10000), category_id: "scrim" };
    const games = [shared, separate];
    const left = blockMatches(games, [], "category:scrim");
    const right = blockMatches(games, [], "category:bootcamp");
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(1);
    expect(blockOverlapCount(left, [...right, ...right])).toBe(1);
    expect(blockOverlapCount(left, [])).toBe(0);
  });

  it("shows an unavailable comparison when the previous block is empty", () => {
    const html = renderToStaticMarkup(<BlockComparisonPanel matches={[match("a", "Victoire", 12000, 10000)]} />);
    expect(html).toContain("Aucune game dans ce bloc");
    expect(html).toContain("deux blocs non vides");
    expect(html).toContain("31 juil. 2026");
    expect(html).not.toContain("+100 pts");
    expect(html).not.toContain("+65 pts");
  });

  it("renders percentage changes as points and shows both sample sizes", () => {
    const games = Array.from({ length: 10 }, (_, index) => match(`game-${index}`, index < 5 ? "Victoire" : "Défaite", 12000, 10000, new Date(Date.UTC(2026, 6, 31 - index, 12)).toISOString()));
    const html = renderToStaticMarkup(<BlockComparisonPanel matches={games} />);
    expect(html).toContain("+100 pts");
    expect(html).not.toContain("+100%");
    expect(html).toContain("Aucune game commune");
    expect(html).toContain("5 games");
  });

  it("recognizes every supported timeline storage shape", () => {
    expect(hasTimeline(match("a", "Victoire", 1, 1))).toBe(true);
    expect(hasTimeline({ raw: {} })).toBe(false);
  });

  it("tracks only unique games imported after an objective starts", () => {
    const rows = [
      { deaths: 2, match: { id: "new-1", created_at: "2026-07-31T13:00:00.000Z" } },
      { deaths: 2, match: { id: "new-1", created_at: "2026-07-31T13:00:00.000Z" } },
      { deaths: 3, match: { id: "new-2", created_at: "2026-07-31T14:00:00.000Z" } },
      { deaths: 1, match: { id: "old", created_at: "2026-07-30T10:00:00.000Z" } },
    ];
    const result = evaluateGoal({ metric: "deaths", operator: "lte", target_value: 3, sample_size: 3, required_successes: 2, starts_at: "2026-07-31T12:00:00.000Z" }, rows);
    expect(result.rows).toHaveLength(2);
    expect(result.successes).toBe(2);
    expect(result.complete).toBe(true);
  });

  it("prioritizes a heavy losing game in the review reason", () => {
    expect(reviewReason(match("b", "Défaite", 6000, 11000))).toContain("or de retard");
  });
});
