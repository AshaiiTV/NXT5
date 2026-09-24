import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import DiscordSettings, { DiscordAdminStatus, discordConnectionState } from "../components/discord/DiscordSettings.jsx";
import DiscordGameShare from "../components/discord/DiscordGameShare.jsx";
import { DiscordHistory, DiscordPreview, safeDiscordUrl } from "../components/discord/discord-shared.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanup = [];
const connection = { configured: true, enabled: true, connection: { id: "link", guildId: "123", guildName: "Team Discord", paused: false, status: "active", configVersion: 3, enabledAt: "2026-09-21T12:00:00Z" }, health: { verified: true }, channels: [{ id: "channel-1", name: "games", canSend: true }, { id: "channel-denied", name: "staff", canSend: false }, { id: "channel-2", name: "second", canSend: true }], roles: [{ id: "role-1", name: "Joueurs" }], categories: [{ id: "scrim", name: "Scrims" }] };
const route = { id: "route-1", channelId: "channel-1", categoryIds: [], includeHints: false, mentionRoleId: null, enabled: true };
const preview = { message: { content: "NXT5 — Équipe / Adversaire", embeds: [{ title: "Victoire", fields: [{ name: "Durée", value: "21 min" }] }] }, imageDataUrl: "data:image/png;base64,aGVsbG8=", snapshotRevision: 0 };
const publishedReceipt = { id: "job-1", status: "succeeded", matchId: "game", channelId: "channel-1", routeId: "route-1", configVersion: 3, revision: 0, messageUrl: "https://discord.com/channels/123/456/789" };

