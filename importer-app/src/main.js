import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import {
  StateStore,
  atomicWrite,
  createImportService,
  normalizeTimelinePayload,
  safeExternalUrl,
  selectUpdate,
  throwIfAborted,
  validateLocalIdentity,
} from "./core.js";
import {
  fetchJson,
  readLeagueLockfile,
  lcuRequest,
  createChampionCatalog,
} from "./network.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = "NXT5 Importer";
const RELEASE_API =
  "https://api.github.com/repos/AshaiiTV/NXT5/releases/tags/nxt5-match-exporter-latest";
const PACKAGE_META = JSON.parse(
  fsSync.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
);
const CURRENT_VERSION = String(PACKAGE_META.version || "0.0.0");
const RENDERER_FILE = path.join(__dirname, "renderer.html");
const RENDERER_URL = pathToFileURL(RENDERER_FILE).toString();
const NXT5_SITE_URL = (() => {
  try {
    const url = new URL(process.env.NXT5_SITE_URL || "https://nxt5.org");
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.origin;
  } catch {
    /* use production */
  }
  return "https://nxt5.org";
})();
const catalog = createChampionCatalog();
let store;
let mainWindow;

function assertTrustedIpcSender(event) {
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || "";
  if (senderUrl !== RENDERER_URL || event.sender !== mainWindow?.webContents)
    throw new Error("IPC sender refused");
}

async function checkImporterUpdate() {
  try {
    const { response, payload } = await fetchJson(RELEASE_API, {
      timeoutMs: 8000,
      maxBytes: 2000000,
    });
    if (!response.ok)
      throw new Error(`Vérification indisponible (${response.status}).`);
    return selectUpdate(
      payload,
      CURRENT_VERSION,
      process.platform,
      process.arch,
    );
  } catch (error) {
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      updateAvailable: false,
      downloadUrl: "",
      platform: process.platform === "darwin" ? "mac" : "windows",
      arch: process.arch,
      checked: false,
      message: error.message,
    };
  }
}

function localPosition(participant) {
  const explicit = String(
    participant.teamPosition || participant.individualPosition || "",
  ).toUpperCase();
  const role = String(participant.timeline?.role || "").toUpperCase();
  const lane = String(
    participant.timeline?.lane || participant.lane || "",
  ).toUpperCase();
  const positions = {
    MID: "MIDDLE",
    MIDDLE: "MIDDLE",
    TOP: "TOP",
    JUNGLE: "JUNGLE",
    JGL: "JUNGLE",
    BOT: "BOTTOM",
    BOTTOM: "BOTTOM",
    ADC: "BOTTOM",
    SUPPORT: "UTILITY",
    UTILITY: "UTILITY",
  };
  if (positions[explicit]) return positions[explicit];
  if (role === "DUO_SUPPORT" || role === "SUPPORT") return "UTILITY";
  if (role === "DUO_CARRY") return "BOTTOM";
  return positions[lane] || "";
}

function lcuWinValue(team) {
  if (typeof team?.win === "boolean") return team.win;
  return ["win", "true", "1"].includes(String(team?.win || "").toLowerCase());
}

