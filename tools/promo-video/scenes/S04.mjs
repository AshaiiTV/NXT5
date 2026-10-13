// S04 — DROP 1 « NXT5, la preuve » (bars 12–16).
// Persona split splash + logo slam, then the REAL product: match card (team stats / players), the gold-gap
// timeline scrubbed on the kicks (objectives + eliminations), and the written debrief tied back to its
// source game. Screens are real nxt5.org screenshots (fictional demo data), tightly cropped and stitched so
// the numbers read at phone size, shown as 2.5D glass panels (true perspective strips). Every downbeat has
// something on it: the 12.3.2 band reveals bar 13, the timeline punches in under the 13.3.5 whip.
// Pure function of f.
import { screenBitmap, drawScreen, project, corners, dotTile, drawDots, plate, subPill, ringBurst } from './lib-S04.mjs';

const BEAT = 0.4;
const BAR = 1.6;
const L = (bar, beat = 0) => (bar - 12) * BAR + beat * BEAT; // local seconds
const DEG = Math.PI / 180;
const CUT = -18 * DEG;
const NB = ' ';

const CARDS = [
  { bar: 12, beat: 0, durBeats: 4, text: 'Comprends tes parties.', emph: 'parties', sub: 'Prépare la suite.', style: 'slam' },
  { bar: 13, beat: 0, durBeats: 4, text: 'Ta game, décortiquée.', emph: 'décortiquée', sub: 'Stats d’équipe et détail par joueur.', style: 'slam' },
  { bar: 14, beat: 0, durBeats: 4, text: 'Objectifs. Combats.', emph: 'Combats.', sub: 'Selon les données importées.', style: 'jagged' },
  { bar: 15, beat: 0, durBeats: 4, text: `Scrim perdu${NB}? Débrief.`, emph: 'Débrief.', sub: 'Points à travailler, liés à la partie.', style: 'stamp', sceneDrawn: true, color: '#d946ef' },
];

// ------------------------------------------------------------------ real UI crops (source pixels)
const STATS = 'ui-match-stats.png';
const TL12 = 'ui-match-timeline-1200.png';
const TL21 = 'ui-match-timeline.png';
const TL33 = 'ui-match-timeline-3345.png';
const DEB = 'ui-debrief.png';

/** Role glyphs (original geometry, per the script): circle, triangle, diamond, square, hexagon. */
function roleGlyph(x, i, cx, cy, r) {
  x.beginPath();
  if (i === 0) x.arc(cx, cy, r, 0, Math.PI * 2);
  else if (i === 1) {
    x.moveTo(cx, cy - r * 1.1);
    x.lineTo(cx + r, cy + r * 0.75);
    x.lineTo(cx - r, cy + r * 0.75);
    x.closePath();
  } else if (i === 2) {
    x.moveTo(cx, cy - r * 1.15);
    x.lineTo(cx + r * 1.15, cy);
    x.lineTo(cx, cy + r * 1.15);
    x.lineTo(cx - r * 1.15, cy);
    x.closePath();
  } else if (i === 3) x.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
  else {
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      k ? x.lineTo(cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08) : x.moveTo(cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08);
    }
    x.closePath();
  }
}

const SCREENS = {
  // « Écart d’or final +4 000 » over « Écart de vision +20 » | « Morts de l’équipe 12 »
  team: {
    w: 900,
    parts: [
      { file: STATS, src: [105, 392, 360, 182], x: 24, y: 20, feather: 9 },
      { file: STATS, src: [105, 1232, 250, 148], x: 24, y: 232, feather: 9 },
      { file: STATS, src: [990, 1232, 262, 148], x: 340, y: 232, feather: 9 },
    ],
    opts: {
      sw: 640, sh: 400, bg: { x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.85, stops: [[0, '#252d46'], [0.55, '#242745'], [1, '#222043']] },
      decorate: (x, s) => {
        x.fillStyle = 'rgba(148,163,184,0.28)';
        x.fillRect(24 * s, 214 * s, 592 * s, Math.max(1.5, 1.2 * s));
      },
    },
  },
  // five player rows: role glyph · name · K/D/A (champion names and the long legend are left out)
  players: {
    w: 780,
    parts: [0, 1, 2, 3, 4].flatMap((i) => [
      { file: STATS, src: [195, 1500 + 162 * i, 215, 42], x: 76, y: 18 + 64 * i, feather: 6 },
      { file: STATS, src: [1690, 1500 + 162 * i, 150, 42], x: 336, y: 18 + 64 * i, feather: 6 },
    ]),
    opts: {
      sw: 500, sh: 334, bg: { x0: 0.45, y0: 0, x1: 0.75, y1: 0, stops: [[0, '#232343'], [1, '#1e233f']] },
      decorate: (x, s) => {
        x.fillStyle = 'rgba(148,163,184,0.22)';
        for (let i = 1; i < 5; i++) x.fillRect(16 * s, (18 + 64 * i - 11) * s, 468 * s, Math.max(1.5, s));
        x.strokeStyle = '#67e8f9';
        x.lineWidth = 2.4 * s;
        x.lineJoin = 'round';
        for (let i = 0; i < 5; i++) {
          roleGlyph(x, i, 42 * s, (18 + 64 * i + 21) * s, 12 * s);
          x.stroke();
        }
      },
    },
  },
  // gold-gap timeline keyframes; the site's own dashed cursor is patched out from a neighbouring keyframe
  // so the scene playhead is the only cursor
  tl1200: { w: 1240, parts: [{ file: TL12, src: [130, 600, 1660, 840], x: 0, y: 0 }, { file: TL21, src: [702, 858, 80, 334], x: 572, y: 258 }], opts: { sw: 1660, sh: 840, bg: '#182235' } },
  tl2100: { w: 1240, parts: [{ file: TL21, src: [130, 600, 1660, 840], x: 0, y: 0 }, { file: TL12, src: [1106, 858, 76, 334], x: 976, y: 258 }], opts: { sw: 1660, sh: 840, bg: '#182235' } },
  tl3345: { w: 1240, parts: [{ file: TL33, src: [130, 600, 1660, 840], x: 0, y: 0 }, { file: TL12, src: [1672, 858, 80, 334], x: 1542, y: 258 }], opts: { sw: 1660, sh: 840, bg: '#182235' } },
  elim: { w: 300, parts: [{ file: TL21, src: [1440, 372, 340, 178] }], opts: { bg: '#182235' } },
  // debrief: header, the three step titles, the action line and « Revoir la partie source »
  // (the « 4 000 or de plus » body line is left out: nothing contradicts the « scrim perdu » framing)
  debrief: {
    w: 880,
    parts: [
      { file: DEB, src: [110, 148, 860, 145], x: 0, y: 0, feather: 6 },
      { file: DEB, src: [110, 384, 860, 46], x: 0, y: 175, feather: 6 },
      { file: DEB, src: [110, 642, 860, 50], x: 0, y: 251, feather: 6 },
      { file: DEB, src: [110, 900, 860, 50], x: 0, y: 331, feather: 6 },
      { file: DEB, src: [110, 986, 702, 46], x: 0, y: 386, feather: 6 },
      { file: DEB, src: [110, 1296, 420, 104], x: 0, y: 462, feather: 6 },
    ],
    opts: {
      sw: 860, sh: 580, bg: { x0: 0, y0: 0.1, x1: 0, y1: 0.9, stops: [[0, '#252b46'], [0.5, '#242745'], [1, '#232243']] },
      decorate: (x, s) => {
        x.fillStyle = 'rgba(148,163,184,0.26)';
        for (const y of [160, 237, 316]) x.fillRect(12 * s, y * s, 836 * s, Math.max(1.5, s));
      },
    },
  },
};
const bmpOf = (K, k) => screenBitmap(K, `S04b-${k}`, SCREENS[k].parts, SCREENS[k].w, SCREENS[k].opts);

