import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { SocialAccounts, SocialLogin, SocialNotice, SocialSignup, socialReturnContext } from "../components/account/SocialAccounts.jsx";
import { AuthPage, ResetPasswordPage } from "../pages/public/PublicPages.jsx";
import { AccountSettings } from "../pages/workspace/AccountSettings.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/audience-client.js", async (importOriginal) => ({ ...await importOriginal(), openCookieSettings: vi.fn(), trackAudienceEvent: vi.fn() }));
vi.mock("../components/account/AccountSubscription.jsx", () => ({ default: () => null }));

const providers = ["google", "discord", "apple", "riot"].map((id) => ({ id, label: id, enabled: true }));
const cleanups = [];
const focus = vi.fn();
function content(node) { return typeof node === "string" ? node : (node.children || []).map(content).join(" "); }
function button(renderer, label) { return renderer.root.findAllByType("button").find((node) => content(node).trim() === label); }
function edit(renderer, label, value) { act(() => renderer.root.findByProps({ label }).props.onChange(value)); }
function submit(renderer) { return renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); }
async function render(element) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element, { createNodeMock: () => ({ focus }) }); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
beforeEach(() => {
  vi.stubGlobal("window", {
    location: { search: "", pathname: "/connexion", assign: vi.fn() },
    localStorage: { getItem: vi.fn(), setItem: vi.fn() },
  });
  apiFetch.mockResolvedValue({ providers, linked: [], hasPassword: true });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("social account entry and completion", () => {
  it("only offers configured providers and carries the invitation and safe destination through OAuth", async () => {
    window.location.search = "?invite=team-token&next=%2Frapports";
    apiFetch.mockResolvedValueOnce({ providers: providers.map((provider) => ({ ...provider, enabled: provider.id === "google" })) });
    const renderer = await render(<SocialLogin flow="register" rememberMe />);
    expect(button(renderer, "Continuer avec Google")).toBeTruthy();
    expect(button(renderer, "Continuer avec Apple")).toBeUndefined();
    apiFetch.mockResolvedValueOnce({ authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=state" });
    await act(async () => { await button(renderer, "Continuer avec Google").props.onClick(); });
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ provider: "google", flow: "register", rememberMe: true, next: "/rapports", invite: "team-token" });
    expect(window.location.assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?state=state");
  });

  it("uses decorative official Google and Apple artwork without duplicate accessible names", async () => {
    const renderer = await render(<SocialLogin />);
    const google = button(renderer, "Continuer avec Google");
    const apple = button(renderer, "Continuer avec Apple");
    expect(google.props["data-provider"]).toBe("google");
    expect(apple.props["data-provider"]).toBe("apple");
    expect(google.findByType("img").props).toMatchObject({ src: "/assets/auth/google-g.svg", alt: "", "aria-hidden": "true" });
    expect(apple.findByType("img").props).toMatchObject({ src: "/assets/auth/apple-signin-black.svg", alt: "", "aria-hidden": "true" });
    expect(button(renderer, "Continuer avec Discord").findAllByType("img")).toHaveLength(0);
  });

  it("never presents inactive services as available, and safely rejects bad authorization URLs", async () => {
    apiFetch.mockResolvedValueOnce({ providers: providers.map((provider) => ({ ...provider, enabled: false })) });
    const inactive = await render(<SocialLogin />);
    expect(inactive.toJSON()).toBeNull();
    const renderer = await render(<SocialLogin />);
    apiFetch.mockResolvedValueOnce({ authorizationUrl: "javascript:alert(1)" });
    await act(async () => { await button(renderer, "Continuer avec Discord").props.onClick(); });
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(content(renderer.root)).toContain("lien de connexion valide");
    expect(button(renderer, "Continuer avec Discord").props.disabled).toBe(false);
  });

  it("filters external, backslash, and control-character return paths", () => {
    expect(socialReturnContext("?next=https%3A%2F%2Fevil.test")).toEqual({});
    expect(socialReturnContext("?next=%2F%2Fevil.test")).toEqual({});
    expect(socialReturnContext("?next=%2F%5Cevil.test")).toEqual({});
    expect(socialReturnContext("?next=%2F%0Aevil.test")).toEqual({});
    expect(socialReturnContext("?next=%2Fequipes%3Finvite%3Dtoken")).toEqual({ next: "/equipes?invite=token" });
  });

  it("requires explicit legal acceptance and an email for Riot, without asking for a local password", async () => {
    const onComplete = vi.fn();
    apiFetch.mockResolvedValueOnce({ provider: "riot", email: null, name: "RiotPlayer", emailVerified: false });
    const renderer = await render(<SocialSignup legalVersion="2026-09-23" onComplete={onComplete} loginHref="/connexion?next=%2Fparametres" />);
    expect(renderer.root.findAllByProps({ type: "password" })).toHaveLength(0);
    const legalLinks = renderer.root.findAllByType("a").filter((node) => node.props.target === "_blank");
    expect(legalLinks).toHaveLength(3);
    expect(legalLinks.every((node) => content(node).includes("nouvel onglet"))).toBe(true);
    expect(content(renderer.root)).toContain("vérifier cette adresse");
    edit(renderer, "E-mail de récupération", "  player@example.fr  ");
    await act(async () => { await submit(renderer); });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(content(renderer.root)).toContain("Accepte les conditions");
    act(() => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
    apiFetch.mockResolvedValueOnce({ user: { id: 42 }, destination: "/equipes?invite=token" });
    await act(async () => { await submit(renderer); });
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ displayName: "RiotPlayer", email: "player@example.fr", acceptLegal: true, legalVersion: "2026-09-23" });
    expect(onComplete).toHaveBeenCalledWith({ id: 42 }, "/equipes?invite=token");
  });

  it("keeps the form after an email collision and sends the user to the existing account", async () => {
    const onComplete = vi.fn();
    apiFetch.mockResolvedValueOnce({ provider: "apple", email: "relay@privaterelay.appleid.com", name: "Joueur", emailVerified: true });
    const renderer = await render(<SocialSignup legalVersion="2026-09-23" onComplete={onComplete} loginHref="/connexion?next=%2Fparametres" />);
    act(() => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("existing"), { code: "SOCIAL_EMAIL_EXISTS" }));
    await act(async () => { await submit(renderer); });
    expect(onComplete).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ label: "E-mail de récupération" }).props.value).toBe("relay@privaterelay.appleid.com");
    expect(content(renderer.root)).toContain("pas fusionnés automatiquement");
    expect(renderer.root.findAllByType("a").find((node) => content(node) === "Me connecter à mon compte existant").props.href).toBe("/connexion?next=%2Fparametres");
  });

  it("renders OAuth completion on registration and honours the destination returned by the server", async () => {
    window.location.search = "?social=complete&next=%2Fequipes%3Finvite%3Dold";
    apiFetch.mockResolvedValueOnce({ provider: "discord", email: "player@example.fr", name: "Player", emailVerified: true });
    const navigate = vi.fn();
    const onAuth = vi.fn();
    const renderer = await render(<AuthPage mode="register" navigate={navigate} onAuth={onAuth} pushToast={vi.fn()} />);
    expect(content(renderer.root)).toContain("Termine ton inscription");
    expect(renderer.root.findAllByType(SocialLogin)).toHaveLength(0);
    act(() => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
    apiFetch.mockResolvedValueOnce({ user: { id: 45 }, destination: "/equipes?invite=server" });
    await act(async () => { await submit(renderer); });
    expect(navigate).toHaveBeenCalledWith("/equipes?invite=server", { replace: true });
    expect(onAuth).toHaveBeenCalledWith({ id: 45 });
  });
});

