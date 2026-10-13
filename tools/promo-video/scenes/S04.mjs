// S04 — DROP 1 « NXT5, la preuve » (bars 12–16).
// Persona split splash + logo slam, then the REAL product: match card (team stats / players),
// the gold-gap timeline scrubbed on the kicks (objectives + eliminations), and the written debrief
// tied back to its source game. Screens are real nxt5.org screenshots (fictional demo data), shown
// as 2.5D glass panels (true perspective strips). Pure function of f.
import { screenBitmap, drawScreen, project, dotTile, drawDots, plate, subPill, ringBurst } from './lib-S04.mjs';

const BEAT = 0.4;
const BAR = 1.6;
const L = (bar, beat = 0) => (bar - 12) * BAR + beat * BEAT; // local seconds
const DEG = Math.PI / 180;
const CUT = -18 * DEG;
const NB = ' ';

const CARDS = [
  { bar: 12, beat: 0, durBeats: 4, text: 'Comprends tes parties.', emph: 'parties', sub: 'Prépare la suite.', style: 'slam' },
  { bar: 13, beat: 0, durBeats: 4, text: 'Ta game, décortiquée.', emph: 'décortiquée', sub: 'Stats d’équipe et détail par joueur.', style: 'slam' },
  { bar: 14, beat: 0, durBeats: 4, text: 'Objectifs. Combats.', emph: 'Combats.', sub: 'Selon les données importées.', style: 'jagged' },
  { bar: 15, beat: 0, durBeats: 4, text: `Scrim perdu${NB}? Débrief.`, emph: 'Débrief.', sub: 'Points à travailler, liés à la partie.', style: 'stamp', sceneDrawn: true, color: '#d946ef' },
];

// ------------------------------------------------------------------ real UI crops (source pixels)
const STATS = 'ui-match-stats.png';
const SCREENS = {
  team: { parts: [{ file: STATS, src: [80, 50, 1480, 590] }, { file: STATS, src: [80, 1222, 1480, 190] }], w: 860 },
  players: { parts: [{ file: STATS, src: [80, 1468, 1795, 832] }], w: 880 },
  tl1200: { parts: [{ file: 'ui-match-timeline-1200.png', src: [130, 600, 1660, 840] }], w: 1240 },
  tl2100: { parts: [{ file: 'ui-match-timeline.png', src: [130, 600, 1660, 840] }], w: 1240 },
  tl3345: { parts: [{ file: 'ui-match-timeline-3345.png', src: [130, 600, 1660, 840] }], w: 1240 },
  elim: { parts: [{ file: 'ui-match-timeline.png', src: [1440, 372, 340, 178] }], w: 300 },
  debrief: { parts: [{ file: 'ui-debrief.png', src: [90, 60, 1430, 1050] }, { file: 'ui-debrief.png', src: [90, 1290, 1430, 115], gap: 30 }], w: 740 },
};
const bmpOf = (K, k) => screenBitmap(K, `S04-${k}`, SCREENS[k].parts, SCREENS[k].w);

// timeline (source px of the timeline screenshots)
const TL = {
  x: (min) => 202 + (min / 33.75) * (1712 - 202),
  y: { top: 885, bottom: 1160 },
  p1200: [740, 1093],
  p2100: [1140, 1048],
  p3345: [1712, 918],
  dragon: [1100, 1066],
  nashor: [1478, 976],
};

