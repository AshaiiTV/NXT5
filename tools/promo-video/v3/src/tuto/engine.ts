// Tutorial engine: the film model shared by every tutorial (TutoImporter, TutoDiscord…). A film is data, one file per
// film (e.g. script.ts for TutoImporter: shots, chapters, subtitles, card texts, capture apps). This module times it
// (makeFilm: shot starts, duration, subtitle track) and derives what the renderers, the sound pass and the QA read
// (chapterAt, entersByDip, buildCues, checkScript). export-cues.mjs loads it with Node type stripping, so it has only
// type imports and erasable TypeScript, and every function takes the film explicitly.
//
// Frames are LOCAL to their shot unless stated otherwise. Shot i starts `xf` frames before shot i−1 ends (cross-fade).
// Real-UI coordinates are CSS px of the capture (the film's captures.json), written « ALIAS.boxKey ».
import type { IconName } from './parts/icons';

export type Pt = [number, number];
export type Rect = { x: number; y: number; w: number; h: number };

/** A point: CSS px of the capture, or a box (anchor fractions, default centre) plus an offset. */
export type PtRef = Pt | { box: string; ax?: number; ay?: number; dx?: number; dy?: number };
/** A rectangle: one box, the union of boxes, or a literal rect (CSS px). */
export type RectRef = string | { boxes: string[] } | { rect: Rect };

/** Camera easings (camera.ts): io = calm in-out for zooms onto a target; glide = sine in-out (peak speed ≈ 1.6 × the
 * mean, against ≈ 3 × for io) for long lateral moves and pull-backs, so they stay under the speed ceiling. */
export type Ease = 'io' | 'out' | 'brand' | 'glide';
/** `slack`: screen px of night allowed beside the window horizontally at this key (default 0 = full-bleed once wider
 * than the frame). Used to keep a target near the page edge clear of the frame edge. Each key is framed on its own,
 * then the camera interpolates between framed keys (camera.ts). `cut`: the camera jumps to this key at its frame,
 * holding the previous key until then. Only while the stage is dipped to night, or on an instant capture swap: either a
 * match cut (the new capture is the same page at another scroll position, and `at` moves by exactly that difference,
 * e.g. the same point of the same control in both captures, so everything that did not change stays still; the
 * page's fixed bars must then be out of frame), or a new framing of a page that the swap re-lays out entirely. */
export type CamKey = { f: number; z: number; at: PtRef; ease?: Ease; slack?: number; cut?: boolean };
/** Capture shown from frame f. No `xf`/`scroll`/`dip`: instant swap (a state change that moves the layout, cut 2 f
 * after the click, under its ripple, or a label whose new width shifts its neighbours). `xf`: dissolve from the
 * previous one, only where the layout stays put (a label or a toast changes); `scroll`: pixel-true scroll of the app's
 * scrolling band (AppSpec.scroll) from the previous capture to this one over `scroll` frames (both captures share the
 * band's sticky bars); `dip`: another page, through night (`dip` frames out, `dip` frames in). */
export type Layer<A extends string = string> = { f: number; cap: A; xf?: number; scroll?: number; dip?: number; note?: string };
export type Move = { f: number; dur: number; to: PtRef };
export type Click = { f: number; label: string };
/** `pulse`: frame of one soft outline growing out of the halo (hover confirmation, no click). `cut`: the halo is at full
 * strength from f0 (no grow-in): it takes over, on an instant capture swap at f0, from a halo the swap cuts. */
export type Halo = { f0: number; f1: number; at: RectRef; pad?: number; radius?: number; spot?: boolean; circle?: boolean; pulse?: number; cut?: boolean };
export type Moment = { f: number; label: string };
/** Typing over the real empty field of capture `cap`: a patch in the field's own colour (`color`) covers `cover`, and
 * the text is drawn in Inter in the field's measured text style (`textStyle`: key of the capture's entry in
 * captures.json holding font size, weight, colour, text x and vertical centre). Drawn text, so only for NXT5's own
 * fields (Inter); any other UI types by Reveal, where every text pixel is the capture's. */
