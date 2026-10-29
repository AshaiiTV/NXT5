import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChampionAnalysis } from "../components/trends/ChampionAnalysis.jsx";
import { SelectInput, TextInput } from "../components/ui/Core.jsx";

const ally = (champion, role, stats = {}) => ({ team_key: "ALLY", champion, role, ...stats });
const enemy = (champion, role) => ({ team_key: "ENEMY", champion, role });
const game = (id, result, participants) => ({ id, result, participants });
function activeFor(matches) {
  const matchDrafts = matches.map((match) => ({ match, rows: match.participants.filter((row) => row.team_key === "ALLY") }));
  const picks = [...new Map(matchDrafts.flatMap((entry) => entry.rows.map((row) => [`${row.champion}|${row.role}`, row]))).values()];
  return { games: matches.length, picks, matchDrafts };
}
function series(champion, role, results) {
  return results.map((result, index) => game(`${champion}-${role}-${index}`, result, [ally(champion, role)]));
}
const wins = (count) => Array(count).fill("Victoire");
function explorationGames() {
  return [
    ...series("Ahri", "MID", ["Victoire", "Défaite", "Défaite", "Défaite", "Défaite", "pending"]),
    ...series("Orianna", "MID", wins(5)),
    ...series("Diana", "JGL", wins(2)),
    ...series("Ahri", "SUP", wins(1)),
    ...series("Annie", "MID", ["pending"]),
    ...series("Jinx", "ADC", wins(1)),
    ...series("Lux", "SUP", wins(1)),
    ...series("Ornn", "TOP", wins(1)),
    ...series("Ryze", "MID", wins(1)),
    ...series("Syndra", "MID", wins(1)),
  ];
}

let renderer;
beforeEach(() => { vi.stubGlobal("requestAnimationFrame", (callback) => { callback(); return 1; }); });
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.unstubAllGlobals(); });
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const mount = (element) => { act(() => { renderer = TestRenderer.create(element); }); };
const control = (Type, label) => renderer.root.findAllByType(Type).find((node) => node.props.label === label);
const buttons = () => renderer.root.findAllByType("button");
const button = (label) => buttons().find((node) => text(node).startsWith(label));
const pickButtons = () => buttons().filter((node) => node.props.className === "champion-pick");
const pickNames = () => pickButtons().map((node) => text(node.findByType("strong")));
const dossier = () => renderer.root.findByProps({ className: "champion-dossier" });
const selectedName = () => text(dossier().findByType("h4"));
const click = (node) => act(() => node.props.onClick());
const change = (Type, label, value) => act(() => control(Type, label).props.onChange(value));

