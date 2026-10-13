import { describe, expect, it } from "vitest";
import { getHomePlayerDebrief } from "../utils/home-player-debrief.js";

const player = { id: "alice", team_id: "team", user_id: "user", name: "Alice", riot_id: "Alice#EUW", role: "MID" };
const group = (id = "group", extra = {}) => ({ id, team_id: "team", name: "Scrim", match_ids: ["one", "two"], created_at: "2026-10-13", ...extra });
const report = (id = "report", extra = {}) => ({ id, team_id: "team", match_ids: ["one", "two"], created_at: "2026-10-13", content: "### MID · Alice\n- Consigne Alice.", ...extra });
const match = (id = "one", participants = [], extra = {}) => ({ id, team_id: "team", participants, ...extra });
const participant = (extra = {}) => ({ player_id: player.id, team_key: "ALLY", role: "MID", summoner_name: "Alice", riot_id: "Alice#EUW", ...extra });
const read = (data = {}, options = {}) => getHomePlayerDebrief({ teamId: "team", player, data: { matchArchives: [group()], reports: [report()], players: [player], ...data }, ...options });
const lines = (result) => result.sections.flatMap((section) => section.lines);

describe("home player debrief source", () => {
  it("selects the newest group and its newest published exact-match review, without mutating inputs", () => {
    const groups = Object.freeze([group("older", { created_at: "2026-10-01", match_ids: ["old"] }), group("z"), group("a")]);
    const newest = report("z", { match_ids: JSON.stringify(["two", "one", "one"]) });
    const reports = Object.freeze([report("partial", { match_ids: ["one"], created_at: "2026-10-15" }),
      report("superset", { match_ids: ["one", "two", "other"], created_at: "2026-10-15" }),
      report("draft", { discord_status: "draft", created_at: "2026-10-15" }), newest, report("a")]);
    const result = read({ matchArchives: groups, reports });
    expect(result.group.id).toBe("z");
    expect(result.report).toBe(newest);
    expect(groups[0].id).toBe("older");
    expect(reports[0].id).toBe("partial");
  });

  it.each([[], ["new"], ["one", "two", null], "bad"])("does not fall back from the newest incomplete group (%j)", (match_ids) => {
    const newest = group("new", { match_ids, created_at: "2026-10-14" });
    expect(read({ matchArchives: [group(), newest] })).toEqual({ group: newest, report: null, sections: [] });
  });

  it("accepts serialized group IDs and legacy single-match reports", () => {
    const legacy = report("legacy", { match_ids: "bad", match_id: "one" });
    expect(read({ matchArchives: [group("one-game", { match_ids: '["one"]' })], reports: [legacy] }).report).toBe(legacy);
    expect(read({ matchArchives: [group("one-game", { match_ids: ["one"] })], reports: [{ ...legacy, match_ids: [] }] }).report).toBeNull();
  });

  it("ignores changed dates, invalid dates, foreign teams and malformed collections", () => {
    expect(read({ matchArchives: [group(), group("undated", { created_at: "bad", updated_at: "2026-11-01" }), group("foreign", { team_id: "other", created_at: "2026-11-01" })],
      reports: [report(), report("foreign", { team_id: "other", created_at: "2026-11-01" }), null] }).report.id).toBe("report");
    expect(getHomePlayerDebrief()).toEqual({ group: null, report: null, sections: [] });
    expect(getHomePlayerDebrief({ data: null })).toEqual({ group: null, report: null, sections: [] });
    expect(read({ matchArchives: {}, reports: "bad" }).group).toBeNull();
    expect(read({ matchArchives: [] }).report).toBeNull();
    expect(read({}, { teamId: "other" }).group).toBeNull();
    expect(read({}, { player: { ...player, team_id: "other" } }).sections).toEqual([]);
    expect(read({}, { player: null }).sections).toEqual([]);
  });

  it("never includes a draft, even when there is no published review", () => {
    expect(read({ reports: [report("draft", { discord_status: "draft" })] }).report).toBeNull();
  });
});

