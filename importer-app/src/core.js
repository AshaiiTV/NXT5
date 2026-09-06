import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const PLATFORMS = new Set([
  "EUW1",
  "EUN1",
  "NA1",
  "KR",
  "JP1",
  "BR1",
  "LA1",
  "LA2",
  "OC1",
  "TR1",
  "RU",
  "ME1",
  "PH2",
  "SG2",
  "TH2",
  "TW2",
  "VN2",
]);
const ALIASES = {
  EUW: "EUW1",
  EUNE: "EUN1",
  EUN: "EUN1",
  NA: "NA1",
  JP: "JP1",
  BR: "BR1",
  LAN: "LA1",
  LAS: "LA2",
  OCE: "OC1",
  OC: "OC1",
  TR: "TR1",
  ME: "ME1",
  PH: "PH2",
  SG: "SG2",
  TH: "TH2",
  TW: "TW2",
  VN: "VN2",
};

export function normalizePlatform(value = "EUW1") {
  const raw = String(value).trim().toUpperCase();
  const platform = ALIASES[raw] || raw;
  if (!PLATFORMS.has(platform))
    throw new Error(
      "Région invalide. Sélectionnez le serveur de cette partie.",
    );
  return platform;
}

export function normalizeGameId(value, platform = "EUW1") {
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("Renseignez un Game ID.");
  let raw = String(value).trim().toUpperCase();
  if (raw.length > 2048) throw new Error("Game ID trop long.");
  const full = raw.match(/\b([A-Z0-9]{2,5})[_-](\d{6,20})\b/);
  if (full) raw = `${full[1]}_${full[2]}`;
  const match = raw.match(/^(?:([A-Z0-9]{2,5})_)?(\d{6,20})$/);
  if (!match || /^0+$/.test(match[2]))
    throw new Error(
      "Game ID invalide. Exemple : 7861632138 ou EUW1_7861632138.",
    );
  return `${normalizePlatform(match[1] || platform)}_${match[2]}`;
}

export function abortError() {
  return Object.assign(new Error("Import annulé."), { name: "AbortError" });
}
export function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function declaredIds(match) {
  return [match?.metadata?.matchId, match?.metadata?.gameId].filter(
    (id) => id !== undefined && id !== null,
  );
}

