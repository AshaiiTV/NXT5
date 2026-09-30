import React from "react";
import { readFileSync } from "node:fs";
import { getTopDialog } from "../components/ui/dialog-registry.js";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalDialog } from "../components/ui/ModalDialog.jsx";
import { TabNav } from "../components/ui/Core.jsx";
let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.unstubAllGlobals(); });

describe("shared native modal", () => {
  function setup(props = {}) {
    const listeners = new Map();
    const focus = vi.fn();
    const modal = { open: false, showModal: vi.fn(function () { this.open = true; }), close: vi.fn(function () { this.open = false; }) };
    const close = vi.fn();
    vi.stubGlobal("window", { location: { href: "https://nxt5.test/games?import=1" }, history: { state: {}, pushState: vi.fn(), replaceState: vi.fn() }, confirm: vi.fn(() => false), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) });
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } }, activeElement: { focus, isConnected: true } });
    const render = (extra) => <ModalDialog onClose={close} handleHistory {...props} {...extra}><button autoFocus>Fermer</button></ModalDialog>;
    act(() => { renderer = TestRenderer.create(render(), { createNodeMock: () => modal }); });
    return { close, listeners, focus, modal, update(extra) { act(() => renderer.update(render(extra))); } };
  }
  it("opens a real dialog, locks scrolling and returns focus after dismissal", () => {
    const app = setup();
    expect(app.modal.showModal).toHaveBeenCalledOnce();
    expect(getTopDialog()).toBe(app.modal);
    expect(document.body.style.overflow).toBe("hidden");
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    act(() => renderer.root.findByType("dialog").props.onCancel(event));
    expect(app.close).toHaveBeenCalledWith({ reason: "dismiss" });
    act(() => renderer.unmount()); renderer = null;
    expect(document.body.style.overflow).toBe("auto");
    expect(getTopDialog()).toBeNull();
    expect(app.focus).toHaveBeenCalled();
  });
  it("allows Back to close a clean dialog and only confirms a dirty dismissal", () => {
    const app = setup();
    const event = { isTrusted: true, stopImmediatePropagation: vi.fn() };
    app.listeners.get("popstate")(event);
    expect(app.close).toHaveBeenCalledWith({ reason: "history" });
    expect(window.history.replaceState).not.toHaveBeenCalled();
    app.close.mockClear();
    app.update({ dirty: true });
    app.listeners.get("popstate")(event);
    expect(app.close).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    expect(window.history.pushState).toHaveBeenCalled();
    window.confirm.mockReturnValue(true);
    app.listeners.get("popstate")(event);
    expect(app.close).toHaveBeenCalledWith({ reason: "history" });
    app.close.mockClear();
    app.update({ busy: true });
    app.listeners.get("popstate")(event);
    expect(app.close).not.toHaveBeenCalled();
  });
});

describe("shared keyboard tabs", () => {
  it("moves with arrows/Home/End, wraps and connects the active tab to its panel", () => {
    const onChange = vi.fn();
    const focus = [vi.fn(), vi.fn(), vi.fn()];
    const items = ["one", "two", "three"].map((id) => ({ id, label: id }));
    act(() => { renderer = TestRenderer.create(<TabNav items={items} activeId="one" onChange={onChange} idPrefix="example" panelId="content" />, { createNodeMock: (node) => ({ focus: focus[items.findIndex((item) => node.props.id === `example-tab-${item.id}`)] }) }); });
    const tabs = renderer.root.findAllByProps({ role: "tab" });
    expect(tabs.map((tab) => tab.props.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0].props["aria-controls"]).toBe("content");
    for (const [key, start, target] of [["ArrowRight", 0, 1], ["ArrowLeft", 0, 2], ["Home", 2, 0], ["End", 0, 2]]) {
      const event = { key, preventDefault: vi.fn() };
      act(() => tabs[start].props.onKeyDown(event));
      expect(onChange).toHaveBeenLastCalledWith(items[target].id);
      expect(focus[target]).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    }
  });
});


it("R-F2 prevents dialog styles from containing or clipping fixed toast descendants", () => {
  const css = readFileSync(new URL("../components/ui/modal-dialog.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.nxt5-native-dialog\[open\]\s*\{[^}]*animation-name: nxt5-dialog-enter;[^}]*transform: none !important;[^}]*filter: none !important;[^}]*backdrop-filter: none !important;[^}]*container-type: normal;/);
  const animation = css.match(/@keyframes nxt5-dialog-enter[^\n]+/)[0];
  expect(animation).not.toContain("transform");
});
