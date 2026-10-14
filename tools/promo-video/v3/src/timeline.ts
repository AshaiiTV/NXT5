// Single source of truth for timing. Everything is expressed in film beats k.
// Music: g-eazy-nba-type.mp3 (Mixkit "G Eazy NBA type", Arulo). Grid measured on strong onsets
// (analysis/geazy5.py → geazy130.json): 130.003 BPM — the "86 BPM" label is the dotted-quarter 3-3-2 kick
// pattern —, mean |residual| 4.7 ms, no drift. Film beat k sits at music 9.0085 + k·T; the film opens on k8
// (music 12.701 s, start of the build, 8 beats before the drop). At k72 the music is spliced on a bar line to
// bar 39 (73.622 s, the build) so the song's second drop (75.469 s) lands on k76, the wordmark launch.
// public/audio/bgm.wav is built by prepare-audio.py, 42.3 ms later than the grid to absorb the output AAC
// priming, so OUTPUT_AUDIO_OFFSET_SEC stays 0 and the picture keeps the exact beat grid.
export const FPS = 30;
export const BEAT_INT = 0.46152823; // s
export const MUSIC_BEAT0_SEC = 9.0085; // audit value: music time of film beat 0 (drop 16.393 s − 16 beats)
/** First film beat (frame 0). */
export const FILM_K0 = 8;
export const MUSIC_START_SEC = MUSIC_BEAT0_SEC + FILM_K0 * 0.46152823; // 12.701 s
/** Film beat where the music jumps to bar 39 (music 73.622 s), so that k76 = the song's second drop. */
export const SPLICE_K = 72;
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // measured after render (music-beat-sync §5b)
export const beatT = (k: number) => OUTPUT_AUDIO_OFFSET_SEC + (k - FILM_K0) * BEAT_INT;
export const beatF = (k: number) => Math.round(beatT(k) * FPS);

export type Shot = { from: number; to: number };
const shot = (a: number, b: number): Shot => ({ from: beatF(a), to: beatF(b) });

/**
 * Music structure (film beats): k8–16 build · k16 DROP · k44–48 one-bar dip · k48 return ·
 * k72–76 build (spliced) · k76 second DROP, full energy to the end (k92). Slams (R4: ≤3, ≥16 beats apart): k16, k48, k76.
 */
export const SHOTS = {
  hook: shot(FILM_K0, 16),
  brand: shot(16, 24),
  analyse: shot(24, 34),
  draft: shot(34, 44),
  card: shot(44, 48),
  debrief: shot(48, 60),
  planning: shot(60, 68),
  outro: shot(68, 92),
} as const;
export const SLAMS = [16, 48, 76];
export const DURATION = beatF(92) + 6;
export const dur = (s: Shot) => s.to - s.from;
/** Frame (relative to the shot start) of film beat k. */
export const localBeat = (s: Shot, k: number) => beatF(k) - s.from;
