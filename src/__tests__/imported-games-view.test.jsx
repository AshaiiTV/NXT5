import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { ImportedGames } from "../components/games/ImportedGames.jsx";
import { SelectInput } from "../components/ui/Core.jsx";
import { Statistics } from "../pages/workspace/GameWorkspace.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/.netlify/functions" }));

const cleanups = [];
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/statistiques"), addEventListener: vi.fn(), removeEventListener: vi.fn(), scrollTo: vi.fn() });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

const categories = [{ id: "scrim", team_id: "team", name: "Scrim" }, { id: "empty", team_id: "team", name: "Tournoi" }];
function games(count = 30) {
  return Array.from({ length: count }, (_, index) => ({
    id: `game-${index + 1}`,
    team_id: "team",
    game_id: `EUW1_${index + 1}`,
    raw: { nxt5Label: `Club ${String(index + 1).padStart(2, "0")}` },
    game_date: new Date(Date.UTC(2026, 7, index + 1, 12)).toISOString(),
    duration_seconds: 1200 + index * 10,
    result: index % 2 ? "Défaite" : "Victoire",
    review_status: index % 2 ? "done" : "todo",
    side: index % 2 ? "red" : "blue",
    category_ids: ["scrim"],
    participants: [],
  }));
}
function listProps(overrides = {}) {
  return {
    matches: games(), categories, selectedMatchId: "", selectedMatch: null, selectedReport: null,
    onSelectMatch: vi.fn(), onCreateReview: vi.fn(), onOpenReview: vi.fn(), onViewStats: vi.fn(),
    onResetScope: vi.fn(), ...overrides,
  };
}
async function render(element, options) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<Suspense fallback="loading">{element}</Suspense>, options); });
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
function rowLabels(renderer) {
  return rows(renderer).map((node) => node.props["aria-label"]);
}
async function click(renderer, label) {
  const target = button(renderer, label);
  expect(target, `Button ${label}`).toBeTruthy();
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

describe("imported games interactions", () => {
  it("paginates ten games at a time and moves keyboard focus to the results", async () => {
    const resultsNode = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const renderer = await render(<ImportedGames {...listProps({ matches: games(23) })} />, {
      createNodeMock: (element) => element.props.className === "ig-results" ? resultsNode : null,
    });
    expect(rows(renderer)).toHaveLength(10);
    expect(rowLabels(renderer)[0]).toContain("EUW1_23");
    expect(button(renderer, "Page précédente").props.disabled).toBe(true);
    await click(renderer, "Page suivante");
    expect(rows(renderer)).toHaveLength(10);
    expect(rowLabels(renderer)[0]).toContain("EUW1_13");
    expect(text(renderer.root.findByProps({ "aria-label": "Pagination des parties" }))).toContain("Page 2 / 3");
    expect(resultsNode.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(resultsNode.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    await click(renderer, "Page suivante");
    expect(rows(renderer)).toHaveLength(3);
    expect(rowLabels(renderer)[0]).toContain("EUW1_3");
    expect(button(renderer, "Page suivante").props.disabled).toBe(true);
    await click(renderer, "Page précédente");
    expect(rowLabels(renderer)[0]).toContain("EUW1_13");
  });

  it.each([
    ["search", async (renderer) => search(renderer, "Club"), "EUW1_30", 30],
    ["result", async (renderer) => filter(renderer, "Résultat", "Victoire"), "EUW1_29", 15],
    ["review", async (renderer) => filter(renderer, "Débrief", "done"), "EUW1_30", 15],
    ["side", async (renderer) => filter(renderer, "Côté", "blue"), "EUW1_29", 15],
    ["sort", async (renderer) => filter(renderer, "Trier par", "oldest"), "EUW1_1", 30],
  ])("returns to page one after changing %s", async (_name, change, firstGame, resultCount) => {
    const renderer = await render(<ImportedGames {...listProps()} />);
    await click(renderer, "Page suivante");
    await change(renderer);
    expect(rows(renderer)).toHaveLength(10);
    expect(rowLabels(renderer)[0]).toMatch(new RegExp(`${firstGame}$`));
    expect(button(renderer, "Page précédente").props.disabled).toBe(true);
    expect(text(renderer.root.findByProps({ role: "status" }))).toContain(`${resultCount} parties`);
  });

  it("resets the page when changing the page size", async () => {
    const renderer = await render(<ImportedGames {...listProps()} />);
    await click(renderer, "Page suivante");
    const pageSize = renderer.root.findByProps({ className: "ig-page-size" }).findByType("select");
    await act(async () => pageSize.props.onChange({ target: { value: "25" } }));
    expect(rows(renderer)).toHaveLength(25);
    expect(rowLabels(renderer)[0]).toContain("EUW1_30");
    expect(button(renderer, "Page précédente").props.disabled).toBe(true);
  });

  it("recovers from no results while retaining the chosen sort and page size", async () => {
    const renderer = await render(<ImportedGames {...listProps()} />);
    await filter(renderer, "Trier par", "oldest");
    await act(async () => renderer.root.findByProps({ className: "ig-page-size" }).findByType("select").props.onChange({ target: { value: "25" } }));
    await filter(renderer, "Résultat", "Victoire");
    await search(renderer, "introuvable");
    expect(rows(renderer)).toHaveLength(0);
    expect(text(renderer.root.findByProps({ className: "ig-empty" }))).toContain("Aucune partie ne correspond");
    expect(button(renderer, "Page suivante")).toBeUndefined();
    const reset = renderer.root.findByProps({ className: "ig-empty" }).findByType("button");
    await act(async () => reset.props.onClick());
    expect(renderer.root.findByProps({ type: "search" }).props.value).toBe("");
    expect(select(renderer, "Résultat").props.value).toBe("");
    expect(select(renderer, "Trier par").props.value).toBe("oldest");
    expect(rows(renderer)).toHaveLength(25);
    expect(rowLabels(renderer)[0]).toMatch(/EUW1_1$/);
  });

  it("keeps a hidden selection and reveals its page after clearing the filters", async () => {
    const matches = games();
    const selected = matches[2];
    const settings = listProps({ matches, selectedMatchId: selected.id, selectedMatch: selected });
    const renderer = await render(<ImportedGames {...settings} />);
    await filter(renderer, "Résultat", "Défaite");
    await search(renderer, "Club 30");
    expect(rows(renderer)).toHaveLength(1);
    expect(text(renderer.root.findByProps({ className: "ig-selection" }))).toContain("Club 03");
    expect(settings.onSelectMatch).not.toHaveBeenCalled();
    await click(renderer, "Afficher dans la liste");
    expect(renderer.root.findByProps({ type: "search" }).props.value).toBe("");
    expect(select(renderer, "Résultat").props.value).toBe("");
    expect(text(renderer.root.findByProps({ "aria-label": "Pagination des parties" }))).toContain("Page 3 / 3");
    const active = rows(renderer).filter((node) => node.props["aria-pressed"]);
    expect(active).toHaveLength(1);
    expect(active[0].props["aria-label"]).toContain("EUW1_3");
    expect(button(renderer, "Afficher dans la liste")).toBeUndefined();
    expect(settings.onSelectMatch).not.toHaveBeenCalled();
  });

  it("keeps an out-of-scope direct selection accessible without offering an impossible reveal", async () => {
    const selected = { ...games(1)[0], id: "outside" };
    const renderer = await render(<ImportedGames {...listProps({ selectedMatchId: selected.id, selectedMatch: selected })} />);
    expect(text(renderer.root.findByProps({ className: "ig-selection" }))).toContain("hors des résultats affichés");
    expect(button(renderer, "Afficher dans la liste")).toBeUndefined();
    expect(button(renderer, "Voir le bilan")).toBeTruthy();
    expect(button(renderer, "Créer un débrief")).toBeTruthy();
  });

  it("calls selection, deselection, stats and review creation actions", async () => {
    const selected = games(1)[0];
    const settings = listProps({ matches: [selected], selectedMatchId: selected.id, selectedMatch: selected });
    const renderer = await render(<ImportedGames {...settings} />);
    await click(renderer, "Voir le bilan");
    await click(renderer, "Créer un débrief");
    expect(settings.onViewStats).toHaveBeenCalledTimes(1);
    expect(settings.onCreateReview).toHaveBeenCalledTimes(1);
    expect(settings.onOpenReview).not.toHaveBeenCalled();
    await act(async () => rows(renderer)[0].props.onClick());
    expect(settings.onSelectMatch).toHaveBeenLastCalledWith("");
    await click(renderer, "Désélectionner la partie");
    expect(settings.onSelectMatch).toHaveBeenCalledTimes(2);
    await act(async () => renderer.update(<ImportedGames {...settings} selectedMatchId="" selectedMatch={null} />));
    await act(async () => rows(renderer)[0].props.onClick());
    expect(settings.onSelectMatch).toHaveBeenLastCalledWith(selected.id);
  });

  it("opens a linked review and still permits creating another one", async () => {
    const selected = games(1)[0];
    const settings = listProps({ matches: [selected], selectedMatchId: selected.id, selectedMatch: selected, selectedReport: { id: "report" } });
    const renderer = await render(<ImportedGames {...settings} />);
    expect(button(renderer, "Créer un débrief")).toBeUndefined();
    await click(renderer, "Ouvrir le débrief");
    await click(renderer, "Nouveau débrief");
    expect(settings.onOpenReview).toHaveBeenCalledTimes(1);
    expect(settings.onCreateReview).toHaveBeenCalledTimes(1);
  });

  it("clears the search with Escape and returns focus to its input", async () => {
    const inputNode = { focus: vi.fn() };
    const renderer = await render(<ImportedGames {...listProps()} />, { createNodeMock: (element) => element.type === "input" ? inputNode : null });
    await search(renderer, "introuvable");
    await act(async () => renderer.root.findByProps({ type: "search" }).props.onKeyDown({ key: "Escape" }));
    expect(renderer.root.findByProps({ type: "search" }).props.value).toBe("");
    expect(rows(renderer)).toHaveLength(10);
    expect(inputNode.focus).toHaveBeenCalledTimes(1);
  });

  it("offers a return to all games for an empty category", async () => {
    const settings = listProps({ matches: [], scopeName: "Tournoi" });
    const renderer = await render(<ImportedGames {...settings} />);
    expect(text(renderer.root.findByProps({ className: "ig-empty" }))).toContain("Aucune partie dans cette sélection");
    await click(renderer, "Voir toutes les parties");
    expect(settings.onResetScope).toHaveBeenCalledTimes(1);
  });
});

describe("progressive imported games", () => {
  async function update(renderer, props) {
    await act(async () => renderer.update(<Suspense fallback="loading"><ImportedGames {...props} /></Suspense>));
  }

  function progressiveProps(overrides = {}) {
    return listProps({
      matches: games(100).map((match, index) => ({ ...match, imported_at: new Date(Date.UTC(2026, 8, 30, 12, -index)).toISOString() })),
      historyComplete: false, totalMatches: 1000, allowImportSort: true, showCategoryFilter: true,
      onLoadMore: vi.fn().mockResolvedValue(undefined), onLoadHistory: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    });
  }

  it("opens the latest imported page without requesting the remaining history", async () => {
    const settings = progressiveProps();
    const renderer = await render(<ImportedGames {...settings} />);
    expect(select(renderer, "Trier par").props.value).toBe("import-newest");
    expect(rowLabels(renderer)[0]).toContain("EUW1_1");
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("100 parties chargées sur 1000");
    expect(text(renderer.root.findByProps({ className: "ig-total" }))).toBe("1000 parties");
    expect(settings.onLoadMore).not.toHaveBeenCalled();
    expect(settings.onLoadHistory).not.toHaveBeenCalled();
    await click(renderer, "Page suivante");
    expect(settings.onLoadMore).not.toHaveBeenCalled();
    expect(settings.onLoadHistory).not.toHaveBeenCalled();
  });

  it("requests one more server page explicitly and preserves the loaded list while loading", async () => {
    const settings = progressiveProps();
    const renderer = await render(<ImportedGames {...settings} />);
    await click(renderer, "Charger la suite");
    expect(settings.onLoadMore).toHaveBeenCalledExactlyOnceWith();
    expect(settings.onLoadHistory).not.toHaveBeenCalled();
    await update(renderer, { ...settings, historyLoading: true });
    expect(rows(renderer)).toHaveLength(10);
    expect(button(renderer, "Chargement…").props.disabled).toBe(true);
    await update(renderer, { ...settings, matches: games(200) });
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("200 parties chargées sur 1000");
    expect(button(renderer, "Charger la suite").props.disabled).toBe(false);
  });

  it.each([
    ["search", (renderer) => search(renderer, "Club")],
    ["result", (renderer) => filter(renderer, "Résultat", "Victoire")],
    ["review", (renderer) => filter(renderer, "Débrief", "done")],
    ["side", (renderer) => filter(renderer, "Côté", "blue")],
    ["category", (renderer) => filter(renderer, "Catégorie", "scrim")],
    ["played date sort", (renderer) => filter(renderer, "Trier par", "newest")],
    ["oldest import sort", (renderer) => filter(renderer, "Trier par", "import-oldest")],
  ])("requests full history for %s and withholds partial global results", async (_label, change) => {
    const settings = progressiveProps();
    const renderer = await render(<ImportedGames {...settings} />);
    await change(renderer);
    expect(settings.onLoadHistory).toHaveBeenCalledExactlyOnceWith();
    expect(settings.onLoadMore).not.toHaveBeenCalled();
    expect(rows(renderer)).toHaveLength(0);
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("100 parties chargées sur 1000");
    expect(text(renderer.root)).not.toContain("Aucune partie ne correspond");
    expect(text(renderer.root)).not.toContain("parties disponibles");
    expect(button(renderer, "Charger la suite")).toBeUndefined();
    await update(renderer, { ...settings, historyLoading: true });
    expect(text(renderer.root.findByProps({ role: "status" }))).toContain("Chargement de l’historique");
    expect(renderer.root.findByProps({ "aria-label": "Liste des parties" }).props["aria-busy"]).toBe(true);
    expect(renderer.root.findByProps({ type: "search" }).props.disabled).not.toBe(true);
  });

  it("keeps the query until full history resolves and then includes an older matching game", async () => {
    const settings = progressiveProps();
    const renderer = await render(<ImportedGames {...settings} />);
    await search(renderer, "Ancienne partie");
    expect(rows(renderer)).toHaveLength(0);
    const older = { ...games(1)[0], id: "older", game_id: "EUW1_OLDER", raw: { nxt5Label: "Ancienne partie" } };
    await update(renderer, { ...settings, matches: [...settings.matches, older], historyComplete: true });
    expect(renderer.root.findByProps({ type: "search" }).props.value).toBe("Ancienne partie");
    expect(rows(renderer)).toHaveLength(1);
    expect(rowLabels(renderer)[0]).toContain("EUW1_OLDER");
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("1 partie sur 101");
    expect(button(renderer, "Charger la suite")).toBeUndefined();
  });

  it("lets the user clear filters while full history loads and immediately revisit loaded games", async () => {
    const settings = progressiveProps();
    const renderer = await render(<ImportedGames {...settings} />);
    await filter(renderer, "Résultat", "Victoire");
    await update(renderer, { ...settings, historyLoading: true });
    await click(renderer, "Réinitialiser les filtres");
    expect(select(renderer, "Résultat").props.value).toBe("");
    expect(rows(renderer)).toHaveLength(10);
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("100 parties chargées sur 1000");
    expect(settings.onLoadHistory).toHaveBeenCalledTimes(1);
  });

  it("retains the loaded list and retries a failed next page", async () => {
    const settings = progressiveProps({ historyError: "L’historique complet n’a pas pu être chargé." });
    const renderer = await render(<ImportedGames {...settings} />);
    expect(rows(renderer)).toHaveLength(10);
    expect(text(renderer.root.findByProps({ role: "alert" }))).toContain("n’a pas pu être chargé");
    await click(renderer, "Réessayer");
    expect(settings.onLoadMore).toHaveBeenCalledExactlyOnceWith();
    expect(settings.onLoadHistory).not.toHaveBeenCalled();
  });

  it("keeps failed global filters usable and retries the complete history", async () => {
    const settings = progressiveProps();
    const renderer = await render(<ImportedGames {...settings} />);
    await filter(renderer, "Trier par", "oldest");
    await update(renderer, { ...settings, historyError: "L’historique complet n’a pas pu être chargé." });
    expect(rows(renderer)).toHaveLength(0);
    expect(select(renderer, "Trier par").props.value).toBe("oldest");
    expect(text(renderer.root)).not.toContain("Aucune partie ne correspond");
    await click(renderer, "Réessayer");
    expect(settings.onLoadHistory).toHaveBeenCalledTimes(2);
    expect(settings.onLoadMore).not.toHaveBeenCalled();
  });

  it("shows loaded coverage without inventing a total or a complete empty state", async () => {
    const renderer = await render(<ImportedGames {...progressiveProps({ matches: [], totalMatches: undefined })} />);
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("0 parties chargées");
    expect(text(renderer.root)).not.toContain("Aucune partie");
    expect(button(renderer, "Charger la suite")).toBeTruthy();
  });

  it("offers an explicit recovery when a complete list becomes partial with its played-date sort retained", async () => {
    const settings = progressiveProps({ historyComplete: true });
    const renderer = await render(<ImportedGames {...settings} />);
    expect(select(renderer, "Trier par").props.value).toBe("newest");
    await update(renderer, { ...settings, historyComplete: false });
    expect(rows(renderer)).toHaveLength(0);
    expect(settings.onLoadHistory).not.toHaveBeenCalled();
    expect(button(renderer, "Charger la suite")).toBeUndefined();
    await click(renderer, "Charger l’historique complet");
    expect(settings.onLoadHistory).toHaveBeenCalledExactlyOnceWith();
  });

  it("forwards a full-history demand while a manual page request is already loading", async () => {
    const settings = progressiveProps({ historyLoading: true });
    const renderer = await render(<ImportedGames {...settings} />);
    await filter(renderer, "Résultat", "Victoire");
    expect(settings.onLoadHistory).toHaveBeenCalledExactlyOnceWith();
    expect(rows(renderer)).toHaveLength(0);
    expect(button(renderer, "Charger l’historique complet")).toBeUndefined();
    await update(renderer, { ...settings, historyLoading: false });
    expect(button(renderer, "Charger l’historique complet")).toBeTruthy();
    expect(text(renderer.root)).not.toContain("Aucune partie ne correspond");
  });
});

describe("imported games in Statistics", () => {
  beforeEach(() => {
    window.history = { pushState: vi.fn((_state, _title, path) => { window.location = new URL(path, window.location); }) };
    window.dispatchEvent = vi.fn();
    apiFetch.mockImplementation(async (endpoint, options) => {
      if (endpoint === "opponents-drafts" && JSON.parse(options.body).action === "list-opponents") return { opponents: [] };
      throw new Error(`Unexpected request: ${endpoint}`);
    });
  });
  function statisticsProps(matches = games(3)) {
    return {
      data: { ...DEFAULT_DATA, teams: [{ id: "team", name: "Équipe" }], matches, matchCategories: categories },
      selectedTeamId: "team", refreshAll: vi.fn(), pushToast: vi.fn(),
    };
  }
  function visible(node) {
    for (let ancestor = node; ancestor; ancestor = ancestor.parent) if (ancestor.props.hidden) return false;
    return true;
  }

  it("opens stats directly, hides the list and restores its search and filters on return", async () => {
    const settings = statisticsProps();
    const selected = settings.data.matches[2];
    apiFetch.mockImplementation(async (endpoint, options) => {
      if (endpoint === "match-details") return { matches: [selected] };
      if (endpoint === "opponents-drafts" && JSON.parse(options.body).action === "list-opponents") return { opponents: [] };
      if (endpoint === "opponents-drafts" && JSON.parse(options.body).action === "get-match-draft") return { draft: null, canEdit: false };
      if (endpoint === "opponents-drafts" && JSON.parse(options.body).action === "get-match-opponent") return { opponentId: null, opponents: [], canEdit: false };
      throw new Error(`Unexpected request: ${endpoint}`);
    });
    const renderer = await render(<Statistics {...settings} />);
    await search(renderer, "Club 03");
    await filter(renderer, "Résultat", "Victoire");
    await filter(renderer, "Catégorie", "scrim");
    await filter(renderer, "Trier par", "oldest");
    expect(rows(renderer)).toHaveLength(1);
    await act(async () => rows(renderer)[0].props.onClick());
    expect(window.location.pathname).toBe("/games");
    expect(window.location.search).toBe(`?match=${selected.id}`);
    expect(renderer.root.findByType(ImportedGames).props.selectedMatchId).toBe(selected.id);
    expect(visible(renderer.root.findByProps({ id: "selected-game-stats" }))).toBe(true);
    expect(visible(renderer.root.findByProps({ type: "search" }))).toBe(false);
    expect(rows(renderer).filter(visible)).toHaveLength(0);
    const byAction = (left, right) => (left.payload.action || left.endpoint).localeCompare(right.payload.action || right.endpoint);
    const requests = () => apiFetch.mock.calls.map(([endpoint, options]) => ({ endpoint, method: options.method, payload: JSON.parse(options.body) }))
      .filter(({ endpoint, payload }) => endpoint === "match-details" || (endpoint === "opponents-drafts" && ["get-match-draft", "get-match-opponent"].includes(payload.action))).sort(byAction);
    const expectedRequests = [
      { endpoint: "match-details", method: "POST", payload: { teamId: "team", matchIds: [selected.id] } },
      { endpoint: "opponents-drafts", method: "POST", payload: { action: "get-match-draft", teamId: "team", matchId: selected.id } },
      { endpoint: "opponents-drafts", method: "POST", payload: { action: "get-match-opponent", teamId: "team", matchId: selected.id } },
    ].sort(byAction);
    expect(requests()).toEqual(expectedRequests);
    await click(renderer, "Retour aux parties");
    expect(renderer.root.findAllByProps({ id: "selected-game-stats" })).toHaveLength(0);
    expect(renderer.root.findByProps({ type: "search" }).props.value).toBe("Club 03");
    expect(select(renderer, "Résultat").props.value).toBe("Victoire");
    expect(select(renderer, "Catégorie").props.value).toBe("scrim");
    expect(select(renderer, "Trier par").props.value).toBe("oldest");
    expect(rows(renderer).filter(visible)).toHaveLength(1);
    expect(rowLabels(renderer)[0]).toContain("EUW1_3");
    expect(requests()).toEqual(expectedRequests);
  });

  it("keeps the category filter available with no results and can return to all games", async () => {
    const renderer = await render(<Statistics {...statisticsProps()} />);
    await filter(renderer, "Catégorie", "empty");
    expect(rows(renderer)).toHaveLength(0);
    expect(select(renderer, "Catégorie").props.value).toBe("empty");
    expect(visible(select(renderer, "Catégorie"))).toBe(true);
    expect(text(renderer.root.findByProps({ className: "ig-empty" }))).toContain("Aucune partie ne correspond");
    await act(async () => renderer.root.findByProps({ className: "ig-empty" }).findByType("button").props.onClick());
    expect(select(renderer, "Catégorie").props.value).toBe("");
    expect(rows(renderer)).toHaveLength(3);
    expect(renderer.root.findAllByType(ImportedGames)).toHaveLength(1);
  });
});
