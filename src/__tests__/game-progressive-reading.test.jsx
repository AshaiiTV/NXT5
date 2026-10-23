import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openAppPath } from "../app/routing.js";
import { Button } from "../components/ui/Core.jsx";
import { MatchLineups, MatchHeadToHead } from "../components/games/MatchHeadToHead.jsx";
import { MatchDuelDetails } from "../components/games/MatchVisualRecap.jsx";
import MatchGoldChart from "../components/games/MatchGoldChart.jsx";
import {
  MatchDataPanel, MatchVersusOverview, MatchTimelineReview,
  MatchReadingIntro, DeathContextPanel, DraftImpactPanel,
} from "../pages/workspace/GameWorkspace.jsx";

vi.mock("../app/routing.js", async (load) => ({ ...await load(), openAppPath: vi.fn() }));
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
function render(props = {}) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<MatchDataPanel match={game()} teamName="Équipe Atlas" {...props} />); });
  renderers.push(renderer);
  return renderer;
}
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function disclosure(renderer, title) {
  return renderer.root.findAllByProps({ className: "games-analysis-disclosure" }).find((node) => text(node.children.find((child) => child.type === "summary")).startsWith(title));
}
function toggle(renderer, title, open) {
  act(() => disclosure(renderer, title).props.onToggle({ currentTarget: { open } }));
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
  it("starts with the visual recap and offers each deeper view in one tab", () => {
    const renderer = render();
    const brief = renderer.root.findByProps({ "aria-label": "Bilan de la partie" });
    expect(text(renderer.root)).toContain("Partie contre Atlas");
    expect(text(renderer.root).indexOf("Partie contre Atlas")).toBeLessThan(text(renderer.root).indexOf("Victoire"));
    expect(text(renderer.root)).toContain("Victoire");
    expect(text(renderer.root)).toContain("Durée : 24:30");
    expect(text(renderer.root)).toContain("Notre équipe : côté bleu");
    expect(text(brief)).toContain("Point à explorer");
    expect(renderer.root.findAllByProps({ role: "tab" }).map(text)).toEqual(["Récap", "Face-à-face", "Drafting", "Chronologie"]);
    expect(tab(renderer, "Récap").props["aria-selected"]).toBe(true);
    expect(renderer.root.findAllByType(MatchLineups)).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(1);
    expect(text(renderer.root)).not.toContain("EUW1_123");
    expect(text(renderer.root)).not.toContain("16.19");
    expect(text(renderer.root)).not.toContain("Tous les débriefs");
    for (const Component of [MatchHeadToHead, MatchVersusOverview, MatchReadingIntro, DeathContextPanel, DraftImpactPanel, MatchTimelineReview]) {
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
    expect(reading).toContain("Un écart final ne suffit pas à expliquer le résultat.");
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

  it("keeps full statistics and information reachable under the face-to-face view", () => {
    const renderer = render();
    selectTab(renderer, "Face-à-face");
    expect(renderer.root.findAllByType(MatchHeadToHead)).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchLineups)).toHaveLength(0);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(0);
    toggle(renderer, "Statistiques et comparaison", true);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(1);
    const stats = text(disclosure(renderer, "Statistiques et comparaison"));
    for (const value of ["Éliminations / morts / assistances", "Repères de l’analyse", "Informations de la partie", "EUW1_123", "16.19"]) expect(stats).toContain(value);
    expect(renderer.root.findAllByType(MatchReadingIntro)).toHaveLength(0);
    selectTab(renderer, "Drafting");
    const supportingReading = text(renderer.root.findByType(DraftImpactPanel));
    expect(supportingReading).toContain("La leur");
    expect(supportingReading).toContain("La nôtre");
    for (const duplicate of ["Ce qui entoure les morts", "La composition, en situation", "Les contributions par rôle", "Économie finale", "Autres repères chiffrés", "À garder", "Prochaine action"]) expect(supportingReading).not.toContain(duplicate);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(0);
    expect(renderer.root.findByType(DraftImpactPanel).findAllByType("button")).toHaveLength(0);
    selectTab(renderer, "Chronologie");
    expect(renderer.root.findByType(MatchTimelineReview).props.teamName).toBe("Équipe Atlas");
    expect(text(renderer.root.findByType(MatchTimelineReview))).toContain("Chronologie indisponible");
    expect(renderer.root.findAllByType(DraftImpactPanel)).toHaveLength(0);
    expect(text(renderer.root)).not.toContain("EUW1_123");
  });

  it("opens the suggested role with one click and can return to the recap", () => {
    const match = draftedGame();
    match.participants.find((row) => row.team_key === "ALLY" && row.role === "ADC").gold = 5000;
    const renderer = render({ match });
    expect(text(renderer.root)).toContain("Le duel ADC");
    act(() => action(renderer, "Comparer ce duel").props.onClick());
    expect(tab(renderer, "Face-à-face").props["aria-selected"]).toBe(true);
    expect(renderer.root.findByType(MatchHeadToHead).props.selectedRole).toBe("ADC");
    expect(renderer.root.findByType(MatchDuelDetails).props.pair.role).toBe("ADC");
    expect(text(renderer.root.findByType(MatchDuelDetails))).toContain("Jinx");
    expect(text(renderer.root.findByType(MatchDuelDetails))).toContain("Caitlyn");
    selectTab(renderer, "Récap");
    expect(renderer.root.findAllByType(MatchLineups)).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchDuelDetails)).toHaveLength(0);
  });

  it("keeps the selected tab and role on refresh and resets them for another game", () => {
    const match = draftedGame();
    const renderer = render({ match });
    selectTab(renderer, "Face-à-face");
    act(() => renderer.root.findByType(MatchHeadToHead).props.onSelectRole("MID"));
    act(() => renderer.update(<MatchDataPanel match={{ ...match, duration: "25:00" }} />));
    expect(tab(renderer, "Face-à-face").props["aria-selected"]).toBe(true);
    expect(renderer.root.findByType(MatchHeadToHead).props.selectedRole).toBe("MID");
    act(() => renderer.update(<MatchDataPanel match={{ ...match, id: "game-2" }} />));
    expect(tab(renderer, "Récap").props["aria-selected"]).toBe(true);
    selectTab(renderer, "Face-à-face");
    expect(renderer.root.findByType(MatchHeadToHead).props.selectedRole).toBe("");
    expect(renderer.root.findAllByProps({ "aria-label": "Détail du duel MID" })).toHaveLength(0);
  });

  it("preserves missing values and measured zero in a selected duel", () => {
    const match = draftedGame();
    Object.assign(match.participants.find((row) => row.team_key === "ALLY" && row.role === "MID"), {
      gold: null, damage: 0, vision: null, kills: null, deaths: 0, assists: null,
    });
    const renderer = render({ match });
    selectTab(renderer, "Face-à-face");
    act(() => renderer.root.findByType(MatchHeadToHead).props.onSelectRole("MID"));
    const details = renderer.root.findByType(MatchDuelDetails);
    const values = (label) => details.findAllByType("tr").find((node) => text(node.findAllByType("th")[0]) === label).findAllByType("td").map(text);
    expect(values("Or")[0]).toBe("—");
    expect(values("Dégâts aux champions")[0]).toBe("0");
    expect(values("Score de vision")[0]).toBe("—");
    expect(values("Éliminations / morts / assistances")[0]).toBe("— / 0 / —");
    expect(values("CS à 10 min")).toEqual(["—", "—"]);
    expect(text(details)).toContain("Un tiret indique une donnée indisponible.");
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
    act(() => tab(renderer, "Récap").props.onKeyDown({ key: "ArrowRight", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    const active = tab(renderer, "Face-à-face");
    const panel = renderer.root.findByProps({ role: "tabpanel" });
    expect(active.props["aria-selected"]).toBe(true);
    expect(active.props.tabIndex).toBe(0);
    expect(panel.props.id).toBe(active.props["aria-controls"]);
    expect(panel.props["aria-labelledby"]).toBe(active.props.id);
  });

  it("preserves caller-provided context actions across all tabs", () => {
    const onModify = vi.fn();
    const renderer = render({ contextControls: <><strong>Atlas adversaire</strong><button type="button" onClick={onModify}>Modifier l’adversaire</button><a href="/drafter?game=3">Voir la draft</a></> });
    for (const label of ["Récap", "Face-à-face", "Drafting", "Chronologie"]) {
      selectTab(renderer, label);
      expect(text(renderer.root)).toContain("Atlas adversaire");
      expect(renderer.root.findByProps({ href: "/drafter?game=3" })).toBeDefined();
      const modify = renderer.root.findAllByType("button").find((node) => text(node) === "Modifier l’adversaire");
      act(() => modify.props.onClick());
    }
    expect(onModify).toHaveBeenCalledTimes(4);
  });

  it("shows their draft before ours and orders each team's champions by role", () => {
    const renderer = render({ match: draftedGame() });
    selectTab(renderer, "Drafting");
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
    const renderer = render({ match });
    selectTab(renderer, "Drafting");
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
    const renderer = render({ match: { ...match, participants: [...ally, ...enemy] } });
    selectTab(renderer, "Drafting");
    const readPlan = () => {
      const heading = drafting(renderer, "La nôtre").findAllByType("h5").find((node) => text(node) === "Plan possible");
      expect(heading).toBeDefined();
      return text(heading.parent.findByType("p"));
    };
    const initialPlan = readPlan();
    expect(initialPlan).not.toBe("");
    for (const reordered of [[...ally].reverse(), [ally[3], ally[0], ally[4], ally[1], ally[2]]]) {
      act(() => renderer.update(<MatchDataPanel match={{ ...match, participants: [...reordered, ...enemy] }} />));
      expect(readPlan()).toBe(initialPlan);
    }
  });

  it("keeps missing champions visible without borrowing the opposing team's draft or inventing a plan", () => {
    const match = game();
    match.participants = match.participants.filter((row) => row.team_key === "ENEMY");
    const renderer = render({ match });
    selectTab(renderer, "Drafting");
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
    const renderer = render({ match });
    selectTab(renderer, "Drafting");
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
    const renderer = render({ match });
    selectTab(renderer, "Drafting");
    const ours = drafting(renderer, "La nôtre");
    expect(text(draftSlots(ours)[0])).toContain("Non renseigné");
    expect(text(ours)).not.toContain("Ornn");
    expect(text(ours)).toContain("Composition incomplète : le plan de jeu reste à confirmer.");
    expect(text(ours)).not.toContain("Plan possible");
  });

  it("does not present an unknown champion's composition as a known game plan", () => {
    const match = draftedGame();
    match.participants = match.participants.map((row) => row.team_key === "ALLY" && row.role === "TOP" ? { ...row, champion: "ChampionAbsentDuCatalogue" } : row);
    const renderer = render({ match });
    selectTab(renderer, "Drafting");
    const ours = drafting(renderer, "La nôtre");
    expect(text(draftSlots(ours)[0])).toContain("Champion Absent Du Catalogue");
    expect(text(ours)).toContain("Le plan de jeu reste à confirmer pour cette composition.");
    expect(text(ours)).not.toContain("Plan possible");
    expect(text(drafting(renderer, "La leur"))).toContain("Plan possible");
  });

  it("bases drafting on champions without displaying final damage percentages", () => {
    const match = draftedGame();
    match.participants = match.participants.map((row) => ({ ...row, raw: { ...row.raw, physicalDamageDealtToChampions: 90000, magicDamageDealtToChampions: 5000, trueDamageDealtToChampions: 5000 } }));
    const renderer = render({ match });
    selectTab(renderer, "Drafting");
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
    expect(renderer.root.findAllByType("details").every((node) => node.props.open === false)).toBe(true);
  });

  it("disables the review action when the game has no saved identifier", () => {
    const renderer = render({ match: game("") });
    const prepare = renderer.root.findAllByType(Button).find((node) => node.props.children === "Préparer le débrief");
    expect(prepare.props.disabled).toBe(true);
    expect(openAppPath).not.toHaveBeenCalled();
  });
});
