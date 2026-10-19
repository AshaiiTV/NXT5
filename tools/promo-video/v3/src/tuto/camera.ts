// Zoom camera of the tutorial: one implementation shared by the renderer (parts/Stage.tsx, via captures.ts) and the
// QA (checkCamera, run at render time by TutoImporter.tsx and in Node by export-cues.mjs). Pure TypeScript with
// type-only imports, so Node loads it with type stripping and the checks measure exactly what is rendered.
//
// Camera model (PageCam2D maths, screen space): a capture point (cx, cy) sits at the centre of the working area and
// the capture is drawn at screen scale S = FIT[app] × z. Each key is resolved and CLAMPED ON ITS OWN (full-bleed
// framing at its own zoom and slack); the camera then interpolates between clamped keys (centre linear, zoom in log
// space) with the key's easing. Nothing is clamped after the interpolation, so every move keeps its ease-in and
// ease-out: no collapsed pans, no teleport when the window crosses the frame width. A key with `cut` jumps (used only
// while the stage is dipped to night).
import type { CamKey, CaptureShot, Pt, PtRef, Rect, RectRef, Shot, ShotId } from './script';

/** Working area between the step header (top) and the subtitle bar (bottom): real UI and schematics live here. */
export const AREA = { cx: 960, cy: 483, top: 116, bottom: 850 } as const;
export const AREA_H = AREA.bottom - AREA.top;
/** Fit scale (CSS px → screen px) of each app's capture at z = 1: the whole viewport fills the working area height. */
export const FIT = { site: AREA_H / 900, importer: AREA_H / 790 } as const;
export type App = keyof typeof FIT;

