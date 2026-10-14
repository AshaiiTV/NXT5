// Draft shot helpers: a 2.5D stage camera (same coordinate maths as lib/PageCam2D's 3D path — CSS `zoom`
// instead of transform scale so text stays crisp under push-ins, Q2 — but without a full-page texture, so the
// stage can hold a table, the draft card and a deck). Keys and the monotone spline live in ./plan.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Cam } from './plan';

/** Page-space children are positioned in CSS px; (cx, cy) is the page point under the frame centre. */
export const StageCam: React.FC<{ cam: Cam; children?: React.ReactNode }> = ({ cam, children }) => {
  const { cx, cy, zoom, rotX, rotY, rotZ, persp } = cam;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, perspective: `${persp * zoom}px`, perspectiveOrigin: '960px 540px' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, zoom,
            transform: `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px) rotateY(${rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transformStyle: 'preserve-3d',
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};
