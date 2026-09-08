import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import NXT5 from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { isAdminPath, isAppPath, isKnownPath, pageFromPath, pathFromPage } from "../app/routing.js";
import { HomeScreen, LegalLinks } from "../pages/public/PublicPages.jsx";
import { DEFAULT_DATA, PUBLIC_ROUTES } from "../app/constants.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../pages/public/PricingPage.jsx", () => ({ default: ({ user }) => <main data-pricing="true">Tarifs {user?.name || "visiteur"}</main> }));
vi.mock("../pages/admin/AccessRequestsPage.jsx", () => ({ default: () => <section data-leads="true">Demandes d’accès</section> }));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => null }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: () => ({ data: DEFAULT_DATA, bootstrapped: true, bootstrapReady: true }) }));

const admin = { id: "admin", name: "Administrateur", email: "admin@example.test", email_verified: true, is_platform_admin: true };
const restrictedPaths = ["/tarifs", "/admin/demandes-acces"];

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function open(path) {
  const location = new URL(path, "https://nxt5.test");
  vi.stubGlobal("window", {
    location, history: { replaceState: vi.fn(), pushState: vi.fn() },
    scrollTo: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    localStorage: { getItem: vi.fn() },
  });
  vi.stubGlobal("document", { title: "" });
  await act(async () => { renderer = TestRenderer.create(<Suspense fallback={<p>Chargement</p>}><NXT5 /></Suspense>); });
  return renderer;
}

describe("pricing and access-request routes", () => {
  it("classifies both pages as private administrator routes", () => {
    expect(isKnownPath("/tarifs/")).toBe(true);
    expect(isAppPath("/tarifs")).toBe(true);
    expect(PUBLIC_ROUTES).not.toContain("/tarifs");
    for (const path of restrictedPaths) expect(isAdminPath(`${path}/`)).toBe(true);
    expect(isAdminPath("/contact")).toBe(false);
    expect(isAppPath("/admin/demandes-acces")).toBe(true);
    expect(pageFromPath("/admin/demandes-acces")).toBe("access-requests");
    expect(pathFromPage("access-requests")).toBe("/admin/demandes-acces");
  });

  it.each(restrictedPaths)("does not show %s while the session check is pending", async (path) => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    await open(path);
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(0);
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);
  });

  it("shows pricing to the authenticated administrator", async () => {
    apiFetch.mockResolvedValue({ user: admin });
    await open("/tarifs");
    expect(renderer.root.findByProps({ "data-pricing": "true" }).children).toContain("Administrateur");
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("shows access requests to the administrator even without a team", async () => {
    apiFetch.mockResolvedValue({ user: admin });
    await open("/admin/demandes-acces");
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(1);
  });

  it.each(restrictedPaths)("denies %s to an ordinary account", async (path) => {
    apiFetch.mockResolvedValue({ user: { id: "user", name: "Joueur", is_platform_admin: false } });
    await open(path);
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
    expect(JSON.stringify(renderer.toJSON())).toContain("introuvable");
  });

  it.each(restrictedPaths)("keeps %s hidden and asks anonymous visitors to sign in", async (path) => {
    apiFetch.mockResolvedValue({ user: null });
    await open(path);
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-leads": "true" })).toHaveLength(0);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", `/connexion?next=${encodeURIComponent(path)}`);
  });

  it("does not treat a truthy string as administrator authorization", async () => {
    apiFetch.mockResolvedValue({ user: { ...admin, is_platform_admin: "true" } });
    await open("/tarifs");
    expect(renderer.root.findAllByProps({ "data-pricing": "true" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("introuvable");
  });

  it("removes pricing links from the public home page and footer", () => {
    const html = renderToStaticMarkup(<><HomeScreen navigate={vi.fn()} /><LegalLinks navigate={vi.fn()} /></>);
    expect(html).not.toContain('href="/tarifs"');
    expect(html).not.toContain('href="/admin/demandes-acces"');
    expect(html).toContain('href="/connexion"');
  });
});
