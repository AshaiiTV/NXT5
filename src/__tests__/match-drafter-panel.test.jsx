import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import MatchDrafterPanel, { MatchDraftingView } from "../components/opponents/MatchDrafterPanel.jsx";
import DraftBoard from "../components/draft/DraftBoard.jsx";
import { GameOperationDialog } from "../components/games/GameOperationDialog.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const dialogMode = vi.hoisted(() => ({ native: false }));
vi.mock("../components/games/GameOperationDialog.jsx", async (load) => {
  const actual = await load();
  return { GameOperationDialog: (props) => dialogMode.native ? <actual.GameOperationDialog {...props} /> : <div role="dialog" aria-label={props.title}>{props.children}</div> };
});
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

afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; dialogMode.native = false; vi.resetAllMocks(); vi.unstubAllGlobals(); });
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
async function mount(overrides = {}, open = true, rendererOptions) {
  props = { teamId: "team-1", match: { id: "match-1", team_id: "team-1" }, user: { id: "staff" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<MatchDrafterPanel {...props} />, rendererOptions); });
  if (open) await openDraft();
}
async function openDraft() {
  const trigger = button("Voir la draft") || button("Ajouter une draft");
  if (trigger) await act(async () => trigger.props.onClick());
}
async function update(overrides) { props = { ...props, ...overrides }; await act(async () => renderer.update(<MatchDrafterPanel {...props} />)); }
function defer() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
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

