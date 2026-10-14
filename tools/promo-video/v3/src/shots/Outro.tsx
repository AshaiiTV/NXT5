// Shot 8 — the close (k68–92, local 0–332). Shot card outro/outro-group-photo-launch, re-skinned to the NXT5
// night charte. Structure first (card « known pitfalls »): one representative of every feature already shown flies
// in and settles in a group-photo slot around the empty centre stage.
// Opening (k68 is a hit, review finding 12): frame 0 is crisp and already moving — the hook's match list, sharp,
// with the hook's « Victoire » row already lifting out of its real slot (the depth plane); the page recedes and
// dissolves within ~16 f under a crane that starts with velocity, while the row drops to the foot of the stage.
// Then review card, planning card, debrief, Ahri, Gnar, Jinx and the session-programme chip land on an
// accelerating grid (R2: contacts 7/21/31/41/48/55/62/66 = k68.5…k72.75, gaps 14→10→10→7→7→7→4), a 0.5 s rest.
// Anticipation k73–76 (the spliced build): the stage core light swells, the OFFICIAL wordmark (lib <Wordmark/>,
// never redrawn) condenses out of it (brightness 2.2→1 + blur 10→0) and accelerates toward the lens under an
// ease-in dolly; contact exactly on k76 (local 111) = the song's second drop = slam #3, the film's third and last
// full-frame impact: an 8 f out-expo shock pushes the group out of its build slots + a depth recoil of the group
// layer (scale ×0.965, no oscillation, no camera shake, Q3) + a halation on the wordmark only (Brand.tsx style D, the
// shot's single light effect, Q4). Focus racks to the hero, the rule draws, « Joue. Analyse. Recommence. » lands
// word by word on half-beats, then the CTA « Essaie la démo » + nxt5.org. Full-energy music runs to the end, so
// the end card never freezes: the group keeps a slow push (parallax against the hero's slower one) and the stage
// pools drift, until the last 20 frames fade to #111827.
//
// Charte §4 protection space (≥ ¼ of the sign's visible height ≈ 66 px; target 72 px): the group's REST slots keep
// every card ≥ 72 px from the wordmark's visible box, and the BUILD slots (before the blast) clear the wordmark at
// its contact scale, so nothing overlaps it during the launch either. OUTRO_GEOM below exports the exact geometry the
// shot renders, for the spacing check (QA script bundles this file).
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
const END = dur(SHOTS.outro); // 332
const IMPACT = B(76); // 111 — slam #3, the song's second drop
const EMERGE = B(74); // 83 — the hero's 28 f arc out of the stage light
const FADE = [END - 20, END] as const; // gentle fade to #111827 (audio fade handled in Main)

// card-tuned easings
const FLY_EASE = Easing.bezier(0.34, 1.4, 0.44, 1); // y1 > 1: a real overshoot on landing (card lesson)
const CRANE_EASE = Easing.bezier(0.2, 0.35, 0.25, 1); // starts with velocity: the crane already moves on frame 0
const DRAW_EASE = Easing.bezier(0.3, 0, 0.2, 1);
const FLY = 12; // frames of flight per element (card value)
// FLY_EASE crosses 1 at ~38 % of the flight: the element first touches its slot ~5f after its cue, then overshoots
// and settles. `contact` below is that frame, so the visible landing sits on the beat.
const CONTACT = 5;

// ── hero layout (screen px) ──
const WM_W = 880;
const WM_H = (WM_W * 350) / 1115;
const WM_CX = 960;
const WM_CY = 360;
/** Visible (alpha) box of the official wordmark file, as half-extents at scale 1: x 8–1105 / y 8–341 of 1115×350. */
const WM_HALF = { x: ((1105 - 8) / 1115) * (WM_W / 2), y: ((341 - 8) / 350) * (WM_H / 2) }; // 432.9 × 131.4
const RULE_Y = WM_CY + WM_H / 2 + 26;
const TAG_Y = RULE_Y + 36;
const CTA_Y = TAG_Y + 146;

