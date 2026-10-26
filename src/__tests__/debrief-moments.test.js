import { describe, expect, it } from "vitest";
import { buildDebriefMoments } from "../utils/debrief-moments.js";

const participants = () => [
  { team_key: "ALLY", champion: "Ahri", summoner_name: "Alpha", role: "MID", raw: { participantId: 1, teamId: 100 } },
  { team_key: "ALLY", champion: "Vi", summoner_name: "Beta", role: "JGL", raw: { participantId: 2, teamId: 100 } },
  { team_key: "ENEMY", champion: "Lux", summoner_name: "Gamma", role: "MID", raw: { participantId: 6, teamId: 200 } },
  { team_key: "ENEMY", champion: "Jinx", summoner_name: "Delta", role: "ADC", raw: { participantId: 7, teamId: 200 } },
];
const kill = (overrides = {}) => ({ type: "CHAMPION_KILL", timestamp: 60000, killerId: 1, victimId: 6, assistingParticipantIds: [2], ...overrides });
const objective = (overrides = {}) => ({ type: "ELITE_MONSTER_KILL", timestamp: 300000, killerId: 2, killerTeamId: 100, monsterType: "DRAGON", ...overrides });
const match = (events = [], overrides = {}) => ({ id: "match-a", team_id: "team-a", side: "Blue Side", participants: participants(), raw: { timeline: { info: { frames: [{ timestamp: 60000, events }] } } }, ...overrides });
const fight = () => [kill(), kill({ timestamp: 80000, victimId: 7 }), kill({ timestamp: 95000, killerId: 6, victimId: 1, assistingParticipantIds: [] })];

