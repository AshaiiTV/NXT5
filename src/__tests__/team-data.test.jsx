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

function mount(routeSearch = "", historyOptions = {}, storeOverride = null) {
  const requests = [], renders = [];
  apiFetch.mockImplementation((url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })));
  const store = storeOverride || { mergeAvailability: (rows) => rows };
  let state, renderer;
  function View({ search }) {
    state = useTeamData(store, search, historyOptions);
    renders.push({ teamId: state.data.selectedTeamId, matches: state.data.matches.map((match) => match.id), loading: state.loading, complete: state.data.historyComplete });
    return <output>{state.data.matches.length}</output>;
  }
  act(() => { renderer = TestRenderer.create(<View search={routeSearch} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return {
    requests, renders, get state() { return state; },
    select(id) { act(() => state.setSelectedTeamId(id)); },
    navigate(search) { act(() => renderer.update(<View search={search} />)); },
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

// Régression du commit b818225 (branche feat/pricing-validation) : une équipe
// supprimée ou dont l’accès a été retiré ne reste pas affichée.
describe("revoked team membership", () => {
  const forbidden = () => Object.assign(new Error("Accès à cette équipe refusé."), { status: 403 });
  const empty = () => page(null, [], 0, { teams: [], players: [], reports: [] });

  it("clears a revoked team, reloads memberships and opens a remaining team", async () => {
    const app = mount();
    await app.resolve(0, page("a", games("a", 2)));
    app.refresh();
    await app.reject(1, forbidden());
    expect(app.state.bootstrapReady).toBe(false);
    expect(app.state.selectedTeamId).toBeNull();
    expect(app.state.data.teams).toEqual([]);
    expect(app.state.data.matches).toEqual([]);
    expect(app.state.apiError).toBe("");
    expectRequest(app.requests[2]);
    expect(new URL(app.requests[2].url, "https://nxt5.test").searchParams.has("teamId")).toBe(false);
    await app.resolve(2, page("b", games("b", 1), 0, { teams: [teams[1]] }));
    expect(app.state.selectedTeamId).toBe("b");
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.data.matches.map((match) => match.id)).toEqual(["b-1"]);
    expect(app.state.apiError).toBe("");
  });

  it("reaches the team-less state when the last team was removed", async () => {
    const app = mount();
    await app.resolve(0, page("a", games("a", 2)));
    app.select("b");
    await app.reject(1, forbidden());
    await app.resolve(2, empty());
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.selectedTeamId).toBeNull();
    expect(app.state.data.teams).toEqual([]);
    expect(app.state.apiError).toBe("");
    expect(app.requests).toHaveLength(3);
  });

  it("does not restore the revoked team if the membership reload fails", async () => {
    const app = mount();
    await app.resolve(0, page("a", games("a", 2)));
    app.refresh();
    await app.reject(1, forbidden());
    await app.reject(2);
    expect(app.state.bootstrapReady).toBe(false);
    expect(app.state.data.teams).toEqual([]);
    expect(app.state.apiError).toBeTruthy();
    expect(app.requests).toHaveLength(3);
    app.refresh();
    expect(new URL(app.requests[3].url, "https://nxt5.test").searchParams.has("teamId")).toBe(false);
    await app.resolve(3, empty());
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.data.teams).toEqual([]);
  });

  it("keeps a forbidden linked team as an explicit error without opening another team", async () => {
    const app = mount("?team=forbidden&match=private");
    await app.reject(0, forbidden());
    expect(app.state.apiError).toContain("Accès à cette équipe refusé");
    expect(app.state.selectedTeamId).toBe("forbidden");
    expect(app.requests).toHaveLength(1);
  });

  it("clears the deleted team's snapshot as soon as the selection is emptied", async () => {
    const app = mount();
    await app.resolve(0, page("a", games("a", 2)));
    app.select(null);
    expect(app.state.data.teams).toEqual([]);
    expect(app.state.data.matches).toEqual([]);
    expect(app.state.bootstrapReady).toBe(false);
  });
});


function demand(app) {
  let promise;
  act(() => { promise = app.state.ensureHistory().catch(error => error); });
  return promise;
}

describe("progressive team history lifecycle in React", () => {
  it("opens the workspace after one bounded page without fetching old games", async () => {
    const app = mount("?team=a");
    const history = games("a", 205);
    await app.resolve(0, page("a", history));
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.loading).toBe(false);
    expect(app.state.historyLoading).toBe(false);
    expect(app.state.data.historyComplete).toBe(false);
    expect(app.state.data.matches).toEqual(history.slice(0, 100));
    expect(app.state.loadingProgress).toEqual({ loaded: 100, total: 205 });
    expect(app.requests).toHaveLength(1);
  });

  it("deduplicates explicit requests and publishes follow-up pages atomically", async () => {
    const app = mount();
    const history = games("a", 205);
    await app.resolve(0, page("a", history));
    const first = demand(app), second = demand(app);
    expect(app.requests).toHaveLength(2);
    expect(app.state.historyLoading).toBe(true);
    expectRequest(app.requests[1], { offset: 100, teamId: "a", matchesOnly: true });
    await app.resolve(1, page("a", history, 100));
    expect(app.state.data.matches).toHaveLength(100);
    expect(app.state.data.historyComplete).toBe(false);
    expect(app.state.loadingProgress).toEqual({ loaded: 200, total: 205 });
    await app.resolve(2, page("a", history, 200));
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(app.state.data.matches).toEqual(history);
    expect(app.state.data.historyComplete).toBe(true);
    expect(app.state.historyLoading).toBe(false);
    expect(app.renders.every(render => !render.complete || render.matches.length === 205)).toBe(true);
    expect(app.renders.some(render => render.matches.length === 200)).toBe(false);
    expect(await demand(app)).toBe(true);
    expect(app.requests).toHaveLength(3);
  });

  it("awaits complete refreshes for analysis routes while making metadata usable", async () => {
    const app = mount("?team=a", { requireHistory: true });
    const history = games("a", 101);
    await app.resolve(0, page("a", history));
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.data.historyComplete).toBe(false);
    expect(app.state.historyLoading).toBe(true);
    await app.resolve(1, page("a", history, 100));
    expect(app.state.data.historyComplete).toBe(true);
    const next = games("a", 102, "refresh");
    let complete;
    act(() => { complete = app.state.refreshAll({ throwOnError: true }); });
    await app.resolve(2, page("a", next));
    expect(app.state.data.matches).toEqual(history);
    await app.resolve(3, page("a", next, 100));
    expect(await complete).toBe(true);
    expect(app.state.data.matches).toEqual(next);
  });

  it("preserves linked archive and game selection through on-demand pagination", async () => {
    const app = mount("?team=b&match=b-101&archive=old-group");
    expect(new URL(app.requests[0].url, "https://nxt5.test").searchParams.get("archive")).toBe("old-group");
    const history = games("b", 101);
    await app.resolve(0, page("b", history, 0, { matchArchives: [{ id: "old-group" }] }));
    const done = demand(app);
    expectRequest(app.requests[1], { teamId: "b", offset: 100, matchesOnly: true });
    await app.resolve(1, page("b", history, 100));
    expect(await done).toBe(true);
    expect(app.state.data.matches.find(match => match.id === "b-101")).toBeDefined();
    expect(app.state.data.matchArchives[0].id).toBe("old-group");
    app.navigate("?team=b&archive=another-group");
    expect(new URL(app.requests[2].url, "https://nxt5.test").searchParams.get("archive")).toBe("another-group");
  });

  it("follows changed team links without overriding manual selection on an unchanged URL", async () => {
    const app = mount("?team=a&match=a-1");
    await app.resolve(0, page("a", games("a", 1)));
    app.navigate("?team=b&match=b-1");
    expect(app.state.bootstrapReady).toBe(false);
    await app.resolve(1, page("b", games("b", 1)));
    app.select("a");
    await app.resolve(2, page("a", games("a", 1)));
    expect(app.state.selectedTeamId).toBe("a");
    expect(app.requests).toHaveLength(3);
  });

  it("aborts old-team pagination and ignores a late response after switching teams", async () => {
    const app = mount();
    const old = games("a", 205), other = games("b", 101);
    await app.resolve(0, page("a", old));
    const obsolete = demand(app);
    app.select("b");
    expect(app.requests[1].options.signal.aborted).toBe(true);
    expect(app.state.bootstrapReady).toBe(false);
    await app.resolve(2, page("b", other));
    expect(app.state.data.selectedTeamId).toBe("b");
    const done = demand(app);
    await app.resolve(1, page("a", old, 100));
    expect(await obsolete).toHaveProperty("name", "AbortError");
    expect(app.state.data.selectedTeamId).toBe("b");
    await app.resolve(3, page("b", other, 100));
    expect(await done).toBe(true);
    expect(app.state.data.matches).toEqual(other);
    expect(app.state.historyError).toBe("");
  });

  it("ignores obsolete history and refresh responses for the same team", async () => {
    const app = mount("?team=a");
    const old = games("a", 101), fresh = games("a", 2, "fresh");
    await app.resolve(0, page("a", old));
    const obsolete = demand(app);
    app.refresh({ history: false });
    expect(app.requests[1].options.signal.aborted).toBe(true);
    await app.resolve(2, page("a", fresh));
    await app.resolve(1, page("a", old, 100));
    expect(await obsolete).toHaveProperty("name", "AbortError");
    expect(app.state.data.matches).toEqual(fresh);
    expect(app.state.data.historyComplete).toBe(true);
  });

  it("keeps a recent snapshot usable after history fails and retries from a fresh first page", async () => {
    const app = mount("?team=a");
    const initial = games("a", 101), next = games("a", 102, "new");
    await app.resolve(0, page("a", initial));
    const failed = demand(app);
    await app.reject(1);
    expect(await failed).toBeInstanceOf(Error);
    expect(app.state.historyError).toBeTruthy();
    expect(app.state.apiError).toBe("");
    expect(app.state.bootstrapReady).toBe(true);
    expect(app.state.data.matches).toEqual(initial.slice(0, 100));
    expect(app.state.data.historyComplete).toBe(false);
    const retried = demand(app);
    expectRequest(app.requests[2], { teamId: "a" });
    await app.resolve(2, page("a", next));
    await app.resolve(3, page("a", next, 100));
    expect(await retried).toBe(true);
    expect(app.state.data.matches).toEqual(next);
    expect(app.state.historyError).toBe("");
  });

  it("reports failed initial mutation refreshes without losing the last complete snapshot", async () => {
    const app = mount("?team=a");
    const initial = games("a", 2);
    await app.resolve(0, page("a", initial));
    let result;
    act(() => { result = app.state.refreshAll({ throwOnError: true }).catch(error => error); });
    const failure = new Error("Réseau indisponible");
    await app.reject(1, failure);
    expect(await result).toBe(failure);
    expect(app.state.apiError).toBe(failure.message);
    expect(app.state.data.matches).toEqual(initial);
  });

  it("retains complete analyses when a demanded refresh fails on a later page", async () => {
    const app = mount("?team=a", { requireHistory: true });
    const initial = games("a", 2), next = games("a", 101, "next");
    await app.resolve(0, page("a", initial));
    let result;
    act(() => { result = app.state.refreshAll({ throwOnError: true }).catch(error => error); });
    await app.resolve(1, page("a", next));
    await app.reject(2);
    expect(await result).toBeInstanceOf(Error);
    expect(app.state.data.matches).toEqual(initial);
    expect(app.state.data.historyComplete).toBe(true);
    expect(app.state.historyError).toBeTruthy();
  });

  it("removes revoked team data if access is lost while paging", async () => {
    const app = mount("?team=a");
    await app.resolve(0, page("a", games("a", 101)));
    const result = demand(app);
    await app.reject(1, Object.assign(new Error("Accès à cette équipe refusé."), { status: 403 }));
    expect(app.state.data.teams).toEqual([]);
    expect(app.state.bootstrapReady).toBe(false);
    await app.resolve(2, page("b", games("b", 2), 0, { teams: [{ id: "b" }] }));
    expect(await result).toHaveProperty("status", 403);
    expect(app.state.data.selectedTeamId).toBe("b");
    expect(app.state.bootstrapReady).toBe(true);
  });

  it("preserves a planning save acknowledged while a complete refresh is paging", async () => {
    let confirmed = [];
    const store = { mergeAvailability: rows => [
      ...rows.filter(row => !confirmed.some(saved => saved.id === row.id)), ...confirmed,
    ] };
    const app = mount("?team=a", { requireHistory: true }, store);
    const initial = games("a", 2), next = games("a", 101, "next");
    const availability = { id: "slot", player_id: "a-player", available: false };
    await app.resolve(0, page("a", initial, 0, { availability: [availability] }));
    app.refresh();
    await app.resolve(1, page("a", next, 0, { availability: [availability] }));
    confirmed = [{ ...availability, available: true }];
    act(() => app.state.setData(current => ({ ...current, availability: confirmed })));
    await app.resolve(2, page("a", next, 100));
    expect(app.state.data.matches).toEqual(next);
    expect(app.state.data.availability).toEqual(confirmed);
  });

  it.each([
    ["overlapping pages", history => page("a", history, 100, { matches: [history[99], ...history.slice(101)] })],
    ["an incomplete final page", history => page("a", history, 100, { matches: history.slice(100, 199) })],
    ["a changing total", history => ({ ...page("a", history, 100), pagination: { offset: 100, total: 201, hasMore: false } })],
    ["a different team", history => page("b", history, 100)],
    ["an empty follow-up", history => page("a", history, 100, { matches: [] })],
    ["a repeated cursor", history => ({ ...page("a", history, 100), pagination: { offset: 100, total: 200, nextOffset: 100, hasMore: true } })],
  ])("never presents %s as a complete history", async (_name, invalid) => {
    const app = mount("?team=a");
    const history = games("a", 200);
    await app.resolve(0, page("a", history));
    const result = demand(app);
    await app.resolve(1, invalid(history));
    expect(await result).toBeInstanceOf(Error);
    expect(app.state.historyError).toBeTruthy();
    expect(app.state.data.historyComplete).toBe(false);
    expect(app.state.data.matches).toEqual(history.slice(0, 100));
    expect(app.renders.every(render => render.complete !== true)).toBe(true);
  });

  it("finishes empty and one-page histories without any additional request", async () => {
    const app = mount();
    await app.resolve(0, page("a", []));
    expect(app.state.data.historyComplete).toBe(true);
    expect(app.state.bootstrapReady).toBe(true);
    expect(await demand(app)).toBe(true);
    expect(app.requests).toHaveLength(1);
    expect(app.state.loadingProgress).toEqual({ loaded: 0, total: 0 });
  });
});
