import { PLANNING_DAYS, PLANNING_EVENT_TYPES, PLANNING_TIMES } from "../app/constants.jsx";

const DEFAULT_COMP_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];

export function emptyCompositionSlots(players = [], roles = DEFAULT_COMP_ROLES) {
  return Object.fromEntries(roles.map((role) => {
    const player = players.find((item) => item.role === role);
    return [role, { playerId: player?.id || "", poolId: "" }];
  }));
}

export function compositionSlots(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

export function jsonList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export function availabilitySlots(value) {
  const input = availabilityPayload(value);
  return Object.fromEntries(PLANNING_DAYS.map(([day]) => [day, Array.isArray(input[day]) ? input[day] : []]));
}

export function availabilityPayload(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === "object" ? value : {};
}

export function planningEventKey(day, time) {
  return `${day}|${time}`;
}

export function planningEventTypeFromLabel(label) {
  const value = String(label || "").toLowerCase();
  if (/\b(match|official|officiel|ligue|cup|bo[1235])\b/.test(value)) return "match";
  if (/\b(review|vod|debrief|débrief|analyse)\b/.test(value)) return "review";
  if (/\b(scrim|scrims|pracc|train|training)\b/.test(value)) return "scrim";
  return "custom";
}

export function planningEventMeta(type) {
  return PLANNING_EVENT_TYPES.find((item) => item.id === type) || PLANNING_EVENT_TYPES[PLANNING_EVENT_TYPES.length - 1];
}

export function availabilityEvents(value) {
  const input = availabilityPayload(value);
  const events = input._events || input.events || {};
  return events && typeof events === "object" && !Array.isArray(events) ? events : {};
}

export function planningSlotsPayload(slots, events) {
  const output = Object.fromEntries(PLANNING_DAYS.map(([day]) => [day, Array.isArray(slots?.[day]) ? PLANNING_TIMES.filter((time) => slots[day].includes(time)) : []]));
  const cleanEvents = Object.fromEntries(Object.entries(events || {}).filter(([, event]) => String(event?.label || "").trim()).map(([key, event]) => [key, { label: String(event.label).trim(), type: event.type || planningEventTypeFromLabel(event.label) }]));
  return Object.keys(cleanEvents).length ? { ...output, _events: cleanEvents } : output;
}

export function dateKey(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function mondayOfWeek(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

export function formatPlanningDate(date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

export function formatWeekRange(start) {
  return `${formatPlanningDate(start)} - ${formatPlanningDate(addDays(start, 6))}`;
}

export function dateFromKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
