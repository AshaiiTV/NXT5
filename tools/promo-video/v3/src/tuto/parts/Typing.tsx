// The film's two typing overlays, both ending on the real captured typed state.
// 5b · TypingOverlay over the real empty « Identifiant du match » field: on the paste a patch in the field's own colour
// hides the placeholder « Ex. EUW1_7861632138 » and the ID appears (whole when f0 = f1, as a paste does; character by
// character otherwise) in the field's font, size, colour and text position (captures.json → gameIdInputText), then the
// real capture of the typed state (importer-04) takes over once it has fully replaced the empty one. Plus a
// « Ctrl + V » keycap hint.
// 7f · RevealTyping over « Nom de la partie »: Ctrl + A shows the pre-filled text selected, the first keystroke replaces
// it; same patch technique, but the typed text is the capture's own (site-07b), uncovered glyph by glyph, so no font
// substitution is involved.
import React from 'react';
import { Img } from 'remotion';
import { cap, capSrc } from '../captures';
import type { Reveal, Typing } from '../script';
import type { View } from './Stage';
import { BRAND, COL, ramp } from '../style';
import { FONT } from '../../theme';

export const TypingOverlay: React.FC<{ t: Typing; f: number; view: View; until: number }> = ({ t, f, view, until }) => {
  if (f < t.f0 || f >= until + 5) return null;
  const meta = cap(t.cap).gameIdInputText;
  if (!meta) throw new Error('gameIdInputText manquant');
  const n = Math.min(t.text.length, Math.floor(ramp(f, t.f0, t.f1) * t.text.length) + 1);
  const fade = 1 - ramp(f, until, until + 5);
  const c = view.rect(t.cover);
  const [tx, ty] = view.toScreen([meta.textX, meta.centerY]);
  const fs = parseFloat(meta.fontSize) * view.S;
  const caretOn = f < t.f1 + 2 || Math.floor((f - t.f1) / 8) % 2 === 0;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <div style={{ position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, background: COL.inputBg }} />
      <div
        style={{
          position: 'absolute', left: tx, top: ty - fs, height: fs * 2, display: 'flex', alignItems: 'center', whiteSpace: 'pre',
          fontFamily: 'Inter, sans-serif', fontWeight: Number(meta.fontWeight), fontSize: fs, color: meta.color, letterSpacing: 0,
        }}
      >
        {t.text.slice(0, n)}
        <span style={{ display: 'inline-block', width: Math.max(1.5, 1.2 * view.S), height: fs * 1.2, marginLeft: 1, background: meta.color, opacity: caretOn ? 1 : 0 }} />
      </div>
    </div>
  );
};

/** « Ctrl + V » hint: NXT5 keycaps (not an OS keyboard), V pressed at f0 + 8. */
export const KeycapHint: React.FC<{ keys: string[]; f: number; f0: number; f1: number; x: number; y: number }> = ({ keys, f, f0, f1, x, y }) => {
  const a = Math.min(ramp(f, f0, f0 + 8, BRAND), 1 - ramp(f, f1, f1 + 8));
  if (a <= 0.001) return null;
  const press = ramp(f, f0 + 8, f0 + 10) - ramp(f, f0 + 12, f0 + 17);
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, transform: `translate(-50%, -100%) translateY(${(1 - a) * 10}px)`, opacity: a,
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16,
        background: 'rgba(17,24,39,.9)', border: `1.5px solid ${COL.panelEdge}`, boxShadow: '0 14px 40px rgba(2,6,17,.5)',
        fontFamily: FONT, fontWeight: 700, fontSize: 32, color: COL.text,
      }}
    >
      {keys.map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 ? <span style={{ color: COL.muted, fontWeight: 600 }}>+</span> : null}
          <span
            style={{
              minWidth: 56, padding: '6px 14px', textAlign: 'center', borderRadius: 8, background: 'linear-gradient(#273449, #1B2638)',
              border: '1.5px solid rgba(203,213,225,.28)', boxShadow: `0 ${i === keys.length - 1 ? 4 - 3 * press : 4}px 0 rgba(2,6,17,.7)`,
              transform: `translateY(${i === keys.length - 1 ? 3 * press : 0}px)`, color: i === keys.length - 1 && press > 0.2 ? COL.cyan : COL.text,
            }}
          >
            {k}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

/** Typing by reveal (7f « Nom de la partie »): until r.t0 the field shows the previous text (same region of capture
 * r.from); from r.select (Ctrl + A) that text is drawn selected (r.selection.color behind the captured glyphs, blended
 * with « lighten »); at r.t0 the first keystroke replaces the selection: a patch in the field's own colour covers the
 * field and the capture's REAL typed text underneath is uncovered one glyph at a time (r.steps, CSS x after each
 * character, measured on the capture's ink gaps). A caret sits at the edge; from r.t1 the capture is fully uncovered
 * and only the caret blinks until r.f1. No text is drawn: every text pixel is a capture's. */
export const RevealTyping: React.FC<{ r: Reveal; f: number; view: View; size: { w: number; h: number } }> = ({ r, f, view, size }) => {
  if (f < r.f0 || f >= r.f1) return null;
  const box = view.rect(r.cover);
  const W = size.w * view.S;
  const H = size.h * view.S;
  if (f < r.t0) {
    const sel = f >= r.select ? view.rect(r.selection.rect) : null;
    return (
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, overflow: 'hidden', isolation: 'isolate' }}>
        <Img src={capSrc(r.from)} style={{ position: 'absolute', left: view.frame.x - box.x, top: view.frame.y - box.y, width: W, height: H }} />
        {sel ? (
          <div style={{ position: 'absolute', left: sel.x - box.x, top: sel.y - box.y, width: sel.w, height: sel.h, overflow: 'hidden', background: r.selection.color }}>
            <Img src={capSrc(r.from)} style={{ position: 'absolute', left: view.frame.x - sel.x, top: view.frame.y - sel.y, width: W, height: H, mixBlendMode: 'lighten' }} />
          </div>
        ) : null}
      </div>
    );
  }
  const n = Math.min(r.steps.length, Math.floor(ramp(f, r.t0, r.t1) * r.steps.length) + 1);
  const edge = r.steps[n - 1];
  const cover = n >= r.steps.length ? null : view.rect({ x: edge, y: r.cover.y, w: r.cover.x + r.cover.w - edge, h: r.cover.h });
  const caretOn = f < r.t1 || Math.floor((f - r.t1) / 8) % 2 === 0;
  const [cx, cy] = view.toScreen([edge + 0.5, r.caret.y]);
  return (
    <>
      {cover ? <div style={{ position: 'absolute', left: cover.x, top: cover.y, width: cover.w, height: cover.h, background: r.color }} /> : null}
      <div style={{ position: 'absolute', left: cx, top: cy, width: Math.max(1.5, view.S), height: r.caret.h * view.S, background: r.caret.color, opacity: caretOn ? 1 : 0 }} />
    </>
  );
};
