import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminTabNav from "../components/admin/AdminTabNav.jsx";

const renderers = [];
afterEach(() => { renderers.splice(0).forEach((renderer) => act(() => renderer.unmount())); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function render(props = {}, options) {
  const navigate = vi.fn();
  const settings = { activeId: "admin", navigate, ...props };
  let renderer;
  act(() => { renderer = TestRenderer.create(<AdminTabNav {...settings} />, options); });
  renderers.push(renderer);
  return { renderer, navigate, settings };
}
const tabs = (renderer) => renderer.root.findByProps({ "aria-label": "Sections de l’administration" }).findAllByType("a");
const content = (node) => typeof node === "string" ? node : (node.children || []).map(content).join("");
const button = (renderer, label) => renderer.root.findAllByType("button").find((item) => content(item) === label);
function choose(renderer, index, modifiers = {}) { const event = { button: 0, preventDefault: vi.fn(), ...modifiers }; act(() => tabs(renderer)[index].props.onClick(event)); return event; }
function click(renderer, label) {
  const target = button(renderer, label);
  expect(target, `Button ${label}`).toBeTruthy();
  expect(target.props.disabled).not.toBe(true);
  act(() => target.props.onClick());
}

function keyboardFixture(props = {}) {
  const list = { scrollLeft: 0, getBoundingClientRect: () => ({ left: 100, right: 500 }) };
  const tabNodes = Array.from({ length: 4 }, (_, index) => ({
    focus: vi.fn(), getAttribute: (name) => name === "role" ? "tab" : null,
    closest: () => list, getBoundingClientRect: () => ({ left: 100 + index * 180, right: 280 + index * 180 }),
  }));
  const activeIndex = ["admin", "account-subscriptions", "access-requests", "pricing"].indexOf(props.activeId || "admin");
  const rootNode = { querySelector: () => tabNodes[activeIndex], querySelectorAll: () => tabNodes };
  const confirmationNode = { focus: vi.fn() };
  const result = render(props, { createNodeMock: (element) => element.props.className === "mb-5 min-w-0" ? rootNode : element.props.role === "alert" ? confirmationNode : null });
  return { ...result, tabNodes, list, confirmationNode };
}

describe("administrator route links", () => {
  it.each([
    ["pricing", 0, "/admin"],
    ["admin", 1, "/admin/abonnements"],
    ["admin", 2, "/admin/demandes-acces"],
    ["admin", 3, "/tarifs"],
  ])("navigates from %s through tab %i to %s", (activeId, index, path) => {
    const { renderer, navigate } = render({ activeId });
    expect(tabs(renderer)).toHaveLength(4);
    expect(tabs(renderer).filter((tab) => tab.props["aria-current"])).toHaveLength(1);
    choose(renderer, index);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(path);
  });

  it.each([["admin", 0], ["account-subscriptions", 1], ["access-requests", 2], ["pricing", 3]])("keeps the active %s route and its query intact", (activeId, index) => {
    const { renderer, navigate } = render({ activeId, dirty: true });
    expect(tabs(renderer)[index].props["aria-current"]).toBe("page");
    choose(renderer, index);
    expect(navigate).not.toHaveBeenCalled();
    expect(content(renderer.root)).not.toContain("Modifications non enregistrées");
  });

  it("blocks tab changes during a mutation even when a callback is invoked", () => {
    const { renderer, navigate } = render({ disabled: true, dirty: true });
    expect(tabs(renderer).every(link => link.props["aria-disabled"] === true)).toBe(true);
    choose(renderer, 3);
    expect(navigate).not.toHaveBeenCalled();
    expect(content(renderer.root)).not.toContain("Modifications non enregistrées");
  });

  it("keeps a dirty form until leaving is explicitly confirmed", () => {
    const { renderer, navigate } = render({ activeId: "account-subscriptions", dirty: true });
    choose(renderer, 3);
    expect(content(renderer.root)).toContain("Modifications non enregistrées");
    expect(navigate).not.toHaveBeenCalled();
    click(renderer, "Rester sur cet onglet");
    expect(content(renderer.root)).not.toContain("Modifications non enregistrées");
    expect(navigate).not.toHaveBeenCalled();
    choose(renderer, 2);
    click(renderer, "Quitter sans enregistrer");
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/admin/demandes-acces");
  });

  it("blocks an already opened leave confirmation if a mutation starts", () => {
    const { renderer, navigate, settings } = render({ dirty: true });
    choose(renderer, 3);
    act(() => renderer.update(<AdminTabNav {...settings} disabled />));
    const leave = button(renderer, "Quitter sans enregistrer");
    if (leave) {
      expect(leave.props.disabled).toBe(true);
      act(() => leave.props.onClick());
    }
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears a pending departure when the current route changes", () => {
    const { renderer, navigate, settings } = render({ dirty: true });
    choose(renderer, 3);
    act(() => renderer.update(<AdminTabNav {...settings} activeId="access-requests" />));
    expect(content(renderer.root)).not.toContain("Modifications non enregistrées");
    expect(tabs(renderer)[2].props["aria-current"]).toBe("page");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears the departure warning after the form is saved or its changes are cancelled", () => {
    const { renderer, navigate, settings } = render({ dirty: true });
    choose(renderer, 3);
    expect(content(renderer.root)).toContain("Modifications non enregistrées");
    act(() => renderer.update(<AdminTabNav {...settings} dirty={false} />));
    expect(content(renderer.root)).not.toContain("Modifications non enregistrées");
    expect(button(renderer, "Quitter sans enregistrer")).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
    choose(renderer, 2);
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/admin/demandes-acces");
  });

  it("uses real links with native keyboard behavior and reveals the current route", () => {
    const { renderer, navigate, list } = keyboardFixture({ activeId: "pricing" });
    expect(tabs(renderer).map(link => link.props.href)).toEqual(["/admin", "/admin/abonnements", "/admin/demandes-acces", "/tarifs"]);
    expect(renderer.root.findAllByProps({ role: "tablist" })).toHaveLength(0);
    expect(renderer.root.findAll(node => typeof node.props.onKeyDown === "function")).toHaveLength(0);
    expect(tabs(renderer).every(link => link.props.tabIndex === undefined)).toBe(true);
    expect(list.scrollLeft).toBeGreaterThan(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])("preserves native modified link activation %j without discarding the current form", modifiers => {
    const { renderer, navigate } = render({ dirty: true });
    const event = choose(renderer, 3, modifiers);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(content(renderer.root)).not.toContain("Modifications non enregistrées");
  });

  it("blocks modified activation while saving", () => {
    const { renderer, navigate } = render({ disabled: true });
    const event = choose(renderer, 3, { ctrlKey: true });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("focuses the leave warning and restores focus to the active tab when staying", () => {
    const { renderer, navigate, confirmationNode, tabNodes } = keyboardFixture({ activeId: "account-subscriptions", dirty: true });
    choose(renderer, 3);
    expect(confirmationNode.focus).toHaveBeenCalledTimes(1);
    click(renderer, "Rester sur cet onglet");
    expect(tabNodes[1].focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(navigate).not.toHaveBeenCalled();
  });
});
