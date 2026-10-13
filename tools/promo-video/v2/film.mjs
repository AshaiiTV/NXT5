// NXT5 promo v2 — follows the canonical charte v1.92 (13 Oct 2026): night #111827, violet glass,
// cyan/fuchsia light, Inter only, official logo files only, the site's real glass 5, real UI captures.
// Every frame is a pure function of t (seconds). Music: music2.py (120 BPM, 1 bar = 2 s).
import * as Canvas from '@napi-rs/canvas';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { createCanvas, loadImage, GlobalFonts } = Canvas;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PUB = path.resolve(ROOT, '../../public/assets');
GlobalFonts.loadSystemFonts();

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BEAT = 0.5;
export const BAR = 2;

// charte §3 tokens
export const C = {
  bg: '#111827',
  text: '#F1F5F9',
  text2: '#CBD5E1',
  muted: '#AFBFD3',
  cyan: '#67E8F9',
  violetText: '#C4B5FD',
  violet: '#A78BFA',
  fuchsia: '#E879F9',
  danger: '#FDA4AF',
  onAccent: '#020611',
};
const SPECTRUM_TEXT = [[0, '#A5F3FC'], [0.55, '#C4B5FD'], [1, '#F0ABFC']];
const PRIMARY = [[0, '#22D3EE'], [0.5, '#3B82F6'], [1, '#D946EF']];

// ------------------------------------------------------------------ math
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = {
  out: (k) => 1 - (1 - k) ** 3,
  outQuint: (k) => 1 - (1 - k) ** 5,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  in: (k) => k * k * k,
};
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ------------------------------------------------------------------ assets
const A = {};
export async function loadAssets() {
  const img = async (p) => loadImage(readFileSync(p));
  A.atmosphere = await img(path.join(PUB, 'loading/glass-atmosphere.webp'));
  A.clouds = await img(path.join(PUB, 'home-motion/atmosphere.webp'));
  A.wordmark = await img(path.join(PUB, 'nxt5-wordmark.png'));
  A.emblem = await img(path.join(PUB, 'nxt5-loader-favicon.png'));
  A.poster = await img(path.join(PUB, 'home-motion/glass-poster@3x.webp'));
  A.roles = {};
  for (const r of ['top', 'jungle', 'middle', 'bottom', 'utility']) {
    const svg = await img(path.join(PUB, `roles/position-${r}.svg`));
    const c = createCanvas(256, 256);
    const x = c.getContext('2d');
    x.drawImage(svg, 0, 0, 256, 256);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#E2E8FF';
    x.fillRect(0, 0, 256, 256);
    A.roles[r] = c;
  }
  A.ui = {};
  for (const f of ['ui-match-timeline-3345.png', 'ui-debrief.png', 'ui-draft.png', 'ui-planning.png', 'ui-analyses.png']) {
    const p = path.join(ROOT, 'assets/ui', f);
    if (existsSync(p)) A.ui[f] = await img(p);
  }
  return A;
}

/** Real glass 5 frames rendered by glass/render-glass.cjs (transparent PNG per pose index). */
const glassCache = new Map();
export async function loadGlassFrame(dir, i) {
  const key = `${dir}/${i}`;
  if (!glassCache.has(key)) {
    const p = path.join(dir, `g${String(i).padStart(5, '0')}.png`);
    glassCache.set(key, existsSync(p) ? await loadImage(readFileSync(p)) : null);
  }
  return glassCache.get(key);
}

