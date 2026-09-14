import { describe, expect, it } from "vitest";
import { filterImportedGames, importedGameDurationSeconds, importedGameSide } from "../utils/imported-games.js";

const ids = (matches, options, categories) => filterImportedGames(matches, options, categories).map((match) => match.id);
const game = (id, values = {}) => ({ id, participants: [], ...values });

describe("imported game search", () => {
  const categories = [{ id: "league", name: "Ligue régionale" }, { id: "training", name: "Entraînement" }];
  const example = game("one", {
    raw: { nxt5Label: "Équipe Étoile", metadata: { opponent: "Les vétérans" } },
    game_id: "EUW1_7654321", opponent: "Club Rivière", created_by_name: "Élodie", created_by_account: "coach_nxt5",
    category_id: "league", category_ids: ["training"],
    participants: [{ team_key: "ALLY", summoner_name: "Éclair", riot_id: "Foudre#EUW", player_name: "Lucie", champion: "Jinx", role: "ADC" },
      { team_key: "ENEMY", summoner_name: "Ennemi", champion: "Ornn", role: "TOP" }],
  });

  it("matches every query word across fields, independent of order, case and accents", () => {
    const other = game("other", { opponent: "Équipe Étoile", participants: [{ champion: "Jinx" }] });
    expect(ids([example, other], { query: "  JINX   elodie etoile  " })).toEqual(["one"]);
    expect(ids([example], { query: "jinx champion_absent" })).toEqual([]);
  });

  it.each(["EUW1_7654321", "riviere", "eclair", "foudre#euw", "lucie", "jinx", "adc", "ennemi ornn", "coach_nxt5", "veterans"])("finds loaded metadata and participants: %s", (query) => {
    expect(ids([example], { query }, categories)).toEqual(["one"]);
  });

  it("searches both legacy and multi-category names", () => {
    expect(ids([example], { query: "entrainement regionale" }, categories)).toEqual(["one"]);
    expect(ids([example], { query: "regionale" }, [])).toEqual([]);
  });

  it("searches useful raw participant and match metadata", () => {
    const raw = game("raw", { raw: { label: "Draft scaling" }, participants: [{ raw: { summonerName: "Éclat", riotIdTagline: "TEST", championName: "Ahri", teamPosition: "MIDDLE" } }] });
    expect(ids([raw], { query: "draft eclat ahri middle test" })).toEqual(["raw"]);
  });

  it("finds both played/import dates in raw and French-readable forms", () => {
    const dated = game("dated", { raw: { info: { gameCreation: Date.parse("2026-08-25T12:00:00Z") } }, created_at: "2026-09-08T12:00:00Z" });
    for (const query of ["25/08/2026", "25/08/26", "25 aout 2026", "2026-09-08", "8 septembre 2026", String(dated.raw.info.gameCreation)]) {
      expect(ids([dated], { query })).toEqual(["dated"]);
    }
  });

  it("treats whitespace as an empty query and safely skips absent metadata", () => {
    expect(ids([game("blank")], { query: " \n\t " })).toEqual(["blank"]);
    expect(filterImportedGames()).toEqual([]);
  });
});

