import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, SelectInput, TextAreaInput, TextInput } from "../components/ui/Core.jsx";
import CommunityAnnouncementsPanel from "../pages/admin/CommunityAnnouncementsPanel.jsx";
import BotPublicationsPage from "../pages/admin/BotPublicationsPage.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));

const ENDPOINT = "admin-discord-announcements";
const firstGuild = "111111111111111111", secondGuild = "666666666666666666";
const firstChannel = "222222222222222222", secondChannel = "333333333333333333", otherChannel = "777777777777777777";
const forbiddenChannel = "555555555555555555";
const firstDestination = { guildId: firstGuild, channelId: firstChannel };
const secondDestination = { guildId: secondGuild, channelId: otherChannel };
const messageUrl = `https://discord.com/channels/${firstGuild}/${firstChannel}/444444444444444444`;
const installUrl = "https://discord.com/oauth2/authorize?client_id=888888888888888888&scope=bot&permissions=8";
const communityInstallUrl = `${installUrl}&guild_id=${firstGuild}&disable_guild_select=true`;
const renderers = [];
const state = overrides => ({
  guilds: [
    { id: firstGuild, name: "Communauté NXT5", channelId: firstChannel, channels: [
      { id: firstChannel, name: "annonces", canSend: true }, { id: secondChannel, name: "nouveautés", canSend: true },
      { id: forbiddenChannel, name: "lecture-seule", canSend: false },
    ] },
    { id: secondGuild, name: "Équipe pilote", channelId: otherChannel, channels: [{ id: otherChannel, name: "actualités", canSend: true }] },
  ],
  destinations: [firstDestination],
  community: { guildId: firstGuild, joined: true, installUrl: communityInstallUrl },
  installUrl,
  announcements: [],
  ...overrides,
});
let currentState;
let post;
const describeDestination = destination => {
  const guild = currentState.guilds.find(item => item.id === destination.guildId);
  return { ...destination, guildName: guild?.name || destination.guildId, channelName: guild?.channels.find(item => item.id === destination.channelId)?.name || destination.channelId };
};
const response = (reference, destinations = currentState.destinations, status = "sent") => ({ reference, results: destinations.map(destination => ({
  ...describeDestination(destination), status, ...(status === "sent" ? { messageUrl: `https://discord.com/channels/${destination.guildId}/${destination.channelId}/444444444444444444` } : {}),
})) });

beforeEach(() => {
  currentState = state();
  post = vi.fn(async body => {
    if (body.action === "configure") { currentState = { ...currentState, destinations: body.destinations }; return { destinations: body.destinations }; }
    if (body.action === "preview") return { reference: body.reference, content: body.content, destinations: body.destinations.map(describeDestination), previewToken: "signed-preview-token" };
    const destinations = body.destinations || currentState.destinations.filter(item => !body.guildId || item.guildId === body.guildId);
    return response(body.reference, destinations);
  });
  apiFetch.mockImplementation(async (path, options = {}) => {
    if (path !== ENDPOINT) throw new Error("Statistiques indisponibles pour ce test.");
    return options.method === "POST" ? post(JSON.parse(options.body)) : currentState;
  });
});
afterEach(() => {
  for (const [path, options] of apiFetch.mock.calls) {
    if (path !== ENDPOINT) continue;
    const headers = new Headers(options?.headers);
    expect(headers.get("X-NXT5-Announcements-Version")).toBe("2");
    if (options?.method === "POST") expect(headers.get("Content-Type")).toBe("application/json");
  }
  renderers.splice(0).forEach(renderer => act(() => renderer.unmount())); vi.resetAllMocks();
});

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
const destination = (renderer, name = "Communauté NXT5") => field(renderer, SelectInput, `Salon d’annonces · ${name}`);
const checkbox = (renderer, name) => renderer.root.findAllByType("label").find(node => node.props.className === "community-announcement-guild-choice" && node.findAllByType("strong").some(strong => strong.children.includes(name))).findByType("input");
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const fill = async (renderer, value = "**NXT5**\n\n- Nouvelle fonctionnalité") => act(async () => editor(renderer).props.onChange(value));
const preview = async renderer => act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
const click = async (renderer, label) => act(async () => button(renderer, label).props.onClick());
const actions = action => post.mock.calls.filter(([body]) => body.action === action).map(([body]) => body);
const messageLinks = renderer => renderer.root.findAllByType("a").filter(node => node.props.href.includes("/channels/"));

