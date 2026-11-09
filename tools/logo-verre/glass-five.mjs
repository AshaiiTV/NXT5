// Déclinaisons du 5 en verre de l'accueil, à partir de son rendu 4K (render-glass-five.mjs) :
// image recadrée pour le logo, symbole transparent, favicons et icônes sur fond bleu nuit.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const GLASS_FIVE_SOURCE = path.join(root, "public/assets/brand/nxt5-5-verre-4096.png");
const LIFT = { brightness: 1.45, saturation: 1.1, sharpen: 0.6 };

// Silhouette du rendu, recadrée au plus près.
let tightPromise;
export function glassFiveTight() {
  tightPromise ??= (async () => {
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
    const tight = createCanvas(x1 - x0 + 1, y1 - y0 + 1);
    tight.getContext("2d").drawImage(full, x0, y0, tight.width, tight.height, 0, 0, tight.width, tight.height);
    return tight;
  })();
  return tightPromise;
}

const smooth = (ctx) => { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; };

// Réduction par moitiés successives, puis taille finale.
function resize(source, width, height) {
  let current = source;
  while (current.width / 2 >= width * 2 && current.height / 2 >= height * 2) {
    const next = createCanvas(Math.round(current.width / 2), Math.round(current.height / 2));
    const ctx = next.getContext("2d"); smooth(ctx);
    ctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  const out = createCanvas(width, height);
  const ctx = out.getContext("2d"); smooth(ctx);
  ctx.drawImage(current, 0, 0, width, height);
  return out;
}

// Le 5 centré dans un carré transparent ; « fill » = part du carré occupée par sa hauteur.
async function squareFive(size, fill = 0.96) {
  const tight = await glassFiveTight();
  const h = Math.round(size * fill), w = Math.round((h * tight.width) / tight.height);
  const five = resize(tight, w, h);
  const out = createCanvas(size, size);
  out.getContext("2d").drawImage(five, Math.round((size - w) / 2), Math.round((size - h) / 2));
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

// Image du 5 pour le logo horizontal (data URI PNG), à la hauteur demandée.
export async function glassFiveDataUri(height) {
  const tight = await glassFiveTight();
  const png = await resize(tight, Math.round((height * tight.width) / tight.height), height).encode("png");
  return "data:image/png;base64," + png.toString("base64");
}

// Symbole : le 5 seul, fond transparent.
export async function glassSymbolPng(size) {
  return (await squareFive(size, 0.96)).encode("png");
}

// Favicon : le 5 seul, éclairci et accentué jusqu'à 48 px pour les onglets sombres.
export async function glassFaviconPng(size) {
  const canvas = await squareFive(size, 0.96);
  return (size <= 48 ? liftAndSharpen(canvas) : canvas).encode("png");
}

function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Icône : le 5 sur fond bleu nuit, halo violet en dessous.
// radius 0 = plein cadre (Apple arrondit lui-même ; Android « maskable » découpe sa forme).
// fill = hauteur du 5 rapportée au côté (zone sûre maskable : environ 0,56).
export async function glassIconPng(size, { radius = 0.225, fill = 0.74, border = false } = {}) {
  const out = createCanvas(size, size);
  const ctx = out.getContext("2d"); smooth(ctx);
  const r = size * radius;
  roundedPath(ctx, 0, 0, size, size, r);
  ctx.save();
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#1c2140"); bg.addColorStop(1, "#0d1222");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size * 0.5, size * 0.66, 0, size * 0.5, size * 0.66, size * 0.5);
  glow.addColorStop(0, "rgba(139, 92, 246, 0.42)"); glow.addColorStop(1, "rgba(139, 92, 246, 0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, size, size);
  const five = await squareFive(size, fill);
  ctx.drawImage(five, 0, 0);
  ctx.restore();
  if (border) {
    const t = Math.max(1, size * 0.012);
    roundedPath(ctx, t / 2, t / 2, size - t, size - t, Math.max(r - t / 2, 0));
    ctx.lineWidth = t; ctx.strokeStyle = "rgba(196, 181, 253, 0.38)"; ctx.stroke();
  }
  return out.encode("png");
}
