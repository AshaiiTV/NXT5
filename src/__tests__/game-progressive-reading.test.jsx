import React, { useEffect, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openAppPath } from "../app/routing.js";
import { Button } from "../components/ui/Core.jsx";
import { MatchLineups, MatchHeadToHead } from "../components/games/MatchHeadToHead.jsx";
import MatchGoldChart from "../components/games/MatchGoldChart.jsx";
import { MatchKillMap } from "../components/games/MatchKillMap.jsx";
import {
  MatchDataPanel, MatchVersusOverview, MatchTimelineReview,
  MatchReadingIntro, DeathContextPanel, DraftImpactPanel, ObjectiveHud,
} from "../pages/workspace/GameWorkspace.jsx";

vi.mock("../app/routing.js", async (load) => ({ ...await load(), openAppPath: vi.fn() }));
vi.mock("../components/ui/ModalDialog.jsx", () => ({
  ModalDialog: ({ children, onClose, returnFocusRef, ...props }) => <dialog {...props} onCancel={onClose}>{children}</dialog>,
}));
const renderers = [];
afterEach(() => { renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())); vi.clearAllMocks(); });
const game = (id = "game/1") => ({
  id, game_id: "EUW1_123", patch: "16.19", duration: "24:30", side: "blue", result: "Victoire",
  raw: { nxt5Label: "Partie contre Atlas" }, participants: [
    { id: "ally", team_key: "ALLY", role: "MID", champion: "Ahri", summoner_name: "Lune", kills: 4, deaths: 2, assists: 7, gold: 12000, damage: 18000, vision: 18, raw: { participantId: 1, teamId: 100 } },
    { id: "enemy", team_key: "ENEMY", role: "MID", champion: "Syndra", summoner_name: "Rival", kills: 2, deaths: 4, assists: 5, gold: 10000, damage: 15000, vision: 15, raw: { participantId: 6, teamId: 200 } },
  ],
});
function completeGame({ ally = {}, enemy = {} } = {}) {
  const match = game();
  const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
  return { ...match, participants: ["ALLY", "ENEMY"].flatMap((teamKey, teamIndex) => roles.map((role, index) => ({
    ...match.participants[teamIndex], gold: 10000, damage: 15000, vision: 15,
    ...(teamKey === "ALLY" ? ally : enemy), id: `${teamKey}-${role}`, team_key: teamKey, role,
    raw: { participantId: teamIndex * 5 + index + 1, teamId: teamKey === "ALLY" ? 100 : 200 },
  }))) };
}
const draftChampions = {
  ALLY: ["Ornn", "Sejuani", "Ahri", "Jinx", "Lulu"],
  ENEMY: ["Malphite", "Vi", "Syndra", "Caitlyn", "Nautilus"],
};
function draftedGame() {
  const match = completeGame();
  const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
  const participants = match.participants.map((row) => ({ ...row, champion: draftChampions[row.team_key][roles.indexOf(row.role)] }));
  return { ...match, participants: [8, 2, 9, 4, 0, 6, 3, 5, 1, 7].map((index) => participants[index]) };
}
function phasedGame() {
  return { ...draftedGame(), team_id: "team-a", raw: { nxt5: { timelineEvents: [5, 18, 25].map((minute) => ({
    type: "ELITE_MONSTER_KILL", timestamp: minute * 60000, monsterType: "DRAGON", killerId: 1,
  })) } } };
}
function render(props = {}) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<MatchDataPanel match={game()} teamName="Équipe Atlas" {...props} />); });
  renderers.push(renderer);
  return renderer;
}
function renderComposition(props = {}) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<DraftImpactPanel match={game()} teamName="Équipe Atlas" {...props} />); });
  renderers.push(renderer);
  return renderer;
}
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function visibleText(node) { return typeof node === "string" ? node : node.props.className?.split(" ").includes("sr-only") ? "" : (node.children || []).map(visibleText).join(""); }
function visible(node) {
  for (let ancestor = node; ancestor; ancestor = ancestor.parent) if (ancestor.props.hidden) return false;
  return true;
}
function tab(renderer, label) {
  return renderer.root.findAllByProps({ role: "tab" }).find((node) => text(node) === label);
}
function selectTab(renderer, label) { act(() => tab(renderer, label).props.onClick()); }
function action(renderer, label) {
  return renderer.root.findAllByType(Button).find((node) => text(node) === label);
}

