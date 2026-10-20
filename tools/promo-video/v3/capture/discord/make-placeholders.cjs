// Placeholders of the real Discord captures of the tutorial « Ajouter le bot NXT5 à ton serveur Discord » (TutoDiscord),
// until the owner's session (BRIEF-CAPTURES-DISCORD.md) delivers them in public/tuto-discord/real/.
//
// Each placeholder is a neutral dark card (no Discord interface is drawn or imitated): « CAPTURE DISCORD À VENIR · dcNN »,
// the file it stands for and the state the brief asks for, plus the GUESSED target boxes the film aims at, outlined and
// named. The render marks every shot that shows one « PLACEHOLDER » (shots/CaptureShot.tsx): they must never ship.
// The dc* entries written to src/tuto-discord/captures.json carry `placeholder: true`; this script owns only those. An
// entry without the flag is a real, measured capture and is never touched (swap procedure: TUTO-DISCORD.md).
//
// Usage (from the repository root): node tools/promo-video/v3/capture/discord/make-placeholders.cjs
const path = require('node:path');
const fs = require('node:fs');
const { requirePlaywright, chromiumPath } = require('../tuto/lib.cjs');

const { chromium } = requirePlaywright();
const V3 = path.resolve(__dirname, '..', '..');
const OUT = path.join(V3, 'public', 'tuto-discord', 'real', 'placeholder');
const CAPTURES_JSON = path.join(V3, 'src', 'tuto-discord', 'captures.json');
/** Discord window maximised on a 1920×1080 screen at 100 % (taskbar 48 px): the size the brief expects. */
const SIZE = { w: 1920, h: 1032 };

