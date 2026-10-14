// Shot 2 — the drop (slam #1). The site's real glass 5 (pre-rendered by glass/render-glass.cjs from
// src/pages/home/glass-scene.js) spins in on the downbeat; a halation bloom (shot card effects/light-play-moves,
// style D) swells from it on the impact frame and settles; the official tagline arrives in blur-slide.
// Hold (≈f45 → cut): text and wordmark locked; the 5 keeps floating (charte §9: the sculpture always floats) with a
// slow 2D float on top of the pre-rendered pose — sine 90f (3 s), ±8px vertical, ±0.6° rocking, same transform on the
// glass and its bloom — faded in by a smoothstep envelope (no jump), and the three light pools drift slowly.
// The pre-rendered sequence has 123 frames; the shot uses frames 0–110 only (the Math.min clamp never engages).
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import { C, FONT } from '../theme';
import { Backdrop, BlurLine, Glow, Wordmark } from '../lib/ui';
import { clamp, EASE } from '../lib/motion';
import { localBeat, SHOTS } from '../timeline';

const GLASS_FRAMES = 123;
const GW = 820;
const GH = (GW * 821) / 900;
const GX = 1460;
const GY = 545;

// float (2D, over the pre-rendered 3D pose): smoothstep envelope f20→50, phase origin f20
const FLOAT_T = 90;
const FLOAT_Y = 8; // px
const FLOAT_ROT = 0.6; // deg
const FLOAT_IN: [number, number] = [20, 50];
const smoothstep = (f: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (f - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// light-pool drift: smooth start, still moving at the cut (no settle)
const DRIFT_EASE = Easing.bezier(0.45, 0, 0.8, 0.8);

export const Brand: React.FC = () => {
  const f = useCurrentFrame();
  const g = Math.min(GLASS_FRAMES - 1, f);
  const src = staticFile(`glass/g${String(g).padStart(5, '0')}.png`);
  // halation (style D): impact = frame 0; 6f out-cubic swell to 1.3, 20f linear fall to .35, 15f settle to .22
  // scale kept at 1.12 (card value 1.3): the 5's block silhouette scaled ×1.3 reads as a glowing box
  const bloomScale = interpolate(f, [0, 6], [1, 1.12], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bloomOpacity = f < 26 ? interpolate(f, [6, 26], [0.9, 0.3], clamp) : interpolate(f, [26, 41], [0.3, 0.16], { ...clamp, easing: Easing.out(Easing.quad) });
  const pool = interpolate(f, [0, 8, 40], [1.4, 1, 0.85], clamp);
  const sub = interpolate(f, [34, 50], [0, 1], { ...clamp, easing: EASE });
  const mark = interpolate(f, [44, 62], [0, 1], { ...clamp, easing: EASE });

  // float: vertical sine (rises first) + rocking a quarter period later, so one of them is always moving
  const env = smoothstep(f, FLOAT_IN[0], FLOAT_IN[1]);
  const ph = (2 * Math.PI * (f - FLOAT_IN[0])) / FLOAT_T;
  const floatY = -FLOAT_Y * env * Math.sin(ph);
  const floatR = FLOAT_ROT * env * Math.cos(ph);
  const float = `translateY(${floatY.toFixed(3)}px) rotate(${floatR.toFixed(4)}deg)`;

  // light pools: slow drift over the hold (≈0.6–0.8 px/f at the end), no pulse
  const d = interpolate(f, [24, 110], [0, 1], { ...clamp, easing: DRIFT_EASE });

  return (
    <AbsoluteFill>
      <Backdrop dim={0.3} />
      <Glow x={GX + 30 * d} y={GY + 260 - 40 * d} r={560 * pool * (1 + 0.08 * d)} color={C.glowViolet} />
      <Glow x={GX - 420 - 50 * d} y={GY - 200 + 34 * d} r={420 * (1 + 0.1 * d)} color={C.glowCyan} />
      <Glow x={GX + 300 - 26 * d} y={GY - 40 + 56 * d} r={380 * (1 - 0.06 * d)} color={C.glowFuchsia} />
      {/* bloom layer under the sculpture (mounted only while it is visible); same float as the glass */}
      {bloomOpacity > 0.01 ? (
        <Img
          src={src}
          style={{
            position: 'absolute', left: GX - GW / 2, top: GY - GH / 2, width: GW, height: GH,
            transform: `${float} scale(${bloomScale})`, opacity: bloomOpacity, filter: 'blur(30px) brightness(1.6) saturate(1.3)', mixBlendMode: 'screen',
          }}
        />
      ) : null}
      <Img src={src} style={{ position: 'absolute', left: GX - GW / 2, top: GY - GH / 2, width: GW, height: GH, transform: float }} />
      <div style={{ position: 'absolute', left: 140, top: 360, width: 1000 }}>
        <BlurLine line="Comprends tes parties." start={localBeat(SHOTS.brand, 17)} size={92} weight={800} snap />
        <BlurLine line={[{ text: 'Prépare la suite.', spectrum: true }]} start={localBeat(SHOTS.brand, 18.5)} size={92} weight={800} snap />
        <div style={{ marginTop: 34, fontFamily: FONT, fontWeight: 500, fontSize: 36, lineHeight: 1.35, color: C.text2, opacity: sub, transform: `translateY(${(1 - sub) * 14}px)` }}>
          L’espace de travail des équipes
          <br />
          et coachs League of Legends
        </div>
      </div>
      <div style={{ position: 'absolute', left: 140, top: 820, opacity: mark, transform: `translateY(${(1 - mark) * 16}px)` }}>
        <Wordmark width={380} />
      </div>
    </AbsoluteFill>
  );
};
