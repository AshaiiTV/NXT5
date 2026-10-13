// Single source of truth for timing. Everything is expressed in film beats k.
// Music: g-eazy-nba-type.mp3 (Mixkit "G Eazy NBA type", Arulo). Grid measured on strong onsets
// (analysis/geazy5.py → geazy130.json): 130.003 BPM — the "86 BPM" label is the dotted-quarter 3-3-2 kick
// pattern —, mean |residual| 4.7 ms, no drift. The film starts 16 beats before the drop (music 9.0085 s);
// public/audio/bgm.wav is trimmed there (prepare-audio.sh).
export const FPS = 30;
export const BEAT_INT = 0.46152823; // s
export const MUSIC_START_SEC = 9.0085; // audit value: music time of film beat 0 (drop 16.393 s − 16 beats)
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // measured after render (music-beat-sync §5b)
export const beatT = (k: number) => OUTPUT_AUDIO_OFFSET_SEC + k * BEAT_INT;
export const beatF = (k: number) => Math.round(beatT(k) * FPS);

export type Shot = { from: number; to: number };
const shot = (a: number, b: number): Shot => ({ from: beatF(a), to: beatF(b) });

/**
 * Music structure (film beats): k0–8 quiet intro · k8–16 build · k16 DROP · k44–48 one-bar dip ·
 * k48 return · k76 breakdown. Slams (R4: ≤3, ≥16 beats apart): k16, k48, k76.
 */
export const SHOTS = {
  hook: shot(0, 16),
  brand: shot(16, 24),
  analyse: shot(24, 34),
  draft: shot(34, 44),
  card: shot(44, 48),
  debrief: shot(48, 60),
  planning: shot(60, 68),
  outro: shot(68, 84),
} as const;
export const SLAMS = [16, 48, 76];
export const DURATION = beatF(84) + 6;
export const dur = (s: Shot) => s.to - s.from;
/** Frame (relative to the shot start) of film beat k. */
export const localBeat = (s: Shot, k: number) => beatF(k) - s.from;
