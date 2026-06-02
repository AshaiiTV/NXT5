import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NXT5_SITE_URL = String(process.env.NXT5_SITE_URL || 'https://nxt5.netlify.app').replace(/\/+$/, '');
const APP_NAME = 'NXT5 Importer';
const REMOTE_TIMEOUT_MS = 12000;
const LOCAL_TIMEOUT_MS = 8000;
const championNameCache = new Map();

function normalizeGameId(value, platform = 'EUW1') {
  const raw = String(value || '').trim().toUpperCase();
  const normalizedPlatform = String(platform || 'EUW1').trim().toUpperCase();
  const gameId = raw.includes('_') ? raw : `${normalizedPlatform}_${raw}`;
  if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) {
    throw new Error('Game ID invalide. Mets un ID numerique comme 7861632138, ou complet comme EUW1_7861632138.');
  }
  return gameId;
}

function isNumericGameId(value) {
  return /^\d+$/.test(String(value || '').trim());
}

function extractGameInput(value) {
  const raw = String(value || '').trim().toUpperCase();
  const full = raw.match(/\b([A-Z0-9]{2,5})[_-](\d{6,})\b/);
  if (full) return `${full[1]}_${full[2]}`;
  const numeric = raw.match(/\b(\d{6,})\b/);
  return numeric ? numeric[1] : raw;
}

function lockfileCandidates() {
  const home = os.homedir();
  const candidates = [
    process.env.LEAGUE_LOCKFILE,
    '/Applications/League of Legends.app/Contents/LoL/lockfile',
    path.join(home, 'Applications/League of Legends.app/Contents/LoL/lockfile'),
    'C:\\Riot Games\\League of Legends\\lockfile',
    'C:\\Program Files\\Riot Games\\League of Legends\\lockfile',
    'C:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile'
  ];
  return candidates.filter(Boolean);
}

async function readLeagueLockfile() {
  for (const filePath of lockfileCandidates()) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const [, , port, password, protocol] = content.trim().split(':');
      if (port && password) return { port, password, protocol: protocol || 'https' };
    } catch {
      // Try next common install path.
    }
  }
  throw new Error('Client LoL local introuvable. Ouvre League of Legends, puis relance l’import.');
}

async function lcuGet(endpoint) {
  const lockfile = await readLeagueLockfile();
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: '127.0.0.1',
      port: lockfile.port,
      path: endpoint,
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        Authorization: `Basic ${Buffer.from(`riot:${lockfile.password}`).toString('base64')}`
      }
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        let payload = null;
        try {
          payload = body ? JSON.parse(body) : null;
        } catch {
          payload = body;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(payload);
        else reject(new Error(`Client LoL: ${response.statusCode} sur ${endpoint}`));
      });
    });
    request.setTimeout(LOCAL_TIMEOUT_MS, () => {
      request.destroy(new Error(`Client LoL trop lent sur ${endpoint}. Ouvre l'historique de match dans le client, puis reessaie.`));
    });
    request.on('error', reject);
    request.end();
  });
}

async function fetchJsonWithTimeout(url, timeoutMs = REMOTE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { response, payload };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`NXT5 ne repond pas apres ${Math.round(timeoutMs / 1000)} secondes. Verifie ta connexion, puis reessaie.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function championNameById(championId) {
  const key = String(championId || '');
  if (!key) return 'Unknown';
  if (championNameCache.has(key)) return championNameCache.get(key);
  const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((res) => res.json());
  const version = versions?.[0];
  const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`).then((res) => res.json());
  for (const champion of Object.values(data?.data || {})) {
    championNameCache.set(String(champion.key), champion.name);
  }
  return championNameCache.get(key) || `Champion ${key}`;
}

function lcuWinValue(team) {
  if (typeof team?.win === 'boolean') return team.win;
  return String(team?.win || '').toLowerCase() === 'win';
}

