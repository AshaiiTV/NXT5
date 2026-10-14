// The film's five seams (video-shotcraft transition cards: shot-transitions, transition-travel). Main renders every
// shot through <ShotAt> — a Freeze at the shot's LOCAL frame — so that around a seam both neighbours can be composed
// at their true local time: the incoming shot at negative frames before its start, the outgoing one past its end.
// Shot timing is untouched (each shot's frame 0 is still its SHOTS.x.from); every seam's key frame sits ON its beat.
//
//  C1 @111 k16 (drop, slam #1) — shot-transitions F, mask-wipe through a window: the hook's « Victoire » row opens as a
//     window onto the review of that same match while the camera dives into it; the window fills the frame on 111.
//     (Implemented inside Hook's last 14 frames, which receives the analyse shot as `portal`.)
//  C2 @249 k26 — shot-transitions E, whip-pan (basic): 8 f, 1.5 screens to the right, mid-point on 249, directional
//     motion blur on the whip frames only.
//  C3 @388 k36 (into the hollow bar) — shot-transitions C, focus hand-off: the draft slides out of the focal plane, the
//     breath card resolves into it 2 f later; the card becomes the dominant plane on 388.
//  C4 @443 k40 (music returns, slam #2) — transition-travel A, shared container: the breath card's glass plate grows
//     into the debrief card (its outline morphs into the card's, the page shows inside it, only card pixels), the question
//     lets go with a zoom blur over 439–441, the container arrives at full speed on 443; the debrief's own landing
//     settle (×1.16 → 1) is the morph's overshoot.
//  C5 @609 k52 — transition-travel A, the return (paired with C1, card: « 进窗/回位 »): the debrief folds back into the
//     match list — after its caption has left, the page shrinks (600 → 609, fastest 605–607) into the « Victoire » row it
//     came from, seats in its slot on 609 while the list comes up from 0.9 to 1, and the row then lifts away.
import React from 'react';
import { AbsoluteFill, Easing, Freeze, Img, interpolate, staticFile } from 'remotion';
import { C } from './theme';
import { FictiveTag } from './lib/ui';
import { clamp, lerp } from './lib/motion';
import { Shot, SHOTS } from './timeline';
import layout from './layout.json';
import { Hook, hookDiveAt } from './shots/Hook';
import { Analyse } from './shots/Analyse';
import { Draft } from './shots/Draft';
import { BreathCard, BREATH_PLATE, BreathMorph, breathPushAt } from './shots/BreathCard';
import { Debrief, DEBRIEF_CARD, debriefToScreen } from './shots/Debrief';
import { Outro, OUTRO_GEOM } from './shots/Outro';

/**
 * A shot at its local frame L = f − shot.from, held on its edge frame outside [0, dur): a shot cannot run at negative
 * local time (Remotion's <Img> wraps itself in a <Sequence from={0}>, so no image paints before a shot's frame 0), so
 * an incoming shot waits on its own frame 0 during a seam's pre-roll — its camera keys, cursor and pools are clamped
 * there anyway — and an outgoing shot past its end runs on (its clamps hold the last state).
 */
export const ShotAt: React.FC<{ shot: Shot; f: number; children: React.ReactNode }> = ({ shot, f, children }) => (
  <Freeze frame={Math.max(0, f - shot.from)}>{children}</Freeze>
);

const H = SHOTS.hook, A = SHOTS.analyse, D = SHOTS.draft, K = SHOTS.card, DB = SHOTS.debrief, O = SHOTS.outro;

// ───────────────────────── C1 · window (Hook renders the window; Main hands it the analyse shot) ─────────────────────────
const C1 = { at: A.from, from: A.from - 12 }; // 99 → 111 (k16): the dive starts from rest on f99
/** Zoom-blur shutter of the diving card: six earlier poses over half a frame (180°), averaged over the current one. */
const C1_TRAIL = [1, 2, 3, 4, 5, 6].map((j) => j / 12);

