import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button } from "../components/ui/Core.jsx";
import { Teams } from "../pages/workspace/Teams.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../NextPhase.jsx", () => ({ TeamDataHealthPanel: () => <p>Santé des données</p> }));

const team = { id: "otters", name: "Otters", tag: "OOT", region: "EUW", owner_id: "owner" };
const player = { id: "top", team_id: team.id, name: "Nom du profil", riot_id: "Toplaner#EUW", role: "TOP", roster_status: "MAIN", user_id: "account" };
const account = { team_id: team.id, user_id: "account", name: "Nom du compte", role: "player" };
const cleanups = [];
const settings = () => ({
  data: { teams: [team], players: [player], matches: [], teamMembers: [account] },
  selectedTeamId: team.id, currentMember: { role: "owner" }, user: { id: "owner" },
  managementOnly: true, setSelectedTeamId: vi.fn(), refreshAll: vi.fn(), pushToast: vi.fn(),
});

beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/gestion-equipe"), setInterval, clearInterval, confirm: vi.fn(() => true) });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

async function render(props = settings(), nodeMock = () => null) {
  const focusAdd = vi.fn();
  const focusEdit = vi.fn();
  const scrollAdd = vi.fn();
  const scrollEdit = vi.fn();
  const view = (next) => <Suspense fallback="Chargement"><Teams {...next} /></Suspense>;
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(view(props), {
      createNodeMock: (element) => element.props.id === "team-roster-setup"
        ? { scrollIntoView: scrollAdd, querySelector: () => ({ focus: focusAdd }) }
        : element.type === "form" && element.props.className === "team-profile-edit"
          ? { scrollIntoView: scrollEdit, querySelector: () => ({ focus: focusEdit }) }
          : nodeMock(element),
    });
  });
  cleanups.push(() => act(() => renderer.unmount()));
  return { renderer, focusAdd, focusEdit, scrollAdd, scrollEdit, update: async (next) => act(async () => renderer.update(view(next))) };
}

const tab = (renderer, id) => renderer.root.findByProps({ id: `team-manager-tab-${id}` });
const panel = (renderer, id) => renderer.root.findByProps({ id: `team-manager-panel-${id}` });
const switchTab = async (renderer, id) => act(async () => tab(renderer, id).props.onClick());
const action = (node, label) => node.findAllByType(Button).find((button) => button.props.children === label);
const addSection = (renderer) => renderer.root.findByProps({ id: "team-roster-setup" });
const editForm = (renderer, id = player.id) => renderer.root.findByProps({ id: `team-edit-${id}` }).findByType("form");
const change = (node, label, value) => act(() => node.findByProps({ label }).props.onChange(value));
const editButton = (renderer, name = player.name) => renderer.root.findAllByType("button").find((button) => button.props["aria-label"] === `Modifier ${name}`);
const openEdit = (renderer, name = player.name, trigger = { isConnected: true, focus: vi.fn() }) => act(() => editButton(renderer, name).props.onClick({ currentTarget: trigger }));
const openAdd = (renderer, trigger = { focus: vi.fn() }) => act(() => action(renderer.root, "Ajouter un profil").props.onClick({ currentTarget: trigger }));
const text = (node) => node.children.map((child) => typeof child === "string" ? child : text(child)).join("");
const submit = (form) => form.props.onSubmit({ preventDefault() {} });

