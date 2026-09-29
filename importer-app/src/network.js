import https from "node:https";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { abortError, throwIfAborted } from "./core.js";

const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;

export async function fetchJson(
  url,
  {
    signal,
    timeoutMs = 15000,
    maxBytes = MAX_RESPONSE_BYTES,
    fetchImpl = fetch,
  } = {},
) {
  throwIfAborted(signal);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let reader;
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "NXT5-Importer" },
    });
    if (Number(response.headers.get("content-length")) > maxBytes)
      throw new Error("La réponse du serveur est trop volumineuse.");
    reader = response.body?.getReader();
    let body = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes)
          throw new Error("La réponse du serveur est trop volumineuse.");
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    }
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error(
        `Réponse JSON invalide du serveur (${response.status}). Réessaie dans quelques instants.`,
      );
    }
    return { response, payload };
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timedOut)
      throw new Error(
        `Le serveur n’a pas répondu après ${Math.round(timeoutMs / 1000)} secondes. Vérifie ta connexion puis réessaie.`,
      );
    if (error instanceof TypeError)
      throw new Error(
        "Connexion au serveur impossible. Vérifie ta connexion Internet.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    await reader?.cancel().catch(() => {});
    controller.abort();
  }
}

async function readSmallText(filePath, maxBytes = 65536) {
  if ((await fs.stat(filePath)).size > maxBytes)
    throw new Error("File too large");
  return fs.readFile(filePath, "utf8");
}

// The Riot Client records where each game is installed, including other drives (D:\, E:\…).
export async function riotInstallDirectories(
  programData = process.platform === "win32"
    ? process.env.ProgramData || "C:\\ProgramData"
    : "",
) {
  if (!programData) return [];
  const riot = path.join(programData, "Riot Games");
  const directories = [];
  try {
    const installs = JSON.parse(
      await readSmallText(path.join(riot, "RiotClientInstalls.json")),
    );
    directories.push(...Object.keys(installs?.associated_client || {}));
  } catch {
    /* optional Riot Client metadata */
  }
  try {
    const settings = await readSmallText(
      path.join(
        riot,
        "Metadata",
        "league_of_legends.live",
        "league_of_legends.live.product_settings.yaml",
      ),
    );
    const install = settings.match(
      /^\s*product_install_full_path:\s*["']?(.+?)["']?\s*$/m,
    );
    if (install) directories.unshift(install[1]);
  } catch {
    /* optional Riot Client metadata */
  }
  return directories
    .filter((directory) => directory && directory.length < 1024)
    .slice(0, 10);
}

export function lockfileCandidates(customPath = "", installDirectories = []) {
  const choices = [
    customPath,
    process.env.LEAGUE_LOCKFILE,
    ...installDirectories,
    "/Applications/League of Legends.app/Contents/LoL/lockfile",
    path.join(
      os.homedir(),
      "Applications/League of Legends.app/Contents/LoL/lockfile",
    ),
    "C:\\Riot Games\\League of Legends\\lockfile",
    "C:\\Program Files\\Riot Games\\League of Legends\\lockfile",
    "C:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile",
  ];
  return [
    ...new Set(
      choices
        .filter(Boolean)
        .flatMap((candidate) => [
          candidate,
          path.join(candidate, "lockfile"),
          path.join(candidate, "Contents", "LoL", "lockfile"),
          path.join(candidate, "League of Legends", "lockfile"),
          path.join(
            candidate,
            "League of Legends.app",
            "Contents",
            "LoL",
            "lockfile",
          ),
        ]),
    ),
  ];
}

export function parseLockfile(content) {
  const fields = String(content).trim().split(":");
  const port = Number(fields[2]);
  if (
    fields.length !== 5 ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !fields[3] ||
    fields[3].length > 1024 ||
    fields[4] !== "https"
  )
    throw new Error("Le lockfile du client LoL est invalide.");
  return { port, password: fields[3], protocol: fields[4] };
}

export async function readLeagueLockfile(
  customPath = "",
  installDirectories = riotInstallDirectories,
) {
  for (const candidate of lockfileCandidates(
    customPath,
    await installDirectories(),
  )) {
    try {
      const stat = await fs.stat(candidate);
      if (!stat.isFile() || stat.size > 4096) continue;
      return {
        ...parseLockfile(await fs.readFile(candidate, "utf8")),
        filePath: candidate,
      };
    } catch {
      /* try next installation path */
    }
  }
  throw new Error(
    "Client LoL introuvable. Ouvre League of Legends ou indique son dossier dans les Paramètres.",
  );
}

export function lcuRequest(
  lockfile,
  endpoint,
  {
    signal,
    timeoutMs = 5000,
    maxBytes = MAX_RESPONSE_BYTES,
    requestImpl = https.request,
  } = {},
) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let finished = false;
    let request;
    let responseStream;
    const complete = (error, payload) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (error) {
        responseStream?.destroy();
        request?.destroy();
        reject(error);
      } else resolve(payload);
    };
    const onAbort = () => complete(abortError());
    const timer = setTimeout(
      () =>
        complete(
          new Error(
            "Le client LoL ne répond pas. Ouvre son historique de parties puis réessaie.",
          ),
        ),
      timeoutMs,
    );
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      request = requestImpl(
        {
          hostname: "127.0.0.1",
          port: lockfile.port,
          path: endpoint,
          method: "GET",
          rejectUnauthorized: false,
          headers: {
            Authorization: `Basic ${Buffer.from(`riot:${lockfile.password}`).toString("base64")}`,
            Accept: "application/json",
          },
        },
        (response) => {
          responseStream = response;
          let body = "";
          let bytes = 0;
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > maxBytes) {
              complete(
                new Error("La réponse du client LoL est trop volumineuse."),
              );
              return;
            }
            body += chunk;
          });
          response.on("error", (error) => complete(error));
          response.on("aborted", () =>
            complete(new Error("Le client LoL a interrompu la réponse.")),
          );
          response.on("end", () => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
              complete(
                new Error(
                  `Partie indisponible dans le client LoL (${response.statusCode}).`,
                ),
              );
              return;
            }
            try {
              complete(null, body ? JSON.parse(body) : null);
            } catch {
              complete(
                new Error("Le client LoL a renvoyé des données invalides."),
              );
            }
          });
        },
      );
      request.on("error", (error) =>
        complete(
          new Error(
            `Connexion au client LoL impossible (${error.code || "erreur réseau"}).`,
          ),
        ),
      );
      request.end();
    } catch (error) {
      complete(error);
    }
  });
}