function drafting(renderer, label) {
  return renderer.root.findByType(DraftImpactPanel).findByProps({ "aria-label": label });
}
function draftSlots(section) {
  return section.findByType("ol").findAllByType("li");
}

describe("progressive game reading", () => {
  it("starts with one combined debrief and offers each deeper view in one tab", () => {
    const renderer = render();
    const brief = renderer.root.findByProps({ "aria-label": "Bilan de la partie" });
    expect(text(renderer.root)).toContain("Partie contre Atlas");
    expect(text(renderer.root).indexOf("Partie contre Atlas")).toBeLessThan(text(renderer.root).indexOf("Victoire"));
    expect(text(renderer.root)).toContain("Victoire");
    expect(text(renderer.root)).toContain("Durée : 24:30");
    expect(text(renderer.root)).toContain("Notre équipe : côté bleu");
    expect(brief.findAllByType(MatchKillMap)).toHaveLength(1);
    expect(text(brief)).not.toContain("Qui a le plus d’impact ?");
    expect(renderer.root.findAllByProps({ role: "tab" }).map(text)).toEqual(["Débrief", "Face-à-face", "Drafting"]);
    expect(tab(renderer, "Débrief").props["aria-selected"]).toBe(true);
    expect(tab(renderer, "Débrief").props.id).toMatch(/-tab-debrief$/);
    expect(renderer.root.findAllByType(MatchLineups)).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(1);
    expect(text(renderer.root)).not.toContain("EUW1_123");
    expect(text(renderer.root)).not.toContain("16.19");
    expect(text(renderer.root)).not.toContain("Tous les débriefs");
    const journal = renderer.root.findByType(MatchTimelineReview);
    expect(visible(journal)).toBe(true);
    expect(journal.findAllByType(MatchGoldChart)).toHaveLength(0);
    expect(journal.findAllByType(MatchKillMap)).toHaveLength(0);
    for (const Component of [MatchHeadToHead, MatchVersusOverview, MatchReadingIntro, DeathContextPanel, DraftImpactPanel]) {
      expect(renderer.root.findAllByType(Component)).toHaveLength(0);
    }
  });

  it.each([
    ["Écart d’or final", { enemy: { gold: 11000 } }, "-5 000"],
    ["Écart de dégâts aux champions", { ally: { gold: null, damage: 17000 }, enemy: { gold: null } }, "+10 000"],
    ["Écart de score de vision", { ally: { gold: null, damage: null }, enemy: { gold: null, damage: null, vision: 20 } }, "-25"],
  ])("names the first available measured signal and its direction: %s", (label, stats, value) => {
    const renderer = render({ match: completeGame(stats) });
    const brief = renderer.root.findByProps({ "aria-label": "Bilan de la partie" });
    const reading = text(brief).replace(/\s/g, " ");
    expect(reading).toContain(label);
    expect(reading).toContain(value);
    expect(reading).toContain("Notre équipe − adversaires");
    expect(reading).not.toContain("Un écart final ne suffit pas à expliquer le résultat.");
    expect(reading).not.toContain("Statistiques incomplètes");
  });

  it("explains incomplete statistics without presenting a fabricated zero", () => {
    const renderer = render();
    const brief = renderer.root.findByProps({ "aria-label": "Bilan de la partie" });
    expect(text(brief)).toContain("Statistiques incomplètes");
    expect(text(brief)).toContain("Les données disponibles ne permettent pas de comparer les totaux des deux équipes.");
    expect(text(brief)).not.toContain("Notre équipe − adversaires");
    expect(text(brief)).not.toContain("Écart d’or final");
    expect(text(brief)).not.toContain("+0");
    expect(action(renderer, "Préparer le débrief")).toBeDefined();
  });

  it("preserves a measured zero as an available statistic", () => {
    const renderer = render({ match: completeGame() });
    const brief = renderer.root.findByProps({ "aria-label": "Bilan de la partie" });
    expect(text(brief)).toContain("Écart d’or final");
    expect(text(brief)).toContain("+0");
    expect(text(brief)).not.toContain("Statistiques incomplètes");
  });

  it("shows one complete face-to-face view with objectives and information, without nested navigation or duplicated statistics", () => {
    const renderer = render({ match: draftedGame() });
    selectTab(renderer, "Face-à-face");
    expect(renderer.root.findAllByType(MatchHeadToHead)).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchLineups).filter(visible)).toHaveLength(0);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(0);
    expect(renderer.root.findAllByType(ObjectiveHud)).toHaveLength(1);
    expect(renderer.root.findAllByProps({ role: "tablist" })).toHaveLength(1);
    const panel = renderer.root.findAllByProps({ role: "tabpanel" }).find(visible);
    expect(panel.findAllByProps({ role: "tablist" })).toHaveLength(0);
    expect(panel.findAllByType("details").filter(visible)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ className: "games-analysis-disclosure" })).toHaveLength(0);
    for (const value of ["K / D / A", "Informations de la partie", "EUW1_123", "16.19"]) expect(text(panel)).toContain(value);
    for (const stat of ["kda", "cs"]) expect(panel.findAllByProps({ "data-player-stat": stat })).toHaveLength(10);
    for (const metric of ["gold", "damage", "vision"]) expect(panel.findAllByProps({ "data-metric": metric })).toHaveLength(5);
    for (const metric of ["cs10", "cs20", "participation", "damage-share", "gold-share", "vision-share", "deaths-share"]) expect(panel.findAllByProps({ "data-metric": metric })).toHaveLength(0);
    expect(panel.findAllByType("dialog")).toHaveLength(0);
    for (const champion of Object.values(draftChampions).flat()) {
      expect(panel.findAllByType("img").filter(visible).filter((image) => image.props.alt === champion)).toHaveLength(1);
    }
    expect(renderer.root.findAllByType(MatchReadingIntro)).toHaveLength(0);
    selectTab(renderer, "Débrief");
    expect(renderer.root.findByType(MatchTimelineReview).props.teamName).toBe("Équipe Atlas");
    expect(renderer.root.findByType(MatchTimelineReview).findAllByType(MatchKillMap)).toHaveLength(0);
    expect(text(renderer.root.findByType(MatchTimelineReview))).toContain("Chronologie indisponible");
    expect(renderer.root.findAllByType(DraftImpactPanel)).toHaveLength(0);
    expect(text(renderer.root)).not.toContain("EUW1_123");
  });

  it("shows the caller's linked draft only in Drafting and preserves it across view changes", () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    function DraftContent() {
      const [value, setValue] = useState("");
      useEffect(() => { onMount(); return onUnmount; }, []);
      return <section aria-label="Draft liée"><p>Picks et bans de la draft liée</p><input aria-label="Note de draft" value={value} onChange={(event) => setValue(event.target.value)} /></section>;
    }
    const match = game();
    const draftContent = <DraftContent />;
    const renderer = render({ match, draftContent });
    const draft = renderer.root.findByProps({ "aria-label": "Draft liée" });
    expect(visible(draft)).toBe(false);
    expect(onMount).toHaveBeenCalledOnce();
    selectTab(renderer, "Drafting");
    expect(visible(draft)).toBe(true);
    expect(renderer.root.findAllByType(DraftImpactPanel)).toHaveLength(0);
    act(() => draft.findByType("input").props.onChange({ target: { value: "Picks à revoir" } }));
    for (const label of ["Face-à-face", "Débrief"]) {
      selectTab(renderer, label);
      expect(renderer.root.findByProps({ "aria-label": "Draft liée" })).toBe(draft);
      expect(visible(draft)).toBe(false);
    }
    selectTab(renderer, "Drafting");
    act(() => renderer.update(<MatchDataPanel match={{ ...match, duration: "25:00" }} draftContent={draftContent} />));
    expect(visible(draft)).toBe(true);
    expect(draft.findByType("input").props.value).toBe("Picks à revoir");
    expect(onMount).toHaveBeenCalledOnce();
    expect(onUnmount).not.toHaveBeenCalled();
    act(() => renderer.update(<MatchDataPanel match={{ ...match, id: "another-game" }} draftContent={draftContent} />));
    expect(tab(renderer, "Débrief").props["aria-selected"]).toBe(true);
    expect(onMount).toHaveBeenCalledTimes(2);
    expect(onUnmount).toHaveBeenCalledOnce();
    const nextDraft = renderer.root.findByProps({ "aria-label": "Draft liée" });
    expect(visible(nextDraft)).toBe(false);
    expect(nextDraft.findByType("input").props.value).toBe("");
  });

  it("does not invent picks and bans from match participants when no linked draft is supplied", () => {
    const renderer = render({ match: draftedGame() });
    const draft = renderer.root.findByProps({ "aria-label": "Draft de la partie" });
    expect(visible(draft)).toBe(false);
    selectTab(renderer, "Drafting");
    expect(visible(draft)).toBe(true);
    expect(text(draft)).toContain("Aucune draft liée à cette partie. Le staff peut en ajouter une.");
    expect(text(draft)).not.toContain("La leur");
    expect(text(draft)).not.toContain("La nôtre");
    for (const champion of Object.values(draftChampions).flat()) expect(text(draft)).not.toContain(champion);
    expect(renderer.root.findAllByType(DraftImpactPanel)).toHaveLength(0);
  });

  it("opens all team comparisons with one click and can return to the recap", () => {
    const match = draftedGame();
    match.participants.find((row) => row.team_key === "ALLY" && row.role === "ADC").gold = 5000;
    const renderer = render({ match });
    expect(renderer.root.findAllByType(MatchKillMap)).toHaveLength(1);
    selectTab(renderer, "Face-à-face");
    expect(tab(renderer, "Face-à-face").props["aria-selected"]).toBe(true);
    const comparison = renderer.root.findByType(MatchHeadToHead);
    expect(comparison.props.selectedRole).toBeUndefined();
    expect(comparison.props.onSelectRole).toBeUndefined();
    expect(comparison.findAllByProps({ "data-metric": "gold" })).toHaveLength(5);
    expect(text(comparison)).toContain("Jinx");
    expect(text(comparison)).toContain("Caitlyn");
    selectTab(renderer, "Débrief");
    expect(renderer.root.findAllByType(MatchLineups)).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchHeadToHead)).toHaveLength(0);
  });

  it("keeps one map and journal on the same game through loading, failure and refresh", () => {
    const match = draftedGame();
    const renderer = render({ match, loading: true });
    const readMap = () => renderer.root.findByType(MatchKillMap);
    expect(readMap().props).toMatchObject({ match, allyName: "Équipe Atlas", enemyName: "Adversaires", loading: true, error: "" });
    const map = readMap();
    const journal = renderer.root.findByType(MatchTimelineReview);
    expect(journal.props).toMatchObject({ match, teamName: "Équipe Atlas", loading: true, error: "" });
    selectTab(renderer, "Face-à-face");
    expect(renderer.root.findAllByType(MatchKillMap)).toHaveLength(1);
    expect(readMap()).toBe(map);
    expect(visible(map)).toBe(false);
    expect(visible(journal)).toBe(false);
    expect(readMap().props).toMatchObject({ match, allyName: "Équipe Atlas", enemyName: "Adversaires", loading: true, error: "" });
    expect(renderer.root.findAllByProps({ role: "tablist" })).toHaveLength(1);
    act(() => renderer.update(<MatchDataPanel match={match} teamName="Équipe Atlas" error="Détails indisponibles" />));
    expect(readMap().props).toMatchObject({ loading: false, error: "Détails indisponibles" });
    expect(journal.props).toMatchObject({ loading: false, error: "Détails indisponibles" });
    selectTab(renderer, "Débrief");
    expect(visible(map)).toBe(true);
    expect(visible(journal)).toBe(true);
    expect(readMap().props).toMatchObject({ loading: false, error: "Détails indisponibles" });
    act(() => renderer.update(<MatchDataPanel match={{ ...match, id: "other-map-game" }} teamName="Nouvelle équipe" loading />));
    expect(readMap().props.match.id).toBe("other-map-game");
    expect(readMap().props).toMatchObject({ allyName: "Nouvelle équipe", loading: true, error: "" });
    expect(tab(renderer, "Débrief").props["aria-selected"]).toBe(true);
  });

  it("preserves the elimination team filter across the other views without remounting the map", () => {
    const renderer = render({ match: draftedGame() });
    const readMap = () => renderer.root.findByType(MatchKillMap);
    expect(readMap().props.teamFilter).toBe("ALL");
    act(() => readMap().props.onTeamFilterChange("ALLY"));
    expect(readMap().props.teamFilter).toBe("ALLY");
    const map = readMap();
    selectTab(renderer, "Face-à-face");
    expect(readMap().props.teamFilter).toBe("ALLY");
    expect(readMap()).toBe(map);
    expect(visible(map)).toBe(false);
    selectTab(renderer, "Drafting");
    expect(readMap()).toBe(map);
    expect(visible(map)).toBe(false);
    selectTab(renderer, "Débrief");
    expect(visible(map)).toBe(true);
    expect(readMap().props.teamFilter).toBe("ALLY");
    act(() => readMap().props.onTeamFilterChange("ENEMY"));
    expect(readMap().props.teamFilter).toBe("ENEMY");
    act(() => readMap().props.onTeamFilterChange("ALL"));
    expect(readMap().props.teamFilter).toBe("ALL");
    expect(renderer.root.findAllByType(MatchKillMap)).toHaveLength(1);
  });

  it("preserves the team filter when refreshing the same game", () => {
    const match = { ...draftedGame(), team_id: "team-a" };
    const renderer = render({ match });
    const readMap = () => renderer.root.findByType(MatchKillMap);
    act(() => readMap().props.onTeamFilterChange("ENEMY"));
    act(() => renderer.update(<MatchDataPanel match={match} loading />));
    expect(readMap().props).toMatchObject({ teamFilter: "ENEMY", loading: true });
    act(() => renderer.update(<MatchDataPanel match={{ ...match, duration: "25:00" }} />));
    expect(tab(renderer, "Débrief").props["aria-selected"]).toBe(true);
    expect(readMap().props).toMatchObject({ teamFilter: "ENEMY", loading: false });
    selectTab(renderer, "Face-à-face");
    selectTab(renderer, "Débrief");
    expect(readMap().props.teamFilter).toBe("ENEMY");
  });

  it("preserves the selected journal phase through view changes and a refresh of the same game", () => {
    const match = phasedGame();
    const renderer = render({ match });
    const journal = renderer.root.findByType(MatchTimelineReview);
    const filters = () => journal.findByProps({ "aria-label": "Filtrer les moments par phase" }).findAllByType("button");
    act(() => filters()[2].props.onClick());
    expect(filters()[2].props["aria-pressed"]).toBe(true);
    expect(journal.findAllByType("article")).toHaveLength(1);
    expect(text(journal.findByType("article"))).toContain("18:00");
    for (const label of ["Face-à-face", "Drafting", "Débrief"]) {
      selectTab(renderer, label);
      expect(renderer.root.findByType(MatchTimelineReview)).toBe(journal);
      expect(visible(journal)).toBe(label === "Débrief");
    }
    act(() => renderer.update(<MatchDataPanel match={match} loading />));
    act(() => renderer.update(<MatchDataPanel match={{ ...match, duration: "28:00" }} />));
    expect(filters()[2].props["aria-pressed"]).toBe(true);
    expect(journal.findAllByType("article")).toHaveLength(1);
    expect(text(journal.findByType("article"))).toContain("18:00");
  });

  it.each([
    ["game", { id: "other-map-game" }],
    ["team", { team_id: "team-b" }],
  ])("resets the team and phase filters when changing the %s context", (_scope, changed) => {
    const match = phasedGame();
    const renderer = render({ match });
    const filters = () => renderer.root.findByProps({ "aria-label": "Filtrer les moments par phase" }).findAllByType("button");
    act(() => renderer.root.findByType(MatchKillMap).props.onTeamFilterChange("ALLY"));
    act(() => filters()[3].props.onClick());
    expect(filters()[3].props["aria-pressed"]).toBe(true);
    selectTab(renderer, "Drafting");
    act(() => renderer.update(<MatchDataPanel match={{ ...match, ...changed }} />));
    expect(tab(renderer, "Débrief").props["aria-selected"]).toBe(true);
    expect(renderer.root.findByType(MatchKillMap).props.teamFilter).toBe("ALL");
    expect(filters()[0].props["aria-pressed"]).toBe(true);
    expect(renderer.root.findByType(MatchTimelineReview).findAllByType("article")).toHaveLength(3);
    selectTab(renderer, "Face-à-face");
    selectTab(renderer, "Débrief");
    expect(renderer.root.findByType(MatchKillMap).props.teamFilter).toBe("ALL");
  });

  it("keeps the selected tab on refresh and resets it for another game", () => {
    const match = draftedGame();
    const renderer = render({ match });
    selectTab(renderer, "Face-à-face");
    act(() => renderer.update(<MatchDataPanel match={{ ...match, duration: "25:00" }} />));
    expect(tab(renderer, "Face-à-face").props["aria-selected"]).toBe(true);
    expect(renderer.root.findByType(MatchHeadToHead).findAllByProps({ "data-metric": "gold" })).toHaveLength(5);
    act(() => renderer.update(<MatchDataPanel match={{ ...match, id: "game-2" }} />));
    expect(tab(renderer, "Débrief").props["aria-selected"]).toBe(true);
    selectTab(renderer, "Face-à-face");
    expect(renderer.root.findByType(MatchHeadToHead).props.selectedRole).toBeUndefined();
    expect(renderer.root.findAllByProps({ "aria-label": "Détail du duel MID" })).toHaveLength(0);
  });

  it("preserves missing values and measured zero in the compact comparison and role details", () => {
    const match = draftedGame();
    Object.assign(match.participants.find((row) => row.team_key === "ALLY" && row.role === "MID"), {
      gold: null, damage: 0, vision: null, kills: null, deaths: 0, assists: null,
    });
    const renderer = render({ match });
    selectTab(renderer, "Face-à-face");
    const comparison = renderer.root.findByType(MatchHeadToHead);
    const middle = comparison.findByProps({ "data-role": "MID" });
    for (const metric of ["gold", "vision"]) {
      expect(middle.findByProps({ "data-metric": metric }).props["data-tone"]).toBe("missing");
    }
    const damage = middle.findByProps({ "data-metric": "damage" });
    expect(text(damage.findByProps({ className: "mhh-values" }).children[0])).toBe("Notre équipe : 0");
    expect(text(middle.findAllByProps({ "data-player-stat": "kda" })[0])).toContain("—/0/—");
    act(() => middle.findByProps({ "aria-label": "Repères du rôle MID" }).props.onClick({ currentTarget: { focus: vi.fn() } }));
    const dialog = comparison.findByType("dialog");
    expect(dialog.findByProps({ "data-metric": "cs10" }).children.map(visibleText)).toEqual(["—", "CS à 10 min", "—"]);
    expect(dialog.findAllByType("img")).toHaveLength(0);
    expect(dialog.findAllByProps({ "data-metric": "damage" })).toHaveLength(0);
    expect(text(comparison)).toContain("Un tiret indique une donnée indisponible.");
  });

  it("shares the resolved opponent with the visual views and clears it for another match", () => {
    const callbacks = [];
    const controls = ({ onOpponentResolved }) => {
      callbacks.push(onOpponentResolved);
      return <span>Contexte conservé</span>;
    };
    const match = draftedGame();
    const renderer = render({ match, contextControls: controls });
    const firstCallback = callbacks.at(-1);
    act(() => firstCallback("Orion"));
    expect(renderer.root.findByType(MatchLineups).props.snapshot.context.opponentName).toBe("Orion");
    expect(renderer.root.findByType(MatchKillMap).props.enemyName).toBe("Orion");
    selectTab(renderer, "Drafting");
    expect(renderer.root.findByType(MatchKillMap).props.enemyName).toBe("Orion");
    selectTab(renderer, "Face-à-face");
    expect(renderer.root.findByType(MatchHeadToHead).props.snapshot.context.opponentName).toBe("Orion");
    act(() => renderer.update(<MatchDataPanel match={{ ...match, duration: "25:00" }} contextControls={controls} />));
    expect(renderer.root.findByType(MatchHeadToHead).props.snapshot.context.opponentName).toBe("Orion");
    act(() => renderer.update(<MatchDataPanel match={{ ...match, id: "other-game" }} contextControls={controls} />));
    act(() => firstCallback("Ancien adversaire"));
    expect(renderer.root.findByType(MatchLineups).props.snapshot.context.opponentName).toBe("Adversaires");
    expect(text(renderer.root)).not.toContain("Orion");
    expect(text(renderer.root)).not.toContain("Ancien adversaire");
  });

  it("links keyboard-operable tabs to their visible panel", () => {
    const renderer = render();
    const preventDefault = vi.fn();
    act(() => tab(renderer, "Débrief").props.onKeyDown({ key: "ArrowRight", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    const active = tab(renderer, "Face-à-face");
    const panel = renderer.root.findAllByProps({ role: "tabpanel" }).find(visible);
    expect(active.props["aria-selected"]).toBe(true);
    expect(active.props.tabIndex).toBe(0);
    expect(panel.props.id).toBe(active.props["aria-controls"]);
    expect(panel.props["aria-labelledby"]).toBe(active.props.id);
  });

  it("preserves caller-provided context actions across all tabs", () => {
    const onModify = vi.fn();
    const renderer = render({ contextControls: <><strong>Atlas adversaire</strong><button type="button" onClick={onModify}>Modifier l’adversaire</button></> });
    for (const label of ["Débrief", "Face-à-face", "Drafting"]) {
      selectTab(renderer, label);
      expect(text(renderer.root)).toContain("Atlas adversaire");
      const modify = renderer.root.findAllByType("button").find((node) => text(node) === "Modifier l’adversaire");
      act(() => modify.props.onClick());
    }
    expect(onModify).toHaveBeenCalledTimes(3);
  });

  it("shows their draft before ours and orders each team's champions by role in the standalone composition analysis", () => {
    const renderer = renderComposition({ match: draftedGame() });
    const panel = renderer.root.findByType(DraftImpactPanel);
    expect(panel.findAllByType("section").map((section) => section.props["aria-label"])).toEqual(["La leur", "La nôtre"]);
    for (const [label, teamKey, otherTeamKey] of [["La leur", "ENEMY", "ALLY"], ["La nôtre", "ALLY", "ENEMY"]]) {
      const section = drafting(renderer, label);
      const slots = draftSlots(section);
      expect(slots).toHaveLength(5);
      draftChampions[teamKey].forEach((champion, index) => expect(text(slots[index])).toContain(champion));
      draftChampions[otherTeamKey].forEach((champion) => expect(text(section)).not.toContain(champion));
      expect(text(section)).toContain("Plan possible");
    }
    expect(text(panel)).toContain("Lecture indicative des champions joués, à confirmer en débrief.");
  });

  it("recognizes Riot's role names without changing the five-role draft order", () => {
    const match = draftedGame();
    const riotRoles = { TOP: "TOP", JGL: "JUNGLE", MID: "MIDDLE", ADC: "BOTTOM", SUP: "UTILITY" };
    match.participants = match.participants.map((row) => ({ ...row, role: riotRoles[row.role] }));
    const renderer = renderComposition({ match });
    for (const [label, teamKey] of [["La leur", "ENEMY"], ["La nôtre", "ALLY"]]) {
      const slots = draftSlots(drafting(renderer, label));
      draftChampions[teamKey].forEach((champion, index) => expect(text(slots[index])).toContain(champion));
    }
  });

  it("keeps the same possible plan when tied composition tags arrive in a different participant order", () => {
    const match = completeGame();
    const champions = ["Ahri", "Corki", "Jinx", "Zyra", "Bard"];
    const ally = match.participants.filter((row) => row.team_key === "ALLY").map((row, index) => ({ ...row, champion: champions[index] }));
    const enemy = match.participants.filter((row) => row.team_key === "ENEMY");
    const renderer = renderComposition({ match: { ...match, participants: [...ally, ...enemy] } });
    const readPlan = () => {
      const heading = drafting(renderer, "La nôtre").findAllByType("h5").find((node) => text(node) === "Plan possible");
      expect(heading).toBeDefined();
      return text(heading.parent.findByType("p"));
    };
    const initialPlan = readPlan();
    expect(initialPlan).not.toBe("");
    for (const reordered of [[...ally].reverse(), [ally[3], ally[0], ally[4], ally[1], ally[2]]]) {
      act(() => renderer.update(<DraftImpactPanel match={{ ...match, participants: [...reordered, ...enemy] }} />));
      expect(readPlan()).toBe(initialPlan);
    }
  });

  it("keeps missing champions visible without borrowing the opposing team's draft or inventing a plan", () => {
    const match = game();
    match.participants = match.participants.filter((row) => row.team_key === "ENEMY");
    const renderer = renderComposition({ match });
    const ours = drafting(renderer, "La nôtre");
    const theirs = drafting(renderer, "La leur");
    expect(draftSlots(ours)).toHaveLength(5);
    expect(draftSlots(ours).every((slot) => text(slot).includes("Non renseigné"))).toBe(true);
    expect(text(ours)).not.toContain("Syndra");
    expect(text(draftSlots(theirs)[2])).toContain("Syndra");
    expect(draftSlots(theirs).filter((slot) => text(slot).includes("Non renseigné"))).toHaveLength(4);
    for (const section of [ours, theirs]) {
      expect(text(section)).toContain("Composition incomplète : le plan de jeu reste à confirmer.");
      expect(text(section)).not.toContain("Plan possible");
    }
  });

  it.each([undefined, "FLEX"])("preserves a champion with a missing or unknown role under positions to confirm (%s)", (role) => {
    const match = draftedGame();
    match.participants = match.participants.map((row) => row.team_key === "ALLY" && row.role === "TOP" ? { ...row, role } : row);
    const renderer = renderComposition({ match });
    const ours = drafting(renderer, "La nôtre");
    expect(text(draftSlots(ours)[0])).toContain("Non renseigné");
    expect(text(draftSlots(ours)[0])).not.toContain("Ornn");
    expect(text(ours)).toContain("Postes à confirmer");
    expect(text(ours)).toContain("Ornn");
    expect(text(ours)).toContain("Plan possible");
  });

  it("marks a recorded role with no champion as incomplete", () => {
    const match = draftedGame();
    match.participants = match.participants.map((row) => row.team_key === "ALLY" && row.role === "TOP" ? { ...row, champion: null } : row);
    const renderer = renderComposition({ match });
    const ours = drafting(renderer, "La nôtre");
    expect(text(draftSlots(ours)[0])).toContain("Non renseigné");
    expect(text(ours)).not.toContain("Ornn");
    expect(text(ours)).toContain("Composition incomplète : le plan de jeu reste à confirmer.");
    expect(text(ours)).not.toContain("Plan possible");
  });

  it("does not present an unknown champion's composition as a known game plan", () => {
    const match = draftedGame();
    match.participants = match.participants.map((row) => row.team_key === "ALLY" && row.role === "TOP" ? { ...row, champion: "ChampionAbsentDuCatalogue" } : row);
    const renderer = renderComposition({ match });
    const ours = drafting(renderer, "La nôtre");
    expect(text(draftSlots(ours)[0])).toContain("Champion Absent Du Catalogue");
    expect(text(ours)).toContain("Le plan de jeu reste à confirmer pour cette composition.");
    expect(text(ours)).not.toContain("Plan possible");
    expect(text(drafting(renderer, "La leur"))).toContain("Plan possible");
  });

  it("bases drafting on champions without displaying final damage percentages", () => {
    const match = draftedGame();
    match.participants = match.participants.map((row) => ({ ...row, raw: { ...row.raw, physicalDamageDealtToChampions: 90000, magicDamageDealtToChampions: 5000, trueDamageDealtToChampions: 5000 } }));
    const renderer = renderComposition({ match });
    const reading = text(renderer.root.findByType(DraftImpactPanel));
    expect(reading).not.toContain("%");
    expect(reading).not.toContain("Dégâts AD très dominants");
    expect(reading).not.toContain("Magique");
    expect(reading).not.toContain("Physique");
    expect(reading).not.toContain("Brut");
    expect(reading).not.toContain("Écart morts");
  });

  it("keeps the game review action available without opening details", () => {
    const renderer = render();
    const prepare = renderer.root.findAllByType(Button).find((node) => node.props.children === "Préparer le débrief");
    act(() => prepare.props.onClick());
    expect(openAppPath).toHaveBeenCalledWith("/rapports?match=game%2F1&compose=1");
    const onReview = vi.fn();
    act(() => renderer.update(<MatchDataPanel match={game()} onReview={onReview} hasReview />));
    const existing = renderer.root.findAllByType(Button).find((node) => node.props.children === "Ouvrir le débrief");
    act(() => existing.props.onClick());
    expect(onReview).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByType("details").every((node) => node.props.open !== true)).toBe(true);
  });

  it("disables the review action when the game has no saved identifier", () => {
    const renderer = render({ match: game("") });
    const prepare = renderer.root.findAllByType(Button).find((node) => node.props.children === "Préparer le débrief");
    expect(prepare.props.disabled).toBe(true);
    expect(openAppPath).not.toHaveBeenCalled();
  });
});
