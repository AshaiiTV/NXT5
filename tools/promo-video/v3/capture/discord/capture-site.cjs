// Site captures of the tutorial « Ajouter le bot NXT5 à ton serveur Discord » (composition TutoDiscord).
//
// Same method as ../tuto/capture-site.cjs: the site sources of this repository served by a local Vite dev server, in
// Chromium, 1440×900 CSS, deviceScaleFactor 2, dark scheme, fr-FR, Europe/Paris, cookies refused like a visitor would.
// Every /.netlify/functions/* call is intercepted with the fictitious world of world.cjs (names from names.json), and
// discord.com is intercepted too: no backend, no database, no Discord call, nothing written anywhere. The Discord payloads
// (test message, game preview) are those render-payloads.cjs rendered with the server code.
// - Clock: frozen at each step of the journey (context.clock.setFixedTime, world.cjs CLOCK), so the dates follow the game
//   (18 Oct 2026, 21:05 Paris) and the link code reads « Valable jusqu’au » exactly as names.json.
// - One capture-only stylesheet hides the sidebar subscription badge (.nxt5-sidebar-subscription), and a scanner refuses any
//   visible price, offer, pass, subscription, trial or « free » wording (the delivery state « Nouvel essai prévu » included).
// - Frames: no visible focus ring, no hover, no loader, and no text line, control or paragraph sliced by the top bar, the
//   dialog header or the window edge. frame() picks the scroll position, shot() checks it again (see EDGE_JS); only the tall
//   game visual runs past an edge, and site-21 keeps the last two lines of the test receipt under the top bar (RECAP_EDGES).
//
// Usage: SITE=http://127.0.0.1:5199 node capture-site.cjs     (normally started by run-site.sh, which launches Vite)
// Writes public/tuto-discord/site-*.png and the site-* entries of src/tuto-discord/captures.json. OUT_DIR=… writes PNGs only.
const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { requirePlaywright, chromiumPath, collectBoxes, parkMouse, focusReport } = require('../tuto/lib.cjs');
const W = require('./world.cjs');

const { chromium } = requirePlaywright();
const V3 = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(V3, 'public', 'tuto-discord');
const CAPTURES_JSON = path.join(V3, 'src', 'tuto-discord', 'captures.json');
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : PUBLIC_DIR;
const WRITE_JSON = !process.env.OUT_DIR;
const SITE = process.env.SITE || 'http://127.0.0.1:5199';
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '.logs');
const CACHE_DIRS = [process.env.ASSET_CACHE || path.join(__dirname, '.asset-cache'), path.join(__dirname, '..', 'tuto', '.asset-cache')];
const METHOD = 'Site NXT5 (sources du dépôt) via Vite en local, API /.netlify/functions et discord.com interceptées avec des données fictives, horloge figée.';
const { NAMES } = W;
const PUBLISH = `#${NAMES.publishChannel}`;
fs.mkdirSync(OUT, { recursive: true });
// Remove the previous set so that renamed or dropped captures do not linger.
for (const f of fs.readdirSync(OUT)) if (f.startsWith('site-') && f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIRS[0], { recursive: true });

