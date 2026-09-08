import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { subscriptionDateToISO } from "../app/subscriptions.js";
import { Button, SelectInput, TextAreaInput, TextInput } from "../components/ui/Core.jsx";
import AccountSubscriptionsPage from "../pages/admin/AccountSubscriptionsPage.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const renderers = [];
afterEach(() => { renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())); vi.resetAllMocks(); });

const emptySubscription = { planCode: "free", effectivePlanCode: "free", status: "none", startsAt: null, endsAt: null, revokedAt: null, note: "", updatedAt: null, revision: 0 };
const activeSubscription = { planCode: "team_monthly", effectivePlanCode: "team_monthly", status: "active", startsAt: subscriptionDateToISO("2026-09-01"), endsAt: subscriptionDateToISO("2026-09-30", true), revokedAt: null, note: "Accord initial", updatedAt: "2026-09-01T10:00:00Z", revision: 4 };
const account = { id: "user-1", name: "Camille Dupont", accountName: "Camille-Staff", email: "camille.long-contact@example.test", subscription: activeSubscription };
const otherAccount = { id: "user-2", name: "Luna Martin", accountName: "Luna", email: "luna@example.test", subscription: emptySubscription };
const detail = (overrides = {}) => ({ account, history: [{ id: "history-1", action: "assign", actorName: "Administrateur", planCode: "team_monthly", startsAt: activeSubscription.startsAt, endsAt: activeSubscription.endsAt, note: "Accord initial", createdAt: "2026-09-01T10:00:00Z" }], ...overrides });
const list = (overrides = {}) => ({ accounts: [account, otherAccount], pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 }, ...overrides });
async function render(props = {}) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<AccountSubscriptionsPage navigate={vi.fn()} {...props} />); });
  renderers.push(renderer);
  return renderer;
}
const button = (renderer, label) => renderer.root.findAllByType(Button).find((item) => item.props.children === label || item.props["aria-label"] === label);
const text = (renderer) => JSON.stringify(renderer.toJSON());
const content = (node) => typeof node === "string" ? node : (node.children || []).map(content).join("");
const input = (renderer, label) => renderer.root.findAllByType(TextInput).find((item) => item.props.label === label);
async function click(renderer, label) {
  const target = button(renderer, label);
  expect(target, `Button ${label}`).toBeTruthy();
  expect(target.props.disabled).not.toBe(true);
  await act(async () => target.props.onClick());
}
async function edit(renderer, label, value) {
  const field = [...renderer.root.findAllByType(TextInput), ...renderer.root.findAllByType(SelectInput), ...renderer.root.findAllByType(TextAreaInput)].find((item) => item.props.label === label);
  expect(field, `Field ${label}`).toBeTruthy();
  await act(async () => field.props.onChange(value));
}
async function submit(renderer) { await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() })); }
const requestBody = () => JSON.parse(apiFetch.mock.calls.filter((call) => call[1]?.method === "POST").at(-1)[1].body);
async function openAccount(subscription = activeSubscription) {
  apiFetch.mockResolvedValueOnce(detail({ account: { ...account, subscription } }));
  return render({ initialUserId: account.id });
}
function saved(subscription, overrides = {}) { return { ok: true, ...detail({ account: { ...account, subscription }, ...overrides }) }; }

