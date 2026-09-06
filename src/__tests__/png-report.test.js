import { afterEach, describe, expect, it, vi } from "vitest";
import { PNG_THEME, pngAccent, pngFitText, pngLoadImage, pngWrapText } from "../utils/png-report.js";

function textContext() {
  const stack = [];
  return {
    font: "20px Arial", fillStyle: "original", textAlign: "left", textBaseline: "alphabetic",
    measureText(text) { return { width: Array.from(text).length * 10 }; },
    fillText: vi.fn(),
    save() { stack.push({ font: this.font, fillStyle: this.fillStyle, textAlign: this.textAlign, textBaseline: this.textBaseline }); },
    restore() { Object.assign(this, stack.pop()); },
  };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("PNG text layout", () => {
  it("bounds long titles without growing the ellipsis or leaking canvas styles", () => {
    const ctx = textContext();
    const result = pngFitText(ctx, "Un titre très long ".repeat(100), 20, 40, 70, { font: "700 24px Arial", min: 18, color: "red", align: "right" });
    expect(result.endsWith("…")).toBe(true);
    expect(ctx.measureText(result).width).toBeLessThanOrEqual(70);
    expect(ctx.font).toBe("20px Arial");
    expect(ctx.fillStyle).toBe("original");
    expect(ctx.textAlign).toBe("left");
    expect(pngFitText(ctx, "👑".repeat(300), 0, 0, 5)).toBe("");
  });

  it("keeps every word and paragraph when the height is allowed to grow", () => {
    const ctx = textContext();
    const content = "Préparer la vision\nPuis jouer ensemble";
    const lines = pngWrapText(ctx, content, 110);
    expect(lines.every((line) => ctx.measureText(line).width <= 110)).toBe(true);
    expect(lines.join(" ")).toBe("Préparer la vision Puis jouer ensemble");
    expect(pngWrapText(ctx, "a\n\nb", 100)).toEqual(["a", "", "b"]);
  });

  it("wraps unbroken names and marks summaries with an ellipsis", () => {
    const ctx = textContext();
    const name = "VeryLongPlayerName👑";
    const lines = pngWrapText(ctx, name, 50);
    expect(lines.join("")).toBe(name);
    expect(lines.every((line) => ctx.measureText(line).width <= 50)).toBe(true);
    const summary = pngWrapText(ctx, "une consigne de coaching assez longue", 100, { maxLines: 2 });
    expect(summary).toHaveLength(2);
    expect(summary.at(-1).endsWith("…")).toBe(true);
  });

  it("uses the same semantic color aliases across reports", () => {
    expect(pngAccent("pink")).toBe(PNG_THEME.red);
    expect(pngAccent("orange")).toBe(PNG_THEME.yellow);
    expect(pngAccent("green")).toBe(PNG_THEME.green);
  });
});

describe("PNG image loading", () => {
  it("allows exports to finish when an image server never responds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", class { set src(value) { this.url = value; } });
    const pending = pngLoadImage("/never-responds.png");
    expect(pngLoadImage("/never-responds.png")).toBe(pending);
    await vi.advanceTimersByTimeAsync(8000);
    await expect(pending).resolves.toBeNull();
  });
});
