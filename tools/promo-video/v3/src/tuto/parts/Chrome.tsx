// Film chrome drawn above every shot, on the GLOBAL frame: subtitle bar, step header with progress, chapter card,
// « Données fictives » / « Partie fictive » / « Illustration » tag. All chrome surfaces are opaque and sit outside the
// working area, where captures are clipped (style AREA), so no real UI ever shows through or around them. Chapters,
// steps, subtitles and shot timings are the film's (useFilm).
import React from 'react';
import { frSpaces, type Chapter, type Film, type Shot, type Tag as TagKind } from '../engine';
import { useFilm } from '../FilmContext';
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
  const { subTrack } = useFilm();
  const i = subTrack.findIndex((s) => g >= s.g0 - 10 && g < s.g1);
  if (i < 0) return null;
  const s = subTrack[i];
  const prev = subTrack[i - 1];
  const next = subTrack[i + 1];
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

const chapterStart = (film: Film, c: Chapter) => film.start[c.shot];
const chapterEnd = (film: Film, c: Chapter) => {
  const { chapters, order, start, shots } = film;
  const i = chapters.indexOf(c);
  const n = chapters[i + 1];
  return n ? start[n.shot] : start[order[order.length - 1]] + shots[order[order.length - 1]].dur;
};

/** Segmented progress: done segments solid cyan, the current one fills with the brand gradient. */
const Progress: React.FC<{ n: number; fill: number; segW: number; segH: number; gap: number; steps: number }> = ({ n, fill, segW, segH, gap, steps }) => (
  <div style={{ display: 'flex', gap }}>
    {Array.from({ length: steps }, (_, k) => {
      const i = k + 1;
      const done = i < n || (n > steps);
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

const PillContent: React.FC<{ c: Chapter; fill: number; steps: number }> = ({ c, fill, steps }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: TOP.h, padding: '0 28px 0 24px' }}>
    <Progress n={c.kind === 'done' ? steps + 1 : c.n ?? 0} fill={fill} segW={34} segH={10} gap={7} steps={steps} />
    <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 600, color: COL.text, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
      {c.kind === 'step' ? (
        <>
          <span style={{ color: COL.cyan, fontWeight: 700 }}>Étape {c.n}/{steps}</span>
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
  const film = useFilm();
  const { chapters, card, steps } = film;
  let ci = 0;
  chapters.forEach((c, i) => { if (g >= chapterStart(film, c)) ci = i; });
  const cur = chapters[ci];
  const prev = chapters[ci - 1];
  const c0 = chapterStart(film, cur);
  const shows = (c?: Chapter) => !!c && (c.kind === 'step' || c.kind === 'done');
  const fillOf = (c: Chapter) => ramp(g, chapterStart(film, c), chapterEnd(film, c));
  const curO = !shows(cur) ? 0 : cur.kind === 'step' ? ramp(g, c0 + card - 6, c0 + card + 4, BRAND) : ramp(g, c0 + 6, c0 + 14);
  const prevO = shows(prev) ? 1 - ramp(g, c0, c0 + 6) : 0;
  return (
    <>
      {prevO > 0.001 && prev ? <div style={{ ...pillStyle, opacity: prevO }}><PillContent c={prev} fill={1} steps={steps} /></div> : null}
      {curO > 0.001 ? <div style={{ ...pillStyle, opacity: curO, transform: `translateY(${(1 - curO) * -8}px)` }}><PillContent c={cur} fill={fillOf(cur)} steps={steps} /></div> : null}
    </>
  );
};

const cardChapterAt = (film: Film, g: number, before: number, after: number) =>
  film.chapters.find((ch) => ch.kind === 'step' && g >= chapterStart(film, ch) - before && g < chapterStart(film, ch) + after);

/** Dim + blur behind the chapter card. It is drawn UNDER the step header, and it only lifts once the card has fully
 * faded into the header slot, so the shrinking card never reads over the live capture. */
export const ChapterDim: React.FC<{ g: number }> = ({ g }) => {
  const film = useFilm();
  const { card } = film;
  const c = cardChapterAt(film, g, 8, card + 8);
  if (!c) return null;
  const c0 = chapterStart(film, c);
  const dim = Math.min(ramp(g, c0 - 8, c0 + 6, IO), 1 - ramp(g, c0 + card - 4, c0 + card + 8, IO));
  if (dim <= 0.001) return null;
  return <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,13,24,.66)', opacity: dim, backdropFilter: `blur(${8 * dim}px)` }} />;
};

/** Big « Étape N/steps » card at the start of each step, which then settles into the header slot. */
export const ChapterCard: React.FC<{ g: number }> = ({ g }) => {
  const film = useFilm();
  const { card, steps } = film;
  const c = cardChapterAt(film, g, 8, card + 2);
  if (!c) return null;
  const c0 = chapterStart(film, c);
  const a = ramp(g, c0, c0 + 12, BRAND);
  const m = ramp(g, c0 + card - 16, c0 + card - 2, IO);
  const o = a * (1 - ramp(g, c0 + card - 12, c0 + card - 4));
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
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 34, letterSpacing: '0.16em', color: COL.cyan }}>ÉTAPE {c.n}/{steps}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 74, lineHeight: 1.08, letterSpacing: '-0.025em', color: COL.text, whiteSpace: 'nowrap', filter: a < 1 ? `blur(${(1 - a) * 8}px)` : undefined }}>
        {frSpaces(c.title)}
      </div>
      <Progress n={c.n ?? 0} fill={0.12} segW={92} segH={12} gap={12} steps={steps} />
    </div>
  );
};

