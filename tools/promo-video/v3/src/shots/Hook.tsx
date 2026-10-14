// Shot 1 — the hook (film k8–16, frames 0–111, over the music build; the drop hits on the cut at 111).
// Shot card opening/spotlight-hero-card (demo SpotlightHeroCard.tsx), compressed from 139 to 111 frames with
// the demo's ratios kept (lock→touchdown 98f → 88f, push 16 → 13, rise 10 → 9, hover 54 → 53, reseat 18 → 14),
// re-skinned to the NXT5 night charte. The hero is the VICTORY row « Victoire · Scrim 3 · Aurore »: every
// product shot after it shows that same Scrim 3 win (+4 000 or), so the film asks why even a win was won.
// Frame 0 is already a lit, moving composition (scroll-stopper): the whole match list, the light pool
// arriving on the win, the camera already swinging. The light locks (f7), the camera swings to the left-side
// 3/4 view (rotY dominant), the row rises (lands on k10), hovers with a sin bob, one perimeter beam lap; a 3D
// annotation in the same page space reads « Victoire. » (UI victory green, settled f16) then « Tu sais
// vraiment pourquoi ? » (settled on k12 = f55, held to f100). The camera orbits slowly towards a more
// frontal view and is still from f78 through the reseat (touchdown f95); f100–110 it pulls back while the frame
// sinks to near-black, so the drop on f111 lands on a clean contrast cut to the glass 5.
// Light (demo values): pool alpha 0.42 at the centre → 0.10 at 45 %; darkening 0 inside 45 % of the pool radius,
// ≤ 0.42 at its edge and beyond (mean luma f0–95 ≈ 33/255). The rest of the page focus-pulls to « texture » (Q11).
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
const HERO = ROWS[0]; // « Victoire · Scrim 3 · Aurore »
const CUT = layout['demo-row-1'];
const HCX = HERO.x + HERO.w / 2; // 960
const HCY = HERO.y + HERO.h / 2; // 570
const RADIUS = 14;
/** The UI's own victory green: the « Victoire » label of demo-row-1.png / demo-matches.png is rgb(167,243,208). */
const WIN_GREEN = '#A7F3D0';

// ---- beats (local frames; k8 = 0, k10 = 28, k12 = 55, k14 = 83, k15 = 97, k16 = 111) ----
const LOCK = 7; // the light settles on the win (lock pulse 7 → 16)
const PUSH_END = 20; // swing to the 3/4 view (already moving on frame 0)
const RISE_B = B(10); // 28 — the row lands in the air on k10
const RISE_A = RISE_B - 9; // 19
const HOVER_END = 81; // 53f hover (demo 54f)
const RESEAT_A = HOVER_END;
const RESEAT_B = 95; // touchdown (14f reseat, demo 18f)
const ORBIT_END = 78; // camera still from here through the reseat and the touchdown
const EXIT_A = 100; // pull back + sink to near-black
const END = B(16); // 111 (shot length): the drop
const WORD_A = 0; // « Victoire. » rises from frame 0, settled f16
const QUESTION_A = 26; // last word settled f55 (k12), held to f100

const PUSH_EASE = Easing.bezier(0.3, 0.22, 0.2, 1); // starts with velocity: the camera already moves on frame 0
const POP_EASE = Easing.bezier(0.2, 1.25, 0.3, 1);
const RESEAT_EASE = Easing.bezier(0.4, 0, 0.3, 1.05);
const SPOT_EASE = Easing.bezier(0.4, 0, 0.3, 1);
const ARRIVE_EASE = Easing.bezier(0.25, 0.35, 0.3, 1); // already sliding on frame 0, decelerates into the lock
const CREEP_EASE = Easing.bezier(0.45, 0, 0.55, 1);
const EXIT_EASE = Easing.in(Easing.quad);

