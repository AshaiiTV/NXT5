import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import NXT5 from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { ADMIN_GROUPS, ADMIN_PAGES, adminPageFromRoute } from "../app/admin-navigation.js";
import { isAdminPath, isAppPath, isKnownPath } from "../app/routing.js";
import { Sidebar, Topbar } from "../components/layout/AppChrome.jsx";
import { Button } from "../components/ui/Core.jsx";
import { useTeamData } from "../hooks/useTeamData.js";
import { PurchaseOverview } from "../pages/admin/Purchases.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { useAdminNavigationGuard } from "../components/admin/AdminNavigationContext.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => null }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: () => null }));
vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({ default: ({ phase }) => <section data-loader="true" data-phase={phase} /> }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: vi.fn(() => { throw new Error("An administrator page must not bootstrap a team."); }) }));
vi.mock("../pages/admin/AdminDashboard.jsx", () => ({ default: ({ view, teamFilter, onNavigate }) => <section data-admin-view={view} data-team-filter={teamFilter}>{view === "overview" && <button onClick={() => onNavigate("/admin/equipes?filtre=never")}>Voir les équipes sans import</button>}</section> }));
vi.mock("../pages/admin/AudiencePage.jsx", () => ({ default: () => <section data-admin-view="audience" /> }));
vi.mock("../pages/admin/BotAnalyticsPage.jsx", () => ({ default: () => <section data-admin-view="bot" /> }));
vi.mock("../pages/admin/AccessRequestsPage.jsx", () => ({ default: ({ embedded }) => <section data-admin-view="requests" data-embedded={embedded} /> }));
vi.mock("../pages/admin/AccountSubscriptionsPage.jsx", () => ({ default: function SubscriptionsForm({ embedded, initialUserId, navigate }) {
  const [dirty, setDirty] = React.useState(false);
  const [disabled, setDisabled] = React.useState(false);
  useAdminNavigationGuard({ dirty, disabled });
  return <section data-admin-view="subscriptions" data-embedded={embedded} data-selected-user={initialUserId}>
    <input type="checkbox" aria-label="Formulaire modifié" checked={dirty} onChange={event => setDirty(event.target.checked)} />
    <input type="checkbox" aria-label="Enregistrement en cours" checked={disabled} onChange={event => setDisabled(event.target.checked)} />
    <button type="button" onClick={() => navigate("/admin/tarifs")}>Voir les offres</button>
  </section>;
} }));
vi.mock("../pages/public/PricingPage.jsx", () => ({ default: ({ embedded }) => <section data-admin-view="pricing" data-embedded={embedded} /> }));
vi.mock("../pages/admin/IntegrationsPage.jsx", () => ({ default: () => <section data-admin-view="integrations" />, LegalReadinessPage: () => <section data-admin-view="launch" /> }));