describe("home player debrief extraction", () => {
  it("preserves only the player's observations and distinguishes V3 analysis from personal notes", () => {
    const content = "VERDICT COACH\n- Alice et Bob doivent se coordonner.\n## GAME 1 · Alterna\nLECTURE PAR JOUEUR\n### MID · Alice\n- Catch : revoir 14:20.\n- Lane : conserver la priorité.\n### TOP · Bob\n- Remarque Bob.\nPLAN D’EXÉCUTION\n- Consigne collective.\n[NXT5_REPORT_V3]\nNotes staff\nUne note globale mentionne Alice.\n### Alice\n- Annonce ton reset.\n### Bob\n- Note Bob.\n## Objectif équipe\n- Note collective finale.";
    expect(read({ reports: [report("saved", { content })] }).sections).toEqual([
      { heading: "GAME 1 · Alterna · MID · Alice", lines: ["Catch : revoir 14:20.", "Lane : conserver la priorité."], source: "analysis" },
      { heading: "Alice", lines: ["Annonce ton reset."], source: "notes" },
    ]);
  });

  it("stops at other markdown levels, plain role headings, structural headings and markers", () => {
    const content = "### Alice\n- One.\n#### Collectif\n- Hidden.\n### Alice\n- Two.\nTOP · Bob\n- Hidden.\n### Alice\n- Three.\nOBJECTIF PRINCIPAL:\n- Hidden.\n### Alice\n- Four.\n[NXT5_REPORT_V3]\nNotes staff\n- Hidden.\n### Alice\n- Five.\nRÉSUMÉ COLLECTIF\n- Hidden.";
    expect(lines(read({ reports: [report("saved", { content })] }))).toEqual(["One.", "Two.", "Three.", "Four.", "Five."]);
  });

  it("supports CRLF, named personal note headers and complete Riot IDs", () => {
    const content = "[NXT5_REPORT_V3]\r\nNotes staff\r\n## Notes pour Alice\r\n• Reset.\r\n### Joueur : Alice#EUW\r\n1. Call.\r\n### MID · Bob\r\n- Hidden.";
    expect(lines(read({ reports: [report("saved", { content })] }))).toEqual(["Reset.", "Call."]);
  });

  it("keeps legacy V2 and free text as saved notes, never claiming generated provenance", () => {
    const content = "### MID · Alice\n- Texte corrigé.\n[NXT5_REPORT_V2]\nNotes conservées\n### Alice\n- Ma consigne.";
    const result = read({ reports: [report("legacy", { content })] });
    expect(result.sections.map((section) => section.source)).toEqual(["notes", "notes"]);
    expect(lines(result)).toEqual(["Texte corrigé.", "Ma consigne."]);
    expect(lines(read({ reports: [report("empty", { content: "Alice doit reset.\n- Texte global." })] }))).toEqual([]);
    expect(lines(read({ reports: [report("empty", { content: "### Alice\n\n### Bob\n- Other." })] }))).toEqual([]);
  });

  it("does not attribute explicitly adversarial sections to the player's name", () => {
    const content = "## Adversaires\n### MID · Alice\n- Hidden opponent.\n## Notre équipe\n### MID · Alice\n- Ally.";
    expect(lines(read({ reports: [report("saved", { content })] }))).toEqual(["Ally."]);
  });

  it.each([
    "## Adversaires\nLECTURE PAR JOUEUR\n### MID · Alice",
    "## Adversaires\nMID · Alice",
    "Adversaires\nLECTURE PAR JOUEUR\n### MID · Alice",
    "Équipe adverse :\n### MID · Alice",
  ])("keeps adversarial scope through plain headings (%s)", (opponent) => {
    const content = `${opponent}\n- Hidden opponent.\nNotre équipe\nLECTURE PAR JOUEUR\n### MID · Alice\n- Ally.`;
    expect(lines(read({ reports: [report("saved", { content })] }))).toEqual(["Ally."]);
  });

  it.each(["Focus", "Validation"])("requires an explicit player heading for the structural alias %s", (name) => {
    const named = { ...player, name, riot_id: `${name}#EUW` };
    const content = `${name.toUpperCase()}\n- Collective.\n### ${name.toUpperCase()} :\n- Collective heading.\n### MID · ${name}\n- Personal analysis.\n### Joueur : ${name}\n- Personal instruction.`;
    expect(lines(read({ players: [named], reports: [report("saved", { content })] }, { player: named })))
      .toEqual(["Personal analysis.", "Personal instruction."]);
  });
});

