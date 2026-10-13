// S07 — Discord, le moment humain (bars 24–28).
// Bars 24–25: the chat panel (generic dark chat UI, no Discord chrome) answers « /nxt voir » with a match summary;
//             a small NXT5 settings pill shows that publishing is a per-channel choice (Auto | Manuel).
// Bars 26–27: the panel steps back, teammates talk, and the empty debrief clipboard finally gets its first lines.
// 27.3–28.0: every UI element implodes toward the point where S08's orb is born (960, 440).
import { bokeh, particleField, brandBug, calmLines, subPill, bitmap, countIn, eventsIn } from './lib-S07.mjs';

const NB = ' ';
const CARDS = [
  { bar: 24, beat: 0, durBeats: 4, text: '/nxt voir', emph: '/nxt', sub: 'Ton équipe, depuis Discord.', style: 'type', sceneDrawn: true },
  { bar: 25, beat: 0, durBeats: 4, text: 'Ta partie, résumée sur Discord.', emph: 'résumée', sub: 'Auto ou manuel, dans tes salons.', style: 'calm', sceneDrawn: true },
  // ends on 27.3.5 so the frame is clear for the implosion
  { bar: 26, beat: 0, durBeats: 7.5, text: `Tu débriefes vraiment tes scrims${NB}?`, emph: 'vraiment', sub: '', style: 'calm', sceneDrawn: true },
];

const BEAT = 0.4;
const BAR = 1.6;
const T0 = 24 * BAR; // absolute start of the scene
const L = (bar, beat = 0) => (bar - 24) * BAR + beat * BEAT; // local seconds
const OX = 960; // S08's orb
const OY = 440;

// ------------------------------------------------------------------ chat panel geometry (local px)
const PW = 920;
const PH = 560;
const PM = 56; // offscreen margin for the glow
const STRIP = 200;
const MSG = { x: 220, y: 72, w: 680, h: 402 }; // message area (bottom anchored at y + h)
const INPUT = { x: 220, y: 488, w: 680, h: 52 };
const CHIPS = ['derniere', 'bilan', 'stats', 'planning', 'objectifs', 'reviews', 'draft'];
const CHIP = { size: 30, h: 48, gap: 14, pad: 36 };
const BOX_TOP = INPUT.y - 170; // autocomplete popup top
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const ROLE_FILL = [0.74, 0.58, 0.9, 0.66, 0.5];
const EMBED_H = 344;
const HIST_DIV = 44; // « Aujourd’hui » divider height
const HIST_MSG = 80;

function chrome(K) {
  const { C, rgba } = K;
  return bitmap('S07-chrome', PW + PM * 2, PH + PM * 2, (x) => {
    x.translate(PM, PM);
    x.shadowColor = rgba(C.violet, 0.5);
    x.shadowBlur = 44;
    x.fillStyle = '#0f172a';
    K.roundRect(x, 0, 0, PW, PH, 24);
    x.fill();
    x.shadowBlur = 0;
    // channel strip
    x.save();
    K.roundRect(x, 0, 0, PW, PH, 24);
    x.clip();
    x.fillStyle = '#0b1222';
    x.fillRect(0, 0, STRIP, PH);
    x.fillStyle = rgba(C.violet2, 0.16);
    x.fillRect(STRIP, 0, 1.5, PH);
    // header
    x.fillStyle = rgba(C.violet2, 0.14);
    x.fillRect(STRIP, 58, PW - STRIP, 1.5);
    x.restore();
    // strip: section label + channels
    K.text(x, 'SALONS', 26, 36, { size: 15, font: K.F.russo, color: C.muted, align: 'left', spacing: 2, alpha: 0.75 });
    x.fillStyle = rgba(C.violet, 0.16);
    K.roundRect(x, 14, 124, STRIP - 28, 42, 10);
    x.fill();
    K.text(x, '# scrims', 28, 98, { size: 24, font: (px) => K.F.inter(px, 600), color: C.text2, align: 'left', alpha: 0.6 });
    K.text(x, '# résultats', 28, 145, { size: 24, font: (px) => K.F.inter(px, 600), color: C.text, align: 'left', alpha: 0.6 });
    // faint placeholder channels
    x.fillStyle = rgba(C.muted, 0.12);
    for (let i = 0; i < 3; i++) {
      K.roundRect(x, 30, 196 + i * 46, 96 + (i % 2) * 34, 10, 5);
      x.fill();
    }
    // header title
    K.text(x, '#', STRIP + 26, 30, { size: 26, font: (px) => K.F.inter(px, 700), color: C.muted, align: 'left' });
    K.text(x, 'résultats', STRIP + 52, 30, { size: 26, font: (px) => K.F.inter(px, 700), color: C.text, align: 'left' });
    // input bar
    x.fillStyle = '#1e293b';
    K.roundRect(x, INPUT.x, INPUT.y, INPUT.w, INPUT.h, 12);
    x.fill();
    // border
    x.strokeStyle = rgba(C.violet, 0.95);
    x.lineWidth = 2;
    K.roundRect(x, 1, 1, PW - 2, PH - 2, 24);
    x.stroke();
  });
}

