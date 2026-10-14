// Shot 5 — breath card on the music's hollow bar (k44–48, 56f). Shot card typography/paper-title-card, re-skinned
// to the charte: no paper, no serif — night backdrop, ONE violet glass plate, Inter. The demo's letterpress word
// entrance is kept as tuned (scale 1.28→1 + blur 7px→0 + opacity, 9f per word, bezier(0.2,0.75,0.3,1)); "Et après"
// is already pressed on the cut (balanced first frame, no lone word) and "la" / "partie ?" press from f0 / f2, so
// the line is settled at f11 and holds ≥1.5 s to the hard cut on k48 (no tail fade: the debrief slams in on the
// cut). The text stays still during the hold; the shot's one light does the motion: a violet pool INSIDE the plate
// (clipped to its radius) drifts left → right behind the words while the plate breathes in by 4.5%. Exactly one
// accent word ("après", spectrum) and the short accent bar that closes the card. The DigitRoll sub-line is dropped
// (one line, no invented numbers).
// Seam C4 (transition-travel A, shared container): in its last frames Main passes `morph` — the plate itself grows into
// the debrief card: its outline is a rounded quad whose corners travel from the plate's to the card's (clip-path), the
// debrief page sits inside it and only ever shows card pixels, the glass face and words hold, then let go over
// f439–441 with a zoom blur (no plain cross-fade); the slam on k48 is the plate arriving at full speed as the page,
// and the debrief's own landing settle is the morph's overshoot.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, FONT, SPECTRUM_TEXT, glassSurface, spectrumText } from '../theme';
import { Backdrop } from '../lib/ui';
import { clamp } from '../lib/motion';
import { dur, SHOTS } from '../timeline';

const WORDS: { text: string; accent?: boolean }[] = [
  { text: 'Et' },
  { text: 'après', accent: true },
  { text: 'la' },
  { text: 'partie ?' },
];
const PRESS = Easing.bezier(0.2, 0.75, 0.3, 1); // demo value
const WORD_WIN = 9; // demo value
const WORD_GAP = 2; // demo: 4 — tightened so the whole line is readable by ~f8
// The cut lands mid-press: "Et après" is already pressed, "la" (t 0.80) and "partie ?" (t 0.39, blurred, scale 1.17)
// are pressing in, so frame 0 already spans the whole centred line (a balanced first frame — with "la"/"partie ?"
// still invisible the line sat in the left half of the plate). 2f stagger kept → readable by f6, settled at f8
// (abs 617) → 48f (1.6 s) of still hold to the cut.
const delayOf = (i: number) => (i < 2 ? -8 : -3 + (i - 2) * WORD_GAP);
const PANEL_W = 1380;
const PANEL_H = 420;
const PANEL_R = 28;
const LIGHT_D = 760; // the one light: violet pool inside the plate
const DRIFT = Easing.bezier(0.45, 0, 0.35, 1);
const D = dur(SHOTS.card);

/** Plate geometry (screen px, unscaled) and its breathing push, for the seam that carries it into the next shot. */
export const BREATH_PLATE = { w: PANEL_W, h: PANEL_H, r: PANEL_R };
export const breathPushAt = (f: number) => interpolate(f, [0, D], [1, 1.045], { ...clamp, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });

/** Seam C4: the plate's container (a convex quad, screen px, clockwise from top-left), its face and the next shot's
 * page shown inside it. */
export type BreathMorph = {
  quad: { x: number; y: number }[]; r: number; content: React.ReactNode;
  /** face (glass gradient, light, words) opacity, its scale, and its zoom-blur amount 0 → 1 as it lets go */
  face: number; faceScale: number; zoom: number;
  /** screen point the face stays centred on while the container grows (default: the frame centre) */
  faceAt?: { x: number; y: number };
  /** opacity of the plate's glass over the page (default `face`), and the page's own defocus (px) as it is revealed */
  glass?: number; veil?: number;
};