describe("manual subscriptions account search", () => {
  it("loads all accounts, paginates, searches by name/email and restores empty searches", async () => {
    apiFetch.mockResolvedValueOnce(list({ pagination: { page: 1, pageSize: 10, total: 11, totalPages: 2 } }));
    const renderer = await render();
    expect(apiFetch).toHaveBeenLastCalledWith("admin-account-subscriptions?q=&page=1&pageSize=10");
    expect(text(renderer)).toContain(account.accountName);
    expect(text(renderer)).toContain(account.email);
    apiFetch.mockResolvedValueOnce(list({ accounts: [otherAccount], pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 } }));
    await click(renderer, "Page suivante des profils");
    expect(apiFetch).toHaveBeenLastCalledWith("admin-account-subscriptions?q=&page=2&pageSize=10");
    await edit(renderer, "Rechercher un profil", "  absent@example.test  ");
    apiFetch.mockResolvedValueOnce(list({ accounts: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }));
    await submit(renderer);
    expect(apiFetch).toHaveBeenLastCalledWith("admin-account-subscriptions?q=absent%40example.test&page=1&pageSize=10");
    expect(text(renderer)).toContain("Aucun profil trouvé");
    apiFetch.mockResolvedValueOnce(list());
    await click(renderer, "Voir tous les profils");
    expect(input(renderer, "Rechercher un profil").props.value).toBe("");
    expect(apiFetch).toHaveBeenLastCalledWith("admin-account-subscriptions?q=&page=1&pageSize=10");
  });

  it("ignores a previous search response after a newer query completes", async () => {
    apiFetch.mockResolvedValueOnce(list());
    const renderer = await render();
    let resolveOld;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    await edit(renderer, "Rechercher un profil", "Camille");
    await submit(renderer);
    await edit(renderer, "Rechercher un profil", "Luna");
    apiFetch.mockResolvedValueOnce(list({ accounts: [otherAccount] }));
    await submit(renderer);
    expect(text(renderer)).toContain("Luna Martin");
    await act(async () => resolveOld(list({ accounts: [account] })));
    expect(text(renderer)).toContain("Luna Martin");
    expect(text(renderer)).not.toContain("Camille Dupont");
  });

  it("reads a fresh revision when opening an account from search results", async () => {
    apiFetch.mockResolvedValueOnce(list({ accounts: [{ ...account, subscription: { ...activeSubscription, revision: 2 } }] })).mockResolvedValueOnce(detail());
    const renderer = await render();
    await click(renderer, "Gérer l’abonnement de Camille Dupont");
    expect(apiFetch).toHaveBeenLastCalledWith("admin-account-subscriptions?userId=user-1");
    expect(text(renderer)).toContain("Historique des attributions");
    expect(text(renderer)).toContain(account.email);
    expect(renderer.root.findAllByType(TextAreaInput)[0].props.value).toBe("Accord initial");
    apiFetch.mockResolvedValueOnce(saved({ ...activeSubscription, revision: 5 }));
    await submit(renderer);
    expect(requestBody().expectedRevision).toBe(4);
  });

  it("distinguishes a list failure from no accounts and allows retrying", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Accès administrateur requis."));
    const renderer = await render();
    expect(text(renderer)).toContain("Accès administrateur requis.");
    expect(text(renderer)).not.toContain("Aucun profil");
    apiFetch.mockResolvedValueOnce(list());
    await click(renderer, "Réessayer");
    expect(text(renderer)).toContain("Camille Dupont");
  });

  it("keeps an unknown direct account unselected and offers a return to all profiles", async () => {
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Profil introuvable."), { status: 404 }));
    const renderer = await render({ initialUserId: "missing" });
    expect(apiFetch.mock.calls).toEqual([["admin-account-subscriptions?userId=missing"]]);
    expect(text(renderer)).toContain("Profil introuvable.");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    apiFetch.mockResolvedValueOnce(list());
    await click(renderer, "Changer de profil");
    expect(apiFetch).toHaveBeenLastCalledWith("admin-account-subscriptions?q=&page=1&pageSize=10");
    expect(button(renderer, "Gérer l’abonnement de Camille Dupont")).toBeTruthy();
  });

  it("does not replace a newer account with an older direct-link response", async () => {
    let resolveOld;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const renderer = await render({ initialUserId: account.id });
    apiFetch.mockResolvedValueOnce(detail({ account: otherAccount, history: [] }));
    await act(async () => renderer.update(<AccountSubscriptionsPage navigate={vi.fn()} initialUserId={otherAccount.id} />));
    expect(text(renderer)).toContain("Luna Martin");
    await act(async () => resolveOld(detail()));
    expect(text(renderer)).toContain("Luna Martin");
    expect(text(renderer)).not.toContain("Camille Dupont");
  });
});