// timeline geometry (source px of the timeline screenshots)
const TL = {
  x: (min) => 202 + (min / 33.75) * (1712 - 202),
  y: { top: 885, bottom: 1160 },
  px: [202, 740, 1143, 1712], // playhead stops: 0, 12:00, 21:00, 33:45 (the screenshots' cursor columns)
  dragon: [1088, 1062],
  nashor: [1464, 962],
};
// gold-gap curve, sampled from the screenshot (source px), for the playhead dot
const CURVE = [
  [202, 1106], [216, 1105], [248, 1102], [280, 1099], [296, 1097], [328, 1105], [376, 1115], [408, 1103], [440, 1094], [472, 1086],
  [504, 1093], [536, 1095], [568, 1089], [600, 1081], [632, 1077], [664, 1082], [696, 1087], [728, 1092], [760, 1102], [792, 1113],
  [824, 1123], [840, 1123], [872, 1113], [904, 1103], [952, 1106], [1000, 1110], [1032, 1094], [1064, 1078], [1088, 1063], [1144, 1045],
  [1176, 1051], [1224, 1059], [1240, 1055], [1272, 1034], [1304, 1014], [1320, 1003], [1352, 1014], [1400, 1025], [1432, 1005], [1464, 962],
  [1528, 979], [1576, 985], [1608, 969], [1656, 945], [1704, 924], [1712, 921],
];
function curveY(x) {
  if (x <= CURVE[0][0]) return CURVE[0][1];
  for (let i = 1; i < CURVE.length; i++) {
    if (x <= CURVE[i][0]) {
      const [x0, y0] = CURVE[i - 1];
      const [x1, y1] = CURVE[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return CURVE[CURVE.length - 1][1];
}

// ------------------------------------------------------------------ helpers
function brandBug(ctx, K, alpha = 1) {
  if (alpha <= 0.002) return;
  K.logo(ctx, 1772, 62, 150, { alpha: 0.55 * alpha, glow: 6, lineWidth: 2.4 });
}

function halfPlane(ctx, upper) {
  const dx = Math.cos(CUT);
  const dy = Math.sin(CUT);
  const nx = upper ? Math.sin(CUT) : -Math.sin(CUT);
  const ny = upper ? -Math.cos(CUT) : Math.cos(CUT);
  const Lg = 4000;
  ctx.beginPath();
  ctx.moveTo(960 - dx * Lg, 540 - dy * Lg);
  ctx.lineTo(960 + dx * Lg, 540 + dy * Lg);
  ctx.lineTo(960 + dx * Lg + nx * Lg, 540 + dy * Lg + ny * Lg);
  ctx.lineTo(960 - dx * Lg + nx * Lg, 540 - dy * Lg + ny * Lg);
  ctx.closePath();
}

/** Region ahead of (right of, ahead=true) or behind (left of) a 72° band line crossing y = 540 at x = bx. */
function aheadOfBand(ctx, bx, ahead) {
  const a = (90 - 18) * DEG;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const Lg = 3000;
  ctx.beginPath();
  ctx.moveTo(bx - dx * Lg, 540 - dy * Lg);
  ctx.lineTo(bx + dx * Lg, 540 + dy * Lg);
  const s = ahead ? 1 : -1;
  ctx.lineTo(bx + dx * Lg + s * Lg, 540 + dy * Lg);
  ctx.lineTo(bx - dx * Lg + s * Lg, 540 - dy * Lg);
  ctx.closePath();
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** The persona split background (−18° cut through the centre). */
function splitBackground(ctx, f, K, lt) {
  const { C, rgba, E, clamp } = K;
  const bg = ctx.createRadialGradient(760, 380, 40, 760, 380, 1300);
  bg.addColorStop(0, '#1a2440');
  bg.addColorStop(0.55, C.bg);
  bg.addColorStop(1, C.night);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.save();
  halfPlane(ctx, true);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const gx = 520 + 120 * Math.sin(f.t * 0.4);
  const glowG = ctx.createRadialGradient(gx, 300, 0, gx, 300, 760);
  glowG.addColorStop(0, rgba(C.cyan2, 0.1 + 0.06 * f.kick));
  glowG.addColorStop(0.5, rgba(C.violet, 0.06));
  glowG.addColorStop(1, rgba(C.violet, 0));
  ctx.fillStyle = glowG;
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.globalCompositeOperation = 'source-over';
  const dr = f.t * 36; // drift along the cut
  drawDots(ctx, dotTile(C.cyan, 2.5), dr * 0.95, -dr * 0.31, 0.1 + 0.06 * f.snare);
  ctx.restore();
  // lower-right: fuchsia -> violet with ink dots (r = 2 + 6·kick), calmer behind the UI
  const dim = lt < L(12, 3.2) ? 1 : 0.62;
  ctx.save();
  halfPlane(ctx, false);
  ctx.clip();
  const g = ctx.createLinearGradient(960, 540, 1700, 1200);
  g.addColorStop(0, mix(C.fuchsia2, '#1a1033', 1 - dim));
  g.addColorStop(1, mix(C.violet, '#1a1033', 1 - dim));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1920, 1080);
  const e8 = f.beat * 2;
  const step = Math.floor(e8) + E.outExpo(clamp((e8 % 1) * 3));
  ctx.save();
  ctx.translate(960, 540);
  ctx.rotate(CUT);
  const off = (step * 22) % 140;
  ctx.fillStyle = rgba('#ffffff', 0.07);
  for (let y = -900 + off; y < 900; y += 140) ctx.fillRect(-1600, y, 3200, 26);
  ctx.restore();
  const r = 2 + 6 * f.kick * 0.75 + 1.2 * f.snare;
  drawDots(ctx, dotTile('#020611', r), 0, 0, 0.55);
  ctx.restore();
  // 40 px ink band along the cut + thin cyan/fuchsia edges
  ctx.save();
  ctx.translate(960, 540);
  ctx.rotate(CUT);
  ctx.fillStyle = C.ink;
  ctx.fillRect(-1400, -20, 2800, 40);
  ctx.fillStyle = rgba(C.cyan, 0.8);
  ctx.fillRect(-1400, -22, 2800, 2);
  ctx.fillStyle = rgba(C.fuchsia, 0.8);
  ctx.fillRect(-1400, 20, 2800, 2);
  // two white sweep lines racing along the cut every 2 beats
  const q = ((f.lt % (BEAT * 2)) + BEAT * 2) % (BEAT * 2) / (BEAT * 0.9);
  if (q < 1) {
    const x = -1300 + E.inOutCubic(q) * 2600;
    for (const [yy, d] of [[-30, 0], [30, 120]]) {
      const gx2 = ctx.createLinearGradient(x - d - 420, 0, x - d, 0);
      gx2.addColorStop(0, 'rgba(255,255,255,0)');
      gx2.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = gx2;
      ctx.fillRect(x - d - 420, yy - 1, 420, 2);
    }
  }
  // snare/clap: thin 30 % white slash flash (≤ 0.08 s)
  const ss = f.since('snare');
  if (ss < 0.08) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - ss / 0.08)})`;
    ctx.fillRect(-1400, -170, 2800, 3);
    ctx.fillRect(-1400, 210, 2800, 2);
  }
  ctx.restore();
  // particles streak left (one stroked path per colour, no per-line gradients)
  {
    const R = K.rng(41);
    const cols = [C.cyan, C.violet2, '#ffffff'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const y = R() * 1080;
        const len = 60 + R() * 260;
        const v = 1400 + R() * 1800;
        const x = 2200 - ((R() * 2600 + f.t * v) % 2600);
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
      }
      ctx.strokeStyle = rgba(cols[k], k === 2 ? 0.22 : 0.3);
      ctx.lineWidth = k === 2 ? 1.5 : 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Lower-third card with its P5 plate (renderCards for the text).
 * opts.lead (s): the card starts its slam that far in, so it is at full opacity on its downbeat frame.
 * opts.noFade: no exit fade (the 12.3.2 band wipes card 0 instead).
 */
function cardWithPlate(ctx, f, K, idx, y, opts = {}) {
  const { E, seg, clamp, BEAT: KB } = K;
  const { lead = 0, noFade = false } = opts;
  const c = f.cardsOf[idx];
  const t0 = L(c.bar, c.beat);
  const d = c.durBeats * BEAT;
  const q = f.lt + 1e-4 - t0; // float rounding: a frame landing on the downbeat must see the card
  if (q < 0 || q > d) return;
  const cc = { ...c, beat: c.beat - lead / BEAT, durBeats: c.durBeats + lead / BEAT + (noFade ? 2 : 0) };
  const pw = K.measure(ctx, c.text, Math.min(150, K.fitSize(ctx, c.text, 1500, 150)), K.F.anton);
  const pIn = E.outExpo(clamp((q + lead) / 0.18));
  const out = noFade ? 0 : seg(q, d - BEAT * 0.25, d);
  const cy = y - 54 * 0.7;
  ctx.save();
  ctx.globalAlpha *= 1 - E.inQuad(out);
  plate(ctx, K, 960 - pw / 2 - 110, cy - 92, 960 + pw / 2 + 70, cy + 196, { p: Math.max(pIn, lead ? 0.55 : 0), alpha: 0.86 });
  ctx.restore();
  const list = f.cardsOf.map((x, i) => (i === idx ? cc : x));
  K.renderCards(ctx, f, list, { y, size: 150, subSize: 54, maxW: 1500, skip: (_, i) => i !== idx });
  void KB;
}

/** Corner brackets around a projected rectangle (bitmap coords of a screen). */
function brackets(ctx, K, o, rect, p, color) {
  const { C, rgba, E, clamp } = K;
  if (p <= 0) return;
  const e = E.outExpo(clamp(p));
  const [x, y, w, h] = rect;
  const grow = 1 + (1 - e) * 0.35;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const hw = (w / 2) * grow + 10;
  const hh = (h / 2) * grow + 10;
  const arm = Math.min(w, h) * 0.35;
  ctx.save();
  ctx.globalAlpha *= clamp(p * 4);
  ctx.strokeStyle = color || C.cyan;
  ctx.lineWidth = 5;
  ctx.lineCap = 'square';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const a = project(o, cx + sx * hw, cy + sy * hh);
    const b = project(o, cx + sx * hw - sx * arm, cy + sy * hh);
    const c = project(o, cx + sx * hw, cy + sy * hh - sy * arm);
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
  }
  const tl = project(o, cx - hw, cy - hh);
  const tr = project(o, cx + hw, cy - hh);
  const br = project(o, cx + hw, cy + hh);
  const bl = project(o, cx - hw, cy + hh);
  ctx.fillStyle = rgba(color || C.cyan, 0.16 * (1 - e));
  polyPath(ctx, [tl, tr, br, bl]);
  ctx.fill();
  ctx.restore();
}

/** Highlight band over a bitmap rectangle (projected), alpha a. */
function highlight(ctx, K, o, rect, a, color) {
  const { rgba } = K;
  if (a <= 0) return;
  const [x, y, w, h] = rect;
  const pts = [project(o, x, y), project(o, x + w, y), project(o, x + w, y + h), project(o, x, y + h)];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(color, 0.1 * a);
  polyPath(ctx, pts);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] - 2, pts[0][1]);
  ctx.lineTo(pts[3][0] - 2, pts[3][1]);
  ctx.stroke();
  ctx.restore();
}

/** Tab label pill (Russo). */
function tabLabel(ctx, K, str, x, y, opts = {}) {
  const { C, rgba } = K;
  const { color = C.cyan, alpha = 1, active = false, size = 26 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const w = K.measure(ctx, str, size, K.F.russo, 2) + 30;
  ctx.fillStyle = active ? color : rgba(C.ink, 0.85);
  ctx.beginPath();
  ctx.moveTo(x + 10, y - size * 0.8);
  ctx.lineTo(x + w + 10, y - size * 0.8);
  ctx.lineTo(x + w, y + size * 0.8);
  ctx.lineTo(x, y + size * 0.8);
  ctx.closePath();
  ctx.fill();
  if (!active) {
    ctx.strokeStyle = rgba(color, 0.7);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  K.text(ctx, str, x + w / 2 + 5, y + 1, { size, font: K.F.russo, color: active ? C.ink : C.text, spacing: 2 });
  ctx.restore();
  return w + 10;
}

/** Original objective glyph: ink hexagon with cyan ring + inner hex (covers the screenshot icon). */
function objectiveHex(ctx, K, x, y, r, p) {
  const { C, rgba, E, clamp } = K;
  const lit = clamp(p);
  const e = p > 0 ? 0.86 + 0.14 * E.outBack(lit, 3) + 0.25 * Math.sin(Math.PI * lit) : 0.86;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(e, e);
  K.hexPath(ctx, 0, 0, r);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = lit > 0 ? C.cyan : '#64748b';
  ctx.stroke();
  K.hexPath(ctx, 0, 0, r * 0.45);
  ctx.fillStyle = lit > 0 ? C.cyan : '#475569';
  ctx.fill();
  if (lit > 0) {
    ctx.strokeStyle = rgba(C.cyan, 0.35);
    ctx.lineWidth = 8;
    K.hexPath(ctx, 0, 0, r + 5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Fuchsia crossed-bars fight glyph. */
function fightGlyph(ctx, K, x, y, s, p) {
  const { C, E, clamp } = K;
  if (p <= 0) return;
  const e = E.outBack(clamp(p), 2.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(e * s, e * s);
  for (const a of [-45, 45]) {
    ctx.save();
    ctx.rotate(a * DEG);
    ctx.fillStyle = C.ink;
    ctx.fillRect(-30, -9, 60, 18);
    ctx.fillStyle = C.fuchsia2;
    ctx.fillRect(-27, -6, 54, 12);
    ctx.fillStyle = '#f5d0fe';
    ctx.fillRect(14, -10, 6, 20);
    ctx.restore();
  }
  ctx.restore();
}

/** Cyan check mark drawn over 0.1 s. */
function check(ctx, K, x, y, s, p) {
  const { C, rgba, clamp } = K;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba(C.ink, 0.6);
  ctx.fillRect(-17 * s, -17 * s, 34 * s, 34 * s);
  ctx.strokeStyle = rgba(C.violet2, 0.9);
  ctx.lineWidth = 3;
  ctx.strokeRect(-17 * s, -17 * s, 34 * s, 34 * s);
  if (p > 0) {
    ctx.fillStyle = rgba(C.cyan, 0.2);
    ctx.fillRect(-17 * s, -17 * s, 34 * s, 34 * s);
    const pts = [[-10, 1], [-2, 10], [13, -11]];
    const segs = [Math.hypot(8, 9), Math.hypot(15, 21)];
    const total = segs[0] + segs[1];
    let len = total * clamp(p);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 6 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
    for (let i = 0; i < 2 && len > 0; i++) {
      const u = Math.min(1, len / segs[i]);
      ctx.lineTo((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u) * s, (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u) * s);
      len -= segs[i];
    }
    ctx.stroke();
  }
  ctx.restore();
}

function sparks(ctx, K, x, y, p, seed, color) {
  const { rgba, rng, E } = K;
  if (p <= 0 || p >= 1) return;
  const R = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 1 - p);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = R() * Math.PI * 2;
    const r0 = 10 + E.outCubic(p) * 30;
    const r1 = r0 + 14 + R() * 26 * (1 - p);
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
  }
  ctx.stroke();
  ctx.restore();
}

/** Point along a cubic bezier. */
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

// ------------------------------------------------------------------ layout of each screen over time
function teamO(K, lt, b) {
  const { E, clamp, seg } = K;
  const t13 = L(13);
  const pre = lt < t13;
  const eA = pre ? 0 : E.outExpo(clamp((lt - t13) / 0.3));
  const pb = E.outExpo(seg(lt, L(13, 1.5), L(13, 1.5) + 0.3)); // pushed back when the players panel lands
  const xe = E.inCubic(seg(lt, L(13, 3.5), L(14))); // whip out sideways
  return {
    cx: 560 - 70 * pb - xe * 1100, cy: 418, w: b.w, h: b.h,
    rotY: 0.3 - 0.12 * eA + 0.04 * pb + xe * 0.5, roll: -0.012,
    scale: (1.18 - 0.18 * eA) * (1 - 0.1 * pb) * (1 + 0.02 * seg(lt, t13, L(14))),
    alpha: 1, reveal: 1, glare: seg(lt, t13 + 0.05, t13 + 0.7), frame: K.C.cyan,
  };
}
function playersO(K, lt, b) {
  const { E, clamp, seg } = K;
  const tB = L(13, 1.5);
  const bIn = clamp((lt - tB) / 0.3);
  const eB = E.outExpo(bIn);
  const focusB = seg(lt, L(13, 3), L(13, 3) + 0.15);
  const xe = E.inCubic(seg(lt, L(13, 3.5), L(14)));
  return {
    cx: 1410 + (1 - eB) * 460 + xe * 1100, cy: 418, w: b.w, h: b.h,
    rotY: -0.2 - (1 - eB) * 0.8 - xe * 0.5, roll: 0.012, scale: 1 + 0.03 * focusB,
    alpha: clamp(bIn * 5), reveal: E.outCubic(clamp((lt - tB) / 0.22)), glare: seg(lt, L(13, 3), L(13, 3) + 0.5), frame: K.C.violet2,
  };
}
function timelineO(K, lt, b) {
  const { E, clamp, seg, lerp } = K;
  const tT0 = L(13, 3.5);
  const eP = E.outExpo(clamp((lt - tT0) / 0.22));
  const kickPunch = lt >= L(14) ? 0.025 * Math.exp(-(lt - L(14)) * 9) : 0;
  const shrink = E.outExpo(clamp((lt - L(15)) / 0.32));
  return {
    cx: lerp(960, 380, shrink), cy: lerp(392, 330, shrink), w: b.w, h: b.h,
    rotY: lerp(-0.06 - 0.25 * (1 - eP), 0.16, shrink), roll: lerp(0, -0.02, shrink),
    scale: lerp((1.3 - 0.3 * eP) * (1 + kickPunch) * (1 + 0.025 * seg(lt, L(14), L(15))), 0.36, shrink),
    alpha: 1, reveal: E.outCubic(seg(lt, tT0, L(14) - 1 / 60)),
    glare: lt < L(15) ? seg(lt, L(14) + 0.05, L(14) + 0.85) : seg(lt, L(15) + 0.1, L(15) + 0.7), frame: K.C.cyan, glow: 0.6,
  };
}
function debriefO(K, lt, b) {
  const { E, clamp, seg } = K;
  const dIn = clamp((lt - L(15)) / 0.34);
  const eD = E.outExpo(dIn);
  return {
    cx: 1272 + (1 - eD) * 760, cy: 396, w: b.w, h: b.h,
    rotY: -0.12 - (1 - eD) * 0.7, roll: 0.01, scale: 1 + 0.02 * seg(lt, L(15), L(16)), alpha: clamp(dIn * 4), reveal: 1,
    glare: seg(lt, L(15) + 0.2, L(15) + 1.1), frame: K.C.violet,
  };
}

// ------------------------------------------------------------------ scene
export default {
  id: 'S04',
  startBar: 12,
  endBar: 16,
  transitionOut: 'slash',
  cards: CARDS,
  draw(ctx, f, K) {
    const { C, rgba, E, clamp, seg } = K;
    const lt = Math.max(0, f.lt + 1e-4); // +0.1 ms: frames landing exactly on a beat see that beat's event
    const t13 = L(13);
    const t14 = L(14);
    const t15 = L(15);

    splitBackground(ctx, f, K, lt);

    // ============================================================ 12.3.2 slash band: reveals bar 13
    const bandT0 = L(12, 3.2);
    const bandQ = seg(lt, bandT0, t13);
    const bandX = -360 + E.inQuad(bandQ) * 2660; // accelerates across and leaves the frame exactly on 13.0
    const banding = bandQ > 0 && bandQ < 1;

    // ============================================================ BAR 12 — logo slam (wiped by the band)
    if (lt < t13) {
      ctx.save();
      if (bandQ > 0) {
        aheadOfBand(ctx, bandX, true);
        ctx.clip();
      }
      if (lt < 0.8) {
        K.shockwave(ctx, 960, 370, lt / 0.8, { color: C.cyan, maxR: 1400, sparks: 12, seed: 5 });
        K.shockwave(ctx, 960, 370, (lt - 0.07) / 0.8, { color: '#ffffff', maxR: 1250, sparks: 12, seed: 9 });
      }
      const pp = E.outExpo(clamp(lt / 0.2));
      plate(ctx, K, 360, 232, 1540, 506, { p: pp, alpha: 0.82 });
      const sl = (2.5 - 1.5 * E.outExpo(clamp(lt / 0.25))) * (1 + 0.035 * seg(lt, 0.25, t13));
      const glow = 24 + 30 * f.kick;
      ctx.save();
      ctx.translate(960, 370);
      ctx.scale(sl, sl);
      K.logo(ctx, 0, 0, 1000, { draw: E.outCubic(clamp(lt / (BEAT * 2))), fill: 0.22 * seg(lt, 0.55, 0.95), glow, lineWidth: 14 });
      ctx.restore();
      for (const q of [seg(lt, L(12, 1), L(12, 1) + 0.35), seg(lt, L(12, 3), L(12, 3) + 0.35)]) {
        if (q <= 0 || q >= 1) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(360, 232, 1240, 274);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const x = 300 + q * 1400;
        const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.translate(x, 370);
        ctx.transform(1, 0, -0.32, 1, 0, 0);
        ctx.fillRect(-90, -160, 180, 320);
        ctx.restore();
      }
      // card 0 is wiped by the band together with the logo (no fade)
      cardWithPlate(ctx, f, K, 0, 820, { noFade: true });
      ctx.restore();
    }

    // ============================================================ BAR 13 — team stats (A) + players (B)
    const bTeam = bmpOf(K, 'team');
    const bPlay = bmpOf(K, 'players');
    const exit13 = seg(lt, L(13, 3.5), t14);
    if (lt >= bandT0 && exit13 < 1) {
      const oA = teamO(K, lt, bTeam);
      ctx.save();
      if (lt < t13) {
        aheadOfBand(ctx, bandX, false); // revealed behind the band, already at full opacity
        ctx.clip();
      }
      drawScreen(ctx, K, bTeam, oA);
      if (lt >= t13) {
        // « +4 000 » on the 13.1 snare, vision / deaths on the 13.2.75 kick
        brackets(ctx, K, oA, [...bTeam.map(116, 488, 0), 336 * bTeam.s, 80 * bTeam.s], (lt - L(13, 1)) / 0.18, C.cyan);
        brackets(ctx, K, oA, [...bTeam.map(114, 1316, 1), 218 * bTeam.s, 60 * bTeam.s], (lt - L(13, 2.75)) / 0.18, C.cyan);
        brackets(ctx, K, oA, [...bTeam.map(992, 1316, 2), 82 * bTeam.s, 60 * bTeam.s], (lt - L(13, 2.75) - 0.05) / 0.18, C.fuchsia);
      }
      // ÉQUIPE tag on the panel (active until the JOUEUR tab takes over on the 13.3 snare)
      const focusB = seg(lt, L(13, 3), L(13, 3) + 0.15);
      const [ax, ay] = project(oA, 0, 0);
      const tagA = lt < t13 ? 0 : clamp((lt - t13 - 0.08) / 0.12);
      tabLabel(ctx, K, 'ÉQUIPE', ax + 6, ay - 34, { alpha: tagA * (focusB > 0.5 ? 0.6 : 1), active: focusB <= 0.5, size: 30 });
      ctx.restore();
      // B: players, swings in on the 13.1.5 kick
      if (lt >= L(13, 1.5) - 0.02) {
        const oB = playersO(K, lt, bPlay);
        drawScreen(ctx, K, bPlay, oB);
        const fB = seg(lt, L(13, 3), L(13, 3) + 0.15);
        const [bx0, by0] = project(oB, 0, 0);
        tabLabel(ctx, K, 'JOUEUR', bx0 + 6, by0 - 34, { alpha: oB.alpha * (fB > 0.5 ? 1 : 0.6), active: fB > 0.5, color: C.cyan, size: 30 });
        // K/D/A column on the 13.2 kick
        brackets(ctx, K, oB, [...bPlay.at(328, 10), 164 * bPlay.s, 316 * bPlay.s], (lt - L(13, 2)) / 0.2, C.cyan);
        // JOUEUR focus: cyan scan bar sweeping the five rows on the 13.3 snare
        const sc = seg(lt, L(13, 3), L(13, 3) + 0.32);
        if (sc > 0 && sc < 1) {
          const yb = bPlay.h * (0.04 + 0.92 * E.inOutCubic(sc));
          const a = project(oB, 0, yb);
          const b = project(oB, bPlay.w, yb);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = rgba(C.cyan, 0.85);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
          ctx.strokeStyle = rgba(C.cyan, 0.18);
          ctx.lineWidth = 26;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ============================================================ BAR 14 — timeline (punches in under the whip)
    const tT0 = L(13, 3.5);
    let oT = null;
    let bT = null;
    let uiPush = null;
    if (lt >= tT0) {
      const kf = [bmpOf(K, 'tl1200'), bmpOf(K, 'tl2100'), bmpOf(K, 'tl3345')];
      const moves = [L(14, 2), L(14, 3)];
      const idx = lt >= moves[1] ? 2 : lt >= moves[0] ? 1 : 0;
      // the keyframe (gold number, chip) crossfades once the playhead ease is past ~0.7
      const blend = idx ? seg(lt, moves[idx - 1] + 0.035, moves[idx - 1] + 0.12) : 1;
      bT = blend >= 1 ? kf[idx] : kf[idx - 1];
      oT = { ...timelineO(K, lt, bT), ...(blend < 1 ? { bmp2: kf[idx], blend } : {}) };
      const rv = oT.reveal;
      // bar 15: camera push toward the connector (computed below, applied to the UI layer)
      const tc = L(15, 2.75);
      if (lt >= tc) uiPush = 1 + 0.07 * E.outCubic(seg(lt, tc, tc + 0.6));
      // UI layer transform for bar 15 (push about the chain glyph); identity otherwise
      ctx.save();
      const bD0 = lt >= t15 - 0.02 ? bmpOf(K, 'debrief') : null;
      let M = null;
      if (bD0 && uiPush) {
        const oD0 = debriefO(K, lt, bD0);
        const a = project(oD0, ...bD0.at(0, 514));
        const b = project(oT, ...bT.map(...TL.dragon));
        M = bez([a[0] - 6, a[1]], [a[0] - 230, a[1] + 40], [b[0] + 40, b[1] + 230], [b[0], b[1] + 18], 0.5);
        ctx.translate(M[0], M[1]);
        ctx.scale(uiPush, uiPush);
        ctx.translate(-M[0], -M[1]);
      }
      drawScreen(ctx, K, bT, oT);
      const P = (x, y) => project(oT, ...bT.map(x, y));
      // every overlay is gated on the wipe: clipped to the revealed part of the screen
      ctx.save();
      if (rv < 1) {
        polyPath(ctx, corners(oT, rv));
        ctx.clip();
      }
      // playhead: 0 -> 12:00 (14.0), -> 21:00 (14.2), -> 33:45 (14.3)
      const mv = [[t14, TL.px[0], TL.px[1]], [moves[0], TL.px[1], TL.px[2]], [moves[1], TL.px[2], TL.px[3]]];
      let phx = TL.px[0];
      for (const [tm, a, b] of mv) if (lt >= tm) phx = K.lerp(a, b, E.outExpo(clamp((lt - tm) / 0.22)));
      if (lt < t15 + 0.2) {
        const fade = 1 - seg(lt, t15, t15 + 0.2);
        const top = P(phx, TL.y.top - 10);
        const bot = P(phx, TL.y.bottom + 6);
        ctx.save();
        ctx.globalAlpha *= fade;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(C.cyan, 0.22);
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(bot[0], bot[1]);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 4;
        ctx.stroke();
        // dot riding the gold curve
        const [dx, dy, dk] = P(phx, curveY(phx));
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(dx, dy, 12 * dk, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.cyan;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dx, dy, 5 * dk, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // hits: 12:00 pulse (14.0), Dragon (14.2), Nashor (14.3) — light beam + ring + original hex marker
      const hits = [
        { t: t14 + 0.06, p: [TL.px[1], curveY(TL.px[1])], hex: false },
        { t: moves[0] + 0.06, p: TL.dragon, hex: true },
        { t: moves[1] + 0.06, p: TL.nashor, hex: true },
      ];
      hits.forEach((hh, i) => {
        const q = lt - hh.t;
        const [x, y, k] = P(...hh.p);
        if (q >= 0 && q < 0.5) {
          ringBurst(ctx, K, x, y, q / 0.5, { maxR: 80 * k * 1.3, color: C.cyan });
          const bq = q / 0.35;
          if (bq < 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const bh = 220 * k * 1.3 * E.outExpo(bq);
            const g = ctx.createLinearGradient(x, y - bh, x, y);
            g.addColorStop(0, rgba(C.cyan, 0));
            g.addColorStop(1, rgba('#ffffff', 0.9 * (1 - bq)));
            ctx.fillStyle = g;
            ctx.fillRect(x - 3 * k, y - bh, 6 * k, bh);
            ctx.restore();
          }
        }
        if (hh.hex) objectiveHex(ctx, K, x, y, 26 * k * 1.33, q / 0.18);
        if (!hh.hex && q >= 0 && q < 0.5) sparks(ctx, K, x, y, q / 0.4, 70 + i, C.cyan);
      });
      // the gold-gap number updates with the scrub: bracket it as each keyframe lands
      if (lt < t15) {
        for (const m of moves) brackets(ctx, K, oT, [...bT.map(140, 612), 440 * bT.s, 96 * bT.s], lt >= m ? (lt - m - 0.035) / 0.16 : 0, C.cyan);
      }
      ctx.restore();
      // eliminations tile (real) + fuchsia fight glyph — 14.1 and 14.2.5
      const bE = bmpOf(K, 'elim');
      const tE = L(14, 1);
      if (lt >= tE && lt < t15 + 0.12) {
        const eIn = clamp((lt - tE) / 0.22);
        const out = E.inCubic(seg(lt, L(14, 3.5), t15));
        const pulse = lt >= L(14, 2.5) ? Math.exp(-(lt - L(14, 2.5)) * 10) : 0;
        const oE = {
          cx: 1028 - out * 260, cy: 150 - out * 160, w: bE.w, h: bE.h, rotY: -0.18, roll: -0.05,
          scale: (1.35 - 0.35 * E.outBack(eIn, 2)) * (1 + 0.08 * pulse), alpha: clamp(eIn * 4) * (1 - out), reveal: 1, frame: C.fuchsia, glow: 0.9,
        };
        drawScreen(ctx, K, bE, oE);
        const [gx, gy] = project(oE, 0, bE.h * 0.38);
        fightGlyph(ctx, K, gx - 6, gy, 0.75 * (1 + 0.25 * pulse) * (1 - out), clamp((lt - tE) / 0.15));
        if (lt - tE < 0.4) ringBurst(ctx, K, gx, gy, (lt - tE) / 0.4, { color: C.fuchsia, maxR: 90 });
        if (lt >= L(14, 2.5) && lt - L(14, 2.5) < 0.4) ringBurst(ctx, K, gx, gy, (lt - L(14, 2.5)) / 0.4, { color: C.fuchsia, maxR: 110 });
      }
      // PARTIE tab on the tile
      if (lt >= t15) {
        const [px, py] = project(oT, 0, 0);
        tabLabel(ctx, K, 'PARTIE', px + 4, py - 30, { alpha: clamp((lt - t15) / 0.2), active: true, color: C.cyan });
      }

      // ========================================================== BAR 15 — debrief (real) + ticks + connector
      if (bD0) {
        const bD = bD0;
        const oD = debriefO(K, lt, bD);
        drawScreen(ctx, K, bD, oD);
        const dA = clamp((lt - t15) / 0.1);
        const [tx, ty] = project(oD, ...bD.at(650, 118));
        tabLabel(ctx, K, 'DÉBRIEF', tx, ty, { alpha: dA, active: true, color: C.violet });
        // steps 2 and 3 (the question, the action) light up as they are ticked
        highlight(ctx, K, oD, [...bD.at(0, 247), 760 * bD.s, 54 * bD.s], E.outCubic(seg(lt, L(15, 2), L(15, 2) + 0.15)), C.violet2);
        highlight(ctx, K, oD, [...bD.at(0, 327), 760 * bD.s, 110 * bD.s], E.outCubic(seg(lt, L(15, 3), L(15, 3) + 0.15)), C.cyan);
        // ticks on 15.1 (snare), 15.2 (kick), 15.3 (snare), next to the three steps
        [[198, L(15, 1)], [276, L(15, 2)], [356, L(15, 3)]].forEach(([sy, tt], i) => {
          const [x, y, k] = project(oD, ...bD.at(818, sy));
          ctx.save();
          ctx.globalAlpha *= dA;
          check(ctx, K, x, y, k * 1.1, (lt - tt) / 0.1);
          ctx.restore();
          if (lt >= tt) sparks(ctx, K, x, y, (lt - tt) / 0.35, 50 + i, C.cyan);
        });
        // connector: « Revoir la partie source » -> Dragon objective on the PARTIE tile (15.2.75)
        const tc2 = L(15, 2.75);
        if (lt >= tc2) {
          const cp = E.outCubic(clamp((lt - tc2) / 0.14));
          const a = project(oD, ...bD.at(0, 514));
          const b = project(oT, ...bT.map(...TL.dragon));
          const p0 = [a[0] - 6, a[1]];
          const p3 = [b[0], b[1] + 18];
          const p1 = [p0[0] - 230, p0[1] + 40];
          const p2 = [p3[0] + 40, p3[1] + 230];
          const N = 40;
          const n = Math.max(2, Math.round(N * cp));
          ctx.save();
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let i = 0; i <= n; i++) {
            const q = bez(p0, p1, p2, p3, i / N);
            i ? ctx.lineTo(...q) : ctx.moveTo(...q);
          }
          ctx.strokeStyle = rgba(C.ink, 0.85);
          ctx.lineWidth = 12;
          ctx.stroke();
          ctx.strokeStyle = C.cyan;
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = rgba(C.cyan, 0.2);
          ctx.lineWidth = 18;
          ctx.stroke();
          if (cp >= 1) {
            for (let k = 0; k < 3; k++) {
              const u = ((lt - tc2) * 2.2 + k / 3) % 1;
              const q = bez(p0, p1, p2, p3, u);
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(q[0], q[1], 5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
          // the source button and the objective both light up
          brackets(ctx, K, oD, [...bD.at(0, 462), 420 * bD.s, 104 * bD.s], (lt - tc2) / 0.16, C.cyan);
          if (cp > 0.5) {
            const m = bez(p0, p1, p2, p3, 0.5);
            const e = E.outBack(clamp((cp - 0.5) * 2), 2);
            ctx.save();
            ctx.translate(m[0], m[1]);
            ctx.rotate(-0.6);
            ctx.scale(e * 1.2, e * 1.2);
            ctx.fillStyle = C.ink;
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = C.cyan;
            ctx.lineWidth = 5;
            K.roundRect(ctx, -20, -8, 24, 16, 8);
            ctx.stroke();
            K.roundRect(ctx, -4, -8, 24, 16, 8);
            ctx.stroke();
            ctx.restore();
          }
          if (lt - tc2 < 0.45) ringBurst(ctx, K, p3[0], p3[1] - 18, (lt - tc2 - 0.1) / 0.35, { color: C.cyan, maxR: 70 });
        }
      }
      ctx.restore(); // UI push
      void M;
    }

    // ============================================================ slash band 12.3.2 (fuchsia, cyan edge)
    if (banding) {
      const a = (90 - 18) * DEG;
      ctx.save();
      ctx.translate(bandX, 540);
      ctx.rotate(a - Math.PI / 2);
      const bw = 150 * (1 - Math.abs(bandQ - 0.5) * 1.1);
      ctx.fillStyle = C.fuchsia2;
      ctx.fillRect(-bw, -900, bw, 1800);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(-4, -900, 10, 1800);
      ctx.fillStyle = C.ink;
      ctx.fillRect(-bw - 24, -900, 24, 1800);
      ctx.restore();
    }

    // ============================================================ CARDS (lower thirds)
    cardWithPlate(ctx, f, K, 1, 870, { lead: 0.07 }); // full opacity on the 13.0 frame
    cardWithPlate(ctx, f, K, 2, 870, { lead: 0.06 });
    // bar 15 stamp (scene-drawn): lands with a thud on 15.0
    {
      const c = f.cardsOf[3];
      const t0 = L(c.bar, c.beat);
      const d = c.durBeats * BEAT;
      const q = lt - t0;
      if (q >= 0 && q <= d) {
        const out = seg(q, d - BEAT * 0.25, d);
        ctx.save();
        ctx.globalAlpha *= 1 - E.inQuad(out);
        const sz = 104;
        const cy = 826;
        plate(ctx, K, 330, 740, 1560, 1022, { p: Math.max(0.55, E.outExpo(clamp(q / 0.18))), alpha: 0.86, edge: C.fuchsia2, edge2: C.cyan });
        // fuchsia shockwave behind the frame + ink splats thrown from the corners
        const land = 2 / 60; // the stamp hits the plate 2 frames after the 15.0 kick (frame 0 is already mid-drop)
        if (q > land && q < land + 0.42) K.shockwave(ctx, 960, cy, (q - land) / 0.42, { color: C.fuchsia2, maxR: 420, width: 18, sparks: 10, seed: 44 });
        const str = c.text.toUpperCase();
        const tw = K.measure(ctx, str, sz, K.F.bebas, 5);
        const w = tw + sz * 0.7;
        const h = sz * 1.25;
        if (q > land) {
          const sp = E.outCubic(clamp((q - land) / 0.35));
          const R = K.rng(77);
          ctx.save();
          ctx.globalAlpha *= 1 - seg(q, land + 0.6, land + 1.1);
          for (let i = 0; i < 8; i++) {
            const corner = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i % 4];
            const ang = Math.atan2(corner[1], corner[0]) + (R() - 0.5) * 0.9;
            const dist = (40 + R() * 110) * sp;
            const x0 = 960 + corner[0] * w * 0.5;
            const y0 = cy + corner[1] * h * 0.5;
            const r = (5 + R() * 9) * (1 - 0.3 * sp);
            ctx.fillStyle = i % 3 ? C.ink : C.fuchsia2;
            ctx.beginPath();
            ctx.arc(x0 + Math.cos(ang) * dist, y0 + Math.sin(ang) * dist * 0.6, r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        // the stamp: drops 1.7 -> 0.94 in 2 frames, then an outBack settle to 1; rotation -0.14 -> -0.05
        const e1 = clamp(q / land);
        const settle = E.outBack(seg(q, land, land + 0.24), 2.2);
        const s = q < land ? K.lerp(1.7, 0.94, e1 * e1) : K.lerp(0.94, 1, settle);
        const rot = q < land ? K.lerp(-0.14, -0.11, e1) : K.lerp(-0.11, -0.05, settle);
        ctx.save();
        ctx.translate(960, cy);
        ctx.rotate(rot);
        ctx.scale(s, s);
        ctx.fillStyle = rgba(C.ink, 0.55);
        K.roundRect(ctx, -w / 2, -h / 2, w, h, sz * 0.1);
        ctx.fill();
        ctx.strokeStyle = C.fuchsia2;
        ctx.lineWidth = sz * 0.08;
        ctx.stroke();
        ctx.strokeStyle = rgba(C.fuchsia2, 0.3);
        ctx.lineWidth = sz * 0.2;
        ctx.stroke();
        K.text(ctx, str, 0, sz * 0.04, { size: sz, font: K.F.bebas, color: C.fuchsia, emph: 'DÉBRIEF.', emphColor: C.cyan, spacing: 5 });
        // 2-frame 20 % white flash clipped to the stamp frame
        if (q >= land && q < land + 2 / 60) {
          K.roundRect(ctx, -w / 2, -h / 2, w, h, sz * 0.1);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fill();
        }
        ctx.restore();
        subPill(ctx, K, c.sub, 960, 962, E.outCubic(seg(q, BEAT * 0.4, BEAT * 1.2)));
        ctx.restore();
      }
    }

    // brand bug: steps aside while the hero logo is up, back in after the 12.3.2 band
    brandBug(ctx, K, lt < t13 ? seg(lt, bandT0, t13) : 1);
    return { shake: 0 };
  },
};
