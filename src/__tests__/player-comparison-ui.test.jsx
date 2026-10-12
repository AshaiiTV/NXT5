import React from "react";
import "./helpers/i18n.js";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerComparison } from "../components/trends/PlayerComparison.jsx";
import { SelectInput } from "../components/ui/Core.jsx";
import { setLanguage } from "../i18n/locale.js";
import { t } from "../i18n/translate.js";

const players = [
  { id: "atlas", name: "Atlas", role: "TOP" },
  { id: "brume", name: "Brume", role: "JGL" },
  { id: "nova", name: "Nova", role: "MID" },
  { id: "echo", name: "Echo", role: "SUP" },
];
const participant = (id, stats) => ({ team_key: "ALLY", player_id: id, summoner_name: players.find((player) => player.id === id).name, ...stats });
const matches = [
  { id: "first", duration: "20:00", participants: [
    participant("atlas", { vision: 10, kills: 6, deaths: 2, assists: 4, cs: 120 }),
    participant("brume", { kills: 1, cs: 80 }),
    participant("nova", { vision: 0, kills: 0, cs: 0 }),
    participant("echo", { vision: 40, kills: 2, cs: 20 }),
  ] },
  { id: "second", duration: "40:00", participants: [
    participant("atlas", { vision: 30, kills: 2, deaths: 2, assists: 8, cs: 160 }),
    participant("nova", { vision: 0, kills: 2, cs: 120 }),
    participant("echo", { vision: 60, kills: 4, cs: 40 }),
  ] },
];

let renderer;
const text = (node) => node == null ? "" : typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.children);
const mount = (props = {}) => act(() => { renderer = TestRenderer.create(<PlayerComparison matches={matches} players={players} {...props} />); });
const control = (label) => renderer.root.findAllByType(SelectInput).find((node) => node.props.label === label);
const change = (label, value) => act(() => control(label).props.onChange(value));
const rows = () => renderer.root.findAllByProps({ className: "player-comparison-row" });
const rowName = (row) => text(row.findByProps({ className: "player-comparison-identity" }).findByType("strong"));
const row = (name) => rows().find((item) => rowName(item) === name);
const value = (name) => text(row(name).findByProps({ className: "player-comparison-value" }).findByType("strong"));
const sample = (name) => text(row(name).findByProps({ className: "player-comparison-value" }).findByType("span"));
const width = (name) => row(name).findByType("rect").props.width;
const shortcut = (label) => renderer.root.findAllByType("button").find((node) => text(node) === label);
const click = (node) => act(() => node.props.onClick());

beforeEach(() => setLanguage("fr"));
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  setLanguage("fr");
});

