import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPlaystyleAnalysis, repeatedPlaystyle } from "../utils/playstyle-analysis.js";
import { PlaystyleAnalysis } from "../components/trends/PlaystyleAnalysis.jsx";
import { ROLES } from "../../shared/roles.js";

const match = (id = "one", { early = -1000, duration = "30:00", zero = false } = {}) => {
  const participants = ["ALLY", "ENEMY"].flatMap((team, teamIndex) => ROLES.map((role, index) => ({
    team_key: team, role, player_id: `${team}-${role}`, gold: zero ? 0 : index === 3 && team === "ALLY" ? 18000 : 10000,
    damage: zero ? 0 : 10000, kills: zero ? 0 : 2, assists: zero ? 0 : 3, deaths: zero ? 0 : team === "ALLY" ? 3 : 2,
    vision: zero ? 0 : team === "ALLY" ? 30 : 60,
    raw: { participantId: teamIndex * 5 + index + 1, teamId: teamIndex ? 200 : 100 },
  })));
  const participantFrames = Object.fromEntries(participants.map((row) => [row.raw.participantId, {
    totalGold: zero ? 0 : row.team_key === "ALLY" ? 3000 + early / 5 : 3000,
    minionsKilled: zero ? 0 : row.team_key === "ALLY" ? 60 : 70, jungleMinionsKilled: 0,
  }]));
  return { id, duration, result: "Victoire", participants, raw: {
    timeline: { info: { frames: [{ timestamp: 600000, participantFrames }] } },
    info: { teams: [
      { teamId: 100, objectives: { dragon: { kills: zero ? 0 : 1 }, baron: { kills: zero ? 0 : 1 }, tower: { kills: zero ? 0 : 5 } } },
      { teamId: 200, objectives: { dragon: { kills: zero ? 0 : 3 }, baron: { kills: 0 }, tower: { kills: zero ? 0 : 7 } } },
    ] },
  } };
};
const measure = (model, key) => model.metrics[key];
const deepFreeze = (value) => {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
};

