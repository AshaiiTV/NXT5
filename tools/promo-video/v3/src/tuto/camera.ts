// Zoom camera and cursor path of the tutorials: one implementation shared by the renderer (shots/CaptureShot.tsx,
// parts/Stage.tsx, parts/Cursor.tsx) and the QA (checkCamera and checkFraming, run by each film's composition and in
// Node by export-cues.mjs). Pure TypeScript with type-only imports, so Node loads it with type stripping and the checks
// measure exactly what is rendered.
//
// Camera model (PageCam2D maths, screen space): a capture point (cx, cy) sits at the centre of the working area and
// the capture is drawn at screen scale S = fit × z (fitOf: the app's fit height fills the working area). Each key is
// resolved and CLAMPED ON ITS OWN (full-bleed framing at its own zoom and slack); the camera then interpolates between
// clamped keys (centre linear, zoom in log space) with the key's easing. Nothing is clamped after the interpolation,
// so every move keeps its ease-in and ease-out: no collapsed pans, no teleport when the window crosses the frame width.
// A key with `cut` jumps (used only while the stage is dipped to night).
import type { AppSpec, CamKey, CaptureShot, Film, Move, Pt, PtRef, Rect, RectRef } from './engine';

/** Working area between the step header (top) and the subtitle bar (bottom): real UI and schematics live here. */
export const AREA = { cx: 960, cy: 483, top: 116, bottom: 850 } as const;
export const AREA_H = AREA.bottom - AREA.top;
/** Soft edge (px) of the working-area clip when a zoomed capture is taller than the area (parts/Stage.tsx areaMask).
 * Click points stay at least this far inside the area and the frame's sides (checkFraming). */
export const FEATHER = 24;
/** Fit scale (CSS px → screen px) of a capture at z = 1: the app's fit height (each capture's own height when the app
 * has none) fills the working area height. */
export const fitOf = (app: AppSpec, size: { w: number; h: number }) => AREA_H / (app.fitH ?? size.h);

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
/** One capture of captures.json; other keys hold per-capture measurements (e.g. a field's text style, Typing). */
export type CaptureEntry = { file: string; css: { w: number; h: number }; boxes: Record<string, Box>; [meta: string]: unknown };
export type Resolver = {
  entry: (alias: string) => CaptureEntry; box: (ref: string) => Rect; pt: (p: PtRef) => Pt; rect: (r: RectRef) => Rect;
  size: (alias: string) => { w: number; h: number };
};

/** Box lookup on a film's parsed captures.json (`ALIAS.boxKey`, the visible part when the box runs under a sticky
 * bar). */
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
  return { entry, box, pt, rect, size: (a) => entry(a).css };
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
const resolveKeys = (keys: CamKey[], fit: number, size: Size, pt: (p: PtRef) => Pt): RKey[] => {
  let r = cache.get(keys);
  if (!r) {
    r = keys.map((k) => {
      const [cx, cy] = clampCentre(pt(k.at), fit * k.z, size, k.slack ?? 0);
      return { f: k.f, cx, cy, z: k.z, ease: CAM_EASE[k.ease ?? 'io'], cut: !!k.cut };
    });
    cache.set(keys, r);
  }
  return r;
};

/** Camera at frame f (already framed: no clamp needed downstream). `fit`: fitOf the shot's app and capture size. */
export const camAt = (keys: CamKey[], f: number, fit: number, size: Size, pt: (p: PtRef) => Pt): Cam => {
  const ks = resolveKeys(keys, fit, size, pt);
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

// ───────────────────────── cursor path ─────────────────────────
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [k[0] * p0[0] + k[1] * p1[0] + k[2] * p2[0] + k[3] * p3[0], k[0] * p0[1] + k[1] * p1[1] + k[2] * p2[1] + k[3] * p3[1]];
};

