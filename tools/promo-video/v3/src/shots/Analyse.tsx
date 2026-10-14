// Shot 3 — Analyse (k24–34, full energy). Shot card interaction/input-trigger-moves, style A cursor-performance
// (demo CursorPerformancePunchIn.tsx, timings kept: bezier glide with wrist overshoot t→1.05 then back, 4f hover lift,
// press 1→.94→1 over 2f+4f, ripple Ø out-cubic 22f decoupled from a linear 26f fade, unmounted after; punch-in 12f
// out-cubic → hold → 18f in-out return; cursor, button and ripple on the SAME zoom layer so the push never drifts).
// Hero: the real « Review d’équipe » card (captured states 12:00 / 21:00 / 33:45). The cursor clicks the 21:00 chip on
// beat k26 and the 33:45 chip on beat k30 (same bar position); each click swaps the captured state instantly (as the
// real UI does) and rolls the gold value in its own slot. Camera: CSS zoom (crisp 2x textures, Q2), no shake, card
// layer only (R4). Click 1 = decisive ×1.36 punch-in (header leaves the frame, « +1 300 or » at caption size), hold,
// return; click 2 = gentle push to the final framing, then a slow continuous push (+2 %, f85 → cut, 12f smooth start then
// constant speed, ≈0.2 px/f on « +4 000 or ») so the hold is never a dead still; during it the camera keeps its CSS zoom fixed at the end value and scales down by transform (crisp, no
// sub-pixel stepping of a moving CSS zoom). The cursor lives on its own copy of the camera layer, drawn above the night
// fade, so the hero never greys out. Light: no sweep (film light budget = the two halations); a key-light grade dims
// header and notes so the gold / chart / chips band reads first. Beat k32 (local 110, the strongest hit of the shot):
// element-level accent only — « +4 000 or » pops 1 → 1.06 → 1 (3f out-cubic, 5f in-quad) and the chart's end marker
// pops with one ring leaving its halo; no camera or full-frame pulse.
// Holds: title settled ~f26→137 (3.7 s), « +4 000 or » settled f93→137 (1.47 s, plus the k32 pop).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import layout from '../layout.json';
import { C } from '../theme';
import { Backdrop, FeatureTitle, FictiveTag, Glow } from '../lib/ui';
import { clamp, EASE, lerp } from '../lib/motion';
import { dur, localBeat, SHOTS } from '../timeline';

const SHOT = SHOTS.analyse;
const CLICK1 = localBeat(SHOT, 26); // local 27
const CLICK2 = localBeat(SHOT, 30); // local 83
const ACCENT = localBeat(SHOT, 32); // local 110: strongest hit of the shot
const END = dur(SHOT) - 1; // local 137, last frame before the cut

const REVIEW = layout['review-1200'];
const W = REVIEW.w; // 881 CSS px (texture 2x)
const H = REVIEW.h; // 950
const CHIPS = REVIEW.boxes.chips;
const CARD_BG = '#182235'; // sampled card surface rgb(24,34,53)
const TEX = ['review-1200', 'review-2100', 'review-3345'].map((k) => staticFile(`textures/${k}.png`));

const outCubic = Easing.out(Easing.cubic);
const inOutCubic = Easing.inOut(Easing.cubic);
const inOutQuad = Easing.inOut(Easing.quad);
const inQuad = Easing.in(Easing.quad);
const ramp = (f: number, a: number, b: number, ease: (t: number) => number = (t) => t) =>
  interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });

