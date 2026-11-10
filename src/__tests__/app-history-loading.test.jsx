import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainApp } from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../components/layout/AppChrome.jsx", () => ({
  AmbientBackground: () => null,
  Sidebar: ({ setActive }) => <nav data-history-navigation><button onClick={() => setActive("home")}>Accueil</button></nav>,
  Topbar: ({ onSelectTeam }) => <nav data-history-team-selector><button onClick={() => onSelectTeam("b")}>Autre équipe</button></nav>,
  ApiBanner: ({ error }) => error ? <aside role="alert">{error}</aside> : null,
}));
vi.mock("../pages/public/PublicPages.jsx", () => ({ LegalLinks: () => null, SiteHeader: () => null }));
vi.mock("../pages/workspace/HomeWorkspace.jsx", () => ({ default: ({ data }) => <section data-history-page="home" data-games={data.matches.length} data-team={data.selectedTeamId} /> }));
vi.mock("../pages/workspace/Teams.jsx", () => ({ Teams: () => <section data-history-page="teams" /> }));
vi.mock("../pages/workspace/GameWorkspace.jsx", () => ({ GameWorkspace: ({ data }) => <section data-history-page="games" data-games={data.matches.length} data-team={data.selectedTeamId} /> }));
vi.mock("../pages/workspace/TrendsPage.jsx", () => ({ TrendsPage: ({ data }) => <section data-history-page="trends" data-games={data.matches.length} data-team={data.selectedTeamId} /> }));
vi.mock("../pages/workspace/PlayerUltimateProfile.jsx", () => ({ PlayerUltimateProfile: ({ data }) => <section data-history-page="profile" data-games={data.matches.length} data-team={data.selectedTeamId} /> }));
vi.mock("../pages/workspace/DraftWorkspace.jsx", () => ({ DraftWorkspace: ({ data }) => <section data-history-page="draft" data-games={data.matches.length} data-team={data.selectedTeamId} /> }));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => null }));

const user = { id: "user", email: "staff@nxt5.test", email_verified: true };
let renderer, requests, props;
const renderedPages = () => renderer.root.findAll((node) => typeof node.type === "string" && node.props["data-history-page"]);
const shell = () => {
  expect(renderer.root.findAllByProps({ "data-history-navigation": true })).toHaveLength(1);
  expect(renderer.root.findAllByProps({ "data-history-team-selector": true })).toHaveLength(1);
};

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function snapshot({ teamId = "a", offset = 0, total = 201, initial = offset === 0 } = {}) {
  const count = Math.min(100, total - offset);
  return {
    ...(initial ? { ...DEFAULT_DATA, teams: [{ id: "a", owner_id: user.id }, { id: "b", owner_id: user.id }] } : {}),
    selectedTeamId: teamId,
    matches: Array.from({ length: count }, (_, index) => ({ id: `${teamId}-${offset + index}`, team_id: teamId })),
    pagination: { offset, total, hasMore: offset + count < total, nextOffset: offset + count < total ? offset + count : null },
  };
}

beforeEach(() => {
  requests = [];
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/accueil"), localStorage: { getItem: () => null, setItem: vi.fn() } });
  vi.stubGlobal("document", { querySelector: () => null, getElementById: () => null });
  apiFetch.mockImplementation((url) => {
    const request = { url, ...deferred() };
    requests.push(request);
    return request.promise;
  });
  props = { user, route: { path: "/accueil", search: "" }, navigate: vi.fn(), pushToast: vi.fn(), onLogout: vi.fn(), onUserUpdate: vi.fn() };
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function update(path) {
  const url = new URL(path, "https://nxt5.test");
  props = { ...props, route: { path: url.pathname, search: url.search } };
  await act(async () => renderer.update(<Suspense fallback="module"><MainApp {...props} /></Suspense>));
  await act(async () => { await vi.dynamicImportSettled(); });
}

async function open(path = "/accueil") {
  const url = new URL(path, "https://nxt5.test");
  props.route = { path: url.pathname, search: url.search };
  await act(async () => { renderer = TestRenderer.create(<Suspense fallback="module"><MainApp {...props} /></Suspense>); });
  expect(requests).toHaveLength(1);
}

async function resolve(index, value) {
  expect(requests[index]).toBeDefined();
  await act(async () => requests[index].resolve(value));
  await act(async () => { await vi.dynamicImportSettled(); });
}

describe("one complete team synchronization before the workspace", () => {
  it.each([
    ["/accueil", "home"], ["/games?team=a", "games"], ["/games?match=a-0", "games"],
    ["/games?archive=group", "games"], ["/games?import=1", "games"],
    ["/games?view=groups", "games"], ["/games?view=teams", "games"],
    ["/draft/adversaires", "games"], ["/rapports", "games"],
    ["/tendances", "trends"], ["/mon-profil", "profile"], ["/draft/pool", "draft"],
  ])("opens %s only after every team game has loaded", async (path, page) => {
    await open(path);
    expect(renderedPages()).toHaveLength(0);
    await resolve(0, snapshot());
    expect(renderedPages()).toHaveLength(0);
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain("matchesOnly=1");
    expect(renderer.root.findAllByProps({ "data-history-navigation": true })).toHaveLength(0);
    await resolve(1, snapshot({ offset: 100 }));
    expect(renderedPages()).toHaveLength(0);
    expect(requests).toHaveLength(3);
    await resolve(2, snapshot({ offset: 200 }));
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": page, "data-games": 201, "data-team": "a" });
    shell();
  });

  it("deduplicates history while routes change and reuses it after opening", async () => {
    await open();
    await resolve(0, snapshot());
    await update("/tendances");
    await update("/accueil");
    expect(renderedPages()).toHaveLength(0);
    expect(requests).toHaveLength(2);
    await resolve(1, snapshot({ offset: 100 }));
    await resolve(2, snapshot({ offset: 200 }));
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "home", "data-games": 201 });
    await update("/mon-profil");
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "profile", "data-games": 201 });
    expect(requests).toHaveLength(3);
  });

  it("offers a retry after a failed initial synchronization", async () => {
    await open("/tendances");
    await resolve(0, snapshot());
    await act(async () => requests[1].reject(new Error("Réseau indisponible")));
    shell();
    expect(renderedPages()).toHaveLength(0);
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    expect(requests).toHaveLength(2);
    const retry = renderer.root.findAllByType("button").find((button) => button.children.includes("Réessayer"));
    await act(async () => { void retry.props.onClick(); });
    expect(requests).toHaveLength(3);
    expect(requests[2].url).toContain("offset=0");
    await resolve(2, snapshot({ total: 1 }));
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "trends", "data-games": 1 });
  });

  it("hides the old team until the selected team is fully synchronized", async () => {
    await open("/tendances");
    await resolve(0, snapshot());
    await resolve(1, snapshot({ offset: 100 }));
    await resolve(2, snapshot({ offset: 200 }));
    shell();
    const select = renderer.root.findAllByType("button").find((button) => button.children.includes("Autre équipe"));
    await act(async () => select.props.onClick());
    expect(renderedPages()).toHaveLength(0);
    expect(requests).toHaveLength(4);
    expect(requests[3].url).toContain("teamId=b");
    await resolve(3, snapshot({ teamId: "b", total: 1 }));
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "trends", "data-games": 1, "data-team": "b" });
  });
});
