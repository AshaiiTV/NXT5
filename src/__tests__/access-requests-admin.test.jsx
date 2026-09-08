import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import AccessRequestsPage from "../pages/admin/AccessRequestsPage.jsx";
import AdminTabNav from "../components/admin/AdminTabNav.jsx";
import { Button, SelectInput, TextAreaInput } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const renderers = [];
afterEach(() => { renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())); vi.resetAllMocks(); });

const request = { id: "r1", contactName: "Camille", email: "camille@example.test", teamName: "Équipe test", role: "coach", planCode: "team_monthly", payer: "association", purchaseIntent: "yes", message: "Nous préparons la saison.", status: "new", adminNote: "", createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-09-08T10:00:00Z" };
const result = (overrides = {}) => ({ requests: [request], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }, stats: { total: 1, contacted: 0, confirmed: 0, declined: 0, presentedTeams: 0, confirmedTeams: 0 }, ...overrides });
async function render() {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<AccessRequestsPage navigate={vi.fn()} />); });
  renderers.push(renderer);
  return renderer;
}
const button = (renderer, label) => renderer.root.findAllByType(Button).find((item) => item.props.children === label || item.props["aria-label"] === label);
const text = (renderer) => JSON.stringify(renderer.toJSON());
const navigation = (renderer) => renderer.root.findByType(AdminTabNav).props;

