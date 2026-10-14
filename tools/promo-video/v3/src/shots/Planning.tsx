// Shot 7 — Planning (k60–68, 111f). Shot card ui-entrance/row-embed on the real "Le rendez-vous du cinq" card.
//
// Hard cut (k60) into a close-up of the card without its session programme: the agenda band is collapsed and the
// lower section (separator, "Le cinq au rendez-vous", the five roles, still pending) sits right under the session
// goal. The slot opens — the lower section slides down and makes room (brand ease, done by f12) — and the three real
// agenda items drop in on the bar's accents, k61 / k62 / k62.5 (13f → 7f, accelerating; k63 is a stop in the music),
// with the demo's flight: perspective(900px) translateY(−120·air, in screen terms) rotateX(16°·air), scale
// 1.06 → 0.995 then a 4f press back to 1, landing exactly in their layout slots (Q9). The flying body is an opaque
// slab — a lifted surface (#24314C, violet 1px edge, deep shadow) that settles to the card's own background on
// touchdown — and the item text only fades in once the slab is opaque, so nothing ever reads text-on-text. On
// touchdown a 2px cyan seam runs from the item's node along its timeline segment and fades (5f / 8f, the recipe's
// "visual foley"); the three seams chain into one "timeline connecting" gesture, clipped to each item's box (Q4).
// While the rows land, the upper card (event, goal) is dimmed so the landings are the only hero (Q5).
//
// Camera (one continuous arc, no pan): the card's real left edge is anchored at x = 940 (clear of the caption) for
// the whole shot; a single monotone zoom spline 1.66 → 1.03 pulls back from the frame's right edge so slots 2–3 are
// revealed as they land (all three items are on screen at the last landing) and lands on the bar's strongest hit
// (k64), whole card in frame, turned 2° toward the caption. The availability block completes as a wave of light from
// the card's own pixels while the pull settles: the five role cells, veiled while pending, brighten TOP → SUP with
// their checks (accelerating, f45 → f54, the last one on k64) and the real "5 / 5 disponibles" counter settles with
// them (f51 → f63). The complete state — whole card, five checks, 5 / 5 — is HELD still for ≈ 10 f (f55–65, k64 →
// k65, review 2 N6). Then the light leaves the card's left part (TOP/JGL/MID and everything left of the ADC cell,
// f64–70) before the payoff push moves it: f66 → k66.5 (f90) the camera pushes into the roles strip, the counter
// travelling on a straight screen line while the zoom grows log-linearly 1.03 → 2.8 (fast frames get a light camera
// blur), and lands with the counter's 12px CSS type at 33.6px on screen (Q11), next to the caption's second line,
// with the ADC / SUP cells and their checks under it. Everything above the roles section recedes during the push
// (Q5). The card's left edge in frame is a deliberate soft vertical fade (screen x 888 → 1015, 127 px, clear of the
// caption), and since the left part is already veiled when it slides through it, no half word is ever readable. No
// dead freeze: from f90 to the cut the camera keeps creeping into the counter (+1.2 %, anchored on it, transform
// scale over a fixed CSS zoom, so no raster re-snapping); the counter is settled 21 f (0.7 s) before the cut.
// CSS zoom keeps the 2x textures rasterised at their final size during the moves (Q2); no shake, no frame-level
// pulse (Q3/R4); the stage is flat (no preserve-3d) so flyers never intersect the card plane. Caption: eyebrow
// present on the cut, settled by ≈ f30 and held ≈ 2.7 s (R1/R3).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT } from '../theme';
import { localBeat, SHOTS } from '../timeline';
import { Backdrop, FeatureTitle, FictiveTag, Glow } from '../lib/ui';
import { clamp, EASE, lerp } from '../lib/motion';
import layout from '../layout.json';

const B = (k: number) => localBeat(SHOTS.planning, k);

// ── card (page space = CSS px of the planning card, 881×819; textures are 2x) ──
const P = layout.planning;
const W = P.w;
const H = P.h;
const EMPTY = staticFile(layout['planning-empty'].file);
const FULL = staticFile(P.file);
const RADIUS = 13; // measured on the texture (26px at 2x)
const CARD_BG = [24, 34, 53] as const; // the card's flat background, measured
const LIFT_BG = [36, 49, 76] as const; // #24314C: the airborne slab's lifted surface
const rgb = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => lerp(v, b[i], t));

