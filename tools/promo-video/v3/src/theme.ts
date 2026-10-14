// Charte graphique NXT5 v1.92 (13 Oct 2026) — tokens used by the film. Inter only.
import type React from 'react';

export const C = {
  bg: '#111827',
  surface: '#1E293B',
  text: '#F1F5F9',
  text2: '#CBD5E1',
  muted: '#AFBFD3',
  cyan: '#67E8F9',
  violetText: '#C4B5FD',
  violet: '#A78BFA',
  fuchsia: '#E879F9',
  danger: '#FDA4AF',
  success: '#A7F3D0', // the demo's « Victoire » label (sampled from the match list)
  onAccent: '#020611',
  glassBorder: 'rgba(196,181,253,.34)',
  glassHighlight: 'rgba(226,232,255,.22)',
  glowViolet: 'rgba(139,92,246,.28)',
  glowCyan: 'rgba(103,232,249,.16)',
  glowFuchsia: 'rgba(232,121,249,.14)',
};
export const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';
export const PRIMARY_GRADIENT = 'linear-gradient(to right, #22D3EE, #3B82F6, #D946EF)';
export const SPECTRUM_TEXT = 'linear-gradient(105deg, #A5F3FC, #C4B5FD 55%, #F0ABFC)';

/** --nxt5-glass-background + reflection + edge (charte §3 "Matière et éclairage"). */
export const glassSurface: React.CSSProperties = {
  background:
    'radial-gradient(ellipse at 100% 0%, rgba(139,92,246,.25), transparent 46%), radial-gradient(ellipse at 0% 0%, rgba(103,232,249,.075), transparent 36%), linear-gradient(135deg, #263248, #221e42 62%, #1b273c)',
  border: `1.5px solid ${C.glassBorder}`,
  boxShadow: 'inset 0 1px 0 rgba(226,232,255,.1), 0 16px 48px rgba(2,6,17,.35)',
  borderRadius: 16,
};

/** Spectrum text for one key word (full letters, no halo). */
export const spectrumText: React.CSSProperties = {
  backgroundImage: SPECTRUM_TEXT,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};
