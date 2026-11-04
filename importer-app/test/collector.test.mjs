import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCollector } from "../src/collector.js";

const TOKEN = `ti_${"a".repeat(64)}`;
const CODE = "ABCD-1234-EF56-7890-AB12-CD34";
const ID = "EUW1_8035280010";

function matchFixture(id = ID) {
  return {
    metadata: { matchId: id },
    info: {
      gameId: id.split("_")[1], gameDuration: 1800, gameType: "CUSTOM_GAME", mapId: 11,
      participants: Array.from({ length: 10 }, (_, index) => ({ participantId: index + 1, teamId: index < 5 ? 100 : 200, championName: `Champion ${index}`, riotIdGameName: `Player ${index}`, riotIdTagline: "EUW", kills: 1, deaths: 1, assists: 1 })),
      teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }],
    },
  };
}

function harness(t, { connectResponse, sessionResponse, submitResponses = [], gameflow = () => ({ phase: "None" }), local } = {}) {
  const dir = path.join(os.tmpdir(), `nxt5-collector-${process.pid}-${Math.random().toString(16).slice(2)}`);
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const requests = [];
  let clock = 1_700_000_000_000;
  const timers = [];
  const changes = [];
  const fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    requests.push({ url: String(url), method: init?.method || "GET", headers: init?.headers || {}, body });
    const reply = (status, payload) => new Response(payload === undefined ? "" : JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/team-import-connect")) return reply(...(connectResponse || [200, { token: TOKEN, binding: { linkId: "link-1", teamId: "team-1", teamName: "Arcane Horizon", teamTag: "AH", expiresAt: "2027-02-01T00:00:00.000Z", roster: [{ riotId: "Player 0#EUW", role: "TOP" }] }, schemaVersion: 1 }]));
    if (url.endsWith("/team-import-session")) return reply(...(sessionResponse || [200, { valid: true, binding: { teamName: "Arcane Horizon", teamTag: "AH", expiresAt: "2027-02-01T00:00:00.000Z", roster: [] } }]));
    if (url.endsWith("/team-import-submissions")) {
      const next = submitResponses.shift();
      if (!next) return reply(201, { accepted: true, imported: true, matchId: "match-1", submission: { status: "imported", gameId: body?.payload?.match?.metadata?.matchId, reason: "" } });
      if (next instanceof Error) throw next;
      return reply(...next);
    }
    return reply(404, { error: "unknown" });
  };
  const collector = createCollector({
    filePath: path.join(dir, "collector.json"), payloadDirectory: path.join(dir, "games"), siteUrl: "https://nxt5.test",
    platform: () => "EUW1", fetchImpl, readLockfile: async () => ({ port: 1, password: "x" }),
    lcuRequest: async (_lockfile, endpoint) => { if (endpoint === "/lol-gameflow/v1/session") return gameflow(); throw new Error("unexpected"); },
    fetchLocal: local || (async (gameId) => ({ match: matchFixture(gameId), timeline: { info: { frames: [{}] } } })),
    buildTimelineSummary: () => ({ ok: true }),
    now: () => clock, schedule: (callback, delay) => { const handle = { callback, delay }; timers.push(handle); return handle; }, cancel: (handle) => { const index = timers.indexOf(handle); if (index >= 0) timers.splice(index, 1); },
    pollIntervalMs: 10_000, onChange: (snapshot) => changes.push(snapshot), appVersion: "0.4.0",
  });
  const advance = async (ms = 10_000) => { clock += ms; const due = timers.splice(0); for (const handle of due) await handle.callback(); };
  return { collector, requests, timers, changes, advance, dir, setClock: (value) => { clock = value; } };
}

test("links with a code once, verifies the session and forgets the link", async (t) => {
  const { collector, requests, dir } = harness(t);
  await collector.load();
  await assert.rejects(collector.connect("short"), /24 caractères/);
  const linked = await collector.connect(CODE, "PC de Coach");
  assert.equal(linked.linked, true);
  assert.equal(linked.link.teamName, "Arcane Horizon");
  assert.equal(linked.link.token, undefined, "the token never leaves the main process");
  assert.deepEqual(requests[0].body, { code: "ABCD1234EF567890AB12CD34", label: "PC de Coach" });
  const verified = await collector.verify();
  assert.equal(verified.link.invalidReason, "");
  assert.equal(requests[1].headers.Authorization, `Bearer ${TOKEN}`);
  const persisted = JSON.parse(await fs.readFile(path.join(dir, "collector.json"), "utf8"));
  assert.equal(persisted.link.token, TOKEN, "the link survives a restart on disk");
  const forgotten = await collector.forget();
  assert.equal(forgotten.linked, false);
  assert.throws(() => collector.start(), /Lie d’abord/);
});

