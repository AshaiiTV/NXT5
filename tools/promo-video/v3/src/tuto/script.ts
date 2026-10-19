// Tutorial « Importer une partie dans NXT5 » — the whole film as data (storyboard: TUTO-IMPORTER.md).
// One source of truth for every frame number: shots and their durations, chapters, subtitles (verbatim), camera keys,
// cursor moves, clicks, highlight halos, capture swaps and success moments. The renderers in this folder read it, and
// export-cues.mjs reads it (Node type stripping, so this file has no imports and only erasable TypeScript) to print
// the cue list for the sound pass.
//
// Frames are LOCAL to their shot unless stated otherwise. Shot i starts XF frames before shot i−1 ends (cross-fade).
// Real-UI coordinates are CSS px of the capture (src/tuto/captures.json), written « ALIAS.boxKey ».

export const FPS = 30;
/** Cross-fade between consecutive shots (≤ 12 f, soft cut). */
export const XF = 10;
/** Chapter card at the start of each step: the big « Étape N/6 » card, then it settles into the header. */
export const CARD = 40;
/** A subtitle that follows a chapter card starts here (local frame of the chapter's first shot). */
export const SUB_AFTER_CARD = 38;

export type Pt = [number, number];
export type Rect = { x: number; y: number; w: number; h: number };
export type CapAlias =
  | 'I01' | 'I02' | 'I02b' | 'I02c' | 'I03' | 'I04' | 'I05' | 'I06' | 'I07' | 'I08'
  | 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S05b' | 'S06' | 'S07' | 'S07b' | 'S08' | 'S09' | 'S10';

export const CAP_IDS: Record<CapAlias, string> = {
  I01: 'importer-01-accueil-client-connecte',
  I02: 'importer-02-client-non-detecte',
  I02b: 'importer-02b-recherche-du-client',
  I02c: 'importer-02c-client-reconnecte',
  I03: 'importer-03-champ-focus-vide',
  I04: 'importer-04-id-saisi',
  I05: 'importer-05-progression-1-match',
  I06: 'importer-06-progression-2-timeline',
  I07: 'importer-07-progression-3-fichier',
  I08: 'importer-08-resultat',
  S01: 'site-01-parties',
  S02: 'site-02-dialogue-import',
  S03: 'site-03-obtenir-importer',
  S04: 'site-04-aide-ouverture-windows',
  S05: 'site-05-fichier-charge',
  S05b: 'site-05b-fichier-charge-sans-notification',
  S06: 'site-06-notre-equipe',
  S07: 'site-07-equipe-adverse',
  S07b: 'site-07b-nom-saisi',
  S08: 'site-08-nom-tags-pret-a-importer',
  S09: 'site-09-partie-importee',
  S10: 'site-10-liste-avec-partie',
};

/** A point: CSS px of the capture, or a box (anchor fractions, default centre) plus an offset. */
export type PtRef = Pt | { box: string; ax?: number; ay?: number; dx?: number; dy?: number };
/** A rectangle: one box, the union of boxes, or a literal rect (CSS px). */
export type RectRef = string | { boxes: string[] } | { rect: Rect };

/** Camera easings (camera.ts): io = calm in-out for zooms onto a target; glide = sine in-out (peak speed ≈ 1.6 × the
 * mean, against ≈ 3 × for io) for long lateral moves and pull-backs, so they stay under the speed ceiling. */
export type Ease = 'io' | 'out' | 'brand' | 'glide';
/** `slack`: screen px of night allowed beside the window horizontally at this key (default 0 = full-bleed once wider
 * than the frame). Used to keep a target near the page edge clear of the frame edge. Each key is framed on its own,
 * then the camera interpolates between framed keys (camera.ts). `cut`: the camera jumps to this key at its frame
 * (only while the stage is dipped to night). */
export type CamKey = { f: number; z: number; at: PtRef; ease?: Ease; slack?: number; cut?: boolean };
/** Capture shown from frame f. No `xf`/`scroll`/`dip`: instant swap (a state change that moves the layout, cut 2 f
 * after the click, under its ripple, or a label whose new width shifts its neighbours). `xf`: dissolve from the previous one, only where the layout stays put (a label
 * or a toast changes); `scroll`: pixel-true scroll of the import dialog from the previous capture to this one over
 * `scroll` frames (both captures share the dialog's sticky bars); `dip`: another page, through night (`dip` frames
 * out, `dip` frames in). */
export type Layer = { f: number; cap: CapAlias; xf?: number; scroll?: number; dip?: number; note?: string };
export type Move = { f: number; dur: number; to: PtRef };
export type Click = { f: number; label: string };
/** `pulse`: frame of one soft outline growing out of the halo (hover confirmation, no click). `cut`: the halo is at full
 * strength from f0 (no grow-in): it takes over, on an instant capture swap at f0, from a halo the swap cuts. */
export type Halo = { f0: number; f1: number; at: RectRef; pad?: number; radius?: number; spot?: boolean; circle?: boolean; pulse?: number; cut?: boolean };
export type Moment = { f: number; label: string };
export type Typing = { f0: number; f1: number; text: string; cap: CapAlias; cover: Rect };
export type Keycap = { f0: number; f1: number; keys: string[]; at: PtRef; dx: number; dy: number };
/** Typing by reveal over the REAL typed state `cap` (shown from f0, when the field takes the focus). Until `t0` the
 * field still shows the previous text, copied from the same region of capture `from` (both fields share the same
 * uniform background, so the composite is exact). From `select` (Ctrl + A) that text is shown selected: the site's
 * ::selection colour (rgba(0, 216, 255, .38) over the field, `selection.color`) behind the captured glyphs (blended
 * with « lighten », so the glyph pixels stay the capture's). At t0 the first keystroke replaces the selection: a patch
 * in the field's own colour covers the rest of the field and the capture's own typed text is uncovered glyph by glyph
 * until t1 (`steps`: CSS x after each character, measured on the capture's ink gaps), with a caret at the edge until
 * f1. Every text pixel shown is a capture's. */
