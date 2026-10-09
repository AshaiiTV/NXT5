import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar, Topbar } from "../components/layout/AppChrome.jsx";

vi.mock("../components/account/AccountSubscription.jsx", () => ({ default: () => null }));

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  vi.unstubAllGlobals();
});

describe("workspace navigation links", () => {
  function setup(currentTeamId) {
    const setActive = vi.fn(), setOpen = vi.fn();
    const render = (teamId) => <Sidebar active="matches" setActive={setActive} open={false} setOpen={setOpen} collapsed={false} setCollapsed={vi.fn()} roleLabel={(value) => value} currentTeamId={teamId} isPlatformAdmin />;
    act(() => { renderer = TestRenderer.create(render(currentTeamId)); });
    return { setActive, setOpen, selectTeam(teamId) { act(() => renderer.update(render(teamId))); } };
  }
  function click(overrides = {}) {
    return { button: 0, currentTarget: { target: "", hasAttribute: () => false }, preventDefault: vi.fn(), ...overrides };
  }

  it("provides real destinations while normal clicks navigate in the app and close the mobile drawer", () => {
    const app = setup();
    const link = renderer.root.findByProps({ "aria-label": "Parties" });
    expect(link.type).toBe("a");
    expect(link.props.href).toBe("/games");
    expect(link.props["aria-current"]).toBe("page");
    expect(renderer.root.findByProps({ "aria-label": "Paramètres" }).props.href).toBe("/parametres");
    expect(renderer.root.findByProps({ "aria-label": "Administration" }).props.href).toBe("/admin");
    expect(renderer.root.findByProps({ "aria-label": "Déconnexion" }).type).toBe("button");
    const event = click();
    act(() => link.props.onClick(event));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(app.setActive).toHaveBeenCalledWith("matches");
    expect(app.setOpen).toHaveBeenCalledWith(false);
  });

  it.each([
    ["Control", { ctrlKey: true }],
    ["Command", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["middle button", { button: 1 }],
    ["already handled", { defaultPrevented: true }],
    ["new target", { currentTarget: { target: "_blank", hasAttribute: () => false } }],
    ["download", { currentTarget: { target: "", hasAttribute: (name) => name === "download" } }],
  ])("preserves browser navigation for %s clicks", (_name, overrides) => {
    const app = setup();
    for (const label of ["Parties", "Administration"]) {
      const event = click(overrides);
      act(() => renderer.root.findByProps({ "aria-label": label }).props.onClick(event));
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(app.setActive).not.toHaveBeenCalled();
    expect(app.setOpen).not.toHaveBeenCalled();
  });

  it("keeps the selected non-default team in copied links and new tabs, even when the current URL names another team", () => {
    vi.stubGlobal("window", { location: new URL("https://nxt5.test/mon-profil?team=first-team&match=old-match") });
    const app = setup("second-team");
    const expectedPaths = { Parties: "/games", Planning: "/planning", "Mon profil": "/mon-profil", "Paramètres": "/parametres", Administration: "/admin" };
    for (const [label, path] of Object.entries(expectedPaths)) {
      const link = renderer.root.findByProps({ "aria-label": label });
      expect(link.props.href).toBe(`${path}?team=second-team`);
      for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { button: 1 }]) {
        const event = click(overrides);
        act(() => link.props.onClick(event));
        expect(event.preventDefault).not.toHaveBeenCalled();
      }
    }
    expect(app.setActive).not.toHaveBeenCalled();
    expect(app.setOpen).not.toHaveBeenCalled();

    app.selectTeam("third-team");
    expect(renderer.root.findByProps({ "aria-label": "Parties" }).props.href).toBe("/games?team=third-team");
    expect(renderer.root.findByProps({ "aria-label": "Planning" }).props.href).toBe("/planning?team=third-team");
    app.selectTeam(null);
    expect(renderer.root.findByProps({ "aria-label": "Parties" }).props.href).toBe("/games");
  });

  it("encodes the team identifier without adding extra query parameters", () => {
    setup("team & #?=");
    const href = renderer.root.findByProps({ "aria-label": "Parties" }).props.href;
    const url = new URL(href, "https://nxt5.test");
    expect([...url.searchParams]).toEqual([["team", "team & #?="]]);
    expect(url.hash).toBe("");
  });
});

describe("team picker keyboard dismissal", () => {
  function setup() {
    const listeners = new Map();
    const trigger = { focus: vi.fn() }, option = {};
    const picker = { contains: (target) => target === trigger || target === option };
    vi.stubGlobal("document", { addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: (name) => listeners.delete(name) });
    act(() => { renderer = TestRenderer.create(<Topbar active="home" setOpen={vi.fn()} currentTeam={{ id: "team-a", name: "Alpha" }} teams={[{ id: "team-a", name: "Alpha" }]} onSelectTeam={vi.fn()} onCreateTeam={vi.fn()} />, {
      createNodeMock: (node) => node.props.className === "nxt5-team-trigger" ? trigger : node.props.className === "nxt5-team-picker" ? picker : null,
    }); });
    act(() => renderer.root.findByProps({ className: "nxt5-team-trigger" }).props.onClick());
    return { listeners, trigger, option, picker };
  }
  function isOpen() { return renderer.root.findByProps({ className: "nxt5-team-trigger" }).props["aria-expanded"]; }

  it("keeps the choices open when Tab moves between controls inside the picker", () => {
    const app = setup();
    act(() => renderer.root.findByProps({ className: "nxt5-team-picker" }).props.onBlur({ currentTarget: app.picker, relatedTarget: app.option }));
    expect(isOpen()).toBe(true);
  });

  it.each([{}, null])("closes after keyboard focus leaves the picker without taking focus back", (destination) => {
    const app = setup();
    act(() => renderer.root.findByProps({ className: "nxt5-team-picker" }).props.onBlur({ currentTarget: app.picker, relatedTarget: destination }));
    expect(isOpen()).toBe(false);
    expect(renderer.root.findAllByProps({ id: "nxt5-team-picker-menu" })).toHaveLength(0);
    expect(app.trigger.focus).not.toHaveBeenCalled();
    expect(app.listeners.size).toBe(0);
  });

  it("still returns focus to the trigger when Escape closes the picker", () => {
    const app = setup();
    act(() => app.listeners.get("keydown")({ key: "Escape" }));
    expect(isOpen()).toBe(false);
    expect(app.trigger.focus).toHaveBeenCalledOnce();
  });
});
