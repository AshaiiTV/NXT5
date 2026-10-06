/* Déterminisme (bible §6.8) : mêmes temps rendus dans deux pages neuves, l'une dans l'ordre croissant,
 * l'autre dans l'ordre décroissant. Les images doivent être identiques au pixel près.
 *   node tools/determinism.mjs [--times 4.8,4.95,...] */
import { chromium } from 'playwright-core';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'].find(p => existsSync(p));
const ai = process.argv.indexOf('--times');
const times = ai > 0 ? process.argv[ai + 1].split(',').map(Number) : [4.8, 4.95, 7.2, 8.4, 9.6, 13.2, 16.8, 27.6];
const b = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-web-security', '--allow-file-access-from-files', '--disable-gpu-rasterization'] });
async function run(order) {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }), p = await ctx.newPage();
  p.on('pageerror', e => console.log('[page error]', e.message));
  await p.goto(`file://${ROOT}/index.html?capture=1`);
  await p.waitForFunction(() => window.NXready === true, null, { timeout: 120000 });
  const cdp = await ctx.newCDPSession(p), out = {};
  for (const t of order) {
    await p.evaluate(t => { window.NXrender(t); return new Promise(r => requestAnimationFrame(() => r())); }, t);
    // pixels bruts via un canvas de capture : comparaison exacte, indépendante de l'encodage
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false });
    out[t] = r.data;
  }
  await ctx.close(); return out;
}
const A = await run(times.slice().sort((a, b) => a - b)), B = await run(times.slice().sort((a, b) => b - a));
let bad = 0;
for (const t of times) { const same = A[t] === B[t]; if (!same) bad++; console.log(`t=${t.toFixed(2)} ${same ? 'identique' : 'DIFFÉRENT'}`); }
await b.close();
console.log(bad ? `${bad} temps diffèrent selon l'ordre de rendu.` : 'Rendu déterministe.');
process.exit(bad ? 2 : 0);
