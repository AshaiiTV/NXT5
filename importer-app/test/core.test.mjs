import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  StateStore,
  atomicWrite,
  createImportService,
  normalizeGameId,
  validateMatch,
  validateLocalIdentity,
  normalizeTimelinePayload,
  validatedTimeline,
  selectUpdate,
  safeExternalUrl,
} from "../src/core.js";

const ID = "EUW1_7861632138";
function matchFixture(id = ID) {
  return {
    metadata: { matchId: id },
    info: {
      gameId: id.split("_")[1],
      gameDuration: 1800,
      participants: Array.from({ length: 10 }, (_, index) => ({
        participantId: index + 1,
        teamId: index < 5 ? 100 : 200,
        championName: `Champion ${index}`,
        kills: index,
        totalMinionsKilled: 120,
        neutralMinionsKilled: 3,
      })),
      teams: [
        { teamId: 100, win: true },
        { teamId: 200, win: false },
      ],
    },
  };
}
function timelineFixture(id = ID) {
  return {
    metadata: { matchId: id },
    info: {
      frames: [
        {
          timestamp: 600000,
          participantFrames: {
            1: { minionsKilled: 80, jungleMinionsKilled: 4 },
          },
          events: [],
        },
      ],
    },
  };
}
function harness(overrides = {}) {
  const writes = [],
    history = [],
    progress = [];
  const deps = {
    fetchRemote: async () => ({
      match: matchFixture(),
      timeline: timelineFixture(),
    }),
    fetchLocal: async () => {
      throw new Error("Client absent");
    },
    buildTimelineSummary: (_match, timeline) => ({ available: !!timeline }),
    chooseSave: async () => ({
      canceled: false,
      filePath: "/tmp/nxt5-test.json",
    }),
    writeFile: async (...args) => writes.push(args),
    addHistory: async (entry) => history.push(entry),
    ...overrides,
  };
  const service = createImportService(deps);
  return {
    service,
    writes,
    history,
    progress,
    run: (gameId = ID) =>
      service.generate({ gameId, platform: "EUW1" }, (event) =>
        progress.push(event),
      ),
  };
}

test("normalizes IDs and aliases while a full ID overrides the selected region", () => {
  assert.equal(normalizeGameId("7861632138", "euw"), ID);
  assert.equal(
    normalizeGameId("Match : NA1-7861632138", "EUW1"),
    "NA1_7861632138",
  );
  assert.equal(
    normalizeGameId("https://example.test/match/EUW1_7861632138"),
    ID,
  );
  for (const input of [
    "",
    "000000",
    "7861632138?ignore=1",
    "XX_7861632138",
    "123456789012345678901",
  ])
    assert.throws(() => normalizeGameId(input));
});

test("rejects mismatched IDs, empty rosters, duplicate IDs, unbalanced teams and invalid stats", () => {
  assert.equal(validateMatch(matchFixture(), ID).metadata.matchId, ID);
  const modifications = [
    (match) => {
      match.metadata.matchId = "NA1_7861632138";
    },
    (match) => {
      match.info.gameId = "7861632139";
    },
    (match) => {
      match.info.participants = [];
    },
    (match) => {
      match.info.participants[1].participantId = 1;
    },
    (match) => {
      match.info.participants[1].teamId = 200;
    },
    (match) => {
      match.info.teams[1].win = "Fail";
    },
    (match) => {
      match.info.participants[0].kills = -1;
    },
    (match) => {
      match.info.participants[0].visionScore = Infinity;
    },
    (match) => {
      match.info.gameDuration = 0;
    },
  ];
  for (const modify of modifications) {
    const match = matchFixture();
    modify(match);
    assert.throws(() => validateMatch(match, ID));
  }
});

test("local fallback verifies the actual numeric ID and region independently", () => {
  assert.doesNotThrow(() =>
    validateLocalIdentity({ gameId: 7861632138, platformId: "EUW1" }, ID),
  );
  assert.doesNotThrow(() =>
    validateLocalIdentity({ gameId: 7861632138 }, ID, "EUW"),
  );
  assert.throws(() =>
    validateLocalIdentity({ gameId: 7861632139, platformId: "EUW1" }, ID),
  );
  assert.throws(() =>
    validateLocalIdentity({ gameId: 7861632138, platformId: "NA1" }, ID),
  );
  assert.throws(() => validateLocalIdentity({ gameId: 7861632138 }, ID));
});

