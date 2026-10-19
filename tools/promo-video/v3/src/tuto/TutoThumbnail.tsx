// YouTube thumbnail of the tutorial (1280x720): the real NXT5 Importer window (home screen, client connected, no
// game data) tilted next to a short, very legible promise. Charte NXT5: night, violet glass, Inter, official files.
// npx remotion still src/index.ts TutoThumbnail out/tuto-thumbnail.png
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { C, FONT, spectrumText } from '../theme';
import { Backdrop, Glow, Wordmark } from '../lib/ui';

const WIN_W = 760;
const WIN_H = (WIN_W * 1580) / 2360;

export const TutoThumbnail: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT, overflow: 'hidden' }}>
    <AbsoluteFill style={{ transform: 'scale(0.6667)', transformOrigin: '0 0', width: 1920, height: 1080 }}>
      <Backdrop dim={0.3} />
    </AbsoluteFill>
    <Glow x={1010} y={380} r={520} color={C.glowViolet} />
    <Glow x={1150} y={170} r={300} color={C.glowCyan} />
    <Glow x={820} y={640} r={300} color={C.glowFuchsia} />

    {/* the real Importer window, tilted towards the title */}
    <div style={{ position: 'absolute', left: 548, top: 168, width: WIN_W, height: WIN_H, perspective: 1600 }}>
      <div
        style={{
          width: '100%', height: '100%', transform: 'rotateY(-16deg) rotateX(4deg) rotateZ(-1deg)', transformOrigin: '0% 50%',
          borderRadius: 18, overflow: 'hidden', border: `2px solid ${C.glassBorder}`,
          boxShadow: '0 30px 80px rgba(2,6,17,.65), 0 0 60px rgba(139,92,246,.35)',
        }}
      >
        <Img src={staticFile('tuto/importer-01-accueil-client-connecte.png')} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>

    {/* promise */}
    <div style={{ position: 'absolute', left: 56, top: 92, width: 640 }}>
      <div
        style={{
          display: 'inline-block', padding: '8px 22px', borderRadius: 999, background: C.cyan, color: C.onAccent,
          fontWeight: 800, fontSize: 34, letterSpacing: '0.12em',
        }}
      >
        TUTO
      </div>
      <div style={{ marginTop: 26, fontWeight: 800, fontSize: 112, lineHeight: 0.98, letterSpacing: '-0.035em', color: C.text }}>
        Importe
        <br />
        <span style={spectrumText}>ta partie</span>
      </div>
      <div style={{ marginTop: 26, fontWeight: 700, fontSize: 40, lineHeight: 1.2, color: C.text2 }}>
        Du téléchargement
        <br />
        à NXT5, pas à pas
      </div>
    </div>

    <Wordmark width={230} style={{ position: 'absolute', left: 60, top: 600 }} />
  </AbsoluteFill>
);