async function lcuToRiotMatch(lcuGame, fallbackGameId) {
  const statNumber = (stats, ...keys) => {
    for (const key of keys) {
      const value = Number(stats?.[key] ?? 0);
      if (value) return value;
    }
    return 0;
  };
  const participants = await Promise.all((lcuGame.participants || []).map(async (participant, index) => {
    const identity = (lcuGame.participantIdentities || []).find((item) => item.participantId === participant.participantId);
    const player = identity?.player || {};
    const stats = participant.stats || {};
    const timeline = participant.timeline || {};
    const championName = participant.championName || await championNameById(participant.championId);
    const riotName = player.gameName || player.summonerName || player.displayName || `Player ${index + 1}`;
    const riotTag = player.tagLine || player.tagline || '';
    return {
      participantId: participant.participantId,
      teamId: participant.teamId,
      summonerName: player.summonerName || riotName,
      riotIdGameName: riotName,
      riotIdTagline: riotTag,
      championId: participant.championId,
      championName,
      teamPosition: String(timeline.lane || participant.teamPosition || '').toUpperCase(),
      individualPosition: String(timeline.lane || participant.individualPosition || '').toUpperCase(),
      lane: String(timeline.lane || participant.lane || 'UNKNOWN').toUpperCase(),
      kills: Number(stats.kills || 0),
      deaths: Number(stats.deaths || 0),
      assists: Number(stats.assists || 0),
      totalMinionsKilled: Number(stats.totalMinionsKilled || stats.minionsKilled || 0),
      neutralMinionsKilled: Number(stats.neutralMinionsKilled || 0),
      goldEarned: Number(stats.goldEarned || 0),
      totalDamageDealtToChampions: Number(stats.totalDamageDealtToChampions || 0),
      visionScore: Number(stats.visionScore || 0),
      item0: statNumber(stats, 'item0', 'item0Id'),
      item1: statNumber(stats, 'item1', 'item1Id'),
      item2: statNumber(stats, 'item2', 'item2Id'),
      item3: statNumber(stats, 'item3', 'item3Id'),
      item4: statNumber(stats, 'item4', 'item4Id'),
      item5: statNumber(stats, 'item5', 'item5Id'),
      item6: statNumber(stats, 'item6', 'item6Id', 'trinket', 'trinketItemId'),
      summoner1Id: statNumber(participant, 'summoner1Id', 'spell1Id') || statNumber(stats, 'summoner1Id', 'spell1Id'),
      summoner2Id: statNumber(participant, 'summoner2Id', 'spell2Id') || statNumber(stats, 'summoner2Id', 'spell2Id'),
      win: Boolean(stats.win)
    };
  }));

  return {
    metadata: {
      matchId: fallbackGameId,
      source: 'lcu-match-history'
    },
    info: {
      gameCreation: lcuGame.gameCreation || lcuGame.gameCreationDate || 0,
      gameDuration: Math.round(Number(lcuGame.gameDuration || 0) / (Number(lcuGame.gameDuration || 0) > 10000 ? 1000 : 1)),
      gameId: lcuGame.gameId || fallbackGameId,
      gameMode: lcuGame.gameMode || 'CLASSIC',
      gameType: lcuGame.gameType || 'CUSTOM_GAME',
      gameVersion: lcuGame.gameVersion || '',
      mapId: lcuGame.mapId || 11,
      participants,
      teams: (lcuGame.teams || []).map((team) => ({
        teamId: team.teamId,
        win: lcuWinValue(team),
        objectives: {
          baron: { kills: Number(team.baronKills || 0) },
          champion: { kills: Number(team.championKills || 0) },
          dragon: { kills: Number(team.dragonKills || 0) },
          inhibitor: { kills: Number(team.inhibitorKills || 0) },
          tower: { kills: Number(team.towerKills || 0) }
        }
      }))
    }
  };
}

async function fetchLocalClientMatch(numericGameId, fullGameId) {
  const endpoints = [
    `/lol-match-history/v1/games/${encodeURIComponent(numericGameId)}`,
    `/lol-match-history/v1/game/${encodeURIComponent(numericGameId)}`
  ];
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const game = await lcuGet(endpoint);
      if (game?.participants?.length) return lcuToRiotMatch(game, fullGameId);
      errors.push(`${endpoint}: réponse sans participants`);
    } catch (err) {
      errors.push(`${endpoint}: ${err.message}`);
    }
  }
  throw new Error(`Impossible de lire cette partie dans le client LoL local. Ouvre l’historique de match dans le client, puis réessaie. Détails: ${errors.join(' | ')}`);
}

function normalizeTimelinePayload(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.frames)) return { info: { frames: value.frames } };
  if (Array.isArray(value.info?.frames)) return value;
  if (Array.isArray(value.timeline?.frames)) return { info: { frames: value.timeline.frames } };
  if (Array.isArray(value.timeline?.info?.frames)) return value.timeline;
  if (Array.isArray(value.gameTimeline?.frames)) return { info: { frames: value.gameTimeline.frames } };
  return null;
}

async function fetchLocalClientTimeline(numericGameId) {
  const endpoints = [
    `/lol-match-history/v1/game-timelines/${encodeURIComponent(numericGameId)}`,
    `/lol-match-history/v1/games/${encodeURIComponent(numericGameId)}/timeline`,
    `/lol-match-history/v1/game/${encodeURIComponent(numericGameId)}/timeline`
  ];
  for (const endpoint of endpoints) {
    try {
      const payload = await lcuGet(endpoint);
      const timeline = normalizeTimelinePayload(payload);
      if (timeline?.info?.frames?.length) return timeline;
    } catch {
      // The client exposes timeline differently depending on patch/platform.
    }
  }
  return null;
}

function timelineFrames(timeline) {
  return timeline?.info?.frames || timeline?.frames || [];
}

