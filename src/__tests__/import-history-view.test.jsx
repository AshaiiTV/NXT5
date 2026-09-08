import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { ImportedGames } from "../components/games/ImportedGames.jsx";
import { SelectInput, TextInput } from "../components/ui/Core.jsx";
import { CategoryMultiSelect, Matches } from "../pages/workspace/GameWorkspace.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/.netlify/functions" }));

const cleanups = [];
beforeEach(() => {
  vi.stubGlobal("window", {
    location: new URL("https://nxt5.test/integration"), history: { pushState: vi.fn() }, dispatchEvent: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), scrollTo: vi.fn(), confirm: vi.fn(() => false),
  });
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
async function render(props = settings()) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<Suspense fallback="loading"><Matches {...props} /></Suspense>); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
function text(node) {
  return typeof node === "string" ? node : (node.children || []).map(text).join("");
}
function button(renderer, label) {
  return renderer.root.findAllByType("button").find((node) => node.props["aria-label"] === label || text(node).trim() === label);
}
function rows(renderer) {
  return renderer.root.findAllByType("button").filter((node) => node.props.className === "ig-game");
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
async function pick(renderer, gameNumber = 1) {
  const target = rows(renderer).find((node) => node.props["aria-label"].endsWith(`EUW1_${gameNumber}`));
  expect(target).toBeTruthy();
  expect(target.props.disabled).not.toBe(true);
  await act(async () => target.props.onClick());
}
async function search(renderer, query) {
  await act(async () => renderer.root.findByProps({ type: "search" }).props.onChange({ target: { value: query } }));
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
function activeId(renderer) {
  return renderer.root.findByType(ImportedGames).props.selectedMatchId;
}

describe("import history browsing", () => {
  it("uses import order, scopes games and categories to the team, and opens the selected stats", async () => {
    const renderer = await render();
    expect(rows(renderer)).toHaveLength(10);
    expect(rows(renderer)[0].props["aria-label"]).toMatch(/EUW1_1$/);
    expect(select(renderer, "Trier par").props.value).toBe("import-newest");
    expect(select(renderer, "Catégorie").findAllByType("option").map(text)).not.toContain("Autre équipe");
    await filter(renderer, "Trier par", "import-oldest");
    expect(rows(renderer)[0].props["aria-label"]).toMatch(/EUW1_24$/);
    await filter(renderer, "Trier par", "newest");
    expect(rows(renderer)[0].props["aria-label"]).toMatch(/EUW1_24$/);
    await pick(renderer, 24);
    await click(renderer, "Voir les stats");
    expect(window.history.pushState).toHaveBeenCalledWith({}, "", "/statistiques?match=team-game-24");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("recovers from an empty category and finds uncategorized games", async () => {
    const renderer = await render();
    await filter(renderer, "Catégorie", "empty");
    expect(rows(renderer)).toHaveLength(0);
    expect(select(renderer, "Catégorie").props.value).toBe("empty");
    const reset = renderer.root.findByProps({ className: "ig-empty" }).findByType("button");
    await act(async () => reset.props.onClick());
    expect(rows(renderer)).toHaveLength(10);
    expect(select(renderer, "Catégorie").props.value).toBe("");
    await filter(renderer, "Catégorie", "__uncategorized__");
    expect(rows(renderer)).toHaveLength(1);
    expect(rows(renderer)[0].props["aria-label"]).toMatch(/EUW1_4$/);
    await search(renderer, "introuvable");
    expect(rows(renderer)).toHaveLength(0);
    await act(async () => renderer.root.findByProps({ className: "ig-empty" }).findByType("button").props.onClick());
    expect(rows(renderer)).toHaveLength(10);
  });

  it("preserves an edit draft through search, filters and pagination until cancellation", async () => {
    const renderer = await render();
    await pick(renderer);
    await click(renderer, "Modifier");
    await fill(renderer, "Nom de la game", "Finale — brouillon");
    await click(renderer, "Page suivante");
    expect(activeId(renderer)).toBe("team-game-1");
    expect(input(renderer, "Nom de la game").props.value).toBe("Finale — brouillon");
    expect(rows(renderer).every((node) => node.props.disabled)).toBe(true);
    expect(button(renderer, "Désélectionner la game").props.disabled).toBe(true);
    await search(renderer, "introuvable");
    await filter(renderer, "Catégorie", "empty");
    expect(rows(renderer)).toHaveLength(0);
    expect(input(renderer, "Nom de la game").props.value).toBe("Finale — brouillon");
    await click(renderer, "Afficher dans la liste");
    expect(rows(renderer).filter((node) => node.props["aria-pressed"])).toHaveLength(1);
    expect(input(renderer, "Nom de la game").props.value).toBe("Finale — brouillon");
    await click(renderer, "Annuler");
    expect(input(renderer, "Nom de la game")).toBeUndefined();
    expect(rows(renderer).every((node) => !node.props.disabled)).toBe(true);
    await pick(renderer, 2);
    expect(activeId(renderer)).toBe("team-game-2");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("resets selection, draft and list filters when changing teams", async () => {
    const props = settings();
    const renderer = await render(props);
    await pick(renderer);
    await click(renderer, "Modifier");
    await fill(renderer, "Nom de la game", "Brouillon de la première équipe");
    await search(renderer, "introuvable");
    await filter(renderer, "Catégorie", "scrim");
    await act(async () => renderer.update(<Suspense fallback="loading"><Matches {...props} selectedTeamId="other-team" currentMember={{ role: "player" }} /></Suspense>));
    expect(activeId(renderer)).toBeFalsy();
    expect(input(renderer, "Nom de la game")).toBeUndefined();
    expect(renderer.root.findByProps({ type: "search" }).props.value).toBe("");
    expect(select(renderer, "Catégorie").props.value).toBe("");
    expect(rows(renderer)).toHaveLength(1);
    await pick(renderer);
    expect(activeId(renderer)).toBe("other-team-game-1");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("import history mutations", () => {
  it("saves the renamed game and its categories, locking controls until the request resolves", async () => {
    const props = settings();
    let resolveSave;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const renderer = await render(props);
    await pick(renderer);
    await click(renderer, "Modifier");
    await fill(renderer, "Nom de la game", "Finale vs Aurora");
    const categoryPicker = renderer.root.findByType(CategoryMultiSelect);
    await act(async () => categoryPicker.findAllByType("button").find((node) => text(node) === "Ligue").props.onClick());
    await act(async () => { activate(button(renderer, "Enregistrer")); });
    expect(payload()).toEqual({ endpoint: "matches-manage", method: "POST", body: { action: "update", teamId: "team", matchId: "team-game-1", label: "Finale vs Aurora", categoryIds: ["scrim", "league"] } });
    expect(button(renderer, "Enregistrement…").props.disabled).toBe(true);
    expect(button(renderer, "Annuler").props.disabled).toBe(true);
    expect(button(renderer, "Désélectionner la game").props.disabled).toBe(true);
    expect(props.refreshAll).not.toHaveBeenCalled();
    await act(async () => resolveSave({}));
    expect(input(renderer, "Nom de la game")).toBeUndefined();
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "green" }));
    expect(button(renderer, "Désélectionner la game").props.disabled).toBe(false);
  });

  it("retains a rejected rename and category selection for retry", async () => {
    const props = settings();
    apiFetch.mockRejectedValueOnce(new Error("Connexion interrompue"));
    const renderer = await render(props);
    await pick(renderer);
    await click(renderer, "Modifier");
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
    await pick(renderer);
    await click(renderer, "Modifier");
    await fill(renderer, "Nom de la game", "   ");
    expect(button(renderer, "Enregistrer").props.disabled).toBe(true);
    await click(renderer, "Annuler");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("cancels role and player changes and restores the original assignments on reopening", async () => {
    const renderer = await render();
    await pick(renderer);
    await click(renderer, "Postes");
    expect(select(renderer, "Poste · Jinx").props.value).toBe("ADC");
    expect(select(renderer, "Profil NXT5 · Jinx").props.value).toBe("adc");
    expect(select(renderer, "Profil NXT5 · Jinx").findAllByType("option").map(text).join(" ")).not.toContain("Autre joueur");
    expect(renderer.root.findAllByType(SelectInput).some((node) => node.props.label === "Profil NXT5 · Ashe")).toBe(false);
    await filter(renderer, "Poste · Jinx", "SUP");
    await filter(renderer, "Profil NXT5 · Jinx", "support");
    await filter(renderer, "Poste · Ashe", "MID");
    await search(renderer, "introuvable");
    expect(select(renderer, "Poste · Jinx").props.value).toBe("SUP");
    expect(select(renderer, "Profil NXT5 · Jinx").props.value).toBe("support");
    await click(renderer, "Annuler");
    await click(renderer, "Postes");
    expect(select(renderer, "Poste · Jinx").props.value).toBe("ADC");
    expect(select(renderer, "Profil NXT5 · Jinx").props.value).toBe("adc");
    expect(select(renderer, "Poste · Ashe").props.value).toBe("ADC");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends allied player links and both teams' corrected roles in one request", async () => {
    const props = settings();
    const renderer = await render(props);
    await pick(renderer);
    await click(renderer, "Postes");
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
    expect(button(renderer, "Postes")).toBeTruthy();
    expect(button(renderer, "Annuler")).toBeUndefined();
  });

  it("retains corrected role assignments after a failed save and allows retry", async () => {
    const props = settings();
    apiFetch.mockRejectedValueOnce(new Error("Assignation indisponible"));
    const renderer = await render(props);
    await pick(renderer);
    await click(renderer, "Postes");
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
    expect(button(renderer, "Postes")).toBeTruthy();
  });

  it("honors cancellation then confirms deletion of the selected import", async () => {
    const props = settings();
    const renderer = await render(props);
    await pick(renderer);
    await click(renderer, "Supprimer");
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Aurora 01"));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(activeId(renderer)).toBe("team-game-1");
    window.confirm.mockReturnValueOnce(true);
    await click(renderer, "Supprimer");
    expect(payload()).toEqual({ endpoint: "matches-manage", method: "POST", body: { action: "delete", teamId: "team", matchId: "team-game-1" } });
    expect(props.refreshAll).toHaveBeenCalledTimes(1);
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "green" }));
  });

  it("keeps a game selected when deletion fails", async () => {
    const props = settings();
    const renderer = await render(props);
    await pick(renderer);
    window.confirm.mockReturnValueOnce(true);
    apiFetch.mockRejectedValueOnce(new Error("Suppression refusée"));
    await click(renderer, "Supprimer");
    expect(activeId(renderer)).toBe("team-game-1");
    expect(button(renderer, "Supprimer").props.disabled).toBe(false);
    expect(props.refreshAll).not.toHaveBeenCalled();
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "red", text: "Suppression refusée" }));
  });
});

describe("import history category permissions", () => {
  it.each([
    ["player", "member", false],
    ["coach", "coach", true],
    ["player", "owner", true],
  ])("exposes category management according to role %s and account %s", async (role, userId, allowed) => {
    const renderer = await render(settings({ currentMember: { role }, user: { id: userId } }));
    expect(Boolean(button(renderer, "Gérer les catégories"))).toBe(allowed);
    expect(select(renderer, "Catégorie")).toBeTruthy();
    expect(button(renderer, "Ajouter une catégorie")).toBeUndefined();
    if (allowed) {
      await click(renderer, "Gérer les catégories");
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
    await click(renderer, "Gérer les catégories");
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
    await click(renderer, "Gérer les catégories");
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
