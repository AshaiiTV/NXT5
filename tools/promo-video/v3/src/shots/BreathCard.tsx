// Shot 5 — breath card on the music's hollow bar (k44–48, 56f). Shot card typography/paper-title-card, re-skinned
// to the charte: no paper, no serif — night backdrop, ONE violet glass panel lit from behind, Inter. The demo's
// letterpress word entrance is kept as tuned (scale 1.28→1 + blur 7px→0 + opacity, 9f per word,
// bezier(0.2,0.75,0.3,1)) but packed tighter (2.5f apart instead of 4f) so the line reads within ~10f and then
// holds, settled, to the hard cut on k48 (no tail fade: the debrief slams in on the cut). Exactly one accent word
// ("après", spectrum) and the short accent bar that closes the card. The DigitRoll sub-line is dropped (one line,
// no invented numbers).
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, FONT, SPECTRUM_TEXT, glassSurface, spectrumText } from '../theme';
import { Backdrop, Glow } from '../lib/ui';
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
const WORD_GAP = 2.5; // demo: 4 — tightened so the whole line is readable by ~f10
// "Et" is already pressed on frame 0 (a clean first frame on the hard cut, no half-pressed words overlapping);
// the other words press from frame 0, 2.5f apart → line settled at f14
const delayOf = (i: number) => (i === 0 ? -8 : (i - 1) * WORD_GAP);
const PANEL_W = 1380;
const PANEL_H = 400;
const D = dur(SHOTS.card);

export const BreathCard: React.FC = () => {
  const f = useCurrentFrame();
  // the whole card breathes in by 2.5% over the bar: calm, continuous, no beat pulse
  const push = interpolate(f, [0, D], [1, 1.025], { ...clamp, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  const bar = interpolate(f, [10, 26], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) }); // demo 16→34
  const light = interpolate(f, [0, 24], [0.75, 1], { ...clamp, easing: Easing.out(Easing.quad) });

  return (
    <AbsoluteFill>
      <Backdrop dim={0.55} drift={0.5} />
      {/* the one light: a violet pool behind the glass */}
      <Glow x={960} y={560} r={980} color={C.glowViolet} opacity={light} />
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
            transform: `scale(${push})`,
            boxShadow: `${glassSurface.boxShadow}, 0 40px 120px rgba(2,6,17,.45)`,
          }}
        >
          <div
            style={{
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
