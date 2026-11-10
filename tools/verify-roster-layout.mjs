// Real browser geometry checks, using production components and synthetic data.
// Install the browser once: npx playwright install chromium
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = path.resolve('artifacts/roster-layout');
await fs.mkdir(output, { recursive: true });
const fixtureModule = `
import React from 'react';
import { createRoot } from 'react-dom/client';
// Exercise both CSS arrival orders, including the previously broken reset-last.
if (!location.search.includes('reset-last')) await import('/src/index.css');
const { Surface } = await import('/src/components/ui/Core.jsx');
const { PremiumRosterTable } = await import('/src/pages/workspace/Teams.jsx');
if (location.search.includes('reset-last')) await import('/src/index.css');
const roster = ['TOP','JGL','MID','ADC','SUP','COACH'].map((role, i) => ({
  id: 'layout-' + i, role, name: 'Joueur fictif ' + (i + 1), riot_id: 'Test#EUW', roster_status: 'MAIN'
}));
const champions = [
  ['Ornn', 'Vi', 'Ahri', 'Jinx', 'Leona'],
  ['Gnar', 'Sejuani', 'Syndra', 'Xayah', 'Rakan'],
  ['Kennen', 'Wukong', 'Taliyah', 'Ezreal', 'Nautilus'],
];
const matches = champions.map((game, gameIndex) => ({ id: 'layout-game-' + gameIndex, team_id: 'layout',
  participants: roster.slice(0, 5).map((player, index) => ({
    player_id: player.id, role: player.role, team_key: 'ALLY', champion: game[index]
  }))
}));
createRoot(document.getElementById('root')).render(React.createElement('main', {style: {padding: 24}},
  React.createElement(Surface, {className: 'team-roster-surface'},
    React.createElement(PremiumRosterTable, {roster, matches, canManage: true, historyComplete: !location.search.includes('partial')})),
  React.createElement(Surface, {className: 'p-0', key: 'flush'}, 'Sans marge'),
  React.createElement(Surface, {className: 'p-4', key: 'custom'}, 'Marge explicite'),
  React.createElement(Surface, {className: 'p-3 sm:p-4', key: 'responsive'}, 'Marge responsive')
));
`;
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{
    name: 'roster-layout-fixture',
    resolveId(id) { if (id === '/__roster-layout.js') return '\0roster-layout'; },
    load(id) { if (id === '\0roster-layout') return fixtureModule; },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__roster-layout.html')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html lang="fr"><head><!--seo:start--><!--seo:end--><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__roster-layout.js"></script></body></html>'));
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.LAYOUT_BROWSER_CHANNEL ? {channel: process.env.LAYOUT_BROWSER_CHANNEL} : {}) });
  const results = [];
  for (const order of ['normal', 'reset-last']) {
    for (const state of ['complete', 'partial']) {
      for (const width of [320, 390, 768, 1440, 1920]) {
        const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' });
        await page.route('**/*', (route) => route.request().url().includes('/.netlify/functions/asset-proxy')
          ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="#303b58"/></svg>' })
          : route.continue());
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.goto(server.resolvedUrls.local[0] + '__roster-layout.html?' + order + '&' + state, { waitUntil: 'domcontentloaded' });
        await page.locator('.team-roster-heading a').waitFor();
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.evaluate(() => {
          const panel = document.querySelector('.team-roster-surface');
          const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height}; };
          const heading = document.querySelector('.team-roster-heading');
          const action = heading.querySelector('a');
          return {
            panel: rect(panel), title: rect(heading.querySelector('h3')), action: rect(action),
            inset: parseFloat(getComputedStyle(panel).paddingLeft),
            cards: [...document.querySelectorAll('.team-roster-list > li')].map(rect),
            headings: [...document.querySelectorAll('.team-roster-heading')].map(rect),
            overrides: [...document.querySelectorAll('main > .nxt5-surface')].slice(1).map(el => parseFloat(getComputedStyle(el).paddingLeft)),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        const label = width + 'px / ' + order + ' / ' + state;
        assert.equal(geometry.inset, width <= 640 ? 16 : 20, label + ': default padding');
        assert.deepEqual(geometry.overrides, [0, 16, width < 640 ? 12 : 16], label + ': explicit and responsive padding overrides');
        assert.deepEqual(pageErrors, [], label + ': JavaScript errors');
        assert.equal(geometry.overflow, false, label + ': horizontal overflow');
        for (const r of [geometry.title, geometry.action, ...geometry.cards, ...geometry.headings]) {
          assert(r.left >= geometry.panel.left + geometry.inset, label + ': left inset');
          assert(r.right <= geometry.panel.right - geometry.inset + 1, label + ': right inset');
          assert(r.top >= geometry.panel.top + geometry.inset, label + ': top inset');
          assert(r.bottom <= geometry.panel.bottom - geometry.inset + 1, label + ': bottom inset');
        }
        const {title, action} = geometry;
        assert(title.right <= action.left || title.bottom <= action.top, label + ': title/action overlap');
        assert(action.height >= 44, label + ': touch target');
        await page.screenshot({ path: path.join(output, label.replaceAll(/[^a-z0-9-]/gi, '-') + '.png'), fullPage: true });
        await page.keyboard.press('Tab');
        assert(await page.locator('.team-roster-heading a').evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'), label + ': keyboard focus');
        results.push({ width, order, state, ...geometry });
        await page.close();
      }
    }
  }
  for (const order of ['normal', 'reset-last']) for (const width of [320, 390, 768, 1440, 1920]) {
    const complete = results.find((item) => item.order === order && item.width === width && item.state === 'complete');
    const partial = results.find((item) => item.order === order && item.width === width && item.state === 'partial');
    assert(Math.abs(complete.cards[0].height - partial.cards[0].height) <= 1, width + 'px / ' + order + ': stable player card height');
    assert(Math.abs(complete.headings[1].top - partial.headings[1].top) <= 1, width + 'px / ' + order + ': stable staff position');
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log('Roster layout: 20 browser checks passed (insets, overlap, overrides, overflow, focus, stable height).');
} finally {
  await browser?.close();
  await server.close();
}