// Opening view: the whole list, nearly frontal; then the left-side 3/4 hero view (lifted row + beam keep
// ≥150 px on both sides), then a slow orbit towards a more frontal view. The question (60 page px) measures
// 78–120 px effective along its length in both views (project()).
const OPEN_CAM = { cx: 900, cy: 522, zoom: 1.24, rotX: 2, rotY: 6, rotZ: 0, persp: 1200 };
const HERO_CAM = { cx: 860, cy: HCY - 120, zoom: 1.46, rotX: 8, rotY: 32, rotZ: 1.5, persp: 1200 };
const ORBIT_CAM = { cx: 880, cy: HCY - 120, zoom: 1.38, rotX: 6, rotY: 25, rotZ: 1, persp: 1200 };
const CAM_KEYS: CamKey[] = [
  { frame: 0, ...OPEN_CAM },
  { frame: PUSH_END, ...HERO_CAM, ease: PUSH_EASE },
  { frame: ORBIT_END, ...ORBIT_CAM, ease: CREEP_EASE },
  { frame: EXIT_A, ...ORBIT_CAM },
  { frame: END - 1, cx: 880, cy: HCY - 90, zoom: 1.16, rotX: 6, rotY: 21, rotZ: 1, persp: 1200, ease: EXIT_EASE },
];

