import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import GroupOpponentPanel from "../components/opponents/GroupOpponentPanel.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
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
async function submit(label) {
  let form = button(label);
  while (form.type !== "form") form = form.parent;
  await act(async () => { await form.props.onSubmit({ preventDefault() {} }); });
}
async function mount(overrides = {}) {
  props = { teamId: "team-1", archive: { id: "group-1", team_id: "team-1" }, user: { id: "staff" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<GroupOpponentPanel {...props} />); });
}
async function update(overrides) { props = { ...props, ...overrides }; await act(async () => renderer.update(<GroupOpponentPanel {...props} />)); }
function defer() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
function mockApi(overrides = {}) {
  apiFetch.mockImplementation((_path, options) => {
    const body = JSON.parse(options.body);
    const response = overrides[body.action];
    if (response) return typeof response === "function" ? response(body, options) : Promise.resolve(response);
    if (body.action === "get-group-opponent") return Promise.resolve({ opponentId: null, opponents: [opponent], matchCount: 3, canEdit: true });
    if (body.action === "set-group-opponent") return Promise.resolve({ opponentId: body.opponentId, matchCount: 3 });
    if (body.action === "create-opponent") return Promise.resolve({ opponent });
    throw new Error(`Unexpected action: ${body.action}`);
  });
}

describe("group opponent association", () => {
  it("does not read or mutate a group from another team", async () => {
    await mount({ teamId: "other-team" });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(renderer.toJSON()).toBeNull();
  });

  it("sends one group association request, explains propagation and refreshes before success", async () => {
    mockApi();
    const onChanged = vi.fn();
    await mount({ onChanged });
    expect(content()).toContain("y compris celles ajoutées ensuite");
    expect(button("Enregistrer le lien").props.disabled).toBe(true);
    change("Associer une équipe au groupe", "opif");
    await submit("Enregistrer le lien");
    expect(calls("set-group-opponent")).toEqual([{ action: "set-group-opponent", teamId: "team-1", archiveId: "group-1", opponentId: "opif" }]);
    expect(calls("set-match-opponent")).toHaveLength(0);
    expect(onChanged).toHaveBeenCalledOnce();
    expect(content()).toContain("Équipe liée au groupe et à ses 3 parties.");
    expect(renderer.root.findByType("a").props.href).toBe("/games?view=teams&opponent=opif&team=team-1");
    expect(button("Enregistrer le lien").props.disabled).toBe(true);
  });

  it("removes the group link by sending null and explains existing match associations remain", async () => {
    mockApi({ "get-group-opponent": { opponentId: "opif", opponents: [opponent], matchCount: 3, canEdit: true } });
    await mount();
    change("Associer une équipe au groupe", "");
    await submit("Enregistrer le lien");
    expect(calls("set-group-opponent")[0].opponentId).toBeNull();
    expect(content()).toContain("Lien du groupe retiré. Les équipes de ses parties sont conservées.");
  });

  it("creates an opponent without associating until the link is saved", async () => {
    mockApi({ "get-group-opponent": { opponentId: null, opponents: [], matchCount: 3, canEdit: true } });
    await mount();
    await click("Créer une équipe adverse");
    change("Nom de l’équipe adverse", " OPIF ");
    await submit("Créer l’équipe");
    expect(calls("create-opponent")).toEqual([{ action: "create-opponent", teamId: "team-1", name: "OPIF", notes: "" }]);
    expect(calls("set-group-opponent")).toHaveLength(0);
    expect(field("Associer une équipe au groupe").props.value).toBe("opif");
    expect(content()).toContain("Équipe créée. Enregistre le lien pour l’associer à ce groupe.");
  });

  it("shows a saved opponent and team link to a read-only member without mutation controls", async () => {
    mockApi({ "get-group-opponent": { opponentId: "opif", opponents: [opponent], matchCount: 3, canEdit: false } });
    await mount();
    expect(content()).toContain("OPIF");
    expect(content()).toContain("Le capitaine ou le staff peut modifier le lien du groupe.");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(button("Créer une équipe adverse")).toBeUndefined();
  });

  it("ignores late reads when switching groups and offers no mutation controls while loading", async () => {
    const pending = defer();
    let signal;
    mockApi({ "get-group-opponent": (body, options) => {
      if (body.archiveId === "group-1") { signal = options.signal; return pending.promise; }
      return Promise.resolve({ opponentId: null, opponents: [], matchCount: 2, canEdit: true });
    } });
    await mount();
    expect(button("Enregistrer le lien")).toBeUndefined();
    expect(button("Créer une équipe adverse")).toBeUndefined();
    await update({ archive: { id: "group-2", team_id: "team-1" } });
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve({ opponentId: "opif", opponents: [opponent], matchCount: 3, canEdit: true }));
    expect(content()).not.toContain("OPIF");
    expect(content()).toContain("2 parties dans ce groupe");
    expect(field("Associer une équipe au groupe").props.value).toBe("");
  });

  it("ignores late writes when switching teams and groups", async () => {
    const pending = defer();
    let signal;
    const onChanged = vi.fn();
    mockApi({ "set-group-opponent": (_body, options) => { signal = options.signal; return pending.promise; } });
    await mount({ onChanged });
    change("Associer une équipe au groupe", "opif");
    let work;
    act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    await update({ teamId: "team-2", archive: { id: "group-2", team_id: "team-2" } });
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ opponentId: "opif", matchCount: 3 }); await work; });
    expect(field("Associer une équipe au groupe").props.value).toBe("");
    expect(content()).not.toContain("Équipe liée au groupe");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("retries failed reads and keeps the choice after a conflicting write", async () => {
    let reads = 0;
    mockApi({ "get-group-opponent": () => ++reads === 1 ? Promise.reject(new Error("Lecture indisponible.")) : Promise.resolve({ opponentId: null, opponents: [opponent], matchCount: 3, canEdit: true }), "set-group-opponent": () => Promise.reject(new Error("Une partie est liée à une autre équipe par un groupe.")) });
    await mount();
    expect(content()).toContain("Lecture indisponible.");
    expect(button("Enregistrer le lien")).toBeUndefined();
    await click("Réessayer");
    change("Associer une équipe au groupe", "opif");
    await submit("Enregistrer le lien");
    expect(renderer.root.findByProps({ role: "alert" }).children).toContain("Une partie est liée à une autre équipe par un groupe.");
    expect(field("Associer une équipe au groupe").props.value).toBe("opif");
    expect(button("Enregistrer le lien").props.disabled).toBe(false);
  });

  it("reports a refresh failure without claiming the whole workflow succeeded or losing the saved link", async () => {
    mockApi();
    const onChanged = vi.fn().mockRejectedValue(new Error("Refresh unavailable"));
    await mount({ onChanged });
    change("Associer une équipe au groupe", "opif");
    await submit("Enregistrer le lien");
    expect(content()).toContain("Le lien du groupe est enregistré. Recharge la page pour actualiser les autres données.");
    expect(content()).not.toContain("Équipe liée au groupe et à ses");
    expect(button("Enregistrer le lien").props.disabled).toBe(true);
    expect(field("Associer une équipe au groupe").props.value).toBe("opif");
  });
});
