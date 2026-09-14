import { describe, expect, it } from "vitest";
import { importStatus, rate, selectTeams } from "../pages/admin/admin-metrics.js";

const referenceDate = "2026-09-07T12:00:00.000Z";
const teams = [
  { id: "old", name: "Équipe Alpha", matches: 5, players: 0, lastActivityAt: "2026-08-01T12:00:00Z" },
  { id: "recent", name: "Beta", matches: 2, players: 5, lastActivityAt: "2026-09-07T11:00:00Z" },
  { id: "new", name: "Gamma", matches: 0, players: 1, lastActivityAt: null },
];

describe("admin import metrics", () => {
  it("separates teams with no imports from teams whose imports stopped", () => {
    expect(importStatus(teams[0], referenceDate).id).toBe("quiet");
    expect(importStatus(teams[1], referenceDate).id).toBe("recent");
    expect(importStatus(teams[2], referenceDate).id).toBe("never");
  });
  it("uses the exact 30-day boundary and preserves unknown dates", () => {
    expect(importStatus({ matches: 1, lastActivityAt: "2026-08-08T12:00:00Z" }, referenceDate).id).toBe("recent");
    expect(importStatus({ matches: 1, lastActivityAt: "2026-08-08T11:59:59Z" }, referenceDate).id).toBe("quiet");
    expect(importStatus({ matches: 1, lastActivityAt: null }, referenceDate).id).toBe("unknown");
  });
  it("combines accent-insensitive search with the selected filter", () => {
    expect(selectTeams(teams, { search: "equipe", filter: "quiet", referenceDate }).map((row) => row.id)).toEqual(["old"]);
    expect(selectTeams(teams, { search: "equipe", filter: "recent", referenceDate })).toEqual([]);
    expect(selectTeams(teams, { filter: "empty", referenceDate }).map((row) => row.id)).toEqual(["old"]);
  });
  it("sorts by actual imports and does not mutate the source", () => {
    expect(selectTeams(teams, { referenceDate }).map((row) => row.id)).toEqual(["recent", "old", "new"]);
    expect(selectTeams(teams, { sort: "volume", referenceDate }).map((row) => row.id)).toEqual(["old", "recent", "new"]);
    expect(teams.map((row) => row.id)).toEqual(["old", "recent", "new"]);
  });
  it("does not invent a percentage when no population exists", () => {
    expect(rate(0, 0)).toBe("—");
    expect(rate(0, 5)).toBe("0 %");
    expect(rate(1, 4)).toBe("25 %");
  });
});
