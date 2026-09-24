import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import DiscordGroupShare from "../components/discord/DiscordGroupShare.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanup = [];
const requestId = "a76e119d-dfa4-4897-8e47-a1ee1ac2a722";
const connection = { configured: true, enabled: true, connection: { guildId: "123", configVersion: 3, status: "active", paused: false }, health: { verified: true }, channels: [{ id: "channel-1", name: "games", canSend: true }, { id: "channel-2", name: "second", canSend: true }, { id: "denied", name: "staff", canSend: false }] };
const route = { id: "route-1", channelId: "channel-1", enabled: false };
const secondRoute = { id: "route-2", channelId: "channel-2", enabled: true };
const routes = { guildId: "123", configVersion: 3, routes: [route] };
const preview = { previewToken: "signed-group-preview", message: { embeds: [{ title: "Bilan du bloc scrim", description: "2 parties · 1 victoire · 1 défaite" }], attachments: [{ description: "Résumé du groupe" }], components: [{ type: 1, components: [{ type: 2, style: 5, label: "Voir le groupe sur NXT5", url: "https://nxt5.org/games?team=team&archive=group" }] }] }, imageDataUrl: "data:image/png;base64,aGVsbG8=" };
const publication = { requestId, status: "succeeded", messageUrl: "https://discord.com/channels/1/2/3" };
function serve({ metadata = connection, destinations = routes, makePreview = () => preview, publish = () => ({ publication }), publications = [] } = {}) {
  apiFetch.mockImplementation(async (path, options) => {
    if (path === "team-discord-group-publish" && options?.method === "POST") return publish(JSON.parse(options.body));
    if (path.startsWith("team-discord-connection?")) return metadata;
    if (path.startsWith("team-discord-routes?")) return destinations;
    if (path.startsWith("team-discord-group-deliveries?")) return { publications };
    if (path.startsWith("team-discord-group-preview?")) return makePreview(path, options);
    throw new Error(`Unexpected request: ${path}`);
  });
}
beforeEach(() => {
  vi.stubGlobal("document", { body: { style: { overflow: "" } }, activeElement: null });
  vi.stubGlobal("window", { location: { href: "https://nxt5.test/games?archive=group" }, history: { state: null, replaceState: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => requestId) });
  serve();
});
afterEach(() => { cleanup.splice(0).forEach((fn) => fn()); vi.resetAllMocks(); vi.unstubAllGlobals(); });
async function mount(props = {}) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<DiscordGroupShare teamId="team" archiveId="group" archiveName="Bloc scrim" canPublish {...props} />, { createNodeMock: () => ({ focus: vi.fn(), showModal: vi.fn(), close: vi.fn() }) }); });
  cleanup.push(() => act(() => renderer.unmount()));
  return renderer;
}
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function button(renderer, label) { return renderer.root.findAllByType("button").find((node) => text(node) === label || node.props["aria-label"] === label); }
async function click(renderer, label) { const target = button(renderer, label); expect(target, label).toBeTruthy(); expect(target.props.disabled).not.toBe(true); await act(async () => { await target.props.onClick(); }); }
async function choose(renderer, value) { await act(async () => renderer.root.findByType("select").props.onChange({ target: { value } })); }
function posts() { return apiFetch.mock.calls.filter(([, options]) => options?.method === "POST").map(([path, options]) => [path, JSON.parse(options.body)]); }
async function prepare(renderer) { await click(renderer, "Exporter sur Discord"); await click(renderer, "Préparer l’aperçu"); }