export type Typing<A extends string = string> = { f0: number; f1: number; text: string; cap: A; cover: Rect; color: string; textStyle: string };
export type Keycap = { f0: number; f1: number; keys: string[]; at: PtRef; dx: number; dy: number };
/** Typing by reveal over the REAL typed state `cap` (shown from f0, when the field takes the focus). Until `t0` the
 * field still shows the previous text, copied from the same region of capture `from` (both fields share the same
 * uniform background, so the composite is exact). From `select` (Ctrl + A) that text is shown selected: the site's
 * ::selection colour (rgba(0, 216, 255, .38) over the field, `selection.color`) behind the captured glyphs (blended
 * with « lighten », so the glyph pixels stay the capture's). At t0 the first keystroke replaces the selection: a patch
 * in the field's own colour covers the rest of the field and the capture's own typed text is uncovered glyph by glyph
 * until t1 (`steps`: CSS x after each character, measured on the capture's ink gaps), with a caret at the edge until
 * f1. Every text pixel shown is a capture's. */
export type Reveal<A extends string = string> = {
  f0: number; select: number; t0: number; t1: number; f1: number; text: string; from: A; cap: A;
  cover: Rect; color: string; textX: number; steps: number[]; caret: { y: number; h: number; color: string };
  selection: { rect: Rect; color: string };
};

/** Corner tag of a shot (Chrome.tsx): « Données fictives » (a real screen with fictitious data), « Partie fictive »
 * (a real screen of a third-party app showing the demo game, e.g. a Discord message) or « Illustration ». */
export type Tag = 'fictive' | 'fictiveGame' | 'illustration' | null;

export type CaptureShot<A extends string = string> = {
  kind: 'capture';
  /** Key of the film's `apps` table: how this shot's captures are framed. */
  app: string;
  dur: number;
  layers: Layer<A>[];
  cam: CamKey[];
  /** `cut`: the cursor and its ripple leave with the old screen at this instant capture swap (no fade): a click whose
   * layout change would otherwise leave the arrow and its ripple over another control. `back`: after a `cut`, the
   * cursor fades back in (8 f) at its point of that frame, to go on to another control (move it, while away, to a
   * neutral point). */
  cursor?: { start: PtRef; show: number; hide?: number; cut?: number; back?: number; moves: Move[] };
  clicks: Click[];
  halos: Halo[];
  typing?: Typing<A>;
  reveal?: Reveal<A>;
  keycaps?: Keycap[];
  success?: Moment[];
  /** Cursor rests on a target without clicking (no press, no ripple). */
  hovers?: Moment[];
  /** Context chip beside the window (e.g. the site opening in the browser): not a UI label. `icon`: globe if none. */
  context?: { f0: number; f1: number; title: string; sub: string; icon?: IconName };
  /** Corner tag, when it differs from the default (« Données fictives » on a capture). */
  tag?: Tag;
};
/** A card: `title`, `prereq` and `recap` are drawn by the engine (shots/Cards.tsx, texts from the film); any other
 * view is one of the film's own schematics (TutoFilm `views`). */
export type CardShot<V extends string = string> = {
  kind: 'card';
  view: V;
  dur: number;
  /** Schematic / card beats used by the view (local frames). */
  t: Record<string, number>;
  clicks: Click[];
  success?: Moment[];
  /** Corner tag, when it differs from the default (none on title, prereq and recap; « Illustration » otherwise). */
  tag?: Tag;
};
export type Shot<V extends string = string, A extends string = string> = CaptureShot<A> | CardShot<V>;

export type Chapter<S extends string = string> = { id: string; shot: S; kind: 'title' | 'prereq' | 'step' | 'done' | 'recap'; n?: number; title: string };

/** Subtitles. Line breaks are chosen in the film (max 2 lines). Display markup only: «…» is drawn with its content in
 * cyan (UI label), {…} in violet (file name, braces not drawn), [..] in cyan (UI label, brackets not drawn). French
 * spacing (no-break space before ? ! : ; and inside « ») is applied at render time by `frSpaces`. */
export type Sub<S extends string = string> = { id: string; shot: S; f: number; lines: string[]; verbatim: string };
/** Global subtitle track: start, end (next subtitle, or the next step's chapter card, or the recap). */
export type SubSpan = Sub & { g0: number; g1: number };

/** How one app's captures are framed (the film's `apps` table, read by camera.ts fitOf). `fitH`: CSS height that fills
 * the working-area height at z = 1 (e.g. site 900, importer 790); omitted, each capture's own height is used (native
 * screenshots of varying height, e.g. a Discord window). `density`: texture px per CSS px (2 for the 2x captures of
 * the site and the Importer, 1 for native screenshots); the camera QA keeps the screen scale fit × z ≤ density, so a
 * capture is never drawn larger than its texture. `scroll`: the band that `scroll` layers move, between sticky bars
 * identical in every capture involved; `content` is the box key of the scrolled content, whose top sits at band.y
 * when nothing is scrolled. */
