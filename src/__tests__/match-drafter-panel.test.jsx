import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import MatchDrafterPanel from "../components/opponents/MatchDrafterPanel.jsx";
import { GameOperationDialog } from "../components/games/GameOperationDialog.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../components/games/GameOperationDialog.jsx", () => ({ GameOperationDialog: ({ children, title }) => <div role="dialog" aria-label={title}>{children}</div> }));
vi.mock("../pages/workspace/workspace-shared.jsx", () => ({ ChampionPortrait: ({ champion }) => <img alt={champion} />, championDisplayName: (champion) => champion }));

const snapshot = {
  source: "drafter.lol", sourceId: "IiYYZGok", gameNumber: 2, sourceUrl: "https://drafter.lol/draft/IiYYZGok?game=2",
  blueName: "Arcane Horizon", redName: "OPIF", bluePicks: ["Aatrox", "Zeri", "Braum", "DrMundo", "Ahri"],
  redPicks: ["Yunara", "Lulu", "Anivia", "Kennen", "Maokai"], blueBans: ["Jhin", "Khazix", "JarvanIV", "Gnar", "Sylas"],
  redBans: ["MonkeyKing", "Poppy", "Thresh", null, "Diana"], status: "completed", fearless: true, ironman: false, warnings: [],
};
const opponent = { id: "opif", name: "OPIF" };
const draft = { id: "draft-1", opponentId: opponent.id, allySide: "blue", sourceId: snapshot.sourceId, gameNumber: 2, snapshot, matchId: "match-1" };
let renderer;
let props;

afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.resetAllMocks(); });
function text(node) { return node.children.map((child) => typeof child === "string" ? child : text(child)).join(""); }
function content() { return text(renderer.root); }
function button(label) { return renderer.root.findAllByType("button").find((item) => text(item) === label); }
function field(label) {
  const wrapper = renderer.root.findAllByType("label").find((item) => item.findAllByType("span").some((span) => text(span) === label));
  return wrapper.find((item) => ["input", "select", "textarea"].includes(item.type));
}
function calls(action) { return apiFetch.mock.calls.map(([, options]) => JSON.parse(options.body)).filter((call) => call.action === action); }
function change(label, value) { act(() => field(label).props.onChange({ target: { value } })); }
async function click(label) { await act(async () => { await button(label).props.onClick?.(); }); }
async function read() { await act(async () => { await renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); }); }
async function mount(overrides = {}, open = true) {
  props = { teamId: "team-1", match: { id: "match-1", team_id: "team-1" }, user: { id: "staff" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<MatchDrafterPanel {...props} />); });
  if (open) await openDraft();
}
async function openDraft() {
  const trigger = button("Voir la draft") || button("Ajouter une draft");
  if (trigger) await act(async () => trigger.props.onClick());
}
async function update(overrides) { props = { ...props, ...overrides }; await act(async () => renderer.update(<MatchDrafterPanel {...props} />)); }
function defer() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
function mockApi(overrides = {}) {
  apiFetch.mockImplementation((_path, options) => {
    const body = JSON.parse(options.body);
    const response = overrides[body.action];
    if (response) return typeof response === "function" ? response(body, options) : Promise.resolve(response);
    if (body.action === "get-match-draft") return Promise.resolve({ draft: null, opponents: [opponent], canEdit: true });
    if (body.action === "preview") return Promise.resolve({ snapshot, previewToken: "signed-preview" });
    if (body.action === "save-match-draft") return Promise.resolve({ draft });
    if (body.action === "unlink-match-draft") return Promise.resolve({ draft: null, ok: true });
    throw new Error(`Unexpected action: ${body.action}`);
  });
}
async function preview() { change("Lien Drafter.lol", snapshot.sourceUrl); await read(); }

