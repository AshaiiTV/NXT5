import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, TextAreaInput } from "../components/ui/Core.jsx";
import AdministrationPage from "../pages/admin/AdministrationPage.jsx";
import AccountSubscriptionsPage from "../pages/admin/AccountSubscriptionsPage.jsx";
import BotAnalyticsPage from "../pages/admin/BotAnalyticsPage.jsx";
import AudiencePage from "../pages/admin/AudiencePage.jsx";
import { setLanguage } from "../i18n/locale.js";
import { loadLanguageMessages } from "../i18n/translate.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const renderers = [];
beforeAll(async () => { await Promise.all(["en", "es"].map(loadLanguageMessages)); });
beforeEach(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), localStorage: { setItem: vi.fn() } });
});
afterEach(() => {
  renderers.splice(0).forEach(renderer => act(() => renderer.unmount()));
  setLanguage("fr");
  vi.resetAllMocks(); vi.unstubAllGlobals();
});
async function render(element) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element); });
  await act(async () => { await vi.dynamicImportSettled(); });
  renderers.push(renderer);
  return renderer;
}
const content = node => typeof node === "string" ? node : (node.children || []).map(content).join("");
const text = renderer => JSON.stringify(renderer.toJSON());
const request = { id: "r1", teamName: "Équipe test", contactName: "Capitaine", email: "camille@example.test", role: "captain", planCode: "team_monthly", payer: "association", purchaseIntent: "maybe", message: "Nouvelle demande", status: "new", adminNote: "À discuter", createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-09-08T10:00:00Z" };

describe("translated administrator pages", () => {
  it.each([["en", "Site language", "Captain", "To discuss", "New request"], ["es", "Idioma del sitio", "Capitán", "Por hablar", "Nueva solicitud"]])("switches the real administration header to %s without losing an edited private note", async (language, accessibleLabel, role, intent, state) => {
    apiFetch.mockResolvedValue({ requests: [request], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }, stats: { total: 1, presentedTeams: 0, confirmedTeams: 0 } });
    const renderer = await render(<AdministrationPage route={{ path: "/admin/demandes-acces", search: "" }} navigate={vi.fn()} user={{ name: "Capitaine" }} />);
    const follow = renderer.root.findAllByType(Button).find(node => node.props.children === "Suivre cette demande");
    await act(async () => { follow.props.onClick(); });
    await act(async () => { renderer.root.findByType(TextAreaInput).props.onChange("À discuter : ma note privée"); });
    const selector = renderer.root.findByProps({ className: "nxt5-language-select" });
    await act(async () => { await selector.props.onChange({ target: { value: language } }); });
    expect(selector.props["aria-label"]).toBe(accessibleLabel);
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("À discuter : ma note privée");
    expect(text(renderer)).toContain(role);
    expect(text(renderer)).toContain(intent);
    expect(text(renderer)).toContain(state);
    expect(content(renderer.root.findByProps({ className: "administration-account" }))).toContain("Capitaine");
    expect(content(renderer.root.findByProps({ className: "access-request-message" }))).toContain("Nouvelle demande");
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it.each([["en", "Season Pass (previous plan) → Team Pass", "From "], ["es", "Pase de Temporada (plan anterior) → Pase de Equipo", "Del "]])("translates subscription history and dates in %s while preserving names and notes", async (language, migration, periodStart) => {
    await setLanguage(language);
    const subscription = { planCode: "team_monthly", status: "active", startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z", revision: 1, note: "À discuter" };
    apiFetch.mockResolvedValue({ account: { id: "u1", name: "Capitaine", email: "camille@example.test", subscription }, history: [{ ...subscription, id: "h1", action: "migrate", previousPlanCode: "team_season", actorName: "Capitaine", note: "Nouvelle demande", createdAt: "2026-09-01T10:00:00Z" }] });
    const renderer = await render(<AccountSubscriptionsPage initialUserId="u1" navigate={vi.fn()} />);
    expect(text(renderer)).toContain(migration);
    expect(content(renderer.root.findByProps({ className: "as-subscription-summary" }))).toContain(periodStart);
    expect(content(renderer.root.findByProps({ id: "subscription-editor-title" }))).toBe("Capitaine");
    expect(content(renderer.root.findByProps({ className: "as-history-note" }))).toBe("Nouvelle demande");
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("À discuter");
  });

  it.each([["en", "Confirmed", "Channel 99"], ["es", "Confirmado", "Canal 99"]])("translates recorded bot states and unnamed channels in %s", async (language, state, channel) => {
    await setLanguage(language);
    const summary = { publications: 1, successfulDeliveries: 1, commands: 0, guilds: 1, failedDeliveries: 0, uncertainDeliveries: 0, connectionTests: 0, successRate: 100, connections: 1, activeConnections: 1, pausedConnections: 0, channels: 1, queuedJobs: 0, blockedJobs: 0 };
    apiFetch.mockResolvedValue({ schemaReady: true, generatedAt: "2026-09-22T12:30:00Z", period: { days: 30, from: "2026-08-24", to: "2026-09-22" }, summary, coverage: { notes: [], commandsFrom: "2026-09-15", commandsRetentionDays: 7 }, daily: [], commands: [], guilds: [], recentActivity: [{ id: "d1", kind: "delivery", at: "2026-09-22T12:00:00Z", status: "succeeded", guildId: "123", teamName: "Équipe test", channelId: "99" }] });
    const renderer = await render(<BotAnalyticsPage />);
    const activity = renderer.root.findByProps({ className: "bot-activity" });
    expect(content(activity)).toContain(state);
    expect(content(activity)).toContain(channel);
    expect(content(activity)).toContain("Équipe test");
    expect(content(activity)).not.toContain("Salon 99");
  });

  it.each([["en", "Desktop"], ["es", "Ordenador"]])("translates audience device categories in %s", async (language, device) => {
    await setLanguage(language);
    const totals = { visitors: 1, sessions: 1, pageviews: 1, conversions: 0 };
    apiFetch.mockResolvedValue({ period: { from: "2026-09-01", to: "2026-09-30", days: 30 }, totals, previous: totals, timeseries: [], pages: [], sources: [], goals: [], devices: [{ device: "desktop", sessions: 1 }], browsers: [{ browser: "Chrome", sessions: 1 }], countries: [], heatmap: [], generatedAt: "2026-09-30T12:00:00Z" });
    const renderer = await render(<AudiencePage />);
    const rows = renderer.root.findAllByProps({ className: "audience-breakdown-row" });
    expect(content(rows[0])).toContain(device);
    expect(content(rows[1])).toContain("Chrome");
  });
});