test("observes a custom in the client, captures it at the end and sends it once", async (t) => {
  let phase = "Lobby";
  const { collector, requests, advance, changes } = harness(t, { gameflow: () => ({ phase, gameData: phase === "InProgress" ? { gameId: 8035280010, isCustomGame: true } : {} }) });
  await collector.load();
  await collector.connect(CODE, "PC");
  collector.start();
  await advance();
  assert.equal(collector.snapshot().phase, "watching");
  phase = "InProgress";
  await advance();
  assert.equal(collector.snapshot().phase, "in-game");
  assert.equal(collector.snapshot().currentGame, ID);
  phase = "EndOfGame";
  await advance();
  const after = collector.snapshot();
  assert.equal(after.games.length, 1);
  assert.equal(after.games[0].status, "sent");
  assert.equal(after.games[0].result.status, "imported");
  const submission = requests.find((request) => request.url.endsWith("/team-import-submissions"));
  assert.equal(submission.headers["Idempotency-Key"], ID);
  assert.equal(submission.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(submission.body.payload.match.metadata.matchId, ID);
  assert.ok(submission.body.payload.timeline);
  await advance();
  await advance();
  assert.equal(requests.filter((request) => request.url.endsWith("/team-import-submissions")).length, 1, "the same game is never sent twice");
  assert.ok(changes.length > 3);
  collector.stop();
  assert.equal(collector.snapshot().active, false);
});

test("retries a network failure with backoff, keeps the payload, and stops on a revoked link", async (t) => {
  const netError = Object.assign(new TypeError("fetch failed"), {});
  const { collector, requests, advance, dir } = harness(t, { submitResponses: [netError, [503, { error: "Service indisponible" }], [401, { error: "Liaison expirée ou révoquée." }]], gameflow: () => ({ phase: "EndOfGame" }) });
  await collector.load();
  await collector.connect(CODE, "PC");
  collector.start();
  await assert.rejects(collector.submitGame(ID), /Connexion à NXT5 impossible/);
  let game = collector.snapshot().games[0];
  assert.equal(game.status, "queued");
  assert.equal(game.attempts, 1);
  assert.ok(game.nextAttemptAt > 0);
  await fs.stat(path.join(dir, "games", `${ID}.json`));
  await advance(10_000);
  assert.equal(requests.filter((request) => request.url.endsWith("/team-import-submissions")).length, 1, "not due yet");
  await advance(60_000);
  game = collector.snapshot().games[0];
  assert.equal(game.attempts, 2);
  assert.match(game.lastError, /Service indisponible/);
  await advance(130_000);
  const final = collector.snapshot();
  assert.equal(final.games[0].status, "unauthorized");
  assert.equal(final.active, false, "a revoked link stops the collection");
  assert.match(final.link.invalidReason, /révoquée/);
  assert.throws(() => collector.start(), /révoquée/);
});

test("a game refused by NXT5 is final, a pending one keeps its file, and manual retry re-queues a failure", async (t) => {
  const { collector, advance, dir } = harness(t, { submitResponses: [[400, { error: "Identifiant de partie invalide." }], [201, { accepted: true, submission: { status: "pending", reason: "Les postes de l’équipe adverse n’ont pas pu être reconnus automatiquement." } }]], gameflow: () => ({ phase: "None" }) });
  await collector.load();
  await collector.connect(CODE, "PC");
  await assert.rejects(collector.submitGame(ID), /Identifiant de partie invalide/);
  assert.equal(collector.snapshot().games[0].status, "failed");
  await collector.retry(ID);
  const game = collector.snapshot().games[0];
  assert.equal(game.status, "sent");
  assert.equal(game.result.status, "pending");
  await fs.stat(path.join(dir, "games", `${ID}.json`));
  await advance();
});

test("a game missing from the client history is retried and then marked for manual export; restart requires a new activation", async (t) => {
  let phase = "InProgress";
  let calls = 0;
  const { collector, advance, dir } = harness(t, { gameflow: () => ({ phase, gameData: phase === "InProgress" ? { gameId: 8035280010, isCustomGame: true } : {} }), local: async () => { calls += 1; throw new Error("Partie introuvable dans le client LoL."); } });
  await collector.load();
  await collector.connect(CODE, "PC");
  collector.start();
  await advance();
  phase = "EndOfGame";
  for (let index = 0; index < 18; index++) await advance();
  const game = collector.snapshot().games[0];
  assert.equal(game.status, "failed");
  assert.match(game.lastError, /Exporte-la manuellement/);
  assert.equal(calls, 18);
  const reloaded = createCollector({ filePath: path.join(dir, "collector.json"), payloadDirectory: path.join(dir, "games"), siteUrl: "https://nxt5.test", readLockfile: async () => ({}), lcuRequest: async () => ({}), fetchLocal: async () => ({}) });
  const state = await reloaded.load();
  assert.equal(state.linked, true);
  assert.equal(state.active, false);
  assert.equal(state.games[0].gameId, ID);
});
