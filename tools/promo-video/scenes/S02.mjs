// S02 — « La boucle perdante », bars 4–8 (6,4 → 12,8 s).
// An original schematic iso board (no Riot map art): the same mistake stamped three times, enemy
// pings on the hats, then the pings freeze into data squares that fill the ignored « facts » panel
// (a real NXT5 gold-gap curve, cropped with no numbers or icons, waiting in the corner).
// Bar 7 brings back the vicious fuchsia LOOP RING (JOUE · PERDS · OUBLIE), lighting one node per kick.
// Hand-off: the ring ends at (960,640) r = 230 with JOUE on top, which is exactly where S03 pins its
// own ring during the renderer's zoom transition, so the two rings overlap as one (match cut).
const BEAT = 0.4;
const BAR = 1.6;
const T_B5 = BAR;
const T_B6 = 2 * BAR;
const T_B7 = 3 * BAR;
const DUR = 4 * BAR;
const CX = 960; // board centre
const CY = 685;
const OX0 = -70; // board sits left of centre: the facts panel lives bottom-right
/** Iso board point: u along B→R, v along B→L (0..1). */
const P = (u, v) => [960 + 560 * (u - v), 965 - 280 * (u + v)];
const E0 = 0.07;
const LANES = [
  { pts: [P(E0, E0), P(E0, 1 - E0), P(1 - E0, 1 - E0)], on: 0 }, // top: B→L→T
  { pts: [P(E0, E0), P(1 - E0, 1 - E0)], on: BEAT }, // mid: B→T
  { pts: [P(E0, E0), P(1 - E0, E0), P(1 - E0, 1 - E0)], on: 2 * BEAT }, // bot: B→R→T
];
const DIAMOND = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
const XM = P(0.586, 0.586); // « same mistake » spot, 60 % up the mid lane
const RIVER = [P(0, 1).map((v, i) => v), [715, 622], [1205, 748], P(1, 0)];
// Bar-5 enemy pings (one per 8th hat), all on lanes, away from the X and the river.
const PINGS = [P(E0, 0.32), P(0.4, E0), P(0.3, 0.3), P(0.48, 1 - E0), P(1 - E0, 0.42), P(0.8, 0.8), P(E0, 0.84), P(1 - E0, 0.76)];
const QHITS = PINGS.map((_, k) => T_B5 + k * BEAT * 0.5 + 0.31); // each « ? » reaching the JGL token
// Foreshadow panel, its real curve crop and its 8 × 4 data grid.
const PANEL = { x: 1380, y: 730, w: 440, h: 250 };
const CURVE = { x: 1402, y: 766, w: 396, h: 95, src: [200, 980, 830, 200] }; // ui-match-timeline.png, curve only
const GRID = { x: 1402, y: 874, cw: 42, ch: 18, px: 49.5, py: 24 };
const RING = { x: 960, y: 640, r: 230 };
// Nodes start one step behind (JOUE at 150°): after the 4 kick steps of +30° the ring ends on the
// canonical layout JOUE −90° / PERDS 30° / OUBLIE 150° that S03 picks up.
const NODES = [
  { a: 150, label: 'JOUE' },
  { a: 270, label: 'PERDS' },
  { a: 30, label: 'OUBLIE' },
];
const CARD_Y = 190;
const CARD_Y7 = 165; // bar 7: a little higher so the sub pill clears the top node label
const SLASH_ANG = -0.32;

export const cards = [
  { bar: 4, beat: 0, durBeats: 4, text: 'Même erreur demain.', emph: 'Même erreur', sub: 'Et le jour d’après.', style: 'slam', sceneDrawn: true },
  { bar: 5, beat: 0, durBeats: 4, text: 'Le tilt parle.', emph: 'tilt', sub: '', style: 'jagged' },
  { bar: 6, beat: 0, durBeats: 4, text: 'Les faits, eux, attendent.', emph: 'faits', sub: 'Le score ne raconte pas tout.', style: 'slam', sceneDrawn: true },
  { bar: 7, beat: 0, durBeats: 3.5, text: 'Joue. Perds. Oublie.', emph: 'Oublie.', sub: 'Et ça recommence.', style: 'slam', sceneDrawn: true },
];

function heartbeat(lt) {
  if (lt < 0) return { s: Infinity, w: 0 };
  const x = lt - Math.floor(lt / BAR) * BAR;
  return x >= 0.3 ? { s: x - 0.3, w: 0.65 } : { s: x, w: 1 };
}
const bump = (s, d = 0.15) => (s >= -1e-6 && s < d ? Math.sin(Math.PI * Math.sqrt(Math.max(0, s) / d)) : 0);
const since = (lt, t0) => lt - t0 + 1e-6;

function bez(p, q) {
  const u = 1 - q;
  const [a, b, c, d] = p;
  return [
    u * u * u * a[0] + 3 * u * u * q * b[0] + 3 * u * q * q * c[0] + q * q * q * d[0],
    u * u * u * a[1] + 3 * u * u * q * b[1] + 3 * u * q * q * c[1] + q * q * q * d[1],
  ];
}