describe("access request administration", () => {
  it("uses server team metrics and never upgrades a declared purchase intention", async () => {
    apiFetch.mockResolvedValueOnce(result({ stats: { total: 5, contacted: 2, confirmed: 1, declined: 0, presentedTeams: 2, confirmedTeams: 0 } }));
    const renderer = await render();
    expect(apiFetch).toHaveBeenCalledWith("admin-access-requests?page=1&pageSize=10");
    const metrics = renderer.root.findAllByProps({ className: "access-requests-metric" });
    expect(metrics[1].findByType("strong").children[0]).toBe("2");
    expect(metrics[2].findByType("strong").children[0]).toBe("0");
    expect(text(renderer)).toContain("Oui, au prix présenté");
    expect(text(renderer)).toContain("Nouvelle demande");
    expect(text(renderer)).toContain("L’association / structure");
  });

  it.each([
    ["yes", "Oui, selon le devis"],
    ["maybe", "À discuter"],
    ["discover", "Découvrir le service"],
  ])("shows a Structure request with declared intention %s without confirming a sale", async (purchaseIntent, label) => {
    apiFetch.mockResolvedValueOnce(result({ requests: [{ ...request, teamName: "Association Aurora", planCode: "structure", purchaseIntent }] }));
    const renderer = await render();
    const card = renderer.root.findByType("article");
    const values = card.findAllByType("dd").map((node) => node.children.join(""));
    expect(values).toContain("Pass Structure");
    expect(values).toContain(label);
    expect(values).not.toContain("Oui, au prix présenté");
    expect(text(renderer)).toContain("Nouvelle demande");
    expect(text(renderer)).toContain("La collecte publique est fermée");
    expect(text(renderer)).toContain("sans e-mail automatique ni abonnement");
    const metrics = renderer.root.findAllByProps({ className: "access-requests-metric" });
    expect(metrics[2].findByType("strong").children[0]).toBe("0");
    if (purchaseIntent === "yes") {
      act(() => button(renderer, "Suivre cette demande").props.onClick());
      expect(text(renderer)).toContain("le périmètre et le devis doivent avoir été validés");
      expect(renderer.root.findAllByType(SelectInput).find((item) => item.props.label === "Statut du suivi").props.value).toBe("new");
    }
    expect(apiFetch.mock.calls).toEqual([["admin-access-requests?page=1&pageSize=10"]]);
  });

  it("keeps a failed edit available and saves explicit status with private notes", async () => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render();
    act(() => button(renderer, "Suivre cette demande").props.onClick());
    act(() => renderer.root.findAllByType(SelectInput).find((item) => item.props.label === "Statut du suivi").props.onChange("confirmed"));
    act(() => renderer.root.findByType(TextAreaInput).props.onChange("Prix et payeur validés au téléphone."));
    expect(navigation(renderer).dirty).toBe(true);
    apiFetch.mockRejectedValueOnce(new Error("Service indisponible"));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(text(renderer)).toContain("Service indisponible");
    expect(renderer.root.findByType(TextAreaInput).props.value).toBe("Prix et payeur validés au téléphone.");
    expect(navigation(renderer).dirty).toBe(true);
    expect(navigation(renderer).disabled).toBe(false);
    apiFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(result({ requests: [{ ...request, status: "confirmed", adminNote: "Prix et payeur validés au téléphone.", updatedAt: "2026-09-08T11:00:00Z" }] }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(apiFetch).toHaveBeenCalledWith("admin-access-requests", { method: "POST", body: JSON.stringify({ id: "r1", status: "confirmed", adminNote: "Prix et payeur validés au téléphone." }) });
    expect(text(renderer)).toContain("Suivi enregistré.");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(navigation(renderer).dirty).toBe(false);
    expect(navigation(renderer).disabled).toBe(false);
  });

  it("requires the local deletion confirmation and returns from an emptied last page", async () => {
    apiFetch.mockResolvedValueOnce(result({ pagination: { page: 1, pageSize: 10, total: 11, totalPages: 2 } }));
    const renderer = await render();
    apiFetch.mockResolvedValueOnce(result({ pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 } }));
    await act(async () => button(renderer, "Page suivante des demandes").props.onClick());
    expect(apiFetch).toHaveBeenLastCalledWith("admin-access-requests?page=2&pageSize=10");
    act(() => button(renderer, "Supprimer la demande de Équipe test").props.onClick());
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === "DELETE")).toHaveLength(0);
    expect(text(renderer)).toContain("Supprimer définitivement la demande de");
    apiFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(result({ requests: [], pagination: { page: 2, pageSize: 10, total: 10, totalPages: 1 } })).mockResolvedValueOnce(result({ pagination: { page: 1, pageSize: 10, total: 10, totalPages: 1 } }));
    await act(async () => button(renderer, "Confirmer la suppression").props.onClick());
    expect(apiFetch).toHaveBeenCalledWith("admin-access-requests", { method: "DELETE", body: JSON.stringify({ id: "r1" }) });
    expect(apiFetch).toHaveBeenLastCalledWith("admin-access-requests?page=1&pageSize=10");
    expect(text(renderer)).toContain("Demande supprimée.");
  });

  it("distinguishes a loading failure from an empty response and retries", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Accès administrateur requis."));
    const renderer = await render();
    expect(text(renderer)).toContain("Accès administrateur requis.");
    expect(text(renderer)).not.toContain("Aucune demande pour le moment");
    apiFetch.mockResolvedValueOnce(result({ requests: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }));
    await act(async () => button(renderer, "Réessayer").props.onClick());
    expect(text(renderer)).toContain("Aucune demande pour le moment");
  });

  it.each([null, {}, { ok: false }])("does not announce an unconfirmed deletion for payload %j", async (payload) => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render();
    act(() => button(renderer, "Supprimer la demande de Équipe test").props.onClick());
    apiFetch.mockResolvedValueOnce(payload);
    await act(async () => button(renderer, "Confirmer la suppression").props.onClick());
    expect(text(renderer)).toContain("Le serveur n’a pas confirmé la modification.");
    expect(text(renderer)).not.toContain("Demande supprimée.");
    expect(button(renderer, "Confirmer la suppression")).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("requests a fresh first page when the status filter changes", async () => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render();
    apiFetch.mockResolvedValueOnce(result({ requests: [] }));
    await act(async () => renderer.root.findByType(SelectInput).props.onChange("confirmed"));
    expect(apiFetch).toHaveBeenLastCalledWith("admin-access-requests?page=1&pageSize=10&status=confirmed");
    expect(text(renderer)).toContain("Aucune demande avec ce statut");
  });

  it("tracks all changed drafts and clears only the card that is cancelled or restored", async () => {
    apiFetch.mockResolvedValueOnce(result({ requests: [request, { ...request, id: "r2", teamName: "Deuxième équipe" }] }));
    const renderer = await render();
    expect(navigation(renderer).activeId).toBe("access-requests");
    expect(navigation(renderer).dirty).toBe(false);
    act(() => renderer.root.findAllByType(Button).filter((item) => item.props.children === "Suivre cette demande").forEach((item) => item.props.onClick()));
    expect(navigation(renderer).dirty).toBe(false);
    act(() => renderer.root.findAllByType(TextAreaInput).forEach((item, index) => item.props.onChange(`Note ${index + 1}`)));
    expect(navigation(renderer).dirty).toBe(true);
    act(() => button(renderer, "Annuler").props.onClick());
    expect(renderer.root.findAllByType(TextAreaInput)).toHaveLength(1);
    expect(navigation(renderer).dirty).toBe(true);
    act(() => renderer.root.findByType(TextAreaInput).props.onChange(""));
    expect(navigation(renderer).dirty).toBe(false);
    act(() => renderer.root.findAllByType(SelectInput).find((item) => item.props.label === "Statut du suivi").props.onChange("contacted"));
    expect(navigation(renderer).dirty).toBe(true);
    act(() => button(renderer, "Fermer le suivi").props.onClick());
    expect(navigation(renderer).dirty).toBe(false);
  });

  it("leaves navigation available while reading but disables it during a mutation", async () => {
    let resolveRead;
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { resolveRead = resolve; }));
    const renderer = await render();
    expect(navigation(renderer).disabled).toBe(false);
    await act(async () => resolveRead(result()));
    act(() => button(renderer, "Suivre cette demande").props.onClick());
    act(() => renderer.root.findByType(TextAreaInput).props.onChange("À rappeler."));
    let resolveSave;
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; })).mockResolvedValueOnce(result({ requests: [{ ...request, adminNote: "À rappeler.", updatedAt: "2026-09-08T11:00:00Z" }] }));
    let pendingSave;
    act(() => { pendingSave = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(navigation(renderer).disabled).toBe(true);
    expect(navigation(renderer).dirty).toBe(true);
    await act(async () => { resolveSave({ ok: true }); await pendingSave; });
    expect(navigation(renderer).disabled).toBe(false);
    expect(navigation(renderer).dirty).toBe(false);
  });

  it("clears draft tracking when refreshed results unmount the edited card", async () => {
    apiFetch.mockResolvedValueOnce(result());
    const renderer = await render();
    act(() => button(renderer, "Suivre cette demande").props.onClick());
    act(() => renderer.root.findByType(TextAreaInput).props.onChange("Brouillon local."));
    expect(navigation(renderer).dirty).toBe(true);
    apiFetch.mockResolvedValueOnce(result({ requests: [] }));
    await act(async () => button(renderer, "Actualiser").props.onClick());
    expect(renderer.root.findAllByType("article")).toHaveLength(0);
    expect(navigation(renderer).dirty).toBe(false);
  });
});
