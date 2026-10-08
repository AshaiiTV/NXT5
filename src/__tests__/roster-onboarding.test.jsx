import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button } from "../components/ui/Core.jsx";
import { useTeamCreation } from "../hooks/useTeamCreation.js";
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

function CreationHost(props) {
  const teamCreation = useTeamCreation(props);
  return <Teams {...props} teamCreation={teamCreation} />;
}

async function render(settings) {
  const scrollIntoView = vi.fn();
  const focus = vi.fn();
  const scrollEditIntoView = vi.fn();
  const focusEdit = vi.fn();
  const focusPage = vi.fn();
  const focusResume = vi.fn();
  let renderer;
  const view = (next) => <Suspense fallback="Chargement"><CreationHost {...next} /></Suspense>;
  await act(async () => {
    renderer = TestRenderer.create(view(settings), {
      createNodeMock: (element) => element.props.id === "team-roster-setup"
        ? { scrollIntoView, querySelector: () => ({ focus }) }
        : element.props.className === "team-profile-edit"
          ? { scrollIntoView: scrollEditIntoView, querySelector: () => ({ focus: focusEdit }) }
          : element.props.className === 'nxt5-teams-page'
            ? { querySelector: (selector) => selector === '.nxt5-page-title' ? { focus: focusPage } : null }
            : element.props.className === 'team-setup-forms'
              ? { querySelector: () => ({ focus: focusResume }) }
              : null,
    });
  });
  cleanups.push(() => act(() => renderer.unmount()));
  return { renderer, scrollIntoView, focus, scrollEditIntoView, focusEdit, focusPage, focusResume, update: async (next) => act(async () => renderer.update(view(next))) };
}
const content = (renderer) => JSON.stringify(renderer.toJSON());
const field = (renderer, label, value) => act(() => renderer.root.findByProps({ label }).props.onChange(value));