export type AppSpec = { fitH?: number; density: number; scroll?: { band: Rect; content: string } };

/** Exact texts of the engine's cards (not subtitles). */
export type FilmTexts = {
  /** Title card: the title (one line, or two separated by `\n`), its subtitle and a chip (icon + text). `accent`: the
   * word drawn in the spectrum gradient (default: the last one). */
  title: { title: string; sub: string; chip: string; icon: IconName; accent?: string };
  /** « Avant de commencer » checklist: one item per beat t.check1, t.check2… of the prereq card. */
  prereq: { text: string; icon: IconName }[];
  /** « À retenir » items: one per beat t.item1, t.item2… of the recap card. */
  recap: string[];
  /** Legal line, small at the bottom of the recap card; several lines, one under the other. */
  legal?: string | string[];
};

/** A film as data: what one film file exports (FILM) and what makeFilm times. */
export type FilmDef = {
  /** Composition id (cue list header, error messages). */
  id: string;
  fps: number;
  /** Cross-fade between consecutive shots (≤ 12 f, soft cut). */
  xf: number;
  /** Chapter card at the start of each step: the big « Étape N/steps » card, then it settles into the header. */
  card: number;
  shots: Record<string, Shot>;
  order: string[];
  chapters: Chapter[];
  subs: Sub[];
  texts: FilmTexts;
  /** Capture apps: CaptureShot.app → framing and texture density. */
  apps: Record<string, AppSpec>;
  /** Capture alias → id in the film's captures.json. */
  capIds: Record<string, string>;
  /** Framing QA of the whole cursor path (camera.ts checkFraming), not only of its click points: on every frame the
   * arrow is drawn, it stays in the frame and the working area, never parked under the subtitle bar or off frame. Off
   * for TutoImporter, edited before this check. */
  cursorInArea?: boolean;
};
/** A timed film: shot starts (global frames), duration, number of « Étape » chapters, global subtitle track. */
export type Film = FilmDef & { start: Record<string, number>; duration: number; steps: number; subTrack: SubSpan[] };

// ───────────────────────────────────────── text helpers ─────────────────────────────────────────
const NBSP = '\u00a0';
/** French spacing: no-break space before ? ! : ; and inside « ». Idempotent. */
export const frSpaces = (s: string) =>
  s.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
/** Removes display markup ({…} and […]) and joins the lines: must equal the verbatim subtitle. */
export const plainSub = (lines: string[]) => lines.join(' ').replace(/[{}[\]]/g, '');

// ───────────────────────────────────────── global timeline ─────────────────────────────────────────
export const makeFilm = (def: FilmDef): Film => {
  const { shots, order, chapters, subs, xf } = def;
  const start: Record<string, number> = {};
  let t = 0;
  order.forEach((id, i) => {
    start[id] = t;
    t += shots[id].dur - (i < order.length - 1 ? xf : 0);
  });
  const last = order[order.length - 1];
  const duration = start[last] + shots[last].dur;
  const recap = chapters.find((c) => c.kind === 'recap');
  const subTrack: SubSpan[] = subs.map((s, i) => {
    const g0 = start[s.shot] + s.f;
    const next = subs[i + 1];
    let g1 = next ? start[next.shot] + next.f : recap ? start[recap.shot] : duration;
    for (const ch of chapters) {
      const c0 = start[ch.shot];
      if ((ch.kind === 'step' || ch.kind === 'recap') && c0 > g0 && c0 < g1) g1 = c0;
    }
    return { ...s, g0, g1 };
  });
  return { ...def, start, duration, steps: chapters.filter((c) => c.kind === 'step').length, subTrack };
};

export const chapterAt = (film: Film, g: number) => {
  let c = film.chapters[0];
  for (const ch of film.chapters) if (g >= film.start[ch.shot]) c = ch;
  return c;
};

/** How a shot enters. A shot that opens a step chapter cross-fades (xf) under the chapter card and its dim (and the
 * two shots around a step change show the same capture where the story continues in the same app). Every other shot
 * enters through night: the previous one fades to the backdrop over xf/2 frames, this one fades in over xf/2, so two
 * unrelated full-screen views (another app, another page, a schematic) never overlap. */