/** Glide from a to b with a gentle bow (8 % of the distance, max 50 px), eased in-out. */
const glide = (a: Pt, b: Pt, t: number, ease: (t: number) => number): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d;
  let ny = dx / d;
  if (nx + ny < 0) { nx = -nx; ny = -ny; }
  const bend = Math.min(50, d * 0.08);
  const p1: Pt = [a[0] + dx * 0.25 + nx * bend, a[1] + dy * 0.25 + ny * bend];
  const p2: Pt = [a[0] + dx * 0.72 + nx * bend * 0.5, a[1] + dy * 0.72 + ny * bend * 0.5];
  return bez(a, p1, p2, b, ease(t));
};

/** Cursor point (page space) at frame f. Works for capture points (resolve: the film's captures) and for schematic
 * (screen) points alike. `ease`: the glide's in-out curve (parts/Cursor.tsx passes the renderer's IO, Remotion's
 * solver of the same bezier as CAM_EASE.io). */
export const cursorPoint = (start: PtRef, moves: Move[], f: number, resolve: (p: PtRef) => Pt, ease: (t: number) => number = CAM_EASE.io): Pt => {
  let p = resolve(start);
  for (const m of moves) {
    if (f <= m.f) return p;
    const to = resolve(m.to);
    if (f < m.f + m.dur) return glide(p, to, (f - m.f) / m.dur, ease);
    p = to;
  }
  return p;
};

// ───────────────────────── motion QA ─────────────────────────
/** Ceiling of the speed of the content at the centre of the working area (screen px per frame) and of its change
 * from one frame to the next (px/f²), outside camera cuts. Calm tutorial camera: no whip-pan, no pop, no stutter. */
export const MAX_CAM_SPEED = 35;
export const MAX_CAM_ACCEL = 12;

/** Speed (screen px/f) of the content at the centre of the working area between frames f and f + 1; null across a cut. */
export const centreSpeeds = (shot: CaptureShot, fit: number, pt: (p: PtRef) => Pt, size: Size): (number | null)[] => {
  const cuts = new Set(shot.cam.filter((k) => k.cut).map((k) => k.f));
  const out: (number | null)[] = [];
  for (let f = 0; f < shot.dur - 1; f++) {
    if (cuts.has(f + 1)) { out.push(null); continue; }
    const a = camAt(shot.cam, f, fit, size, pt);
    const b = camAt(shot.cam, f + 1, fit, size, pt);
    out.push(Math.hypot(a.cx - b.cx, a.cy - b.cy) * fit * b.z);
  }
  return out;
};

