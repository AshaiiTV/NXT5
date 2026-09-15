const countFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const audienceNumber = (value) => countFormat.format(finiteNumber(value));
export const audienceDecimal = (value) => decimalFormat.format(finiteNumber(value));
export const audiencePercent = (value) => `${audienceDecimal(value)} %`;

export function audienceDuration(value) {
  const seconds = Math.max(0, Math.round(finiteNumber(value)));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}

export function audienceDate(value, { short = false, time = false } = {}) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC", day: "numeric", month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }), ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

/** Rates compare in percentage points; a zero baseline has no relative growth. */
export function audienceDelta(current, previous, { percentage = false, lowerIsBetter = false } = {}) {
  if (previous == null || current == null || !Number.isFinite(Number(previous)) || !Number.isFinite(Number(current))) {
    return { label: "Comparaison indisponible", tone: "neutral" };
  }
  const change = Number(current) - Number(previous);
  if (!change) return { label: "Stable", tone: "neutral" };
  if (!percentage && Number(previous) === 0) return { label: "Sans base de comparaison", tone: "neutral" };
  const difference = percentage ? change : change / Math.abs(Number(previous)) * 100;
  return {
    label: `${difference > 0 ? "+" : "−"}${audienceDecimal(Math.abs(difference))}${percentage ? " pt" : " %"}`,
    tone: (change > 0) !== lowerIsBetter ? "positive" : "negative",
  };
}

export function audienceShare(value, total) {
  return finiteNumber(total) > 0 ? Math.min(100, Math.max(0, finiteNumber(value) / finiteNumber(total) * 100)) : 0;
}

export const SOURCE_LABELS = {
  direct: "Direct / inconnu", organic: "Recherche naturelle", search: "Moteur de recherche",
  social: "Réseaux sociaux", referral: "Site référent", email: "E-mail", paid: "Publicité", unknown: "Inconnu",
};
export const DEVICE_LABELS = { desktop: "Ordinateur", mobile: "Mobile", tablet: "Tablette", unknown: "Inconnu" };
export const GOAL_LABELS = { signup: "Compte créé", login: "Connexion réussie", access_request: "Demande d’accès envoyée", pricing_view: "Tarifs consultés" };
export const sourceLabel = (value) => SOURCE_LABELS[value] || value || "Direct / inconnu";

export function countryLabel(value) {
  if (!value || value === "unknown" || value === "XX") return "Non déterminé";
  if (!/^[a-z]{2}$/i.test(value)) return value;
  try { return new Intl.DisplayNames(["fr"], { type: "region" }).of(value.toUpperCase()) || value; }
  catch { return value; }
}

export function selectAudiencePages(rows = [], { search = "", sort = "views" } = {}) {
  const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const needle = normalize(search.trim());
  const numericFields = new Set(["views", "visitors", "avgDurationSeconds", "exits"]);
  return rows.filter((row) => normalize(row.path || "").includes(needle)).sort((a, b) => {
    if (numericFields.has(sort)) {
      const difference = finiteNumber(b[sort]) - finiteNumber(a[sort]);
      if (difference) return difference;
    }
    return String(a.path || "").localeCompare(String(b.path || ""), "fr");
  });
}

/** CSV values are quoted, and spreadsheet formula prefixes are neutralized. */
export function audienceCsvCell(value) {
  const raw = value == null ? "" : String(value);
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) || /^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function audienceCsv(report, filters = {}) {
  const rows = [["Début UTC", "Fin UTC", "Appareil filtré", "Source filtrée", "Vue", "Dimension", "Mesure", "Valeur"]];
  const add = (view, dimension, metric, value, period = report.period) => rows.push([
    period?.from || "", period?.to || "", filters.device || "all", filters.source || "all", view, dimension, metric, value,
  ]);
  const totals = {
    visitors: "Navigateurs distincts", sessions: "Sessions", pageviews: "Pages vues", engagedSessions: "Sessions engagées",
    engagementRate: "Engagement (%)", avgDurationSeconds: "Temps actif moyen par session (s)", pagesPerSession: "Pages par session",
    conversions: "Sessions converties", conversionRate: "Conversion (%)", bounceRate: "Rebond (%)", returningVisitors: "Navigateurs revenus",
  };
  Object.entries(totals).forEach(([key, label]) => {
    add("Synthèse", "Période sélectionnée", label, report.totals?.[key]);
    add("Comparaison", "Période précédente", label, report.previous?.[key], report.comparison);
  });
  for (const day of report.timeseries || []) for (const key of ["visitors", "sessions", "pageviews", "conversions"]) add("Évolution quotidienne", day.date, totals[key], day[key]);
  for (const page of report.pages || []) for (const [key, label] of Object.entries({ views: "Pages vues", visitors: "Navigateurs distincts", avgDurationSeconds: "Temps actif moyen par vue (s)", exits: "Sorties" })) add("Pages", page.path, label, page[key]);
  for (const source of report.sources || []) for (const key of ["sessions", "visitors", "conversions"]) add("Acquisition", source.source, totals[key], source[key]);
  for (const campaign of report.campaigns || []) for (const key of ["sessions", "conversions"]) add("Campagnes UTM", `${campaign.source || ""} / ${campaign.medium || ""} / ${campaign.campaign || ""}`, totals[key], campaign[key]);
  for (const [list, key, label] of [["devices", "device", "Appareils"], ["browsers", "browser", "Navigateurs"], ["countries", "country", "Pays"]]) {
    for (const entry of report[list] || []) add(label, entry[key], "Sessions", entry.sessions);
  }
  for (const goal of report.goals || []) for (const [key, label] of Object.entries({ events: "Événements", sessions: "Sessions concernées", conversionRate: "Part des sessions (%)" })) add("Objectifs", GOAL_LABELS[goal.name] || goal.name, label, goal[key]);
  for (const hour of report.heatmap || []) add("Activité horaire", `Jour ${hour.weekday} (0=dimanche), ${hour.hour} h UTC`, "Pages vues", hour.pageviews);
  add("Temps réel", `${report.realtime?.windowMinutes || 5} dernières minutes`, "Navigateurs distincts", report.realtime?.visitors);
  return `\uFEFF${rows.map((row) => row.map(audienceCsvCell).join(";")).join("\r\n")}\r\n`;
}

export function isAudienceReport(value) {
  return Boolean(value && value.period && value.totals && Number.isFinite(Number(value.totals.sessions)) && Array.isArray(value.timeseries) && Array.isArray(value.pages));
}
