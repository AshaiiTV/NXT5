import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openAppPath } from "../app/routing.js";
import { Button } from "../components/ui/Core.jsx";
import {
  MatchDataPanel, MatchVersusOverview, MatchTimelineReview,
  GameSummaryPanel, GameMetricSignals, RoleDiffPanel, DeathContextPanel, DraftImpactPanel,
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
function render(props = {}) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<MatchDataPanel match={game()} teamName="Équipe Atlas" {...props} />); });
  renderers.push(renderer);
  return renderer;
}
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function disclosure(renderer, title) {
  return renderer.root.findAllByType("details").find((node) => text(node.findByType("summary")).startsWith(title));
}
function toggle(renderer, title, open) {
  act(() => disclosure(renderer, title).props.onToggle({ currentTarget: { open } }));
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
    expect(renderer.root.findAllByType("details")).toHaveLength(3);
    expect(renderer.root.findAllByType("details").every((node) => node.props.open === false)).toBe(true);
    for (const Component of [MatchVersusOverview, GameSummaryPanel, GameMetricSignals, RoleDiffPanel, DeathContextPanel, DraftImpactPanel, MatchTimelineReview]) {
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

  it("reveals all statistics and advanced readings only when their native disclosure opens", () => {
    const renderer = render();
    toggle(renderer, "Statistiques et comparaison", true);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(1);
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Éliminations / morts / assistances");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Repères de l’analyse");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Informations de la partie");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("EUW1_123");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("16.19");
    expect(renderer.root.findAllByType(GameSummaryPanel)).toHaveLength(0);
    toggle(renderer, "Points à approfondir", true);
    const supportingReading = text(disclosure(renderer, "Points à approfondir"));
    expect(supportingReading).toContain("À garder");
    expect(supportingReading).toContain("MID termine avec +2\u202f000 or face à son adversaire");
    expect(supportingReading).toContain("Prochaine action");
    expect(supportingReading).toContain("Identifier dans la vidéo de la partie une préparation reproductible pour la prochaine partie.");
    for (const Component of [GameSummaryPanel, GameMetricSignals, RoleDiffPanel, DeathContextPanel, DraftImpactPanel]) {
      expect(renderer.root.findAllByType(Component)).toHaveLength(1);
    }
    toggle(renderer, "Chronologie de la partie", true);
    expect(renderer.root.findByType(MatchTimelineReview).props.teamName).toBe("Équipe Atlas");
    expect(text(disclosure(renderer, "Chronologie de la partie"))).toContain("Chronologie indisponible");
    toggle(renderer, "Statistiques et comparaison", false);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(0);
    expect(text(renderer.root)).not.toContain("EUW1_123");
    expect(disclosure(renderer, "Points à approfondir").props.open).toBe(true);
  });

  it("keeps opened details on refresh of the same game and resets them when another game opens", () => {
    const renderer = render();
    toggle(renderer, "Points à approfondir", true);
    act(() => renderer.update(<MatchDataPanel match={{ ...game(), duration: "25:00" }} />));
    expect(disclosure(renderer, "Points à approfondir").props.open).toBe(true);
    act(() => renderer.update(<MatchDataPanel match={game("game-2")} />));
    expect(renderer.root.findAllByType("details").every((node) => node.props.open === false)).toBe(true);
    expect(renderer.root.findAllByType(GameSummaryPanel)).toHaveLength(0);
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
