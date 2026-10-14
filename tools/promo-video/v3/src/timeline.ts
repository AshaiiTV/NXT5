// Single source of truth for timing. Film beat k = one beat of the music track as heard in the film.
// Music: g-eazy-nba-type.mp3 (Mixkit "G Eazy NBA type", Arulo). Grid measured on strong onsets
// (analysis/geazy5.py → geazy130.json): 130.003 BPM — the "86 BPM" label is the dotted-quarter 3-3-2 kick
// pattern —, mean |residual| 4.7 ms, no drift. Source beat k sits at music 9.0085 + k·T.
// v3.2 (user: remove the brand still and the planning shot): the film is a montage of whole bars of the song,
// spliced on bar lines (see MUSIC_SEGMENTS, built by prepare-audio.py, 42.3 ms later than the grid to absorb the
// output AAC priming, so OUTPUT_AUDIO_OFFSET_SEC stays 0 and the picture keeps the exact beat grid).
export const FPS = 30;
export const BEAT_INT = 0.46152823; // s
export const MUSIC_BEAT0_SEC = 9.0085; // audit value: music time of source beat 0 (drop 16.393 s − 16 beats)
/** First film beat (frame 0). */
export const FILM_K0 = 8;
/**
 * Film beats [from, to) ← source music (seconds at the segment start). Bar lines only (k ≡ 0 mod 4).
 * k8–36 build, DROP (k16) and full energy · k36–40 the song's hollow bar (source k44) · k40 its return (slam #2)
 * · k52–56 full energy (source k68) · k56–60 the build of bar 39 · k60 the song's SECOND DROP (75.469 s) to the end.
 */
export const MUSIC_SEGMENTS = [
  { from: 8, src: MUSIC_BEAT0_SEC + 8 * 0.46152823 },
  { from: 36, src: MUSIC_BEAT0_SEC + 44 * 0.46152823 },
  { from: 52, src: MUSIC_BEAT0_SEC + 68 * 0.46152823 },
  { from: 56, src: 73.622 },
] as const;
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // measured after render (music-beat-sync §5b)
export const beatT = (k: number) => OUTPUT_AUDIO_OFFSET_SEC + (k - FILM_K0) * BEAT_INT;
export const beatF = (k: number) => Math.round(beatT(k) * FPS);

/**
 * A shot keeps the beat numbers it was designed on (its code uses localBeat(SHOTS.x, k) with those k); `shift`
 * places it on the film: design beat k plays at film beat k + shift.
 */
export type Shot = { from: number; to: number; shift: number };
const shot = (a: number, b: number, shift = 0): Shot => ({ from: beatF(a + shift), to: beatF(b + shift), shift });

/**
 * Film (beats): hook 8–16 · analyse 16–26 (drop on the cut) · draft 26–36 · card 36–40 (hollow bar) · debrief
 * 40–52 (slam #2 on the return) · outro 52–76 (second drop k60 = design k76). Slams (R4: ≤3, ≥16 beats apart):
 * film k16, k40, k60.
 */
export const SHOTS = {
  hook: shot(FILM_K0, 16),
  analyse: shot(24, 34, -8),
  draft: shot(34, 44, -8),
  card: shot(44, 48, -8),
  debrief: shot(48, 60, -8),
  outro: shot(68, 92, -16),
} as const;
export const SLAMS = [16, 40, 60];
export const DURATION = SHOTS.outro.to + 6;
export const dur = (s: Shot) => s.to - s.from;
/** Frame (relative to the shot start) of the shot's design beat k. */
export const localBeat = (s: Shot, k: number) => beatF(k + s.shift) - s.from;
