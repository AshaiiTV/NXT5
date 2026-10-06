import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Planning } from "../pages/workspace/Planning.jsx";
import { PlanningAvailabilityGrid } from "../components/games/PlanningAvailabilityGrid.jsx";
import { createPlanningStore, upsertAvailability } from "../utils/planning-store.js";

const mounts = [];
const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const starters = roles.map(role => ({ id: role, team_id: "team", user_id: role, name: `Z ${role}`, role, roster_status: "MAIN" }));
const row = (playerId, slots) => ({ id: `row-${playerId}`, team_id: "team", player_id: playerId, week_start: "2026-10-05", slots, updated_at: "2026-10-05T12:00:00Z" });
const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const allDaySlots = times => Object.fromEntries(days.map(day => [day, [...times]]));
const sessionEvents = Object.fromEntries(days.flatMap(day => [
  [`${day}|18:00`, { label: "Review", type: "review" }],
  [`${day}|20:00`, { label: "Scrim", type: "scrim" }],
  [`${day}|23:00`, { label: "Match", type: "match" }],
]));
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : (node.children || []).map(text).join("");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", { innerWidth: 1280, innerHeight: 900, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(async () => {
  await act(async () => {
    for (const { renderer, store } of mounts.splice(0)) { renderer.unmount(); store.pause(); }
  });
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mount(userId, availability, players = starters) {
  let savedRows, updateRows;
  const save = vi.fn(async body => ({ ...row(body.playerId, body.slots), week_start: body.weekStart, notes: body.notes, updated_at: new Date(Date.now() + save.mock.calls.length * 1000).toISOString() }));
  const store = createPlanningStore({ save, onSaved: confirmed => updateRows(previous => upsertAvailability(previous, confirmed)) });
  function Session() {
    const [rows, setRows] = useState(availability);
    savedRows = rows;
    updateRows = setRows;
    return <Planning data={{ players, availability: rows }} selectedTeamId="team" currentMember={{ role: "player" }} user={{ id: userId }} planningStore={store} />;
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(<Session />, { createNodeMock: () => ({ querySelector: () => ({ focus: vi.fn() }) }) }); });
  mounts.push({ renderer, store });
  const cell = (day = "MON", time = "20:00") => renderer.root.findByType(PlanningAvailabilityGrid).props.rows.find(item => item.time === time).cells.find(item => item.day === day);
  const button = label => renderer.root.findAllByType("button").find(candidate => text(candidate) === label);
  const weekly = () => renderer.root.findByProps({ "aria-label": "Disponibilités de la semaine" });
  const weeklyCell = () => weekly().findAllByType("button").find(candidate => candidate.props["aria-label"]?.startsWith("Lun 20:00"));
  const dailyCell = () => renderer.root.findAllByType("button").find(candidate => candidate.props["data-hour"] !== undefined && candidate.props["aria-label"]?.startsWith("Lun 20:00"));
  return { renderer, save, cell, button, weekly, weeklyCell, dailyCell, get rows() { return savedRows; } };
}

async function autosave(app) {
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(text(app.renderer.root.findByProps({ role: "status" }))).toBe("Enregistré");
  return app.save.mock.lastCall[0];
}

