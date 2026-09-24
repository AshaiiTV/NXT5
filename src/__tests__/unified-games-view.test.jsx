import React, { Suspense, useEffect, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { readRoute } from "../app/routing.js";
import { ImportedGames } from "../components/games/ImportedGames.jsx";
import { TabNav } from "../components/ui/Core.jsx";
import { GameWorkspace, MatchDataPanel } from "../pages/workspace/GameWorkspace.jsx";
import { GameActions, ImportGameFlow } from "../pages/workspace/GameOperations.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/.netlify/functions" }));
const cleanups = [];
const game = (id, overrides = {}) => ({
  id, team_id: "team", game_id: `EUW1_${id}`, raw: { nxt5Label: `Game ${id}` },
  result: "Victoire", side: "blue", duration: "20:00", duration_seconds: 1200,
  game_date: "2026-09-08T12:00:00Z", participants: [], ...overrides,
});
const history = [game("one"), game("two", { result: "Défaite" }), game("foreign", { team_id: "other" })];
const details = [...history, game("older"), game("imported")];
const settings = () => ({
  data: {
    ...DEFAULT_DATA,
    teams: [{ id: "team", name: "Équipe", owner_id: "owner" }],
    players: ["TOP", "JGL", "MID", "ADC", "SUP"].map((role) => ({ id: `player-${role}`, team_id: "team", role })),
    matches: history,
    matchArchives: [{ id: "block", team_id: "team", name: "Bloc scrim", description: "Session du matin", match_ids: ["one", "two"] }],
  },
  selectedTeamId: "team", currentMember: { role: "owner" }, user: { id: "owner" },
  refreshAll: vi.fn(), pushToast: vi.fn(),
});

