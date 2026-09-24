import { createSeoDocument } from "./helpers/seo-document.js";
import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import NXT5 from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { isAdminPath, isAppPath, isKnownPath } from "../app/routing.js";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { useTeamData } from "../hooks/useTeamData.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: () => null }));
vi.mock("../pages/public/SupportPage.jsx", () => ({ SupportPage: ({ user }) => <main data-support="true" data-user={user?.id || "anonymous"}>Soutenir NXT5</main> }));
vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({ default: ({ phase }) => <section data-loader="true" data-phase={phase} /> }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: vi.fn() }));

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function open(path = "/soutenir") {
  vi.stubGlobal("window", {
    location: new URL(path, "https://nxt5.test"),
    history: { replaceState: vi.fn(), pushState: vi.fn() },
    scrollTo: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    localStorage: { getItem: vi.fn() },
  });
  vi.stubGlobal("document", createSeoDocument());
  await act(async () => {
    renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback={<p>Chargement</p>}><NXT5 /></Suspense></AppLoadingProvider>);
  });
  await act(async () => { await vi.dynamicImportSettled(); });
}

function expectPublicSupport(userId = "anonymous") {
  expect(renderer.root.findByProps({ "data-support": "true" }).props["data-user"]).toBe(userId);
  expect(renderer.root.findAllByProps({ "data-loader": "true" })).toHaveLength(0);
  expect(useTeamData).not.toHaveBeenCalled();
  expect(window.history.replaceState).not.toHaveBeenCalled();
  expect(window.history.pushState).not.toHaveBeenCalled();
  expect(document.title).toBe("Soutenir le développement de NXT5");
}

describe("public support route", () => {
  it("recognizes a direct visit with a trailing slash as public", async () => {
    expect(isKnownPath("/soutenir/")).toBe(true);
    expect(isAppPath("/soutenir/")).toBe(false);
    expect(isAdminPath("/soutenir/")).toBe(false);
    apiFetch.mockResolvedValueOnce({ user: null });
    await open("/soutenir/?source=footer");
    expectPublicSupport();
  });

  it("renders before the session resolves and stays public for an authenticated visitor", async () => {
    let resolveSession;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    await open();
    expectPublicSupport();
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);

    await act(async () => resolveSession({ user: { id: "member", name: "Joueur", email_verified: false } }));
    expectPublicSupport("member");
    expect(apiFetch.mock.calls.map(([endpoint]) => endpoint)).toEqual(["auth-me"]);
  });

  it("keeps support available if the session check fails", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Session indisponible"));
    await open();
    expectPublicSupport();
  });

  it("does not treat a public support link carrying an invite as an authentication route", async () => {
    apiFetch.mockResolvedValueOnce({ user: null });
    await open("/soutenir?invite=team-invite");
    expectPublicSupport();
  });
});
