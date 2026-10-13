// S06 — Breakdown: the team and the planning (bars 20–24).
// Calm Persona jazz-funk: bokeh world, no shake. Bars 20–21: a 15-slot roster board (titulaires,
// remplaçants, staff) fills one slot per 16th hat, then roles & permissions lock. Bars 22–23: the five
// titulaires drop into an availability row while the real planning screen (ui-planning.png) slides in;
// sessions pop on the beat and the counter reaches 5 / 5 as card 3 lands. Left-column calm cards.

const NB = ' ';
const BEAT = 0.4;
const W = 1920;
const H = 1080;

// Left-column cards (x 470, maxW 760), drawn by the scene so that titles and subs can wrap.
const CARDS = [
  {
    bar: 20, beat: 0, durBeats: 8, text: 'Cinq points de vue.', emph: 'points de vue', sub: `Titulaires, remplaçants, staff${NB}: jusqu’à 15.`, style: 'calm', sceneDrawn: true, fastIn: true,
    lines: [['Cinq points', 'points'], ['de vue.', 'de vue']], subLines: ['Titulaires, remplaçants,', `staff${NB}: jusqu’à 15.`],
  },
  {
    bar: 22, beat: 0, durBeats: 4, text: 'Qui joue. Et quand.', emph: 'quand.', sub: 'Dispos partagées. Scrims, matchs, débriefs.', style: 'calm', sceneDrawn: true,
    lines: [['Qui joue.', ''], ['Et quand.', 'quand.']], subLines: ['Dispos partagées.', 'Scrims, matchs, débriefs.'],
  },
  {
    bar: 23, beat: 0, durBeats: 4, text: 'Le cinq au rendez-vous.', emph: 'cinq', sub: `5${NB}/${NB}5 disponibles`, style: 'calm', sceneDrawn: true,
    lines: [['Le cinq au', 'cinq'], ['rendez-vous.', '']], subLines: [`5${NB}/${NB}5 disponibles`],
  },
];

