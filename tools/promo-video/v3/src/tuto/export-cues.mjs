// Prints the cue list of the tutorial (clicks, chapter transitions, success moments…) for the sound pass, and checks
// the script (subtitles, cursor) and the camera (speed and smoothness, camera.ts checkCamera, the same maths as the
// render). Usage (from tools/promo-video/v3): node src/tuto/export-cues.mjs [out.json]
// Needs Node ≥ 22.18 (TypeScript type stripping); script.ts and camera.ts have only type imports and erasable syntax.
import fs from 'node:fs';
const m = await import('./script.ts');
const cam = await import('./camera.ts');
const caps = JSON.parse(fs.readFileSync(new URL('./captures.json', import.meta.url), 'utf8')).captures;
const errors = [...m.checkScript(), ...cam.checkCamera(m.SHOTS, m.ORDER, m.START, cam.makeResolver(caps, m.CAP_IDS))];
const out = {
  composition: 'TutoImporter',
  fps: m.FPS,
  durationInFrames: m.DURATION,
  duration: `${Math.floor(m.DURATION / m.FPS / 60)} min ${String(Math.round((m.DURATION / m.FPS) % 60)).padStart(2, '0')} s`,
  note: 'Frames are absolute (0-based) in the composition. kind: chapter | chapter-settle | transition (cross-fade between shots) | transition-dip (through night: app or page change) | click | hover | key (keycap pressed) | paste | state (instant swap inside a shot, placed on the click that causes it) | state-fade (dissolve, layout unchanged) | state-dip (another page through night inside a shot) | scroll | typing-start | typing-end | success | end. A hover is the cursor resting on a target without clicking (no click sound).',
  shots: Object.fromEntries(m.ORDER.map((id) => [id, { start: m.START[id], dur: m.SHOTS[id].dur }])),
  subtitles: m.SUB_TRACK.map((s) => ({ id: s.id, from: s.g0, to: s.g1, text: s.verbatim })),
  cues: m.buildCues(),
  checks: errors,
};
const json = `${JSON.stringify(out, null, 2)}\n`;
if (process.argv[2]) fs.writeFileSync(process.argv[2], json);
else process.stdout.write(json);
if (errors.length) { console.error('script errors:\n' + errors.join('\n')); process.exit(1); }
