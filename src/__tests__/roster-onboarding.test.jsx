import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Teams, TeamManagementPanel } from "../pages/workspace/Teams.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../NextPhase.jsx", () => ({ TeamDataHealthPanel: () => <p>Santé des données</p> }));

const cleanups = [];
const team = { id: "team", name: "Otters", tag: "OOT", region: "EUW", owner_id: "captain" };
const player = { id: "top", team_id: team.id, name: "Toplaner", riot_id: "Toplaner#EUW", role: "TOP", roster_status: "MAIN" };
const props = () => ({ data: { teams: [team], players: [], matches: [] }, selectedTeamId: team.id, currentMember: { role: "captain" }, user: { id: "captain" }, setSelectedTeamId: vi.fn(), refreshAll: vi.fn(), pushToast: vi.fn() });

beforeEach(() => {
  vi.stubGlobal("window", {
    location: new URL("https://nxt5.test/equipes"),
    history: { pushState: (_state, _title, path) => { window.location = new URL(path, window.location); } },
    dispatchEvent: vi.fn(), scrollTo: vi.fn(), setInterval, clearInterval,
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

async function render(settings) {
  const scrollIntoView = vi.fn();
  const focus = vi.fn();
  const scrollEditIntoView = vi.fn();
  const focusEdit = vi.fn();
  let renderer;
  const view = (next) => <Suspense fallback="Chargement"><Teams {...next} /></Suspense>;
  await act(async () => {
    renderer = TestRenderer.create(view(settings), {
      createNodeMock: (element) => element.props.id === "team-roster-setup"
        ? { scrollIntoView, querySelector: () => ({ focus }) }
        : element.props.className === "team-profile-edit"
          ? { scrollIntoView: scrollEditIntoView, querySelector: () => ({ focus: focusEdit }) }
          : null,
    });
  });
  cleanups.push(() => act(() => renderer.unmount()));
  return { renderer, scrollIntoView, focus, scrollEditIntoView, focusEdit, update: async (next) => act(async () => renderer.update(view(next))) };
}
const content = (renderer) => JSON.stringify(renderer.toJSON());
const field = (renderer, label, value) => act(() => renderer.root.findByProps({ label }).props.onChange(value));

describe("first roster setup", () => {
  it("offers a working first-player link and hides empty copy actions", async () => {
    const { renderer } = await render(props());
    expect(content(renderer)).toContain("Ajoute ton premier joueur");
    expect(content(renderer)).not.toContain("Copier OP.GG titulaires");
    expect(content(renderer)).not.toContain("Copier OP.GG remplaçants");
    const link = renderer.root.findAllByType("a").find((item) => item.props.href === "/gestion-equipe?section=roster");
    expect(link).toBeTruthy();
    act(() => link.props.onClick({ button: 0, preventDefault() {} }));
    expect(window.location.pathname + window.location.search).toBe("/gestion-equipe?section=roster");
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it("shows only populated copy actions while preserving roster entry", async () => {
    const settings = props();
    settings.data.players = [player];
    const { renderer } = await render(settings);
    expect(content(renderer)).toContain("Copier OP.GG titulaires");
    expect(content(renderer)).not.toContain("Copier OP.GG remplaçants");
    expect(renderer.root.findAllByType("a").some((item) => item.props.href === "/gestion-equipe?section=roster")).toBe(true);
  });

  it.each(["member", "player"])("explains staff responsibility to a %s without offering an unavailable action", async (role) => {
    const settings = { ...props(), currentMember: { role }, user: { id: "invited" } };
    const { renderer, update, focus } = await render(settings);
    expect(content(renderer)).toContain("Demande à ton staff d’ajouter les joueurs");
    expect(renderer.root.findAllByType("a").some((item) => item.props.href.startsWith("/gestion-equipe"))).toBe(false);
    await update({ ...settings, managementOnly: true, routeSearch: "?section=roster" });
    expect(renderer.root.findAllByType("form").some((form) => form.props.className === "team-profile-form")).toBe(false);
    expect(focus).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByType(TeamManagementPanel).props.onCreatePlayer({ preventDefault() {} }));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("keeps management available to the team owner while membership information loads", async () => {
    const { renderer } = await render({ ...props(), currentMember: null });
    expect(renderer.root.findAllByType("a").some((item) => item.props.href === "/gestion-equipe?section=roster")).toBe(true);
  });

  it("focuses the roster form when its query opens on the management page, without stealing focus after refresh", async () => {
    const settings = { ...props(), managementOnly: true };
    const { renderer, update, scrollIntoView, focus } = await render(settings);
    expect(focus).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType("form")[0].props.className).toBe("team-profile-form");
    expect(renderer.root.findAllByType("a").some((link) => link.props.href === "/equipes")).toBe(true);
    const targeted = { ...settings, routeSearch: "?section=roster" };
    await update(targeted);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    await update({ ...targeted, data: { ...targeted.data, players: [player] } });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    await update(settings);
    await update(targeted);
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("creates a player, selects the next missing main role and keeps the form in place", async () => {
    const settings = { ...props(), managementOnly: true, routeSearch: "?section=roster" };
    const { renderer, scrollIntoView } = await render(settings);
    field(renderer, "Nom", "Toplaner");
    field(renderer, "Riot ID", "Toplaner#EUW");
    apiFetch.mockResolvedValueOnce({ player });
    await act(async () => renderer.root.findAllByType("form").find((form) => form.props.className === "team-profile-form").props.onSubmit({ preventDefault() {} }));
    expect(apiFetch).toHaveBeenCalledWith("players-create", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Toplaner", riotId: "Toplaner#EUW", opggUrl: "", role: "TOP", rosterStatus: "", teamId: team.id }) }));
    expect(settings.refreshAll).toHaveBeenCalled();
    expect(renderer.root.findByProps({ label: "Poste ou fonction" }).props.value).toBe("JGL");
    expect(renderer.root.findByProps({ label: "Nom" }).props.value).toBe("");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("ignores substitutes when choosing the next missing main role", async () => {
    const settings = { ...props(), managementOnly: true };
    settings.data.players = [player, { ...player, id: "jgl-sub", role: "JGL", roster_status: "SUB" }];
    const { renderer } = await render(settings);
    expect(renderer.root.findByProps({ label: "Poste ou fonction" }).props.value).toBe("JGL");
  });

  it.each([true, false])("focuses profile editing once, then returns to a connected trigger (%s)", async (isConnected) => {
    const settings = { ...props(), managementOnly: true };
    settings.data.players = [player];
    const { renderer, scrollEditIntoView, focusEdit } = await render(settings);
    const trigger = { isConnected, focus: vi.fn() };
    const edit = renderer.root.findAllByType("button").find((button) => button.findAllByType("span").some((span) => span.children.join("") === "Modifier"));
    act(() => edit.props.onClick({ currentTarget: trigger }));
    expect(scrollEditIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(focusEdit).toHaveBeenCalledWith({ preventScroll: true });
    const form = renderer.root.findByProps({ className: "team-profile-edit" });
    act(() => form.findByProps({ label: "Nom" }).props.onChange("Nouveau nom"));
    expect(focusEdit).toHaveBeenCalledTimes(1);
    let resolve;
    apiFetch.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    let saving;
    act(() => { saving = form.props.onSubmit({ preventDefault() {} }); });
    expect(focusEdit).toHaveBeenCalledTimes(1);
    expect(trigger.focus).not.toHaveBeenCalled();
    await act(async () => { resolve({ player: { ...player, name: "Nouveau nom" } }); await saving; });
    expect(scrollEditIntoView).toHaveBeenCalledTimes(1);
    expect(trigger.focus).toHaveBeenCalledTimes(isConnected ? 1 : 0);
    expect(renderer.root.findAllByProps({ className: "team-profile-edit" })).toHaveLength(0);
    act(() => edit.props.onClick({ currentTarget: trigger }));
    const reopened = renderer.root.findByProps({ className: "team-profile-edit" });
    act(() => reopened.findAllByType("button").find((button) => button.children.includes("Annuler")).props.onClick());
    expect(scrollEditIntoView).toHaveBeenCalledTimes(2);
    expect(trigger.focus).toHaveBeenCalledTimes(isConnected ? 2 : 0);
    expect(renderer.root.findAllByProps({ className: "team-profile-edit" })).toHaveLength(0);
  });
});
