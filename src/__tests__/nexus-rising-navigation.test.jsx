import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../components/layout/AppChrome.jsx";

vi.mock("../components/account/AccountSubscription.jsx", () => ({ default: () => null }));

let renderer;
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
});

function renderSidebar(props = {}) {
  act(() => { renderer = TestRenderer.create(<Sidebar active="home" setActive={vi.fn()} open={false} setOpen={vi.fn()} collapsed={false} setCollapsed={vi.fn()} roleLabel={value => value} {...props} />); });
  return renderer.root;
}

describe("Nexus Rising portal shortcut", () => {
  it.each(["second-team", "team & #?=private", null])("does not carry a private workspace team into the standalone portal (%s)", currentTeamId => {
    const sidebar = renderSidebar({ currentTeamId });
    const link = sidebar.findByProps({ "aria-label": "Nexus Rising" });
    const url = new URL(link.props.href, "https://nxt5.test");
    expect(url.pathname).toBe("/nexus-rising");
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(link.props.onClick).toBeUndefined();
  });
  it.each([false, undefined])("opens the public portal for regular accounts (%s)", isPlatformAdmin => {
    const sidebar = renderSidebar({ isPlatformAdmin });
    expect(sidebar.findByProps({ "aria-label": "Nexus Rising" }).props.href).toBe("/nexus-rising");
  });

  it.each([false, true])("opens the integrated portal above Administration, including collapsed menus (%s)", collapsed => {
    const sidebar = renderSidebar({ isPlatformAdmin: true, collapsed, currentTeamId: "private-team" });
    const links = sidebar.findByProps({ className: "nxt5-sidebar-footer" }).findAllByType("a");
    expect(links.slice(0, 2).map(link => link.props["aria-label"])).toEqual(["Nexus Rising", "Administration"]);
    expect(links[0].props.href).toBe("/nexus-rising");
    expect(links[0].props.target).toBeUndefined();
    expect(links[0].props.onClick).toBeUndefined();
    expect(links[1].props.href).toBe("/admin?team=private-team");
  });
});
