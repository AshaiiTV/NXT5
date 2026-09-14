import { describe, expect, it } from "vitest";
import { audienceCsv, audienceCsvCell, audienceDate, audienceDelta, audienceDuration, audienceShare, selectAudiencePages } from "../pages/admin/audience-metrics.js";

describe("audience comparisons", () => {
  it("uses relative growth for counts, percentage points for rates, and no invented zero-baseline growth", () => {
    expect(audienceDelta(150, 100)).toEqual({ label: "+50 %", tone: "positive" });
    expect(audienceDelta(15, 10, { percentage: true })).toEqual({ label: "+5 pt", tone: "positive" });
    expect(audienceDelta(5, 0)).toEqual({ label: "Sans base de comparaison", tone: "neutral" });
    expect(audienceDelta(0, 0)).toEqual({ label: "Stable", tone: "neutral" });
    expect(audienceDelta(5, undefined)).toEqual({ label: "Comparaison indisponible", tone: "neutral" });
    expect(audienceDelta(0, 50)).toEqual({ label: "−100 %", tone: "negative" });
  });

  it("recognizes a lower bounce rate as favorable", () => {
    expect(audienceDelta(20, 25, { percentage: true, lowerIsBetter: true })).toEqual({ label: "−5 pt", tone: "positive" });
    expect(audienceDelta(35, 25, { percentage: true, lowerIsBetter: true })).toEqual({ label: "+10 pt", tone: "negative" });
  });

  it("formats UTC days and measured durations without timezone drift or nonfinite output", () => {
    expect(audienceDate("2026-09-14T23:50:00-05:00")).toBe("15 septembre 2026");
    expect(audienceDate("invalid")).toBe("—");
    expect(audienceDuration(59.8)).toBe("1 min 00 s");
    expect(audienceDuration(120.3)).toBe("2 min 00 s");
    expect(audienceDuration(-5)).toBe("0 s");
    expect(audienceDuration(Infinity)).toBe("0 s");
    expect(audienceShare(0, 0)).toBe(0);
  });
});

describe("audience page exploration", () => {
  it("combines accent-insensitive path search and numeric sorting without altering source data", () => {
    const rows = [{ path: "/équipe/z", views: 10, avgDurationSeconds: 120 }, { path: "/tarifs", views: 40, avgDurationSeconds: 70 }, { path: "/équipe/a", views: 20, avgDurationSeconds: 60 }];
    expect(selectAudiencePages(rows, { search: "EQUIPE", sort: "views" }).map((row) => row.path)).toEqual(["/équipe/a", "/équipe/z"]);
    expect(selectAudiencePages(rows, { sort: "avgDurationSeconds" }).map((row) => row.path)).toEqual(["/équipe/z", "/tarifs", "/équipe/a"]);
    expect(rows.map((row) => row.views)).toEqual([10, 40, 20]);
  });
});

describe("audience CSV export", () => {
  it.each(["=HYPERLINK(\"https://bad.test\")", "+cmd", "-formula", "@SUM(A1)", " \t=SUM(1,1)", "\nformula", "\rtext"]) ("neutralizes spreadsheet formula cell %j", (value) => {
    expect(audienceCsvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`);
  });

  it("quotes separators, literal quotes and newlines without losing the original label", () => {
    expect(audienceCsvCell('campagne;"été"\nsuite')).toBe('"campagne;""été""\nsuite"');
    expect(audienceCsvCell("/tarifs")).toBe('"/tarifs"');
  });

  it("exports actual report dimensions, filters and comparison boundaries in a single consistent CSV schema", () => {
    const csv = audienceCsv({ period: { from: "2026-09-08", to: "2026-09-14" }, comparison: { from: "2026-09-01", to: "2026-09-07" }, totals: { sessions: 12 }, previous: { sessions: 8 }, pages: [{ path: "/tarifs", views: 30 }], sources: [{ source: "=formula", sessions: 2 }], goals: [{ name: "signup", events: 2, sessions: 2, conversionRate: 16.7 }] }, { device: "mobile", source: "social" });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"2026-09-01";"2026-09-07";"mobile";"social";"Comparaison";"Période précédente";"Sessions";"8"');
    expect(csv).toContain('"Pages";"/tarifs";"Pages vues";"30"');
    expect(csv).toContain('"Acquisition";"\'=formula";"Sessions";"2"');
    expect(csv).toContain('"Objectifs";"Compte créé";"Événements";"2"');
    for (const line of csv.trim().split("\r\n")) expect(line.split(";")).toHaveLength(8);
  });
});
