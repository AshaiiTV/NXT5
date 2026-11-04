import fs from "node:fs/promises";
import path from "node:path";
import { atomicWrite, normalizeGameId, throwIfAborted } from "./core.js";

/** Automatic collection: one team link, games observed in the LoL client, a retrying send queue. */
const MAX_GAMES = 50;
const CAPTURE_ATTEMPTS = 18;
const BACKOFF_MS = [60_000, 120_000, 300_000, 900_000, 1_800_000, 3_600_000];
const END_PHASES = new Set(["WaitingForStats", "PreEndOfGame", "EndOfGame", "Lobby", "None", "Matchmaking", "ChampSelect", "ReadyCheck"]);
const TOKEN = /^ti_[a-f0-9]{64}$/;

function cleanLink(value) {
  if (!value || typeof value !== "object" || !TOKEN.test(String(value.token || ""))) return null;
  return {
    token: value.token,
    linkId: String(value.linkId || ""),
    teamId: String(value.teamId || ""),
    teamName: String(value.teamName || "").slice(0, 120),
    teamTag: String(value.teamTag || "").slice(0, 16),
    label: String(value.label || "").slice(0, 80),
    expiresAt: String(value.expiresAt || ""),
    linkedAt: String(value.linkedAt || ""),
    verifiedAt: String(value.verifiedAt || ""),
    invalidReason: String(value.invalidReason || ""),
    roster: Array.isArray(value.roster) ? value.roster.slice(0, 30).map((player) => ({ riotId: String(player?.riotId || ""), role: String(player?.role || "") })) : [],
  };
}
function cleanGame(value) {
  if (!value || typeof value !== "object" || !/^[A-Z0-9]+_\d+$/.test(String(value.gameId || ""))) return null;
  const status = ["queued", "sending", "sent", "failed", "unauthorized"].includes(value.status) ? value.status : "queued";
  return {
    gameId: value.gameId,
    status: status === "sending" ? "queued" : status,
    attempts: Number.isInteger(value.attempts) ? value.attempts : 0,
    nextAttemptAt: Number.isFinite(value.nextAttemptAt) ? value.nextAttemptAt : 0,
    capturedAt: String(value.capturedAt || ""),
    sentAt: String(value.sentAt || ""),
    lastError: String(value.lastError || "").slice(0, 300),
    result: value.result && typeof value.result === "object" ? { status: String(value.result.status || ""), reason: String(value.result.reason || "").slice(0, 300), matchId: String(value.result.matchId || "") } : null,
    duration: Number.isFinite(value.duration) ? value.duration : 0,
    timelineAvailable: value.timelineAvailable === true,
  };
}
function cleanState(value) {
  return {
    link: cleanLink(value?.link),
    games: Array.isArray(value?.games) ? value.games.map(cleanGame).filter(Boolean).slice(0, MAX_GAMES) : [],
  };
}
function userMessage(status, payload, fallback) {
  const message = typeof payload?.error === "string" && payload.error.trim() ? payload.error.trim() : fallback;
  return `${message}${status ? ` (${status})` : ""}`;
}

