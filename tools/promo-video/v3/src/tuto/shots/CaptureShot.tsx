// Generic renderer of a real-UI shot from the script: night backdrop, the capture window under the zoom camera,
// highlight halos, typing overlay, keycap hint and the cursor (move → press → ripple), all on the same mapping.
// The window, its halos and the typing overlay are clipped to the working area (areaMask): a zoomed capture never runs
// under the chrome. The cursor and the keycap hint are pointers, drawn unclipped (the chrome stays above them).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { camAt, capSize, resolvePt, resolveRect } from '../captures';
import type { CaptureShot as CaptureShotData } from '../script';
import { TutoBackdrop } from '../parts/Backdrop';
import { areaMask, layerStateAt, makeView, Stage, StageShadow, stageAlphaAt } from '../parts/Stage';
import { Halo } from '../parts/Halo';
import { cursorOpacity, cursorPoint, CursorLayer } from '../parts/Cursor';
import { KeycapHint, RevealTyping, TypingOverlay } from '../parts/Typing';
import { IconTile, Txt } from '../parts/Glass';
import { AREA, BRAND, COL, IO, ramp, TOP } from '../style';

/** Context chip in the night beside the window (left), e.g. « nxt5.org · dans ton navigateur » when the Importer hands
 * over to the site. It is narration, not a UI label. Its left edge is pinned to the header's (TOP.left) and its top
 * just under the header; it is sized to stay clear of the window (checked against the window edge: it shrinks rather
 * than overlap). */
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
      <IconTile name="globe" size={48 * k} tint="cyan" />
      <div>
        <Txt size={30 * k} weight={700}>{c.title}</Txt>
        <Txt size={22 * k} weight={500} color={COL.muted}>{c.sub}</Txt>
      </div>
    </div>
  );
};

export const CaptureShot: React.FC<{ shot: CaptureShotData }> = ({ shot }) => {
  const f = useCurrentFrame();
  const size = capSize(shot.layers[0].cap);
  const cam = camAt(shot.cam, f, shot.app, size);
  const view = makeView(shot.app, cam, size);
  const state = layerStateAt(shot.layers, f);
  const alpha = stageAlphaAt(shot.layers, f);
  // The typing overlay stays opaque until the capture of the typed state has fully replaced the empty one (its
  // cross-fade included), so the placeholder underneath can never show through during the handover.
  const handover = shot.typing ? shot.layers.find((l) => l.f > shot.typing!.f0) : undefined;
  const typingEnd = shot.typing ? (handover ? handover.f + (handover.xf ?? 0) : shot.typing.f1) : 0;
  const cursorSize = Math.max(40, Math.min(58, 30 * view.S));
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      {/* stage (window, overlays, pointers): dips to night around a `dip` layer */}
      <AbsoluteFill style={{ opacity: alpha }}>
        <StageShadow view={view} size={size} />
        <AbsoluteFill style={areaMask(view.frame)}>
          <Stage view={view} state={state} size={size} />
          {shot.typing ? <TypingOverlay t={shot.typing} f={f} view={view} until={typingEnd} /> : null}
          {shot.reveal ? <RevealTyping r={shot.reveal} f={f} view={view} size={size} /> : null}
          {shot.halos.map((h, i) => {
            // A halo never outlives an instant capture swap (a layout change cut under the click ripple): it would sit
            // on whatever moved under it.
            const swap = shot.layers.find((l) => !l.xf && !l.scroll && !l.dip && l.f > h.f0 && l.f <= h.f1 + 8);
            if (swap && f >= swap.f) return null;
            const r = resolveRect(h.at);
            const pad = h.pad ?? 6;
            const sr = view.rect({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad });
            return <Halo key={i} r={sr} f={f} f0={h.f0} f1={h.f1} radius={(h.radius ?? 8) * view.S + 4} spot={h.spot} circle={h.circle} pulse={h.pulse} />;
          })}
        </AbsoluteFill>
        {shot.context ? <ContextChip f={f} frameX={makeView(shot.app, camAt(shot.cam, shot.context.f0, shot.app, size), size).frame.x} c={shot.context} /> : null}
        {(shot.keycaps ?? []).map((k, i) => {
          const [x, y] = view.toScreen(resolvePt(k.at));
          return <KeycapHint key={i} keys={k.keys} f={f} f0={k.f0} f1={k.f1} x={x + k.dx} y={y + k.dy} />;
        })}
        {shot.cursor ? (
          <CursorLayer
            f={f}
            point={view.toScreen(cursorPoint(shot.cursor.start, shot.cursor.moves, f))}
            clicks={shot.clicks}
            size={cursorSize}
            opacity={cursorOpacity(f, shot.cursor.show, shot.cursor.hide)}
          />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
