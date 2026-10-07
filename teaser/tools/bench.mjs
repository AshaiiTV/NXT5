/* Coût de rendu (bible §6.11) : médiane de 5 sous-images par temps, rendu + capture CDP, une page.
 *   node tools/bench.mjs [--times 2,4.8,...] */
import { chromium } from 'playwright-core';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fi = process.argv.indexOf('--format'), V = (fi > 0 ? process.argv[fi + 1] : process.env.NX_FORMAT || 'h') === 'v', VW = V ? 1080 : 1920, VH = V ? 1920 : 1080;
const EXE = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'].find(p => existsSync(p));
const ai = process.argv.indexOf('--times');
const times = ai > 0 ? process.argv[ai + 1].split(',').map(Number) : [2.0, 4.8, 5.0, 7.8, 8.85, 9.1, 9.65, 13.24, 14.8, 16.9, 22.0, 25.2, 27.6, 29.8];
const b = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-web-security', '--allow-file-access-from-files', '--disable-gpu-rasterization'] });
const ctx = await b.newContext({ viewport: { width: VW, height: VH } }), p = await ctx.newPage();
await p.goto(`file://${ROOT}/index.html?capture=1${V ? '&format=v' : ''}`);
await p.waitForFunction(() => window.NXready === true, null, { timeout: 120000 });
const cdp = await ctx.newCDPSession(p);
let sum = 0;
for (const t of times) {
  const ms = [];
  for (let k = 0; k < 5; k++) {
    const t0 = Date.now();
    await p.evaluate(t => { window.NXrender(t); return new Promise(r => requestAnimationFrame(() => r())); }, t + k * 0.0021);
    await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    ms.push(Date.now() - t0);
  }
  ms.sort((a, b) => a - b); sum += ms[2];
  console.log(`t=${t.toFixed(2)}  ${ms[2]} ms`);
}
const mean = sum / times.length;
console.log(`moyenne ${mean.toFixed(0)} ms/sous-image ; film complet à 6 sous-images ≈ ${(mean * 1008 * 6 / 1000 / 60 / 1.6).toFixed(0)} min sur 4 cœurs (débit mesuré ~1,6× une page seule)`);
await b.close();
