import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import OpponentsWorkspace, { DraftSnapshot, SourceLink, SnapshotContext } from "../components/opponents/OpponentsWorkspace.jsx";
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
});

function text(node) { return node.children.map((child) => typeof child === "string" ? child : text(child)).join(""); }
function renderedText() { return text(renderer.root); }
function button(label) { return renderer.root.findAllByType("button").find((item) => text(item) === label); }
function field(label) {
  const wrapper = renderer.root.findAllByType("label").find((item) => item.findAllByType("span").some((span) => text(span) === label));
  return wrapper.find((item) => ["input", "select", "textarea"].includes(item.type));
}
function actions(action) { return apiFetch.mock.calls.map(([path, options]) => ({ path, ...JSON.parse(options.body) })).filter((call) => call.action === action); }
function change(label, value) { act(() => field(label).props.onChange({ target: { value } })); }
async function click(label) { await act(async () => { await button(label).props.onClick?.(); }); }
async function submit(label) {
  let form = button(label);
  while (form.type !== "form") form = form.parent;
  await act(async () => { await form.props.onSubmit({ preventDefault() {} }); });
}
async function mount(overrides = {}) {
  props = { selectedTeamId: "team-1", user: { id: "staff" }, ...overrides };
  await act(async () => { renderer = TestRenderer.create(<OpponentsWorkspace {...props} />); });
}
async function update(overrides) {
  props = { ...props, ...overrides };
  await act(async () => { renderer.update(<OpponentsWorkspace {...props} />); });
}
function defer() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
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

  it("has no Drafter import or draft-management controls, including for staff", async () => {
    mockApi({ list: { ...list, drafts: [storedDraft] } }); await mount(); await click("OPIF");
    expect(renderedText()).not.toContain("Importer depuis Drafter");
    expect(renderer.root.findAllByType("input").some((item) => item.props.type === "url")).toBe(false);
    expect(button("Lire la draft")).toBeUndefined(); expect(button("Enregistrer la draft")).toBeUndefined();
    expect(renderedText()).toContain("Aucune partie rattachée");
    expect(renderer.root.findAllByType("details")).toHaveLength(0);
    expect(actions("preview")).toHaveLength(0); expect(actions("save-draft")).toHaveLength(0);
  });

  it("creates a persistent opponent with notes and selects its empty dossier", async () => {
    mockApi({ list: { ...list, opponents: [] }, "create-opponent": { opponent } }); await mount();
    await click("Ajouter un adversaire"); change("Nom de l’adversaire", "  OPIF  "); change("Notes du staff (facultatif)", " Préparer le prochain BO. ");
    await submit("Créer la fiche");
    expect(actions("create-opponent")[0]).toMatchObject({ teamId: "team-1", name: "OPIF", notes: "Préparer le prochain BO." });
    expect(renderedText()).toContain("Fiche adversaire créée."); expect(renderedText()).toContain(opponent.notes);
    expect(renderedText()).toContain("0 parties rattachées");
  });

  it("shows games and played champions without any linked draft", async () => {
    mockApi({ list: { ...list, opponentMatches: [played], canEdit: false } }); await mount(); await click("OPIF");
    expect(button("Ajouter un adversaire")).toBeUndefined(); expect(renderedText()).toContain("Lecture seule");
    expect(renderedText()).toContain("1 partie rattachée"); expect(renderedText()).toContain("Scrim OPIF");
    expect(renderedText()).toContain("Jinx1 / 1"); expect(renderedText()).toContain("Résultat de notre équipe : Victoire");
    expect(renderer.root.findAllByType("a").some((item) => item.props.href === "/games?match=match-1")).toBe(true);
    expect(renderer.root.findByType("time").props.dateTime).toBe(played.date.replace("Z", ".000Z"));
  });

  it("prefers played champions over linked picks and excludes unlinked draft bans", async () => {
    const unlinked = { ...storedDraft, id: "unlinked", matchId: null, snapshot: { ...snapshot, redBans: ["Lux", "Ahri", "Zed", "Shen", "Sion"] } };
    mockApi({ list: { ...list, opponentMatches: [played], drafts: [storedDraft, unlinked] } }); await mount(); await click("OPIF");
    expect(renderedText()).toContain("Jinx1 / 1"); expect(renderedText()).not.toContain("Yunara"); expect(renderedText()).not.toContain("Lux");
    expect(renderedText()).not.toContain("Picks de draft en complément");
    const bans = renderer.root.findAllByType("section").find((node) => node.props.className === "opponents-frequency" && text(node).startsWith("Bans"));
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
    await click("Actualiser"); expect(renderedText()).toContain("2 parties rattachées"); expect(renderedText()).toContain("Jinx2 / 2");
    expect(button("OPIF").props["aria-pressed"]).toBe(true); expect(actions("list")).toHaveLength(2);
  });

  it("clears a removed selection after refresh", async () => {
    let calls = 0; mockApi({ list: () => Promise.resolve(++calls === 1 ? list : { ...list, opponents: [] }) });
    await mount(); await click("OPIF"); await click("Actualiser");
    expect(renderedText()).not.toContain("OPIF"); expect(renderedText()).toContain("Un dossier pour chaque adversaire");
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
