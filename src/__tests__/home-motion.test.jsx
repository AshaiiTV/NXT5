import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeMotion from "../pages/home/HomeMotion.jsx";
import ProductStory from "../pages/home/ProductStory.jsx";
import { HomeScreen } from "../pages/public/PublicPages.jsx";

let renderer;

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

function mount(component = <ProductStory />) {
  act(() => { renderer = TestRenderer.create(component); });
  return renderer.root;
}

function content(node) {
  return typeof node === "string" ? node : node.children.map(content).join("");
}

function normalizedContent(node) {
  return content(node).replace(/\s+/g, " ").trim();
}

function changeTime(root, seconds) {
  act(() => root.findByProps({ "aria-label": "Moment de la partie" }).props.onChange({ target: { value: String(seconds) } }));
}

function click(node, overrides = {}) {
  const event = { button: 0, detail: 0, preventDefault: vi.fn(), ...overrides };
  act(() => node.props.onClick(event));
  return event;
}

function assertMoment(root, time, gold, caption) {
  const stats = root.findByProps({ id: "ps-selected-stats" });
  expect(normalizedContent(stats.findByType("strong"))).toBe(`${gold} or`);
  expect(content(stats.findByType("time"))).toBe(time);
  expect(content(stats)).toContain(caption);
  expect(root.findByProps({ "aria-label": "Moment de la partie" }).props["aria-valuetext"].replace(/\s+/g, " "))
    .toContain(`${time}, ${gold} or`);
}

