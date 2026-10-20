// Tutorial « Ajouter le bot NXT5 à ton serveur Discord » — the whole film as data (storyboard: TUTO-DISCORD.md).
// Same model as the Importer tutorial (src/tuto/script.ts): shots and their durations, chapters, subtitles (verbatim),
// camera keys, cursor moves, clicks, halos, capture swaps and success moments, timed and checked by the tutorial engine
// (src/tuto/engine.ts) and drawn by TutoFilm; export-cues.mjs reads it too (Node type stripping: type imports only).
//
// Frames are LOCAL to their shot unless stated otherwise. Shot i starts XF frames before shot i−1 ends (cross-fade).
// Real-UI coordinates are CSS px of the capture (src/tuto-discord/captures.json), written « ALIAS.boxKey ».
// - Site captures (S..): nxt5.org, 1440×900 CSS at 2x, fictitious data.
// - Discord captures (DC..): the owner's real screenshots, PNG px at 1x. Until they are delivered, their entries are
//   placeholders (`placeholder: true`, guessed boxes, marked « PLACEHOLDER » in the render). Every Discord target below
//   is a box reference, so swapping in a real capture and its measured boxes is a change of captures.json only.
import type { AppSpec, Chapter, FilmDef, FilmTexts, PtRef, Shot, Sub } from '../tuto/engine';

export const FPS = 30;
/** Cross-fade between consecutive shots (≤ 12 f, soft cut). */
export const XF = 10;
/** Chapter card at the start of each step: the big « Étape N/6 » card, then it settles into the header. */
export const CARD = 40;
/** A subtitle that follows a chapter card starts here (local frame of the chapter's first shot). */
export const SUB_AFTER_CARD = 38;

export type CapAlias =
  | 'S01' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'S10' | 'S11' | 'S13' | 'S14' | 'S15' | 'S16' | 'S17'
  | 'S18' | 'S20' | 'S21' | 'S22' | 'S23' | 'S24' | 'S25' | 'S26' | 'S27'
  | 'DC01' | 'DC02' | 'DC03' | 'DC04' | 'DC05' | 'DC06' | 'DC08' | 'DC09' | 'DC10' | 'DC11' | 'DC12' | 'DC13' | 'DC14';

export const CAP_IDS: Record<CapAlias, string> = {
  S01: 'site-01-page-bot-discord',
  S04: 'site-04-lien-personnel-confirmer',
  S05: 'site-05-lien-personnel-confirme',
  S06: 'site-06-compte-lie',
  S07: 'site-07-etape1-ajouter-a-discord',
  S08: 'site-08-invitation-ouverte',
  S09: 'site-09-code-de-liaison',
  S10: 'site-10-commande-copiee',
  S11: 'site-11-serveur-relie-salons',
  S13: 'site-13-salon-commandes-choisi',
  S14: 'site-14-salon-commandes-associe',
  S15: 'site-15-salon-publication-choisi',
  S16: 'site-16-salon-publication-ajoute',
  S17: 'site-17-salons-enregistres',
  S18: 'site-18-etape3-test',
  S20: 'site-20-test-recu',
  S21: 'site-21-confirmer-activation',
  S22: 'site-22-diffusion-active',
  S23: 'site-23-partie-exporter-discord',
  S24: 'site-24-dialogue-exporter',
  S25: 'site-25-apercu-partie',
  S26: 'site-26-apercu-bouton-publier',
  S27: 'site-27-publie-sur-discord',
  DC01: 'dc01-oauth-serveur',
  DC02: 'dc02-oauth-autorisations',
  DC03: 'dc03-oauth-autorise',
  DC04: 'dc04-salon-bot-nxt5',
  DC05: 'dc05-commande-lier',
  DC06: 'dc06-reponse-lier',
  DC08: 'dc08-verifier-comptes',
  DC09: 'dc09-compte-lie',
  DC10: 'dc10-commande-connecter',
  DC11: 'dc11-serveur-relie',
  DC12: 'dc12-message-test',
  DC13: 'dc13-partie-publiee',
  DC14: 'dc14-visuel-agrandi',
};

/** Capture apps (engine AppSpec). The site is captured at 2x (screen scale ≤ 2). Its Bot Discord page scrolls under
 * the fixed top bar and sidebar (band identical in S01 → S07); the scroll is measured on the team's bot panel
 * (`teamPanel`), the part both captures share (the account card above it differs). The « Exporter sur Discord » dialog
 * scrolls between its sticky header and its bottom edge (band identical in S25 → S27, content box `preview`).
 * Discord captures are native screenshots (1x): each fills the working area at z = 1 (no fitH). */
export const APPS = {
  site: { fitH: 900, density: 2, scroll: { band: { x: 264, y: 76, w: 1176, h: 824 }, content: 'teamPanel' } },
  siteExport: { fitH: 900, density: 2, scroll: { band: { x: 182, y: 108, w: 1076, h: 775 }, content: 'preview' } },
  discord: { density: 1 },
} satisfies Record<string, AppSpec>;

/** Card views of this film: only the engine's (no schematic: Discord is shown by its real captures alone). */
export type View = 'title' | 'prereq' | 'recap';

/** The same page point in any capture of the page: the top-left of `box`, a control present in both captures, plus
 * (dx, dy). A match cut (engine CamKey `cut`) names the same control and offsets on both sides of an instant swap, so
 * the camera follows the page's scroll difference and everything that did not change stays still. */
const on = (box: string, dx: number, dy: number): PtRef => ({ box, ax: 0, ay: 0, dx, dy });
/** Framing of the Bot Discord assistant's panel (x 549 → 1387) at z 2.4: the frame's left edge falls in the gap between
 * the assistant's tabs and its panel (x ≈ 530, no half-cut tab label), with 140 px of night right of the window. The
 * camera is then at x 1020.5 (PANEL_X), which also keeps the fixed sidebar and top bar out of frame for match cuts. */
const PANEL = { z: 2.4, slack: 140 } as const;
const PANEL_X = 1020.5;
/** Discord windows enter at z 0.86 (as wide as a site capture at z = 1), so the context chip beside them stays legible;
 * the camera then moves in. */
const DISCORD_IN = 0.86;

// ───────────────────────────────────────── shots ─────────────────────────────────────────
// Camera: `at` is the capture point placed at the centre of the working area, `z` multiplies the fit scale (whole
// capture in the area at z = 1). Sharpness: screen scale = fit × z stays ≤ the app's density (site z ≤ 2.45, Discord
// z ≤ 1.40 at 1032 px high). Match cuts on the site are taken at z = 2.4 (PANEL), so the fixed sidebar (x < 264) and
// top bar (y < 76) are out of frame and nothing jumps.