describe("match Drafter association", () => {
  it("keeps the draft in a compact control until requested and resets the dialog on match change", async () => {
    mockApi({ "get-match-draft": { draft, canEdit: true } });
    await mount({}, false);
    expect(content()).toContain("Draft liée");
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(content()).not.toContain("Yunara");
    await openDraft();
    expect(content()).toContain("Yunara");
    await update({ match: { id: "match-2", team_id: "team-1" } });
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  });

  it("discards and aborts an unfinished preview when the dialog is closed", async () => {
    const pending = defer();
    let signal;
    mockApi({ preview: (_body, options) => { signal = options.signal; return pending.promise; } });
    await mount();
    change("Lien Drafter.lol", snapshot.sourceUrl);
    let work;
    act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(true);
    act(() => renderer.root.findByType(GameOperationDialog).props.onClose());
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ snapshot, previewToken: "stale" }); await work; });
    await openDraft();
    expect(field("Lien Drafter.lol").props.value).toBe("");
    expect(button("Rattacher la draft")).toBeUndefined();
  });

  it("does not expose an add action to read-only members without a linked draft", async () => {
    mockApi({ "get-match-draft": { draft: null, canEdit: false } });
    await mount({}, false);
    expect(content()).toContain("Non liée");
    expect(button("Ajouter une draft")).toBeUndefined();
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  });

  it("does not call the API without a valid team and match scope", async () => {
    await mount({ teamId: null });
    expect(apiFetch).not.toHaveBeenCalled();
    await update({ teamId: "team-2" });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("requires our explicit side and sends a verified token without assigning any opponent", async () => {
    const onChanged = vi.fn();
    mockApi();
    await mount({ onChanged });
    await preview();
    expect(button("Rattacher la draft").props.disabled).toBe(true);
    await click("Rattacher la draft");
    expect(calls("save-match-draft")).toHaveLength(0);
    change("Côté de notre équipe", "blue");
    await click("Rattacher la draft");
    expect(calls("save-match-draft")).toEqual([{ action: "save-match-draft", teamId: "team-1", matchId: "match-1", allySide: "blue", previewToken: "signed-preview" }]);
    expect(onChanged).toHaveBeenCalledOnce();
    expect(content()).toContain("Draft rattachée à cette partie.");
    expect(button("Remplacer la draft")).toBeDefined();
    expect(renderer.root.findByProps({ rel: "noopener noreferrer" }).props).toMatchObject({ href: snapshot.sourceUrl, target: "_blank" });
    expect(renderer.root.findByProps({ href: "/tendances?rubrique=drafts&draft=draft-1" })).toBeDefined();
  });

  it("never offers or writes an opponent association when attaching a draft", async () => {
    mockApi();
    await mount();
    await preview();
    change("Côté de notre équipe", "red");
    expect(renderer.root.findAllByType("select")).toHaveLength(1);
    expect(content()).not.toContain("Fiche adversaire");
    expect(content()).not.toContain("Créer ou retrouver l’équipe adverse");
    await click("Rattacher la draft");
    expect(calls("save-match-draft")[0]).toEqual({ action: "save-match-draft", teamId: "team-1", matchId: "match-1", allySide: "red", previewToken: "signed-preview" });
    expect(calls("set-match-opponent")).toHaveLength(0);
    expect(calls("create-opponent")).toHaveLength(0);
  });

  it("lets read-only members inspect an existing draft without writes", async () => {
    mockApi({ "get-match-draft": { draft, opponents: [opponent], canEdit: false } });
    await mount();
    expect(content()).toContain("Arcane Horizon / OPIF");
    expect(content()).toContain("Yunara");
    expect(button("Détacher la draft")).toBeUndefined();
    expect(button("Remplacer la draft")).toBeUndefined();
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
  });

  it("keeps the current draft when replacement is cancelled or the server reports a link conflict", async () => {
    mockApi({ "get-match-draft": { draft, opponents: [opponent], canEdit: true }, "save-match-draft": () => Promise.reject(new Error("Cette draft est déjà liée à une autre partie.")) });
    await mount();
    await click("Remplacer la draft");
    await preview();
    await click("Annuler le remplacement");
    expect(button("Remplacer la draft liée")).toBeUndefined();
    expect(content()).toContain("Draft liée");
    await click("Remplacer la draft");
    await preview();
    change("Côté de notre équipe", "blue");
    await click("Remplacer la draft liée");
    expect(content()).toContain("Cette draft est déjà liée à une autre partie.");
    expect(content()).toContain("Draft liée");
    expect(button("Remplacer la draft liée")).toBeDefined();
  });

  it("only detaches after explicit confirmation and leaves a route to import another draft", async () => {
    mockApi({ "get-match-draft": { draft, opponents: [opponent], canEdit: true } });
    await mount();
    await click("Détacher la draft");
    expect(calls("unlink-match-draft")).toHaveLength(0);
    expect(content()).toContain("Elle restera disponible dans l’historique des analyses.");
    await click("Confirmer le détachement");
    expect(calls("unlink-match-draft")).toEqual([{ action: "unlink-match-draft", teamId: "team-1", matchId: "match-1" }]);
    expect(content()).toContain("Lien retiré. La draft reste dans l’historique des analyses.");
    expect(button("Vérifier la draft")).toBeDefined();
  });

  it("clears a verified preview and rejects stale responses when the URL changes", async () => {
    const pending = defer();
    let signal;
    let previews = 0;
    mockApi({ preview: (_body, options) => { signal = options.signal; return ++previews === 1 ? Promise.resolve({ snapshot, previewToken: "first" }) : pending.promise; } });
    await mount();
    await preview();
    change("Côté de notre équipe", "blue");
    change("Lien Drafter.lol", "https://drafter.lol/draft/Another?game=1");
    expect(button("Rattacher la draft")).toBeUndefined();
    let work;
    act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    change("Lien Drafter.lol", "https://drafter.lol/draft/Third?game=1");
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ snapshot, previewToken: "stale" }); await work; });
    expect(button("Rattacher la draft")).toBeUndefined();
  });

  it("does not display an old draft when switching match during its initial load", async () => {
    const pending = defer();
    let signal;
    mockApi({ "get-match-draft": (body, options) => {
      if (body.matchId === "match-1") { signal = options.signal; return pending.promise; }
      return Promise.resolve({ draft: null, canEdit: true, opponents: [] });
    } });
    await mount();
    await update({ match: { id: "match-2", team_id: "team-1" } });
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve({ draft, canEdit: true, opponents: [opponent] }));
    expect(content()).not.toContain("OPIF");
    expect(button("Ajouter une draft")).toBeDefined();
  });

  it("ignores a late save after changing team and match", async () => {
    const pending = defer();
    let signal;
    const onChanged = vi.fn();
    mockApi({ "save-match-draft": (_body, options) => { signal = options.signal; return pending.promise; } });
    await mount({ onChanged });
    await preview();
    change("Côté de notre équipe", "blue");
    let work;
    act(() => { work = button("Rattacher la draft").props.onClick(); });
    await update({ teamId: "team-2", match: { id: "match-2", team_id: "team-2" } });
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ draft }); await work; });
    expect(content()).not.toContain("Draft liée");
    expect(content()).not.toContain("Draft rattachée à cette partie.");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("retries a failed initial fetch without exposing an import before permissions are known", async () => {
    let attempts = 0;
    mockApi({ "get-match-draft": () => ++attempts === 1 ? Promise.reject(new Error("Erreur de chargement.")) : Promise.resolve({ draft: null, canEdit: true, opponents: [] }) });
    await mount();
    expect(content()).toContain("Erreur de chargement.");
    expect(button("Vérifier la draft")).toBeUndefined();
    await click("Réessayer");
    await openDraft();
    expect(button("Vérifier la draft")).toBeDefined();
  });
});
