import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { PROPOSED_PLANS } from "../app/pricing.js";
import PricingPage from "../pages/public/PricingPage.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));

const cleanups = [];
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/tarifs"), localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function render() {
  const focusInput = vi.fn();
  const focusStatus = vi.fn();
  const scrollIntoView = vi.fn();
  let renderer;
  act(() => {
    renderer = TestRenderer.create(<PricingPage navigate={vi.fn()} />, {
      createNodeMock: (element) => element.props.id === "demande-acces"
        ? { scrollIntoView, querySelector: () => ({ focus: focusInput }) }
        : { focus: focusStatus },
    });
  });
  cleanups.push(() => act(() => renderer.unmount()));
  return { renderer, focusInput, focusStatus, scrollIntoView };
}

function edit(renderer, label, value) {
  act(() => renderer.root.findByProps({ label }).props.onChange(value));
}

function fill(renderer, { consent = true } = {}) {
  edit(renderer, "Ton nom ou pseudo *", "  Camille  ");
  edit(renderer, "E-mail de contact *", "  CAMILLE@example.fr  ");
  edit(renderer, "Nom de l’équipe *", "  Les Cinq  ");
  edit(renderer, "Ton rôle *", "manager");
  edit(renderer, "Qui prendrait en charge l’offre ?", "association");
  edit(renderer, "Ton intérêt pour cette offre *", "yes");
  edit(renderer, "Un besoin, une question ? (facultatif)", "  Un split de six mois.  ");
  if (consent) act(() => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
}

function submit(renderer) {
  return renderer.root.findByType("form").props.onSubmit({ preventDefault() {} });
}

describe("commercial validation pricing page", () => {
  it("shows only the three proposed team offers without any checkout or card field", () => {
    const { renderer } = render();
    expect(PROPOSED_PLANS.map((plan) => [plan.code, plan.price, plan.period])).toEqual([
      ["free", "0 €", "gratuit"],
      ["team_monthly", "29 €", "TTC / mois / équipe"],
      ["team_season", "169 €", "TTC / 6 mois / équipe"],
    ]);
    const page = JSON.stringify(renderer.toJSON());
    expect(page).toContain("Aucun paiement aujourd’hui.");
    expect(page).toContain("Tes accès actuels restent inchangés.");
    expect(page).toContain("sans renouvellement automatique");
    expect(page).not.toContain("290 €");
    expect(page).not.toContain("19 €");
    expect(renderer.root.findAllByType("a").some((link) => /checkout|stripe|achat/.test(link.props.href))).toBe(false);
    expect(renderer.root.findAllByType("input").some((input) => /^cc-/.test(input.props.autoComplete))).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("selects the requested plan, brings the form into view and focuses its first field", () => {
    const { renderer, scrollIntoView, focusInput } = render();
    act(() => renderer.root.findAllByType("button").find((button) => button.props["aria-label"] === "Demander un accès — Pass Saison").props.onClick());
    expect(renderer.root.findByProps({ label: "L’offre qui t’intéresse *" }).props.value).toBe("team_season");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(focusInput).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("requires explicit interest and consent before contacting the server", async () => {
    const { renderer } = render();
    expect(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).props.value).toBe("");
    fill(renderer, { consent: false });
    await act(async () => submit(renderer));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("Ton accord est nécessaire");
  });

  it("sends one trimmed request, waits for confirmation and never creates an account", async () => {
    const { renderer, focusStatus } = render();
    fill(renderer);
    edit(renderer, "L’offre qui t’intéresse *", "team_season");
    let complete;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    let pending;
    act(() => {
      pending = submit(renderer);
      submit(renderer);
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType("fieldset").props.disabled).toBe(true);
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(0);
    const [endpoint, options] = apiFetch.mock.calls[0];
    expect(endpoint).toBe("access-requests");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      contactName: "Camille", email: "camille@example.fr", teamName: "Les Cinq", role: "manager",
      planCode: "team_season", payer: "association", purchaseIntent: "yes", message: "Un split de six mois.", consent: true, website: "",
    });
    await act(async () => { complete({ ok: true }); await pending; });
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    const success = JSON.stringify(renderer.toJSON());
    expect(success).toContain("Demande reçue ou déjà enregistrée");
    expect(success).toContain("ses informations initiales sont conservées");
    expect(success).not.toContain("nous avons reçu ton intérêt pour");
    expect(success).toContain("Aucun compte ni abonnement n’a été activé");
    expect(focusStatus).toHaveBeenCalled();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("keeps every answer after an error and allows retrying", async () => {
    const { renderer, focusStatus } = render();
    fill(renderer);
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Database internal detail"), { status: 503 }));
    await act(async () => submit(renderer));
    expect(renderer.root.findByProps({ label: "E-mail de contact *" }).props.value).toBe("  CAMILLE@example.fr  ");
    expect(renderer.root.findByProps({ label: "Nom de l’équipe *" }).props.value).toBe("  Les Cinq  ");
    expect(renderer.root.findByProps({ type: "checkbox" }).props.checked).toBe(true);
    expect(renderer.root.findByType("fieldset").props.disabled).toBe(false);
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("Tes réponses sont conservées");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Database internal detail");
    expect(focusStatus).toHaveBeenCalled();
    apiFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => submit(renderer));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(1);
  });

  it("does not announce a saved request for an unconfirmed response", async () => {
    const { renderer } = render();
    fill(renderer);
    apiFetch.mockResolvedValueOnce(null);
    await act(async () => submit(renderer));
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(0);
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("pas pu confirmer");
  });
});
