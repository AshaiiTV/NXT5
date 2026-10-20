// Generic renderer of a real-UI shot of any film: night backdrop, the capture window under the zoom camera (framed by
// the film's app table), highlight halos, typing overlay, keycap hint and the cursor (move → press → ripple), all on
// the same mapping.
// The window, its halos and the typing overlay are clipped to the working area (areaMask): a zoomed capture never runs
// under the chrome. The cursor and the keycap hint are pointers, drawn unclipped (the chrome stays above them). A capture
// that is still a placeholder is marked as such on every frame it shows.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { camAt, fitOf } from '../camera';
import type { CaptureShot as CaptureShotData, Rect } from '../engine';
import { useFilm } from '../FilmContext';
import { TutoBackdrop } from '../parts/Backdrop';
import { areaMask, layerStateAt, makeView, Stage, StageShadow, stageAlphaAt } from '../parts/Stage';
import { Halo } from '../parts/Halo';
import { cursorOpacity, cursorPoint, CursorLayer } from '../parts/Cursor';
import { KeycapHint, RevealTyping, TypingOverlay } from '../parts/Typing';
import { IconTile, Txt } from '../parts/Glass';
import { AREA, BRAND, COL, IO, ramp, TOP } from '../style';
import { FONT } from '../../theme';

/** Context chip in the night beside the window (left), e.g. « nxt5.org · dans ton navigateur » when the Importer hands
 * over to the site (icon: globe unless the shot names another). It is narration, not a UI label. Its left edge is
 * pinned to the header's (TOP.left) and its top just under the header; it is sized to stay clear of the window
 * (checked against the window edge: it shrinks rather than overlap). */
const ContextChip: React.FC<{ f: number; frameX: number; c: NonNullable<CaptureShotData['context']> }> = ({ f, frameX, c }) => {
  const a = Math.min(ramp(f, c.f0, c.f0 + 12, BRAND), 1 - ramp(f, c.f1, c.f1 + 10, IO));
  if (a <= 0.001) return null;
  // night between the header's left edge and the window (as framed when the chip appears), minus a 24 px gutter;
  // the chip's natural width is about 330 px
  const k = Math.min(1, Math.max(0.6, (frameX - 24 - TOP.left) / 330));
  return (
    <div
      style={{
        position: 'absolute', left: TOP.left, top: AREA.top + 8, opacity: a, transform: `translateX(${(1 - a) * -14}px)`,
        display: 'flex', alignItems: 'center', gap: 14 * k, padding: `${14 * k}px ${20 * k}px ${14 * k}px ${14 * k}px`, borderRadius: 18,
        background: '#161C30', border: `1.5px solid ${COL.panelEdge}`, boxShadow: '0 14px 40px rgba(2,6,17,.5)',
      }}
    >
      <IconTile name={c.icon ?? 'globe'} size={48 * k} tint="cyan" />
      <div>
        <Txt size={30 * k} weight={700}>{c.title}</Txt>
        <Txt size={22 * k} weight={500} color={COL.muted}>{c.sub}</Txt>
      </div>
    </div>
  );
};

/** A capture still awaiting the real screenshot (its captures.json entry has `placeholder: true`, e.g. a Discord screen
 * the owner has not captured yet): hazard stripes around the window and a « PLACEHOLDER » label at the top right of the
 * working area, so that no such frame can pass for final. */
const PlaceholderFrame: React.FC<{ frame: Rect }> = ({ frame }) => (
  <div
    style={{
      position: 'absolute', left: frame.x, top: frame.y, width: frame.w, height: frame.h, boxSizing: 'border-box',
      border: '8px solid', borderImage: 'repeating-linear-gradient(45deg, #FBBF24 0 20px, #111827 20px 40px) 8',
    }}
  />
);
const PlaceholderLabel: React.FC<{ alias: string }> = ({ alias }) => (
  <div
    style={{
      position: 'absolute', right: TOP.right, top: AREA.top + 12, padding: '10px 22px', borderRadius: 10, background: '#FBBF24',
      boxShadow: '0 0 0 3px #111827, 0 12px 32px rgba(2,6,17,.6)', fontFamily: FONT, fontWeight: 800, fontSize: 30,
      letterSpacing: '0.06em', color: '#111827', whiteSpace: 'nowrap',
    }}
  >
    PLACEHOLDER · {alias}
  </div>
);

