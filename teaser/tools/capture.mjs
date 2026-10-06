/* Outil de capture du teaser.
 *   node tools/capture.mjs sheet  --from 0 --to 4 --n 12 [--cols 4] [--only id1,id2] --out out/x.png
 *   node tools/capture.mjs stills --times 1.5,2,3.25 [--only id] --out out/dir
 *   node tools/capture.mjs frames --fps 30 --sub 4 --workers 4 [--from 0 --to 32] --out out/frames
 *   node tools/capture.mjs audio  --out out/soundtrack.wav
 * Les erreurs console de la page sont affichées (préfixe [page]). */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Chromium : variable CHROME_PATH, sinon le Chromium préinstallé du conteneur, sinon celui de Playwright sur Mac.
const EXE = process.env.CHROME_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
].find(p => existsSync(p));
const [, , mode, ...rest] = process.argv;
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];

async function openPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[page error]', e.message));
  const q = new URLSearchParams({ capture: '1' }); if (opt.only) q.set('only', opt.only);
  await page.goto(`file://${ROOT}/index.html?${q}`);
  await page.waitForFunction(() => window.NXready === true, null, { timeout: 60000 });
  // Capture directe par le protocole de Chrome : pixels identiques à page.screenshot, environ 2,7 fois plus rapide.
  const cdp = await context.newCDPSession(page);
  page.grab = async (path, format = 'png') => {
    const r = await cdp.send('Page.captureScreenshot', { format, optimizeForSpeed: true, ...(format === 'jpeg' ? { quality: 85 } : {}) });
    const buf = Buffer.from(r.data, 'base64');
    if (path) writeFileSync(path, buf);
    return buf;
  };
  return page;
}
const launch = () => chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-web-security', '--allow-file-access-from-files'] });
const renderAt = (page, t) => page.evaluate(t => { window.NXrender(t); return new Promise(r => requestAnimationFrame(() => r())); }, t);

if (mode === 'stills' || mode === 'sheet') {
  const browser = await launch(); const page = await openPage(browser);
  let times;
  if (opt.times) times = opt.times.split(',').map(Number);
  else { const a = +opt.from, b = +opt.to, n = +(opt.n || 12); times = Array.from({ length: n }, (_, i) => a + (b - a) * (n === 1 ? 0 : i / (n - 1))); }
  if (mode === 'stills') {
    mkdirSync(opt.out, { recursive: true });
    for (const t of times) { await renderAt(page, t); await page.grab(`${opt.out}/t${t.toFixed(2)}.png`); }
    console.log(`${times.length} images → ${opt.out}`);
  } else {
    const shots = [];
    for (const t of times) { await renderAt(page, t); shots.push({ t, b64: (await page.grab(null, 'jpeg')).toString('base64') }); }
    const cols = +(opt.cols || 4), w = 480, h = 270, rows = Math.ceil(shots.length / cols);
    const sheet = await browser.newPage({ viewport: { width: cols * w + (cols + 1) * 6, height: rows * (h + 26) + 6 } });
    await sheet.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px;font:600 14px sans-serif;color:#ddd">${shots.map(s => `<div><img src="data:image/jpeg;base64,${s.b64}" width="${w}" height="${h}" style="display:block"><div style="height:20px;padding-top:2px">t = ${s.t.toFixed(2)} s</div></div>`).join('')}</body>`);
    mkdirSync(dirname(opt.out), { recursive: true });
    await sheet.screenshot({ path: opt.out, fullPage: true });
    console.log(`planche ${shots.length} images → ${opt.out}`);
  }
  await browser.close();
} else if (mode === 'frames') {
  const fps = +(opt.fps || 30), sub = +(opt.sub || 1), workers = +(opt.workers || 4);
  const from = +(opt.from || 0), to = +(opt.to || 33.6), shutter = +(opt.shutter || 0.5);
  const first = Math.round(from * fps), last = Math.round(to * fps);
  mkdirSync(opt.out, { recursive: true });
  const jobs = []; for (let f = first; f < last; f++) jobs.push(f);
  let done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const browser = await launch(); const page = await openPage(browser);
    for (let k = w; k < jobs.length; k += workers) {
      const f = jobs[k];
      for (let s = 0; s < sub; s++) {
        // Obturateur centré sur l'image : sous-images réparties sur shutter × 1/fps
        const t = f / fps + (sub === 1 ? 0 : (s / (sub - 1) - 0.5) * shutter / fps);
        await renderAt(page, Math.max(0, t));
        await page.grab(`${opt.out}/f${String(f).padStart(5, '0')}_${s}.png`);
      }
      if (++done % 30 === 0) console.log(`${done}/${jobs.length} images (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    await browser.close();
  }));
  console.log(`terminé : ${jobs.length} images × ${sub} sous-images → ${opt.out}`);
} else if (mode === 'audio') {
  const browser = await launch(); const page = await openPage(browser);
  const sr = 48000;
  const data = await page.evaluate(async sr => {
    const buf = await NX.audio.render(sr);
    const n = Math.min(buf.length, Math.round(NX.DURATION * sr + sr * 0.5));
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const out = new Int16Array(n * 2); let peak = 0;
    for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    for (let i = 0; i < n; i++) { out[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; out[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    let s = ''; const bytes = new Uint8Array(out.buffer); for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { b64: btoa(s), n, peak };
  }, sr);
  const pcm = Buffer.from(data.b64, 'base64');
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(sr, 24);
  hdr.writeUInt32LE(sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  mkdirSync(dirname(opt.out), { recursive: true });
  writeFileSync(opt.out, Buffer.concat([hdr, pcm]));
  console.log(`audio ${(data.n / sr).toFixed(2)} s, crête ${data.peak.toFixed(3)} → ${opt.out}`);
  await browser.close();
} else {
  console.log('mode inconnu : sheet | stills | frames | audio');
  process.exit(1);
}
