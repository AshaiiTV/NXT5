import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUploadJson } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";

import { SelectInput, TextInput } from "../components/ui/Core.jsx";
import { CategoryMultiSelect, GameActions, GameCategoryManager, ImportGameFlow, ImportHistoryEditor } from "../pages/workspace/GameOperations.jsx";
import { ImporterDownloadPanel } from "../pages/workspace/ImporterDownloadPanel.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/.netlify/functions" }));

const cleanups = [];
beforeEach(() => {
  vi.stubGlobal("window", {
    location: new URL("https://nxt5.test/integration"), history: { pushState: vi.fn(), replaceState: vi.fn(), state: { from: "games" } }, dispatchEvent: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), scrollTo: vi.fn(), confirm: vi.fn(() => false), setTimeout: vi.fn(), clearTimeout: vi.fn(),
  });
  vi.stubGlobal("document", { body: { style: { overflow: "" } }, activeElement: { focus: vi.fn(), isConnected: true } });
  apiFetch.mockResolvedValue({});
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

const categories = [
  { id: "scrim", team_id: "team", name: "Scrim", is_default: true },
  { id: "league", team_id: "team", name: "Ligue" },
  { id: "empty", team_id: "team", name: "Tournoi" },
  { id: "other-category", team_id: "other-team", name: "Autre équipe" },
];
const roster = [
  { id: "adc", team_id: "team", name: "Luna", role: "ADC" },
  { id: "support", team_id: "team", name: "Solis", role: "SUP" },
  { id: "other-player", team_id: "other-team", name: "Autre joueur", role: "ADC" },
];
function games(count = 24, teamId = "team") {
  return Array.from({ length: count }, (_, index) => ({
    id: `${teamId}-game-${index + 1}`, team_id: teamId, game_id: `EUW1_${index + 1}`,
    raw: { nxt5Label: `Aurora ${String(index + 1).padStart(2, "0")}` },
    imported_at: new Date(Date.UTC(2026, 8, 8 - index, 19)).toISOString(),
    created_at: new Date(Date.UTC(2026, 8, 8 - index, 19)).toISOString(),
    game_date: new Date(Date.UTC(2026, 7, index + 1, 12)).toISOString(),
    duration_seconds: 1200 + index * 10, result: index % 2 ? "Défaite" : "Victoire",
    review_status: index % 2 ? "done" : "todo", side: index % 2 ? "red" : "blue",
    category_ids: index === 3 ? [] : ["scrim"], created_by_name: "Staff NXT5",
    participants: [
      { id: `ally-adc-${index}`, team_key: "ALLY", champion: "Jinx", role: "ADC", player_id: "adc", summoner_name: "Luna" },
      { id: `ally-sup-${index}`, team_key: "ALLY", champion: "Lulu", role: "SUP", player_id: "support", summoner_name: "Solis" },
      { id: `enemy-adc-${index}`, team_key: "ENEMY", champion: "Ashe", role: "ADC", summoner_name: "Rival" },
    ],
  }));
}
function settings(overrides = {}) {
  return {
    data: { ...DEFAULT_DATA, teams: [{ id: "team", name: "Équipe", owner_id: "owner" }, { id: "other-team", name: "Deuxième équipe", owner_id: "someone-else" }], players: roster, matches: [...games(), ...games(1, "other-team")], matchCategories: categories },
    selectedTeamId: "team", currentMember: { role: "coach", team_id: "team", user_id: "coach" }, user: { id: "coach" },
    refreshAll: vi.fn().mockResolvedValue(undefined), pushToast: vi.fn(), ...overrides,
  };
}
function Controls(props) { return <><GameActions {...props} match={props.match || props.data.matches[0]} /><GameCategoryManager {...props} /></>; }
const dialogNodes = [];
let optionsTrigger;
async function render(props = settings()) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<Controls {...props} />, { createNodeMock: (element) => {
    if (element.type === "dialog") {
      const node = { open: false, showModal: vi.fn(function () { this.open = true; }), close: vi.fn(function () { this.open = false; }) };
      dialogNodes.push(node);
      return node;
    }
    const node = { focus: vi.fn(), isConnected: true, querySelector: () => null };
    if (element.props["aria-label"] === "Options de la game") optionsTrigger = node;
    return node;
  } }); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
function text(node) {
  return typeof node === "string" ? node : (node.children || []).map(text).join("");
}
function button(renderer, label) {
  return renderer.root.findAllByType("button").find((node) => node.props["aria-label"] === label || text(node).trim() === label);
}
async function click(renderer, label) {
  const target = button(renderer, label);
  expect(target, `Button ${label}`).toBeTruthy();
  expect(target.props.disabled).not.toBe(true);
  await act(async () => activate(target));
}
function activate(target) {
  if (target.props.type !== "submit") return target.props.onClick();
  let form = target.parent;
  while (form && form.type !== "form") form = form.parent;
  expect(form, "Submit button has a form").toBeTruthy();
  return form.props.onSubmit({ preventDefault: vi.fn() });
}
function select(renderer, label) {
  return renderer.root.findAllByType(SelectInput).find((node) => node.props.label === label).findByType("select");
}
async function filter(renderer, label, value) {
  await act(async () => select(renderer, label).props.onChange({ target: { value } }));
}
function input(renderer, label) {
  return renderer.root.findAllByType(TextInput).find((node) => node.props.label === label)?.findByType("input");
}
async function fill(renderer, label, value) {
  await act(async () => input(renderer, label).props.onChange({ target: { value } }));
}
function payload() {
  const [endpoint, options] = apiFetch.mock.calls.at(-1);
  return { endpoint, method: options.method, body: JSON.parse(options.body) };
}
async function openAction(renderer, label) {
  await click(renderer, "Options de la game");
  await click(renderer, label);
}

