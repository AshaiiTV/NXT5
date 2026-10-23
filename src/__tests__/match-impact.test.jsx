import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";
import { Button } from "../components/ui/Core.jsx";
import { MatchVisualRecap } from "../components/games/MatchVisualRecap.jsx";
import { getTeamDamageLeaders } from "../components/games/match-impact.js";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const renderers = [];
afterEach(() => renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())));
const text = (node) => typeof node === "string" ? node : (node.children || []).map(text).join("");
function fixture() {
  const match = { id: "impact-fixture", side: "red", opponent: "Team Orion", participants: ["ALLY", "ENEMY"].flatMap((teamKey, side) => roles.map((role, index) => ({
    team_key: teamKey, role, summoner_name: `${teamKey} ${role}`, champion: side === 0 ? "Ahri" : "Jinx",
    gold: 10000 + index * 1000, damage: (side === 0 ? [1000, 2000, 4000, 3000, 0] : [3000, 6000, 2000, 1000, 0])[index], vision: index * 10,
    raw: { participantId: side * 5 + index + 1, teamId: side === 0 ? 200 : 100 },
  }))) };
  return { match, snapshot: buildGamePublicationSnapshot({ team: { name: "Team Atlas" }, match }) };
}
function render(props = {}) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<MatchVisualRecap {...fixture()} onCompare={() => {}} {...props} />); });
  renderers.push(renderer);
  return renderer;
}

describe("team champion-damage leaders", () => {
  it("selects the highest damage separately in each team, independent of side, gold or vision", () => {
    const { snapshot } = fixture();
    const ally = getTeamDamageLeaders(snapshot, "ALLY");
    const enemy = getTeamDamageLeaders(snapshot, "ENEMY");
    expect(ally.status).toBe("ready");
    expect(ally.totalDamage).toBe(10000);
    expect(ally.leaders).toMatchObject([{ participant: { name: "ALLY MID", damage: 4000 }, share: 40 }]);
    expect(enemy.leaders).toMatchObject([{ participant: { name: "ENEMY JGL", damage: 6000 }, share: 50 }]);
  });

  it("preserves every joint leader without choosing by participant order", () => {
    const { snapshot } = fixture();
    snapshot.participants.find((row) => row.name === "ALLY ADC").damage = 4000;
    snapshot.participants.reverse();
    const result = getTeamDamageLeaders(snapshot, "ALLY");
    expect(result.leaders.map(({ participant }) => participant.name).sort()).toEqual(["ALLY ADC", "ALLY MID"]);
    for (const leader of result.leaders) expect(leader.share).toBeCloseTo(4000 / 11000 * 100);
  });

  it("does not manufacture a leader or percentage from five measured zeros", () => {
    const { snapshot } = fixture();
    snapshot.participants.filter((row) => row.teamKey === "ALLY").forEach((row) => { row.damage = 0; });
    expect(getTeamDamageLeaders(snapshot, "ALLY")).toEqual({ status: "zero", totalDamage: 0, leaders: [] });
  });

  it.each([null, undefined, NaN, Infinity, -1, "4000"])("withholds the ranking when one team member has invalid damage (%s)", (value) => {
    const { snapshot } = fixture();
    snapshot.participants.find((row) => row.name === "ALLY SUP").damage = value;
    expect(getTeamDamageLeaders(snapshot, "ALLY")).toEqual({ status: "incomplete", totalDamage: null, leaders: [] });
    expect(getTeamDamageLeaders(snapshot, "ENEMY").status).toBe("ready");
  });

  it("withholds a leader when the roster is missing a member or has an extra member", () => {
    const { snapshot } = fixture();
    const removed = snapshot.participants.shift();
    expect(getTeamDamageLeaders(snapshot, "ALLY").status).toBe("incomplete");
    snapshot.participants.push(removed, { ...removed, participantId: 11 });
    expect(getTeamDamageLeaders(snapshot, "ALLY").status).toBe("incomplete");
  });

  it("rejects duplicated participant identities, including duplicates across teams", () => {
    const { snapshot } = fixture();
    snapshot.participants.find((row) => row.teamKey === "ENEMY").participantId = 1;
    expect(getTeamDamageLeaders(snapshot, "ALLY").status).toBe("incomplete");
    expect(getTeamDamageLeaders(snapshot, "ENEMY").status).toBe("incomplete");
  });

  it("does not guess the team of unassigned participants", () => {
    const { snapshot } = fixture();
    snapshot.participants[0].teamKey = null;
    expect(getTeamDamageLeaders(snapshot, "ALLY").status).toBe("incomplete");
    expect(getTeamDamageLeaders(snapshot, "ENEMY").status).toBe("incomplete");
  });

  it("does not require inferred roles or invent participant identifiers for legacy imports", () => {
    const { snapshot } = fixture();
    snapshot.participants.forEach((row) => { row.participantId = null; row.role = ""; });
    expect(getTeamDamageLeaders(snapshot, "ALLY").leaders[0].participant.name).toBe("ALLY MID");
  });

  it("handles absent snapshots and invalid team keys without generating a winner", () => {
    expect(getTeamDamageLeaders(undefined, "ALLY").status).toBe("incomplete");
    expect(getTeamDamageLeaders(fixture().snapshot, "UNKNOWN").status).toBe("incomplete");
  });
});