describe("published immersive home", () => {
  it("renders the real homepage without browser APIs, with crawlable routes and a static glass fallback", () => {
    for (const name of ["window", "document", "matchMedia", "MutationObserver", "IntersectionObserver", "ResizeObserver"])
      vi.stubGlobal(name, undefined);

    const html = renderToStaticMarkup(<HomeScreen />);
    expect(html.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(html).toContain("Comprends tes parties.");
    expect(html).toContain("/assets/home-motion/glass-poster.webp");
    expect(html).toContain('aria-label="Moment de la partie"');
    for (const href of ["/connexion", "/creer-un-compte", "/demo", "/fonctionnalites", "/mentions-legales", "/confidentialite", "/contact"])
      expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("Maquette d’accueil");
    expect(html).not.toContain('href="https://nxt5.org/');
  });

  it("keeps gold, elapsed time and the final-result caption synchronized throughout the slider", () => {
    const root = mount();
    assertMoment(root, "21:00", "+1 300", "Écart avec l’adversaire à cet instant");

    changeTime(root, 0);
    assertMoment(root, "0:00", "0", "Écart avec l’adversaire à cet instant");
    changeTime(root, 840);
    assertMoment(root, "14:00", "−400", "Écart avec l’adversaire à cet instant");
    // 20:00 lies between the two chart samples at 19:30 and 21:00.
    changeTime(root, 1200);
    assertMoment(root, "20:00", "+900", "Écart avec l’adversaire à cet instant");
    changeTime(root, 2025);
    assertMoment(root, "33:45", "+4 000", "Écart final avec l’adversaire");
  });

  it("selects both objective timestamps and notes, then clears their selected state when the slider moves", () => {
    const root = mount();
    const dragon = root.findByProps({ "aria-label": "Dragon à 20:00" });
    const baron = root.findByProps({ "aria-label": "Baron Nashor à 28:30" });

    click(dragon);
    assertMoment(root, "20:00", "+900", "Écart avec l’adversaire à cet instant");
    expect(dragon.props["aria-pressed"]).toBe(true);
    expect(baron.props["aria-pressed"]).toBe(false);
    expect(content(root.findByProps({ id: "ps-moment-note" }))).toContain("Avions-nous préparé la vision avant le dragon ?");

    click(baron);
    assertMoment(root, "28:30", "+2 800", "Écart avec l’adversaire à cet instant");
    expect(dragon.props["aria-pressed"]).toBe(false);
    expect(baron.props["aria-pressed"]).toBe(true);
    expect(content(root.findByProps({ id: "ps-moment-note" }))).toContain("Étions-nous tous prêts à jouer le Nashor ?");
    expect(root.findByProps({ "aria-label": "Moment de la partie" }).props["aria-valuetext"]).toContain("Baron Nashor");

    changeTime(root, 1725);
    expect(dragon.props["aria-pressed"]).toBe(false);
    expect(baron.props["aria-pressed"]).toBe(false);
    expect(content(root.findByProps({ id: "ps-moment-note" }))).not.toContain("Étions-nous tous prêts à jouer le Nashor ?");
    expect(root.findByProps({ "aria-label": "Moment de la partie" }).props["aria-valuetext"]).not.toContain("Baron Nashor");
  });

  it("uses the same selected time for milestone buttons, the range and the review note", () => {
    const root = mount();
    const moments = root.findByProps({ "aria-label": "Explorer les moments de la partie" }).findAllByType("button");
    click(moments[0]);
    assertMoment(root, "12:00", "+250", "Écart avec l’adversaire à cet instant");
    expect(root.findByProps({ "aria-label": "Moment de la partie" }).props.value).toBe(720);
    expect(moments.map(node => node.props["aria-pressed"])).toEqual([true, false, false]);
    expect(content(root.findByProps({ id: "ps-moment-note" }))).toContain("Qui récupère la prochaine vague ?");
    changeTime(root, 735);
    expect(moments.map(node => node.props["aria-pressed"])).toEqual([false, false, false]);
  });

  it("updates the champion pool and staff intention for the selected draft role", () => {
    const root = mount();
    click(root.findByProps({ id: "ps-choice-draft" }));
    expect(root.findByProps({ id: "ps-chapter-panel" }).props["aria-labelledby"]).toBe("ps-choice-draft");
    expect(content(root.findByProps({ id: "ps-pool" }))).toContain("Orianna");
    const roles = root.findByProps({ "aria-label": "Choisir un rôle pour voir ses champions" }).findAllByType("button");
    click(roles[4]);
    expect(roles.map(node => node.props["aria-pressed"])).toEqual([false, false, false, false, true]);
    expect(content(root.findByProps({ id: "ps-pool" }))).toContain("Pool SUP");
    expect(content(root.findByProps({ id: "ps-pool" }))).toContain("Rakan");
    expect(content(root.findByProps({ className: "ps-draft" }))).toContain("Braum protège le carry.");
    expect(content(root.findByProps({ id: "ps-pool" }))).not.toContain("Orianna");
  });

  it("updates the schedule, session focus and agenda together", () => {
    const root = mount();
    click(root.findByProps({ id: "ps-choice-planning" }));
    const sessions = root.findByProps({ "aria-label": "Choisir une séance" }).findAllByType("button");
    click(sessions[1]);
    expect(sessions.map(node => node.props["aria-pressed"])).toEqual([false, true, false]);
    const session = content(root.findByProps({ id: "ps-session" }));
    expect(session).toContain("20:30");
    expect(session).toContain("21:15");
    expect(session).toContain("Jeudi 15 octobre");
    expect(session).toContain("Review du scrim 3");
    expect(content(root.findByProps({ className: "ps-scrim-focus" }))).toContain("Reprendre une séquence du scrim");
    expect(content(root.findByProps({ "aria-label": "Programme de la séance" }))).toContain("Retour des joueurs");
    expect(content(root.findByProps({ "aria-label": "Programme de la séance" }))).not.toContain("Bloc de scrims");
  });

  it("uses application navigation for ordinary homepage links while preserving modified browser clicks", () => {
    const navigate = vi.fn();
    const root = mount(<HomeMotion navigate={navigate} />);
    const links = root.findAllByType("a").filter(node => ["/connexion", "/creer-un-compte", "/demo"].includes(node.props.href));
    expect(links.length).toBeGreaterThanOrEqual(6);
    for (const link of links) {
      navigate.mockClear();
      const ordinary = click(link);
      expect(ordinary.preventDefault).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledWith(link.props.href);
      for (const modified of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
        navigate.mockClear();
        const event = click(link, modified);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
      }
    }
  });
});
