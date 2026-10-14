// Shot 4 — Draft (k34–44, full energy). Shot card ui-entrance/deck-deal-flyin, adapted to the real draft card:
//   1) pile close-up (L0–16): the five real champion cutouts (Gnar, Vi, Ahri, Jinx, Braum) lie as a chunky
//      physical deck on a violet-glass table below the EMPTY draft card; the camera opens tilted and orbits
//      (rotY 30 → 14, Q7), the board is dimmed so the deck is the only lit object;
//   2) pull-back (L16–38) to ONE overview that holds board and deck; the board "lights up", the table light hands
//      over to the frontal ambient pools;
//   3) anticipation on a settled camera (L37–47): the pile presses away from the slots, the top card pulls back
//      (46/30 page px ≈ 47/31 screen px);
//   4) deal on the static overview (camera ≤ 4 px/f, so each throw reads as a hit): cards fly in reading order on
//      a hard-accelerating cadence quantised to the music (gaps 1.5 → 1 → ½ → ¼ beat), dive 8f + settle 4f +
//      press, z-arc and ghost trail kept from the demo, each seating exactly in its layout slot (Q9);
//   5) single lock push once the deck is empty (L92–108), crossfade to the real filled texture (real "selected"
//      state of the MID pick), header and pool/note dimmed so the five picks are the hero, ≈ 1 s of rest on a slow
//      continuous drift toward the picks (plan DRIFT: the cards stay locked in their slots, the frame never freezes).
// Light: a dark glossy table (Q7 contrast material) with a tight key light on the deck + glossy specular bands, then
// slowly drifting ambient pools; no per-card glow (C1/Q4). « Données fictives »: ONE screen-space tag in the film's
// shared bottom-right slot for the whole shot.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C } from '../theme';
import { Backdrop, FeatureTitle, FictiveTag, Glow } from '../lib/ui';
import { clamp } from '../lib/motion';
import { StageCam } from './draft/StageCam';
import {
  ANT, BOARD, BOARD_DIM, BOARD_R, camAt, camBlur, CHAMPS, CUE, DECK, DIVE, DRIFT, driftScale, FILLED, HERO_DIM, N,
  project, SETTLE, STACK_STEP, TABLE_FADE, TITLE_START,
} from './draft/plan';

const HOVER_H = 40;
const ARC = 120;
const DIVE_EASE = Easing.bezier(0.3, 0, 0.2, 1);
const SETTLE_EASE = Easing.bezier(0.3, 0, 0.25, 1.15);

// deterministic pile pose (demo formula)
const deck = CHAMPS.map((c, k) => ({
  ...c,
  px: DECK.x - c.w / 2 + (((k * 7) % 9) - 4) * 2,
  py: DECK.y - c.h / 2 + (((k * 5) % 7) - 3) * 2,
  rz: ((k * 11) % 7) - 3,
  pz: (N - k) * STACK_STEP,
  cue: CUE[k],
}));
// unit vector of the first deal (top card → slot 1), for the pull-back
const D0 = (() => {
  const c = deck[0];
  const vx = c.x - c.px;
  const vy = c.y - c.py;
  const l = Math.hypot(vx, vy);
  return { x: vx / l, y: vy / l };
})();

/** Pile offset along +y (away from the slots): anticipation press, then released with a small rebound. */
const pileOff = (f: number) =>
  f < ANT.to
    ? ANT.pileDown * interpolate(f, [ANT.from, ANT.to], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) })
    : ANT.pileDown * interpolate(f, [ANT.to, ANT.to + 8], [1, 0], { ...clamp, easing: Easing.bezier(0.3, 0, 0.3, 1.3) });

