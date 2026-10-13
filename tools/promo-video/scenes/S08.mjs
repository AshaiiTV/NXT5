// S08 — Build 2 « Prêts ? » (bars 28–32).
// The excuses spiral into a growing orb (the JGL token last), a snare-driven shard stream feeds it, one more ring
// snaps in on every bar, slam cards ride an ink band, « PRÊTS ? » eclipses the orb on bar 31, then one beat of
// true silence: black frame and a single white dot.
import { particleField, brandBug, jagged, bitmap, eventsIn } from './lib-S07.mjs';

const NB = ' ';
const CARDS = [
  { bar: 28, beat: 0, durBeats: 4, text: `Fini le «${NB}jgl diff${NB}».`, emph: 'jgl diff', sub: '', style: 'jagged', sceneDrawn: true },
  { bar: 29, beat: 0, durBeats: 2, text: 'Pas de la chance.', emph: 'chance.', sub: '', style: 'slam', bandSlam: true },
  { bar: 29, beat: 2, durBeats: 2, text: 'Du travail.', emph: 'travail.', sub: '', style: 'slam', bandSlam: true },
  { bar: 30, beat: 0, durBeats: 2, text: 'Zéro excuse.', emph: 'Zéro', sub: '', style: 'slam', bandSlam: true },
  { bar: 30, beat: 2, durBeats: 2, text: 'C’est ton tour.', emph: 'ton tour.', sub: '', style: 'slam', bandSlam: true },
  { bar: 31, beat: 0, durBeats: 3, text: `PRÊTS${NB}?`, emph: 'PRÊTS', sub: '', style: 'giant', sceneDrawn: true },
];

const BEAT = 0.4;
const BAR = 1.6;
const T0 = 28 * BAR;
const L = (bar, beat = 0) => (bar - 28) * BAR + beat * BEAT;
const OX = 960;
const OY = 440;
const BUILD = 6; // L(31, 3): the build lasts until the silence
// 50.8 s: true silence. The epsilon matters: frame 3048 has lt = 5.99999…, while L(31, 3) = 6.000…01.
const SIL = BUILD - 1e-3;
const JGL_T = L(28, 2); // the JGL token is swallowed on 28.2
const P31 = L(31, 0); // « PRÊTS ? »

const orbRadius = (lt) => 60 + 200 * Math.max(0, Math.min(1, lt / BUILD)) ** 2;
const camZoom = (p6) => 1 + 0.3 * p6 ** 3;
/** Ring angle: the angular speed doubles every bar. */
const ringAngle = (lt, w0) => (lt <= 0 ? w0 * lt : (w0 * BAR * (2 ** (lt / BAR) - 1)) / Math.LN2);
/** Fragments, token and shards only exist from 28.0 (the zoom pre-roll shows just the orb, rings and lines). */
const preAlpha = (lt) => Math.max(0, Math.min(1, (lt + 0.06) / 0.12));

