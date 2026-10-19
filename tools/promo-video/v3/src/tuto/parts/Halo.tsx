// Highlight halo on a target (screen space): cyan ring + soft glow, optional spotlight that dims the rest of the frame.
// One halo at a time on the hero element (Q4: no glint sweeps); it never changes the UI pixels underneath.
import React from 'react';
import type { Rect } from '../script';
import { BRAND, COL, IO, lerp, ramp } from '../style';

export const haloAmount = (f: number, f0: number, f1: number) => Math.min(ramp(f, f0, f0 + 9, BRAND), 1 - ramp(f, f1, f1 + 8, IO));

/** The same halo attached to an element (child of a position: relative box): no measuring needed in schematics. */
export const Ring: React.FC<{ f: number; f0: number; f1: number; pad?: number; radius?: number }> = ({ f, f0, f1, pad = 10, radius = 14 }) => {
  const a = haloAmount(f, f0, f1);
  if (a <= 0.001) return null;
  const g = (1 - ramp(f, f0, f0 + 9, BRAND)) * 8;
  return (
    <div
      style={{
        position: 'absolute', inset: -(pad + g), borderRadius: radius, opacity: a, border: `3px solid ${COL.halo}`, pointerEvents: 'none',
        boxShadow: `0 0 0 5px rgba(103,232,249,.16), 0 0 30px ${COL.haloGlow}, inset 0 0 18px rgba(103,232,249,.18)`,
      }}
    />
  );
};

/** `pulse`: frame of one soft outline that grows out of the halo (a hover confirmation, not a click: no press, no
 * ripple dot). */
export const Halo: React.FC<{ r: Rect; f: number; f0: number; f1: number; radius: number; spot?: boolean; circle?: boolean; pulse?: number }> = ({
  r, f, f0, f1, radius, spot, circle, pulse,
}) => {
  const a = haloAmount(f, f0, f1);
  if (a <= 0.001) return null;
  const pt = pulse === undefined ? -1 : f - pulse;
  const pulseRing = pt >= 0 && pt < 22 ? (
    <div
      style={{
        position: 'absolute', left: r.x - 18 * ramp(pt, 0, 20, BRAND), top: r.y - 18 * ramp(pt, 0, 20, BRAND),
        width: r.w + 36 * ramp(pt, 0, 20, BRAND), height: r.h + 36 * ramp(pt, 0, 20, BRAND), borderRadius: radius + 12,
        border: `2px solid ${COL.halo}`, opacity: 0.7 * (1 - ramp(pt, 4, 22)) * a,
      }}
    />
  ) : null;
  const grow = lerp(1.08, 1, ramp(f, f0, f0 + 9, BRAND));
  const w = r.w * grow;
  const h = r.h * grow;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const d = Math.max(w, h);
  const box = circle ? { left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%' } : { left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: radius };
  return (
    <>
      <div
        style={{
          position: 'absolute', ...box, opacity: a, border: `3px solid ${COL.halo}`,
          boxShadow: `${spot ? '0 0 0 4000px rgba(9,13,24,.42), ' : ''}0 0 0 5px rgba(103,232,249,.16), 0 0 30px ${COL.haloGlow}, inset 0 0 18px rgba(103,232,249,.18)`,
        }}
      />
      {pulseRing}
    </>
  );
};
