import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, SelectInput } from "../components/ui/Core.jsx";
import { AdminQueryProvider } from "../hooks/useAdminQuery.js";
import AudiencePage, { AudienceChart, AudienceHeatmap } from "../pages/admin/AudiencePage.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const renderers = [];
afterEach(() => { renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())); vi.resetAllMocks(); vi.useRealTimers(); });
const totals = { visitors: 40, sessions: 50, pageviews: 105, engagedSessions: 25, engagementRate: 50, avgDurationSeconds: 64, pagesPerSession: 2.1, conversions: 5, conversionRate: 10, bounceRate: 50, returningVisitors: 8 };
const result = (overrides = {}) => ({ period: { from: "2026-08-16", to: "2026-09-14", days: 30, timezone: "UTC" }, comparison: { from: "2026-07-17", to: "2026-08-15" }, totals, previous: { ...totals, sessions: 25, conversionRate: 5 }, timeseries: [{ date: "2026-09-13", visitors: 4, sessions: 6, pageviews: 18, conversions: 0 }, { date: "2026-09-14", visitors: 5, sessions: 7, pageviews: 20, conversions: 2 }], pages: [{ path: "/tarifs", views: 60, visitors: 30, avgDurationSeconds: 60, exits: 12 }, { path: "/", views: 45, visitors: 35, avgDurationSeconds: 15, exits: 25 }], sources: [{ source: "direct", sessions: 50, visitors: 40, conversions: 5 }], campaigns: [], devices: [{ device: "desktop", sessions: 50 }], browsers: [{ browser: "Chrome", sessions: 50 }], countries: [{ country: "FR", sessions: 50 }], heatmap: [{ weekday: 1, hour: 10, pageviews: 8 }], goals: [{ name: "signup", events: 2, sessions: 2, conversionRate: 4 }, { name: "access_request", events: 3, sessions: 3, conversionRate: 6 }], realtime: { visitors: 2, sessions: 2, windowMinutes: 5, pages: [{ path: "/tarifs", visitors: 2 }] }, filters: { sources: ["direct", "social"] }, generatedAt: "2026-09-14T12:30:00Z", retentionDays: 180, ...overrides });
async function render(element = <AudiencePage />) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
}
const text = (renderer) => JSON.stringify(renderer.toJSON());
const button = (renderer, label) => renderer.root.findAllByType(Button).find((node) => node.props.children === label || node.props["aria-label"] === label);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

