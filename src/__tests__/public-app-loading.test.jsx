import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AppRouter from "../AppRouter.jsx";
import { AppLoadingProvider, useAppLoading } from "../components/loading/AppLoadingProvider.jsx";
import { apiFetch } from "../api/client.js";
import { createSeoDocument } from "./helpers/seo-document.js";

const modules = vi.hoisted(() => ({ workspace: vi.fn(), demo: vi.fn(), consentMounts: 0, pendingWorkspace: null }));
vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({ default: ({ phase }) => <aside data-loading={phase} /> }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: function Consent({ route, ready, excluded }) {
  const [identity] = useState(() => ++modules.consentMounts);
  return <aside data-consent={identity} data-path={route.path} data-ready={ready} data-excluded={excluded} />;
} }));
vi.mock("../AppContent.jsx", async () => {
  modules.workspace();
  await modules.pendingWorkspace;
  return { default: function Workspace({ route, navigate, user }) {
    useAppLoading(null);
    return <Page page="workspace" navigate={navigate} user={user} path={route.path} />;
  } };
});
vi.mock("../pages/public/DemoPage.jsx", () => {
  modules.demo();
  return { DemoPage: props => <Page {...props} page="demo" /> };
});
vi.mock("../pages/public/PublicPages.jsx", () => ({
  HomeScreen: props => <Page {...props} page="home" />,
  AuthPage: props => <Page {...props} page="auth" />,
  LegalPage: props => <Page {...props} page="legal" />,
  ForgotPasswordPage: props => <Page {...props} page="forgot" />,
  ResetPasswordPage: props => <Page {...props} page="reset" />,
  NotFoundPage: props => <Page {...props} page="not-found" />,
  SiteHeader: () => null,
  LEGAL_PAGES: { "/confidentialite": {} },
}));
vi.mock("../pages/public/FeaturesPage.jsx", () => ({ FeaturesPage: props => <Page {...props} page="features" /> }));
vi.mock("../pages/public/PublicGuides.jsx", () => ({
  PUBLIC_GUIDES: { "/guides/importer-premier-scrim": {} },
  PublicGuidePage: props => <Page {...props} page="guide" />,
}));
vi.mock("../pages/public/SocialPage.jsx", () => ({ default: props => <Page {...props} page="social" /> }));
vi.mock("../pages/public/SupportPage.jsx", () => ({ SupportPage: props => <Page {...props} page="support" /> }));

function Page({ page, path, navigate, user, onAuth }) {
  return <main data-page={page} data-user={user?.id || "anonymous"} data-path={path}>
    <h1>{page}</h1>
    {["/", "/fonctionnalites", "/demo", "/equipes", "/admin", "/connexion"].map(target => <button key={target} data-target={target} onClick={() => navigate(target)}>{target}</button>)}
    {onAuth && <button data-login onClick={() => onAuth(account)}>Connexion</button>}
  </main>;
}

const account = { id: "user", email: "user@example.test", email_verified: true };
let renderer;
let resolveSession;
const settleModules = async () => {
  await act(async () => { await vi.dynamicImportSettled(); });
  await act(async () => { await vi.dynamicImportSettled(); });
};