test("timeline normalization preserves identity and rejects corrupt or foreign optional data", () => {
  const raw = { metadata: { matchId: ID }, frameInterval: 60000, frames: [] };
  assert.equal(normalizeTimelinePayload(raw).metadata.matchId, ID);
  assert.equal(normalizeTimelinePayload(raw).frameInterval, 60000);
  const bad = [
    timelineFixture("NA1_7861632138"),
    { info: { frames: [{ timestamp: 0, participantFrames: { 11: {} } }] } },
    {
      info: {
        frames: [
          { timestamp: 0, participantFrames: { 1: {} }, events: [null] },
        ],
      },
    },
    {
      info: {
        frames: [
          {
            timestamp: 0,
            participantFrames: { 1: { minionsKilled: Infinity } },
          },
        ],
      },
    },
  ];
  for (const timeline of bad)
    assert.throws(() => validatedTimeline(timeline, matchFixture(), ID));
});

test("exports the v5 envelope once, produces progress and remembers the confirmed file", async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.canceled, false);
  assert.equal(result.summary.participantCount, 10);
  assert.equal(result.summary.timelineAvailable, true);
  assert.deepEqual(
    h.progress.map(({ stage }) => stage),
    ["validate", "fetch", "timeline", "save", "complete"],
  );
  const payload = JSON.parse(h.writes[0][1]);
  assert.equal(payload.version, 5);
  assert.equal(payload.source, "nxt5-match-exporter");
  assert.equal(payload.gameId, ID);
  assert.ok(payload.timeline);
  assert.equal(payload.match.timeline, undefined);
  assert.equal(h.history[0].id, result.historyId);
});

test("a complete game ID also falls back to the validated local client", async () => {
  let called;
  const h = harness({
    fetchRemote: async () => {
      throw new Error("Riot indisponible");
    },
    fetchLocal: async (id) => {
      called = id;
      return { match: matchFixture(), source: "nxt5-lcu-importer" };
    },
  });
  const result = await h.run();
  assert.equal(called, ID);
  assert.equal(result.summary.source, "nxt5-lcu-importer");
  assert.equal(result.summary.timelineAvailable, false);
  assert.equal(result.warnings.length, 2);
});

test("foreign server payload never reaches the save dialog", async () => {
  let dialogs = 0;
  const h = harness({
    fetchRemote: async () => ({ match: matchFixture("NA1_7861632138") }),
    chooseSave: async () => {
      dialogs++;
      return { canceled: false, filePath: "/tmp/forbidden.json" };
    },
  });
  await assert.rejects(h.run(), /Game ID/);
  assert.equal(dialogs, 0);
  assert.equal(h.writes.length, 0);
});

test("corrupt optional timeline is dropped with a warning and the valid match is exported", async () => {
  const h = harness({
    fetchRemote: async () => ({
      match: matchFixture(),
      timeline: {
        info: {
          frames: [{ timestamp: 0, participantFrames: {}, events: [null] }],
        },
      },
    }),
  });
  const result = await h.run();
  assert.equal(result.canceled, false);
  assert.equal(result.summary.timelineAvailable, false);
  assert.equal(JSON.parse(h.writes[0][1]).timeline, null);
  assert.ok(result.warnings.some((warning) => warning.includes("exclue")));
});

test("save-dialog cancellation writes neither file nor history", async () => {
  const h = harness({ chooseSave: async () => ({ canceled: true }) });
  assert.deepEqual(await h.run(), { canceled: true });
  assert.equal(h.writes.length, 0);
  assert.equal(h.history.length, 0);
});

test("cancels a running fetch, forbids overlap and allows a later import", async () => {
  let waiting = true;
  const h = harness({
    fetchRemote: async (_id, _platform, signal) => {
      if (waiting)
        await new Promise((resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          }),
        );
      return { match: matchFixture() };
    },
  });
  const first = h.run();
  await assert.rejects(h.run(), /déjà en cours/);
  assert.deepEqual(h.service.cancel(), { canceled: true });
  assert.deepEqual(await first, { canceled: true });
  assert.equal(h.writes.length, 0);
  waiting = false;
  assert.equal((await h.run()).canceled, false);
  assert.deepEqual(h.service.cancel(), { canceled: false });
});

test("write failure never adds history, while history failure preserves saved-file success", async () => {
  const failed = harness({
    writeFile: async () => {
      throw new Error("Disk full");
    },
  });
  await assert.rejects(failed.run(), /Disk full/);
  assert.equal(failed.history.length, 0);
  const saved = harness({
    addHistory: async () => {
      throw new Error("Disk full");
    },
  });
  const result = await saved.run();
  assert.equal(result.canceled, false);
  assert.equal(result.historyId, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes("historique")));
});

