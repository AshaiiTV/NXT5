export function auditFailures(report) {
  if (report.error || !report.vulnerabilities) throw new Error("Invalid npm audit response");
  return Object.entries(report.vulnerabilities)
    .filter(([, entry]) => ["moderate", "high", "critical"].includes(entry.severity))
    .map(([name]) => name);
}
