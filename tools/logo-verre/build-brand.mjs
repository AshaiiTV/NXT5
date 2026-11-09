// Génère la famille du logo NXT5 : le 5 de l’accueil (rendu 3D) partout, NXT en verre dépoli.
// Prérequis : public/assets/brand/nxt5-5-verre-4096.png, produit par render-glass-five.mjs.
// Usage : node tools/logo-verre/build-brand.mjs
// Navigateur : npx playwright install chromium (ou NXT5_CHROMIUM=/chemin/vers/chromium).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { logo, logoMono, iconMono } from "./brand.mjs";
import { GLASS_FIVE_SOURCE, glassFiveDataUri, glassSymbolPng, glassFaviconPng, glassIconPng } from "./glass-five.mjs";

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

// Versions une couleur (vectorielles, contour exact du 5 de l’accueil).
const vectors = {
  "assets/brand/nxt5-logo-blanc.svg": logoMono(WHITE),
  "assets/brand/nxt5-logo-nuit.svg": logoMono(NIGHT),
  "assets/brand/nxt5-icone-blanc.svg": iconMono(WHITE),
  "assets/brand/nxt5-icone-nuit.svg": iconMono(NIGHT),
};
for (const [rel, markup] of Object.entries(vectors)) await write(rel, markup + "\n");
console.log(`Source du 5 : ${path.relative(root, GLASS_FIVE_SOURCE)}`);

// Logo horizontal : NXT vectoriel + 5 rendu en 3D. PNG maître (exports, rendu serveur) et WebP.
const L = logo(await glassFiveDataUri(1200));
const logoPng = await raster(L.svg, 1600);
await write("assets/brand/nxt5-logo-3d.png", logoPng);
await write("assets/brand/nxt5-logo-3d-640.webp", await webp(logoPng, 640));
await write("assets/brand/nxt5-logo-3d-320.webp", await webp(logoPng, 320));

// Symbole : le 5 seul, transparent (carte joueur, Wrapped, kit).
const symbolPng = await glassSymbolPng(512);
await write("assets/brand/nxt5-symbole-3d-512.png", symbolPng);
await write("assets/brand/nxt5-symbole-3d-256.webp", await webp(symbolPng, 256));

// Icône d’interface : le 5 sur tuile bleu nuit cerclée d’un filet violet.
const iconPng = await glassIconPng(512, { border: true });
await write("assets/brand/nxt5-icone-3d-512.png", iconPng);
await write("assets/brand/nxt5-icone-3d-256.webp", await webp(iconPng, 256));

// Favicons.
const fav16 = await glassFaviconPng(16);
const fav32 = await glassFaviconPng(32);
const fav48 = await glassFaviconPng(48);
await write("favicon-16x16.png", fav16);
await write("favicon-32x32.png", fav32);
await write("favicon.ico", ico([{ size: 16, png: fav16 }, { size: 32, png: fav32 }, { size: 48, png: fav48 }]));

// Icônes d’installation : Apple plein cadre (le système arrondit), Android arrondie et « maskable ».
await write("apple-touch-icon.png", await glassIconPng(180, { radius: 0, fill: 0.7 }));
await write("android-chrome-192x192.png", await glassIconPng(192));
await write("android-chrome-512x512.png", await glassIconPng(512));
await write("android-chrome-maskable-512x512.png", await glassIconPng(512, { radius: 0, fill: 0.56 }));

await browser.close();
for (const rel of written) {
  const { size } = await fs.stat(pub(rel));
  console.log(`public/${rel} · ${(size / 1024).toFixed(1)} Ko`);
}
