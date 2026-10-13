// S10 — DROP 2: four features, one Persona menu panel per bar (Vue coach, carte joueur, suivi, assistant).
// Panels land ON the downbeats (entry starts 0.1 s early) and the outgoing panel whips off across the incoming one.
import * as L from './lib-S09.mjs';

const { BEAT, S16 } = L;
// ------------------------------------------------------------------ timing (local seconds, bar 36 = 0)
const BAR_T = [0, 1.6, 3.2, 4.8]; // the four downbeats
const ENTER = [-0.1, 1.5, 3.1, 4.7]; // outExpo entry over 0.1 s → landed exactly on the downbeat
const SWAP = 0.1; // the outgoing panel whips off during the last 0.1 s before the next downbeat
const FROM = [-1, 1, -1, 1]; // -1 = enters from the left
const STABS = [0, 0.6, 3.2, 3.8];
const TOGGLE = [0.4, 0.8]; // 5 → 10 → 20 on the 36.1 and 36.2 kicks
const TRACES = [[-0.04, 0.3], [0.4, 0.15], [0.8, 0.15]]; // line (re)draws: entry, then one per toggle kick
const PAYOFF_T = 1.2; // 36.3 kick: push-in on Partie 3 + the real highlight card
const SHEEN = [2.2, 2.7]; // 37.1.5 and 37.2.75 kicks
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
const OUTLINES = new Map(); // static geometry cache (built once)
const outline = (K) => OUTLINES.get('o') || (OUTLINES.set('o', jaggedOutline(K)), OUTLINES.get('o'));
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

// ------------------------------------------------------------------ giant faint watermark icons (one per panel)
function watermarkBitmap(K, kind) {
  return L.cached(`s10-wm-${kind}`, 320, 320, (x) => {
    x.translate(160, 160);
    if (kind === 'target') {
      x.strokeStyle = K.C.text;
      x.lineWidth = 14;
      for (const r of [124, 84, 44]) {
        x.beginPath();
        x.arc(0, 0, r, 0, Math.PI * 2);
        x.stroke();
      }
      x.fillStyle = K.C.text;
      x.beginPath();
      x.arc(0, 0, 14, 0, Math.PI * 2);
      x.fill();
      return;
    }
    K.icon(x, kind, 0, 0, 260, { color: K.C.text, lw: 6 });
  });
}
function watermark(ctx, K, kind, x, y, lt, k) {
  const b = watermarkBitmap(K, kind);
  const drift = (lt - BAR_T[k]) * -26; // slow parallax against the panel
  ctx.save();
  ctx.globalAlpha *= 0.12;
  ctx.drawImage(b, x - 160 + drift, y - 160);
  ctx.restore();
}

// ------------------------------------------------------------------ panel 0: Vue coach (real Analyses screenshot)
const UI = 'ui-analyses.png';
const SCR = { x: -516, y: -199, w: 1032, h: 398 }; // glass screen inside the panel (panel-local px)
const HDR_L = { src: [96, 70, 670, 130], x: -500, y: -190, s: 0.6 }; // « Trajectoire de l’équipe / Une mesure, partie après partie »
const HDR_R = { src: [2032, 74, 576, 172], x: 214, y: -192, s: 0.5 }; // « Mesure à suivre / Écart d’or »
const CHART = { src: [107, 494, 2474, 686], x: -495, y: -82, s: 0.4 };
const CHART_CLIP_Y = -100; // the chart zooms inside its own window, under the header strip
const LINE_SRC = [[277, 1020], [1401, 774], [2523, 652]]; // the real gold-gap curve (Parties 1, 2, 3)
const LABEL_SRC = [[262, 1092, 210, 86], [1290, 1092, 222, 86], [2328, 1092, 210, 86]];
const HL_SRC = [1372, 1386, 1214, 360]; // « Partie 3 sur 3 · Victoire · Scrim 3 · Aurore · Écart d’or +4 000 or »
const cx2 = (u) => CHART.x + (u - CHART.src[0]) * CHART.s;
const cy2 = (v) => CHART.y + (v - CHART.src[1]) * CHART.s;
const LINE = LINE_SRC.map(([u, v]) => [cx2(u), cy2(v)]);
const SEGLEN = [Math.hypot(LINE[1][0] - LINE[0][0], LINE[1][1] - LINE[0][1]), Math.hypot(LINE[2][0] - LINE[1][0], LINE[2][1] - LINE[1][1])];
const P3 = LINE[2];