export function validateMatch(match, requestedId) {
  const participants = match?.info?.participants;
  const teams = match?.info?.teams;
  if (
    !Array.isArray(participants) ||
    participants.length !== 10 ||
    !Array.isArray(teams) ||
    teams.length !== 2
  ) {
    throw new Error(
      "Cette partie doit contenir deux équipes de cinq joueurs pour être importée dans NXT5.",
    );
  }
  const expected = normalizeGameId(requestedId);
  const ids = declaredIds(match);
  if (!ids.some((id) => String(id).toUpperCase() === expected))
    throw new Error(
      "L’identité de la partie reçue ne correspond pas au Game ID demandé.",
    );
  if (
    ids.some(
      (id) => String(id).includes("_") && String(id).toUpperCase() !== expected,
    )
  )
    throw new Error("La réponse contient des Game IDs contradictoires.");
  if (
    match.info.gameId !== undefined &&
    String(match.info.gameId) !== expected.split("_")[1] &&
    String(match.info.gameId).toUpperCase() !== expected
  )
    throw new Error(
      "Le numéro de la partie reçue ne correspond pas au Game ID demandé.",
    );
  const teamIds = new Set(teams.map((team) => team?.teamId));
  if (
    !teamIds.has(100) ||
    !teamIds.has(200) ||
    teams.some((team) => typeof team.win !== "boolean")
  )
    throw new Error(
      "Les équipes ou le résultat de la partie reçue sont invalides.",
    );
  const integer = (value, minimum = 0) =>
    (typeof value === "number" || typeof value === "string") &&
    String(value).trim() &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) >= minimum &&
    Number(value) <= 2147483647;
  const statKeys = [
    "kills",
    "deaths",
    "assists",
    "totalMinionsKilled",
    "neutralMinionsKilled",
    "goldEarned",
    "totalDamageDealtToChampions",
    "visionScore",
    "damageDealtToTurrets",
    "damageToTurrets",
    "damage_to_turrets",
    "item0",
    "item0Id",
    "item1",
    "item1Id",
    "item2",
    "item2Id",
    "item3",
    "item3Id",
    "item4",
    "item4Id",
    "item5",
    "item5Id",
    "item6",
    "item6Id",
    "trinket",
    "trinketItemId",
    "summoner1Id",
    "spell1Id",
    "summoner2Id",
    "spell2Id",
  ];
  for (const team of teams)
    for (const objective of Object.values(team.objectives || {}))
      if (objective?.kills !== undefined && !integer(objective.kills))
        throw new Error("Les objectifs de la partie reçue sont invalides.");
  const participantIds = new Set();
  for (const participant of participants) {
    if (
      !Number.isInteger(participant?.participantId) ||
      participant.participantId <= 0 ||
      participant.participantId > 10 ||
      participantIds.has(participant.participantId) ||
      !teamIds.has(participant.teamId)
    )
      throw new Error("Les joueurs de la partie reçue sont invalides.");
    if (
      typeof participant.championName !== "string" ||
      !participant.championName.trim()
    )
      throw new Error("Un champion est absent de la partie reçue.");
    for (const stats of [participant, participant.stats].filter(Boolean)) {
      if (
        typeof stats !== "object" ||
        Array.isArray(stats) ||
        statKeys.some((key) => stats[key] !== undefined && !integer(stats[key]))
      )
        throw new Error("Les statistiques de la partie reçue sont invalides.");
    }
    if (
      !integer(
        Number(participant.totalMinionsKilled || 0) +
          Number(participant.neutralMinionsKilled || 0),
      )
    )
      throw new Error("Le score de sbires de la partie reçue est invalide.");
    participantIds.add(participant.participantId);
  }
  if (
    [100, 200].some(
      (teamId) =>
        participants.filter((participant) => participant.teamId === teamId)
          .length !== 5,
    )
  )
    throw new Error("Chaque équipe doit contenir cinq joueurs.");
  if (!integer(match.info.gameDuration, 1))
    throw new Error("La durée de la partie reçue est invalide.");
  const pending = Object.entries(match)
    .filter(([key]) => key !== "timeline")
    .map(([, value]) => value);
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("La partie contient un nombre invalide.");
    if (value && typeof value === "object")
      for (const child of Object.values(value)) pending.push(child);
  }
  return match;
}

export function validateLocalIdentity(game, requestedId, clientRegion) {
  const [platform, numericId] = requestedId.split("_");
  if (String(game?.gameId) !== numericId)
    throw new Error(
      "Le client LoL a renvoyé une autre partie. Rouvrez la partie demandée dans son historique.",
    );
  let actualPlatform;
  try {
    actualPlatform = normalizePlatform(
      game?.platformId || game?.platform || clientRegion,
    );
  } catch {
    /* explicit error below */
  }
  if (!game?.platformId && !game?.platform && !clientRegion)
    actualPlatform = undefined;
  if (!actualPlatform)
    throw new Error(
      "Impossible de vérifier la région du client LoL. Vérifiez que le client est connecté.",
    );
  if (actualPlatform !== platform)
    throw new Error(
      `Cette partie du client LoL appartient à ${actualPlatform}, mais ${platform} est demandé.`,
    );
}

export function normalizeTimelinePayload(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value.info?.frames)) return value;
  if (Array.isArray(value.frames)) {
    const { frames, ...rest } = value;
    return { ...rest, info: { ...(value.info || {}), frames } };
  }
  if (value.timeline) return normalizeTimelinePayload(value.timeline);
  if (value.gameTimeline) return normalizeTimelinePayload(value.gameTimeline);
  return null;
}