describe("Discord group export", () => {
  it.each([{ canPublish: false }, { teamId: "" }, { archiveId: "" }])("does not render or load without the selected group and publication rights: %o", async (props) => {
    const renderer = await mount(props);
    expect(renderer.toJSON()).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("loads metadata only after opening and automatically selects the single sendable team channel", async () => {
    serve({ destinations: { ...routes, routes: [route, { id: "denied-route", channelId: "denied" }] } });
    const renderer = await mount();
    expect(button(renderer, "Exporter sur Discord")).toBeDefined();
    expect(apiFetch).not.toHaveBeenCalled();
    await click(renderer, "Exporter sur Discord");
    expect(renderer.root.findByType("select").props.value).toBe("route-1");
    expect(renderer.root.findAllByType("option").find((option) => option.props.value === "denied-route").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("#games · publication manuelle");
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(expect.arrayContaining(["team-discord-connection?teamId=team", "team-discord-routes?teamId=team", "team-discord-group-deliveries?teamId=team&archiveId=group"]));
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-group-preview"))).toBe(false);
    expect(posts()).toEqual([]);
    await choose(renderer, "");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
  });

  it("requires a choice among several channels and clears an old channel preview", async () => {
    serve({ destinations: { ...routes, routes: [route, secondRoute] } });
    const renderer = await mount();
    await click(renderer, "Exporter sur Discord");
    expect(renderer.root.findByType("select").props.value).toBe("");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    await choose(renderer, "route-1"); await click(renderer, "Préparer l’aperçu");
    await choose(renderer, "route-2");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(button(renderer, "Publier dans #second")).toBeUndefined();
    expect(posts()).toEqual([]);
    await click(renderer, "Préparer l’aperçu");
    expect(apiFetch).toHaveBeenCalledWith("team-discord-group-preview?teamId=team&archiveId=group&routeId=route-2", expect.objectContaining({ timeoutMs: 60000, signal: expect.any(AbortSignal) }));
  });

  it("prepares one group preview then publishes the exact signed preview and stable request identity", async () => {
    const renderer = await mount(); await prepare(renderer);
    expect(posts()).toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith("team-discord-group-preview?teamId=team&archiveId=group&routeId=route-1", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const link = renderer.root.findAllByType("a").find((node) => text(node).startsWith("Voir le groupe sur NXT5"));
    expect(link.props.href).toBe("/games?team=team&archive=group");
    expect(renderer.root.findByType("img").props.alt).toBe("Résumé du groupe");
    await click(renderer, "Publier dans #games");
    expect(posts()).toEqual([["team-discord-group-publish", { teamId: "team", archiveId: "group", routeId: "route-1", requestId, previewToken: preview.previewToken }]]);
    expect(text(renderer.root)).toContain("Le bilan du groupe est publié sur Discord");
    expect(renderer.root.findAllByType("a").some((node) => node.props.href === publication.messageUrl)).toBe(true);
    expect(button(renderer, "Publier dans #games")).toBeUndefined();
  });

  it.each(["succeeded", "not_found", "uncertain"])("verifies the same request after a lost response without republishing; status %s", async (status) => {
    serve({ publish: (body) => { if (body.action !== "verify") throw new Error("Réponse perdue"); return { publication: { ...publication, status } }; } });
    const renderer = await mount(); await prepare(renderer); await click(renderer, "Publier dans #games");
    expect(text(renderer.root)).toContain("Réponse perdue");
    expect(button(renderer, "Vérifier ce même envoi")).toBeDefined();
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    expect(renderer.root.findByType("select").props.disabled).toBe(true);
    await click(renderer, "Vérifier ce même envoi");
    expect(posts()[1]).toEqual(["team-discord-group-publish", { teamId: "team", archiveId: "group", requestId, action: "verify" }]);
    expect(posts().filter(([, body]) => !body.action)).toHaveLength(1);
    if (status === "succeeded") expect(text(renderer.root)).toContain("Le bilan du groupe est publié sur Discord");
    if (status === "not_found") expect(text(renderer.root)).toContain("Aucun envoi enregistré pour cette demande");
    expect(Boolean(button(renderer, "Vérifier ce même envoi"))).toBe(status === "uncertain");
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(status === "uncertain");
  });

  it("verifies an uncertain historical group delivery using only its stored request ID", async () => {
    serve({ publications: [{ id: "history", requestId: "old-request", status: "uncertain", channelName: "#games", lastError: "Réponse Discord inconnue" }] });
    const renderer = await mount(); await click(renderer, "Exporter sur Discord");
    expect(text(renderer.root)).toContain("Réponse Discord inconnue");
    await click(renderer, "Vérifier l’envoi");
    expect(posts()).toEqual([["team-discord-group-publish", { teamId: "team", archiveId: "group", requestId: "old-request", action: "verify" }]]);
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith("team-discord-group-preview"))).toBe(false);
  });

  it.each(["receipt", "history"])("associates an existing Discord message through verification of the same %s identity", async (source) => {
    const oldRequestId = source === "receipt" ? requestId : "old-request";
    serve({
      publications: source === "history" ? [{ id: "history", requestId: oldRequestId, status: "uncertain" }] : [],
      publish: (body) => body.action === "verify" ? { publication: { ...publication, requestId: oldRequestId } } : { publication: { ...publication, status: "uncertain" } },
    });
    const renderer = await mount();
    if (source === "receipt") { await prepare(renderer); await click(renderer, "Publier dans #games"); }
    else await click(renderer, "Exporter sur Discord");
    const before = posts().length;
    await click(renderer, "Associer le message existant");
    const input = renderer.root.findByType("input");
    expect(button(renderer, "Vérifier et associer").props.disabled).toBe(true);
    await act(async () => input.props.onChange({ target: { value: "123" } }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(posts()).toHaveLength(before);
    await act(async () => input.props.onChange({ target: { value: " 123456789012345678 " } }));
    expect(button(renderer, "Vérifier et associer").props.disabled).toBe(false);
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(posts().at(-1)).toEqual(["team-discord-group-publish", { teamId: "team", archiveId: "group", requestId: oldRequestId, action: "verify", messageId: "123456789012345678" }]);
    expect(posts().filter(([, body]) => !body.action)).toHaveLength(source === "receipt" ? 1 : 0);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(text(renderer.root)).toContain("Le bilan du groupe est publié sur Discord");
  });

  it("keeps the association form and request identity after a mismatched existing message", async () => {
    serve({
      publications: [{ id: "history", requestId: "old-request", status: "uncertain" }],
      publish: () => ({ publication: { requestId: "old-request", status: "uncertain", lastError: "Ce message ne correspond pas à ce bilan du groupe." } }),
    });
    const renderer = await mount(); await click(renderer, "Exporter sur Discord");
    await click(renderer, "Associer le message existant");
    await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: "123456789012345678" } }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(text(renderer.root)).toContain("Ce message ne correspond pas à ce bilan du groupe.");
    expect(renderer.root.findByType("input").props.value).toBe("123456789012345678");
    expect(button(renderer, "Vérifier et associer").props.disabled).toBe(false);
    await click(renderer, "Vérifier ce même envoi");
    expect(posts()).toEqual([
      ["team-discord-group-publish", { teamId: "team", archiveId: "group", requestId: "old-request", action: "verify", messageId: "123456789012345678" }],
      ["team-discord-group-publish", { teamId: "team", archiveId: "group", requestId: "old-request", action: "verify" }],
    ]);
    expect(posts().some(([, body]) => !body.action)).toBe(false);
  });

  it.each([
    [{ ...connection, enabled: false }, "Les envois Discord sont suspendus"],
    [{ ...connection, connection: { ...connection.connection, paused: true, status: "paused" } }, "Les envois de l’équipe sont en pause"],
  ])("permits preview but never publication while paused: %o", async (metadata, explanation) => {
    serve({ metadata }); const renderer = await mount(); await prepare(renderer);
    expect(text(renderer.root)).toContain(explanation);
    const publish = button(renderer, "Publier dans #games");
    expect(publish.props.disabled).toBe(true);
    await act(async () => publish.props.onClick());
    expect(posts()).toEqual([]);
  });

  it("does not publish an unsigned preview", async () => {
    serve({ makePreview: () => ({ ...preview, previewToken: null }) });
    const renderer = await mount(); await prepare(renderer);
    expect(button(renderer, "Publier dans #games").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Prépare à nouveau l’aperçu");
    expect(posts()).toEqual([]);
  });

  it.each([{ teamId: "second" }, { archiveId: "second" }, { archiveRevision: "updated" }])("aborts an old preview and ignores its late response after context changes: %o", async (change) => {
    let resolvePreview;
    serve({ makePreview: () => new Promise((resolve) => { resolvePreview = resolve; }) });
    const renderer = await mount(); await click(renderer, "Exporter sur Discord");
    await act(async () => { void button(renderer, "Préparer l’aperçu").props.onClick(); });
    const signal = apiFetch.mock.calls.find(([path]) => path.startsWith("team-discord-group-preview"))[1].signal;
    await act(async () => renderer.update(<DiscordGroupShare teamId="team" archiveId="group" canPublish {...change} />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolvePreview(preview));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(posts()).toEqual([]);
  });

  it("discards the prepared preview when route metadata changes on refresh", async () => {
    const renderer = await mount(); await prepare(renderer);
    serve({ destinations: { ...routes, routes: [{ ...route, channelId: "channel-2" }] } });
    await click(renderer, "Actualiser les salons");
    expect(renderer.root.findAllByType("img")).toHaveLength(0);
    expect(button(renderer, "Publier dans #second")).toBeUndefined();
    expect(posts()).toEqual([]);
  });

  it("ignores an old publication response after a team change and closes its dialog", async () => {
    let resolvePublish;
    serve({ publish: () => new Promise((resolve) => { resolvePublish = resolve; }) });
    const renderer = await mount(); await prepare(renderer); await click(renderer, "Publier dans #games");
    const signal = apiFetch.mock.calls.find(([, options]) => options?.method === "POST")[1].signal;
    await act(async () => renderer.update(<DiscordGroupShare teamId="second" archiveId="group" canPublish />));
    expect(signal.aborted).toBe(true);
    await act(async () => resolvePublish({ publication }));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(text(renderer.root)).not.toContain("Le bilan du groupe est publié");
  });
});
