// S12 — Outro: 40 brand shards rebuild the NXT5 logo under a giant « ANALYSE. », the JGL token is redeemed
// (gold ring + 'gg'), then the lock-up: logo, « Joue. Analyse. Recommence. », nxt5.org and the action line.
// Every text here is scene-drawn (cards are flagged sceneDrawn so renderCards never draws them).
import { jglToken, sparkBurst } from './lib-S11.mjs';

const BEAT = 0.4;
const BAR = 1.6;
const T44 = 44 * BAR;
const LOGO = { x: 960, y: 300, w: 820 };
const LOCK = { x: 960, y: 210, w: 560 };
const TOK = { x: 1600, y: 690, r: 70 };
const ANALYSE_SHIFT = -60;
const RING0 = { rx: 480, ry: 190 }; // wide loop ellipse around the shard logo
const ORBIT = { rx: 372, ry: 92, tilt: (-6 * Math.PI) / 180 }; // lock-up orbit
const TAG_Y = 400;
const URL_Y = 560;
const LINK_Y = 650;
const ACTION_Y = 750;
const FOOT1_Y = 966;
const FOOT2_Y = 1008;

const disp = (w) => (px) => `${w} ${px}px "Inter Display"`;

// ------------------------------------------------------------------ static caches
let SHARDS = null;
let LOGO_BMP = null;
let ANALYSE_BMP = null;
let AURORA = null;
let LOGO_MASK = null;

/** 40 triangles tiling the logo box (10 columns × 2 rows of jittered quads), ordered left → right in 8 waves. */
function shards(K) {
  if (SHARDS) return SHARDS;
  const R = K.rng(4407);
  const cols = 10;
  const rows = 2;
  const x0 = 530;
  const x1 = 1390;
  const y0 = 196;
  const y1 = 404;
  const cw = (x1 - x0) / cols;
  const rh = (y1 - y0) / rows;
  const P = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const jx = c > 0 && c < cols ? (R() - 0.5) * cw * 0.7 : 0;
      const jy = r > 0 && r < rows ? (R() - 0.5) * rh * 0.6 : 0;
      P.push([x0 + c * cw + jx, y0 + r * rh + jy]);
    }
  }
  const tris = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * (cols + 1) + c;
      const q = [P[i], P[i + 1], P[i + cols + 2], P[i + cols + 1]];
      if ((c + r) % 2) tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
      else tris.push([q[0], q[1], q[3]], [q[1], q[2], q[3]]);
    }
  }
  const cols4 = [K.C.cyan, K.C.indigo, K.C.violet, K.C.fuchsia];
  const list = tris.map((tr) => {
    const cx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3;
    const cy = (tr[0][1] + tr[1][1] + tr[2][1]) / 3;
    return { tr, cx, cy };
  });
  list.sort((a, b) => a.cx - b.cx);
  list.forEach((s, k) => {
    s.wave = Math.floor(k / 5);
    // fly in from beyond the frame edge, roughly radially from the logo centre
    const base = Math.atan2(s.cy - LOGO.y, s.cx - LOGO.x);
    const a = base + (R() - 0.5) * 1.2;
    const d = 1500 + R() * 600;
    s.sx = Math.cos(a) * d;
    s.sy = Math.sin(a) * d * 0.8;
    s.spin = (R() - 0.5) * 9;
    s.col = cols4[K.clamp(Math.floor(((s.cx - 530) / 860) * 4 + (R() - 0.5) * 1.2), 0, 3)];
    s.delay = R() * 0.03;
  });
  SHARDS = list;
  return SHARDS;
}

/** Logo outline as the shards carry it (same stroke as the final logo, before the fill glow). */
function logoBmp(K) {
  if (LOGO_BMP) return LOGO_BMP;
  const { createCanvas } = globalThis.__canvasMod;
  const c = createCanvas(1000, 320);
  const x = c.getContext('2d');
  K.logo(x, 500, 160, LOGO.w, { fill: 0.25, glow: 18, lineWidth: 4 });
  LOGO_BMP = { c, ox: LOGO.x - 500, oy: LOGO.y - 160 };
  return LOGO_BMP;
}