export const entersByDip = (film: Film, id: string) =>
  film.order.indexOf(id) > 0 && !film.chapters.some((c) => c.shot === id && c.kind === 'step');

// ───────────────────────────────────────── cues for the sound pass ─────────────────────────────────────────
export type Cue = { frame: number; time: string; kind: string; shot: string; note: string };
/** Cue kinds. Between shots: `transition` (cross-fade) or `transition-dip` (through night, app or page change). Inside
 * a shot: `state` (instant swap, put on the click that causes it), `state-fade` (dissolve, layout unchanged),
 * `state-dip` (another page through night), `scroll`. Inputs: `click`, `hover`, `key` (keycap pressed), `paste`,
 * `typing-start` / `typing-end`. Feedback: `success`. */
export function buildCues(film: Film): Cue[] {
  const { order, chapters, shots, start, xf, fps } = film;
  const tc = (f: number) => {
    const s = Math.floor(f / fps);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(f % fps).padStart(2, '0')}`;
  };
  const cues: Cue[] = [];
  const add = (frame: number, kind: string, shot: string, note: string) => cues.push({ frame, time: tc(frame), kind, shot, note });
  for (const ch of chapters) {
    const via = order.indexOf(ch.shot) === 0 ? '' : entersByDip(film, ch.shot) ? ` (entrée par le noir, ${xf / 2} f + ${xf / 2} f)` : ` (fondu enchaîné ${xf} f sous la carte d’étape)`;
    add(start[ch.shot], 'chapter', ch.shot, `${ch.kind === 'step' ? `Étape ${ch.n}/${film.steps} · ${ch.title}` : ch.title}${via}`);
    if (ch.kind === 'step') add(start[ch.shot] + film.card - 16, 'chapter-settle', ch.shot, 'la carte d’étape glisse dans l’en-tête (14 f)');
  }
  order.forEach((id, i) => {
    const g = start[id];
    const s = shots[id];
    if (i > 0 && !chapters.some((c) => c.shot === id)) {
      if (entersByDip(film, id)) add(g, 'transition-dip', id, `passage par le noir vers ${id} (${xf / 2} f + ${xf / 2} f)`);
      else add(g, 'transition', id, `fondu enchaîné (${xf} f) vers ${id}`);
    }
    for (const c of s.clicks) add(g + c.f, 'click', id, c.label);
    for (const m of s.success ?? []) add(g + m.f, 'success', id, m.label);
    if (s.kind === 'capture') {
      for (const h of s.hovers ?? []) add(g + h.f, 'hover', id, h.label);
      for (const l of s.layers.slice(1)) {
        const note = l.note ?? l.cap;
        if (l.scroll) add(g + l.f, 'scroll', id, `${note} (${l.scroll} f)`);
        else if (l.dip) add(g + l.f - l.dip, 'state-dip', id, `${note} : ${l.dip} f vers le noir, ${l.dip} f pour entrer`);
        else if (l.xf) add(g + l.f, 'state-fade', id, `${note} (fondu ${l.xf} f)`);
        else {
          const click = s.clicks.filter((c) => c.f <= l.f && l.f - c.f <= 3).pop();
          add(g + (click ? click.f : l.f), 'state', id, click ? `${note.replace(/ \(coupe franche[^)]*\)/, '')} : coupe franche ${l.f - click.f} f après le clic, sous son onde` : note);
        }
      }
      for (const k of s.keycaps ?? []) {
        const paste = s.typing && s.typing.f0 === s.typing.f1 && s.typing.f0 === k.f0 + 8;
        const select = s.reveal && s.reveal.select === k.f0 + 8;
        if (paste) add(g + k.f0 + 8, 'paste', id, `${k.keys.join(' + ')} : « ${s.typing!.text} » est collé d’un coup`);
        else add(g + k.f0 + 8, 'key', id, `${k.keys.join(' + ')}${select ? ' : le texte pré-rempli est sélectionné' : ''}`);
      }
      if (s.typing && s.typing.f1 > s.typing.f0) {
        add(g + s.typing.f0, 'typing-start', id, `frappe « ${s.typing.text} »`);
        add(g + s.typing.f1, 'typing-end', id, 'fin de la frappe');
      }
      if (s.reveal) {
        add(g + s.reveal.t0, 'typing-start', id, `frappe « ${s.reveal.text} » (${s.reveal.steps.length} caractères, le premier remplace la sélection)`);
        add(g + s.reveal.t1, 'typing-end', id, 'fin de la frappe');
      }
    }
  });
  add(film.duration - 14, 'end', '-', 'fondu de fin');
  // One cue per moment: a success and a dissolve that show the same change at the same frame are merged.
  const out: Cue[] = [];
  for (const c of cues.sort((a, b) => a.frame - b.frame)) {
    const twin = out.find((o) => o.frame === c.frame && o.shot === c.shot && ((o.kind === 'success' && c.kind.startsWith('state')) || (c.kind === 'success' && o.kind.startsWith('state'))));
    if (!twin) { out.push(c); continue; }
    const [succ, st] = twin.kind === 'success' ? [twin, c] : [c, twin];
    Object.assign(twin, { kind: 'success', note: `${succ.note} (même instant, ${st.kind} : ${st.note})` });
  }
  return out;
}

/** Reading speed ceiling of a settled subtitle (characters per second, French subtitling practice). */
export const MAX_CPS = 17;
/** Script sanity checks (thrown by the film's composition in the studio/render, and reported by export-cues.mjs). */
export function checkScript(film: Film): string[] {
  const errors: string[] = [];
  for (const id of film.order) if (!film.shots[id]) errors.push(`plan ${id} inconnu`);
  for (const x of [...film.chapters, ...film.subs]) if (!film.order.includes(x.shot)) errors.push(`${x.id} : plan ${x.shot} hors du montage`);
  if (errors.length) return errors;
  for (const s of film.subs) if (plainSub(s.lines) !== s.verbatim) errors.push(`sous-titre ${s.id} : texte différent du verbatim`);
  // The checklist and recap cards show one item per beat (t.check1…, t.item1…) and are laid out for 3 items at most.
  for (const id of film.order) {
    const s = film.shots[id];
    if (s.kind !== 'card' || (s.view !== 'prereq' && s.view !== 'recap')) continue;
    const [items, beat] = s.view === 'prereq' ? [film.texts.prereq, 'check'] : [film.texts.recap, 'item'];
    if (items.length > 3) errors.push(`${id} : ${items.length} éléments (la carte en prévoit 3 au plus)`);
    items.forEach((_, i) => { if (s.t[`${beat}${i + 1}`] === undefined) errors.push(`${id} : t.${beat}${i + 1} manquant`); });
  }
  for (const sp of film.subTrack) {
    const settled = sp.g1 - sp.g0 - 20; // 12 f entrance, 8 f exit
    if (settled < 75) errors.push(`sous-titre ${sp.id} : ${settled} f lisibles (< 75)`);
    const cps = sp.verbatim.length / (settled / film.fps);
    if (cps > MAX_CPS + 1e-9) errors.push(`sous-titre ${sp.id} : ${cps.toFixed(1)} caractères/s (> ${MAX_CPS})`);
    if (sp.lines.length > 2) errors.push(`sous-titre ${sp.id} : plus de 2 lignes`);
  }
  for (const id of film.order) {
    const s = film.shots[id];
    if (s.kind !== 'capture') continue;
    for (const c of [...s.clicks, ...(s.hovers ?? [])]) {
      const mv = s.cursor?.moves.filter((m) => m.f <= c.f).pop();
      if (!mv) errors.push(`${id} : clic/survol f${c.f} sans déplacement du curseur`);
      else if (c.f < mv.f + mv.dur + (s.clicks.includes(c as Click) ? 6 : 0)) errors.push(`${id} : clic/survol f${c.f} avant l’arrivée du curseur (+6 f) (f${mv.f + mv.dur})`);
    }
    const { cut, back } = s.cursor ?? {};
    if (cut !== undefined) {
      if (back !== undefined && back <= cut) errors.push(`${id} : retour du curseur f${back} avant sa sortie f${cut}`);
      for (const c of s.clicks) if (c.f >= cut && (back === undefined || c.f < back)) errors.push(`${id} : clic f${c.f} pendant l’absence du curseur (f${cut}${back === undefined ? '' : `–f${back}`})`);
    }
    for (let i = 1; i < s.cam.length; i++) if (s.cam[i].f <= s.cam[i - 1].f) errors.push(`${id} : clés caméra non croissantes`);
  }
  return errors;
}
