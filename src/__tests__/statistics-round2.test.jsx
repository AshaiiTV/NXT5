import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildingEvents, championKillEvents, deathContext, teamGoldAtMinute, teamGoldAtTimestamp, timelineGoldDiff, timelineMilestones, TimelinePhaseColumn, ObjectiveHud, ObjectivePictogram, objectivePictogramType, objectiveTeamKeyForSide } from "../pages/workspace/GameWorkspace.jsx";
import { objectiveEvents, objectiveEventType, objectiveTeamSummary, buildStaffAlerts } from "../pages/workspace/workspace-shared.jsx";
import { goalMetricValue, evaluateGoal, PlayerGoalsPanel, BlockComparisonPanel, workflowTestables } from "../NextPhase.jsx";
import { TrendsPage, buildTrendsPngData, trendsExportFilename, buildDraftTrendModel, DraftTrendsModule } from "../pages/workspace/TrendsPage.jsx";
import { ProfileHistoryView, ChampionLaneGameLine } from "../pages/workspace/PlayerUltimateProfile.jsx";
import { TrendsOverview } from "../components/trends/TrendsOverview.jsx";
import { DraftTrendDetails } from "../components/trends/DraftTrendDetails.jsx";
import { ProgressionObjectives } from "../components/trends/ProgressionObjectives.jsx";
import { SelectInput } from "../components/ui/Core.jsx";
import { comparableSides, sideResults } from "../utils/statistics.js";

let renderers = [];
afterEach(() => { act(() => renderers.forEach((r) => r.unmount())); renderers = []; vi.unstubAllGlobals(); });
const mount = (element) => { let r; act(() => { r = TestRenderer.create(element); }); renderers.push(r); return r; };
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
function game(events = [], overrides = {}) {
  return { id: "g", team_id: "t", result: "Victoire", created_at: "2026-09-29", side: "Blue Side", participants: ["ALLY", "ENEMY"].flatMap((team, side) => roles.map((role, i) => ({ team_key: team, role, champion: "Ahri", kills: 1, deaths: 1, assists: 2, gold: 1000, damage: 1000, vision: 10, kill_participation: 60, raw: { participantId: side * 5 + i + 1, teamId: side ? 200 : 100 } }))), raw: { timeline: { info: { frames: [{ timestamp: 600000, events }] } } }, ...overrides };
}
const monster = (timestamp, extra = {}) => ({ type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", killerId: 1, timestamp, ...extra });
function goldFrame(timestamp, value = 1000) { return { timestamp, participantFrames: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), { totalGold: value }])) }; }
function trends(matches, search = "") {
  vi.stubGlobal("window", { location: new URL(`https://nxt5.test/tendances${search}`), addEventListener() {}, removeEventListener() {} });
  return mount(<TrendsPage data={{ matches, teams: [{ id: "t" }], matchCategories: [{ id: "c", team_id: "t", name: "Entraînement" }] }} selectedTeamId="t" />);
}
const overview = (r) => r.root.findByType(TrendsOverview).props;

