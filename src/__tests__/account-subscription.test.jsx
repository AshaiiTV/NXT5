import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountSubscription from "../components/account/AccountSubscription.jsx";
import { Button } from "../components/ui/Core.jsx";
import { apiFetch } from "../api/client.js";
import { SUBSCRIPTION_UPDATED_EVENT, subscriptionPeriodLabel } from "../app/subscriptions.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.resetAllMocks(); vi.unstubAllGlobals(); });
const subscription = { planCode: "team_monthly", effectivePlanCode: "team_monthly", status: "active", startsAt: "2026-09-08T00:00:00Z", endsAt: null, revision: 1 };
const pendingTrial = { planCode: "free", effectivePlanCode: null, status: "pending", startsAt: null, endsAt: null, revision: 1 };
function nodeText(node) {
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node == null) return "";
  return typeof node === "object" ? nodeText(node.children) : String(node);
}
const text = () => nodeText(renderer.toJSON());
async function render(compact = false) { await act(async () => { renderer = TestRenderer.create(<AccountSubscription compact={compact} />); }); }
async function refresh() { await act(async () => renderer.root.findByType(Button).props.onClick()); }

describe("personal subscription summary", () => {
  it("loads the current account only and displays the assigned plan without admin controls", async () => {
    apiFetch.mockResolvedValue({ subscription: { ...subscription, note: "Note privée de l’administration" } });
    await render();
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("account-subscription");
    expect(text()).toContain("Pass Équipe");
    expect(text()).toContain("sans date de fin");
    expect(text()).toContain("tous les outils restent accessibles");
    expect(text()).toContain("ne déclenche aucun paiement");
    expect(text()).not.toContain("Note privée");
    expect(text()).not.toMatch(/Pass Saison|Pass Structure/);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findAllByType(Button)).toHaveLength(1);
  });

  it("refreshes a revoked attribution without retaining an active presentation", async () => {
    apiFetch.mockResolvedValueOnce({ subscription });
    await render();
    apiFetch.mockResolvedValueOnce({ subscription: { ...subscription, effectivePlanCode: null, status: "revoked" } });
    await refresh();
    expect(text()).toContain("Ce Pass n’est plus actif.");
    expect(text()).toContain("Pass Équipe");
    expect(text()).not.toContain("Découverte");
  });

  it("does not infer discovery access from a failed or malformed response and allows retry", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Service indisponible"));
    await render();
    expect(text()).toContain("Service indisponible");
    expect(text()).not.toContain("Découverte");
    apiFetch.mockResolvedValueOnce({});
    await refresh();
    expect(text()).toContain("L’abonnement n’a pas pu être vérifié.");
    apiFetch.mockResolvedValueOnce({ subscription: { ...pendingTrial, status: "none" } });
    await refresh();
    expect(text()).toContain("Sans abonnement");
    expect(text()).toContain("Aucun abonnement n’est attribué");
    expect(text()).not.toContain("Découverte");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  });

  it("does not announce a scheduled pass as already effective", async () => {
    apiFetch.mockResolvedValue({ subscription: { ...subscription, status: "scheduled", effectivePlanCode: null } });
    await render();
    expect(text()).toContain("Ce Pass prendra effet à la date de début indiquée.");
    expect(text()).not.toContain("Découverte");
  });

  it("shows an unstarted complete 14-day trial without inventing an expiry", async () => {
    apiFetch.mockResolvedValue({ subscription: pendingTrial });
    await render();
    expect(text()).toContain("Découverte");
    expect(text()).toContain("Essai non démarré");
    expect(text()).toContain("14 jours d’accès à tous les outils");
    expect(text()).toContain("le Pass Équipe sera nécessaire");
    expect(text()).toContain("Aucune période n’est décomptée");
    expect(text()).not.toMatch(/1970|Sans date de fin|sans date de fin/);
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("account-subscription");
  });

  it.each([
    ["active", "Essai en cours"],
    ["expired", "Essai terminé"],
  ])("shows the exact period for a %s trial and keeps the prelaunch access message", async (status, statusLabel) => {
    const trial = { ...pendingTrial, status, effectivePlanCode: status === "active" ? "free" : null, startsAt: "2026-09-09T13:42:00Z", endsAt: "2026-09-23T13:42:00Z" };
    apiFetch.mockResolvedValue({ subscription: trial });
    await render();
    expect(text()).toContain(statusLabel);
    expect(text()).toContain(subscriptionPeriodLabel(trial));
    expect(text()).toContain("tous les outils restent accessibles");
    expect(text()).not.toContain("Aucune période n’est décomptée");
  });

  it("updates the full summary on window focus without subscribing to its own update event", async () => {
    const browserWindow = new EventTarget();
    vi.stubGlobal("window", browserWindow);
    apiFetch.mockResolvedValue({ subscription: pendingTrial });
    await render();
    apiFetch.mockResolvedValue({ subscription });
    await act(async () => browserWindow.dispatchEvent(new Event("focus")));
    expect(text()).toContain("Pass Équipe");
    expect(text()).not.toContain("Découverte");
    expect(apiFetch).toHaveBeenCalledTimes(2);
    await act(async () => browserWindow.dispatchEvent(new Event(SUBSCRIPTION_UPDATED_EVENT)));
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});

describe("compact player subscription badge", () => {
  it.each([
    [{ ...subscription, effectivePlanCode: null, status: "expired" }, "Pass Équipe · Expiré"],
    [{ ...subscription, effectivePlanCode: null, status: "revoked" }, "Pass Équipe · Retiré"],
    [{ ...subscription, effectivePlanCode: null, status: "scheduled" }, "Pass Équipe · À venir"],
    [pendingTrial, "Découverte · Essai non démarré"],
    [{ ...pendingTrial, status: "none" }, "Sans abonnement"],
  ])("represents the assigned grade and status instead of falling back to Discovery: %j", async (assignedSubscription, label) => {
    apiFetch.mockResolvedValue({ subscription: assignedSubscription });
    await render(true);
    expect(text()).toBe(label);
    expect(text()).not.toContain("Indisponible");
    expect(renderer.root.findAllByType("button")).toHaveLength(0);
  });

  it("reloads the corresponding player's grade after updates and focus without emitting a loop", async () => {
    const browserWindow = new EventTarget();
    vi.stubGlobal("window", browserWindow);
    apiFetch.mockResolvedValue({ subscription: pendingTrial });
    await render(true);
    apiFetch.mockResolvedValue({ subscription });
    await act(async () => browserWindow.dispatchEvent(new Event(SUBSCRIPTION_UPDATED_EVENT)));
    expect(text()).toBe("Pass Équipe");
    expect(apiFetch).toHaveBeenCalledTimes(2);
    apiFetch.mockResolvedValue({ subscription: { ...subscription, status: "expired", effectivePlanCode: null } });
    await act(async () => browserWindow.dispatchEvent(new Event("focus")));
    expect(text()).toBe("Pass Équipe · Expiré");
    expect(apiFetch).toHaveBeenCalledTimes(3);
    act(() => renderer.unmount());
    renderer = null;
    browserWindow.dispatchEvent(new Event(SUBSCRIPTION_UPDATED_EVENT));
    browserWindow.dispatchEvent(new Event("focus"));
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it("keeps loading failures distinct from no subscription and offers a retry", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Service indisponible"));
    await render(true);
    expect(text()).toBe("Indisponible");
    apiFetch.mockResolvedValueOnce({ subscription: pendingTrial });
    await act(async () => renderer.root.findByType("button").props.onClick());
    expect(text()).toBe("Découverte · Essai non démarré");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
