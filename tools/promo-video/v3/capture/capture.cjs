// Captures UI textures from the public NXT5 demo (fictional data) for the v3 promo.
// Usage: node capture/capture.cjs [only=name1,name2]
// Output: public/textures/*.png (2x) and src/layout.json (boxes in CSS px, relative to each PNG).
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const TEX = path.join(ROOT, 'public', 'textures');
const LAYOUT = path.join(ROOT, 'src', 'layout.json');
const SITE = 'https://nxt5.org';
const VIEWPORT = { width: 1920, height: 1080 };
const DSF = 2;

fs.mkdirSync(TEX, { recursive: true });
const layout = fs.existsSync(LAYOUT) ? JSON.parse(fs.readFileSync(LAYOUT, 'utf8')) : {};
const onlyArg = process.argv.find((a) => a.startsWith('only='));
const ONLY = onlyArg ? onlyArg.slice(5).split(',') : null;
const want = (group) => !ONLY || ONLY.includes(group);

async function launch() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--font-render-hinting=none'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DSF,
    colorScheme: 'dark',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const page = await context.newPage();
  return { browser, page };
}

// ---------- page preparation ----------
async function refuseCookies(page) {
  const refuse = page.getByRole('button', { name: /Tout refuser/i });
  for (let i = 0; i < 3; i++) {
    if ((await refuse.count()) && (await refuse.first().isVisible())) {
      await refuse.first().click();
      await page.waitForTimeout(900);
    }
  }
  if ((await refuse.count()) && (await refuse.first().isVisible())) throw new Error('cookie banner still visible');
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 360) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    for (let y = document.documentElement.scrollHeight; y > 0; y -= 720) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}

async function openPage(page, url) {
  await page.goto(SITE + url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  await refuseCookies(page);
  await scrollThrough(page);
  await refuseCookies(page);
}

// Hide fixed/sticky chrome (header, "Mouvement réduit", toasts) but keep full-viewport ambient backgrounds.
async function hideChrome(page) {
  await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    for (const e of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(e).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      const r = e.getBoundingClientRect();
      const isBackdrop = r.width >= vw * 0.9 && r.height >= vh * 0.9 && !(e.innerText || '').trim();
      if (isBackdrop) continue;
      if (e.querySelector('[data-cap]')) continue;
      e.dataset.capHidden = e.style.getPropertyValue('visibility') || '-';
      e.style.setProperty('visibility', 'hidden', 'important');
    }
    for (const b of document.querySelectorAll('button')) {
      if (/Mouvement réduit/i.test(b.innerText || '') && !b.dataset.capHidden) {
        b.dataset.capHidden = '-';
        b.style.setProperty('visibility', 'hidden', 'important');
      }
    }
  });
}

async function assertNoBanner(page) {
  const visible = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Tout refuser|Tout accepter/.test(b.innerText || ''));
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(btn).visibility !== 'hidden';
  });
  if (visible) throw new Error('cookie banner visible at capture time');
}

// Mark the element returned by `finder` (run in the page) with data-cap="<id>".
async function mark(page, id, finder, arg) {
  await page.evaluate((id) => document.querySelectorAll(`[data-cap="${id}"]`).forEach((e) => e.removeAttribute('data-cap')), id);
  const handle = await page.evaluateHandle(finder, arg);
  const el = handle.asElement();
  if (!el) throw new Error('element not found for ' + id);
  await el.evaluate((e, id) => e.setAttribute('data-cap', id), id);
  await handle.dispose();
}

async function centerOn(page, sel) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const top = r.top + scrollY - Math.max(0, (innerHeight - r.height) / 2);
    window.scrollTo(0, Math.max(0, Math.round(top)));
  }, sel);
  await page.waitForTimeout(700);
}

async function settle(page, sel) {
  // all images inside the target decoded, no spinner / busy marker, fonts ready
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const imgs = [...el.querySelectorAll('img')];
    if (imgs.some((i) => !i.complete || i.naturalWidth === 0)) return false;
    if (el.querySelector('[aria-busy="true"], .animate-spin, [role="progressbar"]')) return false;
    if (/Chargement/i.test(el.innerText || '')) return false;
    return true;
  }, sel, { timeout: 30000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(800);
}

