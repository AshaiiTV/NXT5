// S05 — DROP 1, draft lock-in (bars 16–20).
// VS tear down the middle, 10 original hex slots locked one per beat in pro snake order,
// then the ally pool per role (declared mastery pips) and three filter chips that only dim
// options (nothing is ranked or crowned). Pure function of f; only static geometry is cached.

const NB = ' ';
const BEAT = 0.4;

// French typography: U+00A0 before « ? » and « : » (script.json cards use plain spaces).
const CARDS = [
  { bar: 16, beat: 0, durBeats: 8, text: 'Cinq picks. Une intention.', emph: 'intention', sub: 'Compos à cinq, préparées ensemble.', style: 'jagged' },
  { bar: 18, beat: 0, durBeats: 4, text: 'Ton pool, par rôle.', emph: 'pool', sub: 'Champions et maîtrise déclarée.', style: 'slam' },
  { bar: 19, beat: 0, durBeats: 4, text: `Contre qui${NB}? Quel patch${NB}?`, emph: 'patch', sub: `Filtre${NB}: rôle, champion adverse, patch.`, style: 'slam' },
];

// ------------------------------------------------------------------ static layout
const YS = [140, 270, 400, 530, 660];
const AX = 400;
const EX = 1520;
const HR = 54;
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
// pro snake order: A1, E1, E2, A2, A3, E3, E4, A4, A5, E5 — one per beat from 16.0
const ORDER = [['A', 0], ['E', 0], ['E', 1], ['A', 1], ['A', 2], ['E', 2], ['E', 3], ['A', 3], ['A', 4], ['E', 4]];
const LOCK_BEAT = {}; // "A0" -> absolute beat index from bar 16 beat 0
ORDER.forEach(([s, k], n) => (LOCK_BEAT[s + k] = n));

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

// Vertical zigzag tear: 12 vertices, ±40 px.
const TEAR = (() => {
  const R = mulberry(51);
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const y = -40 + (i * 1160) / 11;
    const side = i % 2 ? 1 : -1;
    pts.push([side * (24 + 16 * R()), y]);
  }
  return pts;
})();

// Original rune glyphs (never champion art): a centre primitive, mirrored flanks, an accent.
const CENTRES = ['diamond', 'circdot', 'tri', 'trid', 'hexlet', 'slash'];
const FLANKS = ['chev', 'chevin', 'bars', 'wings', 'dots'];
const ACCENTS = ['topbar', 'botchev', 'spike', 'crown0'];
function glyphSpec(seed) {
  const R = mulberry(seed);
  const ops = [CENTRES[Math.floor(R() * CENTRES.length)]];
  const nf = 1 + Math.floor(R() * 2);
  const fl = [...FLANKS];
  for (let i = 0; i < nf; i++) ops.push(fl.splice(Math.floor(R() * fl.length), 1)[0]);
  const na = Math.floor(R() * 2) + (ops.length < 3 ? 1 : 0);
  const ac = ACCENTS.filter((a) => a !== 'crown0');
  for (let i = 0; i < na; i++) ops.push(ac.splice(Math.floor(R() * ac.length), 1)[0]);
  return ops.slice(0, 5);
}
const GLYPHS = Array.from({ length: 10 }, (_, i) => glyphSpec(300 + i * 17));

function glyphPath(ctx, op, s) {
  ctx.beginPath();
  switch (op) {
    case 'diamond':
      ctx.moveTo(0, -0.5 * s); ctx.lineTo(0.34 * s, 0); ctx.lineTo(0, 0.5 * s); ctx.lineTo(-0.34 * s, 0); ctx.closePath();
      break;
    case 'circdot':
      ctx.arc(0, 0, 0.3 * s, 0, Math.PI * 2);
      ctx.moveTo(0.08 * s, 0);
      ctx.arc(0, 0, 0.08 * s, 0, Math.PI * 2);
      break;
    case 'tri':
      ctx.moveTo(0, -0.42 * s); ctx.lineTo(0.38 * s, 0.3 * s); ctx.lineTo(-0.38 * s, 0.3 * s); ctx.closePath();
      break;
    case 'trid':
      ctx.moveTo(0, 0.42 * s); ctx.lineTo(0.38 * s, -0.3 * s); ctx.lineTo(-0.38 * s, -0.3 * s); ctx.closePath();
      break;
    case 'hexlet':
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        const px = Math.cos(a) * 0.36 * s;
        const py = Math.sin(a) * 0.36 * s;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.moveTo(0, -0.12 * s); ctx.lineTo(0, 0.12 * s);
      break;
    case 'slash':
      ctx.moveTo(-0.3 * s, 0.4 * s); ctx.lineTo(0.3 * s, -0.4 * s);
      ctx.moveTo(-0.05 * s, 0.4 * s); ctx.lineTo(0.42 * s, -0.22 * s);
      break;
    case 'chev':
      for (const d of [-1, 1]) {
        ctx.moveTo(d * 0.5 * s, -0.3 * s); ctx.lineTo(d * 0.74 * s, 0); ctx.lineTo(d * 0.5 * s, 0.3 * s);
      }
      break;
    case 'chevin':
      for (const d of [-1, 1]) {
        ctx.moveTo(d * 0.76 * s, -0.3 * s); ctx.lineTo(d * 0.52 * s, 0); ctx.lineTo(d * 0.76 * s, 0.3 * s);
      }
      break;
    case 'bars':
      for (const d of [-1, 1]) {
        ctx.moveTo(d * 0.56 * s, -0.36 * s); ctx.lineTo(d * 0.56 * s, 0.36 * s);
      }
      break;
    case 'wings':
      for (const d of [-1, 1]) {
        ctx.moveTo(d * 0.46 * s, 0.28 * s);
        ctx.quadraticCurveTo(d * 0.8 * s, 0.05 * s, d * 0.66 * s, -0.42 * s);
      }
      break;
    case 'dots':
      for (const d of [-1, 1]) {
        ctx.moveTo(d * 0.62 * s + 0.06 * s, 0);
        ctx.arc(d * 0.62 * s, 0, 0.06 * s, 0, Math.PI * 2);
      }
      break;
    case 'topbar':
      ctx.moveTo(-0.3 * s, -0.72 * s); ctx.lineTo(0.3 * s, -0.72 * s);
      break;
    case 'botchev':
      ctx.moveTo(-0.3 * s, 0.6 * s); ctx.lineTo(0, 0.8 * s); ctx.lineTo(0.3 * s, 0.6 * s);
      break;
    case 'spike':
      ctx.moveTo(0, -0.92 * s); ctx.lineTo(0, -0.62 * s);
      ctx.moveTo(0, 0.62 * s); ctx.lineTo(0, 0.92 * s);
      break;
    default:
      break;
  }
}

