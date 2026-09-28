import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoExplorer } from "../pages/public/DemoExperience.jsx";
import { DemoMatchSummary } from "../pages/public/DemoMatchSummary.jsx";
import { DEMO_MATCHES } from "../pages/public/demo-data.js";
import { buildTrendSeries } from "../utils/trends.js";
import { apiFetch } from "../api/client.js";
import { render } from "../seo/render.jsx";
import { isAppPath, isKnownPath } from "../app/routing.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
let renderer;
function button(label) { return renderer.root.findAllByType("button").find((node) => text(node).trim() === label); }
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.clearAllMocks(); });

describe("public, read-only product demonstration", () => {
  it("uses complete fictitious teams and the production metric calculations", () => {
    expect(buildTrendSeries(DEMO_MATCHES, "gold").points.map((point) => point.value)).toEqual([-3500, 1500, 4000]);
    expect(buildTrendSeries(DEMO_MATCHES, "vision").points.map((point) => point.value)).toEqual([-10, 5, 20]);
    expect(buildTrendSeries(DEMO_MATCHES, "deaths").points.map((point) => point.value)).toEqual([27, 16, 12]);
  });

  it("filters real game rows, opens their exact summary and follows the source into a review without API writes", () => {
    act(() => { renderer = TestRenderer.create(<DemoExplorer />); });
    expect(renderer.root.findAllByProps({ className: "ig-game" })).toHaveLength(3);
    act(() => renderer.root.findByProps({ label: "Résultat" }).props.onChange("Défaite"));
    expect(renderer.root.findAllByProps({ className: "ig-game" })).toHaveLength(1);
    act(() => renderer.root.findByProps({ "data-match-id": "demo-1" }).props.onClick());
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-1");
    expect(text(renderer.root)).toContain("-3");
    act(() => button("Lire le débrief").props.onClick());
    expect(text(renderer.root)).toContain(DEMO_MATCHES[0].demoReview.question);
    act(() => button("Revoir la partie source").props.onClick());
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-1");
    act(() => button("2. Analyses").props.onClick());
    act(() => renderer.root.findByProps({ label: "Mesure à suivre" }).props.onChange("deaths"));
    expect(text(renderer.root)).toContain("Morts de l’équipe");
    act(() => button("Ouvrir cette partie").props.onClick());
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-3");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each(["/demo", "/guides/importer-premier-scrim", "/guides/preparer-debrief"])("makes %s public and available in the initial HTML", (path) => {
    expect(isKnownPath(path)).toBe(true);
    expect(isAppPath(path)).toBe(false);
    const html = render(path);
    expect(html).toContain("fictiv");
    expect(html).toContain("actuellement gratuit");
    expect(html).toContain('href="/creer-un-compte"');
  });
});
