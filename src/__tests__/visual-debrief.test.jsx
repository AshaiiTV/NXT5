import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import VisualDebrief from "../components/games/VisualDebrief.jsx";
import MatchGoldChart from "../components/games/MatchGoldChart.jsx";
import { ModalDialog } from "../components/ui/ModalDialog.jsx";

vi.mock("../components/ui/ModalDialog.jsx", () => ({
  ModalDialog: ({ children, onClose, returnFocusRef, ...props }) => <dialog {...props} onCancel={onClose}>{children}</dialog>,
}));
vi.mock("../components/games/MatchGoldChart.jsx", () => ({ default: () => <figure data-gold-chart /> }));

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const team = { id: "team-a", name: "Nova Five" };
const renderers = [];
afterEach(() => renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())));
const text = (node) => typeof node === "string" ? node : (node.children || []).map(text).join("");
const kill = (overrides = {}) => ({ type: "CHAMPION_KILL", timestamp: 60000, killerId: 1, victimId: 6, assistingParticipantIds: [2], ...overrides });
const dragon = (overrides = {}) => ({ type: "ELITE_MONSTER_KILL", timestamp: 300000, killerId: 2, killerTeamId: 100, monsterType: "DRAGON", ...overrides });
function match(id = "a", overrides = {}) {
  return {
    id, team_id: team.id, opponent: `Adversaire ${id}`, side: "blue", result: "Victoire", duration: "26:42",
    participants: ["ALLY", "ENEMY"].flatMap((teamKey, teamIndex) => roles.map((role, index) => ({
      id: `${id}-${teamKey}-${role}`, match_id: id, team_key: teamKey, role, summoner_name: `${teamKey} ${role}`, champion: teamKey === "ALLY" ? "Ahri" : "Jinx", gold: 10000 + (teamKey === "ALLY" ? 1000 : 0), kills: 2, deaths: 2, assists: 3,
      raw: { participantId: teamIndex * 5 + index + 1, teamId: teamKey === "ALLY" ? 100 : 200 },
    }))),
    raw: { info: { teams: [100, 200].map((teamId) => ({ teamId, objectives: { dragon: { kills: teamId === 100 ? 0 : 2 }, tower: { kills: teamId === 100 ? 7 : 3 }, riftHerald: { kills: 0 }, horde: { kills: 3 } } })) }, timeline: { info: { frames: [{ timestamp: 60000, events: [kill(), kill({ timestamp: 75000, victimId: 7 }), dragon()] }] } } },
    ...overrides,
  };
}
function render(props = {}) {
  const options = { matches: [match()], matchIds: ["a"], team, ...props };
  let renderer;
  act(() => { renderer = TestRenderer.create(<VisualDebrief {...options} />); });
  renderers.push(renderer);
  return { renderer, update: (next) => act(() => renderer.update(<VisualDebrief {...options} {...next} />)) };
}
const games = (renderer) => renderer.root.findAllByProps({ className: "vd-game" });
const moments = (renderer) => renderer.root.findAllByProps({ className: "vd-moment-button" });
const chart = (renderer) => renderer.root.findByType(MatchGoldChart);
const objective = (renderer, name) => renderer.root.findByProps({ className: "vd-objective-list" }).findAllByType("dt").find((item) => text(item) === name).parent;

