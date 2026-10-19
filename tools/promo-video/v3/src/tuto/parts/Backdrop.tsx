// Night background shared by every shot. It moves with the GLOBAL frame, so two shots cross-fading over it never
// show two copies of the background (variant of lib/ui Backdrop, which uses the local frame).
import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { COL } from '../style';

export const ShotCtx = createContext<{ g0: number; dur: number }>({ g0: 0, dur: 0 });
/** Global frame inside a shot's <Sequence>. */
export const useGlobalFrame = () => useCurrentFrame() + useContext(ShotCtx).g0;

export const TutoBackdrop: React.FC<{ dim?: number }> = ({ dim = 0.5 }) => {
  const g = useGlobalFrame();
  const s = 1.06 + 0.01 * Math.sin(g / 110);
  return (
    <AbsoluteFill style={{ backgroundColor: COL.night, overflow: 'hidden' }}>
      <Img
        src={staticFile('brand/glass-atmosphere.webp')}
        style={{ position: 'absolute', width: 1920, height: 1080, objectFit: 'cover', transform: `translateX(${Math.sin(g / 140) * 10}px) scale(${s})` }}
      />
      <AbsoluteFill style={{ backgroundColor: `rgba(17,24,39,${dim})` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 75% at 50% 48%, rgba(17,24,39,0) 35%, rgba(17,24,39,.9) 100%)' }} />
    </AbsoluteFill>
  );
};
