// S09 — DROP 2: « GO. », chaos → one team space → the NXT5 Importer → a file imported into Parties.
import * as L from './lib-S09.mjs';

const { BEAT, S16 } = L;
// ------------------------------------------------------------------ timing (local seconds, bar 32 = 0)
const LAUNCH = [0, 0.2, 0.4, 0.6, 0.8]; // silhouettes, one per 8th
const FLIGHT = 0.62;
const ROW_X = [630, 795, 960, 1125, 1290]; // victory row (feet at y 343, 232 px tall)
const ROW_FEET = 343;
const ROW_H = 232;
const AV_Y = 136;
const avX = (i) => 960 + (i - 2) * 46;
const CHAOS_T = 0.8;
const ORDER_T = 1.6;
const POP = [1.6, 2.0, 2.2, 2.4, 2.7, 2.8]; // grid panels pop on the six hits of bar 33
const IMP_T = 3.2;
const WIN_IN = IMP_T - 0.08; // the Importer window slam starts early so it has landed on the 34.0 downbeat
const SWEEP_T = 1.6 - 0.04; // the 33.0 sweep is already on screen on the downbeat frame
const TICKS = [3.6, 4.0, 4.2, 4.4]; // export steps tick on the kicks of bar 34
const FILE_T = 4.8;
const LAND_T = 5.6;
const PILLS = [[4.8, 'Windows'], [5.4, 'Mac']];
const STABS = [0, 0.6, 3.2, 3.8];
const SNARES = [0.4, 1.2, 2.0, 2.8, 3.6, 4.4, 5.2, 6.0];

// ------------------------------------------------------------------ layout
const GRID = Array.from({ length: 6 }, (_, k) => ({ x: 340 + (k % 3) * 428, y: 170 + Math.floor(k / 3) * 218, w: 400, h: 190 }));
const GRID_ITEMS = [
  ['graph', 'PARTIES', '#67e8f9'],
  ['users', 'ÉQUIPE', '#818cf8'],
  ['clipboard', 'DÉBRIEFS', '#a78bfa'],
  ['hex', 'DRAFT', '#e879f9'],
  ['calendar', 'PLANNING', '#22d3ee'],
  ['chat', 'DISCORD', '#c4b5fd'],
];
const WIN = { x: 160, y: 120, w: 840, h: 520 };
const PAR = { x: 1180, y: 112, w: 580, h: 548 };
// tight crops (result pill + title column) of Scrim 3 · Aurore, Scrim 2 · Orbite, Scrim 1 · Aurore (ui-demo-matches.png)
const ROW_SRC = [796, 1016, 1236];
const ROW_SX = 108;
const ROW_SW = 520;
const ROW_SH = 156;
const ROW_W = 500;
const ROW_H2 = 150;
const ROW_GAP = 8;
const ROWS_IN = [3.6, 4.0]; // Scrim 2 and Scrim 1 pop on the 34.1 and 34.2 kicks
const slotY = (s) => PAR.y + 72 + s * (ROW_H2 + ROW_GAP);
const ROW_RX = PAR.x + (PAR.w - ROW_W) / 2;
const PUSH_PIVOT = [1700, 180]; // PARTIES push-in on the landing: clears the brand bug above and the card band below
const STEPS = ['Match', 'Timeline', 'Fichier', 'Terminé'];

// chaos collage: type, x, y, rotation, scale
const CHAOS = [
  ['shot', 250, 300, -0.3, 1], ['sheet', 500, 200, 0.2, 0.9], ['dm', 1500, 220, -0.2, 1], ['shot', 1660, 400, 0.38, 0.95],
  ['dm', 300, 560, 0.25, 1.05], ['q', 130, 420, -0.4, 1], ['sheet', 1350, 420, 0.15, 1], ['sheet', 1620, 650, -0.25, 1],
  ['sheet', 260, 830, -0.15, 1], ['shot', 560, 770, 0.3, 1], ['dm', 900, 870, -0.2, 0.95], ['shot', 1260, 790, 0.42, 1],
  ['dm', 1560, 900, -0.3, 1], ['q', 420, 960, 0.1, 0.9], ['sheet', 760, 650, 0.22, 0.85], ['dm', 1180, 640, -0.35, 0.9],
  ['q', 1760, 860, 0.2, 0.85], ['dm', 200, 150, 0.4, 0.85], ['sheet', 1060, 980, 0.15, 0.9], ['shot', 840, 380, -0.22, 0.85],
].map(([type, x, y, rot, sc], i) => ({ type, x, y, rot, sc: sc * 1.25, i, g: 0, k: 0 }));
// balanced nearest-cell assignment (≤ 4 pieces per cell, every cell gets a stack); k = rank in its stack
{
  const pairs = [];
  CHAOS.forEach((c) => GRID.forEach((g, k) => pairs.push([Math.hypot(g.x + g.w / 2 - c.x, g.y + g.h / 2 - c.y), c, k])));
  pairs.sort((u, v) => u[0] - v[0]);
  const count = new Array(GRID.length).fill(0);
  const done = new Set();
  for (const [, c, k] of pairs) {
    if (done.has(c) || count[k] >= 4) continue;
    c.g = k;
    c.k = count[k]++;
    done.add(c);
  }
}
const SIZES = { shot: [230, 150], sheet: [240, 160], dm: [250, 110], q: [84, 84] };
// the sweep crosses x at this delay after 33.0 (outQuad from −300 to 2200 over 0.22 s) → that piece starts flying
const passDelay = (x) => 0.22 * (1 - Math.sqrt(1 - Math.min(1, Math.max(0, (x + 300) / 2500))));

