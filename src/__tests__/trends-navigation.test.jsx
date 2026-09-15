import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAppPath, isKnownPath, pageFromPath } from "../app/routing.js";
import { DRAFT_DETAIL_IDS, readTrendsRoute, trendsPath } from "../app/trends-navigation.js";
import { useTrendsNavigation } from "../hooks/useTrendsNavigation.js";

let renderer;
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.unstubAllGlobals(); });

function mount(url, team = "team-1") {
  const events = new EventTarget();
  const entries = [new URL(url, "https://nxt5.test")];
  let index = 0;
  const history = {
    pushState: (_, __, path) => { entries.splice(index + 1); entries.push(new URL(path, entries[index])); index += 1; },
    replaceState: (_, __, path) => { entries[index] = new URL(path, entries[index]); },
    back: () => { index = Math.max(0, index - 1); events.dispatchEvent(new Event("popstate")); },
    forward: () => { index = Math.min(entries.length - 1, index + 1); events.dispatchEvent(new Event("popstate")); },
  };
  vi.stubGlobal("window", {
    get location() { return entries[index]; }, history,
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events),
  });
  let navigation;
  function Harness({ selectedTeam }) { navigation = useTrendsNavigation(selectedTeam); return null; }
  act(() => { renderer = TestRenderer.create(<Harness selectedTeam={team} />); });
  return {
    get nav() { return navigation; },
    history,
    switchTeam: (next) => act(() => renderer.update(<Harness selectedTeam={next} />)),
  };
}

describe("Draft detail navigation", () => {
  it("recognizes every detail as a private Trends page, including trailing slash", () => {
    for (const id of DRAFT_DETAIL_IDS) {
      for (const path of [`/tendances/draft/${id}`, `/tendances/draft/${id}/`]) {
        expect(pageFromPath(path)).toBe("trends");
        expect(isAppPath(path)).toBe(true);
        expect(isKnownPath(path)).toBe(true);
      }
    }
    expect(isKnownPath("/tendances/draft/inconnu")).toBe(false);
    expect(isAppPath("/tendances/draft/duos/autre")).toBe(false);
  });

  it("round-trips a scope containing special characters and ignores invalid periods", () => {
    const scope = { detail: "duos", panel: "draft", category: "scrims & review/équipe", period: "10" };
    const url = new URL(trendsPath(scope), "https://nxt5.test");
    expect(readTrendsRoute({ path: url.pathname, search: url.search })).toEqual(scope);
    expect(readTrendsRoute({ path: "/tendances", search: "?rubrique=inconnu&periode=-5" })).toMatchObject({ panel: "coach", period: "all" });
  });

  it("opens a direct link with its filters intact on first mount", () => {
    const app = mount("/tendances/draft/duos?contexte=scrim&periode=5");
    expect(app.nav).toMatchObject({ detail: "duos", panel: "draft", category: "scrim", period: "5" });
    expect(app.nav.detailHref("")).toBe("/tendances?rubrique=draft&contexte=scrim&periode=5");
  });

  it("restores Draft and its scope through browser back and forward", () => {
    const app = mount("/tendances");
    act(() => { app.nav.setPanel("draft"); app.nav.setCategory("scrim"); app.nav.setPeriod("10"); });
    const event = { button: 0, preventDefault: vi.fn() };
    act(() => app.nav.onNavigate(event, "duos"));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/tendances/draft/duos");
    act(() => app.history.back());
    expect(app.nav).toMatchObject({ detail: "", panel: "draft", category: "scrim", period: "10" });
    act(() => app.history.forward());
    expect(app.nav).toMatchObject({ detail: "duos", panel: "draft", category: "scrim", period: "10" });
  });

  it("keeps modified clicks native and retains the latest scope on the return link", () => {
    const app = mount("/tendances/draft/duos?periode=5");
    for (const modifiers of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      const event = { button: 0, preventDefault: vi.fn(), ...modifiers };
      act(() => app.nav.onNavigate(event));
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    act(() => { app.nav.setCategory("review"); app.nav.setPeriod("20"); });
    expect(app.nav.detailHref("")).toBe("/tendances?rubrique=draft&contexte=review&periode=20");
    act(() => app.nav.onNavigate({ button: 0, preventDefault: vi.fn() }));
    expect(app.nav).toMatchObject({ detail: "", panel: "draft", category: "review", period: "20" });
  });

  it("clears an old team's scope when switching teams without losing the detail", () => {
    const app = mount("/tendances/draft/confort?contexte=team-1-only&periode=5");
    app.switchTeam("team-2");
    expect(app.nav).toMatchObject({ detail: "confort", category: "", period: "all" });
    expect(window.location.search).toBe("");
  });

  it("preserves a direct link while the initial team finishes loading", () => {
    const app = mount("/tendances/draft/duos?contexte=scrim&periode=5", null);
    app.switchTeam("team-1");
    expect(app.nav).toMatchObject({ detail: "duos", category: "scrim", period: "5" });
  });
});
