// Helpers for S04 (owned by S04 only): 2.5D perspective glass screens built from real UI crops,
// cached dot patterns, P5 plates and pills. Bitmaps are static caches; drawing is pure.
import { createCanvas } from '@napi-rs/canvas';

const bmpCache = new Map();

/**
 * Builds (once) a bitmap from stacked crops of assets/ui screenshots.
 * parts: [{ file, src: [sx, sy, sw, sh], gap? }] — all crops share the width of the first one (scaled to fit).
 * w: display width in px. Returns { c, w, h, s, map(file-space x, y, partIndex) -> bitmap px }.
 */
export function screenBitmap(K, key, parts, w, opts = {}) {
  if (bmpCache.has(key)) return bmpCache.get(key);
  const { pad = 0, bg = '#151c30' } = opts;
  const s = (w - pad * 2) / parts[0].src[2];
  const offs = [];
  let h = pad;
  parts.forEach((p, i) => {
    if (i) h += (p.gap || 0) * s;
    offs.push(h);
    h += p.src[3] * s;
  });
  h += pad;
  const W2 = Math.round(w);
  const H2 = Math.round(h);
  const c = createCanvas(W2, H2);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.fillStyle = bg;
  x.fillRect(0, 0, W2, H2);
  parts.forEach((p, i) => {
    const img = K.uiImage(p.file);
    const [sx, sy, sw, sh] = p.src;
    const dx = pad + (p.dx || 0) * s;
    if (img) x.drawImage(img, sx, sy, sw, sh, dx, offs[i], sw * s, sh * s);
  });
  const out = {
    c, w: W2, h: H2, s,
    /** source-image pixel (of part i) -> bitmap pixel */
    map: (px, py, i = 0) => [pad + ((parts[i].dx || 0) + px - parts[i].src[0]) * s, offs[i] + (py - parts[i].src[1]) * s],
  };
  bmpCache.set(key, out);
  return out;
}

/** Projection of a bitmap point (bx, by) for a screen centred at cx, cy (see drawScreen). */
export function project(o, bx, by) {
  const { cx, cy, w, h, rotY = 0, roll = 0, scale = 1, focal = 2000 } = o;
  const u = bx - w / 2;
  const v = by - h / 2;
  const X = u * Math.cos(rotY);
  const Z = u * Math.sin(rotY);
  const k = focal / (focal + Z);
  const x = X * k * scale;
  const y = v * k * scale;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  return [cx + x * cr - y * sr, cy + x * sr + y * cr, k * scale];
}

/** The 4 projected corners (TL, TR, BR, BL). */
export function corners(o) {
  return [project(o, 0, 0), project(o, o.w, 0), project(o, o.w, o.h), project(o, 0, o.h)];
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/**
 * Draws a bitmap as a 2.5D glass screen rotated around its vertical axis (true perspective via strips).
 * o: { cx, cy, w, h (display size at scale 1), rotY, roll, scale, alpha, reveal (0..1 wipe from top),
 *      glare (-1 or 0..1), frame (accent colour), shadow (0..1), glow (0..1) }
 */
export function drawScreen(ctx, K, bmp, o) {
  const { C, rgba, clamp } = K;
  const { w, h, rotY = 0, roll = 0, scale = 1, alpha = 1, reveal = 1, glare = -1, frame = C.cyan, shadow = 1, glow = 0.6, strips = 44 } = o;
  if (alpha <= 0.002 || scale <= 0.01) return;
  const cs = corners(o);
  ctx.save();
  ctx.globalAlpha *= alpha;
  // hard P5 drop shadow
  if (shadow > 0) {
    ctx.save();
    ctx.translate(18 * scale, 20 * scale);
    polyPath(ctx, cs);
    ctx.fillStyle = rgba(C.ink, 0.55 * shadow);
    ctx.fill();
    ctx.restore();
  }
  // cheap halo (no shadowBlur): wide translucent strokes
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    polyPath(ctx, cs);
    for (const [lw, a] of [[34, 0.05], [18, 0.08], [8, 0.12]]) {
      ctx.lineWidth = lw * scale;
      ctx.strokeStyle = rgba(frame, a * glow);
      ctx.stroke();
    }
    ctx.restore();
  }
  // strips (perspective), wiped from the top by `reveal`
  const rv = clamp(reveal);
  ctx.save();
  polyPath(ctx, cs);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(o.cx, o.cy);
  ctx.rotate(roll);
  const focal = o.focal || 2000;
  const sw = bmp.c.width / strips;
  for (let i = 0; i < strips; i++) {
    const u0 = (i / strips) * w - w / 2;
    const u1 = ((i + 1) / strips) * w - w / 2;
    const k0 = focal / (focal + u0 * Math.sin(rotY));
    const k1 = focal / (focal + u1 * Math.sin(rotY));
    const x0 = u0 * Math.cos(rotY) * k0 * scale;
    const x1 = u1 * Math.cos(rotY) * k1 * scale;
    const km = (k0 + k1) / 2;
    const hh = h * km * scale;
    if (rv < 1) {
      ctx.drawImage(bmp.c, i * sw, 0, sw, bmp.c.height * rv, x0, -hh / 2, x1 - x0 + 0.8, hh * rv);
    } else ctx.drawImage(bmp.c, i * sw, 0, sw, bmp.c.height, x0, -hh / 2, x1 - x0 + 0.8, hh);
  }
  ctx.restore();
  // scan line of the wipe
  if (rv < 1) {
    const a = project(o, 0, h * rv);
    const b = project(o, w, h * rv);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = frame;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = rgba(frame, 0.25);
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.restore();
  }
  // glare sweep
  if (glare >= 0 && glare <= 1) {
    ctx.save();
    polyPath(ctx, cs);
    ctx.clip();
    const gx = -0.3 + glare * 1.6;
    const p0 = project(o, w * (gx - 0.12), 0);
    const p1 = project(o, w * (gx + 0.12), 0);
    const g = ctx.createLinearGradient(p0[0], p0[1] - 200, p1[0], p1[1] + 200);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.13)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.restore();
  }
  // frame
  polyPath(ctx, cs);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(frame, 0.9);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ dot patterns
