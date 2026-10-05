import { describe, expect, it } from "vitest";
import { auditFailures } from "../../tools/audit-policy.mjs";

const advisory = { url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" };
const lock = { packages: { "node_modules/braces": { dev: true }, "node_modules/micromatch": { dev: true } } };
const report = { vulnerabilities: {
  braces: { severity: "high", nodes: ["node_modules/braces"], via: [advisory] },
  micromatch: { severity: "high", nodes: ["node_modules/micromatch"], via: ["braces"] },
} };
const now = new Date("2026-10-05T00:00:00Z");
describe("temporary dependency audit exception", () => {
  it("accepts only the build-only advisory and its dependents", () => expect(auditFailures(report, lock, now)).toEqual([]));
  it("blocks production use", () => expect(auditFailures(report, { packages: {} }, now)).toEqual(["braces", "micromatch"]));
  it("blocks another advisory on the same package", () => {
    const changed = structuredClone(report);
    changed.vulnerabilities.braces.via.push({ url: "https://github.com/advisories/another" });
    expect(auditFailures(changed, lock, now)).toEqual(["braces", "micromatch"]);
  });
  it("expires automatically", () => expect(auditFailures(report, lock, new Date("2026-11-05"))).toEqual(["braces", "micromatch"]));
  it("fails on an invalid audit response", () => expect(() => auditFailures({ error: {} }, lock, now)).toThrow());
});
