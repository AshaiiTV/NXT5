// S11 — Stutter: « Gratuit en ce moment. », « Essaie la démo. », « Crée ton espace. », « Arrête d’accuser le jungle. »
// Bars 40–41: photosafe stop-motion stutter (constant night field, one band + 5 posing silhouettes per stab).
// Bar 41: the three demo games slam in as tiles and flip to the real /demo rows (ui-demo-matches.png).
// Bar 42: original angular crest, blades unfolding on the kicks, nameplate « TON ÉQUIPE ».
// Bar 43: the JGL token, surrounded by blame pings, zaps them into cyan sparks.
import { countIn, jglToken, POSES, silhouette, sparkBurst, particles3, brandBug } from './lib-S11.mjs';

const BEAT = 0.4;
const BAR = 1.6;
const T40 = 40 * BAR;

// ------------------------------------------------------------------ static caches
let STRIPS = null;
/** Ink halftone strips for the stutter band (normal + snare-pulsed ×1.5). */
function strips(K) {
  if (STRIPS) return STRIPS;
  const { createCanvas } = globalThis.__canvasMod;
  const mk = (mult) => {
    const w = 2900;
    const h = 220;
    const sp = 15;
    const c = createCanvas(w, h);
    const x = c.getContext('2d');
    x.fillStyle = K.C.ink;
    x.beginPath();
    let n = 0;
    let row = 0;
    for (let yy = sp / 2; yy < h; yy += sp, row++) {
      const u = yy / h;
      for (let xx = (row % 2) * (sp / 2); xx < w; xx += sp) {
        const base = 5.4 * Math.pow(1 - u, 1.1) * (0.6 + 0.4 * Math.sin(xx * 0.0045 + row * 0.3));
        const r = Math.min(base * mult, sp * 0.5);
        if (r < 0.45) continue;
        x.moveTo(xx + r, yy);
        x.arc(xx, yy, r, 0, Math.PI * 2);
        if (++n % 90 === 0) {
          x.fill();
          x.beginPath();
        }
      }
    }
    x.fill();
    return c;
  };
  STRIPS = [mk(1), mk(1.5)];
  return STRIPS;
}

// ------------------------------------------------------------------ stutter composition
const BAND_ANG = [-18, 12, -30].map((d) => (d * Math.PI) / 180);
const BAND_OFF = [-150, 190, -40, 240, -230, 90, 10, -200, 150, -90, 220, -20];
const GROUND_TILT = 0.4; // ground line tilt as a fraction of the band angle

