import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import DebriefAnalysis from "../components/games/DebriefAnalysis.jsx";
import { setLanguage } from "../i18n/locale.js";
import "./helpers/i18n.js";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const renderers = [];
afterEach(() => {
  renderers.splice(0).forEach((renderer) => act(() => renderer.unmount()));
  act(() => setLanguage("fr", { persist: false }));
});
const text = (node) => typeof node === "string" ? node : (node.children || []).map(text).join("");
const visibleText = (node) => typeof node === "string" ? node : node.props.className === "sr-only" ? "" : (node.children || []).map(visibleText).join("");
function snapshot() {
  return {
    entityId: "game-a",
    participants: ["ALLY", "ENEMY"].flatMap((teamKey, teamIndex) => roles.map((role, index) => ({
      teamKey, role, participantId: teamIndex * 5 + index + 1,
      champion: teamKey === "ALLY" ? ["Ahri", "Vi", "AurelionSol", "MissFortune", "Renata"][index] : "Jinx",
      gold: 10000 + (teamKey === "ALLY" ? [2000, -1000, 0, 500, 0][index] : 0),
      damage: 10000 + (teamKey === "ALLY" ? [10000, 20000, 0, -5000, 500][index] : 0), vision: 0,
    }))),
    coach: { summary: "Texte automatique à ne pas afficher." },
  };
}
function render(value = snapshot()) {
  let renderer;
  act(() => { renderer = TestRenderer.create(<DebriefAnalysis snapshot={value} />); });
  renderers.push(renderer);
  return renderer;
}
const row = (renderer, role) => renderer.root.findByProps({ "data-role": role });
const comparison = (renderer, role) => row(renderer, role).findByProps({ className: "da-comparison" });
const value = (renderer, role, type) => visibleText(row(renderer, role).findByProps({ "data-value": type }));
const choose = (renderer, title) => act(() => renderer.root.findAllByType("button").find((button) => button.props["aria-label"] === title).props.onClick());

