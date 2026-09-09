import { describe, expect, it } from "vitest";
import { DISCOVERY_TRIAL_DAYS, SUBSCRIPTION_RESTRICTIONS_ENABLED, getPassFeatureAccess, getPlannedPassFeatureAccess, isPassFeatureLocked } from "../app/pass-access.js";

const features = ["workspace", "reviews", "imports", "exports", "trends", "compositions", "champion_pool", "planning", "statistics", "roster", "profiles"];

describe("Discovery trial and future team access", () => {
  it("prepares a complete 14-day trial with restrictions disabled before launch", () => {
    expect(DISCOVERY_TRIAL_DAYS).toBe(14);
    expect(SUBSCRIPTION_RESTRICTIONS_ENABLED).toBe(false);
  });

  it.each([
    ["without an entitlement", {}],
    ["after an expired trial", { hasActiveTrial: false, hasTeamPass: false }],
    ["during a trial", { hasActiveTrial: true, hasTeamPass: false }],
    ["with a Pass", { hasActiveTrial: false, hasTeamPass: true }],
  ])("keeps every tool accessible now %s", (_label, context) => {
    for (const feature of features) {
      expect(getPassFeatureAccess(feature, context), feature).toMatchObject({ allowed: true, requiresPass: false });
      expect(isPassFeatureLocked(feature, context), feature).toBe(false);
    }
  });

  it.each([
    ["the complete trial", { hasActiveTrial: true }],
    ["a team Pass after the trial", { hasActiveTrial: false, hasTeamPass: true }],
  ])("plans access to every tool with %s", (_label, context) => {
    for (const feature of features) {
      expect(getPlannedPassFeatureAccess(feature, context), feature).toMatchObject({ allowed: true, requiresPass: false });
    }
  });

  it("requires a Pass after the trial for all tools, including champion pools and the first imports", () => {
    for (const feature of features) {
      expect(getPlannedPassFeatureAccess(feature, { hasActiveTrial: false, hasTeamPass: false }), feature).toMatchObject({ allowed: false, requiresPass: true });
    }
  });
});
