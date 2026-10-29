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

describe("private Nexus Rising shortcut", () => {
  it.each([false, undefined])("does not expose the shortcut without platform admin access (%s)", isPlatformAdmin => {
    const sidebar = renderSidebar({ isPlatformAdmin });
    expect(sidebar.findAllByProps({ "aria-label": "Nexus Rising" })).toHaveLength(0);
  });

  it.each([false, true])("opens the private prototype immediately above Administration, including collapsed menus (%s)", collapsed => {
    const sidebar = renderSidebar({ isPlatformAdmin: true, collapsed, currentTeamId: "private-team" });
    const links = sidebar.findByProps({ className: "nxt5-sidebar-footer" }).findAllByType("a");
    const index = links.findIndex(link => link.props["aria-label"] === "Nexus Rising");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(links.slice(index, index + 2).map(link => link.props["aria-label"])).toEqual(["Nexus Rising", "Administration"]);
    expect(links[index].props.href).toBe("https://nexus-rising-admin-nxt5.ashaii.chatgpt.site");
    expect(links[index].props.target).toBe("_blank");
    expect(links[index].props.rel).toBe("noopener noreferrer");
    expect(links[index].props.onClick).toBeUndefined();
    expect(links[index + 1].props.href).toBe("/admin?team=private-team");
  });
});
