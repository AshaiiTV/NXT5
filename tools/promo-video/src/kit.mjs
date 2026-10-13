// Motion-design kit for the NXT5 promo: palette, easing, beat envelopes and drawing helpers.
// Every helper is a pure function of its arguments (no hidden frame state), so frames can be
// rendered in any order and in parallel processes.
import { GlobalFonts, createCanvas } from '@napi-rs/canvas';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const fontFile = (pkg, file) => path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);
GlobalFonts.registerFromPath(fontFile('@fontsource/anton', 'anton-latin-400-normal.woff'), 'Anton');
GlobalFonts.registerFromPath(fontFile('@fontsource/bebas-neue', 'bebas-neue-latin-400-normal.woff'), 'Bebas Neue');
GlobalFonts.registerFromPath(fontFile('@fontsource/russo-one', 'russo-one-latin-400-normal.woff'), 'Russo One');
GlobalFonts.loadSystemFonts();

export const W = 1920;
export const H = 1080;
export const FPS = 60;

// ------------------------------------------------------------------ palette (src/index.css tokens)
export const C = {
  night: '#070b17',
  bg: '#111827',
  surface: '#1e293b',
  raised: '#29384d',
  text: '#f1f5f9',
  text2: '#cbd5e1',
  muted: '#afbfd3',
  cyan: '#67e8f9',
  cyan2: '#22d3ee',
  blue: '#3b82f6',
  indigo: '#818cf8',
  violet: '#a78bfa',
  violet2: '#c4b5fd',
  fuchsia: '#e879f9',
  fuchsia2: '#d946ef',
  danger: '#fda4af',
  red: '#ff3b5c',
  gold: '#f5c66b',
  ink: '#020611',
};
export const SPECTRUM = [[0, C.cyan], [0.38, C.indigo], [0.65, C.violet], [1, C.fuchsia]];

export function rgba(hex, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ------------------------------------------------------------------ math & easing
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progress of `t` through [a, b], clamped to 0..1. */
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const map = (v, a, b, c, d) => c + (d - c) * clamp((v - a) / (b - a));

export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inQuart: (t) => t ** 4,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  // brand easing cubic-bezier(.23,1,.32,1) ~ strong ease-out
  brand: (t) => 1 - (1 - t) ** 5,
};

/** Deterministic PRNG (mulberry32). */
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Hash-based value noise in [-1, 1], smooth in t. */
export function noise1(t, seed = 0) {
  const h = (i) => {
    const r = Math.sin((i + seed * 127.1) * 311.7) * 43758.5453;
    return (r - Math.floor(r)) * 2 - 1;
  };
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

// ------------------------------------------------------------------ music timeline & envelopes
export const BPM = 150;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const barT = (bar, beat = 0) => bar * BAR + beat * BEAT;

let EVENTS = null;
export function loadEvents(file) {
  EVENTS = JSON.parse(readFileSync(file, 'utf8'));
  return EVENTS;
}
function lastBefore(list, t) {
  let lo = 0;
  let hi = list.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= t + 1e-6) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best < 0 ? null : list[best];
}
/** Seconds since the last event of `kind` ("kick", "snare", "hat", "impact", "stab"); Infinity if none. */
export function since(kind, t) {
  const v = EVENTS && lastBefore(EVENTS[kind] || [], t);
  return v == null ? Infinity : t - v;
}
/** Exponential envelope 1 -> 0 after each event of `kind`. */
export function env(kind, t, decay = 10) {
  const s = since(kind, t);
  return Number.isFinite(s) ? Math.exp(-s * decay) : 0;
}
/** Energy of the arrangement at time t (0 calm .. 1 drop). */
export function energy(t) {
  const b = t / BAR;
  if (b < 4) return 0.2;
  if (b < 8) return 0.35;
  if (b < 12) return 0.4 + 0.4 * ((b - 8) / 4);
  if (b < 20) return 0.9;
  if (b < 28) return 0.45;
  if (b < 32) return 0.5 + 0.4 * ((b - 28) / 4);
  if (b < 44) return 1;
  return 0.6;
}

