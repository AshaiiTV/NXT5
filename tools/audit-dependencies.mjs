import { spawnSync } from "node:child_process";
import { auditFailures } from "./audit-policy.mjs";

const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["audit", "--json"], { encoding: "utf8", shell: process.platform === "win32" });
if (result.error || ![0, 1].includes(result.status)) throw result.error || new Error(result.stderr || "npm audit failed");
const report = JSON.parse(result.stdout);
const failures = auditFailures(report);
if (failures.length) {
  console.error("Dependency audit blocked:", failures.join(", "));
  process.exitCode = 1;
} else {
  console.log("Dependency audit passed. Moderate, high and critical advisories are blocking, with no exceptions.");
}
