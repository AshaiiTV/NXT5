import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { useMatchDetails } from "../hooks/useMatchDetails.js";
import { csAtMinute } from "../utils/match-timeline.js";
import { matchTimelineFrames, objectiveEvents } from "../pages/workspace/workspace-shared.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanups = [];
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.clearAllMocks(); });

function mount(team = "a", match = "one") {
  const requests = [];
  apiFetch.mockImplementation((_url, options) => new Promise((resolve, reject) => requests.push({ options, resolve, reject })));
  let state, renderer;
  function View({ team, match, version = 0 }) { state = useMatchDetails(team, match, version); return <output>{state.loading ? "loading" : state.detail?.id || state.error}</output>; }
  act(() => { renderer = TestRenderer.create(<View team={team} match={match} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return { requests, get state() { return state; },
    navigate(team, match, version = 0) { act(() => renderer.update(<View team={team} match={match} version={version} />)); },
    async resolve(index, teamId, id) { await act(async () => requests[index].resolve({ matches: [{ id, team_id: teamId, participants: [] }] })); },
  };
}

describe("match detail lifecycle in React", () => {
  it("finishes loading a direct match link on the first mount", async () => {
    const app = mount();
    expect(app.state.loading).toBe(true);
    await app.resolve(0, "a", "one");
    expect(app.state.loading).toBe(false);
    expect(app.state.detail.id).toBe("one");
    expect(app.requests).toHaveLength(1);
  });
  it("restarts a cancelled match after rapid A → B → A navigation", async () => {
    const app = mount();
    app.navigate("a", "two");
    app.navigate("a", "one");
    expect(app.requests[0].options.signal.aborted).toBe(true);
    expect(app.requests[1].options.signal.aborted).toBe(true);
    await app.resolve(0, "a", "one");
    await app.resolve(1, "a", "two");
    expect(app.state.loading).toBe(true);
    await app.resolve(2, "a", "one");
    expect(app.state.loading).toBe(false);
    expect(app.state.detail.id).toBe("one");
  });
  it("isolates team changes even if an old response arrives later", async () => {
    const app = mount();
    app.navigate("b", "one");
    await app.resolve(1, "b", "one");
    await app.resolve(0, "a", "one");
    expect(app.state.detail.team_id).toBe("b");
    app.navigate("", "");
    expect(app.state.detail).toBeNull();
    expect(app.state.loading).toBe(false);
  });
  it("exposes errors and can retry without an orphaned request lock", async () => {
    const app = mount();
    await act(async () => app.requests[0].reject(new Error("Indisponible")));
    expect(app.state.error).toBe("Indisponible");
    act(() => app.state.retry());
    await app.resolve(1, "a", "one");
    expect(app.state.error).toBe("");
    expect(app.state.loading).toBe(false);
  });
  it("reloads a previously cached game after a successful bootstrap refresh", async () => {
    const app = mount();
    await app.resolve(0, "a", "one");
    app.navigate("a", "one", 2);
    expect(app.state.loading).toBe(true);
    expect(app.state.detail).toBeNull();
    expect(app.requests).toHaveLength(2);
    await act(async () => app.requests[1].resolve({ matches: [{ id: "one", team_id: "a", result: "Victoire" }] }));
    expect(app.state.detail.result).toBe("Victoire");
  });
});

describe("CS milestone availability", () => {
  it("does not use a 15-minute final frame for CS10 or CS20", () => {
    const row = { participantId: 1, match: { duration: "15:00", raw: { timeline: { info: { frames: [{ timestamp: 900000, participantFrames: { 1: { minionsKilled: 114 } } }] } } } } };
    expect(csAtMinute(row, 20)).toBeNull();
    expect(csAtMinute(row, 10)).toBeNull();
  });
  it("preserves absent milestone values rather than converting null to zero", () => {
    const row = { participantId: 1, match: { raw: { info: { gameDuration: 900 }, nxt5: { timelineSummary: { csMilestones: { 1: { cs10: null, cs20: 114 } } } } } } };
    expect(csAtMinute(row, 10)).toBeNull();
    expect(csAtMinute(row, 20)).toBeNull();
  });
});

it("retains objective timing from compact bootstrap without implying a complete timeline", () => {
  const match = {
    participants: [{ team_key: "ALLY", raw: { teamId: 100, participantId: 1 } }],
    raw: { nxt5: { objectiveEvents: [
      { type: "ELITE_MONSTER_KILL", timestamp: 1230000, killerTeamId: 200, monsterType: "BARON_NASHOR" },
      { type: "ELITE_MONSTER_KILL", timestamp: 360000, killerId: 1, monsterType: "DRAGON", monsterSubType: "FIRE_DRAGON" },
    ] } },
  };
  expect(objectiveEvents(match)).toMatchObject([
    { label: "Fire Dragon", time: "6:00", teamKey: "ALLY", side: "BLUE" },
    { label: "Nashor", time: "20:30", teamKey: "ENEMY", side: "RED" },
  ]);
  expect(matchTimelineFrames(match)).toEqual([]);
  match.raw.timeline = { info: { frames: [{ events: [{ type: "ELITE_MONSTER_KILL", timestamp: 900000, killerTeamId: 100, monsterType: "RIFTHERALD" }] }] } };
  expect(objectiveEvents(match)).toMatchObject([{ label: "Herald", time: "15:00", teamKey: "ALLY" }]);
});
