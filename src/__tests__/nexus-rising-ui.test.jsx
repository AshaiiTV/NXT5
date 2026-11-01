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
  it.each([undefined,{id:"member"},{id:"member",is_platform_admin:false}])("shows Coming soon without requesting any Nexus data for non-admins (%j)", async user => {
    apiFetch.mockResolvedValue({access:"staff",fixtures:[fixture]});
    const navigate=vi.fn();
    await mount(<NexusRisingPage user={user} navigate={navigate}/>);
    expect(text()).toContain("Coming");expect(text()).toContain("Soon");
    expect(text()).not.toContain("Alpha");expect(text()).not.toContain("Player0#EUW");
    expect(button("Statistiques de mon équipe")).toBeUndefined();
    expect(button("Gérer les rencontres")).toBeUndefined();
    expect(button("Inscrire mon équipe")).toBeUndefined();
    expect(text()).not.toContain("Calendrier Nexus Rising");
    expect(apiFetch).not.toHaveBeenCalled();
    act(()=>button("Retour à NXT5").props.onClick());
    expect(navigate).toHaveBeenCalledWith(user ? "/accueil" : "/");
    if(!user){act(()=>button("Connexion NXT5").props.onClick());expect(navigate).toHaveBeenLastCalledWith("/connexion?next=%2Fnexus-rising");}
  });
  it("keeps the full portal and missing statistics unknown for a server-authorized administrator", async () => {
    apiFetch.mockResolvedValue({ access: "staff", fixtures: [{ ...fixture, canViewDetails: true, statistics: [{ gameId: "EUW1_1", participants: [{ riotId: "Authorized#EUW", championName: "Ahri", kills: 0, deaths: 1, assists: 2, goldEarned: null }] }] }, { ...fixture, id: "other", label: "Other encounter" }] });
    await mount(<NexusRisingPage user={{ id: "admin", is_platform_admin:true }} navigate={vi.fn()} />);
    expect(renderer.root.findAllByType(Button).filter(node => node.props.children === "Statistiques de mon équipe")).toHaveLength(1);
    await act(async () => button("Statistiques de mon équipe").props.onClick());
    expect(text()).toContain("Authorized#EUW");expect(text()).toContain("—");
    expect(button("Gérer les rencontres")).toBeTruthy();
  });
  it("uses server game numbers and never numbers games from their arrival order", async () => {
    apiFetch.mockResolvedValue({access:"staff",fixtures:[{...fixture,games:[{gameId:"EUW1_late",gameNumber:2,winner:"A",duration:1800},{gameId:"EUW1_unknown_order",winner:"B",duration:1800}]}]});
    await mount(<NexusRisingPage user={{id:"admin",is_platform_admin:true}} navigate={vi.fn()}/>);
    expect(text()).toContain("Partie 2");expect(text()).toContain("EUW1_unknown_order");expect(text()).not.toContain("Partie 1");
  });
  it.each(["coming_soon","guest","member"])("discards data when the server returns non-staff access (%s)", async access => {
    apiFetch.mockResolvedValue({access,fixtures:[fixture]});
    await mount(<NexusRisingPage user={{id:"admin",is_platform_admin:true}} navigate={vi.fn()}/>);
    expect(text()).toContain("Coming");expect(text()).not.toContain("Alpha");
    expect(button("Gérer les rencontres")).toBeUndefined();
  });
  it("destroys prior administrator details when the same account loses its role", async () => {
    apiFetch.mockResolvedValue({access:"staff",fixtures:[{...fixture,canViewDetails:true,statistics:[{gameId:"EUW1_1",participants:[{riotId:"Private#EUW",kills:1}]}]}]});
    await mount(<NexusRisingPage user={{id:"account",is_platform_admin:true}} navigate={vi.fn()}/>);
    act(()=>button("Statistiques de mon équipe").props.onClick());expect(text()).toContain("Private#EUW");
    const signal=apiFetch.mock.calls[0][1].signal;
    await act(async()=>renderer.update(<NexusRisingPage user={{id:"account",is_platform_admin:false}} navigate={vi.fn()}/>));
    expect(text()).toContain("Coming");expect(text()).not.toContain("Private#EUW");expect(text()).not.toContain("Alpha");
    expect(signal.aborted).toBe(true);expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it("aborts and ignores a late overview after logout", async () => {
    let finish;
    apiFetch.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    await mount(<NexusRisingPage user={{id:"admin",is_platform_admin:true}} navigate={vi.fn()}/>);
    const signal=apiFetch.mock.calls[0][1].signal;
    await act(async()=>renderer.update(<NexusRisingPage navigate={vi.fn()}/>));
    await act(async()=>finish({access:"staff",fixtures:[fixture]}));
    expect(signal.aborted).toBe(true);expect(text()).not.toContain("Alpha");expect(text()).toContain("Coming");
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it.each([401,403])("shows Coming soon when the server rejects the stale administrator session (%s)",async status=>{
    apiFetch.mockRejectedValue(Object.assign(new Error("Accès retiré"),{status}));
    await mount(<NexusRisingPage user={{id:"admin",is_platform_admin:true}} navigate={vi.fn()}/>);
    expect(text()).toContain("Coming");expect(text()).not.toContain("Accès retiré");expect(button("Gérer les rencontres")).toBeUndefined();
  });
  it("shows an actionable technical error for administrators without exposing a stale overview", async () => {
    apiFetch.mockRejectedValue(new Error("Service indisponible"));
    await mount(<NexusRisingPage user={{id:"admin",is_platform_admin:true}} navigate={vi.fn()} />);
    expect(renderer.root.findByProps({ role: "alert" }).children.length).toBeGreaterThan(0);
    expect(button("Réessayer")).toBeTruthy();expect(text()).not.toContain("Alpha");
  });
  it("closes the entire portal when the registration request detects withdrawn access",async()=>{
    apiFetch.mockImplementation(path=>path==="nexus-overview"?Promise.resolve({access:"staff",fixtures:[fixture]}):Promise.reject(Object.assign(new Error("Ouverture prochaine"),{status:403,code:"NEXUS_COMING_SOON"})));
    await mount(<NexusRisingPage user={{id:"admin",is_platform_admin:true}} navigate={vi.fn()}/>);
    expect(text()).toContain("Alpha");
    await act(async()=>button("Inscrire mon équipe").props.onClick());
    await act(async()=>{await vi.dynamicImportSettled();});
    expect(text()).toContain("Coming");expect(text()).not.toContain("Alpha");
    expect(button("Inscrire mon équipe")).toBeUndefined();
    expect(apiFetch.mock.calls.map(([path])=>path)).toEqual(["nexus-overview","nexus-registration"]);
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
