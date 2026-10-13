// S01 — « Le procès du jungle » (hook), bars 0–4 (0 → 6,4 s).
// Frame 0 already shows the blame sentence; it is then turned back on the viewer.
// Heartbeat accents follow the real music: music.py places the intro sub hits on beat 0 and
// beat 0.75 of every bar (the script's 1-indexed « beats 1 and 1.75 »), so the stamp lands on the
// bar-1 downbeat (1,6 s) and the blame pings / token cracks use the same heartbeats.
const BEAT = 0.4;
const BAR = 1.6;
const NB = ' ';
const RX = 960; // loop ring centre
const RY = 560;
const HOOK_A = 'C’EST LA FAUTE DU ';
const HOOK_B = 'JUNGLE';
const HOOK_C = '.';
const HOOK = HOOK_A + HOOK_B + HOOK_C;
const HOOK_SIZE = 156;
const STAMP_TXT = `…VRAIMENT${NB}?`;
const T_STAMP = BAR; // bar 1 downbeat, heartbeat
const STAMP_X = 970;
const STAMP_Y = 700;
const STAMP_SIZE = 196;
const T_BAR2 = 2 * BAR; // choir entry
const T_BAR3 = 3 * BAR;
const T_CARD3 = T_BAR2 - BEAT * 0.25; // jagged card starts a quarter beat early (bar 1 beat 3.75)
const T_KICK = T_BAR2; // stamp + ghost kicked out on the choir downbeat
const TOKEN = { x: 960, y: 240, r: 70 };
const CS = TOKEN.r / 46; // crack geometry was drawn for r = 46
// Blame pings: spawn on each heartbeat of bars 2–3, fly in over 0.3 s.
const PINGS = [
  { t: 2 * BAR, from: [70, 380], bend: -160 },
  { t: 2 * BAR + 0.3, from: [1850, 150], bend: 140 },
  { t: 3 * BAR, from: [430, 120], bend: 120 },
  { t: 3 * BAR + 0.3, from: [1850, 420], bend: -150 },
];
const HITS = PINGS.map((p) => p.t + 0.3);
// Token cracks: bar-3 heartbeats (4,8 / 5,1) and the last ping hitting it (5,4).
const CRACKS = [
  { t: 3 * BAR, pts: [[-42, -10], [-26, -4], [-18, -16], [-4, -8], [6, 6], [22, 2], [40, 18]] },
  { t: 3 * BAR + 0.3, pts: [[-8, -46], [-2, -30], [-12, -18], [-4, -8], [-14, 12], [-6, 26], [-12, 44]] },
  { t: 3 * BAR + 0.6, pts: [[42, -22], [28, -16], [24, -30], [8, -22], [-6, -8], [6, 10], [-2, 24], [10, 42]] },
];
const CARD3_TXT = `TOI${NB}: 0/4 À 8 MIN.`;
const CARD3_SUB = 'Le jungle a bon dos.';
const CARD4_A = 'Scrim perdu. ';
const CARD4_B = 'Aucun débrief.';
const CARD_Y = 600;
const SLASH_ANG = -0.32; // the renderer's slash angle

// Every card is drawn by the scene (tilted hook, stamp, early jagged card, emph flash on card 4).
export const cards = [
  { bar: 0, beat: 0, durBeats: 4, text: HOOK, emph: 'JUNGLE', sub: '', style: 'slam', sceneDrawn: true },
  { bar: 1, beat: 0, durBeats: 4, text: STAMP_TXT, emph: 'VRAIMENT', sub: '', style: 'stamp', sceneDrawn: true },
  { bar: 1, beat: 3.75, durBeats: 4.25, text: CARD3_TXT, emph: '0/4', sub: CARD3_SUB, style: 'jagged', sceneDrawn: true },
  { bar: 3, beat: 0, durBeats: 4, text: CARD4_A + CARD4_B, emph: CARD4_B, sub: '', style: 'slam', sceneDrawn: true },
];

/** Seconds since the last intro heartbeat (beat 0 / beat 0.75 of each bar) and its weight. */
function heartbeat(t) {
  if (t < 0) return { s: Infinity, w: 0 };
  const x = t - Math.floor(t / BAR) * BAR;
  return x >= 0.3 ? { s: x - 0.3, w: 0.65 } : { s: x, w: 1 };
}
/** Fast-attack bump 0→1→0 over d seconds. */
const bump = (s, d = 0.15) => (s >= -1e-6 && s < d ? Math.sin(Math.PI * Math.sqrt(Math.max(0, s) / d)) : 0);
/** Seconds since t0, robust to float noise in bar arithmetic (3 × 1,6 = 4,800000000000001). */
const since = (t, t0) => t - t0 + 1e-6;

// ------------------------------------------------------------------ static bitmaps
let godRay = null;
function godRayBitmap() {
  if (godRay) return godRay;
  const { createCanvas } = globalThis.__canvasMod;
  const c = createCanvas(500, 1080);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 500, 0);
  g.addColorStop(0, 'rgba(167,139,250,0)');
  g.addColorStop(0.3, 'rgba(167,139,250,0.55)');
  g.addColorStop(0.5, 'rgba(196,181,253,1)');
  g.addColorStop(0.7, 'rgba(167,139,250,0.55)');
  g.addColorStop(1, 'rgba(167,139,250,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 500, 1080);
  x.globalCompositeOperation = 'destination-in';
  const v = x.createLinearGradient(0, 0, 0, 1080);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = v;
  x.fillRect(0, 0, 500, 1080);
  godRay = c;
  return c;
}

