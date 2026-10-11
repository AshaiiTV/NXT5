import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import DrafterAnalysis, { DraftChronology } from "../components/trends/DrafterAnalysis.jsx";
import { readTrendsRoute, trendsPath } from "../app/trends-navigation.js";

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
let renderer;
function content(node) { return node.children.map((child) => typeof child === "string" ? child : content(child)).join(""); }
function text() { return content(renderer.root); }
async function mount(props = {}) { await act(async () => { renderer = TestRenderer.create(<DrafterAnalysis teamId="team1" {...props} />); }); }
function choose(label, value) {
  const field = renderer.root.findAllByType("label").find((node) => node.findAllByType("span").some((child) => content(child) === label));
  act(() => field.findByType("select").props.onChange({ target: { value } }));
}
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.resetAllMocks(); vi.unstubAllGlobals(); });

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
    choose("Choix à analyser", "ally");
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
  it("has a shareable analyses route", () => {
    expect(trendsPath({ panel: "drafts" })).toBe("/tendances?rubrique=drafts");
    expect(readTrendsRoute({ path: "/tendances", search: "?rubrique=drafts" }).panel).toBe("drafts");
  });
});