// ── camera on the group layer ──
const GROUP_ORIGIN = { x: 960, y: 486 }; // transformOrigin '50% 45%'
const HOLD_PUSH = 0.03; // slow push through the end card (group), against the hero's 1.5 %: parallax, never a freeze

// ── depth plane: the hook's match list, crisp on frame 0, receding and dissolving fast ──
const PAGE = layout['demo-matches'];
const PZ = 1; // page scale (layer px)
const PAGE_CY = 510; // a little above centre: the page corner stays clear of the « Données fictives » slot
const PAGE_L = 960 - (PAGE.w * PZ) / 2;
const PAGE_T = PAGE_CY - (PAGE.h * PZ) / 2;
const ROW = layout['demo-row-1']; // « Victoire · Scrim 3 · Aurore » — the hook's hero row
const ROW_SLOT = { x: PAGE_L + (ROW.offset.x + ROW.w / 2) * PZ, y: PAGE_T + (ROW.offset.y + ROW.h / 2) * PZ, s: PZ, rot: 0 };
/** The row is already lifting out of its slot on frame 0 (lift window −4 → 6, i.e. 40 % done at the cut). */
const LIFT = { from: -4, to: 6, scale: 1.08, y: -22, rot: -1 };

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
// Rest slots: the corner cards sit ≥ 72 px from the sign (charte §4) at 0.42 (was 0.47: too close, too busy);
// the right-hand champions sit high enough to clear the shared « Données fictives » slot (bottom-right).
const ELS: El[] = [
  // the hook row lifts out of its real slot in the page (Q9 start) and drops to the foot of the stage
  { key: 'row', tex: 'demo-row-1', cx: 960, cy: 960, s: 0.6, rot: -1.2, dx: 0, dy: 0, px: 0, py: 90, r: 14, contact: B(68.5), rim: true, from: ROW_SLOT },
  { key: 'review', tex: 'review-3345', cx: 230, cy: 300, s: 0.42, rot: -4, dx: -560, dy: -160, px: -75, py: -20, r: 16, contact: B(69.5), rim: true },
  { key: 'planning', tex: 'planning', cx: 1690, cy: 292, s: 0.42, rot: 3.5, dx: 560, dy: -180, px: 78, py: -20, r: 16, contact: B(70.25), rim: true },
  // debrief cropped to its content (steps run x 33–720 of 1280): no dark empty slab
  { key: 'debrief', tex: 'debrief', cx: 226, cy: 820, s: 0.42, rot: 2.5, dx: -500, dy: 300, px: -110, py: 60, r: 13, contact: B(71), rim: true, crop: { x: 0, y: 0, w: 740, h: 720 } },
  { key: 'ahri', tex: 'champ-3', cx: 1618, cy: 784, s: 1, rot: -4, dx: 540, dy: 120, px: 110, py: 80, r: 12, contact: B(71.5), alpha: true },
  // Gnar's card has no picked-state border (Ahri/Jinx do): the glass rim gives it the same silhouette
  { key: 'gnar', tex: 'champ-1', cx: 474, cy: 830, s: 1, rot: 5, dx: -320, dy: 420, px: -80, py: 90, r: 2, contact: B(72), alpha: true, rim: true },
  { key: 'jinx', tex: 'champ-4', cx: 1772, cy: 752, s: 1, rot: 6, dx: 520, dy: 60, px: 120, py: 60, r: 12, contact: B(72.5), alpha: true },
  // the session programme's first item (planning shot), cropped from the real card with its background
  { key: 'agenda', tex: 'planning', cx: 900, cy: 92, s: 1, rot: -1.5, dx: 0, dy: -330, px: 0, py: -70, r: 10, contact: B(72.75), rim: true, crop: { x: 16, y: 532, w: 280, h: 86 } },
];

