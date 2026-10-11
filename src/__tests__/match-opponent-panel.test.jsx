import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import MatchOpponentPanel from "../components/opponents/MatchOpponentPanel.jsx";

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
  props = { teamId: "team-1", match: { id: "match-1", team_id: "team-1" }, user: { id: "staff" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<MatchOpponentPanel {...props} />); });
}
async function update(overrides) { props = { ...props, ...overrides }; await act(async () => renderer.update(<MatchOpponentPanel {...props} />)); }
function defer() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
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
    expect(button("Enregistrer l’adversaire").props.disabled).toBe(true);
    change("Équipe adverse de cette partie", "opif");
    await submit("Enregistrer l’adversaire");
    expect(calls("set-match-opponent")).toEqual([{ action: "set-match-opponent", teamId: "team-1", matchId: "match-1", opponentId: "opif" }]);
    expect(apiFetch.mock.calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(["get-match-opponent", "set-match-opponent"]);
    expect(onChanged).toHaveBeenCalledOnce();
    expect(content()).toContain("Équipe adverse enregistrée pour cette partie.");
    expect(button("Enregistrer l’adversaire").props.disabled).toBe(true);
  });

  it("removes only the opponent association by saving null", async () => {
    mockApi({ "get-match-opponent": { opponentId: "opif", opponents: [opponent], canEdit: true } });
    await mount();
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
  });

  it("ignores a late load after switching teams and matches", async () => {
    const pending = defer();
    let signal;
    mockApi({ "get-match-opponent": (body, options) => {
      if (body.matchId === "match-1") { signal = options.signal; return pending.promise; }
      return Promise.resolve({ opponentId: null, opponents: [], canEdit: true });
    } });
    await mount();
    await update({ teamId: "team-2", match: { id: "match-2", team_id: "team-2" } });
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve({ opponentId: "opif", opponents: [opponent], canEdit: true }));
    expect(content()).not.toContain("OPIF");
    expect(field("Équipe adverse de cette partie").props.value).toBe("");
  });

  it("ignores a late save after switching matches", async () => {
    const pending = defer();
    let signal;
    const onChanged = vi.fn();
    mockApi({ "set-match-opponent": (_body, options) => { signal = options.signal; return pending.promise; } });
    await mount({ onChanged });
    change("Équipe adverse de cette partie", "opif");
    let work;
    act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    await update({ match: { id: "match-2", team_id: "team-1" } });
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ opponentId: "opif" }); await work; });
    expect(field("Équipe adverse de cette partie").props.value).toBe("");
    expect(content()).not.toContain("Équipe adverse enregistrée pour cette partie.");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("keeps local association state without refetching when the same match detail refreshes", async () => {
    mockApi();
    await mount();
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
    change("Équipe adverse de cette partie", "opif");
    await submit("Enregistrer l’adversaire");
    expect(content()).toContain("Écriture indisponible.");
    expect(field("Équipe adverse de cette partie").props.value).toBe("opif");
    expect(button("Enregistrer l’adversaire").props.disabled).toBe(false);
  });
});
