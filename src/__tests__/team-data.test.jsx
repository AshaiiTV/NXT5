import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { useTeamData } from "../hooks/useTeamData.js";
import { MatchPaginationNotice } from "../components/layout/MatchPaginationNotice.jsx";
import { Button } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanups = [];
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.clearAllMocks(); });
const teams = [{ id: "a" }, { id: "b" }];
const page = (teamId, ids, hasMore = false, offset = 0) => ({ selectedTeamId: teamId, teams, players: [], matches: ids.map((id) => ({ id, team_id: teamId })), pagination: { offset, limit: 2, total: 4, nextOffset: hasMore ? offset + 2 : null, hasMore } });

function mount() {
  const requests = [];
  apiFetch.mockImplementation((url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })));
  const store = { mergeAvailability: (rows) => rows };
  let state, renderer;
  function View() { state = useTeamData(store); return <output>{state.selectedTeamId}</output>; }
  act(() => { renderer = TestRenderer.create(<View />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return { requests, get state() { return state; }, select(id) { act(() => state.setSelectedTeamId(id)); }, async resolve(index, payload) { await act(async () => requests[index].resolve(payload)); } };
}

describe("team-scoped bootstrap lifecycle in React", () => {
  it("loads once initially and ignores stale responses after rapid team switches", async () => {
    const app = mount();
    await app.resolve(0, page("a", ["a1"]));
    expect(app.requests).toHaveLength(1);
    app.select("b");
    app.select("a");
    await app.resolve(1, page("b", ["b1"]));
    expect(app.state.selectedTeamId).toBe("a");
    expect(app.state.data.matches[0].id).toBe("a1");
    expect(app.requests).toHaveLength(2);
  });
  it("appends deduplicated pages and preserves other team data", async () => {
    const app = mount();
    await app.resolve(0, page("a", ["a1", "a2"], true));
    await act(async () => { app.state.loadMore(); });
    expect(app.requests[1].url).toContain("matchesOnly=1");
    await app.resolve(1, page("a", ["a2", "a3"], false, 2));
    expect(app.state.data.matches.map((match) => match.id)).toEqual(["a1", "a2", "a3"]);
    expect(app.state.data.teams).toEqual(teams);
    expect(app.state.loadingMore).toBe(false);
  });
  it("discards a late match page after switching teams", async () => {
    const app = mount();
    await app.resolve(0, page("a", ["a1", "a2"], true));
    await act(async () => { app.state.loadMore(); });
    app.select("b");
    await app.resolve(2, page("b", ["b1"]));
    await app.resolve(1, page("a", ["a3", "a4"], false, 2));
    expect(app.state.data.matches.map((match) => match.id)).toEqual(["b1"]);
    expect(app.state.data.selectedTeamId).toBe("b");
  });
  it("still labels incomplete analyses if overlapping pages exhaust the cursor", async () => {
    const refresh = vi.fn();
    let renderer;
    act(() => { renderer = TestRenderer.create(<MatchPaginationNotice data={page("a", ["a1", "a2", "a3"], false, 2)} refreshAll={refresh} />); });
    cleanups.push(() => act(() => renderer.unmount()));
    expect(renderer.root.findAllByType("p")[0].children.join("")).toBe("Analyses sur 3 des 4 games");
    const button = renderer.root.findByType(Button);
    expect(button.props.children).toBe("Actualiser les games");
    act(() => button.props.onClick());
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