describe("Tour 2 — statistiques", () => {
  it("D1 — attributes a destroyed building to its killer, otherwise the opposite known owner", () => {
    const cases = [
      [{ killerId: 0, teamId: 200 }, "ALLY"], [{ killerId: 0, teamId: 100 }, "ENEMY"],
      [{ killerId: 6, teamId: 200 }, "ENEMY"], [{ killerId: 0 }, ""], [{ killerId: 99, teamId: 300 }, ""],
    ];
    for (const [event, expected] of cases) expect(buildingEvents(game([{ type: "BUILDING_KILL", ...event }]))[0].teamKey).toBe(expected);
    expect(buildingEvents(game([{ type: "BUILDING_KILL" }], { participants: [] }))[0].teamKey).toBe("");
  });

  it("D2 — uses total CS10 and excludes absent metrics from both evaluation and rendered success", () => {
    const match = game([], { raw: { nxt5: { timelineSummary: { csMilestones: { "2": { cs10: 64 } } } } } });
    const row = { ...match.participants[1], match, raw: { ...match.participants[1].raw, challenges: { laneMinionsFirst10Minutes: 0 } } };
    expect(goalMetricValue(row, "cs10")).toBe(64);
    for (const metric of ["deaths", "kp", "kda", "vision", "cs10"]) expect(goalMetricValue({}, metric)).toBeNull();
    expect(goalMetricValue({ deaths: 0 }, "deaths")).toBe(0);
    expect(goalMetricValue({ kp: "0%" }, "kp")).toBe(0);
    const goal = { id: "goal", player_id: "p", metric: "deaths", operator: "lte", target_value: 3, required_successes: 2, sample_size: 3 };
    const rows = [1, 2, 3].map((id) => ({ match: { id, created_at: "2026-09-29" } }));
    expect(evaluateGoal(goal, rows)).toMatchObject({ successes: 0, complete: false, impossible: false, values: [null, null, null] });
    const r = mount(<PlayerGoalsPanel goals={[goal]} rows={rows} player={{ id: "p" }} />);
    expect(r.root.findAllByProps({ className: "profile-goal-sample is-pending" })).toHaveLength(3);
    expect(text(r.toJSON())).toContain("Indisponible");
    expect(text(r.toJSON())).not.toMatch(/Cible atteinte|Hors cible|Validé/);
    rows[0].deaths = 0; rows[1].deaths = 2;
    expect(evaluateGoal(goal, rows).complete).toBe(true);
  });

  it.each(["c", "empty"])("D3 — comparison ignores global period/category (%s), including empty global selections", async (category) => {
    const matches = Array.from({ length: 15 }, (_, i) => game([], { id: `g${i}`, created_at: new Date(2026, 8, i + 1).toISOString(), category_id: i < 6 ? "c" : "other" }));
    const r = trends(matches, `?rubrique=comparison&periode=5&contexte=${category}`);
    await act(async () => { await import("../NextPhase.jsx"); });
    const panel = r.root.findByType(BlockComparisonPanel);
    expect(panel.props.matches).toHaveLength(15);
    expect(text(panel)).toContain("Les filtres de période et de catégorie des autres rubriques ne s’appliquent pas ici");
    expect(panel.findAllByProps({ className: "block-comparison-sample" }).map(text).every((t) => t.includes("5 parties"))).toBe(true);
    expect(r.root.findAllByProps({ className: "trends-filters" })).toHaveLength(0);
    const select = panel.findAllByType(SelectInput).find((s) => s.props.label === "Bloc observé");
    act(() => select.props.onChange("all"));
    expect(text(panel)).toContain("15 parties");
  });

  it("D4 — keeps late events after eighteen early moments and labels each phase display limit", () => {
    const match = game([...Array.from({ length: 19 }, (_, i) => monster((i + 1) * 30000)), monster(25 * 60000)]);
    const events = timelineMilestones(match);
    expect(events.some((e) => e.timestamp === 25 * 60000)).toBe(true);
    const structures = game(Array.from({ length: 8 }, (_, i) => ({ type: "BUILDING_KILL", buildingType: "INHIBITOR_BUILDING", teamId: 200, killerId: 0, timestamp: (i + 20) * 60000 })));
    expect(timelineMilestones(structures).some((e) => e.timestamp === 27 * 60000)).toBe(true);
    const r = mount(<TimelinePhaseColumn phase={{ id: "early", label: "Early", events: events.slice(0, 19) }} kills={[]} match={match} />);
    expect(text(r.toJSON())).toContain("6 moments affichés sur 19");
    expect(r.root.findAllByType("article")).toHaveLength(6);
  });

  it("D5 — compact and partial gold frames remain unavailable; observed zero remains zero", () => {
    expect(timelineGoldDiff(game([monster(600000)]), 600000)).toBeNull();
    const match = game([], { raw: { timeline: { info: { frames: [goldFrame(600000, 0)] } } } });
    expect(timelineGoldDiff(match, 600000)).toBe(0);
    delete match.raw.timeline.info.frames[0].participantFrames["3"];
    expect(teamGoldAtTimestamp(match, "ALLY", 600000)).toBeNull();
    expect(timelineGoldDiff(match, 600000)).toBeNull();
  });

  it("D6 — unknown monsters have no dragon count, icon, or first-objective timing", () => {
    const event = monster(300000, { monsterType: "ATAKHAN" });
    const match = game([event]);
    expect(objectiveEventType(event)).toBe("other");
    expect(objectivePictogramType(event)).toBe("other");
    expect(objectiveTeamSummary(match, "ALLY").dragonCount).toBe(0);
    expect(mount(<ObjectivePictogram type="other" />).root.findAllByType("img")).toHaveLength(0);
    expect(overview(trends([match])).briefs.find((b) => b.label === "Objectifs").title).toBe("Timing indisponible");
  });

  it("D7 — requires three known results per side and uses French side labels", () => {
    const sample = (side, wins, losses) => [...Array(wins).fill("Victoire"), ...Array(losses).fill("Défaite")].map((result, i) => game([], { id: `${side}${i}`, side, result, participants: [] }));
    const small = [...sample("Blue Side", 1, 0), ...sample("Red Side", 7, 3)];
    expect(comparableSides(sideResults(small))).toBe(false);
    expect(buildStaffAlerts(small).some((a) => a.title === "Côté à travailler")).toBe(false);
    expect(overview(trends(small)).briefs.find((b) => b.label === "Objectifs").text).toContain("au moins 3 résultats connus par côté");
    const enough = [...sample("Blue Side", 3, 0), ...sample("Red Side", 0, 3)];
    expect(buildStaffAlerts(enough).find((a) => a.title === "Côté à travailler").text).toContain("Côté rouge : 0%");
    expect(overview(trends(enough)).briefs.find((b) => b.label === "Objectifs").text).toContain("Côté bleu (100%");
  });

  it("D8 — describes a single measured lane once and deduplicates rendered evidence", () => {
    const match = game([], { raw: { nxt5: { timelineSummary: { csMilestones: { "1": { cs10: 70 }, "6": { cs10: 65 } } } } } });
    const r = trends([match]);
    const brief = overview(r).briefs.find((b) => b.label === "Laning");
    expect(brief.title).toContain("seul rôle mesuré");
    expect(brief.text).not.toContain("Point de contrôle");
    expect(new Set(brief.evidence).size).toBe(brief.evidence.length);
    const props = overview(r);
    const duplicate = mount(<TrendsOverview {...props} briefs={[{ ...brief, evidence: ["preuve", "preuve"] }]} />);
    expect(duplicate.root.findAllByType("li").map(text)).toEqual(["preuve"]);
  });

  it("D9 — absent objective timing gets a neutral tone", () => {
    expect(overview(trends([game()])).briefs.find((b) => b.label === "Objectifs")).toMatchObject({ title: "Timing indisponible", toneName: "slate" });
  });

  it.each([['Blue Side', 'Côté bleu'], ['Red Side', 'Côté rouge'], ['', '—']])("D10 — translates imported side %s in profile history and champion detail", (side, label) => {
    const match = game([], { side, participants: [] });
    const row = { champion: "Ahri", match };
    expect(text(mount(<ProfileHistoryView rows={[row]} />).toJSON())).toContain(label);
    const r = mount(<ChampionLaneGameLine row={row} />);
    act(() => r.root.findByType("details").props.onToggle({ currentTarget: { open: true } }));
    expect(text(r.toJSON())).toContain(label);
    expect(text(r.toJSON())).not.toMatch(/Blue Side|Red Side/);
  });

  it("D11 — unknown objective side has a neutral marker", () => {
    const r = mount(<ObjectiveHud match={game([monster(600000, { killerId: 0 })])} />);
    const li = r.root.findByType("li");
    expect(text(li)).toContain("—");
    expect(text(li)).not.toMatch(/Bleu|Rouge/);
    expect(li.findAll((n) => n.props.className?.includes("text-slate-300")).length).toBeGreaterThan(0);
  });

  it.each([1, 2, 20])("D12 — the objective horizon stays at three future games after %i past games", (gamesCount) => {
    const r = mount(<ProgressionObjectives gamesCount={gamesCount} teamObjective={{}} roleObjectives={[]} />);
    expect(text(r.toJSON())).toContain("À vérifier sur les 3 prochaines parties.");
  });

  it("D13 — creates readable filenames with diacritics removed", () => {
    expect(trendsExportFilename("Entraînement été")).toBe("nxt5-tendances-entrainement-ete.png");
  });

  it("N2-01 — total bounty never becomes a shutdown", () => {
    const match = game([0, undefined, 300].map((shutdownBounty) => ({ type: "CHAMPION_KILL", killerId: 6, victimId: 1, bounty: 300, shutdownBounty })));
    expect(championKillEvents(match).map((e) => e.shutdown)).toEqual([0, null, 300]);
    expect(deathContext(match).shutdowns).toHaveLength(1);
  });

  it("N2-02 — unassigned objectives stay visible and outside both team aggregates", () => {
    for (const match of [game([monster(600000, { killerId: 0 })]), game([monster(600000, { killerTeamId: 100 })], { participants: [], side: "" })]) {
      expect(objectiveEvents(match)[0].teamKey).toBe("");
      for (const key of ["ALLY", "ENEMY", ""]) expect(objectiveTeamSummary(match, key).dragonCount).toBe(0);
      expect(mount(<ObjectiveHud match={match} />).root.findAllByType("li")).toHaveLength(1);
    }
    expect(objectiveTeamKeyForSide(game([], { participants: [], side: "" }), "BLUE")).toBe("");
  });

  it("N2-03 — gold checkpoints reject distant future frames and incomplete coverage", () => {
    for (const [timestamp, expected] of [[600000, 5000], [605000, 5000], [605001, null], [900000, null]]) {
      const match = game([], { raw: { timeline: { info: { frames: [goldFrame(timestamp)] } } } });
      expect(teamGoldAtMinute(match, "ALLY", 10)).toBe(expected);
      if (timestamp > 600000) expect(teamGoldAtTimestamp(match, "ALLY", 600000)).toBeNull();
      match.raw.timeline.info.frames[0].participantFrames["1"].totalGold = null;
      expect(teamGoldAtMinute(match, "ALLY", 10)).toBeNull();
    }
  });

  it("N2-05 — screen, comparison, alerts and export agree on known/unknown results", () => {
    const matches = [game(), game([], { id: "unknown", result: "Analyse" })];
    expect(buildTrendsPngData(matches)).toMatchObject({ wins: 1, losses: 0, known: 1, unknown: 1, winrate: 100 });
    expect(workflowTestables.blockSnapshot(matches)).toMatchObject({ wins: 1, losses: 0, unknown: 1, wr: 100, blue: 100 });
    const screen = text(trends(matches).toJSON());
    expect(screen).toContain("1 victoire · 0 défaite · 1 résultat indisponible");
    expect(screen).toContain("Taux de victoire : 100% sur 1 résultat connu");
    const panel = mount(<BlockComparisonPanel matches={matches} />);
    expect(text(panel.toJSON())).toContain("1 résultat indisponible");
    expect(buildStaffAlerts(matches).find((a) => a.title === "Résultats indisponibles").text).toContain("1 résultat indisponible");
    expect(buildStaffAlerts(Array(4).fill(matches[1])).some((a) => a.title === "Bloc à stabiliser")).toBe(false);
    expect(workflowTestables.blockSnapshot([matches[1]]).wr).toBeNull();
    expect(text(trends([matches[1]]).toJSON())).toContain("Taux de victoire : —");
  });

  it("N2-05 — champion, duo and composition rates use known outcomes and keep unknown samples out of warnings", () => {
    const matches = [game(), game([], { result: "Analyse" })];
    const model = buildDraftTrendModel(matches);
    for (const summary of [model.ally, ...model.ally.picks, ...model.ally.allDuos, ...model.ally.archetypes]) {
      expect(summary).toMatchObject({ wins: 1, losses: 0, known: 1, unknown: 1, wr: 100 });
    }
    expect(model.ally.comfort).toHaveLength(0);
    expect(text(mount(<DraftTrendsModule model={model} />).toJSON())).toContain("1 résultat indisponible");
    const unknown = buildDraftTrendModel([game([], { result: "Analyse" }), game([], { result: "" })]);
    expect(unknown.ally.wr).toBeNull();
    expect(unknown.ally.traps).toHaveLength(0);
    const r = mount(<DraftTrendsModule model={unknown} />);
    expect(text(r.toJSON())).toContain("2 résultats indisponibles");
    expect(r.root.findAll((n) => n.props.className?.includes("draft-result-negative"))).toHaveLength(0);
    const onOpenSources = vi.fn();
    const detail = mount(<DraftTrendDetails model={model} sectionId="compositions" onOpenSources={onOpenSources} />);
    const source = detail.root.findAllByType("button").find((b) => b.props.className === "draft-table-row");
    act(() => source.props.onClick());
    expect(onOpenSources.mock.calls[0][0].metrics).toContainEqual({ label: "Bilan", value: "1 victoire · 0 défaite · 1 résultat indisponible" });
  });

  it("E1 — remote objective PNGs use the asset proxy, including fallback sources", () => {
    const r = mount(<ObjectivePictogram type="dragon" />);
    const img = () => r.root.findByType("img");
    expect(img().props.src).toMatch(/^\/\.netlify\/functions\/asset-proxy\?url=/);
    expect(decodeURIComponent(img().props.src)).toContain("raw.communitydragon.org");
    act(() => img().props.onError());
    if (r.root.findAllByType("img").length) expect(img().props.src).toMatch(/^\/\.netlify\/functions\/asset-proxy\?url=/);
  });
});

