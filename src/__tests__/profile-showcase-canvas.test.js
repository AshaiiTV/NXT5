import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { drawProfileShowcase, PROFILE_ART_REGIONS, PROFILE_SHOWCASE_SIZE } from "../utils/profile-showcase-canvas.js";
import { profileChampionArtLayout } from "../utils/profile-showcase-art.js";

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
    const measured = ctx.measureText(text);
    const width = measured.width;
    const left = ctx.textAlign === "right" ? x - width : ctx.textAlign === "center" ? x - width / 2 : x;
    texts.push({ text, x: left, right: left + width, y, top: y - measured.actualBoundingBoxAscent, bottom: y + measured.actualBoundingBoxDescent });
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

  it("keeps foreground text outside the whole portrait, including accented player names", () => {
    const portrait = createCanvas(308, 560);
    for (const [options, region] of [
      [{ view: "front" }, PROFILE_ART_REGIONS.front],
      [{ view: "story", chapter: 1 }, PROFILE_ART_REGIONS.signature],
      [{ view: "story", chapter: 2 }, PROFILE_ART_REGIONS.highlight],
    ]) {
      const { canvas, texts } = recordingCanvas();
      drawProfileShowcase(canvas, report({ playerName: "ÉCHO À L’ÉQUIPE" }), { ...options, assets: { art: portrait } });
      expect(texts.filter((text) => text.right > region.x && text.x < region.x + region.width && text.bottom > region.y && text.top < region.y + region.height)).toEqual([]);
    }
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
  it("keeps the complete centred portrait, its head and both eyes free from foreground elements", () => {
    const art = createCanvas(308, 560);
    const artCtx = art.getContext("2d");
    artCtx.fillStyle = "#2c4970";
    artCtx.fillRect(0, 0, 308, 560);
    const markers = [
      { x: 145, y: 20, color: "#ffff00", rgb: [255, 255, 0] },
      { x: 112, y: 104, color: "#00ff00", rgb: [0, 255, 0] },
      { x: 178, y: 104, color: "#ff0000", rgb: [255, 0, 0] },
      { x: 145, y: 529, color: "#ff00ff", rgb: [255, 0, 255] },
    ];
    markers.forEach(({ x, y, color }) => { artCtx.fillStyle = color; artCtx.fillRect(x, y, 18, 18); });
    for (const [regionKey, options] of [["front", { view: "front" }], ["signature", { view: "story", chapter: 1 }], ["highlight", { view: "story", chapter: 2 }]]) {
      const { canvas, texts } = recordingCanvas();
      drawProfileShowcase(canvas, report(), { ...options, assets: { art, artLayout: "portrait" } });
      const region = PROFILE_ART_REGIONS[regionKey];
      const layout = profileChampionArtLayout(art, region);
      expect(layout.x + layout.width / 2).toBe(540);
      for (const { x, y, rgb } of markers) {
        const px = Math.floor(layout.x + (x + 9) / 308 * layout.width);
        const py = Math.floor(layout.y + (y + 9) / 560 * layout.height);
        expect([...canvas.getContext("2d").getImageData(px, py, 1, 1).data]).toEqual([...rgb, 255]);
      }
      const overlappingText = texts.filter((entry) => entry.x < region.x + region.width && entry.right > region.x && entry.top < region.y + region.height && entry.y > region.y);
      expect(overlappingText, `${regionKey}: no label may cover the portrait`).toEqual([]);
    }
  });

  it("plots measured values against their real dates and preserves a zero measure", () => {
    const { canvas, texts } = recordingCanvas();
    const ctx = canvas.getContext("2d");
    const points = [];
    const arc = ctx.arc.bind(ctx);
    ctx.arc = (x, y, ...rest) => { points.push({ x, y }); arc(x, y, ...rest); };
    const series = [1000, 2000, 3000, 4000, 5000, 100000].map((timestamp, index) => ({ timestamp, value: index === 0 ? 0 : 1 + index * .02, dateLabel: `date ${index + 1}` }));
    drawProfileShowcase(canvas, report({ progression: {
      key: "visionPerMin", label: "Vision par minute", unit: "vision / min", delta: .06,
      early: { value: .7, count: 3, startDateLabel: "date 1", endDateLabel: "date 3" },
      recent: { value: 1.08, count: 3, startDateLabel: "date 4", endDateLabel: "date 6" },
      count: 6, excludedCount: 6, series,
    } }), { view: "story", chapter: 3 });
    expect(points).toHaveLength(6);
    expect((points[1].x - points[0].x) / (points[5].x - points[0].x)).toBeCloseTo(1000 / 99000);
    expect(points[0].y).toBeGreaterThan(points[1].y);
    expect(texts.map(({ text }) => text)).toEqual(expect.arrayContaining(["+0,06", "0,00", "date 1 – date 3", "date 4 – date 6"]));
    expect(texts.map(({ text }) => text).join(" ")).toContain("6 exclues");
  });

  it("labels the current roster honestly, discloses truncation and identifies the player by ID", () => {
    const teammates = Array.from({ length: 8 }, (_, index) => ({ id: String(index), name: index === 7 ? "NOVA" : `Profil ${index}`, role: "ADC" }));
    teammates[0].name = "NOVA";
    const { canvas, texts } = recordingCanvas();
    drawProfileShowcase(canvas, report({ playerId: "7", teammates }), { view: "story", chapter: 4 });
    const labels = texts.map(({ text }) => text);
    expect(labels).toEqual(expect.arrayContaining(["EFFECTIF ACTUEL", "6 / 8 profils affichés", "CE PROFIL"]));
    expect(labels.filter((label) => label === "CE PROFIL")).toHaveLength(1);
    expect(labels.join(" ")).toContain("ne permet pas de déduire qui a joué ces parties");
    expect(texts.find(({ text }) => text === "CE PROFIL").y).toBeLessThan(texts.find(({ text }) => text === "Profil 1").y);
  });
});