// Guessed boxes (CSS px = PNG px, density 1): a channel list on the left (x 72 → 312), the message column on the right,
// the message field at the bottom; the authorisation page as a centred card. Keys are those the film reads.
const FIELD = { x: 328, y: 964, w: 1576, h: 44 };
const CARD = { x: 700, y: 120, w: 520, h: 800 };
// Where the card's text goes, clear of the guessed boxes: beside the authorisation card, above the bottom messages, or
// right of a tall message.
const LEFT = { x: 60, y: 300, w: 580 };
const ABOVE = { x: 360, y: 150, w: 1520 };
const RIGHT = { x: 1370, y: 260, w: 500 };
const SHOTS = [
  { id: 'dc01-oauth-serveur', n: 1, text: LEFT, expected: 'Page d’autorisation de Discord (navigateur, F11) : le serveur NXT est choisi dans la liste, liste refermée, avant « Continuer ».',
    boxes: { oauthCard: CARD, serverSelect: { x: 732, y: 560, w: 456, h: 48 }, continueButton: { x: 1068, y: 852, w: 120, h: 40 } } },
  { id: 'dc02-oauth-autorisations', n: 2, text: LEFT, expected: 'Après « Continuer » : la liste des autorisations demandées, avec « Administrateur », et le bouton « Autoriser », avant le clic.',
    boxes: { oauthCard: CARD, permissions: { x: 732, y: 330, w: 456, h: 420 }, adminPermission: { x: 732, y: 370, w: 456, h: 36 }, authorizeButton: { x: 1068, y: 852, w: 120, h: 40 } } },
  { id: 'dc03-oauth-autorise', n: 3, text: LEFT, expected: 'Après « Autoriser » : la page de confirmation de Discord.',
    boxes: { oauthCard: CARD, confirmation: { x: 760, y: 380, w: 400, h: 240 } } },
  { id: 'dc04-salon-bot-nxt5', n: 4, text: ABOVE, expected: 'Plan d’ensemble : serveur NXT, catégorie « Tuto NXT5 » dépliée avec #bot-nxt5 et #résultats, salon #bot-nxt5 ouvert, champ de message vide.',
    boxes: { channelList: { x: 72, y: 22, w: 240, h: 958 }, category: { x: 80, y: 210, w: 224, h: 100 }, channelBot: { x: 88, y: 242, w: 216, h: 32 }, messageField: FIELD } },
  { id: 'dc05-commande-lier', n: 5, text: ABOVE, expected: 'Dans #bot-nxt5, « /nxt lier » tapé sans valider : la liste des commandes montre la commande et « Associer ton compte Discord à NXT5. ».',
    boxes: { commandList: { x: 328, y: 780, w: 1576, h: 176 }, commandLier: { x: 336, y: 860, w: 1560, h: 52 }, messageField: FIELD } },
  { id: 'dc06-reponse-lier', n: 6, text: ABOVE, expected: 'Réponse privée du bot « Lier ton compte NXT5 », ses trois étapes et les boutons « Ouvrir NXT5 » et « Vérifier la liaison ».',
    boxes: { botReply: { x: 328, y: 610, w: 1000, h: 330 }, openButton: { x: 392, y: 888, w: 132, h: 36 }, verifyButton: { x: 534, y: 888, w: 170, h: 36 }, messageField: FIELD } },
  { id: 'dc08-verifier-comptes', n: 8, text: ABOVE, expected: 'Après « Vérifier la liaison » : nouveau message « Vérifie les deux comptes », lignes « Discord : … » et « Compte NXT5 : … » masquées, boutons « Confirmer la liaison » et « Annuler ».',
    boxes: { botReply: { x: 328, y: 640, w: 1000, h: 300 }, accounts: { x: 392, y: 700, w: 700, h: 120 }, confirmButton: { x: 392, y: 888, w: 190, h: 36 }, cancelButton: { x: 592, y: 888, w: 100, h: 36 }, messageField: FIELD } },
  { id: 'dc09-compte-lie', n: 9, text: ABOVE, expected: 'Après « Confirmer la liaison » : nouveau message « Compte lié ». Champ de message vide.',
    boxes: { linkedReply: { x: 328, y: 800, w: 1000, h: 140 }, messageField: FIELD } },
  { id: 'dc10-commande-connecter', n: 10, text: ABOVE, expected: 'Dans #bot-nxt5, la commande « /nxt connecter » et son code collés (Ctrl + V), sans valider.',
    boxes: { command: { x: 344, y: 972, w: 640, h: 28 }, messageField: FIELD } },
  { id: 'dc11-serveur-relie', n: 11, text: ABOVE, expected: 'Après validation : la réponse du bot « Serveur relié à cette équipe NXT5. Retourne dans Bot Discord… ».',
    boxes: { connectedReply: { x: 328, y: 800, w: 1100, h: 140 }, messageField: FIELD } },
  { id: 'dc12-message-test', n: 12, text: RIGHT, expected: 'Salon #résultats : le message de test du bot en entier (« Test de connexion NXT5 — données fictives… », embed « TEST NXT5 · Exemple fictif » et son image).',
    boxes: { testMessage: { x: 328, y: 150, w: 1000, h: 800 }, testText: { x: 392, y: 190, w: 900, h: 30 }, testEmbed: { x: 392, y: 240, w: 560, h: 700 } } },
  { id: 'dc13-partie-publiee', n: 13, text: RIGHT, expected: 'Salon #résultats : le message de la partie en entier (« Équipe Démo vs Aurore », « Victoire · 22–11 kills · 25:00 », « Scrim », visuel, « Voir la game sur NXT5 »).',
    boxes: { gameMessage: { x: 328, y: 110, w: 1000, h: 860 }, gameTitle: { x: 400, y: 160, w: 540, h: 92 }, gameImage: { x: 400, y: 262, w: 520, h: 600 }, gameButton: { x: 392, y: 918, w: 220, h: 36 } } },
  { id: 'dc14-visuel-agrandi', n: 14, text: RIGHT, expected: 'Le visuel de la partie ouvert en grand dans la visionneuse d’images de Discord.',
    boxes: { viewerImage: { x: 660, y: 40, w: 600, h: 952 } } },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** French spacing, as on screen (engine frSpaces): no-break space before ? ! : ; and inside « ». */
const fr = (s) => s.replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
const html = (s) => {
  const tag = s.id.slice(0, 4);
  const t = s.text;
  const narrow = t.w < 800;
  const boxes = Object.entries(s.boxes).map(([k, b]) => `
    <div class="box" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"><span>${esc(k)}</span></div>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: ${SIZE.w}px; height: ${SIZE.h}px; overflow: hidden; background: #1A1C21; font-family: Inter, sans-serif; }
    body { background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 2px, transparent 2px 28px); }
    .text { position: absolute; left: ${t.x}px; top: ${t.y}px; width: ${t.w}px; text-align: ${narrow ? 'left' : 'center'}; color: #E5E7EB; }
    h1 { margin: 0; font-size: ${narrow ? 54 : 76}px; line-height: 1.08; font-weight: 800; letter-spacing: -0.02em; }
    .file { margin-top: 18px; font: 600 ${narrow ? 24 : 30}px ui-monospace, 'DejaVu Sans Mono', monospace; color: #FBBF24; }
    .expected { margin-top: 30px; font-size: ${narrow ? 28 : 32}px; font-weight: 500; line-height: 1.4; color: #A1A7B3; }
    .note { margin-top: 24px; font-size: ${narrow ? 22 : 24}px; font-weight: 500; line-height: 1.4; color: #7C8391; }
    .box { position: absolute; box-sizing: border-box; border: 3px dashed rgba(251,191,36,.85); background: rgba(251,191,36,.06); border-radius: 6px; }
    .box span { position: absolute; left: 6px; top: 4px; font-size: 18px; font-weight: 700; color: #FBBF24; }
  </style></head><body>${boxes}
    <div class="text">
      <h1>CAPTURE DISCORD À VENIR · ${tag}</h1>
      <div class="file">${esc(s.id)}.png · capture ${s.n} du brief</div>
      <div class="expected">${esc(fr(s.expected))}</div>
      <div class="note">${fr('Cadres pointillés : cibles supposées du montage, à remplacer par les mesures de la vraie capture.')}</div>
    </div>
  </body></html>`;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const current = fs.existsSync(CAPTURES_JSON) ? JSON.parse(fs.readFileSync(CAPTURES_JSON, 'utf8')) : {};
  const captures = { ...(current.captures || {}) };
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: SIZE.w, height: SIZE.h }, deviceScaleFactor: 1 });
  const made = [];
  for (const s of SHOTS) {
    const prev = captures[s.id];
    if (prev && !prev.placeholder) { console.log(`${s.id} : capture réelle déjà en place, inchangée`); continue; }
    const file = path.join(OUT, `${s.id.slice(0, 4)}.png`);
    await page.setContent(html(s));
    await page.screenshot({ path: file });
    captures[s.id] = {
      file: path.relative(path.join(V3, 'public'), file).split(path.sep).join('/'),
      css: SIZE, app: 'discord', scale: 1, placeholder: true, brief: s.n, expected: s.expected, boxes: s.boxes,
    };
    made.push(s.id);
  }
  await browser.close();
  const sorted = Object.fromEntries(Object.keys(captures).sort().map((k) => [k, captures[k]]));
  const meta = {
    ...(current.meta || {}),
    notes: { ...((current.meta || {}).notes || {}), discord: [
      'Entrées dc* : captures Discord réelles (BRIEF-CAPTURES-DISCORD.md), en px de la PNG (densité 1).',
      'Tant qu’une entrée porte placeholder: true, son image est une carte d’attente (capture/discord/make-placeholders.cjs) et ses boîtes sont supposées. Remplacement : TUTO-DISCORD.md, « Captures Discord ».',
    ] },
  };
  fs.writeFileSync(CAPTURES_JSON, `${JSON.stringify({ meta, captures: sorted }, null, 2)}\n`);
  console.log(`cartes d’attente : ${made.length} (${made.join(', ')})`);
})().catch((e) => { console.error(e); process.exit(1); });
