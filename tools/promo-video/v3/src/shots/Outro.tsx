// Shot 8 — the close (k68–84, frames 942–1169). Shot card outro/outro-group-photo-launch, re-skinned to the
// NXT5 night charte. Structure first (card « known pitfalls »): one representative of every feature already
// shown flies in from its side of the frame and settles in a fixed group-photo slot around the empty centre
// stage — the « Défaite » row of the hook, the review card, two draft picks, the planning card, the debrief.
// Landings sit on beats/half-beats and accelerate (R2: 14→7→7→4→3 f). Crane on the group layer
// (perspective rotateX 4°→0 + scale 1.06→1, then a slow push). Anticipation k74–76: the group recedes, the
// stage light under the centre swells, the OFFICIAL wordmark (lib <Wordmark/>, never redrawn) emerges from the
// light and accelerates toward the lens; contact exactly on k76 (local 110) = slam #3, the film's only third
// full-frame impact: one camera scale punch (no shake, Q3) + a halation on the wordmark only (Brand.tsx style D,
// the shot's single light effect, Q4). Then focus racks to the hero (group goes soft), the rule draws, and
// « Joue. Analyse. Recommence. » lands word by word on half-beats, then the CTA « Essaie la démo » + nxt5.org;
// everything is settled by local ~148 and held (≥1.7 s) until the last 20 frames fade to #111827.
//
// Card adaptations: demo serif letterpress → the wordmark is an image (charte §4: never rebuilt from letters),
// so it lands as one piece; amber landing glow per element dropped (Q4: no batch glints) — landings read through
// the tuned overshoot alone; opening light sweep dropped (full-frame sweep, Q4); gold dust → 20 deterministic
// cyan/lavender/fuchsia motes; warm stage light → violet/cyan/fuchsia pools of the charte. CTA: charte §6 buttons
// keep a 2 px radius and no resting halo, so the « pill » is the site's primary button shape.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT, PRIMARY_GRADIENT, spectrumText } from '../theme';
import { Backdrop, FictiveTag, Glow, Wordmark } from '../lib/ui';
import { clamp, EASE, outCubic } from '../lib/motion';
import { dur, localBeat, SHOTS } from '../timeline';
import layout from '../layout.json';

const B = (k: number) => localBeat(SHOTS.outro, k);
const END = dur(SHOTS.outro); // 221
const IMPACT = B(76); // 110 — slam #3
const FADE = [END - 20, END] as const; // gentle fade to #111827 (audio fade handled in Main)

// card-tuned easings
const FLY_EASE = Easing.bezier(0.34, 1.4, 0.44, 1); // y1 > 1: a real overshoot on landing (card lesson)
const CRANE_EASE = Easing.bezier(0.3, 0, 0.2, 1);
const FLY = 12; // frames of flight per element (card value)
// FLY_EASE crosses 1 at ~38 % of the flight: the element first touches its slot ~5f after its cue, then overshoots
// and settles. `beat` below is that contact frame, so the visible landing sits on the beat.
const CONTACT = 5;

// ── hero layout (screen px) ──
const WM_W = 880;
const WM_H = (WM_W * 350) / 1115;
const WM_CX = 960;
const WM_CY = 336;
const RULE_Y = WM_CY + WM_H / 2 + 26;
const TAG_Y = RULE_Y + 36;
const CTA_Y = TAG_Y + 146;