describe("champion analysis exploration", () => {
  it("opens a champion beyond the desktop page from the compact mobile selector", () => {
    mount(<ChampionAnalysis active={activeFor(explorationGames())} />);
    const selector = control(SelectInput, "Champion à examiner");
    expect(selector.findAllByType("option")).toHaveLength(10);
    change(SelectInput, "Champion à examiner", "Syndra|MID");
    expect(selectedName()).toBe("Syndra");
    expect(pickNames()).toContain("Syndra");
    expect(control(SelectInput, "Champion à examiner").props.value).toBe("Syndra|MID");
  });
  it("combines normalized search and role, then restores the full selection", () => {
    mount(<ChampionAnalysis active={activeFor(explorationGames())} />);
    expect(pickButtons()).toHaveLength(6);
    change(TextInput, "Rechercher un champion", "  ÁHRI  ");
    expect(pickNames()).toEqual(["Ahri", "Ahri"]);
    change(SelectInput, "Rôle", "MID");
    expect(pickNames()).toEqual(["Ahri"]);
    change(SelectInput, "Rôle", "TOP");
    expect(pickButtons()).toHaveLength(0);
    expect(text(renderer.toJSON())).toContain("Aucun champion ne correspond à ces filtres");
    click(button("Réinitialiser"));
    expect(control(TextInput, "Rechercher un champion").props.value).toBe("");
    expect(control(SelectInput, "Rôle").props.value).toBe("");
    expect(pickButtons()).toHaveLength(6);
    expect(text(renderer.root.findByProps({ role: "status" }))).toContain("10 champions / rôles");
  });

  it("starts with the most played champions and preserves a selection within the chosen role", () => {
    mount(<ChampionAnalysis active={activeFor(explorationGames())} />);
    expect(pickNames().slice(0, 3)).toEqual(["Ahri", "Orianna", "Diana"]);
    click(pickButtons().find((node) => text(node.findByType("strong")) === "Diana"));
    change(SelectInput, "Rôle", "JGL");
    expect(pickNames()).toEqual(["Diana"]);
    expect(selectedName()).toBe("Diana");
    expect(pickButtons().filter((node) => node.props["aria-pressed"])).toHaveLength(1);
    change(SelectInput, "Rôle", "");
    expect(pickNames()[0]).toBe("Ahri");
    expect(selectedName()).toBe("Diana");
    expect(pickButtons().find((node) => node.props["aria-pressed"]).props["aria-controls"]).toBe(dossier().findByType("h4").props.id);
    expect(control(SelectInput, "Trier les champions")).toBeUndefined();
    expect(renderer.root.findAllByProps({ "aria-label": "Options rejouées par rôle" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "aria-label": "Pistes de travail" })).toHaveLength(0);
    expect(text(renderer.toJSON())).not.toMatch(/À revoir|À rejouer|À confirmer/);
  });

  it("paginates all champions and replaces a removed selection when the active period shrinks", () => {
    const matches = explorationGames();
    mount(<ChampionAnalysis active={activeFor(matches)} />);
    expect(button("Précédents").props.disabled).toBe(true);
    click(button("Suivants"));
    expect(pickButtons()).toHaveLength(4);
    expect(button("Suivants").props.disabled).toBe(true);
    expect(text(renderer.root.findByProps({ role: "status" }))).toContain("7–10");
    click(pickButtons().find((node) => text(node.findByType("strong")) === "Syndra"));
    expect(selectedName()).toBe("Syndra");
    const narrowed = matches.filter((match) => match.id.startsWith("Orianna-"));
    act(() => renderer.update(<ChampionAnalysis active={activeFor(narrowed)} />));
    expect(pickNames()).toEqual(["Orianna"]);
    expect(selectedName()).toBe("Orianna");
    expect(renderer.root.findAllByProps({ "aria-label": "Pagination des champions" })).toHaveLength(0);
    expect(text(dossier())).not.toContain("Syndra");
  });

  it("retains the selected role and shows an empty state if the new scope has no champion there", () => {
    mount(<ChampionAnalysis active={activeFor(explorationGames())} />);
    change(SelectInput, "Rôle", "MID");
    act(() => renderer.update(<ChampionAnalysis active={activeFor(series("Ornn", "TOP", wins(1)))} />));
    const roleSelect = control(SelectInput, "Rôle").findByType("select");
    expect(roleSelect.props.value).toBe("MID");
    expect(roleSelect.findAllByType("option").map((option) => option.props.value)).toContain("MID");
    expect(pickButtons()).toHaveLength(0);
    expect(renderer.root.findAllByProps({ className: "champion-dossier" })).toHaveLength(0);
    click(button("Réinitialiser"));
    expect(selectedName()).toBe("Ornn");
  });
});

