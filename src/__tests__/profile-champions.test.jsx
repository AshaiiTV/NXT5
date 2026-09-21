import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, SelectInput } from "../components/ui/Core.jsx";
import { ChampionProfileDetail, ChampionVisualMetric, ProfileChampionsView } from "../pages/workspace/PlayerUltimateProfile.jsx";

const cleanups = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });
function render(element) {
  let renderer;
  act(() => { renderer = TestRenderer.create(element); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
const stat = (champion, results) => ({
  champion, games: results.length,
  rows: results.map((result, index) => ({ kills: 3, deaths: 2, assists: 5, champion, role: "MID", match: { id: `${champion}-${index}`, result, game_date: `2026-09-${10 + index}`, participants: [] } })),
});
const sample = [stat("Ahri", ["Victoire", "Défaite"]), stat("Lux", ["Victoire"]), stat("Annie", [null, null, null])];

describe("champion profile reading flow", () => {
  it("starts with a list and shows only one champion detail, then restores the search on return", () => {
    const onSelectChampion = vi.fn();
    const renderer = render(<ProfileChampionsView championStats={sample} selectedChampion="Ahri" onSelectChampion={onSelectChampion} />);
    expect(renderer.root.findAllByType(ChampionProfileDetail)).toHaveLength(0);
    act(() => renderer.root.findByType("input").props.onChange({ target: { value: "Ahri" } }));
    expect(renderer.root.findAllByProps({ className: "profile-champion-row" })).toHaveLength(1);
    act(() => renderer.root.findByProps({ className: "profile-champion-row" }).props.onClick());
    expect(onSelectChampion).toHaveBeenCalledWith("Ahri");
    expect(renderer.root.findAllByType(ChampionProfileDetail)).toHaveLength(1);
    expect(renderer.root.findAllByProps({ className: "profile-champions-list" })).toHaveLength(0);
    act(() => renderer.root.findAllByType(Button).find((button) => button.props.className === "profile-champions-back").props.onClick());
    expect(renderer.root.findAllByType(ChampionProfileDetail)).toHaveLength(0);
    expect(renderer.root.findByType("input").props.value).toBe("Ahri");
    expect(renderer.root.findAllByProps({ className: "profile-champion-row" })).toHaveLength(1);
  });

  it("sorts by observed result rate and places unknown results last", () => {
    const renderer = render(<ProfileChampionsView championStats={sample} />);
    act(() => renderer.root.findByType(SelectInput).props.onChange("wr"));
    expect(renderer.root.findAllByProps({ className: "profile-champion-row" }).map((row) => row.props["data-champion"])).toEqual(["Lux", "Ahri", "Annie"]);
    act(() => renderer.root.findByType("input").props.onChange({ target: { value: "inconnu" } }));
    expect(renderer.root.findAllByProps({ className: "profile-champion-row" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Aucun champion ne correspond");
  });

  it("keeps unknown results and missing KDA or averages unavailable", () => {
    const unknown = { champion: "Ahri", games: 1, rows: [{ champion: "Ahri", role: "MID", match: { id: "unknown", participants: [] } }] };
    const renderer = render(<ChampionProfileDetail stat={unknown} rows={unknown.rows} />);
    const metrics = renderer.root.findAllByType(ChampionVisualMetric);
    expect(metrics.find((metric) => metric.props.label === "Taux de victoire").props.value).toBe("—");
    expect(metrics.find((metric) => metric.props.label === "Ratio KDA").props.value).toBe("—");
    expect(metrics.find((metric) => metric.props.label === "Participation aux kills").props.value).toBe("—");
    expect(metrics.find((metric) => metric.props.label === "Sbires par minute").props.value).toBe("—");
  });
});
