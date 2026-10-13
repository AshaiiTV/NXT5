// Shot 1 — the hook (k0–16, frames 0–222). Shot card opening/spotlight-hero-card, re-skinned to the NXT5
// night charte: frame 0 is already a lit, readable match list (night-blue page, a real cool light pool on
// the first win) with the camera and the light in motion; the spotlight roves over the two wins and locks on
// the « Défaite · Scrim 1 · Aurore » row (k2); side push-in (left camera, rotY dominant); the row rises (lands
// k4), hovers with a sin bob, one perimeter beam runs two laps (fast/bright then slow/weak); a 3D annotation
// in the same page space reads « Défaite. » (k3 + 6f) then « Tu sais vraiment pourquoi ? » (k8). Through the
// music build (k8–13) the camera orbits slowly towards a more frontal view (parallax row / caption / page)
// and stops before the row reseats on k14; held still ≥15f, then the camera pulls back while the frame sinks
// to near-black (k15–16) so the drop on k16 lands on a clean contrast cut.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT, spectrumText } from '../theme';
import { Backdrop, FictiveTag } from '../lib/ui';
import { clamp, outCubic } from '../lib/motion';
import { localBeat, SHOTS } from '../timeline';
import layout from '../layout.json';
import { camAt, CamKey, CamLayer, project } from './hook/cam';

const B = (k: number) => localBeat(SHOTS.hook, k);

// ---- virtual page: the 1280×777 demo panel centred in a 1920-wide night page ----
const PAGE_H = 1080;
const PANEL = layout['demo-matches'];
const PX = (1920 - PANEL.w) / 2; // 320
const PY = 150;
const ROWS = PANEL.boxes.rows.map((r) => ({ x: PX + r.x, y: PY + r.y, w: r.w, h: r.h }));
const HERO = ROWS[2]; // « Défaite · Scrim 1 · Aurore »
const CUT = layout['demo-row-3'];
const HCX = HERO.x + HERO.w / 2; // 960
const HCY = HERO.y + HERO.h / 2;
const RADIUS = 14;
// caption shade: full strength over both caption lines, gone before the hero row's top edge (266 px down)
const SHADE_MASK = 'linear-gradient(180deg, #000 0%, #000 60%, transparent 69%)';

// ---- beats (local frames) ----
const LOCK = B(2); // 28 — spotlight locks on the hero row
const PUSH_END = 46;
const RISE_A = B(4) - 10; // 45
const RISE_B = B(4); // 55 — the row lands in the air on k4
const RESEAT_B = B(14); // 194 — touchdown on k14
const RESEAT_A = RESEAT_B - 16; // 178 — the orbit has stopped before the row starts to descend
const ORBIT_A = B(8); // 111 — the orbit rides the music build with the question
const EXIT_CAM_A = B(15) + 1; // 209 — camera locked 15f after touchdown (R1), then pulls back
const SINK_A = B(15) - 1; // 207
const END = B(16); // 222 (shot length)
const WORD_A = B(3) + 6; // 48 — « Défaite. » starts once the push-in has stopped (one event at a time)

const PUSH_EASE = Easing.bezier(0.35, 0, 0.2, 1);
const POP_EASE = Easing.bezier(0.2, 1.25, 0.3, 1);
const RESEAT_EASE = Easing.bezier(0.4, 0, 0.3, 1.05);
const SPOT_EASE = Easing.bezier(0.4, 0, 0.3, 1);
const ROVE_EASE = Easing.bezier(0.25, 0.3, 0.4, 1); // already moving on frame 0, decelerates into station 2
const CREEP_EASE = Easing.bezier(0.45, 0, 0.55, 1);
// ease-in, but less end-loaded than cubic (67 % vs 81 % of the change in the last 6 frames): reads as a fade, not a dip
const EXIT_EASE = Easing.in(Easing.quad);

