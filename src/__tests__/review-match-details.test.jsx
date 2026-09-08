import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { useReviewMatchDetails } from "../hooks/useReviewMatchDetails.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanups = [];
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.clearAllMocks(); });

function mount(team = "a", ids = ["one"], version = "") {
  const requests = [];
  apiFetch.mockImplementation((_url, options) => new Promise((resolve, reject) => requests.push({ options, resolve, reject })));
  let state, renderer;
  function View({ team, ids, version }) {
    state = useReviewMatchDetails(team, ids, version);
    return <output>{state.loading ? "loading" : state.matches.map((match) => match.id).join(",") || state.error}</output>;
  }
  act(() => { renderer = TestRenderer.create(<View team={team} ids={ids} version={version} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return {
    requests,
    get state() { return state; },
    get activeRequests() { return requests.filter((request) => !request.settled && !request.options.signal.aborted).length; },
    navigate(team, ids, version = "") { act(() => renderer.update(<View team={team} ids={ids} version={version} />)); },
    async resolve(index, matches) {
      const body = JSON.parse(requests[index].options.body);
      requests[index].settled = true;
      await act(async () => requests[index].resolve({ matches: matches ?? body.matchIds.map((id) => ({ id, team_id: body.teamId, raw: { complete: true }, participants: [] })) }));
    },
    async reject(index, error = new Error("Indisponible")) {
      requests[index].settled = true;
      await act(async () => requests[index].reject(error));
    },
    async resolveAll() {
      for (let index = 0; index < requests.length; index += 1) {
        if (!requests[index].settled) await this.resolve(index);
        expect(this.activeRequests).toBeLessThanOrEqual(3);
      }
    },
  };
}

describe("automatic review match details", () => {
  it("loads one game per response with at most three requests, deduplicating IDs and preserving review order", async () => {
    const ids = Array.from({ length: 43 }, (_, index) => `game-${index}`);
    const app = mount("a", [...ids, "game-0", "", null]);
    expect(app.requests).toHaveLength(3);
    expect(app.activeRequests).toBe(3);
    expect(app.state.complete).toBe(false);
    await app.resolve(2);
    await app.resolve(0);
    expect(app.requests).toHaveLength(5);
    expect(app.activeRequests).toBe(3);
    expect(app.state.loading).toBe(true);
    expect(app.state.matches).toHaveLength(2);
    await app.resolveAll();
    expect(app.requests).toHaveLength(43);
    expect(app.requests.every((request) => JSON.parse(request.options.body).matchIds.length === 1)).toBe(true);
    expect(app.state.matches.map((match) => match.id)).toEqual(ids);
    expect(app.state).toMatchObject({ loading: false, error: "", complete: true });
    app.navigate("a", [...ids]);
    expect(app.requests).toHaveLength(43);
    expect(app.state.complete).toBe(true);
  });

  it("aborts previous selections and never accepts late responses after A → B → A navigation", async () => {
    const app = mount();
    app.navigate("a", ["two"]);
    app.navigate("a", ["one"]);
    expect(app.requests).toHaveLength(3);
    expect(app.requests[0].options.signal.aborted).toBe(true);
    expect(app.requests[1].options.signal.aborted).toBe(true);
    await app.resolve(0);
    await app.resolve(1);
    expect(app.state).toMatchObject({ matches: [], loading: true, complete: false });
    await app.resolve(2);
    expect(app.state.matches.map((match) => match.id)).toEqual(["one"]);
    expect(app.state.complete).toBe(true);
  });

  it("isolates team and version changes, reuses the correct cache and clears empty selections", async () => {
    const app = mount("a", ["one", "two"]);
    await app.resolveAll();
    app.navigate("b", ["one"]);
    expect(app.state.matches).toEqual([]);
    await app.resolve(2);
    expect(app.state.matches[0].team_id).toBe("b");
    app.navigate("a", ["two"]);
    expect(app.requests).toHaveLength(3);
    expect(app.state.matches.map((match) => match.id)).toEqual(["two"]);
    app.navigate("a", ["two"], "refresh-1");
    expect(app.state).toMatchObject({ matches: [], loading: true, complete: false });
    await app.resolve(3);
    expect(app.state.complete).toBe(true);
    app.navigate("", ["two"]);
    expect(app.state).toMatchObject({ matches: [], loading: false, complete: false });
    app.navigate("a", []);
    expect(app.state).toMatchObject({ matches: [], loading: false, error: "", complete: true });
    expect(app.requests).toHaveLength(4);
  });

  it("ignores another team's late response without caching it", async () => {
    const app = mount();
    app.navigate("b", ["one"]);
    await app.resolve(1);
    await app.resolve(0);
    expect(app.state.matches[0].team_id).toBe("b");
    app.navigate("a", ["one"]);
    expect(app.requests).toHaveLength(3);
    expect(app.state.matches).toEqual([]);
    await app.resolve(2);
    expect(app.state.matches[0].team_id).toBe("a");
  });

  it("purges obsolete versions for the refreshed team while retaining another team's cache", async () => {
    const app = mount("a", ["one", "two"], "v1");
    await app.resolveAll();
    app.navigate("b", ["one"], "v1");
    await app.resolve(2);
    app.navigate("a", ["one"], "v2");
    await app.resolve(3);
    app.navigate("b", ["one"], "v1");
    expect(app.requests).toHaveLength(4);
    expect(app.state.complete).toBe(true);
    app.navigate("a", ["two"], "v1");
    expect(app.requests).toHaveLength(5);
    expect(app.state).toMatchObject({ matches: [], loading: true });
    await app.resolve(4);
    expect(app.state.complete).toBe(true);
  });

  it("retains at most 40 inactive games without evicting the active selection", async () => {
    const ids = Array.from({ length: 43 }, (_, index) => `game-${index}`);
    const app = mount("a", ids);
    await app.resolveAll();
    expect(app.state.matches).toHaveLength(43);
    expect(app.state.complete).toBe(true);
    // The oldest entry remains protected; only the two oldest inactive ones go.
    app.navigate("a", ["game-0"]);
    app.navigate("a", ["game-0", ...ids.slice(3)]);
    expect(app.requests).toHaveLength(43);
    expect(app.state.matches).toHaveLength(41);
    expect(app.state.complete).toBe(true);
    app.navigate("a", ["game-1", "game-2"]);
    expect(app.requests).toHaveLength(45);
    expect(app.requests.slice(43).map((request) => JSON.parse(request.options.body).matchIds)).toEqual([["game-1"], ["game-2"]]);
    await app.resolveAll();
    expect(app.state.complete).toBe(true);
  });

  it("continues the queue after a failure and retries only the missing games", async () => {
    const ids = Array.from({ length: 21 }, (_, index) => `game-${index}`);
    const app = mount("a", ids);
    await app.reject(1);
    expect(app.state.loading).toBe(true);
    await app.resolveAll();
    expect(app.state.matches).toHaveLength(20);
    expect(app.state).toMatchObject({ error: "Indisponible", loading: false, complete: false });
    app.navigate("a", [...ids]);
    expect(app.requests).toHaveLength(21);
    act(() => app.state.retry());
    expect(app.state).toMatchObject({ error: "", loading: true, complete: false });
    expect(app.state.matches).toHaveLength(20);
    expect(app.requests).toHaveLength(22);
    expect(JSON.parse(app.requests[21].options.body).matchIds).toEqual(["game-1"]);
    await app.resolve(21);
    expect(app.state.matches.map((match) => match.id)).toEqual(ids);
    expect(app.state).toMatchObject({ error: "", loading: false, complete: true });
  });

  it("reports absent IDs, rejects foreign and unsolicited games, and preserves valid rows on retry", async () => {
    const app = mount("a", ["one", "two", "three"]);
    await app.resolve(0, [
      { id: "one", team_id: "a", participants: [] },
      { id: "two", team_id: "a", participants: [] },
      { id: "unrequested", team_id: "a", participants: [] },
    ]);
    await app.resolve(1, [{ id: "two", team_id: "b", participants: [] }]);
    await app.resolve(2, []);
    expect(app.state.matches.map((match) => match.id)).toEqual(["one"]);
    expect(app.state).toMatchObject({ loading: false, complete: false });
    expect(app.state.error).toBe("Détail introuvable pour 2 games de cette review.");
    act(() => app.state.retry());
    expect(app.requests.slice(3).map((request) => JSON.parse(request.options.body).matchIds)).toEqual([["two"], ["three"]]);
    await app.resolveAll();
    expect(app.state.matches.map((match) => match.id)).toEqual(["one", "two", "three"]);
    expect(app.state).toMatchObject({ error: "", complete: true });
  });

  it("cancels queued games as well as active requests when the review changes", async () => {
    const app = mount("a", ["one", "two", "three", "four", "five"]);
    expect(app.requests).toHaveLength(3);
    app.navigate("a", ["other"]);
    expect(app.requests).toHaveLength(4);
    expect(app.requests.slice(0, 3).every((request) => request.options.signal.aborted)).toBe(true);
    await app.resolveAll();
    expect(app.requests).toHaveLength(4);
    expect(app.state.matches.map((match) => match.id)).toEqual(["other"]);
    expect(app.state.complete).toBe(true);
  });
});