/** Frame context handed to scenes. */
export function frameContext(t, scene) {
  const start = barT(scene.startBar);
  const end = barT(scene.endBar);
  const lt = t - start;
  return {
    t,
    W,
    H,
    lt,
    lb: lt / BAR, // local bars
    p: clamp(lt / (end - start)),
    dur: end - start,
    bar: t / BAR,
    beat: t / BEAT,
    beatPhase: (((t / BEAT) % 1) + 1) % 1,
    barPhase: (((t / BAR) % 1) + 1) % 1,
    kick: env('kick', t, 9),
    snare: env('snare', t, 8),
    hat: env('hat', t, 25),
    impact: env('impact', t, 2.2),
    stab: env('stab', t, 7),
    energy: energy(t),
    since: (k) => since(k, t),
    env: (k, d) => env(k, t, d),
    /** Local seconds at which (absolute bar, beat) happens, relative to the scene start. */
    at: (bar, beat = 0) => barT(bar, beat) - start,
  };
}

// ------------------------------------------------------------------ fonts & text
export const F = {
  anton: (px) => `${px}px Anton`,
  bebas: (px) => `${px}px "Bebas Neue"`,
  russo: (px) => `${px}px "Russo One"`,
  inter: (px, w = 800) => `${w} ${px}px Inter`,
  display: (px, w = 900) => `${w} ${px}px "Inter Display"`,
};

export function linearSpectrum(ctx, x0, y0, x1, y1, stops = SPECTRUM) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Splits `text` into runs, flagging the words contained in `emph` (exact substring). */
function runs(text, emph) {
  if (!emph || !text.includes(emph)) return [{ s: text, e: false }];
  const i = text.indexOf(emph);
  return [
    { s: text.slice(0, i), e: false },
    { s: emph, e: true },
    { s: text.slice(i + emph.length), e: false },
  ].filter((r) => r.s);
}

/**
 * Draws a line of text with an optional emphasized substring (spectrum gradient or `emphColor`).
 * opts: size, font(px)->string, color, emph, emphColor, align ('left'|'center'|'right'), glow, glowColor,
 * stroke (px), strokeColor, alpha, spacing (letter spacing px). Returns the drawn width.
 */
export function text(ctx, str, x, y, opts = {}) {
  const {
    size = 80, font = F.anton, color = C.text, emph = '', emphColor = null, align = 'center',
    glow = 0, glowColor = C.cyan, stroke = 0, strokeColor = C.ink, alpha = 1, spacing = 0, baseline = 'middle',
  } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(size);
  ctx.textBaseline = baseline;
  ctx.textAlign = 'left';
  ctx.letterSpacing = `${spacing}px`;
  const parts = runs(str, emph);
  const widths = parts.map((r) => ctx.measureText(r.s).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  parts.forEach((r, i) => {
    const fill = r.e ? (emphColor || linearSpectrum(ctx, cx, y - size / 2, cx + widths[i], y + size / 2)) : color;
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(r.s, cx, y);
    }
    if (glow) {
      ctx.shadowColor = r.e ? (emphColor || C.fuchsia) : glowColor;
      ctx.shadowBlur = glow;
    }
    ctx.fillStyle = fill;
    ctx.fillText(r.s, cx, y);
    ctx.shadowBlur = 0;
    cx += widths[i];
  });
  ctx.restore();
  return total;
}

