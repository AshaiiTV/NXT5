import { useEffect, useMemo, useSyncExternalStore } from "react";

const EMPTY_DRAFT = { slots: {}, events: {}, notes: "", status: "idle", saving: false };
const noop = () => {};
const emptySnapshot = () => EMPTY_DRAFT;

export function usePlanningDraft(store, context, row) {
  const entry = useMemo(() => context.teamId && context.playerId
    ? store.forContext(context, row)
    : null, [store, context.teamId, context.playerId, context.weekStart]);
  const snapshot = useSyncExternalStore(entry?.subscribe || noop, entry?.getSnapshot || emptySnapshot, entry?.getSnapshot || emptySnapshot);
  useEffect(() => { entry?.sync(row); }, [entry, row]);
  return {
    ...snapshot,
    setSlots: entry?.setSlots || noop,
    setEvents: entry?.setEvents || noop,
    setNotes: entry?.setNotes || noop,
    save: entry?.flush || noop,
  };
}
