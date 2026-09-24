import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiscordWorkspace from "../pages/workspace/DiscordWorkspace.jsx";
import { Sidebar } from "../components/layout/AppChrome.jsx";
import { buildLoginRedirect, isAppPath, isKnownPath, pageFromPath, pathFromPage } from "../app/routing.js";
import { canonicalAudiencePath } from "../app/audience-paths.js";

vi.mock("../components/discord/DiscordSettings.jsx", () => ({ default: function Settings(props) {
  const [draft, setDraft] = useState("");
  return <input data-dashboard {...props} value={draft} onChange={(event) => setDraft(event.target.value)} />;
} }));
vi.mock("../components/discord/DiscordAccount.jsx", () => ({ default: (props) => <div data-personal-account userId={props.user?.id} /> }));

let renderer;
const team = { id: "team-a", name: "Alpha", owner_id: "owner" };
const anotherTeam = { id: "team-b", name: "Bravo", owner_id: "owner" };
const user = { id: "user" };
const props = (role) => ({ data: { teams: [team, anotherTeam] }, selectedTeamId: team.id, user, currentMember: { team_id: team.id, user_id: user.id, role } });
function render(value) { act(() => { renderer = TestRenderer.create(value); }); }
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.unstubAllGlobals(); });

describe("Discord workspace access and navigation", () => {
  it("opens a private canonical dashboard and returns there after login without collecting query values", () => {
    expect(isKnownPath("/bot-discord")).toBe(true);
    expect(isAppPath("/bot-discord")).toBe(true);
    expect(pageFromPath("/bot-discord")).toBe("bot-discord");
    expect(pathFromPage("bot-discord")).toBe("/bot-discord");
    expect(decodeURIComponent(buildLoginRedirect("/bot-discord", "?team=private-team"))).toBe("/connexion?next=/bot-discord?team=private-team");
    expect(canonicalAudiencePath("/bot-discord?code=private-code")).toBe("/bot-discord");
  });

  it("provides the dashboard as a selected navigation item and closes the mobile menu on selection", () => {
    const setActive = vi.fn(); const setOpen = vi.fn();
    render(<Sidebar active="bot-discord" setActive={setActive} open={false} setOpen={setOpen} collapsed={false} setCollapsed={vi.fn()} roleLabel={(value) => value} />);
    const entry = renderer.root.findByProps({ "aria-label": "Bot Discord" });
    expect(entry.props["aria-current"]).toBe("page");
    act(() => entry.props.onClick());
    expect(setActive).toHaveBeenCalledWith("bot-discord");
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it.each(["owner", "captain", "coach", "assistant", "analyst", "manager", "board"])("lets %s inspect the right team with appropriate management rights", (role) => {
    render(<DiscordWorkspace {...props(role)} />);
    const dashboard = renderer.root.findByProps({ "data-dashboard": true });
    expect(dashboard.props.teamId).toBe(team.id);
    expect(dashboard.props.canPublish).toBe(true);
    expect(dashboard.props.canManage).toBe(["owner", "captain"].includes(role));
  });

  it("allows the actual owner even without a membership row", () => {
    render(<DiscordWorkspace {...props(null)} currentMember={null} user={{ id: "owner" }} />);
    expect(renderer.root.findByProps({ "data-dashboard": true }).props.canManage).toBe(true);
  });

  it.each(["player", null])("explains restricted access for %s without mounting staff-only requests", (role) => {
    render(<DiscordWorkspace {...props(role)} />);
    expect(renderer.root.findAllByProps({ "data-dashboard": true })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("La connexion Discord se configure avec ton encadrement");
    expect(renderer.root.findByProps({ "data-personal-account": true }).props.userId).toBe(user.id);
  });

  it("rejects stale roles from another team or another user", () => {
    render(<DiscordWorkspace {...props("captain")} currentMember={{ team_id: anotherTeam.id, user_id: user.id, role: "captain" }} />);
    expect(renderer.root.findAllByProps({ "data-dashboard": true })).toHaveLength(0);
    act(() => renderer.update(<DiscordWorkspace {...props("captain")} currentMember={{ team_id: team.id, user_id: "someone-else", role: "captain" }} />));
    expect(renderer.root.findAllByProps({ "data-dashboard": true })).toHaveLength(0);
  });

  it("shows a team entry point when there is no team or the selected team has disappeared", () => {
    render(<DiscordWorkspace {...props("captain")} data={{ teams: [] }} />);
    expect(renderer.root.findByProps({ href: "/equipes" }).props.children).toBe("Ouvrir mes équipes");
    act(() => renderer.update(<DiscordWorkspace {...props("captain")} selectedTeamId="deleted-team" />));
    expect(renderer.root.findAllByProps({ "data-dashboard": true })).toHaveLength(0);
  });

  it("remounts the dashboard when the team changes, discarding the previous team's draft", () => {
    render(<DiscordWorkspace {...props("captain")} />);
    act(() => renderer.root.findByProps({ "data-dashboard": true }).props.onChange({ target: { value: "channel-a" } }));
    act(() => renderer.update(<DiscordWorkspace {...props("captain")} selectedTeamId={anotherTeam.id} currentMember={{ team_id: anotherTeam.id, user_id: user.id, role: "captain" }} />));
    const dashboard = renderer.root.findByProps({ "data-dashboard": true });
    expect(dashboard.props.teamId).toBe(anotherTeam.id);
    expect(dashboard.props.value).toBe("");
  });
});