/** « ANALYSE. » in Anton 300 spectrum with a soft glow, rendered once. */
function analyseBmp(K) {
  if (ANALYSE_BMP) return ANALYSE_BMP;
  const { createCanvas } = globalThis.__canvasMod;
  const w = 1200;
  const h = 420;
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  K.text(x, 'ANALYSE.', w / 2, h / 2 + 6, { size: 300, font: K.F.anton, emph: 'ANALYSE.', glow: 34, stroke: 0 });
  // glyph-only mask (no glow) for the light sweeps
  const m = createCanvas(w, h);
  K.text(m.getContext('2d'), 'ANALYSE.', w / 2, h / 2 + 6, { size: 300, font: K.F.anton, color: '#ffffff' });
  ANALYSE_BMP = { c, m, w, h, textW: K.measure(x, 'ANALYSE.', 300, K.F.anton) };
  return ANALYSE_BMP;
}

/** Glyph mask of the big logo (same placement as logoBmp), for the completion sweep. */
function logoMask(K) {
  if (LOGO_MASK) return LOGO_MASK;
  const { createCanvas } = globalThis.__canvasMod;
  const c = createCanvas(1000, 320);
  K.logo(c.getContext('2d'), 500, 160, LOGO.w, { fill: 1, glow: 0, lineWidth: 6 });
  LOGO_MASK = c;
  return LOGO_MASK;
}

/**
 * Diagonal light sweep clipped to a glyph mask: band centre at u (0..1 across the mask), drawn 'lighter'
 * at dx,dy (top-left of the mask in the current transform).
 */
function maskedSweep(ctx, K, mask, dx, dy, u, alpha, color = '#ffffff', bandW = 110) {
  if (u <= 0 || u >= 1 || alpha <= 0) return;
  const [c, x] = K.offscreen('S12-sweep', mask.width, mask.height);
  x.drawImage(mask, 0, 0);
  x.globalCompositeOperation = 'source-in';
  const cx = -bandW * 2 + u * (mask.width + bandW * 4);
  const cy = mask.height / 2;
  const g = x.createLinearGradient(cx - bandW, cy + bandW * 0.45, cx + bandW, cy - bandW * 0.45);
  g.addColorStop(0, K.rgba(color, 0));
  g.addColorStop(0.5, K.rgba(color, alpha));
  g.addColorStop(1, K.rgba(color, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, mask.width, mask.height);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(c, dx, dy);
  ctx.restore();
}

/** Soft spectrum aurora band (computed once at quarter area, drawn scaled). */
function aurora(K) {
  if (AURORA) return AURORA;
  const { createCanvas } = globalThis.__canvasMod;
  const w = 960;
  const h = 540;
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.globalCompositeOperation = 'lighter';
  const stops = [K.C.cyan2, K.C.blue, K.C.indigo, K.C.violet, K.C.fuchsia2];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const px = -60 + u * (w + 120);
    const py = h * (0.78 - 0.5 * u) + Math.sin(u * 7) * 26;
    const r = 150 + 60 * Math.sin(u * 5 + 1);
    const col = stops[Math.min(stops.length - 1, Math.floor(u * (stops.length - 0.01)))];
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, K.rgba(col, 0.42));
    g.addColorStop(0.5, K.rgba(col, 0.16));
    g.addColorStop(1, K.rgba(col, 0));
    x.fillStyle = g;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  AURORA = c;
  return AURORA;
}

