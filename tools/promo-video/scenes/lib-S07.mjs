// Shared helpers for scenes S07 and S08 (owned by those scenes only).
// Everything here is either a pure function of its arguments or a cache of static bitmaps.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let EVENTS = null;
function events() {
  if (!EVENTS) EVENTS = JSON.parse(readFileSync(path.join(HERE, '..', 'out', 'music.events.json'), 'utf8'));
  return EVENTS;
}

/** Absolute times of the `kind` events in [a, b] (seconds). */
export function eventsIn(kind, a, b) {
  const list = events()[kind] || [];
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < a - 1e-6) lo = mid + 1;
    else hi = mid;
  }
  const out = [];
  for (let i = lo; i < list.length && list[i] <= b + 1e-6; i++) out.push(list[i]);
  return out;
}

/** Number of `kind` events in [a, t]. */
export const countIn = (kind, a, t) => (t < a ? 0 : eventsIn(kind, a, t).length);

// ------------------------------------------------------------------ static bitmap cache
const bitmaps = new Map();
export function bitmap(key, w, h, paint) {
  let c = bitmaps.get(key);
  if (!c) {
    c = globalThis.__canvasMod.createCanvas(w, h);
    paint(c.getContext('2d'), w, h);
    bitmaps.set(key, c);
  }
  return c;
}

/** Brand bug: small outline logo top-right (cached bitmap). */
export function brandBug(ctx, K, alpha = 0.55) {
  if (alpha <= 0) return;
  const bw = 260;
  const bh = 120;
  const c = bitmap('S07-brandbug', bw, bh, (x) => K.logo(x, bw / 2, bh / 2, 150, { glow: 14, lineWidth: 2.4 }));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(c, 1772 - bw / 2, 62 - bh / 2);
  ctx.restore();
}

