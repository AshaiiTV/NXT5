// Zoom camera over a real capture (PageCam2D maths, screen-space rendering).
// The capture is drawn as a window whose on-screen rectangle is computed every frame: the <Img> is laid out at its
// final pixel size (no transform scale), so Chromium samples the 2x texture directly and text stays crisp at every
// zoom (Q2). Screen scale S = fit × z is kept ≤ 2 by the script. Overlays (cursor, halo, typing) use the same mapping.
// The camera path itself (keys framed one by one, then interpolated) is in ../camera.ts, shared with the QA.
// Once the window is taller than the working area, it is clipped to the area (areaMask) so that no real UI ever runs
// under the step header, the data tag or the subtitle bar.
import React from 'react';
import { Img } from 'remotion';
import { capSrc, DIALOG_BAND, dialogScroll } from '../captures';
import type { Cam } from '../camera';
import type { CapAlias, Layer, Pt, Rect } from '../script';
import { AREA, FEATHER, FIT, IO, lerp, ramp } from '../style';

export type View = { S: number; toScreen: (p: Pt) => Pt; rect: (r: Rect) => Rect; frame: Rect };
/** Screen mapping of a framed camera (camera.ts camAt: already clamped key by key, nothing to clamp here). */
export const makeView = (app: 'site' | 'importer', cam: Cam, size: { w: number; h: number }): View => {
  const S = FIT[app] * cam.z;
  const toScreen = ([x, y]: Pt): Pt => [AREA.cx + (x - cam.cx) * S, AREA.cy + (y - cam.cy) * S];
  const rect = (r: Rect): Rect => {
    const [x, y] = toScreen([r.x, r.y]);
    return { x, y, w: r.w * S, h: r.h * S };
  };
  return { S, toScreen, rect, frame: rect({ x: 0, y: 0, w: size.w, h: size.h }) };
};

/** How far (px, 0..FEATHER) the window runs past the top / bottom of the working area. */
export const overflowOf = (frame: Rect) => ({
  top: Math.min(FEATHER, Math.max(0, AREA.top - frame.y)),
  bottom: Math.min(FEATHER, Math.max(0, frame.y + frame.h - AREA.bottom)),
});

/** Vertical clip of everything drawn on the capture (window, halos, typing). While the window fits in the working
 * area the mask is transparent to it; as the window grows past an edge, a FEATHER-px soft edge slides in so the
 * capture fades out inside the area, never under the chrome. Continuous in the zoom (no pop). */
export const areaMask = (frame: Rect): React.CSSProperties => {
  const o = overflowOf(frame);
  const t0 = AREA.top - FEATHER + o.top;
  const t1 = AREA.top + o.top;
  const b1 = AREA.bottom - o.bottom;
  const b0 = AREA.bottom + FEATHER - o.bottom;
  const g = `linear-gradient(180deg, transparent ${t0}px, #000 ${t1}px, #000 ${b1}px, transparent ${b0}px)`;
  return { WebkitMaskImage: g, maskImage: g };
};

/** Which captures are visible at frame f, with their opacity, or a scroll composite between two captures. */
export type LayerState =
  | { kind: 'fade'; items: { cap: CapAlias; o: number }[] }
  | { kind: 'scroll'; from: CapAlias; to: CapAlias; t: number };
export const layerStateAt = (layers: Layer[], f: number): LayerState => {
  let i = 0;
  while (i < layers.length - 1 && f >= layers[i + 1].f) i++;
  const cur = layers[i];
  const prev = layers[i - 1];
  if (prev && cur.scroll && f < cur.f + cur.scroll) return { kind: 'scroll', from: prev.cap, to: cur.cap, t: ramp(f, cur.f, cur.f + cur.scroll, IO) };
  if (prev && cur.xf && f < cur.f + cur.xf) return { kind: 'fade', items: [{ cap: prev.cap, o: 1 }, { cap: cur.cap, o: ramp(f, cur.f, cur.f + cur.xf) }] };
  return { kind: 'fade', items: [{ cap: cur.cap, o: 1 }] };
};

