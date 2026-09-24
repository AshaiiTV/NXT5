import { createSeoDocument } from "./helpers/seo-document.js";
import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import NXT5 from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { isAdminPath, isAppPath, isKnownPath, pageFromPath, pathFromPage } from "../app/routing.js";
import { HomeScreen, LegalLinks } from "../pages/public/PublicPages.jsx";
import { DEFAULT_DATA, PUBLIC_ROUTES } from "../app/constants.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { useTeamData } from "../hooks/useTeamData.js";
import { Button } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: () => null }));
vi.mock("../pages/public/PricingPage.jsx", () => ({ default: ({ user }) => <main data-pricing="true">Tarifs {user?.name || "visiteur"}</main> }));
vi.mock("../pages/admin/AudiencePage.jsx", () => ({ default: () => <section data-audience="true">Fréquentation du site</section> }));
vi.mock("../pages/admin/AccessRequestsPage.jsx", () => ({ default: () => <section data-leads="true">Demandes d’accès</section> }));
vi.mock("../pages/admin/AccountSubscriptionsPage.jsx", () => ({ default: ({ initialUserId }) => <section data-subscriptions="true" data-selected-user={initialUserId}>Profils et abonnements</section> }));
vi.mock("../pages/workspace/AccountSettings.jsx", () => ({ AccountSettings: () => <section data-account-settings="true">Paramètres du compte</section> }));
vi.mock("../pages/workspace/Teams.jsx", () => ({ Teams: () => <section data-team-access="true">Rejoindre une équipe</section> }));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => null }));
vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({ default: ({ phase }) => <section data-loader="true" data-phase={phase} /> }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: vi.fn(() => ({ data: DEFAULT_DATA, bootstrapped: true, bootstrapReady: true })) }));

const admin = { id: "admin", name: "Administrateur", email: "admin@example.test", email_verified: true, is_platform_admin: true };
const restrictedPaths = ["/tarifs", "/admin/demandes-acces", "/admin/abonnements", "/admin/frequentation"];

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.clearAllMocks();
  useTeamData.mockImplementation(() => ({ data: DEFAULT_DATA, bootstrapped: true, bootstrapReady: true }));
  vi.unstubAllGlobals();
});

async function open(path) {
  const location = new URL(path, "https://nxt5.test");
  vi.stubGlobal("window", {
    location, history: { replaceState: vi.fn(), pushState: vi.fn() },
    scrollTo: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    localStorage: { getItem: vi.fn() },
  });
  vi.stubGlobal("document", createSeoDocument());
  await act(async () => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback={<p>Chargement</p>}><NXT5 /></Suspense></AppLoadingProvider>); });
  await act(async () => { await vi.dynamicImportSettled(); });
  return renderer;
}

