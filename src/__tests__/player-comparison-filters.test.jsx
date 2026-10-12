import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrendsPage } from "../pages/workspace/TrendsPage.jsx";
import { PlayerComparison } from "../components/trends/PlayerComparison.jsx";
import { ProgressionObjectives } from "../components/trends/ProgressionObjectives.jsx";
import { SelectInput } from "../components/ui/Core.jsx";
import { setLanguage } from "../i18n/locale.js";

const players = [
  { id: "nova", name: "Nova", role: "MID", team_id: "team" },
  { id: "mira", name: "Mira", role: "MID", team_id: "other-team" },
];
function game(id, day, category, vision, teamId = "team") {
  const player = players.find((item) => item.team_id === teamId);
  return {
    id, team_id: teamId, category_ids: [category], game_date: new Date(Date.UTC(2026, 8, day)).toISOString(),
    duration: "30:00", result: "Victoire", side: "Blue Side",
    participants: [{ team_key: "ALLY", role: "MID", player_id: player.id, summoner_name: player.name, champion: "Ahri", kills: 3, deaths: 2, assists: 7, cs: 210, vision, damage: 18000, gold: 12000 }],
  };
}
const data = {
  teams: [{ id: "team" }, { id: "other-team" }], players,
  matchCategories: [
    { id: "scrim", team_id: "team", name: "Entraînements" },
    { id: "official", team_id: "team", name: "Compétition" },
    { id: "empty", team_id: "team", name: "Catégorie vide" },
    { id: "foreign", team_id: "other-team", name: "Autre équipe" },
  ],
  matches: [
    ...Array.from({ length: 7 }, (_, i) => game(`scrim-${i + 1}`, i + 1, "scrim", i + 1)),
    ...Array.from({ length: 3 }, (_, i) => game(`official-${i + 1}`, i + 10, "official", 40 + i)),
    game("foreign-game", 20, "foreign", 90, "other-team"),
  ],
};

let renderer;
const text = (node) => node == null ? "" : typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.children);
const controls = (label) => renderer.root.findAllByType(SelectInput).filter((node) => node.props.label === label);
const change = (label, value) => act(() => controls(label)[0].props.onChange(value));
const comparison = () => renderer.root.findByType(PlayerComparison);
const comparedGames = () => comparison().props.matches.map((match) => match.id);
const clickTab = (panel) => act(() => renderer.root.findByProps({ id: `trend-tab-${panel}` }).props.onClick());

function mount(search = "?rubrique=ai-objectives&contexte=scrim&periode=5") {
  let location = new URL(`https://nxt5.test/tendances${search}`);
  const events = new EventTarget();
  const update = (_, __, path) => { location = new URL(path, location); };
  vi.stubGlobal("window", {
    get location() { return location; },
    history: { replaceState: vi.fn(update), pushState: vi.fn(update) },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events),
  });
  vi.stubGlobal("document", { getElementById: () => null });
  act(() => { renderer = TestRenderer.create(<TrendsPage data={data} selectedTeamId="team" />); });
}

beforeEach(() => setLanguage("fr"));
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllGlobals();
});

describe("player comparison filters in team analysis", () => {
  it("shares a direct link's category and latest-game period with the comparison and objectives", () => {
    mount();
    expect(controls("Catégorie")).toHaveLength(1);
    expect(comparison().findAllByType(SelectInput).find((node) => node.props.label === "Catégorie")).toBe(controls("Catégorie")[0]);
    expect(controls("Catégorie")[0].props.value).toBe("scrim");
    expect(controls("Catégorie")[0].findAllByType("option").map((option) => option.props.value)).toEqual(["", "scrim", "official", "empty"]);
    expect(comparedGames()).toEqual(["scrim-7", "scrim-6", "scrim-5", "scrim-4", "scrim-3"]);
    expect(text(comparison().findByProps({ className: "player-comparison-value" }).findByType("strong"))).toBe("5,0");
    expect(renderer.root.findByType(ProgressionObjectives).props.gamesCount).toBe(5);
    expect(text(renderer.root.findByProps({ className: "trends-scope" }))).toContain("5 parties analysées sur 7 · Entraînements");
  });

  it("updates the shared category from the chart and keeps its scope when navigating between analysis panels", () => {
    mount();
    change("Thème des statistiques", "farm");
    change("Statistique", "csPerMin");
    change("Catégorie", "official");
    expect(comparedGames()).toEqual(["official-3", "official-2", "official-1"]);
    expect(controls("Thème des statistiques")[0].props.value).toBe("farm");
    expect(controls("Statistique")[0].props.value).toBe("csPerMin");
    expect(renderer.root.findByType(ProgressionObjectives).props.gamesCount).toBe(3);
    expect(window.location.search).toContain("contexte=official");
    expect(window.location.search).toContain("periode=5");
    clickTab("coach");
    expect(controls("Catégorie")).toHaveLength(1);
    expect(controls("Catégorie")[0].props.value).toBe("official");
    expect(renderer.root.findAllByType(PlayerComparison)).toHaveLength(0);
    clickTab("ai-objectives");
    expect(controls("Catégorie")).toHaveLength(1);
    expect(comparedGames()).toEqual(["official-3", "official-2", "official-1"]);
    expect(renderer.root.findByType(ProgressionObjectives).props.gamesCount).toBe(3);
  });

  it("leaves a way to recover from an empty category and restores matching games with the same period", () => {
    mount();
    change("Catégorie", "empty");
    expect(renderer.root.findAllByType(PlayerComparison)).toHaveLength(0);
    expect(renderer.root.findAllByType(ProgressionObjectives)).toHaveLength(0);
    expect(text(renderer.toJSON())).toContain("Aucune partie dans cette sélection");
    expect(controls("Catégorie")).toHaveLength(1);
    expect(controls("Catégorie")[0].props.value).toBe("empty");
    change("Catégorie", "scrim");
    expect(comparedGames()).toEqual(["scrim-7", "scrim-6", "scrim-5", "scrim-4", "scrim-3"]);
    expect(renderer.root.findByType(ProgressionObjectives).props.gamesCount).toBe(5);
    expect(window.location.search).toContain("periode=5");
  });

  it("clears the previous team's scope and theme before showing the next team's players and categories", () => {
    mount();
    change("Thème des statistiques", "combat");
    act(() => renderer.update(<TrendsPage data={data} selectedTeamId="other-team" />));
    expect(controls("Catégorie")[0].props.value).toBe("");
    expect(controls("Catégorie")[0].findAllByType("option").map((option) => option.props.value)).toEqual(["", "foreign"]);
    expect(controls("Thème des statistiques")[0].props.value).toBe("all");
    expect(comparedGames()).toEqual(["foreign-game"]);
    expect(text(comparison().findByProps({ className: "player-comparison-identity" }).findByType("strong"))).toBe("Mira");
    expect(text(comparison())).not.toContain("Nova");
    expect(renderer.root.findByType(ProgressionObjectives).props.gamesCount).toBe(1);
    expect(window.location.search).not.toContain("contexte=");
    expect(window.location.search).not.toContain("periode=");
  });
});