// ───────────────────────── camera (card space → screen) ─────────────────────────
// Point (cx, cy) of the card sits at the anchor (AX, AY); right half of the frame, the title owns the left.
const AX = 1368;
const AY = 540;
const PERSP = 1500;
const PUNCH_CX = 370; // frame's right edge at card x 738: « Déplace le curseur » (x 741) fully out, no sliver
type Key = { f: number; cx: number; cy: number; z: number; rotY: number; ease?: (t: number) => number };
const WORK = { cx: 440, cy: 478, z: 1.1, rotY: 0 }; // whole card in frame (x 884–1853, top ≈14)
const PUNCH1 = { cx: PUNCH_CX, cy: 600, z: 1.5, rotY: 0 }; // ×1.36: header out, gold value + 21:00 chip + curve fill the frame
const BACK = { cx: 455, cy: 480, z: 1.22, rotY: 0 };
const FINAL = { cx: 470, cy: 486, z: 1.25, rotY: 0 }; // +4 000 or, curve end, 33:45 chip, card border visible on the right
const KEYS: Key[] = [
  { f: 0, cx: 440, cy: 475, z: 0.97, rotY: 12 }, // cut-in: whole card, slight left-camera angle
  { f: 18, ...WORK, ease: EASE }, // swing to frontal + dolly in; still card for the last 10f before the click
  { f: CLICK1, ...WORK },
  { f: CLICK1 + 12, ...PUNCH1, ease: outCubic }, // punch-in starts on the click frame
  { f: CLICK1 + 26, ...PUNCH1 }, // hold 14f
  { f: CLICK1 + 42, ...BACK, ease: inOutCubic }, // 16f return (有去有回)
  { f: CLICK2, ...BACK },
  { f: CLICK2 + 10, ...FINAL, ease: outCubic }, // gentle final push; framing settled by k30+10f, held ≥1.5 s to the cut
];
if (KEYS.some((k, i) => i > 0 && k.f <= KEYS[i - 1].f)) throw new Error('Analyse: camera keys out of order');
// Final hold: slow push around the anchor, overlapping the end of the click-2 push (never a full stop), still moving at
// the cut. From the frame after click 2 the CSS zoom stays at Z_END and the move is a transform scale ≤ 1 below it.
const DRIFT = 0.02;
const DRIFT_IN = CLICK2 + 2;
const DRIFT_RAMP = 12; // smoothstep velocity ramp, then constant speed
const Z_END = FINAL.z * (1 + DRIFT);
/** 0 → 1 over DRIFT_IN → END: velocity rises with a smoothstep over DRIFT_RAMP frames, then stays constant. */
const driftAt = (f: number) => {
  const u = Math.min(f, END) - DRIFT_IN;
  if (u <= 0) return 0;
  const R = DRIFT_RAMP;
  const v0 = 1 / (END - DRIFT_IN - R / 2);
  return u <= R ? v0 * (u ** 3 / R ** 2 - u ** 4 / (2 * R ** 3)) : v0 * (u - R / 2);
};
const camAt = (f: number) => {
  let i = 0;
  while (i < KEYS.length - 2 && f >= KEYS[i + 1].f) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = interpolate(f, [a.f, b.f], [0, 1], { ...clamp, easing: b.ease ?? ((x: number) => x) });
  const z = lerp(a.z, b.z, t) * (1 + DRIFT * driftAt(f));
  const css = f > CLICK2 ? Z_END : z;
  return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), z, css, rotY: lerp(a.rotY, b.rotY, t) };
};

// ───────────────────────── cursor performance ─────────────────────────
// Click points: right part of the chip, so the cursor never covers the time / label printed on the left.
const clickPt = (i: number) => ({ x: CHIPS[i].x + CHIPS[i].w * 0.74, y: CHIPS[i].y + CHIPS[i].h * 0.62 });
const C1 = clickPt(1);
const C2 = clickPt(2);
type P = { x: number; y: number };
const bez = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};
// Glide 1: from off-frame bottom-right, sinks first then rises onto the 21:00 chip (curve "with character");
// lands at f22 on a card already at rest (f18), hovers 6f, clicks on k26.
const G1 = { start: 0, peak: 18, end: 22, path: [{ x: 905, y: 1130 }, { x: 760, y: 1010 }, { x: 470, y: 840 }, C1] as P[] };
// Glide 2: arcs over the chips through the lower chart band onto 33:45 (off-frame at PUNCH1, so it starts once the
// return is well under way); lands f78, hovers 5f, clicks on k30.
const G2 = { start: 60, peak: 74, end: 78, path: [C1, { x: 600, y: 610 }, { x: 740, y: 600 }, C2] as P[] };
if (!(G1.end < CLICK1 && G2.start > CLICK1 + 26 && G2.end < CLICK2)) throw new Error('Analyse: glide keys out of order');
const glideT = (f: number, g: typeof G1) =>
  f < g.peak
    ? interpolate(f, [g.start, g.peak], [0, 1.05], { ...clamp, easing: outCubic })
    : interpolate(f, [g.peak, g.end], [1.05, 1], { ...clamp, easing: inOutQuad });
