// Helpers shared by S11 (stutter / CTA) and S12 (outro): music events, the JGL token,
// stop-motion player silhouettes and small deterministic spark bursts.
// Everything here is pure (static data + functions of their arguments); bitmap caches are static.
import { readFileSync } from 'node:fs';

let EVENTS = null;
function events() {
  if (!EVENTS) {
    try {
      EVENTS = JSON.parse(readFileSync(new URL('../out/music.events.json', import.meta.url), 'utf8'));
    } catch {
      EVENTS = {};
    }
  }
  return EVENTS;
}

/** Number of events of `kind` with time in [a, t]. */
export function countIn(kind, a, t) {
  const L = events()[kind] || [];
  let n = 0;
  for (const x of L) {
    if (x > t + 1e-6) break;
    if (x >= a - 1e-3) n++;
  }
  return n;
}

/** Time of the last event of `kind` in [a, t], or null. */
export function lastIn(kind, a, t) {
  const L = events()[kind] || [];
  let best = null;
  for (const x of L) {
    if (x > t + 1e-6) break;
    if (x >= a - 1e-3) best = x;
  }
  return best;
}

// ------------------------------------------------------------------ JGL token (running gag)
/**
 * Pointy-top hexagon token labelled JGL. opts: r, outline, alpha, scale, glow (0..1 cyan bloom), ring (0..1 gold ring draw).
 */
export function jglToken(ctx, K, x, y, opts = {}) {
  const { C } = K;
  const {
    r = 46, outline = C.violet, alpha = 1, scale = 1, glow = 0, glowColor = C.cyan, ring = 0, ringColor = C.gold, label = C.violet2,
    ringWidth = 3, ringBlur = 14, lineWidth = 3,
  } = opts;
  if (alpha <= 0 || scale <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 3.2);
    g.addColorStop(0, K.rgba(glowColor, 0.5 * glow));
    g.addColorStop(1, K.rgba(glowColor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-r * 3.2, -r * 3.2, r * 6.4, r * 6.4);
    ctx.restore();
  }
  if (ring > 0) {
    ctx.save();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = ringWidth;
    ctx.lineCap = 'round';
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = ringBlur;
    ctx.beginPath();
    ctx.arc(0, 0, r + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * K.clamp(ring, 0, 0.9999)); // Skia drops an exact 2π arc
    ctx.stroke();
    ctx.restore();
  }
  K.hexPath(ctx, 0, 0, r, 0);
  ctx.fillStyle = '#1e1b4b';
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  if (glow > 0) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 24 * glow;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  K.text(ctx, 'JGL', 0, 2, { size: Math.round(r * 0.52), font: K.F.russo, color: label });
  ctx.restore();
}

// ------------------------------------------------------------------ player silhouettes (5 authored poses)
// Angles are absolute directions measured from "straight down", positive toward +x (screen right).
// Limb tuples: [upper/thigh angle, lower/shin angle]. lift = hop in figure heights.
export const POSES = [
  // 0 fist pump: left fist up, right hand on hip
  { lean: 0.06, la: [-2.75, -3.08], ra: [0.55, -0.45], ll: [-0.2, -0.06], rl: [0.24, 0.06], lift: 0 },
  // 1 victory V
  { lean: 0, la: [-2.4, -2.55], ra: [2.4, 2.55], ll: [-0.3, -0.14], rl: [0.3, 0.14], lift: 0.02 },
  // 2 lunge + point
  { lean: 0.2, la: [-0.7, -0.25], ra: [1.6, 1.62], ll: [-0.62, -0.75], rl: [0.85, -0.05], lift: -0.07 },
  // 3 jump tuck
  { lean: -0.05, la: [-2.1, -2.65], ra: [2.0, 2.55], ll: [-1.15, 0.15], rl: [1.05, -0.2], lift: 0.16 },
  // 4 crossed arms, wide stance
  { lean: -0.06, la: [-0.28, 1.5], ra: [0.28, -1.5], ll: [-0.34, -0.12], rl: [0.34, 0.12], lift: 0 },
];
const SK = { thigh: 0.245, shin: 0.235, torso: 0.29, sh: 0.135, hip: 0.085, ua: 0.15, fa: 0.145, head: 0.078 };
const dir = (a) => [Math.sin(a), Math.cos(a)];

/** Clockwise (screen space) copy of a polygon, so overlapping details never punch holes with the nonzero rule. */
function cw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a < 0 ? pts.slice().reverse() : pts;
}

/**
 * Joint positions for a pose, figure-local units (feet ~ y=0, head top ~ y=-1). The figure faces +x.
 * style picks the angular head detail: 0 swept spikes, 1 pointed hood, 2 long back blade.
 * `details` are extra angular polygons (head detail, jacket tail, pointed shoulder pads) so the figures
 * read as players rather than pictograms.
 */
