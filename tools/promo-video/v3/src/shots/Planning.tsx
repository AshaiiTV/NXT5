// Shot 7 — Planning (k60–68, 111f). Shot card ui-entrance/row-embed on the real "Le rendez-vous du cinq" card.
//
// The card opens on the hard cut (k60) without its session programme: the band that will hold it is collapsed and
// the lower section (separator, "Le cinq au rendez-vous", the five roles) sits right under the session goal. The
// slot opens — the lower section slides down and makes room (brand ease) — while the three real agenda items
// (cutouts agenda-1..3) drop in one per beat (k61 / k62 / k63) with the demo's flight: perspective(900px)
// translateY(−120·air) rotateX(16°·air), scale 1.06 → 0.995 then a 4f press back to 1, landing exactly in their
// layout slots (Q9). On touchdown a 2px cyan seam spreads from the centre of the item's timeline track and fades
// (5f / 8f, the recipe's "visual foley"), clipped to the item's box (Q4). The band then locks to the real filled
// texture. The availability block completes: the five role checks tick TOP → SUP on an accelerating cadence and the
// real "5 / 5 disponibles" counter settles on the next downbeat (k64); everything rests ≈ 1.5 s until the cut.
//
// Camera: one continuous lens-shifted 2.5D move that follows the action along the timeline — the card swings from
// its left side (row 1) to its right side (row 3), lifts from a slight top-back tilt to frontal and settles turned a
// few degrees toward the caption. CSS zoom keeps the 2x texture rasterised at its final size (Q2); no shake, no
// frame-level pulse (Q3/R4). The stage is flat (no preserve-3d) so flyers never intersect the card plane.
// Caption "Planifie la / prochaine séance." settles by ≈ f38 and is held ≈ 2.4 s (R1/R3).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
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

// ── band (the agenda strip): blank card background from 527 to 639 in planning-empty ──
const BAND_TOP = 536; // lock crop: rows 536–626 hold the agenda in 'planning'
const BAND_BOT = 626;
const LOWER_Y = 634; // the lower section (separator at 640 → card bottom) is moved as one slice
const GAP = 84; // collapsed height: agenda height (59.5) + its top gap (24)
const OPEN = [0, 12] as const; // band opens on the cut (mostly open on the k60.5 accent), done before row 1 lands

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
const LINE_Y = 551.5; // centre of the timeline track inside each item (2x rows 12–13 of the cutouts)
const LOCK = [LAND[2] + 9, LAND[2] + 15] as const; // band → real filled texture, after the last seam

// ── camera: close-up tracking shot along the timeline, then a pull-back through the music's stop (k63) that lands
// on the bar's strongest hit (k64) with the whole card in frame ──
const PULL = [B(63) + 2, B(64)] as const; // 43 → 55
const PULL_EASE = Easing.bezier(0.6, 0, 0.2, 1);

// ── availability: checks (2x bboxes measured on the texture) + the real counter ──
const CHECKS = P.boxes.roleCards.map((c) => ({ x: c.x + c.w - 17.5, y: 704.5, w: 12, h: 9.5 }));
const CHECK_T = [PULL[1] + 1, PULL[1] + 3.5, PULL[1] + 6, PULL[1] + 8, PULL[1] + 10]; // TOP → SUP, accelerating
const COUNTER = { x: 732, y: 663, w: 118, h: 19 };
const COUNTER_T = B(65); // 69: the counter settles on the next hit
const DONE = COUNTER_T + 12; // every overlay equals the real texture from here: render it alone → ≈ 1 s of rest

// lens-shifted look-at: card point (cx, cy) sits on screen (AX, AY); the card's left side fades under the caption
const AX = 1410;
const AY = 526;
const PERSP = 1400;
const MASK = 'linear-gradient(90deg, transparent 0px, transparent 880px, #000 960px)';
type Keys = readonly (readonly [number, number])[];
const CLOSE = {
  zoom: [[0, 1.82], [14, 1.77], [34, 1.72], [PULL[0], 1.7]],
  cx: [[0, 250], [14, 285], [27, 435], [34, 548], [PULL[0], 572]],
  cy: [[0, 588], [PULL[0], 594]],
  rotY: [[0, 5], [14, 3], [27, 0], [34, -2.5], [PULL[0], -3.4]],
  rotX: [[0, 5], [PULL[0], 2]],
} as const satisfies Record<string, Keys>;
const WIDE = {
  zoom: [[PULL[1], 1.0], [111, 1.018]],
  rotY: [[PULL[1], -2.4], [111, -1.8]],
} as const satisfies Record<string, Keys>;

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
 * (≈ 734px at 84px Inter Bold): the shared 720px box would break it onto a third line.
 */
const Title: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  const e = interpolate(f, [start, start + 14], [0, 1], { ...clamp, easing: EASE });
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

