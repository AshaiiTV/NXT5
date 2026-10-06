import React, { useEffect, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Planning } from "../pages/workspace/Planning.jsx";
import { PlanningAvailabilityGrid } from "../components/games/PlanningAvailabilityGrid.jsx";
import { availabilityKey, createPlanningStore, upsertAvailability } from "../utils/planning-store.js";

const ROLE_CASES = [
  ["TOP", "Top", "top"], ["JGL", "Jungle", "jungle"], ["MID", "Mid", "middle"],
  ["ADC", "ADC", "bottom"], ["SUP", "Support", "utility"],
];
const PLAYERS = ROLE_CASES.map(([role]) => ({
  id: `player-${role}`, team_id: "team", user_id: `user-${role}`,
  name: `Joueur ${role}`, role, roster_status: "MAIN",
}));
const CURRENT_WEEK = "2026-10-05";
const NEXT_WEEK = "2026-10-12";
const cleanups = [];

function renderedText(node) {
  return typeof node === "string" ? node : (node.children || []).map(renderedText).join("");
}

// The page, both availability controls and the session-owned store are real.
// Only the HTTP save boundary is replaced; acknowledged rows feed back into data.
function mountSession(role) {
  const requests = [];
  const save = vi.fn((body) => new Promise((resolve) => requests.push({ body, resolve })));
  const onSaved = vi.fn();
  const onError = vi.fn();
  const otherRole = ROLE_CASES.find(([candidate]) => candidate !== role)[0];
  const untouchedRow = {
    id: "other-row", team_id: "team", player_id: `player-${otherRole}`,
    week_start: CURRENT_WEEK, slots: { TUE: ["11:00"] }, notes: "Note de l’autre joueur",
    updated_at: "2026-10-05T10:00:00Z",
  };
  let rows;
  let props = { visible: true, role };
  function Session({ visible, role: activeRole }) {
    const [availability, setAvailability] = useState([untouchedRow]);
    const [store] = useState(() => createPlanningStore({
      save, onError,
      onSaved(row) {
        onSaved(row);
        setAvailability((previous) => upsertAvailability(previous, row));
      },
    }));
    useEffect(() => { store.resume(); return () => store.pause(); }, [store]);
    rows = availability;
    return visible ? <Planning data={{ players: PLAYERS, availability }}
      selectedTeamId="team" planningStore={store}
      user={{ id: `user-${activeRole}` }} currentMember={{ role: "player" }} /> : null;
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(<Session {...props} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  const weekly = () => renderer.root.findByProps({ "aria-label": "Disponibilités de la semaine" });
  return {
    save, onSaved, onError, requests, otherRole, untouchedRow,
    get rows() { return rows; },
    get root() { return renderer.root; },
    get grid() { return renderer.root.findByType(PlanningAvailabilityGrid); },
    note: () => renderer.root.findByType("textarea"),
    cell: (label) => weekly().findAllByType("button").find((button) => button.props["aria-label"]?.startsWith(label)),
    dailyCell: (label) => renderer.root.findAllByType("button").find((button) => button.props["data-hour"] !== undefined && button.props["aria-label"]?.startsWith(label)),
    week(label) {
      const button = renderer.root.findAllByType("button").find((candidate) => renderedText(candidate).startsWith(label));
      act(() => button.props.onClick());
    },
    navigate(next) {
      props = { ...props, ...next };
      act(() => renderer.update(<Session {...props} />));
    },
    async acknowledge(index) {
      const { body, resolve } = requests[index];
      await act(async () => resolve({
        id: availabilityKey(body), team_id: body.teamId, player_id: body.playerId,
        week_start: body.weekStart, slots: body.slots, notes: body.notes,
        updated_at: `2026-10-05T12:00:0${index + 1}Z`,
      }));
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  vi.stubGlobal("window", { innerWidth: 390, innerHeight: 844, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("planning audit for the five gameplay positions", () => {
  it.each(ROLE_CASES)("%s supports weekly/daily editing, saves its own profile and isolates weeks", async (role, label, asset) => {
    const app = mountSession(role);
    const name = `Joueur ${role}`;
    expect(app.root.findAllByType("p").some((node) => renderedText(node) === name)).toBe(true);
    expect(app.root.findAllByType("p").some((node) => renderedText(node) === `${label} · profil lié à ton compte`)).toBe(true);
    expect(app.root.findAllByType("img").some((node) => node.props.alt === role && node.props.src === `/assets/roles/position-${asset}.svg`)).toBe(true);
    expect(app.grid.props.canEditSelected).toBe(true);
    expect(app.note().props.disabled).toBe(false);

    const desktop = app.cell("Lun 20:00");
    expect(desktop.props.disabled).toBe(false);
    act(() => desktop.props.onClick({}));
    expect(app.cell("Lun 20:00").props["aria-pressed"]).toBe(true);
    expect(app.cell("Lun 20:00").props["aria-label"]).toContain(`${label} · ${name}`);

    act(() => app.root.findByType("select").props.onChange({ target: { value: "2" } }));
    expect(app.dailyCell("Mer 21:00").props.disabled).toBe(false);
    act(() => app.dailyCell("Mer 21:00").props.onClick({}));
    expect(app.dailyCell("Mer 21:00").props["aria-pressed"]).toBe(true);
    expect(app.cell("Mer 21:00").props["aria-pressed"]).toBe(true);
    act(() => app.note().props.onChange({ target: { value: `Disponible pour ${role}` } }));
    expect(renderedText(app.root.findByProps({ role: "status" }))).toBe("Modifications en attente");

    await act(async () => vi.advanceTimersByTimeAsync(650));
    expect(app.save).toHaveBeenCalledOnce();
    expect(app.requests[0].body).toMatchObject({
      teamId: "team", playerId: `player-${role}`, weekStart: CURRENT_WEEK,
      slots: { MON: ["20:00"], WED: ["21:00"], TUE: [] }, notes: `Disponible pour ${role}`,
    });
    expect(renderedText(app.root.findByProps({ role: "status" }))).toBe("Enregistrement…");
    await app.acknowledge(0);
    expect(app.onSaved).toHaveBeenCalledOnce();
    expect(renderedText(app.root.findByProps({ role: "status" }))).toBe("Enregistré");

    app.week("Semaine d’après");
    expect(app.cell("Lun 20:00").props["aria-pressed"]).toBe(false);
    expect(app.cell("Mer 21:00").props["aria-pressed"]).toBe(false);
    expect(app.note().props.value).toBe("");
    act(() => app.cell("Ven 22:00").props.onClick({}));
    act(() => app.note().props.onChange({ target: { value: `Semaine suivante ${role}` } }));
    await act(async () => vi.advanceTimersByTimeAsync(650));
    expect(app.requests[1].body).toMatchObject({
      playerId: `player-${role}`, weekStart: NEXT_WEEK,
      slots: { MON: [], WED: [], FRI: ["22:00"] }, notes: `Semaine suivante ${role}`,
    });
    await app.acknowledge(1);
    app.week("Semaine en cours");
    expect(app.cell("Lun 20:00").props["aria-pressed"]).toBe(true);
    expect(app.cell("Ven 22:00").props["aria-pressed"]).toBe(false);
    expect(app.note().props.value).toBe(`Disponible pour ${role}`);

    app.navigate({ visible: false });
    app.navigate({ visible: true });
    expect(app.cell("Lun 20:00").props["aria-pressed"]).toBe(true);
    expect(app.cell("Mer 21:00").props["aria-pressed"]).toBe(true);
    expect(app.note().props.value).toBe(`Disponible pour ${role}`);
    app.navigate({ role: app.otherRole });
    expect(app.cell("Lun 20:00").props["aria-pressed"]).toBe(false);
    expect(app.cell("Lun 20:00").props["aria-label"]).toContain(`${label} · ${name}`);
    const teamCell = app.grid.props.rows.find((row) => row.time === "20:00").cells[0];
    expect(teamCell.roles.find((entry) => entry.role === role).lit).toBe(true);
    expect(app.note().props.value).toBe("Note de l’autre joueur");
    expect(app.rows.find((row) => row.id === "other-row")).toEqual(app.untouchedRow);
    expect(app.rows).toHaveLength(3);
    expect(app.save).toHaveBeenCalledTimes(2);
    expect(app.onError).not.toHaveBeenCalled();
  });
});