export function skeleton(pose, style = 0) {
  const hipY = -(SK.thigh + SK.shin) - pose.lift;
  const hip = [0, hipY];
  const c = Math.cos(pose.lean);
  const s = Math.sin(pose.lean);
  // lean rotates the upper body around the hip
  const rot = (p) => {
    const dx = p[0] - hip[0];
    const dy = p[1] - hip[1];
    return [hip[0] + dx * c - dy * s, hip[1] + dx * s + dy * c];
  };
  const shY = hipY - SK.torso;
  const shL = rot([-SK.sh + 0.02, shY + 0.02]);
  const shR = rot([SK.sh - 0.02, shY + 0.02]);
  const neck = rot([0, shY - 0.01]);
  const head = rot([0, shY - 0.025 - SK.head]);
  const limb = (o, [a1, a2], l1, l2) => {
    const d1 = dir(a1);
    const d2 = dir(a2);
    const j = [o[0] + d1[0] * l1, o[1] + d1[1] * l1];
    return [o, j, [j[0] + d2[0] * l2, j[1] + d2[1] * l2]];
  };
  const hL = [-SK.hip + 0.03, hipY];
  const hR = [SK.hip - 0.03, hipY];
  // angular details, built upright then leaned with the upper body
  const hc = [0, shY - 0.025 - SK.head];
  const hr = SK.head;
  const D = Math.PI / 180;
  const at = (deg, k) => [hc[0] + Math.cos(deg * D) * hr * k, hc[1] + Math.sin(deg * D) * hr * k];
  let hd;
  if (style % 3 === 0) {
    hd = [
      [at(-182, 0.85), at(-163, 1.95), at(-142, 0.85)],
      [at(-152, 0.85), at(-128, 2.2), at(-104, 0.85)],
      [at(-118, 0.85), at(-90, 1.85), at(-66, 0.85)],
    ];
  } else if (style % 3 === 1) {
    hd = [[at(-38, 1.14), at(-122, 2.35), at(-178, 1.2), at(150, 1.22), at(110, 1.05), at(0, 0.9)]];
  } else {
    hd = [
      [at(-150, 0.85), at(-176, 2.75), at(158, 1.2), at(180, 0.85)],
      [at(-128, 0.85), at(-108, 1.6), at(-88, 0.85)],
    ];
  }
  const tail = [[-0.05, hipY - 0.1], [-SK.hip + 0.005, hipY + 0.03], [-SK.hip - 0.11, hipY + 0.22], [-SK.hip - 0.01, hipY + 0.15]];
  const padF = [[SK.sh - 0.075, shY - 0.004], [SK.sh + 0.085, shY - 0.06], [SK.sh + 0.04, shY + 0.08]];
  const padB = [[-SK.sh + 0.075, shY - 0.004], [-SK.sh - 0.07, shY - 0.045], [-SK.sh - 0.03, shY + 0.07]];
  const details = [...hd, padF, padB, tail].map((poly) => poly.map(rot));
  return {
    details,
    hip,
    // V-shaped athletic torso: shoulders, chest, waist, hips
    torso: [
      [-SK.sh, shY], [SK.sh, shY], [SK.sh - 0.02, shY + 0.13], [0.07, hipY - 0.07], [SK.hip, hipY + 0.03],
      [-SK.hip, hipY + 0.03], [-0.07, hipY - 0.07], [-SK.sh + 0.02, shY + 0.13],
    ].map(rot),
    head,
    neck,
    lean: pose.lean,
    armL: limb(shL, pose.la, SK.ua, SK.fa),
    armR: limb(shR, pose.ra, SK.ua, SK.fa),
    legL: limb(hL, pose.ll, SK.thigh, SK.shin),
    legR: limb(hR, pose.rl, SK.thigh, SK.shin),
  };
}

function seg2(ctx, P, a, b) {
  const [x0, y0] = P(a);
  const [x1, y1] = P(b);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
}

