// Shared helpers for the « Importer une partie » tutorial captures.
// Boxes are CSS px relative to the top-left of the PNG (the PNG is the full viewport at deviceScaleFactor 2).
const fs = require('node:fs');
const path = require('node:path');

const V3 = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(V3, '..', '..', '..');
const PUBLIC_DIR = path.join(V3, 'public', 'tuto');
const CAPTURES_JSON = path.join(V3, 'src', 'tuto', 'captures.json');
const SCALE = 2;

function requirePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    '/opt/node22/lib/node_modules/playwright',
    '/opt/node-tools/node_modules/playwright',
    'playwright',
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch { /* try next */ }
  }
  throw new Error('Playwright introuvable : définis PLAYWRIGHT_MODULE.');
}

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c));
}

// Merge-write: each script owns the entries whose id starts with its prefix.
function writeCaptures(prefix, entries, notes) {
  fs.mkdirSync(path.dirname(CAPTURES_JSON), { recursive: true });
  const current = fs.existsSync(CAPTURES_JSON) ? JSON.parse(fs.readFileSync(CAPTURES_JSON, 'utf8')) : {};
  const captures = Object.fromEntries(Object.entries(current.captures || {}).filter(([id]) => !id.startsWith(prefix)));
  Object.assign(captures, entries);
  const sorted = Object.fromEntries(Object.keys(captures).sort().map((k) => [k, captures[k]]));
  const meta = {
    ...(current.meta || {}),
    units: 'Boîtes en px CSS, origine en haut à gauche du PNG. PNG = viewport complet au facteur 2 (multiplier par scale pour les pixels du PNG).',
    scale: SCALE,
    regenerate: 'tools/promo-video/v3/capture/tuto/run-all.sh (voir l’en-tête de chaque script).',
    notes: { ...((current.meta || {}).notes || {}), [prefix.replace(/-$/, '')]: notes },
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CAPTURES_JSON, `${JSON.stringify({ meta, captures: sorted }, null, 2)}\n`);
}