export const Planning: React.FC = () => {
  const f = useCurrentFrame();
  const g = GAP * (1 - interpolate(f, [OPEN[0], OPEN[1]], [0, 1], { ...clamp, easing: EASE }));
  const cardH = H - g;
  const t = interpolate(f, [PULL[0], PULL[1]], [0, 1], { ...clamp, easing: PULL_EASE });
  const zoom = Math.exp(lerp(Math.log(spline(f, CLOSE.zoom)), Math.log(spline(f, WIDE.zoom)), t));
  const cx = lerp(spline(f, CLOSE.cx), W / 2, t);
  const cy = lerp(spline(f, CLOSE.cy), cardH / 2, t);
  const rotY = lerp(spline(f, CLOSE.rotY), spline(f, WIDE.rotY), t);
  const rotX = lerp(spline(f, CLOSE.rotX), 0, t);
  const lock = interpolate(f, [LOCK[0], LOCK[1]], [0, 1], clamp);
  const done = f >= DONE;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateX(${-(cx - W / 2) * 0.08}px) scale(${1.04 + 0.03 * (1 - t)})` }}>
        <Backdrop dim={0.42} />
      </AbsoluteFill>
      {/* ambient pools (screen space): violet matter under the card, cyan guide, fuchsia counter-light */}
      <Glow x={1380} y={760} r={640} color={C.glowViolet} />
      <Glow x={960} y={200} r={420} color={C.glowCyan} />
      <Glow x={1890} y={300} r={380} color={C.glowFuchsia} />

      {/* camera: lens-shifted 2.5D look-at, CSS zoom (crisp 2x texture), flat stage */}
      <AbsoluteFill style={{ maskImage: MASK, WebkitMaskImage: MASK }}>
        <div style={{ position: 'absolute', inset: 0, perspective: `${PERSP * zoom}px`, perspectiveOrigin: `${AX}px ${AY}px` }}>
          <div
            style={{
              position: 'absolute', left: 0, top: 0, width: W, height: H, zoom,
              transform: `translate(${AX / zoom - cx}px, ${AY / zoom - cy}px) rotateY(${rotY}deg) rotateX(${rotX}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
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
                  {f < COUNTER_T + 13 ? (
                    <Crop src={EMPTY} x={COUNTER.x} y={COUNTER.y - g} w={COUNTER.w} h={COUNTER.h} sx={COUNTER.x - 300} sy={COUNTER.y} />
                  ) : null}
                  {/* checks tick in TOP → SUP */}
                  {CHECKS.map((c, i) => {
                    const p = interpolate(f, [CHECK_T[i], CHECK_T[i] + 7], [0, 1], { ...clamp, easing: EASE });
                    return p > 0 ? (
                      <Crop
                        key={`c${i}`} src={FULL} x={c.x} y={c.y} w={c.w} h={c.h}
                        style={{ opacity: Math.min(1, p * 1.6), transform: `scale(${0.4 + 0.6 * p})`, transformOrigin: 'center center' }}
                      />
                    ) : null;
                  })}
                  {/* the real counter settles on the downbeat */}
                  {(() => {
                    const p = interpolate(f, [COUNTER_T - 4, COUNTER_T + 12], [0, 1], { ...clamp, easing: EASE });
                    return p > 0 ? (
                      <Crop
                        src={FULL} x={COUNTER.x} y={COUNTER.y} w={COUNTER.w} h={COUNTER.h}
                        style={{ opacity: p, transform: `translateX(${(1 - p) * 14}px)`, filter: p < 1 ? `blur(${(1 - p) * 4}px)` : undefined }}
                      />
                    ) : null;
                  })()}
                  {/* band locks to the real filled texture */}
                  {lock > 0 ? <Crop src={FULL} x={0} y={BAND_TOP} w={W} h={BAND_BOT - BAND_TOP} style={{ opacity: lock }} /> : null}
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
                  const appear = interpolate(f, [cue, cue + 3], [0, 1], clamp);
                  const scale =
                    f < land ? 1.06 - 0.065 * p : interpolate(f, [land, land + 4], [0.995, 1], { ...clamp, easing: Easing.out(Easing.quad) });
                  const air = 1 - p;
                  const atRest = f >= land + 4;

                  // embed seam: 2px cyan on the item's timeline track, spreading from its centre, clipped to its box
                  let seam: React.ReactNode = null;
                  if (f >= land && f < land + 8) {
                    const spread = interpolate(f, [land, land + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
                    const o = interpolate(f, [land, land + 2, land + 8], [1, 1, 0], clamp);
                    const sw = r.box.w * spread;
                    seam = (
                      <div style={{ position: 'absolute', left: r.box.x, top: LINE_Y - 8, width: r.box.w, height: 16, overflow: 'hidden', pointerEvents: 'none' }}>
                        <div
                          style={{
                            position: 'absolute', left: (r.box.w - sw) / 2, top: 7, width: sw, height: 2, borderRadius: 1,
                            background: C.cyan, boxShadow: '0 0 6px rgba(103,232,249,.55)', opacity: o,
                          }}
                        />
                      </div>
                    );
                  }

                  return (
                    <React.Fragment key={i}>
                      <Img
                        src={r.src}
                        style={{
                          position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, opacity: appear,
                          transform: atRest ? undefined : `perspective(900px) translateY(${-120 * air}px) rotateX(${16 * air}deg) scale(${scale})`,
                          filter: air > 0.01 ? `drop-shadow(0 ${26 * air}px ${18 * air}px rgba(2,6,17,${0.6 * air}))` : undefined,
                        }}
                      />
                      {seam}
                    </React.Fragment>
                  );
                })
              : null}
          </div>
        </div>
      </AbsoluteFill>

      {/* Données fictives (screen space, under the card's right edge in the wide framing) */}
      <FictiveTag x={1615} y={958} />
      <Title start={2} />
    </AbsoluteFill>
  );
};
