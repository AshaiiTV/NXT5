import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import OpponentsWorkspace from "../components/opponents/OpponentsWorkspace.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../pages/workspace/workspace-shared.jsx", () => ({
  ChampionPortrait: ({ champion }) => <img alt={champion} />,
  championDisplayName: (champion) => champion,
}));

const opponents = [
  { id: "zephyr", name: "Zéphyr" },
  { id: "aegis", name: "Aegis" },
  { id: "eclipse", name: "Éclipse" },
];
const picks = ["Gnar", "Viego", "Orianna", "Jinx", "Nami"];
const otherPicks = ["Ornn", "LeeSin", "Ahri", "Lucian", "Braum"];
const game = (id, opponentId, date, extra = {}) => ({
  id, gameId: `EUW1_${id}`, opponentId, date, label: `Partie ${id}`,
  result: "Victoire", enemyPicks: picks, enemyPicksComplete: true, ...extra,
});
const games = [
  game("z1", "zephyr", "2026-10-02T18:00:00Z"),
  game("z2", "zephyr", "2026-10-03T18:00:00Z"),
  game("z3", "zephyr", "2026-10-04T18:00:00Z"),
  game("a1", "aegis", "2026-10-20T18:00:00Z"),
  game("a2", "aegis", "2026-10-21T18:00:00Z", { result: "Défaite", enemyPicks: otherPicks }),
  game("e1", "eclipse", "2026-10-10T18:00:00Z"),
];
const collection = (extra = {}) => ({ opponents, opponentMatches: games, opponentGroups: [], drafts: [], canEdit: false, ...extra });
let renderer;
let props;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.resetAllMocks();
});

function content(node) { return node.children.map((child) => typeof child === "string" ? child : content(child)).join(""); }
function button(label) { return renderer.root.findAllByType("button").find((node) => node.props["aria-label"] === label || content(node) === label); }
function directoryButtons() { return renderer.root.findAllByProps({ className: "opponent-directory-card" }); }
function dossierName() { return content(renderer.root.findByProps({ className: "opponent-dossier-heading" }).findByType("h2")); }
function field(label) {
  const wrapper = renderer.root.findAllByType("label").find((node) => node.findAllByType("span").some((span) => content(span) === label));
  return wrapper.find((node) => ["input", "select"].includes(node.type));
}
function change(label, value) { act(() => field(label).props.onChange({ target: { value } })); }
async function click(label) { await act(async () => button(label).props.onClick()); }
function tab(label) { return renderer.root.findAllByProps({ role: "tab" }).find((node) => node.findAllByType("span").some((span) => content(span) === label)); }
async function selectTab(label) { await act(async () => tab(label).props.onClick()); }
function history() { return renderer.root.findAllByType("section").find((node) => node.props.className?.split(" ").includes("opponent-history")); }
function historyMatchIds() {
  return history().findAllByType("a").map((node) => node.props.href).filter((href) => href?.startsWith("/games?match="))
    .map((href) => new URL(href, "https://nxt5.test").searchParams.get("match"));
}
function frequency(title) { return renderer.root.findAllByProps({ className: "opponents-frequency" }).find((node) => content(node).startsWith(title)); }
function championButton(title, champion) { return frequency(title).findAllByType("button").find((node) => node.props["aria-label"] === `Voir les parties avec ${champion}`); }
async function chooseChampion(title, champion) { await act(async () => championButton(title, champion).props.onClick()); }
async function mount(result = collection(), overrides = {}, renderOptions) {
  apiFetch.mockResolvedValue(result);
  props = { selectedTeamId: "team-1", user: { id: "player-1" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<OpponentsWorkspace {...props} />, renderOptions); });
}
async function update(overrides) {
  props = { ...props, ...overrides };
  await act(async () => renderer.update(<OpponentsWorkspace {...props} />));
}