// ------------------------------------------------------------------ static bitmaps
function chaosBitmap(K, type, seed) {
  const sizes = { shot: [230, 150], sheet: [240, 160], dm: [250, 110], q: [84, 84] };
  const [w, h] = sizes[type];
  return L.cached(`s09-chaos-${type}-${seed}`, w + 34, h + 34, (x) => {
    x.translate(10, 10);
    const R = K.rng(seed);
    x.fillStyle = 'rgba(2,6,17,0.75)';
    if (type === 'q') {
      x.beginPath();
      x.arc(w / 2 + 9, h / 2 + 9, w / 2 - 2, 0, Math.PI * 2);
      x.fill();
    } else {
      K.roundRect(x, 12, 12, w, h, type === 'dm' ? 22 : 8);
      x.fill();
    }
    if (type === 'q') {
      x.fillStyle = K.C.fuchsia2;
      x.beginPath();
      x.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = K.C.ink;
      x.lineWidth = 5;
      x.stroke();
      K.text(x, '?', w / 2, h / 2 + 3, { size: 58, font: K.F.anton, color: '#ffffff' });
      return;
    }
    x.fillStyle = type === 'dm' ? '#3b4a5e' : '#334155';
    K.roundRect(x, 0, w, h, type === 'dm' ? 22 : 8);
    x.fill();
    x.strokeStyle = 'rgba(148,163,184,0.35)';
    x.lineWidth = 2;
    x.stroke();
    if (type === 'shot') {
      x.fillStyle = '#263241';
      x.fillRect(12, 12, w - 24, h - 24);
      x.fillStyle = '#64748b';
      x.beginPath();
      x.moveTo(24, h - 22);
      x.lineTo(24 + w * 0.3, h * 0.38);
      x.lineTo(24 + w * 0.5, h * 0.62);
      x.lineTo(24 + w * 0.62, h * 0.48);
      x.lineTo(w - 24, h - 22);
      x.closePath();
      x.fill();
      x.fillStyle = '#94a3b8';
      x.beginPath();
      x.arc(w * 0.74, h * 0.32, 13, 0, Math.PI * 2);
      x.fill();
    } else if (type === 'sheet') {
      x.fillStyle = '#475569';
      x.fillRect(0, 0, w, h / 5);
      x.strokeStyle = '#64748b';
      x.lineWidth = 1.5;
      x.beginPath();
      for (let c = 1; c < 6; c++) {
        x.moveTo((c * w) / 6, 0);
        x.lineTo((c * w) / 6, h);
      }
      for (let r = 1; r < 5; r++) {
        x.moveTo(0, (r * h) / 5);
        x.lineTo(w, (r * h) / 5);
      }
      x.stroke();
      x.fillStyle = '#516178';
      for (let k = 0; k < 6; k++) {
        const c = Math.floor(R() * 6);
        const r = 1 + Math.floor(R() * 4);
        x.fillRect((c * w) / 6 + 3, (r * h) / 5 + 3, w / 6 - 6, h / 5 - 6);
      }
    } else {
      x.fillStyle = '#64748b';
      x.beginPath();
      x.arc(30, 32, 16, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = 'rgba(203,213,225,0.55)';
      K.roundRect(x, 58, 20, w * (0.45 + R() * 0.25), 12, 6);
      x.fill();
      K.roundRect(x, 58, 44, w * (0.3 + R() * 0.3), 12, 6);
      x.fill();
      x.fillStyle = 'rgba(148,163,184,0.4)';
      K.roundRect(x, 58, 70, w * 0.22, 10, 5);
      x.fill();
    }
  });
}

// cell surface (fill, accent, rim) and its content (icon + label) are separate so the content can pop late
function gridBitmap(K, k) {
  const g = GRID[k];
  const accent = GRID_ITEMS[k][2];
  const m = 34;
  return L.cached(`s09-grid-${k}`, g.w + m * 2, g.h + m * 2, (x) => {
    x.translate(m, m);
    x.shadowColor = K.rgba(K.C.cyan2, 0.5);
    x.shadowBlur = 26;
    x.fillStyle = K.C.surface;
    K.roundRect(x, 0, 0, g.w, g.h, 20);
    x.fill();
    x.shadowBlur = 0;
    x.strokeStyle = K.rgba(K.C.cyan, 0.6);
    x.lineWidth = 2;
    x.stroke();
    x.save();
    K.roundRect(x, 0, 0, g.w, g.h, 20);
    x.clip();
    x.fillStyle = accent;
    x.fillRect(0, 0, g.w, 4);
    const gr = x.createLinearGradient(0, 0, g.w, g.h);
    gr.addColorStop(0, K.rgba(accent, 0.1));
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, g.w, g.h);
    x.restore();
  });
}
function gridContent(K, k) {
  const g = GRID[k];
  const [kind, label, accent] = GRID_ITEMS[k];
  const m = 34;
  return L.cached(`s09-gridc-${k}`, g.w + m * 2, g.h + m * 2, (x) => {
    x.translate(m, m);
    x.fillStyle = K.rgba(accent, 0.1);
    x.beginPath();
    x.arc(92, g.h / 2, 62, 0, Math.PI * 2);
    x.fill();
    K.icon(x, kind, 92, g.h / 2 + 2, 92, { color: accent, lw: 5 });
    K.text(x, label, 178, 76, { size: 30, font: K.F.russo, align: 'left', color: K.C.text, spacing: 1 });
    x.fillStyle = '#334155';
    K.roundRect(x, 178, 112, 170, 11, 5);
    x.fill();
    K.roundRect(x, 178, 134, 112, 11, 5);
    x.fill();
  });
}

