// Shared helpers for S09 and S10 (drop 2): all-out-attack bands, brand bug, caption bands, sparks,
// silhouettes and French typography fixes. Every function is a pure function of its arguments;
// the only module state is a cache of static bitmaps built once.

const W = 1920;
const H = 1080;
export const BEAT = 0.4;
export const S16 = BEAT / 4;

// ------------------------------------------------------------------ cache of static bitmaps
const cache = new Map();
export function cached(key, w, h, paint) {
  let c = cache.get(key);
  if (!c) {
    c = globalThis.__canvasMod.createCanvas(Math.ceil(w), Math.ceil(h));
    paint(c.getContext('2d'), c);
    cache.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------------ French typography
/** Puts a no-break space before ? ! : ; (the script uses plain spaces). */
export const fixFr = (s) => (s ? s.replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') : s);
const fixedCards = new WeakMap();
export function frCards(cards) {
  if (!cards) return [];
  let out = fixedCards.get(cards);
  if (!out) {
    out = cards.map((c) => ({ ...c, text: fixFr(c.text), sub: fixFr(c.sub), emph: fixFr(c.emph) }));
    fixedCards.set(cards, out);
  }
  return out;
}

// ------------------------------------------------------------------ always-on layers
export function baseLayers(ctx, f, K, { particles = 1 } = {}) {
  K.background(ctx, f, { intensity: 0.9 });
  if (particles > 0) {
    K.particles(ctx, f, { count: 70, size: 1.6, speed: 0.6, seed: 31, alpha: 0.55 * particles });
    K.particles(ctx, f, { count: 36, size: 2.6, speed: 1.3, seed: 37, alpha: 0.6 * particles });
    K.particles(ctx, f, { count: 14, size: 4.2, speed: 2.2, seed: 41, alpha: 0.45 * particles });
  }
}
/** Small NXT5 logo at the top-right corner (always on from bar 4 to bar 44). */
export function brandBug(ctx, K, alpha = 1) {
  K.logo(ctx, 1772, 62, 150, { alpha: 0.55 * alpha, glow: 6, lineWidth: 2.4 });
}

// ------------------------------------------------------------------ all-out-attack bands
const BAND_A = (-18 * Math.PI) / 180;
const BAND_LEN = 2240; // longer than the frame's extent along the band axis
const PERIOD = 480; // dot pattern period along the axis (multiple of the 16 px spacing and of the 40 px step)
// three parallel slots (offset from the frame centre along the normal, width); covers ~39 % of the frame
export const BAND_SLOTS = [
  { d: -430, w: 300 },
  { d: -150, w: 160 },
  { d: 430, w: 80 },
];
function bandDots(K, w, big, slot) {
  return cached(`band-${w}-${big}`, BAND_LEN + PERIOD, w, (x) => {
    const s = 16;
    x.fillStyle = K.C.ink;
    x.beginPath();
    let n = 0;
    for (let j = 0; j * s < w; j++) {
      const v = (j * s + s / 2) / w;
      const prof = slot % 2 ? 0.25 + 0.75 * v ** 1.3 : 0.25 + 0.75 * (1 - v) ** 1.3;
      for (let i = -1; i * s < BAND_LEN + PERIOD + s; i++) {
        const u = i * s + (j % 2 ? s / 2 : 0);
        const ph = (2 * Math.PI * u) / PERIOD;
        const mod = 0.55 + 0.28 * Math.sin(ph) + 0.17 * Math.sin(3 * ph + 1.3);
        const r = s * 0.47 * prof * mod * (big ? 1.35 : 1);
        if (r < 0.6) continue;
        x.moveTo(u + r, j * s + s / 2);
        x.arc(u, j * s + s / 2, Math.min(r, s * 0.62), 0, Math.PI * 2);
        if (++n % 80 === 0) {
          x.fill();
          x.beginPath();
        }
      }
    }
    x.fill();
  });
}

/**
 * Three −18° colour bands with ink halftone dots.
 * opts: shift (px along the axis, already stepped by the caller), order (colour rotation index),
 * alpha, pulse (0..1 dot swell on snares), streak (0..1 position of the spectrum streak on the top band, <0 = none).
 */
export function bands(ctx, K, opts = {}) {
  const { shift = 0, order = 0, alpha = 0.7, pulse = 0, streak = -1, streakAlpha = 1 } = opts;
  const cols = [K.C.fuchsia2, K.C.cyan2, K.C.violet];
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(BAND_A);
  BAND_SLOTS.forEach((sl, k) => {
    const col = cols[(k + order) % 3];
    const dir = k === 1 ? -1 : 1;
    const off = (((shift * dir) % PERIOD) + PERIOD) % PERIOD;
    const y0 = sl.d - sl.w / 2;
    // snare pulse: the colour field flares and the ink dots thicken (dots drawn slightly stronger)
    ctx.globalAlpha = Math.min(1, alpha * (1 + 0.3 * pulse));
    ctx.fillStyle = col;
    ctx.fillRect(-BAND_LEN / 2, y0, BAND_LEN, sl.w);
    ctx.globalAlpha = Math.min(1, alpha * (1 + 0.4 * pulse));
    ctx.drawImage(bandDots(K, sl.w, pulse > 0.5, k), off, 0, BAND_LEN, sl.w, -BAND_LEN / 2, y0, BAND_LEN, sl.w);
    // crisp ink edges
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = K.C.ink;
    ctx.fillRect(-BAND_LEN / 2, y0 - 3, BAND_LEN, 3);
    ctx.fillRect(-BAND_LEN / 2, y0 + sl.w, BAND_LEN, 3);
  });
  if (streak >= 0 && streak <= 1) {
    const sl = BAND_SLOTS[0];
    const len = 760;
    const x = -BAND_LEN / 2 - len + streak * (BAND_LEN + len * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 * streakAlpha;
    const g = ctx.createLinearGradient(x - len, 0, x, 0);
    g.addColorStop(0, 'rgba(34,211,238,0)');
    g.addColorStop(0.45, K.rgba(K.C.cyan2, 0.5));
    g.addColorStop(0.75, K.rgba(K.C.violet, 0.8));
    g.addColorStop(0.97, K.rgba(K.C.fuchsia, 1));
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(x - len, sl.d - sl.w * 0.16, len, sl.w * 0.32);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x - len * 0.35, sl.d - 2, len * 0.35, 4);
  }
  ctx.restore();
}

/** Thin white edge glow (brass stabs): not a full-frame flash. */
export function edgeGlow(ctx, a) {
  if (a < 0.01) return;
  ctx.save();
  const d = 150;
  const sides = [
    [0, 0, W, d, 0, 0, 0, d],
    [0, H - d, W, d, 0, H, 0, H - d],
    [0, 0, d, H, 0, 0, d, 0],
    [W - d, 0, d, H, W, 0, W - d, 0],
  ];
  for (const [x, y, w, h, gx0, gy0, gx1, gy1] of sides) {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, `rgba(255,255,255,${0.12 * a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** Radial halftone burst: concentric rings of dots expanding from (x, y). p 0..1. */
export function halftoneBurst(ctx, K, x, y, p, color, maxR = 900) {
  if (p <= 0 || p >= 1) return;
  const e = K.E.outCubic(p);
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85 * (1 - p);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const r = e * maxR - k * 30;
    if (r < 20) continue;
    const dotR = (8 - k * 1.5) * (1 - p * 0.5);
    const n = Math.floor((2 * Math.PI * r) / 40);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.17;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      ctx.moveTo(px + dotR, py);
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

/** Thin white slash (snare): a tapering line that draws across part of the frame. p 0..1, seed picks the place. */
export function whiteSlash(ctx, K, p, seed) {
  if (p <= 0 || p >= 1) return;
  const R = K.rng(seed * 7 + 3);
  const cx = 300 + R() * 1320;
  const cy = 200 + R() * 680;
  const ang = 1.05 + (R() - 0.5) * 0.4;
  const len = 1100;
  const grow = K.E.outExpo(K.clamp(p * 3));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.globalAlpha = 1 - K.E.inQuad(p);
  ctx.fillStyle = '#ffffff';
  const l = len * grow;
  ctx.beginPath();
  ctx.moveTo(-l / 2, 0);
  ctx.lineTo(0, -2.2);
  ctx.lineTo(l / 2, 0);
  ctx.lineTo(0, 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Spectrum spark burst. p 0..1 over `life` seconds; 30 sparks by default. */
export function sparkBurst(ctx, K, x, y, age, seed, { n = 30, life = 0.6, speed = 1, spread = Math.PI * 2, dir = 0 } = {}) {
  if (age < 0 || age > life) return;
  const R = K.rng(seed);
  const cols = [K.C.cyan, K.C.cyan2, K.C.indigo, K.C.violet2, K.C.fuchsia, '#ffffff'];
  const q = age / life;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = dir + (R() - 0.5) * spread;
    const v = (500 + R() * 1100) * speed;
    const vx = Math.cos(a) * v;
    const vy = Math.sin(a) * v;
    const drag = 1 - Math.exp(-age * 4);
    const px = x + (vx / 4) * drag;
    const py = y + (vy / 4) * drag + 500 * age * age;
    const tail = 0.05 + R() * 0.04;
    const tx = px - vx * tail * (1 - q);
    const ty = py - vy * tail * (1 - q);
    ctx.strokeStyle = K.rgba(cols[i % cols.length], 1 - q);
    ctx.lineWidth = (2 + R() * 3) * (1 - q * 0.6);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ caption band behind lower-third / centre cards
/** Ink parallelogram behind a card. a: alpha 0..1, p: wipe-in 0..1. */
export function captionBand(ctx, K, cx, y0, y1, w, a, p = 1, angle = 0) {
  if (a <= 0.01) return;
  const e = K.E.outExpo(K.clamp(p));
  const sk = (y1 - y0) * 0.33;
  const hw = (w / 2) * e;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, (y0 + y1) / 2);
  ctx.rotate(angle);
  const h = (y1 - y0) / 2;
  ctx.fillStyle = K.rgba(K.C.ink, 0.78);
  ctx.beginPath();
  ctx.moveTo(-hw + sk / 2, -h);
  ctx.lineTo(hw + sk / 2, -h);
  ctx.lineTo(hw - sk / 2, h);
  ctx.lineTo(-hw - sk / 2, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = K.linearSpectrum(ctx, -hw, 0, hw, 0);
  ctx.fillRect(-hw + sk / 2, -h - 4, hw * 2, 4);
  ctx.fillStyle = K.rgba(K.C.cyan2, 0.7);
  ctx.fillRect(-hw - sk / 2, h, hw * 1.2, 3);
  ctx.restore();
}

/** Visibility of a card (0..1) at local time lt, matching renderCards' quick exit. */
export function cardAlpha(f, K, c, inDur = 0.06) {
  const t0 = f.at(c.bar, c.beat);
  const d = c.durBeats * BEAT;
  const lt = f.lt - t0;
  if (lt < 0 || lt > d) return 0;
  return K.clamp(lt / inDur) * (1 - K.E.inQuad(K.seg(lt, d - BEAT * 0.25, d)));
}

/** Sub pill identical to renderCards' (for scene-drawn cards). */
export function subPill(ctx, K, sub, x, sy, sp, subSize = 54) {
  if (sp <= 0) return;
  ctx.save();
  ctx.globalAlpha *= sp;
  const sw = K.measure(ctx, sub, subSize, (px) => K.F.inter(px, 700));
  ctx.fillStyle = K.rgba(K.C.ink, 0.65);
  ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, (sw + 48) * sp, subSize * 1.6);
  ctx.fillStyle = K.C.cyan;
  ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, 6, subSize * 1.6);
  K.text(ctx, sub, x, sy, { size: subSize, font: (px) => K.F.inter(px, 700), color: K.C.text2 });
  ctx.restore();
}

// ------------------------------------------------------------------ player silhouettes (5 role heroes)
// Angles: 0 = limb pointing down, +pi/2 = pointing to screen-right, pi = up. Pairs are [root, bend].
// Victory poses, one per role (index = TOP, JGL, MID, ADC, SUP).
export const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
export const POSES = [
  { lean: 0, aL: [-2.5, -0.3], aR: [2.5, 0.3], lL: [-0.36, 0.12], lR: [0.36, -0.12] }, // TOP: broad V
  { lean: 0.16, aL: [-0.95, 1.75], aR: [2.75, 0.3], lL: [-0.85, 1.25], lR: [0.85, -1.25] }, // JGL: crouched fist pump
  { lean: 0, aL: [-2.05, -0.15], aR: [2.05, 0.15], lL: [-0.5, 0.05], lR: [0.5, -0.05] }, // MID: slender star jump
  { lean: -0.04, aL: [-1.68, -0.04], aR: [1.25, -2.35], lL: [-0.42, 0.1], lR: [0.3, -0.05] }, // ADC: bow drawn
  { lean: 0.03, aL: [-2.75, 0.35], aR: [0.55, 0.1], lL: [-0.3, 0.06], lR: [0.26, -0.04] }, // SUP: staff planted, cheer
];
export const LEAP = { lean: 0.55, aL: [-0.95, -0.35], aR: [2.3, 0.12], lL: [-0.62, -0.25], lR: [1.55, -1.85] }; // fist forward, trailing leg
export function lerpPose(a, b, t) {
  const L = (x, y) => x + (y - x) * t;
  const P = (x, y) => [L(x[0], y[0]), L(x[1], y[1])];
  return { lean: L(a.lean, b.lean), aL: P(a.aL, b.aL), aR: P(a.aR, b.aR), lL: P(a.lL, b.lL), lR: P(a.lR, b.lR) };
}
// role builds: shoulder width, limb thickness, shoulder-plate size, scarf length, head piece, prop
const BUILD = {
  TOP: { sw: 1.28, limb: 1.32, pad: 1.5, scarf: 0.8, head: 'crest', r: 18 },
  JGL: { sw: 1.05, limb: 1.08, pad: 1.0, scarf: 0.95, head: 'hood', r: 17 },
  MID: { sw: 0.8, limb: 0.76, pad: 0.72, scarf: 1.5, head: 'tail', r: 16 },
  ADC: { sw: 0.94, limb: 0.9, pad: 0.88, scarf: 1.0, head: 'band', r: 16.5, prop: 'bow' },
  SUP: { sw: 1.0, limb: 1.0, pad: 1.12, scarf: 1.15, head: 'none', r: 17, prop: 'staff' },
};
const FIG_H = 206; // standing height in pose units
const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a;
};
/** Tapered streamer (scarf tail, ponytail) from `a` along unit dir `d`, waving across its length. */
function streamer(a, d, len, w0, w1, wave, phase) {
  const n = [-d[1], d[0]];
  const L = [];
  const R = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    const o = Math.sin(u * 4.2 + phase) * wave * u;
    const c = [a[0] + d[0] * len * u + n[0] * o, a[1] + d[1] * len * u + n[1] * o];
    const w = w0 + (w1 - w0) * u;
    L.push([c[0] + n[0] * w, c[1] + n[1] * w]);
    R.push([c[0] - n[0] * w, c[1] - n[1] * w]);
  }
  return L.concat(R.reverse());
}
/**
 * Geometry of one hero in pose units (hips at the origin, y down). wind: local direction the scarf trails to
 * (unit vector), t: seconds (flutter phase).
 */
function figureGeom(pose, role, wind, t) {
  const B = BUILD[role] || BUILD.MID;
  const up = [Math.sin(pose.lean), -Math.cos(pose.lean)];
  const side = [Math.cos(pose.lean), Math.sin(pose.lean)];
  const P = (s, u) => [side[0] * s + up[0] * u, side[1] * s + up[1] * u];
  const polys = [];
  const circles = [];
  const lines = [];
  const poly = (pts) => polys.push(area(pts) < 0 ? pts.slice().reverse() : pts);
  const limb = (a, b, r1, r2) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    poly([[a[0] + nx * r1, a[1] + ny * r1], [b[0] + nx * r2, b[1] + ny * r2], [b[0] - nx * r2, b[1] - ny * r2], [a[0] - nx * r1, a[1] - ny * r1]]);
    circles.push([a[0], a[1], r1], [b[0], b[1], r2]);
  };
  const joint = (root, a, l) => [root[0] + Math.sin(a) * l, root[1] + Math.cos(a) * l];
  const SH = 62;
  const cw = 29 * B.sw; // chest half-width
  // scarf first (behind everything)
  const neck = P(0, SH + 4);
  const d = wind ? wind.slice(0, 2) : [-0.6, 0.8];
  const fly = wind ? wind[2] : 0; // 0 idle (hanging, fluttering) .. 1 full flight (streaming)
  const ph = t * 9 + B.scarf * 3;
  const sl = B.scarf * (44 + 46 * fly);
  poly(streamer(neck, d, sl, 7.5, 1.5, 6 + 6 * fly, ph));
  const d2 = [d[0] * 0.96 - d[1] * 0.28, d[1] * 0.96 + d[0] * 0.28];
  poly(streamer(neck, d2, sl * 0.7, 5.5, 1.2, 5 + 4 * fly, ph + 1.7));
  // legs: tapered thigh + shin, angular boot
  const legs = [[-1, pose.lL], [1, pose.lR]].map(([sg, [a1, a2]]) => {
    const hip = P(sg * 10 * B.sw, 0);
    const knee = joint(hip, a1, 50);
    const ank = joint(knee, a1 + a2, 48);
    limb(hip, knee, 12.5 * B.limb, 9.5 * B.limb);
    limb(knee, ank, 9.5 * B.limb, 6 * B.limb);
    const bw = 7 * B.limb;
    poly([[ank[0] - bw, ank[1] - 4], [ank[0] + bw, ank[1] - 4], [ank[0] + bw + sg * 9, ank[1] + 7], [ank[0] - bw + sg * 3, ank[1] + 7]]);
    return ank[1] + 7;
  });
  // torso: V-shaped chest, narrow waist, hip plate
  poly([P(-15 * B.sw, -6), P(15 * B.sw, -6), P(11 * B.sw, 22), P(cw, SH - 16), P(cw * 0.78, SH + 3), P(-cw * 0.78, SH + 3), P(-cw, SH - 16), P(-11 * B.sw, 22)]);
  poly([P(-17 * B.sw, 4), P(17 * B.sw, 4), P(13 * B.sw, -12), P(-13 * B.sw, -12)]);
  // arms: tapered upper arm + forearm, fist
  const hands = [[-1, pose.aL], [1, pose.aR]].map(([sg, [a1, a2]]) => {
    const sh = P(sg * cw * 0.8, SH - 5);
    const el = joint(sh, a1, 40);
    const wr = joint(el, a1 + a2, 37);
    limb(sh, el, 9 * B.limb, 7 * B.limb);
    limb(el, wr, 7 * B.limb, 5.2 * B.limb);
    circles.push([wr[0], wr[1], 7 * B.limb]);
    return { wr, dir: [Math.sin(a1 + a2), Math.cos(a1 + a2)] };
  });
  // angular shoulder plates
  for (const sg of [-1, 1]) {
    const k = B.pad;
    const x0 = sg * cw * 0.6;
    poly([P(x0 - sg * 5, SH + 8), P(x0 + sg * 20 * k, SH + 6 + 3 * k), P(x0 + sg * 24 * k, SH - 12 * k), P(x0 + sg * 4, SH - 11)]);
  }
  // head + role piece
  const hc = P(0, SH + 27);
  circles.push([hc[0], hc[1], B.r]);
  poly([P(-7, SH), P(7, SH), P(6, SH + 14), P(-6, SH + 14)]);
  if (B.head === 'crest') poly([P(-5, SH + 40), P(5, SH + 41), P(2, SH + 64), P(-12, SH + 58)]);
  else if (B.head === 'hood') poly([P(-B.r - 3, SH + 20), P(B.r + 3, SH + 20), P(9, SH + 62), P(-2, SH + 50)]);
  else if (B.head === 'tail') poly(streamer(P(-4, SH + 38), [d[0] * 0.8 + up[0] * 0.2, d[1] * 0.8 + up[1] * 0.2], 44, 6, 1, 6, ph + 0.8));
  else if (B.head === 'band') {
    poly(streamer(P(-B.r + 2, SH + 30), d, 30, 3.5, 1, 4, ph + 2.2));
    poly(streamer(P(-B.r + 2, SH + 30), d2, 22, 3, 1, 4, ph + 3.1));
  }
  // props (stroked lines: [points, width])
  if (B.prop === 'bow') {
    const { wr, dir } = hands[0];
    const c = [-dir[1], dir[0]];
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const k = i / 5 - 1;
      pts.push([wr[0] + c[0] * k * 50 - dir[0] * k * k * 20 + dir[0] * 4, wr[1] + c[1] * k * 50 - dir[1] * k * k * 20 + dir[1] * 4]);
    }
    lines.push([pts, 6.5]);
    const pull = hands[1].wr;
    const near = Math.hypot(pull[0] - wr[0], pull[1] - wr[1]) < 150 && Math.abs((pull[0] - wr[0]) * dir[1] - (pull[1] - wr[1]) * dir[0]) < 40;
    lines.push([near ? [pts[0], pull, pts[10]] : [pts[0], pts[10]], 1.6]);
  } else if (B.prop === 'staff') {
    const { wr } = hands[1];
    const sd = [Math.sin(0.12), -Math.cos(0.12)];
    const top = [wr[0] + sd[0] * 132, wr[1] + sd[1] * 132];
    lines.push([[[wr[0] - sd[0] * 88, wr[1] - sd[1] * 88], top], 6]);
    poly([[top[0], top[1] - 22], [top[0] + 11, top[1] - 4], [top[0], top[1] + 10], [top[0] - 11, top[1] - 4]]);
  }
  return { polys, circles, lines, foot: Math.max(...legs) };
}
function figurePaths(ctx, g, grow) {
  ctx.beginPath();
  for (const pts of g.polys) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  for (const [x, y, r] of g.circles) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  if (grow > 0) {
    ctx.lineWidth = grow;
    ctx.stroke();
  }
  for (const [pts, w] of g.lines) {
    ctx.lineWidth = w + grow;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}
/**
 * Draws a hero silhouette with its feet-centre at (x, y), `h` px tall. rim: cyan rim-light width (px).
 * opts: role (TOP/JGL/MID/ADC/SUP build + prop), vel ([vx, vy] screen px/s: the scarf trails opposite it;
 * omitted = idle wind), t (seconds, scarf flutter), rot, fill/rimColor (flat colour copies), alpha.
 */
export function figure(ctx, K, pose, x, y, h, { rim = 3, fill = K.C.ink, rimColor = K.C.cyan, alpha = 1, rot = 0, role = 'MID', vel = null, t = 0 } = {}) {
  let wind = null;
  if (vel) {
    const sp = Math.hypot(vel[0], vel[1]);
    const c = Math.cos(-rot);
    const s = Math.sin(-rot);
    const lx = (-vel[0] * c + vel[1] * s) / (sp || 1);
    const ly = (-vel[0] * s - vel[1] * c) / (sp || 1);
    const k = Math.min(1, sp / 900);
    const wx = -0.6 * (1 - k) + lx * k;
    const wy = 0.8 * (1 - k) + ly * k;
    const n = Math.hypot(wx, wy) || 1;
    wind = [wx / n, wy / n, k];
  }
  const g = figureGeom(pose, role, wind, t);
  const s = h / FIG_H;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.translate(0, -g.foot);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (rim > 0) {
    ctx.strokeStyle = rimColor;
    ctx.fillStyle = rimColor;
    figurePaths(ctx, g, (rim * 2) / s);
  }
  ctx.strokeStyle = fill;
  ctx.fillStyle = fill;
  figurePaths(ctx, g, 0);
  ctx.restore();
}

/** Caption band sized to a card (lower third at y=870 or centre). */
export function cardBand(ctx, f, K, c, { y = 870, angle = 0, subGap = 0 } = {}) {
  const a = cardAlpha(f, K, c);
  if (a <= 0) return;
  const lt = f.lt - f.at(c.bar, c.beat);
  const size = K.fitSize(ctx, c.text, 1500, 150, K.F.anton);
  const tw = K.measure(ctx, c.text, size, K.F.anton);
  const sw = c.sub ? K.measure(ctx, c.sub, 54, (px) => K.F.inter(px, 700)) + 48 : 0;
  const w = Math.max(tw * (c.style === 'jagged' ? 1.05 : 1), sw) + 170;
  if (y < 700) captionBand(ctx, K, 960, y - 90, y + 92, w, a, lt / 0.12, angle);
  else if (c.sub) captionBand(ctx, K, 960, 754, 1016 + subGap, w, a, lt / 0.12, angle);
  else captionBand(ctx, K, 960, 786, 956, w, a, lt / 0.12, angle);
}