const admin = { id: "admin", name: "Administrateur", email: "admin@example.test", email_verified: true, is_platform_admin: true };
// These public addresses are the navigation contract, independent of the menu implementation.
const routes = [
  ["/admin", "overview"],
  ["/admin/equipes", "teams"],
  ["/admin/usage", "usage"],
  ["/admin/frequentation", "audience"],
  ["/admin/bot-discord", "bot"],
  ["/admin/achats", "purchases"],
  ["/admin/demandes-acces", "requests"],
  ["/admin/abonnements", "subscriptions"],
  ["/admin/tarifs", "pricing"],
  ["/admin/preparer-vente", "launch"],
  ["/admin/rappels", "reminders"],
  ["/admin/integrations", "integrations"],
];
let renderer;
const timers = new Set();
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  timers.forEach(clearTimeout);
  timers.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function open(path, account = admin, pending = false) {
  const listeners = new Map();
  const stack = [new URL(path, "https://nxt5.test").href];
  let position = 0;
  const setLocation = path => { window.location = new URL(path, window.location); };
  vi.stubGlobal("window", {
    location: new URL(stack[0]),
    history: {
      pushState: vi.fn((_state, _title, path) => { setLocation(path); stack.splice(position + 1, Infinity, window.location.href); position += 1; }),
      replaceState: vi.fn((_state, _title, path) => { setLocation(path); stack[position] = window.location.href; }),
      back: () => { if (position > 0) { position -= 1; setLocation(stack[position]); window.dispatchEvent({ type: "popstate" }); } },
      forward: () => { if (position + 1 < stack.length) { position += 1; setLocation(stack[position]); window.dispatchEvent({ type: "popstate" }); } },
    },
    addEventListener: (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener: (name, callback) => listeners.get(name)?.delete(callback),
    dispatchEvent: event => listeners.get(event.type)?.forEach(callback => callback(event)),
    scrollTo: vi.fn(),
    setTimeout: (...args) => { const timer = setTimeout(...args); timers.add(timer); return timer; },
    clearTimeout,
    localStorage: { getItem: vi.fn() },
    sessionStorage: { getItem: vi.fn() },
  });
  vi.stubGlobal("document", { title: "" });
  apiFetch.mockImplementation(endpoint => {
    if (endpoint === "auth-me") return pending ? new Promise(() => {}) : Promise.resolve({ user: account });
    if (endpoint === "admin-purchases?view=overview") return Promise.resolve({ totals: { orders: 0, paid: 0, paidCents: 0, pending: 0, averageCents: 0, frequency30d: 0, paid30d: 0, cancelled: 0, refunded: 0 }, monthly: [], generatedAt: "2026-09-14T12:00:00Z" });
    if (endpoint === "admin-purchases?page=1&pageSize=10") return Promise.resolve({ purchases: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
    return Promise.reject(new Error(`Unexpected request: ${endpoint}`));
  });
  await act(async () => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback={<p>Chargement</p>}><NXT5 /></Suspense></AppLoadingProvider>); });
  await act(async () => { await vi.dynamicImportSettled(); });
}

function selectedView(id) {
  const views = renderer.root.findAll(node => typeof node.type === "string" && (Boolean(node.props["data-admin-view"]) || node.props.className === "administration-purchases"));
  expect(views.map(node => node.props["data-admin-view"] || "purchases")).toEqual([id]);
  expect(renderer.root.findAllByProps({ role: "tablist" })).toHaveLength(0);
  expect(renderer.root.findAllByType(Sidebar)).toHaveLength(0);
  expect(renderer.root.findAllByType(Topbar)).toHaveLength(0);
  expect(useTeamData).not.toHaveBeenCalled();
  expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
  const current = renderer.root.findByProps({ "aria-current": "page" });
  const page = ADMIN_PAGES.find(page => page.id === id);
  expect(current.props.href).toBe(page.path);
  expect(renderer.root.findByProps({ id: "administration-content" }).props["aria-label"]).toBe(page.label);
  expect(document.title).toBe(`${page.label} · Administration — NXT5`);
  expect(renderer.root.findByProps({ className: "administration-mobile-menu" }).findByType("select").props.value).toBe(page.path);
}

async function follow(path, modifiers = {}) {
  const link = renderer.root.findByProps({ "aria-label": "Rubriques de l’administration" }).findAllByType("a").find(node => node.props.href === path);
  const event = { button: 0, preventDefault: vi.fn(), ...modifiers };
  await act(async () => link.props.onClick(event));
  await act(async () => { await vi.dynamicImportSettled(); });
  return event;
}

async function setFormState(label, checked = true) {
  await act(async () => renderer.root.findByProps({ "aria-label": label }).props.onChange({ target: { checked } }));
}

async function clickButton(label) {
  const button = renderer.root.findAllByType(Button).find(node => node.props.children === label);
  expect(button, label).toBeTruthy();
  await act(async () => button.props.onClick());
  await act(async () => { await vi.dynamicImportSettled(); });
}

const guardedDepartures = [
  ["desktop menu", () => follow("/admin/tarifs")],
  ["mobile selector", () => act(async () => renderer.root.findByProps({ "aria-label": "Rubrique" }).props.onChange({ target: { value: "/admin/tarifs" } }))],
  ["page action", () => act(async () => renderer.root.findByProps({ "data-admin-view": "subscriptions" }).findByType("button").props.onClick())],
];

describe("administration route contract", () => {
  it("recognizes each route and groups every destination exactly once", () => {
    expect(ADMIN_GROUPS.map(group => group.label)).toEqual(["Pilotage", "Ventes et accès", "Configuration"]);
    expect(ADMIN_PAGES.map(page => [page.path, page.id])).toEqual(routes);
    for (const [path, id] of routes) {
      expect(adminPageFromRoute({ path: `${path}/` })?.id).toBe(id);
      expect(isKnownPath(`${path}/`)).toBe(true);
      expect(isAppPath(path)).toBe(true);
      expect(isAdminPath(path)).toBe(true);
    }
    expect(adminPageFromRoute({ path: "/admin/inconnue" })).toBeUndefined();
    expect(isKnownPath("/admin/inconnue")).toBe(false);
  });

  it.each(routes)("opens %s as the sole active page without requesting team data", async (path, id) => {
    await open(path);
    selectedView(id);
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint).sort()).toEqual((id === "purchases" ? ["auth-me", "admin-purchases?page=1&pageSize=10"] : ["auth-me"]).sort());
    if (["requests", "subscriptions", "pricing"].includes(id)) expect(renderer.root.findByProps({ "data-admin-view": id }).props["data-embedded"]).toBe(true);
    expect(renderer.root.findAllByType(PurchaseOverview)).toHaveLength(0);
  });

  it("loads the purchase summary only when it is opened and keeps it in the purchases page", async () => {
    await open("/admin/achats");
    expect(apiFetch.mock.calls.some(([endpoint]) => endpoint === "admin-purchases?view=overview")).toBe(false);
    const summary = renderer.root.findByProps({ className: "administration-purchase-summary" });
    await act(async () => summary.props.onToggle({ currentTarget: { open: true } }));
    await act(async () => { await vi.dynamicImportSettled(); });
    selectedView("purchases");
    expect(renderer.root.findAllByType(PurchaseOverview)).toHaveLength(1);
    expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === "admin-purchases?view=overview")).toHaveLength(1);
    await act(async () => summary.props.onToggle({ currentTarget: { open: false } }));
    await act(async () => summary.props.onToggle({ currentTarget: { open: true } }));
    expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === "admin-purchases?view=overview")).toHaveLength(1);
  });

  it("retains the selected account from a direct subscriptions link", async () => {
    await open("/admin/abonnements?userId=selected-account");
    selectedView("subscriptions");
    expect(renderer.root.findByProps({ "data-admin-view": "subscriptions" }).props["data-selected-user"]).toBe("selected-account");
  });

  it.each([
    ["/admin?tab=achats", "purchases"],
    ["/admin?tab=vue-ensemble", "overview"],
    ["/tarifs", "pricing"],
  ])("keeps bookmarked %s usable with its canonical menu entry", async (path, id) => {
    await open(path);
    selectedView(id);
  });

  it("updates menu, title and content through links and browser back/forward", async () => {
    await open("/admin");
    const event = await follow("/admin/achats");
    expect(event.preventDefault).toHaveBeenCalledOnce();
    selectedView("purchases");
    await follow("/admin/frequentation");
    selectedView("audience");
    await act(async () => window.history.back());
    selectedView("purchases");
    await act(async () => window.history.back());
    selectedView("overview");
    await act(async () => window.history.forward());
    selectedView("purchases");
    expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === "auth-me")).toHaveLength(1);
  });

  it("passes direct team filters and supports the mobile menu", async () => {
    await open("/admin");
    await act(async () => renderer.root.findByProps({ "data-admin-view": "overview" }).findByType("button").props.onClick());
    selectedView("teams");
    expect(renderer.root.findByProps({ "data-admin-view": "teams" }).props["data-team-filter"]).toBe("never");
    expect(window.location.search).toBe("?filtre=never");
    await act(async () => renderer.root.findByType("select").props.onChange({ target: { value: "/admin/rappels" } }));
    selectedView("reminders");
    await act(async () => window.history.back());
    selectedView("teams");
    expect(renderer.root.findByProps({ "data-admin-view": "teams" }).props["data-team-filter"]).toBe("never");
  });

  it("preserves modified links for opening a destination in another tab", async () => {
    await open("/admin");
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
      const event = await follow("/admin/achats", modifiers);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(window.history.pushState).not.toHaveBeenCalled();
    selectedView("overview");
  });
});