/** Board transform at local time lt: punch-in, bar-5 hit jitter, bar-6 lurch, kick punches, bar-7 flip. */
function boardXf(lt, K) {
  const { E, seg, lerp, noise1 } = K;
  // punch-in on the bar-4 impact, then a slow drift closer through bars 4–5
  const s = (lt < 0 ? 1.2 : lerp(1.2, 1, E.outExpo(seg(lt, 0, 0.35)))) * (1 + 0.02 * E.inOutSine(seg(lt, 0.35, T_B6)));
  // the bar-6 brass stab makes the board lurch (outExpo over the first beat)
  const tilt = E.outExpo(seg(lt, T_B6, T_B6 + BEAT));
  const flip = 1 - E.inExpo(seg(lt, T_B7 - BEAT * 0.25, T_B7));
  let dy = 0;
  for (let k = 0; k < 4; k++) {
    const d = lt - (T_B6 + k * BEAT);
    if (d >= 0 && d < 0.3) dy += 6 * Math.exp(-d * 18) * Math.min(1, d * 60);
  }
  // 2 px micro-shake on every « ? » hitting the JGL token
  let hit = 0;
  for (const h of QHITS) {
    const d = lt - h;
    if (d >= 0 && d < 0.12) hit = Math.max(hit, 1 - d / 0.12);
  }
  const jx = 2 * hit * noise1(lt * 70, 1);
  const jy = 2 * hit * noise1(lt * 70, 2);
  return { s, sy: lerp(1, 0.85, tilt) * flip, rot: (3 * Math.PI * tilt) / 180, dy: dy + jy, ox: OX0 - 40 * tilt + jx, flip, tilt };
}
function applyXf(ctx, xf) {
  ctx.translate(CX + xf.ox, CY + xf.dy);
  ctx.rotate(xf.rot);
  ctx.scale(xf.s, xf.s * xf.sy);
  ctx.translate(-CX, -CY);
}
function toScreen(xf, x, y) {
  const dx = (x - CX) * xf.s;
  const dy = (y - CY) * xf.s * xf.sy;
  const c = Math.cos(xf.rot);
  const s = Math.sin(xf.rot);
  return [CX + xf.ox + dx * c - dy * s, CY + xf.dy + dx * s + dy * c];
}

/** JGL token position on the river (patrols the left half, clear of the X marks). */
function tokenPos(lt) {
  const q = 0.24 + 0.12 * Math.sin(lt * 1.25 + 0.6);
  const [x, y] = bez(RIVER, q);
  return [x, y - 6 + Math.sin(lt * 5) * 3];
}