// Collects boxes in the page. spec: { key: selector | { sel, all?: true, nth?: n, text?: string, exactText?: string, deepest?: true, closest?: selector } }
// Returns { key: {x,y,w,h, visible?: {x,y,w,h}} } ; elements missing or with no size are reported in `missing`.
// `occluders`: selectors of sticky/fixed bars (dialog header and footer, site top bar) whose area is removed from `visible`.
// Elements entirely hidden (scrolled out or under a bar) are listed in `hidden` instead of `boxes`.
async function collectBoxes(page, spec, occluders = []) {
  return page.evaluate(({ spec, occluders }) => {
    const r2 = (v) => Math.round(v * 100) / 100;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visibleRect = (el) => {
      let r = el.getBoundingClientRect();
      let x1 = r.left; let y1 = r.top; let x2 = r.right; let y2 = r.bottom;
      // A modal <dialog> sits in the top layer and a position:fixed overlay (toast) escapes its ancestors' overflow:
      // the clipping walk stops there, and fixed overlays are drawn above the sticky bars (no occlusion).
      let overlay = false;
      for (let q = el; q && q.tagName !== 'DIALOG'; q = q.parentElement) if (getComputedStyle(q).position === 'fixed') { overlay = true; break; }
      const stop = (q) => (q.tagName === 'DIALOG' && q.open) || getComputedStyle(q).position === 'fixed';
      for (let p = stop(el) ? null : el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY) && !overlay) {
          const pr = p.getBoundingClientRect();
          x1 = Math.max(x1, pr.left); y1 = Math.max(y1, pr.top); x2 = Math.min(x2, pr.right); y2 = Math.min(y2, pr.bottom);
        }
        if (stop(p)) break;
      }
      x1 = Math.max(x1, 0); y1 = Math.max(y1, 0); x2 = Math.min(x2, vw); y2 = Math.min(y2, vh);
      for (const sel of overlay ? [] : occluders) {
        for (const o of document.querySelectorAll(sel)) {
          if (o === el || o.contains(el) || el.contains(o)) continue;
          const r = o.getBoundingClientRect();
          if (!r.height || r.right <= x1 || r.left >= x2) continue;
          if (r.top <= y1 && r.bottom > y1) y1 = Math.min(y2, r.bottom);
          if (r.top < y2 && r.bottom >= y2) y2 = Math.max(y1, r.top);
        }
      }
      return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
    };
    const find = (s) => {
      const o = typeof s === 'string' ? { sel: s } : s;
      let els = Array.from(document.querySelectorAll(o.sel));
      if (o.text) els = els.filter((e) => e.textContent.replace(/\s+/g, ' ').trim().includes(o.text));
      if (o.exactText) els = els.filter((e) => e.textContent.replace(/\s+/g, ' ').trim() === o.exactText);
      els = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (o.deepest) els = els.filter((e) => !els.some((other) => other !== e && e.contains(other)));
      if (o.closest) els = els.map((e) => e.closest(o.closest)).filter(Boolean);
      if (o.all) return els;
      return els[o.nth || 0] ? [els[o.nth || 0]] : [];
    };
    const out = {};
    const missing = [];
    const hidden = [];
    for (const [key, s] of Object.entries(spec)) {
      const els = find(s);
      if (!els.length) { missing.push(key); continue; }
      const boxes = els.map((el) => {
        const r = el.getBoundingClientRect();
        const box = { x: r2(r.left), y: r2(r.top), w: r2(r.width), h: r2(r.height) };
        const v = visibleRect(el);
        if (v.w < 1 || v.h < 1) return null;
        if (Math.abs(v.x - r.left) > 0.5 || Math.abs(v.y - r.top) > 0.5 || Math.abs(v.w - r.width) > 0.5 || Math.abs(v.h - r.height) > 0.5) {
          box.visible = { x: r2(v.x), y: r2(v.y), w: r2(v.w), h: r2(v.h) };
        }
        return box;
      }).filter(Boolean);
      if (!boxes.length) { hidden.push(key); continue; }
      out[key] = (typeof s === 'object' && s.all) ? boxes : boxes[0];
    }
    return { boxes: out, missing, hidden };
  }, { spec, occluders });
}

// Moves the pointer to a point whose element is not interactive, so no hover state is left on screen.
async function parkMouse(page, candidates) {
  const point = await page.evaluate((candidates) => {
    // Elements that carry hover styles; containers (dialog, tabpanel with tabindex) are fine to hover.
    const interactive = 'a,button,input,select,textarea,summary,label,[role=button],[role=tab],[role=option],[role=link],[data-match-id]';
    for (const [x, y] of candidates) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest(interactive)) return [x, y];
    }
    return null;
  }, candidates);
  if (!point) throw new Error(`Aucun point neutre pour la souris parmi ${JSON.stringify(candidates)}`);
  await page.mouse.move(point[0], point[1]);
  return point;
}

// Fails when something is focused with a visible focus ring that we did not intend.
async function focusReport(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { active: 'body', focusVisible: false };
    const desc = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
    return { active: desc, focusVisible: el.matches(':focus-visible') };
  });
}

function entry({ id, file, css, app, method, state, storyboard, boxes, missing, hidden, extra }) {
  return {
    file: `tuto/${file}`,
    app,
    css,
    scale: SCALE,
    px: { w: css.w * SCALE, h: css.h * SCALE },
    storyboard,
    state,
    method,
    boxes,
    ...(missing && missing.length ? { missingBoxes: missing } : {}),
    ...(hidden && hidden.length ? { hiddenBoxes: hidden } : {}),
    ...(extra || {}),
  };
}

module.exports = { V3, REPO, PUBLIC_DIR, CAPTURES_JSON, SCALE, requirePlaywright, chromiumPath, writeCaptures, collectBoxes, parkMouse, focusReport, entry };
