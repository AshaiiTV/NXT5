// Shot 8 — the close (k68–84, frames 942–1169). Shot card outro/outro-group-photo-launch, re-skinned to the
// NXT5 night charte. Structure first (card « known pitfalls »): one representative of every feature already
// shown flies in and settles in a group-photo slot hugging the empty centre stage. The first flyer is the
// « Défaite » row of the hook, lifted out of its real slot in the match list (the depth plane), so the shot moves
// from frame 6. Then review card, planning card, debrief, Ahri, Gnar, Jinx and the session-programme chip land
// on an accelerating grid (R2: contacts 6/20/31/41/48/55/62/65 = k68.5…k72.75, gaps 14→11→10→7→7→7→3),
// a 0.5 s rest, and the crane (perspective rotateX 4°→0 + scale 1.06→1) keeps moving through the whole build.
// Anticipation k73–76: the stage core light swells, the OFFICIAL wordmark (lib <Wordmark/>, never redrawn)
// condenses out of it (brightness 2.2→1 + blur 10→0) and accelerates toward the lens under an ease-in dolly;
// contact exactly on k76 (local 110) = slam #3, the film's third and last full-frame impact: an 8 f out-expo
// shock pushes the group ~180 px out of its tight build slots + a depth recoil of the group layer
// (scale ×0.965, no oscillation, no camera shake, Q3) + a halation on the wordmark only (Brand.tsx style D, the
// shot's single light effect, Q4). Focus then racks to the hero, the rule draws, « Joue. Analyse. Recommence. »
// lands word by word on half-beats, then the CTA « Essaie la démo » + nxt5.org; everything is settled by local
// ~148 and held (≥1.7 s) until the last 20 frames fade to #111827.
//
// Card adaptations: demo serif letterpress → the wordmark is an image (charte §4: never rebuilt from letters),
// so it lands as one piece; amber landing glow per element dropped (Q4: no batch glints) — landings read through
// the tuned overshoot alone; opening light sweep dropped (full-frame sweep, Q4); gold dust → 20 deterministic
// cyan/lavender/fuchsia motes; warm stage light → violet/cyan/fuchsia pools of the charte. CTA: charte §6 buttons
// keep a 2 px radius and no resting halo, so the « pill » is the site's primary button shape. Q9: the group
// lands in fixed stage slots (the recipe's group photo), not in a page layout — deliberate, see openIssues.
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
// and settles. `contact` below is that frame, so the visible landing sits on the beat.
const CONTACT = 5;

// ── hero layout (screen px) ──
const WM_W = 880;
const WM_H = (WM_W * 350) / 1115;
const WM_CX = 960;
const WM_CY = 360;
const RULE_Y = WM_CY + WM_H / 2 + 26;
const TAG_Y = RULE_Y + 36;
const CTA_Y = TAG_Y + 146;

// ── depth plane: the hook's match list, already a soft backdrop on frame 0 (card: zoom 0.75 under a scrim) ──
const PAGE = layout['demo-matches'];
const PZ = 1.05; // rounded panel edges visible
const PAGE_L = 960 - (PAGE.w * PZ) / 2;
const PAGE_T = 540 - (PAGE.h * PZ) / 2;
const ROW = layout['demo-row-3'];
const ROW_SLOT = { x: PAGE_L + (ROW.offset.x + ROW.w / 2) * PZ, y: PAGE_T + (ROW.offset.y + ROW.h / 2) * PZ, s: PZ, rot: 0 };

