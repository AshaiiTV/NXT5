// Layout and motion tokens of the tutorial (charte NXT5 v1.92 colours come from ../theme).
import { Easing, interpolate } from 'remotion';
import { C } from '../theme';
import { clamp, EASE, lerp, outCubic } from '../lib/motion';

/** Working area (AREA, between the step header and the subtitle bar) and fit scales (fitOf, from the film's apps) live
 * in camera.ts, shared with the Node QA. A zoomed capture never runs under the chrome: it is clipped to this band
 * (FEATHER, areaMask). */
export { AREA, AREA_H, FEATHER, fitOf } from './camera';

/** Top bar slots: step header (left) and data tag (right), same top edge. */
export const TOP = { y: 36, h: 64, left: 48, right: 48 } as const;
/** Subtitle bar: bottom-anchored, fixed width, 1 or 2 lines, opaque. 52 px stays legible in a 480 px-wide player;
 * a 2-line bar spans y 875 → 1040, below the working area (850) and above the frame's safe margin. */
export const SUB = { bottom: 40, w: 1780, font: 52, line: 1.24, padY: 18 } as const;

export { clamp, lerp };
/** Calm in-out for camera and cursor (tutorial, no overshoot). */
export const IO = Easing.bezier(0.45, 0, 0.2, 1);
/** Brand easing token (lib/motion EASE, bezier 0.16, 1, 0.3, 1) for entrances. */
export const BRAND = EASE;
export const OUT = outCubic;
export const ramp = (f: number, a: number, b: number, ease: (t: number) => number = (t) => t) =>
  b <= a ? (f >= b ? 1 : 0) : interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });
/** 0 → 1 over [a, a+fin], 1 until b, → 0 over [b, b+fout]. */
export const window01 = (f: number, a: number, b: number, fin = 9, fout = 8) =>
  Math.min(ramp(f, a, a + fin, BRAND), 1 - ramp(f, b, b + fout, IO));

export const COL = {
  ...C,
  cyanStrong: '#22D3EE',
  inputBg: '#111B2D', // sampled from the importer's « Identifiant du match » field (rgb 17,27,45)
  panelEdge: 'rgba(196,181,253,.34)',
  night: '#111827',
  scrim: 'rgba(9,13,24,.62)',
  halo: '#67E8F9',
  haloGlow: 'rgba(103,232,249,.45)',
  fileText: '#D8CCFF',
};