async function lcuToRiotMatch(lcuGame, fallbackGameId, signal) {
  const statNumber = (stats, ...keys) => {
    for (const key of keys) {
      const value = Number(stats?.[key] ?? 0);
      if (value) return value;
    }
    return 0;
  };
  const participants = await Promise.all(
    (lcuGame.participants || []).map(async (participant, index) => {
      const identity = (lcuGame.participantIdentities || []).find(
        (item) => item.participantId === participant.participantId,
      );
      const player = identity?.player || {};
      const stats = participant.stats || {};
      const timeline = participant.timeline || {};
      const championName =
        participant.championName ||
        (await catalog.name(participant.championId, signal));
      const riotName =
        player.gameName ||
        player.summonerName ||
        player.displayName ||
        `Player ${index + 1}`;
      const riotTag = player.tagLine || player.tagline || "";
      return {
        ...stats,
        participantId: Number(participant.participantId),
        teamId: Number(participant.teamId),
        summonerName: player.summonerName || riotName,
        riotIdGameName: riotName,
        riotIdTagline: riotTag,
        championId: participant.championId,
        championName,
        teamPosition: localPosition(participant),
        individualPosition: localPosition(participant),
        lane: String(
          timeline.lane || participant.lane || "UNKNOWN",
        ).toUpperCase(),
        kills: Number(stats.kills || 0),
        deaths: Number(stats.deaths || 0),
        assists: Number(stats.assists || 0),
        totalMinionsKilled: Number(
          stats.totalMinionsKilled || stats.minionsKilled || 0,
        ),
        neutralMinionsKilled: Number(stats.neutralMinionsKilled || 0),
        goldEarned: Number(stats.goldEarned || 0),
        totalDamageDealtToChampions: Number(
          stats.totalDamageDealtToChampions || 0,
        ),
        visionScore: Number(stats.visionScore || 0),
        item0: statNumber(stats, "item0", "item0Id"),
        item1: statNumber(stats, "item1", "item1Id"),
        item2: statNumber(stats, "item2", "item2Id"),
        item3: statNumber(stats, "item3", "item3Id"),
        item4: statNumber(stats, "item4", "item4Id"),
        item5: statNumber(stats, "item5", "item5Id"),
        item6: statNumber(
          stats,
          "item6",
          "item6Id",
          "trinket",
          "trinketItemId",
        ),
        summoner1Id:
          statNumber(participant, "summoner1Id", "spell1Id") ||
          statNumber(stats, "summoner1Id", "spell1Id"),
        summoner2Id:
          statNumber(participant, "summoner2Id", "spell2Id") ||
          statNumber(stats, "summoner2Id", "spell2Id"),
        win: lcuWinValue(stats),
      };
    }),
  );

  return {
    metadata: {
      matchId: fallbackGameId,
      source: "lcu-match-history",
    },
    info: {
      gameCreation:
        Number(lcuGame.gameCreation) ||
        Date.parse(lcuGame.gameCreationDate) ||
        0,
      gameDuration: Math.round(
        Number(lcuGame.gameDuration || 0) /
          (Number(lcuGame.gameDuration || 0) > 10000 ? 1000 : 1),
      ),
      gameId: lcuGame.gameId || fallbackGameId,
      gameMode: lcuGame.gameMode || "CLASSIC",
      gameType: lcuGame.gameType || "CUSTOM_GAME",
      gameVersion: lcuGame.gameVersion || "",
      mapId: lcuGame.mapId || 11,
      participants,
      teams: (lcuGame.teams || []).map((team) => ({
        teamId: Number(team.teamId),
        bans: Array.isArray(team.bans) ? team.bans : [],
        win: lcuWinValue(team),
        objectives: {
          baron: { kills: Number(team.baronKills || 0) },
          champion: {
            kills: Number(
              team.championKills ??
                participants
                  .filter(
                    (participant) => participant.teamId === Number(team.teamId),
                  )
                  .reduce((sum, participant) => sum + participant.kills, 0),
            ),
          },
          dragon: { kills: Number(team.dragonKills || 0) },
          riftHerald: { kills: Number(team.riftHeraldKills || 0) },
          inhibitor: { kills: Number(team.inhibitorKills || 0) },
          tower: { kills: Number(team.towerKills || 0) },
        },
      })),
    },
  };
}

function timelineFrames(timeline) {
  return timeline?.info?.frames || timeline?.frames || [];
}

function csAtMinuteFromTimeline(timeline, participantId, minute, gameDuration) {
  const frames = timelineFrames(timeline);
  const target = Number(minute || 0) * 60 * 1000;
  if (
    !participantId ||
    !frames.length ||
    Number(gameDuration || 0) < minute * 60
  )
    return null;
  const frame = frames.find((item) => Number(item.timestamp || 0) >= target);
  const participantFrame =
    frame?.participantFrames?.[String(participantId)] ||
    frame?.participantFrames?.[participantId];
  if (!participantFrame || Number(frame.timestamp) - target > 5000) return null;
  return (
    Number(participantFrame.minionsKilled || 0) +
    Number(participantFrame.jungleMinionsKilled || 0)
  );
}

function wardPositionFromEvent(frame, event, creatorId) {
  const direct = event.position || event;
  const directX = Number(direct.x || direct.positionX || 0);
  const directY = Number(direct.y || direct.positionY || 0);
  if (directX && directY) return { x: directX, y: directY, source: "event" };
  const participantFrame =
    frame?.participantFrames?.[String(creatorId)] ||
    frame?.participantFrames?.[creatorId];
  const framePosition = participantFrame?.position || {};
  const frameX = Number(framePosition.x || 0);
  const frameY = Number(framePosition.y || 0);
  if (frameX && frameY)
    return { x: frameX, y: frameY, source: "participant_frame" };
  return null;
}

