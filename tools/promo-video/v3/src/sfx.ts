// Sound design (video-shotcraft sound-design.md): one declarative table, every cue pinned to a picture action,
// relative to its shot (§4.5) and corrected for the sample's own peak lag and the output audio offset (§4.6).
// Vocabulary: whoosh / impact / riser / sparkle / transition + real foley for real actions (click, keys, cards).
import { beatF, SHOTS } from './timeline';

export type Sfx = { from: number; src: string; volume: number; duration?: number; trimBefore?: number; fadeOut?: number; note: string };

/** Output audio offset of this pipeline (Remotion 4.0.484, AAC 48 kHz, mp4): 2032 samples, measured by
 * cross-correlation on 3 SFX and 3 BGM probes (analysis/sync_check.py, 2026-10-14). */
export const OUTPUT_AUDIO_OFFSET_F = 1.27;
/** Frame of each sample's energy peak from its file start (analysis/sfx_peaks.json). */
const PEAK_F: Record<string, number> = {
  'whoosh-big.mp3': 21.3, 'whoosh-fast.mp3': 21.6, 'swoosh-quick.mp3': 9.9, 'transition-soft.mp3': 13.5,
  'transition-snap.mp3': 3.3, 'air-woosh-deep.mp3': 13.5, 'click-camera.mp3': 5.7, 'keyboard.mp3': 0,
  'riser-cine.mp3': 30.6, 'marker-pen-line.mp3': 1.2, 'riser-cine-hp.mp3': 19.2, 'typewriter-hit-single.mp3': 5.1, 'impact-deep-whoosh.mp3': 16.5, 'bass-hit-short.mp3': 2.4, 'hit-fast-exciting.mp3': 4.2,
  'shimmer-sparkle-sweep.mp3': 27.3, 'sparkle-touch.mp3': 14.1, 'paper-move-quick.mp3': 12.6, 'paper-slide.mp3': 10.5,
};
/** Sequence start so that the sample's peak lands on `peak` (absolute frame). */
const at = (peak: number, src: string) => Math.max(0, Math.round(peak - (PEAK_F[src] ?? 0) - OUTPUT_AUDIO_OFFSET_F));
/** trimBefore (frames) cuts the head of the sample, which shortens its peak lag by the same amount. */
const cue = (peak: number, src: string, volume: number, note: string, extra: Partial<Sfx> = {}): Sfx => ({
  from: at(peak + (extra.trimBefore ?? 0), src), src, volume, note, ...extra,
});

const H = SHOTS.hook.from, B = SHOTS.brand.from, A = SHOTS.analyse.from, D = SHOTS.draft.from, K = SHOTS.card.from;
const DB = SHOTS.debrief.from, P = SHOTS.planning.from, O = SHOTS.outro.from;

// keyboard foley cut exactly to the debrief's writing windows (local frames), each from a different part of the take
const WRITING: [number, number][] = [[14, 27], [31, 39], [41, 56], [58, 69], [70, 86], [87, 92]];

