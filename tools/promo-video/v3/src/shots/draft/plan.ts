// Draft shot plan: stage geometry, beat-quantised timing and camera keys (no JSX, so the projection checks in
// QA can import exactly what the shot renders). All frames are LOCAL to the shot (0 = abs 360 = k34).
import { Easing } from 'remotion';
import { localBeat, SHOTS } from '../../timeline';
import layout from '../../layout.json';

export const B = (k: number) => localBeat(SHOTS.draft, k);

// ── stage (page space = CSS px of the draft card, 881×714; textures are 2x) ──
export const BOARD = { w: layout.draft.w, h: layout.draft.h };
export const BOARD_R = 19; // texture corner radius ≈ 20.5 CSS px; slightly smaller keeps the 1px border inside the clip
export const CHAMPS = [1, 2, 3, 4, 5].map((i) => {
  const c = layout[`champ-${i}` as 'champ-1'];
  return { file: c.file, x: c.offset.x, y: c.offset.y, w: c.w, h: c.h };
});
export const N = CHAMPS.length;
export const DECK = { x: 111, y: 867 }; // deck centre: on the table, just below the card's left edge (under slot 1)
export const STACK_STEP = 10; // 5 cards → top card at z 50: a chunky physical deck (Q7 perceptible height)

// ── timing (landings = touch-down at cue + DIVE) ──
export const DIVE = 8;
export const SETTLE = 4;
// hard-accelerating cadence quantised to the music: 1.5 → 1 → ½ → ¼ beat (gaps 21 → 14 → 7 → 3 f)
export const LAND = [B(38), B(39.5), B(40.5), B(41), B(41.25)]; // 55, 76, 90, 97, 100 (abs 415/436/450/457/460)
export const CUE = LAND.map((l) => l - DIVE); // 47, 68, 82, 89, 92
// anticipation on a settled camera (pull-back done at 38): pile presses away from the slots, top card pulls back
export const ANT = { from: CUE[0] - 10, to: CUE[0], pileDown: 50, topPull: 34 };
export const LOCK = LAND[N - 1] + SETTLE; // 104: last card seated
export const FILLED = [LOCK, LOCK + 8] as const; // crossfade to the real filled texture (pixel-exact rest)
// header + pool/note dimmed so the five picks are the hero; starts as the last card touches, during the push
export const HERO_DIM = [LAND[N - 1], LAND[N - 1] + 10] as const;
export const TITLE_START = B(34.5); // 7
export const TABLE_FADE = [20, 46] as const; // table light hands over to the frontal ambient pools
export const BOARD_DIM = [18, 36] as const; // board dimmed while only the deck is lit, "lights up" on the pull-back
// Données fictives: ONE screen-space <FictiveTag /> in the film's shared bottom-right slot for the whole shot (no
// stage-attached copy, no crossfade); the row framing fades the card out above it (ROW_MASK), so it sits on the night.

// ── camera ──
/** `zoom` is the CSS zoom (raster scale); `s` is an extra transform scale on top of it (1 until the row push). */
export type Cam = { cx: number; cy: number; zoom: number; rotX: number; rotY: number; rotZ: number; persp: number; s: number };
type Keys = readonly (readonly [number, number])[];
/**
 * 0–16 orbit close-up on the deck (rotY sweeps 30 → 14) · 16–38 pull-back to one overview holding board AND deck
 * · 38–92 near-static overview (≤ 4 px/f) for anticipation and the whole deal, so each throw reads as a hit
 * · 92–108 lock push once the deck is empty (lands flat, zoom 1.1, whole board in frame) · 108–125 ROW push onto the
 * five picks, landing ON k43 · 125–138 gentle drift to the cut (see ROW / DRIFT below).
 */
export const CAM_KEYS: Record<Exclude<keyof Cam, 's'>, Keys> = {
  zoom: [[0, 2.0], [16, 1.94], [38, 0.9], [62, 0.9], [92, 0.92], [108, 1.1]],
  cx: [[0, -70], [16, -50], [38, 80], [62, 90], [92, 96], [108, 96]],
  cy: [[0, 820], [16, 805], [38, 596], [62, 552], [92, 536], [108, 393]],
  rotX: [[0, 44], [16, 40], [38, 16], [62, 8], [92, 5], [108, 0]],
  rotY: [[0, 30], [16, 14], [38, 4], [62, 2], [92, 1], [108, 0]],
  rotZ: [[0, -8], [16, -4], [38, -1], [92, 0]],
  persp: [[0, 1100], [38, 1300], [108, 1400]],
};

