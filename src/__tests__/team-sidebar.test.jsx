import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import NXT5 from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { Sidebar, Topbar } from "../components/layout/AppChrome.jsx";
import { Button } from "../components/ui/Core.jsx";
import { Teams } from "../pages/workspace/Teams.jsx";
import { AccountSettings } from "../pages/workspace/AccountSettings.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), currentPerformanceMode: () => "full", setStoredPerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => null }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: () => null }));
vi.mock("../pages/GuidePage.jsx", () => ({ default: () => <section data-page="guide" /> }));
vi.mock("../pages/admin/AdminDashboard.jsx", () => ({ default: () => <section data-page="admin" /> }));
vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({ default: ({ phase }) => <section data-loader="true" data-phase={phase} /> }));
vi.mock("../pages/admin/AccessRequestsPage.jsx", () => ({ default: () => <section data-page="access-requests" /> }));

const user = { id: "u1", name: "Joueur", email: "player@example.test", email_verified: true };
const team = { id: "a", name: "Premiere equipe", tag: "ONE", owner_id: user.id };
const bootstrap = (withTeam = false) => ({
  ...DEFAULT_DATA,
  teams: withTeam ? [team] : [],
  teamMembers: withTeam ? [{ team_id: team.id, user_id: user.id, role: "owner" }] : [],
  selectedTeamId: withTeam ? team.id : null,
  pagination: { offset: 0, limit: 100, total: 0, hasMore: false, nextOffset: null },
});
let renderer;
const timers = new Set();
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  timers.forEach(clearTimeout);
  timers.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

async function open(path = "/equipes", pendingDeletionToken = null) {
  const listeners = new Map(), requests = [];
  const history = (_state, _title, path) => { window.location = new URL(path, window.location); };
  vi.stubGlobal("window", {
    location: new URL(path, "https://nxt5.test"),
    history: { pushState: history, replaceState: history },
    scrollTo: vi.fn(),
    setTimeout: (...args) => { const timer = setTimeout(...args); timers.add(timer); return timer; },
    clearTimeout,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: (event) => listeners.get(event.type)?.(event),
    localStorage: { getItem: () => "1", setItem: vi.fn() },
    sessionStorage: { getItem: () => pendingDeletionToken, removeItem: vi.fn() },
  });
  vi.stubGlobal("document", { title: "" });
  apiFetch.mockImplementation((path, options) => {
    if (["teams-create", "teams-join"].includes(path)) return Promise.resolve({ team });
    return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }));
  });
  await act(async () => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback={<p>Loading</p>}><NXT5 /></Suspense></AppLoadingProvider>); });
  return {
    requests,
    async resolve(index, payload) {
      expect(requests[index]).toBeDefined();
      await act(async () => requests[index].resolve(payload));
    },
    async reject(index, error) {
      expect(requests[index]).toBeDefined();
      await act(async () => requests[index].reject(error));
    },
  };
}

function expectNoTeamNavigation() {
  expect(renderer.root.findAllByType(Sidebar)).toHaveLength(0);
  expect(renderer.root.findAllByType(Topbar)).toHaveLength(0);
  expect(renderer.root.findAllByType("aside")).toHaveLength(0);
}
function click(label) {
  const button = renderer.root.findAllByType(Button).find((node) => node.props.children === label);
  expect(button).toBeDefined();
  return act(async () => button.props.onClick());
}

