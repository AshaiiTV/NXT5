export const SUBSCRIPTION_PLANS = [
  { code: "free", label: "Découverte", months: 0 },
  { code: "team_monthly", label: "Pass Équipe", months: 1 },
  { code: "team_season", label: "Pass Saison", months: 6 },
  { code: "structure", label: "Pass Structure", months: 1 },
];

export const SUBSCRIPTION_UPDATED_EVENT = "nxt5:subscription-updated";

export function notifySubscriptionUpdated() {
  globalThis.window?.dispatchEvent?.(new Event(SUBSCRIPTION_UPDATED_EVENT));
}

const STATUS_PRESENTATIONS = {
  none: { statusLabel: "Sans abonnement", tone: "slate" },
  scheduled: { statusLabel: "À venir", tone: "purple" },
  active: { statusLabel: "Actif", tone: "green" },
  expired: { statusLabel: "Expiré", tone: "yellow" },
  revoked: { statusLabel: "Retiré", tone: "slate" },
};

export function getSubscriptionPresentation(subscription) {
  const plan = SUBSCRIPTION_PLANS.find((item) => item.code === subscription?.planCode);
  return { label: plan?.label || (subscription?.planCode ? "Formule inconnue" : "Découverte"), ...(STATUS_PRESENTATIONS[subscription?.status] || STATUS_PRESENTATIONS.none) };
}

export function localDateInput(value = new Date()) {
  if (value === null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function subscriptionDateToISO(value, inclusiveEnd = false) {
  const date = parseLocalDate(value);
  if (!date) return null;
  // Calendar arithmetic keeps local midnight correct across daylight-saving changes.
  if (inclusiveEnd) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function subscriptionEndDateInput(exclusiveEnd) {
  if (!exclusiveEnd) return "";
  const timestamp = new Date(exclusiveEnd).getTime();
  return Number.isFinite(timestamp) ? localDateInput(new Date(timestamp - 1)) : "";
}

export function defaultSubscriptionEndDate(startDate, planCode) {
  const date = parseLocalDate(startDate);
  const months = SUBSCRIPTION_PLANS.find((plan) => plan.code === planCode)?.months;
  if (!date || !months) return "";
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  date.setDate(date.getDate() - 1);
  return localDateInput(date);
}

export function createSubscriptionForm(subscription, now = new Date()) {
  const planCode = SUBSCRIPTION_PLANS.some((plan) => plan.code === subscription?.planCode) ? subscription.planCode : "free";
  const startDate = localDateInput(subscription?.startsAt || now);
  return {
    planCode,
    startDate,
    endDate: subscription?.endsAt ? subscriptionEndDateInput(subscription.endsAt) : defaultSubscriptionEndDate(startDate, planCode),
    noEndDate: planCode !== "free" && Boolean(subscription?.startsAt) && !subscription?.endsAt,
    note: subscription?.note || "",
  };
}

export function subscriptionFormDates(form) {
  if (form.planCode === "free") return { startsAt: null, endsAt: null };
  const startsAt = subscriptionDateToISO(form.startDate);
  const endsAt = form.noEndDate ? null : subscriptionDateToISO(form.endDate, true);
  if (!startsAt || (!form.noEndDate && !endsAt)) throw new Error("Renseigne des dates valides pour cet abonnement.");
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new Error("La date de fin doit être égale ou postérieure à la date de début.");
  return { startsAt, endsAt };
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
export function subscriptionPeriodLabel(subscription) {
  const start = subscription?.startsAt && new Date(subscription.startsAt);
  if (!start || !Number.isFinite(start.getTime())) return "Aucune période payante";
  const end = subscription.endsAt && new Date(new Date(subscription.endsAt).getTime() - 1);
  return `Du ${dateFormat.format(start)}${end && Number.isFinite(end.getTime()) ? ` au ${dateFormat.format(end)} inclus` : " · sans date de fin"}`;
}
