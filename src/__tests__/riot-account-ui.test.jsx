import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { RiotAccount, RiotLogin, RiotNotice, riotCallbackStatus } from "../components/account/RiotAccount.jsx";
import { Button, TextInput } from "../components/ui/Core.jsx";
import { AuthPage, LEGAL_PAGES } from "../pages/public/PublicPages.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/audience-client.js", () => ({ trackAudienceEvent: vi.fn(), openCookieSettings: vi.fn() }));
let renderer;
const linked = { enabled: true, linked: true, identity: { gameName: "Joueur", tagLine: "EUW", linkedAt: "2026-09-23T10:00:00Z" } };
const authorizationUrl = "https://auth.riotgames.com/authorize?state=test-only";
const nodeText = (node) => Array.isArray(node) ? node.map(nodeText).join("") : node == null ? "" : typeof node === "object" ? nodeText(node.children) : String(node);
const text = () => nodeText(renderer.toJSON());
const button = (label) => renderer.root.findAllByType(Button).find((node) => node.props.children === label);
async function render(element, options) { await act(async () => { renderer = TestRenderer.create(element, options); }); }
beforeEach(() => {
  vi.stubGlobal("window", { location: { search: "", assign: vi.fn() }, localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("Riot connection and explicit association", () => {
  it("keeps login inactive while configuration is unavailable", async () => {
    apiFetch.mockResolvedValue({ enabled: false, linked: false });
    await render(<RiotLogin />);
    expect(button("Se connecter avec Riot").props.disabled).toBe(true);
    expect(text()).toContain("n’est pas encore disponible");
    await act(async () => button("Se connecter avec Riot").props.onClick());
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("auth-riot-status");
  });

  it("treats missing or malformed status as unavailable, with a working retry", async () => {
    apiFetch.mockResolvedValueOnce({ enabled: "true" });
    await render(<RiotLogin />);
    expect(button("Se connecter avec Riot").props.disabled).toBe(true);
    expect(text()).toContain("n’a pas pu être vérifiée");
    apiFetch.mockResolvedValueOnce({ enabled: true, linked: false });
    await act(async () => button("Réessayer la vérification").props.onClick());
    expect(button("Se connecter avec Riot").props.disabled).toBe(false);
  });

  it("starts the login flow with the existing remember preference and shows loading", async () => {
    apiFetch.mockResolvedValueOnce({ enabled: true, linked: false });
    await render(<RiotLogin rememberMe />);
    apiFetch.mockResolvedValueOnce({ authorizationUrl });
    await act(async () => button("Se connecter avec Riot").props.onClick());
    expect(apiFetch).toHaveBeenLastCalledWith("auth-riot-start", { method: "POST", body: JSON.stringify({ flow: "login", rememberMe: true }) });
    expect(window.location.assign).toHaveBeenCalledWith(authorizationUrl);
    expect(button("Ouverture de Riot…").props.disabled).toBe(true);
    expect(button("Ouverture de Riot…").props["aria-busy"]).toBe(true);
  });

  it.each(["https://attacker.test/authorize", "javascript:alert(1)", "http://auth.riotgames.com/authorize", "https://auth.riotgames.com/other", "https://user:secret@auth.riotgames.com/authorize"])("rejects an unexpected authorization destination %s", async (url) => {
    apiFetch.mockResolvedValueOnce({ enabled: true, linked: false });
    await render(<RiotLogin />);
    apiFetch.mockResolvedValueOnce({ authorizationUrl: url });
    await act(async () => button("Se connecter avec Riot").props.onClick());
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ role: "alert" })).toBeTruthy();
    expect(button("Se connecter avec Riot").props.disabled).toBe(false);
  });

  it("requires an explicit link action and never submits a declared Riot ID", async () => {
    apiFetch.mockResolvedValueOnce({ enabled: true, linked: false });
    await render(<RiotAccount />);
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("auth-riot-status");
    expect(text()).toContain("distincte du Riot ID déclaré");
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    apiFetch.mockResolvedValueOnce({ authorizationUrl });
    await act(async () => button("Associer mon compte Riot").props.onClick());
    expect(apiFetch).toHaveBeenLastCalledWith("auth-riot-start", { method: "POST", body: JSON.stringify({ flow: "link" }) });
    expect(window.location.assign).toHaveBeenCalledWith(authorizationUrl);
  });

  it("retains password-based unlink even if Riot login has been disabled", async () => {
    apiFetch.mockResolvedValueOnce({ ...linked, enabled: false });
    await render(<RiotAccount />);
    expect(text()).toContain("Joueur#EUW");
    expect(text()).not.toContain("PUUID");
    await act(async () => button("Dissocier mon compte Riot").props.onClick());
    expect(text()).toContain("Tes autres sessions NXT5 seront fermées ; celle-ci restera ouverte.");
    expect(button("Confirmer la dissociation").props.disabled).toBe(true);
    await act(async () => renderer.root.findByType(TextInput).props.onChange("password-local-only"));
    apiFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(apiFetch).toHaveBeenLastCalledWith("auth-riot-unlink", { method: "POST", body: JSON.stringify({ currentPassword: "password-local-only" }) });
    expect(text()).toContain("Ton compte Riot est dissocié");
    expect(text()).not.toContain("Joueur#EUW");
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(button("Associer mon compte Riot").props.disabled).toBe(true);
  });

  it("retains association on failed reauthentication, clears password and allows retry", async () => {
    apiFetch.mockResolvedValueOnce(linked);
    await render(<RiotAccount />);
    await act(async () => button("Dissocier mon compte Riot").props.onClick());
    await act(async () => renderer.root.findByType(TextInput).props.onChange("wrong"));
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Wrong password"), { status: 401 }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(text()).toContain("Joueur#EUW");
    expect(text()).toContain("Vérifie ton mot de passe");
    expect(renderer.root.findByType(TextInput).props.value).toBe("");
    expect(button("Confirmer la dissociation").props.disabled).toBe(true);
  });

  it("focuses confirmation input and restores focus on Escape without calling unlink", async () => {
    const inputFocus = vi.fn();
    const actionFocus = vi.fn();
    apiFetch.mockResolvedValueOnce(linked);
    await render(<RiotAccount />, { createNodeMock: (element) => element.props.className === "max-w-md" ? { querySelector: () => ({ focus: inputFocus }) } : { querySelector: () => ({ focus: actionFocus }) } });
    await act(async () => button("Dissocier mon compte Riot").props.onClick());
    expect(inputFocus).toHaveBeenCalledOnce();
    await act(async () => renderer.root.findByType("form").props.onKeyDown({ key: "Escape", preventDefault() {} }));
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(actionFocus).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("auth-riot-status");
  });

  it.each(["conflict", "expired", "account_changed", "account_already_linked", "cancelled", "unavailable", "failed"])("announces a safe %s callback message and ignores unknown input", async (status) => {
    const focus = vi.fn();
    await render(<RiotNotice status={riotCallbackStatus(`?riot=${status}`)} />, { createNodeMock: () => ({ focus }) });
    expect(focus).toHaveBeenCalledOnce();
    expect(text()).not.toContain("undefined");
    expect(riotCallbackStatus("?riot=javascript%3Aalert(1)")).toBe("");
    if (status === "account_already_linked") expect(text()).toContain("Ton compte NXT5 est déjà associé à un autre compte Riot");
    if (status === "conflict") expect(text()).toContain("Ce compte Riot est déjà associé à un autre compte NXT5");
  });

  it("links to the actual Riot privacy section", async () => {
    apiFetch.mockResolvedValueOnce(linked);
    await render(<RiotAccount />);
    const privacyLink = renderer.root.findAllByType("a").find(node => node.props.children === "Données utilisées pour l’association Riot");
    const sectionNumber = Number(privacyLink.props.href.match(/#document-confidentialite-(\d+)$/)[1]);
    expect(LEGAL_PAGES["/confidentialite"].sections[sectionNumber - 1][0]).toContain("Association Riot Sign On");
  });

  it.each(["login", "register"])("guides an unlinked Riot identity through normal %s then settings", async (mode) => {
    window.location.search = "?riot=not_linked";
    apiFetch.mockResolvedValueOnce({ enabled: true, linked: false });
    const navigate = vi.fn();
    const onAuth = vi.fn();
    await render(<AuthPage mode={mode} navigate={navigate} onAuth={onAuth} pushToast={vi.fn()} />);
    expect(text()).toContain("n’est pas encore associé");
    expect(renderer.root.findAllByType("a").filter((node) => /creer-un-compte|connexion/.test(node.props.href)).every((node) => node.props.href.includes("next=%2Fparametres"))).toBe(true);
    apiFetch.mockResolvedValue({ user: { id: "existing-or-standard-created-user", is_platform_admin: true } });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(navigate).toHaveBeenCalledWith("/parametres", { replace: true });
    expect(apiFetch.mock.calls.some(([endpoint]) => endpoint === "auth-riot-start")).toBe(false);
    expect(onAuth).toHaveBeenCalled();
  });
});