// ── group photo: one representative per feature already shown (Q8), each lands in its own slot ──
type El = {
  key: string; tex: keyof typeof layout; cx: number; cy: number; s: number; rot: number; dx: number; dy: number;
  r: number; beat: number; alpha?: boolean; frame?: boolean;
};
const ELS: El[] = [
  // slot contacts: k69, k70, k70.5, k71, k71.25, k71.5 → 13, 27, 34, 41, 45, 48 (accelerating, R2)
  { key: 'review', tex: 'review-3345', cx: 262, cy: 300, s: 0.4, rot: -4, dx: -540, dy: -170, r: 18, beat: B(69) },
  { key: 'planning', tex: 'planning', cx: 1664, cy: 292, s: 0.4, rot: 3.5, dx: 540, dy: -190, r: 18, beat: B(70) },
  { key: 'debrief', tex: 'debrief', cx: 292, cy: 818, s: 0.34, rot: 2.5, dx: -520, dy: 280, r: 16, beat: B(70.5) },
  { key: 'ahri', tex: 'champ-3', cx: 1590, cy: 792, s: 1, rot: -4, dx: 440, dy: 320, r: 12, beat: B(71), alpha: true },
  { key: 'jinx', tex: 'champ-4', cx: 1762, cy: 762, s: 1, rot: 6, dx: 500, dy: 60, r: 12, beat: B(71.25), alpha: true },
  { key: 'row', tex: 'demo-row-3', cx: 960, cy: 948, s: 0.56, rot: -1.2, dx: 0, dy: 330, r: 14, beat: B(71.5), frame: true },
];

// 20 motes, every parameter index-derived (deterministic)
const MOTE_COLORS = [C.cyan, C.violetText, '#F0ABFC'];
const DUST = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 439 + 137) % 1920,
  y0: (i * 613 + 271) % 1080,
  rise: 0.3 + (i % 5) * 0.11,
  swayAmp: 9 + (i % 4) * 5,
  swayFreq: 0.022 + (i % 3) * 0.008,
  phase: (i * 0.83) % (Math.PI * 2),
  size: 2 + (i % 3) * 0.5,
  opacity: 0.15 + ((i * 7) % 5) * 0.05,
  color: MOTE_COLORS[i % 3],
}));

const GroupEl: React.FC<{ el: El; f: number }> = ({ el, f }) => {
  const cue = el.beat - CONTACT;
  const land = cue + FLY;
  if (f < cue) return null;
  const meta = layout[el.tex] as { w: number; h: number; file: string };
  const { w, h } = meta;
  const src = staticFile(meta.file);
  const t = interpolate(f, [cue, land], [0, 1], { ...clamp, easing: FLY_EASE });
  const linT = interpolate(f, [cue, land], [0, 1], clamp);
  const opacity = interpolate(f, [cue, cue + 3], [0, 1], clamp);
  const x = el.dx * (1 - t);
  const y = el.dy * (1 - t);
  const rot = el.rot * (2 - t);
  const scale = el.s * (1.12 - 0.12 * t);
  const air = Math.max(0, 1 - t);
  const shadow = `0 ${14 + 28 * air}px ${34 + 46 * air}px rgba(2,6,17,${0.5 + 0.15 * air})`;
  const box: React.CSSProperties = {
    position: 'absolute', left: el.cx - w / 2, top: el.cy - h / 2, width: w, height: h, transformOrigin: 'center center',
    borderRadius: el.r, overflow: 'hidden',
  };
  const img = <Img src={src} style={{ position: 'absolute', inset: 0, width: w, height: h, display: 'block' }} />;
  const showGhost = linT > 0.05 && linT < 0.95;
  return (
    <>
      {showGhost ? (
        <div
          style={{
            ...box, transform: `translate(${x + el.dx * 0.08}px, ${y + el.dy * 0.08}px) rotate(${rot}deg) scale(${scale})`,
            opacity: 0.2 * (1 - linT), filter: 'blur(8px)',
          }}
        >
          {img}
        </div>
      ) : null}
      <div
        style={{
          ...box, transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`, opacity,
          ...(el.alpha ? { overflow: 'visible', filter: `drop-shadow(${shadow})` } : { boxShadow: shadow }),
        }}
      >
        {img}
        {el.frame ? <div style={{ position: 'absolute', inset: 0, borderRadius: el.r, boxShadow: `inset 0 0 0 1.5px ${C.glassBorder}` }} /> : null}
      </div>
    </>
  );
};

type Word = { text: string; start: number; spectrum?: boolean };
/** blur-slide words (shot card typography/blur-slide, lib BlurLine maths) with one start frame per word. */
const BeatWords: React.FC<{ words: Word[]; size: number; f: number }> = ({ words, size, f }) => (
  <div
    style={{
      display: 'flex', justifyContent: 'center', gap: '0 0.28em', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: size,
      fontWeight: 700, color: C.text, lineHeight: 1.12, letterSpacing: '-0.02em',
    }}
  >
    {words.map((w) => {
      const p = interpolate(f, [w.start, w.start + 20], [0, 1], { ...clamp, easing: outCubic });
      return (
        <span
          key={w.text}
          style={{
            display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * size * 0.45}px)`,
            filter: p < 1 ? `blur(${(1 - p) * size * 0.12}px)` : undefined, ...(w.spectrum ? spectrumText : {}),
          }}
        >
          {w.text}
        </span>
      );
    })}
  </div>
);