// ------------------------------------------------------------------ helpers
function brandBug(ctx, K) {
  K.logo(ctx, 1772, 62, 150, { alpha: 0.55, glow: 2 });
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

/** Region ahead of (rightward of) a -18° band whose centre crosses the frame centre line at x = bx. */
function aheadOfBand(ctx, bx, ahead) {
  // band lines are perpendicular-ish slashes: we use lines at angle (90° - 18°) through (bx, 540)
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

/** The persona split background (−18° cut through the centre). */
function splitBackground(ctx, f, K, lt) {
  const { C, rgba, E, clamp, seg } = K;
  // upper-left: night (one radial fill + a breathing cyan/violet glow) + cyan halftone 10 %
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
  // lower-right: fuchsia -> violet with ink dots (r = 2 + 6·kick)
  const dim = lt < L(13) - 0.1 ? 1 : 0.62; // calmer behind the UI
  ctx.save();
  halfPlane(ctx, false);
  ctx.clip();
  const g = ctx.createLinearGradient(960, 540, 1700, 1200);
  g.addColorStop(0, mix(C.fuchsia2, '#1a1033', 1 - dim));
  g.addColorStop(1, mix(C.violet, '#1a1033', 1 - dim));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1920, 1080);
  // reese stripes: 8th-note steps
  const e8 = f.beat * 2;
  const step = Math.floor(e8) + E.outExpo(clamp((e8 % 1) * 3));
  ctx.save();
  ctx.translate(960, 540);
  ctx.rotate(CUT);
  const off = (step * 22) % 140;
  ctx.fillStyle = rgba('#ffffff', 0.07);
  for (let y = -900 + off; y < 900; y += 140) ctx.fillRect(-1600, y, 3200, 26);
  ctx.restore();
  // ink halftone dots, pulsing on the kicks (+ snare spike)
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
      const gx = ctx.createLinearGradient(x - d - 420, 0, x - d, 0);
      gx.addColorStop(0, 'rgba(255,255,255,0)');
      gx.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = gx;
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
  void seg;
}

/** Lower-third card with its P5 plate (renderCards for the text). */
function cardWithPlate(ctx, f, K, idx, y) {
  const { E, seg, clamp } = K;
  const c = f.cardsOf[idx];
  const t0 = L(c.bar, c.beat);
  const d = c.durBeats * BEAT;
  const lt = f.lt - t0;
  if (lt < 0 || lt > d) return;
  const pw = K.measure(ctx, c.text, Math.min(150, K.fitSize(ctx, c.text, 1500, 150)), K.F.anton);
  const pIn = E.outExpo(clamp(lt / 0.18));
  const out = seg(lt, d - BEAT * 0.25, d);
  const cy = y - 54 * 0.7;
  ctx.save();
  ctx.globalAlpha *= 1 - E.inQuad(out);
  plate(ctx, K, 960 - pw / 2 - 110, cy - 92, 960 + pw / 2 + 70, cy + 196, { p: pIn, alpha: 0.86 });
  ctx.restore();
  K.renderCards(ctx, f, f.cardsOf, { y, size: 150, subSize: 54, maxW: 1500, skip: (cc, i) => i !== idx });
}

/** Corner brackets around a projected rectangle (bitmap coords of a screen). */
function brackets(ctx, K, o, bmp, rect, p, color) {
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
  ctx.lineWidth = 4;
  ctx.lineCap = 'square';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const a = project(o, cx + sx * hw, cy + sy * hh - 0);
    const b = project(o, cx + sx * hw - sx * arm, cy + sy * hh);
    const c = project(o, cx + sx * hw, cy + sy * hh - sy * arm);
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
  }
  // soft fill flash
  const tl = project(o, cx - hw, cy - hh);
  const tr = project(o, cx + hw, cy - hh);
  const br = project(o, cx + hw, cy + hh);
  const bl = project(o, cx - hw, cy + hh);
  ctx.fillStyle = rgba(color || C.cyan, 0.16 * (1 - e));
  ctx.beginPath();
  ctx.moveTo(tl[0], tl[1]);
  ctx.lineTo(tr[0], tr[1]);
  ctx.lineTo(br[0], br[1]);
  ctx.lineTo(bl[0], bl[1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  void bmp;
}

/** Tab label pill (Russo). */
function tabLabel(ctx, K, str, x, y, opts = {}) {
  const { C, rgba } = K;
  const { color = C.cyan, alpha = 1, active = false, size = 26 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const w = K.measure(ctx, str, size, K.F.russo, 2) + 30;
  ctx.fillStyle = active ? color : rgba(C.ink, 0.8);
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
  ctx.lineCap = 'round';
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
  ctx.strokeStyle = rgba(C.violet2, 0.85);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-15 * s, -15 * s, 30 * s, 30 * s);
  if (p > 0) {
    ctx.fillStyle = rgba(C.cyan, 0.18);
    ctx.fillRect(-15 * s, -15 * s, 30 * s, 30 * s);
    const pts = [[-9, 1], [-2, 9], [12, -10]];
    const segs = [Math.hypot(7, 8), Math.hypot(14, 19)];
    const total = segs[0] + segs[1];
    let len = total * clamp(p);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 5 * s;
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

    splitBackground(ctx, f, K, lt);

    // ============================================================ BAR 12 — logo slam
    const bandT0 = L(12, 3.2);
    const bandDur = BAR * 0.2;
    const bandQ = seg(lt, bandT0, bandT0 + bandDur);
    const bandX = -500 + E.inOutCubic(bandQ) * 2900; // centre-line crossing of the slash band
    if (lt < bandT0 + bandDur) {
      ctx.save();
      if (bandQ > 0) {
        aheadOfBand(ctx, bandX, true);
        ctx.clip();
      }
      // shockwaves (cyan + white)
      if (lt < 0.8) {
        K.shockwave(ctx, 960, 370, lt / 0.8, { color: C.cyan, maxR: 1400, sparks: 12, seed: 5 });
        K.shockwave(ctx, 960, 370, (lt - 0.07) / 0.8, { color: '#ffffff', maxR: 1250, sparks: 12, seed: 9 });
      }
      // logo plate
      const pp = E.outExpo(clamp(lt / 0.2));
      plate(ctx, K, 360, 232, 1540, 506, { p: pp, alpha: 0.82 });
      const sl = (2.5 - 1.5 * E.outExpo(clamp(lt / 0.25))) * (1 + 0.035 * seg(lt, 0.25, L(13)));
      const glow = 24 + 30 * (lt < L(13) ? f.kick : 0);
      ctx.save();
      ctx.translate(960, 370);
      ctx.scale(sl, sl);
      K.logo(ctx, 0, 0, 1000, {
        draw: E.outCubic(clamp(lt / (BEAT * 2))),
        fill: 0.22 * seg(lt, 0.55, 0.95),
        glow,
        lineWidth: 14,
      });
      ctx.restore();
      // glint sweeping across the logo plate on beats 1 and 3
      const gq = seg(lt, L(12, 1), L(12, 1) + 0.35) || 0;
      const gq2 = seg(lt, L(12, 3), L(12, 3) + 0.35);
      for (const q of [gq, gq2]) {
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
      ctx.restore();
    }

    // ============================================================ SCREENS
    const bTeam = bmpOf(K, 'team');
    const bPlay = bmpOf(K, 'players');
    // ---- bar 13: team (A) + players (B)
    const t13 = L(13);
    const exit13 = seg(lt, L(13, 3.5), L(14)); // whip out into the timeline
    if (lt >= t13 - 0.02 && exit13 < 1) {
      const xe = E.inCubic(exit13);
      const aIn = clamp((lt - t13) / 0.3);
      const eA = E.outExpo(aIn);
      const focusB = seg(lt, L(13, 3), L(13, 3) + 0.15);
      const oA = {
        cx: 545 - xe * 900, cy: 330, w: bTeam.w, h: bTeam.h,
        rotY: 0.2 + (1 - eA) * 0.55 + xe * 0.5, roll: -0.012, scale: (1.18 - 0.18 * eA) * (1 + 0.02 * seg(lt, t13, L(14))),
        alpha: clamp(aIn * 3) * (1 - xe), reveal: E.outCubic(clamp((lt - t13) / 0.22)), glare: seg(lt, t13 + 0.15, t13 + 0.8), frame: C.cyan,
      };
      drawScreen(ctx, K, bTeam, oA);
      // "+4 000 or" bracket (13.1.5) and vision / deaths (13.2.75)
      brackets(ctx, K, oA, bTeam, [...bTeam.map(108, 470), 352 * bTeam.s, 112 * bTeam.s], (lt - L(13, 1.5)) / 0.18);
      const [vx, vy] = bTeam.map(108, 1298, 1);
      brackets(ctx, K, oA, bTeam, [vx, vy, 232 * bTeam.s, 86 * bTeam.s], (lt - L(13, 2.75)) / 0.18, C.cyan);
      const [mx, my] = bTeam.map(992, 1298, 1);
      brackets(ctx, K, oA, bTeam, [mx, my, 96 * bTeam.s, 86 * bTeam.s], (lt - L(13, 2.75) - 0.05) / 0.18, C.fuchsia);
      // B: players, swings in on 13.2
      const tB = L(13, 2);
      if (lt >= tB - 0.02) {
        const bIn = clamp((lt - tB) / 0.3);
        const eB = E.outExpo(bIn);
        const oB = {
          cx: 1345 + (1 - eB) * 420 + xe * 900, cy: 448, w: bPlay.w, h: bPlay.h,
          rotY: -0.2 - (1 - eB) * 0.8 - xe * 0.5, roll: 0.012, scale: 1 + 0.03 * focusB,
          alpha: clamp(bIn * 3) * (1 - xe), reveal: E.outCubic(clamp((lt - tB) / 0.3)), glare: seg(lt, L(13, 3), L(13, 3) + 0.5), frame: C.violet2,
        };
        drawScreen(ctx, K, bPlay, oB);
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
      // tabs ÉQUIPE | JOUEUR (Russo 26, 60 % until active)
      const ta = clamp((lt - t13) / 0.2) * (1 - xe);
      const wE = tabLabel(ctx, K, 'ÉQUIPE', 128, 86, { alpha: ta * (focusB > 0.5 ? 0.6 : 1), active: focusB <= 0.5 });
      tabLabel(ctx, K, 'JOUEUR', 128 + wE + 8, 86, { alpha: ta * (focusB > 0.5 ? 1 : 0.6), active: focusB > 0.5, color: C.cyan });
    }

    // ---- bar 14: timeline (T), then bar 15: PARTIE tile
    const t14 = L(14);
    const t15 = L(15);
    let oT = null;
    let bT = null;
    if (lt >= t14) {
      bT = bmpOf(K, lt >= L(14, 3) ? 'tl3345' : lt >= L(14, 2) ? 'tl2100' : 'tl1200');
      const tIn = clamp((lt - t14) / 0.26);
      const eT = E.outExpo(tIn);
      const shrink = E.outExpo(clamp((lt - t15) / 0.32));
      oT = {
        cx: K.lerp(960, 560, shrink), cy: K.lerp(392, 372, shrink), w: bT.w, h: bT.h,
        rotY: K.lerp(-0.5 * (1 - eT) - 0.06, 0.16, shrink), roll: K.lerp(0, -0.02, shrink),
        scale: K.lerp(1.2 - 0.2 * eT + 0.025 * seg(lt, t14, t15), 0.46, shrink),
        alpha: clamp(tIn * 4), reveal: E.outCubic(tIn * 1.4), glare: lt < t15 ? seg(lt, t14 + 0.1, t14 + 0.9) : seg(lt, t15 + 0.1, t15 + 0.7), frame: C.cyan,
        glow: 0.6,
      };
      drawScreen(ctx, K, bT, oT);
      const P = (x, y) => project(oT, ...bT.map(x, y));
      ctx.save();
      // overlays appear with the screen (slightly ahead, so the original hex glyphs always cover the
      // screenshot's objective icons)
      ctx.globalAlpha *= clamp(tIn * 8);
      // playhead: 0 -> 12:00 (14.0), -> 21:00 (14.2), -> 33:45 (14.3)
      const moves = [[t14, TL.x(0), TL.p1200[0]], [L(14, 2), TL.p1200[0], TL.p2100[0]], [L(14, 3), TL.p2100[0], TL.p3345[0]]];
      let phx = TL.x(0);
      for (const [tm, a, b] of moves) if (lt >= tm) phx = K.lerp(a, b, E.outExpo(clamp((lt - tm) / 0.22)));
      if (lt < t15 + 0.2) {
        const fade = 1 - seg(lt, t15, t15 + 0.2);
        const top = P(phx, TL.y.top - 10);
        const bot = P(phx, TL.y.bottom + 6);
        ctx.save();
        ctx.globalAlpha *= fade;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(top[0], top[1], bot[0], bot[1]);
        g.addColorStop(0, rgba(C.cyan, 0));
        g.addColorStop(0.5, rgba(C.cyan, 0.9));
        g.addColorStop(1, rgba(C.cyan, 0.2));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(bot[0], bot[1]);
        ctx.stroke();
        ctx.lineWidth = 16;
        ctx.globalAlpha *= 0.25;
        ctx.stroke();
        ctx.restore();
      }
      // hits: 12:00 pulse (14.0), Dragon (14.2), Nashor (14.3) — light beam + ring + original hex marker
      const hits = [
        { t: t14 + 0.06, p: TL.p1200, hex: false },
        { t: L(14, 2) + 0.06, p: TL.dragon, hex: true },
        { t: L(14, 3) + 0.06, p: TL.nashor, hex: true },
      ];
      hits.forEach((hh, i) => {
        const q = lt - hh.t;
        const [x, y, k] = P(...hh.p);
        if (q >= 0 && q < 0.5) {
          ringBurst(ctx, K, x, y, q / 0.5, { maxR: 80 * k * 1.3, color: C.cyan });
          // short vertical light beam
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
      // the gold-gap number updates with the scrub: bracket it on each swap
      if (lt < t15) {
        brackets(ctx, K, oT, bT, [...bT.map(140, 612), 440 * bT.s, 96 * bT.s], (lt - L(14, 2)) / 0.16, C.cyan);
        brackets(ctx, K, oT, bT, [...bT.map(140, 612), 440 * bT.s, 96 * bT.s], lt >= L(14, 3) ? (lt - L(14, 3)) / 0.16 : 0, C.cyan);
      }
      // eliminations tile (real) + fuchsia fight glyph — 14.1 and 14.2.5
      const bE = bmpOf(K, 'elim');
      const tE = L(14, 1);
      if (lt >= tE && lt < t15 + 0.12) {
        const eIn = clamp((lt - tE) / 0.22);
        const out = E.inCubic(seg(lt, L(14, 3.5), t15));
        const pulse = Math.exp(-Math.max(0, lt - L(14, 2.5)) * 10) * (lt >= L(14, 2.5) ? 1 : 0);
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
      ctx.restore();
      // PARTIE tab on the tile
      if (lt >= t15) {
        const [px, py] = project(oT, 0, 0);
        tabLabel(ctx, K, 'PARTIE', px + 4, py - 30, { alpha: clamp((lt - t15) / 0.2), active: true, color: C.cyan });
      }
    }

    // ---- bar 15: debrief (real) + ticks + connector
    if (lt >= t15 - 0.02) {
      const bD = bmpOf(K, 'debrief');
      const dIn = clamp((lt - t15) / 0.34);
      const eD = E.outExpo(dIn);
      const oD = {
        cx: 1268 + (1 - eD) * 760, cy: 394, w: bD.w, h: bD.h,
        rotY: -0.14 - (1 - eD) * 0.7, roll: 0.01, scale: 1 + 0.02 * seg(lt, t15, L(16)), alpha: clamp(dIn * 3), reveal: 1,
        glare: seg(lt, t15 + 0.2, t15 + 1.1), frame: C.violet,
      };
      drawScreen(ctx, K, bD, oD);
      // violet DÉBRIEF tag (top-right, empty area of the screenshot)
      const [tx, ty] = project(oD, bD.w - 200, 26);
      tabLabel(ctx, K, 'DÉBRIEF', tx, ty, { alpha: clamp(dIn * 3), active: true, color: C.violet });
      // ticks on 15.1 (snare), 15.2 (kick), 15.3 (snare), next to the three steps
      [[408, L(15, 1)], [663, L(15, 2)], [920, L(15, 3)]].forEach(([sy, tt], i) => {
        const [x, y, k] = project(oD, ...bD.map(1400, sy));
        ctx.save();
        ctx.globalAlpha *= clamp(dIn * 2);
        check(ctx, K, x, y, k * 1.15, (lt - tt) / 0.1);
        ctx.restore();
        if (lt >= tt) sparks(ctx, K, x, y, (lt - tt) / 0.35, 50 + i, C.cyan);
      });
      // connector: « Revoir la partie source » -> Dragon objective on the PARTIE tile (15.2.75)
      const tc = L(15, 2.75);
      if (lt >= tc && oT && bT) {
        const cp = E.outCubic(clamp((lt - tc) / 0.14));
        const a = project(oD, ...bD.map(122, 1348, 1));
        const b = project(oT, ...bT.map(...TL.dragon));
        const p0 = [a[0] - 6, a[1]];
        const p3 = [b[0], b[1] + 18];
        const p1 = [p0[0] - 220, p0[1] + 10];
        const p2 = [p3[0] + 60, p3[1] + 260];
        const N = 40;
        const n = Math.max(2, Math.round(N * cp));
        ctx.save();
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const q = bez(p0, p1, p2, p3, (i / N));
          i ? ctx.lineTo(...q) : ctx.moveTo(...q);
        }
        ctx.strokeStyle = rgba(C.ink, 0.8);
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(C.cyan, 0.2);
        ctx.lineWidth = 16;
        ctx.stroke();
        // light pulses running along it
        if (cp >= 1) {
          for (let k = 0; k < 3; k++) {
            const u = ((lt - tc) * 2.2 + k / 3) % 1;
            const q = bez(p0, p1, p2, p3, u);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(q[0], q[1], 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
        // chain-link glyph at the midpoint
        if (cp > 0.5) {
          const m = bez(p0, p1, p2, p3, 0.5);
          const e = E.outBack(clamp((cp - 0.5) * 2), 2);
          ctx.save();
          ctx.translate(m[0], m[1]);
          ctx.rotate(-0.6);
          ctx.scale(e, e);
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
        if (lt - tc < 0.45) ringBurst(ctx, K, p3[0], p3[1] - 18, (lt - tc - 0.1) / 0.35, { color: C.cyan, maxR: 70 });
      }
    }

    // ============================================================ slash band 12.3.2 (fuchsia, cyan edge)
    if (bandQ > 0 && bandQ < 1) {
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
    cardWithPlate(ctx, f, K, 0, 820);
    cardWithPlate(ctx, f, K, 1, 870);
    cardWithPlate(ctx, f, K, 2, 870);
    // bar 15 stamp (scene-drawn: emph colour + flatter angle so it clears the sub pill)
    {
      const c = f.cardsOf[3];
      const t0 = L(c.bar, c.beat);
      const d = c.durBeats * BEAT;
      const q = lt - t0;
      if (q >= 0 && q <= d + 0.2) {
        const out = seg(q, d - BEAT * 0.25, d);
        ctx.save();
        ctx.globalAlpha *= 1 - E.inQuad(out);
        const p = clamp(q / (BEAT * 0.5));
        const e = E.outExpo(p);
        const sz = 104;
        const cy = 826;
        plate(ctx, K, 330, 740, 1560, 1022, { p: E.outExpo(clamp(q / 0.18)), alpha: 0.86, edge: C.fuchsia2, edge2: C.cyan });
        ctx.save();
        ctx.globalAlpha *= clamp(p * 3);
        ctx.translate(960, cy);
        ctx.rotate(-0.05);
        const s = 2.2 - 1.2 * e;
        ctx.scale(s, s);
        const str = c.text.toUpperCase();
        const tw = K.measure(ctx, str, sz, K.F.bebas, 5);
        const w = tw + sz * 0.7;
        const h = sz * 1.25;
        ctx.strokeStyle = C.fuchsia2;
        ctx.lineWidth = sz * 0.08;
        K.roundRect(ctx, -w / 2, -h / 2, w, h, sz * 0.1);
        ctx.stroke();
        ctx.strokeStyle = rgba(C.fuchsia2, 0.3);
        ctx.lineWidth = sz * 0.2;
        ctx.stroke();
        K.text(ctx, str, 0, sz * 0.04, { size: sz, font: K.F.bebas, color: C.fuchsia, emph: 'DÉBRIEF.', emphColor: C.cyan, spacing: 5 });
        ctx.restore();
        subPill(ctx, K, c.sub, 960, 962, E.outCubic(seg(q, BEAT * 0.4, BEAT * 1.2)));
        ctx.restore();
      }
    }

    brandBug(ctx, K);
    return { shake: 0 };
  },
};