// Hero framing (computed with project(): lifted row + beam keep ≥115 px on both sides at zoom 1.46).
const HERO_CAM = { cx: 860, cy: 680, zoom: 1.46, rotX: 8, rotY: 32, rotZ: 1.5, persp: 1200 };
// Orbit end, more frontal: the row gets wider on screen, so the zoom eases back to keep ≥120 px margins;
// the question (56 page px) stays ≥74 px effective at its far end.
const ORBIT_CAM = { cx: 880, cy: 680, zoom: 1.36, rotX: 6, rotY: 26, rotZ: 1, persp: 1200 };
const CAM_KEYS: CamKey[] = [
  // frame 0 frames the list (not the filters) and already moves (out-quad: full velocity on f0)
  { frame: 0, cx: 930, cy: 650, zoom: 1.3, rotX: 0, rotY: 0, rotZ: 0, persp: 1200 },
  { frame: LOCK, cx: 960, cy: 665, zoom: 1.34, rotX: 0, rotY: 0, rotZ: 0, persp: 1200, ease: Easing.out(Easing.quad) },
  { frame: PUSH_END, ...HERO_CAM, ease: PUSH_EASE },
  { frame: ORBIT_A, ...HERO_CAM }, // still while the beam runs and « Défaite. » lands
  { frame: RESEAT_A, ...ORBIT_CAM, ease: CREEP_EASE }, // slow orbit through the build, stops before reseat
  { frame: EXIT_CAM_A, ...ORBIT_CAM }, // fully still 178 → 209 (touchdown 194 + 15f)
  { frame: END - 1, cx: 870, cy: 660, zoom: 1.14, rotX: 6, rotY: 22, rotZ: 1, persp: 1200, ease: EXIT_EASE },
];

// roving spotlight stations (page space): win row 1 (frame 0, already moving) → win row 2 → locks on the loss (k2)
const SPOT_F = [0, 14, LOCK];
const SPOT_X = [700, 1150, HCX];
const SPOT_Y = [ROWS[0].y + 55, ROWS[1].y + 55, HCY];
const spotAt = (f: number, vals: number[]) =>
  f <= SPOT_F[1]
    ? interpolate(f, [SPOT_F[0], SPOT_F[1]], [vals[0], vals[1]], { ...clamp, easing: ROVE_EASE })
    : interpolate(f, [SPOT_F[1], SPOT_F[2]], [vals[1], vals[2]], { ...clamp, easing: SPOT_EASE });