// ── pure motion (shared by the render and by the QA spacing check) ──
/** Group-layer camera: crane (tilt + scale, moving from frame 0) → ease-in dolly to the contact → recoil → hold push. */
const camAt = (f: number) => {
  const craneT = interpolate(f, [0, 80], [0, 1], { ...clamp, easing: CRANE_EASE });
  const dollyIn = interpolate(f, [EMERGE, IMPACT], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const dollyRelax = interpolate(f, [IMPACT, IMPACT + 30], [0, 1], { ...clamp, easing: EASE });
  const recoil = interpolate(f, [IMPACT, IMPACT + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  // slow push through the end card: eased in, still moving when the fade starts (no dead freeze under the drop)
  const holdPush = interpolate(f, [IMPACT + 8, END], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.75, 0.9) });
  const scale = (1.06 - 0.06 * craneT + 0.03 * dollyIn * (1 - dollyRelax) + HOLD_PUSH * holdPush) * (1 - 0.035 * recoil);
  return { scale, tilt: 4 * (1 - craneT) };
};
/** slam #3: the hero's contact shocks the group out to its rest slots (element layer, no camera shake) */
const blastAt = (f: number) => interpolate(f, [IMPACT, IMPACT + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });

/** Pose of a group piece in group-layer px (centre, rotation, scale) + flight progress. */
const elPose = (el: El, f: number) => {
  const cue = el.contact - CONTACT;
  const land = cue + FLY;
  const blast = blastAt(f);
  const bx = el.cx - el.px;
  const by = el.cy - el.py;
  let sx: number, sy: number, sS: number, sR: number;
  if (el.from) {
    // already lifting out of the page on frame 0, then flies from wherever the lift has taken it
    const lift = interpolate(f, [LIFT.from, LIFT.to], [0, 1], { ...clamp, easing: outCubic });
    sx = el.from.x;
    sy = el.from.y + LIFT.y * lift;
    sS = el.from.s * (1 + (LIFT.scale - 1) * lift);
    sR = el.from.rot + LIFT.rot * lift;
  } else {
    sx = bx + el.dx;
    sy = by + el.dy;
    sS = el.s * 1.12;
    sR = el.rot * 2;
  }
  const t = interpolate(f, [cue, land], [0, 1], { ...clamp, easing: FLY_EASE });
  const linT = interpolate(f, [cue, land], [0, 1], clamp);
  return {
    visible: f >= cue || !!el.from,
    x: sx + (bx - sx) * t + el.px * blast,
    y: sy + (by - sy) * t + el.py * blast,
    rot: sR + (el.rot - sR) * t,
    scale: sS + (el.s - sS) * t,
    opacity: el.from ? 1 : interpolate(f, [cue, cue + 3], [0, 1], clamp),
    t, linT, sx, sy, bx, by,
    lift: el.from ? interpolate(f, [LIFT.from, LIFT.to], [0, 1], { ...clamp, easing: outCubic }) : 0,
  };
};
const elSize = (el: El) => {
  const meta = layout[el.tex] as { w: number; h: number; file: string };
  return { w: el.crop ? el.crop.w : meta.w, h: el.crop ? el.crop.h : meta.h, meta };
};

/** Hero: condenses out of the light, accelerates toward the lens, contact on k76, then a slow living push. */
const heroAt = (f: number) => {
  const wmIn = interpolate(f, [EMERGE, IMPACT], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.85, 0.4) });
  const wmSettle = interpolate(f, [IMPACT, IMPACT + 12], [0, 1], { ...clamp, easing: EASE });
  const wmHold = interpolate(f, [IMPACT + 12, END], [0, 1], clamp);
  const condense = interpolate(f, [EMERGE, IMPACT - 2], [0, 1], { ...clamp, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  return {
    visible: f >= EMERGE,
    scale: f < IMPACT ? 0.3 + (1.04 - 0.3) * wmIn : 1.04 - 0.04 * wmSettle + 0.015 * wmHold,
    lift: f < IMPACT ? 40 * (1 - wmIn) : 0,
    opacity: interpolate(f, [EMERGE, EMERGE + 8], [0, 1], clamp),
    condense,
  };
};

/** Exact geometry for the QA spacing check (no React). */
export const OUTRO_GEOM = {
  END, IMPACT, EMERGE, ELS, GROUP_ORIGIN, WM: { cx: WM_CX, cy: WM_CY, half: WM_HALF }, RULE_Y, TAG_Y, CTA_Y,
  PAGE: { l: PAGE_L, t: PAGE_T, w: PAGE.w * PZ, h: PAGE.h * PZ },
  camAt, elPose, elSize, heroAt,
};

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
  const p = elPose(el, f);
  if (!p.visible) return null;
  const { w, h, meta } = elSize(el);
  const src = staticFile(meta.file);
  const x = p.x - el.cx;
  const y = p.y - el.cy;
  // in the air = the flight, or the lift out of the page before it
  const air = Math.max(Math.max(0, 1 - p.t), el.from ? p.lift * (1 - p.t) : 0);
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
  const showGhost = p.linT > 0.05 && p.linT < 0.95;
  const lagX = (p.sx - p.bx) * 0.08;
  const lagY = (p.sy - p.by) * 0.08;
  return (
    <>
      {showGhost ? (
        <div
          style={{
            ...box, transform: `translate(${x + lagX}px, ${y + lagY}px) rotate(${p.rot}deg) scale(${p.scale})`,
            opacity: 0.2 * (1 - p.linT), filter: 'blur(8px)',
          }}
        >
          {img}
        </div>
      ) : null}
      <div
        style={{
          ...box, transform: `translate(${x}px, ${y}px) rotate(${p.rot}deg) scale(${p.scale})`, opacity: p.opacity,
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

  // ── camera on the group layer (moves, not pulses — R4 counts only the recoil on the slam) ──
  const cam = camAt(f);
  const camTransform = cam.tilt > 0.001 ? `perspective(1400px) rotateX(${cam.tilt}deg) scale(${cam.scale})` : `scale(${cam.scale})`;

  // ── depth plane: crisp on frame 0 (blur < 0.5 px until L4), recedes fast (own scale, fastest at the cut), then
  // blurs and dissolves, handing over to the first card (review in flight L16–28): gone by L22 ──
  const pageRecede = interpolate(f, [0, 20], [0, 1], { ...clamp, easing: outCubic });
  const pageScale = 1 - 0.08 * pageRecede;
  const pageBlur = interpolate(f, [0, 4, 18], [0, 0.5, 12], { ...clamp, easing: Easing.in(Easing.quad) });
  const pageOpacity = interpolate(f, [3, 22], [1, 0], { ...clamp, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  const pageScrim = interpolate(f, [0, 12], [0.28, 0.6], clamp);

  // ── stage light (charte pools, behind the group): low → swells through the anticipation → settles, then drifts ──
  const stage = interpolate(f, [0, B(72), IMPACT - 2, IMPACT + 30], [0.4, 0.5, 1, 0.8], { ...clamp, easing: Easing.bezier(0.5, 0, 0.6, 1) });
  // the light the hero is born from: visible from k73, before the hero arrives
  const core = interpolate(f, [B(73), IMPACT - 2, IMPACT + 30], [0, 1, 0.45], { ...clamp, easing: Easing.bezier(0.45, 0, 0.6, 1) });
  // end card: the cyan guide and the fuchsia counter-light slowly trade places (~0.35 px/f), the violet core breathes
  const sway = Math.max(0, f - IMPACT) * 0.35;
  const breathe = 1 + 0.06 * Math.sin(Math.max(0, f - IMPACT) / 16);

  // ── group: recede when the hero emerges (card: −12 % opacity, −8 % saturation), then rack focus to the hero ──
  const recede = interpolate(f, [IMPACT - 18, IMPACT - 10], [0, 1], clamp);
  const rack = interpolate(f, [IMPACT + 4, IMPACT + 20], [0, 1], { ...clamp, easing: EASE });
  const groupOpacity = (1 - 0.12 * recede) * (1 - 0.18 * rack);
  const groupFilter = `saturate(${1 - 0.08 * recede - 0.06 * rack})${rack > 0.001 ? ` blur(${0.8 * rack}px)` : ''}`;

  // ── hero ──
  const hero = heroAt(f);
  const wmBlur = 10 * (1 - hero.condense);
  const wmBright = 1 + 1.2 * (1 - hero.condense);
  // halation (Brand.tsx style D): impact = IMPACT; 6f out-cubic swell, 20f fall, 15f settle
  const b = f - IMPACT;
  const bloomScale = interpolate(b, [0, 6], [1, 1.12], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bloomOpacity = b < 26 ? interpolate(b, [6, 26], [0.9, 0.3], clamp) : interpolate(b, [26, 41], [0.3, 0.16], { ...clamp, easing: Easing.out(Easing.quad) });

  // rule under the wordmark + extension lines shooting out (card), drawn right after the contact
  const rule = interpolate(f, [IMPACT + 2, IMPACT + 14], [0, 1], { ...clamp, easing: DRAW_EASE });
  const ruleExt = interpolate(f, [IMPACT + 2, IMPACT + 10], [0, 1], { ...clamp, easing: DRAW_EASE });
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
        <AbsoluteFill style={{ transform: camTransform, transformOrigin: `${GROUP_ORIGIN.x}px ${GROUP_ORIGIN.y}px` }}>
          {/* depth plane (filtered alone: the group stays a sharp sibling, card pitfall) */}
          {pageOpacity > 0.001 ? (
            <div
              style={{
                position: 'absolute', left: PAGE_L, top: PAGE_T, width: PAGE.w * PZ, height: PAGE.h * PZ,
                borderRadius: 18 * PZ, overflow: 'hidden', opacity: pageOpacity,
                filter: pageBlur > 0.05 ? `blur(${pageBlur.toFixed(2)}px)` : undefined,
                transform: `scale(${pageScale})`, transformOrigin: `${ROW_SLOT.x - PAGE_L}px ${ROW_SLOT.y - PAGE_T}px`,
                boxShadow: '0 24px 70px rgba(2,6,17,.55)',
              }}
            >
              <Img src={staticFile(PAGE.file)} style={{ width: '100%', height: '100%', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(17,24,39,${pageScrim})` }} />
            </div>
          ) : null}

          {/* stage light behind the centre: violet matter, cyan guide, fuchsia counter-light */}
          <Glow x={WM_CX} y={WM_CY + 40} r={620 * breathe} color={C.glowViolet} opacity={stage} />
          <Glow x={WM_CX - 380 + sway} y={WM_CY - 40} r={420} color={C.glowCyan} opacity={stage} />
          <Glow x={WM_CX + 400 - sway} y={WM_CY + 10} r={400} color={C.glowFuchsia} opacity={stage} />
          {/* the light the hero emerges from (stage light of the card): builds k73–76, then settles */}
          {core > 0.001 ? <Glow x={WM_CX} y={WM_CY + 10} r={360} color="rgba(196,181,253,.55)" opacity={core} /> : null}

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
        {hero.visible ? (
          <div
            style={{
              position: 'absolute', left: WM_CX - WM_W / 2, top: WM_CY - WM_H / 2, width: WM_W, height: WM_H,
              transform: `translateY(${hero.lift}px) scale(${hero.scale})`, transformOrigin: 'center center',
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
                position: 'absolute', inset: 0, opacity: hero.opacity,
                filter: hero.condense < 1 ? `brightness(${wmBright}) blur(${wmBlur}px)` : undefined,
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

        {/* Données fictives: the film's shared slot (bottom-right), clear of the champions and the CTA */}
        <FictiveTag />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
