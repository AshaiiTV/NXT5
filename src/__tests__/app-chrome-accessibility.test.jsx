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
  function setup() {
    const setActive = vi.fn(), setOpen = vi.fn();
    act(() => { renderer = TestRenderer.create(<Sidebar active="matches" setActive={setActive} open={false} setOpen={setOpen} collapsed={false} setCollapsed={vi.fn()} roleLabel={(value) => value} isPlatformAdmin />); });
    return { setActive, setOpen };
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
