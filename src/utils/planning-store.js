import { availabilityEvents, availabilitySlots, planningSlotsPayload } from "./planning.js";

export function availabilityKey(row) {
  return [row.team_id || row.teamId, row.player_id || row.playerId, String(row.week_start || row.weekStart || "").slice(0, 10)].join("|");
}

function rowTime(row) {
  return Date.parse(row?.updated_at || "") || 0;
}

export function upsertAvailability(rows, row) {
  const key = availabilityKey(row);
  const previous = rows.find((item) => availabilityKey(item) === key);
  if (previous && rowTime(previous) > rowTime(row)) return rows;
  return previous ? rows.map((item) => availabilityKey(item) === key ? row : item) : [...rows, row];
}

function snapshotFromRow(row, status = "idle") {
  return { slots: availabilitySlots(row?.slots), events: availabilityEvents(row?.slots), notes: row?.notes || "", status, saving: false };
}

// Owned by MainApp, so a route change cannot discard a draft or an active save.
// Each team/player/week has its own serial queue and acknowledged server row.
export function createPlanningStore({ save, onSaved, onError, delayMs = 650 }) {
  const entries = new Map();
  let active = true;

  function forContext(context, initialRow) {
    const key = availabilityKey(context);
    if (entries.has(key)) return entries.get(key);
    const target = { teamId: context.teamId, playerId: context.playerId, weekStart: context.weekStart };
    let confirmed = initialRow || null;
    let snapshot = snapshotFromRow(initialRow);
    let revision = 0;
    let savedRevision = 0;
    let timer = null;
    let inFlight = null;
    const listeners = new Set();
    const emit = () => listeners.forEach((listener) => listener());
    const clearTimer = () => { clearTimeout(timer); timer = null; };

    function schedule() {
      clearTimer();
      if (!active || inFlight || snapshot.status !== "dirty") return;
      timer = setTimeout(flush, delayMs);
    }

    function update(field, value) {
      const next = typeof value === "function" ? value(snapshot[field]) : value;
      if (Object.is(next, snapshot[field])) return;
      revision += 1;
      snapshot = { ...snapshot, [field]: next, status: "dirty" };
      emit();
      schedule();
    }

    function flush() {
      clearTimer();
      if (!active) return Promise.resolve();
      if (inFlight) return inFlight;
      if (revision === savedRevision) return Promise.resolve();
      const savingRevision = revision;
      const body = { ...target, slots: planningSlotsPayload(snapshot.slots, snapshot.events), notes: snapshot.notes };
      snapshot = { ...snapshot, status: "saving", saving: true };
      emit();
      inFlight = Promise.resolve().then(() => save(body)).then((row) => {
        if (!row || availabilityKey(row) !== key) throw new Error("La confirmation du planning est invalide. Réessaie.");
        if (!confirmed || rowTime(row) >= rowTime(confirmed)) confirmed = row;
        savedRevision = savingRevision;
        // A response acknowledges its snapshot, never edits made while it ran.
        snapshot = revision === savingRevision
          ? { ...snapshotFromRow(confirmed, "saved"), saving: true }
          : { ...snapshot, status: "dirty" };
        if (active) onSaved?.(confirmed);
      }).catch((error) => {
        snapshot = { ...snapshot, status: "error" };
        if (active) onError?.(error);
      }).finally(() => {
        inFlight = null;
        snapshot = { ...snapshot, saving: false };
        emit();
        // Failures wait for an explicit retry or another edit, avoiding a loop.
        schedule();
      });
      return inFlight;
    }

    const entry = {
      getSnapshot: () => snapshot,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      setSlots: (value) => update("slots", value),
      setEvents: (value) => update("events", value),
      setNotes: (value) => update("notes", value),
      flush,
      sync(row) {
        if (!row || availabilityKey(row) !== key || (confirmed && rowTime(row) <= rowTime(confirmed))) return;
        confirmed = row;
        if (revision !== savedRevision || inFlight) return;
        snapshot = snapshotFromRow(row);
        emit();
      },
      confirmed: () => confirmed,
      clearTimer,
      schedule,
    };
    entries.set(key, entry);
    return entry;
  }

  return {
    forContext,
    // A bootstrap started before a save must not roll back its confirmed row.
    mergeAvailability(rows = [], players = []) {
      const playerIds = new Set(players.map((player) => String(player.id)));
      return [...entries.values()].reduce((merged, entry) => {
        const row = entry.confirmed();
        return row && playerIds.has(String(row.player_id)) ? upsertAvailability(merged, row) : merged;
      }, rows);
    },
    resume() { active = true; entries.forEach((entry) => entry.schedule()); },
    pause() { active = false; entries.forEach((entry) => entry.clearTimer()); },
  };
}
