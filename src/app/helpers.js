import { REMEMBER_ME_STORAGE_KEY } from "./constants.jsx";

export function formatUploadSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)} Mo`;
  if (value >= 1000) return `${Math.round(value / 1000)} Ko`;
  return `${Math.round(value)} o`;
}

export function formatRetryAfter(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return "quelques instants";
  if (value < 60) return `${Math.ceil(value)} seconde${value > 1 ? "s" : ""}`;
  const minutes = Math.ceil(value / 60);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

function errorDetailsLine(err) {
  const details = Array.isArray(err?.details) ? err.details.filter(Boolean) : [];
  if (!details.length) return "";
  const clean = details
    .map((detail) => String(detail).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2);
  return clean.length ? ` Détail Riot: ${clean.join(" | ")}` : "";
}

export function preciseErrorText(err, context = "generic") {
  const message = String(err?.message || "").trim();
  const code = err?.code;
  const missing = Array.isArray(err?.missing) ? err.missing.join(", ") : "";
  const status = Number(err?.status || 0);

  if (code === "RIOT_KEY_MISSING") return "RIOT_API_KEY manque dans Netlify. Ajoute la variable dans Site configuration > Environment variables, puis redeploy le site.";
  if (code === "RIOT_KEY_REJECTED") return `La clé Riot est refusée${err?.riotStatus ? ` (Riot ${err.riotStatus})` : ""}. Remplace RIOT_API_KEY par une clé valide, vérifie qu’elle n’est pas expirée, puis redeploy.`;
  if (code === "RIOT_RATE_LIMIT") return `Riot bloque temporairement les requêtes. Réessaie dans ${formatRetryAfter(err?.retryAfter)}; si ça revient souvent, attends avant de relancer toute la team.`;
  if (code === "RIOT_API_ERROR") return `Riot renvoie une erreur API${err?.riotStatus ? ` ${err.riotStatus}` : ""}. Vérifie la région, la clé et réessaie après quelques minutes. Message brut: ${message || "non fourni"}`;
  if (code === "NXT5_IMPORT_FILE_INVALID") return `${message} Génère le fichier avec l’outil NXT5 local, ou importe un JSON Match-V5 complet contenant info.participants et info.teams.`;
  if (code === "EMAIL_NOT_CONFIGURED") return "L’envoi d’e-mail n’est pas configuré côté Netlify. Vérifie RESEND_API_KEY, RESET_EMAIL_FROM et redéploie le site.";
  if (code === "EMAIL_DELIVERY_FAILED") return message || "Resend refuse l’envoi de l’e-mail. Vérifie la clé Resend, le domaine d’envoi et l’adresse expéditrice.";
  if (code === "EMAIL_VERIFY_RATE_LIMIT") return `Un lien vient déjà d’être généré. Réessaie dans ${formatRetryAfter(err?.retryAfter)}.`;

  if (/Format Game ID invalide/i.test(message)) return "Format Game ID invalide. Mets un ID du type EUW1_7123456789, ou colle l’ID numérique avec le bon serveur sélectionné.";
  if (/Game ID requis/i.test(message)) return "Colle un Game ID Riot avant d’importer.";
  if (/Team ID requis|Team introuvable/i.test(message)) return "Aucune équipe active n’est reliée à cet import. Sélectionne ou crée une équipe, puis réessaie.";
  if (/roster avant d.importer/i.test(message)) return "Ajoute au moins un profil joueur dans la page Équipe avant d’importer une game.";
  if (/Aucun joueur du roster/i.test(message)) return "La game a été trouvée, mais aucun participant ne correspond au roster. Choisis le side de ton équipe puis associe chaque champion au bon profil NXT5 avant l’import.";

  if (context === "match-import" && status === 404) return "Riot ne trouve pas cette game. Vérifie le Game ID, la région du préfixe (EUW1, NA1, KR...) ou attends quelques minutes après la fin de la partie.";
  if (context === "match-import" && status === 403) return "Ton compte n’a pas accès à cette équipe pour importer une game. Vérifie que tu es bien membre de la team.";
  if (status === 502 || status === 503) return `${message || "Service temporairement indisponible."} Vérifie les variables Netlify et redeploy si tu viens de les modifier.`;
  if (missing) return `${message || "Information manquante."} Champs manquants: ${missing}.${errorDetailsLine(err)}`;

  return message || "Erreur inconnue. Réessaie, puis vérifie les variables Netlify si le problème revient.";
}

export function errorToast(err, title, context) {
  return { type: "red", title, text: preciseErrorText(err, context) };
}

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function readRememberPreference() {
  try {
    return window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function writeRememberPreference(value) {
  try {
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, value ? "true" : "false");
  } catch {}
}

export function tone(t) {
  return {
    slate: "border-slate-200/16 bg-white/[0.055] text-slate-100",
    cyan: "border-cyan-200/45 bg-cyan-300/14 text-cyan-50 shadow-cyan-400/24",
    purple: "border-violet-200/40 bg-violet-400/14 text-violet-50 shadow-violet-400/20",
    pink: "border-fuchsia-200/42 bg-fuchsia-400/14 text-fuchsia-50 shadow-fuchsia-400/22",
    orange: "border-fuchsia-200/42 bg-fuchsia-400/14 text-fuchsia-50 shadow-fuchsia-400/22",
    green: "border-emerald-200/32 bg-emerald-400/12 text-emerald-50 shadow-emerald-400/16",
    yellow: "border-amber-200/40 bg-amber-300/14 text-amber-50 shadow-amber-400/18",
    red: "border-rose-200/35 bg-rose-400/12 text-rose-50 shadow-rose-400/16",
    blue: "border-sky-200/38 bg-sky-400/14 text-sky-50 shadow-sky-400/18",
  }[t || "slate"];
}

export function profileStatusLabel(member) {
  const role = String(member?.role || "").toLowerCase();
  if (role === "owner") return "Owner";
  if (role === "captain") return "Capitaine";
  if (role === "coach") return "Coach";
  if (role === "assistant") return "Assistant coach";
  if (role === "analyst") return "Analyste";
  if (role === "manager") return "Manager";
  if (role === "board") return "Board";
  return "Joueur";
}

export function profileStatusTone(member) {
  const role = String(member?.role || "").toLowerCase();
  if (role === "owner") return "green";
  if (role === "captain") return "yellow";
  if (role === "coach") return "purple";
  if (role === "assistant") return "purple";
  if (role === "analyst") return "cyan";
  if (role === "manager") return "pink";
  if (role === "board") return "orange";
  return "blue";
}