const cursorAt = (f: number): P => {
  const g = f < G2.start ? G1 : G2;
  const [p0, p1, p2, p3] = g.path;
  const p = bez(p0, p1, p2, p3, glideT(f, g));
  // click: cursor sinks 3px with the button (2f down, 4f back)
  const dip = (c: number) => interpolate(f, [c, c + 2, c + 6], [0, 3, 0], clamp);
  return { x: p.x, y: p.y + dip(CLICK1) + dip(CLICK2) };
};
const CUR = 40; // card px → ~50px on screen at z≈1.25
const Cursor: React.FC<P> = ({ x, y }) => (
  <svg
    width={CUR}
    height={CUR}
    viewBox="0 0 28 28"
    style={{ position: 'absolute', left: x - (2 * CUR) / 28, top: y - CUR / 28, overflow: 'visible', filter: 'drop-shadow(0 3px 6px rgba(2,6,17,.55))' }}
  >
    <path d="M2 1 L2 23 L8 17.5 L11.5 25 L15.5 23.2 L12 15.8 L20 15 Z" fill="#FFFFFF" stroke="#0B1220" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

// ───────────────────────── captured states ─────────────────────────
const SWAP1 = CLICK1 + 2; // state changes at the bottom of the press
const SWAP2 = CLICK2 + 2;
/** Captured state shown at a frame: instant swap like the real UI (the gold roll carries the transition). */
const layersAt = (f: number) => [{ src: TEX[f >= SWAP2 ? 2 : f >= SWAP1 ? 1 : 0], o: 1 }];

/** A rectangle of the card texture(s) shown in place (x, y, w, h in card px). */
const Cut: React.FC<{ x: number; y: number; w: number; h: number; layers: { src: string; o: number }[]; radius?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  x, y, w, h, layers, radius = 0, style, children,
}) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', borderRadius: radius, ...style }}>
    {layers.map((l, i) => (
      <Img key={i} src={l.src} style={{ position: 'absolute', left: -x, top: -y, width: W, height: H, opacity: l.o }} />
    ))}
    {children}
  </div>
);

// Gold value slot (value glyphs at card y 295–321, x 36–167; nothing else in that band).
const GOLD_WIN = { x: 30, y: 285, w: 232, h: 47 };
const GOLD_SLICE = { y: 289, h: 38 };
const goldSlicesAt = (f: number) => {
  const out = (t: number) => {
    const p = ramp(t, 0, 6, outCubic);
    return { dy: -16 * p, o: 1 - p, blur: 4 * p };
  };
  const inn = (t: number) => {
    const p = ramp(t, 0, 8, outCubic);
    return { dy: 18 * (1 - p), o: p, blur: 5 * (1 - p) };
  };
  if (f < SWAP1) return [{ src: TEX[0], dy: 0, o: 1, blur: 0 }];
  if (f < SWAP2) return [{ src: TEX[0], ...out(f - SWAP1) }, { src: TEX[1], ...inn(f - SWAP1) }];
  return [{ src: TEX[1], ...out(f - SWAP2) }, { src: TEX[2], ...inn(f - SWAP2) }];
};

// k32 accent. Pop of the value: 3f out-cubic up to 1.06, 5f in-quad back to 1, around the glyph run's centre
// (card x 35–168, y 295–321); the scaled slice stays inside the slot (x ≥ 31, y 288–328).
const POP_ORIGIN = { x: 101 - GOLD_WIN.x, y: 308 - GOLD_SLICE.y }; // slice-local
const popAt = (f: number) =>
  1 + 0.06 * (f < ACCENT + 3 ? ramp(f, ACCENT, ACCENT + 3, outCubic) : 1 - ramp(f, ACCENT + 3, ACCENT + 8, inQuad));
// Chart end marker of the 33:45 state (sampled on the 2x texture): dot centre, white dot + card-colour outline, halo.
const MARK = { x: 817.9, y: 436.8 };
const DOT = { w: 8.8, h: 5.8, ow: 13.4, oh: 8.4, fill: '#E9E3FF' };
const HALO = { rx: 15.6, ry: 9.9 };

