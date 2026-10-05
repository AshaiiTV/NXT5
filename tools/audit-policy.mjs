// Temporary exception for an unpatched build-only dependency. Remove when patched.
export function auditFailures(report, lock, now = new Date()) {
  if (report.error || !report.vulnerabilities) throw new Error("Invalid npm audit response");
  const entries = report.vulnerabilities;
  const accepted = new Set();
  const active = now < new Date("2026-11-05T00:00:00Z");
  for (let pass = 0; pass < Object.keys(entries).length; pass++) {
    for (const [name, entry] of Object.entries(entries)) {
      const buildOnly = entry.nodes?.length && entry.nodes.every((path) => lock.packages?.[path]?.dev === true);
      if (active && buildOnly && entry.via?.length && entry.via.every((cause) => typeof cause === "string"
        ? accepted.has(cause)
        : name === "braces" && cause.url === "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm")) accepted.add(name);
    }
  }
  return Object.entries(entries).filter(([name, entry]) => ["moderate", "high", "critical"].includes(entry.severity) && !accepted.has(name)).map(([name]) => name);
}
