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
  props = { ...props, route: { path, search: "" } };
  await act(async () => renderer.update(<Suspense fallback="module"><MainApp {...props} /></Suspense>));
  await act(async () => { await vi.dynamicImportSettled(); });
}

async function open(path = "/accueil") {
  props.route = { path, search: "" };
  await act(async () => { renderer = TestRenderer.create(<Suspense fallback="module"><MainApp {...props} /></Suspense>); });
  expect(requests).toHaveLength(1);
}

async function resolve(index, value) {
  expect(requests[index]).toBeDefined();
  await act(async () => requests[index].resolve(value));
  await act(async () => { await vi.dynamicImportSettled(); });
}

describe("on-demand complete history in the workspace", () => {
  it("opens home after the first page without requesting older games", async () => {
    await open();
    expect(renderedPages()).toHaveLength(0);
    await resolve(0, snapshot({ total: 1000 }));
    shell();
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "home", "data-games": 100, "data-team": "a" });
    expect(requests).toHaveLength(1);
  });

  it.each([["/games", "games"], ["/rapports", "games"], ["/tendances", "trends"], ["/mon-profil", "profile"], ["/draft/pool", "draft"]])("keeps %s behind the complete-history gate with navigation available", async (path, page) => {
    await open(path);
    await resolve(0, snapshot());
    shell();
    expect(renderedPages()).toHaveLength(0);
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain("matchesOnly=1");
    await resolve(1, snapshot({ offset: 100 }));
    expect(renderedPages()).toHaveLength(0);
    await resolve(2, snapshot({ offset: 200 }));
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": page, "data-games": 201, "data-team": "a" });
    shell();
  });

  it("lets home stay usable while history loads and deduplicates route changes", async () => {
    await open();
    await resolve(0, snapshot());
    await update("/tendances");
    expect(requests).toHaveLength(2);
    expect(renderedPages()).toHaveLength(0);
    await update("/accueil");
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "home", "data-games": 100 });
    await update("/mon-profil");
    expect(requests).toHaveLength(2);
    expect(renderedPages()).toHaveLength(0);
    await resolve(1, snapshot({ offset: 100 }));
    await resolve(2, snapshot({ offset: 200 }));
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "profile", "data-games": 201 });
  });

  it("keeps a failed partial history hidden and retries only on request", async () => {
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

  it("does not expose the old team's history after selecting another team", async () => {
    await open("/tendances");
    await resolve(0, snapshot());
    const select = renderer.root.findAllByType("button").find((button) => button.children.includes("Autre équipe"));
    await act(async () => select.props.onClick());
    expect(requests).toHaveLength(3);
    expect(requests[2].url).toContain("teamId=b");
    await resolve(1, snapshot({ offset: 100 }));
    expect(renderedPages()).toHaveLength(0);
    await resolve(2, snapshot({ teamId: "b", total: 1 }));
    expect(renderedPages()[0].props).toMatchObject({ "data-history-page": "trends", "data-games": 1, "data-team": "b" });
  });
});
