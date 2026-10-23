import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";
import { MatchKillMap } from "../components/games/MatchKillMap.jsx";
import { MatchVisualRecap } from "../components/games/MatchVisualRecap.jsx";


const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const renderers = [];
afterEach(() => renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())));
const text = (node) => typeof node === "string" ? node : (node.children || []).map(text).join("");
function fixture() {
  const match = { id: "recap-map-fixture", side: "red", opponent: "Team Orion", participants: ["ALLY", "ENEMY"].flatMap((teamKey, side) => roles.map((role, index) => ({
    team_key: teamKey, role, summoner_name: `${teamKey} ${role}`, champion: side === 0 ? "Ahri" : "Jinx",
    gold: 10000 + index * 1000, damage: (side === 0 ? [1000, 2000, 4000, 3000, 0] : [3000, 6000, 2000, 1000, 0])[index], vision: index * 10,
    raw: { participantId: side * 5 + index + 1, teamId: side === 0 ? 200 : 100 },
  }))) };
  return { match, snapshot: buildGamePublicationSnapshot({ team: { name: "Team Atlas" }, match }) };
}
function render(props = {}) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<MatchVisualRecap {...fixture()} {...props} />); });
  renderers.push(renderer);
  return renderer;
}

describe("visual recap map integration", () => {
  it("replaces the impact ranking with the map beside the economic recap", () => {
    const { match, snapshot } = fixture();
    const renderer = render({ match, snapshot });
    const map = renderer.root.findByType(MatchKillMap);
    expect(map.props.match).toBe(match);
    expect(map.props.allyName).toBe("Team Atlas");
    expect(map.props.enemyName).toBe("Team Orion");
    expect(text(renderer.root)).not.toContain("Qui a le plus d’impact ?");
    expect(text(renderer.root)).not.toContain("Comparer les équipes");
    expect(text(renderer.root)).not.toContain("Un écart final ne suffit pas à expliquer le résultat.");
    expect(renderer.root.findAllByProps({ className: "match-impact-team" })).toHaveLength(0);
  });

  it.each([
    { loading: true, error: "" },
    { loading: false, error: "Chargement interrompu" },
  ])("passes detail availability to the map without claiming complete data: %j", (availability) => {
    const renderer = render(availability);
    const map = renderer.root.findByType(MatchKillMap);
    expect(map.props.loading).toBe(availability.loading);
    expect(map.props.error).toBe(availability.error);
  });
});
