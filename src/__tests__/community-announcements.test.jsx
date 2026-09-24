import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, SelectInput, TextAreaInput, TextInput } from "../components/ui/Core.jsx";
import CommunityAnnouncementsPanel from "../pages/admin/CommunityAnnouncementsPanel.jsx";
import BotAnalyticsPage from "../pages/admin/BotAnalyticsPage.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));

const ENDPOINT = "admin-discord-announcements";
const firstChannel = "222222222222222222";
const secondChannel = "333333333333333333";
const messageUrl = "https://discord.com/channels/111111111111111111/222222222222222222/444444444444444444";
const renderers = [];
const state = overrides => ({
  guild: { id: "111111111111111111", name: "Communauté NXT5" },
  channels: [{ id: firstChannel, name: "annonces", canSend: true }, { id: secondChannel, name: "nouveautés", canSend: true }, { id: "555555555555555555", name: "lecture-seule", canSend: false }],
  channelId: firstChannel,
  announcements: [],
  ...overrides,
});
let currentState;
let post;

beforeEach(() => {
  currentState = state();
  post = vi.fn(async body => {
    if (body.action === "configure") { currentState = { ...currentState, channelId: body.channelId }; return { channelId: body.channelId }; }
    if (body.action === "preview") return { reference: body.reference, content: body.content, channelId: currentState.channelId, guildName: currentState.guild.name, channelName: "annonces", previewToken: "signed-preview-token" };
    return { status: "sent", reference: body.reference, messageUrl };
  });
  apiFetch.mockImplementation(async (path, options = {}) => {
    if (path !== ENDPOINT) throw new Error("Statistiques indisponibles pour ce test.");
    return options.method === "POST" ? post(JSON.parse(options.body)) : currentState;
  });
});
afterEach(() => { renderers.splice(0).forEach(renderer => act(() => renderer.unmount())); vi.resetAllMocks(); });

async function render(element = <CommunityAnnouncementsPanel />) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
}
const text = renderer => JSON.stringify(renderer.toJSON());
const button = (renderer, label) => renderer.root.findAllByType(Button).find(node => node.props.children === label);
const field = (renderer, type, label) => renderer.root.findAllByType(type).find(node => node.props.label === label);
const editor = renderer => field(renderer, TextAreaInput, "Texte de l’annonce (Markdown Discord)");
const reference = renderer => field(renderer, TextInput, "Identifiant de l’annonce");
const destination = renderer => field(renderer, SelectInput, "Salon d’annonces");
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const fill = async (renderer, value = "**NXT5**\n\n- Nouvelle fonctionnalité") => act(async () => editor(renderer).props.onChange(value));
const preview = async renderer => act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));

