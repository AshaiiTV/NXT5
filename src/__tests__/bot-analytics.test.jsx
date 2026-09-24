import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, SelectInput, TextInput } from "../components/ui/Core.jsx";
import BotAnalyticsPage, { BotDailyChart } from "../pages/admin/BotAnalyticsPage.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../pages/admin/CommunityAnnouncementsPanel.jsx", () => ({ default: () => <section aria-label="Annonces communautaires" /> }));
const renderers = [];
afterEach(() => { renderers.splice(0).forEach(renderer => act(() => renderer.unmount())); vi.resetAllMocks(); });
const summary = { publications: 25, successfulDeliveries: 32, commands: 8, guilds: 2, failedDeliveries: 3, uncertainDeliveries: 1, connectionTests: 2, successRate: 91.4, connections: 3, activeConnections: 2, pausedConnections: 1, channels: 4, queuedJobs: 2, blockedJobs: 1 };
const guild = (id, teamName, channelName) => ({ guildId: id, guildName: null, publications: 12, successfulDeliveries: 16, failedDeliveries: 1, commands: 4, lastActivityAt: "2026-09-22T12:00:00Z", teams: [{ teamId: `team-${id}`, teamName, status: "active" }], destinations: [{ channelId: `channel-${id}`, channelName, enabled: true, automatic: true, currentlyConfigured: true, teamNames: [teamName], publications: 12, successfulDeliveries: 16, failedDeliveries: 1 }] });
const report = (overrides = {}) => ({
  schemaReady: true, generatedAt: "2026-09-22T12:30:00Z", period: { days: 30, from: "2026-08-24T00:00:00Z", to: "2026-09-22T12:30:00Z", timeZone: "UTC" }, summary,
  coverage: { commandsFrom: "2026-09-15T12:30:00Z", commandsRetentionDays: 7, commandsPartial: true, deliveriesRetentionDays: 90, notes: ["Les commandes reçues sont conservées 7 jours."] },
  daily: [{ date: "2026-09-14", publications: 12, successfulDeliveries: 15, failedDeliveries: 1, commands: null }, { date: "2026-09-22", publications: 13, successfulDeliveries: 17, failedDeliveries: 2, commands: 0 }],
  commands: [{ name: "statut", count: 8, completed: 7, failed: 1, processing: 0 }],
  guilds: [guild("111111111111111111", "Équipe Alpha", "résultats"), guild("222222222222222222", "Academy Beta", "scrims")],
  recentActivity: [{ id: "delivery-1", kind: "delivery", at: "2026-09-22T12:00:00Z", status: "succeeded", guildId: "111111111111111111", teamName: "Équipe Alpha", channelName: "résultats" }],
  ...overrides,
});
async function render(element = <BotAnalyticsPage />) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
}
const text = renderer => JSON.stringify(renderer.toJSON());
const button = (renderer, label) => renderer.root.findAllByType(Button).find(node => node.props.children === label);
const values = renderer => renderer.root.findAllByProps({ className: "bot-metric" }).map(node => node.findByType("strong").children.join(""));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

