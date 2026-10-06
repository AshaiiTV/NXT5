const EVENT_TYPE_ORDER = { scrim: 0, match: 1, review: 2, custom: 3 };
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function eventMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function rowEvents(row) {
  let slots = row?.slots;
  if (typeof slots === "string") {
    try { slots = JSON.parse(slots); } catch { return {}; }
  }
  const payload = eventMap(slots);
  return eventMap(payload._events || payload.events);
}

/**
 * Returns one shared view of sessions, independent of the viewing profile and
 * row ordering. An optional draft replaces that profile's saved contribution,
 * including when its event map is empty. No aggregated value is a save payload.
 *
 * Each cell contains ordered, distinct `events` with sorted `playerIds`.
 * Standard sessions are grouped by type; custom sessions by their exact label
 * after trimming. A cell's type is `mixed` when it contains several sessions.
 */
export function aggregatePlanningEvents(rows = [], draft) {
  const cells = new Map();
  const draftPlayerId = draft?.playerId == null ? "" : String(draft.playerId);

  function addEvents(playerId, events) {
    for (const [key, rawEvent] of Object.entries(eventMap(events))) {
      if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) continue;
      const label = String(rawEvent.label || "").trim();
      if (!label) continue;
      const type = Object.hasOwn(EVENT_TYPE_ORDER, rawEvent.type) ? rawEvent.type : "custom";
      const identity = JSON.stringify([type, type === "custom" ? label : ""]);
      const sessions = cells.get(key) || new Map();
      const session = sessions.get(identity) || { type, label, playerIds: new Set() };
      // Legacy rows can use different labels for the same standard type.
      // Choose a stable representative; UI labels are derived from the type.
      if (compareText(label, session.label) < 0) session.label = label;
      if (playerId) session.playerIds.add(playerId);
      sessions.set(identity, session);
      cells.set(key, sessions);
    }
  }

  for (const row of Array.isArray(rows) ? rows : []) {
    const playerId = row?.player_id == null ? "" : String(row.player_id);
    if (draftPlayerId && playerId === draftPlayerId) continue;
    addEvents(playerId, rowEvents(row));
  }
  if (draftPlayerId) addEvents(draftPlayerId, draft.events);

  return Object.fromEntries([...cells.entries()].sort(([left], [right]) => compareText(left, right)).map(([key, sessions]) => {
    const events = [...sessions.values()]
      .sort((left, right) => EVENT_TYPE_ORDER[left.type] - EVENT_TYPE_ORDER[right.type] || compareText(left.label, right.label))
      .map((session) => ({ ...session, playerIds: [...session.playerIds].sort(compareText) }));
    const conflict = events.length > 1;
    return [key, {
      type: conflict ? "mixed" : events[0].type,
      ...(!conflict ? { label: events[0].label } : {}),
      events,
      conflict,
    }];
  }));
}