describe("opponent scouting shortcuts", () => {
  it("opens the mobile directory on demand and closes it when choosing an opponent", async () => {
    await mount();
    const picker = () => renderer.root.findAllByType("button").find((node) => node.props["aria-controls"] && content(node).startsWith("Équipes adversaires"));
    expect(picker().props["aria-expanded"]).toBe(false);
    expect(renderer.root.findAllByType("div").some((node) => node.props.id === picker().props["aria-controls"])).toBe(true);
    await act(async () => picker().props.onClick());
    expect(picker().props["aria-expanded"]).toBe(true);
    await click("Zéphyr");
    expect(dossierName()).toBe("Zéphyr");
    expect(picker().props["aria-expanded"]).toBe(false);
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("opens the most recent opponent and keeps the selected dossier while sorting", async () => {
    await mount();
    expect(directoryButtons().map((node) => node.props["aria-label"])).toEqual(["Aegis", "Éclipse", "Zéphyr"]);
    expect(dossierName()).toBe("Aegis");
    change("Tri des équipes", "games");
    expect(directoryButtons().map((node) => node.props["aria-label"])).toEqual(["Zéphyr", "Aegis", "Éclipse"]);
    expect(dossierName()).toBe("Aegis");
    change("Tri des équipes", "name");
    expect(directoryButtons().map((node) => node.props["aria-label"])).toEqual(["Aegis", "Éclipse", "Zéphyr"]);
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("chooses alphabetically without dated games but preserves an explicit opponent route", async () => {
    await mount(collection({ opponentMatches: [] }), { opponentId: "zephyr" });
    expect(dossierName()).toBe("Zéphyr");
    await update({ opponentId: "eclipse" });
    expect(dossierName()).toBe("Éclipse");
    act(() => renderer.unmount()); renderer = undefined;
    await mount(collection({ opponentMatches: [] }));
    expect(dossierName()).toBe("Aegis");
    expect(content(renderer.root)).toContain("Aucune partie rattachée");
  });

  it("does not reopen a dossier after returning to all teams and refreshing", async () => {
    await mount();
    expect(dossierName()).toBe("Aegis");
    await click("Toutes les équipes");
    expect(renderer.root.findAllByProps({ className: "opponent-dossier-heading" })).toHaveLength(0);
    await update({ refreshRevision: 1 });
    expect(renderer.root.findAllByProps({ className: "opponent-dossier-heading" })).toHaveLength(0);
    expect(directoryButtons()).toHaveLength(3);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("searches names without losing the selected dossier or fetching again", async () => {
    await mount();
    change("Rechercher une équipe", "zep");
    expect(directoryButtons().map((node) => node.props["aria-label"])).toEqual(["Zéphyr"]);
    expect(dossierName()).toBe("Aegis");
    change("Rechercher une équipe", "équipe inexistante");
    expect(directoryButtons()).toHaveLength(0);
    expect(dossierName()).toBe("Aegis");
    await click("Effacer la recherche");
    expect(directoryButtons()).toHaveLength(3);
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("opens the games tab filtered by a played champion and describes its frequency", async () => {
    await mount();
    const countId = championButton("Leurs champions joués", "Jinx").props["aria-describedby"];
    expect(countId).toBeTruthy();
    expect(content(renderer.root.findByProps({ id: countId }))).toBe("1 / 2");
    await chooseChampion("Leurs champions joués", "Jinx");
    expect(tab("Parties").props["aria-selected"]).toBe(true);
    expect(historyMatchIds()).toEqual(["a1"]);
    await click("Tous les champions");
    expect(historyMatchIds()).toEqual(["a2", "a1"]);
    await selectTab("Vue d’ensemble");
    await chooseChampion("Leurs champions joués", "Lucian");
    expect(historyMatchIds()).toEqual(["a2"]);
    await click("Zéphyr"); await selectTab("Parties");
    expect(historyMatchIds()).toEqual(["z3", "z2", "z1"]);
    expect(button("Tous les champions")).toBeUndefined();
  });

  it("returns focus to the history heading after clearing a champion filter", async () => {
    const focus = vi.fn(), scrollIntoView = vi.fn();
    await mount(collection(), {}, { createNodeMock: (node) => node.type === "h3" ? { focus, scrollIntoView } : null });
    await chooseChampion("Leurs champions joués", "Jinx");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockClear();
    await click("Tous les champions");
    expect(button("Tous les champions")).toBeUndefined();
    expect(historyMatchIds()).toEqual(["a2", "a1"]);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("preserves a champion filter across a background refresh without taking focus", async () => {
    const focus = vi.fn(), scrollIntoView = vi.fn();
    await mount(collection(), {}, { createNodeMock: () => ({ focus, scrollIntoView }) });
    await chooseChampion("Leurs champions joués", "Jinx");
    focus.mockClear(); scrollIntoView.mockClear();
    apiFetch.mockResolvedValueOnce(collection({ opponentMatches: [...games, game("a3", "aegis", "2026-10-22T18:00:00Z", { enemyPicks: otherPicks })] }));
    await update({ refreshRevision: 1 });
    expect(tab("Parties").props["aria-selected"]).toBe(true);
    expect(historyMatchIds()).toEqual(["a1"]);
    expect(button("Tous les champions")).toBeDefined();
    expect(focus).not.toHaveBeenCalled(); expect(scrollIntoView).not.toHaveBeenCalled();
    await click("Tous les champions");
    expect(historyMatchIds()).toEqual(["a3", "a2", "a1"]);
  });

  it("combines the champion filter with the existing result filter and pagination", async () => {
    const matches = Array.from({ length: 24 }, (_, index) => game(`series-${index}`, "aegis", `2026-10-${String(index + 1).padStart(2, "0")}T18:00:00Z`, { result: index % 2 ? "Défaite" : "Victoire" }));
    await mount(collection({ opponentMatches: matches }));
    await chooseChampion("Leurs champions joués", "Jinx");
    expect(historyMatchIds()).toHaveLength(10);
    await click("Afficher plus de parties");
    expect(historyMatchIds()).toHaveLength(20);
    change("Résultat de notre équipe", "0");
    expect(historyMatchIds()).toHaveLength(10);
    await click("Afficher plus de parties");
    expect(historyMatchIds()).toHaveLength(12);
    await click("Tous les champions");
    expect(field("Résultat de notre équipe").props.value).toBe("0");
    expect(historyMatchIds().every((id) => Number(id.split("-")[1]) % 2 === 1)).toBe(true);
  });

  it("keeps draft fallback and played champions separate and never filters by a ban", async () => {
    const draftGame = game("a3", "aegis", "2026-10-22T18:00:00Z", { enemyPicks: ["Jinx"], enemyPicksComplete: false });
    const draft = { id: "draft", matchId: "a3", opponentId: "aegis", allySide: "blue", snapshot: {
      source: "drafter.lol", sourceId: "series01", gameNumber: 1, status: "completed",
      redPicks: ["Kennen", "Maokai", "Anivia", "Yunara", "Jinx"],
      redBans: ["Zed", "Lux", "Poppy", "Thresh", "Diana"],
    } };
    await mount(collection({ opponentMatches: [...games, draftGame], drafts: [draft] }));
    expect(button("Voir les parties avec Zed")).toBeUndefined();
    await chooseChampion("Leurs champions joués", "Jinx");
    expect(historyMatchIds()).toEqual(["a1"]);
    await selectTab("Vue d’ensemble");
    await chooseChampion("Picks de draft en complément", "Jinx");
    expect(historyMatchIds()).toEqual(["a3"]);
    expect(content(history())).toContain("Picks de la draft liée");
    expect(content(history())).toContain("champions joués non confirmés");
  });

  it("resets scouting search and champion selection after changing the active team", async () => {
    await mount();
    change("Rechercher une équipe", "aeg");
    await chooseChampion("Leurs champions joués", "Jinx");
    apiFetch.mockResolvedValueOnce(collection({ opponents: [opponents[0]], opponentMatches: [games[0]], drafts: [] }));
    await update({ selectedTeamId: "team-2" });
    expect(field("Rechercher une équipe").props.value).toBe("");
    expect(dossierName()).toBe("Zéphyr");
    await selectTab("Parties");
    expect(historyMatchIds()).toEqual(["z1"]);
    expect(button("Tous les champions")).toBeUndefined();
    expect(content(renderer.root)).not.toContain("Partie a1");
    expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toMatchObject({ action: "list", teamId: "team-2" });
  });
});
