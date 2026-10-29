import { describe, expect, it } from "vitest";
import { buildChampionAnalysis } from "../utils/champion-analysis.js";

const ally = (champion, role, stats = {}) => ({ team_key: "ALLY", champion, role, ...stats });
const enemy = (champion, role) => ({ team_key: "ENEMY", champion, role });
const game = (id, result, participants) => ({ id, team_id: "team", result, participants });
function activeFor(matches, gaps = {}) {
  const matchDrafts = matches.map((match) => ({ match, rows: match.participants.filter((row) => row.team_key === "ALLY"), identity: { gaps: gaps[match.id] || [] } }));
  const picks = [...new Map(matchDrafts.flatMap((entry) => entry.rows.map((row) => [`${row.champion}|${row.role}`, { ...row, tags: ["test"], games: 100, kda: 999 }]))).values()];
  return { games: new Set(matches).size, picks, matchDrafts, identity: { gaps: ["Must not be used"] } };
}
const fullTeam = () => [ally("Ornn", "TOP"), ally("Sejuani", "JGL"), ally("Ahri", "MID"), ally("Jinx", "ADC"), ally("Rakan", "SUP")];

describe("champion analysis evidence", () => {
  it("keeps unknown results out of status thresholds and loss sources", () => {
    const matches = ["Victoire", "Défaite", "Défaite", "Défaite", "pending", ""].map((result, index) => game(index, result, [ally("Ahri", "MID")]));
    const analysis = buildChampionAnalysis(activeFor(matches));
    expect(analysis.picks[0]).toMatchObject({ games: 6, known: 4, wins: 1, losses: 3, unknown: 2, wr: 25, status: "explore", usage: 100, lossMatches: matches.slice(1, 4) });
    const fifthKnown = game("fifth-known", "Défaite", [ally("Ahri", "MID")]);
    expect(buildChampionAnalysis(activeFor([...matches, fifthKnown])).picks[0]).toMatchObject({ known: 5, status: "review" });
    expect(buildChampionAnalysis(activeFor(Array.from({ length: 5 }, (_, i) => game(i, "Victoire", [ally("Ahri", "MID")])))).picks[0].status).toBe("replay");
  });

  it("computes KDA only from complete finite statistics while retaining real zero values", () => {
    const stats = [
      { kills: 0, deaths: 0, assists: 0 },
      { kills: "4", deaths: "2", assists: "6" },
      { kills: 20, assists: 20 },
      { kills: 20, deaths: null, assists: 20 },
      { kills: 20, deaths: "", assists: 20 },
      { kills: 20, deaths: false, assists: 20 },
      { kills: 20, deaths: Infinity, assists: 20 },
      { kills: 20, deaths: -1, assists: 20 },
    ];
    const matches = stats.map((values, i) => game(i, "Victoire", [ally("Ahri", "MID", values)]));
    expect(buildChampionAnalysis(activeFor(matches)).picks[0]).toMatchObject({ kda: 5, kdaGames: 2, games: 8 });
    expect(buildChampionAnalysis(activeFor(matches.slice(2))).picks[0]).toMatchObject({ kda: null, kdaGames: 0 });
    expect(buildChampionAnalysis(activeFor([game("zero-deaths", "Victoire", [ally("Ahri", "MID", { kills: 2, deaths: 0, assists: 3 })])])).picks[0]).toMatchObject({ kda: 5, kdaGames: 1 });
  });

  it("canonicalizes champion and role aliases, retains role distinctions, and deduplicates sources", () => {
    const first = game("first", "Victoire", [ally("Kai'Sa", "BOTTOM", { kills: 2, deaths: 1, assists: 3 })]);
    const second = game("second", "Défaite", [ally("Kaisa", "ADC", { kills: 0, deaths: 2, assists: 1 })]);
    const mid = game("mid", "Victoire", [ally("Kaisa", "MID")]);
    const analysis = buildChampionAnalysis(activeFor([first, { ...first }, second, mid]));
    expect(analysis.picks).toHaveLength(2);
    expect(analysis.picks.find((pick) => pick.id === "Kaisa|ADC")).toMatchObject({ games: 2, known: 2, matches: [first, second], kdaGames: 2, tags: ["test"] });
    expect(analysis.picks.find((pick) => pick.id === "Kaisa|MID")).toMatchObject({ games: 1, matches: [mid] });
    expect(analysis.roleCoverage.find((entry) => entry.role === "ADC")).toMatchObject({ games: 2, repeated: 1 });
    expect(analysis.roleCoverage.map((entry) => entry.role)).toEqual(["TOP", "JGL", "MID", "ADC", "SUP"]);
  });

  it("pairs only unambiguous known roles and gives each association its exact source matches", () => {
    const one = game("one", "Victoire", [ally("Ahri", "MID"), ally("Jarvan IV", "JUNGLE"), enemy("LeBlanc", "MIDDLE")]);
    const two = game("two", "Défaite", [ally("Ahri", "MID"), ally("JarvanIV", "JGL"), enemy("Leblanc", "MID")]);
    const ambiguous = game("ambiguous", "Victoire", [ally("Ahri", "MID"), ally("LeeSin", "JGL"), enemy("Leblanc", "MID"), enemy("Syndra", "MID")]);
    const unknown = game("unknown", "pending", [ally("Ahri", "ROLE"), ally("JarvanIV", "JGL"), enemy("Leblanc", "ROLE")]);
    const analysis = buildChampionAnalysis(activeFor([one, two, ambiguous, unknown]));
    const pick = analysis.picks.find((entry) => entry.id === "Ahri|MID");
    expect(pick.matchups).toHaveLength(1);
    expect(pick.matchups[0]).toMatchObject({ champion: "Leblanc", role: "MID", games: 2, wr: 50, matches: [one, two] });
    expect(pick.partners.find((entry) => entry.champion === "JarvanIV")).toMatchObject({ role: "JGL", games: 2, matches: [one, two] });
    expect(pick.partners.find((entry) => entry.champion === "LeeSin").matches).toEqual([ambiguous]);
    expect(analysis.picks.find((entry) => entry.id === "Ahri|ROLE")).toMatchObject({ matchups: [], partners: [], otherPicks: { games: 0, wr: null } });
  });

  it("compares alternative champions at the same role with no overlapping or missing-role games", () => {
    const own = game("own", "Victoire", [ally("Ahri", "MID"), ally("Ornn", "TOP")]);
    const alternative = game("alternative", "Défaite", [ally("Orianna", "MID")]);
    const unknown = game("unknown", "pending", [ally("Syndra", "MID")]);
    const missing = game("missing", "Victoire", [ally("Ornn", "TOP")]);
    const ambiguous = game("ambiguous", "Victoire", [ally("Orianna", "MID"), ally("Syndra", "MID")]);
    const analysis = buildChampionAnalysis(activeFor([own, alternative, unknown, missing, ambiguous]));
    const pick = analysis.picks.find((entry) => entry.id === "Ahri|MID");
    expect(pick.otherPicks).toMatchObject({ games: 2, known: 1, unknown: 1, losses: 1, wr: 0, matches: [alternative, unknown] });
    expect(pick.otherPicks.matches.some((match) => pick.matches.includes(match))).toBe(false);
  });

  it("counts each gap per complete draft and excludes partial, duplicate-role and unnamed compositions", () => {
    const one = game("one", "Victoire", fullTeam());
    const two = game("two", "pending", fullTeam());
    const partial = game("partial", "Défaite", fullTeam().slice(0, 4));
    const duplicate = game("duplicate", "Défaite", [...fullTeam().slice(0, 4), ally("Rakan", "MID")]);
    const unnamed = game("unnamed", "Défaite", [...fullTeam().slice(0, 4), ally("", "SUP")]);
    const analysis = buildChampionAnalysis(activeFor([one, { ...one }, two, partial, duplicate, unnamed], { one: ["Frontline faible", "Frontline faible"], two: ["Contrôle limité"], partial: ["Frontline faible"], duplicate: ["Frontline faible"], unnamed: ["Frontline faible"] }));
    expect(analysis).toMatchObject({ completeGames: 2, incompleteGames: 3 });
    expect(analysis.signals).toHaveLength(2);
    expect(analysis.signals.find((entry) => entry.label === "Frontline faible")).toMatchObject({ games: 1, known: 1, wr: 100, matches: [one] });
    expect(analysis.signals.find((entry) => entry.label === "Contrôle limité")).toMatchObject({ games: 1, known: 0, unknown: 1, wr: null, matches: [two] });
  });

  it("keeps unrelated matches without IDs separate and handles an empty selection", () => {
    const first = { result: "Victoire", participants: [ally("Ahri", "MID")] };
    const second = { result: "Défaite", participants: [ally("Ahri", "MID")] };
    expect(buildChampionAnalysis(activeFor([first, first, second])).picks[0]).toMatchObject({ games: 2, wr: 50, matches: [first, second] });
    const empty = buildChampionAnalysis();
    expect(empty).toMatchObject({ picks: [], signals: [], completeGames: 0, incompleteGames: 0 });
    expect(empty.roleCoverage).toHaveLength(5);
    expect(empty.roleCoverage.every((entry) => entry.games === 0 && entry.picks.length === 0 && entry.repeated === 0)).toBe(true);
  });
});
