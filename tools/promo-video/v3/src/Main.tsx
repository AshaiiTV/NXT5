// NXT5 promo v3 — timeline (SHOTS is the single source of truth), BGM and SFX.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion';
import { C } from './theme';
import { DURATION, dur, SHOTS } from './timeline';
import { SFX } from './sfx';
import { Hook } from './shots/Hook';
import { Brand } from './shots/Brand';
import { Analyse } from './shots/Analyse';
import { Draft } from './shots/Draft';
import { Planning } from './shots/Planning';
import { BreathCard } from './shots/BreathCard';
import { Debrief } from './shots/Debrief';
import { Outro } from './shots/Outro';

export const SCENES = [
  { key: 'hook', shot: SHOTS.hook, Comp: Hook },
  { key: 'brand', shot: SHOTS.brand, Comp: Brand },
  { key: 'analyse', shot: SHOTS.analyse, Comp: Analyse },
  { key: 'draft', shot: SHOTS.draft, Comp: Draft },
  { key: 'planning', shot: SHOTS.planning, Comp: Planning },
  { key: 'card', shot: SHOTS.card, Comp: BreathCard },
  { key: 'debrief', shot: SHOTS.debrief, Comp: Debrief },
  { key: 'outro', shot: SHOTS.outro, Comp: Outro },
] as const;

export const Main: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    {SCENES.map(({ key, shot, Comp }) => (
      <Sequence key={key} name={key} from={shot.from} durationInFrames={dur(shot)}>
        <Comp />
      </Sequence>
    ))}
    {bgm ? (
      <Audio
        src={staticFile('audio/bgm.wav')}
        volume={(f) => 0.42 * interpolate(f, [0, 6, DURATION - 36, DURATION], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
    ) : null}
    {SFX.map((s, i) => (
      <Sequence key={`sfx-${i}`} from={s.from} durationInFrames={s.duration ?? 150} name={`sfx ${s.note}`}>
        <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume} trimBefore={s.trimBefore} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
