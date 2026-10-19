// Final captures of NXT5 Importer 0.3.8 for the tutorial « Importer une partie dans NXT5 ».
//
// What is rendered: the real importer-app/src/renderer.html + renderer.js + styles.css + assets (0.3.8) in Chromium,
// 1180×790 CSS (default window 1180×800 of src/main.js minus 10 px so the bottom edge never slices a text line), deviceScaleFactor 2. The Electron preload bridge
// (src/preload.cjs, same 10 methods) is replaced by a stub that answers like the Windows main process:
// platform "win32", the real status/progress messages of src/main.js and src/core.js, and the default save path
// C:\Users\Joueur\Downloads\nxt5-EUW1_7861632138.json. The stub holds each progress stage behind a gate so that
// steps 1 Match, 2 Timeline and 3 Fichier are captured separately. No DOM text is edited.
//
// Usage: node capture-importer.cjs            (writes public/tuto/importer-*.png and the importer-* entries of src/tuto/captures.json)
// Optional: OUT_DIR=/some/dir to write PNGs elsewhere (captures.json is then not touched).
const path = require('node:path');
const fs = require('node:fs');
const { REPO, PUBLIC_DIR, requirePlaywright, chromiumPath, writeCaptures, collectBoxes, parkMouse, focusReport, entry } = require('./lib.cjs');

const { chromium } = requirePlaywright();
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : PUBLIC_DIR;
const WRITE_JSON = !process.env.OUT_DIR;
const RENDERER = `file://${path.join(REPO, 'importer-app', 'src', 'renderer.html')}`;
const VIEWPORT = { width: 1180, height: Number(process.env.IMPORTER_HEIGHT || 790) };
const GAME_ID = 'EUW1_7861632138';
const WIN_PATH = `C:\\Users\\Joueur\\Downloads\\nxt5-${GAME_ID}.json`;
const METHOD = 'Renderer réel NXT5 Importer 0.3.8 (importer-app/src) dans Chromium, pont preload simulé en Windows (win32), données fictives.';
fs.mkdirSync(OUT, { recursive: true });
// Remove the previous set so that renamed or dropped captures do not linger.
for (const f of fs.readdirSync(OUT)) if (f.startsWith('importer-') && f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));

// Runs in the page before renderer.js: the window.nxt5 bridge.
function bridge({ connected, gameId, winPath }) {
  const state = { version: '0.3.8', platform: 'win32', arch: 'x64', siteUrl: 'https://nxt5.org', settings: { platform: 'EUW1', leaguePath: '' }, history: [] };
  const gates = {};
  const gate = (name) => new Promise((resolve) => { gates[name] = resolve; });
  window.__gates = gates;
  window.__client = { connected, hold: false };
  window.__opened = [];
  let progressCb = null;
  const report = (stage, message) => progressCb?.({ stage, message });
  window.nxt5 = {
    getAppState: async () => JSON.parse(JSON.stringify(state)),
    getClientStatus: async () => {
      if (window.__client.hold) await gate('client');
      return window.__client.connected
        ? { connected: true, message: 'Client League of Legends détecté.' }
        : { connected: false, message: 'Client LoL introuvable. Ouvre League of Legends ou indique son dossier dans les Paramètres.' };
    },
    chooseLeaguePath: async () => ({ canceled: true }),
    saveSettings: async (s) => Object.assign(state.settings, s),
    generateImport: async (form) => {
      const id = String(form.gameId).trim().toUpperCase();
      report('validate', 'Vérification du Game ID et de la région…');
      report('fetch', 'Récupération de la partie auprès de Riot…');
      await gate('fetch');
      report('timeline', 'Vérification de la timeline et des statistiques…');
      await gate('timeline');
      report('save', 'Choisis où enregistrer ton fichier JSON…');
      await gate('save');
      const exportedAt = '2026-10-18T19:42:00.000Z';
      const summary = { participantCount: 10, duration: 1500, timelineAvailable: true, source: 'nxt5-riot-match-export' };
      state.history.unshift({ id: 'h-1', gameId: id, filePath: winPath, exportedAt, ...summary });
      report('complete', 'Ton fichier JSON est prêt à être importé dans NXT5.');
      return { canceled: false, filePath: winPath, gameId: id, historyId: 'h-1', summary, warnings: [] };
    },
    cancelImport: async () => ({ canceled: true }),
    showExport: async () => true,
    onProgress: (cb) => { progressCb = cb; return () => { progressCb = null; }; },
    checkUpdate: async () => ({ checked: true, updateAvailable: false, latestVersion: '0.3.8', currentVersion: '0.3.8', downloadUrl: '' }),
    openExternal: async (url) => { window.__opened.push(url); return true; },
  };
}