describe("team multi OP.GG copy", () => {
  const copyAction = (renderer) => renderer.root.findAllByType(Button).find((button) => button.props.children === "Copier le multi OP.GG");

  it("lets a player copy the selected team's active lineup with its region and valid Riot IDs", async () => {
    const selectedTeam = { ...team, id: "selected-team", region: "NA" };
    const settings = { ...props(), selectedTeamId: selectedTeam.id, currentMember: { role: "player" }, user: { id: "member" } };
    settings.data.teams = [team, selectedTeam];
    settings.data.players = [
      player,
      { ...player, id: "selected-main", team_id: selectedTeam.id, riot_id: "Éclair Bleu#NA1" },
      { ...player, id: "selected-sub", team_id: selectedTeam.id, role: "SUB", roster_status: "SUB", riot_id: "Reserve#NA2" },
      { ...player, id: "inactive", team_id: selectedTeam.id, roster_status: "INACTIVE", riot_id: "Inactive#NA1" },
      { ...player, id: "coach", team_id: selectedTeam.id, role: "COACH", riot_id: "Coach#NA1" },
      { ...player, id: "invalid", team_id: selectedTeam.id, riot_id: "#NA1" },
    ];
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    const { renderer } = await render(settings);
    expect(copyAction(renderer).props.disabled).toBe(false);
    await act(async () => copyAction(renderer).props.onClick());
    expect(copy).toHaveBeenCalledOnce();
    const link = new URL(copy.mock.calls[0][0]);
    expect(link.origin).toBe("https://www.op.gg");
    expect(link.pathname).toBe("/lol/multisearch/na");
    expect(link.searchParams.get("summoners")).toBe("Éclair Bleu#NA1,Reserve#NA2");
    expect(settings.pushToast).toHaveBeenCalledWith({ type: "green", title: "Multi OP.GG de l’équipe copié", text: "2 joueurs dans le lien." });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each([
    { label: "empty roster", players: [] },
    { label: "inactive players and staff", players: [
      { ...player, roster_status: "INACTIVE" },
      { ...player, id: "coach", role: "COACH" },
    ] },
  ])("keeps the action visible but disabled for $label", async ({ players }) => {
    const settings = props();
    settings.data.players = players;
    const { renderer } = await render(settings);
    expect(copyAction(renderer)).toBeTruthy();
    expect(copyAction(renderer).props.disabled).toBe(true);
  });

  it("explains missing valid Riot IDs without copying an empty link", async () => {
    const settings = props();
    settings.data.players = [{ ...player, riot_id: "Toplaner" }];
    const copy = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    const { renderer } = await render(settings);
    await act(async () => copyAction(renderer).props.onClick());
    expect(copy).not.toHaveBeenCalled();
    expect(settings.pushToast).toHaveBeenCalledWith({ type: "red", title: "Multi OP.GG impossible", text: "Ajoute des Riot IDs au format Pseudo#TAG." });
  });

  it("reports clipboard refusal and allows retrying the copy", async () => {
    const settings = props();
    settings.data.players = [player];
    const copy = vi.fn().mockRejectedValueOnce(new Error("Clipboard denied")).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    const { renderer } = await render(settings);
    await act(async () => copyAction(renderer).props.onClick());
    expect(settings.pushToast).toHaveBeenLastCalledWith({ type: "red", title: "Copie impossible", text: "Le navigateur n’a pas autorisé la copie. Réessaie depuis le bouton." });
    await act(async () => copyAction(renderer).props.onClick());
    expect(copy).toHaveBeenCalledTimes(2);
    expect(settings.pushToast).toHaveBeenLastCalledWith({ type: "green", title: "Multi OP.GG de l’équipe copié", text: "1 joueur dans le lien." });
  });
});

describe("readable team roster", () => {
  const profileLinks = (node) => node.findAllByType("a").filter((link) => link.props.href?.startsWith("/mon-profil?player="));
  const playerIds = (node) => profileLinks(node).map((link) => new URL(link.props.href, window.location).searchParams.get("player"));

  it("shows each profile once in role order, retains inactive profiles in details and keeps staff non-interactive", async () => {
    const settings = props();
    settings.data.players = [
      { ...player, id: "support", name: "Support", role: "SUP" },
      { ...player, id: "reserve", name: "Reserve", role: "JGL", roster_status: "SUB" },
      { ...player, id: "inactive", name: "Inactive", role: "ADC", roster_status: "INACTIVE" },
      { ...player, id: "coach", name: "Coach", role: "COACH" },
      { ...player, id: "mid", name: "Midlaner", role: "MID" },
      player,
    ];
    const { renderer } = await render(settings);
    expect(playerIds(renderer.root)).toEqual(["top", "mid", "support", "reserve", "inactive"]);
    const rosterGroup = (label) => renderer.root.findAllByType("ul").find((list) => list.props["aria-label"] === label);
    expect(playerIds(rosterGroup("Titulaires"))).toEqual(["top", "mid", "support"]);
    expect(playerIds(rosterGroup("Remplaçants"))).toEqual(["reserve"]);
    const inactive = renderer.root.findAllByType("details").find((details) => playerIds(details).includes("inactive"));
    expect(inactive).toBeTruthy();
    expect(inactive.props.open).not.toBe(true);
    expect(playerIds(inactive)).toEqual(["inactive"]);
    const staff = renderer.root.findAllByType("section").find((section) => section.props["aria-label"] === "Encadrement");
    expect(staff.findAllByType("span").some((span) => span.children.includes("Coach"))).toBe(true);
    expect(staff.findAllByType("a")).toHaveLength(0);
    expect(staff.findAllByType("button")).toHaveLength(0);
  });

  it("marks only a profile linked to the current account and never treats missing user IDs as a match", async () => {
    const settings = props();
    settings.data.players = [player, { ...player, id: "mine", user_id: "captain" }, { ...player, id: "other", user_id: "teammate" }];
    const { renderer, update } = await render(settings);
    const markedLinks = () => profileLinks(renderer.root).filter((link) => link.findAllByType("span").some((span) => span.children.length === 1 && span.children[0] === "Toi"));
    expect(markedLinks().map((link) => link.props.href)).toEqual(["/mon-profil?player=mine"]);
    await update({ ...settings, user: { id: "" } });
    expect(markedLinks()).toHaveLength(0);
  });

  it("keeps native modified-click navigation and opens the encoded profile on an ordinary click", async () => {
    const settings = props();
    settings.data.players = [{ ...player, id: "player/é #1" }];
    const { renderer } = await render(settings);
    const [link] = profileLinks(renderer.root);
    expect(link.props.href).toBe("/mon-profil?player=player%2F%C3%A9%20%231");
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const preventDefault = vi.fn();
      act(() => link.props.onClick({ button: 0, preventDefault, ...modifier }));
      expect(preventDefault).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe("/equipes");
    }
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    const preventDefault = vi.fn();
    act(() => link.props.onClick({ button: 0, preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/mon-profil");
    expect(window.location.searchParams.get("player")).toBe("player/é #1");
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });

  it("retains lineup-specific copy actions inside initially closed details", async () => {
    const settings = props();
    settings.data.players = [player, { ...player, id: "reserve", role: "SUB", riot_id: "Reserve#EUW", roster_status: "SUB" }];
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    const { renderer } = await render(settings);
    const details = renderer.root.findAllByType("details").find((node) => node.findAllByType("summary").some((summary) => summary.children.includes("Liens OP.GG par groupe")));
    expect(details).toBeTruthy();
    expect(details.props.open).not.toBe(true);
    const actions = details.findAllByType(Button);
    expect(actions).toHaveLength(2);
    for (const action of actions) await act(async () => action.props.onClick());
    expect(copy.mock.calls.map(([link]) => new URL(link).searchParams.get("summoners"))).toEqual(["Toplaner#EUW", "Reserve#EUW"]);
  });
});

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
  act(() => renderer.root.findAllByType('button').find(node => node.props.className === 'team-entry-choice').props.onClick());
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


it('R8-02 closes and reopens pending forms with focus, then abandons without deleting saved data', async () => {
  const settings = { ...props(), routeSearch: '?create=1' };
  const { renderer, update, focusPage, focusResume } = await render(settings);
  field(renderer, 'Nom de l’équipe', 'Created');
  field(renderer, 'Joueurs à ajouter (facultatif)', 'First#EUW\nSecond#EUW');
  apiFetch.mockResolvedValueOnce({ team }).mockResolvedValueOnce({ player }).mockRejectedValueOnce(Object.assign(new Error('Refus'), { status: 403 }));
  await act(async () => renderer.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }));
  // Simulate the bootstrap/remount query clearing after the partial creation.
  await update({ ...settings, routeSearch: '' });
  const action = label => renderer.root.findAllByType(Button).find(b => b.props.children === label);
  expect(content(renderer)).toContain('Second#EUW');
  expect(action('Fermer les formulaires')).toBeTruthy();
  act(() => action('Fermer les formulaires').props.onClick());
  expect(content(renderer)).not.toContain('Reprendre les joueurs manquants');
  expect(focusPage).toHaveBeenCalledWith({ preventScroll: true });
  act(() => action('Reprendre l’import de joueurs').props.onClick());
  expect(focusResume).toHaveBeenCalledOnce();
  expect(content(renderer)).toContain('Second#EUW');
  expect(content(renderer)).toContain('L’abandon conserve l’équipe et les joueurs déjà ajoutés.');
  let reject;
  apiFetch.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  let retry;
  act(() => { retry = renderer.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }); });
  expect(action('Abandonner l’import restant').props.disabled).toBe(true);
  expect(action('Fermer les formulaires').props.disabled).toBe(true);
  await act(async () => { reject(Object.assign(new Error('Refus'), { status: 403 })); await retry; });
  const calls = apiFetch.mock.calls.length;
  act(() => action('Abandonner l’import restant').props.onClick());
  expect(content(renderer)).not.toContain('Reprendre l’import de joueurs');
  expect(content(renderer)).not.toContain('Reprendre les joueurs manquants');
  expect(content(renderer)).toContain('Ajoute ton premier joueur');
  expect(focusPage).toHaveBeenCalledTimes(2);
  expect(apiFetch).toHaveBeenCalledTimes(calls);
  await update(settings);
  expect(renderer.root.findByProps({ label: 'Nom de l’équipe' }).props.value).toBe('');
  expect(action('Créer l’équipe')).toBeTruthy();
});
