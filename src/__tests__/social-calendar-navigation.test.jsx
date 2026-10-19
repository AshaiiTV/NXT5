import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainApp } from "../AppContent.jsx";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { isAppPath, isKnownPath, pageFromPath, pathFromPage } from "../app/routing.js";
import { Sidebar, Topbar } from "../components/layout/AppChrome.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { useTeamData } from "../hooks/useTeamData.js";
import { apiFetch } from "../api/client.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../hooks/useTeamData.js", () => ({ useTeamData: vi.fn() }));
vi.mock("../components/account/AccountSubscription.jsx", () => ({ default: () => null }));
vi.mock("../i18n/LanguageSwitcher.jsx", () => ({ default: () => <button aria-label="Langue">FR</button> }));
vi.mock("../components/assistant/AssistantPanel.jsx", () => ({ default: () => null }));
vi.mock("../pages/workspace/SocialCalendar.jsx", () => ({ default: () => <section data-social-calendar="true" /> }));

let renderer;
const user = { id: "owner", email: "owner@example.test", name: "Owner", email_verified: true, is_platform_admin: true };
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/calendrier"), localStorage: { getItem: vi.fn(), setItem: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  useTeamData.mockReturnValue({ data: DEFAULT_DATA, selectedTeamId: null, setSelectedTeamId: vi.fn(), loading: true, bootstrapReady: false, bootstrapped: false, refreshAll: vi.fn() });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("calendar account navigation", () => {
  it("recognizes the calendar as a private app route", () => {
    expect(isAppPath("/calendrier")).toBe(true);
    expect(isKnownPath("/calendrier")).toBe(true);
    expect(pageFromPath("/calendrier")).toBe("social-calendar");
    expect(pathFromPage("social-calendar")).toBe("/calendrier");
  });
  it("places the owner calendar in the sidebar footer before administration", async () => {
    await act(async () => { renderer = TestRenderer.create(<Sidebar active="social-calendar" user={user} isPlatformAdmin open={false} roleLabel={() => ""} />); });
    const footer = renderer.root.findByProps({ className: "nxt5-sidebar-footer" });
    const links = footer.findAllByType("a");
    expect(links[0].props.href).toBe("/calendrier");
    expect(links[0].props["aria-current"]).toBe("page");
    expect(links[0].props["aria-label"]).toBe("Calendrier");
    expect(links.findIndex(link => link.props.href === "/admin")).toBeGreaterThan(0);
    await act(async () => { renderer.update(<Sidebar active="social-calendar" user={{ ...user, is_platform_admin: false }} isPlatformAdmin={false} open={false} roleLabel={() => ""} />); });
    expect(renderer.root.findAllByType("a").some(link => link.props.href === "/calendrier")).toBe(false);
  });
  it("keeps the calendar independent of team selection in the topbar", async () => {
    await act(async () => { renderer = TestRenderer.create(<Topbar active="social-calendar" teams={[]} setOpen={vi.fn()} />); });
    expect(JSON.stringify(renderer.toJSON())).toContain("Publications NXT5");
    expect(renderer.root.findAllByType("button").some(button => String(button.props["aria-label"]).startsWith("Choisir une équipe"))).toBe(false);
  });
  it("opens for the owner without a team or a completed team bootstrap", async () => {
    await act(async () => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback="Loading"><MainApp user={user} route={{ path: "/calendrier", search: "" }} navigate={vi.fn()} onLogout={vi.fn()} onUserUpdate={vi.fn()} pushToast={vi.fn()} /></Suspense></AppLoadingProvider>); await vi.dynamicImportSettled(); });
    expect(renderer.root.findAllByProps({ "data-social-calendar": "true" })).toHaveLength(1);
    expect(renderer.root.findAllByType(Sidebar)).toHaveLength(1);
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("blocks another account before mounting the calendar or requesting its data", async () => {
    await act(async () => { renderer = TestRenderer.create(<AppLoadingProvider><Suspense fallback="Loading"><MainApp user={{ ...user, id: "member", is_platform_admin: false }} route={{ path: "/calendrier", search: "" }} navigate={vi.fn()} onLogout={vi.fn()} onUserUpdate={vi.fn()} pushToast={vi.fn()} /></Suspense></AppLoadingProvider>); });
    expect(renderer.root.findAllByProps({ "data-social-calendar": "true" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Ce calendrier est réservé au compte propriétaire de NXT5.");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
