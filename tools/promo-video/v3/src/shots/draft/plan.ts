// Draft shot plan: stage geometry, beat-quantised timing and camera keys (no JSX, so the projection checks in
// QA can import exactly what the shot renders). All frames are LOCAL to the shot (0 = abs 360 = k34).
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
// stage-attached copy, no crossfade); the rest framing below keeps the card ≥ 50 px above it.

// ── camera ──
export type Cam = { cx: number; cy: number; zoom: number; rotX: number; rotY: number; rotZ: number; persp: number };
type Keys = readonly (readonly [number, number])[];
/**
 * 0–16 orbit close-up on the deck (rotY sweeps 30 → 14) · 16–38 pull-back to one overview holding board AND deck
 * · 38–92 near-static overview (≤ 4 px/f) for anticipation and the whole deal, so each throw reads as a hit
 * · 92–108 single lock push once the deck is empty · 108–137 rest: the push hands over to a slow continuous drift
 * (DRIFT) toward the five picks, so the locked board never freezes under full-energy music.
 * Rest framing (zoom 1.1, card centre at screen y ≈ 500): card x 854–1824, y 107–893 → ≥ 50 px above the tag.
 */
export const CAM_KEYS: Record<keyof Cam, Keys> = {
  zoom: [[0, 2.0], [16, 1.94], [38, 0.9], [62, 0.9], [92, 0.92], [108, 1.1]],
  cx: [[0, -70], [16, -50], [38, 80], [62, 90], [92, 96], [108, 96]],
  cy: [[0, 820], [16, 805], [38, 596], [62, 552], [92, 536], [108, 393]],
  rotX: [[0, 44], [16, 40], [38, 16], [62, 8], [92, 5], [108, 0]],
  rotY: [[0, 30], [16, 14], [38, 4], [62, 2], [92, 1], [108, 0]],
  rotZ: [[0, -8], [16, -4], [38, -1], [92, 0]],
  persp: [[0, 1100], [38, 1300], [108, 1400]],
};
/**
 * Rest drift: a slow push (+1.8 % by the cut) about the centre of the five picks (page point `anchor`), eased in
 * from L96 so it is already carrying the frame when the lock push settles at L108 — the camera never stops.
 * Applied as a screen-space transform scale about the anchor's projected point (see Draft.tsx), NOT through the
 * camera's CSS zoom: a slowly changing CSS zoom re-snaps the layout every frame and the board judders ±0.5 px
 * (measured); the CSS zoom stays constant at rest, so text keeps its crisp raster and the push is sub-pixel smooth.
 * Screen speed at the card corners ≈ 0.2 px/f at L108 → ≈ 0.45 px/f at the cut.
 */
export const DRIFT = { from: 96, to: 138, amount: 0.018, anchor: { x: 440, y: 294 } } as const;
export const driftScale = (f: number) => {
  const u = Math.min(1, Math.max(0, (f - DRIFT.from) / (DRIFT.to - DRIFT.from)));
  return 1 + DRIFT.amount * Math.pow(u, 1.5);
};

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

export const camAt = (f: number): Cam => ({
  zoom: spline(f, CAM_KEYS.zoom),
  cx: spline(f, CAM_KEYS.cx),
  cy: spline(f, CAM_KEYS.cy),
  rotX: spline(f, CAM_KEYS.rotX),
  rotY: spline(f, CAM_KEYS.rotY),
  rotZ: spline(f, CAM_KEYS.rotZ),
  persp: spline(f, CAM_KEYS.persp),
});

/** Screen position (1920×1080 px) of a stage point (x, y, z in page px), with StageCam's maths. */
export function project(cam: Cam, x: number, y: number, z = 0): { x: number; y: number } {
  const r = Math.PI / 180;
  let vx = (x - cam.cx) * cam.zoom;
  let vy = (y - cam.cy) * cam.zoom;
  let vz = z * cam.zoom;
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
 * fastest frames of the pull-back (L25–32, peak ≈ 31 px/f → ≈ 1.4 px); the lock push (≤ 24 px/f) and every settled frame
 * stay sharp.
 */
export const camBlur = (f: number) => Math.max(0, Math.min(1.5, (camSpeed(f) - 25) / 4.5));
