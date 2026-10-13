// S03 — « La boucle se retourne » (build 1, bars 8–12).
// The vicious LOOP RING (JOUE · PERDS · OUBLIE) slams in on 8.0, then escalates bar by bar (base colour,
// stroke weight, echo rings, speed lines, push-in). Each giant word (Joue. / Analyse. / Recommence.) lands,
// then flies into its node slot and becomes the ring label: the loop turns into the signature
// JOUE · ANALYSE · RECOMMENCE. A full-height 5-4-3-2-1 countdown follows (the « 5 » is the 5 of the NXT5
// logo). The last beat of bar 11 is true silence: the frame is crushed to near-black around the frozen « 1 »
// while a crack of light leaks through it, until the renderer shatters it on 12.0.
// Pure function of f: every animation is derived from f.t / f.lt and the static event list.
import { readFileSync } from 'node:fs';

const EV = JSON.parse(readFileSync(new URL('../out/music.events.json', import.meta.url), 'utf8'));
const SNARES = EV.snare || [];

const BEAT = 0.4;
const BAR = 1.6;
const bt = (bar, beat = 0) => bar * BAR + beat * BEAT; // absolute seconds
const START = bt(8);
const loc = (bar, beat = 0) => bt(bar, beat) - START; // local seconds
const T_FREEZE = bt(11, 3); // 18.8 s: the music bus is muted until the 12.0 impact
const T_END = bt(12);
const SCENE = { startBar: 8, endBar: 12 };
const NB = ' ';
const DEG = Math.PI / 180;
const CUT = -18 * DEG;
const RC = { x: 960, y: 440 }; // loop ring centre
const R0 = 250;
const GIANT_Y = 770; // giant words sit under the ring, clear of the node labels
const LABEL = 70; // node label size (Bebas)

const CARDS = [
  { bar: 8, beat: 0, durBeats: 4, text: `Et si tu savais pourquoi${NB}?`, emph: 'pourquoi', sub: '', style: 'jagged', sceneDrawn: true },
  { bar: 9, beat: 0, durBeats: 2, text: 'Joue.', emph: '', sub: '', style: 'giant', sceneDrawn: true },
  { bar: 9, beat: 2, durBeats: 2, text: 'Analyse.', emph: 'Analyse.', sub: '', style: 'giant', sceneDrawn: true },
  { bar: 10, beat: 0, durBeats: 2, text: 'Recommence.', emph: 'Recommence.', sub: '', style: 'giant', sceneDrawn: true },
  { bar: 10, beat: 2, durBeats: 1, text: '5', emph: '5', sub: '', style: 'giant', sceneDrawn: true },
  { bar: 10, beat: 3, durBeats: 1, text: '4', emph: '', sub: '', style: 'giant', sceneDrawn: true },
  { bar: 11, beat: 0, durBeats: 1, text: '3', emph: '', sub: '', style: 'giant', sceneDrawn: true },
  { bar: 11, beat: 1, durBeats: 1, text: '2', emph: '', sub: '', style: 'giant', sceneDrawn: true },
  { bar: 11, beat: 2, durBeats: 2, text: '1', emph: '', sub: '', style: 'giant', sceneDrawn: true },
];

// Node flips: each giant word slams on its downbeat, then on the next .5 (a snare) it flies into its slot.
const FLY = 0.16; // flight duration (outQuart)
const LAND = 0.05; // the label swaps once the word has mostly arrived
const NODES = [
  { a: -90, from: 'JOUE', to: 'JOUE', card: CARDS[1], tf: loc(9, 1.5), cyan: true },
  { a: 30, from: 'PERDS', to: 'ANALYSE', card: CARDS[2], tf: loc(9, 3.5), glitch: loc(9, 2) },
  { a: 150, from: 'OUBLIE', to: 'RECOMMENCE', card: CARDS[3], tf: loc(10, 1.5) },
];
const T_COUNT = loc(10, 2);

// countdown digits: tint colour of the upper-left half and offset of the diagonal cut
const DIGITS = [
  { n: '5', t: loc(10, 2), tint: 'violet', off: -110, five: true },
  { n: '4', t: loc(10, 3), tint: 'cyan', off: 90 },
  { n: '3', t: loc(11, 0), tint: 'indigo', off: -60 },
  { n: '2', t: loc(11, 1), tint: 'fuchsia2', off: 120 },
  { n: '1', t: loc(11, 2), tint: 'blue', off: 0 },
];

// The « 5 » of the NXT5 logo: same angular outline and italic slant as K.logo's 5 (kit FIVE geometry).
const FIVE_PTS = (() => {
  const s = 0.24;
  const pts = [[0, 0], [205, 0], [205, 56], [74, 56], [74, 84], [176, 84], [208, 113], [208, 184], [176, 213], [0, 213], [0, 160], [132, 160], [132, 137], [0, 137]];
  const xy = pts.map(([u, y]) => [808 + u + s * (213 - y), y + 2]);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return xy.map(([x, y]) => [x - cx, y - cy]); // centred
})();
const FIVE_SCALE = 3.9; // ≈ 830 px tall

