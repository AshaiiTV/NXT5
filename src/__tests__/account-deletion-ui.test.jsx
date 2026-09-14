import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeletion, AccountDeletionReceipt } from "../pages/workspace/AccountDeletion.jsx";
import { Button, TextInput } from "../components/ui/Core.jsx";
import { apiFetch } from "../api/client.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
let renderer;
let stored;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal("window", { sessionStorage: { getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) } });
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.clearAllMocks(); vi.unstubAllGlobals(); });
function button(text) { return renderer.root.findAllByType(Button).find((item) => item.props.children === text); }
async function render(props = {}) { await act(async () => { renderer = TestRenderer.create(<AccountDeletion {...props} />); }); }
async function firstConfirmation() {
  apiFetch.mockResolvedValueOnce({ teams: [] });
  await act(async () => button("Supprimer mon compte").props.onClick());
  act(() => renderer.root.findByType("input").props.onChange({ target: { checked: true } }));
  apiFetch.mockResolvedValueOnce({ confirmationToken: "a".repeat(43) });
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
}
function credentials() {
  act(() => {
    renderer.root.findAllByType(TextInput)[0].props.onChange("SUPPRIMER");
    renderer.root.findAllByType(TextInput)[1].props.onChange("current-password");
  });
}
const receipt = { reference: "deletion-receipt", completedAt: "2026-09-14T12:00:00Z", summary: {} };

describe("account deletion confirmations", () => {
  it("does not delete on opening, first confirmation or cancellation", async () => {
    await render();
    expect(apiFetch).not.toHaveBeenCalled();
    await firstConfirmation();
    expect(button("Supprimer définitivement mon compte").props.disabled).toBe(true);
    act(() => button("Annuler").props.onClick());
    expect(button("Supprimer mon compte")).toBeTruthy();
    expect(apiFetch.mock.calls.map((call) => JSON.parse(call[1].body).action)).toEqual(["inspect", "prepare"]);
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it("requires a successor and separate empty-team consent before preparing deletion", async () => {
    await render();
    apiFetch.mockResolvedValueOnce({ teams: [
      { id: "shared", name: "Shared team", members: [{ id: "successor", name: "Camille" }] },
      { id: "empty", name: "Personal team", members: [] },
    ] });
    await act(async () => button("Supprimer mon compte").props.onClick());
    expect(button("Confirmer et continuer").props.disabled).toBe(true);
    act(() => renderer.root.findByType("select").props.onChange({ target: { value: "successor" } }));
    const checkboxes = renderer.root.findAllByType("input");
    act(() => checkboxes[1].props.onChange({ target: { checked: true } }));
    expect(button("Confirmer et continuer").props.disabled).toBe(true);
    act(() => checkboxes[0].props.onChange({ target: { checked: true } }));
    expect(button("Confirmer et continuer").props.disabled).toBe(false);
    apiFetch.mockResolvedValueOnce({ confirmationToken: "a".repeat(43) });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(JSON.parse(apiFetch.mock.lastCall[1].body)).toMatchObject({
      action: "prepare", acknowledged: true, deleteEmptyTeams: true,
      teamPlan: { shared: "successor", empty: "delete" },
    });
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(2);
  });

  it("submits once with both confirmations and clears secrets after success", async () => {
    const onDeleted = vi.fn();
    await render({ onDeleted }); await firstConfirmation(); credentials();
    apiFetch.mockResolvedValueOnce({ ok: true, receipt });
    const submit = renderer.root.findByType("form").props.onSubmit;
    await act(async () => { await Promise.all([submit({ preventDefault() {} }), submit({ preventDefault() {} })]); });
    expect(apiFetch.mock.calls.filter((call) => JSON.parse(call[1].body).action === "delete")).toHaveLength(1);
    expect(onDeleted).toHaveBeenCalledWith(receipt);
    expect(renderer.root.findAllByType(TextInput)[1].props.value).toBe("");
    expect(stored.size).toBe(0);
  });

  it("shows a password error without reporting success", async () => {
    const onDeleted = vi.fn();
    await render({ onDeleted }); await firstConfirmation(); credentials();
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Mot de passe incorrect"), { status: 401, code: "DELETION_PASSWORD_INVALID" }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("Mot de passe incorrect");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(TextInput)[1].props.value).toBe("");
  });

  it("retrieves the receipt after a lost deletion response", async () => {
    const onDeleted = vi.fn();
    await render({ onDeleted }); await firstConfirmation(); credentials();
    apiFetch.mockRejectedValueOnce(new Error("Network interrupted"));
    apiFetch.mockResolvedValueOnce({ ok: true, receipt });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(JSON.parse(apiFetch.mock.lastCall[1].body).action).toBe("status");
    expect(onDeleted).toHaveBeenCalledWith(receipt);
  });

  it("keeps an uncertain result explicit and offers a status check", async () => {
    await render(); await firstConfirmation(); credentials();
    apiFetch.mockRejectedValueOnce(new Error("Network interrupted"));
    apiFetch.mockResolvedValueOnce({ ok: false, pending: true });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(button("Vérifier le résultat de la suppression")).toBeTruthy();
    expect(button("Annuler")).toBeUndefined();
    expect(stored.size).toBe(1);
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("peut avoir abouti");
  });

  it("displays a persistent success receipt and the shared-history limitation", async () => {
    await act(async () => { renderer = TestRenderer.create(<AccountDeletionReceipt receipt={receipt} onContinue={vi.fn()} />); });
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain(receipt.reference);
    expect(text).toContain("mentions de ton pseudo");
    expect(button("Retour à la connexion")).toBeTruthy();
  });
});