export function measure(ctx, str, size, font = F.anton, spacing = 0) {
  ctx.save();
  ctx.font = font(size);
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Largest font size <= max so that `str` fits in `maxW`. */
export function fitSize(ctx, str, maxW, max, font = F.anton, spacing = 0) {
  const w = measure(ctx, str, max, font, spacing);
  return w <= maxW ? max : Math.floor((max * maxW) / w);
}

/**
 * Persona-style "ransom note" letters: each glyph on its own tilted card, popping in one after the other.
 * p: 0..1 appearance progress. opts: size, seed, font, colors (array of card fills), textColor, emph.
 */
export function jaggedText(ctx, str, x, y, opts = {}) {
  const { size = 120, p = 1, seed = 7, font = F.anton, emph = '', align = 'center', alpha = 1 } = opts;
  const R = rng(seed);
  const chars = [...str];
  const emphStart = emph ? str.indexOf(emph) : -1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const ws = chars.map((ch) => (ch === ' ' ? size * 0.32 : ctx.measureText(ch).width * 1.08 + size * 0.06));
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const n = chars.filter((c) => c !== ' ').length;
  let k = 0;
  chars.forEach((ch, i) => {
    const w = ws[i];
    const rot = (R() - 0.5) * 0.28;
    const sc = 0.88 + R() * 0.3;
    const dy = (R() - 0.5) * size * 0.14;
    const style = R();
    if (ch !== ' ') {
      const lp = clamp(p * (n + 3) - k * 0.85, 0, 1);
      k++;
      if (lp > 0) {
        const s = E.outBack(lp, 2.4) * sc;
        const isEmph = emphStart >= 0 && i >= emphStart && i < emphStart + emph.length;
        ctx.save();
        ctx.translate(cx + w / 2, y + dy);
        ctx.rotate(rot * (1 + (1 - lp) * 3));
        ctx.scale(s, s);
        const bw = w * 0.98;
        const bh = size * 1.12;
        // offset outline card
        ctx.fillStyle = isEmph ? C.cyan : style > 0.66 ? C.fuchsia : C.violet;
        ctx.fillRect(-bw / 2 + size * 0.05, -bh / 2 + size * 0.05, bw, bh);
        ctx.fillStyle = isEmph ? C.fuchsia2 : style < 0.33 ? C.text : C.ink;
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        ctx.fillStyle = isEmph ? C.text : style < 0.33 ? C.ink : C.text;
        ctx.fillText(ch, 0, size * 0.04);
        ctx.restore();
      }
    }
    cx += w;
  });
  ctx.restore();
  return total;
}

/** Text slamming in from huge scale with ghost trails. p 0..1. */
export function slamText(ctx, str, x, y, opts = {}) {
  const { size = 160, p = 1, font = F.anton, color = C.text, emph = '', emphColor = null, glow = 30, ghosts = 3, angle = 0 } = opts;
  const e = E.outExpo(clamp(p));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  for (let g = ghosts; g >= 0; g--) {
    const ge = clamp(e - g * 0.06);
    const s = lerp(3.2, 1, ge);
    ctx.save();
    ctx.scale(s, s);
    text(ctx, str, 0, 0, { size, font, color, emph, emphColor, glow: g ? 0 : glow, alpha: g ? 0.12 * (1 - e) : clamp(p * 4) });
    ctx.restore();
  }
  ctx.restore();
}

/** Typewriter reveal with block cursor. p 0..1. */
export function typeText(ctx, str, x, y, opts = {}) {
  const { p = 1, size = 44, font = (px) => F.inter(px, 700), color = C.text, align = 'left', cursor = true, t = 0, emph = '' } = opts;
  const n = Math.floor(str.length * clamp(p));
  const shown = str.slice(0, n);
  const full = measure(ctx, str, size, font);
  const x0 = align === 'center' ? x - full / 2 : x;
  const w = text(ctx, shown, x0, y, { size, font, color, align: 'left', emph: emph && shown.includes(emph) ? emph : '' });
  if (cursor && (p < 1 || Math.floor(t * 2.5) % 2 === 0)) {
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x0 + w + 6, y - size * 0.45, size * 0.5, size * 0.9);
  }
}

/** Rubber stamp: rotated rectangle frame + text, slamming down. p 0..1. */
export function stamp(ctx, str, x, y, opts = {}) {
  const { size = 90, p = 1, color = C.fuchsia2, angle = -0.14, font = F.bebas } = opts;
  const e = clamp(p);
  const s = lerp(2.2, 1, E.outExpo(e));
  ctx.save();
  ctx.globalAlpha *= clamp(e * 3);
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  const w = measure(ctx, str, size, font, 4) + size * 0.7;
  const h = size * 1.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.shadowColor = color;
  ctx.shadowBlur = 25;
  roundRect(ctx, -w / 2, -h / 2, w, h, size * 0.12);
  ctx.stroke();
  ctx.shadowBlur = 0;
  text(ctx, str, 0, size * 0.04, { size, font, color, spacing: 4 });
  ctx.restore();
}

