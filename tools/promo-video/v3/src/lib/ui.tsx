// Shared film pieces, all in the NXT5 charte: night backdrop, light, blur-slide titles (shot card
// typography/blur-slide), "Données fictives" tag, official wordmark.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT, spectrumText } from '../theme';
import { clamp, EASE, lerp, outCubic } from './motion';
import { BEAT_INT, FPS } from '../timeline';

/** One eighth note in frames (snap captions land word by word on the eighth grid). */
export const EIGHTH_F = (BEAT_INT * FPS) / 2;

/** Night background: the home atmosphere (clouds) or the loading glass floor, faded to #111827 at the edges. */
export const Backdrop: React.FC<{ img?: 'atmosphere' | 'glass-atmosphere'; dim?: number; drift?: number }> = ({
  img = 'glass-atmosphere',
  dim = 0.4,
  drift = 1,
}) => {
  const f = useCurrentFrame();
  const s = 1.06 + 0.012 * Math.sin(f / 90);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <Img
        src={staticFile(`brand/${img}.webp`)}
        style={{ position: 'absolute', width: 1920, height: 1080, objectFit: 'cover', transform: `translateX(${Math.sin(f / 120) * 14 * drift}px) scale(${s})` }}
      />
      <AbsoluteFill style={{ backgroundColor: `rgba(17,24,39,${dim})` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 70% at 50% 55%, rgba(17,24,39,0) 40%, rgba(17,24,39,.92) 100%)' }} />
    </AbsoluteFill>
  );
};

/** Soft coloured light pool (violet = matter, cyan = guide, fuchsia = counter-light). */
export const Glow: React.FC<{ x: number; y: number; r: number; color: string; opacity?: number }> = ({ x, y, r, color, opacity = 1 }) => (
  <div
    style={{
      position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
      background: `radial-gradient(circle, ${color}, transparent 70%)`, opacity, pointerEvents: 'none',
    }}
  />
);

type Words = { text: string; spectrum?: boolean }[];
const toWords = (line: string | Words): Words =>
  typeof line === 'string' ? line.split(' ').map((text) => ({ text })) : line.flatMap((p) => p.text.split(' ').map((text) => ({ text, spectrum: p.spectrum })));

/**
 * blur-slide (shot card typography/blur-slide): words rise y→0 + blur→0 + opacity 0→1 on ONE shared progress
 * and one easing; ~3.5f between words, 20f per word. `start` is the local frame where the line begins.
 * `snap`: the energetic variant used on full-energy music (review round 2, « LoL / Persona »): each word slams
 * in on the eighth-note grid from `start` (scale 1.18 → 1 in 5 f, no blur), element level only (R4).
 */
export const BlurLine: React.FC<{
  line: string | Words; start: number; size: number; weight?: number; color?: string; gap?: number; win?: number;
  out?: number; align?: 'left' | 'center'; style?: React.CSSProperties; snap?: boolean;
}> = ({ line, start, size, weight = 700, color = C.text, gap = 3.5, win = 20, out, align = 'left', style, snap = false }) => {
  const f = useCurrentFrame();
  const words = toWords(line);
  const exit = out === undefined ? 0 : interpolate(f, [out, out + 10], [0, 1], { ...clamp, easing: outCubic });
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '0 0.26em', justifyContent: align === 'center' ? 'center' : 'flex-start',
        fontFamily: FONT, fontSize: size, fontWeight: weight, color, lineHeight: 1.12, letterSpacing: '-0.02em',
        opacity: 1 - exit, transform: `translateY(${-exit * size * 0.25}px)`, filter: exit ? `blur(${exit * 8}px)` : undefined, ...style,
      }}
    >
      {words.map((w, i) => {
        if (snap) {
          const t = start + Math.round(i * EIGHTH_F);
          const q = interpolate(f, [t, t + 5], [0, 1], { ...clamp, easing: outCubic });
          return (
            <span
              key={i}
              style={{
                display: 'inline-block', opacity: Math.min(1, q * 2.5), transform: q < 1 ? `scale(${1.18 - 0.18 * q})` : undefined, transformOrigin: '50% 70%',
                ...(w.spectrum ? spectrumText : {}),
              }}
            >
              {w.text}
            </span>
          );
        }
        const p = interpolate(f, [start + i * gap, start + i * gap + win], [0, 1], { ...clamp, easing: outCubic });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block', opacity: p, transform: `translateY(${lerp(size * 0.45, 0, p)}px)`, filter: p < 1 ? `blur(${(1 - p) * size * 0.12}px)` : undefined,
              ...(w.spectrum ? spectrumText : {}),
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Feature caption block: cyan eyebrow + two-line title (second line spectrum), readable size (Q11: ≥56px).
 * Snap captions (default): put `start` on a beat or eighth; the words then land one per eighth note.
 */
export const FeatureTitle: React.FC<{ eyebrow: string; l1: string; l2: string; start: number; out?: number; x?: number; y?: number; snap?: boolean }> = ({
  eyebrow, l1, l2, start, out, x = 140, y = 380, snap = true,
}) => {
  const f = useCurrentFrame();
  const e = snap ? interpolate(f, [start - 3, start + 2], [0, 1], clamp) : interpolate(f, [start, start + 14], [0, 1], { ...clamp, easing: EASE });
  const exit = out === undefined ? 0 : interpolate(f, [out, out + 10], [0, 1], clamp);
  const l2Start = snap ? start + Math.round(l1.split(' ').length * EIGHTH_F) : start + 10;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 800 }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 32, letterSpacing: '0.2em', color: C.cyan, opacity: e * (1 - exit), marginBottom: 18 }}>
        {eyebrow}
      </div>
      <BlurLine line={l1} start={snap ? start : start + 2} size={84} weight={snap ? 800 : 700} out={out} snap={snap} />
      <BlurLine line={[{ text: l2, spectrum: true }]} start={l2Start} size={84} weight={snap ? 800 : 700} out={out} snap={snap} />
    </div>
  );
};

/** Charte §10: example data must say so. Same bottom-right slot in every shot (72 px up, clear of the YouTube progress bar) unless x/y are given. */
export const FictiveTag: React.FC<{ x?: number; y?: number; opacity?: number }> = ({ x, y, opacity = 1 }) => (
  <div
    style={{
      position: 'absolute', ...(x === undefined ? { right: 48 } : { left: x }), ...(y === undefined ? { bottom: 72 } : { top: y }),
      padding: '9px 22px', borderRadius: 999, opacity, whiteSpace: 'nowrap',
      background: 'rgba(17,24,39,.72)', border: '1.5px solid rgba(181,200,225,.38)',
      fontFamily: FONT, fontWeight: 600, fontSize: 28, color: C.muted,
    }}
  >
    Données fictives
  </div>
);

/** Official wordmark file (never redrawn). */
export const Wordmark: React.FC<{ width: number; style?: React.CSSProperties }> = ({ width, style }) => (
  <Img src={staticFile('brand/nxt5-wordmark.png')} style={{ width, height: (width * 350) / 1115, display: 'block', ...style }} />
);