// ------------------------------------------------------------------ board
function drawBoard(ctx, f, K, lt, xf, hbPulse) {
  const { C, E, seg, rgba } = K;
  ctx.save();
  applyXf(ctx, xf);
  // plate thickness (2.5D slab under the top face)
  const TH = 26;
  const [bx0, by0] = P(0, 0);
  const [rx0, ry0] = P(1, 0);
  const [lx0, ly0] = P(0, 1);
  K.polyPath(ctx, [[lx0, ly0], [bx0, by0], [rx0, ry0], [rx0, ry0 + TH], [bx0, by0 + TH], [lx0, ly0 + TH]]);
  const sg = ctx.createLinearGradient(0, ly0, 0, by0 + TH);
  sg.addColorStop(0, '#0a1430');
  sg.addColorStop(1, '#04070f');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(C.cyan2, 0.18);
  ctx.beginPath();
  ctx.moveTo(lx0, ly0 + TH);
  ctx.lineTo(bx0, by0 + TH);
  ctx.lineTo(rx0, ry0 + TH);
  ctx.moveTo(bx0, by0);
  ctx.lineTo(bx0, by0 + TH);
  ctx.stroke();
  // plate
  K.polyPath(ctx, DIAMOND);
  ctx.fillStyle = '#0b1224';
  ctx.fill();
  // edge glow (layered strokes, no blur) + 3-frame white flash on the punch
  const wf = lt < 3 / 60 ? 1 - lt / (3 / 60) : 0;
  ctx.lineJoin = 'round';
  for (const [w, a] of [[16, 0.05], [8, 0.1], [3, 0.3]]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = rgba(C.cyan2, a + wf * 0.5);
    ctx.stroke();
  }
  if (wf > 0) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = rgba(C.text, wf);
    ctx.stroke();
  }
  // 12 × 12 iso grid (flashes cyan on the bar-6 brass stab, then stays faintly « scanned »)
  ctx.beginPath();
  for (let i = 1; i < 12; i++) {
    const k = i / 12;
    ctx.moveTo(...P(k, 0));
    ctx.lineTo(...P(k, 1));
    ctx.moveTo(...P(0, k));
    ctx.lineTo(...P(1, k));
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#1e293b';
  ctx.stroke();
  const sf = lt >= T_B6 ? 0.1 + 0.4 * (1 - E.outCubic(seg(lt, T_B6, T_B6 + 0.2))) : 0;
  if (sf > 0) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(C.cyan, sf);
    ctx.stroke();
  }
  // grid dots twinkle on the 8th hats
  const hatIdx = Math.floor(Math.max(0, lt) / (BEAT / 2));
  ctx.fillStyle = rgba(C.cyan, 0.18 + 0.5 * f.hat);
  ctx.beginPath();
  for (let i = 1; i < 12; i++) {
    for (let j = 1; j < 12; j++) {
      if ((i * 7 + j * 3 + hatIdx * 5) % 11 !== 0) continue;
      const [x, y] = P(i / 12, j / 12);
      ctx.rect(x - 2, y - 2, 4, 4);
    }
  }
  ctx.fill();
  // river: soft bezier L→R with shimmering dashes
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(...RIVER[0]);
  ctx.bezierCurveTo(...RIVER[1], ...RIVER[2], ...RIVER[3]);
  ctx.lineWidth = 26;
  ctx.strokeStyle = rgba(C.blue, 0.4);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 26]);
  ctx.lineDashOffset = -lt * 40;
  ctx.strokeStyle = rgba('#93c5fd', 0.35 + 0.15 * Math.sin(lt * 6));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  // lanes
  const step = Math.floor(Math.max(0, lt) / (BEAT / 4)); // 16th arp
  for (const L of LANES) {
    const lit = lt >= L.on ? E.outCubic(seg(lt, L.on, L.on + 0.12)) : 0;
    K.polyPath(ctx, L.pts, false);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    if (lit > 0) {
      ctx.save();
      // ignition: light runs from the ally base along the lane
      ctx.setLineDash([2000 * lit, 4000]);
      ctx.shadowColor = C.cyan2;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = wf > 0 ? C.text : C.cyan2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([16, 44]);
      ctx.lineDashOffset = -step * 15;
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(C.text, 0.85 * lit);
      ctx.stroke();
      ctx.restore();
      const fl = flash(lt - L.on);
      if (lit < 1 && fl > 0) {
        // spark at the ally base when the lane ignites
        const [bx, by] = L.pts[0];
        ctx.fillStyle = rgba(C.text, fl);
        ctx.beginPath();
        ctx.arc(bx, by, 14 * fl, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // bases (pulse on the heartbeats)
  const hs = 1 + 0.15 * hbPulse;
  base(ctx, K, ...P(0, 0), 34 * hs, C.cyan2);
  base(ctx, K, ...P(1, 1), 34 * hs, C.fuchsia2);
  ctx.restore();
}
const flash = (s) => (s >= 0 && s < 0.2 ? 1 - s / 0.2 : 0);

/** Impact RGB ghosts of the board's line art (cyan / fuchsia, never the renderer's red). */
function boardGhosts(ctx, K, xf, k) {
  const { C, rgba } = K;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [col, ox, oy] of [[C.cyan2, -12, -4], [C.fuchsia2, 12, 4]]) {
    ctx.save();
    ctx.translate(ox * k, oy * k);
    applyXf(ctx, xf);
    ctx.strokeStyle = rgba(col, 0.75 * k);
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    K.polyPath(ctx, DIAMOND);
    ctx.stroke();
    K.polyPath(ctx, LANES[0].pts, false);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function base(ctx, K, x, y, r, col) {
  const { rgba } = K;
  K.hexPath(ctx, x, y, r * 1.45);
  ctx.fillStyle = rgba(col, 0.12);
  ctx.fill();
  K.hexPath(ctx, x, y, r);
  ctx.fillStyle = '#0b1224';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = col;
  ctx.stroke();
  K.hexPath(ctx, x, y, r * 0.45);
  ctx.fillStyle = col;
  ctx.fill();
}

/** « Same mistake » X marks: b0, ghost on b2, third on b3 — each repeat leaves an afterimage and a scar. */
function drawMarks(ctx, K, lt) {
  const { C, E, rgba, clamp } = K;
  const marks = [0, 2 * BEAT, 3 * BEAT];
  const OFF = [[0, 0], [-7, 5], [7, -6]];
  const [mx, my] = XM;
  const drawX = (ox, oy, col, a, sc, rot) => {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(mx + ox, my + oy);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.fillStyle = col;
    ctx.fillRect(-36, -7.5, 72, 15);
    ctx.fillRect(-7.5, -36, 15, 72);
    ctx.restore();
  };
  const st = marks.map((t0, k) => {
    const s = since(lt, t0);
    const p = E.outExpo(clamp(s / 0.12));
    return { s, sc: 2.1 - 1.1 * p, rot: 0.785 + (k - 1) * 0.06 };
  });
  // lingering scar rings (r 40 / 52 / 64)
  st.forEach(({ s }, k) => {
    if (s < 0) return;
    ctx.strokeStyle = rgba(C.fuchsia2, 0.6 * clamp(s * 10));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 40 + 12 * k, 0, Math.PI * 2);
    ctx.stroke();
    if (s < 0.25) {
      ctx.strokeStyle = rgba(C.fuchsia, 1 - s / 0.25);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, 40 + 90 * E.outCubic(s / 0.25), 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  // ghosts first: RGB-split arrival + persistent offset afterimage
  st.forEach(({ s, sc, rot }, k) => {
    if (s < 0 || k === 0) return;
    if (s < 0.15) {
      const j = 10 * (1 - s / 0.15) + 3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawX(OFF[k][0] - j, OFF[k][1], C.cyan2, 0.7, sc, rot);
      drawX(OFF[k][0] + j, OFF[k][1], C.fuchsia, 0.7, sc, rot);
      ctx.restore();
    }
    drawX(OFF[k][0], OFF[k][1], C.fuchsia, 0.35 * clamp(s * 20), sc, rot);
  });
  // solid fuchsia X on top
  st.forEach(({ s, sc, rot }) => {
    if (s < 0) return;
    drawX(0, 0, C.fuchsia2, clamp(s * 20), sc, rot);
  });
  // loop arrow spinning once per bar around the X marks
  const a0 = (lt / BAR) * Math.PI * 2;
  const r = 86;
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(a0);
  ctx.strokeStyle = C.fuchsia2;
  ctx.fillStyle = C.fuchsia2;
  ctx.lineWidth = 3;
  ctx.globalAlpha *= clamp(lt * 8);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 1.5);
  ctx.stroke();
  ctx.translate(0, -r);
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-7, -11);
  ctx.lineTo(-7, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Things living on the board plane (X marks, loop arrow, pings, JGL token). */
function drawBoardLife(ctx, f, K, lt, xf) {
  const { C, E, rgba, clamp, F } = K;
  if (lt < 0 || xf.flip <= 0.001) return;
  ctx.save();
  applyXf(ctx, xf);
  // JGL token patrolling the river
  const [tx, ty] = tokenPos(lt);
  let hit = 0;
  for (const h of QHITS) {
    const s = lt - h;
    if (s >= 0 && s < 0.25) hit = Math.max(hit, 1 - s / 0.25);
  }
  ctx.save();
  ctx.translate(tx, ty);
  if (hit > 0) {
    ctx.strokeStyle = rgba(C.fuchsia2, hit);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + 30 * (1 - hit), 0, Math.PI * 2);
    ctx.stroke();
  }
  const ts = 1 + 0.15 * hit * hit;
  ctx.scale(ts, ts);
  K.hexPath(ctx, 0, 0, 30);
  ctx.fillStyle = '#1e1b4b';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.violet;
  ctx.stroke();
  K.text(ctx, 'JGL', 0, 1, { size: 17, font: F.russo, color: C.violet2 });
  ctx.restore();

  drawMarks(ctx, K, lt);

  // bar-5 enemy pings, one per 8th hat
  PINGS.forEach((pp, k) => {
    const t0 = T_B5 + k * BEAT * 0.5;
    const s = since(lt, t0);
    if (s < 0) return;
    const cluster = Math.floor(k / 2);
    const tf = T_B6 + cluster * BEAT; // freeze on this kick
    const sf = since(lt, tf);
    if (sf > 0.07) return; // burst into data squares
    const [x, y] = pp;
    const frz = clamp(sf / 0.06);
    const col = frz > 0 ? '#64748b' : C.fuchsia2;
    const pop = E.outBack(clamp(s / 0.1), 2.6);
    const breathe = frz > 0 ? 1 : 1 + 0.08 * Math.sin(lt * 9 + k);
    // expanding ring 0 → 120 px
    if (s < 0.5) {
      ctx.strokeStyle = rgba(C.fuchsia, 1 - s / 0.5);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 120 * E.outCubic(s / 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    const drawPing = (ox, c, a, glyph) => {
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(x + ox, y);
      ctx.scale(pop * breathe, pop * breathe);
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      if (glyph) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = frz > 0 ? '#94a3b8' : C.text;
        ctx.stroke();
        K.text(ctx, '!', 0, 2, { size: 40, font: F.russo, color: frz > 0 ? '#cbd5e1' : C.text });
      }
      ctx.restore();
    };
    if (s < 0.1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawPing(-6, C.cyan2, 0.7, false);
      drawPing(6, C.fuchsia, 0.7, false);
      ctx.restore();
    }
    drawPing(0, col, 1, true);
    if (sf >= 0 && sf < 0.07) {
      ctx.strokeStyle = rgba(C.cyan, 1 - sf / 0.07);
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 38, y - 38, 76, 76);
    }
  });
  // each ping sends a « ? » to the token
  PINGS.forEach((pp, k) => {
    const s = lt - (T_B5 + k * BEAT * 0.5) - 0.06; // the « ! » reads first
    if (s < 0 || s > 0.25) return;
    const q2 = E.inCubic(s / 0.25);
    const x = pp[0] + (tx - pp[0]) * q2;
    const y = pp[1] + (ty - pp[1]) * q2 - Math.sin(q2 * Math.PI) * 70;
    K.text(ctx, '?', x, y, { size: 44, font: F.anton, color: C.fuchsia, stroke: 7, strokeColor: C.ink });
  });
  ctx.restore();
}

/** Growing « ? ? ? ? » spam bubble above the JGL token (screen space, one mark per hit, max 4). */
function drawSpam(ctx, K, lt, xf) {
  const { C, E, rgba, clamp, F } = K;
  const n = QHITS.filter((h) => lt >= h).length;
  if (n === 0 || xf.flip <= 0.02) return;
  const shown = Math.min(4, n);
  const lastHit = QHITS[Math.min(n, 4) - 1];
  const [tx, ty] = toScreen(xf, ...tokenPos(lt));
  const bx = tx - 34;
  const by = ty - 92;
  const gap = 34;
  const w = 36 + gap * shown;
  const h = 62;
  ctx.save();
  ctx.globalAlpha *= clamp(xf.flip * 1.5);
  // bubble with a tail pointing at the token
  ctx.beginPath();
  ctx.roundRect(bx - w / 2, by - h / 2, w, h, 16);
  ctx.moveTo(bx + 4, by + h / 2 - 1);
  ctx.lineTo(tx - 6, ty - 34);
  ctx.lineTo(bx + 26, by + h / 2 - 1);
  ctx.fillStyle = rgba(C.ink, 0.88);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.fuchsia2;
  ctx.beginPath();
  ctx.roundRect(bx - w / 2, by - h / 2, w, h, 16);
  ctx.stroke();
  for (let i = 0; i < shown; i++) {
    const s = lt - QHITS[i];
    const pop = E.outBack(clamp(s / 0.12), 3);
    const x = bx - (gap * (shown - 1)) / 2 + i * gap;
    ctx.save();
    ctx.translate(x, by + 2);
    ctx.scale(pop, pop);
    ctx.rotate((i % 2 ? 1 : -1) * 0.12);
    K.text(ctx, '?', 0, 0, { size: 40, font: F.anton, color: C.fuchsia, stroke: 6, strokeColor: C.ink });
    ctx.restore();
  }
  void lastHit;
  ctx.restore();
}

// ------------------------------------------------------------------ foreshadow panel + data squares
let curveCache = null;
function curveBitmaps(K) {
  if (curveCache) return curveCache;
  const img = K.uiImage('ui-match-timeline.png');
  if (!img) return null;
  const { createCanvas } = globalThis.__canvasMod;
  const [sx, sy, sw, sh] = CURVE.src;
  const mk = (gray) => {
    const c = createCanvas(CURVE.w * 2, CURVE.h * 2);
    const x = c.getContext('2d');
    if (gray) x.filter = 'grayscale(1)';
    x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  };
  curveCache = { color: mk(false), gray: mk(true) };
  return curveCache;
}

function drawPanel(ctx, f, K, lt, lit, colorMix) {
  const { C, E, seg, rgba } = K;
  const { x, y, w, h } = PANEL;
  const a = lt < 0 ? 0 : E.outCubic(seg(lt, 0.1, 0.5));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  if (lit > 0) {
    // cyan glow (layered rounded strokes)
    for (const [lw, al] of [[22, 0.05], [12, 0.1], [5, 0.2]]) {
      K.roundRect(ctx, x, y, w, h, 16);
      ctx.lineWidth = lw;
      ctx.strokeStyle = rgba(C.cyan2, al * lit);
      ctx.stroke();
    }
  }
  K.roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = rgba(C.surface, 0.6 + 0.25 * lit);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(C.cyan, 0.2 + 0.6 * lit);
  ctx.stroke();
  // header dots + label lines (no numbers, no names)
  ctx.fillStyle = rgba(C.cyan, 0.35 + 0.5 * lit);
  ctx.beginPath();
  ctx.arc(x + 24, y + 20, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(C.text2, 0.18 + 0.2 * lit);
  ctx.fillRect(x + 38, y + 17, 110, 6);
  ctx.fillRect(x + 156, y + 17, 52, 6);
  // the real gold-gap curve (curve area only): desaturated and dim, it sharpens as the facts land
  const cb = curveBitmaps(K);
  if (cb) {
    const pulse = 0.85 + 0.15 * Math.sin(lt * 2.4);
    ctx.save();
    K.roundRect(ctx, CURVE.x, CURVE.y, CURVE.w, CURVE.h, 8);
    ctx.clip();
    if (colorMix < 1) {
      ctx.globalAlpha = a * 0.25 * pulse * (1 - colorMix);
      ctx.drawImage(cb.gray, CURVE.x, CURVE.y, CURVE.w, CURVE.h);
    }
    if (colorMix > 0) {
      ctx.globalAlpha = a * (0.25 + 0.55 * colorMix);
      ctx.drawImage(cb.color, CURVE.x, CURVE.y, CURVE.w, CURVE.h);
    }
    ctx.restore();
  }
  // travelling read-head over the curve
  const k = (lt * 0.35) % 1;
  const hx = CURVE.x + 8 + k * (CURVE.w - 16);
  ctx.fillStyle = rgba(C.cyan, 0.12 + 0.3 * lit);
  ctx.fillRect(hx - 1, CURVE.y + 4, 2, CURVE.h - 8);
  // empty grid slots
  ctx.strokeStyle = rgba(C.cyan, 0.12 + 0.12 * lit);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 4; r++) ctx.rect(GRID.x + c * GRID.px + 0.5, GRID.y + r * GRID.py + 0.5, GRID.cw, GRID.ch);
  }
  ctx.stroke();
  ctx.restore();
}

/** Bar 6: frozen pings burst into 14 px cyan squares that arc into the panel grid. */
function drawSquares(ctx, K, lt, xfAt) {
  const { C, E, clamp, rgba } = K;
  ctx.save();
  ctx.lineCap = 'round';
  // kick beams: frozen cluster → panel, 0,12 s
  for (let c = 0; c < 4; c++) {
    const s = since(lt, T_B6 + c * BEAT);
    if (s < 0 || s > 0.12) continue;
    const xf = xfAt(T_B6 + c * BEAT);
    const a = toScreen(xf, ...PINGS[2 * c]);
    const b = toScreen(xf, ...PINGS[2 * c + 1]);
    const sx = (a[0] + b[0]) / 2;
    const sy = (a[1] + b[1]) / 2;
    const tx = GRID.x + (2 * c + 1) * GRID.px - (GRID.px - GRID.cw) / 2;
    const ty = GRID.y - 4;
    const k = 1 - s / 0.12;
    ctx.strokeStyle = rgba(C.cyan2, 0.9 * k);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.strokeStyle = rgba(C.cyan2, 0.18 * k);
    ctx.lineWidth = 9;
    ctx.stroke();
  }
  for (let k = 0; k < 8; k++) {
    const cluster = Math.floor(k / 2);
    const tb = T_B6 + cluster * BEAT + 0.07; // burst
    const [bx, by] = toScreen(xfAt(tb), ...PINGS[k]);
    for (let r = 0; r < 4; r++) {
      const d = 0.26 + r * 0.02;
      const s = lt - tb - r * 0.02;
      if (s < 0) continue;
      const q = clamp(s / d);
      const tx = GRID.x + k * GRID.px + GRID.cw / 2;
      const ty = GRID.y + r * GRID.py + GRID.ch / 2;
      // arc: first a small burst away from the ping, then a sweep into the panel
      const ang = (r / 4) * Math.PI * 2 + k;
      const sx = bx + Math.cos(ang) * 44;
      const sy = by + Math.sin(ang) * 44;
      const cx = (sx + tx) / 2 + (r - 1.5) * 26;
      const cy = Math.min(sy, ty) - 130 - r * 24;
      const at = (qq) => {
        const e = E.inOutCubic(qq);
        const burst = E.outCubic(clamp(qq * 5));
        const x0 = bx + (sx - bx) * burst;
        const y0 = by + (sy - by) * burst;
        const u = 1 - e;
        return [u * u * x0 + 2 * u * e * cx + e * e * tx, u * u * y0 + 2 * u * e * cy + e * e * ty];
      };
      if (q < 1) {
        // trail
        ctx.strokeStyle = rgba(C.cyan2, 0.5);
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let j = 0; j <= 6; j++) {
          const [x, y] = at(Math.max(0, q - 0.035 * (6 - j)));
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        const [x, y] = at(q);
        ctx.fillStyle = rgba(C.cyan2, 0.35);
        ctx.fillRect(x - 15, y - 15, 30, 30);
        ctx.fillStyle = C.cyan;
        ctx.fillRect(x - 7, y - 7, 14, 14);
        ctx.fillStyle = C.text;
        ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
      } else {
        const sl = s - d;
        const land = clamp(sl / 0.12);
        const cw = 14 + (GRID.cw - 14) * E.outBack(land);
        const ch = 14 + (GRID.ch - 14) * E.outCubic(land);
        const glow = Math.exp(-sl * 8);
        ctx.fillStyle = rgba(C.cyan, 0.6 + 0.4 * glow);
        ctx.fillRect(tx - cw / 2, ty - ch / 2, cw, ch);
        if (sl < 3 / 60) {
          // 3-frame white flash of the cell
          ctx.fillStyle = C.text;
          ctx.fillRect(tx - GRID.cw / 2 - 2, ty - GRID.ch / 2 - 2, GRID.cw + 4, GRID.ch + 4);
        }
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ bar 7: the vicious loop ring
function nodeLit(lt, i) {
  let v = 0;
  for (const [t0, k] of [[T_B7 + i * BEAT, 5], [T_B7 + 3 * BEAT, 7]]) {
    const s = since(lt, t0);
    if (s >= 0) v = Math.max(v, Math.exp(-s * k));
  }
  return v;
}

/** Label centre: our radial layout, eased into S03's exact layout before the match cut. */
function labelLayout(ctx, K, label, a, r, h) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const hw = K.measure(ctx, label, 52, K.F.bebas, 3) / 2;
  const lr = r + 26 + Math.abs(ca) * hw + Math.abs(sa) * 22;
  const mine = { x: ca * lr, y: sa * lr + 2, size: 52 };
  if (h <= 0) return mine;
  // S03 (zoom window): s = 230 / 250, label 40·s px outside the node, half-width shift, top / bottom nudge
  const s = 230 / 250;
  const size = 52 * s;
  const w = K.measure(ctx, label, size, K.F.bebas, 3);
  let x = ca * r + ca * 40 * s;
  let y = sa * r + sa * 40 * s;
  if (Math.abs(ca) > 0.3) x += Math.sign(ca) * w / 2;
  if (sa < -0.5) y -= size * 0.42;
  else y += size * 0.28;
  const L = (p, q) => p + (q - p) * h;
  return { x: L(mine.x, x), y: L(mine.y, y), size: L(52, size) };
}

function drawLoopRing(ctx, f, K, lt) {
  const { C, E, seg, rgba, clamp, F } = K;
  const s0 = lt - (T_B7 - 0.04); // pops 2 frames early so the bar-7 kick lands on a visible ring
  if (s0 < 0) return;
  let rot = 0;
  for (let k = 0; k < 4; k++) rot += (Math.PI / 6) * E.outExpo(seg(lt, T_B7 + k * BEAT, T_B7 + k * BEAT + 0.15));
  const pop = E.outBack(clamp(s0 / 0.22), 1.8);
  const kick = f.kick;
  const { x, y, r } = RING;
  const labelA = 1 - seg(lt, DUR - 0.12, DUR - 0.05); // S03's labels take over (12,68 → 12,75)
  const spin = 1 + 3 * E.inQuad(seg(lt, DUR - 0.5, DUR + 0.1)); // the vortex winds up into the cut
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
  ctx.globalAlpha *= clamp(s0 / 0.06);
  // dark core (the zoom transition dives in here)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.05);
  g.addColorStop(0, rgba(C.ink, 0.9));
  g.addColorStop(0.75, rgba(C.ink, 0.55));
  g.addColorStop(1, rgba(C.fuchsia2, 0.08));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // ring halo + stroke
  ctx.lineWidth = 16;
  ctx.strokeStyle = rgba(C.fuchsia2, 0.12 + 0.12 * kick);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.fuchsia2;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(C.fuchsia, 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, r - 22, 0, Math.PI * 2);
  ctx.stroke();
  // vortex: dashed arcs spiralling inwards, faster towards the centre
  ctx.lineWidth = 2;
  [[160, 1.2, 0.3], [112, 2.2, 0.24], [66, 3.6, 0.18]].forEach(([rr, sp, al], k) => {
    ctx.save();
    ctx.rotate(lt * sp * spin + k);
    ctx.setLineDash([rr * 0.5, rr * 0.35]);
    ctx.strokeStyle = rgba(k === 1 ? C.violet : C.fuchsia, al * (1 + 0.6 * (spin - 1)));
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  ctx.setLineDash([]);
  // inner tick ring turning slowly
  ctx.save();
  ctx.rotate(-lt * 0.4);
  ctx.strokeStyle = rgba(C.fuchsia, 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const l = i % 3 === 0 ? 12 : 6;
    ctx.moveTo(Math.cos(a) * (r - 30), Math.sin(a) * (r - 30));
    ctx.lineTo(Math.cos(a) * (r - 30 - l), Math.sin(a) * (r - 30 - l));
  }
  ctx.stroke();
  ctx.restore();
  // comet: runs once around the ring per beat, so the loop visibly cycles
  {
    const ph = Math.max(0, lt - T_B7) / BEAT;
    const head = -Math.PI / 2 + rot + ph * Math.PI * 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const N = 10;
    const tail = 2.1;
    for (let i = 0; i < N; i++) {
      const a0 = head - tail * (1 - i / N);
      const a1 = head - tail * (1 - (i + 1) / N);
      ctx.strokeStyle = rgba(i > N - 3 ? C.text : C.fuchsia, 0.06 + 0.5 * (i / N) ** 2);
      ctx.lineWidth = 2 + 6 * (i / N);
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a1);
      ctx.stroke();
    }
    const hx = Math.cos(head) * r;
    const hy = Math.sin(head) * r;
    const cg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 34);
    cg.addColorStop(0, rgba(C.text, 1));
    cg.addColorStop(0.25, rgba(C.text, 0.6));
    cg.addColorStop(1, rgba(C.fuchsia, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(hx - 34, hy - 34, 68, 68);
    ctx.restore();
  }
  // arrowheads (clockwise) between the nodes
  ctx.fillStyle = C.fuchsia2;
  for (const deg of [-30, 90, 210]) {
    const a = (deg * Math.PI) / 180 + rot;
    ctx.save();
    ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -15);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-12, 15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // nodes + labels (each kick lights the node the step lands on, then all three on the last kick)
  NODES.forEach((n, i) => {
    const a = (n.a * Math.PI) / 180 + rot;
    const nx = Math.cos(a) * r;
    const ny = Math.sin(a) * r;
    const li = nodeLit(lt, i);
    for (const t0 of [T_B7 + i * BEAT, T_B7 + 3 * BEAT]) {
      const sp = since(lt, t0) / 0.35;
      K.shockwave(ctx, nx, ny, sp, { color: C.fuchsia, maxR: 90, width: 12, sparks: 0 });
      if (sp > 0 && sp < 0.6) {
        // short spark ticks (the kit's long sparks would reach the sub pill)
        const e = E.outCubic(sp / 0.6);
        ctx.strokeStyle = rgba(C.text, 0.9 * (1 - sp / 0.6));
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const aj = (j / 8) * Math.PI * 2 + 0.3;
          const r0 = 24 + 40 * e;
          ctx.moveTo(nx + Math.cos(aj) * r0, ny + Math.sin(aj) * r0);
          ctx.lineTo(nx + Math.cos(aj) * (r0 + 16), ny + Math.sin(aj) * (r0 + 16));
        }
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(nx, ny, 14 * (1 + 0.25 * kick) * (1 + 0.35 * li), 0, Math.PI * 2);
    ctx.fillStyle = C.fuchsia2;
    ctx.fill();
    if (li > 0.01) {
      ctx.fillStyle = rgba(C.text, Math.min(1, li * 1.3));
      ctx.fill();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.text;
    ctx.stroke();
    const lp = E.outCubic(clamp((s0 - i * 0.05) / 0.15)) * labelA;
    if (lp <= 0.001) return;
    const h = E.inOutCubic(seg(lt, DUR - 0.35, DUR - 0.18));
    const L = labelLayout(ctx, K, n.label, a, r, h);
    ctx.save();
    ctx.translate(L.x, L.y);
    const ls = 1 + ((1 + 0.1 * kick) * (1 + 0.25 * li) - 1) * (1 - h);
    ctx.scale(ls, ls);
    K.text(ctx, n.label, 0, 0, { size: L.size, font: F.bebas, color: C.fuchsia, alpha: lp, spacing: 3, stroke: 6, strokeColor: C.ink });
    if (li > 0.02) K.text(ctx, n.label, 0, 0, { size: L.size, font: F.bebas, color: C.text, alpha: lp * li * 0.75, spacing: 3 });
    ctx.restore();
  });
  ctx.restore();
}

/** Radial streaks sucked into the ring centre during the last beat. */
function drawSuck(ctx, K, lt) {
  const { C, seg, rgba, rng } = K;
  const k = seg(lt, DUR - 0.45, DUR - 0.1);
  if (k <= 0) return;
  const R = rng(512);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + R() * 0.12;
    const sp = 1.6 + R() * 1.4;
    const ph = (((R() + lt * sp) % 1) + 1) % 1;
    const r1 = 980 - 640 * ph;
    const len = 60 + 160 * R();
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.strokeStyle = rgba(i % 3 ? C.violet2 : C.fuchsia, 0.5 * k * Math.sin(ph * Math.PI));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(RING.x + c * r1, RING.y + s * r1);
    ctx.lineTo(RING.x + c * (r1 + len), RING.y + s * (r1 + len));
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ cards
/** Slam card with a reduced overshoot (first frame ≈ 1,2× instead of 3,2×) clipped to the safe top edge. Returns its local time. */
function slamCard(ctx, f, K, c, y) {
  const { C, E, seg, clamp, rgba, F } = K;
  const t0 = f.at(c.bar, c.beat);
  const d = c.durBeats * BEAT;
  const lt = since(f.lt, t0);
  if (lt < 0 || lt > d) return null;
  const subSize = 54;
  const pIn = lt / Math.min(d, BEAT);
  const out = seg(lt, d - BEAT * 0.25, d);
  const sz = K.fitSize(ctx, c.text, 1400, 150, F.anton);
  const cy = c.sub ? y - subSize * 0.7 : y;
  ctx.save();
  ctx.globalAlpha *= 1 - E.inQuad(out);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 54, 1920, 1026);
  ctx.clip();
  K.slamText(ctx, c.text, 960, cy, { size: sz, p: 0.35 + 0.65 * clamp(pIn * 1.4), emph: c.emph });
  ctx.restore();
  if (c.sub) {
    const sp = E.outCubic(seg(lt, BEAT * 0.4, BEAT * 1.2));
    const sy = cy + sz * 0.72 + subSize * 0.4;
    ctx.globalAlpha *= sp;
    const sw = K.measure(ctx, c.sub, subSize, (px) => F.inter(px, 700));
    ctx.fillStyle = rgba(C.ink, 0.65);
    ctx.fillRect(960 - sw / 2 - 24, sy - subSize * 0.8, (sw + 48) * sp, subSize * 1.6);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(960 - sw / 2 - 24, sy - subSize * 0.8, 6, subSize * 1.6);
    K.text(ctx, c.sub, 960, sy, { size: subSize, font: (px) => F.inter(px, 700), color: C.text2 });
  }
  ctx.restore();
  return lt;
}

export default {
  id: 'S02',
  startBar: 4,
  endBar: 8,
  transitionOut: 'zoom',
  cards,
  draw(ctx, f, K) {
    const { C, E, seg, clamp, rgba } = K;
    const lt = f.lt;

    // ---- pre-state while the slash comes in: no board, only the night and the cut
    if (lt < 0) {
      K.background(ctx, f, { intensity: 0.95 });
      ctx.fillStyle = rgba(C.ink, 0.6);
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.save();
      ctx.translate(960, 540);
      ctx.rotate(SLASH_ANG);
      ctx.fillStyle = rgba(C.fuchsia2, 0.25);
      ctx.fillRect(-1200, -7, 2400, 14);
      ctx.fillStyle = C.fuchsia2;
      ctx.fillRect(-1200, -1.5, 2400, 3);
      ctx.restore();
      return { auto: false, shake: 0, rgb: 0, zoom: 0, flash: 0 };
    }

    const hb = heartbeat(lt);
    const hbPulse = bump(hb.s) * hb.w;
    const xf = boardXf(lt, K);

    // background dive into the ring before the zoom transition (the ring itself holds its place)
    const dive = E.inCubic(seg(lt, DUR - 0.4, DUR + 0.1));
    ctx.save();
    if (dive > 0) {
      const z = 1 + 0.6 * dive;
      ctx.translate(RING.x, RING.y);
      ctx.scale(z, z);
      ctx.translate(-RING.x, -RING.y);
    }
    K.background(ctx, f, { intensity: 0.95 });
    K.particles(ctx, f, { count: 70, speed: 0.25, size: 1.6, seed: 31, alpha: 0.55 });
    K.particles(ctx, f, { count: 45, speed: 0.45, size: 2.4, seed: 32, alpha: 0.7 });
    K.particles(ctx, f, { count: 18, speed: 0.75, size: 3.6, seed: 33, alpha: 0.75, colors: [C.fuchsia, C.violet2] });

    // board
    if (xf.flip > 0.001) {
      if (lt < 4 / 60) boardGhosts(ctx, K, xf, 1 - lt / (4 / 60));
      drawBoard(ctx, f, K, lt, xf, hbPulse);
      drawBoardLife(ctx, f, K, lt, xf);
      drawSpam(ctx, K, lt, xf);
    }
    // flip flash line when the board folds away
    const fl = seg(lt, T_B7 - 0.1, T_B7 + 0.06);
    if (fl > 0 && fl < 1) {
      const a = Math.sin(fl * Math.PI);
      const w = 1160 * (1 - 0.6 * seg(lt, T_B7, T_B7 + 0.06));
      ctx.save();
      ctx.translate(CX + xf.ox, CY);
      ctx.rotate(Math.PI / 60);
      ctx.fillStyle = rgba(C.fuchsia, 0.85 * a);
      ctx.fillRect(-w / 2, -2, w, 4);
      ctx.fillStyle = rgba(C.text, 0.7 * a);
      ctx.fillRect(-w / 4, -1, w / 2, 2);
      ctx.restore();
    }

    // foreshadow panel: dim, then lit (and the real curve sharpens) as the facts land
    const lit = E.outCubic(seg(lt, T_B6 + 0.3, T_B7)) * 0.75 + 0.25 * E.outCubic(seg(lt, T_B7, T_B7 + 0.3));
    const colorMix = E.inOutSine(seg(lt, T_B6 + 0.2, T_B7 + 0.4));
    drawPanel(ctx, f, K, lt, lit, colorMix);
    if (lt >= T_B6) drawSquares(ctx, K, lt, (t) => boardXf(t, K));
    drawSuck(ctx, K, lt);
    ctx.restore();

    // loop ring: fixed geometry (960,640) r 230, the hand-off point S03 pins its ring to
    drawLoopRing(ctx, f, K, lt);

    // ---- cards (top third), drawn outside any camera transform
    let entering = Infinity;
    for (const c of f.cardsOf) {
      if (!c.sceneDrawn) continue;
      const clt = slamCard(ctx, f, K, c, c.bar === 7 ? CARD_Y7 : CARD_Y);
      if (clt != null) entering = Math.min(entering, clt);
    }
    K.renderCards(ctx, f, f.cardsOf, { x: 960, y: CARD_Y, size: 150, subSize: 54, maxW: 1400 });
    const jag = f.at(5, 0);
    if (lt >= jag && lt < jag + 0.3) entering = Math.min(entering, lt - jag);

    // brand bug (visible from the bar-4 impact), dimmed while a card slams in under it
    const bugA = 0.55 - 0.35 * (1 - seg(entering, 0.15, 0.3));
    K.logo(ctx, 1772, 62, 150, { alpha: bugA, glow: 6, lineWidth: 2.4, draw: E.outCubic(seg(lt, 0, 0.5)) });

    // ---- FX
    // bar-4 impact: own soft values (no red-heavy auto split); bar-6 brass stab: visible hit
    const fx = { shake: lt >= T_B6 ? (lt < T_B7 ? 4 : 2.5) * f.kick : 0 };
    if (lt < 0.3) {
      const imp = Math.exp(-lt * 5);
      Object.assign(fx, { auto: false, shake: 26 * imp, rgb: 6 * imp, zoom: 0.05 * imp, flash: 0.45 * Math.exp(-lt * 18) });
    }
    if (lt >= T_B6 - 1e-6) {
      const s = Math.max(0, lt - T_B6);
      fx.zoom = (fx.zoom || 0) + 0.03 * Math.exp(-s * 12);
      fx.rgb = (fx.rgb || 0) + 6 * Math.exp(-s * 20);
    }
    void clamp;
    return fx;
  },
};
