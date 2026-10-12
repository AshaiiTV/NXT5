import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Statistics } from "../pages/workspace/GameWorkspace.jsx";
import GroupOpponentPanel from "../components/opponents/GroupOpponentPanel.jsx";
import OpponentsWorkspace from "../components/opponents/OpponentsWorkspace.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../components/opponents/GroupOpponentPanel.jsx", () => ({ default: () => null }));
vi.mock("../components/opponents/OpponentsWorkspace.jsx", () => ({ default: () => null }));
vi.mock("../components/discord/DiscordGroupShare.jsx", () => ({ default: () => null }));
let renderer;
beforeEach(() => { vi.stubGlobal("window", { location: new URL("https://nxt5.test/games?view=groups"), addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.resetAllMocks(); vi.unstubAllGlobals(); });
function text(node) { return node.children.map((child) => typeof child === "string" ? child : text(child)).join(""); }
function props(search = "?view=groups") {
  return {
    selectedTeamId: "team-1", user: { id: "member" }, refreshAll: vi.fn(),
    data: { teams: [{ id: "team-1", name: "Notre équipe" }], matchArchives: [
      { id: "group-1", team_id: "team-1", name: "Scrim du soir", opponent_id: "opif", opponent_name: "OPIF", match_ids: [] },
      { id: "group-2", team_id: "team-1", name: "Session du matin", match_ids: [] },
      { id: "group-private", team_id: "team-2", name: "Autre équipe", opponent_id: "private", opponent_name: "Privé", match_ids: [] },
    ] }, route: { path: "/games", search },
  };
}

describe("group links in the games workspace", () => {
  it("shows the saved team beside each group, preserves team context, and searches opponent names", async () => {
    await act(async () => { renderer = TestRenderer.create(<Statistics {...props()} />); });
    const link = renderer.root.findByProps({ className: "games-group-opponent" });
    expect(text(link)).toBe("OPIF");
    expect(link.props.href).toBe("/games?view=teams&opponent=opif&team=team-1");
    expect(text(renderer.root)).toContain("Équipe non liée");
    expect(text(renderer.root)).not.toContain("Privé");
    await act(async () => renderer.root.findByProps({ role: "searchbox" }).props.onChange({ target: { value: "opif" } }));
    expect(text(renderer.root)).toContain("Scrim du soir");
    expect(text(renderer.root)).not.toContain("Session du matin");
  });

  it("opens the group association panel with the active group and refresh callback", async () => {
    const view = props("?view=groups&archive=group-1");
    await act(async () => { renderer = TestRenderer.create(<Statistics {...view} />); });
    const panel = renderer.root.findByType(GroupOpponentPanel);
    expect(panel.props.teamId).toBe("team-1");
    expect(panel.props.archive).toBe(view.data.matchArchives[0]);
    await act(async () => { await panel.props.onChanged(); });
    expect(view.refreshAll).toHaveBeenCalledWith({ throwOnError: true });
  });

  it("passes the opponent from a deep link to the teams view", async () => {
    await act(async () => { renderer = TestRenderer.create(<Statistics {...props("?view=teams&opponent=opif&team=team-1")} />); });
    expect(renderer.root.findByType(OpponentsWorkspace).props.opponentId).toBe("opif");
    expect(renderer.root.findAllByType(GroupOpponentPanel)).toHaveLength(0);
  });
});