const payload = (name) => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `payload-${name}.json`), 'utf8'));
  return { ...json, imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'fixtures', `payload-${name}.png`)).toString('base64')}` };
};
const TEST_PAYLOAD = payload('test');
const PREVIEW_PAYLOAD = payload('preview');
const INSTALL_URL = 'https://discord.com/oauth2/authorize?client_id=1290000000000000000&scope=bot+applications.commands&permissions=8&integration_type=0';
const LIER_TOKEN = 'a'.repeat(43); // only its shape matters client-side
const MATCH = W.storedMatch();
// What the site lists and opens (match-page.ts keeps only nxt5Label of raw).
const matchRow = () => ({ ...MATCH, raw: { nxt5Label: NAMES.game } });

// Server state of the fictitious journey. `now` follows the frozen page clock.
const S = { now: W.CLOCK.arrival, accountLinked: false, accountPrepared: false, connRow: null, configVersion: 1, commandChannelId: null, routes: [],
  test: null, active: false, enabledAt: null, deliveries: [], popups: [], calls: [] };
const errors = [];
const report = [];
const iso = (t) => new Date(t).toISOString();

function bootstrap(url) {
  const base = { selectedTeamId: W.TEAM.id, matches: [matchRow()], pagination: { limit: 100, offset: 0, total: 1, hasMore: false, nextOffset: null },
    totals: { games: 1, wins: 1, losses: 0 } };
  if (url.searchParams.get('matchesOnly') === '1') return base;
  const players = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map((role, i) => ({ id: `p-${role}`, team_id: W.TEAM.id, role, name: W.game.ALLY_NAMES[i],
    riot_id: `${W.game.ALLY_NAMES[i]}#NXT5`, created_at: '2026-01-05T10:00:00Z' }));
  return { ...base, dashboard: {}, teams: [W.TEAM], players, teamMembers: [W.MEMBER], championPool: [], compositions: [], improvements: [], reports: [],
    matchArchives: [], matchCategories: W.CATEGORIES, inviteCodes: [], availability: [], profileCoachingNotes: [], playerGoals: [], botEvents: [], botGoals: [] };
}
function connectionStatus() {
  const base = { configured: true, enabled: true, environment: 'production', deployContext: 'production', installUrl: INSTALL_URL, issues: [],
    canManage: true, canPublish: true, categories: W.CATEGORIES.map(({ id, name }) => ({ id, name })), connectionError: null };
  const none = { channels: [], roles: [], health: { checkedAt: null, verified: false, errorCode: null } };
  if (!S.connRow) return { ...base, connection: null, ...none };
  if (S.connRow === 'pending') return { ...base, connection: { id: W.TEAM.id, guildId: null, guildName: null, status: 'pending', paused: false,
    configVersion: S.configVersion, commandChannelId: null, enabledAt: null }, ...none };
  return { ...base, connection: { id: W.TEAM.id, guildId: W.GUILD.id, guildName: W.GUILD.name, status: S.active ? 'active' : 'paused', paused: !S.active,
    configVersion: S.configVersion, commandChannelId: S.commandChannelId, enabledAt: S.enabledAt },
  channels: W.CHANNELS, roles: [{ id: '1291847362058123790', name: 'Joueurs', mentionable: true }, { id: '1291847362058123791', name: 'Staff', mentionable: true }],
  health: { checkedAt: iso(S.now), verified: true, errorCode: null } };
}
function lierRequest() {
  return { discordUserId: W.DISCORD_USER.id, discordLabel: W.DISCORD_USER.label, expiresAt: iso(W.CLOCK.lierRequested + 10 * W.MIN), prepared: S.accountPrepared };
}
// Champion portraits go through /asset-proxy: fetched once from Data Dragon (async, so timers keep running), then cached.
async function asset(url) {
  const target = new URL(url.searchParams.get('url'));
  const name = target.pathname.replace(/[^a-zA-Z0-9._-]+/g, '_');
  for (const dir of CACHE_DIRS) if (fs.existsSync(path.join(dir, name))) return fs.readFileSync(path.join(dir, name));
  const file = path.join(CACHE_DIRS[0], name);
  try { await execFileAsync('curl', ['-sS', '-f', '-L', '-o', `${file}.part`, target.href], { timeout: 20000 }); fs.renameSync(`${file}.part`, file); } catch { return null; }
  return fs.readFileSync(file);
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--font-render-hinting=none'] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: 'dark', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
  // Date.now() and new Date() return the journey's frozen time; timers keep running (polling, toasts, debounces).
  const setClock = async (t) => { S.now = t; await context.clock.setFixedTime(t); };
  await setClock(W.CLOCK.arrival);
  // Capture-only rule (documented): hide the subscription badge of the sidebar.
  await context.addInitScript(() => {
    const css = '.nxt5-sidebar-subscription{display:none!important}';
    const add = () => { const s = document.createElement('style'); s.dataset.capture = 'tuto-discord'; s.textContent = css; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  });
  // discord.com is never reached: the tabs it would open (invite, « Voir le message ») get a blank page and are recorded.
  await context.route(/^https:\/\/(www\.)?discord\.com\//, (route) => { S.popups.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fixture</title>' }); });
  const page = await context.newPage();
  context.on('page', async (p) => { if (p !== page) { await p.waitForLoadState().catch(() => {}); await p.close().catch(() => {}); } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await context.route('**/.netlify/functions/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const name = url.pathname.split('/').pop();
    let body = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    S.calls.push(`${req.method()} ${name}${url.search ? url.search.slice(0, 90) : ''}${body?.action ? ` action=${body.action}` : ''}`);
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const later = (ms) => new Promise((r) => setTimeout(r, ms));
    if (name === 'auth-me') return json({ user: W.USER });
    if (name === 'bootstrap') return json(bootstrap(url));
    if (name === 'account-subscription') return json({ subscription: { status: 'none' } });
    if (name === 'opponents-drafts') return json({ opponents: W.OPPONENTS, canEdit: true, ...(body?.action === 'get-match-opponent' ? { opponentId: W.OPPONENTS[0].id } : {}) });
    if (name === 'match-details') return json({ matches: [matchRow()] });
    if (name === 'asset-proxy') {
      const bytes = await asset(url);
      const type = /\.png$/i.test(url.searchParams.get('url') || '') ? 'image/png' : 'image/jpeg';
      return bytes ? route.fulfill({ status: 200, contentType: type, body: bytes }) : json({ error: 'asset' }, 404);
    }
    if (name === 'discord-account') {
      if (req.method() === 'POST') { S.accountPrepared = true; return json({ link: null, request: lierRequest(), accountName: W.USER.account_name }); }
      if (S.accountLinked) return json({ link: { id: 'dl-1', discord_user_id: W.DISCORD_USER.id, discord_label: W.DISCORD_USER.label, created_at: iso(S.now) } });
      if (url.searchParams.get('token') || S.accountPrepared) return json({ link: null, request: lierRequest(), accountName: W.USER.account_name });
      return json({ link: null });
    }
    if (name === 'team-discord-connection') {
      if (req.method() === 'GET') return json(connectionStatus());
      // team-discord-connection.ts: one code, valid 10 minutes.
      if (body.action === 'create-link') { if (!S.connRow) S.connRow = 'pending'; return json({ code: W.LINK_CODE, expiresAt: iso(S.now + 10 * W.MIN), installUrl: INSTALL_URL }); }
      if (body.action === 'command-channel') { S.commandChannelId = body.channelId; S.configVersion += 1; return json({ ok: true }); }
      if (body.action === 'resume') { S.active = true; S.enabledAt = S.enabledAt || iso(S.now); return json({ ok: true }); }
      return json({ error: 'Action inconnue.', code: 'DISCORD_FAILED' }, 400);
    }
    if (name === 'team-discord-routes') {
      if (req.method() === 'GET') return json({ routes: S.routes, guildId: S.connRow === 'linked' ? W.GUILD.id : null, configVersion: S.connRow ? S.configVersion : null });
      S.routes = body.routes.map((r, i) => ({ id: r.id || (r.channelId === W.PUBLISH_CHANNEL.id ? W.ROUTE_ID : `9b1e4c2a-7d3f-4e8a-9c6b-00000000000${i + 1}`), channelId: r.channelId,
        channelName: W.CHANNELS.find((c) => c.id === r.channelId)?.name, categoryIds: r.categoryIds, includeHints: r.includeHints, mentionRoleId: r.mentionRoleId, enabled: r.enabled }));
      S.configVersion += 1;
      return json({ ok: true });
    }
    if (name === 'team-discord-test') {
      if (req.method() === 'GET') return json({ ...TEST_PAYLOAD, latestTest: S.test, pendingTests: [] });
      const target = S.routes.find((r) => r.id === body.routeId);
      S.test = { requestId: body.requestId, routeId: body.routeId, channelId: target.channelId, guildId: W.GUILD.id, configVersion: S.configVersion, status: 'succeeded',
        messageUrl: `https://discord.com/channels/${W.GUILD.id}/${target.channelId}/1292000000000000101`, createdAt: iso(S.now), completedAt: iso(S.now), errorCode: null };
      await later(400);
      return json({ test: S.test });
    }
    if (name === 'team-discord-preview') { await later(300); return json(PREVIEW_PAYLOAD); }
    if (name === 'team-discord-publish') {
      const target = S.routes.find((r) => r.id === body.routeId);
      const job = { id: '5d0c1b2a-3e4f-4a5b-8c6d-7e8f9a0b1c2d', status: 'succeeded', matchId: body.matchId, channelId: target.channelId, routeId: target.id, configVersion: S.configVersion,
        revision: body.snapshotRevision, messageUrl: `https://discord.com/channels/${W.GUILD.id}/${target.channelId}/1292000000000000202`, errorCode: null, lastError: null, createdAt: iso(S.now), updatedAt: iso(S.now) };
      // team-discord-deliveries.ts labels a game by its opponent column, that is its name.
      S.deliveries.unshift({ ...job, publicationId: 'pub-1', matchLabel: MATCH.opponent, channelName: target.channelName, canRetry: false, canResolve: false, canRemove: true });
      await later(400);
      return json({ ok: true, requestId: body.requestId, jobs: [job] });
    }
    if (name === 'team-discord-deliveries') return json({ deliveries: S.deliveries });
    return json({});
  });

  const entries = {};
  const settle = (ms = 700) => page.waitForTimeout(ms);
  const park = () => parkMouse(page, [[1430, 450], [1400, 880], [720, 880], [10, 890], [700, 150], [380, 60]]);
  const dialogOpen = () => page.evaluate(() => Boolean(document.querySelector('dialog[open]')));
  // Visible loaders (spinners, aria-busy, « Chargement… »-like texts). The link-code polling sentence is a steady state.
  const loadersOnScreen = () => page.evaluate(() => {
    const visible = (r) => r.width && r.height && r.bottom > 0 && r.top < innerHeight;
    const hits = Array.from(document.querySelectorAll('[aria-busy="true"], .animate-spin, .discord-loading')).filter((e) => visible(e.getBoundingClientRect()))
      .map((e) => (e.textContent.trim() || e.className.toString()).slice(0, 60));
    const re = /^(Chargement|Vérification|Actualisation|Enregistrement|Préparation|Envoi|Confirmation|Déliaison)\b[^.]*…$/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      if (!re.test(text) || text.startsWith('Vérification automatique de la liaison')) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      if (Array.from(range.getClientRects()).some(visible)) hits.push(text.slice(0, 60));
    }
    return hits;
  });
  async function waitQuiet(timeout = 12000) {
    await page.waitForLoadState('networkidle').catch(() => {});
    // Images change the layout once decoded (the game visual makes the dialog grow): frame only after them.
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), null, { timeout }).catch(() => {});
    const until = Date.now() + timeout;
    while (Date.now() < until) { if (!(await loadersOnScreen()).length) return; await page.waitForTimeout(250); }
  }
  // Frame edges: the sticky top bar (or the open dialog's sticky header) and the bottom of the window (or of the dialog).
  // What an edge may not slice, each with a weight (FATAL ones are refused, the others only make a position worse):
  // - a text line, a control, an image or a badge, at either edge, with EDGE_MARGIN px of air: FATAL;
  // - a paragraph-like block at the top edge, which would leave an orphan line (« démarrer » under the top bar): FATAL;
  //   at the bottom edge a block may stop between two lines, as any page that goes on;
  // - a bordered box (card, callout) short enough to fit, at the top edge: FATAL when some of its text stays visible below
  //   the edge (a callout without its head), else 3 (an empty sliver of its padding);
  // - a border line within 1 px of an edge: 1.
  // `ignore`: selectors allowed to run past an edge (the tall game visual); `tolerate`: bordered boxes that may lose their head
  // under the top edge (weight 3 instead of FATAL), when no frame avoids it.
  const FATAL = 100;
  const EDGE_MARGIN = 4;
  const EDGE_JS = `({ ignore = [], tolerate = [] }) => {
    // GameOperationDialog scrolls itself (overflow: auto) under its sticky header.
    const dialog = document.querySelector('dialog[open]');
    // The dialog header only sticks once its top padding has scrolled away: below that its bottom edge moves with the content.
    const header = dialog?.querySelector('.game-operation-dialog-header');
    const stuck = dialog ? dialog.getBoundingClientRect().top + dialog.clientTop + header.offsetHeight : 0;
    const headerOffset = dialog ? header.getBoundingClientRect().top - dialog.getBoundingClientRect().top - dialog.clientTop + dialog.scrollTop : 0;
    const top = dialog ? header.getBoundingClientRect().bottom : document.querySelector('.nxt5-topbar').getBoundingClientRect().bottom;
    const bottom = dialog ? Math.min(innerHeight, dialog.getBoundingClientRect().bottom) : innerHeight;
    // The whole page, site footer included (its logo and links may not be sliced either); the top bar and the menu are fixed.
    const scope = dialog ? dialog.querySelector('.game-operation-dialog-content') : document.body;
    // Screen-reader-only text and the content of a closed <details> keep a layout box but draw nothing.
    const skip = (e) => (e.closest ? e : e.parentElement).closest(['.nxt5-topbar', 'aside', '.nxt5-toast', '.game-operation-dialog-header', '.sr-only',
      'details:not([open]) > :not(summary)', ...ignore].join(','));
    // Units: [top, bottom, label, edges ('both' or 'top'), margin, weight].
    const units = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || skip(n)) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.height) units.push([r.top, r.bottom, n.textContent.trim().slice(0, 40), 'both', ${EDGE_MARGIN}, ${FATAL}]);
    }
    // Heading rows (« Pour l’équipe » + team name + server, title + badge) and the step tabs (tall cards) are blocks.
    const strict = 'select, input, button:not([role="tab"]), img, svg, a, code, .nxt5-badge';
    for (const e of scope.querySelectorAll('select, input, button, img, svg, a, code, .nxt5-badge, .discord-team-identity, .discord-heading, p, li, h1, h2, h3, h4, h5, dt, dd, legend, summary, label')) {
      if (skip(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.height && r.height < 260) units.push([r.top, r.bottom, (e.textContent.trim() || e.tagName).slice(0, 40), e.matches(strict) ? 'both' : 'top', e.matches(strict) ? ${EDGE_MARGIN} : 0, ${FATAL}]);
    }
    const alpha = (color) => (color.startsWith('rgba') ? Number(color.slice(color.lastIndexOf(',') + 1, -1)) : color === 'transparent' ? 0 : 1);
    const drawn = (width, style, color) => parseFloat(width) > 0 && style !== 'none' && alpha(color) > 0.05;
    for (const e of scope.querySelectorAll('*')) {
      if (skip(e)) continue;
      const r = e.getBoundingClientRect();
      if (!r.height || !r.width) continue;
      const cs = getComputedStyle(e);
      const label = 'bord ' + (e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName);
      const borderTop = drawn(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor);
      const borderBottom = drawn(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor);
      if (borderTop) units.push([r.top, r.top + 1, label, 'both', 1, 1]);
      if (borderBottom) units.push([r.bottom - 1, r.bottom, label, 'both', 1, 1]);
      const boxed = borderTop || borderBottom || drawn(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor) || drawn(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor);
      if (!boxed || r.height >= 260) continue;
      // Bottom of the box's last text line: an edge above it leaves text of a headless box in the frame.
      let textBottom = r.top;
      const texts = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n = texts.nextNode(); n; n = texts.nextNode()) {
        if (!n.textContent.trim() || skip(n)) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        for (const t of range.getClientRects()) if (t.height) textBottom = Math.max(textBottom, t.bottom);
      }
      units.push([r.top, r.bottom, label, 'top', 0, 3, ...(tolerate.some((sel) => e.matches(sel)) ? [] : [textBottom])]);
    }
    return { top, stuck, headerOffset, bottom, units, dialog: Boolean(dialog), y: dialog ? dialog.scrollTop : scrollY,
      max: dialog ? dialog.scrollHeight - dialog.clientHeight : document.documentElement.scrollHeight - innerHeight };
  }`;
  const edgeState = (ignore, tolerate) => page.evaluate(`(${EDGE_JS})(${JSON.stringify({ ignore, tolerate })})`);
  // Top edge once the content has moved by `delta` px (the dialog header sticks only after its own offset).
  const topAt = (state, delta) => (state.dialog ? state.stuck + Math.max(0, state.headerOffset - (state.y + delta)) : state.top);
  // Units an edge slices when the content has moved by `delta` px.
  const cutAt = (state, delta = 0) => {
    const top = topAt(state, delta);
    return state.units.filter(([a, b, , edges, m]) => (a - delta < top + m && b - delta > top - m)
      || (edges === 'both' && a - delta < state.bottom + m && b - delta > state.bottom - m))
      .map((u) => (u[6] !== undefined && u[6] - delta > top ? [...u.slice(0, 5), FATAL] : u));
  };
  const penalty = (cuts) => cuts.reduce((sum, u) => sum + u[5], 0);
  // Elements the shot is about stay clear of the edges.
  const KEEP_MARGIN = 8;
  // The publication form has no class of its own: mark it (again after each re-render) for the selectors below.
  const markRoutes = () => page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('.discord-step-panel h4')).find((x) => x.textContent.includes('Où recevoir les résultats'));
    h?.closest('form')?.setAttribute('data-capture', 'routes');
  });
  // Scrolls the page (or the open dialog) near `target` (absolute scroll offset, default: current), within ±range px, to the
  // position with the lowest edge penalty where every `keep` element is entirely inside the frame and every `avoid` element
  // entirely outside it (nearest one on a tie).
  async function frame(target, { keep = [], avoid = [], ignore = [], tolerate = [], range = 240 } = {}) {
    await markRoutes();
    const state = await edgeState(ignore, tolerate);
    // [top, bottom] of every element matched by each selector.
    const spans = (selectors) => page.evaluate((selectors) => selectors.map((sel) => Array.from(document.querySelectorAll(sel))
      .map((e) => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; })), selectors);
    const keepSpans = await spans(keep);
    if (keepSpans.some((list) => !list.length)) throw new Error(`frame: élément absent parmi ${JSON.stringify(keep)}`);
    const keepBoxes = keepSpans.map((list) => list[0]);
    const avoidBoxes = (await spans(avoid)).flat();
    const want = Math.max(0, Math.min(state.max, Math.round(target ?? state.y)));
    let best = null;
    for (let d = 0; d <= range; d++) {
      for (const y of d ? [want - d, want + d] : [want]) {
        if (y < 0 || y > state.max) continue;
        const delta = y - state.y;
        if (!keepBoxes.every(([a, b]) => a - delta >= topAt(state, delta) + KEEP_MARGIN && b - delta <= state.bottom - KEEP_MARGIN)) continue;
        if (avoidBoxes.some(([a, b]) => b - delta > topAt(state, delta) && a - delta < state.bottom)) continue;
        const score = penalty(cutAt(state, delta));
        if (!best || score < best.score) best = { y, score };
      }
      if (best?.score === 0) break;
    }
    report.push(`frame ${state.dialog ? 'dialog' : 'page'} want=${want} chosen=${best?.y} penalty=${best?.score} max=${state.max} keep=${keep.join('|')}${best?.score ? ` (${cutAt(state, best.y - state.y).map((u) => u[2]).join(', ')})` : ''}`);
    if (!best || best.score >= FATAL) {
      const at = best ? best.y : want;
      throw new Error(`Pas de cadrage propre autour de ${want} (keep ${JSON.stringify(keep)}) : ${JSON.stringify(cutAt(state, at - state.y).slice(0, 4))}`);
    }
    await page.evaluate(({ y, dialog }) => {
      if (dialog) document.querySelector('dialog[open]').scrollTop = y;
      else window.scrollTo({ top: y, behavior: 'instant' });
    }, { y: best.y, dialog: state.dialog });
    await settle(350);
    const after = await edgeState(ignore, tolerate);
    if (Math.abs(after.y - best.y) > 1 || penalty(cutAt(after)) > best.score) throw new Error(`frame: position ${after.y} au lieu de ${best.y}, coupes ${JSON.stringify(cutAt(after).slice(0, 3))}`);
  }
  // Scroll offset that puts `selector`'s top `offset` px below the top edge (or its bottom `offset` px above the bottom edge).
  async function offsetFor(selector, offset, align = 'top') {
    const s = await edgeState();
    const r = await page.locator(selector).first().boundingBox();
    return align === 'top' ? s.y + r.y - (s.dialog ? s.stuck : s.top) - offset : s.y + r.y + r.height - s.bottom + offset;
  }
  const frameOn = async (selector, offset = 16, opts = {}) => { await markRoutes(); return frame(await offsetFor(selector, offset, opts.align), opts); };

  async function shot(id, { journey, storyboard, state: desc, boxes, ignore = [], tolerate = [], allowFocus = [], extra }) {
    await page.evaluate(() => document.fonts.ready);
    await waitQuiet();
    await settle(400);
    await markRoutes();
    const focus = await focusReport(page);
    if (focus.focusVisible && !allowFocus.includes(focus.active)) throw new Error(`${id}: focus visible inattendu sur ${focus.active}`);
    const loaders = await loadersOnScreen();
    if (loaders.length) throw new Error(`${id}: chargement visible ${JSON.stringify(loaders)}`);
    if (await page.getByRole('button', { name: /Tout refuser/i }).count()) throw new Error(`${id}: bannière cookies visible`);
    const cuts = cutAt(await edgeState(ignore, tolerate));
    if (penalty(cuts) >= FATAL) throw new Error(`${id}: bord qui coupe ${JSON.stringify(cuts.filter((u) => u[5] >= FATAL).slice(0, 4))}`);
    // No price, offer, pass, subscription, trial or « free » wording may be visible in the frame.
    const offer = await page.evaluate(() => {
      const re = /(?<!\p{L})(pass|abonnements?|gratuite?s?|gratuitement|tarifs?|offres?|essais?|découvertes?|prix|premium|payante?s?)(?!\p{L})|€/iu;
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
    const occluders = (await dialogOpen()) ? ['dialog[open] .game-operation-dialog-header'] : ['.nxt5-topbar'];
    const { boxes: b, missing, hidden } = await collectBoxes(page, boxes, occluders);
    entries[id] = { file: `tuto-discord/${file}`, app: 'site', css: { w: VIEWPORT.width, h: VIEWPORT.height }, scale: SCALE, px: { w: VIEWPORT.width * SCALE, h: VIEWPORT.height * SCALE },
      journey, storyboard, state: desc, method: METHOD, boxes: b, ...(missing.length ? { missingBoxes: missing } : {}), ...(hidden.length ? { hiddenBoxes: hidden } : {}),
      url: page.url().replace(SITE, ''), scrollY: await page.evaluate(() => window.scrollY), clock: new Date(S.now).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      focus: focus.focusVisible ? focus.active : null, ...(cuts.length ? { edgeNotes: [...new Set(cuts.map((u) => u[2]))] } : {}), ...(extra ? await extra() : {}) };
    report.push(`${id}  focus=${focus.active}${focus.focusVisible ? ' (visible)' : ''} missing=[${missing.join(',')}] hidden=[${hidden.join(',')}]`);
    console.log('shot', id);
  }
  // A mouse pick in a native <select> leaves it focused with its cyan :focus ring (Core.jsx SelectInput); the next click
  // moves the focus anyway. The list itself is never captured (native popups are not drawn headless): cut before/after.
  async function pick(label, option) {
    const select = page.getByLabel(label);
    await select.selectOption({ label: option });
    await select.evaluate((e) => e.blur());
    await settle(400);
  }
  // Navigation: the app shell and the page's own content must be rendered. A fresh Vite server transforms the whole app on
  // the first visit, which can take a while on a busy machine.
  async function open(url, ready) {
    await page.goto(`${SITE}${url}`, { waitUntil: 'load', timeout: 90000 });
    try {
      await page.waitForSelector('.nxt5-topbar', { timeout: 90000 });
      await page.waitForSelector(ready, { timeout: 30000 });
    } catch (error) {
      await page.screenshot({ path: path.join(LOG_DIR, 'open-failure.png') }).catch(() => {});
      throw error;
    }
    await waitQuiet();
  }
  const textOf = (selector) => page.locator(selector).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim());

  // --- Boxes (CSS px). Click targets, fields, badges and messages the film zooms on.
  const SHELL = { sidebar: 'aside.nxt5-sidebar', sidebarGroup: { sel: 'aside.nxt5-sidebar summary, aside.nxt5-sidebar button', text: 'Préparation et partage', deepest: true },
    sidebarBot: { sel: 'aside.nxt5-sidebar a', exactText: 'Bot Discord' }, topbarTeam: { sel: 'header button', text: NAMES.team } };
  const PAGE = { pageEyebrow: '.nxt5-page-eyebrow', pageTitle: '.nxt5-page-title', pageSubtitle: '.nxt5-page-subtitle' };
  const ACCOUNT = { accountPanel: '.discord-account', accountTitle: '.discord-account-title', accountDescription: '.discord-account-description',
    accountBadge: '.discord-account-heading-actions .nxt5-badge' };
  const ACCOUNT_START = { accountCommand: '.discord-account-command', accountCommandCode: '.discord-account-command code', copyLier: '.discord-account-command button',
    accountGuide: '.discord-account-guide summary' };
  const REQUEST = { request: '.discord-account-request', requestStep: '.discord-account-step-label', pair: '.discord-account-pair',
    nxt5Account: { sel: '.discord-account-pair > div', nth: 0 }, nxt5AccountName: { sel: '.discord-account-pair dd', nth: 0 },
    discordAccount: { sel: '.discord-account-pair > div', nth: 1 }, discordAccountName: { sel: '.discord-account-pair dd', nth: 1 },
    lierExpiry: { sel: '.discord-account-request > .discord-help', text: 'expire' } };
  const TEAM = { teamPanel: '.discord-dashboard', teamHeading: '.discord-dashboard-status', teamName: '.discord-dashboard-status h3',
    teamServer: '.discord-dashboard-status .discord-server', teamBadge: '.discord-dashboard-status > .nxt5-badge' };
  const STEPS = { steps: '.discord-install-progress', stepServer: { sel: '.discord-install-progress [role="tab"]', nth: 0 },
    stepSalons: { sel: '.discord-install-progress [role="tab"]', nth: 1 }, stepActivation: { sel: '.discord-install-progress [role="tab"]', nth: 2 } };
  const STEP1 = { stepPanel: '.discord-setup-step', stepTitle: '.discord-setup-step > h4', inviteTask: { sel: '.discord-connect-task', nth: 0 },
    inviteTitle: { sel: '.discord-connect-task h5', nth: 0 }, inviteButton: '.discord-invite-button', adminNote: { sel: '.discord-connect-task .discord-help', text: 'Administrateur' },
    linkTask: { sel: '.discord-connect-task', nth: 1 }, linkTitle: { sel: '.discord-connect-task h5', nth: 1 } };
  const CREATE_CODE = { createCode: { sel: '.discord-connect-task button', text: 'Créer le code de liaison' } };
  const NEW_CODE = { createNewCode: { sel: '.discord-connect-task button', text: 'Créer un nouveau code' } };
  const CODE = { codeBox: '.discord-link-code', codeLabel: { sel: '.discord-link-code > p', nth: 0 }, command: '.discord-link-code code',
    validUntil: { sel: '.discord-link-code .discord-help', text: 'Valable jusqu’au' }, copyCommand: { sel: '.discord-link-code button', text: 'Copier la commande' },
    verifyConnection: { sel: '.discord-link-code button', text: 'Vérifier la connexion' }, autoCheck: { sel: '.discord-link-code [role="status"]', text: 'Vérification automatique' } };
  const CMD = { commandSection: '.discord-command-channel', commandLabel: '.discord-command-channel .discord-task-label', commandTitle: '.discord-command-channel h4',
    commandBadge: '.discord-command-channel .discord-heading .nxt5-badge', commandText: { sel: '.discord-command-channel > p', nth: 0 },
    commandField: '.discord-command-channel .nxt5-field', commandSelect: '.discord-command-channel select' };
  const associate = { sel: '.discord-command-channel button', text: 'Associer ce salon' };
  const ROUTES = { routesForm: 'form[data-capture="routes"]', routesLabel: 'form[data-capture="routes"] .discord-task-label', routesTitle: 'form[data-capture="routes"] > h4',
    routesVisibility: { sel: 'form[data-capture="routes"] > .discord-help', text: 'Toute personne' }, picker: '.discord-channel-picker',
    pickerField: '.discord-channel-picker .nxt5-field', pickerSelect: '.discord-channel-picker select', addChannel: { sel: '.discord-channel-picker button', text: 'Ajouter ce salon' } };
  const ROUTE = { route: '.discord-route', routeName: '.discord-route legend', routeMode: '.discord-route .discord-route-mode', routeAuto: '.discord-route .discord-check',
    routeCategories: '.discord-route > .discord-help', save: { sel: '.discord-save-actions button', text: 'Enregistrer les salons' } };
  const ACT = { activation: '.discord-activation', activationKicker: '.discord-activation > .discord-step-kicker', activationTitle: '.discord-activation > h4',
    testTask: { sel: '.discord-activation-task', nth: 0 }, testTitle: { sel: '.discord-activation-task h5', nth: 0 }, previewSummary: '.discord-activation .discord-example summary',
    testField: '.discord-activation .nxt5-field', testSelect: '.discord-activation select', testWarning: { sel: '.discord-activation .discord-help', text: 'Ce bouton publie' } };
  const RECEIPT = { receipt: '.discord-test-receipt', receiptBadge: '.discord-test-receipt .nxt5-badge', receiptText: '.discord-test-receipt > p', testLink: '.discord-test-receipt a',
    newTest: { sel: '.discord-activation button', text: 'Envoyer un nouveau test' } };
  const ACTIVATE = { activateTask: { sel: '.discord-activation-task', nth: 1 }, activateTitle: { sel: '.discord-activation-task h5', nth: 1 } };
  const DIALOG = { dialog: 'dialog[open]', dialogHeader: 'dialog[open] .game-operation-dialog-header', dialogTitle: 'dialog[open] .game-operation-dialog-header h2',
    dialogSubtitle: { sel: 'dialog[open] .game-operation-dialog-header p', text: NAMES.game }, dialogClose: 'dialog[open] .game-operation-close',
    destinationField: 'dialog[open] .discord-share .nxt5-field', destinationSelect: 'dialog[open] .discord-share select',
    destinationHelp: { sel: 'dialog[open] .discord-share > .discord-help', text: 'visibles par les membres' }, prepare: { sel: 'dialog[open] button', text: 'Préparer l’aperçu' } };
  const PREVIEW = { preview: 'dialog[open] .discord-preview', previewTitle: 'dialog[open] .discord-preview > h4', embed: 'dialog[open] .discord-embed',
    embedTitle: 'dialog[open] .discord-embed h5', embedDescription: 'dialog[open] .discord-embed > .discord-message-content', image: 'dialog[open] .discord-preview-image',
    embedFooter: 'dialog[open] .discord-embed-footer', gameButton: 'dialog[open] .discord-preview-game', downloadVisual: { sel: 'dialog[open] .discord-preview-meta a', text: 'Télécharger le visuel' },
    revision: { sel: 'dialog[open] .discord-preview-meta .discord-help', text: 'Version des données' },
    publish: { sel: 'dialog[open] button', text: `Publier dans ${PUBLISH}` }, refreshPreview: { sel: 'dialog[open] button', text: 'Actualiser l’aperçu' } };

  // ===== 1 · Bot Discord page, nothing linked yet =====================================================================
  await open('/bot-discord', '.discord-dashboard');
  const refuse = page.getByRole('button', { name: 'Tout refuser' });
  if (await refuse.count()) { await refuse.first().click(); await settle(600); }
  await waitQuiet();
  await frame(0);
  await park();
  await shot('site-01-page-bot-discord', { journey: 'd01', storyboard: ['1'], state: `Page « Bot Discord » (menu « Préparation et partage » > « Bot Discord ») : « Toi sur Discord » avec « Compte non lié » et « Copier /nxt lier », « Le bot de ${NAMES.team} » « Serveur : aucun serveur relié » avec « À installer », assistant « Installer le bot » sur l’onglet « Serveur ».`,
    boxes: { ...SHELL, ...PAGE, ...ACCOUNT, ...ACCOUNT_START, ...TEAM, ...STEPS } });
  await page.locator('.discord-account-guide summary').click();
  await settle(500);
  // The open guide makes the card tall: frame the whole card under the top bar rather than the page header.
  await frameOn('.discord-account', 16, { keep: ['.discord-account'] });
  await park();
  await shot('site-02-compte-comment-relier', { journey: 'd02', storyboard: ['3'], state: '« Toi sur Discord » : « Comment relier mon compte ? » déplié (Dans Discord / Sur NXT5 / De retour dans Discord). Non monté dans le déroulé actuel.',
    boxes: { ...SHELL, ...ACCOUNT, ...ACCOUNT_START, accountSteps: '.discord-account-steps', accountStep1: { sel: '.discord-account-steps li', nth: 0 },
      accountStep2: { sel: '.discord-account-steps li', nth: 1 }, accountStep3: { sel: '.discord-account-steps li', nth: 2 } } });
  await page.locator('.discord-account-command button').click();
  await settle(500);
  await frameOn('.discord-account', 16, { keep: ['.discord-account'] });
  await park();
  await shot('site-03-copier-nxt-lier', { journey: 'd03', storyboard: ['3a'], state: 'Après « Copier /nxt lier » : bouton « Commande copiée » et « Commande copiée. Colle-la dans Discord, puis ouvre le lien du bot. ». Non monté dans le déroulé actuel.',
    boxes: { ...SHELL, ...ACCOUNT, ...ACCOUNT_START, copyNotice: '.discord-account-copy-notice' } });

  // ===== 3 · Personal link: the bot's « Ouvrir NXT5 » opens /bot-discord?lier=<token> ==================================
  await setClock(W.CLOCK.lier);
  await open(`/bot-discord?lier=${LIER_TOKEN}`, '.discord-account-request');
  await frame(0);
  await park();
  await shot('site-04-lien-personnel-confirmer', { journey: 'd04', storyboard: ['3b'], state: `Arrivée par le lien personnel du bot (/bot-discord?lier=…) : « À confirmer ici », « Étape 2 sur 3 · Confirmation sur NXT5 », « Ton compte NXT5 » ${NAMES.nxt5AccountName} / « Ton compte Discord » ${NAMES.ownerDiscordName}, « Confirmer mon compte NXT5 ».`,
    boxes: { ...SHELL, ...ACCOUNT, ...REQUEST, requestText: { sel: '.discord-account-request > p', text: 'Ces deux comptes' }, confirm: { sel: '.discord-account-request button', text: 'Confirmer mon compte NXT5' } },
    extra: async () => ({ lierExpiryText: await textOf('.discord-account-request > .discord-help') }) });
  // Consecutive states of one action keep the same scroll when it stays clean, so the film can cross-fade them.
  const scrollY = () => page.evaluate(() => window.scrollY);
  let previousY = await scrollY();
  await page.getByRole('button', { name: 'Confirmer mon compte NXT5' }).click();
  await settle(700);
  await frame(previousY);
  await park();
  await shot('site-05-lien-personnel-confirme', { journey: 'd05', storyboard: ['3c'], state: '« À terminer dans Discord », « Étape 3 sur 3 · Retour dans Discord », « Compte NXT5 confirmé. Dernière étape dans Discord. », « J’ai confirmé dans Discord · Vérifier ».',
    boxes: { ...SHELL, ...ACCOUNT, ...REQUEST, feedback: '.discord-account-request .discord-feedback', feedbackTitle: '.discord-account-request .discord-feedback strong',
      verify: { sel: '.discord-account-request button', text: 'J’ai confirmé dans Discord' } } });
  S.accountLinked = true; // « Vérifier la liaison » then « Confirmer la liaison » in Discord (real captures dc08, dc09)
  await page.getByRole('button', { name: /J’ai confirmé dans Discord/ }).click();
  await settle(800);
  // The card shrinks once linked: frame it with the team heading (« À installer ») below it.
  await frameOn('.discord-account', 16, { keep: ['.discord-account', '.discord-dashboard-status'] });
  await park();
  await shot('site-06-compte-lie', { journey: 'd06', storyboard: ['3e'], state: `« Compte lié » : « ${NAMES.ownerDiscordName} · ton compte personnel est reconnu par NXT5. », « Pour commencer : lance /nxt help… ». Le bot de l’équipe reste « À installer ».`,
    boxes: { ...SHELL, ...ACCOUNT, accountName: '.discord-account-description strong', accountNext: '.discord-account-next', manage: { sel: '.discord-account button', exactText: 'Gérer' }, ...TEAM } });

  // ===== 2 · Invite the bot (filmed before step 3: the account card is out of frame) ===================================
  await setClock(W.CLOCK.invite);
  await frameOn('.discord-dashboard', 16);
  await park();
  await shot('site-07-etape1-ajouter-a-discord', { journey: 'd07', storyboard: ['2'], state: 'Onglet « Serveur » : « 1. Ajouter NXT5 dans Discord » avec « Ajouter à Discord » (bouton principal) et la mention de l’autorisation Administrateur, « 2. Relier cette équipe au serveur » avec « Créer le code de liaison ».',
    boxes: { ...TEAM, ...STEPS, ...STEP1, ...CREATE_CODE } });
  await page.locator('.discord-invite-button').click();
  await settle(900);
  await page.bringToFront();
  await waitQuiet();
  await frame();
  await park();
  await shot('site-08-invitation-ouverte', { journey: 'd08', storyboard: ['2'], state: 'Après « Ajouter à Discord » (nouvel onglet discord.com intercepté) : « Invitation ouverte. Termine l’autorisation dans Discord, puis utilise le code ci-dessous. », « Créer le code de liaison » devient le bouton principal. Le badge reste « À installer ».',
    boxes: { ...TEAM, ...STEPS, ...STEP1, ...CREATE_CODE, inviteStatus: { sel: '.discord-connect-task [role="status"]', text: 'Invitation ouverte' } } });

  // ===== 4 · Link the team to the server ===============================================================================
  await setClock(W.CLOCK.code);
  await page.getByRole('button', { name: 'Créer le code de liaison' }).click();
  await page.waitForSelector('.discord-link-code');
  await settle(600);
  await frameOn('.discord-link-code', 24, { align: 'bottom', keep: ['.discord-link-code', '.discord-connect-task h5'] });
  await park();
  const validUntil = await textOf('.discord-link-code .discord-help');
  if (!validUntil.includes(`Valable jusqu’au ${NAMES.linkCodeValidUntil}.`)) throw new Error(`site-09: « ${validUntil} » ne correspond pas à names.json (${NAMES.linkCodeValidUntil})`);
  if ((await textOf('.discord-link-code code')) !== NAMES.linkCommand) throw new Error('site-09: commande différente de names.json');
  await shot('site-09-code-de-liaison', { journey: 'd09', storyboard: ['4'], state: `Code créé : « Commande de liaison à usage unique », « ${NAMES.linkCommand} », « Valable jusqu’au ${NAMES.linkCodeValidUntil}. Un nouveau code remplace le précédent. », « Copier la commande », « Vérifier la connexion », vérification automatique pendant deux minutes.`,
    boxes: { ...STEP1, ...NEW_CODE, ...CODE }, extra: async () => ({ validUntilText: validUntil }) });
  previousY = await scrollY();
  await page.getByRole('button', { name: 'Copier la commande' }).click();
  await settle(500);
  await frame(previousY, { keep: ['.discord-link-code'] });
  await park();
  await shot('site-10-commande-copiee', { journey: 'd10', storyboard: ['4'], state: 'Après « Copier la commande » : « Commande copiée. Colle-la dans le serveur Discord de l’équipe. » sous les boutons, même cadrage que site-09 à quelques px près.',
    boxes: { ...STEP1, ...NEW_CODE, ...CODE, copyNotice: { sel: '.discord-link-code [role="status"]', text: 'Commande copiée' } } });

  // /nxt connecter pasted in Discord (real captures dc10, dc11): the next check sees the server. « Vérifier la connexion »
  // stands for the automatic check (every 5 s) and gives the same result.
  await setClock(W.CLOCK.linked);
  S.connRow = 'linked'; S.configVersion = 2;
  await page.getByRole('button', { name: 'Vérifier la connexion' }).click();
  await page.waitForSelector('.discord-command-channel');
  await waitQuiet();
  await frameOn('.discord-dashboard', 16);
  await park();
  await shot('site-11-serveur-relie-salons', { journey: 'd11', storyboard: ['4', '5'], state: `Serveur relié : en-tête « Serveur : ${NAMES.server} » avec « Serveur relié », onglet « Serveur » coché ; l’assistant passe seul à « Salons » (« Usage 1 · Les commandes », « Où utiliser le bot ? », « À choisir »).`,
    boxes: { ...TEAM, ...STEPS, ...CMD, associate } });
  await page.getByRole('tab', { name: 'Connecter le serveur' }).click();
  await settle(400);
  await frame();
  await park();
  await shot('site-12-etape1-serveur-associe', { journey: 'd12', storyboard: ['4'], state: `Onglet « Serveur » après la liaison : « Équipe et serveur associés », « ${NAMES.team} est reliée à ${NAMES.server}. », « Le bot ne voit pas un salon ? », « Choisir les salons ». Non monté dans le déroulé actuel.`,
    boxes: { ...TEAM, ...STEPS, stepPanel: '.discord-setup-step', associatedBadge: '.discord-setup-step .nxt5-badge', associatedText: '.discord-setup-step > p',
      permissionHelp: '.discord-permission-update summary', chooseChannels: { sel: '.discord-setup-step button', text: 'Choisir les salons' } } });

  // ===== 5 · Channels ==================================================================================================
  await page.getByRole('button', { name: 'Choisir les salons' }).click();
  await settle(500);
  await pick('Salon des commandes de l’équipe', `#${NAMES.commandChannel}`);
  await frameOn('.discord-command-channel', 20, { keep: ['.discord-command-channel'] });
  await park();
  await shot('site-13-salon-commandes-choisi', { journey: 'd13', storyboard: ['5'], state: `« Usage 1 · Les commandes » « Où utiliser le bot ? » (« À choisir ») : « Salon des commandes de l’équipe » = #${NAMES.commandChannel}, « Choix non enregistré. », « Associer ce salon » actif. La liste déroulante native n’est pas capturée : couper entre site-11 et site-13.`,
    boxes: { ...STEPS, ...CMD, associate, commandUnsaved: { sel: '.discord-command-channel [role="status"]', text: 'Choix non enregistré' }, ...ROUTES }, extra: async () => ({ commandValue: await page.locator('.discord-command-channel select').evaluate((s) => s.options[s.selectedIndex].text) }) });
  previousY = await scrollY();
  await page.getByRole('button', { name: 'Associer ce salon' }).click();
  await settle(900);
  await waitQuiet();
  await frame(previousY, { keep: ['.discord-command-channel'] });
  await park();
  await shot('site-14-salon-commandes-associe', { journey: 'd14', storyboard: ['5'], state: `« Associé » : « Les commandes lancées dans #${NAMES.commandChannel} concernent automatiquement ${NAMES.team}. », « Salon des commandes enregistré. », « Changer le salon » (inactif). Même cadrage que site-13 à quelques px près.`,
    boxes: { ...STEPS, ...CMD, changeChannel: { sel: '.discord-command-channel button', text: 'Changer le salon' },
      commandSaved: { sel: '.discord-command-channel .discord-feedback', text: 'Salon des commandes enregistré' }, ...ROUTES } });
  await pick('Choisir un salon du serveur', PUBLISH);
  await frameOn('form[data-capture="routes"]', 20, { keep: ['.discord-channel-picker'] });
  await park();
  await shot('site-15-salon-publication-choisi', { journey: 'd15a', storyboard: ['5'], state: `« Usage 2 · Les publications » « Où recevoir les résultats ? » : « Choisir un salon du serveur » = ${PUBLISH}, « Ajouter ce salon » actif, aucun salon encore ajouté.`,
    boxes: { ...ROUTES }, extra: async () => ({ pickerValue: await page.locator('.discord-channel-picker select').evaluate((s) => s.options[s.selectedIndex].text) }) });
  await page.getByRole('button', { name: 'Ajouter ce salon' }).click();
  await settle(500);
  await frameOn('form[data-capture="routes"]', 20, { keep: ['.discord-route', '.discord-save-actions'] });
  await park();
  await shot('site-16-salon-publication-ajoute', { journey: 'd15', storyboard: ['5'], state: `${PUBLISH} ajouté : « ${PUBLISH} Automatique », « Publier automatiquement les nouvelles parties » coché, « Toutes les catégories », « Options du salon » ; « Enregistrer les salons » (principal) et « Modifications non enregistrées. ».`,
    boxes: { ...ROUTES, ...ROUTE, unsaved: { sel: '.discord-save-actions [role="status"]', text: 'Modifications non enregistrées' } } });
  await page.getByRole('button', { name: 'Enregistrer les salons' }).click();
  await settle(900);
  await waitQuiet();
  await frameOn('.discord-step-panel:not([hidden]) > .discord-actions', 24, { align: 'bottom', keep: ['.discord-route', '.discord-step-panel:not([hidden]) > .discord-actions'] });
  await park();
  await shot('site-17-salons-enregistres', { journey: 'd16', storyboard: ['5'], state: '« Salons enregistrés. », « Enregistrer les salons » redevenu inactif, puis « Passer au test et à l’activation » (bouton principal).',
    boxes: { ...ROUTES, ...ROUTE, saved: { sel: 'form[data-capture="routes"] .discord-feedback', text: 'Salons enregistrés' },
      nextStep: { sel: '.discord-step-panel button', text: 'Passer au test et à l’activation' } } });

  // ===== 6 · Test message ==============================================================================================
  await page.getByRole('button', { name: 'Passer au test et à l’activation' }).click();
  await settle(700);
  await waitQuiet();
  await frameOn('.discord-dashboard', 16, { keep: ['.discord-activation .discord-actions'] });
  await park();
  await shot('site-18-etape3-test', { journey: 'd17', storyboard: ['6'], state: `Onglet « Activation » : « Étape 3 », « Tester et activer », « 1. Vérifier la réception d’un exemple », « Prévisualiser l’exemple fictif », « Salon du message de test » = ${PUBLISH}, « Envoyer le message de test ».`,
    boxes: { ...TEAM, ...STEPS, ...ACT, sendTest: { sel: '.discord-activation button', text: 'Envoyer le message de test' } } });
  await page.locator('.discord-activation .discord-example summary').click();
  await settle(700);
  await frameOn('.discord-activation .discord-example summary', 16, { ignore: ['.discord-preview-image'], range: 260,
    keep: ['.discord-activation .discord-example summary', '.discord-activation .discord-embed h5'] });
  await park();
  await shot('site-19-apercu-exemple-fictif', { journey: 'd18', storyboard: ['6'], state: '« Prévisualiser l’exemple fictif » ouvert : « Exemple de message et de visuel », « Données fictives… », message « 🧪 Test de connexion NXT5 — données fictives… », embed « TEST NXT5 · Exemple fictif » et le haut du visuel fictif (coupé par le bas de la fenêtre). Non monté dans le déroulé actuel.',
    ignore: ['.discord-preview-image'], boxes: { previewSummary: ACT.previewSummary, preview: '.discord-activation .discord-preview', previewTitle: '.discord-activation .discord-preview > h4',
      content: { sel: '.discord-activation .discord-preview > .discord-message-content' }, embedTitle: '.discord-activation .discord-embed h5',
      embedDescription: '.discord-activation .discord-embed > .discord-message-content', image: '.discord-activation .discord-preview-image' } });
  // Close the example again from a position where its summary is in the clear (not under the top bar).
  await frameOn('.discord-activation .discord-example summary', 200, { ignore: ['.discord-preview-image'], range: 260 });
  await page.locator('.discord-activation .discord-example summary').click();
  await settle(400);
  if (await page.locator('.discord-activation .discord-example').evaluate((d) => d.open)) throw new Error('Exemple fictif resté ouvert');
  await setClock(W.CLOCK.test);
  await page.getByRole('button', { name: 'Envoyer le message de test' }).click();
  await page.waitForSelector('.discord-test-receipt');
  await waitQuiet();
  await frameOn('.discord-activation', 16, { range: 260, keep: ['.discord-test-receipt', '.discord-activation-task + .discord-activation-task'] });
  await park();
  await shot('site-20-test-recu', { journey: 'd19', storyboard: ['6', '7'], state: `Après « Envoyer le message de test » : « Test reçu sur Discord », « Le bot a confirmé la publication du message de test. », « Voir le message de test » ; « Envoyer un nouveau test » ; « 2. Autoriser les publications » avec « Activer la diffusion ».`,
    boxes: { ...ACT, ...RECEIPT, ...ACTIVATE, activate: { sel: '.discord-activation button', text: 'Activer la diffusion' } } });

  // ===== 7 · Activation =================================================================================================
  await setClock(W.CLOCK.activation);
  await page.getByRole('button', { name: 'Activer la diffusion' }).click();
  await settle(500);
  // The whole recap and « Envoyer un nouveau test » above it, the site footer below kept out of frame. Higher up, the top edge
  // would slice the step tabs (the old frame left « démarrer » alone under the top bar); lower down, the dense site footer
  // can only be sliced. Only clean compromise: the last two lines of the test receipt (complete) under the top bar.
  const RECAP_EDGES = { tolerate: ['.discord-test-receipt'] };
  await frameOn('.discord-test-receipt ~ .discord-actions', 20, { ...RECAP_EDGES, keep: ['.discord-test-receipt ~ .discord-actions', '.discord-activation-task + .discord-activation-task'],
    avoid: ['.nxt5-footer'] });
  await park();
  await shot('site-21-confirmer-activation', { journey: 'd20', storyboard: ['7'], state: `Récapitulatif « Activer pour ${NAMES.team} » : « Serveur : ${NAMES.server}. », « ${PUBLISH} · nouvelles parties automatiques · toutes les catégories · aucune mention », « Toute personne ayant accès à ces salons… Les anciennes parties ne sont pas republiées automatiquement. », « Confirmer l’activation » et « Annuler l’activation ». En haut, les deux dernières lignes du reçu du test (« Le bot a confirmé… », « Voir le message de test »), entières ; le reçu complet est dans site-20.`, ...RECAP_EDGES,
    boxes: { newTest: RECEIPT.newTest, testWarning: ACT.testWarning, ...ACTIVATE, confirm: '.discord-activation .discord-confirm', confirmTitle: '.discord-activation .discord-confirm h4', confirmServer: { sel: '.discord-activation .discord-confirm > p', nth: 0 },
      confirmRoute: '.discord-activation .discord-confirm li', confirmVisibility: { sel: '.discord-activation .discord-confirm > p', text: 'Toute personne' },
      confirmButton: { sel: '.discord-activation .discord-confirm button', text: 'Confirmer l’activation' }, cancelButton: { sel: '.discord-activation .discord-confirm button', text: 'Annuler l’activation' } } });
  await page.getByRole('button', { name: 'Confirmer l’activation' }).click();
  await page.waitForSelector('.discord-overview');
  await waitQuiet();
  // The temporary notice « La diffusion de l’équipe a repris. » is wrong on a first activation: wait until it is gone.
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('.discord-feedback')).some((e) => e.getClientRects().length && e.textContent.includes('a repris')), null, { timeout: 15000 });
  await frameOn('.discord-dashboard', 16);
  await park();
  await shot('site-22-diffusion-active', { journey: 'd21', storyboard: ['7'], state: `Vue d’ensemble : « Tout est en place », « Ton équipe peut utiliser le bot » ; « Utiliser les commandes » avec « Salon de ton équipe » #${NAMES.commandChannel} et /nxt voir ; « Recevoir les parties » avec « Diffusion active » et « ${PUBLISH} Automatique ».`,
    boxes: { ...TEAM, nav: '.discord-team-nav', nextAction: '.discord-next-action', nextKicker: '.discord-next-action .discord-step-kicker', nextTitle: '.discord-next-action h4',
      usage: '.discord-usage-grid', usageCommands: { sel: '.discord-usage', nth: 0 }, commandChannel: { sel: '.discord-usage dd', nth: 0 },
      usagePublications: { sel: '.discord-usage', nth: 1 }, activeBadge: { sel: '.discord-usage .nxt5-badge', text: 'Diffusion active' }, destination: '.discord-destination-list li' } });

  // ===== 8 · Publish a game =============================================================================================
  await setClock(W.CLOCK.publish);
  // Parties, then a click on the game (as in the journey): the page focuses its title after a mouse action, so no ring.
  await open('/games', `[data-match-id="${W.MATCH_ID}"]`);
  await page.locator(`[data-match-id="${W.MATCH_ID}"]`).click();
  await page.waitForSelector('.discord-share-action button', { timeout: 20000 });
  await waitQuiet();
  await frame(0);
  await park();
  await shot('site-23-partie-exporter-discord', { journey: 'd22', storyboard: ['8'], state: `Partie « ${NAMES.game} » (Victoire, 25:00, équipe adverse ${NAMES.opponent}) : barre d’actions avec « Exporter PNG » et « Exporter sur Discord ».`,
    boxes: { ...SHELL, sidebarParties: { sel: 'aside.nxt5-sidebar a', exactText: 'Parties' }, toolbar: '.games-detail-toolbar', exportPng: { sel: '.games-detail-toolbar button', text: 'Exporter PNG' },
      share: '.discord-share-action button', matchTitle: '.games-match-title h3', matchMeta: '.games-match-meta' } });
  // The dialog locks the page scroll by offsetting the page: open it from the top, or the top bar shows shifted behind it.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('.discord-share-action button').click();
  await page.waitForSelector('dialog[open] .discord-share');
  await waitQuiet();
  await frame(0);
  await park();
  await shot('site-24-dialogue-exporter', { journey: 'd23', storyboard: ['8'], state: `Fenêtre « Exporter sur Discord » (« ${NAMES.game} ») : « Destination Discord » = ${PUBLISH}, déjà choisi (seul salon), « Préparer l’aperçu ».`,
    boxes: { ...DIALOG, refreshChannels: { sel: 'dialog[open] button', text: 'Actualiser les salons' } } });
  await page.getByRole('button', { name: 'Préparer l’aperçu' }).click();
  await page.waitForSelector('dialog[open] .discord-preview');
  await waitQuiet();
  await frameOn('dialog[open] .discord-preview', 12, { ignore: ['.discord-preview-image'], keep: ['dialog[open] .discord-embed > .discord-message-content'] });
  await park();
  await shot('site-25-apercu-partie', { journey: 'd24', storyboard: ['8'], state: `« Aperçu de la publication » : « ${NAMES.publicationTitle} », « Victoire · 22–11 kills · 25:00 », « Scrim », haut du visuel (rapport de partie complet, sans avertissement de combats). Fenêtre défilée jusqu’à l’aperçu.`,
    ignore: ['.discord-preview-image'], boxes: { ...DIALOG, ...PREVIEW } });
  await frameOn('dialog[open] .discord-preview + .discord-actions', 24, { align: 'bottom', ignore: ['.discord-preview-image'], keep: ['dialog[open] .discord-preview + .discord-actions', 'dialog[open] .discord-embed-footer'] });
  await park();
  await shot('site-26-apercu-bouton-publier', { journey: 'd25', storyboard: ['8'], state: `Même aperçu défilé jusqu’au bas : fin du visuel, « NXT5 · aperçu », « Voir la game sur NXT5 », « Télécharger le visuel », « Version des données : ${W.PUBLICATION_REVISION} », « Publier dans ${PUBLISH} » et « Actualiser l’aperçu ».`,
    ignore: ['.discord-preview-image'], boxes: { ...DIALOG, ...PREVIEW } });
  await page.locator('dialog[open] button', { hasText: `Publier dans ${PUBLISH}` }).click();
  await page.waitForSelector('dialog[open] [aria-live] .discord-feedback', { timeout: 15000 });
  await waitQuiet();
  await frameOn('dialog[open] [aria-live]', 24, { align: 'bottom', ignore: ['.discord-preview-image'], keep: ['dialog[open] .discord-preview + .discord-actions', 'dialog[open] [aria-live]'] });
  await park();
  await shot('site-27-publie-sur-discord', { journey: 'd26', storyboard: ['8'], state: `Après « Publier dans ${PUBLISH} » : « Publié sur Discord. » et « Voir le message sur Discord » sous les boutons de l’aperçu.`,
    ignore: ['.discord-preview-image'], boxes: { ...DIALOG, ...PREVIEW, published: 'dialog[open] [aria-live]', publishedText: 'dialog[open] [aria-live] .discord-feedback',
      messageLink: 'dialog[open] [aria-live] a.discord-link' } });
  await page.keyboard.press('Escape');
  await settle(500);

  // ===== Activity (history of the publication) =========================================================================
  await setClock(W.CLOCK.activity);
  await open('/bot-discord', '.discord-team-nav');
  await page.locator('.discord-team-nav button', { hasText: 'Activité' }).click();
  await waitQuiet();
  await frameOn('.discord-dashboard', 16);
  await park();
  const history = await page.locator('.discord-history').innerText();
  if (/essai/i.test(history)) throw new Error('site-28: historique avec un nouvel essai');
  await shot('site-28-activite', { journey: 'd27', storyboard: ['8'], state: `Bot Discord > « Activité » : « Dernière publication confirmée » ${MATCH.opponent} · ${PUBLISH}, « Ouvrir la dernière publication », historique « Publié » daté de la publication. Non monté dans le déroulé actuel.`,
    boxes: { ...TEAM, nav: '.discord-team-nav', summary: '.discord-publication-summary', summaryTitle: '.discord-publication-summary h4', history: '.discord-history',
      historyItem: '.discord-history li', historyStatus: '.discord-history li .nxt5-badge', historyDate: '.discord-history li .discord-help' },
    extra: async () => ({ historyText: history.replace(/\s+/g, ' ').trim() }) });

  fs.writeFileSync(path.join(LOG_DIR, 'site-calls.json'), JSON.stringify(S.calls, null, 2));
  await browser.close();
  console.log(report.join('\n'));
  console.log('popups:', JSON.stringify(S.popups));
  console.log('errors:', JSON.stringify(errors));
  if (!WRITE_JSON) return;
  // Merge-write: this script owns the site-* entries (the real Discord captures may get their own prefix).
  fs.mkdirSync(path.dirname(CAPTURES_JSON), { recursive: true });
  const current = fs.existsSync(CAPTURES_JSON) ? JSON.parse(fs.readFileSync(CAPTURES_JSON, 'utf8')) : {};
  const captures = Object.fromEntries(Object.entries(current.captures || {}).filter(([id]) => !id.startsWith('site-')));
  Object.assign(captures, entries);
  const { source, ...names } = NAMES;
  const meta = {
    ...(current.meta || {}),
    units: 'Boîtes en px CSS, origine en haut à gauche du PNG. PNG = viewport complet au facteur 2 (multiplier par scale pour les pixels du PNG).',
    scale: SCALE,
    regenerate: 'SITE_ROOT=<copie du site avec node_modules> tools/promo-video/v3/capture/discord/run-site.sh (voir l’en-tête de capture-site.cjs).',
    names, namesSource: source,
    clock: Object.fromEntries(Object.entries(W.CLOCK).map(([k, t]) => [k, new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })])),
    notes: { ...((current.meta || {}).notes || {}), site: [
      METHOD,
      'Viewport 1440×900 CSS au facteur 2 (2880×1800), thème sombre, fr-FR, Europe/Paris, cookies refusés (« Tout refuser »).',
      'Noms (serveur, salons, comptes, code de liaison, « Valable jusqu’au ») tirés de capture/discord/names.json, à aligner sur les captures Discord réelles (sync-names.cjs).',
      'Horloge figée à chaque étape (meta.clock) : le code de liaison est créé 10 minutes avant « Valable jusqu’au », après l’import de la partie (18/10/2026 21:48).',
      'Seule retouche : une feuille de style de capture masque le badge d’abonnement du menu latéral (.nxt5-sidebar-subscription). Coach Démo est capitaine (droits identiques au propriétaire pour le bot) : le menu affiche « Capitaine ».',
      'Aperçus Discord rendus par le code serveur (render-payloads.cjs) : partie enrichie fixtures/game-discord.cjs, sans avertissement de combats. Le visuel, plus haut que la fenêtre, peut être coupé par ses bords.',
      'Listes déroulantes natives non capturées : couper entre l’avant et l’après du choix (site-11 → site-13, site-14 → site-15).',
      'Aucun texte, contrôle ou paragraphe coupé par la barre du haut, l’en-tête de la fenêtre ou le bord de l’écran (vérifié avant chaque capture) ; edgeNotes signale un simple liseré de cadre près d’un bord. Boîtes « visible » et hiddenBoxes comme pour le tutoriel Importer.',
      'site-21 : aucun cadrage ne garde à la fois le reçu du test entier, les onglets d’étapes intacts et le pied de page du site hors champ ; seules les deux dernières lignes du reçu (entières) restent sous la barre du haut.',
      'Fenêtre « Exporter sur Discord » ouverte depuis le haut de la page : le verrouillage du défilement décalerait sinon la barre du haut derrière la fenêtre (site-24 à site-27).',
    ] },
    updatedAt: new Date().toISOString(),
  };
  const sorted = Object.fromEntries(Object.keys(captures).sort().map((k) => [k, captures[k]]));
  fs.writeFileSync(CAPTURES_JSON, `${JSON.stringify({ meta, captures: sorted }, null, 2)}\n`);
})().catch((e) => {
  console.error(report.slice(-6).join('\n'));
  console.error('errors:', JSON.stringify(errors));
  console.error(e);
  fs.writeFileSync(path.join(LOG_DIR, 'site-calls.json'), JSON.stringify(S.calls, null, 2));
  process.exit(1);
});