function wardEventsFromTimeline(match, timeline) {
  const participants = match?.info?.participants || [];
  const participantTeam = new Map(
    participants.map((participant) => [
      Number(participant.participantId),
      Number(participant.teamId),
    ]),
  );
  return timelineFrames(timeline).flatMap((frame) =>
    (frame.events || [])
      .filter((event) => String(event.type || "") === "WARD_PLACED")
      .map((event) => {
        const creatorId = Number(
          event.creatorId || event.participantId || event.killerId || 0,
        );
        const position = wardPositionFromEvent(frame, event, creatorId);
        if (!position) return null;
        const { x, y } = position;
        return {
          timestamp: Number(event.timestamp || frame.timestamp || 0),
          minute: Number(
            (Number(event.timestamp || frame.timestamp || 0) / 60000).toFixed(
              1,
            ),
          ),
          creatorId,
          teamId: Number(event.teamId || participantTeam.get(creatorId) || 0),
          wardType: String(event.wardType || event.type || "WARD"),
          positionSource: position.source,
          x,
          y,
          normalizedX: Number(Math.max(0, Math.min(1, x / 15000)).toFixed(4)),
          normalizedY: Number(Math.max(0, Math.min(1, y / 15000)).toFixed(4)),
        };
      })
      .filter(Boolean),
  );
}

function buildTimelineSummary(match, timeline) {
  if (!timeline?.info?.frames?.length && !timeline?.frames?.length) {
    return { available: false, csMilestones: {}, wards: [], wardCount: 0 };
  }
  const csMilestones = {};
  for (const participant of match?.info?.participants || []) {
    csMilestones[String(participant.participantId)] = {
      participantId: Number(participant.participantId || 0),
      champion: participant.championName || "",
      summonerName:
        participant.summonerName || participant.riotIdGameName || "",
      cs10: csAtMinuteFromTimeline(
        timeline,
        participant.participantId,
        10,
        match?.info?.gameDuration,
      ),
      cs20: csAtMinuteFromTimeline(
        timeline,
        participant.participantId,
        20,
        match?.info?.gameDuration,
      ),
    };
  }
  const wards = wardEventsFromTimeline(match, timeline);
  return {
    available: true,
    frameCount: timelineFrames(timeline).length,
    csMilestones,
    wards,
    wardCount: wards.length,
  };
}

async function localMatch(gameId, signal, progress) {
  const numericId = gameId.split("_")[1];
  const lockfile = await readLeagueLockfile(
    store.snapshot().settings.leaguePath,
  );
  const get = (endpoint) => lcuRequest(lockfile, endpoint, { signal });
  let game;
  let lastError;
  for (const endpoint of [
    `/lol-match-history/v1/games/${numericId}`,
    `/lol-match-history/v1/game/${numericId}`,
  ]) {
    throwIfAborted(signal);
    try {
      const candidate = await get(endpoint);
      if (
        !Array.isArray(candidate?.participants) ||
        !candidate.participants.length
      )
        throw new Error("La partie ne contient aucun joueur.");
      let region;
      if (!candidate.platformId && !candidate.platform) {
        const locale = await get("/riotclient/region-locale");
        region = locale?.region;
      }
      validateLocalIdentity(candidate, gameId, region);
      game = candidate;
      break;
    } catch (error) {
      throwIfAborted(signal);
      lastError = error;
    }
  }
  if (!game)
    throw lastError || new Error("Partie introuvable dans le client LoL.");
  const match = await lcuToRiotMatch(game, gameId, signal);
  progress?.("Récupération de la timeline depuis le client LoL…");
  let timeline = null;
  for (const endpoint of [
    `/lol-match-history/v1/game-timelines/${numericId}`,
    `/lol-match-history/v1/games/${numericId}/timeline`,
    `/lol-match-history/v1/game/${numericId}/timeline`,
  ]) {
    throwIfAborted(signal);
    try {
      const candidate = normalizeTimelinePayload(await get(endpoint));
      if (candidate?.info?.frames?.length) {
        timeline = candidate;
        break;
      }
    } catch {
      throwIfAborted(signal);
    }
  }
  return { match, timeline, source: "nxt5-lcu-importer" };
}

