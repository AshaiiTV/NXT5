// Renders the real glass 5 for a list of poses into transparent PNGs.
// usage: node glass/render-glass.cjs poses.json outdir [width]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const [, , posesFile, outDir, widthArg] = process.argv;
const width = Number(widthArg || 900);
const height = Math.round(width * 665 / 729);
const root = __dirname;
const publicDir = path.resolve(__dirname, '../../../public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // /assets/* comes from the site's public folder (atmosphere.webp feeds the glass environment)
  const base = url.startsWith('/assets/') ? publicDir : root;
  const file = path.join(base, url.replace(/^\/+/, '') || 'index.html');
  if (!file.startsWith(base) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.addStyleTag({ content: `canvas{width:${width}px!important;height:${height}px!important}` });
  await page.evaluate(() => globalThis.__ready);
  await page.evaluate(() => globalThis.__glass.resize());
  const poses = JSON.parse(fs.readFileSync(posesFile, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  for (const [i, pose] of poses.entries()) {
    const url = await page.evaluate((p) => { globalThis.__glass.render(p); return document.getElementById('c').toDataURL('image/png'); }, pose);
    fs.writeFileSync(path.join(outDir, `g${String(i).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(`${poses.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
