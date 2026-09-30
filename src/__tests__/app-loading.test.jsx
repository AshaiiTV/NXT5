import { createSeoDocument } from "./helpers/seo-document.js";
import React, { Suspense, lazy, useEffect, useRef } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppContent from "../AppContent.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { apiFetch } from "../api/client.js";

const visual = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: ({ excluded }) => <aside data-audience-excluded={excluded} /> }));
vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({
  default: function LoadingScreen({ phase, progress }) {
    const identity = useRef(Symbol("loader"));
    useEffect(() => { visual.mounts += 1; return () => { visual.unmounts += 1; }; }, []);
    return <section data-loader={identity.current} data-phase={phase} data-progress={progress} />;
  },
}));
vi.mock("../pages/public/PublicPages.jsx", () => ({
  HomeScreen: ({ navigate }) => <main data-page="home"><button onClick={() => navigate("/equipes")}>Ouvrir</button></main>,
  AuthPage: ({ onAuth }) => <main data-page="auth"><button onClick={() => onAuth({ id: "user", email: "staff@nxt5.test", email_verified: true })}>Connexion réussie</button></main>,
  LegalPage: () => <main data-page="legal" />,
  ForgotPasswordPage: () => <main data-page="forgot" />,
  ResetPasswordPage: () => <main data-page="reset" />,
  NotFoundPage: () => <main data-page="not-found" />,
  LegalLinks: () => null,
  LEGAL_PAGES: { "/confidentialite": {} },
}));
vi.mock("../components/layout/AppChrome.jsx", () => ({
  AmbientBackground: () => null,
  Sidebar: ({ onLogout }) => <button data-logout onClick={onLogout}>Déconnexion</button>,
  Topbar: () => null,
  BeginnerCompass: () => null,
  ApiBanner: ({ error, onRetry }) => error ? <aside role="alert">{error}<button onClick={onRetry}>Réessayer</button></aside> : null,
}));
vi.mock("../pages/workspace/Planning.jsx", () => ({ Planning: ({ planningStore }) => <button data-edit-planning onClick={() => planningStore.forContext({ teamId: "a", playerId: "p", weekStart: "2026-09-28" }).setNotes("Disponibilités")}>Modifier le planning</button> }));
vi.mock("../pages/workspace/Teams.jsx", () => ({ Teams: ({ data }) => <main data-page="teams" data-games={data.matches.length} /> }));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => null }));
vi.mock("../pages/public/DemoPage.jsx", () => ({ DemoPage: () => <main data-page="demo" /> }));
vi.mock("../pages/public/PublicGuides.jsx", () => ({
  PUBLIC_GUIDES: { "/guides/importer-premier-scrim": {}, "/guides/preparer-debrief": {} },
  PublicGuidePage: () => <main data-page="public-guide" />,
}));

const cleanups = [];
const user = { id: "user", email: "staff@nxt5.test", email_verified: true };
const emptySnapshot = { teams: [], players: [], matches: [], selectedTeamId: null,
  pagination: { offset: 0, total: 0, hasMore: false, nextOffset: null } };

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  visual.mounts = 0;
  visual.unmounts = 0;
  const browser = {
    location: new URL("https://nxt5.test/equipes"),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), scrollTo: vi.fn(),
    setTimeout, clearTimeout, confirm: vi.fn(() => false),
    localStorage: { getItem: vi.fn(), setItem: vi.fn() },
  };
  const setUrl = (_state, _title, path) => { browser.location = new URL(path, browser.location); };
  browser.history = { pushState: vi.fn(setUrl), replaceState: vi.fn(setUrl) };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", createSeoDocument());
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function mount(path = "/equipes") {
  window.location = new URL(path, "https://nxt5.test");
  const module = deferred();
  const requests = [];
  apiFetch.mockImplementation((url) => {
    const request = { url, ...deferred() };
    requests.push(request);
    return request.promise;
  });
  const LazyApp = lazy(() => module.promise);
  let renderer;
  act(() => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback={null}><LazyApp /></Suspense></AppLoadingProvider>); });
  cleanups.push(() => act(() => renderer.unmount()));
  return {
    renderer, requests,
    get loaders() { return renderer.root.findAll((node) => node.type === "section" && node.props["data-loader"]); },
    get pages() { return renderer.root.findAll((node) => node.type === "main" && node.props["data-page"]); },
    async loadModule() { await act(async () => module.resolve({ default: AppContent })); },
    async resolve(index, data) { expect(requests[index]).toBeDefined(); await act(async () => requests[index].resolve(data)); },
    async reject(index) { expect(requests[index]).toBeDefined(); await act(async () => requests[index].reject(new Error("Réseau indisponible"))); },
  };
}

