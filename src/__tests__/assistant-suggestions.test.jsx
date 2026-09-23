import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssistantPanel from "../components/assistant/AssistantPanel.jsx";
import { suggestionsForRoute } from "../components/assistant/route-suggestions.js";
import { DRAFT_DETAIL_IDS, TREND_PANEL_IDS, trendsPath } from "../app/trends-navigation.js";
import { apiFetch } from "../api/client.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const routeFor = (path) => {
  const url = new URL(path, "https://nxt5.test");
  return { path: url.pathname, search: url.search };
};
const suggestionsText = (path) => suggestionsForRoute(routeFor(path)).join(" ");

describe("assistant suggestions for current workspaces", () => {
  it("distinguishes personal Discord linking, team bot setup and Google account settings", () => {
    expect(suggestionsText("/bot-discord")).toMatch(/mon compte Discord.*serveur de l'équipe.*salons/);
    expect(suggestionsText("/parametres")).toMatch(/Google.*connexions associées.*mot de passe NXT5/);
  });

  it.each(["/games", "/integration", "/statistiques"])("offers opening help only while importing from %s", (path) => {
    expect(suggestionsText(`${path}?import=1`)).toMatch(/Windows ou Mac.*ne s'ouvre pas.*postes/);
    expect(suggestionsText(path)).toMatch(/statistiques.*importer.*Discord/);
    expect(suggestionsForRoute(routeFor(`${path}?import=0`))).toEqual(suggestionsForRoute(routeFor(path)));
  });

  it.each(TREND_PANEL_IDS)("selects distinct guidance for the real %s trends route", (panel) => {
    const route = routeFor(trendsPath({ panel, category: "scrim", period: "10" }));
    const suggestions = suggestionsForRoute(route);
    expect(suggestions).toHaveLength(3);
    expect(new Set(TREND_PANEL_IDS.map((id) => suggestionsForRoute(routeFor(trendsPath({ panel: id })))[0])).size).toBe(TREND_PANEL_IDS.length);
    expect(suggestions).toEqual(suggestionsForRoute(routeFor(trendsPath({ panel }))));
  });

  it.each(DRAFT_DETAIL_IDS)("recognizes the %s draft detail page before generic trends guidance", (detail) => {
    const suggestions = suggestionsForRoute(routeFor(trendsPath({ detail, category: "scrim", period: "20" })));
    expect(suggestions).toHaveLength(3);
    expect(suggestions).not.toEqual(suggestionsForRoute(routeFor("/tendances")));
    expect(suggestions).not.toEqual(suggestionsForRoute(routeFor("/tendances?rubrique=draft")));
    expect(suggestions).not.toEqual(suggestionsForRoute(routeFor("/unknown")));
  });

  it("uses the routing fallback for invalid trend panels without claiming an unknown detail exists", () => {
    expect(suggestionsForRoute(routeFor("/tendances?rubrique=unknown"))).toEqual(suggestionsForRoute(routeFor("/tendances")));
    expect(suggestionsForRoute(routeFor("/tendances/draft/unknown"))).toEqual(suggestionsForRoute(routeFor("/unknown")));
  });

  it.each(["/mon-profil/champions", "/profil/champions/", "/mon-profil/matchups", "/profil/builds"])("follows the Champions route and aliases at %s", (path) => {
    expect(suggestionsText(path)).toMatch(/Champions.*matchup.*inventaire final.*achats/);
  });

  it("follows the historical profile path and current Suivi label", () => {
    expect(suggestionsText("/mon-profil/historique")).toMatch(/Historique.*champion et résultat/);
    expect(suggestionsText("/mon-profil/coaching")).toMatch(/objectifs et notes dans Suivi/);
    expect(suggestionsText("/mon-profil/pool")).toMatch(/Pool déclaré.*tier list/);
  });

  it("refreshes suggestions when only the current panel changes and sends the selected question", async () => {
    vi.stubGlobal("window", { setTimeout: vi.fn(), clearTimeout: vi.fn(), matchMedia: () => ({ matches: true }) });
    vi.stubGlobal("document", { activeElement: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), documentElement: { classList: { contains: () => false } } });
    apiFetch.mockResolvedValue({ answer: "Choisis les deux blocs dans Comparer." });
    const props = { open: true, onClose: vi.fn(), navigate: vi.fn(), selectedTeamId: "team-1" };
    act(() => { renderer = TestRenderer.create(<AssistantPanel {...props} route={routeFor("/tendances?rubrique=evolution")} />); });
    expect(JSON.stringify(renderer.toJSON())).toContain("Comment lire la courbe dans Évolution ?");
    act(() => { renderer.update(<AssistantPanel {...props} route={routeFor("/tendances?rubrique=comparison&contexte=private-category")} />); });
    const question = "Comment comparer le Bloc de référence au Bloc observé ?";
    const button = renderer.root.findAllByType("button").find((item) => item.findAllByType("span").some((span) => span.props.children === question));
    expect(button).toBeDefined();
    await act(async () => button.props.onClick());
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch.mock.calls[0][0]).toBe("assistant-chat");
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ message: question, route: "/tendances", selectedTeamId: "team-1" });
    expect(apiFetch.mock.calls[0][1].body).not.toContain("private-category");
    expect(JSON.stringify(renderer.toJSON())).toContain("Choisis les deux blocs dans Comparer.");
  });
});