const COMMON_BOXES = {
  header: '.app-header',
  brand: '#brandHome',
  navExport: '#exportTab',
  navHistory: '#historyTab',
  navSettings: '#settingsTab',
  clientIndicator: '#clientIndicator',
  clientDot: '#clientIndicator .status-dot',
  clientLabel: '#clientLabel',
  refreshClient: '#refreshClient',
  openSiteIcon: '.app-header .site-open',
  heroHeading: '#exportHeading',
  exportCard: '#form',
  gameIdLabel: 'label[for="gameId"]',
  gameIdInput: '#gameId',
  gameIdHint: '#gameIdHint',
  regionLabel: 'label[for="platform"]',
  regionSelect: '#platform',
  regionHint: '.region-row > p',
  submitButton: '#submit',
  exportShortcut: '#exportShortcut',
  workflowStrip: '.workflow-strip',
};
// Only on the idle export view (the app hides them while exporting and next to the result card).
const HOME_BOXES = {
  ...COMMON_BOXES,
  exportCardOverline: '#form .card-overline',
  exportCardTitle: '#form .card-title h2',
  exportCaption: '.export-caption',
  helpSummary: '#clientHelp summary',
};
const PROGRESS_BOXES = {
  progressCard: '#progressPanel',
  progressHeading: '#progressHeading',
  progressSteps: '#progressSteps',
  progressStep1: '#progressSteps li[data-stage="fetch"]',
  progressStep2: '#progressSteps li[data-stage="timeline"]',
  progressStep3: '#progressSteps li[data-stage="save"]',
  progressStep4: '#progressSteps li[data-stage="complete"]',
  progressMessage: '#progressMessage',
  progressTime: '#progressTime',
  cancelButton: '#cancelImport',
};
const RESULT_BOXES = {
  resultCard: '#resultPanel',
  resultIcon: '#resultPanel .success-icon',
  resultEyebrow: '#resultPanel .result-header .eyebrow',
  resultHeading: '#resultHeading',
  resultGameId: '#resultGameId',
  resultFacts: '#resultFacts',
  resultFactPlayers: { sel: '#resultFacts span', nth: 0 },
  resultFactDuration: { sel: '#resultFacts span', nth: 1 },
  resultFactTimeline: { sel: '#resultFacts span', nth: 2 },
  resultFactSource: { sel: '#resultFacts span', nth: 3 },
  resultPath: '#resultPath',
  revealFileButton: '#revealFile',
  openNxt5Button: '.result-actions [data-open-site]',
  resultHint: '#resultPanel > .field-hint',
};