// ------------------------------------------------------------------ fragment sprites (static bitmaps)
function sprites(K) {
  const { C, rgba } = K;
  const mk = (key, w, h, paint) => ({ c: bitmap(`S08-${key}`, w, h, paint), w, h });
  return [
    mk('panel', 160, 104, (x) => {
      x.fillStyle = '#1e293b';
      K.roundRect(x, 4, 4, 152, 96, 14);
      x.fill();
      x.strokeStyle = rgba(C.violet2, 0.7);
      x.lineWidth = 2;
      x.stroke();
      x.fillStyle = rgba(C.cyan, 0.45);
      K.roundRect(x, 4, 4, 152, 24, [14, 14, 0, 0]);
      x.fill();
      x.fillStyle = rgba(C.muted, 0.45);
      K.roundRect(x, 18, 44, 100, 9, 4);
      x.fill();
      K.roundRect(x, 18, 64, 70, 9, 4);
      x.fill();
      x.strokeStyle = C.cyan;
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(96, 88);
      x.lineTo(112, 74);
      x.lineTo(126, 82);
      x.lineTo(144, 60);
      x.stroke();
    }),
    mk('hex', 92, 92, (x) => {
      K.hexPath(x, 46, 46, 40, 0);
      x.fillStyle = rgba(C.violet, 0.3);
      x.fill();
      x.strokeStyle = C.cyan;
      x.lineWidth = 3;
      x.stroke();
      K.hexPath(x, 46, 46, 16, 0);
      x.fillStyle = C.cyan;
      x.fill();
    }),
    ...[C.fuchsia, C.cyan, C.violet].map((col, i) => mk(`tile${i}`, 96, 82, (x) => {
      x.fillStyle = '#1e293b';
      K.roundRect(x, 3, 3, 90, 76, 14);
      x.fill();
      x.strokeStyle = rgba(C.violet2, 0.5);
      x.lineWidth = 2;
      x.stroke();
      x.fillStyle = col;
      K.roundRect(x, 12, 36, 72, 34, 9);
      x.fill();
      x.fillStyle = rgba(C.muted, 0.5);
      K.roundRect(x, 12, 14, 30, 10, 4);
      x.fill();
    })),
    ...[C.text, C.indigo].map((col, i) => mk(`bubble${i}`, 150, 76, (x) => {
      x.fillStyle = col;
      K.roundRect(x, 4, 4, 140, 52, 22);
      x.fill();
      x.beginPath();
      x.moveTo(26, 50);
      x.lineTo(14, 72);
      x.lineTo(46, 54);
      x.closePath();
      x.fill();
      x.fillStyle = C.ink;
      for (let k = 0; k < 3; k++) {
        x.beginPath();
        x.arc(52 + k * 22, 30, 6, 0, Math.PI * 2);
        x.fill();
      }
    })),
    mk('chart', 128, 92, (x) => {
      x.fillStyle = '#1e293b';
      K.roundRect(x, 4, 4, 120, 84, 14);
      x.fill();
      x.strokeStyle = rgba(C.cyan, 0.6);
      x.lineWidth = 2;
      x.stroke();
      [34, 52, 26, 60].forEach((h, k) => {
        x.fillStyle = K.linearSpectrum(x, 0, 80, 0, 10);
        x.fillRect(22 + k * 24, 76 - h, 14, h);
      });
    }),
  ];
}

let FRAGS = null; // built once from a fixed seed (static data, never mutated per frame)
function fragments(K) {
  if (FRAGS) return FRAGS;
  const R = K.rng(2808);
  const n = 40;
  FRAGS = Array.from({ length: n }, (_, i) => {
    const ts = K.lerp(-0.12, JGL_T - 0.1, i / (n - 1)) + (R() - 0.5) * 0.05;
    return {
      kind: i % 8, // index into sprites()
      ts,
      D: 0.9 + R() * 0.8,
      R0: 400 + R() * 520,
      a0: R() * Math.PI * 2,
      rot0: (R() - 0.5) * 0.9,
      spin: (R() - 0.5) * 5,
      s0: 1 + R() * 0.6,
    };
  });
  return FRAGS;
}

function fragPos(fr, lt, orbR) {
  const q = Math.max(0, Math.min(1, (lt - (fr.ts - fr.D)) / fr.D));
  const e = q * q * q;
  const r = fr.R0 + (orbR * 0.4 - fr.R0) * e;
  const a = fr.a0 + 0.25 * lt + 1.3 * q + 2.4 * e;
  return { q, e, r, a };
}

// ------------------------------------------------------------------ layers
function inwardLines(ctx, K, lt, orbR, energy) {
  const { C, rgba } = K;
  const R = K.rng(808);
  const n = 120;
  const span = 1500;
  const dist = 650 * lt + 190 * lt * Math.abs(lt);
  const cols = [C.cyan, C.violet2, C.fuchsia];
  const paths = cols.map(() => []);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2;
    const ph = R();
    const len = (90 + R() * 240) * (0.7 + energy * 0.8);
    const spd = 0.6 + R() * 0.8;
    const r = span - ((((ph * span + dist * spd) % span) + span) % span);
    if (r < orbR + 30) continue;
    paths[i % 3].push([a, r, Math.min(span, r + len)]);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  paths.forEach((list, k) => {
    const g = ctx.createRadialGradient(0, 0, orbR, 0, 0, span);
    g.addColorStop(0, rgba(cols[k], 0));
    g.addColorStop(0.06, rgba(cols[k], 0.55 * energy + 0.1));
    g.addColorStop(0.45, rgba(cols[k], 0.32 * energy + 0.05));
    g.addColorStop(1, rgba(cols[k], 0.04));
    ctx.strokeStyle = g;
    ctx.beginPath();
    for (const [a, r0, r1] of list) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.moveTo(c * r0, s * r0);
      ctx.lineTo(c * r1, s * r1);
    }
    ctx.stroke();
  });
  ctx.restore();
}

