import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { drawProfileShowcase, PROFILE_SHOWCASE_SIZE } from "../utils/profile-showcase-canvas.js";

function report(overrides = {}) {
  return {
    playerName: "NOVA", role: "ADC", teamName: "Astral", contextLabel: "LAN d’automne", dateLabel: "2 – 4 octobre 2026", games: 12,
    results: { wins: 9, losses: 2, unknown: 1, known: 11, rate: 9 / 11 * 100 },
    metrics: { kda: { value: 5.8, count: 12 }, csPerMin: { value: 8.7, count: 11 }, kp: { value: 72, count: 10 }, damagePerMin: { value: 842, count: 12 }, vision: { value: 30, count: 12 } },
    totals: { kills: 90, deaths: 33, assists: 102, count: 12 }, playTime: { seconds: 22560, count: 12 },
    signature: { champion: "Jhin", games: 6, wins: 5, losses: 1, unknown: 0, known: 6, rate: 5 / 6 * 100 },
    champions: [{ champion: "Jhin", games: 6, wins: 5, losses: 1 }, { champion: "Kai’Sa", games: 4, wins: 3, losses: 1 }, { champion: "Xayah", games: 2, wins: 1, losses: 0, unknown: 1 }],
    recentResults: "VVDVVVDVV?VV".split("").map((result) => ({ result: result === "V" ? "win" : result === "D" ? "loss" : "unknown" })),
    highlight: { champion: "Jhin", result: "win", kills: 14, deaths: 1, assists: 9, dateLabel: "4 octobre 2026", durationSeconds: 1902, csPerMin: 9.4, damagePerMin: 1048, selectionReason: "Meilleur KDA parmi les victoires aux statistiques complètes." },
    progression: { label: "CS par minute", unit: "CS/min", early: { value: 9.3, count: 6 }, recent: { value: 8.1, count: 6 }, delta: -1.2, count: 12, excludedCount: 0 },
    ...overrides,
  };
}

function recordingCanvas() {
  const canvas = createCanvas(1080, 1620);
  const ctx = canvas.getContext("2d");
  const texts = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y) => {
    const width = ctx.measureText(text).width;
    const left = ctx.textAlign === "right" ? x - width : ctx.textAlign === "center" ? x - width / 2 : x;
    texts.push({ text, x: left, right: left + width, y });
    fillText(text, x, y);
  };
  return { canvas, texts };
}

describe("profile collection rendering", () => {
  it("renders both card faces and every chapter in the same export dimensions", () => {
    for (const options of [{ view: "front" }, { view: "back" }, ...Array.from({ length: 5 }, (_, chapter) => ({ view: "story", chapter }))]) {
      const { canvas, texts } = recordingCanvas();
      expect(drawProfileShowcase(canvas, report(), options)).toBe(canvas);
      expect({ width: canvas.width, height: canvas.height }).toEqual(PROFILE_SHOWCASE_SIZE);
      expect(texts.length).toBeGreaterThan(10);
      expect(texts.every(({ text }) => !/NaN|undefined|null/.test(text))).toBe(true);
      expect(texts.every(({ x, right, y }) => x >= 0 && right <= 1080 && y > 0 && y < 1620)).toBe(true);
    }
  });

  it("shows absent measures separately from real zero and discloses partial coverage", () => {
    const { canvas, texts } = recordingCanvas();
    drawProfileShowcase(canvas, report({ metrics: { kda: { value: 0, count: 12 }, csPerMin: { value: null, count: 0 }, kp: { value: 0, count: 10 } } }), { view: "front" });
    expect(texts.map((entry) => entry.text)).toEqual(expect.arrayContaining(["0,0", "—", "0 %", "0 / 12 parties", "10 / 12 parties", "11 résultats connus / 12"]));
  });

  it("keeps declining evolution factual and renders unavailable stories", () => {
    const { canvas, texts } = recordingCanvas();
    drawProfileShowcase(canvas, report(), { view: "story", chapter: 3 });
    expect(texts.map((entry) => entry.text)).toContain("-1,2");
    expect(texts.map((entry) => entry.text).join(" ")).not.toMatch(/plus fort|progression positive/i);
    for (const chapter of [1, 2, 3]) {
      expect(() => drawProfileShowcase(canvas, report({ signature: null, highlight: null, progression: null }), { view: "story", chapter })).not.toThrow();
    }
  });

  it("bounds very long names and metadata in every view", () => {
    const veryLong = "UneTrèsLongueIdentitéSansEspace".repeat(8);
    const data = report({ playerName: veryLong, teamName: veryLong, contextLabel: veryLong, dateLabel: veryLong, signature: { champion: veryLong, games: 12, known: 10 }, champions: [{ champion: veryLong, games: 12, wins: 10, losses: 0, unknown: 2 }] });
    for (const options of [{ view: "front" }, { view: "back" }, ...Array.from({ length: 5 }, (_, chapter) => ({ view: "story", chapter }))]) {
      const { canvas, texts } = recordingCanvas();
      drawProfileShowcase(canvas, data, options);
      expect(texts.every(({ x, right }) => x >= 0 && right <= 1080)).toBe(true);
    }
  });
});