export const SHOTS = {
  // 0 · Titre (5 s)
  title: { kind: 'card', view: 'title', dur: 160, t: { mark: 4, title: 14, sub: 40, chip: 58 }, clicks: [] },

  // 1 · Avant de commencer (7 s)
  prereq: { kind: 'card', view: 'prereq', dur: 220, t: { in: 0, check1: 36, check2: 72, check3: 108 }, clicks: [],
    success: [{ f: 36, label: 'coche 1' }, { f: 72, label: 'coche 2' }, { f: 108, label: 'coche 3' }] },

  // Étape 1 — page Bot Discord (déjà ouverte : clic sur son entrée du menu), défilement jusqu’à l’assistant, onglet
  // « Serveur », « Ajouter à Discord » (Discord s’ouvre dans un nouvel onglet)
  botPage: {
    kind: 'capture', app: 'site', dur: 320,
    layers: [
      { f: 0, cap: 'S01' },
      { f: 150, cap: 'S07', scroll: 40, note: 'défilement jusqu’à l’assistant « Installer le bot »' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 50, z: 1, at: [720, 450] },
      // 36 px of night left of the window keep the sidebar halo clear of the frame edge
      { f: 80, z: 1.9, at: [300, 317], slack: 36 },
      { f: 118, z: 1.9, at: [300, 317], slack: 36 },
      // whole page while it scrolls down to the assistant
      { f: 146, z: 1, at: [720, 450], ease: 'glide' },
      { f: 196, z: 1, at: [720, 450] },
      { f: 226, z: 1.75, at: [640, 444] },
    ],
    // The arrow starts on the empty band under the page's introduction, inside the frame once the camera moves in. It
    // is gone before the dip to Discord (hide + 8 f = start of the transition).
    cursor: {
      start: [640, 285], show: 54, hide: 302,
      moves: [
        { f: 66, dur: 18, to: { box: 'S01.sidebarBot', ax: 0.45, ay: 0.7 } },
        { f: 260, dur: 20, to: { box: 'S07.inviteButton', ax: 0.86, ay: 0.78 } },
      ],
    },
    // S01 is already the Bot Discord page (the item is highlighted in the menu): the click on it changes nothing.
    clicks: [{ f: 92, label: '« Bot Discord » (menu « Préparation et partage »)' }, { f: 294, label: '« Ajouter à Discord »' }],
    halos: [
      { f0: 84, f1: 124, at: { boxes: ['S01.sidebarGroup', 'S01.sidebarBot'] }, pad: 6 },
      { f0: 228, f1: 262, at: 'S07.stepServer', pad: 6 },
      { f0: 276, f1: 294, at: 'S07.inviteButton', pad: 4 },
    ],
  },

  // Étape 1 (suite) — autorisation dans Discord : serveur, « Continuer », « Administrateur », « Autoriser »
  oauth: {
    kind: 'capture', app: 'discord', dur: 460,
    layers: [
      { f: 0, cap: 'DC01' },
      { f: 128, cap: 'DC02', note: 'liste des autorisations (coupe franche 2 f après le clic)' },
      { f: 386, cap: 'DC03', note: 'page de confirmation (coupe franche 2 f après le clic)' },
    ],
    cam: [
      { f: 0, z: DISCORD_IN, at: [960, 516] },
      { f: 44, z: DISCORD_IN, at: [960, 516] },
      { f: 76, z: 1.25, at: { box: 'DC01.oauthCard' } },
      // still through « Continuer » and its swap: the camera only reframes on DC02's card once the new page is shown
      { f: 128, z: 1.25, at: { box: 'DC01.oauthCard' } },
      { f: 150, z: 1.25, at: { box: 'DC02.oauthCard' } },
      { f: 178, z: 1.4, at: { box: 'DC02.permissions', ay: 0.7 } },
      { f: 386, z: 1.4, at: { box: 'DC02.permissions', ay: 0.7 } },
      { f: 414, z: 1.25, at: { box: 'DC03.confirmation' } },
    ],
    cursor: {
      start: [1500, 720], show: 46, hide: 400,
      moves: [
        { f: 76, dur: 18, to: { box: 'DC01.serverSelect', ax: 0.8, ay: 0.6 } },
        { f: 104, dur: 16, to: { box: 'DC01.continueButton', ax: 0.7, ay: 0.7 } },
        // « Autoriser » may take the place of « Continuer »: once the ripple is over, the arrow waits beside the card
        { f: 150, dur: 18, to: { box: 'DC02.oauthCard', ax: 1, ay: 0.6, dx: 160 } },
        { f: 342, dur: 20, to: { box: 'DC02.authorizeButton', ax: 0.7, ay: 0.7 } },
      ],
    },
    clicks: [{ f: 126, label: '« Continuer » (Discord)' }, { f: 384, label: '« Autoriser » (Discord)' }],
    halos: [
      { f0: 82, f1: 106, at: 'DC01.serverSelect', pad: 6, pulse: 102 },
      { f0: 112, f1: 126, at: 'DC01.continueButton', pad: 4 },
      { f0: 178, f1: 320, at: 'DC02.adminPermission', pad: 6, spot: true },
      { f0: 360, f1: 384, at: 'DC02.authorizeButton', pad: 4 },
      { f0: 396, f1: 446, at: 'DC03.confirmation', pad: 6, spot: true },
    ],
    // the server list is a native list, not captured: the chosen server is shown, then pointed out
    hovers: [{ f: 102, label: 'serveur choisi dans la liste (liste non capturée) : survol' }],
    success: [{ f: 386, label: 'autorisation confirmée : le bot rejoint le serveur' }],
    context: { f0: 8, f1: 44, title: 'Discord', sub: 'autorisation du bot', icon: 'messages' },
    tag: null,
  },

  // Étape 2 — dans Discord : /nxt lier, la réponse privée du bot, « Ouvrir NXT5 »
  lier: {
    kind: 'capture', app: 'discord', dur: 314,
    // the typed command and Discord's command list stay 66 f, long enough to read the entry
    layers: [
      { f: 0, cap: 'DC04' },
      { f: 130, cap: 'DC05', xf: 8, note: '« /nxt lier » tapé, liste des commandes de Discord' },
      { f: 196, cap: 'DC06', note: 'réponse privée du bot « Lier ton compte NXT5 » (coupe franche sur Entrée)' },
    ],
    cam: [
      { f: 0, z: DISCORD_IN, at: [960, 516] },
      // the chip fades out (78 + 10 f) before the window grows towards it
      { f: 88, z: DISCORD_IN, at: [960, 516] },
      { f: 118, z: 1.35, at: { box: 'DC04.messageField', ax: 0.3, ay: 0 } },
    ],
    cursor: {
      start: [1500, 640], show: 84, hide: 296,
      moves: [
        { f: 96, dur: 18, to: { box: 'DC04.messageField', ax: 0.2, ay: 0.5 } },
        { f: 252, dur: 18, to: { box: 'DC06.openButton', ax: 0.7, ay: 0.7 } },
      ],
    },
    clicks: [{ f: 122, label: 'champ de message de #bot-nxt5' }, { f: 288, label: '« Ouvrir NXT5 » (message du bot)' }],
    halos: [
      { f0: 138, f1: 190, at: 'DC05.commandLier', pad: 4 },
      { f0: 202, f1: 256, at: 'DC06.botReply', pad: 6, spot: true },
      { f0: 266, f1: 288, at: 'DC06.openButton', pad: 4 },
    ],
    // keycap above the right end of Discord's command list, clear of its rows (the app's name at their right end) and,
    // after the cut, of the messages (left-aligned) that the key brings in
    keycaps: [{ f0: 188, f1: 210, keys: ['Entrée'], at: { box: 'DC05.commandList', ax: 0.8, ay: 0 }, dx: 0, dy: -36 }],
    success: [{ f: 196, label: 'réponse privée du bot « Lier ton compte NXT5 »' }],
    context: { f0: 42, f1: 78, title: 'Discord', sub: 'salon #bot-nxt5', icon: 'messages' },
    tag: null,
  },

  // Étape 2 (suite) — nxt5.org, ouvert par le lien du bot : vérifier les deux comptes, « Confirmer mon compte NXT5 »
  confirmSite: {
    kind: 'capture', app: 'site', dur: 200,
    // S04 → S05 scroll by 2 px only (12 vs 10): an instant swap without a match cut
    layers: [
      { f: 0, cap: 'S04' },
      { f: 142, cap: 'S05', note: '« À terminer dans Discord » (coupe franche 2 f après le clic)' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 48, z: 1, at: [720, 450] },
      // the account card from the main column's left edge: no sliver of the sidebar
      { f: 78, z: 2, at: [852, 485], slack: 8 },
    ],
    // The arrow waits on the empty right of the account card, inside the frame once the camera moves in. The
    // confirmation box replaces the button under it: the cursor and its ripple leave with the old screen.
    cursor: {
      start: [1250, 615], show: 60, cut: 142,
      moves: [{ f: 110, dur: 18, to: { box: 'S04.confirm', ax: 0.86, ay: 0.75 } }],
    },
    clicks: [{ f: 140, label: '« Confirmer mon compte NXT5 »' }],
    halos: [
      { f0: 80, f1: 120, at: 'S04.pair', pad: 8 },
      { f0: 124, f1: 140, at: 'S04.confirm', pad: 4 },
      { f0: 148, f1: 188, at: { boxes: ['S05.accountBadge', 'S05.feedback'] }, pad: 8, spot: true },
    ],
    success: [{ f: 142, label: '« Compte NXT5 confirmé. Dernière étape dans Discord. »' }],
    context: { f0: 8, f1: 44, title: 'nxt5.org', sub: 'depuis le lien du bot' },
  },

  // Étape 2 (suite) — retour dans Discord : « Vérifier la liaison », puis « Confirmer la liaison »
  verifyDiscord: {
    kind: 'capture', app: 'discord', dur: 190,
    layers: [
      { f: 0, cap: 'DC06' },
      { f: 46, cap: 'DC08', note: 'nouveau message « Vérifie les deux comptes » (coupe franche 2 f après le clic)' },
      { f: 126, cap: 'DC09', note: 'nouveau message « Compte lié » (coupe franche 2 f après le clic)' },
    ],
    cam: [{ f: 0, z: 1.35, at: { box: 'DC06.messageField', ax: 0.3, ay: 0 } }],
    // The new message brings « Annuler » where « Vérifier la liaison » was: the arrow and its ripple leave with the old
    // screen, and the arrow comes back right of the messages while the accounts are checked. After the last click, the
    // new message « Compte lié » comes under the arrow: it fades out.
    cursor: {
      start: [1500, 640], show: 4, cut: 46, back: 64, hide: 126,
      moves: [
        { f: 12, dur: 18, to: { box: 'DC06.verifyButton', ax: 0.7, ay: 0.7 } },
        { f: 50, dur: 1, to: { box: 'DC08.botReply', ax: 1, ay: 0.6, dx: 200 } },
        { f: 98, dur: 16, to: { box: 'DC08.confirmButton', ax: 0.7, ay: 0.7 } },
      ],
    },
    clicks: [{ f: 44, label: '« Vérifier la liaison » (message du bot)' }, { f: 124, label: '« Confirmer la liaison » (message du bot)' }],
    halos: [
      { f0: 28, f1: 44, at: 'DC06.verifyButton', pad: 4 },
      { f0: 52, f1: 100, at: 'DC08.accounts', pad: 8, spot: true },
      { f0: 110, f1: 124, at: 'DC08.confirmButton', pad: 4 },
      { f0: 132, f1: 180, at: 'DC09.linkedReply', pad: 6, spot: true },
    ],
    success: [{ f: 126, label: 'message du bot « Compte lié »' }],
    tag: null,
  },

  // Étape 2 (fin) — nxt5.org : « J’ai confirmé dans Discord · Vérifier », « Compte lié »
  linkedSite: {
    kind: 'capture', app: 'site', dur: 186,
    layers: [
      { f: 0, cap: 'S05' },
      { f: 56, cap: 'S06', note: '« Compte lié » : la carte se replie (coupe franche 2 f après le clic, nouveau cadrage)' },
    ],
    cam: [
      // from the card's title to « J’ai confirmé dans Discord · Vérifier »
      { f: 0, z: 2, at: [852, 542.5], slack: 8 },
      // the page is re-laid out (the account card folds up): new framing on the cut
      { f: 56, z: 2, at: [852, 226.5], slack: 8, cut: true },
    ],
    // the cut slides « Ajouter à Discord » under the arrow: the cursor leaves with the old screen
    cursor: {
      start: [1000, 700], show: 6, cut: 56,
      moves: [{ f: 20, dur: 18, to: { box: 'S05.verify', ax: 0.88, ay: 0.75 } }],
    },
    clicks: [{ f: 54, label: '« J’ai confirmé dans Discord · Vérifier »' }],
    halos: [
      { f0: 34, f1: 54, at: 'S05.verify', pad: 4 },
      { f0: 64, f1: 172, at: 'S06.accountPanel', pad: 6, spot: true },
    ],
    success: [{ f: 56, label: '« Compte lié » sur NXT5' }],
  },

  // Étape 3 — « Créer le code de liaison », puis « Copier la commande »
  codeSite: {
    kind: 'capture', app: 'site', dur: 250,
    layers: [
      { f: 0, cap: 'S08' },
      { f: 102, cap: 'S09', note: 'commande de liaison à usage unique (coupe franche 2 f après le clic, raccord sur le bouton)' },
      { f: 202, cap: 'S10', note: '« Commande copiée. » (coupe franche 2 f après le clic, raccord sur le bouton)' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 44, z: 1, at: [720, 450] },
      // S08 is framed at its bottom (a match cut must not be clamped on either side)
      { f: 76, z: 2.4, at: on('S08.createCode', 251, -64.4) },
      { f: 102, z: 2.4, at: on('S09.createNewCode', 251, -64.4), cut: true },
      { f: 112, z: 2.4, at: on('S09.createNewCode', 251, -64.4) },
      { f: 142, z: 2.4, at: on('S09.copyCommand', 382.5, -95.6), ease: 'glide' },
      { f: 202, z: 2.4, at: on('S10.copyCommand', 382.5, -95.6), cut: true },
      { f: 206, z: 2.4, at: on('S10.copyCommand', 382.5, -95.6) },
      { f: 228, z: 2.4, at: on('S10.copyCommand', 382.5, -53.6), ease: 'glide' },
    ],
    cursor: {
      start: [1000, 650], show: 40, hide: 222,
      moves: [
        { f: 70, dur: 18, to: { box: 'S08.createCode', ax: 0.9, ay: 0.75 } },
        // match cuts: the cursor stays on the same point of the same button in the new capture
        { f: 101, dur: 1, to: { box: 'S09.createNewCode', ax: 0.9, ay: 0.75 } },
        { f: 168, dur: 16, to: { box: 'S09.copyCommand', ax: 0.88, ay: 0.75 } },
        { f: 201, dur: 1, to: { box: 'S10.copyCommand', ax: 0.88, ay: 0.75 } },
        // off « Commande copiée. » while it is read: just right of the message's end
        { f: 206, dur: 12, to: { box: 'S10.copyNotice', ax: 1, ay: 0, dx: 24 } },
      ],
    },
    clicks: [{ f: 100, label: '« Créer le code de liaison »' }, { f: 200, label: '« Copier la commande »' }],
    halos: [
      { f0: 84, f1: 100, at: 'S08.createCode', pad: 4 },
      { f0: 144, f1: 178, at: { boxes: ['S09.command', 'S09.validUntil'] }, pad: 8 },
      { f0: 182, f1: 200, at: 'S09.copyCommand', pad: 4 },
      { f0: 206, f1: 240, at: 'S10.copyNotice', pad: 6, spot: true },
    ],
    success: [{ f: 202, label: '« Commande copiée. »' }],
  },

  // Étape 3 (suite) — Discord : coller la commande, l’envoyer
  connectDiscord: {
    kind: 'capture', app: 'discord', dur: 170,
    layers: [
      { f: 0, cap: 'DC09' },
      { f: 52, cap: 'DC10', note: 'commande collée (coupe franche sur V, comme un collage)' },
      { f: 100, cap: 'DC11', note: 'réponse du bot « Serveur relié à cette équipe NXT5. » (coupe franche sur Entrée)' },
    ],
    cam: [{ f: 0, z: 1.35, at: { box: 'DC09.messageField', ax: 0.3, ay: 0 } }],
    // the click falls right of where the command is pasted (left-aligned), so the arrow never hides its code
    cursor: {
      start: [1500, 640], show: 4, hide: 150,
      moves: [{ f: 12, dur: 18, to: { box: 'DC09.messageField', ax: 0.7, ay: 0.5 } }],
    },
    clicks: [{ f: 38, label: 'champ de message de #bot-nxt5' }],
    halos: [
      { f0: 58, f1: 92, at: 'DC10.command', pad: 6 },
      { f0: 108, f1: 160, at: 'DC11.connectedReply', pad: 6, spot: true },
    ],
    keycaps: [
      { f0: 44, f1: 72, keys: ['Ctrl', 'V'], at: { box: 'DC09.messageField', ax: 0.8, ay: 0 }, dx: 0, dy: -36 },
      { f0: 92, f1: 114, keys: ['Entrée'], at: { box: 'DC10.messageField', ax: 0.8, ay: 0 }, dx: 0, dy: -36 },
    ],
    success: [{ f: 100, label: 'réponse du bot « Serveur relié à cette équipe NXT5. »' }],
    tag: null,
  },

  // Étape 3 (fin) — nxt5.org : « Serveur : Horizon Esport », « Serveur relié »
  linkedServer: {
    kind: 'capture', app: 'site', dur: 130,
    layers: [{ f: 0, cap: 'S11' }],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 10, z: 1, at: [720, 450] },
      // the team's bot panel from its left edge: the frame's left edge in the gap between the sidebar and the panel
      { f: 40, z: 2.1, at: [852, 214] },
    ],
    clicks: [],
    halos: [{ f0: 44, f1: 118, at: { boxes: ['S11.teamServer', 'S11.teamBadge'] }, pad: 8, spot: true }],
    success: [{ f: 10, label: '« Serveur relié » sur NXT5' }],
  },

  // Étape 4 — onglet « Salons » : salon des commandes, « Associer ce salon » ; salon des résultats, « Ajouter ce
  // salon », « Enregistrer les salons » ; « Passer au test et à l’activation ». The native lists are not captured: each
  // choice is a cut on the click, from « Choisir un salon » to the chosen channel (match cut on the field).
  channels: {
    kind: 'capture', app: 'site', dur: 552,
    layers: [
      { f: 0, cap: 'S11' },
      { f: 150, cap: 'S13', note: '#bot-nxt5 choisi (coupe franche 2 f après le clic, raccord sur le champ)' },
      { f: 190, cap: 'S14', note: '« Associé », « Salon des commandes enregistré. » (coupe franche 2 f après le clic)' },
      { f: 298, cap: 'S15', note: '#résultats choisi (coupe franche 2 f après le clic, raccord sur le champ)' },
      { f: 338, cap: 'S16', note: '« #résultats Automatique » ajouté (coupe franche 2 f après le clic, raccord)' },
      { f: 448, cap: 'S17', note: '« Salons enregistrés. » (coupe franche 2 f après le clic, raccord sur le salon)' },
    ],
    cam: [
      { f: 0, z: 2.1, at: [852, 214] },
      { f: 44, z: 2.1, at: [852, 214] },
      { f: 74, z: 1.5, at: [850, 563.5], ease: 'glide' },
      { f: 100, z: 1.5, at: [850, 563.5] },
      { f: 140, ...PANEL, at: on('S11.commandSelect', PANEL_X - 566, -51.1), ease: 'glide' },
      { f: 150, ...PANEL, at: on('S13.commandSelect', PANEL_X - 566, -51.1), cut: true },
      // up a little after the swap: « Associé » (top right) and the saved message in frame together
      { f: 190, ...PANEL, at: [PANEL_X, 338.5] },
      { f: 210, ...PANEL, at: [PANEL_X, 310.5] },
      // down to the publications picker (glide: a long move at z 2.4); the arrow travels with it
      { f: 240, ...PANEL, at: [PANEL_X, 310.5] },
      { f: 280, ...PANEL, at: on('S14.pickerSelect', PANEL_X - 549, -67.9), ease: 'glide' },
      { f: 298, ...PANEL, at: on('S15.pickerSelect', PANEL_X - 549, -67.9), cut: true },
      { f: 338, ...PANEL, at: on('S16.routesTitle', PANEL_X - 549, 134.6), cut: true },
      { f: 344, ...PANEL, at: on('S16.routesTitle', PANEL_X - 549, 134.6) },
      // S16 is framed at its bottom: the match offset is the clamped one
      { f: 392, ...PANEL, at: on('S16.route', PANEL_X - 549, 169.2), ease: 'glide' },
      { f: 448, ...PANEL, at: on('S17.route', PANEL_X - 549, 169.2), cut: true },
      { f: 454, ...PANEL, at: on('S17.route', PANEL_X - 549, 169.2) },
      { f: 478, ...PANEL, at: on('S17.route', PANEL_X - 549, 242.2), ease: 'glide' },
    ],
    // the arrow starts under the « À choisir » badge, right of the text, inside the frame at every zoom of the way in
    cursor: {
      start: [1300, 405], show: 40, hide: 534,
      moves: [
        { f: 118, dur: 18, to: { box: 'S11.commandSelect', ax: 0.8, ay: 0.6 } },
        { f: 149, dur: 1, to: { box: 'S13.commandSelect', ax: 0.8, ay: 0.6 } },
        // right part of « Associer ce salon »: after the swap the arrow rests on the empty panel, beside « Changer le
        // salon » and the saved message
        { f: 164, dur: 14, to: { box: 'S13.associate', ax: 0.75, ay: 0.8 } },
        { f: 244, dur: 46, to: { box: 'S14.pickerSelect', ax: 0.8, ay: 0.6 } },
        { f: 297, dur: 1, to: { box: 'S15.pickerSelect', ax: 0.8, ay: 0.6 } },
        { f: 312, dur: 14, to: { box: 'S15.addChannel', ax: 0.86, ay: 0.78 } },
        { f: 337, dur: 1, to: { box: 'S16.addChannel', ax: 0.86, ay: 0.78 } },
        // down with the camera's glide to « Enregistrer les salons », where it waits while the new row is read
        { f: 350, dur: 50, to: { box: 'S16.save', ax: 0.88, ay: 0.75 } },
        // « Salons enregistrés. » is inserted above the button: the arrow keeps its page point (match cut on the
        // channel row), over the message, then goes on
        { f: 447, dur: 1, to: on('S17.saved', 192.2, 50.4) },
        { f: 496, dur: 18, to: { box: 'S17.nextStep', ax: 0.9, ay: 0.75 } },
      ],
    },
    clicks: [
      { f: 148, label: '« Salon des commandes de l’équipe » (liste)' },
      { f: 188, label: '« Associer ce salon »' },
      { f: 296, label: '« Choisir un salon du serveur » (liste)' },
      { f: 336, label: '« Ajouter ce salon »' },
      { f: 446, label: '« Enregistrer les salons »' },
      { f: 526, label: '« Passer au test et à l’activation »' },
    ],
    halos: [
      { f0: 76, f1: 104, at: 'S11.stepSalons', pad: 6 },
      { f0: 132, f1: 148, at: 'S11.commandSelect', pad: 4 },
      { f0: 150, f1: 166, at: 'S13.commandSelect', pad: 4, cut: true },
      { f0: 172, f1: 188, at: 'S13.associate', pad: 4 },
      { f0: 206, f1: 240, at: { boxes: ['S14.commandBadge', 'S14.commandSaved'] }, pad: 8, spot: true },
      { f0: 280, f1: 296, at: 'S14.pickerSelect', pad: 4 },
      { f0: 298, f1: 314, at: 'S15.pickerSelect', pad: 4, cut: true },
      { f0: 320, f1: 336, at: 'S15.addChannel', pad: 4 },
      { f0: 394, f1: 426, at: { boxes: ['S16.routeName', 'S16.routeAuto'] }, pad: 8 },
      { f0: 430, f1: 446, at: 'S16.save', pad: 4 },
      { f0: 452, f1: 490, at: 'S17.saved', pad: 6, spot: true },
      { f0: 508, f1: 526, at: 'S17.nextStep', pad: 4 },
    ],
    success: [{ f: 190, label: '« Associé » · « Salon des commandes enregistré. »' }, { f: 448, label: '« Salons enregistrés. »' }],
  },

  // Étape 5 — onglet « Activation » : « Envoyer le message de test », « Test reçu sur Discord »
  testSite: {
    kind: 'capture', app: 'site', dur: 214,
    layers: [
      { f: 0, cap: 'S18' },
      { f: 152, cap: 'S20', note: '« Test reçu sur Discord » (coupe franche 2 f après le clic, raccord sur le champ)' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 44, z: 1, at: [720, 450] },
      { f: 74, z: 1.5, at: [850, 519] },
      { f: 100, z: 1.5, at: [850, 519] },
      { f: 140, ...PANEL, at: on('S18.testSelect', PANEL_X - 549, 18.4), ease: 'glide' },
      { f: 152, ...PANEL, at: on('S20.testSelect', PANEL_X - 549, 18.4), cut: true },
    ],
    // The arrow waits under the channel select, right of « Envoyer le message de test » and off the warning text under
    // it. The receipt is inserted where the button was: the cursor leaves with the old screen.
    cursor: {
      start: [1340, 712], show: 60, cut: 152,
      moves: [{ f: 118, dur: 18, to: { box: 'S18.sendTest', ax: 0.88, ay: 0.75 } }],
    },
    clicks: [{ f: 150, label: '« Envoyer le message de test »' }],
    halos: [
      { f0: 76, f1: 104, at: 'S18.stepActivation', pad: 6 },
      { f0: 132, f1: 150, at: 'S18.sendTest', pad: 4 },
      { f0: 158, f1: 200, at: { boxes: ['S20.receiptBadge', 'S20.receiptText'] }, pad: 8, spot: true },
    ],
    success: [{ f: 152, label: '« Test reçu sur Discord »' }],
  },

  // Étape 5 (suite) — Discord : le message de test dans #résultats
  testDiscord: {
    kind: 'capture', app: 'discord', dur: 150,
    layers: [{ f: 0, cap: 'DC12' }],
    cam: [
      { f: 0, z: DISCORD_IN, at: [960, 516] },
      { f: 48, z: DISCORD_IN, at: [960, 516] },
      { f: 78, z: 1.25, at: { box: 'DC12.testMessage' } },
    ],
    clicks: [],
    halos: [{ f0: 82, f1: 138, at: 'DC12.testMessage', pad: 6, spot: true }],
    context: { f0: 8, f1: 44, title: 'Discord', sub: 'salon #résultats', icon: 'messages' },
    tag: 'fictiveGame',
  },

  // Étape 5 (fin) — « Activer la diffusion », récapitulatif, « Confirmer l’activation », « Diffusion active »
  activateSite: {
    kind: 'capture', app: 'site', dur: 430,
    layers: [
      { f: 0, cap: 'S20' },
      { f: 122, cap: 'S21', note: 'récapitulatif « Activer pour Équipe Démo » (coupe franche 2 f après le clic, raccord)' },
      { f: 258, cap: 'S22', note: 'vue d’ensemble « Tout est en place » (coupe franche 2 f après le clic, nouveau cadrage)' },
    ],
    cam: [
      // the test receipt (end of testSite), then down to « Activer la diffusion »
      { f: 0, ...PANEL, at: on('S20.testSelect', PANEL_X - 549, 18.4) },
      { f: 60, ...PANEL, at: on('S20.testSelect', PANEL_X - 549, 18.4) },
      // At the click, z 2.45: the only framing where neither the tabs under the panel (S20) nor the top bar (S21, the
      // page scrolled 413 px further) show at the soft edges of the match cut.
      { f: 96, z: 2.45, slack: 140, at: on('S20.newTest', PANEL_X - 549, 82.8), ease: 'glide' },
      { f: 122, z: 2.45, slack: 140, at: on('S21.newTest', PANEL_X - 549, 82.8), cut: true },
      { f: 130, z: 2.45, slack: 140, at: on('S21.newTest', PANEL_X - 549, 82.8) },
      { f: 160, ...PANEL, at: [PANEL_X, 441], ease: 'glide' },
      // the page is re-laid out as the overview: new framing on the cut, then the publications column
      { f: 258, z: 2.1, at: [852, 387], cut: true },
      { f: 300, z: 2.1, at: [852, 387] },
      // the frame's left edge in the gap between the sidebar and the panel (x 264 → 296)
      { f: 330, z: 2.1, at: [852, 637], ease: 'glide' },
    ],
    // The arrow starts right of the receipt and travels down with the camera. The overview replaces the assistant
    // under the arrow: the cursor leaves with the old screen.
    cursor: {
      start: [1350, 480], show: 20, cut: 258,
      moves: [
        { f: 66, dur: 34, to: on('S20.newTest', 174.7, 218.1) }, // « Activer la diffusion » (ax .88, ay .75)
        { f: 121, dur: 1, to: on('S21.newTest', 174.7, 218.1) },
        // out of the summary as soon as it is cut in: the margin right of its title
        { f: 122, dur: 18, to: { box: 'S21.confirm', ax: 1, ay: 0.15, dx: 24 } },
        { f: 226, dur: 16, to: { box: 'S21.confirmButton', ax: 0.88, ay: 0.75 } },
      ],
    },
    clicks: [{ f: 120, label: '« Activer la diffusion »' }, { f: 256, label: '« Confirmer l’activation »' }],
    halos: [
      { f0: 10, f1: 56, at: { boxes: ['S20.receiptBadge', 'S20.receiptText'] }, pad: 8 },
      { f0: 100, f1: 120, at: 'S20.activate', pad: 4 },
      { f0: 164, f1: 228, at: 'S21.confirm', pad: 6 },
      { f0: 236, f1: 256, at: 'S21.confirmButton', pad: 4 },
      { f0: 264, f1: 300, at: 'S22.nextAction', pad: 6, spot: true },
      { f0: 334, f1: 406, at: { boxes: ['S22.activeBadge', 'S22.destination'] }, pad: 8, spot: true },
    ],
    success: [{ f: 258, label: '« Tout est en place » · « Diffusion active »' }],
  },

  // Étape 6 — une partie : « Exporter sur Discord », « Préparer l’aperçu », aperçu, « Publier dans #résultats »
  exportSite: {
    kind: 'capture', app: 'siteExport', dur: 440,
    layers: [
      { f: 0, cap: 'S23' },
      { f: 134, cap: 'S24', note: 'fenêtre « Exporter sur Discord » (coupe franche 2 f après le clic)' },
      { f: 204, cap: 'S25', note: '« Aperçu de la publication » (coupe franche 2 f après le clic, nouveau cadrage)' },
      { f: 254, cap: 'S26', scroll: 48, note: 'défilement de l’aperçu jusqu’à « Publier dans #résultats »' },
      { f: 352, cap: 'S27', scroll: 20, note: '« Publié sur Discord. » apparaît sous les boutons (défilement de la fenêtre)' },
    ],
    cam: [
      { f: 0, z: 1, at: [720, 450] },
      { f: 44, z: 1, at: [720, 450] },
      { f: 74, z: 1.6, at: [860, 570] },
      // the dialog opens over the page: new framing on the cut, the whole dialog, then closer
      { f: 134, z: 1.6, at: [720, 450], cut: true },
      { f: 164, z: 1.95, at: [720, 462.5] },
      // the dialog grows to the whole height: new framing on the cut, on the preview (under the sticky header)
      { f: 204, z: 2, at: [590, 367.5], cut: true },
      { f: 302, z: 2, at: [590, 367.5] },
      { f: 332, z: 2.2, at: [590, 685.5], ease: 'glide' },
      // after the dialog's scroll: the whole width of « Publié sur Discord. »
      { f: 372, z: 2.2, at: [590, 685.5] },
      { f: 392, z: 2, at: [720, 675] },
    ],
    // The preview opens under the arrow: the cursor and its ripple leave with the old screen, and the arrow comes back
    // in the empty right of the dialog.
    cursor: {
      start: [1000, 640], show: 50, cut: 204, back: 232, hide: 354,
      moves: [
        { f: 100, dur: 18, to: { box: 'S23.share', ax: 0.88, ay: 0.75 } },
        // the dialog covers the button: the arrow moves into the dialog's right margin, above « Destination Discord »
        { f: 138, dur: 14, to: { box: 'S24.dialog', ax: 0.96, ay: 0.3 } },
        { f: 170, dur: 18, to: { box: 'S24.prepare', ax: 0.88, ay: 0.75 } },
        { f: 210, dur: 1, to: [1060, 420] },
        { f: 318, dur: 18, to: { box: 'S26.publish', ax: 0.88, ay: 0.75 } },
      ],
    },
    clicks: [{ f: 132, label: '« Exporter sur Discord »' }, { f: 202, label: '« Préparer l’aperçu »' }, { f: 350, label: '« Publier dans #résultats »' }],
    halos: [
      // the game's name, « Victoire » and its line (literal rect: matchMeta spans the card)
      { f0: 76, f1: 112, at: { rect: { x: 317, y: 431.8, w: 280, h: 66.8 } }, pad: 8 },
      { f0: 114, f1: 132, at: 'S23.share', pad: 4 },
      { f0: 140, f1: 176, at: 'S24.destinationSelect', pad: 6 },
      { f0: 186, f1: 202, at: 'S24.prepare', pad: 4 },
      { f0: 212, f1: 250, at: { boxes: ['S25.embedTitle', 'S25.embedDescription'] }, pad: 8, spot: true },
      { f0: 332, f1: 350, at: 'S26.publish', pad: 4 },
      { f0: 390, f1: 428, at: 'S27.published', pad: 6, spot: true },
    ],
    success: [{ f: 372, label: '« Publié sur Discord. »' }],
  },

  // Étape 6 (fin) — Discord : la partie dans #résultats, clic sur le visuel
  publishedDiscord: {
    kind: 'capture', app: 'discord', dur: 162,
    layers: [{ f: 0, cap: 'DC13' }],
    cam: [
      { f: 0, z: DISCORD_IN, at: [960, 516] },
      { f: 48, z: DISCORD_IN, at: [960, 516] },
      { f: 78, z: 1.25, at: { box: 'DC13.gameMessage' } },
    ],
    // the cursor is gone before the dip to the image viewer (hide + 8 f = start of the transition)
    cursor: {
      start: [1500, 640], show: 70, hide: 144,
      moves: [{ f: 104, dur: 18, to: { box: 'DC13.gameImage', ax: 0.6, ay: 0.5 } }],
    },
    clicks: [{ f: 136, label: 'visuel de la partie (message du bot)' }],
    halos: [
      { f0: 80, f1: 116, at: 'DC13.gameTitle', pad: 6 },
      { f0: 118, f1: 136, at: 'DC13.gameImage', pad: 4 },
    ],
    success: [{ f: 10, label: 'message de la partie dans #résultats' }],
    context: { f0: 8, f1: 44, title: 'Discord', sub: 'salon #résultats', icon: 'messages' },
    tag: 'fictiveGame',
  },

  // C’est fait — le visuel en grand dans Discord
  doneViewer: {
    kind: 'capture', app: 'discord', dur: 276,
    layers: [{ f: 0, cap: 'DC14' }],
    cam: [
      { f: 0, z: 1, at: [960, 516] },
      { f: 20, z: 1, at: [960, 516] },
      { f: 120, z: 1.15, at: { box: 'DC14.viewerImage', ay: 0.4 }, ease: 'glide' },
    ],
    clicks: [],
    halos: [],
    success: [{ f: 8, label: 'visuel de la partie en grand' }],
    tag: 'fictiveGame',
  },

  // À retenir (8 s)
  recap: { kind: 'card', view: 'recap', dur: 250, t: { in: 0, item1: 24, item2: 54, item3: 84, brand: 118, out: 236 }, clicks: [],
    success: [{ f: 118, label: 'wordmark + nxt5.org' }] },
} satisfies Record<string, Shot<View, CapAlias>>;