describe("player comparison", () => {
  it.each([
    ["vision", ["vision", "visionPerMin"]],
    ["combat", ["kills", "deaths", "assists", "kda", "kp", "damage", "damagePerMin"]],
    ["farm", ["cs", "csPerMin"]],
    ["economy", ["gold", "goldPerMin"]],
  ])("limits the metric picker, shortcuts and data table to the %s theme", (theme, metricIds) => {
    mount();
    change("Thème des statistiques", theme);
    const options = control("Statistique").findAllByType("option");
    expect(options.map((option) => option.props.value)).toEqual(metricIds);
    expect(control("Statistique").props.value).toBe(metricIds[0]);
    const labels = options.map(text);
    const metricHeaders = renderer.root.findByType("thead").findAllByType("th").slice(2);
    expect(metricHeaders.map((header) => header.children[0])).toEqual(labels);
    expect(renderer.root.findByType("tbody").findAllByType("tr").every((item) => item.findAllByType("td").length === metricIds.length + 1)).toBe(true);
    const shortcuts = renderer.root.findByProps({ className: "player-comparison-shortcuts" }).findAllByType("button");
    expect(shortcuts.length).toBeGreaterThan(0);
    expect(shortcuts.every((button) => labels.includes(text(button)))).toBe(true);
    expect(text(renderer.root.findByType("summary"))).toBe("Voir les statistiques de ce thème");
    expect(text(renderer.root.findByProps({ className: "player-comparison-sample" }))).toBe("4 joueurs · 2 parties sélectionnées");
  });

  it("keeps a compatible metric and falls back to the theme's first metric when needed", () => {
    mount();
    change("Statistique", "visionPerMin");
    change("Thème des statistiques", "vision");
    expect(control("Statistique").props.value).toBe("visionPerMin");
    change("Thème des statistiques", "combat");
    expect(control("Statistique").props.value).toBe("kills");
    change("Statistique", "assists");
    change("Thème des statistiques", "all");
    expect(control("Statistique").props.value).toBe("assists");
    expect(control("Statistique").findAllByType("option")).toHaveLength(13);
    expect(renderer.root.findByType("thead").findAllByType("th")).toHaveLength(15);
    expect(text(renderer.root.findByType("summary"))).toBe("Voir toutes les statistiques");
    change("Thème des statistiques", "combat");
    expect(control("Statistique").props.value).toBe("assists");
    change("Thème des statistiques", "farm");
    expect(control("Statistique").props.value).toBe("cs");
    change("Statistique", "csPerMin");
    expect(value("Nova")).toBe("1,50");
    change("Thème des statistiques", "all");
    expect(control("Statistique").props.value).toBe("csPerMin");
  });

  it("delegates the selected match category and reflects its parent's controlled selection", () => {
    const categories = [{ id: "scrim", name: "Entraînements" }, { id: "official", name: "Compétition" }];
    const onCategoryChange = vi.fn();
    mount({ categories, category: "scrim", onCategoryChange });
    expect(control("Catégorie").findAllByType("option").map((option) => option.props.value)).toEqual(["", "scrim", "official"]);
    expect(control("Catégorie").props.value).toBe("scrim");
    change("Thème des statistiques", "farm");
    change("Statistique", "csPerMin");
    change("Catégorie", "official");
    expect(onCategoryChange).toHaveBeenCalledExactlyOnceWith("official");
    expect(control("Catégorie").props.value).toBe("scrim");
    act(() => renderer.update(<PlayerComparison matches={[matches[1]]} players={players} categories={categories} category="official" onCategoryChange={onCategoryChange} />));
    expect(control("Catégorie").props.value).toBe("official");
    expect(control("Thème des statistiques").props.value).toBe("farm");
    expect(control("Statistique").props.value).toBe("csPerMin");
    expect(value("Nova")).toBe("3,00");
    expect(sample("Nova")).toBe("1 / 1 partie mesurée");
  });

  it("keeps the category selector usable when no player can be identified", () => {
    const onCategoryChange = vi.fn();
    mount({ matches: [], players: [], categories: [{ id: "empty", name: "Catégorie vide" }], category: "empty", onCategoryChange });
    expect(control("Catégorie").props.value).toBe("empty");
    expect(text(renderer.toJSON())).toContain("Les joueurs apparaîtront ici");
    change("Catégorie", "");
    expect(onCategoryChange).toHaveBeenCalledExactlyOnceWith("");
  });

  it("translates the active theme and category controls while preserving category names and selection", async () => {
    const categoryName = "Paramètres";
    mount({ categories: [{ id: "scrim", name: categoryName }], category: "scrim", onCategoryChange: vi.fn() });
    change("Thème des statistiques", "farm");
    change("Statistique", "csPerMin");
    for (const language of ["en", "es"]) {
      await act(async () => setLanguage(language));
      expect(t("Thème des statistiques")).not.toBe("Thème des statistiques");
      expect(text(control("Thème des statistiques").findByType("label"))).toContain(t("Thème des statistiques"));
      expect(control("Thème des statistiques").props.value).toBe("farm");
      expect(control("Statistique").props.value).toBe("csPerMin");
      expect(control("Catégorie").props.value).toBe("scrim");
      expect(text(control("Catégorie").findAllByType("option").find((option) => option.props.value === "scrim"))).toBe(categoryName);
      expect(text(renderer.root.findByType("summary"))).toBe(t("Voir les statistiques de ce thème"));
      expect(t("Voir les statistiques de ce thème")).not.toBe("Voir les statistiques de ce thème");
    }
  });

  it("starts with role order and switches between vision, kills and CS per minute", () => {
    mount();
    expect(rows().map(rowName)).toEqual(["Atlas", "Brume", "Nova", "Echo"]);
    expect(value("Atlas")).toBe("20,0");
    expect(width("Atlas")).toBe(40);
    expect(text(renderer.root.findByProps({ className: "player-comparison-note" }))).toContain("ne constituent pas un classement de performance");
    click(shortcut("Kills"));
    expect(control("Statistique").props.value).toBe("kills");
    expect(value("Atlas")).toBe("4,0");
    expect(value("Echo")).toBe("3,0");
    expect(shortcut("Kills").props["aria-pressed"]).toBe(true);
    expect(shortcut("Score de vision").props["aria-pressed"]).toBe(false);
    change("Statistique", "csPerMin");
    expect(value("Atlas")).toBe("5,00");
    expect(value("Nova")).toBe("1,50");
    expect(shortcut("CS / min").props["aria-pressed"]).toBe(true);
    expect(text(renderer.root.findByProps({ className: "player-comparison-caption" }))).toContain("CS / minPar minute");
  });

  it("sorts the selected metric in either direction with missing values always last", () => {
    mount();
    change("Ordre des joueurs", "descending");
    expect(rows().map(rowName)).toEqual(["Echo", "Atlas", "Nova", "Brume"]);
    change("Ordre des joueurs", "ascending");
    expect(rows().map(rowName)).toEqual(["Nova", "Atlas", "Echo", "Brume"]);
    change("Statistique", "csPerMin");
    expect(rows().map(rowName)).toEqual(["Echo", "Nova", "Brume", "Atlas"]);
    change("Ordre des joueurs", "roster");
    expect(rows().map(rowName)).toEqual(["Atlas", "Brume", "Nova", "Echo"]);
  });

  it("distinguishes measured zero from missing statistics without giving zero a visible bar", () => {
    mount();
    expect(value("Nova")).toBe("0,0");
    expect(width("Nova")).toBe(0);
    expect(sample("Nova")).toBe("2 / 2 parties mesurées");
    expect(value("Brume")).toBe("—");
    expect(width("Brume")).toBe(0);
    expect(sample("Brume")).toBe("0 / 1 partie mesurée");
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(0);
    change("Statistique", "gold");
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("Aucune donnée disponible pour cette statistique dans la sélection.");
    expect(rows().every((item) => item.findByType("rect").props.width === 0)).toBe(true);
  });

  it("provides all metrics and their own sample sizes in an optional accessible table", () => {
    mount();
    const details = renderer.root.findByType("details");
    expect(details.props.open).toBeFalsy();
    expect(text(details.findByType("summary"))).toBe("Voir toutes les statistiques");
    const region = details.findByProps({ role: "region" });
    expect(region.props.tabIndex).toBe(0);
    expect(region.props["aria-label"]).toBe("Tableau comparatif des joueurs");
    const columns = details.findByType("thead").findAllByType("th");
    expect(columns).toHaveLength(15);
    expect(columns.every((column) => column.props.scope === "col")).toBe(true);
    const tableRows = details.findByType("tbody").findAllByType("tr");
    expect(tableRows).toHaveLength(4);
    const cellsFor = (name) => tableRows.find((item) => text(item.findByType("th").findByType("strong")) === name).findAllByType("td");
    expect(text(cellsFor("Atlas")[0])).toBe("2");
    expect(text(cellsFor("Atlas")[1])).toBe("20,02 / 2 parties mesurées");
    expect(text(cellsFor("Atlas")[6])).toBe("5,002 / 2 parties mesurées");
    expect(text(cellsFor("Nova")[6])).toBe("—0 / 2 parties mesurées");
    expect(text(cellsFor("Atlas")[9])).toBe("5,002 / 2 parties mesurées");
    expect(tableRows.every((item) => item.findByType("th").props.scope === "row")).toBe(true);
  });

  it("recalculates the chart and sample when the selected matches change while preserving controls", () => {
    mount();
    change("Statistique", "csPerMin");
    change("Ordre des joueurs", "descending");
    act(() => renderer.update(<PlayerComparison matches={[matches[1]]} players={players} />));
    expect(control("Statistique").props.value).toBe("csPerMin");
    expect(control("Ordre des joueurs").props.value).toBe("descending");
    expect(rows().map(rowName)).toEqual(["Atlas", "Nova", "Echo", "Brume"]);
    expect(value("Atlas")).toBe("4,00");
    expect(value("Nova")).toBe("3,00");
    expect(value("Brume")).toBe("—");
    expect(sample("Atlas")).toBe("1 / 1 partie mesurée");
    expect(sample("Brume")).toBe("0 / 0 parties mesurées");
    expect(text(renderer.root.findByProps({ className: "player-comparison-sample" }))).toBe("4 joueurs · 1 partie sélectionnée");
  });

  it("explains an unidentified selection and keeps an unplayed roster visibly unmeasured", () => {
    mount({ matches: [], players: [] });
    expect(text(renderer.toJSON())).toContain("Les joueurs apparaîtront ici lorsque les participants des parties seront identifiés.");
    expect(renderer.root.findAllByType("select")).toHaveLength(0);
    act(() => renderer.update(<PlayerComparison matches={[]} players={players} />));
    expect(rows()).toHaveLength(4);
    expect(rows().every((item) => item.findByType("rect").props.width === 0)).toBe(true);
    expect(value("Atlas")).toBe("—");
    expect(sample("Atlas")).toBe("0 / 0 parties mesurées");
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(1);
  });

  it("updates translated labels and number formatting without losing the metric or player names", async () => {
    mount();
    change("Statistique", "csPerMin");
    for (const [language, formatted] of [["en", "1.50"], ["es", "1,50"]]) {
      await act(async () => setLanguage(language));
      expect(t("Comparer les joueurs")).not.toBe("Comparer les joueurs");
      expect(text(renderer.root.findByType("h3"))).toBe(t("Comparer les joueurs"));
      expect(text(renderer.root.findByType("summary"))).toBe(t("Voir toutes les statistiques"));
      expect(control("Statistique").props.value).toBe("csPerMin");
      expect(rows().map(rowName)).toEqual(["Atlas", "Brume", "Nova", "Echo"]);
      expect(value("Nova")).toBe(formatted);
      expect(sample("Nova")).toBe(t("{0} / {1} parties mesurées", [2, 2]));
      expect(sample("Nova")).not.toContain("parties mesurées");
    }
  });
});
