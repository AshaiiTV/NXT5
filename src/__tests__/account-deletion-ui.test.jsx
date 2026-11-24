import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_DELETION_CONFIRMATION_KEY, ACCOUNT_DELETION_PENDING_KEY, AccountDeletion, AccountDeletionReceipt } from "../pages/workspace/AccountDeletion.jsx";
import { Button, SelectInput, TextInput } from "../components/ui/Core.jsx";
import { apiFetch } from "../api/client.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
let renderer;
let stored;
const token = "a".repeat(43);
const passwordAccount = { teams: [], hasPassword: true, discordLinked: false, reauthentication: { providers: [], verifiedWith: null } };
const socialAccount = { teams: [], hasPassword: false, discordLinked: true, reauthentication: { providers: ["google"], verifiedWith: null } };
const receipt = { reference: "deletion-receipt", completedAt: "2026-09-30T12:00:00Z", summary: {} };

function stubBrowser(search = "") {
  const location = new URL(`https://nxt5.test/parametres${search}`);
  const browser = {
    location,
    sessionStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) },
    history: { state: null, replaceState: vi.fn((_state, _title, path) => { browser.location = new URL(path, browser.location); }) },
  };
  browser.location.assign = vi.fn();
  vi.stubGlobal("window", browser);
  return browser;
}
beforeEach(() => { stored = new Map(); stubBrowser(); });
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.clearAllMocks(); vi.unstubAllGlobals(); });

const buttons = () => renderer.root.findAllByType(Button);
const button = (text) => buttons().find((item) => item.props.children === text);
const checkboxes = () => renderer.root.findAll((node) => node.type === "input" && node.props.type === "checkbox");
const actions = () => apiFetch.mock.calls.map((call) => JSON.parse(call[1].body).action || JSON.parse(call[1].body).flow);
const alertText = () => renderer.root.findByProps({ role: "alert" }).children.join("");
async function render(props = {}) { await act(async () => { renderer = TestRenderer.create(<AccountDeletion {...props} />); }); }
async function firstConfirmation(details = passwordAccount) {
  apiFetch.mockResolvedValueOnce(details);
  await act(async () => button("Supprimer mon compte").props.onClick());
  act(() => checkboxes().at(-1).props.onChange({ target: { checked: true } }));
  apiFetch.mockResolvedValueOnce({ confirmationToken: token, expiresInSeconds: 900 });
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
}
function credentials() {
  act(() => {
    renderer.root.findAllByType(TextInput)[0].props.onChange("SUPPRIMER");
    renderer.root.findAllByType(TextInput)[1].props.onChange("current-password");
  });
}
const submit = () => act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));

describe("account deletion confirmations", () => {
  it("does not delete on opening, first confirmation or cancellation", async () => {
    await render();
    expect(apiFetch).not.toHaveBeenCalled();
    await firstConfirmation();
    expect(button("Supprimer définitivement mon compte").props.disabled).toBe(true);
    act(() => button("Annuler").props.onClick());
    expect(button("Supprimer mon compte")).toBeTruthy();
    expect(actions()).toEqual(["inspect", "prepare"]);
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(stored.size).toBe(0);
  });

  it("requires a successor and a separate consent for teams without other members", async () => {
    await render();
    apiFetch.mockResolvedValueOnce({ ...passwordAccount, teams: [
      { id: "shared", name: "Shared team", members: [{ id: "successor", name: "Camille" }] },
      { id: "empty", name: "Personal team", members: [] },
    ] });
    await act(async () => button("Supprimer mon compte").props.onClick());
    expect(renderer.root.findByType(SelectInput).props.label).toBe("Nouveau propriétaire de Shared team");
    expect(button("Confirmer et continuer").props.disabled).toBe(true);
    act(() => renderer.root.findByType("select").props.onChange({ target: { value: "successor" } }));
    act(() => checkboxes()[1].props.onChange({ target: { checked: true } }));
    expect(button("Confirmer et continuer").props.disabled).toBe(true);
    act(() => checkboxes()[0].props.onChange({ target: { checked: true } }));
    expect(button("Confirmer et continuer").props.disabled).toBe(false);
    apiFetch.mockResolvedValueOnce({ confirmationToken: token, expiresInSeconds: 900 });
    await submit();
    expect(JSON.parse(apiFetch.mock.lastCall[1].body)).toEqual({
      action: "prepare", acknowledged: true, deleteEmptyTeams: true, teamPlan: { shared: "successor", empty: "delete" },
    });
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(2);
  });

  it("submits once with both confirmations and clears secrets after success", async () => {
    const onDeleted = vi.fn();
    await render({ onDeleted }); await firstConfirmation(); credentials();
    apiFetch.mockResolvedValueOnce({ ok: true, receipt });
    const form = renderer.root.findByType("form").props.onSubmit;
    await act(async () => { await Promise.all([form({ preventDefault() {} }), form({ preventDefault() {} })]); });
    const deletions = apiFetch.mock.calls.filter((call) => JSON.parse(call[1].body).action === "delete");
    expect(deletions).toHaveLength(1);
    expect(JSON.parse(deletions[0][1].body)).toMatchObject({ confirmation: "SUPPRIMER", currentPassword: "current-password", confirmationToken: token });
    expect(onDeleted).toHaveBeenCalledWith(receipt);
    expect(stored.size).toBe(0);
  });

  it("shows a password error without reporting success", async () => {
    const onDeleted = vi.fn();
    await render({ onDeleted }); await firstConfirmation(); credentials();
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Mot de passe actuel incorrect. Ton compte est inchangé."), { status: 401, code: "DELETION_PASSWORD_INVALID" }));
    await submit();
    expect(alertText()).toContain("Mot de passe actuel incorrect");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(TextInput)[1].props.value).toBe("");
    expect(stored.has(ACCOUNT_DELETION_PENDING_KEY)).toBe(false);
  });

  it("retrieves the receipt after a lost deletion response", async () => {
    const onDeleted = vi.fn();
    await render({ onDeleted }); await firstConfirmation(); credentials();
    apiFetch.mockRejectedValueOnce(new Error("Réseau interrompu"));
    apiFetch.mockResolvedValueOnce({ ok: true, receipt });
    await submit();
    expect(actions().slice(-2)).toEqual(["delete", "status"]);
    expect(onDeleted).toHaveBeenCalledWith(receipt);
  });

  it("keeps an uncertain result explicit until its status is checked", async () => {
    await render(); await firstConfirmation(); credentials();
    apiFetch.mockRejectedValueOnce(new Error("Réseau interrompu"));
    apiFetch.mockResolvedValueOnce({ ok: false, pending: true });
    await submit();
    expect(alertText()).toContain("peut avoir abouti");
    expect(button("Annuler")).toBeUndefined();
    expect(stored.get(ACCOUNT_DELETION_PENDING_KEY)).toBe(token);
    apiFetch.mockResolvedValueOnce({ ok: false, pending: true });
    await act(async () => button("Vérifier le résultat de la suppression").props.onClick());
    expect(alertText()).toContain("ton compte est toujours actif");
    expect(button("Annuler")).toBeTruthy();
    expect(stored.has(ACCOUNT_DELETION_PENDING_KEY)).toBe(false);
  });
});

