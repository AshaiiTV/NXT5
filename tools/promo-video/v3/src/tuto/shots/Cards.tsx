// Text cards: title (wordmark + blur-slide title), « Avant de commencer » checklist, « À retenir » recap with the
// official wordmark and nxt5.org. Typography: blur-slide (lib/ui BlurLine) for the titles.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BlurLine, Wordmark } from '../../lib/ui';
import { FONT, PRIMARY_GRADIENT, spectrumText } from '../../theme';
import type { CardShot } from '../script';
import { frSpaces, PREREQ_ITEMS, RECAP_ITEMS, TITLE_TEXT } from '../script';
import { TutoBackdrop } from '../parts/Backdrop';
import { Panel, Txt } from '../parts/Glass';
import { Icon, type IconName } from '../parts/icons';
import { BRAND, COL, IO, lerp, ramp } from '../style';

export const TitleCard: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { mark, title, sub, chip } = shot.t;
  const m = ramp(f, mark, mark + 22, BRAND);
  const c = ramp(f, chip, chip + 16, BRAND);
  const words = frSpaces(TITLE_TEXT.title).split(' ');
  return (
    <AbsoluteFill>
      <TutoBackdrop dim={0.32} />
      <AbsoluteFill style={{ backgroundColor: COL.night, opacity: 1 - ramp(f, 0, 10) }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 236, display: 'flex', justifyContent: 'center', opacity: m, filter: m < 1 ? `blur(${(1 - m) * 10}px)` : undefined, transform: `translateY(${(1 - m) * 18}px)` }}>
        <Wordmark width={400} />
      </div>
      <div style={{ position: 'absolute', left: 120, right: 120, top: 432 }}>
        <BlurLine
          line={words.map((w, i) => ({ text: w, spectrum: i === words.length - 1 }))}
          start={title} size={96} weight={800} align="center"
        />
      </div>
      <div style={{ position: 'absolute', left: 120, right: 120, top: 566 }}>
        <BlurLine line={frSpaces(TITLE_TEXT.sub)} start={sub} size={48} weight={600} color={COL.text2} align="center" gap={2.5} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 676, display: 'flex', justifyContent: 'center', opacity: c, transform: `translateY(${(1 - c) * 12}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 30px', borderRadius: 999, background: 'rgba(17,24,39,.72)', border: `1.5px solid ${COL.panelEdge}` }}>
          <Icon name="monitor" size={34} color={COL.cyan} />
          <Txt size={34} weight={600} color={COL.text}>{TITLE_TEXT.chip}</Txt>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CheckCircle: React.FC<{ on: number; size: number }> = ({ on, size }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid rgba(203,213,225,.35)' }} />
    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: PRIMARY_GRADIENT, opacity: on, transform: `scale(${lerp(0.6, 1, on)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="check" size={size * 0.56} color={COL.onAccent} stroke={3.2} />
    </div>
  </div>
);

export const PrereqCard: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const a = ramp(f, 0, 16, BRAND);
  const at = [shot.t.check1, shot.t.check2, shot.t.check3];
  const icons: IconName[] = ['mailCheck', 'users', 'monitor'];
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <Panel x={220} y={190} w={1480} h={640} style={{ opacity: a, transform: `translateY(${(1 - a) * 18}px)` }}>
        <div style={{ position: 'absolute', left: 80, top: 72 }}>
          <BlurLine line="Avant de commencer" start={6} size={68} weight={800} />
        </div>
        {PREREQ_ITEMS.map((txt, i) => {
          const on = ramp(f, at[i], at[i] + 12, BRAND);
          return (
            <div key={i} style={{ position: 'absolute', left: 80, right: 80, top: 268 + i * 118, display: 'flex', alignItems: 'center', gap: 32 }}>
              <CheckCircle on={on} size={60} />
              <Icon name={icons[i]} size={40} color={on > 0.5 ? COL.violetText : 'rgba(203,213,225,.45)'} />
              <Txt size={46} weight={600} color={COL.text} style={{ opacity: lerp(0.5, 1, on) }}>{frSpaces(txt)}</Txt>
            </div>
          );
        })}
      </Panel>
    </AbsoluteFill>
  );
};

export const RecapCard: React.FC<{ shot: CardShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const { item1, item2, item3, brand, out } = shot.t;
  const a = ramp(f, 0, 16, BRAND);
  const at = [item1, item2, item3];
  const b = ramp(f, brand, brand + 22, BRAND);
  const fade = 1 - ramp(f, out, out + 14, IO);
  return (
    <AbsoluteFill>
      <TutoBackdrop />
      <AbsoluteFill style={{ opacity: fade }}>
        <Panel x={200} y={120} w={1520} h={560} style={{ opacity: a, transform: `translateY(${(1 - a) * 18}px)` }}>
          <div style={{ position: 'absolute', left: 80, top: 60 }}>
            <BlurLine line="À retenir" start={6} size={68} weight={800} />
          </div>
          {RECAP_ITEMS.map((txt, i) => {
            const on = ramp(f, at[i], at[i] + 14, BRAND);
            return (
              <div key={i} style={{ position: 'absolute', left: 80, right: 60, top: 196 + i * 112, display: 'flex', alignItems: 'center', gap: 30, opacity: on, transform: `translateX(${(1 - on) * -20}px)`, filter: on < 1 ? `blur(${(1 - on) * 6}px)` : undefined }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0, background: PRIMARY_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 32, color: COL.onAccent }}>
                  {i + 1}
                </div>
                <Txt size={44} weight={600}>{frSpaces(txt)}</Txt>
              </div>
            );
          })}
        </Panel>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 48, opacity: b, transform: `translateY(${(1 - b) * 16}px)`, filter: b < 1 ? `blur(${(1 - b) * 8}px)` : undefined }}>
          <Wordmark width={330} />
          <div style={{ width: 2, height: 80, background: 'rgba(196,181,253,.35)' }} />
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 64, letterSpacing: '-0.02em', ...spectrumText }}>nxt5.org</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: COL.night, opacity: 1 - fade }} />
    </AbsoluteFill>
  );
};
