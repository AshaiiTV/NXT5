// Sound of the TutoImporter tutorial: one low, steady music bed (Mixkit « tech house », bgm-tech-house.mp3, Mixkit
// Stock Music Free License) and discreet foley pinned on the cue list (cues.json, from export-cues.mjs): a real
// switch click on every click, a soft swoosh on chapter changes, keys on paste/typing, a light sparkle on the main
// successes. Each cue is corrected for the sample's peak lag and the pipeline's output audio offset (1.27 f, as in
// the promo: sound-design §4.6).
import React from 'react';
import { Audio, interpolate, Sequence, staticFile } from 'remotion';
import cues from './cues.json';

const OUT_F = 1.27;
const PEAK: Record<string, number> = { 'switch-click-quick.mp3': 0, 'swoosh-quick.mp3': 9.9, 'typewriter-hit-soft.mp3': 4.2, 'sparkle-touch.mp3': 14.1, 'keyboard.mp3': 0 };
type Cue = { frame: number; kind: string; shot: string; note: string };
type Hit = { from: number; src: string; volume: number; duration: number; trimBefore?: number; label: string };
const hit = (peak: number, src: string, volume: number, label: string, duration = 60, trimBefore?: number): Hit => ({
  from: Math.max(0, Math.round(peak - (PEAK[src] ?? 0) - OUT_F)), src, volume, duration, trimBefore, label,
});
/** Main successes that get a sparkle (the rest stay silent so the sparkle keeps its meaning). */
const BIG = /téléchargé|connecté|Ta game est prête|Fichier chargé|Partie importée|nouvelle ligne/;

const list = (cues as { cues: Cue[] }).cues;
export const TUTO_SFX: Hit[] = list.flatMap((c): Hit[] => {
  switch (c.kind) {
    case 'click': return [hit(c.frame, 'switch-click-quick.mp3', 0.32, c.note, 20)];
    case 'chapter': return c.frame > 0 ? [hit(c.frame + 4, 'swoosh-quick.mp3', 0.26, c.note, 30)] : [];
    case 'key': case 'paste': return [hit(c.frame, 'typewriter-hit-soft.mp3', 0.3, c.note, 20)];
    case 'typing-start': {
      const end = list.find((x) => x.kind === 'typing-end' && x.frame > c.frame);
      return [{ from: Math.max(0, Math.round(c.frame - OUT_F)), src: 'keyboard.mp3', volume: 0.24, duration: (end ? end.frame : c.frame + 40) - c.frame, trimBefore: 120, label: c.note }];
    }
    case 'success':
      if (c.shot === 'prereq') return [hit(c.frame, 'switch-click-quick.mp3', 0.2, c.note, 20)];
      return BIG.test(c.note) ? [hit(c.frame, 'sparkle-touch.mp3', 0.16, c.note, 60)] : [];
    default: return [];
  }
});

export const TutoAudio: React.FC<{ bgm: boolean; duration: number }> = ({ bgm, duration }) => (
  <>
    {bgm ? (
      <Audio
        src={staticFile('audio/tuto-bgm.mp3')}
        volume={(f) => 0.16 * interpolate(f, [0, 30, duration - 75, duration - 10], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
    ) : null}
    {TUTO_SFX.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.duration} name={`sfx ${s.label}`}>
        <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume} trimBefore={s.trimBefore} />
      </Sequence>
    ))}
  </>
);