describe("home player identity", () => {
  it("uses saved participant aliases across a name and role change, including a substitute", () => {
    const renamed = { ...player, name: "New name", riot_id: "New account#EUW", role: "SUB" };
    const content = "### TOP · Old name\n- Top observation.\n### JGL · Alice#OLD\n- Jungle observation.\n### MID · Someone else\n- Hidden.";
    const result = read({ players: [renamed], reports: [report("saved", { content })], matches: [
      match("one", [participant({ role: "TOP", player_name: "Old name" })]),
      match("two", [participant({ role: "JGL", riot_id: "Alice#OLD" })]),
    ] }, { player: renamed });
    expect(lines(result)).toEqual(["Top observation.", "Jungle observation."]);
  });

  it("never falls back to the role or adds aliases from an opponent or another team", () => {
    const content = "### MID · Enemy\n- Hidden enemy.\n### MID · Foreign\n- Hidden foreign.\n### MID · Substitute\n- Hidden sub.\n### MID\n- Hidden role.";
    expect(lines(read({ reports: [report("saved", { content })], matches: [
      match("one", [participant({ summoner_name: "Enemy", team_key: "ENEMY" }), participant({ player_id: "sub", summoner_name: "Substitute", riot_id: "Substitute#EUW" })]),
      match("two", [participant({ summoner_name: "Foreign" })], { team_id: "other" }),
    ] }))).toEqual([]);
  });

  it("rejects ambiguous roster names and game names with different Riot tags", () => {
    const other = { id: "other", team_id: "team", name: "Alice", riot_id: "Alice#OTHER", role: "MID" };
    const content = "### MID · Alice\n- Ambiguous.\n### MID · Alice#EUW\n- Exact account.";
    expect(lines(read({ players: [player, other], reports: [report("saved", { content })] }))).toEqual(["Exact account."]);
  });

  it("rejects participant aliases shared with a different player or an enemy", () => {
    const content = "### MID · Alice\n- Ambiguous name.\n### MID · Alice#EUW\n- Exact account.";
    for (const conflicting of [participant({ player_id: "someone", riot_id: "Other#EUW" }), participant({ team_key: "ENEMY", riot_id: "Other#EUW" })]) {
      expect(lines(read({ reports: [report("saved", { content })], matches: [match("one", [participant(), conflicting])] }))).toEqual(["Exact account."]);
    }
  });

  it("does not let matching names or Riot IDs override another persisted player ID", () => {
    expect(lines(read({ matches: [match("one", [participant({ player_id: "another" })])] }))).toEqual([]);
    expect(lines(read({ matches: [match("one", [participant({ player_id: "", riot_id: "Another#EUW" })])] }))).toEqual([]);
  });

  it("supports unassigned participants with the full matching Riot ID, without trusting a contradictory ID", () => {
    const content = "### ADC · Recorded name\n- Saved observation.";
    const data = { reports: [report("saved", { content })], matches: [match("one", [participant({ player_id: "", summoner_name: "Recorded name", role: "ADC" })])] };
    expect(lines(read(data))).toEqual(["Saved observation."]);
    expect(lines(read({ ...data, matches: [match("one", [participant({ player_id: "another", summoner_name: "Recorded name" })])] }))).toEqual([]);
  });

  it("does not infer a profile from absent or anonymous participant information", () => {
    const content = "### MID · Joueur inconnu\n- Hidden.\n### MID · Ahri\n- Hidden champion.";
    expect(lines(read({ reports: [report("saved", { content })], matches: [match("one", [participant({ summoner_name: "", riot_id: "", champion: "Ahri" })])] }))).toEqual([]);
    expect(lines(read({}, { player: { id: "alice", team_id: "team" } }))).toEqual([]);
    expect(lines(read({ reports: [report("saved", { content: null })] }))).toEqual([]);
  });
});