// Violet Persona halftone band (same geometry as K.halftone: −0.32 rad, band 0.64–0.97, 16 px pitch).
let halftoneCache = null;
function halftoneBitmap(K) {
  if (halftoneCache) return halftoneCache;
  const { createCanvas } = globalThis.__canvasMod;
  const spacing = 16;
  const angle = -0.32;
  const band = [0.64, 0.97];
  const maxR = 5;
  const M = spacing * 3;
  const c = createCanvas(1920 + 2 * M, 1080 + 2 * M);
  const x = c.getContext('2d');
  x.fillStyle = K.C.violet;
  x.translate(c.width / 2, c.height / 2);
  x.rotate(angle);
  const span = Math.hypot(c.width, c.height);
  let n = 0;
  x.beginPath();
  for (let yy = -span / 2; yy < span / 2; yy += spacing) {
    const u = (yy + span / 2) / span;
    if (u <= band[0] || u >= band[1]) continue;
    const bu = (u - band[0]) / (band[1] - band[0]);
    for (let xx = -span / 2; xx < span / 2; xx += spacing) {
      const r = maxR * Math.sin(bu * Math.PI) * (0.65 + 0.35 * Math.sin(xx * 0.004));
      if (r < 0.5) continue;
      x.moveTo(xx + r, yy);
      x.arc(xx, yy, r, 0, Math.PI * 2);
      if (++n % 60 === 0) {
        // small batches: one giant path of thousands of arcs is very slow to fill
        x.fill();
        x.beginPath();
      }
    }
  }
  x.fill();
  halftoneCache = { c, M };
  return halftoneCache;
}

// Jagged « chat shard » behind the hook (7 points, ~1750 × 290).
const SHARD = [[-872, -96], [-310, -142], [430, -116], [880, -150], [846, 98], [126, 142], [-830, 126]];
const SHARD_A0 = -0.07; // −4°
const SHARD_A1 = -0.096; // −5.5° at the end of the hold

// ------------------------------------------------------------------ pieces
function ringRot(R, t) {
  // last beat before the slash: rotation triples
  const boost = 2 * Math.max(0, Math.min(t, 6.33) - 6.0);
  return (R.speed * (t + boost) * Math.PI) / 180 - Math.PI / 2;
}

