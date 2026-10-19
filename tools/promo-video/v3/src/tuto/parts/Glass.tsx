// NXT5 building blocks for schematic and text cards (charte v1.92): violet glass panels (20 px radius), buttons with
// 2 px radius (primary = brand gradient with #020611 text), lucide icons, official emblem and wordmark files only.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { FONT, glassSurface, PRIMARY_GRADIENT } from '../../theme';
import { COL } from '../style';
import { Icon, type IconName } from './icons';

export const Panel: React.FC<{ x: number; y: number; w: number; h: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x, y, w, h, style, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...glassSurface, borderRadius: 24, boxShadow: 'inset 0 1px 0 rgba(226,232,255,.1), 0 30px 80px rgba(2,6,17,.5)', ...style }}>
    {children}
  </div>
);

export const Btn: React.FC<{ label: string; primary?: boolean; icon?: IconName; size?: number; style?: React.CSSProperties }> = ({ label, primary, icon, size = 34, style }) => (
  <div
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 14, height: size * 2.05, padding: `0 ${size * 0.9}px`, borderRadius: 2, boxSizing: 'border-box',
      fontFamily: FONT, fontWeight: 700, fontSize: size, whiteSpace: 'nowrap',
      ...(primary
        ? { background: PRIMARY_GRADIENT, color: COL.onAccent }
        : { background: 'rgba(15,23,42,.85)', color: COL.text, border: '1.5px solid rgba(203,213,225,.38)' }),
      ...style,
    }}
  >
    {icon ? <Icon name={icon} size={size * 0.95} color={primary ? COL.onAccent : COL.text} stroke={2.2} /> : null}
    {label}
  </div>
);

export const IconTile: React.FC<{ name: IconName; size: number; tint?: 'cyan' | 'violet' | 'neutral'; style?: React.CSSProperties }> = ({ name, size, tint = 'violet', style }) => {
  const bg = tint === 'cyan' ? 'rgba(103,232,249,.12)' : tint === 'violet' ? 'rgba(167,139,250,.16)' : 'rgba(203,213,225,.08)';
  const fg = tint === 'cyan' ? COL.cyan : tint === 'violet' ? COL.violetText : COL.text2;
  const bd = tint === 'cyan' ? 'rgba(103,232,249,.4)' : tint === 'violet' ? 'rgba(196,181,253,.42)' : 'rgba(203,213,225,.26)';
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: bg, border: `1.5px solid ${bd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}>
      <Icon name={name} size={size * 0.5} color={fg} stroke={2} />
    </div>
  );
};

/** Official NXT5 emblem file (the Importer's own icon), never redrawn. */
export const Emblem: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden', flexShrink: 0, border: '1.5px solid rgba(196,181,253,.42)', ...style }}>
    <Img src={staticFile('brand/nxt5-loader-favicon-512.webp')} style={{ width: size, height: size, display: 'block' }} />
  </div>
);

export const StepBadge: React.FC<{ n: number | string; size?: number; on?: boolean }> = ({ n, size = 44, on = true }) => (
  <div
    style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, fontWeight: 800, fontSize: size * 0.52, color: on ? COL.onAccent : COL.muted,
      background: on ? COL.cyan : 'rgba(203,213,225,.12)', border: on ? 'none' : '1.5px solid rgba(203,213,225,.3)',
    }}
  >
    {n}
  </div>
);

export const Txt: React.FC<{ size: number; weight?: number; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ size, weight = 600, color = COL.text, style, children }) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, color, lineHeight: 1.22, letterSpacing: '-0.01em', ...style }}>{children}</div>
);

/** Skeleton bar: stands for content that the schematic deliberately does not reproduce. */
export const Skel: React.FC<{ w: number; h?: number; o?: number }> = ({ w, h = 16, o = 1 }) => (
  <div style={{ width: w, height: h, borderRadius: h, background: 'rgba(203,213,225,.16)', opacity: o }} />
);
