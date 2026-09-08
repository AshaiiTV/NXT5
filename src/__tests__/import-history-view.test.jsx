import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUploadJson } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";

import { SelectInput, TextInput } from "../components/ui/Core.jsx";
import { CategoryMultiSelect, GameActions, GameCategoryManager, ImportGameFlow } from "../pages/workspace/GameOperations.jsx";
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
    selectedTeamId: "team", currentMember: { role: "coach" }, user: { id: "coach" },
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
    expect(window.history.replaceState).toHaveBeenCalledWith({ from: "games" }, "", "https://nxt5.test/integration");
    expect(input(renderer, "Nom de la game").props.value).toBe("Brouillon à conserver");
    const app = { isTrusted: false, stopImmediatePropagation: vi.fn() };
    protectDraft(app);
    expect(app.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(window.history.replaceState).toHaveBeenCalledOnce();
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
        "enemy-adc-0": { role: "MID", playerId: "" },
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
    expect(payload().body.roles["ally-adc-0"]).toEqual({ role: "SUP", playerId: "" });
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
    apiUploadJson.mockResolvedValueOnce({ match: preview }).mockResolvedValueOnce(result);
    const { renderer, props } = await renderFlow({ refreshAll: vi.fn(async () => order.push("refresh")), onImported: vi.fn(() => order.push("imported")) });
    const source = { metadata: { label: "Finale" }, info: { gameId: "fixture" } };
    expect(renderer.root.findAllByProps({ type: "search" })).toHaveLength(0);
    expect(renderer.root.findAllByType("h2")).toHaveLength(0);
    await load(renderer, JSON.stringify(source));
    expect(apiUploadJson.mock.calls[0].slice(0, 2)).toEqual(["matches-import-file", { teamId: "team", payload: source, previewOnly: true }]);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    const blue = renderer.root.findAllByType("button").find((node) => text(node).startsWith("Blue Side"));
    await act(async () => blue.props.onClick());
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson.mock.calls[1].slice(0, 2)).toEqual(["matches-import-file", {
      teamId: "team", payload: source, label: "Finale", categoryIds: [], allyTeamSide: "BLUE",
      laneAssignments: Object.fromEntries(roles.map((role) => [role, `BLUE-${role}#EUW`])),
      enemyLaneAssignments: Object.fromEntries(roles.map((role) => [role, `RED-${role}#EUW`])),
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
    await act(async () => renderer.root.findAllByType("button").find((node) => text(node).startsWith("Blue Side")).props.onClick());
    await click(renderer, "Confirmer l’import");
    expect(input(renderer, "Nom de la game").props.value).toBe("Brouillon à garder");
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
