import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchHeadToHead, MatchLineups, getMatchRolePairs, matchRoleSlots } from "../components/games/MatchHeadToHead.jsx";
import { Button } from "../components/ui/Core.jsx";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const renderers = [];
afterEach(() => renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())));
function game() {
  return { id: "visual-game", side: "red", opponent: "Rivals", participants: ["ALLY", "ENEMY"].flatMap((teamKey, teamIndex) => roles.map((role, index) => ({
    id: `${teamKey}-${role}`, team_key: teamKey, role, champion: teamKey === "ALLY" ? "Ahri" : "Jinx", summoner_name: `${teamKey} ${role}`,
    gold: 10000 + (teamKey === "ALLY" ? [2000, -1000, 0, 500, 0][index] : 0), damage: 5000 + (teamKey === "ALLY" ? 500 : 0), vision: 0,
    raw: { participantId: teamIndex * 5 + index + 1, teamId: teamKey === "ALLY" ? 200 : 100 },
  }))) };
}
function snapshot(match = game()) { return buildGamePublicationSnapshot({ team: { name: "Team Atlas" }, match }); }
function render(Component = MatchHeadToHead, props = {}) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<Component snapshot={snapshot()} {...props} />); });
  renderers.push(renderer);
  return renderer;
}
const text = (node) => typeof node === "string" ? node : (node.children || []).map(text).join("");
const row = (renderer, role) => renderer.root.findByProps({ "data-role": role }).findByProps({ className: "mhh-row" });
function chooseMetric(renderer, name) {
  const button = renderer.root.findAllByType(Button).find((node) => text(node) === name);
  act(() => button.props.onClick());
}

describe("visual match role assignments", () => {
  it("orders roles explicitly and accepts canonical Riot aliases", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "ADC").role = " BOT ";
    value.participants.reverse();
    const { teams, unresolved } = matchRoleSlots(value);
    expect(teams.ALLY.map((slot) => slot.role)).toEqual(roles);
    expect(teams.ALLY[3].row.name).toBe("ALLY ADC");
    expect(unresolved).toHaveLength(0);
  });

  it("keeps missing, duplicated and unknown roles out of pair comparisons", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP").role = "SUB";
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "SUP").role = "MID";
    const { teams, unresolved } = matchRoleSlots(value);
    expect(teams.ALLY[0]).toMatchObject({ row: null, status: "missing" });
    expect(teams.ALLY[2]).toMatchObject({ row: null, status: "ambiguous" });
    expect(unresolved.map((item) => item.name).sort()).toEqual(["ALLY MID", "ALLY SUP", "ALLY TOP"]);
    expect(getMatchRolePairs(value)[2]).toMatchObject({ role: "MID", ally: null });
    expect(getMatchRolePairs(value)[1].ally.name).toBe("ALLY JGL");
  });

  it("does not pair duplicated participant identities even across different roles and teams", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ENEMY" && item.role === "JGL").participantId = 1;
    const { teams, unresolved } = matchRoleSlots(value);
    expect(teams.ALLY[0]).toMatchObject({ row: null, status: "ambiguous" });
    expect(teams.ENEMY[1]).toMatchObject({ row: null, status: "ambiguous" });
    expect(unresolved).toHaveLength(2);
  });
});

