import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import OpponentsWorkspace, { DraftSnapshot, SourceLink, SnapshotContext } from "../components/opponents/OpponentsWorkspace.jsx";
import DraftBoard from "../components/draft/DraftBoard.jsx";
import { loadLanguageMessages, t } from "../i18n/translate.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../pages/workspace/workspace-shared.jsx", () => ({
  ChampionPortrait: ({ champion }) => <img alt={champion} />,
  championDisplayName: (champion) => ({ MonkeyKing: "Wukong" }[champion] || champion),
}));

const opponent = { id: "opif", name: "OPIF", notes: "Préparer le prochain BO.", createdAt: "2026-10-12T12:00:00Z" };
const snapshot = {
  source: "drafter.lol", sourceId: "IiYYZGok", gameNumber: 2, sourceUrl: "https://drafter.lol/draft/IiYYZGok?game=2",
  blueName: "Arcane Horizon", redName: "OPIF", bluePicks: ["Aatrox", "Zeri", "Braum", "DrMundo", "Ahri"],
  redPicks: ["Yunara", "Lulu", "Anivia", "Kennen", "Maokai"], blueBans: ["Jhin", "Khazix", "JarvanIV", "Gnar", "Sylas"],
  redBans: ["MonkeyKing", "Poppy", "Thresh", null, "Diana"], status: "completed", fearless: true, ironman: false, warnings: [],
};
const storedDraft = { id: "draft-1", matchId: "match-1", opponentId: opponent.id, allySide: "blue", sourceId: snapshot.sourceId, gameNumber: 2, snapshot };
const played = { id: "match-1", gameId: "EUW1_42", opponentId: opponent.id, label: "Scrim OPIF", date: "2026-10-12T12:00:00Z", result: "Victoire", enemyPicks: ["Gnar", "Viego", "Orianna", "Jinx", "Nami"], enemyPicksComplete: true };
const list = { opponents: [opponent], opponentMatches: [], drafts: [], canEdit: true };
let renderer;
let props;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.resetAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function text(node) { return node.children.map((child) => typeof child === "string" ? child : text(child)).join(""); }
function renderedText() { return text(renderer.root); }
function button(label) { return renderer.root.findAllByType("button").find((item) => item.props["aria-label"] === label || text(item) === label); }
function tab(label) { return renderer.root.findAllByProps({ role: "tab" }).find((item) => item.findAllByType("span").some((span) => text(span) === label)); }
function directoryNames() { return renderer.root.findAllByProps({ className: "opponent-directory-card" }).map((item) => item.props["aria-label"]); }
function dossierName() { return text(renderer.root.findByProps({ className: "opponent-dossier-heading" }).findByType("h2")); }
function metric(label) { return renderer.root.findAllByType("dt").find((item) => text(item) === label).parent; }
function field(label) {
  const wrapper = renderer.root.findAllByType("label").find((item) => item.findAllByType("span").some((span) => text(span) === label));
  return wrapper.find((item) => ["input", "select", "textarea"].includes(item.type));
}
function actions(action) { return apiFetch.mock.calls.map(([path, options]) => ({ path, ...JSON.parse(options.body) })).filter((call) => call.action === action); }
function change(label, value) { act(() => field(label).props.onChange({ target: { value } })); }
async function click(label) { await act(async () => { await button(label).props.onClick?.(); }); }
async function selectTab(label) { await act(async () => { tab(label).props.onClick(); }); }
async function submit(label) {
  let form = button(label);
  while (form.type !== "form") form = form.parent;
  await act(async () => { await form.props.onSubmit({ preventDefault() {} }); });
}
async function mount(overrides = {}, options = {}) {
  props = { selectedTeamId: "team-1", user: { id: "staff" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<OpponentsWorkspace {...props} />, options); });
}
async function update(overrides) {
  props = { ...props, ...overrides };
  await act(async () => { renderer.update(<OpponentsWorkspace {...props} />); });
}
function defer() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function browserEvents() {
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = "visible";
  Object.defineProperty(document, "hidden", { get: () => document.visibilityState !== "visible" });
  vi.spyOn(window, "removeEventListener");
  vi.spyOn(document, "removeEventListener");
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  return { window, document };
}
function mockApi(overrides = {}) {
  apiFetch.mockImplementation((_path, options) => {
    const body = JSON.parse(options.body);
    const response = overrides[body.action];
    if (response) return typeof response === "function" ? response(body, options) : Promise.resolve(response);
    if (body.action === "list") return Promise.resolve(list);
    if (body.action === "preview") return Promise.resolve({ snapshot, previewToken: "verified-token" });
    if (body.action === "save-draft") return Promise.resolve({ draft: storedDraft });
    throw new Error(`Unexpected action: ${body.action}`);
  });
}
describe("opponent game dossiers", () => {
  it("does not load without a selected team", async () => {
    await mount({ selectedTeamId: null });
    expect(apiFetch).not.toHaveBeenCalled(); expect(renderedText()).toContain("Choisis une équipe");
  });

  it("reports an unknown total before loading and a real zero for an empty directory", async () => {
    const pending = defer(); const onCountChange = vi.fn();
    mockApi({ list: () => pending.promise }); await mount({ onCountChange });
    expect(onCountChange).toHaveBeenLastCalledWith(null);
    expect(onCountChange).not.toHaveBeenCalledWith(0);
    await act(async () => pending.resolve({ ...list, opponents: [] }));
    expect(onCountChange).toHaveBeenLastCalledWith(0);
  });

  it("reports the full collection count independently of directory search, sorting and selection", async () => {
    const onCountChange = vi.fn();
    mockApi({ list: { ...list, opponents: [opponent, { id: "second", name: "Boréale" }] } });
    await mount({ onCountChange });
    expect(onCountChange).toHaveBeenLastCalledWith(2); onCountChange.mockClear();
    change("Rechercher une équipe", "OPIF"); change("Tri des équipes", "name");
    expect(directoryNames()).toEqual(["OPIF"]);
    await click("OPIF"); await click("Toutes les équipes");
    change("Rechercher une équipe", "aucun résultat");
    expect(directoryNames()).toHaveLength(0);
    expect(onCountChange).not.toHaveBeenCalled();
  });

  it("does not inflate the count when creating a name that resolves to an existing profile", async () => {
    const onCountChange = vi.fn(); const refresh = defer(); let calls = 0;
    const payload = { ...list, opponents: [opponent, { id: "second", name: "Boréale" }] };
    mockApi({ list: () => ++calls === 1 ? Promise.resolve(payload) : refresh.promise, "create-opponent": { opponent: { ...opponent, notes: "Profil existant" } } });
    await mount({ onCountChange }); expect(onCountChange).toHaveBeenLastCalledWith(2);
    await click("Ajouter un adversaire"); change("Nom de l’adversaire", "OPIF"); await submit("Créer la fiche");
    expect(dossierName()).toBe("OPIF"); expect(onCountChange).toHaveBeenLastCalledWith(2);
    expect(onCountChange).not.toHaveBeenCalledWith(3);
    await act(async () => refresh.resolve(payload));
    await click("Toutes les équipes"); expect(directoryNames()).toHaveLength(2);
    expect(onCountChange).toHaveBeenLastCalledWith(2);
  });

  it("has no Drafter import or draft-management controls, including for staff", async () => {
    mockApi({ list: { ...list, drafts: [storedDraft] } }); await mount(); await click("OPIF");
    expect(renderedText()).not.toContain("Importer depuis Drafter");
    expect(renderer.root.findAllByType("input").some((item) => item.props.type === "url")).toBe(false);
    expect(button("Lire la draft")).toBeUndefined(); expect(button("Enregistrer la draft")).toBeUndefined();
    expect(renderedText()).toContain("Aucune partie rattachée");
    await selectTab("Drafts");
    expect(renderedText()).toContain("Aucune draft liée pour le moment");
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(0);
    expect(actions("preview")).toHaveLength(0); expect(actions("save-draft")).toHaveLength(0);
  });

  it("creates a persistent opponent with notes and selects its empty dossier", async () => {
    let lists = 0; const onCountChange = vi.fn();
    mockApi({ list: () => Promise.resolve(++lists === 1 ? { ...list, opponents: [] } : list), "create-opponent": { opponent } }); await mount({ onCountChange });
    expect(onCountChange).toHaveBeenLastCalledWith(0);
    await click("Ajouter un adversaire"); change("Nom de l’adversaire", "  OPIF  "); change("Notes du staff (facultatif)", " Préparer le prochain BO. ");
    await submit("Créer la fiche");
    expect(actions("create-opponent")[0]).toMatchObject({ teamId: "team-1", name: "OPIF", notes: "Préparer le prochain BO." });
    expect(renderedText()).toContain("Fiche adversaire créée."); expect(renderedText()).toContain(opponent.notes);
    expect(renderedText()).toContain("0 parties rattachées");
    expect(onCountChange).toHaveBeenLastCalledWith(1);
  });

  it("shows games and played champions without any linked draft", async () => {
    mockApi({ list: { ...list, opponentMatches: [played], canEdit: false } }); await mount();
    expect(button("Ajouter un adversaire")).toBeUndefined();
    await click("OPIF");
    expect(button("Ajouter un adversaire")).toBeUndefined(); expect(renderedText()).toContain("Lecture seule");
    expect(renderedText()).toContain("1 partie rattachée"); expect(renderedText()).toContain("Scrim OPIF");
    expect(renderedText()).toContain("Jinx1 / 1"); expect(renderedText()).toContain("Les résultats ci-dessous sont ceux de notre équipe.");
    expect(text(renderer.root.findByProps({ "data-result": "win" }))).toBe("Victoire");
    expect(renderer.root.findAllByType("a").some((item) => item.props.href === "/games?match=match-1")).toBe(true);
    expect(renderer.root.findAllByType("time").some((item) => item.props.dateTime === played.date.replace("Z", ".000Z"))).toBe(true);
  });

  it("prefers played champions over linked picks and excludes unlinked draft bans", async () => {
    const unlinked = { ...storedDraft, id: "unlinked", matchId: null, snapshot: { ...snapshot, redBans: ["Lux", "Ahri", "Zed", "Shen", "Sion"] } };
    mockApi({ list: { ...list, opponentMatches: [played], drafts: [storedDraft, unlinked] } }); await mount(); await click("OPIF");
    expect(renderedText()).toContain("Jinx1 / 1"); expect(renderedText()).not.toContain("Yunara"); expect(renderedText()).not.toContain("Lux");
    expect(renderedText()).not.toContain("Picks de draft en complément");
    const bans = renderer.root.findAllByType("section").find((node) => node.props.className === "opponents-frequency" && text(node).startsWith("Leurs bans contre nous"));
    expect(text(bans)).toContain("0 parties exploitables sur 1"); expect(text(bans)).not.toContain("Diana");
  });

  it("labels linked draft fallback as picks, not confirmed played champions", async () => {
    mockApi({ list: { ...list, opponentMatches: [{ ...played, enemyPicks: ["Jinx"], enemyPicksComplete: false }], drafts: [storedDraft] } });
    await mount(); await click("OPIF");
    expect(renderedText()).toContain("Picks de draft en complément"); expect(renderedText()).toContain("Picks de la draft liée · champions joués non confirmés");
    expect(renderedText()).toContain("Yunara1 / 1"); expect(renderedText()).not.toContain("Jinx1 / 1");
  });

  it("deduplicates a game and preserves the dossier when refreshing new associations", async () => {
    let calls = 0;
    mockApi({ list: () => Promise.resolve(++calls === 1 ? { ...list, opponentMatches: [played, { ...played, id: "duplicate" }] } : { ...list, opponentMatches: [played, { ...played, id: "match-2", gameId: "EUW1_43" }] }) });
    await mount(); await click("OPIF"); expect(renderedText()).toContain("1 partie rattachée"); expect(renderedText()).toContain("Jinx1 / 1");
    await update({ refreshRevision: 1 }); expect(renderedText()).toContain("2 parties rattachées"); expect(renderedText()).toContain("Jinx2 / 2");
    expect(dossierName()).toBe("OPIF"); expect(button("Toutes les équipes")).toBeDefined();
    expect(actions("list")).toHaveLength(2);
  });

  it("clears a removed selection after refresh", async () => {
    let calls = 0; mockApi({ list: () => Promise.resolve(++calls === 1 ? list : { ...list, opponents: [] }) });
    await mount(); await click("OPIF"); await update({ refreshRevision: 1 });
    expect(renderedText()).not.toContain("OPIF"); expect(renderedText()).toContain("Un dossier pour chaque adversaire");
  });

  it("keeps the dossier, active game filter and directory settings while a revision reloads", async () => {
    const pending = defer(); let calls = 0;
    const loss = { ...played, id: "lost", gameId: "EUW1_43", label: "Défaite précédente", result: "Défaite" };
    const payload = { ...list, opponentMatches: [played, loss] };
    mockApi({ list: () => ++calls === 1 ? Promise.resolve(payload) : pending.promise });
    await mount();
    expect(button("Actualiser")).toBeUndefined();
    change("Rechercher une équipe", "  opif  "); change("Tri des équipes", "name");
    await click("OPIF"); await selectTab("Parties"); change("Résultat de notre équipe", "0");
    const panel = renderer.root.findByProps({ role: "tabpanel" });
    await update({ refreshRevision: 1 });
    expect(dossierName()).toBe("OPIF"); expect(tab("Parties").props["aria-selected"]).toBe(true);
    expect(field("Résultat de notre équipe").props.value).toBe("0");
    expect(renderedText()).toContain("Défaite précédente"); expect(renderedText()).not.toContain("Chargement des adversaires…");
    expect(renderer.root.findByProps({ role: "tabpanel" })).toBe(panel);
    await act(async () => pending.resolve({ ...payload, opponentMatches: [...payload.opponentMatches, { ...loss, id: "new-loss", gameId: "EUW1_44", label: "Nouvelle défaite" }] }));
    expect(renderedText()).toContain("Nouvelle défaite"); expect(renderedText()).not.toContain("Scrim OPIF");
    expect(field("Résultat de notre équipe").props.value).toBe("0");
    await click("Toutes les équipes");
    expect(field("Rechercher une équipe").props.value).toBe("  opif  ");
    expect(field("Tri des équipes").props.value).toBe("name");
    expect(actions("list")).toHaveLength(2);
  });

  it("preserves the selected draft replay and focus when unchanged snapshots arrive as new objects", async () => {
    const pending = defer(); let calls = 0;
    const draft = { ...storedDraft, snapshot: { ...snapshot, firstPick: "blue", orderEvidence: { version: 1, basis: "reconstructed-public-slots", format: "standard-20", firstPick: "blue", reason: "public-slot-fields-v1" } } };
    const payload = { ...list, opponentMatches: [played], drafts: [draft] };
    const focus = vi.fn(), scrollIntoView = vi.fn();
    mockApi({ list: () => ++calls === 1 ? Promise.resolve(payload) : pending.promise });
    await mount({}, { createNodeMock: () => ({ focus, scrollIntoView }) });
    await click("OPIF"); await selectTab("Drafts"); await click("Revoir la draft de Scrim OPIF");
    await click("Revoir depuis le début"); await click("Étape suivante");
    const board = renderer.root.findByType(DraftBoard);
    const range = () => renderer.root.findByProps({ type: "range" });
    expect(range().props.value).toBe(1);
    focus.mockClear(); scrollIntoView.mockClear();
    await update({ refreshRevision: 1 });
    expect(range().props.value).toBe(1); expect(tab("Drafts").props["aria-selected"]).toBe(true);
    await act(async () => pending.resolve(structuredClone(payload)));
    expect(renderer.root.findByType(DraftBoard)).toBe(board); expect(range().props.value).toBe(1);
    expect(focus).not.toHaveBeenCalled(); expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("aborts superseded revisions and never restores an opponent deleted by a newer response", async () => {
    const older = defer(), latest = defer(); let calls = 0; const signals = [];
    mockApi({ list: (_body, options) => { signals.push(options.signal); return ++calls === 1 ? Promise.resolve(list) : calls === 2 ? older.promise : latest.promise; } });
    await mount(); await click("OPIF");
    await update({ refreshRevision: 1 }); await update({ refreshRevision: 2 });
    expect(signals[1].aborted).toBe(true); expect(signals[2].aborted).toBe(false);
    await act(async () => latest.resolve({ ...list, opponents: [] }));
    expect(renderedText()).toContain("Un dossier pour chaque adversaire");
    await act(async () => older.resolve({ ...list, opponentMatches: [played] }));
    expect(renderedText()).not.toContain("OPIF"); expect(renderedText()).not.toContain("Scrim OPIF");
    expect(renderer.root.findAllByProps({ role: "tabpanel" })).toHaveLength(0);
  });

  it("keeps available data after a background error and retries without resetting the dossier", async () => {
    let calls = 0;
    mockApi({ list: () => ++calls === 2 ? Promise.reject(Object.assign(new Error("Actualisation indisponible."), { status: 503 })) : Promise.resolve({ ...list, opponentMatches: [played] }) });
    await mount(); await click("OPIF"); await selectTab("Parties");
    await update({ refreshRevision: 1 });
    expect(dossierName()).toBe("OPIF"); expect(renderedText()).toContain("Scrim OPIF");
    expect(tab("Parties").props["aria-selected"]).toBe(true);
    expect(renderer.root.findAllByProps({ role: "alert" }).some((node) => text(node).includes("Actualisation indisponible."))).toBe(true);
    await click("Réessayer");
    expect(dossierName()).toBe("OPIF"); expect(tab("Parties").props["aria-selected"]).toBe(true);
    expect(renderedText()).not.toContain("Actualisation indisponible."); expect(actions("list")).toHaveLength(3);
  });

  it.each([401, 403])("hides previously loaded private data after background access failure %s", async (status) => {
    let calls = 0; const onCountChange = vi.fn();
    mockApi({ list: () => ++calls === 1 ? Promise.resolve({ ...list, opponentMatches: [played], drafts: [storedDraft] }) : Promise.reject(Object.assign(new Error("Accès retiré."), { status })) });
    await mount({ onCountChange }); await click("OPIF"); await selectTab("Drafts"); await click("Revoir la draft de Scrim OPIF");
    expect(onCountChange).toHaveBeenLastCalledWith(1);
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(1);
    await update({ refreshRevision: 1 });
    expect(renderedText()).toContain("Accès retiré."); expect(renderedText()).not.toContain("OPIF");
    expect(renderedText()).not.toContain("Scrim OPIF"); expect(renderedText()).not.toContain(opponent.notes);
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ role: "tabpanel" })).toHaveLength(0);
    expect(onCountChange).toHaveBeenLastCalledWith(null);
  });

  it("revalidates visible pages every 30 seconds and on return without duplicate requests, then cleans up", async () => {
    vi.useFakeTimers();
    const { window, document } = browserEvents();
    const pending = defer(), last = defer(); let calls = 0; let lastSignal;
    mockApi({ list: (_body, options) => {
      calls += 1;
      if (calls === 2) return pending.promise;
      if (calls === 4) { lastSignal = options.signal; return last.promise; }
      return Promise.resolve(list);
    } });
    await mount(); expect(actions("list")).toHaveLength(1);
    document.visibilityState = "hidden";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(60_000); });
    expect(actions("list")).toHaveLength(1);
    document.visibilityState = "visible";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    expect(actions("list")).toHaveLength(2);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(actions("list")).toHaveLength(2);
    await act(async () => pending.resolve(list));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(actions("list")).toHaveLength(3);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(actions("list")).toHaveLength(4);
    act(() => renderer.unmount()); renderer = undefined;
    expect(lastSignal.aborted).toBe(true);
    expect(window.removeEventListener.mock.calls.some(([event]) => event === "focus")).toBe(true);
    expect(document.removeEventListener.mock.calls.some(([event]) => event === "visibilitychange")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { last.resolve(list); window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(60_000); });
    expect(actions("list")).toHaveLength(4);
  });

  it("aborts a pre-creation read and reloads the created dossier without accepting its stale response", async () => {
    const stale = defer(), creation = defer(), refreshed = defer(); let calls = 0; let readSignal;
    mockApi({ list: (_body, options) => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ ...list, opponents: [] });
      if (calls === 2) { readSignal = options.signal; return stale.promise; }
      return refreshed.promise;
    }, "create-opponent": () => creation.promise });
    await mount(); await click("Ajouter un adversaire"); change("Nom de l’adversaire", "OPIF");
    await update({ refreshRevision: 1 });
    let work; act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(readSignal.aborted).toBe(true);
    await act(async () => { creation.resolve({ opponent }); await work; });
    expect(dossierName()).toBe("OPIF"); expect(actions("list")).toHaveLength(3);
    await act(async () => refreshed.resolve({ ...list, opponentMatches: [played] }));
    expect(renderedText()).toContain("1 partie rattachée");
    await act(async () => stale.resolve({ ...list, opponents: [] }));
    expect(dossierName()).toBe("OPIF"); expect(renderedText()).toContain("Scrim OPIF");
  });

  it("opens an opponent from a group link and lists all its groups without counting games twice", async () => {
    mockApi({ list: { ...list, opponentMatches: [played], opponentGroups: [
      { id: "scrim-1", name: "OPIF session du matin", opponentId: "opif", matchIds: [played.id] },
      { id: "scrim-2", name: "OPIF session du soir", opponentId: "opif", matchIds: [played.id] },
      { id: "other", name: "Autre équipe", opponentId: "other", matchIds: [] },
    ] } });
    await mount({ opponentId: "opif" });
    expect(renderedText()).not.toContain("Groupes contre cet adversaire");
    await selectTab("Parties");
    expect(renderedText()).toContain("Groupes contre cet adversaire");
    expect(renderedText()).toContain("OPIF session du matin");
    expect(renderedText()).toContain("OPIF session du soir");
    expect(renderedText()).not.toContain("Autre équipe");
    expect(renderedText()).toContain("1 partie rattachée");
    expect(renderer.root.findByProps({ className: "opponent-groups" }).props.open).toBeFalsy();
    const links = renderer.root.findAllByType("a").filter((node) => text(node) === "Ouvrir le groupe");
    expect(links.map((node) => node.props.href)).toEqual(["/games?view=groups&archive=scrim-1&team=team-1", "/games?view=groups&archive=scrim-2&team=team-1"]);
  });

  it("follows a changed opponent route and displays linked empty groups", async () => {
    mockApi({ list: { ...list, opponents: [opponent, { id: "second", name: "Deuxième adversaire" }], opponentGroups: [{ id: "empty", name: "Prochain scrim", opponentId: "second", matchIds: [] }] } });
    await mount({ opponentId: "opif" });
    await update({ opponentId: "second" });
    expect(dossierName()).toBe("Deuxième adversaire");
    expect(renderedText()).not.toContain("Prochain scrim");
    await selectTab("Parties");
    expect(renderedText()).toContain("Prochain scrim");
    expect(renderedText()).toContain("0 parties dans ce groupe");
    await click("Toutes les équipes"); await click("OPIF"); await update({ refreshRevision: 1 });
    expect(dossierName()).toBe("OPIF");
    await update({ opponentId: "missing" });
    expect(directoryNames()).toEqual(["Deuxième adversaire", "OPIF"]);
    expect(renderer.root.findAllByProps({ role: "tabpanel" })).toHaveLength(0);
  });

  it("searches every name word without accents and preserves search and sorting when returning", async () => {
    const boreal = { ...opponent, id: "boreal", name: "Équipe Boréale" };
    const academy = { id: "academy", name: "Boréale Académie", notes: "Équipe à surveiller" };
    mockApi({ list: { ...list, opponents: [opponent, boreal, academy], opponentMatches: [{ ...played, opponentId: boreal.id }] } });
    await mount();
    change("Tri des équipes", "name"); change("Rechercher une équipe", "  BOREALE equipe  ");
    expect(directoryNames()).toEqual(["Équipe Boréale"]);
    expect(renderedText()).toContain("1 équipe affichée sur 3");
    expect(text(button("Équipe Boréale"))).toContain("1 partie rattachée");
    await click("Équipe Boréale");
    expect(dossierName()).toBe("Équipe Boréale"); expect(directoryNames()).toHaveLength(0);
    expect(renderer.root.findAllByType("input")).toHaveLength(0);
    await click("Toutes les équipes");
    expect(field("Rechercher une équipe").props.value).toBe("  BOREALE equipe  ");
    expect(field("Tri des équipes").props.value).toBe("name");
    expect(directoryNames()).toEqual(["Équipe Boréale"]);
    change("Rechercher une équipe", "prochain BO");
    expect(directoryNames()).toHaveLength(0); expect(renderedText()).toContain("Aucune équipe trouvée");
    await click("Effacer la recherche");
    expect(directoryNames()).toEqual(["Boréale Académie", "Équipe Boréale", "OPIF"]);
  });

  it("sorts directory cards by latest game, name, or deduplicated game count", async () => {
    const alpha = { id: "alpha", name: "Alpha" }, beta = { id: "beta", name: "Beta" }, zenith = { id: "zenith", name: "Zénith" };
    const older = { ...played, opponentId: beta.id, date: "2026-10-10T12:00:00Z" };
    mockApi({ list: { ...list, opponents: [zenith, beta, alpha], opponentMatches: [
      older, { ...older, id: "duplicate" }, { ...older, id: "beta-2", gameId: "EUW1_43", date: "2026-10-11T12:00:00Z" },
      { ...played, id: "zenith-1", gameId: "EUW1_44", opponentId: zenith.id },
    ] } });
    await mount();
    expect(directoryNames()).toEqual(["Zénith", "Beta", "Alpha"]);
    change("Tri des équipes", "name"); expect(directoryNames()).toEqual(["Alpha", "Beta", "Zénith"]);
    change("Tri des équipes", "games"); expect(directoryNames()).toEqual(["Beta", "Zénith", "Alpha"]);
    expect(text(button("Beta"))).toContain("2 parties rattachées");
    expect(text(button("Alpha"))).toContain("Prête à accueillir vos premières parties");
  });

  it("keeps the overview concise and mounts only the active accessible tab panel", async () => {
    const matches = Array.from({ length: 4 }, (_, index) => ({ ...played, id: `match-${index}`, gameId: `EUW1_${index}`, label: `Rencontre ${index + 1}`, date: `2026-10-${String(9 + index).padStart(2, "0")}T12:00:00Z` }));
    mockApi({ list: { ...list, opponentMatches: matches } }); await mount(); await click("OPIF");
    expect(renderer.root.findAllByProps({ role: "tab" })).toHaveLength(3);
    expect(renderer.root.findByProps({ role: "tablist" }).props["aria-label"]).toBe("Contenu de la fiche adverse");
    expect(tab("Vue d’ensemble").props["aria-selected"]).toBe(true);
    expect(renderedText()).not.toContain("Rencontre 1");
    expect(renderer.root.findAllByProps({ className: "opponent-match-composition" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ className: "opponent-draft-library" })).toHaveLength(0);
    await click("Voir les 4 parties");
    expect(renderedText()).toContain("Rencontre 1");
    expect(renderer.root.findAllByProps({ className: "opponent-match-composition" })).toHaveLength(4);
    expect(renderer.root.findAllByProps({ className: "opponents-frequency" })).toHaveLength(0);
    expect(tab("Parties").props["aria-selected"]).toBe(true);
    let panel = renderer.root.findByProps({ role: "tabpanel" });
    expect(panel.props["aria-labelledby"]).toBe(tab("Parties").props.id);
    expect(tab("Parties").props["aria-controls"]).toBe(panel.props.id);
    const preventDefault = vi.fn();
    act(() => tab("Parties").props.onKeyDown({ key: "ArrowRight", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce(); expect(tab("Drafts").props["aria-selected"]).toBe(true);
    expect(tab("Drafts").props.tabIndex).toBe(0); expect(tab("Parties").props.tabIndex).toBe(-1);
    panel = renderer.root.findByProps({ role: "tabpanel" });
    expect(panel.props["aria-labelledby"]).toBe(tab("Drafts").props.id);
    expect(renderedText()).toContain("Aucune draft liée pour le moment");
    expect(renderedText()).not.toContain("Rencontre 4");
  });

  it("replays the latest linked draft for a deduplicated game with its exact snapshot and source", async () => {
    const latest = { ...storedDraft, id: "draft-latest", allySide: "red", importedAt: "2026-10-12T13:00:00Z", gameNumber: 3, snapshot: { ...snapshot, gameNumber: 3, sourceId: "Latest99", sourceUrl: "https://drafter.lol/draft/Latest99?game=3", firstPick: "red", orderEvidence: { version: 1, basis: "reconstructed-public-slots", format: "standard-20", firstPick: "red", reason: "public-slot-fields-v1" } } };
    const older = { ...storedDraft, id: "draft-older", matchId: "played-complete", importedAt: "2026-10-12T12:00:00Z" };
    const unlinked = { ...latest, id: "draft-unlinked", matchId: null, importedAt: "2026-10-12T14:00:00Z" };
    const foreign = { ...latest, id: "draft-foreign", opponentId: "other", importedAt: "2026-10-12T15:00:00Z" };
    mockApi({ list: { ...list, opponentMatches: [{ ...played, enemyPicks: [], enemyPicksComplete: false }, { ...played, id: "played-complete", label: "Partie importée complète" }], drafts: [older, latest, unlinked, foreign] } });
    await mount();
    expect(text(button("OPIF"))).toContain("1 draft liée");
    await click("OPIF");
    expect(text(metric("Drafts liées").findByType("dd"))).toBe("1");
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(0);
    await selectTab("Drafts");
    expect(renderer.root.findAllByType("button").filter((item) => item.props["aria-label"]?.startsWith("Revoir la draft de "))).toHaveLength(1);
    await click("Revoir la draft de Partie importée complète");
    const board = renderer.root.findByType(DraftBoard);
    expect(board.props.snapshot).toBe(latest.snapshot); expect(board.props.allySide).toBe("red");
    expect(renderer.root.findByProps({ rel: "noopener noreferrer" }).props.href).toBe(latest.snapshot.sourceUrl);
    expect(renderer.root.findAllByType("a").filter((item) => text(item) === "Ouvrir la partie").map((item) => item.props.href)).toEqual(["/games?match=played-complete"]);
    await click("Retour aux drafts");
    expect(renderer.root.findAllByType(DraftBoard)).toHaveLength(0);
    expect(button("Revoir la draft de Partie importée complète")).toBeDefined();
    expect(actions("preview")).toHaveLength(0); expect(actions("save-draft")).toHaveLength(0);
  });

  it("separates unknown results from losses in the record and game filters", async () => {
    mockApi({ list: { ...list, opponentMatches: [played,
      { ...played, id: "lost", gameId: "EUW1_43", label: "Partie perdue", result: "Défaite" },
      { ...played, id: "unknown", gameId: "EUW1_44", label: "Partie sans résultat", result: null },
    ] } });
    await mount(); await click("OPIF");
    const record = metric("Notre bilan contre eux");
    expect(text(record.findByType("dd"))).toBe("1 / 1"); expect(text(record)).toContain("1 résultat inconnu");
    await selectTab("Parties");
    change("Résultat de notre équipe", "0");
    expect(renderedText()).toContain("Partie perdue"); expect(renderedText()).not.toContain("Partie sans résultat");
    expect(renderedText()).not.toContain("Scrim OPIF");
    change("Résultat de notre équipe", "null");
    expect(renderedText()).toContain("Partie sans résultat"); expect(renderedText()).not.toContain("Partie perdue");
    expect(renderer.root.findAllByProps({ "data-result": "loss" })).toHaveLength(0);
    expect(text(renderer.root.findByProps({ "data-result": "unknown" }))).toBe("Résultat inconnu");
  });

  it("leaves the record unavailable when every game result is unknown", async () => {
    mockApi({ list: { ...list, opponentMatches: [{ ...played, result: "" }] } }); await mount(); await click("OPIF");
    const record = metric("Notre bilan contre eux");
    expect(text(record.findByType("dd"))).toBe("—"); expect(text(record)).toContain("1 résultat inconnu");
    expect(renderer.root.findAllByProps({ "data-result": "win" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-result": "loss" })).toHaveLength(0);
  });

  it("ignores a late list from the previous team and retries the current list", async () => {
    const pending = defer(); let currentCalls = 0; let signal;
    mockApi({ list: (body, options) => body.teamId === "team-1" ? (signal = options.signal, pending.promise) : ++currentCalls === 1 ? Promise.reject(new Error("Chargement interrompu.")) : Promise.resolve({ ...list, opponents: [] }) });
    await mount(); await update({ selectedTeamId: "team-2" }); expect(signal.aborted).toBe(true);
    expect(renderedText()).toContain("Chargement interrompu."); await click("Réessayer");
    await act(async () => pending.resolve({ ...list, opponentMatches: [played] }));
    expect(renderedText()).not.toContain("OPIF"); expect(renderedText()).not.toContain("Scrim OPIF");
    expect(actions("list").map((call) => call.teamId)).toEqual(["team-1", "team-2", "team-2"]);
  });

  it("aborts a pending creation on team change without injecting its private response", async () => {
    const pending = defer(); let signal;
    mockApi({ list: body => Promise.resolve({ ...list, opponents: body.teamId === "team-1" ? [opponent] : [] }), "create-opponent": (_body, options) => { signal = options.signal; return pending.promise; } });
    await mount(); await click("Ajouter un adversaire"); change("Nom de l’adversaire", "OPIF");
    let work; act(() => { work = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    await update({ selectedTeamId: "team-2" }); expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ opponent }); await work; });
    expect(renderedText()).not.toContain("OPIF"); expect(renderedText()).not.toContain("Fiche adversaire créée.");
  });

  it("preserves shared draft presentation exports for the Drafter workspace", async () => {
    await act(async () => { renderer = TestRenderer.create(<><SourceLink snapshot={snapshot} /><DraftSnapshot snapshot={snapshot} allySide="blue" /><SnapshotContext snapshot={{ ...snapshot, patch: "26.20", warnings: ["Un ban est indisponible."] }} importedAt="2026-10-12T12:00:00Z" /></>); });
    expect(renderedText()).toContain("Wukong"); expect(renderedText()).toContain("Un ban est indisponible."); expect(renderedText()).toContain("Patch 26.20");
    expect(renderer.root.findByProps({ rel: "noopener noreferrer" }).props.href).toBe(snapshot.sourceUrl);
  });

  it("distinguishes an explicitly skipped ban from a missing ban in shared draft snapshots", async () => {
    const value = { ...snapshot, blueBans: [null, ...snapshot.blueBans.slice(1)], banStates: { blue: ["skipped", "selected", "selected", "selected", "selected"] } };
    await act(async () => { renderer = TestRenderer.create(<DraftSnapshot snapshot={value} allySide="blue" />); });
    const camps = renderer.root.findAllByType("section");
    expect(text(camps.find((node) => node.props["data-side"] === "blue"))).toContain("Ban non utilisé");
    expect(text(camps.find((node) => node.props["data-side"] === "blue"))).not.toContain("Non renseigné");
    expect(text(camps.find((node) => node.props["data-side"] === "red"))).toContain("Non renseigné");
    expect(text(camps.find((node) => node.props["data-side"] === "red"))).not.toContain("Ban non utilisé");
  });

  it.each(["en", "es"])("retains translations of source warnings in %s", async (language) => {
    await loadLanguageMessages(language);
    const missing = "Bans rouges indisponibles : 2, 4. Les fréquences de bans doivent tenir compte de cette couverture.";
    expect(t(missing, undefined, language)).not.toBe(missing); expect(t(missing, undefined, language)).toContain("2, 4");
  });
});
