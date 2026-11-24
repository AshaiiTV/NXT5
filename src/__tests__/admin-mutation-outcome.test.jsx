import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { isUncertainFailure } from "../pages/admin/mutation-outcome.js";
import AccountLifecycle from "../pages/admin/AccountLifecycle.jsx";
import { activitySummary } from "../pages/admin/AdminDirectory.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));

const httpError = (message, status) => Object.assign(new Error(message), { status });
const text = node => (typeof node === "string" ? node : (node.children || []).map(text).join(""));
const button = (root, label) => root.findAll(node => node.type === "button" && text(node).includes(label))[0];
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => { vi.clearAllMocks(); });

describe("administration write outcomes", () => {
  it("treats only definite 4xx refusals as retryable", () => {
    expect(isUncertainFailure(httpError("Refus", 400))).toBe(false);
    expect(isUncertainFailure(httpError("Conflit", 409))).toBe(false);
    expect(isUncertainFailure(httpError("Trop de requêtes", 429))).toBe(false);
    expect(isUncertainFailure(httpError("Délai", 408))).toBe(true);
    expect(isUncertainFailure(httpError("Serveur", 500))).toBe(true);
    expect(isUncertainFailure(httpError("Passerelle", 503))).toBe(true);
    expect(isUncertainFailure(new Error("Réseau ou délai dépassé"))).toBe(true);
    expect(isUncertainFailure(httpError("Réponse inattendue", 200))).toBe(true);
  });

  it("requires a reason to suspend, keeps the editor usable after a 4xx and locks it after an uncertain failure", async () => {
    apiFetch.mockImplementation(async (path, options) => {
      if (!options?.method) return { account: { id: "u1", account_name: "player", suspended_at: null, revision: "7" }, ownedTeams: [] };
      throw httpError("Indique un motif de 5 à 500 caractères.", 400);
    });
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<AccountLifecycle id="u1" revision={0} onGuardChange={() => {}} onDeleted={() => {}} onUpdated={() => {}} blocked={false} navigate={() => {}} />); });
    await flush();
    const root = renderer.root;
    await act(async () => { button(root, "Suspendre le compte").props.onClick(); });
    await act(async () => { root.findByType("input").props.onChange({ target: { value: "player" } }); });
    const confirm = () => button(root, "Confirmer cette action");
    expect(confirm().props.disabled).toBe(true);
    await act(async () => { root.findByType("textarea").props.onChange({ target: { value: "Abus répété" } }); });
    expect(confirm().props.disabled).toBe(false);
    await act(async () => { await confirm().props.onClick(); });
    expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toMatchObject({ action: "suspend", reason: "Abus répété", confirmAccount: "player" });
    expect(root.findByType("textarea").props.value).toBe("Abus répété");
    expect(confirm().props.disabled).toBe(false);
    apiFetch.mockImplementation(async () => { throw new Error("NXT5 met trop longtemps à répondre."); });
    await act(async () => { await confirm().props.onClick(); });
    expect(confirm().props.disabled).toBe(true);
    act(() => renderer.unmount());
  });

  it("summarises audit metadata in short lines", () => {
    expect(activitySummary({ previousName: "Ancien", newName: "Nouveau" })).toEqual(["Ancien → nouveau : Ancien → Nouveau"]);
    expect(activitySummary({ name: "Alpha", counts: { profiles: 5, matches: 12 } })).toEqual(["Équipe « Alpha » · 5 profils · 12 parties"]);
    expect(activitySummary({ previousOwnerId: "00000000-aaaa", newOwnerId: "11111111-bbbb" })).toEqual(["Ancien → nouveau : 00000000 → 11111111"]);
    expect(activitySummary({ accountName: "player", accountEmailMasked: "p***@example.test", reason: "Abus répété", ownedTeams: [{ name: "Alpha" }] }))
      .toEqual(["player · p***@example.test", "Équipes supprimées : Alpha", "Motif : Abus répété"]);
    expect(activitySummary(undefined)).toEqual([]);
  });
});
