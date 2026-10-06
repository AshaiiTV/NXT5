import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import AppRouter from "../AppRouter.jsx";
import { DemoPage } from "../pages/public/DemoPage.jsx";
import { publicPaths, render } from "../seo/render.jsx";
import { apiFetch } from "../api/client.js";
import { useAppLoading } from "../components/loading/AppLoadingProvider.jsx";
import { createSeoDocument } from "./helpers/seo-document.js";

const doubles = vi.hoisted(() => ({
  privateModule: vi.fn(),
  consentState: { choice: null, loaded: false, saving: false, error: "" },
  initializeConsent: vi.fn(),
}));
vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../app/audience-client.js", () => ({
  AUDIENCE_CONSENT_VERSION: "2026-09-14", AUDIENCE_SETTINGS_EVENT: "nxt5:cookie-settings",
  openCookieSettings: vi.fn(), trackAudienceEvent: vi.fn(),
  getAudienceClient: () => ({
    getState: () => doubles.consentState,
    subscribe: () => () => {}, connect: () => () => {}, setContext: () => {},
    initialize: doubles.initializeConsent,
  }),
}));
vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({ default: ({ phase }) => <aside data-loading={phase} /> }));
vi.mock("../AppContent.jsx", () => {
  doubles.privateModule();
  return { default: function PrivateWorkspace({ route }) {
    useAppLoading(null);
    return <main data-private-path={route.path} />;
  } };
});

let renderer;
let resolveSession;
function entry(path) {
  return <React.StrictMode><App initialApp={AppRouter} initialRoute={{ path, search: "" }} initialDemoPage={path === "/demo" ? DemoPage : undefined} /></React.StrictMode>;
}
function setLocation(path) { window.location = new URL(path, "https://nxt5.org"); }
function mount(tree) { act(() => { renderer = TestRenderer.create(tree); }); }
async function session(user) {
  await act(async () => resolveSession({ user }));
  await act(async () => { await vi.dynamicImportSettled(); });
}

beforeEach(() => {
  doubles.consentState = { choice: null, loaded: false, saving: false, error: "" };
  const listeners = new Map();
  vi.stubGlobal("window", {
    location: new URL("https://nxt5.org/"),
    history: {
      pushState: vi.fn((_state, _title, path) => setLocation(path)),
      replaceState: vi.fn((_state, _title, path) => setLocation(path)),
    },
    addEventListener: (name, callback) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener: (name, callback) => listeners.get(name)?.delete(callback),
    scrollTo: vi.fn(), setTimeout, clearTimeout,
    localStorage: { getItem: vi.fn(), setItem: vi.fn() },
  });
  vi.stubGlobal("document", createSeoDocument());
  apiFetch.mockImplementation(endpoint => {
    if (endpoint === "auth-me") return new Promise(resolve => { resolveSession = resolve; });
    if (endpoint === "auth-social-status") return Promise.resolve({ providers: [] });
    throw new Error(`Unexpected API request: ${endpoint}`);
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("public prerender initial state", () => {
  it.each([...publicPaths, "/404"])("renders the complete initial tree for %s without browser globals or requests", path => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    const html = render(path);
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain('<p class="sr-only" role="status"></p>');
    expect(html).toContain('aria-live="polite" aria-atomic="false"');
    expect(html).not.toContain("data-loading=");
    expect(html).not.toContain("data-app-error");
    expect(apiFetch).not.toHaveBeenCalled();
    expect(doubles.initializeConsent).not.toHaveBeenCalled();
    expect(doubles.privateModule).not.toHaveBeenCalled();
  });

  it.each([
    ["/?invite=invitation", "/"],
    ["/fonctionnalites/?utm_source=discord#analyse", "/fonctionnalites"],
    ["/demo?utm_source=discord", "/demo"],
    ["/page-absente?invite=invitation", "/404"],
  ])("matches prerender before reconciling the real browser URL %s", (url, prerenderPath) => {
    setLocation(url);
    expect(renderToString(entry(prerenderPath))).toBe(render(prerenderPath));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("keeps the demo's real content, Suspense markers and accessible IDs in the initial tree", () => {
    setLocation("/demo");
    const html = render("/demo");
    const browserInitialHtml = renderToString(entry("/demo"));
    const searchId = html.match(/<label for="([^"]+)" class="ig-label">Rechercher une partie/)?.[1];
    expect(searchId).toBeTruthy();
    expect(html).toContain(`<input id="${searchId}"`);
    expect(browserInitialHtml).toContain(`<input id="${searchId}"`);
    expect(html).toContain("<!--$-->");
    expect(html).toContain("<!--/$-->");
    expect(html).toContain("<!-- -->");
    expect(html).toContain('data-match-id="demo-3"');
    expect(html).not.toContain("Chargement de la démo");
  });

  it("reconciles an invitation query after the initial home render without losing its return context", async () => {
    setLocation("/?invite=invitation");
    expect(renderToString(entry("/"))).toContain('id="home-title"');
    mount(entry("/"));
    await act(async () => {});
    expect(renderer.root.findByType("h1").children).toEqual(["Créer un compte"]);
    expect(renderer.root.findAllByType("a").some(node => node.props.href === "/connexion?invite=invitation")).toBe(true);
    expect(window.location.search).toBe("?invite=invitation");
    expect(doubles.privateModule).not.toHaveBeenCalled();
  });

  it("reconciles an unknown URL while keeping the 404 page and noindex metadata", () => {
    setLocation("/page-absente?utm_source=test");
    mount(entry("/404"));
    expect(renderer.root.findByType("h1").children).toEqual(["Page introuvable"]);
    expect(document.title).toContain("Page introuvable");
    expect(document.head.children.some(node => node.getAttribute("name") === "robots" && node.getAttribute("content") === "noindex, follow")).toBe(true);
    expect(window.location.pathname).toBe("/page-absente");
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(doubles.privateModule).not.toHaveBeenCalled();
  });

  it("waits for session verification before adding member links or consent initialization", async () => {
    setLocation("/fonctionnalites");
    mount(entry("/fonctionnalites"));
    expect(renderer.root.findAllByType("a").some(node => node.props.href === "/connexion")).toBe(true);
    expect(doubles.initializeConsent).not.toHaveBeenCalled();
    await session({ id: "member", email: "member@example.test", email_verified: true });
    expect(renderer.root.findAllByType("a").some(node => node.props.href === "/equipes")).toBe(true);
    expect(doubles.initializeConsent).toHaveBeenCalled();
    expect(doubles.privateModule).not.toHaveBeenCalled();
  });

  it("preserves the session loader and login redirect for private roots without prerender props", async () => {
    setLocation("/equipes?source=bookmark");
    mount(<App initialApp={AppRouter} />);
    expect(renderer.root.findAllByProps({ "data-loading": "session" })).toHaveLength(1);
    expect(doubles.privateModule).not.toHaveBeenCalled();
    await session(null);
    expect(window.location.pathname).toBe("/connexion");
    expect(new URLSearchParams(window.location.search).get("next")).toBe("/equipes?source=bookmark");
    expect(renderer.root.findAll(node => node.props["data-loading"])).toHaveLength(0);
    expect(renderer.root.findByType("h1").children).toEqual(["Connexion"]);
  });
});