// ── band (the agenda strip): blank card background from 527 to 639 in planning-empty ──
const BAND_TOP = 536; // lock crop: rows 536–626 hold the agenda in 'planning'
const BAND_BOT = 626;
const LOWER_Y = 634; // the lower section (separator at 640 → card bottom) is moved as one slice
const GAP = 84; // collapsed height: agenda height (59.5) + its top gap (24)
const OPEN = [0, 12] as const; // band opens on the cut, done before row 1 lands

// ── agenda items ──
const ROWS = ([1, 2, 3] as const).map((i) => {
  const a = layout[`agenda-${i}`];
  return {
    src: staticFile(a.file),
    x: a.offset.x,
    y: a.offset.y,
    w: a.w,
    h: a.h,
    box: { x: a.offset.x + a.boxes.content.x, y: a.offset.y + a.boxes.content.y, w: a.boxes.content.w, h: a.boxes.content.h },
  };
});
const LAND = [B(61), B(62), B(62.5)]; // 14, 27, 34 — accelerating (13f → 7f) on the bar's accents (k63 is a stop)
const FLY = 12;
const FLY_EASE = Easing.bezier(0.3, 0, 0.25, 1); // demo value
const LINE_Y = 551.5; // centre of the timeline track inside each item (2x rows 1102–1103 of the card)
const NODE = 4; // the item's node (diamond) sits ≈ 3px right of its box: the seam starts there
const LOCK = [LAND[2] + 9, LAND[2] + 15] as const; // band → real filled texture, after the last seam

// ── focus veil (Q5): the event + goal block is dimmed while the rows land, lifted with the pull-back; what the
// pull-back reveals above the divider (week title, day cells) enters dimmer still ──
const DIM_BOT = 530; // full strength down to the goal's bottom edge, fading to 0 at 540 (band starts at 551)
const DIM_TOP = 0.62; // above the divider (CSS y < 262)
const DIM = [LAND[2], B(64)] as const;

// ── camera ──
const PULL_END = B(64); // 55: the pull lands on the bar's strongest hit
type Keys = readonly (readonly [number, number])[];
const Z_KEYS: Keys = [[0, 1.66], [14, 1.58], [27, 1.42], [34, 1.32], [PULL_END, 1.03]]; // one monotone spline
const Z_CLOSE = 1.66;
const Z_WIDE = 1.03;
// payoff push into the roles strip: after the hold, f66 → k66.5 (f90; eased in, so it really moves from k65 = f69,
// fastest ≈ f75, lands on the bar's strong k66.5 onset), then a slow creep until the cut (k68, f111)
const PUSH = [66, B(66.5)] as const;
const END = B(68); // 111
const PUSH_EASE = Easing.bezier(0.4, 0, 0.25, 1);
const Z_PUSH = 2.8; // the counter is 12px CSS (product-story.css .ps-ready-heading) → 33.6px on screen (≥ 32 with margin)
const CREEP = 0.012; // f90 → cut: +1.2 % (transform scale over the fixed CSS zoom)
// past this push progress (≈ f75, while the push is at its fastest, so the one-time raster re-snap is invisible) the
// CSS zoom is fixed at Z_PUSH and the rest of the push is a transform scale: the slow landing never re-snaps
const RASTER_LOCK = 0.45;
const FLAT_AT = 0.6; // push progress at which the card has turned back to face the frame (rotY 0, flat 2D path)
const PUSH_TARGET = { x: 791.3, y: 671.8 }; // centre of the real counter (layout readyCount)
const PUSH_CORNER = { x: W, y: H, sx: 1880, sy: 925 }; // final framing: card's bottom-right corner on screen, clear of the tag
// the card's left edge in the push framing: a soft vertical fade in screen space (the caption ends at x 880), ramped in
// as the push starts; the left part is veiled first (LEFT_VEIL), so only veiled card surface ever crosses it
const MASK_X = [888, 1015] as const;
const MASK_T = [66, 71] as const;
// left-part veil (review 2 N6): everything left of the ADC cell (MID cell ends at CSS x 518, ADC starts at 528) dims
// to the night before the push carries it toward the caption — the light moves onto ADC / SUP and the counter. Its
// edge is a soft falloff over the MID cell's text-free right part (MID label ends ≈ 455), so it reads as light,
// not as a cut; the upper card goes dark on the same ramp (UPPER_VEIL_A), so the falloff only crosses the lower band
const LEFT_VEIL_X = [470, 527] as const;
// …and the whole MID cell (its check and accent bar sit inside that falloff) goes fully dark up to its own border,
// so the edge of the light is a real cell edge, with no stray check left at the frame's soft edge
const LEFT_VEIL_T = [64, 70] as const;
const LEFT_VEIL_A = 0.98;
// camera blur on the fastest push frames only (recipe: ≥ 30 px/f strobes at 30 fps); measured on the ADC cell
const BLUR_PT = { x: 600, y: 740 };
const ROT_Y: Keys = [[0, 4], [34, 0.5], [PULL_END, -2]]; // the card swings to face the caption (−) as it pulls back
const ROT_X: Keys = [[0, 4], [PULL_END, 0]];
const AX = 1400; // pivot / perspective origin (screen)
const AY = 540;
const CX_END = PUSH_CORNER.x - (PUSH_CORNER.sx - AX) / Z_PUSH; // look-at of the push's final framing
const CY_END = PUSH_CORNER.y - (PUSH_CORNER.sy - AY) / Z_PUSH;
const Q_X = AX + (PUSH_TARGET.x - CX_END) * Z_PUSH; // final screen position of the counter: the creep's fixed point
const Q_Y = AY + (PUSH_TARGET.y - CY_END) * Z_PUSH;
const PERSP = 1400;
const LEFT = 940; // screen x of the card's real left edge (card x = 0): the caption ends ≈ 874
const TOP_CSS = 262; // the divider above the event: pinned to the frame top in the close-up
const TY_CLOSE = -10; // close-up: the divider sits ≈ 8px under the frame top once rotateX is applied
const REVEAL = 1.25; // the top of the card enters a little later than the zoom (clean top until row 1 lands)
const TY_WIDE = 90 + TOP_CSS * Z_WIDE; // wide: card top at y 90, bottom ≈ 934, tag seated under it

