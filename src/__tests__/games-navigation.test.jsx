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
import { getOnboardingSteps } from "../utils/onboarding.js";
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

  it("opens the actual import form from guided onboarding", () => {
    const onNavigate = vi.fn();
    const steps = getOnboardingSteps({
      currentTeam: { id: "team", owner_id: "owner" }, user: { id: "owner" },
      data: { players: ["TOP", "JGL", "MID", "ADC", "SUP"].map((role) => ({ id: role, role, team_id: "team" })), matches: [], reports: [] },
    });
    let renderer;
    act(() => { renderer = TestRenderer.create(<BeginnerCompass steps={steps} onNavigate={onNavigate} onClose={vi.fn()} />); });
    const next = renderer.root.findByType(Button);
    expect(next.props.children).toBe("Importer une game");
    act(() => next.props.onClick());
    expect(onNavigate).toHaveBeenCalledWith("/games?import=1");
    act(() => renderer.unmount());
  });

  it("opens roster management from both the next action and the roster step", () => {
    const onNavigate = vi.fn(), onClose = vi.fn();
    const steps = getOnboardingSteps({ data: {}, currentTeam: { id: "team", owner_id: "owner" }, user: { id: "owner" } });
    let renderer;
    act(() => { renderer = TestRenderer.create(<BeginnerCompass steps={steps} onNavigate={onNavigate} onClose={onClose} />); });
    act(() => renderer.root.findByType(Button).props.onClick());
    const roster = renderer.root.findAllByType("button").find((node) => node.props["aria-label"]?.startsWith("Roster :"));
    act(() => roster.props.onClick());
    expect(onNavigate.mock.calls).toEqual([["/gestion-equipe?section=roster"], ["/gestion-equipe?section=roster"]]);
    const review = renderer.root.findAllByType("button").find((node) => node.props["aria-label"]?.startsWith("Review :"));
    expect(review.props.disabled).toBe(true);
    act(() => review.props.onClick());
    expect(onNavigate).toHaveBeenCalledTimes(2);
    act(() => renderer.root.findByProps({ "aria-label": "Masquer le démarrage guidé" }).props.onClick());
    expect(onClose).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });
});