(async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean) });
  const errors = [];
  const entries = {};
  const report = [];

  async function boot(connected, { clock = false } = {}) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    // Fake clock (Playwright) so the « N s écoulées » counter of the progress card is deterministic.
    if (clock) await context.clock.install({ time: new Date('2026-10-18T21:41:00+02:00') });
    await context.addInitScript(bridge, { connected, gameId: GAME_ID, winPath: WIN_PATH });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(RENDERER);
    await page.waitForSelector(`#clientIndicator[data-state="${connected ? 'connected' : 'disconnected'}"]`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700); // view enter animation (180 ms) + update check
    return { context, page };
  }
  const park = (page) => parkMouse(page, [[560, 780], [40, 760], [300, 760], [40, 300], [600, 140]]);
  async function shot(page, id, { state, storyboard, boxes, expectFocus = null, extra, expectText = null, settle = 250 }) {
    await page.waitForTimeout(settle);
    const readText = (sel) => page.evaluate((s) => document.querySelector(s).textContent.trim(), sel);
    if (expectText && !expectText.re.test(await readText(expectText.sel))) throw new Error(`${id}: texte inattendu dans ${expectText.sel} : ${await readText(expectText.sel)}`);
    const focus = await focusReport(page);
    if (focus.focusVisible && focus.active !== expectFocus) throw new Error(`${id}: focus visible inattendu sur ${focus.active}`);
    const scrollY = await page.evaluate(() => window.scrollY);
    if (process.env.DEBUG_LINES) console.log(id, JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.workflow-strip strong, .workflow-strip small, .footer span, #form, .last-export')).filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return [e.tagName + '.' + e.className, Math.round(r.top * 10) / 10, Math.round(r.bottom * 10) / 10]; }))));
    const file = `${id}.png`;
    await page.screenshot({ path: path.join(OUT, file), animations: 'disabled', caret: 'hide' });
    if (expectText && !expectText.re.test(await readText(expectText.sel))) throw new Error(`${id}: ${expectText.sel} a changé pendant la capture, relancer`);
    const { boxes: b, missing, hidden } = await collectBoxes(page, boxes, ['.app-header']);
    entries[id] = entry({ id, file, css: { w: VIEWPORT.width, h: VIEWPORT.height }, app: 'importer', method: METHOD, state, storyboard, boxes: b, missing, hidden,
      extra: { scrollY, focus: focus.focusVisible ? focus.active : null, ...(extra ? await extra(page) : {}) } });
    report.push(`${id}  scrollY=${scrollY} focus=${focus.active}${focus.focusVisible ? ' (visible)' : ''} missing=[${missing.join(',')}]`);
    console.log('shot', id);
  }
  const inputStyle = async (page) => ({ gameIdInputText: await page.evaluate(() => {
    const el = document.querySelector('#gameId');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { value: el.value, placeholder: el.placeholder, fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color,
      paddingLeft: cs.paddingLeft, textX: Math.round((r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)) * 100) / 100, centerY: Math.round((r.top + r.height / 2) * 100) / 100 };
  }) });

  // 1. Home, client connected, empty field.
  {
    const { context, page } = await boot(true);
    await park(page);
    await shot(page, 'importer-01-accueil-client-connecte', { storyboard: ['4b'], state: 'Vue Exporter, « Client LoL connecté » (point vert), champ « Identifiant du match » vide, sans focus.', boxes: HOME_BOXES, extra: inputStyle });
    await context.close();
  }
  // 2. Client not detected, then the refresh icon: « Recherche du client… », then connected.
  {
    const { context, page } = await boot(false);
    await park(page);
    await shot(page, 'importer-02-client-non-detecte', { storyboard: ['4c'], state: 'Démarrage sans client LoL : « Client LoL non détecté » (point gris). Infobulle non affichée. Le menu central se décale de quelques px car le libellé est plus long (comportement réel).', boxes: HOME_BOXES,
      extra: async (p) => ({ tooltip: await p.getAttribute('#clientIndicator', 'title') }) });
    await page.evaluate(() => { window.__client.hold = true; window.__client.connected = true; document.querySelector('#refreshClient').click(); });
    await page.waitForSelector('#clientIndicator[data-state="checking"]');
    await shot(page, 'importer-02b-recherche-du-client', { storyboard: ['4c'], state: 'Après clic sur l’icône d’actualisation : « Recherche du client… », icône désactivée (rotation figée à 0°).', boxes: HOME_BOXES });
    await page.evaluate(() => window.__gates.client());
    await page.waitForSelector('#clientIndicator[data-state="connected"]');
    await page.waitForTimeout(300);
    await shot(page, 'importer-02c-client-reconnecte', { storyboard: ['4c'], state: 'Fin de 4c : « Client LoL connecté » après actualisation (identique à importer-01 hors infobulle).', boxes: HOME_BOXES });
    await context.close();
  }
  // 3. Field focused, typed, export progress, result.
  {
    const { context, page } = await boot(true, { clock: true });
    await page.click('#gameId');
    await park(page);
    await shot(page, 'importer-03-champ-focus-vide', { storyboard: ['5b'], state: 'Clic dans « Identifiant du match » : champ vide avec focus (bordure et contour cyan), placeholder « Ex. EUW1_7861632138 » visible, curseur texte masqué.', boxes: HOME_BOXES, expectFocus: 'input#gameId', extra: inputStyle });
    await page.keyboard.insertText(GAME_ID); // a paste = one input event
    await page.waitForTimeout(200);
    await shot(page, 'importer-04-id-saisi', { storyboard: ['5b', '6a'], state: 'ID « EUW1_7861632138 » collé, champ toujours focalisé, serveur « Europe Ouest · EUW ». État final du calque de frappe.', boxes: HOME_BOXES, expectFocus: 'input#gameId', extra: inputStyle });

    // Freeze the page clock at the click: timers only advance with clock.runFor().
    await page.clock.pauseAt(new Date('2026-10-18T21:42:00+02:00'));
    await page.click('#submit');
    await park(page);
    await page.waitForSelector('#progressPanel:not([hidden])');
    await page.waitForTimeout(400);
    await shot(page, 'importer-05-progression-1-match', { expectText: { sel: '#progressTime', re: /^Tu pourras choisir/ }, storyboard: ['6a'], state: 'Après clic sur « Exporter la game » : « Préparation de ton export », étape 1 Match active, « Récupération de la partie auprès de Riot… », « Tu pourras choisir l’emplacement du fichier à la fin. », bouton « Export en cours… ».', boxes: { ...COMMON_BOXES, ...PROGRESS_BOXES } });
    await page.evaluate(() => window.__gates.fetch());
    await page.clock.runFor(2000);
    await shot(page, 'importer-06-progression-2-timeline', { expectText: { sel: '#progressTime', re: /^2 s écoulées/ }, storyboard: ['6a'], state: 'Étape 2 Timeline active (1 faite), « Vérification de la timeline et des statistiques… », « 2 s écoulées ».', boxes: { ...COMMON_BOXES, ...PROGRESS_BOXES } });
    await page.evaluate(() => window.__gates.timeline());
    await page.clock.runFor(1000);
    await shot(page, 'importer-07-progression-3-fichier', { expectText: { sel: '#progressTime', re: /^3 s écoulées/ }, storyboard: ['6a', '6b'], state: 'Étape 3 Fichier active (1 et 2 faites), « Choisis où enregistrer ton fichier JSON… » (la fenêtre d’enregistrement du système est alors ouverte), « Annuler » désactivé, « 3 s écoulées ».', boxes: { ...COMMON_BOXES, ...PROGRESS_BOXES } });
    await page.evaluate(() => window.__gates.save());
    await page.waitForSelector('#resultPanel:not([hidden])');
    await page.waitForTimeout(600);
    await shot(page, 'importer-08-resultat', { storyboard: ['6c', '7a'], state: '« Export enregistré · Ta game est prête. », pastilles 10 joueurs / 25 min 00 / Timeline incluse / Riot via NXT5, chemin Windows, « Voir le fichier » et « Ouvrir NXT5 ». (Le message de réussite #status est masqué visuellement par l’application quand la carte est affichée.)', boxes: { ...COMMON_BOXES, ...RESULT_BOXES } });
    // Real click on « Ouvrir NXT5 »: check the URL the app asks to open.
    await page.evaluate(() => document.querySelector('.result-actions [data-open-site]').click());
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => window.__opened);
    report.push(`Ouvrir NXT5 → ${JSON.stringify(opened)}`);
    if (entries['importer-08-resultat']) entries['importer-08-resultat'].openNxt5Url = opened[0] || null;
    await context.close();
  }

  await browser.close();
  console.log(report.join('\n'));
  console.log('errors:', JSON.stringify(errors));
  if (errors.length) throw new Error('Erreurs dans le renderer');
  if (WRITE_JSON) writeCaptures('importer-', entries, [
    METHOD,
    'Fenêtre 1180×790 sans cadre (10 px de moins que la taille par défaut 1180×800 de main.js) : ainsi le bord inférieur ne coupe aucune ligne de texte dans les états accueil, progression et résultat. Barres de défilement masquées (Chromium sans interface).',
    'Animations figées à la capture (animations: disabled) : l’emblème ne « respire » pas pendant l’export et l’icône d’actualisation est à 0°.',
    'Calque de frappe (5b) : partir de importer-03 (champ focalisé, vide) et finir sur importer-04 (ID collé, même focus). Le placeholder « Ex. EUW1_7861632138 » est visible dans le champ vide et disparaît à la première frappe : le calque doit le masquer. Police, taille, couleur, x du texte et centre vertical : gameIdInputText.',
    'Le menu central (Exporter / Historique / Paramètres) se décale de quelques px quand le libellé du client change de longueur (importer-02 et 02b) : comportement réel.',
  ]);
})().catch((e) => { console.error(e); process.exit(1); });
