// S10 — DROP 2: four features, one Persona menu panel per bar (Vue coach, carte joueur, suivi, assistant).
import * as L from './lib-S09.mjs';

const { BEAT, S16 } = L;
// ------------------------------------------------------------------ timing (local seconds, bar 36 = 0)
const ENTER = [0, 1.6, 3.2, 4.8];
const EXIT = [1.6, 3.0, 4.8, 99];
const FROM = [-1, 1, -1, 1]; // -1 = enters from the left
const STABS = [0, 0.6, 3.2, 3.8];
const TOGGLE = [0.4, 0.8]; // 5 → 10 → 20
const MORPH_T = 1.2;
const SHEEN = [2.2, 2.7];
const FAN_T = 2.4;
const GHOST_T = 3.0;
const SLASH_T = 3.1;
const ARROW_T = 3.24;
const FILLS = [3.2, 3.6, 4.0, 4.2, 4.4];
const BUBBLES = [[3.6, 1], [4.4, 3]];
const SPARKLE = [5.2, 6.0];
const RING_T = 5.6;

// ------------------------------------------------------------------ panel geometry
const PCX = 960;
const PCY = 380;
const PW = 1240;
const PH = 440;
const SKEW = Math.tan((-18 * Math.PI) / 180);
const sx = (x, y) => x + SKEW * y; // skewX(−18°): the top edge leans right

function jaggedOutline(K) {
  const R = K.rng(77);
  const corners = [[-PW / 2, -PH / 2], [PW / 2, -PH / 2], [PW / 2, PH / 2], [-PW / 2, PH / 2]];
  const pts = [];
  const segs = [];
  for (let e = 0; e < 4; e++) {
    const [x0, y0] = corners[e];
    const [x1, y1] = corners[(e + 1) % 4];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / 44));
    const nx = (y1 - y0) / len;
    const ny = -(x1 - x0) / len;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const j = i === 0 ? 0 : (i % 2 ? 1 : -1) * (2 + R() * 4);
      const x = x0 + (x1 - x0) * t + nx * j;
      const y = y0 + (y1 - y0) * t + ny * j;
      pts.push([sx(x, y), y]);
    }
  }
  for (let i = 0; i < pts.length; i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
  return { pts, segs };
}
let OUTLINE = null;
const outline = (K) => OUTLINE || (OUTLINE = jaggedOutline(K));
function outlinePath(ctx, K, inset = 0) {
  const { pts } = outline(K);
  const s = inset ? 1 - inset / (PW / 2) : 1;
  const sy = inset ? 1 - inset / (PH / 2) : 1;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * sy) : ctx.moveTo(x * s, y * sy)));
  ctx.closePath();
}
const PM = 110; // bitmap margin
function panelBitmap(K) {
  return L.cached('s10-panel', PW + PM * 2 + 160, PH + PM * 2, (x) => {
    x.translate(PM + 80 + PW / 2, PM + PH / 2);
    x.save();
    x.translate(18, 18);
    outlinePath(x, K);
    x.fillStyle = K.C.ink;
    x.fill();
    x.restore();
    outlinePath(x, K);
    x.fillStyle = K.rgba('#0f172a', 0.92);
    x.fill();
    x.save();
    x.clip();
    const g = x.createLinearGradient(-PW / 2, -PH / 2, PW / 2, PH / 2);
    g.addColorStop(0, K.rgba(K.C.cyan2, 0.1));
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, K.rgba(K.C.fuchsia2, 0.08));
    x.fillStyle = g;
    x.fillRect(-PW, -PH, PW * 2, PH * 2);
    // fine diagonal hatching for texture
    x.strokeStyle = 'rgba(148,163,184,0.04)';
    x.lineWidth = 2;
    x.beginPath();
    for (let i = -PW; i < PW; i += 18) {
      x.moveTo(i, -PH / 2);
      x.lineTo(i + PH * 0.5, PH / 2);
    }
    x.stroke();
    x.restore();
    const { segs } = outline(K);
    x.lineWidth = 6;
    x.lineJoin = 'miter';
    x.lineCap = 'square';
    [K.C.cyan2, K.C.fuchsia2].forEach((col, c) => {
      x.strokeStyle = col;
      x.beginPath();
      segs.forEach(([a, b], i) => {
        if (Math.floor(i / 2) % 2 !== c) return;
        x.moveTo(a[0], a[1]);
        x.lineTo(b[0], b[1]);
      });
      x.stroke();
    });
  });
}
function panelGhost(ctx, K, x, a) {
  const b = panelBitmap(K);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.drawImage(b, x - (PM + 80 + PW / 2), -(PM + PH / 2));
  ctx.restore();
}

