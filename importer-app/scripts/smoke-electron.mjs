// Run manually with Node, not through the unit-test discovery pattern.
// The same file boots an isolated fixture environment when launched by Electron.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import https from 'node:https';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const scriptPath = fileURLToPath(import.meta.url);
const importerRoot = path.resolve(path.dirname(scriptPath), '..');
const packageInfo = JSON.parse(await fs.readFile(path.join(importerRoot, 'package.json'), 'utf8'));
const gameId = 'EUW1_7861632138';
const execFileAsync = promisify(execFile);

function makeFixtures() {
  const participants = Array.from({ length: 10 }, (_, index) => ({
    participantId: index + 1,
    teamId: index < 5 ? 100 : 200,
    championId: index + 1,
    championName: `Champion ${index + 1}`,
    summonerName: `Fixture ${index + 1}`,
    riotIdGameName: `Fixture ${index + 1}`,
    riotIdTagline: 'TEST',
    teamPosition: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][index % 5],
    kills: index, deaths: 2, assists: 3,
    totalMinionsKilled: 100, neutralMinionsKilled: 10,
    goldEarned: 8000, totalDamageDealtToChampions: 10000,
    visionScore: 20, item0: 1001, summoner1Id: 4, summoner2Id: 14,
    win: index < 5
  }));
  const match = {
    metadata: { matchId: gameId, participants: participants.map((player) => `fixture-puuid-${player.participantId}`) },
    info: {
      gameId: 7861632138, gameDuration: 1500,
      gameCreation: Date.parse('2026-09-05T16:00:00.000Z'),
      gameVersion: '26.17.1', gameMode: 'CLASSIC', gameType: 'CUSTOM_GAME', mapId: 11,
      participants,
      teams: [
        { teamId: 100, win: true, objectives: { champion: { kills: 10 }, dragon: { kills: 2 } } },
        { teamId: 200, win: false, objectives: { champion: { kills: 35 }, dragon: { kills: 1 } } }
      ]
    }
  };
  const timeline = {
    metadata: { matchId: gameId },
    info: {
      frames: [0, 600000, 1200000, 1500000].map((timestamp) => ({
        timestamp,
        participantFrames: Object.fromEntries(participants.map((player) => [player.participantId, {
          participantId: player.participantId,
          minionsKilled: timestamp / 10000, jungleMinionsKilled: 5,
          position: { x: 3000, y: 4000 }
        }])),
        events: timestamp === 600000 ? [{
          type: 'WARD_PLACED', timestamp: 598000, creatorId: 1,
          wardType: 'YELLOW_TRINKET', position: { x: 3500, y: 4200 }
        }] : []
      }))
    }
  };
  const lcuGame = {
    ...match.info,
    platformId: 'EUW1', gameCreation: undefined,
    gameCreationDate: '2026-09-05T16:00:00.000Z',
    participants: participants.map((player) => ({
      participantId: player.participantId, teamId: player.teamId,
      championId: player.championId,
      spell1Id: player.summoner1Id, spell2Id: player.summoner2Id,
      timeline: {
        lane: player.teamPosition === 'MIDDLE' ? 'MID' : player.teamPosition === 'UTILITY' ? 'BOTTOM' : player.teamPosition,
        role: player.teamPosition === 'UTILITY' ? 'DUO_SUPPORT' : player.teamPosition === 'BOTTOM' ? 'DUO_CARRY' : 'SOLO'
      },
      stats: { ...player, win: player.win ? 'Win' : 'Fail' }
    })),
    participantIdentities: participants.map((player) => ({
      participantId: player.participantId,
      player: { summonerName: player.summonerName, gameName: player.riotIdGameName, tagLine: player.riotIdTagline }
    })),
    teams: match.info.teams.map((team) => ({
      teamId: team.teamId, win: team.win ? 'Win' : 'Fail',
      dragonKills: team.objectives.dragon.kills, towerKills: 2
    }))
  };
  return { match, timeline, lcuGame };
}