const importer = createImportService({
  async fetchRemote(gameId, platform, signal) {
    // A numeric ID is only unique within its region. Never search other regions silently.
    const params = new URLSearchParams({ gameId, platform, fallback: "0" });
    const { response, payload } = await fetchJson(
      `${NXT5_SITE_URL}/.netlify/functions/riot-match-export?${params}`,
      { signal },
    );
    if (!response.ok) {
      const detail = payload?.error || payload?.message || payload?.detail;
      throw new Error(
        typeof detail === "string" && detail !== "Bad Request"
          ? detail.slice(0, 500)
          : `Partie indisponible auprès de Riot (${response.status}). Vérifiez le Game ID et la région.`,
      );
    }
    return payload;
  },
  fetchLocal: localMatch,
  buildTimelineSummary,
  chooseSave: async (gameId) =>
    dialog.showSaveDialog(mainWindow, {
      title: "Enregistrer le JSON NXT5",
      defaultPath: await store.getExportPath(gameId, app.getPath("downloads")),
      filters: [{ name: "NXT5 JSON", extensions: ["json"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    }),
  writeFile: atomicWrite,
  addHistory: (entry) => store.addExport(entry),
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 820,
    minHeight: 620,
    title: APP_NAME,
    backgroundColor: "#0b1015",
    icon: path.join(
      __dirname,
      "..",
      "assets",
      process.platform === "win32" ? "icon.ico" : "icon.icns",
    ),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.removeMenu();
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const target = safeExternalUrl(url, NXT5_SITE_URL);
    if (target) shell.openExternal(target).catch(() => {});
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.on("closed", () => {
    importer.cancel();
    mainWindow = null;
  });
  mainWindow.loadFile(RENDERER_FILE);
}

const handlers = {
  "get-app-state": () => ({
    version: CURRENT_VERSION,
    platform: process.platform,
    arch: process.arch,
    siteUrl: NXT5_SITE_URL,
    ...store.snapshot(),
    ...(store.loadWarning ? { warning: store.loadWarning } : {}),
  }),
  async "get-client-status"() {
    try {
      const lockfile = await readLeagueLockfile(
        store.snapshot().settings.leaguePath,
      );
      await lcuRequest(lockfile, "/riotclient/region-locale", {
        timeoutMs: 3000,
        maxBytes: 100000,
      });
      return { connected: true, message: "Client League of Legends détecté." };
    } catch (error) {
      return { connected: false, message: error.message };
    }
  },
  async "choose-league-path"() {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: "Localiser League of Legends",
      message: "Sélectionnez le dossier du jeu ou son fichier lockfile.",
      detail:
        "Le lockfile est créé dans le dossier du jeu lorsque le client est ouvert.",
      buttons: ["Choisir un dossier", "Choisir le lockfile", "Annuler"],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (choice.response === 2) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title:
        choice.response === 0
          ? "Dossier League of Legends"
          : "Fichier lockfile de League of Legends",
      properties:
        choice.response === 0
          ? ["openDirectory", "treatPackageAsDirectory"]
          : ["openFile", "showHiddenFiles"],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const leaguePath = result.filePaths[0];
    if (choice.response === 1 && path.basename(leaguePath) !== "lockfile")
      throw new Error(
        "Sélectionnez le fichier nommé lockfile dans le dossier League of Legends.",
      );
    await store.saveSettings({ leaguePath });
    return { canceled: false, leaguePath };
  },
  "save-settings": (settings) => {
    // Paths are only granted by the native chooser; the renderer may reset one.
    if (settings?.leaguePath !== undefined && settings.leaguePath !== "")
      throw new Error(
        "Utilisez le sélecteur de dossier pour localiser League of Legends.",
      );
    return store.saveSettings(settings);
  },
  "cancel-import": () => importer.cancel(),
  "check-update": checkImporterUpdate,
  async "show-export"(id) {
    const entry = store.snapshot().history.find((item) => item.id === id);
    if (!entry) return false;
    try {
      if (!(await fs.stat(entry.filePath)).isFile()) return false;
      shell.showItemInFolder(entry.filePath);
      return true;
    } catch {
      return false;
    }
  },
  async "open-external"(url) {
    const target = safeExternalUrl(url, NXT5_SITE_URL);
    if (!target) return false;
    await shell.openExternal(target);
    return true;
  },
};
for (const [channel, handler] of Object.entries(handlers))
  ipcMain.handle(channel, (event, value) => {
    assertTrustedIpcSender(event);
    return handler(value);
  });
ipcMain.handle("generate-import", (event, form) => {
  assertTrustedIpcSender(event);
  return importer.generate(form, (progress) => {
    if (!event.sender.isDestroyed())
      event.sender.send("import-progress", progress);
  });
});

app.setName(APP_NAME);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    store = new StateStore(
      path.join(app.getPath("userData"), "preferences.json"),
    );
    await store.load();
    createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (store && BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on("before-quit", () => importer.cancel());
}