export type ShotId = keyof typeof SHOTS;
export const ORDER: ShotId[] = [
  'title', 'prereq',
  'botPage', 'oauth',
  'lier', 'confirmSite', 'verifyDiscord', 'linkedSite',
  'codeSite', 'connectDiscord', 'linkedServer',
  'channels',
  'testSite', 'testDiscord', 'activateSite',
  'exportSite', 'publishedDiscord',
  'doneViewer', 'recap',
];

// ───────────────────────────────────────── chapters ─────────────────────────────────────────
export const CHAPTERS: Chapter<ShotId>[] = [
  { id: 'c0', shot: 'title', kind: 'title', title: 'Titre' },
  { id: 'c1', shot: 'prereq', kind: 'prereq', title: 'Avant de commencer' },
  { id: 'c2', shot: 'botPage', kind: 'step', n: 1, title: 'Invite le bot' },
  { id: 'c3', shot: 'lier', kind: 'step', n: 2, title: 'Lie ton compte Discord' },
  { id: 'c4', shot: 'codeSite', kind: 'step', n: 3, title: 'Relie l’équipe au serveur' },
  { id: 'c5', shot: 'channels', kind: 'step', n: 4, title: 'Choisis les salons' },
  { id: 'c6', shot: 'testSite', kind: 'step', n: 5, title: 'Teste et active' },
  { id: 'c7', shot: 'exportSite', kind: 'step', n: 6, title: 'Publie une partie' },
  { id: 'c8', shot: 'doneViewer', kind: 'done', title: 'C’est fait' },
  { id: 'c9', shot: 'recap', kind: 'recap', title: 'À retenir' },
];