describe("discreet game options", () => {
  it("shows only the options icon until opened and closes with Escape without saving", async () => {
    const renderer = await render();
    expect(button(renderer, "Options de la game")).toBeTruthy();
    expect(button(renderer, "Modifier les informations")).toBeUndefined();
    expect(button(renderer, "Corriger les rôles et profils")).toBeUndefined();
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    await openAction(renderer, "Corriger les rôles et profils");
    expect(dialogNodes.at(-1).showModal).toHaveBeenCalledOnce();
    await filter(renderer, "Poste · Jinx", "SUP");
    optionsTrigger.focus.mockClear();
    const cancelEvent = { preventDefault: vi.fn() };
    window.confirm.mockReturnValueOnce(true);
    await act(async () => renderer.root.findByType("dialog").props.onCancel(cancelEvent));
    expect(cancelEvent.preventDefault).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(optionsTrigger.focus).toHaveBeenCalledOnce();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("protects open drafts from native back navigation and lets application navigation through", async () => {
    const renderer = await render();
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Brouillon à conserver");
    const [eventName, protectDraft, capture] = window.addEventListener.mock.calls.at(-1);
    expect(eventName).toBe("popstate");
    expect(capture).toBe(true);
    const native = { isTrusted: true, stopImmediatePropagation: vi.fn() };
    protectDraft(native);
    expect(native.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(window.history.pushState).toHaveBeenCalledWith({ from: "games" }, "", "https://nxt5.test/integration");
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(input(renderer, "Nom de la game").props.value).toBe("Brouillon à conserver");
    const app = { isTrusted: false, stopImmediatePropagation: vi.fn() };
    protectDraft(app);
    expect(app.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(window.history.pushState).toHaveBeenCalledOnce();
    window.confirm.mockReturnValueOnce(true);
    await click(renderer, "Annuler");
    expect(window.removeEventListener).toHaveBeenCalledWith("popstate", protectDraft, true);
  });

  it.each([["player", "member", undefined, false], ["player", "creator", "creator", true], ["coach", "coach", undefined, true], ["player", "owner", undefined, true]])("respects game author and staff permissions (%s / %s)", async (role, userId, creator, allowed) => {
    const props = settings({ currentMember: { role }, user: { id: userId } });
    props.data.matches[0].created_by = creator;
    const renderer = await render(props);
    expect(Boolean(button(renderer, "Options de la game"))).toBe(allowed);
  });

  it("discards the previous team's open form when the team changes", async () => {
    const props = settings();
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Brouillon privé");
    await act(async () => renderer.update(<Controls {...props} selectedTeamId="other-team" currentMember={{ role: "player" }} />));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(input(renderer, "Nom de la game")).toBeUndefined();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("game mutations from the options dialog", () => {
  it("saves the renamed game and its categories, locking controls until the request resolves", async () => {
    const props = settings();
    let resolveSave;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Finale vs Aurora");
    const categoryPicker = renderer.root.findByType(CategoryMultiSelect);
    await act(async () => categoryPicker.findAllByType("button").find((node) => text(node) === "Ligue").props.onClick());
    await act(async () => { activate(button(renderer, "Enregistrer")); });
    expect(payload()).toEqual({ endpoint: "matches-manage", method: "POST", body: { action: "update", teamId: "team", matchId: "team-game-1", label: "Finale vs Aurora", categoryIds: ["scrim", "league"] } });
    expect(button(renderer, "Enregistrement…").props.disabled).toBe(true);
    expect(button(renderer, "Annuler").props.disabled).toBe(true);
    const cancelEvent = { preventDefault: vi.fn() };
    await act(async () => renderer.root.findByType("dialog").props.onCancel(cancelEvent));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    expect(props.refreshAll).not.toHaveBeenCalled();
    await act(async () => resolveSave({}));
    expect(input(renderer, "Nom de la game")).toBeUndefined();
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "green" }));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });

  it("retains a rejected rename and category selection for retry", async () => {
    const props = settings();
    apiFetch.mockRejectedValueOnce(new Error("Connexion interrompue"));
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Finale à conserver");
    await act(async () => renderer.root.findByType(CategoryMultiSelect).props.onChange(["league"]));
    await click(renderer, "Enregistrer");
    expect(input(renderer, "Nom de la game").props.value).toBe("Finale à conserver");
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["league"]);
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "red", text: "Connexion interrompue" }));
    expect(button(renderer, "Enregistrer").props.disabled).toBe(false);
    await click(renderer, "Enregistrer");
    expect(payload().body).toMatchObject({ label: "Finale à conserver", categoryIds: ["league"] });
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(input(renderer, "Nom de la game")).toBeUndefined();
  });

  it("does not send a whitespace-only game name", async () => {
    const renderer = await render();
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "   ");
    expect(button(renderer, "Enregistrer").props.disabled).toBe(true);
    await click(renderer, "Annuler");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("prevents saving after the last tag is removed, including a direct save callback", async () => {
    const renderer = await render();
    await openAction(renderer, "Modifier les informations");
    expect(text(renderer.root)).toContain("Tags (au moins un)");
    await click(renderer, "Scrim");
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual([]);
    expect(button(renderer, "Enregistrer").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Ajoute au moins un tag à la partie.");
    await act(async () => activate(button(renderer, "Enregistrer")));
    await act(async () => renderer.root.findByType(ImportHistoryEditor).props.onSave());
    expect(apiFetch).not.toHaveBeenCalled();

    await click(renderer, "Ligue");
    expect(button(renderer, "Enregistrer").props.disabled).toBe(false);
    await click(renderer, "Enregistrer");
    expect(payload().body.categoryIds).toEqual(["league"]);
  });

  it.each([{ categoryIds: [] }, { categoryIds: ["unknown"] }, { categoryIds: ["other-category"] }])("requires a valid team tag when editing a legacy game with %j", async ({ categoryIds }) => {
    const props = settings();
    props.match = { ...props.data.matches[0], category_ids: categoryIds };
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Nom corrigé");
    expect(button(renderer, "Enregistrer").props.disabled).toBe(true);
    expect(button(renderer, "Autre équipe")).toBeUndefined();
    await act(async () => activate(button(renderer, "Enregistrer")));
    await act(async () => renderer.root.findByType(ImportHistoryEditor).props.onSave());
    expect(apiFetch).not.toHaveBeenCalled();
    await click(renderer, "Scrim");
    expect(button(renderer, "Enregistrer").props.disabled).toBe(false);
  });

  it("cancels role and player changes and restores the original assignments on reopening", async () => {
    const renderer = await render();
    await openAction(renderer, "Corriger les rôles et profils");
    expect(select(renderer, "Poste · Jinx").props.value).toBe("ADC");
    expect(select(renderer, "Profil NXT5 · Jinx").props.value).toBe("adc");
    expect(select(renderer, "Profil NXT5 · Jinx").findAllByType("option").map(text).join(" ")).not.toContain("Autre joueur");
    expect(renderer.root.findAllByType(SelectInput).some((node) => node.props.label === "Profil NXT5 · Ashe")).toBe(false);
    await filter(renderer, "Poste · Jinx", "SUP");
    await filter(renderer, "Profil NXT5 · Jinx", "support");
    await filter(renderer, "Poste · Ashe", "MID");
    expect(select(renderer, "Poste · Jinx").props.value).toBe("SUP");
    expect(select(renderer, "Profil NXT5 · Jinx").props.value).toBe("support");
    await click(renderer, "Annuler");
    await openAction(renderer, "Corriger les rôles et profils");
    expect(select(renderer, "Poste · Jinx").props.value).toBe("ADC");
    expect(select(renderer, "Profil NXT5 · Jinx").props.value).toBe("adc");
    expect(select(renderer, "Poste · Ashe").props.value).toBe("ADC");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends allied player links and both teams' corrected roles in one request", async () => {
    const props = settings({ onUpdated: vi.fn() });
    const renderer = await render(props);
    await openAction(renderer, "Corriger les rôles et profils");
    await filter(renderer, "Poste · Jinx", "SUP");
    await filter(renderer, "Profil NXT5 · Jinx", "support");
    await filter(renderer, "Poste · Lulu", "ADC");
    await filter(renderer, "Profil NXT5 · Lulu", "adc");
    await filter(renderer, "Poste · Ashe", "MID");
    await click(renderer, "Enregistrer");
    expect(payload()).toEqual({ endpoint: "matches-manage", method: "POST", body: {
      action: "roles", teamId: "team", matchId: "team-game-1", roles: {
        "ally-adc-0": { role: "SUP", playerId: "support" },
        "ally-sup-0": { role: "ADC", playerId: "adc" },
        "enemy-adc-0": { role: "MID" },
      },
    } });
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "green", title: "Assignation corrigée" }));
    expect(props.onUpdated).toHaveBeenCalledWith({ matchId: "team-game-1", action: "roles", result: {} });
    expect(button(renderer, "Options de la game")).toBeTruthy();
    expect(button(renderer, "Annuler")).toBeUndefined();
  });

  it("retains corrected role assignments after a failed save and allows retry", async () => {
    const props = settings();
    apiFetch.mockRejectedValueOnce(new Error("Assignation indisponible"));
    const renderer = await render(props);
    await openAction(renderer, "Corriger les rôles et profils");
    await filter(renderer, "Poste · Jinx", "SUP");
    await filter(renderer, "Profil NXT5 · Jinx", "");
    await click(renderer, "Enregistrer");
    expect(select(renderer, "Poste · Jinx").props.value).toBe("SUP");
    expect(select(renderer, "Profil NXT5 · Jinx").props.value).toBe("");
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "red", text: "Assignation indisponible" }));
    await click(renderer, "Enregistrer");
    expect(payload().body.roles["ally-adc-0"]).toEqual({ role: "SUP" });
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(button(renderer, "Options de la game")).toBeTruthy();
  });

  it("requires an explicit deletion confirmation and reports the removed game", async () => {
    const props = settings({ onDeleted: vi.fn() });
    const renderer = await render(props);
    await openAction(renderer, "Supprimer");
    expect(text(renderer.root.findByType("dialog"))).toContain("Aurora 01");
    expect(apiFetch).not.toHaveBeenCalled();
    await click(renderer, "Annuler");
    expect(apiFetch).not.toHaveBeenCalled();
    await openAction(renderer, "Supprimer");
    await click(renderer, "Supprimer la game");
    expect(payload()).toEqual({ endpoint: "matches-manage", method: "POST", body: { action: "delete", teamId: "team", matchId: "team-game-1" } });
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(props.onDeleted).toHaveBeenCalledWith("team-game-1");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });

  it("keeps the deletion confirmation open after an error", async () => {
    const props = settings({ onDeleted: vi.fn() });
    const renderer = await render(props);
    apiFetch.mockRejectedValueOnce(new Error("Suppression refusée"));
    await openAction(renderer, "Supprimer");
    await click(renderer, "Supprimer la game");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    expect(button(renderer, "Supprimer la game").props.disabled).toBe(false);
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(props.onDeleted).not.toHaveBeenCalled();
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "red", text: "Suppression refusée" }));
  });
});

