import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, SelectInput, TextInput } from "../components/ui/Core.jsx";
import { AdminQueryProvider } from "../hooks/useAdminQuery.js";
import { PurchaseHistory, PurchaseOverview } from "../pages/admin/Purchases.jsx";
import IntegrationsPage from "../pages/admin/IntegrationsPage.jsx";
import AccessRequestsPage from "../pages/admin/AccessRequestsPage.jsx";
import PricingPage from "../pages/public/PricingPage.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../pages/public/PublicPages.jsx", () => ({ LinkButton: ({ children }) => <a>{children}</a>, SiteHeader: () => null, LegalLinks: () => null }));
const renderers = [];
afterEach(() => {
  renderers.splice(0).forEach(renderer => act(() => renderer.unmount()));
  vi.resetAllMocks();
  vi.useRealTimers();
});
const purchase = { id: "purchase-1", reference: "NXT5-001", customerName: "Camille", teamName: "Équipe test", planLabel: "Pass Équipe", unitAmountCents: 2900, quantity: 1, amountCents: 2900, status: "paid", orderedAt: "2026-09-14T10:00:00Z", paidAt: "2026-09-14T10:00:00Z" };
const history = { purchases: [purchase], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } };
const overview = { totals: { orders: 1, paid: 1, pending: 0, paidCents: 2900, averageCents: 2900, frequency30d: 0.03, paid30d: 1, paidPrevious30d: 0, cancelled: 0, refunded: 0 }, monthly: [{ date: "2026-09-01", count: 1, amountCents: 2900 }], generatedAt: "2026-09-14T10:00:00Z" };
const accessRequest = { id: "request-1", contactName: "Camille", email: "camille@example.test", teamName: "Équipe privée", role: "coach", planCode: "team_monthly", payer: "association", purchaseIntent: "yes", message: "", status: "new", adminNote: "", createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-09-08T10:00:00Z" };
const requests = { requests: [accessRequest], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }, stats: { total: 1, contacted: 0, confirmed: 0, declined: 0, presentedTeams: 0, confirmedTeams: 0 } };
const admin = { id: "admin", name: "Camille", email: "camille@example.test", is_platform_admin: true };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const text = renderer => JSON.stringify(renderer.toJSON());
const button = (renderer, label) => renderer.root.findAllByType(Button).find(node => React.Children.toArray(node.props.children).includes(label));
async function render(element) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
}

function completePricingForm(renderer) {
  act(() => {
    renderer.root.findAllByType(TextInput).find(node => node.props.name === "teamName").props.onChange("Nouvelle équipe");
    renderer.root.findAllByType(SelectInput).find(node => node.props.name === "role").props.onChange("coach");
    renderer.root.findAllByType(SelectInput).find(node => node.props.name === "purchaseIntent").props.onChange("yes");
    renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } });
  });
}

