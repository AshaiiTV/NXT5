/**
 * Rasterise les sources vectorielles de l'identité NXT5 (public/assets/brand/*.svg)
 * vers les bitmaps servis par le site : logo, wordmark, emblème, favicons et icônes.
 * Usage : node tools/generate-brand-assets.mjs
 *
 * Référence : la charte graphique unique indiquée par AGENTS.md. Les SVG sont la
 * source ; ne pas retoucher les PNG à la main. Chromium Playwright est requis
 * (`npx playwright install chromium`). Lance ensuite `node tools/generate-social-card.mjs`.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { optimizeAsset } from "./optimize-assets.mjs";

const root = new URL("../", import.meta.url);
const localPath = (relativePath) => fileURLToPath(new URL(relativePath, root));

// [source SVG, sortie PNG, largeur en px]. La hauteur suit le viewBox.
const RASTERS = [
  ["public/assets/brand/nxt5-logo.svg", "public/assets/nxt5-logo.png", 1500],
  ["public/assets/brand/nxt5-wordmark.svg", "public/assets/nxt5-wordmark.png", 1204],
  ["public/assets/brand/nxt5-emblem.svg", "public/assets/nxt5-loader-favicon.png", 512],
  ["public/assets/brand/nxt5-emblem.svg", "public/android-chrome-512x512.png", 512],
  ["public/assets/brand/nxt5-emblem.svg", "public/android-chrome-192x192.png", 192],
  ["public/assets/brand/nxt5-emblem.svg", "public/apple-touch-icon.png", 180],
  ["public/assets/brand/nxt5-emblem.svg", "public/favicon-32x32.png", 32],
  ["public/assets/brand/nxt5-emblem.svg", "public/favicon-16x16.png", 16],
];

const WEBP = [
  ["public/assets/nxt5-logo.png", "public/assets/nxt5-logo-640.webp", 640],
  ["public/assets/nxt5-logo.png", "public/assets/nxt5-logo-320.webp", 320],
  ["public/assets/nxt5-wordmark.png", "public/assets/nxt5-wordmark-640.webp", 640],
  ["public/assets/nxt5-wordmark.png", "public/assets/nxt5-wordmark-320.webp", 320],
  ["public/assets/nxt5-loader-favicon.png", "public/assets/nxt5-loader-favicon-512.webp", 512],
  ["public/assets/nxt5-loader-favicon.png", "public/assets/nxt5-loader-favicon-256.webp", 256],
];

function viewBoxOf(svg) {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) throw new Error("viewBox absent de la source SVG.");
  const [, , width, height] = match[1].trim().split(/\s+/).map(Number);
  return { width, height };
}

/** Un conteneur ICO peut embarquer des PNG : une entrée par taille. */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const directory = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    directory.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...directory, ...pngs.map(({ data }) => data)]);
}

// Un Chromium déjà installé peut être désigné par NXT5_CHROMIUM_PATH (ex. environnement CI).
const browser = await chromium.launch(process.env.NXT5_CHROMIUM_PATH ? { executablePath: process.env.NXT5_CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const cache = new Map();
  async function raster(source, width) {
    const svg = cache.get(source) ?? (await readFile(localPath(source), "utf8"));
    cache.set(source, svg);
    const box = viewBoxOf(svg);
    const height = Math.round(width * box.height / box.width);
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${width}px;height:${height}px}</style></head><body>${svg.replace(/^<\?xml[^>]*>\s*/, "")}</body></html>`,
      { waitUntil: "load" }
    );
    return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width, height } });
  }

  for (const [source, output, width] of RASTERS) {
    await writeFile(localPath(output), await raster(source, width));
    console.log(output);
  }

  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const size of icoSizes) icoEntries.push({ size, data: await raster("public/assets/brand/nxt5-emblem.svg", size) });
  await writeFile(localPath("public/favicon.ico"), buildIco(icoEntries));
  console.log("public/favicon.ico");
} finally {
  await browser.close();
}

for (const [input, output, width] of WEBP) {
  await optimizeAsset(localPath(input), localPath(output), { width });
  console.log(output);
}
