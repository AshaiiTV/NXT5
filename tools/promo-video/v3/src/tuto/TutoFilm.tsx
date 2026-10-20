// Generic tutorial composition (1920×1080): every tutorial (TutoImporter, TutoDiscord…) is one film (engine.ts) drawn
// by this component. Each shot is opaque (its own night backdrop on the global clock). It enters through night (engine
// entersByDip), except at a step change, where it cross-fades (xf frames) under the chapter card. The chrome (step
// header, chapter card, data tag, subtitles) is drawn once on top, on the global frame. Capture shots, the title,
// checklist and recap cards are the engine's; any other card view is one of the film's own schematics (`views`).
// Sound: TutoAudio (music bed + foley pinned on the film's cue list).
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { entersByDip, type CardShot, type Cue } from './engine';
import { FilmCtx, useFilm, type FilmRuntime } from './FilmContext';
import { ShotCtx, TutoBackdrop } from './parts/Backdrop';
import { ChapterCard, ChapterDim, CornerTag, StepHeader, SubtitleBar } from './parts/Chrome';
import { CaptureShot } from './shots/CaptureShot';
import { PrereqCard, RecapCard, TitleCard } from './shots/Cards';
import { IO, ramp } from './style';
import { TutoAudio } from './TutoAudio';

/** The film's own card views (schematics), by CardShot.view. */
export type CardViews = Record<string, React.FC<{ shot: CardShot }>>;
const CARDS: CardViews = { title: TitleCard, prereq: PrereqCard, recap: RecapCard };

const ShotView: React.FC<{ id: string; views: CardViews }> = ({ id, views }) => {
  const s = useFilm().shots[id];
  if (s.kind === 'capture') return <CaptureShot shot={s} />;
  const View = CARDS[s.view] ?? views[s.view];
  return View ? <View shot={s} /> : null;
};

/** Incoming cross-fade (the previous shot stays opaque underneath until this one is fully in), or, for `dip`, a dip
 * through night: a night veil (the same global-clock backdrop as every shot) covers the previous shot over the first
 * xf/2 frames, then this shot fades in over it during the last xf/2 frames. */
const FadeIn: React.FC<{ on: boolean; dip?: boolean; children: React.ReactNode }> = ({ on, dip, children }) => {
  const f = useCurrentFrame();
  const { xf } = useFilm();
  if (on && dip) {
    return (
      <>
        <AbsoluteFill style={{ opacity: ramp(f, 0, xf / 2, IO) }}><TutoBackdrop /></AbsoluteFill>
        <AbsoluteFill style={{ opacity: ramp(f, xf / 2, xf, IO) }}>{children}</AbsoluteFill>
      </>
    );
  }
  return <AbsoluteFill style={{ opacity: on ? ramp(f, 0, xf) : 1 }}>{children}</AbsoluteFill>;
};

/** `views`: the film's schematics by view name. `cues`: its cue list (export-cues.mjs). `sparkle`: which success notes
 * get a sparkle (TutoAudio). */
export const TutoFilm: React.FC<{ film: FilmRuntime; views: CardViews; cues: Cue[]; sparkle: RegExp; bgm: boolean }> = ({ film, views, cues, sparkle, bgm }) => {
  const g = useCurrentFrame();
  return (
    <FilmCtx.Provider value={film}>
      <AbsoluteFill style={{ backgroundColor: '#111827' }}>
        {film.order.map((id, i) => (
          <Sequence key={id} from={film.start[id]} durationInFrames={film.shots[id].dur} name={id}>
            <ShotCtx.Provider value={{ g0: film.start[id], dur: film.shots[id].dur }}>
              <FadeIn on={i > 0} dip={entersByDip(film, id)}>
                <ShotView id={id} views={views} />
              </FadeIn>
            </ShotCtx.Provider>
          </Sequence>
        ))}
        <ChapterDim g={g} />
        <StepHeader g={g} />
        <ChapterCard g={g} />
        <CornerTag g={g} />
        <SubtitleBar g={g} />
        <TutoAudio bgm={bgm} cues={cues} sparkle={sparkle} />
      </AbsoluteFill>
    </FilmCtx.Provider>
  );
};