test("oversized export is rejected before save instead of producing an unimportable file", async () => {
  const match = matchFixture();
  match.info.extra = "x".repeat(5 * 1024 * 1024);
  const h = harness({ fetchRemote: async () => ({ match }) });
  await assert.rejects(h.run(), /limite/);
  assert.equal(h.writes.length, 0);
});

test("durable state serializes concurrent updates, bounds history and survives restart", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nxt5-state-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new StateStore(path.join(directory, "preferences.json"));
  await store.load();
  const entries = Array.from({ length: 35 }, (_, index) => ({
    id: String(index),
    gameId: ID,
    filePath: path.join(directory, `${index}.json`),
    exportedAt: new Date().toISOString(),
    participantCount: 10,
    duration: 1800,
    timelineAvailable: true,
    source: "riot",
  }));
  await Promise.all([
    store.saveSettings({ platform: "KR" }),
    ...entries.map((entry) => store.addExport(entry)),
  ]);
  assert.equal(store.snapshot().history.length, 30);
  assert.equal(store.snapshot().history[0].id, "34");
  const reloaded = new StateStore(store.filePath);
  await reloaded.load();
  assert.deepEqual(reloaded.snapshot(), store.snapshot());
  const detached = reloaded.snapshot();
  detached.settings.platform = "EUW1";
  assert.equal(reloaded.snapshot().settings.platform, "KR");
  assert.deepEqual(await fs.readdir(directory), ["preferences.json"]);
});

test("atomic writes preserve the old file when commit fails and clean temporary files", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nxt5-atomic-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, "export.json");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "keep.txt"), "original");
  await assert.rejects(atomicWrite(target, "replacement"));
  assert.equal(
    await fs.readFile(path.join(target, "keep.txt"), "utf8"),
    "original",
  );
  assert.deepEqual(await fs.readdir(directory), ["export.json"]);
});

test("corrupt saved state returns defaults and rejects invalid preferences", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nxt5-corrupt-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new StateStore(path.join(directory, "preferences.json"));
  await fs.writeFile(store.filePath, "{bad");
  assert.deepEqual(await store.load(), {
    settings: { platform: "EUW1", leaguePath: "" },
    history: [],
  });
  assert.ok(store.loadWarning);
  assert.throws(() => store.saveSettings({ platform: "UNKNOWN" }));
  assert.throws(() => store.saveSettings({ leaguePath: "../secret" }));
});

test("updates choose the exact CPU architecture and only verified repository assets", () => {
  const asset = (name, url) => ({
    name,
    browser_download_url:
      url ||
      `https://github.com/AshaiiTV/NXT5/releases/download/latest/${name}`,
  });
  const payload = {
    assets: [
      asset("NXT5-Importer-Mac-x64-0.9.0.zip"),
      asset("NXT5-Importer-Mac-arm64-0.4.0.zip"),
      asset(
        "NXT5-Importer-Mac-arm64-99.0.0.zip",
        "https://evil.test/update.zip",
      ),
      asset("NXT5-Importer-Windows-0.5.0.exe"),
    ],
  };
  const arm = selectUpdate(payload, "0.3.0", "darwin", "arm64");
  assert.equal(arm.latestVersion, "0.4.0");
  assert.ok(arm.downloadUrl.includes("Mac-arm64-0.4.0"));
  assert.equal(
    selectUpdate(payload, "0.3.0", "darwin", "x64").latestVersion,
    "0.9.0",
  );
  assert.equal(
    selectUpdate(payload, "0.3.0", "win32", "x64").latestVersion,
    "0.5.0",
  );
  assert.equal(
    selectUpdate(payload, "0.3.0", "win32", "arm64").updateAvailable,
    false,
  );
  assert.equal(selectUpdate(payload, "0.3.0", "win32", "arm64").checked, false);
  assert.equal(
    selectUpdate({ assets: [] }, "0.3.0", "darwin", "arm64").checked,
    false,
  );
  assert.match(
    selectUpdate({ assets: [] }, "0.3.0", "darwin", "arm64").message,
    /compatible/,
  );
});

test("external navigation accepts the configured site and release pages, rejects unrelated hosts and schemes", () => {
  assert.equal(
    safeExternalUrl("https://nxt5.org/integration", "https://nxt5.org"),
    "https://nxt5.org/integration",
  );
  for (const url of [
    "http://nxt5.org",
    "file:///etc/passwd",
    "https://nxt5.org.evil.test",
    "https://evil.test@nxt5.org",
    "https://github.com/other/project",
    "https://github.com/AshaiiTV/NXT5/releasesEvil",
    "https://nxt5.org:444",
  ])
    assert.equal(safeExternalUrl(url, "https://nxt5.org"), "");
});