export function createCollector({
  filePath,
  payloadDirectory,
  siteUrl,
  platform = () => "EUW1",
  fetchImpl = fetch,
  readLockfile,
  lcuRequest,
  fetchLocal,
  buildTimelineSummary = () => ({}),
  now = () => Date.now(),
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (handle) => clearTimeout(handle),
  pollIntervalMs = 10_000,
  onChange = () => {},
  appVersion = "0.0.0",
}) {
  let state = cleanState(null);
  let queue = Promise.resolve();
  let active = false;
  let timer = null;
  let polling = false;
  let flushing = false;
  let phase = "idle";
  let clientMessage = "";
  let currentGame = "";
  const observed = new Map();
  const captures = new Map();
  let controller = null;

  async function persist(transform) {
    const operation = queue.then(async () => {
      state = cleanState(transform(structuredClone(state)));
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await atomicWrite(filePath, JSON.stringify(state, null, 2));
      onChange(snapshot());
    });
    queue = operation.catch(() => {});
    return operation;
  }
  function endpoint(name) {
    return `${siteUrl}/.netlify/functions/${name}`;
  }
  async function request(name, { method = "GET", body, token, idempotencyKey, timeoutMs = 20_000, signal } = {}) {
    throwIfAborted(signal);
    const abort = new AbortController();
    let timedOut = false;
    const onAbort = () => abort.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const handle = setTimeout(() => { timedOut = true; abort.abort(); }, timeoutMs);
    try {
      const response = await fetchImpl(endpoint(name), {
        method,
        signal: abort.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": `NXT5-Importer/${appVersion}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
      return { status: response.status, ok: response.ok, payload };
    } catch (error) {
      if (signal?.aborted) throw error;
      const reason = timedOut ? "NXT5 n’a pas répondu à temps." : "Connexion à NXT5 impossible. Vérifie ta connexion Internet.";
      throw Object.assign(new Error(reason), { network: true });
    } finally {
      clearTimeout(handle);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  function payloadPath(gameId) {
    return path.join(payloadDirectory, `${gameId}.json`);
  }
  function snapshot() {
    const link = state.link ? { ...state.link, token: undefined, linked: true } : null;
    return {
      linked: Boolean(state.link),
      link,
      active,
      phase,
      clientMessage,
      currentGame,
      games: state.games.map((game) => ({ ...game })),
      pending: state.games.filter((game) => game.status === "queued").length,
    };
  }
  function setPhase(nextPhase, message = "", game = "") {
    if (phase === nextPhase && clientMessage === message && currentGame === game) return;
    phase = nextPhase; clientMessage = message; currentGame = game;
    onChange(snapshot());
  }

  async function connect(code, label) {
    const cleanCode = String(code || "").replace(/[\s-]/g, "").toUpperCase();
    if (!/^[A-F0-9]{24}$/.test(cleanCode)) throw new Error("Colle le code complet généré dans NXT5 (24 caractères).");
    const { status, ok, payload } = await request("team-import-connect", { method: "POST", body: { code: cleanCode, label: String(label || "").slice(0, 80) } });
    if (!ok || !TOKEN.test(String(payload?.token || ""))) throw new Error(userMessage(status, payload, "Code refusé par NXT5. Génère un nouveau code dans Parties → Import automatique."));
    const binding = payload.binding || {};
    await persist((current) => ({ ...current, link: { token: payload.token, linkId: binding.linkId, teamId: binding.teamId, teamName: binding.teamName, teamTag: binding.teamTag, label: String(label || "").slice(0, 80), expiresAt: binding.expiresAt, linkedAt: new Date(now()).toISOString(), verifiedAt: new Date(now()).toISOString(), roster: binding.roster || [] }, games: current.games }));
    return snapshot();
  }
  async function verify() {
    if (!state.link) throw new Error("Aucune liaison. Colle d’abord un code généré dans NXT5.");
    const { status, ok, payload } = await request("team-import-session", { token: state.link.token });
    if (status === 401) {
      await persist((current) => ({ ...current, link: { ...current.link, invalidReason: userMessage(0, payload, "Liaison expirée ou révoquée. Génère un nouveau code dans NXT5.") } }));
      stop();
      return snapshot();
    }
    if (!ok) throw new Error(userMessage(status, payload, "Vérification impossible pour le moment."));
    const binding = payload?.binding || {};
    await persist((current) => ({ ...current, link: { ...current.link, teamName: binding.teamName || current.link.teamName, teamTag: binding.teamTag || current.link.teamTag, expiresAt: binding.expiresAt || current.link.expiresAt, roster: binding.roster || current.link.roster, verifiedAt: new Date(now()).toISOString(), invalidReason: "" } }));
    return snapshot();
  }
  async function forget() {
    stop();
    await persist((current) => ({ ...current, link: null }));
    return snapshot();
  }

  function start() {
    if (!state.link) throw new Error("Lie d’abord NXT5 Importer à ton équipe avec un code.");
    if (state.link.invalidReason) throw new Error(state.link.invalidReason);
    if (active) return snapshot();
    active = true;
    controller = new AbortController();
    setPhase("starting", "Recherche du client LoL…");
    tick();
    return snapshot();
  }
  function stop() {
    if (!active) return snapshot();
    active = false;
    if (timer) { cancel(timer); timer = null; }
    controller?.abort();
    controller = null;
    observed.clear();
    captures.clear();
    setPhase("idle", "", "");
    return snapshot();
  }
  function tick() {
    if (!active) return;
    timer = schedule(async () => {
      timer = null;
      try { await poll(); } catch { /* reported through the phase */ }
      try { await flush(); } catch { /* entries keep their own errors */ }
      tick();
    }, pollIntervalMs);
  }

  async function poll() {
    if (!active || polling) return;
    polling = true;
    const signal = controller?.signal;
    try {
      let lockfile;
      try { lockfile = await readLockfile(); } catch (error) { setPhase("no-client", "Client LoL non détecté. Ouvre-le pour que la collecte fonctionne.", ""); return; }
      let session;
      try { session = await lcuRequest(lockfile, "/lol-gameflow/v1/session", { signal, timeoutMs: 4000 }); }
      catch (error) { setPhase("no-client", "Le client LoL ne répond pas pour le moment.", ""); return; }
      const gamePhase = String(session?.phase || "None");
      const numericId = session?.gameData?.gameId ? String(session.gameData.gameId) : "";
      const gameId = /^\d+$/.test(numericId) && numericId !== "0" ? `${platform()}_${numericId}` : "";
      if (gamePhase === "InProgress" && gameId) {
        if (!observed.has(gameId)) observed.set(gameId, { seenAt: now(), custom: session?.gameData?.isCustomGame === true });
        setPhase("in-game", "Partie en cours. Elle sera envoyée à la fin.", gameId);
      } else if (END_PHASES.has(gamePhase) || gamePhase === "GameStart") {
        const waiting = [...observed.keys()].filter((id) => !captures.has(id) || captures.get(id).status === "retry");
        if (waiting.length) {
          for (const id of waiting) await capture(id, signal);
        } else if (gamePhase === "InProgress") {
          setPhase("in-game", "Partie en cours.", gameId);
        } else {
          setPhase("watching", "En attente d’une custom. Laisse l’Importer et le client ouverts.", "");
        }
      } else {
        setPhase("watching", `Client LoL connecté (${gamePhase}).`, "");
      }
    } finally {
      polling = false;
    }
  }
  async function capture(gameId, signal) {
    const attempt = captures.get(gameId) || { attempts: 0, status: "retry" };
    if (state.games.some((game) => game.gameId === gameId)) { captures.set(gameId, { ...attempt, status: "done" }); observed.delete(gameId); return; }
    attempt.attempts += 1;
    captures.set(gameId, attempt);
    setPhase("capturing", "Récupération de la partie dans le client LoL…", gameId);
    try {
      const exported = await fetchLocal(gameId, signal, () => {});
      const match = exported.match;
      const timeline = exported.timeline || null;
      delete match.timeline;
      const payload = { source: "nxt5-match-exporter", version: 5, gameId, platform: gameId.split("_")[0], exportedAt: new Date(now()).toISOString(), importerSource: "lcu-auto-collect", match, timeline, nxt5: { importer: "NXT5 Importer", timelineSummary: buildTimelineSummary(match, timeline) } };
      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized, "utf8") > 4.75 * 1024 * 1024) throw Object.assign(new Error("Cette partie dépasse la limite d’envoi de NXT5 (5 Mo)."), { final: true });
      await fs.mkdir(payloadDirectory, { recursive: true });
      await atomicWrite(payloadPath(gameId), serialized);
      await persist((current) => ({ ...current, games: [{ gameId, status: "queued", attempts: 0, nextAttemptAt: 0, capturedAt: new Date(now()).toISOString(), duration: Number(match.info?.gameDuration || 0), timelineAvailable: Boolean(timeline) }, ...current.games.filter((game) => game.gameId !== gameId)].slice(0, MAX_GAMES) }));
      captures.set(gameId, { ...attempt, status: "done" });
      observed.delete(gameId);
    } catch (error) {
      if (signal?.aborted) return;
      if (error?.final || attempt.attempts >= CAPTURE_ATTEMPTS) {
        captures.set(gameId, { ...attempt, status: "done" });
        observed.delete(gameId);
        await persist((current) => ({ ...current, games: [{ gameId, status: "failed", attempts: attempt.attempts, nextAttemptAt: 0, capturedAt: new Date(now()).toISOString(), lastError: error?.final ? error.message : `Partie introuvable dans le client après ${attempt.attempts} essais. Exporte-la manuellement.` }, ...current.games.filter((game) => game.gameId !== gameId)].slice(0, MAX_GAMES) }));
      } else {
        setPhase("capturing", "La partie n’est pas encore dans l’historique du client. Nouvel essai bientôt.", gameId);
      }
    }
  }

  async function flush() {
    if (flushing || !state.link) return;
    flushing = true;
    try {
      for (const game of state.games.filter((entry) => entry.status === "queued" && entry.nextAttemptAt <= now())) await send(game.gameId);
    } finally {
      flushing = false;
    }
  }
  async function send(gameId) {
    const link = state.link;
    if (!link) return;
    let payload;
    try { payload = JSON.parse(await fs.readFile(payloadPath(gameId), "utf8")); }
    catch {
      await persist((current) => ({ ...current, games: current.games.map((game) => game.gameId === gameId ? { ...game, status: "failed", lastError: "Le fichier local de la partie est introuvable. Exporte-la manuellement." } : game) }));
      return;
    }
    setPhase(active ? phase : "idle", "Envoi de la partie à NXT5…", gameId);
    let response;
    try {
      response = await request("team-import-submissions", { method: "POST", token: link.token, idempotencyKey: gameId, timeoutMs: 60_000, body: { payload: { match: payload.match, timeline: payload.timeline } } });
    } catch (error) {
      await persist((current) => ({ ...current, games: current.games.map((game) => game.gameId === gameId ? { ...game, attempts: game.attempts + 1, nextAttemptAt: now() + BACKOFF_MS[Math.min(game.attempts, BACKOFF_MS.length - 1)], lastError: error.message } : game) }));
      return;
    }
    if (response.status === 401) {
      const reason = userMessage(0, response.payload, "Liaison expirée ou révoquée. Génère un nouveau code dans NXT5.");
      await persist((current) => ({ ...current, link: current.link ? { ...current.link, invalidReason: reason } : null, games: current.games.map((game) => game.gameId === gameId ? { ...game, status: "unauthorized", lastError: reason } : game) }));
      stop();
      return;
    }
    if (response.status === 429 || response.status >= 500 || response.payload === null) {
      const retryAfter = Number(response.payload?.retryAfter) > 0 ? Number(response.payload.retryAfter) * 1000 : 0;
      await persist((current) => ({ ...current, games: current.games.map((game) => game.gameId === gameId ? { ...game, attempts: game.attempts + 1, nextAttemptAt: now() + Math.max(retryAfter, BACKOFF_MS[Math.min(game.attempts, BACKOFF_MS.length - 1)]), lastError: userMessage(response.status, response.payload, "NXT5 est momentanément indisponible.") } : game) }));
      return;
    }
    if (!response.ok) {
      await persist((current) => ({ ...current, games: current.games.map((game) => game.gameId === gameId ? { ...game, status: "failed", attempts: game.attempts + 1, lastError: userMessage(response.status, response.payload, "Partie refusée par NXT5.") } : game) }));
      return;
    }
    const submission = response.payload?.submission || {};
    await persist((current) => ({ ...current, games: current.games.map((game) => game.gameId === gameId ? { ...game, status: "sent", sentAt: new Date(now()).toISOString(), lastError: "", result: { status: submission.status || (response.payload?.imported ? "imported" : ""), reason: submission.reason || "", matchId: submission.matchId || response.payload?.matchId || "" } } : game) }));
    if (submission.status !== "pending") await fs.rm(payloadPath(gameId), { force: true }).catch(() => {});
  }

  async function submitGame(value) {
    if (!state.link) throw new Error("Lie d’abord NXT5 Importer à ton équipe avec un code.");
    const gameId = normalizeGameId(value, platform());
    const signal = controller?.signal;
    const existing = state.games.find((game) => game.gameId === gameId);
    if (existing?.status === "sent") return snapshot();
    if (!existing || existing.status === "failed") {
      await persist((current) => ({ ...current, games: current.games.filter((game) => game.gameId !== gameId) }));
      captures.delete(gameId);
      const attempt = { attempts: CAPTURE_ATTEMPTS - 1, status: "retry" };
      captures.set(gameId, attempt);
      await capture(gameId, signal);
      const captured = state.games.find((game) => game.gameId === gameId);
      if (captured?.status === "failed") throw new Error(captured.lastError);
    }
    await persist((current) => ({ ...current, games: current.games.map((game) => game.gameId === gameId ? { ...game, status: "queued", nextAttemptAt: 0 } : game) }));
    await flush();
    const sent = state.games.find((game) => game.gameId === gameId);
    if (sent?.status !== "sent") throw new Error(sent?.lastError || "Envoi impossible pour le moment. Nouvel essai automatique.");
    return snapshot();
  }
  async function retry(gameId) {
    await persist((current) => ({ ...current, games: current.games.map((game) => game.gameId === gameId && ["queued", "failed"].includes(game.status) ? { ...game, status: "queued", nextAttemptAt: 0 } : game) }));
    await flush();
    return snapshot();
  }
  async function load() {
    try { state = cleanState(JSON.parse(await fs.readFile(filePath, "utf8"))); }
    catch { state = cleanState(null); }
    return snapshot();
  }

  return { load, snapshot, connect, verify, forget, start, stop, poll, flush, submitGame, retry, get active() { return active; } };
}