describe("bot analytics dashboard", () => {
  it("renders recorded activity with distinct publication, delivery, command and server counts", async () => {
    apiFetch.mockResolvedValueOnce(report());
    const renderer = await render();
    expect(apiFetch).toHaveBeenCalledWith("admin-discord-analytics?days=30", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(values(renderer)).toEqual(["25", "32", "8", "2"]);
    expect(text(renderer)).toContain("91,4");
    expect(text(renderer)).toContain("tests de connexion séparés des publications");
    expect(text(renderer)).toContain("7 jours maximum conservés");
    expect(text(renderer)).toContain("UTC");
    expect(text(renderer)).toContain("/nxt ");
  });

  it("keeps pending, network failure, missing schema and a confirmed empty report distinct", async () => {
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    const renderer = await render();
    expect(renderer.root.findAllByProps({ "aria-label": "Chargement des statistiques du bot" })).toHaveLength(1);
    expect(button(renderer, "Actualisation…").props.disabled).toBe(true);
    expect(values(renderer)).toEqual([]);
    await act(async () => pending.reject(new Error("Connexion interrompue.")));
    expect(text(renderer)).toContain("Statistiques indisponibles.");
    expect(text(renderer)).not.toContain("Aucun serveur relié");
    apiFetch.mockResolvedValueOnce({ schemaReady: false });
    await act(async () => button(renderer, "Réessayer").props.onClick());
    expect(text(renderer)).toContain("Le suivi Discord n’est pas encore disponible");
    expect(values(renderer)).toEqual([]);
    apiFetch.mockResolvedValueOnce(report({ summary: { ...Object.fromEntries(Object.keys(summary).map(key => [key, 0])), successRate: null }, daily: [], commands: [], guilds: [], recentActivity: [] }));
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(values(renderer)).toEqual(["0", "0", "0", "0"]);
    expect(text(renderer)).toContain("Aucun serveur relié ni usage enregistré");
    expect(text(renderer)).toContain("Aucune commande enregistrée");
    expect(text(renderer)).toContain("Aucun taux de réussite disponible");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  });

  it.each([null, {}, { schemaReady: true }, report({ period: { days: 7 } })])("rejects incomplete or wrong-period payload %j", async payload => {
    apiFetch.mockResolvedValueOnce(payload);
    const renderer = await render();
    expect(text(renderer)).toContain("Les statistiques reçues sont incomplètes");
    expect(values(renderer)).toEqual([]);
  });

  it("navigates to the selected period, clears prior values, and ignores responses for obsolete periods", async () => {
    const navigate = vi.fn();
    apiFetch.mockResolvedValueOnce(report());
    const renderer = await render(<BotAnalyticsPage route={{ search: "?days=30" }} navigate={navigate} />);
    const firstSignal = apiFetch.mock.calls[0][1].signal;
    const seven = deferred(), ninety = deferred();
    apiFetch.mockReturnValueOnce(seven.promise).mockReturnValueOnce(ninety.promise);
    await act(async () => renderer.root.findByType(SelectInput).props.onChange("7"));
    expect(navigate).toHaveBeenCalledWith("/admin/bot-discord?days=7");
    await act(async () => renderer.update(<BotAnalyticsPage route={{ search: "?days=7" }} navigate={navigate} />));
    expect(values(renderer)).toEqual([]);
    expect(firstSignal.aborted).toBe(true);
    const sevenSignal = apiFetch.mock.calls[1][1].signal;
    await act(async () => renderer.update(<BotAnalyticsPage route={{ search: "?days=90" }} navigate={navigate} />));
    expect(sevenSignal.aborted).toBe(true);
    await act(async () => ninety.resolve(report({ period: { ...report().period, days: 90 }, summary: { ...summary, publications: 90 } })));
    await act(async () => seven.resolve(report({ period: { ...report().period, days: 7 }, summary: { ...summary, publications: 999 } })));
    expect(values(renderer)[0]).toBe("90");
    const lastSignal = apiFetch.mock.calls.at(-1)[1].signal;
    act(() => renderer.unmount()); renderers.splice(renderers.indexOf(renderer), 1);
    expect(lastSignal.aborted).toBe(true);
  });

  it("defaults unsupported URL periods to 30 days", async () => {
    apiFetch.mockResolvedValueOnce(report());
    const renderer = await render(<BotAnalyticsPage route={{ search: "?days=365" }} />);
    expect(renderer.root.findByType(SelectInput).props.value).toBe("30");
    expect(apiFetch.mock.calls[0][0]).toBe("admin-discord-analytics?days=30");
  });

  it("preserves the latest snapshot on transient refresh failure with a stale-data explanation", async () => {
    apiFetch.mockResolvedValueOnce(report()).mockRejectedValueOnce(new Error("Serveur indisponible."));
    const renderer = await render();
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(values(renderer)).toEqual(["25", "32", "8", "2"]);
    expect(text(renderer)).toContain("Les dernières données restent affichées");
    expect(text(renderer)).toContain("Serveur indisponible.");
  });

  it.each([401, 403])("clears administrator data if refresh returns %i", async status => {
    apiFetch.mockResolvedValueOnce(report()).mockRejectedValueOnce(Object.assign(new Error("Accès refusé."), { status }));
    const renderer = await render();
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(values(renderer)).toEqual([]);
    expect(text(renderer)).not.toContain("Équipe Alpha");
    expect(text(renderer)).not.toContain("111111111111111111");
    expect(text(renderer)).toContain("Statistiques indisponibles.");
  });

  it("searches servers by normalized team/channel names and Discord IDs without fetching again", async () => {
    const historicGuild = { ...guild("333333333333333333", "Équipe historique", "archives"), teams: [] };
    apiFetch.mockResolvedValueOnce(report({ guilds: [...report().guilds, historicGuild] }));
    const renderer = await render();
    const search = value => act(() => renderer.root.findByType(TextInput).props.onChange(value));
    search("EQUIPE resultats");
    expect(renderer.root.findAllByProps({ className: "bot-guild" })).toHaveLength(1);
    expect(renderer.root.findByProps({ className: "bot-guild" }).findByProps({ className: "bot-guild-teams" }).children).toEqual(["Équipe Alpha"]);
    search("222222222222222222");
    expect(renderer.root.findAllByProps({ className: "bot-guild" })).toHaveLength(1);
    expect(renderer.root.findByProps({ className: "bot-guild" }).findByProps({ className: "bot-guild-teams" }).children).toEqual(["Academy Beta"]);
    search("EQUIPE HISTORIQUE");
    expect(renderer.root.findAllByProps({ className: "bot-guild" })).toHaveLength(1);
    expect(renderer.root.findByProps({ className: "bot-guild" }).findByProps({ className: "bot-guild-teams" }).children).toEqual(["Aucune équipe actuellement reliée"]);
    expect(text(renderer)).toContain("Équipe historique");
    search("unknown-server");
    expect(text(renderer)).toContain("Aucun serveur ne correspond à cette recherche");
    act(() => renderer.root.findByProps({ className: "bot-reset" }).props.onClick());
    expect(renderer.root.findAllByProps({ className: "bot-guild" })).toHaveLength(3);
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("paginates servers and resets to the first page after a search", async () => {
    apiFetch.mockResolvedValueOnce(report({ guilds: Array.from({ length: 12 }, (_, index) => guild(`${index}`, `Team ${index}`, `channel-${index}`)) }));
    const renderer = await render();
    expect(renderer.root.findAllByProps({ className: "bot-guild" })).toHaveLength(10);
    expect(button(renderer, "Précédent").props.disabled).toBe(true);
    act(() => button(renderer, "Suivant").props.onClick());
    expect(renderer.root.findAllByProps({ className: "bot-guild" })).toHaveLength(2);
    expect(button(renderer, "Suivant").props.disabled).toBe(true);
    act(() => renderer.root.findByType(TextInput).props.onChange("channel-0"));
    expect(renderer.root.findAllByProps({ className: "bot-guild" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ className: "bot-pagination" })).toHaveLength(0);
  });
});

describe("accessible bot activity chart", () => {
  it("distinguishes commands outside retention from a recorded day with zero commands", async () => {
    const renderer = await render(<BotDailyChart rows={report().daily} />);
    const rows = renderer.root.findByType("tbody").findAllByType("tr");
    expect(rows[0].findAllByType("td").at(-1).children).toEqual(["Non conservées"]);
    expect(rows[1].findAllByType("td").at(-1).children).toEqual(["0"]);
    const slider = renderer.root.findByProps({ type: "range" });
    expect(slider.props["aria-valuetext"]).toContain("17 envois confirmés");
    act(() => slider.props.onChange({ target: { value: "0" } }));
    expect(slider.props["aria-valuetext"]).toContain("15 envois confirmés");
    expect(renderer.root.findByProps({ "aria-label": "Données quotidiennes du bot" }).props.tabIndex).toBe(0);
  });
});