// ------------------------------------------------------------------ pieces
function background(ctx, f, K, quiet) {
  const { C } = K;
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, f.W, f.H);
  const g = ctx.createRadialGradient(960, 420, 0, 960, 480, 1150);
  g.addColorStop(0, '#0e1528');
  g.addColorStop(1, C.night);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.W, f.H);
  const a = aurora(K);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.18 * 2.2;
  ctx.translate(960 + 70 * Math.sin(f.t * 0.11), 540 + 30 * Math.sin(f.t * 0.083 + 1));
  ctx.rotate(0.05 * Math.sin(f.t * 0.07));
  ctx.drawImage(a, -1100, -620, 2200, 1240);
  ctx.globalAlpha = 0.18;
  ctx.scale(-1, 1);
  ctx.drawImage(a, -1150 + 90 * Math.sin(f.t * 0.06), -560, 2300, 1180);
  ctx.restore();
  // sparse drifting particles, kept out of the YouTube end-screen quiet zone
  ctx.save();
  if (quiet) {
    ctx.beginPath();
    ctx.rect(0, 0, f.W, f.H);
    ctx.rect(1290, 810, 600, 200);
    ctx.clip('evenodd');
  }
  K.particles(ctx, f, { count: 46, size: 2, speed: 0.35, seed: 121, alpha: 0.55 });
  K.particles(ctx, f, { count: 14, size: 3.2, speed: 0.6, seed: 122, alpha: 0.6 });
  ctx.restore();
}

/** Thin spectrum loop ring: a wide ellipse around the shard logo that settles into the lock-up orbit. */
function loopRing(ctx, K, cx, cy, rx, ry, draw, alpha, rot, tilt = 0, lw = 2) {
  if (draw <= 0 || alpha <= 0) return;
  const { C } = K;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.globalAlpha *= Math.min(1, alpha);
  const g = ctx.createConicGradient(rot, 0, 0);
  g.addColorStop(0, C.cyan);
  g.addColorStop(0.3, C.indigo);
  g.addColorStop(0.55, C.violet);
  g.addColorStop(0.8, C.fuchsia);
  g.addColorStop(1, C.cyan);
  ctx.strokeStyle = g;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, rot - Math.PI / 2, rot - Math.PI / 2 + Math.PI * 2 * K.clamp(draw, 0, 0.9999));
  ctx.stroke();
  ctx.restore();
}

