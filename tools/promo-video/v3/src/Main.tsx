// NXT5 promo v3 — timeline (SHOTS is the single source of truth), BGM and SFX.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { C } from './theme';
import { SHOTS } from './timeline';
import { seamAt, ShotAt } from './seams';

/** The music is silent before the last downbeat so no stray hit plays on the black end frames (review 2, N4). */
const MUSIC_OUT = SHOTS.outro.to - 3;
import { SFX } from './sfx';
import { Hook } from './shots/Hook';
import { Analyse } from './shots/Analyse';
import { Draft } from './shots/Draft';
import { BreathCard } from './shots/BreathCard';
import { Debrief } from './shots/Debrief';
import { Outro } from './shots/Outro';

export const SCENES = [
  { key: 'hook', shot: SHOTS.hook, Comp: Hook },
  { key: 'analyse', shot: SHOTS.analyse, Comp: Analyse },
  { key: 'draft', shot: SHOTS.draft, Comp: Draft },
  { key: 'card', shot: SHOTS.card, Comp: BreathCard },
  { key: 'debrief', shot: SHOTS.debrief, Comp: Debrief },
  { key: 'outro', shot: SHOTS.outro, Comp: Outro },
] as const;

/**
 * Picture: one shot at a time at its local frame, except inside a seam window (src/seams.tsx) where the seam composes
 * the two neighbours (each still at its own local frame, so every shot keeps its beat-locked timing).
 */
const Picture: React.FC = () => {
  const f = useCurrentFrame();
  const seam = seamAt(f);
  if (seam) return <React.Fragment key={seam.key}>{seam.render(f)}</React.Fragment>;
  const scene = SCENES.find(({ shot }) => f >= shot.from && f < shot.to);
  if (!scene) return null; // after the outro: the night background only (the end card has faded)
  const { key, shot, Comp } = scene;
  return (
    <ShotAt key={key} shot={shot} f={f}>
      <Comp />
    </ShotAt>
  );
};

export const Main: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Picture />
    {bgm ? (
      <Audio
        src={staticFile('audio/bgm.wav')}
        volume={(f) => 0.42 * interpolate(f, [0, 6, MUSIC_OUT - 33, MUSIC_OUT], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
    ) : null}
    {SFX.map((s, i) => (
      <Sequence key={`sfx-${i}`} from={s.from} durationInFrames={s.duration ?? 150} name={`sfx ${s.note}`}>
        <Audio
          src={staticFile(`sfx/${s.src}`)}
          trimBefore={s.trimBefore}
          volume={(f) => s.volume * (s.fadeOut && s.duration ? interpolate(f, [s.duration - s.fadeOut, s.duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1)}
        />
      </Sequence>
    ))}
  </AbsoluteFill>
);