describe("imported game filters", () => {
  it("combines query, result, review and side filters", () => {
    const matching = game("yes", { opponent: "Club", result: "Défaite", review_status: "todo", side: "Blue Side" });
    const matches = [matching, ...[
      { id: "win", result: "Victoire" }, { id: "done", review_status: "done" },
      { id: "red", side: "Red Side" }, { id: "name", opponent: "Autre" },
    ].map((override) => ({ ...matching, ...override }))];
    expect(ids(matches, { query: "club", result: "Défaite", review: "todo", side: "blue" })).toEqual(["yes"]);
  });

  it("does not classify unknown results or sides as a defeat or red side", () => {
    const matches = [game("missing"), game("analysis", { result: "Analyse", side: "unknown" }), game("loss", { result: "Défaite", side: "Red Side" })];
    expect(ids(matches, { result: "Défaite" })).toEqual(["loss"]);
    expect(ids(matches, { side: "red" })).toEqual(["loss"]);
    expect(ids(matches)).toEqual(["missing", "analysis", "loss"]);
  });

  it("uses only review_status, with non-done and missing values still to do", () => {
    const matches = [game("todo", { review_status: "todo", report_id: "existing" }), game("missing", { reports: [{ id: "report" }] }), game("pending", { review_status: "in_progress" }), game("done", { review_status: "done" })];
    expect(ids(matches, { review: "todo" })).toEqual(["todo", "missing", "pending"]);
    expect(ids(matches, { review: "done" })).toEqual(["done"]);
  });

  it.each([["Blue Side", "blue"], ["RED", "red"], ["Côté bleu", "blue"], ["côté rouge", "red"], ["uncoloured", ""], [null, ""]])("resolves explicit side %s", (side, expected) => {
    expect(importedGameSide({ side })).toBe(expected);
  });

  it("prefers known allied team IDs and never infers allies from an enemy row", () => {
    expect(importedGameSide({ side: "Red Side", participants: [{ team_key: "ALLY", raw: { teamId: 100 } }] })).toBe("blue");
    expect(importedGameSide({ participants: [{ team_key: "ALLY", raw: { teamId: "200" } }] })).toBe("red");
    expect(importedGameSide({ participants: [{ team_key: "ENEMY", raw: { teamId: 100 } }] })).toBe("");
  });
});

describe("imported game ordering", () => {
  const matches = [game("undated"), game("newer", { game_date: "2026-09-07" }), game("old", { game_date: "2026-08-01" }), game("equal", { game_date: "2026-09-07" }), game("invalid", { game_date: "bad" })];

  it("sorts newest and oldest with missing dates last and equal dates stable", () => {
    expect(ids(matches)).toEqual(["newer", "equal", "old", "undated", "invalid"]);
    expect(ids(matches, { sort: "oldest" })).toEqual(["old", "newer", "equal", "undated", "invalid"]);
  });

  it("prefers the played timestamp over a later import date", () => {
    const lateImport = game("late-import", { raw: { info: { gameCreation: Date.parse("2026-07-01") } }, created_at: "2026-09-08" });
    expect(ids([lateImport, matches[2]])).toEqual(["old", "late-import"]);
  });

  it("sorts durations without promoting unknown values and retains duration ties", () => {
    const durationMatches = [game("missing"), game("short", { duration_seconds: 900 }), game("long", { duration: "42:15" }), game("equal", { duration_seconds: 900 }), game("invalid", { duration: "--:--" })];
    expect(ids(durationMatches, { sort: "longest" })).toEqual(["long", "short", "equal", "missing", "invalid"]);
    expect(ids(durationMatches, { sort: "shortest" })).toEqual(["short", "equal", "long", "missing", "invalid"]);
  });

  it("returns original objects in a new array without mutating frozen input", () => {
    const source = Object.freeze(matches.map((match) => Object.freeze(match)));
    const filtered = filterImportedGames(source);
    expect(filtered).not.toBe(source);
    expect(filtered[0]).toBe(source[1]);
    expect(source.map((match) => match.id)).toEqual(["undated", "newer", "old", "equal", "invalid"]);
  });
});

describe("imported duration parsing", () => {
  it.each([
    [{ duration_seconds: 900, duration: "20:00" }, 900],
    [{ duration_seconds: "1200" }, 1200],
    [{ duration: "35:09" }, 2109],
    [{ duration: "1:02:03" }, 3723],
    [{ raw: { info: { gameDuration: 1555 } } }, 1555],
    [{ duration_seconds: null, duration: "03:15" }, 195],
    [{ duration_seconds: 0 }, null], [{ duration: "00:00" }, null],
    [{ duration_seconds: false }, null], [{ duration_seconds: " " }, null],
    [{ duration_seconds: -5 }, null], [{ duration_seconds: Infinity }, null],
    [{ duration: "20:99" }, null], [{ duration: "1:70:00" }, null],
    [{ duration: "--:--" }, null], [{}, null],
  ])("preserves duration semantics for %j", (match, expected) => {
    expect(importedGameDurationSeconds(match)).toBe(expected);
  });
});