describe("administration editor navigation", () => {
  it.each(guardedDepartures)("keeps a dirty form until departure through the %s is confirmed", async (_label, depart) => {
    await open("/admin/abonnements?userId=selected-account");
    await setFormState("Formulaire modifié");
    await depart();
    selectedView("subscriptions");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    expect(window.history.pushState).not.toHaveBeenCalled();
    await clickButton("Rester sur cette page");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    expect(renderer.root.findByProps({ "aria-label": "Formulaire modifié" }).props.checked).toBe(true);
    await depart();
    await clickButton("Quitter sans enregistrer");
    selectedView("pricing");
    expect(window.location.pathname).toBe("/admin/tarifs");
  });

  it("protects returning to the app and restores the initiating focus when staying", async () => {
    await open("/admin/abonnements");
    await setFormState("Formulaire modifié");
    const focus = vi.fn();
    document.activeElement = { focus };
    const back = renderer.root.findAllByType("a").find(node => node.props.href === "/equipes");
    await act(async () => back.props.onClick({ button: 0, preventDefault() {} }));
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    expect(window.history.pushState).not.toHaveBeenCalled();
    await clickButton("Rester sur cette page");
    selectedView("subscriptions");
    expect(focus).toHaveBeenCalledOnce();
  });

  it.each(guardedDepartures)("blocks the %s while an editor is saving", async (_label, depart) => {
    await open("/admin/abonnements");
    await setFormState("Formulaire modifié");
    await setFormState("Enregistrement en cours");
    expect(renderer.root.findByProps({ "aria-label": "Rubrique" }).props.disabled).toBe(true);
    await depart();
    selectedView("subscriptions");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it("blocks an open leave confirmation if saving starts and clears it after the form is saved", async () => {
    await open("/admin/abonnements");
    await setFormState("Formulaire modifié");
    await follow("/admin/tarifs");
    await setFormState("Enregistrement en cours");
    const leave = renderer.root.findAllByType(Button).find(node => node.props.children === "Quitter sans enregistrer");
    expect(leave.props.disabled).toBe(true);
    await clickButton("Quitter sans enregistrer");
    selectedView("subscriptions");
    expect(window.history.pushState).not.toHaveBeenCalled();
    await setFormState("Formulaire modifié", false);
    await setFormState("Enregistrement en cours", false);
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    await follow("/admin/tarifs");
    selectedView("pricing");
  });

  it("requires confirmation before logging out of a dirty editor and blocks logout while saving", async () => {
    await open("/admin/abonnements");
    await setFormState("Formulaire modifié");
    await setFormState("Enregistrement en cours");
    const logout = renderer.root.findAllByType(Button).find(node => node.props.children === "Déconnexion");
    expect(logout.props.disabled).toBe(true);
    await clickButton("Déconnexion");
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    await setFormState("Enregistrement en cours", false);
    await clickButton("Déconnexion");
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);
    await clickButton("Rester sur cette page");
    selectedView("subscriptions");
    await clickButton("Déconnexion");
    apiFetch.mockResolvedValueOnce({ ok: true });
    await clickButton("Quitter sans enregistrer");
    expect(apiFetch).toHaveBeenLastCalledWith("auth-logout", { method: "POST" });
    expect(window.location.pathname).toBe("/connexion");
  });
});

describe("administration access boundary", () => {
  it.each(routes)("keeps %s hidden while authentication is pending", async path => {
    await open(path, admin, true);
    expect(renderer.root.findAllByProps({ className: "administration-shell" })).toHaveLength(0);
    expect(renderer.root.findByProps({ "data-loader": "true" }).props["data-phase"]).toBe("session");
    expect(useTeamData).not.toHaveBeenCalled();
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);
  });

  it.each(routes)("rejects an ordinary account on %s without loading team data", async path => {
    await open(path, { ...admin, is_platform_admin: false });
    expect(renderer.root.findAllByProps({ className: "administration-shell" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("introuvable");
    expect(useTeamData).not.toHaveBeenCalled();
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);
  });

  it.each(["true", 1, null, undefined])("does not accept administrator flag %j", async is_platform_admin => {
    await open("/admin", { ...admin, is_platform_admin });
    expect(renderer.root.findAllByProps({ className: "administration-shell" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("introuvable");
    expect(useTeamData).not.toHaveBeenCalled();
  });

  it("sends anonymous visitors to sign-in with the requested team filter intact", async () => {
    await open("/admin/equipes?filtre=never", null);
    expect(renderer.root.findAllByProps({ className: "administration-shell" })).toHaveLength(0);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", "/connexion?next=%2Fadmin%2Fequipes%3Ffiltre%3Dnever");
    expect(useTeamData).not.toHaveBeenCalled();
  });

  it("waits for the server to close the session before leaving administration", async () => {
    await open("/admin");
    let resolveLogout;
    apiFetch.mockReturnValueOnce(new Promise(resolve => { resolveLogout = resolve; }));
    const logout = renderer.root.findAllByType(Button).find(node => node.props.children === "Déconnexion");
    await act(async () => { void logout.props.onClick(); });
    expect(apiFetch).toHaveBeenLastCalledWith("auth-logout", { method: "POST" });
    selectedView("overview");
    await act(async () => resolveLogout({ ok: true }));
    expect(window.location.pathname).toBe("/connexion");
    expect(renderer.root.findAllByProps({ className: "administration-shell" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Tu es bien déconnecté.");
  });

  it("keeps administration available if the server cannot close the session", async () => {
    await open("/admin");
    apiFetch.mockRejectedValueOnce(new Error("Connexion interrompue"));
    const logout = renderer.root.findAllByType(Button).find(node => node.props.children === "Déconnexion");
    await act(async () => logout.props.onClick());
    selectedView("overview");
    expect(window.location.pathname).toBe("/admin");
    expect(JSON.stringify(renderer.toJSON())).toContain("Déconnexion impossible");
  });
});