describe("social account settings", () => {
  it("keeps the password draft and retry action after a failed save in optional settings", async () => {
    const pushToast = vi.fn();
    const user = { id: 1, name: "Player", email: "player@example.fr", email_verified: true };
    const renderer = await render(<AccountSettings user={user} onUserUpdate={vi.fn()} pushToast={pushToast} />);
    const passwordDetails = renderer.root.findAllByType("details").find((node) => content(node.findByType("summary")).trim() === "Changer mon mot de passe");
    expect(passwordDetails.props.open).not.toBe(true);
    edit(renderer, "Mot de passe actuel", "current-password");
    edit(renderer, "Nouveau mot de passe", "next-password");
    edit(renderer, "Confirmer le nouveau mot de passe", "next-password");
    let rejectSave;
    apiFetch.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectSave = reject; }));
    let save;
    await act(async () => { save = passwordDetails.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(button(renderer, "Mise à jour...").props.disabled).toBe(true);
    expect(apiFetch).toHaveBeenLastCalledWith("auth-change-password", { method: "POST", body: JSON.stringify({ currentPassword: "current-password", nextPassword: "next-password" }) });
    await act(async () => { rejectSave(new Error("Mot de passe actuel incorrect.")); await save; });
    expect(renderer.root.findByProps({ label: "Nouveau mot de passe" }).props.value).toBe("next-password");
    expect(renderer.root.findByProps({ label: "Confirmer le nouveau mot de passe" }).props.value).toBe("next-password");
    expect(button(renderer, "Changer le mot de passe").props.disabled).toBe(false);
    expect(pushToast).toHaveBeenCalledWith({ type: "red", title: "Changement impossible", text: "Mot de passe actuel incorrect." });
    apiFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => { await passwordDetails.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(renderer.root.findByProps({ label: "Mot de passe actuel" }).props.value).toBe("");
    expect(renderer.root.findByProps({ label: "Nouveau mot de passe" }).props.value).toBe("");
    expect(renderer.root.findByProps({ label: "Confirmer le nouveau mot de passe" }).props.value).toBe("");
  });

  it("requires the NXT5 password to unlink and keeps an accessible cancel flow", async () => {
    apiFetch.mockResolvedValueOnce({ providers, hasPassword: true, linked: [{ provider: "discord", displayName: "My Discord" }] });
    const renderer = await render(<SocialAccounts />);
    const trigger = { focus: vi.fn() };
    act(() => renderer.root.findByProps({ "aria-label": "Dissocier Discord", type: "button" }).props.onClick({ currentTarget: trigger }));
    expect(renderer.root.findByProps({ label: "Mot de passe NXT5" }).props.autoFocus).toBe(true);
    act(() => renderer.root.findByType("form").props.onKeyDown({ key: "Escape", preventDefault() {} }));
    expect(trigger.focus).toHaveBeenCalled();
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    act(() => renderer.root.findByProps({ "aria-label": "Dissocier Discord", type: "button" }).props.onClick({ currentTarget: trigger }));
    await act(async () => { await submit(renderer); });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    edit(renderer, "Mot de passe NXT5", "my-current-password");
    apiFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => { await submit(renderer); });
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ provider: "discord", currentPassword: "my-current-password" });
    expect(content(renderer.root)).toContain("Ton compte Discord est dissocié");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(focus).toHaveBeenCalled();
  });

  it("blocks unlink and email editing for passwordless users while preserving name editing and email password setup", async () => {
    apiFetch.mockResolvedValueOnce({ providers, hasPassword: false, linked: [{ provider: "google", displayName: "Player" }] });
    const user = { id: 1, name: "Player", email: "player@example.fr", email_verified: true };
    const renderer = await render(<AccountSettings user={user} onUserUpdate={vi.fn()} pushToast={vi.fn()} />);
    expect(renderer.root.findByProps({ "aria-label": "Dissocier Google", type: "button" }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ label: "E-mail" }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ label: "Pseudo" }).props.disabled).not.toBe(true);
    expect(renderer.root.findAllByProps({ label: "Mot de passe actuel" })).toHaveLength(0);
    expect(content(renderer.root)).toContain("associer à nouveau tes comptes externes");
    apiFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => { await button(renderer, "Recevoir un lien pour créer mon mot de passe").props.onClick(); });
    expect(apiFetch).toHaveBeenLastCalledWith("auth-request-password-reset", { method: "POST", body: JSON.stringify({ email: user.email }) });
    expect(content(renderer.root)).toContain("La demande a été envoyée");
  });

  it("announces callback failure without exposing provider protocol details", async () => {
    window.location.search = "?social=account_changed&provider=riot";
    const renderer = await render(<SocialNotice />);
    expect(content(renderer.root)).toContain("Ta session NXT5 a changé");
    expect(renderer.root.findByProps({ role: "alert" }).props.tabIndex).toBe(-1);
    expect(focus).toHaveBeenCalled();
  });

  it("clears the client session after a password reset and explains re-association", async () => {
    window.location.search = "?token=reset-token";
    const onAuth = vi.fn();
    const renderer = await render(<ResetPasswordPage navigate={vi.fn()} onAuth={onAuth} />);
    expect(content(renderer.root)).toContain("dissocie tes comptes Google, Discord, Apple et Riot");
    edit(renderer, "Nouveau mot de passe", "a-long-new-password");
    edit(renderer, "Confirmer", "a-long-new-password");
    apiFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => { await submit(renderer); });
    expect(onAuth).toHaveBeenCalledWith(null);
    expect(content(renderer.root)).toContain("associe à nouveau tes comptes externes dans Paramètres");
  });
});
