import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppContent from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { useTeamData } from "../hooks/useTeamData.js";

const simulation = vi.hoisted(() => ({ expired: false }));
vi.mock("../app/pass-access.js", async (importOriginal) => {
  const actual = await importOriginal();
  const access = (...args) => simulation.expired ? actual.getPlannedPassFeatureAccess(...args) : actual.getPassFeatureAccess(...args);
  return { ...actual, getPassFeatureAccess: access, isPassFeatureLocked: (...args) => !access(...args).allowed };
});
vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: vi.fn() }));
vi.mock("../components/layout/AppChrome.jsx", () => ({
  AmbientBackground: () => null, Sidebar: () => <nav data-navigation="true" />,
  Topbar: () => <nav data-team-selector="true" />,
  BeginnerCompass: () => <aside data-compass="true" />, ApiBanner: () => null,
}));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => <aside data-assistant="true" /> }));
vi.mock("../pages/workspace/Teams.jsx", () => ({ Teams: ({ setupOnly = false }) => <section data-page="teams" data-setup-only={setupOnly} /> }));
vi.mock("../pages/workspace/GameWorkspace.jsx", () => ({ GameWorkspace: () => <section data-page="games" /> }));
vi.mock("../pages/workspace/TrendsPage.jsx", () => ({ TrendsPage: () => <section data-page="trends" /> }));
vi.mock("../pages/workspace/Planning.jsx", () => ({ Planning: () => <section data-page="planning" /> }));
vi.mock("../pages/workspace/DraftWorkspace.jsx", () => ({ DraftWorkspace: () => <section data-page="draft" /> }));
vi.mock("../pages/workspace/PlayerUltimateProfile.jsx", () => ({ PlayerUltimateProfile: () => <section data-page="profile" /> }));
vi.mock("../pages/workspace/AccountSettings.jsx", () => ({ AccountSettings: () => <section data-page="settings" /> }));
vi.mock("../pages/GuidePage.jsx", () => ({ default: () => <section data-page="guide" /> }));
vi.mock("../pages/admin/AdminDashboard.jsx", () => ({ default: () => <section data-page="admin" /> }));
vi.mock("../pages/admin/AccountSubscriptionsPage.jsx", () => ({ default: () => <section data-page="billing" /> }));

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  simulation.expired = false;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function open(path, { noTeam = false, admin = false } = {}) {
  const location = new URL(path, "https://nxt5.test");
  vi.stubGlobal("window", {
    location, history: { replaceState: vi.fn(), pushState: vi.fn() }, scrollTo: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), localStorage: { getItem: vi.fn() },
  });
  vi.stubGlobal("document", { title: "" });
  apiFetch.mockResolvedValue({ user: { id: "user", email: "user@example.test", email_verified: true, is_platform_admin: admin, subscription: { status: "active" } } });
  const selectedTeamId = noTeam ? null : "team";
  useTeamData.mockReturnValue({
    data: { ...DEFAULT_DATA, selectedTeamId, teams: noTeam ? [] : [{ id: "team", name: "Équipe" }] },
    selectedTeamId, setSelectedTeamId: vi.fn(), bootstrapReady: true, bootstrapped: true,
  });
  await act(async () => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback="loading"><AppContent /></Suspense></AppLoadingProvider>); });
  return renderer;
}

const tools = [
  ["/equipes", "teams"], ["/gestion-equipe", "teams"], ["/games", "games"], ["/rapports", "games"],
  ["/tendances", "trends"], ["/planning", "planning"], ["/draft/pool", "draft"],
  ["/draft/compositions", "draft"], ["/mon-profil", "profile"],
];

describe("workspace access before the subscription launch", () => {
  it.each(tools)("keeps %s and the assistant fully available without team entitlements", async (path, page) => {
    await open(path);
    expect(renderer.root.findAllByProps({ "data-page": page })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-assistant": "true" })).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Prendre le Pass Équipe");
  });

  it("keeps the existing combined setup and roster page before launch", async () => {
    await open("/equipes?create=1");
    expect(renderer.root.findByProps({ "data-page": "teams" }).props["data-setup-only"]).toBe(false);
  });
});

describe("future expiration routing, simulated only in tests", () => {
  it.each(tools)("replaces %s before mounting its tools and hides the assistant", async (path, page) => {
    simulation.expired = true;
    await open(path);
    expect(renderer.root.findAllByProps({ "data-page": page })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-assistant": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-compass": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-team-selector": "true" })).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain("Prendre le Pass Équipe");
  });

  it.each([["/parametres", "settings", false], ["/guide", "guide", false], ["/admin", "admin", true], ["/admin/abonnements", "billing", true]])("keeps %s accessible", async (path, page, admin) => {
    simulation.expired = true;
    await open(path, { admin });
    expect(renderer.root.findAllByProps({ "data-page": page })).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Prendre le Pass Équipe");
  });

  it.each(["/equipes?create=1", "/equipes?invite=team-code"])("keeps %s as setup only for an existing team", async (path) => {
    simulation.expired = true;
    await open(path);
    expect(renderer.root.findByProps({ "data-page": "teams" }).props["data-setup-only"]).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Prendre le Pass Équipe");
  });

  it("keeps onboarding available when no team exists", async () => {
    simulation.expired = true;
    await open("/equipes", { noTeam: true });
    expect(renderer.root.findAllByProps({ "data-page": "teams" })).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Prendre le Pass Équipe");
  });
});
