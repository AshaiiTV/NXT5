// Cross-check (not used for the final images): boots the REAL NXT5 Importer (Electron, importer-app/src/main.js) through
// the repo's smoke fixture (simulated LCU, mocked NXT5/GitHub/native dialogs) and shoots the home screen with the
// same content size (1180×790) and scale as capture-importer.cjs, so both can be compared pixel by pixel.
// Electron renders on Linux here: only the home view is compared (no path or system label is visible on it).
//
// Usage: ELECTRON=/path/to/electron xvfb-run -a -s "-screen 0 2560x1800x24" node check-importer-electron.cjs [outDir]
// Then:  python3 -I compare.py <outDir>/electron-accueil.png ../../public/tuto/importer-01-accueil-client-connecte.png
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { REPO, requirePlaywright } = require('./lib.cjs');

const { _electron } = requirePlaywright();
const importerRoot = path.join(REPO, 'importer-app');
const outDir = path.resolve(process.argv[2] || path.join(__dirname, '.logs', 'electron'));
const electron = process.env.ELECTRON;
if (!electron || !fs.existsSync(electron)) { console.error('Définis ELECTRON=<chemin de l’exécutable Electron 44>'); process.exit(1); }

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxt5-importer-check-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(runDir, 'lcu-key.pem'), '-out', path.join(runDir, 'lcu-cert.pem'),
    '-subj', '/CN=127.0.0.1', '-days', '1'], { stdio: 'ignore' });
  const app = await _electron.launch({
    executablePath: electron,
    args: ['--no-sandbox', '--force-device-scale-factor=2', '--hide-scrollbars', path.join(importerRoot, 'scripts/smoke-electron.mjs')],
    cwd: importerRoot,
    env: { ...process.env, NXT5_SMOKE_CHILD: '1', NXT5_SMOKE_RUN_DIR: runDir, LANG: 'fr_FR.UTF-8', TZ: 'Europe/Paris' },
    timeout: 30000,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('#clientIndicator[data-state="connected"]', { timeout: 15000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1180, 790));
  await page.waitForTimeout(800);
  await page.mouse.move(560, 780);
  const file = path.join(outDir, 'electron-accueil.png');
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  console.log('écrit', file, 'viewport', await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]), 'erreurs', errors.length);
  await app.close();
  fs.rmSync(runDir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
