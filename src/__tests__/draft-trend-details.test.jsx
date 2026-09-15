import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDraftTrendModel, DRAFT_DETAIL_SECTIONS, DraftTrendsModule } from "../components/trends/DraftTrends.jsx";
import { DraftTrendDetails } from "../components/trends/DraftTrendDetails.jsx";
import { SelectInput, TextInput } from "../components/ui/Core.jsx";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const lineups = [
  ["Ornn", "Sejuani", "Orianna", "Jinx", "Lulu"],
  ["Gnar", "Vi", "Ahri", "Caitlyn", "Lux"],
  ["Renekton", "Wukong", "Syndra", "Ashe", "Leona"],
  ["Aatrox", "LeeSin", "Viktor", "Ezreal", "Nautilus"],
];
function games(result = "Victoire") {
  return lineups.flatMap((champions, lineup) => [0, 1].map((round) => ({
    id: `game-${lineup}-${round}`,
    result,
    participants: champions.map((champion, index) => ({ team_key: "ALLY", role: roles[index], champion, kills: 3, deaths: 2, assists: 7, damage: 12000, vision: 20, gold: 10000 })),
  })));
}

let renderer;
afterEach(() => { act(() => renderer?.unmount()); renderer = null; });
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
function mount(element) {
  act(() => { renderer = TestRenderer.create(element); });
  return renderer;
}
function control(Type, label) {
  return renderer.root.findAllByType(Type).find((node) => node.props.label === label);
}
function sourceButtons() {
  return renderer.root.findAllByType("button").filter((node) => String(node.props["aria-label"] || "").startsWith("Voir les games sources :"));
}

describe("draft detail data and entry links", () => {
  it("retains every duo and exact source games beyond the six-row overview", () => {
    const matches = games();
    const model = buildDraftTrendModel(matches);
    expect(model.ally.allDuos).toHaveLength(12);
    expect(model.ally.duos).toHaveLength(6);
    expect(model.ally.allDuos.every((duo) => duo.games === 2 && duo.wins === 2 && duo.wr === 100)).toBe(true);
    expect(model.ally.allDuos.find((duo) => duo.champions === "Sejuani + Orianna").matches).toEqual(matches.slice(0, 2));
    expect(model.ally.allDuos.find((duo) => duo.champions === "Ezreal + Nautilus").matches).toEqual(matches.slice(6, 8));
    expect(model.ally.picks).toHaveLength(20);
    expect(model.ally.comfort).toHaveLength(5);
    expect(model.ally.rolePicks.every((entry) => entry.picks.length === 3)).toBe(true);
    expect(buildDraftTrendModel(matches.slice(0, 2)).ally.allDuos).toHaveLength(3);
  });

  it("provides seven named links to distinct annex pages with the current scope", () => {
    const onNavigateDetail = vi.fn();
    mount(<DraftTrendsModule model={buildDraftTrendModel(games())} detailHref={(id) => `/tendances/draft/${id}?contexte=scrim&periode=5`} onNavigateDetail={onNavigateDetail} />);
    const links = renderer.root.findAllByType("a").filter((node) => String(node.props["aria-label"] || "").startsWith("Voir le détail :"));
    expect(links).toHaveLength(7);
    expect(new Set(links.map((link) => link.props.href)).size).toBe(7);
    for (const section of DRAFT_DETAIL_SECTIONS) {
      const link = links.find((node) => node.props.href === `/tendances/draft/${section.id}?contexte=scrim&periode=5`);
      expect(link.props["aria-label"]).toBe(`Voir le détail : ${section.title}`);
    }
    const event = { button: 0, preventDefault: vi.fn() };
    act(() => links.find((link) => link.props.href.includes("/duos?")).props.onClick(event));
    expect(onNavigateDetail).toHaveBeenCalledWith(event, "duos");
  });
});