// Integer clip in viewport coordinates around the element.
async function clipOf(page, sel) {
  return page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    const x = Math.floor(r.left), y = Math.floor(r.top);
    return { x, y, width: Math.ceil(r.right) - x, height: Math.ceil(r.bottom) - y };
  }, sel);
}

// Boxes relative to the clip origin. spec: { key: selector (relative to root) | [selector] for all matches }
async function boxesFor(page, rootSel, clip, spec) {
  return page.evaluate(({ rootSel, clip, spec }) => {
    const root = document.querySelector(rootSel);
    const rel = (e) => {
      const r = e.getBoundingClientRect();
      const n = (v) => Math.round(v * 100) / 100;
      return { x: n(r.left - clip.x), y: n(r.top - clip.y), w: n(r.width), h: n(r.height) };
    };
    const out = {};
    for (const [k, s] of Object.entries(spec)) {
      if (Array.isArray(s)) out[k] = [...root.querySelectorAll(s[0])].map(rel);
      else {
        const e = root.querySelector(s);
        if (!e) throw new Error('box selector not found: ' + s);
        out[k] = rel(e);
      }
    }
    return out;
  }, { rootSel, clip, spec });
}

async function shoot(page, sel, file, { omitBackground = false, pad = null } = {}) {
  await settle(page, sel);
  await assertNoBanner(page);
  const clip = await clipOf(page, sel);
  if (pad) {
    clip.x -= pad.l; clip.y -= pad.t;
    clip.width += pad.l + pad.r; clip.height += pad.t + pad.b;
  }
  if (clip.y < 0 || clip.y + clip.height > VIEWPORT.height) throw new Error(`${file}: element not inside viewport ${JSON.stringify(clip)}`);
  await page.screenshot({ path: path.join(TEX, file), clip, omitBackground, animations: 'disabled', caret: 'hide' });
  return clip;
}

// Render only the subtree of `sel` on a transparent canvas (alpha cutout).
async function isolate(page, sel) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const save = (e, prop) => { e.dataset['capIso_' + prop] = e.style.getPropertyValue(prop) || '-'; };
    for (const e of [document.documentElement, document.body]) {
      save(e, 'background');
      e.style.setProperty('background', 'transparent', 'important');
    }
    save(document.body, 'visibility');
    document.body.style.setProperty('visibility', 'hidden', 'important');
    save(el, 'visibility');
    el.style.setProperty('visibility', 'visible', 'important');
  }, sel);
}
async function unisolate(page) {
  await page.evaluate(() => {
    for (const e of [document.documentElement, document.body, ...document.querySelectorAll('body *')]) {
      for (const prop of ['background', 'visibility']) {
        const k = 'capIso_' + prop;
        if (!(k in e.dataset)) continue;
        const v = e.dataset[k];
        if (v === '-') e.style.removeProperty(prop); else e.style.setProperty(prop, v);
        delete e.dataset[k];
      }
    }
  });
}

async function setVisibility(page, sel, hidden) {
  await page.evaluate(({ sel, hidden }) => {
    document.querySelectorAll(sel).forEach((e) => {
      if (hidden) e.style.setProperty('visibility', 'hidden', 'important');
      else e.style.removeProperty('visibility');
    });
  }, { sel, hidden });
}

async function neutralPointer(page) {
  await page.mouse.move(VIEWPORT.width - 4, VIEWPORT.height / 2);
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
}

function entry(name, clip, boxes, extra = {}) {
  layout[name] = { w: clip.width, h: clip.height, file: `textures/${name}.png`, ...extra, boxes };
  console.log(`${name}: ${clip.width}x${clip.height}`, Object.entries(boxes).map(([k, v]) => `${k}${Array.isArray(v) ? '[' + v.length + ']' : ''}`).join(' '));
}

