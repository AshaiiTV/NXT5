import { describe, expect, it } from "vitest";
import { workflowTestables } from "../NextPhase.jsx";

const { blockSnapshot, evaluateGoal, hasTimeline, reviewReason } = workflowTestables;

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
