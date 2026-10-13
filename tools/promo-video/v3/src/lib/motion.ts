import { Easing, interpolate } from 'remotion';
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
/** Brand easing token (premium esports): bezier(0.16,1,0.3,1). */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const outCubic = Easing.bezier(0.33, 1, 0.68, 1);
export const ramp = (f: number, a: number, b: number, ease = EASE) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
