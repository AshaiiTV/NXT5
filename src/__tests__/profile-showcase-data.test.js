import { describe, expect, it } from "vitest";
import { buildProfileShowcase } from "../utils/profile-showcase.js";

const row = (index, values = {}, match = {}) => ({
  champion: "Ahri", kills: 3, deaths: 2, assists: 5, cs_per_min: 7,
  ...values,
  match: { id: `match-${index}`, game_date: `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00Z`, result: "Victoire", duration_seconds: 1800, ...match },
});

describe("profile showcase data", () => {
  it("keeps an empty selection absent without populating fictional stats, a champion or a story", () => {
    const report = buildProfileShowcase();
    expect(report.games).toBe(0);
    expect(report.results).toEqual({ wins: 0, losses: 0, unknown: 0, known: 0, rate: null });
    expect(Object.values(report.metrics).every((metric) => metric.value === null && metric.count === 0)).toBe(true);
    expect(report.totals).toEqual({ kills: null, deaths: null, assists: null, count: 0 });
    expect(report.playTime).toEqual({ seconds: null, count: 0 });
    expect(report.signature).toBeNull();
    expect(report.highlight).toBeNull();
    expect(report.progression).toBeNull();
  });

  it("counts only known results in win rate, including normalized French and English values", () => {
    const rows = [" Victoire ", "DEFAITE", "win", null, "annulée"].map((result, index) => row(index, {}, { result }));
    const report = buildProfileShowcase({ rows });
    expect(report.results).toMatchObject({ wins: 2, losses: 1, unknown: 2, known: 3 });
    expect(report.results.rate).toBeCloseTo(200 / 3);
    expect(report.signature).toMatchObject({ games: 5, wins: 2, unknown: 2, known: 3 });
    expect(report.signature.rate).toBeCloseTo(200 / 3);
    expect(buildProfileShowcase({ rows: [row(0, {}, { result: null })] }).results.rate).toBeNull();
  });

  it("preserves true zeros and distinguishes incomplete KDA from a deathless game", () => {
    const report = buildProfileShowcase({ rows: [
      row(0, { kills: 0, deaths: 0, assists: 0, cs_per_min: 0, kp: 0, damage: 0, vision: 0 }),
      row(1, { kills: 8, deaths: 0, assists: 2, cs_per_min: null }),
      row(2, { kills: 90, deaths: null, assists: 80, cs_per_min: null }),
    ] });
    expect(report.metrics.kda).toEqual({ value: 10, count: 2 });
    expect(report.totals).toEqual({ kills: 8, deaths: 0, assists: 2, count: 2 });
    for (const key of ["csPerMin", "kp", "damagePerMin", "vision"]) expect(report.metrics[key]).toEqual({ value: 0, count: 1 });
  });

  it.each([null, undefined, "", "  ", false, NaN, -1, "invalid"])("does not turn absent or invalid metrics (%s) into zero", (absent) => {
    const report = buildProfileShowcase({ rows: [row(0, {
      kills: absent, deaths: absent, assists: absent, cs_per_min: absent, kp: absent, damage: absent, vision: absent,
    })] });
    expect(Object.values(report.metrics).every((metric) => metric.value === null && metric.count === 0)).toBe(true);
    expect(report.highlight).toBeNull();
  });

  it("reads supported nested raw values and normalizes percentage formats without accepting out-of-range participation", () => {
    const rawRow = {
      champion: "Kai’Sa", raw: JSON.stringify({ participant: { stats: { kills: "4", deaths: "2", assists: "8", totalDamageDealtToChampions: 18000, visionScore: 24, totalMinionsKilled: 160, neutralMinionsKilled: 20 } } }),
      match: { duration: "30:00", result: "Victoire" },
    };
    const values = [0, "0%", 0.6, "60%", "1%", "72,5%", 101, -0.1, false];
    const report = buildProfileShowcase({ rows: [rawRow, ...values.map((kp) => ({ kp }))] });
    expect(report.metrics.kda).toEqual({ value: 6, count: 1 });
    expect(report.metrics.csPerMin).toEqual({ value: 6, count: 1 });
    expect(report.metrics.damagePerMin).toEqual({ value: 600, count: 1 });
    expect(report.metrics.vision).toEqual({ value: 24, count: 1 });
    expect(report.metrics.kp).toEqual({ value: (0 + 0 + 60 + 60 + 1 + 72.5) / 6, count: 6 });
  });

  it("does not derive CS or DPM from incomplete minion counts or missing duration", () => {
    const report = buildProfileShowcase({ rows: [
      row(0, { cs_per_min: null, raw: { totalMinionsKilled: 100 } }),
      row(1, { cs_per_min: null, raw: { totalMinionsKilled: 100, neutralMinionsKilled: 10 }, damage: 20000 }, { duration_seconds: null }),
    ] });
    expect(report.metrics.csPerMin).toEqual({ value: null, count: 0 });
    expect(report.metrics.damagePerMin).toEqual({ value: null, count: 0 });
    expect(report.playTime).toEqual({ seconds: 1800, count: 1 });
  });

  it("normalizes champion aliases and uses selection context without adding invented games", () => {
    const report = buildProfileShowcase({
      player: { name: "Nova", role: "BOTTOM" }, teamName: "Astral", category: "LAN automne",
      rows: [row(0, { champion: "Kai'Sa" }), row(1, { champion: "Kaisa" }), row(2, { champion: "Kai’Sa" }), row(3, { champion: "Xayah" }), row(4, { champion: null })],
    });
    expect(report).toMatchObject({ playerName: "Nova", role: "ADC", teamName: "Astral", contextLabel: "LAN automne", games: 5 });
    expect(report.signature).toMatchObject({ champion: "Kaisa", games: 3 });
    expect(report.champions).toHaveLength(2);
  });

  it("selects the highest complete KDA among wins, not a high-scoring loss or an incomplete game", () => {
    const report = buildProfileShowcase({ rows: [
      row(0, { kills: 30, deaths: 1, assists: 15 }, { result: "Défaite" }),
      row(1, { kills: 5, deaths: 2, assists: 5 }),
      row(2, { kills: 10, deaths: 2, assists: 6 }),
      row(3, { kills: 40, deaths: null, assists: 20 }),
    ] });
    expect(report.highlight).toMatchObject({ matchId: "match-2", kda: 8, kills: 10, deaths: 2, assists: 6, selectionReason: "Meilleur KDA parmi les victoires renseignées" });
    const lossOnly = buildProfileShowcase({ rows: [row(0, { kills: 8, deaths: 2, assists: 4 }, { result: "Défaite" })] });
    expect(lossOnly.highlight).toMatchObject({ result: "loss", selectionReason: "Meilleur KDA parmi les parties renseignées" });
  });

  it("uses game dates and excludes import-only dates from period and progression", () => {
    const rows = [
      row(0, {}, { game_date: null, created_at: "2026-10-03" }),
      row(1, {}, { game_date: "invalid", raw: { info: { gameCreation: 1_759_320_000_000 } } }),
      row(2, {}, { game_date: "2026-09-21T12:00:00Z" }),
    ];
    const report = buildProfileShowcase({ rows });
    expect(report.datedGames).toBe(2);
    expect(report.dateLabel).toBe("01/10/2025 – 21/09/2026");
    expect(report.progression).toBeNull();
    const unknown = buildProfileShowcase({ rows: [rows[0]] });
    expect(unknown.dateLabel).toBe("Dates non renseignées");
    expect(unknown.recentResults[0].dateLabel).toBe("Date inconnue");
  });

  it("compares chronological halves of at least three measured games, retains an odd middle observation, and does not claim improvement after a decline", () => {
    const rows = Array.from({ length: 7 }, (_, index) => row(index, { cs_per_min: [9, 9, 9, 5, 6, 6, 7][index] })).reverse();
    const report = buildProfileShowcase({ rows });
    expect(report.progression).toMatchObject({
      key: "csPerMin", label: "Sbires par minute", unit: "CS / min", early: { value: 9, count: 3 }, recent: { value: 6, count: 4 },
      delta: -3, count: 7, excludedCount: 0, title: "Évolution sur la sélection",
    });
    expect(report.progression.early).toMatchObject({ startDateLabel: "01/09/2026", endDateLabel: "03/09/2026" });
    expect(report.progression.recent).toMatchObject({ startDateLabel: "04/09/2026", endDateLabel: "07/09/2026" });
    expect(report.progression.series.map(({ value, matchId }) => [value, matchId])).toEqual([9, 9, 9, 5, 6, 6, 7].map((value, index) => [value, `match-${index}`]));
    expect(buildProfileShowcase({ rows: rows.slice(0, 5) }).progression).toBeNull();
    expect(rows[0].match.id).toBe("match-6");
  });

  it("excludes undated and unknown observations before forming chronological halves", () => {
    const rows = Array.from({ length: 8 }, (_, index) => row(index, { cs_per_min: index < 3 ? 7 : 9 }));
    rows[6].match.game_date = null;
    rows[7].cs_per_min = null;
    const report = buildProfileShowcase({ rows });
    expect(report.progression).toMatchObject({ early: { value: 7, count: 3 }, recent: { value: 9, count: 3 }, count: 6, excludedCount: 2, delta: 2 });
    expect(report.progression.series).toHaveLength(6);
    expect(report.progression.series.every(({ timestamp }) => Number.isFinite(timestamp))).toBe(true);
    expect(report.progression.series.map(({ matchId }) => matchId)).not.toContain("match-6");
    expect(report.progression.series.map(({ matchId }) => matchId)).not.toContain("match-7");
    rows[5].match.game_date = null;
    expect(buildProfileShowcase({ rows }).progression).toBeNull();
  });

  it("does not order a progression when all game timestamps are tied", () => {
    const rows = Array.from({ length: 6 }, (_, index) => row(index, { cs_per_min: index }, { game_date: "2026-09-20T12:00:00Z" }));
    expect(buildProfileShowcase({ rows }).progression).toBeNull();
  });

  it("uses vision per minute for support and requires its duration", () => {
    const rows = Array.from({ length: 6 }, (_, index) => row(index, { vision: index < 3 ? 30 : 60, cs_per_min: 2 }));
    const report = buildProfileShowcase({ player: { role: "UTILITY" }, rows });
    expect(report.role).toBe("SUP");
    expect(report.progression).toMatchObject({ key: "visionPerMin", unit: "vision / min", early: { value: 1, count: 3 }, recent: { value: 2, count: 3 }, delta: 1 });
    rows[0].match.duration_seconds = null;
    expect(buildProfileShowcase({ player: { role: "SUP" }, rows }).progression).toBeNull();
  });

  it("keeps the twelve most recent results in chronological order and exposes their represented count", () => {
    const rows = Array.from({ length: 15 }, (_, index) => row(index, {}, { result: index === 7 ? null : "Victoire" })).reverse();
    const report = buildProfileShowcase({ rows });
    expect(report.recentResultsCount).toBe(12);
    expect(report.recentResults.map((entry) => entry.matchId)).toEqual(Array.from({ length: 12 }, (_, index) => `match-${index + 3}`));
    expect(report.recentResults[4].result).toBe("unknown");
  });

  it("retains the actual roster without asserting everyone played together, and does not mutate inputs", () => {
    const player = Object.freeze({ id: "p1", name: "Nova", role: "ADC" });
    const teammate = Object.freeze({ id: "p2", name: "Lune", role: "SUPPORT" });
    const rows = Object.freeze([Object.freeze(row(0))]);
    const report = buildProfileShowcase({ player, rows, teammates: Object.freeze([player, teammate, teammate]) });
    expect(report.teammates).toEqual([{ id: "p1", name: "Nova", role: "ADC" }, { id: "p2", name: "Lune", role: "SUP" }]);
    expect(report.playerId).toBe("p1");
    expect(report).not.toHaveProperty("gamesTogether");
    expect(rows[0].champion).toBe("Ahri");
  });
});
