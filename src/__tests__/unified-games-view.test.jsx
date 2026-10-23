import React, { Suspense, useEffect, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { readRoute } from "../app/routing.js";
import DiscordGroupShare from "../components/discord/DiscordGroupShare.jsx";
import { ImportedGames } from "../components/games/ImportedGames.jsx";
import { MatchHeadToHead } from "../components/games/MatchHeadToHead.jsx";
import OpponentsWorkspace from "../components/opponents/OpponentsWorkspace.jsx";
import MatchDrafterPanel from "../components/opponents/MatchDrafterPanel.jsx";
import MatchOpponentPanel from "../components/opponents/MatchOpponentPanel.jsx";
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
    if (endpoint === "opponents-drafts") {
      const action = JSON.parse(options.body).action;
      if (action === "list") return { opponents: [], drafts: [], canEdit: true };
      if (action === "list-opponents") return { opponents: [], canEdit: true };
      if (action === "get-group-opponent") return { opponentId: null, opponents: [], matchCount: 2, canEdit: true };
      if (action === "get-match-opponent") return { opponentId: null, opponents: [], canEdit: true };
      if (action === "get-match-draft") return { draft: null, canEdit: true };
      throw new Error(`Unexpected opponent action: ${action}`);
    }
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
function button(renderer, label) { return buttons(renderer).find((node) => node.props["aria-label"] === label || text(node).trim() === label || (node.props.role === "tab" && node.findAllByType("span").some((span) => text(span) === label))); }
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
function defer() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
function opponentCalls(action) {
  return apiFetch.mock.calls.filter(([endpoint, options]) => endpoint === "opponents-drafts" && JSON.parse(options.body).action === action);
}
function mockOpponents(responses) {
  const original = apiFetch.getMockImplementation();
  apiFetch.mockImplementation((endpoint, options) => {
    const body = endpoint === "opponents-drafts" ? JSON.parse(options.body) : {};
    const response = responses[body.action];
    return response ? typeof response === "function" ? response(body, options) : Promise.resolve(response) : original(endpoint, options);
  });
}
function teamsCount(renderer) {
  return renderer.root.findAllByType(TabNav).find((node) => node.props.idPrefix === "games-library").props.items.find((item) => item.id === "teams").meta;
}
async function updateProps(renderer, props) {
  await act(async () => renderer.update(<Suspense fallback="loading"><RouteHarness props={props} /></Suspense>));
}

describe("unified Games workspace", () => {
  it("opens the partial library with its server total and forwards explicit history actions", async () => {
    const props = { ...settings(), loadNextPage: vi.fn().mockResolvedValue(true), ensureHistory: vi.fn().mockResolvedValue(true) };
    props.data = { ...props.data, selectedTeamId: "team", historyComplete: false, totals: { games: 1000 }, pagination: { total: 1000, hasMore: true } };
    const renderer = await mount("/games", props);
    const list = renderer.root.findByType(ImportedGames);
    expect(list.props).toMatchObject({ historyComplete: false, totalMatches: 1000, historyLoading: false, historyError: "" });
    expect(list.props.onLoadMore).toBe(props.loadNextPage);
    expect(list.props.onLoadHistory).toBe(props.ensureHistory);
    expect(renderer.root.findByType(TabNav).props.items.find(item => item.id === "games").meta).toBe("1000");
    expect(renderer.root.findAllByProps({ className: "games-team-record" })).toHaveLength(0);
    expect(rows(renderer)).toHaveLength(2);
    expect(props.ensureHistory).not.toHaveBeenCalled();
    expect(props.loadNextPage).not.toHaveBeenCalled();
    await click(renderer, "Charger la suite");
    expect(props.loadNextPage).toHaveBeenCalledOnce();
    expect(props.ensureHistory).not.toHaveBeenCalled();
  });

  it("loads the total opponent badge from Parties before the Teams directory is opened", async () => {
    const pending = defer();
    const opponents = [{ id: "opif", name: "OPIF" }, { id: "other-opponent", name: "Autre adversaire" }];
    mockOpponents({ "list-opponents": () => pending.promise, list: { opponents: [...opponents, { id: "new", name: "Nouveau" }], drafts: [], canEdit: true } });
    const renderer = await mount();
    expect(teamsCount(renderer)).toBe("—");
    expect(opponentCalls("list-opponents")).toHaveLength(1); expect(opponentCalls("list")).toHaveLength(0);
    expect(JSON.parse(opponentCalls("list-opponents")[0][1].body)).toEqual({ action: "list-opponents", teamId: "team" });
    await act(async () => pending.resolve({ opponents, canEdit: true }));
    expect(String(teamsCount(renderer))).toBe("2");
    expect(text(button(renderer, "Équipes"))).toContain("2");
    await click(renderer, "Équipes");
    expect(String(teamsCount(renderer))).toBe("3");
    expect(opponentCalls("list-opponents")).toHaveLength(1); expect(opponentCalls("list")).toHaveLength(1);
    const search = renderer.root.findAllByType("input").find((node) => node.props.type === "search");
    await act(async () => search.props.onChange({ target: { value: "OPIF" } }));
    expect(renderer.root.findAllByProps({ className: "opponent-directory-card" })).toHaveLength(1);
    expect(String(teamsCount(renderer))).toBe("3");
  });

  it("renders a real zero and reloads the badge when changing library views or bootstrap revision", async () => {
    let reads = 0;
    mockOpponents({ "list-opponents": () => Promise.resolve({ opponents: Array.from({ length: reads++ }, (_, index) => ({ id: `opponent-${index}`, name: `Adversaire ${index}` })) }) });
    const props = settings(); const renderer = await mount("/games", props);
    expect(String(teamsCount(renderer))).toBe("0"); expect(text(button(renderer, "Équipes"))).toContain("0");
    await click(renderer, "Groupes");
    expect(String(teamsCount(renderer))).toBe("1");
    await updateProps(renderer, { ...props, data: { ...props.data, bootstrapRevision: "next" } });
    expect(String(teamsCount(renderer))).toBe("2"); expect(opponentCalls("list-opponents")).toHaveLength(3);
  });

  it("reloads the opponent badge after returning from a match detail", async () => {
    let reads = 0;
    mockOpponents({ "list-opponents": () => Promise.resolve({ opponents: ++reads === 1 ? [{ id: "before" }] : [{ id: "before" }, { id: "created-in-detail" }] }) });
    const renderer = await mount();
    expect(String(teamsCount(renderer))).toBe("1");
    await act(async () => rows(renderer)[0].props.onClick());
    expect(renderer.root.findAllByType(MatchOpponentPanel)).toHaveLength(1);
    expect(opponentCalls("list-opponents")).toHaveLength(1);
    await click(renderer, "Retour aux parties");
    expect(String(teamsCount(renderer))).toBe("2"); expect(opponentCalls("list-opponents")).toHaveLength(2);
  });

  it("uses the full group opponent list for its badge without an additional lightweight request", async () => {
    const pending = defer();
    const opponents = [{ id: "opif", name: "OPIF" }, { id: "other", name: "Autre équipe" }];
    mockOpponents({ "get-group-opponent": () => pending.promise, "create-opponent": { opponent: { id: "new", name: "Nouvelle équipe" } } });
    const renderer = await mount("/games?archive=block");
    expect(teamsCount(renderer)).toBe("—");
    expect(opponentCalls("list-opponents")).toHaveLength(0);
    await act(async () => pending.resolve({ opponents, opponentId: "opif", matchCount: 12, canEdit: true }));
    expect(String(teamsCount(renderer))).toBe("2");
    await click(renderer, "Créer une équipe adverse");
    const createForm = renderer.root.findByProps({ className: "group-opponent-create" });
    await act(async () => createForm.findByType("input").props.onChange({ target: { value: "Nouvelle équipe" } }));
    await act(async () => createForm.props.onSubmit({ preventDefault() {} }));
    expect(String(teamsCount(renderer))).toBe("3");
    expect(opponentCalls("list-opponents")).toHaveLength(0);
    expect(opponentCalls("get-group-opponent")).toHaveLength(1);
    await click(renderer, "Tous les groupes");
    expect(opponentCalls("list-opponents")).toHaveLength(1); expect(String(teamsCount(renderer))).toBe("0");
  });

  it.each(["team", "account"])("never carries the old badge or a late response into a changed %s", async (scope) => {
    const stale = defer(), current = defer(); let reads = 0; let staleSignal;
    mockOpponents({ "list-opponents": (_body, options) => {
      reads += 1;
      if (reads === 1) return Promise.resolve({ opponents: [{ id: "first" }, { id: "second" }] });
      if (reads === 2) { staleSignal = options.signal; return stale.promise; }
      return current.promise;
    } });
    const props = settings(); const renderer = await mount("/games", props);
    expect(String(teamsCount(renderer))).toBe("2");
    const updating = { ...props, data: { ...props.data, bootstrapRevision: 1 } };
    await updateProps(renderer, updating);
    const next = scope === "team" ? { ...updating, selectedTeamId: "other", data: { ...updating.data, teams: [...updating.data.teams, { id: "other", name: "Autre équipe", owner_id: "owner" }] } } : { ...updating, user: { id: "another-user" } };
    await updateProps(renderer, next);
    expect(staleSignal.aborted).toBe(true); expect(teamsCount(renderer)).toBe("—");
    await act(async () => stale.resolve({ opponents: [{ id: "stale" }, { id: "private" }, { id: "old" }] }));
    expect(teamsCount(renderer)).toBe("—");
    await act(async () => current.resolve({ opponents: [] }));
    expect(String(teamsCount(renderer))).toBe("0"); expect(opponentCalls("list-opponents")).toHaveLength(3);
  });

  it("opens opponent teams as the third Parties tab without exposing the match list or import action", async () => {
    const renderer = await mount("/games?category=scrim");
    await click(renderer, "Équipes");
    expect(window.location.search).toBe("?category=scrim&view=teams");
    const tabs = renderer.root.findByType(TabNav).props.items;
    expect(tabs.map((tab) => tab.id)).toEqual(["games", "groups", "teams"]);
    expect(renderer.root.findByType(OpponentsWorkspace).props.embedded).toBe(true);
    expect(lists(renderer)).toHaveLength(0);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    await browserBack("/games?category=scrim");
    expect(lists(renderer)).toHaveLength(1);
    expect(renderer.root.findAllByType(OpponentsWorkspace)).toHaveLength(0);
  });

  it("reloads opponent observations after the shared match snapshot changes without leaving the Teams tab", async () => {
    const props = settings();
    props.data.bootstrapRevision = 1;
    const renderer = await mount("/games?view=teams", props);
    const listRequests = () => apiFetch.mock.calls.filter(([path, options]) => path === "opponents-drafts" && JSON.parse(options.body).action === "list");
    expect(listRequests()).toHaveLength(1);
    const next = { ...props, data: { ...props.data, matches: [...history, game("imported")], bootstrapRevision: 2 } };
    await act(async () => renderer.update(<Suspense fallback="loading"><RouteHarness props={next} /></Suspense>));
    expect(listRequests()).toHaveLength(2);
    expect(renderer.root.findByType(TabNav).props.activeId).toBe("teams");
    expect(button(renderer, "Actualiser")).toBeUndefined();
  });

  it("redirects old draft opponent links to the Teams library without leaving a dead Draft tab", async () => {
    const renderer = await mount("/draft/adversaires");
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", "/games?view=teams");
    expect(window.location.pathname).toBe("/games");
    expect(window.location.search).toBe("?view=teams");
    expect(renderer.root.findByType(TabNav).props.activeId).toBe("teams");
    expect(renderer.root.findAllByType(OpponentsWorkspace)).toHaveLength(1);
  });

  it("keeps opponent controls in the match context and the linked draft in its own persistent tab", async () => {
    const renderer = await mount("/games?match=one");
    const draft = renderer.root.findByType(MatchDrafterPanel);
    expect(draft.props.match.id).toBe("one");
    expect(draft.props.presentation).toBe("inline");
    expect(renderer.root.findByType(MatchOpponentPanel).props.match.id).toBe("one");
    const context = renderer.root.findByProps({ className: "games-match-links" });
    expect(context.findAllByType(MatchOpponentPanel)).toHaveLength(1);
    expect(context.findAllByType(MatchDrafterPanel)).toHaveLength(0);
    expect(visible(draft)).toBe(false);
    expect(draft.props.active).toBe(false);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    const calls = apiFetch.mock.calls.filter(([endpoint]) => endpoint === "opponents-drafts").map(([, options]) => JSON.parse(options.body));
    expect(calls).toEqual([{ action: "get-match-opponent", teamId: "team", matchId: "one" }, { action: "get-match-draft", teamId: "team", matchId: "one" }]);
    for (const label of ["Drafting", "Face-à-face", "Drafting", "Chronologie", "Récap"]) {
      await click(renderer, label);
      expect(renderer.root.findByType(MatchDrafterPanel)).toBe(draft);
      expect(visible(draft)).toBe(label === "Drafting");
      expect(draft.props.active).toBe(label === "Drafting");
    }
    expect(opponentCalls("get-match-draft")).toHaveLength(1);
    expect(opponentCalls("get-match-opponent")).toHaveLength(1);
    await click(renderer, "Retour aux parties");
    expect(renderer.root.findAllByType(MatchDrafterPanel)).toHaveLength(0);
    expect(renderer.root.findAllByType(MatchOpponentPanel)).toHaveLength(0);
  });

  it("retains both association panels and avoids refetching them when match statistics refresh", async () => {
    const props = settings();
    const renderer = await mount("/games?match=one", props);
    await click(renderer, "Drafting");
    const draft = renderer.root.findByType(MatchDrafterPanel);
    await act(async () => renderer.update(<Suspense fallback="loading"><RouteHarness props={{ ...props, data: { ...props.data, bootstrapRevision: "new-revision" } }} /></Suspense>));
    const draftCalls = apiFetch.mock.calls.filter(([endpoint]) => endpoint === "opponents-drafts").map(([, options]) => JSON.parse(options.body).action);
    expect(draftCalls).toEqual(["get-match-opponent", "get-match-draft"]);
    expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === "match-details")).toHaveLength(2);
    expect(renderer.root.findAllByType(MatchOpponentPanel)).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchDrafterPanel)).toHaveLength(1);
    expect(renderer.root.findByType(MatchDrafterPanel)).toBe(draft);
    expect(visible(draft)).toBe(true);
    expect(button(renderer, "Drafting").props["aria-selected"]).toBe(true);
  });

  it("opens import for an owner before the roster is complete", async () => {
    const props = settings();
    props.data.players = props.data.players.slice(0, 4);
    props.data.players.push({ ...props.data.players[0] }, { id: "foreign", team_id: "other", role: "SUP" }, { id: "coach", team_id: "team", role: "COACH" });
    const renderer = await mount("/games", props);
    expect(button(renderer, "Importer une partie")).toBeTruthy();
    await click(renderer, "Importer une partie");
    expect(window.location.search).toBe("?import=1");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(1);
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
    expect(text(statistics)).toContain("Qui a le plus d’impact ?");
    expect(button(renderer, "Récap").props["aria-selected"]).toBe(true);
    expect(text(statistics)).not.toContain("Vue 5v5");
    await click(renderer, "Face-à-face");
    expect(button(renderer, "Face-à-face").props["aria-selected"]).toBe(true);
    const comparison = statistics.findByType(MatchHeadToHead);
    expect(statistics.findAllByType(MatchHeadToHead)).toHaveLength(1);
    expect(statistics.findAllByProps({ role: "tablist" })).toHaveLength(1);
    expect(comparison.findAllByProps({ role: "tablist" })).toHaveLength(0);
    expect(comparison.findAllByType("details")).toHaveLength(0);
    expect(statistics.findAllByProps({ className: "games-analysis-disclosure" })).toHaveLength(0);
    for (const metric of ["gold", "damage", "vision"]) expect(comparison.findAllByProps({ "data-metric": metric })).toHaveLength(5);
    for (const stat of ["kda", "cs"]) expect(comparison.findAllByProps({ "data-player-stat": stat })).toHaveLength(10);
    for (const metric of ["cs10", "cs20", "participation", "damage-share", "gold-share", "vision-share", "deaths-share"]) expect(comparison.findAllByProps({ "data-metric": metric })).toHaveLength(0);
    expect(comparison.findAllByType("dialog")).toHaveLength(0);
    for (const metric of ["gold", "damage", "vision"]) expect(comparison.findAllByProps({ "data-team-metric": metric })).toHaveLength(1);
    const statsText = text(statistics);
    const reviewIndex = statsText.indexOf("Préparer le débrief");
    expect(reviewIndex).toBeGreaterThanOrEqual(0);
    expect(statsText).not.toContain("Vue 5v5");
    for (const metric of ["K / D / A", "Dégâts aux champions", "Or final", "Score de vision"]) {
      expect(statsText.indexOf(metric)).toBeGreaterThan(reviewIndex);
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
    if (returnSearch.includes("archive=")) {
      expect(button(renderer, "Importer une partie")).toBeUndefined();
      await click(renderer, "Tous les groupes");
      expect(window.location.search).toBe("?view=groups");
    }
    await click(renderer, "Importer une partie");
    expect(new URLSearchParams(window.location.search).get("import")).toBe("1");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(1);
    await click(renderer, "Fermer la fenêtre");
    expect(window.location.search).toBe(returnSearch.includes("archive=") ? "?view=groups" : returnSearch);
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
  });

  it("keeps a stale group import closed when opening and returning from a game", async () => {
    const renderer = await mount("/games?archive=block&context=scrim&import=1");
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
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
    expect(button(renderer, "Importer une partie")).toBeUndefined();
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
    expect(button(renderer, "Importer une partie")).toBeUndefined();
  });

  it("opens the imported game directly after the import flow succeeds", async () => {
    const renderer = await mount("/games?import=1");
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
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(button(renderer, "Exporter sur Discord")).toBeTruthy();
    expect(renderer.root.findByType(DiscordGroupShare).props.archiveId).toBe("block");
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
    expect(button(renderer, "Importer une partie")).toBeTruthy();
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

  it.each(["/games?archive=block&import=1", "/games?archive=missing&import=1"])("does not mount import controls or its dialog inside a direct group URL %s", async (path) => {
    const renderer = await mount(path);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });

  it("does not expose an import through the empty group state", async () => {
    const props = settings();
    props.data.matchArchives[0].match_ids = [];
    const renderer = await mount("/games?archive=block", props);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(renderer.root.findByType(ImportedGames).props.emptyAction).toBeNull();
    expect(renderer.root.findAllByType(ImportGameFlow)).toHaveLength(0);
    await click(renderer, "Tous les groupes");
    expect(button(renderer, "Importer une partie")).toBeTruthy();
  });

  it.each([
    ["owner", null, true],
    ["staff", { team_id: "team", user_id: "staff", role: "coach" }, true],
    ["staff", { team_id: "team", user_id: "staff", role: "player" }, false],
    ["staff", { team_id: "other", user_id: "staff", role: "coach" }, false],
  ])("gates group Discord export for %s with membership %o", async (userId, currentMember, allowed) => {
    const renderer = await mount("/games?archive=block", { ...settings(), user: { id: userId }, currentMember });
    expect(Boolean(button(renderer, "Exporter sur Discord"))).toBe(allowed);
    expect(apiFetch.mock.calls.some(([endpoint]) => endpoint.startsWith("team-discord-"))).toBe(false);
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