// ------------------------------------------------------------------ shapes
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
export function polyPath(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  if (close) ctx.closePath();
}
export function hexPath(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3 + Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
export function starPath(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Glass panel (brand surfaces): gradient fill, violet border, optional header bar + tilt. */
export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 22, alpha = 1, accent = C.cyan, header = '', headerSize = 30, tilt = 0, glow = 0.5 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(tilt);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = rgba(C.violet, 0.45 * glow);
  ctx.shadowBlur = 50 * glow;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#263248');
  g.addColorStop(0.62, '#221e42');
  g.addColorStop(1, '#1b273c');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(C.violet2, 0.4);
  ctx.lineWidth = 2;
  ctx.stroke();
  if (header) {
    ctx.save();
    roundRect(ctx, 0, 0, w, headerSize * 2, [r, r, 0, 0]);
    ctx.clip();
    ctx.fillStyle = rgba(accent, 0.16);
    ctx.fillRect(0, 0, w, headerSize * 2);
    ctx.fillStyle = accent;
    ctx.fillRect(0, headerSize * 2 - 3, w, 3);
    ctx.restore();
    text(ctx, header, 28, headerSize, { size: headerSize, font: (px) => F.inter(px, 800), align: 'left', color: C.text, spacing: 2 });
  }
  ctx.restore();
}

// ------------------------------------------------------------------ backgrounds & fields
/** Night background with drifting nebula glows. opts: hue shift toward fuchsia (0..1), intensity, grid. */
export function background(ctx, f, opts = {}) {
  const { warm = 0, intensity = 1, grid = true, pulse = f.kick * 0.5 * f.energy } = opts;
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, '#16203a');
  g.addColorStop(0.6, C.bg);
  g.addColorStop(1, C.night);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const blobs = [
    [C.violet, 0.3 + 0.12 * Math.sin(f.t * 0.3), 0.3, 0.55],
    [warm > 0.5 ? C.fuchsia : C.cyan2, 0.72 + 0.1 * Math.cos(f.t * 0.25), 0.62, 0.45],
    [C.fuchsia2, 0.5 + 0.2 * Math.sin(f.t * 0.17 + 2), 0.9, 0.35 + warm * 0.3],
  ];
  for (const [col, bx, by, a] of blobs) {
    const rg = ctx.createRadialGradient(bx * W, by * H, 0, bx * W, by * H, W * 0.42);
    rg.addColorStop(0, rgba(col, (0.16 + pulse * 0.12) * a * intensity * 2));
    rg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  if (grid) {
    ctx.save();
    ctx.strokeStyle = rgba(C.indigo, 0.05 + pulse * 0.05);
    ctx.lineWidth = 1;
    const off = (f.t * 20) % 80;
    ctx.beginPath();
    for (let x = -off; x < W; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = -off; y < H; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Deterministic parallax particle field. */
export function particles(ctx, f, opts = {}) {
  const { count = 160, speed = 1, color = C.cyan, colors = [C.cyan, C.violet2, C.fuchsia], seed = 3, size = 2.2, dir = -Math.PI / 2, alpha = 1 } = opts;
  const R = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const z = 0.3 + R() * 0.7;
    const x0 = R() * W;
    const y0 = R() * H;
    const v = (30 + R() * 90) * z * speed;
    const x = (((x0 + Math.cos(dir) * v * f.t + Math.sin(f.t * 0.7 + i) * 12) % W) + W) % W;
    const y = (((y0 + Math.sin(dir) * v * f.t) % H) + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(f.t * (1 + R() * 3) + i);
    const c = colors ? colors[i % colors.length] : color;
    ctx.fillStyle = rgba(c, alpha * (0.25 + 0.6 * tw) * z);
    const s = size * z * (1 + f.kick * f.energy * 0.8);
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  ctx.restore();
}

/** Persona halftone dot field, confined to a diagonal band. The dot bitmap is computed once per
 * configuration, then only translated (drift) and pulsed (alpha) per frame. */
const halftoneCache = new Map();
function halftoneBitmap(spacing, angle, band, maxR) {
  const key = `${spacing}|${angle}|${band}|${maxR}`;
  if (halftoneCache.has(key)) return halftoneCache.get(key);
  const M = spacing * 3;
  const c = createCanvas(W + 2 * M, H + 2 * M);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.translate(c.width / 2, c.height / 2);
  x.rotate(angle);
  const span = Math.hypot(c.width, c.height);
  let n = 0;
  x.beginPath();
  for (let yy = -span / 2; yy < span / 2; yy += spacing) {
    const u = (yy + span / 2) / span;
    if (u <= band[0] || u >= band[1]) continue;
    const bandU = (u - band[0]) / (band[1] - band[0]);
    for (let xx = -span / 2; xx < span / 2; xx += spacing) {
      const r = maxR * Math.sin(bandU * Math.PI) * (0.65 + 0.35 * Math.sin(xx * 0.004));
      if (r < 0.5) continue;
      x.moveTo(xx + r, yy);
      x.arc(xx, yy, r, 0, Math.PI * 2);
      if (++n % 60 === 0) {
        x.fill();
        x.beginPath();
      }
    }
  }
  x.fill();
  const out = { c, M };
  halftoneCache.set(key, out);
  return out;
}
export function halftone(ctx, f, opts = {}) {
  const { spacing = 16, color = C.violet, alpha = 0.25, angle = -0.32, band = [0.15, 0.85], maxR = 6, drift = 30 } = opts;
  const { c, M } = halftoneBitmap(spacing, angle, band, maxR);
  const [tc, tx] = offscreen('halftone');
  const off = (f.t * drift) % spacing;
  tx.drawImage(c, -M + Math.cos(angle) * off, -M + Math.sin(angle) * off);
  tx.globalCompositeOperation = 'source-in';
  tx.fillStyle = color;
  tx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha *= clamp(alpha * (1 + f.kick * f.energy * 0.6));
  ctx.drawImage(tc, 0, 0);
  ctx.restore();
}

/** Diagonal speed lines. density 0..1+, angle in rad. */
export function speedLines(ctx, f, opts = {}) {
  const { density = 1, angle = -0.32, color = C.cyan, seed = 11, speed = 2400, alpha = 0.6, width = 3 } = opts;
  const R = rng(seed);
  const n = Math.floor(220 * density);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const y = (R() - 0.5) * H * 1.6;
    const len = 80 + R() * 420;
    const v = speed * (0.5 + R());
    const x = ((((R() * W * 2 + f.t * v) % (W * 2.2)) + W * 2.2) % (W * 2.2)) - W * 1.1;
    const c = i % 5 === 0 ? C.fuchsia : i % 3 === 0 ? C.violet2 : color;
    const g = ctx.createLinearGradient(x - len, 0, x, 0);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(1, rgba(c, alpha * (0.3 + R() * 0.7)));
    ctx.fillStyle = g;
    ctx.fillRect(x - len, y, len, width * (0.5 + R()));
  }
  ctx.restore();
}

/** Expanding shockwave ring with spark lines. p 0..1. */
export function shockwave(ctx, x, y, p, opts = {}) {
  const { color = C.cyan, maxR = 1300, width = 40, sparks = 14, seed = 5 } = opts;
  if (p <= 0 || p >= 1) return;
  const e = E.outCubic(p);
  const r = maxR * e;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 1 - p);
  ctx.lineWidth = width * (1 - p) + 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(C.text, 0.8 * (1 - p));
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  const R = rng(seed);
  ctx.lineWidth = 3;
  for (let i = 0; i < sparks; i++) {
    const a = (i / sparks) * Math.PI * 2 + R() * 0.3;
    const r0 = r * (0.7 + R() * 0.3);
    const r1 = r0 + 60 + R() * 140 * (1 - p);
    ctx.strokeStyle = rgba(i % 2 ? C.fuchsia : color, 1 - p);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Hextech rune circle: concentric rings with ticks, dashed arcs and glyph marks. draw: 0..1 self-drawing. */
export function rune(ctx, x, y, r, f, opts = {}) {
  const { draw = 1, spin = 1, color = C.cyan, accent = C.violet, glow = 20, alpha = 1, gold = 0 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  const rings = [
    [1, 0.25, 3, 72],
    [0.78, -0.4, 2, 36],
    [0.56, 0.7, 2.5, 6],
  ];
  rings.forEach(([rr, sp, lw, ticks], k) => {
    const R0 = r * rr;
    const rot = f.t * sp * spin;
    const d = clamp(draw * 1.4 - k * 0.2);
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = k === 1 && gold ? rgba(C.gold, 0.9) : k === 1 ? accent : color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, R0, 0, Math.PI * 2 * d);
    ctx.stroke();
    const nt = Math.floor(ticks * d);
    ctx.beginPath();
    for (let i = 0; i < nt; i++) {
      const a = (i / ticks) * Math.PI * 2;
      const big = i % (ticks / 6 || 1) === 0;
      const l = big ? 26 : 10;
      ctx.moveTo(Math.cos(a) * R0, Math.sin(a) * R0);
      ctx.lineTo(Math.cos(a) * (R0 - l), Math.sin(a) * (R0 - l));
    }
    ctx.stroke();
    if (k === 2) {
      for (let i = 0; i < 6 * d; i++) {
        const a = (i / 6) * Math.PI * 2;
        hexPath(ctx, Math.cos(a) * R0, Math.sin(a) * R0, 14, a);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
  // dashed outer arc
  ctx.setLineDash([18, 14]);
  ctx.lineDashOffset = -f.t * 60;
  ctx.strokeStyle = rgba(accent, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.14, -Math.PI * 0.85, -Math.PI * 0.85 + Math.PI * 1.3 * clamp(draw));
  ctx.stroke();
  ctx.setLineDash([]);
  // inner triangle sigil
  ctx.rotate(-f.t * 0.3 * spin);
  ctx.strokeStyle = gold ? C.gold : color;
  ctx.lineWidth = 2;
  const d3 = clamp(draw * 1.6 - 0.6);
  if (d3 > 0) {
    starPath(ctx, 0, 0, r * 0.42 * d3, r * 0.2 * d3, 3);
    ctx.stroke();
    starPath(ctx, 0, 0, r * 0.42 * d3, r * 0.2 * d3, 3, Math.PI / 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ logo
const LOGO_PATHS = [
  'M8 233 70 37 51 2H129L192 129 235 2H306L235 213H166L112 111 79 207Z',
  'M312 2H389L433 73 514 2H596L476 111 527 213H447L408 145 329 213H248L366 105Z',
  'M609 2H809L790 60H725L675 213H598L648 60H546Z',
];
// Angular "5" in the same italic slant as the NXT outline (slant ~0.24 px/px).
const FIVE = (() => {
  const s = 0.24;
  const pts = [[0, 0], [205, 0], [205, 56], [74, 56], [74, 84], [176, 84], [208, 113], [208, 184], [176, 213], [0, 213], [0, 160], [132, 160], [132, 137], [0, 137]];
  return 'M' + pts.map(([u, y]) => `${(808 + u + s * (213 - y)).toFixed(1)} ${y + 2}`).join('L') + 'Z';
})();
export const LOGO_W = 1080;
export const LOGO_H = 236;
let logoPath2D = null;
function logoPaths() {
  if (!logoPath2D) {
    const { Path2D } = globalThis.__canvasMod;
    logoPath2D = [...LOGO_PATHS, FIVE].map((d) => new Path2D(d));
  }
  return logoPath2D;
}

/**
 * NXT5 logo (outline "NXT" from the home hero + matching angular "5"), centered at x,y, `w` px wide.
 * opts: draw 0..1 (stroke draw-on), fill 0..1 (gradient fill opacity), glow, lineWidth.
 */
export function logo(ctx, x, y, w, opts = {}) {
  const { draw = 1, fill = 0, glow = 30, lineWidth = 3, alpha = 1, fiveFill = 1 } = opts;
  const paths = logoPaths();
  const s = w / LOGO_W;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x - (LOGO_W * s) / 2, y - (LOGO_H * s) / 2);
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, LOGO_H, LOGO_W, 0);
  g.addColorStop(0, C.cyan);
  g.addColorStop(0.3, '#dbeafe');
  g.addColorStop(0.52, C.violet2);
  g.addColorStop(0.76, C.text);
  g.addColorStop(1, C.fuchsia);
  if (fill > 0) {
    ctx.save();
    ctx.globalAlpha *= fill;
    ctx.shadowColor = rgba(C.cyan2, 0.6);
    ctx.shadowBlur = glow / s;
    const fg = linearSpectrum(ctx, 0, 0, LOGO_W, LOGO_H);
    ctx.fillStyle = fg;
    paths.forEach((p, i) => {
      if (i < 3) ctx.fill(p);
    });
    ctx.globalAlpha = alpha * fill * fiveFill;
    ctx.fillStyle = C.text;
    ctx.fill(paths[3]);
    ctx.restore();
  }
  ctx.strokeStyle = g;
  ctx.lineWidth = lineWidth / s;
  ctx.lineJoin = 'miter';
  ctx.shadowColor = rgba(C.cyan2, 0.7);
  ctx.shadowBlur = glow / s;
  if (draw < 1) {
    ctx.setLineDash([2400 * draw, 2400]);
  }
  paths.forEach((p) => ctx.stroke(p));
  ctx.restore();
}

// ------------------------------------------------------------------ icons (line icons drawn from primitives)
export function icon(ctx, kind, x, y, s, opts = {}) {
  const { color = C.cyan, lw = 4, p = 1 } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  const e = clamp(p);
  switch (kind) {
    case 'graph': {
      [[-36, 30], [-12, 55], [12, 38], [36, 75]].forEach(([bx, bh]) => {
        ctx.fillRect(bx - 8, 40 - bh * e, 16, bh * e);
      });
      ctx.beginPath();
      ctx.moveTo(-46, 44);
      ctx.lineTo(46, 44);
      ctx.stroke();
      break;
    }
    case 'clipboard': {
      roundRect(ctx, -34, -40, 68, 86, 8);
      ctx.stroke();
      ctx.fillRect(-14, -48, 28, 14);
      for (let i = 0; i < 3; i++) {
        const lw2 = 40 * clamp(e * 3 - i);
        ctx.beginPath();
        ctx.moveTo(-20, -14 + i * 20);
        ctx.lineTo(-20 + lw2, -14 + i * 20);
        ctx.stroke();
      }
      break;
    }
    case 'calendar': {
      roundRect(ctx, -42, -36, 84, 78, 8);
      ctx.stroke();
      ctx.fillRect(-42, -36, 84, 16);
      for (let i = 0; i < 6 * e; i++) ctx.fillRect(-30 + (i % 3) * 22, -6 + Math.floor(i / 3) * 22, 14, 12);
      break;
    }
    case 'chat': {
      roundRect(ctx, -44, -34, 88, 58, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-20, 24);
      ctx.lineTo(-30, 42);
      ctx.lineTo(0, 24);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-20 + i * 20, -5, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'window': {
      roundRect(ctx, -46, -36, 92, 72, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-46, -20);
      ctx.lineTo(46, -20);
      ctx.stroke();
      ctx.fillRect(-32, 10, 64 * e, 10);
      ctx.strokeRect(-32, 10, 64, 10);
      break;
    }
    case 'hex': {
      hexPath(ctx, 0, 0, 42);
      ctx.stroke();
      hexPath(ctx, 0, 0, 22 * e);
      ctx.fill();
      break;
    }
    case 'users': {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * 30, -14, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(i * 30, 30, 22, Math.PI, 0);
        ctx.stroke();
      }
      break;
    }
    case 'sword': {
      ctx.beginPath();
      ctx.moveTo(-34, 34);
      ctx.lineTo(30, -30);
      ctx.lineTo(38, -38);
      ctx.moveTo(-40, 16);
      ctx.lineTo(-16, 40);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ text cards from script.json
/**
 * Draws the script cards that are active at local time `f.lt`.
 * card: { bar, beat, durBeats, text, emph, sub, style } with absolute bar/beat timing.
 * opts: x, y, size, subSize, maxW, styleOverride. Styles: slam | jagged | type | calm | stamp | giant | stack.
 */
export function renderCards(ctx, f, cards, opts = {}) {
  const { x = W / 2, y = H / 2, size = 150, subSize = 54, maxW = W * 0.86, emphColor = null, skip = null } = opts;
  for (const [i, c] of cards.entries()) {
    const t0 = f.at(c.bar, c.beat);
    const d = c.durBeats * BEAT;
    const lt = f.lt - t0;
    if (lt < 0 || lt > d) continue;
    if (c.sceneDrawn || (skip && skip(c, i))) continue;
    const pIn = lt / Math.min(d, BEAT * 1.0);
    const out = seg(lt, d - BEAT * 0.25, d); // quick exit
    const style = opts.styleOverride || c.style;
    ctx.save();
    ctx.globalAlpha *= 1 - E.inQuad(out);
    const cy = c.sub ? y - subSize * 0.7 : y;
    let sz = style === 'giant' ? size * 1.5 : style === 'calm' ? size * 0.62 : size;
    sz = fitSize(ctx, c.text, maxW, sz, style === 'calm' ? (px) => F.display(px, 900) : F.anton);
    switch (style) {
      case 'jagged':
        jaggedText(ctx, c.text, x, cy, { size: sz * 0.82, p: clamp(lt / (BEAT * 1.2)), seed: 13 + i, emph: c.emph });
        break;
      case 'type':
        typeText(ctx, c.text, x, cy, { p: clamp(lt / Math.min(d * 0.7, BEAT * 3)), size: sz * 0.45, align: 'center', t: f.t, emph: c.emph, font: (px) => F.inter(px, 800) });
        break;
      case 'calm': {
        const e = E.brand(clamp(pIn));
        ctx.globalAlpha *= e;
        text(ctx, c.text, x, cy + (1 - e) * 30, { size: sz, font: (px) => F.display(px, 900), emph: c.emph, emphColor, glow: 20 });
        break;
      }
      case 'stamp':
        stamp(ctx, c.text, x, cy, { size: sz * 0.6, p: clamp(lt / (BEAT * 0.5)), color: c.color || C.fuchsia2 });
        break;
      case 'stack': {
        const words = c.text.split(' ');
        const ls = sz * 0.9;
        words.forEach((wd, k) => {
          const wp = clamp((lt - k * BEAT * 0.5) / (BEAT * 0.5));
          if (wp <= 0) return;
          slamText(ctx, wd, x, cy + (k - (words.length - 1) / 2) * ls, { size: ls * 0.92, p: wp, emph: c.emph.split(' ').includes(wd) ? wd : '' });
        });
        break;
      }
      case 'giant':
      case 'slam':
      default:
        slamText(ctx, c.text, x, cy, { size: sz, p: clamp(pIn * 1.4), emph: c.emph, emphColor });
        break;
    }
    if (c.sub) {
      const sp = E.outCubic(seg(lt, BEAT * 0.4, BEAT * 1.2));
      const sy = cy + sz * (style === 'calm' ? 0.75 : 0.72) + subSize * 0.4;
      ctx.globalAlpha *= sp;
      const sw = measure(ctx, c.sub, subSize, (px) => F.inter(px, 700));
      ctx.fillStyle = rgba(C.ink, 0.65);
      ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, (sw + 48) * sp, subSize * 1.6);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, 6, subSize * 1.6);
      text(ctx, c.sub, x, sy, { size: subSize, font: (px) => F.inter(px, 700), color: C.text2 });
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ real NXT5 UI screenshots (assets/ui)
const UI_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'ui');
const uiCache = new Map();
/** Decodes every assets/ui/*.png once (await before drawing; decoding is asynchronous). */
export async function preloadUI() {
  const { loadImage } = globalThis.__canvasMod;
  let files = [];
  try {
    files = readdirSync(UI_DIR).filter((f) => f.endsWith('.png'));
  } catch {
    return;
  }
  await Promise.all(files.map(async (f) => uiCache.set(f, await loadImage(readFileSync(path.join(UI_DIR, f))))));
}
/** A preloaded assets/ui/<name> image, or null. */
export function uiImage(name) {
  return uiCache.get(name) || null;
}

/**
 * A real screenshot shown as a floating 2.5D glass screen.
 * x, y = center; w = width (height follows the image ratio unless opts.h; crop with opts.src [sx,sy,sw,sh]).
 * opts: tilt (rad), skew (-0.3..0.3 fake perspective), p (0..1 reveal: scanline wipe from top), scroll (0..1 pans a tall image),
 * glow, alpha, frame (accent color), glare (0..1 light sweep position).
 */
export function screen(ctx, name, x, y, w, opts = {}) {
  const img = uiImage(name);
  const { tilt = 0, skew = 0, p = 1, glow = 1, alpha = 1, frame = C.cyan, glare = -1, scroll = 0, src = null, r = 18 } = opts;
  const [sx0, sy0, sw0, sh0] = src || (img ? [0, 0, img.width, img.height] : [0, 0, 16, 9]);
  const h = opts.h || (w * sh0) / sw0;
  const visH = opts.h ? (sw0 * h) / w : sh0;
  const sy = sy0 + Math.max(0, sh0 - visH) * clamp(scroll);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.transform(1, skew * 0.25, 0, 1, 0, 0);
  const e = E.outExpo(clamp(p));
  ctx.shadowColor = rgba(frame, 0.55 * glow);
  ctx.shadowBlur = 60 * glow;
  ctx.fillStyle = C.ink;
  roundRect(ctx, -w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h * e, r);
  ctx.clip();
  if (img) ctx.drawImage(img, sx0, sy, sw0, Math.min(visH, sh0), -w / 2, -h / 2, w, h);
  else {
    ctx.fillStyle = C.surface;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    text(ctx, `missing ${name}`, 0, 0, { size: 30, font: (px) => F.inter(px, 700) });
  }
  if (glare >= 0) {
    const gx = -w / 2 + glare * w * 1.6 - w * 0.3;
    const g = ctx.createLinearGradient(gx - 160, 0, gx + 160, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
  if (e < 1) {
    ctx.fillStyle = frame;
    ctx.shadowColor = frame;
    ctx.shadowBlur = 20;
    ctx.fillRect(-w / 2, -h / 2 + h * e - 2, w, 4);
    ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = rgba(frame, 0.85);
  ctx.lineWidth = 3;
  roundRect(ctx, -w / 2, -h / 2, w, h, r);
  ctx.stroke();
  ctx.restore();
  return h;
}

/** Offscreen canvas helper (reuse across frames by key). */
const pool = new Map();
export function offscreen(key, w = W, h = H) {
  let c = pool.get(key);
  if (!c || c.width !== w || c.height !== h) {
    c = createCanvas(w, h);
    pool.set(key, c);
  }
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  return [c, ctx];
}