function hexStrobe(ctx, K, t) {
  const { C, rgba, E } = K;
  const cols = [C.cyan, C.fuchsia, C.violet];
  const list = eventsIn('snare', Math.max(T0 - 0.01, t - 0.6), Math.min(t, T0 + SIL));
  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  for (const s of list) {
    const q = (t - s) / 0.6;
    if (q < 0 || q >= 1) continue;
    const id = Math.round(s * 80);
    const r = 80 + 1220 * E.outCubic(q);
    ctx.strokeStyle = rgba(cols[id % 3], 0.85 * (1 - q) ** 1.6);
    K.hexPath(ctx, 0, 0, r, s * 2.1);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Intake stream: every snare launches 2–3 tiny shards on seeded spiral paths (0.5 s, inCubic) into the orb,
 * so the density follows the roll (8ths → 16ths → 32nds → 64ths). Batched strokes, no blur.
 */
function intake(ctx, K, t, lt, orbR) {
  if (lt < 0) return;
  const { C, rgba } = K;
  const cols = [C.cyan, C.violet2, C.fuchsia, '#ffffff'];
  const segs = cols.map(() => []);
  const list = eventsIn('snare', Math.max(T0 - 0.01, t - 0.5), Math.min(t, T0 + SIL));
  for (const s of list) {
    const q = (t - s) / 0.5;
    if (q < 0 || q >= 1) continue;
    const R = K.rng(Math.round(s * 1000) + 17);
    const n = R() < 0.5 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const a0 = R() * Math.PI * 2;
      const R0 = 620 + R() * 480;
      const ci = Math.floor(R() * 4);
      const maxLen = 18 + R() * 40;
      const pos = (qq) => {
        const e = qq * qq * qq;
        const r = R0 + (orbR * 0.75 - R0) * e;
        const a = a0 + 0.8 * qq + 1.9 * e;
        return [Math.cos(a) * r, Math.sin(a) * r];
      };
      const [x1, y1] = pos(q);
      let [x0, y0] = pos(Math.max(0, q - 0.04));
      // short shards, not scratches: the streak is capped in length
      const dx = x0 - x1;
      const dy = y0 - y1;
      const len = Math.hypot(dx, dy);
      const lim = Math.max(4, Math.min(len, maxLen));
      if (len > 0.01) {
        x0 = x1 + (dx / len) * lim;
        y0 = y1 + (dy / len) * lim;
      } else x0 += 4;
      segs[ci].push(x0, y0, x1, y1);
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  segs.forEach((arr, ci) => {
    if (!arr.length) return;
    ctx.strokeStyle = rgba(cols[ci], 0.9);
    ctx.beginPath();
    for (let i = 0; i < arr.length; i += 4) {
      ctx.moveTo(arr[i], arr[i + 1]);
      ctx.lineTo(arr[i + 2], arr[i + 3]);
    }
    ctx.stroke();
  });
  ctx.restore();
}

function dashedRing(ctx, r, n, fill = 0.6) {
  const circ = Math.PI * 2 * r;
  ctx.setLineDash([(circ / n) * fill, (circ / n) * (1 - fill)]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function tickedRing(ctx, r, n, major, long, short) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const l = i % major === 0 ? long : short;
    ctx.moveTo(Math.cos(a) * (r - l), Math.sin(a) * (r - l));
    ctx.lineTo(Math.cos(a) * (r + l), Math.sin(a) * (r + l));
  }
  ctx.stroke();
}

/** One more ring per bar: gold dashed + cyan ticked (bar 28), 2nd gold dashed (29.0), violet ticked (30.0). */
function rings(ctx, K, lt, orbR, choir) {
  const { C, rgba, E, seg } = K;
  // gold dashed ring, clockwise
  ctx.save();
  ctx.rotate(ringAngle(lt, 0.55));
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.shadowColor = C.gold;
  ctx.shadowBlur = 6 + 14 * choir;
  dashedRing(ctx, orbR + 60, 24);
  ctx.restore();
  // cyan ticked ring, counter-clockwise
  ctx.save();
  ctx.rotate(-ringAngle(lt, 0.45));
  ctx.strokeStyle = rgba(C.cyan, 0.85);
  ctx.lineWidth = 2.5;
  tickedRing(ctx, orbR + 120, 36, 6, 18, 9);
  ctx.restore();
  // level rings: each snaps in on its downbeat (outBack) with a short line-width flash
  const levels = [
    { t: L(29, 0), off: 180, kind: 'gold' },
    { t: L(30, 0), off: 240, kind: 'ticks' },
  ];
  for (const lv of levels) {
    const q = seg(lt, lv.t, lv.t + 0.3);
    if (q <= 0) continue;
    const e = E.outBack(q, 2.4);
    const r = orbR + 120 + (lv.off - 120) * e;
    const flash = 1 - seg(lt, lv.t, lv.t + 0.25);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, q * 4);
    if (lv.kind === 'gold') {
      ctx.rotate(-ringAngle(lt - lv.t, 0.4) + 0.3);
      ctx.strokeStyle = flash > 0.05 ? K.rgba('#fff3d6', 1) : C.gold;
      ctx.lineWidth = 2 + 6 * flash;
      dashedRing(ctx, r, 40, 0.5);
    } else {
      ctx.rotate(ringAngle(lt - lv.t, 0.35));
      ctx.strokeStyle = flash > 0.05 ? '#ffffff' : rgba(C.violet2, 0.9);
      ctx.lineWidth = 2 + 5 * flash;
      tickedRing(ctx, r, 72, 8, 16, 7);
    }
    ctx.restore();
  }
}

function orb(ctx, K, r, glow, t) {
  const { C, rgba } = K;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rb = r * 3.6;
  const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, rb);
  g.addColorStop(0, rgba(C.cyan, Math.min(0.7, 0.32 * glow)));
  g.addColorStop(0.3, rgba(C.violet, Math.min(0.4, 0.15 * glow)));
  g.addColorStop(1, rgba(C.violet, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rb, -rb, rb * 2, rb * 2);
  ctx.restore();
  const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g2.addColorStop(0, '#ffffff');
  g2.addColorStop(0.3, '#ffffff');
  g2.addColorStop(0.56, C.cyan);
  g2.addColorStop(0.82, rgba(C.violet, 0.85));
  g2.addColorStop(1, rgba(C.violet, 0));
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // energy arcs inside the core
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a = t * (5 + k * 2.5) * (k % 2 ? -1 : 1) + k * 2.1;
    ctx.strokeStyle = rgba(k === 1 ? C.fuchsia : '#ffffff', 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.5 + 0.13 * k), a, a + 1.3);
    ctx.stroke();
  }
  ctx.restore();
}