function drawRings(ctx, K, t, hbPulse) {
  const { C, E, seg, rgba } = K;
  const rings = [
    { r: 360, ticks: 60, speed: 3, t0: 0, t1: BAR },
    { r: 290, ticks: 36, speed: -5, t0: BAR, t1: 2 * BAR },
    { r: 220, ticks: 24, speed: 8, t0: 2 * BAR, t1: 4 * BAR },
  ];
  const s = 1 + 0.035 * hbPulse;
  const a = 1 + 0.4 * hbPulse;
  ctx.save();
  ctx.translate(RX, RY);
  ctx.scale(s, s);
  for (const R of rings) {
    const d = E.inOutCubic(seg(t, R.t0, R.t1));
    if (d <= 0) continue;
    const rot = ringRot(R, t);
    const end = rot + Math.PI * 2 * d;
    // soft fuchsia halo
    ctx.lineWidth = 10;
    ctx.strokeStyle = rgba(C.fuchsia2, Math.min(1, 0.12 * a));
    ctx.beginPath();
    ctx.arc(0, 0, R.r, rot, end);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(C.fuchsia2, Math.min(1, 0.55 * a));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(C.cyan, Math.min(1, 0.15 * a));
    ctx.beginPath();
    ctx.arc(0, 0, R.r - 7, rot, end);
    ctx.stroke();
    // ticks
    const n = Math.floor(R.ticks * d);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(C.fuchsia2, Math.min(1, 0.4 * a));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const an = rot + (i / R.ticks) * Math.PI * 2;
      const l = i % 3 === 0 ? 14 : 8;
      const c = Math.cos(an);
      const sn = Math.sin(an);
      ctx.moveTo(c * (R.r + 4), sn * (R.r + 4));
      ctx.lineTo(c * (R.r + 4 + l), sn * (R.r + 4 + l));
    }
    ctx.stroke();
    // write-head comet while drawing: bright head + 40 px tail along the arc
    if (d < 1) {
      const hx = Math.cos(end) * R.r;
      const hy = Math.sin(end) * R.r;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const tail = 40 / R.r;
      for (let k = 0; k < 5; k++) {
        const a0 = end - tail * (1 - k / 5);
        const a1 = end - tail * (1 - (k + 1) / 5);
        ctx.strokeStyle = rgba(k > 2 ? C.text : C.fuchsia, 0.15 + 0.17 * k);
        ctx.lineWidth = 3 + k * 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, R.r, a0, a1);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 52);
      g.addColorStop(0, rgba(C.text, 0.95));
      g.addColorStop(0.18, rgba(C.text, 0.7));
      g.addColorStop(0.35, rgba(C.fuchsia, 0.45));
      g.addColorStop(1, rgba(C.fuchsia, 0));
      ctx.fillStyle = g;
      ctx.fillRect(hx - 52, hy - 52, 104, 104);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Hook line drawn baseline-aligned: JUNGLE bigger, cyan → fuchsia, with a white top highlight. */
function hookText(x, K, { ghost = 0, g = 0, ty = 6 }) {
  const { C, F, rgba } = K;
  const S = HOOK_SIZE;
  const SB = Math.round(S * 1.08);
  x.save();
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  x.font = F.anton(S);
  const wA = x.measureText(HOOK_A).width;
  const wC = x.measureText(HOOK_C).width;
  const cap = x.measureText('E').actualBoundingBoxAscent;
  x.font = F.anton(SB);
  const wB = x.measureText(HOOK_B).width;
  const capB = cap * 1.08;
  const total = wA + wB + wC;
  const x0 = -total / 2;
  const base = ty + cap / 2;
  const line = (dx, dy, fillA, fillB) => {
    x.font = F.anton(S);
    x.fillStyle = fillA;
    x.fillText(HOOK_A, x0 + dx, base + dy);
    x.fillText(HOOK_C, x0 + wA + wB + dx, base + dy);
    x.font = F.anton(SB);
    x.fillStyle = fillB;
    x.fillText(HOOK_B, x0 + wA + dx, base + dy);
  };
  if (ghost) {
    line(0, 0, rgba('#8792a8', 0.9), rgba('#a39bc4', 0.9));
    x.restore();
    return total;
  }
  if (g > 0.001) {
    x.save();
    x.globalCompositeOperation = 'lighter';
    line(-14 * g, -3 * g, rgba(C.cyan2, 0.75), rgba(C.cyan2, 0.75));
    line(14 * g, 3 * g, rgba(C.fuchsia2, 0.75), rgba(C.fuchsia2, 0.75));
    x.restore();
  }
  // white part with a soft cyan glow
  x.font = F.anton(S);
  x.shadowColor = 'rgba(103,232,249,0.35)';
  x.shadowBlur = 18;
  x.fillStyle = C.text;
  x.fillText(HOOK_A, x0, base);
  x.fillText(HOOK_C, x0 + wA + wB, base);
  // JUNGLE: the blamed word is the brightest and biggest element
  const bx = x0 + wA;
  x.font = F.anton(SB);
  x.shadowBlur = 0;
  x.lineJoin = 'round';
  x.lineWidth = 8;
  x.strokeStyle = C.ink;
  x.strokeText(HOOK_B, bx, base);
  const gr = x.createLinearGradient(bx, 0, bx + wB, 0);
  gr.addColorStop(0, C.cyan);
  gr.addColorStop(1, C.fuchsia);
  x.shadowColor = 'rgba(232,121,249,0.55)';
  x.shadowBlur = 22;
  x.fillStyle = gr;
  x.fillText(HOOK_B, bx, base);
  x.shadowBlur = 0;
  // glossy top highlight
  const hg = x.createLinearGradient(0, base - capB, 0, base - capB * 0.45);
  hg.addColorStop(0, 'rgba(255,255,255,0.7)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = hg;
  x.fillText(HOOK_B, bx, base);
  // crisp light rim
  x.lineWidth = 2;
  x.strokeStyle = rgba(C.text, 0.55);
  x.strokeText(HOOK_B, bx, base);
  x.restore();
  return total;
}

/** Shard + hook text (+ RGB copies) into an offscreen band; returns [canvas, bandTop]. */
function hookBand(K, opts) {
  const { C, rgba } = K;
  const { g = 0, ghost = 0, scale = 1, angle = SHARD_A0, dy = 0 } = opts;
  const bandTop = RY - 300;
  const [c, x] = K.offscreen('S01-hook', 1920, 600);
  x.translate(960, 300 + dy);
  x.scale(scale, scale);
  x.rotate(angle);
  // shard
  x.save();
  K.polyPath(x, SHARD);
  x.fillStyle = ghost ? rgba('#0b0f1e', 0.55) : '#0b0f1e';
  x.fill();
  x.lineJoin = 'miter';
  x.lineWidth = 4;
  x.strokeStyle = ghost ? rgba('#64748b', 0.6) : C.fuchsia2;
  x.stroke();
  if (!ghost) {
    // inner hairline for a sharper cut-glass edge
    x.save();
    x.scale(0.985, 0.94);
    K.polyPath(x, SHARD);
    x.lineWidth = 1.5;
    x.strokeStyle = rgba(C.fuchsia, 0.35);
    x.stroke();
    x.restore();
  }
  x.restore();
  hookText(x, K, { ghost, g });
  return [c, bandTop];
}

/** Draws the band, with up to 6 horizontal slices displaced by ±40·g px. */
function drawBand(ctx, K, band, top, g, t, dy = 0) {
  if (g < 0.02) {
    ctx.drawImage(band, 0, top + dy);
    return;
  }
  const R = K.rng(Math.floor(t * 30) + 41);
  const cuts = [];
  for (let i = 0; i < 6; i++) {
    const h = 8 + R() * 38;
    const y = 160 + R() * 260;
    cuts.push({ y: Math.floor(y), h: Math.floor(h), dx: (R() < 0.5 ? -1 : 1) * (12 + R() * 28) * g });
  }
  cuts.sort((a, b) => a.y - b.y);
  let y = 0;
  const strip = (sy, h, dx) => {
    if (h > 0) ctx.drawImage(band, 0, sy, 1920, h, dx, top + dy + sy, 1920, h);
  };
  for (const c of cuts) {
    if (c.y < y) continue;
    strip(y, c.y - y, 0);
    strip(c.y, c.h, c.dx);
    y = c.y + c.h;
  }
  strip(y, 600 - y, 0);
}

const SC = STAMP_SIZE / 172; // splash geometry was laid out for a 172 px stamp

function drawDroplets(ctx, K, t) {
  const { C, E, seg, rng } = K;
  const p = E.outExpo(seg(t, T_STAMP, T_STAMP + 0.3));
  if (p <= 0) return;
  const drip = E.inOutSine(seg(t, T_STAMP + 0.3, T_STAMP + 1.3)); // slow 20 px drip afterwards
  const R = rng(1414);
  const cx = STAMP_X;
  const cy = STAMP_Y;
  const ca = Math.cos(-0.14);
  const sa = Math.sin(-0.14);
  ctx.save();
  ctx.fillStyle = C.fuchsia2;
  ctx.globalAlpha *= 0.95;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (R() - 0.5) * 0.35;
    // start on the rim of the (rotated) stamp, then fly outwards
    const ex = Math.cos(a);
    const ey = Math.sin(a);
    const rx0 = ex * 470 * SC;
    const ry0 = ey * 140 * SC;
    const sx = cx + rx0 * ca - ry0 * sa;
    const sy = cy + rx0 * sa + ry0 * ca;
    const dx = ex * ca - ey * 0.5 * sa;
    const dy = ex * sa + ey * 0.5 * ca + ey * 0.4;
    const dl = Math.hypot(dx, dy);
    const ux = dx / dl;
    const uy = dy / dl;
    const dist = (40 + R() * 190) * SC;
    const r = (6 + R() * 12) * SC;
    const dd = 20 * drip * (0.55 + 0.45 * R());
    const x = sx + ux * dist * p;
    const y = sy + uy * dist * p + dd;
    const stretch = 1 + 2.2 * (1 - p);
    ctx.save();
    ctx.translate(x, y);
    // the drip leaves a thin run behind it
    if (dd > 0.5) {
      ctx.fillRect(-r * 0.22, -dd, r * 0.44, dd);
    }
    ctx.rotate(Math.atan2(uy, ux));
    ctx.beginPath();
    ctx.ellipse(-r * (stretch - 1) * 0.5, 0, r * stretch, r * (0.8 + 0.2 * p), 0, 0, Math.PI * 2);
    ctx.fill();
    // satellites flung further out
    const s1 = r * (1.8 + R());
    const s2 = r * (3 + R() * 1.5);
    ctx.beginPath();
    ctx.arc(s1 * p, (R() - 0.5) * 10, r * 0.38, 0, Math.PI * 2);
    ctx.arc(s2 * p, (R() - 0.5) * 16, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawHalftoneSplash(ctx, K, t) {
  const { C, E, seg } = K;
  const p = E.outExpo(seg(t, T_STAMP, T_STAMP + 0.3));
  if (p <= 0) return;
  ctx.save();
  ctx.fillStyle = C.fuchsia;
  ctx.globalAlpha *= 0.75;
  const splats = [[STAMP_X + 541, STAMP_Y - 148, 130], [STAMP_X - 524, STAMP_Y + 154, 100]];
  for (const [sx, sy, rad] of splats) {
    ctx.beginPath();
    for (let gy = -rad; gy <= rad; gy += 15) {
      for (let gx = -rad; gx <= rad; gx += 15) {
        const ox = gx + ((gy / 15) % 2 ? 7.5 : 0);
        const d = Math.hypot(ox, gy) / rad;
        if (d >= 1) continue;
        const r = 6.2 * (1 - d) * p;
        if (r < 0.6) continue;
        ctx.moveTo(sx + ox + r, sy + gy);
        ctx.arc(sx + ox, sy + gy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawStamp(ctx, K, t) {
  const { C, E, seg, clamp, rgba, F, lerp } = K;
  const p = seg(t, T_STAMP - 0.035, T_STAMP + 0.2);
  const kick = seg(t, T_KICK, T_KICK + 0.05); // 3-frame kick-out on the choir downbeat
  if (p <= 0 || kick >= 1) return;
  // anticipation: shoved down and tipped further while the jagged card lands above it, then kicked out
  const shove = E.inOutSine(seg(t, T_CARD3 - 0.04, T_KICK));
  const sink = 78 * shove + 70 * E.outCubic(kick);
  const breathe = 1 + 0.02 * bump(t - (T_STAMP + 0.3), 0.3); // 1,9 s heartbeat
  const size = STAMP_SIZE;
  const x = STAMP_X;
  const y = STAMP_Y + sink;
  const angle = -0.14 - 0.05 * shove; // −8° → −11°
  ctx.save();
  ctx.globalAlpha *= 1 - kick;
  const ks = (1 + 0.15 * E.outCubic(kick)) * breathe;
  ctx.translate(x, y);
  ctx.scale(ks, ks);
  ctx.translate(-x, -y);
  ctx.translate(0, sink);
  drawHalftoneSplash(ctx, K, t);
  drawDroplets(ctx, K, t);
  ctx.translate(0, -sink);
  // ink backing under the rubber frame
  const e = clamp(p);
  const s = lerp(2.2, 1, E.outExpo(e));
  const w = K.measure(ctx, STAMP_TXT, size, F.bebas, 4) + size * 0.7;
  const h = size * 1.35;
  ctx.save();
  ctx.globalAlpha *= clamp(e * 3);
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  K.roundRect(ctx, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, size * 0.16);
  ctx.fillStyle = rgba(C.ink, 0.88);
  ctx.fill();
  ctx.restore();
  K.stamp(ctx, STAMP_TXT, x, y, { size, p: e, color: C.fuchsia2, angle, font: F.bebas });
  // distressed rubber texture: thin ink scratches across the stamp
  if (e > 0.25) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(s, s);
    const R = K.rng(808);
    ctx.strokeStyle = rgba(C.ink, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const sx = (R() - 0.5) * w;
      const sy = (R() - 0.5) * h * 0.8;
      const l = 12 + R() * 40;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + l, sy - l * 0.35);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawGhost(ctx, K, t) {
  const { C, E, seg, lerp, rgba } = K;
  if (t < T_STAMP || t > T_KICK) return;
  // knocked back in 0.1 s (no collision with the landing stamp)
  const k = E.outExpo(seg(t, T_STAMP, T_STAMP + 0.1));
  const out = E.inQuad(seg(t, T_CARD3 - 0.1, T_CARD3 + 0.02));
  if (out >= 1) return;
  const scale = lerp(1, 0.86, k);
  const dy = lerp(12, -100, k);
  const [band, top] = hookBand(K, { ghost: 1, scale, angle: SHARD_A1, dy });
  ctx.save();
  ctx.globalAlpha = lerp(1, 0.55, k) * (1 - out);
  ctx.drawImage(band, 0, top);
  ctx.restore();
  // fuchsia strike line along the ghost baseline, left → right in 0.25 beat
  const sp = E.outCubic(seg(t, T_STAMP + 0.06, T_STAMP + 0.06 + BEAT * 0.25));
  if (sp > 0) {
    const half = K.measure(ctx, HOOK, HOOK_SIZE, K.F.anton) / 2 + 50;
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    ctx.translate(RX, RY + dy);
    ctx.scale(scale, scale);
    ctx.rotate(SHARD_A1);
    ctx.fillStyle = C.fuchsia2;
    ctx.fillRect(-half, 4, 2 * half * sp, 7);
    ctx.fillStyle = rgba(C.text, 0.8);
    ctx.fillRect(-half + 2 * half * sp - 18, 6.5, 18 * (sp < 1 ? 1 : 0), 2);
    ctx.restore();
  }
}

function tokenHit(t) {
  let h = 0;
  for (const ht of HITS) h = Math.max(h, bump(t - ht, 0.15));
  return h;
}

function drawToken(ctx, K, t) {
  const { C, E, seg, rgba, F, clamp } = K;
  const rise = seg(t, T_BAR2 - 1 / 60, T_BAR2 + 0.2);
  if (rise <= 0) return;
  const ob = E.outBack(rise, 2.2);
  const y0 = 300 + (TOKEN.y - 300) * ob;
  // jolt on each crack
  let jx = 0;
  for (const c of CRACKS) {
    const s = since(t, c.t);
    if (s >= 0 && s < 0.25) jx += Math.sin(s * 90) * 9 * (1 - s / 0.25);
  }
  // after the last crack the token keeps trembling under the blame
  const tremble = seg(t, CRACKS[2].t + 0.25, CRACKS[2].t + 0.6);
  jx += tremble * K.noise1(t * 26, 5) * 2.6;
  const x = TOKEN.x + jx;
  const y = y0 + tremble * K.noise1(t * 26, 9) * 2;
  const sc = (0.55 + 0.45 * ob) * (1 + 0.15 * tokenHit(t));
  // pop shockwave on the choir downbeat, fuchsia ones on every ping hit
  K.shockwave(ctx, TOKEN.x, TOKEN.y, (t - T_BAR2) / 0.45, { color: C.violet, maxR: 220, width: 18, sparks: 10, seed: 21 });
  for (const ht of HITS) K.shockwave(ctx, x, y, (t - ht) / 0.35, { color: C.fuchsia, maxR: 160, width: 14, sparks: 8, seed: 9 });
  ctx.save();
  ctx.globalAlpha *= clamp(rise * 8);
  // stacked blame rings (one per landed ping)
  PINGS.forEach((pg, k) => {
    const s = since(t, pg.t + 0.3);
    if (s < 0) return;
    const pop = E.outExpo(clamp(s / 0.2));
    const r = (90 + 16 * k) * (1.35 - 0.35 * pop);
    ctx.strokeStyle = rgba(C.fuchsia2, 0.55 + 0.45 * Math.exp(-s * 6));
    ctx.lineWidth = 3 + 4 * Math.exp(-s * 10);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  // soft violet halo (cheap radial instead of shadowBlur)
  const g = ctx.createRadialGradient(0, 0, 14, 0, 0, 145);
  g.addColorStop(0, rgba(C.violet, 0.4));
  g.addColorStop(1, rgba(C.violet, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-145, -145, 290, 290);
  K.hexPath(ctx, 0, 0, TOKEN.r);
  ctx.fillStyle = '#1e1b4b';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.violet;
  ctx.stroke();
  K.hexPath(ctx, 0, 0, TOKEN.r - 11);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(C.violet2, 0.35);
  ctx.stroke();
  // 2-frame white flash on each crack
  const crackFlash = CRACKS.some((c) => since(t, c.t) >= 0 && since(t, c.t) < 2 / 60);
  if (crackFlash) {
    K.hexPath(ctx, 0, 0, TOKEN.r);
    ctx.fillStyle = rgba(C.text, 0.9);
    ctx.fill();
  }
  K.text(ctx, 'JGL', 0, 2, { size: 34, font: F.russo, color: crackFlash ? C.ink : C.violet2, spacing: 1 });
  // cracks
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const c of CRACKS) {
    const s = since(t, c.t);
    if (s < 0) continue;
    const d = clamp(s / 0.06);
    const pts = c.pts;
    const n = Math.max(2, Math.ceil(pts.length * d));
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i][0] * CS, pts[i][1] * CS);
    ctx.strokeStyle = rgba(C.ink, 0.85);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = rgba(C.text, 0.95);
    ctx.lineWidth = 4;
    ctx.stroke();
    if (s < 0.12) {
      ctx.strokeStyle = rgba(C.cyan, 0.8 * (1 - s / 0.12));
      ctx.lineWidth = 9;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPings(ctx, K, t) {
  const { C, E, rgba, F, clamp } = K;
  for (const pg of PINGS) {
    const s = since(t, pg.t);
    if (s < 0 || s > 0.5) continue;
    const [x0, y0] = pg.from;
    const x1 = TOKEN.x;
    const y1 = TOKEN.y;
    if (s <= 0.3) {
      const q = E.inCubic(s / 0.3);
      // quadratic bezier with a perpendicular bend
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L = Math.hypot(dx, dy);
      const cx = mx + (-dy / L) * pg.bend;
      const cy = my + (dx / L) * pg.bend;
      const u = 1 - q;
      const x = u * u * x0 + 2 * u * q * cx + q * q * x1;
      const y = u * u * y0 + 2 * u * q * cy + q * q * y1;
      const pop = E.outBack(clamp(s / 0.07), 2.5);
      const sc = pop * (1 - 0.4 * q);
      // trail
      ctx.save();
      ctx.strokeStyle = rgba(C.fuchsia, 0.4);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const qq = Math.max(0, q - 0.2 * (1 - i / steps));
        const uu = 1 - qq;
        const px = uu * uu * x0 + 2 * uu * qq * cx + qq * qq * x1;
        const py = uu * uu * y0 + 2 * uu * qq * cy + qq * qq * y1;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
      const split = s < 6 / 60 ? 10 * (1 - s / 0.1) + 3 : 0; // 6-frame RGB split
      const drawPing = (ox, oy, col, a, withGlyph) => {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(x + ox, y + oy);
        ctx.scale(sc, sc);
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        if (withGlyph) {
          ctx.lineWidth = 4;
          ctx.strokeStyle = rgba(C.text, 0.9);
          ctx.stroke();
          K.text(ctx, '?', 0, 3, { size: 60, font: F.anton, color: C.text });
        }
        ctx.restore();
      };
      if (split) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawPing(-split, -split * 0.3, C.cyan2, 0.75, false);
        drawPing(split, split * 0.3, C.fuchsia2, 0.75, false);
        ctx.restore();
      }
      drawPing(0, 0, C.fuchsia2, 1, true);
    } else {
      // impact burst on the token
      const k = (s - 0.3) / 0.2;
      ctx.save();
      ctx.strokeStyle = rgba(C.fuchsia, 1 - k);
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const r0 = 80 + 60 * E.outCubic(k);
        ctx.moveTo(x1 + Math.cos(a) * r0, y1 + Math.sin(a) * r0);
        ctx.lineTo(x1 + Math.cos(a) * (r0 + 30 * (1 - k)), y1 + Math.sin(a) * (r0 + 30 * (1 - k)));
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Sub pill, same look as K.renderCards. */
function subPill(ctx, K, str, x, sy, sp, subSize = 54) {
  const { C, rgba, F } = K;
  if (sp <= 0) return;
  ctx.save();
  ctx.globalAlpha *= sp;
  const sw = K.measure(ctx, str, subSize, (px) => F.inter(px, 700));
  ctx.fillStyle = rgba(C.ink, 0.65);
  ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, (sw + 48) * sp, subSize * 1.6);
  ctx.fillStyle = C.cyan;
  ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, 6, subSize * 1.6);
  K.text(ctx, str, x, sy, { size: subSize, font: (px) => F.inter(px, 700), color: C.text2 });
  ctx.restore();
}

/** Card 3 « TOI : 0/4 À 8 MIN. » (jagged) — starts a quarter beat before the choir downbeat. */
function drawCard3(ctx, K, t) {
  const { E, seg, clamp, F } = K;
  const lt = t - T_CARD3;
  const d = T_BAR3 - T_CARD3;
  if (lt < 0 || lt > d) return;
  const out = seg(lt, d - BEAT * 0.25, d);
  const sz = K.fitSize(ctx, CARD3_TXT, 1500, 150, F.anton);
  const cy = CARD_Y - 54 * 0.7;
  ctx.save();
  ctx.globalAlpha *= 1 - E.inQuad(out);
  // (the kit's jagged style treats only ' ' as a gap, so the no-break space is drawn as a plain gap)
  K.jaggedText(ctx, CARD3_TXT.replace(/ /g, ' '), 960, cy, { size: sz * 0.82, p: clamp(lt / BEAT), seed: 15, emph: '0/4' });
  const sp = E.outCubic(seg(lt, BEAT * 0.4, BEAT * 1.2));
  subPill(ctx, K, CARD3_SUB, 960, cy + sz * 0.72 + 54 * 0.4, sp);
  ctx.restore();
}

/** Card 4 « Scrim perdu. Aucun débrief. » (slam); the emph flashes on the 5,1 s heartbeat. */
function drawCard4(ctx, K, t) {
  const { C, clamp, F } = K;
  const lt = since(t, T_BAR3) + 1 / 60; // already visible on the downbeat frame
  if (lt < 0) return;
  const str = CARD4_A + CARD4_B;
  const sz = K.fitSize(ctx, str, 1500, 150, F.anton);
  const p = clamp((lt / BEAT) * 1.4);
  if (p < 1) {
    K.slamText(ctx, str, 960, CARD_Y, { size: sz, p, emph: CARD4_B });
    return;
  }
  const fl = bump(t - (T_BAR3 + 0.3), 0.22);
  const wA = K.measure(ctx, CARD4_A, sz, F.anton);
  const wB = K.measure(ctx, CARD4_B, sz, F.anton);
  const x0 = 960 - (wA + wB) / 2;
  K.text(ctx, CARD4_A, x0, CARD_Y, { size: sz, font: F.anton, align: 'left', glow: 22 });
  const bc = x0 + wA + wB / 2;
  ctx.save();
  ctx.translate(bc, CARD_Y);
  ctx.scale(1 + 0.04 * fl, 1 + 0.04 * fl);
  K.text(ctx, CARD4_B, 0, 0, { size: sz, font: F.anton, emph: CARD4_B, glow: 22 + 40 * fl });
  if (fl > 0.01) {
    // white flash over the emph
    ctx.globalCompositeOperation = 'lighter';
    K.text(ctx, CARD4_B, 0, 0, { size: sz, font: F.anton, color: C.text, alpha: 0.22 * fl });
  }
  ctx.restore();
}

/** A fuchsia scratch along the slash angle, growing across the card just before the renderer's wipe. */
function drawScratch(ctx, K, t) {
  const { C, E, seg, rgba } = K;
  const p = E.outCubic(seg(t, 6.19, 6.33));
  if (p <= 0) return;
  const L0 = -1150;
  const L1 = L0 + 2300 * p;
  ctx.save();
  ctx.translate(960, 540);
  ctx.rotate(SLASH_ANG);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(C.fuchsia2, 0.3);
  ctx.fillRect(L0, -12, L1 - L0, 24);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.ink;
  ctx.fillRect(L0, -6, L1 - L0, 12);
  ctx.fillStyle = C.fuchsia2;
  ctx.fillRect(L0, -3.5, L1 - L0, 7);
  ctx.fillStyle = rgba(C.text, 0.95);
  ctx.fillRect(L0, -1, L1 - L0, 2);
  // hot tip
  const g = ctx.createRadialGradient(L1, 0, 0, L1, 0, 40);
  g.addColorStop(0, rgba(C.text, 0.95));
  g.addColorStop(1, rgba(C.fuchsia, 0));
  ctx.fillStyle = g;
  ctx.fillRect(L1 - 40, -40, 80, 80);
  ctx.restore();
}

export default {
  id: 'S01',
  startBar: 0,
  endBar: 4,
  transitionOut: 'slash',
  cards,
  draw(ctx, f, K) {
    const { C, E, seg, rgba } = K;
    const t = Math.max(0, f.lt);
    const hb = heartbeat(t);
    const hbPulse = bump(hb.s) * hb.w;

    // ---- camera: the last bar leans into the cracked token (inExpo push pivoting on it)
    const push = 1 + 0.12 * E.inExpo(seg(t, 5.6, 6.35));
    ctx.save();
    if (push > 1) {
      ctx.translate(TOKEN.x, TOKEN.y);
      ctx.scale(push, push);
      ctx.translate(-TOKEN.x, -TOKEN.y);
    }
    K.background(ctx, f, { intensity: 0.9, pulse: 0.25 * hbPulse });
    // impact bloom behind everything that must stay legible on frame 0
    const bloom = Math.exp(-t * 9);
    if (bloom > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(RX, RY, 0, RX, RY, 1100);
      g.addColorStop(0, rgba(C.text, 0.75 * bloom));
      g.addColorStop(0.25, rgba(C.cyan2, 0.45 * bloom));
      g.addColorStop(0.6, rgba(C.violet, 0.18 * bloom));
      g.addColorStop(1, rgba(C.violet, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.restore();
    }
    // violet god-ray (bar 2): slams down on the choir downbeat (α .35), settles to .18 in 0,3 s
    if (t >= T_BAR2 - 1 / 60) {
      const img = godRayBitmap();
      const h = Math.max(1, 1080 * E.outExpo(seg(t, T_BAR2 - 1 / 60, T_BAR2 + 0.12)));
      const a = 0.18 + 0.17 * (1 - E.outCubic(seg(t, T_BAR2, T_BAR2 + 0.3)));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (1 + 0.25 * hbPulse);
      ctx.drawImage(img, 0, 0, 500, h, RX - 250, 0, 500, h);
      ctx.globalAlpha *= 0.6;
      const sway = Math.sin(t * 1.3) * 40;
      ctx.drawImage(img, 0, 0, 500, h, RX - 120 + sway, 0, 240, h);
      ctx.restore();
    }
    // Persona halftone texture arrives with the choir (bar 2)
    const ht = seg(t, T_BAR2, T_BAR2 + BAR);
    if (ht > 0) {
      // pre-tinted cached dot field (one drawImage instead of the kit's three full-frame passes)
      const { c: hc, M } = halftoneBitmap(K);
      const off = (f.t * 18) % 16;
      ctx.save();
      ctx.globalAlpha = 0.16 * E.inOutSine(ht);
      ctx.drawImage(hc, -M + Math.cos(-0.32) * off, -M + Math.sin(-0.32) * off);
      ctx.restore();
    }
    K.particles(ctx, f, { count: 70, speed: 0.22, size: 1.6, seed: 31, alpha: 0.55 });
    K.particles(ctx, f, { count: 45, speed: 0.4, size: 2.4, seed: 32, alpha: 0.7 });
    K.particles(ctx, f, { count: 18, speed: 0.7, size: 3.6, seed: 33, alpha: 0.75, colors: [C.fuchsia, C.violet2] });
    // bar 3: the room dims 15 %
    const dim = 0.15 * E.outCubic(seg(t, T_BAR3, T_BAR3 + 0.3));
    if (dim > 0) {
      ctx.fillStyle = rgba(C.night, dim);
      ctx.fillRect(0, 0, 1920, 1080);
    }

    // ---- loop ring + shockwave
    drawRings(ctx, K, t, hbPulse);
    const sw = t / BEAT;
    if (sw < 1) K.shockwave(ctx, RX, RY, Math.max(0.001, sw), { color: C.cyan, maxR: 1400, sparks: 12, width: 34 });

    // heartbeat: dark radial breath
    if (hbPulse > 0.01) {
      const g = ctx.createRadialGradient(RX, RY, 300, RX, RY, 1150);
      g.addColorStop(0, 'rgba(2,6,17,0)');
      g.addColorStop(1, `rgba(2,6,17,${0.42 * hbPulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1920, 1080);
    }

    // ---- hook (scene-drawn card 1): legible on frame 0, glitches into the stamp
    if (t < T_STAMP) {
      // frame 0 is clean; frames 1+ carry the impact glitch with the scene's own cyan/fuchsia copies
      const gImp = t >= 0.5 / 60 ? 1 - seg(t, 1 / 60, 0.15) : 0;
      const gRamp = 0.25 * E.inQuad(seg(t, 0.8, 1.2)) + 0.75 * E.inCubic(seg(t, 1.2, T_STAMP));
      const g = Math.max(gImp, gRamp);
      const hold = E.inOutSine(seg(t, 0.1, T_STAMP));
      // settles from the impact, punches 3 % on the heartbeats, slow push + drift so the hold never freezes
      const settle = (1 + 0.07 * (1 - E.outExpo(seg(t, 0, 0.1)))) * (1 + 0.03 * bump(hb.s)) * (1 + 0.035 * hold);
      const [band, top] = hookBand(K, { g, scale: settle, angle: SHARD_A0 + (SHARD_A1 - SHARD_A0) * hold, dy: 12 * hold });
      drawBand(ctx, K, band, top, g, f.t);
    }
    drawGhost(ctx, K, t);
    drawStamp(ctx, K, t);

    // ---- JGL token, blame pings, cracks
    drawToken(ctx, K, t);
    drawPings(ctx, K, t);

    // ---- cards 3 & 4 (centre, y = 600)
    drawCard3(ctx, K, t);
    drawCard4(ctx, K, t);
    ctx.restore();

    // ---- the cut the renderer's slash follows
    drawScratch(ctx, K, t);

    // ---- FX: frame 0 stays clean; RGB split capped at 8 px (the renderer's split has a red channel)
    const imp = Math.exp(-t * 5);
    const st = t >= T_STAMP ? Math.exp(-(t - T_STAMP) * 20) : 0;
    const choir = t >= T_BAR2 ? Math.exp(-(t - T_BAR2) * 10) : 0;
    const rgbImp = t >= 1 / 60 ? 22 * Math.exp(-t * 9) : 0;
    return {
      auto: false,
      shake: 26 * imp + 10 * st + 3 * hbPulse + 3 * tokenHit(t),
      rgb: Math.min(8, rgbImp + 8 * st),
      zoom: 0.05 * imp + 0.015 * choir,
      flash: t > 0.01 ? 0.3 * Math.exp(-t * 18) : 0,
    };
  },
};