describe("private administrator routes", () => {
  it("classifies all administrator pages as known private routes", () => {
    for (const path of restrictedPaths) {
      expect(isKnownPath(`${path}/`)).toBe(true);
      expect(isAppPath(path)).toBe(true);
      expect(PUBLIC_ROUTES).not.toContain(path);
      expect(isAdminPath(`${path}/`)).toBe(true);
    }
    expect(isAdminPath("/contact")).toBe(false);
    expect(isAppPath("/admin/demandes-acces")).toBe(true);
    expect(pageFromPath("/admin/demandes-acces")).toBe("access-requests");
    expect(pathFromPage("access-requests")).toBe("/admin/demandes-acces");
    expect(isKnownPath("/admin/abonnements/")).toBe(true);
    expect(isAppPath("/admin/abonnements")).toBe(true);
    expect(pageFromPath("/admin/abonnements")).toBe("account-subscriptions");
    expect(pathFromPage("account-subscriptions")).toBe("/admin/abonnements");
    expect(pageFromPath("/admin/frequentation")).toBe("audience");
    expect(pathFromPage("audience")).toBe("/admin/frequentation");
  });

  it.each(restrictedPaths)("does not show %s while the session check is pending", async (path) => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    await open(path);
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-subscriptions": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-audience": "true" })).toHaveLength(0);
    expect(renderer.root.findByProps({ "data-loader": "true" }).props["data-phase"]).toBe("session");
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);
  });

  it("releases the session loader before displaying pricing to the authenticated administrator", async () => {
    let resolveSession;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    await open("/tarifs");
    expect(renderer.root.findByProps({ "data-loader": "true" }).props["data-phase"]).toBe("session");
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    await act(async () => resolveSession({ user: admin }));
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(renderer.root.findByProps({ "data-pricing": "true" }).children).toContain("Administrateur");
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    expect(useTeamData).not.toHaveBeenCalled();
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("shows access requests to the administrator even without a team", async () => {
    apiFetch.mockResolvedValue({ user: admin });
    await open("/admin/demandes-acces");
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
  });

  it("releases the session loader and opens audience statistics without team data", async () => {
    let resolveSession;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    useTeamData.mockReturnValue({ data: DEFAULT_DATA, loading: true, bootstrapReady: false, bootstrapped: false });
    await open("/admin/frequentation");
    expect(renderer.root.findByProps({ "data-loader": "true" }).props["data-phase"]).toBe("session");
    expect(renderer.root.findAllByProps({ "data-audience": "true" })).toHaveLength(0);

    await act(async () => resolveSession({ user: admin }));
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(renderer.root.findAllByProps({ "data-audience": "true" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    expect(useTeamData).not.toHaveBeenCalled();
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("opens a specific subscription profile without waiting for team data", async () => {
    apiFetch.mockResolvedValue({ user: admin });
    useTeamData.mockReturnValue({ data: DEFAULT_DATA, loading: true, bootstrapReady: false, bootstrapped: false, selectedTeamId: "pending-team" });
    await open("/admin/abonnements?userId=selected-account");
    expect(renderer.root.findByProps({ "data-subscriptions": "true" }).props["data-selected-user"]).toBe("selected-account");
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
  });

  it("opens personal settings without requiring an existing team", async () => {
    apiFetch.mockResolvedValue({ user: { ...admin, is_platform_admin: false } });
    useTeamData.mockReturnValue({ data: DEFAULT_DATA, loading: true, bootstrapReady: false, bootstrapped: false, selectedTeamId: "pending-team" });
    await open("/parametres");
    expect(renderer.root.findAllByProps({ "data-account-settings": "true" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
  });

  it.each([false, true])("makes account settings discoverable without a team (administrator: %s)", async (isAdmin) => {
    apiFetch.mockResolvedValue({ user: { ...admin, is_platform_admin: isAdmin } });
    await open("/equipes");
    expect(renderer.root.findAllByProps({ "data-team-access": "true" })).toHaveLength(1);
    const actions = renderer.root.findAllByType(Button);
    expect(actions.some((item) => item.props.children === "Comptes et abonnements")).toBe(isAdmin);
    await act(async () => actions.find((item) => item.props.children === "Paramètres").props.onClick());
    expect(window.history.pushState).toHaveBeenCalledWith({}, "", "/parametres");
  });

  it.each(restrictedPaths)("denies %s to an ordinary account", async (path) => {
    apiFetch.mockResolvedValue({ user: { id: "user", name: "Joueur", is_platform_admin: false } });
    await open(path);
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
    expect(JSON.stringify(renderer.toJSON())).toContain("introuvable");
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-subscriptions": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-audience": "true" })).toHaveLength(0);
  });

  it.each(restrictedPaths)("keeps %s hidden and asks anonymous visitors to sign in", async (path) => {
    apiFetch.mockResolvedValue({ user: null });
    await open(path);
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-subscriptions": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-audience": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", `/connexion?next=${encodeURIComponent(path)}`);
  });

  it.each(restrictedPaths)("releases the loader and keeps %s hidden when checking the session fails", async (path) => {
    apiFetch.mockRejectedValueOnce(new Error("Session indisponible"));
    await open(path);
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-subscriptions": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-audience": "true" })).toHaveLength(0);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", `/connexion?next=${encodeURIComponent(path)}`);
  });

  it.each(restrictedPaths)("does not treat a truthy string as administrator authorization for %s", async (path) => {
    apiFetch.mockResolvedValue({ user: { ...admin, is_platform_admin: "true" } });
    await open(path);
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-audience": "true" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("introuvable");
    expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
  });

  it("removes pricing links from the public home page and footer", () => {
    const html = renderToStaticMarkup(<><HomeScreen navigate={vi.fn()} /><LegalLinks navigate={vi.fn()} /></>);
    expect(html).not.toContain('href="/tarifs"');
    expect(html).not.toContain('href="/admin/demandes-acces"');
    expect(html).not.toContain('href="/admin/frequentation"');
    expect(html).toContain('href="/connexion"');
  });
});
