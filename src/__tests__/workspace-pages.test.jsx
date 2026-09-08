import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { Reports, Statistics } from "../pages/workspace/GameWorkspace.jsx";
import { Button } from "../components/ui/Core.jsx";
import { Planning } from "../pages/workspace/Planning.jsx";
import { DraftWorkspace } from "../pages/workspace/DraftWorkspace.jsx";
import { TrendsPage } from "../pages/workspace/TrendsPage.jsx";
import { ChampionLanePanel, ParticipantCompareCard, PlayerUltimateProfile } from "../pages/workspace/PlayerUltimateProfile.jsx";
import { createPlanningStore } from "../utils/planning-store.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/.netlify/functions" }));
const cleanups = [];
beforeEach(() => vi.stubGlobal("window", { location: new URL("https://nxt5.test/statistiques?match=older"), addEventListener: vi.fn(), removeEventListener: vi.fn(), scrollTo: vi.fn() }));
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const props = () => ({ data: { ...DEFAULT_DATA, teams: [{ id: "a", name: "Équipe" }] }, selectedTeamId: "a", currentMember: { role: "owner" }, user: { id: "user" }, refreshAll: vi.fn(), pushToast: vi.fn(), navigate: vi.fn(), route: { path: "/draft/pool", search: "" } });
async function render(element) { let renderer; await act(async () => { renderer = TestRenderer.create(<Suspense fallback="loading">{element}</Suspense>); }); cleanups.push(() => act(() => renderer.unmount())); return renderer; }

describe("extracted workspace pages", () => {
  it.each([DraftWorkspace, TrendsPage, PlayerUltimateProfile])("renders %s without eagerly loading other pages", async (Page) => {
    const renderer = await render(<Page {...props()} />);
    expect(renderer.toJSON()).toBeTruthy();
  });
  it("renders planning with its session store", async () => {
    const store = createPlanningStore({ save: vi.fn() });
    cleanups.push(() => store.pause());
    const renderer = await render(<Planning {...props()} planningStore={store} />);
    expect(renderer.toJSON()).toBeTruthy();
  });
  it("loads a direct game link even when the game is outside the loaded page", async () => {
    let resolve;
    apiFetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const renderer = await render(<Statistics {...props()} route={{ path: "/statistiques", search: "?match=older" }} />);
    expect(JSON.stringify(renderer.toJSON())).toContain("Chargement des statistiques détaillées");
    await act(async () => resolve({ matches: [{ id: "older", team_id: "a", game_id: "EUW1_123", duration: "15:00", result: "Victoire", raw: { nxt5Label: "Game ancienne" }, participants: [] }] }));
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Chargement des statistiques détaillées");
    expect(renderer.root.findAllByType("h3").some((heading) => heading.children.includes("Game ancienne"))).toBe(true);
  });
  it("keeps links to report games that are outside the loaded match page", async () => {
    window.location = new URL("https://nxt5.test/rapports?report=report-old");
    const settings = props();
    settings.data.reports = [{ id: "report-old", team_id: "a", match_ids: ["older"], title: "Review ancienne", content: "Notes conservées" }];
    const renderer = await render(<Reports {...settings} />);
    expect(renderer.root.findAllByType("p").some((p) => p.children.join("").includes("1 game liée"))).toBe(true);
    const stats = renderer.root.findAllByType(Button).find((button) => button.props.children === "Stats");
    expect(stats.props.disabled).toBe(false);
    expect(renderer.root.findAllByType("p").some((p) => p.children.join("").includes("0 sur 1 games liées chargées"))).toBe(true);
  });
  it("loads purchase events only when a champion game opens and refreshes them with bootstrap", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }));
    const requests = [];
    apiFetch.mockImplementation((_url, options) => new Promise((resolve) => requests.push({ resolve, options })));
    const ally = { id: "ally", team_key: "ALLY", role: "MID", raw: { participantId: 1, teamId: 100 } };
    const enemy = { id: "enemy", team_key: "ENEMY", role: "MID", raw: { participantId: 6, teamId: 200 } };
    const match = { id: "game", team_id: "a", participants: [ally, enemy] };
    const rows = [{ ...ally, match }];
    const detail = (timestamp) => ({ matches: [{ ...match, raw: { nxt5: { timelineEvents: [
      { type: "ITEM_PURCHASED", timestamp, participantId: 1, itemId: 1056 },
      { type: "ITEM_PURCHASED", timestamp: timestamp + 60000, participantId: 6, itemId: 1055 },
    ] } } }] });
    const renderer = await render(<ChampionLanePanel rows={rows} bootstrapRevision={1} />);
    expect(requests).toHaveLength(0);
    act(() => renderer.root.findByType("details").props.onToggle({ currentTarget: { open: true } }));
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0].options.body)).toEqual({ teamId: "a", matchIds: ["game"] });
    await act(async () => requests[0].resolve(detail(60000)));
    expect(JSON.stringify(renderer.toJSON())).toContain("Timeline achats");
    const comparisons = renderer.root.findAllByType(ParticipantCompareCard);
    expect(comparisons[0].findAllByType("span").some((span) => span.children.join("") === "1:00")).toBe(true);
    expect(comparisons[1].findAllByType("span").some((span) => span.children.join("") === "2:00")).toBe(true);
    await act(async () => renderer.update(<Suspense fallback="loading"><ChampionLanePanel rows={rows} bootstrapRevision={2} /></Suspense>));
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Timeline achats");
    await act(async () => requests[1].resolve(detail(180000)));
    expect(renderer.root.findAllByType("span").some((span) => span.children.join("") === "3:00")).toBe(true);
    act(() => renderer.root.findByType("details").props.onToggle({ currentTarget: { open: false } }));
    act(() => renderer.root.findByType("details").props.onToggle({ currentTarget: { open: true } }));
    expect(requests).toHaveLength(2);
  });
  it("can retry purchase details after a network failure", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Timeline indisponible"));
    const match = { id: "game", team_id: "a", participants: [] };
    const renderer = await render(<ChampionLanePanel rows={[{ match }]} />);
    await act(async () => renderer.root.findByType("details").props.onToggle({ currentTarget: { open: true } }));
    expect(renderer.root.findByProps({ role: "alert" }).findByType("p").children).toEqual(["Timeline indisponible"]);
    apiFetch.mockResolvedValueOnce({ matches: [match] });
    await act(async () => renderer.root.findByType(Button).props.onClick());
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
