import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, SelectInput } from "../components/ui/Core.jsx";
import { SortButton } from "../components/ui/SortButton.jsx";
import { ChampionProfileDetail, ChampionVisualMetric, PlayerUltimateProfile, ProfileChampionsView } from "../pages/workspace/PlayerUltimateProfile.jsx";

const cleanups = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });
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
    const winrateSort = () => renderer.root.findByProps({ "data-champion-sort": "winrate" });
    act(() => winrateSort().props.onClick());
    act(() => renderer.root.findByProps({ "data-champion-sort": "games" }).props.onClick());
    expect(renderer.root.findAllByProps({ className: "profile-champion-row" }).map((row) => row.props["data-champion"])).toEqual(["Lux", "Ahri", "Annie"]);
    expect(winrateSort().props["aria-pressed"]).toBe(true);
    act(() => renderer.root.findByType(SelectInput).props.onChange("asc"));
    expect(renderer.root.findAllByProps({ className: "profile-champion-row" }).map((row) => row.props["data-champion"])).toEqual(["Ahri", "Lux", "Annie"]);
    act(() => renderer.root.findByType("input").props.onChange({ target: { value: "inconnu" } }));
    expect(renderer.root.findAllByProps({ className: "profile-champion-row" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Aucun champion ne correspond");
  });

  it("sorts measured KDA including zero, keeps missing values last, and retains the order on detail return", () => {
    const stats = [
      { champion: "Ahri", games: 2, rows: [{ kills: 0, assists: 0, deaths: 2 }] },
      { champion: "Lux", games: 1, rows: [{ kills: 7, assists: 3, deaths: 0 }] },
      { champion: "Annie", games: 3, rows: [{ kills: null, assists: 3, deaths: 2 }] },
    ];
    const renderer = render(<ProfileChampionsView championStats={stats} />);
    const sort = () => renderer.root.findByProps({ "data-champion-sort": "kda" });
    const order = () => renderer.root.findAllByProps({ className: "profile-champion-row" }).map((row) => row.props["data-champion"]);
    expect(order()).toEqual(["Annie", "Ahri", "Lux"]);
    act(() => sort().props.onClick());
    act(() => renderer.root.findByProps({ "data-champion-sort": "games" }).props.onClick());
    expect(order()).toEqual(["Lux", "Ahri", "Annie"]);
    act(() => renderer.root.findAllByProps({ className: "profile-champion-row" })[0].props.onClick());
    act(() => renderer.root.findAllByType(Button).find((button) => button.props.className === "profile-champions-back").props.onClick());
    expect(order()).toEqual(["Lux", "Ahri", "Annie"]);
    act(() => renderer.root.findByType(SelectInput).props.onChange("asc"));
    expect(order()).toEqual(["Ahri", "Lux", "Annie"]);
    expect(renderer.root.findByType(SelectInput).props.value).toBe("asc");
  });

  it("combines criteria and preserves their context scores through search and detail navigation", () => {
    const results = (wins, losses) => [...Array(wins).fill("Victoire"), ...Array(losses).fill("Défaite")];
    const context = [stat("Annie", results(6, 24)), stat("Ahri", results(16, 4)), stat("Lux", results(4, 0))];
    const renderer = render(<ProfileChampionsView championStats={context} />);
    const names = () => renderer.root.findAllByProps({ className: "profile-champion-row" }).map((row) => row.props["data-champion"]);
    const criterion = (id) => renderer.root.findByProps({ "data-champion-sort": id });
    const score = () => renderer.root.findByProps({ "data-champion": "Ahri" }).findAll((node) => node.type === "span" && node.props.className?.split(" ").includes("profile-champion-mini")).at(-1).findByType("strong").children.join("");
    expect(names()).toEqual(["Annie", "Ahri", "Lux"]);
    act(() => criterion("winrate").props.onClick());
    expect(criterion("games").props["aria-pressed"]).toBe(true);
    expect(criterion("winrate").props["aria-pressed"]).toBe(true);
    expect(names()).toEqual(["Ahri", "Annie", "Lux"]);
    expect(score()).toBe("73,3");
    expect(renderer.root.findByProps({ "data-champion": "Ahri" }).props["aria-label"]).toBeUndefined();
    act(() => renderer.root.findByType("input").props.onChange({ target: { value: "Ahri" } }));
    expect(score()).toBe("73,3");
    act(() => renderer.root.findByProps({ "data-champion": "Ahri" }).props.onClick());
    act(() => renderer.root.findAllByType(Button).find((button) => button.props.className === "profile-champions-back").props.onClick());
    expect(renderer.root.findByType("input").props.value).toBe("Ahri");
    expect(criterion("winrate").props["aria-pressed"]).toBe(true);
    expect(score()).toBe("73,3");
    act(() => renderer.root.findByType("input").props.onChange({ target: { value: "" } }));
    act(() => renderer.root.findByType(SelectInput).props.onChange("asc"));
    expect(names()).toEqual(["Lux", "Annie", "Ahri"]);
    act(() => criterion("games").props.onClick());
    act(() => renderer.root.findByType(SelectInput).props.onChange("desc"));
    expect(names()).toEqual(["Lux", "Ahri", "Annie"]);
    expect(JSON.stringify(renderer.toJSON())).toContain("4 victoires · 0 défaite");
  });

  it("preserves both alphabetical directions and can select numerical criteria again", () => {
    const renderer = render(<ProfileChampionsView championStats={sample} />);
    const nameSort = () => renderer.root.findAllByType(SortButton).find((node) => node.props.label === "Nom du champion");
    const names = () => renderer.root.findAllByProps({ className: "profile-champion-row" }).map((row) => row.props["data-champion"]);
    act(() => nameSort().props.onClick());
    expect(nameSort().props).toMatchObject({ active: true, direction: "ascending" });
    expect(names()).toEqual(["Ahri", "Annie", "Lux"]);
    act(() => nameSort().props.onClick());
    expect(nameSort().props).toMatchObject({ active: true, direction: "descending" });
    expect(names()).toEqual(["Lux", "Annie", "Ahri"]);
    act(() => renderer.root.findByProps({ "data-champion-sort": "kda" }).props.onClick());
    expect(nameSort().props.active).toBe(false);
    expect(renderer.root.findByProps({ "data-champion-sort": "kda" }).props["aria-pressed"]).toBe(true);
    act(() => renderer.root.findByProps({ "data-champion-sort": "kda" }).props.onClick());
    expect(nameSort().props.active).toBe(true);
  });

  it("shows wins and losses even for small samples and all unknown results", () => {
    const renderer = render(<ProfileChampionsView championStats={sample} />);
    expect(JSON.stringify(renderer.toJSON())).toContain("1 victoire · 0 défaite");
    expect(JSON.stringify(renderer.toJSON())).toContain("0 victoire · 0 défaite");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Peu de parties");
  });

  it("keeps unknown results and missing KDA or averages unavailable", () => {
    const unknown = { champion: "Ahri", games: 1, rows: [{ champion: "Ahri", role: "MID", match: { id: "unknown", participants: [] } }] };
    const renderer = render(<ChampionProfileDetail stat={unknown} rows={unknown.rows} />);
    const metrics = renderer.root.findAllByType(ChampionVisualMetric);
    expect(metrics.find((metric) => metric.props.label === "Taux de victoire").props.value).toBe("—");
    expect(metrics.find((metric) => metric.props.label === "Ratio KDA").props.value).toBe("—");
    expect(metrics.find((metric) => metric.props.label === "Participation aux kills").props.value).toBe("—");
    expect(metrics.find((metric) => metric.props.label === "Sbires par minute").props.value).toBe("—");
    expect(metrics.find((metric) => metric.props.label === "Dégâts moyens aux champions").props).toMatchObject({ value: "—", detail: "0/1 parties renseignées" });
  });

  it("averages champion damage from available imported fields and includes observed zero", () => {
    const damageRows = [
      { damage: 12000, raw: { totalDamageDealtToChampions: 99999 } },
      { totalDamageDealtToChampions: "18000" },
      { damage: null, raw: { totalDamageDealtToChampions: 24000 } },
      { raw: { stats: { totalDamageDealtToChampions: 30000 } } },
      { damage: 0, raw: { totalDamageDealtToChampions: 99999 } },
      { damage: null }, {}, { damage: "" }, { damage: "unavailable" }, { damage: Infinity },
    ].map((row, index) => ({ champion: "Sivir", role: "ADC", match: { id: `damage-${index}`, participants: [] }, ...row }));
    const renderer = render(<ChampionProfileDetail stat={{ champion: "Sivir" }} rows={damageRows} />);
    const metric = renderer.root.findAllByType(ChampionVisualMetric).find((item) => item.props.label === "Dégâts moyens aux champions");
    expect(metric.props).toMatchObject({ value: (16800).toLocaleString("fr-FR"), detail: "5/10 parties renseignées" });

    act(() => renderer.update(<ChampionProfileDetail stat={{ champion: "Sivir" }} rows={[damageRows[4]]} />));
    expect(renderer.root.findAllByType(ChampionVisualMetric).find((item) => item.props.label === "Dégâts moyens aux champions").props).toMatchObject({ value: "0", detail: "1/1 parties renseignées" });
  });

  it("recalculates champion damage for the selected category, champion and player", () => {
    vi.stubGlobal("window", { location: new URL("https://nxt5.test/mon-profil/champions?player=p1") });
    const players = [
      { id: "p1", team_id: "t1", name: "Nova", role: "ADC" },
      { id: "p2", team_id: "t1", name: "Lumen", role: "SUP" },
    ];
    const match = (id, category, damage, teammateDamage, champion = "Sivir", teamId = "t1") => ({
      id, team_id: teamId, result: "Victoire", ...category,
      participants: [
        { player_id: "p1", team_key: "ALLY", role: "ADC", champion, damage },
        { player_id: "p2", team_key: "ALLY", role: "SUP", champion: "Sivir", damage: teammateDamage },
        { player_id: "p1", team_key: "ENEMY", role: "ADC", champion: "Sivir", damage: 999999 },
      ],
    });
    const data = {
      players, teams: [{ id: "t1" }],
      matchCategories: [{ id: "scrim", team_id: "t1", name: "Scrim" }, { id: "ranked", team_id: "t1", name: "Classée" }],
      matches: [
        match("shared", { category_ids: ["scrim", "ranked"] }, 20000, 4000),
        match("legacy", { category_id: "scrim" }, 10000, 8000),
        match("ranked", { category_ids: ["ranked"] }, 60000, 12000),
        match("other-champion", { category_id: "scrim" }, 90000, 6000, "Ahri"),
        match("other-team", { category_id: "scrim" }, 999999, 999999, "Sivir", "t2"),
      ],
    };
    const renderer = render(<PlayerUltimateProfile data={data} selectedTeamId="t1" user={{ id: "reader" }} route={{ path: "/mon-profil/champions", search: "?player=p1" }} navigate={vi.fn()} />);
    const openChampion = (champion) => act(() => renderer.root.findByProps({ "data-champion": champion }).props.onClick());
    const damageMetric = () => renderer.root.findAllByType(ChampionVisualMetric).find((metric) => metric.props.label === "Dégâts moyens aux champions").props;
    const select = (label, value) => act(() => renderer.root.findAllByType(SelectInput).find((input) => input.props.label === label).props.onChange(value));

    openChampion("Sivir");
    expect(damageMetric()).toMatchObject({ value: (30000).toLocaleString("fr-FR"), detail: "3/3 parties renseignées" });
    select("Catégorie", "scrim");
    openChampion("Sivir");
    expect(damageMetric()).toMatchObject({ value: (15000).toLocaleString("fr-FR"), detail: "2/2 parties renseignées" });
    act(() => renderer.root.findAllByType(Button).find((button) => button.props.className === "profile-champions-back").props.onClick());
    openChampion("Ahri");
    expect(damageMetric()).toMatchObject({ value: (90000).toLocaleString("fr-FR"), detail: "1/1 parties renseignées" });
    select("Joueur", "p2");
    openChampion("Sivir");
    expect(damageMetric()).toMatchObject({ value: (6000).toLocaleString("fr-FR"), detail: "3/3 parties renseignées" });
  });
});