export const SFX: Sfx[] = [
  // 1 hook — spotlight-hero-card: lift = whoosh-big, beam = sparkle, reseat = snap
  cue(H + 20, 'whoosh-big.mp3', 0.36, 'hook: the Victoire row lifts towards the camera', { trimBefore: 6 }),
  cue(H + 36, 'shimmer-sparkle-sweep.mp3', 0.22, 'hook: perimeter beam laps the row'),
  cue(H + 95, 'transition-snap.mp3', 0.42, 'hook: row reseats'),
  cue(H + 109, 'air-woosh-deep.mp3', 0.28, 'hook: pull-back into darkness, sucked into the drop'),
  // 2 brand — slam #1 on the drop
  cue(B, 'impact-deep-whoosh.mp3', 0.5, 'brand: glass 5 lands on the drop (slam #1)'),
  // 3 analyse — real clicks on the chips
  cue(A + 8, 'transition-soft.mp3', 0.3, 'analyse: review card swings in'),
  cue(A + 29, 'click-camera.mp3', 0.6, 'analyse: click on 21:00 (k26, press bottom)'),
  cue(A + 38, 'swoosh-quick.mp3', 0.5, 'analyse: punch-in towards +1 300 or'),
  cue(A + 85, 'click-camera.mp3', 0.55, 'analyse: click on 33:45 (k30, press bottom)'),
  cue(A + 113, 'sparkle-touch.mp3', 0.2, 'analyse: +4 000 or pops with the chart end ring (k32)'),
  // 4 draft — deck-deal-flyin: orbit pull-back whoosh, landings on two alternating samples, fading, merged at the end
  cue(D + 28, 'whoosh-big.mp3', 0.5, 'draft: camera pulls back from the deck'),
  cue(D + 55, 'paper-move-quick.mp3', 0.6, 'draft: Gnar lands'),
  cue(D + 76, 'paper-slide.mp3', 0.62, 'draft: Vi lands'),
  cue(D + 90, 'paper-move-quick.mp3', 0.46, 'draft: Ahri lands'),
  cue(D + 98, 'swoosh-quick.mp3', 0.42, 'draft: Jinx and Braum land as one sweep'),
  cue(D + 106, 'transition-snap.mp3', 0.28, 'draft: board locks'),
  // 5 breath card
  cue(K + 2, 'swoosh-quick.mp3', 0.42, 'card: Et après la partie ? presses in'),
  // 6 debrief — slam #2 when the music returns, then the document writes itself
  cue(DB, 'hit-fast-exciting.mp3', 0.6, 'debrief: card lands (slam #2)'),
  cue(DB, 'bass-hit-short.mp3', 0.4, 'debrief: slam #2 low end'),
  cue(DB + 28, 'typewriter-hit-single.mp3', 0.34, 'debrief: numeral 2 presses (k50)'),
  cue(DB + 55, 'typewriter-hit-single.mp3', 0.3, 'debrief: numeral 3 presses (k52)'),
  ...WRITING.map(([a, b], i): Sfx => ({ from: DB + a, src: 'keyboard.mp3', volume: 0.3, duration: b - a, trimBefore: 45 + i * 70, note: `debrief: writing ${i + 1}` })),
  cue(DB + 139, 'marker-pen-line.mp3', 0.42, 'debrief: coach highlights the action (k58 → k59)', { duration: 14, fadeOut: 3 }),
  // 7 planning — row-embed: the band opens with one transition, rows land silently (visual foley), pull-back whoosh
  cue(P + 5, 'transition-soft.mp3', 0.26, 'planning: agenda band opens'),
  cue(P + 47, 'whoosh-fast.mp3', 0.26, 'planning: pull-back to the full card (k64)'),
  cue(P + 62, 'sparkle-touch.mp3', 0.22, 'planning: five availability checks light up TOP→SUP'),
  cue(P + 70, 'swoosh-quick.mp3', 0.24, 'planning: push to the roles strip, lands k66.5'),
  // 8 outro — group photo: gather whoosh, riser → impact (slam #3) → sparkle
  cue(O + 10, 'whoosh-big.mp3', 0.45, 'outro: pieces fly in around the stage'),
  // the music leaves a ~5 f gap before its second drop: the riser (high-passed copy, so it never covers the drop's
  // bass) stops 3 f before the drop and the impact starts on its attack, so silence → hit stays audible (review 2, N1)
  { from: beatF(76) - 39, src: 'riser-cine-hp.mp3', volume: 0.2, duration: 34, fadeOut: 4, note: 'outro: riser into the launch, cut before the drop' },
  cue(beatF(76), 'impact-deep-whoosh.mp3', 0.45, 'outro: wordmark launch on the second drop (k76, slam #3)', { trimBefore: 15 }),
  cue(O + 121, 'sparkle-touch.mp3', 0.32, 'outro: rule draws under the wordmark'),
];