// Cutout of a child element: own entry + its offset inside the parent capture.
// `pad` (CSS px) widens the clip, e.g. to keep decorations that overflow the element (alpha cutouts only).
// boxes.content = the element's own box inside the cutout PNG; offset = cutout origin inside the parent PNG.
async function cutout(page, name, sel, parentName, parentClip, { alpha, pad = null }) {
  if (alpha) await isolate(page, sel);
  const clip = await shoot(page, sel, `${name}.png`, { omitBackground: !!alpha, pad });
  if (alpha) await unisolate(page);
  const offset = parentClip ? { x: clip.x - parentClip.x, y: clip.y - parentClip.y } : undefined;
  const content = await page.evaluate(({ sel, clip }) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    const n = (v) => Math.round(v * 100) / 100;
    return { x: n(r.left - clip.x), y: n(r.top - clip.y), w: n(r.width), h: n(r.height) };
  }, { sel, clip });
  entry(name, clip, { content }, { parent: parentName, offset, alpha: !!alpha });
  return clip;
}

// ---------- text lines (document.createRange over text nodes) ----------
async function textLines(page, rootSel, clip) {
  return page.evaluate(({ rootSel, clip }) => {
    const root = document.querySelector(rootSel);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const glyphs = []; // per character rects in reading order
    let order = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !node.textContent.trim()) continue;
      const cs = getComputedStyle(parent);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const pr = parent.getBoundingClientRect();
      if (pr.width <= 2 || pr.height <= 2) continue; // sr-only
      const text = node.textContent;
      const range = document.createRange();
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 || /\s/.test(text[i]));
        const r = rects[0];
        if (!r || r.height === 0) continue;
        glyphs.push({ ch: text[i], l: r.left, t: r.top, r: r.right, b: r.bottom, el: parent, order: order++ });
      }
    }
    // group by line: same vertical band (centers within 40% of height)
    const lines = [];
    for (const g of glyphs) {
      const cy = (g.t + g.b) / 2;
      let line = lines.find((L) => Math.abs(cy - L.cy) < Math.max(4, (L.b - L.t) * 0.4));
      if (!line) { line = { cy, t: g.t, b: g.b, l: g.l, r: g.r, glyphs: [], els: new Set() }; lines.push(line); }
      line.glyphs.push(g);
      line.els.add(g.el);
      line.t = Math.min(line.t, g.t); line.b = Math.max(line.b, g.b);
      line.l = Math.min(line.l, g.l); line.r = Math.max(line.r, g.r);
    }
    const n = (v) => Math.round(v * 100) / 100;
    const out = [];
    for (const L of lines) {
      L.glyphs.sort((a, b) => a.l - b.l);
      let text = '';
      let prev = null;
      for (const g of L.glyphs) {
        if (prev && g.el !== prev.el && g.l - prev.r > 1 && !/\s$/.test(text) && !/^\s/.test(g.ch)) text += ' ';
        text += g.ch;
        prev = g;
      }
      text = text.replace(/\s+/g, ' ').trim();
      // ::before generated content (e.g. "1. " counters) on the first line of an element
      let left = L.l;
      for (const el of L.els) {
        const before = getComputedStyle(el, '::before').content;
        if (!before || before === 'none' || before === 'normal') continue;
        const firstGlyph = glyphs.find((g) => g.el === el);
        if (!firstGlyph || !L.glyphs.includes(firstGlyph)) continue;
        const er = el.getBoundingClientRect();
        const ecs = getComputedStyle(el);
        const contentLeft = er.left + parseFloat(ecs.paddingLeft) + parseFloat(ecs.borderLeftWidth);
        let prefix = '';
        const m = before.match(/counter\(([^)]+)\)\s*"([^"]*)"/);
        if (m) {
          const li = el.closest('li');
          const idx = li ? [...li.parentElement.children].indexOf(li) + 1 : 1;
          prefix = idx + m[2];
        } else {
          const s = before.match(/^"(.*)"$/);
          if (s) prefix = s[1];
        }
        if (prefix.trim() && contentLeft < left) { left = contentLeft; text = (prefix.trim() + ' ' + text).trim(); }
      }
      out.push({ x: n(left - clip.x), y: n(L.t - clip.y), w: n(L.r - left), h: n(L.b - L.t), text });
    }
    out.sort((a, b) => (Math.abs(a.y - b.y) < 2 ? a.x - b.x : a.y - b.y));
    return out;
  }, { rootSel, clip });
}