// ── table: dark glossy violet glass (Q7: a darker material than the film's violet backdrop, so the lit deck is the
// only bright object on the cut), low-frequency light only (no 1px texture: it aliases under zoom + 3D) ──
const TABLE = 5000; // plane centred on the deck
const T0 = { x: DECK.x - TABLE / 2, y: DECK.y - TABLE / 2 };
const BAND_A = 118; // deg
const BAND_L = TABLE * (Math.abs(Math.sin((BAND_A * Math.PI) / 180)) + Math.abs(Math.cos((BAND_A * Math.PI) / 180)));
/** A glossy specular band (`core` px half-width, soft shoulders), `o` page px from the deck along the gradient line. */
const band = (o: number, a: number, core = 22, soft = 80) => {
  const c = BAND_L / 2 + o;
  const col = `rgba(226,232,255,${a})`;
  return `linear-gradient(${BAND_A}deg, transparent ${c - core - soft}px, ${col} ${c - core}px, ${col} ${c + core}px, transparent ${c + core + soft}px)`;
};
const TABLE_BG = [
  // key light: a tight cyan → violet pool under the deck, falling off fast into the dark glass
  `radial-gradient(560px 470px at ${TABLE / 2}px ${TABLE / 2 - 40}px, rgba(103,232,249,.30), rgba(139,92,246,.24) 38%, rgba(139,92,246,.07) 68%, transparent 100%)`,
  `radial-gradient(1300px 1000px at ${TABLE / 2 + 520}px ${TABLE / 2 - 560}px, rgba(232,121,249,.10), transparent 70%)`,
  // glossy reflections across the table (they read as a polished surface, not as empty haze)
  band(-760, 0.07, 14, 60),
  band(-430, 0.11, 26, 90),
  band(-330, 0.05, 8, 40),
  band(210, 0.08, 20, 80),
  band(560, 0.05, 10, 50),
  'linear-gradient(118deg, #070913 0%, #0e0b20 34%, #090d1a 58%, #110d26 80%, #06080f 100%)',
].join(', ');

const DIM = 'rgba(17,24,39,.6)';
const HERO_DIM_C = 'rgba(17,24,39,.45)';