/** The JGL running gag: blamed by two « ? » pings on the kicks, dragged to the rim, then gulped on 28.2. */
const PINGS = [[L(28, 0), 92, -96], [L(28, 1), -104, -74]];
function jglToken(ctx, K, lt, orbR, alpha) {
  const { C, E, seg, clamp } = K;
  if (lt >= JGL_T || alpha <= 0) return;
  const gulp0 = JGL_T - 0.12;
  const pq = E.inCubic(seg(lt, JGL_T - 0.5, gulp0)); // dragged toward the orb's rim
  const gq = seg(lt, gulp0, JGL_T); // the gulp
  let jolt = 0;
  for (const [tp] of PINGS) if (lt >= tp) jolt += 8 * Math.exp(-(lt - tp) * 9);
  const wob = Math.sin(lt * 26) * 5 * (1 - pq);
  const rRim = orbR + 120;
  const r = K.lerp(K.lerp(400, rRim, pq) + jolt + wob, 0, E.inCubic(gq));
  const a = -2.45 + 0.35 * lt + 0.9 * pq + 1.2 * E.inCubic(gq);
  const x = Math.cos(a) * r;
  const y = Math.sin(a) * r;
  const s = gq > 0 ? 0.7 * (1 - E.inExpo(gq)) : K.lerp(1, 0.7, pq);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  // stretched toward the orb while it is being gulped
  ctx.rotate(a);
  ctx.scale(1 + 0.7 * gq, 1 - 0.35 * gq);
  ctx.rotate(-a + lt * 0.6 + (jolt / 8) * 0.18);
  ctx.scale(s, s);
  K.hexPath(ctx, 0, 0, 84, 0);
  ctx.fillStyle = '#2a1f4d';
  ctx.fill();
  ctx.strokeStyle = C.violet;
  ctx.lineWidth = 6;
  ctx.shadowColor = C.violet;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;
  K.text(ctx, 'JGL', 0, 3, { size: 50, font: K.F.russo, color: C.violet2 });
  ctx.restore();
  // blame pings, one per kick (28.0, 28.1)
  PINGS.forEach(([tp, dx, dy]) => {
    const pp = seg(lt, tp, tp + 0.36);
    if (pp <= 0 || pp >= 1) return;
    const pe = E.outBack(clamp(pp * 3), 2.5);
    ctx.save();
    ctx.globalAlpha *= alpha * (1 - E.inQuad(seg(pp, 0.6, 1)));
    ctx.translate(x + dx * s, y + dy * s - pp * 18);
    ctx.scale(pe * s, pe * s);
    ctx.fillStyle = C.fuchsia2;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 3;
    ctx.stroke();
    K.text(ctx, '?', 0, 3, { size: 46, font: K.F.russo, color: C.text });
    ctx.restore();
  });
}