describe("team management views", () => {
  it("keeps roster editing available while withholding partial data-health conclusions", async () => {
    const props = settings();
    props.data.historyComplete = false;
    props.onLoadHistory = vi.fn().mockResolvedValue(true);
    const { renderer, update } = await render(props);
    openEdit(renderer);
    change(editForm(renderer), "Nom", "Profil en cours");
    await switchTab(renderer, "settings");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Santé des données");
    expect(props.onLoadHistory).not.toHaveBeenCalled();
    await act(async () => action(renderer.root, "Charger les analyses de l’équipe").props.onClick());
    expect(props.onLoadHistory).toHaveBeenCalledOnce();
    await update({ ...props, historyError: "Réseau indisponible" });
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    expect(action(renderer.root, "Réessayer")).toBeDefined();
    await update({ ...props, data: { ...props.data, historyComplete: true } });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(JSON.stringify(renderer.toJSON())).toContain("Santé des données");
    await switchTab(renderer, "roster");
    expect(editForm(renderer).findByProps({ label: "Nom" }).props.value).toBe("Profil en cours");
  });

  it("shows one tab panel at a time and retains profile and team drafts across tabs", async () => {
    const { renderer } = await render();
    const expectActive = (id) => {
      for (const name of ["roster", "access", "settings"]) {
        expect(panel(renderer, name).props.hidden).toBe(name !== id);
        expect(tab(renderer, name).props["aria-selected"]).toBe(name === id);
        expect(tab(renderer, name).props["aria-controls"]).toBe(panel(renderer, name).props.id);
        expect(panel(renderer, name).props["aria-labelledby"]).toBe(tab(renderer, name).props.id);
      }
      const discordLinks = renderer.root.findAllByType("a").filter((link) => link.props.href === "/bot-discord");
      expect(discordLinks).toHaveLength(id === "settings" ? 1 : 0);
      if (id === "settings") expect(panel(renderer, "settings").findAllByType("a")).toContain(discordLinks[0]);
    };
    expectActive("roster");
    openAdd(renderer);
    change(addSection(renderer), "Nom", "Recrue en cours");
    change(addSection(renderer), "Riot ID", "Recrue#EUW");
    openEdit(renderer);
    change(editForm(renderer), "Nom", "Profil en cours");

    await switchTab(renderer, "settings");
    expectActive("settings");
    change(panel(renderer, "settings"), "Nom de l'équipe", "Otters en cours");
    await switchTab(renderer, "access");
    expectActive("access");
    await switchTab(renderer, "roster");
    expectActive("roster");
    expect(addSection(renderer).props.hidden).toBe(false);
    expect(addSection(renderer).findByProps({ label: "Nom" }).props.value).toBe("Recrue en cours");
    expect(addSection(renderer).findByProps({ label: "Riot ID" }).props.value).toBe("Recrue#EUW");
    expect(editForm(renderer).findByProps({ label: "Nom" }).props.value).toBe("Profil en cours");
    await switchTab(renderer, "settings");
    expect(panel(renderer, "settings").findByProps({ label: "Nom de l'équipe" }).props.value).toBe("Otters en cours");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("opens a populated roster's add form on request, focuses it, and preserves a dismissed draft", async () => {
    const { renderer, focusAdd, scrollAdd } = await render();
    const addButton = action(renderer.root, "Ajouter un profil").findByType("button");
    const trigger = { focus: vi.fn(() => expect(addButton.props.hidden).toBe(false)) };
    expect(addSection(renderer).props.hidden).toBe(true);
    expect(focusAdd).not.toHaveBeenCalled();
    openAdd(renderer, trigger);
    expect(addSection(renderer).props.hidden).toBe(false);
    expect(action(renderer.root, "Ajouter un profil").findByType("button")).toBe(addButton);
    expect(addButton.props.hidden).toBe(true);
    expect(scrollAdd).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(focusAdd).toHaveBeenCalledWith({ preventScroll: true });
    change(addSection(renderer), "Nom", "Recrue");
    act(() => action(addSection(renderer), "Fermer l’ajout").props.onClick());
    expect(addSection(renderer).props.hidden).toBe(true);
    expect(action(renderer.root, "Ajouter un profil").findByType("button")).toBe(addButton);
    expect(trigger.focus).toHaveBeenCalledOnce();
    openAdd(renderer);
    expect(addSection(renderer).findByProps({ label: "Nom" }).props.value).toBe("Recrue");
    expect(focusAdd).toHaveBeenCalledTimes(2);
  });

  it.each(["empty", "roster query"])("opens adding immediately for %s", async (reason) => {
    const props = settings();
    if (reason === "empty") props.data.players = [];
    else props.routeSearch = "?section=roster";
    const { renderer, focusAdd } = await render(props);
    expect(addSection(renderer).props.hidden).toBe(false);
    expect(panel(renderer, "roster").props.hidden).toBe(false);
    expect(action(renderer.root, "Ajouter un profil").props.hidden).toBe(true);
    expect(focusAdd).toHaveBeenCalledTimes(reason === "roster query" ? 1 : 0);
  });

  it("opens the editor in the selected player's row and returns focus when cancelled", async () => {
    const props = settings();
    props.data.players.push({ ...player, id: "mid", name: "Autre profil", role: "MID", user_id: null });
    const { renderer, focusEdit, scrollEdit } = await render(props);
    const trigger = { isConnected: true, focus: vi.fn() };
    openEdit(renderer, player.name, trigger);
    const button = editButton(renderer);
    const editor = renderer.root.findByProps({ id: button.props["aria-controls"] });
    expect(button.props["aria-expanded"]).toBe(true);
    expect(editor.parent.type).toBe("li");
    expect(editor.parent.findAllByType("button")).toContain(button);
    expect(editor.parent.children.at(-1)).toBe(editor);
    expect(focusEdit).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollEdit).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(editButton(renderer, "Autre profil").props.disabled).toBe(true);
    change(editForm(renderer), "Nom", "Nouveau nom");
    expect(editButton(renderer).props.disabled).toBe(true);
    openEdit(renderer);
    expect(editForm(renderer).findByProps({ label: "Nom" }).props.value).toBe("Nouveau nom");
    expect(focusEdit).toHaveBeenCalledOnce();
    act(() => action(editForm(renderer), "Annuler").props.onClick());
    expect(renderer.root.findAllByProps({ id: "team-edit-top" })).toHaveLength(0);
    expect(editButton(renderer, "Autre profil").props.disabled).toBe(false);
    expect(trigger.focus).toHaveBeenCalledOnce();
  });

  it.each(["moved", "removed"])("restores focus after refresh when the edited row was %s", async (outcome) => {
    const props = settings();
    const oldButton = { isConnected: true, focus: vi.fn() };
    const replacement = { isConnected: true, focus: vi.fn() };
    const heading = { focus: vi.fn() };
    let currentButton = oldButton;
    const { renderer, update } = await render(props, (element) => {
      if (element.type === "button" && element.props["aria-label"] === `Modifier ${player.name}`) return currentButton;
      if (element.type === "h3" && element.props.children === "Joueurs et staff") return heading;
      return null;
    });
    openEdit(renderer, player.name, oldButton);
    change(editForm(renderer), "Effectif", "SUB");
    let finishRefresh;
    props.refreshAll.mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));
    apiFetch.mockResolvedValueOnce({});
    let pending;
    await act(async () => { pending = submit(editForm(renderer)); });
    expect(oldButton.focus).not.toHaveBeenCalled();
    oldButton.isConnected = false;
    currentButton = replacement;
    await update({ ...props, data: { ...props.data, players: outcome === "moved" ? [{ ...player, roster_status: "SUB" }] : [] } });
    await act(async () => { finishRefresh(); await pending; });
    expect(oldButton.focus).not.toHaveBeenCalled();
    expect(replacement.focus).toHaveBeenCalledTimes(outcome === "moved" ? 1 : 0);
    expect(heading.focus).toHaveBeenCalledTimes(outcome === "removed" ? 1 : 0);
  });
});

