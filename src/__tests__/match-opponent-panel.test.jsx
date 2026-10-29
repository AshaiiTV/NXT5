import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import MatchOpponentPanel from "../components/opponents/MatchOpponentPanel.jsx";
import { GameOperationDialog } from "../components/games/GameOperationDialog.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../components/games/GameOperationDialog.jsx", () => ({ GameOperationDialog: ({ title, description, children }) => <div role="dialog" aria-label={title}>{description && <p>{description}</p>}{children}</div> }));
const opponent = { id: "opif", name: "OPIF" };
let renderer;
let props;
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.resetAllMocks(); });
function text(node) { return node.children.map((child) => typeof child === "string" ? child : text(child)).join(""); }
function content() { return text(renderer.root); }
function button(label) { return renderer.root.findAllByType("button").find((item) => text(item) === label); }
function field(label) {
  const wrapper = renderer.root.findAllByType("label").find((item) => item.findAllByType("span").some((span) => text(span) === label));
  return wrapper.find((item) => ["input", "select"].includes(item.type));
}
function calls(action) { return apiFetch.mock.calls.map(([, options]) => JSON.parse(options.body)).filter((call) => call.action === action); }
function change(label, value) { act(() => field(label).props.onChange({ target: { value } })); }
async function click(label) { await act(async () => { await button(label).props.onClick?.(); }); }
async function openEditor() { await click(button("Modifier") ? "Modifier" : "Ajouter"); }
async function submit(label) {
  let form = button(label);
  while (form.type !== "form") form = form.parent;
  await act(async () => { await form.props.onSubmit({ preventDefault() {} }); });
}
async function mount(overrides = {}) {
  props = { teamId: "team-1", match: { id: "match-1", team_id: "team-1" }, user: { id: "staff" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<MatchOpponentPanel {...props} />); });
}
async function update(overrides) { props = { ...props, ...overrides }; await act(async () => renderer.update(<MatchOpponentPanel {...props} />)); }
function defer() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function mockApi(overrides = {}) {
  apiFetch.mockImplementation((_path, options) => {
    const body = JSON.parse(options.body);
    const response = overrides[body.action];
    if (response) return typeof response === "function" ? response(body, options) : Promise.resolve(response);
    if (body.action === "get-match-opponent") return Promise.resolve({ opponentId: null, opponents: [opponent], canEdit: true });
    if (body.action === "set-match-opponent") return Promise.resolve({ opponentId: body.opponentId });
    if (body.action === "create-opponent") return Promise.resolve({ opponent });
    throw new Error(`Unexpected action: ${body.action}`);
  });
}