/** Old teammate messages: avatar + name bar + text bars (no names, no numbers). */
function oldMessage(x, K, top, i) {
  const { C, rgba } = K;
  const cols = [C.violet, C.fuchsia, C.cyan, C.violet];
  x.fillStyle = rgba(cols[i % 4], 0.55);
  x.beginPath();
  x.arc(MSG.x + 26, top + 26, 18, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = rgba(cols[i % 4], 0.6);
  K.roundRect(x, MSG.x + 58, top + 12, 80 + (i % 2) * 40, 12, 6);
  x.fill();
  x.fillStyle = rgba(C.muted, 0.22);
  K.roundRect(x, MSG.x + 58, top + 36, 300 + ((i * 97) % 160), 11, 5);
  x.fill();
  if (i % 2 === 1) {
    K.roundRect(x, MSG.x + 58, top + 56, 190 + ((i * 53) % 90), 11, 5);
    x.fill();
  }
}

/** « Aujourd’hui » day divider at the top of the history. */
function dayDivider(x, K, top) {
  const { C, rgba } = K;
  const y = top + HIST_DIV / 2;
  const font = (px) => K.F.inter(px, 700);
  const label = 'Aujourd’hui';
  const tw = K.measure(x, label, 17, font);
  const mid = MSG.x + MSG.w / 2;
  x.fillStyle = rgba(C.violet2, 0.2);
  x.fillRect(MSG.x + 16, y, mid - tw / 2 - 14 - (MSG.x + 16), 1.5);
  x.fillRect(mid + tw / 2 + 14, y, MSG.x + MSG.w - 16 - (mid + tw / 2 + 14), 1.5);
  K.text(x, label, mid, y + 1, { size: 17, font, color: C.muted, alpha: 0.8 });
}

let CHIP_LAYOUT = null; // static layout, measured once
function chipLayout(x, K) {
  if (CHIP_LAYOUT) return CHIP_LAYOUT;
  const out = [];
  [[0, 1, 2, 3], [4, 5, 6]].forEach((row, ri) => {
    let cx = MSG.x + 20;
    row.forEach((i, k) => {
      const w = K.measure(x, CHIPS[i], CHIP.size, K.F.russo) + CHIP.pad;
      out[i] = { x: cx, y: INPUT.y - 66 - ri * 58, w, h: CHIP.h, prev: k ? row[k - 1] : -1 };
      cx += w + CHIP.gap;
    });
  });
  CHIP_LAYOUT = out;
  return out;
}

function drawEmbed(x, K, f, lt, top) {
  const { C, rgba, clamp, E, seg } = K;
  // bot row
  K.hexPath(x, MSG.x + 26, top + 26, 21, 0);
  x.fillStyle = C.cyan;
  x.fill();
  K.text(x, '5', MSG.x + 26, top + 28, { size: 24, font: K.F.russo, color: C.ink });
  K.logo(x, MSG.x + 58 + 44, top + 22, 88, { glow: 0, lineWidth: 1.6, fill: 0.9 });
  x.fillStyle = rgba(C.indigo, 0.9);
  K.roundRect(x, MSG.x + 158, top + 12, 46, 22, 6);
  x.fill();
  K.text(x, 'BOT', MSG.x + 181, top + 24, { size: 13, font: K.F.russo, color: C.ink });
  // card
  const cx = MSG.x + 58;
  const cy = top + 48;
  const cw = MSG.w - 58 - 16;
  const ch = EMBED_H - 56;
  x.fillStyle = '#131d33';
  K.roundRect(x, cx, cy, cw, ch, 12);
  x.fill();
  x.strokeStyle = rgba(C.cyan, 0.22);
  x.lineWidth = 1.5;
  x.stroke();
  x.fillStyle = C.cyan;
  K.roundRect(x, cx, cy, 6, ch, [12, 0, 0, 12]);
  x.fill();
  K.text(x, 'Résumé de partie', cx + 28, cy + 40, { size: 32, font: K.F.russo, color: C.text, align: 'left' });
  // rows: role pill + bar (no numbers)
  const reveal0 = L(25, 2);
  const pw = 80;
  const ph = 32;
  for (let i = 0; i < 5; i++) {
    const ry = cy + 92 + i * 42;
    const tR = reveal0 + i * 0.1;
    const rp = E.outCubic(seg(lt, tR, tR + 0.22));
    const bx = cx + 28 + pw + 22;
    const bw = cw - (bx - cx) - 30;
    if (rp <= 0) {
      // skeleton
      x.fillStyle = rgba(C.muted, 0.08);
      K.roundRect(x, cx + 28, ry - ph / 2, pw, ph, 9);
      x.fill();
      K.roundRect(x, bx, ry - 6, bw, 12, 6);
      x.fill();
      continue;
    }
    x.save();
    x.globalAlpha *= rp;
    x.translate((1 - rp) * -24, 0);
    const col = [C.cyan, C.violet, C.fuchsia, C.indigo, C.cyan2][i];
    x.strokeStyle = col;
    x.lineWidth = 2;
    K.roundRect(x, cx + 28, ry - ph / 2, pw, ph, 9);
    x.stroke();
    K.text(x, ROLES[i], cx + 28 + pw / 2, ry + 1, { size: 22, font: K.F.russo, color: col });
    x.fillStyle = '#1e293b';
    K.roundRect(x, bx, ry - 6, bw, 12, 6);
    x.fill();
    // fill steps on every hat after the reveal
    const hats = countIn('hat', T0 + tR, f.t);
    const fp = E.outCubic(clamp(hats / 5));
    const fw = bw * ROLE_FILL[i] * fp;
    if (fw > 1) {
      x.fillStyle = K.linearSpectrum(x, bx, 0, bx + bw, 0);
      K.roundRect(x, bx, ry - 6, fw, 12, 6);
      x.fill();
      x.fillStyle = C.text;
      x.beginPath();
      x.arc(bx + fw, ry, 5 + Math.exp(-(f.since('hat') || 0) * 20) * 2, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  }
}

/** Draws the chat panel content into an offscreen context (origin = panel top-left). */
function drawPanel(x, K, f, lt) {
  const { C, rgba, clamp, E, seg } = K;
  x.drawImage(chrome(K), -PM, -PM);
  const tE = L(25, 0); // 'derniere' is picked
  const tS = tE + 0.1; // the embed rises into a cleared message area
  // ---------- message area (clipped)
  x.save();
  x.beginPath();
  x.rect(MSG.x, MSG.y, MSG.w, MSG.h);
  x.clip();
  const slide = E.outCubic(seg(lt, tS, tS + 0.32));
  const bottom = MSG.y + MSG.h;
  const shift = EMBED_H * slide;
  const top0 = bottom - HIST_DIV - 4 * HIST_MSG - shift;
  if (top0 + HIST_DIV > MSG.y) dayDivider(x, K, top0);
  for (let i = 0; i < 4; i++) {
    const top = top0 + HIST_DIV + i * HIST_MSG;
    if (top + HIST_MSG < MSG.y) continue;
    oldMessage(x, K, top, i);
  }
  if (lt >= tS) {
    const top = bottom - shift;
    const pop = E.outBack(seg(lt, tS, tS + 0.36), 1.6);
    x.save();
    x.translate(MSG.x + MSG.w / 2, top + EMBED_H);
    x.scale(0.94 + 0.06 * pop, 0.94 + 0.06 * pop);
    x.translate(-(MSG.x + MSG.w / 2), -(top + EMBED_H));
    drawEmbed(x, K, f, lt, top);
    x.restore();
  }
  x.restore();
  // ---------- input bar: caret only, cyan rim while the command is live
  const typing = seg(lt, -0.05, 0.1) * (1 - seg(lt, tE + 0.1, tE + 0.5));
  if (typing > 0.01) {
    x.save();
    x.shadowColor = C.cyan;
    x.shadowBlur = 18 * typing;
    x.strokeStyle = rgba(C.cyan, 0.85 * typing);
    x.lineWidth = 2.5;
    K.roundRect(x, INPUT.x, INPUT.y, INPUT.w, INPUT.h, 12);
    x.stroke();
    x.restore();
  }
  // 'enter' pulses: the command is recognised (24.1.25), then sent (25.0)
  for (const [tp, amp] of [[L(24, 1.25), 1], [tE, 0.75]]) {
    const q = seg(lt, tp, tp + 0.3);
    if (q <= 0 || q >= 1) continue;
    const hx = INPUT.x + INPUT.w * E.outCubic(q);
    x.save();
    K.roundRect(x, INPUT.x, INPUT.y, INPUT.w, INPUT.h, 12);
    x.clip();
    const g = x.createLinearGradient(hx - 260, 0, hx, 0);
    g.addColorStop(0, rgba(C.cyan, 0));
    g.addColorStop(1, rgba(C.cyan, 0.6 * amp * (1 - q)));
    x.fillStyle = g;
    x.fillRect(hx - 260, INPUT.y, 260, INPUT.h);
    x.fillStyle = rgba('#ffffff', 0.95 * amp * (1 - q));
    x.fillRect(hx - 4, INPUT.y, 4, INPUT.h);
    x.restore();
  }
  const blinkOn = lt < 1.6 ? Math.floor((lt + 10) / 0.2) % 2 === 0 : Math.floor((lt + 10) / 0.4) % 2 === 0;
  if (blinkOn) {
    x.fillStyle = C.cyan;
    x.fillRect(INPUT.x + 22, INPUT.y + 13, 3, INPUT.h - 26);
  }
  // ---------- autocomplete chips: the popup grows up from the input bar, chips deal out one per 16th.
  // Each row has its own lane: the first chip pops in place, the next ones slide out from behind their
  // left neighbour, so flight paths never cross. On 25.0 the popup collapses into the input bar.
  const tc0 = L(24, 2.25);
  if (lt >= tc0 - 0.02 && lt < tE + 0.2) {
    const lay = chipLayout(x, K);
    const open = E.outCubic(seg(lt, tc0, tc0 + 0.14));
    const close = E.inCubic(seg(lt, tE + 0.04, tE + 0.18));
    const sy = open * (1 - close);
    if (sy > 0.002) {
      x.save();
      x.translate(0, INPUT.y);
      x.scale(1, sy);
      x.translate(0, -INPUT.y);
      x.fillStyle = '#0b1222';
      K.roundRect(x, MSG.x + 4, BOX_TOP, MSG.w - 8, INPUT.y - BOX_TOP - 8, 14);
      x.fill();
      x.strokeStyle = rgba(C.violet2, 0.35);
      x.lineWidth = 1.5;
      x.stroke();
      K.text(x, 'SUJET', MSG.x + 24, BOX_TOP + 24, { size: 16, font: K.F.russo, color: C.muted, align: 'left', spacing: 2 });
      const picked = lt >= tE;
      for (const i of [3, 2, 1, 0, 6, 5, 4]) {
        const c = lay[i];
        const ti = tc0 + i * 0.1;
        const cp = seg(lt, ti, ti + 0.2);
        if (cp <= 0) continue;
        const e = E.outBack(cp, 1.8);
        const tx = c.x + c.w / 2;
        const ty = c.y + c.h / 2;
        const lead = c.prev < 0;
        const fromX = lead ? tx - 36 : lay[c.prev].x + lay[c.prev].w / 2;
        const px = K.lerp(fromX, tx, lead ? E.outCubic(cp) : e);
        const s = lead ? 0.6 + 0.4 * e : 0.9 + 0.1 * e;
        const isHl = i === 0 && picked;
        x.save();
        x.translate(px, ty);
        x.scale(s, s);
        x.globalAlpha *= clamp(cp * 4) * (picked && !isHl ? 0.45 : 1);
        if (isHl) {
          x.shadowColor = C.cyan;
          x.shadowBlur = 26;
        }
        x.fillStyle = isHl ? C.cyan : '#1e293b';
        K.roundRect(x, -c.w / 2, -c.h / 2, c.w, c.h, c.h / 2);
        x.fill();
        x.shadowBlur = 0;
        x.strokeStyle = isHl ? C.text : rgba(C.cyan, 0.6);
        x.lineWidth = isHl ? 2.5 : 1.5;
        x.stroke();
        K.text(x, CHIPS[i], 0, 1, { size: CHIP.size, font: K.F.russo, color: isHl ? C.ink : C.text });
        x.restore();
      }
      x.restore();
    }
  }
}

// ------------------------------------------------------------------ panel placement (shared by the panel and the typing dashes)
function panelXf(K, lt) {
  const { E, seg, lerp } = K;
  const enter = E.outExpo(seg(lt, -0.24, 0.3));
  const move = E.inOutCubic(seg(lt, L(26, 0), L(26, 1.5)));
  const drift = E.inOutSine(seg(lt, 0, L(26, 0)));
  return {
    enter,
    move,
    pcx: lerp(lerp(1340 + 420, 1340, enter) - drift * 12, 590, move),
    pcy: lerp(440 - drift * 6, 400, move),
    sc: lerp(1 + drift * 0.035, 640 / PW, move),
    tilt: (lerp(lerp(-11, -4, enter) + drift * 0.8, -2, move) * Math.PI) / 180,
    alpha: enter * lerp(1, 0.6, move),
  };
}
/** Panel-local point (origin = panel top-left) -> screen. */
function toScreen(xf, lx, ly) {
  const dx = (lx - PW / 2) * xf.sc;
  const dy = (ly - PH / 2) * xf.sc;
  const c = Math.cos(xf.tilt);
  const s = Math.sin(xf.tilt);
  return [xf.pcx + dx * c - dy * s, xf.pcy + dx * s + dy * c];
}

/** 27.3 → 28.0: the UI layer is sucked into the orb's birth point (scale 1 → 0.15, +8°, alpha → 0). */
function implode(ctx, K, lt) {
  const e = K.E.inCubic(K.seg(lt, L(27, 3), L(28, 0)));
  if (e <= 0) return 1;
  const s = K.lerp(1, 0.15, e);
  ctx.translate(OX, OY);
  ctx.rotate((8 * Math.PI * e) / 180);
  ctx.scale(s, s);
  ctx.translate(-OX, -OY);
  ctx.globalAlpha *= 1 - e;
  return 1 - e;
}

// ------------------------------------------------------------------ bar 25: NXT5 route setting (outside the chat)
function routePill(ctx, K, lt) {
  const { C, E, seg, rgba, clamp } = K;
  const t0 = L(25, 1);
  const p = seg(lt, t0, t0 + 0.3);
  const out = E.inCubic(seg(lt, L(26, 0), L(26, 0) + 0.3));
  if (p <= 0 || out >= 1) return;
  const e = E.outBack(p, 1.6);
  const w = 624;
  const h = 74;
  const mark = bitmap('S07-routemark', 140, 56, (x) => K.logo(x, 70, 28, 104, { glow: 0, lineWidth: 2, fill: 0.85 }));
  ctx.save();
  ctx.globalAlpha *= clamp(p * 3) * (1 - out);
  ctx.translate(1484, 804 + (1 - e) * 26 + out * 20);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.fillStyle = rgba(C.ink, 0.92);
  K.roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.drawImage(mark, -w / 2 + 12, -28);
  K.text(ctx, `Publication${NB}:`, -w / 2 + 156, 1, { size: 28, font: K.F.russo, color: C.text2, align: 'left' });
  // segmented toggle, Auto on
  const tw = 236;
  const th = 52;
  const tx = w / 2 - tw - 10;
  const ty = -th / 2;
  ctx.fillStyle = '#0b1222';
  K.roundRect(ctx, tx, ty, tw, th, th / 2);
  ctx.fill();
  ctx.strokeStyle = rgba(C.violet2, 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const tp = L(25, 2.5);
  const pulse = lt >= tp ? Math.exp(-(lt - tp) * 6) : 0;
  ctx.save();
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 8 + pulse * 26;
  ctx.fillStyle = C.cyan;
  K.roundRect(ctx, tx + 3, ty + 3, tw / 2 - 3, th - 6, (th - 6) / 2);
  ctx.fill();
  ctx.restore();
  if (pulse > 0.02) {
    const grow = (1 - pulse) * 18;
    ctx.strokeStyle = rgba(C.cyan, pulse);
    ctx.lineWidth = 2.5;
    K.roundRect(ctx, tx + 3 - grow, ty + 3 - grow, tw / 2 - 3 + grow * 2, th - 6 + grow * 2, (th - 6) / 2 + grow);
    ctx.stroke();
  }
  K.text(ctx, 'Auto', tx + tw / 4 + 1, 1, { size: 23, font: K.F.russo, color: C.ink });
  K.text(ctx, 'Manuel', tx + (tw * 3) / 4, 1, { size: 23, font: K.F.russo, color: C.muted });
  ctx.restore();
}

// ------------------------------------------------------------------ bars 26–27: bubbles + clipboard
const BUB = { size: 42, h: 76, r: 26, pad: 56 };
const BUBBLES = [
  { t: L(26, 2), text: 'gg', x: 1000, y: 250, fill: '#f1f5f9', ring: '#67e8f9', tilt: -0.05 },
  { t: L(27, 0), text: `débrief ce soir${NB}?`, x: 980, y: 390, fill: '#818cf8', ring: '#e879f9', tilt: 0.03 },
  { t: L(27, 2), text: 'go 21h', x: 1000, y: 530, fill: '#f1f5f9', ring: '#a78bfa', tilt: -0.03, answer: true },
];
const SOLID_T = L(27, 2.5); // 'go 21h' lands on the clipboard
const CLIP = { cx: 1590, cy: 380, w: 300, h: 380 };
const bubbleFont = (K) => (px) => K.F.inter(px, 700);

function bubble(ctx, K, b, lt) {
  const { C, E, seg, rgba } = K;
  const p = seg(lt, b.t, b.t + 0.3);
  if (p <= 0) return;
  const e = E.outBack(p, 2.6);
  const font = bubbleFont(K);
  const tw = K.measure(ctx, b.text, BUB.size, font);
  const w = tw + BUB.pad;
  const h = BUB.h;
  const ax = b.x - 50; // avatar centre (tail tip)
  const ay = b.y + 30;
  // comic "pop" dashes off the bubble's top-right corner
  const sp = seg(lt, b.t + 0.04, b.t + 0.34);
  if (sp > 0 && sp < 1) {
    const ox = b.x + w + 6;
    const oy = b.y - h / 2 - 4;
    ctx.save();
    ctx.strokeStyle = rgba(b.ring, 1 - sp);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    [-1.1, -0.55, 0].forEach((a) => {
      const r0 = 10 + 26 * E.outCubic(sp);
      const r1 = r0 + 22 * (1 - sp) + 6;
      ctx.moveTo(ox + Math.cos(a) * r0, oy + Math.sin(a) * r0);
      ctx.lineTo(ox + Math.cos(a) * r1, oy + Math.sin(a) * r1);
    });
    ctx.stroke();
    ctx.restore();
  }
  // the answer: 'go 21h' swells as the dotted link reaches the clipboard
  const ans = b.answer ? E.outBack(seg(lt, SOLID_T - 0.04, SOLID_T + 0.16), 2.2) : 0;
  const bs = 1 + 0.12 * ans;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(b.tilt * e + (1 - e) * -0.25);
  ctx.scale(e, e);
  ctx.translate(-ax, -ay);
  ctx.globalAlpha *= K.clamp(p * 4);
  // avatar
  ctx.fillStyle = '#0b1222';
  ctx.beginPath();
  ctx.arc(ax, ay, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = b.ring;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = rgba(b.ring, 0.9);
  ctx.beginPath();
  ctx.arc(ax, ay - 7, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax, ay + 16, 13, Math.PI, 0);
  ctx.fill();
  // jagged tail + body (scaled around the body centre for the answer swell)
  const bx = b.x;
  const by = b.y - h / 2;
  ctx.save();
  ctx.translate(bx + w / 2, b.y);
  ctx.scale(bs, bs);
  ctx.translate(-(bx + w / 2), -b.y);
  ctx.fillStyle = b.fill;
  ctx.beginPath();
  ctx.moveTo(bx + 12, by + h - 26);
  ctx.lineTo(bx - 14, by + h - 6);
  ctx.lineTo(bx - 4, by + h - 2);
  ctx.lineTo(bx - 26, by + h + 16);
  ctx.lineTo(bx + 26, by + h - 4);
  ctx.closePath();
  ctx.fill();
  K.roundRect(ctx, bx, by, w, h, BUB.r);
  ctx.fill();
  ctx.strokeStyle = b.answer && ans > 0 ? C.cyan : rgba(C.ink, 0.9);
  ctx.lineWidth = b.answer && ans > 0 ? 4 : 3;
  ctx.stroke();
  K.text(ctx, b.text, bx + w / 2, b.y + 1, { size: BUB.size, font, color: C.ink });
  ctx.restore();
  // cyan ring that rings out from the answer
  if (b.answer) {
    const rq = seg(lt, SOLID_T, SOLID_T + 0.45);
    if (rq > 0 && rq < 1) {
      const g = 8 + 34 * E.outCubic(rq);
      ctx.strokeStyle = rgba(C.cyan, 0.9 * (1 - rq));
      ctx.lineWidth = 4 * (1 - rq) + 1;
      K.roundRect(ctx, bx - g, by - g, w + g * 2, h + g * 2, BUB.r + g);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function clipboard(ctx, K, f, lt) {
  const { C, E, seg, rgba } = K;
  const t0 = L(26, 0);
  const p = seg(lt, L(26, 1), L(26, 2));
  if (p <= 0) return;
  const { cx, cy, w, h } = CLIP;
  const breathe = 1 + 0.01 * (1 - Math.cos(((lt - t0) / BAR) * Math.PI * 2));
  const e = E.outBack(p, 1.8) * (1 + 0.05 * E.inOutSine(seg(lt, L(26, 2), L(28, 0))));
  const solid = E.outCubic(seg(lt, SOLID_T, SOLID_T + 0.14));
  const hats = countIn('hat', T0 + t0, f.t);
  const off = -hats * 14;
  // soft cyan shockwave when the answer lands
  const sw = seg(lt, SOLID_T, SOLID_T + 0.6);
  if (sw > 0 && sw < 1) {
    ctx.save();
    ctx.globalAlpha *= 0.3;
    K.shockwave(ctx, cx, cy, 0.3 + 0.7 * sw, { color: C.cyan, maxR: 260, width: 22, sparks: 8, seed: 27 });
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(breathe * (0.88 + 0.12 * e), breathe * (0.88 + 0.12 * e));
  ctx.globalAlpha *= K.clamp(p * 2.5);
  // soft fill appears once it is real
  if (solid > 0) {
    ctx.fillStyle = rgba(C.violet, 0.12 * solid);
    K.roundRect(ctx, -w / 2, -h / 2, w, h, 24);
    ctx.fill();
  }
  ctx.strokeStyle = C.violet;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.setLineDash(solid >= 1 ? [] : [18, 14 * (1 - solid)]);
  ctx.lineDashOffset = off;
  if (solid > 0) {
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 24 * solid;
  }
  K.roundRect(ctx, -w / 2, -h / 2, w, h, 24);
  ctx.stroke();
  // clip on top
  ctx.fillStyle = C.night;
  K.roundRect(ctx, -66, -h / 2 - 24, 132, 46, 12);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  // empty note lines (ghosts)
  for (let i = 0; i < 5; i++) {
    const ly = -h / 2 + 96 + i * 52;
    ctx.fillStyle = rgba(C.violet2, 0.07);
    K.roundRect(ctx, -w / 2 + 40, ly - 4, w - 80 - (i % 2) * 50, 8, 4);
    ctx.fill();
  }
  // the first real lines: line 1 (checked) on 27.2.5, line 2 on 27.3
  [[SOLID_T + 0.03, true, w - 128], [L(27, 3), false, w - 178]].forEach(([tl, checked, len], i) => {
    const lp = E.outCubic(seg(lt, tl, tl + 0.3));
    if (lp <= 0) return;
    const ly = -h / 2 + 96 + i * 52;
    const box = E.outBack(K.clamp(lp * 2.5), 2);
    ctx.save();
    ctx.translate(-w / 2 + 51, ly);
    ctx.scale(box, box);
    if (checked) {
      ctx.fillStyle = C.cyan;
      K.roundRect(ctx, -12, -12, 24, 24, 6);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-1.5, 5);
      ctx.lineTo(7, -6);
      ctx.stroke();
    } else {
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 3;
      K.roundRect(ctx, -11, -11, 22, 22, 6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = C.violet2;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 78, ly);
    ctx.lineTo(-w / 2 + 78 + len * lp, ly);
    ctx.stroke();
    if (lp < 1) {
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.arc(-w / 2 + 78 + len * lp, ly, 5 * (1 - lp) + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

/** 'go 21h' answers the clipboard: a dotted cyan link draws from the bubble to the board's left edge. */
function answerLink(ctx, K, lt) {
  const { C, E, seg } = K;
  const t0 = L(27, 2.25);
  const p = E.outCubic(seg(lt, t0, SOLID_T));
  const fade = 1 - seg(lt, L(27, 3.25), L(27, 3.75));
  if (p <= 0 || fade <= 0) return;
  const b = BUBBLES[2];
  const x0 = b.x + K.measure(ctx, b.text, BUB.size, bubbleFont(K)) + BUB.pad + 22;
  const y0 = b.y;
  const x1 = CLIP.cx - CLIP.w / 2 - 12;
  const y1 = 470;
  const cxm = (x0 + x1) / 2;
  const cym = y0 + 46;
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.fillStyle = C.cyan;
  const n = 14;
  for (let i = 0; i <= n * p; i++) {
    const u = i / n;
    const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cxm + u * u * x1;
    const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cym + u * u * y1;
    ctx.beginPath();
    ctx.arc(x, y, i === Math.floor(n * p) ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Last beat: faint lines start converging on the point where S08's orb will appear. */
function convergeLines(ctx, K, lt, a) {
  if (a <= 0.01) return;
  const { C, rgba } = K;
  const R = K.rng(724);
  const span = 1300;
  const dist = 900 * lt;
  ctx.save();
  ctx.translate(OX, OY);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  const g = ctx.createRadialGradient(0, 0, 60, 0, 0, span);
  g.addColorStop(0, rgba(C.cyan, 0));
  g.addColorStop(0.1, rgba(C.cyan, 0.5 * a));
  g.addColorStop(1, rgba(C.violet2, 0.05 * a));
  ctx.strokeStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const ang = R() * Math.PI * 2;
    const ph = R();
    const len = 120 + R() * 260;
    const r = span - ((((ph * span + dist * (0.7 + R() * 0.6)) % span) + span) % span);
    if (r < 80) continue;
    ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
    ctx.lineTo(Math.cos(ang) * (r + len), Math.sin(ang) * (r + len));
  }
  ctx.stroke();
  ctx.restore();
}

function godRays(ctx, K, f, a) {
  if (a <= 0.003) return;
  const { H } = f;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rays = [
    [560, 120, 380, 0.0],
    [1080, 160, 520, 1.7],
    [1520, 110, 340, 3.1],
  ];
  for (const [x0, w0, w1, ph] of rays) {
    const sway = Math.sin(f.t * 0.35 + ph) * 60;
    const g = ctx.createLinearGradient(0, -20, 0, H * 0.95);
    g.addColorStop(0, `rgba(255,255,255,${0.06 * a})`);
    g.addColorStop(0.55, `rgba(255,255,255,${0.03 * a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - w0 / 2, -20);
    ctx.lineTo(x0 + w0 / 2, -20);
    ctx.lineTo(x0 - 120 + sway + w1 / 2, H * 0.95);
    ctx.lineTo(x0 - 120 + sway - w1 / 2, H * 0.95);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ cards drawn by the scene
const TYPE_STEPS = [2, 4, 6, 7, 8, 9]; // characters shown after each 16th hat from 24.0 ('/n' … '/nxt voir' on 24.1.25)

function commandCard(ctx, K, f, lt, xf) {
  const { C, E, seg, rgba, clamp } = K;
  const d = 4 * BEAT;
  if (lt < 0 || lt > d) return;
  const out = E.inQuad(seg(lt, d - BEAT * 0.25, d));
  const pin = E.outBack(seg(lt, 0, 0.26), 1.6);
  const x = 470;
  const y = 508;
  ctx.save();
  ctx.globalAlpha *= (1 - out) * clamp(0.35 + lt / 0.1);
  // command box
  const bw = 580;
  const bh = 140;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.92 + 0.08 * pin, 0.92 + 0.08 * pin);
  ctx.fillStyle = rgba(C.ink, 0.82);
  K.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 22);
  ctx.fill();
  ctx.strokeStyle = rgba(C.cyan, 0.8);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = C.cyan;
  ctx.fillRect(-bw / 2, -bh / 2 + 24, 6, bh - 48);
  ctx.restore();
  // typing: one step per 16th hat, starting on 24.0 itself
  const str = '/nxt voir';
  const k = countIn('hat', T0 - 0.02, f.t) - 1;
  const n = k < 0 ? 0 : TYPE_STEPS[Math.min(TYPE_STEPS.length - 1, k)];
  const size = 96;
  const font = (px) => K.F.inter(px, 800);
  const full = K.measure(ctx, str, size, font);
  const x0 = x - full / 2;
  const shown = str.slice(0, n);
  const w = K.text(ctx, shown, x0, y + 2, { size, font, color: C.text, align: 'left', emph: shown.startsWith('/nxt') ? '/nxt' : '', emphColor: C.cyan, glow: 14, glowColor: C.cyan });
  const typed = n >= str.length;
  const caretX = x0 + (n ? w : 0) + 8;
  if (!typed || Math.floor(lt / 0.2) % 2 === 0) {
    ctx.fillStyle = C.cyan;
    ctx.fillRect(caretX, y - size * 0.4, 8, size * 0.8);
  }
  // every keystroke sends a cyan dash from the card caret to the chat's input caret
  const [ix, iy] = toScreen(xf, INPUT.x + 23, INPUT.y + INPUT.h / 2);
  const ax = caretX + 4;
  const ay = y;
  const mx = (ax + ix) / 2;
  const my = Math.min(ay, iy) - 70;
  for (const th of eventsIn('hat', T0 - 0.02, Math.min(f.t, T0 + 0.55))) {
    const q = (f.t - th) / 0.12;
    if (q < 0 || q >= 1) continue;
    const head = E.outCubic(q);
    for (let j = 0; j < 14; j++) {
      const u = head - j * 0.022;
      if (u < 0) break;
      const px = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * ix;
      const py = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * iy;
      const s = (j === 0 ? 12 : 9 - j * 0.5) * (1 - q * 0.3);
      ctx.fillStyle = j === 0 ? rgba('#ffffff', 1 - q * 0.5) : rgba(C.cyan, (1 - j / 14) * (1 - q * 0.4));
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
  }
  // sub (two lines, keeps the pill inside the safe area)
  const sp = E.outCubic(seg(lt, BEAT * 1.25, BEAT * 2));
  subPill(ctx, K, ['Ton équipe,', 'depuis Discord.'], x, y + 178, { p: sp });
  ctx.restore();
}

function summaryCard(ctx, K, f, lt) {
  const { E, seg } = K;
  const t0 = L(25, 0);
  const d = 4 * BEAT;
  const l = lt - t0;
  if (l < 0 || l > d) return;
  const out = E.inQuad(seg(l, d - BEAT * 0.25, d));
  const e = E.brand(seg(l, 0, BEAT));
  ctx.save();
  ctx.globalAlpha *= 1 - out;
  calmLines(ctx, K, ['Ta partie,', 'résumée', 'sur Discord.'], 470, 446, { size: 92, emph: 'résumée', alpha: e, rise: (1 - e) * 30, glow: 12 });
  const sp = E.outCubic(seg(l, BEAT * 0.4, BEAT * 1.2));
  subPill(ctx, K, ['Auto ou manuel,', 'dans tes salons.'], 470, 724, { p: sp });
  ctx.restore();
}

/** The mid-video re-hook: words land on the 8th hats, a fuchsia brush strikes under « vraiment » on 26.2. */
function rehookCard(ctx, K, f, lt) {
  const { C, E, seg } = K;
  const c = f.cardsOf[2];
  const t0 = L(26, 0);
  const d = c.durBeats * BEAT;
  const l = lt - t0;
  if (l < 0 || l > d) return;
  const out = E.inQuad(seg(l, d - BEAT * 0.25, d));
  const size = 88;
  const font = (px) => K.F.display(px, 900);
  const parts = [['Tu ', 0], ['débriefes ', 0.5], ['vraiment', 1, true], [` tes scrims${NB}?`, 1.5]];
  const ws = parts.map(([s]) => K.measure(ctx, s, size, font));
  const total = ws.reduce((a, b) => a + b, 0);
  const push = 1 + 0.04 * E.inOutSine(seg(lt, L(26, 2), L(27, 3.5)));
  ctx.save();
  ctx.globalAlpha *= 1 - out;
  ctx.translate(960, 868);
  ctx.scale(push, push);
  // brush under « vraiment » (drawn first, the word sits on it)
  const ex0 = -total / 2 + ws[0] + ws[1];
  const ex1 = ex0 + ws[2];
  const bp = E.outCubic(seg(l, 2 * BEAT, 2 * BEAT + 0.12));
  if (bp > 0) {
    const xa = ex0 - 6;
    const xe = xa + (ex1 + 8 - xa) * bp;
    const yb = size * 0.5;
    const rise = -0.025;
    const y = (xx) => yb + (xx - xa) * rise;
    ctx.fillStyle = C.fuchsia2;
    K.polyPath(ctx, [[xa, y(xa) + 1], [xe, y(xe) - 2], [xe + 6, y(xe) + 5], [xa - 4, y(xa) + 14]]);
    ctx.fill();
    if (bp < 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(xe - 5, y(xe) - 3, 10, 10);
    }
  }
  let x = -total / 2;
  parts.forEach(([s, beat, em], i) => {
    const a = E.outCubic(seg(l, beat * BEAT, beat * BEAT + 0.14));
    if (a > 0) {
      K.text(ctx, s, x, (1 - a) * 16, { size, font, color: em ? C.fuchsia : C.text, align: 'left', glow: 6, glowColor: em ? C.fuchsia2 : C.cyan, alpha: a });
    }
    x += ws[i];
  });
  ctx.restore();
}

export default {
  id: 'S07',
  startBar: 24,
  endBar: 28,
  transitionOut: 'zoom',
  cards: CARDS,
  draw(ctx, f, K) {
    const { C, E, seg, lerp } = K;
    // +1 µs: on-beat frames have lt a few 1e-15 s short of the musical position
    const lt = f.lt + 1e-6;
    // ---------------- world
    K.background(ctx, f, { grid: false, intensity: 0.9 });
    K.halftone(ctx, f, { color: C.violet, alpha: 0.06, angle: -0.314, band: [0.2, 0.42], spacing: 18, maxR: 7, drift: 10 });
    const pull = E.inOutSine(seg(lt, L(26, 0), L(27, 0)));
    const camScale = lerp(1, 0.85, pull);
    const sinceBar = ((lt % BAR) + BAR) % BAR;
    const chord = Math.exp(-sinceBar * 2.5);
    bokeh(ctx, f, K, { gain: 1 + 0.3 * chord, scale: camScale });
    godRays(ctx, K, f, E.inOutSine(seg(lt, 0, BAR)));
    particleField(ctx, f, K, { pull: seg(lt, L(27, 2), L(28, 0)), px: OX, py: OY, alpha: 0.9 });
    convergeLines(ctx, K, lt, E.inQuad(seg(lt, L(27, 2.5), L(28, 0))));

    // ---------------- UI layer (imploded into the orb's birth point on the last beat)
    const xf = panelXf(K, lt);
    ctx.save();
    const alive = implode(ctx, K, lt);
    if (alive > 0.003) {
      if (xf.enter > 0) {
        const [pc, px] = K.offscreen('S07-panel', PW + PM * 2, PH + PM * 2);
        px.translate(PM, PM);
        drawPanel(px, K, f, lt);
        const draw = (src, a) => {
          ctx.save();
          ctx.globalAlpha *= a;
          ctx.translate(xf.pcx, xf.pcy);
          ctx.rotate(xf.tilt);
          ctx.scale(xf.sc, xf.sc);
          ctx.drawImage(src, -PW / 2 - PM, -PH / 2 - PM, PW + PM * 2, PH + PM * 2);
          ctx.restore();
        };
        const move = xf.move;
        if (move < 1) draw(pc, xf.alpha * (1 - move * 0.999));
        if (move > 0) {
          // cheap 3 px blur: downsample then upsample
          const [hc, hx] = K.offscreen('S07-panel-half', Math.round((PW + PM * 2) / 2), Math.round((PH + PM * 2) / 2));
          hx.imageSmoothingQuality = 'high';
          hx.drawImage(pc, 0, 0, hc.width, hc.height);
          const [bc, bx] = K.offscreen('S07-panel-blur', Math.round((PW + PM * 2) / 4), Math.round((PH + PM * 2) / 4));
          bx.imageSmoothingQuality = 'high';
          bx.drawImage(hc, 0, 0, bc.width, bc.height);
          ctx.imageSmoothingQuality = 'high';
          draw(bc, xf.alpha * move);
        }
      }
      routePill(ctx, K, lt);
      // bars 26–27: the human moment
      clipboard(ctx, K, f, lt);
      for (const b of BUBBLES) bubble(ctx, K, b, lt);
      answerLink(ctx, K, lt);
    }
    ctx.restore();

    // pre-echo of S08's orb: a point of light gathers where the frame implodes
    const pre = E.inQuad(seg(lt, L(27, 2), L(28, 0)));
    if (pre > 0.002) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rr = 40 + 320 * pre;
      const g = ctx.createRadialGradient(OX, OY, 0, OX, OY, rr);
      g.addColorStop(0, K.rgba('#ffffff', 0.95 * pre));
      g.addColorStop(0.12, K.rgba('#ffffff', 0.7 * pre));
      g.addColorStop(0.25, K.rgba(C.cyan, 0.45 * pre));
      g.addColorStop(0.55, K.rgba(C.violet, 0.18 * pre));
      g.addColorStop(1, K.rgba(C.violet, 0));
      ctx.fillStyle = g;
      ctx.fillRect(OX - rr, OY - rr, rr * 2, rr * 2);
      ctx.restore();
    }

    // ---------------- cards
    commandCard(ctx, K, f, lt, xf);
    summaryCard(ctx, K, f, lt);
    // lower-third shade for the re-hook card (gone with the card on 27.3.5)
    const c3 = seg(lt, L(26, 0), L(26, 1)) * (1 - seg(lt, L(27, 3.25), L(27, 3.5)));
    if (c3 > 0) {
      const g = ctx.createLinearGradient(0, 760, 0, 990);
      g.addColorStop(0, 'rgba(2,6,17,0)');
      g.addColorStop(0.45, `rgba(2,6,17,${0.55 * c3})`);
      g.addColorStop(1, 'rgba(2,6,17,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 760, f.W, 230);
    }
    rehookCard(ctx, K, f, lt);
    // every S07 card is scene-drawn; the shared pipeline is kept for consistency
    K.renderCards(ctx, f, f.cardsOf, { x: 960, y: 870, size: 150, subSize: 54, maxW: 1500 });

    brandBug(ctx, K, 0.55);
    return { auto: false, shake: 0, rgb: 0, zoom: 0, flash: 0 };
  },
};