describe("manual subscription editor", () => {
  it("assigns a paid plan with inclusive dates, a private note and the expected revision once", async () => {
    const renderer = await openAccount(emptySubscription);
    await edit(renderer, "Formule attribuée", "structure");
    await edit(renderer, "Date de début", "2030-01-31");
    expect(input(renderer, "Date de fin incluse").props.value).toBe("2030-02-27");
    await edit(renderer, "Date de fin incluse", "2030-03-31");
    await edit(renderer, "Note privée", "  Accord de la structure  ");
    let resolveSave;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    await act(async () => { const form = renderer.root.findByType("form"); form.props.onSubmit({ preventDefault: vi.fn() }); form.props.onSubmit({ preventDefault: vi.fn() }); });
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(1);
    expect(requestBody()).toEqual({ userId: account.id, action: "assign", planCode: "structure", startsAt: subscriptionDateToISO("2030-01-31"), endsAt: subscriptionDateToISO("2030-03-31", true), note: "Accord de la structure", expectedRevision: 0 });
    expect(renderer.root.findByType("form").findByType("fieldset").props.disabled).toBe(true);
    expect(button(renderer, "Enregistrement…").props.disabled).toBe(true);
    const updated = { ...activeSubscription, planCode: "structure", effectivePlanCode: "free", status: "scheduled", startsAt: subscriptionDateToISO("2030-01-31"), endsAt: subscriptionDateToISO("2030-03-31", true), revision: 1, note: "Accord de la structure" };
    await act(async () => resolveSave(saved(updated)));
    expect(text(renderer)).toContain("Abonnement enregistré pour Camille Dupont.");
    expect(text(renderer)).toContain("Pass Structure");
    expect(text(renderer)).toContain("À venir");
    expect(renderer.root.findByType("form").findByType("fieldset").props.disabled).toBe(false);
  });

  it("defaults Saison to six calendar months and allows explicit unlimited duration", async () => {
    const renderer = await openAccount(emptySubscription);
    await edit(renderer, "Formule attribuée", "team_season");
    await edit(renderer, "Date de début", "2030-09-08");
    expect(input(renderer, "Date de fin incluse").props.value).toBe("2031-03-07");
    expect(renderer.root.findByProps({ type: "checkbox" }).props.checked).toBe(false);
    await act(async () => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } }));
    expect(input(renderer, "Date de fin incluse").props.disabled).toBe(true);
    apiFetch.mockResolvedValueOnce(saved({ ...activeSubscription, planCode: "team_season", endsAt: null, revision: 1 }));
    await submit(renderer);
    expect(requestBody()).toMatchObject({ planCode: "team_season", startsAt: subscriptionDateToISO("2030-09-08"), endsAt: null });
  });

  it("normalizes free assignments to no paid period", async () => {
    const renderer = await openAccount();
    await edit(renderer, "Formule attribuée", "free");
    expect(input(renderer, "Date de début")).toBeUndefined();
    expect(text(renderer)).toContain("Découverte n’accorde aucun accès payant");
    apiFetch.mockResolvedValueOnce(saved({ ...emptySubscription, status: "active", revision: 5 }));
    await submit(renderer);
    expect(requestBody()).toMatchObject({ planCode: "free", startsAt: null, endsAt: null, expectedRevision: 4 });
  });

  it("blocks an invalid period and restores the persisted form on cancellation", async () => {
    const renderer = await openAccount();
    await edit(renderer, "Date de début", "2030-09-08");
    await edit(renderer, "Date de fin incluse", "2030-09-07");
    await edit(renderer, "Note privée", "Brouillon");
    await submit(renderer);
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
    expect(text(renderer)).toContain("égale ou postérieure");
    await click(renderer, "Annuler les modifications");
    expect(input(renderer, "Date de début").props.value).toBe("2026-09-01");
    expect(input(renderer, "Date de fin incluse").props.value).toBe("2026-09-30");
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("Accord initial");
  });

  it("warns when a future assignment replaces a currently active paid pass", async () => {
    const renderer = await openAccount();
    await edit(renderer, "Formule attribuée", "team_season");
    await edit(renderer, "Date de début", "2099-01-01");
    expect(text(renderer)).toContain("Cette attribution remplace le Pass actuel. Aucun Pass ne sera actif avant le");
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
  });

  it("retains the paid plan, dates and note after a failed save and retries with the same revision", async () => {
    const renderer = await openAccount();
    await edit(renderer, "Formule attribuée", "structure");
    await edit(renderer, "Date de début", "2030-09-08");
    await edit(renderer, "Date de fin incluse", "2030-12-31");
    await edit(renderer, "Note privée", "À conserver");
    apiFetch.mockRejectedValueOnce(new Error("Service indisponible"));
    await submit(renderer);
    expect(text(renderer)).toContain("Service indisponible");
    expect(renderer.root.findByType(SelectInput).props.value).toBe("structure");
    expect(input(renderer, "Date de début").props.value).toBe("2030-09-08");
    expect(input(renderer, "Date de fin incluse").props.value).toBe("2030-12-31");
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("À conserver");
    const original = requestBody();
    apiFetch.mockResolvedValueOnce(saved({ ...activeSubscription, revision: 5 }));
    await submit(renderer);
    expect(requestBody()).toEqual(original);
    expect(text(renderer)).toContain("Abonnement enregistré");
  });

  it("keeps a concurrent edit and prevents another write until an explicit profile reload", async () => {
    const renderer = await openAccount();
    await edit(renderer, "Note privée", "Mon brouillon");
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Revision changed"), { status: 409 }));
    await submit(renderer);
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("Mon brouillon");
    expect(text(renderer)).toContain("modifié ailleurs");
    expect(button(renderer, "Enregistrer l’abonnement").props.disabled).toBe(true);
    expect(button(renderer, "Retirer l’abonnement").props.disabled).toBe(true);
    await submit(renderer);
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(1);
    await click(renderer, "Annuler les modifications");
    expect(text(renderer)).toContain("modifié ailleurs");
    const latest = { ...activeSubscription, revision: 7, note: "Autre administrateur" };
    apiFetch.mockResolvedValueOnce(detail({ account: { ...account, subscription: latest } }));
    await click(renderer, "Abandonner le brouillon et actualiser");
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("Autre administrateur");
    expect(button(renderer, "Enregistrer l’abonnement").props.disabled).toBe(false);
    await edit(renderer, "Note privée", "Validé après lecture");
    apiFetch.mockResolvedValueOnce(saved({ ...latest, revision: 8 }));
    await submit(renderer);
    expect(requestBody()).toMatchObject({ expectedRevision: 7, note: "Validé après lecture" });
  });

  it.each([null, { ok: false }, { ok: true }])("does not report success from an unconfirmed response %j", async (response) => {
    const renderer = await openAccount();
    await edit(renderer, "Note privée", "Brouillon conservé");
    apiFetch.mockResolvedValueOnce(response);
    await submit(renderer);
    expect(text(renderer)).toContain("Le serveur n’a pas confirmé la modification");
    expect(text(renderer)).not.toContain("Abonnement enregistré pour");
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("Brouillon conservé");
  });

  it("requires a concrete local confirmation for revocation and preserves it after failure", async () => {
    const renderer = await openAccount();
    await edit(renderer, "Note privée", "Fin de l’accord");
    await click(renderer, "Retirer l’abonnement");
    const confirmation = renderer.root.findByProps({ "aria-label": "Confirmer le retrait de l’abonnement" });
    expect(content(confirmation)).toContain(account.email);
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
    await click(renderer, "Conserver l’abonnement");
    expect(button(renderer, "Confirmer le retrait")).toBeUndefined();
    await click(renderer, "Retirer l’abonnement");
    apiFetch.mockRejectedValueOnce(new Error("Retrait indisponible"));
    await click(renderer, "Confirmer le retrait");
    expect(requestBody()).toEqual({ userId: account.id, action: "revoke", note: "Fin de l’accord", expectedRevision: 4 });
    expect(text(renderer)).toContain("Retrait indisponible");
    expect(button(renderer, "Confirmer le retrait")).toBeTruthy();
    const revoked = { ...activeSubscription, effectivePlanCode: "free", status: "revoked", revokedAt: "2026-09-08T12:00:00Z", revision: 5 };
    apiFetch.mockResolvedValueOnce(saved(revoked));
    await click(renderer, "Confirmer le retrait");
    expect(text(renderer)).toContain("Abonnement retiré pour Camille Dupont.");
    expect(text(renderer)).toContain("Retiré");
    expect(button(renderer, "Retirer l’abonnement")).toBeUndefined();
  });

  it("does not apply a delayed save to another direct-link profile", async () => {
    const renderer = await openAccount();
    let resolveOldSave;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOldSave = resolve; }));
    await submit(renderer);
    apiFetch.mockResolvedValueOnce(detail({ account: otherAccount, history: [] }));
    await act(async () => renderer.update(<AccountSubscriptionsPage navigate={vi.fn()} initialUserId={otherAccount.id} />));
    await act(async () => resolveOldSave(saved({ ...activeSubscription, revision: 5 })));
    expect(text(renderer)).toContain("Luna Martin");
    expect(text(renderer)).not.toContain("Camille Dupont");
    expect(text(renderer)).not.toContain("Abonnement enregistré pour");
    expect(renderer.root.findByType(SelectInput).props.value).toBe("free");
  });
});