/** CSS cubic-bezier easing (same curve as Remotion's Easing.bezier), solved to 1e-7. */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  const bx = (u: number) => ((1 - 3 * x2 + 3 * x1) * u + (3 * x2 - 6 * x1)) * u * u + 3 * x1 * u;
  const by = (u: number) => ((1 - 3 * y2 + 3 * y1) * u + (3 * y2 - 6 * y1)) * u * u + 3 * y1 * u;
  const dx = (u: number) => 3 * (1 - 3 * x2 + 3 * x1) * u * u + 2 * (3 * x2 - 6 * x1) * u + 3 * x1;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) {
      const e = bx(u) - t;
      if (Math.abs(e) < 1e-7) return by(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0;
    let hi = 1;
    u = t;
    for (let i = 0; i < 60; i++) {
      const x = bx(u);
      if (Math.abs(x - t) < 1e-7) break;
      if (x < t) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return by(u);
  };
};
/** io: calm in-out for zooms onto a target (peak speed ≈ 3 × the mean) · out: out-cubic · brand: bezier(0.16, 1, 0.3, 1)
 * · glide: sine in-out (peak ≈ 1.6 × the mean) for long lateral moves and pull-backs. */
export const CAM_EASE = {
  io: cubicBezier(0.45, 0, 0.2, 1),
  out: cubicBezier(0.33, 1, 0.68, 1),
  brand: cubicBezier(0.16, 1, 0.3, 1),
  glide: cubicBezier(0.37, 0, 0.63, 1),
};

// ───────────────────────── capture boxes (captures.json) ─────────────────────────
type Box = Rect & { visible?: Rect };
export type CaptureEntry = { file: string; css: { w: number; h: number }; boxes: Record<string, Box>; gameIdInputText?: unknown };
export type Resolver = { box: (ref: string) => Rect; pt: (p: PtRef) => Pt; rect: (r: RectRef) => Rect; size: (alias: string) => { w: number; h: number } };

/** Box lookup on the parsed captures.json (`ALIAS.boxKey`, the visible part when the box runs under a sticky bar). */
export const makeResolver = (caps: Record<string, CaptureEntry>, ids: Record<string, string>): Resolver => {
  const entry = (a: string) => {
    const c = caps[ids[a]];
    if (!c) throw new Error(`capture inconnue ${a}`);
    return c;
  };
  const box = (ref: string): Rect => {
    const [a, key] = ref.split('.');
    const b = entry(a).boxes[key];
    if (!b) throw new Error(`boîte inconnue ${ref}`);
    const v = b.visible ?? b;
    return { x: v.x, y: v.y, w: v.w, h: v.h };
  };
  const pt = (p: PtRef): Pt => {
    if (Array.isArray(p)) return p;
    const b = box(p.box);
    return [b.x + b.w * (p.ax ?? 0.5) + (p.dx ?? 0), b.y + b.h * (p.ay ?? 0.5) + (p.dy ?? 0)];
  };
  const rect = (r: RectRef): Rect => {
    if (typeof r === 'string') return box(r);
    if ('rect' in r) return r.rect;
    const bs = r.boxes.map(box);
    const x0 = Math.min(...bs.map((b) => b.x));
    const y0 = Math.min(...bs.map((b) => b.y));
    const x1 = Math.max(...bs.map((b) => b.x + b.w));
    const y1 = Math.max(...bs.map((b) => b.y + b.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  return { box, pt, rect, size: (a) => entry(a).css };
};

// ───────────────────────── camera ─────────────────────────
export type Cam = { cx: number; cy: number; z: number };
type Size = { w: number; h: number };

/** Full-bleed framing of one key. Horizontally, once the window plus `slack` px of night on each side is wider than
 * the frame, the centre is clamped so that at most `slack` px of night shows beside the window; below that width the
 * window is centred. Both regimes meet at the threshold (lower bound = upper bound = w / 2), so the framing is
 * continuous in zoom and slack. Vertically the same with the working area and no slack. */
export const clampCentre = ([x, y]: Pt, S: number, size: Size, slack = 0): Pt => {
  const lx = (AREA.cx - slack) / S;
  const ux = size.w - lx;
  const ly = (AREA.cy - AREA.top) / S;
  const uy = size.h - (AREA.bottom - AREA.cy) / S;
  return [lx > ux ? size.w / 2 : Math.min(Math.max(x, lx), ux), ly > uy ? size.h / 2 : Math.min(Math.max(y, ly), uy)];
};

type RKey = { f: number; cx: number; cy: number; z: number; ease: (t: number) => number; cut: boolean };
const cache = new WeakMap<CamKey[], RKey[]>();
const resolveKeys = (keys: CamKey[], app: App, size: Size, pt: (p: PtRef) => Pt): RKey[] => {
  let r = cache.get(keys);
  if (!r) {
    r = keys.map((k) => {
      const [cx, cy] = clampCentre(pt(k.at), FIT[app] * k.z, size, k.slack ?? 0);
      return { f: k.f, cx, cy, z: k.z, ease: CAM_EASE[k.ease ?? 'io'], cut: !!k.cut };
    });
    cache.set(keys, r);
  }
  return r;
};

/** Camera at frame f (already framed: no clamp needed downstream). */
export const camAt = (keys: CamKey[], f: number, app: App, size: Size, pt: (p: PtRef) => Pt): Cam => {
  const ks = resolveKeys(keys, app, size, pt);
  const pick = (k: RKey): Cam => ({ cx: k.cx, cy: k.cy, z: k.z });
  if (f <= ks[0].f) return pick(ks[0]);
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (f < b.f || (f === b.f && !b.cut)) {
      if (b.cut) return pick(a);
      const t = b.ease((f - a.f) / (b.f - a.f));
      return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t) };
    }
  }
  return pick(ks[ks.length - 1]);
};

// ───────────────────────── motion QA ─────────────────────────
/** Ceiling of the speed of the content at the centre of the working area (screen px per frame) and of its change
 * from one frame to the next (px/f²), outside camera cuts. Calm tutorial camera: no whip-pan, no pop, no stutter. */
export const MAX_CAM_SPEED = 35;
export const MAX_CAM_ACCEL = 12;

/** Speed (screen px/f) of the content at the centre of the working area between frames f and f + 1; null across a cut. */
export const centreSpeeds = (shot: CaptureShot, pt: (p: PtRef) => Pt, size: Size): (number | null)[] => {
  const cuts = new Set(shot.cam.filter((k) => k.cut).map((k) => k.f));
  const out: (number | null)[] = [];
  for (let f = 0; f < shot.dur - 1; f++) {
    if (cuts.has(f + 1)) { out.push(null); continue; }
    const a = camAt(shot.cam, f, shot.app, size, pt);
    const b = camAt(shot.cam, f + 1, shot.app, size, pt);
    out.push(Math.hypot(a.cx - b.cx, a.cy - b.cy) * FIT[shot.app] * b.z);
  }
  return out;
};

/** Camera checks of every capture shot (speed and smoothness), with global frame numbers. */
export const checkCamera = (shots: Record<ShotId, Shot>, order: ShotId[], start: Record<ShotId, number>, r: Resolver): string[] => {
  const errors: string[] = [];
  for (const id of order) {
    const s = shots[id];
    if (s.kind !== 'capture') continue;
    for (let i = 1; i < s.cam.length; i++) if (s.cam[i].f <= s.cam[i - 1].f) errors.push(`${id} : clés caméra non croissantes`);
    const sp = centreSpeeds(s, r.pt, r.size(s.layers[0].cap));
    sp.forEach((v, f) => {
      if (v !== null && v > MAX_CAM_SPEED) errors.push(`${id} f${f} (g${start[id] + f}) : caméra à ${v.toFixed(1)} px/f (> ${MAX_CAM_SPEED})`);
      const p = sp[f - 1];
      if (f > 0 && v !== null && p !== null && p !== undefined && Math.abs(v - p) > MAX_CAM_ACCEL) {
        errors.push(`${id} f${f} (g${start[id] + f}) : à-coup caméra ${p.toFixed(1)} → ${v.toFixed(1)} px/f (> ${MAX_CAM_ACCEL})`);
      }
    });
  }
  return errors;
};
