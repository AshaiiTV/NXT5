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
  id, game_id: "EUW1_123", duration: "24:30", side: "blue", result: "Victoire",
  raw: { nxt5Label: "Partie contre Atlas" }, participants: [
    { id: "ally", team_key: "ALLY", role: "MID", champion: "Ahri", summoner_name: "Lune", kills: 4, deaths: 2, assists: 7, gold: 12000, damage: 18000, vision: 18, raw: { participantId: 1, teamId: 100 } },
    { id: "enemy", team_key: "ENEMY", role: "MID", champion: "Syndra", summoner_name: "Rival", kills: 2, deaths: 4, assists: 5, gold: 10000, damage: 15000, vision: 15, raw: { participantId: 6, teamId: 200 } },
  ],
});
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
  it("starts with the result and actionable reading while preserving three clear ways to explore", () => {
    const renderer = render();
    expect(text(renderer.root)).toContain("Victoire");
    expect(text(renderer.root)).toContain("Durée : 24:30");
    expect(text(renderer.root)).toContain("Notre équipe : côté bleu");
    expect(text(renderer.root)).toContain("L’essentiel de la partie");
    expect(text(renderer.root)).toContain("À garder");
    expect(text(renderer.root)).toContain("À vérifier");
    expect(text(renderer.root)).toContain("Prochaine action");
    expect(text(renderer.root)).toContain("débrief d’équipe (review)");
    expect(text(renderer.root)).toContain("vidéo de la partie");
    expect(text(renderer.root)).not.toMatch(/\b(VOD|setup|game|CS10)\b/);
    expect(renderer.root.findAllByType("details")).toHaveLength(3);
    expect(renderer.root.findAllByType("details").every((node) => node.props.open === false)).toBe(true);
    for (const Component of [MatchVersusOverview, GameSummaryPanel, GameMetricSignals, RoleDiffPanel, DeathContextPanel, DraftImpactPanel, MatchTimelineReview]) {
      expect(renderer.root.findAllByType(Component)).toHaveLength(0);
    }
  });

  it("reveals all statistics and advanced readings only when their native disclosure opens", () => {
    const renderer = render();
    toggle(renderer, "Statistiques et comparaison", true);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(1);
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Éliminations / morts / assistances");
    expect(text(disclosure(renderer, "Statistiques et comparaison"))).toContain("Repères de l’analyse");
    expect(renderer.root.findAllByType(GameSummaryPanel)).toHaveLength(0);
    toggle(renderer, "Points à approfondir", true);
    for (const Component of [GameSummaryPanel, GameMetricSignals, RoleDiffPanel, DeathContextPanel, DraftImpactPanel]) {
      expect(renderer.root.findAllByType(Component)).toHaveLength(1);
    }
    toggle(renderer, "Chronologie de la partie", true);
    expect(renderer.root.findByType(MatchTimelineReview).props.teamName).toBe("Équipe Atlas");
    expect(text(disclosure(renderer, "Chronologie de la partie"))).toContain("Chronologie indisponible");
    toggle(renderer, "Statistiques et comparaison", false);
    expect(renderer.root.findAllByType(MatchVersusOverview)).toHaveLength(0);
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

  it("keeps the next action available without opening details and retains the linked review routes", () => {
    const renderer = render();
    const prepare = renderer.root.findAllByType(Button).find((node) => node.props.children === "Préparer le débrief");
    act(() => prepare.props.onClick());
    expect(openAppPath).toHaveBeenCalledWith("/rapports?match=game%2F1&compose=1");
    const all = renderer.root.findAllByType(Button).find((node) => node.props.children === "Tous les débriefs");
    act(() => all.props.onClick());
    expect(openAppPath).toHaveBeenLastCalledWith("/rapports");
    const onReview = vi.fn();
    act(() => renderer.update(<MatchDataPanel match={game()} onReview={onReview} hasReview />));
    const existing = renderer.root.findAllByType(Button).find((node) => node.props.children === "Ouvrir le débrief");
    act(() => existing.props.onClick());
    expect(onReview).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByType("details").every((node) => node.props.open === false)).toBe(true);
  });
});