export const CaptureShot: React.FC<{ shot: CaptureShotData }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { apps, caps } = useFilm();
  const app = apps[shot.app];
  const size = caps.size(shot.layers[0].cap);
  const fit = fitOf(app, size);
  const cam = camAt(shot.cam, f, fit, size, caps.pt);
  const view = makeView(fit, cam, size);
  const state = layerStateAt(shot.layers, f);
  const alpha = stageAlphaAt(shot.layers, f);
  // The typing overlay stays opaque until the capture of the typed state has fully replaced the empty one (its
  // cross-fade included), so the placeholder underneath can never show through during the handover.
  const handover = shot.typing ? shot.layers.find((l) => l.f > shot.typing!.f0) : undefined;
  const typingEnd = shot.typing ? (handover ? handover.f + (handover.xf ?? 0) : shot.typing.f1) : 0;
  const cursorSize = Math.max(40, Math.min(58, 30 * view.S));
  // The cursor is away from its `cut` (it left with the old screen) until its optional `back`; once back, only the
  // clicks from then on draw a ripple.
  const cursor = shot.cursor;
  const returned = !!cursor && cursor.back !== undefined && f >= cursor.back;
  const away = !!cursor && cursor.cut !== undefined && f >= cursor.cut && !returned;
  const shown = state.kind === 'fade' ? state.items.map((it) => it.cap) : [state.from, state.to];
  const placeholder = shown.find((a) => caps.entry(a).placeholder === true);
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      {/* stage (window, overlays, pointers): dips to night around a `dip` layer */}
      <AbsoluteFill style={{ opacity: alpha }}>
        <StageShadow view={view} size={size} />
        <AbsoluteFill style={areaMask(view.frame)}>
          <Stage view={view} state={state} size={size} app={app} />
          {shot.typing ? <TypingOverlay t={shot.typing} f={f} view={view} until={typingEnd} /> : null}
          {shot.reveal ? <RevealTyping r={shot.reveal} f={f} view={view} size={size} /> : null}
          {shot.halos.map((h, i) => {
            // A halo never outlives an instant capture swap (a layout change cut under the click ripple): it would sit
            // on whatever moved under it.
            const swap = shot.layers.find((l) => !l.xf && !l.scroll && !l.dip && l.f > h.f0 && l.f <= h.f1 + 8);
            if (swap && f >= swap.f) return null;
            const r = caps.rect(h.at);
            const pad = h.pad ?? 6;
            const sr = view.rect({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad });
            return <Halo key={i} r={sr} f={f} f0={h.f0} f1={h.f1} radius={(h.radius ?? 8) * view.S + 4} spot={h.spot} circle={h.circle} pulse={h.pulse} cut={h.cut} />;
          })}
          {placeholder ? <PlaceholderFrame frame={view.frame} /> : null}
        </AbsoluteFill>
        {placeholder ? <PlaceholderLabel alias={placeholder} /> : null}
        {shot.context ? <ContextChip f={f} frameX={makeView(fit, camAt(shot.cam, shot.context.f0, fit, size, caps.pt), size).frame.x} c={shot.context} /> : null}
        {(shot.keycaps ?? []).map((k, i) => {
          const [x, y] = view.toScreen(caps.pt(k.at));
          return <KeycapHint key={i} keys={k.keys} f={f} f0={k.f0} f1={k.f1} x={x + k.dx} y={y + k.dy} />;
        })}
        {cursor && !away ? (
          <CursorLayer
            f={f}
            point={view.toScreen(cursorPoint(cursor.start, cursor.moves, f, caps.pt))}
            clicks={returned ? shot.clicks.filter((c) => c.f >= cursor.back!) : shot.clicks}
            size={cursorSize}
            opacity={cursorOpacity(f, returned ? cursor.back! : cursor.show, cursor.hide)}
          />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