/** Opacity of the whole stage (window, halos, overlays, cursor) over the night backdrop: 1, except around a layer
 * with `dip`, where the outgoing page fades to night over the `dip` frames before it and the new page fades in over
 * the `dip` frames after it (no double exposure of two different pages; the camera may cut while at night). */
export const stageAlphaAt = (layers: Layer[], f: number) => {
  let a = 1;
  for (const l of layers) {
    if (!l.dip) continue;
    if (f >= l.f - l.dip && f < l.f) a = Math.min(a, 1 - ramp(f, l.f - l.dip, l.f, IO));
    else if (f >= l.f && f < l.f + l.dip) a = Math.min(a, ramp(f, l.f, l.f + l.dip, IO));
  }
  return a;
};

const img = (a: CapAlias, style: React.CSSProperties) => <Img key={a + JSON.stringify(style.top ?? 0)} src={capSrc(a)} style={{ position: 'absolute', display: 'block', ...style }} />;

/** The window's drop shadow, drawn outside the area clip (an outer box-shadow paints only outside the box). It fades
 * out as the window outgrows the working area, where its edges are clipped anyway. */
export const StageShadow: React.FC<{ view: View; size: { w: number; h: number } }> = ({ view, size }) => {
  const o = overflowOf(view.frame);
  const a = 1 - Math.max(o.top, o.bottom) / FEATHER;
  if (a <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute', left: view.frame.x, top: view.frame.y, width: size.w * view.S, height: size.h * view.S,
        borderRadius: 12 * view.S, boxShadow: '0 30px 90px rgba(2,6,17,.62)', opacity: a,
      }}
    />
  );
};

/** The window: rounded frame, violet hairline, capture layers (drawn inside the area clip). */
export const Stage: React.FC<{ view: View; state: LayerState; size: { w: number; h: number } }> = ({ view, state, size }) => {
  const { frame, S } = view;
  const W = size.w * S;
  const H = size.h * S;
  const radius = 12 * S;
  let content: React.ReactNode;
  if (state.kind === 'fade') {
    content = state.items.map((it, k) => (
      <div key={`${it.cap}-${k}`} style={{ position: 'absolute', inset: 0, opacity: it.o }}>
        {img(it.cap, { left: 0, top: 0, width: W, height: H })}
      </div>
    ));
  } else {
    // Pixel-true scroll of the import dialog: outside the dialog's scrolling band both captures are identical (sticky
    // header and footer, page behind); inside it the content of A slides up and B's content follows exactly below.
    const sA = dialogScroll(state.from);
    const sB = dialogScroll(state.to);
    const sigma = lerp(sA, sB, state.t);
    const band = DIALOG_BAND;
    const shiftA = -(sigma - sA); // CSS px applied to A inside the band
    const shiftB = sB - sigma;
    const seam = band.y + band.h + shiftA; // A's band ends here (CSS y)
    const bandStyle = (y0: number, y1: number): React.CSSProperties => ({
      position: 'absolute', left: band.x * S, top: y0 * S, width: band.w * S, height: Math.max(0, y1 - y0) * S, overflow: 'hidden',
    });
    content = (
      <>
        {img(state.to, { left: 0, top: 0, width: W, height: H })}
        <div style={bandStyle(band.y, Math.min(seam, band.y + band.h))}>
          {img(state.from, { left: -band.x * S, top: (-band.y + shiftA) * S, width: W, height: H })}
        </div>
        <div style={bandStyle(Math.max(seam, band.y), band.y + band.h)}>
          {img(state.to, { left: -band.x * S, top: (-Math.max(seam, band.y) + shiftB) * S, width: W, height: H })}
        </div>
      </>
    );
  }
  return (
    <div
      style={{
        position: 'absolute', left: frame.x, top: frame.y, width: W, height: H, borderRadius: radius, overflow: 'hidden',
        boxShadow: '0 0 0 1.5px rgba(196,181,253,.30)', backgroundColor: '#0B1220',
      }}
    >
      {content}
    </div>
  );
};

/** Screen-space overlay layer above the stage. */
export const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{children}</div>
);