/** Ink parallelogram band for the lower-third cards (sides slanted 18°). flare 0..1 thickens the edge strips. */
function inkBand(ctx, K, w, h, flare = 0) {
  const { C, rgba } = K;
  const sl = (h / 2) * Math.tan((18 * Math.PI) / 180);
  const pts = [[-w / 2 + sl, -h / 2], [w / 2 + sl, -h / 2], [w / 2 - sl, h / 2], [-w / 2 - sl, h / 2]];
  ctx.save();
  K.polyPath(ctx, pts);
  ctx.fillStyle = rgba(C.ink, 0.9);
  ctx.fill();
  ctx.clip();
  if (flare > 0) {
    ctx.fillStyle = rgba('#ffffff', 0.1 * flare);
    ctx.fillRect(-w / 2 - h, -h / 2, w + h * 2, h);
  }
  // faint −18° hatching
  ctx.strokeStyle = rgba(C.violet, 0.1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -w / 2 - h; x < w / 2 + h; x += 28) {
    ctx.moveTo(x + sl * 2, -h / 2);
    ctx.lineTo(x - sl * 2, h / 2);
  }
  ctx.stroke();
  ctx.restore();
  const th = 6 + 8 * flare;
  const dx = (th / h) * sl * 2; // keeps the strip edges on the slanted sides
  const top = [[-w / 2 + sl, -h / 2], [w / 2 + sl, -h / 2], [w / 2 + sl - dx, -h / 2 + th], [-w / 2 + sl - dx, -h / 2 + th]];
  const bot = [[-w / 2 - sl + dx, h / 2 - th], [w / 2 - sl + dx, h / 2 - th], [w / 2 - sl, h / 2], [-w / 2 - sl, h / 2]];
  ctx.fillStyle = C.cyan;
  K.polyPath(ctx, top);
  ctx.fill();
  ctx.fillStyle = C.fuchsia2;
  K.polyPath(ctx, bot);
  ctx.fill();
  if (flare > 0) {
    ctx.fillStyle = rgba('#ffffff', 0.75 * flare);
    K.polyPath(ctx, top);
    ctx.fill();
    K.polyPath(ctx, bot);
    ctx.fill();
  }
}