// Ally pool: 3 small hexes per role, 1–3 declared-mastery pips each.
const POOL = (() => {
  const R = mulberry(77);
  return YS.map(() => [0, 1, 2].map(() => ({ pips: 1 + Math.floor(R() * 3), glyph: CENTRES[Math.floor(R() * CENTRES.length)] })));
})();
// Filter toggles (19.0 / 19.1.5 / 19.2), true to DraftAssistance (src/utils/draft-assistance.js):
// « Poste à préparer » selects a role (MID row in focus), « Champion adverse » excludes at most that one
// champion from the pool (+ starts the reticle on E3), « Patch des parties » only re-scopes which games
// feed the results (scan over the mastery pips; nothing is removed). Nothing is ranked or crowned.
const POOL_X0 = 500;
const POOL_DX = 84;
const POOL_R = 36;
const FOCUS_ROW = 2;
const BANNED = [FOCUS_ROW, 0]; // the MID pool hex that is the same champion as the enemy pick
const FILTERS = [
  { label: 'Rôle', beat: 0, target: 'role' },
  { label: 'Champion adverse', beat: 1.5, target: 'ban' },
  { label: 'Patch', beat: 2, target: 'pips' },
];
const CHIP_SIZE = 34;
const CHIP_H = 64;
const CHIP_Y = 96;
const CHIP_CX = 1060; // right of centre so the chips clear the TOP pool row (pool hexes end at x≈700)
const poolX = (j) => POOL_X0 + POOL_DX * j;

// ------------------------------------------------------------------ drawing helpers
/** Column bounce: 5 px on each kick, 0.08 s decay (slots, streaks and pool only; labels stay put). */
const bounce = (f) => (f.lt < 0 ? 0 : 5 * f.env('kick', 12.5));

function hexPts(x, y, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}

function drawBackground(ctx, f, K, rip) {
  const { C, rgba } = K;
  K.background(ctx, f, { warm: 0.4, intensity: 1.05 });
  // reese-stepped −18° stripes: they jump on every 8th note and ease between steps
  const step = f.lt / (BEAT / 2);
  const st = Math.floor(step) + K.E.outExpo(Math.min(1, (step - Math.floor(step)) * 3));
  ctx.save();
  ctx.translate(960, 540);
  ctx.rotate(-0.314);
  ctx.fillStyle = rgba(C.violet2, 0.055);
  const off = ((st * 26) % 170 + 170) % 170;
  for (let i = -9; i <= 9; i++) ctx.fillRect(-1400 + i * 170 + off, -1200, 64, 2400);
  ctx.restore();
  K.halftone(ctx, f, { color: C.violet, alpha: 0.2 + f.snare * 0.12, angle: -0.314, band: [0.56, 0.9], maxR: 5, spacing: 16 });
  // team tints, split along the tear
  const gap = rip;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -40);
  TEAR.forEach(([x, y]) => ctx.lineTo(960 + x - gap / 2, y));
  ctx.lineTo(0, 1120);
  ctx.closePath();
  const gl = ctx.createLinearGradient(0, 0, 960, 0);
  gl.addColorStop(0, rgba(C.cyan2, 0.1));
  gl.addColorStop(1, rgba(C.cyan2, 0.05));
  ctx.fillStyle = gl;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W0, -40);
  TEAR.forEach(([x, y]) => ctx.lineTo(960 + x + gap / 2, y));
  ctx.lineTo(W0, 1120);
  ctx.closePath();
  const gr = ctx.createLinearGradient(1920, 0, 960, 0);
  gr.addColorStop(0, rgba(C.fuchsia2, 0.1));
  gr.addColorStop(1, rgba(C.fuchsia2, 0.05));
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.restore();
}
const W0 = 1920;

function strokeEdge(ctx, side, gap) {
  ctx.beginPath();
  TEAR.forEach(([x, y], i) => (i ? ctx.lineTo(960 + x + (side * gap) / 2, y) : ctx.moveTo(960 + x + (side * gap) / 2, y)));
  ctx.stroke();
}

