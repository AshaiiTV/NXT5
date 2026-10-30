import { createSeoDocument } from "./helpers/seo-document.js";
import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppContent from "../AppRouter.jsx";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { useTeamData } from "../hooks/useTeamData.js";
import { BeginnerCompass, Sidebar } from "../components/layout/AppChrome.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: () => null }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: vi.fn() }));
vi.mock("../components/layout/AppChrome.jsx", () => ({
  AmbientBackground: () => null, Sidebar: () => <nav data-navigation="true" />,
  Topbar: () => <nav data-team-selector="true" />,
  BeginnerCompass: () => <aside data-compass="true" />, ApiBanner: () => null,
}));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => <aside data-assistant="true" /> }));
vi.mock("../pages/workspace/Teams.jsx", () => ({ Teams: ({ setupOnly = false }) => <section data-page="teams" data-setup-only={setupOnly} /> }));
vi.mock("../pages/workspace/DiscordWorkspace.jsx", () => ({ default: () => <section data-page="discord" /> }));
vi.mock("../pages/workspace/GameWorkspace.jsx", () => ({ GameWorkspace: () => <section data-page="games" /> }));
vi.mock("../pages/workspace/TrendsPage.jsx", () => ({ TrendsPage: () => <section data-page="trends" /> }));
vi.mock("../pages/workspace/Planning.jsx", () => ({ Planning: () => <section data-page="planning" /> }));
vi.mock("../pages/workspace/DraftWorkspace.jsx", () => ({ DraftWorkspace: () => <section data-page="draft" /> }));
vi.mock("../pages/workspace/PlayerUltimateProfile.jsx", () => ({ PlayerUltimateProfile: () => <section data-page="profile" /> }));
vi.mock("../pages/workspace/AccountSettings.jsx", () => ({ AccountSettings: () => <section data-page="settings" /> }));
vi.mock("../pages/GuidePage.jsx", () => ({ default: () => <section data-page="guide" /> }));
vi.mock("../pages/admin/AdminDashboard.jsx", () => ({ default: () => <section data-page="admin" /> }));
vi.mock("../pages/admin/AudiencePage.jsx", () => ({ default: () => <section data-page="audience" /> }));

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function open(path, { noTeam = false, admin = false, snapshot = {}, storage, userId = "user" } = {}) {
  const location = new URL(path, "https://nxt5.test");
  vi.stubGlobal("window", {
    location, history: { replaceState: vi.fn(), pushState: vi.fn() }, scrollTo: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), localStorage: storage || { getItem: vi.fn(), setItem: vi.fn() },
  });
  vi.stubGlobal("document", createSeoDocument());
  apiFetch.mockResolvedValue({ user: { id: userId, email: "user@example.test", email_verified: true, is_platform_admin: admin } });
  const selectedTeamId = noTeam ? null : snapshot.selectedTeamId || "team";
  useTeamData.mockReturnValue({
    data: { ...DEFAULT_DATA, selectedTeamId, teams: noTeam ? [] : [{ id: "team", name: "Équipe", owner_id: userId }], ...snapshot },
    selectedTeamId, setSelectedTeamId: vi.fn(), bootstrapReady: true, bootstrapped: true,
  });
  await act(async () => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback="loading"><AppContent /></Suspense></AppLoadingProvider>); });
  await act(async () => { await vi.dynamicImportSettled(); });
  return renderer;
}

const tools = [
  ["/bot-discord", "discord"],
  ["/equipes", "teams"], ["/gestion-equipe", "teams"], ["/games", "games"], ["/rapports", "games"],
  ["/tendances", "trends"], ["/planning", "planning"], ["/draft/pool", "draft"],
  ["/draft/compositions", "draft"], ["/mon-profil", "profile"],
];

describe("free workspace access", () => {
  it("passes the selected non-default team to sidebar links independently of the linked URL", async () => {
    const teams = [{ id: "first-team" }, { id: "second-team" }, { id: "third-team" }];
    await open("/games?team=first-team", { snapshot: { teams, selectedTeamId: "second-team" } });
    expect(renderer.root.findByType(Sidebar).props.currentTeamId).toBe("second-team");
    expect(window.location.search).toBe("?team=first-team");
  });

  it("keeps the Discord onboarding accessible without a team and omits the generic guide", async () => {
    await open("/bot-discord", { noTeam: true });
    expect(renderer.root.findAllByProps({ "data-page": "discord" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-compass": "true" })).toHaveLength(0);
    act(() => renderer.unmount());
    await open("/bot-discord");
    expect(renderer.root.findAllByProps({ "data-compass": "true" })).toHaveLength(0);
  });
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