export const Draft: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const blur = camBlur(f);
  const drift = driftScale(f);
  const anchor = project(cam, DRIFT.anchor.x, DRIFT.anchor.y);
  const tableO = interpolate(f, [TABLE_FADE[0], TABLE_FADE[1]], [1, 0], clamp);
  const boardDim = interpolate(f, [BOARD_DIM[0], BOARD_DIM[1]], [1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const filled = interpolate(f, [FILLED[0], FILLED[1]], [0, 1], clamp);
  const heroDim = interpolate(f, [HERO_DIM[0], HERO_DIM[1]], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const pullT = interpolate(f, [ANT.from, ANT.to], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  // ambient pools drift slowly across the whole shot (≈ 0.4 px/f), so the rest is lit by moving light
  const pool = f * 0.4;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Backdrop dim={0.42} />
      {/* ambient pools for the frontal framing (screen space): violet matter under the card, cyan guide, fuchsia rim */}
      <AbsoluteFill style={{ opacity: 1 - tableO }}>
        <Glow x={1300 + pool} y={640 - pool * 0.3} r={640} color={C.glowViolet} />
        <Glow x={860 - pool * 0.8} y={170 + pool * 0.2} r={420} color={C.glowCyan} />
        <Glow x={1860 - pool * 0.5} y={240 + pool * 0.4} r={380} color={C.glowFuchsia} />
      </AbsoluteFill>

      {/* rest drift (plan DRIFT): screen-space push about the projected centre of the picks */}
      <AbsoluteFill
        style={{
          ...(blur > 0.05 ? { filter: `blur(${blur.toFixed(2)}px)` } : {}),
          ...(drift > 1 ? { transform: `scale(${drift.toFixed(5)})`, transformOrigin: `${anchor.x.toFixed(2)}px ${anchor.y.toFixed(2)}px` } : {}),
        }}
      >
      <StageCam cam={cam}>
        {/* dark glossy table under the opening close-up (Q7 contrast material), fades with the pull-back */}
        {tableO > 0.001 ? (
          <div
            style={{
              position: 'absolute', left: T0.x, top: T0.y, width: TABLE, height: TABLE, opacity: tableO,
              background: TABLE_BG, pointerEvents: 'none',
            }}
          />
        ) : null}

        {/* the real draft card, empty, then locked to the real filled state */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: BOARD.w, height: BOARD.h, borderRadius: BOARD_R,
            boxShadow: '0 30px 80px rgba(2,6,17,.55)',
          }}
        />
        {filled < 1 ? (
          <Img
            src={staticFile('textures/draft-empty.png')}
            style={{ position: 'absolute', left: 0, top: 0, width: BOARD.w, height: BOARD.h, borderRadius: BOARD_R }}
          />
        ) : null}
        {/* board unlit while the deck is the only hero; it lights up on the pull-back */}
        {boardDim > 0.001 ? (
          <div
            style={{
              position: 'absolute', left: 0, top: 0, width: BOARD.w, height: BOARD.h, borderRadius: BOARD_R,
              background: DIM, opacity: boardDim, pointerEvents: 'none',
            }}
          />
        ) : null}

        {/* the deck: bottom card first in DOM; each card deals itself on the accelerating cadence */}
        {filled < 1
          ? [...deck].reverse().map((c) => {
              const k = deck.indexOf(c);
              const { cue } = c;
              const inPile = f < cue;
              const diveT = interpolate(f, [cue, cue + DIVE], [0, 1], { ...clamp, easing: DIVE_EASE });
              const settleT = interpolate(f, [cue + DIVE, cue + DIVE + SETTLE], [0, 1], { ...clamp, easing: SETTLE_EASE });
              const landed = f >= cue + DIVE + SETTLE;

              // launch point = where the pile (and, for the top card, the pull-back) left it at its cue
              const pull = k === 0 ? ANT.topPull : 0;
              const sx = c.px - D0.x * pull;
              const sy = c.py - D0.y * pull + pileOff(cue);
              const pileX = c.px - D0.x * pull * (k === 0 ? pullT : 0);
              const pileY = c.py - D0.y * pull * (k === 0 ? pullT : 0) + pileOff(f);

              const dx = (sx - c.x) * (1 - diveT);
              const dy = (sy - c.y) * (1 - diveT);
              const rot = c.rz * (1 - diveT);
              const zDive = interpolate(diveT, [0, 1], [c.pz, HOVER_H]) + Math.sin(diveT * Math.PI) * ARC;
              const zSettle = zDive * (1 - settleT); // overshoot makes it dip slightly below 0 → expressed as a press
              const z = Math.max(zSettle, 0.5);
              const press = interpolate(f, [cue + 10, cue + 11, cue + 12], [1, 0.996, 1], clamp);
              const scale = (1 + Math.sin(diveT * Math.PI) * 0.06) * press * (1 + Math.min(zSettle, 0) * 0.003);

              const transform = landed
                ? 'translate3d(0px, 0px, 0px)'
                : inPile
                  ? `translate3d(${pileX - c.x}px, ${pileY - c.y}px, ${c.pz}px) rotateZ(${c.rz}deg)`
                  : `translate3d(${dx}px, ${dy}px, ${z}px) rotateZ(${rot}deg) scale(${scale})`;

              // drag hierarchy: the body locks at cue+12, its shadow converges 3f later
              const shadowT = interpolate(f, [cue + DIVE, cue + DIVE + SETTLE + 3], [0, 1], clamp);
              const shadow = inPile
                ? '0 5px 0 #0b1020, 0 3px 8px rgba(2,6,17,.6)' // card thickness: the pile reads as a chunky deck
                : shadowT >= 1
                  ? 'none'
                  : `0 ${36 - 34 * shadowT}px ${70 - 66 * shadowT}px rgba(2,6,17,${0.5 - 0.5 * shadowT})`;

              const showGhost = diveT > 0.02 && diveT < 0.98;
              const ghost = { x: dx + (sx - c.x) * 0.05, y: dy + (sy - c.y) * 0.05 };

              return (
                <div key={c.file} style={{ transformStyle: 'preserve-3d' }}>
                  {showGhost ? (
                    <Img
                      src={staticFile(c.file)}
                      style={{
                        position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h,
                        transform: `translate3d(${ghost.x}px, ${ghost.y}px, ${z}px) rotateZ(${rot}deg) scale(${scale})`,
                        opacity: 0.25 * (1 - diveT), filter: 'blur(6px)', pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, transform,
                      transformOrigin: 'center center', boxShadow: shadow, borderRadius: 2,
                    }}
                  >
                    <Img src={staticFile(c.file)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
                  </div>
                </div>
              );
            })
          : null}

        {filled > 0 ? (
          <Img
            src={staticFile('textures/draft.png')}
            style={{ position: 'absolute', left: 0, top: 0, width: BOARD.w, height: BOARD.h, borderRadius: BOARD_R, opacity: filled }}
          />
        ) : null}
        {/* rest: light the five picks as the single hero (lighting only, inside the real UI): one feathered
            overlay recesses the header band and the pool/note area; the top row (Exemple fictif) stays lit */}
        {heroDim > 0 ? (
          <div
            style={{
              position: 'absolute', left: 0, top: 0, width: BOARD.w, height: BOARD.h, borderRadius: BOARD_R, opacity: heroDim,
              background: `linear-gradient(to bottom, transparent 78px, ${HERO_DIM_C} 94px, ${HERO_DIM_C} 152px, transparent 168px, transparent 420px, ${HERO_DIM_C} 440px)`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </StageCam>
      </AbsoluteFill>

      {/* Données fictives: one tag, screen space, the film's shared slot, for the whole shot */}
      <FictiveTag />

      <FeatureTitle eyebrow="DRAFT" l1="Pense ta draft" l2="à cinq." start={TITLE_START} />
    </AbsoluteFill>
  );
};