// ── availability: role cells (veiled while pending), checks (2x bboxes measured on the texture), real counter ──
const CELLS = P.boxes.roleCards;
const MID = CELLS[2]; // the MID cell: fully veiled with the left part (see LEFT_VEIL_X)
const CHECKS = CELLS.map((c) => ({ x: c.x + c.w - 17.5, y: 704.5, w: 12, h: 9.5 }));
const CHECK_T = [45, 48, 50.5, 52.5, 54]; // TOP → SUP, accelerating into k64 (f55): all five lit as the pull lands
const LIFT = 6;
const VEIL_A = 0.6;
// the cells' own vertical gradient (17,24,39) at y 697 → (30,42,62) at y 783: the veil is invisible on the cell
// background and only dims the icon and label
const CELL_Y0 = 699;
const CELL_Y1 = 781; // above the accent bar (783–785)
const cellBg = (y: number) => mix([17, 24, 39], [30, 42, 62], (y - 697) / 86);
const COUNTER = { x: 732, y: 663, w: 118, h: 19 };
const COUNTER_T = PULL_END; // 55: k64, the bar's strongest hit, with the last check
const COUNTER_IN = [COUNTER_T - 4, COUNTER_T + 8] as const; // 51 → 63, settled before the hold ends
const DONE = COUNTER_IN[1] + 1; // every overlay equals the real texture from here: render it alone
// push veil (Q5): everything above the roles section (separator at CSS y 640) recedes while the camera pushes in: the
// upper card (event, goal, days; down to the goal's bottom at 527) goes dark with the left veil, the agenda row
// (21:45 Débrief à chaud stays in the final framing) only dims with the push
const PUSH_VEIL_BOT = 632;
const PUSH_VEIL_A = 0.45;
const UPPER_VEIL_BOT = 524; // soft step 524 → 548 (goal box ends at 527, the agenda track runs at 551)
const UPPER_VEIL_A = 0.9;