const EndMarkerPulse: React.FC<{ f: number }> = ({ f }) => {
  if (f < ACCENT || f >= ACCENT + 20) return null; // unmounted outside the accent: the texture is untouched at rest
  const s = 1 + 0.5 * (f < ACCENT + 3 ? ramp(f, ACCENT, ACCENT + 3, outCubic) : 1 - ramp(f, ACCENT + 3, ACCENT + 9, inQuad));
  const k = interpolate(f, [ACCENT, ACCENT + 18], [1, 3.2], { ...clamp, easing: outCubic });
  const o = interpolate(f, [ACCENT, ACCENT + 20], [0.85, 0], clamp);
  const bw = interpolate(f, [ACCENT, ACCENT + 18], [2, 1], clamp);
  return (
    <>
      <div
        style={{
          position: 'absolute', left: MARK.x - HALO.rx * k, top: MARK.y - HALO.ry * k, width: 2 * HALO.rx * k, height: 2 * HALO.ry * k,
          borderRadius: '50%', border: `${bw}px solid ${C.violetText}`, opacity: o, boxSizing: 'border-box',
        }}
      />
      {s > 1.001 ? (
        <div
          style={{
            position: 'absolute', left: MARK.x - DOT.ow / 2, top: MARK.y - DOT.oh / 2, width: DOT.ow, height: DOT.oh, borderRadius: '50%',
            background: CARD_BG, transform: `scale(${s})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: DOT.w, height: DOT.h, borderRadius: '50%', background: DOT.fill }} />
        </div>
      ) : null}
    </>
  );
};

const GRADE =
  'linear-gradient(to bottom, rgba(9,13,27,.62) 0px, rgba(9,13,27,.5) 200px, rgba(9,13,27,0) 272px, rgba(9,13,27,0) 704px, rgba(9,13,27,.42) 780px, rgba(9,13,27,.62) 950px)';

const Ripple: React.FC<{ f: number; c: number; at: P }> = ({ f, c, at }) => {
  if (f < c || f >= c + 26) return null; // unmounted once faded (demo pitfall)
  const d = interpolate(f, [c, c + 22], [60, 320], { ...clamp, easing: outCubic });
  const o = interpolate(f, [c, c + 26], [0.9, 0], clamp);
  const bw = interpolate(f, [c, c + 22], [7.5, 2.5], clamp);
  return (
    <div
      style={{
        position: 'absolute', left: at.x - d / 2, top: at.y - d / 2, width: d, height: d, borderRadius: '50%',
        border: `${bw}px solid ${C.cyan}`, opacity: o,
      }}
    />
  );
};

/** Chip under the cursor: cut out of the live texture, lifts on hover, sinks on press. */
const Chip: React.FC<{ i: number; hover: number; ring: number; press: number; layers: { src: string; o: number }[] }> = ({ i, hover, ring, press, layers }) => {
  const b = CHIPS[i];
  if (hover <= 0.001 && press === 1) return null;
  const s = (1 + 0.04 * hover) * press;
  return (
    <>
      {/* patch so the static chip never peeks out while the cut-out sinks */}
      <div style={{ position: 'absolute', left: b.x - 2, top: b.y - 2, width: b.w + 4, height: b.h + 4, background: CARD_BG }} />
      <Cut
        x={b.x - 1} y={b.y - 1} w={b.w + 2} h={b.h + 2} layers={layers} radius={5}
        style={{ transform: `scale(${s})`, transformOrigin: 'center', boxShadow: `0 ${8 * hover}px ${22 * hover}px rgba(2,6,17,${0.45 * hover})` }}
      >
        {/* hover = cyan guide ring only (no fill), so it never reads as a second selected chip */}
        {ring > 0.001 ? (
          <div style={{ position: 'absolute', inset: 1, borderRadius: 4, boxShadow: `inset 0 0 0 1.5px rgba(103,232,249,${0.42 * ring})` }} />
        ) : null}
      </Cut>
    </>
  );
};

/** Camera: CSS zoom (crisp re-raster of the 2x texture) + PageCam2D coordinate math. Used twice (card, cursor). */
const CamLayer: React.FC<{ cam: ReturnType<typeof camAt>; children: React.ReactNode }> = ({ cam, children }) => (
  <div style={{ position: 'absolute', inset: 0, perspective: `${PERSP * cam.z}px`, perspectiveOrigin: `${AX}px ${AY}px` }}>
    <div
      style={{
        position: 'absolute', left: 0, top: 0, width: W, height: H, zoom: cam.css,
        transform: `translate(${AX / cam.css - cam.cx}px, ${AY / cam.css - cam.cy}px) rotateY(${cam.rotY}deg)${
          cam.z !== cam.css ? ` scale(${cam.z / cam.css})` : ''
        }`,
        transformOrigin: `${cam.cx}px ${cam.cy}px`, transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  </div>
);

export const Analyse: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const layers = layersAt(f);
  const cur = cursorAt(f);

  // hover: 4f lift once the cursor has landed; leaves with the cursor
  const hover1 = ramp(f, G1.end, G1.end + 4) * (1 - ramp(f, G2.start, G2.start + 4));
  const hover2 = ramp(f, G2.end, G2.end + 4);
  const press = (c: number) => interpolate(f, [c, c + 2, c + 6], [1, 0.94, 1], clamp);

  // light pools follow the card a little (parallax 0.25), no pulses
  const px = -(cam.cx - 440) * 0.25 * cam.z;
  const py = -(cam.cy - 470) * 0.25 * cam.z;
  const tagIn = 1; // « Données fictives » from the first frame of the shot (Riot check: example data always flagged)
  const grade = ramp(f, 4, 22, EASE);
  const pop = popAt(f);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Backdrop dim={0.38} />
      <Glow x={AX + 20 + px} y={1000 + py} r={660} color={C.glowViolet} />
      <Glow x={AX - 420 + px} y={170 + py} r={440} color={C.glowCyan} />
      <Glow x={AX + 520 + px} y={500 + py} r={380} color={C.glowFuchsia} />

      <CamLayer cam={cam}>
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', background: CARD_BG,
              boxShadow: '0 40px 110px rgba(2,6,17,.62), 0 0 0 1px rgba(196,181,253,.16), 0 0 90px rgba(139,92,246,.16)',
            }}
          >
            {layers.map((l, i) => (
              <Img key={i} src={l.src} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: l.o }} />
            ))}

            {/* gold value rolls in its own slot */}
            <div style={{ position: 'absolute', left: GOLD_WIN.x, top: GOLD_WIN.y, width: GOLD_WIN.w, height: GOLD_WIN.h, overflow: 'hidden', background: CARD_BG }}>
              {goldSlicesAt(f)
                .filter((s) => s.o > 0.001)
                .map((s, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute', left: 0, top: GOLD_SLICE.y - GOLD_WIN.y + s.dy, width: GOLD_WIN.w, height: GOLD_SLICE.h, overflow: 'hidden',
                      opacity: s.o, filter: s.blur > 0.05 ? `blur(${s.blur}px)` : undefined,
                      ...(pop > 1.0005 ? { transform: `scale(${pop})`, transformOrigin: `${POP_ORIGIN.x}px ${POP_ORIGIN.y}px` } : {}),
                    }}
                  >
                    <Img src={s.src} style={{ position: 'absolute', left: -GOLD_WIN.x, top: -GOLD_SLICE.y, width: W, height: H }} />
                  </div>
                ))}
            </div>

            <Chip i={1} hover={hover1} ring={hover1 * (1 - ramp(f, SWAP1, SWAP1 + 6))} press={press(CLICK1)} layers={layers} />
            <Chip i={2} hover={hover2} ring={hover2 * (1 - ramp(f, SWAP2, SWAP2 + 6))} press={press(CLICK2)} layers={layers} />
            <Ripple f={f} c={CLICK1} at={C1} />
            <Ripple f={f} c={CLICK2} at={C2} />
            <EndMarkerPulse f={f} />

            {/* key light on the working band: header and notes fall half a stop as the camera settles */}
            <div style={{ position: 'absolute', inset: 0, opacity: grade, background: GRADE }} />
          </div>
      </CamLayer>

      {/* the lower card (note, footer) falls into the night; opaque around the tag so no footer glyph shows beside it */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 840, bottom: 0, background: 'linear-gradient(to bottom, rgba(17,24,39,0), rgba(17,24,39,.92) 50%, rgba(17,24,39,1) 66%)' }} />
      <FictiveTag opacity={tagIn} />

      {/* the hero actor: same camera, drawn above the night fade */}
      <CamLayer cam={cam}>
        <Cursor x={cur.x} y={cur.y} />
      </CamLayer>

      <FeatureTitle eyebrow="ANALYSE" l1="Revois chaque" l2="moment clé." start={0} />
    </AbsoluteFill>
  );
};
