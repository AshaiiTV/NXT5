import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Planning } from "../pages/workspace/Planning.jsx";
import { createPlanningStore } from "../utils/planning-store.js";

let renderer;
let store;
let listeners;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  listeners = new Map();
  vi.stubGlobal("window", {
    innerWidth: 360,
    innerHeight: 800,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  store?.pause();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mountPlanning() {
  const save = vi.fn(async (body) => ({
    id: "saved-row", team_id: body.teamId, player_id: body.playerId,
    week_start: body.weekStart, slots: body.slots, notes: body.notes,
    updated_at: "2026-09-08T12:00:01Z",
  }));
  store = createPlanningStore({ save });
  store.resume();
  const focus = vi.fn();
  act(() => {
    renderer = TestRenderer.create(<Planning
      data={{ players: [{ id: "player", team_id: "team", user_id: "user", name: "Joueur", role: "TOP", roster_status: "MAIN" }], availability: [] }}
      selectedTeamId="team"
      user={{ id: "user" }}
      currentMember={{ role: "owner" }}
      planningStore={store}
    />, { createNodeMock: () => ({ querySelector: () => ({ focus }) }) });
  });
  const buttons = () => renderer.root.findAllByType("button");
  const cell = () => buttons().find((node) => node.props["aria-label"]?.startsWith("Lun 10:00"));
  const eventMode = () => buttons().find((node) => node.props.children?.includes?.("Ajouter une séance"));
  const trigger = { getBoundingClientRect: () => ({ left: 80, bottom: 700 }), focus: vi.fn() };
  return { save, cell, eventMode, trigger, focus, event: (x = 0, y = 0) => ({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: x, clientY: y, currentTarget: trigger }) };
}

describe("planning session controls", () => {
  it("opens a session from a regular click and saves its type without changing availability", async () => {
    const app = mountPlanning();
    act(() => app.eventMode().props.onClick());
    act(() => app.cell().props.onClick(app.event(340, 780)));
    const menu = renderer.root.findByProps({ "aria-label": "Type de séance" });
    expect(menu.props.style).toEqual({ left: 124, top: 492 });
    expect(app.focus).toHaveBeenCalledOnce();
    const scrim = menu.findAllByType("button").find((node) => node.findAllByType("span").some((span) => span.children.includes("Entraînement")));
    act(() => scrim.props.onClick());
    expect(app.cell().props["aria-label"]).toContain("Entraînement");
    expect(app.cell().props["aria-label"]).toContain("Indisponible");
    expect(app.trigger.focus).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(app.save).toHaveBeenCalledOnce();
    expect(app.save.mock.calls[0][0].slots).toMatchObject({ MON: [], _events: { "MON|10:00": { label: "Scrim", type: "scrim" } } });
  });

  it("anchors a keyboard opening to its cell and restores focus on Escape", () => {
    const app = mountPlanning();
    act(() => app.eventMode().props.onClick());
    act(() => app.cell().props.onClick(app.event()));
    expect(renderer.root.findByProps({ "aria-label": "Type de séance" }).props.style).toEqual({ left: 80, top: 492 });
    act(() => listeners.get("keydown")({ key: "Escape" }));
    expect(renderer.root.findAllByProps({ "aria-label": "Type de séance" })).toHaveLength(0);
    expect(app.trigger.focus).toHaveBeenCalledOnce();
    expect(app.save).not.toHaveBeenCalled();
  });

  it("preserves availability toggles and the context-menu shortcut", () => {
    const app = mountPlanning();
    act(() => app.cell().props.onClick(app.event()));
    expect(app.cell().props["aria-pressed"]).toBe(true);
    act(() => app.cell().props.onContextMenu(app.event(120, 300)));
    expect(renderer.root.findByProps({ "aria-label": "Type de séance" })).toBeTruthy();
    expect(app.cell().props["aria-pressed"]).toBe(true);
  });
});

it.each(["Escape", "selection"])("B13 returns focus to the weekly cell after Shift+F10 and %s", (close) => {
  const app = mountPlanning();
  const grid = renderer.root.findByProps({ "aria-label": "Disponibilités de la semaine" });
  const cell = grid.findAllByType("button").find(node => node.props["aria-label"]?.startsWith("Lun 10:00"));
  const trigger = { ...app.trigger, dataset: { position: cell.props["data-position"] } };
  const container = { focus: vi.fn(), getBoundingClientRect: () => ({ left: 0, bottom: 0 }) };
  act(() => grid.props.onKeyDown({ key: "F10", shiftKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn(), target: { closest: () => trigger }, currentTarget: container }));
  const menu = renderer.root.findByProps({ "aria-label": "Type de séance" });
  expect(menu.props.style).toEqual({ left: 80, top: 492 });
  if (close === "Escape") act(() => listeners.get("keydown")({ key: "Escape" }));
  else act(() => menu.findAllByType("button").find(node => node.findAllByType("span").some(span => span.children.includes("Entraînement"))).props.onClick());
  expect(trigger.focus).toHaveBeenCalledOnce();
  expect(container.focus).not.toHaveBeenCalled();
});

it.each([true, false])("B6 shares one staff profile across accounts (coach present: %s)", async (coachPresent) => {
  const players = [
    { id: "z", team_id: "team", user_id: "coach", role: coachPresent ? "COACH" : "ASSISTANT", name: "Coach" },
    { id: "a", team_id: "team", user_id: "assistant", role: "ASSISTANT", name: "Assistant" },
  ];
  const bodies = [];
  for (const userId of ["coach", "assistant"]) {
    const save = vi.fn(async body => { bodies.push(body); return { team_id: body.teamId, player_id: body.playerId, week_start: body.weekStart, slots: body.slots }; });
    store = createPlanningStore({ save });
    act(() => { renderer = TestRenderer.create(<Planning data={{ players, availability: [] }} selectedTeamId="team" user={{ id: userId }} currentMember={{ role: "coach" }} planningStore={store} />); });
    const cell = renderer.root.findAllByType("button").find(node => node.props["aria-label"]?.startsWith("Lun 10:00"));
    act(() => cell.props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() }));
    await act(async () => vi.advanceTimersByTimeAsync(650));
    act(() => renderer.unmount()); renderer = null; store.pause();
  }
  expect(bodies.map(body => body.playerId)).toEqual(coachPresent ? ["z", "z"] : ["a", "a"]);
  expect(bodies[0].slots).toEqual(bodies[1].slots);
});

it("N2 hides event creation for an unlinked ordinary team member", () => {
  store = createPlanningStore({ save: vi.fn() });
  act(() => { renderer = TestRenderer.create(<Planning data={{ players: [{ id: "p", team_id: "team", user_id: "other", role: "TOP", name: "Top" }], availability: [] }} selectedTeamId="team" user={{ id: "viewer" }} currentMember={{ role: "member" }} planningStore={store} />); });
  const buttons = renderer.root.findAllByType("button");
  expect(buttons.some(node => node.props.children?.includes?.("Ajouter une séance"))).toBe(false);
  expect(buttons.filter(node => node.props["aria-label"]?.startsWith("Lun 10:00")).every(node => node.props.disabled)).toBe(true);
});