/** SVG path of a convex polygon with circular corners of radius r (tangent points r / tan(θ/2) from each corner). */
export const roundedPath = (q: { x: number; y: number }[], r: number) => {
  const n = q.length;
  const pts = q.map((p1, i) => {
    const p0 = q[(i + n - 1) % n];
    const p2 = q[(i + 1) % n];
    const l0 = Math.hypot(p0.x - p1.x, p0.y - p1.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const u0 = { x: (p0.x - p1.x) / l0, y: (p0.y - p1.y) / l0 };
    const u2 = { x: (p2.x - p1.x) / l2, y: (p2.y - p1.y) / l2 };
    const th = Math.acos(Math.max(-1, Math.min(1, u0.x * u2.x + u0.y * u2.y)));
    const d = Math.min(r / Math.tan(th / 2), l0 / 2, l2 / 2);
    const rr = d * Math.tan(th / 2);
    return { a: { x: p1.x + u0.x * d, y: p1.y + u0.y * d }, b: { x: p1.x + u2.x * d, y: p1.y + u2.y * d }, rr };
  });
  const n2 = (v: number) => v.toFixed(2);
  return (
    `M${n2(pts[0].a.x)} ${n2(pts[0].a.y)} ` +
    pts.map((p, i) => `${i ? `L${n2(p.a.x)} ${n2(p.a.y)} ` : ''}A${n2(p.rr)} ${n2(p.rr)} 0 0 1 ${n2(p.b.x)} ${n2(p.b.y)}`).join(' ') +
    ' Z'
  );
};

export const BreathCard: React.FC<{ morph?: BreathMorph }> = ({ morph }) => {
  const f = useCurrentFrame();
  // the whole card breathes in by 4.5% over the bar: calm, continuous, no beat pulse
  const push = breathPushAt(f);
  const bar = interpolate(f, [6, 22], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) }); // demo 16→34
  const lightX = interpolate(f, [0, D], [0.22, 0.72], { ...clamp, easing: DRIFT }) * PANEL_W;

  const light = (
          /* the shot's one light: a violet pool drifting behind the words, clipped to the plate's radius */
          <div
            style={{
              position: 'absolute', left: lightX - LIGHT_D / 2, top: PANEL_H / 2 - LIGHT_D / 2, width: LIGHT_D, height: LIGHT_D,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.38), transparent 70%)', pointerEvents: 'none',
            }}
          />
  );
  const words = (
    <>
          <div
            style={{
              position: 'relative',
              fontFamily: FONT,
              fontSize: 120,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: '-0.025em',
              color: C.text,
              display: 'flex',
              flexWrap: 'nowrap',
              justifyContent: 'center',
              columnGap: '0.26em',
              whiteSpace: 'nowrap',
            }}
          >
            {WORDS.map((w, i) => {
              const delay = delayOf(i);
              const t = interpolate(f, [delay, delay + WORD_WIN], [0, 1], { ...clamp, easing: PRESS });
              return (
                <span
                  key={w.text}
                  style={{
                    display: 'inline-block',
                    opacity: t,
                    transform: `scale(${1.28 - 0.28 * t})`,
                    // "partie ?" grows to the right, away from "la", while both still press (no overlap)
                    transformOrigin: i === 3 ? '0% 60%' : undefined,
                    filter: t < 1 ? `blur(${(1 - t) * 7}px)` : undefined,
                    // descender room so the clipped spectrum fill keeps the "p" tail
                    paddingBottom: w.accent ? '0.08em' : undefined,
                    marginBottom: w.accent ? '-0.08em' : undefined,
                    ...(w.accent ? spectrumText : {}),
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
          <div
            style={{
              position: 'relative',
              height: 6,
              width: 200,
              marginTop: 40,
              borderRadius: 3,
              backgroundImage: SPECTRUM_TEXT,
              transform: `scaleX(${bar})`,
            }}
          />
    </>
  );

  if (morph) {
    // seam C4: the same plate, as a container growing into the debrief card; the debrief page is inside it (card pixels
    // only), the glass face (gradient, light, words) holds on top of it, then lets go with a zoom blur
    const { quad, r, face: fo, faceScale, zoom } = morph;
    const glassO = morph.glass ?? fo;
    const veil = morph.veil ?? 0;
    const d = roundedPath(quad, r);
    const at = morph.faceAt ?? { x: 960, y: 540 };
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    const bb = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const STREAKS = 5;
    // the words thin out a little ahead of the glass: their smear never covers more light than the words at rest
    const wordsO = Math.pow(fo, 1.6);
    const faceBox = (sc: number, o: number, key: string, blur = 0) => (
      <div
        key={key}
        style={{
          position: 'absolute', left: at.x - PANEL_W / 2, top: at.y - PANEL_H / 2, width: PANEL_W, height: PANEL_H,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${sc})`, opacity: o, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        {words}
      </div>
    );
    return (
      <AbsoluteFill>
        <Backdrop dim={0.55} drift={0.5} />
        {/* the plate's two shadows (glass surface + lift, CSS blur radius = 2σ, ×push like the plain plate), under the
            clipped container */}
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <defs>
            <filter id="breath-morph-sh1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={24 * push} /></filter>
            <filter id="breath-morph-sh2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={60 * push} /></filter>
          </defs>
          <path d={d} transform={`translate(0 ${16 * push})`} fill="rgba(2,6,17,.35)" filter="url(#breath-morph-sh1)" />
          <path d={d} transform={`translate(0 ${40 * push})`} fill="rgba(2,6,17,.45)" filter="url(#breath-morph-sh2)" />
        </svg>
        <AbsoluteFill style={{ clipPath: `path('${d}')` }}>
          {veil > 0.05 ? <AbsoluteFill style={{ filter: `blur(${veil.toFixed(2)}px)` }}>{morph.content}</AbsoluteFill> : morph.content}
          {/* the glass stays whole over the page while any word is left (no text over text), then clears in one frame */}
          {glassO > 0.001 ? (
            <div style={{ position: 'absolute', left: bb.x, top: bb.y, width: bb.w, height: bb.h, background: glassSurface.background, opacity: glassO }} />
          ) : null}
          {fo > 0.001 ? (
            <>
              <div
                style={{
                  position: 'absolute', left: at.x - PANEL_W / 2, top: at.y - PANEL_H / 2, width: PANEL_W, height: PANEL_H,
                  // the light leaves ahead of the words, so the page is never lit twice (no bright mixed frame)
                  transform: `scale(${faceScale})`, opacity: fo * fo,
                }}
              >
                {light}
              </div>
              {/* zoom blur: faint copies of the words trailing outward from the frame centre while they let go */}
              {zoom > 0.01
                ? Array.from({ length: STREAKS }, (_, i) => i + 1).map((j) =>
                    faceBox(faceScale * (1 + 0.07 * zoom * (j / STREAKS)), wordsO * 0.16 * (1 - j / (STREAKS + 1)), `z${j}`, 1 + 2 * zoom),
                  )
                : null}
              {faceBox(faceScale, wordsO, 'main', 2.5 * zoom)}
            </>
          ) : null}
        </AbsoluteFill>
        {/* the plate's glass edge, which becomes the card's edge */}
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <path d={d} fill="none" stroke={C.glassBorder} strokeWidth={1.5 * push} />
        </svg>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Backdrop dim={0.55} drift={0.5} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            ...glassSurface,
            width: PANEL_W,
            height: PANEL_H,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: PANEL_R,
            transform: `scale(${push})`,
            boxShadow: `${glassSurface.boxShadow}, 0 40px 120px rgba(2,6,17,.45)`,
          }}
        >
          {light}
          {words}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