// ───────────────────────── C2 · whip-pan ─────────────────────────
// Card E basic: 8 f, bezier(0.6,0,0.4,1) (symmetric: the mid-point of the travel is the mid-point in time = the beat),
// both scenes on one horizontal line, blur only while it whips. Span: the card's 1.5 screens leave a 960-px empty gap
// between the scenes, which on the night palette reads as two black frames at the cut (measured); the scenes are
// butted instead (span 1 screen): peak ≈ 450 px/f still clears the card's ≥ 300 px/f, and the cut frame is half A,
// half B, both smeared.
const WHIP_HALF = 4;
const WHIP_SWING = 1920;
const WHIP_SHUTTER = 200 / 360; // CameraMotionBlur shutterAngle 200 (card value)
const WHIP_EASE = Easing.bezier(0.6, 0, 0.4, 1);
const C2 = { at: D.from, from: D.from - WHIP_HALF, to: D.from + WHIP_HALF }; // 245 → 253, mid-point 249
const whipX = (f: number) => interpolate(f, [C2.from, C2.to], [0, WHIP_SWING], { ...clamp, easing: WHIP_EASE });

/** Directional (horizontal) motion blur: a box of the shutter's travel, approximated by a Gaussian (σ ≈ L/√12). */
const WhipBlurDefs: React.FC<{ id: string; sigma: number }> = ({ id, sigma }) => (
  <svg width={0} height={0} style={{ position: 'absolute' }}>
    <defs>
      <filter id={id} x="-60%" y="0%" width="220%" height="100%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={`${sigma.toFixed(2)} 0`} />
      </filter>
    </defs>
  </svg>
);

const Whip: React.FC<{ f: number; a: React.ReactNode; b: React.ReactNode }> = ({ f, a, b }) => {
  const dx = whipX(f);
  const v = Math.abs(whipX(f + 0.5) - whipX(f - 0.5));
  const sigma = (v * WHIP_SHUTTER) / Math.sqrt(12);
  const blur = sigma > 0.4;
  const plate = (x: number, node: React.ReactNode, key: string) =>
    x + 1920 + 3 * sigma < 0 || x - 3 * sigma > 1920 ? null : (
      <div
        key={key}
        style={{
          position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'hidden',
          transform: `translateX(${x.toFixed(2)}px)`, filter: blur ? 'url(#seam-whip)' : undefined,
        }}
      >
        {node}
      </div>
    );
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      {blur ? <WhipBlurDefs id="seam-whip" sigma={sigma} /> : null}
      {plate(-dx, a, 'a')}
      {plate(WHIP_SWING - dx, b, 'b')}
      {/* both shots carry the tag in the same slot; their plates carry none (hideTag), one fixed copy stays readable */}
      <FictiveTag />
    </AbsoluteFill>
  );
};

// ───────────────────────── C3 · focus hand-off ─────────────────────────
// Card C (demo FocusHandoffTransition): A out over 16 f (bezier(0.45,0,0.3,1), drift 60 px), B in over 16 f starting 2 f
// later (bezier(0.3,0,0.2,1), blur 8→0, reverse drift −50 → 0). A's defocus (blur 0→8 px, −35 % light) leads its fade
// by 2 f and completes in 6 (planes separated: the question always sits on a soft, dim draft). B's curve passes 0.5 at 5/16 of its window,
// so B starts 5 f before the beat and passes half-presence ON 388 (A is at 0.43 then). The draft's caption has already
// left on its own blur-slide exit (Draft, `out` local 125), so no two titles are ever legible together.
const C3 = { at: K.from, from: K.from - 9, to: K.from + 11 }; // 379 → 399
const A_OUT = [K.from - 7, K.from + 9] as const; // 381 → 397
const B_IN = [K.from - 5, K.from + 11] as const; // 383 → 399
/** The draft leaves the focal plane first (right after its caption's exit): 8 px and half a stop down over 379 → 385, so
 * it is ≥ 4 px soft and dim before any letter of the question shows (from 384) and no champion art reads through them. */
const A_DEFOCUS = [K.from - 9, K.from - 3] as const;
const OUT_EASE = Easing.bezier(0.45, 0, 0.3, 1);
const IN_EASE = Easing.bezier(0.3, 0, 0.2, 1);