export type Reveal = {
  f0: number; select: number; t0: number; t1: number; f1: number; text: string; from: CapAlias; cap: CapAlias;
  cover: Rect; color: string; textX: number; steps: number[]; caret: { y: number; h: number; color: string };
  selection: { rect: Rect; color: string };
};

export type CaptureShot = {
  kind: 'capture';
  app: 'importer' | 'site';
  dur: number;
  layers: Layer[];
  cam: CamKey[];
  /** `cut`: the cursor and its ripple leave with the old screen at this instant capture swap (no fade): a click whose
   * layout change would otherwise leave the arrow and its ripple over another control. */
  cursor?: { start: PtRef; show: number; hide?: number; cut?: number; moves: Move[] };
  clicks: Click[];
  halos: Halo[];
  typing?: Typing;
  reveal?: Reveal;
  keycaps?: Keycap[];
  success?: Moment[];
  /** Cursor rests on a target without clicking (no press, no ripple). */
  hovers?: Moment[];
  /** Context chip beside the window (e.g. the site opening in the browser): not a UI label. */
  context?: { f0: number; f1: number; title: string; sub: string };
};
export type CardShot = {
  kind: 'card';
  view: 'title' | 'prereq' | 'recap' | 'download' | 'openFile' | 'smartscreen' | 'lolOpen' | 'lolHistory' | 'saveJson' | 'pickFile';
  dur: number;
  /** Schematic / card beats used by the view (local frames). */
  t: Record<string, number>;
  clicks: Click[];
  success?: Moment[];
};
export type Shot = CaptureShot | CardShot;

// ───────────────────────────────────────── shots ─────────────────────────────────────────
// Camera: `at` is the capture point placed at the centre of the working area, `z` multiplies the fit scale
// (whole capture in the area at z = 1). Sharpness: screen scale = fit × z stays ≤ 2 (2x textures).