async function bootFixture() {
  if (!process.versions.electron) throw new Error('The fixture child must run under Electron.');
  const { app, dialog, shell } = await import('electron');
  const runDir = process.env.NXT5_SMOKE_RUN_DIR;
  if (!runDir || !path.isAbsolute(runDir)) throw new Error('Missing isolated smoke-test directory.');
  const userData = path.join(runDir, 'user-data');
  await fs.mkdir(userData, { recursive: true });
  app.setPath('userData', userData);
  const { match, timeline, lcuGame } = makeFixtures();
  const lockfilePath = path.join(runDir, 'lockfile');
  const state = globalThis.__NXT5_SMOKE = {
    runDir, mode: 'success', saved: path.join(runDir, 'initial-export.json'),
    calls: [], external: [], saveDialogCalls: 0, updatesOffline: false
  };
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    state.calls.push(url.href);
    if (url.hostname === 'api.github.com') {
      if (state.updatesOffline) throw new Error('Connexion fixture indisponible.');
      const platformName = process.platform === 'darwin' ? `Mac-${process.arch}` : 'Windows';
      const extension = process.platform === 'darwin' ? 'zip' : 'exe';
      const name = `NXT5-Importer-${platformName}-${packageInfo.version}.${extension}`;
      return new Response(JSON.stringify({ assets: [{
        name,
        browser_download_url: `https://github.com/AshaiiTV/NXT5/releases/download/nxt5-match-exporter-latest/${name}`
      }] }));
    }
    if (url.pathname === '/.netlify/functions/riot-match-export') {
      if (state.mode === 'delayed') {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 1500);
          const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
          if (options.signal?.aborted) abort();
          else options.signal?.addEventListener('abort', abort, { once: true });
        });
      }
      if (state.mode.startsWith('local-') || state.mode === 'remote-error') {
        return new Response(JSON.stringify({ error: 'Service fixture indisponible.' }), { status: 503 });
      }
      if (state.mode === 'malformed') {
        return new Response(JSON.stringify({ match: { info: { participants: [], teams: [] } } }));
      }
      if (state.mode === 'wrong-match') {
        return new Response(JSON.stringify({ match: { ...match, metadata: { matchId: 'EUW1_7861632199' } } }));
      }
      return new Response(JSON.stringify({
        match, timeline: state.mode === 'no-timeline' ? null : timeline,
        source: 'nxt5-riot-match-export'
      }));
    }
    // Includes Data Dragon: verifies that unavailable champion metadata is optional.
    throw new Error(`Network disabled by smoke fixture: ${url.href}`);
  };
  dialog.showSaveDialog = async () => {
    state.saveDialogCalls += 1;
    return state.mode === 'dialog-cancel' ? { canceled: true } : { canceled: false, filePath: state.saved };
  };
  dialog.showMessageBox = async () => ({ response: 1 });
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [lockfilePath] });
  shell.showItemInFolder = (filePath) => state.external.push(`file:${filePath}`);
  shell.openExternal = async (url) => { state.external.push(url); };

  const lcu = https.createServer({
    key: await fs.readFile(path.join(runDir, 'lcu-key.pem')),
    cert: await fs.readFile(path.join(runDir, 'lcu-cert.pem'))
  }, (request, response) => {
    state.calls.push(`lcu:${request.url}`);
    response.setHeader('Content-Type', 'application/json');
    const reply = (payload, status = 200) => { response.writeHead(status); response.end(JSON.stringify(payload)); };
    if (request.headers.authorization !== `Basic ${Buffer.from('riot:fixture-password').toString('base64')}`) {
      reply({}, 401); return;
    }
    if (request.url === '/riotclient/region-locale') { reply({ region: 'EUW', locale: 'fr_FR' }); return; }
    if (request.url.includes('timeline')) { reply(timeline); return; }
    if (['remote-error', 'malformed', 'wrong-match'].includes(state.mode)) { reply({}, 404); return; }
    if (/\/lol-match-history\/v1\/games?\/\d+$/.test(request.url)) {
      reply(state.mode === 'local-wrong-match' ? { ...lcuGame, gameId: 7861632199 }
        : state.mode === 'local-wrong-region' ? { ...lcuGame, platformId: 'NA1' } : lcuGame);
      return;
    }
    reply({}, 404);
  });
  await new Promise((resolve, reject) => {
    lcu.once('error', reject);
    lcu.listen(0, '127.0.0.1', resolve);
  });
  await fs.writeFile(lockfilePath, `LeagueClient:99999:${lcu.address().port}:fixture-password:https`);
  process.env.LEAGUE_LOCKFILE = lockfilePath;
  app.on('before-quit', () => lcu.close());
  await import(pathToFileURL(path.join(importerRoot, 'src/main.js')).href);
}