// ───────────────────────────────────────── subtitles ─────────────────────────────────────────
// Verbatim from TUTO-DISCORD.md. Line breaks are chosen here (max 2 lines). Display markup only: «…» is drawn with its
// content in cyan (UI label), {…} in violet (a command to type, braces not drawn). French spacing (no-break space
// before ? ! : ; and inside « ») is applied at render time by `frSpaces`.
export const SUBS: Sub<ShotId>[] = [
  { id: '1a', shot: 'botPage', f: SUB_AFTER_CARD, lines: ['Sur nxt5.org, dans « Préparation et partage »,', 'ouvre « Bot Discord ».'],
    verbatim: 'Sur nxt5.org, dans « Préparation et partage », ouvre « Bot Discord ».' },
  { id: '1b', shot: 'botPage', f: 184, lines: ['Dans l’onglet « Serveur »,', 'clique sur « Ajouter à Discord ».'],
    verbatim: 'Dans l’onglet « Serveur », clique sur « Ajouter à Discord ».' },
  { id: '1c', shot: 'oauth', f: 0, lines: ['Discord s’ouvre : choisis ton serveur,', 'puis « Continuer ».'],
    verbatim: 'Discord s’ouvre : choisis ton serveur, puis « Continuer ».' },
  { id: '1d', shot: 'oauth', f: 130, lines: ['Le bot demande l’autorisation « Administrateur » :', 'tous les droits, y compris dans les salons privés.'],
    verbatim: 'Le bot demande l’autorisation « Administrateur » : tous les droits, y compris dans les salons privés.' },
  { id: '1e', shot: 'oauth', f: 330, lines: ['Clique sur « Autoriser » : le bot rejoint ton serveur.'],
    verbatim: 'Clique sur « Autoriser » : le bot rejoint ton serveur.' },
  { id: '2a', shot: 'lier', f: SUB_AFTER_CARD, lines: ['Dans un salon de ton serveur, tape {/nxt lier}', 'et envoie la commande.'],
    verbatim: 'Dans un salon de ton serveur, tape /nxt lier et envoie la commande.' },
  { id: '2b', shot: 'lier', f: 210, lines: ['Le bot te répond en privé :', 'clique sur « Ouvrir NXT5 ».'],
    verbatim: 'Le bot te répond en privé : clique sur « Ouvrir NXT5 ».' },
  { id: '2c', shot: 'confirmSite', f: 24, lines: ['Vérifie les deux comptes et clique', 'sur « Confirmer mon compte NXT5 ».'],
    verbatim: 'Vérifie les deux comptes et clique sur « Confirmer mon compte NXT5 ».' },
  { id: '2d', shot: 'verifyDiscord', f: 0, lines: ['De retour dans Discord : « Vérifier la liaison »,', 'puis « Confirmer la liaison ».'],
    verbatim: 'De retour dans Discord : « Vérifier la liaison », puis « Confirmer la liaison ».' },
  { id: '2e', shot: 'linkedSite', f: 0, lines: ['Sur NXT5, clique sur « J’ai confirmé dans Discord · Vérifier » :', 'ton compte est lié.'],
    verbatim: 'Sur NXT5, clique sur « J’ai confirmé dans Discord · Vérifier » : ton compte est lié.' },
  { id: '3a', shot: 'codeSite', f: SUB_AFTER_CARD, lines: ['Clique sur « Créer le code de liaison »,', 'puis « Copier la commande ».'],
    verbatim: 'Clique sur « Créer le code de liaison », puis « Copier la commande ».' },
  { id: '3b', shot: 'connectDiscord', f: 0, lines: ['Colle la commande dans ton serveur Discord', 'et envoie-la.'],
    verbatim: 'Colle la commande dans ton serveur Discord et envoie-la.' },
  { id: '3c', shot: 'linkedServer', f: 0, lines: ['Sur NXT5, le serveur apparaît : « Serveur relié ».'],
    verbatim: 'Sur NXT5, le serveur apparaît : « Serveur relié ».' },
  { id: '4a', shot: 'channels', f: SUB_AFTER_CARD, lines: ['Onglet « Salons » : choisis le salon des commandes,', 'puis « Associer ce salon ».'],
    verbatim: 'Onglet « Salons » : choisis le salon des commandes, puis « Associer ce salon ».' },
  { id: '4b', shot: 'channels', f: 236, lines: ['Choisis le salon des résultats, « Ajouter ce salon »,', 'puis « Enregistrer les salons ».'],
    verbatim: 'Choisis le salon des résultats, « Ajouter ce salon », puis « Enregistrer les salons ».' },
  { id: '4c', shot: 'channels', f: 446, lines: ['Puis « Passer au test et à l’activation ».'],
    verbatim: 'Puis « Passer au test et à l’activation ».' },
  { id: '5a', shot: 'testSite', f: SUB_AFTER_CARD, lines: ['Onglet « Activation » :', 'clique sur « Envoyer le message de test ».'],
    verbatim: 'Onglet « Activation » : clique sur « Envoyer le message de test ».' },
  { id: '5b', shot: 'testDiscord', f: 0, lines: ['Le message de test arrive dans le salon,', 'visible par ses membres.'],
    verbatim: 'Le message de test arrive dans le salon, visible par ses membres.' },
  { id: '5c', shot: 'activateSite', f: 0, lines: ['Sur NXT5, « Test reçu sur Discord » :', 'clique sur « Activer la diffusion ».'],
    verbatim: 'Sur NXT5, « Test reçu sur Discord » : clique sur « Activer la diffusion ».' },
  { id: '5d', shot: 'activateSite', f: 154, lines: ['Relis le récapitulatif,', 'puis clique sur « Confirmer l’activation ».'],
    verbatim: 'Relis le récapitulatif, puis clique sur « Confirmer l’activation ».' },
  { id: '5e', shot: 'activateSite', f: 300, lines: ['« Diffusion active » : ton équipe peut utiliser le bot.'],
    verbatim: '« Diffusion active » : ton équipe peut utiliser le bot.' },
  { id: '6a', shot: 'exportSite', f: SUB_AFTER_CARD, lines: ['Ouvre une partie et clique sur « Exporter sur Discord ».'],
    verbatim: 'Ouvre une partie et clique sur « Exporter sur Discord ».' },
  { id: '6b', shot: 'exportSite', f: 160, lines: ['Clique sur « Préparer l’aperçu ».'], verbatim: 'Clique sur « Préparer l’aperçu ».' },
  { id: '6c', shot: 'exportSite', f: 260, lines: ['Vérifie l’aperçu, puis clique', 'sur « Publier dans #résultats ».'],
    verbatim: 'Vérifie l’aperçu, puis clique sur « Publier dans #résultats ».' },
  { id: '6d', shot: 'publishedDiscord', f: 0, lines: ['Ta partie est dans le salon.'], verbatim: 'Ta partie est dans le salon.' },
  { id: '7a', shot: 'doneViewer', f: 12, lines: ['C’est fait : ta partie est publiée sur Discord.'],
    verbatim: 'C’est fait : ta partie est publiée sur Discord.' },
  { id: '7b', shot: 'doneViewer', f: 120, lines: ['Les nouvelles parties importées', 'sont ensuite publiées automatiquement.'],
    verbatim: 'Les nouvelles parties importées sont ensuite publiées automatiquement.' },
];