beforeEach(() => {
  const listeners = new Map();
  const browser = {
    location: new URL("https://nxt5.test/games"), scrollTo: vi.fn(), setTimeout, clearTimeout,
    addEventListener: vi.fn((name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); }),
    removeEventListener: vi.fn((name, callback) => listeners.get(name)?.delete(callback)),
    dispatchEvent: vi.fn((event) => { listeners.get(event.type)?.forEach((callback) => callback(event)); return true; }),
  };
  const setUrl = (_state, _title, path) => { browser.location = new URL(path, browser.location); };
  browser.history = { pushState: vi.fn(setUrl), replaceState: vi.fn(setUrl) };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", { activeElement: { focus: vi.fn() }, body: { style: { overflow: "" } } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }));
  apiFetch.mockImplementation(async (endpoint, options) => {
    if (endpoint.startsWith("team-discord-connection?")) return { configured: true, connection: null };
    if (endpoint !== "match-details") throw new Error(`Unexpected request: ${endpoint}`);
    const { matchIds, teamId } = JSON.parse(options.body);
    return { matches: details.filter((match) => matchIds.includes(match.id) && match.team_id === teamId) };
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function RouteHarness({ props }) {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const read = () => setRoute(readRoute());
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  return <GameWorkspace {...props} route={route} />;
}
async function mount(path = "/games", props = settings()) {
  window.location = new URL(path, window.location);
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<Suspense fallback="loading"><RouteHarness props={props} /></Suspense>, {
      createNodeMock: () => ({
        open: false,
        showModal() { this.open = true; },
        close() { this.open = false; },
        focus: vi.fn(), scrollIntoView: vi.fn(), querySelectorAll: () => [],
        querySelector: () => ({ focus: vi.fn() }),
      }),
    });
  });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function visible(node) {
  for (let ancestor = node; ancestor; ancestor = ancestor.parent) if (ancestor.props.hidden) return false;
  return true;
}
function buttons(renderer) { return renderer.root.findAllByType("button").filter(visible); }
function button(renderer, label) { return buttons(renderer).find((node) => node.props["aria-label"] === label || text(node).trim() === label); }
async function click(renderer, label) {
  const target = button(renderer, label);
  expect(target, label).toBeTruthy();
  expect(target.props.disabled).not.toBe(true);
  await act(async () => target.props.onClick());
}
function rows(renderer) { return buttons(renderer).filter((node) => node.props.className === "ig-game"); }
function lists(renderer) { return renderer.root.findAllByProps({ "aria-label": "Liste des parties" }).filter(visible); }
async function browserBack(path) {
  await act(async () => {
    window.location = new URL(path, window.location);
    window.dispatchEvent(new Event("popstate"));
  });
}

describe("unified Games workspace", () => {
  it("takes an owner to the missing players before offering an import", async () => {
    const props = settings();
    props.data.players = props.data.players.slice(0, 4);
    props.data.players.push({ ...props.data.players[0] }, { id: "foreign", team_id: "other", role: "SUP" }, { id: "coach", team_id: "team", role: "COACH" });
    const renderer = await mount("/games", props);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(text(renderer.root)).toContain("Ajoute au moins 5 profils joueurs distincts");
    await click(renderer, "Ajouter les joueurs");
    expect(window.location.pathname).toBe("/gestion-equipe");
    expect(window.location.search).toBe("?section=roster");
  });

  it.each([
    [{ team_id: "team", user_id: "player", role: "player" }],
    [{ team_id: "other", user_id: "player", role: "coach" }],
    [{ team_id: "team", user_id: "someone-else", role: "coach" }],
  ])("explains staff-managed imports to a member without current team permissions", async (currentMember) => {
    const renderer = await mount("/games", { ...settings(), user: { id: "player" }, currentMember });
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(button(renderer, "Ajouter les joueurs")).toBeUndefined();
    expect(text(renderer.root)).toContain("Le capitaine ou le staff peut importer les parties de ton équipe.");
  });

  it("opens an existing linked debrief from the first reading without expanding statistics", async () => {
    const props = settings();
    props.data.reports = [{ id: "report-one", team_id: "team", match_ids: ["one"], title: "Décisions" }];
    const renderer = await mount("/games?match=one", props);
    expect(button(renderer, "Préparer le débrief")).toBeUndefined();
    await click(renderer, "Ouvrir le débrief");
    expect(window.location.pathname).toBe("/rapports");
    expect(window.location.search).toBe("?report=report-one&match=one");
  });

  it.each([
    ["team owner without membership", "owner", null, true],
    ["coach of the selected team", "staff", { team_id: "team", user_id: "staff", role: "coach" }, true],
    ["player", "staff", { team_id: "team", user_id: "staff", role: "player" }, false],
    ["coach of another team", "staff", { team_id: "other", user_id: "staff", role: "coach" }, false],
    ["another user's coach membership", "staff", { team_id: "team", user_id: "someone-else", role: "coach" }, false],
  ])("gates the Discord statistics action for %s", async (_label, userId, currentMember, allowed) => {
    const originalFetch = apiFetch.getMockImplementation();
    apiFetch.mockImplementation(async (endpoint, options) => {
      if (endpoint.startsWith("team-discord-connection?")) return {
        configured: true, enabled: true,
        connection: { guildId: "guild", status: "active", paused: false, configVersion: 1 },
        channels: [{ id: "channel", name: "games", canSend: true }],
      };
      if (endpoint.startsWith("team-discord-routes?")) return {
        guildId: "guild", configVersion: 1,
        routes: [{ id: "route", channelId: "channel", enabled: false }],
      };
      return originalFetch(endpoint, options);
    });
    const renderer = await mount("/games?match=one", { ...settings(), user: { id: userId }, currentMember });
    const publish = button(renderer, "Exporter sur Discord");
    expect(Boolean(publish)).toBe(allowed);
    if (allowed) {
      let ancestor = publish;
      while (ancestor && ancestor.props.className !== "games-detail-actions") ancestor = ancestor.parent;
      expect(ancestor).toBeTruthy();
    } else {
      expect(apiFetch.mock.calls.some(([endpoint]) => endpoint.startsWith("team-discord-"))).toBe(false);
    }
    expect(apiFetch.mock.calls.some(([endpoint]) => endpoint.startsWith("team-discord-preview") || endpoint === "team-discord-publish")).toBe(false);
  });

  it.each(["/games", "/integration", "/statistiques"])("opens a direct legacy game at %s and clears stats when browser history has no query", async (path) => {
    const renderer = await mount(`${path}?match=older&category=scrim`);
    expect(apiFetch).toHaveBeenCalledWith("match-details", expect.objectContaining({ body: JSON.stringify({ teamId: "team", matchIds: ["older"] }) }));
    expect(renderer.root.findByType(MatchDataPanel).props.match.id).toBe("older");
    expect(renderer.root.findAllByType(ImportedGames)).toHaveLength(1);
    expect(lists(renderer)).toHaveLength(0);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(window.location.pathname).toBe(path);
    expect(window.location.search).toBe("?match=older&category=scrim");
    await browserBack(path);
    expect(renderer.root.findAllByType(MatchDataPanel)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ id: "selected-game-stats" })).toHaveLength(0);
    expect(lists(renderer)).toHaveLength(1);
    expect(rows(renderer)).toHaveLength(2);
    expect(button(renderer, "Importer une partie")).toBeTruthy();
  });

  it("keeps one library and opens a clicked game immediately with a canonical URL", async () => {
    const renderer = await mount("/integration?context=scrim");
    expect(renderer.root.findAllByType(ImportedGames)).toHaveLength(1);
    expect(lists(renderer)).toHaveLength(1);
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(rows(renderer)).toHaveLength(2);
    expect(button(renderer, "Importer une partie")).toBeTruthy();
    const selectedId = rows(renderer)[0].props["data-match-id"];
    await act(async () => rows(renderer)[0].props.onClick());
    expect(window.location.pathname).toBe("/games");
    expect(new URLSearchParams(window.location.search).get("context")).toBe("scrim");
    expect(new URLSearchParams(window.location.search).get("match")).toBe(selectedId);
    const statistics = renderer.root.findByType(MatchDataPanel);
    expect(statistics.props.match.id).toBe(selectedId);
    expect(text(statistics)).toContain("L’essentiel de la partie");
    expect(text(statistics)).not.toContain("Vue 5v5");
    const detail = statistics.findAllByType("details").find((node) => text(node.findByType("summary")).startsWith("Statistiques et comparaison"));
    expect(detail.props.open).toBe(false);
    await act(async () => detail.props.onToggle({ currentTarget: { open: true } }));
    const statsText = text(statistics);
    const versusIndex = statsText.indexOf("Vue 5v5");
    const coachIndex = statsText.indexOf("L’essentiel de la partie");
    expect(coachIndex).toBeLessThan(versusIndex);
    for (const metric of ["Éliminations / morts / assistances", "Écart dégâts", "Écart or", "Écart vision"]) {
      expect(statsText.indexOf(metric)).toBeGreaterThan(coachIndex);
      expect(statsText.indexOf(metric)).toBeLessThan(versusIndex);
    }
    expect(button(renderer, "Créer review")).toBeUndefined();
    expect(renderer.root.findAllByType("h3").filter((heading) => text(heading) === `Game ${selectedId}`)).toHaveLength(1);
    expect(lists(renderer)).toHaveLength(0);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(renderer.root.findAllByType(ImportedGames)).toHaveLength(1);
    expect(button(renderer, "Voir le bilan")).toBeUndefined();
    await click(renderer, "Retour aux parties");
    expect(window.location.search).toBe("?context=scrim");
    expect(lists(renderer)).toHaveLength(1);
    expect(button(renderer, "Importer une partie")).toBeTruthy();
    expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === "match-details")).toHaveLength(1);
  });

  it.each([
    ["/games?match=one&import=1", "Retour aux parties", ""],
    ["/games?archive=block&match=one&import=1", "Retour au groupe", "?archive=block"],
  ])("keeps imports closed on a direct game URL %s and available after returning", async (path, returnLabel, returnSearch) => {
    const renderer = await mount(path);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(renderer.root.findByType(MatchDataPanel).props.match.id).toBe("one");
    expect(renderer.root.findAllByType(ImportedGames)).toHaveLength(1);
    await click(renderer, returnLabel);
    expect(window.location.search).toBe(returnSearch);
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(renderer.root.findAllByType(MatchDataPanel)).toHaveLength(0);
    expect(lists(renderer)).toHaveLength(1);
    await click(renderer, "Importer une partie");
    expect(new URLSearchParams(window.location.search).get("import")).toBe("1");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(1);
    await click(renderer, "Fermer la fenêtre");
    expect(window.location.search).toBe(returnSearch);
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
  });

  it("clears an open import when selecting a game so returning does not reopen it", async () => {
    const renderer = await mount("/games?archive=block&context=scrim&import=1");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(1);
    await act(async () => renderer.root.findByType(ImportedGames).props.onSelectMatch("one"));
    expect(new URLSearchParams(window.location.search).get("match")).toBe("one");
    expect(new URLSearchParams(window.location.search).has("import")).toBe(false);
    expect(renderer.root.findByType(MatchDataPanel).props.match.id).toBe("one");
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    await click(renderer, "Retour au groupe");
    expect(window.location.search).toBe("?archive=block&context=scrim");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(button(renderer, "Importer une partie")).toBeTruthy();
  });

  it("does not reopen a stale import after deleting the selected game", async () => {
    const renderer = await mount("/games?archive=block&match=one&import=1");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    await act(async () => renderer.root.findByType(GameActions).props.onDeleted());
    expect(window.location.search).toBe("?archive=block");
    expect(renderer.root.findAllByType(MatchDataPanel)).toHaveLength(0);
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(lists(renderer)).toHaveLength(1);
    expect(button(renderer, "Importer une partie")).toBeTruthy();
  });

  it("opens the imported game directly after the import flow succeeds", async () => {
    const renderer = await mount("/games?archive=block&import=1");
    await act(async () => renderer.root.findByType(ImportGameFlow).props.onImported({ match: { id: "imported" } }));
    expect(window.location.search).toBe("?match=imported");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(renderer.root.findByType(MatchDataPanel).props.match.id).toBe("imported");
    expect(lists(renderer)).toHaveLength(0);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    await click(renderer, "Retour aux parties");
    expect(lists(renderer)).toHaveLength(1);
    expect(button(renderer, "Importer une partie")).toBeTruthy();
  });

  it("opens a group, its game statistics and returns without duplicating the game list", async () => {
    const renderer = await mount("/statistiques?archive=block");
    expect(text(renderer.root)).toContain("Résultats du groupe");
    expect(renderer.root.findAllByType(ImportedGames)).toHaveLength(1);
    expect(lists(renderer)).toHaveLength(1);
    expect(rows(renderer)).toHaveLength(2);
    expect(renderer.root.findAll((node) => typeof node.props.className === "string" && node.props.className.includes("nxt5-game-list"))).toHaveLength(0);
    await act(async () => rows(renderer)[0].props.onClick());
    expect(new URLSearchParams(window.location.search).get("archive")).toBe("block");
    expect(lists(renderer)).toHaveLength(0);
    expect(renderer.root.findAllByType(MatchDataPanel)).toHaveLength(1);
    await click(renderer, "Retour au groupe");
    expect(window.location.search).toBe("?archive=block");
    expect(lists(renderer)).toHaveLength(1);
    expect(rows(renderer)).toHaveLength(2);
    await click(renderer, "Tous les groupes");
    expect(window.location.search).toBe("?view=groups");
    expect(lists(renderer)).toHaveLength(0);
    const group = buttons(renderer).find((node) => node.props.className === "games-group-open");
    expect(text(group)).toContain("Bloc scrim");
    await act(async () => group.props.onClick());
    expect(lists(renderer)).toHaveLength(1);
    const tabs = renderer.root.findByType(TabNav);
    await act(async () => tabs.props.onChange("games"));
    expect(window.location.search).toBe("");
    expect(lists(renderer)).toHaveLength(1);
    expect(renderer.root.findAllByType(ImportedGames)).toHaveLength(1);
    await browserBack("/games?view=groups&archive=block");
    expect(renderer.root.findByType(ImportedGames).props.scopeName).toBe("Bloc scrim");
    expect(lists(renderer)).toHaveLength(1);
    await browserBack("/games?view=groups");
    expect(buttons(renderer).some((node) => node.props.className === "games-group-open")).toBe(true);
    expect(lists(renderer)).toHaveLength(0);
    await browserBack("/games");
    expect(lists(renderer)).toHaveLength(1);
    expect(renderer.root.findByType(ImportedGames).props.scopeName).toBe("");
  });

  it("prioritizes statistics and reveals management actions only through the discrete options control", async () => {
    const renderer = await mount("/games?match=one");
    expect(renderer.root.findByType(MatchDataPanel).props.match.id).toBe("one");
    expect(lists(renderer)).toHaveLength(0);
    expect(renderer.root.findAllByType(GameActions)).toHaveLength(1);
    expect(button(renderer, "Options de la game")).toBeTruthy();
    for (const label of ["Modifier les informations", "Corriger les rôles et profils", "Supprimer"]) expect(button(renderer, label)).toBeUndefined();
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    await click(renderer, "Options de la game");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    for (const label of ["Modifier les informations", "Corriger les rôles et profils", "Supprimer"]) expect(button(renderer, label)).toBeTruthy();
    expect(renderer.root.findByType(MatchDataPanel).props.match.id).toBe("one");
    await click(renderer, "Fermer la fenêtre");
    expect(button(renderer, "Options de la game")).toBeTruthy();
    expect(button(renderer, "Corriger les rôles et profils")).toBeUndefined();
    const actions = renderer.root.findByType(GameActions);
    const trigger = button(renderer, "Options de la game");
    let resolveRefresh;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    await act(async () => actions.props.onUpdated({ matchId: "one", action: "update" }));
    expect(renderer.root.findByType(GameActions)).toBe(actions);
    expect(button(renderer, "Options de la game")).toBe(trigger);
    expect(trigger.props.disabled).toBe(true);
    expect(renderer.root.findByType(MatchDataPanel).props.match.id).toBe("one");
    await act(async () => resolveRefresh({ matches: [game("one", { raw: { nxt5Label: "Game corrigée" } })] }));
    expect(trigger.props.disabled).toBe(false);
    expect(text(renderer.root.findByType(MatchDataPanel))).toContain("Game corrigée");
    expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === "match-details")).toHaveLength(2);
  });
});
