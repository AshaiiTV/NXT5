import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import DiscordSettings, { DiscordAdminStatus } from "../components/discord/DiscordSettings.jsx";
import DiscordGameShare from "../components/discord/DiscordGameShare.jsx";
import { DiscordHistory, DiscordPreview, safeDiscordUrl } from "../components/discord/discord-shared.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanup = [];
const connection = { configured: true, enabled: true, connection: { id: "link", guildId: "123", guildName: "Team Discord", paused: false }, channels: [{ id: "channel-1", name: "games", canSend: true }, { id: "channel-denied", name: "staff", canSend: false }, { id: "channel-2", name: "second", canSend: true }], roles: [{ id: "role-1", name: "Joueurs" }], categories: [{ id: "scrim", name: "Scrims" }] };
const route = { id: "route-1", channelId: "channel-1", categoryIds: [], includeHints: false, mentionRoleId: null, enabled: true };
const preview = { message: { content: "NXT5 — Équipe / Adversaire", embeds: [{ title: "Victoire", fields: [{ name: "Durée", value: "21 min" }] }] }, imageDataUrl: "data:image/png;base64,aGVsbG8=", snapshotRevision: 0 };

beforeEach(() => { apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route] } : path.startsWith("team-discord-preview") ? preview : path === "admin-discord" ? { configured: true, enabled: false, connectionsCount: 2, queuedCount: 4, failedCount: 1, unknownCount: 1 } : { deliveries: [] }); });
afterEach(() => { cleanup.splice(0).forEach((fn) => fn()); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function mount(element) { let renderer; await act(async () => { renderer = TestRenderer.create(element, { createNodeMock: () => ({ focus: vi.fn() }) }); }); cleanup.push(() => act(() => renderer.unmount())); return renderer; }
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function button(renderer, label) { return renderer.root.findAllByType("button").find((item) => text(item) === label); }
async function click(renderer, label) { const target = button(renderer, label); expect(target, label).toBeTruthy(); expect(target.props.disabled).not.toBe(true); await act(async () => target.props.onClick()); }
async function choose(renderer, label, value) { const select = renderer.root.findAllByType("label").find((item) => text(item).startsWith(label)).findByType("select"); await act(async () => select.props.onChange({ target: { value } })); }
function posts() { return apiFetch.mock.calls.filter(([, options]) => options?.method === "POST").map(([path, options]) => [path, JSON.parse(options.body)]); }

describe("Discord settings and permissions", () => {
  it("does not request staff-only settings for an ordinary player", async () => {
    const renderer = await mount(<DiscordSettings teamId="team" />);
    expect(renderer.toJSON()).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("allows a disconnected server to be linked again even with its old guild ID retained", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { ...connection, connection: { ...connection.connection, status: "disconnected" }, channels: [] } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(button(renderer, "Créer le code de liaison")).toBeDefined();
    expect(button(renderer, "Mettre en pause")).toBeUndefined();
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-routes"))).toBe(false);
  });

  it("shows unavailable service without offering connection or publication", async () => {
    apiFetch.mockResolvedValue({ configured: false });
    const renderer = await mount(<DiscordSettings teamId="team" teamName="NXT" canManage />);
    expect(text(renderer.root)).toContain("n’est pas encore disponible");
    expect(button(renderer, "Créer le code de liaison")).toBeUndefined();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("reserves connection settings to owners and captains", async () => {
    const renderer = await mount(<DiscordSettings teamId="team" teamName="NXT" canPublish />);
    expect(text(renderer.root)).toContain("Seuls le propriétaire et les capitaines");
    expect(button(renderer, "Déconnecter le serveur")).toBeUndefined();
    expect(button(renderer, "Mettre en pause")).toBeUndefined();
    expect(button(renderer, "Enregistrer les destinations")).toBeUndefined();
    expect(renderer.root.findAllByType("fieldset").some((item) => item.props.disabled)).toBe(true);
    expect(posts()).toEqual([]);
  });

  it("creates a single-use link and disables copying after expiration", async () => {
    vi.useFakeTimers();
    const code = { code: "NXT-ONE-USE", expiresAt: new Date(Date.now() + 10000).toISOString(), installUrl: "https://discord.com/oauth2/authorize?client_id=123" };
    apiFetch.mockImplementation(async (path, options) => options?.method === "POST" ? code : path.startsWith("team-discord-connection") ? { configured: true, connection: null, installUrl: code.installUrl } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Créer le code de liaison");
    expect(posts()).toEqual([["team-discord-connection", { teamId: "team", action: "create-link" }]]);
    expect(text(renderer.root)).toContain(code.code);
    expect(button(renderer, "Copier le code").props.disabled).toBe(false);
    act(() => vi.advanceTimersByTime(10001));
    expect(button(renderer, "Copier le code").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Ce code a expiré");
  });

  it("defaults to no role mention and no review hints, verifies salons and saves exact destinations", async () => {
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    const denied = renderer.root.findAllByType("option").find((item) => item.props.value === "channel-denied");
    expect(denied.props.disabled).toBe(true);
    await click(renderer, "Ajouter un salon");
    await choose(renderer, "Salon Discord · destination 2", "channel-2");
    const form = renderer.root.findByType("form");
    await act(async () => form.props.onSubmit({ preventDefault() {} }));
    const request = posts().find(([path]) => path === "team-discord-routes");
    expect(request[1].routes[1]).toEqual({ channelId: "channel-2", categoryIds: [], includeHints: false, mentionRoleId: null, enabled: true });
  });

  it("clears the previous team's pending code response on team switch", async () => {
    let resolveCode;
    apiFetch.mockImplementation(async (path, options) => options?.method === "POST" ? new Promise((resolve) => { resolveCode = resolve; }) : path.startsWith("team-discord-connection") ? { configured: true, connection: null } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="first" canManage />);
    await click(renderer, "Créer le code de liaison");
    const signal = apiFetch.mock.calls.find(([, options]) => options?.method === "POST")[1].signal;
    await act(async () => renderer.update(<DiscordSettings teamId="second" canManage />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolveCode({ code: "SECRET-FIRST", expiresAt: new Date(Date.now() + 10000).toISOString() }));
    expect(text(renderer.root)).not.toContain("SECRET-FIRST");
    expect(apiFetch.mock.calls.some(([path]) => path === "team-discord-connection?teamId=second")).toBe(true);
  });

  it("shows platform health without a global mutation control", async () => {
    const renderer = await mount(<DiscordAdminStatus />);
    expect(text(renderer.root)).toContain("Envois suspendus");
    expect(text(renderer.root)).toContain("Équipes connectées2");
    expect(renderer.root.findAllByType("button")).toHaveLength(1);
    expect(posts()).toEqual([]);
  });
});

describe("Discord game publication", () => {
  it("does not load or expose a share control without publication rights", async () => {
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" />);
    expect(renderer.toJSON()).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("loads only when opened, requires a verified destination and preview, then posts its revision", async () => {
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" matchName="Ma game" canPublish />);
    expect(apiFetch).not.toHaveBeenCalled();
    await click(renderer, "Partager sur Discord");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    await choose(renderer, "Destination Discord", "route-1");
    expect(button(renderer, "Publier dans #games")).toBeUndefined();
    await click(renderer, "Préparer l’aperçu");
    expect(renderer.root.findByType("img").props.src).toBe(preview.imageDataUrl);
    await click(renderer, "Publier dans #games");
    expect(posts()).toEqual([["team-discord-publish", { teamId: "team", matchId: "game", routeId: "route-1", snapshotRevision: 0 }]]);
    expect(text(renderer.root)).toContain("Publication ajoutée à la file d’envoi");
    expect(button(renderer, "Publier dans #games")).toBeUndefined();
  });

  it("keeps preview available but prevents publication while team is paused", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { ...connection, connection: { ...connection.connection, paused: true } } : path.startsWith("team-discord-routes") ? { routes: [route] } : path.startsWith("team-discord-preview") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Partager sur Discord"); await choose(renderer, "Destination Discord", "route-1"); await click(renderer, "Préparer l’aperçu");
    expect(button(renderer, "Publier dans #games").props.disabled).toBe(true);
    expect(posts()).toEqual([]);
  });

  it("publishes a text-only preview with a valid revision when the image is unavailable", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route] } : path.startsWith("team-discord-preview") ? { ...preview, imageDataUrl: null } : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Partager sur Discord"); await choose(renderer, "Destination Discord", "route-1"); await click(renderer, "Préparer l’aperçu");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(text(renderer.root)).toContain("Visuel indisponible pour cet aperçu");
    await click(renderer, "Publier dans #games");
    expect(posts()[0]).toEqual(["team-discord-publish", { teamId: "team", matchId: "game", routeId: "route-1", snapshotRevision: 0 }]);
  });

  it("cancels old previews when game or its revision changes", async () => {
    let resolvePreview;
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route] } : path.startsWith("team-discord-preview") ? new Promise((resolve) => { resolvePreview = resolve; }) : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="old" canPublish />);
    await click(renderer, "Partager sur Discord"); await choose(renderer, "Destination Discord", "route-1");
    await act(async () => { void button(renderer, "Préparer l’aperçu").props.onClick(); });
    const signal = apiFetch.mock.calls.find(([path]) => path.startsWith("team-discord-preview"))[1].signal;
    await act(async () => renderer.update(<DiscordGameShare teamId="team" matchId="new" canPublish />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolvePreview(preview));
    expect(text(renderer.root)).not.toContain("Victoire");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(posts()).toEqual([]);
  });

  it("does not offer a blind retry for an uncertain delivery", async () => {
    apiFetch.mockResolvedValue({ deliveries: [{ id: "unknown", status: "uncertain", matchLabel: "Game A", canRetry: true }, { id: "failed", status: "blocked", matchLabel: "Game B", canRetry: true }] });
    const renderer = await mount(<DiscordHistory teamId="team" canPublish />);
    expect(text(renderer.root)).toContain("Envoi à vérifier");
    expect(renderer.root.findAllByType("button").filter((item) => text(item) === "Réessayer")).toHaveLength(1);
    await click(renderer, "Réessayer");
    expect(posts()[0]).toEqual(["team-discord-retry", { teamId: "team", deliveryId: "failed", action: "retry" }]);
  });

  it("associates an uncertain delivery only with a valid message ID, never retries blindly", async () => {
    apiFetch.mockResolvedValue({ deliveries: [{ id: "unknown", status: "uncertain", matchLabel: "Game A", canRetry: true, canResolve: true }] });
    const renderer = await mount(<DiscordHistory teamId="team" canPublish />);
    await click(renderer, "Associer le message existant");
    expect(button(renderer, "Réessayer")).toBeUndefined();
    expect(button(renderer, "Vérifier et associer").props.disabled).toBe(true);
    const input = renderer.root.findByType("input");
    act(() => input.props.onChange({ target: { value: "123" } }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(posts()).toEqual([]);
    act(() => input.props.onChange({ target: { value: "123456789012345678" } }));
    expect(button(renderer, "Vérifier et associer").props.disabled).toBe(false);
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(posts()).toEqual([["team-discord-retry", { teamId: "team", deliveryId: "unknown", action: "resolve", messageId: "123456789012345678" }]]);
    expect(text(renderer.root)).toContain("Le message existant a été associé");
  });

  it("requires explicit removal of the selected message and leaves games untouched", async () => {
    apiFetch.mockResolvedValue({ deliveries: [{ id: "sent", status: "succeeded", matchLabel: "Game A", canRemove: true, messageUrl: "https://discord.com/channels/1/2/3" }] });
    const renderer = await mount(<DiscordHistory teamId="team" canPublish />);
    await click(renderer, "Retirer le message");
    expect(posts()).toEqual([]);
    await click(renderer, "Confirmer le retrait");
    expect(posts()[0]).toEqual(["team-discord-retry", { teamId: "team", deliveryId: "sent", action: "remove" }]);
  });

  it("rejects untrusted link destinations and non-PNG preview URLs", async () => {
    for (const url of ["javascript:alert(1)", "https://discord.com.attacker.test/a", "https://secret@discord.com/channels/1", "http://discord.com/channels/1"]) expect(safeDiscordUrl(url)).toBeNull();
    expect(safeDiscordUrl("https://discord.com/channels/1/2/3")).toBe("https://discord.com/channels/1/2/3");
    const renderer = await mount(<DiscordPreview preview={{ ...preview, imageDataUrl: "https://attacker.test/track.png" }} />);
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
  });
});