/** Monotone cubic Hermite (Fritsch–Butland): first key keeps its secant velocity (opens moving), last key settles. */
function spline(f: number, keys: Keys): number {
  const n = keys.length;
  if (f <= keys[0][0]) return keys[0][1];
  if (f >= keys[n - 1][0]) return keys[n - 1][1];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(keys[i + 1][0] - keys[i][0]);
    d.push((keys[i + 1][1] - keys[i][1]) / h[i]);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  let i = 0;
  while (i < n - 2 && f > keys[i + 1][0]) i++;
  const t = (f - keys[i][0]) / h[i];
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * h[i] * m[i + 1]
  );
}

type Cam = { zoom: number; css: number; s: number; cx: number; cy: number; rotY: number; rotX: number; q: number; push: number; creep: number };

/**
 * Pull-back camera for local frame f ≤ PULL_END. The card point (0, cy) — its real left edge on the pivot row — is
 * solved through the perspective so it lands exactly on screen x = LEFT (the look-at follows the zoom; nothing pans).
 * Vertically the divider above the event (CSS y 262) goes from the frame top (close-up) to its wide position, driven
 * by the zoom.
 */
function pullCamera(f: number): Cam {
  const zoom = spline(f, Z_KEYS);
  const q = Math.log(Z_CLOSE / zoom) / Math.log(Z_CLOSE / Z_WIDE); // pull progress (log-zoom), 0 close → 1 wide
  const rotY = spline(f, ROT_Y);
  const rotX = spline(f, ROT_X);
  const ty = lerp(TY_CLOSE, TY_WIDE, Math.pow(q, REVEAL));
  const d = PERSP * zoom;
  const th = (rotY * Math.PI) / 180;
  const sx = LEFT - AX;
  const u = (sx * d) / (d * Math.cos(th) - sx * Math.sin(th)); // screen offset of the left edge before rotateY
  // CSS zoom (crisp, fast enough to render every frame)
  return { zoom, css: zoom, s: 1, cx: -u / zoom, cy: TOP_CSS + (AY - ty) / zoom, rotY, rotX, q, push: 0, creep: 0 };
}
const WIDE = pullCamera(PULL_END);

/**
 * Payoff push (f > PULL_END): log-linear zoom WIDE → Z_PUSH; the counter's screen position moves on a straight line
 * from where the wide framing shows it to where the final framing puts it (card corner at PUSH_CORNER), so the camera
 * visibly travels toward it; the card turns back from −2° to face the frame as it comes (flat from e 0.6). Then a slow
 * creep (transform scale about the counter, over the fixed CSS zoom) keeps the frame alive until the cut. The stage is
 * rendered without perspective once flat (Scene): a slowly changing transform under a perspective re-snaps by up to
 * ±0.3 px every few frames (measured), the plain 2D path is sub-pixel smooth.
 */
function pushCamera(f: number): Cam {
  const e = interpolate(f, [...PUSH], [0, 1], { ...clamp, easing: PUSH_EASE });
  const c = interpolate(f, [PUSH[1], END], [0, 1], clamp);
  const z = WIDE.zoom * Math.pow(Z_PUSH / WIDE.zoom, e);
  const T = PUSH_TARGET;
  const sx = lerp(AX + (T.x - WIDE.cx) * WIDE.zoom, Q_X, e);
  const sy = lerp(AY + (T.y - WIDE.cy) * WIDE.zoom, Q_Y, e);
  const cx = T.x - (sx - AX) / z;
  const cy = T.y - (sy - AY) / z;
  // creep about the counter's final screen position: the payoff stays still (no reversal after the landing) while
  // the rest of the frame keeps opening slowly around it
  const zc = z * (1 + CREEP * c);
  const css = e < RASTER_LOCK ? z : Z_PUSH;
  return {
    zoom: zc, css, s: zc / css,
    cx: cx + (Q_X - AX) / z - (Q_X - AX) / zc,
    cy: cy + (Q_Y - AY) / z - (Q_Y - AY) / zc,
    rotY: -2 * Math.max(0, 1 - e / FLAT_AT), rotX: 0, q: 1, push: e, creep: c,
  };
}

const camera = (f: number): Cam => (f <= PULL_END ? pullCamera(f) : pushCamera(f));

/** Screen point of a card point (flat approximation: the 2° turn is ignored), for the blur speed. */
const screenOf = (c: Cam, x: number, y: number) => ({ x: AX + (x - c.cx) * c.zoom, y: AY + (y - c.cy) * c.zoom });
const camBlur = (f: number) => {
  if (f <= PUSH[0] || f > PUSH[1]) return 0;
  const a = screenOf(camera(f - 1), BLUR_PT.x, BLUR_PT.y);
  const b = screenOf(camera(f), BLUR_PT.x, BLUR_PT.y);
  return Math.max(0, Math.min(1.4, (Math.hypot(b.x - a.x, b.y - a.y) - 30) / 16));
};

