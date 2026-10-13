// Shot 4 — Draft (k34–44, full energy). Shot card ui-entrance/deck-deal-flyin, adapted to the real draft card:
//   1) pile close-up: the five real champion cutouts (Gnar, Vi, Ahri, Jinx, Braum) lie as a physical deck on a
//      violet-glass table below the EMPTY draft card; the camera opens tilted and orbits (Q7), then pulls back and
//      cranes up to a frontal framing (Q6) while the table fades to the night backdrop;
//   2) anticipation beat, seen in a tilted overview that holds deck and empty roster: the pile presses back and
//      the top card pulls against the deal direction (card values 48/30px → 44/30 page px, ≈ 46/31 screen px);
//   3) deal: cards fly in reading order on a hard-accelerating cadence quantised to the music (1.5 → 1 → ½ → ½
//      beat), dive 8f + settle 4f + press, z-arc and ghost trail kept from the demo, each seating exactly in its
//      layout slot (Q9) on a beat or half-beat; then the board locks (crossfade to the real filled texture, which
//      carries the real "selected" state of the MID pick) and rests ~1.2 s until the hard cut on k44.
// Light: table key light + ambient pools only, no per-card glow (C1/Q4). Title held ≈ 3.2 s once settled (R1/R3).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C } from '../theme';
import { localBeat, SHOTS } from '../timeline';
import { Backdrop, FeatureTitle, FictiveTag, Glow } from '../lib/ui';
import { clamp } from '../lib/motion';
import layout from '../layout.json';
import { spline, StageCam, type Cam } from './draft/StageCam';

const B = (k: number) => localBeat(SHOTS.draft, k);

// ── stage (page space = CSS px of the draft card, 881×714; textures are 2x) ──
const BOARD = { w: layout.draft.w, h: layout.draft.h };
const BOARD_R = 19; // texture corner radius ≈ 20.5 CSS px; slightly smaller keeps the 1px border inside the clip
const CHAMPS = [1, 2, 3, 4, 5].map((i) => {
  const c = layout[`champ-${i}` as 'champ-1'];
  return { file: c.file, x: c.offset.x, y: c.offset.y, w: c.w, h: c.h };
});
const N = CHAMPS.length;
const DECK = { x: 111, y: 867 }; // deck centre: on the table, just below the card's left edge (under slot 1)
const STACK_STEP = 6;

// ── timing (local frames; landings = touch-down at cue + DIVE) ──
const DIVE = 8;
const SETTLE = 4;
const LAND = [B(37.5), B(39), B(40), B(40.5), B(41)]; // 48, 69, 83, 90, 97 — gaps 21 → 14 → 7 → 7
const CUE = LAND.map((l) => l - DIVE);
const ANT = { from: CUE[0] - 10, to: CUE[0], pileDown: 44, topPull: 30 };
const LOCK = LAND[N - 1] + SETTLE; // 101: last card seated → ≈ 1.2 s of rest
const FILLED = [LOCK, LOCK + 10] as const; // crossfade to the real filled texture
const TITLE_START = B(34.5); // 7 — settled by ~41, held ≈ 3.2 s
const TABLE_FADE = [22, 60] as const;

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

