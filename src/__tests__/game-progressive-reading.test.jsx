import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openAppPath } from "../app/routing.js";
import { Button } from "../components/ui/Core.jsx";
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

function drafting(renderer, label) {
  return renderer.root.findByType(DraftImpactPanel).findByProps({ "aria-label": label });
}
function draftSlots(section) {
  return section.findByType("ol").findAllByType("li");
}

describe("progressive game reading", () => {
  it("starts with one review lead while keeping supporting content behind three disclosures", () => {
    const renderer = render();
    const brief = renderer.root.findByProps({ "aria-label": "Bilan de la partie" });
    expect(text(renderer.root)).toContain("Partie contre Atlas");
    expect(text(renderer.root).indexOf("Partie contre Atlas")).toBeLessThan(text(renderer.root).indexOf("Victoire"));
    expect(text(renderer.root)).toContain("Victoire");
    expect(text(renderer.root)).toContain("Durée : 24:30");
    expect(text(renderer.root)).toContain("Notre équipe : côté bleu");
    expect(text(brief)).toContain("À vérifier en débrief");
    expect(text(renderer.root)).not.toContain("À garder");
    expect(text(renderer.root)).not.toContain("Prochaine action");
    expect(text(renderer.root)).not.toContain("EUW1_123");
    expect(text(renderer.root)).not.toContain("16.19");
    expect(text(renderer.root)).not.toContain("L’essentiel de la partie");
    expect(text(renderer.root)).not.toContain("débrief d’équipe (review)");
    expect(text(renderer.root)).not.toContain("Tous les débriefs");
    expect(text(renderer.root)).not.toMatch(/\b(VOD|setup|game|CS10)\b/);
    expect(text(disclosure(renderer, "Drafting").findByType("summary"))).toContain("La leur / La nôtre");
    expect(renderer.root.findAllByType("details")).toHaveLength(3);
    expect(renderer.root.findAllByType("details").every((node) => node.props.open === false)).toBe(true);
    for (const Component of [MatchVersusOverview, MatchReadingIntro, DeathContextPanel, DraftImpactPanel, MatchTimelineReview]) {
      expect(renderer.root.findAllByType(Component)).toHaveLength(0);
    }
  });

  it.each([
    ["Écart d’or final", { enemy: { gold: 11000 } }, "-5 000"],
    ["Écart de dégâts aux champions", { ally: { damage: 17000 } }, "+10 000"],
    ["Écart de score de vision", { enemy: { vision: 20 } }, "-25"],
  ])("names the measured signal and its direction: %s", (label, stats, value) => {
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
    expect(text(brief)).toContain("Préparer le débrief");
  });

  it("preserves a measured zero as an available statistic", () => {
    const renderer = render({ match: completeGame() });
    const brief = renderer.root.findByProps({ "aria-label": "Bilan de la partie" });
    expect(text(brief)).toContain("Écart d’or final");
    expect(text(brief)).toContain("+0");
    expect(text(brief)).not.toContain("Statistiques incomplètes");
  });

  it("reveals statistics, drafts and timeline only when their native disclosure opens", () => {
    const renderer = render();
    toggle(renderer, "Statistiques et comparaison", true);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(1);
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Éliminations / morts / assistances");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Repères de l’analyse");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Informations de la partie");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("EUW1_123");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("16.19");
    expect(renderer.root.findAllByType(MatchReadingIntro)).toHaveLength(0);
    toggle(renderer, "Drafting", true);
    const supportingReading = text(disclosure(renderer, "Drafting"));
    expect(supportingReading).toContain("La leur");
    expect(supportingReading).toContain("La nôtre");
    expect(supportingReading).not.toContain("Ce qui entoure les morts");
    expect(supportingReading).not.toContain("La composition, en situation");
    for (const duplicate of ["Les contributions par rôle", "Économie finale", "Autres repères chiffrés", "À garder", "Prochaine action"]) {
      expect(supportingReading).not.toContain(duplicate);
    }
    expect(renderer.root.findAllByType(DraftImpactPanel)).toHaveLength(1);
    for (const Component of [MatchReadingIntro, DeathContextPanel]) {
      expect(renderer.root.findAllByType(Component)).toHaveLength(0);
    }
    toggle(renderer, "Chronologie de la partie", true);
    expect(renderer.root.findByType(MatchTimelineReview).props.teamName).toBe("Équipe Atlas");
    const chronologicalReading = text(disclosure(renderer, "Chronologie de la partie"));
    expect(chronologicalReading).toContain("Chronologie indisponible");
    expect(chronologicalReading).not.toContain("Écart d’or final");
    expect(chronologicalReading).not.toContain("Objectifs neutres relevés");
    expect(disclosure(renderer, "Drafting").findAllByType("button")).toHaveLength(0);
    expect(disclosure(renderer, "Statistiques et comparaison").findAllByProps({ className: "nxt5-objective-timeline" })).toHaveLength(0);
    toggle(renderer, "Statistiques et comparaison", false);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(0);
    expect(text(renderer.root)).not.toContain("EUW1_123");
    expect(disclosure(renderer, "Drafting").props.open).toBe(true);
  });

  it("keeps opened details on refresh of the same game and resets them when another game opens", () => {
    const renderer = render();
    toggle(renderer, "Drafting", true);
    act(() => renderer.update(<MatchDataPanel match={{ ...game(), duration: "25:00" }} />));
    expect(disclosure(renderer, "Drafting").props.open).toBe(true);
    act(() => renderer.update(<MatchDataPanel match={game("game-2")} />));
    expect(renderer.root.findAllByType("details").every((node) => node.props.open === false)).toBe(true);
    expect(renderer.root.findAllByType(MatchReadingIntro)).toHaveLength(0);
  });

  it("shows their draft before ours and orders each team's champions by role", () => {
    const renderer = render({ match: draftedGame() });
    toggle(renderer, "Drafting", true);
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
    toggle(renderer, "Drafting", true);
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
    toggle(renderer, "Drafting", true);
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
    toggle(renderer, "Drafting", true);
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
    toggle(renderer, "Drafting", true);
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
    toggle(renderer, "Drafting", true);
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
    toggle(renderer, "Drafting", true);
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
    toggle(renderer, "Drafting", true);
    const reading = text(disclosure(renderer, "Drafting"));
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
