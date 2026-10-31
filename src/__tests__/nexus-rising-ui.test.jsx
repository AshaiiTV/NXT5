import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import NexusRisingPage from "../pages/nexus/NexusRisingPage.jsx";
import NexusWorkspace from "../pages/nexus/NexusWorkspace.jsx";
import { apiFetch } from "../api/client.js";
import { Button, TextInput, TextAreaInput } from "../components/ui/Core.jsx";
import { isAppPath, isKnownPath } from "../app/routing.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../i18n/LanguageSwitcher.jsx", () => ({ default: () => null }));
let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.clearAllMocks(); vi.unstubAllGlobals(); });
const fixture = { id: "fixture-1", label: "Journée 1", teamA: "Alpha", teamB: "Beta", startsAt: "2027-01-10T18:00:00Z", endsAt: "2027-01-10T23:00:00Z", platform: "EUW1", canViewDetails: false, games: [{ gameId: "EUW1_1", winner: "A", duration: 1800 }], roster: Array.from({ length: 10 }, (_, n) => `Player${n}#EUW`) };
const button = label => renderer.root.findAllByType(Button).find(node => node.props.children === label);
const text = () => JSON.stringify(renderer.toJSON());
async function mount(element) { await act(async () => { renderer = TestRenderer.create(element); }); }

describe("Nexus Rising access levels", () => {
  it("recognizes the standalone route without a NXT5 login gate", () => { expect(isKnownPath("/nexus-rising/")).toBe(true); expect(isAppPath("/nexus-rising")).toBe(false); });
  it("shows public results to guests and preserves the login return destination", async () => {
    apiFetch.mockResolvedValue({ access: "guest", fixtures: [fixture] });
    const navigate = vi.fn();
    await mount(<NexusRisingPage navigate={navigate} />);
    expect(text()).toContain("Alpha");
    expect(text()).toContain("Accès invité");
    expect(button("Statistiques de mon équipe")).toBeUndefined();
    expect(button("Gérer les rencontres")).toBeUndefined();
    expect(text()).not.toContain("Player0#EUW");
    act(() => button("Connexion NXT5").props.onClick());
    expect(navigate).toHaveBeenCalledWith("/connexion?next=%2Fnexus-rising");
    expect(apiFetch.mock.calls.every(([path]) => path === "nexus-overview")).toBe(true);
  });
  it("only opens member details explicitly authorized by the server and keeps missing data unknown", async () => {
    apiFetch.mockResolvedValue({ access: "member", fixtures: [{ ...fixture, canViewDetails: true, statistics: [{ gameId: "EUW1_1", participants: [{ riotId: "Authorized#EUW", championName: "Ahri", kills: 0, deaths: 1, assists: 2, goldEarned: null }] }] }, { ...fixture, id: "other", label: "Other encounter" }] });
    await mount(<NexusRisingPage user={{ id: "member", name: "Member" }} navigate={vi.fn()} />);
    expect(renderer.root.findAllByType(Button).filter(node => node.props.children === "Statistiques de mon équipe")).toHaveLength(1);
    await act(async () => button("Statistiques de mon équipe").props.onClick());
    expect(text()).toContain("Authorized#EUW");
    expect(text()).toContain("—");
    expect(button("Gérer les rencontres")).toBeUndefined();
  });
  it("uses server game numbers and never numbers games from their arrival order", async () => {
    apiFetch.mockResolvedValue({access:"guest",fixtures:[{...fixture,games:[{gameId:"EUW1_late",gameNumber:2,winner:"A",duration:1800},{gameId:"EUW1_unknown_order",winner:"B",duration:1800}]}]});
    await mount(<NexusRisingPage navigate={vi.fn()}/>);
    expect(text()).toContain("Partie 2");
    expect(text()).toContain("EUW1_unknown_order");
    expect(text()).not.toContain("Partie 1");
  });
  it("does not infer staff access from the account flag when the server denies it", async () => {
    apiFetch.mockResolvedValue({ access: "guest", fixtures: [fixture] });
    await mount(<NexusRisingPage user={{ id: "admin", is_platform_admin: true }} navigate={vi.fn()} />);
    expect(button("Gérer les rencontres")).toBeUndefined();
  });
  it("removes the previous account's details while the next account is loading", async () => {
    apiFetch.mockResolvedValue({ access: "member", fixtures: [{ ...fixture, canViewDetails: true, statistics: [{ gameId: "EUW1_1", participants: [{ riotId: "Private#EUW", kills: 1 }] }] }] });
    await mount(<NexusRisingPage user={{ id: "member-a" }} navigate={vi.fn()} />);
    await act(async () => button("Statistiques de mon équipe").props.onClick());
    expect(text()).toContain("Private#EUW");
    apiFetch.mockImplementation(() => new Promise(() => {}));
    await act(async () => renderer.update(<NexusRisingPage user={{ id: "member-b" }} navigate={vi.fn()} />));
    expect(text()).not.toContain("Private#EUW");
    expect(button("Statistiques de mon équipe")).toBeUndefined();
  });
  it("shows an actionable error without exposing a stale overview", async () => {
    apiFetch.mockRejectedValue(new Error("Service indisponible"));
    await mount(<NexusRisingPage navigate={vi.fn()} />);
    expect(renderer.root.findByProps({ role: "alert" }).children.length).toBeGreaterThan(0);
    expect(button("Réessayer")).toBeTruthy();
    expect(text()).not.toContain("Alpha");
  });
});

describe("Nexus staff workflow", () => {
  it("uses season registrations instead of creating duplicate teams or free-text rosters", async () => {
    const request = vi.fn().mockResolvedValue({ fixtures: [], pairings: [], submissions: [], teams: [], seasons: [], registrations: [] });
    await mount(<NexusWorkspace request={request} />);
    expect(button("Nouvelle rencontre")).toBeUndefined();
    expect(button("Nouvelle saison")).toBeTruthy();
    expect(renderer.root.findAllByType(TextAreaInput)).toHaveLength(0);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("requires a revocation confirmation and clears authorized content on access loss", async () => {
    const onSessionExpired = vi.fn();
    const request = vi.fn().mockImplementation((_path, options) => options?.method === "POST" ? Promise.reject(Object.assign(new Error("Revoked"), { status: 403 })) : Promise.resolve({ fixtures: [fixture], pairings: [{ id: "pair", fixtureId: fixture.id, uploaderRiotId: "Player0#EUW" }], submissions: [] }));
    await mount(<NexusWorkspace request={request} onSessionExpired={onSessionExpired} />);
    act(() => button("Révoquer").props.onClick());
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => button("Confirmer la révocation").props.onClick());
    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ action: "revokePairing", pairingId: "pair" });
  });
});
