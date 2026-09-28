import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reports } from "../pages/workspace/GameWorkspace.jsx";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { Button, TextInput } from "../components/ui/Core.jsx";
import { apiFetch } from "../api/client.js";
import { reviewDrafts } from "../utils/review-drafts.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/api" }));
let renderer;
let listeners;
const props = (user = "coach", team = "team") => ({ data: { ...DEFAULT_DATA }, user: { id: user }, selectedTeamId: team, currentMember: { role: "coach" }, refreshAll: vi.fn(), pushToast: vi.fn() });
const existingReport = { id: "saved-review", team_id: "team", title: "Bilan de séance", content: "Décision déjà enregistrée", match_ids: [], created_by: "coach" };
const existingProps = () => ({ ...props(), data: { ...DEFAULT_DATA, reports: [existingReport] } });
function mount(settings = props()) {
  act(() => { renderer = TestRenderer.create(<Reports {...settings} />, { createNodeMock: (node) => node.type === "dialog" ? { open: false, showModal() { this.open = true; }, close() { this.open = false; } } : null }); });
}
const button = (label) => renderer.root.findAllByType(Button).find((node) => node.props.children === label);
function click(label) { act(() => button(label).props.onClick()); }
function write(content) {
  act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: content } }));
}
beforeEach(() => {
  reviewDrafts.clear();
  listeners = new Map();
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/rapports"), history: { state: {}, pushState: vi.fn() }, confirm: vi.fn(() => true), addEventListener: vi.fn((name, fn) => listeners.set(name, fn)), removeEventListener: vi.fn((name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); }) });
  vi.stubGlobal("document", { body: { style: { overflow: "" } }, activeElement: { focus: vi.fn(), isConnected: true } });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  reviewDrafts.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("review draft recovery", () => {
  it("does not keep an unchanged saved review or warn when closing it, and opens a new empty form", () => {
    mount(existingProps());
    click("Éditer");
    expect(renderer.root.findByType("textarea").props.value).toBe(existingReport.content);
    expect(reviewDrafts.hasDrafts()).toBe(false);
    expect(listeners.has("beforeunload")).toBe(false);
    expect(button("Supprimer le brouillon")).toBeUndefined();
    click("Fermer");
    expect(button("Reprendre le brouillon")).toBeUndefined();
    expect(reviewDrafts.hasDrafts()).toBe(false);
    click("Préparer un débrief");
    expect(renderer.root.findByType("textarea").props.value).toBe("");
    expect(renderer.root.findAllByType(TextInput).find((node) => node.props.label.startsWith("Titre")).props.value).toBe("");
    expect(window.confirm).not.toHaveBeenCalled();
    expect(listeners.has("beforeunload")).toBe(false);
  });

  it("removes the warning when the edited title and notes return to their saved values", () => {
    mount(existingProps()); click("Éditer");
    const title = () => renderer.root.findAllByType(TextInput).find((node) => node.props.label.startsWith("Titre"));
    const originalTitle = title().props.value;
    act(() => title().props.onChange("Nouveau titre"));
    write("Notes modifiées");
    expect(reviewDrafts.hasDrafts()).toBe(true);
    expect(listeners.has("beforeunload")).toBe(true);
    write(existingReport.content);
    expect(reviewDrafts.hasDrafts()).toBe(true);
    act(() => title().props.onChange(originalTitle));
    expect(reviewDrafts.hasDrafts()).toBe(false);
    expect(listeners.has("beforeunload")).toBe(false);
    click("Fermer");
    expect(button("Reprendre le brouillon")).toBeUndefined();
  });

  it("recovers real edits and their original reference after navigation", () => {
    mount(existingProps()); click("Éditer"); write("Nouvelle décision à conserver");
    click("Fermer et garder le brouillon");
    act(() => renderer.unmount()); renderer = null;
    mount(existingProps()); click("Reprendre le brouillon");
    expect(renderer.root.findByType("textarea").props.value).toBe("Nouvelle décision à conserver");
    expect(listeners.has("beforeunload")).toBe(true);
    write(existingReport.content);
    expect(reviewDrafts.hasDrafts()).toBe(false);
    expect(listeners.has("beforeunload")).toBe(false);
    click("Fermer");
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("keeps notes after Escape, closing and navigating away, with a warning before reload", () => {
    mount();
    click("Préparer un débrief");
    write("Décision à garder : préparer le dragon à 90 secondes.");
    act(() => renderer.root.findByType("dialog").props.onCancel({ preventDefault: vi.fn(), stopPropagation: vi.fn() }));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    click("Reprendre le brouillon");
    expect(renderer.root.findByType("textarea").props.value).toContain("90 secondes");
    click("Fermer et garder le brouillon");
    act(() => renderer.unmount()); renderer = null;
    const event = { preventDefault: vi.fn() };
    listeners.get("beforeunload")(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
    mount();
    click("Reprendre le brouillon");
    expect(renderer.root.findByType("textarea").props.value).toContain("90 secondes");
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("isolates drafts by account and team and deletes only after explicit confirmation", () => {
    mount(); click("Préparer un débrief"); write("Notes de l’équipe A");
    act(() => renderer.update(<Reports {...props("coach", "other")} />));
    expect(button("Préparer un débrief")).toBeTruthy();
    act(() => renderer.update(<Reports {...props("other-coach", "team")} />));
    expect(button("Préparer un débrief")).toBeTruthy();
    act(() => renderer.update(<Reports {...props()} />));
    click("Reprendre le brouillon");
    expect(renderer.root.findByType("textarea").props.value).toBe("Notes de l’équipe A");
    window.confirm.mockReturnValueOnce(false);
    click("Supprimer le brouillon");
    expect(renderer.root.findByType("textarea").props.value).toBe("Notes de l’équipe A");
    click("Supprimer le brouillon");
    expect(reviewDrafts.hasDrafts()).toBe(false);
    expect(listeners.has("beforeunload")).toBe(false);
  });

  it("blocks close during save, retains failed drafts and clears a successful save", async () => {
    mount(); click("Préparer un débrief"); write("Une décision sauvegardée");
    act(() => renderer.root.findAllByType(TextInput).find((node) => node.props.label.startsWith("Titre")).props.onChange("Débrief test"));
    let resolve, reject;
    apiFetch.mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    let saving;
    act(() => { saving = renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
    expect(button("Fermer et garder le brouillon").props.disabled).toBe(true);
    act(() => renderer.root.findByType("dialog").props.onCancel({ preventDefault: vi.fn(), stopPropagation: vi.fn() }));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    await act(async () => { reject(new Error("Hors ligne")); await saving; });
    expect(renderer.root.findByType("textarea").props.value).toBe("Une décision sauvegardée");
    act(() => { saving = renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }); });
    await act(async () => { resolve({}); await saving; });
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(reviewDrafts.hasDrafts()).toBe(false);
    expect(listeners.has("beforeunload")).toBe(false);
  });
});