function windowBitmap(K) {
  const m = 50;
  return L.cached('s09-window', WIN.w + m * 2 + 18, WIN.h + m * 2 + 18, (x) => {
    x.translate(m, m);
    const { w, h } = WIN;
    x.fillStyle = K.C.ink;
    K.roundRect(x, 18, 18, w, h, 20);
    x.fill();
    x.shadowColor = K.rgba(K.C.cyan2, 0.4);
    x.shadowBlur = 40;
    x.fillStyle = '#0f172a';
    K.roundRect(x, 0, 0, w, h, 20);
    x.fill();
    x.shadowBlur = 0;
    x.strokeStyle = K.rgba(K.C.cyan, 0.55);
    x.lineWidth = 2;
    x.stroke();
    // title bar
    x.save();
    K.roundRect(x, 0, 0, w, h, 20);
    x.clip();
    x.fillStyle = '#111827';
    x.fillRect(0, 0, w, 56);
    x.fillStyle = K.rgba(K.C.violet2, 0.25);
    x.fillRect(0, 56, w, 2);
    x.restore();
    [K.C.fuchsia2, K.C.violet, K.C.cyan2].forEach((c, i) => {
      x.fillStyle = c;
      x.beginPath();
      x.arc(32 + i * 26, 28, 7.5, 0, Math.PI * 2);
      x.fill();
    });
    K.text(x, 'NXT5 Importer', 120, 29, { size: 26, font: K.F.russo, align: 'left', color: K.C.text });
    // status pill
    x.fillStyle = K.rgba(K.C.cyan2, 0.08);
    K.roundRect(x, 34, 84, 318, 48, 24);
    x.fill();
    x.strokeStyle = K.rgba(K.C.cyan, 0.35);
    x.lineWidth = 2;
    x.stroke();
    K.text(x, 'Client LoL connecté', 84, 109, { size: 25, font: (px) => K.F.inter(px, 700), align: 'left', color: K.C.text });
    // format chip
    x.strokeStyle = K.rgba(K.C.fuchsia, 0.7);
    K.roundRect(x, w - 34 - 118, 84, 118, 48, 10);
    x.stroke();
    K.text(x, '.JSON', w - 34 - 59, 109, { size: 24, font: K.F.russo, color: K.C.fuchsia });
    K.text(x, 'Exporte ta partie.', 34, 180, { size: 44, font: (px) => K.F.display(px, 900), align: 'left', color: K.C.text });
    // progress track
    x.fillStyle = '#1e293b';
    K.roundRect(x, 34, 222, 700, 20, 10);
    x.fill();
    // step rows
    STEPS.forEach((s, i) => {
      const cy = 292 + i * 62;
      x.strokeStyle = 'rgba(148,163,184,0.5)';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(54, cy, 16, 0, Math.PI * 2);
      x.stroke();
      K.text(x, s, 88, cy + 1, { size: 28, font: (px) => K.F.inter(px, 700), align: 'left', color: K.C.text2 });
      x.fillStyle = '#1e293b';
      K.roundRect(x, 290, cy - 6, 500, 12, 6);
      x.fill();
    });
  });
}

function partiesBitmap(K) {
  const m = 50;
  return L.cached('s09-parties', PAR.w + m * 2, PAR.h + m * 2, (x) => {
    x.translate(m, m);
    const { w, h } = PAR;
    x.shadowColor = K.rgba(K.C.cyan2, 0.45);
    x.shadowBlur = 36;
    x.fillStyle = '#111827';
    K.roundRect(x, 0, 0, w, h, 20);
    x.fill();
    x.shadowBlur = 0;
    x.strokeStyle = K.rgba(K.C.cyan, 0.6);
    x.lineWidth = 2;
    x.stroke();
    x.save();
    K.roundRect(x, 0, 0, w, h, 20);
    x.clip();
    x.fillStyle = K.C.cyan;
    x.fillRect(0, 0, w, 4);
    x.fillStyle = '#0f172a';
    x.fillRect(0, 4, w, 60);
    x.restore();
    K.icon(x, 'graph', 46, 30, 46, { color: K.C.cyan, lw: 6 });
    K.text(x, 'PARTIES', 84, 35, { size: 30, font: K.F.russo, align: 'left', color: K.C.text, spacing: 1 });
  });
}