// Cards (not subtitles): exact texts of the title, checklist and recap cards.
export const TITLE_TEXT: FilmTexts['title'] = {
  title: 'Ajouter le bot NXT5\nà ton serveur Discord', accent: 'NXT5', sub: 'De l’invitation à ta première partie publiée.',
  chip: 'nxt5.org · Bot Discord', icon: 'bot',
};
export const PREREQ_ITEMS: FilmTexts['prereq'] = [
  { text: 'Un compte NXT5 avec un e-mail vérifié.', icon: 'mailCheck' },
  { text: 'Propriétaire ou capitaine de l’équipe.', icon: 'users' },
  { text: 'Discord : « Gérer le serveur » ou « Administrateur ».', icon: 'shieldCheck' },
];
/** Legal lines, small at the bottom of the recap card: the Riot line of the Importer tutorial (the game visual shows
 * champion portraits) and Discord's. */
export const RECAP_LEGAL = [
  'NXT5 n’est ni approuvé ni sponsorisé par Riot Games. Riot Games et les propriétés associées sont des marques de Riot Games, Inc.',
  'Discord est une marque de Discord Inc. NXT5 n’est pas affilié à Discord.',
];
export const RECAP_ITEMS = [
  'Lie ton compte avec /nxt lier avant /nxt connecter.',
  'Le code de liaison est valable 10 minutes, une seule fois.',
  'Toute personne qui voit le salon voit les messages publiés.',
];

// ───────────────────────────────────────── the film ─────────────────────────────────────────
export const FILM: FilmDef = {
  id: 'TutoDiscord',
  fps: FPS,
  xf: XF,
  card: CARD,
  shots: SHOTS,
  order: ORDER,
  chapters: CHAPTERS,
  subs: SUBS,
  texts: { title: TITLE_TEXT, prereq: PREREQ_ITEMS, recap: RECAP_ITEMS, legal: RECAP_LEGAL },
  apps: APPS,
  capIds: CAP_IDS,
  cursorInArea: true,
};
