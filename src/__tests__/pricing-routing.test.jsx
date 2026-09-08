import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import NXT5 from "../AppContent.jsx";
import { apiFetch } from "../api/client.js";
import { isAppPath, isKnownPath, pageFromPath, pathFromPage } from "../app/routing.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../pages/public/PricingPage.jsx", () => ({ default: ({ user }) => <main data-pricing="true">Tarifs {user?.name || "visiteur"}</main> }));

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
  });
  vi.stubGlobal("document", { title: "" });
  await act(async () => { renderer = TestRenderer.create(<Suspense fallback={<p>Chargement</p>}><NXT5 /></Suspense>); });
  return renderer;
}

describe("pricing and access-request routes", () => {
  it("keeps pricing public and the administration route private", () => {
    expect(isKnownPath("/tarifs/")).toBe(true);
    expect(isAppPath("/tarifs")).toBe(false);
    expect(isAppPath("/admin/demandes-acces")).toBe(true);
    expect(pageFromPath("/admin/demandes-acces")).toBe("access-requests");
    expect(pathFromPage("access-requests")).toBe("/admin/demandes-acces");
  });

  it("shows pricing while the session check is still pending", async () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    await open("/tarifs");
    expect(renderer.root.findByProps({ "data-pricing": "true" }).children).toContain("visiteur");
    expect(document.title).toBe("Tarifs — NXT5");
  });

  it("keeps pricing visible to signed-in users without loading the workspace", async () => {
    apiFetch.mockResolvedValue({ user: { id: "user", name: "Capitaine" } });
    await open("/tarifs");
    expect(renderer.root.findByProps({ "data-pricing": "true" }).children).toContain("Capitaine");
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("never loads access requests for a non-administrator", async () => {
    apiFetch.mockResolvedValue({ user: { id: "user", name: "Joueur", is_platform_admin: false } });
    await open("/admin/demandes-acces");
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
    expect(JSON.stringify(renderer.toJSON())).toContain("introuvable");
  });
});