/** Camera checks of every capture shot of a film (sharpness, speed and smoothness), with global frame numbers. */
export const checkCamera = (film: Film, r: Resolver): string[] => {
  const errors: string[] = [];
  const { shots, order, start } = film;
  for (const id of order) {
    const s = shots[id];
    if (s.kind !== 'capture') continue;
    const app = film.apps[s.app];
    if (!app) { errors.push(`${id} : app « ${s.app} » absente de la table apps du film`); continue; }
    for (let i = 1; i < s.cam.length; i++) if (s.cam[i].f <= s.cam[i - 1].f) errors.push(`${id} : clés caméra non croissantes`);
    const size = r.size(s.layers[0].cap);
    const fit = fitOf(app, size);
    // The stage draws every capture of the shot at the first one's size (e.g. native screenshots must share one window
    // size).
    for (const l of s.layers) {
      const o = r.size(l.cap);
      if (o.w !== size.w || o.h !== size.h) errors.push(`${id} : ${l.cap} ${o.w}×${o.h} ≠ ${s.layers[0].cap} ${size.w}×${size.h} (même taille pour toutes les captures d’un plan)`);
    }
    // Sharpness: the capture is never drawn larger than its texture (S = fit × z ≤ density). The zoom moves between
    // keys without overshoot (log-space interpolation, easings within 0..1), so its extremes are the keys.
    for (const k of s.cam) {
      if (fit * k.z > app.density + 1e-9) errors.push(`${id} clé f${k.f} : échelle ${(fit * k.z).toFixed(3)} (z ${k.z}) > ${app.density} (textures ${app.density}x)`);
    }
    const sp = centreSpeeds(s, fit, r.pt, size);
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

/** Framing checks of every capture shot of a film: each click point (where the cursor rests, at the click) lies inside
 * the working area, FEATHER px clear of its soft top and bottom edges and of the frame's sides; each halo at full
 * strength, until it fades or an instant capture swap removes it, stays inside the working area and the frame; for a
 * film that asks for it (FilmDef.cursorInArea), the whole cursor path too. Local frames, global ones in brackets. */
export const checkFraming = (film: Film, r: Resolver): string[] => {
  const errors: string[] = [];
  const { shots, order, start } = film;
  for (const id of order) {
    const s = shots[id];
    if (s.kind !== 'capture' || !film.apps[s.app]) continue;
    const size = r.size(s.layers[0].cap);
    const fit = fitOf(film.apps[s.app], size);
    const toScreen = (f: number, [x, y]: Pt): Pt => {
      const c = camAt(s.cam, f, fit, size, r.pt);
      const S = fit * c.z;
      return [AREA.cx + (x - c.cx) * S, AREA.cy + (y - c.cy) * S];
    };
    const off = ([x, y]: Pt, m: number) => x < m || x > 1920 - m || y < AREA.top + m || y > AREA.bottom - m;
    const fmt = ([x, y]: Pt) => `(${Math.round(x)}, ${Math.round(y)})`;
    for (const c of s.clicks) {
      if (!s.cursor) continue;
      const mv = s.cursor.moves.filter((m) => m.f + m.dur <= c.f).pop();
      const p = toScreen(c.f, r.pt(mv ? mv.to : s.cursor.start));
      if (off(p, FEATHER)) errors.push(`${id} f${c.f} (g${start[id] + c.f}) : clic ${c.label} hors du cadre utile ${fmt(p)}`);
    }
    for (const h of s.halos) {
      const swap = s.layers.find((l) => !l.xf && !l.scroll && !l.dip && l.f > h.f0 && l.f <= h.f1 + 8);
      const end = swap ? Math.min(h.f1, swap.f - 1) : h.f1;
      const b = r.rect(h.at);
      const pad = h.pad ?? 6;
      for (let f = h.cut ? h.f0 : h.f0 + 9; f <= end; f++) {
        const a = toScreen(f, [b.x - pad, b.y - pad]);
        const z = toScreen(f, [b.x + b.w + pad, b.y + b.h + pad]);
        if (off(a, 0) || off(z, 0)) {
          errors.push(`${id} f${f} (g${start[id] + f}) : halo f${h.f0}–f${h.f1} hors du cadre utile ${fmt(a)} → ${fmt(z)}`);
          break;
        }
      }
    }
    // The cursor on every frame it is drawn (opacity > 0, as in shots/CaptureShot.tsx: after its 8 f fade-in from
    // `show`, or from `back` once back; away from `cut` until `back`; until its 8 f fade-out from `hide` ends). The
    // arrow is drawn unclipped, its body within 40 px right of and 50 px below its tip: the tip stays FEATHER px clear
    // of the frame's left edge, 2 × FEATHER px of its right edge, and inside the working area, FEATHER px above its
    // bottom so the arrow never runs under the subtitle bar.
    const c = s.cursor;
    if (film.cursorInArea && c) {
      for (let f = 0; f < s.dur; f++) {
        const returned = c.back !== undefined && f >= c.back;
        const away = c.cut !== undefined && f >= c.cut && !returned;
        if (away || f <= (returned ? c.back! : c.show) || (c.hide !== undefined && f >= c.hide + 8)) continue;
        const p = toScreen(f, cursorPoint(c.start, c.moves, f, r.pt));
        if (p[0] < FEATHER || p[0] > 1920 - 2 * FEATHER || p[1] < AREA.top || p[1] > AREA.bottom - FEATHER) {
          errors.push(`${id} f${f} (g${start[id] + f}) : curseur hors du cadre utile ${fmt(p)}`);
          break;
        }
      }
    }
  }
  return errors;
};
