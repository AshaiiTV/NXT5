// Cursor that travels to each target before clicking (shot card interaction/input-trigger-moves, style A
// cursor-performance, toned down for a tutorial): calm in-out glide on a slight arc (~0.5 s), press (2 f down, 5 f
// back), ripple whose diameter (out-cubic) and fade (linear) are decoupled, unmounted after. Positions are capture
// (page) points mapped through the camera every frame, so the cursor stays pinned to its target while the camera zooms.
import React from 'react';
import { Easing, interpolate } from 'remotion';
import type { Click, Move, Pt, PtRef } from '../script';
import { resolvePt } from '../captures';
import { clamp, COL, IO, ramp } from '../style';

const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [k[0] * p0[0] + k[1] * p1[0] + k[2] * p2[0] + k[3] * p3[0], k[0] * p0[1] + k[1] * p1[1] + k[2] * p2[1] + k[3] * p3[1]];
};

/** Glide from a to b with a gentle bow (8 % of the distance, max 50 px), eased in-out. */
const glide = (a: Pt, b: Pt, t: number): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d;
  let ny = dx / d;
  if (nx + ny < 0) { nx = -nx; ny = -ny; }
  const bend = Math.min(50, d * 0.08);
  const p1: Pt = [a[0] + dx * 0.25 + nx * bend, a[1] + dy * 0.25 + ny * bend];
  const p2: Pt = [a[0] + dx * 0.72 + nx * bend * 0.5, a[1] + dy * 0.72 + ny * bend * 0.5];
  return bez(a, p1, p2, b, IO(t));
};

/** Cursor point (page space) at frame f. Works for capture points and for schematic (screen) points alike. */
export const cursorPoint = (start: PtRef, moves: Move[], f: number, resolve: (p: PtRef) => Pt = resolvePt): Pt => {
  let p = resolve(start);
  for (const m of moves) {
    if (f <= m.f) return p;
    const to = resolve(m.to);
    if (f < m.f + m.dur) return glide(p, to, (f - m.f) / m.dur);
    p = to;
  }
  return p;
};

/** Press amount 0..1 (2 f down, 5 f back) summed over the clicks. */
export const pressAt = (clicks: Click[], f: number) =>
  clicks.reduce((acc, c) => acc + interpolate(f, [c.f, c.f + 2, c.f + 7], [0, 1, 0], clamp), 0);

export const CursorArrow: React.FC<{ x: number; y: number; size: number; press?: number; opacity?: number }> = ({ x, y, size, press = 0, opacity = 1 }) => {
  if (opacity <= 0.001) return null;
  const s = 1 - 0.14 * Math.min(1, press);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      style={{
        position: 'absolute', left: x - (2 * size) / 28, top: y - size / 28 + 2 * press, overflow: 'visible', opacity,
        transform: `scale(${s})`, transformOrigin: `${(2 * size) / 28}px ${size / 28}px`, filter: 'drop-shadow(0 4px 8px rgba(2,6,17,.6))',
      }}
    >
      <path d="M2 1 L2 23 L8 17.5 L11.5 25 L15.5 23.2 L12 15.8 L20 15 Z" fill="#FFFFFF" stroke="#0B1220" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
};

const outCubic = Easing.out(Easing.cubic);
/** Click ripple at a screen point (mounted only during its 24 frames). */
export const Ripple: React.FC<{ x: number; y: number; t: number; scale?: number }> = ({ x, y, t, scale = 1 }) => {
  if (t < 0 || t >= 24) return null;
  const d = interpolate(t, [0, 20], [16, 104], { ...clamp, easing: outCubic }) * scale;
  const o = interpolate(t, [0, 24], [0.9, 0], clamp);
  const bw = interpolate(t, [0, 20], [4, 2], clamp);
  const dot = interpolate(t, [0, 9], [0.45, 0], clamp);
  return (
    <>
      <div style={{ position: 'absolute', left: x - 13, top: y - 13, width: 26, height: 26, borderRadius: '50%', background: COL.halo, opacity: dot }} />
      <div style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', border: `${bw}px solid ${COL.halo}`, opacity: o, boxShadow: `0 0 18px ${COL.haloGlow}` }} />
    </>
  );
};

/** Everything the cursor draws at frame f, in screen space. */
export const CursorLayer: React.FC<{
  f: number; point: Pt; clicks: Click[]; size: number; opacity: number;
}> = ({ f, point, clicks, size, opacity }) => {
  const press = pressAt(clicks, f);
  return (
    <>
      {clicks.map((c) => (f >= c.f && f < c.f + 24 ? <Ripple key={c.f} x={point[0]} y={point[1]} t={f - c.f} /> : null))}
      <CursorArrow x={point[0]} y={point[1]} size={size} press={press} opacity={opacity} />
    </>
  );
};

/** Fade in from `show`, out from `hide` (8 f each). */
export const cursorOpacity = (f: number, show: number, hide?: number) => ramp(f, show, show + 8) * (hide === undefined ? 1 : 1 - ramp(f, hide, hide + 8));
