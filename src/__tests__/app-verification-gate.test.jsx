import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MainApp } from "../AppContent.jsx";
import { useTeamData } from "../hooks/useTeamData.js";
import { apiFetch } from "../api/client.js";
import { Button } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: vi.fn() }));
vi.mock("../components/ui/ModalDialog.jsx", () => ({ ModalDialog: ({ children }) => <dialog open>{children}</dialog> }));
vi.mock("../components/layout/AppChrome.jsx", () => ({ AmbientBackground: () => null, Sidebar: () => null, Topbar: () => null, ApiBanner: () => null }));
vi.mock("../pages/public/PublicPages.jsx", () => ({ SiteHeader: () => <header>NXT5</header>, LEGAL_PAGES: {} }));

let renderer;
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/equipes") });
  apiFetch.mockResolvedValue({ hasPassword: true });
});
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.clearAllMocks(); vi.unstubAllGlobals(); });

it.each([
  [{ id: "user", email: "pending@example.test", email_verified: false }, "Vérifie ton e-mail"],
  [{ id: "user", email: null, email_verified: false }, "Ajoute ton e-mail de récupération"],
  [{ id: "user", email: "pending@example.test" }, "Vérifie ton e-mail"],
])("keeps business data unmounted until the email is verified: %j", async (user, title) => {
  const logout = vi.fn();
  await act(async () => { renderer = TestRenderer.create(<MainApp user={user} onLogout={logout} onUserUpdate={vi.fn()} pushToast={vi.fn()} route={{ path: "/equipes", search: "" }} navigate={vi.fn()} />); });
  expect(useTeamData).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain(title);
  expect(apiFetch.mock.calls.every(([path]) => path === "auth-social-status")).toBe(true);
  const button = renderer.root.findAllByType(Button).find(node => node.props.children === "Se déconnecter");
  act(() => button.props.onClick());
  expect(logout).toHaveBeenCalledExactlyOnceWith();
});