it.each([
  [660000, { minionsKilled: 70, jungleMinionsKilled: 10 }, null],
  [600000, { minionsKilled: 70 }, null],
  [600000, { minionsKilled: 70, jungleMinionsKilled: Infinity }, null],
  [605001, { minionsKilled: 70, jungleMinionsKilled: 10 }, null],
  [605000, { minionsKilled: 70, jungleMinionsKilled: 10 }, 80],
  [600000, { minionsKilled: 0, jungleMinionsKilled: 0 }, 0],
])('T3-03 keeps server, detail, goal and PNG CS10 consistent (%s)', async (timestamp, participantFrame, expected) => {
  const { buildNxt5TimelineSummary } = await import('../../netlify/functions/_lib/analytics');
  const { csAtMinute } = await import('../utils/match-timeline.js');
  const raw = { info: { gameDuration: 1800, participants: [{ participantId: 1, championName: 'Ahri' }] }, timeline: { info: { frames: [{ timestamp, participantFrames: { '1': participantFrame } }] } } };
  const summary = buildNxt5TimelineSummary(raw);
  expect(summary.csRule).toBe(2);
  expect(summary.csMilestones['1'].cs10).toBe(expected);
  const participant = { team_key: 'ALLY', role: 'TOP', raw: { participantId: 1 } };
  for (const source of [raw, { info: raw.info, nxt5: { timelineSummary: summary } }]) {
    const match = { id: 'cs', participants: [participant], raw: source };
    const row = { ...participant, match };
    expect(csAtMinute(row, 10)).toBe(expected);
    expect(goalMetricValue(row, 'cs10')).toBe(expected);
    expect(buildTrendsPngData([match]).roles.find(role => role.role === 'TOP').cs10).toEqual({ value: expected, count: expected === null ? 0 : 1 });
  }
});

it('N3-01 shares canonical notebook keys between browser and server', async () => {
  const { championKey } = await import('../utils/matchup-notebook.js');
  const { canonicalChampion, validateMatchupRequest } = await import('../../netlify/functions/_lib/player-matchups');
  for (const [alias, expected] of [['Wukong','monkeyking'],['MonkeyKing','monkeyking'],['FiddleSticks','fiddlesticks'],["Kai’Sa",'kaisa']]) {
    expect(championKey(alias)).toBe(expected);
    expect(canonicalChampion(alias)).toBe(expected);
    expect(validateMatchupRequest({ action: 'list', teamId: '00000000-0000-4000-8000-000000000001', playerId: '00000000-0000-4000-8000-000000000002', champion: alias }).champion).toBe(expected);
  }
});
