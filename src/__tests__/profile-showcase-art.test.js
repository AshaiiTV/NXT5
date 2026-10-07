import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { pngLoadImage } from "../utils/png-report.js";
import { drawProfileChampionArt, loadProfileChampionArt, profileChampionArtLayout } from "../utils/profile-showcase-art.js";

vi.mock("../utils/png-report.js", () => ({ pngLoadImage: vi.fn() }));

describe("profile champion portrait loading", () => {
  beforeEach(() => { vi.mocked(pngLoadImage).mockReset(); });

  it("loads only the official portrait through the same-origin proxy using canonical names", async () => {
    const portrait = { width: 308, height: 560 };
    vi.mocked(pngLoadImage).mockResolvedValueOnce(portrait);
    expect(await loadProfileChampionArt("Kai’Sa")).toEqual({ art: portrait, backdrop: null, artLayout: "portrait" });
    const urls = vi.mocked(pngLoadImage).mock.calls.map(([url]) => new URL(url, "https://nxt5.org"));
    expect(urls.every((url) => url.origin === "https://nxt5.org" && url.pathname === "/.netlify/functions/asset-proxy")).toBe(true);
    expect(urls.map((url) => url.searchParams.get("url"))).toEqual([
      "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Kaisa_0.jpg",
    ]);
  });

  it("does not let a decorative splash delay a working portrait", async () => {
    const portrait = { naturalWidth: 308, naturalHeight: 560 };
    vi.mocked(pngLoadImage).mockResolvedValueOnce(portrait).mockImplementation(() => new Promise(() => {}));
    expect(await loadProfileChampionArt("Jhin")).toEqual({ art: portrait, backdrop: null, artLayout: "portrait" });
    expect(pngLoadImage).toHaveBeenCalledTimes(1);
  });

  it.each([null, { width: 0, height: 560 }, { width: Infinity, height: 560 }])("uses the complete splash when the portrait is unavailable (%j)", async (portrait) => {
    const splash = { width: 1215, height: 717 };
    vi.mocked(pngLoadImage).mockResolvedValueOnce(portrait).mockResolvedValueOnce(splash);
    expect(await loadProfileChampionArt("Darius")).toEqual({ art: splash, backdrop: null, artLayout: "landscape" });
    expect(new URL(vi.mocked(pngLoadImage).mock.calls[1][0], "https://nxt5.org").searchParams.get("url")).toBe("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Darius_0.jpg");
  });

  it("returns an explicit empty state when both requests fail", async () => {
    vi.mocked(pngLoadImage).mockRejectedValue(new Error("Network unavailable"));
    expect(await loadProfileChampionArt("Braum")).toEqual({ art: null, backdrop: null, artLayout: "empty" });
  });

  it("does not request an image without a champion", async () => {
    expect(await loadProfileChampionArt("")).toEqual({ art: null, backdrop: null, artLayout: "empty" });
    expect(pngLoadImage).not.toHaveBeenCalled();
  });
});