describe("profiles and account access", () => {
  it("uses the profile name in the roster and the distinct account name in access management", async () => {
    const { renderer } = await render();
    const roster = panel(renderer, "roster");
    expect(roster.findAllByType("strong").map(text)).toEqual(["Nom du profil"]);
    expect(text(roster)).not.toContain("Nom du compte");
    await switchTab(renderer, "access");
    const access = panel(renderer, "access");
    expect(access.findAllByType("strong").map(text)).toEqual(["Nom du compte"]);
    expect(text(access)).toContain("Profil associé : Nom du profil");
    expect(access.findAllByProps({ label: "Compte NXT5 associé" })).toHaveLength(0);
    apiFetch.mockResolvedValueOnce({});
    await act(async () => access.findByProps({ label: "Droit d’accès" }).props.onChange("coach"));
    expect(apiFetch).toHaveBeenCalledWith("team-member-role", {
      method: "POST", body: JSON.stringify({ teamId: team.id, userId: account.user_id, role: "coach" }),
    });
  });

  it.each([
    { user_id: "owner", role: "player" },
    { user_id: "legacy-owner", role: "OWNER" },
  ])("protects the owner account $user_id with a badge and no role or removal action", async (owner) => {
    const props = settings();
    props.data.teamMembers = [{ ...account, ...owner, name: "Propriétaire du compte" }, account];
    const { renderer } = await render(props);
    await switchTab(renderer, "access");
    const row = panel(renderer, "access").findAllByType("li").find((item) => item.findAllByType("strong").some((name) => text(name) === "Propriétaire du compte"));
    expect(text(row)).toContain("Propriétaire");
    expect(row.findAllByType("select")).toHaveLength(0);
    expect(row.findAllByType("button")).toHaveLength(0);
    expect(row.findAllByType("details")).toHaveLength(0);
    expect(panel(renderer, "access").findAllByType("select")).toHaveLength(1);
  });

  it("offers account association only in profile editing, blocks already linked accounts and sends precise IDs", async () => {
    const props = settings();
    props.data.players.push({ ...player, id: "mid", name: "Mid", user_id: "taken", role: "MID" });
    props.data.teamMembers.push(
      { ...account, user_id: "taken", name: "Compte déjà lié" },
      { ...account, user_id: "free", name: "Compte disponible" },
      { ...account, user_id: "outsider", team_id: "another-team", name: "Autre équipe" },
    );
    const { renderer } = await render(props);
    expect(renderer.root.findAllByProps({ label: "Compte NXT5 associé" })).toHaveLength(0);
    openEdit(renderer);
    change(editForm(renderer), "Nom", "Brouillon conservé");
    const association = () => editForm(renderer).findByProps({ label: "Compte NXT5 associé" });
    expect(association().props.value).toBe("account");
    const options = association().findAllByType("option");
    expect(options.map((option) => option.props.value)).toEqual(["", "account", "taken", "free"]);
    expect(options.find((option) => option.props.value === "account").props.disabled).toBe(false);
    expect(options.find((option) => option.props.value === "taken").props.disabled).toBe(true);
    expect(options.find((option) => option.props.value === "free").props.disabled).toBe(false);
    apiFetch.mockResolvedValue({});
    await act(async () => association().props.onChange("free"));
    expect(apiFetch).toHaveBeenLastCalledWith("players-link-account", {
      method: "POST", body: JSON.stringify({ teamId: team.id, playerId: player.id, userId: "free" }),
    });
    expect(editForm(renderer).findByProps({ label: "Nom" }).props.value).toBe("Brouillon conservé");
    await act(async () => association().props.onChange(""));
    expect(apiFetch).toHaveBeenLastCalledWith("players-link-account", {
      method: "POST", body: JSON.stringify({ teamId: team.id, playerId: player.id, userId: null }),
    });
    expect(props.refreshAll).toHaveBeenCalledTimes(2);
  });
});

