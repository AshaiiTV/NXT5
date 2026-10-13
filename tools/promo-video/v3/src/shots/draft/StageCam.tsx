// Draft shot helpers: a 2.5D stage camera (same coordinate maths as lib/PageCam2D's 3D path — CSS `zoom`
// instead of transform scale so text stays crisp under push-ins, Q2 — but without a full-page texture, so the
// stage can hold a table, the draft card and a deck), and a monotone cubic spline so the camera flows through
// its keys without stopping at each one (PageCam2D eases in/out per segment).
import React from 'react';
import { AbsoluteFill } from 'remotion';

export type Cam = { cx: number; cy: number; zoom: number; rotX: number; rotY: number; rotZ: number; persp: number };

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

/**
 * Monotone cubic Hermite through [frame, value] keys (Fritsch–Butland tangents: no overshoot between keys).
 * The first key keeps its secant velocity (the shot opens already moving after the hard cut); the last key has
 * zero velocity (the camera settles).
 */
export function spline(f: number, keys: readonly (readonly [number, number])[]): number {
  const n = keys.length;
  if (f <= keys[0][0]) return keys[0][1];
  if (f >= keys[n - 1][0]) return keys[n - 1][1];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(keys[i + 1][0] - keys[i][0]);
    d.push((keys[i + 1][1] - keys[i][1]) / h[i]);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  let i = 0;
  while (i < n - 2 && f > keys[i + 1][0]) i++;
  const t = (f - keys[i][0]) / h[i];
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * keys[i][1] +
    (t3 - 2 * t2 + t) * h[i] * m[i] +
    (-2 * t3 + 3 * t2) * keys[i + 1][1] +
    (t3 - t2) * h[i] * m[i + 1]
  );
}
