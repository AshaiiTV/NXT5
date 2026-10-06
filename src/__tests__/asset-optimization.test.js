import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { optimizeAsset } from "../../tools/optimize-assets.mjs";

let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

it("encodes WebP at the requested width, preserving aspect ratio and transparency", async () => {
  directory = await mkdtemp(join(tmpdir(), "nxt5-assets-"));
  const source = createCanvas(100, 50);
  const ctx = source.getContext("2d");
  ctx.fillStyle = "#00ffff";
  ctx.fillRect(25, 10, 50, 30);
  const output = join(directory, "logo.webp");
  await optimizeAsset(source.toBuffer("image/png"), output, { width: 40 });
  const bytes = await readFile(output);
  expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  const image = await loadImage(bytes);
  expect([image.width, image.height]).toEqual([40, 20]);
  const decoded = createCanvas(40, 20).getContext("2d");
  decoded.drawImage(image, 0, 0);
  expect(decoded.getImageData(0, 0, 1, 1).data[3]).toBe(0);
  expect(decoded.getImageData(20, 10, 1, 1).data[3]).toBe(255);
});
