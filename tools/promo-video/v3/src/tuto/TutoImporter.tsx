// Composition « TutoImporter » (1920×1080, 30 fps): YouTube tutorial « Importer une partie dans NXT5 ».
// Storyboard: TUTO-IMPORTER.md. Every frame number lives in ./script.ts. Each shot is opaque (its own night
// backdrop on the global clock). It enters through night (script entersByDip), except at a step change, where it
// cross-fades (XF frames) under the chapter card. The chrome (step header, chapter card, data tag, subtitles) is
// drawn once on top, on the global frame. Script and camera checks (checkScript, camera.ts checkCamera) run at
// import. Sound: TutoAudio (music bed + foley pinned on cues.json).
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { checkScript, entersByDip, ORDER, SHOTS, START, XF, type ShotId } from './script';
import { ShotCtx, TutoBackdrop } from './parts/Backdrop';
import { checkCamera } from './camera';
import { RESOLVER } from './captures';
import { ChapterCard, ChapterDim, CornerTag, StepHeader, SubtitleBar } from './parts/Chrome';
import { CaptureShot } from './shots/CaptureShot';
import { PrereqCard, RecapCard, TitleCard } from './shots/Cards';
import { DownloadSchema, LolHistorySchema, LolOpenSchema, OpenFileSchema, PickFileSchema, SaveJsonSchema, SmartScreenSchema } from './shots/Schematics';
import { IO, ramp } from './style';
import { TutoAudio } from './TutoAudio';
import { DURATION as TUTO_DURATION } from './script';

const errors = [...checkScript(), ...checkCamera(SHOTS, ORDER, START, RESOLVER)];
if (errors.length) throw new Error(`TutoImporter script:\n${errors.join('\n')}`);

const ShotView: React.FC<{ id: ShotId }> = ({ id }) => {
  const s = SHOTS[id];
  if (s.kind === 'capture') return <CaptureShot shot={s} />;
  switch (s.view) {
    case 'title': return <TitleCard shot={s} />;
    case 'prereq': return <PrereqCard shot={s} />;
    case 'recap': return <RecapCard shot={s} />;
    case 'download': return <DownloadSchema shot={s} />;
    case 'openFile': return <OpenFileSchema shot={s} />;
    case 'smartscreen': return <SmartScreenSchema shot={s} />;
    case 'lolOpen': return <LolOpenSchema shot={s} />;
    case 'lolHistory': return <LolHistorySchema shot={s} />;
    case 'saveJson': return <SaveJsonSchema shot={s} />;
    case 'pickFile': return <PickFileSchema shot={s} />;
    default: return null;
  }
};

/** Incoming cross-fade (the previous shot stays opaque underneath until this one is fully in), or, for `dip`, a dip
 * through night: a night veil (the same global-clock backdrop as every shot) covers the previous shot over the first
 * XF/2 frames, then this shot fades in over it during the last XF/2 frames. */
const FadeIn: React.FC<{ on: boolean; dip?: boolean; children: React.ReactNode }> = ({ on, dip, children }) => {
  const f = useCurrentFrame();
  if (on && dip) {
    return (
      <>
        <AbsoluteFill style={{ opacity: ramp(f, 0, XF / 2, IO) }}><TutoBackdrop /></AbsoluteFill>
        <AbsoluteFill style={{ opacity: ramp(f, XF / 2, XF, IO) }}>{children}</AbsoluteFill>
      </>
    );
  }
  return <AbsoluteFill style={{ opacity: on ? ramp(f, 0, XF) : 1 }}>{children}</AbsoluteFill>;
};

export const TutoImporter: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const g = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#111827' }}>
      {ORDER.map((id, i) => (
        <Sequence key={id} from={START[id]} durationInFrames={SHOTS[id].dur} name={id}>
          <ShotCtx.Provider value={{ g0: START[id], dur: SHOTS[id].dur }}>
            <FadeIn on={i > 0} dip={entersByDip(id)}>
              <ShotView id={id} />
            </FadeIn>
          </ShotCtx.Provider>
        </Sequence>
      ))}
      <ChapterDim g={g} />
      <StepHeader g={g} />
      <ChapterCard g={g} />
      <CornerTag g={g} />
      <SubtitleBar g={g} />
      <TutoAudio bgm={bgm} duration={TUTO_DURATION} />
    </AbsoluteFill>
  );
};
