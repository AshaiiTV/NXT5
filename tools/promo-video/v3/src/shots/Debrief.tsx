// Shot 6 — debrief (k48–60, 166f). Shot card ui-entrance/document-typewriter-reveal on the real debrief page.
//
// Local frame 0 is slam #2 (the music returns): the debrief card lands under a short camera settle (zoom ×1.16 → 1
// and a 9° swing, brand ease, no overshoot, no shake) with one violet rim light on the card that decays — the shot's
// only light effect, inside the card's rounded clip. Then the real document writes itself step by step: each step
// lands on an odd beat (k49 / k51 / k53) — its violet numeral ("1." "2." "3.", revealed from the real texture in its
// own slot) presses in with the breath card's letterpress (scale 1.28→1, blur 7→0, 9f, element-level only) while
// its divider draws, and its heading types 3f later — and its body types from the next beat (k50 / k52 / k54), so
// the pen starts as the slam's settle ends and the full page holds ~2 s. Writing = the demo's mask wipe (bezier(0.4,0,0.6,1), one cyan caret riding the
// newest block only, fading 2f after it); the "paper" cover is the real texture with the text erased
// (debrief/debrief-empty.png, built by debrief/make-empty.py) because the glass card is a gradient, not a flat
// colour. After the last line the pen rests and blinks on the beats until the cut.
//
// Camera: PageCam2D maths (CSS zoom so the 2x texture is rasterised at its final size, rotateY around the frame
// centre, perspective × zoom), eased down with the pen. The page's body text is 16px CSS (cap height 11.5px, line
// pitch 28.8px; the 20px of layout.json is the line box), so the camera holds zoom ≥ 2.02 → body ≥ 32px, headings
// ≈ 39px. At that size the longest line (631 CSS px) needs ~1300px, so the caption cannot sit beside the page: it
// lives in the unwritten space below the pen (single blur-slide line, 72px, over a night scrim), held ~4 s.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT } from '../theme';
import { Backdrop, BlurLine, FictiveTag, Glow } from '../lib/ui';
import { clamp, EASE, lerp, outCubic } from '../lib/motion';
import { localBeat, SHOTS } from '../timeline';
import layout from '../layout.json';
import emptyTex from './debrief/debrief-empty.png';

const L = layout.debrief;
const TEX = staticFile(L.file);
const CARD_W = L.w; // 1280 CSS px
const CARD_H = L.h; // 720
const RADIUS = 18; // measured on the texture (~17 CSS px corner)
const B = (k: number) => localBeat(SHOTS.debrief, k);

// ---------- writing plan ----------
type Rect = { x: number; y: number; w: number; h: number };
type Block = { rect: Rect; cue: number; dur: number; caret: boolean; text?: Rect };
const PAD = 5; // ⊇ the erased rectangle of make-empty.py (4px pad)
const lineRect = (i: number): Rect => {
  const b = L.boxes.lines[i];
  return { x: b.x - PAD, y: b.y - PAD, w: b.w + PAD * 2, h: b.h + PAD * 2 };
};
const dividerRect = (i: number): Rect => {
  const s = L.boxes.steps[i];
  return { x: s.x - 4, y: s.y - 4, w: s.w + 8, h: 8 };
};
const typeDur = (i: number, speed: number, min: number) => Math.max(min, Math.round(L.boxes.lines[i].w / speed));
const HEAD_SPEED = 22; // CSS px per frame
const BODY_SPEED = 40;

