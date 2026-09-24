import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTrendSeries } from "../utils/trends.js";
import { TrendEvolution } from "../components/trends/TrendEvolution.jsx";

function game(day, overrides = {}) {
  return {
    id: `game-${day}`,
    game_date: new Date(Date.UTC(2026, 0, day)).toISOString(),
    result: "Victoire",
    participants: ["ALLY", "ENEMY"].flatMap((team) => Array.from({ length: 5 }, () => ({
      team_key: team,
      gold: team === "ALLY" ? 12000 : 10000,
      vision: team === "ALLY" ? 30 : 20,
      deaths: 2,
    }))),
    ...overrides,
  };
}

let renderer;
afterEach(() => { act(() => renderer?.unmount()); renderer = null; });
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
function mount(matches) {
  const onOpenMatch = vi.fn();
  act(() => { renderer = TestRenderer.create(<TrendEvolution matches={matches} onOpenMatch={onOpenMatch} />); });
  return {
    onOpenMatch,
    update: (next) => act(() => renderer.update(<TrendEvolution matches={next} onOpenMatch={onOpenMatch} />)),
    select: (label) => renderer.root.findAllByType("select").find((node) => node.props["aria-label"] === label),
    button: (label) => renderer.root.findAllByType("button").find((node) => node.props["aria-label"] === label || text(node).trim() === label),
  };
}

describe("game-by-game trend series", () => {
  it("includes all games, preserves equal-date order and leaves unknown dates outside the curve", () => {
    const unknown = game(8, { id: "unknown", game_date: null });
    const tied = game(3, { id: "tied" });
    const games = Object.freeze([unknown, game(3), tied, game(1), game(2)]);
    const series = buildTrendSeries(games);
    expect(series.points.map(({ match }) => match.id)).toEqual(["game-1", "game-2", "game-3", "tied", "unknown"]);
    expect(series.undated.map(({ match }) => match.id)).toEqual(["unknown"]);
    expect(series.dated).toHaveLength(4);
    expect(games[0]).toBe(unknown);
    expect(buildTrendSeries(Array.from({ length: 301 }, (_, index) => game(index + 1))).points).toHaveLength(301);
  });

  it("breaks the line at missing observations without dropping the game or inventing zero", () => {
    const missing = game(2);
    missing.participants[0].gold = null;
    const series = buildTrendSeries([game(3), missing, game(1)]);
    expect(series.dated.map(({ value }) => value)).toEqual([10000, null, 10000]);
    expect(series.availableCount).toBe(2);
    expect(series.segments.map((segment) => segment.map(({ match }) => match.id))).toEqual([["game-1"], ["game-3"]]);
  });

  it("keeps real zero values and known losses, while absent results stay unknown", () => {
    const zero = game(1, { result: "Défaite" });
    zero.participants.forEach((row) => { row.gold = 0; row.vision = "0"; row.deaths = 0; });
    for (const metric of ["gold", "vision", "deaths"]) {
      expect(buildTrendSeries([zero], metric).dated[0]).toMatchObject({ value: 0, result: 0 });
    }
    expect(buildTrendSeries([game(2, { result: null, participants: [] })]).dated[0]).toMatchObject({ value: null, result: null });
  });

  it("requires complete teams for differences and complete allies for deaths", () => {
    const partialEnemy = game(1);
    partialEnemy.participants.pop();
    expect(buildTrendSeries([partialEnemy], "gold").dated[0].value).toBeNull();
    expect(buildTrendSeries([partialEnemy], "vision").dated[0].value).toBeNull();
    expect(buildTrendSeries([partialEnemy], "deaths").dated[0].value).toBe(10);
    partialEnemy.participants[0].deaths = " ";
    expect(buildTrendSeries([partialEnemy], "deaths").dated[0].value).toBeNull();
  });

  it("reads preserved Riot values and keeps selection keys stable when filters reorder games", () => {
    const raw = game(1);
    raw.participants = raw.participants.map(({ team_key, gold, vision, deaths }) => ({ team_key, raw: { goldEarned: gold, visionScore: vision, deaths } }));
    expect(buildTrendSeries([raw]).dated[0].value).toBe(10000);
    expect(buildTrendSeries([raw], "vision").dated[0].value).toBe(50);
    expect(buildTrendSeries([raw], "deaths").dated[0].value).toBe(10);
    expect(buildTrendSeries([game(2), raw]).dated[0].key).toBe(buildTrendSeries([raw]).dated[0].key);
  });
});