describe("profile save recovery", () => {
  it("retains edited values after an API failure and submits the same draft successfully on retry", async () => {
    const props = settings();
    const { renderer, focusEdit } = await render(props);
    const trigger = { isConnected: true, focus: vi.fn() };
    openEdit(renderer, player.name, trigger);
    change(editForm(renderer), "Nom", "Nom corrigé");
    change(editForm(renderer), "Riot ID", "Corrige#EUW");
    change(editForm(renderer), "OP.GG", "https://www.op.gg/lol/summoners/euw/Corrige-EUW");
    change(editForm(renderer), "Effectif", "SUB");
    let reject;
    apiFetch.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    let pending;
    act(() => { pending = submit(editForm(renderer)); });
    expect(action(editForm(renderer), "Enregistrer").props.disabled).toBe(true);
    expect(editForm(renderer).findByProps({ label: "Compte NXT5 associé" }).props.disabled).toBe(true);
    await act(async () => { reject(new Error("Service indisponible")); await pending; });
    expect(props.pushToast).toHaveBeenCalledWith({ type: "red", title: "Modification impossible", text: "Service indisponible" });
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(trigger.focus).not.toHaveBeenCalled();
    expect(focusEdit).toHaveBeenCalledOnce();
    const expected = { name: "Nom corrigé", riotId: "Corrige#EUW", opggUrl: "https://www.op.gg/lol/summoners/euw/Corrige-EUW", rosterStatus: "SUB" };
    expect(editForm(renderer).findByProps({ label: "Nom" }).props.value).toBe(expected.name);
    expect(editForm(renderer).findByProps({ label: "Riot ID" }).props.value).toBe(expected.riotId);
    expect(editForm(renderer).findByProps({ label: "OP.GG" }).props.value).toBe(expected.opggUrl);
    expect(editForm(renderer).findByProps({ label: "Effectif" }).props.value).toBe(expected.rosterStatus);
    expect(action(editForm(renderer), "Enregistrer").props.disabled).toBe(false);
    apiFetch.mockResolvedValueOnce({});
    await act(async () => submit(editForm(renderer)));
    expect(apiFetch.mock.calls).toEqual(Array(2).fill(["players-update", {
      method: "POST", body: JSON.stringify({ teamId: team.id, playerId: player.id, ...expected }),
    }]));
    expect(renderer.root.findAllByProps({ id: "team-edit-top" })).toHaveLength(0);
    expect(trigger.focus).toHaveBeenCalledOnce();
    expect(props.refreshAll).toHaveBeenCalledOnce();
  });

  it("clears the previous team's editor and drafts when selecting another team", async () => {
    const otherTeam = { ...team, id: "foxes", name: "Foxes", tag: "FOX" };
    const otherPlayer = { ...player, id: "fox-top", team_id: otherTeam.id, name: "Fox player" };
    const props = settings();
    props.data.teams.push(otherTeam);
    props.data.players.push(otherPlayer);
    const { renderer, update } = await render(props);
    openEdit(renderer);
    change(editForm(renderer), "Nom", "Ancien brouillon");
    openAdd(renderer);
    change(addSection(renderer), "Nom", "Ancienne recrue");
    await switchTab(renderer, "settings");
    change(panel(renderer, "settings"), "Nom de l'équipe", "Ancienne équipe");
    await update({ ...props, selectedTeamId: otherTeam.id });
    expect(panel(renderer, "roster").props.hidden).toBe(false);
    expect(renderer.root.findAllByProps({ id: "team-edit-top" })).toHaveLength(0);
    expect(addSection(renderer).props.hidden).toBe(true);
    expect(addSection(renderer).findByProps({ label: "Nom" }).props.value).toBe("");
    await switchTab(renderer, "settings");
    expect(panel(renderer, "settings").findByProps({ label: "Nom de l'équipe" }).props.value).toBe(otherTeam.name);
    await switchTab(renderer, "roster");
    openEdit(renderer, otherPlayer.name);
    expect(editForm(renderer, otherPlayer.id).findByProps({ label: "Nom" }).props.value).toBe(otherPlayer.name);
    apiFetch.mockResolvedValueOnce({});
    await act(async () => submit(editForm(renderer, otherPlayer.id)));
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("players-update", expect.objectContaining({
      body: JSON.stringify({ teamId: otherTeam.id, playerId: otherPlayer.id, name: otherPlayer.name, riotId: otherPlayer.riot_id, opggUrl: "", rosterStatus: "MAIN" }),
    }));
  });
});
