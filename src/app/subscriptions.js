import { DISCOVERY_TRIAL_DAYS } from "./pass-access.js";
import { PROPOSED_PLANS } from "./pricing.js";

// Manual grades use the same current catalogue as the Tarifs page.
export const SUBSCRIPTION_PLANS = PROPOSED_PLANS.map(({ code, name, days, months }) => ({ code, label: name, days, months }));

const LEGACY_PLAN_LABELS = { team_season: "Pass Saison (ancienne offre)", structure: "Pass Structure (ancienne offre)" };
export function getSubscriptionPlanLabel(planCode) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.code === planCode)?.label || LEGACY_PLAN_LABELS[planCode] || "Formule inconnue";
}

export const SUBSCRIPTION_UPDATED_EVENT = "nxt5:subscription-updated";

export function notifySubscriptionUpdated() {
  globalThis.window?.dispatchEvent?.(new Event(SUBSCRIPTION_UPDATED_EVENT));
}

const STATUS_PRESENTATIONS = {
  none: { statusLabel: "Sans abonnement", tone: "slate" },
  pending: { statusLabel: "Essai non démarré", tone: "cyan" },
  scheduled: { statusLabel: "À venir", tone: "purple" },
  active: { statusLabel: "Actif", tone: "green" },
  expired: { statusLabel: "Expiré", tone: "yellow" },
  revoked: { statusLabel: "Retiré", tone: "slate" },
};

export function getSubscriptionPresentation(subscription) {
  if (!subscription || subscription.status === "none") return { label: "Sans abonnement", ...STATUS_PRESENTATIONS.none };
  const presentation = STATUS_PRESENTATIONS[subscription.status] || STATUS_PRESENTATIONS.none;
  const discoveryStatus = subscription.planCode === "free" && ({ active: "Essai en cours", expired: "Essai terminé" })[subscription.status];
  return { label: getSubscriptionPlanLabel(subscription.planCode), ...presentation, ...(discoveryStatus ? { statusLabel: discoveryStatus } : {}) };
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
  if (date && planCode === "free") return localDateInput(new Date(date.getTime() + DISCOVERY_TRIAL_DAYS * 86400000 - 1));
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
  const planCode = LEGACY_PLAN_LABELS[subscription?.planCode] ? "team_monthly" : SUBSCRIPTION_PLANS.some((plan) => plan.code === subscription?.planCode) ? subscription.planCode : "free";
  const startDate = localDateInput(subscription?.startsAt || now);
  const endDate = subscription?.endsAt ? subscriptionEndDateInput(subscription.endsAt) : defaultSubscriptionEndDate(startDate, planCode);
  return {
    planCode,
    startDate,
    endDate,
    startTrial: planCode === "free" && Boolean(subscription?.startsAt),
    noEndDate: planCode !== "free" && Boolean(subscription?.startsAt) && !subscription?.endsAt,
    note: subscription?.note || "",
    // Preserve exact instants when only a note changes; date inputs must not truncate history.
    sourceStartsAt: subscription?.startsAt || null,
    sourceEndsAt: subscription?.endsAt || null,
    sourceStartDate: startDate,
    sourceEndDate: endDate,
  };
}

export function subscriptionFormDates(form) {
  if (!SUBSCRIPTION_PLANS.some((plan) => plan.code === form.planCode)) throw new Error("Choisis Découverte ou Pass Équipe.");
  if (form.planCode === "free" && !form.startTrial) return { startsAt: null, endsAt: null };
  const startsAt = form.sourceStartsAt && form.sourceStartDate === form.startDate ? form.sourceStartsAt : subscriptionDateToISO(form.startDate);
  if (!startsAt || !Number.isFinite(Date.parse(startsAt))) throw new Error("Renseigne une date de début valide.");
  if (form.planCode === "free") return { startsAt, endsAt: new Date(Date.parse(startsAt) + DISCOVERY_TRIAL_DAYS * 86400000).toISOString() };
  const endsAt = form.noEndDate ? null : form.sourceEndsAt && form.sourceEndDate === form.endDate ? form.sourceEndsAt : subscriptionDateToISO(form.endDate, true);
  if (!startsAt || (!form.noEndDate && !endsAt)) throw new Error("Renseigne des dates valides pour cet abonnement.");
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new Error("La date de fin doit être égale ou postérieure à la date de début.");
  return { startsAt, endsAt };
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const trialDateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
export function subscriptionPeriodLabel(subscription) {
  const start = subscription?.startsAt && new Date(subscription.startsAt);
  if (!start || !Number.isFinite(start.getTime())) return subscription?.planCode === "free" && subscription?.status !== "none" ? `${DISCOVERY_TRIAL_DAYS} jours d’accès complet · essai non démarré` : "Aucune période attribuée";
  if (subscription?.planCode === "free") {
    const end = subscription.endsAt && new Date(subscription.endsAt);
    return `${DISCOVERY_TRIAL_DAYS} jours · du ${trialDateFormat.format(start)}${end && Number.isFinite(end.getTime()) ? ` au ${trialDateFormat.format(end)}` : ""}`;
  }
  const end = subscription.endsAt && new Date(new Date(subscription.endsAt).getTime() - 1);
  return `Du ${dateFormat.format(start)}${end && Number.isFinite(end.getTime()) ? ` au ${dateFormat.format(end)} inclus` : " · sans date de fin"}`;
}