// ------------------------------------------------------------------ bokeh world (shared look with S06)
export function bokeh(ctx, f, K, opts = {}) {
  const { count = 25, seed = 207, gain = 1, scale = 1, cx = 960, cy = 540, alpha = 1 } = opts;
  const { W, H } = f;
  const R = K.rng(seed);
  const cols = [K.C.cyan, K.C.violet, K.C.fuchsia];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const x0 = R() * W;
    const y0 = R() * (H + 260);
    const r0 = 20 + R() * 100;
    const a0 = 0.05 + R() * 0.07;
    const sway = R() * 6.28;
    const span = H + 260;
    let y = ((((y0 - f.t * 10 * (0.6 + r0 / 150)) % span) + span) % span) - 130;
    let x = x0 + Math.sin(f.t * 0.25 + sway) * 18;
    x = cx + (x - cx) * scale;
    y = cy + (y - cy) * scale;
    const r = r0 * scale;
    const a = Math.min(0.22, a0 * gain) * alpha;
    const col = cols[i % 3];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, K.rgba(col, a * 0.75));
    g.addColorStop(0.72, K.rgba(col, a));
    g.addColorStop(0.86, K.rgba(col, a * 0.9));
    g.addColorStop(1, K.rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 3-layer particle field (same look as K.particles) with an optional pull toward a point.
 * pull 0..1 drags every particle toward (px, py) on a gentle spiral.
 */
export function particleField(ctx, f, K, opts = {}) {
  const { pull = 0, px = 960, py = 540, alpha = 1, seed = 70, speed = 1 } = opts;
  const { W, H } = f;
  const layers = [
    [90, 1.6, 0.45],
    [55, 2.6, 0.85],
    [22, 4.2, 1.4],
  ];
  const cols = [K.C.cyan, K.C.violet2, K.C.fuchsia];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  layers.forEach(([n, size, sp], li) => {
    const R = K.rng(seed + li * 31);
    for (let i = 0; i < n; i++) {
      const z = 0.3 + R() * 0.7;
      const x0 = R() * W;
      const y0 = R() * H;
      const v = (30 + R() * 90) * z * sp * speed;
      const tw = 0.5 + 0.5 * Math.sin(f.t * (1 + R() * 3) + i);
      const k = R();
      let x = (((x0 + Math.sin(f.t * 0.7 + i) * 12) % W) + W) % W;
      let y = (((y0 - v * f.t) % H) + H) % H;
      let a = alpha * (0.25 + 0.6 * tw) * z;
      if (pull > 0) {
        // each particle starts its trip at a slightly different moment
        const q = K.clamp(pull * 1.25 - k * 0.25);
        const e = K.E.inCubic(q);
        const dx = x - px;
        const dy = y - py;
        const ang = e * 1.6;
        const rx = dx * Math.cos(ang) - dy * Math.sin(ang);
        const ry = dx * Math.sin(ang) + dy * Math.cos(ang);
        x = px + rx * (1 - e);
        y = py + ry * (1 - e);
        a *= 1 + e * 1.5;
      }
      ctx.fillStyle = K.rgba(cols[(i + li) % 3], Math.min(1, a));
      const s = size * z;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  });
  ctx.restore();
}

// ------------------------------------------------------------------ typography helpers
/** Multi-line calm block (Inter Display 900), centred on x, lines centred around y. */
export function calmLines(ctx, K, lines, x, y, opts = {}) {
  const { size = 92, lh = 1.06, emph = '', alpha = 1, rise = 0, glow = 20 } = opts;
  const n = lines.length;
  lines.forEach((ln, i) => {
    const ly = y + (i - (n - 1) / 2) * size * lh + rise;
    K.text(ctx, ln, x, ly, {
      size, font: (px) => K.F.display(px, 900), emph: emph && ln.includes(emph) ? emph : '', glow, alpha,
    });
  });
}

/** Sub pill like renderCards' (ink fill, cyan bar, Inter 700) but supporting several lines. p 0..1. */
export function subPill(ctx, K, lines, x, y, opts = {}) {
  const { size = 54, p = 1, lh = 1.2 } = opts;
  if (p <= 0) return;
  const font = (px) => K.F.inter(px, 700);
  const w = Math.max(...lines.map((l) => K.measure(ctx, l, size, font)));
  const h = lines.length * size * lh + size * 0.5;
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.fillStyle = K.rgba(K.C.ink, 0.68);
  ctx.fillRect(x - w / 2 - 24, y - h / 2, (w + 48) * p, h);
  ctx.fillStyle = K.C.cyan;
  ctx.fillRect(x - w / 2 - 24, y - h / 2, 6, h);
  lines.forEach((l, i) => {
    const ly = y + (i - (lines.length - 1) / 2) * size * lh;
    K.text(ctx, l, x, ly, { size, font, color: K.C.text2 });
  });
  ctx.restore();
  return h;
}

/**
 * Persona "ransom note" letters (same look as K.jaggedText) that treat U+00A0 as a narrow space and
 * return the centre x of every glyph so a scene can draw over a given run of characters.
 * opts: size, p, seed, emph, alpha, emphCard, emphInk, emphOffset,
 * jolt {from, to, amt 0..1, dim 0..1}: knocks glyphs [from, to] askew (±0.12 rad, +8 px) and dims them to 55 %.
 */
export function jagged(ctx, K, str, x, y, opts = {}) {
  const { size = 110, p = 1, seed = 7, emph = '', alpha = 1, emphCard = K.C.text, emphInk = K.C.ink, emphOffset = K.C.cyan, jolt = null } = opts;
  const { C, E, clamp, rng } = K;
  const R = rng(seed);
  const chars = [...str];
  const emphStart = emph ? str.indexOf(emph) : -1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = K.F.anton(size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const isSpace = (ch) => ch === ' ' || ch === ' ';
  const ws = chars.map((ch) => (ch === ' ' ? size * 0.32 : ch === ' ' ? size * 0.16 : ctx.measureText(ch).width * 1.08 + size * 0.06));
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = x - total / 2;
  const n = chars.filter((c) => !isSpace(c)).length;
  const centers = [];
  let k = 0;
  chars.forEach((ch, i) => {
    const w = ws[i];
    centers.push([cx, cx + w]);
    const rot = (R() - 0.5) * 0.28;
    const sc = 0.88 + R() * 0.3;
    const dy = (R() - 0.5) * size * 0.14;
    const style = R();
    if (!isSpace(ch)) {
      const lp = clamp(p * (n + 3) - k * 0.85, 0, 1);
      k++;
      if (lp > 0) {
        const s = E.outBack(lp, 2.4) * sc;
        const isEmph = emphStart >= 0 && i >= emphStart && i < emphStart + emph.length;
        const hit = jolt && i >= jolt.from && i <= jolt.to ? jolt : null;
        ctx.save();
        ctx.translate(cx + w / 2, y + dy + (hit ? 8 * hit.amt : 0));
        ctx.rotate(rot * (1 + (1 - lp) * 3) + (hit ? (k % 2 ? 0.12 : -0.12) * hit.amt : 0));
        ctx.scale(s, s);
        if (hit) ctx.globalAlpha *= 1 - 0.45 * hit.dim;
        const bw = w * 0.98;
        const bh = size * 1.12;
        ctx.fillStyle = isEmph ? emphOffset : style > 0.66 ? C.fuchsia : C.violet;
        ctx.fillRect(-bw / 2 + size * 0.05, -bh / 2 + size * 0.05, bw, bh);
        ctx.fillStyle = isEmph ? emphCard : style < 0.33 ? C.text : C.ink;
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        ctx.fillStyle = isEmph ? emphInk : style < 0.33 ? C.ink : C.text;
        ctx.fillText(ch, 0, size * 0.04);
        ctx.restore();
      }
    }
    cx += w;
  });
  ctx.restore();
  return { total, spans: centers };
}