// Exercise the public UI flow with simulated API responses; no Discord request or publication is made.
describe("community Discord announcements", () => {
  it("loads saved servers without publishing, leaves an unconfigured channel empty and disables forbidden salons", async () => {
    currentState = state({ destinations: [] });
    currentState.guilds[0].channelId = null;
    const renderer = await render();
    expect(checkbox(renderer, "Communauté NXT5").props.checked).toBe(false);
    await act(async () => checkbox(renderer, "Communauté NXT5").props.onChange({ target: { checked: true } }));
    expect(destination(renderer).props.value).toBe("");
    expect(reference(renderer).props.value).toMatch(/^annonce-\d{8}-[a-z0-9]{8}$/);
    expect(reference(renderer).props.maxLength).toBe(80);
    expect(reference(renderer).props.pattern).toContain("A-Za-z0-9");
    expect(editor(renderer).props.maxLength).toBe(4096);
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    expect(button(renderer, "Enregistrer les destinations").props.disabled).toBe(true);
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
    expect(renderer.root.findAllByType("option").find(node => node.props.value === forbiddenChannel).props.disabled).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("keeps composition available with no joined server and offers the targeted community invitation", async () => {
    currentState = state({ guilds: [], destinations: [], community: { guildId: firstGuild, joined: false, installUrl: communityInstallUrl } });
    const renderer = await render();
    expect(text(renderer)).toContain("Aucun serveur disponible");
    expect(text(renderer)).toContain("permission Administrateur");
    const invitation = renderer.root.findAllByType("a").find(node => node.props.href === communityInstallUrl);
    expect(invitation.props.target).toBe("_blank");
    expect(invitation.props.rel).toBe("noopener noreferrer");
    await fill(renderer, "Brouillon avant l’installation du bot");
    expect(editor(renderer).props.disabled).toBe(false);
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    expect(post).not.toHaveBeenCalled();
    currentState = state({ destinations: [] });
    await click(renderer, "Actualiser les serveurs");
    expect(editor(renderer).props.value).toBe("Brouillon avant l’installation du bot");
    expect(checkbox(renderer, "Communauté NXT5").props.checked).toBe(false);
  });

  it("can publish to another server while the community bot still needs to be installed", async () => {
    currentState = state({ destinations: [secondDestination], community: { guildId: firstGuild, joined: false, installUrl: communityInstallUrl } });
    currentState.guilds = currentState.guilds.filter(guild => guild.id === secondGuild);
    const renderer = await render();
    await fill(renderer); await preview(renderer);
    expect(actions("preview")[0].destinations).toEqual([secondDestination]);
    expect(text(renderer)).toContain("Inviter le bot sur le serveur communauté");
    expect(button(renderer, "Publier sur Discord").props.disabled).toBe(false);
  });

  it("saves multiple servers and their selected channels explicitly, preserving the draft if configuration fails", async () => {
    const renderer = await render(); await fill(renderer);
    await act(async () => {
      checkbox(renderer, "Équipe pilote").props.onChange({ target: { checked: true } });
    });
    await act(async () => destination(renderer).props.onChange(secondChannel));
    expect(destination(renderer, "Équipe pilote").props.value).toBe(otherChannel);
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    post.mockRejectedValueOnce(new Error("Salon inaccessible."));
    await click(renderer, "Enregistrer les destinations");
    expect(editor(renderer).props.value).toContain("Nouvelle fonctionnalité");
    expect(destination(renderer).props.value).toBe(secondChannel);
    expect(checkbox(renderer, "Équipe pilote").props.checked).toBe(true);
    expect(text(renderer)).toContain("Salon inaccessible.");
    await click(renderer, "Enregistrer les destinations");
    expect(actions("configure").at(-1)).toEqual({ action: "configure", destinations: [{ guildId: firstGuild, channelId: secondChannel }, secondDestination] });
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
    expect(text(renderer)).toContain("Aucun message n’a été envoyé");
  });

  it("uses the exact verified text and destinations, and publishes only after the confirmation button", async () => {
    currentState = state({ destinations: [firstDestination, secondDestination] });
    const renderer = await render();
    const content = "**Titre**\n\n<script>alert('x')</script> @everyone";
    await fill(renderer, content); await preview(renderer);
    expect(post).toHaveBeenCalledOnce();
    expect(actions("preview")[0]).toEqual({ action: "preview", reference: reference(renderer).props.value, content, destinations: [firstDestination, secondDestination] });
    expect(renderer.root.findByType("pre").children).toEqual([content]);
    expect(renderer.root.findAllByType("script")).toHaveLength(0);
    const targets = renderer.root.findAllByType("ul").find(node => node.props.className === "community-announcement-targets");
    expect(targets.findAllByType("li")).toHaveLength(2);
    expect(targets.findAllByType("li")[1].children).toContain("actualités");
    expect(text(renderer)).toContain("Les mentions ne déclenchent aucune notification");
    await click(renderer, "Publier sur Discord");
    expect(actions("publish")[0]).toEqual({ action: "publish", reference: reference(renderer).props.value, content,
      destinations: [firstDestination, secondDestination], previewToken: "signed-preview-token" });
    expect(text(renderer)).toContain("Annonce publiée sur tous les serveurs sélectionnés.");
    expect(messageLinks(renderer)).toHaveLength(2);
    expect(messageLinks(renderer).every(node => node.props.rel === "noopener noreferrer")).toBe(true);
    expect(editor(renderer).props.disabled).toBe(true);
  });

  it.each(["content", "reference", "channel", "servers"])("invalidates the preview when %s changes", async change => {
    const renderer = await render(); await fill(renderer); await preview(renderer);
    await act(async () => {
      if (change === "content") editor(renderer).props.onChange("Texte corrigé");
      else if (change === "reference") reference(renderer).props.onChange("mise-a-jour-2");
      else if (change === "channel") destination(renderer).props.onChange(secondChannel);
      else checkbox(renderer, "Équipe pilote").props.onChange({ target: { checked: true } });
    });
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
    expect(renderer.root.findAllByType("pre")).toHaveLength(0);
    expect(actions("publish")).toHaveLength(0);
  });

  it("discards a late preview after the draft was edited while the request was pending", async () => {
    const renderer = await render(); await fill(renderer);
    const originalReference = reference(renderer).props.value;
    const pending = deferred(); post.mockReturnValueOnce(pending.promise);
    await act(async () => { renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
    await fill(renderer, "Dernier brouillon");
    await act(async () => pending.resolve({ reference: originalReference, content: "**NXT5**\n\n- Nouvelle fonctionnalité", destinations: [describeDestination(firstDestination)], previewToken: "old-token" }));
    expect(editor(renderer).props.value).toBe("Dernier brouillon");
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
  });

  it.each(["different destination", "missing destination", "different text"])("rejects a preview containing %s", async problem => {
    const renderer = await render(); await fill(renderer, "Mon annonce");
    post.mockResolvedValueOnce({ reference: reference(renderer).props.value, content: problem === "different text" ? "Autre texte" : "Mon annonce",
      destinations: problem === "missing destination" ? [] : [describeDestination(problem === "different destination" ? secondDestination : firstDestination)], previewToken: "wrong-preview" });
    await preview(renderer);
    expect(text(renderer)).toContain("L’aperçu est incomplet ou les destinations ont changé");
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
    expect(actions("publish")).toHaveLength(0);
  });

  it("rejects blank or oversized content before preparing a preview", async () => {
    const renderer = await render();
    for (const content of ["", "  ", "a".repeat(4097)]) {
      await fill(renderer, content); await preview(renderer);
      expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(true);
    }
    expect(post).not.toHaveBeenCalled();
    await fill(renderer, "a".repeat(4096));
    expect(button(renderer, "Préparer l’aperçu").props.disabled).toBe(false);
  });

  it("refreshes permissions without losing the draft and invalidates an existing preview", async () => {
    const renderer = await render(); await fill(renderer); await preview(renderer);
    const oldReference = reference(renderer).props.value;
    await click(renderer, "Actualiser les serveurs");
    expect(editor(renderer).props.value).toContain("Nouvelle fonctionnalité");
    expect(reference(renderer).props.value).toBe(oldReference);
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
    expect(actions("publish")).toHaveLength(0);
    await act(async () => destination(renderer).props.onChange(secondChannel));
    currentState = state({ destinations: [secondDestination] });
    await click(renderer, "Actualiser les serveurs");
    expect(destination(renderer).props.value).toBe(secondChannel);
    expect(checkbox(renderer, "Équipe pilote").props.checked).toBe(false);
    expect(editor(renderer).props.value).toContain("Nouvelle fonctionnalité");
    expect(button(renderer, "Enregistrer les destinations").props.disabled).toBe(false);
  });

  it("prevents double submissions and recovers an interrupted publication without sending again", async () => {
    const renderer = await render(); await fill(renderer); await preview(renderer);
    const pending = deferred(); post.mockReturnValueOnce(pending.promise);
    const publish = button(renderer, "Publier sur Discord").props.onClick;
    await act(async () => { publish(); publish(); });
    expect(actions("publish")).toHaveLength(1);
    await act(async () => pending.reject(new Error("Réponse interrompue.")));
    expect(text(renderer)).toContain("Publication à compléter ou à vérifier.");
    expect(editor(renderer).props.disabled).toBe(true);
    expect(button(renderer, "Nouvelle annonce")).toBeUndefined();
    const original = actions("publish")[0];
    await click(renderer, "Vérifier le résultat");
    expect(actions("recover")[0]).toEqual({ action: "recover", reference: original.reference });
    expect(actions("publish")).toHaveLength(1);
    expect(text(renderer)).toContain("Annonce publiée sur tous les serveurs sélectionnés.");
    const priorReference = reference(renderer).props.value;
    await click(renderer, "Nouvelle annonce");
    expect(reference(renderer).props.value).not.toBe(priorReference);
    expect(editor(renderer).props.value).toBe("");
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
  });

  it("shows partial delivery separately for each server and offers read-only verification for uncertainty", async () => {
    currentState = state({ destinations: [firstDestination, secondDestination] });
    const renderer = await render(); await fill(renderer); await preview(renderer);
    post.mockResolvedValueOnce({ results: [...response(reference(renderer).props.value, [firstDestination]).results,
      ...response(reference(renderer).props.value, [secondDestination], "uncertain").results] });
    await click(renderer, "Publier sur Discord");
    const receipts = renderer.root.findAllByType("ul").find(node => node.props.className === "community-announcement-receipts").findAllByType("li");
    expect(receipts).toHaveLength(2);
    expect(receipts[0].findByType("strong").children).toEqual(["Communauté NXT5"]);
    expect(receipts[0].findAllByType("a")).toHaveLength(1);
    expect(receipts[1].findByType("strong").children).toEqual(["Équipe pilote"]);
    expect(receipts[1].findAllByType("a")).toHaveLength(0);
    expect(text(renderer)).toContain("À vérifier");
    expect(button(renderer, "Préparer la reprise des envois")).toBeUndefined();
    expect(button(renderer, "Nouvelle annonce")).toBeUndefined();
    await click(renderer, "Vérifier le résultat");
    expect(actions("publish")).toHaveLength(1);
    expect(actions("recover")).toHaveLength(1);
    expect(text(renderer)).toContain("Annonce publiée sur tous les serveurs sélectionnés.");
  });

  it.each(["failed", "queued"])("requires another preview and confirmation before retrying a %s destination", async status => {
    currentState = state({ destinations: [firstDestination, secondDestination] });
    const renderer = await render(); await fill(renderer); await preview(renderer);
    const originalReference = reference(renderer).props.value;
    post.mockResolvedValueOnce({ results: [...response(originalReference, [firstDestination]).results, ...response(originalReference, [secondDestination], status).results] });
    await click(renderer, "Publier sur Discord");
    expect(button(renderer, "Vérifier le résultat")).toBeUndefined();
    expect(button(renderer, "Reprendre les envois sur Discord")).toBeUndefined();
    expect(editor(renderer).props.disabled).toBe(true);
    await click(renderer, "Préparer la reprise des envois");
    expect(actions("publish")).toHaveLength(1);
    expect(actions("preview").at(-1)).toMatchObject({ reference: originalReference, destinations: [firstDestination, secondDestination] });
    expect(text(renderer)).toContain("Les messages déjà envoyés ou à vérifier ne sont pas renvoyés");
    await click(renderer, "Reprendre les envois sur Discord");
    expect(actions("publish")).toHaveLength(2);
    expect(actions("publish")[1]).toEqual(actions("publish")[0]);
    expect(text(renderer)).toContain("Annonce publiée sur tous les serveurs sélectionnés.");
  });

  it("checks one historical server after reload without its original text or token, preserving the current draft", async () => {
    currentState = state({ destinations: [secondDestination], announcements: [{ id: "old", reference: "ancienne-annonce", ...firstDestination, status: "uncertain", createdAt: "2026-09-24T08:00:00Z" }] });
    const renderer = await render(); await fill(renderer, "Une annonce encore en cours de rédaction");
    post.mockResolvedValueOnce(response("ancienne-annonce", [firstDestination]));
    await click(renderer, "Vérifier cet envoi");
    expect(actions("recover")[0]).toEqual({ action: "recover", reference: "ancienne-annonce", guildId: firstGuild });
    expect(editor(renderer).props.value).toBe("Une annonce encore en cours de rédaction");
    expect(editor(renderer).props.disabled).toBe(false);
    expect(actions("publish")).toHaveLength(0);
  });

  it("restores a queued historical batch and explicitly restores its immutable destinations before another preview", async () => {
    currentState = state({ destinations: [secondDestination], announcements: [
      { id: "sent", reference: "ancienne-annonce", ...firstDestination, status: "sent", messageUrl },
      { id: "queued", reference: "ancienne-annonce", ...secondDestination, status: "queued" },
    ] });
    // The already delivered server can become inaccessible without blocking the remaining delivery.
    currentState.guilds = currentState.guilds.filter(guild => guild.id === secondGuild);
    const renderer = await render();
    const restored = { reference: "ancienne-annonce", content: "Texte original à reprendre", destinations: [firstDestination, secondDestination],
      results: [...response("ancienne-annonce", [firstDestination]).results, ...response("ancienne-annonce", [secondDestination], "queued").results] };
    post.mockResolvedValueOnce(restored);
    await click(renderer, "Reprendre cette annonce");
    expect(actions("restore")).toEqual([{ action: "restore", reference: "ancienne-annonce" }]);
    expect(editor(renderer).props.value).toBe(restored.content);
    expect(reference(renderer).props.value).toBe(restored.reference);
    expect(editor(renderer).props.disabled).toBe(true);
    expect(reference(renderer).props.disabled).toBe(true);
    expect(button(renderer, "Préparer la reprise des envois").props.disabled).toBe(true);
    expect(actions("publish")).toHaveLength(0);
    expect(actions("configure")).toHaveLength(0);
    expect(button(renderer, "Rétablir les destinations de cet envoi").props.disabled).toBe(false);
    await click(renderer, "Rétablir les destinations de cet envoi");
    expect(actions("configure")[0]).toEqual({ action: "configure", reference: restored.reference, destinations: restored.destinations });
    await click(renderer, "Préparer la reprise des envois");
    expect(actions("preview")[0]).toMatchObject({ reference: restored.reference, content: restored.content, destinations: restored.destinations });
    expect(actions("publish")).toHaveLength(0);
    await click(renderer, "Reprendre les envois sur Discord");
    expect(actions("publish")[0]).toMatchObject({ reference: restored.reference, content: restored.content, destinations: restored.destinations });
  });

  it("does not replace an active draft when opening a failed historical announcement", async () => {
    currentState = state({ announcements: [{ id: "failed", reference: "ancienne-annonce", ...firstDestination, status: "failed" }] });
    const renderer = await render(); await fill(renderer, "Mon brouillon à conserver");
    expect(button(renderer, "Reprendre cette annonce").props.disabled).toBe(true);
    await click(renderer, "Reprendre cette annonce");
    expect(actions("restore")).toHaveLength(0);
    expect(editor(renderer).props.value).toBe("Mon brouillon à conserver");
  });

  it("rejects a late restoration if the user has started a draft while it was pending", async () => {
    currentState = state({ announcements: [{ id: "failed", reference: "ancienne-annonce", ...firstDestination, status: "failed" }] });
    const renderer = await render();
    const pending = deferred(); post.mockReturnValueOnce(pending.promise);
    await act(async () => { button(renderer, "Reprendre cette annonce").props.onClick(); });
    await fill(renderer, "Mon nouveau brouillon");
    await act(async () => pending.resolve({ ...response("ancienne-annonce", [firstDestination], "failed"),
      content: "Texte historique", destinations: [firstDestination] }));
    expect(editor(renderer).props.value).toBe("Mon nouveau brouillon");
    expect(reference(renderer).props.value).not.toBe("ancienne-annonce");
    expect(editor(renderer).props.disabled).toBe(false);
    expect(actions("publish")).toHaveLength(0);
  });

  it("can confirm an uncertain attempt from refreshed history without republishing", async () => {
    const renderer = await render(); await fill(renderer); await preview(renderer);
    post.mockResolvedValueOnce(response(reference(renderer).props.value, [firstDestination], "uncertain"));
    await click(renderer, "Publier sur Discord");
    expect(button(renderer, "Vérifier le résultat")).toBeDefined();
    currentState = state({ announcements: [{ id: "receipt", reference: reference(renderer).props.value, ...firstDestination, status: "sent", messageUrl, createdAt: "2026-09-24T08:00:00Z" }] });
    await click(renderer, "Actualiser les serveurs");
    expect(text(renderer)).toContain("Annonce publiée sur tous les serveurs sélectionnés.");
    expect(button(renderer, "Vérifier le résultat")).toBeUndefined();
    expect(actions("publish")).toHaveLength(1);
  });

  it.each([401, 403])("clears server data, preview and history if authorization is lost (%i)", async status => {
    currentState = state({ announcements: [{ id: "old", reference: "Annonce confidentielle", ...firstDestination, status: "sent", messageUrl }] });
    const renderer = await render(); await fill(renderer); await preview(renderer);
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Accès administrateur requis."), { status }));
    await click(renderer, "Actualiser les serveurs");
    expect(text(renderer)).toContain("Accès administrateur requis.");
    expect(text(renderer)).not.toContain("Communauté NXT5");
    expect(text(renderer)).not.toContain("Annonce confidentielle");
    expect(renderer.root.findAllByType(TextAreaInput)).toHaveLength(0);
    expect(renderer.root.findAllByType("pre")).toHaveLength(0);
  });

  it("explains missing bot configuration and retries loading without an implicit publication", async () => {
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Le bot Discord n’est pas configuré."), { status: 503 }));
    const renderer = await render();
    expect(text(renderer)).toContain("Le bot Discord n’est pas configuré.");
    expect(editor(renderer)).toBeUndefined();
    await click(renderer, "Actualiser les serveurs");
    expect(editor(renderer)).toBeDefined();
    expect(post).not.toHaveBeenCalled();
  });

  it.each(["refresh", "preview", "publish"])("preserves the draft when %s rejects an outdated page version", async action => {
    const renderer = await render();
    const draft = "Mon annonce à conserver avant de recharger la page";
    await fill(renderer, draft);
    const originalReference = reference(renderer).props.value;
    if (action === "publish") await preview(renderer);
    const message = "Cette page utilise une ancienne version de NXT5. Recharge la page pour accéder au choix des serveurs. Si tu as un brouillon, copie-le avant de recharger.";
    const callsBeforeRejection = apiFetch.mock.calls.length;
    apiFetch.mockRejectedValueOnce(Object.assign(new Error(message), { status: 409, code: "DISCORD_ANNOUNCEMENT_CLIENT_OUTDATED" }));
    if (action === "refresh") await click(renderer, "Actualiser les serveurs");
    else if (action === "preview") await preview(renderer);
    else await click(renderer, "Publier sur Discord");
    expect(text(renderer)).toContain(message);
    expect(editor(renderer).props.value).toBe(draft);
    expect(editor(renderer).props.disabled).toBe(false);
    expect(reference(renderer).props.value).toBe(originalReference);
    expect(destination(renderer).props.value).toBe(firstChannel);
    expect(checkbox(renderer, "Communauté NXT5").props.checked).toBe(true);
    expect(apiFetch).toHaveBeenCalledTimes(callsBeforeRejection + 1);
    expect(button(renderer, "Publier sur Discord")).toBeUndefined();
    expect(button(renderer, "Vérifier le résultat")).toBeUndefined();
    expect(actions("recover")).toHaveLength(0);
  });

  it("caps history at twenty receipts and exposes only valid Discord message and invitation links", async () => {
    currentState = state({ installUrl: "https://evil.example/oauth2/authorize", community: { joined: false, installUrl: "javascript:alert(1)" },
      announcements: Array.from({ length: 25 }, (_, index) => ({ id: `receipt-${index}`, reference: `annonce-historique-${index}`, ...firstDestination,
        status: index ? "uncertain" : "sent", messageUrl: index ? "javascript:alert(1)" : messageUrl, createdAt: "2026-09-24T08:00:00Z" })) });
    const renderer = await render();
    expect(renderer.root.findByType("ol").findAllByType("li")).toHaveLength(20);
    expect(renderer.root.findAllByType("a")).toHaveLength(1);
    expect(text(renderer)).toContain("À vérifier");
  });

  it("opens publications without requesting statistics", async () => {
    const renderer = await render(<BotPublicationsPage />);
    expect(text(renderer)).toContain("Publications du bot");
    expect(editor(renderer)).toBeDefined();
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual([ENDPOINT]);
    await fill(renderer); await preview(renderer);
    expect(button(renderer, "Publier sur Discord")).toBeDefined();
    expect(post.mock.calls.map(([body]) => body.action)).toEqual(["preview"]);
    expect(apiFetch.mock.calls.every(([path]) => path === ENDPOINT)).toBe(true);
  });
});
