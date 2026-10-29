import { describe, expect, it } from "vitest";
import { buildMatchKillMap } from "../utils/match-kill-map.js";

const rows = () => [
  { champion: "Ahri", team_key: "ALLY", raw: { participantId: 1, teamId: 100 } },
  { champion: "Lux", team_key: "ENEMY", raw: { participantId: 6, teamId: 200 } },
  { champion: "Vi", team_key: "ALLY", raw: { participantId: 2, teamId: 100 } },
];
const kill = (overrides = {}) => ({ type: "CHAMPION_KILL", timestamp: 60000, killerId: 1, victimId: 6, assistingParticipantIds: [2], position: { x: 3000, y: 12000 }, ...overrides });
const match = (events = [kill()], overrides = {}) => ({ id: "match-a", side: "Blue Side", participants: rows(), raw: { info: { mapId: 11 }, timeline: { info: { frames: [{ timestamp: 60000, events }] } } }, ...overrides });

describe("Match kill map data", () => {
  it("places exact events, keeps Cartesian coordinates and resolves the existing rows", () => {
    const game = match();
    const result = buildMatchKillMap(game);
    expect(result).toMatchObject({ status: "ready", total: 1, unplaced: 0, partial: false, counts: { ALLY: 1, ENEMY: 0, UNKNOWN: 0 }, mapId: 11 });
    expect(result.points[0]).toMatchObject({ timestamp: 60000, x: 3120 / 14990, y: 12120 / 15100, teamKey: "ALLY", killerId: 1, killer: game.participants[0], victim: game.participants[1], assistants: [game.participants[2]] });
    expect(result.points[0].killer).toBe(game.participants[0]);
  });

  it.each([
    (frames) => ({ timeline: { info: { frames } } }),
    (frames) => ({ metadata: { timeline: { info: { frames } } } }),
    (frames) => ({ timeline: { frames } }),
    (frames) => ({ timeline: { timeline: { info: { frames } } } }),
    (frames) => ({ timeline: { timeline: { frames } } }),
    (frames) => ({ nxt5: { timelineEvents: frames[0].events } }),
  ])("supports a stored source format without requiring the React workspace (%#)", (source) => {
    expect(buildMatchKillMap(match(undefined, { raw: source([{ timestamp: 60000, events: [kill()] }]) })).points).toHaveLength(1);
  });

  it("prioritizes detailed frames, avoids compact copies and de-duplicates repeated frames", () => {
    const game = match([kill(), kill()]);
    game.raw.timeline.info.frames.push({ timestamp: 120000, events: [kill()] });
    game.raw.nxt5 = { timelineEvents: [kill(), kill({ timestamp: 150000 })] };
    const result = buildMatchKillMap(game);
    expect(result.total).toBe(1);
    expect(result.points).toHaveLength(1);
  });

  it("falls through an empty source to a populated alternative", () => {
    const game = match();
    game.raw.metadata = { timeline: { info: game.raw.timeline.info } };
    game.raw.timeline = { info: { frames: [] } };
    expect(buildMatchKillMap(game).points).toHaveLength(1);
  });

  it("keeps conflicting copies as one unplaced event instead of choosing a location", () => {
    const result = buildMatchKillMap(match([kill(), kill({ position: { x: 3100, y: 12000 } })]));
    expect(result).toMatchObject({ status: "unavailable", total: 1, unplaced: 1, partial: true, points: [] });
  });

  it("uses our team as blue even when it plays the red side", () => {
    const game = match([kill(), kill({ timestamp: 120000, killerId: 6, victimId: 1 })]);
    game.side = "Red Side";
    for (const row of game.participants) row.raw.teamId = row.team_key === "ALLY" ? 200 : 100;
    expect(buildMatchKillMap(game).points.map((point) => point.teamKey)).toEqual(["ALLY", "ENEMY"]);
  });

  it("resolves raw Riot participants using the known allied side when stored rows are absent", () => {
    const game = match(undefined, { side: "Côté rouge", participants: [] });
    game.raw.info.participants = [{ participantId: 1, teamId: 200, championName: "Ahri" }, { participantId: 6, teamId: 100, championName: "Lux" }];
    expect(buildMatchKillMap(game).points[0]).toMatchObject({ teamKey: "ALLY", killer: { championName: "Ahri" }, victim: { championName: "Lux" } });
  });

  it("does not infer our side when only raw team IDs are known", () => {
    const game = match(undefined, { side: "", participants: [] });
    game.raw.info.participants = [{ participantId: 1, teamId: 100 }, { participantId: 6, teamId: 200 }];
    expect(buildMatchKillMap(game).points[0].teamKey).toBe("UNKNOWN");
  });

  it("supports nested/string raw participants and de-duplicates assistants", () => {
    const game = match([kill({ assistingParticipantIds: [2, "2", 0, 999, 1, 6] })]);
    game.participants[0].raw = JSON.stringify({ participant: game.participants[0].raw });
    const result = buildMatchKillMap({ ...game, raw: JSON.stringify(game.raw) });
    expect(result.points[0].teamKey).toBe("ALLY");
    expect(result.points[0].assistants).toEqual([game.participants[2]]);
  });

  it("leaves executions and unresolved killers neutral without assuming the victim's opponent", () => {
    const result = buildMatchKillMap(match([kill({ killerId: 0 }), kill({ timestamp: 120000, killerId: 99 })]));
    expect(result.counts).toEqual({ ALLY: 0, ENEMY: 0, UNKNOWN: 2 });
    expect(result.points.map((point) => point.killerId)).toEqual([0, 99]);
    expect(result.points.every((point) => point.killer === null && point.victim?.champion === "Lux")).toBe(true);
  });

  it.each(["stored", "raw", "conflicting-id"])("does not assign an ambiguous participant (%s)", (kind) => {
    const game = match();
    if (kind === "stored") game.participants.push({ ...game.participants[0], team_key: "ENEMY" });
    if (kind === "raw") game.raw.info.participants = [{ participantId: 1, teamId: 100 }, { participantId: 1, teamId: 200 }];
    if (kind === "conflicting-id") game.participants[0].participantId = 2;
    const point = buildMatchKillMap(game).points[0];
    expect(point.teamKey).toBe("UNKNOWN");
    expect(point.killer).toBeNull();
  });

  it("does not color conflicting team metadata or conflicting team bindings", () => {
    const game = match();
    game.raw.info.participants = [{ participantId: 1, teamId: 200 }];
    expect(buildMatchKillMap(game).points[0].teamKey).toBe("UNKNOWN");
    delete game.raw.info.participants;
    game.participants[1].raw.teamId = 100;
    expect(buildMatchKillMap(game).points[0].teamKey).toBe("UNKNOWN");
  });

  it.each([[0, 0], ["0", "0"], [-120, -120], ["-120", "-120"], [14870, 14980], ["14870", "14980"]])("preserves valid zero or boundary coordinates %s, %s", (x, y) => {
    const point = buildMatchKillMap(match([kill({ position: { x, y }, timestamp: 0 })])).points[0];
    expect(point.x).toBe((Number(x) + 120) / 14990);
    expect(point.y).toBe((Number(y) + 120) / 15100);
    expect(point.timestamp).toBe(0);
  });

  it.each([null, undefined, "", "  ", NaN, Infinity, true, {}, -121, 14871, "invalid"])("rejects invalid position %s without clamping or a frame estimate", (value) => {
    const game = match([kill({ position: { x: value, y: 12000 } })]);
    game.raw.timeline.info.frames[0].participantFrames = { 1: { position: { x: 3000, y: 12000 } } };
    expect(buildMatchKillMap(game)).toMatchObject({ status: "unavailable", total: 1, unplaced: 1, points: [] });
  });

  it.each([-121, 14981])("rejects y outside the separate vertical bounds (%s)", (y) => {
    expect(buildMatchKillMap(match([kill({ position: { x: 3000, y } })])).points).toEqual([]);
  });

  it("does not substitute wards or a player position when the kill position is absent", () => {
    const game = match([kill({ position: undefined })]);
    game.raw.nxt5 = { timelineSummary: { wards: [{ x: 3000, y: 12000 }] } };
    expect(buildMatchKillMap(game).points).toEqual([]);
  });

  it("uses frame time only for an absent timestamp, preserving explicit invalid values", () => {
    expect(buildMatchKillMap(match([kill({ timestamp: undefined })])).points[0].timestamp).toBe(60000);
    for (const value of [null, "", " ", -1, NaN, Infinity, false]) {
      expect(buildMatchKillMap(match([kill({ timestamp: value })])).points).toEqual([]);
    }
    expect(buildMatchKillMap(match(undefined, { raw: { nxt5: { timelineEvents: [kill({ timestamp: undefined })] } } })).points).toEqual([]);
  });

  it("separates missing, known empty, summary-only and missing combat events", () => {
    expect(buildMatchKillMap(match(undefined, { raw: {} })).status).toBe("absent");
    expect(buildMatchKillMap(match(undefined, { raw: { nxt5: { timelineEvents: [] } } })).status).toBe("absent");
    expect(buildMatchKillMap(match([])).status).toBe("empty");
    expect(buildMatchKillMap(match(undefined, { raw: { nxt5: { timelineSummary: { available: true }, timelineEvents: [] } } })).status).toBe("unavailable");
    const game = match([]);
    game.participants[0].kills = 3;
    expect(buildMatchKillMap(game)).toMatchObject({ status: "unavailable", partial: true, total: 0 });
  });

  it("counts plotted points separately from recorded or missing events", () => {
    const game = match([kill(), kill({ timestamp: 120000, position: null }), kill({ timestamp: 180000, killerId: 6, victimId: 1 })]);
    const result = buildMatchKillMap(game);
    expect(result).toMatchObject({ status: "ready", total: 3, unplaced: 1, counts: { ALLY: 1, ENEMY: 1, UNKNOWN: 0 }, partial: true });
    game.participants[0].kills = 5;
    expect(buildMatchKillMap(game).partial).toBe(true);
  });

  it.each([12, 21, 30, "bad", " ", 0])("does not project map %s onto Summoner's Rift", (mapId) => {
    const game = match(); game.raw.info.mapId = mapId;
    expect(buildMatchKillMap(game).status).toBe("unsupported");
  });

  it("accepts legacy missing map IDs, but rejects conflicting explicit IDs", () => {
    const game = match(); delete game.raw.info.mapId;
    expect(buildMatchKillMap(game)).toMatchObject({ status: "ready", mapId: null });
    game.map_id = 11; game.raw.info.mapId = 12;
    expect(buildMatchKillMap(game).status).toBe("unsupported");
  });

  it("sorts events without mutating input and cannot retain points across matches", () => {
    const first = match([kill({ timestamp: 120000 }), kill({ timestamp: 10000 })]);
    const before = JSON.stringify(first);
    const a = buildMatchKillMap(first);
    const b = buildMatchKillMap(match([kill()], { id: "match-b" }));
    expect(a.points.map((point) => point.timestamp)).toEqual([10000, 120000]);
    expect(a.points[0].id).not.toBe(b.points[0].id);
    expect(buildMatchKillMap(match([], { id: "match-c" })).points).toEqual([]);
    expect(JSON.stringify(first)).toBe(before);
    expect(buildMatchKillMap(first)).toEqual(a);
  });
});