describe("Visual debrief moments", () => {
  it("groups actual elimination windows and retains normalized player identities", () => {
    const result = buildDebriefMoments(match([...fight(), objective()]));
    expect(result).toMatchObject({ coverage: "detailed", totalMoments: 2, hasUnattributedEvents: false, partial: false });
    expect(result.moments[0]).toMatchObject({ kind: "fight", timestamp: 60000, endTimestamp: 95000, allyKills: 2, enemyKills: 1, allyDeaths: 1, enemyDeaths: 2, teamKey: "ALLY" });
    expect(result.moments[0].events[0]).toMatchObject({ killerId: 1, victimId: 6, killer: { participantId: 1, name: "Alpha", champion: "Ahri", role: "MID" }, victim: { champion: "Lux" }, assists: [{ participantId: 2, champion: "Vi" }], isExecution: false });
    expect(result.moments[1]).toMatchObject({ kind: "objective", objectiveKey: "dragons", timestamp: 300000, teamKey: "ALLY", allyKills: null });
  });

  it("uses the 24-second recorded-event gap without claiming a spatial teamfight", () => {
    const result = buildDebriefMoments(match([kill({ timestamp: 0 }), kill({ timestamp: 24000, victimId: 7 }), kill({ timestamp: 48001, victimId: 6 })]));
    expect(result.moments).toHaveLength(1);
    expect(result.moments[0]).toMatchObject({ timestamp: 0, endTimestamp: 24000, allyKills: 2 });
    expect(result.moments[0].events).toHaveLength(2);
  });

  it.each([
    (frames) => ({ timeline: { info: { frames } } }),
    (frames) => ({ metadata: { timeline: { info: { frames } } } }),
    (frames) => ({ timeline: { frames } }),
    (frames) => ({ timeline: { timeline: { info: { frames } } } }),
    (frames) => ({ timeline: { timeline: { frames } } }),
  ])("reads each stored full timeline representation (%#)", (source) => {
    const result = buildDebriefMoments(match(undefined, { raw: source([{ timestamp: 60000, events: fight() }]) }));
    expect(result.moments[0].allyKills).toBe(2);
    expect(result.coverage).toBe("detailed");
  });

  it("prioritizes populated detailed frames and never merges a compact duplicate", () => {
    const game = match([...fight(), objective(), objective()]);
    game.raw.metadata = { timeline: { info: game.raw.timeline.info } };
    game.raw.timeline = { info: { frames: [] } };
    game.raw.nxt5 = { timelineEvents: [objective({ timestamp: 400000, monsterType: "BARON_NASHOR" })] };
    const result = buildDebriefMoments(game);
    expect(result.totalMoments).toBe(2);
    expect(result.moments.map((moment) => moment.objectiveKey)).toEqual([null, "dragons"]);
  });

  it("reads compact events and older compact objective records without fabricating combat", () => {
    for (const field of ["timelineEvents", "objectiveEvents"]) {
      const result = buildDebriefMoments(match(undefined, { raw: { nxt5: { [field]: [objective()] } } }));
      expect(result).toMatchObject({ coverage: "events", totalMoments: 1 });
      expect(result.moments[0]).toMatchObject({ kind: "objective", allyKills: null, enemyDeaths: null });
    }
  });

  it("keeps ally/enemy orientation when our team plays red", () => {
    const game = match([...fight(), objective({ killerTeamId: 200 })], { side: "Côté rouge" });
    game.participants.forEach((row) => { row.raw.teamId = row.team_key === "ALLY" ? 200 : 100; });
    const result = buildDebriefMoments(game);
    expect(result.moments.map((moment) => moment.teamKey)).toEqual(["ALLY", "ALLY"]);
  });

  it("attributes a destroyed tower by its recorded owner when minions deliver the final hit", () => {
    const result = buildDebriefMoments(match([{ type: "BUILDING_KILL", timestamp: 800000, killerId: 0, teamId: 200, buildingType: "TOWER_BUILDING", towerType: "OUTER_TURRET", laneType: "MID_LANE" }]));
    expect(result.moments[0]).toMatchObject({ kind: "building", objectiveKey: "towers", teamKey: "ALLY" });
    expect(result.moments[0].events[0].isExecution).toBe(false);
  });

  it("does not assign executions to the victim's opponent", () => {
    const result = buildDebriefMoments(match([kill({ killerId: 0, victimId: 1 }), kill({ timestamp: 70000, victimId: 6 })]));
    expect(result.hasUnattributedEvents).toBe(false);
    expect(result.moments[0]).toMatchObject({ allyKills: 1, enemyKills: 0, allyDeaths: 1, enemyDeaths: 1 });
    expect(result.moments[0].events[0]).toMatchObject({ killer: null, teamKey: null, isExecution: true, victimTeamKey: "ALLY" });
  });

  it("leaves incomplete counts unknown instead of interpreting missing attribution as zero", () => {
    const result = buildDebriefMoments(match([kill({ killerId: 999 }), kill({ timestamp: 70000, victimId: 7 })]));
    expect(result).toMatchObject({ partial: true, hasUnattributedEvents: true });
    expect(result.moments[0]).toMatchObject({ allyKills: null, enemyKills: null, allyDeaths: 0, enemyDeaths: 2, teamKey: null });
    expect(result.moments[0].events[0].isExecution).toBe(false);
  });

  it.each(["stored", "riot", "snapshot", "conflicting-id"])("does not resolve ambiguous participant identities (%s)", (source) => {
    const game = match(fight());
    const snapshot = {};
    if (source === "stored") game.participants.push({ ...game.participants[0], champion: "Zed" });
    if (source === "riot") game.raw.info = { participants: [{ participantId: 1, teamId: 100 }, { participantId: 1, teamId: 200 }] };
    if (source === "snapshot") snapshot.participants = [{ participantId: 1, teamKey: "ALLY" }, { participantId: 1, teamKey: "ENEMY" }];
    if (source === "conflicting-id") game.participants[0].participantId = 2;
    const result = buildDebriefMoments(game, snapshot);
    expect(result.hasUnattributedEvents).toBe(true);
    expect(result.moments[0].allyKills).toBeNull();
    expect(result.moments[0].events[0].killer).toBeNull();
  });

  it("rejects contradictory objective attribution and same-team champion kills", () => {
    const result = buildDebriefMoments(match([objective({ killerTeamId: 200 }), kill({ victimId: 2 }), kill({ timestamp: 70000 })]));
    expect(result.moments.every((moment) => moment.teamKey === null)).toBe(true);
    expect(result.hasUnattributedEvents).toBe(true);
  });

  it("keeps one conflicting event copy but does not choose an arbitrary killer", () => {
    const result = buildDebriefMoments(match([kill(), kill({ killerId: 2 }), kill({ timestamp: 70000, victimId: 7 })]));
    expect(result.moments[0].events).toHaveLength(2);
    expect(result.moments[0].events[0].killer).toBeNull();
    expect(result.moments[0].allyKills).toBeNull();
    expect(result.partial).toBe(true);
  });

  it("does not turn repeated unresolved events into an invented combat window", () => {
    const result = buildDebriefMoments(match([kill({ victimId: null }), kill({ victimId: null })]));
    expect(result).toMatchObject({ totalMoments: 0, moments: [], partial: true, hasUnattributedEvents: true });
  });

  it("supports string raw rows and deduplicates known assistants", () => {
    const game = match([kill({ assistingParticipantIds: [2, "2", 1, 6, 999, 0] }), kill({ timestamp: 70000, victimId: 7 })]);
    game.participants[0].raw = JSON.stringify({ participant: game.participants[0].raw });
    const result = buildDebriefMoments({ ...game, raw: JSON.stringify(game.raw) });
    expect(result.moments[0].events[0].assists).toEqual([{ participantId: 2, name: "Beta", champion: "Vi", role: "JGL" }]);
  });

  it.each([null, "", " ", false, -1, NaN, Infinity, {}, "bad"])("rejects explicit invalid timestamps without substituting frame time (%s)", (timestamp) => {
    const result = buildDebriefMoments(match([objective({ timestamp })]));
    expect(result).toMatchObject({ moments: [], partial: true });
  });

  it("preserves timestamp zero and only uses a frame timestamp when event time is absent", () => {
    expect(buildDebriefMoments(match([objective({ timestamp: 0 })])).moments[0].timestamp).toBe(0);
    expect(buildDebriefMoments(match([objective({ timestamp: undefined })])).moments[0].timestamp).toBe(60000);
    expect(buildDebriefMoments(match(undefined, { raw: { nxt5: { timelineEvents: [objective({ timestamp: undefined })] } } })).moments).toEqual([]);
  });

  it("distinguishes missing, summary-only, and known empty detailed sources", () => {
    expect(buildDebriefMoments(match(undefined, { raw: {} })).coverage).toBe("missing");
    expect(buildDebriefMoments(match(undefined, { raw: { nxt5: { timelineEvents: [], timelineSummary: { available: true } } } })).coverage).toBe("milestones");
    expect(buildDebriefMoments(match([]))).toMatchObject({ coverage: "detailed", moments: [], partial: false });
    expect(buildDebriefMoments(match([]), { facts: { deaths: { ally: 1, enemy: 2 } } }).partial).toBe(true);
  });

  it.each([null, undefined, [], "not json", "[]", "null", { timeline: { info: { frames: [null, {}, { events: [null, {}, false] }] } } }])("handles malformed raw safely (%#)", (raw) => {
    expect(buildDebriefMoments(match(undefined, { raw })).moments).toEqual([]);
  });

  it("ignores a publication from another match or team", () => {
    for (const identity of [{ entityId: "match-other" }, { teamId: "team-other" }]) {
      const result = buildDebriefMoments(match(fight()), { ...identity, participants: [{ participantId: 1, champion: "Wrong", teamKey: "ENEMY" }] });
      expect(result.moments[0].events[0].killer.champion).toBe("Ahri");
      expect(result.moments[0].allyKills).toBe(2);
    }
  });

  it("returns at most six deterministic highlights, sorted in time, and discloses omitted candidates", () => {
    const towers = Array.from({ length: 8 }, (_, i) => ({ type: "BUILDING_KILL", timestamp: 200000 + i * 60000, killerId: 1, teamId: 200, buildingType: "TOWER_BUILDING", laneType: "MID_LANE", towerType: "OUTER_TURRET" }));
    const game = match([...towers, ...fight(), objective({ timestamp: 100000 }), objective({ timestamp: 800000, monsterType: "BARON_NASHOR" })]);
    const result = buildDebriefMoments(game);
    expect(result).toMatchObject({ totalMoments: 11, coverage: "detailed" });
    expect(result.moments).toHaveLength(6);
    expect(result.moments[0].kind).toBe("fight");
    expect(result.moments[1].objectiveKey).toBe("dragons");
    expect(result.moments.at(-1).objectiveKey).toBe("barons");
    expect(result.moments.map((moment) => moment.timestamp)).toEqual([...result.moments.map((moment) => moment.timestamp)].sort((a, b) => a - b));
    expect(buildDebriefMoments(game)).toEqual(result);
  });
});