// ------------------------------------------------------------------ type (Inter only, full letters, no outline)
export function text(ctx, str, x, y, { size = 72, weight = 700, color = C.text, align = 'left', spectrum = '', alpha = 1, tracking = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px Inter`;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${tracking}px`;
  const parts = spectrum && str.includes(spectrum)
    ? [str.slice(0, str.indexOf(spectrum)), spectrum, str.slice(str.indexOf(spectrum) + spectrum.length)]
    : [str];
  const widths = parts.map((p) => ctx.measureText(p).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  parts.forEach((p, i) => {
    if (!p) return;
    if (parts.length === 3 && i === 1) {
      const g = ctx.createLinearGradient(cx, 0, cx + widths[i], 0);
      for (const [o, c] of SPECTRUM_TEXT) g.addColorStop(o, c);
      ctx.fillStyle = g;
    } else ctx.fillStyle = color;
    ctx.fillText(p, cx, y);
    cx += widths[i];
  });
  ctx.restore();
  return total;
}

/** Line reveal mask (manifesto rule: "masques d’apparition par ligne"). k: 0..1 */
export function revealLine(ctx, k, x, y, size, draw) {
  if (k <= 0) return;
  ctx.save();
  const e = ease.outQuint(k);
  ctx.beginPath();
  ctx.rect(-W * 2, y - size * 1.05, W * 5, size * 1.4);
  ctx.clip();
  ctx.translate(0, (1 - e) * size * 0.9);
  ctx.globalAlpha *= clamp(k * 3);
  draw();
  ctx.restore();
}

// ------------------------------------------------------------------ matter (charte §3 "Matière et éclairage")
export function backdrop(ctx, t, { img = 'atmosphere', dim = 0.35, drift = 1 } = {}) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const im = A[img];
  const s = Math.max(W / im.width, H / im.height) * (1.06 + 0.02 * Math.sin(t * 0.15));
  const w = im.width * s;
  const h = im.height * s;
  ctx.drawImage(im, (W - w) / 2 + Math.sin(t * 0.11) * 18 * drift, (H - h) / 2, w, h);
  ctx.fillStyle = rgba(C.bg, dim);
  ctx.fillRect(0, 0, W, H);
  // fade every edge back to #111827
  const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, rgba(C.bg, 0));
  v.addColorStop(1, rgba(C.bg, 0.9));
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

export function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Violet glass surface: dark core, violet variation, lavender edge, oriented light (not just blur). */
export function glassPanel(ctx, x, y, w, h, { r = 24, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = 'rgba(2,6,17,0.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#263248');
  g.addColorStop(0.62, '#221e42');
  g.addColorStop(1, '#1b273c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  ctx.clip();
  const rv = ctx.createRadialGradient(x + w, y, 0, x + w, y, Math.max(w, h) * 0.6);
  rv.addColorStop(0, 'rgba(139,92,246,0.25)');
  rv.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = rv;
  ctx.fillRect(x, y, w, h);
  const rc = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.45);
  rc.addColorStop(0, 'rgba(103,232,249,0.075)');
  rc.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = rc;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(226,232,255,0.10)';
  ctx.fillRect(x, y, w, 1.5);
  ctx.restore();
  ctx.strokeStyle = 'rgba(196,181,253,0.34)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r);
  ctx.stroke();
  ctx.restore();
}

/** Real UI capture inside a glass frame. src = crop [sx, sy, sw, sh] in image pixels. */
export function uiShot(ctx, name, x, y, w, src, { alpha = 1, pad = 18 } = {}) {
  const im = A.ui[name];
  if (!im) return 0;
  const [sx, sy, sw, sh] = src || [0, 0, im.width, im.height];
  const h = (w * sh) / sw;
  glassPanel(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, { alpha });
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.clip();
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
  return h;
}

export function wordmark(ctx, cx, cy, w, alpha = 1) {
  const h = (w * A.wordmark.height) / A.wordmark.width;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(A.wordmark, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

/** Small "Données fictives" tag required by the charte for example data. */
export function fictiveTag(ctx, x, y, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = '600 22px Inter';
  const label = 'Données fictives';
  const w = ctx.measureText(label).width + 36;
  ctx.fillStyle = 'rgba(17,24,39,0.72)';
  ctx.strokeStyle = 'rgba(181,200,225,0.38)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 40, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.muted;
  ctx.fillText(label, x + 18, y + 28);
  ctx.restore();
}

/** Glass 5 pose at time t (same parameters as glass-motion.js idle, plus the drop entrance). */
export function glassPose(t) {
  const enter = ease.outQuint(seg(t, 16, 17.2));
  const wave = Math.sin(((t - 16) * 1000 / 8000) * Math.PI * 2);
  return {
    rotation: [-0.055 + wave * 0.014 + (1 - enter) * 0.25, -0.31 - (1 - enter) * 1.4 + wave * 0.021 + (t - 16) * 0.02, -0.018 + wave * 0.008],
    position: [0, wave * 0.045 - (1 - enter) * 0.6, (1 - enter) * -1.5],
  };
}

export const assets = () => A;
