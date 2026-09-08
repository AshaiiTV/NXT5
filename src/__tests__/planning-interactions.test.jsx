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
  const eventMode = () => buttons().find((node) => node.props.children?.includes?.("Modifier les événements"));
  const trigger = { getBoundingClientRect: () => ({ left: 80, bottom: 700 }), focus: vi.fn() };
  return { save, cell, eventMode, trigger, focus, event: (x = 0, y = 0) => ({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: x, clientY: y, currentTarget: trigger }) };
}

describe("planning session controls", () => {
  it("opens a session from a regular click and saves its type without changing availability", async () => {
    const app = mountPlanning();
    act(() => app.eventMode().props.onClick());
    act(() => app.cell().props.onClick(app.event(340, 780)));
    const menu = renderer.root.findByProps({ "aria-label": "Type de session" });
    expect(menu.props.style).toEqual({ left: 124, top: 492 });
    expect(app.focus).toHaveBeenCalledOnce();
    const scrim = menu.findAllByType("button").find((node) => node.findAllByType("span").some((span) => span.children.includes("Scrim")));
    act(() => scrim.props.onClick());
    expect(app.cell().props["aria-label"]).toContain("Scrim");
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
    expect(renderer.root.findByProps({ "aria-label": "Type de session" }).props.style).toEqual({ left: 80, top: 492 });
    act(() => listeners.get("keydown")({ key: "Escape" }));
    expect(renderer.root.findAllByProps({ "aria-label": "Type de session" })).toHaveLength(0);
    expect(app.trigger.focus).toHaveBeenCalledOnce();
    expect(app.save).not.toHaveBeenCalled();
  });

  it("preserves availability toggles and the context-menu shortcut", () => {
    const app = mountPlanning();
    act(() => app.cell().props.onClick(app.event()));
    expect(app.cell().props["aria-pressed"]).toBe(true);
    act(() => app.cell().props.onContextMenu(app.event(120, 300)));
    expect(renderer.root.findByProps({ "aria-label": "Type de session" })).toBeTruthy();
    expect(app.cell().props["aria-pressed"]).toBe(true);
  });
});