const patCache = new Map();
/** Cached 16 px dot tile pattern with dot radius r (quantised to 0.5 px). */
export function dotPattern(ctx, color, r, pitch = 16) {
  const rq = Math.max(0.5, Math.round(r * 2) / 2);
  const key = `${color}|${rq}|${pitch}`;
  let tile = patCache.get(key);
  if (!tile) {
    tile = createCanvas(pitch, pitch);
    const x = tile.getContext('2d');
    x.fillStyle = color;
    x.beginPath();
    x.arc(pitch / 2, pitch / 2, rq, 0, Math.PI * 2);
    x.fill();
    patCache.set(key, tile);
  }
  return ctx.createPattern(tile, 'repeat');
}

/**
 * Halftone dot lattice rotated by -atan(1/3) (≈ -18.4°) with a 15.8 px pitch: with basis (15,-5) and (5,15)
 * the lattice is exactly periodic every 50 px on both axes, so a cached 400 px tile can be blitted
 * axis-aligned (drawImage is ~6x cheaper than a rotated pattern fill). Radius quantised to 0.5 px.
 */
const tileCache = new Map();
export function dotTile(color, r) {
  const rq = Math.max(0.5, Math.round(r * 2) / 2);
  const key = `${color}|${rq}`;
  let t = tileCache.get(key);
  if (!t) {
    t = createCanvas(400, 400);
    const x = t.getContext('2d');
    x.fillStyle = color;
    x.beginPath();
    for (let a = -40; a < 40; a++) {
      for (let b = -40; b < 40; b++) {
        const px = a * 15 + b * 5;
        const py = -a * 5 + b * 15;
        if (px < -10 || py < -10 || px > 410 || py > 410) continue;
        x.moveTo(px + rq, py);
        x.arc(px, py, rq, 0, Math.PI * 2);
      }
    }
    x.fill();
    tileCache.set(key, t);
  }
  return t;
}
/** Blits a dot tile over the frame (call inside a clip), shifted by (ox, oy). */
export function drawDots(ctx, tile, ox = 0, oy = 0, alpha = 1) {
  const sx = ((ox % 50) + 50) % 50 - 50;
  const sy = ((oy % 50) + 50) % 50 - 50;
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let y = sy; y < 1080; y += 400) for (let x = sx; x < 1920; x += 400) ctx.drawImage(tile, x, y);
  ctx.restore();
}

// ------------------------------------------------------------------ plates & pills
/** P5 ink parallelogram plate (slanted sides at 18°). */
export function plate(ctx, K, x0, y0, x1, y1, opts = {}) {
  const { C, rgba } = K;
  const { alpha = 0.85, p = 1, edge = C.cyan, edge2 = C.fuchsia2 } = opts;
  if (p <= 0.02) return;
  const off = (y1 - y0) * Math.tan((18 * Math.PI) / 180);
  const xr = x0 + (x1 - x0) * p;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0 + off, y0);
  ctx.lineTo(xr + off, y0);
  ctx.lineTo(xr, y1);
  ctx.lineTo(x0, y1);
  ctx.closePath();
  ctx.fillStyle = rgba(C.ink, alpha);
  ctx.fill();
  ctx.fillStyle = edge;
  ctx.fillRect(x0 + off - 2, y0 - 2, (xr - x0) * 0.55, 4);
  ctx.fillStyle = edge2;
  ctx.fillRect(x0 + (xr - x0) * 0.45, y1 - 2, (xr - x0) * 0.55, 4);
  ctx.restore();
}

/** Sub pill matching K.renderCards (ink 65 %, cyan bar, Inter 700). */
export function subPill(ctx, K, str, x, y, sp, size = 54) {
  const { C, rgba } = K;
  if (sp <= 0) return;
  ctx.save();
  ctx.globalAlpha *= sp;
  const sw = K.measure(ctx, str, size, (px) => K.F.inter(px, 700));
  ctx.fillStyle = rgba(C.ink, 0.72);
  ctx.fillRect(x - sw / 2 - 24, y - size * 0.8, (sw + 48) * sp, size * 1.6);
  ctx.fillStyle = C.cyan;
  ctx.fillRect(x - sw / 2 - 24, y - size * 0.8, 6, size * 1.6);
  K.text(ctx, str, x, y, { size, font: (px) => K.F.inter(px, 700), color: C.text2 });
  ctx.restore();
}

/** Cheap ring burst (no shadowBlur). */
export function ringBurst(ctx, K, x, y, p, opts = {}) {
  const { C, rgba, E } = K;
  const { color = C.cyan, maxR = 80, width = 6 } = opts;
  if (p <= 0 || p >= 1) return;
  const r = maxR * E.outCubic(p);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.9 * (1 - p));
  ctx.lineWidth = width * (1 - p) + 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, 0.25 * (1 - p));
  ctx.lineWidth = width * 3 * (1 - p) + 2;
  ctx.stroke();
  ctx.restore();
}
