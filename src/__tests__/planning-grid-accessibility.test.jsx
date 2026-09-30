import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanningAvailabilityGrid } from "../components/games/PlanningAvailabilityGrid.jsx";
let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; });
const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) => [day, day, new Date(2026, 8, 28 + i)]);
const rows = ["19:00", "20:00", "21:00"].map(time => ({ time, cells: days.map(([day], dayIndex) => ({ day, dayIndex, time, key: `${day}|${time}`, title: "Présence fictive", roles: [], activeSlot: false })) }));
function setup(extra = {}) {
  const focus = vi.fn();
  const settings = { rows, weekDays: days, canEditSelected: true, canEditEvents: true, editingEvents: false, draftSlots: {}, onDay: vi.fn(), onTime: vi.fn(), onToggle: vi.fn(), onEvent: vi.fn(), frameTone: () => "", ...extra };
  act(() => { renderer = TestRenderer.create(<PlanningAvailabilityGrid {...settings} />, { createNodeMock: () => ({ querySelector: selector => ({ focus: () => focus(selector) }) }) }); });
  return { settings, focus, update(props) { act(() => renderer.update(<PlanningAvailabilityGrid {...settings} {...props} />)); } };
}
const grid = () => renderer.root.findByProps({ "aria-label": "Disponibilités de la semaine" });
const entry = () => grid().findAllByType("button").filter(button => !button.props.disabled && button.props.tabIndex === 0).map(button => button.props["data-position"]);
function key(position, key, extra = {}) {
  act(() => grid().props.onKeyDown({ key, target: { closest: () => ({ dataset: { position } }) }, preventDefault: vi.fn(), ...extra }));
}
describe("planning keyboard and daily controls", () => {
  it("offers one entry point, moves in both directions and clamps to the grid", () => {
    const app = setup();
    expect(entry()).toEqual(["0:1"]);
    key("0:1", "ArrowDown"); expect(entry()).toEqual(["1:1"]);
    key("1:1", "ArrowRight"); expect(entry()).toEqual(["1:2"]);
    key("1:2", "End", { ctrlKey: true }); expect(entry()).toEqual(["3:7"]);
    expect(app.focus).toHaveBeenLastCalledWith('[data-position="3:7"]');
    key("3:7", "ArrowRight"); expect(entry()).toEqual(["3:7"]);
    key("3:7", "Home", { ctrlKey: true }); expect(entry()).toEqual(["0:1"]);
    key("1:2", "F10", { shiftKey: true });
    expect(app.settings.onEvent).toHaveBeenCalledWith(expect.any(Object), "TUE", "19:00", expect.objectContaining({ dataset: { position: "1:2" } }));
  });
  it.each(["0:3", "2:0"])("keeps a keyboard entry if personal editing is removed at %s", position => {
    const app = setup();
    act(() => grid().findByProps({ "data-position": position }).props.onFocus());
    expect(entry()).toEqual([position]);
    app.update({ canEditSelected: false });
    expect(entry()).toHaveLength(1);
    const [row, column] = entry()[0].split(":").map(Number);
    expect(row).toBeGreaterThan(0); expect(column).toBeGreaterThan(0);
    key(entry()[0], "Home", { ctrlKey: true }); expect(entry()).toEqual(["1:1"]);
  });
  it("lets the daily view change day and hour, preserving the availability/event distinction", () => {
    const app = setup();
    act(() => renderer.root.findByType("select").props.onChange({ target: { value: "2" } }));
    let list = renderer.root.findByProps({ "aria-label": "Créneaux du WED" });
    let cells = list.findAllByType("button");
    act(() => cells[0].props.onClick({}));
    expect(app.settings.onToggle).toHaveBeenCalledWith("WED", "19:00");
    act(() => cells[0].props.onKeyDown({ key: "End", preventDefault: vi.fn() }));
    cells = renderer.root.findByProps({ "aria-label": "Créneaux du WED" }).findAllByType("button");
    expect(cells.map(cell => cell.props.tabIndex)).toEqual([-1, -1, 0]);
    expect(app.focus).toHaveBeenLastCalledWith('[data-hour="2"]');
    app.update({ editingEvents: true });
    cells = renderer.root.findByProps({ "aria-label": "Créneaux du WED" }).findAllByType("button");
    const trigger = { focus: vi.fn() };
    const event = { kind: "click", currentTarget: trigger };
    act(() => cells[2].props.onClick(event));
    expect(app.settings.onEvent).toHaveBeenCalledWith(event, "WED", "21:00", trigger);
    expect(cells[2].props["aria-pressed"]).toBeUndefined();
  });
});