function bandCards(ctx, K, f, lt) {
  const { E, seg, clamp } = K;
  const end = P31;
  if (lt < 0 || lt >= end) return;
  const enter = E.outExpo(seg(lt, 0, 0.22));
  const exit = E.inCubic(seg(lt, end - 0.1, end));
  const changes = [0, L(29, 0), L(29, 2), L(30, 0), L(30, 2)];
  let idx = 0;
  changes.forEach((c, i) => {
    if (lt >= c) idx = i;
  });
  const dt = lt - changes[idx];
  const kick = Math.exp(-dt * 9);
  const flare = idx > 0 ? 1 - seg(dt, 0, 0.08) : 0;
  const prevAng = idx ? ((idx - 1) % 2 ? 1.4 : -1.8) : -1.8;
  const ang = idx % 2 ? 1.4 : -1.8;
  const angle = (K.lerp(prevAng, ang, E.outBack(clamp(dt / 0.16), 2)) * Math.PI) / 180;
  ctx.save();
  ctx.translate(960, 870);
  ctx.rotate(angle);
  ctx.scale(1 + kick * 0.03, (1 + kick * 0.03) * (1 - exit));
  // wipe in from the left
  ctx.save();
  ctx.beginPath();
  ctx.rect(-900, -200, 1800 * enter, 400);
  ctx.clip();
  inkBand(ctx, K, 1500, 190, flare);
  ctx.restore();
  ctx.translate(-960, -870);
  // card 1: jagged + strike-through on 28.3
  const c0 = f.cardsOf[0];
  const d0 = c0.durBeats * BEAT;
  if (lt < d0) {
    const a = 1 - E.inQuad(seg(lt, d0 - BEAT * 0.25, d0));
    const tS = L(28, 3);
    const i0 = c0.text.indexOf('«');
    const i1 = c0.text.indexOf('»');
    const jq = seg(lt, tS, tS + 0.08);
    const jolt = jq > 0 ? { from: i0, to: i1, amt: E.outBack(jq, 2), dim: jq } : null;
    const res = jagged(ctx, K, c0.text, 960, 868, { size: 116, p: clamp(lt / (BEAT * 1.2)), seed: 13, emph: c0.emph, alpha: a, emphCard: K.C.cyan, emphInk: K.C.ink, emphOffset: K.C.violet, jolt });
    const sp = E.outCubic(seg(lt, tS, tS + 0.15));
    if (sp > 0) {
      const xa = res.spans[i0][0] - 14;
      const xb = res.spans[i1][1] + 14;
      const xe = xa + (xb - xa) * sp;
      const slope = Math.tan((3 * Math.PI) / 180); // −3°: rising to the right
      const y0 = 880 + ((xb - xa) / 2) * slope;
      const first = lt - tS < 0.02; // one white frame as the blade lands
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = K.C.ink;
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(xa, y0);
      ctx.lineTo(xe, y0 - (xe - xa) * slope);
      ctx.stroke();
      ctx.strokeStyle = first ? '#ffffff' : K.C.fuchsia2;
      ctx.lineWidth = 10;
      ctx.shadowColor = K.C.fuchsia2;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();
    }
  }
  // cards 2–5: tight slams that stay on the band, 1.75 → 0.96 → 1 overshoot
  f.cardsOf.forEach((c) => {
    if (!c.bandSlam) return;
    const t0 = f.at(c.bar, c.beat);
    const d = c.durBeats * BEAT;
    const l = lt - t0;
    if (l < 0 || l > d) return;
    const size = K.fitSize(ctx, c.text, 1320, 132, K.F.anton);
    const a = 1 - E.inQuad(seg(l, d - BEAT * 0.25, d));
    const lin = clamp(l / 0.2);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(960, 872);
    for (let g = 2; g >= 0; g--) {
      const ge = E.outBack(clamp(lin - g * 0.12), 1.2);
      const sc = K.lerp(1.75, 1, ge);
      ctx.save();
      ctx.scale(sc, sc);
      K.text(ctx, c.text, 0, 0, { size, font: K.F.anton, emph: c.emph, glow: g ? 0 : 16, alpha: g ? 0.16 * (1 - lin) : clamp(0.45 + l / 0.04) });
      ctx.restore();
    }
    ctx.restore();
  });
  // nothing left for the generic renderer here (all S08 cards are scene-drawn), kept for the shared card pipeline
  K.renderCards(ctx, f, f.cardsOf, { x: 960, y: 870, size: 130, subSize: 54, maxW: 1320, skip: (c) => c.bandSlam });
  ctx.restore();
}