function stutterBand(ctx, K, f, c, pulse) {
  const { C } = K;
  const cols = [C.fuchsia2, C.cyan2, C.violet];
  const a = BAND_ANG[c % 3];
  const col = cols[(c + Math.floor(c / 3)) % 3];
  const [s0, s1] = strips(K);
  ctx.save();
  ctx.translate(960, 540);
  ctx.rotate(a);
  ctx.translate(0, BAND_OFF[c % 12]);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = col;
  ctx.fillRect(-1450, -110, 2900, 220);
  const drift = (f.t * 75) % 30;
  ctx.globalAlpha = 0.85 * (1 - pulse);
  ctx.drawImage(s0, -1450 - drift, -110);
  if (pulse > 0.02) {
    ctx.globalAlpha = 0.85 * pulse;
    ctx.drawImage(s1, -1450 - drift, -110);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = K.rgba(C.text, 0.6);
  ctx.fillRect(-1450, -113, 2900, 3);
  ctx.fillStyle = C.ink;
  ctx.fillRect(-1450, 110, 2900, 12);
  ctx.restore();
}

// figure x offsets (in spreads), scale and ground offset per layout
const LAYOUTS = [
  { x: [-2, -1, 0, 1, 2], s: [1, 1, 1, 1, 1], g: [0, 0, 0, 0, 0], ox: 0 },
  { x: [-2.1, -1.05, 0, 1.05, 2.1], s: [0.9, 0.96, 1.06, 0.96, 0.9], g: [-0.05, -0.02, 0.02, -0.02, -0.05], ox: 0 },
  { x: [-2, -1.1, -0.15, 0.85, 1.9], s: [1.06, 0.95, 0.9, 0.95, 1.02], g: [0, -0.03, -0.05, -0.03, 0], ox: -110 },
  { x: [-1.9, -0.9, 0.1, 1.1, 2.05], s: [0.94, 1.05, 0.92, 1.04, 0.96], g: [-0.03, 0, -0.04, 0, -0.03], ox: 120 },
];
// per bar: hero height / ground (front, may be cropped by the frame), chorus height / ground, spread
const STAGE = {
  40: { hero: 520, heroG: 1262, back: 226, backG: 1046, spread: 285 },
  41: { hero: 310, heroG: 772, back: 168, backG: 690, spread: 250 },
};
const HERO_LEAN = [0.05, -0.04, 0.035, -0.06];

/** Ground line y at x for composition c (tilted by a fraction of the band angle). */
const groundY = (c, x, g0) => g0 + (x - 960) * Math.tan(BAND_ANG[c % 3] * GROUND_TILT);

/** Thin tilted floor line under the chorus. */
function groundLine(ctx, K, c, S) {
  const y0 = groundY(c, -40, S.backG);
  const y1 = groundY(c, 1960, S.backG);
  const g = ctx.createLinearGradient(-40, 0, 1960, 0);
  g.addColorStop(0, K.rgba(K.C.cyan, 0));
  g.addColorStop(0.5, K.rgba(K.C.cyan, 0.4));
  g.addColorStop(1, K.rgba(K.C.cyan, 0));
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-40, y0);
  ctx.lineTo(1960, y1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Composition c: a hero figure (1.45x, in front of the band, slightly leaned) and the four others behind it
 * (0.8x, 75 % alpha) standing on the tilted ground line. Returns the hero's chest point for the shockwave.
 */
function squad(ctx, K, c, S) {
  const L = LAYOUTS[(c * 3 + Math.floor(c / 4)) % LAYOUTS.length];
  const hero = (c * 3 + 2) % 5;
  // chorus, composited as one layer so the rims never show through the ink bodies
  const [bc, bx] = K.offscreen('S11-chorus');
  bx.setTransform(ctx.getTransform());
  for (let i = 0; i < 5; i++) {
    if (i === hero) continue;
    const x = 960 + L.ox + L.x[i] * S.spread;
    const h = S.back * L.s[i];
    silhouette(bx, K, POSES[(c * 2 + i * 3) % 5], x, groundY(c, x, S.backG) + L.g[i] * h, h, { mirror: (c + i) % 2 === 1, style: (i + c) % 3 });
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= 0.75;
  ctx.drawImage(bc, 0, 0);
  ctx.restore();
  // hero, pulled slightly toward the centre and facing it
  const hx = K.lerp(960 + L.ox + L.x[hero] * S.spread, 960, 0.22);
  const hy = groundY(c, hx, S.heroG);
  const lean = HERO_LEAN[c % 4];
  // soft back-light in the band colour so the hero separates from the band and the chorus
  const bandCol = [K.C.fuchsia2, K.C.cyan2, K.C.violet][(c + Math.floor(c / 3)) % 3];
  const gy0 = hy - S.hero * 0.62;
  const gr = S.hero * 0.75;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(hx, gy0, 0, hx, gy0, gr);
  g.addColorStop(0, K.rgba(bandCol, 0.3));
  g.addColorStop(1, K.rgba(bandCol, 0));
  ctx.fillStyle = g;
  ctx.fillRect(hx - gr, gy0 - gr, gr * 2, gr * 2);
  ctx.restore();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(lean);
  ctx.translate(-hx, -hy);
  const kp = silhouette(ctx, K, POSES[(c * 2 + hero * 3) % 5], hx, hy, S.hero, { mirror: hx > 960, style: (hero + c) % 3, rimOff: 5 });
  ctx.restore();
  return kp.chest;
}

// ------------------------------------------------------------------ demo tiles (bar 41)
const TILE_W = 560;
const TILE_H = 266;
const TILE_GAP = 572;
// the three /demo rows of ui-demo-matches.png (row separator y), PARTIE i -> Scrim i
const ROW_TOP = [1202, 982, 764];
// two crops per row, butted together to trim the empty column gap: result badge, then « Scrim n · Adversaire »
const PIECE_A = [118, 200];
const PIECE_B = [342, 263];
const ROW_W = PIECE_A[1] + PIECE_B[1];
const ROW_Y = 14;
const ROW_H = 172;
const TILE_IN = [0, 0.75, 1.5];
const TILE_FLIP = [1.5, 2.5, 3];

let ROWS = null;
/** Static bitmaps of the three real /demo rows (badge + match name, ~34 px text once drawn in a tile). */
function rowBitmaps(K) {
  if (ROWS) return ROWS;
  const img = K.uiImage('ui-demo-matches.png');
  if (!img) return null;
  const { createCanvas } = globalThis.__canvasMod;
  ROWS = ROW_TOP.map((top) => {
    const c = createCanvas(ROW_W, ROW_H);
    const x = c.getContext('2d');
    x.drawImage(img, PIECE_A[0], top + ROW_Y, PIECE_A[1], ROW_H, 0, 0, PIECE_A[1], ROW_H);
    x.drawImage(img, PIECE_B[0], top + ROW_Y, PIECE_B[1], ROW_H, PIECE_A[1], 0, PIECE_B[1], ROW_H);
    return c;
  });
  return ROWS;
}

function tileBody(ctx, K, accent) {
  const { C } = K;
  K.roundRect(ctx, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 16);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = K.rgba(C.violet2, 0.55);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(-TILE_W / 2 + 16, -TILE_H / 2, TILE_W - 32, 4);
}

function tileFront(ctx, K, i) {
  const { C } = K;
  tileBody(ctx, K, C.cyan);
  K.text(ctx, `PARTIE ${i + 1}`, -TILE_W / 2 + 26, -TILE_H / 2 + 38, { size: 24, font: K.F.russo, color: C.text, align: 'left', spacing: 1 });
  ctx.fillStyle = C.cyan;
  ctx.beginPath();
  ctx.arc(TILE_W / 2 - 34, -TILE_H / 2 + 38, 7, 0, Math.PI * 2);
  ctx.fill();
  // mini dashboard: 5 bars + timeline (no numbers)
  const R = K.rng(17 + i * 5);
  const x0 = -TILE_W / 2 + 30;
  const bw = 56;
  for (let k = 0; k < 5; k++) {
    const bh = 34 + R() * 70;
    const bx = x0 + k * (bw + 22);
    ctx.fillStyle = K.rgba(C.raised, 1);
    ctx.fillRect(bx, -42, bw, 104);
    const g = ctx.createLinearGradient(0, 62 - bh, 0, 62);
    g.addColorStop(0, k % 2 ? C.violet : C.cyan);
    g.addColorStop(1, K.rgba(k % 2 ? C.violet : C.cyan, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(bx, 62 - bh, bw, bh);
  }
  ctx.strokeStyle = K.rgba(C.text2, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, 96);
  ctx.lineTo(TILE_W / 2 - 30, 96);
  ctx.stroke();
  ctx.strokeStyle = C.fuchsia;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k <= 9; k++) {
    const px = x0 + k * ((TILE_W - 60) / 9);
    const py = 96 - 6 - R() * 18;
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
}

function tileBack(ctx, K, i, glare) {
  const { C } = K;
  tileBody(ctx, K, C.fuchsia2);
  K.text(ctx, `PARTIE ${i + 1}`, -TILE_W / 2 + 24, -TILE_H / 2 + 26, { size: 24, font: K.F.russo, color: C.cyan, align: 'left', spacing: 1 });
  const rows = rowBitmaps(K);
  const w = TILE_W - 24;
  const h = (w * ROW_H) / ROW_W;
  const top = TILE_H / 2 - 12 - h;
  ctx.save();
  K.roundRect(ctx, -w / 2, top, w, h, 10);
  ctx.save();
  ctx.clip();
  if (rows) ctx.drawImage(rows[i], -w / 2, top, w, h);
  if (glare > 0 && glare < 1) {
    const gx = -w / 2 + glare * w * 1.6 - w * 0.3;
    const g = ctx.createLinearGradient(gx - 120, 0, gx + 120, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, top, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = K.rgba(C.cyan, 0.85);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function demoTiles(ctx, K, f, lt) {
  const { C, E, clamp, seg, lerp } = K;
  const fillT = f.at(41, 3);
  const vib = lt >= fillT ? 1 : 0;
  for (let i = 0; i < 3; i++) {
    const tIn = f.at(41, TILE_IN[i]);
    if (lt < tIn) continue;
    const e = E.outExpo(seg(lt, tIn, tIn + 0.17));
    const tx = 960 + (i - 1) * TILE_GAP;
    const ty = 262;
    const fx = 0.5 + vib * 3 * K.noise1(f.t * 55, i * 3 + 1);
    const fy = vib * 3 * K.noise1(f.t * 55, i * 3 + 2);
    const tFlip = f.at(41, TILE_FLIP[i]);
    const fp = seg(lt, tFlip, tFlip + 0.11);
    const sx = Math.abs(Math.cos(Math.PI * fp));
    const back = fp >= 0.5;
    // ghosts while slamming
    for (let g = 3; g >= 0; g--) {
      const ge = clamp(e - g * 0.09);
      if (g && e >= 1) continue;
      const x = lerp(-420, tx, ge);
      ctx.save();
      ctx.globalAlpha *= g ? 0.22 / g : 1;
      ctx.translate(x + fx, ty + fy);
      ctx.transform(1, 0, -0.35 * (1 - ge), 1, 0, 0);
      ctx.scale(Math.max(sx, 0.02), 1);
      if (g) {
        K.roundRect(ctx, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 16);
        ctx.fillStyle = i % 2 ? C.violet : C.cyan2;
        ctx.fill();
      } else if (back) tileBack(ctx, K, i, seg(lt, tFlip + 0.05, tFlip + 0.6));
      else tileFront(ctx, K, i);
      if (!g && fp > 0 && fp < 1) {
        ctx.fillStyle = K.rgba(C.text, 0.5 * (1 - sx));
        ctx.fillRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
      }
      ctx.restore();
    }
  }
}

function convergeLines(ctx, K, f, a) {
  if (a <= 0) return;
  const { C } = K;
  const R = K.rng(77);
  ctx.save();
  ctx.translate(960, 540);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 80; i++) {
    const ang = R() * Math.PI * 2;
    const ph = R();
    const spd = 1700 + R() * 1500;
    const len = 140 + R() * 300;
    const Lr = 1250;
    const dist = Lr - ((f.t * spd + ph * Lr) % Lr);
    const r0 = 170 + dist;
    const c = i % 4 === 0 ? C.fuchsia : i % 3 === 0 ? C.violet2 : C.cyan;
    ctx.strokeStyle = K.rgba(c, a * (0.25 + 0.5 * R()) * Math.min(1, dist / 300));
    ctx.lineWidth = 1.5 + R() * 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
    ctx.lineTo(Math.cos(ang) * (r0 + len), Math.sin(ang) * (r0 + len));
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ crest (bar 42)
const BLADES = [
  { ry: -70, ang: -0.8, L: 250 },
  { ry: -38, ang: -0.45, L: 320 },
  { ry: -6, ang: -0.12, L: 365 },
  { ry: 26, ang: 0.2, L: 305 },
  { ry: 56, ang: 0.5, L: 225 },
];
const UNFOLD_BEAT = [0, 1, 2, 2.5, 3];
const UNFOLD_ORDER = [2, 1, 3, 0, 4];
const HEX_R = 120;

function bladeQuad(L) {
  return [[0, -22], [L * 0.78, -15], [L, 5], [L * 0.28, 22]];
}

/** Adds the crest silhouette (hex + unfolded blades) to the current path, crest-local coords. */
function crestPath(ctx, K, blades) {
  ctx.beginPath();
  for (const b of blades) {
    const pts = bladeQuad(b.L * b.s).map(([u, v]) => {
      const c = Math.cos(b.a);
      const s = Math.sin(b.a);
      return [b.side * (b.rx + u * c - v * s), b.ry + u * s + v * c];
    });
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    const x = Math.cos(a) * HEX_R;
    const y = Math.sin(a) * HEX_R;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function crest(ctx, K, f, lt, cx, cy, sc, alpha) {
  const { C, E, clamp, seg, lerp } = K;
  const t42 = f.at(42, 0);
  const blades = [];
  for (let k = 0; k < 5; k++) {
    const tk = f.at(42, UNFOLD_BEAT[k]);
    if (lt < tk) continue;
    const e = E.outBack(seg(lt, tk, tk + 0.3 * BEAT * 2), 1.7);
    const B = BLADES[UNFOLD_ORDER[k]];
    for (const side of [-1, 1]) {
      blades.push({ side, rx: 86, ry: B.ry, a: lerp(1.45, B.ang, e), s: lerp(0.18, 1, clamp(e)), L: B.L, al: clamp(e * 5) });
    }
  }
  const pin = E.outExpo(seg(lt, t42, t42 + 0.22));
  const flareT = f.at(42, 1.5);
  const flare = lt >= flareT ? Math.exp(-(lt - flareT) * 7) : 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.scale(sc * lerp(1.5, 1, pin), sc * lerp(1.5, 1, pin));
  // bloom
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bl = ctx.createRadialGradient(0, 0, 40, 0, 0, 520);
  bl.addColorStop(0, K.rgba(C.violet, 0.28 + 0.35 * flare));
  bl.addColorStop(0.5, K.rgba(C.cyan2, 0.08 + 0.12 * flare));
  bl.addColorStop(1, K.rgba(C.cyan2, 0));
  ctx.fillStyle = bl;
  ctx.fillRect(-520, -520, 1040, 1040);
  ctx.restore();
  // blades
  const spec = K.linearSpectrum(ctx, -460, 0, 460, 0);
  ctx.lineJoin = 'miter';
  for (const b of blades) {
    const pts = bladeQuad(b.L * b.s);
    ctx.save();
    ctx.globalAlpha *= b.al;
    ctx.scale(b.side, 1);
    ctx.translate(b.rx, b.ry);
    ctx.rotate(b.a);
    K.polyPath(ctx, pts);
    const Ls = b.L * b.s;
    const g = ctx.createLinearGradient(0, 0, Ls, 0);
    g.addColorStop(0, K.rgba(b.side < 0 ? C.cyan2 : C.fuchsia2, 0.65));
    g.addColorStop(1, K.rgba(C.violet, 0.1));
    ctx.fillStyle = '#0b1024';
    ctx.fill();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = K.rgba(C.text, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.lineTo(Ls * 0.9, 1);
    ctx.stroke();
    // 1 px white inner edge on the leading (upper) side
    ctx.strokeStyle = K.rgba(C.text, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -18.5);
    ctx.lineTo(Ls * 0.78 - 2, -11.5);
    ctx.lineTo(Ls - 9, 3);
    ctx.stroke();
    ctx.restore();
  }
  // blade strokes in one pass, crest-space spectrum
  ctx.save();
  ctx.beginPath();
  for (const b of blades) {
    const pts = bladeQuad(b.L * b.s).map(([u, v]) => {
      const c = Math.cos(b.a);
      const s = Math.sin(b.a);
      return [b.side * (b.rx + u * c - v * s), b.ry + u * s + v * c];
    });
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  ctx.strokeStyle = spec;
  ctx.lineWidth = 4;
  ctx.shadowColor = K.rgba(C.violet2, 0.9);
  ctx.shadowBlur = 12 + 20 * flare;
  ctx.stroke();
  ctx.restore();
  // hex shield
  ctx.save();
  K.hexPath(ctx, 0, 0, HEX_R, 0);
  const hg = ctx.createRadialGradient(0, 0, 10, 0, 0, HEX_R * 1.05);
  hg.addColorStop(0, '#0d1230');
  hg.addColorStop(0.62, '#141a3d');
  hg.addColorStop(1, K.rgba(C.violet, 0.55));
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = spec;
  ctx.lineWidth = 5;
  ctx.shadowColor = C.cyan2;
  ctx.shadowBlur = 18 + 30 * flare;
  ctx.stroke();
  ctx.shadowBlur = 0;
  K.hexPath(ctx, 0, 0, HEX_R - 18, 0);
  ctx.strokeStyle = K.rgba(C.cyan, 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  K.text(ctx, '5', 0, 8, { size: 120, font: K.F.russo, color: C.text, glow: 22 + 30 * flare, glowColor: C.cyan2 });
  ctx.restore();
  // light sweep on 42.2
  const sw = seg(lt, f.at(42, 2), f.at(42, 2) + 0.38);
  if (sw > 0 && sw < 1) {
    ctx.save();
    crestPath(ctx, K, blades.map((b) => ({ ...b, s: b.s })));
    ctx.clip();
    ctx.rotate(-0.5);
    const x = lerp(-620, 620, E.inOutCubic(sw));
    const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, -700, 180, 1400);
    ctx.restore();
  }
  // brass flare at the top vertex: 4-point star + horizontal anamorphic streak
  if (flare > 0.02) {
    const fy = -HEX_R;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // streak (alpha 0 at both ends)
    const sw2 = 260 + 340 * flare;
    const sg = ctx.createLinearGradient(-sw2, 0, sw2, 0);
    sg.addColorStop(0, K.rgba(C.cyan2, 0));
    sg.addColorStop(0.35, K.rgba(C.cyan, 0.35 * flare));
    sg.addColorStop(0.5, K.rgba(C.text, 0.95 * flare));
    sg.addColorStop(0.65, K.rgba(C.cyan, 0.35 * flare));
    sg.addColorStop(1, K.rgba(C.cyan2, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(-sw2, fy - 3, sw2 * 2, 6);
    // halo
    const rg = ctx.createRadialGradient(0, fy, 0, 0, fy, 70);
    rg.addColorStop(0, K.rgba(C.text, 0.8 * flare));
    rg.addColorStop(1, K.rgba(C.cyan, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(-70, fy - 70, 140, 140);
    // star
    const r = 90 * flare + 10;
    K.starPath(ctx, 0, fy, r, r * 0.18, 4, -Math.PI / 2);
    const stg = ctx.createRadialGradient(0, fy, 0, 0, fy, r);
    stg.addColorStop(0, K.rgba('#ffffff', flare));
    stg.addColorStop(0.35, K.rgba(C.text, 0.9 * flare));
    stg.addColorStop(1, K.rgba(C.cyan2, 0.25 * flare));
    ctx.fillStyle = stg;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function nameplate(ctx, K, f, lt, cx, cy, alpha) {
  const { C, E, seg } = K;
  const t0 = f.at(42, 1);
  if (lt < t0 - 0.05 || alpha <= 0) return;
  const pop = E.outBack(seg(lt, t0 - 0.05, t0 + 0.12), 2);
  const w = 420;
  const h = 70;
  const ch = 16;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.scale(pop, 1);
  K.polyPath(ctx, [[-w / 2 + ch, -h / 2], [w / 2 - ch, -h / 2], [w / 2, -h / 2 + ch], [w / 2, h / 2 - ch], [w / 2 - ch, h / 2], [-w / 2 + ch, h / 2], [-w / 2, h / 2 - ch], [-w / 2, -h / 2 + ch]]);
  ctx.fillStyle = K.rgba('#0b1224', 0.94);
  ctx.fill();
  ctx.strokeStyle = K.linearSpectrum(ctx, -w / 2, 0, w / 2, 0);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const p = seg(lt, t0, f.at(42, 2.5));
  K.typeText(ctx, 'TON ÉQUIPE', 0, 2, { p, size: 34, font: K.F.russo, align: 'center', color: C.text, cursor: p < 1, t: f.t });
  ctx.restore();
}

/** Five small rim-lit hex chips: one player joins per blade pair (kicks 42.0, 42.1, 42.2, 42.2.5, 42.3). */
function teamChips(ctx, K, f, lt, alpha) {
  if (alpha <= 0) return;
  const { C, E, seg } = K;
  for (let k = 0; k < 5; k++) {
    const tk = f.at(42, UNFOLD_BEAT[k]);
    if (lt < tk) continue;
    const i = [2, 1, 3, 0, 4][k];
    const x = 960 + (i - 2) * 78;
    const y = 588;
    const s = E.outBack(seg(lt, tk, tk + 0.16), 2.4);
    const fl = Math.exp(-(lt - tk) * 9);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.scale(s, s);
    K.hexPath(ctx, 0, 0, 24, 0);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = i % 2 ? C.violet : C.cyan;
    ctx.stroke();
    K.hexPath(ctx, 0, 0, 9, 0);
    ctx.fillStyle = K.rgba(i % 2 ? C.violet2 : C.cyan, 0.85);
    ctx.fill();
    if (fl > 0.02) {
      K.hexPath(ctx, 0, 0, 24 + 30 * (1 - fl), 0);
      ctx.strokeStyle = K.rgba(C.text, fl);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** 200-particle burst from the crest at 42.0 (radial 400–1200 px/s, gravity 900 px/s², fades over a bar). */
function burst(ctx, K, tau) {
  if (tau < 0 || tau > BAR) return;
  const { C } = K;
  const R = K.rng(4242);
  const cols = [C.cyan, C.violet2, C.fuchsia];
  const k = 1.4; // drag
  const g = 900;
  const ek = Math.exp(-k * tau);
  const life = 1 - tau / BAR;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 200; i++) {
    const a = R() * Math.PI * 2;
    const v = 400 + R() * 800;
    const sz = 1.5 + R() * 3;
    const white = R() < 0.1;
    const vx = Math.cos(a) * v;
    const vy = Math.sin(a) * v;
    const x = 960 + (vx * (1 - ek)) / k;
    const y = 300 + (vy * (1 - ek)) / k + (g / k) * (tau - (1 - ek) / k);
    const cvx = vx * ek;
    const cvy = vy * ek + (g / k) * (1 - ek);
    const sp = Math.hypot(cvx, cvy) || 1;
    const len = Math.min(40, sp * 0.03);
    ctx.strokeStyle = K.rgba(white ? C.text : cols[i % 3], life * life * (0.6 + 0.4 * R()));
    ctx.lineWidth = sz;
    ctx.beginPath();
    ctx.moveTo(x - (cvx / sp) * len, y - (cvy / sp) * len);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ JGL callback (bar 43)
const TOKEN = [960, 452];
const TOKEN_R = 66;
const PING_RX = 250;
const PING_RY = 226;
const PING_SIZE = 44;
const ZAPS = [[1, [0, 4]], [1.5, [2]], [2, [6, 1]], [2.75, [5]], [3, [3, 7]]];
const ZAP_OF = (() => {
  const m = new Array(8).fill(0);
  for (const [b, list] of ZAPS) for (const j of list) m[j] = b;
  return m;
})();
// 8 pings on an ellipse around the token; the top pair stays clear of the receded crest
const pingPos = (j) => {
  const a = -Math.PI / 2 + Math.PI / 8 + (j * Math.PI) / 4;
  const x = TOKEN[0] + Math.cos(a) * PING_RX;
  const y = TOKEN[1] + Math.sin(a) * PING_RY;
  const d = Math.hypot(x - TOKEN[0], y - TOKEN[1]);
  return [x, y, (x - TOKEN[0]) / d, (y - TOKEN[1]) / d];
};
const HAT_FILL = [3.25, 3.5, 3.75];

function bolt(ctx, K, x0, y0, x1, y1, seed, a) {
  const R = K.rng(seed);
  const n = 9;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const nx = -dy / L;
  const ny = dx / L;
  const pts = [[x0, y0]];
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const j = (R() - 0.5) * 42 * Math.sin(u * Math.PI);
    pts.push([x0 + dx * u + nx * j, y0 + dy * u + ny * j]);
  }
  pts.push([x1, y1]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = K.rgba(K.C.cyan2, 0.3 * a);
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.strokeStyle = K.rgba(K.C.cyan, 0.8 * a);
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.strokeStyle = K.rgba('#ecfeff', a);
  ctx.lineWidth = 2.6;
  ctx.stroke();
  // fork
  const k = 3 + Math.floor(R() * 4);
  const [fx, fy] = pts[k];
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx + nx * 32 + dx * 0.08, fy + ny * 32 + dy * 0.08);
  ctx.lineTo(fx + nx * 22 + dx * 0.16, fy + ny * 50 + dy * 0.16);
  ctx.strokeStyle = K.rgba(K.C.cyan, 0.7 * a);
  ctx.lineWidth = 3.3;
  ctx.stroke();
  ctx.restore();
}

function ping(ctx, K, x, y, s, a, flash) {
  const { C } = K;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(0, 0, PING_SIZE, 0, Math.PI * 2);
  ctx.fillStyle = '#240a2e';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = C.fuchsia2;
  ctx.stroke();
  K.text(ctx, '?', 0, 4, { size: 54, font: K.F.anton, color: C.fuchsia });
  if (flash > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, PING_SIZE + 2, 0, Math.PI * 2);
    ctx.fillStyle = K.rgba('#e0fbff', flash);
    ctx.fill();
  }
  ctx.restore();
}

function callback(ctx, K, f, lt) {
  const { C, E, seg, clamp } = K;
  const t43 = f.at(43, 0);
  if (lt < t43) return;
  const [TX, TY] = TOKEN;
  const tokPop = E.outBack(seg(lt, t43, t43 + 0.2), 2);
  // blame (fuchsia) -> cleared (cyan) light pool, following how many pings are left
  let alive = 0;
  for (let j = 0; j < 8; j++) if (lt < f.at(43, ZAP_OF[j])) alive++;
  const appear = seg(lt, t43, t43 + 0.15);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [col, a] of [[C.fuchsia2, 0.3 * (alive / 8)], [C.cyan2, 0.26 * (1 - alive / 8)]]) {
    if (a * appear <= 0.002) continue;
    const g = ctx.createRadialGradient(TX, TY, 0, TX, TY, 600);
    g.addColorStop(0, K.rgba(col, a * appear));
    g.addColorStop(1, K.rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(TX - 600, TY - 600, 1200, 1200);
  }
  ctx.restore();
  // stacked blame rings (callback to S01), one breaks on each zap group
  const RING_BREAK = [3, 2, 1.5, 1];
  for (let k = 0; k < 4; k++) {
    const tb = f.at(43, RING_BREAK[k]);
    const ra = TOKEN_R + 22 + k * 15;
    const ka = seg(lt, t43 + 0.05 * k, t43 + 0.05 * k + 0.12);
    if (ka <= 0) continue;
    const d = lt - tb;
    if (d > 0.18) continue;
    ctx.save();
    ctx.strokeStyle = K.rgba(d > 0 ? C.cyan : C.fuchsia2, (d > 0 ? 1 - d / 0.18 : 0.75) * ka);
    ctx.lineWidth = d > 0 ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(TX, TY, ra + (d > 0 ? 50 * E.outCubic(d / 0.18) : 0), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // blame lines + pings
  const clean = seg(lt, f.at(43, 3.25), f.at(43, 3.75));
  let tokenGlow = 0.12 + 0.9 * clean;
  for (let j = 0; j < 8; j++) {
    const [px, py, ux, uy] = pingPos(j);
    const tAppear = t43 + j * 0.022;
    if (lt < tAppear) continue;
    const tz = f.at(43, ZAP_OF[j]);
    const sp = E.outBack(seg(lt, tAppear, tAppear + 0.16), 2.2);
    const jx = 2.6 * K.noise1(f.t * 18, j * 5 + 1);
    const jy = 2.6 * K.noise1(f.t * 18, j * 5 + 2);
    if (lt < tz) {
      // dashed blame line toward the token
      ctx.save();
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -f.t * 70;
      ctx.strokeStyle = K.rgba(C.fuchsia2, 0.6 * sp);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px - ux * (PING_SIZE + 6), py - uy * (PING_SIZE + 6));
      ctx.lineTo(TX + ux * (TOKEN_R + 70), TY + uy * (TOKEN_R + 70));
      ctx.stroke();
      ctx.restore();
      ping(ctx, K, px + jx, py + jy, sp, 1, 0);
    } else {
      const d = lt - tz;
      if (d < 0.16) {
        const fl = Math.floor((f.t * 60) / 2);
        bolt(ctx, K, TX + ux * (TOKEN_R + 4), TY + uy * (TOKEN_R + 4), px, py, j * 97 + fl, 1 - d / 0.16);
      }
      if (d < 0.07) ping(ctx, K, px, py, 1 + d * 5, 1 - d / 0.07, clamp(1 - d / 0.05));
      // shock ring
      if (d < 0.3) {
        ctx.save();
        ctx.strokeStyle = K.rgba(C.cyan, 1 - d / 0.3);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(px, py, PING_SIZE + 110 * E.outCubic(d / 0.3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      sparkBurst(ctx, K, px, py, d - 0.02, { n: 18, seed: 300 + j, speed: 760, life: 0.5, width: 3.5 });
      tokenGlow += 0.6 * Math.exp(-d * 9);
    }
  }
  // hat fill 43.3.25–43.3.75: the token swells (1 -> 1.12) and fires clean cyan rings, one per hat
  const sc = tokPop * (1 + 0.12 * E.outCubic(clean));
  for (const hb of HAT_FILL) {
    const d = lt - f.at(43, hb);
    if (d < 0 || d > 0.32) continue;
    const q = d / 0.32;
    const r = TOKEN_R * sc + 26 + 96 * E.outCubic(q);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = K.rgba(C.cyan, 0.95 * (1 - q));
    ctx.lineWidth = 5 * (1 - q) + 1.5;
    ctx.beginPath();
    ctx.arc(TX, TY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = K.rgba(C.text, 0.7 * (1 - q));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(TX, TY, r - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    tokenGlow += 0.35 * (1 - q);
  }
  jglToken(ctx, K, TX, TY, {
    r: TOKEN_R,
    lineWidth: 4,
    scale: sc,
    glow: clamp(tokenGlow, 0, 1.25),
    outline: clean > 0.5 ? C.cyan : C.violet,
    label: clean > 0.5 ? C.text : C.violet2,
    ring: clean,
    ringColor: C.cyan,
    ringWidth: 4,
    ringBlur: 12,
  });
}

// ------------------------------------------------------------------ scene
/** Constant night field (#070B17 -> #111827 radial) of the stutter. */
function nightField(ctx, f, K) {
  const g = ctx.createRadialGradient(960, 560, 0, 960, 540, 1150);
  g.addColorStop(0, K.C.bg);
  g.addColorStop(1, K.C.night);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.W, f.H);
}

/** Ink contrast plate behind the centred bar-40 card (title + sub), so the emph never sits on a lit band. */
function inkPlate(ctx, K, y0, y1, a, ramp = 0.22) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, K.rgba(K.C.ink, 0));
  g.addColorStop(ramp, K.rgba(K.C.ink, a));
  g.addColorStop(1 - ramp, K.rgba(K.C.ink, a));
  g.addColorStop(1, K.rgba(K.C.ink, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, 1920, y1 - y0);
}

export default {
  id: 'S11',
  startBar: 40,
  endBar: 44,
  transitionOut: 'shatter',
  draw(ctx, f, K) {
    const { C, E, seg, clamp, lerp } = K;
    if (f.lt < 0) {
      // clean pre-roll: the first band and figures only arrive with the 40.0 stab
      nightField(ctx, f, K);
      particles3(ctx, f, K, 0.7);
      return { auto: false };
    }
    const lt = f.lt;
    const t = T40 + lt;
    const cards = f.cardsOf || [];
    const card = (i) => cards[i];
    const t42 = f.at(42, 0);
    const opts = { x: 960, subSize: 54, maxW: 1500 };

    if (lt < t42) {
      // ---------------- BARS 40–41: stutter over a constant night field
      nightField(ctx, f, K);
      particles3(ctx, f, K, 0.7);
      const c = Math.max(0, countIn('stab', T40, t) - 1);
      const sinceStab = f.since('stab');
      // halftone dots pulse ×1.5 on the beat-2 snares only (not on the 41.3 roll)
      const tb = lt >= f.at(41, 2) ? f.at(41, 2) : f.at(40, 2);
      const pulse = lt >= tb ? Math.exp(-(lt - tb) * 6) : 0;
      const bar41 = lt >= f.at(41, 0);
      const S = STAGE[bar41 ? 41 : 40];
      const fill = E.inQuad(seg(lt, f.at(41, 3), t42));
      const s = 1 - 0.1 * fill;
      const zoom = () => {
        ctx.translate(960, 540);
        ctx.scale(s, s);
        ctx.translate(-960, -540);
      };
      // band + floor line; an ink plate keeps the band off the card (bar 40: behind the centred card,
      // bar 41: the band fades out above the lower third, so it only sits behind the tiles and figures)
      ctx.save();
      zoom();
      stutterBand(ctx, K, f, c, pulse);
      groundLine(ctx, K, c, S);
      ctx.restore();
      if (bar41) inkPlate(ctx, K, 640, 1520, 0.94, 0.12);
      else inkPlate(ctx, K, 330, 690, 0.66);
      // hero + chorus
      ctx.save();
      zoom();
      const chest = squad(ctx, K, c, S);
      ctx.restore();
      // shockwave from the hero's chest, kept off the card and its sub
      if (Number.isFinite(sinceStab) && sinceStab < 0.3) {
        ctx.save();
        ctx.beginPath();
        if (bar41) ctx.rect(0, 0, f.W, 745);
        else ctx.rect(0, 660, f.W, f.H - 660);
        ctx.clip();
        zoom();
        K.shockwave(ctx, chest[0], chest[1], sinceStab / 0.3, { color: c % 2 ? C.fuchsia : C.cyan, maxR: bar41 ? 260 : 320, width: 18, sparks: 10, seed: c + 3 });
        ctx.restore();
      }
      if (bar41) {
        ctx.save();
        zoom();
        demoTiles(ctx, K, f, lt);
        ctx.restore();
      }
      convergeLines(ctx, K, f, seg(lt, f.at(41, 3), f.at(41, 3.25)));
      // cards: fixed position, only a 1.0 -> 1.04 punch per stab
      const punch = 1 + 0.04 * f.stab;
      const cy = bar41 ? 870 - 54 * 0.7 : 500 - 54 * 0.7;
      ctx.save();
      ctx.translate(960, cy);
      ctx.scale(punch, punch);
      ctx.translate(-960, -cy);
      if (!bar41 && card(0)) K.renderCards(ctx, f, [card(0)], { ...opts, y: 500, size: 170 });
      if (bar41 && card(1)) K.renderCards(ctx, f, [card(1)], { ...opts, y: 870, size: 150 });
      ctx.restore();
      brandBug(ctx, K);
      return { auto: false, shake: 4 * f.stab, rgb: 3 * f.stab, flash: 0 };
    }

    // ---------------- BARS 42–43: crest, then the JGL callback
    K.background(ctx, f, { intensity: 0.85 });
    K.halftone(ctx, f, { color: C.violet, alpha: 0.12, angle: -0.32, band: [0.28, 0.72], spacing: 18, maxR: 6 });
    particles3(ctx, f, K, 0.8);
    burst(ctx, K, lt - t42);
    const t43 = f.at(43, 0);
    // the crest starts receding on the 42.3.75 hat so it has cleared before the pings land on 43.0
    const rec = E.outExpo(seg(lt, t43 - 0.1, t43 + 0.12));
    const ccy = lerp(300, 130, rec);
    const csc = lerp(1, 0.42, rec);
    if (lt < t42 + 0.5) K.shockwave(ctx, 960, 300, (lt - t42) / 0.5, { color: C.cyan, maxR: 950, width: 30, sparks: 16, seed: 42 });
    crest(ctx, K, f, lt, 960, ccy, csc, lerp(1, 0.6, rec));
    nameplate(ctx, K, f, lt, 960, ccy + 180 * csc, 1 - clamp(rec * 2));
    teamChips(ctx, K, f, lt, 1 - clamp(rec * 2));
    callback(ctx, K, f, lt);
    if (card(2)) K.renderCards(ctx, f, [card(2)], { ...opts, y: 870, size: 150 });
    // the last card holds through the frozen frame that the shatter transition breaks
    if (card(3)) K.renderCards(ctx, f, [{ ...card(3), durBeats: 4.5 }], { ...opts, y: 870, size: 150 });
    brandBug(ctx, K);
    return {};
  },
};
