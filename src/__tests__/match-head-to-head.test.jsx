import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchHeadToHead, MatchLineups, getMatchRolePairs, matchRoleSlots } from "../components/games/MatchHeadToHead.jsx";
import { HudIcon } from "../pages/workspace/workspace-shared.jsx";
import { ModalDialog } from "../components/ui/ModalDialog.jsx";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
vi.mock("../components/ui/ModalDialog.jsx", () => ({
  ModalDialog: ({ children, onClose, returnFocusRef, ...props }) => <dialog {...props} onCancel={onClose}>{children}</dialog>,
}));
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
const visibleText = (node) => typeof node === "string" ? node : node.props.className?.split(" ").includes("sr-only") ? "" : (node.children || []).map(visibleText).join("");
const row = (renderer, role) => renderer.root.findByProps({ "data-role": role }).findByProps({ className: "mhh-row" });
const metric = (renderer, role, name) => row(renderer, role).findByProps({ "data-metric": name });
const secondaryValues = (node) => node.children.map(visibleText);
function openRole(renderer, role) {
  const previous = renderer.root.findAllByType(ModalDialog)[0];
  if (previous) act(() => previous.props.onClose());
  act(() => row(renderer, role).findByProps({ "aria-label": `Repères du rôle ${role}` }).props.onClick({ currentTarget: { focus: vi.fn() } }));
  return renderer.root.findByType("dialog");
}
const secondaryMetric = (renderer, role, name) => openRole(renderer, role).findByProps({ "data-metric": name });

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
  it("compares five roles at one common signed scale per statistic and keeps measured zero empty", () => {
    const renderer = render();
    const top = metric(renderer, "TOP", "gold");
    const jungle = metric(renderer, "JGL", "gold");
    expect(top.props["data-tone"]).toBe("positive");
    expect(top.findByProps({ className: "mhh-fill" }).props.style).toEqual({ width: "50%", left: "0%" });
    expect(jungle.props["data-tone"]).toBe("negative");
    expect(jungle.findByProps({ className: "mhh-fill" }).props.style).toEqual({ width: "25%", left: "50%" });
    expect(metric(renderer, "MID", "gold").findByProps({ className: "mhh-fill" }).props.style.width).toBe("0%");
    expect(metric(renderer, "MID", "gold").props["data-tone"]).toBe("equal");
    expect(metric(renderer, "TOP", "damage").findByProps({ className: "mhh-fill" }).props.style.width).toBe("50%");
    expect(metric(renderer, "JGL", "damage").findByProps({ className: "mhh-fill" }).props.style.width).toBe("50%");
  });

  it("keeps three comparisons and each player's KDA and CS visible without nested tabs", () => {
    const renderer = render();
    expect(text(metric(renderer, "TOP", "damage"))).toContain("+500");
    expect(text(renderer.root)).toContain("Dégâts aux champions");
    for (const role of roles) {
      for (const name of ["gold", "damage", "vision"]) expect(row(renderer, role).findAllByProps({ "data-metric": name })).toHaveLength(1);
      for (const name of ["kda", "cs"]) expect(row(renderer, role).findAllByProps({ "data-player-stat": name })).toHaveLength(2);
      expect(row(renderer, role).findAllByType("button").filter((button) => button.props["aria-label"] === `Repères du rôle ${role}` && button.props["aria-haspopup"] === "dialog")).toHaveLength(1);
      const vision = metric(renderer, role, "vision");
      expect(vision.props["data-tone"]).toBe("equal");
      expect(vision.findByProps({ className: "mhh-fill" }).props.style.width).toBe("0%");
      expect(text(vision)).not.toContain("Comparaison indisponible");
    }
    expect(renderer.root.findAllByType("button")).toHaveLength(5);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    for (const name of ["cs10", "cs20", "participation", "damage-share", "gold-share", "vision-share", "deaths-share"]) expect(renderer.root.findAllByProps({ "data-metric": name })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ role: "tablist" })).toHaveLength(0);
    expect(renderer.root.findAllByType("details")).toHaveLength(0);
    for (const name of ["gold", "damage", "vision"]) expect(renderer.root.findAllByProps({ "data-team-metric": name })).toHaveLength(1);
  });

  it("distinguishes missing, invalid and zero measures", () => {
    const value = snapshot();
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP").gold = null;
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "JGL").gold = -1;
    const renderer = render(MatchHeadToHead, { snapshot: value });
    for (const role of ["TOP", "JGL"]) {
      const gold = metric(renderer, role, "gold");
      expect(gold.props["data-tone"]).toBe("missing");
      expect(text(gold.findByProps({ className: "mhh-difference" }))).toBe("Écart : —");
      expect(gold.findByProps({ className: "mhh-fill" }).props.style.width).toBe("0%");
      expect(metric(renderer, role, "damage").props["data-tone"]).toBe("positive");
    }
    expect(metric(renderer, "MID", "gold").props["data-tone"]).toBe("equal");
    expect(text(renderer.root)).toContain("Un tiret indique une donnée indisponible.");
  });

  it("keeps missing and ambiguous roles visible without borrowing another player's statistics", () => {
    const value = snapshot();
    value.participants = value.participants.filter((item) => !(item.teamKey === "ALLY" && item.role === "SUP"));
    value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP").role = "MID";
    const renderer = render(MatchHeadToHead, { snapshot: value });
    expect(text(row(renderer, "SUP"))).toContain("Joueur absent");
    expect(text(row(renderer, "MID"))).toContain("Rôle ambigu");
    for (const role of ["TOP", "MID", "SUP"]) {
      for (const name of ["gold", "damage", "vision"]) expect(metric(renderer, role, name).props["data-tone"]).toBe("missing");
      expect(row(renderer, role).props.onClick).toBeUndefined();
      expect(row(renderer, role).props["aria-controls"]).toBeUndefined();
    }
    expect(text(renderer.root.findByProps({ className: "mhh-unresolved" }))).toContain("ALLY TOP");
    expect(text(renderer.root.findByProps({ className: "mhh-unresolved" }))).toContain("ALLY MID");
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

  it("renders each identity and loadout once with KDA and final CS in the player identity", () => {
    const value = snapshot();
    const ally = value.participants.find((item) => item.teamKey === "ALLY" && item.role === "TOP");
    Object.assign(ally, { spells: [4, 12], items: [1001, 0, null, -1], trinket: 3340, kills: 5, deaths: 0, assists: 7, cs: 220, cs10: 75 });
    const renderer = render(MatchHeadToHead, { snapshot: value });
    const identities = renderer.root.findAllByProps({ className: "mhh-player-text" });
    expect(identities).toHaveLength(10);
    expect(identities.map((identity) => text(identity.findAllByType("strong")[0])).sort()).toEqual(value.participants.map((participant) => participant.name).sort());
    expect(renderer.root.findAllByProps({ className: "mhh-loadout" })).toHaveLength(10);
    const loadout = renderer.root.findByProps({ "aria-label": "Équipements et sorts de ALLY TOP" });
    expect(loadout.findAllByType(HudIcon).map((icon) => icon.props.label)).toEqual(["Sort 4", "Sort 12", "Objet 1001", "Objet 3340"]);
    expect(text(row(renderer, "TOP").findAllByProps({ "data-player-stat": "kda" })[0])).toContain("5/0/7");
    expect(text(row(renderer, "TOP").findAllByProps({ "data-player-stat": "cs" })[0])).toContain("220");
    expect(text(secondaryMetric(renderer, "TOP", "cs10"))).toContain("75");
    expect(renderer.root.findAllByProps({ className: "mhh-player-text" })).toHaveLength(10);
    expect(renderer.root.findAllByProps({ className: "mhh-loadout" })).toHaveLength(10);
  });

  it("opens only secondary role measures in one dialog and closes it through the close action", () => {
    const renderer = render();
    const dialog = openRole(renderer, "TOP");
    expect(dialog.props.className).toContain("mhh-details-dialog");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    expect(dialog.findAllByType("img")).toHaveLength(0);
    expect(dialog.findAllByProps({ className: "mhh-loadout" })).toHaveLength(0);
    for (const name of ["gold", "damage", "vision", "kda", "cs"]) expect(dialog.findAllByProps({ "data-metric": name })).toHaveLength(0);
    for (const name of ["cs10", "cs20", "participation", "damage-share", "gold-share", "vision-share", "deaths-share"]) expect(dialog.findAllByProps({ "data-metric": name })).toHaveLength(1);
    const cs10 = dialog.findByProps({ "data-metric": "cs10" });
    expect(text(cs10.children[0])).toContain("Team Atlas : ");
    expect(text(cs10.children[2])).toContain("Rivals : ");
    const close = dialog.findAllByType("button").find((button) => button.props["aria-label"] === "Fermer" || text(button) === "Fermer");
    expect(close).toBeDefined();
    act(() => close.props.onClick());
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    openRole(renderer, "JGL");
    act(() => renderer.root.findByType(ModalDialog).props.onClose());
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });

  it("closes the selected role's dialog when the match snapshot changes", () => {
    const value = snapshot();
    const renderer = render(MatchHeadToHead, { snapshot: value });
    openRole(renderer, "MID");
    expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
    act(() => renderer.update(<MatchHeadToHead snapshot={snapshot({ ...game(), id: "next-game" })} />));
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
  });

  it("shows CS20 from the matching participant's recorded timeline and preserves measured zero", () => {
    const match = { ...game(), duration: "25:00", raw: { timeline: { info: { frames: [{ timestamp: 1200000, participantFrames: {
      1: { participantId: 1, minionsKilled: 150, jungleMinionsKilled: 20 },
      6: { participantId: 6, minionsKilled: 0, jungleMinionsKilled: 0 },
    } }] } } } };
    const renderer = render(MatchHeadToHead, { snapshot: snapshot(match), match });
    expect(secondaryValues(secondaryMetric(renderer, "TOP", "cs20"))).toEqual(["170", "CS à 20 min", "0"]);
    expect(secondaryValues(secondaryMetric(renderer, "JGL", "cs20"))).toEqual(["—", "CS à 20 min", "—"]);
    expect(renderer.root.findAllByProps({ className: "mhh-player-text" })).toHaveLength(10);
  });

  it("does not show CS20 from a stored summary when the game ended before twenty minutes", () => {
    const match = { ...game(), duration: "19:30", raw: { nxt5: { timelineSummary: { csMilestones: { 1: { cs20: 170 }, 6: { cs20: 150 } } } } } };
    const renderer = render(MatchHeadToHead, { snapshot: snapshot(match), match });
    expect(secondaryValues(secondaryMetric(renderer, "TOP", "cs20"))).toEqual(["—", "CS à 20 min", "—"]);
  });

  it.each([
    ["timeline.info.frames", (frames) => ({ timeline: { info: { frames } } })],
    ["metadata.timeline.info.frames", (frames) => ({ metadata: { timeline: { info: { frames } } } })],
    ["timeline.frames", (frames) => ({ timeline: { frames } })],
    ["timeline.timeline.info.frames", (frames) => ({ timeline: { timeline: { info: { frames } } } })],
    ["timeline.timeline.frames", (frames) => ({ timeline: { timeline: { frames } } })],
  ])("uses normalized participant identities and JSON raw data for CS20 from %s", (_, wrap) => {
    const base = game();
    const frames = [{ timestamp: 1200000, participantFrames: {
      1: { participantId: 1, minionsKilled: 142, jungleMinionsKilled: 18 },
      6: { participantId: 6, minionsKilled: 145, jungleMinionsKilled: 7 },
    } }];
    const match = { ...base, duration: "25:00", raw: JSON.stringify(wrap(frames)), participants: base.participants.map((participant, index) => ({
      ...participant, raw: JSON.stringify({ [index % 2 ? "stats" : "participant"]: participant.raw }),
    })) };
    const renderer = render(MatchHeadToHead, { snapshot: snapshot(match), match });
    expect(secondaryValues(secondaryMetric(renderer, "TOP", "cs20"))).toEqual(["160", "CS à 20 min", "152"]);
    expect(secondaryValues(secondaryMetric(renderer, "JGL", "cs20"))).toEqual(["—", "CS à 20 min", "—"]);
  });

  it("shows each player's share within their own team and preserves legitimate zero shares", () => {
    const value = snapshot();
    for (const participant of value.participants) {
      for (const key of ["damage", "gold", "vision", "deaths"]) participant[key] = participant.teamKey === "ALLY" && participant.role === "TOP" ? 0 : 10;
    }
    const renderer = render(MatchHeadToHead, { snapshot: value });
    for (const key of ["damage", "gold", "vision", "deaths"]) {
      const top = secondaryValues(secondaryMetric(renderer, "TOP", `${key}-share`));
      expect([top[0], top[2]]).toEqual(["0 %", "20 %"]);
      const jungle = secondaryValues(secondaryMetric(renderer, "JGL", `${key}-share`));
      expect([jungle[0], jungle[2]]).toEqual(["25 %", "20 %"]);
      expect(renderer.root.findAllByProps({ "data-metric": `${key}-share` })).toHaveLength(1);
    }
  });

  it("does not fabricate zero shares from missing measures or a zero team total", () => {
    const value = snapshot();
    value.participants.find((participant) => participant.teamKey === "ALLY" && participant.role === "SUP").damage = null;
    const renderer = render(MatchHeadToHead, { snapshot: value });
    const damage = secondaryValues(secondaryMetric(renderer, "TOP", "damage-share"));
    expect([damage[0], damage[2]]).toEqual(["—", "20 %"]);
    const vision = secondaryValues(secondaryMetric(renderer, "TOP", "vision-share"));
    expect([vision[0], vision[2]]).toEqual(["—", "—"]);
    const deaths = secondaryValues(secondaryMetric(renderer, "TOP", "deaths-share"));
    expect([deaths[0], deaths[2]]).toEqual(["—", "—"]);
  });

  it("keeps team shares unavailable when the team's roster is incomplete", () => {
    const value = snapshot();
    value.participants = value.participants.filter((participant) => !(participant.teamKey === "ALLY" && participant.role === "SUP"));
    const renderer = render(MatchHeadToHead, { snapshot: value });
    for (const key of ["damage", "gold"]) {
      const values = secondaryValues(secondaryMetric(renderer, "TOP", `${key}-share`));
      expect(values[0]).toBe("—");
      expect(values[2]).toBe("20 %");
    }
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