// ── row push (review 2, N9/N2: the k43 hit sat on a rest and champion art was never shown big) ──
/** The five slots on the card (layout draft.boxes.roster), page px. */
export const ROW = { x0: 33.52, x1: 847.52, y0: 171.45, y1: 416.45 };
export const PUSH_ROW = { from: 108, to: B(43) } as const; // 108 → 125 (k43 = abs 485)
/** Landing framing: the row spans 56 % of the frame width (1075 px, cards ≈ 205 × 323 px), Gnar's left edge 59 px
 * clear of the caption (« Pense ta draft » ends at x 701), Braum 85 px inside the frame (review 3, p4), row centred on the
 * caption's height (y 500). Textures are 2x, so 1.42 is still a downscale: champion art stays crisp. */
export const ROW_SCREEN = { left: 760, width: 1075, cy: 500 };
export const Z_HIT = ROW_SCREEN.width / (ROW.x1 - ROW.x0); // 1.4165
/** In-out with a firm landing: starts on k42 (L111, ≈ 2.4 px/f at the row edge), peaks on k42.5 (L118, ≈ 20 px/f),
 * still travels ≈ 5 / 2.7 px/f two and one frames before k43 and stops on it (0.8 px/f at L125). */
const ROW_EASE = Easing.bezier(0.35, 0.12, 0.3, 1); // review 3: leaves L108 already moving (no dead stop after the lock push) and lands firmly on k43
/**
 * Rest drift after the landing: +0.8 % about the row centre (edges ≈ 0.35 → 0.45 px/f), eased in from 0 so the
 * landing reads, never freezing under full-energy music. Like the push, it is a transform scale over a FIXED CSS
 * zoom: a slowly changing CSS zoom re-snaps the layout every frame and the board judders ±0.5 px (measured).
 */
export const DRIFT = { from: PUSH_ROW.to, to: 138, amount: 0.008 } as const;
/** Screen masks of the row framing (Draft.tsx): the card's left padding fades out before the caption, its lower part
 * (pool + note, recessed first) fades out above the « Données fictives » slot. Ramped in during the push. */
export const ROW_MASK = { from: 110, to: 121, left: [700, 738] as const, bottom: [688, 830] as const };
/** Pool + note recess deepens during the row push (lighting only, inside the real UI). */
export const DEEP_DIM = [112, 124] as const;
/**
 * Monotone cubic Hermite through [frame, value] keys (Fritsch–Butland tangents: no overshoot between keys).
 * The first key keeps its secant velocity (the shot opens already moving after the hard cut); the last key has
 * zero velocity (the camera settles).
 */
export function spline(f: number, keys: Keys): number {
  const n = keys.length;
  if (f <= keys[0][0]) return keys[0][1];
  if (f >= keys[n - 1][0]) return keys[n - 1][1];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(keys[i + 1][0] - keys[i][0]);
    d.push((keys[i + 1][1] - keys[i][1]) / h[i]);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  let i = 0;
  while (i < n - 2 && f > keys[i + 1][0]) i++;
  const t = (f - keys[i][0]) / h[i];
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * keys[i][1] +
    (t3 - 2 * t2 + t) * h[i] * m[i] +
    (-2 * t3 + 3 * t2) * keys[i + 1][1] +
    (t3 - t2) * h[i] * m[i + 1]
  );
}

const keyCam = (f: number): Cam => ({
  zoom: spline(f, CAM_KEYS.zoom),
  cx: spline(f, CAM_KEYS.cx),
  cy: spline(f, CAM_KEYS.cy),
  rotX: spline(f, CAM_KEYS.rotX),
  rotY: spline(f, CAM_KEYS.rotY),
  rotZ: spline(f, CAM_KEYS.rotZ),
  persp: spline(f, CAM_KEYS.persp),
  s: 1,
});

// From L108 the stage is flat (rot 0) and the camera is a 2D similarity: screen = A + k·page.
type Lin = { k: number; ax: number; ay: number };
const L0: Lin = (() => {
  const c = keyCam(PUSH_ROW.from);
  return { k: c.zoom, ax: 960 - c.cx * c.zoom, ay: 540 - c.cy * c.zoom };
})();
const LH: Lin = {
  k: Z_HIT,
  ax: ROW_SCREEN.left - ROW.x0 * Z_HIT,
  ay: ROW_SCREEN.cy - ((ROW.y0 + ROW.y1) / 2) * Z_HIT,
};
/** Fixed screen point of the row push (a pure dolly-in: the L108 framing scales about it into the landing framing). */
const R_H = L0.k / LH.k;
export const PUSH_FIX = { x: (L0.ax - R_H * LH.ax) / (1 - R_H), y: (L0.ay - R_H * LH.ay) / (1 - R_H) };
/** Drift anchor: the row centre at the landing. */
export const DRIFT_ANCHOR = { x: ROW_SCREEN.left + ROW_SCREEN.width / 2, y: ROW_SCREEN.cy };