export const Outro: React.FC = () => {
  const f = useCurrentFrame();

  // ── camera on the group layer: crane down (card), slow push, one punch on the slam ──
  const craneT = interpolate(f, [0, 55], [0, 1], { ...clamp, easing: CRANE_EASE });
  const pushT = interpolate(f, [55, IMPACT], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) });
  const driftT = interpolate(f, [IMPACT + 20, END], [0, 1], clamp);
  const punch =
    f < IMPACT ? 0 : f < IMPACT + 3 ? interpolate(f, [IMPACT, IMPACT + 3], [0, 1], { ...clamp, easing: outCubic }) : interpolate(f, [IMPACT + 3, IMPACT + 24], [1, 0], { ...clamp, easing: EASE });
  const camScale = 1.06 - 0.06 * craneT + 0.025 * pushT + 0.022 * punch + 0.012 * driftT;
  const camTilt = 4 * (1 - craneT);
  const camTransform = camTilt > 0.001 ? `perspective(1400px) rotateX(${camTilt}deg) scale(${camScale})` : `scale(${camScale})`;

  // ── depth plane: the real match list of the hook, blurred into depth (card: background page blur 0→14 in 24f) ──
  // it then dissolves completely so the stage (home atmosphere) carries the group photo
  const pageBlur = interpolate(f, [0, 24], [0, 16], { ...clamp, easing: Easing.bezier(0.4, 0, 0.4, 1) });
  const pageOpacity = interpolate(f, [4, 44], [1, 0], { ...clamp, easing: Easing.bezier(0.4, 0, 0.4, 1) });
  const PAGE = layout['demo-matches'];
  const PZ = 1.38;

  // ── stage light (charte pools, behind the group): low → swells through the anticipation → settles ──
  const stage = interpolate(f, [0, B(72), IMPACT - 2, IMPACT + 30], [0.4, 0.5, 1, 0.8], { ...clamp, easing: Easing.bezier(0.5, 0, 0.6, 1) });
  const core = interpolate(f, [B(74), IMPACT - 2, IMPACT + 30], [0, 1, 0.45], { ...clamp, easing: Easing.bezier(0.5, 0, 0.6, 1) });

  // ── group: recede when the hero emerges (card: −12 % opacity, −8 % saturation), then rack focus to the hero ──
  const recede = interpolate(f, [IMPACT - 18, IMPACT - 10], [0, 1], clamp);
  const rack = interpolate(f, [IMPACT + 2, IMPACT + 18], [0, 1], { ...clamp, easing: EASE });
  const groupOpacity = (1 - 0.12 * recede) * (1 - 0.18 * rack);
  const groupFilter = `saturate(${1 - 0.08 * recede - 0.06 * rack})${rack > 0.001 ? ` blur(${1.6 * rack}px)` : ''}`;

  // ── hero: emerges from the light, accelerates toward the lens, contact on k76 ──
  const EMERGE = B(74); // 83 — a 27f arc out of the stage light
  const wmIn = interpolate(f, [EMERGE, IMPACT], [0, 1], { ...clamp, easing: Easing.bezier(0.55, 0, 0.9, 0.45) });
  const wmSettle = interpolate(f, [IMPACT, IMPACT + 12], [0, 1], { ...clamp, easing: EASE });
  const wmHold = interpolate(f, [IMPACT + 12, END], [0, 1], clamp);
  const wmScale = f < IMPACT ? 0.12 + (1.04 - 0.12) * wmIn : 1.04 - 0.04 * wmSettle + 0.012 * wmHold;
  const wmOpacity = interpolate(f, [EMERGE, EMERGE + 10], [0, 1], clamp);
  const wmBlur = interpolate(f, [EMERGE, IMPACT - 2], [6, 0], clamp);
  const wmLift = f < IMPACT ? 40 * (1 - wmIn) : 0;
  // halation (Brand.tsx style D): impact = IMPACT; 6f out-cubic swell, 20f fall, 15f settle
  const b = f - IMPACT;
  const bloomScale = interpolate(b, [0, 6], [1, 1.12], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bloomOpacity = b < 26 ? interpolate(b, [6, 26], [0.9, 0.3], clamp) : interpolate(b, [26, 41], [0.3, 0.16], { ...clamp, easing: Easing.out(Easing.quad) });

  // rule under the wordmark + extension lines shooting out (card), drawn right after the contact
  const rule = interpolate(f, [IMPACT + 2, IMPACT + 14], [0, 1], { ...clamp, easing: CRANE_EASE });
  const ruleExt = interpolate(f, [IMPACT + 2, IMPACT + 10], [0, 1], { ...clamp, easing: CRANE_EASE });
  const ruleExtFade = interpolate(f, [IMPACT + 10, IMPACT + 16], [1, 0], clamp);

  // tagline: one word per half-beat (start 4f early so each word reads « landed » on its beat)
  const words: Word[] = [
    { text: 'Joue.', start: B(76.5) - 4 },
    { text: 'Analyse.', start: B(77) - 4 },
    { text: 'Recommence.', start: B(77.5) - 4, spectrum: true },
  ];
  const ctaStart = B(78) - 6;
  const cta = interpolate(f, [ctaStart, ctaStart + 16], [0, 1], { ...clamp, easing: EASE });

  const tagIn = interpolate(f, [ELS[0].beat - CONTACT, ELS[0].beat + 6], [0, 1], clamp);
  const fade = interpolate(f, [FADE[0], FADE[1]], [1, 0], { ...clamp, easing: Easing.bezier(0.4, 0, 0.6, 1) });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <Backdrop img="atmosphere" dim={0.5} drift={0.6} />

        {/* group-photo layer under the crane camera */}
        <AbsoluteFill style={{ transform: camTransform, transformOrigin: '50% 45%' }}>
          {/* depth plane (filtered alone: the group stays a sharp sibling, card pitfall) */}
          <div
            style={{
              position: 'absolute', left: 960 - (PAGE.w * PZ) / 2, top: 540 - (PAGE.h * PZ) / 2, width: PAGE.w * PZ, height: PAGE.h * PZ,
              borderRadius: 18 * PZ, overflow: 'hidden', opacity: pageOpacity, filter: `blur(${pageBlur}px)`,
            }}
          >
            <Img src={staticFile(PAGE.file)} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>

          {/* stage light behind the centre: violet matter, cyan guide, fuchsia counter-light */}
          <Glow x={WM_CX} y={WM_CY + 40} r={620} color={C.glowViolet} opacity={stage} />
          <Glow x={WM_CX - 380} y={WM_CY - 40} r={420} color={C.glowCyan} opacity={stage} />
          <Glow x={WM_CX + 400} y={WM_CY + 10} r={400} color={C.glowFuchsia} opacity={stage} />
          {/* the light the hero emerges from (stage light of the card), only through k74–76 */}
          {core > 0.001 ? <Glow x={WM_CX} y={WM_CY + 20} r={320} color="rgba(196,181,253,.34)" opacity={core} /> : null}

          {/* the group: render order = landing order, later arrivals on top */}
          <AbsoluteFill style={{ opacity: groupOpacity, filter: groupFilter }}>
            {ELS.map((el) => (
              <GroupEl key={el.key} el={el} f={f} />
            ))}
          </AbsoluteFill>

          {/* motes drifting up in front of the group */}
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            {DUST.map((d, i) => {
              const y = (((d.y0 - f * d.rise) % 1080) + 1080) % 1080;
              const x = d.x + Math.sin(f * d.swayFreq + d.phase) * d.swayAmp;
              return (
                <div
                  key={i}
                  style={{ position: 'absolute', left: x, top: y, width: d.size, height: d.size, borderRadius: '50%', background: d.color, opacity: d.opacity }}
                />
              );
            })}
          </AbsoluteFill>
        </AbsoluteFill>

        {/* hero: the official wordmark (+ its halation, the shot's single light effect) */}
        {f >= EMERGE ? (
          <div
            style={{
              position: 'absolute', left: WM_CX - WM_W / 2, top: WM_CY - WM_H / 2, width: WM_W, height: WM_H,
              transform: `translateY(${wmLift}px) scale(${wmScale})`, transformOrigin: 'center center',
            }}
          >
            {f >= IMPACT ? (
              <Wordmark
                width={WM_W}
                style={{
                  position: 'absolute', inset: 0, transform: `scale(${bloomScale})`, opacity: bloomOpacity,
                  filter: 'blur(28px) brightness(1.6) saturate(1.3)', mixBlendMode: 'screen',
                }}
              />
            ) : null}
            <Wordmark width={WM_W} style={{ position: 'absolute', inset: 0, opacity: wmOpacity, filter: wmBlur > 0.01 ? `blur(${wmBlur}px)` : undefined }} />
          </div>
        ) : null}

        {/* rule + extension lines */}
        {rule > 0 ? (
          <div style={{ position: 'absolute', left: WM_CX - 150, top: RULE_Y, width: 300, height: 4 }}>
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: 2, transform: `scaleX(${rule})`,
                background: `linear-gradient(90deg, ${C.cyan}, ${C.violet} 60%, ${C.fuchsia})`,
              }}
            />
            {ruleExt > 0 && ruleExtFade > 0 ? (
              <>
                <div style={{ position: 'absolute', top: 1.5, height: 1, right: '100%', width: 190 * ruleExt, background: C.cyan, opacity: ruleExtFade }} />
                <div style={{ position: 'absolute', top: 1.5, height: 1, left: '100%', width: 190 * ruleExt, background: C.fuchsia, opacity: ruleExtFade }} />
              </>
            ) : null}
          </div>
        ) : null}

        {/* tagline */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: TAG_Y }}>
          <BeatWords words={words} size={76} f={f} />
        </div>

        {/* call to action: the site's primary button (charte §3/§6) + the address */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: CTA_Y, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 44,
            opacity: cta, transform: `translateY(${(1 - cta) * 26}px)`, filter: cta < 1 ? `blur(${(1 - cta) * 6}px)` : undefined,
          }}
        >
          <div
            style={{
              background: PRIMARY_GRADIENT, color: C.onAccent, fontFamily: FONT, fontWeight: 700, fontSize: 38, lineHeight: 1,
              padding: '24px 44px', borderRadius: 2, letterSpacing: '-0.01em',
            }}
          >
            Essaie la démo
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 46, color: C.text, letterSpacing: '-0.01em' }}>nxt5.org</div>
        </div>

        <FictiveTag x={40} y={1004} opacity={tagIn * (1 - 0.4 * rack)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