describe("observable playstyle model", () => {
  it("keeps exact samples, signed differences and per-game means", () => {
    const a = match("a"); const b = match("b", { early: 500 });
    const model = buildPlaystyleAnalysis([a, b]);
    expect(measure(model, "gold10")).toMatchObject({ value: -250, count: 2, positive: 1, negative: 1, equal: 0, matches: [a, b] });
    expect(measure(model, "deathDiff").value).toBe(5);
    expect(measure(model, "deaths").value).toBe(15);
    expect(measure(model, "fightPace").value).toBeCloseTo(20 / 30);
    expect(measure(model, "visionDiffPerMin").value).toBe(-5);
    expect(measure(model, "dragonShare").value).toBe(25);
    expect(measure(model, "towerDiff").value).toBe(-2);
    expect(model.resourceFocus).toEqual({ role: "ADC", count: 2, total: 2 });
    expect(model.roles.find((item) => item.role === "MID").metrics.cs10Diff.value).toBe(-10);
    expect(model.roles.find((item) => item.role === "MID").metrics.kp.value).toBe(50);
  });

  it("never turns absent/invalid participant statistics into measured zeros", () => {
    const selected = match();
    for (const row of selected.participants) {
      for (const key of ["gold", "damage", "kills", "deaths", "assists", "vision"]) delete row[key];
    }
    selected.participants[0].gold = "";
    selected.participants[1].gold = false;
    selected.participants[2].gold = "NaN";
    selected.participants[3].gold = -1;
    selected.participants[4].gold = Infinity;
    selected.raw = {};
    const model = buildPlaystyleAnalysis([selected]);
    expect(model.metricsAvailable).toBe(false);
    expect(model.priority).toBe("data");
    expect(Object.values(model.metrics).every((metric) => metric.value === null && metric.count === 0)).toBe(true);
    expect(model.roles.every((role) => Object.values(role.metrics).every((metric) => metric.value === null && metric.count === 0))).toBe(true);
  });

  it("retains actual zero counts but leaves ratios with zero denominators undefined", () => {
    const model = buildPlaystyleAnalysis([match("zero", { zero: true })]);
    for (const key of ["gold10", "fightPace", "deaths", "deathDiff", "visionDiffPerMin", "towerDiff"]) expect(measure(model, key)).toMatchObject({ value: 0, count: 1 });
    for (const key of ["dragonShare", "baronShare"]) expect(measure(model, key)).toMatchObject({ value: null, count: 0 });
    for (const role of model.roles) {
      expect(role.metrics.cs10Diff).toMatchObject({ value: 0, count: 1 });
      for (const key of ["goldShare", "damageShare", "kp"]) expect(role.metrics[key]).toMatchObject({ value: null, count: 0 });
    }
    expect(model.resourceFocus).toBe(null);
  });

  it("computes coverage independently when only some fields are absent", () => {
    const complete = match("full"); const partial = match("partial");
    delete partial.participants[0].vision;
    delete partial.participants[4].damage;
    const model = buildPlaystyleAnalysis([complete, partial]);
    expect(measure(model, "deaths").count).toBe(2);
    expect(measure(model, "visionDiffPerMin")).toMatchObject({ count: 1, matches: [complete] });
    expect(model.roles[0].metrics.goldShare.count).toBe(2);
    expect(model.roles[0].metrics.damageShare).toMatchObject({ count: 1, matches: [complete] });
    expect(model.roles[4].metrics.visionPerMin.count).toBe(2);
  });

  it("requires five complete players for totals and ten for comparisons", () => {
    const selected = match(); selected.participants.pop();
    const model = buildPlaystyleAnalysis([selected]);
    expect(measure(model, "deaths").count).toBe(1);
    expect(measure(model, "deathDiff").count).toBe(0);
    expect(measure(model, "gold10").count).toBe(0);
    expect(measure(model, "fightPace").count).toBe(0);
    expect(measure(model, "visionDiffPerMin").count).toBe(0);
    expect(model.roles[0].metrics.goldShare.count).toBe(1);
    selected.participants.splice(0, 1);
    const allyMissing = buildPlaystyleAnalysis([selected]);
    expect(measure(allyMissing, "deaths").count).toBe(0);
    expect(allyMissing.roles.every((role) => role.metrics.goldShare.count === 0)).toBe(true);
  });

  it("does not accept a duplicated participant as the fifth team member", () => {
    const selected = match();
    selected.participants[4] = { ...selected.participants[0] };
    const model = buildPlaystyleAnalysis([selected]);
    expect(model.metrics.deaths.count).toBe(0);
    expect(model.metrics.gold10.count).toBe(0);
    expect(model.roles[0].games).toBe(0);
    expect(model.resourceFocus).toBe(null);
  });

  it("does not count the same participant on both sides of a timeline or team comparison", () => {
    const selected = match(); selected.participants[5].raw.participantId = 1;
    const model = buildPlaystyleAnalysis([selected]);
    for (const key of ["gold10", "deathDiff", "fightPace", "visionDiffPerMin"]) expect(model.metrics[key].count).toBe(0);
    expect(model.roles.every((role) => role.metrics.cs10Diff.count === 0)).toBe(true);
    expect(model.metrics.deaths.count).toBe(1); // the allied total itself remains complete
  });

  it.each([599999, 605001, 660000])("rejects a %i ms frame as an observation at ten minutes", (timestamp) => {
    const selected = match(); selected.raw.timeline.info.frames[0].timestamp = timestamp;
    const model = buildPlaystyleAnalysis([selected]);
    expect(measure(model, "gold10").count).toBe(0);
    expect(model.roles[0].metrics.cs10Diff.count).toBe(0);
  });

  it("accepts the five-second tolerance without substituting final gold", () => {
    const selected = match(); selected.raw.timeline.info.frames[0].timestamp = 605000;
    expect(buildPlaystyleAnalysis([selected]).metrics.gold10.value).toBe(-1000);
    selected.raw.timeline.info.frames = [];
    selected.participants.forEach((row) => { row.gold = 999999; });
    expect(buildPlaystyleAnalysis([selected]).metrics.gold10).toMatchObject({ value: null, count: 0 });
  });

  it("does not use ten-minute observations for a game that ended before ten minutes", () => {
    const model = buildPlaystyleAnalysis([match("short", { duration: "09:59" })]);
    expect(measure(model, "gold10").count).toBe(0);
    expect(model.roles.every((role) => role.metrics.cs10Diff.count === 0)).toBe(true);
  });

  it("uses compact CS milestones only as recorded and never as gold snapshots", () => {
    const selected = match();
    selected.raw.timeline = {};
    selected.raw.nxt5 = { timelineSummary: { csMilestones: { 1: { cs10: 0 }, 6: { cs10: 15 } } } };
    const model = buildPlaystyleAnalysis([selected]);
    expect(model.roles[0].metrics.cs10Diff).toMatchObject({ value: -15, count: 1 });
    expect(model.roles[1].metrics.cs10Diff.count).toBe(0);
    expect(measure(model, "gold10").count).toBe(0);
  });

  it("keeps objectives unknown for absent counters and empty or partial event logs", () => {
    const selected = match(); delete selected.raw.info.teams;
    selected.raw.timeline.info.frames.push({ timestamp: 900000, events: [{ type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", killerTeamId: 100 }] });
    const model = buildPlaystyleAnalysis([selected]);
    for (const key of ["dragonShare", "baronShare", "towerDiff"]) expect(measure(model, key).count).toBe(0);
    selected.raw.timeline.info.frames = [];
    expect(buildPlaystyleAnalysis([selected]).metrics.dragonShare.count).toBe(0);
  });

  it("accepts an explicit zero dragons against a known positive opponent counter", () => {
    const selected = match(); selected.raw.info.teams[0].objectives.dragon.kills = 0;
    expect(buildPlaystyleAnalysis([selected]).metrics.dragonShare).toMatchObject({ value: 0, count: 1 });
    delete selected.raw.info.teams[1].objectives.dragon;
    expect(buildPlaystyleAnalysis([selected]).metrics.dragonShare.count).toBe(0);
  });

  it("averages objective shares by game, rather than pooling all dragons", () => {
    const a = match("a"); const b = match("b");
    a.raw.info.teams[0].objectives.dragon.kills = 1; a.raw.info.teams[1].objectives.dragon.kills = 0;
    b.raw.info.teams[0].objectives.dragon.kills = 1; b.raw.info.teams[1].objectives.dragon.kills = 4;
    expect(buildPlaystyleAnalysis([a, b]).metrics.dragonShare.value).toBe(60);
  });

  it("requires an unambiguous mapping of allied and enemy Riot teams", () => {
    const selected = match(); selected.participants[0].raw.teamId = 200;
    expect(buildPlaystyleAnalysis([selected]).metrics.dragonShare.count).toBe(0);
    selected.participants.forEach((row) => { row.raw.teamId = 100; });
    expect(buildPlaystyleAnalysis([selected]).metrics.dragonShare.count).toBe(0);
  });

  it("normalizes Riot positions without assigning an unknown or duplicated role", () => {
    const selected = match();
    selected.participants[1].role = "JUNGLE";
    selected.participants[2].role = " MIDDLE ";
    selected.participants[3].role = "BOTTOM";
    selected.participants[4].role = "UTILITY";
    const model = buildPlaystyleAnalysis([selected]);
    expect(model.roles.map((role) => role.role)).toEqual(ROLES);
    expect(model.roles.every((role) => role.games === 1)).toBe(true);
    selected.participants[0].role = "COACH";
    expect(buildPlaystyleAnalysis([selected]).roles[0].games).toBe(0);
    selected.participants[0].role = "MID";
    expect(buildPlaystyleAnalysis([selected]).roles[2].games).toBe(0);
    expect(buildPlaystyleAnalysis([selected]).resourceFocus).toBe(null);
  });

  it("ignores missing duration for totals while withholding rate measurements", () => {
    const selected = match("no-duration", { duration: "" });
    const model = buildPlaystyleAnalysis([selected]);
    expect(measure(model, "deaths").value).toBe(15);
    expect(measure(model, "fightPace").count).toBe(0);
    expect(measure(model, "visionDiffPerMin").count).toBe(0);
    expect(model.roles[0].metrics.visionPerMin.count).toBe(0);
    expect(measure(model, "gold10").count).toBe(1); // the snapshot itself proves ten minutes were played
  });

  it("supports stored raw JSON and nested participant stats", () => {
    const selected = match();
    selected.participants = selected.participants.map((row) => ({ team_key: row.team_key, raw: JSON.stringify({ participant: { ...row, ...row.raw, role: row.role } }) }));
    selected.raw = JSON.stringify(selected.raw);
    const model = buildPlaystyleAnalysis([selected]);
    expect(measure(model, "gold10").value).toBe(-1000);
    expect(measure(model, "deaths").value).toBe(15);
    expect(measure(model, "dragonShare").value).toBe(25);
    expect(model.roles[0].games).toBe(1);
  });

  it("keeps resource ties and reordering from manufacturing a leading role", () => {
    const selected = match(); selected.participants[3].gold = 10000;
    const tied = buildPlaystyleAnalysis([selected]);
    expect(tied.resourceFocus).toBe(null);
    expect(tied.resourceTies).toBe(1);
    const a = match("a"); const b = match("b"); b.participants.reverse();
    expect(buildPlaystyleAnalysis([a]).resourceFocus).toEqual(buildPlaystyleAnalysis([b]).resourceFocus);
    expect(buildPlaystyleAnalysis([a]).roles.map((role) => role.metrics.goldShare.value)).toEqual(buildPlaystyleAnalysis([b]).roles.map((role) => role.metrics.goldShare.value));
  });

  it("deduplicates known games, preserves anonymous games and does not mutate inputs", () => {
    const a = match("a"); const anonymousA = match(null); const anonymousB = match(null);
    const players = [{ role: "MIDDLE", name: "Test roster" }];
    deepFreeze(a); deepFreeze(players);
    const model = buildPlaystyleAnalysis([a, a, { ...a }, anonymousA, anonymousB, null], players);
    expect(model.games).toBe(3);
    expect(model.matches[0]).toBe(a);
    expect(model.roles[2].players).toEqual(["Test roster"]);
    expect(a.participants[2].role).toBe("MID");
  });

  it("labels repetition only after three measurements and two-thirds of matching observations", () => {
    expect(repeatedPlaystyle(1, 1)).toBe(false);
    expect(repeatedPlaystyle(2, 2)).toBe(false);
    expect(repeatedPlaystyle(2, 3)).toBe(true);
    expect(repeatedPlaystyle(3, 5)).toBe(false);
    expect(buildPlaystyleAnalysis([match()]).priority).toBe("observe");
    expect(buildPlaystyleAnalysis([match("1"), match("2"), match("3", { early: 10 })]).priority).toBe("early");
  });

  it("falls back through measured priorities rather than inventing a generic weak role", () => {
    const selected = [match("1", { early: 1000 }), match("2", { early: 1000 }), match("3", { early: 1000 })];
    expect(buildPlaystyleAnalysis(selected).priority).toBe("combat");
    selected.forEach((game) => game.participants.filter((row) => row.team_key === "ALLY").forEach((row) => { row.deaths = 1; }));
    expect(buildPlaystyleAnalysis(selected).priority).toBe("vision");
    selected.forEach((game) => game.participants.filter((row) => row.team_key === "ALLY").forEach((row) => { row.vision = 90; }));
    expect(buildPlaystyleAnalysis(selected).priority).toBe("objectives");
    selected.forEach((game) => { game.raw.info.teams[0].objectives.dragon.kills = 5; });
    expect(buildPlaystyleAnalysis(selected).priority).toBe("resources");
  });
});

let renderer;
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const mount = (props) => { act(() => { renderer = TestRenderer.create(<PlaystyleAnalysis {...props} />); }); return renderer.root; };
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.restoreAllMocks(); });

describe("playstyle progressive reading", () => {
  it("separates three factual axes, one experiment and closed role/method details", () => {
    const root = mount({ matches: [match("1"), match("2"), match("3")] });
    expect(text(renderer.toJSON())).toContain("Tester la préparation des dix premières minutes");
    expect(root.findAllByProps({ className: "playstyle-axis" }).map((section) => text(section.findByType("h4")))).toEqual(["Ressources et contributions", "Combats et vision", "Objectifs pris"]);
    expect(root.findAllByType("details").every((detail) => !detail.props.open)).toBe(true);
    expect(root.findAllByProps({ className: "playstyle-role playstyle-disclosure" }).map((detail) => detail.props["data-role"])).toEqual(ROLES);
    expect(text(renderer.toJSON())).toContain("3 / 3 parties mesurées");
    expect(text(renderer.toJSON())).not.toContain("Contribuer davantage aux combats");
  });

  it("shows a small sample as a limited observation rather than a habitual strength", () => {
    const root = mount({ matches: [match("1", { early: 5000 })] });
    expect(text(root.findByProps({ className: "playstyle-sample" }))).toContain("Moins de 3 parties");
    const resources = root.findAllByProps({ className: "playstyle-axis" })[0];
    expect(text(resources)).toContain("1 / 1 partie mesurée");
    expect(text(renderer.toJSON())).toContain("Construire un point de comparaison sur trois parties");
  });

  it("keeps absent values explicit and source controls disabled without measured games", () => {
    const root = mount({ matches: [{ id: "empty", participants: [] }], onOpenSources: vi.fn() });
    expect(text(root.findByProps({ className: "playstyle-empty" }))).toContain("ne permettent pas encore");
    expect(root.findAllByType("dd").every((dd) => text(dd) === "—")).toBe(true);
    expect(root.findAllByType("button").every((button) => button.props.disabled)).toBe(true);
    expect(text(renderer.toJSON())).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("distinguishes role presence from the actual coverage of its statistics", () => {
    const selected = { id: "role-only", participants: [{ team_key: "ALLY", role: "MID" }] };
    const root = mount({ matches: [selected] });
    const mid = root.findAllByProps({ "data-role": "MID" })[0];
    expect(text(mid.findByType("summary"))).toContain("1 / 1 partie à ce poste");
    expect(text(mid.findByType("dl"))).toContain("0 / 1 partie mesurée");
    expect(mid.findAllByType("dd").every((value) => text(value) === "—")).toBe(true);
  });

  it("opens only the exact measured source matches with per-game evidence and safe modality", () => {
    const a = match("a"); const missing = match("missing"); missing.participants = [];
    const sourceGames = deepFreeze([{ id: "a", match: a, title: "Partie test", topRoleDetail: "legacy" }, { id: "missing", match: missing, title: "Partie sans chronologie" }]);
    const onOpenSources = vi.fn();
    const root = mount({ matches: [a, missing], sourceGames, onOpenSources });
    const combat = root.findAllByProps({ className: "playstyle-axis" })[1];
    act(() => combat.findByType("button").props.onClick());
    const payload = onOpenSources.mock.calls[0][0];
    expect(payload.playstyle).toBe(true);
    expect(payload.games).toHaveLength(1);
    expect(payload.games[0].match).toBe(a);
    expect(payload.games[0].title).toBe("Partie test");
    expect(payload.games[0].playstyleEvidence).toContainEqual({ label: "Morts de l’équipe / partie", value: "15,0" });
    expect(payload.games[0].playstyleRead).toContain("Mesures de cette partie");
    expect(sourceGames[0]).not.toHaveProperty("playstyleEvidence");
  });

  it("keeps resource sources accessible even when every role ties", () => {
    const selected = match(); selected.participants[3].gold = 10000;
    const onOpenSources = vi.fn();
    const root = mount({ matches: [selected], onOpenSources });
    const resources = root.findAllByProps({ className: "playstyle-axis" })[0];
    expect(resources.findByType("button").props.disabled).toBe(false);
    act(() => resources.findByType("button").props.onClick());
    expect(onOpenSources.mock.calls[0][0].games[0].playstyleEvidence).toHaveLength(10);
    expect(text(resources)).toContain("ex æquo");
  });

  it("keeps unnamed games and their source titles distinct instead of merging empty identifiers", () => {
    const a = match(""); const b = match("", { early: 500 });
    const onOpenSources = vi.fn();
    const root = mount({ matches: [a, b], sourceGames: [{ match: a, title: "Import A" }, { match: b, title: "Import B" }], onOpenSources });
    const resources = root.findAllByProps({ className: "playstyle-axis" })[0];
    act(() => resources.findByType("button").props.onClick());
    expect(onOpenSources.mock.calls[0][0].games.map((game) => game.title)).toEqual(["Import A", "Import B"]);
    expect(onOpenSources.mock.calls[0][0].games.map((game) => game.match)).toEqual([a, b]);
  });

  it("includes the actual mortality comparison supporting the combat finding in sources", () => {
    const selected = match(); const onOpenSources = vi.fn();
    const root = mount({ matches: [selected], onOpenSources });
    const combat = root.findAllByProps({ className: "playstyle-axis" })[1];
    act(() => combat.findByType("button").props.onClick());
    expect(onOpenSources.mock.calls[0][0].games[0].playstyleEvidence).toContainEqual({ label: "Écart de morts / partie", value: "+5,0" });
  });

  it("retains source coverage after an ordinary prop update and never attributes roster role totals to one player", () => {
    const root = mount({ matches: [match("a")], players: [{ name: "Roster test", role: "MID" }] });
    expect(text(root)).toContain("Les mesures regroupent les joueurs ayant occupé ce poste, y compris les remplaçants");
    expect(text(root)).toContain("Profils du roster à ce poste : Roster test");
    act(() => renderer.update(<PlaystyleAnalysis matches={[match("a"), match("b")]} players={[]} />));
    expect(text(renderer.toJSON())).toContain("2 parties sélectionnées");
    expect(text(renderer.toJSON())).not.toContain("Roster test");
  });

  it("preserves the explicit entry to existing player proposals without rendering legacy claims", () => {
    const onOpenContracts = vi.fn();
    const root = mount({ matches: [match()], onOpenContracts });
    const button = root.findAllByType("button").find((item) => text(item).includes("propositions d’objectifs par joueur"));
    act(() => button.props.onClick());
    expect(onOpenContracts).toHaveBeenCalledOnce();
    expect(text(root)).toContain("pas un objectif déjà validé");
  });
});