const rowLin = (f: number): Lin => {
  if (f <= PUSH_ROW.to) {
    const t = Math.min(1, Math.max(0, (f - PUSH_ROW.from) / (PUSH_ROW.to - PUSH_ROW.from)));
    const k = L0.k * Math.pow(LH.k / L0.k, ROW_EASE(t)); // log-zoom: perceptually even
    const r = k / L0.k;
    return { k, ax: PUSH_FIX.x * (1 - r) + r * L0.ax, ay: PUSH_FIX.y * (1 - r) + r * L0.ay };
  }
  const u = Math.min(1, (f - DRIFT.from) / (DRIFT.to - DRIFT.from));
  const d = 1 + DRIFT.amount * Math.pow(u, 1.3);
  return { k: LH.k * d, ax: DRIFT_ANCHOR.x * (1 - d) + d * LH.ax, ay: DRIFT_ANCHOR.y * (1 - d) + d * LH.ay };
};

/**
 * Camera at local frame f. Up to L108: the keyed 3D camera (CSS zoom). From L108: the CSS zoom is FIXED at the landing
 * zoom (the card is rasterised once, at 1.42, from 2x textures) and the push + drift are a transform scale `s` on top
 * (0.78 → 1 → 1.008): sub-pixel smooth, no per-frame layout re-snap, and a downscale until the landing (crisp).
 */
export const camAt = (f: number): Cam => {
  if (f <= PUSH_ROW.from) return keyCam(f);
  const l = rowLin(f);
  return { zoom: Z_HIT, s: l.k / Z_HIT, cx: (960 - l.ax) / l.k, cy: (540 - l.ay) / l.k, rotX: 0, rotY: 0, rotZ: 0, persp: 1400 };
};

/** Screen position (1920×1080 px) of a stage point (x, y, z in page px), with StageCam's maths. */
export function project(cam: Cam, x: number, y: number, z = 0): { x: number; y: number } {
  const r = Math.PI / 180;
  const zs = cam.zoom * cam.s;
  let vx = (x - cam.cx) * zs;
  let vy = (y - cam.cy) * zs;
  let vz = z * zs;
  // transform: rotateY · rotateX · rotateZ → the point gets rotateZ first
  const cz = Math.cos(cam.rotZ * r), sz = Math.sin(cam.rotZ * r);
  [vx, vy] = [cz * vx - sz * vy, sz * vx + cz * vy];
  const cxr = Math.cos(cam.rotX * r), sxr = Math.sin(cam.rotX * r);
  [vy, vz] = [cxr * vy - sxr * vz, sxr * vy + cxr * vz];
  const cyr = Math.cos(cam.rotY * r), syr = Math.sin(cam.rotY * r);
  [vx, vz] = [cyr * vx + syr * vz, -syr * vx + cyr * vz];
  const p = cam.persp * cam.zoom;
  const k = p / (p - vz);
  return { x: 960 + vx * k, y: 540 + vy * k };
}

/** Screen speed (px/f) of the stage under the camera: max of the board centre and the deck centre. */
export function camSpeed(f: number): number {
  if (f <= 0) return camSpeed(1);
  const a = camAt(f - 1);
  const b = camAt(f);
  const d = (x: number, y: number) => {
    const p = project(a, x, y);
    const q = project(b, x, y);
    return Math.hypot(q.x - p.x, q.y - p.y);
  };
  return Math.max(d(BOARD.w / 2, BOARD.h / 2), d(DECK.x, DECK.y));
}
/**
 * Cheap camera motion blur (recipe: ≥ 30 px/f strobes at 30 fps): an isotropic blur that only appears on the
 * fastest frames of the pull-back (L25–32, peak ≈ 31 px/f → ≈ 1.4 px); the lock push (≤ 24 px/f), the row push (the
 * empty deck position no longer counts; the row itself moves ≤ 20 px/f) and every settled frame stay sharp.
 */
export const camBlur = (f: number) => (f >= PUSH_ROW.from ? 0 : Math.max(0, Math.min(1.5, (camSpeed(f) - 25) / 4.5)));