describe("independent match opponent association", () => {
  it("clears the shared opponent while a new user's access loads and remains clear after refusal", async () => {
    mockApi({ "get-match-opponent": { opponentId: "opif", opponents: [opponent], canEdit: true } });
    const onResolvedName = vi.fn();
    await mount({ onResolvedName });
    expect(onResolvedName).toHaveBeenLastCalledWith("OPIF");

    const pending = defer();
    mockApi({ "get-match-opponent": () => pending.promise });
    onResolvedName.mockClear();
    await update({ user: { id: "new-member" } });
    expect(content()).toContain("Chargement de l’équipe adverse…");
    expect(content()).not.toContain("OPIF");
    expect(onResolvedName).toHaveBeenLastCalledWith("");

    await act(async () => pending.reject(Object.assign(new Error("Accès refusé."), { status: 403 })));
    expect(content()).toContain("Accès refusé.");
    expect(content()).not.toContain("OPIF");
    expect(onResolvedName).toHaveBeenLastCalledWith("");
    expect(onResolvedName).not.toHaveBeenCalledWith("OPIF");
    expect(calls("get-match-opponent")).toHaveLength(2);
    expect(calls("set-match-opponent")).toHaveLength(0);
  });

  it("shares the resolved saved name without refetching or publishing unsaved selection", async () => {
    const other = { id: "atlas", name: "Atlas" };
    mockApi({ "get-match-opponent": { opponentId: "opif", opponents: [opponent, other], canEdit: true } });
    const onResolvedName = vi.fn();
    await mount({ onResolvedName });
    expect(onResolvedName).toHaveBeenLastCalledWith("OPIF");
    await openEditor();
    change("Équipe adverse de cette partie", "atlas");
    expect(onResolvedName).toHaveBeenLastCalledWith("OPIF");
    await submit("Enregistrer l’adversaire");
    expect(onResolvedName).toHaveBeenLastCalledWith("Atlas");
    await update({ match: { ...props.match, participants: [{ champion: "Ahri" }] } });
    expect(calls("get-match-opponent")).toHaveLength(1);
    change("Équipe adverse de cette partie", "");
    await submit("Enregistrer l’adversaire");
    expect(onResolvedName).toHaveBeenLastCalledWith("");
  });

  it("does not fetch for a missing team or a match from another team", async () => {
    await mount({ teamId: null });
    expect(apiFetch).not.toHaveBeenCalled();
    await update({ teamId: "other" });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("saves an opponent without a draft and without any draft request", async () => {
    mockApi();
    const onChanged = vi.fn();
    await mount({ onChanged });
    await openEditor();
    expect(button("Enregistrer l’adversaire").props.disabled).toBe(true);
    change("Équipe adverse de cette partie", "opif");
    await submit("Enregistrer l’adversaire");
    expect(calls("set-match-opponent")).toEqual([{ action: "set-match-opponent", teamId: "team-1", matchId: "match-1", opponentId: "opif" }]);
    expect(apiFetch.mock.calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(["get-match-opponent", "set-match-opponent"]);
    expect(onChanged).toHaveBeenCalledOnce();
    expect(content()).toContain("Équipe adverse enregistrée pour cette partie.");
    expect(button("Enregistrer l’adversaire").props.disabled).toBe(true);
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(false);
    expect(button("Modifier")).toBeDefined();
  });

  it("removes only the opponent association by saving null", async () => {
    mockApi({ "get-match-opponent": { opponentId: "opif", opponents: [opponent], canEdit: true } });
    await mount();
    await openEditor();
    expect(field("Équipe adverse de cette partie").props.value).toBe("opif");
    change("Équipe adverse de cette partie", "");
    await submit("Enregistrer l’adversaire");
    expect(calls("set-match-opponent")[0].opponentId).toBeNull();
    expect(calls("unlink-match-draft")).toHaveLength(0);
    expect(content()).toContain("Équipe adverse retirée de cette partie.");
  });

  it("creates an opponent first and waits for explicit association confirmation", async () => {
    mockApi({ "get-match-opponent": { opponentId: null, opponents: [], canEdit: true } });
    await mount();
    await openEditor();
    await click("Créer une équipe adverse");
    change("Nom de l’équipe adverse", " OPIF ");
    await submit("Créer l’équipe");
    expect(calls("create-opponent")).toEqual([{ action: "create-opponent", teamId: "team-1", name: "OPIF", notes: "" }]);
    expect(calls("set-match-opponent")).toHaveLength(0);
    expect(field("Équipe adverse de cette partie").props.value).toBe("opif");
    expect(content()).toContain("Équipe créée. Enregistre-la pour l’associer à cette partie.");
    await submit("Enregistrer l’adversaire");
    expect(calls("set-match-opponent")).toHaveLength(1);
  });

  it("shows a saved opponent to read-only members without any mutation controls", async () => {
    mockApi({ "get-match-opponent": { opponentId: "opif", opponents: [opponent], canEdit: false } });
    await mount();
    expect(content()).toContain("OPIF");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(button("Créer une équipe adverse")).toBeUndefined();
    expect(renderer.root.findAllByType(GameOperationDialog)).toHaveLength(0);
    expect(button("Ajouter")).toBeUndefined();
    expect(button("Modifier")).toBeUndefined();
  });

  it.each([true, false])("explains group ownership and links each source without direct controls (canEdit=%s)", async (canEdit) => {
    mockApi({ "get-match-opponent": { opponentId: "opif", opponents: [opponent], canEdit, linkedGroups: [{ id: "group-1", name: "Session du soir" }, { id: "group-2", name: "Préparation" }] } });
    await mount();
    expect(content()).toContain("OPIF");
    expect(renderer.root.findAllByType(GameOperationDialog)).toHaveLength(0);
    expect(button("Ajouter")).toBeUndefined();
    expect(button("Modifier")).toBeUndefined();
    await click("Voir les groupes");
    expect(content()).toContain("L’équipe adverse de cette partie est définie par ses groupes.");
    expect(renderer.root.findAllByType("a").map((link) => link.props.href)).toEqual(["/games?view=groups&archive=group-1&team=team-1", "/games?view=groups&archive=group-2&team=team-1"]);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(button("Créer une équipe adverse")).toBeUndefined();
    expect(calls("set-match-opponent")).toHaveLength(0);
    expect(calls("create-opponent")).toHaveLength(0);
  });

  it("ignores a late load after switching teams and matches", async () => {
    const pending = defer();
    let signal;
    const onResolvedName = vi.fn();
    mockApi({ "get-match-opponent": (body, options) => {
      if (body.matchId === "match-1") { signal = options.signal; return pending.promise; }
      return Promise.resolve({ opponentId: null, opponents: [], canEdit: true });
    } });
    await mount({ onResolvedName });
    await update({ teamId: "team-2", match: { id: "match-2", team_id: "team-2" } });
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve({ opponentId: "opif", opponents: [opponent], canEdit: true }));
    expect(content()).not.toContain("OPIF");
    expect(onResolvedName).not.toHaveBeenCalledWith("OPIF");
    expect(onResolvedName).toHaveBeenLastCalledWith("");
    expect(renderer.root.findAllByType(GameOperationDialog)).toHaveLength(0);
    await openEditor();
    expect(field("Équipe adverse de cette partie").props.value).toBe("");
  });

  it("ignores a late save after switching matches", async () => {
    const pending = defer();
    let signal;
    const onChanged = vi.fn();
    mockApi({ "set-match-opponent": (_body, options) => { signal = options.signal; return pending.promise; } });
    await mount({ onChanged });
    await openEditor();
    change("Équipe adverse de cette partie", "opif");
    let work;
    act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    await update({ match: { id: "match-2", team_id: "team-1" } });
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ opponentId: "opif" }); await work; });
    expect(renderer.root.findAllByType(GameOperationDialog)).toHaveLength(0);
    await openEditor();
    expect(field("Équipe adverse de cette partie").props.value).toBe("");
    expect(content()).not.toContain("Équipe adverse enregistrée pour cette partie.");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("keeps local association state without refetching when the same match detail refreshes", async () => {
    mockApi();
    await mount();
    await openEditor();
    change("Équipe adverse de cette partie", "opif");
    await submit("Enregistrer l’adversaire");
    await update({ match: { ...props.match, participants: [{ champion: "Ahri" }] } });
    expect(calls("get-match-opponent")).toHaveLength(1);
    expect(field("Équipe adverse de cette partie").props.value).toBe("opif");
  });

  it("retries failed reads and retains the selected opponent after a failed write", async () => {
    let reads = 0;
    mockApi({ "get-match-opponent": () => ++reads === 1 ? Promise.reject(new Error("Lecture indisponible.")) : Promise.resolve({ opponentId: null, opponents: [opponent], canEdit: true }), "set-match-opponent": () => Promise.reject(new Error("Écriture indisponible.")) });
    await mount();
    expect(content()).toContain("Lecture indisponible.");
    expect(button("Enregistrer l’adversaire")).toBeUndefined();
    await click("Réessayer");
    await openEditor();
    change("Équipe adverse de cette partie", "opif");
    await submit("Enregistrer l’adversaire");
    expect(content()).toContain("Écriture indisponible.");
    expect(field("Équipe adverse de cette partie").props.value).toBe("opif");
    expect(button("Enregistrer l’adversaire").props.disabled).toBe(false);
  });

  it("keeps the editor closed until requested while displaying the saved opponent", async () => {
    mockApi({ "get-match-opponent": { opponentId: "opif", opponents: [opponent], canEdit: true } });
    await mount();
    expect(content()).toContain("OPIF");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findAllByType(GameOperationDialog)).toHaveLength(0);
    expect(button("Modifier").props).toMatchObject({ "aria-haspopup": "dialog", "aria-label": "Modifier l’équipe adverse" });
    await openEditor();
    expect(renderer.root.findByType(GameOperationDialog).props).toMatchObject({ busy: false, dirty: false, compact: true });
    expect(renderer.root.findByType(GameOperationDialog).props.returnFocusRef).toBeDefined();
    expect(field("Équipe adverse de cette partie").props.value).toBe("opif");
  });

  it("discards unsaved selection and creation when the shared dialog allows closing", async () => {
    mockApi();
    await mount();
    await openEditor();
    change("Équipe adverse de cette partie", "opif");
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(true);
    await click("Créer une équipe adverse");
    change("Nom de l’équipe adverse", "Nouvel adversaire");
    act(() => renderer.root.findByType(GameOperationDialog).props.onClose());
    expect(renderer.root.findAllByType(GameOperationDialog)).toHaveLength(0);
    await openEditor();
    expect(field("Équipe adverse de cette partie").props.value).toBe("");
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(false);
    await click("Créer une équipe adverse");
    expect(field("Nom de l’équipe adverse").props.value).toBe("");
    change("Nom de l’équipe adverse", "Un autre adversaire");
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(true);
    expect(calls("get-match-opponent")).toHaveLength(1);
    expect(calls("set-match-opponent")).toHaveLength(0);
  });

  it("protects the dialog while an association is being saved", async () => {
    const pending = defer();
    mockApi({ "set-match-opponent": () => pending.promise });
    await mount();
    await openEditor();
    change("Équipe adverse de cette partie", "opif");
    let work;
    act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(renderer.root.findByType(GameOperationDialog).props.busy).toBe(true);
    expect(field("Équipe adverse de cette partie").props.disabled).toBe(true);
    await act(async () => { pending.resolve({ opponentId: "opif" }); await work; });
    expect(renderer.root.findByType(GameOperationDialog).props.busy).toBe(false);
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(false);
    expect(content()).toContain("Équipe adverse enregistrée pour cette partie.");
  });

  it("clears a cancelled creation without leaving the dialog dirty", async () => {
    mockApi();
    await mount();
    await openEditor();
    await click("Créer une équipe adverse");
    change("Nom de l’équipe adverse", "Équipe à annuler");
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(true);
    await click("Annuler la création");
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(false);
    await click("Créer une équipe adverse");
    expect(field("Nom de l’équipe adverse").props.value).toBe("");
    expect(calls("create-opponent")).toHaveLength(0);
  });
});
