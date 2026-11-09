// Favicon tiré du rendu 4K du 5 en verre de l'accueil (render-glass-five.mjs).
// Recadrage sur la silhouette, réduction par moitiés successives, puis, pour 16 à 48 px,
// éclaircissement modéré (lisibilité sur les onglets sombres) et légère accentuation.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const GLASS_FIVE_SOURCE = path.join(root, "public/assets/brand/nxt5-5-verre-4096.png");
const LIFT = { brightness: 1.45, saturation: 1.1, sharpen: 0.6 };

let squarePromise;
async function squareSource() {
  const image = await loadImage(GLASS_FIVE_SOURCE);
  const full = createCanvas(image.width, image.height);
  const fctx = full.getContext("2d");
  fctx.drawImage(image, 0, 0);
  const { data, width, height } = fctx.getImageData(0, 0, image.width, image.height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < x0) throw new Error(`Rendu vide : ${GLASS_FIVE_SOURCE}`);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.round(Math.max(w, h) * 1.04);
  const square = createCanvas(side, side);
  square.getContext("2d").drawImage(full, x0, y0, w, h, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h);
  return square;
}

function halveTo(source, size) {
  let current = source;
  while (current.width / 2 >= size * 2) {
    const next = createCanvas(Math.round(current.width / 2), Math.round(current.height / 2));
    const ctx = next.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  const out = createCanvas(size, size);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, size, size);
  return out;
}

function liftAndSharpen(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i] * LIFT.brightness, g = d[i + 1] * LIFT.brightness, b = d[i + 2] * LIFT.brightness;
    const grey = 0.299 * r + 0.587 * g + 0.114 * b;
    r = grey + (r - grey) * LIFT.saturation; g = grey + (g - grey) * LIFT.saturation; b = grey + (b - grey) * LIFT.saturation;
    d[i] = Math.min(255, Math.max(0, r)); d[i + 1] = Math.min(255, Math.max(0, g)); d[i + 2] = Math.min(255, Math.max(0, b));
  }
  // Accentuation douce : original + k × (original − flou 3 × 3), sur la couleur seulement.
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (!src[i + 3]) continue;
    for (let c = 0; c < 3; c++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4;
        if (!src[j + 3]) continue;
        sum += src[j + c]; n++;
      }
      d[i + c] = src[i + c] + LIFT.sharpen * (src[i + c] - sum / n);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function glassFaviconPng(size) {
  squarePromise ??= squareSource();
  const canvas = halveTo(await squarePromise, size);
  return (size <= 48 ? liftAndSharpen(canvas) : canvas).encode("png");
}