describe("debrief role differences", () => {
  it("starts in a closed native disclosure with five role pairs and named metric controls", () => {
    const renderer = render();
    const details = renderer.root.findByType("details");
    expect(details.props.open).not.toBe(true);
    expect(text(details.findByType("summary"))).toBe("Les écarts par poste");
    expect(renderer.root.findAllByProps({ className: "da-row" }).map((item) => item.props["data-role"])).toEqual(roles);
    expect(renderer.root.findAllByType("button").map((button) => [button.props["aria-label"], button.props["aria-pressed"]])).toEqual([["Or final", true], ["Dégâts aux champions", false], ["Score de vision", false]]);
    expect(text(renderer.root)).not.toContain("Texte automatique");
    expect(text(renderer.root)).not.toMatch(/vidéo|\bvod\b|replay/i);
  });

  it("shows both recorded values and signed gaps at one common scale for all five roles", () => {
    const renderer = render();
    expect(value(renderer, "TOP", "ally")).toBe((12000).toLocaleString("fr-FR"));
    expect(value(renderer, "TOP", "enemy")).toBe((10000).toLocaleString("fr-FR"));
    expect(value(renderer, "TOP", "difference")).toBe(`+${(2000).toLocaleString("fr-FR")}`);
    expect(comparison(renderer, "TOP").props["data-tone"]).toBe("positive");
    expect(row(renderer, "TOP").findByProps({ className: "da-fill" }).props.style).toEqual({ width: "50%", left: "0%" });
    expect(row(renderer, "JGL").findByProps({ className: "da-fill" }).props.style).toEqual({ width: "25%", left: "50%" });
    expect(value(renderer, "JGL", "difference")).toBe(`−${(1000).toLocaleString("fr-FR")}`);
    expect(row(renderer, "ADC").findByProps({ className: "da-fill" }).props.style).toEqual({ width: "12.5%", left: "37.5%" });
    expect(comparison(renderer, "MID").props["data-tone"]).toBe("equal");
    expect(value(renderer, "MID", "difference")).toBe("0");
  });

  it("switches the statistic and its common scale without creating nested views", () => {
    const renderer = render();
    choose(renderer, "Dégâts aux champions");
    expect(comparison(renderer, "TOP").props["data-metric"]).toBe("damage");
    expect(row(renderer, "TOP").findByProps({ className: "da-fill" }).props.style.width).toBe("25%");
    expect(row(renderer, "JGL").findByProps({ className: "da-fill" }).props.style.width).toBe("50%");
    expect(comparison(renderer, "ADC").props["data-tone"]).toBe("negative");
    expect(renderer.root.findAllByType("details")).toHaveLength(1);
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    choose(renderer, "Score de vision");
    for (const role of roles) {
      expect(value(renderer, role, "ally")).toBe("0");
      expect(value(renderer, role, "enemy")).toBe("0");
      expect(value(renderer, role, "difference")).toBe("0");
      expect(row(renderer, role).findByProps({ className: "da-fill" }).props.style.width).toBe("0%");
      expect(comparison(renderer, role).props["data-tone"]).toBe("equal");
    }
    expect(renderer.root.findAllByProps({ className: "da-missing" })).toHaveLength(0);
  });

  it.each([null, undefined, -1, Infinity, NaN, true, "2000"])("leaves invalid measures unavailable while preserving the other side (%s)", (invalid) => {
    const data = snapshot();
    data.participants[0].gold = invalid;
    const renderer = render(data);
    expect(value(renderer, "TOP", "ally")).toBe("—");
    expect(value(renderer, "TOP", "enemy")).toBe((10000).toLocaleString("fr-FR"));
    expect(value(renderer, "TOP", "difference")).toBe("—");
    expect(comparison(renderer, "TOP").props["data-tone"]).toBe("missing");
    expect(row(renderer, "TOP").findByProps({ className: "da-fill" }).props.style.width).toBe("0%");
    expect(text(renderer.root.findByProps({ className: "da-missing" }))).toBe("— : donnée absente ou rôle non confirmé");
  });

  it("does not invent role assignments when a role or participant identity is ambiguous", () => {
    const data = snapshot();
    data.participants[0].role = "MID";
    data.participants[1].participantId = data.participants[6].participantId;
    const renderer = render(data);
    for (const role of ["TOP", "MID", "JGL"]) {
      expect(value(renderer, role, "ally")).toBe("—");
      expect(value(renderer, role, "difference")).toBe("—");
      expect(text(row(renderer, role))).toContain("Rôle non confirmé");
    }
    expect(value(renderer, "JGL", "enemy")).toBe("—");
    expect(comparison(renderer, "ADC").props["data-tone"]).toBe("positive");
  });

  it("keeps the selected metric and disclosure mounted when the selected game changes", () => {
    const renderer = render();
    choose(renderer, "Dégâts aux champions");
    const details = renderer.root.findByType("details");
    const next = snapshot();
    next.entityId = "game-b";
    next.participants[0].damage = 5000;
    act(() => renderer.update(<DebriefAnalysis snapshot={next} />));
    expect(renderer.root.findByType("details")).toBe(details);
    expect(comparison(renderer, "TOP").props["data-metric"]).toBe("damage");
    expect(value(renderer, "TOP", "difference")).toBe(`−${(5000).toLocaleString("fr-FR")}`);
  });

  it("keeps missing participants explicit and champion names intact", () => {
    const renderer = render();
    expect(text(row(renderer, "MID"))).toContain("Aurelion Sol");
    expect(text(row(renderer, "ADC"))).toContain("Miss Fortune");
    const data = snapshot();
    data.participants = [];
    act(() => renderer.update(<DebriefAnalysis snapshot={data} />));
    expect(renderer.root.findAllByProps({ className: "da-row" })).toHaveLength(5);
    for (const role of roles) expect(value(renderer, role, "difference")).toBe("—");
    expect(text(renderer.root)).not.toContain("Ahri");
  });

  it("formats recorded values with the active locale", () => {
    const renderer = render();
    act(() => setLanguage("en", { persist: false }));
    expect(value(renderer, "TOP", "ally")).toBe("12,000");
    expect(value(renderer, "TOP", "difference")).toBe("+2,000");
    expect(renderer.root.findAllByType("button").map((button) => button.props["aria-label"])).toEqual(["Final gold", "Champion damage", "Vision score"]);
  });
});
