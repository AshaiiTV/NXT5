import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { PNG_THEME, pngDownloadPages } from "../utils/png-report.js";

const RED = [211, 27, 49, 255];
const GREEN = [31, 179, 83, 255];
const BLUE = [43, 71, 223, 255];
const background = PNG_THEME.bg.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16)).concat(255);

function pixels(width, height, colorAt, left = 0, top = 0) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(colorAt(x + left, y + top), (y * width + x) * 4);
  }
  return data;
}

function sourceCanvas(width, height, colorAt, { failBlob = false, readError } = {}) {
  const canvas = { width, height, colorAt };
  canvas.getContext = () => ({
    getImageData(x, y, w, h) {
      if (readError) throw readError;
      return { data: pixels(w, h, colorAt, x, y) };
    },
  });
  canvas.readError = readError;
  canvas.toBlob = vi.fn(async (callback, type) => {
    if (failBlob) return callback(null);
    const bytes = await sharp(Buffer.from(pixels(width, height, colorAt)), { raw: { width, height, channels: 4 } }).png().toBuffer();
    callback(new Blob([bytes], { type }));
  });
  return canvas;
}

// Simulate only the canvas operations needed to assemble pixels. Real PNG
// encoding, compression, and independent decoding all run without mocks.
function stripCanvas(assignments) {
  let width = 0;
  let height = 0;
  let operations = [];
  const context = {
    fillStyle: PNG_THEME.bg,
    clearRect() { operations = []; },
    fillRect(x, y, w, h) {
      const color = this.fillStyle.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16)).concat(255);
      operations.push({ x, y, w, h, color });
    },
    drawImage(source, ...args) {
      if (source.readError) throw source.readError;
      let sx = 0, sy = 0, sw = source.width, sh = source.height, dx, dy, dw, dh;
      if (args.length === 2) [dx, dy] = args;
      else if (args.length === 4) [dx, dy, dw, dh] = args;
      else [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      operations.push({ source, sx, sy, sw, sh, x: dx, y: dy, w: dw ?? sw, h: dh ?? sh });
    },
    getImageData(left, top, w, h) {
      return { data: pixels(w, h, (x, y) => {
        let color = [0, 0, 0, 0];
        for (const op of operations) {
          if (x < op.x || x >= op.x + op.w || y < op.y || y >= op.y + op.h) continue;
          color = op.color || op.source.colorAt(Math.floor(op.sx + (x - op.x) * op.sw / op.w), Math.floor(op.sy + (y - op.y) * op.sh / op.h));
        }
        return color;
      }, left, top) };
    },
  };
  return {
    get width() { return width; },
    set width(value) { width = value; operations = []; assignments.push({ width, height }); },
    get height() { return height; },
    set height(value) { height = value; operations = []; assignments.push({ width, height }); },
    getContext: () => context,
  };
}