/** Persona « VS » splash on 16.0: slams 2.2× -> 1 in 0.15 s at full white with cyan / fuchsia copies, then settles to 40 %. */
function drawVS(ctx, f, K, gap) {
  const { C, rgba, seg, E, lerp } = K;
  const lt = f.lt;
  const ks = E.outExpo(seg(lt, 0, 0.15));
  const sc = lerp(2.2, 1, ks);
  const settle = E.inOutCubic(seg(lt, 0.15, BEAT));
  const a = lerp(1, 0.4, settle) * Math.min(1, gap / 40);
  const split = 6 * (1 - settle * 0.85);
  ctx.save();
  ctx.translate(960, 420);
  ctx.scale(sc, sc);
  const o = { size: 120, font: K.F.russo, spacing: 4 };
  if (split > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.text(ctx, 'VS', -split, 0, { ...o, color: rgba(C.cyan2, 0.85), alpha: a });
    K.text(ctx, 'VS', split, 0, { ...o, color: rgba(C.fuchsia2, 0.85), alpha: a });
    ctx.restore();
  }
  K.text(ctx, 'VS', 0, 0, { ...o, color: '#ffffff', alpha: a });
  ctx.restore();
}

/**
 * Per-lock splash (behind the slots): the role word slashes in from the tear at 7 %, and the locked rune
 * glyph blooms huge in that team's half (additive, −18° skew), for half a beat.
 */
