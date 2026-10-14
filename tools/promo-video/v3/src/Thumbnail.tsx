// YouTube thumbnail (1280x720): the hook (« Victoire. Pourquoi ? ») next to the glass 5, in the charte (Inter, official files).
// npx remotion still src/index.ts Thumbnail out/thumbnail.png
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { C, FONT, spectrumText } from './theme';
import { Backdrop, Glow, Wordmark } from './lib/ui';

const GW = 640;
const GH = (GW * 821) / 900;

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <AbsoluteFill style={{ transform: 'scale(0.6667)', transformOrigin: '0 0', width: 1920, height: 1080 }}>
      <Backdrop dim={0.25} />
    </AbsoluteFill>
    <Glow x={960} y={500} r={470} color={C.glowViolet} />
    <Glow x={1130} y={260} r={330} color={C.glowFuchsia} />
    <Glow x={760} y={240} r={330} color={C.glowCyan} />
    <Img src={staticFile('glass/g00122.png')} style={{ position: 'absolute', left: 1020 - GW / 2, top: 352 - GH / 2, width: GW, height: GH }} />
    <div style={{ position: 'absolute', left: 64, top: 118, lineHeight: 1.02, letterSpacing: '-0.035em', fontWeight: 800 }}>
      <div style={{ fontSize: 158, color: C.success }}>Victoire.</div>
      <div style={{ fontSize: 138, marginTop: 14 }}>
        <span style={spectrumText}>Pourquoi</span>
        <span style={{ color: C.text }}>{' ?'}</span>
      </div>
    </div>
    <Wordmark width={250} style={{ position: 'absolute', left: 70, top: 560 }} />
  </AbsoluteFill>
);