describe("one continuous application loading screen", () => {
  it("retains one visual instance through deferred module, session and paginated bootstrap, then exits immediately", async () => {
    const app = mount();
    const identity = app.loaders[0].props["data-loader"];
    const expectPhase = (phase) => {
      expect(app.loaders).toHaveLength(1);
      expect(app.loaders[0].props["data-loader"]).toBe(identity);
      expect(app.loaders[0].props["data-phase"]).toBe(phase);
      expect(visual).toEqual({ mounts: 1, unmounts: 0 });
    };
    expectPhase("app");
    await app.loadModule();
    expectPhase("session");
    expect(app.requests[0].url).toBe("auth-me");
    await app.resolve(0, { user });
    expectPhase("bootstrap");
    expect(app.loaders[0].props["data-progress"]).toBeNull();
    const matches = Array.from({ length: 101 }, (_, index) => ({ id: String(index), team_id: "a" }));
    await app.resolve(1, { ...emptySnapshot, teams: [{ id: "a" }], selectedTeamId: "a", matches: matches.slice(0, 100),
      pagination: { offset: 0, total: 101, nextOffset: 100, hasMore: true } });
    expectPhase("bootstrap");
    expect(app.loaders[0].props["data-progress"]).toEqual({ loaded: 100, total: 101 });
    expect(app.pages).toHaveLength(0);
    await app.resolve(2, { selectedTeamId: "a", matches: matches.slice(100),
      pagination: { offset: 100, total: 101, nextOffset: null, hasMore: false } });
    expect(app.loaders).toHaveLength(0);
    expect(app.pages[0].props["data-games"]).toBe(101);
    expect(visual).toEqual({ mounts: 1, unmounts: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["/", "/connexion", "/confidentialite", "/mot-de-passe-oublie", "/page-inconnue", "/demo", "/guides/importer-premier-scrim", "/guides/preparer-debrief", "/guides/nonexistent"])("shows %s without the staff loader while its module and session resolve", async (path) => {
    const app = mount(path);
    expect(app.loaders).toHaveLength(0);
    await app.loadModule();
    expect(app.loaders).toHaveLength(0);
    expect(app.pages).toHaveLength(1);
    await app.resolve(0, { user: null });
    expect(app.loaders).toHaveLength(0);
    expect(app.requests).toHaveLength(1);
    expect(visual.mounts).toBe(0);
  });

  it.each(["/demo", "/guides/importer-premier-scrim", "/guides/preparer-debrief"])("keeps %s independent of authenticated team data", async (path) => {
    const app = mount(path);
    await app.loadModule();
    await app.resolve(0, { user });
    expect(app.loaders).toHaveLength(0);
    expect(app.requests).toHaveLength(1);
    expect(["demo", "public-guide"]).toContain(app.pages[0].props["data-page"]);
  });

  it("shows the receipt of a deletion whose response was lost before checking the session", async () => {
    const removeItem = vi.fn();
    window.sessionStorage = { getItem: vi.fn((key) => key === "nxt5_account_deletion_pending" ? "a".repeat(43) : null), removeItem };
    const app = mount("/parametres");
    await app.loadModule();
    expect(app.requests[0].url).toBe("auth-delete-account");
    await app.resolve(0, { ok: true, receipt: { reference: "receipt-123", completedAt: "2026-09-30T12:00:00Z", summary: {} } });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(app.loaders).toHaveLength(0);
    expect(JSON.stringify(app.renderer.toJSON())).toContain("receipt-123");
    expect(removeItem).toHaveBeenCalledWith("nxt5_account_deletion_pending");
    expect(app.requests).toHaveLength(1);
    expect(window.location.pathname).toBe("/connexion");
  });

  it("releases the loader when a private session is missing or fails", async () => {
    const app = mount("/statistiques");
    await app.loadModule();
    await app.reject(0);
    expect(app.loaders).toHaveLength(0);
    expect(app.pages[0].props["data-page"]).toBe("auth");
    expect(window.location.pathname).toBe("/connexion");
    expect(app.requests).toHaveLength(1);
  });

  it("shows the failure, reuses the shared loader for retry, and accepts an empty account immediately", async () => {
    const app = mount();
    await app.loadModule();
    await app.resolve(0, { user });
    await app.reject(1);
    expect(app.loaders).toHaveLength(0);
    expect(app.renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    const retry = app.renderer.root.findAllByType("button").find((button) => button.children.includes("Réessayer"));
    act(() => { void retry.props.onClick(); });
    expect(app.loaders).toHaveLength(1);
    expect(app.loaders[0].props["data-phase"]).toBe("bootstrap");
    expect(app.loaders[0].props["data-progress"]).toBeNull();
    expect(app.renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    await app.resolve(2, emptySnapshot);
    expect(app.loaders).toHaveLength(0);
    expect(app.pages[0].props["data-page"]).toBe("teams");
    expect(app.pages[0].props["data-games"]).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts the shared session loader when navigating from a public page before authentication resolves", async () => {
    const app = mount("/");
    await app.loadModule();
    act(() => app.renderer.root.findByType("button").props.onClick());
    expect(app.loaders).toHaveLength(1);
    expect(app.loaders[0].props["data-phase"]).toBe("session");
    const identity = app.loaders[0].props["data-loader"];
    await app.resolve(0, { user });
    expect(app.loaders[0].props["data-loader"]).toBe(identity);
    expect(app.loaders[0].props["data-phase"]).toBe("bootstrap");
    await app.resolve(1, emptySnapshot);
    expect(app.loaders).toHaveLength(0);
  });

  it("releases the screen when leaving bootstrap for a public page and ignores the late response", async () => {
    const app = mount();
    await app.loadModule();
    await app.resolve(0, { user });
    expect(app.loaders[0].props["data-phase"]).toBe("bootstrap");
    window.location = new URL("https://nxt5.test/confidentialite");
    act(() => window.addEventListener.mock.calls.find(([event]) => event === "popstate")[1]());
    expect(app.loaders).toHaveLength(0);
    expect(app.pages[0].props["data-page"]).toBe("legal");
    await app.resolve(1, emptySnapshot);
    expect(app.loaders).toHaveLength(0);
    expect(app.pages[0].props["data-page"]).toBe("legal");
  });

  it("opens a team with no games, players or reports as soon as its empty snapshot succeeds", async () => {
    const app = mount();
    await app.loadModule();
    await app.resolve(0, { user });
    await app.resolve(1, { ...emptySnapshot, teams: [{ id: "a" }], selectedTeamId: "a" });
    expect(app.loaders).toHaveLength(0);
    expect(app.pages[0].props["data-page"]).toBe("teams");
    expect(app.pages[0].props["data-games"]).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});


it.each(["resolve", "reject"])("B9 ignores initial auth-me %s after successful login", async (outcome) => {
  const app = mount("/connexion");
  await app.loadModule();
  act(() => app.renderer.root.findAllByType("button").find(node => node.props.children === "Connexion réussie").props.onClick());
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(app.requests[1].url).toContain("bootstrap");
  await app.resolve(1, emptySnapshot);
  await act(async () => { await vi.dynamicImportSettled(); });
  if (outcome === "reject") await app.reject(0);
  else await app.resolve(0, { user: null });
  expect(app.pages.some(node => node.props["data-page"] === "auth")).toBe(false);
  expect(app.pages.some(node => node.props["data-page"] === "teams")).toBe(true);
});


it.each(['/tarifs', '/admin', '/admin/tarifs', '/admin/inconnu'])('N2-04: excludes admin route %s in the actual collection context for a non-admin', async path => {
  const app = mount(path);
  await app.loadModule();
  await app.resolve(0, { user });
  expect(app.renderer.root.findByProps({ 'data-audience-excluded': true })).toBeDefined();
  expect(app.pages.some(page => page.props['data-page'] === 'not-found')).toBe(true);
});


it.each([true, false])("R-F3 flushes before auth-logout and stays signed in on save failure (%s)", async succeeds => {
  const app = mount("/planning");
  await app.loadModule();
  await app.resolve(0, { user });
  await app.resolve(1, { ...emptySnapshot, teams: [{ id: "a", owner_id: "user" }], selectedTeamId: "a", players: [{ id: "p", team_id: "a", role: "TOP", user_id: "user" }] });
  await act(async () => app.renderer.root.findByProps({ "data-edit-planning": true }).props.onClick());
  let logout;
  act(() => { logout = app.renderer.root.findByProps({ "data-logout": true }).props.onClick(); });
  await act(async () => { await Promise.resolve(); });
  expect(app.requests[2].url).toBe("player-availability-manage");
  expect(app.requests.some(r => r.url === "auth-logout")).toBe(false);
  if (succeeds) {
    await app.resolve(2, { availability: { team_id: "a", player_id: "p", week_start: "2026-09-28", notes: "Disponibilités" } });
    expect(app.requests[3].url).toBe("auth-logout");
    await app.resolve(3, {});
    await logout;
    expect(window.location.pathname).toBe("/connexion");
  } else {
    await app.reject(2);
    await logout;
    expect(app.requests.some(r => r.url === "auth-logout")).toBe(false);
    expect(window.location.pathname).toBe("/planning");
    expect(JSON.stringify(app.renderer.toJSON())).toContain("Déconnexion interrompue");
  }
});

it.each([401, 403, 500])('R4-V2 actually logs out after a planning error %s', async status => {
  window.confirm.mockReturnValue(true);
  const app = mount('/planning');
  await app.loadModule(); await app.resolve(0, { user });
  await app.resolve(1, { ...emptySnapshot, teams: [{ id: 'a', owner_id: 'user' }], selectedTeamId: 'a', players: [{ id: 'p', team_id: 'a', role: 'TOP', user_id: 'user' }] });
  await act(async () => app.renderer.root.findByProps({ 'data-edit-planning': true }).props.onClick());
  let logout;
  await act(async () => { logout = app.renderer.root.findByProps({ 'data-logout': true }).props.onClick(); });
  await act(async () => app.requests[2].reject(Object.assign(new Error('Planning failed'), { status })));
  expect(app.requests[3].url).toBe('auth-logout');
  expect(window.confirm).toHaveBeenCalledTimes(status === 500 ? 1 : 0);
  await app.resolve(3, {}); await logout;
  expect(window.location.pathname).toBe('/connexion');
  expect(app.requests.filter(r => r.url === 'player-availability-manage')).toHaveLength(1);
});