export function validatedTimeline(value, match, requestedId) {
  const timeline = normalizeTimelinePayload(value);
  if (!timeline?.info?.frames?.length) return null;
  if (
    timeline.metadata?.matchId &&
    String(timeline.metadata.matchId).toUpperCase() !== requestedId
  )
    throw new Error("La timeline reçue appartient à une autre partie.");
  if (
    timeline.gameId !== undefined &&
    String(timeline.gameId) !== requestedId.split("_")[1] &&
    String(timeline.gameId).toUpperCase() !== requestedId
  )
    throw new Error("La timeline reçue appartient à une autre partie.");
  const validIds = new Set(
    match.info.participants.map((participant) => participant.participantId),
  );
  const numeric = (value) =>
    (typeof value === "number" || typeof value === "string") &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value));
  const positionValid = (position) =>
    !position ||
    (typeof position === "object" &&
      ["x", "y"].every(
        (key) => position[key] === undefined || numeric(position[key]),
      ));
  let previous = -1;
  for (const frame of timeline.info.frames) {
    if (
      !frame ||
      !numeric(frame.timestamp) ||
      Number(frame.timestamp) < 0 ||
      Number(frame.timestamp) < previous ||
      !frame.participantFrames ||
      typeof frame.participantFrames !== "object" ||
      Array.isArray(frame.participantFrames)
    )
      throw new Error("La timeline reçue est incomplète.");
    if (
      Object.keys(frame.participantFrames).some(
        (id) => !validIds.has(Number(id)),
      )
    )
      throw new Error("La timeline contient des joueurs inconnus.");
    if (
      Object.values(frame.participantFrames).some(
        (participant) =>
          !participant ||
          typeof participant !== "object" ||
          Array.isArray(participant),
      )
    )
      throw new Error("Les données des joueurs de la timeline sont invalides.");
    if (
      frame.events !== undefined &&
      (!Array.isArray(frame.events) ||
        frame.events.some(
          (event) =>
            !event || typeof event !== "object" || Array.isArray(event),
        ))
    )
      throw new Error("Les événements de la timeline sont invalides.");
    for (const [id, participant] of Object.entries(frame.participantFrames)) {
      if (
        participant.participantId !== undefined &&
        Number(participant.participantId) !== Number(id)
      )
        throw new Error(
          "Les identifiants des joueurs de la timeline sont contradictoires.",
        );
      if (
        !positionValid(participant.position) ||
        ["minionsKilled", "jungleMinionsKilled"].some(
          (key) =>
            participant[key] !== undefined &&
            (!numeric(participant[key]) ||
              !Number.isInteger(Number(participant[key])) ||
              Number(participant[key]) < 0),
        )
      )
        throw new Error("Les statistiques de la timeline sont invalides.");
    }
    for (const event of frame.events || []) {
      if (
        (event.timestamp !== undefined &&
          (!numeric(event.timestamp) || Number(event.timestamp) < 0)) ||
        !positionValid(event.position) ||
        ["x", "y", "positionX", "positionY"].some(
          (key) => event[key] !== undefined && !numeric(event[key]),
        )
      )
        throw new Error(
          "Les coordonnées ou les dates de la timeline sont invalides.",
        );
    }
    previous = Number(frame.timestamp);
  }
  const pending = [timeline];
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("La timeline contient un nombre invalide.");
    if (value && typeof value === "object")
      for (const child of Object.values(value)) pending.push(child);
  }
  return timeline;
}

export async function atomicWrite(filePath, contents) {
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, filePath);
  } finally {
    await handle?.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
  }
}

function cleanState(value) {
  let platform = "EUW1";
  try {
    platform = normalizePlatform(value?.settings?.platform || "EUW1");
  } catch {
    /* defaults */
  }
  const leaguePath =
    typeof value?.settings?.leaguePath === "string" &&
    value.settings.leaguePath.length < 4096
      ? value.settings.leaguePath
      : "";
  const history = Array.isArray(value?.history)
    ? value.history
        .filter(
          (entry) =>
            entry &&
            typeof entry.id === "string" &&
            typeof entry.filePath === "string" &&
            path.isAbsolute(entry.filePath) &&
            /\.json$/i.test(entry.filePath) &&
            typeof entry.exportedAt === "string" &&
            Number.isFinite(Date.parse(entry.exportedAt)) &&
            typeof entry.gameId === "string" &&
            /^[A-Z0-9]+_\d+$/.test(entry.gameId) &&
            Number.isFinite(entry.participantCount) &&
            Number.isFinite(entry.duration),
        )
        .slice(0, 30)
        .map((entry) => ({
          id: entry.id,
          gameId: entry.gameId,
          filePath: entry.filePath,
          exportedAt: entry.exportedAt,
          participantCount: entry.participantCount,
          duration: entry.duration,
          timelineAvailable: entry.timelineAvailable === true,
          source: String(entry.source || ""),
        }))
    : [];
  return { settings: { platform, leaguePath }, history };
}