// ---------- captures ----------
async function captureDemo(page) {
  await openPage(page, '/demo');
  if (want('demo')) {
    await page.getByRole('button', { name: '1. Parties' }).click();
    await page.waitForTimeout(2000);
    await mark(page, 'matches', () => {
      const rows = [...document.querySelectorAll('button.ig-game')];
      return rows.length === 3 ? rows[0].closest('.nxt5-panel') : null;
    });
    await hideChrome(page);
    await neutralPointer(page);
    const sel = '[data-cap="matches"]';
    await centerOn(page, sel);
    const texts = await page.evaluate(() => [...document.querySelectorAll('button.ig-game')].map((b) => b.innerText.replace(/\s+/g, ' ')));
    if (!/Victoire.*Scrim 3 · Aurore/.test(texts[0]) || !/Victoire.*Scrim 2 · Orbite/.test(texts[1]) || !/Défaite.*Scrim 1 · Aurore/.test(texts[2])) throw new Error('unexpected rows ' + texts.join(' / '));
    const clip = await shoot(page, sel, 'demo-matches.png');
    const boxes = await boxesFor(page, sel, clip, { rows: ['button.ig-game'], list: 'ul.ig-list', heading: 'header.ig-heading' });
    entry('demo-matches', clip, boxes);
    for (let i = 1; i <= 3; i++) {
      await page.evaluate((i) => { const b = document.querySelectorAll('button.ig-game')[i - 1]; b.setAttribute('data-cap', 'row' + i); }, i);
      await cutout(page, `demo-row-${i}`, `[data-cap="row${i}"]`, 'demo-matches', clip, { alpha: false });
    }
  }
  if (want('debrief')) {
    await page.getByRole('button', { name: '3. Débrief' }).click();
    await page.waitForTimeout(2500);
    await mark(page, 'debrief', () => {
      const h = [...document.querySelectorAll('h2')].find((h) => h.innerText.includes('Préparer la prochaine séance'));
      return h ? h.closest('.nxt5-panel') : null;
    });
    await hideChrome(page);
    await neutralPointer(page);
    const sel = '[data-cap="debrief"]';
    await centerOn(page, sel);
    const clip = await shoot(page, sel, 'debrief.png');
    const boxes = await boxesFor(page, sel, clip, { steps: ['ol > li'], title: 'h2' });
    const lines = await textLines(page, sel, clip);
    entry('debrief', clip, { lines, ...boxes });
  }
}

