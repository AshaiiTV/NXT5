// Film chrome drawn above every shot, on the GLOBAL frame: subtitle bar, step header with progress, chapter card,
// « Données fictives » / « Illustration » tag. All chrome surfaces are opaque and sit outside the working area, where
// captures are clipped (style AREA), so no real UI ever shows through or around them.
import React from 'react';
import { CARD, CHAPTERS, frSpaces, ORDER, SHOTS, START, STEPS, SUB_TRACK, XF, type Chapter, type ShotId } from '../script';
import { BRAND, COL, IO, lerp, ramp, SUB, TOP } from '../style';
import { FONT, PRIMARY_GRADIENT } from '../../theme';
import { Icon } from './icons';

// ───────────────────────── subtitles ─────────────────────────

/** Display markup → spans: «…» label in cyan (guillemets kept), […] label in cyan, {…} file name in violet. */
export const SubText: React.FC<{ line: string }> = ({ line }) => {
  const parts = frSpaces(line).split(/(«[^»]*»|\{[^}]*\}|\[[^\]]*\])/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('«')) {
          const inner = p.slice(1, -1).replace(/^ /, '').replace(/ $/, '');
          return (
            <span key={i}>
              {'« '}
              <span style={{ color: COL.cyan }}>{inner}</span>
              {' »'}
            </span>
          );
        }
        if (p.startsWith('[')) return <span key={i} style={{ color: COL.cyan }}>{p.slice(1, -1)}</span>;
        if (p.startsWith('{')) return <span key={i} style={{ color: COL.fileText }}>{p.slice(1, -1)}</span>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
};

const barH = (lines: number) => lines * SUB.font * SUB.line + SUB.padY * 2;