describe("champion dossier evidence", () => {
  it("opens only defeats for review and exact sources for alternatives, matchups and partners", () => {
    const results = ["Victoire", "Défaite", "Défaite", "Défaite", "Défaite", "pending"];
    const matches = results.map((result, index) => game(`ahri-${index}`, result, [
      ally("Ahri", "MID", { kills: 4, deaths: 2, assists: 6 }),
      ally(index < 3 ? "JarvanIV" : "LeeSin", "JGL"),
      enemy(index < 2 ? "Syndra" : "Orianna", "MID"),
    ]));
    const alternatives = series("Orianna", "MID", ["Victoire", "pending"]);
    const onSources = vi.fn();
    mount(<ChampionAnalysis active={activeFor([...matches, ...alternatives, ...series("Ornn", "TOP", wins(1))])} onSources={onSources} />);
    expect(selectedName()).toBe("Ahri");
    const kda = dossier().findAllByType("dt").find((node) => text(node) === "KDA").parent;
    expect(text(kda)).toContain("6 parties avec statistiques");
    click(button("Voir les 6 parties"));
    expect(onSources).toHaveBeenLastCalledWith(expect.objectContaining({ games: 6, wins: 1, losses: 4, unknown: 1, matches }), "Ahri · Mid", expect.any(String));
    click(button("Revoir les 4 défaites"));
    expect(onSources).toHaveBeenLastCalledWith(expect.objectContaining({ games: 4, wins: 0, losses: 4, unknown: 0, matches: matches.slice(1, 5) }), "Ahri · Mid", expect.any(String));
    click(button("Comparer les parties sources"));
    expect(onSources).toHaveBeenLastCalledWith(expect.objectContaining({ games: 2, wins: 1, unknown: 1, matches: alternatives }), "Autres champions · Mid", expect.any(String));
    const associations = dossier().findAllByProps({ className: "champion-associations" });
    click(associations[0].findAllByType("button").find((node) => text(node).startsWith("Syndra")));
    expect(onSources).toHaveBeenLastCalledWith(expect.objectContaining({ matches: matches.slice(0, 2) }), "Ahri face à Syndra", expect.any(String));
    click(associations[1].findAllByType("button").find((node) => text(node).startsWith("Jarvan IV")));
    expect(onSources).toHaveBeenLastCalledWith(expect.objectContaining({ matches: matches.slice(0, 3) }), "Ahri avec Jarvan IV", expect.any(String));
    expect(text(dossier())).toContain("pas une synergie démontrée");
    expect(text(dossier())).toContain("cet écart ne mesure pas l’effet du champion");
  });

  it("keeps comparison, associations and statistical help in a closed optional disclosure", () => {
    mount(<ChampionAnalysis active={activeFor(explorationGames())} onSources={vi.fn()} />);
    const deeper = dossier().findAllByType("details").find((node) => String(node.props.className || "").split(" ").includes("champion-deeper"));
    expect(deeper.type).toBe("details");
    expect(deeper.props.open).toBeFalsy();
    expect(text(deeper.findByType("summary"))).toBe("Comparer et approfondir");
    expect(deeper.findAllByProps({ className: "champion-comparison" })).toHaveLength(1);
    expect(deeper.findAllByProps({ className: "champion-associations" })).toHaveLength(2);
    expect(text(deeper)).toContain("KDA =");
    expect(dossier().findAllByType("dt").map(text)).toEqual(["Victoires", "KDA"]);
    expect(deeper.findAllByType("button").some((node) => text(node).startsWith("Voir les"))).toBe(false);
  });

  it.each([
    ["few games", ["Victoire", "Défaite", "pending"]],
    ["many games", [...wins(5), "pending"]],
  ])("keeps every source, including unknown results, with %s", (_label, results) => {
    const matches = series("Ahri", "MID", results);
    const onSources = vi.fn();
    mount(<ChampionAnalysis active={activeFor(matches)} onSources={onSources} />);
    click(button(`Voir les ${matches.length} parties`));
    expect(onSources).toHaveBeenLastCalledWith(expect.objectContaining({ games: matches.length, unknown: 1, matches }), "Ahri · Mid", expect.any(String));
    const victories = dossier().findAllByType("dt").find((node) => text(node) === "Victoires").parent;
    expect(text(victories)).toContain("1 résultat indisponible");
    expect(text(victories)).toContain(`Sur ${matches.length - 1} résultats connus`);
    const defeats = matches.filter((match) => match.result === "Défaite");
    if (defeats.length) {
      click(button(`Revoir les ${defeats.length} défaite`));
      expect(onSources).toHaveBeenLastCalledWith(expect.objectContaining({ games: defeats.length, wins: 0, losses: defeats.length, unknown: 0, matches: defeats }), "Ahri · Mid", expect.any(String));
    } else {
      expect(button("Revoir les")).toBeUndefined();
    }
  });

  it("shows absent results and statistics as missing instead of inventing performance", () => {
    mount(<ChampionAnalysis active={activeFor(series("Ahri", "MID", ["pending"]))} />);
    const metrics = dossier().findAllByType("dt");
    expect(text(metrics.find((node) => text(node) === "Victoires").parent.findByType("dd"))).toBe("—");
    expect(text(metrics.find((node) => text(node) === "KDA").parent.findByType("dd"))).toBe("—");
    expect(text(dossier())).toContain("Les résultats de ces parties ne sont pas encore renseignés");
    expect(text(dossier())).toContain("Aucun adversaire au même rôle identifiable");
    expect(button("Voir les")).toBeUndefined();
  });
});
