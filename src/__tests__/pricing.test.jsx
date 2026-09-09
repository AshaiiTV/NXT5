import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { PROPOSED_PLANS } from "../app/pricing.js";
import { getPassFeatureAccess } from "../app/pass-access.js";
import { PassFeaturePreview } from "../components/subscriptions/PassFeatureGate.jsx";
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

function render(user) {
  const focusInput = vi.fn();
  const focusStatus = vi.fn();
  const scrollIntoView = vi.fn();
  let renderer;
  act(() => {
    renderer = TestRenderer.create(<PricingPage navigate={vi.fn()} user={user} />, {
      createNodeMock: (element) => element.props.id === "demande-acces"
        ? { scrollIntoView, querySelector: () => ({ focus: focusInput }) }
        : { focus: focusStatus, querySelector: () => null },
    });
  });
  cleanups.push(() => act(() => renderer.unmount()));
  return { renderer, focusInput, focusStatus, scrollIntoView };
}

function edit(renderer, label, value) {
  act(() => renderer.root.findByProps({ label }).props.onChange(value));
}

function namedInput(renderer, name) {
  return renderer.root.findAllByType("input").find((input) => input.props.name === name);
}

function editTeam(renderer, value) {
  act(() => namedInput(renderer, "teamName").props.onChange({ target: { value } }));
}

function selectPlan(renderer, name) {
  act(() => renderer.root.findAllByType("button").find((button) => button.props["aria-label"] === `Demander un accès — ${name}`).props.onClick());
}

function content(node) {
  return typeof node === "string" ? node : (node.children || []).map(content).join(" ");
}

