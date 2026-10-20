// Prints the cue list of a tutorial film (clicks, chapter transitions, success moments…) for the sound pass, and checks
// the film (engine.ts checkScript: subtitles, cursor) and its camera (camera.ts checkCamera: sharpness, speed and
// smoothness; checkFraming: click points and halos inside the working area; the same maths as the render). Usage (from tools/promo-video/v3):
//   node src/tuto/export-cues.mjs <film> [out.json | --write]
// `--write` writes the cue list the film's composition reads (FILMS below). The importer: node src/tuto/export-cues.mjs
// importer --write (→ src/tuto/cues.json); the Discord bot: discord --write (→ src/tuto-discord/cues.json). Captures
// still marked `placeholder` in the film's captures.json are listed (`placeholders`) and reported on stderr: such a film
// must not ship.
// Needs Node ≥ 22.18 (TypeScript type stripping); engine.ts, camera.ts and each film's data file have only type imports
// and erasable syntax.
import fs from 'node:fs';

/** Film name → its data file (exports FILM), its captures and the cue list its composition reads (paths relative to
 * this file). */
const FILMS = {
  importer: { script: './script.ts', captures: './captures.json', cues: './cues.json' },
  discord: { script: '../tuto-discord/script.ts', captures: '../tuto-discord/captures.json', cues: '../tuto-discord/cues.json' },
};

const [name, dest] = process.argv.slice(2);
const entry = FILMS[name];
if (!entry) {
  console.error(`usage: node src/tuto/export-cues.mjs <${Object.keys(FILMS).join(' | ')}> [out.json | --write]`);
  process.exit(2);
}
const engine = await import('./engine.ts');
const cam = await import('./camera.ts');
const { FILM } = await import(entry.script);
const m = engine.makeFilm(FILM);
const caps = JSON.parse(fs.readFileSync(new URL(entry.captures, import.meta.url), 'utf8')).captures;
const resolver = cam.makeResolver(caps, m.capIds);
const errors = [...engine.checkScript(m), ...cam.checkCamera(m, resolver), ...cam.checkFraming(m, resolver)];
const placeholders = Object.entries(m.capIds).filter(([, id]) => caps[id]?.placeholder).map(([alias, id]) => `${alias} ${id}`);
const out = {
  composition: m.id,
  fps: m.fps,
  durationInFrames: m.duration,
  duration: `${Math.floor(m.duration / m.fps / 60)} min ${String(Math.round((m.duration / m.fps) % 60)).padStart(2, '0')} s`,
  note: 'Frames are absolute (0-based) in the composition. kind: chapter | chapter-settle | transition (cross-fade between shots) | transition-dip (through night: app or page change) | click | hover | key (keycap pressed) | paste | state (instant swap inside a shot, placed on the click that causes it) | state-fade (dissolve, layout unchanged) | state-dip (another page through night inside a shot) | scroll | typing-start | typing-end | success | end. A hover is the cursor resting on a target without clicking (no click sound).',
  shots: Object.fromEntries(m.order.map((id) => [id, { start: m.start[id], dur: m.shots[id].dur }])),
  subtitles: m.subTrack.map((s) => ({ id: s.id, from: s.g0, to: s.g1, text: s.verbatim })),
  cues: engine.buildCues(m),
  checks: errors,
  ...(placeholders.length ? { placeholders } : {}),
};
const json = `${JSON.stringify(out, null, 2)}\n`;
const file = dest === '--write' ? new URL(entry.cues, import.meta.url) : dest;
if (file) fs.writeFileSync(file, json);
else process.stdout.write(json);
if (placeholders.length) console.error(`captures provisoires (placeholder, à remplacer avant publication) : ${placeholders.length}\n  ${placeholders.join('\n  ')}`);
if (errors.length) { console.error('script errors:\n' + errors.join('\n')); process.exit(1); }