// ───────────────────────── « Données fictives » / « Partie fictive » / « Illustration » ─────────────────────────

/** The shot's own `tag` if it has one; otherwise « Données fictives » on a capture, nothing on the title, checklist
 * and recap cards, « Illustration » on a schematic. */
export const tagOf = (s: Shot): TagKind => {
  if (s.tag !== undefined) return s.tag;
  if (s.kind === 'capture') return 'fictive';
  return ['title', 'prereq', 'recap'].includes(s.view) ? null : 'illustration';
};

const TAG_LABEL: Record<Exclude<TagKind, null>, string> = { fictive: 'Données fictives', fictiveGame: 'Partie fictive', illustration: 'Illustration' };

/** Real screens (fictitious data or game) in muted grey, schematics in violet with their icon. */
const Tag: React.FC<{ kind: Exclude<TagKind, null>; opacity: number }> = ({ kind, opacity }) => {
  const real = kind !== 'illustration';
  return (
    <div
      style={{
        position: 'absolute', right: TOP.right, top: TOP.y, height: TOP.h, boxSizing: 'border-box', padding: '0 26px', borderRadius: 999, opacity,
        display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap',
        background: '#141B2C', border: `1.5px solid ${real ? 'rgba(181,200,225,.38)' : 'rgba(196,181,253,.5)'}`,
        fontFamily: FONT, fontWeight: 600, fontSize: 32, color: real ? COL.muted : COL.violetText,
      }}
    >
      {real ? null : <Icon name="shapes" size={28} color={COL.violetText} />}
      {TAG_LABEL[kind]}
    </div>
  );
};

export const CornerTag: React.FC<{ g: number }> = ({ g }) => {
  const { order, shots, start, xf } = useFilm();
  let i = 0;
  order.forEach((id, k) => { if (g >= start[id]) i = k; });
  const cur = tagOf(shots[order[i]]);
  const prev = i > 0 ? tagOf(shots[order[i - 1]]) : null;
  // Sequential swap (out, then in) so two labels of different widths never overlap.
  const g0 = start[order[i]];
  if (prev === cur) return cur ? <Tag kind={cur} opacity={1} /> : null;
  return (
    <>
      {prev ? <Tag kind={prev} opacity={1 - ramp(g, g0, g0 + xf / 2)} /> : null}
      {cur ? <Tag kind={cur} opacity={ramp(g, g0 + xf / 2, g0 + xf)} /> : null}
    </>
  );
};
