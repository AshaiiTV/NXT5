import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoExplorer } from "../pages/public/DemoExperience.jsx";
import { DemoMatchSummary } from "../pages/public/DemoMatchSummary.jsx";
import { DEMO_MATCHES } from "../pages/public/demo-data.js";
import { buildTrendSeries } from "../utils/trends.js";
import { apiFetch } from "../api/client.js";
import { render } from "../seo/render.jsx";
import { isAppPath, isKnownPath } from "../app/routing.js";
import { demoPath, isDemoPath, parseDemoPath } from "../app/demo-routes.js";
import { canonicalAudiencePath } from "../app/audience-paths.js";
import { getMetadata, SITE_ORIGIN } from "../seo/metadata.js";
import { loadLanguageMessages } from "../i18n/translate.js";
import { demoShellPaths, dynamicPaths, privatePaths } from "../seo/render.jsx";
import { redirectRules, robotsHeaders, sitemapXml } from "../../tools/seo-build.mjs";
import { goldAtTime, GoldTimelineChart } from "../pages/home/GoldTimelineChart.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
let renderer;
function button(label) { return renderer.root.findAllByType("button").find((node) => text(node).trim() === label); }

// In-memory browser history: the demo derives everything from the current path.
function createHistory(initial = "/demo") {
  const history = { entries: [initial], index: 0, listeners: new Set() };
  const notify = () => history.listeners.forEach((listener) => listener(history.entries[history.index]));
  history.navigate = vi.fn((path, { replace = false } = {}) => {
    if (replace) history.entries[history.index] = path;
    else { history.entries = [...history.entries.slice(0, history.index + 1), path]; history.index += 1; }
    notify();
  });
  history.back = () => { history.index -= 1; notify(); };
  history.forward = () => { history.index += 1; notify(); };
  history.current = () => history.entries[history.index];
  return history;
}
function RoutedDemo({ history }) {
  const [path, setPath] = useState(history.current());
  React.useEffect(() => { history.listeners.add(setPath); return () => history.listeners.delete(setPath); }, [history]);
  return <DemoExplorer path={path} navigate={history.navigate} />;
}
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.clearAllMocks(); });