beforeEach(() => { apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-preview") ? preview : path === "team-discord-publish" ? { ok: true, jobs: [publishedReceipt] } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : path === "admin-discord" ? { configured: true, enabled: false, connectionsCount: 2, queuedCount: 4, failedCount: 1, unknownCount: 1 } : { deliveries: [] }); });
afterEach(() => { cleanup.splice(0).forEach((fn) => fn()); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function mount(element) { let renderer; await act(async () => { renderer = TestRenderer.create(element, { createNodeMock: () => ({ focus: vi.fn(), showModal: vi.fn(), close: vi.fn() }) }); }); cleanup.push(() => act(() => renderer.unmount())); return renderer; }
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function button(renderer, label) { return renderer.root.findAllByType("button").find((item) => text(item) === label); }
async function click(renderer, label) { const target = button(renderer, label); expect(target, label).toBeTruthy(); expect(target.props.disabled).not.toBe(true); await act(async () => target.props.onClick()); }
async function clickOverviewAction(renderer) {
  const overview = renderer.root.findByProps({ "aria-label": "Aperçu du bot Discord" });
  const action = overview.findAllByType("button")[0];
  expect(action).toBeDefined();
  await act(async () => action.props.onClick());
}
async function choose(renderer, label, value) { const select = renderer.root.findAllByType("label").find((item) => text(item).startsWith(label)).findByType("select"); await act(async () => select.props.onChange({ target: { value } })); }
function posts() { return apiFetch.mock.calls.filter(([, options]) => options?.method === "POST").map(([path, options]) => [path, JSON.parse(options.body)]); }
function installationTabs(renderer) { return renderer.root.findAllByProps({ role: "tab" }); }
async function openStep(renderer, index) { await act(async () => installationTabs(renderer)[index].props.onClick()); }
function openPanel(renderer) { return renderer.root.findAllByProps({ role: "tabpanel" }).filter((panel) => !panel.props.hidden); }

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
    expect(button(renderer, "Délier cette équipe")).toBeUndefined();
    expect(button(renderer, "Mettre en pause")).toBeUndefined();
    expect(button(renderer, "Enregistrer les salons")).toBeUndefined();
    expect(button(renderer, "Ajouter ce salon")).toBeUndefined();
    expect(renderer.root.findAllByType("label").some((label) => text(label).startsWith("Choisir un salon du serveur"))).toBe(false);
    expect(renderer.root.findAllByType("fieldset").some((item) => item.props.disabled)).toBe(true);
    expect(posts()).toEqual([]);
  });

  it("lets a team skip the invitation when the shared server already has the bot", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { configured: true, enabled: true, connection: null, installUrl: "https://discord.com/oauth2/authorize?client_id=123" } : path.startsWith("team-discord-test") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="second-team" teamName="Équipe B" canManage />);
    expect(text(openPanel(renderer)[0])).toContain("Invite NXT5 sur ton serveur Discord");
    expect(text(openPanel(renderer)[0])).toContain("Si le bot y est déjà présent, passe directement au code de liaison");
    expect(button(renderer, "Créer le code de liaison")).toBeDefined();
    expect(installationTabs(renderer)[0].props["aria-selected"]).toBe(true);
    expect(text(openPanel(renderer)[0])).toContain("Chaque équipe crée son propre code");
    expect(posts()).toEqual([]);
  });

  it("requires confirmation to unlink only the selected team from a shared server", async () => {
    let linked = true;
    apiFetch.mockImplementation(async (path, options) => {
      if (options?.method === "POST") { linked = false; return { ok: true }; }
      if (path.startsWith("team-discord-connection")) return linked ? connection : { ...connection, connection: { ...connection.connection, status: "disconnected" } };
      return path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="first-team" teamName="Équipe A" canManage />);
    expect(text(renderer.root)).toContain("Les réglages et les rôles de cette équipe ne changent pas ceux des autres équipes");
    await click(renderer, "Aide et réglages");
    await click(renderer, "Délier cette équipe");
    expect(posts()).toEqual([]);
    expect(text(renderer.root)).toContain("Le bot reste sur le serveur et les autres équipes gardent leurs liaisons, leurs réglages et leurs envois");
    await click(renderer, "Confirmer la déliaison");
    expect(posts()).toEqual([["team-discord-connection", { teamId: "first-team", action: "disconnect" }]]);
    expect(text(renderer.root)).toContain("Les autres équipes restent connectées");
    expect(button(renderer, "Délier cette équipe")).toBeUndefined();
  });

  it("creates a single-use link and disables copying after expiration", async () => {
    vi.useFakeTimers();
    const code = { code: "NXT-ONE-USE", expiresAt: new Date(Date.now() + 10000).toISOString(), installUrl: "https://discord.com/oauth2/authorize?client_id=123" };
    apiFetch.mockImplementation(async (path, options) => options?.method === "POST" ? code : path.startsWith("team-discord-connection") ? { configured: true, connection: null, installUrl: code.installUrl } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Créer le code de liaison");
    expect(posts()).toEqual([["team-discord-connection", { teamId: "team", action: "create-link" }]]);
    expect(text(renderer.root)).toContain(code.code);
    expect(button(renderer, "Copier la commande").props.disabled).toBe(false);
    act(() => vi.advanceTimersByTime(10001));
    expect(button(renderer, "Copier la commande").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Ce code a expiré");
  });

  it("defaults to no role mention and no review hints, verifies salons and saves exact destinations", async () => {
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(text(renderer.root)).toContain("Ajouter une piste de débrief au message");
    const denied = renderer.root.findAllByType("option").find((item) => item.props.value === "channel-denied");
    expect(denied.props.disabled).toBe(true);
    await choose(renderer, "Choisir un salon du serveur", "channel-2");
    await click(renderer, "Ajouter ce salon");
    const form = renderer.root.findAllByType("form").find((item) => text(item).includes("Enregistrer les salons"));
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

describe("Discord Administrator authorization", () => {
  const guildId = "123456789012345678";
  const installUrl = "https://discord.com/oauth2/authorize?client_id=1551574937159073792&permissions=8&scope=bot%20applications.commands&integration_type=0";
  const linked = { ...connection, installUrl, connection: { ...connection.connection, guildId } };
  const updateLinks = (root) => root.findAllByType("a").filter((link) => text(link).startsWith("Mettre à jour les autorisations"));
  function serve(metadata = linked) {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? metadata : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] });
  }

  it("offers managers a server-locked authorization link in invitation and destinations without a mutation handler", async () => {
    serve();
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    for (const step of [1, 0]) {
      await openStep(renderer, step);
      const panel = openPanel(renderer)[0];
      const [link] = updateLinks(panel);
      expect(link).toBeDefined();
      const url = new URL(link.props.href);
      expect(url.origin).toBe("https://discord.com");
      expect(url.pathname).toBe("/oauth2/authorize");
      expect(url.searchParams.get("permissions")).toBe("8");
      expect(url.searchParams.get("guild_id")).toBe(guildId);
      expect(url.searchParams.get("disable_guild_select")).toBe("true");
      expect(url.searchParams.get("scope")).toBe("bot applications.commands");
      expect(link.props.target).toBe("_blank");
      expect(link.props.rel).toBe("noopener noreferrer");
      expect(link.props.onClick).toBeUndefined();
      expect(text(panel)).toContain("Administrateur donne tous les droits au bot sur ce serveur");
      expect(text(panel)).toContain("Un responsable doit valider cette autorisation dans Discord");
      expect(text(panel)).toContain("les liaisons des équipes sont conservées");
    }
    expect(posts()).toEqual([]);
  });

  it("does not offer authorization updates to staff without management rights", async () => {
    serve();
    const renderer = await mount(<DiscordSettings teamId="team" canPublish />);
    expect(updateLinks(renderer.root)).toHaveLength(0);
    await openStep(renderer, 0);
    expect(updateLinks(renderer.root)).toHaveLength(0);
    expect(posts()).toEqual([]);
  });

  it("does not build an authorization update for an external origin", async () => {
    serve({ ...linked, installUrl: "https://discord.com.evil.test/oauth2/authorize?permissions=8" });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(updateLinks(renderer.root)).toHaveLength(0);
    expect(posts()).toEqual([]);
  });
});

describe("Discord game publication", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { body: { style: { overflow: "" } }, activeElement: null });
    vi.stubGlobal("window", { location: { href: "https://nxt5.test/games" }, history: { state: null, replaceState: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  it("does not load or expose a share control without publication rights", async () => {
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" />);
    expect(renderer.toJSON()).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("keeps the export visible while loading and only enables preview with verified metadata", async () => {
    let resolveConnection, resolveRoutes;
    apiFetch.mockImplementation((path) => path.startsWith("team-discord-connection") ? new Promise((resolve) => { resolveConnection = resolve; }) : new Promise((resolve) => { resolveRoutes = resolve; }));
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    expect(text(renderer.root)).toContain("Chargement de Discord");
    expect(button(renderer, "Préparer l’aperçu")).toBeUndefined();
    await act(async () => resolveConnection(connection));
    expect(button(renderer, "Préparer l’aperçu")).toBeUndefined();
    await act(async () => resolveRoutes({ routes: [route], guildId: "123", configVersion: 3 }));
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
    expect(renderer.root.findByType("select").props.value).toBe("route-1");
    expect(posts()).toEqual([]);
  });

  it.each([
    [{ configured: false }, { routes: [route] }, "Le bot Discord n’est pas encore disponible"],
    [{ ...connection, connection: null }, { routes: [route] }, "Relie le bot au serveur Discord de cette équipe"],
    [{ ...connection, connection: { ...connection.connection, status: "disconnected" } }, { routes: [route] }, "Relie le bot au serveur Discord de cette équipe"],
    [connection, { routes: [] }, "Aucune destination configurée"],
    [connection, { routes: [route], guildId: "another-server", configVersion: 3 }, "Les réglages Discord ont changé"],
    [connection, { routes: [route], guildId: "123", configVersion: 4 }, "Les réglages Discord ont changé"],
  ])("explains unavailable or inconsistent metadata from the visible export action: %o", async (metadata, routes, explanation) => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? metadata : routes);
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    expect(text(renderer.root)).toContain(explanation);
    expect(button(renderer, "Préparer l’aperçu")?.props.disabled).not.toBe(false);
    expect(posts()).toEqual([]);
  });

  it.each(["team-discord-connection", "team-discord-routes"])("offers retry from the export dialog when metadata request %s fails", async (failedPath) => {
    apiFetch.mockImplementation(async (path) => { if (path.startsWith(failedPath)) throw new Error("Service indisponible"); return connection; });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    expect(text(renderer.root)).toContain("Service indisponible");
    expect(button(renderer, "Réessayer")).toBeDefined();
    expect(button(renderer, "Préparer l’aperçu")?.props.disabled).not.toBe(false);
    expect(posts()).toEqual([]);
  });

  it("accepts a saved destination with automatic publication disabled", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [{ ...route, enabled: false }], guildId: "123", configVersion: 3 } : path.startsWith("team-discord-preview") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    expect(text(renderer.root)).toContain("#games · publication manuelle");
    await choose(renderer, "Destination Discord", "route-1");
    await click(renderer, "Préparer l’aperçu");
    expect(button(renderer, "Publier dans #games").props.disabled).toBe(false);
    expect(posts()).toEqual([]);
  });

  it("opens a configured destination without current send permissions and explains the disabled choice", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { ...connection, channels: [{ id: "channel-1", name: "games", canSend: false }] } : path.startsWith("team-discord-routes") ? { routes: [route], guildId: "123", configVersion: 3 } : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    expect(renderer.root.findAllByType("option").find((option) => option.props.value === "route-1").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Les salons sans autorisation d’envoi sont désactivés");
    await choose(renderer, "Destination Discord", "route-1");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    expect(posts()).toEqual([]);
  });

  it("preloads only metadata, opens a dialog, then publishes an explicitly prepared preview", async () => {
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" matchName="Ma game" canPublish />);
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["team-discord-connection?teamId=team", "team-discord-routes?teamId=team"]);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(button(renderer, "Exporter sur Discord").props["aria-haspopup"]).toBe("dialog");
    await click(renderer, "Exporter sur Discord");
    expect(renderer.root.findByType("dialog").props["aria-modal"]).toBe("true");
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-deliveries"))).toBe(false);
    expect(text(renderer.root)).not.toContain("Historique des publications");
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-preview"))).toBe(false);
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
    expect(renderer.root.findByType("select").props.value).toBe("route-1");
    expect(button(renderer, "Publier dans #games")).toBeUndefined();
    await click(renderer, "Préparer l’aperçu");
    expect(renderer.root.findByType("img").props.src).toBe(preview.imageDataUrl);
    await click(renderer, "Publier dans #games");
    expect(posts()).toEqual([["team-discord-publish", { teamId: "team", matchId: "game", routeId: "route-1", snapshotRevision: 0, requestId: expect.any(String) }]]);
    expect(text(renderer.root)).toContain("Publié sur Discord.");
    expect(renderer.root.findAllByType("a").some((link) => link.props.href === publishedReceipt.messageUrl)).toBe(true);
    expect(text(renderer.root)).not.toContain("file d’envoi");
  });

  it.each(["button", "escape"])("allows closing with %s while checking the publication and cancels polling", async (closeWith) => {
    const serveMetadata = apiFetch.getMockImplementation();
    apiFetch.mockImplementation(async (path, options) => {
      if (path === "team-discord-publish") return { jobs: [{ ...publishedReceipt, status: "queued" }] };
      if (path.startsWith("team-discord-deliveries")) return { deliveries: [{ ...publishedReceipt, status: "sending" }] };
      return serveMetadata(path, options);
    });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    await click(renderer, "Préparer l’aperçu");
    await click(renderer, "Publier dans #games");
    expect(button(renderer, "Envoi en cours…").props.disabled).toBe(true);
    const poll = apiFetch.mock.calls.find(([path]) => path.startsWith("team-discord-deliveries"));
    expect(poll).toBeDefined();
    const closeButton = renderer.root.findByProps({ "aria-label": "Fermer la fenêtre" });
    expect(closeButton.props.disabled).toBe(false);
    await act(async () => {
      if (closeWith === "button") closeButton.props.onClick();
      else {
        const target = {};
        renderer.root.findByType("dialog").props.onCancel({ target, currentTarget: target, preventDefault() {} });
      }
    });
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(poll[1].signal.aborted).toBe(true);
    expect(posts()).toHaveLength(1);
  });

  it("keeps preview available but prevents publication while team is paused", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { ...connection, connection: { ...connection.connection, paused: true } } : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-preview") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord"); await choose(renderer, "Destination Discord", "route-1"); await click(renderer, "Préparer l’aperçu");
    expect(button(renderer, "Publier dans #games").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Les envois de l’équipe sont en pause");
    expect(renderer.root.findAllByType("a").some((link) => link.props.href === "/bot-discord")).toBe(true);
    await act(async () => button(renderer, "Publier dans #games").props.onClick());
    expect(posts()).toEqual([]);
  });

  it("requires a choice with multiple team destinations and discards the previous channel preview", async () => {
    const secondRoute = { ...route, id: "route-2", channelId: "channel-2" };
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route, secondRoute], guildId: "123", configVersion: 3 } : path.startsWith("team-discord-preview") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    expect(renderer.root.findByType("select").props.value).toBe("");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    await choose(renderer, "Destination Discord", "route-1");
    await click(renderer, "Préparer l’aperçu");
    await choose(renderer, "Destination Discord", "route-2");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(button(renderer, "Publier dans #second")).toBeUndefined();
    expect(posts()).toEqual([]);
    await click(renderer, "Préparer l’aperçu");
    expect(apiFetch.mock.calls.some(([path]) => path === "team-discord-preview?teamId=team&matchId=game&routeId=route-2")).toBe(true);
    await click(renderer, "Publier dans #second");
    expect(posts()).toEqual([["team-discord-publish", { teamId: "team", matchId: "game", routeId: "route-2", snapshotRevision: 0, requestId: expect.any(String) }]]);
  });

  it("preselects only the destination the bot can use and respects an explicitly cleared choice", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [{ ...route, id: "denied", channelId: "channel-denied" }, route], guildId: "123", configVersion: 3 } : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    expect(renderer.root.findByType("select").props.value).toBe("route-1");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
    await choose(renderer, "Destination Discord", "");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    expect(posts()).toEqual([]);
  });

  it("publishes a text-only preview with a valid revision when the image is unavailable", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-preview") ? { ...preview, imageDataUrl: null } : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord"); await choose(renderer, "Destination Discord", "route-1"); await click(renderer, "Préparer l’aperçu");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(text(renderer.root)).toContain("Visuel indisponible pour cet aperçu");
    await click(renderer, "Publier dans #games");
    expect(posts()[0]).toEqual(["team-discord-publish", { teamId: "team", matchId: "game", routeId: "route-1", snapshotRevision: 0, requestId: expect.any(String) }]);
  });

  it.each([{ matchId: "new" }, { matchId: "old", matchRevision: "updated" }])("cancels old previews when game or its revision changes: %o", async (nextMatch) => {
    let resolvePreview;
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-preview") ? new Promise((resolve) => { resolvePreview = resolve; }) : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="old" canPublish />);
    await click(renderer, "Exporter sur Discord"); await choose(renderer, "Destination Discord", "route-1");
    await act(async () => { void button(renderer, "Préparer l’aperçu").props.onClick(); });
    const signal = apiFetch.mock.calls.find(([path]) => path.startsWith("team-discord-preview"))[1].signal;
    await act(async () => renderer.update(<DiscordGameShare teamId="team" {...nextMatch} canPublish />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolvePreview(preview));
    expect(text(renderer.root)).not.toContain("Victoire");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(posts()).toEqual([]);
  });

  it("keeps the open dialog, selected destination and success notice during refresh and retry", async () => {
    let failure = false, refreshing = false, resolveConnection;
    apiFetch.mockImplementation(async (path, options) => {
      if (options?.method === "POST") { failure = true; return { ok: true, jobs: [publishedReceipt] }; }
      if (path.startsWith("team-discord-connection")) {
        if (failure) throw new Error("Connexion temporairement indisponible");
        return refreshing ? new Promise((resolve) => { resolveConnection = resolve; }) : connection;
      }
      return path.startsWith("team-discord-routes") ? { routes: [route], guildId: "123", configVersion: 3 } : path.startsWith("team-discord-preview") ? preview : { deliveries: [] };
    });
    const renderer = await mount(<DiscordGameShare teamId="team" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord");
    await choose(renderer, "Destination Discord", "route-1");
    await click(renderer, "Préparer l’aperçu");
    await click(renderer, "Publier dans #games");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    expect(text(renderer.root)).toContain("Publié sur Discord.");
    await click(renderer, "Actualiser les salons");
    expect(text(renderer.root)).toContain("Connexion temporairement indisponible");
    failure = false; refreshing = true;
    await click(renderer, "Réessayer");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    expect(renderer.root.findByType("select").props.value).toBe("route-1");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    await act(async () => resolveConnection(connection));
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
    expect(text(renderer.root)).toContain("Publié sur Discord.");
    expect(posts()).toHaveLength(1);
  });

  it("aborts metadata from the previous team and ignores its late response", async () => {
    let resolveOld;
    apiFetch.mockImplementation(async (path) => path === "team-discord-connection?teamId=old" ? new Promise((resolve) => { resolveOld = resolve; }) : { configured: true, connection: null });
    const renderer = await mount(<DiscordGameShare teamId="old" matchId="game" canPublish />);
    const oldSignal = apiFetch.mock.calls[0][1].signal;
    await act(async () => renderer.update(<DiscordGameShare teamId="new" matchId="game" canPublish />));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld(connection));
    await click(renderer, "Exporter sur Discord");
    expect(text(renderer.root)).toContain("Relie le bot au serveur Discord de cette équipe");
    expect(button(renderer, "Préparer l’aperçu")).toBeUndefined();
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-routes"))).toBe(false);
    expect(posts()).toEqual([]);
  });

  it("ignores publication completion after changing the team", async () => {
    let resolvePublish;
    apiFetch.mockImplementation(async (path, options) => options?.method === "POST" ? new Promise((resolve) => { resolvePublish = resolve; }) : path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [route], guildId: "123", configVersion: 3 } : path.startsWith("team-discord-preview") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordGameShare teamId="first" matchId="game" canPublish />);
    await click(renderer, "Exporter sur Discord"); await choose(renderer, "Destination Discord", "route-1"); await click(renderer, "Préparer l’aperçu");
    await click(renderer, "Publier dans #games");
    const signal = apiFetch.mock.calls.find(([, options]) => options?.method === "POST")[1].signal;
    await act(async () => renderer.update(<DiscordGameShare teamId="second" matchId="game" canPublish />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolvePublish({ ok: true }));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(text(renderer.root)).not.toContain("Publication ajoutée à la file d’envoi");
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

  it("previews the image inside its embed and exposes the game action without leaving NXT5", async () => {
    const renderer = await mount(<DiscordPreview preview={{ ...preview, message: {
      embeds: [{ title: "NXT \\*A\\* vs Test", description: "Victoire · 19–13 kills · 28:30", footer: { text: "NXT5 · référence" } }],
      attachments: [{ description: "Résumé de la victoire NXT" }],
      components: [{ type: 1, components: [
        { type: 2, style: 5, label: "Voir la game sur NXT5", url: "https://nxt5.org/statistiques?team=team&match=game" },
        { type: 2, style: 5, label: "Unsafe", url: "javascript:alert(1)" },
        { type: 2, style: 5, label: "Unrelated", url: "https://attacker.test/phishing" },
      ] }],
    } }} />);
    const embed = renderer.root.findByProps({ className: "discord-embed" });
    expect(text(embed)).toContain("NXT *A* vs Test");
    expect(embed.findByType("img").props.alt).toBe("Résumé de la victoire NXT");
    expect(renderer.root.findAllByType("img")).toHaveLength(1);
    const game = renderer.root.findAllByType("a").find((link) => text(link).startsWith("Voir la game"));
    expect(game.props.href).toBe("/statistiques?team=team&match=game");
    expect(text(renderer.root)).not.toMatch(/Unsafe|Unrelated/);
    expect(posts()).toEqual([]);
  });
});

describe("Discord dashboard onboarding", () => {
  const paused = { ...connection, connection: { ...connection.connection, status: "paused", paused: true, enabledAt: null } };
  const installUrl = "https://discord.com/oauth2/authorize?client_id=123";
  const receipt = (requestId, overrides = {}) => ({ requestId, status: "succeeded", routeId: route.id, channelId: route.channelId, guildId: connection.connection.guildId, configVersion: 3, messageUrl: "https://discord.com/channels/1/2/3", ...overrides });

  it("starts with a compact overview and opens activity, command access and settings on demand", async () => {
    const renderer = await mount(<DiscordSettings teamId="team" teamName="Équipe A" canManage />);
    expect(renderer.root.findByProps({ "aria-label": "Aperçu du bot Discord" })).toBeDefined();
    expect(renderer.root.findByProps({ "aria-label": "Configuration du bot" }).props.hidden).toBe(true);
    expect(text(renderer.root)).toContain("Serveur : Team Discord");
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-deliveries"))).toBe(false);
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-role-access"))).toBe(false);

    await click(renderer, "Activité");
    expect(renderer.root.findByProps({ "aria-label": "Historique Discord" })).toBeDefined();
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-deliveries"))).toBe(true);
    await click(renderer, "Retour à l’aperçu");
    await click(renderer, "Accès aux commandes");
    expect(renderer.root.findByProps({ "aria-label": "Accès aux commandes de l’équipe" })).toBeDefined();
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-role-access"))).toBe(true);
    await click(renderer, "Retour à l’aperçu");
    await click(renderer, "Aide et réglages");
    expect(button(renderer, "Délier cette équipe")).toBeDefined();
    expect(posts()).toEqual([]);
  });

  it("opens only the selected named step without completing it or sending requests", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { configured: true, enabled: true, connection: null, installUrl } : path.startsWith("team-discord-test") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(installationTabs(renderer)).toHaveLength(3);
    expect(installationTabs(renderer).map((tab) => tab.props["aria-label"])).toEqual(["Connecter le serveur", "Choisir les salons", "Tester et activer"]);
    expect(installationTabs(renderer)[0].props["aria-selected"]).toBe(true);
    for (const index of [1, 2, 0]) {
      await openStep(renderer, index);
      const selected = installationTabs(renderer)[index];
      expect(openPanel(renderer)).toHaveLength(1);
      expect(openPanel(renderer)[0].props.id).toBe(selected.props["aria-controls"]);
      expect(openPanel(renderer)[0].props["aria-labelledby"]).toBe(selected.props.id);
      expect(installationTabs(renderer).filter((tab) => tab.props["aria-selected"])).toHaveLength(1);
      expect(installationTabs(renderer).filter((tab) => tab.props.tabIndex === 0)).toEqual([selected]);
      expect(renderer.root.findAll((node) => node.props.className?.split(" ").includes("is-complete"))).toHaveLength(0);
    }
    expect(posts()).toEqual([]);
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-routes"))).toBe(false);
  });

  it("keeps the same link command and selected step across navigation and refresh", async () => {
    const code = { code: "KEEP-THIS-CODE", expiresAt: new Date(Date.now() + 600000).toISOString() };
    apiFetch.mockImplementation(async (path, options) => options?.method === "POST" ? code : path.startsWith("team-discord-connection") ? { configured: true, enabled: true, connection: null, installUrl } : path.startsWith("team-discord-test") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Créer le code de liaison");
    await openStep(renderer, 2);
    await openStep(renderer, 1);
    await openStep(renderer, 0);
    await click(renderer, "Actualiser Discord");
    expect(text(openPanel(renderer)[0])).toContain("/nxt connecter code:KEEP-THIS-CODE");
    expect(installationTabs(renderer)[0].props["aria-selected"]).toBe(true);
    expect(posts()).toEqual([["team-discord-connection", { teamId: "team", action: "create-link" }]]);
  });

  it("keeps opening the invitation distinct from a verified server association", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { configured: true, enabled: true, connection: null, installUrl } : path.startsWith("team-discord-test") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" teamName="Équipe A" canManage />);
    const invite = renderer.root.findAllByType("a").find((node) => node.props.href === installUrl);
    await act(async () => invite.props.onClick());
    expect(text(renderer.root)).toContain("Invitation ouverte. Termine l’autorisation dans Discord");
    expect(text(renderer.root)).toContain("aucun serveur relié");
    expect(text(renderer.root)).toContain("Équipe A");
    expect(posts()).toEqual([]);
    expect(renderer.root.findAllByProps({ className: "is-complete" })).toHaveLength(0);
    expect(button(renderer, "Activer la diffusion")).toBeUndefined();
  });

  it("copies the full command and verifies only through bounded reads", async () => {
    vi.useFakeTimers();
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("navigator", { clipboard });
    const code = { code: "AAAA-BBBB-CCCC-DDDD", expiresAt: new Date(Date.now() + 600000).toISOString() };
    apiFetch.mockImplementation(async (path, options) => options?.method === "POST" ? code : path.startsWith("team-discord-connection") ? { configured: true, enabled: true, connection: null, installUrl } : path.startsWith("team-discord-test") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Créer le code de liaison");
    await click(renderer, "Copier la commande");
    expect(clipboard.writeText).toHaveBeenCalledWith("/nxt connecter code:AAAA-BBBB-CCCC-DDDD");
    const before = apiFetch.mock.calls.filter(([path, options]) => path.startsWith("team-discord-connection?") && !options?.method).length;
    await act(async () => vi.advanceTimersByTimeAsync(120000));
    const after = apiFetch.mock.calls.filter(([path, options]) => path.startsWith("team-discord-connection?") && !options?.method).length;
    expect(after - before).toBe(24);
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(apiFetch.mock.calls.filter(([path, options]) => path.startsWith("team-discord-connection?") && !options?.method)).toHaveLength(after);
    expect(posts()).toHaveLength(1);
  });

  it("preserves destination edits across steps and connection refreshes", async () => {
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(renderer.root.findByProps({ "aria-label": "Configuration du bot" }).props.hidden).toBe(true);
    await clickOverviewAction(renderer);
    expect(installationTabs(renderer)[1].props["aria-selected"]).toBe(true);
    await choose(renderer, "Salon Discord · destination 1", "channel-2");
    await openStep(renderer, 2);
    expect(text(openPanel(renderer)[0])).toContain("Enregistre tes salons");
    await openStep(renderer, 0);
    await click(renderer, "Actualiser Discord");
    expect(installationTabs(renderer)[0].props["aria-selected"]).toBe(true);
    await openStep(renderer, 1);
    const select = renderer.root.findAllByType("label").find((node) => text(node).startsWith("Salon Discord · destination 1")).findByType("select");
    expect(select.props.value).toBe("channel-2");
    expect(text(renderer.root)).toContain("Modifications non enregistrées.");
    await openStep(renderer, 2);
    expect(button(renderer, "Envoyer le message de test").props.disabled).toBe(true);
    expect(posts()).toEqual([]);
  });

  it("checks the connection on window focus and removes the listener on unmount", async () => {
    const surface = new EventTarget();
    vi.stubGlobal("window", surface);
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    const reads = () => apiFetch.mock.calls.filter(([path]) => path === "team-discord-connection?teamId=team").length;
    const before = reads();
    await act(async () => surface.dispatchEvent(new Event("focus")));
    expect(reads()).toBe(before + 1);
    expect(posts()).toEqual([]);
    await act(async () => renderer.unmount());
    await act(async () => surface.dispatchEvent(new Event("focus")));
    expect(reads()).toBe(before + 1);
  });

  it("requires an explicit successful test followed by an activation recap", async () => {
    let current = paused;
    let latestTest = null;
    apiFetch.mockImplementation(async (path, options) => {
      const body = options?.body && JSON.parse(options.body);
      if (path === "team-discord-test" && body) { latestTest = receipt(body.requestId); return { test: latestTest }; }
      if (path === "team-discord-connection" && body?.action === "resume") { current = connection; return { ok: true }; }
      if (path.startsWith("team-discord-connection")) return current;
      if (path.startsWith("team-discord-routes")) return { routes: [route], configVersion: 3, guildId: "123" };
      if (path.startsWith("team-discord-test")) return { ...preview, latestTest };
      return { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" teamName="Équipe A" canManage />);
    expect(button(renderer, "Activer la diffusion")).toBeUndefined();
    expect(posts()).toEqual([]);
    await click(renderer, "Envoyer le message de test");
    expect(posts()).toHaveLength(1);
    expect(posts()[0][1]).toMatchObject({ teamId: "team", routeId: route.id });
    expect(posts()[0][1].requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(text(renderer.root)).toContain("Test reçu sur Discord");
    await click(renderer, "Activer la diffusion");
    expect(posts()).toHaveLength(1);
    expect(text(renderer.root)).toContain("Les anciennes parties ne sont pas republiées automatiquement");
    expect(text(renderer.root)).toContain("aucune mention");
    await click(renderer, "Confirmer l’activation");
    expect(posts()[1]).toEqual(["team-discord-connection", { teamId: "team", action: "resume", expectedConfigVersion: 3, expectedGuildId: "123" }]);
  });

  it("cannot activate using a successful test from an older configuration", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: receipt("old", { configVersion: 2 }) } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(button(renderer, "Activer la diffusion")).toBeUndefined();
    expect(text(renderer.root)).toContain("ancienne configuration");
    expect(posts()).toEqual([]);
  });

  it("keeps an in-flight test across steps and reuses its request id after a lost response", async () => {
    let rejectTest;
    let attempts = 0;
    apiFetch.mockImplementation(async (path, options) => {
      if (path === "team-discord-test" && options?.method === "POST") {
        attempts += 1;
        if (attempts === 1) return new Promise((_, reject) => { rejectTest = reject; });
        return { test: receipt(JSON.parse(options.body).requestId, { status: "uncertain", messageUrl: null }) };
      }
      return path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await openStep(renderer, 2);
    const send = button(renderer, "Envoyer le message de test").props.onClick;
    await act(async () => { void send(); void send(); });
    expect(posts()).toHaveLength(1);
    const signal = apiFetch.mock.calls.find(([path, options]) => path === "team-discord-test" && options?.method === "POST")[1].signal;
    await openStep(renderer, 1);
    await openStep(renderer, 2);
    expect(signal.aborted).toBe(false);
    expect(button(renderer, "Vérification du test…").props.disabled).toBe(true);
    await act(async () => rejectTest(new Error("Réponse perdue.")));
    await openStep(renderer, 0);
    await openStep(renderer, 2);
    await click(renderer, "Vérifier ce même test");
    expect(posts()).toHaveLength(2);
    expect(posts()[0][1].requestId).toBe(posts()[1][1].requestId);
    expect(button(renderer, "Envoyer un nouveau test")).toBeUndefined();
    expect(button(renderer, "Activer la diffusion")).toBeUndefined();
  });

  it.each([[409, "DISCORD_TEST_CHANNEL_FORBIDDEN"], [429, "RATE_LIMITED"]])("releases a definitely refused test after HTTP %s so another destination can be selected", async (httpStatus, code) => {
    const secondRoute = { ...route, id: "route-2", channelId: "channel-2" };
    let attemptCount = 0;
    apiFetch.mockImplementation(async (path, options) => {
      if (path === "team-discord-test" && options?.method === "POST") {
        attemptCount += 1;
        if (attemptCount === 1) throw Object.assign(new Error("Test refusé."), { status: httpStatus, code });
        const body = JSON.parse(options.body);
        return { test: receipt(body.requestId, { routeId: secondRoute.id, channelId: secondRoute.channelId }) };
      }
      return path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route, secondRoute], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Envoyer le message de test");
    const selector = renderer.root.findAllByType("label").find((node) => text(node).startsWith("Salon du message de test")).findByType("select");
    expect(selector.props.disabled).toBe(false);
    expect(button(renderer, "Vérifier ce même test")).toBeUndefined();
    await choose(renderer, "Salon du message de test", secondRoute.id);
    await click(renderer, "Envoyer le message de test");
    expect(posts()[1][1].routeId).toBe(secondRoute.id);
    expect(posts()[1][1].requestId).not.toBe(posts()[0][1].requestId);
  });

  it("does not let an uncertain receipt from an old server block a newly linked server", async () => {
    apiFetch.mockImplementation(async (path, options) => {
      if (path === "team-discord-test" && options?.method === "POST") return { test: receipt(JSON.parse(options.body).requestId) };
      return path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: receipt("old-server-test", { guildId: "old-server", status: "uncertain" }) } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(button(renderer, "Vérifier ce même test")).toBeUndefined();
    expect(button(renderer, "Envoyer un nouveau test").props.disabled).toBe(false);
    await click(renderer, "Envoyer un nouveau test");
    expect(posts()[0][1].requestId).not.toBe("old-server-test");
    expect(posts()[0][1].routeId).toBe(route.id);
  });

  it("remembers an ambiguous request per destination while allowing a different salon", async () => {
    const secondRoute = { ...route, id: "route-2", channelId: "channel-2" };
    let attemptCount = 0;
    apiFetch.mockImplementation(async (path, options) => {
      if (path === "team-discord-test" && options?.method === "POST") {
        attemptCount += 1;
        if (attemptCount === 1) throw new Error("Réponse perdue.");
        const body = JSON.parse(options.body);
        return { test: receipt(body.requestId, { routeId: body.routeId, channelId: body.routeId === route.id ? route.channelId : secondRoute.channelId }) };
      }
      return path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route, secondRoute], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Envoyer le message de test");
    await choose(renderer, "Salon du message de test", secondRoute.id);
    await click(renderer, "Envoyer le message de test");
    await choose(renderer, "Salon du message de test", route.id);
    await click(renderer, "Vérifier ce même test");
    expect(posts()[2][1].requestId).toBe(posts()[0][1].requestId);
    expect(posts()[1][1].requestId).not.toBe(posts()[0][1].requestId);
  });

  it("recovers an older destination's pending receipt even when another test is the latest", async () => {
    const secondRoute = { ...route, id: "route-2", channelId: "channel-2" };
    const oldPending = receipt("older-pending-request", { routeId: "deleted-route-id", status: "uncertain" });
    const newest = receipt("newest-request", { routeId: secondRoute.id, channelId: secondRoute.channelId });
    apiFetch.mockImplementation(async (path, options) => {
      if (path === "team-discord-test" && options?.method === "POST") return { test: { ...oldPending, status: "succeeded" } };
      return path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route, secondRoute], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: newest, pendingTests: [oldPending] } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Vérifier ce même test");
    expect(posts()).toEqual([["team-discord-test", { teamId: "team", routeId: "deleted-route-id", requestId: "older-pending-request" }]]);
  });

  it("adopts an existing pending request returned by the server instead of retrying the new id", async () => {
    apiFetch.mockImplementation(async (path, options) => {
      if (path === "team-discord-test" && options?.method === "POST") return { test: receipt("server-existing-request", { status: "uncertain" }) };
      return path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null, pendingTests: [] } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await click(renderer, "Envoyer le message de test");
    await click(renderer, "Vérifier ce même test");
    expect(posts()[0][1].requestId).not.toBe("server-existing-request");
    expect(posts()[1][1].requestId).toBe("server-existing-request");
  });

  it.each([{ configVersion: 4, guildId: "123" }, { configVersion: 3, guildId: "other-server" }])("blocks a recap when the route snapshot disagrees with the connection: %o", async (snapshot) => {
    const existing = { ...paused, connection: { ...paused.connection, enabledAt: connection.connection.enabledAt } };
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? existing : path.startsWith("team-discord-routes") ? { routes: [route], ...snapshot } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(button(renderer, "Reprendre les envois")).toBeUndefined();
    expect(text(renderer.root)).toContain("La connexion et les salons ont changé pendant leur chargement");
    expect(posts()).toEqual([]);
  });

  it("blocks activation while connection or routes refresh and closes an outdated recap", async () => {
    let refreshing = false;
    let resolveConnection, resolveRoutes;
    const existing = { ...paused, connection: { ...paused.connection, enabledAt: connection.connection.enabledAt } };
    apiFetch.mockImplementation(async (path, options) => {
      if (options?.method === "POST") return { ok: true };
      if (path.startsWith("team-discord-connection")) return refreshing ? new Promise((resolve) => { resolveConnection = resolve; }) : existing;
      if (path.startsWith("team-discord-routes")) return refreshing ? new Promise((resolve) => { resolveRoutes = resolve; }) : { routes: [route], configVersion: 3, guildId: "123" };
      return path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await clickOverviewAction(renderer);
    await openStep(renderer, 2);
    await click(renderer, "Reprendre les envois");
    refreshing = true;
    await click(renderer, "Actualiser Discord");
    expect(button(renderer, "Confirmer l’activation").props.disabled).toBe(true);
    await act(async () => resolveConnection({ ...existing, connection: { ...existing.connection, configVersion: 4 } }));
    expect(button(renderer, "Confirmer l’activation")).toBeUndefined();
    expect(button(renderer, "Reprendre les envois")).toBeUndefined();
    await act(async () => resolveRoutes({ routes: [route], configVersion: 4, guildId: "123" }));
    await click(renderer, "Reprendre les envois");
    await click(renderer, "Confirmer l’activation");
    expect(posts()).toEqual([["team-discord-connection", { teamId: "team", action: "resume", expectedConfigVersion: 4, expectedGuildId: "123" }]]);
  });

  it("aborts the previous team's test response without activating the next team", async () => {
    let resolveTest;
    apiFetch.mockImplementation(async (path, options) => path === "team-discord-test" && options?.method === "POST" ? new Promise((resolve) => { resolveTest = resolve; }) : path.startsWith("team-discord-connection") ? paused : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="first" canManage />);
    await act(async () => { void button(renderer, "Envoyer le message de test").props.onClick(); });
    const signal = apiFetch.mock.calls.find(([, options]) => options?.method === "POST")[1].signal;
    await act(async () => renderer.update(<DiscordSettings teamId="second" canManage />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolveTest({ test: receipt("old") }));
    expect(text(renderer.root)).not.toContain("Test reçu sur Discord");
    expect(button(renderer, "Activer la diffusion")).toBeUndefined();
    expect(posts()).toHaveLength(1);
  });

  it("distinguishes a platform suspension, team pause and failed health check", async () => {
    expect(discordConnectionState({ ...connection, enabled: false }, { routes: [route], configVersion: 3, guildId: "123" })[0]).toBe("Service NXT5 suspendu");
    expect(discordConnectionState(paused, { routes: [route], configVersion: 3, guildId: "123" })[0]).toBe("Équipe en pause");
    expect(discordConnectionState({ ...connection, connectionError: "Serveur introuvable" }, { routes: [route], configVersion: 3, guildId: "123" })[0]).toBe("Connexion à vérifier");
    expect(discordConnectionState(connection, { routes: [route], configVersion: 3, guildId: "123" })[0]).toBe("Diffusion active");
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { ...paused, enabled: false } : path.startsWith("team-discord-routes") ? { routes: [route], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: receipt("ok") } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(button(renderer, "Envoyer un nouveau test").props.disabled).toBe(true);
    expect(button(renderer, "Activer la diffusion")).toBeUndefined();
    expect(posts()).toEqual([]);
  });

  it("shows the latest confirmed game instead of treating a pending job as a publication", async () => {
    apiFetch.mockResolvedValue({ deliveries: [{ id: "new", status: "queued", matchLabel: "Game en attente" }, { id: "old", status: "succeeded", matchLabel: "Adversaire A", channelName: "games", messageUrl: "https://discord.com/channels/1/2/3" }] });
    const renderer = await mount(<DiscordHistory teamId="team" showSummary />);
    const summary = renderer.root.findByProps({ className: "discord-publication-summary" });
    expect(text(summary)).toContain("Adversaire A");
    expect(text(summary)).not.toContain("Game en attente");
  });
});

describe("Discord channel picker", () => {
  const picker = (renderer) => renderer.root.findAllByType("label").find((label) => text(label).startsWith("Choisir un salon du serveur")).findByType("select");
  const routeFields = (renderer) => renderer.root.findAllByProps({ className: "discord-route" }).filter((node) => node.type === "fieldset");
  const openSalons = clickOverviewAction;

  it("shows the server selector immediately and only saves an explicitly added draft channel", async () => {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? connection : path.startsWith("team-discord-routes") ? { routes: [], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await openSalons(renderer);
    expect(picker(renderer).props.value).toBe("");
    expect(picker(renderer).props.required).not.toBe(true);
    expect(button(renderer, "Ajouter ce salon").props.disabled).toBe(true);
    expect(button(renderer, "Ajouter un salon")).toBeUndefined();
    expect(routeFields(renderer)).toHaveLength(0);
    await choose(renderer, "Choisir un salon du serveur", "channel-2");
    expect(posts()).toEqual([]);
    await click(renderer, "Ajouter ce salon");
    expect(picker(renderer).props.value).toBe("");
    expect(routeFields(renderer)).toHaveLength(1);
    expect(routeFields(renderer)[0].findAllByType("select")[0].props.value).toBe("channel-2");
    expect(posts()).toEqual([]);
    await act(async () => renderer.root.findAllByType("form").find((item) => text(item).includes("Enregistrer les salons")).props.onSubmit({ preventDefault() {} }));
    expect(posts()).toEqual([["team-discord-routes", { teamId: "team", routes: [{ channelId: "channel-2", categoryIds: [], includeHints: false, mentionRoleId: null, enabled: true }] }]]);
  });

  it("marks denied and already added channels and prevents duplicates even with repeated clicks", async () => {
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await openSalons(renderer);
    const options = picker(renderer).findAllByType("option");
    const added = options.find((option) => option.props.value === "channel-1");
    const denied = options.find((option) => option.props.value === "channel-denied");
    expect(added.props.disabled).toBe(true);
    expect(text(added)).toContain("#games · déjà ajouté");
    expect(denied.props.disabled).toBe(true);
    expect(text(denied)).toContain("autorisation manquante");
    for (const forbidden of ["channel-1", "channel-denied"]) {
      await choose(renderer, "Choisir un salon du serveur", forbidden);
      expect(button(renderer, "Ajouter ce salon").props.disabled).toBe(true);
      await act(async () => button(renderer, "Ajouter ce salon").props.onClick());
      expect(routeFields(renderer)).toHaveLength(1);
    }
    await choose(renderer, "Choisir un salon du serveur", "channel-2");
    const add = button(renderer, "Ajouter ce salon").props.onClick;
    await act(async () => { add(); add(); });
    expect(routeFields(renderer)).toHaveLength(2);
    expect(posts()).toEqual([]);
  });

  it("enforces ten destinations and allows another channel after removing one", async () => {
    const channels = Array.from({ length: 11 }, (_, index) => ({ id: `channel-${index}`, name: `salon-${index}`, canSend: true }));
    const routes = channels.slice(0, 10).map((channel, index) => ({ ...route, id: `route-${index}`, channelId: channel.id }));
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? { ...connection, channels } : path.startsWith("team-discord-routes") ? { routes, configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await openSalons(renderer);
    expect(picker(renderer).props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Limite atteinte : dix salons par équipe");
    await choose(renderer, "Choisir un salon du serveur", "channel-10");
    await act(async () => button(renderer, "Ajouter ce salon").props.onClick());
    expect(routeFields(renderer)).toHaveLength(10);
    await click(renderer, "Supprimer cette destination");
    expect(picker(renderer).props.disabled).toBe(false);
    await click(renderer, "Ajouter ce salon");
    expect(routeFields(renderer)).toHaveLength(10);
    expect(posts()).toEqual([]);
  });

  it("keeps the channel draft while refreshing and across the installation steps", async () => {
    let refreshing = false, resolveChannels;
    apiFetch.mockImplementation(async (path) => {
      if (path.startsWith("team-discord-connection")) return refreshing ? new Promise((resolve) => { resolveChannels = resolve; }) : connection;
      return path.startsWith("team-discord-routes") ? { routes: [], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? preview : { deliveries: [] };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await openSalons(renderer);
    await choose(renderer, "Choisir un salon du serveur", "channel-2");
    await click(renderer, "Ajouter ce salon");
    await openStep(renderer, 0);
    await openStep(renderer, 1);
    refreshing = true;
    await click(renderer, "Actualiser les salons");
    expect(text(openPanel(renderer)[0])).toContain("Actualisation des salons du serveur");
    expect(button(renderer, "Ajouter ce salon").props.disabled).toBe(true);
    expect(button(renderer, "Enregistrer les salons").props.disabled).toBe(true);
    expect(routeFields(renderer)[0].findAllByType("select")[0].props.value).toBe("channel-2");
    await act(async () => resolveChannels(connection));
    expect(routeFields(renderer)[0].findAllByType("select")[0].props.value).toBe("channel-2");
    expect(button(renderer, "Enregistrer les salons").props.disabled).toBe(false);
    expect(posts()).toEqual([]);
  });

  it.each([
    [{ channels: undefined }, "La liste des salons n’a pas pu être chargée"],
    [{ channels: [], connectionError: "Droits du serveur indisponibles." }, "Droits du serveur indisponibles."],
    [{ channels: [] }, "Aucun salon disponible sur ce serveur"],
    [{ channels: [{ id: "denied", name: "privé", canSend: false }] }, "Aucun salon ne permet l’envoi"],
  ])("distinguishes channel loading failures, empty lists and missing permissions: %o", async (metadata, explanation) => {
    let recovered = false;
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? recovered ? connection : { ...connection, ...metadata } : path.startsWith("team-discord-routes") ? { routes: [], configVersion: 3, guildId: "123" } : path.startsWith("team-discord-test") ? preview : { deliveries: [] });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    await openStep(renderer, 1);
    const panel = openPanel(renderer)[0];
    expect(text(panel)).toContain(explanation);
    expect(button(renderer, "Ajouter ce salon").props.disabled).toBe(true);
    if (metadata.connectionError || metadata.channels === undefined) expect(text(panel)).not.toContain("Aucun salon disponible sur ce serveur");
    recovered = true;
    await click(renderer, "Actualiser les salons");
    expect(picker(renderer).props.disabled).toBe(false);
    expect(picker(renderer).props.value).toBe("");
    await choose(renderer, "Choisir un salon du serveur", "channel-2");
    expect(button(renderer, "Ajouter ce salon").props.disabled).toBe(false);
    expect(posts()).toEqual([]);
  });

  it("resets a pending channel selection when switching teams on the same server", async () => {
    const renderer = await mount(<DiscordSettings teamId="first-team" canManage />);
    await openSalons(renderer);
    await choose(renderer, "Choisir un salon du serveur", "channel-2");
    await act(async () => renderer.update(<DiscordSettings teamId="second-team" canManage />));
    await openSalons(renderer);
    expect(picker(renderer).props.value).toBe("");
    expect(button(renderer, "Ajouter ce salon").props.disabled).toBe(true);
    expect(posts()).toEqual([]);
    expect(apiFetch.mock.calls.some(([path]) => path === "team-discord-routes?teamId=second-team")).toBe(true);
  });
});


describe("Discord clarity and truthful overview", () => {
  const commandsConnection = { ...connection, connection: { ...connection.connection, commandChannelId: "channel-1" } };
  function serve(metadata, routes = [route]) {
    apiFetch.mockImplementation(async (path) => path.startsWith("team-discord-connection") ? metadata
      : path.startsWith("team-discord-routes") ? { routes, configVersion: 3, guildId: "123" }
      : path.startsWith("team-discord-test") ? { ...preview, latestTest: null } : { deliveries: [] });
  }

  it("does not announce manual publishing or a complete setup without a saved destination", async () => {
    serve(commandsConnection, []);
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    const overview = renderer.root.findByProps({ "aria-label": "Aperçu du bot Discord" });
    expect(text(overview)).toContain("Aucun salon de publication enregistré");
    expect(text(overview)).toContain("Publications à configurer");
    expect(text(overview)).not.toContain("Tout est en place");
    expect(discordConnectionState(commandsConnection, { routes: [] })[0]).toBe("Publications à configurer");
    expect(posts()).toEqual([]);
  });

  it("does not announce readiness when a saved publication channel loses its send permission", async () => {
    const metadata = { ...commandsConnection, connection: { ...commandsConnection.connection, commandChannelId: "channel-2" }, channels: commandsConnection.channels.map((channel) => channel.id === route.channelId ? { ...channel, canSend: false } : channel) };
    serve(metadata);
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    const overview = renderer.root.findByProps({ "aria-label": "Aperçu du bot Discord" });
    expect(text(overview)).toContain("Salons à vérifier");
    expect(text(overview)).not.toContain("Tout est en place");
    expect(button(renderer, "Vérifier les salons").props.disabled).toBe(false);
    expect(posts()).toEqual([]);
  });

  it("keeps activity and help reachable for staff after an team has been disconnected", async () => {
    serve({ ...connection, connection: { ...connection.connection, status: "disconnected" } });
    const renderer = await mount(<DiscordSettings teamId="team" canPublish />);
    const nav = renderer.root.findByProps({ "aria-label": "Gestion du bot de l’équipe" });
    expect(text(nav)).toContain("Activité");
    expect(text(nav)).not.toContain("Salons");
    await click(renderer, "Activité");
    expect(renderer.root.findByProps({ "aria-label": "Historique Discord" })).toBeDefined();
    expect(posts()).toEqual([]);
  });

  it("shows failed initial verification as an error instead of an endless loading state", async () => {
    apiFetch.mockRejectedValue(new Error("Réseau indisponible"));
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    expect(text(renderer.root)).toContain("Vérification impossible");
    expect(text(renderer.root)).not.toContain("Vérification…");
    expect(button(renderer, "Actualiser Discord").props.disabled).toBe(false);
  });

  it("copies a complete command and opens the correct team channel without publishing", async () => {
    serve(commandsConnection);
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("navigator", { clipboard });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    const copy = renderer.root.findByProps({ "aria-label": "Copier la commande de dernière partie" });
    await act(async () => copy.props.onClick());
    expect(clipboard.writeText).toHaveBeenCalledWith("/nxt voir sujet:derniere");
    expect(text(renderer.root)).toContain("Commande copiée");
    expect(renderer.root.findAllByType("a").find((link) => link.props.href === "https://discord.com/channels/123/channel-1").props.target).toBe("_blank");
    expect(posts()).toEqual([]);
  });

  it("makes a destination refresh failure actionable without declaring the bot ready", async () => {
    let fail = false;
    apiFetch.mockImplementation(async (path) => {
      if (path.startsWith("team-discord-connection")) return commandsConnection;
      if (path.startsWith("team-discord-routes")) {
        if (fail) throw new Error("Salons indisponibles");
        return { routes: [route], configVersion: 3, guildId: "123" };
      }
      return { ...preview, latestTest: null };
    });
    const renderer = await mount(<DiscordSettings teamId="team" canManage />);
    fail = true;
    await click(renderer, "Actualiser Discord");
    const overview = renderer.root.findByProps({ "aria-label": "Aperçu du bot Discord" });
    expect(text(overview)).toContain("Publications à vérifier");
    expect(text(overview)).toContain("#games");
    expect(text(overview)).not.toContain("Tout est en place");
    expect(button(renderer, "Vérifier les salons").props.disabled).toBe(false);
    await click(renderer, "Vérifier les salons");
    expect(text(openPanel(renderer)[0])).toContain("Salons indisponibles");
    expect(posts()).toEqual([]);
  });
});