describe("team sidebar access", () => {
  it("opens settings for an unverified account before team bootstrap completes", async () => {
    const app = await open("/parametres");
    await app.resolve(0, { user: { ...user, email_verified: false } });
    expectNoTeamNavigation();
    expect(renderer.root.findAllByType(AccountSettings)).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
  });

  it("releases the loading overlay when recovering a completed deletion", async () => {
    const app = await open("/parametres", "a".repeat(43));
    expect(app.requests[0].path).toBe("auth-delete-account");
    await app.resolve(0, { ok: true, receipt: { reference: "receipt-123", completedAt: "2026-09-14T12:00:00Z", summary: {} } });
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("receipt-123");
    expect(app.requests).toHaveLength(1);
    expect(window.location.pathname).toBe("/connexion");
  });

  it("stays absent during session and initial team loading, including a failed bootstrap", async () => {
    const app = await open("/planning");
    expectNoTeamNavigation();
    expect(renderer.root.findByProps({ "data-loader": "true" }).props["data-phase"]).toBe("session");
    await app.resolve(0, { user });
    expectNoTeamNavigation();
    expect(renderer.root.findByProps({ "data-loader": "true" }).props["data-phase"]).toBe("bootstrap");
    await app.reject(1, new Error("Network unavailable"));
    expectNoTeamNavigation();
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Network unavailable");
  });

  it.each(["/equipes", "/planning", "/integration", "/statistiques", "/rapports", "/draft/pool", "/tendances", "/gestion-equipe", "/mon-profil"])("offers team creation and joining without team navigation on %s", async (path) => {
    const app = await open(path);
    await app.resolve(0, { user });
    await app.resolve(1, bootstrap());
    expectNoTeamNavigation();
    expect(renderer.root.findAllByType("form")).toHaveLength(2);
    expect(renderer.root.findByType(Teams).props.data.teams).toEqual([]);
  });

  it.each([
    ["/guide", "guide", false],
    ["/parametres", "account-settings", false],
  ])("keeps the standalone page %s usable without exposing the team sidebar", async (path, page, admin) => {
    const app = await open(path);
    await app.resolve(0, { user: { ...user, is_platform_admin: admin } });
    await app.resolve(1, bootstrap());
    expectNoTeamNavigation();
    if (page === "account-settings") expect(renderer.root.findAllByType(AccountSettings)).toHaveLength(1);
    else expect(renderer.root.findAllByProps({ "data-page": page })).toHaveLength(1);
    await click(page === "account-settings" ? "Retour aux équipes" : "Créer ou rejoindre une équipe");
    expectNoTeamNavigation();
    expect(renderer.root.findAllByType(Teams)).toHaveLength(1);
    expect(window.location.pathname).toBe("/equipes");
  });

  it.each([
    ["/admin", "admin"],
    ["/admin/demandes-acces", "access-requests"],
  ])("opens %s in the administrator shell and loads teams only after returning to the app", async (path, page) => {
    const app = await open(path);
    await app.resolve(0, { user: { ...user, is_platform_admin: true } });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(app.requests.map(request => request.path)).toEqual(["auth-me"]);
    expect(renderer.root.findAllByType(Sidebar)).toHaveLength(0);
    expect(renderer.root.findAllByType(Topbar)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ className: "administration-shell" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-page": page })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    const back = renderer.root.findAllByType("a").find(link => link.props.href === "/equipes");
    await act(async () => back.props.onClick({ button: 0, preventDefault() {} }));
    expect(window.location.pathname).toBe("/equipes");
    expect(app.requests[1].path).toContain("bootstrap?");
    expectNoTeamNavigation();
    await app.resolve(1, bootstrap());
    expectNoTeamNavigation();
    expect(renderer.root.findAllByType(Teams)).toHaveLength(1);
  });

  it.each(["create", "join"])("shows the sidebar only after %s has loaded the new team", async (action) => {
    const app = await open();
    await app.resolve(0, { user });
    await app.resolve(1, bootstrap());
    const input = (label, value) => act(() => renderer.root.findByProps({ label }).props.onChange(value));
    if (action === "create") {
      input("Nom de team", "Premiere equipe");
      input("Tag", "ONE");
    } else input("Code d’invitation", "NXT5-TEST");
    await act(async () => { void renderer.root.findAllByType("form")[action === "create" ? 0 : 1].props.onSubmit({ preventDefault() {} }); });
    expectNoTeamNavigation();
    await app.resolve(app.requests.length - 1, bootstrap(true));
    expect(renderer.root.findByType(Sidebar).props.currentTeam.id).toBe(team.id);
    expect(renderer.root.findByType(Sidebar).props.open).toBe(false);
    expect(renderer.root.findByType(Sidebar).findAllByType("aside")).toHaveLength(1);
  });

  it("clears the sidebar when deletion resets the selection and reloads memberships", async () => {
    const app = await open();
    await app.resolve(0, { user });
    await app.resolve(1, bootstrap(true));
    act(() => renderer.root.findByType(Topbar).props.setOpen(true));
    const { setSelectedTeamId, refreshAll } = renderer.root.findByType(Teams).props;
    act(() => { setSelectedTeamId(null); void refreshAll(); });
    expectNoTeamNavigation();
    expect(app.requests[2].options.signal.aborted).toBe(false);
    await app.resolve(2, bootstrap());
    expectNoTeamNavigation();
    expect(renderer.root.findByType(Teams).props.data.teams).toEqual([]);
    expect(renderer.root.findAllByType("form")).toHaveLength(2);
  });

  it("removes an open mobile sidebar when the last membership is revoked and keeps it closed after rejoining", async () => {
    const app = await open();
    await app.resolve(0, { user });
    await app.resolve(1, bootstrap(true));
    act(() => renderer.root.findByType(Topbar).props.setOpen(true));
    expect(renderer.root.findByType(Sidebar).props.open).toBe(true);
    act(() => { void renderer.root.findByType(Teams).props.refreshAll(); });
    await app.reject(2, Object.assign(new Error("Access revoked"), { status: 403 }));
    expectNoTeamNavigation();
    expect(new URL(app.requests[3].path, "https://nxt5.test").searchParams.has("teamId")).toBe(false);
    await app.resolve(3, bootstrap());
    expectNoTeamNavigation();
    act(() => renderer.root.findByProps({ label: "Code d’invitation" }).props.onChange("NXT5-TEST"));
    await act(async () => { void renderer.root.findAllByType("form")[1].props.onSubmit({ preventDefault() {} }); });
    await app.resolve(app.requests.length - 1, bootstrap(true));
    expect(renderer.root.findByType(Sidebar).props.open).toBe(false);
  });

  it("refuses to render a standalone sidebar without a team even for an administrator", () => {
    act(() => { renderer = TestRenderer.create(<Sidebar open isPlatformAdmin user={user} />); });
    expect(renderer.toJSON()).toBeNull();
  });
});