async function captureHome(page) {
  await openPage(page, '/');
  const sceneSel = '[data-cap="scene"]';
  const markScene = (inner) => mark(page, 'scene', (inner) => {
    const e = document.querySelector(inner);
    return e ? e.closest('.ps-scene') : null;
  }, inner);

  if (want('review')) {
    await page.getByRole('button', { name: /^Analyse/ }).click();
    await page.waitForTimeout(1500);
    await markScene('.ps-analysis');
    await hideChrome(page);
    await centerOn(page, sceneSel);
    const chips = [['12:00', 'review-1200'], ['21:00', 'review-2100'], ['33:45', 'review-3345']];
    for (const [label, name] of chips) {
      await page.locator('.ps-moments button', { hasText: label }).click();
      await neutralPointer(page);
      await page.waitForTimeout(1800);
      // wait until the gold value is stable (count-up / transition finished)
      let prev = '';
      for (let i = 0; i < 20; i++) {
        const v = await page.evaluate(() => document.querySelector('.ps-match-facts').innerText + '|' + document.querySelector('.ps-chart-plot svg g')?.getAttribute('transform') + '|' + document.querySelector('.ps-duration')?.innerText);
        if (v === prev) break;
        prev = v;
        await page.waitForTimeout(400);
      }
      const active = await page.evaluate(() => [...document.querySelectorAll('.ps-moments button')].map((b) => b.getAttribute('aria-pressed') || b.getAttribute('aria-current') || b.className).join(' | '));
      await centerOn(page, sceneSel);
      const clip = await shoot(page, sceneSel, `${name}.png`);
      const boxes = await boxesFor(page, sceneSel, clip, {
        chips: ['.ps-moments > button'],
        chart: '.ps-chart',
        gold: '.ps-match-facts > div',
        chartPlot: '.ps-chart-plot',
        goldValue: '.ps-match-facts > div > strong',
        objectives: ['.ps-chart-objective'],
        time: '.ps-duration',
        note: '.ps-note',
      });
      const gold = await page.evaluate(() => document.querySelector('.ps-match-facts > div > strong').innerText.replace(/\s+/g, ' ').trim());
      entry(name, clip, boxes, { state: { chip: label, gold } });
      console.log('  active:', active);
    }
  }

  if (want('draft')) {
    await page.getByRole('button', { name: /^Draft/ }).click();
    await page.waitForTimeout(2200);
    await markScene('.ps-draft');
    await hideChrome(page);
    await neutralPointer(page);
    await centerOn(page, sceneSel);
    const names = await page.evaluate(() => [...document.querySelectorAll('.ps-draft-roster > button strong')].map((s) => s.innerText.trim()));
    if (names.join(',') !== 'Gnar,Vi,Ahri,Jinx,Braum') throw new Error('unexpected draft ' + names);
    const clip = await shoot(page, sceneSel, 'draft.png');
    const boxes = await boxesFor(page, sceneSel, clip, { slots: ['.ps-draft-roster > button'], roster: '.ps-draft-roster', pool: '.ps-pool', note: '.ps-note', title: '.ps-scene-top h4' });
    entry('draft', clip, boxes, { champions: names });
    for (let i = 1; i <= 5; i++) {
      await page.evaluate((i) => document.querySelectorAll('.ps-draft-roster > button')[i - 1].setAttribute('data-cap', 'champ' + i), i);
      await cutout(page, `champ-${i}`, `[data-cap="champ${i}"]`, 'draft', clip, { alpha: true });
      layout[`champ-${i}`].champion = names[i - 1];
    }
    await setVisibility(page, '.ps-draft-roster > button', true);
    const clipEmpty = await shoot(page, sceneSel, 'draft-empty.png');
    entry('draft-empty', clipEmpty, { slots: boxes.slots }, { parent: 'draft', offset: { x: 0, y: 0 } });
    await setVisibility(page, '.ps-draft-roster > button', false);
  }

  if (want('planning')) {
    await page.getByRole('button', { name: /^Planning/ }).click();
    await page.waitForTimeout(2200);
    await markScene('.ps-planning');
    await hideChrome(page);
    await neutralPointer(page);
    await centerOn(page, sceneSel);
    const clip = await shoot(page, sceneSel, 'planning.png');
    const boxes = await boxesFor(page, sceneSel, clip, {
      agenda: ['ol.ps-agenda > li'],
      roles: '.ps-attendees',
      days: ['.ps-days > button'],
      rolesRow: '.ps-attendees > div:last-child',
      roleCards: ['.ps-ready-player'],
      readyCount: '.ps-ready-heading > span:last-child',
      event: '.ps-session',
      focus: '.ps-scrim-focus',
      agendaList: 'ol.ps-agenda',
    });
    entry('planning', clip, boxes);
    for (let i = 1; i <= 3; i++) {
      await page.evaluate((i) => document.querySelectorAll('ol.ps-agenda > li')[i - 1].setAttribute('data-cap', 'agenda' + i), i);
      // the violet diamond (li::before, top:-3px) overflows the row: pad to keep it whole
      await cutout(page, `agenda-${i}`, `[data-cap="agenda${i}"]`, 'planning', clip, { alpha: true, pad: { t: 6, l: 4, r: 0, b: 0 } });
    }
    await setVisibility(page, 'ol.ps-agenda > li', true);
    const clipEmpty = await shoot(page, sceneSel, 'planning-empty.png');
    entry('planning-empty', clipEmpty, { agenda: boxes.agenda }, { parent: 'planning', offset: { x: 0, y: 0 } });
    await setVisibility(page, 'ol.ps-agenda > li', false);
  }
}

(async () => {
  const { browser, page } = await launch();
  try {
    if (want('demo') || want('debrief')) await captureDemo(page);
    if (want('review') || want('draft') || want('planning')) await captureHome(page);
  } finally {
    await browser.close();
  }
  const sorted = Object.fromEntries(Object.keys(layout).sort().map((k) => [k, layout[k]]));
  fs.writeFileSync(LAYOUT, JSON.stringify(sorted, null, 2) + '\n');
  console.log('wrote', LAYOUT);
})().catch((e) => { console.error(e); process.exit(1); });
