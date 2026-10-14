// Draft shot helpers: a 2.5D stage camera (same coordinate maths as lib/PageCam2D's 3D path — CSS `zoom`
// instead of transform scale so text stays crisp under push-ins, Q2 — but without a full-page texture, so the
// stage can hold a table, the draft card and a deck). Keys and the monotone spline live in ./plan.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Cam } from './plan';

/**
 * Page-space children are positioned in CSS px; (cx, cy) is the page point under the frame centre. `zoom` is a CSS
 * zoom (crisp raster); `s` scales about the frame centre on top of it, so screen = 960 + (x − cx)·zoom·s (flat stage).
 */
export const StageCam: React.FC<{ cam: Cam; children?: React.ReactNode }> = ({ cam, children }) => {
  const { cx, cy, zoom, rotX, rotY, rotZ, persp, s } = cam;
  // flat stage (row push and drift, rotations all 0): a plain 2D transform, no 3D rendering context, so the slow
  // drift is not re-snapped by the 3D compositing path
  const flat = rotX === 0 && rotY === 0 && rotZ === 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, ...(flat ? {} : { perspective: `${persp * zoom}px`, perspectiveOrigin: '960px 540px' }) }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, zoom,
            transform: flat
              ? `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px)${s !== 1 ? ` scale(${s.toFixed(6)})` : ''}`
              : `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px) rotateY(${rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg)${s !== 1 ? ` scale(${s.toFixed(6)})` : ''}`,
            transformOrigin: `${cx}px ${cy}px`,
            ...(flat ? {} : { transformStyle: 'preserve-3d' as const }),
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};
