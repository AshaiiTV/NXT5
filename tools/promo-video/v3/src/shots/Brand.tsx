// Shot 2 — the drop (slam #1). The site's real glass 5 (pre-rendered by glass/render-glass.cjs from
// src/pages/home/glass-scene.js) spins in on the downbeat; a halation bloom (shot card effects/light-play-moves,
// style D) swells from it on the impact frame and settles; the official tagline arrives in blur-slide.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import { C, FONT } from '../theme';
import { Backdrop, BlurLine, Glow, Wordmark } from '../lib/ui';
import { clamp, EASE } from '../lib/motion';

const GLASS_FRAMES = 123;
const GW = 820;
const GH = (GW * 821) / 900;
const GX = 1460;
const GY = 545;

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
  return (
    <AbsoluteFill>
      <Backdrop dim={0.3} />
      <Glow x={GX} y={GY + 260} r={560 * pool} color={C.glowViolet} />
      <Glow x={GX - 420} y={GY - 200} r={420} color={C.glowCyan} />
      <Glow x={GX + 300} y={GY - 40} r={380} color={C.glowFuchsia} />
      {/* bloom layer under the sculpture (mounted only while it is visible) */}
      {bloomOpacity > 0.01 ? (
        <Img
          src={src}
          style={{
            position: 'absolute', left: GX - GW / 2, top: GY - GH / 2, width: GW, height: GH,
            transform: `scale(${bloomScale})`, opacity: bloomOpacity, filter: 'blur(30px) brightness(1.6) saturate(1.3)', mixBlendMode: 'screen',
          }}
        />
      ) : null}
      <Img src={src} style={{ position: 'absolute', left: GX - GW / 2, top: GY - GH / 2, width: GW, height: GH }} />
      <div style={{ position: 'absolute', left: 140, top: 360, width: 1000 }}>
        <BlurLine line="Comprends tes parties." start={8} size={92} />
        <BlurLine line={[{ text: 'Prépare la suite.', spectrum: true }]} start={18} size={92} />
        <div style={{ marginTop: 34, fontFamily: FONT, fontWeight: 500, fontSize: 36, color: C.text2, opacity: sub, transform: `translateY(${(1 - sub) * 14}px)` }}>
          L’espace de travail des équipes et coachs League of Legends
        </div>
      </div>
      <div style={{ position: 'absolute', left: 140, top: 820, opacity: mark, transform: `translateY(${(1 - mark) * 16}px)` }}>
        <Wordmark width={380} />
      </div>
    </AbsoluteFill>
  );
};