// ── group photo: one representative per feature already shown (Q8), each lands in its own slot ──
type Crop = { x: number; y: number; w: number; h: number };
type El = {
  key: string; tex: keyof typeof layout; cx: number; cy: number; s: number; rot: number;
  /** flight start, offset from the build slot (ignored when `from` is set) */
  dx: number; dy: number;
  /** blast travel: the build slot is (cx − px, cy − py); the hero's contact pushes the piece out to (cx, cy) */
  px: number; py: number;
  r: number; contact: number; alpha?: boolean; rim?: boolean; crop?: Crop;
  /** absolute start (camera-layer px) — the piece is visible from frame 0 and lifts out of that real slot */
  from?: { x: number; y: number; s: number; rot: number };
};
const ELS: El[] = [
  // the hook row lifts out of its real slot in the page (Q9 start) and drops to the foot of the stage
  { key: 'row', tex: 'demo-row-3', cx: 960, cy: 960, s: 0.6, rot: -1.2, dx: 0, dy: 0, px: 0, py: 100, r: 14, contact: B(68.5), rim: true, from: ROW_SLOT },
  { key: 'review', tex: 'review-3345', cx: 262, cy: 292, s: 0.47, rot: -4, dx: -560, dy: -160, px: -180, py: -50, r: 16, contact: B(69.5), rim: true },
  { key: 'planning', tex: 'planning', cx: 1660, cy: 288, s: 0.47, rot: 3.5, dx: 560, dy: -180, px: 180, py: -50, r: 16, contact: B(70.25), rim: true },
  // debrief cropped to its content (steps run x 33–720 of 1280): no dark empty slab
  { key: 'debrief', tex: 'debrief', cx: 232, cy: 826, s: 0.42, rot: 2.5, dx: -500, dy: 300, px: -170, py: 100, r: 13, contact: B(71), rim: true, crop: { x: 0, y: 0, w: 740, h: 720 } },
  { key: 'ahri', tex: 'champ-3', cx: 1590, cy: 800, s: 1, rot: -4, dx: 440, dy: 320, px: 150, py: 96, r: 12, contact: B(71.5), alpha: true },
  // Gnar's card has no picked-state border (Ahri/Jinx do): the glass rim gives it the same silhouette; it lands
  // above the row's left end so the hook's « Défaite » badge stays visible through the build
  { key: 'gnar', tex: 'champ-1', cx: 474, cy: 830, s: 1, rot: 5, dx: -320, dy: 420, px: -134, py: 130, r: 2, contact: B(72), alpha: true, rim: true },
  { key: 'jinx', tex: 'champ-4', cx: 1764, cy: 768, s: 1, rot: 6, dx: 520, dy: 60, px: 160, py: 72, r: 12, contact: B(72.5), alpha: true },
  // the session programme's first item (planning shot), cropped from the real card with its background
  { key: 'agenda', tex: 'planning', cx: 892, cy: 100, s: 1, rot: -1.5, dx: 0, dy: -330, px: 0, py: -100, r: 10, contact: B(72.75), rim: true, crop: { x: 16, y: 532, w: 280, h: 86 } },
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

const GroupEl: React.FC<{ el: El; f: number; blast: number }> = ({ el, f, blast }) => {
  const cue = el.contact - CONTACT;
  const land = cue + FLY;
  if (f < cue && !el.from) return null;
  const meta = layout[el.tex] as { w: number; h: number; file: string };
  const w = el.crop ? el.crop.w : meta.w;
  const h = el.crop ? el.crop.h : meta.h;
  const src = staticFile(meta.file);
  const bx = el.cx - el.px;
  const by = el.cy - el.py;
  const sx = el.from ? el.from.x : bx + el.dx;
  const sy = el.from ? el.from.y : by + el.dy;
  const sS = el.from ? el.from.s : el.s * 1.12;
  const sR = el.from ? el.from.rot : el.rot * 2;
  const t = interpolate(f, [cue, land], [0, 1], { ...clamp, easing: FLY_EASE });
  const linT = interpolate(f, [cue, land], [0, 1], clamp);
  const opacity = el.from ? 1 : interpolate(f, [cue, cue + 3], [0, 1], clamp);
  const x = sx + (bx - sx) * t + el.px * blast - el.cx;
  const y = sy + (by - sy) * t + el.py * blast - el.cy;
  const rot = sR + (el.rot - sR) * t;
  const scale = sS + (el.s - sS) * t;
  const air = Math.max(0, 1 - t);
  const shadow = `0 ${14 + 28 * air}px ${34 + 46 * air}px rgba(2,6,17,${0.5 + 0.15 * air})`;
  const box: React.CSSProperties = {
    position: 'absolute', left: el.cx - w / 2, top: el.cy - h / 2, width: w, height: h, transformOrigin: 'center center',
    borderRadius: el.r, overflow: 'hidden',
  };
  const img = (
    <Img
      src={src}
      style={{ position: 'absolute', left: el.crop ? -el.crop.x : 0, top: el.crop ? -el.crop.y : 0, width: meta.w, height: meta.h, display: 'block' }}
    />
  );
  const showGhost = linT > 0.05 && linT < 0.95;
  const lagX = (sx - bx) * 0.08;
  const lagY = (sy - by) * 0.08;
  return (
    <>
      {showGhost ? (
        <div
          style={{
            ...box, transform: `translate(${x + lagX}px, ${y + lagY}px) rotate(${rot}deg) scale(${scale})`,
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
        {/* glass rim (charte surface edge), ~1.6 screen px whatever the piece's scale */}
        {el.rim ? (
          <div style={{ position: 'absolute', inset: 0, borderRadius: el.r, boxShadow: `inset 0 0 0 ${1.6 / el.s}px ${C.glassBorder}` }} />
        ) : null}
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
  const EMERGE = B(74); // 83 — a 27f arc out of the stage light

  // ── camera on the group layer (moves, not pulses — R4 counts only the recoil on the slam) ──
  // crane down through the whole build (card), ease-in dolly toward the contact, depth recoil on the slam,
  // the dolly relaxes, then a slow push through the hold.
  const craneT = interpolate(f, [0, 80], [0, 1], { ...clamp, easing: CRANE_EASE });
  const dollyIn = interpolate(f, [EMERGE, IMPACT], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const dollyRelax = interpolate(f, [IMPACT, IMPACT + 30], [0, 1], { ...clamp, easing: EASE });
  const recoil = interpolate(f, [IMPACT, IMPACT + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const holdPush = interpolate(f, [IMPACT + 8, END], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) });
  const camScale = (1.06 - 0.06 * craneT + 0.03 * dollyIn * (1 - dollyRelax) + 0.022 * holdPush) * (1 - 0.035 * recoil);
  const camTilt = 4 * (1 - craneT);
  const camTransform = camTilt > 0.001 ? `perspective(1400px) rotateX(${camTilt}deg) scale(${camScale})` : `scale(${camScale})`;
  // ── slam #3: the hero's contact shocks the group out to its final slots (element layer, no camera shake) ──
  const blast = interpolate(f, [IMPACT, IMPACT + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });

  // ── depth plane: soft from frame 0 (blur 5→16, night scrim), then dissolves so the stage carries the group ──
  const pageBlur = interpolate(f, [0, 20], [5, 16], { ...clamp, easing: Easing.bezier(0.4, 0, 0.4, 1) });
  const pageOpacity = interpolate(f, [6, 36], [1, 0], { ...clamp, easing: Easing.bezier(0.4, 0, 0.4, 1) });

  // ── stage light (charte pools, behind the group): low → swells through the anticipation → settles ──
  const stage = interpolate(f, [0, B(72), IMPACT - 2, IMPACT + 30], [0.4, 0.5, 1, 0.8], { ...clamp, easing: Easing.bezier(0.5, 0, 0.6, 1) });
  // the light the hero is born from: visible from k73, before the hero arrives
  const core = interpolate(f, [B(73), IMPACT - 2, IMPACT + 30], [0, 1, 0.45], { ...clamp, easing: Easing.bezier(0.45, 0, 0.6, 1) });

  // ── group: recede when the hero emerges (card: −12 % opacity, −8 % saturation), then rack focus to the hero ──
  const recede = interpolate(f, [IMPACT - 18, IMPACT - 10], [0, 1], clamp);
  const rack = interpolate(f, [IMPACT + 4, IMPACT + 20], [0, 1], { ...clamp, easing: EASE });
  const groupOpacity = (1 - 0.12 * recede) * (1 - 0.18 * rack);
  const groupFilter = `saturate(${1 - 0.08 * recede - 0.06 * rack})${rack > 0.001 ? ` blur(${0.8 * rack}px)` : ''}`;

  // ── hero: condenses out of the light, accelerates toward the lens, contact on k76 ──
  const wmIn = interpolate(f, [EMERGE, IMPACT], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.85, 0.4) });
  const wmSettle = interpolate(f, [IMPACT, IMPACT + 12], [0, 1], { ...clamp, easing: EASE });
  const wmHold = interpolate(f, [IMPACT + 12, END], [0, 1], clamp);
  const wmScale = f < IMPACT ? 0.3 + (1.04 - 0.3) * wmIn : 1.04 - 0.04 * wmSettle + 0.012 * wmHold;
  const wmOpacity = interpolate(f, [EMERGE, EMERGE + 8], [0, 1], clamp);
  const condense = interpolate(f, [EMERGE, IMPACT - 2], [0, 1], { ...clamp, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  const wmBlur = 10 * (1 - condense);
  const wmBright = 1 + 1.2 * (1 - condense);
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

  const fade = interpolate(f, [FADE[0], FADE[1]], [1, 0], { ...clamp, easing: Easing.bezier(0.4, 0, 0.6, 1) });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <Backdrop img="atmosphere" dim={0.5} drift={0.6} />

        {/* group-photo layer under the crane camera */}
        <AbsoluteFill style={{ transform: camTransform, transformOrigin: '50% 45%' }}>
          {/* depth plane (filtered alone: the group stays a sharp sibling, card pitfall) */}
          {pageOpacity > 0.001 ? (
            <div
              style={{
                position: 'absolute', left: PAGE_L, top: PAGE_T, width: PAGE.w * PZ, height: PAGE.h * PZ,
                borderRadius: 18 * PZ, overflow: 'hidden', opacity: pageOpacity, filter: `blur(${pageBlur}px)`,
                boxShadow: '0 24px 70px rgba(2,6,17,.55)',
              }}
            >
              <Img src={staticFile(PAGE.file)} style={{ width: '100%', height: '100%', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17,24,39,.45)' }} />
            </div>
          ) : null}

          {/* stage light behind the centre: violet matter, cyan guide, fuchsia counter-light */}
          <Glow x={WM_CX} y={WM_CY + 40} r={620} color={C.glowViolet} opacity={stage} />
          <Glow x={WM_CX - 380} y={WM_CY - 40} r={420} color={C.glowCyan} opacity={stage} />
          <Glow x={WM_CX + 400} y={WM_CY + 10} r={400} color={C.glowFuchsia} opacity={stage} />
          {/* the light the hero emerges from (stage light of the card): builds k73–76, then settles */}
          {core > 0.001 ? <Glow x={WM_CX} y={WM_CY + 10} r={360} color="rgba(196,181,253,.55)" opacity={core} /> : null}

          {/* the group: render order = landing order, later arrivals on top */}
          <AbsoluteFill style={{ opacity: groupOpacity, filter: groupFilter }}>
            {ELS.map((el) => (
              <GroupEl key={el.key} el={el} f={f} blast={blast} />
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
            <Wordmark
              width={WM_W}
              style={{
                position: 'absolute', inset: 0, opacity: wmOpacity,
                filter: condense < 1 ? `brightness(${wmBright}) blur(${wmBlur}px)` : undefined,
              }}
            />
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
                <div style={{ position: 'absolute', top: 1, height: 2, right: 150 + 150 * rule, width: 190 * ruleExt, background: C.cyan, opacity: ruleExtFade }} />
                <div style={{ position: 'absolute', top: 1, height: 2, left: 150 + 150 * rule, width: 190 * ruleExt, background: C.fuchsia, opacity: ruleExtFade }} />
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

        <FictiveTag x={40} y={1004} opacity={1 - 0.4 * rack} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
