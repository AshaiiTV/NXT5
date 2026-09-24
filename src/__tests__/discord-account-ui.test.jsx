import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import DiscordAccount from "../components/discord/DiscordAccount.jsx";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../api/client.js", () => ({ apiFetch: api.fetch }));
const token = "b".repeat(48);
let view;
const text = () => JSON.stringify(view.toJSON());
const button = (label) => view.root.findAllByType("button").find(node => node.props.children.flat?.(2).includes(label) || node.props.children === label);
beforeEach(() => {
  api.fetch.mockReset().mockResolvedValue({ link: null });
  vi.stubGlobal("window", { location: { href: "https://nxt5.test/bot-discord?lier=" + token, search: "?lier=" + token }, history: { state: null, replaceState: vi.fn() } });
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { if (view) act(() => view.unmount()); view = null; vi.unstubAllGlobals(); });
async function render() { await act(async () => { view = TestRenderer.create(<DiscordAccount user={{ id: "me", account_name: "mon-compte" }} />); }); }

describe("personal Discord account consent", () => {
  it("keeps the personal setup compact and copies the existing command without submitting consent", async () => {
    await render();
    expect(text()).toContain("Toi sur Discord");
    expect(text()).toContain("Compte non lié");
    expect(view.root.findByType("details").props.open).toBeUndefined();
    expect(view.root.findAllByType("li")).toHaveLength(3);
    expect(button("Confirmer mon compte NXT5")).toBeUndefined();
    await act(async () => button("Copier /nxt lier").props.onClick());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("/nxt lier");
    expect(view.root.findByProps({ role: "status" }).children.join("")).toContain("Commande copiée");
    expect(api.fetch).toHaveBeenCalledOnce();
  });
  it("explains how to continue when clipboard access is denied", async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("Permission denied"));
    await render();
    await act(async () => button("Copier /nxt lier").props.onClick());
    expect(text()).toContain("Saisis /nxt lier directement dans Discord");
    expect(button("Copier /nxt lier")).toBeDefined();
    expect(text()).not.toContain("Commande copiée");
    expect(api.fetch).toHaveBeenCalledOnce();
  });
  it("shows both accounts and waits for an explicit NXT5 confirmation before submitting", async () => {
    const response = { link: null, accountName: "mon-compte", request: { discordUserId: "100000000000000001", discordLabel: "Joueur Discord", expiresAt: "2026-09-22T18:30:00Z", prepared: false } };
    api.fetch.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, request: { ...response.request, prepared: true } });
    await render();
    expect(text()).toContain("mon-compte"); expect(text()).toContain("Joueur Discord");
    expect(text()).toContain("À confirmer ici");
    expect(api.fetch).toHaveBeenCalledOnce();
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/bot-discord");
    await act(async () => button("Confirmer mon compte NXT5").props.onClick());
    expect(api.fetch).toHaveBeenLastCalledWith("discord-account", { method: "POST", body: JSON.stringify({ token }) });
    expect(text()).toContain("Reviens dans Discord");
    expect(text()).toContain("À terminer dans Discord");
    expect(text()).not.toContain("Compte lié");
  });
  it("never labels a failed confirmation as successful", async () => {
    api.fetch.mockResolvedValueOnce({ request: { discordUserId: "100000000000000001", discordLabel: "Joueur", expiresAt: "2026-09-22T18:30:00Z" } }).mockRejectedValueOnce(new Error("Le lien a expiré."));
    await render();
    await act(async () => button("Confirmer mon compte NXT5").props.onClick());
    expect(view.root.findByProps({ role: "alert" }).children.join("")).toContain("expiré");
    expect(text()).not.toContain("Compte NXT5 confirmé");
  });
  it("requires a second click to revoke an existing link and reflects the result", async () => {
    api.fetch.mockResolvedValueOnce({ link: { discord_user_id: "100000000000000001", discord_label: "Moi" } }).mockResolvedValueOnce({ ok: true });
    await render();
    expect(text()).toContain("Compte lié");
    expect(text()).toContain("Moi");
    expect(text()).not.toContain("Identifiant Discord");
    expect(button("Délier mon compte")).toBeUndefined();
    expect(button("Gérer").props["aria-expanded"]).toBe(false);
    await act(async () => button("Gérer").props.onClick());
    expect(button("Fermer la gestion").props["aria-expanded"]).toBe(true);
    expect(text()).toContain("Identifiant Discord");
    await act(async () => button("Délier mon compte").props.onClick());
    expect(api.fetch).toHaveBeenCalledOnce();
    await act(async () => button("Confirmer la déliaison").props.onClick());
    expect(api.fetch).toHaveBeenLastCalledWith("discord-account", { method: "DELETE" });
    expect(text()).not.toContain("Compte lié");
    expect(text()).toContain("/nxt lier");
  });
  it("keeps account management secondary and clears an unconfirmed unlink when closed", async () => {
    api.fetch.mockResolvedValue({ link: { discord_user_id: "100000000000000001", discord_label: "Moi" } });
    await render();
    await act(async () => button("Gérer").props.onClick());
    await act(async () => button("Délier mon compte").props.onClick());
    expect(button("Confirmer la déliaison")).toBeDefined();
    await act(async () => button("Fermer la gestion").props.onClick());
    expect(button("Confirmer la déliaison")).toBeUndefined();
    expect(api.fetch).toHaveBeenCalledOnce();
    await act(async () => button("Gérer").props.onClick());
    expect(button("Délier mon compte")).toBeDefined();
    expect(button("Confirmer la déliaison")).toBeUndefined();
  });
  it("only marks the account linked after Discord's final confirmation is reported by the server", async () => {
    api.fetch.mockResolvedValueOnce({ link: null, request: { discordUserId: "100000000000000001", discordLabel: "Joueur", expiresAt: "2026-09-24T18:30:00Z", prepared: true } })
      .mockResolvedValueOnce({ link: { discord_user_id: "100000000000000001", discord_label: "Joueur" } });
    await render();
    expect(text()).toContain("À terminer dans Discord");
    expect(text()).not.toContain("Compte lié");
    await act(async () => button("J’ai confirmé dans Discord · Vérifier").props.onClick());
    expect(api.fetch).toHaveBeenLastCalledWith(`discord-account?token=${token}`);
    expect(text()).toContain("Compte lié");
    expect(text()).not.toContain("À terminer dans Discord");
  });
  it("offers a retry after a failed initial load without asserting the account is unlinked", async () => {
    api.fetch.mockRejectedValueOnce(new Error("Le service est indisponible.")).mockResolvedValueOnce({ link: { discord_user_id: "100000000000000001", discord_label: "Moi" } });
    await render();
    expect(view.root.findByProps({ role: "alert" }).children.join("")).toContain("indisponible");
    expect(text()).toContain("À vérifier");
    expect(text()).not.toContain("Compte non lié");
    await act(async () => button("Réessayer la vérification").props.onClick());
    expect(text()).toContain("Compte lié");
    expect(view.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  });
});