function mulberry(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 25 bokeh circles (static seeds; they drift up at ~10 px/s)
const BOKEH = (() => {
  const R = mulberry(606);
  const cols = ['cyan', 'violet', 'fuchsia'];
  return Array.from({ length: 25 }, (_, i) => ({
    x: R() * W,
    y: R() * H,
    r: 20 + R() ** 1.6 * 100,
    a: 0.05 + R() * 0.07,
    c: cols[i % 3],
    v: 7 + R() * 6,
    ph: R() * 6.28,
  }));
})();

// ------------------------------------------------------------------ roster board layout (local coords)
const BOARD = { cx: 1380, cy: 452, w: 860, h: 680 };
const COLX = [-287, 0, 287];
const SLOT_W = 253;
const SLOT_H = 96;
const ROWY = [-166, -58, 50, 158, 266]; // leaves a 48 px header band for the permission pills
const HEADERS = ['TITULAIRES', 'REMPLAÇANTS', 'STAFF'];
// role dots: Joueur cyan, Coach violet, Analyste fuchsia, Manager indigo
const ROLE_COL = [
  ['cyan', 'cyan', 'cyan', 'cyan', 'cyan'],
  ['cyan', 'cyan', 'cyan', 'cyan', 'cyan'],
  ['violet', 'violet', 'fuchsia', 'fuchsia', 'indigo'],
];
const NAME_W = (() => {
  const R = mulberry(88);
  return Array.from({ length: 15 }, () => [56 + R() * 44, 36 + R() * 36]); // clear of the r 11 role dot
})();

// availability row
const AV_Y = 826;
const AV_X = [1004, 1134, 1264, 1394, 1524];
const AV_ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const AV_LIGHT = [[22, 1], [22, 2], [22, 2.5], [22, 3], [23, 0]];

// planning screen (real UI crop): image px -> screen
const SHOT = 'ui-planning.png';
const SRC = [118, 205, 1120, 708];
const TILES = [
  { r: [146, 385, 529, 153], label: 'SCRIM', col: 'fuchsia', at: [22, 2] },
  { r: [696, 385, 529, 153], label: 'DÉBRIEF', col: 'violet', at: [22, 2.5] },
];
const EVENT = [300, 636, 640, 272];

// ------------------------------------------------------------------ helpers
function avatarGlyph(ctx, K, x, y, r, col, fillA = 1) {
  const { C, rgba } = K;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(col, 0.92 * fillA);
  ctx.beginPath();
  ctx.arc(x, y - r * 0.2, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y + r * 0.9, r * 0.62, Math.PI, 0);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(col, 0.9);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  void C;
}

function lockGlyph(ctx, K, x, y, closedK, col, sc = 1, holeCol = '#020611') {
  const { rgba, E } = K;
  const lift = 7 * (1 - E.outBack(closedK, 2.2));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // shackle
  ctx.beginPath();
  ctx.moveTo(-6, -2 - lift);
  ctx.lineTo(-6, -8 - lift);
  ctx.arc(0, -8 - lift, 6, Math.PI, 0);
  ctx.lineTo(6, -2 - lift * (closedK < 0.5 ? 1.8 : 1));
  ctx.stroke();
  // body
  K.roundRect(ctx, -10, -3, 20, 16, 3);
  ctx.fill();
  ctx.fillStyle = rgba(holeCol, 0.9);
  ctx.fillRect(-1.5, 2, 3, 6);
  ctx.restore();
}

function shieldGlyph(ctx, K, x, y, s, on, pulse, flash = 0) {
  const { C, rgba } = K;
  ctx.save();
  ctx.translate(x, y);
  const sc = 1 + 0.32 * pulse;
  ctx.scale(sc, sc);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.86, -s * 0.62);
  ctx.lineTo(s * 0.74, s * 0.32);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.74, s * 0.32);
  ctx.lineTo(-s * 0.86, -s * 0.62);
  ctx.closePath();
  ctx.fillStyle = on ? rgba(C.cyan2, 0.22 + 0.4 * pulse) : rgba(flash > 0 ? C.cyan2 : C.surface, flash > 0 ? 0.6 * flash : 0.6);
  ctx.fill();
  ctx.strokeStyle = on || flash > 0.3 ? C.cyan : '#64748b';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (on) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, 0);
    ctx.lineTo(-s * 0.08, s * 0.3);
    ctx.lineTo(s * 0.4, -s * 0.3);
    ctx.strokeStyle = C.text;
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
  if (pulse > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(C.cyan, 0.6 * pulse);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, s * (1.3 + 1.6 * (1 - pulse)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBokeh(ctx, f, K, bright, camX) {
  const { C, rgba } = K;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of BOKEH) {
    const span = H + 2 * b.r;
    const y = ((((b.y - b.v * f.t + b.r) % span) + span) % span) - b.r;
    const x = b.x + Math.sin(f.t * 0.3 + b.ph) * 14 + camX * (0.3 + b.r / 200);
    const a = Math.min(0.3, b.a * bright);
    const col = C[b.c];
    const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
    g.addColorStop(0, rgba(col, a * 0.55));
    g.addColorStop(0.78, rgba(col, a * 0.8));
    g.addColorStop(0.9, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
  }
  ctx.restore();
}

/** Calm left-column card with wrapped title lines and a wrapped sub pill (renderCards look). */
function drawCard(ctx, f, K, c, x, yMid) {
  const { C, rgba, E, seg, clamp } = K;
  const t0 = f.at(c.bar, c.beat);
  const d = c.durBeats * BEAT;
  const lt = f.lt - t0;
  if (lt < 0 || lt > d) return;
  const out = seg(lt, d - BEAT * 0.25, d);
  const size = 112;
  const lh = size * 1.02;
  const subSize = 54;
  const subLH = subSize * 1.22;
  const subH = c.subLines.length * subLH + subSize * 0.5;
  const gap = 40;
  const titleH = c.lines.length * lh;
  const top = yMid - (titleH + gap + subH) / 2;
  const font = (px) => K.F.display(px, 900);
  ctx.save();
  ctx.globalAlpha *= 1 - E.inQuad(out);
  c.lines.forEach(([str, emph], i) => {
    const e = E.brand(clamp((lt - i * 0.09) / (c.fastIn ? BEAT * 0.5 : BEAT)));
    if (e <= 0) return;
    ctx.save();
    ctx.globalAlpha *= e;
    K.text(ctx, str, x, top + lh * (i + 0.5) + (1 - e) * 30, { size, font, emph, glow: 14 });
    ctx.restore();
  });
  // sub pill
  const sp = E.outCubic(seg(lt, BEAT * 0.4, BEAT * 1.2));
  if (sp > 0) {
    const sw = Math.max(...c.subLines.map((s) => K.measure(ctx, s, subSize, (px) => K.F.inter(px, 700))));
    const py = top + titleH + gap;
    ctx.globalAlpha *= sp;
    ctx.fillStyle = rgba(C.ink, 0.65);
    ctx.fillRect(x - sw / 2 - 24, py, (sw + 48) * sp, subH);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x - sw / 2 - 24, py, 6, subH);
    ctx.beginPath();
    ctx.rect(x - sw / 2 - 24, py, (sw + 48) * sp, subH);
    ctx.clip();
    c.subLines.forEach((s, i) => {
      K.text(ctx, s, x, py + subSize * 0.25 + subLH * (i + 0.5), { size: subSize, font: (px) => K.F.inter(px, 700), color: C.text2 });
    });
  }
  ctx.restore();
}

function slotState(f, col, row) {
  const n = col * 5 + row;
  const th = f.at(20, (n + 1) * 0.25); // one slot per 16th hat, 20.0.25 -> 20.3.75
  return { n, th };
}

function drawBoard(ctx, f, K, alpha) {
  const { C, rgba, E, seg } = K;
  const { w, h } = BOARD;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // panel (no shadowBlur: layered translucent strokes for the glow)
  K.roundRect(ctx, -w / 2, -h / 2, w, h, 28);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, rgba('#1e293b', 0.92));
  g.addColorStop(0.6, rgba('#221e42', 0.92));
  g.addColorStop(1, rgba('#172036', 0.92));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(C.violet, 0.12);
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.strokeStyle = rgba(C.violet2, 0.42);
  ctx.lineWidth = 2;
  ctx.stroke();
  // top bar: title + live counter + shield (title and shield flash cyan as the board lands on 20.0)
  const land = f.lt >= 0 ? 1 - seg(f.lt, 0, 0.2) : 0;
  const filled = [0, 1, 2].reduce((s, col) => s + [0, 1, 2, 3, 4].filter((row) => f.lt >= slotState(f, col, row).th).length, 0);
  K.text(ctx, 'EFFECTIF', -w / 2 + 34, -h / 2 + 44, {
    size: 40, font: K.F.bebas, color: land > 0.02 ? C.cyan : C.text, align: 'left', spacing: 3, glow: land > 0.02 ? 22 * land : 0, glowColor: C.cyan2,
  });
  const cw = K.text(ctx, `${filled}`, -w / 2 + 196, -h / 2 + 45, { size: 32, font: K.F.russo, color: C.cyan, align: 'left' });
  K.text(ctx, `${NB}/${NB}15`, -w / 2 + 196 + cw, -h / 2 + 45, { size: 32, font: K.F.russo, color: C.muted, align: 'left' });
  const tS = f.at(21, 0);
  const shieldOn = f.lt >= tS;
  const pulse = shieldOn ? Math.exp(-(f.lt - tS) * 5) : 0;
  shieldGlyph(ctx, K, w / 2 - 50, -h / 2 + 44, 22, shieldOn, pulse, land);
  ctx.fillStyle = rgba('#334155', 0.9);
  ctx.fillRect(-w / 2 + 30, -h / 2 + 76, w - 60, 1.5);
  // column headers (Bebas 38) with permission locks; each lock closes into a cyan pill (21.2, 21.2.25, 21.2.5)
  const lockBeats = [2, 2.25, 2.5];
  const HY = -236;
  const colPulse = [0, 0, 0];
  HEADERS.forEach((hd, ci) => {
    const x = COLX[ci];
    const tw = K.measure(ctx, hd, 38, K.F.bebas, 2);
    const tl = f.at(21, lockBeats[ci]);
    const kl = seg(f.lt, tl, tl + 0.22);
    const on = f.lt >= tl;
    const kp = E.outBack(seg(f.lt, tl, tl + 0.18), 2);
    colPulse[ci] = on ? 1 - seg(f.lt, tl, tl + 0.2) : 0;
    const groupW = tw + 14 + 22;
    const tx = x - groupW / 2 + tw / 2;
    const lx = x + groupW / 2 - 11;
    if (on) {
      const pw = (groupW + 30) * (0.6 + 0.4 * kp);
      ctx.save();
      K.roundRect(ctx, x - pw / 2, HY - 20, pw, 40, 20);
      ctx.fillStyle = C.cyan;
      ctx.fill();
      if (colPulse[ci] > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(C.cyan, 0.6 * colPulse[ci]);
        ctx.lineWidth = 2 + 12 * colPulse[ci];
        ctx.stroke();
      }
      ctx.restore();
    }
    K.text(ctx, hd, tx, HY + 1, { size: 38, font: K.F.bebas, color: on ? C.ink : '#a5b4c8', spacing: 2 });
    const lsc = on ? 1.25 + 0.35 * Math.sin(Math.PI * Math.min(1, kl * 1.4)) : 1.1;
    lockGlyph(ctx, K, lx, HY - 2, kl, on ? C.ink : '#64748b', lsc, on ? C.cyan : '#020611');
    if (kl > 0 && kl < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(C.cyan, 0.7 * (1 - kl));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, HY, 16 + 30 * kl, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });
  // slots
  const anticip = E.inOutSine(seg(f.lt, f.at(21, 2.6), f.at(21, 3))) * (1 - seg(f.lt, f.at(21, 3.5), f.at(22, 0)));
  const tLeave = f.at(21, 3);
  for (let ci = 0; ci < 3; ci++) {
    for (let ri = 0; ri < 5; ri++) {
      const { n, th } = slotState(f, ci, ri);
      const x = COLX[ci] - SLOT_W / 2;
      const y = ROWY[ri] - SLOT_H / 2;
      const k = seg(f.lt, th, th + 0.26);
      const col = C[ROLE_COL[ci][ri]];
      K.roundRect(ctx, x, y, SLOT_W, SLOT_H, 16);
      if (f.lt < th) {
        ctx.fillStyle = rgba('#1e293b', 0.35);
        ctx.fill();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = rgba('#475569', 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 52 - 9, y + SLOT_H / 2);
        ctx.lineTo(x + 52 + 9, y + SLOT_H / 2);
        ctx.moveTo(x + 52, y + SLOT_H / 2 - 9);
        ctx.lineTo(x + 52, y + SLOT_H / 2 + 9);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      const flash = 1 - k;
      if (flash > 0) {
        ctx.fillStyle = rgba(col, 0.28 * flash);
        ctx.fill();
      }
      ctx.strokeStyle = flash > 0.02 ? rgba(col, 0.3 + 0.7 * flash) : '#334155';
      ctx.lineWidth = 1 + 2 * flash;
      ctx.stroke();
      // permission applied to this column: 0.2 s cyan outline pulse; titulaires glow before they leave
      const glowK = Math.max(colPulse[ci], ci === 0 ? anticip : 0);
      if (glowK > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(C.cyan, 0.7 * glowK);
        ctx.lineWidth = 3 + 3 * colPulse[ci];
        ctx.stroke();
        ctx.restore();
      }
      const ax = x + 52;
      const ay = y + SLOT_H / 2;
      const sc = E.outBack(Math.min(1, k * 1.6), 2.2);
      // titulaires: the moving copy (drawAvailability) takes over from 21.3, so the slot empties (no ghost)
      if (!(ci === 0 && f.lt >= tLeave)) {
        ctx.save();
        ctx.translate(ax, ay);
        ctx.scale(sc, sc);
        avatarGlyph(ctx, K, 0, 0, 30, col);
        ctx.restore();
      }
      if (flash > 0) {
        ctx.save();
        ctx.strokeStyle = rgba(col, 0.8 * flash);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ax, ay, 32 + 20 * (1 - flash), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // wordless name bars
      const kb = E.outCubic(seg(f.lt, th + 0.05, th + 0.3));
      const [w1, w2] = NAME_W[n];
      ctx.fillStyle = '#475569';
      K.roundRect(ctx, x + 98, ay - 16, w1 * kb, 13, 6.5);
      ctx.fill();
      ctx.fillStyle = '#334155';
      K.roundRect(ctx, x + 98, ay + 7, w2 * kb, 10, 5);
      ctx.fill();
      // role dot (r 11 so cyan / violet / fuchsia / indigo read at phone size)
      const kd = E.outBack(seg(f.lt, th + 0.1, th + 0.3), 3);
      if (kd > 0) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x + SLOT_W - 27, ay, 11 * kd, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(col, 0.35);
        ctx.lineWidth = 6;
        ctx.stroke();
      }
    }
  }
  // roles & permissions applied: a cyan scan sweeps the board on 21.0
  const tS0 = f.at(21, 0);
  const ks = seg(f.lt, tS0, tS0 + BEAT * 1.25);
  if (ks > 0 && ks < 1) {
    const yy = -h / 2 + 90 + (h - 110) * E.inOutSine(ks);
    ctx.save();
    K.roundRect(ctx, -w / 2, -h / 2, w, h, 28);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const g2 = ctx.createLinearGradient(0, yy - 90, 0, yy);
    g2.addColorStop(0, rgba(C.cyan2, 0));
    g2.addColorStop(1, rgba(C.cyan2, 0.16 * Math.sin(Math.PI * ks)));
    ctx.fillStyle = g2;
    ctx.fillRect(-w / 2, yy - 90, w, 90);
    ctx.fillStyle = rgba(C.cyan, 0.7 * Math.sin(Math.PI * ks));
    ctx.fillRect(-w / 2, yy - 1.5, w, 3);
    ctx.restore();
  }
  ctx.restore();
}

/** Board-local avatar centre of titulaire `ri`, in screen space for a board drawn at (cx, cy, s). */
function titulaireAt(ri, cx, cy, s) {
  return [cx + (COLX[0] - SLOT_W / 2 + 52) * s, cy + ROWY[ri] * s];
}

function drawScreenOverlays(ctx, f, K, geo) {
  const { C, rgba, E, seg } = K;
  const { x, y, w, h, tilt, skew } = geo;
  const sx = w / SRC[2];
  const sy = h / SRC[3];
  const map = (r) => [-w / 2 + (r[0] - SRC[0]) * sx, -h / 2 + (r[1] - SRC[1]) * sy, r[2] * sx, r[3] * sy];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.transform(1, skew * 0.25, 0, 1, 0, 0);
  const img = K.uiImage(SHOT);
  TILES.forEach((tile) => {
    const t0 = f.at(...tile.at);
    const k = seg(f.lt, t0, t0 + 0.32);
    if (k <= 0) return;
    const [rx, ry, rw, rh] = map(tile.r);
    const col = C[tile.col];
    const pop = 1 + 0.1 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k * 0.5);
    const lift = -8 * E.outCubic(Math.min(1, k * 2));
    // contact shadow where the tile was, so the lifted copy reads as depth (not a double edge)
    ctx.save();
    ctx.fillStyle = rgba(C.ink, 0.6 * Math.min(1, k * 3));
    K.roundRect(ctx, rx - 4, ry + 2, rw + 8, rh + 6, 8);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(rx + rw / 2, ry + rh / 2 + lift);
    ctx.scale(pop, pop);
    // the real tile, lifted off the screen
    if (img) {
      ctx.save();
      K.roundRect(ctx, -rw / 2, -rh / 2, rw, rh, 6);
      ctx.clip();
      ctx.drawImage(img, tile.r[0], tile.r[1], tile.r[2], tile.r[3], -rw / 2, -rh / 2, rw, rh);
      ctx.restore();
    }
    K.roundRect(ctx, -rw / 2, -rh / 2, rw, rh, 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, 0.3);
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.stroke();
    // session chip dropping onto the tile corner (Russo 28, ink text), from just 14 px above
    const kc = E.outBack(seg(f.lt, t0, t0 + 0.26), 2.4);
    const cwid = K.measure(ctx, tile.label, 28, K.F.russo, 1) + 34;
    const chx = rw / 2 - cwid - 12;
    const chy = -rh / 2 - 22 + (1 - kc) * -14;
    ctx.globalAlpha *= Math.min(1, k * 4);
    K.roundRect(ctx, chx, chy, cwid, 44, 22);
    ctx.fillStyle = col;
    ctx.fill();
    K.text(ctx, tile.label, chx + cwid / 2, chy + 23, { size: 28, font: K.F.russo, color: C.ink, spacing: 1 });
    ctx.restore();
  });
  // 23.2 snare: the « Horizon contre Aurore » session block lifts off the screen like the tiles (no new label)
  const tE = f.at(23, 2);
  const ke = seg(f.lt, tE, tE + 0.32);
  if (ke > 0 && img) {
    const [rx, ry, rw, rh] = map(EVENT);
    const pop = 1.04 + 0.05 * Math.sin(Math.PI * Math.min(1, ke * 1.4)) * (1 - ke * 0.5);
    const lift = -6 * E.outCubic(Math.min(1, ke * 2));
    const glowK = 0.45 + 0.55 * Math.exp(-(f.lt - tE) * 3);
    ctx.save();
    ctx.fillStyle = rgba(C.ink, 0.6 * Math.min(1, ke * 3));
    K.roundRect(ctx, rx - 6, ry + 2, rw + 12, rh + 8, 10);
    ctx.fill();
    ctx.translate(rx + rw / 2, ry + rh / 2 + lift);
    ctx.scale(pop, pop);
    ctx.save();
    K.roundRect(ctx, -rw / 2, -rh / 2, rw, rh, 8);
    ctx.clip();
    ctx.drawImage(img, EVENT[0], EVENT[1], EVENT[2], EVENT[3], -rw / 2, -rh / 2, rw, rh);
    ctx.restore();
    K.roundRect(ctx, -rw / 2, -rh / 2, rw, rh, 8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(C.fuchsia, 0.3 * glowK);
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C.fuchsia;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * The five titulaires step out of the board at the end of bar 21 (phase A: slide left into a column
 * beside the board), then cascade into the availability row as the board leaves on 22.0 (phase B).
 */
const STEP_X = 870; // between card 1's sub pill (ends ≈ 806) and the planning screen (left edge ≥ 885)
// Phase B route: one shared L-shaped rail (down the STEP_X column, a rounded corner below the screen, then right
// along the availability row). The five move along it together like a train, so they keep ≥ 108 px apart, never
// cross each other and never cross the screenshot (its bottom is ≈ 700; the rail turns at y ≥ 756).
const RAIL_R = 70;
const RAIL_Y0 = BOARD.cy + ROWY[0];
const RAIL_LV = AV_Y - RAIL_R - RAIL_Y0;
const RAIL_LA = (Math.PI * RAIL_R) / 2;
function railAt(s) {
  if (s <= RAIL_LV) return [STEP_X, RAIL_Y0 + s];
  if (s <= RAIL_LV + RAIL_LA) {
    const a = (s - RAIL_LV) / RAIL_R;
    return [STEP_X + RAIL_R - RAIL_R * Math.cos(a), AV_Y - RAIL_R + RAIL_R * Math.sin(a)];
  }
  return [STEP_X + RAIL_R + (s - RAIL_LV - RAIL_LA), AV_Y];
}
const RAIL_DUR = 0.5;
function avatarPath(f, K, i) {
  const { E, seg, lerp } = K;
  const [bx, by] = titulaireAt(i, BOARD.cx, BOARD.cy, 1);
  const tA = f.at(21, 3) + i * 0.04;
  const kA = E.inOutCubic(seg(f.lt, tA, tA + 0.3));
  const tB = f.at(22, 0);
  const kB = E.inOutCubic(seg(f.lt, tB, tB + RAIL_DUR));
  let x = lerp(bx, STEP_X, kA);
  let y = by - Math.sin(Math.PI * kA) * 10;
  if (kB > 0) {
    const s0 = ROWY[i] - ROWY[0];
    const s1 = RAIL_LV + RAIL_LA + (AV_X[i] - STEP_X - RAIL_R);
    [x, y] = railAt(lerp(s0, s1, kB));
  }
  return { x, y, kA, kB, tA, landT: tB + RAIL_DUR };
}

function checkGlyph(ctx, K, x, y, r, k) {
  const { C, rgba, E } = K;
  const e = E.outBack(k, 2.2);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(e, e);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(C.cyan2, 0.18);
  ctx.fill();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, 0);
  ctx.lineTo(-r * 0.1, r * 0.32);
  ctx.lineTo(r * 0.45, -r * 0.34);
  ctx.strokeStyle = C.text;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
}

/** A plain canvas session pill (no screenshot relabelling): a cyan « MATCH » chip, the third session colour. */
function drawMatchPill(ctx, f, K) {
  const { C, rgba, E, seg } = K;
  const t0 = f.at(22, 3);
  const k = seg(f.lt, t0, t0 + 0.3);
  if (k <= 0) return;
  const kc = E.outBack(k, 2.2);
  const cx = 1700;
  const cy = 750 + (1 - kc) * -14;
  const w = 214;
  const h = 52;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, k * 4);
  K.roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = rgba('#1e293b', 0.95);
  ctx.fill();
  ctx.strokeStyle = rgba(C.cyan, 0.75);
  ctx.lineWidth = 2;
  ctx.stroke();
  if (k < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(C.cyan, 0.5 * (1 - k));
    ctx.lineWidth = 2 + 12 * (1 - k);
    ctx.stroke();
    ctx.restore();
  }
  K.icon(ctx, 'calendar', cx - w / 2 + 34, cy, 30, { color: C.cyan, lw: 9 });
  const cw = K.measure(ctx, 'MATCH', 28, K.F.russo, 1) + 34;
  const chx = cx + w / 2 - cw - 8;
  K.roundRect(ctx, chx, cy - 19, cw, 38, 19);
  ctx.fillStyle = C.cyan;
  ctx.fill();
  K.text(ctx, 'MATCH', chx + cw / 2, cy + 1, { size: 28, font: K.F.russo, color: C.ink, spacing: 1 });
  ctx.restore();
}

function drawAvailability(ctx, f, K) {
  const { C, rgba, E, seg, lerp } = K;
  const t22 = f.at(22, 0);
  if (f.lt < f.at(21, 3)) return;
  const lit = AV_LIGHT.map(([b, bt]) => f.at(b, bt));
  const count = lit.filter((t) => f.lt >= t).length;
  const t5 = lit[4];
  // spectrum link at 5 / 5
  const kl = E.outCubic(seg(f.lt, t5, t5 + 0.32));
  if (kl > 0) {
    ctx.save();
    const x0 = AV_X[0];
    const x1 = lerp(AV_X[0], AV_X[4], kl);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(C.violet, 0.22);
    ctx.fillRect(x0, AV_Y - 7, x1 - x0, 14);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = K.linearSpectrum(ctx, AV_X[0], 0, AV_X[4], 0);
    ctx.fillRect(x0, AV_Y - 2.5, x1 - x0, 5);
    ctx.restore();
  }
  AV_X.forEach((ax, i) => {
    const { x, y, kA, kB, tA, landT } = avatarPath(f, K, i);
    const r = 30;
    // a short cyan trail while stepping out / dropping in
    const moving = (kA > 0 && kA < 1) || (kB > 0 && kB < 1);
    if (moving) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(C.cyan2, 0.12);
      ctx.beginPath();
      ctx.arc(x, y, r + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const on = f.lt >= lit[i];
    const kon = seg(f.lt, lit[i], lit[i] + 0.3);
    // stepping out: pops to 1.15 with a cyan ring, settles back to 1 as it drops into the row
    const pick = kA * (1 - E.outCubic(seg(kB, 0, 0.3)));
    ctx.save();
    if (on) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
      g.addColorStop(0, rgba(C.cyan2, 0.32));
      g.addColorStop(1, rgba(C.cyan2, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      ctx.globalCompositeOperation = 'source-over';
    }
    const sc = (on ? 1 + 0.18 * Math.sin(Math.PI * Math.min(1, kon * 1.3)) : 1) * (1 + 0.15 * pick);
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    avatarGlyph(ctx, K, 0, 0, r, on || kB < 1 ? C.cyan : '#64748b', on ? 1 : kB < 1 ? 0.92 : 0.7);
    ctx.restore();
    if (pick > 0.01) {
      ctx.save();
      ctx.strokeStyle = rgba(C.cyan, 0.9 * pick);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r * sc + 5, 0, Math.PI * 2);
      ctx.stroke();
      const kr = seg(f.lt, tA, tA + 0.3);
      if (kr > 0 && kr < 1) {
        ctx.strokeStyle = rgba(C.cyan, 0.8 * (1 - kr));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r * sc + 5 + 12 * E.outCubic(kr), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (on && kon < 1) {
      ctx.save();
      ctx.strokeStyle = rgba(C.cyan, 0.85 * (1 - kon));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 6 + 34 * E.outCubic(kon), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (kB >= 1) {
      K.text(ctx, AV_ROLES[i], ax, AV_Y + 56, { size: 28, font: K.F.bebas, color: on ? C.text2 : '#94a3b8', spacing: 2, alpha: Math.min(1, seg(f.lt, landT, landT + 0.18)) });
    }
  });
  // counter (Russo, ticks with each light). At 5 / 5 (23.0) it pops ×1.35 with a cyan flash, then hands over
  // to a check stamp, so the card's sub pill stays the only « 5 / 5 » on screen.
  const kc = seg(f.lt, t22 + 0.15, t22 + 0.4);
  if (kc > 0) {
    const cx = 1700;
    const kFull = seg(f.lt, t5, t5 + BEAT * 0.25);
    const fade = seg(f.lt, t5 + BEAT * 0.25, t5 + BEAT * 0.75); // gone as the spectrum line completes
    if (fade < 1) {
      const tLast = lit.filter((t) => f.lt >= t).pop();
      const bump = tLast != null && tLast < t5 ? Math.exp(-(f.lt - tLast) * 9) : 0;
      const full = count === 5;
      const sc = (1 + 0.16 * bump) * (full ? 1 + 0.35 * E.outCubic(kFull) + 0.25 * E.inQuad(fade) : 1);
      ctx.save();
      ctx.globalAlpha *= kc * (1 - E.inQuad(fade));
      ctx.translate(cx, AV_Y - 4);
      ctx.scale(sc, sc);
      K.text(ctx, `${count}${NB}/${NB}5`, 0, 0, { size: 52, font: K.F.russo, color: full ? C.cyan : C.text, glow: full ? 18 + 20 * (1 - kFull) : 0, glowColor: C.cyan2 });
      ctx.restore();
    }
    const kk = seg(f.lt, t5 + BEAT * 0.75, t5 + BEAT * 1.2);
    if (kk > 0) checkGlyph(ctx, K, cx, AV_Y - 4, 30, kk);
    K.text(ctx, 'DISPOS', cx, AV_Y + 56, { size: 28, font: K.F.bebas, color: count === 5 ? C.cyan : '#94a3b8', spacing: 2, alpha: kc });
  }
}

export default {
  id: 'S06',
  startBar: 20,
  endBar: 24,
  transitionOut: 'iris',
  cards: CARDS,
  draw(ctx, f, K) {
    const { C, rgba, E, seg, clamp, lerp } = K;
    const lt = f.lt;
    const camX = -30 * E.inOutSine(clamp(lt / f.dur));
    // e-piano chord on each bar start: bokeh +30 %; the 20.0 impact blooms
    const barStart = Math.floor(f.bar + 1e-6);
    const sinceBar = f.t - barStart * 1.6;
    const chord = lt >= 0 ? Math.exp(-sinceBar * 2.4) : 0;
    const bloom = lt >= 0 ? Math.exp(-lt * 2.5) : 0;

    K.background(ctx, f, { intensity: 0.75, grid: false, pulse: 0 });
    drawBokeh(ctx, f, K, 1 + 0.3 * chord + 0.4 * bloom, camX);
    // one slow −18° halftone band, top-right, 6 % (flashes on the b2 snare)
    ctx.save();
    K.polyPath(ctx, [[1080, 0], [1920, 0], [1920, 330], [1430, 490]]);
    ctx.clip();
    K.halftone(ctx, f, { color: C.violet2, alpha: 0.06 + 0.1 * f.env('snare', 4), angle: -0.314, band: [0, 1], maxR: 6, spacing: 18, drift: 12 });
    ctx.restore();
    K.particles(ctx, f, { count: 50, size: 2, speed: 0.25, seed: 61, alpha: 0.4 });
    K.particles(ctx, f, { count: 26, size: 3, speed: 0.45, seed: 62, alpha: 0.4 });
    K.particles(ctx, f, { count: 10, size: 4.5, speed: 0.7, seed: 63, alpha: 0.35 });

    // soft shockwave as the star wipe lands
    if (lt >= 0 && lt < 0.7) {
      ctx.save();
      ctx.globalAlpha *= 0.3;
      K.shockwave(ctx, 960, 540, lt / 0.7, { color: C.violet2, maxR: 1200, width: 30, sparks: 0 });
      ctx.restore();
    }

    // ---------------------------------------------------------------- right half (camera drift)
    ctx.save();
    ctx.translate(camX, 0);
    const t22 = f.at(22, 0);
    // the board clears out just before the 22.0 downbeat, so the planning screen lands on a clean stage
    const tS = f.at(21, 3.5);
    const kLin = seg(lt, tS, tS + BEAT * 0.6);
    const kShrink = E.inOutCubic(kLin);
    const halfPulse = 1 + 0.01 * f.kick; // halftime kicks b0 / b2.5
    const enter = lt < 0 ? 0.92 : 1;
    // 20.0: the board drops in (0.94 -> 1, outBack over a quarter beat) as the focal point of the downbeat
    const drop = lt < 0 ? 0.94 : lerp(0.94, 1, E.outBack(seg(lt, 0, BEAT * 0.25), 2.2));
    const boardGeo = {
      cx: lerp(BOARD.cx, 1540, kShrink),
      cy: lerp(BOARD.cy, 300, kShrink),
      s: lerp(1, 0.45, kShrink) * halfPulse * drop,
    };
    if (kShrink < 1) {
      ctx.save();
      ctx.translate(boardGeo.cx, boardGeo.cy);
      ctx.scale(boardGeo.s, boardGeo.s);
      drawBoard(ctx, f, K, enter * Math.max(0, 1 - kLin * 1.5));
      ctx.restore();
    }

    // planning: real screenshot (fictional demo data), crop on the week + the 20:00 session
    if (lt >= t22) {
      const kIn = seg(lt, t22, t22 + BEAT * 0.9);
      const eIn = E.outExpo(kIn);
      const push = E.inOutSine(seg(lt, t22, f.dur));
      // push-in 860 -> 930 across bars 22–23 (right edge stays ≤ 1824)
      const w = (lerp(800, 860, eIn) + 70 * push) * (1 + 0.006 * f.kick);
      const h = (w * SRC[3]) / SRC[2];
      const geo = { x: 1350, y: 404, w, h, tilt: lerp(-0.06, -0.012, eIn), skew: lerp(0.16, 0.05, eIn) };
      const t5 = f.at(23, 0);
      const rim = lt >= t5 ? 0.6 + 0.4 * Math.exp(-(lt - t5) * 4) : 0;
      // soft cyan rim light at 5 / 5
      if (rim > 0) {
        ctx.save();
        ctx.translate(geo.x, geo.y);
        ctx.rotate(geo.tilt);
        ctx.transform(1, geo.skew * 0.25, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        K.roundRect(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 24);
        ctx.strokeStyle = rgba(C.cyan2, 0.16 * rim);
        ctx.lineWidth = 26;
        ctx.stroke();
        ctx.strokeStyle = rgba(C.cyan, 0.35 * rim);
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.restore();
      }
      const tG1 = t22 + BEAT * 0.6;
      const tG2 = f.at(23, 2.5);
      const glare = lt < tG2 ? seg(lt, tG1, tG1 + 0.55) : seg(lt, tG2, tG2 + 0.55);
      K.screen(ctx, SHOT, geo.x, geo.y, w, {
        src: SRC, h, tilt: geo.tilt, skew: geo.skew, p: kIn, glare: glare > 0 && glare < 1 ? glare : -1,
        frame: rim > 0 ? C.cyan : C.violet2, glow: 0.55 + 0.4 * rim, r: 18,
      });
      if (kIn >= 0.6) drawScreenOverlays(ctx, f, K, geo);
    }
    drawMatchPill(ctx, f, K);
    drawAvailability(ctx, f, K);
    ctx.restore();

    // ---------------------------------------------------------------- left column cards
    ctx.save();
    ctx.translate(camX * 0.3, 0);
    for (const c of CARDS) drawCard(ctx, f, K, c, 470, 540);
    ctx.restore();

    // brand bug
    K.logo(ctx, 1772, 62, 150, { alpha: 0.55, glow: 6, lineWidth: 2.4 });

    const hit = lt >= 0 ? Math.exp(-lt * 9) : 0;
    return { auto: false, shake: 0, flash: 0.12 * hit, rgb: 4 * hit, zoom: 0 };
  },
};