export class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.value = cleanState(null);
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      if ((await fs.stat(this.filePath)).size > 1024 * 1024)
        throw new Error("Preferences too large");
      this.value = cleanState(
        JSON.parse(await fs.readFile(this.filePath, "utf8")),
      );
    } catch (error) {
      if (error.code !== "ENOENT")
        this.loadWarning =
          "Les préférences locales n’ont pas pu être relues. Les valeurs par défaut sont utilisées.";
    }
    return this.snapshot();
  }
  snapshot() {
    return structuredClone(this.value);
  }
  update(transform) {
    const operation = this.queue.then(async () => {
      const next = cleanState(transform(this.snapshot()));
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await atomicWrite(this.filePath, JSON.stringify(next, null, 2));
      this.value = next;
      return this.snapshot();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  saveSettings(settings) {
    const updates = {};
    if (settings?.platform !== undefined)
      updates.platform = normalizePlatform(settings.platform);
    if (settings?.leaguePath !== undefined) {
      if (
        typeof settings.leaguePath !== "string" ||
        settings.leaguePath.length >= 4096 ||
        (settings.leaguePath && !path.isAbsolute(settings.leaguePath))
      )
        throw new Error("Chemin du client LoL invalide.");
      updates.leaguePath = settings.leaguePath;
    }
    return this.update((state) => ({
      ...state,
      settings: { ...state.settings, ...updates },
    })).then((state) => state.settings);
  }
  addExport(entry) {
    return this.update((state) => ({
      ...state,
      history: [
        entry,
        ...state.history.filter((item) => item.filePath !== entry.filePath),
      ].slice(0, 30),
    }));
  }
}

export function compareVersions(a, b) {
  const left = String(a).split(".").map(Number),
    right = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return delta;
  }
  return 0;
}

export function selectUpdate(payload, currentVersion, platform, arch) {
  const expected =
    platform === "darwin" && ["arm64", "x64"].includes(arch)
      ? new RegExp(
          `^NXT5-Importer-Mac-${arch}-(\\d+\\.\\d+\\.\\d+)\\.zip$`,
          "i",
        )
      : platform === "win32" && arch === "x64"
        ? /^NXT5-Importer-Windows-(\d+\.\d+\.\d+)\.exe$/i
        : null;
  const candidates = (Array.isArray(payload?.assets) ? payload.assets : [])
    .flatMap((asset) => {
      const match = expected?.exec(String(asset?.name || ""));
      if (!match) return [];
      try {
        const url = new URL(asset.browser_download_url);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "github.com" ||
          url.username ||
          url.password ||
          url.port ||
          !url.pathname.startsWith("/AshaiiTV/NXT5/releases/download/") ||
          decodeURIComponent(url.pathname.split("/").at(-1)) !== asset.name
        )
          return [];
        return [{ version: match[1], url: url.href }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => compareVersions(b.version, a.version));
  const latest = candidates[0];
  return {
    currentVersion,
    latestVersion: latest?.version || currentVersion,
    updateAvailable:
      !!latest && compareVersions(latest.version, currentVersion) > 0,
    downloadUrl: latest?.url || "",
    platform:
      platform === "darwin"
        ? "mac"
        : platform === "win32"
          ? "windows"
          : platform,
    arch,
    checked: !!latest,
    ...(!latest
      ? {
          message:
            "Aucune version compatible avec votre système n’est disponible dans cette publication.",
        }
      : {}),
  };
}

export function safeExternalUrl(value, siteUrl) {
  try {
    const url = new URL(String(value));
    const site = new URL(siteUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return "";
    if (url.origin === site.origin) return url.href;
    if (
      url.hostname === "github.com" &&
      (url.pathname === "/AshaiiTV/NXT5" ||
        url.pathname === "/AshaiiTV/NXT5/releases" ||
        url.pathname.startsWith("/AshaiiTV/NXT5/releases/"))
    )
      return url.href;
  } catch {
    /* reject malformed destinations */
  }
  return "";
}

export function createImportService(deps) {
  let controller = null;
  return {
    cancel() {
      if (!controller) return { canceled: false };
      controller.abort();
      return { canceled: true };
    },
    async generate(form, progress = () => {}) {
      if (controller)
        throw new Error(
          "Un import est déjà en cours. Attendez sa fin ou annulez-le.",
        );
      controller = new AbortController();
      const signal = controller.signal;
      const report = (stage, message) => {
        throwIfAborted(signal);
        progress({ stage, message });
      };
      try {
        report("validate", "Vérification du Game ID et de la région…");
        const gameId = normalizeGameId(form?.gameId, form?.platform);
        const platform = gameId.split("_")[0];
        const warnings = [];
        let exported;
        report("fetch", "Récupération de la partie auprès de Riot…");
        try {
          exported = await deps.fetchRemote(gameId, platform, signal);
          validateMatch(exported?.match, gameId);
          if (
            exported.gameId &&
            String(exported.gameId).toUpperCase() !== gameId
          )
            throw new Error("Le serveur a renvoyé une autre partie.");
        } catch (remoteError) {
          throwIfAborted(signal);
          report(
            "fetch",
            "Recherche de la partie dans le client League of Legends…",
          );
          try {
            exported = await deps.fetchLocal(gameId, signal, (message) =>
              report("timeline", message),
            );
            validateMatch(exported?.match, gameId);
          } catch (localError) {
            throwIfAborted(signal);
            throw new Error(`${remoteError.message}\n${localError.message}`);
          }
          warnings.push(
            "Partie récupérée depuis le client LoL. Certaines statistiques peuvent être moins détaillées.",
          );
        }
        report("timeline", "Vérification de la timeline et des statistiques…");
        let timeline = null;
        try {
          timeline = validatedTimeline(
            exported.timeline || exported.match.timeline,
            exported.match,
            gameId,
          );
        } catch (error) {
          warnings.push(`${error.message} Elle a été exclue de l’export.`);
        }
        if (!timeline)
          warnings.push(
            "Timeline indisponible : la partie reste importable, sans CS à 10/20 minutes ni positions de wards.",
          );
        // Keep a single timeline in the v5 envelope to respect the website's upload limit.
        delete exported.match.timeline;
        const timelineSummary = deps.buildTimelineSummary(
          exported.match,
          timeline,
        );
        const estimatedWards =
          timelineSummary.wards?.filter(
            (ward) => ward.positionSource === "participant_frame",
          ).length || 0;
        if (estimatedWards)
          warnings.push(
            `${estimatedWards} position${estimatedWards > 1 ? "s" : ""} de ward estimée${estimatedWards > 1 ? "s" : ""} à partir de la position du joueur dans la timeline.`,
          );
        const exportedAt = new Date().toISOString();
        const summary = {
          participantCount: exported.match.info.participants.length,
          duration: Number(exported.match.info.gameDuration),
          timelineAvailable: !!timeline,
          source: exported.source || "riot-match-v5",
        };
        const payload = {
          source: "nxt5-match-exporter",
          version: 5,
          gameId,
          platform,
          requestedGameId: gameId,
          exportedAt,
          importerSource: summary.source,
          match: exported.match,
          timeline,
          nxt5: { importer: "NXT5 Importer", timelineSummary },
        };
        const serialized = JSON.stringify(payload);
        if (Buffer.byteLength(serialized, "utf8") > 4.75 * 1024 * 1024)
          throw new Error(
            "Cette partie dépasse la limite d’import de NXT5 (5 Mo). Aucun fichier inutilisable n’a été créé.",
          );
        report("save", "Choisissez où enregistrer votre fichier JSON…");
        const destination = await deps.chooseSave(gameId);
        throwIfAborted(signal);
        if (destination.canceled || !destination.filePath)
          return { canceled: true };
        const filePath = /\.json$/i.test(destination.filePath)
          ? destination.filePath
          : `${destination.filePath}.json`;
        await deps.writeFile(filePath, serialized);
        const id = randomUUID();
        let historyId;
        try {
          await deps.addHistory({
            id,
            gameId,
            filePath,
            exportedAt,
            ...summary,
          });
          historyId = id;
        } catch {
          warnings.push(
            "Le fichier a été enregistré, mais l’historique local n’a pas pu être mis à jour.",
          );
        }
        // Once the file is committed, report success even if a late cancellation arrived.
        progress({
          stage: "complete",
          message: "Votre fichier JSON est prêt à être importé dans NXT5.",
        });
        return {
          canceled: false,
          filePath,
          gameId,
          ...(historyId ? { historyId } : {}),
          summary,
          warnings,
        };
      } catch (error) {
        if (signal.aborted || error?.name === "AbortError")
          return { canceled: true };
        throw error;
      } finally {
        controller = null;
      }
    },
  };
}
