import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { useTeamData } from "../hooks/useTeamData.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanups = [];
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.clearAllMocks(); });
const teams = [{ id: "a" }, { id: "b" }];
const games = (teamId, count, prefix = teamId) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}`, team_id: teamId }));

function page(teamId, history, offset = 0, extra = {}) {
  const hasMore = offset + 100 < history.length;
  return {
    selectedTeamId: teamId,
    ...(offset === 0 ? { teams, players: [{ id: `${teamId}-player`, team_id: teamId }], reports: [{ id: `${teamId}-report` }] } : {}),
    matches: history.slice(offset, offset + 100),
    pagination: { offset, limit: 100, total: history.length, nextOffset: hasMore ? offset + 100 : null, hasMore },
    ...extra,
  };
}

function mount() {
  const requests = [], renders = [];
  apiFetch.mockImplementation((url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })));
  const store = { mergeAvailability: (rows) => rows };
  let state, renderer;
  function View() {
    state = useTeamData(store);
    renders.push({ teamId: state.data.selectedTeamId, matches: state.data.matches.map((match) => match.id), loading: state.loading });
    return <output>{state.data.matches.length}</output>;
  }
  act(() => { renderer = TestRenderer.create(<View />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return {
    requests, renders, get state() { return state; },
    select(id) { act(() => state.setSelectedTeamId(id)); },
    refresh(options) { act(() => { void state.refreshAll(options); }); },
    async resolve(index, payload) { expect(requests[index], `request ${index} was started automatically`).toBeDefined(); await act(async () => requests[index].resolve(payload)); },
    async reject(index, error = new Error("Réseau indisponible")) { await act(async () => requests[index].reject(error)); },
  };
}

function expectRequest(request, { offset = 0, teamId, matchesOnly = false } = {}) {
  expect(request).toBeDefined();
  const url = new URL(request.url, "https://nxt5.test/");
  expect(url.pathname).toBe("/bootstrap");
  expect(url.searchParams.get("limit")).toBe("100");
  expect(url.searchParams.get("offset")).toBe(String(offset));
  if (teamId) expect(url.searchParams.get("teamId")).toBe(teamId);
  expect(url.searchParams.get("matchesOnly")).toBe(matchesOnly ? "1" : null);
}

describe("complete team history lifecycle in React", () => {
  it("automatically loads more than 100 games and publishes only the complete history", async () => {
    const app = mount();
    const history = games("a", 205);
    expectRequest(app.requests[0]);
    await app.resolve(0, page("a", history));
    expect(app.state.loading).toBe(true);
    expect(app.state.bootstrapReady).toBe(false);
    expect(app.state.data.matches).toEqual([]);
    expectRequest(app.requests[1], { offset: 100, teamId: "a", matchesOnly: true });
    await app.resolve(1, page("a", history, 100));
    expect(app.state.loading).toBe(true);
    expect(app.state.data.matches).toEqual([]);
    expectRequest(app.requests[2], { offset: 200, teamId: "a", matchesOnly: true });
    await app.resolve(2, page("a", history, 200));
    expect(app.state.loading).toBe(false);
    expect(app.state.apiError).toBe("");
    expect(app.state.data.matches).toEqual(history);
    expect(app.state.data.historyComplete).toBe(true);
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.data.teams).toEqual(teams);
    expect(app.state.data.players[0].id).toBe("a-player");
    expect(app.state.data.reports[0].id).toBe("a-report");
    expect(app.requests).toHaveLength(3);
    expect(app.renders.every((render) => [0, 205].includes(render.matches.length))).toBe(true);
  });

  it("loads every page on every refresh and retains the previous complete snapshot until success", async () => {
    const app = mount();
    const initial = games("a", 3, "initial");
    await app.resolve(0, page("a", initial));
    let previous = initial;
    for (let refresh = 0; refresh < 2; refresh += 1) {
      const start = app.requests.length;
      const next = games("a", 101 + refresh, `refresh-${refresh}`);
      const revision = app.state.data.bootstrapRevision;
      app.refresh();
      expectRequest(app.requests[start], { teamId: "a" });
      await app.resolve(start, page("a", next));
      expect(app.state.data.matches).toEqual(previous);
      expect(app.state.data.bootstrapRevision).toBe(revision);
      expect(app.state.loading).toBe(true);
      await app.resolve(start + 1, page("a", next, 100));
      expect(app.state.data.matches).toEqual(next);
      expect(app.state.data.bootstrapRevision).not.toBe(revision);
      expect(app.state.loading).toBe(false);
      previous = next;
    }
    expect(app.renders.every((render) => [0, 3, 101, 102].includes(render.matches.length))).toBe(true);
  });

  it("loads the full selected team and ignores a late page from the previous team", async () => {
    const app = mount();
    const original = games("a", 2), refreshed = games("a", 102, "old-request"), other = games("b", 101);
    await app.resolve(0, page("a", original));
    app.refresh();
    await app.resolve(1, page("a", refreshed));
    app.select("b");
    expect(app.requests[2].options.signal.aborted).toBe(true);
    expectRequest(app.requests[3], { teamId: "b" });
    await app.resolve(3, page("b", other));
    expect(app.state.data.matches).toEqual(original);
    await app.resolve(4, page("b", other, 100));
    await app.resolve(2, page("a", refreshed, 100));
    expect(app.state.selectedTeamId).toBe("b");
    expect(app.state.data.selectedTeamId).toBe("b");
    expect(app.state.data.matches).toEqual(other);
    expect(app.state.apiError).toBe("");
    expect(app.renders.some((render) => render.matches.includes("old-request-1"))).toBe(false);
    expect(app.renders.every((render) => [0, 2, 101].includes(render.matches.length))).toBe(true);
  });

  it("returns rapidly to the complete cached team without allowing the other team's late response", async () => {
    const app = mount();
    const original = games("a", 2), other = games("b", 102);
    await app.resolve(0, page("a", original));
    app.select("b");
    await app.resolve(1, page("b", other));
    app.select("a");
    expect(app.requests[2].options.signal.aborted).toBe(true);
    await app.resolve(2, page("b", other, 100));
    expect(app.state.selectedTeamId).toBe("a");
    expect(app.state.data.selectedTeamId).toBe("a");
    expect(app.state.data.matches).toEqual(original);
    expect(app.state.loading).toBe(false);
    expect(app.requests).toHaveLength(3);
  });

  it("ignores an obsolete response when a newer refresh for the same team has completed", async () => {
    const app = mount();
    await app.resolve(0, page("a", games("a", 1)));
    const obsolete = games("a", 101, "obsolete"), fresh = games("a", 2, "fresh");
    app.refresh();
    await app.resolve(1, page("a", obsolete));
    app.refresh();
    expect(app.requests[2].options.signal.aborted).toBe(true);
    await app.resolve(3, page("a", fresh));
    await app.resolve(2, page("a", obsolete, 100));
    expect(app.state.data.matches).toEqual(fresh);
    expect(app.state.loading).toBe(false);
    expect(app.renders.some((render) => render.matches.includes("obsolete-1"))).toBe(false);
  });

  it("retains the last complete history after a failed page and retries the whole refresh", async () => {
    const app = mount();
    const initial = games("a", 3, "initial"), next = games("a", 101, "next");
    await app.resolve(0, page("a", initial));
    const revision = app.state.data.bootstrapRevision;
    app.refresh();
    await app.resolve(1, page("a", next));
    await app.reject(2);
    expect(app.state.data.matches).toEqual(initial);
    expect(app.state.data.bootstrapRevision).toBe(revision);
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.apiError).toBeTruthy();
    expect(app.state.loading).toBe(false);
    app.refresh();
    expectRequest(app.requests[3], { teamId: "a" });
    expect(app.state.apiError).toBe("");
    await app.resolve(3, page("a", next));
    expect(app.state.data.matches).toEqual(initial);
    await app.resolve(4, page("a", next, 100));
    expect(app.state.data.matches).toEqual(next);
    expect(app.state.apiError).toBe("");
  });

  it("keeps the initial analysis unavailable after a failed page until a complete retry succeeds", async () => {
    const app = mount();
    const history = games("a", 101);
    await app.resolve(0, page("a", history));
    await app.reject(1);
    expect(app.state.bootstrapReady).toBe(false);
    expect(app.state.data.historyComplete).not.toBe(true);
    expect(app.state.data.matches).toEqual([]);
    expect(app.state.apiError).toBeTruthy();
    expect(app.state.loading).toBe(false);
    app.refresh();
    expectRequest(app.requests[2]);
    await app.resolve(2, page("a", history));
    expect(app.state.bootstrapReady).toBe(false);
    expect(app.state.data.matches).toEqual([]);
    await app.resolve(3, page("a", history, 100));
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.data.matches).toEqual(history);
    expect(app.state.apiError).toBe("");
  });

  it.each([
    ["overlapping pages", (history) => page("a", history, 100, { matches: [history[99], ...history.slice(101)] })],
    ["an incomplete final page", (history) => page("a", history, 100, { matches: history.slice(100, 199) })],
    ["a changing history total", (history) => ({ ...page("a", history, 100), pagination: { offset: 100, limit: 100, total: 201, nextOffset: null, hasMore: false } })],
    ["a page for a different team", (history) => page("b", history, 100)],
    ["an empty follow-up page", (history) => page("a", history, 100, { matches: [] })],
    ["a cursor that does not progress", (history) => ({ ...page("a", history, 100), pagination: { offset: 100, limit: 100, total: 200, nextOffset: 100, hasMore: true } })],
  ])("never publishes %s as a complete analysis", async (_name, invalidPage) => {
    const app = mount();
    const history = games("a", 200);
    await app.resolve(0, page("a", history));
    await app.resolve(1, invalidPage(history));
    expect(app.state.apiError).toBeTruthy();
    expect(app.state.loading).toBe(false);
    expect(app.state.data.matches).toEqual([]);
    expect(app.state.bootstrapReady).toBe(false);
    expect(app.renders.every((render) => render.matches.length === 0)).toBe(true);
    expect(app.requests).toHaveLength(2);
  });

  it("finishes an empty team's history without requesting another page", async () => {
    const app = mount();
    await app.resolve(0, page("a", []));
    expect(app.state.data.matches).toEqual([]);
    expect(app.state.selectedTeamId).toBe("a");
    expect(app.state.data.players[0].id).toBe("a-player");
    expect(app.state.loading).toBe(false);
    expect(app.state.apiError).toBe("");
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.requests).toHaveLength(1);
  });
});