export const SHOTS = {
  // 0 · Titre (5 s)
  title: { kind: 'card', view: 'title', dur: 160, t: { mark: 4, title: 14, sub: 34, chip: 52 }, clicks: [] },

  // 1 · Avant de commencer (7 s)
  prereq: { kind: 'card', view: 'prereq', dur: 220, t: { in: 0, check1: 36, check2: 72, check3: 108 }, clicks: [],
    success: [{ f: 36, label: 'coche 1' }, { f: 72, label: 'coche 2' }, { f: 108, label: 'coche 3' }] },

  // 2a + 2b · Étape 1 — dans Parties (déjà ouvert : survol et halo, sans clic) → « Importer une partie » → « Obtenir
  // NXT5 Importer » → « Télécharger »
  dlSite: {
    kind: 'capture', app: 'site', dur: 380,
    layers: [
      { f: 0, cap: 'S01' },
      { f: 158, cap: 'S02', xf: 6, note: 'la fenêtre « Importer une partie » s’ouvre' },
      { f: 216, cap: 'S03', note: 'la section « Obtenir NXT5 Importer » se déplie (coupe franche 2 f après le clic)' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 60, z: 1, at: [720, 450] },
      // Holds are framed so that the soft clip edges fall between text lines (no half-faded line), and the page top
      // (site logo) is either fully in view or out of it. 36 px of night left of the window keep the « Parties » halo
      // clear of the frame edge.
      { f: 86, z: 1.9, at: [440, 230], slack: 36 },
      { f: 114, z: 1.9, at: [440, 230], slack: 36 },
      // « Parties » (left) → « Importer une partie » (top right): pull back to the whole page, then in (16 + 18 f)
      { f: 130, z: 1.3, at: [720, 300], ease: 'glide' },
      { f: 148, z: 1.9, at: [1080, 310], ease: 'glide' },
      { f: 168, z: 1.9, at: [1080, 310] },
      { f: 202, z: 1.75, at: [560, 520], ease: 'glide' },
      { f: 226, z: 1.75, at: [560, 520] },
      { f: 252, z: 2.25, at: [452, 562] },
    ],
    cursor: {
      start: [700, 640], show: 54,
      moves: [
        { f: 72, dur: 18, to: { box: 'S01.sidebarParties', ax: 0.45, ay: 0.7 } },
        { f: 130, dur: 18, to: { box: 'S01.importButton', ax: 0.88, ay: 0.8 } },
        { f: 186, dur: 18, to: [592, 584] },
        { f: 234, dur: 18, to: { box: 'S03.versionSelect', ax: 0.62, ay: 0.72 } },
        { f: 298, dur: 16, to: { box: 'S03.downloadButton', ax: 0.9, ay: 0.8 } },
      ],
    },
    clicks: [
      { f: 156, label: '« Importer une partie »' },
      { f: 214, label: '« Pas encore de fichier ? Obtenir NXT5 Importer »' },
      { f: 326, label: '« Télécharger »' },
    ],
    halos: [
      { f0: 88, f1: 116, at: 'S01.sidebarParties' },
      { f0: 142, f1: 156, at: 'S01.importButton' },
      { f0: 198, f1: 214, at: { rect: { x: 220, y: 550, w: 386, h: 44 } } },
      { f0: 246, f1: 296, at: 'S03.versionSelect' },
      { f0: 310, f1: 348, at: 'S03.downloadButton' },
    ],
    // S01 is already the Parties page (the item is highlighted in the menu): the cursor only points it out.
    hovers: [{ f: 98, label: '« Parties » (menu latéral), page déjà ouverte : survol sans clic' }],
  },

  // 2c · le fichier arrive dans « Téléchargements » (schéma)
  dlFile: { kind: 'card', view: 'download', dur: 164, t: { arc: 4, fly: 10, land: 44, check: 50 }, clicks: [],
    success: [{ f: 50, label: 'fichier téléchargé' }] },

  // 3a · Étape 2 — aide « Ouvrir NXT5 Importer », onglet Windows
  openHelp: {
    kind: 'capture', app: 'site', dur: 230,
    layers: [{ f: 0, cap: 'S04' }],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 50, z: 1, at: [720, 450] },
      { f: 78, z: 2.0, at: [720, 643] },
    ],
    clicks: [],
    halos: [{ f0: 84, f1: 222, at: 'S04.helpSteps', pad: 12 }],
  },

  // 3a (fin) · double-clic sur le fichier téléchargé (schéma « Téléchargements », comme 2c)
  openFile: { kind: 'card', view: 'openFile', dur: 80, t: { in: 0, open: 52 },
    clicks: [{ f: 42, label: 'double-clic (1/2) sur « NXT5-Importer-Windows-0.3.8.exe » (schéma)' }, { f: 48, label: 'double-clic (2/2) (schéma)' }] },

  // 3b · protection Windows (schéma, deux clics)
  smartscreen: { kind: 'card', view: 'smartscreen', dur: 254, t: { in: 0, reveal: 72, done: 158 },
    clicks: [{ f: 66, label: '« Informations complémentaires » (schéma)' }, { f: 144, label: '« Exécuter quand même » (schéma)' }],
    success: [{ f: 160, label: 'NXT5 Importer s’ouvre (schéma)' }] },

  // 4a · Étape 3 — client LoL ouvert (schéma)
  lolOpen: { kind: 'card', view: 'lolOpen', dur: 192, t: { in: 0, client: 52, arrow: 92, importer: 112 }, clicks: [],
    success: [{ f: 52, label: 'point vert « client ouvert » (schéma)' }] },

  // 4b + 4c · indicateur du client dans l’Importer, puis actualisation
  clientStatus: {
    kind: 'capture', app: 'importer', dur: 330,
    // Instant swaps, no dissolve: the status label changes width, which shifts the centred tab group by 2–15 px (a
    // dissolve would double-expose the whole tab bar).
    layers: [
      { f: 0, cap: 'I01' },
      { f: 140, cap: 'I02', note: 'cas « Client LoL non détecté » (coupe franche)' },
      { f: 208, cap: 'I02b', note: '« Recherche du client… » (coupe franche 2 f après le clic)' },
      { f: 240, cap: 'I02c', note: 'retour à « Client LoL connecté » (coupe franche)' },
    ],
    cam: [
      { f: 0, z: 1, at: [590, 395] },
      { f: 8, z: 1, at: [590, 395] },
      { f: 38, z: 2.0, at: [905, 196] },
    ],
    cursor: {
      start: [990, 300], show: 170,
      moves: [{ f: 176, dur: 18, to: { box: 'I02.refreshClient', ax: 0.64, ay: 0.68 } }],
    },
    clicks: [{ f: 206, label: 'icône d’actualisation « Vérifier le client »' }],
    halos: [
      // cut with the capture at 140; the halo on the wider « Client LoL non détecté » label takes over at full strength
      { f0: 42, f1: 140, at: 'I01.clientIndicator', pad: 8, spot: true },
      { f0: 140, f1: 184, at: 'I02.clientIndicator', pad: 8, spot: true, cut: true },
      { f0: 188, f1: 206, at: 'I02.refreshClient', circle: true, pad: 4 },
      { f0: 246, f1: 322, at: 'I02c.clientIndicator', pad: 8, spot: true },
    ],
    success: [{ f: 240, label: '« Client LoL connecté » (point vert)' }],
  },

  // 5a · Étape 4 — historique du client LoL (schéma), copie de l’identifiant
  lolHistory: { kind: 'card', view: 'lolHistory', dur: 232, t: { in: 0, show: 40, expand: 82, pill: 138 },
    clicks: [{ f: 80, label: 'une partie de l’historique (schéma)' }, { f: 132, label: 'icône de copie de l’identifiant (schéma générique)' }],
    success: [{ f: 140, label: 'presse-papiers « EUW1_7861632138 »' }] },

  // 5b · coller l’identifiant dans « Identifiant du match »
  pasteId: {
    kind: 'capture', app: 'importer', dur: 216,
    layers: [
      { f: 0, cap: 'I01' },
      { f: 50, cap: 'I03', xf: 3, note: 'champ focalisé, vide' },
      { f: 74, cap: 'I04', xf: 4, note: 'fin du calque de collage = capture réelle de l’ID collé' },
    ],
    cam: [
      { f: 0, z: 1, at: [590, 395] },
      { f: 6, z: 1, at: [590, 395] },
      // « Exporter la game » stays fully below the soft bottom edge while the field is the subject
      { f: 34, z: 1.76, at: [868, 296] },
      { f: 98, z: 1.76, at: [868, 296] },
      { f: 124, z: 1.76, at: [868, 485], ease: 'glide' },
    ],
    cursor: {
      start: [720, 610], show: 6,
      moves: [{ f: 20, dur: 18, to: { box: 'I01.gameIdInput', ax: 0.62, ay: 0.64 } }],
    },
    clicks: [{ f: 48, label: '« Identifiant du match »' }],
    halos: [
      { f0: 32, f1: 62, at: 'I01.gameIdInput', pad: 6 },
      { f0: 126, f1: 206, at: { boxes: ['I04.regionSelect', 'I04.regionHint'] }, pad: 8 },
    ],
    // Ctrl + V: the ID appears whole on the V press (keycap f0 + 8), as a paste does (f0 = f1).
    typing: { f0: 66, f1: 66, text: 'EUW1_7861632138', cap: 'I03', cover: { x: 629, y: 306, w: 476, h: 40 } },
    keycaps: [{ f0: 58, f1: 104, keys: ['Ctrl', 'V'], at: { box: 'I03.gameIdInput', ax: 1, ay: 0 }, dx: -96, dy: -48 }],
  },

  // 6a · Étape 5 — « Exporter la game », progression 1 Match → 2 Timeline → 3 Fichier
  exportRun: {
    kind: 'capture', app: 'importer', dur: 222,
    layers: [
      { f: 0, cap: 'I04' },
      { f: 76, cap: 'I05', note: 'carte de progression, étape 1 Match (coupe franche 2 f après le clic)' },
      { f: 130, cap: 'I06', xf: 8, note: 'étape 2 Timeline' },
      { f: 172, cap: 'I07', xf: 8, note: 'étape 3 Fichier' },
    ],
    cam: [
      { f: 0, z: 1.76, at: [868, 485] },
      // the pan up to the progress card starts on the cut
      { f: 76, z: 1.76, at: [868, 485] },
      { f: 110, z: 1.76, at: [868, 228], ease: 'glide' },
    ],
    // The cut to I05 moves the form down under the arrow: the cursor and its ripple leave with I04 (otherwise they
    // would sit on « Serveur de jeu », which reads as a click there). The progress card needs no pointer.
    cursor: {
      start: { box: 'I01.gameIdInput', ax: 0.62, ay: 0.64 }, show: 0, cut: 76,
      moves: [{ f: 44, dur: 16, to: { box: 'I04.submitButton', ax: 0.36, ay: 0.72 } }],
    },
    clicks: [{ f: 74, label: '« Exporter la game »' }],
    halos: [
      { f0: 58, f1: 72, at: 'I04.submitButton', pad: 6 },
      { f0: 108, f1: 134, at: 'I05.progressStep1', pad: 2 },
      { f0: 134, f1: 176, at: 'I06.progressStep2', pad: 2 },
      { f0: 176, f1: 216, at: 'I07.progressStep3', pad: 2 },
    ],
  },

  // 6b · « Enregistrer le JSON NXT5 » (schéma)
  saveJson: { kind: 'card', view: 'saveJson', dur: 172, t: { in: 0, folder: 22, drop: 94, done: 118 },
    clicks: [{ f: 88, label: '« Enregistrer » (schéma)' }], success: [{ f: 118, label: 'fichier .json enregistré (schéma)' }] },

  // 6c · « Ta game est prête. »
  ready: {
    kind: 'capture', app: 'importer', dur: 160,
    layers: [{ f: 0, cap: 'I08' }],
    cam: [
      { f: 0, z: 1.2, at: [800, 335] },
      { f: 6, z: 1.2, at: [800, 335] },
      { f: 34, z: 1.76, at: [868, 228] },
    ],
    clicks: [],
    halos: [
      { f0: 38, f1: 82, at: { boxes: ['I08.resultIcon', 'I08.resultEyebrow', 'I08.resultHeading'] }, pad: 8 },
      // « 10 joueurs · 25 min 00 · Timeline incluse » only: the source pill (« Riot via NXT5 ») is not singled out
      // until the owner confirms where a custom scrim comes from (PARCOURS C3). Literal rect: the three pills with
      // 4 px of padding left/top/bottom and 1.4 px on the right, so the ring stays clear of the source pill.
      { f0: 78, f1: 120, at: { rect: { x: 616.84, y: 244.3, w: 262.66, h: 34.5 } }, pad: 0 },
      { f0: 116, f1: 156, at: { rect: { x: 620.8, y: 286.8, w: 302, h: 17.6 } }, pad: 6 },
    ],
    success: [{ f: 4, label: '« Ta game est prête. »' }],
  },

  // 7a (1/2) · Étape 6 — « Ouvrir NXT5 »
  openSite: {
    kind: 'capture', app: 'importer', dur: 100,
    layers: [{ f: 0, cap: 'I08' }],
    cam: [
      { f: 0, z: 1.76, at: [868, 228] },
      { f: 40, z: 1.76, at: [868, 228] },
      { f: 62, z: 2.1, at: [850, 320] },
    ],
    // the cursor is gone before the dip to the site (hide + 8 f = start of the transition)
    cursor: { start: [990, 420], show: 36, hide: 82, moves: [{ f: 44, dur: 18, to: { box: 'I08.openNxt5Button', ax: 0.93, ay: 0.8 } }] },
    clicks: [{ f: 74, label: '« Ouvrir NXT5 »' }],
    halos: [{ f0: 56, f1: 96, at: 'I08.openNxt5Button', pad: 4 }],
  },

  // 7a (2/2) · nxt5.org s’ouvre sur Parties : « Importer une partie », puis « Choisir mon fichier »
  siteImport: {
    kind: 'capture', app: 'site', dur: 159,
    layers: [
      { f: 0, cap: 'S01' },
      { f: 82, cap: 'S02', xf: 6, note: 'la fenêtre « Importer une partie » s’ouvre' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 44, z: 1, at: [720, 450] },
      { f: 70, z: 1.9, at: [1080, 310] },
      { f: 88, z: 1.9, at: [1080, 310] },
      // button (top right) → « Choisir mon fichier » (left): pull back to the whole dialog, then in (16 + 18 f)
      { f: 104, z: 1.3, at: [720, 450], ease: 'glide' },
      { f: 122, z: 2.1, at: [430, 470], ease: 'glide' },
    ],
    cursor: {
      start: [930, 520], show: 30,
      moves: [
        { f: 50, dur: 18, to: { box: 'S01.importButton', ax: 0.88, ay: 0.8 } },
        { f: 106, dur: 16, to: { box: 'S02.chooseFileButton', ax: 0.92, ay: 0.8 } },
      ],
    },
    clicks: [{ f: 80, label: '« Importer une partie »' }, { f: 130, label: '« Choisir mon fichier »' }],
    halos: [
      { f0: 66, f1: 80, at: 'S01.importButton' },
      { f0: 116, f1: 152, at: 'S02.chooseFileButton' },
    ],
    context: { f0: 8, f1: 44, title: 'nxt5.org', sub: 'dans ton navigateur' },
  },

  // 7b · sélection du fichier (schéma)
  pickFile: { kind: 'card', view: 'pickFile', dur: 156, t: { in: 0, done: 98 },
    clicks: [{ f: 48, label: '« nxt5-EUW1_7861632138.json » (schéma)' }, { f: 92, label: '« Ouvrir » (schéma)' }],
    success: [{ f: 98, label: 'fichier choisi (schéma)' }] },

  // 7c → 7g · revue de l’import puis « Confirmer l’import »
  review: {
    kind: 'capture', app: 'site', dur: 682,
    layers: [
      { f: 0, cap: 'S05' },
      { f: 62, cap: 'S05b', xf: 12, note: 'la notification « Fichier chargé » disparaît' },
      { f: 188, cap: 'S06', scroll: 36, note: 'défilement vers « Notre équipe »' },
      { f: 310, cap: 'S07', scroll: 36, note: 'défilement vers « Équipe adverse »' },
      { f: 452, cap: 'S07b', xf: 4, note: 'champ « Nom de la partie » focalisé (capture réelle du nom saisi, sous le calque de frappe)' },
      { f: 534, cap: 'S08', note: 'tag « Scrim » choisi, « Prêt à importer » (coupe franche 2 f après le clic)' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 8, z: 1, at: [720, 450] },
      { f: 38, z: 2.05, at: [720, 249] },
      { f: 182, z: 2.05, at: [720, 249] },
      { f: 226, z: 1.6, at: [720, 416] },
      { f: 302, z: 1.6, at: [720, 416] },
      { f: 346, z: 1.9, at: [720, 413] },
      { f: 402, z: 1.9, at: [720, 413] },
      { f: 430, z: 1.7, at: [720, 631], ease: 'glide' },
    ],
    cursor: {
      // the cursor is gone before the dip to the game page (hide + 8 f = start of the transition)
      start: [980, 640], show: 30, hide: 664,
      moves: [
        { f: 104, dur: 18, to: { box: 'S05b.blueSide', ax: 0.62, ay: 0.3 } }, // hover only: already selected
        // parked in the left margin (dimmed menu, empty between « Préparation et partage » and the profile) while the
        // rosters are reviewed: never over a name or a profile
        { f: 186, dur: 24, to: [150, 520] },
        // to the name field before the camera glide (402 → 430): it then rides with the field, mid-frame
        { f: 396, dur: 22, to: { box: 'S07.nameInput', ax: 0.62, ay: 0.64 } },
        { f: 504, dur: 16, to: { box: 'S07b.scrimTag', ax: 0.9, ay: 0.82 } },
        { f: 592, dur: 18, to: { box: 'S08.confirmButton', ax: 0.93, ay: 0.8 } },
      ],
    },
    clicks: [
      { f: 450, label: '« Nom de la partie »' },
      { f: 532, label: 'tag « Scrim »' },
      { f: 628, label: '« Confirmer l’import »' },
    ],
    halos: [
      { f0: 40, f1: 98, at: { boxes: ['S05.fileCheck', 'S05.filePanelTitle', 'S05.filePanelText'] }, pad: 10 },
      { f0: 98, f1: 128, at: { boxes: ['S05b.blueSide', 'S05b.redSide'] }, pad: 8 },
      { f0: 124, f1: 180, at: 'S05b.blueSide', pad: 6, pulse: 126 },
      { f0: 230, f1: 302, at: 'S06.allyRoster', pad: 6 },
      { f0: 348, f1: 400, at: { boxes: ['S07.enemy1Role', 'S07.enemy5Role'] }, pad: 8 },
      { f0: 432, f1: 452, at: 'S07.nameInput', pad: 4 }, // the real focus ring takes over at the click
      { f0: 510, f1: 530, at: 'S07b.scrimTag', pad: 4 },
      { f0: 536, f1: 568, at: 'S08.scrimTag', pad: 4 },
      { f0: 576, f1: 616, at: 'S08.footerStatus', pad: 8 },
      { f0: 608, f1: 650, at: 'S08.confirmButton', pad: 4 },
    ],
    // « Nom de la partie » (pre-filled with the Game ID): Ctrl + A selects the text (site ::selection colour, the A press
    // is keycap f0 + 8), the first keystroke replaces the selection, then the name is typed (the real S07b text is
    // revealed glyph by glyph).
    keycaps: [{ f0: 446, f1: 474, keys: ['Ctrl', 'A'], at: { box: 'S07.nameInput', ax: 1, ay: 0 }, dx: -96, dy: -18 }],
    reveal: {
      f0: 452, select: 454, t0: 460, t1: 500, f1: 510, text: 'Scrim Aurore · partie 1', from: 'S07', cap: 'S07b', color: '#111B2D',
      selection: { rect: { x: 247, y: 616.5, w: 143.5, h: 19 }, color: 'rgb(11, 99, 125)' },
      cover: { x: 241, y: 603, w: 462, h: 43 }, textX: 245,
      steps: [258, 267.5, 273.75, 277.5, 291.5, 295.5, 307.25, 316.25, 322.5, 332, 337.5, 346.5, 351, 355.5, 360, 370, 379, 384.5, 391, 394.5, 403.5, 407.5, 414.5],
      caret: { y: 616.5, h: 19, color: '#F1F5F9' },
    },
    success: [{ f: 2, label: 'notification « Fichier chargé »' }],
    hovers: [{ f: 124, label: '« Côté bleu », déjà choisi (équipe reconnue) : survol sans clic' }],
  },

  // 8 · C’est fait — « Partie importée », puis la nouvelle ligne dans la liste
  done: {
    kind: 'capture', app: 'site', dur: 360,
    layers: [
      { f: 0, cap: 'S09' },
      { f: 210, cap: 'S10', dip: 5, note: 'retour à « Toutes les parties » (passage par le noir, caméra immobile)' },
    ],
    cam: [
      { f: 0, z: 1.1, at: [840, 491] },
      { f: 10, z: 1.1, at: [840, 491] },
      // z 1.77 puts the top soft edge in the gap between « +7 300 » and « Notre équipe – adversaires » (the camera is
      // at the page bottom, so the zoom sets where the top edge falls)
      { f: 40, z: 1.77, at: { box: 'S09.toast' }, slack: 40 },
      { f: 104, z: 1.77, at: { box: 'S09.toast' }, slack: 40 },
      // up to the game's title (« Scrim Aurore · partie 1 », « Victoire », duration, side): « c’est ma partie »
      { f: 140, z: 1.77, at: [503, 160], ease: 'glide' },
      // still while the page dips to night; the camera cuts at night, then settles on the new row
      { f: 210, z: 1.5, at: [852, 450], cut: true },
      { f: 242, z: 1.75, at: [852, 436], ease: 'glide' },
    ],
    clicks: [],
    halos: [
      { f0: 42, f1: 104, at: 'S09.toast', pad: 6, spot: true },
      // title + « Victoire » + « Durée : 25:00 · Notre équipe : côté bleu » (literal rect: matchMeta spans the card)
      { f0: 142, f1: 200, at: { rect: { x: 317, y: 127, w: 373, h: 66 } }, pad: 10, spot: true },
      { f0: 240, f1: 352, at: 'S10.newRow', pad: 6, spot: true },
    ],
    success: [{ f: 8, label: 'notification « Partie importée »' }, { f: 242, label: 'nouvelle ligne dans « Toutes les parties »' }],
  },

  // 9 · À retenir (8 s)
  recap: { kind: 'card', view: 'recap', dur: 250, t: { in: 0, item1: 24, item2: 54, item3: 84, brand: 118, out: 236 }, clicks: [],
    success: [{ f: 118, label: 'wordmark + nxt5.org' }] },
} satisfies Record<string, Shot>;