describe("planning edge audit — desired collective behavior", () => {
  it("shows the current TOP starter even when a substitute sorts first by name", () => {
    const substitute = { id: "top-sub", team_id: "team", user_id: "top-sub", name: "A substitute", role: "TOP", roster_status: "SUB" };
    const app = mount("MID", [row("TOP", { MON: ["20:00"] })], [...starters, substitute]);
    const top = app.cell().roles.find(item => item.role === "TOP");
    expect(top.player.id).toBe("TOP");
    expect(top.lit).toBe(true);
  });

  it("shows all conflicting session types to every role regardless of row order", () => {
    const availability = [
      row("JGL", { _events: { "MON|20:00": { label: "Match", type: "match" } } }),
      row("TOP", { _events: { "MON|20:00": { label: "Scrim", type: "scrim" } } }),
    ];
    const labels = roles.flatMap(role => [availability, [...availability].reverse()].map(rows => mount(role, rows).cell().slotEventLabel));
    expect(new Set(labels).size).toBe(1);
    expect(labels[0]).toContain("Entraînement");
    expect(labels[0]).toContain("Match");
  });

  it.each([
    ["weekly cell", app => app.weeklyCell(), { ...allDaySlots(["18:00", "20:00", "23:00"]), MON: ["18:00", "23:00"] }],
    ["daily cell", app => app.dailyCell(), { ...allDaySlots(["18:00", "20:00", "23:00"]), MON: ["18:00", "23:00"] }],
    ["weekly day", app => app.weekly().findAllByType("button").find(candidate => candidate.props["data-position"] === "0:1"), { ...allDaySlots(["18:00", "20:00", "23:00"]), MON: [] }],
    ["daily day", app => app.button("Vider cette journée"), { ...allDaySlots(["18:00", "20:00", "23:00"]), MON: [] }],
    ["weekly hour", app => app.weekly().findAllByType("button").find(candidate => candidate.props.title === "Basculer cette heure sur toute la semaine" && text(candidate) === "20:00"), allDaySlots(["18:00", "23:00"])],
    ["clear preset", app => app.button("Vider mes disponibilités"), allDaySlots([])],
    ["evenings preset", app => app.button("Soirées · 20 h à 23 h"), allDaySlots(["20:00", "21:00", "22:00", "23:00"])],
    ["scrim preset", app => app.button("Entraînement · 19 h à 22 h"), allDaySlots(["19:00", "20:00", "21:00", "22:00"])],
    ["weekend preset", app => app.button("Week-end · 20 h à 23 h"), { ...allDaySlots([]), SAT: ["20:00", "21:00", "22:00", "23:00"], SUN: ["20:00", "21:00", "22:00", "23:00"] }],
  ])("%s changes only availability and preserves every saved session", async (_name, trigger, expectedSlots) => {
    const other = row("JGL", { TUE: ["21:00"], _events: { "TUE|21:00": { label: "Match", type: "match" } } });
    const app = mount("TOP", [row("TOP", { ...allDaySlots(["18:00", "20:00", "23:00"]), _events: sessionEvents }), other]);
    expect(trigger(app)).toBeTruthy();
    act(() => trigger(app).props.onClick({}));
    const request = await autosave(app);
    expect(request).toMatchObject({ playerId: "TOP", weekStart: "2026-10-05" });
    expect(request.slots).toEqual({ ...expectedSlots, _events: sessionEvents });
    expect(app.rows.find(item => item.player_id === "JGL")).toEqual(other);
    expect(app.cell().slotEventLabel).toContain("Entraînement");
    const reloaded = mount("TOP", app.rows);
    expect(reloaded.cell().slotEventLabel).toContain("Entraînement");
    expect(reloaded.cell("TUE", "21:00").slotEventLabel).toContain("Match");
  });

  it("explicitly removes only the authored session, immediately and after reload, while keeping availability", async () => {
    const other = row("JGL", { _events: { "TUE|21:00": { label: "Match", type: "match" } } });
    const ownEvents = { "MON|20:00": { label: "Scrim", type: "scrim" }, "WED|18:00": { label: "Review", type: "review" } };
    const app = mount("TOP", [row("TOP", { MON: ["20:00"], _events: ownEvents }), other]);
    const trigger = { getBoundingClientRect: () => ({ left: 80, bottom: 100 }), focus: vi.fn() };
    act(() => app.weeklyCell().props.onContextMenu({ preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: trigger }));
    const remove = app.button("Retirer cette séance · Entraînement");
    expect(remove).toBeTruthy();
    act(() => remove.props.onClick());
    expect(app.cell().slotEventLabel).toBe("");
    expect(app.cell().activeSlot).toBe(true);
    const request = await autosave(app);
    expect(request.slots.MON).toEqual(["20:00"]);
    expect(request.slots._events).toEqual({ "WED|18:00": ownEvents["WED|18:00"] });
    expect(app.rows.find(item => item.player_id === "JGL")).toEqual(other);
    const reloaded = mount("TOP", app.rows);
    expect(reloaded.cell().slotEventLabel).toBe("");
    expect(reloaded.cell().activeSlot).toBe(true);
    expect(reloaded.cell("TUE", "21:00").slotEventLabel).toContain("Match");
    expect(reloaded.cell("WED", "18:00").slotEventLabel).toContain("Débrief");
  });

  it("removes only the author's contribution when another player has a session on the same slot", async () => {
    const other = row("JGL", { _events: { "MON|20:00": { label: "Match", type: "match" } } });
    const app = mount("TOP", [row("TOP", { MON: ["20:00"], _events: { "MON|20:00": { label: "Scrim", type: "scrim" } } }), other]);
    const trigger = { getBoundingClientRect: () => ({ left: 80, bottom: 100 }), focus: vi.fn() };
    act(() => app.weeklyCell().props.onContextMenu({ preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: trigger }));
    act(() => app.button("Retirer cette séance · Entraînement").props.onClick());
    expect(app.cell().slotEventLabel).toContain("Match");
    expect(app.cell().slotEventLabel).not.toContain("Entraînement");
    const request = await autosave(app);
    expect(request.slots._events).toBeUndefined();
    expect(request.slots.MON).toEqual(["20:00"]);
    expect(app.rows.find(item => item.player_id === "JGL")).toEqual(other);
    expect(mount("TOP", app.rows).cell().slotEventLabel).toBe(app.cell().slotEventLabel);
  });
});
