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

function harness(t, { connectResponse, sessionResponse, submitResponses = [], gameflow = () => ({ phase: "None" }), local, region, cipher } = {}) {
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
      if (typeof next === "function") return reply(...(await next()));
      return reply(...next);
    }
    return reply(404, { error: "unknown" });
  };
  const collector = createCollector({
    filePath: path.join(dir, "collector.json"), payloadDirectory: path.join(dir, "games"), siteUrl: "https://nxt5.test",
    platform: () => "EUW1", fetchImpl, readLockfile: async () => ({ port: 1, password: "x" }),
    lcuRequest: async (_lockfile, endpoint) => {
      if (endpoint === "/lol-gameflow/v1/session") return gameflow();
      if (endpoint === "/riotclient/region-locale" && region) return { region: region(), locale: "en_US" };
      throw new Error("unexpected");
    },
    fetchLocal: local || (async (gameId) => ({ match: matchFixture(gameId), timeline: { info: { frames: [{}] } } })),
    buildTimelineSummary: () => ({ ok: true }),
    now: () => clock, schedule: (callback, delay) => { const handle = { callback, delay }; timers.push(handle); return handle; }, cancel: (handle) => { const index = timers.indexOf(handle); if (index >= 0) timers.splice(index, 1); },
    pollIntervalMs: 10_000, onChange: (snapshot) => changes.push(snapshot), appVersion: "0.4.0",
    ...(cipher ? { cipher } : {}),
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

test("a game refused by NXT5 is final but keeps its file for a manual retry; a pending one is kept by NXT5, not locally", async (t) => {
  const { collector, advance, dir } = harness(t, { submitResponses: [[400, { error: "Identifiant de partie invalide." }], [201, { accepted: true, submission: { status: "pending", reason: "Les postes de l’équipe adverse n’ont pas pu être reconnus automatiquement." } }]], gameflow: () => ({ phase: "None" }) });
  await collector.load();
  await collector.connect(CODE, "PC");
  await assert.rejects(collector.submitGame(ID), /Identifiant de partie invalide/);
  assert.equal(collector.snapshot().games[0].status, "failed");
  await fs.stat(path.join(dir, "games", `${ID}.json`));
  await collector.retry(ID);
  const game = collector.snapshot().games[0];
  assert.equal(game.status, "sent");
  assert.equal(game.result.status, "pending");
  await assert.rejects(fs.stat(path.join(dir, "games", `${ID}.json`)), { code: "ENOENT" }, "NXT5 keeps the pending payload for the staff");
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

test("ranked, normal or ARAM games in progress are never observed nor sent", async (t) => {
  let phase = "InProgress";
  let captured = 0;
  const { collector, requests, advance } = harness(t, { gameflow: () => ({ phase, gameData: { gameId: 8035280010, isCustomGame: false, queue: { id: 420 } } }), local: async (gameId) => { captured += 1; return { match: matchFixture(gameId), timeline: null }; } });
  await collector.load();
  await collector.connect(CODE, "PC");
  collector.start();
  await advance();
  assert.equal(collector.snapshot().phase, "watching");
  assert.match(collector.snapshot().clientMessage, /hors custom/);
  assert.equal(collector.snapshot().currentGame, "");
  phase = "EndOfGame";
  await advance();
  await advance();
  assert.equal(captured, 0);
  assert.equal(collector.snapshot().games.length, 0);
  assert.equal(requests.filter((request) => request.url.endsWith("/team-import-submissions")).length, 0);
});

test("the game ID uses the region of the connected client, not the default setting", async (t) => {
  let phase = "InProgress";
  const fetched = [];
  const { collector, requests, advance } = harness(t, {
    region: () => "NA",
    gameflow: () => ({ phase, gameData: phase === "InProgress" ? { gameId: 5123456789, isCustomGame: true } : {} }),
    local: async (gameId) => { fetched.push(gameId); return { match: matchFixture(gameId), timeline: null }; },
  });
  await collector.load();
  await collector.connect(CODE, "PC");
  collector.start();
  await advance();
  assert.equal(collector.snapshot().currentGame, "NA1_5123456789");
  phase = "EndOfGame";
  await advance();
  assert.deepEqual(fetched, ["NA1_5123456789"]);
  assert.equal(collector.snapshot().games[0].status, "sent");
  assert.equal(requests.find((request) => request.url.endsWith("/team-import-submissions")).headers["Idempotency-Key"], "NA1_5123456789");
});

test("the client region falls back to the setting when the client cannot tell", async (t) => {
  const { collector, advance } = harness(t, { region: () => "PBE", gameflow: () => ({ phase: "InProgress", gameData: { gameId: 8035280010, isCustomGame: true } }) });
  await collector.load();
  await collector.connect(CODE, "PC");
  collector.start();
  await advance();
  assert.equal(collector.snapshot().currentGame, ID);
});

const fakeCipher = (available = true) => ({
  available: () => available,
  encrypt: (value) => Buffer.from(`sealed:${value}`).toString("base64"),
  decrypt: (value) => { const text = Buffer.from(value, "base64").toString(); if (!text.startsWith("sealed:")) throw new Error("bad"); return text.slice(7); },
});

test("the link token is encrypted on disk when the OS offers it, and a clear legacy token is migrated", async (t) => {
  const { collector, dir } = harness(t, { cipher: fakeCipher() });
  await collector.load();
  await collector.connect(CODE, "PC");
  const file = path.join(dir, "collector.json");
  const raw = await fs.readFile(file, "utf8");
  assert.ok(!raw.includes(TOKEN), "the token never lands in clear");
  const persisted = JSON.parse(raw);
  assert.equal(persisted.link.token, undefined);
  assert.equal(fakeCipher().decrypt(persisted.link.tokenEncrypted), TOKEN);
  const options = { filePath: file, payloadDirectory: path.join(dir, "games"), siteUrl: "https://nxt5.test", readLockfile: async () => ({}), lcuRequest: async () => ({}), fetchLocal: async () => ({}) };
  const reloaded = await createCollector({ ...options, cipher: fakeCipher() }).load();
  assert.equal(reloaded.linked, true);
  // A legacy file written in clear by 0.4.7 is read, then re-encrypted on load.
  await fs.writeFile(file, JSON.stringify({ link: { ...persisted.link, tokenEncrypted: undefined, token: TOKEN }, games: [] }));
  const legacy = await createCollector({ ...options, cipher: fakeCipher() }).load();
  assert.equal(legacy.linked, true);
  const migrated = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(migrated.link.token, undefined);
  assert.equal(fakeCipher().decrypt(migrated.link.tokenEncrypted), TOKEN);
  // Without OS encryption the token stays readable so the link keeps working.
  await fs.writeFile(file, JSON.stringify({ link: { ...persisted.link, tokenEncrypted: undefined, token: TOKEN }, games: [] }));
  const plain = createCollector({ ...options, cipher: fakeCipher(false) });
  assert.equal((await plain.load()).linked, true);
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).link.token, TOKEN);
});

test("sent, evicted and orphan payload files are removed, queued ones are kept", async (t) => {
  const { collector, dir } = harness(t, { submitResponses: [new TypeError("fetch failed")] });
  const games = path.join(dir, "games");
  await fs.mkdir(games, { recursive: true });
  await fs.writeFile(path.join(games, "EUW1_1111111111.json"), "{}");
  await collector.load();
  await assert.rejects(fs.stat(path.join(games, "EUW1_1111111111.json")), { code: "ENOENT" }, "an orphan from an older version is pruned on load");
  await collector.connect(CODE, "PC");
  await assert.rejects(collector.submitGame(ID), /Connexion à NXT5 impossible/);
  await fs.stat(path.join(games, `${ID}.json`));
  await collector.retry(ID);
  assert.equal(collector.snapshot().games[0].status, "sent");
  await assert.rejects(fs.stat(path.join(games, `${ID}.json`)), { code: "ENOENT" });
  // Fifty newer games push a queued one out of the list: its payload goes with it.
  const old = "EUW1_2222222222";
  await fs.writeFile(path.join(games, `${old}.json`), "{}");
  const state = JSON.parse(await fs.readFile(path.join(dir, "collector.json"), "utf8"));
  state.games = [{ gameId: old, status: "queued", attempts: 1, nextAttemptAt: Number.MAX_SAFE_INTEGER }];
  await fs.writeFile(path.join(dir, "collector.json"), JSON.stringify(state));
  await collector.load();
  await fs.stat(path.join(games, `${old}.json`));
  for (let index = 0; index < 50; index++) await collector.submitGame(`EUW1_${3000000000 + index}`);
  assert.equal(collector.snapshot().games.length, 50);
  assert.ok(!collector.snapshot().games.some((game) => game.gameId === old));
  await assert.rejects(fs.stat(path.join(games, `${old}.json`)), { code: "ENOENT" });
  assert.deepEqual(await fs.readdir(games), []);
});

test("a manual send waits for a background flush in progress instead of failing", async (t) => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const { collector, requests } = harness(t, { submitResponses: [async () => { await blocked; return [201, { accepted: true, imported: true, submission: { status: "imported" } }]; }] });
  await collector.load();
  await collector.connect(CODE, "PC");
  const first = "EUW1_4000000001";
  const firstSend = collector.submitGame(first);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(requests.filter((request) => request.url.endsWith("/team-import-submissions")).length, 1, "the first send is in flight");
  const second = collector.submitGame(ID);
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  await firstSend;
  const result = await second;
  assert.ok(result.games.every((game) => game.status === "sent"));
  assert.equal(requests.filter((request) => request.url.endsWith("/team-import-submissions")).length, 2);
});

test("the state in memory only changes once it is written to disk", async (t) => {
  const { collector, dir } = harness(t);
  await collector.load();
  await collector.connect(CODE, "PC");
  const file = path.join(dir, "collector.json");
  await fs.rm(file);
  await fs.mkdir(file);
  await fs.writeFile(path.join(file, "block"), "x");
  await assert.rejects(collector.forget());
  assert.equal(collector.snapshot().linked, true, "a failed write keeps the previous state");
});