describe("administration page loading", () => {
  it.each([
    ["purchase history", PurchaseHistory, history, "Actualiser", "NXT5-001"],
    ["purchase overview", PurchaseOverview, overview, "Actualiser les achats", "29,00"],
  ])("keeps %s readable throughout a slow refresh and a transient failure", async (_name, Component, payload, refreshLabel, visibleValue) => {
    apiFetch.mockResolvedValueOnce(payload);
    const renderer = await render(<Component />);
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    await act(async () => button(renderer, refreshLabel).props.onClick());
    expect(text(renderer)).toContain(visibleValue);
    expect(text(renderer)).toContain("Actualisation des achats…");
    expect(renderer.root.findAllByProps({ "aria-label": "Chargement des achats" })).toHaveLength(0);
    await act(async () => pending.reject(new Error("Connexion interrompue.")));
    expect(text(renderer)).toContain(visibleValue);
    expect(text(renderer)).toContain("Connexion interrompue.");
    expect(text(renderer)).toContain("dernière lecture réussie");
  });

  it("reuses fresh purchases after navigation and reloads stale purchases without clearing them", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    apiFetch.mockResolvedValueOnce(history);
    const renderer = await render(<AdminQueryProvider><PurchaseHistory /></AdminQueryProvider>);
    await act(async () => renderer.update(<AdminQueryProvider><p>Autre rubrique</p></AdminQueryProvider>));
    await act(async () => renderer.update(<AdminQueryProvider><PurchaseHistory /></AdminQueryProvider>));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(text(renderer)).toContain("NXT5-001");
    vi.setSystemTime(new Date("2026-09-15T12:00:31Z"));
    await act(async () => renderer.update(<AdminQueryProvider><p>Autre rubrique</p></AdminQueryProvider>));
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    await act(async () => renderer.update(<AdminQueryProvider><PurchaseHistory /></AdminQueryProvider>));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(text(renderer)).toContain("NXT5-001");
    expect(text(renderer)).toContain("Actualisation des achats…");
    await act(async () => pending.resolve({ ...history, purchases: [{ ...purchase, reference: "NXT5-002" }] }));
    expect(text(renderer)).toContain("NXT5-002");
    expect(text(renderer)).not.toContain("NXT5-001");
  });

  it("never shows purchase rows from another filter and reuses only the matching cached result", async () => {
    apiFetch.mockResolvedValueOnce(history);
    const renderer = await render(<AdminQueryProvider><PurchaseHistory /></AdminQueryProvider>);
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    await act(async () => renderer.root.findByType("select").props.onChange({ target: { value: "pending" } }));
    expect(text(renderer)).not.toContain("NXT5-001");
    expect(apiFetch).toHaveBeenLastCalledWith("admin-purchases?page=1&pageSize=10&status=pending", expect.any(Object));
    await act(async () => pending.resolve({ ...history, purchases: [], pagination: { ...history.pagination, total: 0 } }));
    expect(text(renderer)).toContain("Aucun achat pour ces filtres");
    await act(async () => renderer.root.findByType("select").props.onChange({ target: { value: "" } }));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(text(renderer)).toContain("NXT5-001");
  });

  it("preserves purchase rows after a malformed refresh response", async () => {
    apiFetch.mockResolvedValueOnce(history).mockResolvedValueOnce({});
    const renderer = await render(<PurchaseHistory />);
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(text(renderer)).toContain("NXT5-001");
    expect(text(renderer)).toContain("Les données d’achats sont indisponibles.");
    expect(text(renderer)).not.toContain("Aucun achat enregistré");
  });

  it("preserves Shopify configuration during refresh and after a read failure", async () => {
    apiFetch.mockResolvedValueOnce({ configured: true, domain: "nxt5.myshopify.com", apiVersion: "2026-07", issues: [] });
    const renderer = await render(<IntegrationsPage navigate={vi.fn()} />);
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(text(renderer)).toContain("nxt5.myshopify.com");
    await act(async () => pending.reject(new Error("Service indisponible.")));
    expect(text(renderer)).toContain("nxt5.myshopify.com");
    expect(text(renderer)).toContain("La configuration ci-dessus date de la dernière lecture réussie.");
  });

  it.each([[401, "POST"], [403, "DELETE"]])("clears scoped snapshots when an access-request %s %s mutation is unauthorized", async (status, method) => {
    apiFetch.mockImplementation((path, options) => {
      if (options?.method === method) return Promise.reject(Object.assign(new Error("Accès administrateur requis."), { status }));
      if (path.startsWith("admin-purchases?")) return Promise.resolve(history);
      return Promise.resolve(requests);
    });
    const renderer = await render(<AdminQueryProvider><PurchaseHistory /><AccessRequestsPage navigate={vi.fn()} /></AdminQueryProvider>);
    expect(text(renderer)).toContain("NXT5-001");
    expect(text(renderer)).toContain("Équipe privée");
    if (method === "POST") {
      act(() => button(renderer, "Suivre cette demande").props.onClick());
      act(() => renderer.root.findAllByType(SelectInput).find(node => node.props.label === "Statut du suivi").props.onChange("confirmed"));
      await act(async () => renderer.root.findAllByType("form").find(node => node.props.id).props.onSubmit({ preventDefault() {} }));
    } else {
      act(() => button(renderer, "Supprimer").props.onClick());
      await act(async () => button(renderer, "Confirmer la suppression").props.onClick());
    }
    expect(text(renderer)).not.toContain("NXT5-001");
    expect(text(renderer)).not.toContain("Équipe privée");
    expect(text(renderer)).toContain("Accès administrateur requis.");
  });

  it.each([401, 403])("clears other cached pages when Shopify testing returns %s", async status => {
    apiFetch.mockImplementation((path, options) => {
      if (options?.method === "POST") return Promise.reject(Object.assign(new Error("Accès administrateur requis."), { status }));
      if (path.startsWith("admin-purchases?")) return Promise.resolve(history);
      return Promise.resolve({ configured: true, domain: "nxt5.myshopify.com", apiVersion: "2026-07", issues: [] });
    });
    const renderer = await render(<AdminQueryProvider><PurchaseHistory /><IntegrationsPage navigate={vi.fn()} /></AdminQueryProvider>);
    await act(async () => button(renderer, "Tester la connexion").props.onClick());
    expect(text(renderer)).not.toContain("NXT5-001");
    expect(text(renderer)).not.toContain("nxt5.myshopify.com");
    expect(text(renderer)).toContain("Accès administrateur requis.");
  });

  it.each(["confirmed", "unconfirmed", "failed"])("invalidates access requests only after confirmed creation (%s)", async outcome => {
    apiFetch.mockResolvedValueOnce(requests);
    const renderer = await render(<AdminQueryProvider><AccessRequestsPage navigate={vi.fn()} /></AdminQueryProvider>);
    await act(async () => renderer.update(<AdminQueryProvider><PricingPage embedded user={admin} navigate={vi.fn()} /></AdminQueryProvider>));
    completePricingForm(renderer);
    if (outcome === "failed") apiFetch.mockRejectedValueOnce(new Error("Service indisponible."));
    else apiFetch.mockResolvedValueOnce({ ok: outcome === "confirmed" });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(apiFetch).toHaveBeenLastCalledWith("access-requests", expect.objectContaining({ method: "POST" }));
    if (outcome === "confirmed") apiFetch.mockResolvedValueOnce({ ...requests, requests: [{ ...accessRequest, teamName: "Nouvelle équipe" }] });
    await act(async () => renderer.update(<AdminQueryProvider><AccessRequestsPage navigate={vi.fn()} /></AdminQueryProvider>));
    expect(apiFetch).toHaveBeenCalledTimes(outcome === "confirmed" ? 3 : 2);
    expect(text(renderer)).toContain(outcome === "confirmed" ? "Nouvelle équipe" : "Équipe privée");
  });

  it("purges administration snapshots when access-request creation is no longer authorized", async () => {
    apiFetch.mockResolvedValueOnce(history);
    const renderer = await render(<AdminQueryProvider><PurchaseHistory /><PricingPage embedded user={admin} navigate={vi.fn()} /></AdminQueryProvider>);
    completePricingForm(renderer);
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Accès administrateur requis."), { status: 403 }));
    await act(async () => renderer.root.findAllByType("form").find(node => node.props["aria-describedby"] === "access-request-help").props.onSubmit({ preventDefault() {} }));
    expect(text(renderer)).not.toContain("NXT5-001");
    expect(text(renderer)).toContain("Accès administrateur requis.");
  });
});