const Focus: React.FC<{ f: number; a: React.ReactNode; b: React.ReactNode }> = ({ f, a, b }) => {
  const out = interpolate(f, [...A_OUT], [0, 1], { ...clamp, easing: OUT_EASE });
  const df = interpolate(f, [...A_DEFOCUS], [0, 1], { ...clamp, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  const inn = interpolate(f, [...B_IN], [0, 1], { ...clamp, easing: IN_EASE });
  const tag = interpolate(1 - out, [0.04, 0.15], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      {out < 1 ? (
        // the drift is covered by a matching scale from the left edge (+3.5 % ≥ 60 px), so no edge of the frame shows and
        // the first seam frame is the shot's own frame exactly
        <AbsoluteFill style={{ opacity: 1 - out, filter: df > 0.001 ? `blur(${(8 * df).toFixed(2)}px) brightness(${(1 - 0.35 * df).toFixed(3)})` : undefined, transform: out > 0 ? `translateX(${(-60 * out).toFixed(2)}px) scale(${(1 + 0.035 * out).toFixed(4)})` : undefined, transformOrigin: '0% 50%' }}>
          {a}
        </AbsoluteFill>
      ) : null}
      {inn > 0 ? (
        <AbsoluteFill style={{ opacity: inn, filter: inn < 0.99 ? `blur(${(8 * (1 - inn)).toFixed(2)}px)` : undefined, transform: inn < 1 ? `translateX(${(-50 * (1 - inn)).toFixed(2)}px) scale(${(1 + 0.03 * (1 - inn)).toFixed(4)})` : undefined, transformOrigin: '0% 50%' }}>
          {b}
        </AbsoluteFill>
      ) : null}
      {/* the draft's tag stays sharp and whole in its slot while any of its real UI is visible (draft opacity ≥ 0.15),
          then leaves with the last of it — the breath card itself is not UI and has none */}
      {tag > 0.001 ? <FictiveTag opacity={tag} /> : null}
    </AbsoluteFill>
  );
};

// ───────────────────────── C4 · shared container: plate → debrief card ─────────────────────────
// The container is a rounded quad whose corners travel (one progress, accelerating into the hit) from the plate's
// corners to the debrief card as it stands on its own frame 0 — the part of the card inside the frame (left edge
// x ≈ 88, slanted top edge). Inside it the debrief page (frame 0) grows with it (×0.85 → 1 about the frame centre),
// so the container only ever shows card pixels: at every frame it lies inside the scaled card (convex hull of two
// quads inside it). The question holds to f439 (≥ 1.5 s), then the glass face lets go over 439–441 with a zoom blur;
// from 442 the container is the card alone, and 443 is the debrief itself, landing (slam #2).
const C4 = { at: DB.from, from: DB.from - 11 }; // 432 (k39.25) → 443 (k40)
const C4_EASE = (t: number) => t * t * t; // accelerates into the hit: arrives at full speed on 443
const C4_FACE = [DB.from - 4, DB.from - 1.5] as const; // 439 → 441.5: the face lets go (gone on 442)
/** The glass clears between f441 and f442 (after the words, before the hit). */
const C4_GLASS = DB.from - 2;
const C4_S0 = 0.85; // page scale inside the plate at t = 0 (the plate then lies inside the scaled card, ≥ 20 px margin)
const C4_ANCHOR = { x: 960, y: 540 };
const CARD_R = DEBRIEF_CARD.r * 2.34; // the card's corner on screen at the landing (camera ×2.34)
/** The debrief card on screen at its local frame 0 (camera ×2.34, rotY 13.5°): its left edge, its slanted top edge. */
const CARD_TL = debriefToScreen(0, 0, 0);
const CARD_TR = debriefToScreen(0, DEBRIEF_CARD.w, 0);
const cardTopAt = (x: number) => CARD_TL.y + ((x - CARD_TL.x) * (CARD_TR.y - CARD_TL.y)) / (CARD_TR.x - CARD_TL.x);
/** Card ∩ frame at debrief frame 0, inset 1 px (clockwise from top-left): pixels of the page that are card. */
const C4_CARD = [
  { x: CARD_TL.x + 1, y: Math.max(0, cardTopAt(CARD_TL.x)) + 1 },
  { x: 1920, y: Math.max(0, cardTopAt(1920)) + 1 },
  { x: 1920, y: 1080 },
  { x: CARD_TL.x + 1, y: 1080 },
];

const plateMorph = (f: number, content: React.ReactNode): BreathMorph => {
  const push = breathPushAt(f - K.from);
  const w0 = BREATH_PLATE.w * push;
  const h0 = BREATH_PLATE.h * push;
  const t = C4_EASE(interpolate(f, [C4.from, C4.at], [0, 1], clamp));
  const s = lerp(C4_S0, 1, t);
  const plate = [
    { x: 960 - w0 / 2, y: 540 - h0 / 2 }, { x: 960 + w0 / 2, y: 540 - h0 / 2 },
    { x: 960 + w0 / 2, y: 540 + h0 / 2 }, { x: 960 - w0 / 2, y: 540 + h0 / 2 },
  ];
  // the top edge travels ahead of the others (t^0.55), so when the page shows (f442) the card's whole header and the
  // line above it are already inside the container — its edge never slices text
  const tTop = Math.pow(t, 0.55);
  const quad = plate.map((p, i) => {
    const c = C4_CARD[i];
    const ty = i < 2 ? tTop : t;
    return { x: lerp(p.x, C4_ANCHOR.x + s * (c.x - C4_ANCHOR.x), t), y: lerp(p.y, C4_ANCHOR.y + s * (c.y - C4_ANCHOR.y), ty) };
  });
  // ease-in: the page is barely seen through the glass on 440 (face 0.84), the words rush away on 441 (0.36)
  const face = interpolate(f, [...C4_FACE], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const zoom = 1 - face;
  return {
    quad,
    r: lerp(BREATH_PLATE.r * push, CARD_R, t),
    face,
    zoom,
    // the glass holds whole until the last word has gone (f441), clears on f442 onto the page, which snaps into focus on
    // the hit (3 px on 442, sharp on 443): the page's header never shows through the words
    glass: interpolate(f, [C4_GLASS, C4_GLASS + 1], [1, 0], clamp),
    veil: 6 * interpolate(f, [C4_GLASS, C4.at], [1, 0], clamp),
    // the words stay centred in frame (a straight push into the question) and grow a little with the container, then
    // rush at the lens as they let go — ≥ 90 px inside the container's edge at every frame (the streaks ≥ 35 px)
    faceScale: push * (1 + 0.25 * t) * (1 + 0.12 * zoom),
    faceAt: C4_ANCHOR,
    content: (
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: `${C4_ANCHOR.x}px ${C4_ANCHOR.y}px` }}>
        {content}
      </div>
    ),
  };
};

// ───────────────────────── C5 · shared-element return: debrief → « Victoire » row ─────────────────────────
// Card transition-travel A: one progress for position / size / radius; content scales with the container width; shadow
// converges from 0/36/110/0.32 to the row's own; the landing is the row's slot on 609 (k52, where the music splices into
// full energy). The fold runs 600 → 609 on a late ease-in-out (fastest 605–607, seated on 609, card curve re-shaped
// for 9 f) after the debrief caption has left on its own exit (589–599). Landing ritual (card): the list waits at 0.9
// and comes up to 1 over 607 → 611, straddling the landing; the outro's own row lifts away from 609 (its settle).
const C5 = { at: O.from, from: O.from - 9, to: O.from + 3 }; // 600 → 609 (k52 film / k68 outro), ritual to 611
const C5_EASE = Easing.bezier(0.8, 0, 0.5, 1);
const C5_RITUAL = [O.from - 2, O.from + 2] as const; // 607 → 611: list 0.9 → 1
const ROW_EL = OUTRO_GEOM.ELS.find((e) => e.key === 'row')!;
const ROW_TEX = layout['demo-row-1'];
/** Screen pose of the outro's « Victoire » row at outro-local frame lo (group pose under the crane camera). */
const outroRowAt = (lo: number) => {
  const p = OUTRO_GEOM.elPose(ROW_EL, lo);
  const cam = OUTRO_GEOM.camAt(lo);
  const o = OUTRO_GEOM.GROUP_ORIGIN;
  const a = (cam.tilt * Math.PI) / 180;
  const X = (p.x - o.x) * cam.scale;
  const Y = (p.y - o.y) * cam.scale;
  const k = 1400 / (1400 - Y * Math.sin(a));
  const sc = p.scale * cam.scale * k;
  return { x: o.x + X * k, y: o.y + Y * Math.cos(a) * k, w: ROW_TEX.w * sc, h: ROW_TEX.h * sc, r: ROW_EL.r * sc, rot: p.rot, air: Math.max(1 - p.t, p.lift * (1 - p.t)) };
};
// the coach's highlighted action (two lines) is the strip the page folds onto
const HL = DEBRIEF_CARD.hlLines.map((i) => DEBRIEF_CARD.lines[i]);
const HL_C = { x: HL[0].x + HL[0].w / 2, y: (HL[0].y + HL[1].y + HL[1].h) / 2 };

const Return: React.FC<{ f: number; outro: React.ReactNode; debrief: React.ReactNode; surround: React.ReactNode }> = ({ f, outro, debrief, surround }) => {
  const t = interpolate(f, [C5.from, C5.at], [0, 1], { ...clamp, easing: C5_EASE });
  const row = outroRowAt(f - O.from);
  const hl = debriefToScreen(f - DB.from, HL_C.x, HL_C.y);
  // the container starts as the card itself (its visible part: from its left edge to the frame's right edge, full
  // height) and its content is pinned to the card's left edge from t = 0: only card pixels are ever inside the box
  const L = debriefToScreen(f - DB.from, 0, HL_C.y).x;
  const left = lerp(L, row.x - row.w / 2, t);
  const right = lerp(1920, row.x + row.w / 2, t);
  const top = lerp(0, row.y - row.h / 2, t);
  const bottom = lerp(1080, row.y + row.h / 2, t);
  const box = { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top, r: lerp(0, row.r, t), rot: lerp(0, row.rot, t) };
  const s = box.w / (1920 - L);
  const pinY = lerp(540, hl.y, t);
  // the strip of night left of the card (the debrief's own backdrop) gives way to the match list as the fold starts
  const surroundO = 1 - interpolate(t, [0, 0.35], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  // no overlap of the two faces: the action strip leaves (t 0.70 → 0.85) onto the card's own surface colour, which
  // turns into the row's, then the row's face comes in (t 0.85 → 1)
  const content = 1 - interpolate(t, [0.7, 0.85], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const face = interpolate(t, [0.85, 1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const u = interpolate(t, [0.7, 1], [0, 1], clamp);
  const fill = `rgb(${lerp(38, 25, u).toFixed(1)},${lerp(37, 30, u).toFixed(1)},${lerp(70, 54, u).toFixed(1)})`;
  const listDim = 0.1 * interpolate(f, [...C5_RITUAL], [1, 0], clamp);
  const sh = { y: lerp(36, 14 + 28 * row.air, t), b: lerp(110, 34 + 46 * row.air, t), a: lerp(0.32, 0.5 + 0.15 * row.air, t) };
  const faceH = (box.w * ROW_TEX.h) / ROW_TEX.w;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      {outro}
      {/* the list stands by at 0.9 and comes up as the card seats */}
      {listDim > 0.001 ? <AbsoluteFill style={{ backgroundColor: C.bg, opacity: listDim }} /> : null}
      {surroundO > 0.001 ? (
        <AbsoluteFill style={{ opacity: surroundO, clipPath: `inset(0 ${(1920 - L).toFixed(2)}px 0 0)` }}>{surround}</AbsoluteFill>
      ) : null}
      <div
        style={{
          position: 'absolute', left: box.x - box.w / 2, top: box.y - box.h / 2, width: box.w, height: box.h, borderRadius: box.r,
          overflow: 'hidden', transform: box.rot ? `rotate(${box.rot}deg)` : undefined, backgroundColor: fill,
          boxShadow: t > 0.001 ? `0 ${sh.y}px ${sh.b}px rgba(2,6,17,${sh.a})` : undefined,
        }}
      >
        {content > 0.001 ? (
          <div style={{ position: 'absolute', left: -s * L, top: box.h / 2 - s * pinY, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0', opacity: content }}>
            {debrief}
          </div>
        ) : null}
        {face > 0 ? (
          <div style={{ position: 'absolute', left: 0, top: box.h / 2 - faceH / 2, width: box.w, height: faceH, opacity: face, overflow: 'hidden' }}>
            <Img src={staticFile(ROW_TEX.file)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
          </div>
        ) : null}
        {/* the container's glass edge (charte surface edge), like the row's own rim at the landing */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: box.r, boxShadow: `inset 0 0 0 ${lerp(0, 1.6 * (row.w / ROW_TEX.w) / ROW_EL.s, t).toFixed(2)}px ${C.glassBorder}`, opacity: Math.min(1, t * 6) }} />
      </div>
      {/* one fixed « Données fictives » in the shared slot (the outro's own tag sits under it, same place) */}
      <FictiveTag />
    </AbsoluteFill>
  );
};

// ───────────────────────── registry ─────────────────────────
type Seam = { key: string; at: number; from: number; to: number; render: (f: number) => React.ReactNode };
export const SEAMS: Seam[] = [
  {
    key: 'C1', at: C1.at, from: C1.from, to: C1.at,
    render: (f) => (
      <ShotAt shot={H} f={f}>
        <Hook portal={<ShotAt shot={A} f={f}><Analyse preRoll dive={hookDiveAt(f)} diveTrail={C1_TRAIL.map((d) => hookDiveAt(f - d))} /></ShotAt>} />
      </ShotAt>
    ),
  },
  {
    key: 'C2', at: C2.at, from: C2.from, to: C2.to,
    render: (f) => <Whip f={f} a={<ShotAt shot={A} f={f}><Analyse hideTag /></ShotAt>} b={<ShotAt shot={D} f={f}><Draft hideTag /></ShotAt>} />,
  },
  {
    key: 'C3', at: C3.at, from: C3.from, to: C3.to,
    render: (f) => <Focus f={f} a={<ShotAt shot={D} f={f}><Draft hideTag /></ShotAt>} b={<ShotAt shot={K} f={f}><BreathCard /></ShotAt>} />,
  },
  {
    key: 'C4', at: C4.at, from: C4.from, to: C4.at,
    render: (f) => {
      const morph = plateMorph(f, <ShotAt shot={DB} f={f}><Debrief hideTag /></ShotAt>);
      return (
        <AbsoluteFill>
          <ShotAt shot={K} f={f}>
            <BreathCard morph={morph} />
          </ShotAt>
          {/* the page inside carries no tag (it would be scaled down): one fixed tag in the shared slot as the page shows */}
          {morph.face < 0.999 ? <FictiveTag opacity={1 - morph.face} /> : null}
        </AbsoluteFill>
      );
    },
  },
  {
    key: 'C5', at: C5.at, from: C5.from, to: C5.to,
    render: (f) =>
      f < C5.at ? (
        <Return
          f={f}
          outro={<ShotAt shot={O} f={f}><Outro /></ShotAt>}
          debrief={<ShotAt shot={DB} f={f}><Debrief hideTag /></ShotAt>}
          surround={<ShotAt shot={DB} f={f}><Debrief hideTag /></ShotAt>}
        />
      ) : (
        // landed: the outro itself (its own row lifting away), the list finishing its 0.9 → 1 ritual
        <AbsoluteFill>
          <ShotAt shot={O} f={f}>
            <Outro />
          </ShotAt>
          <AbsoluteFill style={{ backgroundColor: C.bg, opacity: 0.1 * interpolate(f, [...C5_RITUAL], [1, 0], clamp) }} />
          <FictiveTag />
        </AbsoluteFill>
      ),
  },
];
export const seamAt = (f: number) => SEAMS.find((s) => f >= s.from && f < s.to);
/** Seam windows (absolute frames) for QA scripts: [from, to) is composed by the seam, `at` is its key frame (beat). */
export const SEAM_KEYS = SEAMS.map(({ key, at, from, to }) => ({ key, at, from, to }));