describe("visual debrief", () => {
  it("uses the selected complete game and its canonical publication for the chart", () => {
    const source = [match(), match("b", { result: "Défaite" })];
    const { renderer } = render({ matches: source, matchIds: ["a", "b"] });
    expect(text(renderer.root)).toContain("En 10 secondes");
    expect(chart(renderer).props.match).toBe(source[0]);
    act(() => games(renderer)[1].props.onClick());
    expect(chart(renderer).props.match).toBe(source[1]);
    expect(chart(renderer).props.publication).toMatchObject({ entityId: "b", context: { result: "Défaite", teamName: "Nova Five" }, facts: { gold: { diff: 5000 } } });
    expect(games(renderer).map((item) => item.props["aria-pressed"])).toEqual([false, true]);
  });

  it("preserves the selected game through loading, errors, replacement objects and reordering", () => {
    const { renderer, update } = render({ matches: [match(), match("b")], matchIds: ["a", "b"] });
    act(() => games(renderer)[1].props.onClick());
    update({ matches: [], loading: true });
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(0);
    update({ matches: [], error: "Chargement interrompu" });
    expect(text(renderer.root)).toContain("Chargement interrompu");
    update({ matches: [match(), match("b")], matchIds: ["b", "a"] });
    expect(chart(renderer).props.match.id).toBe("b");
    update({ matches: [match(), match("c")], matchIds: ["a", "c"] });
    expect(chart(renderer).props.match.id).toBe("a");
  });

  it("never displays a partial linked group or a game from another team and offers retry", () => {
    const retry = vi.fn();
    const { renderer, update } = render({ matches: [match()], matchIds: ["a", "b"], onRetry: retry });
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(0);
    expect(text(renderer.root)).toContain("Toutes les parties liées");
    act(() => renderer.root.findByType("button").props.onClick());
    expect(retry).toHaveBeenCalledOnce();
    update({ matches: [match(), match("b", { team_id: "team-b" })] });
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(0);
    update({ matches: [match(), match("b")], loading: true });
    expect(text(renderer.root)).toContain("Préparation du bilan visuel");
    expect(renderer.root.findAllByType("button")).toHaveLength(0);
  });

  it("distinguishes a measured zero, an unavailable objective and an unknown result", () => {
    const { renderer } = render({ matches: [match("a", { result: null, duration: null })] });
    expect(text(renderer.root)).toContain("Résultat inconnu");
    expect(text(renderer.root)).toContain("Durée inconnue");
    expect(text(renderer.root)).not.toContain("Défaite");
    expect(text(objective(renderer, "Dragons").findByProps({ "data-team": "ALLY" }))).toBe("Notre équipe : 0");
    expect(text(objective(renderer, "Nashors").findByProps({ "data-team": "ALLY" }))).toBe("Notre équipe : —");
    expect(renderer.root.findByProps({ className: "vd-objective-list" }).findAllByType("dt")).toHaveLength(5);
  });

  it("opens only the requested real moment, navigates its neighbours, then closes", () => {
    const { renderer } = render();
    expect(moments(renderer)).toHaveLength(2);
    expect(renderer.root.findAllByType(ModalDialog)).toHaveLength(0);
    const trigger = { focus: vi.fn() };
    act(() => moments(renderer)[0].props.onClick({ currentTarget: trigger }));
    let dialog = renderer.root.findByType(ModalDialog);
    expect(dialog.props.returnFocusRef.current).toBe(trigger);
    expect(text(dialog)).toContain("Éliminations pendant ce combat");
    expect(text(dialog)).toContain("ALLY TOP");
    expect(text(dialog)).toContain("ENEMY TOP");
    expect(text(dialog)).toContain("Assistances");
    const preventDefault = vi.fn();
    act(() => dialog.props.onKeyDown({ key: "ArrowRight", preventDefault }));
    dialog = renderer.root.findByType(ModalDialog);
    expect(text(dialog)).toContain("Objectif sécurisé");
    expect(text(dialog)).toContain("5:00");
    const next = dialog.findAllByType("button").find((button) => text(button) === "Suivant");
    expect(next.props["aria-disabled"]).toBe(true);
    act(() => next.props.onClick());
    expect(text(renderer.root.findByType(ModalDialog))).toContain("5:00");
    act(() => dialog.props.onClose());
    expect(renderer.root.findAllByType(ModalDialog)).toHaveLength(0);
  });

  it("closes a moment when the displayed game changes", () => {
    const { renderer } = render({ matches: [match(), match("b")], matchIds: ["a", "b"] });
    act(() => moments(renderer)[0].props.onClick({ currentTarget: {} }));
    act(() => games(renderer)[1].props.onClick());
    expect(renderer.root.findAllByType(ModalDialog)).toHaveLength(0);
  });

  it("shows missing chronology separately from loading and preserves real team notes", () => {
    const { renderer } = render({ matches: [match("a", { raw: {} })], focus: { keep: "Notre premier dragon.", action: "Préparer la rivière avant le dragon." } });
    expect(text(renderer.root)).toContain("Les événements de cette partie ne sont pas disponibles.");
    expect(text(renderer.root)).not.toContain("Préparation du bilan visuel");
    expect(text(renderer.root.findByProps({ "aria-label": "Décisions de l’équipe" }))).toContain("Préparer la rivière avant le dragon.");
    expect(text(renderer.root)).not.toContain("Consigne du staff");
    expect(moments(renderer)).toHaveLength(0);
  });

  it("keeps the first screen free of invented advice and collapses roster details", () => {
    const { renderer } = render();
    expect(renderer.root.findAllByProps({ "aria-label": "Décisions de l’équipe" })).toHaveLength(0);
    expect(text(renderer.root)).not.toContain("Prochaine partie");
    const disclosure = renderer.root.findAllByType("details").find((element) => element.props.className.includes("vd-players"));
    expect(disclosure.props.open).not.toBe(true);
    expect(text(disclosure)).toContain("ALLY TOP");
    expect(text(disclosure)).toContain("ENEMY SUP");
  });

  it("uses a labelled native picker for twenty linked games without twenty cards", () => {
    const source = Array.from({ length: 20 }, (_, index) => match(`game-${index}`));
    const { renderer } = render({ matches: source, matchIds: source.map((item) => item.id) });
    expect(games(renderer)).toHaveLength(0);
    const picker = renderer.root.findByType("select");
    expect(picker.findAllByType("option")).toHaveLength(20);
    expect(renderer.root.findByType("label").props.htmlFor).toBe(picker.props.id);
    act(() => picker.props.onChange({ target: { value: "game-19" } }));
    expect(chart(renderer).props.match.id).toBe("game-19");
  });

  it("follows the requested linked game and opens the currently selected game", () => {
    const open = vi.fn();
    const { renderer, update } = render({ matches: [match(), match("b")], matchIds: ["a", "b"], initialMatchId: "b", onOpenMatch: open });
    expect(chart(renderer).props.match.id).toBe("b");
    const openButton = () => renderer.root.findAllByType("button").find((button) => text(button) === "Voir la partie");
    act(() => openButton().props.onClick());
    expect(open).toHaveBeenLastCalledWith("b");
    act(() => games(renderer)[0].props.onClick());
    act(() => openButton().props.onClick());
    expect(open).toHaveBeenLastCalledWith("a");
    update({ initialMatchId: "a" });
    expect(chart(renderer).props.match.id).toBe("a");
    update({ initialMatchId: "b" });
    expect(chart(renderer).props.match.id).toBe("b");
    update({ initialMatchId: "unrelated" });
    expect(chart(renderer).props.match.id).toBe("a");
  });

  it("keeps the requested game reachable while details are loading or unavailable", () => {
    const open = vi.fn();
    const { renderer, update } = render({ matches: [], matchIds: ["a", "b"], initialMatchId: "b", onOpenMatch: open, loading: true });
    const openButton = () => renderer.root.findAllByType("button").find((button) => text(button) === "Voir la partie");
    act(() => openButton().props.onClick());
    expect(open).toHaveBeenLastCalledWith("b");
    update({ error: "Indisponible", loading: false });
    act(() => openButton().props.onClick());
    expect(open).toHaveBeenLastCalledWith("b");
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(0);
  });
});