async function runSmoke() {
  const require = createRequire(import.meta.url);
  const moduleName = process.env.NXT5_PLAYWRIGHT_MODULE || 'playwright';
  let electronLauncher, expect, executablePath;
  try {
    electronLauncher = require(moduleName)._electron;
    ({ expect } = require(path.join(path.dirname(require.resolve(moduleName)), 'test.js')));
    executablePath = process.env.NXT5_ELECTRON_BINARY || require('electron');
  } catch (error) {
    throw new Error('Install/provide Playwright and Electron, or set NXT5_PLAYWRIGHT_MODULE and NXT5_ELECTRON_BINARY. See importer-app/docs/testing.md.', { cause: error });
  }
  const outputParent = path.resolve(process.env.NXT5_SMOKE_OUTPUT_DIR || os.tmpdir());
  await fs.mkdir(outputParent, { recursive: true });
  const runDir = await fs.mkdtemp(path.join(outputParent, 'nxt5-importer-smoke-'));
  const results = [];
  const errors = [];
  let application;
  const test = async (name, callback) => {
    try { await callback(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
    catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
  };
  try {
    try {
      await execFileAsync('openssl', [
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', path.join(runDir, 'lcu-key.pem'), '-out', path.join(runDir, 'lcu-cert.pem'),
        '-subj', '/CN=127.0.0.1', '-days', '1'
      ]);
    } catch (error) { throw new Error('OpenSSL must be available on PATH to generate the loopback LCU fixture certificate.', { cause: error }); }
    application = await electronLauncher.launch({
      executablePath, args: [scriptPath], cwd: importerRoot, timeout: 30000,
      env: { ...process.env, NXT5_SMOKE_CHILD: '1', NXT5_SMOKE_RUN_DIR: runDir }
    });
    const page = await application.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#railVersion')).toHaveText(`v${packageInfo.version}`);
    await expect(page.locator('#clientIndicator')).toHaveAttribute('data-state', 'connected');
    await expect(page.locator('#manualUpdateButton')).toBeEnabled();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    const mode = async (value) => application.evaluate((_, next) => {
      globalThis.__NXT5_SMOKE.mode = next.mode;
      globalThis.__NXT5_SMOKE.saved = next.saved;
    }, { mode: value, saved: path.join(runDir, `export-${value}.json`) });
    const clickExport = async (value = gameId) => {
      await page.locator('#exportTab').click();
      await page.locator('#gameId').fill(value);
      await page.locator('#submit').click();
    };
    const readExport = async (name) => JSON.parse(await fs.readFile(path.join(runDir, `export-${name}.json`), 'utf8'));

    await test('boot and empty export screenshot', async () => {
      await expect(page.locator('#historyCount')).toHaveText('0');
      assert.deepEqual(await page.evaluate(() => [typeof window.require, typeof window.process]), ['undefined', 'undefined']);
      await page.screenshot({ path: path.join(runDir, 'empty-export-desktop.png') });
    });
    await test('minimum window has no horizontal overflow', async () => {
      try {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(820, 620));
        await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(820);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: path.join(runDir, 'empty-export-minimum.png') });
      } finally { await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1180, 800)); }
    });
    await test('invalid ID preserves input focus and avoids network requests', async () => {
      await clickExport('not-a-game');
      await expect(page.locator('#gameId')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#gameId')).toBeFocused();
      await expect(page.locator('#gameIdError')).toBeVisible();
      assert.equal((await application.evaluate(() => globalThis.__NXT5_SMOKE.calls.filter((url) => url.includes('riot-match-export')))).length, 0);
    });
    await test('remote export saves one timeline and correct milestones', async () => {
      await mode('success'); await clickExport();
      await expect(page.locator('#resultPanel')).toBeVisible();
      const saved = await readExport('success');
      assert.equal(saved.gameId, gameId);
      assert.equal(saved.match.info.participants.length, 10);
      assert.equal(saved.match.timeline, undefined);
      assert.equal(saved.timeline.info.frames.length, 4);
      assert.equal(saved.nxt5.timelineSummary.csMilestones['1'].cs10, 65);
      assert.equal(saved.nxt5.timelineSummary.csMilestones['1'].cs20, 125);
      assert.equal(saved.nxt5.timelineSummary.wardCount, 1);
      await expect(page.locator('#historyCount')).toHaveText('1');
    });
    await test('history search, file reveal and keyboard navigation', async () => {
      await page.keyboard.press(`${modifier}+2`);
      await expect(page.locator('#historyView')).toBeVisible();
      await expect(page.locator('#historyHeading')).toBeFocused();
      await expect(page.locator('.history-row')).toHaveCount(1);
      await page.screenshot({ path: path.join(runDir, 'fixture-history-desktop.png') });
      await page.locator('#historySearch').fill('999999');
      await expect(page.locator('#historyEmpty h3')).toHaveText('Aucun export ne correspond');
      await page.locator('#historySearch').fill('');
      await page.getByRole('button', { name: `Afficher le fichier ${gameId}` }).click();
      assert.ok((await application.evaluate(() => globalThis.__NXT5_SMOKE.external)).some((url) => url.startsWith('file:')));
      await page.keyboard.press(`${modifier}+3`);
      await expect(page.locator('#settingsView')).toBeVisible();
      await expect(page.locator('#settingsHeading')).toBeFocused();
    });
    await test('custom lockfile choice and automatic-detection reset', async () => {
      await page.locator('#chooseLeaguePath').click();
      await expect(page.locator('#leaguePath')).toHaveText(path.join(runDir, 'lockfile'));
      await page.locator('#resetLeaguePath').click();
      await expect(page.locator('#leaguePath')).toHaveText('Détection automatique');
      await expect(page.locator('#resetLeaguePath')).toBeHidden();
    });
    await test('offline update status preserves the installed version', async () => {
      await application.evaluate(() => { globalThis.__NXT5_SMOKE.updatesOffline = true; });
      try {
        await page.locator('#manualUpdateButton').click();
        await expect(page.locator('#manualUpdateButton')).toBeEnabled();
        await expect(page.locator('#latestVersion')).toHaveText('Vérification indisponible');
        await expect(page.locator('#currentVersion')).toHaveText(`v${packageInfo.version}`);
      } finally { await application.evaluate(() => { globalThis.__NXT5_SMOKE.updatesOffline = false; }); }
    });
    await test('native save cancellation creates neither file nor history', async () => {
      await mode('dialog-cancel'); await clickExport();
      await expect(page.locator('#status')).toContainText('Export annulé');
      await expect(page.locator('#historyCount')).toHaveText('1');
      await assert.rejects(fs.access(path.join(runDir, 'export-dialog-cancel.json')), { code: 'ENOENT' });
    });
    await test('active cancellation, immediate retry and missing timeline', async () => {
      await mode('delayed'); await clickExport();
      await expect(page.locator('#cancelImport')).toBeEnabled();
      await page.locator('#cancelImport').click();
      await expect(page.locator('#status')).toContainText('Export annulé');
      await expect(page.locator('#submit')).toBeEnabled();
      await assert.rejects(fs.access(path.join(runDir, 'export-delayed.json')), { code: 'ENOENT' });
      await mode('no-timeline'); await page.keyboard.press(`${modifier}+Enter`);
      await expect(page.locator('#resultPanel')).toBeVisible();
      await expect(page.locator('#resultWarning')).toContainText('Timeline indisponible');
      const saved = await readExport('no-timeline');
      assert.equal(saved.timeline, null);
      assert.equal(saved.nxt5.timelineSummary.available, false);
    });
    await test('service error stays actionable and retry succeeds', async () => {
      await mode('remote-error'); await clickExport();
      await expect(page.locator('#status')).toHaveClass(/error/);
      await expect(page.locator('#submit')).toBeEnabled();
      await expect(page.locator('#status')).toContainText('Service fixture indisponible');
      await mode('success'); await page.locator('#submit').click();
      await expect(page.locator('#resultPanel')).toBeVisible();
    });
    await test('LCU fallback preserves losses, roles, dates and objectives offline', async () => {
      await mode('local-success'); await clickExport();
      await expect(page.locator('#resultPanel')).toBeVisible();
      const saved = await readExport('local-success');
      assert.equal(saved.importerSource, 'nxt5-lcu-importer');
      assert.equal(saved.match.info.participants[9].win, false);
      assert.equal(saved.match.info.participants[4].teamPosition, 'UTILITY');
      assert.equal(saved.match.info.participants[2].teamPosition, 'MIDDLE');
      assert.equal(saved.match.info.participants[0].championName, 'Champion 1');
      assert.equal(saved.match.info.gameCreation, Date.parse('2026-09-05T16:00:00.000Z'));
      assert.equal(saved.match.info.teams[0].objectives.champion.kills, 10);
      assert.equal(saved.match.info.teams[1].objectives.champion.kills, 35);
      const calls = await application.evaluate(() => globalThis.__NXT5_SMOKE.calls);
      assert.equal(calls.filter((url) => url.includes('ddragon')).length, 1);
      assert.ok(calls.filter((url) => url.includes('riot-match-export')).every((url) => url.includes('fallback=0')));
    });
    for (const scenario of ['local-wrong-match', 'local-wrong-region', 'malformed', 'wrong-match']) {
      await test(`reject ${scenario} before the save dialog`, async () => {
        await mode(scenario);
        const count = await application.evaluate(() => globalThis.__NXT5_SMOKE.saveDialogCalls);
        await clickExport();
        await expect(page.locator('#status')).toHaveClass(/error/);
        await expect(page.locator('#submit')).toBeEnabled();
        assert.equal(await application.evaluate(() => globalThis.__NXT5_SMOKE.saveDialogCalls), count);
      });
    }
    await test('full region alias normalizes before export', async () => {
      await mode('success'); await clickExport('EUW_7861632138');
      await expect(page.locator('#platform')).toHaveValue('EUW1');
      await expect(page.locator('#resultPanel')).toBeVisible();
      assert.equal((await readExport('success')).gameId, gameId);
    });
    await test('site action opens the integration page without external navigation', async () => {
      const state = await page.evaluate(() => window.nxt5.getAppState());
      await page.locator('.sidebar [data-open-site]').click();
      assert.ok((await application.evaluate(() => globalThis.__NXT5_SMOKE.external)).includes(`${state.siteUrl}/integration`));
      assert.equal(await page.title(), 'NXT5 Importer');
    });
    await test('completion remains visible after changing views during export', async () => {
      await mode('delayed'); await clickExport();
      await page.locator('#settingsTab').click();
      await expect(page.locator('#settingsView')).toBeVisible();
      await expect(page.locator('#globalNotice')).toHaveClass(/success/);
      await expect(page.locator('#globalNotice')).toContainText(`Export ${gameId} enregistré`);
      assert.equal((await readExport('delayed')).gameId, gameId);
      await page.locator('#exportTab').click();
    });
    await test('generated JSON passes the actual website import validator', async () => {
      const validatorUrl = pathToFileURL(path.resolve(importerRoot, '../netlify/functions/_lib/import-validation.ts')).href;
      const { assertImportMatch } = await import(validatorUrl);
      for (const scenario of ['success', 'no-timeline', 'local-success']) assertImportMatch((await readExport(scenario)).match);
    });
    await test('history and selected region persist across renderer reload', async () => {
      await page.locator('#platform').selectOption('NA1');
      await expect.poll(() => page.evaluate(async () => (await window.nxt5.getAppState()).settings.platform)).toBe('NA1');
      const count = await page.locator('#historyCount').textContent();
      await page.reload();
      await expect(page.locator('#platform')).toHaveValue('NA1');
      await expect(page.locator('#historyCount')).toHaveText(count);
    });
    await test('no renderer console or page errors', async () => assert.deepEqual(errors, []));
  } catch (error) {
    results.push({ name: 'smoke setup or execution', passed: false, error: error.stack || error.message });
    console.error(error);
  } finally {
    if (application) await application.close().catch((error) => {
      results.push({ name: 'Electron shutdown', passed: false, error: error.message });
    });
    const report = {
      version: packageInfo.version, platform: process.platform, architecture: process.arch,
      syntheticDataOnly: true, passed: results.filter((result) => result.passed).length,
      total: results.length, results, rendererErrors: errors
    };
    await fs.writeFile(path.join(runDir, 'results.json'), JSON.stringify(report, null, 2));
    console.log(`${report.passed}/${report.total} passed. Evidence: ${runDir}`);
  }
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

try {
  if (process.env.NXT5_SMOKE_CHILD === '1') await bootFixture();
  else await runSmoke();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