type Seg = { t: string; spectrum?: boolean };
/** blur-slide words (shot card typography/blur-slide, same tuning as lib BlurLine) with mixed segments. */
const Words: React.FC<{ words: Seg[][]; start: number; size: number; weight?: number; color?: string; gap?: number; win?: number }> = ({
  words, start, size, weight = 700, color = C.text, gap = 3.5, win = 20,
}) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: 'flex', gap: '0 0.26em', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: size, fontWeight: weight, color, lineHeight: 1.08, letterSpacing: '-0.025em' }}>
      {words.map((w, i) => {
        const p = interpolate(f, [start + i * gap, start + i * gap + win], [0, 1], { ...clamp, easing: outCubic });
        return (
          <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * size * 0.45}px)`, filter: p < 1 ? `blur(${(1 - p) * size * 0.12}px)` : undefined }}>
            {w.map((s, j) => (
              <span key={j} style={s.spectrum ? { ...spectrumText, textShadow: 'none' } : undefined}>
                {s.t}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
};

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(CAM_KEYS, f);

  // ---- hero action arc: rise (overshoot) → hover (sin bob) → reseat (gentle, slight press) ----
  const rise = interpolate(f, [RISE_A, RISE_B], [0, 1], { ...clamp, easing: POP_EASE });
  const reseat = interpolate(f, [RESEAT_A, RESEAT_B], [0, 1], { ...clamp, easing: RESEAT_EASE });
  const lift = rise * (1 - reseat);
  const bob = Math.sin(((f - RISE_B) / 40) * Math.PI * 2) * 4 * lift;
  const z = 120 * lift + bob;
  const press = interpolate(f, [RESEAT_B - 4, RESEAT_B - 1, RESEAT_B], [1, 0.997, 1], clamp);
  const landed = f >= RESEAT_B;
  // the spotlight lights the hero itself (closer to the light while airborne)
  const lit = interpolate(f, [LOCK - 4, LOCK + 8], [0, 1], clamp) * (1 + 0.25 * lift);
  const R = 3 + 11 * Math.min(1, lift * 1.5);

  // vacated slot: a recessed patch with a breathing cyan outline, brightens on touchdown then disappears
  const slotVis = Math.min(1, rise * 2) * (1 - reseat);
  const landPulse = interpolate(f, [RESEAT_B - 4, RESEAT_B, RESEAT_B + 6], [0, 1, 0], clamp);
  const breath = 0.5 + 0.5 * Math.sin(((f - RISE_B) / 46) * Math.PI * 2);
  const slotEdge = (0.28 + 0.14 * breath) * (1 - reseat) + landPulse * 0.6;

  // ---- perimeter beam: lap 1 fast & bright (k4→k5), lap 2 slower & weaker, faint ring lingers ----
  const L1A = RISE_B + 1;
  const L1B = B(5) + 1;
  const L2A = L1B + 6;
  const L2B = L2A + 20;
  const beam1 = interpolate(f, [L1A, L1B], [0, 1], { ...clamp, easing: Easing.linear });
  const beam2 = interpolate(f, [L2A, L2B], [0, 1], { ...clamp, easing: Easing.bezier(0.4, 0, 0.4, 1) });
  const beam1On = f >= L1A - 1 && f <= L1B + 1;
  const beam2On = f >= L2A - 1 && f <= L2B + 1;
  const trail = interpolate(f, [L2B, L2B + 14], [0.4, 0], clamp) * (f >= L2B ? 1 : 0);
  const bw = HERO.w + 8;
  const bh = HERO.h + 8;

  // ---- spotlight (screen space), tracks the hero through the push-in ----
  const spPage = f < LOCK ? { x: spotAt(f, SPOT_X), y: spotAt(f, SPOT_Y), z: 0 } : { x: HCX, y: HCY, z: z * 0.5 };
  const sp = project(cam, spPage.x, spPage.y, spPage.z);
  const pulse = interpolate(f, [LOCK, LOCK + 4, LOCK + 9], [0, 1, 0], clamp);
  // roving pool (ellipse hole) hands over to a hole shaped like the hero row (projected quad) at the lock
  const roveOn = interpolate(f, [LOCK - 2, LOCK + 8], [1, 0], clamp);
  const lockOn = interpolate(f, [LOCK - 6, LOCK + 2], [0, 1], { ...clamp, easing: SPOT_EASE });
  const m = 4 + 16 * pulse; // page px around the row (+ lock pulse); tight so row 2 stays dark
  const quad = [
    project(cam, HERO.x - m, HERO.y - m, z), project(cam, HERO.x + HERO.w + m, HERO.y - m, z),
    project(cam, HERO.x + HERO.w + m, HERO.y + HERO.h + m, z), project(cam, HERO.x - m, HERO.y + HERO.h + m, z),
  ].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const roveRx = 400;
  const roveRy = 170;
  // night-blue page before the lock (scroll-stopper), then the light tightens on the hero through the build
  const dark = interpolate(f, [0, LOCK, PUSH_END, B(8), B(13)], [0.72, 0.74, 0.87, 0.88, 0.93], clamp);
  const poolA = interpolate(f, [LOCK, PUSH_END], [0.34, 0.26], clamp);
  const poolRx = interpolate(f, [LOCK - 6, LOCK + 4, PUSH_END], [520, 860, 1000], { ...clamp, easing: SPOT_EASE });
  const poolRy = interpolate(f, [LOCK - 6, LOCK + 4, PUSH_END], [330, 200, 260], { ...clamp, easing: SPOT_EASE });

  // ---- end: pull back and sink to near-black for the hard cut on the drop ----
  const sink = interpolate(f, [SINK_A, END - 1], [0, 1], { ...clamp, easing: EXIT_EASE });

  // ---- annotation (same 3D space, floats at z≈92, own slow bob, not in sync with the row) ----
  const noteZ = 92 + Math.sin(((f - WORD_A) / 44) * Math.PI * 2) * 3;
  const shade = interpolate(f, [WORD_A - 4, WORD_A + 12], [0, 1], clamp);
  const NOTE_X = HERO.x + 12;
  const NOTE_Y = HERO.y - 196;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Backdrop dim={0.55} drift={0.6} />

      {/* page layer: real demo panel, vacated slot, levitating hero row + beam */}
      <CamLayer cam={cam} pageH={PAGE_H}>
        <Img
          src={staticFile(PANEL.file)}
          style={{
            position: 'absolute', left: PX, top: PY, width: PANEL.w, height: PANEL.h, borderRadius: 16,
            boxShadow: '0 30px 90px rgba(2,6,17,.55)',
          }}
        />
        {slotVis > 0.02 ? (
          <div
            style={{
              position: 'absolute', left: HERO.x, top: HERO.y, width: HERO.w, height: HERO.h, borderRadius: RADIUS,
              background: '#0B1122', boxShadow: 'inset 0 6px 22px rgba(2,6,17,.85)', opacity: slotVis, transform: 'translateZ(0.5px)',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, borderRadius: RADIUS, border: `1.5px solid ${C.cyan}`, opacity: slotEdge }} />
          </div>
        ) : null}
        <div
          style={{
            position: 'absolute', left: HERO.x, top: HERO.y, width: HERO.w, height: HERO.h,
            transform: `translateZ(${z + 1}px) scale(${press})`, transformOrigin: 'center center', transformStyle: 'preserve-3d',
          }}
        >
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: R, overflow: 'hidden',
              boxShadow: landed ? 'none' : `0 ${10 * lift}px ${14 + 14 * lift}px rgba(2,6,17,${0.55 * lift}), 0 ${50 * lift}px ${100 * lift}px rgba(2,6,17,${0.6 * lift})`,
            }}
          >
            <Img
              src={staticFile(CUT.file)}
              style={{ position: 'absolute', left: 0, top: -CUT.boxes.content.y, width: CUT.w, height: CUT.h, display: 'block', filter: `brightness(${1 + 0.22 * lit}) saturate(${1 + 0.12 * lit})` }}
            />
            {/* lit glass edge while airborne (clipped to the row's corners) */}
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: R, opacity: lift,
                background: 'linear-gradient(172deg, rgba(226,232,255,.16), rgba(226,232,255,0) 45%)',
                boxShadow: `inset 0 0 0 1.5px ${C.glassBorder}, inset 0 1px 0 rgba(226,232,255,.22)`,
              }}
            />
          </div>
          {(beam1On || beam2On) && lift > 0.4 ? (
            <svg
              width={bw} height={bh} viewBox={`0 0 ${bw} ${bh}`}
              style={{
                position: 'absolute', left: -4, top: -4, overflow: 'visible',
                opacity: beam1On ? 1 : 0.62,
                filter: `drop-shadow(0 0 5px ${C.cyan}) drop-shadow(0 0 16px rgba(103,232,249,.55))`,
              }}
            >
              {[
                { stroke: C.cyan, w: beam1On ? 5 : 3.5 },
                { stroke: 'rgba(236,254,255,.98)', w: beam1On ? 2.5 : 1.75 },
              ].map((s, i) => (
                <rect
                  key={i} x={2} y={2} width={bw - 4} height={bh - 4} rx={RADIUS + 2} fill="none" stroke={s.stroke} strokeWidth={s.w}
                  strokeLinecap="round" pathLength={1} strokeDasharray="0.12 1" strokeDashoffset={-(beam1On ? beam1 : beam2)}
                />
              ))}
            </svg>
          ) : null}
          {trail > 0.01 ? (
            <div style={{ position: 'absolute', inset: -4, borderRadius: RADIUS + 4, border: `1.5px solid ${C.cyan}`, opacity: trail }} />
          ) : null}
        </div>
      </CamLayer>

      {/* roving / locking spotlight: darkness with a soft hole (roving ellipse ∪ hero-row quad) + a cool light pool */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="hook-spot-rove" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
          <filter id="hook-spot-row" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={18} />
          </filter>
          <mask id="hook-spot-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
            <rect width={1920} height={1080} fill="white" />
            {roveOn > 0.01 ? <ellipse cx={sp.x} cy={sp.y} rx={roveRx} ry={roveRy} fill="black" opacity={roveOn} filter="url(#hook-spot-rove)" /> : null}
            {lockOn > 0.01 ? <polygon points={quad} fill="black" opacity={lockOn} filter="url(#hook-spot-row)" /> : null}
          </mask>
        </defs>
        <rect width={1920} height={1080} fill="rgb(2,6,17)" opacity={dark} mask="url(#hook-spot-mask)" />
      </svg>
      <AbsoluteFill
        style={{
          background: `radial-gradient(${poolRx}px ${poolRy}px at ${sp.x}px ${sp.y}px, rgba(207,250,254,${poolA}), rgba(196,181,253,.12) 40%, rgba(0,0,0,0) 100%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* end: the whole scene sinks towards near-black (the question stays a little longer) */}
      <AbsoluteFill style={{ backgroundColor: `rgba(2,6,17,${0.9 * sink})` }} />

      {/* caption scrim (screen space): pushes the magnified top-left page UI into the « texture » state (Q11) */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(2,6,17,.55) 0%, rgba(2,6,17,.35) 42%, rgba(2,6,17,0) 54%)',
          opacity: shade * (1 - sink),
        }}
      />

      {/* annotation layer: same camera, drawn above the spotlight dimming so it stays legible */}
      <CamLayer cam={cam} pageH={PAGE_H} style={{ opacity: 1 - 0.85 * sink }}>
        {/* the label's own soft shadow, just behind it in the same space: no page glyph reads through or between
            the caption lines; masked off above the hero row so it never dims the hero */}
        <div
          style={{
            position: 'absolute', left: NOTE_X - 120, top: NOTE_Y - 70, width: 1100, height: 380, transform: `translateZ(${noteZ - 6}px)`,
            background: 'radial-gradient(farthest-side, rgba(2,6,17,.9), rgba(2,6,17,.7) 60%, rgba(2,6,17,0))', opacity: shade,
            WebkitMaskImage: SHADE_MASK, maskImage: SHADE_MASK,
          }}
        />
        <div
          style={{
            position: 'absolute', left: NOTE_X, top: NOTE_Y, width: 1100,
            transform: `translateZ(${noteZ}px)`, textShadow: '0 4px 30px rgba(2,6,17,.85)',
          }}
        >
          <Words words={[[{ t: 'Défaite.' }]]} start={WORD_A} size={64} weight={800} color={C.danger} win={22} />
          <div style={{ height: 14 }} />
          <Words
            words={[[{ t: 'Tu' }], [{ t: 'sais' }], [{ t: 'vraiment' }], [{ t: 'pourquoi', spectrum: true }, { t: '\u00a0?' }]]}
            start={B(8)} size={56} weight={700} gap={4.5}
          />
        </div>
      </CamLayer>

      <FictiveTag x={1636} y={994} opacity={1 - 0.75 * sink} />
    </AbsoluteFill>
  );
};
