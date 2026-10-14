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
// (k64), whole card in frame, turned 2° toward the caption. Then the availability block completes as a wave of light
// from the card's own pixels: the five role cells, veiled while pending, brighten TOP → SUP with their checks
// (accelerating, k64 → k65), and the real "5 / 5 disponibles" counter settles on the bar's strongest onset (k65.5),
// during a slow push toward the roles strip (transform scale over a fixed CSS zoom, so it renders continuously).
// From f90 the frame is frozen (identical frames) until the cut. CSS zoom keeps the 2x textures rasterised at their
// final size (Q2); no shake, no frame-level pulse (Q3/R4); the stage is flat (no preserve-3d) so flyers never
// intersect the card plane. Caption: eyebrow present on the cut, settled by ≈ f30 and held ≈ 2.7 s (R1/R3).
import React from 'react';
import { AbsoluteFill, Easing, Freeze, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT } from '../theme';
import { localBeat, SHOTS } from '../timeline';
import { Backdrop, BlurLine, FictiveTag, Glow } from '../lib/ui';
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
const HOLD = 90; // frozen from here to the cut (0.7 s of identical frames)
type Keys = readonly (readonly [number, number])[];
const Z_KEYS: Keys = [[0, 1.66], [14, 1.58], [27, 1.42], [34, 1.32], [PULL_END, 1.03]]; // one monotone spline
const Z_CLOSE = 1.66;
const Z_WIDE = 1.03;
const Z_PUSH = 1.075; // slow push toward the roles strip (k64 → f90), CSS zoom fixed here, transform scale below it
const PUSH_EASE = Easing.bezier(0.42, 0, 0.38, 1);
const ROT_Y: Keys = [[0, 4], [34, 0.5], [PULL_END, -2]]; // the card swings to face the caption (−) as it pulls back
const ROT_X: Keys = [[0, 4], [PULL_END, 0]];
const AX = 1400; // pivot / perspective origin (screen)
const AY = 540;
const PERSP = 1400;
const LEFT = 940; // screen x of the card's real left edge (card x = 0): the caption ends ≈ 874
const LEFT_PUSH = 930;
const TOP_CSS = 262; // the divider above the event: pinned to the frame top in the close-up
const TY_CLOSE = -10; // close-up: the divider sits ≈ 8px under the frame top once rotateX is applied
const REVEAL = 1.25; // the top of the card enters a little later than the zoom (clean top until row 1 lands)
const TY_WIDE = 90 + TOP_CSS * Z_WIDE; // wide: card top at y 90, bottom ≈ 934, tag seated under it
const TY_PUSH = 46 + TOP_CSS * Z_PUSH; // pushed: card top at y 46, bottom ≈ 926, right edge ≈ 1876

// ── availability: role cells (veiled while pending), checks (2x bboxes measured on the texture), real counter ──
const CELLS = P.boxes.roleCards;
const CHECKS = CELLS.map((c) => ({ x: c.x + c.w - 17.5, y: 704.5, w: 12, h: 9.5 }));
const CHECK_T = [PULL_END + 1, PULL_END + 5, PULL_END + 8.5, PULL_END + 11.5, PULL_END + 14]; // 56 → 69 (k64 → k65), TOP → SUP
const LIFT = 6;
const VEIL_A = 0.6;
// the cells' own vertical gradient (17,24,39) at y 697 → (30,42,62) at y 783: the veil is invisible on the cell
// background and only dims the icon and label
const CELL_Y0 = 699;
const CELL_Y1 = 781; // above the accent bar (783–785)
const cellBg = (y: number) => mix([17, 24, 39], [30, 42, 62], (y - 697) / 86);
const COUNTER = { x: 732, y: 663, w: 118, h: 19 };
const COUNTER_T = B(65.5); // 76: strongest onset of the bar
const COUNTER_IN = [COUNTER_T - 5, COUNTER_T + 9] as const;
const DONE = COUNTER_IN[1] + 1; // every overlay equals the real texture from here: render it alone

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

/**
 * Camera for local frame f. The card point (0, cy) — its real left edge on the pivot row — is solved through the
 * perspective so it lands exactly on screen x = left (the look-at follows the zoom; nothing pans). Vertically the
 * divider above the event (CSS y 262) goes from the frame top (close-up) to its wide position, driven by the zoom.
 */