const STEPS = [
  { k: 49, divider: 0, head: 3, body: [4] },
  { k: 51, divider: 1, head: 5, body: [6] },
  { k: 53, divider: 2, head: 7, body: [8, 9] },
];
// the step numeral ("1." …) is its own block: measured on the texture, the violet numerals end at CSS x ≤ 47.5 and
// the heading words start at x ≥ 50.5, so x = 49 splits every heading cleanly
const NUM_X1 = 49;
const PRESS = Easing.bezier(0.2, 0.75, 0.3, 1); // BreathCard / paper-title-card letterpress
const NUM_WIN = 9;
const HEAD_DELAY = 3;
type Numeral = { rect: Rect; cue: number };
const NUMERALS: Numeral[] = [];
const BLOCKS: Block[] = [];
for (const st of STEPS) {
  const land = B(st.k);
  const head = lineRect(st.head);
  NUMERALS.push({ rect: { ...head, w: NUM_X1 - head.x }, cue: land });
  BLOCKS.push({ rect: dividerRect(st.divider), cue: land, dur: 12, caret: false });
  BLOCKS.push({
    rect: { ...head, x: NUM_X1, w: head.x + head.w - NUM_X1 },
    cue: land + HEAD_DELAY,
    dur: typeDur(st.head, HEAD_SPEED, 8),
    caret: true,
    text: L.boxes.lines[st.head],
  });
  let cue = B(st.k + 1);
  for (const i of st.body) {
    const d = typeDur(i, BODY_SPEED, 5);
    BLOCKS.push({ rect: lineRect(i), cue, dur: d, caret: true, text: L.boxes.lines[i] });
    cue += d + 1;
  }
}
const LAST = BLOCKS[BLOCKS.length - 1];
const WRITE_END = LAST.cue + LAST.dur;
const REVEAL_EASE = Easing.bezier(0.4, 0, 0.6, 1); // demo value

// ---------- camera ----------
const SLAM = 16; // settle length (lands just after k49)
const FOLLOW = Easing.bezier(0.45, 0, 0.35, 1);
const X_LEFT = 300; // screen x of the text column (CSS x = 33); the caption aligns on it
const PERSP = 1400; // PageCam2D default
const camAt = (f: number) => {
  const imp = 1 - interpolate(f, [0, SLAM], [0, 1], { ...clamp, easing: EASE }); // 1 → 0
  const u = interpolate(f, [4, 114], [0, 1], { ...clamp, easing: FOLLOW }); // the pen goes 184 → 532 CSS over 13 → 105
  const sFollow = lerp(2.02, 2.06, u);
  const breath = 1 + 0.012 * (f / 166); // keeps the final hold alive without moving the text it reads
  return {
    s: sFollow * breath * (1 + 0.16 * imp),
    cx: 33 + (960 - X_LEFT) / sFollow,
    cy: lerp(228, 396, u),
    rotY: lerp(4.5, 2.5, u) + 9 * imp,
    imp,
  };
};

/** One block revealed from the real texture: a left-anchored window over the original page that widens. */
const Reveal: React.FC<{ r: Rect; p: number }> = ({ r, p }) =>
  p <= 0 ? null : (
    <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w * p, height: r.h, overflow: 'hidden' }}>
      <Img src={TEX} style={{ position: 'absolute', left: -r.x, top: -r.y, width: CARD_W, height: CARD_H, maxWidth: 'none' }} />
    </div>
  );

/** A step numeral pressed in place (letterpress: scale 1.28→1 + blur 7→0 + opacity, left-anchored in its slot). */
const NumeralPress: React.FC<{ r: Rect; t: number }> = ({ r, t }) =>
  t <= 0 ? null : (
    <div
      style={{
        position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, opacity: t,
        transform: `scale(${1.28 - 0.28 * t})`, transformOrigin: `${r.x}px ${r.y + r.h / 2}px`,
        filter: t < 1 ? `blur(${(1 - t) * 7}px)` : undefined,
      }}
    >
      <Reveal r={r} p={1} />
    </div>
  );

const CAPTION_START = 2;
const CAPTION_Y = 892;

