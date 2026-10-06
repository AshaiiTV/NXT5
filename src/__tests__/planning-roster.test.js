import { describe, expect, it } from "vitest";
import { ROLES } from "../../shared/roles.js";
import { countAvailablePlanningRoles, planningRoleSlots } from "../utils/planning-roster.js";

const player = (id, role, roster_status = "MAIN", name = id) => ({ id, role, roster_status, name });
const selected = (slots, role) => slots.find((slot) => slot.role === role).player;

describe("planning position representatives", () => {
  it("keeps the starter ahead of an alphabetically earlier substitute without mutating the roster", () => {
    const substitute = player("top-sub", "TOP", "SUB", "A substitute");
    const starter = player("top-main", "TOP", "MAIN", "Z starter");
    const roster = [substitute, starter];
    expect(selected(planningRoleSlots(roster), "TOP")).toBe(starter);
    expect(selected(planningRoleSlots([...roster].reverse()), "TOP")).toBe(starter);
    expect(roster).toEqual([substitute, starter]);
    expect(substitute.roster_status).toBe("SUB");
  });

  it("falls back to a substitute of that position while excluding inactive profiles and staff", () => {
    const substitute = player("top-sub", "TOP", "SUB");
    const slots = planningRoleSlots([
      player("old-top", "TOP", "INACTIVE"), substitute,
      player("old-jungle", "JGL", "INACTIVE"), player("coach", "COACH", "MAIN"),
    ]);
    expect(selected(slots, "TOP")).toBe(substitute);
    expect(selected(slots, "JGL")).toBeNull();
    expect(countAvailablePlanningRoles(slots, ["old-top", "old-jungle", "coach"])).toBe(0);
    expect(countAvailablePlanningRoles(slots, ["top-sub"])).toBe(1);
  });

  it("keeps all five positions explicit and does not assign an unpositioned substitute to a missing role", () => {
    const slots = planningRoleSlots([player("top", "TOP"), player("flex", "SUB", "SUB")]);
    expect(slots.map((slot) => slot.role)).toEqual(ROLES);
    expect(slots.filter((slot) => !slot.player).map((slot) => slot.role)).toEqual(["JGL", "MID", "ADC", "SUP"]);
    expect(planningRoleSlots()).toEqual(ROLES.map((role) => ({ role, player: null })));
  });

  it("retains legacy defaults, role aliases and camel-case roster status", () => {
    const legacy = { id: "jungle", role: "JUNGLE" };
    const substitute = { id: "support", role: "UTILITY", rosterStatus: "SUB" };
    const slots = planningRoleSlots([legacy, substitute, { id: "inactive", role: "MID", rosterStatus: "INACTIVE" }]);
    expect(selected(slots, "JGL")).toBe(legacy);
    expect(selected(slots, "SUP")).toBe(substitute);
    expect(selected(slots, "MID")).toBeNull();
  });
});

describe("planning availability position count", () => {
  it("requires the five distinct represented positions and never counts a second TOP as a missing Support", () => {
    const starters = ROLES.map((role) => player(role, role));
    const substitute = player("second-top", "TOP", "SUB");
    const slots = planningRoleSlots([...starters, substitute]);
    expect(countAvailablePlanningRoles(slots, ["TOP", "JGL", "MID", "ADC", "second-top"])).toBe(4);
    expect(countAvailablePlanningRoles(slots, [...ROLES, "TOP", "second-top"])).toBe(5);
    expect(countAvailablePlanningRoles(slots, ["second-top"])).toBe(0);
    expect(countAvailablePlanningRoles(planningRoleSlots([...starters.filter((row) => row.role !== "SUP"), substitute]), [...ROLES, "second-top"])).toBe(4);
  });

  it("does not let a repeated profile fill two positions and accepts numeric availability IDs", () => {
    const slots = planningRoleSlots([player(1, "TOP"), player(1, "JGL"), player(2, "MID")]);
    expect(selected(slots, "TOP")?.id).toBe(1);
    expect(selected(slots, "JGL")).toBeNull();
    expect(countAvailablePlanningRoles(slots, new Set([1, "2", 1]))).toBe(2);
  });
});
