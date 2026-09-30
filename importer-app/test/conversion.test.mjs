import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

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
    `${helpers}; return { lcuWinValue, localPosition, lcuToRiotMatch, csAtMinuteFromTimeline };`,
  )();

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

test("LCU conversion preserves numeric item/spell stats, ISO dates and derives team kills", () => {
  const match = lcuToRiotMatch(
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
  assert.equal(match.info.participants[0].championName, "");
});

test("LCU conversion uses Riot's internal champion names so site stats stay grouped", () => {
  const game = {
    gameId: 7861632138,
    gameDuration: 1800,
    participants: [
      { participantId: 1, teamId: 100, championId: 62, stats: {} },
      { participantId: 2, teamId: 100, championId: 36, stats: {} },
      { participantId: 3, teamId: 100, championId: 999, stats: {} },
    ],
    teams: [],
  };
  const champions = new Map([
    ["62", "MonkeyKing"],
    ["36", "DrMundo"],
  ]);
  const names = lcuToRiotMatch(
    game,
    "EUW1_7861632138",
    champions,
  ).info.participants.map((participant) => participant.championName);
  // An unknown champion stays empty so export validation refuses it instead of storing a placeholder.
  assert.deepEqual(names, ["MonkeyKing", "DrMundo", ""]);
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
