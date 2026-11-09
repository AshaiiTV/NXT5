// Génère la famille du logo NXT5 « verre » : SVG maîtres, PNG, WebP, favicons et ICO.
// Usage : node tools/logo-verre/build-brand.mjs
// Navigateur : npx playwright install chromium (ou NXT5_CHROMIUM=/chemin/vers/chromium).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { logo, logoMono, symbol, icon, iconSquare, favicon, favicon5, iconMono } from "./brand.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pub = (p) => path.join(root, "public", p);
const NIGHT = "#111827", WHITE = "#f1f5f9";

const viewBoxSize = (markup) => {
  const [, , w, h] = markup.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  return { w, h };
};

const browser = await chromium.launch(process.env.NXT5_CHROMIUM ? { executablePath: process.env.NXT5_CHROMIUM } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function raster(markup, width, height) {
  const { w, h } = viewBoxSize(markup);
  const H = height ?? Math.round((width * h) / w);
  await page.setViewportSize({ width: Math.max(width, 64), height: Math.max(H, 64) });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${markup.replace("<svg ", `<svg width="${width}" height="${H}" preserveAspectRatio="xMidYMid meet" style="display:block" `)}</body></html>`);
  return page.locator("svg").screenshot({ omitBackground: true });
}

async function webp(png, width) {
  const image = await loadImage(png);
  const height = Math.round((image.height * width) / image.width);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.encode("webp", 88);
}

// ICO avec images PNG intégrées (pris en charge par tous les navigateurs actuels).
function ico(entries) {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, i) => {
    const o = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, o); header.writeUInt8(size >= 256 ? 0 : size, o + 1);
    header.writeUInt8(0, o + 2); header.writeUInt8(0, o + 3);
    header.writeUInt16LE(1, o + 4); header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(png.length, o + 8); header.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...entries.map((e) => e.png)]);
}

const written = [];
async function write(rel, data) {
  await fs.mkdir(path.dirname(pub(rel)), { recursive: true });
  await fs.writeFile(pub(rel), data);
  written.push(rel);
}

// SVG maîtres (kit de marque public).
const L = logo();
const files = {
  "assets/brand/nxt5-logo.svg": L.svg,
  "assets/brand/nxt5-logo-blanc.svg": logoMono(WHITE),
  "assets/brand/nxt5-logo-nuit.svg": logoMono(NIGHT),
  "assets/brand/nxt5-symbole.svg": symbol(),
  "assets/brand/nxt5-icone.svg": icon(),
  "assets/brand/nxt5-icone-blanc.svg": iconMono(WHITE),
  "assets/brand/nxt5-icone-nuit.svg": iconMono(NIGHT),
};
for (const [rel, markup] of Object.entries(files)) await write(rel, markup + "\n");

// Logo horizontal : PNG maître (exports PNG, rendu serveur) et WebP pour l’interface.
const logoPng = await raster(L.svg, 1280);
await write("assets/brand/nxt5-logo.png", logoPng);
await write("assets/brand/nxt5-logo-640.webp", await webp(logoPng, 640));
await write("assets/brand/nxt5-logo-320.webp", await webp(logoPng, 320));

// Symbole et icône.
const symbolPng = await raster(symbol(), 512);
await write("assets/brand/nxt5-symbole-512.png", symbolPng);
await write("assets/brand/nxt5-symbole-256.webp", await webp(symbolPng, 256));
const iconPng = await raster(icon(), 512);
await write("assets/brand/nxt5-icone-512.png", iconPng);
await write("assets/brand/nxt5-icone-256.webp", await webp(iconPng, 256));

// Favicons : le 5 violet seul, dessiné pour chaque taille ; SVG net à toute résolution.
const fav16 = await raster(favicon5(16), 16);
const fav32 = await raster(favicon5(32), 32);
const fav48 = await raster(favicon5(48), 48);
await write("favicon-16x16.png", fav16);
await write("favicon-32x32.png", fav32);
await write("favicon.ico", ico([{ size: 16, png: fav16 }, { size: 32, png: fav32 }, { size: 48, png: fav48 }]));
await write("favicon.svg", favicon5(16) + "\n");
// Rendu 4K du favicon (présentation, hors site).
const docs4k = path.join(root, "docs/assets/logo-verre-2026-11-09/favicon-5-4096.png");
await fs.writeFile(docs4k, await raster(favicon5(4096), 4096));
written.push("../docs/assets/logo-verre-2026-11-09/favicon-5-4096.png");
await write("apple-touch-icon.png", await raster(iconSquare({ safe: 0.2 }), 180));
await write("android-chrome-192x192.png", await raster(favicon(), 192));
await write("android-chrome-512x512.png", await raster(favicon(), 512));
await write("android-chrome-maskable-512x512.png", await raster(iconSquare({ safe: 0.29 }), 512));

await browser.close();
for (const rel of written) {
  const { size } = await fs.stat(pub(rel));
  console.log(`public/${rel} · ${(size / 1024).toFixed(1)} Ko`);
}