// ------------------------------------------------------------------ helpers
/** Static bitmap: two -18° halftone bands (violet, cyan) — built once, then only drawn with alpha. */
let BAND_DOTS = null;
function bandDots(K) {
  if (BAND_DOTS) return BAND_DOTS;
  const { createCanvas } = globalThis.__canvasMod;
  const sp = 18;
  const M = sp * 2;
  const c = createCanvas(1920 + 2 * M, 1080 + 2 * M);
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2);
  x.rotate(CUT);
  const span = Math.hypot(c.width, c.height);
  for (const [b0, b1, col] of [[0.12, 0.4, K.C.violet2], [0.6, 0.88, K.C.cyan]]) {
    x.fillStyle = col;
    x.beginPath();
    let n = 0;
    for (let yy = -span / 2; yy < span / 2; yy += sp) {
      const u = (yy + span / 2) / span;
      if (u <= b0 || u >= b1) continue;
      const bu = (u - b0) / (b1 - b0);
      for (let xx = -span / 2; xx < span / 2; xx += sp) {
        const r = 5 * Math.sin(bu * Math.PI) * (0.65 + 0.35 * Math.sin(xx * 0.004));
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
  }
  BAND_DOTS = { c, M };
  return BAND_DOTS;
}

const frac = (x) => ((x % 1) + 1) % 1;

/** Ring decoration rotation: 20, 40, 80, 160 °/s over bars 8..11. */
function ringRot(lt) {
  if (lt < 0) return lt * 20 * DEG;
  const rates = [20, 40, 80, 160];
  let a = 0;
  for (let i = 0; i < 4; i++) a += Math.min(Math.max(lt - i * BAR, 0), BAR) * rates[i];
  return a * DEG;
}

/** Brand bug (always-on layer). */
function brandBug(ctx, K) {
  K.logo(ctx, 1772, 62, 150, { alpha: 0.55, glow: 6, lineWidth: 2.4 });
}

/** Accelerating inward vacuum: streaks fall toward the ring centre. */
function vacuum(ctx, f, K, s) {
  const { C, rgba, rng } = K;
  const lt = Math.max(-0.4, f.lt);
  const A = 0.12 * lt + 0.0075 * lt * lt * lt; // travelled fraction (accelerates)
  const v = 0.12 + 0.0225 * lt * lt; // fraction / s
  const Rmax = 1250;
  const cols = [C.cyan, C.violet2, C.fuchsia];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.strokeStyle = rgba(cols[k], 0.55);
    ctx.lineWidth = k === 0 ? 2.2 : 1.6;
    const R2 = rng(200 + k);
    for (let i = 0; i < 56; i++) {
      const th = R2() * Math.PI * 2;
      const z = 0.4 + R2() * 0.6;
      const ph = R2();
      const rr = Rmax * (1 - frac(ph + A * z));
      if (rr < 90 * s) continue;
      const len = 4 + Math.max(0, v) * z * Rmax * 0.09;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      ctx.moveTo(RC.x + c * rr, RC.y + sn * rr);
      ctx.lineTo(RC.x + c * (rr + len), RC.y + sn * (rr + len));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Radial speed-line burst per snare hit (life 0.15 s): 3–4 px streaks with ink edges, 1.5× from bar 10. */
function snareBursts(ctx, f, K, alpha = 1) {
  const { C, rgba, rng } = K;
  const LIFE = 0.15;
  const live = [];
  for (let j = 0; j < SNARES.length; j++) {
    const s = SNARES[j];
    const age = f.t - s;
    if (age < 0 || age > LIFE || s < START - 0.01) continue;
    live.push([j, s, age / LIFE]);
  }
  if (!live.length) return;
  const lines = [];
  for (const [j, s, q] of live) {
    const R = rng(900 + j);
    const n = s >= bt(10) - 0.01 ? 33 : 22;
    const a = alpha * 0.75 * (1 - q) ** 1.4;
    for (let i = 0; i < n; i++) {
      const th = R() * Math.PI * 2;
      const len = 200 + R() * 500;
      const r0 = 270 + R() * 160 + q * (900 + R() * 600);
      const col = R() < 0.55 ? '#ffffff' : C.cyan;
      const w = 3 + R();
      const c = Math.cos(th);
      const sn = Math.sin(th);
      lines.push([RC.x + c * r0, RC.y + sn * r0, RC.x + c * (r0 + len), RC.y + sn * (r0 + len), col, a, w]);
    }
  }
  ctx.save();
  ctx.lineCap = 'butt';
  // ink edges first (source-over), then the light (lighter)
  for (const [x0, y0, x1, y1, , a, w] of lines) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(2,6,17,0)');
    g.addColorStop(1, `rgba(2,6,17,${0.7 * a})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = w + 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const [x0, y0, x1, y1, col, a, w] of lines) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(1, rgba(col, a));
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** One thin concentric echo ring per snare, expanding r → 1.68 r (outline only). */
function echoRings(ctx, f, K, st, alpha) {
  const { C, rgba, E } = K;
  const LIFE = 0.32;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  for (let j = 0; j < SNARES.length; j++) {
    const s = SNARES[j];
    const age = f.t - s;
    if (age < 0 || age > LIFE || s < START - 0.01) continue;
    const q = age / LIFE;
    const r = st.r * (1 + 0.68 * E.outCubic(q));
    ctx.strokeStyle = rgba(st.specQ > 0.5 ? C.violet2 : C.fuchsia, alpha * 0.55 * (1 - q));
    ctx.beginPath();
    ctx.arc(st.cx, st.cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Persona letters (kit jaggedText variant): treats U+00A0 as a narrow space and fits maxW. */
function jagged(ctx, K, str, x, y, opts = {}) {
  const { C, E, clamp, rng, F } = K;
  const { p = 1, seed = 13, emph = '', maxW = 1500 } = opts;
  let size = opts.size || 120;
  const chars = [...str];
  const isSp = (ch) => ch === ' ' || ch === NB;
  ctx.save();
  ctx.font = F.anton(size);
  const widths = (sz) => chars.map((ch) => (ch === ' ' ? sz * 0.32 : ch === NB ? sz * 0.16 : (ctx.measureText(ch).width * sz) / size * 1.08 + sz * 0.06));
  let ws = widths(size);
  let total = ws.reduce((a, b) => a + b, 0);
  if (total > maxW) {
    size = Math.floor((size * maxW) / total);
    ctx.font = F.anton(size);
    ws = chars.map((ch) => (ch === ' ' ? size * 0.32 : ch === NB ? size * 0.16 : ctx.measureText(ch).width * 1.08 + size * 0.06));
    total = ws.reduce((a, b) => a + b, 0);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const R = rng(seed);
  const emphStart = emph ? str.indexOf(emph) : -1;
  let cx = x - total / 2;
  const n = chars.filter((c) => !isSp(c)).length;
  let k = 0;
  chars.forEach((ch, i) => {
    const w = ws[i];
    const rot = (R() - 0.5) * 0.28;
    const sc = 0.88 + R() * 0.3;
    const dy = (R() - 0.5) * size * 0.14;
    const style = R();
    if (!isSp(ch)) {
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
}

/** Half-plane polygon on the upper-left side of a CUT-angled line through (px, py). */
function upperLeft(ctx, px, py) {
  const dx = Math.cos(CUT);
  const dy = Math.sin(CUT);
  const nx = Math.sin(CUT); // normal pointing up-left
  const ny = -Math.cos(CUT);
  const L = 4000;
  ctx.beginPath();
  ctx.moveTo(px - dx * L, py - dy * L);
  ctx.lineTo(px + dx * L, py + dy * L);
  ctx.lineTo(px + dx * L + nx * L, py + dy * L + ny * L);
  ctx.lineTo(px - dx * L + nx * L, py - dy * L + ny * L);
  ctx.closePath();
}
function lowerRight(ctx, px, py) {
  const dx = Math.cos(CUT);
  const dy = Math.sin(CUT);
  const nx = -Math.sin(CUT);
  const ny = Math.cos(CUT);
  const L = 4000;
  ctx.beginPath();
  ctx.moveTo(px - dx * L, py - dy * L);
  ctx.lineTo(px + dx * L, py + dy * L);
  ctx.lineTo(px + dx * L + nx * L, py + dy * L + ny * L);
  ctx.lineTo(px - dx * L + nx * L, py - dy * L + ny * L);
  ctx.closePath();
}

// ------------------------------------------------------------------ loop ring
function drawRing(ctx, f, K, st) {
  const { C, rgba, linearSpectrum } = K;
  const { alpha, rot, specQ, glowW, cx, cy, lw } = st;
  const r = st.r;
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // stroke (fuchsia -> spectrum), fake glow with wide translucent passes
  const spec = linearSpectrum(ctx, cx - r, cy + r, cx + r, cy - r);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[glowW, 0.07], [glowW * 0.45, 0.14]]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = rgba(C.fuchsia2, a * (1 - specQ));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (specQ > 0) {
      ctx.globalAlpha = alpha * a * specQ * 1.6;
      ctx.strokeStyle = spec;
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }
  }
  ctx.restore();
  ctx.lineWidth = lw + 2.5 * f.env('snare', 16);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (specQ < 1) {
    ctx.strokeStyle = C.fuchsia2;
    ctx.stroke();
  }
  if (specQ > 0) {
    ctx.save();
    ctx.globalAlpha *= specQ;
    ctx.strokeStyle = spec;
    ctx.stroke();
    ctx.restore();
  }
  // rotating ticks, flashing on snares
  const flash = f.env('snare', 14);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.strokeStyle = specQ > 0.5 ? rgba(C.cyan, 0.35 + 0.65 * flash) : rgba(C.fuchsia, 0.35 + 0.65 * flash);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const l = i % 6 === 0 ? 22 : 9;
    ctx.moveTo(Math.cos(a) * (r - 10 - lw / 2), Math.sin(a) * (r - 10 - lw / 2));
    ctx.lineTo(Math.cos(a) * (r - 10 - lw / 2 - l), Math.sin(a) * (r - 10 - lw / 2 - l));
  }
  ctx.stroke();
  // inner counter-rotating ring + soft core glow
  ctx.save();
  ctx.rotate(-rot * 1.6);
  ctx.setLineDash([4, 10, 26, 10]);
  ctx.strokeStyle = rgba(specQ > 0.5 ? C.cyan : C.fuchsia, 0.32);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  core.addColorStop(0, rgba(specQ > 0.5 ? C.violet : C.fuchsia2, 0.16 + 0.1 * f.kick));
  core.addColorStop(1, rgba(C.fuchsia2, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // dashed outer orbit
  ctx.setLineDash([14, 18]);
  ctx.strokeStyle = rgba(specQ > 0.5 ? C.violet2 : C.fuchsia, 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, r + 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // arrowheads (clockwise loop)
  const arrowCols = [C.cyan, C.violet, C.fuchsia];
  const ah = 1 + lw / 10;
  for (let k = 0; k < 3; k++) {
    const a = (k * 120 + 60) * DEG;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a + Math.PI / 2);
    ctx.scale(ah, ah);
    const col = specQ > 0.5 ? arrowCols[k] : C.fuchsia2;
    if (specQ > 0) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 18 * specQ;
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -13);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // scanner beam: 30° arc, one orbit per beat
  const sa = f.beat * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = rgba(C.cyan, 0.15 + i * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 12 + lw / 2, sa - (30 - i * 5) * DEG, sa - (25 - i * 5) * DEG);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + Math.cos(sa) * (r + 12 + lw / 2), cy + Math.sin(sa) * (r + 12 + lw / 2), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Label anchor of node i on the ring described by st. */
function labelSpot(ctx, K, st, i, label) {
  const nd = NODES[i];
  const a = nd.a * DEG;
  const nx = st.cx + Math.cos(a) * st.r;
  const ny = st.cy + Math.sin(a) * st.r;
  const w = K.measure(ctx, label, LABEL, K.F.bebas, 3);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  let lx = nx + ca * 46;
  let ly = ny + sa * 46;
  if (Math.abs(ca) > 0.3) lx += Math.sign(ca) * (w / 2 + 14);
  if (sa < -0.5) ly -= LABEL * 0.5;
  else ly += LABEL * 0.3;
  return { nx, ny, lx, ly, w };
}

/** Node state at local time lt. */
function nodeState(i, lt) {
  const nd = NODES[i];
  const flipped = lt >= nd.tf + LAND;
  return { flipped, label: flipped ? nd.to : nd.from };
}

function drawNodes(ctx, f, K, st, nodeAlpha) {
  const { C, rgba, clamp, seg, E, rng } = K;
  const { cx, cy } = st;
  const lt = f.lt;
  NODES.forEach((nd, i) => {
    const { flipped, label } = nodeState(i, lt);
    const sp = labelSpot(ctx, K, st, i, label);
    const { nx, ny } = sp;
    const dl = lt - (nd.tf + LAND); // since the label landed
    const cyanNode = flipped && nd.cyan;
    const specNode = flipped && !nd.cyan;
    // flipped nodes stay at full brightness until the countdown; the others follow the ring
    const na = lt >= T_COUNT ? nodeAlpha : flipped ? 1 : nodeAlpha;
    if (na <= 0.002) return;
    // landing shockwave + flash at the node
    if (dl > 0 && dl < 0.45) K.shockwave(ctx, nx, ny, dl / 0.45, { color: specNode ? C.violet : C.cyan, maxR: 150, width: 14, sparks: 8, seed: 31 + i });
    ctx.save();
    ctx.globalAlpha *= na;
    // node disc (pulses on kicks, pops on the ring slam and on the landing)
    const slamPop = lt >= 0 ? 1 + 0.6 * (1 - E.outCubic(clamp(lt / 0.3))) : 1;
    const landPop = dl >= 0 ? 1 + 0.5 * (1 - E.outCubic(clamp(dl / 0.25))) : 1;
    const pulse = (1 + f.kick * 0.18) * slamPop * landPop;
    ctx.save();
    ctx.translate(nx, ny);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cyanNode ? C.cyan : specNode ? K.linearSpectrum(ctx, -16, 16, 16, -16) : C.fuchsia;
    ctx.beginPath();
    ctx.arc(0, 0, 15 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = cyanNode || specNode ? rgba(C.text, 0.95) : rgba(C.fuchsia, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // label on a small ink pill, radially outside the node (pops in right after the 8.0 slam frame)
    const lp = dl >= 0 ? 1 + 0.22 * (1 - E.outBack(clamp(dl / 0.22), 2)) : 1;
    ctx.save();
    ctx.globalAlpha *= clamp((lt - 0.03) / 0.05);
    ctx.translate(sp.lx, sp.ly);
    ctx.scale(lp, lp);
    const pw = sp.w + 30;
    const ph = LABEL * 0.98;
    ctx.fillStyle = rgba(C.ink, 0.78);
    K.roundRect(ctx, -pw / 2, -ph / 2 - 4, pw, ph, 10);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = cyanNode ? rgba(C.cyan, 0.75) : specNode ? rgba(C.violet2, 0.75) : rgba(C.fuchsia, 0.45);
    ctx.stroke();
    const col = cyanNode ? C.cyan : '#e879f9';
    if (nd.glitch != null && lt > nd.glitch - 0.02 && lt < nd.glitch + BEAT * 0.25 + 0.04) {
      const R = rng(Math.floor(f.t * 60) + 7);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      K.text(ctx, label, -9 - R() * 8, (R() - 0.5) * 8, { size: LABEL, font: K.F.bebas, color: C.cyan2, spacing: 3, alpha: 0.85 });
      K.text(ctx, label, 9 + R() * 8, (R() - 0.5) * 8, { size: LABEL, font: K.F.bebas, color: C.fuchsia2, spacing: 3, alpha: 0.85 });
      ctx.restore();
    }
    K.text(ctx, label, 0, 0, {
      size: LABEL, font: K.F.bebas, color: col, spacing: 3,
      emph: specNode ? label : '', glow: cyanNode || specNode ? 14 : 0, glowColor: cyanNode ? C.cyan2 : C.fuchsia,
    });
    // white flash on the label right after the landing
    if (dl >= 0 && dl < 0.12) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      K.text(ctx, label, 0, 0, { size: LABEL, font: K.F.bebas, color: '#ffffff', spacing: 3, alpha: 0.8 * (1 - dl / 0.12) });
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
    void seg;
    void cx;
    void cy;
  });
}

/** Giant word: slams on its downbeat, then flies into its node slot and becomes the label. */
function drawGiant(ctx, f, K, st, i) {
  const { C, E, clamp, seg } = K;
  const nd = NODES[i];
  const c = nd.card;
  const t0 = loc(c.bar, c.beat);
  const lt = f.lt - t0;
  if (lt < 0) return;
  const fly = f.lt - nd.tf;
  if (fly > FLY) return;
  const size = K.fitSize(ctx, c.text, 1500, 225, K.F.anton);
  if (fly < 0) {
    K.slamText(ctx, c.text, 960, GIANT_Y, { size, p: clamp((lt / BEAT) * 1.4), emph: c.emph });
    return;
  }
  // flight: Anton word -> node label slot (outQuart), with two ghost trails, fading as the label lands
  const sp = labelSpot(ctx, K, st, i, nd.to);
  const gw = K.measure(ctx, c.text, size, K.F.anton);
  const k1 = (sp.w / gw) * 1.08;
  const at = (q) => {
    const e = E.outQuart(clamp(q));
    return [K.lerp(960, sp.lx, e), K.lerp(GIANT_Y, sp.ly, e), K.lerp(1, k1, e)];
  };
  const q = fly / FLY;
  for (const [dq, a] of [[0.34, 0.16], [0.17, 0.3], [0, 1]]) {
    const qq = q - dq;
    if (qq < 0) continue;
    const [x, y, s] = at(qq);
    ctx.save();
    ctx.globalAlpha *= a * (1 - seg(q, 0.5, 1));
    ctx.translate(x, y);
    ctx.scale(s, s);
    K.text(ctx, c.text, 0, 0, { size, font: K.F.anton, color: C.text, emph: c.emph, glow: dq ? 0 : 24 });
    ctx.restore();
  }
}

// ------------------------------------------------------------------ countdown
function glyphMetrics(ctx, K, n) {
  const fs = 1180;
  ctx.save();
  ctx.font = K.F.anton(fs);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(n);
  ctx.restore();
  return { fs, m, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}

function fivePath(ctx) {
  ctx.beginPath();
  FIVE_PTS.forEach(([x, y], i) => (i ? ctx.lineTo(x * FIVE_SCALE, y * FIVE_SCALE) : ctx.moveTo(x * FIVE_SCALE, y * FIVE_SCALE)));
  ctx.closePath();
}

/**
 * One countdown digit on its own -18° split. opts.band draws the ink band on the cut; opts.edge (0..1)
 * brightens the glyph edges (last frames of the held breath).
 */
function drawDigit(ctx, f, K, d, opts = {}) {
  const { C, rgba, E, clamp } = K;
  const { band = true, edge = 0 } = opts;
  const lt = f.lt - d.t;
  const e = E.outExpo(clamp(lt / 0.14));
  const sc = 1.3 - 0.3 * e;
  const px = 960 + d.off;
  const py = 540;
  if (band) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(CUT);
    ctx.fillStyle = rgba(C.ink, 0.85);
    ctx.fillRect(-2400, -13, 4800, 26);
    ctx.fillStyle = rgba(C[d.tint], 0.9);
    ctx.fillRect(-2400, -15, 4800, 3);
    ctx.restore();
  }
  const G = d.five ? null : glyphMetrics(ctx, K, d.n);
  const gy = G ? (G.asc - G.desc) / 2 : 0; // baseline offset to centre the glyph
  const shape = (fill, stroke, lw) => {
    if (d.five) {
      fivePath(ctx);
      if (fill) ctx.fill();
      if (stroke) {
        ctx.lineWidth = lw;
        ctx.stroke();
      }
      return;
    }
    if (fill) ctx.fillText(d.n, 0, gy);
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeText(d.n, 0, gy);
    }
  };
  const glyph = (ox, oy) => {
    ctx.save();
    ctx.translate(960 + ox, 540 + oy);
    ctx.scale(sc, sc);
    if (G) {
      ctx.font = K.F.anton(G.fs);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
    }
    ctx.lineJoin = 'miter';
    // ink drop shadow
    ctx.save();
    ctx.translate(22, 22);
    ctx.fillStyle = rgba(C.ink, 0.9);
    shape(true, false);
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    shape(false, true, 20);
    if (d.five) {
      const g = ctx.createLinearGradient(-500, 420, 500, -420);
      g.addColorStop(0, C.cyan2);
      g.addColorStop(0.5, C.blue);
      g.addColorStop(1, C.fuchsia2);
      ctx.fillStyle = g;
    } else ctx.fillStyle = C.text;
    shape(true, false);
    if (edge > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(C.cyan, 0.5 * edge);
      shape(false, true, 34);
      ctx.strokeStyle = rgba('#ffffff', 0.9 * edge);
      shape(false, true, 8);
      ctx.restore();
    }
    ctx.restore();
  };
  // sliced glyph: upper-left half slides 16 px along the cut
  const sl = 16 * (1 - 0.4 * e);
  ctx.save();
  lowerRight(ctx, px, py);
  ctx.clip();
  glyph(0, 0);
  ctx.restore();
  ctx.save();
  upperLeft(ctx, px, py);
  ctx.clip();
  glyph(-Math.cos(CUT) * sl, -Math.sin(CUT) * sl);
  ctx.restore();
}

/** Cyan horizon hairline at y = 540 (0..1 growth). */
function horizon(ctx, K, rise) {
  const { C, rgba, E } = K;
  const hw = 1920 * E.outCubic(rise);
  if (hw <= 2) return;
  const th = 1 + 3 * rise;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hg = ctx.createLinearGradient(960 - hw / 2, 0, 960 + hw / 2, 0);
  hg.addColorStop(0, rgba(C.cyan, 0));
  hg.addColorStop(0.5, rgba(C.cyan, 0.9));
  hg.addColorStop(1, rgba(C.cyan, 0));
  ctx.fillStyle = hg;
  ctx.fillRect(960 - hw / 2, 540 - th / 2, hw, th);
  ctx.globalAlpha = 0.18;
  ctx.fillRect(960 - hw / 2, 540 - th * 3, hw, th * 6);
  ctx.restore();
}

// ------------------------------------------------------------------ the scene body (also used frozen)
function paint(ctx, f, K) {
  const { C, rgba, clamp, seg, E } = K;
  const lt = f.lt;
  const fx = { shake: 0, rgb: 0, zoom: 0 };
  const rise = seg(lt, 0, 5.6); // riser 8.0 -> 11.2

  // background, stepping navy -> indigo -> violet on 8.0 / 9.0 / 10.0, + lift toward #1e1b4b at the centre
  K.background(ctx, f, { intensity: 1 + rise * 0.4, grid: true });
  const step = lt >= loc(10) ? '#2e1065' : lt >= loc(9) ? '#1e1b4b' : null;
  if (step) {
    const sg = ctx.createRadialGradient(RC.x, RC.y + 80, 60, RC.x, RC.y + 80, 1250);
    sg.addColorStop(0, rgba(step, 0.8));
    sg.addColorStop(0.6, rgba(step, 0.6));
    sg.addColorStop(1, rgba(step, 0.3));
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, 1920, 1080);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lift = ctx.createRadialGradient(RC.x, RC.y + 60, 0, RC.x, RC.y + 60, 1100);
  lift.addColorStop(0, rgba('#1e1b4b', 0.25 + 0.75 * rise));
  lift.addColorStop(0.55, rgba('#1e1b4b', 0.45 * rise));
  lift.addColorStop(1, rgba('#1e1b4b', 0));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.restore();

  // halftone flashes on snares (two -18° bands)
  const sn = f.env('snare', 16);
  if (lt > 0 && sn > 0.04) {
    const { c, M } = bandDots(K);
    const off = (f.t * 30) % 18;
    ctx.save();
    ctx.globalAlpha = 0.04 + 0.14 * sn;
    ctx.drawImage(c, -M + Math.cos(CUT) * off, -M + Math.sin(CUT) * off);
    ctx.restore();
  }

  // ring scale: push-in 1 -> 1.35 + kick pulse on bars 8-9
  const push = 1 + 0.35 * E.inCubic(clamp(lt / 6.4));
  const kickPulse = lt >= 0 && lt < loc(10) ? 1 + 0.03 * f.kick : 1;
  const s = push * kickPulse;

  vacuum(ctx, f, K, s);
  if (lt < 0) return fx; // S02's ring carries the zoom: background + vacuum only

  // countdown tint + digit split are drawn under the ring
  const dActive = [...DIGITS].reverse().find((d) => lt >= d.t);

  horizon(ctx, K, rise);

  // ring state: slams in on the 8.0 downbeat (alpha 0 -> 1 in 2 frames, scale 1.15 -> 1)
  const slamA = clamp((lt + 1 / 60) / (2 / 60));
  const slamS = 1 + 0.15 * (1 - E.outExpo(clamp(lt / 0.3)));
  const giantOn = lt >= loc(9) - 0.04 && lt < T_COUNT;
  const countOn = lt >= T_COUNT;
  const ringA = (countOn ? 0.25 : giantOn ? 0.35 : 1) * slamA;
  const nodeA = (countOn ? 0.35 * (1 - seg(lt, T_COUNT, T_COUNT + 0.12)) : giantOn ? 0.35 : 1) * slamA;
  const specQ = seg(lt, NODES[2].tf + LAND, NODES[2].tf + LAND + 0.1);
  const glowW = 12 + 20 * seg(lt, 0, loc(11, 2));
  const lw = lt >= loc(10) ? 8 : lt >= loc(9) ? 6 : 4;
  const st = { cx: RC.x, cy: RC.y, r: R0 * s * slamS, alpha: ringA, rot: ringRot(lt), specQ, glowW, lw };

  if (dActive) {
    ctx.save();
    upperLeft(ctx, 960 + dActive.off, 540);
    ctx.fillStyle = rgba(C[dActive.tint], 0.35 * clamp((lt - dActive.t) / 0.05));
    ctx.fill();
    ctx.restore();
  }
  // slam shockwave from the ring centre (8.0)
  if (lt < 0.55) K.shockwave(ctx, RC.x, RC.y, lt / 0.55, { color: C.fuchsia, maxR: 760, width: 28, sparks: 12, seed: 17 });

  // bar 8: an outlined « ? » sits in the loop's core, pulsing on snares, then implodes on 9.0
  const tImp = loc(9);
  const qa = lt < tImp - 0.1 ? seg(lt, 0.1, 0.4) : 1;
  const shrink = lt < tImp - 0.1 ? 1 : 1 - E.inCubic(seg(lt, tImp - 0.1, tImp));
  if (qa > 0 && shrink > 0.001) {
    const pz = shrink * (1 + 0.06 * f.snare);
    ctx.save();
    ctx.globalAlpha *= qa * (0.47 + 0.13 * f.snare);
    ctx.translate(st.cx, st.cy + st.r * 0.04);
    ctx.rotate(Math.sin(lt * 1.3) * 0.06);
    ctx.scale(pz, pz);
    ctx.font = K.F.anton(R0 * 1.25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(C.fuchsia2, 0.32);
    ctx.fillText('?', 0, 0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.fuchsia;
    ctx.strokeText('?', 0, 0);
    ctx.restore();
  }
  if (lt >= tImp && lt < tImp + 0.35) K.shockwave(ctx, st.cx, st.cy, (lt - tImp) / 0.35, { color: C.cyan, maxR: 230, width: 16, sparks: 10, seed: 23 });

  echoRings(ctx, f, K, st, countOn ? 0.5 : 1);
  drawRing(ctx, f, K, st);
  drawNodes(ctx, f, K, st, nodeA);
  snareBursts(ctx, f, K, dActive ? 0.8 : 1);

  if (dActive) {
    drawDigit(ctx, f, K, dActive);
    if (lt - dActive.t < 3 / 60) fx.rgb = 12; // 3-frame RGB split on each digit entry
  }

  // cards: bar 8 jagged question (lower third), giant words under the ring, flying into their nodes
  const c0 = CARDS[0];
  const c0t = lt - loc(c0.bar, c0.beat);
  const c0d = c0.durBeats * BEAT;
  if (c0t >= 0 && c0t <= c0d) {
    ctx.save();
    ctx.globalAlpha *= 1 - E.inQuad(seg(c0t, c0d - BEAT * 0.25, c0d));
    jagged(ctx, K, c0.text, 960, 870, { size: 118, p: clamp(c0t / (BEAT * 1.2)), seed: 13, emph: c0.emph, maxW: 1480 });
    ctx.restore();
  }
  for (let i = 0; i < 3; i++) drawGiant(ctx, f, K, st, i);

  // kicks: bars 8-9 ring pulse + 3 px, bar 10 zoom pump + 4 px
  if (lt >= 0 && lt < loc(10)) fx.shake = 3 * f.kick;
  else if (lt >= loc(10) && lt < loc(11)) {
    fx.shake = 4 * f.kick;
    fx.zoom = 0.03 * f.kick;
  } else if (lt >= loc(11)) fx.shake = 3 * f.kick;
  return fx;
}

/** The crack of light leaking through the frozen « 1 »: main lines + branches born at 18.95 / 19.05 / 19.12. */
const CRACK = (() => {
  const mk = (pts, born) => {
    let L = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(l);
      L += l;
    }
    return { pts, seg, L, born };
  };
  return [
    mk([[960, 440], [948, 520], [972, 590], [941, 668], [958, 742], [930, 826], [951, 902], [918, 990], [934, 1090]], null),
    mk([[960, 440], [986, 372], [968, 300], [1004, 228], [990, 150], [1030, 72], [1022, -10]], null),
    mk([[968, 300], [912, 268], [880, 214], [826, 196]], bt(11, 3.375)), // 18.95
    mk([[958, 742], [1012, 770], [1060, 760], [1130, 806], [1188, 800]], bt(11, 3.625)), // 19.05
    mk([[941, 668], [890, 690], [850, 676], [790, 712]], bt(11, 3.8)), // 19.12
  ];
})();

function drawCrack(ctx, K, t) {
  const { clamp, E, seg } = K;
  const mainP = 0.25 + 0.75 * E.inQuad(seg(t, T_FREEZE, T_END - 0.02));
  const strokeTo = (c, len) => {
    ctx.beginPath();
    ctx.moveTo(...c.pts[0]);
    let acc = 0;
    let tip = c.pts[0];
    for (let i = 1; i < c.pts.length; i++) {
      const l = c.seg[i - 1];
      if (acc + l <= len) {
        ctx.lineTo(...c.pts[i]);
        tip = c.pts[i];
        acc += l;
      } else {
        const u = (len - acc) / l;
        tip = [c.pts[i - 1][0] + (c.pts[i][0] - c.pts[i - 1][0]) * u, c.pts[i - 1][1] + (c.pts[i][1] - c.pts[i - 1][1]) * u];
        ctx.lineTo(...tip);
        break;
      }
    }
    return tip;
  };
  const tips = [];
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  // soft light pooling at the origin
  const pool = ctx.createRadialGradient(960, 440, 0, 960, 440, 260);
  pool.addColorStop(0, `rgba(103,232,249,${0.1 + 0.18 * mainP})`);
  pool.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = pool;
  ctx.fillRect(700, 180, 520, 520);
  CRACK.forEach((c) => {
    const local = c.born == null ? mainP : E.outCubic(clamp((t - c.born) / 0.06));
    if (local <= 0) return;
    const main = c.born == null;
    const tip = strokeTo(c, c.L * local);
    tips.push(tip);
    // light glow (reads on the black), ink fissure lips (read on the white « 1 »), then the white core
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(103,232,249,0.24)';
    ctx.lineWidth = main ? 16 : 12;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(2,6,17,0.92)';
    ctx.lineWidth = main ? 9 : 7;
    ctx.stroke();
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = main ? 5 : 3.8;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = main ? 3 : 2.2;
    ctx.stroke();
  });
  // bright tips
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y] of tips) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(103,232,249,0.35)');
    g.addColorStop(1, 'rgba(103,232,249,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 26, y - 26, 52, 52);
  }
  ctx.restore();
}

export default {
  id: 'S03',
  startBar: 8,
  endBar: 12,
  transitionOut: 'shatter',
  cards: CARDS,
  draw(ctx, f, K) {
    const frozen = f.t >= T_FREEZE - 1e-6;
    if (!frozen) {
      // +0.1 ms so a frame that lands exactly on a beat sees that beat's event despite float rounding
      const fx = paint(ctx, { ...f, lt: f.lt + 1e-4 }, K);
      brandBug(ctx, K);
      return fx;
    }
    // HELD BREATH (11.3 → 12.0, true silence): the frame stops on 11.3.0 and is crushed to near-black;
    // only the frozen « 1 » and the cyan horizon hairline survive, while a crack of light leaks through.
    // The brand bug is hidden.
    const g = K.frameContext(T_FREEZE - 1 / 240, SCENE);
    g.cardsOf = f.cardsOf;
    paint(ctx, g, K);
    ctx.fillStyle = 'rgba(2,6,17,0.82)';
    ctx.fillRect(0, 0, 1920, 1080);
    horizon(ctx, K, 1);
    // the « 1 » edges brighten slightly in the last 3 frames before the shatter
    const edge = K.seg(f.t, T_END - 3.5 / 60, T_END - 1 / 60);
    drawDigit(ctx, g, K, DIGITS[4], { band: false, edge });
    drawCrack(ctx, K, f.t);
    // float rounding: barT(12) = 19.200000000000003, so the renderer can still ask S03 for the 12.0 frame
    // itself; let the automatic impact FX fire on that exact downbeat (the shatter follows next frame).
    if (f.t >= T_END - 1e-6) return { flash: 0.35 };
    return { auto: false, shake: 0, rgb: 0, zoom: 0, flash: 0 };
  },
};