beforeEach(() => {
  modules.consentMounts = 0;
  const listeners = new Map();
  const entries = [];
  let position = -1;
  const setLocation = path => { window.location = new URL(path, "https://nxt5.org"); };
  vi.stubGlobal("window", {
    location: new URL("https://nxt5.org/"),
    history: {
      pushState: vi.fn((_state, _title, path) => { setLocation(path); entries.splice(++position, Infinity, path); }),
      replaceState: vi.fn((_state, _title, path) => { setLocation(path); entries[Math.max(position, 0)] = path; }),
      back: () => { if (position > 0) { setLocation(entries[--position]); listeners.get("popstate")?.forEach(callback => callback()); } },
    },
    addEventListener: (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener: (name, callback) => listeners.get(name)?.delete(callback),
    scrollTo: vi.fn(), setTimeout, clearTimeout, localStorage: { getItem: vi.fn() },
  });
  vi.stubGlobal("document", createSeoDocument());
  apiFetch.mockImplementation(endpoint => {
    if (endpoint !== "auth-me") throw new Error(`Unexpected request: ${endpoint}`);
    return new Promise(resolve => { resolveSession = resolve; });
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function mount(path) {
  window.history.pushState({}, "", path);
  act(() => { renderer = TestRenderer.create(<AppLoadingProvider><AppRouter /></AppLoadingProvider>); });
}
async function authenticate(user) {
  await act(async () => resolveSession({ user }));
  await settleModules();
}
const page = () => renderer.root.findByType("main");
const consent = () => renderer.root.findAllByType("aside").find(node => node.props["data-consent"]);
const navigate = path => act(() => renderer.root.findByProps({ "data-target": path }).props.onClick());

it("keeps public visits, session-aware links and consent outside the workspace and demo module graphs", async () => {
  // This assertion observes evaluation of the lazy module factories, rather
  // than merely checking that a workspace component was not rendered.
  for (const [path, expected] of [["/", "home"], ["/connexion", "auth"], ["/fonctionnalites", "features"], ["/guides/importer-premier-scrim", "guide"], ["/confidentialite", "legal"], ["/reseaux", "social"], ["/soutenir", "support"], ["/inconnue", "not-found"]]) {
    mount(path);
    expect(page().props["data-page"]).toBe(expected);
    expect(consent().props["data-ready"]).toBe(false);
    await authenticate(path === "/" || path === "/connexion" ? null : account);
    expect(page().props["data-page"]).toBe(expected);
    if (!["/", "/connexion", "/inconnue"].includes(path)) expect(page().props["data-user"]).toBe(account.id);
    expect(consent().props["data-ready"]).toBe(true);
    expect(consent().props["data-excluded"]).toBe(false);
    expect(renderer.root.findAll(node => node.props["data-loading"])).toHaveLength(0);
    act(() => renderer.unmount()); renderer = undefined;
  }
  expect(modules.workspace).not.toHaveBeenCalled();
  expect(modules.demo).not.toHaveBeenCalled();
});

it("loads the demo only on navigation, and preserves the consent instance and metadata on browser back", async () => {
  mount("/fonctionnalites");
  await authenticate(null);
  const identity = consent().props["data-consent"];
  navigate("/demo");
  await settleModules();
  expect(modules.demo).toHaveBeenCalledOnce();
  expect(page().props["data-page"]).toBe("demo");
  expect(document.title).toContain("Démonstration");
  expect(consent().props).toMatchObject({ "data-consent": identity, "data-path": "/demo", "data-ready": true });
  act(() => window.history.back());
  expect(page().props["data-page"]).toBe("features");
  expect(document.title).toContain("Outils d’analyse");
  expect(consent().props["data-consent"]).toBe(identity);
  expect(modules.consentMounts).toBe(1);
  expect(apiFetch).toHaveBeenCalledExactlyOnceWith("auth-me");
  expect(modules.workspace).not.toHaveBeenCalled();
});

it("retains session, consent and the shared loader while downloading the private administrator module", async () => {
  mount("/fonctionnalites");
  await authenticate({ ...account, is_platform_admin: true });
  const identity = consent().props["data-consent"];
  let releaseWorkspace;
  modules.pendingWorkspace = new Promise(resolve => { releaseWorkspace = resolve; });
  navigate("/admin");
  await act(async () => { await Promise.resolve(); });
  expect(renderer.root.findAllByProps({ "data-loading": "app" })).toHaveLength(1);
  await act(async () => releaseWorkspace());
  await settleModules();
  expect(modules.workspace).toHaveBeenCalledOnce();
  expect(renderer.root.findAllByProps({ "data-loading": "app" })).toHaveLength(0);
  expect(page().props).toMatchObject({ "data-page": "workspace", "data-user": account.id, "data-path": "/admin" });
  expect(consent().props).toMatchObject({ "data-consent": identity, "data-path": "/admin" });
  act(() => window.history.back());
  expect(page().props["data-page"]).toBe("features");
  expect(consent().props["data-consent"]).toBe(identity);
  expect(apiFetch).toHaveBeenCalledExactlyOnceWith("auth-me");
});

it("preserves the signed-in home redirect and excludes administrator visits from audience collection", async () => {
  mount("/");
  await authenticate({ ...account, is_platform_admin: true });
  expect(window.location.pathname).toBe("/accueil");
  expect(window.history.replaceState).toHaveBeenCalledWith({}, "", "/accueil");
  expect(page().props["data-page"]).toBe("workspace");
  expect(consent().props["data-excluded"]).toBe(true);
});

it("keeps an anonymous invitation on the registration path without loading business data", async () => {
  mount("/equipes?invite=invitation");
  await authenticate(null);
  expect(window.location.pathname).toBe("/creer-un-compte");
  expect(window.location.search).toBe("?invite=invitation");
  expect(page().props["data-page"]).toBe("auth");
  expect(apiFetch).toHaveBeenCalledExactlyOnceWith("auth-me");
});
