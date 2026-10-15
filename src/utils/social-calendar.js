export const CALENDAR_TIMEZONE = "Europe/Paris";
export const CALENDAR_NETWORKS = { instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", linkedin: "LinkedIn" };
export const CALENDAR_STATUSES = {
  scheduled: { label: "Programmé", tone: "cyan" },
  published: { label: "Publié", tone: "green" },
  draft: { label: "Brouillon", tone: "slate" },
  ready: { label: "Prêt", tone: "purple" },
  needs_check: { label: "À vérifier", tone: "yellow" },
  error: { label: "Erreur", tone: "red" },
  removed: { label: "Retiré", tone: "slate" },
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function calendarDayKey(value) {
  if (!value) return null;
  const text = String(value);
  if (DATE_ONLY.test(text)) {
    const date = new Date(`${text}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CALENDAR_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = type => parts.find(part => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function calendarDate(value) {
  const key = calendarDayKey(value);
  return key ? new Date(`${key}T12:00:00Z`) : null;
}

export function formatCalendarTimestamp(value, locale = "fr-FR", { timeOnly = false, dayOnly = false } = {}) {
  if (!calendarDayKey(value)) return "";
  const dateOnly = DATE_ONLY.test(String(value));
  if (timeOnly && !dateOnly) return new Intl.DateTimeFormat(locale, { timeZone: CALENDAR_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  const options = dayOnly ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" };
  if (!dateOnly && !dayOnly) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
  return new Intl.DateTimeFormat(locale, { timeZone: CALENDAR_TIMEZONE, ...options }).format(dateOnly ? calendarDate(value) : new Date(value));
}

export function calendarRange(anchor, view) {
  const date = calendarDate(anchor) || new Date();
  const first = new Date(date);
  if (view === "month") first.setUTCDate(1);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - mondayOffset);
  const last = new Date(date);
  if (view === "month") {
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    last.setUTCDate(last.getUTCDate() + (7 - last.getUTCDay()) % 7);
  } else {
    last.setTime(first.getTime());
    last.setUTCDate(last.getUTCDate() + 6);
  }
  const days = [];
  for (let cursor = new Date(first); cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) days.push(cursor.toISOString().slice(0, 10));
  return days;
}

export function moveCalendarAnchor(anchor, view, step) {
  const date = calendarDate(anchor);
  if (!date) return anchor;
  if (view === "month") date.setUTCMonth(date.getUTCMonth() + step, 1);
  else date.setUTCDate(date.getUTCDate() + 7 * step);
  return date.toISOString().slice(0, 10);
}

export function sourceFreshness(source, now = Date.now()) {
  if (source.error) return "error";
  if (source.mode !== "automatic") return source.mode === "confirmed" ? "confirmed" : "manual";
  if (!source.lastSuccessAt || DATE_ONLY.test(source.lastSuccessAt)) return "stale";
  const age = now - new Date(source.lastSuccessAt).getTime();
  return Number.isFinite(age) && age >= -5 * 60_000 && age <= 90 * 60_000 ? "automatic" : "stale";
}

export function publicationNeedsCheck(post, now = Date.now()) {
  return post.status === "scheduled" && Boolean(post.scheduledAt) && !DATE_ONLY.test(post.scheduledAt) && new Date(post.scheduledAt).getTime() < now;
}

export function safeCalendarUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function calendarCsv(posts) {
  const cell = value => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  const rows = [["Réseau", "Titre", "Format", "Statut", "Date (ISO)", "Source", "Vérifié le", "URL"], ...posts.map(post => [CALENDAR_NETWORKS[post.network] || post.network, post.title, post.format, post.status, post.scheduledAt, post.source, post.verifiedAt, safeCalendarUrl(post.url) || ""])];
  return "\uFEFF" + rows.map(row => row.map(cell).join(";")).join("\r\n");
}