export type ShotId = keyof typeof SHOTS;
export const ORDER: ShotId[] = [
  'title', 'prereq',
  'dlSite', 'dlFile',
  'openHelp', 'openFile', 'smartscreen',
  'lolOpen', 'clientStatus',
  'lolHistory', 'pasteId',
  'exportRun', 'saveJson', 'ready',
  'openSite', 'siteImport', 'pickFile', 'review',
  'done', 'recap',
];

// ───────────────────────────────────────── chapters ─────────────────────────────────────────
export type Chapter = { id: string; shot: ShotId; kind: 'title' | 'prereq' | 'step' | 'done' | 'recap'; n?: number; title: string };
export const CHAPTERS: Chapter[] = [
  { id: 'c0', shot: 'title', kind: 'title', title: 'Titre' },
  { id: 'c1', shot: 'prereq', kind: 'prereq', title: 'Avant de commencer' },
  { id: 'c2', shot: 'dlSite', kind: 'step', n: 1, title: 'Télécharge NXT5 Importer' },
  { id: 'c3', shot: 'openHelp', kind: 'step', n: 2, title: 'Ouvre l’Importer' },
  { id: 'c4', shot: 'lolOpen', kind: 'step', n: 3, title: 'Lance League of Legends' },
  { id: 'c5', shot: 'lolHistory', kind: 'step', n: 4, title: 'Copie l’identifiant de la partie' },
  { id: 'c6', shot: 'exportRun', kind: 'step', n: 5, title: 'Exporte la partie' },
  { id: 'c7', shot: 'openSite', kind: 'step', n: 6, title: 'Importe la partie sur NXT5' },
  { id: 'c8', shot: 'done', kind: 'done', title: 'C’est fait' },
  { id: 'c9', shot: 'recap', kind: 'recap', title: 'À retenir' },
];
export const STEPS = 6;