// ------------------------------------------------------------------ content: Vue coach (real Évolution chart)
const CHART_SRC = [107, 494, 2474, 690];
const CHART_END = [0.9766, 0.229]; // last point of the curve inside the crop (normalised)
const CHART_PTS = [[0.0687, 0.762], [0.523, 0.406], CHART_END];
function drawCoach(ctx, f, K, lt) {
  const w = K.lerp(1000, 1030, K.E.outCubic(K.seg(lt, 0, 1.6)));
  const h = (w * CHART_SRC[3]) / CHART_SRC[2];
  const cx = -14;
  const cy = 46;
  const reveal = K.E.outCubic(K.seg(lt, 0, 0.34));
  const glare = Math.max(K.seg(lt, TOGGLE[0], TOGGLE[0] + 0.32), K.seg(lt, TOGGLE[1], TOGGLE[1] + 0.32));
  const gOn = (lt > TOGGLE[0] && lt < TOGGLE[0] + 0.32) || (lt > TOGGLE[1] && lt < TOGGLE[1] + 0.32);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2 - 80, cy - h / 2 - 80, (w + 160) * reveal, h + 160);
  ctx.clip();
  K.screen(ctx, 'ui-analyses.png', cx, cy, w, { src: CHART_SRC, glow: 0.7, frame: K.C.cyan, glare: gOn ? glare : -1, r: 14 });
  ctx.restore();
  // glow trace over the real curve (emphasis only, same three points as the screenshot)
  const pts = CHART_PTS.map(([u, v]) => [cx - w / 2 + u * w, cy - h / 2 + v * h]);
  const xr = cx - w / 2 + w * reveal;
  const trace = 1 - K.seg(lt, 0.5, 0.9);
  if (trace > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = K.rgba(K.C.cyan, 0.55 * trace);
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = K.C.cyan2;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      if (i && x > xr) {
        const [px, py] = pts[i - 1];
        if (px < xr) ctx.lineTo(xr, py + ((y - py) * (xr - px)) / (x - px));
        return;
      }
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
  if (reveal > 0 && reveal < 1) {
    const x = cx - w / 2 + w * reveal;
    ctx.fillStyle = K.C.cyan;
    ctx.fillRect(x - 2, cy - h / 2 - 10, 4, h + 20);
    ctx.fillStyle = K.rgba(K.C.cyan, 0.25);
    ctx.fillRect(x - 14, cy - h / 2 - 10, 12, h + 20);
  }
  // end point pulse on the 36.3 kick
  const ex = cx - w / 2 + CHART_END[0] * w;
  const ey = cy - h / 2 + CHART_END[1] * h;
  const age = lt - MORPH_T;
  if (age >= 0) {
    const q = K.clamp(age / 0.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = K.rgba(K.C.violet2, 1 - q);
    ctx.lineWidth = 5 * (1 - q) + 1;
    ctx.beginPath();
    ctx.arc(ex, ey, 10 + 70 * K.E.outCubic(q), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = K.C.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex, ey, 22 + 6 * Math.exp(-age * 8), 0, Math.PI * 2);
    ctx.stroke();
  }
  // header: icon + two wordless chips, segmented control 5 | 10 | 20
  K.icon(ctx, 'graph', -476, -150, 58, { color: K.C.cyan, lw: 7 });
  [[-410, 132, 0.12], [-262, 104, 0.2]].forEach(([x, cw, t]) => {
    const e = K.E.outBack(K.seg(lt, t, t + 0.16), 2);
    if (e <= 0) return;
    ctx.save();
    ctx.translate(x + cw / 2, -150);
    ctx.scale(e, e);
    ctx.fillStyle = K.rgba(K.C.violet, 0.16);
    K.roundRect(ctx, -cw / 2, -19, cw, 38, 19);
    ctx.fill();
    ctx.strokeStyle = K.rgba(K.C.violet2, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = K.C.violet2;
    ctx.beginPath();
    ctx.arc(-cw / 2 + 20, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = K.rgba(K.C.text2, 0.55);
    K.roundRect(ctx, -cw / 2 + 36, -5, cw - 56, 10, 5);
    ctx.fill();
    ctx.restore();
  });
  const opts = ['5', '10', '20'];
  const tx = 380;
  const ty = -150;
  const tw = 234;
  const ow = tw / 3;
  ctx.fillStyle = K.C.ink;
  K.roundRect(ctx, tx - tw / 2, ty - 23, tw, 46, 23);
  ctx.fill();
  ctx.strokeStyle = K.rgba(K.C.cyan, 0.45);
  ctx.lineWidth = 2;
  ctx.stroke();
  const pos = TOGGLE.reduce((acc, t) => acc + K.E.outBack(K.seg(lt, t, t + 0.14), 1.6), 0);
  const px = tx - tw / 2 + ow / 2 + pos * ow;
  ctx.fillStyle = K.C.cyan;
  ctx.shadowColor = K.C.cyan;
  ctx.shadowBlur = 14;
  K.roundRect(ctx, px - ow / 2 + 4, ty - 19, ow - 8, 38, 19);
  ctx.fill();
  ctx.shadowBlur = 0;
  opts.forEach((o, i) => {
    const ox = tx - tw / 2 + ow / 2 + i * ow;
    const on = Math.abs(ox - px) < ow / 2;
    K.text(ctx, o, ox, ty + 1, { size: 26, font: K.F.russo, color: on ? K.C.ink : K.C.text2 });
  });
}

// ------------------------------------------------------------------ content: player card + récap fan
function cardBack(ctx, K, w, h) {
  K.roundRect(ctx, -w / 2, -h / 2, w, h, 18);
  ctx.fillStyle = K.linearSpectrum(ctx, -w / 2, -h / 2, w / 2, h / 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(2,6,17,0.35)';
  ctx.lineWidth = 3;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
    K.hexPath(ctx, -w / 2 + 20 + c * 72 + (r % 2) * 36, -h / 2 + 20 + r * 66, 30);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = K.C.ink;
  K.roundRect(ctx, -w / 2 + 30, -40, w - 60, 80, 14);
  ctx.fill();
  K.logo(ctx, 0, 0, w - 90, { glow: 2, lineWidth: 3 });
}
function cardFront(ctx, K, w, h, lt) {
  K.roundRect(ctx, -w / 2, -h / 2, w, h, 18);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#231c4d');
  g.addColorStop(1, '#0b1224');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = K.linearSpectrum(ctx, -w / 2, -h / 2, w / 2, h / 2);
  ctx.stroke();
  // role tag
  ctx.fillStyle = K.C.cyan;
  K.roundRect(ctx, -w / 2 + 18, -h / 2 + 18, 74, 36, 8);
  ctx.fill();
  K.text(ctx, 'MID', -w / 2 + 55, -h / 2 + 37, { size: 24, font: K.F.russo, color: K.C.ink });
  // geometric avatar
  const ay = -h / 2 + 140;
  ctx.save();
  K.hexPath(ctx, 0, ay, 74, Math.PI / 6);
  ctx.fillStyle = K.rgba(K.C.violet, 0.22);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = K.C.violet2;
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = K.C.ink;
  ctx.beginPath();
  ctx.arc(0, ay - 12, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-50, ay + 76);
  ctx.quadraticCurveTo(-46, ay + 20, 0, ay + 18);
  ctx.quadraticCurveTo(46, ay + 20, 50, ay + 76);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // three unnumbered bars
  [[0.8, K.C.cyan2], [0.58, K.C.violet], [0.9, K.C.fuchsia2]].forEach(([v, col], i) => {
    const y = -h / 2 + 248 + i * 30;
    ctx.fillStyle = '#1e293b';
    K.roundRect(ctx, -w / 2 + 28, y, w - 56, 12, 6);
    ctx.fill();
    const grow = K.E.outCubic(K.clamp((lt - ENTER[1] - 0.3 - i * 0.06) / 0.3));
    ctx.fillStyle = col;
    K.roundRect(ctx, -w / 2 + 28, y, (w - 56) * v * grow, 12, 6);
    ctx.fill();
  });
  K.logo(ctx, 0, h / 2 - 26, 92, { glow: 1, lineWidth: 2, alpha: 0.8 });
}
function drawStory(ctx, K, kind, w, h, k) {
  K.roundRect(ctx, -w / 2, -h / 2, w, h, 16);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, ['#1d2a52', '#2a1d52', '#3a1d4f'][k]);
  g.addColorStop(1, '#0b1224');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = K.rgba(K.C.violet2, 0.6);
  ctx.lineWidth = 3;
  ctx.stroke();
  // story progress segments
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i <= k + 1 ? K.C.text : 'rgba(203,213,225,0.25)';
    ctx.fillRect(-w / 2 + 14 + i * ((w - 28) / 5), -h / 2 + 14, (w - 28) / 5 - 5, 4);
  }
  const col = [K.C.cyan, K.C.fuchsia, K.C.violet2][k];
  if (kind === 'star') {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.shadowColor = col;
    ctx.shadowBlur = 16;
    K.starPath(ctx, 0, -20, 52, 22, 5);
    ctx.stroke();
    ctx.restore();
  } else K.icon(ctx, kind, 0, -18, 110, { color: col, lw: 6 });
  ctx.fillStyle = 'rgba(241,245,249,0.75)';
  K.roundRect(ctx, -w / 2 + 26, h / 2 - 86, w - 52, 12, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(203,213,225,0.35)';
  K.roundRect(ctx, -w / 2 + 26, h / 2 - 62, (w - 52) * 0.65, 10, 5);
  ctx.fill();
}
function drawPlayer(ctx, f, K, lt) {
  // the card holds the centre, then steps left on 37.2 to make room for the récap fan
  const CX = K.lerp(0, -300, K.E.outExpo(K.seg(lt, FAN_T, FAN_T + 0.22)));
  // récap fan (behind the card)
  const fan = [[24, 12, -8], [208, 0, 0], [392, 12, 8]];
  ['graph', 'star', 'hex'].forEach((kind, k) => {
    const e = K.E.outBack(K.seg(lt, FAN_T + k * 0.05, FAN_T + 0.24 + k * 0.05), 1.6);
    if (e <= 0) return;
    const [x, y, deg] = fan[k];
    ctx.save();
    ctx.translate(K.lerp(CX, x, e), K.lerp(0, y, e));
    ctx.rotate((deg * Math.PI * e) / 180);
    ctx.globalAlpha *= K.clamp(e * 3);
    drawStory(ctx, K, kind, 180, 320, k);
    ctx.restore();
  });
  // flip-in card
  const p = K.seg(lt, ENTER[1], ENTER[1] + 0.3);
  const c = Math.cos(Math.PI * p);
  const w = 260;
  const h = 380;
  ctx.save();
  ctx.translate(CX, 0);
  ctx.rotate(-0.04);
  ctx.scale(Math.max(0.02, Math.abs(c)), 1);
  ctx.shadowColor = K.rgba(K.C.violet, 0.7);
  ctx.shadowBlur = 34;
  ctx.fillStyle = K.C.ink;
  K.roundRect(ctx, -w / 2, -h / 2, w, h, 18);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (c > 0) cardBack(ctx, K, w, h);
  else cardFront(ctx, K, w, h, lt);
  // holo sheen on 37.1.5 and 37.2.75
  for (const t of SHEEN) {
    const q = K.seg(lt, t, t + 0.3);
    if (q <= 0 || q >= 1) continue;
    ctx.save();
    K.roundRect(ctx, -w / 2, -h / 2, w, h, 18);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(0.5);
    const x = K.lerp(-360, 360, K.E.inOutCubic(q));
    const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    g.addColorStop(0, 'rgba(103,232,249,0)');
    g.addColorStop(0.35, 'rgba(103,232,249,0.35)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.65, 'rgba(232,121,249,0.35)');
    g.addColorStop(1, 'rgba(232,121,249,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, -500, 180, 1000);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ content: objectives & coach notes
const RING_X = [-14, 116, 246, 376, 506];
const RING_Y = 34;
const LEVELS = [0.82, 0.55, 0.92, 0.42, 0.7];
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const TGT = [-330, 0];
function drawObjectives(ctx, f, K, lt) {
  // target
  const [tx, ty] = TGT;
  [[150, K.C.cyan2], [100, K.C.violet], [50, K.C.cyan]].forEach(([r, col], i) => {
    ctx.fillStyle = K.rgba(col, 0.06 + i * 0.03);
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 8;
    ctx.stroke();
  });
  ctx.fillStyle = K.C.text;
  ctx.beginPath();
  ctx.arc(tx, ty, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = K.rgba(K.C.text2, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx - 182, ty);
  ctx.lineTo(tx + 182, ty);
  ctx.moveTo(tx, ty - 182);
  ctx.lineTo(tx, ty + 182);
  ctx.stroke();
  // rings
  RING_X.forEach((x, i) => {
    const r = 46;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(x, RING_Y, r, 0, Math.PI * 2);
    ctx.stroke();
    const fill = LEVELS[i] * K.E.outCubic(K.seg(lt, FILLS[i], FILLS[i] + 0.3));
    if (fill > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = K.linearSpectrum(ctx, x - r, RING_Y - r, x + r, RING_Y + r);
      ctx.beginPath();
      ctx.arc(x, RING_Y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
      ctx.stroke();
      ctx.restore();
    }
    const fl = Math.exp(-Math.max(0, lt - FILLS[i]) * 9) * (lt >= FILLS[i] ? 1 : 0);
    if (fl > 0.02) {
      ctx.strokeStyle = K.rgba(K.C.cyan, fl);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, RING_Y, r + 12 + (1 - fl) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = K.rgba(K.C.text2, 0.85);
    ctx.beginPath();
    ctx.arc(x, RING_Y - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, RING_Y + 22, 18, Math.PI, 0);
    ctx.fill();
    K.text(ctx, ROLES[i], x, RING_Y + 84, { size: 24, font: K.F.russo, color: i === 1 ? K.C.violet2 : K.C.text2 });
  });
  // coach-note bubbles
  for (const [t, i] of BUBBLES) {
    const e = K.E.outBack(K.seg(lt, t, t + 0.18), 2.2);
    if (e <= 0) continue;
    const x = RING_X[i];
    ctx.save();
    ctx.translate(x, RING_Y - 98);
    ctx.scale(e, e);
    ctx.fillStyle = K.C.violet;
    K.roundRect(ctx, -84, -38, 168, 70, 16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, 31);
    ctx.lineTo(0, 46);
    ctx.lineTo(12, 31);
    ctx.fill();
    ctx.fillStyle = K.rgba(K.C.ink, 0.75);
    K.roundRect(ctx, -62, -18, 124, 11, 5);
    ctx.fill();
    K.roundRect(ctx, -62, 4, 84, 11, 5);
    ctx.fill();
    ctx.restore();
  }
}
/** The arrow is drawn in screen space so it can fly in before the panel settles. */
function drawArrow(ctx, f, K, lt, panelX) {
  if (lt < ARROW_T - 0.1) return;
  const tx = PCX + panelX + TGT[0];
  const ty = PCY + TGT[1];
  const q = K.E.inQuad(K.seg(lt, ARROW_T - 0.1, ARROW_T));
  const ang = Math.atan2(260, 520);
  const dist = (1 - q) * 900;
  const x = tx - Math.cos(ang) * dist;
  const y = ty - Math.sin(ang) * dist;
  const age = Math.max(0, lt - ARROW_T);
  const wob = 0.09 * Math.sin(age * 46) * Math.exp(-age * 7) * (lt >= ARROW_T ? 1 : 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang + wob);
  ctx.fillStyle = K.C.text;
  ctx.fillRect(-250, -4, 236, 8);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-30, -18);
  ctx.lineTo(-24, 0);
  ctx.lineTo(-30, 18);
  ctx.closePath();
  ctx.fillStyle = K.C.cyan;
  ctx.fill();
  ctx.fillStyle = K.C.fuchsia2;
  ctx.beginPath();
  ctx.moveTo(-250, 0);
  ctx.lineTo(-284, -22);
  ctx.lineTo(-236, -4);
  ctx.closePath();
  ctx.moveTo(-250, 0);
  ctx.lineTo(-284, 22);
  ctx.lineTo(-236, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (lt >= ARROW_T) K.shockwave(ctx, tx, ty, K.clamp(age / 0.4), { color: K.C.cyan, maxR: 300, width: 22, sparks: 10, seed: 21 });
}

// ------------------------------------------------------------------ content: assistant
const PROMPT = ['Que veux-tu faire', 'sur cette page\u00a0?'];
function sparkle(ctx, K, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 ? r * 0.28 : r;
    i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = K.linearSpectrum(ctx, -r, -r, r, r);
  ctx.shadowColor = K.C.cyan;
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
}
function drawAssistant(ctx, f, K, lt) {
  const bx = -548;
  const by = -178;
  const bw = 620;
  const bh = 196;
  // main bubble
  ctx.save();
  ctx.fillStyle = '#111827';
  K.roundRect(ctx, bx, by, bw, bh, 26);
  ctx.fill();
  ctx.strokeStyle = K.C.cyan;
  ctx.lineWidth = 3;
  K.roundRect(ctx, bx, by, bw, bh, 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + 70, by + bh - 3);
  ctx.lineTo(bx + 50, by + bh + 46);
  ctx.lineTo(bx + 120, by + bh - 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(bx + 72, by + bh - 6, 46, 5);
  ctx.fillStyle = K.rgba(K.C.cyan2, 0.07);
  ctx.fill();
  ctx.restore();
  const tw = Math.max(...SPARKLE.map((t) => (lt >= t ? Math.exp(-(lt - t) * 7) : 0)));
  sparkle(ctx, K, bx + 58, by + 62, 30 * (1 + 0.55 * tw), tw * 0.8 + lt * 0.4);
  K.icon(ctx, 'chat', bx + 58, by + 140, 52, { color: K.C.violet2, lw: 7 });
  // typed prompt (real assistant heading)
  const tp = K.seg(lt, ENTER[3] + 0.06, ENTER[3] + 0.46);
  const total = PROMPT[0].length + PROMPT[1].length;
  let n = Math.floor(tp * total);
  PROMPT.forEach((line, i) => {
    const s = line.slice(0, Math.max(0, n));
    n -= line.length;
    if (s) K.text(ctx, s, bx + 112, by + 66 + i * 64, { size: 44, font: (px) => K.F.inter(px, 800), align: 'left', color: K.C.text, alpha: 0.92 });
  });
  // typing indicator
  const tx = bx + bw - 200;
  const ty = by + bh + 34;
  ctx.fillStyle = K.rgba(K.C.violet, 0.22);
  K.roundRect(ctx, tx, ty, 132, 56, 28);
  ctx.fill();
  ctx.strokeStyle = K.rgba(K.C.violet2, 0.6);
  ctx.lineWidth = 2;
  ctx.stroke();
  const step = Math.floor(lt / S16);
  for (let i = 0; i < 3; i++) {
    const up = (step + 3 - i) % 3 === 0 ? 1 : 0;
    ctx.fillStyle = up ? K.C.cyan : K.C.violet2;
    ctx.beginPath();
    ctx.arc(tx + 36 + i * 30, ty + 28 - up * 9, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // NXT5 page sketch with the highlight ring
  const px = 170;
  const py = -184;
  const pw = 360;
  const ph = 340;
  ctx.fillStyle = '#0b1224';
  K.roundRect(ctx, px, py, pw, ph, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(px + 2, py + 2, pw - 4, 46);
  K.logo(ctx, px + 62, py + 25, 84, { glow: 1, lineWidth: 2 });
  ctx.fillStyle = '#273449';
  for (let i = 0; i < 4; i++) {
    K.roundRect(ctx, px + 16, py + 70 + i * 40, 66, 22, 6);
    ctx.fill();
  }
  ctx.fillStyle = '#334155';
  K.roundRect(ctx, px + 100, py + 66, pw - 118, 110, 10);
  ctx.fill();
  const btn = [px + 100, py + 196, 150, 46];
  ctx.fillStyle = '#3b4a5e';
  K.roundRect(ctx, ...btn, 10);
  ctx.fill();
  ctx.fillStyle = '#334155';
  K.roundRect(ctx, px + 100, py + 262, pw - 118, 60, 10);
  ctx.fill();
  const age = lt - RING_T;
  if (age >= 0) {
    const e = K.E.outBack(K.clamp(age / 0.2), 2);
    const [bx2, by2, bw2, bh2] = btn;
    const cx = bx2 + bw2 / 2;
    const cy = by2 + bh2 / 2;
    // dashed pointer from the bubble to the ring
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -lt * 80;
    ctx.strokeStyle = K.rgba(K.C.cyan, 0.8 * K.clamp(age / 0.1));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + bh * 0.62);
    const ex = K.lerp(bx + bw, bx2 - 14, K.E.outExpo(K.clamp(age / 0.16)));
    const ey = K.lerp(by + bh * 0.62, cy, K.E.outExpo(K.clamp(age / 0.16)));
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    const s = K.lerp(1.9, 1, e);
    ctx.scale(s, s);
    ctx.strokeStyle = K.C.cyan;
    ctx.lineWidth = 5;
    ctx.shadowColor = K.C.cyan;
    ctx.shadowBlur = 20;
    K.roundRect(ctx, -bw2 / 2 - 14, -bh2 / 2 - 12, bw2 + 28, bh2 + 24, 18);
    ctx.stroke();
    ctx.restore();
    const fl = Math.exp(-age * 9);
    ctx.fillStyle = K.rgba(K.C.cyan, 0.5 * fl);
    K.roundRect(ctx, ...btn, 10);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ panel driver
const CONTENT = [drawCoach, drawPlayer, drawObjectives, drawAssistant];
function panelX(lt, k, K) {
  const ein = K.E.outExpo(K.seg(lt, ENTER[k], ENTER[k] + BEAT * 0.25));
  let x = FROM[k] * 1400 * (1 - ein);
  const dir = k < 3 ? FROM[k + 1] * -1 : 1;
  const out = K.E.inCubic(K.seg(lt, EXIT[k] - 0.1, EXIT[k])); // gone exactly on the next downbeat
  x += dir * 1800 * out;
  return { x, out, ein };
}
function drawPanels(ctx, f, K) {
  const lt = f.lt;
  for (let k = 0; k < 4; k++) {
    if (lt < ENTER[k] || lt >= EXIT[k]) continue;
    const { x, out, ein } = panelX(lt, k, K);
    ctx.save();
    ctx.translate(PCX, PCY);
    // motion ghosts (entry and whip-off)
    const moving = (ein < 0.999 ? 1 : 0) || (out > 0.001 && out < 0.999 ? 1 : 0);
    if (moving) {
      const dirIn = -FROM[k];
      const dirOut = k < 3 ? -FROM[k + 1] : 1;
      const d = out > 0.001 ? dirOut : dirIn;
      for (let g = 4; g >= 1; g--) panelGhost(ctx, K, x - d * g * 70, 0.28 * (1 - (g - 1) / 4));
    }
    const s = 1 + 0.02 * f.kick;
    ctx.translate(x, 0);
    ctx.scale(s, s);
    const b = panelBitmap(K);
    ctx.drawImage(b, -(PM + 80 + PW / 2), -(PM + PH / 2));
    ctx.save();
    outlinePath(ctx, K, 10);
    ctx.clip();
    CONTENT[k](ctx, f, K, lt);
    ctx.restore();
    // slam flash: bright jagged edge, not a grey fill
    const fl = Math.exp(-(lt - ENTER[k]) * 12);
    if (fl > 0.03) {
      outlinePath(ctx, K);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * fl})`;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.restore();
    if (k === 2) drawArrow(ctx, f, K, lt, x);
  }
}

function drawGhostLine(ctx, f, K) {
  const lt = f.lt;
  if (lt < GHOST_T || lt >= ENTER[2]) return;
  const p = K.seg(lt, GHOST_T, ENTER[2]);
  ctx.save();
  ctx.fillStyle = K.rgba(K.C.ink, 0.45);
  ctx.fillRect(0, 0, 1920, 1080);
  const str = 'MÊME ERREUR DEMAIN.';
  const jit = Math.floor(lt / (S16 / 2)) % 2 ? 4 : -4;
  K.text(ctx, str, 960 + jit + 7, 540, { size: 150, font: K.F.anton, color: K.C.cyan2, alpha: 0.22 });
  K.text(ctx, str, 960 - jit - 7, 540, { size: 150, font: K.F.anton, color: K.C.fuchsia2, alpha: 0.22 });
  K.text(ctx, str, 960, 540, { size: 150, font: K.F.anton, color: K.C.text, alpha: 0.5 });
  const sp = K.E.outExpo(K.seg(lt, SLASH_T, SLASH_T + 0.05));
  if (sp > 0) {
    const x0 = 300;
    const y0 = 600;
    const x1 = 1620;
    const y1 = 470;
    ctx.strokeStyle = K.C.fuchsia2;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.shadowColor = K.C.fuchsia2;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(K.lerp(x0, x1, sp), K.lerp(y0, y1, sp));
    ctx.stroke();
  }
  ctx.restore();
  return p;
}

/** Scene-drawn stamp card « Même erreur ? Notée. Suivie. » + its sub, sized to stay clear of the sub pill. */
function drawStampCard(ctx, f, K, c) {
  const a = L.cardAlpha(f, K, c, 0.02);
  if (a <= 0) return;
  const lt = f.lt - f.at(c.bar, c.beat);
  const size = 108;
  const font = K.F.bebas;
  const cy = 826;
  const p = K.clamp(lt / (BEAT * 0.5));
  const s = K.lerp(2.1, 1, K.E.outExpo(p));
  ctx.save();
  ctx.globalAlpha *= a * K.clamp(p * 4);
  ctx.translate(960, cy);
  ctx.rotate(-0.04);
  ctx.scale(s, s);
  const w = K.measure(ctx, c.text, size, font, 4) + size * 0.8;
  const h = size * 1.3;
  ctx.fillStyle = K.rgba(K.C.ink, 0.8);
  K.roundRect(ctx, -w / 2, -h / 2, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = K.C.fuchsia2;
  ctx.lineWidth = 9;
  ctx.shadowColor = K.C.fuchsia2;
  ctx.shadowBlur = 22;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = K.rgba(K.C.fuchsia, 0.5);
  ctx.lineWidth = 2;
  K.roundRect(ctx, -w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 8);
  ctx.stroke();
  K.text(ctx, c.text, 0, 6, { size, font, color: K.C.text, emph: c.emph, spacing: 4 });
  ctx.restore();
  const sp = K.E.outCubic(K.seg(lt, BEAT * 0.4, BEAT * 1.2));
  ctx.save();
  ctx.globalAlpha *= a;
  L.subPill(ctx, K, c.sub, 960, 968, sp);
  ctx.restore();
}

export default {
  id: 'S10',
  startBar: 36,
  endBar: 40,
  transitionOut: 'cut',
  draw(ctx, f, K) {
    const lt = f.lt;
    L.baseLayers(ctx, f, K);
    const order = Math.max(0, STABS.filter((t) => lt >= t).length - 1) + 1;
    L.bands(ctx, K, { shift: lt * 140, order, alpha: 0.55, pulse: lt >= 0 ? f.env('snare', 9) : 0 });
    K.speedLines(ctx, f, { angle: Math.PI, density: 0.28, alpha: 0.22 + 0.3 * f.hat, color: K.C.cyan, speed: 2600, width: 2 });
    // octave-lead streak on the top edge, every 8th
    const ph = (((lt % (BEAT / 2)) + BEAT / 2) % (BEAT / 2)) / (BEAT / 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sx0 = -700 + ph * 3300;
    const g = ctx.createLinearGradient(sx0 - 700, 0, sx0, 0);
    g.addColorStop(0, 'rgba(34,211,238,0)');
    g.addColorStop(0.6, K.rgba(K.C.violet, 0.6));
    g.addColorStop(1, K.rgba(K.C.fuchsia, 0.95));
    ctx.fillStyle = g;
    ctx.fillRect(sx0 - 700, 14, 700, 5);
    ctx.restore();
    if (lt < 0) {
      L.brandBug(ctx, K);
      return {};
    }
    const cards = L.frCards(f.cardsOf);

    drawPanels(ctx, f, K);
    // brass spark bursts from the panel's leading edge
    // panels 1 and 3 enter from the left, so their leading edge is on the right
    [[STABS[0], 1590, 380, 0], [STABS[1], 960, 170, -Math.PI / 2], [STABS[2], 1590, 380, 0], [STABS[3], 960, 170, -Math.PI / 2]].forEach(
      ([t, x, y, dir], k) => L.sparkBurst(ctx, K, x, y, lt - t, 400 + k, { n: 30, life: 0.55, dir, spread: k % 2 ? Math.PI * 1.1 : Math.PI * 1.3 }),
    );
    drawGhostLine(ctx, f, K);

    // cards (lower third). « Ta carte joueur. » leaves early for the ghost line; the stamp is scene-drawn.
    const fadeCard1 = 1 - K.seg(lt, GHOST_T - 0.06, GHOST_T);
    cards.forEach((c, i) => {
      if (i === 2) return;
      ctx.save();
      ctx.globalAlpha *= i === 1 ? fadeCard1 : 1;
      L.cardBand(ctx, f, K, c);
      K.renderCards(ctx, f, cards, { x: 960, y: 870, size: 150, subSize: 54, maxW: 1500, skip: (cc, j) => j !== i });
      ctx.restore();
    });
    if (cards[2]) {
      L.cardBand(ctx, f, K, cards[2], { subGap: 4 });
      drawStampCard(ctx, f, K, cards[2]);
    }

    L.brandBug(ctx, K);
    return {};
  },
};