describe("inline match draft", () => {
  it("returns focus to the current trigger after adding then detaching the draft", async () => {
    dialogMode.native = true;
    vi.stubGlobal("window", { location: { href: "https://nxt5.test/games?match=match-1" }, history: { state: null }, addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: vi.fn(() => true) });
    vi.stubGlobal("document", { activeElement: null, body: { style: { overflow: "" } } });
    const focusable = () => {
      const node = { focus: vi.fn(() => { document.activeElement = node; }) };
      return node;
    };
    const createNodeMock = (element) => {
      if (element.type === "span" && element.props.children?.props?.["aria-haspopup"] === "dialog") {
        const currentButton = focusable();
        const span = { querySelector: () => currentButton };
        Object.defineProperty(currentButton, "isConnected", { get: () => renderer.root.findByType(MatchDraftingView).props.manageRef.current === span });
        return span;
      }
      if (element.type === "dialog") {
        return { open: false, showModal() { this.open = true; document.activeElement = this; }, close() { this.open = false; } };
      }
      return focusable();
    };
    const currentTrigger = () => renderer.root.findByType(MatchDraftingView).props.manageRef.current.querySelector("button");
    const closeNative = () => act(() => renderer.root.findAllByType("button").find((node) => node.props["aria-label"] === "Fermer la fenêtre").props.onClick());
    mockApi();
    await mount({ presentation: "inline" }, false, { createNodeMock });
    const addTrigger = currentTrigger();
    await click("Ajouter une draft");
    await preview();
    change("Côté de notre équipe", "blue");
    await click("Rattacher la draft");
    expect(button("Gérer la draft")).toBeDefined();
    closeNative();
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(document.activeElement).toBe(currentTrigger());
    expect(document.activeElement).toBe(addTrigger);
    expect(addTrigger.focus).toHaveBeenCalledWith({ preventScroll: true });

    const manageTrigger = currentTrigger();
    await click("Gérer la draft");
    await click("Détacher la draft");
    await click("Confirmer le détachement");
    expect(button("Ajouter une draft")).toBeDefined();
    closeNative();
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(document.activeElement).toBe(currentTrigger());
    expect(document.activeElement).toBe(manageTrigger);
    expect(manageTrigger.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(calls("get-match-draft")).toHaveLength(1);
  });

  it.each(["loading", "error"])("hides stale draft content until a usable read is available (%s)", async (status) => {
    const onRetry = vi.fn();
    const onManage = vi.fn();
    await act(async () => { renderer = TestRenderer.create(<MatchDraftingView draft={draft} status={status} canEdit error="Accès refusé." onRetry={onRetry} onManage={onManage} />); });
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(0);
    expect(content()).not.toContain("Arcane Horizon");
    expect(content()).not.toContain("OPIF");
    expect(button("Gérer la draft")).toBeUndefined();
    expect(button("Ajouter une draft")).toBeUndefined();
    if (status === "error") {
      expect(content()).toContain("Accès refusé.");
      await click("Réessayer");
      expect(onRetry).toHaveBeenCalledOnce();
    }
    expect(onManage).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows the saved board's picks and bans directly to read-only members", async () => {
    mockApi({ "get-match-draft": { draft, canEdit: false } });
    await mount({ presentation: "inline", match: { id: "match-1", team_id: "team-1", participants: [{ champion: "Annie", role: "TOP" }] } }, false);
    const board = renderer.root.findByType(DraftBoard);
    expect(board.props.snapshot).toBe(snapshot);
    expect(board.props.allySide).toBe("blue");
    expect(board.findAllByProps({ className: "draft-board-picks" })).toHaveLength(2);
    expect(board.findAllByProps({ className: "draft-board-bans" })).toHaveLength(2);
    expect(text(board.findByProps({ "aria-label": "Picks de Arcane Horizon" }))).toContain("Aatrox");
    expect(text(board.findByProps({ "aria-label": "Picks de OPIF" }))).toContain("Yunara");
    expect(text(board.findByProps({ "aria-label": "Bans de Arcane Horizon" }))).toContain("Jhin");
    expect(text(board.findByProps({ "aria-label": "Bans de OPIF" }))).toContain("Non renseigné");
    expect(content()).not.toContain("Annie");
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    for (const label of ["Gérer la draft", "Voir la draft", "Ajouter une draft", "Remplacer la draft", "Détacher la draft"]) expect(button(label)).toBeUndefined();
    expect(calls("get-match-draft")).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps staff changes in the existing managed dialog", async () => {
    mockApi({ "get-match-draft": { draft, canEdit: true } });
    await mount({ presentation: "inline" }, false);
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(1);
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    await click("Gérer la draft");
    expect(renderer.root.findByType(GameOperationDialog).props.returnFocusRef).toBeDefined();
    expect(renderer.root.findByType(GameOperationDialog).findAllByType(DraftBoard)).toHaveLength(0);
    expect(button("Remplacer la draft")).toBeDefined();
    expect(button("Détacher la draft")).toBeDefined();
    await click("Remplacer la draft");
    change("Lien Drafter.lol", snapshot.sourceUrl);
    expect(renderer.root.findByType(GameOperationDialog).props.dirty).toBe(true);
    act(() => renderer.root.findByType(GameOperationDialog).props.onClose());
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(renderer.root.findByType(DraftBoard).props.snapshot).toBe(snapshot);
    await click("Gérer la draft");
    await click("Remplacer la draft");
    expect(field("Lien Drafter.lol").props.value).toBe("");
    expect(calls("save-match-draft")).toHaveLength(0);
    expect(calls("unlink-match-draft")).toHaveLength(0);
    expect(calls("get-match-draft")).toHaveLength(1);
  });

  it.each([true, false])("shows an honest empty state and only authorized add controls (canEdit=%s)", async (canEdit) => {
    mockApi({ "get-match-draft": { draft: null, canEdit } });
    await mount({ presentation: "inline" }, false);
    expect(content()).toContain(canEdit ? "Ajoute un lien Drafter pour retrouver les picks et bans de cette partie." : "Aucune draft liée à cette partie. Le staff peut en ajouter une.");
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(Boolean(button("Ajouter une draft"))).toBe(canEdit);
    expect(calls("preview")).toHaveLength(0);
    if (canEdit) {
      await click("Ajouter une draft");
      expect(renderer.root.findAllByType("form")).toHaveLength(1);
      expect(button("Vérifier la draft").props.disabled).toBe(true);
      expect(calls("save-match-draft")).toHaveLength(0);
    }
  });

  it("shows loading and retry states without exposing edit actions before access is known", async () => {
    const pending = defer();
    let attempts = 0;
    mockApi({ "get-match-draft": () => ++attempts === 1 ? pending.promise : Promise.resolve({ draft, canEdit: false }) });
    await mount({ presentation: "inline" }, false);
    expect(content()).toContain("Chargement de la draft liée…");
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(0);
    expect(button("Ajouter une draft")).toBeUndefined();
    expect(button("Gérer la draft")).toBeUndefined();
    await act(async () => pending.reject(new Error("Lecture indisponible.")));
    expect(content()).toContain("Lecture indisponible.");
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(button("Ajouter une draft")).toBeUndefined();
    await click("Réessayer");
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(1);
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(calls("get-match-draft")).toHaveLength(2);
  });

  it("preserves the fetched board and replay position while hidden or the same match refreshes", async () => {
    const ordered = { ...snapshot, firstPick: "blue", orderEvidence: { version: 1, basis: "reconstructed-public-slots", format: "standard-20", firstPick: "blue", reason: "public-slot-fields-v1" } };
    mockApi({ "get-match-draft": { draft: { ...draft, snapshot: ordered }, canEdit: false } });
    const panelProps = { teamId: "team-1", match: { id: "match-1", team_id: "team-1" }, user: { id: "reader" }, presentation: "inline" };
    const tree = (hidden, match = panelProps.match) => <div hidden={hidden}><MatchDrafterPanel {...panelProps} match={match} active={!hidden} /></div>;
    await act(async () => { renderer = TestRenderer.create(tree(false)); });
    act(() => renderer.root.findByProps({ type: "range" }).props.onChange({ target: { value: "7" } }));
    await act(async () => renderer.update(tree(true)));
    await act(async () => renderer.update(tree(false, { ...panelProps.match, participants: [{ champion: "Ahri" }] })));
    expect(renderer.root.findByProps({ type: "range" }).props.value).toBe(7);
    expect(calls("get-match-draft")).toHaveLength(1);
    expect(calls("preview")).toHaveLength(0);
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  });

  it.each(["preview", "save"])("does not reopen a dialog or move focus when a late %s finishes on an inactive tab", async (operation) => {
    const pending = defer();
    const focus = vi.fn();
    mockApi({ [operation === "preview" ? "preview" : "save-match-draft"]: () => pending.promise });
    await mount({ presentation: "inline" }, true, { createNodeMock: () => ({ focus }) });
    let work;
    if (operation === "preview") {
      change("Lien Drafter.lol", snapshot.sourceUrl);
      act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    } else {
      await preview();
      change("Côté de notre équipe", "blue");
      act(() => { work = button("Rattacher la draft").props.onClick(); });
    }
    await update({ active: false });
    focus.mockClear();
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    await act(async () => {
      pending.resolve(operation === "preview" ? { snapshot, previewToken: "late-preview" } : { draft });
      await work;
    });
    expect(focus).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(calls("get-match-draft")).toHaveLength(1);
    expect(calls("preview")).toHaveLength(1);
    expect(calls("save-match-draft")).toHaveLength(operation === "save" ? 1 : 0);
    await update({ active: true });
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(1);
    expect(focus).toHaveBeenCalledOnce();
  });
});

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

  it.each(["context", "inline"])("does not display an old draft when switching match during its initial load (%s)", async (presentation) => {
    const pending = defer();
    let signal;
    mockApi({ "get-match-draft": (body, options) => {
      if (body.matchId === "match-1") { signal = options.signal; return pending.promise; }
      return Promise.resolve({ draft: null, canEdit: true, opponents: [] });
    } });
    await mount({ presentation });
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