// ───────────────────────────────────────── subtitles ─────────────────────────────────────────
// Verbatim from TUTO-IMPORTER.md. Line breaks are chosen here (max 2 lines). Display markup only: «…» is drawn with
// its content in cyan (UI label), {…} in violet (file name, braces not drawn), [..] in cyan (UI label, brackets not
// drawn). French spacing (no-break space before ? ! : ; and inside « ») is applied at render time by `frSpaces`.
export type Sub = { id: string; shot: ShotId; f: number; lines: string[]; verbatim: string };
export const SUBS: Sub[] = [
  { id: '2a', shot: 'dlSite', f: SUB_AFTER_CARD, lines: ['Sur nxt5.org, dans [Parties],', 'clique sur « Importer une partie ».'],
    verbatim: 'Sur nxt5.org, dans Parties, clique sur « Importer une partie ».' },
  { id: '2b', shot: 'dlSite', f: 186, lines: ['Déplie « Obtenir NXT5 Importer »,', 'garde « Windows (64 bits) » et clique sur « Télécharger ».'],
    verbatim: 'Déplie « Obtenir NXT5 Importer », garde « Windows (64 bits) » et clique sur « Télécharger ».' },
  { id: '2c', shot: 'dlFile', f: 0, lines: ['Le fichier {NXT5-Importer-Windows-0.3.8.exe}', 'arrive dans tes téléchargements.'],
    verbatim: 'Le fichier NXT5-Importer-Windows-0.3.8.exe arrive dans tes téléchargements.' },
  { id: '3a', shot: 'openHelp', f: SUB_AFTER_CARD, lines: ['Pas d’installation : NXT5 Importer est un programme portable.', 'Double-clique sur le fichier téléchargé.'],
    verbatim: 'Pas d’installation : NXT5 Importer est un programme portable. Double-clique sur le fichier téléchargé.' },
  { id: '3b', shot: 'smartscreen', f: 0, lines: ['Si « Windows a protégé votre ordinateur » apparaît, clique sur', '« Informations complémentaires », puis « Exécuter quand même ».'],
    verbatim: 'Si « Windows a protégé votre ordinateur » apparaît, clique sur « Informations complémentaires », puis « Exécuter quand même ».' },
  { id: '4a', shot: 'lolOpen', f: SUB_AFTER_CARD, lines: ['Ouvre aussi le client League of Legends :', 'l’Importer s’y connecte.'],
    verbatim: 'Ouvre aussi le client League of Legends : l’Importer s’y connecte.' },
  { id: '4b', shot: 'clientStatus', f: 0, lines: ['En haut à droite, « Client LoL connecté » : tout est prêt.'],
    verbatim: 'En haut à droite, « Client LoL connecté » : tout est prêt.' },
  { id: '4c', shot: 'clientStatus', f: 140, lines: ['Sinon, ouvre le client puis clique', 'sur l’icône d’actualisation.'],
    verbatim: 'Sinon, ouvre le client puis clique sur l’icône d’actualisation.' },
  { id: '5a', shot: 'lolHistory', f: SUB_AFTER_CARD, lines: ['Dans l’historique du client LoL,', 'copie l’identifiant de la partie.'],
    verbatim: 'Dans l’historique du client LoL, copie l’identifiant de la partie.' },
  { id: '5b', shot: 'pasteId', f: 0, lines: ['Colle-le dans « Identifiant du match ».', 'Si tu n’as que le numéro, choisis aussi le serveur.'],
    verbatim: 'Colle-le dans « Identifiant du match ». Si tu n’as que le numéro, choisis aussi le serveur.' },
  { id: '6a', shot: 'exportRun', f: SUB_AFTER_CARD, lines: ['Clique sur « Exporter la game ».', 'L’Importer récupère la partie et sa timeline.'],
    verbatim: 'Clique sur « Exporter la game ». L’Importer récupère la partie et sa timeline.' },
  { id: '6b', shot: 'saveJson', f: 0, lines: ['Enregistre le fichier {.json}', '(par défaut dans Téléchargements).'],
    verbatim: 'Enregistre le fichier .json (par défaut dans Téléchargements).' },
  { id: '6c', shot: 'ready', f: 0, lines: ['Ta game est prête.', 'Le fichier reste sur ton ordinateur.'],
    verbatim: 'Ta game est prête. Le fichier reste sur ton ordinateur.' },
  { id: '7a', shot: 'openSite', f: SUB_AFTER_CARD, lines: ['Clique sur « Ouvrir NXT5 », puis « Importer une partie »', 'et « Choisir mon fichier ».'],
    verbatim: 'Clique sur « Ouvrir NXT5 », puis « Importer une partie » et « Choisir mon fichier ».' },
  { id: '7b', shot: 'pickFile', f: 0, lines: ['Choisis le fichier {nxt5-EUW1_7861632138.json}.'],
    verbatim: 'Choisis le fichier nxt5-EUW1_7861632138.json.' },
  { id: '7c', shot: 'review', f: 0, lines: ['Le fichier est chargé, rien n’est encore enregistré.', 'Vérifie le côté de ton équipe.'],
    verbatim: 'Le fichier est chargé, rien n’est encore enregistré. Vérifie le côté de ton équipe.' },
  { id: '7d', shot: 'review', f: 186, lines: ['Vérifie les postes et les profils de ton équipe…'],
    verbatim: 'Vérifie les postes et les profils de ton équipe…' },
  { id: '7e', shot: 'review', f: 306, lines: ['… puis les postes adverses.'], verbatim: '… puis les postes adverses.' },
  { id: '7f', shot: 'review', f: 406, lines: ['Nomme la partie et choisis au moins un tag,', 'par exemple « Scrim ».'],
    verbatim: 'Nomme la partie et choisis au moins un tag, par exemple « Scrim ».' },
  { id: '7g', shot: 'review', f: 582, lines: ['Clique sur « Confirmer l’import ».'], verbatim: 'Clique sur « Confirmer l’import ».' },
  { id: '8', shot: 'done', f: 12, lines: ['C’est fait : ta partie est dans NXT5,', 'prête à revoir avec ton équipe.'],
    verbatim: 'C’est fait : ta partie est dans NXT5, prête à revoir avec ton équipe.' },
];