/** 31.0: « PRÊTS ? » eclipses the orb — dark disc with a living corona, slow push-in. */
function readyCard(ctx, K, f, lt) {
  const { C, E, seg, clamp } = K;
  const t0 = P31;
  if (lt < t0 || lt >= SIL) return;
  const l = lt - t0;
  const pin = E.outExpo(seg(l, 0, 0.14));
  const rgbAmt = 18 * seg(lt, t0, L(31, 2.9375));
  const cx = 960;
  const cy = 470;
  const dr = 340 * (0.55 + 0.45 * pin);
  // corona: white → cyan → violet from the disc's rim to 1.3 × its radius
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ca = Math.min(1, 0.5 + 0.3 * f.snare);
  const g = ctx.createRadialGradient(cx, cy, dr * 0.98, cx, cy, dr * 1.3);
  g.addColorStop(0, K.rgba('#ffffff', 0.9 * ca));
  g.addColorStop(0.18, K.rgba(C.cyan, 0.75 * ca));
  g.addColorStop(0.55, K.rgba(C.violet, 0.35 * ca));
  g.addColorStop(1, K.rgba(C.violet, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, dr * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = K.rgba(C.ink, 0.95);
  ctx.beginPath();
  ctx.arc(cx, cy, dr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = K.rgba(C.violet2, 0.8);
  ctx.lineWidth = 3;
  ctx.stroke();
  const str = f.cardsOf[5].text;
  const size = 380;
  const s = K.lerp(1.55, 1, pin) * (1 + 0.06 * seg(l, 0, SIL - t0));
  const jx = K.noise1(lt * 40, 3) * 2.5 * (rgbAmt / 18);
  const jy = K.noise1(lt * 40, 4) * 2.5 * (rgbAmt / 18);
  ctx.save();
  ctx.translate(cx + jx, cy + jy);
  ctx.rotate(-0.045);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(0.55 + l / 0.03); // the word is already there on the 31.0 frame
  K.text(ctx, str, 16, 18, { size, font: K.F.anton, color: C.ink, stroke: 16, strokeColor: C.ink });
  if (rgbAmt > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.text(ctx, str, -rgbAmt, 0, { size, font: K.F.anton, color: K.rgba(C.cyan2, 0.75) });
    K.text(ctx, str, rgbAmt, rgbAmt * 0.12, { size, font: K.F.anton, color: K.rgba(C.violet, 0.75) });
    ctx.restore();
  }
  K.text(ctx, str, 0, 0, { size, font: K.F.anton, color: C.fuchsia, stroke: 16, strokeColor: C.text });
  const fg = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.4);
  fg.addColorStop(0, C.fuchsia);
  fg.addColorStop(1, C.fuchsia2);
  K.text(ctx, str, 0, 0, { size, font: K.F.anton, color: fg });
  ctx.restore();
}

export default {
  id: 'S08',
  startBar: 28,
  endBar: 32,
  transitionOut: 'flash',
  cards: CARDS,
  draw(ctx, f, K) {
    const { C, E, seg, clamp, lerp } = K;
    // +1 µs: on-beat frames have lt a few 1e-15 s short of the musical position (46.4 − 44.8 = 1.5999…)
    const lt = f.lt + 1e-6;
    const t = f.t;
    const p6 = clamp(lt / BUILD);

    // ---------------- 31.3: true silence — black frame, the orb collapses to a small white dot that breathes
    if (lt >= SIL) {
      ctx.fillStyle = C.night;
      ctx.fillRect(0, 0, f.W, f.H);
      const k = E.inExpo(seg(lt, SIL, SIL + 0.1));
      const dot = 4 + E.inOutSine(seg(lt, SIL + 0.1, BUILD + BEAT));
      const r = lerp(orbRadius(BUILD) * camZoom(1), dot, k);
      if (k < 1) {
        const g = ctx.createRadialGradient(OX, OY, 0, OX, OY, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3 + 0.7 * k, '#ffffff');
        g.addColorStop(Math.min(1, 0.56 + 0.44 * k), C.cyan);
        g.addColorStop(1, K.rgba(C.violet, k));
        ctx.fillStyle = g;
      } else ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(OX, OY, r, 0, Math.PI * 2);
      ctx.fill();
      return { auto: false, shake: 0, rgb: 0, zoom: 0, flash: 0 };
    }

    // ---------------- world
    K.background(ctx, f, { warm: 0.35, intensity: 0.75 + 0.55 * p6, grid: false });
    particleField(ctx, f, K, { alpha: 0.7, seed: 88, speed: 1 + p6 });

    const kickPulse = lt >= -0.01 ? f.kick : 0;
    const pre = preAlpha(lt);
    let gulp = 0;
    const frs = fragments(K);
    for (const fr of frs) if (lt >= fr.ts) gulp += Math.exp(-(lt - fr.ts) * 14);
    const jglKick = lt >= JGL_T ? (1 - seg(lt, JGL_T, JGL_T + 0.15)) ** 2 : 0;
    const orbR = orbRadius(lt) * (1 + 0.06 * kickPulse + 0.025 * Math.min(2.5, gulp) + 0.12 * jglKick);
    const riser = p6 ** 2;
    const choir = 0.5 + 0.5 * Math.sin(lt * 1.9);

    const tilt = ((lerp(1, 3, p6) * Math.PI) / 180) * Math.sin((lt / BAR) * Math.PI * 2);
    const zoom = camZoom(p6);
    ctx.save();
    ctx.translate(OX, OY);
    ctx.rotate(tilt);
    ctx.scale(zoom, zoom);

    inwardLines(ctx, K, lt, orbR, 0.35 + 0.65 * p6);
    hexStrobe(ctx, K, t);
    intake(ctx, K, t, lt, orbR);

    // fragments spiral in (drawn under the rings and the orb); invisible during the zoom pre-roll
    if (pre > 0) {
      const spr = sprites(K);
      for (const fr of frs) {
        const { q, e, r, a } = fragPos(fr, lt, orbR);
        if (q >= 1) continue;
        const sp = spr[fr.kind];
        const s = fr.s0 * lerp(1, 0.12, e);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        ctx.save();
        ctx.globalAlpha *= (1 - seg(q, 0.9, 1)) * pre;
        if (q > 0.35) {
          // motion streak along the spiral
          const back = fragPos(fr, lt - 0.06, orbR);
          ctx.strokeStyle = K.rgba(C.cyan, 0.35);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(back.a) * back.r, Math.sin(back.a) * back.r);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        ctx.translate(x, y);
        ctx.rotate(fr.rot0 + fr.spin * q);
        ctx.scale(s, s);
        ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2);
        ctx.restore();
      }
    }
    jglToken(ctx, K, lt, orbR, pre);

    rings(ctx, K, lt, orbR, choir);
    orb(ctx, K, orbR, 0.9 + 1.6 * riser + 0.6 * kickPulse + 1.2 * jglKick, t);

    // swallow sparks at the orb's rim
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const fr of frs) {
      const k = (lt - fr.ts) / 0.2;
      if (k < 0 || k >= 1) continue;
      const a = fragPos(fr, fr.ts, orbR).a;
      ctx.strokeStyle = K.rgba('#ffffff', 0.8 * (1 - k) * pre);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * orbR * 0.9, Math.sin(a) * orbR * 0.9);
      ctx.lineTo(Math.cos(a) * orbR * (1.15 + 0.5 * k), Math.sin(a) * orbR * (1.15 + 0.5 * k));
      ctx.stroke();
    }
    ctx.restore();
    // 28.0 landing: a thin cyan shockwave off the orb
    const land = seg(lt, 0, 0.5);
    if (land > 0 && land < 1) {
      ctx.save();
      ctx.globalAlpha *= 0.4;
      K.shockwave(ctx, 0, 0, land, { color: C.cyan, maxR: 520, width: 6, sparks: 8, seed: 280 });
      ctx.restore();
    }
    // the JGL token's violet pop
    const pop = seg(lt, JGL_T, JGL_T + 0.4);
    if (pop > 0 && pop < 1) K.shockwave(ctx, 0, 0, pop, { color: C.violet, maxR: orbR + 260, width: 18, sparks: 12, seed: 28 });
    ctx.restore();

    // ---------------- riser veil (≤ 20 %), beneath the text layer
    if (riser > 0.005) {
      const a = 0.18 * riser;
      const g = ctx.createRadialGradient(OX, OY, 0, OX, OY, 1100);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.45, `rgba(255,255,255,${a * 0.45})`);
      g.addColorStop(1, `rgba(255,255,255,${a * 0.08})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, f.W, f.H);
    }

    // ---------------- cards
    bandCards(ctx, K, f, lt);
    readyCard(ctx, K, f, lt);
    brandBug(ctx, K, 0.55);

    // FX: a soft landing on 28.0 and a real hit on « PRÊTS ? » (no sub on screen, total shake ≤ 10 px)
    let flash = 0;
    let rgb = 0;
    let shake = 3 * kickPulse;
    if (lt >= 0 && lt < 0.2) flash = 0.12 * Math.exp(-lt * 14);
    if (lt >= P31) {
      const e = Math.exp(-(lt - P31) * 12);
      flash = 0.22 * e;
      rgb = 10 * e;
      shake = 3 * kickPulse + 6 * e;
    }
    return { auto: false, shake, rgb, zoom: 0, flash };
  },
};