export const SubtitleBar: React.FC<{ g: number }> = ({ g }) => {
  const i = SUB_TRACK.findIndex((s) => g >= s.g0 - 10 && g < s.g1);
  if (i < 0) return null;
  const s = SUB_TRACK[i];
  const prev = SUB_TRACK[i - 1];
  const next = SUB_TRACK[i + 1];
  const joinedPrev = prev && prev.g1 === s.g0;
  const joinedNext = next && next.g0 === s.g1;
  // Bar: fades in at the start of a run of subtitles, out at its end; height follows the line count.
  const barIn = joinedPrev ? 1 : ramp(g, s.g0 - 2, s.g0 + 8, BRAND);
  const barOut = joinedNext ? 0 : ramp(g, s.g1 - 8, s.g1, IO);
  const barO = Math.min(barIn, 1 - barOut);
  // Height follows the line count, changing across the 9 frames around a boundary between two joined subtitles.
  let h = barH(s.lines.length);
  if (joinedPrev) h = lerp(barH(prev.lines.length), h, ramp(g, s.g0 - 5, s.g0 + 4, IO));
  if (joinedNext) h = lerp(h, barH(next.lines.length), ramp(g, next.g0 - 5, next.g0 + 4, IO));
  // Text: blur-slide in (line 2 three frames later), out over the last 8 frames.
  const textOut = ramp(g, s.g1 - 8, s.g1, IO);
  return (
    <div
      style={{
        position: 'absolute', left: (1920 - SUB.w) / 2, bottom: SUB.bottom, width: SUB.w, height: h, opacity: barO,
        borderRadius: 20, background: 'linear-gradient(180deg, #171D34, #0E1324)',
        border: `1.5px solid ${COL.panelEdge}`, boxShadow: '0 18px 50px rgba(2,6,17,.55), inset 0 1px 0 rgba(226,232,255,.08)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      }}
    >
      {s.lines.map((line, k) => {
        const p = ramp(g, s.g0 + 3 * k, s.g0 + 3 * k + 12, BRAND);
        return (
          <div
            key={`${s.id}-${k}`}
            style={{
              fontFamily: FONT, fontWeight: 600, fontSize: SUB.font, lineHeight: SUB.line, color: COL.text, whiteSpace: 'nowrap',
              letterSpacing: '-0.005em', opacity: p * (1 - textOut), transform: `translateY(${(1 - p) * 14 - textOut * 8}px)`,
              filter: p < 1 || textOut > 0 ? `blur(${(1 - p) * 6 + textOut * 4}px)` : undefined,
            }}
          >
            <SubText line={line} />
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────── step header + chapter card ─────────────────────────

const chapterStart = (c: Chapter) => START[c.shot];
const chapterEnd = (c: Chapter) => {
  const i = CHAPTERS.indexOf(c);
  const n = CHAPTERS[i + 1];
  return n ? START[n.shot] : START[ORDER[ORDER.length - 1]] + SHOTS[ORDER[ORDER.length - 1]].dur;
};

/** Segmented progress: done segments solid cyan, the current one fills with the brand gradient. */
const Progress: React.FC<{ n: number; fill: number; segW: number; segH: number; gap: number }> = ({ n, fill, segW, segH, gap }) => (
  <div style={{ display: 'flex', gap }}>
    {Array.from({ length: STEPS }, (_, k) => {
      const i = k + 1;
      const done = i < n || (n > STEPS);
      return (
        <div key={i} style={{ width: segW, height: segH, borderRadius: segH, background: 'rgba(203,213,225,.24)', overflow: 'hidden', position: 'relative' }}>
          {done ? <div style={{ position: 'absolute', inset: 0, background: COL.cyan }} /> : null}
          {i === n ? <div style={{ position: 'absolute', inset: 0, background: PRIMARY_GRADIENT, opacity: 0.4 }} /> : null}
          {i === n ? <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0.12, fill) * 100}%`, background: PRIMARY_GRADIENT }} /> : null}
        </div>
      );
    })}
  </div>
);

const PillContent: React.FC<{ c: Chapter; fill: number }> = ({ c, fill }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: TOP.h, padding: '0 28px 0 24px' }}>
    <Progress n={c.kind === 'done' ? STEPS + 1 : c.n ?? 0} fill={fill} segW={34} segH={10} gap={7} />
    <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 600, color: COL.text, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
      {c.kind === 'step' ? (
        <>
          <span style={{ color: COL.cyan, fontWeight: 700 }}>Étape {c.n}/{STEPS}</span>
          <span style={{ color: COL.muted }}> · </span>
          {c.title}
        </>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <Icon name="check" size={30} color={COL.success} stroke={2.6} />
          {c.title}
        </span>
      )}
    </div>
  </div>
);

const pillStyle: React.CSSProperties = {
  position: 'absolute', left: TOP.left, top: TOP.y, borderRadius: 18,
  background: 'linear-gradient(180deg, #1E2440, #12172A)', border: `1.5px solid ${COL.panelEdge}`,
  boxShadow: '0 12px 36px rgba(2,6,17,.45), inset 0 1px 0 rgba(226,232,255,.08)',
};

export const StepHeader: React.FC<{ g: number }> = ({ g }) => {
  let ci = 0;
  CHAPTERS.forEach((c, i) => { if (g >= chapterStart(c)) ci = i; });
  const cur = CHAPTERS[ci];
  const prev = CHAPTERS[ci - 1];
  const c0 = chapterStart(cur);
  const shows = (c?: Chapter) => !!c && (c.kind === 'step' || c.kind === 'done');
  const fillOf = (c: Chapter) => ramp(g, chapterStart(c), chapterEnd(c));
  const curO = !shows(cur) ? 0 : cur.kind === 'step' ? ramp(g, c0 + CARD - 6, c0 + CARD + 4, BRAND) : ramp(g, c0 + 6, c0 + 14);
  const prevO = shows(prev) ? 1 - ramp(g, c0, c0 + 6) : 0;
  return (
    <>
      {prevO > 0.001 && prev ? <div style={{ ...pillStyle, opacity: prevO }}><PillContent c={prev} fill={1} /></div> : null}
      {curO > 0.001 ? <div style={{ ...pillStyle, opacity: curO, transform: `translateY(${(1 - curO) * -8}px)` }}><PillContent c={cur} fill={fillOf(cur)} /></div> : null}
    </>
  );
};

const cardChapterAt = (g: number, before: number, after: number) =>
  CHAPTERS.find((ch) => ch.kind === 'step' && g >= chapterStart(ch) - before && g < chapterStart(ch) + after);

/** Dim + blur behind the chapter card. It is drawn UNDER the step header, and it only lifts once the card has fully
 * faded into the header slot, so the shrinking card never reads over the live capture. */
export const ChapterDim: React.FC<{ g: number }> = ({ g }) => {
  const c = cardChapterAt(g, 8, CARD + 8);
  if (!c) return null;
  const c0 = chapterStart(c);
  const dim = Math.min(ramp(g, c0 - 8, c0 + 6, IO), 1 - ramp(g, c0 + CARD - 4, c0 + CARD + 8, IO));
  if (dim <= 0.001) return null;
  return <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,13,24,.66)', opacity: dim, backdropFilter: `blur(${8 * dim}px)` }} />;
};

/** Big « Étape N/6 » card at the start of each step, which then settles into the header slot. */
export const ChapterCard: React.FC<{ g: number }> = ({ g }) => {
  const c = cardChapterAt(g, 8, CARD + 2);
  if (!c) return null;
  const c0 = chapterStart(c);
  const a = ramp(g, c0, c0 + 12, BRAND);
  const m = ramp(g, c0 + CARD - 16, c0 + CARD - 2, IO);
  const o = a * (1 - ramp(g, c0 + CARD - 12, c0 + CARD - 4));
  if (o <= 0.001) return null;
  const W = 1500;
  const H = 320;
  const x = lerp((1920 - W) / 2, TOP.left, m);
  const y = lerp(470 - H / 2, TOP.y, m) + (1 - a) * 18;
  const s = lerp(1, 0.36, m);
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width: W, height: H, transform: `scale(${s})`, transformOrigin: '0 0', opacity: o,
        borderRadius: 26, background: 'radial-gradient(ellipse at 100% 0%, rgba(139,92,246,.28), transparent 50%), radial-gradient(ellipse at 0% 0%, rgba(103,232,249,.09), transparent 40%), linear-gradient(135deg, #263248, #221e42 62%, #1b273c)',
        border: `1.5px solid ${COL.glassBorder}`, boxShadow: 'inset 0 1px 0 rgba(226,232,255,.1), 0 30px 80px rgba(2,6,17,.55)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 72px', gap: 22,
      }}
    >
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 34, letterSpacing: '0.16em', color: COL.cyan }}>ÉTAPE {c.n}/{STEPS}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 74, lineHeight: 1.08, letterSpacing: '-0.025em', color: COL.text, whiteSpace: 'nowrap', filter: a < 1 ? `blur(${(1 - a) * 8}px)` : undefined }}>
        {frSpaces(c.title)}
      </div>
      <Progress n={c.n ?? 0} fill={0.12} segW={92} segH={12} gap={12} />
    </div>
  );
};

// ───────────────────────── « Données fictives » / « Illustration » ─────────────────────────

type TagKind = 'fictive' | 'illustration' | null;
export const tagOf = (id: ShotId): TagKind => {
  const s = SHOTS[id];
  if (s.kind === 'capture') return 'fictive';
  return ['title', 'prereq', 'recap'].includes(s.view) ? null : 'illustration';
};

const Tag: React.FC<{ kind: Exclude<TagKind, null>; opacity: number }> = ({ kind, opacity }) => (
  <div
    style={{
      position: 'absolute', right: TOP.right, top: TOP.y, height: TOP.h, boxSizing: 'border-box', padding: '0 26px', borderRadius: 999, opacity,
      display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap',
      background: '#141B2C', border: `1.5px solid ${kind === 'fictive' ? 'rgba(181,200,225,.38)' : 'rgba(196,181,253,.5)'}`,
      fontFamily: FONT, fontWeight: 600, fontSize: 32, color: kind === 'fictive' ? COL.muted : COL.violetText,
    }}
  >
    {kind === 'illustration' ? <Icon name="shapes" size={28} color={COL.violetText} /> : null}
    {kind === 'fictive' ? 'Données fictives' : 'Illustration'}
  </div>
);

export const CornerTag: React.FC<{ g: number }> = ({ g }) => {
  let i = 0;
  ORDER.forEach((id, k) => { if (g >= START[id]) i = k; });
  const cur = tagOf(ORDER[i]);
  const prev = i > 0 ? tagOf(ORDER[i - 1]) : null;
  // Sequential swap (out, then in) so two labels of different widths never overlap.
  const g0 = START[ORDER[i]];
  if (prev === cur) return cur ? <Tag kind={cur} opacity={1} /> : null;
  return (
    <>
      {prev ? <Tag kind={prev} opacity={1 - ramp(g, g0, g0 + XF / 2)} /> : null}
      {cur ? <Tag kind={cur} opacity={ramp(g, g0 + XF / 2, g0 + XF)} /> : null}
    </>
  );
};
