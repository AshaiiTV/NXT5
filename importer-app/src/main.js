import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROUTES = {
  EUW1: 'EUROPE',
  EUN1: 'EUROPE',
  TR1: 'EUROPE',
  RU: 'EUROPE',
  NA1: 'AMERICAS',
  BR1: 'AMERICAS',
  LA1: 'AMERICAS',
  LA2: 'AMERICAS',
  KR: 'ASIA',
  JP1: 'ASIA',
  OC1: 'SEA',
  PH2: 'SEA',
  SG2: 'SEA',
  TH2: 'SEA',
  TW2: 'SEA',
  VN2: 'SEA'
};

function regionalFromMatchId(matchId) {
  const platform = String(matchId || '').split('_')[0]?.toUpperCase();
  return ROUTES[platform] || 'EUROPE';
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 820,
    minHeight: 620,
    title: 'NXT5 Importer',
    backgroundColor: '#050814',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer.html'));
}

ipcMain.handle('generate-import', async (_event, form) => {
  const gameId = String(form?.gameId || '').trim().toUpperCase();
  const apiKey = String(form?.apiKey || '').trim();
  const label = String(form?.label || '').trim().slice(0, 120);
  const opponent = String(form?.opponent || '').trim().slice(0, 120);

  if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) {
    throw new Error('Game ID invalide. Format attendu : EUW1_7123456789.');
  }
  if (!apiKey.startsWith('RGAPI-')) {
    throw new Error('Clé Riot invalide. Elle doit commencer par RGAPI-.');
  }

  const regional = regionalFromMatchId(gameId).toLowerCase();
  const riotResponse = await fetch(`https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(gameId)}`, {
    headers: { 'X-Riot-Token': apiKey }
  });

  if (!riotResponse.ok) {
    let detail = '';
    try {
      const payload = await riotResponse.json();
      detail = payload?.status?.message || payload?.message || '';
    } catch {
      detail = await riotResponse.text().catch(() => '');
    }
    if (riotResponse.status === 401 || riotResponse.status === 403) throw new Error('Riot refuse la clé API. Vérifie qu’elle est valide et pas expirée.');
    if (riotResponse.status === 404) throw new Error('Game introuvable. Vérifie le Game ID et son préfixe serveur.');
    if (riotResponse.status === 429) throw new Error('Rate limit Riot atteint. Attends un peu avant de réessayer.');
    throw new Error(`Erreur Riot ${riotResponse.status}. ${detail}`.trim());
  }

  const match = await riotResponse.json();
  const payload = {
    source: 'nxt5-importer-exe',
    version: 1,
    gameId,
    label,
    opponent,
    exportedAt: new Date().toISOString(),
    match
  };

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer le fichier NXT5',
    defaultPath: `nxt5-${gameId}.json`,
    filters: [{ name: 'NXT5 JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { canceled: false, filePath, gameId };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
