import { describe, expect, it } from "vitest";
import { suggestImportSide, suggestedImportLabel } from "../utils/import-suggestions.js";

function preview() {
  return {
    gameId: "EUW1_7123456789",
    teams: ["BLUE", "RED"].map((side, teamIndex) => ({
      side,
      participants: Array.from({ length: 5 }, (_, index) => ({
        participantId: teamIndex * 5 + index + 1,
        riotId: `${side} Joueur ${index + 1}#EUW`,
        summonerName: `${side} Joueur ${index + 1}`,
      })),
    })),
  };
}

function rosterFor(match, side) {
  return match.teams.find((team) => team.side === side).participants.map((participant, index) => ({
    id: `${side}-profile-${index + 1}`,
    riot_id: participant.riotId,
    name: participant.summonerName,
  }));
}

describe("safe import side suggestions", () => {
  it.each(["BLUE", "RED"])("recognizes five exact identities on the %s side", (side) => {
    const match = preview();
    expect(suggestImportSide(match, rosterFor(match, side))).toBe(side);
  });

  it("ignores casing and surrounding whitespace while keeping the full Riot ID", () => {
    const match = preview();
    const roster = rosterFor(match, "RED").map((player) => ({ ...player, riot_id: `  ${player.riot_id.toLowerCase()}  ` }));
    match.teams[1].participants[0].riotId = `  ${match.teams[1].participants[0].riotId}  `;
    expect(suggestImportSide(match, roster)).toBe("RED");
  });

  it("accepts an unrelated substitute without requiring the entire roster to be present", () => {
    const match = preview();
    const roster = [...rosterFor(match, "BLUE"), { id: "substitute", riot_id: "Remplaçant#EUW" }];
    expect(suggestImportSide(match, roster)).toBe("BLUE");
  });

  it("leaves the choice manual when only four players match", () => {
    const match = preview();
    expect(suggestImportSide(match, rosterFor(match, "BLUE").slice(0, 4))).toBe("");
  });

  it("leaves the choice manual when both complete sides belong to the roster", () => {
    const match = preview();
    expect(suggestImportSide(match, [...rosterFor(match, "BLUE"), ...rosterFor(match, "RED")])).toBe("");
  });

  it("does not confuse equal game names with different tags", () => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    roster[0].riot_id = roster[0].riot_id.replace("#EUW", "#ALT");
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it("does not use profile display names as Riot IDs", () => {
    const match = preview();
    const roster = rosterFor(match, "BLUE").map((player, index) => ({ ...player, riot_id: `Autre ${index}#EUW`, name: player.riot_id }));
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it("does not use summoner names when a participant's Riot ID is unavailable", () => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    match.teams[0].participants[0].summonerName = roster[0].riot_id;
    delete match.teams[0].participants[0].riotId;
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it.each(["Joueur sans tag", "#EUW", "Joueur#", "Joueur#EUW#ALT", "Joueur#E UW", ""])("does not recognize incomplete or malformed identities: %s", (identity) => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    match.teams[0].participants[0].riotId = identity;
    roster[0].riot_id = identity;
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it("rejects two profiles sharing a matching Riot ID", () => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    roster.push({ ...roster[0], id: "duplicate-profile", riot_id: ` ${roster[0].riot_id.toLowerCase()} ` });
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it("requires five different profile IDs", () => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    roster[1].id = roster[0].id;
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it("rejects a duplicated participant identity even when the other identities are known", () => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    match.teams[0].participants[1].riotId = match.teams[0].participants[0].riotId;
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it.each([0, 4, 6])("requires five participants on each side, including the opponent side (%i)", (count) => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    match.teams[1].participants = Array.from({ length: count }, (_, index) => ({ participantId: index + 6, riotId: `Adversaire ${index}#EUW` }));
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it.each(["missing", "duplicate", "unknown", "extra"])("requires exactly one BLUE and one RED side: %s", (shape) => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    if (shape === "missing") match.teams.pop();
    if (shape === "duplicate") match.teams[1].side = "BLUE";
    if (shape === "unknown") match.teams[1].side = "UNKNOWN";
    if (shape === "extra") match.teams.push({ side: "EXTRA", participants: [] });
    expect(suggestImportSide(match, roster)).toBe("");
  });

  it.each([undefined, null, {}, { teams: [] }])("keeps an unavailable preview manual: %j", (match) => {
    expect(suggestImportSide(match, [])).toBe("");
  });

  it("does not change the preview or roster while making a suggestion", () => {
    const match = preview();
    const roster = rosterFor(match, "BLUE");
    const original = structuredClone({ match, roster });
    expect(suggestImportSide(match, roster)).toBe("BLUE");
    expect({ match, roster }).toEqual(original);
  });
});

describe("editable import label suggestions", () => {
  it.each([
    [{ label: " Finale ", metadata: { label: "Autre" }, opponent: "Adversaire" }, "Finale"],
    [{ label: " ", metadata: { label: " Entraînement " }, opponent: "Adversaire" }, "Entraînement"],
    [{ metadata: { label: " " }, opponent: " Otters " }, "Otters"],
    [{ opponent: " ", metadata: { opponent: " Blue Foxes " } }, "Blue Foxes"],
  ])("preserves the first meaningful supplied label: %j", (payload, expected) => {
    expect(suggestedImportLabel(payload, preview())).toBe(expected);
  });

  it("uses the canonical preview game ID when no name was provided", () => {
    expect(suggestedImportLabel({ info: { gameId: 123 } }, { gameId: " EUW1_7123456789 " })).toBe("EUW1_7123456789");
  });

  it("skips non-text labels instead of exposing object representations", () => {
    const payload = { label: {}, metadata: { label: [], opponent: false }, opponent: 42 };
    expect(suggestedImportLabel(payload, preview())).toBe("EUW1_7123456789");
  });

  it.each([undefined, null, {}, { gameId: " " }, { gameId: 123 }])("does not invent an identifier when a usable canonical ID is missing: %j", (match) => {
    expect(suggestedImportLabel({ info: { gameId: 123 }, metadata: { matchId: "unvalidated" } }, match)).toBe("");
  });

  it.each([undefined, null])("uses the canonical ID even without a payload: %j", (payload) => {
    expect(suggestedImportLabel(payload, preview())).toBe("EUW1_7123456789");
  });
});
