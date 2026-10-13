// Hook camera — same coordinate math as lib/PageCam2D (CSS zoom for crisp push-ins, Q2), but the camera
// state is computed once per frame so that several layers (page / annotation above the spotlight) share
// exactly the same view, plus a projection helper so the screen-space spotlight can track the hero.
import React from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';

export type Cam = { cx: number; cy: number; zoom: number; rotX: number; rotY: number; rotZ: number; persp: number };
export type CamKey = Cam & { frame: number; ease?: (t: number) => number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const camAt = (keys: CamKey[], frame: number): Cam => {
  if (frame <= keys[0].frame) return keys[0];
  const last = keys[keys.length - 1];
  if (frame >= last.frame) return last;
  let i = 0;
  while (i < keys.length - 2 && frame > keys[i + 1].frame) i++;
  const a = keys[i];
  const b = keys[i + 1];
  // the easing of a segment is carried by its END key
  const t = interpolate(frame, [a.frame, b.frame], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: b.ease ?? Easing.bezier(0.33, 0, 0.15, 1),
  });
  return {
    cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), zoom: lerp(a.zoom, b.zoom, t),
    rotX: lerp(a.rotX, b.rotX, t), rotY: lerp(a.rotY, b.rotY, t), rotZ: lerp(a.rotZ, b.rotZ, t), persp: lerp(a.persp, b.persp, t),
  };
};

const D2R = Math.PI / 180;
/** Screen position (1920×1080) of a page point (x, y) lifted by z page px, and its local scale factor. */
export const project = (c: Cam, x: number, y: number, z = 0) => {
  const Z = c.zoom;
  let vx = (x - c.cx) * Z;
  let vy = (y - c.cy) * Z;
  let vz = z * Z;
  let a = c.rotZ * D2R;
  [vx, vy] = [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];
  a = c.rotX * D2R;
  [vy, vz] = [vy * Math.cos(a) - vz * Math.sin(a), vy * Math.sin(a) + vz * Math.cos(a)];
  a = c.rotY * D2R;
  [vx, vz] = [vx * Math.cos(a) + vz * Math.sin(a), -vx * Math.sin(a) + vz * Math.cos(a)];
  const P = c.persp * Z;
  const s = P / (P - vz);
  return { x: 960 + vx * s, y: 540 + vy * s, scale: s * Z };
};

/** A transparent page-space layer (1920 × pageH) seen through camera `cam`. Children use page CSS px. */
export const CamLayer: React.FC<{ cam: Cam; pageH: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({
  cam, pageH, children, style,
}) => (
  <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', ...style }}>
    <div style={{ position: 'absolute', inset: 0, perspective: `${cam.persp * cam.zoom}px`, perspectiveOrigin: '960px 540px' }}>
      <div
        style={{
          position: 'absolute', width: 1920, height: pageH, zoom: cam.zoom,
          transform: `translate(${960 / cam.zoom - cam.cx}px, ${540 / cam.zoom - cam.cy}px) rotateY(${cam.rotY}deg) rotateX(${cam.rotX}deg) rotateZ(${cam.rotZ}deg)`,
          transformOrigin: `${cam.cx}px ${cam.cy}px`,
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </div>
  </AbsoluteFill>
);