describe("account without a password", () => {
  it("asks for a reauthentication with a linked provider instead of a password", async () => {
    await render(); await firstConfirmation(socialAccount);
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(button("Supprimer définitivement mon compte")).toBeUndefined();
    expect(JSON.parse(stored.get(ACCOUNT_DELETION_CONFIRMATION_KEY)).token).toBe(token);
    apiFetch.mockResolvedValueOnce({ authorizationUrl: "https://accounts.google.com/o/oauth2/auth?state=x" });
    await act(async () => button("Confirmer avec Google").props.onClick());
    expect(apiFetch.mock.lastCall[0]).toBe("auth-social-start");
    expect(JSON.parse(apiFetch.mock.lastCall[1].body)).toEqual({ provider: "google", flow: "reauth" });
    expect(window.location.assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth?state=x");
  });

  it("resumes the final step after the provider confirmed the identity", async () => {
    const browser = stubBrowser("?reauth=verified&provider=google");
    stored.set(ACCOUNT_DELETION_CONFIRMATION_KEY, JSON.stringify({ token, expiresAt: Date.now() + 60_000 }));
    apiFetch.mockResolvedValueOnce({ ...socialAccount, reauthentication: { providers: ["google"], verifiedWith: "google" } });
    const onDeleted = vi.fn();
    await render({ onDeleted });
    expect(browser.history.replaceState).toHaveBeenCalledWith(null, "", "/parametres");
    expect(renderer.root.findByProps({ role: "status" }).children.join("")).toContain("Identité confirmée avec Google");
    const inputs = renderer.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(1);
    act(() => inputs[0].props.onChange("SUPPRIMER"));
    apiFetch.mockResolvedValueOnce({ ok: true, receipt });
    await submit();
    expect(JSON.parse(apiFetch.mock.lastCall[1].body)).toEqual({ action: "delete", confirmationToken: token, confirmation: "SUPPRIMER", acknowledged: true });
    expect(onDeleted).toHaveBeenCalledWith(receipt);
  });

  it("explains a provider account that is not the linked one", async () => {
    stubBrowser("?reauth=mismatch&provider=google");
    stored.set(ACCOUNT_DELETION_CONFIRMATION_KEY, JSON.stringify({ token, expiresAt: Date.now() + 60_000 }));
    apiFetch.mockResolvedValueOnce(socialAccount);
    await render();
    expect(alertText()).toContain("Ce compte Google n’est pas celui associé à NXT5");
    expect(button("Confirmer avec Google")).toBeTruthy();
    expect(button("Supprimer définitivement mon compte")).toBeUndefined();
  });

  it("asks to start again when the first confirmation expired during the redirect", async () => {
    stubBrowser("?reauth=verified&provider=google");
    stored.set(ACCOUNT_DELETION_CONFIRMATION_KEY, JSON.stringify({ token, expiresAt: Date.now() - 1 }));
    await render();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(alertText()).toContain("La première confirmation a expiré");
    expect(button("Supprimer mon compte")).toBeTruthy();
  });
});

describe("deletion receipt", () => {
  it("displays the reference and the shared-history limitation", async () => {
    await act(async () => { renderer = TestRenderer.create(<AccountDeletionReceipt receipt={receipt} onContinue={vi.fn()} />); });
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain(receipt.reference);
    expect(text).toContain("mentions de ton pseudo");
    expect(button("Retour à la connexion")).toBeTruthy();
  });
});
