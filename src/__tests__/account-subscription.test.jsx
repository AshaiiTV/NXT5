import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountSubscription from "../components/account/AccountSubscription.jsx";
import { Button } from "../components/ui/Core.jsx";
import { apiFetch } from "../api/client.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.resetAllMocks(); });
const subscription = { planCode: "team_season", effectivePlanCode: "team_season", status: "active", startsAt: "2026-09-08T00:00:00Z", endsAt: null, revision: 1 };
const text = () => JSON.stringify(renderer.toJSON());
async function render() { await act(async () => { renderer = TestRenderer.create(<AccountSubscription />); }); }
async function refresh() { await act(async () => renderer.root.findByType(Button).props.onClick()); }

describe("personal subscription summary", () => {
  it("loads the current account only and displays the assigned plan without admin controls", async () => {
    apiFetch.mockResolvedValue({ subscription });
    await render();
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("account-subscription");
    expect(text()).toContain("Pass Saison");
    expect(text()).toContain("Sans date de fin");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findAllByType(Button)).toHaveLength(1);
  });

  it("refreshes a revoked attribution without retaining an active presentation", async () => {
    apiFetch.mockResolvedValueOnce({ subscription });
    await render();
    apiFetch.mockResolvedValueOnce({ subscription: { ...subscription, effectivePlanCode: "free", status: "revoked" } });
    await refresh();
    expect(text()).toContain("Ce Pass n’est plus actif.");
    expect(text()).toContain("Pass Saison");
  });

  it("does not infer discovery access from a failed or malformed response and allows retry", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Service indisponible"));
    await render();
    expect(text()).toContain("Service indisponible");
    expect(text()).not.toContain("Aucun Pass actif");
    apiFetch.mockResolvedValueOnce({});
    await refresh();
    expect(text()).toContain("L’abonnement n’a pas pu être vérifié.");
    apiFetch.mockResolvedValueOnce({ subscription: { ...subscription, planCode: "free", effectivePlanCode: "free", status: "none", startsAt: null } });
    await refresh();
    expect(text()).toContain("Découverte");
    expect(text()).toContain("Aucun Pass actif");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  });

  it("does not announce a scheduled pass as already effective", async () => {
    apiFetch.mockResolvedValue({ subscription: { ...subscription, status: "scheduled", effectivePlanCode: "free" } });
    await render();
    expect(text()).toContain("Ce Pass prendra effet à la date de début indiquée.");
  });
});
