import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import DrafterAnalysis, { DraftChronology } from "../components/trends/DrafterAnalysis.jsx";
import { readTrendsRoute, trendsPath } from "../app/trends-navigation.js";
import { setLanguage } from "../i18n/locale.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../pages/workspace/workspace-shared.jsx", () => ({
  ChampionPortrait: ({ champion }) => <img alt={champion} />,
  championDisplayName: (champion) => champion,
}));

const snapshot = {
  source: "drafter.lol", status: "completed", sourceId: "series01", sourceDraftId: "draft001", gameNumber: 2,
  sourceUrl: "https://drafter.lol/draft/series01?game=2", blueName: "NXT5", redName: "OPIF", firstPick: "blue",
  bluePicks: ["Aatrox", "Zeri", "Braum", "DrMundo", "Ahri"], redPicks: ["Yunara", "Lulu", "Anivia", "Kennen", "Maokai"],
  blueBans: ["Jhin", "Khazix", "JarvanIV", "Gnar", "Sylas"], redBans: ["MonkeyKing", "Poppy", "Thresh", "Syndra", "Diana"],
  orderEvidence: { version: 1, basis: "reconstructed-public-slots", format: "standard-20", firstPick: "blue", reason: "public-slot-fields-v1" }, warnings: [],
};
const row = { id: "d1", sourceId: "series01", gameNumber: 2, opponentId: "opif", matchId: "m1", allySide: "blue", snapshot };
const payload = { opponents: [{ id: "opif", name: "OPIF" }, { id: "other", name: "Autre équipe" }], drafts: [row] };
function anotherDraft(id, changes = {}, snapshotChanges = {}) {
  return { ...row, id, sourceId: `series-${id}`, matchId: `match-${id}`, ...changes,
    snapshot: { ...snapshot, sourceId: `series-${id}`, sourceDraftId: `source-${id}`,
      sourceUrl: `https://drafter.lol/draft/series-${id}?game=2`, ...snapshotChanges } };
}
let renderer;
function content(node) { return node.children.map((child) => typeof child === "string" ? child : content(child)).join(""); }
function text() { return content(renderer.root); }
async function mount(props = {}) { await act(async () => { renderer = TestRenderer.create(<DrafterAnalysis teamId="team1" {...props} />); }); }
function field(label) {
  const field = renderer.root.findAllByType("label").find((node) => node.findAllByType("span").some((child) => content(child) === label));
  expect(field, `Field “${label}” should be available`).toBeDefined();
  return field;
}
function choose(label, value) { act(() => field(label).findByType("select").props.onChange({ target: { value } })); }
function search(value, label = "Rechercher un champion banni") { act(() => field(label).findByType("input").props.onChange({ target: { value } })); }
function banButtons() { return renderer.root.findAllByType("button").filter((node) => node.props.className === "draft-ban-row"); }
function banNames() { return banButtons().map((node) => node.findAllByType("strong")[0].children.join("")); }
function selectBan(champion) {
  const button = renderer.root.findByProps({ "aria-label": `Analyser les bans de ${champion}` });
  act(() => button.props.onClick());
}
function banDetail() { return renderer.root.findByProps({ className: "draft-ban-detail" }); }
function sourceButtons(node = renderer.root) { return node.findAllByType("button").filter((button) => button.props.className === "draft-source-button"); }
function draftCount() {
  const metric = renderer.root.findByProps({ className: "drafter-metrics" }).findAllByType("div")
    .find((node) => node.findAllByType("dt").some((title) => content(title) === "Drafts analysées"));
  return content(metric.findByType("dd"));
}
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; setLanguage("fr", { persist: false }); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("Drafter analysis interface", () => {
  it("does not request data without a team", async () => {
    await mount({ teamId: "" }); expect(apiFetch).not.toHaveBeenCalled(); expect(text()).toContain("Choisis une équipe");
  });
  it("shows import guidance independently from played games", async () => {
    apiFetch.mockResolvedValue({ opponents: [], drafts: [] }); await mount();
    expect(text()).toContain("Les drafts importées commencent l’analyse");
    expect(renderer.root.findAllByType("button").some((button) => content(button) === "Ouvrir les parties")).toBe(true);
  });
  it("analyses the enemy by default and switches the selected camp", async () => {
    apiFetch.mockResolvedValue(payload); await mount();
    const frequencyText = () => renderer.root.findAllByType("section").filter((node) => node.props.className === "drafter-frequency").map(content);
    expect(frequencyText()[0]).toContain("Yunara"); expect(frequencyText()[0]).not.toContain("Aatrox");
    expect(frequencyText()[2]).toContain("0 drafts exploitables sur 1");
    choose("Bans à analyser", "ally");
    expect(frequencyText()[0]).toContain("Aatrox"); expect(frequencyText()[2]).toContain("Aatrox");
    expect(renderer.root.findAllByType("a").some((link) => link.props.href === "/games?match=m1")).toBe(true);
  });
  it("keeps a missing ban out of complete-ban statistics while preserving chronology", async () => {
    apiFetch.mockResolvedValue({ ...payload, drafts: [{ ...row, snapshot: { ...snapshot, redBans: ["MonkeyKing", "Poppy", "Thresh", null, "Diana"] } }] });
    await mount();
    const bans = renderer.root.findAllByType("section").filter((node) => node.props.className === "drafter-frequency")[1];
    expect(content(bans)).toContain("0 drafts exploitables sur 1");
    expect(content(bans)).not.toContain("Diana"); expect(text()).toContain("Non renseigné");
    expect(renderer.root.findAllByType("li").filter((node) => node.props["data-side"])).toHaveLength(20);
  });
  it("filters opponent and linked status without carrying an invisible draft", async () => {
    apiFetch.mockResolvedValue(payload); await mount();
    choose("Équipe adverse liée", "other"); expect(text()).toContain("Aucune draft dans cette sélection");
    expect(renderer.root.findAllByType("a").some((link) => link.props.href === snapshot.sourceUrl)).toBe(false);
    choose("Équipe adverse liée", ""); choose("Drafts incluses", "unlinked"); expect(text()).toContain("Aucune draft dans cette sélection");
    choose("Drafts incluses", "linked"); expect(text()).toContain("Ordre des picks et des bans");
  });
  it("analyses a game draft without requiring or inferring an opponent dossier", async () => {
    apiFetch.mockResolvedValue({ ...payload, drafts: [{ ...row, opponentId: null }] }); await mount();
    expect(text()).toContain("Aucune équipe adverse liée. Les noms ci-dessous sont ceux du Drafter.");
    choose("Équipe adverse liée", "opif"); expect(text()).toContain("Aucune draft dans cette sélection");
    choose("Équipe adverse liée", "unassigned"); expect(text()).toContain("Ordre des picks et des bans");
    expect(renderer.root.findAllByType("a").some((link) => link.props.href === "/games?match=m1")).toBe(true);
  });
  it("ignores a late response from the previous team", async () => {
    let resolveFirst;
    apiFetch.mockImplementation((_path, options) => JSON.parse(options.body).teamId === "team1" ? new Promise((resolve) => { resolveFirst = resolve; }) : Promise.resolve({ opponents: [], drafts: [] }));
    await mount();
    await act(async () => renderer.update(<DrafterAnalysis teamId="team2" />));
    await act(async () => resolveFirst(payload));
    expect(text()).toContain("Les drafts importées commencent l’analyse"); expect(text()).not.toContain("OPIF");
  });
  it("offers retry after a load failure", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Indisponible")).mockResolvedValueOnce(payload); await mount();
    expect(renderer.root.findByProps({ role: "alert" }).children).toContain("Indisponible");
    const retry = renderer.root.findAllByType("button").find((button) => content(button) === "Réessayer");
    await act(async () => retry.props.onClick()); expect(text()).toContain("Ordre des picks et des bans");
  });
  it("does not invent an order for a legacy snapshot", async () => {
    await act(async () => { renderer = TestRenderer.create(<DraftChronology snapshot={{ ...snapshot, orderEvidence: undefined }} allySide="blue" />); });
    expect(text()).toContain("Ordre de sélection indisponible"); expect(renderer.root.findAllByType("li")).toHaveLength(0);
  });
  it("distinguishes a skipped ban from an unknown ban", async () => {
    await act(async () => { renderer = TestRenderer.create(<DraftChronology snapshot={{ ...snapshot, blueBans: [null, ...snapshot.blueBans.slice(1)], banStates: { blue: ["skipped", "selected", "selected", "selected", "selected"] } }} allySide="blue" />); });
    expect(text()).toContain("Ban non utilisé"); expect(text()).not.toContain("Non renseigné");
  });
  it("filters bans by phase and champion and explains the picks revealed at that phase", async () => {
    apiFetch.mockResolvedValue(payload); await mount();
    choose("Phase des bans", "1");
    expect(banNames()).toEqual(["MonkeyKing", "Poppy", "Thresh"]);
    selectBan("Poppy");
    expect(content(banDetail())).toContain("En phase 1, aucun pick n’est encore révélé.");
    expect(content(banDetail())).toContain("Aucun pick n’était encore révélé au moment de ce ban.");
    choose("Phase des bans", "2");
    expect(banNames()).toEqual(["Diana", "Syndra"]);
    search("sYnDrA");
    expect(banNames()).toEqual(["Syndra"]);
    expect(content(banDetail())).toContain("En phase 2, chaque équipe a déjà montré trois picks.");
    expect(content(banDetail())).toContain("Picks déjà révélés par le camp concerné : Aatrox · Zeri · Braum.");
    expect(content(banDetail())).toContain("Ban n° 4 · phase 2");
    search("aucun champion");
    expect(banNames()).toEqual([]);
    expect(text()).toContain("Aucun ban ne correspond à ces filtres.");
    expect(renderer.root.findAllByProps({ className: "draft-ban-detail" })).toHaveLength(0);
    search("");
    expect(banNames()).toEqual(["Diana", "Syndra"]);
  });
  it("changes the interpretation when inspecting our bans instead of bans against us", async () => {
    apiFetch.mockResolvedValue(payload); await mount();
    selectBan("Poppy");
    expect(text()).toContain("Ce qu’on nous retire");
    expect(content(banDetail())).toContain("Qui peut être concerné ?");
    expect(content(banDetail())).toContain("Préparez un plan sans ce champion");
    choose("Bans à analyser", "ally");
    expect(text()).toContain("Ce que nous retirons à l’adversaire");
    expect(banNames()).toContain("Jhin"); expect(banNames()).not.toContain("Poppy");
    selectBan("Jhin");
    expect(content(banDetail())).toContain("Quels rôles adverses sont concernés ?");
    expect(content(banDetail())).toContain("Vérifiez si ce retrait répond aux priorités de cet adversaire");
    expect(content(banDetail())).not.toContain("Préparez un plan sans ce champion");
  });
  it("opens the exact source draft from a ban observation", async () => {
    const second = anotherDraft("d2", {}, { redBans: ["MonkeyKing", "Poppy", "Thresh", "Lux", "Diana"] });
    apiFetch.mockResolvedValue({ ...payload, drafts: [row, second] }); await mount();
    search("Lux");
    expect(banNames()).toEqual(["Lux"]);
    const sources = sourceButtons(banDetail());
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((button) => content(button).includes("series-d2"))).toBe(true);
    act(() => sources[0].props.onClick());
    expect(field("Draft à revoir").findByType("select").props.value).toBe("d2");
    const links = renderer.root.findByProps({ className: "drafter-source-links" }).findAllByType("a");
    expect(links.map((link) => link.props.href)).toContain(second.snapshot.sourceUrl);
    expect(links.map((link) => link.props.href)).toContain("/games?match=match-d2");
    expect(links.map((link) => link.props.href)).not.toContain(snapshot.sourceUrl);
  });
  it("combines side, patch and format filters and excludes unavailable source drafts", async () => {
    const blue = anotherDraft("blue", {}, { patch: "26.19" });
    const fearless = anotherDraft("fearless", { allySide: "red" }, { patch: "26.20", fearless: true });
    const ironman = anotherDraft("ironman", { allySide: "red" }, { ironman: true });
    apiFetch.mockResolvedValue({ ...payload, drafts: [blue, fearless, ironman] }); await mount();
    expect(draftCount()).toBe("3");
    choose("Côté de notre équipe", "red");
    expect(draftCount()).toBe("2");
    expect(field("Draft à revoir").findByType("select").props.value).toBe("fearless");
    choose("Patch de la draft", "26.20");
    expect(draftCount()).toBe("1");
    choose("Format de draft", "standard");
    expect(draftCount()).toBe("0");
    expect(text()).toContain("Aucune draft dans cette sélection");
    expect(sourceButtons()).toHaveLength(0);
    choose("Format de draft", "fearless");
    expect(draftCount()).toBe("1");
    expect(field("Draft à revoir").findByType("select").props.value).toBe("fearless");
    choose("Format de draft", ""); choose("Patch de la draft", "unknown");
    expect(draftCount()).toBe("1");
    expect(field("Draft à revoir").findByType("select").props.value).toBe("ironman");
    choose("Format de draft", "ironman");
    expect(draftCount()).toBe("1");
  });
  it("resets champion, phase and source selection when the scope changes", async () => {
    const second = anotherDraft("d2", { opponentId: "other" }, { redBans: ["Zed", "Lux", "Zyra", "Vi", "Ivern"] });
    apiFetch.mockResolvedValue({ ...payload, drafts: [row, second] }); await mount();
    choose("Phase des bans", "2"); search("Syndra");
    expect(banNames()).toEqual(["Syndra"]);
    choose("Équipe adverse liée", "other");
    expect(field("Phase des bans").findByType("select").props.value).toBe("all");
    expect(field("Rechercher un champion banni").findByType("input").props.value).toBe("");
    expect(banNames()).not.toContain("Syndra");
    expect(sourceButtons().every((button) => content(button).includes("series-d2"))).toBe(true);
    expect(field("Draft à revoir").findByType("select").props.value).toBe("d2");
  });
  it("retains legacy ban observations without inventing their phase or rotations", async () => {
    apiFetch.mockResolvedValue({ ...payload, drafts: [{ ...row, snapshot: { ...snapshot, orderEvidence: undefined } }] }); await mount();
    search("Syndra");
    expect(banNames()).toEqual(["Syndra"]);
    expect(content(banDetail())).toContain("1 bans sur 1 drafts exploitables");
    expect(content(banDetail())).toContain("Bans observés sans phase vérifiée : 1.");
    expect(content(banDetail())).toContain("Sans phase vérifiée, impossible de relier ce ban aux picks déjà révélés.");
    expect(content(banDetail())).not.toContain("En phase 1, aucun pick n’est encore révélé.");
    expect(content(banDetail())).not.toContain("Un exemple dans son contexte");
    expect(renderer.root.findAllByProps({ className: "draft-rotation" })).toHaveLength(0);
    expect(text()).toContain("Aucune rotation vérifiée dans cette position.");
    choose("Phase des bans", "1");
    expect(banNames()).toEqual([]);
    choose("Phase des bans", "2");
    expect(banNames()).toEqual([]);
  });
  it("shows every declared player affected by a shared champion and supports role filtering", async () => {
    const players = [
      { id: "p1", team_id: "team1", name: "Nyx", role: "JGL" },
      { id: "p2", team_id: "team1", name: "Rune", role: "SUP" },
      { id: "outsider", team_id: "another-team", name: "Joueur extérieur", role: "SUP" },
    ];
    const championPool = [
      { id: "pool1", team_id: "team1", player_id: "p1", champion: "Poppy", role: "JGL", source: "manual", status: "lock" },
      { id: "pool2", team_id: "team1", player_id: "p2", champion: "Poppy", role: "SUP", source: "riot_manual", status: "pocket" },
      { id: "outside", team_id: "another-team", player_id: "outsider", champion: "Poppy", role: "SUP", source: "manual", status: "lock" },
    ];
    apiFetch.mockResolvedValue(payload); await mount({ players, championPool });
    choose("Rôle concerné", "SUP");
    expect(banNames()).toEqual(["Poppy"]);
    expect(content(banDetail())).toContain("NyxJGL · Confiance");
    expect(content(banDetail())).toContain("RuneSUP · Situationnel");
    expect(content(banDetail())).not.toContain("Joueur extérieur");
    expect(content(banDetail())).toContain("Aucun rôle joué vérifiable");
    expect(content(banDetail())).toContain("Ce rapprochement ne prouve pas l’intention du ban.");
    choose("Bans à analyser", "ally");
    expect(renderer.root.findAllByProps({ className: "draft-pool-players" })).toHaveLength(0);
    expect(content(banDetail())).not.toContain("Nyx");
  });
  it("groups red-first ally picks in opening rotations instead of assuming blue always opens", async () => {
    const redFirst = anotherDraft("red-first", { allySide: "red" }, {
      firstPick: "red", orderEvidence: { ...snapshot.orderEvidence, firstPick: "red" },
    });
    apiFetch.mockResolvedValue({ ...payload, drafts: [redFirst] }); await mount();
    const opening = renderer.root.findAllByProps({ className: "draft-rotation" });
    expect(opening).toHaveLength(3);
    expect(content(opening[0])).toContain("Ouverture · premier pick");
    expect(content(opening[0])).toContain("Yunara");
    expect(content(opening[0])).not.toContain("Aatrox");
    choose("Notre position dans la sélection", "responding");
    expect(renderer.root.findAllByProps({ className: "draft-rotation" })).toHaveLength(0);
    expect(text()).toContain("Aucune rotation vérifiée dans cette position.");
  });
  it("translates the analysis while preserving the selected phase and champion search", async () => {
    apiFetch.mockResolvedValue(payload); await mount();
    choose("Phase des bans", "1"); search("Poppy");
    await act(async () => { await setLanguage("en", { persist: false }); });
    expect(text()).toContain("What opponents ban against us");
    expect(field("Bans to analyze").findByType("select").props.value).toBe("enemy");
    expect(field("Search for a banned champion").findByType("input").props.value).toBe("Poppy");
    expect(banNames()).toEqual(["Poppy"]);
    expect(text()).not.toContain("Ce qu’on nous retire");
    expect(sourceButtons().some((button) => content(button).includes("OPIF"))).toBe(true);
    await act(async () => { await setLanguage("fr", { persist: false }); });
    expect(field("Phase des bans").findByType("select").props.value).toBe("1");
    expect(banNames()).toEqual(["Poppy"]);
  });
  it("has a shareable analyses route", () => {
    expect(trendsPath({ panel: "drafts" })).toBe("/tendances?rubrique=drafts");
    expect(readTrendsRoute({ path: "/tendances", search: "?rubrique=drafts" }).panel).toBe("drafts");
  });
});