function fill(renderer, { consent = true } = {}) {
  edit(renderer, "Ton nom ou pseudo *", "  Camille  ");
  edit(renderer, "E-mail de contact *", "  CAMILLE@example.fr  ");
  editTeam(renderer, "  Les Cinq  ");
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
  it("presents a full 14-day trial and the launch monthly price without checkout or card fields", () => {
    const { renderer } = render();
    expect(PROPOSED_PLANS.map((plan) => [plan.code, plan.price, plan.period])).toEqual([
      ["free", "0 €", "pendant 14 jours"],
      ["team_monthly", "9,90 €", "TTC / mois / équipe"],
    ]);
    const cards = renderer.root.findAllByType("article");
    expect(cards).toHaveLength(2);
    const trial = content(renderer.root.findByProps({ "aria-labelledby": "plan-free" }));
    expect(trial).toContain("Découverte");
    expect(trial).toMatch(/accès complet/i);
    expect(trial).toMatch(/sans carte bancaire/i);
    expect(trial).toContain("jusqu’à 15 membres");
    const monthly = content(renderer.root.findByProps({ "aria-labelledby": "plan-team_monthly" }));
    expect(monthly).toContain("Pass Équipe");
    expect(monthly).toContain("résiliable à tout moment");
    expect(renderer.root.findAllByProps({ href: "#demande-acces" })).toHaveLength(0);
    expect(renderer.root.findByProps({ label: "L’offre qui t’intéresse *" }).findAllByType("option").map((option) => [option.props.value, content(option)])).toEqual([
      ["free", "Découverte — 0 € pendant 14 jours"],
      ["team_monthly", "Pass Équipe — 9,90 € TTC / mois / équipe"],
    ]);
    const page = JSON.stringify(renderer.toJSON());
    expect(page).toContain("Aperçu réservé à l’administrateur");
    expect(page).toContain("Aucun paiement aujourd’hui.");
    expect(page).toContain("Tes accès actuels restent inchangés.");
    expect(page).toContain("le Pass Équipe sera nécessaire pour continuer à utiliser les outils NXT5");
    expect(page).not.toContain("30 jours");
    expect(page).not.toMatch(/Pass Saison|Pass Structure|Plusieurs équipes|plusieurs équipes|Parlons de ta structure|Nom de la structure|29 €|169 €|79 €|5 imports de games au total/);
    expect(renderer.root.findAllByType("option").some((option) => ["team_season", "structure"].includes(option.props.value))).toBe(false);
    expect(renderer.root.findAllByType("a").some((link) => /checkout|stripe|achat/.test(link.props.href))).toBe(false);
    expect(renderer.root.findAllByType("input").some((input) => /^cc-/.test(input.props.autoComplete))).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each([undefined, { is_platform_admin: false }, { is_platform_admin: "true" }])("does not expose the expired-trial simulation without an administrator identity (%j)", (user) => {
    const { renderer } = render(user);
    expect(renderer.root.findAllByProps({ "data-pass-preview": true })).toHaveLength(0);
    expect(renderer.root.findAllByType(PassFeaturePreview)).toHaveLength(0);
  });

  it("lets an administrator preview tools and prepare a Pass request without changing access or starting billing", () => {
    const { renderer, scrollIntoView, focusInput } = render({ is_platform_admin: true });
    const preview = renderer.root.findByProps({ "data-pass-preview": true });
    expect(preview.type).toBe("details");
    expect(preview.props.open).not.toBe(true);
    expect(content(preview)).toContain("Tous les outils restent accessibles actuellement");
    expect(content(preview.findByType(PassFeaturePreview))).toContain("Tous les outils");

    edit(renderer, "Outil à prévisualiser", "champion_pool");
    expect(content(renderer.root.findByType(PassFeaturePreview))).toContain("faire évoluer les champion pools de ton équipe");
    expect(getPassFeatureAccess("champion_pool")).toMatchObject({ allowed: true, requiresPass: false });
    selectPlan(renderer, "Découverte");
    edit(renderer, "Ton intérêt pour cette offre *", "yes");
    act(() => renderer.root.findByType(PassFeaturePreview).findByType("button").props.onClick());
    expect(renderer.root.findByProps({ label: "L’offre qui t’intéresse *" }).props.value).toBe("team_monthly");
    expect(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).props.value).toBe("");
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "start" });
    expect(focusInput).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    expect(getPassFeatureAccess("workspace")).toMatchObject({ allowed: true, requiresPass: false });
  });

  it.each([["Découverte", "free"], ["Pass Équipe", "team_monthly"]])("selects %s, brings the form into view and focuses its first field", (name, code) => {
    const { renderer, scrollIntoView, focusInput } = render();
    selectPlan(renderer, name);
    expect(renderer.root.findByProps({ label: "L’offre qui t’intéresse *" }).props.value).toBe(code);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(focusInput).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("keeps interest explicit when changing between the trial and the monthly Pass", () => {
    const { renderer } = render();
    selectPlan(renderer, "Découverte");
    edit(renderer, "Ton intérêt pour cette offre *", "yes");
    selectPlan(renderer, "Pass Équipe");
    expect(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).props.value).toBe("");
    expect(content(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).findAllByType("option").find((option) => option.props.value === "yes"))).toBe("Oui, au tarif indiqué");
    edit(renderer, "Ton intérêt pour cette offre *", "maybe");
    selectPlan(renderer, "Découverte");
    expect(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).props.value).toBe("");
    expect(content(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).findAllByType("option").find((option) => option.props.value === "yes"))).toBe("Oui, je souhaite essayer");
    edit(renderer, "Ton intérêt pour cette offre *", "maybe");
    selectPlan(renderer, "Découverte");
    expect(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).props.value).toBe("maybe");
    edit(renderer, "L’offre qui t’intéresse *", "team_monthly");
    expect(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).props.value).toBe("");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("submits the Pass selected by its CTA and preserves the full request after failure", async () => {
    const { renderer } = render();
    selectPlan(renderer, "Pass Équipe");
    fill(renderer);
    editTeam(renderer, "  Association Aurora  ");
    edit(renderer, "Un besoin, une question ? (facultatif)", "  Un roster et son staff.  ");
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Connection unavailable"), { status: 503 }));
    await act(async () => submit(renderer));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [endpoint, options] = apiFetch.mock.calls[0];
    expect(endpoint).toBe("access-requests");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      contactName: "Camille", email: "camille@example.fr", teamName: "Association Aurora", role: "manager",
      planCode: "team_monthly", payer: "association", purchaseIntent: "yes", message: "Un roster et son staff.", consent: true, website: "",
    });
    expect(renderer.root.findByProps({ label: "L’offre qui t’intéresse *" }).props.value).toBe("team_monthly");
    expect(namedInput(renderer, "teamName").props.value).toBe("  Association Aurora  ");
    expect(renderer.root.findByProps({ label: "Ton intérêt pour cette offre *" }).props.value).toBe("yes");
    expect(renderer.root.findByProps({ type: "checkbox" }).props.checked).toBe(true);
    expect(renderer.root.findByType("form").findByType("fieldset").props.disabled).toBe(false);
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("Tes réponses sont conservées");
    apiFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => submit(renderer));
    expect(apiFetch.mock.calls[1]).toEqual(apiFetch.mock.calls[0]);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Aucun compte ni abonnement n’a été activé");
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
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
    edit(renderer, "L’offre qui t’intéresse *", "free");
    fill(renderer);
    let complete;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    let pending;
    act(() => {
      pending = submit(renderer);
      submit(renderer);
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType("form").findByType("fieldset").props.disabled).toBe(true);
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(0);
    const [endpoint, options] = apiFetch.mock.calls[0];
    expect(endpoint).toBe("access-requests");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      contactName: "Camille", email: "camille@example.fr", teamName: "Les Cinq", role: "manager",
      planCode: "free", payer: "association", purchaseIntent: "yes", message: "Un split de six mois.", consent: true, website: "",
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
    expect(namedInput(renderer, "teamName").props.value).toBe("  Les Cinq  ");
    expect(renderer.root.findByProps({ type: "checkbox" }).props.checked).toBe(true);
    expect(renderer.root.findByType("form").findByType("fieldset").props.disabled).toBe(false);
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
