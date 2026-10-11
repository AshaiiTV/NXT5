import React from "react";
import "./helpers/i18n.js";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import GuidePage, { GUIDE_SECTIONS } from "../pages/GuidePage.jsx";
import { guideSectionForRoute } from "../app/guide-navigation.js";
import { isAppPath } from "../app/routing.js";
import { messages, t } from "../i18n/translate.js";
import { setLanguage } from "../i18n/locale.js";
import { suggestionsForRoute } from "../components/assistant/AssistantPanel.jsx";

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  setLanguage("fr");
});

describe("contextual help", () => {
  it.each([
    ["/accueil", "getting-started"],
    ["/gestion-equipe?section=roster", "teams-and-roster"],
    ["/games?import=1", "imports-and-games"],
    ["/integration/", "imports-and-games"],
    ["/games?match=example", "statistics"],
    ["/statistiques", "statistics"],
    ["/rapports", "reviews"],
    ["/draft/pool", "champion-pool"],
    ["/draft/compositions", "compositions"],
    ["/compositions-types", "compositions"],
    ["/mon-profil", "player-profile"],
    ["/mon-profil/champions", "player-champions"],
    ["/profil/matchups", "player-champions"],
    ["/mon-profil/carte", "player-showcase"],
    ["/mon-profil/pool", "champion-pool"],
    ["/tendances?rubrique=draft&periode=10", "champion-analysis"],
    ["/tendances/draft/duos", "champion-analysis"],
    ["/tendances?rubrique=evolution", "trends"],
    ["/planning", "planning"],
    ["/bot-discord", "discord"],
    ["/parametres", "permissions-and-account"],
    ["/guide?section=discord", "discord"],
  ])("opens relevant, existing help from %s", (url, expected) => {
    const { pathname: path, search } = new URL(url, "https://nxt5.org");
    const id = guideSectionForRoute({ path, search });
    expect(id).toBe(expected);
    expect(GUIDE_SECTIONS.some(section => section.id === id)).toBe(true);
  });

  it("keeps every guide destination inside the supported application routes", () => {
    expect(new Set(GUIDE_SECTIONS.map(section => section.id)).size).toBe(GUIDE_SECTIONS.length);
    for (const section of GUIDE_SECTIONS) {
      const { pathname: path, search } = new URL(section.path, "https://nxt5.org");
      expect(isAppPath(path), section.id).toBe(true);
      // Troubleshooting deliberately opens account settings as its recovery destination.
      const destinationSection = section.id === "troubleshooting" ? "permissions-and-account" : section.id;
      expect(guideSectionForRoute({ path, search }), section.id).toBe(destinationSection);
    }
  });

  it("selects help on mobile and preserves the destination query when opening a feature", async () => {
    const navigate = vi.fn();
    const onOpenAssistant = vi.fn();
    await act(async () => { renderer = TestRenderer.create(<GuidePage route={{ search: "?section=champion-analysis" }} navigate={navigate} onOpenAssistant={onOpenAssistant} />); });
    const buttons = renderer.root.findAllByType("button");
    act(() => buttons.find(button => button.children.includes("Analyser les champions")).props.onClick());
    expect(navigate).toHaveBeenLastCalledWith("/tendances?rubrique=draft");
    act(() => buttons.find(button => button.children.includes("Poser une question")).props.onClick());
    expect(onOpenAssistant).toHaveBeenCalledWith("Explique-moi la section Analyser les champions du guide.");
    act(() => renderer.root.findByType("select").props.onChange({ target: { value: "discord" } }));
    expect(navigate).toHaveBeenLastCalledWith("/guide?section=discord");
  });

  it("falls back to the first section for an obsolete help bookmark", () => {
    const html = renderToStaticMarkup(<GuidePage route={{ search: "?section=obsolete" }} />);
    expect(html).toContain("Ton prochain pas est dans Accueil");
  });
});

describe("translated guide data", () => {
  it.each(["en", "es"])("covers every section and renders its selected content in %s", language => {
    setLanguage(language);
    for (const section of GUIDE_SECTIONS) {
      for (const text of [section.label, section.title, section.intro, section.action, ...section.steps]) {
        expect(Object.hasOwn(messages[language], text), `${language}: ${text}`).toBe(true);
      }
      const html = renderToStaticMarkup(<GuidePage route={{ search: `?section=${section.id}` }} />);
      const heading = renderToStaticMarkup(<h2>{t(section.title)}</h2>).slice(4, -5);
      expect(html).toContain(heading);
      expect(html).not.toContain(section.intro);
    }
  });

  it.each(["en", "es"])("translates the assistant suggestions for all guide sections in %s", language => {
    setLanguage(language);
    expect(GUIDE_SECTIONS).toHaveLength(16);
    for (const section of GUIDE_SECTIONS) {
      const suggestions = suggestionsForRoute({ path: "/guide", search: `?section=${section.id}` });
      expect(suggestions).toHaveLength(3);
      for (const suggestion of suggestions) {
        expect.soft(Object.hasOwn(messages[language], suggestion), `${language}/${section.id}: ${suggestion}`).toBe(true);
        expect.soft(t(suggestion), `${language}/${section.id}: ${suggestion}`).not.toBe(suggestion);
      }
      if (section.id !== "troubleshooting") {
        const { pathname: path, search } = new URL(section.path, "https://nxt5.org");
        expect(suggestionsForRoute({ path, search }), section.id).toEqual(suggestions);
      }
    }
    expect(suggestionsForRoute({ path: "/tendances", search: "?rubrique=draft" })).not.toEqual(suggestionsForRoute({ path: "/tendances" }));
  });
});
