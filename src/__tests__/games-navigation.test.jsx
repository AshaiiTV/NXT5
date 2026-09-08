import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MORE_NAV_IDS, NAV, PRIMARY_NAV_IDS } from "../app/constants.jsx";
import {
  buildLoginRedirect,
  gameWorkspaceSectionFromPath,
  gameWorkspaceSectionLabel,
  isAppPath,
  isKnownPath,
  pageFromPath,
  pathFromPage,
  readRoute,
} from "../app/routing.js";
import { Button } from "../components/ui/Core.jsx";
import { BeginnerCompass, Sidebar } from "../components/layout/AppChrome.jsx";

afterEach(() => vi.unstubAllGlobals());

describe("unified Games navigation", () => {
  it.each(["/games", "/integration", "/statistiques"])("opens the Games workspace for %s without losing old query parameters", (path) => {
    const search = "?match=game-42&archive=block-7&category=scrim&import=1";
    vi.stubGlobal("window", { location: new URL(`https://nxt5.test${path}/${search}`) });
    expect(readRoute()).toEqual({ path, search });
    expect(pageFromPath()).toBe("matches");
    expect(gameWorkspaceSectionFromPath()).toBe("games");
    expect(isAppPath()).toBe(true);
    expect(isKnownPath()).toBe(true);
    expect(decodeURIComponent(buildLoginRedirect(path, search))).toBe(`/connexion?next=${path}${search}`);
  });

  it("keeps Review and Tendances separate while every Games navigation target is canonical", () => {
    expect(pageFromPath("/rapports")).toBe("reports");
    expect(gameWorkspaceSectionFromPath("/rapports")).toBe("review");
    expect(pageFromPath("/tendances")).toBe("trends");
    expect(pathFromPage("matches")).toBe("/games");
    expect(pathFromPage("stats")).toBe("/games");
    expect(pathFromPage("reports")).toBe("/rapports");
    expect(gameWorkspaceSectionLabel("games")).toBe("Games");
    expect(gameWorkspaceSectionLabel("review")).toBe("Review");
    const visible = NAV.filter((item) => [...PRIMARY_NAV_IDS, ...MORE_NAV_IDS].includes(item.id));
    expect(visible.filter((item) => item.label === "Games")).toHaveLength(1);
    expect(visible.some((item) => item.id === "stats")).toBe(false);
    expect(visible.some((item) => item.id === "reports")).toBe(true);
    expect(visible.some((item) => item.id === "trends")).toBe(true);
  });

  it("selects Review in the sidebar and opens Games through its sole entry", () => {
    const setActive = vi.fn();
    let renderer;
    act(() => { renderer = TestRenderer.create(<Sidebar active="reports" setActive={setActive} open={false} setOpen={vi.fn()} collapsed={false} setCollapsed={vi.fn()} roleLabel={(value) => value} />); });
    const selected = renderer.root.findAllByType("button").filter((button) => button.props["aria-current"] === "page");
    expect(selected).toHaveLength(1);
    expect(selected[0].props["aria-label"]).toBe("Review");
    act(() => renderer.root.findByProps({ "aria-label": "Games" }).props.onClick());
    expect(setActive).toHaveBeenCalledWith("matches");
    act(() => renderer.unmount());
  });

  it("uses the import entry point from guided onboarding", () => {
    const onImport = vi.fn();
    const onNavigate = vi.fn();
    let renderer;
    act(() => { renderer = TestRenderer.create(<BeginnerCompass active="matches" currentTeam={{ id: "team" }} data={{ players: Array.from({ length: 5 }, (_, id) => ({ id, team_id: "team" })), matches: [], reports: [] }} onNavigate={onNavigate} onImport={onImport} onClose={vi.fn()} />); });
    const next = renderer.root.findAllByType(Button).find((button) => button.props.children?.some?.((child) => typeof child === "string" && child.includes("Continuer")));
    act(() => next.props.onClick());
    expect(onImport).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
});
