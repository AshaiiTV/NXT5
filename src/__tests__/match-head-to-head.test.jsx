import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { MatchHeadToHead, MatchLineups, getMatchRolePairs, matchRoleSlots } from "../components/games/MatchHeadToHead.jsx";
import { HudIcon } from "../pages/workspace/workspace-shared.jsx";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const renderers = [];
afterEach(() => renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())));
function game() {
  return { id: "visual-game", side: "red", result: "Victoire", opponent: "Rivals", participants: ["ALLY", "ENEMY"].flatMap((teamKey, teamIndex) => roles.map((role, index) => ({
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
const visibleText = (node) => typeof node === "string" ? node : node.props.className?.split(" ").includes("sr-only") ? "" : (node.children || []).map(visibleText).join("");
const row = (renderer, role) => renderer.root.findByProps({ "data-role": role }).findByProps({ className: "mhh-row" });
const metric = (renderer, role, name) => row(renderer, role).findByProps({ "data-metric": name });
const expanded = (renderer, role) => renderer.root.findByProps({ "data-role": role }).findByProps({ className: "mhh-details" });
function openRole(renderer, role) {
  const button = row(renderer, role).findByProps({ "aria-label": `Repères du rôle ${role}` });
  if (!button.props["aria-expanded"]) act(() => button.props.onClick());
  return expanded(renderer, role);
}
const secondaryMetric = (renderer, role, name) => openRole(renderer, role).findByProps({ "data-metric": name });
const secondaryValues = (node) => node.children.map(visibleText);

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
  });
  it("does not pair duplicated participant identities across teams", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ENEMY" && item.role === "JGL").participantId = 1;
    const { teams, unresolved } = matchRoleSlots(value);
    expect(teams.ALLY[0].status).toBe("ambiguous");
    expect(teams.ENEMY[1].status).toBe("ambiguous");
    expect(unresolved).toHaveLength(2);
  });
});

describe("match head-to-head table", () => {
  it("keeps blue left and red right even when our team is red", () => {
    const value = snapshot();
    value.context.teamName = "Vision";
    const renderer = render(MatchHeadToHead, { snapshot: value });
    const teams = renderer.root.findByProps({ className: "mhh-teams" }).children;
    expect(teams.map((item) => item.props["data-side"])).toEqual(["blue", "red"]);
    expect(text(teams[0])).toContain("RivalsAdversairesCôté bleu");
    expect(text(teams[1])).toContain("VisionNotre équipeCôté rouge");
    expect(teams[0].findAllByProps({ "data-tone": "side-blue" })).toHaveLength(1);
    expect(teams[1].findAllByProps({ "data-tone": "side-red" })).toHaveLength(1);
    expect(text(teams[0])).toContain("Défaite");
    expect(text(teams[1])).toContain("Victoire");
  });
  it("shows five compact rows with three comparisons and visible KDA and CS", () => {
    const renderer = render();
    expect(renderer.root.findAllByProps({ className: "mhh-row" })).toHaveLength(5);
    for (const role of roles) {
      for (const name of ["gold", "damage", "vision"]) expect(row(renderer, role).findAllByProps({ "data-metric": name })).toHaveLength(1);
      for (const name of ["kda", "cs"]) expect(row(renderer, role).findAllByProps({ "data-player-stat": name })).toHaveLength(2);
      expect(row(renderer, role).findByProps({ className: "mhh-expand" }).props["aria-expanded"]).toBe(false);
    }
    expect(renderer.root.findAllByProps({ className: "mhh-details" })).toHaveLength(0);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    for (const name of ["gold", "damage", "vision"]) expect(renderer.root.findAllByProps({ "data-team-metric": name })).toHaveLength(1);
  });
  it("shows exact values and direction without treating measured zero as missing", () => {
    const renderer = render();
    expect(metric(renderer, "TOP", "gold").props["data-tone"]).toBe("right");
    expect(text(metric(renderer, "TOP", "gold"))).toContain("→ 2 000");
    expect(metric(renderer, "JGL", "gold").props["data-tone"]).toBe("left");
    expect(metric(renderer, "MID", "gold").props["data-tone"]).toBe("equal");
    expect(metric(renderer, "TOP", "vision").props["data-tone"]).toBe("equal");
    expect(text(metric(renderer, "TOP", "vision"))).toContain("0");
  });
  it("keeps invalid and absent values unavailable", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP").gold = null;
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "JGL").gold = -1;
    const renderer = render(MatchHeadToHead, { snapshot: value });
    for (const role of ["TOP", "JGL"]) expect(metric(renderer, role, "gold").props["data-tone"]).toBe("missing");
    expect(text(renderer.root)).toContain("Un tiret indique une donnée indisponible.");
  });
  it("preserves missing and ambiguous role slots without borrowing another player's measures", () => {
    const value = snapshot();
    value.participants = value.participants.filter((item) => !(item.teamKey === "ALLY" && item.role === "SUP"));
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP").role = "MID";
    const renderer = render(MatchHeadToHead, { snapshot: value });
    expect(text(row(renderer, "SUP"))).toContain("Joueur absent");
    expect(text(row(renderer, "MID"))).toContain("Rôle ambigu");
    for (const role of ["TOP", "MID", "SUP"]) for (const name of ["gold", "damage", "vision"]) expect(metric(renderer, role, name).props["data-tone"]).toBe("missing");
    expect(text(renderer.root.findByProps({ className: "mhh-unresolved" }))).toContain("ALLY TOP");
  });
  it("expands one role inline with secondary measures, spells and items", () => {
    const value = snapshot();
    const ally = value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP");
    Object.assign(ally, { spells: [4, 12], items: [1001, 0], trinket: 3340, kills: 5, deaths: 0, assists: 7, cs: 220, cs10: 75 });
    const renderer = render(MatchHeadToHead, { snapshot: value });
    expect(renderer.root.findAllByProps({ className: "mhh-loadout" })).toHaveLength(0);
    const detail = openRole(renderer, "TOP");
    expect(row(renderer, "TOP").findByProps({ className: "mhh-expand" }).props["aria-expanded"]).toBe(true);
    expect(detail.findAllByProps({ className: "mhh-loadout" })).toHaveLength(2);
    expect(detail.findByProps({ "aria-label": "Équipements et sorts de ALLY TOP" }).findAllByType(HudIcon).map((icon) => icon.props.label)).toEqual(["Sort 4", "Sort 12", "Objet 1001", "Objet 3340"]);
    expect(text(secondaryMetric(renderer, "TOP", "cs10"))).toContain("75");
    openRole(renderer, "JGL");
    expect(renderer.root.findAllByProps({ className: "mhh-details" })).toHaveLength(1);
    act(() => row(renderer, "JGL").findByProps({ className: "mhh-expand" }).props.onClick());
    expect(renderer.root.findAllByProps({ className: "mhh-details" })).toHaveLength(0);
  });
  it("closes expanded details when the snapshot changes", () => {
    const renderer = render();
    openRole(renderer, "MID");
    act(() => renderer.update(<MatchHeadToHead snapshot={snapshot({ ...game(), id: "next-game" })} />));
    expect(renderer.root.findAllByProps({ className: "mhh-details" })).toHaveLength(0);
  });
  it("reads CS20 from the correct timeline participant and preserves measured zero", () => {
    const match = { ...game(), duration: "25:00", raw: { timeline: { info: { frames: [{ timestamp: 1200000, participantFrames: {
      1: { participantId: 1, minionsKilled: 150, jungleMinionsKilled: 20 },
      6: { participantId: 6, minionsKilled: 0, jungleMinionsKilled: 0 },
    } }] } } } };
    const renderer = render(MatchHeadToHead, { snapshot: snapshot(match), match });
    expect(secondaryValues(secondaryMetric(renderer, "TOP", "cs20"))).toEqual(["0", "CS à 20 min", "170"]);
    expect(secondaryValues(secondaryMetric(renderer, "JGL", "cs20"))).toEqual(["—", "CS à 20 min", "—"]);
  });
  it("does not invent shares when a roster or a measure is incomplete", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "SUP").damage = null;
    const renderer = render(MatchHeadToHead, { snapshot: value });
    expect(secondaryValues(secondaryMetric(renderer, "TOP", "damage-share"))).toEqual(["20 %", "Part des dégâts", "—"]);
    expect(secondaryValues(secondaryMetric(renderer, "TOP", "vision-share"))).toEqual(["—", "Part vision", "—"]);
  });
});

describe("visual match lineups", () => {
  it("renders five explicit role slots per team with original portraits", () => {
    const renderer = render(MatchLineups);
    expect(renderer.root.findAllByType("ol")).toHaveLength(2);
    expect(renderer.root.findAllByProps({ className: "ml-champion" }).map(text)).toEqual([...Array(5).fill("Ahri"), ...Array(5).fill("Jinx")]);
    expect(renderer.root.findAllByProps({ className: "ml-team" }).map((node) => node.props["data-team"])).toEqual(["ALLY", "ENEMY"]);
  });
  it("shows unresolved players separately", () => {
    const value = snapshot();
    value.participants[0].role = "MID";
    const renderer = render(MatchLineups, { snapshot: value });
    const ally = renderer.root.findByProps({ "data-team": "ALLY" });
    expect(text(ally.findByProps({ "data-role": "TOP" }))).toContain("Joueur absent");
    expect(text(ally.findByProps({ "data-role": "MID" }))).toContain("Rôle ambigu");
    expect(text(renderer.root.findByProps({ className: "mhh-unresolved" }))).toContain("ALLY TOP");
  });
});