describe("category creation while editing an imported game", () => {
  const createdCategory = { id: "bootcamp", team_id: "team", name: "Bootcamp", color: "purple" };
  const creator = (renderer) => renderer.root.findAllByType("div").find((node) => node.props.role === "group" && node.props["aria-label"] === "Nouvelle catégorie");
  const creatorButton = (renderer, label) => creator(renderer)?.findAllByType("button").find((node) => text(node).trim() === label);
  const editorButton = (renderer, label) => renderer.root.findByType(ImportHistoryEditor).findAllByType("button").find((node) => text(node).trim() === label);
  function defer() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  }
  async function openCreator(renderer, name = "Bootcamp") {
    await click(renderer, "Nouvelle catégorie");
    await fill(renderer, "Nom de la catégorie", name);
  }

  it("creates a category, preserves the edited name and tags, and saves before the shared refresh finishes", async () => {
    const refresh = defer();
    const props = settings({ refreshAll: vi.fn().mockResolvedValue(undefined).mockImplementationOnce(() => refresh.promise), onUpdated: vi.fn() });
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Finale vs Aurora · Partie 2");
    await click(renderer, "Ligue");
    await openCreator(renderer);
    expect(input(renderer, "Nom de la catégorie").props.maxLength).toBe(80);
    expect(select(renderer, "Couleur").props.value).toBe("cyan");
    await filter(renderer, "Couleur", "purple");
    apiFetch.mockResolvedValueOnce({ category: createdCategory });
    let pending;
    await act(async () => { pending = activate(creatorButton(renderer, "Créer et sélectionner")); });

    expect(payload()).toEqual({ endpoint: "match-categories-manage", method: "POST", body: { action: "create", teamId: "team", name: "Bootcamp", color: "purple" } });
    expect(props.refreshAll).toHaveBeenCalledOnce();
    expect(button(renderer, "Bootcamp").props["aria-pressed"]).toBe(true);
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim", "league", "bootcamp"]);
    expect(input(renderer, "Nom de la game").props.value).toBe("Finale vs Aurora · Partie 2");
    expect(input(renderer, "Nom de la catégorie")).toBeUndefined();
    expect(button(renderer, "Enregistrer").props.disabled).toBe(false);
    await click(renderer, "Enregistrer");
    expect(payload()).toEqual({ endpoint: "matches-manage", method: "POST", body: { action: "update", teamId: "team", matchId: "team-game-1", label: "Finale vs Aurora · Partie 2", categoryIds: ["scrim", "league", "bootcamp"] } });
    expect(props.onUpdated).toHaveBeenCalledWith(expect.objectContaining({ action: "update", matchId: "team-game-1" }));
    await act(async () => { refresh.resolve(); await pending; });
  });

  it("uses Enter to create the category without submitting the game editor", async () => {
    const renderer = await render();
    await openAction(renderer, "Modifier les informations");
    await openCreator(renderer);
    const group = creator(renderer);
    expect(group.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findAllByType("form")).toHaveLength(1);
    expect(creatorButton(renderer, "Créer et sélectionner").props.type).toBe("button");
    apiFetch.mockResolvedValueOnce({ category: createdCategory });
    const event = { key: "Enter", target: { tagName: "INPUT" }, preventDefault: vi.fn(), stopPropagation: vi.fn(), nativeEvent: { isComposing: false } };
    await act(async () => group.props.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch.mock.calls[0][0]).toBe("match-categories-manage");
    expect(button(renderer, "Bootcamp").props["aria-pressed"]).toBe(true);
    expect(input(renderer, "Nom de la game").props.value).toBe("Aurora 01");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
  });

  it.each([{ tagName: "SELECT", composing: false }, { tagName: "INPUT", composing: true }])("does not create or save on Enter from %j", async ({ tagName, composing }) => {
    const renderer = await render();
    await openAction(renderer, "Modifier les informations");
    await openCreator(renderer);
    const event = { key: "Enter", target: { tagName }, preventDefault: vi.fn(), stopPropagation: vi.fn(), isComposing: composing, nativeEvent: { isComposing: composing } };
    await act(async () => creator(renderer).props.onKeyDown(event));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(input(renderer, "Nom de la catégorie").props.value).toBe("Bootcamp");
  });

  it("selects an existing category regardless of case and preserves the game draft", async () => {
    const props = settings();
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Brouillon privé");
    await openCreator(renderer, "  lIGUE  ");
    await click(renderer, "Créer et sélectionner");
    expect(apiFetch).not.toHaveBeenCalled();
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim", "league"]);
    expect(input(renderer, "Nom de la game").props.value).toBe("Brouillon privé");
    expect(creator(renderer)).toBeUndefined();
  });

  it("blocks a blank category and cancels only its draft", async () => {
    const renderer = await render();
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Brouillon de partie");
    await openCreator(renderer, "   ");
    expect(creatorButton(renderer, "Créer et sélectionner").props.disabled).toBe(true);
    await act(async () => activate(creatorButton(renderer, "Créer et sélectionner")));
    expect(apiFetch).not.toHaveBeenCalled();
    await fill(renderer, "Nom de la catégorie", "À abandonner");
    await act(async () => activate(creatorButton(renderer, "Annuler")));
    expect(input(renderer, "Nom de la catégorie")).toBeUndefined();
    expect(input(renderer, "Nom de la game").props.value).toBe("Brouillon de partie");
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim"]);
    await click(renderer, "Nouvelle catégorie");
    expect(input(renderer, "Nom de la catégorie").props.value).toBe("");
  });

  it("keeps category fields, the game name and tags after a 403 and allows retry", async () => {
    const props = settings();
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await fill(renderer, "Nom de la game", "Finale à conserver");
    await openCreator(renderer);
    await filter(renderer, "Couleur", "purple");
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Accès team refusé."), { status: 403 }));
    await click(renderer, "Créer et sélectionner");
    expect(creator(renderer).findAllByProps({ role: "alert" }).some((node) => text(node).includes("Accès team refusé."))).toBe(true);
    expect(input(renderer, "Nom de la catégorie").props.value).toBe("Bootcamp");
    expect(select(renderer, "Couleur").props.value).toBe("purple");
    expect(input(renderer, "Nom de la game").props.value).toBe("Finale à conserver");
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim"]);
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(creatorButton(renderer, "Créer et sélectionner").props.disabled).toBe(false);
    apiFetch.mockResolvedValueOnce({ category: createdCategory });
    await click(renderer, "Créer et sélectionner");
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim", "bootcamp"]);
  });

  it("retains the created category across reopening before shared data includes it", async () => {
    const props = settings();
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await openCreator(renderer);
    apiFetch.mockResolvedValueOnce({ category: createdCategory });
    await click(renderer, "Créer et sélectionner");
    window.confirm.mockReturnValueOnce(true);
    await act(async () => activate(editorButton(renderer, "Annuler")));
    await openAction(renderer, "Modifier les informations");
    expect(button(renderer, "Bootcamp").props["aria-pressed"]).toBe(false);
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim"]);
    await openCreator(renderer, "bootcamp");
    await click(renderer, "Créer et sélectionner");
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim", "bootcamp"]);
  });

  it("retains the created tag when shared-data refresh fails", async () => {
    const props = settings({ refreshAll: vi.fn().mockRejectedValue(new Error("Actualisation indisponible")) });
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await openCreator(renderer);
    apiFetch.mockResolvedValueOnce({ category: createdCategory });
    await click(renderer, "Créer et sélectionner");
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual(["scrim", "bootcamp"]);
    expect(creator(renderer)).toBeUndefined();
    expect(button(renderer, "Enregistrer").props.disabled).toBe(false);
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("protects the category name draft when dismissing the game dialog", async () => {
    const renderer = await render();
    await openAction(renderer, "Modifier les informations");
    await openCreator(renderer);
    await click(renderer, "Fermer la fenêtre");
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(input(renderer, "Nom de la catégorie").props.value).toBe("Bootcamp");
    expect(apiFetch).not.toHaveBeenCalled();
    window.confirm.mockReturnValueOnce(true);
    await click(renderer, "Fermer la fenêtre");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });

  it("serializes same-tick creation requests and blocks game saves and closing while pending", async () => {
    const props = settings();
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await openCreator(renderer);
    const request = defer();
    apiFetch.mockImplementationOnce(() => request.promise);
    const create = creatorButton(renderer, "Créer et sélectionner").props.onClick;
    let pending;
    await act(async () => { pending = create(); void create(); });
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(button(renderer, "Création…").props.disabled).toBe(true);
    expect(button(renderer, "Enregistrer").props.disabled).toBe(true);
    expect(editorButton(renderer, "Annuler").props.disabled).toBe(true);
    expect(button(renderer, "Fermer la fenêtre").props.disabled).toBe(true);
    const cancel = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    await act(async () => {
      renderer.root.findByType("dialog").props.onCancel(cancel);
      renderer.root.findByType(ImportHistoryEditor).props.onSave();
    });
    expect(window.confirm).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    await act(async () => { request.resolve({ category: createdCategory }); await pending; });
    expect(button(renderer, "Enregistrer").props.disabled).toBe(false);
    expect(button(renderer, "Fermer la fenêtre").props.disabled).toBe(false);
  });

  it.each([
    ["owner", { role: "player", team_id: "team", user_id: "owner" }, true],
    ["coach", { role: "coach", team_id: "team", user_id: "coach" }, true],
    ["author", { role: "player", team_id: "team", user_id: "author" }, false],
    ["author", { role: "coach", team_id: "other-team", user_id: "author" }, false],
    ["author", { role: "coach", team_id: "team", user_id: "another-user" }, false],
  ])("limits category creation to the current team's staff or owner (%s / %j)", async (userId, currentMember, canCreate) => {
    const props = settings({ user: { id: userId }, currentMember });
    props.match = { ...props.data.matches[0], created_by: userId };
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    expect(input(renderer, "Nom de la game")).toBeTruthy();
    expect(Boolean(button(renderer, "Nouvelle catégorie"))).toBe(canCreate);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each(["match", "team", "user", "permission", "unmount"])("aborts category creation after %s changes and ignores a late private result", async (interruption) => {
    const props = settings();
    props.match = { ...props.data.matches[0], created_by: "coach" };
    const renderer = await render(props);
    await openAction(renderer, "Modifier les informations");
    await openCreator(renderer);
    const request = defer();
    apiFetch.mockImplementationOnce(() => request.promise);
    let pending;
    await act(async () => { pending = activate(creatorButton(renderer, "Créer et sélectionner")); });
    const signal = apiFetch.mock.calls[0][1].signal;
    expect(signal?.aborted).toBe(false);
    const next = interruption === "match" ? { ...props, match: props.data.matches[1] }
      : interruption === "team" ? { ...props, selectedTeamId: "other-team", match: props.data.matches.at(-1), currentMember: { role: "coach", team_id: "other-team", user_id: "coach" } }
      : interruption === "user" ? { ...props, user: { id: "another-coach" }, currentMember: { role: "coach", team_id: "team", user_id: "another-coach" } }
      : { ...props, currentMember: { role: "player", team_id: "team", user_id: "coach" } };
    await act(async () => {
      if (interruption === "unmount") renderer.unmount();
      else renderer.update(<Controls {...next} />);
    });
    expect(signal.aborted).toBe(true);
    props.pushToast.mockClear();
    await act(async () => { request.resolve({ category: createdCategory }); await pending; });
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(props.pushToast).not.toHaveBeenCalled();
    if (interruption !== "unmount") {
      if (!renderer.root.findAllByType(ImportHistoryEditor).length) await openAction(renderer, "Modifier les informations");
      expect(button(renderer, "Bootcamp")).toBeUndefined();
      expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).not.toContain("bootcamp");
      if (interruption === "permission") expect(button(renderer, "Nouvelle catégorie")).toBeUndefined();
    }
  });
});

describe("category management on demand", () => {
  it.each([
    ["player", "member", false],
    ["coach", "coach", true],
    ["player", "owner", true],
  ])("exposes category management according to role %s and account %s", async (role, userId, allowed) => {
    const renderer = await render(settings({ currentMember: { role }, user: { id: userId } }));
    expect(Boolean(button(renderer, "Catégories"))).toBe(allowed);
    expect(button(renderer, "Ajouter une catégorie")).toBeUndefined();
    if (allowed) {
      await click(renderer, "Catégories");
      expect(button(renderer, "Ajouter une catégorie")).toBeTruthy();
      expect(button(renderer, "Supprimer la catégorie Scrim")).toBeUndefined();
      expect(button(renderer, "Supprimer la catégorie Ligue")).toBeTruthy();
      expect(button(renderer, "Supprimer la catégorie Autre équipe")).toBeUndefined();
    }
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("creates a category and keeps the management section accessible after saving", async () => {
    const props = settings();
    const renderer = await render(props);
    await click(renderer, "Catégories");
    await click(renderer, "Ajouter une catégorie");
    await fill(renderer, "Nom de la catégorie", "Bootcamp");
    await filter(renderer, "Couleur", "purple");
    await click(renderer, "Créer");
    expect(payload()).toEqual({ endpoint: "match-categories-manage", method: "POST", body: { action: "create", teamId: "team", name: "Bootcamp", color: "purple" } });
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(input(renderer, "Nom de la catégorie")).toBeUndefined();
    expect(button(renderer, "Ajouter une catégorie")).toBeTruthy();
  });

  it("preserves a rejected category draft and respects deletion confirmation", async () => {
    const props = settings();
    const renderer = await render(props);
    await click(renderer, "Catégories");
    await click(renderer, "Ajouter une catégorie");
    await fill(renderer, "Nom de la catégorie", "Bootcamp");
    await filter(renderer, "Couleur", "purple");
    apiFetch.mockRejectedValueOnce(new Error("Création refusée"));
    await click(renderer, "Créer");
    expect(input(renderer, "Nom de la catégorie").props.value).toBe("Bootcamp");
    expect(select(renderer, "Couleur").props.value).toBe("purple");
    expect(props.refreshAll).not.toHaveBeenCalled();
    await click(renderer, "Annuler");
    apiFetch.mockClear();
    await click(renderer, "Supprimer la catégorie Ligue");
    expect(apiFetch).not.toHaveBeenCalled();
    window.confirm.mockReturnValueOnce(true);
    await click(renderer, "Supprimer la catégorie Ligue");
    expect(payload()).toEqual({ endpoint: "match-categories-manage", method: "POST", body: { action: "delete", teamId: "team", categoryId: "league" } });
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
  });
});

describe("changing the imported team's side", () => {
  const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
  const blueChampions = ["Aatrox", "LeeSin", "Ahri", "Jinx", "Lulu"];
  const redChampions = ["Ornn", "Vi", "Syndra", "Ashe", "Nami"];
  function sideSettings() {
    const props = settings({ onUpdated: vi.fn() });
    props.data.players = roles.map((role) => ({ id: `profile-${role}`, team_id: "team", role, name: `NXT5 ${role}` }));
    props.match = { ...props.data.matches[0], participants: [blueChampions, redChampions].flatMap((champions, teamIndex) => champions.map((champion, index) => ({
      id: `${teamIndex}-${roles[index]}`, team_key: teamIndex ? "ENEMY" : "ALLY", raw: { teamId: teamIndex ? 200 : 100 },
      champion, role: roles[index], player_id: teamIndex ? null : `profile-${roles[index]}`,
    }))) };
    return props;
  }

  it("previews the opposite team's champions, then saves the side and the five profiles together", async () => {
    const props = sideSettings();
    const renderer = await render(props);
    await openAction(renderer, "Changer le côté de notre équipe");
    expect(select(renderer, "Côté de notre équipe").props.value).toBe("BLUE");
    expect(button(renderer, "Enregistrer le côté").props.disabled).toBe(true);
    const allies = () => renderer.root.findByProps({ "aria-label": "Notre équipe après correction" });
    expect(text(allies())).toContain("Jinx");
    await filter(renderer, "Côté de notre équipe", "RED");
    expect(text(allies())).toContain("Ashe");
    expect(text(allies())).not.toContain("Jinx");
    expect(select(renderer, "Profil NXT5 · Ashe").props.value).toBe("profile-ADC");
    expect(button(renderer, "Enregistrer le côté").props.disabled).toBe(false);
    await click(renderer, "Enregistrer le côté");
    expect(payload().body).toEqual({ action: "side", teamId: "team", matchId: props.match.id, allyTeamSide: "RED", playerAssignments: Object.fromEntries(roles.map((role) => [role, `profile-${role}`])) });
    expect(props.refreshAll).toHaveBeenCalledOnce();
    expect(props.onUpdated).toHaveBeenCalledWith(expect.objectContaining({ matchId: props.match.id, action: "side" }));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });

  it("cancels the side draft and restores the saved side on reopening", async () => {
    const renderer = await render(sideSettings());
    await openAction(renderer, "Changer le côté de notre équipe");
    await filter(renderer, "Côté de notre équipe", "RED");
    await click(renderer, "Annuler");
    expect(apiFetch).not.toHaveBeenCalled();
    await openAction(renderer, "Changer le côté de notre équipe");
    expect(select(renderer, "Côté de notre équipe").props.value).toBe("BLUE");
    expect(button(renderer, "Enregistrer le côté").props.disabled).toBe(true);
  });

  it("retains a failed correction for retry and locks the form until saving finishes", async () => {
    const props = sideSettings();
    apiFetch.mockRejectedValueOnce(new Error("Connexion interrompue"));
    const renderer = await render(props);
    await openAction(renderer, "Changer le côté de notre équipe");
    await filter(renderer, "Côté de notre équipe", "RED");
    await click(renderer, "Enregistrer le côté");
    expect(select(renderer, "Côté de notre équipe").props.value).toBe("RED");
    expect(props.refreshAll).not.toHaveBeenCalled();
    let resolveSave;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    await act(async () => { activate(button(renderer, "Enregistrer le côté")); });
    expect(renderer.root.findByType("fieldset").props.disabled).toBe(true);
    expect(button(renderer, "Annuler").props.disabled).toBe(true);
    await act(async () => renderer.root.findByType("dialog").props.onCancel({ preventDefault: vi.fn() }));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    await act(async () => resolveSave({ warnings: ["Vérifie la review conservée."] }));
    expect(props.pushToast).toHaveBeenLastCalledWith(expect.objectContaining({ type: "yellow", title: "Côté de l’équipe corrigé", text: "Vérifie la review conservée." }));
    expect(props.refreshAll).toHaveBeenCalledOnce();
  });

  it("requires distinct profiles and a complete set of roles for the new allies", async () => {
    const props = sideSettings();
    const renderer = await render(props);
    await openAction(renderer, "Changer le côté de notre équipe");
    await filter(renderer, "Côté de notre équipe", "RED");
    await filter(renderer, "Profil NXT5 · Ashe", "profile-SUP");
    expect(button(renderer, "Enregistrer le côté").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Choisis un profil différent pour chaque poste.");
    await click(renderer, "Annuler");
    props.match = { ...props.match, participants: props.match.participants.map((row) => row.id === "1-ADC" ? { ...row, role: "SUP" } : row) };
    await act(async () => renderer.update(<Controls {...props} />));
    await openAction(renderer, "Changer le côté de notre équipe");
    await filter(renderer, "Côté de notre équipe", "RED");
    expect(button(renderer, "Enregistrer le côté").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Les cinq postes de ce côté doivent être renseignés.");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("import flow without a second game list", () => {
  const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
  const champions = ["Aatrox", "LeeSin", "Ahri", "Jinx", "Lulu"];
  const preview = { teams: ["BLUE", "RED"].map((side, teamIndex) => ({ side, win: !teamIndex, participants: roles.map((role, index) => ({ participantId: teamIndex * 5 + index + 1, teamPosition: role, champion: champions[index], riotId: `${side}-${role}#EUW` })) })) };
  async function renderFlow(overrides = {}) {
    const props = settings({
      onImported: vi.fn(), onBusyChange: vi.fn(), ...overrides,
    });
    props.data.players = roles.map((role, index) => ({ id: `profile-${role}`, team_id: "team", name: `NXT5 ${role}`, role, riot_id: `BLUE-${role}#EUW` }));
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<ImportGameFlow {...props} />); });
    cleanups.push(() => act(() => renderer.unmount()));
    return { renderer, props };
  }
  const load = async (renderer, content) => {
    await act(async () => renderer.root.findByType(ImporterDownloadPanel).props.onImport({ name: "game.json", size: content.length, text: async () => content }));
  };

  it("previews JSON, keeps the original assignment payload, and opens the imported game only after refresh", async () => {
    const order = [];
    const result = { match: { id: "imported", team_id: "team" }, warnings: [{ message: "Chronologie partielle" }] };
    let resolveImport;
    const finalImport = new Promise((resolve) => { resolveImport = resolve; });
    apiUploadJson.mockResolvedValueOnce({ match: preview }).mockImplementationOnce(() => finalImport);
    const { renderer, props } = await renderFlow({ refreshAll: vi.fn(async () => order.push("refresh")), onImported: vi.fn(() => order.push("imported")) });
    const source = { metadata: { label: "Finale" }, info: { gameId: "fixture" } };
    expect(renderer.root.findAllByProps({ type: "search" })).toHaveLength(0);
    expect(renderer.root.findAllByType("h2")).toHaveLength(0);
    await load(renderer, JSON.stringify(source));
    expect(apiUploadJson.mock.calls[0].slice(0, 2)).toEqual(["matches-import-file", { teamId: "team", payload: source, previewOnly: true }]);
    const blue = renderer.root.findAllByType("button").find((node) => text(node).startsWith("Côté bleu"));
    expect(blue.props["aria-pressed"]).toBe(true);
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await click(renderer, "Scrim");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    // React 19 regroupe les rendus d'un même act : l'import final reste en attente
    // pour observer l'état occupé avant sa résolution.
    let confirming;
    await act(async () => { confirming = activate(button(renderer, "Confirmer l’import")); });
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
    await act(async () => { resolveImport(result); await confirming; });
    expect(apiUploadJson.mock.calls[1].slice(0, 2)).toEqual(["matches-import-file", {
      teamId: "team", payload: source, label: "Finale", categoryIds: ["scrim"], allyTeamSide: "BLUE",
      laneAssignments: Object.fromEntries(roles.map((role, index) => [role, `participant:${index + 1}`])),
      enemyLaneAssignments: Object.fromEntries(roles.map((role, index) => [role, `participant:${index + 6}`])),
      playerAssignments: Object.fromEntries(roles.map((role) => [role, `profile-${role}`])),
    }]);
    expect(props.onImported).toHaveBeenCalledWith(result);
    expect(order).toEqual(["refresh", "imported"]);
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "yellow", text: "Chronologie partielle" }));
    expect(props.onBusyChange.mock.calls.map(([busy]) => busy)).toContain(true);
    expect(props.onBusyChange.mock.calls.at(-1)).toEqual([false]);
    expect(button(renderer, "Confirmer l’import")).toBeUndefined();
  });

  it("keeps the draft after a failed final import for retry", async () => {
    apiUploadJson.mockResolvedValueOnce({ match: preview }).mockRejectedValueOnce(new Error("Connexion interrompue"));
    const { renderer, props } = await renderFlow();
    await load(renderer, JSON.stringify({ label: "Brouillon à garder" }));
    await act(async () => renderer.root.findAllByType("button").find((node) => text(node).startsWith("Côté bleu")).props.onClick());
    await click(renderer, "Scrim");
    await click(renderer, "Confirmer l’import");
    expect(input(renderer, "Nom de la partie").props.value).toBe("Brouillon à garder");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    expect(props.onImported).not.toHaveBeenCalled();
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "red" }));
  });

  it("rejects invalid JSON before making an API call", async () => {
    const { renderer, props } = await renderFlow();
    await load(renderer, "{oops");
    expect(apiUploadJson).not.toHaveBeenCalled();
    expect(props.onImported).not.toHaveBeenCalled();
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "red", text: expect.stringContaining("JSON valide") }));
  });
});


it.each([["", undefined], ["__unlink__", null], ["support", "support"]])("R-I3 serializes profile choice %s explicitly", async (choice, expected) => {
  const renderer = await render();
  await openAction(renderer, "Corriger les rôles et profils");
  await filter(renderer, "Profil NXT5 · Jinx", choice);
  await click(renderer, "Enregistrer");
  const request = apiFetch.mock.calls.find(([path]) => path === "matches-manage");
  const row = JSON.parse(request[1].body).roles["ally-adc-0"];
  expect(row.playerId).toBe(expected);
  expect(Object.hasOwn(row, "playerId")).toBe(choice !== "");
});