function browserDownloads() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const blobs = new Map();
  const downloads = [];
  const canvasAssignments = [];
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:png-test-${blobs.size}`;
    blobs.set(url, blob);
    return url;
  });
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("document", {
    body: { appendChild: vi.fn() },
    createElement(tag) {
      if (tag === "canvas") return stripCanvas(canvasAssignments);
      if (tag !== "a") throw new Error(`Unexpected element: ${tag}`);
      return {
        download: "", href: "", remove: vi.fn(),
        click() { downloads.push({ filename: this.download, blob: blobs.get(this.href), url: this.href }); },
      };
    },
  });
  return { downloads, canvasAssignments, createObjectURL, revokeObjectURL };
}

async function decode(download) {
  expect(download.blob.type).toBe("image/png");
  const bytes = Buffer.from(await download.blob.arrayBuffer());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { ...info, pixel: (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x + 1) * 4)] };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("single-file PNG downloads", () => {
  it("downloads one existing canvas once as PNG and releases its object URL", async () => {
    const browser = browserDownloads();
    const source = sourceCanvas(3, 2, (x) => x === 0 ? RED : BLUE);
    await pngDownloadPages([source], "nxt5-game.png");
    expect(browser.downloads).toHaveLength(1);
    expect(browser.downloads[0].filename).toBe("nxt5-game.png");
    const image = await decode(browser.downloads[0]);
    expect([image.width, image.height]).toEqual([3, 2]);
    expect(image.pixel(0, 0)).toEqual(RED);
    expect(image.pixel(2, 1)).toEqual(BLUE);
    await vi.runOnlyPendingTimersAsync();
    expect(browser.revokeObjectURL).toHaveBeenCalledWith(browser.downloads[0].url);
  });

  it("combines all pages in order without resizing and downloads only one PNG", async () => {
    const browser = browserDownloads();
    const sources = [
      sourceCanvas(4, 129, (x, y) => y === 128 ? BLUE : x === 3 ? GREEN : RED),
      sourceCanvas(2, 3, (_x, y) => y === 2 ? RED : GREEN),
      sourceCanvas(4, 130, (_x, y) => y === 129 ? GREEN : BLUE),
    ];
    await pngDownloadPages(sources, "nxt5-groupe.png");
    expect(browser.downloads).toHaveLength(1);
    expect(browser.downloads[0].filename).toBe("nxt5-groupe.png");
    const image = await decode(browser.downloads[0]);
    expect([image.width, image.height]).toEqual([4, 262]);
    expect(image.pixel(0, 0)).toEqual(RED);
    expect(image.pixel(3, 127)).toEqual(GREEN);
    expect(image.pixel(0, 128)).toEqual(BLUE);
    expect(image.pixel(0, 129)).toEqual(GREEN);
    expect(image.pixel(1, 131)).toEqual(RED);
    expect(image.pixel(2, 129)).toEqual(background);
    expect(image.pixel(0, 132)).toEqual(BLUE);
    expect(image.pixel(3, 261)).toEqual(GREEN);
  });

  it("exports an image taller than 32767 pixels using bounded canvas strips", async () => {
    const browser = browserDownloads();
    const sources = Array.from({ length: 10 }, (_, index) => sourceCanvas(3, 4001, (_x, y) => y === 4000 ? GREEN : index % 2 ? BLUE : RED));
    await pngDownloadPages(sources, "nxt5-historique.png");
    expect(browser.downloads).toHaveLength(1);
    const image = await decode(browser.downloads[0]);
    expect([image.width, image.height]).toEqual([3, 40010]);
    for (let index = 0; index < sources.length; index += 1) {
      expect(image.pixel(0, index * 4001)).toEqual(index % 2 ? BLUE : RED);
      expect(image.pixel(2, (index + 1) * 4001 - 1)).toEqual(GREEN);
    }
    expect(browser.canvasAssignments.length).toBeGreaterThan(0);
    expect(Math.max(...browser.canvasAssignments.map(({ height }) => height))).toBeLessThanOrEqual(128);
    expect(Math.max(...browser.canvasAssignments.map(({ width }) => width))).toBe(3);
  });

  it("rejects an empty export before allocating a download", async () => {
    const browser = browserDownloads();
    await expect(pngDownloadPages([], "vide.png")).rejects.toThrow();
    expect(browser.downloads).toEqual([]);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects invalid dimensions without downloading an incomplete image", async () => {
    const browser = browserDownloads();
    for (const dimensions of [{ width: 2, height: 0 }, { width: NaN, height: 2 }, { width: 2, height: 0x7fffffff }]) {
      await expect(pngDownloadPages([sourceCanvas(2, 2, () => RED), dimensions], "invalide.png")).rejects.toThrow();
    }
    expect(browser.downloads).toEqual([]);
    expect(browser.canvasAssignments).toEqual([]);
  });

  it("reports an unsupported browser without substituting an archive", async () => {
    const browser = browserDownloads();
    vi.stubGlobal("CompressionStream", undefined);
    await expect(pngDownloadPages([sourceCanvas(2, 2, () => RED), sourceCanvas(2, 2, () => BLUE)], "groupe.png")).rejects.toThrow("navigateur à jour");
    expect(browser.downloads).toEqual([]);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
  });

  it("does not download anything when native PNG encoding fails", async () => {
    const browser = browserDownloads();
    await expect(pngDownloadPages([sourceCanvas(2, 2, () => RED, { failBlob: true })], "echec.png")).rejects.toThrow();
    expect(browser.downloads).toEqual([]);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
  });

  it("does not download partial content when reading a later page fails", async () => {
    const browser = browserDownloads();
    const sources = [sourceCanvas(2, 129, () => RED), sourceCanvas(2, 2, () => BLUE, { readError: new Error("Canvas pixels unavailable") })];
    await expect(pngDownloadPages(sources, "echec-groupe.png")).rejects.toThrow();
    expect(browser.downloads).toEqual([]);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
  });
});