// arriving light (page space): slides up from the compositions between the two wins onto the hero row, locks at LOCK
const SPOT_FROM = { x: 1260, y: HCY + 70 };

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
  const z = 110 * lift + bob;
  const press = interpolate(f, [RESEAT_B - 4, RESEAT_B - 1, RESEAT_B], [1, 0.997, 1], clamp);
  const landed = f >= RESEAT_B;
  const R = 3 + 11 * Math.min(1, lift * 1.5);

  // vacated slot: a recessed patch with a breathing cyan outline, brightens on touchdown then disappears
  const slotVis = Math.min(1, rise * 2) * (1 - reseat);
  const landPulse = interpolate(f, [RESEAT_B - 4, RESEAT_B, RESEAT_B + 4], [0, 1, 0], clamp);
  const breath = 0.5 + 0.5 * Math.sin(((f - RISE_B) / 40) * Math.PI * 2);
  const slotEdge = (0.28 + 0.14 * breath) * (1 - reseat) + landPulse * 0.6;

  // ---- perimeter beam: one bright lap right after the landing, then a faint ring that fades ----
  const BEAM_A = RISE_B + 1; // 29
  const BEAM_B = BEAM_A + 16; // 45
  const beam = interpolate(f, [BEAM_A, BEAM_B], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.6, 1) });
  const beamOn = f >= BEAM_A - 1 && f <= BEAM_B + 1;
  const trail = interpolate(f, [BEAM_B, BEAM_B + 14], [0.4, 0], clamp) * (f >= BEAM_B ? 1 : 0);
  const bw = HERO.w + 6; // demo geometry: beam centred 1 px outside the row edge
  const bh = HERO.h + 6;

  // ---- spotlight (screen space): arrives on the win, locks, tracks the hero through the swing ----
  const arrive = interpolate(f, [0, LOCK], [0, 1], { ...clamp, easing: ARRIVE_EASE });
  const spPage = { x: SPOT_FROM.x + (HCX - SPOT_FROM.x) * arrive, y: SPOT_FROM.y + (HCY - SPOT_FROM.y) * arrive, z: z * 0.5 };
  const sp = project(cam, spPage.x, spPage.y, spPage.z);
  const pulse = interpolate(f, [LOCK, LOCK + 4, LOCK + 9], [0, 1, 0], clamp); // demo: +6 % pool radius
  const m = 6 + 14 * pulse; // page px of light around the row
  const quad = [
    project(cam, HERO.x - m, HERO.y - m, z), project(cam, HERO.x + HERO.w + m, HERO.y - m, z),
    project(cam, HERO.x + HERO.w + m, HERO.y + HERO.h + m, z), project(cam, HERO.x - m, HERO.y + HERO.h + m, z),
  ].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const rowLit = interpolate(f, [0, LOCK], [0.55, 1], { ...clamp, easing: SPOT_EASE });
  // the arriving light is an ellipse; it hands over to a hole shaped like the hero row at the lock
  const roveOn = interpolate(f, [LOCK - 3, LOCK + 6], [1, 0], clamp);
  const lockOn = interpolate(f, [LOCK - 5, LOCK + 2], [0, 1], { ...clamp, easing: SPOT_EASE });
  // outside darkening (demo vignette 0.16 → 0.34 → 0.42), pool 0.42 → 0.10 at 45 % (demo)
  const dark = interpolate(f, [0, LOCK, PUSH_END], [0.38, 0.41, 0.42], clamp);
  // focus pull as the captions arrive: the rest of the page (not the hero row) drops to « texture » (Q11)
  const focus = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: outCubic });
  // pool radius closes in as it locks (demo 620 → 420 → 360, scaled to a 1 238-px-wide row), +6 % lock pulse
  const poolRx = interpolate(f, [0, LOCK, PUSH_END], [760, 900, 860], { ...clamp, easing: SPOT_EASE }) * (1 + 0.06 * pulse);
  const poolRy = interpolate(f, [0, LOCK, PUSH_END], [380, 320, 300], { ...clamp, easing: SPOT_EASE }) * (1 + 0.06 * pulse);
  const poolA = 0.42;

  // ---- end: pull back and sink to near-black for the hard cut on the drop ----
  const sink = interpolate(f, [EXIT_A, END - 1], [0, 1], { ...clamp, easing: EXIT_EASE });

  // ---- annotation (same 3D space, floats at z≈92, own slow bob, not in sync with the row) ----
  const noteZ = 92 + Math.sin(((f - RISE_B) / 44) * Math.PI * 2) * 3;
  const shade = interpolate(f, [WORD_A, WORD_A + 10], [0, 1], clamp);
  const NOTE_X = HERO.x + 12;
  const NOTE_Y = HERO.y - 236;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Backdrop dim={0.38} drift={0.6} />

      {/* page layer: real demo panel, vacated slot, levitating hero row + beam */}
      <CamLayer cam={cam} pageH={PAGE_H}>
        <Img
          src={staticFile(PANEL.file)}
          style={{
            position: 'absolute', left: PX, top: PY, width: PANEL.w, height: PANEL.h, borderRadius: 16,
            boxShadow: '0 30px 90px rgba(2,6,17,.55)',
            filter: focus > 0 ? `blur(${2.4 * focus}px) brightness(${1 - 0.1 * focus})` : undefined,
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
              boxShadow: landed ? 'none' : `0 ${8 * lift}px ${12 + 12 * lift}px rgba(2,6,17,${0.5 * lift}), 0 ${46 * lift}px ${90 * lift}px rgba(2,6,17,${0.55 * lift})`,
            }}
          >
            <Img
              src={staticFile(CUT.file)}
              style={{ position: 'absolute', left: 0, top: -CUT.boxes.content.y, width: CUT.w, height: CUT.h, display: 'block', filter: `brightness(${1 + 0.12 * rowLit + 0.1 * lift})` }}
            />
            {/* lit glass edge while airborne (clipped to the row's corners) */}
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: R, opacity: lift,
                background: 'linear-gradient(172deg, rgba(226,232,255,.14), rgba(226,232,255,0) 45%)',
                boxShadow: `inset 0 0 0 1.5px ${C.glassBorder}, inset 0 1px 0 rgba(226,232,255,.22)`,
              }}
            />
          </div>
          {beamOn && lift > 0.4 ? (
            <svg
              width={bw} height={bh} viewBox={`0 0 ${bw} ${bh}`}
              style={{
                position: 'absolute', left: -3, top: -3, overflow: 'visible',
                filter: `drop-shadow(0 0 5px ${C.cyan}) drop-shadow(0 0 16px rgba(103,232,249,.55))`,
              }}
            >
              {[
                { stroke: C.cyan, w: 5 },
                { stroke: 'rgba(236,254,255,.98)', w: 2.5 },
              ].map((s, i) => (
                <rect
                  key={i} x={2} y={2} width={bw - 4} height={bh - 4} rx={RADIUS + 1} fill="none" stroke={s.stroke} strokeWidth={s.w}
                  strokeLinecap="round" pathLength={1} strokeDasharray="0.14 1" strokeDashoffset={-beam}
                />
              ))}
            </svg>
          ) : null}
          {trail > 0.01 ? (
            <div style={{ position: 'absolute', inset: -3, borderRadius: RADIUS + 3, border: `1.5px solid ${C.cyan}`, opacity: trail }} />
          ) : null}
        </div>
      </CamLayer>

      {/* outside darkening (≤ 0.42, demo vignette) with a soft hole shaped like the hero row (projected quad) */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="hook-spot-rove" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={34} />
          </filter>
          <filter id="hook-spot-row" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={22} />
          </filter>
          {/* demo falloff: no darkening inside 45 % of the pool radius, full vignette only at its edge */}
          <radialGradient id="hook-pool-hole">
            <stop offset="0" stopColor="black" stopOpacity={1} />
            <stop offset="0.45" stopColor="black" stopOpacity={1} />
            <stop offset="1" stopColor="black" stopOpacity={0} />
          </radialGradient>
          <mask id="hook-spot-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
            <rect width={1920} height={1080} fill="white" />
            <ellipse cx={sp.x} cy={sp.y} rx={poolRx} ry={poolRy} fill="url(#hook-pool-hole)" />
            {roveOn > 0.01 ? <ellipse cx={sp.x} cy={sp.y} rx={560} ry={230} fill="black" opacity={roveOn} filter="url(#hook-spot-rove)" /> : null}
            {lockOn > 0.01 ? <polygon points={quad} fill="black" opacity={lockOn * rowLit} filter="url(#hook-spot-row)" /> : null}
          </mask>
        </defs>
        <rect width={1920} height={1080} fill="rgb(2,6,17)" opacity={dark} mask="url(#hook-spot-mask)" />
      </svg>
      {/* the light pool itself: cool white → violet, screen-blended (demo: 0.42 → 0.10 at 45 %) */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(${poolRx}px ${poolRy}px at ${sp.x}px ${sp.y}px, rgba(214,236,255,${poolA}), rgba(196,181,253,.10) 45%, rgba(0,0,0,0) 100%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* end: the whole scene sinks towards near-black (the captions stay a little longer) */}
      <AbsoluteFill style={{ backgroundColor: `rgba(2,6,17,${0.9 * sink})` }} />

      {/* annotation layer: same camera, drawn above the light so the captions stay crisp and legible */}
      <CamLayer cam={cam} pageH={PAGE_H} style={{ opacity: 1 - 0.85 * sink }}>
        {/* the caption's own soft shadow in the same space: the filter UI behind it drops to « texture » (Q11) */}
        <div
          style={{
            position: 'absolute', left: NOTE_X - 70, top: NOTE_Y - 40, width: 1060, height: 260, transform: `translateZ(${noteZ - 6}px)`,
            background: 'rgba(2,6,17,.5)', borderRadius: 130, filter: 'blur(34px)', opacity: shade,
          }}
        />
        <div
          style={{
            position: 'absolute', left: NOTE_X, top: NOTE_Y, width: 1100,
            transform: `translateZ(${noteZ}px)`, textShadow: '0 4px 28px rgba(2,6,17,.8)',
          }}
        >
          <Words words={[[{ t: 'Victoire.' }]]} start={WORD_A} size={88} weight={800} color={WIN_GREEN} win={16} />
          <div style={{ height: 14 }} />
          <Words
            words={[[{ t: 'Tu' }], [{ t: 'sais' }], [{ t: 'vraiment' }], [{ t: 'pourquoi', spectrum: true }, { t: ' ?' }]]}
            start={QUESTION_A} size={60} weight={700} gap={3.5} win={18}
          />
        </div>
      </CamLayer>

      <FictiveTag opacity={1 - 0.75 * sink} />
    </AbsoluteFill>
  );
};
