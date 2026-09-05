import React, { useEffect, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanningDraft } from "../hooks/usePlanningDraft.js";
import { availabilityKey, createPlanningStore, upsertAvailability } from "../utils/planning-store.js";

const CURRENT = { teamId: "team-a", playerId: "player-a", weekStart: "2026-08-31" };
const NEXT = { ...CURRENT, weekStart: "2026-09-07" };
const OTHER_PLAYER = { ...CURRENT, playerId: "player-b" };
const OTHER_TEAM = { teamId: "team-b", playerId: "player-c", weekStart: CURRENT.weekStart };
const cleanups = [];

function serverRow(body, version = 1) {
  return {
    id: availabilityKey(body), team_id: body.teamId, player_id: body.playerId, week_start: body.weekStart,
    slots: body.slots, notes: body.notes, updated_at: `2026-09-05T12:00:${String(version).padStart(2, "0")}.000Z`,
  };
}

// Real React mounting/unmounting and subscriptions; only HTTP is mocked.
function session(initialRows = []) {
  const requests = [];
  const save = vi.fn((body) => new Promise((resolve, reject) => requests.push({ body, resolve, reject })));
  const onError = vi.fn();
  let draft, rows, store, setRows;
  let props = { visible: true, context: CURRENT };

  function PlanningView({ context, row, planningStore }) {
    draft = usePlanningDraft(planningStore, context, row);
    return <output>{JSON.stringify({ slots: draft.slots, events: draft.events, notes: draft.notes, status: draft.status })}</output>;
  }

  function Session({ visible, context }) {
    const [availability, updateRows] = useState(initialRows);
    const [planningStore] = useState(() => createPlanningStore({
      save, onError,
      onSaved: (row) => updateRows((current) => upsertAvailability(current, row)),
    }));
    useEffect(() => { planningStore.resume(); return () => planningStore.pause(); }, [planningStore]);
    rows = availability;
    store = planningStore;
    setRows = updateRows;
    return visible ? <PlanningView context={context} planningStore={planningStore} row={availability.find((row) => availabilityKey(row) === availabilityKey(context))} /> : null;
  }

  let renderer;
  act(() => { renderer = TestRenderer.create(<Session {...props} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return {
    requests, save, onError,
    get draft() { return draft; },
    get rows() { return rows; },
    edit(callback) { act(() => callback(draft)); },
    navigate(next) { props = { ...props, ...next }; act(() => renderer.update(<Session {...props} />)); },
    bootstrap(incoming, players = [{ id: "player-a" }, { id: "player-b" }, { id: "player-c" }]) {
      act(() => setRows(store.mergeAvailability(incoming, players)));
    },
    async complete(index, version = index + 1) {
      await act(async () => requests[index].resolve(serverRow(requests[index].body, version)));
    },
  };
}

async function waitForAutosave() {
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); });

describe("planning autosave across React navigation", () => {
  it("retains a confirmed slot after unmount, return and another save", async () => {
    const app = session();
    app.edit((draft) => draft.setSlots({ MON: ["20:00"] }));
    await waitForAutosave();
    await app.complete(0);
    expect(app.draft.status).toBe("saved");
    expect(app.rows[0].slots.MON).toEqual(["20:00"]);

    app.navigate({ visible: false });
    app.navigate({ visible: true });
    expect(app.draft.slots.MON).toEqual(["20:00"]);
    app.edit((draft) => draft.setSlots((slots) => ({ ...slots, TUE: ["21:00"] })));
    await waitForAutosave();
    expect(app.requests[1].body.slots).toMatchObject({ MON: ["20:00"], TUE: ["21:00"] });
    await app.complete(1);
  });

  it("saves a draft even when navigation occurs before the debounce expires", async () => {
    const app = session();
    app.edit((draft) => draft.setNotes("Disponible après 20 h"));
    app.navigate({ visible: false });
    await waitForAutosave();
    await app.complete(0);
    app.navigate({ visible: true });
    expect(app.draft.notes).toBe("Disponible après 20 h");
    expect(app.draft.status).toBe("saved");
  });

  it("keeps edits made during a save and serializes the next complete payload", async () => {
    const app = session();
    app.edit((draft) => {
      draft.setSlots({ MON: ["20:00"] });
      draft.setNotes("Ancienne note");
      draft.setEvents({ "MON|20:00": { label: "Scrim", type: "scrim" } });
    });
    await waitForAutosave();
    app.edit((draft) => {
      draft.setSlots((slots) => ({ ...slots, TUE: ["21:00"] }));
      draft.setNotes("Nouvelle note");
      draft.setEvents({ "TUE|21:00": { label: "Review", type: "review" } });
    });
    app.navigate({ visible: false });
    app.navigate({ visible: true });
    await waitForAutosave();
    expect(app.save).toHaveBeenCalledTimes(1);
    await app.complete(0);
    expect(app.draft.status).toBe("dirty");
    expect(app.draft.notes).toBe("Nouvelle note");
    expect(app.draft.events).toEqual({ "TUE|21:00": { label: "Review", type: "review" } });
    await waitForAutosave();
    expect(app.requests[1].body).toMatchObject({
      notes: "Nouvelle note", slots: { MON: ["20:00"], TUE: ["21:00"], _events: { "TUE|21:00": { label: "Review", type: "review" } } },
    });
    expect(app.requests[1].body.slots._events["MON|20:00"]).toBeUndefined();
    await app.complete(1);
    expect(app.draft.status).toBe("saved");
    expect(app.rows[0].notes).toBe("Nouvelle note");
  });

  it.each([NEXT, OTHER_PLAYER, OTHER_TEAM])("isolates pending responses for context %j", async (context) => {
    const app = session();
    app.edit((draft) => draft.setSlots({ MON: ["20:00"] }));
    await waitForAutosave();
    app.navigate({ context });
    app.edit((draft) => draft.setSlots({ FRI: ["22:00"] }));
    await waitForAutosave();
    // Different contexts may finish in either order; each response has its key.
    await app.complete(1);
    await app.complete(0);
    expect(app.draft.slots.FRI).toEqual(["22:00"]);
    expect(app.draft.slots.MON).toEqual([]);
    expect(app.draft.status).toBe("saved");
    app.navigate({ context: CURRENT });
    expect(app.draft.slots.MON).toEqual(["20:00"]);
    expect(app.draft.slots.FRI).toEqual([]);
    expect(app.rows).toHaveLength(2);
  });

  it("ignores old bootstrap rows but accepts newer server changes when clean", async () => {
    const oldRow = serverRow({ ...CURRENT, slots: { MON: [] }, notes: "" }, 1);
    const app = session([oldRow]);
    app.edit((draft) => draft.setSlots({ MON: ["20:00"] }));
    await waitForAutosave();
    await app.complete(0, 2);
    app.bootstrap([oldRow]);
    expect(app.rows[0].slots.MON).toEqual(["20:00"]);
    app.bootstrap([]); // Bootstrap may have started before the first row existed.
    expect(app.rows[0].slots.MON).toEqual(["20:00"]);
    app.navigate({ visible: false });
    app.navigate({ visible: true });
    expect(app.draft.slots.MON).toEqual(["20:00"]);
    const newer = serverRow({ ...CURRENT, slots: { WED: ["19:00"] }, notes: "Mis à jour ailleurs" }, 3);
    app.bootstrap([newer]);
    expect(app.draft.slots.WED).toEqual(["19:00"]);
    expect(app.draft.notes).toBe("Mis à jour ailleurs");
    app.bootstrap([], []); // A removed profile must not reappear in shared data.
    expect(app.rows).toEqual([]);
  });

  it("does not roll back a newer bootstrap that arrives before an older save response", async () => {
    const app = session();
    app.edit((draft) => draft.setSlots({ MON: ["20:00"] }));
    await waitForAutosave();
    const newer = serverRow({ ...CURRENT, slots: { MON: ["20:00"], WED: ["19:00"] }, notes: "Plus récent" }, 3);
    app.bootstrap([newer]);
    await app.complete(0, 2);
    expect(app.draft.slots.WED).toEqual(["19:00"]);
    expect(app.draft.notes).toBe("Plus récent");
    app.edit((draft) => draft.setSlots((slots) => ({ ...slots, FRI: ["22:00"] })));
    await waitForAutosave();
    expect(app.requests[1].body.slots).toMatchObject({ MON: ["20:00"], WED: ["19:00"], FRI: ["22:00"] });
    await app.complete(1, 4);
  });

  it("keeps a failed draft across navigation, stops retries, and permits an explicit retry", async () => {
    const app = session();
    app.edit((draft) => draft.setNotes("Ne pas perdre cette note"));
    await waitForAutosave();
    await act(async () => app.requests[0].reject(new Error("Service indisponible")));
    expect(app.draft.status).toBe("error");
    expect(app.onError).toHaveBeenCalledTimes(1);
    app.navigate({ visible: false });
    app.navigate({ visible: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(app.save).toHaveBeenCalledTimes(1);
    expect(app.draft.notes).toBe("Ne pas perdre cette note");
    await act(async () => { app.draft.save(); });
    expect(app.requests[1].body.notes).toBe("Ne pas perdre cette note");
    await app.complete(1);
    expect(app.draft.status).toBe("saved");
  });
});
