import React from "react";
import "./helpers/i18n.js";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import GuidePage, { TUTORIAL_SECTION } from "../pages/GuidePage.jsx";
import TutorialPage from "../pages/guide/TutorialPage.jsx";
import { TUTORIAL_ACTS, TUTORIAL_CHAPTERS, TUTORIAL_PATHS, tutorialDataStrings } from "../pages/guide/tutorial-content.js";
import { DRAFT_SEQUENCE, GOLD_MOMENTS, TUTORIAL_MOCKS, TUTORIAL_MOCK_STRINGS, draftStepLabel, goldAt } from "../pages/guide/TutorialMocks.jsx";
import { guideSectionForRoute } from "../app/guide-navigation.js";
import { isAppPath } from "../app/routing.js";
import { messages, t } from "../i18n/translate.js";
import { setLanguage } from "../i18n/locale.js";

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  setLanguage("fr");
});

const textOf = (node) => typeof node === "string" ? node : (node.children || []).map(textOf).join("");
const byText = (root, type, text) => root.findAllByType(type).find((node) => textOf(node).includes(text));
const hasClass = (name) => (node) => typeof node.props?.className === "string" && node.props.className.split(" ").includes(name);

describe("tutorial in Help", () => {
  it("is offered at the top of the guide and in its contents", () => {
    const navigate = vi.fn();
    act(() => { renderer = TestRenderer.create(<GuidePage route={{ search: "?section=planning" }} navigate={navigate} />); });
    act(() => byText(renderer.root, "button", "Ouvrir le tutoriel").props.onClick());
    expect(navigate).toHaveBeenLastCalledWith(`/guide?section=${TUTORIAL_SECTION}`);
    act(() => byText(renderer.root, "button", "Tutoriel complet").props.onClick());
    expect(navigate).toHaveBeenLastCalledWith(`/guide?section=${TUTORIAL_SECTION}`);
    const options = renderer.root.findByType("select").findAllByType("option").map((option) => option.props.value);
    expect(options[0]).toBe(TUTORIAL_SECTION);
    // The regular help section stays selected and readable.
    expect(textOf(renderer.root.findByProps({ className: "nxt5-guide-content" }))).toContain("Organiser la prochaine séance");
  });

  it("keeps the tutorial section when Help is opened from it", () => {
    expect(guideSectionForRoute({ path: "/guide", search: `?section=${TUTORIAL_SECTION}` })).toBe(TUTORIAL_SECTION);
  });

  it("presents three acts and fifteen chapters with working destinations", () => {
    const html = renderToStaticMarkup(<TutorialPage />);
    expect(TUTORIAL_ACTS).toHaveLength(3);
    expect(TUTORIAL_CHAPTERS.map((chapter) => chapter.num)).toEqual(Array.from({ length: 15 }, (_, index) => String(index + 1).padStart(2, "0")));
    for (const chapter of TUTORIAL_CHAPTERS) {
      expect(html).toContain(`id="tuto-${chapter.id}"`);
      expect(TUTORIAL_MOCKS[chapter.mock], chapter.id).toBeTypeOf("function");
      expect(isAppPath(new URL(chapter.link.path, "https://nxt5.org").pathname), chapter.id).toBe(true);
    }
    for (const item of Object.values(TUTORIAL_PATHS).flat()) expect(TUTORIAL_CHAPTERS.some((chapter) => chapter.id === item.chapter)).toBe(true);
    // Static prerendering must not rely on inline style attributes (CSP style-src-attr 'none').
    expect(html).not.toMatch(/\sstyle="/);
  });

  it("links each step to a zone of its example screen", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      const zones = new Set(renderToStaticMarkup(React.createElement(TUTORIAL_MOCKS[chapter.mock])).match(/tuto-spot[^>]*>(\d)</g)?.map((spot) => spot.at(-2)));
      for (const step of chapter.steps.filter((item) => item.z)) expect(zones.has(step.z), `${chapter.id} step ${step.z}`).toBe(true);
    }
  });

  it("highlights a zone, follows the chosen path and remembers the checklist", () => {
    const store = new Map();
    vi.stubGlobal("window", { localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } });
    try {
      act(() => { renderer = TestRenderer.create(<TutorialPage navigate={vi.fn()} />); });
      const chapter = renderer.root.find((node) => node.props.id === "tuto-depart" && node.type === "article");
      act(() => chapter.findAll(hasClass("has-zone"))[1].props.onMouseEnter());
      const active = chapter.findAll(hasClass("tuto-z")).filter(hasClass("is-actif"));
      expect(active).toHaveLength(1);
      expect(textOf(active[0])).toContain("Ta prochaine action");

      expect(chapter.findAll(hasClass("tuto-pour-toi"))).toHaveLength(1);
      const profile = renderer.root.find((node) => node.props.id === "tuto-profil" && node.type === "article");
      expect(profile.findAll(hasClass("tuto-pour-toi"))).toHaveLength(0);
      act(() => renderer.root.find((node) => node.type === "input" && node.props.value === "joueur").props.onChange());
      expect(profile.findAll(hasClass("tuto-pour-toi"))).toHaveLength(1);
      expect(textOf(renderer.root.find(hasClass("tuto-soiree")))).toContain("Renseigner mes disponibilités");

      act(() => renderer.root.find((node) => node.type === "input" && node.props.id === "nxt5-tuto-joueur-3").props.onChange({ target: { checked: true } }));
      expect(JSON.parse(store.get("nxt5_tutorial_v1"))).toEqual({ parcours: "joueur", checks: { "joueur-3": true } });
      expect(textOf(renderer.root.find(hasClass("tuto-soiree-compte")))).toBe("1 / 4");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("replays the draft, moves along the gold curve and flips the player card", () => {
    act(() => { renderer = TestRenderer.create(<TutorialPage navigate={vi.fn()} />); });
    const status = () => textOf(renderer.root.find(hasClass("tuto-m-etape")));
    expect(status()).toContain("Draft finale");
    act(() => byText(renderer.root, "button", "Revoir depuis le début").props.onClick());
    expect(status()).toContain("Draft vide");
    act(() => byText(renderer.root, "button", "Étape suivante").props.onClick());
    expect(status()).toContain("Ban bleu 1 — Azir");
    expect(byText(renderer.root, "button", "Étape précédente").props.disabled).toBe(false);
    expect(draftStepLabel(7)).toBe("Pick bleu 1 — Vi");
    expect(draftStepLabel(DRAFT_SEQUENCE.length)).toBe("Draft finale");

    const value = () => textOf(renderer.root.find(hasClass("tuto-m-or-valeur")));
    act(() => byText(renderer.root, "button", "Premier écart").props.onClick());
    expect(value()).toContain(String(goldAt(GOLD_MOMENTS[0].s)));
    expect(byText(renderer.root, "button", "Premier écart").props["aria-pressed"]).toBe(true);
    act(() => renderer.root.find((node) => node.type === "input" && node.props.type === "range").props.onChange({ target: { value: "2025" } }));
    expect(value()).toContain("4");
    expect(textOf(renderer.root.find(hasClass("tuto-m-note")))).toContain("Qu’est-ce qu’on garde pour la suite ?");

    const flip = renderer.root.find(hasClass("tuto-retourner"));
    act(() => flip.props.onClick());
    expect(renderer.root.find(hasClass("tuto-retourner")).props["aria-pressed"]).toBe(true);
    expect(textOf(renderer.root.find(hasClass("tuto-retourner")))).toContain("Voir le recto");
    expect(renderer.root.find(hasClass("tuto-carte")).props.className).toContain("is-retournee");
  });

  it.each(["en", "es"])("is fully translated in %s", (language) => {
    setLanguage(language);
    for (const text of [...tutorialDataStrings(), ...TUTORIAL_MOCK_STRINGS]) {
      expect(Object.hasOwn(messages[language], text), `${language}: ${text}`).toBe(true);
    }
    const html = renderToStaticMarkup(<TutorialPage />);
    for (const chapter of TUTORIAL_CHAPTERS) {
      const title = renderToStaticMarkup(<b>{t(chapter.title)}</b>).slice(3, -4);
      expect(html).toContain(title);
      expect(html).not.toContain(renderToStaticMarkup(<b>{chapter.title}</b>).slice(3, -4));
    }
    expect(html).not.toContain("Choisis ton point de départ.");
  });
});