export const Debrief: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);

  // caret: only the newest block still being written (one pen tip)
  const progress = BLOCKS.map((b) => interpolate(f, [b.cue, b.cue + b.dur], [0, 1], { ...clamp, easing: b.caret ? REVEAL_EASE : outCubic }));
  type Caret = { x: number; y: number; h: number; o: number };
  let caret: Caret | null = null;
  for (let i = 0; i < BLOCKS.length; i++) {
    const b = BLOCKS[i];
    if (!b.caret || !b.text || f < b.cue || f > b.cue + b.dur + 2) continue;
    const h = Math.min(20, b.text.h - 2);
    caret = {
      x: b.rect.x + b.rect.w * progress[i],
      y: b.text.y + (b.text.h - h) / 2,
      h,
      o: progress[i] < 1 ? 1 : interpolate(f, [b.cue + b.dur, b.cue + b.dur + 2], [1, 0], clamp),
    };
  }
  // after the last line, the pen rests at its end and blinks on the beats until the cut
  if (!caret && f > WRITE_END + 2 && LAST.text) {
    const t = LAST.text;
    const h = Math.min(20, t.h - 2);
    const since = [55, 56, 57, 58, 59].map((k) => f - B(k)).filter((d) => d >= 0);
    const d = since.length ? Math.min(...since) : 99;
    caret = { x: t.x + t.w + 3, y: t.y + (t.h - h) / 2, h, o: d <= 7 ? 1 : 0 };
  }

  const rim = interpolate(f, [0, 26], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bgZoom = 1.07 + 0.05 * cam.imp; // 1.07 overfills the frame so the parallax lift never shows an edge
  const bgLift = -(cam.cy - 228) * 0.2;
  // the top scrim arrives with the follow, so the landing (card edge + rim light) stays clean
  const topScrim = interpolate(f, [SLAM, SLAM + 30], [0.35, 1], { ...clamp, easing: EASE });
  const eyebrow = interpolate(f, [CAPTION_START, CAPTION_START + 14], [0, 1], { ...clamp, easing: EASE });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateY(${bgLift}px) scale(${bgZoom})` }}>
        <Backdrop dim={0.45} />
      </AbsoluteFill>
      <Glow x={260} y={300 + bgLift} r={560} color={C.glowCyan} />
      <Glow x={1500} y={520} r={900} color={C.glowViolet} />

      {/* camera: PageCam2D 3D-branch maths on the card stage (CSS zoom → texture rasterised at final size) */}
      <div style={{ position: 'absolute', inset: 0, perspective: `${PERSP * cam.s}px`, perspectiveOrigin: '960px 540px' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, zoom: cam.s,
            transform: `translate(${960 / cam.s - cam.cx}px, ${540 / cam.s - cam.cy}px) rotateY(${cam.rotY}deg)`,
            transformOrigin: `${cam.cx}px ${cam.cy}px`, transformStyle: 'preserve-3d',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, borderRadius: RADIUS, boxShadow: '0 30px 90px rgba(2,6,17,.62), 0 0 0 1px rgba(2,6,17,.3)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: RADIUS, overflow: 'hidden' }}>
            <Img src={emptyTex} style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, maxWidth: 'none' }} />
            {BLOCKS.map((b, i) => (
              <Reveal key={i} r={b.rect} p={progress[i]} />
            ))}
            {NUMERALS.map((n, i) => (
              <NumeralPress key={`n${i}`} r={n.rect} t={interpolate(f, [n.cue, n.cue + NUM_WIN], [0, 1], { ...clamp, easing: PRESS })} />
            ))}
            {caret ? (
              <div
                style={{
                  position: 'absolute', left: caret.x, top: caret.y, width: 2, height: caret.h, borderRadius: 1,
                  background: C.cyan, opacity: caret.o,
                }}
              />
            ) : null}
            {/* the shot's one light: violet rim light on impact, inside the card's rounded clip */}
            {rim > 0.01 ? (
              <div
                style={{
                  position: 'absolute', inset: 0, borderRadius: RADIUS, pointerEvents: 'none',
                  boxShadow: `inset 0 0 0 2px rgba(196,181,253,${rim}), inset 0 0 120px rgba(139,92,246,${0.7 * rim})`,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* top scrim (mirrors the caption band): lines leaving the frame top fade into the night instead of being cut */}
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(17,24,39,.88) 0px, rgba(17,24,39,0) 150px)', opacity: topScrim }} />
      {/* caption band: the unwritten lower page fades into the night under the title */}
      <AbsoluteFill
        style={{ background: 'linear-gradient(to bottom, rgba(17,24,39,0) 830px, rgba(17,24,39,.8) 940px, rgba(17,24,39,.92) 1080px)' }}
      />
      <div style={{ position: 'absolute', left: X_LEFT, top: CAPTION_Y }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, letterSpacing: '0.2em', color: C.cyan, opacity: eyebrow, marginBottom: 12 }}>
          DÉBRIEF
        </div>
        <BlurLine
          line={[{ text: 'Note ce qui' }, { text: 'doit changer.', spectrum: true }]}
          start={CAPTION_START + 2}
          size={72}
          style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}
        />
      </div>
      <FictiveTag />
    </AbsoluteFill>
  );
};
