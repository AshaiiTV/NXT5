import { describe, expect, it } from "vitest";
import { ROLES, ROLE_SORT_ORDER, RIOT_POSITION_ROLES, canonicalRole, normalizeRole } from "../../shared/roles.js";

describe("shared roles", () => {
  it("lists the five gameplay roles in lane order", () => {
    expect(ROLES).toEqual(["TOP", "JGL", "MID", "ADC", "SUP"]);
    expect(Object.isFrozen(ROLES)).toBe(true);
    expect(Object.isFrozen(RIOT_POSITION_ROLES)).toBe(true);
  });

  it("normalizeRole converts Riot positions and passes any other value through uppercased", () => {
    expect(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "SUPPORT"].map(normalizeRole)).toEqual(["TOP", "JGL", "MID", "ADC", "SUP", "SUP"]);
    expect(normalizeRole("jungle")).toBe("JGL");
    expect(normalizeRole("JGL")).toBe("JGL");
    expect(normalizeRole("coach")).toBe("COACH");
    expect(normalizeRole("sub")).toBe("SUB");
    expect(normalizeRole("BOT")).toBe("BOT");
    expect(normalizeRole(" MIDDLE ")).toBe(" MIDDLE ");
    for (const value of [undefined, null, "", 0]) expect(normalizeRole(value)).toBe("");
  });

  it("canonicalRole trims, accepts every alias including BOT, and rejects the rest", () => {
    expect(canonicalRole(" jungle ")).toBe("JGL");
    expect(canonicalRole("MIDDLE")).toBe("MID");
    expect(canonicalRole("bot")).toBe("ADC");
    expect(canonicalRole("BOTTOM")).toBe("ADC");
    expect(canonicalRole("UTILITY")).toBe("SUP");
    expect(canonicalRole("support")).toBe("SUP");
    for (const role of ROLES) expect(canonicalRole(role)).toBe(role);
    for (const value of ["NONE", "COACH", "SUB", "", undefined, null, 0, "constructor", "__proto__"]) expect(canonicalRole(value)).toBe("");
  });

  it("ROLE_SORT_ORDER matches the historical match-import ordering table", () => {
    expect(ROLE_SORT_ORDER).toEqual({ TOP: 1, JUNGLE: 2, JGL: 2, MIDDLE: 3, MID: 3, BOTTOM: 4, ADC: 4, UTILITY: 5, SUP: 5, SUPPORT: 5 });
    expect(ROLE_SORT_ORDER.BOT).toBeUndefined();
  });
});