describe("match head-to-head", () => {
  it("compares five roles at one common signed scale and keeps measured zero empty", () => {
    const renderer = render();
    const top = row(renderer, "TOP");
    const jungle = row(renderer, "JGL");
    expect(top.props["data-tone"]).toBe("positive");
    expect(top.findByProps({ className: "mhh-fill" }).props.style).toEqual({ width: "50%", left: "0%" });
    expect(jungle.props["data-tone"]).toBe("negative");
    expect(jungle.findByProps({ className: "mhh-fill" }).props.style).toEqual({ width: "25%", left: "50%" });
    expect(row(renderer, "MID").findByProps({ className: "mhh-fill" }).props.style.width).toBe("0%");
    expect(row(renderer, "MID").props["data-tone"]).toBe("equal");
  });

  it("switches one chosen metric, including all-zero vision without fabricating missing values", () => {
    const renderer = render();
    chooseMetric(renderer, "Dégâts");
    expect(text(row(renderer, "TOP"))).toContain("+500");
    expect(text(renderer.root)).toContain("Dégâts aux champions");
    chooseMetric(renderer, "Vision");
    for (const role of roles) {
      expect(row(renderer, role).props["data-tone"]).toBe("equal");
      expect(row(renderer, role).findByProps({ className: "mhh-fill" }).props.style.width).toBe("0%");
    }
    expect(text(renderer.root)).not.toContain("Comparaison indisponible");
    expect(renderer.root.findAllByType(Button).map((node) => node.props["aria-pressed"])).toEqual([false, false, true]);
  });

  it("distinguishes missing, invalid and zero measures", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP").gold = null;
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "JGL").gold = -1;
    const renderer = render(MatchHeadToHead, { snapshot: value });
    for (const role of ["TOP", "JGL"]) {
      expect(row(renderer, role).props["data-tone"]).toBe("missing");
      expect(text(row(renderer, role))).toContain("Comparaison indisponible");
      expect(text(row(renderer, role).findByProps({ className: "mhh-difference" }))).toBe("Écart : —");
      expect(row(renderer, role).findByProps({ className: "mhh-fill" }).props.style.width).toBe("0%");
    }
    expect(row(renderer, "MID").props["data-tone"]).toBe("equal");
  });

  it("opens and closes only reliable roles while keeping the selected state explicit", () => {
    const onSelectRole = vi.fn();
    const value = snapshot();
    value.participants = value.participants.filter((item) => !(item.teamKey === "ALLY" && item.role === "SUP"));
    const renderer = render(MatchHeadToHead, { snapshot: value, selectedRole: "TOP", onSelectRole });
    expect(row(renderer, "TOP").props["aria-expanded"]).toBe(true);
    act(() => row(renderer, "TOP").props.onClick());
    act(() => row(renderer, "MID").props.onClick());
    expect(onSelectRole.mock.calls).toEqual([[""], ["MID"]]);
    expect(row(renderer, "SUP").props.disabled).toBe(true);
  });

  it("keeps our team left even on red side, without translating user names", () => {
    const value = snapshot();
    value.context.teamName = "Vision";
    const renderer = render(MatchHeadToHead, { snapshot: value });
    const teams = renderer.root.findByProps({ className: "mhh-teams" });
    const identities = teams.findAllByProps({ className: "mhh-team-identity" });
    expect(text(identities[0])).toContain("VisionNotre équipeCôté rouge");
    expect(text(identities[1])).toContain("RivalsAdversairesCôté bleu");
  });

  it("links reliable role controls to the supplied detail panel without linking missing roles", () => {
    const value = snapshot();
    value.participants = value.participants.filter((item) => !(item.teamKey === "ALLY" && item.role === "SUP"));
    const renderer = render(MatchHeadToHead, { snapshot: value, selectedRole: "MID", onSelectRole: vi.fn(), detailsId: "match-role-details" });
    expect(row(renderer, "MID").props["aria-controls"]).toBe("match-role-details");
    expect(row(renderer, "MID").props["aria-expanded"]).toBe(true);
    expect(row(renderer, "TOP").props["aria-controls"]).toBe("match-role-details");
    expect(row(renderer, "TOP").props["aria-expanded"]).toBe(false);
    expect(row(renderer, "SUP").props["aria-controls"]).toBeUndefined();
    const standalone = render(MatchHeadToHead, { onSelectRole: vi.fn() });
    expect(row(standalone, "MID").props["aria-controls"]).toBeUndefined();
  });
});

describe("visual match lineups", () => {
  it("renders five explicit role slots per team with original portraits", () => {
    const renderer = render(MatchLineups);
    expect(renderer.root.findAllByType("ol")).toHaveLength(2);
    expect(renderer.root.findAllByProps({ className: "ml-champion" }).map(text)).toEqual([...Array(5).fill("Ahri"), ...Array(5).fill("Jinx")]);
    const teams = renderer.root.findAllByProps({ className: "ml-team" });
    expect(teams.map((node) => node.props["data-team"])).toEqual(["ALLY", "ENEMY"]);
  });

  it("shows unresolved players separately instead of placing a champion in an ambiguous slot", () => {
    const value = snapshot();
    value.participants[0].role = "MID";
    const renderer = render(MatchLineups, { snapshot: value });
    const ally = renderer.root.findByProps({ "data-team": "ALLY" });
    const top = ally.findByProps({ "data-role": "TOP" });
    const mid = ally.findByProps({ "data-role": "MID" });
    expect(text(top)).toContain("Joueur absent");
    expect(text(mid)).toContain("Rôle ambigu");
    expect(mid.findByProps({ className: "mhh-portrait " }).findAllByType("img")).toHaveLength(0);
    expect(text(renderer.root.findByProps({ className: "mhh-unresolved" }))).toContain("ALLY TOP");
    expect(text(renderer.root.findByProps({ className: "mhh-unresolved" }))).toContain("ALLY MID");
  });
});
