import { describe, expect, it } from "vitest";
import { filterImportedGames, importedGameDurationSeconds, importedGameImportTimestamp, importedGameSide } from "../utils/imported-games.js";

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
  it("filters category IDs across legacy and multi-category imports without needing category labels", () => {
    const matches = [
      game("legacy", { category_id: "scrim" }),
      game("multiple", { category_ids: ["league", "scrim"] }),
      game("other", { category_ids: ["league"] }),
      game("number", { category_id: 42 }),
      game("missing"),
    ];
    expect(ids(matches, { category: "scrim" })).toEqual(["legacy", "multiple"]);
    expect(ids(matches, { category: "42" })).toEqual(["number"]);
    expect(ids(matches, { category: "unknown" })).toEqual([]);
    expect(ids(matches, { category: "" })).toEqual(matches.map((match) => match.id));
  });

  it("combines category filtering with search, result, review and side", () => {
    const matching = game("yes", { opponent: "Club", result: "Défaite", review_status: "todo", side: "Blue Side", category_ids: ["league", "scrim"] });
    const matches = [matching, ...[
      { id: "category", category_ids: ["league"] }, { id: "result", result: "Victoire" },
      { id: "review", review_status: "done" }, { id: "side", side: "Red Side" }, { id: "name", opponent: "Autre" },
    ].map((override) => ({ ...matching, ...override }))];
    expect(ids(matches, { category: "scrim", query: "club", result: "Défaite", review: "todo", side: "blue" })).toEqual(["yes"]);
  });

  it("selects only truly uncategorized games, including empty legacy metadata", () => {
    const matches = [
      game("missing"), game("empty", { category_id: null, category_ids: [] }),
      game("blank", { category_id: " ", category_ids: ["", null] }),
      game("legacy", { category_id: "scrim", category_ids: [] }),
      game("unlisted", { category_ids: ["deleted-category"] }),
    ];
    expect(ids(matches, { category: "__uncategorized__" }, [])).toEqual(["missing", "empty", "blank"]);
  });

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

  it("sorts imports independently of played dates without changing the default game ordering", () => {
    const imports = [
      game("older-import", { imported_at: "2026-09-01", game_date: "2026-08-30" }),
      game("newer-import", { created_at: "2026-09-07", game_date: "2026-07-01", raw: { info: { gameCreation: Date.parse("2026-07-01") } } }),
    ];
    expect(ids(imports, { sort: "import-newest" })).toEqual(["newer-import", "older-import"]);
    expect(ids(imports, { sort: "import-oldest" })).toEqual(["older-import", "newer-import"]);
    expect(ids(imports)).toEqual(["older-import", "newer-import"]);
  });

  it("keeps missing import dates last and equal import dates stable in both directions", () => {
    const imports = [
      game("played-only", { game_date: "2026-09-08" }),
      game("newer", { imported_at: "2026-09-07" }),
      game("older", { created_at: "2026-09-01" }),
      game("equal", { createdAt: "2026-09-07" }),
      game("invalid", { imported_at: "bad", created_at: "bad" }),
    ];
    const source = Object.freeze(imports.map((match) => Object.freeze(match)));
    expect(ids(source, { sort: "import-newest" })).toEqual(["newer", "equal", "older", "played-only", "invalid"]);
    expect(ids(source, { sort: "import-oldest" })).toEqual(["older", "newer", "equal", "played-only", "invalid"]);
    expect(source.map((match) => match.id)).toEqual(["played-only", "newer", "older", "equal", "invalid"]);
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

describe("import date resolution", () => {
  it("prefers explicit import time over the stored creation timestamps", () => {
    expect(importedGameImportTimestamp({ imported_at: "2026-09-01", created_at: "2026-09-02", createdAt: "2026-09-03" })).toBe(Date.parse("2026-09-01"));
  });

  it("uses the next valid creation date when earlier import metadata is missing or invalid", () => {
    expect(importedGameImportTimestamp({ imported_at: "bad", created_at: "2026-09-02", createdAt: "2026-09-03" })).toBe(Date.parse("2026-09-02"));
    expect(importedGameImportTimestamp({ imported_at: " ", created_at: null, createdAt: "2026-09-03" })).toBe(Date.parse("2026-09-03"));
    expect(importedGameImportTimestamp({ created_at: Date.parse("2026-09-03") / 1000 })).toBe(Date.parse("2026-09-03"));
  });

  it("never substitutes played dates for unknown import dates", () => {
    expect(importedGameImportTimestamp({ imported_at: "bad", created_at: false, createdAt: "", game_date: "2026-09-08", date: "2026-09-08", raw: { info: { gameStartTimestamp: Date.parse("2026-09-08") } } })).toBeNull();
    expect(importedGameImportTimestamp()).toBeNull();
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
