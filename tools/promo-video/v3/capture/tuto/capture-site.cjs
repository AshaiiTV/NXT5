// Final captures of the nxt5.org import flow for the tutorial « Importer une partie dans NXT5 ».
//
// What is rendered: the site sources of this repository (src/) served by a local Vite dev server, in Chromium,
// 1440×900 CSS, deviceScaleFactor 2, dark scheme, fr-FR. Every /.netlify/functions/* call is intercepted with
// fictitious data (team « Équipe Démo », coach « Coach Démo », players Kairo/Lynx/Vesper/Orion/Sora): no backend,
// no database, no production mutation. The consent banner is answered with « Tout refuser » like a visitor would.
// One capture-only stylesheet hides the sidebar subscription badge (.nxt5-sidebar-subscription), so that no
// offer/subscription UI appears in the video; the app itself collapses that slot when it is empty (:empty rule).
//
// Usage: SITE=http://127.0.0.1:5199 node capture-site.cjs     (normally started by run-site.sh, which launches Vite)
// Writes public/tuto/site-*.png and the site-* entries of src/tuto/captures.json. OUT_DIR=… writes PNGs elsewhere only.
const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { PUBLIC_DIR, requirePlaywright, chromiumPath, writeCaptures, collectBoxes, parkMouse, focusReport, entry } = require('./lib.cjs');
const game = require('./fixtures/game.cjs');