// Cards (not subtitles): exact texts of the title, checklist and recap cards.
export const TITLE_TEXT = { title: 'Importer une partie dans NXT5', sub: 'Du téléchargement à ta partie en ligne.', chip: 'Windows · NXT5 Importer 0.3.8' };
export const PREREQ_ITEMS = ['Un compte NXT5 avec un e-mail vérifié.', 'Une équipe où tu es propriétaire ou staff.', 'Windows 64 bits et League of Legends installé.'];
/** Riot legal line, small at the bottom of the recap card (same wording as the promo's end card, src/shots/Outro.tsx). */
export const RECAP_LEGAL = 'NXT5 n’est ni approuvé ni sponsorisé par Riot Games. Riot Games et les propriétés associées sont des marques de Riot Games, Inc.';
export const RECAP_ITEMS = ['Ouvre le client LoL avant l’Importer.', 'Numéro seul ? Choisis le serveur de la partie.', 'Le fichier .json reste sur ton ordinateur jusqu’à l’import.'];

// ───────────────────────────────────────── text helpers ─────────────────────────────────────────
const NBSP = ' ';
/** French spacing: no-break space before ? ! : ; and inside « ». Idempotent. */
export const frSpaces = (s: string) =>
  s.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
/** Removes display markup ({…} and […]) and joins the lines: must equal the verbatim subtitle. */
export const plainSub = (lines: string[]) => lines.join(' ').replace(/[{}[\]]/g, '');

