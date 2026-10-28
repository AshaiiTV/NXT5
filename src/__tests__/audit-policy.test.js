import { describe, expect, it } from "vitest";
import { auditFailures } from "../../tools/audit-policy.mjs";

describe("dependency audit policy", () => {
  it("accepts a clean audit", () => {
    expect(auditFailures({ vulnerabilities: {} })).toEqual([]);
  });

  it("blocks moderate, high and critical advisories, including build dependencies", () => {
    expect(auditFailures({ vulnerabilities: {
      production: { severity: "critical" },
      build: { severity: "high", isDirect: false },
      transitive: { severity: "moderate" },
      informational: { severity: "low" },
    } })).toEqual(["production", "build", "transitive"]);
  });

  it("no longer exempts the old braces advisory or its dependents", () => {
    expect(auditFailures({ vulnerabilities: {
      braces: { severity: "high", via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }] },
      micromatch: { severity: "high", via: ["braces"] },
    } })).toEqual(["braces", "micromatch"]);
  });

  it.each([{}, { error: {} }, { error: {}, vulnerabilities: {} }])("rejects invalid or failed audit responses", (report) => {
    expect(() => auditFailures(report)).toThrow("Invalid npm audit response");
  });
});