function camera(f: number) {
  let zoom: number;
  let rotY: number;
  let rotX: number;
  let left: number;
  let ty: number;
  let q: number; // pull progress (log-zoom), 0 close → 1 wide
  let push = 0;
  if (f <= PULL_END) {
    zoom = spline(f, Z_KEYS);
    q = Math.log(Z_CLOSE / zoom) / Math.log(Z_CLOSE / Z_WIDE);
    rotY = spline(f, ROT_Y);
    rotX = spline(f, ROT_X);
    left = LEFT;
    ty = lerp(TY_CLOSE, TY_WIDE, Math.pow(q, REVEAL));
  } else {
    push = interpolate(f, [PULL_END, HOLD], [0, 1], { ...clamp, easing: PUSH_EASE });
    zoom = lerp(Z_WIDE, Z_PUSH, push);
    q = 1;
    rotY = lerp(-2, -1.4, push);
    rotX = 0;
    left = lerp(LEFT, LEFT_PUSH, push);
    ty = lerp(TY_WIDE, TY_PUSH, push);
  }
  const css = f <= PULL_END ? zoom : Z_PUSH; // pull: CSS zoom (crisp, fast enough to render every frame); push: fixed
  const d = PERSP * zoom;
  const th = (rotY * Math.PI) / 180;
  const sx = left - AX;
  const u = (sx * d) / (d * Math.cos(th) - sx * Math.sin(th)); // screen offset of the left edge before rotateY
  return { zoom, css, s: zoom / css, cx: -u / zoom, cy: TOP_CSS + (AY - ty) / zoom, rotY, rotX, q, push };
}

/** A window (x, y, w, h) of a card texture, showing the texture's own pixels from (sx, sy). */
const Crop: React.FC<{ src: string; x: number; y: number; w: number; h: number; sx?: number; sy?: number; style?: React.CSSProperties }> = ({
  src, x, y, w, h, sx = x, sy = y, style,
}) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', ...style }}>
    <Img src={src} style={{ position: 'absolute', left: -sx, top: -sy, width: W, height: H, maxWidth: 'none' }} />
  </div>
);

/**
 * lib/ui FeatureTitle, same eyebrow / sizes / blur-slide timings, with a box wide enough for "prochaine séance."
 * (≈ 734px at 84px Inter Bold): the shared 720px box would break it onto a third line. The eyebrow ramps in just
 * before the cut so the first frame already carries it.
 */
const Title: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  const e = interpolate(f, [start - 6, start + 6], [0, 1], { ...clamp, easing: EASE });
  return (
    <div style={{ position: 'absolute', left: 140, top: 380, width: 780 }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, letterSpacing: '0.2em', color: C.cyan, opacity: e, marginBottom: 18 }}>
        PLANNING
      </div>
      <BlurLine line="Planifie la" start={start + 2} size={84} />
      <BlurLine line={[{ text: 'prochaine séance.', spectrum: true }]} start={start + 10} size={84} />
    </div>
  );
};

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

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${1.04 + 0.05 * (1 - cam.q) + 0.012 * cam.push})` }}>
        <Backdrop dim={0.42} />
      </AbsoluteFill>
      {/* ambient pools (screen space): violet matter under the card, cyan guide, fuchsia counter-light */}
      <Glow x={1380} y={760} r={640} color={C.glowViolet} />
      <Glow x={960} y={200} r={420} color={C.glowCyan} />
      <Glow x={1890} y={300} r={380} color={C.glowFuchsia} />

      {/* camera: lens-shifted 2.5D look-at, CSS zoom (crisp 2x texture), flat stage */}
      <div style={{ position: 'absolute', inset: 0, perspective: `${PERSP * cam.zoom}px`, perspectiveOrigin: `${AX}px ${AY}px` }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: W, height: H, zoom: cam.css,
            transform: `translate(${AX / cam.css - cam.cx}px, ${AY / cam.css - cam.cy}px) rotateY(${cam.rotY}deg) rotateX(${cam.rotX}deg)${
              cam.s !== 1 ? ` scale(${cam.s})` : ''
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

      {/* Données fictives (screen space, under the card's right edge in the wide framing) */}
      <FictiveTag />
      <Title start={-4} />
    </AbsoluteFill>
  );
};

export const Planning: React.FC = () => {
  const f = useCurrentFrame();
  // from HOLD to the cut every layer (backdrop drift included) is frozen: identical frames
  return (
    <Freeze frame={HOLD} active={f >= HOLD}>
      <Scene />
    </Freeze>
  );
};