// ------------------------------------------------------------------ helpers
const bez = (p0, c, p1, t) => [
  (1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * c[0] + t * t * p1[0],
  (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * c[1] + t * t * p1[1],
];
const smooth = (t) => t * t * (3 - 2 * t);

function silhouettePos(K, i, lt) {
  const p = K.clamp((lt - LAUNCH[i]) / FLIGHT);
  const e = K.E.outCubic(p);
  const p0 = [150 + i * 46, 1240];
  const c = [ROW_X[i] - 300, -140];
  const p1 = [ROW_X[i], ROW_FEET];
  const [x, y] = bez(p0, c, p1, e);
  return { p, x, y, h: K.lerp(410, ROW_H, e) };
}
function silhouetteState(K, i, lt) {
  const s = silhouettePos(K, i, lt);
  const prev = silhouettePos(K, i, lt - 1 / 120);
  s.vel = [(s.x - prev.x) * 120, (s.y - prev.y) * 120];
  s.pose = L.lerpPose(L.LEAP, L.POSES[i], smooth(K.seg(s.p, 0.4, 1)));
  s.rot = (1 - smooth(K.seg(s.p, 0.3, 1))) * 0.35;
  return s;
}

const TRAIL_COLS = ['#67e8f9', '#22d3ee', '#3b82f6', '#818cf8', '#a78bfa', '#e879f9'];
function drawSilhouettes(ctx, f, K) {
  const lt = f.lt;
  const shrink = K.E.outExpo(K.seg(lt, ORDER_T, ORDER_T + 0.24));
  for (let i = 0; i < 5; i++) {
    if (lt < LAUNCH[i]) continue;
    const s = silhouetteState(K, i, lt);
    const role = L.ROLES[i];
    // motion trail: 6 flat copies stepped back along the velocity, additive spectrum tint, in flight only
    if (shrink <= 0 && s.p < 1) {
      const sp = Math.hypot(s.vel[0], s.vel[1]);
      if (sp > 60) {
        const ux = s.vel[0] / sp;
        const uy = s.vel[1] / sp;
        const fade = 1 - K.seg(s.p, 0.75, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 6; k >= 1; k--) {
          const a = 0.35 * (1 - (k - 1) / 6) * fade;
          L.figure(ctx, K, s.pose, s.x - ux * 18 * k, s.y - uy * 18 * k, s.h, { rim: 0, fill: TRAIL_COLS[k - 1], alpha: a, rot: s.rot, role, vel: s.vel, t: lt });
        }
        ctx.restore();
      }
    }
    if (shrink >= 1) continue;
    const x = K.lerp(s.x, avX(i), shrink);
    const y = K.lerp(s.y, AV_Y + 12, shrink);
    const h = K.lerp(s.h, 26, shrink);
    L.figure(ctx, K, s.pose, x, y, h, { rim: 3, rot: s.rot, alpha: 1 - K.seg(shrink, 0.75, 1), role, vel: s.vel, t: lt });
  }
}

function drawAvatars(ctx, f, K) {
  const lt = f.lt;
  if (lt < ORDER_T + 0.12 || lt >= WIN_IN) return;
  // gone before the Importer window slams in on 34.0 (never over its title bar)
  const out = K.seg(lt, WIN_IN - 0.1, WIN_IN);
  for (let i = 0; i < 5; i++) {
    const a = K.E.outBack(K.seg(lt, ORDER_T + 0.12 + i * 0.03, ORDER_T + 0.32 + i * 0.03));
    if (a <= 0) continue;
    const x = avX(i);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(x, AV_Y - out * 30);
    ctx.scale(a, a);
    ctx.fillStyle = K.C.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = [K.C.cyan, K.C.violet, K.C.fuchsia, K.C.cyan2, K.C.violet2][i];
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(0, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 11, 9, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }
}

function chaosPos(K, f, c) {
  const lt = f.lt;
  const t0 = CHAOS_T + c.i * 0.013;
  const pin = K.clamp((lt - t0) / 0.22);
  const e = K.E.outBack(pin, 1.4);
  const step = Math.floor(lt / S16);
  let x = c.x + K.noise1(step * 0.93 + c.i * 7.1, 3) * 6;
  let y = c.y - (1 - e) * 820 + K.noise1(step * 0.87 + c.i * 5.3, 4) * 6;
  let rot = c.rot + (1 - e) * (c.i % 2 ? 2.2 : -2.2);
  // jolts on the kicks of 32.2.5 and 32.3
  if (lt > 0.98 && lt < ORDER_T) {
    const j = f.env('kick', 14);
    const R = K.rng(c.i + 50);
    const a = R() * Math.PI * 2;
    x += Math.cos(a) * 22 * j;
    y += Math.sin(a) * 22 * j;
    rot += (R() - 0.5) * 0.18 * j;
  }
  return { pin, x, y, rot };
}

// stacked faint outline of piece c inside its cell (offset by its rank so a cell reads as a sorted pile)
function stackRect(c) {
  const g = GRID[c.g];
  const o = (c.k - 1.5) * 9;
  return [g.x + o, g.y - o * 0.6, g.w, g.h];
}
function drawChaos(ctx, f, K) {
  const lt = f.lt;
  if (lt < CHAOS_T || lt > IMP_T) return;
  for (const c of CHAOS) {
    const st = chaosPos(K, f, c);
    if (st.pin <= 0) continue;
    // on 33.0 every piece is pulled into its cell as the sweep passes it (outExpo, rotation to 0)
    const t0 = SWEEP_T + passDelay(c.x);
    const q = K.E.outExpo(K.seg(lt, t0, t0 + 0.2));
    const lit = lt >= POP[c.g];
    if (q >= 1 && lit) continue; // absorbed by the lit cell
    const [rx, ry, rw, rh] = stackRect(c);
    const [bw, bh] = SIZES[c.type];
    // the piece itself: flies, straightens, shrinks into the cell, fading into its outline
    if (q < 1) {
      const bmp = chaosBitmap(K, c.type, c.i + 1);
      const x = K.lerp(st.x, rx + rw / 2, q);
      const y = K.lerp(st.y, ry + rh / 2, q);
      const sc = c.sc * K.lerp(1, Math.min(rw / bw, rh / bh) * 0.9 / c.sc, q);
      ctx.save();
      ctx.globalAlpha = K.clamp(st.pin * 4) * (1 - K.seg(q, 0.35, 1));
      ctx.translate(x, y);
      ctx.rotate(st.rot * (1 - q));
      ctx.scale(sc, sc);
      ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
      ctx.restore();
    }
    if (q > 0 && !lit) {
      // the outline grows from the piece's footprint to the cell rect
      const w = K.lerp(bw * c.sc, rw, q);
      const h = K.lerp(bh * c.sc, rh, q);
      const x = K.lerp(st.x, rx + rw / 2, q);
      const y = K.lerp(st.y, ry + rh / 2, q);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(st.rot * (1 - q));
      ctx.globalAlpha = K.lerp(0.6, 0.25, q) * K.clamp(q * 5);
      ctx.fillStyle = K.rgba(K.C.surface, 0.5);
      K.roundRect(ctx, -w / 2, -h / 2, w, h, 20);
      ctx.fill();
      ctx.strokeStyle = K.C.cyan;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawSweep(ctx, K, lt) {
  const p = K.seg(lt, SWEEP_T, SWEEP_T + 0.22);
  if (p <= 0 || p >= 1) return;
  const x = K.lerp(-300, 2200, K.E.outQuad(p));
  ctx.save();
  ctx.translate(x, H2);
  ctx.transform(1, 0, -0.32, 1, 0, 0);
  ctx.globalAlpha = 1 - K.E.inQuad(p);
  ctx.fillStyle = K.C.fuchsia2;
  ctx.fillRect(-60, -H2 - 40, 120, H2 * 2 + 80);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, -H2 - 40, 14, H2 * 2 + 80);
  ctx.fillStyle = K.C.cyan;
  ctx.fillRect(-80, -H2 - 40, 10, H2 * 2 + 80);
  ctx.restore();
}
const H2 = 540;

// overshoot pop: 0.7 → 1.08 → 1 over `d` seconds
const pop108 = (K, age, d = 0.24) => K.lerp(0.7, 1, K.E.outBack(K.clamp(age / d), 3.1));
function drawGrid(ctx, f, K) {
  const lt = f.lt;
  if (lt < POP[0] || lt > IMP_T + 0.3) return;
  const whip = K.E.inExpo(K.seg(lt, IMP_T, IMP_T + 0.16));
  for (let k = 0; k < 6; k++) {
    const age = lt - POP[k];
    if (age < 0) continue;
    if (k === 0 && lt >= IMP_T) continue; // PARTIES morphs into the right panel
    const g = GRID[k];
    let cx = g.x + g.w / 2;
    let cy = g.y + g.h / 2;
    let a = K.clamp(age / 0.04);
    if (whip > 0) {
      const dx = cx - 960;
      const dy = cy - 380;
      const d = Math.hypot(dx, dy) || 1;
      cx += (dx / d) * 1500 * whip;
      cy += (dy / d) * 1500 * whip;
      a *= 1 - whip;
    }
    const s = pop108(K, age);
    const sc = pop108(K, age - 0.05, 0.22); // icon + label pop a beat-fraction later
    const bmp = gridBitmap(K, k);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx, cy);
    ctx.save();
    ctx.scale(s, s);
    ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    ctx.restore();
    if (age > 0.05) {
      const cb = gridContent(K, k);
      ctx.save();
      ctx.globalAlpha = a * K.clamp((age - 0.05) / 0.04);
      ctx.scale(sc, sc);
      ctx.drawImage(cb, -cb.width / 2, -cb.height / 2);
      ctx.restore();
    }
    // cyan rim flash
    const fl = Math.exp(-age * 9);
    if (fl > 0.03) {
      ctx.scale(s, s);
      ctx.fillStyle = K.rgba(K.C.cyan, 0.16 * fl);
      K.roundRect(ctx, -g.w / 2, -g.h / 2, g.w, g.h, 20);
      ctx.fill();
      ctx.strokeStyle = K.rgba(K.C.cyan, fl);
      ctx.lineWidth = 3 + 7 * fl;
      K.roundRect(ctx, -g.w / 2 - 4, -g.h / 2 - 4, g.w + 8, g.h + 8, 23);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawWindow(ctx, f, K) {
  const lt = f.lt;
  if (lt < WIN_IN) return;
  const p = K.seg(lt, WIN_IN, WIN_IN + 0.12); // lands on the 34.0 brass, not after it
  const s = K.lerp(1.3, 1, K.E.outExpo(p));
  const bmp = windowBitmap(K);
  const cx = WIN.x + WIN.w / 2;
  const cy = WIN.y + WIN.h / 2;
  ctx.save();
  ctx.globalAlpha = K.clamp(p * 14);
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-WIN.w / 2, -WIN.h / 2);
  ctx.drawImage(bmp, -50, -50);
  // live parts
  const beat = f.beatPhase;
  ctx.fillStyle = K.C.cyan;
  ctx.beginPath();
  ctx.arc(60, 108, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = K.rgba(K.C.cyan, 0.8 * (1 - beat));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(60, 108, 8 + beat * 14, 0, Math.PI * 2);
  ctx.stroke();
  const prog = K.clamp((Math.floor((lt - IMP_T) / S16) + 1) / 16);
  if (prog > 0) {
    ctx.save();
    K.roundRect(ctx, 34, 222, 700 * prog, 20, 10);
    ctx.fillStyle = K.linearSpectrum(ctx, 34, 0, 734, 0);
    ctx.fill();
    ctx.restore();
  }
  TICKS.forEach((t, i) => {
    const age = lt - t;
    if (age < 0) return;
    const cyR = 292 + i * 62;
    const e = K.E.outBack(K.clamp(age / 0.14), 2.5);
    ctx.save();
    ctx.translate(54, cyR);
    ctx.scale(e, e);
    ctx.fillStyle = K.C.cyan2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = K.C.ink;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-2, 6);
    ctx.lineTo(8, -6);
    ctx.stroke();
    ctx.restore();
    const fill = K.E.outExpo(K.clamp(age / 0.16));
    ctx.fillStyle = K.rgba(K.C.cyan2, 0.9);
    K.roundRect(ctx, 290, cyR - 6, 500 * fill, 12, 6);
    ctx.fill();
    const fl = 1 - K.clamp(age / 0.2);
    if (fl > 0) {
      ctx.fillStyle = K.rgba(K.C.cyan, 0.18 * fl);
      ctx.fillRect(20, cyR - 28, WIN.w - 40, 56);
    }
  });
  ctx.restore();
}

// PARTIES push-in on the 35.2 landing: 1 → 1.15 in 0.25 s, held, eased back before the slash out (57.4)
function partiesPush(K, lt) {
  const pin = K.E.outCubic(K.seg(lt, LAND_T, LAND_T + 0.25));
  const pout = K.E.inOutCubic(K.seg(lt, 5.92, 6.2));
  return 1 + 0.15 * pin * (1 - pout);
}
function rowCrop(ctx, K, img, src, x, y, w = ROW_W, h = ROW_H2) {
  ctx.save();
  K.roundRect(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.drawImage(img, ROW_SX, ROW_SRC[src], ROW_SW, ROW_SH, x, y, w, h);
  ctx.restore();
}
function drawParties(ctx, f, K) {
  const lt = f.lt;
  if (lt < IMP_T) return;
  const img = K.uiImage('ui-demo-matches.png');
  const m = K.E.outExpo(K.seg(lt, IMP_T, IMP_T + 0.24));
  const g0 = GRID[0];
  const x = K.lerp(g0.x, PAR.x, m);
  const y = K.lerp(g0.y, PAR.y, m);
  const w = K.lerp(g0.w, PAR.w, m);
  const h = K.lerp(g0.h, PAR.h, m);
  const push = partiesPush(K, lt);
  ctx.save();
  ctx.translate(PUSH_PIVOT[0], PUSH_PIVOT[1]);
  ctx.scale(push, push);
  ctx.translate(-PUSH_PIVOT[0], -PUSH_PIVOT[1]);
  if (m < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - m;
    for (const gb of [gridBitmap(K, 0), gridContent(K, 0)]) ctx.drawImage(gb, x - 34 * (w / g0.w), y - 34 * (h / g0.h), gb.width * (w / g0.w), gb.height * (h / g0.h));
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = m;
  const pb = partiesBitmap(K);
  ctx.drawImage(pb, x - 50 * (w / PAR.w), y - 50 * (h / PAR.h), pb.width * (w / PAR.w), pb.height * (h / PAR.h));
  ctx.restore();
  if (!img) {
    ctx.restore();
    return;
  }
  // interior, laid out in PAR space and mapped into the morphing rect (header + drop slot ride the morph)
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / PAR.w, h / PAR.h);
  ctx.translate(-PAR.x, -PAR.y);
  ctx.globalAlpha = m;
  K.roundRect(ctx, PAR.x + 2, PAR.y + 64, PAR.w - 4, PAR.h - 66, 18);
  ctx.clip();
  const rx = ROW_RX;
  // empty drop slot waiting for the file
  if (lt < LAND_T + 0.05) {
    const near = K.seg(lt, FILE_T + 0.3, LAND_T);
    const beat = 1 - f.beatPhase;
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -lt * 60;
    ctx.strokeStyle = K.rgba(K.C.cyan, 0.35 + 0.25 * beat + 0.4 * near);
    ctx.lineWidth = 3;
    K.roundRect(ctx, rx, slotY(0) + 4, ROW_W, ROW_H2 - 8, 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = K.rgba(K.C.cyan, 0.04 + 0.12 * near);
    ctx.fill();
    const cx = rx + ROW_W / 2;
    const cy = slotY(0) + ROW_H2 / 2 + Math.sin(lt * 10) * 4;
    ctx.strokeStyle = K.rgba(K.C.cyan, 0.6 + 0.4 * near);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 8);
    ctx.lineTo(cx, cy + 10);
    ctx.lineTo(cx + 18, cy - 8);
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx, cy - 26);
    ctx.stroke();
    ctx.restore();
  }
  // Scrim 2 and Scrim 1 pop on the 34.1 and 34.2 kicks
  ROWS_IN.forEach((t0, k) => {
    const age = lt - t0;
    if (age < 0) return;
    const e = K.E.outBack(K.clamp(age / 0.16), 2);
    const yy = slotY(k + 1);
    ctx.save();
    ctx.globalAlpha *= K.clamp(age / 0.05);
    ctx.translate(rx + ROW_W / 2 + (1 - K.clamp(e)) * 70, yy + ROW_H2 / 2);
    ctx.scale(K.lerp(0.86, 1, e), K.lerp(0.86, 1, e));
    rowCrop(ctx, K, img, k + 1, -ROW_W / 2, -ROW_H2 / 2);
    const fl = Math.exp(-age * 9);
    if (fl > 0.03) {
      ctx.fillStyle = K.rgba(K.C.cyan, 0.3 * fl);
      K.roundRect(ctx, -ROW_W / 2, -ROW_H2 / 2, ROW_W, ROW_H2, 12);
      ctx.fill();
    }
    ctx.restore();
  });
  const age = lt - LAND_T;
  if (age >= 0) {
    const e = K.E.outBack(K.clamp(age / 0.18), 1.8);
    const yy = slotY(0);
    ctx.save();
    ctx.translate(rx + ROW_W / 2, yy + ROW_H2 / 2);
    ctx.scale(K.lerp(0.6, 1, e), K.lerp(0.6, 1, e));
    ctx.globalAlpha *= K.clamp(age / 0.05);
    rowCrop(ctx, K, img, 0, -ROW_W / 2, -ROW_H2 / 2);
    const fl = Math.exp(-age * 7);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * fl})`;
    K.roundRect(ctx, -ROW_W / 2, -ROW_H2 / 2, ROW_W, ROW_H2, 12);
    ctx.fill();
    // accent bar shooting up on the left edge
    const up = K.E.outExpo(K.clamp(age / 0.14));
    ctx.fillStyle = K.C.cyan2;
    ctx.fillRect(-ROW_W / 2 + 2, ROW_H2 / 2 - ROW_H2 * up, 6, ROW_H2 * up);
    ctx.restore();
  }
  ctx.restore();
  if (age >= 0) {
    // the new row is rim-lit in cyan while the camera holds on it
    const e = K.E.outBack(K.clamp(age / 0.18), 1.8);
    const fl = Math.exp(-age * 7);
    const sx = K.lerp(0.6, 1, e);
    const cx = rx + ROW_W / 2;
    const cy = slotY(0) + ROW_H2 / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sx);
    ctx.strokeStyle = K.rgba(K.C.cyan, 0.75 + 0.25 * fl);
    ctx.shadowColor = K.C.cyan2;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3.5;
    K.roundRect(ctx, -ROW_W / 2 - 5, -ROW_H2 / 2 - 5, ROW_W + 10, ROW_H2 + 10, 15);
    ctx.stroke();
    ctx.restore();
  }
  if (age >= 0 && age < 0.4) {
    ctx.save();
    const fl = Math.exp(-age * 8);
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * fl})`;
    ctx.lineWidth = 4;
    K.roundRect(ctx, PAR.x, PAR.y, PAR.w, PAR.h, 20);
    ctx.stroke();
    ctx.fillStyle = K.rgba(K.C.cyan, 0.1 * fl);
    ctx.fill();
    ctx.restore();
    K.shockwave(ctx, rx + ROW_W / 2, slotY(0) + ROW_H2 / 2, K.clamp(age / 0.4), { color: K.C.cyan, maxR: 240, width: 14, sparks: 8, seed: 9 });
  }
  ctx.restore();
}

const FILE_P0 = [930, 470];
const FILE_C = [1130, 70];
const FILE_P1 = [ROW_RX + ROW_W / 2, slotY(0) + ROW_H2 / 2];
function filePos(K, t) {
  const q = K.E.inOutCubic(K.seg(t, FILE_T, LAND_T));
  return bez(FILE_P0, FILE_C, FILE_P1, q);
}
function drawFile(ctx, f, K) {
  const lt = f.lt;
  if (lt < FILE_T || lt > LAND_T + 0.08) return;
  // spark trail
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cols = [K.C.cyan, K.C.indigo, K.C.violet2, K.C.fuchsia, '#ffffff'];
  for (let j = 0; j < 30; j++) {
    const te = FILE_T + 0.06 + j * 0.024;
    const age = lt - te;
    if (age < 0 || age > 0.34) continue;
    const [px, py] = filePos(K, te);
    const R = K.rng(j + 300);
    const a = R() * Math.PI * 2;
    const v = 60 + R() * 160;
    const sx = px + Math.cos(a) * v * age;
    const sy = py + Math.sin(a) * v * age + 200 * age * age;
    const q = age / 0.34;
    ctx.fillStyle = K.rgba(cols[j % cols.length], 1 - q);
    const r = (2 + R() * 4) * (1 - q * 0.5);
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  ctx.restore();
  const [x, y] = filePos(K, lt);
  const pop = K.E.outBack(K.seg(lt, FILE_T, FILE_T + 0.14), 2.2);
  const land = K.seg(lt, LAND_T - 0.06, LAND_T + 0.06);
  const s = pop * K.lerp(1, 0.4, land);
  const q = K.seg(lt, FILE_T, LAND_T);
  ctx.save();
  ctx.globalAlpha = 1 - land;
  ctx.translate(x, y);
  ctx.rotate(Math.sin(q * Math.PI) * 0.35);
  ctx.scale(s, s);
  const w = 110;
  const h = 140;
  const fold = 30;
  ctx.shadowColor = K.rgba(K.C.cyan2, 0.8);
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2 - fold, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + fold);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = K.C.cyan;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = K.rgba(K.C.cyan, 0.35);
  ctx.beginPath();
  ctx.moveTo(w / 2 - fold, -h / 2);
  ctx.lineTo(w / 2 - fold, -h / 2 + fold);
  ctx.lineTo(w / 2, -h / 2 + fold);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  K.text(ctx, '{ }', 0, 12, { size: 44, font: K.F.russo, color: K.C.text });
  ctx.restore();
}

// Windows / Mac pills: Russo 34, pop 0.5 → 1.15 → 1 with a solid cyan flash that settles to the outline style
function drawPills(ctx, f, K) {
  const lt = f.lt;
  let x = WIN.x + 4;
  const ph = 60;
  for (const [t, label] of PILLS) {
    const w = K.measure(ctx, label, 34, K.F.russo) + 56;
    const age = lt - t;
    if (age >= 0) {
      const e = K.lerp(0.5, 1, K.E.outBack(K.clamp(age / 0.22), 3.5));
      const fl = Math.exp(-age * 6);
      ctx.save();
      ctx.translate(x + w / 2, 680);
      ctx.scale(e, e);
      ctx.fillStyle = K.C.ink;
      K.roundRect(ctx, -w / 2, -ph / 2, w, ph, ph / 2);
      ctx.fill();
      ctx.strokeStyle = K.C.cyan;
      ctx.lineWidth = 3;
      ctx.stroke();
      if (fl > 0.02) {
        ctx.fillStyle = K.rgba(K.C.cyan, fl);
        ctx.fill();
      }
      K.text(ctx, label, 0, 2, { size: 34, font: K.F.russo, color: K.C.text, alpha: 1 - fl });
      if (fl > 0.02) K.text(ctx, label, 0, 2, { size: 34, font: K.F.russo, color: K.C.ink, alpha: fl });
      ctx.restore();
    }
    x += w + 18;
  }
}

// GO.: white fill, 3 px ink inner line, 10 px spectrum outline, ink keyline, fuchsia glow behind
function goBitmap(K) {
  return L.cached('s09-go', 820, 600, (x) => {
    x.translate(410, 300);
    x.font = K.F.anton(460);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.save();
    x.shadowColor = K.rgba(K.C.fuchsia, 0.85);
    x.shadowBlur = 40;
    x.lineWidth = 40;
    x.strokeStyle = K.C.ink;
    x.strokeText('GO.', 0, 0);
    x.restore();
    x.lineWidth = 40;
    x.strokeStyle = K.C.ink;
    x.strokeText('GO.', 0, 0);
    x.lineWidth = 26; // 13 px outside the glyph: 10 px spectrum + 3 px ink inner line
    x.strokeStyle = K.linearSpectrum(x, -300, 0, 300, 0, [[0, K.C.cyan], [0.5, K.C.blue], [1, K.C.fuchsia2]]);
    x.strokeText('GO.', 0, 0);
    x.lineWidth = 6;
    x.strokeStyle = K.C.ink;
    x.strokeText('GO.', 0, 0);
    x.fillStyle = '#ffffff';
    x.fillText('GO.', 0, 0);
  });
}
function drawGo(ctx, f, K) {
  const lt = f.lt;
  if (lt < 0 || lt > 0.8) return;
  const p = K.seg(lt, 0, 0.18);
  const out = K.seg(lt, 0.7, 0.8);
  const e = K.E.outExpo(p);
  const b = goBitmap(K);
  ctx.save();
  ctx.translate(960, 548);
  for (let g = 3; g >= 0; g--) {
    const ge = K.clamp(e - g * 0.07);
    const s = K.lerp(2.6, 1, ge) * (1 + out * 0.18);
    ctx.save();
    ctx.scale(s, s);
    ctx.globalAlpha = (g ? 0.14 * (1 - e) : K.clamp(p * 5)) * (1 - out);
    ctx.drawImage(b, -410, -300);
    ctx.restore();
  }
  ctx.restore();
}

function drawCaptionBands(ctx, f, K, cards) {
  cards.forEach((c, i) => {
    if (i === 0) return;
    const a = L.cardAlpha(f, K, c);
    if (a <= 0) return;
    const lt = f.lt - f.at(c.bar, c.beat);
    const size = K.fitSize(ctx, c.text, 1500, 150, K.F.anton);
    const tw = K.measure(ctx, c.text, size, K.F.anton);
    const sw = c.sub ? K.measure(ctx, c.sub, 54, (px) => K.F.inter(px, 700)) + 48 : 0;
    const w = Math.max(tw * (c.style === 'jagged' ? 1.05 : 1), sw) + 170;
    if (i === 1) L.captionBand(ctx, K, 960, 450, 632, w, a, lt / 0.12, -0.035);
    else if (c.sub) L.captionBand(ctx, K, 960, 754, 1016, w, a, lt / 0.12);
    else L.captionBand(ctx, K, 960, 786, 956, w, a, lt / 0.12);
  });
}

// the bar-35 card lasts 4.5 beats so renderCards' quick exit falls after the slash: it is cut at full strength
const longCards = new WeakMap();
function sceneCards(f) {
  let c = longCards.get(f.cardsOf);
  if (!c) {
    c = L.frCards(f.cardsOf).map((x, i, all) => (i === all.length - 1 ? { ...x, durBeats: 4.5 } : x));
    longCards.set(f.cardsOf, c);
  }
  return c;
}

export default {
  id: 'S09',
  startBar: 32,
  endBar: 36,
  transitionOut: 'slash',
  draw(ctx, f0, K) {
    // f.lt and f.at() round differently: nudge lt so a frame that sits exactly on a downbeat counts as on/after it
    const f = { ...f0, lt: f0.lt + 1e-6 };
    const lt = f.lt;
    L.baseLayers(ctx, f, K);
    if (lt < 0) {
      L.bands(ctx, K, { alpha: 0.7 });
      L.brandBug(ctx, K);
      return {};
    }
    const cards = sceneCards(f);
    const uiOn = lt >= ORDER_T;
    // all-out-attack bands: step 40 px on every 16th, colour order swaps on the brass stabs
    const step = Math.floor(lt / S16);
    const order = STABS.filter((t) => lt >= t).length - 1;
    const streakPh = (lt % (BEAT / 2)) / (BEAT / 2);
    L.bands(ctx, K, {
      shift: step * 40,
      order,
      alpha: uiOn ? 0.6 : 0.7,
      pulse: f.env('snare', 9),
      streak: streakPh,
      streakAlpha: uiOn ? 0.55 : 1,
    });
    SNARES.forEach((t, k) => L.whiteSlash(ctx, K, (lt - t) / 0.16, k + 1));
    STABS.forEach((t, k) => {
      const [bx, by] = k < 2 ? [960, 540] : [580, 380];
      L.halftoneBurst(ctx, K, bx, by, (lt - t) / 0.5, k % 2 ? K.C.fuchsia : K.C.cyan, 1000);
    });

    drawChaos(ctx, f, K);
    drawGrid(ctx, f, K);
    // slow push-in on the importer bars (UI stays above y 720)
    const push = 1 + 0.03 * K.E.inOutSine(K.seg(lt, IMP_T, 6.4));
    ctx.save();
    ctx.translate(960, 390);
    ctx.scale(push, push);
    ctx.translate(-960, -390);
    drawParties(ctx, f, K);
    drawWindow(ctx, f, K);
    drawPills(ctx, f, K);
    drawFile(ctx, f, K);
    ctx.restore();
    drawSilhouettes(ctx, f, K);
    drawAvatars(ctx, f, K);
    drawSweep(ctx, K, lt);

    drawGo(ctx, f, K);
    drawCaptionBands(ctx, f, K, cards);
    ctx.save();
    ctx.translate(960, 540);
    ctx.rotate(-0.035);
    ctx.translate(-960, -540);
    K.renderCards(ctx, f, cards, { x: 960, y: 540, size: 150, subSize: 54, maxW: 1500, skip: (c, i) => i !== 1 });
    ctx.restore();
    K.renderCards(ctx, f, cards, { x: 960, y: 870, size: 150, subSize: 54, maxW: 1500, skip: (c, i) => i < 2 });

    L.brandBug(ctx, K);
    L.edgeGlow(ctx, f.env('stab', 6));
    return {};
  },
};