const SKEW = -Math.tan(0.314);
function drawLockSplash(ctx, f, K) {
  const { C, rgba, seg, E, lerp, clamp } = K;
  ORDER.forEach(([s, k], n) => {
    const d = f.lt - n * BEAT;
    if (d < 0 || d > BEAT * 0.5) return;
    const ally = s === 'A';
    const col = ally ? C.cyan2 : C.fuchsia2;
    const cx = ally ? 680 : 1240;
    const cy = clamp(YS[k], 220, 600);
    // role word, out of the tear (clipped to its team half)
    const kw = E.outExpo(seg(d, 0, 0.12));
    ctx.save();
    ctx.beginPath();
    if (ally) ctx.rect(0, 0, 930, 1080);
    else ctx.rect(990, 0, 930, 1080);
    ctx.clip();
    ctx.translate(lerp(ally ? 1080 : 840, cx, kw), cy);
    ctx.transform(1, 0, SKEW, 1, 0, 0);
    K.text(ctx, ROLES[k], 0, 0, { size: 200, font: K.F.anton, color: C.text, alpha: 0.07 * (1 - E.inQuad(seg(d, 0.1, BEAT * 0.5))), spacing: 6 });
    ctx.restore();
    // giant glyph
    const kg = clamp(d / 0.2);
    const a = 0.2 * (1 - kg);
    if (a <= 0.003) return;
    const sc = lerp(0.85, 1.15, E.outExpo(kg));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.transform(1, 0, SKEW, 1, 0, 0);
    ctx.scale(sc, sc);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [lw, c, aa] of [[30, col, a * 0.7], [11, '#ffffff', a]]) {
      ctx.strokeStyle = rgba(c, aa);
      ctx.lineWidth = lw;
      for (const op of GLYPHS[n]) {
        glyphPath(ctx, op, 220);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

function drawTear(ctx, f, K, gap, flare, edgeFlash, sideFlash = { A: 0, E: 0 }) {
  const { C, rgba } = K;
  ctx.save();
  if (gap > 0.5) {
    // rip interior: ink with a violet core glow
    ctx.beginPath();
    TEAR.forEach(([x, y], i) => (i ? ctx.lineTo(960 + x - gap / 2, y) : ctx.moveTo(960 + x - gap / 2, y)));
    for (let i = TEAR.length - 1; i >= 0; i--) ctx.lineTo(960 + TEAR[i][0] + gap / 2, TEAR[i][1]);
    ctx.closePath();
    ctx.fillStyle = C.ink;
    ctx.fill();
    const g = ctx.createLinearGradient(960 - gap, 0, 960 + gap, 0);
    g.addColorStop(0, rgba(C.violet, 0));
    g.addColorStop(0.5, rgba(C.violet, 0.16 + 0.12 * flare));
    g.addColorStop(1, rgba(C.violet, 0));
    ctx.fillStyle = g;
    ctx.fill();
    drawVS(ctx, f, K, gap);
  }
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  const gw = 1 + flare; // snare flares the glow to 2×
  const sides = gap > 0.5 ? [-1, 1] : [0];
  ctx.globalCompositeOperation = 'lighter';
  for (const s of sides) {
    ctx.strokeStyle = rgba(C.violet, 0.1);
    ctx.lineWidth = 24 * gw;
    strokeEdge(ctx, s, gap);
    ctx.strokeStyle = rgba(C.violet, 0.22);
    ctx.lineWidth = 11 * gw;
    strokeEdge(ctx, s, gap);
    ctx.strokeStyle = rgba(C.violet2, 0.55);
    ctx.lineWidth = 5;
    strokeEdge(ctx, s, gap);
    // team-coloured flare on the edge facing the hex that just locked
    const sf = s < 0 ? sideFlash.A : s > 0 ? sideFlash.E : 0;
    if (sf > 0) {
      ctx.strokeStyle = rgba(s < 0 ? C.cyan2 : C.fuchsia2, 0.5 * sf);
      ctx.lineWidth = 16;
      strokeEdge(ctx, s, gap);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const s of sides) {
    ctx.strokeStyle = gap > 0.5 || f.lt >= 0 ? '#ffffff' : rgba(C.text, 0.75);
    ctx.lineWidth = 3 + edgeFlash * 5;
    strokeEdge(ctx, s, gap);
  }
  ctx.restore();
}

/** Lock beams: a light streak shoots from the locked hex toward the tear, and that tear edge flares. */
function lockFlares(f) {
  const out = { A: 0, E: 0 };
  ORDER.forEach(([s], n) => {
    const d = f.lt - n * BEAT;
    if (d >= 0 && d < 0.4) out[s] = Math.max(out[s], 1 - d / 0.4);
  });
  return out;
}
function drawStreaks(ctx, f, K, dimE) {
  const { C, rgba, E } = K;
  ORDER.forEach(([s, k], n) => {
    const d = f.lt - n * BEAT;
    if (d < 0 || d > 0.36) return;
    const ally = s === 'A';
    const col = ally ? C.cyan : C.fuchsia;
    const y = YS[k] - bounce(f);
    const x0 = ally ? AX + 52 : EX - 52;
    const x1 = ally ? 900 : 1020;
    const grow = E.outExpo(Math.min(1, d / 0.12));
    const fade = 1 - d / 0.36;
    const xe = x0 + (x1 - x0) * grow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= fade * (ally ? 1 : dimE);
    const g = ctx.createLinearGradient(x0, 0, xe, 0);
    g.addColorStop(0, rgba(col, 0.9));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    const x = Math.min(x0, xe);
    const w = Math.abs(xe - x0);
    ctx.fillRect(x, y - 2, w, 4);
    const g2 = ctx.createLinearGradient(x0, 0, xe, 0);
    g2.addColorStop(0, rgba(col, 0.28));
    g2.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(x, y - 16 * fade, w, 32 * fade);
    ctx.restore();
  });
}

/** On the 19.2.75 snap: a dashed cyan arc from E3 to the MID pool (done on the 19.3 snare), then the two MID
 *  options still open light up equally (filtering, never ranking) — all resolved before the star wipe covers it. */
function drawMatchLink(ctx, f, K, tRet) {
  const { C, rgba, seg, E } = K;
  const k = E.outCubic(seg(f.lt, tRet, tRet + 0.1));
  if (k <= 0) return;
  const yb = YS[FOCUS_ROW] - bounce(f);
  const p0 = [EX - 76, YS[2]];
  const pc = [980, 250];
  const p1 = [poolX(2) + POOL_R + 12, YS[2] - 10];
  const q = (t) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * pc[0] + t * t * p1[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * pc[1] + t * t * p1[1],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const [x, y] = q((i / 32) * k);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(C.cyan2, 0.25);
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([16, 10]);
  ctx.lineDashOffset = -f.lt * 220;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  const [hx, hy] = q(k);
  ctx.fillStyle = C.text;
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // the two MID options still open light up together, same treatment
  const kr = seg(f.lt, tRet + 0.1, tRet + 0.22);
  if (kr <= 0) return;
  const e = E.outCubic(kr);
  [1, 2].forEach((j) => {
    const x = poolX(j);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.hexPath(ctx, x, yb, POOL_R);
    ctx.fillStyle = rgba(C.cyan2, 0.38 * (1 - e) + 0.12);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    K.hexPath(ctx, x, yb, POOL_R + 6 + 8 * e);
    ctx.strokeStyle = rgba(C.cyan, 0.95 - 0.35 * e);
    ctx.lineWidth = 3;
    ctx.stroke();
    if (e < 1) {
      K.hexPath(ctx, x, yb, POOL_R + 6 + 30 * e);
      ctx.strokeStyle = rgba(C.cyan, 0.7 * (1 - e));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawSlot(ctx, f, K, side, k, dim, reticle, cue = 0) {
  const { C, rgba, clamp, seg, E } = K;
  const ally = side === 'A';
  const col = ally ? C.cyan2 : C.fuchsia2;
  const colL = ally ? C.cyan : C.fuchsia;
  const n = LOCK_BEAT[side + k];
  const tl = n * BEAT; // local lock time
  const x = ally ? AX : EX;
  const y = YS[k] - bounce(f); // column bounce on kicks (slots only, not the labels)
  const locked = f.lt >= tl;
  const kl = seg(f.lt, tl, tl + 0.15);
  const hover = locked ? 0 : seg(f.lt, tl - BEAT * 0.9, tl);
  ctx.save();
  ctx.globalAlpha *= dim;
  const pts = hexPts(x, y, HR);
  const path = () => K.polyPath(ctx, pts);
  // base
  path();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  if (locked) {
    const rg = ctx.createRadialGradient(x, y, 4, x, y, HR);
    rg.addColorStop(0, rgba(col, 0.32));
    rg.addColorStop(1, rgba(col, 0.06));
    ctx.fillStyle = rg;
    ctx.fill();
    // white -> team colour flash, 100% -> 0 over half a beat
    const kf = seg(f.lt, tl, tl + BEAT * 0.5);
    if (kf < 1) {
      ctx.fillStyle = rgba(col, 0.9 * (1 - E.outQuad(kf)));
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${clamp(1 - kf * 3.2)})`;
      ctx.fill();
    }
  }
  // dashed inner ring, slow rotation
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.t * 0.35 * (ally ? 1 : -1));
  ctx.setLineDash([7, 9]);
  ctx.strokeStyle = rgba(colL, locked ? 0.55 : 0.28 + hover * 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // outline: 4 -> 7 px on lock, glow
  const lw = locked ? 4 + 3 * E.outCubic(kl) : 4;
  path();
  if (locked || hover > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, locked ? 0.22 : 0.18 * hover * (0.6 + 0.4 * Math.sin(f.t * 30)));
    ctx.lineWidth = lw + 12;
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = locked ? col : rgba(col, 0.45 + 0.45 * hover);
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // 18.1 pre-cue: the ally hexes flash cyan before the pool bursts out of them
  if (cue > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    path();
    ctx.fillStyle = rgba(C.cyan2, 0.55 * cue);
    ctx.fill();
    ctx.strokeStyle = rgba(C.cyan, 0.8 * cue);
    ctx.lineWidth = lw + 14 * cue;
    ctx.stroke();
    ctx.restore();
  }
  // rune glyph pops in with easeOutBack over 0.2 s
  if (locked) {
    const kg = seg(f.lt, tl + 0.02, tl + 0.22);
    if (kg > 0) {
      const sc = E.outBack(kg, 2.6);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const ops = GLYPHS[n];
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col, 0.45);
      ctx.lineWidth = 9;
      for (const op of ops) {
        glyphPath(ctx, op, 44);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 3.5;
      for (const op of ops) {
        glyphPath(ctx, op, 44);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (!ally) {
    K.text(ctx, '?', x, y + 3, { size: 40, font: K.F.russo, color: rgba(C.fuchsia, 0.35 + 0.4 * hover) });
  }
  ctx.restore();
  // mini shockwave + 4 spark ticks
  const ks = seg(f.lt, tl, tl + 0.42);
  if (locked && ks < 1) {
    ctx.save();
    ctx.globalAlpha *= dim;
    K.shockwave(ctx, x, y, ks, { color: colL, maxR: 160, width: 12, sparks: 4, seed: 9 + n });
    ctx.restore();
  }
  if (reticle && reticle.a > 0) drawReticle(ctx, f, K, x, y, reticle);
}

/** Reticle: R.k 0..1 convergence (brackets 170 -> 74 px), R.a alpha, R.land local time of the snap. */
function drawReticle(ctx, f, K, x, y, R) {
  const { C, rgba, seg, E } = K;
  const e = R.k;
  const d = K.lerp(170, 74, e);
  const rot = f.t * 0.9 + (1 - e) * 1.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= R.a;
  ctx.lineCap = 'square';
  for (let q = 0; q < 4; q++) {
    ctx.save();
    ctx.rotate((q * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(d - 24, -d);
    ctx.lineTo(d, -d);
    ctx.lineTo(d, -d + 24);
    ctx.strokeStyle = rgba(C.cyan2, 0.3);
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // centre ring + landing flash on the snap
  ctx.save();
  ctx.globalAlpha *= R.a;
  ctx.strokeStyle = rgba(C.cyan, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 66 + 8 * (1 - e), 0, Math.PI * 2);
  ctx.stroke();
  const kl = seg(f.lt, R.land, R.land + 0.2);
  if (kl > 0 && kl < 1) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(C.cyan, 0.9 * (1 - kl));
    ctx.lineWidth = 3 + 6 * (1 - kl);
    ctx.beginPath();
    ctx.arc(x, y, 74 + 60 * E.outCubic(kl), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Filter timeline (local seconds). */
function filterTimes(f) {
  return { role: f.at(19, 0), ban: f.at(19, 1.5), pips: f.at(19, 2), ret: f.at(19, 2.75) };
}

function drawPool(ctx, f, K) {
  const { C, rgba, seg, E, lerp } = K;
  const tCue = f.at(18, 1);
  if (f.lt < tCue) return;
  const T = filterTimes(f);
  const focus = E.outCubic(seg(f.lt, T.role, T.role + 0.15));
  const ban = E.outCubic(seg(f.lt, T.ban, T.ban + 0.15));
  const scan = seg(f.lt, T.pips, T.pips + 0.24);
  const scanX = lerp(poolX(0) - 50, poolX(2) + 50, E.inOutSine(scan));
  const xEnd = 700;
  YS.forEach((y0, r) => {
    const y = y0 - bounce(f);
    const isFocus = r === FOCUS_ROW;
    const rowA = isFocus ? 1 : 1 - 0.55 * focus;
    // stem: drawn on the 18.1 snare toward x 700, the pool bursts out of it on 18.2
    const ks = E.outCubic(seg(f.lt, tCue + r * 0.03, f.at(18, 2)));
    ctx.save();
    ctx.globalAlpha *= rowA;
    const stemCol = isFocus && focus > 0 ? C.cyan : C.cyan2;
    ctx.strokeStyle = rgba(stemCol, 0.4 + (isFocus ? 0.55 * focus : 0));
    ctx.lineWidth = 2 + (isFocus ? 1.5 * focus : 0);
    ctx.beginPath();
    const sx1 = AX + 54 + (xEnd - AX - 54) * ks;
    ctx.moveTo(AX + 54, y);
    ctx.lineTo(sx1, y);
    ctx.stroke();
    if (ks > 0 && ks < 1) {
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.arc(sx1, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const tp = f.at(18, 2 + r * 0.25);
    [0, 1, 2].forEach((j) => {
      const t0 = tp + j * 0.045;
      const k = seg(f.lt, t0, t0 + 0.24);
      if (k <= 0) return;
      const tx = poolX(j);
      const x = lerp(AX + 70, tx, E.outBack(k, 1.6));
      let sc = lerp(0.3, 1, E.outBack(k, 2));
      const isBan = r === BANNED[0] && j === BANNED[1];
      let a = rowA;
      if (isBan) {
        sc *= 1 - 0.25 * ban;
        a *= 1 - 0.6 * ban;
      }
      const off = isBan && ban > 0.5;
      const cell = POOL[r][j];
      ctx.save();
      ctx.globalAlpha *= a * Math.min(1, k * 3);
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      K.hexPath(ctx, 0, 0, POOL_R);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = off ? rgba(C.muted, 0.8) : C.cyan2;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = off ? C.muted : C.text;
      ctx.lineWidth = 2.8;
      glyphPath(ctx, cell.glyph, 40);
      ctx.stroke();
      // declared mastery pips (blink once as the patch scan passes over the MID row)
      for (let p = 0; p < cell.pips; p++) {
        const px = (p - (cell.pips - 1) / 2) * 15;
        const blink = isFocus && scan > 0 && scan < 1 ? Math.max(0, 1 - Math.abs(tx + px * sc - scanX) / 26) : 0;
        ctx.fillStyle = off ? C.muted : blink > 0 ? `rgba(255,255,255,${0.6 + 0.4 * blink})` : C.cyan;
        ctx.beginPath();
        ctx.arc(px, 48, 5.5 * (1 + 0.5 * blink), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // filtered out: a thin danger-pink slash across the shrunken hex
      if (isBan && ban > 0) {
        const L = POOL_R * 0.95 * sc;
        ctx.save();
        ctx.strokeStyle = C.danger;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - L, y + L);
        ctx.lineTo(x - L + 2 * L * ban, y + L - 2 * L * ban);
        ctx.stroke();
        ctx.restore();
      }
    });
  });
  // patch: a cyan scan bar sweeps the MID pool's mastery pips (results re-scoped; nothing removed)
  if (scan > 0 && scan < 1) {
    const y = YS[FOCUS_ROW] - bounce(f) + 48;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(scanX - 60, 0, scanX, 0);
    g.addColorStop(0, rgba(C.cyan2, 0));
    g.addColorStop(1, rgba(C.cyan2, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(scanX - 60, y - 16, 60, 32);
    ctx.fillStyle = rgba(C.cyan, 0.95);
    ctx.fillRect(scanX - 1.5, y - 20, 3, 40);
    ctx.restore();
  }
}

/** Draft order HUD (top centre, bars 16–18): 10 pips in snake order, one fills per lock. */
function drawPickTrack(ctx, f, K) {
  const { C, rgba, seg, E } = K;
  const tOut = f.at(18, 2.5);
  const kOut = seg(f.lt, tOut, tOut + BEAT * 0.5);
  if (kOut >= 1 || f.lt < 0) return;
  const kIn = f.lt < 0 ? 0 : E.outExpo(seg(f.lt, 0, 0.3));
  const y = 92 - 70 * E.inCubic(kOut) - 40 * (1 - kIn);
  const step = 46;
  ctx.save();
  ctx.globalAlpha *= kIn * (1 - kOut);
  const pw = step * 10 + 34;
  K.roundRect(ctx, 960 - pw / 2, y - 24, pw, 48, 24);
  ctx.fillStyle = rgba(C.ink, 0.88);
  ctx.fill();
  ctx.strokeStyle = rgba(C.violet2, 0.45);
  ctx.lineWidth = 2;
  ctx.stroke();
  ORDER.forEach(([s], n) => {
    const ally = s === 'A';
    const col = ally ? C.cyan2 : C.fuchsia2;
    const x = 960 + (n - 4.5) * step;
    const tl = n * BEAT;
    const locked = f.lt >= tl;
    const k = seg(f.lt, tl, tl + 0.25);
    const hover = locked ? 0 : seg(f.lt, tl - BEAT * 0.9, tl);
    const sc = locked ? 1 + 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.2)) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    K.hexPath(ctx, 0, 0, 14);
    if (locked) {
      ctx.fillStyle = col;
      ctx.fill();
      if (k < 1) {
        ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = rgba(col, 0.45 + 0.5 * hover * (0.6 + 0.4 * Math.sin(f.t * 28)));
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  });
  ctx.restore();
}

function chipLayout(ctx, K) {
  const ws = FILTERS.map((fl) => K.measure(ctx, fl.label, CHIP_SIZE, K.F.russo) + 56);
  const gapX = 18;
  const total = ws.reduce((a, b) => a + b, 0) + gapX * (ws.length - 1);
  let x = CHIP_CX - total / 2;
  return ws.map((w) => {
    const c = { cx: x + w / 2, w };
    x += w + gapX;
    return c;
  });
}

function drawChips(ctx, f, K) {
  const { C, rgba, seg, E } = K;
  const t0 = f.at(18, 3);
  if (f.lt < t0) return;
  const L = chipLayout(ctx, K);
  FILTERS.forEach((fl, i) => {
    const { cx: x, w } = L[i];
    const ke = seg(f.lt, t0 + i * BEAT * 0.25, t0 + i * BEAT * 0.25 + 0.3);
    const tOn = f.at(19, fl.beat);
    const on = f.lt >= tOn;
    const kp = seg(f.lt, tOn, tOn + 0.25);
    const pop = on ? 1 + 0.14 * (1 - E.outCubic(kp)) : 1;
    const cy = K.lerp(-60, CHIP_Y, E.outBack(ke, 1.4));
    ctx.save();
    ctx.globalAlpha *= Math.min(1, ke * 2);
    ctx.translate(x, cy);
    ctx.scale(pop, pop);
    K.roundRect(ctx, -w / 2, -CHIP_H / 2, w, CHIP_H, CHIP_H / 2);
    ctx.fillStyle = on ? C.cyan : rgba(C.ink, 0.9);
    ctx.fill();
    if (on && kp < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(C.cyan, 0.5 * (1 - kp));
      ctx.lineWidth = 16 * (1 - kp) + 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = on ? C.cyan : rgba(C.cyan, 0.75);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    K.text(ctx, fl.label, 0, 2, { size: CHIP_SIZE, font: K.F.russo, color: on ? C.ink : C.text });
    ctx.restore();
  });
}

/** On each toggle a 2 px cyan tracer drops from the chip to what it affects (0.12 s), then fades. */
function drawTracers(ctx, f, K) {
  const { C, rgba, seg, E, lerp } = K;
  if (f.lt < f.at(19, 0)) return;
  const L = chipLayout(ctx, K);
  const targets = {
    role: [AX + 60, YS[FOCUS_ROW]],
    ban: [poolX(BANNED[1]), YS[BANNED[0]]],
    pips: [poolX(1), YS[FOCUS_ROW] + 48],
  };
  FILTERS.forEach((fl, i) => {
    const tOn = f.at(19, fl.beat);
    const d = f.lt - tOn;
    if (d < 0 || d > 0.27) return;
    const [x1, y1] = targets[fl.target];
    const y1b = y1 - bounce(f);
    const x0 = L[i].cx;
    const y0 = CHIP_Y + CHIP_H / 2;
    const kh = E.outCubic(seg(d, 0, 0.12));
    const kt = E.inCubic(seg(d, 0.1, 0.27)); // tail catches up before the next toggle
    const fade = 1 - seg(d, 0.2, 0.27);
    const hx = lerp(x0, x1, kh);
    const hy = lerp(y0, y1b, kh);
    const tx = lerp(x0, x1, kt);
    const ty = lerp(y0, y1b, kt);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha *= fade;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(C.cyan2, 0.35);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fill();
    const ki = seg(d, 0.12, 0.27);
    if (ki > 0 && ki < 1) {
      ctx.strokeStyle = rgba(C.cyan, 0.9 * (1 - ki));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x1, y1b, 10 + 34 * E.outCubic(ki), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawCardBand(ctx, f, K) {
  const { C, rgba, E, seg } = K;
  if (f.lt < 0) return;
  // wipes in from the left, in step with the jagged letters (band 749–1011: slam caps and sub pill sit inside)
  const k = E.outExpo(seg(f.lt, 0, 0.3));
  const cy = 880;
  const h = 262;
  const sk = Math.tan(0.314) * h * 0.5;
  const x0 = 960 - 750;
  const x1 = x0 + 1500 * k;
  ctx.save();
  K.polyPath(ctx, [[x0 + sk, cy - h / 2], [x1 + sk, cy - h / 2], [x1 - sk, cy + h / 2], [x0 - sk, cy + h / 2]]);
  ctx.fillStyle = rgba(C.ink, 0.85);
  ctx.fill();
  ctx.fillStyle = C.cyan2;
  K.polyPath(ctx, [[x0 + sk, cy - h / 2], [x1 + sk, cy - h / 2], [x1 + sk - 2, cy - h / 2 + 5], [x0 + sk - 2, cy - h / 2 + 5]]);
  ctx.fill();
  ctx.fillStyle = C.fuchsia2;
  K.polyPath(ctx, [[x0 - sk + 2, cy + h / 2 - 5], [x1 - sk + 2, cy + h / 2 - 5], [x1 - sk, cy + h / 2], [x0 - sk, cy + h / 2]]);
  ctx.fill();
  ctx.restore();
}

/**
 * Card 1 (jagged): same look and layout as renderCards' jagged style, plus a ±1.5 px / ±1° per-letter
 * jitter that re-rolls on every snare (seeded by the snare time), so the title keeps breathing.
 */
function jaggedJitter(ctx, K, str, x, y, opts) {
  const { C, clamp, E } = K;
  const { size, p, seed, emph, jit } = opts;
  const R = K.rng(seed);
  const J = K.rng(jit);
  const chars = [...str];
  const emphStart = emph ? str.indexOf(emph) : -1;
  ctx.save();
  ctx.font = K.F.anton(size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const ws = chars.map((ch) => (ch === ' ' ? size * 0.32 : ctx.measureText(ch).width * 1.08 + size * 0.06));
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = x - total / 2;
  const n = chars.filter((c) => c !== ' ').length;
  let k = 0;
  chars.forEach((ch, i) => {
    const w = ws[i];
    const rot = (R() - 0.5) * 0.28;
    const sc = 0.88 + R() * 0.3;
    const dy = (R() - 0.5) * size * 0.14;
    const style = R();
    const jx = (J() - 0.5) * 3;
    const jy = (J() - 0.5) * 3;
    const jr = (J() - 0.5) * 0.035;
    if (ch !== ' ') {
      const lp = clamp(p * (n + 3) - k * 0.85, 0, 1);
      k++;
      if (lp > 0) {
        const s = E.outBack(lp, 2.4) * sc;
        const isEmph = emphStart >= 0 && i >= emphStart && i < emphStart + emph.length;
        ctx.save();
        ctx.translate(cx + w / 2 + jx, y + dy + jy);
        ctx.rotate(rot * (1 + (1 - lp) * 3) + jr);
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

function drawJaggedCard(ctx, f, K, c, i, x, y) {
  const { C, rgba, seg, E, clamp } = K;
  const t0 = f.at(c.bar, c.beat);
  const d = c.durBeats * BEAT;
  const lt = f.lt - t0;
  if (lt < 0 || lt > d) return;
  const subSize = 54;
  const out = seg(lt, d - BEAT * 0.25, d);
  ctx.save();
  ctx.globalAlpha *= 1 - E.inQuad(out);
  const cy = c.sub ? y - subSize * 0.7 : y;
  const sz = K.fitSize(ctx, c.text, 1400, 150, K.F.anton);
  const sinceSn = f.since('snare');
  const jit = Number.isFinite(sinceSn) && sinceSn < f.lt + 1e-6 ? 500 + Math.round((f.t - sinceSn) * 10) : 0;
  jaggedJitter(ctx, K, c.text, x, cy, { size: sz * 0.82, p: clamp(lt / (BEAT * 1.2)), seed: 13 + i, emph: c.emph, jit });
  if (c.sub) {
    const sp = E.outCubic(seg(lt, BEAT * 0.4, BEAT * 1.2));
    const sy = cy + sz * 0.72 + subSize * 0.4;
    ctx.globalAlpha *= sp;
    const sw = K.measure(ctx, c.sub, subSize, (px) => K.F.inter(px, 700));
    ctx.fillStyle = rgba(C.ink, 0.65);
    ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, (sw + 48) * sp, subSize * 1.6);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x - sw / 2 - 24, sy - subSize * 0.8, 6, subSize * 1.6);
    K.text(ctx, c.sub, x, sy, { size: subSize, font: (px) => K.F.inter(px, 700), color: C.text2 });
  }
  ctx.restore();
}

export default {
  id: 'S05',
  startBar: 16,
  endBar: 20,
  transitionOut: 'star',
  cards: CARDS,
  draw(ctx, f, K) {
    const { C, rgba, seg, E, lerp } = K;
    const lt = f.lt;
    // VS tear rips open on the 16.0 crash: ~60 % open on the very first frame, 90 px a few frames later
    const rip = lt < 0 ? 0 : 90 * E.outCubic(seg(lt, -0.02, 0.06)) + 6 * f.kick * (lt > 0.1 ? 1 : 0);
    const edgeFlash = lt < 0 ? 0 : Math.exp(-lt * 9);
    // snares (b1, b3) flare the tear glow; computed from the snare envelope
    const flare = lt < 0 ? 0 : f.env('snare', 7);

    drawBackground(ctx, f, K, rip);
    K.particles(ctx, f, { count: 70, size: 2, speed: 0.5, seed: 31, alpha: 0.55 });
    K.particles(ctx, f, { count: 36, size: 3.2, speed: 1.1, seed: 32, alpha: 0.6 });
    K.particles(ctx, f, { count: 14, size: 5, speed: 1.9, seed: 33, alpha: 0.45 });

    // UI layer only: slow push-in 1 -> 1.035 over bars 16–17, snapping back on 18.0 with card 2
    const t18 = f.at(18, 0);
    const push = lt < 0 ? 0 : lt < t18 ? 0.035 * E.inOutSine(seg(lt, 0, t18)) : 0.035 * (1 - E.outExpo(seg(lt, t18, t18 + 0.12)));
    ctx.save();
    ctx.translate(960, 400);
    ctx.scale(1 + push, 1 + push);
    ctx.translate(-960, -400);

    // enemies dim to 35 % when the pool opens (18.2); the reticle target comes back
    const enemyDim = 1 - 0.65 * E.inOutCubic(seg(lt, f.at(18, 2), f.at(18, 2.5)));
    drawLockSplash(ctx, f, K);
    drawStreaks(ctx, f, K, enemyDim);
    drawTear(ctx, f, K, rip, flare, edgeFlash, lockFlares(f));

    // pre-drop: dim, waiting slots
    const pre = lt < 0 ? 0.55 : 1;
    const T = filterTimes(f);
    // reticle: appears with « Champion adverse » (19.1.5), creeps in, then snaps onto E3 exactly on 19.2.75
    const retA = seg(lt, T.ban, T.ban + 0.16);
    const retK = lt < T.ret - 0.18 ? 0.22 * E.inOutSine(seg(lt, T.ban, T.ret - 0.18)) : lerp(0.22, 1, E.inQuad(seg(lt, T.ret - 0.18, T.ret)));
    const reticle = { a: retA, k: retK, land: T.ret };
    const focus = E.outCubic(seg(lt, T.role, T.role + 0.15));
    const cue = lt >= f.at(18, 1) ? Math.exp(-(lt - f.at(18, 1)) * 7) : 0;

    // role labels for the ally column (static: no kick bounce); MID turns cyan with « Rôle »
    ROLES.forEach((r, k) => {
      const isF = k === FOCUS_ROW;
      K.text(ctx, r, AX - 76, YS[k], {
        size: 34, font: K.F.bebas, color: isF && focus > 0 ? C.cyan : C.text2, spacing: 2, align: 'right',
        alpha: pre * (isF ? 0.6 + 0.4 * focus : 0.6 - 0.25 * focus),
      });
    });
    for (let k = 0; k < 5; k++) drawSlot(ctx, f, K, 'A', k, pre, null, cue);
    for (let k = 0; k < 5; k++) {
      const target = k === 2 ? lerp(enemyDim, 0.9, E.outCubic(retA)) : enemyDim;
      drawSlot(ctx, f, K, 'E', k, pre * target, k === 2 ? reticle : null);
    }
    drawPool(ctx, f, K);
    drawMatchLink(ctx, f, K, T.ret);
    ctx.restore();

    drawPickTrack(ctx, f, K);
    drawTracers(ctx, f, K);
    drawChips(ctx, f, K);

    drawCardBand(ctx, f, K);
    drawJaggedCard(ctx, f, K, CARDS[0], 0, 960, 870);
    K.renderCards(ctx, f, f.cardsOf, { x: 960, y: 870, size: 150, subSize: 54, maxW: 1400, skip: (c) => c.style === 'jagged' });

    // brand bug (shared setting across scenes)
    K.logo(ctx, 1772, 62, 150, { alpha: 0.55, glow: 6, lineWidth: 2.4 });

    return { flash: lt >= 0 ? 0.2 * Math.exp(-lt * 14) : 0 };
  },
};