describe("profile champion framing", () => {
  it.each([
    [{ width: 308, height: 560 }, { x: 280, y: 350, width: 520, height: 720 }],
    [{ width: 1215, height: 717 }, { x: 310, y: 225, width: 460, height: 735 }],
    [{ width: 100, height: 1000 }, { x: 20, y: 30, width: 840, height: 240 }],
    [{ width: 1000, height: 100 }, { x: 20, y: 30, width: 240, height: 840 }],
    [{ naturalWidth: 308, naturalHeight: 560, width: 154, height: 280 }, { x: 40, y: 60, width: 520, height: 720, radius: 32 }],
  ])("keeps the complete source centered and inside the reserved rectangle (%j)", (image, box) => {
    const layout = profileChampionArtLayout(image, box);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    expect(layout).toMatchObject({ sourceX: 0, sourceY: 0, sourceWidth, sourceHeight });
    expect(layout.x + layout.width / 2).toBeCloseTo(box.x + box.width / 2, 8);
    expect(layout.y + layout.height / 2).toBeCloseTo(box.y + box.height / 2, 8);
    expect(layout.width / layout.height).toBeCloseTo(sourceWidth / sourceHeight, 8);
    expect(layout.x).toBeGreaterThanOrEqual(box.x);
    expect(layout.y).toBeGreaterThanOrEqual(box.y);
    expect(layout.x + layout.width).toBeLessThanOrEqual(box.x + box.width + 1e-8);
    expect(layout.y + layout.height).toBeLessThanOrEqual(box.y + box.height + 1e-8);
    // A head at any position in the top third remains visible, including its top edge.
    for (const sourceX of [0, sourceWidth * .3, sourceWidth * .7, sourceWidth]) {
      for (const sourceY of [0, sourceHeight * .1, sourceHeight / 3]) {
        const x = layout.x + sourceX / sourceWidth * layout.width;
        const y = layout.y + sourceY / sourceHeight * layout.height;
        expect(x).toBeGreaterThanOrEqual(box.x);
        expect(x).toBeLessThanOrEqual(box.x + box.width + 1e-8);
        expect(y).toBeGreaterThanOrEqual(box.y);
        expect(y).toBeLessThanOrEqual(box.y + box.height + 1e-8);
      }
    }
  });

  it("renders the head, both eyes and all source edges with no face overlay", () => {
    const portrait = createCanvas(308, 560);
    const source = portrait.getContext("2d");
    source.fillStyle = "#ffffff"; source.fillRect(0, 0, 308, 560);
    source.fillStyle = "#ff0000"; source.fillRect(110, 0, 88, 100);
    source.fillStyle = "#00ff00"; source.fillRect(124, 32, 12, 12); source.fillRect(172, 32, 12, 12);
    const canvas = createCanvas(600, 720);
    const ctx = canvas.getContext("2d");
    const box = { x: 40, y: 30, width: 520, height: 660, radius: 32 };
    expect(drawProfileChampionArt(ctx, { art: portrait }, box)).toBe(true);
    const layout = profileChampionArtLayout(portrait, box);
    const pixel = (x, y) => [...ctx.getImageData(Math.floor(layout.x + x / 308 * layout.width), Math.floor(layout.y + y / 560 * layout.height), 1, 1).data];
    expect(pixel(154, 5)).toEqual([255, 0, 0, 255]);
    expect(pixel(130, 38)).toEqual([0, 255, 0, 255]);
    expect(pixel(178, 38)).toEqual([0, 255, 0, 255]);
    for (const [x, y] of [[3, 3], [305, 3], [3, 557], [305, 557]]) expect(pixel(x, y)).toEqual([255, 255, 255, 255]);
  });

  it("subdues only the backdrop and restores the caller's opacity", () => {
    const portrait = createCanvas(308, 560);
    const splash = createCanvas(1215, 717);
    const ctx = createCanvas(600, 800).getContext("2d");
    const calls = [];
    const drawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = (...args) => { calls.push({ args, alpha: ctx.globalAlpha }); drawImage(...args); };
    ctx.globalAlpha = .8;
    drawProfileChampionArt(ctx, { art: portrait, backdrop: splash }, { x: 0, y: 0, width: 600, height: 800, opacity: .5 });
    expect(calls).toHaveLength(2);
    expect(calls[0].args[0]).toBe(splash);
    expect(calls[0].alpha).toBeCloseTo(.8 * .5 * .12);
    expect(calls[1].args.slice(0, 5)).toEqual([portrait, 0, 0, 308, 560]);
    expect(calls[1].alpha).toBeCloseTo(.8 * .5);
    expect(ctx.globalAlpha).toBeCloseTo(.8);
  });

  it("does not draw invalid assets or invalid destination boxes", () => {
    const ctx = createCanvas(10, 10).getContext("2d");
    for (const assets of [{}, { art: { width: 0, height: 560 } }, { art: { width: NaN, height: 560 } }]) {
      expect(drawProfileChampionArt(ctx, assets, { x: 0, y: 0, width: 10, height: 10 })).toBe(false);
    }
    const portrait = { width: 308, height: 560 };
    for (const box of [{ width: 0, height: 10 }, { width: -10, height: 10 }, { width: 10, height: Infinity }]) {
      expect(profileChampionArtLayout(portrait, box)).toBeNull();
    }
  });
});
