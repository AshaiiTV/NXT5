import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoExplorer } from "../pages/public/DemoExperience.jsx";
import { DemoMatchSummary } from "../pages/public/DemoMatchSummary.jsx";
import { DEMO_MATCHES } from "../pages/public/demo-data.js";
import { championPool, matchupGames, opponentChampions, playerHistory, teamRecord } from "../pages/public/demo-workspace.js";
import { apiFetch } from "../api/client.js";
import { DEMO_SECTIONS, demoPath, isDemoPath, parseDemoPath } from "../app/demo-routes.js";
import { isAppPath, isKnownPath } from "../app/routing.js";
import { canonicalAudiencePath } from "../app/audience-paths.js";
import { getMetadata } from "../seo/metadata.js";
import { demoShellPaths, dynamicPaths, privatePaths } from "../seo/render.jsx";
import { redirectRules, sitemapXml } from "../../tools/seo-build.mjs";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
let renderer;
const buttons = (label) => renderer.root.findAllByType("button").filter((node) => text(node).trim() === label);

function Routed({ initial }) {
  const [path, setPath] = useState(initial);
  return <DemoExplorer path={path} navigate={setPath} />;
}
const open = (path) => act(() => { renderer = TestRenderer.create(<Routed initial={path} />); });
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.clearAllMocks(); });

describe("public demo: examples quoted in the YouTube and Instagram posts", () => {
  it("keeps every quoted figure in the fictional data", () => {
    const [scrim1, , scrim3] = DEMO_MATCHES;
    const ally = (match, champion) => match.participants.find((row) => row.team_key === "ALLY" && row.champion === champion);
    expect(scrim3.title).toBe("Scrim 3 · Aurore");
    expect(ally(scrim3, "Lulu")).toMatchObject({ kills: 1, deaths: 3, assists: 16 });
    expect(ally(scrim1, "Jinx")).toMatchObject({ kills: 7, deaths: 5, assists: 8 });
    expect(teamRecord()).toEqual({ games: 3, wins: 2, losses: 1, rate: 67 });
    expect(opponentChampions().find((row) => row.champion === "Renekton")).toMatchObject({ games: 1, wins: 0, rate: 0 });
    expect(matchupGames("MID", "Syndra", "Ahri").map(({ match }) => match.id)).toEqual(["demo-2"]);
  });

  it("shows 67 % with its sample warning above the trends", () => {
    open("/demo/analyses");
    const content = text(renderer.root);
    expect(content).toContain("67 %");
    expect(content).toContain("2 victoires sur 3");
    expect(content.indexOf("67 %")).toBeLessThan(content.indexOf("Trajectoire"));
  });

  it("opens the Syndra–Ahri matchup notebook and its source game", () => {
    open("/demo/champions");
    const content = text(renderer.root);
    expect(content).toContain("Carnet de matchup : Syndra contre Ahri");
    expect(content).toContain("Renekton");
    expect(content).toContain("pas une conclusion");
    act(() => renderer.root.findAllByType("button").find((node) => text(node).startsWith("Partie source : Scrim 2")).props.onClick());
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-2");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("public demo: team views", () => {
  it("derives the champion pool and player history from the three games", () => {
    expect(championPool().find(({ role }) => role === "TOP").champions.map(({ champion, games, wins }) => [champion, games, wins])).toEqual([["Gnar", 2, 1], ["Ornn", 1, 1]]);
    const support = playerHistory("SUP");
    expect(support.games.map(({ row }) => row.champion)).toEqual(["Braum", "Nautilus", "Lulu"]);
    expect([support.kills, support.deaths, support.assists]).toEqual([3, 14, 48]);
  });

  it("switches players with pressed buttons and opens a game from the history", () => {
    open("/demo/joueurs");
    expect(buttons("SUP")[0].props["aria-pressed"]).toBe(true);
    expect(text(renderer.root)).toContain("Lulu contre Braum");
    act(() => buttons("ADC")[0].props.onClick());
    expect(buttons("ADC")[0].props["aria-pressed"]).toBe(true);
    expect(text(renderer.root)).toContain("Jinx contre Ezreal");
    act(() => renderer.root.findByProps({ "aria-label": "Ouvrir Scrim 1 · Aurore" }).props.onClick());
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-1");
  });

  it("lists the compositions with sides and every lane matchup of a game", () => {
    open("/demo/draft");
    const content = text(renderer.root);
    expect(content).toContain("Équipe Horizon côté bleu");
    expect(content).toContain("Équipe Horizon côté rouge");
    expect(renderer.root.findAllByProps({ className: "demo-table demo-duel-table" })).toHaveLength(3);
    open("/demo/partie/DEMO_2");
    expect(text(renderer.root.findByProps({ className: "demo-duels" }))).toContain("Ahri");
  });

  it("states availability in words, not only by colour, and links planned sessions to their source", () => {
    open("/demo/planning");
    const content = text(renderer.root);
    for (const label of ["Disponible", "À confirmer", "Absent"]) expect(content).toContain(label);
    act(() => renderer.root.findByProps({ "aria-label": "Ouvrir Scrim 3 · Aurore" }).props.onClick());
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-3");
  });

  it("names the review step Notes and marks the current step", () => {
    open("/demo/champions");
    expect(buttons("Champions")[0].props["aria-pressed"]).toBe(true);
    expect(buttons("Notes")).toHaveLength(1);
    expect(buttons("3. Débrief")).toHaveLength(0);
  });

  it("gives each view a stable, non-indexed URL served by the SPA shell", () => {
    const rules = redirectRules([...privatePaths, ...demoShellPaths], dynamicPaths).split("\n");
    for (const section of DEMO_SECTIONS) {
      const path = `/demo/${section}`;
      expect(parseDemoPath(path)).toEqual({ section, match: null, known: true });
      expect(demoPath(section)).toBe(path);
      expect(isDemoPath(path) && isKnownPath(path)).toBe(true);
      expect(isAppPath(path)).toBe(false);
      expect(getMetadata(path).robots).toBe("noindex, follow");
      expect(canonicalAudiencePath(path)).toBe("/demo");
      expect(rules).toContain(`${path} /app-shell.html 200`);
    }
    expect(new Set(DEMO_SECTIONS.map((section) => getMetadata(`/demo/${section}`).title)).size).toBe(DEMO_SECTIONS.length);
    expect(sitemapXml({ noindex: false })).not.toContain("/demo/");
  });
});