/** Small cyan comet (r 4, 60° fading tail) travelling along the orbit ellipse at parameter th. */
function comet(ctx, K, cx, cy, rx, ry, tilt, th, alpha) {
  if (alpha <= 0) return;
  const { C } = K;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const P = (a) => {
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    return [cx + x * ct - y * st, cy + x * st + y * ct];
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const n = 14;
  const span = Math.PI / 3;
  for (let i = 0; i < n; i++) {
    const a0 = th - span * (1 - i / n);
    const a1 = th - span * (1 - (i + 1) / n);
    const k = (i + 1) / n;
    const [x0, y0] = P(a0);
    const [x1, y1] = P(a1);
    ctx.strokeStyle = K.rgba(C.cyan, alpha * 0.85 * k * k);
    ctx.lineWidth = 1 + 4 * k;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  const [hx, hy] = P(th);
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
  g.addColorStop(0, K.rgba(C.cyan, 0.7 * alpha));
  g.addColorStop(1, K.rgba(C.cyan2, 0));
  ctx.fillStyle = g;
  ctx.fillRect(hx - 16, hy - 16, 32, 32);
  ctx.fillStyle = K.rgba('#ecfeff', alpha);
  ctx.beginPath();
  ctx.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShards(ctx, K, f, lt) {
  const { E, seg, lerp, clamp } = K;
  const S = shards(K);
  const L = logoBmp(K);
  for (const s of S) {
    const t0 = f.at(44 + Math.floor(s.wave / 4), s.wave % 4) + s.delay;
    if (lt < t0) continue;
    const dur = 0.3 * BEAT;
    const e = E.outExpo(seg(lt, t0, t0 + dur));
    const land = t0 + dur * 0.55;
    const sinceLand = lt - land;
    const k0 = 1 - e;
    // streak back toward the source vector while in flight
    if (e < 0.9) {
      const px = s.cx + s.sx * k0;
      const py = s.cy + s.sy * k0;
      const d = Math.hypot(s.sx, s.sy) || 1;
      const ux = s.sx / d;
      const uy = s.sy / d;
      const len = 140 + 560 * k0;
      const hw = 22 * lerp(1, 1.8, k0);
      const g = ctx.createLinearGradient(px, py, px + ux * len, py + uy * len);
      g.addColorStop(0, K.rgba(s.col, 0.3));
      g.addColorStop(1, K.rgba(s.col, 0));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      K.polyPath(ctx, [
        [px - uy * hw, py + ux * hw],
        [px + uy * hw, py - ux * hw],
        [px + ux * len + uy * hw * 0.25, py + uy * len - ux * hw * 0.25],
        [px + ux * len - uy * hw * 0.25, py + uy * len + ux * hw * 0.25],
      ]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }
    const ghosts = e < 0.98 ? [0.16, 0.08] : [];
    for (const gk of [...ghosts, 0]) {
      const ge = clamp(e - gk);
      const k = 1 - ge;
      ctx.save();
      ctx.translate(s.cx + s.sx * k, s.cy + s.sy * k);
      ctx.rotate(s.spin * k);
      const sc = lerp(1, 1.8, k);
      ctx.scale(sc, sc);
      ctx.translate(-s.cx, -s.cy);
      K.polyPath(ctx, s.tr);
      if (gk) {
        ctx.fillStyle = K.rgba(s.col, 0.25 * (1 - gk * 4));
        ctx.fill();
      } else {
        const tint = sinceLand < 0 ? 0.85 : lerp(0.85, 0, E.outCubic(clamp(sinceLand / 0.32)));
        ctx.save();
        ctx.clip();
        ctx.drawImage(L.c, L.ox, L.oy);
        if (tint > 0.005) {
          ctx.fillStyle = K.rgba(s.col, tint);
          ctx.fillRect(s.cx - 200, s.cy - 200, 400, 400);
        }
        const fl = sinceLand >= 0 ? 0.7 * Math.exp(-sinceLand * 16) : 0;
        if (fl > 0.01) {
          ctx.fillStyle = K.rgba('#f0fbff', fl);
          ctx.fillRect(s.cx - 200, s.cy - 200, 400, 400);
        }
        ctx.restore();
        ctx.lineJoin = 'round';
        if (sinceLand < 0) {
          // bright 'lighter' 2 px edge in flight
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = K.rgba('#e0f2fe', 0.95);
          ctx.lineWidth = 2 / sc;
          ctx.stroke();
          ctx.restore();
        } else {
          const edge = lerp(0.95, 0, E.outCubic(clamp(sinceLand / 0.4)));
          if (edge > 0.01) {
            ctx.strokeStyle = K.rgba('#e0f2fe', edge);
            ctx.lineWidth = 2 / sc;
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }
}

function ggBubble(ctx, K, x, y, p, alpha, scale = 1) {
  if (p <= 0 || alpha <= 0) return;
  const { C, E } = K;
  const s = E.outBack(K.clamp(p), 2.6) * scale;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  K.roundRect(ctx, -52, -34, 104, 62, 20);
  ctx.moveTo(-30, 24);
  ctx.lineTo(-48, 50);
  ctx.lineTo(-8, 26);
  ctx.fillStyle = C.cyan;
  ctx.shadowColor = C.cyan2;
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
  K.text(ctx, 'gg', 0, -6, { size: 44, font: (px) => K.F.inter(px, 800), color: C.ink });
  ctx.restore();
}

/** Static parts of the end card (nxt5.org, link line, action line, footer) with per-group alpha/scale. */
function endCard(ctx, K, f, lt) {
  const { C, E, seg, lerp, clamp } = K;
  const t462 = f.at(46, 2);
  const t463 = f.at(46, 3);
  if (lt < t462) return;
  // nxt5.org stamp: 1.4 -> 1 in 4 frames
  const sp = seg(lt, t462, t462 + 4 / 60);
  const s = lerp(1.4, 1, E.outQuad(sp));
  ctx.save();
  ctx.translate(960, URL_Y);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(sp * 2.5);
  K.text(ctx, 'nxt5.org', 0, 0, { size: 130, font: K.F.russo, color: C.cyan, glow: 24, glowColor: C.cyan2, spacing: 2 });
  ctx.restore();
  // link + action line fade up over 46.2–46.3
  const a1 = E.outCubic(seg(lt, t462 + 0.03, t463));
  if (a1 > 0) {
    ctx.save();
    ctx.globalAlpha *= a1;
    ctx.translate(0, (1 - a1) * 16);
    const lw = K.measure(ctx, 'Lien en description', 40, (px) => K.F.inter(px, 700));
    const total = lw + 46;
    const lx = 960 - total / 2;
    K.text(ctx, 'Lien en description', lx, LINK_Y, { size: 40, font: (px) => K.F.inter(px, 700), color: C.text2, align: 'left' });
    // chevron ▼
    const chx = lx + lw + 30;
    K.polyPath(ctx, [[chx - 13, LINK_Y - 7], [chx + 13, LINK_Y - 7], [chx, LINK_Y + 10]]);
    ctx.fillStyle = C.cyan;
    ctx.fill();
    // action line in a spectrum-bordered pill
    const f800 = disp(800);
    const p1 = 'Essaie la démo';
    const p2 = ' · Crée ton espace';
    const w1 = K.measure(ctx, p1, 64, f800);
    const w2 = K.measure(ctx, p2, 64, f800);
    const tw = w1 + w2;
    const pw = tw + 96;
    const ph = 104;
    K.roundRect(ctx, 960 - pw / 2, ACTION_Y - ph / 2, pw, ph, ph / 2);
    ctx.fillStyle = K.rgba(C.ink, 0.6);
    ctx.fill();
    ctx.strokeStyle = K.linearSpectrum(ctx, 960 - pw / 2, 0, 960 + pw / 2, 0);
    ctx.lineWidth = 2;
    ctx.stroke();
    const x0 = 960 - tw / 2;
    K.text(ctx, p1, x0, ACTION_Y + 2, { size: 64, font: f800, color: C.cyan, align: 'left' });
    K.text(ctx, p2, x0 + w1, ACTION_Y + 2, { size: 64, font: f800, color: C.text, align: 'left' });
    ctx.restore();
  }
  // footer on 46.3
  const a2 = E.outCubic(seg(lt, t463, t463 + 0.25));
  if (a2 > 0) {
    ctx.save();
    ctx.globalAlpha *= a2;
    K.text(ctx, 'Gratuit en ce moment · Équipes & coachs', 96, FOOT1_Y, { size: 34, font: (px) => K.F.inter(px, 600), color: C.text2, align: 'left' });
    K.text(ctx, 'NXT5 n’est pas affilié à Riot Games.', 96, FOOT2_Y, { size: 22, font: (px) => K.F.inter(px, 500), color: C.text2, align: 'left', alpha: 0.55 });
    ctx.restore();
  }
}

// ------------------------------------------------------------------ scene
export default {
  id: 'S12',
  startBar: 44,
  endBar: 50,
  transitionOut: 'cut',
  cards: [
    { bar: 44, beat: 0, durBeats: 8, text: 'ANALYSE.', emph: 'ANALYSE.', sub: '', style: 'giant', sceneDrawn: true },
    { bar: 46, beat: 0, durBeats: 16, text: 'Joue. Analyse. Recommence.', emph: 'Analyse.', sub: 'nxt5.org', style: 'calm', sceneDrawn: true },
  ],
  draw(ctx, f, K) {
    const { C, E, seg, lerp, clamp } = K;
    const lt = Math.max(0, f.lt);
    const t45 = f.at(45, 0);
    const t46 = f.at(46, 0);
    const t462 = f.at(46, 2);
    // the last shard wave (45.3 kick) lands ~0.07 s after the kick: the logo locks there
    const tDone = f.at(45, 3) + 0.06;
    const done = lt >= tDone;
    background(ctx, f, K, lt >= t462);

    // lock-up move (46.0, inOutCubic over 0.5 beat); the ring height settles faster (0.3 beat)
    const kL = E.inOutCubic(seg(lt, t46, t46 + 0.5 * BEAT));
    const kR = E.inOutCubic(seg(lt, t46, t46 + 0.3 * BEAT));
    const kick = lt < t46 ? f.kick : 0;
    const hold = f.t - (T44 + t46); // seconds since 46.0
    const breathe = lt >= t46 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * hold) / 4) : 0;
    const lx = lerp(LOGO.x, LOCK.x, kL);
    const ly = lerp(LOGO.y, LOCK.y, kL);
    const lsc = lerp(1, LOCK.w / LOGO.w, kL) * (1 + 0.03 * kick);

    // loop ring: draws on through bar 44, pulses on kicks, then becomes a tilted orbit behind the lock-up
    const ringDraw = E.inOutCubic(seg(lt, 0, f.at(45, 0)));
    const rx = lerp(RING0.rx, ORBIT.rx, kL) * (1 + 0.03 * kick);
    const ry = lerp(RING0.ry, ORBIT.ry, kR) * (1 + 0.03 * kick);
    const tilt = lerp(0, ORBIT.tilt, kL);
    const rot = lt < t46 ? 0.35 * f.t : 0.35 * (T44 + t46);
    loopRing(ctx, K, lx, ly, rx, ry, ringDraw, lerp(0.3, 0.42, kL) + 0.2 * kick, rot, tilt);
    // lock hit: ring pulse 1 -> 1.18
    if (done) {
      const rp = seg(lt, tDone, tDone + 0.3);
      if (rp < 1) {
        const k = 1 + 0.18 * E.outCubic(rp);
        loopRing(ctx, K, lx, ly, rx * k, ry * k, 1, 0.7 * (1 - rp), rot, tilt, 3);
      }
    }
    // comet on the orbit (4 s period, passes the front of the ellipse on each breathing peak)
    if (lt >= t46) {
      const th = Math.PI / 2 + (2 * Math.PI * (hold - 2)) / 4;
      comet(ctx, K, lx, ly, rx, ry, tilt, th, 0.9 * seg(lt, t46 + 0.3, t46 + 0.8));
    }

    // logo: shards until complete, then the full logo with gradient stroke + fill glow
    ctx.save();
    ctx.translate(lx, ly);
    ctx.scale(lsc, lsc);
    ctx.translate(-LOGO.x, -LOGO.y);
    // soft bloom behind the logo (kick pulse, completion flare, 4 s breathing in the hold), trimmed so the glyphs carry the light
    const fin = done ? E.outCubic(seg(lt, tDone, tDone + 0.35)) : 0;
    const bloomA = 0.08 + 0.12 * kick + 0.14 * fin * (1 - kL) + 0.04 * breathe;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(LOGO.x, LOGO.y);
    ctx.scale(1, 0.3);
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 600);
    bg.addColorStop(0, K.rgba(C.violet, bloomA));
    bg.addColorStop(0.45, K.rgba(C.cyan2, bloomA * 0.3));
    bg.addColorStop(1, K.rgba(C.cyan2, 0));
    ctx.fillStyle = bg;
    ctx.fillRect(-600, -600, 1200, 1200);
    ctx.restore();
    if (!done) drawShards(ctx, K, f, lt);
    else {
      const glow = 16 + 22 * fin * (1 - kL) + 14 * breathe + 30 * kick;
      const fill = lerp(0.3, 0.45, kL);
      const lw = lerp(4, 5, kL) / lerp(1, LOCK.w / LOGO.w, kL);
      K.logo(ctx, LOGO.x, LOGO.y, LOGO.w, { fill, glow, lineWidth: lw });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // brightening pass: glyph fill + stroke added 'lighter', so the mark matches nxt5.org in luminance
      K.logo(ctx, LOGO.x, LOGO.y, LOGO.w, { fill: lerp(0, 0.4, kL), glow: 0, lineWidth: lw * 0.6, alpha: lerp(0.35, 0.55, kL) + 0.2 * breathe });
      // lock hit: bright stroke pass 7 -> 4 px, 0.9 -> 0 over 0.25 s
      const lq = seg(lt, tDone, tDone + 0.25);
      if (lq < 1) K.logo(ctx, LOGO.x, LOGO.y, LOGO.w, { fill: 0, glow: 10, lineWidth: lerp(7, 4, lq), alpha: 0.9 * (1 - lq) });
      ctx.restore();
      // completion sweep (white core) across the glyphs
      if (fin < 1) maskedSweep(ctx, K, logoMask(K), LOGO.x - 500, LOGO.y - 160, fin, 0.6 * (1 - fin * 0.5), '#ffffff', 120);
    }
    ctx.restore();
    // lock hit sparks from the « 5 »
    if (done) sparkBurst(ctx, K, 1290, 300, lt - tDone, { n: 14, seed: 453, speed: 700, life: 0.45, width: 3 });

    // « ANALYSE. » giant -> flies into the tagline slot
    const A = analyseBmp(K);
    const f900 = disp(900);
    const wJ = K.measure(ctx, 'Joue. ', 92, f900);
    const wA = K.measure(ctx, 'Analyse.', 92, f900);
    const wR = K.measure(ctx, ' Recommence.', 92, f900);
    const tagX0 = 960 - (wJ + wA + wR) / 2;
    const slotX = tagX0 + wJ + wA / 2;
    const kA = E.inOutCubic(seg(lt, t46, t46 + 0.6 * BEAT));
    const slam = E.outExpo(seg(lt, 0, 0.22));
    const shiftL = E.outExpo(seg(lt, t45, t45 + 0.3)) * ANALYSE_SHIFT;
    const ax = lerp(960 + shiftL, slotX, kA);
    const ay = lerp(720, TAG_Y, kA);
    const width = lerp(A.textW, wA, kA);
    const morph = E.inOutCubic(seg(kA, 0.5, 0.7));
    if (morph < 1) {
      // pulses on every kick (scale + a 'lighter' pass), in sync with the shard waves
      const sc = (width / A.textW) * lerp(1.3, 1, slam) * (1 + 0.025 * E.inOutSine(seg(lt, 0.25, t46)) * (1 - kA)) * (1 + 0.018 * kick);
      ctx.save();
      ctx.globalAlpha *= 1 - morph;
      ctx.translate(ax, ay);
      ctx.scale(sc, sc * lerp(1, 0.8, kA));
      ctx.drawImage(A.c, -A.w / 2, -A.h / 2);
      if (kick > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.35 * kick;
        ctx.drawImage(A.c, -A.w / 2, -A.h / 2);
        ctx.restore();
      }
      // diagonal light sweeps on 45.0 and 45.2
      for (const b of [0, 2]) {
        const ts = f.at(45, b);
        maskedSweep(ctx, K, A.m, -A.w / 2, -A.h / 2, E.inOutCubic(seg(lt, ts, ts + 0.42)), 0.75, '#ffffff', 120);
      }
      ctx.restore();
    }
    if (morph > 0) {
      const sz = (92 * width) / wA;
      K.text(ctx, 'Analyse.', ax, ay + 4, { size: sz, font: f900, emph: 'Analyse.', alpha: morph, glow: 16 });
    }
    // rest of the tagline fades up (calm), once the orbit has settled above it
    const tg = E.brand(seg(lt, t46 + 0.12, t46 + 0.12 + 0.5 * BEAT));
    if (tg > 0) {
      ctx.save();
      ctx.globalAlpha *= tg;
      const dy = (1 - tg) * 22;
      K.text(ctx, 'Joue.', tagX0, TAG_Y + 4 + dy, { size: 92, font: f900, color: C.text, align: 'left' });
      K.text(ctx, ' Recommence.', tagX0 + wJ + wA, TAG_Y + 4 + dy, { size: 92, font: f900, color: C.text, align: 'left' });
      ctx.restore();
    }

    // JGL token redemption (45.0 slide in, 45.2 gold ring + gg + sparks, fades on the lock-up)
    if (lt >= t45) {
      const tin = E.outExpo(seg(lt, t45, t45 + 0.3));
      const x0 = 2120;
      const tx = lerp(x0, TOK.x, tin);
      const t452 = f.at(45, 2);
      const gold = seg(lt, t452, t452 + 0.08);
      const fade = 1 - E.inCubic(seg(lt, t46, t46 + 0.3 * BEAT));
      if (fade > 0) {
        for (const gk of tin < 0.97 ? [0.18, 0.09] : []) {
          const gx = lerp(x0, TOK.x, clamp(tin - gk));
          jglToken(ctx, K, gx, TOK.y, { r: TOK.r, lineWidth: 4, alpha: 0.25 * fade, outline: C.violet });
        }
        const ring = seg(lt, t452, t452 + 0.5 * BEAT);
        jglToken(ctx, K, tx, TOK.y, {
          r: TOK.r,
          lineWidth: 4,
          alpha: fade,
          scale: (1 + 0.12 * Math.exp(-Math.max(0, lt - t452) * 10) * (lt >= t452 ? 1 : 0)) * lerp(0.6, 1, fade),
          outline: gold > 0.5 ? C.gold : C.violet,
          label: gold > 0.5 ? C.text : C.violet2,
          ring: E.outCubic(ring),
          ringWidth: 5,
          ringBlur: 10,
          glow: gold * 0.5,
          glowColor: C.gold,
        });
        ggBubble(ctx, K, tx + 116, TOK.y - 122, seg(lt, t452 + 0.04, t452 + 0.04 + 0.5 * BEAT), fade, 1.3);
        sparkBurst(ctx, K, tx, TOK.y, lt - t452, { n: 12, seed: 452, speed: 680, life: 0.5, width: 3, colors: [K.C.cyan, K.C.text, K.C.cyan2, K.C.gold] });
      }
    }

    // lock-up: nxt5.org stamp with a soft cyan shockwave, link, action line, footer
    if (lt >= t462) {
      const p = (lt - t462) / (2 * BEAT);
      if (p < 1) {
        ctx.save();
        ctx.globalAlpha *= 0.35;
        K.shockwave(ctx, 960, URL_Y, p, { color: C.cyan, maxR: 1200, width: 26, sparks: 10, seed: 462 });
        ctx.restore();
      }
    }
    endCard(ctx, K, f, lt);

    // 44.0: biggest hit, but no auto flash / auto RGB on top of the shatter (the slam has no RGB split)
    if (lt < 0.5) return { auto: false, shake: 22 * Math.exp(-lt * 5) + (lt > 0.3 ? 8 * f.kick : 0), zoom: 0.05 * Math.exp(-lt * 5), flash: 0 };
    if (lt < t46) return {};
    const hit = lt >= t462 ? Math.exp(-(lt - t462) * 7) : 0;
    return { auto: false, shake: 2 * hit, flash: 0.08 * hit, rgb: 3 * hit };
  },
};