// ── camera: opens tilted on the deck (orbiting), pulls back + cranes up, locks frontal as the board fills ──
const CAM_KEYS = {
  // close orbit on the deck (0–14) → fast pull-back to a tilted overview that holds deck AND empty roster for
  // the anticipation and first deal (36) → slow crane/untilt/push-in that locks frontal as the last card lands
  // (96). The deck's top stays in frame until the last cue (keys checked by projection: deck top ≤ 964px at 89).
  // The card enters from the right and only ever moves left to its final slot (left edge 846px at rest), so it
  // never slides under the title; the deck opens right of centre, clear of the title column.
  zoom: [[0, 2.0], [14, 1.88], [36, 1.04], [62, 1.06], [96, 1.12]],
  cx: [[0, -80], [14, -66], [36, 70], [62, 96], [96, 102]],
  cy: [[0, 800], [14, 786], [36, 640], [62, 490], [96, 357]],
  rotX: [[0, 42], [14, 39], [36, 22], [62, 8], [96, 0]],
  rotY: [[0, 22], [14, 16], [36, 6], [62, 1.5], [96, 0]],
  rotZ: [[0, -6], [14, -5], [36, -1.5], [62, -0.3], [96, 0]],
  persp: [[0, 1100], [62, 1400], [96, 1400]],
} as const;
const camAt = (f: number): Cam => ({
  zoom: spline(f, CAM_KEYS.zoom),
  cx: spline(f, CAM_KEYS.cx),
  cy: spline(f, CAM_KEYS.cy),
  rotX: spline(f, CAM_KEYS.rotX),
  rotY: spline(f, CAM_KEYS.rotY),
  rotZ: spline(f, CAM_KEYS.rotZ),
  persp: spline(f, CAM_KEYS.persp),
});

/** Pile offset along +y (away from the slots): anticipation press, then released with a small rebound. */
const pileOff = (f: number) =>
  f < ANT.to
    ? ANT.pileDown * interpolate(f, [ANT.from, ANT.to], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) })
    : ANT.pileDown * interpolate(f, [ANT.to, ANT.to + 8], [1, 0], { ...clamp, easing: Easing.bezier(0.3, 0, 0.3, 1.3) });

const TAG_W = 235; // rendered pill width (page px), so its right edge aligns with the card

export const Draft: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const tableO = interpolate(f, [TABLE_FADE[0], TABLE_FADE[1]], [1, 0], clamp);
  const filled = interpolate(f, [FILLED[0], FILLED[1]], [0, 1], clamp);
  const pullT = interpolate(f, [ANT.from, ANT.to], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Backdrop dim={0.42} />
      {/* ambient pools for the frontal framing (screen space): violet matter under the card, cyan guide, fuchsia rim */}
      <AbsoluteFill style={{ opacity: 1 - tableO }}>
        <Glow x={1340} y={640} r={640} color={C.glowViolet} />
        <Glow x={820} y={170} r={420} color={C.glowCyan} />
        <Glow x={1860} y={240} r={380} color={C.glowFuchsia} />
      </AbsoluteFill>

      <StageCam cam={cam}>
        {/* violet-glass table under the opening close-up (Q7 contrast material), fades with the pull-back */}
        {tableO > 0.001 ? (
          <div
            style={{
              position: 'absolute', left: -4000, top: -4000, width: 9000, height: 9000, opacity: tableO,
              background: [
                `radial-gradient(760px 620px at ${4000 + DECK.x}px ${4000 + DECK.y - 40}px, rgba(103,232,249,.17), rgba(139,92,246,.13) 45%, transparent 72%)`,
                `radial-gradient(1400px 1000px at ${4000 + DECK.x + 500}px ${4000 + DECK.y - 500}px, rgba(232,121,249,.07), transparent 70%)`,
                'repeating-linear-gradient(100deg, rgba(226,232,255,.016) 0px, rgba(226,232,255,.016) 1px, transparent 2px, transparent 9px)',
                'linear-gradient(118deg, #141a2c 0%, #1d1a38 34%, #161d31 58%, #1e1b3a 80%, #121827 100%)',
              ].join(', '),
              pointerEvents: 'none',
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

        {/* Données fictives, seated under the card's right edge (moves with the stage) */}
        <FictiveTag x={BOARD.w - TAG_W} y={BOARD.h + 22} />

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
                ? '0 2px 6px rgba(2,6,17,.55)'
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
      </StageCam>

      <FeatureTitle eyebrow="DRAFT" l1="Cinq picks." l2="Une intention." start={TITLE_START} />
    </AbsoluteFill>
  );
};