function cropDraw(ctx, img, [sx0, sy0, sw, sh], x, y, s) {
  ctx.drawImage(img, sx0, sy0, sw, sh, x, y, sw * s, sh * s);
}
/** Point at fraction u (0..1, by arc length) along the curve. */
function linePoint(u) {
  const d = u * (SEGLEN[0] + SEGLEN[1]);
  if (d <= SEGLEN[0]) {
    const q = d / SEGLEN[0];
    return [LINE[0][0] + (LINE[1][0] - LINE[0][0]) * q, LINE[0][1] + (LINE[1][1] - LINE[0][1]) * q];
  }
  const q = (d - SEGLEN[0]) / SEGLEN[1];
  return [LINE[1][0] + (LINE[2][0] - LINE[1][0]) * q, LINE[1][1] + (LINE[2][1] - LINE[1][1]) * q];
}
function tracePath(ctx, u) {
  ctx.beginPath();
  ctx.moveTo(LINE[0][0], LINE[0][1]);
  const frac1 = SEGLEN[0] / (SEGLEN[0] + SEGLEN[1]);
  if (u > frac1) ctx.lineTo(LINE[1][0], LINE[1][1]);
  const [hx, hy] = linePoint(u);
  ctx.lineTo(hx, hy);
}
/** Current trace state: {u: head 0..1, drawing, age since the last trace started, k}. */
function traceState(lt) {
  let cur = null;
  TRACES.forEach(([t0, d], k) => {
    if (lt >= t0) cur = { t0, d, k };
  });
  if (!cur) return null;
  const u = Math.min(1, (lt - cur.t0) / cur.d);
  return { u, drawing: u < 1, age: lt - cur.t0, k: cur.k, t0: cur.t0, d: cur.d };
}
function coachZoom(K, lt) {
  const base = K.lerp(1, 1.08, K.E.inOutSine(K.seg(lt, -0.1, 1.6)));
  const pay = K.lerp(1, 1.25, K.E.outCubic(K.seg(lt, PAYOFF_T, PAYOFF_T + 0.3)));
  return { base, pay };
}
function drawCoach(ctx, f, K, lt) {
  watermark(ctx, K, 'graph', -420, 120, lt, 0);
  const img = K.uiImage(UI);
  if (!img) return;
  const { base, pay } = coachZoom(K, lt);
  const P3b = [P3[0] * base, P3[1] * base]; // where the Partie 3 point sits on screen (payoff zoom pivot)
  // glass screen frame, filled with the screenshot's own background so the crops blend in
  ctx.save();
  const bg = ctx.createLinearGradient(SCR.x, 0, SCR.x + SCR.w, 0);
  bg.addColorStop(0, '#252d47');
  bg.addColorStop(1, '#221e42');
  ctx.fillStyle = bg;
  K.roundRect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, 16);
  ctx.fill();
  ctx.clip();
  // header (real titles): fixed, never cropped by the pushes
  cropDraw(ctx, img, HDR_L.src, HDR_L.x, HDR_L.y, HDR_L.s);
  cropDraw(ctx, img, HDR_R.src, HDR_R.x, HDR_R.y, HDR_R.s);
  // chart: slow push over the bar, then the payoff push centred on the Partie 3 point
  ctx.save();
  ctx.beginPath();
  ctx.rect(SCR.x, CHART_CLIP_Y, SCR.w, SCR.y + SCR.h - CHART_CLIP_Y);
  ctx.clip();
  ctx.translate(P3b[0], P3b[1]);
  ctx.scale(pay, pay);
  ctx.translate(-P3b[0], -P3b[1]);
  ctx.scale(base, base);
  cropDraw(ctx, img, CHART.src, CHART.x, CHART.y, CHART.s);
  // the gold-gap line re-traces left → right on every toggle kick (the screenshot line is hidden while it redraws)
  const tr = traceState(lt);
  if (tr) {
    if (tr.drawing) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const eg = ctx.createLinearGradient(LINE[0][0], 0, LINE[2][0], 0);
      eg.addColorStop(0, '#111b2d');
      eg.addColorStop(0.5, '#181f39');
      eg.addColorStop(1, '#1e2242');
      ctx.strokeStyle = eg;
      ctx.lineWidth = 7;
      ctx.beginPath();
      LINE.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
    const glow = tr.drawing ? 1 : 0.45 + 0.55 * Math.exp(-(tr.age - tr.d) * 5);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    tracePath(ctx, tr.u);
    ctx.strokeStyle = K.rgba(K.C.cyan2, 0.22 * glow);
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.strokeStyle = K.rgba(K.C.cyan, 0.45 * glow);
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = K.C.cyan;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    // points reached so far
    const frac1 = SEGLEN[0] / (SEGLEN[0] + SEGLEN[1]);
    [0, frac1, 1].forEach((pu, i) => {
      if (tr.u < pu) return;
      ctx.fillStyle = i === 2 ? K.C.violet2 : K.C.cyan;
      ctx.beginPath();
      ctx.arc(LINE[i][0], LINE[i][1], i === 2 ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
    });
    // x-axis labels flash as the head passes each Partie
    [0, frac1, 1].forEach((pu, i) => {
      const tHit = tr.t0 + tr.d * pu;
      const fl = lt >= tHit ? Math.exp(-(lt - tHit) * 9) : 0;
      if (fl < 0.03) return;
      const [u0, v0, w0, h0] = LABEL_SRC[i];
      const x = cx2(u0);
      const y = cy2(v0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = K.rgba(K.C.cyan, 0.32 * fl);
      K.roundRect(ctx, x - 4, y - 2, w0 * CHART.s + 8, h0 * CHART.s + 4, 6);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = K.rgba(K.C.cyan, fl);
      ctx.fillRect(x, y + h0 * CHART.s + 4, w0 * CHART.s, 3);
    });
    // spark at the head while drawing
    if (tr.drawing) {
      const [hx, hy] = linePoint(tr.u);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 34);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, K.rgba(K.C.cyan, 0.7));
      g.addColorStop(1, K.rgba(K.C.cyan, 0));
      ctx.fillStyle = g;
      ctx.fillRect(hx - 34, hy - 34, 68, 68);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2) + lt * 20;
        ctx.moveTo(hx + Math.cos(a) * 8, hy + Math.sin(a) * 8);
        ctx.lineTo(hx + Math.cos(a) * 22, hy + Math.sin(a) * 22);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  // payoff ring on the Partie 3 point
  const age = lt - PAYOFF_T;
  if (age >= 0) {
    const q = K.clamp(age / 0.35);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = K.rgba(K.C.violet2, 1 - q);
    ctx.lineWidth = 5 * (1 - q) + 1;
    ctx.beginPath();
    ctx.arc(P3[0], P3[1], 10 + 60 * K.E.outCubic(q), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = K.C.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(P3[0], P3[1], 16 + 6 * Math.exp(-age * 8), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // glare sweep (entry, then the payoff)
  for (const [t0, d] of [[-0.1, 0.45], [PAYOFF_T, 0.4]]) {
    const q = K.seg(lt, t0, t0 + d);
    if (q <= 0 || q >= 1) continue;
    const gx = SCR.x - 300 + K.E.inOutCubic(q) * (SCR.w + 600);
    const g = ctx.createLinearGradient(gx - 170, 0, gx + 170, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(SCR.x - 400, SCR.y - 200, SCR.w + 800, SCR.h + 400);
  }
  ctx.restore();
  // segmented control 5 | 10 | 20 (stays in the screen's top bar, not zoomed)
  const opts = ['5', '10', '20'];
  const tx = 74;
  const ty = -158;
  const tw = 246;
  const ow = tw / 3;
  ctx.fillStyle = K.C.ink;
  K.roundRect(ctx, tx - tw / 2, ty - 25, tw, 50, 25);
  ctx.fill();
  ctx.strokeStyle = K.rgba(K.C.cyan, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  const pos = TOGGLE.reduce((acc, t) => acc + K.E.outBack(K.seg(lt, t, t + 0.14), 1.6), 0);
  const px = tx - tw / 2 + ow / 2 + pos * ow;
  const kfl = Math.max(...TOGGLE.map((t) => (lt >= t ? Math.exp(-(lt - t) * 10) : 0)));
  ctx.fillStyle = K.C.cyan;
  K.roundRect(ctx, px - ow / 2 + 4, ty - 21, ow - 8, 42, 21);
  ctx.fill();
  if (kfl > 0.03) {
    ctx.strokeStyle = K.rgba('#ffffff', kfl);
    ctx.lineWidth = 3;
    K.roundRect(ctx, px - ow / 2 + 1, ty - 24, ow - 2, 48, 24);
    ctx.stroke();
  }
  opts.forEach((o, i) => {
    const ox = tx - tw / 2 + ow / 2 + i * ow;
    const on = Math.abs(ox - px) < ow / 2;
    K.text(ctx, o, ox, ty + 1, { size: 28, font: K.F.russo, color: on ? K.C.ink : K.C.text2 });
  });
  // frame
  ctx.strokeStyle = K.rgba(K.C.cyan, 0.85);
  ctx.lineWidth = 3;
  K.roundRect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, 16);
  ctx.stroke();
}
/** The real highlight card pops out of the frame on the 36.3 kick (drawn unclipped, panel-local). */
function drawCoachOver(ctx, f, K, lt) {
  const img = K.uiImage(UI);
  const age = lt - PAYOFF_T;
  if (!img || age < 0) return;
  const w = 650;
  const s = w / HL_SRC[2];
  const h = HL_SRC[3] * s;
  const base = coachZoom(K, lt).base;
  const p3 = [P3[0] * base, P3[1] * base]; // displayed Partie 3 point (the payoff zoom pivots on it)
  const ax = p3[0] + 40; // anchor: the card's top-right corner, just under the Partie 3 point
  const ay = p3[1] + 34;
  const e = K.E.outBack(K.clamp(age / 0.2), 1.7);
  const sc = K.lerp(0.55, 1, e);
  // connector from the point to the card
  ctx.save();
  ctx.strokeStyle = K.rgba(K.C.violet2, 0.9 * K.clamp(age / 0.08));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p3[0], p3[1] + 18);
  ctx.lineTo(ax - 20, ay + 4);
  ctx.stroke();
  ctx.translate(ax, ay);
  ctx.scale(sc, sc);
  ctx.globalAlpha *= K.clamp(age / 0.05);
  ctx.fillStyle = K.C.ink;
  K.roundRect(ctx, -w + 12, 12, w, h, 16);
  ctx.fill();
  ctx.save();
  K.roundRect(ctx, -w, 0, w, h, 16);
  ctx.clip();
  ctx.drawImage(img, HL_SRC[0], HL_SRC[1], HL_SRC[2], HL_SRC[3], -w, 0, w, h);
  const fl = Math.exp(-age * 9);
  if (fl > 0.03) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * fl})`;
    ctx.fillRect(-w, 0, w, h);
  }
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = K.linearSpectrum(ctx, -w, 0, 0, h);
  K.roundRect(ctx, -w, 0, w, h, 16);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ panel 1: player card + récap fan
const CARD_X = -330;
const CARD_W = 320;
const CARD_H = 460;
const FAN = [[-40, 10, -8], [180, 0, 0], [400, 10, 8]];
const STORY_W = 200;
const STORY_H = 352;
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
  ctx.fillStyle = K.C.cyan;
  K.roundRect(ctx, -w / 2 + 18, -h / 2 + 18, 74, 36, 8);
  ctx.fill();
  K.text(ctx, 'MID', -w / 2 + 55, -h / 2 + 37, { size: 24, font: K.F.russo, color: K.C.ink });
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
  [[0.8, K.C.cyan2], [0.58, K.C.violet], [0.9, K.C.fuchsia2]].forEach(([v, col], i) => {
    const y = -h / 2 + 248 + i * 30;
    ctx.fillStyle = '#1e293b';
    K.roundRect(ctx, -w / 2 + 28, y, w - 56, 12, 6);
    ctx.fill();
    const grow = K.E.outCubic(K.clamp((lt - BAR_T[1] - 0.3 - i * 0.06) / 0.3));
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
  watermark(ctx, K, 'users', 250, 10, lt, 1);
  // dashed slots where the récap stories will land (the right half is never dead)
  const slotA = 1 - K.seg(lt, FAN_T, FAN_T + 0.15);
  if (slotA > 0) {
    ctx.save();
    ctx.globalAlpha *= 0.3 * slotA;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -lt * 50;
    ctx.strokeStyle = K.C.violet2;
    ctx.lineWidth = 3;
    for (const [x, y, deg] of FAN) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((deg * Math.PI) / 180);
      K.roundRect(ctx, -STORY_W / 2, -STORY_H / 2, STORY_W, STORY_H, 16);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
/** The card is taller than the panel: it is drawn unclipped and breaks the frame. */
function drawPlayerOver(ctx, f, K, lt) {
  ['graph', 'star', 'hex'].forEach((kind, k) => {
    const e = K.E.outBack(K.seg(lt, FAN_T + k * 0.05, FAN_T + 0.24 + k * 0.05), 1.6);
    if (e <= 0) return;
    const [x, y, deg] = FAN[k];
    ctx.save();
    ctx.translate(K.lerp(CARD_X, x, e), K.lerp(0, y, e));
    ctx.rotate((deg * Math.PI * e) / 180);
    ctx.globalAlpha *= K.clamp(e * 3);
    drawStory(ctx, K, kind, STORY_W, STORY_H, k);
    ctx.restore();
  });
  const p = K.seg(lt, BAR_T[1], BAR_T[1] + 0.3);
  const c = Math.cos(Math.PI * p);
  const w = CARD_W;
  const h = CARD_H;
  ctx.save();
  ctx.translate(CARD_X, 0);
  ctx.rotate(-0.04);
  ctx.scale(Math.max(0.02, Math.abs(c)), 1);
  ctx.fillStyle = K.C.ink;
  K.roundRect(ctx, -w / 2 + 14, -h / 2 + 14, w, h, 18);
  ctx.fill();
  ctx.save();
  ctx.scale(w / 260, h / 380);
  if (c > 0) cardBack(ctx, K, 260, 380);
  else cardFront(ctx, K, 260, 380, lt);
  ctx.restore();
  // holo sheen: brightest frame on the kick (starts 0.04 s early, outCubic −160 → +360 over 0.25 s)
  for (const t of SHEEN) {
    const q = K.seg(lt, t - 0.04, t + 0.21);
    if (q <= 0 || q >= 1) continue;
    ctx.save();
    K.roundRect(ctx, -w / 2, -h / 2, w, h, 18);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(0.5);
    const x = K.lerp(-160, 360, K.E.outCubic(q));
    const g = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
    g.addColorStop(0, 'rgba(103,232,249,0)');
    g.addColorStop(0.25, 'rgba(103,232,249,0.5)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.75, 'rgba(232,121,249,0.5)');
    g.addColorStop(1, 'rgba(232,121,249,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, -600, 120, 1200);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ panel 2: objectives & coach notes
const RING_X = [-108, 44, 196, 348, 500];
const RING_Y = 4;
const RING_R = 56;
const LEVELS = [0.82, 0.55, 0.92, 0.42, 0.7];
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const TGT = [-372, 0];
function drawObjectives(ctx, f, K, lt) {
  watermark(ctx, K, 'target', 566, -150, lt, 2);
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
  RING_X.forEach((x, i) => {
    const r = RING_R;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 14;
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
    const fl = lt >= FILLS[i] ? Math.exp(-(lt - FILLS[i]) * 9) : 0;
    if (fl > 0.02) {
      ctx.strokeStyle = K.rgba(K.C.cyan, fl);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, RING_Y, r + 14 + (1 - fl) * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = K.rgba(K.C.text2, 0.85);
    ctx.beginPath();
    ctx.arc(x, RING_Y - 12, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, RING_Y + 26, 22, Math.PI, 0);
    ctx.fill();
    K.text(ctx, ROLES[i], x, RING_Y + 100, { size: 28, font: K.F.russo, color: i === 1 ? K.C.violet2 : K.C.text2 });
  });
  for (const [t, i] of BUBBLES) {
    const e = K.E.outBack(K.seg(lt, t, t + 0.18), 2.2);
    if (e <= 0) continue;
    const x = RING_X[i];
    ctx.save();
    ctx.translate(x, RING_Y - 126);
    ctx.scale(e, e);
    ctx.fillStyle = K.C.violet;
    K.roundRect(ctx, -88, -38, 176, 70, 16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, 31);
    ctx.lineTo(0, 46);
    ctx.lineTo(12, 31);
    ctx.fill();
    ctx.fillStyle = K.rgba(K.C.ink, 0.75);
    K.roundRect(ctx, -64, -18, 128, 11, 5);
    ctx.fill();
    K.roundRect(ctx, -64, 4, 88, 11, 5);
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

// ------------------------------------------------------------------ panel 3: assistant
const PROMPT = ['Que veux-tu faire', 'sur cette page ?'];
const BUB = { x: -526, y: -192, w: 600, h: 214 };
const PAGE = { x: 96, y: -206, w: 456, h: 412 };
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
  watermark(ctx, K, 'chat', -250, 150, lt, 3);
  const { x: bx, y: by, w: bw, h: bh } = BUB;
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
  sparkle(ctx, K, bx + 60, by + 66, 32 * (1 + 0.55 * tw), tw * 0.8 + lt * 0.4);
  K.icon(ctx, 'chat', bx + 60, by + 150, 56, { color: K.C.violet2, lw: 7 });
  // typed prompt (the assistant's real opening question)
  const tp = K.seg(lt, BAR_T[3] - 0.04, BAR_T[3] + 0.3);
  const total = PROMPT[0].length + PROMPT[1].length;
  let n = Math.floor(tp * total);
  PROMPT.forEach((line, i) => {
    const s = line.slice(0, Math.max(0, n));
    n -= line.length;
    if (s) K.text(ctx, s, bx + 118, by + 72 + i * 70, { size: 48, font: (px) => K.F.inter(px, 800), align: 'left', color: K.C.text, alpha: 0.94 });
  });
  // typing indicator
  const tx = bx + bw - 170;
  const ty = by + bh + 30;
  ctx.fillStyle = K.rgba(K.C.violet, 0.22);
  K.roundRect(ctx, tx, ty, 140, 60, 30);
  ctx.fill();
  ctx.strokeStyle = K.rgba(K.C.violet2, 0.6);
  ctx.lineWidth = 2;
  ctx.stroke();
  const step = Math.floor(lt / S16);
  for (let i = 0; i < 3; i++) {
    const up = (step + 3 - i) % 3 === 0 ? 1 : 0;
    ctx.fillStyle = up ? K.C.cyan : K.C.violet2;
    ctx.beginPath();
    ctx.arc(tx + 38 + i * 32, ty + 30 - up * 10, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}
/** NXT5 page sketch with the highlight ring (×1.2, drawn unclipped). */
function drawAssistantOver(ctx, f, K, lt) {
  const { x: px, y: py, w: pw, h: ph } = PAGE;
  const k = pw / 360;
  ctx.fillStyle = '#0b1224';
  K.roundRect(ctx, px, py, pw, ph, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(px + 2, py + 2, pw - 4, 54);
  K.logo(ctx, px + 70, py + 29, 100, { glow: 1, lineWidth: 2 });
  ctx.fillStyle = '#273449';
  for (let i = 0; i < 4; i++) {
    K.roundRect(ctx, px + 18, py + 80 + i * 46, 80, 26, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#334155';
  K.roundRect(ctx, px + 120, py + 76, pw - 140, 124, 12);
  ctx.fill();
  const btn = [px + 120, py + 220, 180, 54];
  ctx.fillStyle = '#3b4a5e';
  K.roundRect(ctx, ...btn, 12);
  ctx.fill();
  ctx.fillStyle = '#334155';
  K.roundRect(ctx, px + 120, py + 296, pw - 140, ph - 316, 12);
  ctx.fill();
  const age = lt - RING_T;
  if (age >= 0) {
    const e = K.E.outBack(K.clamp(age / 0.2), 2);
    const [bx2, by2, bw2, bh2] = btn;
    const cx = bx2 + bw2 / 2;
    const cy = by2 + bh2 / 2;
    const { x: bx, y: by, w: bw, h: bh } = BUB;
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -lt * 80;
    ctx.strokeStyle = K.rgba(K.C.cyan, 0.85 * K.clamp(age / 0.1));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + bh * 0.62);
    const ex = K.lerp(bx + bw, bx2 - 16, K.E.outExpo(K.clamp(age / 0.16)));
    const ey = K.lerp(by + bh * 0.62, cy, K.E.outExpo(K.clamp(age / 0.16)));
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    const s = K.lerp(1.9, 1, e);
    ctx.scale(s, s);
    ctx.strokeStyle = K.C.cyan;
    ctx.lineWidth = 6;
    ctx.shadowColor = K.C.cyan;
    ctx.shadowBlur = 20;
    K.roundRect(ctx, -bw2 / 2 - 16 * k, -bh2 / 2 - 14, bw2 + 32 * k, bh2 + 28, 20);
    ctx.stroke();
    ctx.restore();
    const fl = Math.exp(-age * 9);
    ctx.fillStyle = K.rgba(K.C.cyan, 0.5 * fl);
    K.roundRect(ctx, ...btn, 12);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ panel driver
const CONTENT = [drawCoach, drawPlayer, drawObjectives, drawAssistant];
const OVER = [drawCoachOver, drawPlayerOver, null, drawAssistantOver];
function panelX(lt, k, K) {
  const ein = K.E.outExpo(K.seg(lt, ENTER[k], ENTER[k] + 0.1));
  let x = FROM[k] * 1400 * (1 - ein);
  const dir = k < 3 ? -FROM[k + 1] : 1;
  const next = k < 3 ? BAR_T[k + 1] : 99;
  const out = K.E.inCubic(K.seg(lt, next - SWAP, next)); // whips off across the incoming panel
  x += dir * 1800 * out;
  return { x, out, ein, dir };
}
function drawPanels(ctx, f, K) {
  const lt = f.lt;
  for (let k = 0; k < 4; k++) {
    const next = k < 3 ? BAR_T[k + 1] : 99;
    if (lt < ENTER[k] || lt >= next) continue;
    const { x, out, ein, dir } = panelX(lt, k, K);
    ctx.save();
    ctx.translate(PCX, PCY);
    const entering = ein < 0.999;
    const leaving = out > 0.001 && out < 0.999;
    if (entering || leaving) {
      const d = leaving ? dir : -FROM[k];
      for (let g = 4; g >= 1; g--) panelGhost(ctx, K, x - d * g * 70, 0.28 * (1 - (g - 1) / 4));
    }
    const s = 1 + 0.02 * (lt >= 0 ? f.kick : 0);
    ctx.translate(x, 0);
    ctx.scale(s, s);
    const b = panelBitmap(K);
    ctx.drawImage(b, -(PM + 80 + PW / 2), -(PM + PH / 2));
    ctx.save();
    outlinePath(ctx, K, 10);
    ctx.clip();
    CONTENT[k](ctx, f, K, lt);
    ctx.restore();
    if (OVER[k]) OVER[k](ctx, f, K, lt);
    // slam flash keyed to the downbeat: bright jagged edge, not a grey fill
    const fl = lt >= BAR_T[k] ? Math.exp(-(lt - BAR_T[k]) * 12) : 0;
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

// ------------------------------------------------------------------ 37.3.5 flashback: the old line, slashed
function drawGhostLine(ctx, f, K) {
  const lt = f.lt;
  if (lt < GHOST_T || lt >= BAR_T[2]) return;
  ctx.save();
  ctx.fillStyle = K.rgba(K.C.night, 0.55);
  ctx.fillRect(0, 0, 1920, 1080);
  const str = 'MÊME ERREUR DEMAIN.';
  const jit = Math.floor((lt + 0.001) / S16) % 2 ? 2 : -2; // 2 px jitter on every hat
  K.text(ctx, str, 960 + jit + 6, 540, { size: 150, font: K.F.anton, color: K.C.cyan2, alpha: 0.2 });
  K.text(ctx, str, 960 + jit - 6, 540, { size: 150, font: K.F.anton, color: K.C.fuchsia2, alpha: 0.2 });
  K.text(ctx, str, 960 + jit, 540, { size: 150, font: K.F.anton, color: K.C.text, alpha: 0.5 });
  const sp = K.E.outExpo(K.seg(lt, SLASH_T, SLASH_T + 0.05));
  if (sp > 0) {
    const x0 = 300;
    const y0 = 600;
    const x1 = 1620;
    const y1 = 470;
    const xe = K.lerp(x0, x1, sp);
    const ye = K.lerp(y0, y1, sp);
    ctx.lineCap = 'round';
    ctx.strokeStyle = K.C.fuchsia2;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(xe, ye);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
    K.shockwave(ctx, x1, y1, K.clamp((lt - SLASH_T - 0.04) / 0.16), { color: K.C.fuchsia, maxR: 140, width: 12, sparks: 8, seed: 33 });
  }
  ctx.restore();
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

// the bar-39 card lasts 4.5 beats so renderCards' quick exit falls after the 40.0 cut: it is cut at full strength
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
  id: 'S10',
  startBar: 36,
  endBar: 40,
  transitionOut: 'cut',
  draw(ctx, f0, K) {
    // f.lt and f.at() round differently: nudge lt so a frame that sits exactly on a downbeat counts as on/after it
    const f = { ...f0, lt: f0.lt + 1e-6 };
    const lt = f.lt;
    L.baseLayers(ctx, f, K);
    const order = Math.max(0, STABS.filter((t) => lt >= t).length - 1) + 1;
    L.bands(ctx, K, { shift: lt * 140, order, alpha: 0.55, pulse: lt >= 0 ? f.env('snare', 9) : 0 });
    K.speedLines(ctx, f, { angle: Math.PI, density: 0.28, alpha: 0.22 + 0.3 * (lt >= 0 ? f.hat : 0), color: K.C.cyan, speed: 2600, width: 2 });
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
    // under the renderer slash, panel 0 is already in flight (clean state: no cards, no FX)
    if (lt >= ENTER[0] - 0.02) drawPanels(ctx, f, K);
    if (lt < 0) {
      L.brandBug(ctx, K);
      return {};
    }
    const cards = sceneCards(f);
    // brass spark bursts from the panel's leading edge (panels 1 and 3 enter from the left → right edge)
    [[STABS[0], 1590, 380, 0], [STABS[1], 960, 170, -Math.PI / 2], [STABS[2], 1590, 380, 0], [STABS[3], 960, 170, -Math.PI / 2]].forEach(
      ([t, x, y, dir], k) => L.sparkBurst(ctx, K, x, y, lt - t, 400 + k, { n: 30, life: 0.55, dir, spread: k % 2 ? Math.PI * 1.1 : Math.PI * 1.3 }),
    );
    drawGhostLine(ctx, f, K);

    // cards (lower third). « Ta carte joueur. » leaves for the ghost line; the stamp is scene-drawn.
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