function figureShape(ctx, sk, x, y, h, mx, fill) {
  const P = (p) => [x + p[0] * h * mx, y + p[1] * h];
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // torso + angular details (all clockwise, one nonzero fill), then head and fists
  ctx.beginPath();
  for (const poly of [sk.torso, ...sk.details]) {
    cw(poly.map(P)).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  }
  ctx.fill();
  ctx.beginPath();
  const [hx, hy] = P(sk.head);
  const hr = SK.head * h;
  ctx.moveTo(hx + hr, hy);
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  // headset ear cup (gamer read), on the side facing away
  const ex = hx - mx * hr * 0.95 * Math.cos(sk.lean);
  const ey = hy + hr * 0.15;
  ctx.moveTo(ex + hr * 0.42, ey);
  ctx.arc(ex, ey, hr * 0.42, 0, Math.PI * 2);
  for (const arm of [sk.armL, sk.armR]) {
    const [fx, fy] = P(arm[2]);
    ctx.moveTo(fx + 0.042 * h, fy);
    ctx.arc(fx, fy, 0.042 * h, 0, Math.PI * 2);
  }
  ctx.fill();
  // headset band
  ctx.lineWidth = Math.max(2, 0.018 * h);
  ctx.beginPath();
  ctx.arc(hx, hy, hr * 1.18, Math.PI * 1.05 + sk.lean, Math.PI * 1.95 + sk.lean);
  ctx.stroke();
  // neck + upper arms
  ctx.lineWidth = 0.09 * h;
  ctx.beginPath();
  seg2(ctx, P, sk.neck, sk.head);
  for (const arm of [sk.armL, sk.armR]) seg2(ctx, P, arm[0], arm[1]);
  ctx.stroke();
  // forearms
  ctx.lineWidth = 0.072 * h;
  ctx.beginPath();
  for (const arm of [sk.armL, sk.armR]) seg2(ctx, P, arm[1], arm[2]);
  ctx.stroke();
  // thighs
  ctx.lineWidth = 0.12 * h;
  ctx.beginPath();
  for (const leg of [sk.legL, sk.legR]) seg2(ctx, P, leg[0], leg[1]);
  ctx.stroke();
  // shins + feet
  ctx.lineWidth = 0.088 * h;
  ctx.beginPath();
  for (const leg of [sk.legL, sk.legR]) {
    seg2(ctx, P, leg[1], leg[2]);
    const [ax, ay] = P(leg[2]);
    const side = leg === sk.legL ? -1 : 1;
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + side * mx * 0.06 * h, ay + 0.01 * h);
  }
  ctx.stroke();
}

/** Ink silhouette with a 3px cyan rim light (top-left) and a faint violet back rim. Returns key points (px). */
export function silhouette(ctx, K, pose, x, y, h, opts = {}) {
  const { mirror = false, rim = K.C.cyan, rim2 = K.C.violet, alpha = 1, style = 0, rimOff = 3 } = opts;
  const mx = mirror ? -1 : 1;
  const sk = skeleton(pose, style);
  ctx.save();
  ctx.globalAlpha *= alpha;
  figureShape(ctx, sk, x + rimOff, y + rimOff * 0.67, h, mx, K.rgba(rim2, 0.8));
  figureShape(ctx, sk, x - rimOff, y - rimOff, h, mx, rim);
  figureShape(ctx, sk, x, y, h, mx, K.C.ink);
  ctx.restore();
  const P = (p) => [x + p[0] * h * mx, y + p[1] * h];
  const chest = [(sk.torso[0][0] + sk.torso[1][0]) / 2, (sk.torso[0][1] + sk.torso[3][1]) / 2];
  return { head: P(sk.head), handL: P(sk.armL[2]), handR: P(sk.armR[2]), chest: P(chest) };
}

// ------------------------------------------------------------------ sparks
/** Deterministic radial spark burst, tau seconds after it fired. */
export function sparkBurst(ctx, K, x, y, tau, opts = {}) {
  const { n = 14, seed = 1, speed = 520, life = 0.45, colors = [K.C.cyan, K.C.cyan2, K.C.text], width = 3, drag = 5 } = opts;
  if (tau < 0 || tau > life) return;
  const R = K.rng(seed);
  const k = 1 - tau / life;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.6;
    const v = speed * (0.5 + R() * 0.8);
    const d = (v * (1 - Math.exp(-drag * tau))) / drag;
    const vel = v * Math.exp(-drag * tau);
    const len = 6 + vel * 0.035;
    const c = colors[i % colors.length];
    ctx.strokeStyle = K.rgba(c, k);
    ctx.lineWidth = width * (0.5 + 0.5 * k);
    const cx = x + Math.cos(a) * d;
    const cy = y + Math.sin(a) * d;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * len, cy - Math.sin(a) * len);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }
  ctx.restore();
}

/** 3-layer parallax particles (the always-on layer). */
export function particles3(ctx, f, K, alpha = 1) {
  K.particles(ctx, f, { count: 70, size: 1.6, speed: 0.5, seed: 41, alpha: 0.55 * alpha });
  K.particles(ctx, f, { count: 36, size: 2.6, speed: 0.9, seed: 42, alpha: 0.6 * alpha });
  K.particles(ctx, f, { count: 12, size: 3.8, speed: 1.5, seed: 43, alpha: 0.65 * alpha });
}

/** The small brand bug (top right). */
export function brandBug(ctx, K, alpha = 1) {
  if (alpha <= 0) return;
  K.logo(ctx, 1772, 62, 150, { alpha: 0.55 * alpha, glow: 6, lineWidth: 2.4 });
}