// ───────────────────────────────────────── global timeline ─────────────────────────────────────────
export const START: Record<ShotId, number> = (() => {
  const out = {} as Record<ShotId, number>;
  let t = 0;
  ORDER.forEach((id, i) => {
    out[id] = t;
    t += SHOTS[id].dur - (i < ORDER.length - 1 ? XF : 0);
  });
  return out;
})();
const last = ORDER[ORDER.length - 1];
export const DURATION = START[last] + SHOTS[last].dur;

export const chapterAt = (g: number) => {
  let c = CHAPTERS[0];
  for (const ch of CHAPTERS) if (g >= START[ch.shot]) c = ch;
  return c;
};

/** Global subtitle track: start, end (next subtitle, or the next step's chapter card, or the recap). */
export type SubSpan = Sub & { g0: number; g1: number };
export const SUB_TRACK: SubSpan[] = SUBS.map((s, i) => {
  const g0 = START[s.shot] + s.f;
  const next = SUBS[i + 1];
  let g1 = next ? START[next.shot] + next.f : START.recap;
  for (const ch of CHAPTERS) {
    const c0 = START[ch.shot];
    if ((ch.kind === 'step' || ch.kind === 'recap') && c0 > g0 && c0 < g1) g1 = c0;
  }
  return { ...s, g0, g1 };
});