// Riot's internal champion names ("MonkeyKing", "DrMundo"), as in match-v5 championName.
const isChampionAlias = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_]{1,40}$/.test(value);

// The client's own catalog works offline and always matches the installed patch.
export async function lcuChampionNames(
  lockfile,
  { signal, request = lcuRequest } = {},
) {
  const payload = await request(
    lockfile,
    "/lol-game-data/assets/v1/champion-summary.json",
    { signal, timeoutMs: 5000, maxBytes: 2000000 },
  );
  const names = new Map();
  for (const champion of Array.isArray(payload) ? payload : [])
    if (Number(champion?.id) > 0 && isChampionAlias(champion.alias))
      names.set(String(champion.id), champion.alias);
  return names;
}

export function createChampionCatalog(getJson = fetchJson) {
  const names = new Map();
  let pending = null;
  let retryAt = 0;
  async function load(signal) {
    if (names.size || Date.now() < retryAt) return;
    if (!pending) {
      pending = (async () => {
        const versions = await getJson(
          "https://ddragon.leagueoflegends.com/api/versions.json",
          { signal, timeoutMs: 5000, maxBytes: 100000 },
        );
        const version = versions.payload?.[0];
        if (!versions.response.ok || !/^\d+\.\d+\.\d+$/.test(version))
          throw new Error("Catalogue champions indisponible.");
        const catalog = await getJson(
          `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
          { signal, timeoutMs: 5000, maxBytes: 3000000 },
        );
        if (!catalog.response.ok)
          throw new Error("Catalogue champions indisponible.");
        // Display names ("Wukong", "Dr. Mundo") would split the site's stats from Riot imports.
        for (const champion of Object.values(catalog.payload?.data || {}))
          if (champion?.key && isChampionAlias(champion.id))
            names.set(String(champion.key), champion.id);
      })()
        .catch(() => {
          if (!signal?.aborted) retryAt = Date.now() + 60000;
        })
        .finally(() => {
          pending = null;
        });
    }
    await pending;
    throwIfAborted(signal);
  }
  return {
    async name(id, signal) {
      await load(signal);
      return names.get(String(id)) || "";
    },
  };
}