/** A window (x, y, w, h) of a card texture, showing the texture's own pixels from (sx, sy). */
const Crop: React.FC<{ src: string; x: number; y: number; w: number; h: number; sx?: number; sy?: number; style?: React.CSSProperties }> = ({
  src, x, y, w, h, sx = x, sy = y, style,
}) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', ...style }}>
    <Img src={src} style={{ position: 'absolute', left: -sx, top: -sy, width: W, height: H, maxWidth: 'none' }} />
  </div>
);


const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const g = GAP * (1 - interpolate(f, [OPEN[0], OPEN[1]], [0, 1], { ...clamp, easing: EASE }));
  const cardH = H - g;
  const cam = camera(f);
  const lock = interpolate(f, [LOCK[0], LOCK[1]], [0, 1], clamp);
  const dimK = 1 - interpolate(f, [DIM[0], DIM[1]], [0, 1], { ...clamp, easing: EASE });
  const dim = 0.45 * dimK;
  const dimTop = DIM_TOP * dimK;
  const done = f >= DONE;
  const veilT = interpolate(f, [LEFT_VEIL_T[0], LEFT_VEIL_T[1]], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const pushVeil = PUSH_VEIL_A * cam.push;
  const upperVeil = Math.max(pushVeil, UPPER_VEIL_A * veilT);
  const leftVeil = LEFT_VEIL_A * veilT;
  // screen-space soft left edge, ramped in with the push (1 = no mask)
  const m = interpolate(f, [MASK_T[0], MASK_T[1]], [0, 1], clamp);
  const mask = m > 0 ? `linear-gradient(to right, rgba(0,0,0,${(1 - m).toFixed(4)}) ${MASK_X[0]}px, #000 ${MASK_X[1]}px)` : undefined;
  const blur = camBlur(f);
  const flat = cam.rotY === 0 && cam.rotX === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${1.04 + 0.05 * (1 - cam.q) + 0.05 * cam.push + 0.006 * cam.creep})` }}>
        <Backdrop dim={0.42} />
      </AbsoluteFill>
      {/* ambient pools (screen space): violet matter under the card, cyan guide, fuchsia counter-light */}
      <Glow x={1380} y={760} r={640} color={C.glowViolet} />
      <Glow x={960} y={200} r={420} color={C.glowCyan} />
      <Glow x={1890} y={300} r={380} color={C.glowFuchsia} />

      {/* camera: lens-shifted 2.5D look-at, CSS zoom (crisp 2x texture), flat stage */}
      <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: mask, maskImage: mask, ...(blur > 0.05 ? { filter: `blur(${blur.toFixed(2)}px)` } : {}) }}>
      {/* flat once the card faces the frame (push landing → cut): no perspective, plain 2D transform (smooth creep) */}
      <div style={{ position: 'absolute', inset: 0, ...(flat ? {} : { perspective: `${PERSP * cam.zoom}px`, perspectiveOrigin: `${AX}px ${AY}px` }) }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: W, height: H, zoom: cam.css,
            transform: `translate(${AX / cam.css - cam.cx}px, ${AY / cam.css - cam.cy}px)${flat ? '' : ` rotateY(${cam.rotY}deg) rotateX(${cam.rotX}deg)`}${
              cam.s !== 1 ? ` scale(${cam.s.toFixed(6)})` : ''
            }`,
            transformOrigin: `${cam.cx}px ${cam.cy}px`,
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: cardH, borderRadius: RADIUS, boxShadow: '0 30px 80px rgba(2,6,17,.55)' }} />

          {/* the real card: one base image clipped to the current height + the lower section as one moving slice */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: cardH, borderRadius: RADIUS, overflow: 'hidden' }}>
            <Img src={done ? FULL : EMPTY} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
            {!done ? (
              <>
                {g > 0.01 ? <Crop src={EMPTY} x={0} y={LOWER_Y - g} w={W} h={H - LOWER_Y} sx={0} sy={LOWER_Y} /> : null}
                {/* availability pending: clone-stamp the card's own background over the checks and the counter */}
                {CHECKS.map((c, i) =>
                  f < CHECK_T[i] + 7 ? <Crop key={`p${i}`} src={EMPTY} x={c.x} y={c.y - g} w={c.w} h={c.h} sx={c.x - 30} sy={c.y} /> : null,
                )}
                {f < COUNTER_IN[1] + 1 ? (
                  <Crop src={EMPTY} x={COUNTER.x} y={COUNTER.y - g} w={COUNTER.w} h={COUNTER.h} sx={COUNTER.x - 300} sy={COUNTER.y} />
                ) : null}
                {/* pending role cells: a veil in the cell's own gradient dims icon + label; it lifts with the check */}
                {CELLS.map((c, i) => {
                  const a = VEIL_A * (1 - interpolate(f, [CHECK_T[i], CHECK_T[i] + LIFT], [0, 1], { ...clamp, easing: EASE }));
                  return a > 0.002 ? (
                    <div
                      key={`v${i}`}
                      style={{
                        position: 'absolute', left: c.x + 4, top: CELL_Y0 - g, width: c.w - 8, height: CELL_Y1 - CELL_Y0, opacity: a,
                        background: `linear-gradient(180deg, ${rgb(cellBg(CELL_Y0))}, ${rgb(cellBg(CELL_Y1))})`,
                      }}
                    />
                  ) : null;
                })}
                {/* checks tick in TOP → SUP, above their lifting veil */}
                {CHECKS.map((c, i) => {
                  const p = interpolate(f, [CHECK_T[i], CHECK_T[i] + 7], [0, 1], { ...clamp, easing: EASE });
                  return p > 0 ? (
                    <Crop
                      key={`c${i}`} src={FULL} x={c.x} y={c.y} w={c.w} h={c.h}
                      style={{ opacity: Math.min(1, p * 1.6), transform: `scale(${0.4 + 0.6 * p})`, transformOrigin: 'center center' }}
                    />
                  ) : null;
                })}
                {/* the real counter settles on the bar's strongest onset */}
                {(() => {
                  const p = interpolate(f, [COUNTER_IN[0], COUNTER_IN[1]], [0, 1], { ...clamp, easing: EASE });
                  return p > 0 ? (
                    <Crop
                      src={FULL} x={COUNTER.x} y={COUNTER.y} w={COUNTER.w} h={COUNTER.h}
                      style={{ opacity: p, transform: `translateX(${(1 - p) * 14}px)`, filter: p < 1 ? `blur(${(1 - p) * 4}px)` : undefined }}
                    />
                  ) : null;
                })()}
                {/* band locks to the real filled texture */}
                {lock > 0 ? <Crop src={FULL} x={0} y={BAND_TOP} w={W} h={BAND_BOT - BAND_TOP} style={{ opacity: lock }} /> : null}
                {/* focus veil over the upper card while the rows land (a dim, not a light) */}
                {dimK > 0.004 ? (
                  <div
                    style={{
                      position: 'absolute', left: 0, top: 0, width: W, height: DIM_BOT + 10,
                      background: `linear-gradient(180deg, rgba(17,24,39,${dimTop}) 0px, rgba(17,24,39,${dimTop}) ${TOP_CSS - 6}px, rgba(17,24,39,${dim}) ${TOP_CSS + 4}px, rgba(17,24,39,${dim}) ${DIM_BOT}px, rgba(17,24,39,0) ${DIM_BOT + 10}px)`,
                    }}
                  />
                ) : null}
              </>
            ) : null}
            {/* left-part veil: TOP / JGL / MID and everything left of the ADC cell go dark before the push moves them */}
            {leftVeil > 0.004 ? (
              <div
                style={{
                  position: 'absolute', left: 0, top: 0, width: LEFT_VEIL_X[1], height: H,
                  background: `linear-gradient(90deg, rgba(17,24,39,${leftVeil.toFixed(4)}) ${LEFT_VEIL_X[0]}px, rgba(17,24,39,0) ${LEFT_VEIL_X[1]}px)`,
                }}
              />
            ) : null}
            {leftVeil > 0.004 ? (
              <div
                style={{
                  position: 'absolute', left: MID.x - 1, top: MID.y - 1, width: MID.w + 2, height: MID.h + 2, borderRadius: 6,
                  background: `rgba(17,24,39,${leftVeil.toFixed(4)})`,
                }}
              />
            ) : null}
            {/* push veil: the roles section stays the only lit part while the camera pushes in */}
            {upperVeil > 0.004 ? (
              <div
                style={{
                  position: 'absolute', left: 0, top: 0, width: W, height: PUSH_VEIL_BOT + 10,
                  background: `linear-gradient(180deg, rgba(17,24,39,${upperVeil.toFixed(4)}) 0px, rgba(17,24,39,${upperVeil.toFixed(4)}) ${UPPER_VEIL_BOT}px, rgba(17,24,39,${pushVeil.toFixed(4)}) ${UPPER_VEIL_BOT + 24}px, rgba(17,24,39,${pushVeil.toFixed(4)}) ${PUSH_VEIL_BOT}px, rgba(17,24,39,0) ${PUSH_VEIL_BOT + 10}px)`,
                }}
              />
            ) : null}
          </div>

          {/* agenda items: drop from the air and embed in their slots */}
          {!done && lock < 1
            ? ROWS.map((r, i) => {
                const land = LAND[i];
                const cue = land - FLY;
                if (f < cue) return null;
                const p = interpolate(f, [cue, land], [0, 1], { ...clamp, easing: FLY_EASE });
                const slab = interpolate(f, [cue, cue + 2], [0, 1], clamp); // surface + shadow first…
                const text = interpolate(f, [cue + 1, cue + 4], [0, 1], clamp); // …the item only once the slab is opaque
                const scale =
                  f < land ? 1.06 - 0.065 * p : interpolate(f, [land, land + 4], [0.995, 1], { ...clamp, easing: Easing.out(Easing.quad) });
                const air = 1 - p;
                const atRest = f >= land + 4;
                const drop = -120 * (1.1 / cam.zoom) * air; // the demo's on-screen fall (its camera sits at zoom 1.1)

                // embed seam: 2px cyan from the item's node along its timeline segment, clipped to its box
                let seam: React.ReactNode = null;
                if (f >= land && f < land + 8) {
                  const spread = interpolate(f, [land, land + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
                  const o = interpolate(f, [land, land + 2, land + 8], [1, 1, 0], clamp);
                  seam = (
                    <div style={{ position: 'absolute', left: r.box.x, top: LINE_Y - 8, width: r.box.w, height: 16, overflow: 'hidden', pointerEvents: 'none' }}>
                      <div
                        style={{
                          position: 'absolute', left: NODE, top: 7, width: (r.box.w - NODE) * spread, height: 2, borderRadius: 1,
                          background: C.cyan, boxShadow: '0 0 6px rgba(103,232,249,.55)', opacity: o,
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <React.Fragment key={i}>
                    {/* flying body = an opaque slab like the demo's texture crop: a lifted surface in the air that
                        settles to the card's own background on touchdown, so it occludes what it passes over */}
                    <div
                      style={{
                        position: 'absolute', left: r.box.x - 2, top: r.y, width: r.box.w + 2, height: r.h, borderRadius: 8,
                        backgroundColor: rgb(mix(LIFT_BG, CARD_BG, p)), overflow: 'hidden', opacity: slab,
                        transform: atRest ? undefined : `perspective(900px) translateY(${drop}px) rotateX(${16 * air}deg) scale(${scale})`,
                        boxShadow:
                          atRest || air <= 0
                            ? undefined
                            : `inset 0 0 0 1px rgba(196,181,253,${0.28 * air}), 0 ${24 * air}px ${48 * air}px rgba(0,0,0,${0.6 * air})`,
                      }}
                    >
                      <Img
                        src={r.src}
                        style={{ position: 'absolute', left: r.x - r.box.x + 2, top: 0, width: r.w, height: r.h, maxWidth: 'none', opacity: text }}
                      />
                    </div>
                    {seam}
                  </React.Fragment>
                );
              })
            : null}
        </div>
      </div>
      </div>

      {/* Données fictives: shared bottom-right slot, under the card's right edge (wide) and its bottom-right corner (push) */}
      <FictiveTag />
      <FeatureTitle eyebrow="PLANNING" l1="Planifie la" l2="prochaine séance." start={0} />
    </AbsoluteFill>
  );
};

export const Planning: React.FC = () => <Scene />;