describe("trend evolution interactions", () => {
  it.each([[2, [0, 100]], [4, [0, 100 / 3, 100]], [5, [0, 50, 100]]])("aligns date labels with game positions for a %i-game series", (count, expected) => {
    mount(Array.from({ length: count }, (_, index) => game(index + 1)));
    const labels = renderer.root.findByProps({ className: "trend-series-x-axis" }).findAllByType("span");
    expect(labels).toHaveLength(expected.length);
    labels.forEach((label, index) => expect(parseFloat(label.props.style.left)).toBeCloseTo(expected[index]));
  });

  it("keeps the chosen game across metric and period changes, opening the exact source", () => {
    const games = [game(3), game(2), game(1)];
    const app = mount(games);
    act(() => app.select("Partie à examiner").props.onChange({ target: { value: "game:game-2:0" } }));
    act(() => app.select("Mesure à suivre").props.onChange({ target: { value: "deaths" } }));
    expect(app.select("Partie à examiner").props.value).toBe("game:game-2:0");
    app.update([games[1], games[0]]);
    expect(app.select("Partie à examiner").props.value).toBe("game:game-2:0");
    act(() => app.button("Ouvrir cette partie").props.onClick());
    expect(app.onOpenMatch).toHaveBeenCalledWith(games[1]);
    app.update([games[0]]);
    expect(app.select("Partie à examiner").props.value).toBe("game:game-3:0");
  });

  it("allows chronological keyboard controls and unknown-date selection without extra chart tab stops", () => {
    const unknown = game(4, { id: "unknown", game_date: null });
    const app = mount([unknown, game(2), game(1)]);
    act(() => app.button("Partie suivante").props.onClick());
    expect(app.select("Partie à examiner").props.value).toBe("game:unknown:0");
    expect(app.button("Partie suivante").props.disabled).toBe(true);
    act(() => app.button("Partie précédente").props.onClick());
    act(() => app.button("Partie précédente").props.onClick());
    expect(app.button("Partie précédente").props.disabled).toBe(true);
    expect(renderer.root.findAll((node) => node.props.tabIndex >= 0)).toHaveLength(0);
  });

  it("renders zero, a singleton and a fully missing series explicitly without fabricated lines", () => {
    const zero = game(1);
    zero.participants.forEach((row) => { row.gold = 0; });
    const app = mount([zero]);
    expect(text(renderer.toJSON())).toContain("0 or");
    expect(text(renderer.toJSON())).toContain("Un seul point disponible");
    expect(renderer.root.findAllByType("polyline")).toHaveLength(0);
    app.update([game(1, { participants: [] })]);
    expect(text(renderer.toJSON())).toContain("Aucune valeur disponible pour cette mesure");
    expect(text(renderer.toJSON())).toContain("Donnée indisponible");
    app.update([]);
    expect(text(renderer.toJSON())).toContain("Aucune partie dans cette sélection");
  });

  it("keeps a long series usable with a collapsed paginated source list", () => {
    const app = mount(Array.from({ length: 301 }, (_, index) => game(index + 1)));
    expect(app.select("Partie à examiner").findAllByType("option")).toHaveLength(301);
    expect(renderer.root.findAllByType("button")).toHaveLength(3);
    const details = renderer.root.findByType("details");
    act(() => details.props.onToggle({ currentTarget: { open: true } }));
    expect(renderer.root.findAllByType("li")).toHaveLength(10);
    act(() => app.button("Page suivante du relevé").props.onClick());
    expect(text(renderer.toJSON())).toContain("11–20 sur 301");
    act(() => details.props.onToggle({ currentTarget: { open: false } }));
    expect(renderer.root.findAllByType("li")).toHaveLength(0);
  });
});
