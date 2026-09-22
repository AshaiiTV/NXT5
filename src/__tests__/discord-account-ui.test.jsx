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
});
afterEach(() => { if (view) act(() => view.unmount()); view = null; vi.unstubAllGlobals(); });
async function render() { await act(async () => { view = TestRenderer.create(<DiscordAccount user={{ id: "me", account_name: "mon-compte" }} />); }); }

describe("personal Discord account consent", () => {
  it("shows both accounts and waits for an explicit NXT5 confirmation before submitting", async () => {
    const response = { link: null, accountName: "mon-compte", request: { discordUserId: "100000000000000001", discordLabel: "Joueur Discord", expiresAt: "2026-09-22T18:30:00Z", prepared: false } };
    api.fetch.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, request: { ...response.request, prepared: true } });
    await render();
    expect(text()).toContain("mon-compte"); expect(text()).toContain("Joueur Discord");
    expect(api.fetch).toHaveBeenCalledOnce();
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/bot-discord");
    await act(async () => button("Confirmer mon compte NXT5").props.onClick());
    expect(api.fetch).toHaveBeenLastCalledWith("discord-account", { method: "POST", body: JSON.stringify({ token }) });
    expect(text()).toContain("Reviens dans Discord");
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
    await act(async () => button("Délier mon compte").props.onClick());
    expect(api.fetch).toHaveBeenCalledOnce();
    await act(async () => button("Confirmer la déliaison").props.onClick());
    expect(api.fetch).toHaveBeenLastCalledWith("discord-account", { method: "DELETE" });
    expect(text()).not.toContain("Compte lié");
    expect(text()).toContain("/nxt compte lier");
  });
});