describe("public, read-only product demonstration", () => {
  it("uses complete fictitious teams and the production metric calculations", () => {
    expect(buildTrendSeries(DEMO_MATCHES, "gold").points.map((point) => point.value)).toEqual([-3500, 1500, 4000]);
    expect(buildTrendSeries(DEMO_MATCHES, "vision").points.map((point) => point.value)).toEqual([-10, 5, 20]);
    expect(buildTrendSeries(DEMO_MATCHES, "deaths").points.map((point) => point.value)).toEqual([27, 16, 12]);
  });

  it("filters real game rows, opens their exact summary and follows the source into a review without API writes", () => {
    const history = createHistory();
    act(() => { renderer = TestRenderer.create(<RoutedDemo history={history} />); });
    expect(renderer.root.findAllByProps({ className: "ig-game" })).toHaveLength(3);
    act(() => renderer.root.findByProps({ label: "Résultat" }).props.onChange("Défaite"));
    expect(renderer.root.findAllByProps({ className: "ig-game" })).toHaveLength(1);
    act(() => renderer.root.findByProps({ "data-match-id": "demo-1" }).props.onClick());
    expect(history.current()).toBe("/demo/partie/DEMO_1");
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-1");
    expect(text(renderer.root)).toContain("-3");
    act(() => button("Lire le débrief").props.onClick());
    expect(history.current()).toBe("/demo/partie/DEMO_1/debrief");
    expect(text(renderer.root)).toContain(DEMO_MATCHES[0].demoReview.question);
    act(() => button("Revoir la partie source").props.onClick());
    expect(history.current()).toBe("/demo/partie/DEMO_1");
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-1");
    act(() => button("2. Analyses").props.onClick());
    expect(history.current()).toBe("/demo/analyses");
    act(() => renderer.root.findByProps({ label: "Mesure à suivre" }).props.onChange("deaths"));
    expect(text(renderer.root)).toContain("Morts de l’équipe");
    act(() => button("Ouvrir cette partie").props.onClick());
    expect(history.current()).toBe("/demo/partie/DEMO_3");
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-3");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("derives the section and game from the URL so Back and Forward restore each step", () => {
    const history = createHistory("/demo/partie/DEMO_2");
    act(() => { renderer = TestRenderer.create(<RoutedDemo history={history} />); });
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-2");
    expect(button("1. Parties").props["aria-pressed"]).toBe(true);
    act(() => button("3. Débrief").props.onClick());
    expect(history.current()).toBe("/demo/partie/DEMO_2/debrief");
    expect(text(renderer.root)).toContain(DEMO_MATCHES[1].demoReview.question);
    act(() => history.back());
    expect(history.current()).toBe("/demo/partie/DEMO_2");
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-2");
    act(() => button("Toutes les parties").props.onClick());
    expect(renderer.root.findAllByProps({ className: "ig-game" })).toHaveLength(3);
    act(() => history.back());
    expect(renderer.root.findByType(DemoMatchSummary).props.match.id).toBe("demo-2");
    act(() => history.forward());
    expect(history.current()).toBe("/demo");
    expect(renderer.root.findAllByType(DemoMatchSummary)).toHaveLength(0);
  });

  it.each(["/demo/partie/DEMO_9", "/demo/partie/demo-1/debrief", "/demo/partie"])("replaces the unknown demo URL %s with /demo", (path) => {
    const history = createHistory(path);
    act(() => { renderer = TestRenderer.create(<RoutedDemo history={history} />); });
    expect(history.navigate).toHaveBeenCalledWith("/demo", { replace: true });
    expect(history.entries).toEqual(["/demo"]);
    expect(renderer.root.findAllByProps({ className: "ig-game" })).toHaveLength(3);
  });

  it("maps every demo step to a stable URL", () => {
    expect(parseDemoPath("/demo/")).toEqual({ section: "parties", match: null, known: true });
    expect(parseDemoPath("/demo/analyses")).toMatchObject({ section: "analyses", known: true });
    expect(parseDemoPath("/demo/partie/DEMO_3/debrief")).toMatchObject({ section: "debrief", match: { id: "demo-3" }, known: true });
    expect(parseDemoPath("/demo/autre").known).toBe(false);
    expect(demoPath("parties", DEMO_MATCHES[0])).toBe("/demo/partie/DEMO_1");
    expect(demoPath("debrief", DEMO_MATCHES[1])).toBe("/demo/partie/DEMO_2/debrief");
    expect(demoPath("debrief")).toBe("/demo/partie/DEMO_3/debrief");
    for (const path of ["/demo/analyses", "/demo/partie/DEMO_1", "/demo/partie/DEMO_1/debrief", "/demo/partie/INCONNU"]) {
      expect(isDemoPath(path)).toBe(true);
      expect(isKnownPath(path)).toBe(true);
      expect(isAppPath(path)).toBe(false);
    }
    expect(isKnownPath("/demo/autre")).toBe(false);
  });

  it("gives each step its title and canonical URL while keeping it out of indexing and audience ids", async () => {
    await loadLanguageMessages("en");
    const game = getMetadata("/demo/partie/DEMO_1");
    expect(game).toMatchObject({ title: "Scrim 1 · Aurore — Démonstration NXT5", robots: "noindex, follow", canonical: `${SITE_ORIGIN}/demo/partie/DEMO_1`, structuredData: null });
    expect(getMetadata("/demo/partie/DEMO_1/debrief").title).toBe("Débrief du Scrim 1 · Aurore — Démonstration NXT5");
    expect(getMetadata("/demo/analyses")).toMatchObject({ title: "Analyses de la démonstration — NXT5", robots: "noindex, follow" });
    expect(getMetadata("/demo/partie/DEMO_1", { language: "en" }).title).toBe("Scrim 1 · Aurore — NXT5 demo");
    expect(getMetadata("/demo/partie/INCONNU").canonical).toBeNull();
    expect(getMetadata("/demo").robots).toContain("index, follow");
    expect(new Set(["/demo/analyses", "/demo/partie/DEMO_1", "/demo/partie/DEMO_2/debrief"].map((path) => getMetadata(path).title)).size).toBe(3);
    for (const path of ["/demo/analyses", "/demo/partie/DEMO_1", "/demo/partie/DEMO_3/debrief?utm_source=x"]) expect(canonicalAudiencePath(path)).toBe("/demo");
    expect(canonicalAudiencePath("/demo/partie/0123456789abcdef0123")).toBeNull();
    expect(sitemapXml({ noindex: false })).not.toContain("/demo/");
  });

  it("serves deep demo links through the SPA shell with a noindex header in production", () => {
    const shellPaths = [...privatePaths, ...demoShellPaths];
    const rules = redirectRules(shellPaths, dynamicPaths).split("\n");
    for (const rule of ["/demo/partie/* /app-shell.html 200", "/demo/analyses /app-shell.html 200", "/demo/partie /app-shell.html 200"]) {
      expect(rules).toContain(rule);
      expect(rules.indexOf(rule)).toBeLessThan(rules.indexOf("/* /404.html 404"));
    }
    expect(rules).not.toContain("/demo /app-shell.html 200");
    const headers = robotsHeaders({ noindex: false }, shellPaths, dynamicPaths);
    expect(headers).toContain("/demo/partie/*\n  X-Robots-Tag: noindex, follow\n");
    expect(headers).toContain("/demo/analyses\n  X-Robots-Tag: noindex, follow\n");
    expect(headers).not.toContain("/demo\n");
  });

  it("draws the gold curve with Dragon and Nashor markers that end on each final difference", () => {
    for (const match of DEMO_MATCHES) {
      const [first, last] = [match.goldTimeline[0], match.goldTimeline.at(-1)];
      expect(first).toEqual([0, 0]);
      expect(last).toEqual([match.duration_seconds, buildTrendSeries([match], "gold").points[0].value]);
      expect(match.objectives.map((item) => item.label)).toEqual(["Dragon", "Nashor"]);
      for (const item of match.objectives) expect(item.seconds % 15).toBe(0);
    }
    const history = createHistory("/demo/partie/DEMO_1");
    act(() => { renderer = TestRenderer.create(<RoutedDemo history={history} />); });
    const chart = renderer.root.findByType(GoldTimelineChart);
    expect(text(chart)).toContain("Écart d’or au fil de la partie");
    expect(text(renderer.root.findByProps({ id: "demo-selected-gold" }))).toContain("−3");
    act(() => renderer.root.findByProps({ "aria-label": "Baron Nashor à 26:00" }).props.onClick());
    expect(text(renderer.root.findByProps({ id: "demo-selected-gold" }))).toContain("Baron Nashor pris par Aurore");
    expect(text(renderer.root.findByProps({ id: "demo-selected-gold" }))).toContain(`−${Math.abs(goldAtTime(DEMO_MATCHES[0].goldTimeline, 1560)).toLocaleString("fr-FR")}`);
    expect(renderer.root.findByProps({ "aria-label": "Dragon à 20:00" }).props["aria-pressed"]).toBe(false);
    const details = renderer.root.findByType("details");
    expect(details.props.open).toBe(true);
    expect(text(details)).toContain("Statistiques et joueurs");
  });

  it("keeps the main fact, its limit and the review action ahead of optional player statistics", () => {
    const onOpenReview = vi.fn();
    act(() => { renderer = TestRenderer.create(<DemoMatchSummary match={DEMO_MATCHES[0]} onOpenReview={onOpenReview} />); });
    const detail = renderer.root.findByType("details");
    expect(detail.props.open).toBeUndefined();
    expect(text(detail)).toContain("Écart de vision");
    expect(text(detail)).toContain("Morts de l’équipe");
    expect(detail.findByProps({ "aria-label": "Les cinq joueurs fictifs" }).findAllByType("li")).toHaveLength(5);
    expect(text(detail)).not.toContain("Lire le débrief");
    expect(text(detail)).not.toContain(DEMO_MATCHES[0].demoReview.question);
    const content = text(renderer.root);
    expect(content.indexOf("Écart d’or final")).toBeLessThan(content.indexOf("La question du débrief"));
    expect(content.indexOf("Un écart final ne suffit pas")).toBeLessThan(content.indexOf("Lire le débrief"));
    expect(content.indexOf("Lire le débrief")).toBeLessThan(content.indexOf("Statistiques et joueurs"));
    act(() => button("Lire le débrief").props.onClick());
    expect(onOpenReview).toHaveBeenCalledOnce();
  });

  it.each(["/demo", "/guides/importer-premier-scrim", "/guides/preparer-debrief"])("makes %s public and available in the initial HTML", (path) => {
    expect(isKnownPath(path)).toBe(true);
    expect(isAppPath(path)).toBe(false);
    const html = render(path);
    expect(html).toContain("fictiv");
    expect(html).toContain("Accès gratuit");
    expect(html).toContain('href="/creer-un-compte"');
  });
});