describe("draft annex exploration", () => {
  it("shows all duos, narrows by champion and roles, and opens only their source games", () => {
    const matches = games();
    const onOpenSources = vi.fn();
    const sourceGamesForMatches = vi.fn((sources) => sources.map((match) => ({ id: match.id, match })));
    mount(<DraftTrendDetails sectionId="duos" model={buildDraftTrendModel(matches)} onOpenSources={onOpenSources} sourceGamesForMatches={sourceGamesForMatches} />);
    expect(sourceButtons()).toHaveLength(12);
    act(() => control(TextInput, "Rechercher un duo").props.onChange("sejuani"));
    expect(sourceButtons()).toHaveLength(2);
    act(() => control(SelectInput, "Paire de rôles").props.onChange("Jungle + Mid"));
    expect(sourceButtons()).toHaveLength(1);
    expect(text(sourceButtons()[0])).toContain("Sejuani + Orianna");
    expect(sourceButtons()[0].props["aria-label"]).toContain("Jungle + Mid");
    expect(sourceButtons()[0].props["aria-label"]).toContain("25%");
    act(() => sourceButtons()[0].props.onClick());
    expect(sourceGamesForMatches).toHaveBeenLastCalledWith(matches.slice(0, 2));
    expect(onOpenSources).toHaveBeenLastCalledWith(expect.objectContaining({ games: matches.slice(0, 2).map((match) => ({ id: match.id, match })) }));
    act(() => control(TextInput, "Rechercher un duo").props.onChange("aucun-champion"));
    expect(sourceButtons()).toHaveLength(0);
    expect(text(renderer.toJSON())).toMatch(/aucun/i);
  });

  it.each([["confort", "Victoire"], ["a-revoir", "Défaite"]])("shows the complete %s list beyond the overview's five picks", (sectionId, result) => {
    mount(<DraftTrendDetails sectionId={sectionId} model={buildDraftTrendModel(games(result))} onOpenSources={vi.fn()} sourceGamesForMatches={(sources) => sources} />);
    expect(sourceButtons()).toHaveLength(20);
    act(() => control(SelectInput, "Rôle").props.onChange("TOP"));
    expect(sourceButtons()).toHaveLength(4);
    const content = sourceButtons().map(text).join(" ");
    for (const champion of ["Ornn", "Gnar", "Renekton", "Aatrox"]) expect(content).toContain(champion);
    expect(content).not.toContain("Sejuani");
  });

  it("shows every champion for a role and updates the source list when the scope changes", () => {
    const matches = games();
    const onOpenSources = vi.fn();
    const detail = (scope) => <DraftTrendDetails sectionId="roles" model={buildDraftTrendModel(scope)} onOpenSources={onOpenSources} sourceGamesForMatches={(sources) => sources} />;
    mount(detail(matches));
    act(() => control(SelectInput, "Rôle").props.onChange("MID"));
    expect(sourceButtons()).toHaveLength(4);
    act(() => control(TextInput, "Rechercher un champion").props.onChange("viktor"));
    expect(sourceButtons()).toHaveLength(1);
    act(() => sourceButtons()[0].props.onClick());
    expect(onOpenSources).toHaveBeenLastCalledWith(expect.objectContaining({ games: matches.slice(6, 8) }));
    act(() => renderer.update(detail(matches.slice(0, 2))));
    expect(sourceButtons().every((button) => !text(button).includes("Viktor"))).toBe(true);
  });

  it("keeps a selected role named when a narrower scope has no game for that role", () => {
    const matches = games();
    const detail = (scope) => <DraftTrendDetails sectionId="roles" model={buildDraftTrendModel(scope)} onOpenSources={vi.fn()} />;
    mount(detail(matches));
    act(() => control(SelectInput, "Rôle").props.onChange("MID"));
    const withoutMid = matches.map((match) => ({ ...match, participants: match.participants.filter((row) => row.role !== "MID") }));
    act(() => renderer.update(detail(withoutMid)));
    const select = control(SelectInput, "Rôle").findByType("select");
    expect(select.props.value).toBe("MID");
    expect(select.findAllByType("option").map((option) => option.props.value)).toContain("MID");
    expect(sourceButtons()).toHaveLength(0);
    expect(text(renderer.toJSON())).toContain("Aucun pick ne correspond");
  });
});