describe("community Discord announcements", () => {
  it("loads the configured destination without publishing, leaves a missing destination empty and disables forbidden salons", async () => {
    currentState = state({ channelId: null });
    const renderer = await render();
    expect(destination(renderer).props.value).toBe("");
    expect(reference(renderer).props.value).toMatch(/^annonce-\d{8}-[a-z0-9]{8}$/);
    expect(editor(renderer).props.maxLength).toBe(4096);
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
    expect(renderer.root.findAllByType("option").find(node => node.props.value === "555555555555555555").props.disabled).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("saves the chosen channel explicitly before preview and preserves the draft on a configuration error", async () => {
    const renderer = await render();
    await fill(renderer);
    await act(async () => destination(renderer).props.onChange(secondChannel));
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    post.mockRejectedValueOnce(new Error("Salon inaccessible."));
    await act(async () => button(renderer, "Enregistrer le salon").props.onClick());
    expect(editor(renderer).props.value).toContain("Nouvelle fonctionnalité");
    expect(destination(renderer).props.value).toBe(secondChannel);
    expect(text(renderer)).toContain("Salon inaccessible.");
    await act(async () => button(renderer, "Enregistrer le salon").props.onClick());
    expect(post).toHaveBeenLastCalledWith({ action: "configure", channelId: secondChannel });
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
    expect(text(renderer)).toContain("Aucun message n’a été envoyé");
  });

  it("uses the server-verified preview verbatim and publishes only after its explicit button", async () => {
    const renderer = await render();
    const content = "**Titre**\n\n<script>alert('x')</script> @everyone";
    await fill(renderer, content);
    await preview(renderer);
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0][0]).toEqual({ action: "preview", reference: reference(renderer).props.value, content });
    expect(renderer.root.findByType("pre").children).toEqual([content]);
    expect(renderer.root.findAllByType("script")).toHaveLength(0);
    expect(text(renderer)).toContain("Les mentions ne déclenchent aucune notification");
    expect(button(renderer, "Publier sur Discord").props.disabled).toBe(false);
    await act(async () => button(renderer, "Publier sur Discord").props.onClick());
    expect(post.mock.calls[1][0]).toEqual({ action: "publish", reference: reference(renderer).props.value, content, previewToken: "signed-preview-token" });
    expect(text(renderer)).toContain("Annonce publiée.");
    expect(renderer.root.findByType("a").props.rel).toBe("noopener noreferrer");
    expect(editor(renderer).props.disabled).toBe(true);
  });

  it.each(["content", "reference", "channel"])("invalidates an approved preview whenever %s changes", async change => {
    const renderer = await render();
    await fill(renderer);
    await preview(renderer);
    expect(button(renderer, "Publier sur Discord")).toBeDefined();
    await act(async () => {
      if (change === "content") editor(renderer).props.onChange("Texte corrigé");
      else if (change === "reference") reference(renderer).props.onChange("mise-a-jour-2");
      else destination(renderer).props.onChange(secondChannel);
    });
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
    expect(renderer.root.findAllByType("pre")).toHaveLength(0);
    expect(post.mock.calls.filter(([body]) => body.action === "publish")).toHaveLength(0);
  });

  it("discards a late preview for text that was edited while the request was pending", async () => {
    const renderer = await render();
    await fill(renderer);
    const pending = deferred();
    post.mockReturnValueOnce(pending.promise);
    await act(async () => { renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
    await fill(renderer, "Dernier brouillon");
    await act(async () => pending.resolve({ reference: reference(renderer).props.value, content: "Ancien brouillon", channelId: firstChannel, previewToken: "old-token" }));
    expect(editor(renderer).props.value).toBe("Dernier brouillon");
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
  });

  it("prevents double submissions and checks an interrupted publication without sending it again", async () => {
    const renderer = await render();
    await fill(renderer);
    await preview(renderer);
    const pending = deferred();
    post.mockReturnValueOnce(pending.promise);
    const publish = button(renderer, "Publier sur Discord").props.onClick;
    await act(async () => { publish(); publish(); });
    expect(post.mock.calls.filter(([body]) => body.action === "publish")).toHaveLength(1);
    await act(async () => pending.reject(new Error("Réponse interrompue.")));
    expect(text(renderer)).toContain("Résultat de l’envoi à vérifier.");
    expect(editor(renderer).props.disabled).toBe(true);
    expect(button(renderer, "Nouvelle annonce")).toBeUndefined();
    const original = post.mock.calls[1][0];
    await act(async () => button(renderer, "Vérifier le résultat").props.onClick());
    expect(post.mock.calls[2][0]).toEqual({ action: "recover", reference: original.reference });
    expect(post.mock.calls.filter(([body]) => body.action === "publish")).toHaveLength(1);
    expect(text(renderer)).toContain("Annonce publiée.");
    const priorReference = reference(renderer).props.value;
    await act(async () => button(renderer, "Nouvelle annonce").props.onClick());
    expect(reference(renderer).props.value).not.toBe(priorReference);
    expect(editor(renderer).props.value).toBe("");
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
  });

  it("can check an uncertain historical announcement after reload without its text or preview token", async () => {
    currentState = state({ channelId: secondChannel, announcements: [{ id: "old", reference: "ancienne-annonce", channelId: firstChannel, status: "uncertain", createdAt: "2026-09-24T08:00:00Z" }] });
    const renderer = await render();
    await fill(renderer, "Une annonce encore en cours de rédaction");
    await act(async () => button(renderer, "Vérifier cet envoi").props.onClick());
    expect(post).toHaveBeenCalledWith({ action: "recover", reference: "ancienne-annonce" });
    expect(editor(renderer).props.value).toBe("Une annonce encore en cours de rédaction");
    expect(editor(renderer).props.disabled).toBe(false);
    expect(post.mock.calls.filter(([body]) => body.action === "publish")).toHaveLength(0);
  });

  it("allows a fresh preview of the same draft after recovery confirms a definitive failure", async () => {
    const renderer = await render();
    await fill(renderer);
    await preview(renderer);
    post.mockResolvedValueOnce({ status: "uncertain" });
    await act(async () => button(renderer, "Publier sur Discord").props.onClick());
    const originalReference = reference(renderer).props.value;
    post.mockResolvedValueOnce({ status: "failed", reference: originalReference });
    await act(async () => button(renderer, "Vérifier le résultat").props.onClick());
    expect(reference(renderer).props.value).toBe(originalReference);
    expect(editor(renderer).props.value).toContain("Nouvelle fonctionnalité");
    expect(editor(renderer).props.disabled).toBe(false);
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
  });

  it("keeps an uncertain response distinct and can confirm it from the refreshed history", async () => {
    const renderer = await render();
    await fill(renderer);
    await preview(renderer);
    post.mockResolvedValueOnce({ status: "uncertain" });
    await act(async () => button(renderer, "Publier sur Discord").props.onClick());
    expect(button(renderer, "Vérifier le résultat")).toBeDefined();
    currentState = state({ announcements: [{ id: "receipt", reference: reference(renderer).props.value, channelId: firstChannel, status: "sent", messageUrl, createdAt: "2026-09-24T08:00:00Z" }] });
    await act(async () => button(renderer, "Actualiser les salons").props.onClick());
    expect(text(renderer)).toContain("Annonce publiée.");
    expect(button(renderer, "Vérifier le résultat")).toBeUndefined();
    expect(post.mock.calls.filter(([body]) => body.action === "publish")).toHaveLength(1);
  });

  it.each([401, 403])("clears loaded server, preview and history on lost authorization (%i)", async status => {
    currentState = state({ announcements: [{ id: "old", reference: "Annonce confidentielle", status: "sent", channelId: firstChannel, messageUrl }] });
    const renderer = await render();
    await fill(renderer);
    await preview(renderer);
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Accès administrateur requis."), { status }));
    await act(async () => button(renderer, "Actualiser les salons").props.onClick());
    expect(text(renderer)).toContain("Accès administrateur requis.");
    expect(text(renderer)).not.toContain("Communauté NXT5");
    expect(text(renderer)).not.toContain("Annonce confidentielle");
    expect(renderer.root.findAllByType(TextAreaInput)).toHaveLength(0);
    expect(renderer.root.findAllByType("pre")).toHaveLength(0);
  });

  it("explains missing bot configuration and can retry without an implicit publication", async () => {
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Le bot Discord n’est pas configuré."), { status: 503 }));
    const renderer = await render();
    expect(text(renderer)).toContain("Le bot Discord n’est pas configuré.");
    expect(editor(renderer)).toBeUndefined();
    await act(async () => button(renderer, "Actualiser les salons").props.onClick());
    expect(editor(renderer)).toBeDefined();
    expect(post).not.toHaveBeenCalled();
  });

  it("caps the history at twenty entries and only exposes valid Discord message links", async () => {
    currentState = state({ announcements: Array.from({ length: 25 }, (_, index) => ({ id: `receipt-${index}`, reference: `annonce-historique-${index}`, channelId: firstChannel, status: index ? "uncertain" : "sent", messageUrl: index ? "javascript:alert(1)" : messageUrl, createdAt: "2026-09-24T08:00:00Z" })) });
    const renderer = await render();
    expect(renderer.root.findByType("ol").findAllByType("li")).toHaveLength(20);
    expect(renderer.root.findAllByType("a")).toHaveLength(1);
    expect(text(renderer)).toContain("À vérifier");
  });

  it("keeps the announcement editor available when analytics fail", async () => {
    const renderer = await render(<BotAnalyticsPage />);
    expect(text(renderer)).toContain("Statistiques indisponibles.");
    expect(editor(renderer)).toBeDefined();
    await fill(renderer);
    await preview(renderer);
    expect(button(renderer, "Publier sur Discord")).toBeDefined();
    expect(post.mock.calls.map(([body]) => body.action)).toEqual(["preview"]);
  });
});