/** How a shot enters. A shot that opens a step chapter cross-fades (XF) under the chapter card and its dim (and the
 * two shots around a step change show the same capture where the story continues in the same app). Every other shot
 * enters through night: the previous one fades to the backdrop over XF/2 frames, this one fades in over XF/2, so two
 * unrelated full-screen views (another app, another page, a schematic) never overlap. */
export const entersByDip = (id: ShotId) => ORDER.indexOf(id) > 0 && !CHAPTERS.some((c) => c.shot === id && c.kind === 'step');

// ───────────────────────────────────────── cues for the sound pass ─────────────────────────────────────────
export type Cue = { frame: number; time: string; kind: string; shot: ShotId | '-'; note: string };
const tc = (f: number) => {
  const s = Math.floor(f / FPS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(f % FPS).padStart(2, '0')}`;
};
/** Cue kinds. Between shots: `transition` (cross-fade) or `transition-dip` (through night, app or page change). Inside
 * a shot: `state` (instant swap, put on the click that causes it), `state-fade` (dissolve, layout unchanged),
 * `state-dip` (another page through night), `scroll`. Inputs: `click`, `hover`, `key` (keycap pressed), `paste`,
 * `typing-start` / `typing-end`. Feedback: `success`. */
export function buildCues(): Cue[] {
  const cues: Cue[] = [];
  const add = (frame: number, kind: string, shot: ShotId | '-', note: string) => cues.push({ frame, time: tc(frame), kind, shot, note });
  for (const ch of CHAPTERS) {
    const via = ORDER.indexOf(ch.shot) === 0 ? '' : entersByDip(ch.shot) ? ` (entrée par le noir, ${XF / 2} f + ${XF / 2} f)` : ` (fondu enchaîné ${XF} f sous la carte d’étape)`;
    add(START[ch.shot], 'chapter', ch.shot, `${ch.kind === 'step' ? `Étape ${ch.n}/${STEPS} · ${ch.title}` : ch.title}${via}`);
    if (ch.kind === 'step') add(START[ch.shot] + CARD - 16, 'chapter-settle', ch.shot, 'la carte d’étape glisse dans l’en-tête (14 f)');
  }
  ORDER.forEach((id, i) => {
    const g = START[id];
    const s: Shot = SHOTS[id];
    if (i > 0 && !CHAPTERS.some((c) => c.shot === id)) {
      if (entersByDip(id)) add(g, 'transition-dip', id, `passage par le noir vers ${id} (${XF / 2} f + ${XF / 2} f)`);
      else add(g, 'transition', id, `fondu enchaîné (${XF} f) vers ${id}`);
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
  add(DURATION - 14, 'end', '-', 'fondu de fin');
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
/** Script sanity checks (thrown at import time in the studio/render, and by export-cues.mjs). */
export function checkScript(): string[] {
  const errors: string[] = [];
  for (const s of SUBS) if (plainSub(s.lines) !== s.verbatim) errors.push(`sous-titre ${s.id} : texte différent du verbatim`);
  for (const sp of SUB_TRACK) {
    const settled = sp.g1 - sp.g0 - 20; // 12 f entrance, 8 f exit
    if (settled < 75) errors.push(`sous-titre ${sp.id} : ${settled} f lisibles (< 75)`);
    const cps = sp.verbatim.length / (settled / FPS);
    if (cps > MAX_CPS + 1e-9) errors.push(`sous-titre ${sp.id} : ${cps.toFixed(1)} caractères/s (> ${MAX_CPS})`);
    if (sp.lines.length > 2) errors.push(`sous-titre ${sp.id} : plus de 2 lignes`);
  }
  for (const id of ORDER) {
    const s: Shot = SHOTS[id];
    if (s.kind !== 'capture') continue;
    for (const c of [...s.clicks, ...(s.hovers ?? [])]) {
      const mv = s.cursor?.moves.filter((m) => m.f <= c.f).pop();
      if (!mv) errors.push(`${id} : clic/survol f${c.f} sans déplacement du curseur`);
      else if (c.f < mv.f + mv.dur + (s.clicks.includes(c as Click) ? 6 : 0)) errors.push(`${id} : clic/survol f${c.f} avant l’arrivée du curseur (+6 f) (f${mv.f + mv.dur})`);
    }
    for (let i = 1; i < s.cam.length; i++) if (s.cam[i].f <= s.cam[i - 1].f) errors.push(`${id} : clés caméra non croissantes`);
  }
  return errors;
}