const { chromium } = requirePlaywright();
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : PUBLIC_DIR;
const WRITE_JSON = !process.env.OUT_DIR;
const SITE = process.env.SITE || 'http://127.0.0.1:5199';
const VIEWPORT = { width: 1440, height: 900 };
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '.logs');
const CACHE_DIR = process.env.ASSET_CACHE || path.join(__dirname, '.asset-cache');
const EXPORT_FILE = path.join(__dirname, 'fixtures', `nxt5-${game.GAME_ID}.json`);
const METHOD = 'Site NXT5 (sources du dépôt) via Vite en local, API /.netlify/functions interceptées avec des données fictives.';
const MATCH_LABEL = 'Scrim Aurore · partie 1';
fs.mkdirSync(OUT, { recursive: true });
// Remove the previous set so that renamed or dropped captures do not linger.
for (const f of fs.readdirSync(OUT)) if (f.startsWith('site-') && f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.writeFileSync(EXPORT_FILE, JSON.stringify(game.buildExportFile()));

const USER = { id: 'u-demo', account_name: 'coach-demo', email: 'coach@example.test', email_verified: true, name: 'Coach Démo',
  notif_match: true, notif_report: true, notif_inactivity: true, inactivity_notice: null, is_platform_admin: false, created_at: '2026-01-05T10:00:00Z' };
const TEAM = { id: 't-demo', name: 'Équipe Démo', owner_id: 'u-demo', created_at: '2026-01-05T10:00:00Z' };
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const PLAYERS = ROLES.map((role, i) => ({ id: `p-${role}`, team_id: TEAM.id, role, name: game.ALLY_NAMES[i], riot_id: `${game.ALLY_NAMES[i]}#NXT5`, created_at: '2026-01-05T10:00:00Z' }));
const CATEGORIES = [{ id: 'cat-scrim', team_id: TEAM.id, name: 'Scrim', color: 'cyan', is_default: true }];
const OPPONENTS = [{ id: 'opp-aurore', team_id: TEAM.id, name: 'Aurore' }];
const MATCH_ID = 'm-demo-1';
const state = { imported: false, calls: [], importBody: null };
const errors = [];

function matchRow() {
  return { id: MATCH_ID, team_id: TEAM.id, game_id: game.GAME_ID, raw: { nxt5Label: state.importBody?.label || MATCH_LABEL },
    category_ids: state.importBody?.categoryIds || ['cat-scrim'], result: 'Victoire', side: 'blue', duration: '25:00', duration_seconds: game.DURATION,
    game_date: new Date(game.GAME_CREATION).toISOString(), patch: '26.20', created_at: '2026-10-18T19:48:00Z', participants: game.participantsRows(MATCH_ID, TEAM.id) };
}
function bootstrap(url) {
  const matches = state.imported ? [matchRow()] : [];
  const total = matches.length;
  const base = { selectedTeamId: TEAM.id, matches, pagination: { limit: 100, offset: 0, total, hasMore: false, nextOffset: null },
    totals: { games: total, wins: total, losses: 0 } };
  if (url.searchParams.get('matchesOnly') === '1') return base;
  return { ...base, dashboard: {}, teams: [TEAM], players: PLAYERS,
    teamMembers: [{ id: 'tm-1', team_id: TEAM.id, user_id: USER.id, role: 'owner', name: USER.name }],
    championPool: [], compositions: [], improvements: [], reports: [], matchArchives: [], matchCategories: CATEGORIES,
    inviteCodes: [], availability: [], profileCoachingNotes: [], playerGoals: [], botEvents: [], botGoals: [] };
}
function preview(payload) {
  const match = payload.match;
  return { gameId: payload.gameId, match: { gameId: payload.gameId, duration: match.info.gameDuration, version: match.info.gameVersion,
    teams: [100, 200].map((teamId) => ({ teamId, side: teamId === 100 ? 'BLUE' : 'RED',
      win: Boolean(match.info.teams.find((t) => t.teamId === teamId)?.win),
      participants: match.info.participants.filter((p) => p.teamId === teamId).map((p) => ({
        participantId: p.participantId, teamId: p.teamId, champion: p.championName, championId: p.championId,
        summonerName: p.summonerName, riotId: `${p.riotIdGameName}#${p.riotIdTagline}`, teamPosition: p.teamPosition })) })) } };
}
// Champion portraits go through /asset-proxy: fetched once from Data Dragon (async, so timers keep running), then cached.
async function asset(url) {
  const target = new URL(url.searchParams.get('url'));
  const file = path.join(CACHE_DIR, target.pathname.replace(/[^a-zA-Z0-9._-]+/g, '_'));
  if (!fs.existsSync(file)) {
    try { await execFileAsync('curl', ['-sS', '-f', '-L', '-o', `${file}.part`, target.href], { timeout: 20000 }); fs.renameSync(`${file}.part`, file); } catch { return null; }
  }
  return fs.readFileSync(file);
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--font-render-hinting=none'] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: 'dark',
    locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true });
  // Capture-only rule (documented): hide the subscription badge of the sidebar.
  await context.addInitScript(() => {
    const css = '.nxt5-sidebar-subscription{display:none!important}';
    const add = () => { const s = document.createElement('style'); s.dataset.capture = 'tuto'; s.textContent = css; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await context.route('**/.netlify/functions/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const name = url.pathname.split('/').pop();
    let body = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    state.calls.push(`${req.method()} ${name}${url.search ? url.search.slice(0, 80) : ''}${body?.action ? ` action=${body.action}` : ''}${body?.previewOnly ? ' previewOnly' : ''}`);
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (name === 'auth-me') return json({ user: USER });
    if (name === 'bootstrap') return json(bootstrap(url));
    if (name === 'account-subscription') return json({ subscription: { status: 'none' } });
    if (name === 'opponents-drafts') {
      if (body?.action === 'list-opponents') return json({ opponents: OPPONENTS, canEdit: true });
      return json({ opponents: OPPONENTS, canEdit: true });
    }
    if (name === 'match-details') return json({ matches: state.imported ? [matchRow()] : [] });
    if (name === 'matches-import-file') {
      if (body?.previewOnly) return json(preview(body.payload));
      state.importBody = body; state.imported = true;
      return json({ warnings: [], firstImport: true, match: { id: MATCH_ID, game_id: game.GAME_ID, team_id: TEAM.id, result: 'Victoire', created_at: '2026-10-18T19:48:00Z' } });
    }
    if (name === 'asset-proxy') {
      const bytes = await asset(url);
      const type = /\.png$/i.test(url.searchParams.get('url') || '') ? 'image/png' : 'image/jpeg';
      return bytes ? route.fulfill({ status: 200, contentType: type, body: bytes }) : json({ error: 'asset' }, 404);
    }
    if (name === 'importer-download') return route.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="NXT5-Importer-Windows-0.3.8.exe"' }, body: 'fixture' });
    return json({});
  });

  const entries = {};
  const report = [];
  const settle = (ms = 900) => page.waitForTimeout(ms);
  const park = () => parkMouse(page, [[720, 880], [1400, 880], [700, 150], [380, 60], [1430, 450], [10, 890]]);
  // Visible loaders (spinners, « Chargement… », aria-busy) at capture time: reported, and fatal.
  const loadersOnScreen = () => page.evaluate(() => Array.from(document.querySelectorAll('[role="status"], [aria-busy="true"], .animate-spin'))
    .filter((e) => e.getClientRects().length && (e.classList.contains('animate-spin') || e.getAttribute('aria-busy') === 'true' || /Chargement|Enregistrement…|Vérification…/.test(e.textContent)))
    .map((e) => (e.textContent.trim() || e.className.toString()).slice(0, 60)));
  async function shot(id, { state: desc, storyboard, boxes, extra, allowFocus = [] }) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle').catch(() => {});
    await settle(500);
    const focus = await focusReport(page);
    if (focus.focusVisible && !allowFocus.includes(focus.active)) throw new Error(`${id}: focus visible inattendu sur ${focus.active}`);
    const loaders = await loadersOnScreen();
    if (loaders.length) throw new Error(`${id}: chargement visible ${JSON.stringify(loaders)}`);
    const banner = await page.getByRole('button', { name: /Tout refuser/i }).count();
    if (banner) throw new Error(`${id}: bannière cookies visible`);
    // No price, subscription or paid-offer wording may be visible in the frame.
    const offer = await page.evaluate(() => {
      const re = /(?<!\p{L})(pass|abonnements?|gratuite?s?|tarifs?|offres?|essai|prix|premium)(?!\p{L})|€/iu;
      const hits = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!re.test(n.textContent)) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        const visible = Array.from(range.getClientRects()).some((r) => r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)
          && getComputedStyle(n.parentElement).visibility !== 'hidden' && !n.parentElement.closest('[hidden], .sr-only, [aria-hidden="true"]');
        if (visible) hits.push(n.textContent.trim().slice(0, 80));
      }
      return hits;
    });
    if (offer.length) throw new Error(`${id}: mention d’offre visible ${JSON.stringify(offer)}`);
    const file = `${id}.png`;
    await page.screenshot({ path: path.join(OUT, file), animations: 'disabled', caret: 'hide' });
    // Bars that hide content in the current top layer: the open dialog's sticky header/footer, else the site top bar.
    const occluders = await page.evaluate(() => {
      if (document.querySelector('dialog.importer-opening-dialog[open]')) return ['dialog.importer-opening-dialog[open] .game-operation-dialog-header'];
      if (document.querySelector('dialog.game-import-dialog[open]')) return ['dialog.game-import-dialog[open] .game-operation-dialog-header', 'dialog.game-import-dialog[open] .game-import-footer'];
      return ['.nxt5-topbar'];
    });
    const { boxes: b, missing, hidden } = await collectBoxes(page, boxes, occluders);
    entries[id] = entry({ id, file, css: { w: VIEWPORT.width, h: VIEWPORT.height }, app: 'site', method: METHOD, state: desc, storyboard, boxes: b, missing, hidden,
      extra: { url: page.url().replace(SITE, ''), scrollY: await page.evaluate(() => window.scrollY), focus: focus.focusVisible ? focus.active : null, ...(extra ? await extra() : {}) } });
    report.push(`${id}  focus=${focus.active}${focus.focusVisible ? ' (visible)' : ''} loaders=${JSON.stringify(loaders)} missing=[${missing.join(',')}] hidden=[${hidden.join(',')}]`);
    console.log('shot', id);
  }
  // Scrolls the import dialog content so that `selector` starts `offset` px below the top of the scroll container.
  // Scrolls the import dialog (the <dialog> itself scrolls, under a sticky header and a sticky footer) so that `selector`
  // starts `offset` px below the header, then nudges the position to the nearest one where neither sticky edge slices
  // a text line, a field, a button or a portrait (searched within ±80 px, clamped to the real scroll range).
  const scrollDialogTo = async (selector, offset = 20) => {
    const info = await page.evaluate(({ selector, offset }) => {
      const el = document.querySelector(selector);
      let c = el.parentElement;
      while (c && !(c.scrollHeight > c.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(c).overflowY))) c = c.parentElement;
      const header = c.querySelector('.game-operation-dialog-header');
      const footer = c.querySelector('.game-import-footer');
      const top = header.getBoundingClientRect().bottom;
      const bottom = footer ? footer.getBoundingClientRect().top : c.getBoundingClientRect().bottom;
      const max = c.scrollHeight - c.clientHeight;
      const s0 = c.scrollTop;
      const target = Math.max(0, Math.min(max, s0 + el.getBoundingClientRect().top - top - offset));
      // Content-space boxes of everything that must not be sliced.
      const boxes = [];
      const scope = c.querySelector('.game-import-review') || c;
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || (footer && footer.contains(n))) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.height) boxes.push([r.top + s0, r.bottom + s0]);
      }
      for (const e of scope.querySelectorAll('select, input, button, img, svg')) {
        if (footer && footer.contains(e)) continue;
        const r = e.getBoundingClientRect(); if (r.height) boxes.push([r.top + s0, r.bottom + s0]);
      }
      const clean = (s) => boxes.every(([a, b]) => !(a < top + s - 0.5 && b > top + s + 0.5) && !(a < bottom + s - 0.5 && b > bottom + s + 0.5));
      let chosen = null;
      for (let d = 0; d <= 80 && chosen === null; d++) {
        for (const s of [target - d, target + d]) if (s >= 0 && s <= max && clean(s)) { chosen = s; break; }
      }
      c.scrollTop = chosen ?? target;
      return { container: c.tagName, target: Math.round(target), chosen, max, after: Math.round(el.getBoundingClientRect().top - top) };
    }, { selector, offset });
    report.push(`scroll ${selector}: ${JSON.stringify(info)}`);
    if (info.chosen === null) throw new Error(`Pas de défilement propre pour ${selector}`);
    await settle(400);
  };
  // Page scroll: starting from `target` (default: current position), take the nearest position (±48 px) where neither the
  // bottom of the sticky top bar nor the bottom of the viewport slices a text line, a control or an image of the page.
  const cleanPageScroll = async (target = null) => {
    const info = await page.evaluate((target) => {
      const bar = document.querySelector('.nxt5-topbar');
      const top = bar.getBoundingClientRect().bottom;
      const bottom = window.innerHeight;
      const y0 = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const want = Math.max(0, Math.min(max, target ?? y0));
      const scope = document.querySelector('main') || document.body;
      const skip = (n) => (n.closest ? n : n.parentElement).closest('.nxt5-topbar, aside, .nxt5-toast, [aria-live]');
      const boxes = [];
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || skip(n)) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.height) boxes.push([r.top + y0, r.bottom + y0]);
      }
      for (const e of scope.querySelectorAll('select, input, button, img, svg, a')) {
        if (skip(e)) continue;
        const r = e.getBoundingClientRect(); if (r.height) boxes.push([r.top + y0, r.bottom + y0]);
      }
      const clean = (y) => boxes.every(([a, b]) => !(a < top + y - 0.5 && b > top + y + 0.5) && !(a < bottom + y - 0.5 && b > bottom + y + 0.5));
      let chosen = null;
      for (let d = 0; d <= 48 && chosen === null; d++) for (const y of [want - d, want + d]) if (y >= 0 && y <= max && clean(y)) { chosen = y; break; }
      window.scrollTo({ top: chosen ?? want, behavior: 'instant' });
      return { from: y0, want: Math.round(want), chosen: chosen === null ? null : Math.round(chosen) };
    }, target);
    report.push(`page scroll: ${JSON.stringify(info)}`);
    if (info.chosen === null) throw new Error('Pas de défilement de page propre');
    await settle(300);
    return info;
  };
  const waitToastsGone = async () => {
    await page.waitForFunction(() => !document.querySelector('.nxt5-toast'), null, { timeout: 15000 });
    await settle(400);
  };

  const SHELL = {
    sidebar: 'aside.nxt5-sidebar',
    sidebarParties: { sel: 'aside.nxt5-sidebar a', exactText: 'Parties' },
    topbarTeam: { sel: 'header button', text: 'Équipe Démo' },
  };
  const DIALOG = {
    dialog: 'dialog.game-import-dialog',
    dialogHeader: '.game-import-dialog .game-operation-dialog-header',
    dialogTitle: '.game-import-dialog .game-operation-dialog-header h2',
    dialogClose: '.game-import-dialog .game-operation-close',
    dialogContent: '.game-import-dialog .game-operation-dialog-content',
    filePanel: '.importer-download-panel',
    filePanelTitle: '#importer-download-title',
    filePanelText: '.importer-download-intro p',
  };
  const FOOTER = {
    footer: '.game-import-footer',
    footerStatus: '#game-import-status',
    footerStatusTitle: '#game-import-status strong',
    resetButton: { sel: '.game-import-footer-actions button', text: 'Réinitialiser' },
    confirmButton: { sel: '.game-import-footer-actions button', text: 'Confirmer l’import' },
  };
  const toastBox = { toast: '.nxt5-toast', toastTitle: '.nxt5-toast .nxt5-toast-copy p:first-child', toastText: '.nxt5-toast .nxt5-toast-copy p:nth-child(2)' };

  // --- 2a. Parties page.
  await page.goto(`${SITE}/games`, { waitUntil: 'networkidle' });
  const refuse = page.getByRole('button', { name: 'Tout refuser' });
  if (await refuse.count()) { await refuse.first().click(); await settle(600); }
  // At the top of the page the window edge slices the empty-state title: move by the few px needed for clean edges.
  await cleanPageScroll(0);
  await park();
  await shot('site-01-parties', { storyboard: ['2a', '7a'], state: 'Page Parties de l’équipe « Équipe Démo » (aucune partie), bouton « Importer une partie » visible, menu latéral « Parties » actif. Page défilée de quelques px pour que le bas de la fenêtre ne coupe pas le titre de l’état vide.',
    boxes: { ...SHELL, pageEyebrow: '.nxt5-page-eyebrow', pageTitle: '.nxt5-page-title', pageSubtitle: '.nxt5-page-subtitle',
      importButton: { sel: '.nxt5-page-actions button', text: 'Importer une partie' }, libraryTabs: '.games-library-toolbar',
      gamesCard: { sel: 'main h3', text: 'Toutes les parties', closest: '.nxt5-surface' }, gamesCardTitle: { sel: 'main h3', text: 'Toutes les parties' } } });

  // --- 2b. Import dialog, collapsed then « Obtenir NXT5 Importer » expanded (Windows (64 bits) is the default choice).
  await page.getByRole('button', { name: 'Importer une partie' }).first().click();
  await page.waitForSelector('.game-import-dialog');
  await settle(700);
  await park();
  await shot('site-02-dialogue-import', { storyboard: ['2b', '7a'], state: 'Fenêtre « Importer une partie » : « Ajoute le fichier de ta partie », « Choisir mon fichier », section « Pas encore de fichier ? Obtenir NXT5 Importer » repliée.',
    boxes: { ...DIALOG, chooseFileButton: { sel: '.importer-file-actions button', text: 'Choisir mon fichier' }, downloadSummary: '.importer-download-details summary' } });

  await page.locator('.importer-download-details summary').click();
  await settle(600);
  await park();
  await shot('site-03-obtenir-importer', { storyboard: ['2b'], state: 'Section « Obtenir NXT5 Importer » dépliée : « Version de l’application » sur « Windows (64 bits) » (choix par défaut), bouton « Télécharger », lien « Aide à l’ouverture sur Windows et Mac ».',
    boxes: { ...DIALOG, chooseFileButton: { sel: '.importer-file-actions button', text: 'Choisir mon fichier' }, downloadSummary: '.importer-download-details summary',
      downloadText: '.importer-download-details > p', versionLabel: { sel: '.importer-download-details label, .importer-download-details span', text: 'Version de l’application' },
      versionSelect: '.importer-download-details select', downloadButton: '.importer-download-details a[download]', helpLink: '.importer-download-details .importer-help-link' },
    extra: async () => ({ versionValue: await page.locator('.importer-download-details select').evaluate((s) => s.options[s.selectedIndex].text) }) });

  // --- 3a. « Télécharger » opens the « Ouvrir NXT5 Importer » help on the Windows tab (the download itself is intercepted).
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.locator('.importer-download-details a[download]').click();
  const download = await downloadPromise;
  report.push(`téléchargement intercepté : ${download ? 'oui' : 'non'}`);
  await page.waitForSelector('.importer-opening-dialog');
  await settle(700);
  await park();
  await shot('site-04-aide-ouverture-windows', { storyboard: ['3a'], state: 'Fenêtre « Ouvrir NXT5 Importer », onglet « Windows » : « Microsoft Defender SmartScreen », « Windows a protégé votre ordinateur », trois consignes numérotées, « J’ai compris ».',
    boxes: { helpDialog: 'dialog.importer-opening-dialog', helpTitle: '.importer-opening-dialog .game-operation-dialog-header h2',
      helpClose: '.importer-opening-dialog .game-operation-close', windowsTab: '[role="tab"][data-platform="windows"]', macTab: '[role="tab"][data-platform="mac"]',
      helpEyebrow: '.importer-help-eyebrow', helpHeading: '.importer-help-content h3', helpSteps: '.importer-help-steps',
      helpStep1: { sel: '.importer-help-steps li', nth: 0 }, helpStep2: { sel: '.importer-help-steps li', nth: 1 }, helpStep3: { sel: '.importer-help-steps li', nth: 2 },
      helpNote: '.importer-help-note', helpOther: '.importer-help-other summary', understoodButton: { sel: '.importer-help-actions button', text: 'J’ai compris' } } });

  await page.getByRole('button', { name: 'J’ai compris' }).click();
  await settle(500);

  // --- 7c. File chosen (the system file picker is not captured: the file is set on the real input).
  await page.locator('input[type="file"][aria-label="Fichier JSON de la partie"]').setInputFiles(EXPORT_FILE);
  await page.waitForSelector('.game-import-review', { timeout: 15000 });
  await settle(1600); // JsonUploadProgress clears 1200 ms after success; the « Fichier chargé » toast stays 4.5 s
  await park();
  const SIDES = { changeFileButton: { sel: '.importer-file-actions button', text: 'Changer de fichier' }, fileCheck: '.importer-file-check',
    sideSection: '.game-import-side-section', sideTitle: '#game-import-side-title', recognitionText: '.game-import-recognition',
    blueSide: { sel: '.game-import-side', nth: 0 }, redSide: { sel: '.game-import-side', nth: 1 }, allyHeading: '#game-import-allies-title' };
  await shot('site-05-fichier-charge', { storyboard: ['7c'], state: 'Juste après le choix du fichier : panneau « Fichier chargé · Rien n’est encore enregistré. », « Choisis ton équipe » avec « Côté bleu » (Victoire, reconnu et coché) et « Côté rouge » (Défaite), notification « Fichier chargé » en bas à droite.',
    boxes: { ...DIALOG, ...SIDES, ...FOOTER, ...toastBox } });
  await waitToastsGone();
  await park();
  await shot('site-05b-fichier-charge-sans-notification', { storyboard: ['7c'], state: 'Même état que site-05 une fois la notification « Fichier chargé » disparue (4,5 s).',
    boxes: { ...DIALOG, ...SIDES, ...FOOTER } });

  // --- 7d / 7e. Review tables.
  await scrollDialogTo('.game-import-team:not(.game-import-enemies)', 16);
  await park();
  const rows = Object.fromEntries(ROLES.flatMap((r, i) => [[`allyRow${r}`, { sel: '.game-import-roster-row', nth: i }],
    [`allyChampion${r}`, { sel: '.game-import-roster-row .game-import-champion-field', nth: i }], [`allyProfile${r}`, { sel: '.game-import-roster-row .game-import-profile-field', nth: i }]]));
  await shot('site-06-notre-equipe', { storyboard: ['7d'], state: 'Section « Notre équipe · Côté bleu » : colonnes Poste / Champion joué / Profil lié, cinq lignes Top à Support liées aux profils de l’équipe.',
    boxes: { ...DIALOG, ...FOOTER, allySection: '.game-import-team:not(.game-import-enemies)', allyHeading: '#game-import-allies-title', allyRosterHead: '.game-import-roster-head', allyRoster: '.game-import-roster', ...rows } });
  // The dialog cannot scroll further than its end: the enemy section and the name/tags/opponent fields share the frame.
  await scrollDialogTo('.game-import-enemies', 16);
  await park();
  const enemies = Object.fromEntries([0, 1, 2, 3, 4].flatMap((i) => [[`enemy${i + 1}`, { sel: '.game-import-enemy', nth: i }], [`enemy${i + 1}Role`, { sel: '.game-import-enemy select', nth: i }]]));
  const FIELDS = { fieldsBlock: '.game-import-confirmation-fields', nameInput: { sel: '.game-import-confirmation-fields input', nth: 0 },
    nameLabel: { sel: '.game-import-confirmation-fields label *, .game-import-confirmation-fields label', text: 'Nom de la partie', deepest: true },
    tagsGroup: '.game-import-confirmation-fields [role="group"]', tagsLabel: '.game-import-confirmation-fields [role="group"] > p:first-child', scrimTag: { sel: '.game-import-confirmation-fields [role="group"] button', text: 'Scrim' },
    tagsHelp: '.game-import-confirmation-fields [role="group"] > p + div + p',
    opponentBlock: '.game-import-opponent', opponentSelect: '.game-import-opponent select', newOpponentButton: { sel: '.game-import-opponent button', text: 'Nouvelle équipe' }, opponentHelp: '.game-import-opponent > p' };
  const nameValue = () => page.locator('.game-import-confirmation-fields input').first().inputValue();
  await shot('site-07-equipe-adverse', { storyboard: ['7e', '7f'], state: 'Fenêtre défilée jusqu’en bas (butée) : « Équipe adverse · Côté rouge » avec les cinq postes, puis les champs avant saisie : « Nom de la partie » pré-rempli avec l’ID de la partie, aucun tag (« Ajoute au moins un tag à la partie. »), « Équipe adverse (facultatif) » actif avec « Nouvelle équipe ». Pied « À compléter ». La ligne ADC passe sous l’en-tête collant de la fenêtre (défilement réel).',
    boxes: { ...DIALOG, ...FOOTER, enemySection: '.game-import-enemies', enemyHeading: '#game-import-enemies-title', enemyHelp: '.game-import-enemy-help', enemyRoster: '.game-import-enemy-roster', ...enemies, ...FIELDS },
    extra: async () => ({ nameValue: await nameValue() }) });
  await page.getByLabel('Nom de la partie').fill(MATCH_LABEL);
  // 7f, between the two actions (added for the video): the name is typed, the field keeps its focus (real typing state),
  // no tag yet. Same scroll position as site-07: only the name field differs, so the film can cross-fade the two.
  await park();
  const nameFocus = await focusReport(page);
  if (!nameFocus.active.startsWith('input')) throw new Error(`site-07b: focus inattendu ${nameFocus.active}`);
  await shot('site-07b-nom-saisi', { storyboard: ['7f'], state: `Nom « ${MATCH_LABEL} » saisi (champ encore focalisé, comme pendant la frappe), aucun tag encore choisi (« Ajoute au moins un tag à la partie. »), pied « À compléter ». Même défilement que site-07 : seul le champ du nom change.`,
    boxes: { ...DIALOG, ...FOOTER, enemySection: '.game-import-enemies', enemyHeading: '#game-import-enemies-title', ...FIELDS }, allowFocus: [nameFocus.active],
    extra: async () => ({ nameValue: await nameValue() }) });
  await page.locator('.game-import-confirmation-fields [role="group"] button', { hasText: 'Scrim' }).click();
  await settle(500);
  // Selecting a tag removes the « Ajoute au moins un tag » line, so the dialog end moves up: re-pick a clean position.
  await scrollDialogTo('.game-import-enemies', 16);
  await park();
  await shot('site-08-nom-tags-pret-a-importer', { storyboard: ['7f', '7g'], state: `Nom « ${MATCH_LABEL} », tag « Scrim » coché, équipe adverse « Non renseignée » (modifiable). Pied : « Prêt à importer · Confirme pour enregistrer la partie et ouvrir son bilan. » et « Confirmer l’import ».`,
    boxes: { ...DIALOG, ...FOOTER, ...Object.fromEntries(Object.entries(FIELDS).filter(([k]) => k !== 'tagsHelp')), enemySection: '.game-import-enemies' }, extra: async () => ({ nameValue: await nameValue(), footerText: (await page.locator('#game-import-status').innerText()).replace(/\s+/g, ' ') }) });

  // --- 8. Confirm: the app opens the game (?match=…) and shows « Partie importée ».
  await page.getByRole('button', { name: 'Confirmer l’import' }).click();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get('match') === id, MATCH_ID, { timeout: 15000 });
  await page.waitForSelector('.games-match-title h3');
  await settle(900);
  await cleanPageScroll();
  await park();
  const MATCH = { matchContext: '.games-match-context', matchTitle: '.games-match-title h3', resultBadge: { sel: '.games-match-title > *', nth: 1 }, matchMeta: '.games-match-meta',
    coachBrief: '.games-coach-brief', matchPanel: '.nxt5-match-panel' };
  await shot('site-09-partie-importee', { storyboard: ['8'], state: `Après « Confirmer l’import » : la partie s’ouvre (titre « ${MATCH_LABEL} », Victoire, « Durée : 25:00 », « Notre équipe : côté bleu ») et la notification « Partie importée » s’affiche. Défilement laissé par l’application (ajusté de quelques px si un bord coupait une ligne).`,
    boxes: { ...SHELL, ...MATCH, ...toastBox } });

  // --- 8 (end). Back to the list: the app scrolls the new row into view.
  await waitToastsGone();
  await page.locator('.games-detail-toolbar button', { hasText: 'Retour aux parties' }).click();
  await page.waitForSelector('[data-match-id]');
  await settle(900);
  // The app centres the row, which leaves the card header half under the sticky top bar: scroll up a little (as with the wheel)
  // so that the whole « Toutes les parties » card is in view.
  const listTarget = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('main h3')).find((h) => h.textContent.includes('Toutes les parties')).closest('.nxt5-surface');
    const toolbar = document.querySelector('.games-library-toolbar');
    const bar = document.querySelector('.nxt5-topbar').getBoundingClientRect().bottom;
    // Hide the library toolbar entirely under the top bar, so the card starts just below it.
    return window.scrollY + Math.max(toolbar.getBoundingClientRect().bottom - bar + 2, card.getBoundingClientRect().top - bar - 24);
  });
  const listScroll = await cleanPageScroll(listTarget);
  report.push(`liste: défilement ${JSON.stringify(listScroll)}`);
  await settle(500);
  await park();
  await shot('site-10-liste-avec-partie', { storyboard: ['8'], state: `Retour à « Toutes les parties » : nouvelle ligne « ${MATCH_LABEL} » (Victoire, EUW1_7861632138, tag Scrim, « À revoir »). L’application centre la ligne ; la page est ensuite remontée de quelques dizaines de px (comme à la molette) pour montrer la carte entière sous la barre du haut.`,
    boxes: { ...SHELL, newRow: `[data-match-id="${MATCH_ID}"]`, gamesCardTitle: { sel: 'main h3', text: 'Toutes les parties' },
      gamesCountLabel: { sel: 'main h3', text: 'Toutes les parties', closest: 'div' },
      gamesCard: { sel: 'main h3', text: 'Toutes les parties', closest: '.nxt5-surface' },
      rowResult: { sel: `[data-match-id="${MATCH_ID}"] *`, text: 'Victoire', deepest: true }, rowTitle: { sel: `[data-match-id="${MATCH_ID}"] *`, text: MATCH_LABEL, deepest: true },
      rowGameId: { sel: `[data-match-id="${MATCH_ID}"] *`, text: game.GAME_ID, deepest: true }, rowTag: { sel: `[data-match-id="${MATCH_ID}"] *`, exactText: 'Scrim', deepest: true },
      rowReview: { sel: `[data-match-id="${MATCH_ID}"] *`, text: 'À revoir', deepest: true } } });

  fs.writeFileSync(path.join(LOG_DIR, 'site-calls.json'), JSON.stringify(state.calls, null, 2));
  fs.writeFileSync(path.join(LOG_DIR, 'site-import-body.json'), JSON.stringify(state.importBody && { ...state.importBody, payload: '[fichier]' }, null, 2));
  await browser.close();
  console.log(report.join('\n'));
  console.log('errors:', JSON.stringify(errors));
  if (WRITE_JSON) writeCaptures('site-', entries, [
    METHOD,
    'Viewport 1440×900 CSS au facteur 2 (2880×1800), thème sombre, fr-FR, cookies refusés (« Tout refuser »).',
    'Seule retouche : une feuille de style de capture masque le badge d’abonnement du menu latéral (.nxt5-sidebar-subscription), pour qu’aucune offre n’apparaisse ; l’application replie elle-même cet emplacement quand il est vide.',
    'Le sélecteur de fichiers du système n’est pas capturé : le fichier fixtures/nxt5-EUW1_7861632138.json est posé sur le vrai champ de fichier.',
    'Les notifications (toasts) restent 4,5 s ; site-05 et site-09 les montrent, les autres captures attendent leur disparition.',
    'La fenêtre « Importer une partie » est centrée verticalement : sa position change entre site-02 (repliée), site-03 (dépliée) et site-05 (fichier chargé, pleine hauteur). Les boîtes « visible » retirent les zones cachées sous l’en-tête et le pied collants de la fenêtre et sous la barre du haut du site ; hiddenBoxes liste les éléments entièrement cachés.',
    'Dans la fenêtre, le pied collant (« À compléter » / « Prêt à importer ») et l’en-tête restent fixes : le défilement est choisi pour qu’aucun de ces bords ne coupe une ligne de texte ou un champ.',
  ]);
})().catch((e) => { console.error(e); process.exit(1); });
