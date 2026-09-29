import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createChampionCatalog } from "../src/network.js";

// Exercise the shipped conversion helpers without launching Electron or registering IPC.
const source = await fs.readFile(
  new URL("../src/main.js", import.meta.url),
  "utf8",
);
const helpers = source.slice(
  source.indexOf("function localPosition("),
  source.indexOf("async function localMatch("),
);
const { lcuWinValue, localPosition, lcuToRiotMatch, csAtMinuteFromTimeline } =
  new Function(
    "catalog",
    `${helpers}; return { lcuWinValue, localPosition, lcuToRiotMatch, csAtMinuteFromTimeline };`,
  )({ name: async () => "Annie" });

test("LCU result strings do not turn losses into wins", () => {
  for (const win of [false, "Fail", "false", 0, "0", undefined])
    assert.equal(lcuWinValue({ win }), false);
  for (const win of [true, "Win", "true", 1, "1"])
    assert.equal(lcuWinValue({ win }), true);
});

test("LCU position mapping distinguishes bot carry and support and respects explicit roles", () => {
  assert.equal(
    localPosition({ timeline: { lane: "BOTTOM", role: "DUO_SUPPORT" } }),
    "UTILITY",
  );
  assert.equal(
    localPosition({ timeline: { lane: "BOTTOM", role: "DUO_CARRY" } }),
    "BOTTOM",
  );
  assert.equal(localPosition({ timeline: { lane: "MID" } }), "MIDDLE");
  assert.equal(
    localPosition({ teamPosition: "TOP", timeline: { lane: "MIDDLE" } }),
    "TOP",
  );
});

test("LCU conversion preserves numeric item/spell stats, ISO dates and derives team kills", async () => {
  const match = await lcuToRiotMatch(
    {
      gameId: 7861632138,
      gameCreationDate: "2026-09-06T12:00:00Z",
      gameDuration: 1800000,
      participants: [
        {
          participantId: 1,
          teamId: 100,
          championId: 1,
          spell1Id: 4,
          stats: {
            kills: 4,
            deaths: 2,
            assists: 6,
            win: "Fail",
            item0Id: 1001,
            damageDealtToTurrets: 123,
          },
          timeline: { lane: "BOTTOM", role: "DUO_SUPPORT" },
        },
      ],
      participantIdentities: [
        { participantId: 1, player: { gameName: "Player", tagLine: "EUW" } },
      ],
      teams: [{ teamId: 100, win: "Fail" }],
    },
    "EUW1_7861632138",
  );
  assert.equal(match.info.gameDuration, 1800);
  assert.equal(match.info.gameCreation, Date.parse("2026-09-06T12:00:00Z"));
  assert.equal(match.info.teams[0].objectives.champion.kills, 4);
  assert.equal(match.info.participants[0].item0, 1001);
  assert.equal(match.info.participants[0].summoner1Id, 4);
  assert.equal(match.info.participants[0].damageDealtToTurrets, 123);
  assert.equal(match.info.participants[0].win, false);
  assert.equal(match.info.participants[0].teamPosition, "UTILITY");
  assert.equal(match.info.participants[0].championName, "Annie");
});

test("CS milestones require the observed minute and never borrow an eleven-minute frame", () => {
  const timeline = {
    info: {
      frames: [
        { timestamp: 660000, participantFrames: { 1: { minionsKilled: 99, jungleMinionsKilled: 0 } } },
      ],
    },
  };
  assert.equal(csAtMinuteFromTimeline(timeline, 1, 10, 1800), null);
  assert.equal(csAtMinuteFromTimeline(timeline, 1, 20, 900), null);
  timeline.info.frames[0].timestamp = 600020;
  assert.equal(csAtMinuteFromTimeline(timeline, 1, 10, 1800), 99);
});

test("missing or non-finite CS components stay null and explicit zeros remain measured", () => {
  for (const minute of [10, 20]) {
    const frame = { timestamp: minute * 60000, participantFrames: { 1: {} } };
    const timeline = { info: { frames: [frame] } };
    for (const key of ["minionsKilled", "jungleMinionsKilled"]) {
      for (const value of [undefined, null, NaN, Infinity, "0", false]) {
        frame.participantFrames[1] = { minionsKilled: 0, jungleMinionsKilled: 0, [key]: value };
        assert.equal(csAtMinuteFromTimeline(timeline, 1, minute, 1800), null);
      }
    }
    frame.participantFrames[1] = { minionsKilled: 0, jungleMinionsKilled: 0 };
    frame.timestamp = minute * 60000 + 5000;
    assert.equal(csAtMinuteFromTimeline(timeline, 1, minute, 1800), 0);
    frame.timestamp++;
    assert.equal(csAtMinuteFromTimeline(timeline, 1, minute, 1800), null);
  }
});

test("LCU conversion uses Riot IDs and rejects an unavailable catalog", async () => {
  const convert = (catalog) => new Function("catalog", `${helpers}; return lcuToRiotMatch;`)(catalog);
  const game = { participants: [{ participantId: 1, teamId: 100, championId: 62 }] };
  const online = createChampionCatalog(async (url) => ({ response: { ok: true }, payload:
    url.endsWith("versions.json") ? ["16.1.1"] : { data: { MonkeyKing: { key: "62", id: "MonkeyKing", name: "Wukong" } } },
  }));
  const match = await convert(online)(game, "EUW1_7861632138");
  assert.equal(match.info.participants[0].championName, "MonkeyKing");
  const offline = createChampionCatalog(async () => { throw new Error("offline"); });
  await assert.rejects(convert(offline)(game, "EUW1_7861632138"), /Catalogue des champions indisponible, réessaie connecté/);
});