function csAtMinuteFromTimeline(timeline, participantId, minute) {
  const frames = timelineFrames(timeline);
  const target = Number(minute || 0) * 60 * 1000;
  if (!participantId || !frames.length) return null;
  const frame = frames.find((item) => Number(item.timestamp || 0) >= target) || frames[frames.length - 1];
  const participantFrame = frame?.participantFrames?.[String(participantId)] || frame?.participantFrames?.[participantId];
  if (!participantFrame) return null;
  return Number(participantFrame.minionsKilled || 0) + Number(participantFrame.jungleMinionsKilled || 0);
}

function wardEventsFromTimeline(match, timeline) {
  const participants = match?.info?.participants || [];
  const participantTeam = new Map(participants.map((participant) => [Number(participant.participantId), Number(participant.teamId)]));
  return timelineFrames(timeline).flatMap((frame) => (frame.events || [])
    .filter((event) => event.type === 'WARD_PLACED' && event.position)
    .map((event) => ({
      timestamp: Number(event.timestamp || 0),
      minute: Number((Number(event.timestamp || 0) / 60000).toFixed(1)),
      creatorId: Number(event.creatorId || 0),
      teamId: Number(participantTeam.get(Number(event.creatorId)) || 0),
      wardType: String(event.wardType || 'WARD'),
      x: Number(event.position.x || 0),
      y: Number(event.position.y || 0),
      normalizedX: Number(Math.max(0, Math.min(1, Number(event.position.x || 0) / 15000)).toFixed(4)),
      normalizedY: Number(Math.max(0, Math.min(1, Number(event.position.y || 0) / 15000)).toFixed(4))
    })));
}

function buildTimelineSummary(match, timeline) {
  if (!timeline?.info?.frames?.length && !timeline?.frames?.length) {
    return { available: false, csMilestones: {}, wards: [], wardCount: 0 };
  }
  const csMilestones = {};
  for (const participant of match?.info?.participants || []) {
    csMilestones[String(participant.participantId)] = {
      participantId: Number(participant.participantId || 0),
      champion: participant.championName || '',
      summonerName: participant.summonerName || participant.riotIdGameName || '',
      cs10: csAtMinuteFromTimeline(timeline, participant.participantId, 10),
      cs20: csAtMinuteFromTimeline(timeline, participant.participantId, 20)
    };
  }
  const wards = wardEventsFromTimeline(match, timeline);
  return {
    available: true,
    frameCount: timelineFrames(timeline).length,
    csMilestones,
    wards,
    wardCount: wards.length
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 880,
    minHeight: 660,
    title: APP_NAME,
    backgroundColor: '#030713',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer.html'));
}

ipcMain.handle('generate-import', async (_event, form) => {
  const extractedInput = extractGameInput(form?.gameId);
  const gameId = normalizeGameId(extractedInput, form?.platform);
  const numericOnly = isNumericGameId(extractedInput);
  const platform = gameId.split('_')[0];
  const params = new URLSearchParams({ gameId, platform, fallback: numericOnly ? '1' : '0' });
  const exportUrl = `${NXT5_SITE_URL}/.netlify/functions/riot-match-export?${params.toString()}`;
  let exported = null;
  let riotError = null;
  try {
    const { response, payload } = await fetchJsonWithTimeout(exportUrl);
    exported = payload;

    if (!response.ok) {
      const rawMessage = exported?.error || exported?.detail || exported?.message || '';
      const message = rawMessage && rawMessage !== 'Bad Request'
        ? rawMessage
        : `NXT5 refuse l'export (${response.status}). Verifie le Game ID, la region et la cle Riot cote Netlify.`;
      throw new Error(message);
    }
  } catch (err) {
    riotError = err;
  }

  if (!exported?.match?.info?.participants || !exported?.match?.info?.teams) {
    if (!numericOnly) {
      throw riotError || new Error('NXT5 a repondu, mais le JSON Riot est incomplet. Reessaie dans quelques instants.');
    }
    const localMatch = await fetchLocalClientMatch(extractedInput, gameId);
    const localTimeline = await fetchLocalClientTimeline(extractedInput);
    exported = { match: localMatch, timeline: localTimeline, source: 'nxt5-lcu-importer' };
  }

  if (!exported?.match?.info?.participants || !exported?.match?.info?.teams) {
    throw new Error('NXT5 a repondu, mais le JSON Riot est incomplet. Reessaie dans quelques instants.');
  }

  const timeline = normalizeTimelinePayload(exported.timeline);
  if (timeline) exported.match.timeline = timeline;
  const timelineSummary = buildTimelineSummary(exported.match, timeline);

  const payload = {
    source: 'nxt5-match-exporter',
    version: 5,
    gameId,
    platform,
    exportedAt: new Date().toISOString(),
    importerSource: exported.source || 'riot-match-v5',
    match: exported.match,
    timeline,
    nxt5: {
      importer: APP_NAME,
      timelineSummary
    }
  };

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer le JSON NXT5',
    defaultPath: `nxt5-${gameId}.json`,
    filters: [{ name: 'NXT5 JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { canceled: false, filePath, gameId };
});

app.setName(APP_NAME);
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
