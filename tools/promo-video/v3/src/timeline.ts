// Single source of truth for timing. Everything is expressed in film beats k (music beat = 48 + k),
// from the beat grid measured on the kicks of cat-walk.mp3 (analysis/catwalk_grid.json).
export const FPS = 30;
export const BEAT_INT = 0.46155; // s, 129.996 BPM
export const SOURCE_BEAT0 = 0.0179; // s, music beat 0 in cat-walk.mp3 (audit value, never edited)
export const MUSIC_START_BEAT = 48; // the film starts on this music beat (22.172 s); public/audio/bgm.wav is trimmed there
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // measured after render (music-beat-sync §5b)
export const beatT = (k: number) => OUTPUT_AUDIO_OFFSET_SEC + k * BEAT_INT;
export const beatF = (k: number) => Math.round(beatT(k) * FPS);

export type Shot = { from: number; to: number };
const shot = (a: number, b: number): Shot => ({ from: beatF(a), to: beatF(b) });

/** Shot table (film beats). Slams: k16 drop, k52 return, k80 wordmark landing (R4: ≤3, ≥16 beats apart). */
export const SHOTS = {
  hook: shot(0, 16),
  brand: shot(16, 24),
  analyse: shot(24, 32),
  draft: shot(32, 40),
  planning: shot(40, 48),
  card: shot(48, 52),
  debrief: shot(52, 66),
  outro: shot(66, 88),
} as const;
export const SLAMS = [16, 52, 80];
export const DURATION = beatF(88) + 6;
export const dur = (s: Shot) => s.to - s.from;
/** Frame (relative to the shot start) of film beat k. */
export const localBeat = (s: Shot, k: number) => beatF(k) - s.from;