describe("audience dashboard", () => {
  it("renders the actual report and identifies consent scope and UTC comparisons", async () => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render();
    expect(apiFetch).toHaveBeenCalledWith("admin-audience?days=30&device=all&source=all", expect.objectContaining({ signal: expect.any(AbortSignal), timeoutMs: 25000 }));
    const metrics = renderer.root.findAllByProps({ className: "audience-metric" });
    expect(metrics.map((metric) => metric.findByType("strong").children.join(""))).toEqual(["40", "50", "105", "10 %"]);
    expect(text(renderer)).toContain("+100 %");
    expect(text(renderer)).toContain("+5 pt");
    expect(text(renderer)).toContain("visites avec consentement");
    expect(text(renderer)).toContain("Un navigateur n’est pas une personne");
    expect(text(renderer)).toContain("Compte créé");
    expect(text(renderer)).toContain("UTC");
    expect(button(renderer, "Exporter CSV").props.disabled).toBe(false);
  });

  it("keeps missing migration, network errors and a confirmed empty report distinct", async () => {
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("migration"), { code: "AUDIENCE_SCHEMA_MISSING" }));
    const renderer = await render();
    expect(text(renderer)).toContain("La collecte d’audience reste à initialiser");
    expect(text(renderer)).not.toContain("Aucune visite mesurée");
    apiFetch.mockRejectedValueOnce(new Error("Le serveur est indisponible."));
    await act(async () => button(renderer, "Réessayer").props.onClick());
    expect(text(renderer)).toContain("Le serveur est indisponible.");
    expect(text(renderer)).not.toContain("Aucune visite mesurée");
    apiFetch.mockResolvedValueOnce(result({ totals: Object.fromEntries(Object.keys(totals).map((key) => [key, 0])), pages: [], timeseries: [] }));
    await act(async () => button(renderer, "Réessayer").props.onClick());
    expect(text(renderer)).toContain("Aucune visite mesurée sur cette période");
    expect(text(renderer)).not.toContain("Le serveur est indisponible.");
  });

  it("discards obsolete requests, clears old-filter values immediately, and aborts on unmount", async () => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render();
    const mobile = deferred();
    const social = deferred();
    apiFetch.mockReturnValueOnce(mobile.promise).mockReturnValueOnce(social.promise);
    await act(async () => renderer.root.findAllByType(SelectInput).find((node) => node.props.label === "Appareil").props.onChange("mobile"));
    expect(renderer.root.findAllByProps({ className: "audience-metric" })).toHaveLength(0);
    expect(text(renderer)).toContain("Chargement de la fréquentation");
    const mobileSignal = apiFetch.mock.calls[1][1].signal;
    await act(async () => renderer.root.findAllByType(SelectInput).find((node) => node.props.label === "Source").props.onChange("social"));
    expect(mobileSignal.aborted).toBe(true);
    await act(async () => social.resolve(result({ totals: { ...totals, visitors: 12 } })));
    await act(async () => mobile.resolve(result({ totals: { ...totals, visitors: 999 } })));
    const firstMetric = renderer.root.findAllByProps({ className: "audience-metric" })[0];
    expect(firstMetric.findByType("strong").children).toEqual(["12"]);
    expect(apiFetch).toHaveBeenLastCalledWith("admin-audience?days=30&device=mobile&source=social", expect.any(Object));
    apiFetch.mockReturnValueOnce(deferred().promise);
    await act(async () => button(renderer, "Actualiser").props.onClick());
    const lastSignal = apiFetch.mock.calls.at(-1)[1].signal;
    await act(async () => renderer.unmount()); renderers.splice(renderers.indexOf(renderer), 1);
    expect(lastSignal.aborted).toBe(true);
  });

  it("retains the last successful snapshot on refresh failure with an explicit stale-data explanation", async () => {
    apiFetch.mockResolvedValueOnce(result()).mockRejectedValueOnce(new Error("Connexion interrompue."));
    const renderer = await render();
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(renderer.root.findAllByProps({ className: "audience-metric" })).toHaveLength(4);
    expect(text(renderer)).toContain("dernière actualisation réussie pour ces filtres");
    expect(text(renderer)).toContain("Connexion interrompue.");
  });

  it.each([null, {}, { period: {}, totals: {}, timeseries: [], pages: [] }])("does not turn malformed payload %j into a zero report", async (payload) => {
    apiFetch.mockResolvedValueOnce(payload);
    const renderer = await render();
    expect(text(renderer)).toContain("La réponse des statistiques est incomplète");
    expect(renderer.root.findAllByProps({ className: "audience-metric" })).toHaveLength(0);
  });

  it("searches and sorts pages without requesting a new audience report", async () => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render();
    const search = renderer.root.findByProps({ type: "search" });
    act(() => search.props.onChange({ target: { value: "TARIFS" } }));
    const table = renderer.root.findByProps({ className: "audience-table audience-pages-table" });
    expect(table.findAllByType("tbody")[0].findAllByType("tr")).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    act(() => search.props.onChange({ target: { value: "aucun-chemin" } }));
    expect(text(renderer)).toContain("Aucune page ne correspond à cette recherche");
  });

  it("reuses a fresh report when returning to the same audience filters", async () => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render(<AdminQueryProvider><AudiencePage /></AdminQueryProvider>);
    const deviceFilter = () => renderer.root.findAllByType(SelectInput).find(node => node.props.label === "Appareil");
    apiFetch.mockResolvedValueOnce(result({ totals: { ...totals, visitors: 12 } }));
    await act(async () => deviceFilter().props.onChange("mobile"));
    expect(renderer.root.findAllByProps({ className: "audience-metric" })[0].findByType("strong").children).toEqual(["12"]);
    await act(async () => deviceFilter().props.onChange("all"));
    expect(renderer.root.findAllByProps({ className: "audience-metric" })[0].findByType("strong").children).toEqual(["40"]);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(text(renderer)).not.toContain("Chargement de la fréquentation");
  });

  it("keeps the successful report when a refresh returns an incomplete payload", async () => {
    apiFetch.mockResolvedValueOnce(result()).mockResolvedValueOnce({});
    const renderer = await render();
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(renderer.root.findAllByProps({ className: "audience-metric" })).toHaveLength(4);
    expect(text(renderer)).toContain("La réponse des statistiques est incomplète");
    expect(text(renderer)).toContain("dernière actualisation réussie pour ces filtres");
  });
});

describe("accessible audience charts", () => {
  it("provides a keyboard-operable daily selection and retains at least one visible series", async () => {
    const renderer = await render(<AudienceChart rows={result().timeseries} />);
    const slider = renderer.root.findByProps({ type: "range" });
    expect(slider.props["aria-valuetext"]).toContain("14 septembre");
    act(() => slider.props.onChange({ target: { value: "0" } }));
    expect(slider.props["aria-valuetext"]).toContain("13 septembre");
    expect(slider.props["aria-valuetext"]).toContain("18 pages vues");
    const legend = renderer.root.findByProps({ "aria-label": "Courbes affichées" }).findAllByType("button");
    act(() => legend[0].props.onClick());
    act(() => legend[1].props.onClick());
    expect(legend[1].props["aria-pressed"]).toBe(true);
  });

  it("has a single heatmap tab stop and navigates days/hours with the arrow keys", async () => {
    const renderer = await render(<AudienceHeatmap rows={[{ weekday: 1, hour: 10, pageviews: 8 }]} />);
    const cells = () => renderer.root.findAllByType("button");
    expect(cells().filter((node) => node.props.tabIndex === 0)).toHaveLength(1);
    const preventDefault = vi.fn();
    act(() => cells()[0].props.onKeyDown({ key: "ArrowDown", preventDefault }));
    expect(cells()[24].props.tabIndex).toBe(0);
    expect(preventDefault).toHaveBeenCalledOnce();
    act(() => cells()[24].props.onKeyDown({ key: "Home", ctrlKey: true, preventDefault }));
    act(() => cells()[0].props.onKeyDown({ key: "ArrowLeft", preventDefault }));
    expect(cells()[167].props["aria-label"]).toContain("Dimanche, 23 h");
    expect(cells()[167].props.tabIndex).toBe(0);
  });
});
