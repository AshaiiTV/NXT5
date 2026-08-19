import { describe, expect, it } from "vitest";
import { multiOpggUrlFromRoster, playerRosterStatus, rosterPlayersByStatus } from "../utils/roster.js";

const players = [
  { id: "top-main", role: "TOP", roster_status: "MAIN", riot_id: "Top Main#EUW" },
  { id: "top-sub", role: "TOP", roster_status: "SUB", riot_id: "Top Sub#EUW" },
  { id: "jungle", role: "JGL", roster_status: "MAIN", riot_id: "Jungle#100" },
  { id: "coach", role: "COACH", roster_status: "INACTIVE", riot_id: "Hidden#EUW" },
];

describe("roster groups", () => {
  it("keeps legacy profiles compatible", () => {
    expect(playerRosterStatus({ role: "ADC" })).toBe("MAIN");
    expect(playerRosterStatus({ role: "SUB" })).toBe("SUB");
    expect(playerRosterStatus({ role: "COACH" })).toBe("INACTIVE");
    expect(playerRosterStatus({ role: "COACH", roster_status: "MAIN" })).toBe("INACTIVE");
  });

  it("selects only the requested lineup", () => {
    expect(rosterPlayersByStatus(players, "MAIN").map((player) => player.id)).toEqual(["top-main", "jungle"]);
    expect(rosterPlayersByStatus(players, "SUB").map((player) => player.id)).toEqual(["top-sub"]);
  });

  it("builds a Multi OP.GG without substitutes or staff", () => {
    const url = new URL(multiOpggUrlFromRoster(rosterPlayersByStatus(players, "MAIN"), "EUW"));
    expect(url.pathname).toBe("/lol/multisearch/euw");
    expect(url.searchParams.get("summoners")).toBe("Top Main#EUW,Jungle#100");
  });
});
