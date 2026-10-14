// Shot 5 — breath card on the music's hollow bar (k44–48, 56f). Shot card typography/paper-title-card, re-skinned
// to the charte: no paper, no serif — night backdrop, ONE violet glass plate, Inter. The demo's letterpress word
// entrance is kept as tuned (scale 1.28→1 + blur 7px→0 + opacity, 9f per word, bezier(0.2,0.75,0.3,1)); "Et après"
// is already pressed on the cut (balanced first frame, no lone word) and "la" / "partie ?" press from f0 / f2, so
// the line is settled at f11 and holds ≥1.5 s to the hard cut on k48 (no tail fade: the debrief slams in on the
// cut). The text stays still during the hold; the shot's one light does the motion: a violet pool INSIDE the plate
// (clipped to its radius) drifts left → right behind the words while the plate breathes in by 4.5%. Exactly one
// accent word ("après", spectrum) and the short accent bar that closes the card. The DigitRoll sub-line is dropped
// (one line, no invented numbers).
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, FONT, SPECTRUM_TEXT, glassSurface, spectrumText } from '../theme';
import { Backdrop } from '../lib/ui';
import { clamp } from '../lib/motion';
import { dur, SHOTS } from '../timeline';

const WORDS: { text: string; accent?: boolean }[] = [
  { text: 'Et' },
  { text: 'après', accent: true },
  { text: 'la' },
  { text: 'partie ?' },
];
const PRESS = Easing.bezier(0.2, 0.75, 0.3, 1); // demo value
const WORD_WIN = 9; // demo value
const WORD_GAP = 2; // demo: 4 — tightened so the whole line is readable by ~f8
// The cut lands mid-press: "Et après" is already pressed, "la" (t 0.80) and "partie ?" (t 0.39, blurred, scale 1.17)
// are pressing in, so frame 0 already spans the whole centred line (a balanced first frame — with "la"/"partie ?"
// still invisible the line sat in the left half of the plate). 2f stagger kept → readable by f6, settled at f8
// (abs 617) → 48f (1.6 s) of still hold to the cut.
const delayOf = (i: number) => (i < 2 ? -8 : -3 + (i - 2) * WORD_GAP);
const PANEL_W = 1380;
const PANEL_H = 420;
const PANEL_R = 28;
const LIGHT_D = 760; // the one light: violet pool inside the plate
const DRIFT = Easing.bezier(0.45, 0, 0.35, 1);
const D = dur(SHOTS.card);

export const BreathCard: React.FC = () => {
  const f = useCurrentFrame();
  // the whole card breathes in by 4.5% over the bar: calm, continuous, no beat pulse
  const push = interpolate(f, [0, D], [1, 1.045], { ...clamp, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  const bar = interpolate(f, [6, 22], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) }); // demo 16→34
  const lightX = interpolate(f, [0, D], [0.22, 0.72], { ...clamp, easing: DRIFT }) * PANEL_W;

  return (
    <AbsoluteFill>
      <Backdrop dim={0.55} drift={0.5} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            ...glassSurface,
            width: PANEL_W,
            height: PANEL_H,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: PANEL_R,
            transform: `scale(${push})`,
            boxShadow: `${glassSurface.boxShadow}, 0 40px 120px rgba(2,6,17,.45)`,
          }}
        >
          {/* the shot's one light: a violet pool drifting behind the words, clipped to the plate's radius */}
          <div
            style={{
              position: 'absolute', left: lightX - LIGHT_D / 2, top: PANEL_H / 2 - LIGHT_D / 2, width: LIGHT_D, height: LIGHT_D,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.38), transparent 70%)', pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'relative',
              fontFamily: FONT,
              fontSize: 120,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: '-0.025em',
              color: C.text,
              display: 'flex',
              flexWrap: 'nowrap',
              justifyContent: 'center',
              columnGap: '0.26em',
              whiteSpace: 'nowrap',
            }}
          >
            {WORDS.map((w, i) => {
              const delay = delayOf(i);
              const t = interpolate(f, [delay, delay + WORD_WIN], [0, 1], { ...clamp, easing: PRESS });
              return (
                <span
                  key={w.text}
                  style={{
                    display: 'inline-block',
                    opacity: t,
                    transform: `scale(${1.28 - 0.28 * t})`,
                    // "partie ?" grows to the right, away from "la", while both still press (no overlap)
                    transformOrigin: i === 3 ? '0% 60%' : undefined,
                    filter: t < 1 ? `blur(${(1 - t) * 7}px)` : undefined,
                    // descender room so the clipped spectrum fill keeps the "p" tail
                    paddingBottom: w.accent ? '0.08em' : undefined,
                    marginBottom: w.accent ? '-0.08em' : undefined,
                    ...(w.accent ? spectrumText : {}),
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
          <div
            style={{
              position: 'relative',
              height: 6,
              width: 200,
              marginTop: 40,
              borderRadius: 3,
              backgroundImage: SPECTRUM_TEXT,
              transform: `scaleX(${bar})`,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
