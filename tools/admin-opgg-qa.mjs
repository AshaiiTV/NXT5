import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const output = path.resolve(process.env.ADMIN_OPGG_QA_OUTPUT || 'artifacts/admin-opgg');
await fs.mkdir(output, { recursive: true });
const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const names = ['Éclair Bleu', 'Lynx', 'Nova', 'Comète', 'Aube'];
const roster = roles.map((role, index) => ({ id: `profile-${index}`, role, name: names[index], riot_id: `${names[index]}#TEST`, roster_status: 'MAIN' }));
const team = { id: 'orion', name: 'Équipe Orion', tag: 'ORN', region: 'EUW', owner_name: 'Camille Exemple', revision: '1', profiles: 8, matches: 153, mainRoster: roster };
const teams = [team,
  { ...team, id: 'nova', name: 'Équipe Nova', tag: 'NVA', region: 'NA', profiles: 5, matches: 27, mainRoster: roster.map((player, index) => ({ ...player, riot_id: index < 3 ? player.riot_id : '' })) },
  { ...team, id: 'aurora', name: 'Équipe Aurora', tag: 'AUR', profiles: 0, matches: 0, mainRoster: [] },
];
const counts = { members: 2, profiles: 8, matches: 153, reports: 37, compositions: 6, planning: 12, goals: 9, drafts: 24, archives: 4 };
const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';import AdministrationPage from '/src/pages/admin/AdministrationPage.jsx';
function View(){const [route,setRoute]=React.useState({path:'/admin/equipes',search:new URLSearchParams(location.search).get('query')||''});return React.createElement(AdministrationPage,{route,navigate:path=>{const u=new URL(path,location.origin);setRoute({path:u.pathname,search:u.search});},user:{id:'admin',name:'Admin exemple',is_platform_admin:true},onLogout:()=>{}});}createRoot(document.getElementById('root')).render(React.createElement(View));`;
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, plugins: [{
  name: 'admin-opgg-fixture',
  resolveId(id) { if (id === '/__admin-opgg.js') return '\0admin-opgg'; },
  load(id) { if (id === '\0admin-opgg') return fixture; },
  configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__admin-opgg.html') {
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html lang="fr"><head><!--seo:start--><!--seo:end--><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__admin-opgg.js"></script></body></html>'));
      return;
    }
    if (url.pathname.endsWith('/admin-team-tools')) {
      assert.equal(req.method, 'GET', 'Copy must never mutate server data');
      let data;
      const selected = teams.find(row => row.id === url.searchParams.get('teamId'));
      if (!selected) data = { rows: teams, pagination: { total: teams.length, page: 1, pageSize: 20 } };
      else {
        const view = url.searchParams.get('view') || 'profiles';
        const rows = view === 'profiles' && !url.searchParams.get('q') ? selected.mainRoster : [];
        data = { team: selected, counts, rows, pagination: { total: rows.length, page: 1, pageSize: 20 } };
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return;
    }
    next();
  }); },
}] });

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const checks = [];
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1050 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.copied = [];
      window.denyCopy = false;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
        if (window.denyCopy) throw new Error('Clipboard denied');
        window.copied.push(value);
      } } });
    });
    await page.goto(server.resolvedUrls.local[0] + '__admin-opgg.html');
    const copyButtons = page.locator('.admin-roster-opgg button');
    await copyButtons.first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const geometry = async label => {
      const data = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('.admin-roster-opgg button')].map(node => ({ text: node.textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })) }));
      assert(data.scrollWidth <= width + 1, `${label} overflows at ${width}: ${data.scrollWidth}`);
      assert(data.buttons.every(button => button.height >= (width <= 640 ? 44 : 36) && button.width >= 44), `${label} ${width}: copy targets below responsive minimum: ${JSON.stringify(data.buttons)}`);
      checks.push({ label, ...data });
    };
    const screenshot = async label => {
      if ([320, 390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${label}-${width}.png`), fullPage: true });
    };
    await geometry('list');
    await screenshot('teams');
    assert.equal(await copyButtons.count(), 3);
    assert(await copyButtons.nth(2).isDisabled(), 'Empty roster copy must be disabled');
    await copyButtons.first().focus();
    const focus = await copyButtons.first().evaluate(node => ({ active: document.activeElement === node, outline: getComputedStyle(node).outlineStyle }));
    assert(focus.active && focus.outline !== 'none', 'Copy keyboard focus must remain visible');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.copied.length === 1);
    const first = new URL(await page.evaluate(() => window.copied[0]));
    assert.equal(first.pathname, '/lol/multisearch/euw');
    assert.equal(first.searchParams.get('summoners'), roster.map(player => player.riot_id).join(','));
    await screenshot('teams-copied');
    const partialRow = page.locator('.admin-team-records > li').filter({ hasText: 'Équipe Nova' });
    await partialRow.locator('.admin-roster-opgg button').click();
    await page.waitForFunction(() => window.copied.length === 2);
    const partial = new URL(await page.evaluate(() => window.copied[1]));
    assert.equal(partial.pathname, '/lol/multisearch/na');
    assert.equal(partial.searchParams.get('summoners'), roster.slice(0, 3).map(player => player.riot_id).join(','));
    assert.match(await partialRow.innerText(), /3\s*(?:\/|sur)\s*5|3.*5/s, 'Partial copy must identify included/total players');
    await geometry('partial');
    await screenshot('teams-partial');
    await page.locator('.admin-team-records > li').filter({ hasText: 'Équipe Orion' }).getByRole('button', { name: 'Explorer', exact: true }).click();
    await page.getByRole('button', { name: 'Supprimer l’équipe', exact: true }).waitFor();
    await geometry('dossier');
    await screenshot('team');
    await page.getByLabel('Rechercher dans cette rubrique').fill('aucun résultat');
    await page.getByText('Aucun élément pour ces filtres.', { exact: true }).waitFor();
    const dossierCopy = page.locator('.admin-roster-opgg button');
    await dossierCopy.click();
    await page.waitForFunction(() => window.copied.length === 3);
    assert.equal(await page.evaluate(() => window.copied[2]), first.href, 'Copy must not depend on filtered profile rows');
    await page.getByRole('button', { name: 'Parties', exact: true }).click();
    await page.getByText('Aucun élément pour ces filtres.', { exact: true }).waitFor();
    await page.evaluate(() => { window.denyCopy = true; });
    await dossierCopy.click();
    await page.getByRole('alert').waitFor();
    await geometry('clipboard-error');
    await screenshot('team-error');
    await page.evaluate(() => { window.denyCopy = false; });
    await dossierCopy.click();
    await page.waitForFunction(() => window.copied.length === 4);
    assert.equal(await page.getByRole('alert').count(), 0, 'Retry must clear clipboard failure');
    assert.deepEqual(errors, [], 'Browser errors');
    await page.close();
  }
  await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2));
  console.log('Admin OP.GG: 6 responsive widths; list/dossier clipboard, partial, empty, filtering, failure/retry and keyboard checks passed.');
} finally {
  await browser?.close();
  await server.close();
}