describe("visual recap impact card", () => {
  it("shows the explicit damage criterion and both team leaders with their team share", () => {
    const renderer = render();
    const card = renderer.root.findByProps({ className: "match-recap-focus-inner" });
    expect(text(card)).toContain("Qui a le plus d’impact ?");
    expect(text(card)).toContain("Dégâts aux champions");
    const teams = card.findAllByProps({ className: "match-impact-team" });
    expect(teams.map((node) => node.props["data-team"])).toEqual(["ALLY", "ENEMY"]);
    expect(text(teams[0])).toContain("Team AtlasNotre équipeALLY MIDAhri");
    expect(text(teams[0])).toContain("40 % de l’équipe");
    expect(text(teams[1])).toContain("Team OrionAdversairesENEMY JGLJinx");
    expect(text(teams[1])).toContain("50 % de l’équipe");
    expect(text(renderer.root)).not.toContain("Un écart final ne suffit pas à expliquer le résultat.");
    expect(text(card)).not.toContain("Point à explorer");
  });

  it("opens team comparison with no implied selected role", () => {
    const onCompare = vi.fn();
    const renderer = render({ onCompare });
    const button = renderer.root.findAllByType(Button).find((node) => text(node) === "Comparer les équipes");
    act(() => button.props.onClick());
    expect(onCompare).toHaveBeenCalledExactlyOnceWith();
  });

  it("displays all tied leaders and marks the tie", () => {
    const { snapshot, match } = fixture();
    snapshot.participants.find((row) => row.name === "ALLY ADC").damage = 4000;
    const renderer = render({ snapshot, match });
    const ally = renderer.root.findAllByProps({ className: "match-impact-team" })[0];
    expect(text(ally)).toContain("Ex æquo");
    expect(ally.findAllByProps({ className: "match-impact-player" })).toHaveLength(2);
  });

  it("keeps incomplete and measured-zero teams explicit without leader portraits or percentage bars", () => {
    const { snapshot, match } = fixture();
    snapshot.participants.forEach((row) => { row.damage = row.teamKey === "ALLY" ? null : 0; });
    const renderer = render({ snapshot, match });
    const card = renderer.root.findByProps({ className: "match-recap-focus-inner" });
    expect(text(card)).toContain("Données incomplètes");
    expect(text(card)).toContain("Aucun dégât aux champions");
    expect(card.findAllByProps({ className: "match-impact-player" })).toHaveLength(0);
    expect(card.findAllByProps({ className: "match-impact-track" })).toHaveLength(0);
  });
});
