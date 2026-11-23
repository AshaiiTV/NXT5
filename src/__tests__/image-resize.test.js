import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resizeImageToDataUrl } from "../utils/image-resize.js";

let drawn, encodings;
beforeEach(() => {
  drawn = null;
  encodings = {};
  vi.stubGlobal("createImageBitmap", async () => ({ width: 2000, height: 1000, close: vi.fn() }));
  vi.stubGlobal("document", {
    createElement: (tag) => {
      if (tag !== "canvas") throw new Error(`unexpected element ${tag}`);
      const canvas = { width: 0, height: 0 };
      canvas.getContext = () => ({ drawImage: (_image, x, y, w, h) => { drawn = { w, h }; } });
      canvas.toDataURL = (type) => encodings[type] ?? "data:image/png;base64,AAAA";
      return canvas;
    }
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

it("caps the longest side at 512 px and keeps the aspect ratio", async () => {
  encodings["image/webp"] = "data:image/webp;base64,AAAA";
  const url = await resizeImageToDataUrl(new Blob(["x"], { type: "image/png" }));
  expect(drawn).toEqual({ w: 512, h: 256 });
  expect(url).toBe("data:image/webp;base64,AAAA");
});

it("falls back to another format when WebP encoding is unsupported", async () => {
  encodings["image/webp"] = "data:image/png;base64,BBBB";
  encodings["image/png"] = "data:image/png;base64,CCCC";
  expect(await resizeImageToDataUrl(new Blob(["x"]))).toBe("data:image/png;base64,CCCC");
});

it("refuses when no encoding fits under the size cap", async () => {
  const huge = "data:image/jpeg;base64," + "A".repeat(500_000);
  encodings["image/webp"] = "data:image/webp;base64," + "A".repeat(500_000);
  encodings["image/png"] = "data:image/png;base64," + "A".repeat(500_000);
  encodings["image/jpeg"] = huge;
  await expect(resizeImageToDataUrl(new Blob(["x"]))).rejects.toThrow("Image trop lourde.");
});
