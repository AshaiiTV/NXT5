import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button } from "../components/ui/Core.jsx";
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

describe("temporary team invitations", () => {
  const action = (renderer, label) => renderer.root.findAllByType(Button).find(node => node.props.children === label);
  it("copies the fresh server code and refreshes invitations after rotation", async () => {
    const settings = { ...props(), managementOnly: true };
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    apiFetch.mockResolvedValueOnce({ code: "NXT5-NEW-INVITE" });
    const { renderer } = await render(settings);
    await act(async () => action(renderer, "Créer et copier un lien").props.onClick());
    expect(apiFetch).toHaveBeenCalledWith("teams-invite-code", { method: "POST", body: JSON.stringify({ teamId: team.id }) });
    expect(copy).toHaveBeenCalledWith("https://nxt5.test/equipes?invite=NXT5-NEW-INVITE");
    expect(settings.refreshAll).toHaveBeenCalledOnce();
    expect(settings.pushToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Lien d’invitation copié", text: expect.stringContaining("révoqués") }));
  });

  it("revokes active invitations and refreshes their list without copying a code", async () => {
    const settings = { ...props(), managementOnly: true };
    settings.data.inviteCodes = [{ id: "invitation", team_id: team.id, code: "NXT5-OLD", expires_at: new Date(Date.now() + 60_000).toISOString() }];
    apiFetch.mockResolvedValueOnce({ revoked: true });
    const { renderer } = await render(settings);
    await act(async () => action(renderer, "Révoquer les invitations").props.onClick());
    expect(apiFetch).toHaveBeenCalledWith("teams-invite-code", { method: "POST", body: JSON.stringify({ teamId: team.id, action: "revoke" }) });
    expect(settings.refreshAll).toHaveBeenCalledOnce();
    expect(settings.pushToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invitations révoquées" }));
  });

  it("hides expired entries and does not offer revoke to a player", async () => {
    const settings = { ...props(), managementOnly: true, currentMember: { role: "player" }, user: { id: "player" } };
    settings.data.inviteCodes = [{ id: "expired", team_id: team.id, code: "NXT5-EXPIRED", expires_at: new Date(Date.now() - 60_000).toISOString() }];
    const { renderer } = await render(settings);
    expect(content(renderer)).not.toContain("NXT5-EXPIRED");
    expect(action(renderer, "Révoquer les invitations")).toBeUndefined();
    expect(action(renderer, "Créer et copier un lien").props.disabled).toBe(true);
  });

  it("reports revoke failure and lets the staff retry", async () => {
    const settings = { ...props(), managementOnly: true };
    settings.data.inviteCodes = [{ id: "active", team_id: team.id, code: "NXT5-ACTIVE", expires_at: new Date(Date.now() + 60_000).toISOString() }];
    apiFetch.mockRejectedValueOnce(new Error("Service indisponible"));
    const { renderer } = await render(settings);
    await act(async () => action(renderer, "Révoquer les invitations").props.onClick());
    expect(settings.refreshAll).not.toHaveBeenCalled();
    expect(settings.pushToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Révocation impossible" }));
    expect(action(renderer, "Révoquer les invitations").props.disabled).toBe(false);
  });
});

it('T3-G4 selects and refreshes the created team after a partial import, then retries only missing players', async () => {
  const settings = { ...props(), data: { teams: [], players: [], matches: [] }, selectedTeamId: '', setupOnly: true };
  const { renderer } = await render(settings);
  field(renderer, 'Nom de l’équipe', 'Created team');
  field(renderer, 'Tag', 'CT');
  field(renderer, 'Joueurs à ajouter (facultatif)', 'First#EUW\nSecond#EUW\nThird#EUW');
  apiFetch.mockResolvedValueOnce({ team }).mockResolvedValueOnce({ player: { id: 'one' } }).mockRejectedValueOnce(new Error('Player failed'));
  const submit = () => renderer.root.findAllByType('form').find(form => form.findAllByType(Button).some(b => ['Créer l’équipe','Reprendre les joueurs manquants'].includes(b.props.children)));
  await act(async () => submit().props.onSubmit({ preventDefault() {} }));
  expect(settings.setSelectedTeamId).toHaveBeenCalledWith(team.id);
  expect(settings.refreshAll).toHaveBeenCalledWith({ teamId: team.id });
  expect(content(renderer)).toContain('Reprendre les joueurs manquants');
  expect(content(renderer)).toContain('Second#EUW, Third#EUW');
  apiFetch.mockResolvedValue({ player: { id: 'saved' } });
  await act(async () => submit().props.onSubmit({ preventDefault() {} }));
  expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === 'teams-create')).toHaveLength(1);
  expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === 'players-create').map(([, options]) => JSON.parse(options.body).riotId)).toEqual(['First#EUW','Second#EUW','Second#EUW','Third#EUW']);
  expect(settings.refreshAll).toHaveBeenCalledTimes(2);
});

it.each(['owner','captain','manager','coach','assistant','analyst','board','player'])('T3-G5 aligns management permissions for %s', async role => {
  const settings = { ...props(), managementOnly: true, currentMember: { role }, user: { id: role === 'owner' ? 'captain' : 'someone-else' } };
  settings.data.teamMembers = [{ id: 'm', team_id: team.id, user_id: 'member', name: 'Member', role: 'player' }];
  const { renderer } = await render(settings);
  const panel = renderer.root.findByType(TeamManagementPanel);
  expect(panel.props.canEditIdentity).toBe(['owner','captain','manager'].includes(role));
  expect(panel.props.canInvite).toBe(['owner','captain','manager'].includes(role));
  expect(panel.props.canManageMembers).toBe(['owner','captain'].includes(role));
  expect(panel.props.canManageRoster).toBe(role !== 'player');
  expect(panel.props.canDeleteTeam).toBe(role === 'owner');
  const invite = renderer.root.findAllByType(Button).find(b => b.props.children === 'Créer et copier un lien');
  expect(invite.props.disabled).toBe(!panel.props.canInvite);
  expect(renderer.root.findByProps({ 'aria-label': 'Accès de Member' }).props.disabled).toBe(!panel.props.canManageMembers);
});
