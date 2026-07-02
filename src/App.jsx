import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Crown,
  Download,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Gauge,
  Image as ImageIcon,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  CalendarDays,
  Target,
  Trash2,
  Trophy,
  UserPlus,
  UserMinus,
  Users,
  Upload,
  Wand2,
  X,
} from "lucide-react";

const API_BASE = "/.netlify/functions";
const NXT5_IMPORTER_VERSION = "0.2.10";
const NXT5_IMPORTER_RELEASE_URL = "https://github.com/AshaiiTV/NXT5/releases/download/nxt5-match-exporter-latest";
const NXT5_IMPORTER_WINDOWS_URL = `${NXT5_IMPORTER_RELEASE_URL}/NXT5-Importer-Windows-${NXT5_IMPORTER_VERSION}.exe`;
const NXT5_IMPORTER_MAC_URL = `${NXT5_IMPORTER_RELEASE_URL}/NXT5-Importer-Mac-arm64-${NXT5_IMPORTER_VERSION}.zip`;

const NAV = [
  { id: "teams", label: "Équipe", icon: Users, shortcut: "T", path: "/equipes" },
  { id: "matches", label: "Games & review", icon: Swords, shortcut: "G", path: "/integration" },
  { id: "stats", label: "Statistiques", icon: BarChart3, shortcut: "S", path: "/statistiques" },
  { id: "trends", label: "Tendances", icon: Activity, shortcut: "N", path: "/tendances" },
  { id: "champions", label: "Champion Pool", icon: Crown, shortcut: "C", path: "/champion-pool" },
  { id: "planning", label: "Planning", icon: CalendarDays, shortcut: "L", path: "/planning" },
  { id: "compositions", label: "Compos Types", icon: Sparkles, shortcut: "V", path: "/compositions-types" },
  { id: "reports", label: "Review", icon: FileText, shortcut: "R", path: "/rapports" },
  { id: "guide", label: "Guide", icon: BookOpen, shortcut: "A", path: "/guide" },
  { id: "profile", label: "Profil", icon: Activity, shortcut: "P", path: "/mon-profil" },
  { id: "account-settings", label: "Paramètres", icon: Settings, shortcut: "P", path: "/parametres", hidden: true },
  { id: "team-management", label: "Gestion équipe", icon: Settings, shortcut: "G", path: "/gestion-equipe", hidden: true },];

const PRIMARY_NAV_IDS = ["teams", "matches", "champions", "planning", "profile"];
const MORE_NAV_IDS = ["trends", "compositions"];
const PROFILE_VIEW_ROUTES = [
  { id: "overview", label: "Synthèse", path: "" },
  { id: "champions", label: "Champions", path: "champions" },
  { id: "pool", label: "Pool", path: "pool" },
  { id: "history", label: "Historique", path: "historique" },
  { id: "coaching", label: "Coaching", path: "coaching" },
];

const AUTH_ROUTES = {
  "/connexion": "login",
  "/creer-un-compte": "register",
  "/inscription": "register",
};

const PUBLIC_ROUTES = ["/", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/verify-email", "/verified", "/mentions-legales", "/confidentialite", "/conditions", "/contact"];
const AUTH_PATHS = Object.keys(AUTH_ROUTES);
const REMEMBER_ME_STORAGE_KEY = "nxt5_remember_me";
const DISCORD_INVITE_URL = "https://discord.gg/esPcQAeNWu";

function assetProxyUrl(url) {
  return url ? `/.netlify/functions/asset-proxy?url=${encodeURIComponent(url)}` : "";
}
const PLANNING_DAYS = [
  ["MON", "Lun"],
  ["TUE", "Mar"],
  ["WED", "Mer"],
  ["THU", "Jeu"],
  ["FRI", "Ven"],
  ["SAT", "Sam"],
  ["SUN", "Dim"],
];
const PLANNING_EVENT_TYPES = [
  { id: "scrim", label: "Scrim", dot: "bg-fuchsia-100 shadow-[0_0_16px_rgba(240,171,252,.92)]", cell: "bg-[#2a123f] text-fuchsia-50 shadow-[inset_0_0_0_1px_rgba(240,171,252,.28),inset_0_0_24px_rgba(217,70,239,.18)]" },
  { id: "match", label: "Match", dot: "bg-emerald-200 shadow-[0_0_12px_rgba(167,243,208,.72)]", cell: "bg-[#0e3329] text-emerald-50 shadow-[inset_0_0_0_1px_rgba(110,231,183,.2)]" },
  { id: "review", label: "Review", dot: "bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,.72)]", cell: "bg-[#3a2b10] text-amber-50 shadow-[inset_0_0_0_1px_rgba(253,230,138,.2)]" },
];

function cleanOpponentName(value) {
  const text = String(value || "").trim();
  return /^(enemy team|adversaire inconnu)$/i.test(text) ? "" : text;
}

function opponentLabelFromParticipants(match) {
  const names = (match?.participants || [])
    .filter((row) => row.team_key === "ENEMY")
    .map((row) => row.summoner_name || row.riot_id)
    .map((name) => String(name || "").split("#")[0].trim())
    .filter(Boolean);
  if (!names.length) return "";
  if (names.length <= 2) return names.join(" / ");
  return `${names.slice(0, 2).join(" / ")} +${names.length - 2}`;
}

function matchDisplayName(match, fallback = "Game") {
  return cleanOpponentName(match?.raw?.nxt5Label) || cleanOpponentName(match?.opponent) || opponentLabelFromParticipants(match) || match?.game_id || fallback;
}

function matchCategoryIds(match) {
  const ids = Array.isArray(match?.category_ids) ? match.category_ids : [];
  const combined = [...ids, match?.category_id].map((id) => String(id || "").trim()).filter(Boolean);
  return [...new Set(combined)];
}

function matchHasCategory(match, categoryId) {
  if (!categoryId) return true;
  return matchCategoryIds(match).some((id) => String(id) === String(categoryId));
}

function opponentRoleRow(match, role, participantId = 0) {
  const enemies = (match?.participants || []).filter((row) => row.team_key === "ENEMY");
  const wantedRole = String(role || "").toUpperCase();
  const order = ["TOP", "JGL", "MID", "ADC", "SUP"];
  return enemies.find((item) => String(item.role || "").toUpperCase() === wantedRole)
    || enemies.find((item) => Number(item.raw?.participantId || item.participantId || 0) === Number(participantId || 0) + 5)
    || enemies[Math.max(0, order.indexOf(wantedRole))] || null;
}
const PLANNING_TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];

function normalizePath(pathname = "/") {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function pageFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path === "/statistiques" || path === "/rapports") return "matches";
  if (path === "/mon-profil" || path.startsWith("/mon-profil/")) return "profile";
  return NAV.find((item) => item.path === path)?.id || "teams";
}

function pathFromPage(pageId) {
  return NAV.find((item) => item.id === pageId)?.path || "/equipes";
}

function profileViewFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path !== "/mon-profil" && !path.startsWith("/mon-profil/")) return "overview";
  const slug = path.replace(/^\/mon-profil\/?/, "").split("/").filter(Boolean)[0] || "";
  if (["builds", "matchups"].includes(slug)) return "champions";
  return PROFILE_VIEW_ROUTES.find((item) => item.path === slug)?.id || "overview";
}

function profilePathFromView(viewId = "overview") {
  const view = PROFILE_VIEW_ROUTES.find((item) => item.id === viewId) || PROFILE_VIEW_ROUTES[0];
  return view.path ? `/mon-profil/${view.path}` : "/mon-profil";
}

function profileViewLabel(viewId = "overview") {
  return PROFILE_VIEW_ROUTES.find((item) => item.id === viewId)?.label || PROFILE_VIEW_ROUTES[0].label;
}

function gameWorkspaceSectionFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path === "/statistiques") return "stats";
  if (path === "/rapports") return "review";
  return "import";
}

function gameWorkspaceSectionLabel(sectionId = "import") {
  return { import: "Importer", stats: "Stats", review: "Review" }[sectionId] || "Importer";
}

function authModeFromPath(pathname = window.location.pathname) {
  return AUTH_ROUTES[normalizePath(pathname)] || null;
}

function isAppPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path === "/mon-profil" || path.startsWith("/mon-profil/")) return true;
  return NAV.some((item) => item.path === path);
}

function isKnownPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  return PUBLIC_ROUTES.includes(path) || AUTH_PATHS.includes(path) || isAppPath(path);
}

function isSafeInternalPath(path = "") {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function buildLoginRedirect(path, search = "") {
  const target = `${path}${search || ""}`;
  return `/connexion?next=${encodeURIComponent(target)}`;
}

function readRoute() {
  return { path: normalizePath(window.location.pathname), search: window.location.search };
}

function openAppPath(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const DEFAULT_DATA = {
  teams: [],
  teamMembers: [],
  players: [],
  availability: [],
  matches: [],
  championPool: [],
  compositions: [],
  improvements: [],
  reports: [],
  matchArchives: [],
  matchCategories: [],
  inviteCodes: [],
  profileCoachingNotes: [],
};

async function apiFetch(path, options = {}) {
  let response;
  try {
    const url = String(path || "").startsWith("/") ? path : `${API_BASE}/${path}`;
    response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw new Error("Impossible de joindre NXT5 pour le moment. Réessaie dans quelques instants.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const fallback = response.status === 502 || response.status === 503
      ?"Service temporairement indisponible. Réessaie quand le site est prêt."
      : `Erreur ${response.status}.`;
    const error = new Error(payload?.error || fallback);
    error.status = response.status;
    error.code = payload?.code || null;
    error.retryAfter = payload?.retryAfter || null;
    error.riotStatus = payload?.riotStatus || null;
    error.missing = payload?.missing || null;
    error.details = payload?.details || null;
    throw error;
  }

  return payload;
}

function apiUploadJson(path, data, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress?.({ phase: "upload", percent, loaded: event.loaded, total: event.total });
    };
    xhr.upload.onload = () => onProgress?.({ phase: "server", percent: 100 });
    xhr.onerror = () => reject(new Error("Impossible de joindre NXT5 pour le moment. Réessaie dans quelques instants."));
    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const fallback = xhr.status === 502 || xhr.status === 503
          ?"Service temporairement indisponible. Réessaie quand le site est prêt."
          : `Erreur ${xhr.status}.`;
        const error = new Error(payload?.error || fallback);
        error.status = xhr.status;
        error.code = payload?.code || null;
        error.retryAfter = payload?.retryAfter || null;
        error.riotStatus = payload?.riotStatus || null;
        error.missing = payload?.missing || null;
        error.details = payload?.details || null;
        reject(error);
        return;
      }
      resolve(payload);
    };

    onProgress?.({ phase: "upload", percent: 0, loaded: 0, total: 0 });
    xhr.send(JSON.stringify(data));
  });
}

function formatUploadSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)} Mo`;
  if (value >= 1000) return `${Math.round(value / 1000)} Ko`;
  return `${Math.round(value)} o`;
}

function formatRetryAfter(seconds) {
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

function preciseErrorText(err, context = "generic") {
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

  return message || "Erreur inconnue. Réessaie, puis vérifie les variables Netlify si le problème revient.";
}

function errorToast(err, title, context) {
  return { type: "red", title, text: preciseErrorText(err, context) };
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function readRememberPreference() {
  try {
    return window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeRememberPreference(value) {
  try {
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, value ? "true" : "false");
  } catch {}
}

function tone(t) {
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

function profileStatusLabel(member) {
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

function profileStatusTone(member) {
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

function Badge({ children, tone: t = "slate", pulse = false, className = "", ...props }) {
  return (
    <span {...props} className={cx("inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 text-left text-[0.64rem] font-black uppercase leading-4 tracking-[0.08em] whitespace-normal", tone(t), className)}>
      {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#020511]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(0,216,255,.24),transparent_28%),radial-gradient(circle_at_84%_8%,rgba(217,0,255,.19),transparent_30%),linear-gradient(118deg,rgba(16,76,190,.22)_0%,transparent_24%,transparent_66%,rgba(0,238,255,.14)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.048)_1px,transparent_1px)] bg-[size:54px_54px] opacity-[0.22]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(123deg,transparent_0,transparent_132px,rgba(0,216,255,.15)_133px,transparent_136px),repeating-linear-gradient(123deg,transparent_0,transparent_214px,rgba(217,0,255,.13)_215px,transparent_218px)]" />
      <div className="absolute left-[7%] top-[12%] h-[42rem] w-[42rem] rounded-full border border-cyan-300/10 shadow-[0_0_110px_rgba(0,216,255,.14)]" />
      <div className="absolute right-[9%] top-[10%] h-[31rem] w-[31rem] rounded-full border border-fuchsia-300/10 shadow-[0_0_110px_rgba(217,0,255,.12)]" />
      <div className="absolute left-[-12%] top-[30%] h-px w-[130%] rotate-[-13deg] bg-gradient-to-r from-transparent via-cyan-200/18 to-transparent" />
      <div className="absolute left-[-12%] top-[72%] h-px w-[130%] rotate-[-13deg] bg-gradient-to-r from-transparent via-fuchsia-200/16 to-transparent" />
      <motion.div animate={{ x: ["-14%", "118%"] }} transition={{ duration: 7.2, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }} className="absolute top-[17%] h-px w-[42vw] rotate-[-13deg] bg-gradient-to-r from-transparent via-cyan-100 to-transparent shadow-[0_0_34px_rgba(34,211,238,.82)]" />
      <motion.div animate={{ x: ["118%", "-18%"] }} transition={{ duration: 8.6, repeat: Infinity, repeatDelay: 3.6, ease: "easeInOut" }} className="absolute top-[61%] h-px w-[48vw] rotate-[-13deg] bg-gradient-to-r from-transparent via-fuchsia-100 to-transparent shadow-[0_0_34px_rgba(217,70,239,.76)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(2,5,17,.08)_42%,rgba(2,5,17,.94)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/80 to-fuchsia-100/70" />
    </div>
  );
}

function Surface({ children, className = "", delay = 0, glow = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.34, delay, ease: "easeOut" }}
      className={cx(
        "nxt5-panel nxt5-premium-panel group relative max-w-full overflow-hidden border border-cyan-200/18 p-4 backdrop-blur-2xl transition duration-300 sm:p-4",
        glow && "border-cyan-200/24 shadow-[0_0_26px_rgba(34,211,238,.075),0_18px_54px_rgba(0,0,0,.38)] hover:border-cyan-200/34",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-fuchsia-100/45" />
      <div className="pointer-events-none absolute bottom-0 left-5 z-[1] h-px w-20 bg-gradient-to-r from-cyan-300/55 to-transparent" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function Button({ children, icon: Icon, variant = "primary", className = "", disabled = false, ...props }) {
  const base = "nxt5-cyber-button inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-black leading-5 transition duration-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "border border-cyan-100/36 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(34,211,238,.32)] hover:-translate-y-0.5 hover:saturate-150 hover:shadow-[0_0_46px_rgba(217,70,239,.28)]",
    ghost: "border border-cyan-100/16 bg-[#071221]/72 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.11] hover:text-white hover:shadow-[0_0_28px_rgba(34,211,238,.14)]",
    danger: "border border-rose-300/28 bg-rose-500/12 text-rose-100 hover:-translate-y-0.5 hover:bg-rose-500/18 hover:shadow-[0_0_28px_rgba(244,63,94,.14)]",
  };
  return (
    <button disabled={disabled} className={cx(base, variants[variant], className)} {...props}>
      {Icon && <Icon className={cx("h-4 w-4 shrink-0", Icon === Loader2 && "animate-spin")} />}
      {children}
    </button>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text", required = false, icon: Icon, disabled = false }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && passwordVisible ? "text" : type;
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/75" />}
        <input type={inputType} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} disabled={disabled} className={cx("nxt5-input-shell w-full rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:bg-[#050914]/88 focus:ring-4 focus:ring-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-60", Icon && "pl-10", isPassword && "pr-12")} />
        {isPassword && <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} disabled={disabled} aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-2.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">{passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
      </div>
    </label>
  );
}

function TextAreaInput({ label, value, onChange, placeholder, icon: Icon, rows = 4 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-cyan-200/75" />}
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className={cx("nxt5-input-shell w-full resize-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:bg-[#050914]/88 focus:ring-4 focus:ring-cyan-300/12", Icon && "pl-10")} />
      </div>
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="nxt5-input-shell w-full appearance-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 pr-10 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/65 focus:ring-4 focus:ring-cyan-300/12">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
      </div>
    </label>
  );
}

function PremiumToggle({ checked, onChange, title, text }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cx("group flex w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition", checked ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,.10)]" : "border-white/10 bg-black/[0.18] hover:border-cyan-300/20 hover:bg-white/[0.045]")}>
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{title}</span>
        {text && <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">{text}</span>}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full border transition", checked ? "border-cyan-200/45 bg-gradient-to-r from-cyan-400 to-fuchsia-500 shadow-[0_0_18px_rgba(34,211,238,.22)]" : "border-white/10 bg-white/[0.08]")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="nxt5-page-header mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2"><span className="h-px w-8 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-transparent" /><p className="text-[0.7rem] font-black uppercase tracking-[0.32em] text-cyan-100/85">{eyebrow}</p></div>
        <h2 className="nxt5-metal-text max-w-4xl break-words py-1 text-3xl font-black leading-[1.14] tracking-tight sm:text-4xl lg:text-5xl">{title}</h2>
        {subtitle && <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300 sm:text-base sm:leading-7">{subtitle}</p>}
      </div>
      {children && <div className="flex w-full min-w-0 flex-wrap gap-2 xl:w-auto xl:justify-end">{children}</div>}
    </div>
  );
}

function ToastStack({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-5 right-5 z-[80] space-y-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} className={cx("w-[min(92vw,380px)] rounded-3xl border p-4 shadow-2xl backdrop-blur-xl", tone(toast.type || "cyan"))}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-white/10 p-2">{toast.type === "red" ?<AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="font-black">{toast.title}</p>{toast.text && <p className="mt-1 whitespace-pre-line text-sm leading-5 opacity-80">{toast.text}</p>}</div>
              <button onClick={() => removeToast(toast.id)} className="rounded-xl p-1.5 opacity-70 hover:bg-white/10 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ icon: Icon = BarChart3, title, text, action }) {
  return (
    <div className="relative flex min-h-[190px] flex-col items-center justify-center overflow-hidden rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.018] p-5 text-center">
      <div className="absolute inset-0 bg-[linear-gradient(126deg,rgba(34,211,238,.10),transparent_38%,rgba(249,115,22,.06))]" />
      <div className="relative rounded-xl border border-white/10 bg-white/[0.05] p-3 text-cyan-100"><Icon className="h-5 w-5" /></div>
      <h3 className="relative mt-3 text-lg font-black text-white">{title}</h3>
      <p className="relative mt-2 max-w-xl text-sm leading-6 text-slate-400">{text}</p>
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

function metricSideMarkerMeta(marker) {
  const key = String(marker || "").toLowerCase();
  return {
    blue: { label: "Bleu", text: "< Bleu", tone: "cyan", canvasAccent: "cyan" },
    red: { label: "Rouge", text: "Rouge >", tone: "red", canvasAccent: "pink" },
    ally: { label: "NXT5", text: "NXT5 >", tone: "cyan", canvasAccent: "cyan" },
    enemy: { label: "ADV", text: "< ADV", tone: "red", canvasAccent: "pink" },
    tie: { label: "Égal", text: "Égal", tone: "slate", canvasAccent: "yellow" },
  }[key] || null;
}

function MetricSideMarker({ marker }) {
  const meta = metricSideMarkerMeta(marker);
  if (!meta) return null;
  return <span className={cx("inline-flex shrink-0 items-center rounded-lg border px-1.5 py-0.5 text-[0.56rem] font-black uppercase leading-none tracking-[0.08em]", tone(meta.tone))}>{meta.text}</span>;
}

function MetricCard({ icon: Icon, label, value, hint, tone: t = "purple", delay = 0, compact = false, sideMarker = "" }) {
  return (
    <Surface delay={delay} className={cx("overflow-hidden", compact ? "min-h-0 p-3" : "min-h-[104px] p-3 sm:p-4")}>
      <div className={cx("flex items-start justify-between", compact ? "gap-3" : "gap-4")}>
        <div className="min-w-0 flex-1"><div className="flex min-w-0 items-start justify-between gap-2"><p className={cx("min-w-0 font-black uppercase tracking-[0.12em] text-slate-300", compact ? "text-[0.62rem]" : "text-[0.68rem]")}>{label}</p><MetricSideMarker marker={sideMarker} /></div><p className={cx("break-words font-black text-white", compact ? "mt-1 text-xl sm:text-2xl" : "mt-1 text-2xl sm:text-3xl")}>{value ?? "-"}</p><p className={cx("line-clamp-2 font-semibold text-slate-300", compact ? "mt-1 text-[0.7rem] leading-4" : "mt-1 text-xs leading-5")}>{hint ?? "En attente de données"}</p></div>
        <div className={cx("shrink-0 rounded-xl border", compact ? "p-2" : "p-2.5", tone(t))}><Icon className={cx(compact ? "h-4 w-4" : "h-5 w-5")} /></div>
      </div>
    </Surface>
  );
}

function SkeletonRows({ count = 4 }) {
  return <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />)}</div>;
}


function BrandLogo({ compact = false, className = "" }) {
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <img
        src="/assets/nxt5-logo.png"
        alt="NXT5"
        className={cx(
          "object-contain drop-shadow-[0_0_30px_rgba(34,211,238,.36)]",
          compact ?"h-12 w-28 object-left" : "h-16 w-auto max-w-[220px] sm:max-w-[300px]"
        )}
      />
    </div>
  );
}

function Nxt5Wordmark({ className = "" }) {
  return <img src="/assets/nxt5-wordmark.png?v=3" alt="NXT5" className={cx("object-contain drop-shadow-[0_0_18px_rgba(34,211,238,.30)]", className)} />;
}

function MarketingPreview() {
  const metrics = [
    [Upload, "Intégration", "Importer les games"],
    [BarChart3, "Statistiques", "Lire le 5v5"],
    [Crown, "Compos", "Préparer le draft"],
    [FileText, "Review", "Structurer la review"],
  ];
  const lanes = [["TOP", "Pool"], ["JGL", "Tempo"], ["MID", "Setup"], ["ADC", "DPS"], ["SUP", "Vision"]];
  const axes = ["Vision", "Objectifs neutres", "Gold diff", "Builds"];

  return (
    <motion.div initial={{ opacity: 0, x: 28, rotateY: -9 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ duration: 0.75, delay: 0.1 }} className="relative hidden lg:block">
      <div className="absolute -inset-6 rounded-[1.6rem] bg-gradient-to-r from-cyan-400/34 via-blue-500/18 to-fuchsia-500/30 blur-2xl" />
      <div className="nxt5-panel nxt5-premium-panel relative overflow-hidden border border-cyan-200/25 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
        <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <BrandLogo compact />
          <div className="text-right">
            <p className="text-sm font-black text-white">Command center</p>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.2em] text-cyan-100/75">Draft · Review · Stats</p>
          </div>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-4 gap-3">
          {metrics.map(([Icon, label, text]) => (
            <div key={label} className="nxt5-panel relative overflow-hidden border border-white/10 bg-white/[0.045] p-4">
              <Icon className="h-5 w-5 text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.45)]" />
              <p className="mt-3 text-sm font-black text-white">{label}</p>
              <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.13em] text-slate-300">{text}</p>
            </div>
          ))}
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-[.86fr_1.14fr] gap-4">
          <div className="nxt5-panel border border-white/10 bg-black/[0.20] p-4">
            <p className="font-black text-white">Lecture 5v5</p>
            <p className="text-xs font-semibold text-slate-300">Blue side à gauche, red side à droite.</p>
            <div className="mt-4 space-y-2">
              {lanes.map(([role, focus], i) => (
                <div key={role} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <RoleIcon role={role} className="h-5 w-5" />
                  <span className="text-sm font-black text-white">{role}</span>
                  <Badge tone={i % 2 ? "purple" : "cyan"}>{focus}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="nxt5-panel border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">Données prêtes à lire</p>
            <p className="text-xs font-semibold text-slate-300">Le site expose les infos. Le coach garde l’interprétation.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {axes.map((a, i) => <div key={a} className="rounded-2xl border border-cyan-100/12 bg-black/[0.18] p-3"><div className={cx("mb-3 inline-flex rounded-xl border p-2", tone(i === 0 ? "cyan" : i === 1 ? "purple" : i === 2 ? "green" : "yellow"))}>{i === 0 ? <Eye className="h-4 w-4" /> : i === 1 ? <Target className="h-4 w-4" /> : i === 2 ? <Gauge className="h-4 w-4" /> : <Swords className="h-4 w-4" />}</div><p className="text-sm font-black text-white">{a}</p></div>)}
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-4 overflow-hidden rounded-2xl border border-cyan-200/16 bg-[#020511]/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-black text-white">Workflow NXT5</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100/75">Importer → assigner → analyser → review</p>
            </div>
            <Badge tone="pink">Next five</Badge>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {["JSON", "ROSTER", "STATS", "REPORT"].map((step, i) => <div key={step} className="relative rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-center text-[0.66rem] font-black tracking-[0.16em] text-white"><span className="block text-cyan-100/75">0{i + 1}</span>{step}</div>)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatStrip() {
  const stats = [
    [Crown, "Champion Pool", "Picks forts et picks pièges", "cyan"],
    [Swords, "Games importées", "KDA, dégâts, vision, objectifs", "purple"],
    [Target, "Axes de progrès", "Ce qu’il faut travailler", "green"],
    [Eye, "Vision & setup", "Avant dragons et Nashor", "blue"],
    [Flame, "Progression", "Game après game", "yellow"],
  ];
  return (
    <div className="nxt5-panel grid gap-3 border border-cyan-200/14 bg-[#050914]/72 p-4 shadow-[0_0_42px_rgba(34,211,238,.08)] backdrop-blur-2xl md:grid-cols-5">
      {stats.map(([Icon, value, label, t]) => <div key={value} className="flex items-center gap-3 border-white/10 p-3 transition hover:bg-white/[0.035] md:[&:not(:last-child)]:border-r"><div className={cx("rounded-2xl border p-3 shadow-[0_0_22px_rgba(34,211,238,.08)]", tone(t))}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-sm font-black text-white">{value}</p><p className="text-xs font-bold text-slate-300">{label}</p></div></div>)}
    </div>
  );
}

function LinkButton({ href, children, icon: Icon, variant = "primary", className = "", navigate }) {
  const base = "nxt5-cyber-button inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal px-4 py-2.5 text-center text-sm font-black leading-5 transition duration-200 active:translate-y-0";
  const variants = {
    primary: "border border-cyan-100/36 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(34,211,238,.32)] hover:-translate-y-0.5 hover:saturate-150 hover:shadow-[0_0_46px_rgba(217,70,239,.28)]",
    ghost: "border border-cyan-100/16 bg-[#071221]/72 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.11]",
  };

  function go(event) {
    if (!navigate || !isSafeInternalPath(href)) return;
    event.preventDefault();
    navigate(href);
  }

  return <a href={href} onClick={go} className={cx(base, variants[variant], className)}>{Icon && <Icon className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{children}</span></a>;
}

function SiteHeader({ children, navigate }) {
  function goHome(event) {
    if (!navigate) return;
    event.preventDefault();
    navigate("/");
  }

  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
      <a href="/" onClick={goHome} aria-label="Accueil NXT5" className="transition hover:opacity-90"><BrandLogo /></a>
      {children && <div className="nxt5-panel relative flex shrink-0 items-center gap-3 border border-cyan-200/12 bg-[#050914]/62 p-1.5 shadow-[0_0_32px_rgba(34,211,238,.08)] backdrop-blur-2xl">{children}</div>}
    </header>
  );
}

function LegalLinks({ navigate }) {
  const links = [
    ["/mentions-legales", "Mentions légales"],
    ["/confidentialite", "Confidentialité"],
    ["/conditions", "Conditions"],
    ["/contact", "Contact"],
  ];
  return <footer className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-8 text-xs font-bold text-slate-300">{links.map(([href, label]) => <LinkButton key={href} href={href} navigate={navigate} variant="ghost" className="border-transparent bg-transparent px-0 py-0 text-xs text-slate-300 shadow-none hover:translate-y-0 hover:border-transparent hover:bg-transparent hover:text-cyan-100">{label}</LinkButton>)}<span className="text-slate-300">NXT5 n’est pas affilié à Riot Games.</span></footer>;
}

const LEGAL_PAGES = {
  "/mentions-legales": {
    eyebrow: "Cadre légal",
    title: "Mentions légales",
    intro: "NXT5 est une plateforme indépendante destinée aux équipes League of Legends souhaitant organiser leurs profils, matchs, compositions, données d’import et reviews.",
    sections: [
      ["Éditeur du service", "Le service NXT5 est édité et maintenu par l’exploitant du projet NXT5. Les demandes relatives au service peuvent être adressées via les moyens de contact mis à disposition dans l’application ou sur les canaux officiels du projet."],
      ["Objet du site", "NXT5 propose des outils de gestion d’équipe, d’import de matchs, de consultation statistique, de préparation de compositions, de champion pool, de planning et de rédaction de reviews. Le service est réservé à un usage d’organisation, d’analyse et de suivi sportif par les utilisateurs autorisés."],
      ["Hébergement", "Le site est hébergé par Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, California 94104, États-Unis. Certains services techniques nécessaires au fonctionnement de l’application peuvent être opérés par des prestataires tiers spécialisés dans l’hébergement, la base de données, l’envoi d’e-mails transactionnels ou l’accès aux API utilisées par le service."],
      ["Propriété intellectuelle", "L’interface, l’identité NXT5, les textes, structures de pages et éléments propres au service sont protégés par les règles applicables à la propriété intellectuelle. Toute reproduction, extraction ou réutilisation substantielle sans autorisation préalable est interdite, sauf usage strictement personnel dans le cadre normal du service."],
      ["Riot Games", "NXT5 n’est pas approuvé, sponsorisé, validé ni affilié à Riot Games. League of Legends, Riot Games et les éléments associés appartiennent à Riot Games, Inc. Les données issues de l’écosystème Riot sont utilisées dans le respect des conditions applicables aux développeurs et uniquement pour les fonctionnalités proposées aux équipes."],
      ["Responsabilité", "NXT5 met à disposition des outils de consultation et d’organisation. Les décisions sportives, choix de draft, interprétations de données, reviews, contenus et usages effectués par les équipes relèvent de la responsabilité exclusive des utilisateurs concernés."],
      ["Mise à jour", "Les présentes mentions peuvent être modifiées afin de tenir compte de l’évolution du service, de ses fonctionnalités ou du cadre réglementaire applicable. Dernière mise à jour : 27 mai 2026."],
    ],
  },
  "/confidentialite": {
    eyebrow: "Données",
    title: "Politique de confidentialité",
    intro: "Cette politique explique comment NXT5 traite les données nécessaires au fonctionnement du service. Elle vise à fournir une information claire, accessible et proportionnée aux usages réels de la plateforme.",
    sections: [
      ["Responsable du traitement", "Le responsable du traitement est l’exploitant du service NXT5. Les demandes relatives aux données personnelles peuvent être adressées via les moyens de contact disponibles dans l’application ou sur les canaux officiels du projet."],
      ["Données traitées", "NXT5 peut traiter les informations de compte, les adresses e-mail, les pseudonymes, les rôles, les équipes, les profils joueurs, les Riot IDs, les liens de profil, les disponibilités, les compositions, les champion pools, les reviews, les matchs importés et les statistiques associées."],
      ["Finalités", "Ces données sont utilisées pour créer et sécuriser les comptes, gérer les équipes, permettre la collaboration entre membres, importer et consulter des matchs, produire des tableaux statistiques, préparer des compositions, organiser les disponibilités et conserver un historique utile aux reviews."],
      ["Base juridique", "Les traitements reposent principalement sur l’exécution du service demandé par l’utilisateur, l’intérêt légitime à maintenir un outil fiable et sécurisé, ainsi que le consentement lorsque l’utilisateur fournit volontairement certaines informations ou active certaines fonctionnalités."],
      ["Données de jeu", "Les données liées à League of Legends peuvent provenir d’informations saisies par les utilisateurs, de fichiers importés, de profils publics, d’OP.GG ou des API Riot lorsque l’accès est disponible. Elles sont utilisées pour alimenter les fonctionnalités NXT5 et ne constituent pas une notation officielle des joueurs."],
      ["Destinataires", "Les données sont accessibles aux membres autorisés d’une équipe selon leur rôle. Elles peuvent également être traitées par les prestataires techniques nécessaires au fonctionnement du service, dans la limite de leurs missions respectives."],
      ["Sécurité", "NXT5 applique des mesures techniques et organisationnelles raisonnables afin de limiter les accès non autorisés, les pertes de données et les usages détournés. Aucune page publique ne détaille les mécanismes internes afin de ne pas affaiblir la protection du service."],
      ["Cookies et sessions", "NXT5 utilise des cookies strictement nécessaires à la connexion, au maintien de session et au fonctionnement normal de l’application. Ces cookies ne sont pas destinés au suivi publicitaire."],
      ["Conservation", "Les données sont conservées tant qu’elles sont utiles au fonctionnement de l’équipe ou du compte concerné. Les utilisateurs autorisés peuvent supprimer certains contenus depuis l’interface. Des journaux techniques limités peuvent être conservés pour assurer la stabilité, la sécurité et la traçabilité du service."],
      ["Droits des personnes", "Conformément au RGPD, les utilisateurs peuvent demander l’accès, la rectification, l’effacement ou la limitation du traitement de leurs données lorsque ces droits sont applicables. Une demande peut être formulée via les moyens de contact disponibles pour le service."],
      ["Réclamation", "Si un utilisateur estime que ses droits ne sont pas respectés, il peut contacter l’exploitant du service. Il peut également saisir l’autorité de contrôle compétente en matière de protection des données personnelles."],
    ],
  },
  "/conditions": {
    eyebrow: "Utilisation",
    title: "Conditions d’utilisation",
    intro: "Les présentes conditions encadrent l’utilisation de NXT5. En accédant au service, l’utilisateur accepte de l’utiliser de manière loyale, raisonnable et conforme à sa finalité esportive.",
    sections: [
      ["Accès au service", "NXT5 est accessible aux utilisateurs disposant d’un compte et, pour certaines fonctionnalités, d’une équipe active. Les droits d’accès varient selon le rôle attribué au sein de l’équipe : joueur, capitaine, coach, manager, analyste ou autre rôle autorisé."],
      ["Usage autorisé", "Le service doit être utilisé pour organiser une équipe, importer des matchs, consulter des statistiques, préparer des champion pools, construire des compositions, gérer les disponibilités et rédiger des reviews liees à League of Legends."],
      ["Comptes et responsabilités", "Chaque utilisateur est responsable de l’exactitude des informations qu’il renseigne, de la confidentialité de ses identifiants et des actions réalisées depuis son compte. Les administrateurs d’équipe doivent attribuer les accès avec prudence."],
      ["Contenus d’équipe", "Les reviews, notes, noms de groupes, compositions, profils et autres contenus ajoutés dans NXT5 sont créés par les utilisateurs. L’équipe reste responsable de leur exactitude, de leur pertinence et de leur conformité aux règles applicables."],
      ["Imports de matchs", "Les Game IDs, fichiers JSON et imports de matchs doivent correspondre à des parties réelles ou légitimement accessibles par l’équipe. L’utilisateur s’engage à ne pas importer de données dans le but de nuire, d’usurper, de surveiller abusivement ou de détourner le service."],
      ["Comportements interdits", "Il est interdit de tenter de contourner les droits d’accès, de perturber le service, d’extraire massivement des données, de publier des contenus illicites, injurieux ou discriminatoires, ou d’utiliser NXT5 pour harceler, cibler ou porter atteinte à d’autres joueurs."],
      ["Données et API tierces", "Certaines fonctionnalités dépendent de données ou services tiers, notamment l’écosystème Riot, des profils publics ou des outils d’import. NXT5 ne garantit pas l’exhaustivité, la disponibilité permanente ou l’absence d’erreur de ces sources externes."],
      ["Disponibilité", "Le service est fourni en l’état et peut évoluer, être interrompu, limité ou modifié pour des raisons techniques, de maintenance, de sécurité, de conformité ou de dépendance à des prestataires externes."],
      ["Limitation de responsabilité", "NXT5 est un outil d’aide à la lecture et à l’organisation. Il ne remplace pas le jugement d’un coach, d’un capitaine ou d’un joueur. Les choix sportifs, décisions d’équipe et interprétations des données restent sous la responsabilité des utilisateurs."],
      ["Évolution des conditions", "Les présentes conditions peuvent être mises à jour afin de suivre l’évolution du service. Dernière mise à jour : 27 mai 2026."],
    ],
  },
  "/contact": {
    eyebrow: "Support",
    title: "Contact",
    intro: "Besoin d’aide, de signaler un souci ou de rejoindre la communauté NXT5 ? Le point de contact principal est le serveur Discord officiel.",
    sections: [
      ["Discord NXT5", "Le serveur Discord permet de centraliser les retours, les bugs, les idées de fonctionnalités et les demandes d’aide autour de NXT5. C’est le canal à privilégier pour obtenir une réponse rapide."],
      ["Support produit", "Pour un problème technique, indique la page concernée, l’action réalisée, le message d’erreur affiché et, si possible, le contexte de l’équipe ou de l’import. Plus le signalement est précis, plus il peut être corrigé vite."],
      ["Sécurité et données", "Pour une demande sensible liée à un compte, une équipe, des données ou un accès, évite de publier des informations privées dans un salon public. Utilise un canal privé ou un échange direct avec l’équipe NXT5 lorsque c’est nécessaire."],
    ],
    contact: true,
  },
};

function LegalPage({ route, navigate, user }) {
  const page = LEGAL_PAGES[route.path] || LEGAL_PAGES["/mentions-legales"];
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        {user ? (
          <LinkButton href="/equipes" navigate={navigate} icon={ArrowRight}>Retour à l’app</LinkButton>
        ) : (
          <>
            <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
            <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
          </>
        )}
      </SiteHeader>
      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-12 pt-6">
        <Surface glow className="p-6 md:p-9">
          <Badge tone="orange">{page.eyebrow}</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">{page.title}</h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-slate-200">{page.intro}</p>
          <div className="mt-8 grid gap-4">
            {page.sections.map(([title, text]) => <section key={title} className="rounded-2xl border border-white/12 bg-black/[0.24] p-5 md:p-6"><h2 className="text-2xl font-black text-white">{title}</h2><p className="mt-3 text-base font-semibold leading-8 text-slate-200">{text}</p></section>)}
          </div>
          {page.contact && <div className="mt-8 rounded-[1.35rem] border border-cyan-300/18 bg-cyan-400/[0.07] p-5 shadow-[0_0_34px_rgba(34,211,238,.10)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div><Badge tone="purple">Discord</Badge><h2 className="mt-3 text-2xl font-black text-white">Rejoindre le serveur NXT5</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{DISCORD_INVITE_URL ? "Ouvre Discord pour contacter le support ou rejoindre la communauté." : "Le bouton est prêt. Il manque juste le lien d’invitation Discord final."}</p></div>
              {DISCORD_INVITE_URL ? <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/35 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.25)] transition hover:-translate-y-0.5 hover:bg-white"><Users className="h-4 w-4" />Ouvrir Discord</a> : <button type="button" disabled className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-400"><Users className="h-4 w-4" />Discord à connecter</button>}
            </div>
          </div>}
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <LinkButton href="/equipes" navigate={navigate} icon={ArrowRight}>Retour à l’app</LinkButton>
            ) : (
              <>
                <LinkButton href="/" navigate={navigate} variant="ghost">Retour accueil</LinkButton>
                <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Connexion</LinkButton>
              </>
            )}
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function HomeScreen({ navigate }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(0,216,255,.18),transparent_24%,transparent_70%,rgba(217,0,255,.14)),linear-gradient(180deg,transparent_0%,rgba(2,5,17,.42)_78%)]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate} className="px-3 py-2.5 sm:px-4">Créer un compte</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-12 sm:px-5 sm:pb-16">
        <section className="grid min-h-[calc(100vh-104px)] items-center gap-10 py-8 lg:grid-cols-[.82fr_1.18fr] lg:py-10">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
            <img src="/assets/nxt5-logo.png" alt="NXT5" className="mb-6 h-auto w-full max-w-[520px] object-contain object-left drop-shadow-[0_0_42px_rgba(34,211,238,.30)]" />
            <Badge tone="cyan" pulse>Team tools for the next five</Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl md:text-6xl xl:text-7xl">
              Passe ton <span className="bg-gradient-to-r from-cyan-100 via-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_26px_rgba(34,211,238,.32)]">cinq</span> au <span className="bg-gradient-to-r from-white via-cyan-200 to-fuchsia-300 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(217,70,239,.24)]">niveau suivant</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-200 md:text-lg">Une plateforme cyber esport pour importer tes games, lire le 5v5, préparer tes compos et garder des reviews propres sans transformer la review en tableur.</p>
            <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
              {["Draft à 5", "Stats lisibles", "Review staff"].map((label, index) => <div key={label} className="nxt5-panel border border-cyan-200/14 bg-white/[0.035] px-4 py-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-100/75">0{index + 1}</p><p className="mt-1 text-sm font-black text-white">{label}</p></div>)}
            </div>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <LinkButton href="/creer-un-compte" navigate={navigate} icon={ChevronRight} className="px-6 py-4 sm:px-7">Créer un compte</LinkButton>
              <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="px-6 py-4 sm:px-7">Se connecter</LinkButton>
            </div>
          </motion.div>
          <MarketingPreview />
        </section>

        <section id="features" className="mt-4">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge tone="purple">Modules NXT5</Badge>
              <h2 className="nxt5-metal-text mt-3 text-3xl font-black md:text-4xl">Le cockpit de ta team</h2>
            </div>
            <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-300">Tout est pensé pour consulter vite, comparer proprement, puis laisser le coach et les joueurs faire la vraie lecture.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Crown, title: "Champion Pool lisible", text: "Repère les picks fiables, les picks de confort et les champions à remettre au travail sans transformer le pool en tableau de stats.", t: "cyan" },
            { icon: Swords, title: "Apprendre après chaque game", text: "Lis chaque match avec champions, KDA, dégâts, gold, vision, objectifs et erreurs à comprendre.", t: "purple" },
            { icon: Target, title: "Préparation compétition", text: "Prépare scrims, matchs officiels et blocs compétitifs avec des données de vision, morts, dragons, Nashor et side lanes.", t: "green" },
          ].map((item, i) => { const Icon = item.icon; return <Surface key={item.title} delay={i * .06} glow><div className={cx("mb-5 inline-flex rounded-2xl border p-4", tone(item.t))}><Icon className="h-7 w-7" /></div><h3 className="text-xl font-black text-white">{item.title}</h3><p className="mt-3 text-base font-medium leading-7 text-slate-300">{item.text}</p></Surface>; })}
          </div>
        </section>

        <section id="analytics" className="nxt5-panel nxt5-premium-panel relative mt-14 overflow-hidden border border-cyan-200/18 p-6 shadow-2xl shadow-black/25 md:p-9">
          <div className="mb-8 text-center"><h2 className="text-3xl font-black text-white md:text-4xl">Du match à la review</h2><p className="mt-3 text-base font-semibold text-slate-300">NXT5 met les données au clair pour que joueurs, coachs et capitaines fassent leur propre lecture.</p></div>
          <div className="grid gap-5 md:grid-cols-4">
            {[["1", Swords, "Importe la game", "Le match devient une fiche lisible avec champions, side, patch et objectifs."], ["2", Eye, "Lis les signaux", "Vision, dégâts, gold, KDA, KP et morts exposées ressortent sans fouiller."], ["3", Crown, "Trie les picks", "Le Champion Pool révèle les picks fiables, situationnels et dangereux."], ["4", Target, "Prépare le prochain match", "La review reste un support de lecture pour le coach et les joueurs."]].map(([n, Icon, title, text]) => <div key={n} className="nxt5-panel relative border border-cyan-100/14 bg-black/[0.24] p-5 transition hover:-translate-y-1 hover:border-cyan-200/28"><Badge tone={n === "1" ?"cyan" : "purple"}>{n}</Badge><div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-black text-white">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{text}</p></div>)}
          </div>
          <div className="mt-8 flex justify-center"><LinkButton href="/creer-un-compte" navigate={navigate} icon={ArrowRight} className="px-7 py-4">Créer l’espace équipe</LinkButton></div>
        </section>

        <section className="mt-10"><StatStrip /></section>

        <section className="mt-14">
          <Surface glow>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge tone="cyan">Review ready</Badge>
                <h2 className="nxt5-metal-text mt-3 text-3xl font-black md:text-4xl">Pensé pour les reviews qui changent quelque chose</h2>
              </div>
              <Nxt5Wordmark className="h-12 w-48 object-right opacity-90" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {["Comparer les champions joués et leur volume.", "Lire rapidement les écarts de stats d’équipe.", "Générer une review exploitable par le staff.", "Préparer la prochaine session avec les données visibles."].map((item, index) => <div key={item} className="nxt5-panel flex items-center gap-3 border border-white/10 bg-white/[0.035] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/18 bg-cyan-400/10 text-xs font-black text-cyan-100">0{index + 1}</span><Check className="h-5 w-5 shrink-0 text-emerald-300" /><span className="font-bold text-slate-200">{item}</span></div>)}
            </div>
          </Surface>
        </section>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function NotFoundPage({ navigate }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] w-full max-w-4xl items-center justify-center px-3 pb-12 text-center sm:px-5 sm:pb-16">
        <Surface glow className="w-full">
          <Badge tone="red">404</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">Page introuvable</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-300">Cette URL ne correspond à aucune page NXT5. Reviens à l’accueil ou connecte-toi pour accéder à ton espace.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/" navigate={navigate} variant="ghost">Retour accueil</LinkButton>
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Connexion</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function ForgotPasswordPage({ navigate }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("auth-request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
      setMessage("Si cet e-mail correspond à un compte NXT5, un lien de réinitialisation vient d’être envoyé. Il expire dans 30 minutes.");
      setEmail("");
    } catch (err) {
      if (err?.code === "EMAIL_NOT_CONFIGURED") {
        setError("L’envoi d’e-mail n’est pas encore configuré sur Netlify. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM.");
      } else {
        setError(err.message || "Demande impossible.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(217,70,239,.14),transparent_28%,transparent_67%,rgba(34,211,238,.12))]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Connexion</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] max-w-4xl items-center px-5 pb-16">
        <Surface glow className="mx-auto w-full max-w-2xl">
          <Badge tone="yellow">Sécurité du compte</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Mot de passe oublié</h1>
          <p className="mt-5 text-base font-semibold leading-8 text-slate-200">Entre l’e-mail de ton compte. NXT5 t’envoie un lien temporaire pour choisir un nouveau mot de passe.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextInput label="E-mail du compte" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
            {message && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">{message}</div>}
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading || !email.trim()} icon={loading ?Loader2 : Mail} className="w-full py-4">{loading ?"Envoi..." : "Envoyer le lien"}</Button>
          </form>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Retour connexion</LinkButton>
            <LinkButton href="/creer-un-compte" navigate={navigate} variant="ghost" icon={UserPlus}>Créer un compte</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function ResetPasswordPage({ navigate }) {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [form, setForm] = useState({ nextPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.nextPassword !== form.confirmPassword) {
      setError("La confirmation ne correspond pas.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("auth-reset-password", { method: "POST", body: JSON.stringify({ token, nextPassword: form.nextPassword }) });
      setDone(true);
      setForm({ nextPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message || "Réinitialisation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Connexion</LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] max-w-4xl items-center px-5 pb-16">
        <Surface glow className="mx-auto w-full max-w-2xl">
          <Badge tone="green">Nouveau mot de passe</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Réinitialiser le mot de passe</h1>
          {!token ? (
            <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm font-bold text-rose-100">Lien invalide : aucun token de réinitialisation.</div>
          ) : done ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">Mot de passe mis à jour. Tu peux te reconnecter.</div>
              <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Retour connexion</LinkButton>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <TextInput label="Nouveau mot de passe" value={form.nextPassword} onChange={(nextPassword) => setForm((current) => ({ ...current, nextPassword }))} placeholder="8 caractères minimum" type="password" required icon={Shield} />
              <TextInput label="Confirmer" value={form.confirmPassword} onChange={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))} placeholder="Répète le nouveau mot de passe" type="password" required icon={Check} />
              {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
              <Button type="submit" disabled={loading || !form.nextPassword || !form.confirmPassword} icon={loading ?Loader2 : Shield} className="w-full py-4">{loading ?"Mise à jour..." : "Changer le mot de passe"}</Button>
            </form>
          )}
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function AuthPage({ mode, onAuth, pushToast, navigate }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ email: "", displayName: "", password: "" });
  const [rememberMe, setRememberMe] = useState(readRememberPreference);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const querySuffix = window.location.search || "";

  function patch(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ?"auth-register" : "auth-login";
      const body = { accountName: form.email, email: form.email, displayName: form.displayName, password: form.password, rememberMe };
      const result = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      writeRememberPreference(rememberMe);
      pushToast({ type: "green", title: isRegister ?"Compte créé" : "Connexion réussie", text: "Bienvenue sur NXT5." });
      const params = new URLSearchParams(window.location.search);
      const hasInvite = params.has("invite");
      const next = params.get("next");
      const destination = hasInvite
        ?`/equipes?invite=${encodeURIComponent(params.get("invite"))}`
        : isSafeInternalPath(next)
          ?next
          : isRegister
            ?"/equipes?create=1"
            : "/equipes";
      navigate(destination, { replace: true });
      onAuth(result.user);
    } catch (err) {
      if (err?.code === "DB_NOT_CONFIGURED") {
        setError("La création de compte n’est pas encore active. Le site doit être terminé côté déploiement.");
      } else {
        setError(err.message || (isRegister ?"Inscription impossible." : "Connexion impossible."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(217,70,239,.14),transparent_28%,transparent_67%,rgba(34,211,238,.12))]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate} variant="ghost" className="hidden md:inline-flex">
          {isRegister ?"J’ai déjà un compte" : "Créer un compte"}
        </LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-108px)] w-full max-w-7xl items-center gap-8 px-3 pb-12 sm:px-5 sm:pb-16 lg:grid-cols-[.85fr_1.15fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
          <Badge tone={isRegister ?"purple" : "cyan"} pulse>{isRegister ?"Création de compte" : "Connexion"}</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.055em] md:text-7xl">
            {isRegister ?"Crée ton espace NXT5." : "Retourne dans ton espace NXT5."}
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">
            {isRegister
              ?"Ajoute ton e-mail, choisis ton pseudo, puis lance ton espace équipe."
              : "Connecte-toi pour retrouver tes teams, tes imports et tes reviews."}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[[BarChart3, "Profil de jeu"], [Shield, "Draft & rôles"], [Users, "Progression team" ]].map(([Icon, label], index) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Icon className={cx("h-5 w-5", index === 0 ? "text-cyan-200" : "text-cyan-200")} /><p className="mt-3 text-sm font-black text-white">{label}</p></div>)}
          </div>
        </motion.div>

        <Surface glow className="mx-auto w-full max-w-xl">
          <h2 className="text-3xl font-black text-white">{isRegister ?"Créer un compte" : "Connexion"}</h2>
          <p className="mt-2 text-base font-medium text-slate-300">{isRegister ?"Ton e-mail sert à te connecter et à récupérer ton compte." : "Entre ton e-mail et ton mot de passe pour accéder au tableau de bord."}</p>
          <div className="mt-5 flex rounded-2xl border border-white/10 bg-black/[0.18] p-1">
            <a href={`/connexion${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", !isRegister ?"bg-white/10 text-white" : "text-slate-300 hover:text-white")}>Connexion</a>
            <a href={`/creer-un-compte${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", isRegister ?"bg-white/10 text-white" : "text-slate-300 hover:text-white")}>Créer un compte</a>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <TextInput label={isRegister ? "E-mail" : "E-mail ou ancien pseudo"} value={form.email} onChange={(v) => patch("email", v)} placeholder={isRegister ? "joueur@exemple.com" : "joueur@exemple.com ou ancien pseudo"} type={isRegister ? "email" : "text"} required icon={Mail} />
            {isRegister && <TextInput label="Pseudo" value={form.displayName} onChange={(v) => patch("displayName", v)} placeholder="Ex : Joueur NXT5" required icon={UserPlus} />}
            <TextInput label="Mot de passe" value={form.password} onChange={(v) => patch("password", v)} placeholder="••••••••" type="password" required icon={Lock} />
            <PremiumToggle checked={rememberMe} onChange={setRememberMe} title="Rester connecté" text="Garde cette session active plus longtemps sur cet appareil." />
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading} icon={loading ?Loader2 : isRegister ?UserPlus : Lock} className="w-full py-4">{loading ?"Chargement…" : isRegister ?"Créer le compte" : "Entrer dans NXT5"}</Button>
          </form>
          {!isRegister && <div className="mt-4 text-center"><a className="text-sm font-black text-cyan-200 transition hover:text-white" href="/mot-de-passe-oublie">Mot de passe oublié ?</a></div>}
          <p className="mt-4 text-center text-sm font-semibold text-slate-300">
            {isRegister ?"Déjà inscrit ?" : "Pas encore de compte ?"}
            <a className="font-black text-cyan-200 hover:text-white" href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`}>{isRegister ?" Connexion" : " Créer un compte"}</a>
          </p>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, collapsed, setCollapsed, user, onLogout, currentMember, linkedPlayer }) {
  const status = profileStatusLabel(currentMember);
  const navItems = NAV.filter((item) => PRIMARY_NAV_IDS.includes(item.id) && !item.hidden);
  const moreItems = NAV.filter((item) => MORE_NAV_IDS.includes(item.id) && !item.hidden);
  const profileRole = linkedPlayer?.role || currentMember?.role || "";
  const go = (pageId) => {
    setActive(pageId);
    setOpen(false);
  };
  return (
    <>
      <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden" />}</AnimatePresence>
      <aside className={cx("fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-cyan-200/18 bg-[#050917]/90 p-3 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl transition-all duration-300 lg:translate-x-0", collapsed ?"lg:w-24" : "lg:w-[19rem]", open ?"translate-x-0 w-[19rem] max-w-[calc(100vw-1rem)]" : "-translate-x-full w-[19rem] max-w-[calc(100vw-1rem)]")}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(34,211,238,.12),transparent_28%,rgba(217,70,239,.10)_72%,transparent),repeating-linear-gradient(90deg,transparent_0_46px,rgba(255,255,255,.025)_47px,transparent_48px)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-200/65 to-fuchsia-200/30" />
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="absolute -right-4 top-6 hidden h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/18 bg-[#070d1d] text-cyan-100 shadow-xl shadow-black/40 transition hover:border-cyan-300/45 hover:bg-cyan-400/10 lg:flex" title={collapsed ?"Afficher le menu" : "Cacher le menu"}>
          <ChevronRight className={cx("h-5 w-5 transition", !collapsed && "rotate-180")} />
        </button>
        <div className={cx("relative z-10 mb-5 flex items-center", collapsed ?"justify-center" : "justify-between")}>
          <div className={cx("flex min-w-0 flex-1 items-center", collapsed ? "gap-0" : "gap-2.5")}><img src="/apple-touch-icon.png?v=6" alt="NXT5" className={cx("shrink-0 object-contain object-center drop-shadow-[0_0_30px_rgba(34,211,238,.42)]", collapsed ?"h-14 w-14" : "h-[4.35rem] w-[4.35rem]")} /><div className={cx("min-w-0 flex-1 transition lg:block", collapsed && "lg:hidden")}><Nxt5Wordmark className="mx-auto h-10 w-full max-w-[11.75rem] object-contain object-center" /><p className="mt-1 text-center text-[0.55rem] font-black uppercase tracking-[0.22em] text-cyan-100/60">Draft Tools</p></div></div>
          <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="relative z-10 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return <button key={item.id} onClick={() => go(item.id)} title={item.label} className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ?"justify-center px-2 lg:justify-center" : "px-3", selected ?"border-cyan-200/26 bg-gradient-to-r from-cyan-500/26 via-blue-500/14 to-fuchsia-500/18 text-white shadow-[0_0_26px_rgba(34,211,238,.10)]" : "border-transparent text-slate-400 hover:border-cyan-200/16 hover:bg-white/[0.055] hover:text-white")}>
              <Icon className={cx("h-5 w-5 shrink-0 transition", selected ?"text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.45)]" : "text-slate-300 group-hover:text-cyan-200")} />
              <span className={cx("truncate", collapsed && "lg:hidden")}>{item.label}</span>
            </button>;
          })}
          {!!moreItems.length && <div className="pt-1">
            <div className={cx("mb-1 border-t border-cyan-200/10", collapsed && "lg:mx-2")} />
            <div className={cx("space-y-1", !collapsed && "pt-1")}>
              {moreItems.map((item) => {
                const Icon = item.icon;
                const selected = active === item.id;
                return <button key={item.id} type="button" onClick={() => go(item.id)} title={item.label} className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ?"justify-center px-2 lg:justify-center" : "px-3", selected ?"border-cyan-200/26 bg-gradient-to-r from-cyan-500/20 via-blue-500/12 to-fuchsia-500/16 text-white shadow-[0_0_22px_rgba(34,211,238,.09)]" : "border-transparent text-slate-400 hover:border-cyan-200/16 hover:bg-white/[0.055] hover:text-white")}>
                  <Icon className={cx("h-5 w-5 shrink-0 transition", selected ?"text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.35)]" : "text-slate-300 group-hover:text-cyan-200")} />
                  <span className={cx("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                </button>;
              })}
            </div>
          </div>}
        </nav>
        <div className="relative z-10 shrink-0 space-y-3 pt-3">
          <button type="button" onClick={() => go("guide")} title="Guide" className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ?"justify-center px-2 lg:justify-center" : "px-3", active === "guide" ?"border-cyan-300/35 bg-cyan-400/[0.075] text-white shadow-[0_0_22px_rgba(34,211,238,.10)]" : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.055] hover:text-white")}><BookOpen className={cx("h-5 w-5 shrink-0 transition", active === "guide" ?"text-cyan-100" : "text-slate-300 group-hover:text-cyan-200")} /><span className={cx("truncate", collapsed && "lg:hidden")}>Guide</span></button>
          <div className={cx("nxt5-panel nxt5-premium-panel relative w-full max-w-full overflow-hidden border border-cyan-200/16 text-left backdrop-blur-2xl", collapsed ?"p-2" : "p-2.5")}><div className="relative z-10"><div className={cx("flex items-center gap-3", collapsed && "lg:justify-center")}><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/18 bg-cyan-400/10 text-cyan-200"><RoleIcon role={profileRole} className="h-5 w-5" /></div><div className={cx("min-w-0", collapsed && "lg:hidden")}><p className="truncate text-sm font-black text-white">{user?.name || "Coach"}</p><p className="truncate text-xs font-semibold text-slate-300">{linkedPlayer ? `${roleLabel(linkedPlayer.role)} · ${linkedPlayer.name}` : status}</p></div></div><div className={cx("mt-2 flex flex-wrap gap-1.5", collapsed && "lg:hidden")}><Badge tone={profileStatusTone(currentMember)}>{status}</Badge>{linkedPlayer && <Badge tone="cyan">Profil lié</Badge>}</div></div></div>
          <button type="button" onClick={() => go("account-settings")} title="Paramètres" className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ?"justify-center px-2 lg:justify-center" : "px-3", active === "account-settings" ?"border-cyan-300/35 bg-cyan-400/[0.075] text-white shadow-[0_0_22px_rgba(34,211,238,.10)]" : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.055] hover:text-white")}><Settings className={cx("h-5 w-5 shrink-0 transition", active === "account-settings" ?"text-cyan-100" : "text-slate-300 group-hover:text-cyan-200")} /><span className={cx("truncate", collapsed && "lg:hidden")}>Paramètres</span></button>
          <Button variant="ghost" icon={LogOut} onClick={onLogout} className={cx("w-full", collapsed ?"justify-center px-0" : "justify-start")}><span className={cx(collapsed && "lg:hidden")}>Déconnexion</span></Button>
        </div>
      </aside>
    </>
  );
}

function TeamAvatar({ team, className = "h-12 w-12" }) {
  if (team?.avatar_data_url) {
    return <div className={cx("overflow-hidden rounded-xl border border-cyan-300/25 bg-black/30", className)}><img src={team.avatar_data_url} alt={team.name || "Team"} className="h-full w-full object-cover" style={{ transform: "scale(" + Number(team.avatar_zoom || 1) + ")", objectPosition: Number(team.avatar_x ?? 50) + "% " + Number(team.avatar_y ?? 50) + "%" }} /></div>;
  }
  return <img src="/assets/nxt5-logo.png" alt="NXT5" className={cx("object-contain object-left drop-shadow-[0_0_18px_rgba(34,211,238,.35)]", className)} />;
}

function RoleIcon({ role, className = "h-7 w-7", lightweight = false }) {
  const roleKey = String(role || "").toUpperCase();
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [roleKey]);
  const staffIcon = {
    COACH: ShieldCheck,
    ASSISTANT: Users,
    ANALYST: BarChart3,
    MANAGER: Settings,
    BOARD: Crown,
    OWNER: Crown,
    CAPTAIN: ShieldCheck,
    STAFF: ShieldCheck,
    SUB: UserPlus,
  }[roleKey];
  if (staffIcon) {
    const Icon = staffIcon;
    return <Icon className={cx("text-cyan-100", className)} />;
  }
  const key = { TOP: "top", JGL: "jungle", MID: "middle", ADC: "bottom", SUP: "utility" }[roleKey];
  if (!key) return <Users className={cx("text-slate-300", className)} />;
  const sources = [
    `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champ-select/global/default/svg/position-${key}.svg`,
    `https://raw.communitydragon.org/12.23/plugins/rcp-fe-lol-champ-select/global/default/svg/position-${key}.svg`,
    `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-${key}.svg`,
  ];
  const source = sources[sourceIndex];
  if (!source) return <span className={cx("inline-flex items-center justify-center text-[0.62rem] font-black text-cyan-100", className)}>{roleKey}</span>;
  return <img src={source} alt={roleKey} className={cx("object-contain opacity-95 invert", !lightweight && "drop-shadow-[0_0_10px_rgba(96,165,250,.28)]", className)} loading="lazy" onError={() => setSourceIndex((index) => index + 1)} />;
}

function Topbar({ active, setOpen, currentTeam, teams, onSelectTeam, onCreateTeam, onManageTeam }) {
  const nav = NAV.find((item) => item.id === active) || NAV[0];
  const navLabel = active === "profile" ? `${nav.label} > ${profileViewLabel(profileViewFromPath(window.location.pathname))}` : active === "matches" ? `${nav.label} > ${gameWorkspaceSectionLabel(gameWorkspaceSectionFromPath(window.location.pathname))}` : nav.label;
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  return <header className="sticky top-0 z-20 border-b border-cyan-200/14 bg-[#030714]/82 px-3 py-3 text-white shadow-[0_12px_40px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:px-4 sm:py-4 lg:px-8"><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,.09),transparent_34%,rgba(217,70,239,.08))]" /><div className="relative flex flex-wrap items-center justify-between gap-2 sm:gap-3"><div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"><button onClick={() => setOpen(true)} className="shrink-0 rounded-xl border border-cyan-100/14 bg-white/[0.045] p-2 lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden md:block"><TeamAvatar team={currentTeam} /></div><div className="relative min-w-0"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.2em] text-cyan-100/75 sm:text-[0.68rem] sm:tracking-[0.26em]">{navLabel}</p><button onClick={() => setTeamMenuOpen((open) => !open)} className="mt-0.5 flex max-w-[48vw] items-center gap-1 rounded-xl px-0 py-0 text-left transition hover:text-cyan-100 sm:max-w-[58vw] sm:gap-2"><h1 className="nxt5-metal-text truncate text-lg font-black tracking-tight sm:text-xl md:text-2xl">{currentTeam?.name || nav.label}</h1><ChevronDown className="h-4 w-4 shrink-0 text-cyan-200 sm:h-5 sm:w-5" /></button><AnimatePresence>{teamMenuOpen && <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="nxt5-panel absolute left-0 top-[calc(100%+0.6rem)] z-50 w-[min(92vw,380px)] overflow-hidden border border-cyan-200/30 bg-[#050814] p-2 shadow-[0_30px_80px_rgba(0,0,0,.72),0_0_36px_rgba(34,211,238,.16)] ring-1 ring-white/10"><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,.12),rgba(5,8,20,.96)_42%,rgba(217,70,239,.10))]" /> <div className="relative z-10">{teams.map((team) => <button key={team.id} onClick={() => { onSelectTeam(team.id); setTeamMenuOpen(false); }} className={cx("flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition", currentTeam?.id === team.id ?"border-cyan-200/25 bg-cyan-400/14 text-white shadow-[0_0_22px_rgba(34,211,238,.10)]" : "border-transparent bg-[#070d1c] text-slate-200 hover:border-cyan-200/18 hover:bg-[#0b1428] hover:text-white")}><span className="flex min-w-0 items-center gap-3"><TeamAvatar team={team} className="h-9 w-9 shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-black">{team.name}</span><span className="mt-1 block text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-300">{team.tag || "TEAM"} · {team.region || "EUW"}</span></span></span>{currentTeam?.id === team.id && <Check className="h-4 w-4 shrink-0 text-cyan-200" />}</button>)}<button onClick={() => { onCreateTeam(); setTeamMenuOpen(false); }} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-cyan-100/22 bg-[#071221] px-4 py-3 text-left text-sm font-black text-cyan-100 transition hover:border-cyan-200/35 hover:bg-cyan-400/12"><Plus className="h-4 w-4" />Créer une nouvelle team</button></div></motion.div>}</AnimatePresence></div></div>{currentTeam && active !== "team-management" && <Button variant="ghost" icon={Settings} onClick={onManageTeam} className="shrink-0 px-3 sm:px-4"><span className="hidden sm:inline">Gestion</span></Button>}</div></header>;
}

function ApiBanner({ error }) {
  if (!error) return null;
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-3xl border border-amber-300/25 bg-amber-500/10 p-4 text-amber-100 shadow-xl shadow-amber-950/10"><div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-200/10 p-2"><AlertTriangle className="h-5 w-5" /></div><div><p className="font-black">Endpoint/API non disponible</p><p className="mt-1 text-sm leading-6 text-amber-100/75">{error}</p></div></div></motion.div>;
}

function WinConditionPanel({ championPool, players, onOpenDraft }) {
  const pool = championPool || [];
  const best = pool.slice().filter((row) => Number(row.games || 0) > 0).sort((a, b) => (Number(b.winrate || 0) * 2 + Number(b.kda || 0) * 8 + Number(b.games || 0)) - (Number(a.winrate || 0) * 2 + Number(a.kda || 0) * 8 + Number(a.games || 0)))[0];
  const stable = pool.filter((row) => Number(row.games || 0) >= 3 && Number(row.winrate || 0) >= 50).slice(0, 5);
  const weak = pool.filter((row) => Number(row.games || 0) >= 3 && Number(row.winrate || 0) < 45).slice(0, 3);
  const missingRoles = ["TOP", "JGL", "MID", "ADC", "SUP"].filter((role) => !players.some((player) => player.role === role));
  return <Surface glow><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><Badge tone="cyan">Champion Pool</Badge><h3 className="mt-4 text-2xl font-black text-white">Données du pool</h3><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">Une vue des champions présents dans les données : volume, bilan et KDA.</p></div><Button variant="ghost" icon={Shield} onClick={onOpenDraft}>Ouvrir draft</Button></div>{best ? <div className="mt-6 grid gap-4 xl:grid-cols-[.9fr_1.1fr]"><div className="relative min-h-[260px] overflow-hidden rounded-[1.45rem] border border-cyan-300/20 bg-cyan-400/10 p-5"><ChampionBackdrop champion={best.champion} /><div className="relative z-10"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Pick le plus présent</p><h4 className="mt-3 text-4xl font-black text-white">{championDisplayName(best.champion)}</h4><p className="mt-2 text-sm font-bold text-slate-300">{best.player_name || "Roster"}</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Bilan</p><p className="mt-1 text-xl font-black text-white">{best.wins || 0}W - {best.losses || 0}L</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">KDA</p><p className="mt-1 text-xl font-black text-white">{Number(best.kda || 0).toFixed(1)}</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Games</p><p className="mt-1 text-xl font-black text-white">{best.games || 0}</p></div></div></div></div><div className="grid gap-3"><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Picks stables</p><div className="mt-3 flex flex-wrap gap-2">{stable.length ? stable.map((pick) => <div key={pick.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3"><ChampionPortrait row={pick} alt={pick.champion} className="h-8 w-8 rounded-full object-cover" /><span className="text-xs font-black text-white">{championDisplayName(pick.champion)}</span></div>) : <span className="text-sm font-semibold text-slate-300">Pas encore assez de volume.</span>}</div></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Picks à surveiller</p><div className="mt-3 flex flex-wrap gap-2">{weak.length ? weak.map((pick) => <Badge key={pick.id} tone="red">{championDisplayName(pick.champion)} · {pick.games || 0} games</Badge>) : <Badge tone="green">Aucun pick prioritaire</Badge>}{missingRoles.length > 0 && <Badge tone="yellow">Slots manquants : {missingRoles.join(", ")}</Badge>}</div></div></div></div> : <EmptyState icon={Crown} title="Données en attente" text="Importe des games pour alimenter les champions et les volumes." />}</Surface>;
}

function ChampionMiniCard({ title, item, icon: Icon, tone: t }) {
  return <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4"><ChampionBackdrop champion={item?.champion} /><div className="relative z-10 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{title}</p><p className="mt-2 text-xl font-black text-white">{championDisplayName(item?.champion) || "?"}</p><p className="mt-1 text-sm font-semibold text-slate-400">{item?.player_name || "Données insuffisantes"}</p></div><div className={cx("rounded-2xl border p-3", tone(t))}><Icon className="h-5 w-5" /></div></div><div className="relative z-10 mt-4 flex flex-wrap gap-2"><Badge tone="slate">{item?.games ?? 0} games</Badge><Badge tone="purple">{item?.kda ? Number(item.kda).toFixed(1) : "?"} KDA</Badge></div></div>;
}

const DDRAGON_VERSION = "16.11.1";
const DDRAGON_FALLBACK_VERSIONS = ["16.11.1", "16.10.1", "16.9.1", "15.24.1", "15.10.1"];

const CHAMPION_STYLE_TAGS = {
  Aatrox: ["bruiser", "teamfight"], Ahri: ["pick", "tempo"], Akali: ["assassin", "side"], Alistar: ["engage", "peel"], Amumu: ["engage", "teamfight"], Anivia: ["control", "scaling"], Annie: ["burst", "engage"], Aphelios: ["scaling", "front-to-back"], Ashe: ["utility", "pick"], AurelionSol: ["scaling", "control"], Azir: ["scaling", "front-to-back"],
  Bard: ["roam", "pick"], Blitzcrank: ["pick", "engage"], Brand: ["poke", "teamfight"], Braum: ["peel", "front-to-back"], Caitlyn: ["lane", "siege"], Camille: ["side", "pick"], Cassiopeia: ["scaling", "front-to-back"], Chogath: ["frontline", "objective"], Corki: ["poke", "scaling"],
  Darius: ["bruiser", "lane"], Diana: ["engage", "burst"], DrMundo: ["frontline", "scaling"], Draven: ["lane", "snowball"], Ekko: ["assassin", "side"], Elise: ["early", "dive"], Evelynn: ["pick", "assassin"], Ezreal: ["poke", "safe"], Fiddlesticks: ["engage", "teamfight"], Fiora: ["side", "duel"], Fizz: ["assassin", "pick"],
  Galio: ["engage", "cover"], Gangplank: ["scaling", "teamfight"], Garen: ["bruiser", "simple"], Gnar: ["teamfight", "side"], Gragas: ["engage", "disengage"], Graves: ["tempo", "skirmish"], Gwen: ["scaling", "side"], Hecarim: ["engage", "tempo"], Heimerdinger: ["control", "siege"], Hwei: ["control", "poke"],
  Irelia: ["side", "snowball"], Ivern: ["utility", "peel"], Janna: ["peel", "disengage"], JarvanIV: ["engage", "early"], Jax: ["side", "scaling"], Jayce: ["poke", "lane"], Jhin: ["utility", "pick"], Jinx: ["scaling", "front-to-back"], Kaisa: ["dive", "scaling"], Kalista: ["lane", "objective"], Karma: ["poke", "tempo"], Karthus: ["scaling", "farm"], Kassadin: ["scaling", "side"], Katarina: ["reset", "snowball"], Kayle: ["scaling", "front-to-back"], Kayn: ["tempo", "skirmish"], Kennen: ["engage", "teamfight"], Khazix: ["pick", "assassin"], Kindred: ["tempo", "scaling"], Kled: ["engage", "snowball"], KogMaw: ["scaling", "front-to-back"], KSante: ["frontline", "side"],
  LeBlanc: ["pick", "poke"], LeeSin: ["early", "playmaker"], Leona: ["engage", "lane"], Lillia: ["tempo", "teamfight"], Lissandra: ["engage", "lockdown"], Lucian: ["lane", "tempo"], Lulu: ["peel", "scaling"], Lux: ["poke", "pick"], Malphite: ["engage", "teamfight"], Malzahar: ["lockdown", "pick"], Maokai: ["engage", "vision"], MasterYi: ["scaling", "reset"], Milio: ["peel", "scaling"], MissFortune: ["teamfight", "lane"], MonkeyKing: ["engage", "teamfight"], Mordekaiser: ["frontline", "side"], Morgana: ["pick", "control"], Nami: ["lane", "utility"], Nasus: ["scaling", "side"], Nautilus: ["engage", "pick"], Neeko: ["engage", "teamfight"], Nidalee: ["tempo", "poke"], Nilah: ["dive", "teamfight"], Nocturne: ["dive", "pick"], Nunu: ["objective", "gank"], Olaf: ["bruiser", "tempo"], Orianna: ["control", "teamfight"], Ornn: ["frontline", "scaling"], Pantheon: ["early", "pick"], Poppy: ["disengage", "frontline"], Pyke: ["pick", "roam"], Qiyana: ["assassin", "teamfight"], Quinn: ["side", "lane"], Rakan: ["engage", "roam"], Rammus: ["engage", "frontline"], RekSai: ["early", "dive"], Rell: ["engage", "teamfight"], Renata: ["disengage", "teamfight"], Renekton: ["lane", "early"], Rengar: ["assassin", "pick"], Riven: ["side", "snowball"], Rumble: ["teamfight", "lane"], Ryze: ["side", "scaling"], Samira: ["dive", "reset"], Sejuani: ["engage", "frontline"], Senna: ["scaling", "utility"], Seraphine: ["teamfight", "scaling"], Sett: ["frontline", "engage"], Shen: ["side", "cover"], Shyvana: ["farm", "teamfight"], Singed: ["side", "disrupt"], Sion: ["frontline", "engage"], Sivir: ["waveclear", "front-to-back"], Skarner: ["pick", "frontline"], Smolder: ["scaling", "front-to-back"], Sona: ["scaling", "teamfight"], Soraka: ["peel", "sustain"], Swain: ["teamfight", "frontline"], Sylas: ["skirmish", "pick"], Syndra: ["burst", "control"], TahmKench: ["peel", "frontline"], Taliyah: ["control", "roam"], Talon: ["roam", "assassin"], Taric: ["peel", "teamfight"], Teemo: ["side", "control"], Thresh: ["pick", "peel"], Tristana: ["lane", "siege"], Trundle: ["frontline", "objective"], Tryndamere: ["side", "scaling"], TwistedFate: ["roam", "pick"], Twitch: ["scaling", "flank"], Udyr: ["tempo", "frontline"], Urgot: ["bruiser", "frontline"], Varus: ["poke", "pick"], Vayne: ["scaling", "duel"], Veigar: ["scaling", "control"], Velkoz: ["poke", "control"], Vex: ["burst", "anti-dive"], Vi: ["dive", "lockdown"], Viego: ["reset", "skirmish"], Viktor: ["control", "scaling"], Vladimir: ["scaling", "teamfight"], Volibear: ["dive", "early"], Warwick: ["early", "skirmish"], Xayah: ["self-peel", "front-to-back"], Xerath: ["poke", "siege"], XinZhao: ["early", "dive"], Yasuo: ["skirmish", "teamfight"], Yone: ["side", "teamfight"], Yorick: ["side", "siege"], Yuumi: ["scaling", "attach"], Zac: ["engage", "teamfight"], Zed: ["assassin", "side"], Zeri: ["scaling", "teamfight"], Ziggs: ["poke", "siege"], Zilean: ["utility", "scaling"], Zoe: ["poke", "pick"], Zyra: ["poke", "control"],
};

const ADDITIONAL_CHAMPION_STYLE_TAGS = {
  Akshan: ["roam", "reset"],
  Ambessa: ["dive", "skirmish"],
  Aurora: ["teamfight", "side"],
  Belveth: ["scaling", "skirmish"],
  Briar: ["dive", "snowball"],
  Illaoi: ["side", "teamfight"],
  Leblanc: ["pick", "poke"],
  Mel: ["control", "poke"],
  Naafiri: ["assassin", "dive"],
  Shaco: ["pick", "assassin"],
  Yunara: ["scaling", "front-to-back"],
  Zaahen: ["bruiser", "dive"],
};

const ALL_CHAMPION_STYLE_TAGS = {
  ...CHAMPION_STYLE_TAGS,
  ...ADDITIONAL_CHAMPION_STYLE_TAGS,
};

const CHAMPION_ASSET_ALIASES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leblanc: "Leblanc",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  monkeyking: "MonkeyKing",
  nunuwillump: "Nunu",
  reksai: "RekSai",
  renataglasc: "Renata",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  viego: "Viego",
  wukong: "MonkeyKing",
  xinzhao: "XinZhao",
};

function championKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function championAssetId(value) {
  const raw = String(value || "").trim();
  const key = championKey(raw);
  return CHAMPION_ASSET_ALIASES[key] || raw.replace(/[^A-Za-z0-9]/g, "");
}

function championDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const names = {
    AurelionSol: "Aurelion Sol",
    Chogath: "Cho'Gath",
    DrMundo: "Dr. Mundo",
    JarvanIV: "Jarvan IV",
    Kaisa: "Kai'Sa",
    Khazix: "Kha'Zix",
    KogMaw: "Kog'Maw",
    KSante: "K'Sante",
    Leblanc: "LeBlanc",
    LeeSin: "Lee Sin",
    MasterYi: "Master Yi",
    MissFortune: "Miss Fortune",
    MonkeyKing: "Wukong",
    Nunu: "Nunu & Willump",
    RekSai: "Rek'Sai",
    TahmKench: "Tahm Kench",
    TwistedFate: "Twisted Fate",
    Velkoz: "Vel'Koz",
    XinZhao: "Xin Zhao",
  };
  const asset = championAssetId(raw);
  return names[asset] || raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function championOptions() {
  return [...new Set(Object.keys(ALL_CHAMPION_STYLE_TAGS).map(championAssetId))].sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
}

function compositionIdentity(picks) {
  const tagCounts = new Map();
  (picks || []).filter(Boolean).forEach((pick) => championStyleTags(pick.champion).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const primary = tags[0]?.[0] || "standard";
  const text = primary === "engage" ? "Chercher une ouverture claire et jouer autour du premier go." : primary === "scaling" || primary === "front-to-back" ? "Protéger les carries, temporiser et jouer les objectifs préparés." : primary === "poke" || primary === "siege" ? "Gagner l'espace avant objectif, gratter les HP puis forcer." : primary === "side" ? "Créer une pression side lane et punir les rotations adverses." : primary === "pick" ? "Jouer vision noire, isoler une cible et convertir en objectif." : "Importer plus de matchs pour stabiliser l'identité de draft.";
  return { primary, tags, text };
}

function championStyleTags(champion) {
  return ALL_CHAMPION_STYLE_TAGS[championAssetId(champion)] || ["standard"];
}

function championStyleTone(tag) {
  if (["engage", "dive", "early", "snowball", "assassin", "burst", "pick"].includes(tag)) return "red";
  if (["scaling", "front-to-back", "peel", "sustain", "utility", "control", "waveclear", "safe", "vision"].includes(tag)) return "cyan";
  if (["side", "duel", "split", "siege", "poke", "farm", "lane"].includes(tag)) return "yellow";
  if (["frontline", "teamfight", "objective", "tempo", "roam", "skirmish", "reset", "disengage", "lockdown"].includes(tag)) return "green";
  return "slate";
}

function tagLabel(tag) {
  return {
    "blue side": "Côté bleu",
    "red side": "Côté rouge",
    "front-to-back": "Combat frontal",
    teamfight: "Combat d'équipe",
    scaling: "Late game",
    pick: "Catch",
    poke: "Poke",
    siege: "Siège",
    side: "Side lane",
    engage: "Initiation",
    dive: "Dive",
    early: "Début de game",
    snowball: "Snowball",
    assassin: "Assassin",
    burst: "Burst",
    peel: "Protection",
    sustain: "Tenue",
    utility: "Utilitaire",
    control: "Contrôle",
    duel: "Duel",
    split: "Split",
    frontline: "Première ligne",
    objective: "Objectifs",
    tempo: "Tempo",
    waveclear: "Nettoyage de waves",
    safe: "Sécurité",
    vision: "Vision",
    farm: "Farm",
    lane: "Lane",
    roam: "Roam",
    skirmish: "Escarmouche",
    reset: "Reset",
    disengage: "Désengage",
    lockdown: "Verrouillage",
    flank: "Flank",
    dps: "DPS",
    invade: "Invade",
    exhaust: "Fatigue",
    standard: "Standard",
    scrim: "Scrim",
  }[String(tag || "")] || String(tag || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CHAMPION_TAG_DEFINITIONS = [
  ["engage", "Ouvre les combats avec une initiation claire."],
  ["dive", "Entre rapidement sur les carries ou la backline adverse."],
  ["front-to-back", "Joue les fights dans l'ordre, frontline devant et carries protégés."],
  ["teamfight", "Fort quand les cinq joueurs combattent ensemble."],
  ["pick", "Cherche à isoler une cible avant un objectif ou une rotation."],
  ["poke", "Gratte les PV avant d'engager ou de contester une zone."],
  ["siege", "Met la pression sur les tours et les objectifs fixes."],
  ["side", "Crée de la pression sur une side lane."],
  ["duel", "Fort en 1v1 ou dans les escarmouches isolées."],
  ["scaling", "Devient plus puissant avec le temps, les niveaux ou les items."],
  ["early", "Très fort en début de partie pour prendre le tempo."],
  ["tempo", "Aide à accélérer la carte, les rotations ou les timings d'objectif."],
  ["snowball", "Prend beaucoup de valeur quand il obtient une avance tôt."],
  ["assassin", "Menace explosive sur les cibles fragiles."],
  ["burst", "Inflige beaucoup de dégâts sur une fenêtre courte."],
  ["control", "Contrôle les zones avec des sorts, de la portée ou du zoning."],
  ["frontline", "Peut tenir l'espace devant l'équipe."],
  ["peel", "Protège un carry contre les engages ou les dives."],
  ["utility", "Apporte de la vision, du contrôle, du buff ou de la valeur d'équipe."],
  ["objective", "Très utile pour sécuriser dragons, Nashor, Herald ou tours."],
  ["roam", "Peut quitter sa lane pour influencer les autres zones."],
  ["skirmish", "Fort dans les combats courts à 2v2 ou 3v3."],
  ["reset", "Peut enchaîner après un kill ou une exécution réussie."],
  ["disengage", "Permet de casser l'engage adverse et de reculer proprement."],
  ["lockdown", "Peut immobiliser une cible de manière fiable."],
  ["sustain", "Apporte du soin, de la régénération ou de la tenue en fight."],
  ["safe", "Peut jouer avec peu de ressources ou limiter les risques."],
  ["lane", "Fort dans la phase de lane ou pour créer une priorité locale."],
  ["farm", "A besoin de ressources et de tempo PvE pour atteindre son pic."],
  ["cover", "Protège une action alliée ou accompagne une prise de risque."],
  ["gank", "Facilite les actions sur les lanes."],
  ["disrupt", "Dérange le plan adverse et casse les formations."],
  ["anti-dive", "Répond bien aux compositions qui veulent rentrer dans l'équipe."],
  ["self-peel", "Dispose d'outils personnels pour survivre à une menace."],
  ["attach", "Se lie à un allié et amplifie son impact."],
  ["flank", "Menace forte quand il arrive sur le côté ou dans le dos."],
  ["simple", "Plan de jeu direct, facile à exécuter."],
  ["playmaker", "Peut créer une action décisive par mécanique ou timing."],
  ["standard", "Profil équilibré sans identité dominante détectée."],
];

const COUNTER_TAG_RULES = {
  engage: [["disengage", 20, "Disengage"], ["peel", 14, "Peel carry"], ["control", 10, "Contrôle zone"], ["poke", 8, "Punition avant go"]],
  dive: [["peel", 22, "Anti-dive"], ["disengage", 18, "Stop entrée"], ["lockdown", 12, "Lockdown cible"], ["frontline", 8, "Frontline solide"]],
  poke: [["engage", 18, "Engage rapide"], ["sustain", 16, "Sustain poke"], ["dive", 10, "Dive backline"], ["safe", 8, "Tenue longue distance"]],
  siege: [["engage", 16, "Force sous pression"], ["waveclear", 14, "Waveclear"], ["dive", 10, "Casse siège"], ["flank", 8, "Angle de flank"]],
  scaling: [["early", 18, "Punition early"], ["snowball", 14, "Snowball"], ["pick", 10, "Catch avant spikes"], ["objective", 8, "Objectifs rapides"]],
  "front-to-back": [["dive", 16, "Menace carry"], ["flank", 14, "Angle latéral"], ["assassin", 12, "Pression backline"], ["poke", 8, "Désorganise frontline"]],
  side: [["engage", 14, "Force mid"], ["duel", 12, "Réponse side"], ["pick", 10, "Punition rotation"], ["waveclear", 8, "Stabilise mid"]],
  pick: [["frontline", 12, "Absorbe pick"], ["disengage", 12, "Annule ouverture"], ["safe", 10, "Réduit catches"], ["vision", 8, "Contrôle vision"]],
  assassin: [["peel", 18, "Protège cible"], ["lockdown", 14, "Contrôle assassin"], ["frontline", 10, "Réduit accès"], ["exhaust", 8, "Réponse burst"]],
  early: [["safe", 12, "Stabilise early"], ["scaling", 8, "Survit puis dépasse"], ["waveclear", 8, "Limite tempo"], ["vision", 8, "Sécurise lanes"]],
  teamfight: [["split", 14, "Étire map"], ["poke", 12, "Affaiblit fight"], ["disengage", 10, "Refuse 5v5"], ["flank", 8, "Casse formation"]],
  control: [["dive", 14, "Traverse zone"], ["poke", 10, "Conteste distance"], ["flank", 10, "Hors angle"], ["tempo", 8, "Setup avant zone"]],
  frontline: [["poke", 12, "Use frontline"], ["scaling", 10, "Outscale tanks"], ["duel", 8, "Pression side"], ["dps", 8, "DPS continu"]],
  peel: [["poke", 12, "Force backline"], ["side", 10, "Évite front-to-back"], ["engage", 8, "Multi angles"], ["objective", 8, "Force déplacement"]],
  utility: [["pick", 12, "Punition rotations"], ["burst", 10, "Supprime value"], ["assassin", 8, "Menace enchanteur"], ["dive", 8, "Accès backline"]],
  objective: [["tempo", 14, "Setup avant"], ["pick", 12, "Isoler setup"], ["control", 8, "Bloque rivière"], ["poke", 8, "Conteste objectif"]],
  tempo: [["waveclear", 10, "Ralentit tempo"], ["scaling", 8, "Absorbe puis dépasse"], ["safe", 8, "Limite ouvertures"], ["control", 8, "Casse rotations"]],
  burst: [["frontline", 12, "Absorbe burst"], ["sustain", 10, "Récupère trade"], ["peel", 8, "Protège cible"], ["safe", 8, "Évite fenêtre"]],
  snowball: [["safe", 12, "Coupe accélération"], ["control", 10, "Stabilise zones"], ["scaling", 8, "Joue temps"], ["waveclear", 8, "Freine push"]],
  sustain: [["burst", 12, "Tue avant sustain"], ["pick", 10, "Cible isolée"], ["objective", 8, "Convertit fenêtres"], ["poke", 6, "Force ressources"]],
  roam: [["vision", 12, "Track roam"], ["waveclear", 10, "Punition wave"], ["tempo", 8, "Match rotations"]],
  skirmish: [["frontline", 10, "Stabilise skirmish"], ["control", 10, "Zone fight court"], ["scaling", 8, "Refuse trade tôt"]],
  reset: [["lockdown", 12, "Stop reset"], ["peel", 10, "Protège exécution"], ["burst", 8, "Tue avant reset"]],
  disengage: [["poke", 10, "Force reculs"], ["siege", 8, "Pression structures"], ["side", 8, "Déplace fight"]],
  lockdown: [["poke", 8, "Joue hors portée"], ["frontline", 8, "Absorbe CC"], ["utility", 6, "Nettoie fenêtre"]],
  lane: [["safe", 10, "Stabilise lane"], ["roam", 8, "Évite duel lane"], ["waveclear", 8, "Casse prio"]],
  farm: [["early", 10, "Punition PvE"], ["invade", 8, "Pression jungle"], ["tempo", 8, "Accélère carte"]],
};

const DIRECT_COUNTERS = {
  Aatrox: ["Fiora", "Irelia", "Malphite", "Poppy"],
  Ahri: ["Galio", "Lissandra", "Naafiri", "Vex"],
  Akali: ["Galio", "Lissandra", "Malzahar", "Vex"],
  Aphelios: ["Caitlyn", "Draven", "Nautilus", "Varus"],
  Ashe: ["Blitzcrank", "Draven", "Nautilus", "Samira"],
  Caitlyn: ["Jhin", "Sivir", "Varus", "Ziggs"],
  Darius: ["Gnar", "Jayce", "Quinn", "Vayne"],
  Draven: ["Ashe", "Caitlyn", "Nautilus", "Varus"],
  Ezreal: ["Caitlyn", "Draven", "Kalista", "Varus"],
  Fiora: ["Malphite", "Poppy", "Quinn", "Renekton"],
  Galio: ["Azir", "Cassiopeia", "Tristana", "Vladimir"],
  Gwen: ["Fiora", "Jax", "Renekton", "Tryndamere"],
  Hwei: ["Fizz", "Naafiri", "Talon", "Zed"],
  Jax: ["Gragas", "Kennen", "Malphite", "Poppy"],
  Jinx: ["Draven", "Nautilus", "Twitch", "Varus"],
  Kaisa: ["Caitlyn", "Draven", "Varus", "Xayah"],
  Kalista: ["Ashe", "Caitlyn", "Varus", "Vayne"],
  Karma: ["Blitzcrank", "Nautilus", "Pyke", "Rakan"],
  Leblanc: ["Galio", "Lissandra", "Malzahar", "Vex"],
  LeeSin: ["Ivern", "Poppy", "Rammus", "Sejuani"],
  Lissandra: ["Anivia", "Cassiopeia", "Orianna", "Viktor"],
  Lucian: ["Caitlyn", "Draven", "Varus", "Vayne"],
  Lux: ["Blitzcrank", "Nautilus", "Pyke", "Zyra"],
  Malphite: ["Gwen", "Mordekaiser", "Sylas", "Vladimir"],
  Milio: ["Blitzcrank", "Nautilus", "Pyke", "Rakan"],
  Nautilus: ["Janna", "Morgana", "Rakan", "Taric"],
  Nocturne: ["Ivern", "Lulu", "Poppy", "Rammus"],
  Orianna: ["Fizz", "Syndra", "Talon", "Zed"],
  Rakan: ["Janna", "Morgana", "Poppy", "Thresh"],
  Renekton: ["Gnar", "Kennen", "Quinn", "Vayne"],
  Sejuani: ["Ivern", "Lillia", "Olaf", "Trundle"],
  Seraphine: ["Blitzcrank", "Nautilus", "Pyke", "Zyra"],
  Tristana: ["Caitlyn", "Draven", "Syndra", "Varus"],
  Varus: ["Draven", "Nautilus", "Samira", "Sivir"],
  Viego: ["Ivern", "Poppy", "Rammus", "Sejuani"],
  Xayah: ["Caitlyn", "Jinx", "Seraphine", "Sivir"],
  Yunara: ["Caitlyn", "Draven", "Nautilus", "Varus"],
  Zeri: ["Caitlyn", "Draven", "Nautilus", "Varus"],
};

const COMPOSITION_TAG_DEFINITIONS = [
  ["blue side", "Tag de lecture pour les compos pensées côté bleu."],
  ["red side", "Tag de lecture pour les compos pensées côté rouge."],
  ["scrim", "Tag libre pour retrouver rapidement les compos travaillées en entraînement."],
  ["BO", "Tag libre pour les compos préparées dans une logique de série."],
];

function championSplashUrl(champion) {
  const id = championAssetId(champion);
  return id ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/" + id + "_0.jpg") : "";
}

function championLoadingUrl(champion) {
  const id = championAssetId(champion);
  return id ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/img/champion/loading/" + id + "_0.jpg") : "";
}

function championSquareUrl(rowOrChampion) {
  const champion = typeof rowOrChampion === "string" ? rowOrChampion : rowOrChampion?.champion;
  const id = championAssetId(champion);
  if (id) return assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/" + DDRAGON_VERSION + "/img/champion/" + id + ".png");
  const championId = rowOrChampion?.raw?.championId || rowOrChampion?.championId;
  return championId ? assetProxyUrl("https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/" + championId + ".png") : "";
}

function championIconUrl(row) {
  return championSquareUrl(row);
}

function championPortraitSources(rowOrChampion, explicitChampion = "") {
  const championId = rowOrChampion?.raw?.championId || rowOrChampion?.championId;
  const champion = explicitChampion || (typeof rowOrChampion === "string" ? rowOrChampion : rowOrChampion?.champion);
  const id = championAssetId(champion);
  return [...new Set([
    championId ? assetProxyUrl("https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/" + championId + ".png") : "",
    ...DDRAGON_FALLBACK_VERSIONS.map((version) => id ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/" + version + "/img/champion/" + id + ".png") : ""),
    id ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/img/champion/loading/" + id + "_0.jpg") : "",
  ].filter(Boolean))];
}

function ChampionPortrait({ champion, row, alt, className = "h-full w-full object-cover" }) {
  const sources = useMemo(() => championPortraitSources(row || champion, champion || row?.champion), [row, champion]);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [sources.join("|")]);
  const source = sources[sourceIndex];
  if (!source) return <div className={cx("flex items-center justify-center bg-gradient-to-br from-cyan-400/18 via-blue-500/10 to-fuchsia-500/18 text-[0.6rem] font-black text-cyan-100", className)}>{String(alt || champion || row?.champion || "?").slice(0, 2).toUpperCase()}</div>;
  return <img src={source} alt={alt || champion || row?.champion || "Champion"} className={className} loading="lazy" onError={() => setSourceIndex((index) => index + 1)} />;
}

function championSplashFocus(champion, focus = "default") {
  if (focus !== "face") return "center center";
  const id = championAssetId(champion);
  const overrides = {
    Aatrox: "50% 18%",
    Alistar: "48% 20%",
    AurelionSol: "52% 18%",
    Azir: "50% 22%",
    Bard: "50% 20%",
    Blitzcrank: "48% 22%",
    Chogath: "48% 18%",
    Darius: "25% 23%",
    Galio: "50% 18%",
    Hecarim: "50% 22%",
    JarvanIV: "64% 25%",
    Jhin: "48% 24%",
    Karma: "64% 26%",
    Khazix: "48% 20%",
    KogMaw: "50% 24%",
    Lissandra: "46% 24%",
    Malphite: "50% 20%",
    Nautilus: "50% 20%",
    Nocturne: "50% 22%",
    Ornn: "50% 22%",
    Rammus: "50% 24%",
    RekSai: "50% 22%",
    Renata: "48% 24%",
    Skarner: "50% 20%",
    TahmKench: "50% 24%",
    Thresh: "50% 22%",
    Velkoz: "50% 20%",
    Warwick: "50% 22%",
    Yunara: "58% 26%",
    Zac: "50% 22%",
  };
  return overrides[id] || "50% 22%";
}

function ChampionBackdrop({ champion, focus = "default" }) {
  const url = championSplashUrl(champion);
  if (!url) return null;
  const focused = focus === "face";
  const position = championSplashFocus(champion, focus);
  return <div className={cx("absolute inset-0", focused ? "opacity-58" : "opacity-42")}><img src={url} alt="" className="h-full w-full object-cover saturate-[1.18] blur-[1.5px]" style={{ objectPosition: position, transform: focused ? "scale(2.25)" : "scale(1.08)", transformOrigin: position }} /><div className={cx("absolute inset-0", focused ? "bg-gradient-to-r from-[#050711]/82 via-[#050711]/60 to-[#050711]/28" : "bg-gradient-to-r from-[#070b16]/90 via-[#070b16]/70 to-[#070b16]/25")} /></div>;
}

function StatBar({ value, max, tone: t = "cyan" }) {
  const width = Math.max(4, Math.min(100, (Number(value || 0) / Math.max(1, Number(max || 1))) * 100));
  return <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={cx("h-full rounded-full", t === "red" ?"bg-rose-300" : t === "green" ?"bg-emerald-300" : t === "yellow" ?"bg-amber-300" : "bg-cyan-300")} style={{ width: String(width) + "%" }} /></div>;
}

function MatchChampionStrip({ rows }) {
  const ally = rows.filter((row) => row.team_key === "ALLY").slice(0, 5);
  if (!ally.length) return null;
  return <div className="flex flex-wrap gap-2">{ally.map((row) => <div key={row.id || String(row.riot_id) + "-" + row.champion} className="group relative h-24 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2"><p className="truncate text-[0.65rem] font-black text-white">{row.role || "?"}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">{championDisplayName(row.champion)}</p></div></div>)}</div>;
}

function LatestMatchPanel({ match, onOpen }) {
  if (!match) return null;
  const ally = match.participants?.filter((row) => row.team_key === "ALLY") || [];
  const kills = ally.reduce((sum, row) => sum + Number(row.kills || 0), 0);
  const deaths = ally.reduce((sum, row) => sum + Number(row.deaths || 0), 0);
  const assists = ally.reduce((sum, row) => sum + Number(row.assists || 0), 0);
  const damage = ally.reduce((sum, row) => sum + Number(row.damage || 0), 0);
  const vision = ally.reduce((sum, row) => sum + Number(row.vision || 0), 0);
  return <button onClick={onOpen} className="mt-5 w-full rounded-[1.35rem] border border-cyan-300/20 bg-cyan-400/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-cyan-400/15"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ?"green" : "red"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.patch || "Patch ?"}</Badge><Badge tone="blue">{match.side || "Side ?"}</Badge></div><h4 className="mt-3 text-2xl font-black text-white">{match.game_id}</h4><p className="mt-1 text-sm font-semibold text-slate-400">{match.duration || "--:--"}</p></div><MatchChampionStrip rows={ally} /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">KDA équipe</p><p className="mt-1 text-lg font-black text-white">{kills}/{deaths}/{assists}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Dégâts</p><p className="mt-1 text-lg font-black text-white">{formatPoints(damage)}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Vision</p><p className="mt-1 text-lg font-black text-white">{vision}</p></div></div></button>;
}

const COMP_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const ROLE_ORDER = Object.fromEntries(COMP_ROLES.map((role, index) => [role, index]));

function sortPlayersByRole(players = []) {
  return [...players].sort((a, b) => (ROLE_ORDER[String(a.role || "").toUpperCase()] ?? 99) - (ROLE_ORDER[String(b.role || "").toUpperCase()] ?? 99) || String(a.name || "").localeCompare(String(b.name || "")));
}
const STAFF_ROLES = ["COACH", "ASSISTANT", "ANALYST", "MANAGER", "BOARD"];
const PROFILE_ROLES = [...COMP_ROLES, "SUB", ...STAFF_ROLES];
const ROSTER_ROLE_ORDER = COMP_ROLES;
const TEAM_ACCESS_ROLES = [
  ["player", "Joueur"],
  ["coach", "Coach"],
  ["assistant", "Assistant coach"],
  ["analyst", "Analyste"],
  ["manager", "Manager"],
  ["board", "Board"],
  ["captain", "Capitaine"],
];
const STAFF_ACCESS_ROLE_IDS = TEAM_ACCESS_ROLES.map(([id]) => id).filter((id) => id !== "player");

function canStaffManage(role) {
  return ["owner", ...STAFF_ACCESS_ROLE_IDS].includes(String(role || "").toLowerCase());
}

function isGameplayRole(role) {
  return [...COMP_ROLES, "SUB"].includes(String(role || "").toUpperCase());
}

function rosterRoleIndex(role) {
  const normalized = String(role || "").toUpperCase();
  const index = [...COMP_ROLES, "SUB"].indexOf(normalized);
  return index === -1 ? 99 : index;
}

function isStaffRole(role) {
  return STAFF_ROLES.includes(String(role || "").toUpperCase());
}

function roleLabel(role) {
  return {
    TOP: "Top",
    JGL: "Jungle",
    MID: "Mid",
    ADC: "ADC",
    SUP: "Support",
    SUB: "Remplaçant",
    COACH: "Coach",
    ASSISTANT: "Assistant coach",
    ANALYST: "Analyste",
    MANAGER: "Manager",
    BOARD: "Board",
    OWNER: "Owner",
    CAPTAIN: "Capitaine",
    STAFF: "Staff",
  }[String(role || "").toUpperCase()] || String(role || "Profil");
}

function RoleTag({ role, staff = false, className = "" }) {
  const label = roleLabel(role);
  return (
    <Badge tone={staff ? "purple" : "blue"} className={cx("overflow-hidden justify-center px-2 sm:justify-start sm:px-2.5", className)} title={label}>
      <span className="block max-w-full truncate">{label}</span>
    </Badge>
  );
}

function decodeLoose(value) {
  let output = String(value || "").replace(/\+/g, " ");
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(output);
      if (decoded === output) break;
      output = decoded;
    } catch {
      break;
    }
  }
  return output;
}

function parseMultiOpgg(input) {
  const text = decodeLoose(input);
  const players = [];
  const seen = new Set();

  function addRiotId(name, tag) {
    const cleanName = String(name || "").trim().replace(/\s+/g, " ");
    const cleanTag = String(tag || "").trim().toUpperCase();
    if (!cleanName || !cleanTag) return;
    const riotId = `${cleanName}#${cleanTag}`;
    const key = riotId.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    players.push({ name: cleanName, riotId });
  }

  const riotIdPattern = /([A-Za-z0-9À-ÿ _.'-]{2,32})\s*#\s*([A-Za-z0-9]{2,8})/g;
  for (const match of text.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);

  const urlPattern = /https?:\/\/\S+/g;
  for (const urlText of text.match(urlPattern) || []) {
    try {
      const url = new URL(urlText);
      const summoners = [
        ...url.searchParams.getAll("summoners"),
        ...url.searchParams.getAll("summoner"),
        ...url.searchParams.getAll("summonerName"),
      ].join(",");
      for (const entry of decodeLoose(summoners).split(/[,;\n|]+/)) {
        for (const match of entry.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);
      }
    } catch {}
  }

  const opggPathPattern = /(?:summoners\/|^)(?:[a-z]{2,5}\/)?([^/?#&,;|\n]+)-([A-Za-z0-9]{2,8})/gi;
  for (const match of text.matchAll(opggPathPattern)) {
    addRiotId(decodeLoose(match[1]).replace(/-/g, " "), match[2]);
  }

  return players;
}

function opggUrlFromRiotId(riotId, region) {
  const [name, tag] = String(riotId).split("#");
  if (!name || !tag) return "";
  const slug = encodeURIComponent(`${name}-${tag}`);
  return `https://www.op.gg/lol/summoners/${String(region || "EUW").toLowerCase()}/${slug}`;
}

function multiOpggUrlFromRoster(roster, region) {
  const summoners = roster
    .filter((player) => isGameplayRole(player.role))
    .map((player) => {
      const [name, tag] = String(player.riot_id || "").split("#").map((part) => part.trim());
      return name && tag ?`${name}#${tag}` : "";
    })
    .filter(Boolean);

  if (!summoners.length) return "";
  return `https://www.op.gg/lol/multisearch/${String(region || "EUW").toLowerCase()}?summoners=${encodeURIComponent(summoners.join(","))}`;
}

function Teams({ data, refreshAll, selectedTeamId, setSelectedTeamId, currentMember, routeSearch = "", pushToast, user, managementOnly = false }) {
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", region: "EUW", multiOpgg: "" });
  const [playerForm, setPlayerForm] = useState({ name: "", riotId: "", opggUrl: "", role: "TOP" });
  const [joinCode, setJoinCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingPlayerId, setSyncingPlayerId] = useState("");
  const [teamSetupOpen, setTeamSetupOpen] = useState(false);
  const [riotCooldownUntil, setRiotCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [teamEdit, setTeamEdit] = useState({ name: "", tag: "", avatarDataUrl: "", avatarZoom: 1, avatarX: 50, avatarY: 50 });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerEditForm, setPlayerEditForm] = useState({ name: "", riotId: "", opggUrl: "" });
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0];
  const roster = selectedTeam ?data.players.filter((player) => player.team_id === selectedTeam.id) : [];
  const gameplayRoster = roster.filter((player) => isGameplayRole(player.role));
  const teamMembers = selectedTeam ?(data.teamMembers || []).filter((member) => member.team_id === selectedTeam.id) : [];
  const inviteCodes = selectedTeam ?(data.inviteCodes || []).filter((code) => code.team_id === selectedTeam.id) : [];
  const multiPlayers = useMemo(() => parseMultiOpgg(teamForm.multiOpgg), [teamForm.multiOpgg]);
  const hasTeams = data.teams.length > 0;
  const canManageTeam = canStaffManage(currentMember?.role);
  const canDeleteTeam = ["owner", "captain"].includes(String(currentMember?.role || "").toLowerCase());
  const riotCooldownSeconds = Math.max(0, Math.ceil((riotCooldownUntil - nowTick) / 1000));

  useEffect(() => {
    if (!selectedTeamId && data.teams[0]?.id) setSelectedTeamId(data.teams[0].id);
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite && !joinCode) setJoinCode(invite);
  }, [data.teams, selectedTeamId, setSelectedTeamId, joinCode]);

  useEffect(() => {
    const params = new URLSearchParams(routeSearch || window.location.search);
    setTeamSetupOpen(!hasTeams && params.get("create") === "1");
  }, [routeSearch, hasTeams]);

  useEffect(() => {
    if (!riotCooldownUntil) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [riotCooldownUntil]);

  useEffect(() => {
    if (!selectedTeam) return;
    setTeamEdit({
      name: selectedTeam.name || "",
      tag: selectedTeam.tag || "",
      avatarDataUrl: selectedTeam.avatar_data_url || "",
      avatarZoom: Number(selectedTeam.avatar_zoom || 1),
      avatarX: Number(selectedTeam.avatar_x ?? 50),
      avatarY: Number(selectedTeam.avatar_y ?? 50),
    });
  }, [selectedTeam?.id]);

  async function createTeam(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch("teams-create", { method: "POST", body: JSON.stringify({ name: teamForm.name, tag: teamForm.tag, region: teamForm.region }) });
      const createdTeam = result.team;
      let importedCount = 0;
      for (const [index, player] of multiPlayers.entries()) {
        await apiFetch("players-create", {
          method: "POST",
          body: JSON.stringify({
            teamId: createdTeam.id,
            name: player.name,
            riotId: player.riotId,
            opggUrl: opggUrlFromRiotId(player.riotId, teamForm.region),
            role: ROSTER_ROLE_ORDER[index] || "SUB",
          }),
        });
        importedCount += 1;
      }
      setTeamForm({ name: "", tag: "", region: "EUW", multiOpgg: "" });
      setSelectedTeamId(createdTeam.id);
      setTeamSetupOpen(false);
      await refreshAll();
      pushToast({ type: "green", title: "Team créée", text: importedCount ?`${importedCount} joueur${importedCount > 1 ?"s" : ""} importé${importedCount > 1 ?"s" : ""} depuis le multi OP.GG.` : "Tu peux maintenant ajouter le roster ou générer un code d’invitation." });
    } catch (err) {
      pushToast({ type: "red", title: "Création impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function joinTeam(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("teams-join", { method: "POST", body: JSON.stringify({ invite: joinCode }) });
      setJoinCode("");
      setTeamSetupOpen(false);
      await refreshAll();
      pushToast({ type: "green", title: "Team rejointe", text: "Tu as maintenant accès à cette structure." });
    } catch (err) {
      pushToast({ type: "red", title: "Invitation invalide", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function createPlayer(event) {
    event.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("players-create", { method: "POST", body: JSON.stringify({ ...playerForm, teamId: selectedTeam.id }) });
      setPlayerForm({ name: "", riotId: "", opggUrl: "", role: "TOP" });
      await refreshAll();
      pushToast({ type: "green", title: isStaffRole(playerForm.role) ? "Staff ajouté" : "Joueur ajouté", text: "Roster mis à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      const result = await apiFetch("teams-invite-code", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      await navigator.clipboard.writeText(result.code);
      await refreshAll();
      pushToast({ type: "green", title: "Code d’invitation copié", text: `${result.code} est valable 1h maximum.` });
    } catch (err) {
      pushToast({ type: "red", title: "Code impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyMultiOpggLink() {
    if (!selectedTeam || !gameplayRoster.length) return;
    const link = multiOpggUrlFromRoster(gameplayRoster, selectedTeam.region);
    if (!link) {
      pushToast({ type: "red", title: "Multi OP.GG impossible", text: "Ajoute des Riot IDs au format Pseudo#TAG." });
      return;
    }
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "Multi OP.GG copié", text: `${gameplayRoster.length} joueur${gameplayRoster.length > 1 ?"s" : ""} dans le lien.` });
  }

  async function copyPlayerOpggLink(player) {
    const link = String(player?.opgg_url || "").trim() || opggUrlFromRiotId(player?.riot_id, selectedTeam?.region);
    if (!link) {
      pushToast({ type: "red", title: "OP.GG introuvable", text: "Ajoute un Riot ID ou un lien OP.GG sur ce profil." });
      return;
    }
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "OP.GG copié", text: `${player?.name || "Profil"} est dans le presse-papiers.` });
  }

  function openPlayerEdit(player) {
    setEditingPlayer(player);
    setPlayerEditForm({
      name: player?.name || "",
      riotId: player?.riot_id || "",
      opggUrl: player?.opgg_url || "",
    });
  }

  function closePlayerEdit() {
    setEditingPlayer(null);
    setPlayerEditForm({ name: "", riotId: "", opggUrl: "" });
  }

  async function updatePlayer(event) {
    event.preventDefault();
    if (!selectedTeam || !editingPlayer) return;
    setSaving(true);
    try {
      await apiFetch("players-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: editingPlayer.id, ...playerEditForm }) });
      closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil modifié", text: "Nom, Riot ID et OP.GG sont à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function linkPlayerAccount(playerId, userId) {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("players-link-account", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId, userId: userId || null }) });
      await refreshAll();
      pushToast({ type: "green", title: userId ?"Compte lié" : "Compte délié", text: "La gestion de la team est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Liaison impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateMemberRole(userId, role) {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("team-member-role", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId, role }) });
      await refreshAll();
      pushToast({ type: "green", title: "Statut mis à jour", text: "Le profil reflète son rôle dans la team." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function loadTeamAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast({ type: "red", title: "Avatar invalide", text: "Choisis une image depuis ton PC." });
      return;
    }
    if (file.size > 900000) {
      pushToast({ type: "yellow", title: "Image trop lourde", text: "Prends une image sous 900 Ko pour garder l’avatar léger." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setTeamEdit((current) => ({ ...current, avatarDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  async function updateTeam(event) {
    event.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("teams-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, ...teamEdit }) });
      await refreshAll();
      pushToast({ type: "green", title: "Team mise à jour", text: "Nom et avatar sont synchronisés." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId, label) {
    if (!selectedTeam) return;
    if (!window.confirm(`Renvoyer ${label || "ce profil"} de la team ?`)) return;
    setSaving(true);
    try {
      await apiFetch("team-member-remove", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Profil renvoyé", text: "Le compte n'a plus accès à cette team." });
    } catch (err) {
      pushToast({ type: "red", title: "Renvoi impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(playerId, label) {
    if (!selectedTeam) return;
    if (!window.confirm(`Supprimer le profil "${label || "sélectionné"}" du roster ?`)) return;
    setSaving(true);
    try {
      await apiFetch("players-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId }) });
      if (editingPlayer?.id === playerId) closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil supprimé", text: "Le roster de gestion est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function syncPlayerMostPlayed(player) {
    if (!selectedTeam || !player) return;
    if (riotCooldownSeconds > 0) {
      pushToast({ type: "yellow", title: "Riot refroidit", text: `Réessaie dans ${formatCountdown(riotCooldownSeconds)}.` });
      return;
    }
    setSyncingPlayerId(player.id);
    try {
      const result = await apiFetch("players-sync-most-played", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: player.id }) });
      await refreshAll();
      const firstFailed = result.results?.find((item) => !item.ok);
      if (firstFailed?.code === "RIOT_RATE_LIMIT") {
        const retryAfter = Number(firstFailed.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      if (firstFailed) {
        pushToast({ type: "yellow", title: "Analyse incomplète", text: `${player.name} n'a pas été analysé : ${firstFailed.error}` });
      } else {
        pushToast({ type: "green", title: "Profil analysé", text: `${player.name} est à jour.` });
      }
    } catch (err) {
      if (err.code === "RIOT_RATE_LIMIT" || err.status === 429) {
        const retryAfter = Number(err.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      pushToast({ type: "red", title: "Analyse impossible", text: err.message });
    } finally {
      setSyncingPlayerId("");
    }
  }

  async function deleteTeam() {
    if (!selectedTeam) return;
    const confirmed = window.confirm(`Supprimer définitivement la team "${selectedTeam.name}" ? Cette action supprime aussi roster, matchs, reviews et invitations liés.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await apiFetch("teams-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      setSelectedTeamId(null);
      await refreshAll();
      pushToast({ type: "green", title: "Team supprimée", text: "La structure et ses données liées ont été supprimées." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (managementOnly) return <div className="nxt5-data-dense"><PageHeader eyebrow="Gestion" title="Gestion de l’équipe" subtitle="Permissions, liaisons de comptes et création de profils. La lecture sportive reste dans l’onglet Équipe." />{selectedTeam ? <TeamManagementPanel team={selectedTeam} edit={teamEdit} setEdit={setTeamEdit} onAvatarFile={loadTeamAvatar} onSaveTeam={updateTeam} onCopyInvite={copyInviteLink} canManage={canManageTeam} canDeleteTeam={canDeleteTeam} members={teamMembers} roster={roster} inviteCodes={inviteCodes} saving={saving} onRoleChange={updateMemberRole} onLink={linkPlayerAccount} onRemoveMember={removeMember} onDeletePlayer={deletePlayer} onDeleteTeam={deleteTeam} playerForm={playerForm} setPlayerForm={setPlayerForm} onCreatePlayer={createPlayer} editingPlayer={editingPlayer} playerEditForm={playerEditForm} setPlayerEditForm={setPlayerEditForm} onUpdatePlayer={updatePlayer} onClosePlayerEdit={closePlayerEdit} onEditPlayer={openPlayerEdit} /> : <Surface glow><EmptyState icon={Users} title="Aucune équipe" text="Crée ou rejoins une équipe avant d’ouvrir la gestion." /></Surface>}</div>;

  return <div><PageHeader eyebrow="Team manager" title={hasTeams ?"Ton équipe" : "Créer ou rejoindre une team"} subtitle={hasTeams ?"Roster, champions joués et statistiques de profils de l’équipe active." : "Choisis clairement ton entrée : créer ta structure ou rejoindre une team avec un code temporaire."} />
    <div className={cx("grid gap-5", !hasTeams && "xl:grid-cols-2")}>
      {!hasTeams && <div className="space-y-5">
        <Surface glow>
          <h3 className="text-xl font-black text-white">Créer une team</h3>
          <p className="mt-1 text-sm text-slate-300">Pour lancer une nouvelle structure, créer son roster et importer ses games.</p>
          <form onSubmit={createTeam} className="mt-5 space-y-4">
            <TextInput label="Nom de team" value={teamForm.name} onChange={(name) => setTeamForm({ ...teamForm, name })} placeholder="Nom de l'équipe" required icon={Trophy} />
            <TextInput label="Tag" value={teamForm.tag} onChange={(tag) => setTeamForm({ ...teamForm, tag })} placeholder="TAG" required icon={Shield} />
            <SelectInput label="Région" value={teamForm.region} onChange={(region) => setTeamForm({ ...teamForm, region })}><option>EUW</option><option>EUNE</option><option>NA</option><option>KR</option><option>BR</option><option>LAN</option><option>LAS</option><option>JP</option><option>OCE</option><option>TR</option></SelectInput>
            <TextAreaInput label="Multi OP.GG ou Riot IDs" value={teamForm.multiOpgg} onChange={(multiOpgg) => setTeamForm({ ...teamForm, multiOpgg })} placeholder={"Colle un lien multi OP.GG ou une liste :\nToplaner#EUW\nJungler#EUW\nMidlaner#EUW\nADC#EUW\nSupport#EUW"} icon={Clipboard} />
            {multiPlayers.length > 0 && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{multiPlayers.length} joueur{multiPlayers.length > 1 ?"s" : ""} détecté{multiPlayers.length > 1 ?"s" : ""}</p><div className="mt-2 flex flex-wrap gap-2">{multiPlayers.map((player, index) => <Badge key={player.riotId} tone={index < 5 ?"cyan" : "slate"}>{ROSTER_ROLE_ORDER[index] || "SUB"} · {player.riotId}</Badge>)}</div></div>}
            <Button type="submit" disabled={saving} icon={saving ?Loader2 : Plus} className="w-full">Créer la team</Button>
          </form>
        </Surface>

        <Surface glow>
          <h3 className="text-xl font-black text-white">Rejoindre une team</h3>
          <p className="mt-1 text-sm text-slate-300">Demande au coach, manager ou capitaine un code temporaire. Il expire après 1h.</p>
          <form onSubmit={joinTeam} className="mt-5 space-y-4">
            <TextInput label="Code d’invitation" value={joinCode} onChange={setJoinCode} placeholder="NXT5-ABC123" required icon={UserPlus} />
            <Button type="submit" disabled={saving || !joinCode.trim()} icon={saving ?Loader2 : ArrowRight} className="w-full">Rejoindre la team</Button>
          </form>
        </Surface>

      </div>}

      {selectedTeam && <Surface glow>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h3 className="text-2xl font-black text-white">{selectedTeam.name}</h3><p className="mt-1 text-sm text-slate-300">Roster lisible, champions joués et statistiques de profils.</p></div>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" icon={Clipboard} onClick={copyMultiOpggLink} disabled={!gameplayRoster.length}>Multi OP.GG</Button><Badge tone="purple">{selectedTeam.tag || "TEAM"}</Badge></div>
        </div>

        <>
          <PremiumRosterTable roster={roster} matches={data.matches || []} region={selectedTeam.region} currentUserId={user?.id} />
        </>
      </Surface>}
    </div>
  </div>;
}

function formatPoints(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const abs = Math.abs(number);
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${abs}`;
}

function towerDamage(row) {
  return Number(row?.damage_to_turrets ?? row?.damageToTurrets ?? row?.raw?.damageDealtToTurrets ?? row?.raw?.damageToTurrets ?? row?.raw?.damage_to_turrets ?? 0);
}

function formatGoldDiff(value) {
  const number = Math.round(Number(value || 0));
  return `${number >= 0 ? "+" : "-"}${Math.abs(number)}`;
}

function oppositeSideKey(side) {
  return side === "blue" ? "red" : side === "red" ? "blue" : "";
}

function matchTeamSideKey(match, teamKey) {
  const teamId = objectiveTeamId(match, teamKey);
  if (teamId === 100) return "blue";
  if (teamId === 200) return "red";
  const allySide = String(match?.side || "").toLowerCase();
  const side = allySide.includes("blue") ? "blue" : allySide.includes("red") ? "red" : "";
  if (!side) return "";
  return teamKey === "ALLY" ? side : oppositeSideKey(side);
}

function winningSideForDiff(match, value) {
  const diff = Number(value || 0);
  if (!diff) return "tie";
  const allySide = matchTeamSideKey(match, "ALLY");
  if (!allySide) return diff > 0 ? "ally" : "enemy";
  return diff > 0 ? allySide : oppositeSideKey(allySide);
}

function winningTeamForDiff(value) {
  const diff = Number(value || 0);
  if (!diff) return "tie";
  return diff > 0 ? "ally" : "enemy";
}

async function exportStatsPng({ title, subtitle, matches, filename }) {
  const scoped = Array.isArray(matches) ? matches.filter(Boolean) : [];
  const rows = scoped.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY").map((row) => ({ ...row, match })));
  const enemyRows = scoped.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ENEMY"));
  const sum = (items, key) => items.reduce((total, row) => total + Number(row[key] || 0), 0);
  const roleOrder = ["TOP", "JGL", "MID", "ADC", "SUP"];
  const rowName = (row) => row?.summoner_name || row?.riot_id || row?.player_name || "Inconnu";
  const short = (value, max = 28) => String(value || "").length > max ? `${String(value).slice(0, max - 1)}…` : String(value || "");
  const kdaRatio = (row) => ((Number(row?.kills || 0) + Number(row?.assists || 0)) / Math.max(1, Number(row?.deaths || 0)));
  const sideName = (match, teamKey) => {
    const teamId = objectiveTeamId(match, teamKey);
    if (teamId === 100) return "Côté bleu";
    if (teamId === 200) return "Côté rouge";
    return teamKey === "ALLY" ? "Alliés" : "Adversaires";
  };
  const wins = scoped.filter((match) => match.result === "Victoire").length;
  const games = scoped.length;
  const kills = sum(rows, "kills");
  const deaths = sum(rows, "deaths");
  const assists = sum(rows, "assists");
  const damageDiff = sum(rows, "damage") - sum(enemyRows, "damage");
  const goldDiff = sum(rows, "gold") - sum(enemyRows, "gold");
  const visionDiff = sum(rows, "vision") - sum(enemyRows, "vision");
  const topDamage = rows.slice().sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0))[0];
  const topVision = rows.slice().sort((a, b) => Number(b.vision || 0) - Number(a.vision || 0))[0];
  const topKda = rows.slice().sort((a, b) => kdaRatio(b) - kdaRatio(a))[0];
  const buildChampionCounts = (items) => Array.from(items.reduce((map, row) => {
    const champion = row?.champion;
    if (champion) map.set(champion, (map.get(champion) || 0) + 1);
    return map;
  }, new Map()).entries()).sort((a, b) => b[1] - a[1] || championDisplayName(a[0]).localeCompare(championDisplayName(b[0])));
  const allyChampionCounts = buildChampionCounts(rows);
  const enemyChampionCounts = buildChampionCounts(enemyRows);
  const allChampionCounts = [...allyChampionCounts, ...enemyChampionCounts];
  const firstMatch = scoped[0];
  const singleGame = scoped.length === 1;
  const allyObjectives = firstMatch ? objectiveTeamSummary(firstMatch, "ALLY") : null;
  const enemyObjectives = firstMatch ? objectiveTeamSummary(firstMatch, "ENEMY") : null;
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const rounded = (x, y, w, h, r = 28) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke(); };
  const fitText = (text, x, y, maxWidth, { font, color = "#fff", min = 12, align = "left" } = {}) => {
    const source = String(text || "");
    const match = String(font || "800 20px Inter, Arial, sans-serif").match(/(\d+)px/);
    const baseSize = match ? Number(match[1]) : 20;
    let size = baseSize;
    let nextFont = font || "800 20px Inter, Arial, sans-serif";
    ctx.font = nextFont;
    while (ctx.measureText(source).width > maxWidth && size > min) {
      size -= 1;
      nextFont = nextFont.replace(/\d+px/, `${size}px`);
      ctx.font = nextFont;
    }
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(source, x, y);
    ctx.textAlign = "left";
  };
  const imageCache = new Map();
  const loadCanvasImage = (url) => new Promise((resolve) => {
    if (!url) return resolve(null);
    if (imageCache.has(url)) return resolve(imageCache.get(url));
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
  const drawImageCover = (img, x, y, w, h, radius = 18) => {
    if (!img) return false;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
    const ratio = Math.max(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    return true;
  };
  const drawImageContain = (img, x, y, w, h) => {
    if (!img) return false;
    const ratio = Math.min(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return true;
  };
  const drawCachedImage = (sourceOrSources, x, y, w, h, radius = 14) => {
    const sources = Array.isArray(sourceOrSources) ? sourceOrSources : [sourceOrSources];
    const img = sources.map((url) => imageCache.get(url)).find(Boolean);
    if (drawImageCover(img, x, y, w, h, radius)) return;
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 1;
    rounded(x, y, w, h, radius);
  };
  const drawHeraldObjectiveIcon = (x, y, size = 28) => {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2;
    const gradient = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.32, r * 0.2, cx, cy, r);
    gradient.addColorStop(0, "#f0abfc");
    gradient.addColorStop(0.48, "#7c3aed");
    gradient.addColorStop(1, "#251047");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.34)";
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.stroke();
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.moveTo(cx, y + size * 0.2);
    ctx.lineTo(x + size * 0.64, y + size * 0.48);
    ctx.lineTo(cx, y + size * 0.8);
    ctx.lineTo(x + size * 0.36, y + size * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(2,5,17,.72)";
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.stroke();
    ctx.fillStyle = "#fdf4ff";
    ctx.beginPath();
    ctx.arc(cx, y + size * 0.48, size * 0.095, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const drawObjectiveIcon = (type, x, y, size = 28, radius = 8) => {
    if (type === "herald") return drawHeraldObjectiveIcon(x, y, size);
    drawCachedImage(OBJECTIVE_ICON_SOURCES[type] || OBJECTIVE_ICON_SOURCES.dragon, x, y, size, size, radius);
  };
  const accentColor = (accent = "cyan") => accent === "pink" ? "#f472b6" : accent === "green" ? "#34d399" : accent === "yellow" ? "#facc15" : "#67e8f9";
  const accentSoft = (accent = "cyan", alpha = 0.16) => accent === "pink" ? `rgba(244,114,182,${alpha})` : accent === "green" ? `rgba(52,211,153,${alpha})` : accent === "yellow" ? `rgba(250,204,21,${alpha})` : `rgba(103,232,249,${alpha})`;
  const drawLine = (x1, y1, x2, y2, color = "rgba(255,255,255,.10)", width = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const drawPill = (text, x, y, fill = "rgba(34,211,238,.10)", stroke = "rgba(34,211,238,.22)", color = "#e8fbff") => {
    ctx.font = "900 16px Inter, Arial, sans-serif";
    const width = Math.min(300, Math.max(82, ctx.measureText(text).width + 30));
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    rounded(x, y, width, 32, 16);
    ctx.fillStyle = color;
    ctx.fillText(text, x + 15, y + 22);
    return width;
  };
  const drawPanel = (x, y, w, h, accent = "cyan", alpha = 0.72) => {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, accentSoft(accent, 0.12));
    gradient.addColorStop(0.38, `rgba(5,10,24,${alpha})`);
    gradient.addColorStop(1, "rgba(5,10,24,.48)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = accentSoft(accent, 0.34);
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = accentColor(accent);
    ctx.fillRect(x, y, 4, h);
  };
  const drawMetric = (label, value, detail, x, y, w, accent = "cyan", marker = "") => {
    const markerMeta = metricSideMarkerMeta(marker);
    ctx.fillStyle = accentColor(accent);
    ctx.font = "900 13px Inter, Arial, sans-serif";
    ctx.fillText(label.toUpperCase(), x + 22, y + 31);
    if (markerMeta) {
      const markerText = markerMeta.text.toUpperCase();
      ctx.font = "900 11px Inter, Arial, sans-serif";
      const markerW = Math.min(86, Math.max(54, ctx.measureText(markerText).width + 18));
      const markerX = x + w - markerW - 18;
      ctx.fillStyle = accentSoft(markerMeta.canvasAccent, 0.18);
      ctx.strokeStyle = accentSoft(markerMeta.canvasAccent, 0.42);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(markerX, y + 16, markerW, 20, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accentColor(markerMeta.canvasAccent);
      fitText(markerText, markerX + markerW / 2, y + 30, markerW - 10, { font: "900 11px Inter, Arial, sans-serif", color: accentColor(markerMeta.canvasAccent), min: 8, align: "center" });
    }
    fitText(short(value, 16), x + 22, y + 66, w - 44, { font: "900 30px Inter, Arial, sans-serif", color: "#ffffff", min: 18 });
    fitText(short(detail, 28), x + 22, y + 84, w - 44, { font: "800 13px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
  };
  const drawPlayerRow = (row, x, y, w, align = "left") => {
    const right = align === "right";
    const kda = `${row?.kills || 0}/${row?.deaths || 0}/${row?.assists || 0}`;
    const spells = row ? summonerSpellIds(row).filter(Boolean) : [];
    const build = row ? finalBuildItems(row).slice(0, 6) : [];
    const portraitSources = championPortraitSources(row, row?.champion);
    ctx.fillStyle = right ? "rgba(244,114,182,.045)" : "rgba(34,211,238,.045)";
    ctx.fillRect(x, y, w, 62);
    drawLine(x, y + 62, x + w, y + 62, "rgba(255,255,255,.09)", 1);
    const portraitX = x + 14;
    drawCachedImage(portraitSources, portraitX, y + 10, 42, 42, 8);
    ctx.strokeStyle = right ? "rgba(244,114,182,.28)" : "rgba(103,232,249,.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(portraitX, y + 10, 42, 42, 8);
    ctx.stroke();
    ctx.textAlign = "left";
    fitText(short(rowName(row), 24), x + 70, y + 24, 192, { font: "900 16px Inter, Arial, sans-serif", color: "#ffffff", min: 12 });
    fitText(short(`${row?.role || "ROLE"} · ${championDisplayName(row?.champion || "Champion ?")}`, 32), x + 70, y + 45, 230, { font: "800 12px Inter, Arial, sans-serif", color: right ? "#fbcfe8" : "#bffaff", min: 10 });
    fitText(kda, x + 312, y + 24, 70, { font: "900 16px Inter, Arial, sans-serif", color: "#ffffff", min: 11 });
    fitText(`${Math.round(parsePercent(row?.kill_participation || row?.kp || 0))}% KP`, x + 386, y + 24, 70, { font: "800 12px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    fitText(`${creepScore(row)} CS`, x + 312, y + 45, 70, { font: "800 12px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    fitText(`${formatPoints(row?.gold)} G`, x + 458, y + 24, 88, { font: "900 13px Inter, Arial, sans-serif", color: "#ffffff", min: 10 });
    fitText(`${formatPoints(row?.damage)} D`, x + 548, y + 24, 96, { font: "900 13px Inter, Arial, sans-serif", color: "#ffffff", min: 10 });
    fitText(`${row?.vision || 0} VS`, x + 458, y + 45, 86, { font: "800 12px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    const iconY = y + 36;
    const iconStart = x + w - 178;
    spells.slice(0, 2).forEach((spell, index) => drawCachedImage(summonerSpellIconSources(spell), iconStart + index * 21, iconY, 18, 18, 4));
    build.forEach((item, index) => drawCachedImage(itemIconSources(item.id), iconStart + 48 + index * 21, iconY, 18, 18, 4));
    ctx.textAlign = "left";
  };
  const drawObjectiveSide = (label, data, x, y, w, accent = "cyan") => {
    ctx.fillStyle = accentColor(accent);
    ctx.font = "900 14px Inter, Arial, sans-serif";
    ctx.fillText(label.toUpperCase(), x, y + 22);
    const objectiveCells = [
      ["Drakes", data?.dragonCount || 0, "dragon"],
      ["Grubs", data?.grubs || 0, "grub"],
      ["Herald", data?.heralds || 0, "herald"],
      ["Nashor", data?.barons || 0, "baron"],
      ["Tours", data?.towers || 0, "tower"],
    ];
    objectiveCells.forEach(([name, value, type], index) => {
      const cx = x + index * (w / 5);
      drawObjectiveIcon(type, cx, y + 40, 28, 8);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 22px Inter, Arial, sans-serif";
      ctx.fillText(String(value), cx + 36, y + 62);
      ctx.fillStyle = "#c7d4e5";
      ctx.font = "800 10px Inter, Arial, sans-serif";
      ctx.fillText(name.toUpperCase(), cx, y + 88);
    });
    const dragons = (data?.dragons || []).map((dragon) => objectiveDragonElement(dragon)).filter(Boolean);
    if (dragons.length) {
      ctx.fillStyle = "#d8f8ff";
      ctx.font = "800 12px Inter, Arial, sans-serif";
      ctx.fillText(short(dragons.join(" · "), 58), x, y + 108);
    }
  };
  const drawTeamTable = (label, rowsByRole, x, y, w, accent = "cyan") => {
    drawPanel(x, y, w, 430, accent, 0.68);
    fitText(label, x + 28, y + 48, w - 260, { font: "900 26px Inter, Arial, sans-serif", color: "#ffffff", min: 18 });
    ctx.fillStyle = accentColor(accent);
    ctx.font = "900 12px Inter, Arial, sans-serif";
    ctx.fillText("JOUEUR", x + 28, y + 88);
    ctx.fillText("KDA", x + 326, y + 88);
    ctx.fillText("RESS.", x + 472, y + 88);
    ctx.fillText("BUILD", x + w - 178, y + 88);
    drawLine(x + 24, y + 104, x + w - 24, y + 104, accentSoft(accent, 0.26), 1.5);
    rowsByRole.forEach((row, index) => drawPlayerRow(row, x + 14, y + 116 + index * 62, w - 28, accent === "pink" ? "right" : "left"));
  };
  const drawChampionMosaic = (label, counts, x, y, w, h, accent = "cyan") => {
    const totalPicks = counts.reduce((total, [, count]) => total + count, 0);
    ctx.fillStyle = accentSoft(accent, 0.10);
    ctx.strokeStyle = accentSoft(accent, 0.26);
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = accentColor(accent);
    ctx.font = "900 12px Inter, Arial, sans-serif";
    ctx.fillText(label.toUpperCase(), x + 14, y + 22);
    fitText(`${counts.length} champion${counts.length > 1 ? "s" : ""} · ${totalPicks} picks`, x + 14, y + 40, w - 28, { font: "800 10px Inter, Arial, sans-serif", color: "#c7d4e5", min: 8 });
    if (!counts.length) {
      fitText("Aucun champion détecté.", x + 14, y + 72, w - 28, { font: "800 14px Inter, Arial, sans-serif", color: "#94a3b8", min: 10 });
      return;
    }
    const listY = y + 52;
    const listH = h - 62;
    const columns = Math.max(1, Math.min(6, Math.ceil(counts.length / Math.max(1, Math.floor(listH / 22)))));
    const rowsNeeded = Math.max(1, Math.ceil(counts.length / columns));
    const gap = counts.length > 20 ? 4 : 6;
    const cellW = (w - 28 - gap * (columns - 1)) / columns;
    const cellH = Math.max(10, Math.min(38, (listH - gap * (rowsNeeded - 1)) / rowsNeeded));
    const compact = cellH < 18 || cellW < 54;
    const iconSize = Math.max(compact ? 9 : 14, Math.min(compact ? 18 : 30, cellH - 4));
    counts.forEach(([champion, count], index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cellX = x + 14 + col * (cellW + gap);
      const cellY = listY + row * (cellH + gap);
      ctx.fillStyle = "rgba(0,0,0,.24)";
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.lineWidth = 1;
      rounded(cellX, cellY, cellW, cellH, compact ? 7 : 10);
      drawCachedImage(championPortraitSources(champion, champion), cellX + 3, cellY + Math.max(1, (cellH - iconSize) / 2), iconSize, iconSize, compact ? 5 : 7);
      if (!compact) fitText(short(championDisplayName(champion), cellW > 92 ? 13 : 9), cellX + iconSize + 9, cellY + Math.max(14, cellH * 0.48), cellW - iconSize - 34, { font: "900 10px Inter, Arial, sans-serif", color: "#ffffff", min: 7 });
      ctx.fillStyle = accentColor(accent);
      ctx.font = compact ? "900 8px Inter, Arial, sans-serif" : "900 9px Inter, Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`x${count}`, cellX + cellW - 7, compact ? cellY + cellH - 2 : cellY + Math.max(14, cellH * 0.50));
      ctx.textAlign = "left";
    });
  };
  const groupMatchColumns = (x, w) => ({
    titleW: w - 410,
    resultX: x + w - 338,
    resultW: 88,
    durationX: x + w - 230,
    durationW: 58,
    sideX: x + w - 158,
    sideW: 46,
    patchRightX: x + w - 12,
    patchW: 86,
  });
  const compactSideLabel = (side) => {
    const raw = String(side || "").trim();
    const upper = raw.toUpperCase();
    if (upper.includes("BLUE") || upper.includes("BLEU")) return "BLUE";
    if (upper.includes("RED") || upper.includes("ROUGE")) return "RED";
    return short(upper || "SIDE", 5);
  };
  const drawGroupMatchRow = (match, x, y, w, index) => {
    const resultAccent = match?.result === "Victoire" ? "green" : match?.result === "Défaite" ? "pink" : "cyan";
    const cols = groupMatchColumns(x, w);
    ctx.fillStyle = index % 2 ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.018)";
    ctx.fillRect(x, y, w, 42);
    ctx.fillStyle = accentColor(resultAccent);
    ctx.fillRect(x, y, 3, 42);
    fitText(matchDisplayName(match, "Game"), x + 16, y + 18, cols.titleW, { font: "900 15px Inter, Arial, sans-serif", color: "#ffffff", min: 10 });
    fitText(match?.game_id || "Game ID", x + 16, y + 35, cols.titleW, { font: "800 10px Inter, Arial, sans-serif", color: "#94a3b8", min: 9 });
    fitText(match?.result || "Analyse", cols.resultX, y + 25, cols.resultW, { font: "900 12px Inter, Arial, sans-serif", color: accentColor(resultAccent), min: 9 });
    fitText(match?.duration || "--:--", cols.durationX, y + 25, cols.durationW, { font: "800 12px Inter, Arial, sans-serif", color: "#e2e8f0", min: 9 });
    fitText(compactSideLabel(match?.side), cols.sideX, y + 25, cols.sideW, { font: "900 11px Inter, Arial, sans-serif", color: "#e2e8f0", min: 9 });
    fitText(short(match?.patch || "Patch ?", 9), cols.patchRightX, y + 25, cols.patchW, { font: "800 12px Inter, Arial, sans-serif", color: "#c7d4e5", min: 9, align: "right" });
  };
  const imageUrls = new Set();
  imageUrls.add("/assets/nxt5-wordmark.png");
  imageUrls.add("/assets/nxt5-mark.png");
  Object.values(OBJECTIVE_ICON_SOURCES).flat().forEach((url) => imageUrls.add(url));
  const exportRows = [...rows, ...enemyRows];
  exportRows.forEach((row) => {
    championPortraitSources(row, row?.champion).forEach((url) => imageUrls.add(url));
    summonerSpellIds(row).forEach((spell) => summonerSpellIconSources(spell).forEach((url) => imageUrls.add(url)));
    finalBuildItems(row).forEach((item) => itemIconSources(item.id).forEach((url) => imageUrls.add(url)));
  });
  allChampionCounts.forEach(([champion]) => championPortraitSources(champion, champion).forEach((url) => imageUrls.add(url)));
  await Promise.all([...imageUrls].filter(Boolean).map(loadCanvasImage));
  const pageGradient = ctx.createLinearGradient(0, 0, W, H);
  pageGradient.addColorStop(0, "#030914");
  pageGradient.addColorStop(0.52, "#020511");
  pageGradient.addColorStop(1, "#090416");
  ctx.fillStyle = pageGradient;
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 64) drawLine(x, 0, x, H, "rgba(103,232,249,.026)", 1);
  for (let y = 0; y <= H; y += 64) drawLine(0, y, W, y, "rgba(103,232,249,.018)", 1);
  const bg = ctx.createRadialGradient(240, 90, 80, 240, 90, 680);
  bg.addColorStop(0, "rgba(34,211,238,.22)");
  bg.addColorStop(0.48, "rgba(30,64,175,.08)");
  bg.addColorStop(1, "rgba(2,5,17,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const bg2 = ctx.createRadialGradient(W - 220, 120, 90, W - 220, 120, 700);
  bg2.addColorStop(0, "rgba(217,70,239,.18)");
  bg2.addColorStop(1, "rgba(2,5,17,0)");
  ctx.fillStyle = bg2;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(103,232,249,.24)";
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 42, W - 96, H - 84);
  drawLine(72, 188, W - 72, 188, "rgba(103,232,249,.55)", 2.5);
  drawLine(72, 190, W - 72, 190, "rgba(244,114,182,.22)", 1);
  drawImageContain(imageCache.get("/assets/nxt5-mark.png"), 90, 72, 82, 82);
  drawImageContain(imageCache.get("/assets/nxt5-wordmark.png"), 188, 78, 236, 62);
  fitText(short(title || "Export NXT5", 46), 464, 105, W - 860, { font: "900 42px Inter, Arial, sans-serif", color: "#ffffff", min: 24 });
  fitText(short(subtitle || `${games} game${games > 1 ? "s" : ""} exportée${games > 1 ? "s" : ""}`, 90), 466, 142, W - 870, { font: "800 18px Inter, Arial, sans-serif", color: "#c8f7ff", min: 12 });
  drawPill(singleGame ? "FICHE GAME" : "EXPORT BLOC SCRIM", W - 360, 86, "rgba(217,70,239,.14)", "rgba(217,70,239,.34)", "#fff");
  const metricMarker = (value) => singleGame && firstMatch ? winningSideForDiff(firstMatch, value) : winningTeamForDiff(value);
  const metrics = [
    ["Games", String(games), `${wins}W - ${games - wins}L`, "cyan", ""],
    ["Winrate", `${Math.round((wins / Math.max(1, games)) * 100)}%`, "Sélection", wins >= games - wins ? "cyan" : "pink", ""],
    ["KDA équipe", `${kills}/${deaths}/${assists}`, "Alliés", "cyan", ""],
    ["Écart or", formatGoldDiff(goldDiff), "Économie", goldDiff >= 0 ? "cyan" : "pink", metricMarker(goldDiff)],
    ["Écart dégâts", `${damageDiff >= 0 ? "+" : ""}${formatPoints(damageDiff)}`, "Dégâts", damageDiff >= 0 ? "cyan" : "pink", metricMarker(damageDiff)],
    ["Écart vision", `${visionDiff >= 0 ? "+" : ""}${formatPoints(visionDiff)}`, "Vision", visionDiff >= 0 ? "cyan" : "pink", metricMarker(visionDiff)],
  ];
  drawPanel(90, 220, 1740, 96, "cyan", 0.54);
  metrics.forEach(([label, value, detail, accent, marker], index) => {
    const x = 90 + index * 290;
    if (index) drawLine(x, 236, x, 300, "rgba(255,255,255,.10)", 1);
    drawMetric(label, value, detail, x + 2, 220, 286, accent, marker);
  });

  if (singleGame && firstMatch) {
    const allyByRole = roleOrder.map((role) => rows.find((row) => String(row.role || "").toUpperCase() === role) || { role, team_key: "ALLY" });
    const enemyByRole = roleOrder.map((role) => enemyRows.find((row) => String(row.role || "").toUpperCase() === role) || { role, team_key: "ENEMY" });
    drawPanel(90, 346, 1740, 126, "green", 0.42);
    drawObjectiveSide("Côté bleu", objectiveTeamKeyForSide(firstMatch, "BLUE") === "ALLY" ? allyObjectives : enemyObjectives, 122, 360, 720, "cyan");
    drawLine(960, 364, 960, 452, "rgba(255,255,255,.13)", 1.5);
    drawObjectiveSide("Côté rouge", objectiveTeamKeyForSide(firstMatch, "RED") === "ALLY" ? allyObjectives : enemyObjectives, 1018, 360, 720, "pink");
    drawTeamTable(`Alliés · ${sideName(firstMatch, "ALLY")}`, allyByRole, 90, 512, 820, "cyan");
    drawTeamTable(`Adversaires · ${sideName(firstMatch, "ENEMY")}`, enemyByRole, 1010, 512, 820, "pink");
    ctx.fillStyle = "rgba(255,255,255,.07)";
    ctx.fillRect(936, 538, 48, 376);
    drawLine(960, 538, 960, 914, "rgba(103,232,249,.32)", 1);
    ctx.textAlign = "center";
    roleOrder.forEach((role, index) => {
      ctx.fillStyle = index % 2 ? "#fbcfe8" : "#bffaff";
      ctx.font = "900 13px Inter, Arial, sans-serif";
      ctx.fillText(role, 960, 668 + index * 62);
    });
    ctx.textAlign = "left";
    const statusAccent = firstMatch.result === "Victoire" ? "green" : firstMatch.result === "Défaite" ? "pink" : "cyan";
    drawPill(firstMatch.result || "Analyse", 122, 480, accentSoft(statusAccent, 0.16), accentSoft(statusAccent, 0.38), "#fff");
    drawPill(firstMatch.duration || "--:--", 254, 480, "rgba(103,232,249,.12)", "rgba(103,232,249,.30)", "#e8fbff");
    drawPill(firstMatch.patch || "Patch ?", 356, 480, "rgba(103,232,249,.12)", "rgba(103,232,249,.30)", "#e8fbff");
  } else {
    const leaderRows = [
      ["Meilleur KDA", topKda ? `${rowName(topKda)} · ${championDisplayName(topKda.champion)} · ${topKda.kills || 0}/${topKda.deaths || 0}/${topKda.assists || 0}` : "N/A"],
      ["Plus de dégâts", topDamage ? `${rowName(topDamage)} · ${championDisplayName(topDamage.champion)} · ${formatPoints(topDamage.damage)}` : "N/A"],
      ["Plus de vision", topVision ? `${rowName(topVision)} · ${championDisplayName(topVision.champion)} · ${topVision.vision || 0} VS` : "N/A"],
    ];
    drawPanel(90, 356, 1740, 150, "cyan", 0.48);
    fitText("Signaux du bloc", 126, 402, 360, { font: "900 28px Inter, Arial, sans-serif", color: "#ffffff", min: 18 });
    leaderRows.forEach(([label, value], index) => {
      const x = 126 + index * 560;
      if (index) drawLine(x - 34, 392, x - 34, 478, "rgba(255,255,255,.10)", 1);
      ctx.fillStyle = index === 2 ? "#fbcfe8" : "#bffaff";
      ctx.font = "900 18px Inter, Arial, sans-serif";
      ctx.fillText(label.toUpperCase(), x, 442);
      fitText(short(value, 52), x, 474, 500, { font: "900 22px Inter, Arial, sans-serif", color: "#ffffff", min: 14 });
    });
    drawPanel(90, 548, 820, 330, "pink", 0.50);
    fitText("Champions joués", 126, 606, 420, { font: "900 32px Inter, Arial, sans-serif", color: "#ffffff", min: 20 });
    fitText("Nos picks et les champions adverses du groupe, en un seul visuel.", 126, 632, 650, { font: "800 14px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    drawChampionMosaic("Nous", allyChampionCounts, 126, 658, 368, 188, "cyan");
    drawChampionMosaic("Eux", enemyChampionCounts, 514, 658, 360, 188, "pink");
    fitText(`${rows.length} picks NXT5 · ${enemyRows.length} picks adverses`, 126, 862, 650, { font: "800 12px Inter, Arial, sans-serif", color: "#94a3b8", min: 9 });
    drawPanel(1010, 548, 820, 330, "green", 0.50);
    fitText("Games du groupe", 1046, 606, 420, { font: "900 32px Inter, Arial, sans-serif", color: "#ffffff", min: 20 });
    fitText(`${scoped.length} game${scoped.length > 1 ? "s" : ""} · ${wins}W - ${scoped.length - wins}L`, 1046, 632, 500, { font: "800 14px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    const groupListCols = groupMatchColumns(1046, 748);
    ctx.fillStyle = "#34d399";
    ctx.font = "900 11px Inter, Arial, sans-serif";
    ctx.fillText("GAME", 1046, 666);
    ctx.fillText("RESULT", groupListCols.resultX, 666);
    ctx.fillText("DUR.", groupListCols.durationX, 666);
    ctx.fillText("SIDE", groupListCols.sideX, 666);
    ctx.textAlign = "right";
    ctx.fillText("PATCH", groupListCols.patchRightX, 666);
    ctx.textAlign = "left";
    drawLine(1046, 680, groupListCols.patchRightX, 680, "rgba(52,211,153,.24)", 1.5);
    scoped.slice(0, 5).forEach((match, index) => drawGroupMatchRow(match, 1046, 694 + index * 42, 748, index));
    if (scoped.length > 5) fitText(`+ ${scoped.length - 5} game${scoped.length - 5 > 1 ? "s" : ""} dans le groupe`, 1046, 930, 520, { font: "800 13px Inter, Arial, sans-serif", color: "#94a3b8", min: 10 });
  }
  ctx.fillStyle = "#67e8f9";
  ctx.font = "800 17px Inter, Arial, sans-serif";
  ctx.fillText(`Généré par NXT5 · ${new Date().toLocaleString("fr-FR")}`, 72, H - 42);
  ctx.textAlign = "right";
  ctx.fillStyle = "#dff8ff";
  ctx.font = "900 22px Arial Black, Impact, Arial, sans-serif";
  ctx.fillText("DRAFT · STRATEGIZE · WIN", W - 72, H - 42);
  ctx.textAlign = "left";
  const link = document.createElement("a");
  link.download = filename || "nxt5-stats-export.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function exportTrendsPng({ title, subtitle, metrics = [], sections = [], champions = [], filename }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const short = (value, max = 38) => String(value || "").length > max ? `${String(value).slice(0, max - 1)}…` : String(value || "");
  const rounded = (x, y, w, h, r = 24) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke(); };
  const accentColor = (accent = "cyan") => accent === "red" ? "#fb7185" : accent === "green" ? "#34d399" : accent === "orange" ? "#fbbf24" : accent === "purple" ? "#e879f9" : "#67e8f9";
  const accentSoft = (accent = "cyan", alpha = 0.16) => accent === "red" ? `rgba(251,113,133,${alpha})` : accent === "green" ? `rgba(52,211,153,${alpha})` : accent === "orange" ? `rgba(251,191,36,${alpha})` : accent === "purple" ? `rgba(232,121,249,${alpha})` : `rgba(103,232,249,${alpha})`;
  const fitText = (text, x, y, maxWidth, { font, color = "#fff", min = 12, align = "left" } = {}) => {
    const source = String(text || "");
    let nextFont = font || "800 20px Inter, Arial, sans-serif";
    const match = nextFont.match(/(\d+)px/);
    let size = match ? Number(match[1]) : 20;
    ctx.font = nextFont;
    while (ctx.measureText(source).width > maxWidth && size > min) {
      size -= 1;
      nextFont = nextFont.replace(/\d+px/, `${size}px`);
      ctx.font = nextFont;
    }
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(source, x, y);
    ctx.textAlign = "left";
  };
  const drawLine = (x1, y1, x2, y2, color = "rgba(255,255,255,.10)", width = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const drawPanel = (x, y, w, h, accent = "cyan", alpha = 0.72) => {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, accentSoft(accent, 0.13));
    gradient.addColorStop(0.42, `rgba(5,10,24,${alpha})`);
    gradient.addColorStop(1, "rgba(5,10,24,.50)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = accentSoft(accent, 0.36);
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = accentColor(accent);
    ctx.fillRect(x, y, 4, h);
  };
  const imageCache = new Map();
  const loadCanvasImage = (url) => new Promise((resolve) => {
    if (!url) return resolve(null);
    if (imageCache.has(url)) return resolve(imageCache.get(url));
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
  const drawImageContain = (img, x, y, w, h) => {
    if (!img) return false;
    const ratio = Math.min(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return true;
  };
  const imageUrls = new Set(["/assets/nxt5-wordmark.png", "/assets/nxt5-mark.png"]);
  champions.slice(0, 6).forEach((stat) => championPortraitSources(stat.champion, stat.champion).forEach((url) => imageUrls.add(url)));
  await Promise.all([...imageUrls].filter(Boolean).map(loadCanvasImage));

  const pageGradient = ctx.createLinearGradient(0, 0, W, H);
  pageGradient.addColorStop(0, "#030914");
  pageGradient.addColorStop(0.54, "#020511");
  pageGradient.addColorStop(1, "#10051a");
  ctx.fillStyle = pageGradient;
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 64) drawLine(x, 0, x, H, "rgba(103,232,249,.026)", 1);
  for (let y = 0; y <= H; y += 64) drawLine(0, y, W, y, "rgba(103,232,249,.018)", 1);
  const bg = ctx.createRadialGradient(250, 70, 80, 250, 70, 680);
  bg.addColorStop(0, "rgba(34,211,238,.23)");
  bg.addColorStop(0.48, "rgba(30,64,175,.08)");
  bg.addColorStop(1, "rgba(2,5,17,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const bg2 = ctx.createRadialGradient(W - 230, 120, 90, W - 230, 120, 720);
  bg2.addColorStop(0, "rgba(217,70,239,.18)");
  bg2.addColorStop(1, "rgba(2,5,17,0)");
  ctx.fillStyle = bg2;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(103,232,249,.24)";
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 42, W - 96, H - 84);
  drawLine(72, 188, W - 72, 188, "rgba(103,232,249,.55)", 2.5);
  drawLine(72, 190, W - 72, 190, "rgba(244,114,182,.22)", 1);
  drawImageContain(imageCache.get("/assets/nxt5-mark.png"), 90, 72, 82, 82);
  drawImageContain(imageCache.get("/assets/nxt5-wordmark.png"), 188, 78, 236, 62);
  fitText(short(title || "Tendances NXT5", 44), 464, 105, W - 860, { font: "900 42px Inter, Arial, sans-serif", color: "#ffffff", min: 24 });
  fitText(short(subtitle || "Export stratégique", 92), 466, 142, W - 870, { font: "800 18px Inter, Arial, sans-serif", color: "#c8f7ff", min: 12 });
  ctx.font = "900 16px Inter, Arial, sans-serif";
  ctx.fillStyle = "rgba(217,70,239,.14)";
  ctx.strokeStyle = "rgba(217,70,239,.34)";
  ctx.lineWidth = 1.5;
  rounded(W - 330, 86, 240, 32, 16);
  ctx.fillStyle = "#fff";
  ctx.fillText("EXPORT TENDANCES", W - 312, 108);

  const metricItems = metrics.slice(0, 4);
  drawPanel(90, 220, 1740, 118, "cyan", 0.54);
  metricItems.forEach((metric, index) => {
    const x = 90 + index * 435;
    if (index) drawLine(x, 238, x, 318, "rgba(255,255,255,.10)", 1);
    const metricTone = metric.tone === "red" ? "red" : metric.tone === "green" ? "green" : metric.tone === "orange" ? "orange" : metric.tone === "purple" ? "purple" : "cyan";
    ctx.fillStyle = accentColor(metricTone);
    ctx.font = "900 13px Inter, Arial, sans-serif";
    ctx.fillText(String(metric.label || "").toUpperCase(), x + 24, 252);
    fitText(short(metric.value, 18), x + 24, 292, 380, { font: "900 34px Inter, Arial, sans-serif", color: "#ffffff", min: 18 });
    fitText(short(metric.hint, 34), x + 24, 315, 380, { font: "800 14px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
  });

  sections.slice(0, 6).forEach((section, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = col ? 990 : 90;
    const y = 360 + row * 172;
    const sectionTone = section.tone || "cyan";
    drawPanel(x, y, 840, 142, sectionTone, 0.56);
    ctx.fillStyle = accentColor(sectionTone);
    ctx.font = "900 16px Inter, Arial, sans-serif";
    ctx.fillText(String(section.title || "").toUpperCase(), x + 26, y + 34);
    (section.items || []).slice(0, 3).forEach((item, itemIndex) => {
      const itemY = y + 62 + itemIndex * 28;
      ctx.fillStyle = accentColor(sectionTone);
      ctx.beginPath();
      ctx.arc(x + 28, itemY - 5, 4, 0, Math.PI * 2);
      ctx.fill();
      fitText(short(item, 96), x + 44, itemY, 760, { font: itemIndex === 0 ? "900 17px Inter, Arial, sans-serif" : "800 15px Inter, Arial, sans-serif", color: itemIndex === 0 ? "#ffffff" : "#dbeafe", min: 11 });
    });
  });

  drawPanel(90, 878, 1740, 92, "purple", 0.48);
  ctx.fillStyle = accentColor("purple");
  ctx.font = "900 13px Inter, Arial, sans-serif";
  ctx.fillText("CHAMPIONS RÉCURRENTS", 118, 910);
  champions.slice(0, 6).forEach((stat, index) => {
    const x = 118 + index * 280;
    const img = championPortraitSources(stat.champion, stat.champion).map((url) => imageCache.get(url)).find(Boolean);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, 924, 40, 40, 10);
      ctx.clip();
      const ratio = Math.max(40 / img.width, 40 / img.height);
      ctx.drawImage(img, x + (40 - img.width * ratio) / 2, 924 + (40 - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
      ctx.restore();
    }
    fitText(short(championDisplayName(stat.champion), 18), x + 50, 942, 200, { font: "900 15px Inter, Arial, sans-serif", color: "#ffffff", min: 10 });
    fitText(`${stat.games}G · ${Math.round((stat.wins / Math.max(1, stat.games)) * 100)}% WR`, x + 50, 962, 200, { font: "800 12px Inter, Arial, sans-serif", color: "#c7d4e5", min: 9 });
  });

  ctx.fillStyle = "#67e8f9";
  ctx.font = "800 17px Inter, Arial, sans-serif";
  ctx.fillText(`Généré par NXT5 · ${new Date().toLocaleString("fr-FR")}`, 72, H - 58);
  ctx.textAlign = "right";
  ctx.fillStyle = "#dff8ff";
  ctx.font = "900 22px Arial Black, Impact, Arial, sans-serif";
  ctx.fillText("DRAFT · STRATEGIZE · WIN", W - 72, H - 58);
  ctx.textAlign = "left";
  const link = document.createElement("a");
  link.download = filename || "nxt5-tendances.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function formatCountdown(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}

function InviteCodesPanel({ inviteCodes = [], nowTick }) {
  const activeCodes = inviteCodes.filter((code) => new Date(code.expires_at).getTime() > nowTick);
  return <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/8 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/70">Codes actifs</p><h4 className="mt-1 text-xl font-black text-white">Invitations temporaires</h4></div><Badge tone="cyan">Valables 1h</Badge></div><div className="mt-4 space-y-2">{activeCodes.length ? activeCodes.map((code) => { const remaining = Math.max(0, Math.ceil((new Date(code.expires_at).getTime() - nowTick) / 1000)); return <div key={code.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-mono text-lg font-black tracking-[0.08em] text-white">{code.code}</p><p className="mt-1 text-xs font-semibold text-slate-300">Créé par {code.created_by_name || "staff"} · suppression automatique à expiration</p></div><Badge tone={remaining > 900 ? "green" : remaining > 300 ? "yellow" : "red"}>{formatCountdown(remaining)}</Badge></div>; }) : <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-slate-300">Aucun code actif. Génère un code pour inviter quelqu’un pendant 1h.</p>}</div></div>;
}

function GuidePage() {
  const newFeatureBlocks = [
    [Upload, "Import plus sûr", "Upload avec progression, assignation side/lane/profil, rôles lisibles, catégories de contexte et corrections possibles depuis l’historique."],
    [BarChart3, "Stats game et groupe", "Lecture instantanée, sélection visuelle, groupes de games, exports PNG game/groupe et comparaisons par side sans inverser les équipes."],
    [Activity, "Cockpit stratégique", "Tendances compactes, identité d’équipe, patterns automatiques, écarts CS10/CS20, timings objectifs et export stratégique."],
    [Crown, "Profil et Pool", "Mon Profil regroupe synthèse, champions/builds, pool avec tiers de maîtrise, historique, coaching et export PNG individuel."],
    [FileText, "Review room", "Bibliothèque orientée lecture, reviews liées aux games/groupes, commandes de stats et fenêtre dédiée pour créer ou éditer."],
    [CalendarDays, "Planning équipe", "Disponibilités plus denses, semaines courante/suivante, marqueurs Scrim/Match/Review, notes et disponibilités staff."],
  ];
  const starterSteps = [
    ["Créer ou rejoindre une team", "Au premier lancement, crée ta team ou colle le code temporaire donné par le capitaine. Sans team active, NXT5 garde les modules verrouillés."],
    ["Vérifier le compte", "Confirme ton e-mail depuis le lien reçu. Les notifications et actions sensibles reposent sur un compte vérifié."],
    ["Construire le roster", "Dans Gestion équipe, ajoute les joueurs et le staff. Les joueurs utilisent TOP, JGL, MID, ADC et SUP ; le staff reste hors draft, OP.GG et imports."],
    ["Relier comptes et profils", "Associe chaque compte NXT5 au bon profil joueur. C’est ce lien qui alimente Mon Profil, Planning, Champion Pool et permissions personnelles."],
    ["Gérer les accès", "Capitaine, coach et manager peuvent gérer la structure. Les joueurs gardent leurs données personnelles et leur planning, avec édition encadrée selon leur rôle."],
  ];
  const importSteps = [
    ["Télécharger NXT5 Importer", "Dans Intégration, télécharge l’importer Windows ou Mac sur le PC où le client League of Legends possède la game dans son historique."],
    ["Générer le JSON", "Dans l’importer, colle le Game ID du client LoL, choisis la région, puis génère le fichier. Les timelines, builds, summoners, wards et objectifs sont conservés si le client les fournit."],
    ["Importer dans NXT5", "Dans Intégration, clique sur Importer un JSON. La barre de progression indique l’upload puis l’analyse serveur."],
    ["Nommer et catégoriser", "Donne un nom clair à la game et coche Scrim, Tournoi, BO, test draft ou toute catégorie custom. Ces tags servent ensuite aux filtres Stats, Profil, Tendances et Review."],
    ["Assigner proprement", "Choisis ton side, puis vérifie champions, lanes, profils alliés et champions adverses. Les cartes de rôles sont séparées par poste pour éviter les confusions ADC/SUP."],
    ["Corriger après coup", "Dans l’historique des imports, renomme, supprime ou corrige lanes/profils. Les pages Statistiques, Mon Profil, Tendances et Review se recalculent ensuite."],
  ];
  const analysisSteps = [
    ["Lecture instantanée", "Sélectionne une game importée pour lire les deux sides, les 10 joueurs, champions, KDA, KP, dégâts, gold, vision, summoners, builds, objectifs et écarts par poste."],
    ["Sides conservés", "Dans les vues de game, les équipes restent du côté réel Blue/Red. Les avantages sont signalés par side pour éviter de croire que NXT5 est toujours à gauche."],
    ["Déroulé coach", "Quand la timeline est disponible, NXT5 extrait objectifs, fights, tours, phases early/mid/late, écarts d’or à 10/15/20 et contexte des morts."],
    ["Objectifs neutres", "Dragons par élément, grubs, Herald, Nashor et tours sont affichés par side. La frise montre l’ordre, le timing et le side qui sécurise chaque objectif."],
    ["Groupes de games", "Crée un groupe pour analyser un scrim complet. La sélection est surlignée, le groupe peut être rouvert, et la review de groupe est générée avec les games liées."],
    ["Exports PNG", "Utilise Exporter la game ou Exporter le groupe pour produire un visuel NXT5 avec picks alliés, champions adverses, résultat, patch, side, durée, objectifs et stats clés."],
    ["Cockpit Tendances", "Lis l’identité de l’équipe, les patterns ADC centrique, JGL+MID, frontline, early objectifs, scaling, les écarts CS10/CS20 et les priorités draft."],
    ["Mon Profil", "Chaque joueur a une synthèse coach, un onglet Champions qui fusionne stats et builds, un onglet Pool, un historique, des notes coaching et un export PNG."],
    ["Pool par tiers", "L’onglet Pool détaille les champions par tiers de maîtrise, confort, priorité, pocket, test ou à travailler. Les pictos restent hors image pour garder les champions lisibles."],
    ["Champion Pool global", "La page Champion Pool reste la vue équipe : elle aide à organiser les picks par joueur et à préparer les Compos Types."],
    ["Compos Types", "Glisse les champions issus des pools dans les rôles, filtre Blue/Red side, duplique une compo et lis les tags, catégories, résumé et counters probables."],
    ["Review", "La Review est maintenant orientée lecture : bibliothèque, recherche, filtres par groupe, lien direct vers Stats, preview live et commandes /KDA, /DAMAGE, /VISION, /GOLD, /KP."],
    ["Planning", "Chaque profil renseigne ses dispos. Le staff peut annoter Scrim, Match ou Review, basculer semaine courante/suivante et suivre les disponibilités sans vue trop lourde."],
  ];
  const troubleshooting = [
    ["Images manquantes", "Recharge la page après un deploy. Les champions, items, summoners et objectifs utilisent DDragon/CommunityDragon avec fallbacks, mais le cache navigateur peut garder une vieille version."],
    ["Items ou summoners absents", "Le JSON doit venir d’un importer récent. Si l’ancien fichier ne contient pas ces données, NXT5 masque ou vide les zones concernées au lieu d’inventer."],
    ["Import introuvable", "Vérifie la région du Game ID, attends quelques minutes après la fin de la game, puis réessaie sur le PC où le client LoL possède la game dans son historique."],
    ["Timeline limitée", "Certaines lectures coach disparaissent si Riot ne renvoie pas la timeline complète. La fiche reste exploitable avec les stats finales, mais les timings seront moins riches."],
    ["Mauvais joueur au mauvais poste", "Va dans Intégration, ouvre la game importée et corrige lanes/profils. Les pages Stats, Mon Profil, Tendances et Review se mettent ensuite à jour."],
    ["Groupe incomplet", "Vérifie que toutes les games du bloc sont importées, catégorisées et cochées dans le groupe. Une review de groupe reprend uniquement les IDs liés au groupe."],
    ["Permissions bloquées", "Vérifie le rôle dans Gestion équipe. Capitaine, coach et manager ont des droits étendus, mais certaines actions personnelles restent réservées au profil concerné."],
    ["E-mail non vérifié", "Utilise Paramètres ou l’écran de vérification pour renvoyer le lien. Les notifications restent bloquées tant que l’adresse n’est pas confirmée."],
  ];
  const quickLinks = [
    ["Intégration", "/integration", Download, "Importer JSON, catégoriser, corriger lanes, profils et champions adverses."],
    ["Statistiques", "/statistiques", BarChart3, "Analyser une game, un groupe, le déroulé coach et les exports PNG."],
    ["Tendances", "/tendances", Activity, "Lire cockpit stratégique, patterns, timings, écarts et identité d’équipe."],
    ["Mon Profil", "/mon-profil", Activity, "Synthèse, Champions+Builds, Pool, Historique, Coaching et export PNG."],
    ["Champion Pool", "/champion-pool", Crown, "Organiser les picks par joueur et préparer les tiers de maîtrise."],
    ["Compos Types", "/compositions-types", Sparkles, "Créer des compos depuis les pools et lire les counters."],
    ["Planning", "/planning", CalendarDays, "Dispos, semaines, événements Scrim/Match/Review et notes."],
    ["Review", "/rapports", FileText, "Lire, chercher, lier des games/groupes et écrire les décisions staff."],
    ["Gestion", "/gestion-equipe", Settings, "Roster, invitations temporaires, liaisons, permissions et staff."],
    ["Paramètres", "/parametres", ShieldCheck, "Compte, e-mail vérifié, session et sécurité personnelle."],
  ];
  const routineItems = [
    "Avant scrim : vérifier roster, planning, champion pools, compos types, catégories et objectifs de test.",
    "Après chaque game : générer le JSON, importer, nommer, catégoriser, confirmer side, lanes, profils alliés et champions adverses.",
    "Après le bloc : créer un groupe, ouvrir les stats de groupe, exporter le PNG si besoin, puis générer ou écrire la review liée.",
    "Avant la prochaine session : consulter Tendances, mettre à jour Pool, Compos Types, bilan coaching et corrections de profil.",
  ];

  const StepList = ({ items }) => <div className="grid gap-3">{items.map(([title, text], index) => <div key={title} className="rounded-2xl border border-white/10 bg-black/24 p-4"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-300/10 text-sm font-black text-cyan-100">{index + 1}</span><div><h4 className="text-base font-black text-white">{title}</h4><p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{text}</p></div></div></div>)}</div>;

  return <div>
    <PageHeader eyebrow="Guide NXT5" title="Guide complet d’utilisation" subtitle="Le parcours à jour pour configurer ta team, importer les games, lire les nouveautés, créer des groupes, suivre les profils et produire des reviews propres.">
      <Button icon={Swords} onClick={() => openAppPath("/integration")}>Importer une game</Button>
      <Button variant="ghost" icon={Settings} onClick={() => openAppPath("/gestion-equipe")}>Gestion équipe</Button>
    </PageHeader>

    <Surface glow className="mb-5 p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Badge tone="cyan">Navigation rapide</Badge>
          <h3 className="mt-3 text-2xl font-black text-white">Commence par l’action dont tu as besoin</h3>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-300">Le guide suit le workflow complet, mais ces raccourcis ouvrent directement les pages importantes.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">{quickLinks.map(([title, path, Icon, text]) => <button key={title} type="button" onClick={() => openAppPath(path)} className="group rounded-2xl border border-white/10 bg-black/24 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-400/[0.07]">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/18 bg-cyan-400/10 text-cyan-100"><Icon className="h-5 w-5" /></span><h4 className="font-black text-white">{title}</h4></div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{text}</p>
      </button>)}</div>
    </Surface>

    <Surface glow className="mb-5 p-5 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="green">Nouveautés clés</Badge>
          <h3 className="mt-3 text-2xl font-black text-white">Ce que le site sait faire maintenant</h3>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-300">Ces blocs résument les dernières évolutions produit : lecture plus claire, exports plus complets, profils mieux séparés et planning moins lourd.</p>
        </div>
        <Badge tone="cyan">Guide mis à jour</Badge>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {newFeatureBlocks.map(([Icon, title, text], index) => <div key={title} className="rounded-2xl border border-white/10 bg-black/24 p-4">
          <div className="flex items-center gap-3"><span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", tone(index % 3 === 0 ? "cyan" : index % 3 === 1 ? "purple" : "green"))}><Icon className="h-5 w-5" /></span><h4 className="font-black text-white">{title}</h4></div>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{text}</p>
        </div>)}
      </div>
    </Surface>

    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Surface glow className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Démarrage</Badge>
            <h3 className="mt-3 text-2xl font-black text-white">1. Mettre la structure en place</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Cette étape évite 90% des erreurs d’import, parce que les games doivent pouvoir être reliées aux bons profils.</p>
          </div>
          <Users className="h-8 w-8 shrink-0 text-cyan-100" />
        </div>
        <div className="mt-5"><StepList items={starterSteps} /></div>
      </Surface>

      <Surface glow className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone="purple">Import</Badge>
            <h3 className="mt-3 text-2xl font-black text-white">2. Transformer une game LoL en données</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Le fichier local garde les informations utiles de la partie et permet à NXT5 de construire les stats de manière fiable.</p>
          </div>
          <Download className="h-8 w-8 shrink-0 text-fuchsia-100" />
        </div>
        <div className="mt-5"><StepList items={importSteps} /></div>
      </Surface>
    </div>

    <Surface glow className="mt-5 p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="orange">Workflow</Badge>
          <h3 className="mt-3 text-2xl font-black text-white">3. Exploiter les données sans remplacer le coach</h3>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-300">NXT5 donne les chiffres, les filtres et les chemins rapides. L’interprétation reste dans les mains du coach, du capitaine et des joueurs.</p>
        </div>
        <Button variant="ghost" icon={BarChart3} onClick={() => openAppPath("/statistiques")}>Ouvrir les stats</Button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{analysisSteps.map(([title, text], index) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center gap-2"><Badge tone={index < 5 ? "cyan" : index < 8 ? "purple" : "green"}>{String(index + 1).padStart(2, "0")}</Badge><h4 className="font-black text-white">{title}</h4></div><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{text}</p></div>)}</div>
    </Surface>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <Surface className="p-5 md:p-6">
        <Badge tone="green">Routine recommandée</Badge>
        <div className="mt-4 grid gap-3">
          {routineItems.map((item) => <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/24 p-4"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" /><p className="text-sm font-semibold leading-6 text-slate-200">{item}</p></div>)}
        </div>
      </Surface>
      <Surface className="p-5 md:p-6">
        <Badge tone="red">Dépannage</Badge>
        <div className="mt-4 space-y-3">{troubleshooting.map(([title, text]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/24 p-4"><h4 className="font-black text-white">{title}</h4><p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{text}</p></div>)}</div>
      </Surface>
    </div>
  </div>;
}

function TeamManagementPanel({ team, edit, setEdit, onAvatarFile, onSaveTeam, onCopyInvite, canManage, canDeleteTeam, members, roster, inviteCodes = [], saving, onRoleChange, onLink, onRemoveMember, onDeletePlayer, onDeleteTeam, playerForm, setPlayerForm, onCreatePlayer, editingPlayer, playerEditForm, setPlayerEditForm, onUpdatePlayer, onClosePlayerEdit, onEditPlayer }) {
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const linkedPlayerByUser = new Map(roster.filter((player) => player.user_id).map((player) => [player.user_id, player]));
  const memberByUser = new Map(members.map((member) => [member.user_id, member]));
  const unlinkedMemberRows = members.filter((member) => !linkedPlayerByUser.has(member.user_id));
  const linkedCount = roster.filter((player) => player.user_id).length;
  const gameplayCount = roster.filter((player) => isGameplayRole(player.role)).length;
  const staffCount = roster.filter((player) => isStaffRole(player.role)).length;
  const activeCodes = inviteCodes.filter((code) => new Date(code.expires_at).getTime() > nowTick);
  const roleValue = (role) => TEAM_ACCESS_ROLES.some(([id]) => id === String(role || "").toLowerCase()) ? String(role || "").toLowerCase() : "player";
  const linkedProfileLabel = (member) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    const accountName = member.name || member.account_name || "Compte NXT5";
    return linked ? accountName + " · " + (linked.riot_id || roleLabel(linked.role)) : accountName + " · Non-lié";
  };
  const isLinkedElsewhere = (member, player) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    return Boolean(linked && linked.id !== player.id);
  };
  return <Surface glow className="mb-6 p-5 md:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <Badge tone="cyan">Gestion</Badge>
        <h3 className="mt-3 truncate text-3xl font-black tracking-tight text-white md:text-4xl">{team.name}</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Identité, invitations, profils liés et permissions. Tout est regroupé ici pour aller vite.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-emerald-100/80">Liés</p><p className="mt-1 text-2xl font-black text-white">{linkedCount}/{roster.length}</p></div>
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100/80">Joueurs</p><p className="mt-1 text-2xl font-black text-white">{gameplayCount}</p></div>
        <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/10 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-fuchsia-100/80">Staff</p><p className="mt-1 text-2xl font-black text-white">{staffCount}</p></div>
      </div>
    </div>

    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(260px,.7fr)_minmax(0,1.3fr)]">
      <form onSubmit={onSaveTeam} className="rounded-3xl border border-white/10 bg-black/22 p-4">
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/30">
            {edit.avatarDataUrl ? <img src={edit.avatarDataUrl} alt={team.name} className="h-full w-full object-cover" style={{ transform: "scale(" + Number(edit.avatarZoom || 1) + ")", objectPosition: Number(edit.avatarX ?? 50) + "% " + Number(edit.avatarY ?? 50) + "%" }} /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-9 w-9 text-slate-400" /></div>}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <TextInput label="Nom de l'équipe" value={edit.name} onChange={(name) => setEdit({ ...edit, name })} placeholder="Nom" required icon={Trophy} />
            <TextInput label="Tag" value={edit.tag} onChange={(tag) => setEdit({ ...edit, tag })} placeholder="TAG" required icon={Shield} />
          </div>
        </div>
        <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Image de team</summary>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-white/[0.07]"><Upload className="h-4 w-4" /> Choisir une image<input type="file" accept="image/*" className="hidden" onChange={(event) => onAvatarFile(event.target.files?.[0])} disabled={!canManage || saving} /></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">Zoom</span><input type="range" min="1" max="2.5" step="0.05" value={edit.avatarZoom} onChange={(event) => setEdit({ ...edit, avatarZoom: event.target.value })} disabled={!canManage || saving} className="w-full" /></label>
            <label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">Horizontal</span><input type="range" min="0" max="100" value={edit.avatarX} onChange={(event) => setEdit({ ...edit, avatarX: event.target.value })} disabled={!canManage || saving} className="w-full" /></label>
            <label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">Vertical</span><input type="range" min="0" max="100" value={edit.avatarY} onChange={(event) => setEdit({ ...edit, avatarY: event.target.value })} disabled={!canManage || saving} className="w-full" /></label>
          </div>
        </details>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canManage}>Enregistrer</Button>
          {canDeleteTeam && <Button type="button" variant="danger" icon={saving ? Loader2 : Trash2} onClick={onDeleteTeam} disabled={saving}>Supprimer</Button>}
        </div>
        {!canManage && <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">Ton statut actuel ne permet pas de modifier la gestion.</p>}
      </form>

      <div className="rounded-3xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-xl font-black text-white">Invitations temporaires</h4>
            <p className="mt-1 text-sm font-semibold text-slate-300">Un code, valable 1h, à donner au joueur ou au staff.</p>
          </div>
          <Button type="button" variant="ghost" icon={saving ? Loader2 : UserPlus} onClick={onCopyInvite} disabled={saving || !canManage}>Créer un code</Button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {activeCodes.length ? activeCodes.map((code) => {
            const remaining = Math.max(0, Math.ceil((new Date(code.expires_at).getTime() - nowTick) / 1000));
            return <div key={code.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3"><p className="font-mono text-lg font-black tracking-[0.08em] text-white">{code.code}</p><Badge tone={remaining > 900 ? "green" : remaining > 300 ? "yellow" : "red"}>{formatCountdown(remaining)}</Badge></div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-300">Créé par {code.created_by_name || "staff"}</p>
            </div>;
          }) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300 md:col-span-2">Aucun code actif.</p>}
        </div>
      </div>
    </div>

    <div className="mt-6 rounded-3xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><h4 className="text-xl font-black text-white">Créer un profil</h4><p className="mt-1 text-sm font-semibold text-slate-300">Ajoute un joueur ou un membre staff, puis lie-le à un compte NXT5 si besoin.</p></div>
        <Badge tone="purple">Gestion roster</Badge>
      </div>
      <form onSubmit={onCreatePlayer} className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
        <TextInput label="Nom" value={playerForm.name} onChange={(name) => setPlayerForm({ ...playerForm, name })} placeholder="Nom du joueur ou staff" required />
        <TextInput label="Riot ID" value={playerForm.riotId} onChange={(riotId) => setPlayerForm({ ...playerForm, riotId })} placeholder={isStaffRole(playerForm.role) ? "Optionnel pour staff" : "Pseudo#TAG"} required={!isStaffRole(playerForm.role)} disabled={isStaffRole(playerForm.role)} />
        <TextInput label="OP.GG" value={playerForm.opggUrl} onChange={(opggUrl) => setPlayerForm({ ...playerForm, opggUrl })} placeholder={isStaffRole(playerForm.role) ? "Non utilisé pour staff" : "https://op.gg/..."} disabled={isStaffRole(playerForm.role)} />
        <SelectInput label="Catégorie" value={playerForm.role} onChange={(role) => setPlayerForm({ ...playerForm, role, riotId: isStaffRole(role) ? "" : playerForm.riotId, opggUrl: isStaffRole(role) ? "" : playerForm.opggUrl })}>{PROFILE_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</SelectInput>
        <div className="flex items-end"><Button type="submit" disabled={saving || !canManage} icon={saving ? Loader2 : UserPlus} className="w-full">Ajouter</Button></div>
      </form>
      {editingPlayer && <form onSubmit={onUpdatePlayer} className="mt-5 rounded-[1.35rem] border border-cyan-300/20 bg-cyan-400/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><Badge tone="orange">Modification</Badge><h4 className="mt-3 text-xl font-black text-white">Modifier {editingPlayer.name}</h4><p className="mt-1 text-sm font-semibold text-cyan-100/80">Corrige le nom, le Riot ID ou l’OP.GG du profil.</p></div><Button type="button" variant="ghost" icon={X} onClick={onClosePlayerEdit}>Fermer</Button></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3"><TextInput label="Nom" value={playerEditForm.name} onChange={(name) => setPlayerEditForm({ ...playerEditForm, name })} placeholder="Nom visible" required /><TextInput label="Riot ID" value={playerEditForm.riotId} onChange={(riotId) => setPlayerEditForm({ ...playerEditForm, riotId })} placeholder={isStaffRole(editingPlayer.role) ? "Non utilisé pour staff" : "Pseudo#TAG"} required={!isStaffRole(editingPlayer.role)} disabled={isStaffRole(editingPlayer.role)} /><TextInput label="OP.GG" value={playerEditForm.opggUrl} onChange={(opggUrl) => setPlayerEditForm({ ...playerEditForm, opggUrl })} placeholder={isStaffRole(editingPlayer.role) ? "Non utilisé pour staff" : "https://op.gg/..."} disabled={isStaffRole(editingPlayer.role)} /></div>
        <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClosePlayerEdit}>Annuler</Button><Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || !canManage}>Enregistrer</Button></div>
      </form>}
    </div>

    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div><h4 className="text-xl font-black text-white">Profils & accès</h4><p className="mt-1 text-sm font-semibold text-slate-300">Lie un compte, choisis son accès, et retire un profil depuis la même ligne.</p></div>
        <Badge tone="purple">{roster.length} profil{roster.length > 1 ? "s" : ""}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {roster.map((player) => {
          const linkedMember = player.user_id ? memberByUser.get(player.user_id) : null;
          const staff = isStaffRole(player.role);
          return <div key={player.id} className={cx("grid gap-3 rounded-2xl border p-3 xl:grid-cols-[minmax(180px,.78fr)_minmax(210px,1fr)_minmax(150px,.58fr)_minmax(0,.95fr)] xl:items-center", player.user_id ? "border-emerald-300/18 bg-emerald-400/[0.045]" : "border-cyan-300/14 bg-black/22")}>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><RoleTag role={player.role} staff={staff} className="max-w-[7rem] sm:max-w-[8.5rem]" /><Badge tone={player.user_id ? "green" : "orange"}>{player.user_id ? "Lié" : "Non-lié"}</Badge></div>
              <p className="mt-2 truncate text-lg font-black text-white">{linkedMember?.name || linkedMember?.account_name || player.name}</p>
              <p className="truncate text-xs font-semibold text-slate-300">{player.riot_id || (staff ? "Staff" : "Riot ID manquant")}</p>
            </div>
            <label className="block min-w-0"><span className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Compte lié</span><select value={player.user_id || ""} onChange={(event) => onLink(player.id, event.target.value)} disabled={saving || !canManage} className="w-full rounded-xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none"><option value="">Non-lié</option>{members.map((member) => { const blocked = isLinkedElsewhere(member, player); return <option key={member.user_id} value={member.user_id} disabled={blocked}>{linkedProfileLabel(member)}{blocked ? " · Déjà lié" : ""}</option>; })}</select></label>
            <label className="block min-w-0"><span className="mb-1 block text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Accès</span><select value={linkedMember ? roleValue(linkedMember.role) : "player"} onChange={(event) => linkedMember && onRoleChange(linkedMember.user_id, event.target.value)} disabled={!linkedMember || saving || !canManage || String(linkedMember?.role || "").toLowerCase() === "owner"} className="w-full rounded-xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none">{TEAM_ACCESS_ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <div className={cx("grid min-w-0 gap-2", linkedMember ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              {linkedMember && <Button type="button" variant="ghost" icon={UserMinus} className="min-w-0 px-3" onClick={() => onRemoveMember(linkedMember.user_id, roleLabel(player.role) + " · " + (linkedMember.name || player.name))} disabled={saving || !canManage || String(linkedMember.role || "").toLowerCase() === "owner"}><span className="min-w-0 truncate">Renvoyer</span></Button>}
              <Button type="button" variant="ghost" icon={Pencil} className="min-w-0 px-3" onClick={() => onEditPlayer(player)} disabled={saving || !canManage}><span className="min-w-0 truncate">Modifier</span></Button>
              <Button type="button" variant="danger" icon={Trash2} className="min-w-0 px-3" onClick={() => onDeletePlayer(player.id, player.name)} disabled={saving || !canManage}><span className="min-w-0 truncate">Supprimer</span></Button>
            </div>
          </div>;
        })}
      </div>
    </div>

    {unlinkedMemberRows.length > 0 && <div className="mt-5 rounded-3xl border border-fuchsia-300/14 bg-fuchsia-400/[0.045] p-4">
      <h4 className="text-xl font-black text-white">Comptes sans profil</h4>
      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {unlinkedMemberRows.map((member) => <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge tone="slate">Non-lié</Badge><Badge tone={profileStatusTone(member)}>{profileStatusLabel(member)}</Badge></div><p className="mt-2 truncate text-sm font-black text-white">{member.name || member.account_name || "Compte invité"}</p></div>
          <div className="flex flex-wrap gap-2"><select value={roleValue(member.role)} onChange={(event) => onRoleChange(member.user_id, event.target.value)} disabled={saving || !canManage || String(member.role || "").toLowerCase() === "owner"} className="rounded-xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none">{TEAM_ACCESS_ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><Button type="button" variant="danger" icon={UserMinus} onClick={() => onRemoveMember(member.user_id, member.name || "ce compte non lié")} disabled={saving || !canManage || String(member.role || "").toLowerCase() === "owner"}>Renvoyer</Button></div>
        </div>)}
      </div>
    </div>}
  </Surface>;
}

function LinkedPlayerSummary({ player, linkedMember, matches = [] }) {
  const mostPlayed = parseMostPlayed(player?.most_played).slice(0, 3);
  const staff = isStaffRole(player.role);
  const displayName = linkedMember?.name || linkedMember?.account_name || player.name;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><RoleTag role={player.role} staff={staff} className="max-w-[7rem] sm:max-w-[8.5rem]" /><p className="min-w-0 truncate text-2xl font-black text-white">{displayName}</p></div>
      <p className="mt-2 text-sm font-semibold text-slate-300">{player.riot_id || (staff ? "Profil staff sans Riot ID" : "Riot ID manquant")}</p>
      {staff ?<p className="mt-5 rounded-2xl border border-white/10 bg-black/[0.18] p-4 text-sm font-semibold text-slate-300">Accès gestion possible si le compte est lié, mais exclu du draft, du Champion Pool et des imports OP.GG.</p> : (
        <div className="mt-5 flex flex-wrap gap-3">
          {mostPlayed.length ?mostPlayed.map((champion, index) => <ChampionCircle key={champion.champion + "-" + index} champion={champion} index={index} />) : <div className="w-full rounded-2xl border border-white/10 bg-black/[0.18] p-4 text-sm font-semibold text-slate-300">Aucune game importée pour ce profil.</div>}
        </div>
      )}
    </div>
  );
}

function ChampionCircle({ champion, index }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-cyan-200/30 bg-black/35"><ChampionPortrait champion={champion.champion} alt={champion.champion} /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(champion.champion)}</p><p className="text-xs font-black text-cyan-100/75">#{index + 1} · {champion.games || 0} game{champion.games > 1 ? "s" : ""}</p></div></div>;
}

function parseMostPlayed(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ?parsed : [];
  } catch {
    return [];
  }
}

function playerImportedChampionStats(player, matches = []) {
  const rows = playerIntegratedRows(player, matches);
  return Array.from(rows.reduce((map, row) => {
    const champion = row.champion || "Champion";
    const current = map.get(champion) || { champion, games: 0, wins: 0 };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    map.set(champion, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.games - a.games || b.wins - a.wins || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
}

function ImportedChampionBadges({ player, matches = [] }) {
  const items = playerImportedChampionStats(player, matches).slice(0, 3);
  if (!items.length) return <span className="text-xs font-semibold text-slate-300">Aucune game importee pour ce profil</span>;
  return <div className="flex flex-wrap gap-2">{items.map((champion, index) => <ChampionCircle key={(champion.championId || champion.champion) + "-imported-" + index} champion={champion} index={index} />)}</div>;
}

function normalizeProfileKey(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace("#", "-");
}

function normalizeProfileRole(value) {
  const raw = String(value || "").toUpperCase();
  if (raw === "JUNGLE") return "JGL";
  if (raw === "MIDDLE") return "MID";
  if (raw === "BOTTOM") return "ADC";
  if (raw === "UTILITY" || raw === "SUPPORT") return "SUP";
  return raw;
}

function playerIntegratedRows(player, matches = []) {
  const riotKey = normalizeProfileKey(player?.riot_id);
  const nameKey = normalizeProfileKey(player?.name);
  const playerRole = normalizeProfileRole(player?.role);
  const seen = new Set();
  return matches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match }))).filter((row) => {
    const rowRole = normalizeProfileRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition || row.raw?.lane);
    const roleMatches = !playerRole || playerRole === "SUB" || rowRole === playerRole;
    const rowPlayerId = String(row.player_id || "");
    const playerId = String(player?.id || "");
    const rowRiotKey = normalizeProfileKey(row.riot_id);
    const rowSummonerKey = normalizeProfileKey(row.summoner_name);
    const identityMatches = rowPlayerId
      ? rowPlayerId === playerId
      : (Boolean(riotKey) && rowRiotKey === riotKey) || (Boolean(nameKey) && rowSummonerKey === nameKey);
    if (!(row.team_key === "ALLY" && roleMatches && identityMatches)) return false;
    const key = [row.match?.id || row.match?.game_id, row.raw?.participantId || row.participant_id || row.role, row.player_id || row.riot_id || row.summoner_name || player?.id, row.champion].map((value) => String(value || "")).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function PlayerProfileStatsPanel({ player, matches = [] }) {
  const rows = playerIntegratedRows(player, matches);
  const wins = rows.filter((row) => row.match?.result === "Victoire").length;
  const games = rows.length;
  const avg = (field) => games ? rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / games : 0;
  const kda = games ? ((rows.reduce((sum, row) => sum + Number(row.kills || 0) + Number(row.assists || 0), 0)) / Math.max(1, rows.reduce((sum, row) => sum + Number(row.deaths || 0), 0))).toFixed(2) : "0.00";
  const championStats = Array.from(rows.reduce((map, row) => {
    const key = row.champion || "Champion";
    const current = map.get(key) || { champion: key, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0, cs: 0 };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.vision += Number(row.vision || 0);
    current.cs += Number(row.cs || 0);
    map.set(key, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.games - a.games || b.wins - a.wins);
  if (!games) return <div className="rounded-2xl border border-dashed border-cyan-300/18 bg-cyan-400/8 p-4 text-sm font-semibold text-slate-300">Aucune stat intégrée pour ce profil. Importe une game où son Riot ID est présent pour alimenter ce panneau.</div>;
  return <div className="rounded-2xl border border-cyan-300/16 bg-cyan-400/[0.055] p-4"><div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5"><MetricCard icon={Swords} label="Games" value={games} hint="Games intégrées" tone="cyan" /><MetricCard icon={Trophy} label="Winrate" value={`${Math.round((wins / Math.max(1, games)) * 100)}%`} hint={`${wins} victoire${wins > 1 ? "s" : ""}`} tone="green" /><MetricCard icon={Gauge} label="KDA" value={kda} hint="Moyenne globale" tone="purple" /><MetricCard icon={Flame} label="Dégâts" value={formatPoints(avg("damage"))} hint="Moyenne/game" tone="orange" /><MetricCard icon={Eye} label="Vision" value={Math.round(avg("vision"))} hint="Moyenne/game" tone="yellow" /></div><div className="mt-4 grid gap-2 xl:grid-cols-2">{championStats.map((stat) => { const champKda = ((stat.kills + stat.assists) / Math.max(1, stat.deaths)).toFixed(2); return <div key={stat.champion} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"><ChampionPortrait champion={stat.champion} alt={stat.champion} className="h-12 w-12 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-white">{championDisplayName(stat.champion)}</p><Badge tone={Math.round((stat.wins / Math.max(1, stat.games)) * 100) >= 50 ? "green" : "red"}>{Math.round((stat.wins / Math.max(1, stat.games)) * 100)}% WR</Badge></div><p className="mt-1 truncate text-xs font-semibold text-slate-300">{stat.games} game{stat.games > 1 ? "s" : ""} · KDA {champKda} · {formatPoints(stat.damage / Math.max(1, stat.games))} dégâts moy.</p></div></div>; })}</div></div>;
}

function PlayerUltimateProfile({ data, selectedTeamId, currentMember, user, refreshAll, pushToast, route, navigate }) {
  const players = sortPlayersByRole((data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role)));
  const matches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const matchCategories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const canObserveAll = true;
  const linkedPlayer = players.find((player) => player.user_id === user?.id);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [profileView, setProfileView] = useState(() => profileViewFromPath(route?.path || window.location.pathname));
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProfileChampion, setSelectedProfileChampion] = useState("");
  const [coachingContent, setCoachingContent] = useState("");
  const [savingCoaching, setSavingCoaching] = useState(false);
  useEffect(() => {
    const requestedPlayerId = new URLSearchParams(window.location.search || "").get("player") || "";
    const requestedPlayer = players.find((player) => String(player.id || "") === String(requestedPlayerId));
    const fallback = requestedPlayer?.id || players[0]?.id || linkedPlayer?.id;
    if (!selectedPlayerId || !players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(fallback || "");
  }, [linkedPlayer?.id, players.map((player) => player.id).join("|"), selectedPlayerId]);
  useEffect(() => {
    setSelectedProfileChampion("");
  }, [selectedPlayerId, selectedCategoryId]);
  useEffect(() => {
    setSelectedCategoryId("");
  }, [selectedTeamId]);
  useEffect(() => {
    setProfileView(profileViewFromPath(route?.path || window.location.pathname));
  }, [route?.path]);
  function openProfileView(viewId) {
    const nextView = profileView === viewId ? "overview" : viewId;
    setProfileView(nextView);
    navigate?.(`${profilePathFromView(nextView)}${route?.search || window.location.search || ""}`);
  }
  function selectProfile(playerId) {
    setSelectedPlayerId(playerId);
    const params = new URLSearchParams(window.location.search || "");
    params.set("player", playerId);
    navigate?.(`${window.location.pathname}?${params.toString()}`, { replace: true });
  }
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || linkedPlayer || players[0];
  const coachingNote = (data.profileCoachingNotes || []).find((note) => note.team_id === selectedTeamId && note.player_id === selectedPlayer?.id);
  const canEditCoaching = canObserveAll;
  useEffect(() => {
    setCoachingContent(coachingNote?.content || "");
  }, [selectedPlayerId, coachingNote?.content]);
  const filteredMatches = selectedCategoryId ? matches.filter((match) => matchHasCategory(match, selectedCategoryId)) : matches;
  const activeProfileCategory = matchCategories.find((category) => String(category.id || "") === String(selectedCategoryId || ""));
  const rows = selectedPlayer ? playerIntegratedRows(selectedPlayer, filteredMatches) : [];
  const games = rows.length;
  const wins = rows.filter((row) => row.match?.result === "Victoire").length;
  const losses = Math.max(0, games - wins);
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const avg = (field, decimals = 1) => (sum(field) / Math.max(1, games)).toFixed(decimals);
  const kda = ((sum("kills") + sum("assists")) / Math.max(1, sum("deaths"))).toFixed(2);
  const championPool = (data.championPool || []).filter((row) => row.team_id === selectedTeamId && (row.player_id === selectedPlayer?.id || row.player_name === selectedPlayer?.name));
  const championStats = Array.from(rows.reduce((map, row) => {
    const key = row.champion || "Champion";
    const current = map.get(key) || { champion: key, rows: [], games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0, gold: 0, csPerMin: 0, kp: 0 };
    current.rows.push(row);
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.vision += Number(row.vision || 0);
    current.gold += Number(row.gold || 0);
    current.csPerMin += Number(row.cs_per_min || 0);
    current.kp += parsePercent(row.kill_participation || row.kp || 0);
    map.set(key, current);
    return map;
  }, new Map()).values()).map((stat) => ({ ...stat, winrate: Math.round((stat.wins / Math.max(1, stat.games)) * 100), kda: ((stat.kills + stat.assists) / Math.max(1, stat.deaths)).toFixed(2) })).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
  const activeProfileChampion = selectedProfileChampion || championStats[0]?.champion || "";
  const selectedProfileChampionStats = championStats.find((stat) => stat.champion === activeProfileChampion) || null;
  const selectedProfileChampionRows = selectedProfileChampionStats?.rows || [];
  const selectedProfileChampionMatchups = Array.from(selectedProfileChampionRows.reduce((map, row) => {
    const enemy = opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId);
    const champion = enemy?.champion || "Adversaire";
    const current = map.get(champion) || { champion, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0 };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.vision += Number(row.vision || 0);
    map.set(champion, current);
    return map;
  }, new Map()).values()).map((item) => ({ ...item, losses: Math.max(0, item.games - item.wins), winrate: Math.round((item.wins / Math.max(1, item.games)) * 100), kda: ((item.kills + item.assists) / Math.max(1, item.deaths)).toFixed(2), avgDamage: item.damage / Math.max(1, item.games), avgVision: item.vision / Math.max(1, item.games) })).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
  const matchups = Array.from(rows.reduce((map, row) => {
    const enemy = opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId);
    if (!enemy?.champion) return map;
    const key = enemy.champion;
    const current = map.get(key) || { champion: key, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, rows: [] };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.rows.push({ row, enemy });
    map.set(key, current);
    return map;
  }, new Map()).values()).map((item) => ({ ...item, losses: Math.max(0, item.games - item.wins), winrate: Math.round((item.wins / Math.max(1, item.games)) * 100), kda: ((item.kills + item.assists) / Math.max(1, item.deaths)).toFixed(2) })).sort((a, b) => b.games - a.games || b.winrate - a.winrate);
  const bestMatchups = matchups.filter((item) => item.games >= 1).slice().sort((a, b) => b.winrate - a.winrate || b.games - a.games).slice(0, 5);
  const worstMatchups = matchups.filter((item) => item.games >= 1).slice().sort((a, b) => a.winrate - b.winrate || b.games - a.games).slice(0, 5);
  const bangers = championStats.filter((stat) => stat.games >= 1).slice().sort((a, b) => (b.winrate * 2 + Number(b.kda) * 12 + b.games * 3) - (a.winrate * 2 + Number(a.kda) * 12 + a.games * 3)).slice(0, 3);
  const flops = championStats.filter((stat) => stat.games >= 1).slice().sort((a, b) => (a.winrate * 2 + Number(a.kda) * 12 - a.games * 2) - (b.winrate * 2 + Number(b.kda) * 12 - b.games * 2)).slice(0, 3);
  const avgDeaths = Number(avg("deaths"));
  const avgKills = Number(avg("kills"));
  const avgAssists = Number(avg("assists"));
  const avgKp = rows.reduce((total, row) => total + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, games);
  const avgDamageShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "damage"), 0) / Math.max(1, games);
  const avgGoldShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "gold"), 0) / Math.max(1, games);
  const avgVisionShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "vision"), 0) / Math.max(1, games);
  const avgDeathShare = rows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "deaths"), 0) / Math.max(1, games);
  const damageResourceDelta = avgDamageShare - avgGoldShare;
  const topChampion = championStats[0];
  const topChampionShare = topChampion ? Math.round((topChampion.games / Math.max(1, games)) * 100) : 0;
  const sortedProfileRows = rows.slice().sort((a, b) => String(b.match?.created_at || b.match?.game_date || b.match?.game_id || "").localeCompare(String(a.match?.created_at || a.match?.game_date || a.match?.game_id || "")));
	  const avgRows = (items, getter, decimals = 1) => (items.reduce((total, item) => total + Number(getter(item) || 0), 0) / Math.max(1, items.length)).toFixed(decimals);
	  const globalCs = csMilestoneSummary(rows);
	  const avgCsPerMin = Number(avgRows(rows, (row) => row.cs_per_min));
	  const roleKey = normalizeProfileRole(selectedPlayer?.role);
  const roleRowsAll = filteredMatches.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY" && normalizeProfileRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition || row.raw?.lane) === roleKey).map((row) => ({ ...row, match })));
  const roleReferenceRows = roleRowsAll.filter((row) => !rows.some((item) => item.id === row.id));
  const benchmarkRows = roleReferenceRows.length ? roleReferenceRows : roleRowsAll;
  const benchmarkCs = csMilestoneSummary(benchmarkRows);
  const benchmarkKp = Number(avgRows(benchmarkRows, (row) => parsePercent(row.kill_participation || row.kp || 0), 0));
  const benchmarkDeaths = Number(avgRows(benchmarkRows, (row) => row.deaths));
	  const benchmarkDamageShare = benchmarkRows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "damage"), 0) / Math.max(1, benchmarkRows.length);
	  const benchmarkGoldShare = benchmarkRows.reduce((total, row) => total + shareOfTeam(row, teamRows(row.match, "ALLY"), "gold"), 0) / Math.max(1, benchmarkRows.length);
	  const benchmarkResourceDelta = benchmarkDamageShare - benchmarkGoldShare;
	  const cs20Values = rows.map((row) => csAtMinute(row, 20)).filter((value) => Number.isFinite(value));
	  const benchmarkCs10Delta = benchmarkCs.samples ? Number(globalCs.at10 || 0) - Number(benchmarkCs.at10 || 0) : null;
	  const benchmarkCs20Delta = benchmarkCs.samples ? Number(globalCs.at20 || 0) - Number(benchmarkCs.at20 || 0) : null;
	  const roleKpDelta = benchmarkRows.length ? avgKp - benchmarkKp : null;
	  const roleDeathDelta = benchmarkRows.length ? avgDeaths - benchmarkDeaths : null;
	  const cs10Target = { TOP: 70, MID: 72, ADC: 74, JGL: 56, SUP: null }[normalizeProfileRole(selectedPlayer?.role)] ?? null;
	  const cs10Values = rows.map((row) => csAtMinute(row, 10)).filter((value) => Number.isFinite(value));
	  const lowCs10Count = cs10Target ? cs10Values.filter((value) => value < cs10Target - 8).length : 0;
	  const highDeathRows = rows.filter((row) => Number(row.deaths || 0) >= Math.max(4, Math.ceil(avgDeaths + 1)));
	  const lowKpRows = rows.filter((row) => parsePercent(row.kill_participation || row.kp || 0) < 50);
	  const lowCsRows = cs10Target ? rows.filter((row) => { const value = csAtMinute(row, 10); return Number.isFinite(value) && value < cs10Target - 8; }) : [];
	  const reviewRows = sortedProfileRows.filter((row) => highDeathRows.includes(row) || lowKpRows.includes(row) || lowCsRows.includes(row)).slice(0, 3);
	  const worstDeathRow = rows.slice().sort((a, b) => Number(b.deaths || 0) - Number(a.deaths || 0))[0];
	  const worstKpRow = rows.slice().sort((a, b) => parsePercent(a.kill_participation || a.kp || 0) - parsePercent(b.kill_participation || b.kp || 0))[0];
	  const worstCs10Row = rows
	    .map((row) => ({ row, value: csAtMinute(row, 10), enemy: opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId) }))
	    .map((item) => ({ ...item, enemyValue: item.enemy ? csAtMinute({ ...item.enemy, match: item.row.match }, 10) : null }))
	    .filter((item) => Number.isFinite(item.value) && Number.isFinite(item.enemyValue))
	    .sort((a, b) => (a.value - a.enemyValue) - (b.value - b.enemyValue))[0];
	  const roleCoachLens = {
	    TOP: { lane: "jouer les deux premières waves pour garder le contrôle du bounce", fight: "annoncer TP ou absence de TP 70s avant objectif", vision: "poser une ward profonde uniquement quand la wave est fixée", draft: "prioriser un pick qui tient weakside si le plan équipe joue bot" },
	    JGL: { lane: "verrouiller le premier clear et annoncer le premier move avant 3:15", fight: "lier chaque fight à un objectif ou à une wave prenable", vision: "poser la vision d'entrée 45s avant drake/grubs, pas au spawn", draft: "séparer les picks tempo des picks scaling dans les reviews" },
	    MID: { lane: "transformer la prio wave en move river ou en reset tempo", fight: "arriver au fight avec la wave déjà neutralisée", vision: "warder un côté fort puis jouer autour de ce côté", draft: "garder au moins un champion prio lane et un champion contrôle" },
	    ADC: { lane: "sécuriser les resets canon et éviter les trades sans wave favorable", fight: "jouer le premier fight autour de la distance max et du peel disponible", vision: "demander la ligne de vision avant de toucher mid T1 ou drake", draft: "distinguer les picks carry ressources des picks utilitaires" },
	    SUP: { lane: "lier chaque roam à une wave bot crash ou un timer reset adverse", fight: "entrer en fight seulement si le carry peut suivre ou si la cible est isolée", vision: "placer le premier setup objectif avant le reset de contrôle", draft: "préparer un engage et un pick peel selon le plan ADC" },
	  }[roleKey] || { lane: "clarifier le plan de lane", fight: "clarifier la présence en fight", vision: "clarifier la routine vision", draft: "clarifier le rôle en draft" };
	  const championName = (stat) => stat?.champion ? championDisplayName(stat.champion) : "le champion principal";
	  const matchName = (row) => row?.match ? matchDisplayName(row.match, "la game ciblée") : "la game ciblée";
	  const coachComparisons = [
	    { label: "CS10 vs poste", value: globalCs.at10 ?? "-", detail: benchmarkCs.samples ? `${Number(globalCs.at10 || 0) - Number(benchmarkCs.at10 || 0) >= 0 ? "+" : ""}${Number(globalCs.at10 || 0) - Number(benchmarkCs.at10 || 0)} vs réf.` : cs10Target ? `cible ${cs10Target}` : "réf. indisponible", toneName: benchmarkCs.samples ? Number(globalCs.at10 || 0) >= Number(benchmarkCs.at10 || 0) ? "green" : "orange" : "slate", icon: Target },
	    { label: "KP vs poste", value: `${Math.round(avgKp)}%`, detail: benchmarkRows.length ? (avgKp >= benchmarkKp ? "au-dessus de la réf." : "sous la réf.") : "réf. indisponible", toneName: !benchmarkRows.length || avgKp >= benchmarkKp ? "cyan" : "yellow", icon: Swords },
	    { label: "Morts vs poste", value: avgDeaths.toFixed(1), detail: benchmarkRows.length ? `${(avgDeaths - benchmarkDeaths) >= 0 ? "+" : ""}${(avgDeaths - benchmarkDeaths).toFixed(1)} vs réf.` : "réf. indisponible", toneName: !benchmarkRows.length || avgDeaths <= benchmarkDeaths ? "green" : "red", icon: Shield },
	    { label: "Rendement ressources", value: `${avgDamageShare.toFixed(1)}%`, detail: `${avgGoldShare.toFixed(1)}% de l'or équipe`, toneName: !benchmarkRows.length || damageResourceDelta >= benchmarkResourceDelta ? "green" : "orange", icon: Gauge },
	  ];
	  const coachSignals = [
	    games < 3 && { kind: "issue", priority: 98, title: "Volume trop faible", text: `${games} game${games > 1 ? "s" : ""} seulement : le bon angle est de formuler une hypothèse, pas une conclusion.`, action: `Prochaine review : choisir un seul test mesurable pour ${roleLabel(roleKey)} (${roleCoachLens.lane}) et le recontrôler après 3 games.`, toneName: "slate", icon: AlertTriangle },
	    cs10Target && globalCs.samples > 0 && Number(globalCs.at10 || 0) < cs10Target - 8 && { kind: "issue", priority: 94, title: "Lane trop coûteuse avant 10", text: `CS10 moyen ${globalCs.at10} pour une cible ${cs10Target}. Le problème prioritaire n'est pas le farm final, c'est le plan des trois premières waves.`, action: worstCs10Row ? `Ouvrir ${matchName(worstCs10Row.row)} : ${championDisplayName(worstCs10Row.row.champion)} est à ${worstCs10Row.value - worstCs10Row.enemyValue} CS au CS10. Revoir matchup, wave 1-3 et premier reset.` : `En scrim : ${roleCoachLens.lane}, puis noter CS10 + reset timing.`, toneName: "orange", icon: Target },
	    benchmarkCs.samples && benchmarkCs20Delta < -14 && { kind: "issue", priority: 90, title: "La lane ne se répare pas au midgame", text: `CS20 ${globalCs.at20 ?? "-"} (${benchmarkCs20Delta} vs référence du poste). Le retard continue après la lane, donc le problème est aussi sur les resets et la collecte side/mid.`, action: `Sur les 2 prochaines games : call explicite du prochain catch de wave avant chaque objectif, puis vérifier si le CS20 repasse au-dessus de ${Number(benchmarkCs.at20 || 0)}.`, toneName: "orange", icon: Target },
	    avgDeathShare > 24 && { kind: "issue", priority: 88, title: "Exposition qui coûte les fights", text: `${avgDeaths.toFixed(1)} morts moy. et ${avgDeathShare.toFixed(1)}% des morts équipe. Le joueur prend trop souvent la mort qui rend le setup injouable.`, action: worstDeathRow ? `Review ${matchName(worstDeathRow)} : ${Number(worstDeathRow.deaths || 0)} morts sur ${championDisplayName(worstDeathRow.champion)}. Classer chaque mort : wave, vision, greed ou fight forcé.` : `En review : isoler les morts 90s avant objectif et décider si la règle doit être "reset" ou "pas de facecheck".`, toneName: "red", icon: Shield },
	    avgKp < 55 && { kind: "issue", priority: 84, title: "Connexion fights insuffisante", text: `${Math.round(avgKp)}% KP moyen${Number.isFinite(roleKpDelta) ? ` (${roleKpDelta >= 0 ? "+" : ""}${roleKpDelta.toFixed(0)} vs poste)` : ""}. Le joueur est trop souvent hors du fight utile ou arrive après la conversion.`, action: worstKpRow ? `Ouvrir ${matchName(worstKpRow)} : KP ${Math.round(parsePercent(worstKpRow.kill_participation || worstKpRow.kp || 0))}% sur ${championDisplayName(worstKpRow.champion)}. Revoir le move juste avant les 2 premiers objectifs.` : `Prochain bloc : annoncer 30s avant objectif "je peux fight / je dois catch / je dois reset".`, toneName: "yellow", icon: Swords },
	    damageResourceDelta < -4 && { kind: "issue", priority: 80, title: "Ressources mal converties", text: `${avgDamageShare.toFixed(1)}% des dégâts pour ${avgGoldShare.toFixed(1)}% de l'or équipe. L'équipe investit plus que ce que le profil transforme en pression.`, action: `Draft/review : si ${championName(topChampion)} reçoit les ressources, définir l'objectif de conversion avant 14:00 : plaque, drake, Herald/grubs ou tempo mid.`, toneName: "orange", icon: Gauge },
	    avgVisionShare < 17 && { kind: "issue", priority: 72, title: "Vision sans impact visible", text: `${avgVisionShare.toFixed(1)}% de la vision équipe. Le sujet n'est pas juste le score de vision : il faut vérifier si les wards protègent le prochain move du rôle.`, action: `Prochain scrim : ${roleCoachLens.vision}. En review, garder uniquement les wards qui ont créé un fight, évité une mort ou sécurisé un objectif.`, toneName: "purple", icon: Eye },
	    topChampionShare >= 65 && championStats.length > 1 && { kind: "issue", priority: 68, title: "Draft trop lisible", text: `${championDisplayName(topChampion.champion)} représente ${topChampionShare}% des games. Le joueur a peut-être un bon confort, mais le plan devient facile à cibler.`, action: `Préparer une alternative de même fonction que ${championDisplayName(topChampion.champion)} et une alternative opposée : ${roleCoachLens.draft}.`, toneName: "yellow", icon: Crown },
	    avgDamageShare >= avgGoldShare + 3 && { kind: "strength", priority: 78, title: "Impact rentable", text: `${avgDamageShare.toFixed(1)}% dégâts pour ${avgGoldShare.toFixed(1)}% gold : le joueur convertit bien les ressources reçues.`, action: `À maintenir : continuer à lui donner les mêmes timings de ressources quand la draft demande du carry ${roleLabel(roleKey)}.`, toneName: "green", icon: Flame },
	    avgKp >= 65 && { kind: "strength", priority: 74, title: "Présence fights solide", text: `${Math.round(avgKp)}% KP moyen : le joueur est connecté aux kills utiles et participe aux conversions.`, action: `À pousser : utiliser cette présence pour caller plus tôt le prochain objectif après kill, surtout quand ${championName(topChampion)} est joué.`, toneName: "cyan", icon: Swords },
	    avgDeathShare <= 18 && games >= 3 && { kind: "strength", priority: 70, title: "Profil stable sous pression", text: `${avgDeaths.toFixed(1)} morts moy. et faible exposition relative. Il garde assez souvent la game jouable.`, action: `À conserver : ne pas le forcer dans des engages sans information ; construire autour de sa capacité à rester vivant jusqu'au fight clé.`, toneName: "green", icon: Shield },
	    avgVisionShare >= 22 && { kind: "strength", priority: 64, title: "Présence map exploitable", text: `${avgVisionShare.toFixed(1)}% de la vision équipe : le profil participe déjà au contrôle de zone.`, action: `À préciser : transformer cette vision en call clair "on entre / on trade / on abandonne" avant les objectifs.`, toneName: "cyan", icon: Eye },
	    topChampion && topChampion.winrate >= 55 && { kind: "strength", priority: 62, title: "Pick de confiance identifié", text: `${championDisplayName(topChampion.champion)} : ${topChampion.winrate}% WR sur ${topChampion.games} game${topChampion.games > 1 ? "s" : ""}, KDA ${topChampion.kda}.`, action: `Draft : garder ${championDisplayName(topChampion.champion)} comme référence, mais noter dans quelles lanes/matchups il gagne vraiment son avantage.`, toneName: "green", icon: Crown },
	  ].filter(Boolean).sort((a, b) => b.priority - a.priority);
	  const coachIssues = coachSignals.filter((item) => item.kind === "issue").slice(0, 4);
	  const coachStrengths = coachSignals.filter((item) => item.kind === "strength").slice(0, 3);
	  const coachDecisions = [
	    { label: "Angle prioritaire", text: coachIssues[0]?.title || coachStrengths[0]?.title || "Stabiliser le rôle", toneName: coachIssues[0]?.toneName || coachStrengths[0]?.toneName || "cyan" },
	    { label: "Consigne scrim", text: coachIssues[0]?.action || coachStrengths[0]?.action || roleCoachLens.lane, toneName: coachIssues[0]?.toneName || "green" },
	    { label: "Pick à valoriser", text: bangers[0] ? championDisplayName(bangers[0].champion) : topChampion ? championDisplayName(topChampion.champion) : "À confirmer", toneName: "green" },
	    { label: "Pick / matchup à revoir", text: flops[0] ? championDisplayName(flops[0].champion) : worstMatchups[0] ? `vs ${championDisplayName(worstMatchups[0].champion)}` : "Aucune alerte", toneName: flops[0] || worstMatchups[0] ? "red" : "slate" },
	  ];
	  const coachActions = [
	    ...(coachIssues[0] ? [coachIssues[0].action] : [coachStrengths[0]?.action || `Conserver la base actuelle, puis contrôler ${roleCoachLens.fight} sur le prochain bloc.`]),
	    reviewRows[0] ? `Ouvrir ${matchDisplayName(reviewRows[0].match, "la game prioritaire")} : vérifier précisément le déclencheur avant la mauvaise stat, pas seulement le score final.` : flops[0] ? `Mettre ${championDisplayName(flops[0].champion)} en review avant de le ressortir : identifier si le problème vient du matchup, du build ou du plan équipe.` : `Comparer ${championName(topChampion)} à une alternative de pool après quelques imports supplémentaires.`,
	    worstMatchups[0] ? `Isoler les games vs ${championDisplayName(worstMatchups[0].champion)} : noter le plan de lane, le premier reset et le premier fight objectif.` : `Draft : ${roleCoachLens.draft}.`,
	  ].filter(Boolean);
  const coachPillars = [
    { label: "Laning / farm", value: globalCs.at10 ?? "-", detail: cs10Target ? `${lowCs10Count}/${cs10Values.length || 0} sous cible CS10` : `${avgCsPerMin.toFixed(1)} CS/min moyen`, toneName: cs10Target && lowCs10Count > Math.max(1, cs10Values.length * 0.35) ? "orange" : "green", icon: Target },
    { label: "Fights", value: `${Math.round(avgKp)}%`, detail: `${lowKpRows.length} game${lowKpRows.length > 1 ? "s" : ""} sous 50% KP`, toneName: avgKp >= 60 ? "cyan" : "yellow", icon: Swords },
    { label: "Ressources", value: `${avgDamageShare.toFixed(1)}%`, detail: `${avgGoldShare.toFixed(1)}% de l'or équipe`, toneName: damageResourceDelta >= 0 ? "green" : "orange", icon: Gauge },
    { label: "Sécurité", value: avgDeaths.toFixed(1), detail: `${highDeathRows.length} game${highDeathRows.length > 1 ? "s" : ""} à morts hautes`, toneName: avgDeathShare <= 20 ? "green" : "red", icon: Shield },
    { label: "Pool", value: championStats.length, detail: topChampion ? `${topChampionShare}% sur ${championDisplayName(topChampion.champion)}` : "aucun champion", toneName: topChampionShare >= 60 ? "yellow" : "cyan", icon: Crown },
  ];
  const coachVerdict = coachIssues[0]?.title || coachStrengths[0]?.title || "Données à enrichir";
  const coachSummary = coachIssues.length ? coachIssues[0].text : coachStrengths[0]?.text || "Importe quelques games supplémentaires pour construire un diagnostic fiable.";
  const profileSignals = [
    { title: "Impact dégâts", value: `${avgDamageShare.toFixed(1)}%`, detail: `${formatPoints(sum("damage") / Math.max(1, games))} dégâts moyens · ${avgGoldShare.toFixed(1)}% gold équipe`, toneName: avgDamageShare >= avgGoldShare ? "purple" : "orange", icon: Flame },
    { title: "Rendement ressources", value: `${avgDamageShare.toFixed(1)}%`, detail: `${avgGoldShare.toFixed(1)}% de l'or équipe reçu.`, toneName: damageResourceDelta >= 0 ? "green" : "red", icon: Gauge },
    { title: "Participation combats", value: `${Math.round(avgKp)}% KP`, detail: `${avgKills.toFixed(1)} kills · ${avgAssists.toFixed(1)} assists moyens`, toneName: avgKp >= 60 ? "cyan" : "yellow", icon: Swords },
    { title: "Exposition", value: `${avgDeathShare.toFixed(1)}%`, detail: `${avgDeaths.toFixed(1)} morts moyennes · part des morts équipe`, toneName: avgDeathShare <= 20 ? "green" : "red", icon: Shield },
    { title: "Présence vision", value: `${avgVisionShare.toFixed(1)}%`, detail: `${avg("vision")} vision moyenne · part vision équipe`, toneName: avgVisionShare >= 20 ? "cyan" : "purple", icon: Eye },
    { title: "Pool joué", value: `${championStats.length} champions`, detail: topChampion ? `${championDisplayName(topChampion.champion)} représente ${topChampionShare}% des games` : "Aucune game importée.", toneName: topChampionShare >= 60 ? "orange" : "green", icon: Crown },
  ];
  async function saveCoachingNote() {
    if (!selectedPlayer || !selectedTeamId || !canEditCoaching) return;
    setSavingCoaching(true);
    try {
      await apiFetch("player-coaching-notes-manage", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, playerId: selectedPlayer.id, content: coachingContent }) });
      await refreshAll?.();
      pushToast?.({ type: "green", title: "Bilan coaching enregistré", text: "La note globale du profil est à jour." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Bilan impossible", text: err.message });
    } finally {
      setSavingCoaching(false);
    }
  }
  async function exportProfilePng() {
    if (!selectedPlayer) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const shortCanvas = (value, max = 28) => String(value || "").length > max ? `${String(value).slice(0, max - 1)}...` : String(value || "");
    const accentColor = (accent = "cyan") => accent === "pink" ? "#f472b6" : accent === "green" ? "#34d399" : accent === "yellow" ? "#facc15" : accent === "orange" ? "#fb923c" : accent === "purple" ? "#c084fc" : "#67e8f9";
    const accentSoft = (accent = "cyan", alpha = 0.16) => accent === "pink" || accent === "red" ? `rgba(244,114,182,${alpha})` : accent === "green" ? `rgba(52,211,153,${alpha})` : accent === "yellow" ? `rgba(250,204,21,${alpha})` : accent === "orange" ? `rgba(251,146,60,${alpha})` : accent === "purple" ? `rgba(192,132,252,${alpha})` : `rgba(103,232,249,${alpha})`;
    const fitText = (text, x, y, maxWidth, { font, color = "#fff", min = 12, align = "left" } = {}) => {
      const source = String(text || "");
      let nextFont = font || "800 20px Inter, Arial, sans-serif";
      const match = nextFont.match(/(\d+)px/);
      let size = match ? Number(match[1]) : 20;
      ctx.font = nextFont;
      while (ctx.measureText(source).width > maxWidth && size > min) {
        size -= 1;
        nextFont = nextFont.replace(/\d+px/, `${size}px`);
        ctx.font = nextFont;
      }
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(source, x, y);
      ctx.textAlign = "left";
    };
    const drawLine = (x1, y1, x2, y2, color = "rgba(255,255,255,.10)", width = 1) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    const drawPanel = (x, y, w, h, accent = "cyan", alpha = 0.58) => {
      const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, accentSoft(accent, 0.12));
      gradient.addColorStop(0.38, `rgba(5,10,24,${alpha})`);
      gradient.addColorStop(1, "rgba(5,10,24,.48)");
      ctx.fillStyle = gradient;
      ctx.strokeStyle = accentSoft(accent, 0.34);
      ctx.lineWidth = 1.5;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = accentColor(accent);
      ctx.fillRect(x, y, 4, h);
    };
    const imageCache = new Map();
    const loadCanvasImage = (url) => new Promise((resolve) => {
      if (!url) return resolve(null);
      if (imageCache.has(url)) return resolve(imageCache.get(url));
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = () => {
        imageCache.set(url, null);
        resolve(null);
      };
      img.src = url;
    });
    const drawImageCover = (img, x, y, w, h, radius = 12) => {
      if (!img) return false;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.clip();
      const ratio = Math.max(w / img.width, h / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
      return true;
    };
    const drawImageContain = (img, x, y, w, h) => {
      if (!img) return false;
      const ratio = Math.min(w / img.width, h / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return true;
    };
    const drawCachedImage = (sources, x, y, w, h, radius = 12) => {
      const list = Array.isArray(sources) ? sources : [sources];
      const img = list.map((url) => imageCache.get(url)).find(Boolean);
      if (drawImageCover(img, x, y, w, h, radius)) return;
      ctx.fillStyle = "rgba(255,255,255,.06)";
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
      ctx.stroke();
    };
    const drawMetric = (label, value, detail, x, y, w, accent = "cyan") => {
      ctx.fillStyle = accentColor(accent);
      ctx.font = "900 13px Inter, Arial, sans-serif";
      ctx.fillText(label.toUpperCase(), x + 22, y + 31);
      fitText(shortCanvas(value, 16), x + 22, y + 66, w - 44, { font: "900 30px Inter, Arial, sans-serif", color: "#ffffff", min: 18 });
      fitText(shortCanvas(detail, 30), x + 22, y + 84, w - 44, { font: "800 13px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    };
    const imageUrls = new Set(["/assets/nxt5-wordmark.png", "/assets/nxt5-mark.png"]);
    championStats.slice(0, 6).forEach((stat) => championPortraitSources(stat.champion, stat.champion).forEach((url) => imageUrls.add(url)));
    await Promise.all([...imageUrls].filter(Boolean).map(loadCanvasImage));

    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#030914");
    gradient.addColorStop(0.52, "#020511");
    gradient.addColorStop(1, "#090416");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 64) drawLine(x, 0, x, H, "rgba(103,232,249,.026)", 1);
    for (let y = 0; y <= H; y += 64) drawLine(0, y, W, y, "rgba(103,232,249,.018)", 1);
    const bg = ctx.createRadialGradient(240, 90, 80, 240, 90, 680);
    bg.addColorStop(0, "rgba(34,211,238,.22)");
    bg.addColorStop(0.48, "rgba(30,64,175,.08)");
    bg.addColorStop(1, "rgba(2,5,17,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const bg2 = ctx.createRadialGradient(W - 220, 120, 90, W - 220, 120, 700);
    bg2.addColorStop(0, "rgba(217,70,239,.18)");
    bg2.addColorStop(1, "rgba(2,5,17,0)");
    ctx.fillStyle = bg2;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(103,232,249,.24)";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 42, W - 96, H - 84);
    drawLine(72, 188, W - 72, 188, "rgba(103,232,249,.55)", 2.5);
    drawLine(72, 190, W - 72, 190, "rgba(244,114,182,.22)", 1);
    drawImageContain(imageCache.get("/assets/nxt5-mark.png"), 90, 72, 82, 82);
    drawImageContain(imageCache.get("/assets/nxt5-wordmark.png"), 188, 78, 236, 62);
    fitText(selectedPlayer.name || "Profil NXT5", 464, 105, W - 860, { font: "900 44px Inter, Arial, sans-serif", color: "#ffffff", min: 24 });
    fitText(`${roleLabel(selectedPlayer.role)} · ${selectedPlayer.riot_id || "Riot ID non lié"}`, 466, 142, W - 870, { font: "800 18px Inter, Arial, sans-serif", color: "#c8f7ff", min: 12 });
    ctx.font = "900 16px Inter, Arial, sans-serif";
    const pillText = "PROFILE EXPORT";
    const pillW = Math.max(170, ctx.measureText(pillText).width + 34);
    ctx.fillStyle = "rgba(217,70,239,.14)";
    ctx.strokeStyle = "rgba(217,70,239,.34)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(W - 72 - pillW, 86, pillW, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pillText, W - 72 - pillW + 17, 108);

    const metrics = [
      ["Games", String(games), `${wins}W - ${losses}L`, "cyan"],
      ["Winrate", `${Math.round((wins / Math.max(1, games)) * 100)}%`, "Résumé importé", wins >= losses ? "green" : "orange"],
      ["KDA", kda, `${avg("kills")}/${avg("deaths")}/${avg("assists")} moy.`, "cyan"],
      ["KP", `${Math.round(avgKp)}%`, "Participation fights", avgKp >= 60 ? "green" : "yellow"],
      ["Dégâts", formatPoints(sum("damage") / Math.max(1, games)), "Moyenne/game", "purple"],
      ["Vision", String(Math.round(sum("vision") / Math.max(1, games))), "Moyenne/game", "orange"],
    ];
    drawPanel(90, 220, 1740, 96, "cyan", 0.54);
    metrics.forEach(([label, value, detail, accent], index) => {
      const x = 90 + index * 290;
      if (index) drawLine(x, 236, x, 300, "rgba(255,255,255,.10)", 1);
      drawMetric(label, value, detail, x + 2, 220, 286, accent);
    });

    drawPanel(90, 356, 860, 364, "pink", 0.50);
    fitText("Champions joués", 126, 414, 420, { font: "900 34px Inter, Arial, sans-serif", color: "#ffffff", min: 22 });
    fitText("Volume, winrate et KDA sur les imports", 126, 442, 560, { font: "800 14px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    championStats.slice(0, 6).forEach((stat, index) => {
      const y = 478 + index * 38;
      ctx.fillStyle = index % 2 ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.018)";
      ctx.fillRect(126, y, 760, 38);
      drawCachedImage(championPortraitSources(stat.champion, stat.champion), 136, y + 5, 28, 28, 7);
      fitText(championDisplayName(stat.champion), 176, y + 24, 230, { font: "900 15px Inter, Arial, sans-serif", color: "#ffffff", min: 10 });
      fitText(`${stat.games}G`, 430, y + 24, 58, { font: "900 13px Inter, Arial, sans-serif", color: "#fbcfe8", min: 10 });
      fitText(`${stat.winrate}% WR`, 514, y + 24, 82, { font: "800 12px Inter, Arial, sans-serif", color: stat.winrate >= 50 ? "#bbf7d0" : "#fecdd3", min: 10 });
      fitText(`KDA ${stat.kda}`, 626, y + 24, 110, { font: "800 12px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    });
    if (!championStats.length) fitText("Aucun champion importé.", 126, 508, 560, { font: "800 18px Inter, Arial, sans-serif", color: "#c7d4e5", min: 12 });

    drawPanel(1010, 356, 820, 364, "green", 0.50);
    fitText("Lecture coach", 1046, 414, 420, { font: "900 34px Inter, Arial, sans-serif", color: "#ffffff", min: 22 });
    fitText(shortCanvas(coachVerdict, 54), 1046, 454, 700, { font: "900 23px Inter, Arial, sans-serif", color: "#ffffff", min: 15 });
    fitText(shortCanvas(coachSummary, 112), 1046, 488, 720, { font: "800 15px Inter, Arial, sans-serif", color: "#c7d4e5", min: 10 });
    drawLine(1046, 520, 1794, 520, "rgba(52,211,153,.24)", 1.5);
    coachDecisions.forEach((item, index) => {
      const y = 550 + index * 38;
      ctx.fillStyle = accentColor(item.toneName);
      ctx.font = "900 12px Inter, Arial, sans-serif";
      ctx.fillText(item.label.toUpperCase(), 1046, y);
      fitText(shortCanvas(item.text, 48), 1220, y, 560, { font: "900 15px Inter, Arial, sans-serif", color: "#ffffff", min: 11 });
    });

    drawPanel(90, 760, 1740, 134, "cyan", 0.46);
    fitText("Bilan coaching", 126, 818, 360, { font: "900 30px Inter, Arial, sans-serif", color: "#ffffff", min: 20 });
    fitText(shortCanvas(coachingContent.trim() || "Aucun bilan global renseigné.", 160), 126, 858, 1640, { font: "800 18px Inter, Arial, sans-serif", color: "#dff8ff", min: 12 });
    ctx.fillStyle = "#67e8f9";
    ctx.font = "800 17px Inter, Arial, sans-serif";
    ctx.fillText(`Généré par NXT5 · ${new Date().toLocaleString("fr-FR")}`, 72, H - 42);
    ctx.textAlign = "right";
    ctx.fillStyle = "#dff8ff";
    ctx.font = "900 22px Arial Black, Impact, Arial, sans-serif";
    ctx.fillText("DRAFT · STRATEGIZE · WIN", W - 72, H - 42);
    ctx.textAlign = "left";
    const link = document.createElement("a");
    link.download = `nxt5-profil-${String(selectedPlayer.name || "joueur").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    pushToast?.({ type: "cyan", title: "PNG exporté", text: "Le résumé du profil a été téléchargé." });
  }
  const buildRowsCount = rows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length).length;
  const buildRows = sortedProfileRows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length);
  const profileViews = [
    ["overview", "Synthèse", Activity, `${games}G`],
    ["champions", "Champions", Crown, `${championStats.length}/${buildRowsCount}`],
    ["pool", "Pool", Shield, championPool.length],
    ["history", "Historique", FileText, rows.length],
    ["coaching", "Coaching", Clipboard, coachingContent.trim() ? "OK" : "—"],
  ];
  if (!selectedPlayer) return <Surface glow><EmptyState icon={Activity} title="Profil introuvable" text="Lie ton compte à un profil joueur dans Gestion équipe pour alimenter cette page." /></Surface>;
  return <div className="nxt5-data-dense min-w-0 overflow-hidden">
    <PageHeader eyebrow="Player Lab" title="Mon profil" subtitle={"Diagnostic coach complet, axes de travail et d\u00e9tails exploitables sans perdre le fil de la review."} />
    <Surface className="relative overflow-hidden p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,.16),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(217,70,239,.13),transparent_34%)]" />
      <div className="relative z-10 mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] lg:items-end">
          <div className="min-w-0"><SelectInput label={"Profil observ\u00e9"} value={selectedPlayer.id} onChange={selectProfile}>{sortPlayersByRole(players).map((player) => <option key={player.id} value={player.id}>{roleLabel(player.role)}{" \u00b7 "}{player.name}</option>)}</SelectInput></div>
          {matchCategories.length > 0 && <div className="min-w-0 rounded-2xl border border-cyan-300/14 bg-black/20 p-2.5"><CategoryFilter categories={matchCategories} selectedCategoryId={selectedCategoryId} onSelect={(categoryId) => setSelectedCategoryId(categoryId)} label="Filtrer" /></div>}
        </div>
        <Button type="button" variant="ghost" icon={Download} onClick={exportProfilePng} className="shrink-0 justify-center 2xl:w-auto">{"Exporter le r\u00e9sum\u00e9 PNG"}</Button>
      </div>
      <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">{roleLabel(selectedPlayer.role)}</Badge>{selectedPlayer.user_id === user?.id && <Badge tone="orange">Moi</Badge>}<Badge tone={games ? "green" : "slate"}>{games} game{games > 1 ? "s" : ""}</Badge>{activeProfileCategory && <Badge tone={matchCategoryTone(activeProfileCategory)}>{activeProfileCategory.name}</Badge>}</div><h2 className="mt-4 break-words text-4xl font-black leading-tight text-white md:text-5xl">{selectedPlayer.name}</h2><p className="mt-2 break-words text-sm font-semibold text-slate-300">{selectedPlayer.riot_id || "Riot ID non lié"}</p></div>
        <div className="grid w-full gap-2 sm:grid-cols-2 2xl:grid-cols-4 2xl:w-auto 2xl:min-w-[560px]"><ProfileHudMetric icon={Trophy} label="WR" value={`${Math.round((wins / Math.max(1, games)) * 100)}%`} detail={`${wins}W - ${losses}L`} tone={wins >= losses ? "green" : "orange"} /><ProfileHudMetric icon={Swords} label="KDA" value={kda} detail={`${avg("kills")}/${avg("deaths")}/${avg("assists")} moy.`} tone="cyan" /><ProfileHudMetric icon={Flame} label="Dégâts" value={formatPoints(sum("damage") / Math.max(1, games))} detail="Moyenne/game" tone="purple" /><ProfileHudMetric icon={Eye} label="Vision" value={Math.round(sum("vision") / Math.max(1, games))} detail="Moyenne/game" tone="orange" /></div>
      </div>
    </Surface>
    <div className="mt-5 rounded-[1.45rem] border border-cyan-300/14 bg-black/22 p-2 shadow-[0_0_34px_rgba(34,211,238,.08)]">
      <div className="nxt5-responsive-nav-grid grid gap-2">{profileViews.map(([id, label, Icon, count]) => { const active = profileView === id; return <button key={id} type="button" onClick={() => openProfileView(id)} className={cx("group grid min-h-[5.1rem] min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5", active ? "border-cyan-300/38 bg-cyan-400/12 text-white shadow-[0_0_24px_rgba(34,211,238,.14)]" : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/20 hover:bg-white/[0.065]")}><span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", active ? "border-cyan-200/35 bg-cyan-300/14 text-cyan-100" : "border-white/10 bg-black/22 text-slate-400")}><Icon className="h-5 w-5" /></span><span className="min-w-0 self-center"><span className="block break-words text-sm font-black leading-5">{label}</span><span className="mt-0.5 block break-words text-[0.62rem] font-black uppercase leading-4 tracking-[0.14em] text-slate-400">{active ? "Ouvert" : "Cliquer"}</span></span><span className="justify-self-end"><Badge tone={active ? "cyan" : "slate"}>{count}</Badge></span></button>; })}</div>
    </div>
    <AnimatePresence mode="wait">
      <motion.div key={profileView} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-5">
        {profileView === "overview" && <CoachDiagnosticPanel player={selectedPlayer} games={games} wins={wins} losses={losses} verdict={coachVerdict} summary={coachSummary} issues={coachIssues} strengths={coachStrengths} actions={coachActions} pillars={coachPillars} comparisons={coachComparisons} decisions={coachDecisions} evidenceRows={reviewRows} />}
        {profileView === "champions" && <ProfileChampionsView championStats={championStats} selectedChampion={activeProfileChampion} onSelectChampion={setSelectedProfileChampion} selectedPlayer={selectedPlayer} matchups={matchups} bestMatchups={bestMatchups} worstMatchups={worstMatchups} buildRows={buildRows} buildRowsCount={buildRowsCount} selectedCategoryId={selectedCategoryId} />}
        {profileView === "pool" && <ProfileChampionPoolView championPool={championPool} championStats={championStats} selectedPlayer={selectedPlayer} />}
        {profileView === "history" && <ProfileHistoryView rows={rows} selectedCategoryId={selectedCategoryId} navigate={navigate} />}
        {profileView === "coaching" && <ProfileFold title="Bilan coaching global" badge="Staff notes" icon={Clipboard} toneName="cyan"><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.35fr)]"><div className="min-w-0"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Notes globales du joueur</span><textarea value={coachingContent} onChange={(event) => setCoachingContent(event.target.value.slice(0, 4000))} readOnly={!canEditCoaching} rows={14} placeholder={canEditCoaching ? "Bilan global, axes de travail, suivi hors game, remarques staff..." : "Aucun bilan coaching renseigné pour ce profil."} className={cx("w-full resize-y rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-slate-300", canEditCoaching ? "border-cyan-300/18 bg-black/[0.24] focus:border-cyan-300/45" : "border-white/10 bg-black/[0.18] text-slate-200")}/></label><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold text-slate-300">{coachingContent.length}/4000 caractères</p>{canEditCoaching && <Button type="button" icon={savingCoaching ? Loader2 : Check} disabled={savingCoaching || coachingContent.length > 4000} onClick={saveCoachingNote}>{savingCoaching ? "Enregistrement..." : "Enregistrer le bilan"}</Button>}</div></div><div className="rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.055] p-4"><Badge tone={canEditCoaching ? "green" : "slate"}>{canEditCoaching ? "Édition staff" : "Lecture seule"}</Badge><h4 className="mt-4 text-xl font-black text-white">Suivi global</h4><p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Cet espace sert au bilan longue durée du joueur. Il reste indépendant des reviews liees aux games pour éviter de mélanger review ponctuelle et suivi global.</p><div className="mt-4 rounded-xl border border-white/10 bg-black/24 p-3 text-xs font-semibold leading-5 text-slate-300">Dernière mise à jour : {coachingNote?.updated_at ? new Date(coachingNote.updated_at).toLocaleString("fr-FR") : "jamais"}{coachingNote?.updated_by_name ? ` · ${coachingNote.updated_by_name}` : ""}</div></div></div></ProfileFold>}
      </motion.div>
    </AnimatePresence>
  </div>;
}

function MatchupPanel({ title, items, toneName }) {
  return <Surface><div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-black text-white">{title}</h3><Badge tone={toneName}>{items.length}</Badge></div><div className="mt-4 grid gap-2">{items.length ? items.map((item) => <div key={item.champion} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"><ChampionPortrait champion={item.champion} alt={item.champion} className="h-12 w-12 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-black text-white">vs {championDisplayName(item.champion)}</p><p className="truncate text-xs font-semibold text-slate-300">{item.games} game{item.games > 1 ? "s" : ""} · {item.winrate}% WR · KDA {item.kda}</p></div><Badge tone={item.winrate >= 50 ? "green" : "red"}>{item.wins}W</Badge></div>) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Pas encore assez de games pour afficher ce bloc.</p>}</div></Surface>;
}

function CoachDiagnosticPanel({ player, games, wins, losses, verdict, summary, issues, strengths, actions, pillars, comparisons, decisions, evidenceRows }) {
  const mainTone = issues.length ? issues[0].toneName : strengths[0]?.toneName || "cyan";
  const readableItems = (issues.length ? issues : strengths).slice(0, 3);
  const referenceMetrics = [...pillars.slice(0, 4), ...comparisons.slice(0, 2)];
  return <Surface className="p-5 md:p-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={mainTone}>Diagnostic coach</Badge><Badge tone="slate">{games} game{games > 1 ? "s" : ""}</Badge><Badge tone={wins >= losses ? "green" : "orange"}>{wins}W - {losses}L</Badge></div>
        <h3 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-white md:text-4xl">{verdict}</h3>
        <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-200">{summary}</p>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-4 border-y border-white/10 py-3 text-center sm:min-w-[340px] xl:border-y-0 xl:border-l xl:py-0 xl:pl-5">
        <div><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Games</p><p className="mt-1 text-xl font-black text-white">{games}</p></div>
        <div><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Winrate</p><p className="mt-1 text-xl font-black text-white">{Math.round((wins / Math.max(1, games)) * 100)}%</p></div>
        <div><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Lecture</p><p className="mt-1 truncate text-sm font-black text-white">{issues.length ? "À corriger" : "Stable"}</p></div>
      </div>
    </div>
    <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(290px,.38fr)]">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Lecture prioritaire</p>
          <span className="text-xs font-bold text-slate-400">Détails dans les onglets dédiés</span>
        </div>
        <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
          {readableItems.length ? readableItems.map((item) => {
            const Icon = item.icon || Activity;
            return <div key={item.title} className="flex gap-3 py-4">
              <span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", tone(item.toneName))}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="font-black text-white">{item.title}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{item.text}</p>{item.action && <p className="mt-2 rounded-xl border border-cyan-300/12 bg-cyan-400/[0.055] px-3 py-2 text-xs font-black leading-5 text-cyan-50">{item.action}</p>}</div>
            </div>;
          }) : <p className="py-4 text-sm font-semibold text-slate-300">Importe plus de games pour produire une lecture fiable.</p>}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {decisions.map((item) => <div key={item.label} className={cx("min-w-0 border-l-2 pl-3", item.toneName === "green" ? "border-emerald-300/60" : item.toneName === "red" ? "border-rose-300/60" : item.toneName === "orange" ? "border-amber-300/60" : item.toneName === "purple" ? "border-fuchsia-300/60" : "border-cyan-300/60")}>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
            <p className="mt-1 break-words text-sm font-black leading-5 text-white">{item.text}</p>
          </div>)}
        </div>
      </div>
      <aside className="min-w-0 xl:border-l xl:border-white/10 xl:pl-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Plan coach</p><p className="mt-1 text-sm font-semibold text-slate-400">{player?.name || "Profil"} · prochaines reviews</p></div><Target className="h-5 w-5 text-cyan-100" /></div>
        <ol className="mt-4 space-y-3">{actions.map((action, index) => <li key={`${action}-${index}`} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 text-[0.62rem] font-black text-cyan-50">{index + 1}</span>
          <p className="text-sm font-semibold leading-6 text-slate-100">{action}</p>
        </li>)}</ol>
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Preuves</p><Badge tone={evidenceRows.length ? "cyan" : "slate"}>{evidenceRows.length}</Badge></div>
          <div className="mt-2 divide-y divide-white/10">{evidenceRows.length ? evidenceRows.slice(0, 4).map((row, index) => <button key={`${row.match?.id || index}-coach-proof`} type="button" onClick={() => openAppPath(`/statistiques?match=${row.match?.id || ""}`)} className="flex w-full min-w-0 items-center justify-between gap-3 py-3 text-left transition hover:text-cyan-100"><span className="min-w-0"><span className="block truncate text-xs font-black text-white">{matchDisplayName(row.match, "Game")}</span><span className="mt-0.5 block truncate text-[0.62rem] font-semibold text-slate-400">{championDisplayName(row.champion)} · {row.kills || 0}/{row.deaths || 0}/{row.assists || 0} · KP {Math.round(parsePercent(row.kill_participation || row.kp || 0))}%</span></span><ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" /></button>) : <p className="py-3 text-xs font-semibold leading-5 text-slate-400">Aucune game critique isolée pour ce profil.</p>}</div>
        </div>
      </aside>
    </div>
    <div className="mt-6 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Repères utiles</p></div>
      <div className="mt-3 grid gap-x-6 gap-y-2 lg:grid-cols-2">{referenceMetrics.map((item) => <CoachReferenceMetric key={item.label} item={item} />)}</div>
    </div>
  </Surface>;
}

function CoachReferenceMetric({ item }) {
  return <div className="grid min-w-0 grid-cols-[minmax(92px,.7fr)_minmax(70px,.35fr)_minmax(0,1fr)] items-center gap-3 border-b border-white/8 py-2">
    <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
    <p className="truncate text-sm font-black text-white">{item.value}</p>
    <p className="truncate text-xs font-semibold text-slate-400">{item.detail}</p>
  </div>;
}

function ProfileChampionsView({ championStats = [], selectedChampion, onSelectChampion, selectedPlayer, matchups = [], bestMatchups = [], worstMatchups = [], buildRows = [], buildRowsCount = 0, selectedCategoryId }) {
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState("decision");
  const [sortMode, setSortMode] = useState("coach");
  const totalGames = championStats.reduce((total, stat) => total + Number(stat.games || 0), 0);
  const enhancedStats = championStats.map((stat) => {
    const safeGames = Math.max(1, Number(stat.games || 0));
    const buildCount = (stat.rows || []).filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length).length;
    const matchupCount = Array.from((stat.rows || []).reduce((map, row) => {
      const enemy = opponentRoleRow(row.match, row.role || selectedPlayer?.role, row.raw?.participantId || row.participantId);
      if (enemy?.champion) map.set(enemy.champion, true);
      return map;
    }, new Map()).keys()).length;
    const avgDamage = Number(stat.damage || 0) / safeGames;
    const avgVision = Number(stat.vision || 0) / safeGames;
    const avgKp = Number(stat.kp || 0) / safeGames;
    const share = Math.round((Number(stat.games || 0) / Math.max(1, totalGames)) * 100);
    const score = Math.round((Number(stat.winrate || 0) * 0.9) + (Number(stat.kda || 0) * 9) + (Math.min(5, Number(stat.games || 0)) * 7) + Math.min(18, buildCount * 4) + Math.min(12, matchupCount * 2));
    const risk = Number(stat.games || 0) <= 1 ? "sample" : Number(stat.winrate || 0) < 45 ? "wr" : Number(stat.kda || 0) < 2 ? "kda" : share >= 60 ? "overfocus" : "";
    const status = Number(stat.games || 0) >= 2 && Number(stat.winrate || 0) >= 55 ? "lock" : Number(stat.games || 0) >= 2 && Number(stat.winrate || 0) >= 48 ? "playable" : risk ? "review" : "test";
    return { ...stat, buildCount, matchupCount, avgDamage, avgVision, avgKp, share, score, risk, status };
  });
  const activeStat = enhancedStats.find((stat) => stat.champion === selectedChampion) || enhancedStats[0] || null;
  const activeRows = activeStat?.rows || [];
  const sortedStats = enhancedStats
    .filter((stat) => championDisplayName(stat.champion).toLowerCase().includes(query.trim().toLowerCase()))
    .filter((stat) => lens === "decision" || (lens === "ready" ? ["lock", "playable"].includes(stat.status) : lens === "review" ? stat.status === "review" : stat.buildCount > 0))
    .sort((a, b) => {
      if (sortMode === "wr") return b.winrate - a.winrate || b.games - a.games;
      if (sortMode === "volume") return b.games - a.games || b.score - a.score;
      if (sortMode === "damage") return b.avgDamage - a.avgDamage || b.score - a.score;
      return b.score - a.score || b.games - a.games;
    });
  const bestPick = enhancedStats.slice().sort((a, b) => b.score - a.score || b.games - a.games)[0];
  const safestPick = enhancedStats.filter((stat) => stat.games >= 2).sort((a, b) => b.winrate - a.winrate || Number(b.kda || 0) - Number(a.kda || 0))[0] || bestPick;
  const urgentPick = enhancedStats.filter((stat) => stat.games >= 1).sort((a, b) => (a.winrate + Number(a.kda || 0) * 8) - (b.winrate + Number(b.kda || 0) * 8))[0];
  const topShare = bestPick ? bestPick.share : 0;
  const buildCoverage = totalGames ? Math.round((buildRowsCount / Math.max(1, totalGames)) * 100) : 0;
  const nextActions = [
    bestPick && { title: "Premier choix", text: `${championDisplayName(bestPick.champion)} sort le meilleur mix volume, WR, KDA et builds.`, toneName: "green", icon: ShieldCheck, champion: bestPick.champion },
    urgentPick && { title: "A verifier", text: `${championDisplayName(urgentPick.champion)} demande une review avant de le remettre en draft.`, toneName: "orange", icon: AlertTriangle, champion: urgentPick.champion },
    buildCoverage < 65 && { title: "Builds incomplets", text: "Priorite: importer ou relire les games sans build pour rendre la lecture fiable.", toneName: "purple", icon: Gauge },
  ].filter(Boolean).slice(0, 3);
  const lensOptions = [["decision", "Decision"], ["ready", "Jouables"], ["review", "A revoir"], ["builds", "Builds"]];
  const sortOptions = [["coach", "Coach"], ["volume", "Volume"], ["wr", "WR"], ["damage", "DMG"]];
  if (!championStats.length) return <Surface glow className="p-6"><EmptyState icon={Crown} title="Aucun champion importe" text={selectedCategoryId ? "Aucune game de cette categorie pour ce profil." : "Importe une game pour alimenter les champions joues."} /></Surface>;
  return <div className="space-y-5">
    <Surface className="relative overflow-hidden p-0">
      {bestPick?.champion && <ChampionBackdrop champion={bestPick.champion} focus="face" />}
      <div className="relative z-10 grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.36fr)]">
        <div className="min-w-0 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">Champion cockpit</Badge><Badge tone="slate">{roleLabel(selectedPlayer?.role)}</Badge><Badge tone={selectedCategoryId ? "purple" : "green"}>{selectedCategoryId ? "Filtre actif" : "Toutes les games"}</Badge></div>
          <h3 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">{bestPick ? `Pick de reference: ${championDisplayName(bestPick.champion)}` : "Champion cockpit"}</h3>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-200">La page commence par la decision, puis donne les preuves. Tu dois pouvoir choisir un pick, comprendre le risque et ouvrir la review sans fouiller.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ProfileChampionSignal icon={Crown} label="Pool joue" value={enhancedStats.length} detail={`${totalGames} games`} toneName={enhancedStats.length >= 4 ? "green" : "yellow"} />
            <ProfileChampionSignal icon={Target} label="Dependance" value={bestPick ? `${topShare}%` : "-"} detail={bestPick ? championDisplayName(bestPick.champion) : "Aucun pick"} toneName={topShare >= 60 ? "orange" : "cyan"} />
            <ProfileChampionSignal icon={Swords} label="Duels" value={matchups.length} detail="matchups reconnus" toneName={matchups.length ? "purple" : "slate"} />
            <ProfileChampionSignal icon={Gauge} label="Builds" value={`${buildCoverage}%`} detail={`${buildRowsCount}/${totalGames || 0} games`} toneName={buildCoverage >= 70 ? "green" : buildRowsCount ? "yellow" : "slate"} />
          </div>
        </div>
        <aside className="border-t border-white/10 bg-black/32 p-5 xl:border-l xl:border-t-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Plan d'action</p>
          <div className="mt-4 space-y-3">{nextActions.map((item) => <ProfileChampionAction key={item.title} item={item} onSelect={item.champion ? () => onSelectChampion(item.champion) : undefined} />)}</div>
        </aside>
      </div>
    </Surface>

    <div className="grid gap-5 2xl:grid-cols-[minmax(300px,.28fr)_minmax(0,.72fr)]">
      <Surface className="min-w-0 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><Badge tone="cyan">{sortedStats.length}/{enhancedStats.length} visibles</Badge><h4 className="mt-3 text-xl font-black text-white">Board champions</h4><p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Filtre par intention, pas par tableur.</p></div>
          <Search className="h-5 w-5 shrink-0 text-cyan-100" />
        </div>
        <label className="mt-4 flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/24 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-cyan-100" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un champion" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-400" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">{lensOptions.map(([id, label]) => <button key={id} type="button" onClick={() => setLens(id)} className={cx("rounded-xl border px-3 py-2 text-xs font-black transition", lens === id ? "border-cyan-200/50 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.065] hover:text-white")}>{label}</button>)}</div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">{sortOptions.map(([id, label]) => <button key={id} type="button" onClick={() => setSortMode(id)} className={cx("rounded-xl px-2 py-2 text-[0.62rem] font-black transition", sortMode === id ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/[0.055] hover:text-white")}>{label}</button>)}</div>
        <div className="mt-4 grid max-h-[64rem] gap-2 overflow-auto pr-1 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))] 2xl:grid-cols-1">
          {sortedStats.length ? sortedStats.map((stat) => <ProfileChampionCommandCard key={stat.champion} stat={stat} active={activeStat?.champion === stat.champion} onClick={() => onSelectChampion(stat.champion)} />) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucun champion ne correspond a cette lecture.</p>}
        </div>
      </Surface>

      <div className="min-w-0 space-y-5">
        <Surface className="min-w-0 overflow-hidden p-4 md:p-5">
          {activeStat ? <ChampionProfileDetail stat={activeStat} rows={activeRows} /> : <EmptyState icon={Crown} title="Selection vide" text="Choisis un champion pour ouvrir son analyse." />}
        </Surface>
        <ProfileChampionDecisionCard stat={activeStat} safestPick={safestPick} urgentPick={urgentPick} />
      </div>
    </div>

  </div>;
}

function ProfileChampionSignal({ icon: Icon = Activity, label, value, detail, toneName = "cyan" }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-3">
    <div className="flex items-center justify-between gap-3"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", tone(toneName))}><Icon className="h-4 w-4" /></span></div>
    <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    <p className="mt-1 truncate text-xs font-semibold text-slate-300">{detail}</p>
  </div>;
}

function ProfileChampionAction({ item, onSelect }) {
  const Icon = item.icon || Activity;
  const content = <><span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", tone(item.toneName))}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-white">{item.title}</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-300">{item.text}</span></span>{onSelect && <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" />}</>;
  return onSelect ? <button type="button" onClick={onSelect} className="flex w-full gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.06]">{content}</button> : <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">{content}</div>;
}

function profileChampionStatusMeta(status) {
  return {
    lock: { label: "Lock", toneName: "green", text: "Pret a draft" },
    playable: { label: "Jouable", toneName: "cyan", text: "Bon signal" },
    review: { label: "Review", toneName: "orange", text: "Risque visible" },
    test: { label: "Test", toneName: "purple", text: "A confirmer" },
  }[status] || { label: "Data", toneName: "slate", text: "A lire" };
}

function ProfileChampionCommandCard({ stat, active, onClick }) {
  const meta = profileChampionStatusMeta(stat.status);
  return <button type="button" onClick={onClick} className={cx("group min-w-0 overflow-hidden rounded-2xl border p-3 text-left transition hover:border-cyan-200/35 hover:bg-white/[0.055]", active ? "border-cyan-200/65 bg-cyan-400/12 shadow-[0_0_24px_rgba(34,211,238,.13)]" : "border-white/10 bg-black/24")}>
    <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
      <ChampionPortrait champion={stat.champion} alt={stat.champion} className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 object-cover" />
      <div className="min-w-0">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2"><p className="min-w-0 truncate font-black text-white">{championDisplayName(stat.champion)}</p><span className="min-w-0 shrink-0"><Badge tone={meta.toneName}>{meta.label}</Badge></span></div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-300">{meta.text} - score {stat.score}</p>
        <div className="mt-3 grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(3.8rem,1fr))]">
          <ProfileChampionMini label="G" value={stat.games} />
          <ProfileChampionMini label="WR" value={`${stat.winrate}%`} toneName={stat.winrate >= 50 ? "green" : "red"} />
          <ProfileChampionMini label="KDA" value={stat.kda} />
          <ProfileChampionMini label="DMG" value={formatPoints(stat.avgDamage)} />
        </div>
      </div>
    </div>
    <div className="mt-3 flex min-w-0 flex-wrap gap-1.5"><Badge tone="slate">{stat.share}% volume</Badge><Badge tone={stat.buildCount ? "purple" : "slate"}>{stat.buildCount} build{stat.buildCount > 1 ? "s" : ""}</Badge><Badge tone={stat.matchupCount ? "cyan" : "slate"}>{stat.matchupCount} duel{stat.matchupCount > 1 ? "s" : ""}</Badge></div>
  </button>;
}

function ProfileChampionMini({ label, value, toneName = "cyan" }) {
  return <span className="min-w-0 rounded-xl border border-white/10 bg-black/24 px-2 py-1.5"><span className="block truncate text-[0.52rem] font-black uppercase tracking-[0.06em] text-slate-400">{label}</span><span className={cx("mt-0.5 block min-w-0 truncate text-xs font-black", toneName === "green" ? "text-emerald-100" : toneName === "red" ? "text-rose-100" : "text-white")}>{value}</span></span>;
}

function ProfileChampionDecisionCard({ stat, safestPick, urgentPick }) {
  if (!stat) return <Surface className="p-4"><EmptyState icon={Crown} title="Aucun pick" text="Selectionne un champion." /></Surface>;
  const meta = profileChampionStatusMeta(stat.status);
  const recommendations = [
    { label: "Decision", value: stat.status === "lock" ? "Draftable" : stat.status === "playable" ? "Possible" : stat.status === "review" ? "Review first" : "A tester", toneName: meta.toneName },
    { label: "Risque", value: stat.risk === "overfocus" ? "Pool trop centre" : stat.risk === "sample" ? "Sample faible" : stat.risk === "wr" ? "WR bas" : stat.risk === "kda" ? "KDA bas" : "Controle", toneName: stat.risk ? "orange" : "green" },
    { label: "Alternative sure", value: safestPick ? championDisplayName(safestPick.champion) : "-", toneName: "cyan" },
    { label: "Pick critique", value: urgentPick ? championDisplayName(urgentPick.champion) : "-", toneName: "red" },
  ];
  return <Surface glow className="min-w-0 p-4 md:p-5">
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,.34fr)_minmax(0,.66fr)] xl:items-start">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3"><Badge tone={meta.toneName}>{meta.label}</Badge><Target className="h-5 w-5 text-cyan-100" /></div>
        <h4 className="mt-4 text-2xl font-black text-white">Decision rapide</h4>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{championDisplayName(stat.champion)} est classe selon volume, WR, KDA, builds et lecture lane. Le but est de savoir si tu le drafts maintenant ou si tu l'ouvres en review.</p>
      </div>
    <div className="divide-y divide-white/10 border-y border-white/10">
      {recommendations.map((item) => <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_minmax(92px,.42fr)] items-center gap-3 py-3"><p className="truncate text-xs font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p><p className={cx("truncate text-right text-sm font-black", item.toneName === "green" ? "text-emerald-100" : item.toneName === "red" ? "text-rose-100" : item.toneName === "orange" ? "text-amber-100" : "text-cyan-100")}>{item.value}</p></div>)}
    </div>
    </div>
  </Surface>;
}

function ProfileChampionPoolView({ championPool = [], championStats = [], selectedPlayer }) {
  const tierOrder = Object.fromEntries(CHAMPION_TIERS.map((tier, index) => [tier.id, index]));
  const statsByChampion = championStats.reduce((map, stat) => {
    map.set(championAssetId(stat.champion), stat);
    map.set(championKey(stat.champion), stat);
    return map;
  }, new Map());
  const getChampionStat = (row) => statsByChampion.get(championAssetId(row.champion)) || statsByChampion.get(championKey(row.champion));
  const orderedRows = championPool.slice().sort((a, b) => (tierOrder[championPoolStatus(a)] ?? 9) - (tierOrder[championPoolStatus(b)] ?? 9) || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
  const rowsByTier = CHAMPION_TIERS.reduce((map, tier) => ({ ...map, [tier.id]: [] }), {});
  orderedRows.forEach((row) => rowsByTier[championPoolStatus(row)].push(row));
  const total = orderedRows.length;
  const readyCount = (rowsByTier.lock.length || 0) + (rowsByTier.pocket.length || 0);
  const workCount = (rowsByTier.work.length || 0) + (rowsByTier.danger.length || 0);
  const importedCount = orderedRows.filter((row) => getChampionStat(row)).length;
  const leadingTier = CHAMPION_TIERS.slice().sort((a, b) => (rowsByTier[b.id]?.length || 0) - (rowsByTier[a.id]?.length || 0))[0];
  const spotlightRow = rowsByTier.lock[0] || rowsByTier.pocket[0] || orderedRows[0];
  const readiness = !total ? "Pool à remplir" : readyCount >= Math.max(2, Math.ceil(total * 0.55)) ? "Pool prêt" : "Pool à consolider";
  const readinessTone = !total ? "slate" : readyCount >= Math.max(2, Math.ceil(total * 0.55)) ? "green" : "yellow";
  return <div className="space-y-5">
    <Surface className="relative overflow-hidden p-5 md:p-6">
      {spotlightRow?.champion && <ChampionBackdrop champion={spotlightRow.champion} focus="face" />}
      <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.44fr)] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="green">Pool dédié</Badge><Badge tone={readinessTone}>{readiness}</Badge><Badge tone="slate">{roleLabel(selectedPlayer?.role)}</Badge></div>
          <h3 className="mt-4 text-3xl font-black leading-tight text-white md:text-4xl">Pool de {selectedPlayer?.name || "joueur"}</h3>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-200">Lecture séparée des champions déclarés, classés par catégories de pool. L’objectif est de savoir vite ce qui est fiable, situationnel, en validation ou encore en training.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ProfileHudMetric icon={ShieldCheck} label="Confiance" value={rowsByTier.lock.length} detail="Picks fiables" tone="green" />
          <ProfileHudMetric icon={Flame} label="Situationnels" value={rowsByTier.pocket.length} detail="Options de contexte" tone="orange" />
          <ProfileHudMetric icon={Gauge} label="À valider" value={workCount} detail="Validation + training" tone="cyan" />
          <ProfileHudMetric icon={Activity} label="Importés" value={`${importedCount}/${total || 0}`} detail="Avec stats de games" tone="purple" />
        </div>
      </div>
    </Surface>

    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {CHAMPION_TIERS.map((tier) => {
        const rows = rowsByTier[tier.id] || [];
        return <div key={tier.id} className={cx("relative overflow-hidden rounded-2xl border p-4", championTierFrame(tier, rows.length > 0))}>
          <div className={cx("pointer-events-none absolute inset-0 bg-gradient-to-br", championTierColumnGlow(tier))} />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] opacity-75">Catégorie de pool</p>
              <p className="mt-1 text-xl font-black text-white">{tier.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-200">{tier.hint}</p>
            </div>
            <ChampionTierMark tier={tier} active={rows.length > 0} />
          </div>
          <div className="relative z-10 mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
            <span className="text-3xl font-black text-white">{rows.length}</span>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">{total ? Math.round((rows.length / total) * 100) : 0}% du pool</span>
          </div>
        </div>;
      })}
    </div>

    {total ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.36fr)]">
      <div className="grid gap-4 2xl:grid-cols-2">
        {CHAMPION_TIERS.map((tier) => {
          const tierRows = rowsByTier[tier.id] || [];
          return <section key={tier.id} className={cx("relative min-w-0 overflow-hidden rounded-[1.35rem] border p-4", championTierColumnFrame(tier))}>
            <div className={cx("pointer-events-none absolute inset-0 bg-gradient-to-br", championTierColumnGlow(tier))} />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">{tier.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-200">{tier.hint}</p>
              </div>
              <Badge tone={tier.tone}>{tierRows.length}</Badge>
            </div>
            <div className="relative z-10 mt-4 grid gap-2">
              {tierRows.length ? tierRows.map((row, index) => <ProfilePoolChampionRow key={`${row.id || row.champion}-${index}`} row={row} stat={getChampionStat(row)} selectedPlayer={selectedPlayer} />) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucun champion dans ce tier.</p>}
            </div>
          </section>;
        })}
      </div>
      <aside className="space-y-4">
        <div className="rounded-[1.35rem] border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
          <div className="flex items-center justify-between gap-3"><Badge tone={readinessTone}>{readiness}</Badge><Target className="h-5 w-5 text-cyan-100" /></div>
          <h4 className="mt-4 text-xl font-black text-white">Lecture draft</h4>
          <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
            <ProfilePoolReadLine label="Prêts à sortir" value={readyCount} detail="Confiance + situationnels" toneName={readyCount ? "green" : "slate"} />
            <ProfilePoolReadLine label="À travailler" value={workCount} detail="Validation + training" toneName={workCount ? "yellow" : "green"} />
            <ProfilePoolReadLine label="Catégorie dominante" value={leadingTier?.title || "-"} detail={`${rowsByTier[leadingTier?.id]?.length || 0} champion${(rowsByTier[leadingTier?.id]?.length || 0) > 1 ? "s" : ""}`} toneName={leadingTier?.tone || "slate"} />
          </div>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-black/24 p-4">
          <div className="flex items-center justify-between gap-3"><Badge tone="cyan">Guide catégories</Badge><BookOpen className="h-5 w-5 text-cyan-100" /></div>
          <div className="mt-4 space-y-3">
            {CHAMPION_TIERS.map((tier) => <div key={tier.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <ChampionTierMark tier={tier} active className="h-8 w-8 rounded-xl [&_svg]:h-4 [&_svg]:w-4" />
              <div className="min-w-0"><p className="text-sm font-black text-white">{tier.title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{tier.hint}</p></div>
            </div>)}
          </div>
        </div>
      </aside>
    </div> : <Surface glow className="p-6"><EmptyState icon={Shield} title="Pool non renseigné" text="Ajoute des champions dans Champion Pool pour afficher les catégories de ce profil." /></Surface>}
  </div>;
}

function ProfilePoolReadLine({ label, value, detail, toneName = "cyan" }) {
  return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(70px,.35fr)] items-center gap-3 py-3">
    <div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-semibold text-slate-300">{detail}</p></div>
    <p className={cx("truncate text-right text-sm font-black", toneName === "green" ? "text-emerald-100" : toneName === "yellow" ? "text-amber-100" : toneName === "red" ? "text-rose-100" : "text-cyan-100")}>{value}</p>
  </div>;
}

function ProfilePoolChampionRow({ row, stat, selectedPlayer }) {
  const status = championPoolStatus(row);
  const tier = championTierByStatus(status);
  const tags = championStyleTags(row.champion).slice(0, 2);
  const note = String(row.verdict || row.notes || row.note || "").trim();
  const sourceLabel = ["manual", "riot_manual"].includes(String(row.source || "")) ? "Déclaré" : "Pool";
  const games = Number(stat?.games ?? row.games ?? 0);
  const winrate = stat ? stat.winrate : games ? Math.round((Number(row.wins || 0) / Math.max(1, games)) * 100) : null;
  const kda = stat?.kda || (games ? Number(row.kda || 0).toFixed(1) : "");
  const statTone = !games ? "slate" : winrate >= 55 ? "green" : winrate >= 45 ? "yellow" : "red";
  return <div className="group min-w-0 rounded-2xl border border-white/10 bg-black/26 p-3 transition hover:border-cyan-300/25 hover:bg-white/[0.045]">
    <div className="flex min-w-0 gap-3">
      <span className="inline-flex h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-black text-white">{championDisplayName(row.champion)}</p>
          <Badge tone={championPoolStatusTone(status)}>{championPoolStatusLabel(status)}</Badge>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-300">{roleLabel(row.role || selectedPlayer?.role)} · {sourceLabel}</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <Badge tone={statTone}>{games ? `${games}G${winrate !== null ? ` · ${winrate}% WR` : ""}${kda ? ` · KDA ${kda}` : ""}` : "Pas encore importé"}</Badge>
      {tags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}
    </div>
    <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-300">{note || tier.hint}</p>
  </div>;
}

function ChampionProfileDetail({ stat, rows }) {
  const safeGames = Math.max(1, stat.games || rows.length || 0);
  const avg = (value, decimals = 1) => (Number(value || 0) / safeGames).toFixed(decimals);
  const sortedRows = rows.slice().sort((a, b) => String(b.match?.created_at || b.match?.game_date || b.match?.game_id || "").localeCompare(String(a.match?.created_at || a.match?.game_date || a.match?.game_id || "")));
  const bestDamageRow = rows.slice().sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0))[0];
  const csMilestones = csMilestoneSummary(rows);
  const buildRows = sortedRows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length);
  const styleTags = championStyleTags(stat.champion).slice(0, 3);
  const heroStats = [
    ["WR", `${stat.winrate}%`, `${stat.wins}W - ${Math.max(0, stat.games - stat.wins)}L`, stat.winrate >= 50 ? "text-emerald-100" : "text-amber-100"],
    ["KDA", stat.kda, `${stat.kills}/${stat.deaths}/${stat.assists} total`, "text-cyan-100"],
    ["KP", `${avg(stat.kp, 0)}%`, "moyenne", "text-fuchsia-100"],
    ["CS/min", avg(stat.csPerMin), csMilestones.samples > 0 ? `CS10/20 ${csMilestones.at10 ?? "-"} / ${csMilestones.at20 ?? "-"}` : "moyenne", "text-amber-100"],
  ];
  return <div className="space-y-4">
    <div className="rounded-2xl border border-cyan-300/14 bg-black/24 p-4">
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,.58fr)_minmax(260px,.42fr)] 2xl:items-center">
        <div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
          <ChampionPortrait champion={stat.champion} alt={stat.champion} className="h-16 w-16 shrink-0 rounded-2xl border border-cyan-200/18 object-cover sm:h-20 sm:w-20" />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap gap-2">{styleTags.map((tag) => <ChampionStylePill key={tag} tag={tag} />)}</div>
            <p className="mt-3 min-w-0 truncate text-2xl font-black leading-none text-white md:text-3xl">{championDisplayName(stat.champion)}</p>
            <p className="mt-2 max-w-full text-sm font-semibold leading-5 text-slate-300 sm:truncate">{stat.games} game{stat.games > 1 ? "s" : ""} analysée{stat.games > 1 ? "s" : ""} · {buildRows.length} build{buildRows.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-2">
          {heroStats.map(([label, value, detail, color]) => <ChampionVisualMetric key={label} label={label} value={value} detail={detail} color={color} />)}
        </div>
      </div>
    </div>

    <div className="grid min-w-0 gap-5">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/80">Repères champion</p><Badge tone="cyan">{formatPoints(stat.damage / safeGames)} DMG moy.</Badge></div>
        <div className="mt-3 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-4">
          <ChampionReferenceLine label="Vision" value={avg(stat.vision)} detail="moyenne/game" />
          <ChampionReferenceLine label="Dégâts" value={formatPoints(stat.damage / safeGames)} detail="moyenne/game" />
          {csMilestones.samples > 0 && <ChampionReferenceLine label="CS 10 / 20" value={`${csMilestones.at10 ?? "-"} / ${csMilestones.at20 ?? "-"}`} detail={`${csMilestones.samples} timeline${csMilestones.samples > 1 ? "s" : ""}`} />}
          {bestDamageRow && <ChampionReferenceLine label="Peak dégâts" value={formatPoints(bestDamageRow.damage)} detail={matchDisplayName(bestDamageRow.match, "game inconnue")} />}
        </div>
      </section>
      <ChampionLanePanel rows={sortedRows} />
    </div>

  </div>;
}

function ChampionStylePill({ tag }) {
  return <span className={cx("inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase leading-4 tracking-[0.08em] whitespace-nowrap shadow-[0_0_14px_rgba(255,255,255,.035)]", tone(championStyleTone(tag)))}>
    {tagLabel(tag)}
  </span>;
}

function ChampionVisualMetric({ label, value, detail, color }) {
  return <div className="min-w-0">
    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className={cx("mt-1 break-words text-xl font-black leading-tight sm:text-2xl", color)}>{value}</p>
    <p className="mt-1 truncate text-xs font-semibold text-slate-300">{detail}</p>
  </div>;
}

function ChampionReferenceLine({ label, value, detail }) {
  return <div className="grid min-w-0 gap-1 bg-[#07101d] p-3">
    <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
    <p className="break-words text-lg font-black text-white">{value}</p>
    <p className="break-words text-xs font-semibold text-slate-400 sm:truncate">{detail}</p>
  </div>;
}

function ChampionLanePanel({ rows }) {
  const buildRows = rows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length);
  return <section className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/80">Lecture lane</p><div className="flex flex-wrap gap-2"><Badge tone="cyan">{rows.length} game{rows.length > 1 ? "s" : ""}</Badge><Badge tone={buildRows.length ? "purple" : "slate"}>{buildRows.length} build{buildRows.length > 1 ? "s" : ""}</Badge></div></div>
    <div className="mt-3 max-h-[34rem] divide-y divide-white/10 overflow-auto border-y border-white/10 pr-1">{rows.length ? rows.map((row, index) => {
      const enemy = (row.match?.participants || []).find((item) => item.team_key === "ENEMY" && String(item.role || "").toUpperCase() === String(row.role || "").toUpperCase());
      const cs10 = csAtMinute(row, 10);
      const cs20 = csAtMinute(row, 20);
      const enemyCs10 = enemy ? csAtMinute({ ...enemy, match: row.match }, 10) : null;
      const diff10 = Number.isFinite(cs10) && Number.isFinite(enemyCs10) ? cs10 - enemyCs10 : null;
      return <ChampionLaneGameLine key={`${row.match?.id || row.match?.game_id || index}-lane`} row={row} enemy={enemy} cs10={cs10} cs20={cs20} diff10={diff10} />;
    }) : <p className="py-4 text-sm font-semibold text-slate-400">Aucune lane exploitable sur ce champion.</p>}</div>
  </section>;
}

function ChampionLaneGameLine({ row, enemy, cs10, cs20, diff10 }) {
  const finalItems = finalBuildItems(row);
  const timeline = itemBuildTimeline(row);
  return <details className="group">
    <summary className="grid cursor-pointer list-none gap-3 py-3 transition hover:bg-white/[0.025] 2xl:grid-cols-[minmax(0,1fr)_repeat(3,minmax(70px,.18fr))_auto] 2xl:items-center [&::-webkit-details-marker]:hidden">
      <div className="flex min-w-0 items-center gap-3">
        {enemy?.champion ? <ChampionPortrait champion={enemy.champion} alt={enemy.champion} className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <div className="h-10 w-10 shrink-0 rounded-xl bg-white/[0.05]" />}
        <div className="min-w-0"><p className="truncate text-sm font-black text-white">vs {enemy?.champion ? championDisplayName(enemy.champion) : "Matchup inconnu"}</p><p className="truncate text-xs font-semibold text-slate-400">{matchDisplayName(row.match, "Game")} - {row.match?.result || "Resultat ?"}</p></div>
      </div>
      <ChampionMiniStat label="CS10" value={Number.isFinite(cs10) ? cs10 : "-"} />
      <ChampionMiniStat label="CS20" value={Number.isFinite(cs20) ? cs20 : "-"} />
      <ChampionMiniStat label="Diff10" value={diff10 === null ? "-" : `${diff10 >= 0 ? "+" : ""}${diff10}`} toneName={diff10 === null ? "slate" : diff10 >= 0 ? "green" : "red"} />
      <div className="flex min-w-0 items-center justify-between gap-2 2xl:justify-end"><Badge tone={finalItems.length ? "cyan" : "slate"}>{finalItems.length ? "Build" : "Sans build"}</Badge><ChevronDown className="h-4 w-4 shrink-0 text-cyan-100 transition group-open:rotate-180" /></div>
    </summary>
    <div className="grid gap-3 border-t border-white/10 bg-white/[0.025] py-3 xl:grid-cols-[minmax(0,.36fr)_minmax(0,.64fr)]">
      <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100">Data game</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ProfileChampionMini label="KDA" value={`${row.kills || 0}/${row.deaths || 0}/${row.assists || 0}`} />
          <ProfileChampionMini label="KP" value={`${Math.round(parsePercent(row.kill_participation || row.kp || 0))}%`} />
          <ProfileChampionMini label="DMG" value={formatPoints(row.damage)} />
          <ProfileChampionMini label="Vision" value={Math.round(Number(row.vision || 0))} />
        </div>
      </div>
      <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-fuchsia-100">Build final</p><Badge tone={finalItems.length ? "cyan" : "slate"}>{finalItems.length}</Badge></div>
        {finalItems.length ? <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">{finalItems.map((item, itemIndex) => <HudIcon key={`champion-lane-final-${row.id || row.match?.id}-${itemIndex}-${item.id}`} sources={itemIconSources(item.id)} label={`${item.type === "trinket" ? "Trinket" : "Item"} ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : "cyan"} className="h-10 w-10" />)}</div> : <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs font-semibold text-slate-300">Aucun build final importe pour cette game.</p>}
        {timeline.length > 0 && <><div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-fuchsia-100">Timeline achats</p><Badge tone="purple">{timeline.length}</Badge></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{timeline.map((event, eventIndex) => <div key={`${row.id || row.match?.id}-lane-item-event-${eventIndex}-${event.timestamp}-${event.itemId}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2">
          <span className="w-12 shrink-0 rounded-lg border border-cyan-200/15 bg-cyan-400/10 px-2 py-1 text-center text-[0.62rem] font-black text-cyan-50">{event.time}</span>
          <HudIcon sources={itemIconSources(event.itemId)} label={`${event.label} ${event.itemId}`} fallback={event.itemId} emptyText="?" toneName={event.toneName} className="h-9 w-9 shrink-0" />
          <div className="min-w-0"><p className="truncate text-xs font-black text-white">{event.label}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">Item {event.itemId}{event.secondaryId ? ` -> ${event.secondaryId}` : ""}</p></div>
        </div>)}</div></>}
      </div>
    </div>
  </details>;
}

function ChampionBuildPanel({ rows }) {
  const buildRows = rows.filter((row) => itemSlots(row).some(Boolean) || itemBuildTimeline(row).length);
  return <section className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100/80">Builds et timelines</p><div className="flex flex-wrap gap-2"><Badge tone="purple">{rows.length} game{rows.length > 1 ? "s" : ""}</Badge><Badge tone={buildRows.length ? "cyan" : "slate"}>{buildRows.length} build{buildRows.length > 1 ? "s" : ""}</Badge></div></div>
    <div className="mt-3 space-y-3">{rows.length ? rows.map((row, index) => <ProfileBuildGameCard key={(row.id || row.match?.id || row.match?.game_id || "build") + "-" + index} row={row} />) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucune game sur ce champion.</p>}</div>
  </section>;
}

function ChampionMiniStat({ label, value, toneName = "cyan" }) {
  return <div className="min-w-0">
    <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className={cx("mt-1 truncate font-black", toneName === "green" ? "text-emerald-100" : toneName === "red" ? "text-rose-100" : "text-white")}>{value}</p>
  </div>;
}

function ChampionHistoryLine({ row, enemy }) {
  return <div className="grid gap-3 py-3 sm:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_minmax(120px,.42fr)_repeat(3,minmax(64px,.26fr))] 2xl:items-center">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={row.match?.result === "Victoire" ? "green" : "red"}>{row.match?.result || "Game"}</Badge><Badge tone={row.match?.side === "Blue" ? "blue" : "red"}>{row.match?.side || "Side ?"}</Badge></div>
      <p className="mt-2 truncate text-sm font-black text-white">{matchDisplayName(row.match)}</p>
      <p className="truncate text-xs font-semibold text-slate-400">{row.match?.duration || "--:--"}</p>
    </div>
    <div className="min-w-0"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Matchup</p><p className="mt-1 truncate font-black text-white">{enemy?.champion ? `vs ${championDisplayName(enemy.champion)}` : "Non reconnu"}</p></div>
    <div className="min-w-0"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">KDA</p><p className="break-words font-black text-white">{row.kills || 0}/{row.deaths || 0}/{row.assists || 0}</p></div>
    <div className="min-w-0"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">KP</p><p className="break-words font-black text-white">{Math.round(parsePercent(row.kill_participation || row.kp || 0))}%</p></div>
    <div className="min-w-0"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">DMG</p><p className="break-words font-black text-white">{formatPoints(row.damage)}</p></div>
  </div>;
}

function profileHistorySortKey(row) {
  const raw = row?.match?.created_at || row?.match?.game_date || row?.match?.date || row?.match?.raw?.info?.gameCreation || row?.match?.game_id || "";
  const numeric = Number(raw || 0);
  if (Number.isFinite(numeric) && numeric > 1000000000) return numeric;
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function profileHistoryDateLabel(row) {
  const value = row?.match?.created_at || row?.match?.game_date || row?.match?.date || "";
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function ProfileHistoryView({ rows = [], selectedCategoryId, navigate }) {
  const [championFilter, setChampionFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const orderedRows = rows.slice().sort((a, b) => profileHistorySortKey(b) - profileHistorySortKey(a) || String(b.match?.game_id || "").localeCompare(String(a.match?.game_id || "")));
  const championOptions = Array.from(new Set(orderedRows.map((row) => row.champion).filter(Boolean))).sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
  const filteredRows = orderedRows.filter((row) => {
    const result = row.match?.result || "";
    return (!championFilter || row.champion === championFilter)
      && (resultFilter === "all" || (resultFilter === "win" ? result === "Victoire" : result === "Défaite"));
  });
  const wins = filteredRows.filter((row) => row.match?.result === "Victoire").length;
  const totalDamage = filteredRows.reduce((sum, row) => sum + Number(row.damage || 0), 0);
  const avgKp = Math.round(filteredRows.reduce((sum, row) => sum + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, filteredRows.length));
  const resultOptions = [["all", "Toutes"], ["win", "Victoires"], ["loss", "Défaites"]];
  return <ProfileFold title="Historique importé" badge="Games" icon={FileText} toneName="purple">
    <div className="grid gap-3 xl:grid-cols-[minmax(220px,.34fr)_minmax(0,1fr)] xl:items-end">
      <SelectInput label="Champion" value={championFilter} onChange={setChampionFilter}>
        <option value="">Tous les champions</option>
        {championOptions.map((champion) => <option key={champion} value={champion}>{championDisplayName(champion)}</option>)}
      </SelectInput>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="rounded-xl border border-white/10 bg-black/20 p-1">
          <div className="grid gap-1 sm:grid-cols-3">{resultOptions.map(([id, label]) => <button key={id} type="button" onClick={() => setResultFilter(id)} className={cx("rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition", resultFilter === id ? "bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,.22)]" : "text-slate-300 hover:bg-white/[0.055] hover:text-white")}>{label}</button>)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={filteredRows.length ? "cyan" : "slate"}>{filteredRows.length}/{rows.length} games</Badge>
          <Badge tone={wins >= filteredRows.length - wins ? "green" : "red"}>{filteredRows.length ? Math.round((wins / Math.max(1, filteredRows.length)) * 100) : 0}% WR</Badge>
          <Badge tone="purple">{formatPoints(totalDamage)} dmg</Badge>
          <Badge tone="yellow">KP {avgKp}%</Badge>
        </div>
      </div>
    </div>
    <div className="mt-4 grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
      {filteredRows.length ? filteredRows.map((row, index) => {
        const cs10 = csAtMinute(row, 10);
        const cs20 = csAtMinute(row, 20);
        const targetMatchId = row.match?.id || "";
        const enemy = opponentRoleRow(row.match, row.role, row.raw?.participantId || row.participantId);
        const kp = Math.round(parsePercent(row.kill_participation || row.kp || 0));
        return <button key={(row.match?.id || row.match?.game_id || index) + row.champion} type="button" disabled={!targetMatchId} onClick={() => targetMatchId && navigate?.(`/statistiques?match=${encodeURIComponent(targetMatchId)}`)} className={cx("group min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/22 hover:bg-white/[0.055]", targetMatchId ? "cursor-pointer" : "cursor-default opacity-75")}>
          <div className="flex min-w-0 gap-3">
            <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><Badge tone={row.match?.result === "Victoire" ? "green" : "red"}>{row.match?.result || "Game"}</Badge><Badge tone={row.match?.side === "Blue" ? "blue" : "red"}>{row.match?.side || "Side ?"}</Badge>{row.match?.patch && <Badge tone="slate">{row.match.patch}</Badge>}</div>
              <div className="mt-2 flex min-w-0 items-center gap-2"><p className="truncate text-base font-black text-white">{championDisplayName(row.champion)}</p><span className="ml-auto shrink-0 text-sm font-black text-cyan-100">{row.kills || 0}/{row.deaths || 0}/{row.assists || 0}</span></div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-300">{matchDisplayName(row.match)}{profileHistoryDateLabel(row) ? ` · ${profileHistoryDateLabel(row)}` : ""} · {row.match?.duration || "--:--"}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-cyan-100 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <ProfileChampionMini label="Dmg" value={formatPoints(row.damage)} toneName="cyan" />
            <ProfileChampionMini label="Gold" value={formatPoints(row.gold)} toneName="yellow" />
            <ProfileChampionMini label="Vision" value={Math.round(Number(row.vision || 0))} toneName="purple" />
            <ProfileChampionMini label="KP" value={`${kp}%`} toneName={kp >= 60 ? "green" : "orange"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {enemy?.champion && <Badge tone="slate">vs {championDisplayName(enemy.champion)}</Badge>}
            <Badge tone="cyan">CS10 {Number.isFinite(cs10) ? cs10 : "-"}</Badge>
            <Badge tone="blue">CS20 {Number.isFinite(cs20) ? cs20 : "-"}</Badge>
            <Badge tone="yellow">Total {row.cs || 0}</Badge>
          </div>
        </button>;
      }) : <EmptyState icon={BarChart3} title="Aucune game" text={rows.length ? "Aucune game ne correspond aux filtres." : selectedCategoryId ? "Aucune game de cette catégorie n’est encore reliée à ce profil." : "Aucune game importée n’est encore reliée à ce profil."} />}
    </div>
  </ProfileFold>;
}

function ProfileCsMilestonePanel({ rows = [] }) {
  const [championFilter, setChampionFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const orderedRows = rows.slice().sort((a, b) => String(b.match?.created_at || b.match?.game_date || b.match?.game_id || "").localeCompare(String(a.match?.created_at || a.match?.game_date || a.match?.game_id || "")));
  const championOptions = Array.from(new Set(orderedRows.map((row) => row.champion).filter(Boolean))).sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
  const matchOptions = orderedRows.reduce((list, row) => {
    const id = String(row.match?.id || row.match?.game_id || "");
    if (id && !list.some((item) => item.id === id)) list.push({ id, match: row.match });
    return list;
  }, []);
  const filteredRows = orderedRows.filter((row) => {
    const matchId = String(row.match?.id || row.match?.game_id || "");
    return (!championFilter || row.champion === championFilter) && (!matchFilter || matchId === matchFilter);
  });
  const csSummary = csMilestoneSummary(filteredRows);
  return <div className="space-y-3">
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
      <SelectInput label="Champion" value={championFilter} onChange={setChampionFilter}><option value="">Tous les champions</option>{championOptions.map((champion) => <option key={champion} value={champion}>{championDisplayName(champion)}</option>)}</SelectInput>
      <SelectInput label="Game" value={matchFilter} onChange={setMatchFilter}><option value="">Toutes les games</option>{matchOptions.map((item) => <option key={item.id} value={item.id}>{matchDisplayName(item.match, "Game")} · {item.match?.result || "Résultat ?"}</option>)}</SelectInput>
      <div className="flex flex-wrap gap-2">
        <Badge tone={csSummary.samples ? "green" : "slate"}>CS10 {csSummary.at10 ?? "-"}</Badge>
        <Badge tone={csSummary.samples ? "cyan" : "slate"}>CS20 {csSummary.at20 ?? "-"}</Badge>
        <Badge tone="slate">{filteredRows.length} ligne{filteredRows.length > 1 ? "s" : ""}</Badge>
      </div>
    </div>
    <div className="grid gap-1.5 xl:grid-cols-2 2xl:grid-cols-3">
      {filteredRows.length ? filteredRows.map((row, index) => {
        const cs10 = csAtMinute(row, 10);
        const cs20 = csAtMinute(row, 20);
        return <div key={`${row.match?.id || row.match?.game_id || index}-${row.champion}-cs`} className="grid min-w-0 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2"><Badge tone={row.match?.result === "Victoire" ? "green" : "red"}>{row.match?.result || "Game"}</Badge><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p></div>
              <p className="mt-0.5 truncate text-[0.66rem] font-semibold text-slate-300">{matchDisplayName(row.match, "Game")} · {row.match?.duration || "--:--"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <span className="rounded-lg border border-emerald-200/15 bg-emerald-300/10 px-2 py-1"><span className="block text-[0.54rem] font-black uppercase tracking-[0.1em] text-emerald-100/80">CS10</span><span className="text-xs font-black text-white">{cs10 ?? "-"}</span></span>
            <span className="rounded-lg border border-cyan-200/15 bg-cyan-300/10 px-2 py-1"><span className="block text-[0.54rem] font-black uppercase tracking-[0.1em] text-cyan-100/80">CS20</span><span className="text-xs font-black text-white">{cs20 ?? "-"}</span></span>
            <span className="rounded-lg border border-amber-200/15 bg-amber-300/10 px-2 py-1"><span className="block text-[0.54rem] font-black uppercase tracking-[0.1em] text-amber-100/80">Total</span><span className="text-xs font-black text-white">{creepScore(row) || "-"}</span></span>
          </div>
        </div>;
      }) : <EmptyState icon={BarChart3} title="Aucune ligne CS" text="Aucune game ne correspond à ce filtre." />}
    </div>
  </div>;
}

function ProfileBuildGameCard({ row }) {
  const timeline = itemBuildTimeline(row);
  const finalItems = finalBuildItems(row);
  const enemy = (row.match?.participants || []).find((item) => item.team_key === "ENEMY" && String(item.role || "").toUpperCase() === String(row.role || "").toUpperCase());
  return <details className="group overflow-hidden rounded-2xl border border-white/10 bg-black/24">
    <summary className="flex cursor-pointer list-none flex-col gap-3 p-3 transition hover:bg-white/[0.035] lg:flex-row lg:items-center lg:justify-between [&::-webkit-details-marker]:hidden">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone={row.match?.result === "Victoire" ? "green" : "red"}>{row.match?.result || "Game"}</Badge>
          <Badge tone={row.match?.side === "Blue" ? "blue" : "red"}>{row.match?.side || "Side ?"}</Badge>
          {enemy?.champion && <Badge tone="slate">vs {championDisplayName(enemy.champion)}</Badge>}
          <Badge tone={timeline.length ? "cyan" : "slate"}>{timeline.length} achat{timeline.length > 1 ? "s" : ""}</Badge>
        </div>
        <p className="mt-2 truncate text-base font-black text-white">{matchDisplayName(row.match, "Game")}</p>
        <p className="truncate text-xs font-semibold text-slate-300">{row.match?.game_id || "Game ID inconnu"} · {row.match?.duration || "--:--"} · {row.kills || 0}/{row.deaths || 0}/{row.assists || 0}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {finalItems.length > 0 && <div className="flex flex-wrap gap-1.5">
        {finalItems.map((item, index) => <HudIcon key={`profile-final-${row.id || row.match?.id}-${index}-${item.id}`} sources={itemIconSources(item.id)} label={`${item.type === "trinket" ? "Trinket" : "Item"} ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : "cyan"} className="h-9 w-9" />)}
        </div>}
        <ChevronDown className="h-4 w-4 shrink-0 text-cyan-100 transition group-open:rotate-180" />
      </div>
    </summary>
    {timeline.length > 0 && <div className="border-t border-white/10 bg-white/[0.025] p-3">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-100">Timeline build</p><Badge tone="cyan">{timeline.length}</Badge></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {timeline.map((event, index) => <div key={`${row.id || row.match?.id}-item-event-${index}-${event.timestamp}-${event.itemId}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2">
          <span className="w-12 shrink-0 rounded-lg border border-cyan-200/15 bg-cyan-400/10 px-2 py-1 text-center text-[0.62rem] font-black text-cyan-50">{event.time}</span>
          <HudIcon sources={itemIconSources(event.itemId)} label={`${event.label} ${event.itemId}`} fallback={event.itemId} emptyText="?" toneName={event.toneName} className="h-9 w-9 shrink-0" />
          <div className="min-w-0"><p className="truncate text-xs font-black text-white">{event.label}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">Item {event.itemId}{event.secondaryId ? ` → ${event.secondaryId}` : ""}</p></div>
        </div>)}
      </div>
    </div>}
  </details>;
}

function ProfileFold({ title, badge, icon: Icon = Activity, toneName = "cyan", children }) {
  const [open, setOpen] = useState(true);
  return <Surface glow={open} className="min-w-0 p-4"><button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.045]"><div className="flex min-w-0 items-center gap-3"><div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", tone(toneName))}><Icon className="h-4 w-4" /></div><div className="min-w-0"><Badge tone={toneName}>{badge}</Badge><h3 className="mt-2 truncate text-2xl font-black text-white">{title}</h3></div></div><ChevronDown className={cx("h-5 w-5 shrink-0 text-cyan-100 transition", !open && "-rotate-90")} /></button><AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0, y: -6 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: "easeOut" }} className="overflow-hidden"><div className="pt-4">{children}</div></motion.div>}</AnimatePresence></Surface>;
}

function MatchupList({ items, toneName }) {
  const [openChampion, setOpenChampion] = useState("");
  return <div className="grid gap-2">{items.length ? items.map((item) => {
    const open = openChampion === item.champion;
    const gameRows = (item.rows || []).slice().sort((a, b) => String(b.row?.match?.created_at || b.row?.match?.game_date || b.row?.match?.game_id || "").localeCompare(String(a.row?.match?.created_at || a.row?.match?.game_date || a.row?.match?.game_id || "")));
    return <div key={item.champion} className={cx("overflow-hidden rounded-2xl border transition", open ? "border-cyan-300/35 bg-cyan-400/[0.07]" : "border-white/10 bg-black/25 hover:border-cyan-300/20 hover:bg-white/[0.04]")}>
      <button type="button" onClick={() => setOpenChampion(open ? "" : item.champion)} className="flex w-full min-w-0 items-center gap-3 p-3 text-left">
        <ChampionPortrait champion={item.champion} alt={item.champion} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">vs {championDisplayName(item.champion)}</p>
          <p className="truncate text-xs font-semibold text-slate-300">{item.games} game{item.games > 1 ? "s" : ""} · {item.winrate}% WR · KDA {item.kda}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={item.winrate >= 50 ? "green" : "red"}>{item.wins}W</Badge>
          <ChevronDown className={cx("h-4 w-4 text-cyan-100 transition", open && "rotate-180")} />
        </div>
      </button>
      <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0, y: -6 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: "easeOut" }} className="overflow-hidden">
        <div className="border-t border-white/10 p-3 pt-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100">Tes games dans ce matchup</p>
            <Badge tone={toneName || "cyan"}>{gameRows.length}</Badge>
          </div>
          <div className="grid gap-2">{gameRows.length ? gameRows.map(({ row, enemy }, index) => <MatchupGameDetailCard key={`${row?.id || row?.match?.id || row?.match?.game_id || item.champion}-${index}`} row={row} enemy={enemy} />) : <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs font-semibold text-slate-300">Aucune game détaillée disponible.</p>}</div>
        </div>
      </motion.div>}</AnimatePresence>
    </div>;
  }) : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Pas encore assez de games pour afficher ce bloc.</p>}</div>;
}

function MatchupGameDetailCard({ row, enemy }) {
  const finalItems = finalBuildItems(row);
  const timeline = itemBuildTimeline(row);
  const kda = `${row?.kills || 0}/${row?.deaths || 0}/${row?.assists || 0}`;
  const kp = Math.round(parsePercent(row?.kill_participation || row?.kp || 0));
  const cs10 = csAtMinute(row, 10);
  const cs20 = csAtMinute(row, 20);
  return <details className="group overflow-hidden rounded-2xl border border-white/10 bg-black/24">
    <summary className="grid cursor-pointer list-none gap-3 p-3 transition hover:bg-white/[0.035] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <ChampionPortrait row={row} champion={row?.champion} alt={row?.champion} className="h-12 w-12 shrink-0 rounded-xl border border-cyan-200/16 object-cover" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={row?.match?.result === "Victoire" ? "green" : "red"}>{row?.match?.result || "Game"}</Badge><p className="truncate font-black text-white">{championDisplayName(row?.champion || "Champion")}</p></div>
          <p className="mt-1 truncate text-xs font-semibold text-slate-300">{matchDisplayName(row?.match, "Game")} · {row?.match?.duration || "--:--"}</p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-3 gap-2 text-xs">
        <MatchupMiniMetric label="KDA" value={kda} />
        <MatchupMiniMetric label="KP" value={`${kp}%`} />
        <MatchupMiniMetric label="CS" value={creepScore(row) || "-"} />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-end">
        <div className="flex min-w-0 items-center gap-2">
          {enemy?.champion && <ChampionPortrait champion={enemy.champion} alt={enemy.champion} className="h-9 w-9 shrink-0 rounded-lg border border-rose-200/16 object-cover" />}
          <span className="truncate text-xs font-black text-rose-100">vs {enemy?.champion ? championDisplayName(enemy.champion) : "Adversaire"}</span>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-cyan-100 transition group-open:rotate-180" />
      </div>
    </summary>
    <div className="border-t border-white/10 p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,.68fr)_minmax(0,.32fr)]">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100">Build final</p><Badge tone={finalItems.length ? "cyan" : "slate"}>{finalItems.length} item{finalItems.length > 1 ? "s" : ""}</Badge></div>
          {finalItems.length ? <div className="flex flex-wrap gap-1.5">{finalItems.map((item, index) => <HudIcon key={`matchup-final-${row?.id || row?.match?.id}-${index}-${item.id}`} sources={itemIconSources(item.id)} label={`${item.type === "trinket" ? "Ward" : "Objet"} ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : "cyan"} className="h-10 w-10" />)}</div> : <p className="text-sm font-semibold text-slate-300">Aucun item final dans ce JSON.</p>}
          {timeline.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">{timeline.slice(0, 8).map((event, index) => <span key={`${event.timestamp}-${event.itemId}-${index}`} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[0.62rem] font-black text-slate-200"><span className="text-cyan-100">{event.time}</span>{event.label}</span>)}</div>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <MatchupMiniMetric label="Dégâts" value={formatPoints(row?.damage || 0)} />
          <MatchupMiniMetric label="Vision" value={row?.vision || 0} />
          <MatchupMiniMetric label="CS 10 / 20" value={`${Number.isFinite(cs10) ? cs10 : "-"} / ${Number.isFinite(cs20) ? cs20 : "-"}`} />
          <MatchupMiniMetric label="Or" value={formatPoints(row?.gold || 0)} />
        </div>
      </div>
    </div>
  </details>;
}

function MatchupMiniMetric({ label, value }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
    <p className="truncate text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
  </div>;
}

function ProfileSignalCard({ signal }) {
  const Icon = signal.icon || Activity;
  return <div className={cx("relative overflow-hidden rounded-2xl border p-4", tone(signal.toneName))}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[0.66rem] font-black uppercase tracking-[0.16em] opacity-80">{signal.title}</p><p className="mt-2 truncate text-2xl font-black text-white">{signal.value}</p><p className="mt-1 text-xs font-bold leading-5 text-slate-100/90">{signal.detail}</p></div><Icon className="h-6 w-6 shrink-0" /></div></div>;
}

function ChampionSpotlight({ title, items, toneName, empty }) {
  return <div className="rounded-2xl border border-white/10 bg-black/24 p-3"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-white">{title}</p><Badge tone={toneName}>{items.length}</Badge></div><div className="space-y-2">{items.length ? items.map((item) => <div key={item.champion} className="relative min-h-[86px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-3"><ChampionBackdrop champion={item.champion} /><div className="relative z-10 flex items-center gap-3"><ChampionPortrait champion={item.champion} alt={item.champion} className="h-14 w-14 shrink-0 rounded-2xl border border-cyan-200/20 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-lg font-black text-white">{championDisplayName(item.champion)}</p><p className="mt-1 text-xs font-semibold text-slate-200">{item.games} game{item.games > 1 ? "s" : ""} · {item.winrate}% WR · KDA {item.kda}</p></div></div></div>) : <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs font-semibold leading-5 text-slate-300">{empty}</p>}</div></div>;
}

function PremiumRosterTable({ roster, matches = [], region = "EUW", currentUserId = "", canManage = false, saving = false, syncingPlayerId = "", riotCooldownSeconds = 0, onCopyOpgg, onSyncPlayer, onEditPlayer, onDeletePlayer }) {
  const openProfile = (player) => {
    if (!isStaffRole(player.role)) openAppPath(`/mon-profil?player=${encodeURIComponent(player.id)}`);
  };
  if (!roster.length) return <div className="mt-6"><EmptyState icon={UserPlus} title="Aucun profil" text="Ajoute tes joueurs et ton staff pour préparer les reviews." /></div>;
  const playerRoster = roster.filter((item) => !isStaffRole(item.role)).sort((a, b) => rosterRoleIndex(a.role) - rosterRoleIndex(b.role) || String(a.name || "").localeCompare(String(b.name || "")));
  const staffRoster = roster.filter((item) => isStaffRole(item.role));
  const showActions = Boolean(onCopyOpgg || onSyncPlayer || onEditPlayer || onDeletePlayer);
  const renderSection = (items, title, subtitle, Icon, emptyText) => (
    <div className="overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-white/[0.028] shadow-[0_0_38px_rgba(34,211,238,.055)]">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-black/25 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black text-white">{title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-300">{subtitle}</p>
          </div>
        </div>
        <Badge tone={items.length ? "cyan" : "slate"}>{items.length} profil{items.length > 1 ? "s" : ""}</Badge>
      </div>
      {items.length ? <><div className="grid gap-3 p-3 md:hidden">
        {items.map((item) => {
          const staff = isStaffRole(item.role);
          const hasOpgg = !staff && Boolean(String(item.opgg_url || "").trim() || opggUrlFromRiotId(item.riot_id, region));
          const isLinkedToMe = String(item.user_id || "") === String(currentUserId || "");
          return <div key={item.id} className="rounded-2xl border border-white/10 bg-black/[0.18] p-3 transition hover:border-cyan-300/25 hover:bg-white/[0.04]"><button type="button" onClick={() => openProfile(item)} disabled={staff} className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-default"><div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25">{isGameplayRole(item.role) ? <RoleIcon role={item.role} className="h-4 w-4" /> : <Users className="h-4 w-4 text-violet-200" />}</div><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><RoleTag role={item.role} staff={staff} className="max-w-[7rem]" />{isLinkedToMe && <Badge tone="orange">Mon profil</Badge>}{item.user_id && !isLinkedToMe && <Badge tone="green">Lié</Badge>}</div><p className="mt-2 truncate text-lg font-black text-white">{item.name}</p><p className="mt-1 truncate text-xs font-semibold text-slate-300">{staff ? "Non utilisé dans OP.GG" : item.riot_id || "Sans Riot ID"}</p></div></div>{!staff && <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-cyan-100" />}</button><div className="mt-4">{staff ?<span className="text-xs font-semibold text-slate-300">Hors draft / OP.GG</span> : <ImportedChampionBadges player={item} matches={matches} />}</div>{showActions && <div className="mt-4 grid grid-cols-4 gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); onCopyOpgg?.(item); }} disabled={!hasOpgg} title={staff ? "Pas d'OP.GG pour staff" : "Copier l'OP.GG"} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-35"><Clipboard className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onSyncPlayer?.(item); }} disabled={staff || !canManage || saving || syncingPlayerId === item.id || riotCooldownSeconds > 0} title={riotCooldownSeconds > 0 ? `Riot ${formatCountdown(riotCooldownSeconds)}` : "Analyser ce profil"} className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-35">{syncingPlayerId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button><button type="button" onClick={(event) => { event.stopPropagation(); onEditPlayer?.(item); }} disabled={!canManage || saving} title="Modifier le profil" className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onDeletePlayer?.(item.id, item.name); }} disabled={!canManage || saving} title="Supprimer le profil" className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-300/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button></div>}</div>;
        })}
      </div><div className="hidden overflow-x-auto md:block">
        <table className={cx("w-full text-left text-sm", showActions ? "min-w-[940px]" : "min-w-[760px]")}>
          <thead className="sticky top-0 bg-white/[0.055] text-[0.68rem] uppercase tracking-[0.18em] text-slate-300"><tr><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Joueur</th><th className="px-4 py-3">Riot ID</th><th className="px-4 py-3">Champions les plus joués</th>{showActions && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-white/10">{items.map((item) => {
    const staff = isStaffRole(item.role);
    const hasOpgg = !staff && Boolean(String(item.opgg_url || "").trim() || opggUrlFromRiotId(item.riot_id, region));
    const isLinkedToMe = String(item.user_id || "") === String(currentUserId || "");
    return <tr key={item.id} onClick={() => openProfile(item)} className={cx("bg-black/[0.12] text-slate-300 transition hover:bg-white/[0.04]", staff ? "cursor-default" : "cursor-pointer")}><td className="px-4 py-4"><div className="flex min-w-0 items-center gap-2">{!staff && <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" />}<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25">{isGameplayRole(item.role) ? <RoleIcon role={item.role} className="h-5 w-5" /> : <Users className="h-4 w-4 text-violet-200" />}</div><RoleTag role={item.role} staff={staff} className="max-w-[7.5rem]" /></div></td><td className="px-4 py-4"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="min-w-0 truncate font-black text-white">{item.name}</span>{isLinkedToMe && <Badge tone="orange">Mon profil</Badge>}{item.user_id && !isLinkedToMe && <Badge tone="green">Lié</Badge>}</div></td><td className="px-4 py-4 font-semibold text-slate-300">{staff ? "Non utilisé" : item.riot_id || "Sans Riot ID"}</td><td className="px-4 py-4">{staff ?<span className="text-xs font-semibold text-slate-300">Hors draft / OP.GG</span> : <ImportedChampionBadges player={item} matches={matches} />}</td>{showActions && <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); onCopyOpgg?.(item); }} disabled={!hasOpgg} title={staff ? "Pas d'OP.GG pour staff" : "Copier l'OP.GG"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-35"><Clipboard className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onSyncPlayer?.(item); }} disabled={staff || !canManage || saving || syncingPlayerId === item.id || riotCooldownSeconds > 0} title={riotCooldownSeconds > 0 ? `Riot ${formatCountdown(riotCooldownSeconds)}` : "Analyser ce profil"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-35">{syncingPlayerId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button><button type="button" onClick={(event) => { event.stopPropagation(); onEditPlayer?.(item); }} disabled={!canManage || saving} title="Modifier le profil" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="h-4 w-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onDeletePlayer?.(item.id, item.name); }} disabled={!canManage || saving} title="Supprimer le profil" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button></div></td>}</tr>;
          })}</tbody>
        </table>
      </div></> : <div className="p-4"><div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">{emptyText}</div></div>}
    </div>
  );
  return <div className="mt-6 grid gap-5">{renderSection(playerRoster, "Équipe joueurs", "Profils utilisés pour le draft, les imports, les stats et les Champion Pools.", Users, "Aucun joueur dans cette équipe pour le moment.")}{renderSection(staffRoster, "Coaching staff", "Coachs, managers et staff : accès gestion sans présence dans le draft ni OP.GG.", ShieldCheck, "Aucun membre staff ajouté pour le moment.")}</div>;
}

function MatchIdentityBadges({ rows }) {
  const ally = (rows || []).filter((row) => row.team_key === "ALLY");
  const enemy = (rows || []).filter((row) => row.team_key === "ENEMY");
  const allyIdentity = compositionIdentity(ally);
  const enemyIdentity = compositionIdentity(enemy);
  if (!ally.length && !enemy.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2"><Badge tone={championStyleTone(allyIdentity.primary)}>Nous: {allyIdentity.primary}</Badge>{enemy.length > 0 && <Badge tone={championStyleTone(enemyIdentity.primary)}>Eux: {enemyIdentity.primary}</Badge>}</div>;
}

function matchImportTitle(match) {
  return matchDisplayName(match, "Import");
}

function matchCategoryTone(category) {
  return ["cyan", "purple", "pink", "green", "yellow", "orange", "red", "blue", "slate"].includes(String(category?.color || "")) ? category.color : "slate";
}

function matchCategoryLabel(match, categories) {
  const labels = matchCategoryIds(match)
    .map((id) => (categories || []).find((category) => String(category.id || "") === String(id))?.name)
    .filter(Boolean);
  return labels.length ? labels.join(", ") : "Non classée";
}

function matchCategoriesForMatch(match, categories) {
  return matchCategoryIds(match)
    .map((id) => (categories || []).find((category) => String(category.id || "") === String(id)))
    .filter(Boolean);
}

function CategoryFilter({ categories, selectedCategoryId, onSelect, label = "Catégories" }) {
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <span className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">{label}</span>
    <button type="button" onClick={() => onSelect("")} className={cx("rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition", !selectedCategoryId ? "border-cyan-200/45 bg-cyan-400/14 text-cyan-50" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]")}>Toutes</button>
    {(categories || []).map((category) => <button key={category.id} type="button" onClick={() => onSelect(String(category.id) === String(selectedCategoryId) ? "" : category.id)} className={cx("rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition", String(category.id) === String(selectedCategoryId) ? tone(matchCategoryTone(category)) : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]")}>{category.name}</button>)}
  </div>;
}

function CategoryMultiSelect({ categories, selectedIds, onChange, label = "Catégories" }) {
  const ids = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
  const toggle = (categoryId) => {
    const id = String(categoryId || "");
    onChange(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };
  return <div>
    <p className="mb-2 text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">{label}</p>
    <div className="flex flex-wrap gap-2">
      {(categories || []).map((category) => {
        const active = ids.includes(String(category.id));
        return <button key={category.id} type="button" onClick={() => toggle(category.id)} aria-pressed={active} className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition", active ? [tone(matchCategoryTone(category)), "scale-[1.03] ring-2 ring-white/55 shadow-[0_0_24px_rgba(34,211,238,.24)]"] : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]")}>{active && <Check className="h-3.5 w-3.5 shrink-0" />}{category.name}</button>;
      })}
      {!categories?.length && <Badge tone="slate">Aucune catégorie</Badge>}
    </div>
  </div>;
}

function JsonUploadProgress({ progress }) {
  if (!progress?.active) return null;
  const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
  const uploaded = progress.total ? `${formatUploadSize(progress.loaded)} / ${formatUploadSize(progress.total)}` : "Calcul de l’upload...";
  const phaseLabel = progress.phase === "server" ? "JSON envoyé, analyse NXT5 en cours" : "Upload du JSON";
  return <div className="rounded-2xl border border-cyan-300/18 bg-cyan-400/[0.07] p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-cyan-100">{progress.label || phaseLabel}</p>
        <p className="mt-1 text-xs font-semibold text-slate-300">{phaseLabel} · {uploaded}</p>
      </div>
      <span className="shrink-0 text-sm font-black text-white">{percent}%</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-sky-400 to-fuchsia-300 shadow-[0_0_18px_rgba(34,211,238,.35)] transition-[width] duration-150 ease-out" style={{ width: `${percent}%` }} />
    </div>
  </div>;
}

function ImportRoleHeader({ role, toneName = "cyan", player = null, fallbackLabel = "À lier" }) {
  const roleTone = toneName === "red"
    ? "border-rose-200/20 bg-rose-500/[0.08] text-rose-100"
    : "border-cyan-200/20 bg-cyan-400/[0.08] text-cyan-100";
  const chipTone = player
    ? "border-white/10 bg-white/[0.055] text-white"
    : "border-white/10 bg-black/20 text-slate-400";
  return (
    <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/24 p-2">
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", roleTone)}>
        <RoleIcon role={role} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">Poste</span>
        <span className="block truncate text-sm font-black text-white">{roleLabel(role)}</span>
      </span>
      <span className={cx("min-w-0 max-w-[46%] shrink rounded-lg border px-2 py-1 text-right text-[0.62rem] font-black uppercase tracking-[0.08em]", chipTone)}>
        <span className="block truncate">{player?.name || fallbackLabel}</span>
      </span>
    </div>
  );
}

function ImportHistoryCard({ match, categories, roster = [], editing, editForm, saving, onEdit, onCancel, onSave, onDelete, onChange, roleEditorOpen, roleForm, onToggleRoles, onRoleChange, onPlayerChange, onSaveRoles }) {
  const importer = match.created_by_name || match.created_by_account || "";
  const participants = match.participants || [];
  const selectedCategories = matchCategoriesForMatch(match, categories);
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        {editing ? <div className="grid gap-3">
          <TextInput label="Nom de la game" value={editForm.label} onChange={(label) => onChange({ ...editForm, label })} placeholder="Game 1 vs BK, Finale LB..." icon={FileText} />
          <CategoryMultiSelect categories={categories} selectedIds={editForm.categoryIds || []} onChange={(categoryIds) => onChange({ ...editForm, categoryIds })} />
        </div> : <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-white">{matchImportTitle(match)}</p>
            <Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge>
            <Badge tone="slate">{match.side || "Side ?"}</Badge>
            {selectedCategories.length ? selectedCategories.map((category) => <Badge key={category.id} tone={matchCategoryTone(category)}>{category.name}</Badge>) : <Badge tone="slate">Non classée</Badge>}
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-slate-300">{match.game_id} · {match.duration || "--:--"}</p>
          <div className="mt-3 flex flex-wrap gap-2">{importer && <Badge tone="cyan">Intégré par {importer}</Badge>}<Badge tone="purple">{match.patch || "Patch ?"}</Badge></div>
        </>}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {editing ? <>
          <Button type="button" variant="ghost" icon={X} onClick={onCancel} disabled={saving}>Annuler</Button>
          <Button type="button" icon={saving ? Loader2 : Check} onClick={onSave} disabled={saving || !editForm.label.trim()}>Enregistrer</Button>
        </> : <>
          <Button type="button" variant="ghost" icon={Settings} onClick={onToggleRoles} disabled={saving}>Postes</Button>
          <Button type="button" variant="ghost" icon={Pencil} onClick={onEdit} disabled={saving}>Modifier</Button>
          <Button type="button" variant="ghost" icon={Trash2} onClick={onDelete} disabled={saving}>Supprimer</Button>
        </>}
      </div>
    </div>
    {roleEditorOpen && <div className="mt-4 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-white">Réassigner postes et profils</p><p className="mt-1 text-xs font-semibold text-slate-300">Corrige les lanes et le profil NXT5 attaché au champion, notamment en cas d'inversion ADC/SUP.</p></div><Button type="button" icon={saving ? Loader2 : Check} onClick={onSaveRoles} disabled={saving}>Enregistrer</Button></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{["ALLY", "ENEMY"].map((teamKey) => <div key={teamKey} className={cx("rounded-2xl border p-3", teamKey === "ALLY" ? "border-cyan-300/14 bg-cyan-400/[0.045]" : "border-rose-300/14 bg-rose-500/[0.045]")}><div className="mb-3 flex items-center justify-between gap-2"><Badge tone={teamKey === "ALLY" ? "cyan" : "red"}>{teamKey === "ALLY" ? "Alliés" : "Adversaires"}</Badge></div><div className="grid gap-2 sm:grid-cols-2">{participants.filter((row) => row.team_key === teamKey).map((row) => {
        const formValue = roleForm[row.id];
        const form = formValue && typeof formValue === "object" ? formValue : { role: formValue || row.role || "", playerId: row.player_id || "" };
        const linkedPlayer = roster.find((player) => String(player.id || "") === String(form.playerId || ""));
        return <label key={row.id} className="grid min-w-0 gap-2 rounded-xl border border-white/10 bg-black/22 p-2"><span className="flex min-w-0 items-center gap-2"><ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-9 w-9 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-white">{championDisplayName(row.champion)}</span><span className="block truncate text-[0.62rem] font-semibold text-slate-300">{teamKey === "ALLY" && linkedPlayer ? `${linkedPlayer.name} · ${row.summoner_name || row.riot_id || "Joueur"}` : row.summoner_name || row.riot_id || "Joueur"}</span></span></span><span className="grid grid-cols-[76px_minmax(0,1fr)] gap-2"><select value={form.role || ""} onChange={(event) => onRoleChange(row.id, event.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[0.68rem] font-black text-white outline-none">{COMP_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select>{teamKey === "ALLY" ? <select value={form.playerId || ""} onChange={(event) => onPlayerChange(row.id, event.target.value)} className="min-w-0 rounded-lg border border-cyan-300/14 bg-cyan-400/[0.07] px-2 py-1.5 text-[0.68rem] font-black text-white outline-none"><option value="">Profil NXT5</option>{roster.map((player) => <option key={player.id} value={player.id}>{roleLabel(player.role)} · {player.name}</option>)}</select> : <span className="rounded-lg border border-white/10 bg-black/24 px-2 py-1.5 text-[0.68rem] font-black text-slate-400">Adversaire</span>}</span></label>;
      })}</div></div>)}</div>
    </div>}
  </div>;
}

function Matches({ data, refreshAll, selectedTeamId, pushToast, currentMember, user }) {
  const [laneAssignments, setLaneAssignments] = useState({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  const [enemyLaneAssignments, setEnemyLaneAssignments] = useState({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  const [playerAssignments, setPlayerAssignments] = useState({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  const [allyTeamSide, setAllyTeamSide] = useState("");
  const [importDetails, setImportDetails] = useState({ label: "", categoryIds: [] });
  const [importPreview, setImportPreview] = useState(null);
  const [previewPayload, setPreviewPayload] = useState(null);
  const [importing, setImporting] = useState(false);
  const [fileImporting, setFileImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [editingMatchId, setEditingMatchId] = useState("");
  const [matchEditForm, setMatchEditForm] = useState({ label: "", categoryIds: [] });
  const [managingMatchId, setManagingMatchId] = useState("");
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "cyan" });
  const [categoryCreatorOpen, setCategoryCreatorOpen] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [roleEditorMatchId, setRoleEditorMatchId] = useState("");
  const [roleEditForm, setRoleEditForm] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const selected = data.matches.find((match) => match.id === selectedId) || data.matches[0];
  const rows = selected?.participants || [];
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0] || null;
  const matchCategories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const canManageCategories = selectedTeam?.owner_id === user?.id || canStaffManage(currentMember?.role);
  const gameplayRoster = (data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role));
  function updateUploadProgress(next) {
    setUploadProgress((current) => ({ ...(current || {}), ...(next || {}), active: true }));
  }
  function clearUploadProgressSoon() {
    window.setTimeout(() => setUploadProgress(null), 1200);
  }
  function updateLaneAssignment(role, value) {
    setLaneAssignments((current) => ({ ...current, [role]: value }));
  }
  function updateEnemyLaneAssignment(role, value) {
    setEnemyLaneAssignments((current) => ({ ...current, [role]: value }));
  }
  function updatePlayerAssignment(role, value) {
    setPlayerAssignments((current) => ({ ...current, [role]: value }));
  }
  function rosterAssignmentsByRole() {
    return COMP_ROLES.reduce((next, role) => {
      next[role] = gameplayRoster.find((player) => player.role === role)?.id || "";
      return next;
    }, {});
  }
  function normalizePreviewRole(value) {
    const raw = String(value || "").toUpperCase();
    if (raw === "JUNGLE") return "JGL";
    if (raw === "MIDDLE") return "MID";
    if (raw === "BOTTOM") return "ADC";
    if (raw === "UTILITY" || raw === "SUPPORT") return "SUP";
    if (COMP_ROLES.includes(raw)) return raw;
    return "";
  }
  function previewRiotRole(participant) {
    return normalizePreviewRole(participant?.teamPosition || participant?.individualPosition || participant?.lane);
  }
  function previewFallbackRole(participant, index) {
    const participantId = Number(participant?.participantId || 0);
    if (participantId) return COMP_ROLES[(participantId - 1) % 5] || "";
    return COMP_ROLES[index] || "";
  }
  function previewRole(participant, index) {
    return previewRiotRole(participant) || previewFallbackRole(participant, index);
  }
  function previewAssignmentValue(participant) {
    return participant?.riotId || participant?.summonerName || participant?.champion || "";
  }
  function preportIdentityKeys(participant) {
    const riotId = String(participant?.riotId || "").trim();
    const summonerName = String(participant?.summonerName || "").trim();
    const values = [riotId, summonerName];
    if (riotId.includes("#")) values.push(riotId.split("#")[0]);
    return [...new Set(values.map(normalizeProfileKey).filter(Boolean))];
  }
  function rosterIdentityLookup() {
    const lookup = new Map();
    gameplayRoster.forEach((player) => {
      [player.riot_id, player.name].forEach((value) => {
        const key = normalizeProfileKey(value);
        if (key && !lookup.has(key)) lookup.set(key, player);
      });
      const riotName = String(player.riot_id || "").split("#")[0];
      const riotNameKey = normalizeProfileKey(riotName);
      if (riotNameKey && !lookup.has(riotNameKey)) lookup.set(riotNameKey, player);
    });
    return lookup;
  }
  function matchedRosterPlayer(participant, lookup) {
    return preportIdentityKeys(participant).map((key) => lookup.get(key)).find(Boolean) || null;
  }
  function previewRoleScore(participant, role, index, matchedPlayer) {
    const riotRole = previewRiotRole(participant);
    const fallbackRole = previewFallbackRole(participant, index);
    const champion = participant?.champion;
    let score = 0;
    if (matchedPlayer?.role === role) score += 140;
    if (matchedPlayer && matchedPlayer.role !== role) score -= 70;
    if (riotRole === role) score += 110;
    if (riotRole && riotRole !== role) score -= 55;
    if (champion && championMatchesLane(champion, role)) score += 28;
    if (fallbackRole === role) score += 10;
    return score;
  }
  function roleParticipantMapForSide(side) {
    const team = previewTeams.find((item) => item.side === side);
    const participants = [...(team?.participants || [])].sort((a, b) => Number(a.participantId || 0) - Number(b.participantId || 0));
    const lookup = rosterIdentityLookup();
    const candidates = [];
    participants.forEach((participant, index) => {
      const matched = matchedRosterPlayer(participant, lookup);
      COMP_ROLES.forEach((role) => {
        candidates.push({ role, participant, matched, score: previewRoleScore(participant, role, index, matched) });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    const byRole = new Map();
    const usedParticipants = new Set();
    candidates.forEach((candidate) => {
      const key = candidate.participant?.participantId || previewAssignmentValue(candidate.participant);
      if (!key || candidate.score <= -40 || byRole.has(candidate.role) || usedParticipants.has(key)) return;
      byRole.set(candidate.role, candidate);
      usedParticipants.add(key);
    });
    COMP_ROLES.forEach((role) => {
      if (byRole.has(role)) return;
      const fallback = participants.find((participant, index) => {
        const key = participant?.participantId || previewAssignmentValue(participant);
        return !usedParticipants.has(key) && previewFallbackRole(participant, index) === role;
      }) || participants.find((participant) => {
        const key = participant?.participantId || previewAssignmentValue(participant);
        return !usedParticipants.has(key);
      });
      if (!fallback) return;
      const key = fallback?.participantId || previewAssignmentValue(fallback);
      byRole.set(role, { role, participant: fallback, matched: matchedRosterPlayer(fallback, lookup), score: 0 });
      usedParticipants.add(key);
    });
    return byRole;
  }
  function laneAssignmentsForSide(side) {
    const byRole = roleParticipantMapForSide(side);
    return COMP_ROLES.reduce((next, role) => {
      next[role] = previewAssignmentValue(byRole.get(role)?.participant);
      return next;
    }, {});
  }
  function playerAssignmentsForSide(side) {
    const defaults = rosterAssignmentsByRole();
    const byRole = roleParticipantMapForSide(side);
    return COMP_ROLES.reduce((next, role) => {
      next[role] = byRole.get(role)?.matched?.id || defaults[role] || "";
      return next;
    }, {});
  }
  function selectImportSide(side) {
    const enemySide = side === "BLUE" ? "RED" : "BLUE";
    setAllyTeamSide(side);
    setLaneAssignments(laneAssignmentsForSide(side));
    setEnemyLaneAssignments(laneAssignmentsForSide(enemySide));
    setPlayerAssignments(playerAssignmentsForSide(side));
  }
  function resetImportDraft() {
    setImportPreview(null);
    setPreviewPayload(null);
    setAllyTeamSide("");
    setImportDetails({ label: "", categoryIds: [] });
    setLaneAssignments({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
    setEnemyLaneAssignments({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
    setPlayerAssignments({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  }
  function startEditMatch(match) {
    setEditingMatchId(match.id);
    setMatchEditForm({ label: matchImportTitle(match), categoryIds: matchCategoryIds(match) });
  }
  function cancelEditMatch() {
    setEditingMatchId("");
    setMatchEditForm({ label: "", categoryIds: [] });
  }
  function toggleRoleEditor(match) {
    const open = roleEditorMatchId === match.id;
    setRoleEditorMatchId(open ? "" : match.id);
    setRoleEditForm(open ? {} : Object.fromEntries((match.participants || []).map((row) => [row.id, { role: row.role || "", playerId: row.player_id || "" }])));
  }
  function updateRoleEdit(participantId, role) {
    setRoleEditForm((current) => {
      const previous = current[participantId];
      const form = previous && typeof previous === "object" ? previous : { role: previous || "", playerId: "" };
      return { ...current, [participantId]: { ...form, role } };
    });
  }
  function updatePlayerEdit(participantId, playerId) {
    setRoleEditForm((current) => {
      const previous = current[participantId];
      const form = previous && typeof previous === "object" ? previous : { role: previous || "", playerId: "" };
      return { ...current, [participantId]: { ...form, playerId } };
    });
  }
  async function saveMatchRoles(match) {
    setManagingMatchId(match.id);
    try {
      await apiFetch("matches-manage", { method: "POST", body: JSON.stringify({ action: "roles", teamId: selectedTeamId, matchId: match.id, roles: roleEditForm }) });
      setRoleEditorMatchId("");
      setRoleEditForm({});
      await refreshAll();
      pushToast({ type: "green", title: "Assignation corrigée", text: "Les profils, statistiques et lectures 5v5 utilisent les bons joueurs." });
    } catch (err) {
      pushToast({ type: "red", title: "Correction impossible", text: err.message });
    } finally {
      setManagingMatchId("");
    }
  }
  async function saveMatchHistory(match) {
    setManagingMatchId(match.id);
    try {
      await apiFetch("matches-manage", { method: "POST", body: JSON.stringify({ action: "update", teamId: selectedTeamId, matchId: match.id, label: matchEditForm.label, categoryIds: matchEditForm.categoryIds || [] }) });
      cancelEditMatch();
      await refreshAll();
      pushToast({ type: "green", title: "Import renommé", text: "Les statistiques et reviews utilisent le nouvel intitulé." });
    } catch (err) {
      pushToast({ type: "red", title: "Renommage impossible", text: err.message });
    } finally {
      setManagingMatchId("");
    }
  }
  async function createMatchCategory(event) {
    event.preventDefault();
    if (!canManageCategories || !categoryForm.name.trim()) return;
    setSavingCategory(true);
    try {
      await apiFetch("match-categories-manage", { method: "POST", body: JSON.stringify({ action: "create", teamId: selectedTeamId, name: categoryForm.name, color: categoryForm.color }) });
      setCategoryForm({ name: "", color: "cyan" });
      setCategoryCreatorOpen(false);
      await refreshAll();
      pushToast({ type: "green", title: "Catégorie créée", text: "Tu peux maintenant classer tes games dedans." });
    } catch (err) {
      pushToast({ type: "red", title: "Création impossible", text: err.message });
    } finally {
      setSavingCategory(false);
    }
  }
  async function deleteMatchCategory(category) {
    if (!canManageCategories || !category || category.is_default) return;
    if (!window.confirm(`Supprimer la catégorie "${category.name}" ? Les games resteront importées mais seront non classées.`)) return;
    setSavingCategory(true);
    try {
      await apiFetch("match-categories-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, categoryId: category.id }) });
      await refreshAll();
      pushToast({ type: "green", title: "Catégorie supprimée", text: "Les games associées ont été conservées." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSavingCategory(false);
    }
  }
  async function deleteMatchHistory(match) {
    if (!window.confirm(`Supprimer l'import "${matchImportTitle(match)}" ? Les statistiques, reviews auto et groupes liés seront mis à jour.`)) return;
    setManagingMatchId(match.id);
    try {
      await apiFetch("matches-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, matchId: match.id }) });
      await refreshAll();
      pushToast({ type: "green", title: "Import supprimé", text: "Les autres pages ont été recalculées sans cette game." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setManagingMatchId("");
    }
  }
  async function confirmImport(event) {
    event.preventDefault();
    const payload = { teamId: selectedTeamId, payload: previewPayload, laneAssignments, enemyLaneAssignments, playerAssignments, allyTeamSide, label: importDetails.label, categoryIds: importDetails.categoryIds || [] };
    setImporting(true);
    setUploadProgress({ active: true, label: "Import final", phase: "upload", percent: 0, loaded: 0, total: 0 });
    try {
      await apiUploadJson("matches-import-file", payload, updateUploadProgress);
      resetImportDraft();
      await refreshAll();
      pushToast({ type: "green", title: "Game importée", text: "Side, profils et lanes ont été appliqués à cette game." });
      clearUploadProgressSoon();
    } catch (err) {
      pushToast(errorToast(err, "Import impossible", "match-import"));
      clearUploadProgressSoon();
    } finally {
      setImporting(false);
    }
  }
  async function importLocalFile(file) {
    if (!file) return;
    setFileImporting(true);
    setUploadProgress({ active: true, label: file.name || "Prévisualisation JSON", phase: "prepare", percent: 0, loaded: 0, total: file.size || 0 });
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await apiUploadJson("matches-import-file", { teamId: selectedTeamId, payload, previewOnly: true }, updateUploadProgress);
      resetImportDraft();
      setPreviewPayload(payload);
      setImportPreview(result.match);
      setImportDetails({
        label: payload?.label || payload?.metadata?.label || payload?.opponent || payload?.metadata?.opponent || "",
        categoryIds: []
      });
      pushToast({ type: "green", title: "JSON chargé", text: "Choisis ton side, les champions et les profils avant de confirmer." });
      clearUploadProgressSoon();
    } catch (err) {
      if (err instanceof SyntaxError) pushToast({ type: "red", title: "Import fichier impossible", text: "Le fichier choisi n’est pas un JSON valide. Génère-le avec NXT5 Importer." });
      else pushToast(errorToast(err, "Import fichier impossible", "match-import"));
      clearUploadProgressSoon();
    } finally {
      setFileImporting(false);
    }
  }

  const teamMatches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const laneAssignmentsReady = COMP_ROLES.every((role) => String(laneAssignments[role] || "").trim() && String(playerAssignments[role] || "").trim());
  const enemyAssignmentsReady = COMP_ROLES.every((role) => String(enemyLaneAssignments[role] || "").trim());
  const importReady = Boolean(importPreview && allyTeamSide && laneAssignmentsReady && enemyAssignmentsReady && importDetails.label.trim());
  const previewTeams = importPreview?.teams || [];
  const allyPreviewTeam = previewTeams.find((team) => team.side === allyTeamSide);
  const enemyPreviewTeam = previewTeams.find((team) => team.side && team.side !== allyTeamSide);
  const selectedPreviewParticipant = (team, value) => (team?.participants || []).find((participant) => previewAssignmentValue(participant) === value);
  const importChecks = [
    ["JSON", Boolean(importPreview)],
    ["Side", Boolean(allyTeamSide)],
    ["Nom", Boolean(importDetails.label.trim())],
    ["Profils", laneAssignmentsReady],
    ["Adversaires", enemyAssignmentsReady],
  ];
  const importProgress = importChecks.filter(([, done]) => done).length;
  const latestMatch = teamMatches[0];
  return (
    <div className="nxt5-data-dense">
      <PageHeader eyebrow="Intégration" title="Intégration des games" />
      <div className="grid min-w-0 gap-5">
        <Surface glow className="min-w-0 p-0">
          <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(280px,.72fr)_minmax(0,1fr)]">
            <div className="border-b border-cyan-200/10 bg-cyan-400/[0.045] p-5 md:p-6 xl:border-b-0 xl:border-r">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">NXT5 Importer</Badge><Badge tone={importPreview ? "green" : "slate"}>{importPreview ? "JSON chargé" : "Prêt"}</Badge></div>
              <h3 className="mt-4 text-2xl font-black text-white">Importer sans friction</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">Lance l’app locale sur le PC où le client League possède la partie, génère le JSON, puis finalise ici le side, les profils et les catégories.</p>
              <div className="mt-5 grid gap-2">
                {[
                  [Download, "Exporter", "Génère le JSON depuis l’historique LoL."],
                  [Upload, "Charger", "Dépose le fichier dans NXT5."],
                  [Check, "Valider", "Confirme side, lanes et profils."],
                ].map(([Icon, title, text], index) => <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-black/22 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/18 bg-cyan-400/10 text-cyan-100"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="text-sm font-black text-white">{index + 1}. {title}</p><p className="mt-0.5 text-xs font-semibold leading-5 text-slate-300">{text}</p></div>
                </div>)}
              </div>
            </div>
            <div className="min-w-0 p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.66rem] font-black uppercase tracking-[0.2em] text-cyan-100">Action rapide</p>
                  <h4 className="mt-2 text-xl font-black text-white">Télécharger ou importer le JSON</h4>
                  <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Les boutons restent au premier niveau pour que le coach puisse importer une game juste après la fin du scrim.</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <a href={NXT5_IMPORTER_WINDOWS_URL} download className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-50 transition hover:-translate-y-0.5 hover:bg-cyan-400/16"><Download className="h-4 w-4" /> Windows</a>
                  <a href={NXT5_IMPORTER_MAC_URL} download className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-3 text-sm font-black text-fuchsia-50 transition hover:-translate-y-0.5 hover:bg-fuchsia-400/16"><Download className="h-4 w-4" /> Mac</a>
                  <label className={cx("inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.055] px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.08]", fileImporting ? "pointer-events-none opacity-60" : "")}>
                    {fileImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{fileImporting ? "Chargement..." : "Importer un JSON"}
                    <input type="file" accept="application/json,.json" className="hidden" disabled={fileImporting || !selectedTeamId} onChange={(event) => { importLocalFile(event.target.files?.[0]); event.target.value = ""; }} />
                  </label>
                </div>
              </div>
              <JsonUploadProgress progress={uploadProgress} />
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">Imports</p><p className="mt-1 text-2xl font-black text-white">{teamMatches.length}</p></div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">Dernière game</p><p className="mt-1 truncate text-sm font-black text-white">{latestMatch ? matchImportTitle(latestMatch) : "Aucune"}</p></div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">État</p><p className="mt-1 text-sm font-black text-cyan-100">{importProgress}/{importChecks.length} étapes validées</p></div>
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="min-w-0 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0"><Badge tone={importReady ? "green" : "orange"}>{importReady ? "Prêt à importer" : "À compléter"}</Badge><h3 className="mt-3 text-2xl font-black text-white">Assignation de la game</h3><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Charge un JSON, sélectionne le side de ton équipe, puis valide les lanes et profils. La barre ci-dessous montre ce qui manque avant confirmation.</p></div>
            <div className="flex min-w-[180px] flex-wrap gap-1.5 md:justify-end">{importChecks.map(([label, done]) => <span key={label} className={cx("rounded-full border px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em]", done ? "border-emerald-200/28 bg-emerald-400/12 text-emerald-100" : "border-white/10 bg-white/[0.035] text-slate-400")}>{label}</span>)}</div>
          </div>
              {importPreview ? <div className="mt-4 space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(240px,.9fr)_minmax(260px,1.1fr)]">
                  <TextInput label="Nom de la game" value={importDetails.label} onChange={(label) => setImportDetails((current) => ({ ...current, label }))} placeholder="Game 1 vs BK, Finale LB..." required icon={FileText} />
                  <CategoryMultiSelect categories={matchCategories} selectedIds={importDetails.categoryIds || []} onChange={(categoryIds) => setImportDetails((current) => ({ ...current, categoryIds }))} />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {previewTeams.map((team) => <button key={team.side} type="button" onClick={() => selectImportSide(team.side)} className={cx("rounded-2xl border p-4 text-left transition hover:-translate-y-0.5", allyTeamSide === team.side ? "border-cyan-300/45 bg-cyan-400/14 shadow-[0_0_24px_rgba(34,211,238,.10)]" : "border-white/10 bg-black/24 hover:bg-white/[0.045]")}>
                    <div className="flex items-center justify-between gap-3"><p className="font-black text-white">{team.side === "BLUE" ? "Blue Side" : "Red Side"}</p><Badge tone={team.win ? "green" : "red"}>{team.win ? "Victoire" : "Défaite"}</Badge></div>
                    <div className="mt-3 flex flex-wrap gap-2">{team.participants.map((participant) => <div key={participant.participantId} className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3"><ChampionPortrait champion={participant.champion} alt={participant.champion} className="h-7 w-7 shrink-0 rounded-full object-cover" /><span className="truncate text-xs font-black text-white">{championDisplayName(participant.champion)}</span></div>)}</div>
                  </button>)}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-lg font-black text-white">Notre équipe</h4><Badge tone="cyan">{allyTeamSide || "Side ?"}</Badge></div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {COMP_ROLES.map((role) => {
                        const assignedPlayer = gameplayRoster.find((player) => player.id === playerAssignments[role]) || gameplayRoster.find((player) => player.role === role);
                        const pickedChampion = selectedPreviewParticipant(allyPreviewTeam, laneAssignments[role]);
                        return <div key={role} className={cx("min-w-0 rounded-2xl border p-3 transition", laneAssignments[role] && playerAssignments[role] ? "border-cyan-200/22 bg-cyan-400/[0.06]" : "border-white/10 bg-black/25")}>
                          <ImportRoleHeader role={role} player={assignedPlayer} />
                          <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/24 p-2">
                            {pickedChampion ? <ChampionPortrait champion={pickedChampion.champion} alt={pickedChampion.champion} className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/12 text-slate-500"><Swords className="h-4 w-4" /></span>}
                            <div className="min-w-0"><p className="truncate text-sm font-black text-white">{pickedChampion ? championDisplayName(pickedChampion.champion) : "Champion à choisir"}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">{pickedChampion?.riotId || pickedChampion?.summonerName || "Sélection JSON"}</p></div>
                          </div>
                          <select value={laneAssignments[role] || ""} onChange={(event) => updateLaneAssignment(role, event.target.value)} disabled={!allyPreviewTeam} className="w-full rounded-xl border border-white/10 bg-black/[0.28] px-3 py-2 text-xs font-black text-white outline-none">
                            <option value="">Champion joué</option>
                            {(allyPreviewTeam?.participants || []).map((participant) => <option key={participant.participantId} value={participant.riotId || participant.summonerName || participant.champion}>{championDisplayName(participant.champion)} · {participant.riotId || participant.summonerName}</option>)}
                          </select>
                          <select value={playerAssignments[role] || ""} onChange={(event) => updatePlayerAssignment(role, event.target.value)} disabled={!allyPreviewTeam} className="mt-2 w-full rounded-xl border border-cyan-300/14 bg-cyan-400/[0.07] px-3 py-2 text-xs font-black text-white outline-none">
                            <option value="">Profil NXT5 lié</option>
                            {gameplayRoster.map((player) => <option key={player.id} value={player.id}>{roleLabel(player.role)} · {player.name}{player.riot_id ? ` · ${player.riot_id}` : ""}</option>)}
                          </select>
                        </div>;
                      })}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-rose-300/14 bg-rose-500/[0.055] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-lg font-black text-white">Équipe adverse</h4><Badge tone="red">{enemyPreviewTeam?.side || "Side ?"}</Badge></div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {COMP_ROLES.map((role) => {
                        const pickedChampion = selectedPreviewParticipant(enemyPreviewTeam, enemyLaneAssignments[role]);
                        return (
                        <div key={role} className={cx("min-w-0 rounded-2xl border p-3 transition", enemyLaneAssignments[role] ? "border-rose-200/22 bg-rose-500/[0.06]" : "border-white/10 bg-black/25")}>
                          <ImportRoleHeader role={role} toneName="red" fallbackLabel="Adverse" />
                          <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/24 p-2">
                            {pickedChampion ? <ChampionPortrait champion={pickedChampion.champion} alt={pickedChampion.champion} className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/12 text-slate-500"><Shield className="h-4 w-4" /></span>}
                            <div className="min-w-0"><p className="truncate text-sm font-black text-white">{pickedChampion ? championDisplayName(pickedChampion.champion) : "Champion adverse"}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">{pickedChampion?.riotId || pickedChampion?.summonerName || "Sélection JSON"}</p></div>
                          </div>
                          <select value={enemyLaneAssignments[role] || ""} onChange={(event) => updateEnemyLaneAssignment(role, event.target.value)} disabled={!enemyPreviewTeam} className="w-full rounded-xl border border-white/10 bg-black/[0.28] px-3 py-2 text-xs font-black text-white outline-none">
                            <option value="">Champion adverse</option>
                            {(enemyPreviewTeam?.participants || []).map((participant) => <option key={participant.participantId} value={participant.riotId || participant.summonerName || participant.champion}>{championDisplayName(participant.champion)} · {participant.riotId || participant.summonerName}</option>)}
                          </select>
                        </div>
                      );})}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" icon={X} onClick={() => resetImportDraft()}>Réinitialiser</Button><Button type="button" icon={importing ? Loader2 : Check} onClick={confirmImport} disabled={importing || !importReady}>Confirmer l’import</Button></div>
              </div> : <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold leading-6 text-slate-300">Aucun JSON chargé pour le moment.</p>}
        </Surface>
      </div>

      <Surface className="mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h3 className="text-xl font-black text-white">Historique des imports</h3><p className="mt-1 text-sm font-semibold text-slate-300">{teamMatches.length} game{teamMatches.length > 1 ? "s" : ""} importée{teamMatches.length > 1 ? "s" : ""}. Classe-les en Scrim, Match officiel ou catégories custom pour analyser les blocs séparément.</p></div><Badge tone="cyan">Stats synchronisées</Badge></div>
        <div className="mt-4 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">{matchCategories.length ? matchCategories.map((category) => <span key={category.id} className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]", tone(matchCategoryTone(category)))}>{category.name}{!category.is_default && canManageCategories && <button type="button" onClick={() => deleteMatchCategory(category)} disabled={savingCategory} className="rounded-full p-0.5 opacity-70 transition hover:bg-white/10 hover:opacity-100" aria-label={`Supprimer ${category.name}`}><X className="h-3 w-3" /></button>}</span>) : <Badge tone="slate">Catégories en cours de création</Badge>}</div>
              <p className="mt-2 text-sm font-semibold text-slate-300">Les catégories servent à comparer les performances selon le contexte : scrim, match officiel, bootcamp, ligue, test draft...</p>
            </div>
            {canManageCategories && <Button type="button" icon={categoryCreatorOpen ? X : Plus} variant={categoryCreatorOpen ? "ghost" : "primary"} onClick={() => { setCategoryCreatorOpen((open) => !open); if (categoryCreatorOpen) setCategoryForm({ name: "", color: "cyan" }); }}>{categoryCreatorOpen ? "Fermer" : "Ajouter une catégorie"}</Button>}
          </div>
          {canManageCategories && categoryCreatorOpen && <form onSubmit={createMatchCategory} className="mt-4 grid min-w-0 gap-2 rounded-2xl border border-white/10 bg-black/24 p-3 sm:grid-cols-[minmax(180px,1fr)_150px_auto_auto]">
            <TextInput label="Catégorie custom" value={categoryForm.name} onChange={(name) => setCategoryForm((current) => ({ ...current, name }))} placeholder="Ligue, Bootcamp..." icon={Plus} />
            <SelectInput label="Couleur" value={categoryForm.color} onChange={(color) => setCategoryForm((current) => ({ ...current, color }))}>
              {["cyan", "purple", "green", "yellow", "pink", "red", "blue", "slate"].map((color) => <option key={color} value={color}>{color}</option>)}
            </SelectInput>
            <div className="flex items-end"><Button type="submit" icon={savingCategory ? Loader2 : Plus} disabled={savingCategory || !categoryForm.name.trim()}>Créer</Button></div>
            <div className="flex items-end"><Button type="button" variant="ghost" icon={X} disabled={savingCategory} onClick={() => { setCategoryCreatorOpen(false); setCategoryForm({ name: "", color: "cyan" }); }}>Annuler</Button></div>
          </form>}
        </div>
        <div className="mt-4 grid gap-3 2xl:grid-cols-2">{teamMatches.length ? teamMatches.map((match) => <ImportHistoryCard key={match.id} match={match} categories={matchCategories} roster={gameplayRoster} editing={editingMatchId === match.id} editForm={matchEditForm} saving={managingMatchId === match.id} roleEditorOpen={roleEditorMatchId === match.id} roleForm={roleEditForm} onEdit={() => startEditMatch(match)} onCancel={cancelEditMatch} onSave={() => saveMatchHistory(match)} onDelete={() => deleteMatchHistory(match)} onChange={setMatchEditForm} onToggleRoles={() => toggleRoleEditor(match)} onRoleChange={updateRoleEdit} onPlayerChange={updatePlayerEdit} onSaveRoles={() => saveMatchRoles(match)} />) : <EmptyState icon={Swords} title="Aucune game" text="Importe une première game pour alimenter les statistiques." />}</div>
      </Surface>
    </div>
  );
}

function StatMeter({ label, value, max, tone = "cyan", detail }) {
  const pct = Math.max(4, Math.min(100, Math.round((Number(value || 0) / Math.max(1, Number(max || 1))) * 100)));
  const colors = {
    cyan: "from-cyan-300 to-blue-500",
    purple: "from-violet-300 to-fuchsia-500",
    green: "from-emerald-300 to-cyan-400",
    orange: "from-orange-300 to-fuchsia-400",
  };
  return <div className="grid min-w-0 grid-cols-[minmax(88px,.9fr)_minmax(92px,1fr)_auto] items-center gap-2 rounded-xl border border-white/8 bg-black/18 px-3 py-2">
    <span className="truncate text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">{label}</span>
    <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-white/8"><div className={cx("h-full rounded-full bg-gradient-to-r", colors[tone] || colors.cyan)} style={{ width: `${pct}%` }} /></div>
    <span className="text-xs font-black text-white">{detail || value}</span>
  </div>;
}

function ProfileHudMetric({ icon: Icon, label, value, detail, tone: t = "cyan" }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3 shadow-inner shadow-black/25">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p>
        <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
      </div>
      {Icon && <div className={cx("shrink-0 rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div>}
    </div>
    {detail && <p className="mt-2 truncate text-xs font-bold text-slate-300">{detail}</p>}
  </div>;
}

function PlayerStatCard({ stat, maxDamage, maxVision, maxGold }) {
  const [selectedChampion, setSelectedChampion] = useState("");
  const [championsCollapsed, setChampionsCollapsed] = useState(true);
  const safeGames = Math.max(1, Number(stat.games || 0));
  const allRows = Array.from(stat.championRows?.values?.() || []).flat();
  const wins = allRows.filter((row) => row.match?.result === "Victoire").length;
  const losses = Math.max(0, Number(stat.games || allRows.length || 0) - wins);
  const winrate = Math.round((wins / Math.max(1, wins + losses || stat.games || 0)) * 100);
  const kda = ((stat.kills + stat.assists) / Math.max(1, stat.deaths)).toFixed(2);
  const avg = (value, decimals = 1) => (Number(value || 0) / safeGames).toFixed(decimals);
  const averageShare = (key) => {
    const values = allRows.map((row) => shareOfTeam(row, teamRows(row.match, "ALLY"), key)).filter((value) => Number.isFinite(value));
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  };
  const damageShare = averageShare("damage");
  const goldShare = averageShare("gold");
  const visionShare = averageShare("vision");
  const championStats = Array.from(stat.champions.entries())
    .map(([champion, count]) => {
      const rows = stat.championRows?.get(champion) || [];
      const totals = rows.reduce((total, row) => {
        total.kills += Number(row.kills || 0);
        total.deaths += Number(row.deaths || 0);
        total.assists += Number(row.assists || 0);
        total.damage += Number(row.damage || 0);
        total.gold += Number(row.gold || 0);
        total.vision += Number(row.vision || 0);
        total.kp += parsePercent(row.kill_participation || row.kp || 0);
        total.csPerMin += Number(row.cs_per_min || 0);
        return total;
      }, { kills: 0, deaths: 0, assists: 0, damage: 0, gold: 0, vision: 0, kp: 0, csPerMin: 0 });
      const championWins = rows.filter((row) => row.match?.result === "Victoire").length;
      const championLosses = Math.max(0, rows.length - championWins);
      const championGames = Math.max(1, rows.length);
      const csMilestones = csMilestoneSummary(rows);
      return {
        champion,
        count,
        rows,
        wins: championWins,
        losses: championLosses,
        winrate: Math.round((championWins / championGames) * 100),
        kda: ((totals.kills + totals.assists) / Math.max(1, totals.deaths)).toFixed(2),
        avgDamage: totals.damage / championGames,
        avgGold: totals.gold / championGames,
        avgVision: totals.vision / championGames,
        avgKp: totals.kp / championGames,
        avgCsPerMin: totals.csPerMin / championGames,
        csMilestones,
        totals,
      };
    })
    .sort((a, b) => b.count - a.count || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
  const selectedChampionStats = championStats.find((item) => item.champion === selectedChampion);
  const selectedRows = selectedChampionStats?.rows || [];
  const bestDamageRow = selectedRows.slice().sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0))[0];
  const csMilestones = csMilestoneSummary(allRows);
  const selectedCsMilestones = csMilestoneSummary(selectedRows);

  return <Surface glow className="p-4">
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">{roleLabel(stat.role || "ROLE")}</Badge>
          <Badge tone={winrate >= 50 ? "green" : "red"}>{wins}W - {losses}L</Badge>
        </div>
        <h3 className="mt-2 truncate text-2xl font-black text-white">{stat.name}</h3>
        <p className="mt-1 text-sm font-semibold text-slate-300">{stat.games} game{stat.games > 1 ? "s" : ""} importée{stat.games > 1 ? "s" : ""} · {championStats.length} champion{championStats.length > 1 ? "s" : ""} joué{championStats.length > 1 ? "s" : ""}</p>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <ProfileHudMetric icon={Trophy} label="WR" value={winrate + "%"} detail="Games importées" tone={winrate >= 50 ? "green" : "orange"} />
        <ProfileHudMetric icon={Swords} label="KDA" value={kda} detail={avg(stat.kills) + "/" + avg(stat.deaths) + "/" + avg(stat.assists) + " moy."} tone="cyan" />
        <ProfileHudMetric icon={Target} label="KP" value={avg(stat.kp) + "%"} detail="Participation kills" tone="purple" />
        <ProfileHudMetric icon={Gauge} label="CS/min" value={avg(stat.csPerMin)} detail="Farm moyen" tone="orange" />
        {csMilestones.samples > 0 && <ProfileHudMetric icon={Activity} label="CS 10 mins / 20 mins" value={`${csMilestones.at10 ?? "-"} / ${csMilestones.at20 ?? "-"}`} detail="Moyenne timeline" tone="green" />}
      </div>
    </div>

    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)]">
      <div className="grid gap-3">
        <StatMeter label="Dégâts moyens" value={stat.damage / safeGames} max={maxDamage} detail={formatPoints(stat.damage / safeGames)} tone="purple" />
        <StatMeter label="Gold moyen" value={stat.gold / safeGames} max={maxGold} detail={formatPoints(stat.gold / safeGames)} tone="orange" />
        <StatMeter label="Vision moyenne" value={stat.vision / safeGames} max={maxVision} detail={avg(stat.vision)} tone="cyan" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
        <ProfileHudMetric icon={Flame} label="Part dégâts" value={damageShare.toFixed(1) + "%"} detail="Moyenne équipe" tone="purple" />
        <ProfileHudMetric icon={Gauge} label="Part gold" value={goldShare.toFixed(1) + "%"} detail="Moyenne équipe" tone="orange" />
        <ProfileHudMetric icon={Eye} label="Part vision" value={visionShare.toFixed(1) + "%"} detail="Moyenne équipe" tone="cyan" />
      </div>
    </div>

    <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-gradient-to-br from-cyan-400/[0.075] via-black/24 to-fuchsia-400/[0.055] p-3">
      <button type="button" onClick={() => setChampionsCollapsed((value) => !value)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.055] px-3 py-3 text-left transition hover:border-cyan-300/28 hover:bg-cyan-400/10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="slate">{championStats.length} champion{championStats.length > 1 ? "s" : ""}</Badge></div>
          <h4 className="mt-2 truncate text-xl font-black text-white">Champions joués</h4>
        </div>
        <ChevronDown className={cx("h-5 w-5 shrink-0 text-cyan-100 transition", championsCollapsed && "-rotate-90")} />
      </button>
      {!championsCollapsed && (championStats.length ? <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/24 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-200">Pool du profil</p>
            {selectedChampionStats && <button type="button" onClick={() => setSelectedChampion("")} className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:text-white">Fermer</button>}
          </div>
          <div className="grid max-h-[22rem] gap-2 overflow-auto pr-1">
            {championStats.map((item, index) => {
              const active = selectedChampion === item.champion;
              const topPick = index === 0;
              return <button key={item.champion} type="button" onClick={() => setSelectedChampion(active ? "" : item.champion)} className={cx("group flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-400/10", active ? "border-cyan-200/55 bg-cyan-400/14 shadow-[0_0_26px_rgba(34,211,238,.14)]" : "border-white/10 bg-white/[0.035]")}>
                <ChampionPortrait champion={item.champion} alt={item.champion} className="h-12 w-12 shrink-0 rounded-xl border border-white/10 object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-white">{championDisplayName(item.champion)}</p>
                    {topPick && <Badge tone="purple">Top pick</Badge>}
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-200">{item.count} game{item.count > 1 ? "s" : ""} · {item.wins}W - {item.losses}L · KDA {item.kda}{item.csMilestones?.samples > 0 ? ` · CS10/20 ${item.csMilestones.at10 ?? "-"}/${item.csMilestones.at20 ?? "-"}` : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cx("text-lg font-black", item.winrate >= 50 ? "text-emerald-100" : "text-rose-100")}>{item.winrate}%</p>
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-300">WR</p>
                </div>
              </button>;
            })}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/24 p-4">
          {selectedChampionStats ? <div className="min-w-0">
            <div className="relative min-h-[150px] overflow-hidden rounded-2xl border border-cyan-200/16 bg-cyan-400/[0.055] p-4">
              <ChampionBackdrop champion={selectedChampionStats.champion} />
              <div className="relative z-10 flex min-w-0 items-center gap-4">
                <ChampionPortrait champion={selectedChampionStats.champion} alt={selectedChampionStats.champion} className="h-20 w-20 shrink-0 rounded-2xl border border-cyan-200/25 object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black text-white">{championDisplayName(selectedChampionStats.champion)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{selectedRows.length} game{selectedRows.length > 1 ? "s" : ""} · {selectedChampionStats.wins}W - {selectedChampionStats.losses}L</p>
                  <div className="mt-3 flex flex-wrap gap-2">{championStyleTags(selectedChampionStats.champion).slice(0, 3).map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-5">
              <ProfileHudMetric label="WR" value={selectedChampionStats.winrate + "%"} detail="Champion" tone={selectedChampionStats.winrate >= 50 ? "green" : "orange"} />
              <ProfileHudMetric label="KDA" value={selectedChampionStats.kda} detail={`${selectedChampionStats.totals.kills}/${selectedChampionStats.totals.deaths}/${selectedChampionStats.totals.assists}`} tone="cyan" />
              <ProfileHudMetric label="KP" value={selectedChampionStats.avgKp.toFixed(0) + "%"} detail="Moyenne" tone="purple" />
              <ProfileHudMetric label="CS/min" value={selectedChampionStats.avgCsPerMin.toFixed(1)} detail="Moyenne" tone="orange" />
              {selectedCsMilestones.samples > 0 && <ProfileHudMetric label="CS 10 mins / 20 mins" value={`${selectedCsMilestones.at10 ?? "-"} / ${selectedCsMilestones.at20 ?? "-"}`} detail="Timeline" tone="green" />}
            </div>
            {bestDamageRow && <p className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/8 px-3 py-2 text-xs font-bold text-cyan-50">Meilleure game dégâts : {formatPoints(bestDamageRow.damage)} sur {matchDisplayName(bestDamageRow.match, "game inconnue")} · {bestDamageRow.match?.game_id || "game inconnue"}</p>}
          </div> : <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/18 p-5 text-center">
            <Crown className="h-10 w-10 text-cyan-100" />
            <h4 className="mt-4 text-xl font-black text-white">Sélectionne un champion</h4>
            <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-200">Le détail s’ouvre ici avec ses games, ses moyennes et ses tags de style.</p>
          </div>}
        </div>
      </div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm font-semibold text-slate-300">Pas encore de champion sur les games importées.</div>)}
    </div>

    <AnimatePresence initial={false}>{!championsCollapsed && selectedChampionStats && <motion.div key={selectedChampionStats.champion} initial={{ height: 0, opacity: 0, y: -8 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: "easeOut" }} className="overflow-hidden">
      <div className="mt-4 rounded-3xl border border-fuchsia-300/16 bg-fuchsia-400/[0.045] p-4 shadow-[0_0_35px_rgba(217,70,239,.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><Badge tone="purple">Games du champion</Badge><h4 className="mt-3 text-xl font-black text-white">{championDisplayName(selectedChampionStats.champion)}</h4></div>
          <Badge tone="slate">{selectedRows.length} ligne{selectedRows.length > 1 ? "s" : ""}</Badge>
        </div>
        <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
          {selectedRows.slice().sort((a, b) => String(b.match?.created_at || b.match?.game_date || b.match?.game_id || "").localeCompare(String(a.match?.created_at || a.match?.game_date || a.match?.game_id || ""))).map((row, index) => {
            const enemy = (row.match?.participants || []).find((item) => item.team_key === "ENEMY" && String(item.role || "").toUpperCase() === String(row.role || stat.role || "").toUpperCase());
            return <div key={(row.id || row.match?.id || row.match?.game_id || "game") + "-" + index} className="grid gap-3 rounded-2xl border border-white/10 bg-black/28 p-3 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.3fr)_minmax(120px,.7fr)_repeat(5,minmax(70px,.5fr))] 2xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge tone={row.match?.result === "Victoire" ? "green" : "red"}>{row.match?.result || "Game"}</Badge><Badge tone={row.match?.side === "Blue" ? "blue" : "red"}>{row.match?.side || row.role || "Side ?"}</Badge></div>
              <p className="mt-2 truncate text-sm font-black text-white">{matchDisplayName(row.match, "Game")}</p>
              <p className="truncate text-xs font-semibold text-slate-300">{row.match?.game_id || "Game ID inconnu"} · {row.match?.duration || "--:--"}</p>
            </div>
            <div className="min-w-0"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">Adversaire</p><div className="mt-1 flex min-w-0 items-center gap-2">{enemy?.champion && <ChampionPortrait champion={enemy.champion} alt={enemy.champion} className="h-7 w-7 shrink-0 rounded-lg border border-white/10 object-cover" />}<p className="truncate font-black text-white">{enemy?.champion ? `vs ${championDisplayName(enemy.champion)}` : "Non reconnu"}</p></div></div>
            <div><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">KDA</p><p className="font-black text-white">{row.kills || 0}/{row.deaths || 0}/{row.assists || 0}</p></div>
            <div><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">KP</p><p className="font-black text-white">{Math.round(parsePercent(row.kill_participation || row.kp || 0))}%</p></div>
            <div><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">Dégâts</p><p className="font-black text-white">{formatPoints(row.damage)}</p></div>
            <div><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">Gold</p><p className="font-black text-white">{formatPoints(row.gold)}</p></div>
            <div><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-300">Vision</p><p className="font-black text-white">{row.vision || 0}</p></div>
          </div>;
          })}
        </div>
      </div>
    </motion.div>}</AnimatePresence>
  </Surface>;
}

function itemIconSources(itemId) {
  const id = Number(itemId || 0);
  if (!id) return [];
  return [...new Set([
    ...DDRAGON_FALLBACK_VERSIONS.map((version) => assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`)),
    assetProxyUrl(`https://raw.communitydragon.org/latest/game/assets/items/icons2d/${id}.png`),
    assetProxyUrl(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/${id}.png`),
  ])];
}

function itemIconUrl(itemId) {
  return itemIconSources(itemId)[0] || "";
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const SUMMONER_SPELLS = {
  1: "SummonerBoost",
  3: "SummonerExhaust",
  4: "SummonerFlash",
  6: "SummonerHaste",
  7: "SummonerHeal",
  11: "SummonerSmite",
  12: "SummonerTeleport",
  13: "SummonerMana",
  14: "SummonerDot",
  21: "SummonerBarrier",
  32: "SummonerSnowball",
};

function summonerSpellIconSources(spellId) {
  const name = SUMMONER_SPELLS[Number(spellId || 0)];
  if (!name) return [];
  return [...new Set([
    ...DDRAGON_FALLBACK_VERSIONS.map((version) => assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${name}.png`)),
    assetProxyUrl(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/${name.toLowerCase()}.png`),
  ])];
}

function summonerSpellIconUrl(spellId) {
  return summonerSpellIconSources(spellId)[0] || "";
}

function participantStoredRaw(row) {
  const raw = typeof row?.raw === "string" ? safeJsonParse(row.raw, {}) : row?.raw || {};
  return raw;
}

function participantRaw(row) {
  const raw = participantStoredRaw(row);
  return raw?.participant || raw?.stats || raw;
}

function itemIndexFromKey(key) {
  const match = String(key).match(/^item([0-6])(?:Id)?$/i);
  return match ? Number(match[1]) : null;
}

function participantSources(row) {
  const raw = participantStoredRaw(row);
  return [row, raw, raw?.participant, raw?.stats, raw?.participant?.stats, raw?.challenges, raw?.participant?.challenges, participantRaw(row)].filter((source, index, list) => source && list.indexOf(source) === index);
}

function participantNumber(row, ...keys) {
  const sources = participantSources(row);
  for (const source of sources) {
    for (const key of keys) {
      const value = Number(source?.[key] ?? 0);
      if (value) return value;
    }
  }
  for (const key of keys) {
    const itemIndex = itemIndexFromKey(key);
    if (itemIndex !== null) {
      for (const source of sources) {
        const value = Number(source?.items?.[itemIndex] ?? source?.itemIds?.[itemIndex] ?? source?.stats?.items?.[itemIndex] ?? source?.stats?.itemIds?.[itemIndex] ?? source?.participant?.items?.[itemIndex] ?? source?.participant?.itemIds?.[itemIndex] ?? source?.participant?.stats?.items?.[itemIndex] ?? source?.participant?.stats?.itemIds?.[itemIndex] ?? 0);
        if (value) return value;
      }
    }
  }
  return 0;
}

function itemSlots(row) {
  return [0, 1, 2, 3, 4, 5].map((index) => participantNumber(row, `item${index}`, `item${index}Id`));
}

function trinketItemId(row) {
  return participantNumber(row, "item6", "item6Id", "trinket", "trinketItemId");
}

function finalBuildItems(row) {
  const trinket = trinketItemId(row);
  return [
    ...itemSlots(row).filter(Boolean).map((id) => ({ id, type: "item" })),
    ...(trinket ? [{ id: trinket, type: "trinket" }] : []),
  ];
}

function matchTimelineFrames(match) {
  return match?.raw?.timeline?.info?.frames
    || match?.raw?.metadata?.timeline?.info?.frames
    || match?.raw?.timeline?.frames
    || match?.raw?.timeline?.timeline?.info?.frames
    || match?.raw?.timeline?.timeline?.frames
    || [];
}

function itemEventMeta(type) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "ITEM_PURCHASED") return { label: "Achat", toneName: "cyan" };
  if (normalized === "ITEM_SOLD") return { label: "Vente", toneName: "orange" };
  if (normalized === "ITEM_DESTROYED") return { label: "Consommé", toneName: "purple" };
  if (normalized === "ITEM_UNDO") return { label: "Annulé", toneName: "pink" };
  return { label: "Item", toneName: "cyan" };
}

function itemBuildTimeline(row) {
  const participantId = rowParticipantId(row);
  if (!participantId) return [];
  return matchTimelineFrames(row?.match).flatMap((frame) => (frame.events || [])
    .filter((event) => ["ITEM_PURCHASED", "ITEM_SOLD", "ITEM_DESTROYED", "ITEM_UNDO"].includes(String(event.type || "").toUpperCase()))
    .filter((event) => Number(event.participantId || event.creatorId || 0) === participantId)
    .map((event) => {
      const meta = itemEventMeta(event.type);
      const itemId = Number(event.itemId || event.beforeId || event.afterId || 0);
      if (!itemId) return null;
      const timestamp = Number(event.timestamp || frame.timestamp || 0);
      const secondaryId = Number(event.type === "ITEM_UNDO" ? event.afterId || 0 : 0);
      return {
        ...meta,
        itemId,
        secondaryId: secondaryId && secondaryId !== itemId ? secondaryId : 0,
        timestamp,
        time: formatCountdown(Math.floor(timestamp / 1000)),
      };
    })
    .filter(Boolean)).sort((a, b) => a.timestamp - b.timestamp);
}

function summonerSpellIds(row) {
  const sources = participantSources(row);
  const spellFromList = (index) => {
    for (const source of sources) {
      const value = Number(source?.summonerSpells?.[index] ?? source?.spells?.[index] ?? source?.stats?.summonerSpells?.[index] ?? source?.stats?.spells?.[index] ?? 0);
      if (value) return value;
    }
    return 0;
  };
  const first = participantNumber(row, "summoner1Id", "spell1Id") || spellFromList(0);
  const second = participantNumber(row, "summoner2Id", "spell2Id") || spellFromList(1);
  return [first, second].filter(Boolean);
}

function parsePercent(value) {
  if (typeof value === "string" && value.includes("%")) return Number(value.replace("%", "")) || 0;
  return Number(value || 0) * (Number(value || 0) <= 1 ? 100 : 1);
}

function statValue(row, key, fallback = 0) {
  return Number(row?.[key] ?? row?.raw?.[key] ?? fallback) || 0;
}

function creepScore(row) {
  const raw = participantRaw(row);
  const combined = Number(raw?.totalMinionsKilled || 0) + Number(raw?.neutralMinionsKilled || 0);
  return Number(row?.cs ?? row?.creep_score ?? row?.total_cs ?? (combined || raw?.totalMinionsKilled || raw?.neutralMinionsKilled || 0)) || 0;
}

function statPerMinute(row, key) {
  const duration = Number(row?.matchDuration || row?.raw?.timePlayed || row?.raw?.gameDuration || 0) / 60;
  return duration > 0 ? statValue(row, key) / duration : 0;
}

function teamRows(match, team = "ALLY") {
  return (match?.participants || []).filter((row) => row.team_key === team);
}

function sumRows(rows, key) {
  return rows.reduce((total, row) => total + statValue(row, key), 0);
}

function shareOfTeam(row, rows, key) {
  return (statValue(row, key) / Math.max(1, sumRows(rows, key))) * 100;
}

function rowParticipantId(row) {
  return Number(row?.raw?.participantId || row?.participantId || 0);
}

function csAtMinute(row, minute) {
  const participantId = rowParticipantId(row);
  const frames = row?.match?.raw?.timeline?.info?.frames || row?.match?.raw?.metadata?.timeline?.info?.frames || row?.match?.raw?.timeline?.frames || [];
  const target = Number(minute || 0) * 60 * 1000;
  if (!participantId) return null;
  if (!frames.length) {
    const summary = row?.match?.raw?.nxt5?.timelineSummary?.csMilestones?.[String(participantId)];
    const key = `cs${minute}`;
    const value = summary?.[key];
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }
  const frame = frames.find((item) => Number(item.timestamp || 0) >= target) || frames[frames.length - 1];
  const participantFrame = frame?.participantFrames?.[String(participantId)] || frame?.participantFrames?.[participantId];
  if (!participantFrame) return null;
  return Number(participantFrame.minionsKilled || 0) + Number(participantFrame.jungleMinionsKilled || 0);
}

function csMilestoneSummary(rows = []) {
  const valuesAt = (minute) => rows.map((row) => csAtMinute(row, minute)).filter((value) => Number.isFinite(value));
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const at10 = valuesAt(10);
  const at20 = valuesAt(20);
  return { at10: average(at10), at20: average(at20), samples: Math.max(at10.length, at20.length) };
}

function objectiveValue(match, name) {
  const rawTeam = match?.raw?.info?.teams?.find((team) => {
    const ally = teamRows(match, "ALLY")[0];
    return ally && Number(team.teamId) === Number(ally.raw?.teamId);
  });
  return Number(rawTeam?.objectives?.[name]?.kills || 0);
}

function objectiveEventLabel(event) {
  const monster = String(event?.monsterType || "").toUpperCase();
  const subtype = String(event?.monsterSubType || "").toUpperCase().replace("HEXTECH", "HEXTECH");
  if (monster === "DRAGON") {
    const element = subtype.replace("_DRAGON", "").replace(/_/g, " ").toLowerCase();
    return element ? `${element.charAt(0).toUpperCase()}${element.slice(1)} Dragon` : "Dragon";
  }
  if (monster === "BARON_NASHOR") return "Nashor";
  if (monster === "RIFTHERALD") return "Herald";
  if (monster === "HORDE") return "Void Grubs";
  return monster ? monster.replace(/_/g, " ") : "Objectif";
}

function objectiveEventTone(event) {
  const label = objectiveEventLabel(event).toLowerCase();
  if (label.includes("nashor")) return "purple";
  if (label.includes("herald") || label.includes("grub")) return "pink";
  if (label.includes("infernal")) return "red";
  if (label.includes("ocean")) return "cyan";
  if (label.includes("mountain")) return "slate";
  if (label.includes("cloud")) return "blue";
  if (label.includes("chemtech")) return "green";
  if (label.includes("hextech")) return "purple";
  return "cyan";
}

function objectiveEventType(event) {
  const label = objectiveEventLabel(event).toLowerCase();
  if (label.includes("nashor")) return "baron";
  if (label.includes("herald")) return "herald";
  if (label.includes("grub")) return "grub";
  if (label.includes("tower") || label.includes("tour")) return "tower";
  return "dragon";
}

function objectiveEventIcon(event) {
  const label = objectiveEventLabel(event).toLowerCase();
  if (label.includes("nashor")) return "N";
  if (label.includes("herald")) return "H";
  if (label.includes("grub")) return "G";
  if (label.includes("infernal")) return "F";
  if (label.includes("ocean")) return "O";
  if (label.includes("mountain")) return "M";
  if (label.includes("cloud")) return "C";
  if (label.includes("chemtech")) return "CH";
  if (label.includes("hextech")) return "HX";
  return "D";
}

function objectiveDragonElementKey(event) {
  const subtype = String(event?.monsterSubType || event?.dragonType || event?.element || "").toUpperCase();
  const label = objectiveEventLabel(event).toLowerCase();
  const source = `${subtype} ${label}`;
  if (source.includes("ELDER")) return "elder";
  if (source.includes("FIRE") || source.includes("INFERNAL")) return "fire";
  if (source.includes("WATER") || source.includes("OCEAN")) return "water";
  if (source.includes("EARTH") || source.includes("MOUNTAIN")) return "earth";
  if (source.includes("AIR") || source.includes("CLOUD")) return "air";
  if (source.includes("CHEMTECH")) return "chemtech";
  if (source.includes("HEXTECH")) return "hextech";
  return "";
}

function objectiveDragonIconType(event) {
  const key = objectiveDragonElementKey(event);
  return key ? `dragon-${key}` : "dragon";
}

function objectivePictogramType(event) {
  const type = objectiveEventType(event);
  return type === "dragon" ? objectiveDragonIconType(event) : type;
}

function objectiveEvents(match) {
  const frames = match?.raw?.timeline?.info?.frames || match?.raw?.metadata?.timeline?.info?.frames || match?.raw?.timeline?.frames || [];
  const participants = match?.raw?.info?.participants || [];
  const participantTeam = new Map(participants.map((participant) => [Number(participant.participantId), Number(participant.teamId)]));
  const allyTeamId = Number(teamRows(match, "ALLY")[0]?.raw?.teamId || 0);
  return frames.flatMap((frame) => (frame.events || []).filter((event) => event.type === "ELITE_MONSTER_KILL").map((event) => {
    const killerTeamId = Number(event.killerTeamId || participantTeam.get(Number(event.killerId)) || 0);
    return {
      ...event,
      teamKey: killerTeamId && allyTeamId && killerTeamId === allyTeamId ? "ALLY" : "ENEMY",
      side: killerTeamId === 100 ? "BLUE" : killerTeamId === 200 ? "RED" : "",
      time: formatCountdown(Math.floor(Number(event.timestamp || 0) / 1000)),
      label: objectiveEventLabel(event),
    };
  })).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
}

function objectiveTeamId(match, teamKey) {
  return Number(teamRows(match, teamKey)[0]?.raw?.teamId || 0);
}

function objectiveTeamValue(match, name, teamKey) {
  const teamId = objectiveTeamId(match, teamKey);
  const rawTeam = match?.raw?.info?.teams?.find((team) => Number(team.teamId) === teamId);
  const objectives = rawTeam?.objectives || {};
  const direct = objectives?.[name]?.kills;
  if (direct !== undefined && direct !== null) return Number(direct || 0);
  const normalized = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const found = Object.entries(objectives).find(([key]) => String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
  return Number(found?.[1]?.kills || 0);
}

function objectiveTeamAnyValue(match, teamKey, names) {
  return Math.max(0, ...names.map((name) => objectiveTeamValue(match, name, teamKey)));
}

function objectiveTeamKeyForSide(match, side) {
  const targetTeamId = side === "BLUE" ? 100 : 200;
  const exact = ["ALLY", "ENEMY"].find((teamKey) => objectiveTeamId(match, teamKey) === targetTeamId);
  if (exact) return exact;
  const allySide = String(match?.side || "").toUpperCase().startsWith("BLUE") ? "BLUE" : String(match?.side || "").toUpperCase().startsWith("RED") ? "RED" : "";
  if (allySide) return side === allySide ? "ALLY" : "ENEMY";
  return side === "BLUE" ? "ALLY" : "ENEMY";
}

function objectiveDragonElement(event) {
  const labels = {
    fire: "Infernal",
    water: "Océan",
    earth: "Montagne",
    air: "Nuage",
    chemtech: "Chemtech",
    hextech: "Hextech",
    elder: "Ancestral",
  };
  const key = objectiveDragonElementKey(event);
  if (labels[key]) return labels[key];
  const label = objectiveEventLabel(event).replace(/\s*Dragon$/i, "").trim();
  return label && label.toLowerCase() !== "dragon" ? label : "Dragon";
}

function objectiveTeamSummary(match, teamKey) {
  const events = objectiveEvents(match);
  const teamEvents = events.filter((event) => event.teamKey === teamKey);
  const dragons = teamEvents.filter((event) => objectiveEventType(event) === "dragon");
  const rawDragons = objectiveTeamAnyValue(match, teamKey, ["dragon"]);
  const rawGrubs = objectiveTeamAnyValue(match, teamKey, ["horde", "voidgrub", "voidGrubs", "grub", "grubs"]);
  const rawHeralds = objectiveTeamAnyValue(match, teamKey, ["riftHerald", "riftHeralds", "herald"]);
  const rawBarons = objectiveTeamAnyValue(match, teamKey, ["baron", "baronNashor"]);
  const rawTowers = objectiveTeamAnyValue(match, teamKey, ["tower", "towers"]);
  if (events.length) {
    return {
      dragons,
      dragonCount: Math.max(dragons.length, rawDragons),
      grubs: Math.max(teamEvents.filter((event) => objectiveEventType(event) === "grub").length, rawGrubs),
      heralds: Math.max(teamEvents.filter((event) => objectiveEventType(event) === "herald").length, rawHeralds),
      barons: Math.max(teamEvents.filter((event) => objectiveEventType(event) === "baron").length, rawBarons),
      towers: rawTowers,
    };
  }
  return {
    dragons: [],
    dragonCount: rawDragons,
    grubs: rawGrubs,
    heralds: rawHeralds,
    barons: rawBarons,
    towers: rawTowers,
  };
}

const OBJECTIVE_ICON_SOURCES = {
  dragon: [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle.png",
    "/assets/objectives/dragon.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon/hud/dragon_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon.png",
  ],
  "dragon-fire": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_fire.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_fire/hud/dragon_circle_fire.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_fire/hud/dragon_circle_fire.png",
  ],
  "dragon-water": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_water.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_water/hud/dragon_circle_water.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_water/hud/dragon_circle_water.png",
  ],
  "dragon-earth": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_earth.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_earth/hud/dragon_circle_earth.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_earth/hud/dragon_circle_earth.png",
  ],
  "dragon-air": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_air.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_air/hud/dragon_air_circle.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_air/hud/dragon_air_circle.png",
  ],
  "dragon-chemtech": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_chemtech.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_chemtech/hud/icons2d/dragon_circle_chemtech.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_chemtech/hud/icons2d/dragon_circle_chemtech.png",
  ],
  "dragon-hextech": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_hextech.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_hextech/hud/icons2d/dragon_circle_hextech.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_dragon_hextech/hud/icons2d/dragon_circle_hextech.png",
  ],
  "dragon-elder": [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/dragon_circle_elder.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_dragon_elder/hud/dragon_circle_elder.png",
  ],
  baron: [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/baron_circle.png",
    "/assets/objectives/baron.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_baron/hud/baron_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/baron.png",
  ],
  grub: [
    "https://raw.communitydragon.org/latest/game/assets/ux/announcements/sru_voidgrub_circle.png",
    "/assets/objectives/grub.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_horde/hud/sru_voidgrub_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_voidgrub/hud/sru_voidgrub_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/voidgrub.png",
  ],
  herald: [
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_riftherald/hud/sruriftherald_circle.srt_2024_strategy_differentiation_preseason.png",
    "https://raw.communitydragon.org/pbe/game/assets/characters/sru_riftherald/hud/sruriftherald_circle.srt_2024_strategy_differentiation_preseason.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/sru_riftherald/hud/sruriftherald_circle.png",
  ],
  tower: [
    "/assets/objectives/tower.png",
    "https://raw.communitydragon.org/latest/game/assets/characters/turret/hud/turret_blue_circle.png",
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/turret.png",
  ],
};

function ObjectivePictogram({ type, className = "", fallback = "O" }) {
  const sources = OBJECTIVE_ICON_SOURCES[type] || OBJECTIVE_ICON_SOURCES.dragon;
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [type]);
  const source = sources[sourceIndex];
  if (!source) return <ObjectiveFallbackIcon type={type} fallback={fallback} className={className} />;
  return <img src={source} alt="" className={cx("object-contain drop-shadow-[0_0_10px_rgba(255,255,255,.2)]", className)} loading="lazy" onError={() => setSourceIndex((index) => index + 1)} />;
}

function ObjectiveFallbackIcon({ type, fallback = "O", className = "" }) {
  const config = {
    "dragon-fire": ["#fb923c", "#ef4444", "F"],
    "dragon-water": ["#67e8f9", "#2563eb", "O"],
    "dragon-earth": ["#d6d3d1", "#78716c", "M"],
    "dragon-air": ["#bfdbfe", "#38bdf8", "A"],
    "dragon-chemtech": ["#86efac", "#16a34a", "C"],
    "dragon-hextech": ["#c084fc", "#2563eb", "H"],
    "dragon-elder": ["#f0abfc", "#7c3aed", "E"],
  }[type] || ["#dffaff", "#0891b2", fallback];
  const [start, end, text] = config;
  return <span className={cx("inline-flex items-center justify-center rounded-full border border-white/20 text-[0.58rem] font-black text-white shadow-[0_0_16px_rgba(255,255,255,.16)]", className)} style={{ background: `radial-gradient(circle at 35% 25%, ${start}, ${end} 70%)` }}>{text}</span>;
}

function objectiveSummaryHasData(data) {
  return Boolean(data && (data.dragonCount || data.grubs || data.heralds || data.barons || data.towers || data.dragons?.length));
}

function ObjectiveTeamCard({ match, teamKey, side, title, toneName, data: providedData }) {
  const data = providedData || objectiveTeamSummary(match, teamKey);
  const stats = [
    ["Dragons", data.dragonCount, "dragon", "cyan"],
    ["Grubs", data.grubs, "grub", "green"],
    ["Herald", data.heralds, "herald", "pink"],
    ["Nashor", data.barons, "baron", "purple"],
    ["Tours", data.towers, "tower", "blue"],
  ];
  return <div className={cx("min-w-0 rounded-2xl p-3", side === "BLUE" ? "bg-cyan-400/[0.055]" : "bg-rose-500/[0.055]")}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <Badge tone={toneName}>{title}</Badge>
      <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">{data.dragonCount} drake{data.dragonCount > 1 ? "s" : ""}</span>
    </div>
    <div className="grid grid-cols-5 gap-1.5">
      {stats.map(([label, value, icon, t]) => <div key={label} className="min-w-0 rounded-xl bg-black/18 px-1.5 py-2 text-center ring-1 ring-white/[0.045]">
        <span className={cx("mx-auto flex h-8 w-8 items-center justify-center rounded-lg", tone(t))}><ObjectivePictogram type={icon} fallback={String(label).charAt(0)} className="h-5 w-5" /></span>
        <p className="mt-1 text-[0.52rem] font-black uppercase tracking-[0.08em] text-slate-300">{label}</p>
        <p className="text-sm font-black text-white">{value}</p>
      </div>)}
    </div>
    {data.dragons.length > 0 && <div className="mt-3 rounded-xl bg-black/18 p-2 ring-1 ring-white/[0.045]">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-slate-300">Éléments dragons</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {data.dragons.map((event, index) => <span key={`${teamKey}-dragon-${event.timestamp}-${index}`} className={cx("inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[0.62rem] font-black text-white", tone(objectiveEventTone(event)))}>
          <ObjectivePictogram type={objectiveDragonIconType(event)} fallback={objectiveEventIcon(event)} className="h-4 w-4" />
          {objectiveDragonElement(event)}
          <span className="text-white/65">{event.time}</span>
        </span>)}
      </div>
    </div>}
  </div>;
}

function ObjectiveHud({ match, compact = false }) {
  const events = objectiveEvents(match);
  const blueTeamKey = objectiveTeamKeyForSide(match, "BLUE");
  const redTeamKey = objectiveTeamKeyForSide(match, "RED");
  const blueData = objectiveTeamSummary(match, blueTeamKey);
  const redData = objectiveTeamSummary(match, redTeamKey);
  if (!events.length && !objectiveSummaryHasData(blueData) && !objectiveSummaryHasData(redData)) return null;
  return <div className={cx("rounded-[1.25rem] bg-gradient-to-br from-cyan-400/[0.045] via-black/12 to-fuchsia-400/[0.04] p-3 ring-1 ring-cyan-200/[0.06]", compact ? "mb-3" : "mt-4")}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Badge tone="cyan">Objectifs</Badge>{events.length > 0 && <Badge tone="green">{events.length} actions</Badge>}</div>
      {events.length > 0 && <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Dragons détaillés par élément</span>}
    </div>
    <div className="grid gap-2 xl:grid-cols-2">
      <ObjectiveTeamCard match={match} teamKey={blueTeamKey} side="BLUE" title="Côté bleu" toneName="cyan" data={blueData} />
      <ObjectiveTeamCard match={match} teamKey={redTeamKey} side="RED" title="Côté rouge" toneName="red" data={redData} />
    </div>
    {events.length ? <>
      <div className="nxt5-objective-timeline mt-3 overflow-x-auto overflow-y-hidden pb-2">
        <div className="relative flex w-max min-w-full items-stretch gap-0 px-4 py-2">
          <div className="absolute left-8 right-8 top-[2.35rem] h-px bg-gradient-to-r from-cyan-200/18 via-white/18 to-rose-200/18" />
          {events.map((event, index) => {
            const isRed = event.side === "RED";
            return <div key={`${event.timestamp}-${index}`} className="relative z-10 flex shrink-0 items-center">
              <div className="w-[7.75rem] sm:w-[8.75rem] lg:w-[9.25rem]">
                <div className="flex flex-col items-center text-center">
                  <span className={cx("mb-2 rounded-full border px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.14em]", isRed ? "border-rose-200/24 bg-rose-500/10 text-rose-100" : "border-cyan-200/24 bg-cyan-400/10 text-cyan-100")}>{event.time}</span>
                  <span className={cx("relative flex h-12 w-12 items-center justify-center rounded-2xl ring-2 ring-[#060a18]", tone(objectiveEventTone(event)))}>
                    <ObjectivePictogram type={objectivePictogramType(event)} fallback={objectiveEventIcon(event)} className="h-8 w-8" />
                  </span>
                  <p className="mt-2 max-w-[7.2rem] truncate text-[0.68rem] font-black text-white sm:max-w-[8.25rem] sm:text-xs">{event.label}</p>
                  <p className={cx("mt-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em]", isRed ? "text-rose-100/75" : "text-cyan-100/75")}>{isRed ? "Côté rouge" : "Côté bleu"}</p>
                </div>
              </div>
              {index < events.length - 1 && <div className="relative -mx-2 flex w-6 shrink-0 items-center justify-center sm:-mx-1 sm:w-10">
                <span className="h-px flex-1 bg-gradient-to-r from-white/18 to-white/5" />
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300/75" />
              </div>}
            </div>;
          })}
        </div>
      </div>
    </> : null}
  </div>;
}

function roleScore(row) {
  const kda = (statValue(row, "kills") + statValue(row, "assists")) / Math.max(1, statValue(row, "deaths"));
  const kp = parsePercent(row.kill_participation || row.kp);
  return statValue(row, "damage") / 1000 + statValue(row, "gold") / 1000 + statValue(row, "vision") * 0.4 + kda * 6 + kp * 0.2;
}

function diffTone(value) {
  return Number(value || 0) >= 0 ? "green" : "red";
}

function timelineFrames(match) {
  return match?.raw?.timeline?.info?.frames || match?.raw?.metadata?.timeline?.info?.frames || match?.raw?.timeline?.frames || [];
}

function participantTeamMap(match) {
  return new Map((match?.raw?.info?.participants || []).map((participant) => [Number(participant.participantId), Number(participant.teamId)]));
}

function teamKeyFromTeamId(match, teamId) {
  const allyTeamId = objectiveTeamId(match, "ALLY");
  const enemyTeamId = objectiveTeamId(match, "ENEMY");
  if (Number(teamId || 0) === allyTeamId) return "ALLY";
  if (Number(teamId || 0) === enemyTeamId) return "ENEMY";
  return "";
}

function rowByParticipantId(match, participantId) {
  const id = Number(participantId || 0);
  return (match?.participants || []).find((row) => rowParticipantId(row) === id) || null;
}

function championKillEvents(match) {
  const teams = participantTeamMap(match);
  return timelineFrames(match).flatMap((frame) => (frame.events || []).filter((event) => event.type === "CHAMPION_KILL").map((event) => {
    const killerId = Number(event.killerId || 0);
    const victimId = Number(event.victimId || 0);
    const killerTeam = teamKeyFromTeamId(match, teams.get(killerId));
    const victimTeam = teamKeyFromTeamId(match, teams.get(victimId));
    const victim = rowByParticipantId(match, victimId);
    const killer = rowByParticipantId(match, killerId);
    return { ...event, killerId, victimId, killerTeam, victimTeam, victim, killer, timestamp: Number(event.timestamp || frame.timestamp || 0), time: formatCountdown(Math.floor(Number(event.timestamp || frame.timestamp || 0) / 1000)), shutdown: Number(event.shutdownBounty || event.bounty || 0) };
  })).sort((a, b) => a.timestamp - b.timestamp);
}

function buildingEvents(match) {
  const teams = participantTeamMap(match);
  return timelineFrames(match).flatMap((frame) => (frame.events || []).filter((event) => event.type === "BUILDING_KILL").map((event) => {
    const killerId = Number(event.killerId || 0);
    const teamKey = teamKeyFromTeamId(match, teams.get(killerId) || event.teamId);
    return { ...event, teamKey: teamKey || (Number(event.teamId) === objectiveTeamId(match, "ALLY") ? "ENEMY" : "ALLY"), timestamp: Number(event.timestamp || frame.timestamp || 0), time: formatCountdown(Math.floor(Number(event.timestamp || frame.timestamp || 0) / 1000)), label: String(event.buildingType || "Tour").replace("TOWER_BUILDING", "Tour").replace(/_/g, " ") };
  })).sort((a, b) => a.timestamp - b.timestamp);
}

function teamGoldAtMinute(match, teamKey, minute) {
  const frame = timelineFrames(match).find((item) => Number(item.timestamp || 0) >= minute * 60 * 1000);
  const ids = new Set(teamRows(match, teamKey).map(rowParticipantId).filter(Boolean));
  if (!frame || !ids.size) return null;
  return Object.entries(frame.participantFrames || {}).reduce((total, [id, data]) => ids.has(Number(id)) ? total + Number(data.totalGold || 0) : total, 0);
}

function timelineStatus(match) {
  const frames = timelineFrames(match);
  return frames.length ? { label: "Timeline fiable", toneName: "green", detail: `${frames.length} frames Riot` } : { label: "Timeline absente", toneName: "yellow", detail: "Lecture limitée aux stats finales" };
}

function deathContext(match) {
  const kills = championKillEvents(match);
  const objectives = objectiveEvents(match);
  const allyDeaths = kills.filter((event) => event.victimTeam === "ALLY");
  const beforeObjectives = allyDeaths.filter((death) => objectives.some((objective) => objective.timestamp > death.timestamp && objective.timestamp - death.timestamp <= 90000));
  const shutdowns = allyDeaths.filter((death) => death.shutdown >= 300);
  const repeated = Array.from(allyDeaths.reduce((map, death) => {
    const key = death.victim?.summoner_name || death.victim?.riot_id || death.victim?.champion || "Joueur";
    const current = map.get(key) || { name: key, champion: death.victim?.champion, deaths: 0 };
    current.deaths += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.deaths - a.deaths);
  const isolated = allyDeaths.filter((death) => {
    const allyTrade = kills.some((kill) => kill.killerTeam === "ALLY" && Math.abs(kill.timestamp - death.timestamp) <= 15000);
    return !allyTrade && (death.assistingParticipantIds || []).length <= 1;
  });
  return { allyDeaths, beforeObjectives, shutdowns, repeated, isolated };
}

function objectiveContext(match) {
  const kills = championKillEvents(match);
  return objectiveEvents(match).map((objective) => {
    const previousKill = kills.slice().reverse().find((kill) => kill.timestamp < objective.timestamp && objective.timestamp - kill.timestamp <= 45000);
    const alliedDeathBefore = kills.slice().reverse().find((kill) => kill.victimTeam === "ALLY" && kill.timestamp < objective.timestamp && objective.timestamp - kill.timestamp <= 90000);
    return { ...objective, previousKill, alliedDeathBefore, context: previousKill ? `${previousKill.killerTeam === objective.teamKey ? "Après un kill" : "Après un fight adverse"} · ${previousKill.time}` : alliedDeathBefore ? `Après mort alliée · ${alliedDeathBefore.time}` : "Préparation neutre / non déduite" };
  });
}

function roleDiffRows(match) {
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  return COMP_ROLES.map((role) => {
    const a = ally.find((row) => normalizeProfileRole(row.role) === role);
    const e = enemy.find((row) => normalizeProfileRole(row.role) === role);
    const cs10A = a ? csAtMinute({ ...a, match }, 10) : null;
    const cs10E = e ? csAtMinute({ ...e, match }, 10) : null;
    return { role, ally: a, enemy: e, goldDiff: statValue(a, "gold") - statValue(e, "gold"), damageDiff: statValue(a, "damage") - statValue(e, "damage"), cs10Diff: Number.isFinite(cs10A) && Number.isFinite(cs10E) ? cs10A - cs10E : null, deathsDiff: statValue(a, "deaths") - statValue(e, "deaths") };
  });
}

function timelineTeamLabel(teamKey) {
  if (teamKey === "ALLY") return "NXT5";
  if (teamKey === "ENEMY") return "Adversaire";
  return "Contesté";
}

function timelineTeamTone(teamKey) {
  if (teamKey === "ALLY") return "cyan";
  if (teamKey === "ENEMY") return "red";
  return "yellow";
}

function formatSignedShort(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${formatPoints(number)}`;
}

function timelinePhaseMeta(timestamp) {
  const minute = Number(timestamp || 0) / 60000;
  if (minute < 14) return { id: "early", label: "Early", range: "0-14", toneName: "cyan" };
  if (minute < 24) return { id: "mid", label: "Mid game", range: "14-24", toneName: "purple" };
  return { id: "late", label: "Late", range: "24+", toneName: "yellow" };
}

function teamGoldAtTimestamp(match, teamKey, timestamp) {
  const frames = timelineFrames(match);
  const ids = new Set(teamRows(match, teamKey).map(rowParticipantId).filter(Boolean));
  if (!frames.length || !ids.size) return null;
  const target = Number(timestamp || 0);
  let frame = frames[0];
  for (const item of frames) {
    if (Number(item.timestamp || 0) <= target) frame = item;
    else break;
  }
  return Object.entries(frame?.participantFrames || {}).reduce((total, [id, data]) => ids.has(Number(id)) ? total + Number(data.totalGold || 0) : total, 0);
}

function timelineGoldDiff(match, timestamp) {
  const allyGold = teamGoldAtTimestamp(match, "ALLY", timestamp);
  const enemyGold = teamGoldAtTimestamp(match, "ENEMY", timestamp);
  return Number.isFinite(allyGold) && Number.isFinite(enemyGold) ? allyGold - enemyGold : null;
}

function killScoreAtTimestamp(kills, timestamp) {
  return kills.reduce((score, kill) => {
    if (Number(kill.timestamp || 0) > Number(timestamp || 0)) return score;
    if (kill.killerTeam === "ALLY") score.ally += 1;
    if (kill.killerTeam === "ENEMY") score.enemy += 1;
    return score;
  }, { ally: 0, enemy: 0 });
}

function fightWindows(match) {
  const kills = championKillEvents(match);
  const groups = [];
  let current = [];
  kills.forEach((kill) => {
    const previous = current[current.length - 1];
    if (!previous || Number(kill.timestamp || 0) - Number(previous.timestamp || 0) <= 24000) current.push(kill);
    else {
      groups.push(current);
      current = [kill];
    }
  });
  if (current.length) groups.push(current);
  return groups.filter((group) => group.length >= 2).map((group, index) => {
    const allyKills = group.filter((kill) => kill.killerTeam === "ALLY").length;
    const enemyKills = group.filter((kill) => kill.killerTeam === "ENEMY").length;
    const teamKey = allyKills === enemyKills ? "NEUTRAL" : allyKills > enemyKills ? "ALLY" : "ENEMY";
    const victims = group.map((kill) => championDisplayName(kill.victim?.champion)).filter(Boolean).slice(0, 4);
    const start = group[0];
    const end = group[group.length - 1];
    const time = start.timestamp === end.timestamp ? start.time : `${start.time}-${end.time}`;
    return {
      kind: "fight",
      timestamp: Number(start.timestamp || 0),
      time,
      teamKey,
      toneName: timelineTeamTone(teamKey),
      title: teamKey === "NEUTRAL" ? "Fight échangé" : `${timelineTeamLabel(teamKey)} gagne le fight`,
      context: `${allyKills}-${enemyKills} kills sur la fenêtre`,
      detail: victims.length ? `Morts: ${victims.join(" · ")}` : `Fight #${index + 1}`,
      allyKills,
      enemyKills,
      killCount: group.length,
    };
  });
}

function importantBuildingEvents(match) {
  const events = buildingEvents(match);
  return events.filter((event, index) => {
    const type = `${event.buildingType || ""} ${event.towerType || ""}`.toUpperCase();
    return index === 0 || index < 4 || type.includes("INHIBITOR") || type.includes("NEXUS");
  }).slice(0, 6);
}

function timelineMilestones(match) {
  const objectives = objectiveContext(match).map((event) => ({
    ...event,
    kind: "objective",
    title: event.label,
    detail: event.context,
    toneName: timelineTeamTone(event.teamKey),
  }));
  const fights = fightWindows(match).filter((event) => event.killCount >= 3 || Math.abs(event.allyKills - event.enemyKills) >= 2);
  const towers = importantBuildingEvents(match).map((event) => ({
    ...event,
    kind: "tower",
    title: event.label,
    toneName: timelineTeamTone(event.teamKey),
    context: "Pression structure",
    detail: String(event.towerType || event.laneType || "").replace(/_/g, " ") || "Tour détruite",
  }));
  return [...objectives, ...fights, ...towers].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)).slice(0, 18);
}

function MatchTimelineReview({ match }) {
  const status = timelineStatus(match);
  const objectives = objectiveContext(match);
  const kills = championKillEvents(match);
  const fights = fightWindows(match);
  const events = timelineMilestones(match);
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const finalGoldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const allyObjectives = objectives.filter((event) => event.teamKey === "ALLY").length;
  const enemyObjectives = objectives.filter((event) => event.teamKey === "ENEMY").length;
  const allyFights = fights.filter((event) => event.teamKey === "ALLY").length;
  const enemyFights = fights.filter((event) => event.teamKey === "ENEMY").length;
  const goldMarks = [10, 15, 20].map((minute) => {
    const allyGold = teamGoldAtMinute(match, "ALLY", minute);
    const enemyGold = teamGoldAtMinute(match, "ENEMY", minute);
    return { minute, diff: Number.isFinite(allyGold) && Number.isFinite(enemyGold) ? allyGold - enemyGold : null };
  });
  const phases = [
    { id: "early", label: "Early", range: "0-14", toneName: "cyan" },
    { id: "mid", label: "Mid game", range: "14-24", toneName: "purple" },
    { id: "late", label: "Late", range: "24+", toneName: "yellow" },
  ].map((phase) => ({ ...phase, events: events.filter((event) => timelinePhaseMeta(event.timestamp).id === phase.id) }));
  const highlight = events.find((event) => event.teamKey === "ENEMY" && ["objective", "fight"].includes(event.kind)) || events.find((event) => event.teamKey === "ALLY" && ["objective", "fight"].includes(event.kind)) || events[0];
  return <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-cyan-300/14 bg-gradient-to-br from-cyan-400/[0.055] via-black/24 to-fuchsia-400/[0.045]">
    <div className="border-b border-white/10 bg-black/18 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2"><Badge tone="cyan">Déroulé coach</Badge><Badge tone={status.toneName}>{status.label}</Badge><Badge tone="purple">{kills.length} kills</Badge><Badge tone="slate">{events.length} moments</Badge></div>
          <h4 className="mt-3 text-2xl font-black text-white">Lecture chronologique</h4>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{highlight ? `${highlight.time} · ${timelineTeamLabel(highlight.teamKey)} · ${highlight.title}` : "Aucun moment clé détecté dans la timeline importée."}</p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-[34rem]">
          {goldMarks.map((item) => <TimelineGoldCheckpoint key={item.minute} minute={item.minute} diff={item.diff} />)}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <TimelineReadoutCard icon={Gauge} label="Économie finale" value={formatSignedShort(finalGoldDiff)} detail={finalGoldDiff >= 0 ? "Avantage NXT5" : "Avantage adverse"} toneName={diffTone(finalGoldDiff)} />
        <TimelineReadoutCard icon={Target} label="Objectifs neutres" value={`${allyObjectives}-${enemyObjectives}`} detail="NXT5 - Adversaire" toneName={allyObjectives >= enemyObjectives ? "cyan" : "red"} />
        <TimelineReadoutCard icon={Swords} label="Fights détectés" value={`${allyFights}-${enemyFights}`} detail="Fenêtres multi-kills" toneName={allyFights >= enemyFights ? "green" : "red"} />
      </div>
    </div>
    {events.length ? <div className="grid gap-3 p-4 xl:grid-cols-3">
      {phases.map((phase) => <TimelinePhaseColumn key={phase.id} phase={phase} kills={kills} match={match} />)}
    </div> : <p className="m-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucun déroulé exploitable dans ce JSON pour les moments clés.</p>}
  </div>;
}

function TimelineGoldCheckpoint({ minute, diff }) {
  const missing = diff === null;
  return <div className={cx("rounded-2xl border px-3 py-2", missing ? tone("slate") : tone(diffTone(diff)))}>
    <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] opacity-80">{minute} min</p>
    <p className="mt-1 text-lg font-black leading-none text-white">{missing ? "N/A" : formatSignedShort(diff)}</p>
    <p className="mt-1 truncate text-[0.62rem] font-semibold opacity-75">écart or</p>
  </div>;
}

function TimelineReadoutCard({ icon: Icon, label, value, detail, toneName }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <div className={cx("rounded-xl border p-2", tone(toneName))}><Icon className="h-4 w-4" /></div>
    </div>
    <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    <p className="truncate text-xs font-semibold text-slate-300">{detail}</p>
  </div>;
}

function TimelineEventGlyph({ event }) {
  if (event.kind === "objective") return <ObjectivePictogram type={objectivePictogramType(event)} fallback={objectiveEventIcon(event)} className="h-8 w-8" />;
  if (event.kind === "fight") return <Swords className="h-4 w-4" />;
  return <Shield className="h-4 w-4" />;
}

function TimelineEventCard({ event, index, kills, match }) {
  const toneName = event.toneName || timelineTeamTone(event.teamKey);
  const score = killScoreAtTimestamp(kills, event.timestamp);
  const gold = timelineGoldDiff(match, event.timestamp);
  const enemy = event.teamKey === "ENEMY";
  const neutral = event.teamKey === "NEUTRAL";
  const frame = neutral ? "border-amber-200/18 bg-amber-300/[0.055]" : enemy ? "border-rose-300/18 bg-rose-500/[0.055]" : "border-cyan-300/18 bg-cyan-400/[0.055]";
  const rail = neutral ? "bg-amber-200" : enemy ? "bg-rose-200" : "bg-cyan-200";
  const kindLabel = event.kind === "objective" ? "Objectif" : event.kind === "fight" ? "Fight" : "Structure";
  return <article className={cx("relative overflow-hidden rounded-2xl border p-3", frame)}>
    <div className={cx("absolute inset-y-3 left-0 w-1 rounded-r-full shadow-[0_0_14px_currentColor]", rail)} />
    <div className="flex items-start gap-3 pl-1">
      <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", tone(toneName))}><TimelineEventGlyph event={event} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={toneName}>{event.time}</Badge>
          <Badge tone="slate">#{index + 1}</Badge>
          <Badge tone={toneName}>{timelineTeamLabel(event.teamKey)}</Badge>
        </div>
        <p className="mt-2 truncate text-sm font-black text-white">{event.title}</p>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-300">{event.context || event.detail || kindLabel}</p>
        {event.detail && event.detail !== event.context && <p className="mt-1 line-clamp-1 text-[0.66rem] font-semibold text-slate-400">{event.detail}</p>}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <span className="min-w-0 rounded-lg border border-white/10 bg-black/24 px-2 py-1"><span className="block text-[0.52rem] font-black uppercase tracking-[0.1em] text-slate-400">Kills</span><span className="text-xs font-black text-white">{score.ally}-{score.enemy}</span></span>
          <span className="min-w-0 rounded-lg border border-white/10 bg-black/24 px-2 py-1"><span className="block text-[0.52rem] font-black uppercase tracking-[0.1em] text-slate-400">Gold</span><span className={cx("text-xs font-black", gold === null ? "text-slate-300" : gold >= 0 ? "text-emerald-100" : "text-rose-100")}>{gold === null ? "N/A" : formatSignedShort(gold)}</span></span>
          <span className="min-w-0 rounded-lg border border-white/10 bg-black/24 px-2 py-1"><span className="block text-[0.52rem] font-black uppercase tracking-[0.1em] text-slate-400">Type</span><span className="truncate text-xs font-black text-white">{kindLabel}</span></span>
        </div>
      </div>
    </div>
  </article>;
}

function TimelinePhaseColumn({ phase, kills, match }) {
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-black/18 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">{phase.label}</p>
        <p className="mt-0.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{phase.range} min</p>
      </div>
      <Badge tone={phase.toneName}>{phase.events.length}</Badge>
    </div>
    <div className="space-y-2">
      {phase.events.length ? phase.events.map((event, index) => <TimelineEventCard key={`${phase.id}-${event.kind}-${event.timestamp}-${index}`} event={event} index={index} kills={kills} match={match} />) : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm font-semibold leading-6 text-slate-400">Aucun moment majeur détecté.</div>}
    </div>
  </section>;
}

function RoleDiffPanel({ match }) {
  const rows = roleDiffRows(match);
  return <div className="mt-4 rounded-[1.25rem] bg-black/12 p-2 ring-1 ring-white/[0.045]"><div className="grid gap-1.5 lg:grid-cols-5">{rows.map((item) => <div key={item.role} className="rounded-xl bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-2"><Badge tone={diffTone(item.goldDiff)}>{roleLabel(item.role)}</Badge><span className={cx("text-xs font-black", item.goldDiff >= 0 ? "text-emerald-200" : "text-rose-200")}>{formatGoldDiff(item.goldDiff)}</span></div><p className="mt-2 truncate text-xs font-semibold text-slate-300">CS10 {item.cs10Diff === null ? "N/A" : `${item.cs10Diff >= 0 ? "+" : ""}${item.cs10Diff}`} · Dégâts {(item.damageDiff >= 0 ? "+" : "") + formatPoints(item.damageDiff)}</p><p className="mt-1 truncate text-xs font-semibold text-slate-400">Écart morts {item.deathsDiff >= 0 ? "+" : ""}{item.deathsDiff}</p></div>)}</div></div>;
}

function ResourceConversionPanel({ match }) {
  const ally = teamRows(match, "ALLY");
  return <div className="mt-4 grid gap-2 xl:grid-cols-5">{ally.map((row) => {
    const damageShare = shareOfTeam(row, ally, "damage");
    const goldShare = shareOfTeam(row, ally, "gold");
    const visionShare = shareOfTeam(row, ally, "vision");
    const delta = damageShare - goldShare;
    return <div key={row.id || rowParticipantId(row)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center gap-2"><ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-9 w-9 rounded-xl object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{row.summoner_name || row.riot_id || roleLabel(row.role)}</p><p className="truncate text-xs font-semibold text-slate-300">{championDisplayName(row.champion)}</p></div></div><div className="mt-3 space-y-1.5 text-xs font-semibold text-slate-300"><p>DMG {damageShare.toFixed(1)}% · Gold {goldShare.toFixed(1)}%</p><p>Vision {visionShare.toFixed(1)}% · Rentabilité <span className={delta >= 0 ? "text-emerald-200" : "text-amber-200"}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}</span></p></div></div>;
  })}</div>;
}

function DeathContextPanel({ match }) {
  const data = deathContext(match);
  const topRepeated = data.repeated[0];
  const cards = [
    [AlertTriangle, "Avant objectif", data.beforeObjectives.length, "Mort < 90s avant objectif", data.beforeObjectives.length ? "red" : "green"],
    [Shield, "Isolées déduites", data.isolated.length, "Sans trade proche détecté", data.isolated.length ? "yellow" : "green"],
    [Flame, "Shutdowns donnés", data.shutdowns.length, "Bounty timeline", data.shutdowns.length ? "red" : "slate"],
    [Target, "Focus deaths", topRepeated?.deaths || 0, topRepeated ? `${topRepeated.name} · ${championDisplayName(topRepeated.champion)}` : "Aucun profil exposé", topRepeated?.deaths >= 5 ? "red" : "cyan"],
  ];
  return <div className="mt-4 rounded-[1.25rem] bg-black/12 p-2 ring-1 ring-white/[0.045]"><div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, label, value, detail, t]) => <div key={label} className="rounded-xl bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><div className={cx("rounded-xl p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><p className="mt-2 text-xl font-black text-white">{value}</p><p className="truncate text-xs font-semibold text-slate-300">{detail}</p></div>)}</div>{data.beforeObjectives.length > 0 && <div className="mt-2 grid gap-1.5 xl:grid-cols-2">{data.beforeObjectives.slice(0, 4).map((death, index) => <div key={`${death.timestamp}-${index}`} className="rounded-xl border border-rose-300/12 bg-rose-500/[0.045] px-3 py-2 text-xs font-semibold text-slate-200"><span className="font-black text-white">{death.time}</span> · {death.victim?.summoner_name || death.victim?.riot_id || "Joueur"} meurt avant objectif</div>)}</div>}</div>;
}

function DraftImpactPanel({ match }) {
  const ally = teamRows(match, "ALLY");
  const identity = compositionIdentity(ally);
  const physical = ally.reduce((total, row) => total + Number(row.raw?.physicalDamageDealtToChampions || 0), 0);
  const magic = ally.reduce((total, row) => total + Number(row.raw?.magicDamageDealtToChampions || 0), 0);
  const trueDamage = ally.reduce((total, row) => total + Number(row.raw?.trueDamageDealtToChampions || 0), 0);
  const total = Math.max(1, physical + magic + trueDamage);
  const apRatio = Math.round((magic / total) * 100);
  const adRatio = Math.round((physical / total) * 100);
  const tags = identity.tags.slice(0, 4);
  const warnings = [
    Math.abs(apRatio - adRatio) >= 45 && `Dégâts ${apRatio > adRatio ? "AP" : "AD"} très dominants.`,
    !tags.some(([tag]) => ["frontline", "tank"].includes(tag)) && "Première ligne peu visible dans la draft.",
    !tags.some(([tag]) => ["engage", "pick"].includes(tag)) && "Initiation ou catch à confirmer.",
  ].filter(Boolean);
  return <div className="mt-4 rounded-[1.35rem] border border-fuchsia-300/14 bg-fuchsia-400/[0.045] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge tone={championStyleTone(identity.primary)}>Lecture draft</Badge><h4 className="mt-3 text-xl font-black text-white">{tagLabel(identity.primary)}</h4><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{identity.text}</p></div><div className="flex flex-wrap gap-2"><Badge tone="cyan">Magique {apRatio}%</Badge><Badge tone="yellow">Physique {adRatio}%</Badge><Badge tone="slate">Brut {Math.round((trueDamage / total) * 100)}%</Badge></div></div><div className="mt-4 flex flex-wrap gap-2">{tags.length ? tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Tags insuffisants</Badge>}{warnings.map((warning) => <Badge key={warning} tone="yellow">{warning}</Badge>)}</div></div>;
}

function GameSummaryPanel({ match }) {
  const deaths = deathContext(match);
  const objectives = objectiveContext(match);
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const damageLeader = ally.slice().sort((a, b) => statValue(b, "damage") - statValue(a, "damage"))[0];
  const weakRole = roleDiffRows(match).slice().sort((a, b) => a.goldDiff - b.goldDiff)[0];
  const firstObjectiveIssue = objectives.find((event) => event.teamKey === "ENEMY" && event.alliedDeathBefore);
  const lines = [
    firstObjectiveIssue ? `Moment à revoir: ${firstObjectiveIssue.time}, ${firstObjectiveIssue.label} adverse après une mort alliée.` : `Économie finale: ${formatGoldDiff(goldDiff)} or, ${goldDiff >= 0 ? "avantage exploitable" : "retard à expliquer"}.`,
    damageLeader ? `Plus gros impact dégâts sur cette game: ${damageLeader.summoner_name || damageLeader.riot_id || roleLabel(damageLeader.role)} avec ${formatPoints(damageLeader.damage)} sur ${championDisplayName(damageLeader.champion)}.` : "Impact dégâts: données joueurs insuffisantes.",
    weakRole ? `Écart de game à revoir: ${roleLabel(weakRole.role)} (${formatGoldDiff(weakRole.goldDiff)} or face au rôle adverse, ${deaths.beforeObjectives.length} mort${deaths.beforeObjectives.length > 1 ? "s" : ""} avant objectif côté équipe).` : "Écart de game: confirmer les rôles importés.",
  ];
  return <div className="mt-4 rounded-[1.35rem] border border-emerald-300/14 bg-emerald-400/[0.05] p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone="green">Résumé game</Badge><Badge tone={timelineStatus(match).toneName}>{timelineStatus(match).label}</Badge></div><div className="mt-3 grid gap-2 xl:grid-cols-3">{lines.map((line, index) => <div key={line} className="rounded-2xl border border-white/10 bg-black/22 p-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-emerald-100">Point {index + 1}</p><p className="mt-2 text-sm font-semibold leading-5 text-white">{line}</p></div>)}</div></div>;
}

function GameMetricSignals({ match }) {
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const strongest = ally.slice().sort((a, b) => roleScore(b) - roleScore(a))[0];
  const exposed = ally.slice().sort((a, b) => statValue(b, "deaths") - statValue(a, "deaths"))[0];
  const damageLead = ally.slice().sort((a, b) => statValue(b, "damage") - statValue(a, "damage"))[0];
  const visionLead = ally.slice().sort((a, b) => statValue(b, "vision") - statValue(a, "vision"))[0];
  const csDiff = sumRows(ally, "cs") - sumRows(enemy, "cs");
  const deaths = sumRows(ally, "deaths");
  const enemyDeaths = sumRows(enemy, "deaths");
	  const cards = [
	    [Crown, "Meilleure game", strongest, strongest ? `${championDisplayName(strongest.champion)} · ${strongest.kda}` : "Aucune donnée", "cyan"],
	    [AlertTriangle, "Morts", exposed, exposed ? `${exposed.deaths || 0} morts · ${championDisplayName(exposed.champion)}` : "Aucune donnée", exposed?.deaths >= 6 ? "red" : "yellow"],
	    [Flame, "Dégâts", damageLead, damageLead ? formatPoints(damageLead.damage) + " dégâts" : "Aucune donnée", "purple"],
	    [Eye, "Vision", visionLead, visionLead ? `${visionLead.vision || 0} vision` : "Aucune donnée", "green"],
	  ];
	  const comparisonCards = [
	    [Gauge, "Écart CS", (csDiff >= 0 ? "+" : "") + formatPoints(csDiff), "Alliés vs adversaires", diffTone(csDiff)],
	    [Swords, "Morts équipe", `${deaths} / ${enemyDeaths}`, "Alliés vs adversaires", deaths <= enemyDeaths ? "green" : "red"],
	  ];
	  return <div className="mt-4 rounded-[1.25rem] bg-black/12 p-2 ring-1 ring-white/[0.045]">
	    <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, label, row, detail, t]) => <div key={label} className="min-w-0 rounded-xl bg-white/[0.03] p-3"><div className="flex min-w-0 items-center gap-3"><div className={cx("shrink-0 rounded-xl p-2", tone(t))}><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "N/A"}</p><p className="truncate text-xs font-semibold text-slate-300">{detail}</p></div></div></div>)}</div>
	    <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">{comparisonCards.map(([Icon, label, value, detail, t]) => <div key={label} className="min-w-0 rounded-xl bg-white/[0.03] p-3"><div className="flex min-w-0 items-center gap-3"><div className={cx("shrink-0 rounded-xl p-2", tone(t))}><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{value}</p><p className="truncate text-xs font-semibold text-slate-300">{detail}</p></div></div></div>)}</div>
	  </div>;
	}

function HudIcon({ src, sources, label, fallback, emptyText = "VIDE", toneName = "cyan", className = "" }) {
  const sourceList = useMemo(() => [...new Set([...(Array.isArray(sources) ? sources : []), src].filter(Boolean))], [src, sources]);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [sourceList.join("|")]);
  const source = sourceList[sourceIndex];
  const active = Boolean(source);
  return <div title={label} className={cx("relative aspect-square min-h-0 min-w-0 overflow-hidden rounded-xl border bg-black/35", active ? toneName === "pink" ? "border-fuchsia-200/25 shadow-[0_0_14px_rgba(217,70,239,.10)]" : "border-cyan-200/20 shadow-[0_0_14px_rgba(34,211,238,.10)]" : "border-white/8 opacity-45", className)}>
    {active ? <>
      <img src={source} alt={label} className="h-full w-full object-cover" onError={() => setSourceIndex((index) => index + 1)} />
      <span className="hidden h-full w-full items-center justify-center px-1 text-center text-[0.54rem] font-black text-slate-300">{fallback}</span>
    </> : <span className="flex h-full w-full items-center justify-center px-1 text-center text-[0.54rem] font-black text-slate-300">{emptyText}</span>}
  </div>;
}

function VersusPlayerMini({ row, side, opponent, align = "left" }) {
  const ahead = row && opponent ? statValue(row, "gold") >= statValue(opponent, "gold") : false;
  const kda = row ? `${row.kills || 0}/${row.deaths || 0}/${row.assists || 0}` : "-/-/-";
  const kp = row ? Math.round(parsePercent(row.kill_participation || row.kp)) : 0;
  const spells = row ? summonerSpellIds(row) : [];
  const trinket = row ? trinketItemId(row) : 0;
  const items = row ? [
    ...itemSlots(row).filter(Boolean).map((id) => ({ id, type: "item" })),
    ...(trinket ? [{ id: trinket, type: "trinket" }] : []),
  ] : [];
  return <div className={cx("relative min-w-0 overflow-hidden rounded-2xl border p-2.5", side === "ALLY" ? "border-cyan-300/18 bg-cyan-400/[0.055]" : "border-rose-300/18 bg-rose-500/[0.055]", ahead && "shadow-[0_0_24px_rgba(34,211,238,.10)]")}>
    {row && <ChampionBackdrop champion={row.champion} focus="face" />}
    <div className="absolute inset-0 bg-gradient-to-r from-[#050711]/94 via-[#050711]/78 to-[#050711]/48" />
    <div className={cx("relative z-10 flex min-w-0 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35 md:h-14 md:w-14">
        {row ? <ChampionPortrait row={row} champion={row.champion} alt={row.champion} /> : <Crown className="m-3 h-6 w-6 text-slate-300" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "Inconnu"}</p>
        <p className="truncate text-xs font-semibold text-slate-200">{row ? championDisplayName(row.champion) : "Champion ?"}</p>
        <div className={cx("mt-2 flex flex-wrap gap-1.5", align === "right" && "justify-end")}>
          <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] font-black text-white">{kda}</span>
          <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] font-black text-slate-200">{kp}% KP</span>
          <span className="rounded-lg border border-emerald-200/15 bg-emerald-300/10 px-2 py-1 text-[0.62rem] font-black text-emerald-50">{creepScore(row)} CS</span>
          <span className="hidden rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] font-black text-slate-200 sm:inline-flex">{formatPoints(row?.damage || 0)} dégâts</span>
          <span className="hidden rounded-lg border border-yellow-200/15 bg-yellow-300/10 px-2 py-1 text-[0.62rem] font-black text-yellow-50 md:inline-flex">{formatPoints(row?.gold || 0)} or</span>
          <span className="hidden rounded-lg border border-cyan-200/15 bg-cyan-300/10 px-2 py-1 text-[0.62rem] font-black text-cyan-50 lg:inline-flex">{row?.vision || 0} VIS</span>
        </div>
        {(spells.length > 0 || items.length > 0) && <div className={cx("mt-2 flex flex-wrap gap-1", align === "right" && "justify-end")}>
          {spells.map((spell, index) => <HudIcon key={`${row.id || row.riot_id}-instant-spell-${index}-${spell}`} sources={summonerSpellIconSources(spell)} label={`Sort ${spell}`} fallback={spell} emptyText="S" className="h-6 w-6 rounded-lg" />)}
          {items.map((item, index) => <HudIcon key={`${row.id || row.riot_id}-instant-item-${index}-${item.id}`} sources={itemIconSources(item.id)} label={item.type === "trinket" ? `Ward ${item.id}` : `Objet ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : "cyan"} className="h-6 w-6 rounded-lg" />)}
        </div>}
      </div>
    </div>
  </div>;
}

function LaneComparisonPanel({ match, role, allyRow, enemyRow }) {
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const blueTeamKey = objectiveTeamKeyForSide(match, "BLUE");
  const redTeamKey = objectiveTeamKeyForSide(match, "RED");
  const blueTeam = blueTeamKey === "ALLY" ? ally : enemy;
  const redTeam = redTeamKey === "ALLY" ? ally : enemy;
  const blueRow = blueTeamKey === "ALLY" ? allyRow : enemyRow;
  const redRow = redTeamKey === "ALLY" ? allyRow : enemyRow;
  const blueCs10 = blueRow ? csAtMinute({ ...blueRow, match }, 10) : null;
  const redCs10 = redRow ? csAtMinute({ ...redRow, match }, 10) : null;
  const blueCs20 = blueRow ? csAtMinute({ ...blueRow, match }, 20) : null;
  const redCs20 = redRow ? csAtMinute({ ...redRow, match }, 20) : null;
  const metricRows = [
    ["KDA", blueRow ? `${blueRow.kills || 0}/${blueRow.deaths || 0}/${blueRow.assists || 0}` : "-", redRow ? `${redRow.kills || 0}/${redRow.deaths || 0}/${redRow.assists || 0}` : "-", null],
    ["KP", blueRow ? `${Math.round(parsePercent(blueRow.kill_participation || blueRow.kp))}%` : "-", redRow ? `${Math.round(parsePercent(redRow.kill_participation || redRow.kp))}%` : "-", parsePercent(blueRow?.kill_participation || blueRow?.kp) - parsePercent(redRow?.kill_participation || redRow?.kp)],
    ["Or", formatPoints(statValue(blueRow, "gold")), formatPoints(statValue(redRow, "gold")), statValue(blueRow, "gold") - statValue(redRow, "gold")],
    ["Dégâts", formatPoints(statValue(blueRow, "damage")), formatPoints(statValue(redRow, "damage")), statValue(blueRow, "damage") - statValue(redRow, "damage")],
    ["CS", String(creepScore(blueRow)), String(creepScore(redRow)), creepScore(blueRow) - creepScore(redRow)],
    ["CS 10", blueCs10 ?? "N/A", redCs10 ?? "N/A", Number.isFinite(blueCs10) && Number.isFinite(redCs10) ? blueCs10 - redCs10 : null],
    ["CS 20", blueCs20 ?? "N/A", redCs20 ?? "N/A", Number.isFinite(blueCs20) && Number.isFinite(redCs20) ? blueCs20 - redCs20 : null],
    ["Vision", String(statValue(blueRow, "vision")), String(statValue(redRow, "vision")), statValue(blueRow, "vision") - statValue(redRow, "vision")],
    ["Morts", String(statValue(blueRow, "deaths")), String(statValue(redRow, "deaths")), statValue(redRow, "deaths") - statValue(blueRow, "deaths")],
  ];
  const shareRows = [
    ["Part des dégâts", shareOfTeam(blueRow, blueTeam, "damage"), shareOfTeam(redRow, redTeam, "damage"), "higher"],
    ["Part de l'or", shareOfTeam(blueRow, blueTeam, "gold"), shareOfTeam(redRow, redTeam, "gold"), "higher"],
    ["Part vision", shareOfTeam(blueRow, blueTeam, "vision"), shareOfTeam(redRow, redTeam, "vision"), "higher"],
    ["Part des morts", shareOfTeam(blueRow, blueTeam, "deaths"), shareOfTeam(redRow, redTeam, "deaths"), "lower"],
  ];
  const teamBadge = (teamKey) => teamKey === "ALLY" ? "NXT5" : "En face";
  const formatSideDiff = (diff) => {
    if (diff === null) return "-";
    const value = Number.isInteger(diff) ? String(diff) : diff.toFixed(1);
    if (!diff) return "· 0";
    return diff > 0 ? `< +${value}` : `${value} >`;
  };
  const renderLoadout = (row, side, teamKey, align = "left") => {
    const spells = row ? summonerSpellIds(row) : [];
    const trinket = row ? trinketItemId(row) : 0;
    const items = row ? [...itemSlots(row).filter(Boolean).map((id) => ({ id, type: "item" })), ...(trinket ? [{ id: trinket, type: "trinket" }] : [])] : [];
    const isBlue = side === "blue";
    return <div className={cx("rounded-2xl border p-3", isBlue ? "border-cyan-300/14 bg-cyan-400/[0.055]" : "border-rose-300/14 bg-rose-500/[0.055]")}>
      <div className={cx("mb-3 flex flex-wrap items-center gap-2", align === "right" && "justify-end")}><Badge tone={isBlue ? "cyan" : "red"}>{isBlue ? "Côté bleu" : "Côté rouge"}</Badge><Badge tone={teamKey === "ALLY" ? "green" : "slate"}>{teamBadge(teamKey)}</Badge></div>
      <div className={cx("flex min-w-0 items-center gap-3", align === "right" && "justify-end text-right")}>
        <ChampionPortrait row={row} champion={row?.champion} alt={row?.champion || role} className="h-12 w-12 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "Inconnu"}</p>
          <p className="truncate text-xs font-semibold text-slate-300">{row ? championDisplayName(row.champion) : "Champion ?"}</p>
        </div>
      </div>
      <div className={cx("mt-3 flex flex-wrap gap-1.5", align === "right" && "justify-end")}>
        {spells.map((spell, index) => <HudIcon key={`${side}-${role}-spell-${index}-${spell}`} sources={summonerSpellIconSources(spell)} label={`Sort ${spell}`} fallback={spell} emptyText="S" className="h-8 w-8 rounded-lg" />)}
        {items.map((item, index) => <HudIcon key={`${side}-${role}-item-${index}-${item.id}`} sources={itemIconSources(item.id)} label={item.type === "trinket" ? `Ward ${item.id}` : `Objet ${item.id}`} fallback={item.id} emptyText="-" toneName={item.type === "trinket" ? "pink" : "cyan"} className="h-8 w-8 rounded-lg" />)}
      </div>
    </div>;
  };
  return <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="rounded-[1.35rem] border border-white/10 bg-black/28 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Badge tone="cyan">{roleLabel(role)}</Badge><h5 className="text-base font-black text-white">Comparatif direct de la game</h5></div>
      <Badge tone="slate">Clique la ligne pour refermer</Badge>
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,.58fr)_minmax(0,1fr)_minmax(0,.58fr)]">
      {renderLoadout(blueRow, "blue", blueTeamKey)}
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <div className="grid grid-cols-[minmax(86px,.7fr)_minmax(0,1fr)_minmax(72px,.55fr)_minmax(0,1fr)] gap-2 text-xs">
          <p className="font-black uppercase tracking-[0.14em] text-slate-400">Stat</p>
          <p className="font-black uppercase tracking-[0.14em] text-cyan-100">Côté bleu</p>
          <p className="text-center font-black uppercase tracking-[0.14em] text-slate-400">Écart</p>
          <p className="text-right font-black uppercase tracking-[0.14em] text-rose-100">Côté rouge</p>
          {metricRows.map(([label, left, right, diff]) => {
            const cleanDiff = Number.isFinite(Number(diff)) ? Number(diff) : null;
            return <React.Fragment key={label}>
              <p className="rounded-lg bg-black/18 px-2 py-1.5 font-black text-slate-300">{label}</p>
              <p className="truncate rounded-lg bg-cyan-400/[0.06] px-2 py-1.5 font-black text-white">{left}</p>
              <p className={cx("rounded-lg px-2 py-1.5 text-center font-black", cleanDiff === null ? "bg-black/18 text-slate-400" : cleanDiff >= 0 ? "bg-cyan-400/10 text-cyan-100" : "bg-rose-500/10 text-rose-100")}>{formatSideDiff(cleanDiff)}</p>
              <p className="truncate rounded-lg bg-rose-500/[0.06] px-2 py-1.5 text-right font-black text-white">{right}</p>
            </React.Fragment>;
          })}
        </div>
      </div>
      {renderLoadout(redRow, "red", redTeamKey, "right")}
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-4">{shareRows.map(([label, left, right, direction]) => {
      const diff = Number(left || 0) - Number(right || 0);
      const blueWins = direction === "lower" ? diff < 0 : diff > 0;
      const leader = !diff ? "Égal" : blueWins ? "Côté bleu" : "Côté rouge";
      return <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-slate-300">{label}</p><p className="mt-2 text-sm font-black text-white">{Number(left || 0).toFixed(1)}% / {Number(right || 0).toFixed(1)}%</p><p className={cx("mt-1 text-xs font-black", !diff ? "text-slate-300" : blueWins ? "text-cyan-200" : "text-rose-200")}>{leader}</p></div>;
    })}</div>
  </motion.div>;
}

function SideColumnHeader({ side, align = "left" }) {
  const isBlue = side === "blue";
  const Icon = isBlue ? Shield : Swords;
  return <div className={cx("flex items-center gap-2 rounded-2xl border px-3 py-2", isBlue ? "border-cyan-300/22 bg-cyan-400/[0.075] text-cyan-100" : "border-rose-300/22 bg-rose-500/[0.075] text-rose-100", align === "right" && "justify-end")}>
    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-black/25", isBlue ? "border-cyan-200/30" : "border-rose-200/30")}>
      <Icon className="h-4 w-4" />
    </span>
    <span className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-white">{isBlue ? "Côté bleu" : "Côté rouge"}</span>
  </div>;
}

function MatchVersusOverview({ match }) {
  const [openRole, setOpenRole] = useState("");
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const byRole = (rows, role) => rows.find((row) => String(row.role || "").toUpperCase() === role) || null;
  const allyIsBlue = String(match?.side || "").toLowerCase().includes("blue");
  const blueRows = allyIsBlue ? ally : enemy;
  const redRows = allyIsBlue ? enemy : ally;
  const blueKey = allyIsBlue ? "ALLY" : "ENEMY";
  const redKey = allyIsBlue ? "ENEMY" : "ALLY";
  return <div className="mt-5 rounded-[1.5rem] border border-cyan-300/14 bg-gradient-to-br from-cyan-400/[0.07] via-black/25 to-rose-500/[0.055] p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><Badge tone="cyan">Vue 5v5</Badge><h4 className="mt-2 text-xl font-black text-white">Lecture instantanée de la game</h4></div>
    </div>
    <ObjectiveHud match={match} compact />
    <div className="nxt5-responsive-scroll">
      <div className="min-w-[760px] lg:min-w-0">
        <div className="mb-2 grid min-w-0 grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] items-center gap-2">
          <SideColumnHeader side="blue" />
          <div />
          <SideColumnHeader side="red" align="right" />
        </div>
        <div className="grid gap-2">
          {COMP_ROLES.map((role) => {
            const blueRow = byRole(blueRows, role);
            const redRow = byRole(redRows, role);
            const allyRow = byRole(ally, role);
            const enemyRow = byRole(enemy, role);
            const blueGold = blueRow ? statValue(blueRow, "gold") : 0;
            const redGold = redRow ? statValue(redRow, "gold") : 0;
            const diff = (blueKey === "ALLY" ? blueGold - redGold : redGold - blueGold);
            const winningEdge = blueGold === redGold ? "·" : blueGold > redGold ? "<" : ">";
            const open = openRole === role;
            return <div key={role} className={cx("rounded-[1.35rem] transition", open && "bg-cyan-400/[0.045] p-1 ring-1 ring-cyan-200/18")}>
              <button type="button" aria-expanded={open} onClick={() => setOpenRole(open ? "" : role)} className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] items-stretch gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60">
                <VersusPlayerMini row={blueRow} side={blueKey} opponent={redRow} align="left" />
                <div className={cx("flex flex-col items-center justify-center rounded-2xl border px-1.5 py-2 text-center transition", open ? "border-cyan-200/40 bg-cyan-400/14 shadow-[0_0_22px_rgba(34,211,238,.12)]" : "border-white/10 bg-black/35")}>
                  <RoleIcon role={role} className="h-5 w-5" />
                  <span className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.08em] text-white">{role}</span>
                  <span className={cx("mt-1 rounded-lg px-1.5 py-0.5 text-[0.54rem] font-black", diff >= 0 ? "bg-emerald-400/12 text-emerald-100" : "bg-rose-500/12 text-rose-100")}>{winningEdge} {formatGoldDiff(diff)}</span>
                  <ChevronDown className={cx("mt-1 h-3.5 w-3.5 text-cyan-100 transition", open && "rotate-180")} />
                </div>
                <VersusPlayerMini row={redRow} side={redKey} opponent={blueRow} align="right" />
              </button>
              <AnimatePresence>{open && <div className="mt-2"><LaneComparisonPanel match={match} role={role} allyRow={allyRow} enemyRow={enemyRow} /></div>}</AnimatePresence>
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}

function MatchDataPanel({ match }) {
  if (!match) return null;
  const ally = teamRows(match, "ALLY");
  const enemy = teamRows(match, "ENEMY");
  const allyKills = sumRows(ally, "kills");
  const allyDeaths = sumRows(ally, "deaths");
  const allyAssists = sumRows(ally, "assists");
  const enemyKills = sumRows(enemy, "kills");
  const damageDiff = sumRows(ally, "damage") - sumRows(enemy, "damage");
  const towerDamageDiff = ally.reduce((total, row) => total + towerDamage(row), 0) - enemy.reduce((total, row) => total + towerDamage(row), 0);
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const visionDiff = sumRows(ally, "vision") - sumRows(enemy, "vision");
  return <Surface glow className="mt-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ? "green" : "red"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.patch || "Patch ?"}</Badge><Badge tone="blue">{match.side || "Côté ?"}</Badge><Badge tone={timelineStatus(match).toneName}>{timelineStatus(match).label}</Badge></div><h3 className="mt-3 truncate text-2xl font-black text-white">{matchDisplayName(match)}</h3><p className="mt-1 text-sm font-semibold text-slate-300">{match.game_id} · {match.duration || "--:--"}</p></div><Button type="button" variant="ghost" icon={ImageIcon} onClick={() => exportStatsPng({ title: matchDisplayName(match), subtitle: match?.game_id || "Export game", matches: [match], filename: `nxt5-game-${match?.game_id || "export"}.png` })}>Exporter la game</Button></div><MatchVersusOverview match={match} /><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><MetricCard compact icon={Swords} label="KDA équipe" value={`${allyKills}/${allyDeaths}/${allyAssists}`} hint={`${enemyKills} kills adverses`} tone="cyan" /><MetricCard compact icon={Flame} label="Écart dégâts" value={(damageDiff >= 0 ? "+" : "") + formatPoints(damageDiff)} hint="Alliés vs adversaires" tone={damageDiff >= 0 ? "green" : "red"} sideMarker={winningSideForDiff(match, damageDiff)} /><MetricCard compact icon={Trophy} label="Dégâts tours" value={(towerDamageDiff >= 0 ? "+" : "") + formatPoints(towerDamageDiff)} hint="Pression structures" tone={towerDamageDiff >= 0 ? "green" : "red"} sideMarker={winningSideForDiff(match, towerDamageDiff)} /><MetricCard compact icon={Gauge} label="Écart or" value={formatGoldDiff(goldDiff)} hint="Économie globale" tone={goldDiff >= 0 ? "green" : "red"} sideMarker={winningSideForDiff(match, goldDiff)} /><MetricCard compact icon={Eye} label="Écart vision" value={(visionDiff >= 0 ? "+" : "") + formatPoints(visionDiff)} hint="Score vision équipe" tone={visionDiff >= 0 ? "cyan" : "red"} sideMarker={winningSideForDiff(match, visionDiff)} /></div><GameSummaryPanel match={match} /><MatchTimelineReview match={match} /><GameMetricSignals match={match} /><RoleDiffPanel match={match} /><DeathContextPanel match={match} /><DraftImpactPanel match={match} /></Surface>;
}

function archiveMatchIds(archive) {
  return Array.isArray(archive?.match_ids) ? archive.match_ids : [];
}

function ScrimArchiveSummary({ matches, selectedMatchId = "", onSelectMatch }) {
  const rows = matches.flatMap((match) => match.participants || []);
  const ally = rows.filter((row) => row.team_key === "ALLY");
  const enemy = rows.filter((row) => row.team_key === "ENEMY");
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const damageDiff = sumRows(ally, "damage") - sumRows(enemy, "damage");
  const towerDamageDiff = ally.reduce((total, row) => total + towerDamage(row), 0) - enemy.reduce((total, row) => total + towerDamage(row), 0);
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const visionDiff = sumRows(ally, "vision") - sumRows(enemy, "vision");
  const deaths = sumRows(ally, "deaths");
  const enemyDeaths = sumRows(enemy, "deaths");
  const selectedMatch = matches.find((match) => String(match.id || "") === String(selectedMatchId || "")) || null;
  if (!matches.length) return null;
  return <Surface glow className="mt-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Badge tone="purple">Analyse de groupe</Badge><Badge tone="slate">{matches.length} game{matches.length > 1 ? "s" : ""}</Badge></div>
        <h3 className="mt-3 text-2xl font-black text-white">Lecture scrim complète</h3>
        <p className="mt-1 text-sm font-semibold text-slate-300">Agrégation des games sélectionnées : série, volume, écarts et signaux communs.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" icon={ImageIcon} onClick={() => exportStatsPng({ title: selectedMatch ? matchDisplayName(selectedMatch) : "Game NXT5", subtitle: selectedMatch?.game_id || "Export game", matches: selectedMatch ? [selectedMatch] : [], filename: `nxt5-game-${selectedMatch?.game_id || "export"}.png` })} disabled={!selectedMatch}>Exporter la game</Button>
        <Button type="button" variant="ghost" icon={ImageIcon} onClick={() => exportStatsPng({ title: "Groupe NXT5", subtitle: `${matches.length} games · ${wins}W - ${matches.length - wins}L`, matches, filename: "nxt5-groupe-stats.png" })}>Exporter le groupe</Button>
        <Badge tone={wins >= matches.length / 2 ? "green" : "red"}>{wins}W / {matches.length - wins}L</Badge>
      </div>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><MetricCard icon={Trophy} label="Winrate bloc" value={`${Math.round((wins / Math.max(1, matches.length)) * 100)}%`} hint="Sur les games du groupe" tone={wins >= matches.length / 2 ? "green" : "red"} /><MetricCard icon={Flame} label="Écart dégâts" value={(damageDiff >= 0 ? "+" : "") + formatPoints(damageDiff)} hint="Total série" tone={diffTone(damageDiff)} sideMarker={winningTeamForDiff(damageDiff)} /><MetricCard icon={Target} label="Dégâts tours" value={(towerDamageDiff >= 0 ? "+" : "") + formatPoints(towerDamageDiff)} hint="Total structures" tone={diffTone(towerDamageDiff)} sideMarker={winningTeamForDiff(towerDamageDiff)} /><MetricCard icon={Gauge} label="Écart or" value={formatGoldDiff(goldDiff)} hint="Total série" tone={diffTone(goldDiff)} sideMarker={winningTeamForDiff(goldDiff)} /><MetricCard icon={Eye} label="Écart vision" value={(visionDiff >= 0 ? "+" : "") + formatPoints(visionDiff)} hint={`${deaths} morts alliées / ${enemyDeaths} ennemies`} tone={diffTone(visionDiff)} sideMarker={winningTeamForDiff(visionDiff)} /></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{matches.map((match) => { const activeGame = String(selectedMatchId || "") === String(match.id || ""); return <div key={match.id} className={cx("relative overflow-hidden rounded-2xl border p-4 transition", activeGame ? "border-cyan-200/75 bg-cyan-400/14 shadow-[0_0_0_1px_rgba(103,232,249,.28),0_0_30px_rgba(34,211,238,.18)]" : "border-white/10 bg-black/25 hover:border-cyan-300/25 hover:bg-white/[0.055]")}><div className={cx("pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,.65)] transition", activeGame ? "opacity-100" : "opacity-0")} /><button type="button" aria-pressed={activeGame} onClick={() => onSelectMatch?.(activeGame ? "" : match.id)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ? "green" : "red"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.duration || "--:--"}</Badge>{activeGame && <Badge tone="cyan">Sélectionnée</Badge>}</div><p className="mt-3 truncate font-black text-white">{matchDisplayName(match)}</p><p className={cx("mt-1 truncate text-xs font-semibold", activeGame ? "text-cyan-100" : "text-slate-300")}>{match.game_id || ""}</p></button><div className="mt-3 flex justify-end"><Button type="button" variant="ghost" icon={ImageIcon} onClick={() => exportStatsPng({ title: matchDisplayName(match), subtitle: match?.game_id || "Export game", matches: [match], filename: `nxt5-game-${match?.game_id || "export"}.png` })}>Exporter la game</Button></div></div>; })}</div>
  </Surface>;
}

function TrendsPage({ data, selectedTeamId }) {
  const baseMatches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const matchCategories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [trendSourceModal, setTrendSourceModal] = useState(null);
  const [expandedTrendPatternId, setExpandedTrendPatternId] = useState("");
  const [expandedTeamModelId, setExpandedTeamModelId] = useState("win-condition");
  const matches = selectedCategoryId ? baseMatches.filter((match) => matchHasCategory(match, selectedCategoryId)) : baseMatches;
  const rows = matches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match })));
  const ally = rows.filter((row) => row.team_key === "ALLY");
  const enemy = rows.filter((row) => row.team_key === "ENEMY");
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const losses = matches.length - wins;
  const winrate = Math.round((wins / Math.max(1, matches.length)) * 100);
  if (!matches.length) return <div className="nxt5-data-dense min-w-0 overflow-hidden">
    <div className="mb-5 border-b border-cyan-100/10 pb-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2"><span className="h-px w-8 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-transparent" /><p className="text-[0.7rem] font-black uppercase tracking-[0.32em] text-cyan-100/85">Tendances</p></div>
          <h2 className="nxt5-metal-text max-w-4xl break-words py-1 text-3xl font-black leading-[1.14] tracking-tight sm:text-4xl lg:text-5xl">Cockpit stratégique</h2>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300 sm:text-base sm:leading-7">Lis les patterns de la team par scrim, match officiel ou catégorie custom.</p>
        </div>
        <Badge tone="slate">{baseMatches.length} game{baseMatches.length > 1 ? "s" : ""} importée{baseMatches.length > 1 ? "s" : ""}</Badge>
      </div>
      <div className="mt-5 border-t border-white/8 pt-3">
        <CategoryFilter categories={matchCategories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} label="Type de games" />
      </div>
    </div>
    <Surface glow><EmptyState icon={Activity} title="Aucune tendance disponible" text="Importe des games ou change de catégorie pour faire émerger les tendances." /></Surface>
  </div>;

  const avg = (value) => value / Math.max(1, matches.length);
  const avgInt = (value) => Math.round(avg(value));
  const signedAvg = (value) => `${value >= 0 ? "+" : ""}${formatPoints(avgInt(value))}`;
  const goldDiff = sumRows(ally, "gold") - sumRows(enemy, "gold");
  const damageDiff = sumRows(ally, "damage") - sumRows(enemy, "damage");
  const visionDiff = sumRows(ally, "vision") - sumRows(enemy, "vision");
  const deathsDiff = sumRows(ally, "deaths") - sumRows(enemy, "deaths");
  const identity = compositionIdentity(ally);
  const objectiveTotals = matches.reduce((total, match) => {
    const summary = objectiveTeamSummary(match, "ALLY");
    total.dragons += summary.dragonCount || 0;
    total.grubs += summary.grubs || 0;
    total.heralds += summary.heralds || 0;
    total.barons += summary.barons || 0;
    total.towers += summary.towers || 0;
    return total;
  }, { dragons: 0, grubs: 0, heralds: 0, barons: 0, towers: 0 });
  const categoryBreakdown = [
    ...matchCategories.map((category) => ({ id: category.id, name: category.name, color: matchCategoryTone(category), matches: baseMatches.filter((match) => matchHasCategory(match, category.id)) })),
    { id: "none", name: "Non classées", color: "slate", matches: baseMatches.filter((match) => !matchCategoryIds(match).length) }
  ].filter((entry) => entry.matches.length).map((entry) => {
    const entryRows = entry.matches.flatMap((match) => match.participants || []);
    const entryAlly = entryRows.filter((row) => row.team_key === "ALLY");
    const entryEnemy = entryRows.filter((row) => row.team_key === "ENEMY");
    const entryWins = entry.matches.filter((match) => match.result === "Victoire").length;
    return {
      ...entry,
      games: entry.matches.length,
      wins: entryWins,
      wr: Math.round((entryWins / Math.max(1, entry.matches.length)) * 100),
      goldDiff: Math.round((sumRows(entryAlly, "gold") - sumRows(entryEnemy, "gold")) / Math.max(1, entry.matches.length)),
      visionDiff: Math.round((sumRows(entryAlly, "vision") - sumRows(entryEnemy, "vision")) / Math.max(1, entry.matches.length)),
      damageDiff: Math.round((sumRows(entryAlly, "damage") - sumRows(entryEnemy, "damage")) / Math.max(1, entry.matches.length))
    };
  }).sort((a, b) => b.games - a.games || b.wr - a.wr);
  const championCounts = Array.from(ally.reduce((map, row) => {
    const key = championAssetId(row.champion);
    const current = map.get(key) || { champion: row.champion, games: 0, wins: 0, tags: championStyleTags(row.champion) };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    map.set(key, current);
    return map;
  }, new Map()).values()).sort((a, b) => b.games - a.games || b.wins - a.wins).slice(0, 8);
  const roleFocus = ROSTER_ROLE_ORDER.map((role) => {
    const roleRows = ally.filter((row) => normalizeProfileRole(row.role) === role);
    const games = roleRows.length;
    return { role, games, gold: sumRows(roleRows, "gold"), damage: sumRows(roleRows, "damage"), kills: sumRows(roleRows, "kills"), deaths: sumRows(roleRows, "deaths") };
  }).filter((stat) => stat.games).sort((a, b) => (b.gold + b.damage / 3) - (a.gold + a.damage / 3));
  const focusRole = roleFocus[0];
  const playerSignals = Array.from(ally.reduce((map, row) => {
    const key = row.player_id || row.summoner_name || row.riot_id || row.role || row.champion;
    const current = map.get(key) || { key, name: row.summoner_name || row.riot_id || row.role || "Profil", role: normalizeProfileRole(row.role), games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, gold: 0, vision: 0, kp: 0 };
    current.games += 1;
    current.wins += row.match?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.gold += Number(row.gold || 0);
    current.vision += Number(row.vision || 0);
    current.kp += parsePercent(row.kill_participation || row.kp || 0);
    map.set(key, current);
    return map;
  }, new Map()).values()).map((stat) => ({
    ...stat,
    wr: Math.round((stat.wins / Math.max(1, stat.games)) * 100),
    kda: Number(((stat.kills + stat.assists) / Math.max(1, stat.deaths)).toFixed(2)),
    avgGold: Math.round(stat.gold / Math.max(1, stat.games)),
    avgDamage: Math.round(stat.damage / Math.max(1, stat.games)),
    avgVision: Math.round(stat.vision / Math.max(1, stat.games)),
    avgKp: Math.round(stat.kp / Math.max(1, stat.games))
  })).sort((a, b) => (b.avgGold + b.avgDamage / 4 + b.avgVision * 80) - (a.avgGold + a.avgDamage / 4 + a.avgVision * 80));
  const pressureSignal = playerSignals.slice().sort((a, b) => b.deaths / Math.max(1, b.games) - a.deaths / Math.max(1, a.games))[0];
  const supportSignal = playerSignals.slice().sort((a, b) => b.avgVision - a.avgVision)[0];
  const kpSignal = playerSignals.slice().sort((a, b) => b.avgKp - a.avgKp)[0];
  const commonTags = (sourceRows) => Array.from(sourceRows.reduce((map, row) => {
    championStyleTags(row.champion).forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1));
    return map;
  }, new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const winRows = ally.filter((row) => row.match?.result === "Victoire");
  const lossRows = ally.filter((row) => row.match?.result === "Défaite");
  const winTags = commonTags(winRows);
  const lossTags = commonTags(lossRows);
  const objectiveRatio = (value, gamesCount) => {
    const ratio = Number(value || 0) / Math.max(1, gamesCount);
    return Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1);
  };
  const sideStats = ["Blue", "Red"].map((side) => {
    const sideMatches = matches.filter((match) => objectiveTeamKeyForSide(match, side.toUpperCase()) === "ALLY" || String(match.side || "").toLowerCase().includes(side.toLowerCase()));
    const sideWins = sideMatches.filter((match) => match.result === "Victoire").length;
    const objectives = sideMatches.reduce((total, match) => {
      const summary = objectiveTeamSummary(match, "ALLY");
      total.dragons += summary.dragonCount || 0;
      total.grubs += summary.grubs || 0;
      total.heralds += summary.heralds || 0;
      total.barons += summary.barons || 0;
      total.towers += summary.towers || 0;
      return total;
    }, { dragons: 0, grubs: 0, heralds: 0, barons: 0, towers: 0 });
    return { side, games: sideMatches.length, wins: sideWins, wr: Math.round((sideWins / Math.max(1, sideMatches.length)) * 100), objectives };
  });
  const roleFromRow = (row) => normalizeProfileRole(row?.role || row?.raw?.teamPosition || row?.raw?.individualPosition || row?.raw?.lane);
  const minuteFromTimestamp = (timestamp) => {
    const value = Number(timestamp || 0);
    return value > 0 ? value / 60000 : null;
  };
  const formatMinute = (value) => Number.isFinite(value) ? formatCountdown(Math.round(value * 60)) : "--";
  const averageValues = (values) => {
    const valid = values.filter((value) => Number.isFinite(value));
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  };
  const matchInsights = matches.map((match) => {
    const allyRows = teamRows(match, "ALLY");
    const enemyRows = teamRows(match, "ENEMY");
    const totalGold = Math.max(1, sumRows(allyRows, "gold"));
    const totalDamage = Math.max(1, sumRows(allyRows, "damage"));
    const roleStats = ROSTER_ROLE_ORDER.map((role) => {
      const row = allyRows.find((item) => roleFromRow(item) === role);
      const enemyRow = enemyRows.find((item) => roleFromRow(item) === role);
      const gold = statValue(row, "gold");
      const damage = statValue(row, "damage");
      const goldShare = (gold / totalGold) * 100;
      const damageShare = (damage / totalDamage) * 100;
      const kp = parsePercent(row?.kill_participation || row?.kp || 0);
      const cs10 = row ? csAtMinute({ ...row, match }, 10) : null;
      const cs20 = row ? csAtMinute({ ...row, match }, 20) : null;
      const enemyCs10 = enemyRow ? csAtMinute({ ...enemyRow, match }, 10) : null;
      const enemyCs20 = enemyRow ? csAtMinute({ ...enemyRow, match }, 20) : null;
      return {
        role,
        row,
        champion: row?.champion || "",
        tags: championStyleTags(row?.champion),
        goldShare,
        damageShare,
        kp,
        score: goldShare + damageShare * 1.1 + kp * 0.16,
        cs10Diff: Number.isFinite(cs10) && Number.isFinite(enemyCs10) ? cs10 - enemyCs10 : null,
        cs20Diff: Number.isFinite(cs20) && Number.isFinite(enemyCs20) ? cs20 - enemyCs20 : null,
      };
    }).filter((stat) => stat.row);
    const sortedRoles = roleStats.slice().sort((a, b) => b.score - a.score);
    const events = objectiveEvents(match);
    const allyEvents = events.filter((event) => event.teamKey === "ALLY");
    const firstByType = (type) => minuteFromTimestamp(allyEvents.find((event) => objectiveEventType(event) === type)?.timestamp);
    const firstObjectiveMinute = minuteFromTimestamp(allyEvents[0]?.timestamp);
    return {
      match,
      win: match.result === "Victoire",
      roleStats,
      sortedRoles,
      topRoles: sortedRoles.slice(0, 2).map((stat) => stat.role),
      firstObjectiveMinute,
      firstDragonMinute: firstByType("dragon"),
      firstGrubMinute: firstByType("grub"),
      firstHeraldMinute: firstByType("herald"),
      firstBaronMinute: firstByType("baron"),
      allyObjectiveCount: allyEvents.length,
    };
  });
  const matchKey = (match) => String(match?.id || match?.game_id || match?.match_id || matchDisplayName(match, "Game"));
  const sourceGameFromInsight = (entry) => {
    const match = entry.match;
    const allyRows = teamRows(match, "ALLY");
    const enemyRows = teamRows(match, "ENEMY");
    const topRole = entry.sortedRoles?.[0];
    const matchId = match.id || match.game_id || match.match_id || "";
    return {
      id: matchId,
      match,
      title: matchDisplayName(match, "Game"),
      result: match.result || "Analyse",
      side: match.side || "Side ?",
      patch: match.patch || "Patch ?",
      duration: match.duration || "--:--",
      goldDiff: sumRows(allyRows, "gold") - sumRows(enemyRows, "gold"),
      damageDiff: sumRows(allyRows, "damage") - sumRows(enemyRows, "damage"),
      visionDiff: sumRows(allyRows, "vision") - sumRows(enemyRows, "vision"),
      deaths: sumRows(allyRows, "deaths"),
      enemyDeaths: sumRows(enemyRows, "deaths"),
      firstObjective: formatMinute(entry.firstObjectiveMinute),
      objectiveCount: entry.allyObjectiveCount || 0,
      topRoles: entry.topRoles || [],
      topRoleLabel: topRole ? `${roleLabel(topRole.role)} · ${championDisplayName(topRole.champion)}` : "Rôle non isolé",
      topRoleDetail: topRole ? `${Math.round(topRole.goldShare)}% or · ${Math.round(topRole.damageShare)}% dégâts · KP ${Math.round(topRole.kp)}%` : "Pas assez de données rôle",
    };
  };
  const sourceGames = matchInsights.map(sourceGameFromInsight);
  const sourceGamesForMatches = (sourceMatches) => {
    const keys = new Set(sourceMatches.map(matchKey));
    return sourceGames.filter((game) => keys.has(matchKey(game.match)));
  };
  const sourceGamesForInsights = (entries) => sourceGamesForMatches(entries.map((entry) => entry.match));
  const sourceGamesForRole = (role) => sourceGamesForInsights(matchInsights.filter((entry) => entry.roleStats.some((stat) => stat.role === role)));
  const timelineGamesCount = sourceGames.filter((game) => game.firstObjective !== "--").length;
  const summarizeMatchSet = (targetMatches) => {
    const keys = new Set(targetMatches.map(matchKey));
    const targetInsights = matchInsights.filter((entry) => keys.has(matchKey(entry.match)));
    const targetRows = targetMatches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match })));
    const targetAlly = targetRows.filter((row) => row.team_key === "ALLY");
    const targetEnemy = targetRows.filter((row) => row.team_key === "ENEMY");
    const games = targetMatches.length;
    const firstObjectives = targetInsights.map((entry) => entry.firstObjectiveMinute).filter((value) => Number.isFinite(value));
    const objectives = targetMatches.reduce((total, match) => {
      const summary = objectiveTeamSummary(match, "ALLY");
      total.dragons += summary.dragonCount || 0;
      total.grubs += summary.grubs || 0;
      total.heralds += summary.heralds || 0;
      total.barons += summary.barons || 0;
      total.towers += summary.towers || 0;
      return total;
    }, { dragons: 0, grubs: 0, heralds: 0, barons: 0, towers: 0 });
    return {
      games,
      sourceGames: sourceGamesForMatches(targetMatches),
      goldDiff: Math.round((sumRows(targetAlly, "gold") - sumRows(targetEnemy, "gold")) / Math.max(1, games)),
      damageDiff: Math.round((sumRows(targetAlly, "damage") - sumRows(targetEnemy, "damage")) / Math.max(1, games)),
      visionDiff: Math.round((sumRows(targetAlly, "vision") - sumRows(targetEnemy, "vision")) / Math.max(1, games)),
      deaths: Number((sumRows(targetAlly, "deaths") / Math.max(1, games)).toFixed(1)),
      firstObjective: averageValues(firstObjectives),
      earlyObjectiveRate: Math.round((firstObjectives.filter((value) => value <= 9.5).length / Math.max(1, firstObjectives.length)) * 100),
      objectiveRate: Number(((objectives.dragons + objectives.grubs + objectives.heralds + objectives.barons) / Math.max(1, games)).toFixed(1)),
      tags: commonTags(targetAlly),
    };
  };
  const summarizePattern = (id, label, predicate, options = {}) => {
    const patternInsights = matchInsights.filter(predicate);
    const patternMatches = patternInsights.map((entry) => entry.match);
    const patternRows = patternMatches.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match })));
    const patternAlly = patternRows.filter((row) => row.team_key === "ALLY");
    const patternEnemy = patternRows.filter((row) => row.team_key === "ENEMY");
    const games = patternInsights.length;
    const patternWins = patternInsights.filter((entry) => entry.win).length;
    const wr = Math.round((patternWins / Math.max(1, games)) * 100);
    const verdict = games < 2 ? "échantillon faible" : wr >= 58 ? "levier validé" : wr >= 48 ? "rendement neutre" : "rendement défavorable";
    const verdictTone = games < 2 ? "slate" : wr >= 58 ? "green" : wr >= 48 ? "orange" : "red";
    const avgGoldDiff = Math.round((sumRows(patternAlly, "gold") - sumRows(patternEnemy, "gold")) / Math.max(1, games));
    const avgDamageDiff = Math.round((sumRows(patternAlly, "damage") - sumRows(patternEnemy, "damage")) / Math.max(1, games));
    const cs10 = averageValues(patternInsights.flatMap((entry) => entry.roleStats.map((stat) => stat.cs10Diff)));
    const cs20 = averageValues(patternInsights.flatMap((entry) => entry.roleStats.map((stat) => stat.cs20Diff)));
    const firstObjective = averageValues(patternInsights.map((entry) => entry.firstObjectiveMinute));
    const firstDragon = averageValues(patternInsights.map((entry) => entry.firstDragonMinute));
    const firstGrub = averageValues(patternInsights.map((entry) => entry.firstGrubMinute));
    const bestRole = ROSTER_ROLE_ORDER.map((role) => ({
      role,
      score: averageValues(patternInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.score)),
      cs10: averageValues(patternInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.cs10Diff)),
    })).filter((stat) => Number.isFinite(stat.score)).sort((a, b) => b.score - a.score)[0];
    return {
      id,
      label,
      tone: options.tone || verdictTone,
      games,
      wins: patternWins,
      wr,
      verdict,
      verdictTone,
      bestRole,
      avgGoldDiff,
      avgDamageDiff,
      cs10,
      cs20,
      firstObjective,
      sourceGames: patternInsights.map(sourceGameFromInsight),
      details: [
        `${games} game${games > 1 ? "s" : ""} · ${patternWins}W-${games - patternWins}L · ${wr}% WR`,
        `Écart or ${formatGoldDiff(avgGoldDiff)} · dégâts ${avgDamageDiff >= 0 ? "+" : ""}${formatPoints(avgDamageDiff)}`,
        `CS10 ${Number.isFinite(cs10) ? `${cs10 >= 0 ? "+" : ""}${cs10.toFixed(1)}` : "n/a"} · CS20 ${Number.isFinite(cs20) ? `${cs20 >= 0 ? "+" : ""}${cs20.toFixed(1)}` : "n/a"}`,
        `1er obj ${formatMinute(firstObjective)}${Number.isFinite(firstDragon) ? ` · Drake ${formatMinute(firstDragon)}` : Number.isFinite(firstGrub) ? ` · Grubs ${formatMinute(firstGrub)}` : ""}`,
      ],
      read: games ? `${label} : ${verdict}. ${games} game${games > 1 ? "s" : ""}, ${patternWins}W-${games - patternWins}L, ${wr}% WR, ${formatGoldDiff(avgGoldDiff)} or/game et ${Number.isFinite(firstObjective) ? `premier objectif moyen à ${formatMinute(firstObjective)}` : "timing objectif non disponible"}.` : "",
    };
  };
  const hasTags = (stat, tags) => tags.some((tag) => stat?.tags?.includes(tag));
  const autoPatterns = [
    summarizePattern("adc-centric", "ADC centrique", (entry) => {
      const adc = entry.roleStats.find((stat) => stat.role === "ADC");
      return entry.topRoles[0] === "ADC" || (adc && (adc.score >= 54 || adc.goldShare >= 23 || adc.damageShare >= 29));
    }, { tone: "cyan" }),
    summarizePattern("jgl-mid", "Axe JGL + MID", (entry) => {
      const roles = new Set(entry.topRoles);
      const jungle = entry.roleStats.find((stat) => stat.role === "JGL");
      const mid = entry.roleStats.find((stat) => stat.role === "MID");
      return (roles.has("JGL") && roles.has("MID")) || ((jungle?.score || 0) + (mid?.score || 0) >= 94);
    }, { tone: "purple" }),
    summarizePattern("top-frontline", "TOP frontline / tank", (entry) => {
      const top = entry.roleStats.find((stat) => stat.role === "TOP");
      return hasTags(top, ["frontline", "engage", "teamfight", "control", "sustain", "peel"]);
    }, { tone: "green" }),
    summarizePattern("early-objectives", "Contrôle objectifs early", (entry) => Number.isFinite(entry.firstObjectiveMinute) && entry.firstObjectiveMinute <= 9.5, { tone: "orange" }),
    summarizePattern("front-to-back", "Front-to-back / scaling", (entry) => entry.roleStats.flatMap((stat) => stat.tags).filter((tag) => ["front-to-back", "scaling", "peel", "control"].includes(tag)).length >= 3, { tone: "blue" }),
  ].filter((pattern) => pattern.games).sort((a, b) => b.games - a.games || b.wr - a.wr).slice(0, 5);
  const laneTimings = ROSTER_ROLE_ORDER.map((role) => {
    const values10 = matchInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.cs10Diff).filter((value) => Number.isFinite(value));
    const values20 = matchInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)?.cs20Diff).filter((value) => Number.isFinite(value));
    return {
      role,
      cs10: averageValues(values10),
      cs20: averageValues(values20),
      samples: Math.max(values10.length, values20.length),
    };
  }).filter((stat) => stat.samples).sort((a, b) => Math.abs(b.cs10 || 0) - Math.abs(a.cs10 || 0));
  const strongestPattern = autoPatterns[0] || null;
  const fragilePattern = autoPatterns.slice().filter((pattern) => pattern.games >= 2).sort((a, b) => a.wr - b.wr || b.games - a.games)[0] || null;
  const bestLaneTiming = laneTimings.filter((stat) => Number.isFinite(stat.cs10)).sort((a, b) => b.cs10 - a.cs10)[0] || null;
  const worstLaneTiming = laneTimings.filter((stat) => Number.isFinite(stat.cs10)).sort((a, b) => a.cs10 - b.cs10)[0] || null;
  const objectiveTimingValues = matchInsights.map((entry) => entry.firstObjectiveMinute).filter((value) => Number.isFinite(value));
  const averageFirstObjective = averageValues(objectiveTimingValues);
  const earlyObjectiveRate = Math.round((objectiveTimingValues.filter((value) => value <= 9.5).length / Math.max(1, objectiveTimingValues.length)) * 100);
  const bestSide = sideStats.filter((stat) => stat.games).sort((a, b) => b.wr - a.wr || b.games - a.games)[0] || null;
  const topDamageSignal = playerSignals.slice().sort((a, b) => b.avgDamage - a.avgDamage)[0] || null;
  const teamKpAverage = Math.round(ally.reduce((total, row) => total + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, ally.length));
  const teamCsAverage = (ally.reduce((total, row) => total + Number(row.cs_per_min || 0), 0) / Math.max(1, ally.length)).toFixed(1);
  const deathsPerGame = Number(objectiveRatio(sumRows(ally, "deaths"), matches.length));
  const winModel = summarizeMatchSet(matches.filter((match) => match.result === "Victoire"));
  const lossModel = summarizeMatchSet(matches.filter((match) => match.result === "Défaite"));
  const roleSystemRows = ROSTER_ROLE_ORDER.map((role) => {
    const roleInsights = matchInsights.filter((entry) => entry.roleStats.some((stat) => stat.role === role));
    const samples = roleInsights.map((entry) => entry.roleStats.find((stat) => stat.role === role)).filter(Boolean);
    const championText = Array.from(samples.reduce((map, stat) => {
      if (stat.champion) map.set(stat.champion, (map.get(stat.champion) || 0) + 1);
      return map;
    }, new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([champion, count]) => `${championDisplayName(champion)} x${count}`).join(" · ");
    const winsForRole = roleInsights.filter((entry) => entry.win).length;
    const goldShare = averageValues(samples.map((stat) => stat.goldShare));
    const damageShare = averageValues(samples.map((stat) => stat.damageShare));
    const kp = averageValues(samples.map((stat) => stat.kp));
    const cs10 = averageValues(samples.map((stat) => stat.cs10Diff));
    const cs20 = averageValues(samples.map((stat) => stat.cs20Diff));
    const score = averageValues(samples.map((stat) => stat.score));
    const functionLabel = damageShare >= 28 ? "Carry dégâts" : goldShare >= 23 ? "Ressources fortes" : kp >= 65 ? "Connecteur fights" : (cs10 || 0) >= 4 ? "Priorité lane" : (cs10 || 0) <= -4 ? "Lane sous pression" : "Rôle stable";
    return {
      role,
      games: samples.length,
      wins: winsForRole,
      wr: Math.round((winsForRole / Math.max(1, samples.length)) * 100),
      goldShare,
      damageShare,
      kp,
      cs10,
      cs20,
      score,
      championText,
      functionLabel,
      sourceGames: sourceGamesForRole(role),
      toneName: (cs10 || 0) < -5 ? "red" : damageShare >= 28 || goldShare >= 23 || kp >= 65 ? "green" : "cyan",
    };
  }).filter((row) => row.games).sort((a, b) => (b.score || 0) - (a.score || 0));
  const focusRoleModel = roleSystemRows.find((row) => row.role === focusRole?.role) || roleSystemRows[0];
  const objectiveSourceGames = matchInsights.filter((entry) => Number.isFinite(entry.firstObjectiveMinute)).map(sourceGameFromInsight);
  const teamModelCards = [
    {
      id: "win-condition",
      toneName: strongestPattern?.verdictTone || championStyleTone(identity.primary),
      label: "Condition de victoire",
      title: strongestPattern ? strongestPattern.label : tagLabel(identity.primary),
      value: strongestPattern ? `${strongestPattern.wr}% WR` : `${winrate}% WR`,
      text: strongestPattern ? `Le plan qui revient le plus : ${strongestPattern.games} games, ${strongestPattern.wins}W-${strongestPattern.games - strongestPattern.wins}L. C'est la meilleure hypothèse actuelle pour comprendre comment l'équipe veut gagner.` : `Aucun pattern dominant assez net : l'identité la plus visible reste ${tagLabel(identity.primary)}.`,
      details: strongestPattern?.details || draftNeeds,
      sourceGames: strongestPattern?.sourceGames || sourceGames,
    },
    {
      id: "resource-map",
      toneName: focusRoleModel?.toneName || "cyan",
      label: "Répartition des rôles",
      title: focusRoleModel ? `${roleLabel(focusRoleModel.role)} structure le jeu` : "Ressources non isolées",
      value: focusRoleModel ? `${Math.round(focusRoleModel.goldShare || 0)}% or` : "--",
      text: focusRoleModel ? `${roleLabel(focusRoleModel.role)} capte ${Math.round(focusRoleModel.goldShare || 0)}% de l'or, ${Math.round(focusRoleModel.damageShare || 0)}% des dégâts et ${Math.round(focusRoleModel.kp || 0)}% KP. À lire comme le rôle autour duquel l'équipe s'organise le plus souvent.` : "Le volume ne permet pas encore de lire une répartition fiable.",
      details: roleSystemRows.slice(0, 3).map((row) => `${roleLabel(row.role)} : ${row.functionLabel}, ${Math.round(row.goldShare || 0)}% or, ${Math.round(row.damageShare || 0)}% dégâts, ${row.wr}% WR`),
      sourceGames: focusRoleModel?.sourceGames || sourceGames,
    },
    {
      id: "tempo-map",
      toneName: averageFirstObjective && averageFirstObjective <= 9.5 ? "green" : averageFirstObjective && averageFirstObjective <= 12 ? "orange" : "red",
      label: "Tempo carte",
      title: `Premier objectif ${formatMinute(averageFirstObjective)}`,
      value: `${earlyObjectiveRate}% early`,
      text: `${earlyObjectiveRate}% des games avec un premier objectif avant 9:30. La moyenne actuelle est ${formatMinute(averageFirstObjective)}, avec ${objectiveRatio(objectiveTotals.dragons, matches.length)} drakes/game et ${objectiveRatio(objectiveTotals.grubs, matches.length)} grubs/game.`,
      details: [`Timings exploitables : ${objectiveTimingValues.length}/${matches.length}`, `Objectifs neutres/game : ${objectiveRatio(objectiveTotals.dragons + objectiveTotals.grubs + objectiveTotals.heralds + objectiveTotals.barons, matches.length)}`, bestSide && `Side le plus rentable : ${bestSide.side} (${bestSide.wr}% WR sur ${bestSide.games}G)`].filter(Boolean),
      sourceGames: objectiveSourceGames,
    },
    {
      id: "fail-state",
      toneName: deathsPerGame >= 20 || fragilePattern?.wr < 45 ? "red" : "orange",
      label: "Fail state",
      title: fragilePattern ? `Risque : ${fragilePattern.label}` : "Risque principal",
      value: `${deathsPerGame.toFixed(Number.isInteger(deathsPerGame) ? 0 : 1)} morts/G`,
      text: fragilePattern ? `${fragilePattern.label} tombe à ${fragilePattern.wr}% WR. Quand ce pattern sort mal, la review doit vérifier les morts avant objectif, la vision et la surcharge d'une seule win condition.` : `Le signal le plus instable vient de l'exposition : ${pressureSignal ? `${pressureSignal.name} à ${(pressureSignal.deaths / Math.max(1, pressureSignal.games)).toFixed(1)} morts/game` : `${deathsPerGame} morts/game`}.`,
      details: [pressureSignal && `${pressureSignal.name} : ${(pressureSignal.deaths / Math.max(1, pressureSignal.games)).toFixed(1)} morts/G`, `Défaites : ${lossModel.games} games, ${formatGoldDiff(lossModel.goldDiff)} or/game`, `Vision en défaite : ${lossModel.visionDiff >= 0 ? "+" : ""}${lossModel.visionDiff}`].filter(Boolean),
      sourceGames: fragilePattern?.sourceGames?.length ? fragilePattern.sourceGames : lossModel.sourceGames.length ? lossModel.sourceGames : sourceGames,
    },
  ];
  const swingRows = [
    {
      id: "gold",
      label: "Or",
      win: formatGoldDiff(winModel.goldDiff),
      loss: formatGoldDiff(lossModel.goldDiff),
      read: `En victoire l'équipe tourne à ${formatGoldDiff(winModel.goldDiff)} or/game ; en défaite à ${formatGoldDiff(lossModel.goldDiff)}.`,
      toneName: winModel.goldDiff >= lossModel.goldDiff ? "green" : "red",
    },
    {
      id: "deaths",
      label: "Morts",
      win: `${winModel.deaths}/G`,
      loss: `${lossModel.deaths}/G`,
      read: `La discipline change fortement si les défaites montent au-dessus des victoires : ${lossModel.deaths}/G contre ${winModel.deaths}/G.`,
      toneName: lossModel.deaths > winModel.deaths ? "red" : "green",
    },
    {
      id: "tempo",
      label: "1er objectif",
      win: formatMinute(winModel.firstObjective),
      loss: formatMinute(lossModel.firstObjective),
      read: `Tempo moyen en victoire : ${formatMinute(winModel.firstObjective)}. Tempo moyen en défaite : ${formatMinute(lossModel.firstObjective)}.`,
      toneName: Number.isFinite(winModel.firstObjective) && Number.isFinite(lossModel.firstObjective) && winModel.firstObjective <= lossModel.firstObjective ? "green" : "orange",
    },
    {
      id: "identity",
      label: "Draft gagnante",
      win: winModel.tags[0] ? tagLabel(winModel.tags[0][0]) : "--",
      loss: lossModel.tags[0] ? tagLabel(lossModel.tags[0][0]) : "--",
      read: `Tag le plus présent en win : ${winModel.tags[0] ? tagLabel(winModel.tags[0][0]) : "n/a"}. Tag le plus présent en loss : ${lossModel.tags[0] ? tagLabel(lossModel.tags[0][0]) : "n/a"}.`,
      toneName: "purple",
    },
  ];
  const coachKpis = [
    { label: "Échantillon", value: `${matches.length}G`, detail: `${wins}W-${losses}L · ${winrate}% WR`, toneName: matches.length >= 5 ? "green" : "orange" },
    { label: "Diff. or", value: formatGoldDiff(avgInt(goldDiff)), detail: "moyenne/game", toneName: diffTone(goldDiff) },
    { label: "1er objectif", value: formatMinute(averageFirstObjective), detail: `${earlyObjectiveRate}% ≤ 9:30`, toneName: earlyObjectiveRate >= 60 ? "green" : earlyObjectiveRate >= 35 ? "orange" : "red" },
    { label: "Morts", value: deathsPerGame.toFixed(Number.isInteger(deathsPerGame) ? 0 : 1), detail: "alliées/game", toneName: deathsPerGame <= 15 ? "green" : deathsPerGame >= 20 ? "red" : "orange" },
  ];
  const coachBriefs = [
    {
      toneName: winrate >= 55 ? "green" : winrate >= 45 ? "orange" : "red",
      label: "Diagnostic",
      title: `${winrate >= 55 ? "Bloc favorable" : winrate >= 45 ? "Bloc compétitif mais instable" : "Bloc défavorable"}`,
      text: `${matches.length} games analysées, ${wins}W-${losses}L. Écarts moyens : ${formatGoldDiff(avgInt(goldDiff))} or, ${signedAvg(damageDiff)} dégâts, ${signedAvg(visionDiff)} vision. Le volume ${matches.length >= 5 ? "permet une lecture exploitable" : "reste court : priorité à la validation sur le prochain bloc"}.`,
      evidence: [`WR ${winrate}%`, `morts ${objectiveRatio(sumRows(ally, "deaths"), matches.length)}/game`, `KP équipe ${teamKpAverage}%`],
      sourceGames,
    },
    strongestPattern && {
      toneName: strongestPattern.verdictTone,
      label: "Plan de jeu",
      title: `${strongestPattern.label} · ${strongestPattern.verdict}`,
      text: `${strongestPattern.games} occurrence${strongestPattern.games > 1 ? "s" : ""}, ${strongestPattern.wins}W-${strongestPattern.games - strongestPattern.wins}L, ${strongestPattern.wr}% WR. ${strongestPattern.bestRole ? `${roleLabel(strongestPattern.bestRole.role)} est le rôle le plus porteur dans ce pattern` : "Rôle porteur non isolé"}, avec ${formatGoldDiff(strongestPattern.avgGoldDiff)} or/game et ${strongestPattern.avgDamageDiff >= 0 ? "+" : ""}${formatPoints(strongestPattern.avgDamageDiff)} dégâts/game.`,
      evidence: [`Pattern ${strongestPattern.games} games`, `CS10 ${Number.isFinite(strongestPattern.cs10) ? `${strongestPattern.cs10 >= 0 ? "+" : ""}${strongestPattern.cs10.toFixed(1)}` : "n/a"}`, `1er obj ${formatMinute(strongestPattern.firstObjective)}`],
      sourceGames: strongestPattern.sourceGames,
    },
    {
      toneName: averageFirstObjective && averageFirstObjective <= 9.5 ? "green" : averageFirstObjective && averageFirstObjective <= 12 ? "orange" : "red",
      label: "Objectifs",
      title: `Tempo objectifs : ${formatMinute(averageFirstObjective)}`,
      text: `${objectiveRatio(objectiveTotals.dragons, matches.length)} drakes/game, ${objectiveRatio(objectiveTotals.grubs, matches.length)} grubs/game, ${objectiveRatio(objectiveTotals.towers, matches.length)} tours/game. ${earlyObjectiveRate}% des games avec un premier objectif allié avant 9:30${bestSide ? ` ; meilleur side actuel : ${bestSide.side} (${bestSide.wr}% WR sur ${bestSide.games}G)` : ""}.`,
      evidence: [`Nashor ${objectiveRatio(objectiveTotals.barons, matches.length)}/game`, `Herald ${objectiveRatio(objectiveTotals.heralds, matches.length)}/game`, `${objectiveTimingValues.length}/${matches.length} timings`],
      sourceGames: objectiveSourceGames,
    },
    {
      toneName: worstLaneTiming && worstLaneTiming.cs10 < -5 ? "red" : bestLaneTiming && bestLaneTiming.cs10 > 5 ? "green" : "orange",
      label: "Laning",
      title: worstLaneTiming && worstLaneTiming.cs10 < -5 ? `${roleLabel(worstLaneTiming.role)} sous pression` : bestLaneTiming ? `${roleLabel(bestLaneTiming.role)} crée la priorité` : "Lecture lane limitée",
      text: `${bestLaneTiming ? `${roleLabel(bestLaneTiming.role)} meilleur CS10 (${bestLaneTiming.cs10 >= 0 ? "+" : ""}${bestLaneTiming.cs10.toFixed(1)})` : "Pas de CS10 fiable"}.${worstLaneTiming ? ` Point de contrôle : ${roleLabel(worstLaneTiming.role)} au CS10 (${worstLaneTiming.cs10 >= 0 ? "+" : ""}${worstLaneTiming.cs10.toFixed(1)}), CS20 ${Number.isFinite(worstLaneTiming.cs20) ? `${worstLaneTiming.cs20 >= 0 ? "+" : ""}${worstLaneTiming.cs20.toFixed(1)}` : "n/a"}.` : ""} À revoir : wave 1-3, premier reset et move river associé.`,
      evidence: [bestLaneTiming && `${roleLabel(bestLaneTiming.role)} ${bestLaneTiming.samples} sample(s)`, worstLaneTiming && `${roleLabel(worstLaneTiming.role)} ${worstLaneTiming.samples} sample(s)`, `CS/min ${teamCsAverage}`].filter(Boolean),
      sourceGames: sourceGamesForInsights(matchInsights.filter((entry) => entry.roleStats.some((stat) => [bestLaneTiming?.role, worstLaneTiming?.role].filter(Boolean).includes(stat.role)))),
    },
    {
      toneName: deathsPerGame >= 20 || fragilePattern?.wr < 45 ? "red" : "purple",
      label: "Priorité review",
      title: fragilePattern ? `Stabiliser ${fragilePattern.label}` : "Conserver les forces identifiées",
      text: fragilePattern ? `${fragilePattern.label} descend à ${fragilePattern.wr}% WR sur ${fragilePattern.games} games. Croiser cette séquence avec les morts avant objectif, la vision du side faible et le champion pool associé.` : `${topDamageSignal?.name || "Carry principal"} porte ${topDamageSignal ? formatPoints(topDamageSignal.avgDamage) : "n/a"} dégâts moyens ; ${kpSignal?.name || "le meilleur KP"} atteint ${kpSignal?.avgKp || 0}% KP. Objectif : conserver le plan fort sans surcharger une seule condition de victoire.`,
      evidence: [pressureSignal && `${pressureSignal.name} ${((pressureSignal.deaths || 0) / Math.max(1, pressureSignal.games)).toFixed(1)} morts/G`, supportSignal && `${supportSignal.name} vision ${supportSignal.avgVision}`, topDamageSignal && `${topDamageSignal.name} ${formatPoints(topDamageSignal.avgDamage)} dmg`].filter(Boolean),
      sourceGames: fragilePattern?.sourceGames || sourceGames,
    },
  ].filter(Boolean).slice(0, 5);
  const autoReads = coachBriefs.map((brief) => `${brief.label} — ${brief.title}. ${brief.text}`);
  const forceItems = [
    `${wins}W - ${losses}L sur ${matches.length} game${matches.length > 1 ? "s" : ""} (${winrate}% WR).`,
    `Écart or moyen: ${formatGoldDiff(avgInt(goldDiff))} par game.`,
    `Écart dégâts moyen: ${signedAvg(damageDiff)} par game.`,
    `Écart vision moyen: ${signedAvg(visionDiff)} par game.`,
    focusRole && `Ressources dominantes: ${roleLabel(focusRole.role)} (${formatPoints(avgInt(focusRole.gold))} or · ${formatPoints(avgInt(focusRole.damage))} dégâts).`
  ].filter(Boolean).slice(0, 5);
  const riskItems = [
    `Écart morts moyen: ${signedAvg(deathsDiff)} par game.`,
    `Morts alliées: ${objectiveRatio(sumRows(ally, "deaths"), matches.length)} par game.`,
    pressureSignal && `${pressureSignal.name}: ${(pressureSignal.deaths / Math.max(1, pressureSignal.games)).toFixed(1)} morts/game.`,
    `Nashor: ${objectiveRatio(objectiveTotals.barons, matches.length)} par game.`,
    `Tours: ${objectiveRatio(objectiveTotals.towers, matches.length)} par game.`
  ].filter(Boolean).slice(0, 5);
  const timingItems = [
    `Drakes: ${objectiveRatio(objectiveTotals.dragons, matches.length)} par game.`,
    `Grubs: ${objectiveRatio(objectiveTotals.grubs, matches.length)} par game.`,
    `Herald: ${objectiveRatio(objectiveTotals.heralds, matches.length)} par game.`,
    `Nashor: ${objectiveRatio(objectiveTotals.barons, matches.length)} par game.`,
    `Tours: ${objectiveRatio(objectiveTotals.towers, matches.length)} par game.`
  ];
  const draftNeeds = [
    identity.tags[0] && `${tagLabel(identity.tags[0][0])}: ${identity.tags[0][1]} pick(s).`,
    identity.tags[1] && `${tagLabel(identity.tags[1][0])}: ${identity.tags[1][1]} pick(s).`,
    identity.tags[2] && `${tagLabel(identity.tags[2][0])}: ${identity.tags[2][1]} pick(s).`,
    winTags[0] && `En victoire: ${tagLabel(winTags[0][0])} x${winTags[0][1]}.`,
    lossTags[0] && `En défaite: ${tagLabel(lossTags[0][0])} x${lossTags[0][1]}.`
  ].filter(Boolean).slice(0, 5);
  const recommendations = [
    kpSignal && `KP moyen le plus haut: ${kpSignal.name} (${kpSignal.avgKp}%).`,
    supportSignal && `Vision moyenne la plus haute: ${supportSignal.name} (${supportSignal.avgVision}).`,
    playerSignals[0] && `Dégâts moyens max: ${playerSignals.slice().sort((a, b) => b.avgDamage - a.avgDamage)[0]?.name || "-"} (${formatPoints(playerSignals.slice().sort((a, b) => b.avgDamage - a.avgDamage)[0]?.avgDamage || 0)}).`,
    `KP moyen équipe: ${Math.round(ally.reduce((total, row) => total + parsePercent(row.kill_participation || row.kp || 0), 0) / Math.max(1, ally.length))}%.`,
    `CS/min moyen équipe: ${(ally.reduce((total, row) => total + Number(row.cs_per_min || 0), 0) / Math.max(1, ally.length)).toFixed(1)}.`
  ].filter(Boolean).slice(0, 5);
  const trendToneClass = {
    cyan: "from-cyan-400/14 via-white/[0.035] to-transparent text-cyan-100",
    green: "from-emerald-400/14 via-white/[0.035] to-transparent text-emerald-100",
    red: "from-rose-400/14 via-white/[0.035] to-transparent text-rose-100",
    purple: "from-fuchsia-400/14 via-white/[0.035] to-transparent text-fuchsia-100",
    orange: "from-amber-400/14 via-white/[0.035] to-transparent text-amber-100",
  };
  const TrendPanel = ({ title, icon: Icon, items, tone = "cyan" }) => <section className="nxt5-flat-block flex h-full min-h-[9.5rem] flex-col rounded-xl border p-3"><div className="flex items-center gap-2.5"><span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br", trendToneClass[tone] || trendToneClass.cyan)}><Icon className="h-4 w-4" /></span><h3 className="min-w-0 truncate text-sm font-black text-white">{title}</h3></div><div className="mt-2.5 flex-1 divide-y divide-white/8">{items.length ? items.slice(0, 3).map((item, index) => <div key={item} className="flex gap-2.5 py-2 first:pt-0 last:pb-0"><span className={cx("mt-2 h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]", tone === "red" ? "bg-rose-300 text-rose-300" : tone === "green" ? "bg-emerald-300 text-emerald-300" : tone === "purple" ? "bg-fuchsia-300 text-fuchsia-300" : tone === "orange" ? "bg-amber-300 text-amber-300" : "bg-cyan-300 text-cyan-300")} /><p className="min-w-0 text-xs font-semibold leading-5 text-slate-200">{index === 0 ? <span className="font-black text-white">{item}</span> : item}</p></div>) : <p className="py-2 text-xs font-semibold text-slate-300">Pas assez de volume.</p>}</div></section>;
  const activeTrendCategory = matchCategories.find((category) => String(category.id || "") === String(selectedCategoryId || ""));
  const topMetrics = [
    { icon: Trophy, label: "Winrate", value: `${winrate}%`, hint: `${wins}W - ${losses}L`, tone: winrate >= 50 ? "green" : "red" },
    { icon: Flame, label: "Dégâts moyens", value: signedAvg(damageDiff), hint: "Par game", tone: diffTone(damageDiff) },
    { icon: Eye, label: "Vision moyenne", value: signedAvg(visionDiff), hint: "Par game", tone: diffTone(visionDiff) },
    { icon: Shield, label: "Morts alliées", value: objectiveRatio(sumRows(ally, "deaths"), matches.length), hint: "Par game", tone: avg(sumRows(ally, "deaths")) <= 15 ? "green" : avg(sumRows(ally, "deaths")) >= 20 ? "red" : "orange" },
  ];
  const diffChartItems = [
    { label: "Or", value: avgInt(goldDiff), display: formatGoldDiff(avgInt(goldDiff)), tone: diffTone(goldDiff) },
    { label: "Dégâts", value: avgInt(damageDiff), display: signedAvg(damageDiff), tone: diffTone(damageDiff) },
    { label: "Vision", value: avgInt(visionDiff), display: signedAvg(visionDiff), tone: diffTone(visionDiff) },
    { label: "Morts", value: avgInt(deathsDiff), display: signedAvg(deathsDiff), tone: deathsDiff <= 0 ? "green" : "red" },
  ];
  const objectiveChartItems = [
    ["Drakes", objectiveTotals.dragons, "cyan"],
    ["Grubs", objectiveTotals.grubs, "purple"],
    ["Herald", objectiveTotals.heralds, "blue"],
    ["Nashor", objectiveTotals.barons, "orange"],
    ["Tours", objectiveTotals.towers, "green"],
  ].map(([label, value, toneName]) => ({ label, value: Number(value || 0) / Math.max(1, matches.length), display: objectiveRatio(value, matches.length), tone: toneName }));
  const roleResourceChartItems = roleFocus.slice(0, 5).map((stat) => ({
    label: roleLabel(stat.role),
    value: Math.round((stat.gold + stat.damage / 3) / Math.max(1, stat.games)),
    detail: `${formatPoints(Math.round(stat.gold / Math.max(1, stat.games)))} or · ${formatPoints(Math.round(stat.damage / Math.max(1, stat.games)))} dégâts`,
    role: stat.role,
  }));
  const maxDiffChart = Math.max(1, ...diffChartItems.map((item) => Math.abs(item.value)));
  const maxObjectiveChart = Math.max(1, ...objectiveChartItems.map((item) => item.value));
  const maxRoleResourceChart = Math.max(1, ...roleResourceChartItems.map((item) => item.value));
  const barToneClass = {
    cyan: "from-cyan-300 to-cyan-500",
    blue: "from-sky-300 to-blue-500",
    green: "from-emerald-300 to-emerald-500",
    red: "from-rose-300 to-rose-500",
    purple: "from-fuchsia-300 to-violet-500",
    orange: "from-amber-300 to-orange-500",
    slate: "from-slate-300 to-slate-500",
  };
  const SignedBar = ({ item }) => {
    const positive = item.value >= 0;
    const width = Math.max(6, Math.min(50, (Math.abs(item.value) / maxDiffChart) * 50));
  return <div className="rounded-xl border border-white/10 bg-black/20 p-2.5"><div className="flex items-center justify-between gap-3"><span className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-300">{item.label}</span><span className={cx("text-sm font-black", item.tone === "red" ? "text-rose-100" : item.tone === "green" ? "text-emerald-100" : "text-cyan-100")}>{item.display}</span></div><div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/[0.055]"><span className="absolute left-1/2 top-0 h-full w-px bg-white/24" /><span className={cx("absolute top-0 h-full rounded-full bg-gradient-to-r", barToneClass[item.tone] || barToneClass.cyan)} style={positive ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }} /></div></div>;
  };
  const VerticalBar = ({ item, max }) => {
    const height = Math.max(10, Math.min(100, (Number(item.value || 0) / max) * 100));
    return <div className="flex min-w-0 flex-col justify-end rounded-xl border border-white/10 bg-black/18 p-2 text-center"><div className="flex h-20 items-end justify-center"><span className={cx("w-full max-w-[2rem] rounded-t-xl bg-gradient-to-t shadow-[0_0_18px_rgba(34,211,238,.12)]", barToneClass[item.tone] || barToneClass.cyan)} style={{ height: `${height}%` }} /></div><p className="mt-2 text-base font-black text-white">{item.display}</p><p className="truncate text-[0.56rem] font-black uppercase tracking-[0.12em] text-slate-300">{item.label}</p></div>;
  };
  const RoleResourceBar = ({ item }) => {
    const width = Math.max(8, Math.min(100, (item.value / maxRoleResourceChart) * 100));
    return <div className="rounded-xl border border-white/10 bg-black/18 p-2.5"><div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><RoleIcon role={item.role} className="h-4 w-4 shrink-0" /><span className="truncate text-sm font-black text-white">{item.label}</span></span><span className="shrink-0 text-xs font-semibold text-slate-300">{item.detail}</span></div><div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/[0.055]"><span className="block h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400" style={{ width: `${width}%` }} /></div></div>;
  };
  const exportTrendSections = [
    { title: "Modèle d'équipe", items: teamModelCards.map((card) => `${card.label}: ${card.title}. ${card.text}`), tone: "cyan" },
    { title: "Lecture automatique", items: autoReads, tone: "cyan" },
    { title: "Écarts moyens", items: forceItems, tone: "green" },
    { title: "Pression et exposition", items: riskItems, tone: "red" },
    { title: "Objectifs / game", items: timingItems, tone: "cyan" },
    { title: "Identité draft", items: draftNeeds, tone: "purple" },
    { title: "Ratios profils", items: recommendations, tone: "orange" },
  ];
  const exportTrends = () => exportTrendsPng({
    title: "Cockpit stratégique",
    subtitle: `${activeTrendCategory?.name || "Toutes les games"} · ${matches.length} game${matches.length > 1 ? "s" : ""} · ${wins}W - ${losses}L`,
    metrics: topMetrics,
    sections: exportTrendSections,
    champions: championCounts,
    filename: `nxt5-tendances-${String(activeTrendCategory?.name || "global").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
  });
  const sourceScopeMetrics = [
    { label: "Contexte", value: activeTrendCategory?.name || "Toutes" },
    { label: "Games", value: String(matches.length) },
    { label: "Timelines", value: `${timelineGamesCount}/${matches.length}` },
    { label: "WR", value: `${winrate}%` },
  ];
  const openTrendSources = ({ title, subtitle, metrics, games }) => setTrendSourceModal({
    title,
    subtitle,
    metrics: metrics || sourceScopeMetrics,
    games: games?.length ? games : sourceGames,
  });
  const openSourceGame = (game) => {
    const matchId = game?.id || game?.match?.id || game?.match?.game_id || "";
    openAppPath(matchId ? `/statistiques?match=${encodeURIComponent(String(matchId))}` : "/statistiques");
  };

  return <div className="nxt5-data-dense min-w-0 overflow-hidden">
    <section className="relative mb-4 overflow-hidden rounded-2xl border border-cyan-200/16 bg-[linear-gradient(135deg,rgba(8,18,38,.9),rgba(3,7,18,.78)_52%,rgba(35,12,48,.64))] p-4 shadow-[0_14px_44px_rgba(0,0,0,.24)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,.16),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(217,70,239,.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/75 to-fuchsia-100/55" />
      <div className="relative z-10 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-stretch">
        <div className="flex min-w-0 flex-col justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">Tendances</Badge>
              <Badge tone={activeTrendCategory ? matchCategoryTone(activeTrendCategory) : "slate"}>{activeTrendCategory?.name || "Toutes les games"}</Badge>
            </div>
            <h2 className="nxt5-metal-text mt-3 max-w-4xl break-words text-3xl font-black leading-[1.08] tracking-tight lg:text-4xl">Cockpit stratégique</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-200">Le portrait du bloc en cours, côté jeu.</p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
            {topMetrics.map(({ icon: Icon, label, value, hint, tone: metricTone }) => <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-black/24 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", tone(metricTone))}><Icon className="h-4 w-4" /></span>
                <p className="min-w-0 break-words text-[0.62rem] font-black uppercase leading-4 tracking-[0.12em] text-slate-300">{label}</p>
              </div>
              <p className="mt-2 break-words text-xl font-black leading-tight text-white">{value}</p>
              <p className="mt-1 truncate text-[0.68rem] font-semibold text-slate-400">{hint}</p>
            </div>)}
          </div>
        </div>
        <aside className="min-w-0 rounded-2xl border border-white/10 bg-black/26 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-300">Bloc actif</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button type="button" variant="ghost" icon={FileText} onClick={() => openTrendSources({ title: "Games du bloc actif", subtitle: `${activeTrendCategory?.name || "Toutes les games"} · base complète de la lecture automatique`, metrics: sourceScopeMetrics, games: sourceGames })} className="px-3 py-2 text-xs">Sources</Button>
              <Button type="button" variant="ghost" icon={ImageIcon} onClick={exportTrends} className="px-3 py-2 text-xs">Exporter</Button>
            </div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cx("mt-1 text-3xl font-black leading-none", winrate >= 50 ? "text-emerald-100" : "text-rose-100")}>{winrate}%</p>
              <p className="mt-1 text-sm font-black text-white">{wins}W - {losses}L</p>
            </div>
            <span className={cx("rounded-xl border p-2.5", tone(winrate >= 50 ? "green" : "red"))}><Trophy className="h-5 w-5" /></span>
          </div>
          <div className="mt-3 grid gap-2">
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2.5"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Games</p><p className="text-lg font-black text-white">{matches.length}</p></div>
            <div className="min-w-0 rounded-xl border border-cyan-200/14 bg-cyan-300/[0.045] p-3"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-cyan-100">Base de calcul</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-200">{matches.length} games filtrées · {ally.length} lignes alliées · {timelineGamesCount}/{matches.length} timelines objectifs exploitables.</p></div>
            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Identité équipe</p><p className="mt-1 break-words text-sm font-black leading-5 text-cyan-100">{tagLabel(identity.primary)}</p><div className="mt-2 flex min-w-0 flex-wrap gap-1">{identity.tags.slice(0, 3).map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>)}</div></div>
          </div>
          <div className="mt-3 border-t border-white/10 pt-3">
            <CategoryFilter categories={matchCategories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} label="Contexte" />
          </div>
        </aside>
      </div>
    </section>
    <Surface className="p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Badge tone="cyan">Modèle d'équipe</Badge>
          <h3 className="mt-2 text-xl font-black text-white">Comment l'équipe fonctionne vraiment</h3>
          <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-300">Cette lecture isole le plan naturel, les rôles qui structurent la map, les timings qui font basculer les games et les signaux qui transforment une draft en défaite.</p>
        </div>
        <button type="button" onClick={() => openTrendSources({ title: "Base complète du modèle d'équipe", subtitle: "Toutes les games utilisées pour lire l'identité, les rôles, les timings et les écarts win/loss.", metrics: sourceScopeMetrics, games: sourceGames })} className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-300/16"><FileText className="h-4 w-4" />Voir la base</button>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-4">
        {teamModelCards.map((card) => {
          const expanded = expandedTeamModelId === card.id;
          return <article key={card.id} className={cx("min-w-0 rounded-xl border p-3 transition", expanded ? "border-cyan-200/30 bg-cyan-400/[0.06]" : "border-white/10 bg-white/[0.028]")}>
            <button type="button" onClick={() => setExpandedTeamModelId(expanded ? "" : card.id)} className="flex w-full min-w-0 items-start justify-between gap-3 text-left">
              <span className="min-w-0">
                <Badge tone={card.toneName}>{card.label}</Badge>
                <span className="mt-2 block break-words text-sm font-black leading-5 text-white">{card.title}</span>
                <span className={cx("mt-2 block text-2xl font-black leading-none", card.toneName === "red" ? "text-rose-100" : card.toneName === "orange" ? "text-amber-100" : card.toneName === "purple" ? "text-fuchsia-100" : "text-cyan-100")}>{card.value}</span>
              </span>
              <ChevronDown className={cx("mt-1 h-4 w-4 shrink-0 text-slate-400 transition", expanded && "rotate-180 text-cyan-100")} />
            </button>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">{card.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => openTrendSources({ title: card.title, subtitle: card.text, metrics: card.details.map((detail, index) => ({ label: index === 0 ? "Signal" : `Signal ${index + 1}`, value: detail })), games: card.sourceGames })} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-200/24 hover:bg-cyan-300/10 hover:text-cyan-50"><FileText className="h-3.5 w-3.5" />{card.sourceGames?.length || 0} games</button>
            </div>
            <AnimatePresence initial={false}>
              {expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                <div className="mt-3 grid gap-1.5 border-t border-white/10 pt-2.5">
                  {card.details.slice(0, 4).map((detail) => <p key={detail} className="text-xs font-semibold leading-5 text-slate-200">{detail}</p>)}
                </div>
              </motion.div>}
            </AnimatePresence>
          </article>;
        })}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/18 p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Rôles dans le système</h4>
            <Badge tone="slate">{roleSystemRows.length} rôles</Badge>
          </div>
          <div className="mt-2.5 grid gap-2 lg:grid-cols-5">
            {roleSystemRows.map((row) => <button key={row.role} type="button" onClick={() => openTrendSources({ title: `${roleLabel(row.role)} dans le système`, subtitle: `${row.functionLabel} · ${row.games} games · ${row.wr}% WR`, metrics: [`Or ${Math.round(row.goldShare || 0)}%`, `Dégâts ${Math.round(row.damageShare || 0)}%`, `KP ${Math.round(row.kp || 0)}%`, `CS10 ${Number.isFinite(row.cs10) ? `${row.cs10 >= 0 ? "+" : ""}${row.cs10.toFixed(1)}` : "n/a"}`].map((value, index) => ({ label: index === 0 ? "Signal" : `Signal ${index + 1}`, value })), games: row.sourceGames })} className={cx("min-w-0 rounded-xl border p-2.5 text-left transition hover:bg-cyan-300/[0.055]", row.toneName === "red" ? "border-rose-200/18 bg-rose-400/[0.04]" : row.toneName === "green" ? "border-emerald-200/18 bg-emerald-400/[0.04]" : "border-white/10 bg-white/[0.028]")}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2"><RoleIcon role={row.role} className="h-4 w-4 shrink-0" /><span className="truncate text-xs font-black uppercase tracking-[0.12em] text-white">{roleLabel(row.role)}</span></span>
                <span className="text-xs font-black text-cyan-100">{row.wr}%</span>
              </div>
              <p className="mt-2 truncate text-xs font-black text-white">{row.functionLabel}</p>
              <p className="mt-1 text-[0.62rem] font-semibold leading-4 text-slate-300">{Math.round(row.goldShare || 0)}% or · {Math.round(row.damageShare || 0)}% dégâts · KP {Math.round(row.kp || 0)}%</p>
              <p className="mt-1 truncate text-[0.58rem] font-semibold text-slate-400">{row.championText || "Pool non isolé"}</p>
            </button>)}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/18 p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Ce qui bascule</h4>
            <Badge tone="purple">Win/Loss</Badge>
          </div>
          <div className="mt-2.5 grid gap-2">
            {swingRows.map((row) => <button key={row.id} type="button" onClick={() => openTrendSources({ title: `Bascule : ${row.label}`, subtitle: row.read, metrics: [{ label: "Victoires", value: row.win }, { label: "Défaites", value: row.loss }, { label: "Lecture", value: row.read }], games: row.id === "identity" ? sourceGames : [...winModel.sourceGames, ...lossModel.sourceGames] })} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.028] p-2.5 text-left transition hover:border-cyan-200/24 hover:bg-cyan-300/[0.055]">
              <span className="min-w-0"><span className="block truncate text-xs font-black uppercase tracking-[0.12em] text-slate-300">{row.label}</span><span className="mt-0.5 block truncate text-[0.62rem] font-semibold text-slate-400">{row.read}</span></span>
              <span className="rounded-lg border border-emerald-200/14 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-50">{row.win}</span>
              <span className={cx("rounded-lg border px-2 py-1 text-xs font-black", row.toneName === "red" ? "border-rose-200/18 bg-rose-300/10 text-rose-50" : "border-white/10 bg-white/[0.045] text-slate-100")}>{row.loss}</span>
            </button>)}
          </div>
        </div>
      </div>
    </Surface>
    <Surface className="p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="cyan">Lecture automatique</Badge>
          <h3 className="mt-2 text-xl font-black text-white">Style draft et timings</h3>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Le site croise les rôles qui captent les ressources, les tags de champions, le CS10/20 et le premier timing objectif.</p>
        </div>
        <Badge tone="slate">{autoPatterns.length} pattern{autoPatterns.length > 1 ? "s" : ""} détecté{autoPatterns.length > 1 ? "s" : ""}</Badge>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]">
        <div className="grid min-w-0 gap-2 lg:grid-cols-2">
          {autoPatterns.length ? autoPatterns.slice(0, 4).map((pattern) => {
            const expanded = expandedTrendPatternId === pattern.id;
            return <article key={pattern.id} className={cx("min-w-0 rounded-xl border p-2.5 transition", expanded ? "border-cyan-200/30 bg-cyan-400/[0.065]" : "border-white/10 bg-black/22")}>
              <button type="button" onClick={() => setExpandedTrendPatternId(expanded ? "" : pattern.id)} className="flex w-full min-w-0 items-start justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><Badge tone={pattern.tone}>{pattern.label}</Badge><Badge tone={pattern.verdictTone}>{pattern.verdict}</Badge></span>
                  <span className="mt-2 block text-2xl font-black leading-none text-white">{pattern.wr}%</span>
                  <span className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">{pattern.wins}W - {pattern.games - pattern.wins}L · {pattern.games} games sources</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {pattern.bestRole && <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/18 bg-cyan-300/10 text-cyan-50"><RoleIcon role={pattern.bestRole.role} className="h-5 w-5" /></span>}
                  <ChevronDown className={cx("h-4 w-4 text-slate-300 transition", expanded && "rotate-180 text-cyan-100")} />
                </span>
              </button>
              <div className="mt-3 grid gap-1.5">
                {pattern.details.slice(1).map((detail) => <p key={detail} className="truncate text-xs font-semibold text-slate-300">{detail}</p>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => openTrendSources({ title: pattern.label, subtitle: pattern.read, metrics: pattern.details.map((detail, index) => ({ label: index === 0 ? "Volume" : `Signal ${index}`, value: detail })), games: pattern.sourceGames })} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200/18 bg-cyan-300/10 px-2.5 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-cyan-50 transition hover:bg-cyan-300/16"><FileText className="h-3.5 w-3.5" />Voir les sources</button>
              </div>
              <AnimatePresence initial={false}>
                {expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/24 p-2.5">
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-cyan-100">Pourquoi ce pattern sort</p>
                    <div className="mt-2 grid gap-1.5">
                      {pattern.details.map((detail) => <p key={detail} className="text-xs font-semibold leading-5 text-slate-200">{detail}</p>)}
                    </div>
                    <div className="mt-2 max-h-72 divide-y divide-white/8 overflow-y-auto pr-1">
                      {pattern.sourceGames.map((game) => <button key={`${pattern.id}-${game.id || game.title}`} type="button" onClick={() => openSourceGame(game)} className="flex w-full min-w-0 items-center justify-between gap-3 py-2 text-left transition hover:text-cyan-100">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-black text-white">{game.title}</span>
                          <span className="mt-0.5 block truncate text-[0.62rem] font-semibold text-slate-400">{game.result} · {game.topRoleLabel} · 1er obj {game.firstObjective}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" />
                      </button>)}
                    </div>
                  </div>
                </motion.div>}
              </AnimatePresence>
            </article>;
          }) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Pas encore assez de volume pour isoler un style de draft fiable.</div>}
        </div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Synthèse coach</h4>
            <Badge tone={winrate >= 50 ? "green" : "red"}>{coachBriefs.length} axes</Badge>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {coachKpis.map((item) => <div key={item.label} className={cx("min-w-0 rounded-lg border px-2 py-1.5", tone(item.toneName))}>
              <p className="truncate text-[0.52rem] font-black uppercase tracking-[0.12em] opacity-80">{item.label}</p>
              <p className="mt-0.5 truncate text-sm font-black text-white">{item.value}</p>
              <p className="truncate text-[0.58rem] font-semibold opacity-80">{item.detail}</p>
            </div>)}
          </div>
          <div className="mt-2.5 grid gap-2">
            {coachBriefs.map((brief, index) => <article key={`${brief.label}-${index}`} className={cx("rounded-xl border p-2.5", index === 0 ? "border-cyan-200/24 bg-cyan-400/[0.075]" : "border-white/10 bg-black/18")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={brief.toneName}>{brief.label}</Badge>
                <button type="button" onClick={() => openTrendSources({ title: brief.title, subtitle: brief.text, metrics: brief.evidence?.map((item, metricIndex) => ({ label: metricIndex === 0 ? "Signal" : `Signal ${metricIndex + 1}`, value: item })) || sourceScopeMetrics, games: brief.sourceGames })} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-200/24 hover:bg-cyan-300/10 hover:text-cyan-50"><FileText className="h-3 w-3" />{brief.sourceGames?.length || matches.length} games</button>
              </div>
              <h5 className="mt-2 text-sm font-black leading-5 text-white">{brief.title}</h5>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-200">{brief.text}</p>
              {brief.evidence?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
                {brief.evidence.slice(0, 3).map((item) => <span key={item} className="rounded-md border border-white/10 bg-white/[0.045] px-1.5 py-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-cyan-50">{item}</span>)}
              </div>}
            </article>)}
          </div>
        </div>
      </div>
      {laneTimings.length > 0 && <div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {laneTimings.map((stat) => <div key={stat.role} className="min-w-0 rounded-xl border border-white/10 bg-black/18 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2"><RoleIcon role={stat.role} className="h-4 w-4 shrink-0" /><span className="truncate text-xs font-black uppercase tracking-[0.12em] text-white">{roleLabel(stat.role)}</span></span>
            <Badge tone={(stat.cs10 || 0) >= 0 ? "green" : "red"}>{stat.samples}</Badge>
          </div>
          <p className={cx("mt-2 text-sm font-black", (stat.cs10 || 0) >= 0 ? "text-emerald-100" : "text-rose-100")}>CS10 {Number.isFinite(stat.cs10) ? `${stat.cs10 >= 0 ? "+" : ""}${stat.cs10.toFixed(1)}` : "n/a"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-300">CS20 {Number.isFinite(stat.cs20) ? `${stat.cs20 >= 0 ? "+" : ""}${stat.cs20.toFixed(1)}` : "n/a"}</p>
        </div>)}
      </div>}
    </Surface>
    <Surface className="p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="purple">Graphiques clés</Badge>
          <h3 className="mt-2 text-xl font-black text-white">Lecture visuelle</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">Les écarts, les objectifs et les rôles qui portent le plus de ressources.</p>
        </div>
        <Badge tone={winrate >= 50 ? "green" : "red"}>{matches.length} games · {winrate}% WR</Badge>
      </div>
      <div className="mt-3 grid items-stretch gap-3 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Écarts moyens</h4>
            <Badge tone="slate">Par game</Badge>
          </div>
          <div className="mt-3 grid flex-1 content-start gap-2">
            {diffChartItems.map((item) => <SignedBar key={item.label} item={item} />)}
          </div>
        </div>
        <div className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Objectifs</h4>
            <Badge tone="cyan">/ game</Badge>
          </div>
          <div className="mt-3 grid flex-1 grid-cols-5 gap-2">
            {objectiveChartItems.map((item) => <VerticalBar key={item.label} item={item} max={maxObjectiveChart} />)}
          </div>
        </div>
        <div className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">Ressources par rôle</h4>
            <Badge tone="purple">Top {roleResourceChartItems.length || 0}</Badge>
          </div>
          <div className="mt-3 grid flex-1 content-start gap-2">
            {roleResourceChartItems.length ? roleResourceChartItems.map((item) => <RoleResourceBar key={item.role} item={item} />) : <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm font-semibold text-slate-300">Pas assez de volume pour tracer les rôles.</p>}
          </div>
        </div>
      </div>
    </Surface>
    <div className="mt-3 grid items-start gap-3 xl:grid-cols-2">
      <Surface className="p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge tone="cyan">Lecture du bloc</Badge><h3 className="mt-2 text-lg font-black text-white">Résumé</h3><p className="mt-1 text-xs font-semibold leading-5 text-slate-200">{selectedCategoryId ? `Filtre actif : ${matchCategories.find((category) => category.id === selectedCategoryId)?.name || "cette catégorie"}.` : "Vue globale."} Écarts moyennés par game.</p></div><Badge tone={winrate >= 50 ? "green" : "red"}>{wins}W - {losses}L</Badge></div><div className="mt-3 grid gap-2 md:grid-cols-3">{[["KP haut", kpSignal && `${kpSignal.name} · ${kpSignal.avgKp}%`, "green"], ["Vision haute", supportSignal && `${supportSignal.name} · ${supportSignal.avgVision}`, "cyan"], ["Morts/game", pressureSignal && `${pressureSignal.name} · ${(pressureSignal.deaths / Math.max(1, pressureSignal.games)).toFixed(1)}`, "red"]].map(([label, value, t]) => <div key={label} className="nxt5-flat-block min-w-0 rounded-xl border p-2.5"><p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-300">{label}</p><p className={cx("mt-1.5 break-words text-xs font-black leading-5", t === "red" ? "text-rose-100" : t === "green" ? "text-emerald-100" : "text-cyan-100")}>{value || "Pas assez de volume"}</p></div>)}</div></Surface>
      <Surface className="p-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-black text-white">Comparatif contextes</h3><p className="mt-1 text-xs font-semibold text-slate-300">Les blocs qui pèsent vraiment.</p></div><Badge tone="slate">{baseMatches.length} games</Badge></div><div className="mt-2.5 grid gap-2">{categoryBreakdown.length ? <>{categoryBreakdown.slice(0, 4).map((entry) => <button key={entry.id} type="button" onClick={() => setSelectedCategoryId(entry.id === "none" ? "" : String(selectedCategoryId) === String(entry.id) ? "" : entry.id)} className={cx("grid min-w-0 gap-2 rounded-xl border p-2.5 text-left transition md:grid-cols-[minmax(120px,1fr)_repeat(4,minmax(52px,auto))] md:items-center", String(selectedCategoryId) === String(entry.id) ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}><div className="min-w-0"><Badge tone={entry.color}>{entry.name}</Badge><p className="mt-1 text-[0.68rem] font-semibold text-slate-300">{entry.games}G · {entry.wins}W/{entry.games - entry.wins}L</p></div><span className="min-w-0 text-xs font-black text-white md:text-right">{entry.wr}%</span><span className={cx("min-w-0 text-xs font-black md:text-right", entry.goldDiff >= 0 ? "text-emerald-100" : "text-rose-100")}>{formatGoldDiff(entry.goldDiff)}</span><span className={cx("min-w-0 text-xs font-black md:text-right", entry.damageDiff >= 0 ? "text-emerald-100" : "text-rose-100")}>{entry.damageDiff >= 0 ? "+" : ""}{formatPoints(entry.damageDiff)}</span><span className={cx("min-w-0 text-xs font-black md:text-right", entry.visionDiff >= 0 ? "text-cyan-100" : "text-rose-100")}>{entry.visionDiff >= 0 ? "+" : ""}{entry.visionDiff}</span></button>)}</> : <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Classe tes games dans Intégration pour comparer les contextes.</p>}</div></Surface>
    </div>
    <div className="mt-3 grid items-stretch gap-3 xl:grid-cols-2">
      <Surface className="p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge tone={championStyleTone(identity.primary)}>Identité équipe</Badge><h3 className="mt-2 text-xl font-black text-white">{tagLabel(identity.primary)}</h3><p className="mt-1.5 max-w-4xl text-xs font-semibold leading-5 text-slate-200">{identity.text}</p></div><Badge tone="cyan">{matches.length} games</Badge></div><div className="mt-3 flex flex-wrap gap-1.5">{identity.tags.length ? identity.tags.slice(0, 5).map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Volume faible</Badge>}</div>{focusRole && <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-2.5"><RoleIcon role={focusRole.role} className="h-6 w-6" /><div className="min-w-0"><p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-cyan-100">Focus ressources</p><p className="break-words text-xs font-black text-white">{roleLabel(focusRole.role)} · {formatPoints(avgInt(focusRole.gold))} or · {formatPoints(avgInt(focusRole.damage))} dégâts</p></div></div>}</Surface>
      <Surface className="p-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-black text-white">Objectifs par side</h3><p className="mt-1 text-xs font-semibold text-slate-300">Moyenne par game sur chaque side.</p></div><Badge tone="slate">Ratio/game</Badge></div><div className="mt-2.5 grid gap-2 md:grid-cols-2">{sideStats.map((stat) => <div key={stat.side} className={cx("rounded-xl border p-2.5", stat.side === "Blue" ? "border-cyan-300/18 bg-cyan-400/[0.055]" : "border-rose-300/18 bg-rose-400/[0.055]")}><div className="flex flex-wrap items-center justify-between gap-2"><Badge tone={stat.side === "Blue" ? "cyan" : "red"}>{stat.side} Side</Badge><span className="text-xs font-black text-white">{stat.wr}% · {stat.wins}W/{stat.games - stat.wins}L</span></div><div className="mt-2.5 grid grid-cols-5 gap-1.5">{[["Drakes", stat.objectives.dragons, "dragon"], ["Grubs", stat.objectives.grubs, "grub"], ["Herald", stat.objectives.heralds, "herald"], ["Nashor", stat.objectives.barons, "baron"], ["Tours", stat.objectives.towers, "tower"]].map(([label, value, icon]) => <div key={label} className="min-w-0 text-center"><ObjectivePictogram type={icon} fallback={label[0]} className="mx-auto h-5 w-5" /><p className="mt-1 text-sm font-black text-white">{objectiveRatio(value, stat.games)}</p><p className="truncate text-[0.5rem] font-black uppercase tracking-[0.08em] text-slate-300">{label}</p></div>)}</div></div>)}</div></Surface>
    </div>
    <div className="mt-3 grid items-stretch gap-3 md:grid-cols-2 2xl:grid-cols-4"><TrendPanel title="Écarts moyens" icon={ShieldCheck} items={forceItems} tone="green" /><TrendPanel title="Pression et exposition" icon={AlertTriangle} items={riskItems} tone="red" /><TrendPanel title="Objectifs / game" icon={Gauge} items={timingItems} /><TrendPanel title="Tags victoire" icon={Trophy} items={winTags.map(([tag, count]) => `${tagLabel(tag)} présent dans ${count} pick(s) gagnant(s).`)} tone="green" /><TrendPanel title="Tags défaite" icon={AlertTriangle} items={lossTags.map(([tag, count]) => `${tagLabel(tag)} revient dans ${count} pick(s) perdu(s).`)} tone="red" /><TrendPanel title="Identité draft" icon={Target} items={draftNeeds} tone="purple" /><TrendPanel title="Ratios profils" icon={Clipboard} items={recommendations} tone="orange" /></div>
    <Surface className="mt-3 p-3"><div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-lg font-black text-white">Champions récurrents</h3><p className="mt-1 text-xs font-semibold text-slate-300">Volume et WR des picks les plus vus.</p></div><Badge tone="slate">Données importées</Badge></div><div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{championCounts.slice(0, 8).map((stat) => <div key={championAssetId(stat.champion)} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.035] p-2"><ChampionPortrait champion={stat.champion} alt={stat.champion} className="h-10 w-10 shrink-0 rounded-lg object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(stat.champion)}</p><p className="text-[0.68rem] font-semibold text-slate-300">{stat.games} games · {Math.round((stat.wins / Math.max(1, stat.games)) * 100)}% WR</p><div className="mt-1 flex flex-wrap gap-1">{stat.tags.slice(0, 1).map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div></div></div>)}</div></Surface>
    <AnimatePresence>
      {trendSourceModal && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/78 p-3 backdrop-blur-md sm:items-center">
        <button type="button" aria-label="Fermer les sources" onClick={() => setTrendSourceModal(null)} className="absolute inset-0 cursor-default" />
        <motion.section initial={{ y: 24, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 16, scale: 0.98, opacity: 0 }} transition={{ duration: 0.18 }} className="relative z-10 flex max-h-[88vh] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-2xl border border-cyan-100/18 bg-[#050913] shadow-[0_24px_80px_rgba(0,0,0,.5)]">
          <div className="border-b border-white/10 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge tone="cyan">Sources de calcul</Badge>
                <h3 className="mt-2 break-words text-xl font-black leading-tight text-white">{trendSourceModal.title}</h3>
                {trendSourceModal.subtitle && <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-300">{trendSourceModal.subtitle}</p>}
              </div>
              <button type="button" onClick={() => setTrendSourceModal(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-rose-200/30 hover:bg-rose-300/10 hover:text-rose-50"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(trendSourceModal.metrics || sourceScopeMetrics).slice(0, 4).map((metric, index) => <div key={`${metric.label}-${index}`} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
                <p className="truncate text-[0.56rem] font-black uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                <p className="mt-1 break-words text-sm font-black leading-5 text-white">{metric.value}</p>
              </div>)}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid gap-2">
              {(trendSourceModal.games || []).map((game, index) => <button key={`${game.id || game.title}-${index}`} type="button" onClick={() => openSourceGame(game)} className="group grid min-w-0 gap-3 rounded-xl border border-white/10 bg-white/[0.028] p-3 text-left transition hover:border-cyan-200/28 hover:bg-cyan-300/[0.06] lg:grid-cols-[minmax(12rem,1fr)_minmax(16rem,1.1fr)_auto] lg:items-center">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={game.result === "Victoire" ? "green" : game.result === "Défaite" ? "red" : "slate"}>{game.result}</Badge>
                    <Badge tone={String(game.side).toLowerCase().includes("red") ? "red" : "cyan"}>{game.side}</Badge>
                    <Badge tone="slate">{game.patch}</Badge>
                  </span>
                  <span className="mt-2 block truncate text-sm font-black text-white">{game.title}</span>
                  <span className="mt-0.5 block text-[0.68rem] font-semibold text-slate-400">{game.duration} · {game.objectiveCount} objectifs alliés · 1er obj {game.firstObjective}</span>
                </span>
                <span className="grid min-w-0 gap-1.5 sm:grid-cols-2">
                  <span className="rounded-lg border border-white/10 bg-black/18 px-2 py-1.5"><span className="block text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-400">Rôle moteur</span><span className="mt-0.5 block truncate text-xs font-black text-cyan-50">{game.topRoleLabel}</span><span className="mt-0.5 block truncate text-[0.58rem] font-semibold text-slate-400">{game.topRoleDetail}</span></span>
                  <span className="rounded-lg border border-white/10 bg-black/18 px-2 py-1.5"><span className="block text-[0.52rem] font-black uppercase tracking-[0.12em] text-slate-400">Écarts</span><span className={cx("mt-0.5 block text-xs font-black", game.goldDiff >= 0 ? "text-emerald-100" : "text-rose-100")}>{formatGoldDiff(game.goldDiff)} or</span><span className={cx("mt-0.5 block text-[0.58rem] font-semibold", game.visionDiff >= 0 ? "text-cyan-100" : "text-rose-100")}>{game.visionDiff >= 0 ? "+" : ""}{game.visionDiff} vision · morts {game.deaths}</span></span>
                </span>
                <span className="inline-flex items-center justify-end gap-2 text-[0.62rem] font-black uppercase tracking-[0.12em] text-cyan-100">Ouvrir stats<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </button>)}
              {!trendSourceModal.games?.length && <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300">Aucune game source isolée pour ce signal.</p>}
            </div>
          </div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

const GAME_WORKSPACE_TABS = [
  { id: "import", label: "Importer", icon: Upload, hint: "Ajouter, corriger et classer les games", path: "/integration" },
  { id: "stats", label: "Stats", icon: BarChart3, hint: "Lire une game ou un groupe", path: "/statistiques" },
  { id: "review", label: "Review", icon: FileText, hint: "Rédiger et retrouver les reviews", path: "/rapports" },
];

function GameWorkspace({ data, selectedTeamId, refreshAll, pushToast, currentMember, user, route }) {
  const initialSection = gameWorkspaceSectionFromPath(route?.path);
  const [section, setSection] = useState(initialSection);
  const teamMatches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const teamReports = (data.reports || []).filter((report) => report.team_id === selectedTeamId);
  const teamArchives = (data.matchArchives || []).filter((archive) => archive.team_id === selectedTeamId);
  const wins = teamMatches.filter((match) => match.result === "Victoire").length;

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);
  const selectSection = (tab) => {
    setSection(tab.id);
    openAppPath(tab.path);
  };

  return <div className="min-w-0">
    <PageHeader
      eyebrow="Review room"
      title="Games, stats et review"
      subtitle="Un seul flux : importe une game, lis les signaux utiles, puis transforme ça en review sans changer de contexte."
    />
    <Surface glow className="sticky top-3 z-20 mb-5 overflow-hidden p-3 sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="grid gap-2 sm:grid-cols-3">
          {GAME_WORKSPACE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return <button key={tab.id} type="button" onClick={() => selectSection(tab)} className={cx("group flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition", active ? "border-cyan-200/55 bg-cyan-400/18 text-white shadow-[0_0_28px_rgba(34,211,238,.16)]" : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-200/22 hover:bg-white/[0.06] hover:text-white")}>
              <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", active ? "border-cyan-200/35 bg-cyan-300/16 text-cyan-50" : "border-white/10 bg-black/22 text-slate-300")}><Icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black uppercase tracking-[0.12em]">{tab.label}</span>
                <span className="mt-1 block truncate text-xs font-semibold text-slate-400">{tab.hint}</span>
              </span>
            </button>;
          })}
        </div>
        <div className="grid grid-cols-3 gap-2 xl:min-w-[20rem]">
          <div className="rounded-2xl border border-white/10 bg-black/22 p-3 text-center"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Games</p><p className="mt-1 text-xl font-black text-white">{teamMatches.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/22 p-3 text-center"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">WR</p><p className="mt-1 text-xl font-black text-white">{Math.round((wins / Math.max(1, teamMatches.length)) * 100)}%</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/22 p-3 text-center"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Review</p><p className="mt-1 text-xl font-black text-white">{teamReports.length || teamArchives.length}</p></div>
        </div>
      </div>
    </Surface>
    <AnimatePresence mode="wait">
      <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        {section === "import" && <Matches data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} pushToast={pushToast} currentMember={currentMember} user={user} />}
        {section === "stats" && <Statistics data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} />}
        {section === "review" && <Reports data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />}
      </motion.div>
    </AnimatePresence>
  </div>;
}

function Statistics({ data, selectedTeamId, refreshAll, pushToast }) {
  const baseMatches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const matchCategories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const archives = (data.matchArchives || []).filter((archive) => archive.team_id === selectedTeamId);
  const urlMatchId = new URLSearchParams(window.location.search).get("match") || "";
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState(urlMatchId || "");
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [archiveForm, setArchiveForm] = useState({ id: "", name: "", description: "", matchIds: [] });
  const [savingArchive, setSavingArchive] = useState(false);
  const [archivesCollapsed, setArchivesCollapsed] = useState(false);
  const [archiveWorkspaceTab, setArchiveWorkspaceTab] = useState("select");
  const matches = selectedCategoryId ? baseMatches.filter((match) => matchHasCategory(match, selectedCategoryId)) : baseMatches;
  const selectedArchive = archives.find((archive) => archive.id === selectedArchiveId);
  const scopedMatches = selectedArchive ? matches.filter((match) => archiveMatchIds(selectedArchive).includes(match.id)) : matches;
  const scopedMatchIds = scopedMatches.map((match) => match.id).join("|");
  useEffect(() => {
    if (archives.length && selectedArchiveId && !archives.some((archive) => archive.id === selectedArchiveId)) setSelectedArchiveId("");
  }, [archives, selectedArchiveId]);
  useEffect(() => {
    if (selectedMatchId && !scopedMatches.some((match) => String(match.id || "") === String(selectedMatchId || ""))) setSelectedMatchId("");
  }, [scopedMatchIds, selectedMatchId]);
  useEffect(() => {
    if (urlMatchId && matches.some((match) => match.id === urlMatchId)) setSelectedMatchId(urlMatchId);
  }, [urlMatchId, matches.map((match) => match.id).join("|")]);
  const selectedMatch = scopedMatches.find((match) => String(match.id || "") === String(selectedMatchId || "")) || null;
  const selectedReport = (data.reports || []).find((report) => report.team_id === selectedTeamId && reportMatchIds(report).includes(selectedMatch?.id));
  const selectedArchiveReport = selectedArchive ? (data.reports || []).find((report) => {
    const reportIds = reportMatchIds(report);
    const archiveIds = archiveMatchIds(selectedArchive);
    return report.team_id === selectedTeamId && archiveIds.length && archiveIds.every((id) => reportIds.includes(id)) && reportIds.every((id) => archiveIds.includes(id));
  }) : null;
  const roster = (data.players || []).filter((player) => player.team_id === selectedTeamId);
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const rosterByRiot = new Map(roster.map((player) => [normalizeProfileKey(player.riot_id), player]).filter(([key]) => key));
  const rosterByName = new Map(roster.map((player) => [normalizeProfileKey(player.name), player]).filter(([key]) => key));
  const rosterByRole = new Map(roster.map((player) => [normalizeProfileRole(player.role), player]).filter(([role]) => ROSTER_ROLE_ORDER.includes(role)));
  const profileMatches = selectedMatch ? [selectedMatch] : scopedMatches;
  const rows = profileMatches.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY").map((row) => ({ ...row, match })));
  const resolveRowPlayer = (row) => rosterById.get(row.player_id) || rosterByRiot.get(normalizeProfileKey(row.riot_id)) || rosterByName.get(normalizeProfileKey(row.summoner_name));
  const stats = Array.from(rows.reduce((map, row) => {
    const player = resolveRowPlayer(row);
    const role = normalizeProfileRole(row.role || player?.role || "ROLE");
    const rolePlayer = ROSTER_ROLE_ORDER.includes(role) ? rosterByRole.get(role) : null;
    const displayPlayer = player || rolePlayer;
    const key = displayPlayer?.id ? `PLAYER::${displayPlayer.id}` : ROSTER_ROLE_ORDER.includes(role) ? role : `OTHER::${row.riot_id || row.summoner_name || row.champion || role}`;
    const rowDisplayName = displayPlayer?.name || row.summoner_name || row.riot_id || roleLabel(role);
    const current = map.get(key) || { key, name: rowDisplayName, role, games: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0, gold: 0, kp: 0, csPerMin: 0, champions: new Map(), championRows: new Map(), nameCounts: new Map() };
    current.nameCounts.set(rowDisplayName, (current.nameCounts.get(rowDisplayName) || 0) + 1);
    current.name = Array.from(current.nameCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || rowDisplayName;
    current.role = role;
    current.games += 1;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.vision += Number(row.vision || 0);
    current.gold += Number(row.gold || 0);
    current.kp += parsePercent(row.kill_participation || row.kp || 0);
    current.csPerMin += Number(row.cs_per_min || 0);
    current.champions.set(row.champion, (current.champions.get(row.champion) || 0) + 1);
    if (!current.championRows.has(row.champion)) current.championRows.set(row.champion, []);
    current.championRows.get(row.champion).push(row);
    map.set(key, current);
    return map;
  }, new Map()).values()).sort((a, b) => (ROSTER_ROLE_ORDER.indexOf(a.role) === -1 ? 99 : ROSTER_ROLE_ORDER.indexOf(a.role)) - (ROSTER_ROLE_ORDER.indexOf(b.role) === -1 ? 99 : ROSTER_ROLE_ORDER.indexOf(b.role)));
  const maxDamage = Math.max(1, ...stats.map((stat) => stat.damage / Math.max(1, stat.games)));
  const maxVision = Math.max(1, ...stats.map((stat) => stat.vision / Math.max(1, stat.games)));
  const maxGold = Math.max(1, ...stats.map((stat) => stat.gold / Math.max(1, stat.games)));
  const wins = scopedMatches.filter((match) => match.result === "Victoire").length;
  const activeCategory = matchCategories.find((category) => String(category.id || "") === String(selectedCategoryId || ""));
  const scopeLabel = selectedMatch ? "Game sélectionnée" : selectedArchive ? "Groupe actif" : activeCategory ? "Catégorie active" : "Vue globale";
  const scopeTitle = selectedMatch ? matchDisplayName(selectedMatch) : selectedArchive ? selectedArchive.name : activeCategory ? activeCategory.name : "Toutes les games";
  const scopeHint = selectedMatch ? `${selectedMatch.game_id || "Game"} · ${selectedMatch.duration || "--:--"}` : selectedArchive ? `${scopedMatches.length} game${scopedMatches.length > 1 ? "s" : ""} dans le groupe` : activeCategory ? `${scopedMatches.length} game${scopedMatches.length > 1 ? "s" : ""} dans cette catégorie` : `${scopedMatches.length} game${scopedMatches.length > 1 ? "s" : ""} importée${scopedMatches.length > 1 ? "s" : ""}`;
  const toggleArchiveMatch = (matchId) => setArchiveForm((current) => ({ ...current, matchIds: current.matchIds.includes(matchId) ? current.matchIds.filter((id) => id !== matchId) : [...current.matchIds, matchId] }));
  const resetArchiveForm = () => setArchiveForm({ id: "", name: "", description: "", matchIds: [] });
  const editArchive = (archive) => {
    setArchiveForm({ id: archive.id, name: archive.name || "", description: archive.description || "", matchIds: archiveMatchIds(archive) });
    setSelectedArchiveId(archive.id);
    setArchivesCollapsed(false);
    setArchiveWorkspaceTab("create");
  };
  async function saveArchive(event) {
    event.preventDefault();
    setSavingArchive(true);
    try {
      const creating = !archiveForm.id;
      await apiFetch("match-archives-manage", { method: "POST", body: JSON.stringify({ action: archiveForm.id ? "update" : "create", teamId: selectedTeamId, archiveId: archiveForm.id, name: archiveForm.name, description: archiveForm.description, matchIds: archiveForm.matchIds }) });
      if (creating) {
        const linked = matches.filter((match) => archiveForm.matchIds.includes(match.id));
        await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: "create", teamId: selectedTeamId, title: archiveForm.name, content: buildArchiveReportContent(archiveForm.name, linked), matchIds: archiveForm.matchIds }) });
      }
      pushToast?.({ type: "green", title: archiveForm.id ? "Archive renommée" : "Archive créée", text: "Le groupe de games est prêt dans les statistiques." });
      resetArchiveForm();
      setArchiveWorkspaceTab("select");
      await refreshAll?.();
    } catch (err) {
      pushToast?.({ type: "red", title: "Archive impossible", text: err.message });
    } finally {
      setSavingArchive(false);
    }
  }
  async function deleteArchive(archive) {
    if (!archive || !window.confirm(`Supprimer l’archive "${archive.name}" ?`)) return;
    setSavingArchive(true);
    try {
      await apiFetch("match-archives-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, archiveId: archive.id }) });
      if (selectedArchiveId === archive.id) setSelectedArchiveId("");
      pushToast?.({ type: "green", title: "Archive supprimée", text: "Le groupe a été retiré." });
      await refreshAll?.();
    } catch (err) {
      pushToast?.({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSavingArchive(false);
    }
  }
  const archiveFormTitle = archiveForm.id ? "Modifier le groupe" : "Créer un groupe";
  const archiveFormMatchCount = archiveForm.matchIds.length;
  const selectAllArchiveMatches = () => setArchiveForm((current) => ({ ...current, matchIds: matches.map((match) => match.id) }));
  const clearArchiveMatches = () => setArchiveForm((current) => ({ ...current, matchIds: [] }));
  return (
    <div className="nxt5-data-dense min-w-0 overflow-hidden">
      <PageHeader eyebrow="Performance" title="Statistiques" subtitle="Choisis un contexte, lis la game ou le bloc, puis ouvre les profils seulement quand tu veux descendre au joueur." />
      <Surface className="mb-5 p-4">
        <CategoryFilter categories={matchCategories} selectedCategoryId={selectedCategoryId} onSelect={(id) => { setSelectedCategoryId(id); setSelectedArchiveId(""); setSelectedMatchId(""); }} label="Type de games" />
      </Surface>
      {matches.length ? <>
        <Surface className="mb-5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Badge tone={selectedMatch ? "cyan" : selectedArchive ? "purple" : activeCategory ? matchCategoryTone(activeCategory) : "slate"}>{scopeLabel}</Badge>
              <h3 className="mt-3 truncate text-2xl font-black text-white">{scopeTitle}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-300">{scopeHint}</p>
            </div>
            <div className="flex flex-wrap gap-2"><Badge tone="green">{wins}W</Badge><Badge tone="red">{scopedMatches.length - wins}L</Badge><Badge tone="cyan">{Math.round((wins / Math.max(1, scopedMatches.length)) * 100)}% WR</Badge></div>
          </div>
        </Surface>
        <div className="grid gap-3 md:grid-cols-2">
          <MetricCard compact icon={Swords} label="Volume du contexte" value={scopedMatches.length} hint={scopeLabel} tone="cyan" />
          <MetricCard compact icon={Trophy} label="Winrate" value={String(Math.round((wins / Math.max(1, scopedMatches.length)) * 100)) + "%"} hint={wins + " victoire" + (wins > 1 ? "s" : "") + " · " + (scopedMatches.length - wins) + " défaite" + (scopedMatches.length - wins > 1 ? "s" : "")} tone="green" />
        </div>
        {!selectedArchive && <Surface className="mt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div><h3 className="text-xl font-black text-white">Games importées</h3><p className="mt-1 text-sm font-semibold text-slate-300">Sélectionne une game, puis exporte ou ouvre la review lieeee.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" icon={ImageIcon} onClick={() => exportStatsPng({ title: selectedMatch ? matchDisplayName(selectedMatch) : "Game NXT5", subtitle: selectedMatch?.game_id || "Export game", matches: selectedMatch ? [selectedMatch] : [], filename: "nxt5-game-" + (selectedMatch?.game_id || "export") + ".png" })} disabled={!selectedMatch}>Exporter la game</Button>
              <Button type="button" variant="ghost" icon={ImageIcon} onClick={() => exportStatsPng({ title: selectedArchive?.name || "Groupe NXT5", subtitle: scopedMatches.length + " games · " + wins + "W - " + (scopedMatches.length - wins) + "L", matches: scopedMatches, filename: "nxt5-groupe-" + String(selectedArchive?.name || "stats").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png" })} disabled={!selectedArchive || !scopedMatches.length}>Exporter le groupe</Button>
              <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => selectedReport ? openAppPath("/rapports?report=" + selectedReport.id + "&match=" + selectedMatch?.id) : openAppPath("/rapports?match=" + selectedMatch?.id)} disabled={!selectedMatch}>Aller vers Review</Button>
            </div>
          </div>
          <div className="mt-4 grid max-h-80 gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">{scopedMatches.map((match) => { const activeGame = String(selectedMatchId || "") === String(match.id || ""); return <button key={match.id} type="button" aria-pressed={activeGame} onClick={() => setSelectedMatchId(activeGame ? "" : match.id)} className={cx("relative rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60", activeGame ? "border-cyan-200/80 bg-cyan-400/18 shadow-[0_0_0_1px_rgba(103,232,249,.32),0_0_34px_rgba(34,211,238,.22)] ring-1 ring-cyan-200/35" : "border-white/10 bg-white/[0.035] hover:border-cyan-300/18 hover:bg-white/[0.06]")}><div className={cx("pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,.72)] transition", activeGame ? "opacity-100" : "opacity-0")} /><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.duration || "--:--"}</Badge>{activeGame && <Badge tone="cyan">Sélectionnée</Badge>}</div><p className="mt-2 truncate text-sm font-black text-white">{matchDisplayName(match)}</p><p className={cx("mt-1 truncate text-xs font-semibold", activeGame ? "text-cyan-100" : "text-slate-300")}>{match.game_id}</p></button>; })}</div>
        </Surface>}
        {!selectedMatch && <Surface className="mt-5">
          <button type="button" onClick={() => setArchivesCollapsed((value) => !value)} className="flex w-full items-center justify-between gap-4 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.035]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="purple">Sélection groupe</Badge><Badge tone="slate">{archives.length} sauvegardé{archives.length > 1 ? "s" : ""}</Badge><Badge tone={archiveFormMatchCount ? "cyan" : "slate"}>{archiveFormMatchCount} en création</Badge></div>
              <h3 className="mt-3 text-2xl font-black text-white">Groupes de games</h3>
              <p className="mt-1 text-sm font-semibold text-slate-300">Ouvre un groupe existant. La création reste rangée dans son onglet dédié.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2"><Badge tone={selectedArchive ? "cyan" : "slate"}>{selectedArchive ? "Groupe actif" : "Aucun actif"}</Badge><ChevronDown className={cx("h-5 w-5 text-cyan-100 transition", archivesCollapsed && "-rotate-90")} /></div>
          </button>
          {!archivesCollapsed && <div className="mt-5 min-w-0">
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
              {[["select", "Sélection groupe", archives.length + " groupe" + (archives.length > 1 ? "s" : "")], ["create", "Créer un groupe", archiveFormMatchCount ? archiveFormMatchCount + " game" + (archiveFormMatchCount > 1 ? "s" : "") : "Masqué"]].map(([id, label, meta]) => <button key={id} type="button" onClick={() => setArchiveWorkspaceTab(id)} className={cx("flex min-w-[12rem] flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition", archiveWorkspaceTab === id ? "border-cyan-200/35 bg-cyan-400/12 text-white shadow-[0_0_22px_rgba(34,211,238,.10)]" : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.045]")}><span className="text-xs font-black uppercase tracking-[0.14em]">{label}</span><span className="text-[0.58rem] font-black uppercase tracking-[0.1em] opacity-75">{meta}</span></button>)}
            </div>
            {archiveWorkspaceTab === "select" ? <>
            <section className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
                <div><p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-slate-300">Groupes sauvegardés</p><p className="mt-1 text-sm font-semibold text-slate-400">Clique pour lire le bloc, reclique pour revenir à la vue globale.</p></div>
                {selectedArchive && selectedArchiveReport && <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => openAppPath("/rapports?report=" + selectedArchiveReport.id)}>Review active</Button>}
              </div>
              <div className="mt-3 max-h-[22rem] space-y-2 overflow-auto pr-1">
                {archives.length ? archives.map((archive) => { const ids = archiveMatchIds(archive); const count = ids.length; const archiveMatches = matches.filter((match) => ids.includes(match.id)); const archiveWins = archiveMatches.filter((match) => match.result === "Victoire").length; const selected = selectedArchiveId === archive.id; const archiveReport = (data.reports || []).find((report) => { const reportIds = reportMatchIds(report); return report.team_id === selectedTeamId && ids.length && ids.every((id) => reportIds.includes(id)) && reportIds.every((id) => ids.includes(id)); }); return <div key={archive.id} className={cx("relative overflow-hidden rounded-2xl border p-3 transition", selected ? "border-cyan-200/80 bg-cyan-400/16 shadow-[0_0_0_1px_rgba(103,232,249,.26),0_0_30px_rgba(34,211,238,.16)]" : "border-white/10 bg-black/24 hover:border-cyan-300/20 hover:bg-white/[0.05]")}>
                  <div className={cx("pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,.72)] transition", selected ? "opacity-100" : "opacity-0")} />
                  <button type="button" onClick={() => setSelectedArchiveId(selectedArchiveId === archive.id ? "" : archive.id)} className="flex w-full min-w-0 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60">
                    <span className={cx("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", selected ? "border-cyan-200/45 bg-cyan-300/14 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-300")}><FileText className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-black text-white">{archive.name}</span><Badge tone="purple">{count} game{count > 1 ? "s" : ""}</Badge>{selected && <Badge tone="cyan">Actif</Badge>}</span><span className={cx("mt-1 block truncate text-xs font-semibold", selected ? "text-cyan-100" : "text-slate-300")}>{archive.description || "Créée par " + (archive.created_by_name || "NXT5")}</span><span className="mt-2 block text-xs font-black uppercase tracking-[0.14em] text-cyan-100">WR {Math.round((archiveWins / Math.max(1, count)) * 100)}% · {archiveWins}W - {count - archiveWins}L</span></span>
                  </button>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">{archiveReport && <Button type="button" variant="ghost" icon={ArrowRight} onClick={() => openAppPath("/rapports?report=" + archiveReport.id)} disabled={savingArchive}>Review</Button>}<Button type="button" variant="ghost" icon={Pencil} onClick={() => editArchive(archive)} disabled={savingArchive}>Modifier</Button><Button type="button" variant="ghost" icon={Trash2} onClick={() => deleteArchive(archive)} disabled={savingArchive}>Supprimer</Button></div>
                </div>; }) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-semibold text-slate-300"><p>Aucun groupe enregistré.</p><Button type="button" className="mt-3" variant="ghost" icon={Plus} onClick={() => setArchiveWorkspaceTab("create")}>Créer un groupe</Button></div>}
              </div>
            </section>
            </> : <>
            <form onSubmit={saveArchive} className="min-w-0 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-cyan-100">Création rapide</p><h4 className="mt-1 text-xl font-black text-white">{archiveFormTitle}</h4><p className="mt-1 text-sm font-semibold text-slate-300">{archiveFormMatchCount ? archiveFormMatchCount + " game" + (archiveFormMatchCount > 1 ? "s" : "") + " dans le bloc" : "Choisis les games à inclure"}</p></div><Badge tone={archiveFormMatchCount ? "cyan" : "slate"}>{archiveFormMatchCount}/{matches.length}</Badge></div>
              <div className="mt-4 grid gap-3 2xl:grid-cols-2"><TextInput label="Nom du groupe" value={archiveForm.name} onChange={(name) => setArchiveForm((current) => ({ ...current, name }))} placeholder="Scrim vs BK - 26/05" required icon={FileText} /><TextInput label="Description" value={archiveForm.description} onChange={(description) => setArchiveForm((current) => ({ ...current, description }))} placeholder="Bo3, bloc early, test compo..." icon={Clipboard} /></div>
              <div className="mt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Games à inclure</p><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" icon={Plus} onClick={selectAllArchiveMatches} disabled={!matches.length || archiveFormMatchCount === matches.length}>Tout prendre</Button><Button type="button" variant="ghost" icon={X} onClick={clearArchiveMatches} disabled={!archiveFormMatchCount}>Vider</Button></div></div><div className="mt-2 grid max-h-[20rem] gap-2 overflow-auto pr-1 md:grid-cols-2">{matches.map((match) => { const picked = archiveForm.matchIds.includes(match.id); return <button key={match.id} type="button" aria-pressed={picked} onClick={() => toggleArchiveMatch(match.id)} className={cx("flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60", picked ? "border-cyan-300/40 bg-cyan-400/12" : "border-white/10 bg-black/22 hover:border-cyan-300/20 hover:bg-white/[0.055]")}><span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border", picked ? "border-cyan-200/45 bg-cyan-300/18 text-cyan-50" : "border-white/14 bg-white/[0.035] text-transparent")}><Check className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.duration || "--:--"}</Badge></span><span className="mt-2 block truncate text-sm font-black text-white">{matchDisplayName(match)}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-300">{match.game_id}</span></span></button>; })}</div></div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">{archiveForm.id && <Button type="button" variant="ghost" icon={X} onClick={resetArchiveForm}>Annuler</Button>}<Button type="submit" icon={savingArchive ? Loader2 : Check} disabled={savingArchive || !archiveForm.name.trim() || !archiveForm.matchIds.length}>{archiveForm.id ? "Enregistrer" : "Créer le groupe"}</Button></div>
            </form>
            </>}
          </div>}
        </Surface>}
        {selectedArchive && <ScrimArchiveSummary matches={scopedMatches} selectedMatchId={selectedMatchId} onSelectMatch={setSelectedMatchId} />}
        {selectedMatch && <MatchDataPanel match={selectedMatch} />}
      </> : <Surface glow><EmptyState icon={BarChart3} title="Aucune statistique" text="Importe une game dans Intégration pour alimenter les graphiques." /></Surface>}
    </div>
  );
}

function ReviewSignalPanel({ match, rows }) {
  const ally = rows.filter((row) => row.team_key === "ALLY");
  const enemy = rows.filter((row) => row.team_key === "ENEMY");
  const sum = (items, key) => items.reduce((total, row) => total + Number(row[key] || 0), 0);
  const allyDamage = sum(ally, "damage");
  const enemyDamage = sum(enemy, "damage");
  const allyVision = sum(ally, "vision");
  const enemyVision = sum(enemy, "vision");
  const allyGold = sum(ally, "gold");
  const enemyGold = sum(enemy, "gold");
  const allyTowerDamage = ally.reduce((total, row) => total + towerDamage(row), 0);
  const enemyTowerDamage = enemy.reduce((total, row) => total + towerDamage(row), 0);
  const topDamage = ally.slice().sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0))[0];
  const topVision = ally.slice().sort((a, b) => Number(b.vision || 0) - Number(a.vision || 0))[0];
  const goldDiff = allyGold - enemyGold;
  const damageDiff = allyDamage - enemyDamage;
  const towerDamageDiff = allyTowerDamage - enemyTowerDamage;
  const visionDiff = allyVision - enemyVision;
  const signals = [
    [Target, "Dégâts", (damageDiff >= 0 ? "+" : "") + formatPoints(damageDiff) + " dégâts équipe", damageDiff >= 0 ? "green" : "red"],
    [Trophy, "Tours", (towerDamageDiff >= 0 ? "+" : "") + formatPoints(towerDamageDiff) + " dégâts tours", towerDamageDiff >= 0 ? "green" : "red"],
    [Eye, "Vision", (visionDiff >= 0 ? "+" : "") + formatPoints(visionDiff) + " vision face aux adversaires", visionDiff >= 0 ? "cyan" : "red"],
    [Gauge, "Économie", formatGoldDiff(goldDiff) + " or équipe", goldDiff >= 0 ? "green" : "red"],
  ];
  const identity = compositionIdentity(ally);
  if (!rows.length) return null;
  return <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_.72fr]"><div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{signals.map(([Icon, title, value, t]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">{title}</p><div className={cx("rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><p className="mt-3 text-sm font-black leading-6 text-white">{value}</p></div>)}</div><div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Identité de Compo</p><Badge tone={championStyleTone(identity.primary)}>{tagLabel(identity.primary)}</Badge></div><p className="mt-3 text-sm font-bold leading-6 text-white">{identity.text}</p><div className="mt-3 flex flex-wrap gap-2">{identity.tags.length ? identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Standard</Badge>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{[["Plus de dégâts", topDamage], ["Plus de vision", topVision]].map(([label, row]) => <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2"><div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-black/30">{row ? <ChampionPortrait row={row} champion={row.champion} alt={row.champion} /> : null}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "À remplir"}</p><p className="truncate text-xs font-semibold text-slate-300">{label} · {row ? championDisplayName(row.champion) : "Importe une game"}</p></div></div>)}</div></div></div>;
}

function ParticipantTable({ rows }) {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALLY");
  const maxDamage = Math.max(1, ...rows.map((row) => Number(row.damage || 0)));
  const maxTowerDamage = Math.max(1, ...rows.map((row) => towerDamage(row)));
  const maxGold = Math.max(1, ...rows.map((row) => Number(row.gold || 0)));
  const filtered = rows.filter((row) => { const rowText = String(row.summoner_name || "") + " " + String(row.champion || "") + " " + String(row.role || ""); return rowText.toLowerCase().includes(query.toLowerCase()) && (teamFilter === "ALL" || row.team_key === teamFilter); });
  if (!rows.length) return <EmptyState icon={BarChart3} title="Participants non calculés" text="Importe une game Riot pour afficher les champions, KDA, dégâts, gold et vision." />;
  return <div><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="w-full md:max-w-sm"><TextInput label="Rechercher" value={query} onChange={setQuery} placeholder="Champion, joueur, rôle..." icon={Search} /></div><div className="flex gap-2">{[["ALLY", "Nous"], ["ENEMY", "Eux"], ["ALL", "Tous"]].map(([id, label]) => <button key={id} onClick={() => setTeamFilter(id)} className={cx("rounded-2xl border px-4 py-2 text-sm font-black transition", teamFilter === id ?"border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]")}>{label}</button>)}</div></div><div className="grid gap-3">{filtered.map((row) => <div key={row.id} className={cx("grid gap-4 rounded-[1.35rem] border p-4 transition xl:grid-cols-[minmax(220px,1.35fr)_minmax(110px,.62fr)_minmax(128px,.72fr)_minmax(128px,.72fr)_minmax(128px,.72fr)_minmax(90px,.5fr)] md:items-center", row.team_key === "ALLY" ?"border-cyan-300/20 bg-cyan-400/8" : "border-rose-300/15 bg-rose-500/7")}><div className="flex min-w-0 items-center gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><ChampionPortrait row={row} champion={row.champion} alt={row.champion} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={row.team_key === "ALLY" ?"cyan" : "red"}>{row.role || "?"}</Badge></div><p className="mt-1 truncate text-lg font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-sm font-semibold text-slate-300">{row.summoner_name || row.riot_id || "?"}</p></div></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">KDA</p><p className="mt-1 text-lg font-black text-white">{row.kda}</p><p className="text-xs font-semibold text-slate-300">KP {row.kill_participation}</p></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Dégâts</p><p className="mt-1 text-lg font-black text-white">{formatPoints(row.damage)}</p><StatBar value={row.damage} max={maxDamage} tone={row.team_key === "ALLY" ?"cyan" : "red"} /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Dégâts tours</p><p className="mt-1 text-lg font-black text-white">{formatPoints(towerDamage(row))}</p><StatBar value={towerDamage(row)} max={maxTowerDamage} tone="purple" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Gold / CS</p><p className="mt-1 text-lg font-black text-white">{formatPoints(row.gold)}</p><p className="text-xs font-semibold text-slate-300">{row.cs} CS · {row.cs_per_min}/min</p><StatBar value={row.gold} max={maxGold} tone="yellow" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Vision</p><p className="mt-1 text-lg font-black text-white">{row.vision}</p></div></div>)}</div></div>;
}

function ChampionPoolCard({ row }) {
  const recordTone = Number(row.wins || 0) >= Number(row.losses || 0) ? "green" : "yellow";
  const styleTags = championStyleTags(row.champion).slice(0, 3);
  const status = championPoolStatus(row);
  return <div className="group relative min-h-[340px] overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-5"><img src={championSplashUrl(row.champion)} alt={row.champion} className="absolute inset-0 h-full w-full object-cover opacity-36 transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#050711] via-[#050711]/78 to-[#050711]/20" /><div className="relative z-10 flex h-full flex-col justify-between"><div><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[0.2em] text-cyan-100/70">{row.player_name}</p><h3 className="mt-2 truncate text-3xl font-black text-white">{championDisplayName(row.champion)}</h3></div></div><div className="mt-4 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2"><Badge tone={championPoolStatusTone(status)}>{championPoolStatusLabel(status)}</Badge>{styleTags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div><p className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">{row.verdict || "Données insuffisantes"}</p></div><div className="mt-8 grid gap-3"><div className="grid grid-cols-3 gap-2"><div className="min-w-0 rounded-2xl border border-white/10 bg-black/35 p-3"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Games</p><p className="mt-1 truncate text-xl font-black text-white">{row.games}</p></div><div className="min-w-0 rounded-2xl border border-white/10 bg-black/35 p-3"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">KDA</p><p className="mt-1 truncate text-xl font-black text-white">{Number(row.kda || 0).toFixed(1)}</p></div><div className="min-w-0 rounded-2xl border border-white/10 bg-black/35 p-3"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">CS/min</p><p className="mt-1 truncate text-xl font-black text-white">{row.cs_per_min || "?"}</p></div></div><div className="flex min-w-0 flex-wrap gap-2"><Badge tone={recordTone}>{row.wins || 0}W / {row.losses || 0}L</Badge><Badge tone="slate">{row.games || 0} games jouées</Badge></div></div></div></div>;
}

function championPoolStatus(row) {
  const status = String(row?.status || "");
  return ["lock", "pocket", "work", "danger"].includes(status) ? status : "work";
}

function championPoolStatusLabel(status) {
  return status === "lock" ? "Pick de confiance" : status === "danger" ? "Pick en développement training" : status === "pocket" ? "Pick situationnel" : "Pick en validation";
}

function championPoolStatusTone(status) {
  return status === "lock" ? "green" : status === "danger" ? "red" : status === "pocket" ? "yellow" : "cyan";
}

function championTierByStatus(status) {
  return CHAMPION_TIERS.find((tier) => tier.id === status) || CHAMPION_TIERS.find((tier) => tier.id === "work") || CHAMPION_TIERS[0];
}

function ManualChampionPoolPanel({ players, rows, selectedTeamId, canManage, refreshAll, pushToast }) {
  const playablePlayers = players.filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role));
  const manualRows = rows.filter((row) => row.team_id === selectedTeamId && ["manual", "riot_manual"].includes(String(row.source || "")));
  const [form, setForm] = useState({ playerId: "", champion: "", status: "lock", notes: "" });
  const [saving, setSaving] = useState(false);
  const selectedPlayer = playablePlayers.find((player) => player.id === form.playerId);

  useEffect(() => {
    if (!form.playerId && playablePlayers[0]?.id) setForm((current) => ({ ...current, playerId: playablePlayers[0].id }));
  }, [playablePlayers.map((player) => player.id).join("|")]);

  async function saveManualPick(event) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, ...form }) });
      setForm((current) => ({ ...current, champion: "", notes: "" }));
      await refreshAll();
      pushToast({ type: "green", title: "Champion ajouté", text: "Le Champion Pool est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteManualPick(poolId) {
    if (!canManage || !window.confirm("Retirer ce pick du Champion Pool ?")) return;
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, poolId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Pick retiré", text: "Le Champion Pool est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return <Surface glow className="mb-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div><Badge tone="purple">Configuration</Badge><h3 className="mt-4 text-2xl font-black text-white">Champion Pool déclaré</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Ajoute les champions que chaque joueur sait jouer. Ils apparaissent dans les filtres, la draft et l’identité de Compo.</p></div><Badge tone={canManage ? "green" : "yellow"}>{canManage ? "Modifiable" : "Lecture seule"}</Badge></div>{playablePlayers.length ? <form onSubmit={saveManualPick} className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(150px,.65fr)_auto]"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Joueur</span><select value={form.playerId} onChange={(event) => setForm({ ...form, playerId: event.target.value })} disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-black text-white outline-none">{playablePlayers.map((player) => <option key={player.id} value={player.id}>{player.role} · {player.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Champion</span><input list="champion-options" value={form.champion} onChange={(event) => setForm({ ...form, champion: event.target.value })} placeholder="Kai'Sa, Orianna..." required disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-300" /><datalist id="champion-options">{championOptions().map((champion) => <option key={champion} value={championDisplayName(champion)} />)}</datalist></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Statut</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-black text-white outline-none"><option value="lock">Pick de confiance</option><option value="pocket">Pick situationnel</option><option value="work">Pick en validation</option><option value="danger">Pick en développement training</option></select></label><div className="flex items-end"><Button type="submit" disabled={!canManage || saving || !form.playerId || !form.champion.trim()} icon={saving ? Loader2 : Plus} className="w-full">Ajouter</Button></div></form> : <EmptyState icon={Users} title="Aucun joueur" text="Ajoute le roster avant de configurer le Champion Pool." />}{manualRows.length > 0 && <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Picks déclarés</p><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{manualRows.map((row) => <div key={row.id} className="w-[260px] shrink-0 rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center gap-3"><ChampionMasteryPortrait row={row} alt={row.champion} className="h-12 w-12 rounded-full" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-xs font-semibold text-slate-300">{row.role || "ROLE"} · {row.player_name}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone={championPoolStatusTone(championPoolStatus(row))}>{championPoolStatusLabel(championPoolStatus(row))}</Badge>{championStyleTags(row.champion).slice(0, 2).map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div>{canManage && <button type="button" onClick={() => deleteManualPick(row.id)} disabled={saving} className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-rose-200 hover:text-white">Retirer</button>}</div>)}</div></div>}</Surface>;
}

function ChampionPoolRecommendationPanel({ rows }) {
  const locks = rows.filter((row) => championPoolStatus(row) === "lock").slice(0, 3);
  const danger = rows.filter((row) => championPoolStatus(row) === "danger").slice(0, 3);
  const pockets = rows.filter((row) => championPoolStatus(row) === "pocket").slice(0, 3);
  const groups = [
    [Crown, "Picks de confiance", locks, "green"],
    [AlertTriangle, "Picks en training", danger, "red"],
    [Flame, "Picks situationnels", pockets, "yellow"],
  ];
  return <div className="mb-5 grid gap-3 xl:grid-cols-3">{groups.map(([Icon, title, items, t]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">{title}</p><div className={cx("rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><div className="mt-3 space-y-2">{items.length ? items.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2"><ChampionMasteryPortrait row={row} alt={row.champion} className="h-9 w-9 rounded-full" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-xs font-semibold text-slate-300">{row.player_name || "Roster"} · {row.games || 0} games</p></div></div>) : <p className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm font-semibold text-slate-300">Pas assez de données.</p>}</div></div>)}</div>;
}

const CHAMPION_TIERS = [
  { id: "lock", title: "Pick de confiance", hint: "Pick fiable, prêt pour scrim ou match.", tone: "green" },
  { id: "pocket", title: "Pick situationnel", hint: "Bon pick à sortir dans un contexte précis.", tone: "yellow" },
  { id: "work", title: "Pick en validation", hint: "Bonne perf en scrim, à valider avant de le prioriser.", tone: "cyan" },
  { id: "danger", title: "Pick en développement training", hint: "Besoin d’au moins 15 games de training avant validation.", tone: "red" },
];

function championTierFrame(tier, active = false) {
  const t = tier?.tone || "cyan";
  const base = {
    green: "border-emerald-300/24 bg-emerald-400/[0.075] text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,.08)]",
    yellow: "border-amber-300/24 bg-amber-300/[0.075] text-amber-200 shadow-[0_0_28px_rgba(251,191,36,.08)]",
    cyan: "border-cyan-300/24 bg-cyan-400/[0.075] text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,.08)]",
    red: "border-rose-300/24 bg-rose-500/[0.075] text-rose-200 shadow-[0_0_28px_rgba(244,63,94,.08)]",
  }[t] || "border-cyan-300/24 bg-cyan-400/[0.075]";
  const strong = {
    green: "border-emerald-200/55 bg-emerald-300/18 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,.20)]",
    yellow: "border-amber-200/55 bg-amber-300/18 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,.18)]",
    cyan: "border-cyan-200/55 bg-cyan-300/18 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.20)]",
    red: "border-rose-200/55 bg-rose-400/18 text-rose-100 shadow-[0_0_22px_rgba(244,63,94,.18)]",
  }[t] || base;
  return active ? strong : base;
}

function championTierColumnFrame(tier) {
  const t = tier?.tone || "cyan";
  return {
    green: "border-emerald-200/32 bg-[linear-gradient(135deg,rgba(6,95,70,.30),rgba(2,6,23,.58)_46%,rgba(16,185,129,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(52,211,153,.12)]",
    yellow: "border-amber-200/32 bg-[linear-gradient(135deg,rgba(146,64,14,.28),rgba(2,6,23,.58)_46%,rgba(251,191,36,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(251,191,36,.10)]",
    cyan: "border-cyan-200/32 bg-[linear-gradient(135deg,rgba(8,145,178,.28),rgba(2,6,23,.58)_46%,rgba(34,211,238,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(34,211,238,.12)]",
    red: "border-rose-200/32 bg-[linear-gradient(135deg,rgba(159,18,57,.28),rgba(2,6,23,.58)_46%,rgba(244,63,94,.12))] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(244,63,94,.12)]",
  }[t] || "border-cyan-200/32 bg-cyan-400/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_34px_rgba(34,211,238,.12)]";
}

function championTierColumnGlow(tier) {
  const t = tier?.tone || "cyan";
  return {
    green: "from-emerald-300/13 via-transparent to-emerald-400/8",
    yellow: "from-amber-300/13 via-transparent to-amber-400/8",
    cyan: "from-cyan-300/13 via-transparent to-cyan-400/8",
    red: "from-rose-300/13 via-transparent to-rose-400/8",
  }[t] || "from-cyan-300/13 via-transparent to-cyan-400/8";
}

function ChampionTierMark({ tier, active = false, className = "" }) {
  const Icon = tier?.id === "lock" ? ShieldCheck : tier?.id === "pocket" ? Flame : tier?.id === "danger" ? AlertTriangle : Gauge;
  return <span className={cx("relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition", championTierFrame(tier, active), className)}>
    <Icon className="relative z-10 h-5 w-5 drop-shadow-[0_0_10px_rgba(255,255,255,.20)]" />
    <span className="pointer-events-none absolute inset-x-1 bottom-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
  </span>;
}

function ChampionMasteryPortrait({ row, champion, alt, className = "h-12 w-12 rounded-xl" }) {
  return <span className={cx("relative inline-flex shrink-0 overflow-visible", className)}>
    <ChampionPortrait row={row} champion={champion || row?.champion} alt={alt || champion || row?.champion} className="h-full w-full rounded-[inherit] object-cover" />
  </span>;
}

const CHAMPION_LANE_POOLS = {
  TOP: ["Aatrox", "Camille", "Chogath", "Darius", "DrMundo", "Fiora", "Gangplank", "Garen", "Gnar", "Gwen", "Irelia", "Jax", "Jayce", "Kayle", "Kennen", "Kled", "KSante", "Malphite", "MonkeyKing", "Mordekaiser", "Nasus", "Olaf", "Ornn", "Pantheon", "Poppy", "Quinn", "Renekton", "Riven", "Rumble", "Ryze", "Sett", "Shen", "Singed", "Sion", "Teemo", "Tryndamere", "Urgot", "Vladimir", "Volibear", "Warwick", "Yone", "Yorick"],
  JGL: ["Amumu", "Diana", "Ekko", "Elise", "Evelynn", "Fiddlesticks", "Gragas", "Graves", "Hecarim", "Ivern", "JarvanIV", "Karthus", "Kayn", "Khazix", "Kindred", "LeeSin", "Lillia", "Maokai", "MasterYi", "MonkeyKing", "Nidalee", "Nocturne", "Nunu", "Olaf", "Poppy", "Rammus", "RekSai", "Rengar", "Sejuani", "Shyvana", "Skarner", "Taliyah", "Trundle", "Udyr", "Vi", "Viego", "Volibear", "Warwick", "XinZhao", "Zac"],
  MID: ["Ahri", "Akali", "Anivia", "Annie", "AurelionSol", "Azir", "Cassiopeia", "Corki", "Diana", "Ekko", "Fizz", "Galio", "Hwei", "Irelia", "Kassadin", "Katarina", "Leblanc", "Lissandra", "Lux", "Malzahar", "Neeko", "Orianna", "Qiyana", "Ryze", "Sylas", "Syndra", "Taliyah", "Talon", "TwistedFate", "Veigar", "Velkoz", "Vex", "Viktor", "Vladimir", "Xerath", "Yasuo", "Yone", "Zed", "Ziggs", "Zoe"],
  ADC: ["Aphelios", "Ashe", "Caitlyn", "Draven", "Ezreal", "Jhin", "Jinx", "Kaisa", "Kalista", "KogMaw", "Lucian", "MissFortune", "Nilah", "Samira", "Senna", "Seraphine", "Sivir", "Smolder", "Tristana", "Twitch", "Varus", "Vayne", "Xayah", "Zeri", "Ziggs"],
  SUP: ["Alistar", "Ashe", "Bard", "Blitzcrank", "Brand", "Braum", "Janna", "Karma", "Leona", "Lulu", "Lux", "Maokai", "Milio", "Morgana", "Nami", "Nautilus", "Pyke", "Rakan", "Rell", "Renata", "Senna", "Seraphine", "Sona", "Soraka", "Swain", "TahmKench", "Taric", "Thresh", "Yuumi", "Zilean", "Zyra"],
};

const ADDITIONAL_CHAMPION_LANE_POOLS = {
  TOP: ["Ambessa", "Aurora", "Illaoi", "Zaahen"],
  JGL: ["Belveth", "Briar", "Shaco", "Zaahen"],
  MID: ["Akshan", "Aurora", "Mel", "Naafiri"],
  ADC: ["Mel", "Yunara"],
  SUP: ["Mel"],
};

const ALL_CHAMPION_LANE_POOLS = Object.fromEntries(
  Object.keys(CHAMPION_LANE_POOLS).map((lane) => [lane, [...new Set([...(CHAMPION_LANE_POOLS[lane] || []), ...(ADDITIONAL_CHAMPION_LANE_POOLS[lane] || [])])]])
);

function championMatchesLane(champion, lane) {
  if (!lane || lane === "ALL") return true;
  const id = championAssetId(champion);
  return (ALL_CHAMPION_LANE_POOLS[lane] || []).includes(id);
}

function ChampionTierCard({ row, canManage, saving, onDragStart, onDelete }) {
  const detail = championPoolStatusLabel(championPoolStatus(row));
  return <div draggable={canManage} onDragStart={(event) => onDragStart(event, row)} className={cx("group flex min-h-[52px] min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2 transition", canManage ?"cursor-grab active:cursor-grabbing hover:border-cyan-300/25 hover:bg-white/[0.05]" : "")}><ChampionMasteryPortrait row={row} alt={row.champion} className="h-10 w-10 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-[0.68rem] font-semibold text-slate-300">{detail}</p></div>{canManage && <button type="button" onClick={() => onDelete(row)} disabled={saving} className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>}</div>;
}

function ChampionSearchTile({ champion, active, existingRow, canManage, onDragStart, onQuickPick }) {
  const source = existingRow && ["manual", "riot_manual"].includes(String(existingRow.source || "")) ? existingRow : { champion };
  return <div draggable={canManage} onDragStart={(event) => onDragStart(event, source)} className={cx("group relative min-w-[150px] rounded-2xl border p-2 text-left transition", canManage && "cursor-grab active:cursor-grabbing", active ? "border-cyan-300/28 bg-cyan-400/10 shadow-[0_0_18px_rgba(34,211,238,.08)]" : "border-white/10 bg-white/[0.035] hover:border-cyan-300/25 hover:bg-cyan-400/10")}>
    <div className="flex min-w-0 items-center gap-2">
      <ChampionPortrait champion={champion} alt={champion} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
      <span className="min-w-0 flex-1 truncate text-xs font-black text-white">{championDisplayName(champion)}</span>
      {active && <span className="shrink-0 rounded-full border border-cyan-200/18 bg-cyan-400/10 px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.12em] text-cyan-100">Pool</span>}
    </div>
    {canManage && <div className="mt-2 grid grid-cols-4 justify-items-center gap-1.5 opacity-80 transition group-hover:opacity-100">
      {CHAMPION_TIERS.map((tier) => {
        const selected = active && championPoolStatus(existingRow) === tier.id;
        return <button key={tier.id} type="button" onClick={(event) => { event.stopPropagation(); onQuickPick(champion, tier.id, source.id || null); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0.5 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-200/35" title={`Mettre en ${tier.title}`} aria-label={`Mettre ${championDisplayName(champion)} en ${tier.title}`}><ChampionTierMark tier={tier} active={selected} className="h-8 w-8" /></button>;
      })}
    </div>}
  </div>;
}

function Champions({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const activeTeamId = selectedTeamId || data.teams[0]?.id || null;
  const canManageTeamPool = canStaffManage(currentMember?.role);
  const players = (data.players || []).filter((player) => String(player.team_id || "") === String(activeTeamId || "") && isGameplayRole(player.role));
  const linkedPlayer = players.find((player) => String(player.user_id || "") === String(user?.id || ""));
  const laneOptions = ["ALL", "TOP", "JGL", "MID", "ADC", "SUP"];
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [query, setQuery] = useState("");
  const [laneFilter, setLaneFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [localPool, setLocalPool] = useState(data.championPool || []);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || players[0];
  const canManageSelectedPool = canManageTeamPool || String(selectedPlayer?.user_id || "") === String(user?.id || "");
  const selectedPlayerRows = (localPool || [])
    .filter((row) => String(row.team_id || "") === String(activeTeamId || "") && selectedPlayer && (String(row.player_id || "") === String(selectedPlayer.id || "") || row.player_name === selectedPlayer.name))
    .filter((row) => ["manual", "riot_manual"].includes(String(row.source || "")))
    .map((row) => ({ ...row, role: row.role || selectedPlayer?.role || "UNK", status: championPoolStatus(row) }));
  const selectedRows = selectedPlayerRows
    .sort((a, b) => championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
  const selectedChampionByKey = new Map();
  selectedPlayerRows.forEach((row) => {
    const key = championAssetId(row.champion) || championKey(row.champion);
    if (!key || selectedChampionByKey.has(key)) return;
    selectedChampionByKey.set(key, row);
  });
  selectedRows.forEach((row) => {
    const key = championAssetId(row.champion) || championKey(row.champion);
    if (key) selectedChampionByKey.set(key, row);
  });
  const pickedChampionKeys = new Set(selectedRows.map((row) => championAssetId(row.champion) || championKey(row.champion)));
  const visibleChampions = championOptions()
    .filter((champion) => championDisplayName(champion).toLowerCase().includes(query.toLowerCase()))
    .filter((champion) => championMatchesLane(champion, laneFilter));

  useEffect(() => {
    const fallbackPlayerId = !canManageTeamPool && linkedPlayer?.id ? linkedPlayer.id : players[0]?.id || "";
    if (!selectedPlayerId && fallbackPlayerId) setSelectedPlayerId(fallbackPlayerId);
    if (selectedPlayerId && !players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(fallbackPlayerId);
  }, [activeTeamId, canManageTeamPool, linkedPlayer?.id, players.map((player) => player.id).join("|")]);

  useEffect(() => {
    if (selectedPlayer?.role && laneOptions.includes(selectedPlayer.role)) setLaneFilter(selectedPlayer.role);
  }, [selectedPlayer?.id]);

  useEffect(() => {
    setLocalPool(data.championPool || []);
  }, [data.championPool]);

  function rowsForTier(status) {
    return selectedRows.filter((row) => row.status === status);
  }

  function dragPayload(event) {
    try {
      return JSON.parse(event.dataTransfer.getData("application/json") || "{}");
    } catch {
      return {};
    }
  }

  function onDragStart(event, row) {
    if (!canManageSelectedPool) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("application/json", JSON.stringify({ champion: row.champion, poolId: row.id || null }));
    event.dataTransfer.effectAllowed = "move";
  }

  async function saveChampion(champion, status, poolId = null) {
    if (!canManageSelectedPool || !selectedPlayer || !champion) return;
    const championName = championAssetId(champion) || championDisplayName(champion);
    const championId = championAssetId(champion);
    const existing = (localPool || []).find((row) => String(row.team_id || "") === String(activeTeamId || "") && ["manual", "riot_manual"].includes(String(row.source || "")) && (poolId ? String(row.id || "") === String(poolId) : (String(row.player_id || "") === String(selectedPlayer.id || "") || row.player_name === selectedPlayer.name) && championAssetId(row.champion) === championId));
    const keepStats = Boolean(existing);
    const optimistic = {
      ...(existing || {}),
      id: existing?.id || `optimistic-${selectedPlayer.id}-${championId}`,
      team_id: activeTeamId,
      player_id: selectedPlayer.id,
      player_name: selectedPlayer.name,
      role: selectedPlayer.role,
      champion: championName,
      status,
      source: existing?.source || "manual",
      games: keepStats ? existing?.games || 0 : 0,
      wins: keepStats ? existing?.wins || 0 : 0,
      losses: keepStats ? existing?.losses || 0 : 0,
      winrate: keepStats ? existing?.winrate || 0 : 0,
      kda: keepStats ? existing?.kda || 0 : 0,
      cs_per_min: keepStats ? existing?.cs_per_min || 0 : 0,
      impact_grade: existing?.impact_grade || "POOL",
    };
    setLocalPool((current) => existing
      ? current.map((row) => row.id === existing.id ? optimistic : row)
      : [...current, optimistic]);
    setSaving(true);
    try {
      const result = await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ teamId: activeTeamId, playerId: selectedPlayer.id, champion: championName, status, poolId: existing && ["manual", "riot_manual"].includes(String(existing.source || "")) ? existing.id : null, notes: "" }) });
      if (result?.pick) setLocalPool((current) => current.map((row) => row.id === optimistic.id ? result.pick : row));
    } catch (err) {
      setLocalPool((current) => existing
        ? current.map((row) => row.id === existing.id ? existing : row)
        : current.filter((row) => row.id !== optimistic.id));
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deletePick(row, options = {}) {
    if (!canManageSelectedPool || !row?.id) return;
    if (options.confirm !== false && !window.confirm("Retirer ce champion du Champion Pool ?")) return;
    if (String(row.id).startsWith("optimistic-")) {
      setLocalPool((current) => current.filter((item) => item.id !== row.id));
      return;
    }
    const previousPool = localPool;
    setLocalPool((current) => current.filter((item) => item.id !== row.id));
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ action: "delete", teamId: activeTeamId, poolId: row.id }) });
    } catch (err) {
      setLocalPool(previousPool);
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function dropOnTier(event, status) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (payload.champion) saveChampion(payload.champion, status, payload.poolId);
  }

  function dropOnChampionBase(event) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (!payload.poolId) return;
    const row = selectedRows.find((item) => String(item.id || "") === String(payload.poolId));
    if (row) deletePick(row, { confirm: false });
  }

  return (
    <div>
      <PageHeader eyebrow="Champion Path" title="Champion Pool par joueur" />
      {players.length ? (
        <>
          <Surface glow className="mb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Joueur actif</h3>
                <p className="mt-1 text-sm font-semibold text-slate-300">Le choix du joueur reste en haut pour laisser toute la largeur aux tableaux.</p>
              </div>
              <ChampionPoolColorSummary />
            </div>
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
              {players.map((player) => {
                const selected = selectedPlayer?.id === player.id;
                return (
                  <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={cx("min-w-[190px] rounded-2xl border p-4 text-left transition", selected ? "border-cyan-300/35 bg-cyan-400/10 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}>
                    <div className="flex items-center gap-3">
                      <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", selected ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-black/25")}>
                        <RoleIcon role={player.role} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-black text-white">{player.name}</p>
                        {player.riot_id && <p className="mt-1 truncate text-xs font-semibold text-slate-300">{player.riot_id}</p>}
                        {String(player.user_id || "") === String(user?.id || "") && <div className="mt-2"><Badge tone="orange">Mon profil</Badge></div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Surface>

          {selectedPlayer && (
            <div className="grid gap-4 2xl:grid-cols-[minmax(360px,480px)_minmax(0,1fr)] 2xl:items-start">
              <Surface className="p-4 2xl:sticky 2xl:top-24">
                <div className="grid gap-4">
                  <div>
                    <TextInput label="Ajouter un champion" value={query} onChange={setQuery} placeholder="Cherche Ahri, Renekton, Kai'Sa..." icon={Search} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {laneOptions.map((lane) => (
                        <button key={lane} type="button" onClick={() => setLaneFilter(lane)} className={cx("rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition", laneFilter === lane ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-300 hover:text-white")}>{lane === "ALL" ? "Toutes lanes" : lane}</button>
                      ))}
                    </div>
                  </div>

                  <div onDragOver={(event) => canManageSelectedPool && event.preventDefault()} onDrop={(event) => canManageSelectedPool && dropOnChampionBase(event)}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black text-white">{selectedPlayer.name}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-300">{canManageSelectedPool ? `${visibleChampions.length} champions affichés · glisse ici un pick pour le retirer.` : "Lecture seule : seul le capitaine ou le joueur lié à ce profil peut modifier ce Champion Pool."}</p>
                      </div>
                      <Badge tone="orange">{selectedPlayer.role}</Badge>
                    </div>
                    <div className="grid max-h-[min(58vh,560px)] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2 overflow-auto pr-1">
                      {visibleChampions.map((champion) => {
                        const championKeyValue = championAssetId(champion) || championKey(champion);
                        const active = pickedChampionKeys.has(championKeyValue);
                        return <ChampionSearchTile key={champion} champion={champion} active={active} existingRow={selectedChampionByKey.get(championKeyValue)} canManage={canManageSelectedPool} onDragStart={onDragStart} onQuickPick={saveChampion} />;
                      })}
                    </div>
                  </div>
                </div>
              </Surface>

              <div className="grid gap-3 xl:grid-cols-2">
                {CHAMPION_TIERS.map((tier) => {
                  const items = rowsForTier(tier.id);
                  return (
                    <Surface key={tier.id} className="p-3" delay={0}>
                      <div onDragOver={(event) => canManageSelectedPool && event.preventDefault()} onDrop={(event) => canManageSelectedPool && dropOnTier(event, tier.id)} className={cx("relative flex min-h-[230px] flex-col overflow-hidden rounded-[1.1rem] border p-3 backdrop-blur-2xl", championTierColumnFrame(tier))}>
                        <div className={cx("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", championTierColumnGlow(tier))} />
                        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                        <div className="relative z-10 mb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <ChampionTierMark tier={tier} />
                              <h3 className="truncate text-lg font-black text-white">{tier.title}</h3>
                            </div>
                            <Badge tone={tier.tone}>{items.length}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-300">{tier.hint}</p>
                        </div>
                        <div className="relative z-10 grid max-h-[210px] flex-1 content-start gap-2 overflow-auto pr-1 sm:grid-cols-2">
                          {items.length ? items.map((row) => <ChampionTierCard key={row.id} row={row} canManage={canManageSelectedPool} saving={saving} onDragStart={onDragStart} onDelete={deletePick} />) : <div className="col-span-full flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-white/10 p-4 text-center text-xs font-semibold leading-5 text-slate-300">{canManageSelectedPool ? "Glisse un champion ici." : "Lecture seule."}</div>}
                        </div>
                      </div>
                    </Surface>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <Surface glow><EmptyState icon={Users} title="Aucun joueur" text="Ajoute le roster avant de construire les Champion Pools." /></Surface>
      )}
    </div>
  );
}

function emptyCompositionSlots(players = []) {
  return Object.fromEntries(COMP_ROLES.map((role) => {
    const player = players.find((item) => item.role === role);
    return [role, { playerId: player?.id || "", poolId: "" }];
  }));
}

function compositionSlots(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

function jsonList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

function availabilitySlots(value) {
  const input = availabilityPayload(value);
  return Object.fromEntries(PLANNING_DAYS.map(([day]) => [day, Array.isArray(input[day]) ? input[day] : []]));
}

function availabilityPayload(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === "object" ? value : {};
}

function planningEventKey(day, time) {
  return `${day}|${time}`;
}

function planningEventTypeFromLabel(label) {
  const value = String(label || "").toLowerCase();
  if (/\b(match|official|officiel|ligue|cup|bo[1235])\b/.test(value)) return "match";
  if (/\b(review|vod|debrief|débrief|analyse)\b/.test(value)) return "review";
  if (/\b(scrim|scrims|pracc|train|training)\b/.test(value)) return "scrim";
  return "custom";
}

function planningEventMeta(type) {
  return PLANNING_EVENT_TYPES.find((item) => item.id === type) || PLANNING_EVENT_TYPES[PLANNING_EVENT_TYPES.length - 1];
}

function availabilityEvents(value) {
  const input = availabilityPayload(value);
  const events = input._events || input.events || {};
  return events && typeof events === "object" && !Array.isArray(events) ? events : {};
}

function planningSlotsPayload(slots, events) {
  const output = Object.fromEntries(PLANNING_DAYS.map(([day]) => [day, Array.isArray(slots?.[day]) ? PLANNING_TIMES.filter((time) => slots[day].includes(time)) : []]));
  const cleanEvents = Object.fromEntries(Object.entries(events || {}).filter(([, event]) => String(event?.label || "").trim()).map(([key, event]) => [key, { label: String(event.label).trim(), type: event.type || planningEventTypeFromLabel(event.label) }]));
  return Object.keys(cleanEvents).length ? { ...output, _events: cleanEvents } : output;
}

function dateKey(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function mondayOfWeek(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function formatPlanningDate(date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatWeekRange(start) {
  return `${formatPlanningDate(start)} - ${formatPlanningDate(addDays(start, 6))}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function compositionMastery(slots, rows) {
  const picked = Object.values(compositionSlots(slots)).map((slot) => rows.find((row) => row.id === slot.poolId)).filter(Boolean);
  if (!picked.length) return { label: "À remplir", tone: "slate" };
  const weights = { lock: 100, pocket: 78, work: 52, danger: 24 };
  const score = Math.round(picked.reduce((sum, row) => sum + (weights[championPoolStatus(row)] || 45), 0) / picked.length);
  return score >= 82 ? { label: "Très maîtrisée", tone: "green" } : score >= 65 ? { label: "Jouable", tone: "yellow" } : score >= 42 ? { label: "À valider", tone: "cyan" } : { label: "Trop fragile", tone: "red" };
}

function compositionPickList(slots, rows) {
  return COMP_ROLES.map((role) => {
    const pick = rows.find((row) => row.id === compositionSlots(slots)[role]?.poolId);
    return pick ? { ...pick, role } : null;
  }).filter(Boolean);
}

function directCounterReasons(candidate, picks) {
  const candidateId = championAssetId(candidate);
  return picks.flatMap((pick) => {
    const direct = DIRECT_COUNTERS[championAssetId(pick.champion)] || [];
    return direct.map(championAssetId).includes(candidateId) ? [`Counter direct de ${championDisplayName(pick.champion)}`] : [];
  });
}

function tagCounterReasons(candidate, picks) {
  const candidateTags = championStyleTags(candidate);
  const reasons = [];
  for (const pick of picks) {
    for (const tag of championStyleTags(pick.champion)) {
      for (const [counterTag, points, reason] of COUNTER_TAG_RULES[tag] || []) {
        if (candidateTags.includes(counterTag)) reasons.push({ points, reason });
      }
    }
  }
  return reasons;
}

function compositionCounterRecommendations(slots, rows, limitPerRole = 3) {
  const picks = compositionPickList(slots, rows);
  const pickedIds = new Set(picks.map((pick) => championAssetId(pick.champion)));
  if (!picks.length) return [];
  return COMP_ROLES.map((role) => {
    const candidates = championOptions()
      .filter((champion) => championMatchesLane(champion, role))
      .filter((champion) => !pickedIds.has(championAssetId(champion)))
      .map((champion) => {
        const directReasons = directCounterReasons(champion, picks);
        const tagReasons = tagCounterReasons(champion, picks);
        const score = directReasons.length * 38 + tagReasons.reduce((sum, item) => sum + item.points, 0);
        const reasons = [...directReasons, ...tagReasons.sort((a, b) => b.points - a.points).map((item) => item.reason)];
        return { role, champion, score, reasons: [...new Set(reasons)].slice(0, 3) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)))
      .slice(0, limitPerRole);
    return { role, counters: candidates };
  });
}

function CompositionChampionTile({ row, active, onPick, onDragStart }) {
  const status = championPoolStatus(row);
  const tier = championTierByStatus(status);
  return <button type="button" draggable onDragStart={(event) => onDragStart(event, row)} onClick={() => onPick(row)} title={`${championDisplayName(row.champion)} · ${championPoolStatusLabel(status)}`} className={cx("group relative aspect-square min-w-0 rounded-[1.15rem] border p-1 text-left transition duration-200", active ? "border-cyan-200/75 bg-cyan-400/16 shadow-[0_0_28px_rgba(34,211,238,.22)]" : "border-white/10 bg-black/28 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:shadow-[0_0_22px_rgba(34,211,238,.12)]")}>
    <span className="relative block h-full w-full overflow-hidden rounded-[0.88rem] bg-black/45 ring-1 ring-white/10">
      <ChampionPortrait row={row} champion={row.champion} alt={row.champion} className="h-full w-full rounded-[inherit] object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/12 to-black/10" />
      <ChampionTierMark tier={tier} active className="absolute right-1.5 top-1.5 z-40 h-5 w-5 rounded-md border border-white/60 bg-black/82 shadow-[0_0_10px_rgba(255,255,255,.18)] backdrop-blur-sm transition group-hover:scale-105 [&_svg]:h-3 [&_svg]:w-3" />
      <span className="absolute inset-x-1.5 bottom-1.5 z-30 truncate text-center text-[0.62rem] font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]">{championDisplayName(row.champion)}</span>
    </span>
  </button>;
}

function CompositionSlot({ role, slot, players, rows, onChange }) {
  const rolePlayers = players.filter((player) => player.role === role);
  const player = players.find((item) => item.id === slot.playerId) || rolePlayers[0];
  const pick = rows.find((row) => row.id === slot.poolId);
  const status = pick ? championPoolStatus(pick) : "";
  function drop(event) {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/json") || "{}");
      const row = rows.find((item) => item.id === payload.poolId);
      if (row && String(payload.role || row.role || "").toUpperCase() === role) onChange(role, { playerId: row.player_id || player?.id || "", poolId: row.id });
    } catch {}
  }
  return <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/18 p-3">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><RoleIcon role={role} className="h-5 w-5" /><p className="text-sm font-black uppercase tracking-[0.16em] text-white">{roleLabel(role)}</p></div>
        <p className="mt-1 truncate text-xs font-bold text-cyan-100/75">{player?.name || "Profil manquant"}</p>
      </div>
      {pick ? <Badge tone={championPoolStatusTone(status)}>{championPoolStatusLabel(status)}</Badge> : <Badge tone="slate">À PICK</Badge>}
    </div>
    {rolePlayers.length > 1 && <div className="mt-3 flex flex-wrap gap-1.5">{rolePlayers.map((item) => <button key={item.id} type="button" onClick={() => onChange(role, { playerId: item.id, poolId: "" })} className={cx("rounded-xl border px-2.5 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] transition", item.id === player?.id ? "border-cyan-200/45 bg-cyan-400/12 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-300 hover:text-white")}>{item.name}</button>)}</div>}
    <div onDragOver={(event) => event.preventDefault()} onDrop={drop} className={cx("relative mt-3 min-h-[168px] overflow-hidden rounded-xl border border-dashed p-3 transition", pick ? "border-cyan-200/28 bg-cyan-400/[0.055]" : "border-white/12 bg-white/[0.025] group-hover:border-cyan-300/22")}>
      {pick && <><ChampionBackdrop champion={pick.champion} /><div className="absolute inset-0 bg-gradient-to-t from-[#050711] via-[#050711]/72 to-transparent" /></>}
      <div className={cx("relative z-10 flex h-full min-h-[144px] flex-col", pick ? "justify-end" : "justify-center")}>
        {pick ? <div className="relative rounded-xl border border-white/10 bg-black/30 p-3 pr-10"><ChampionTierMark tier={championTierByStatus(status)} active className="absolute right-2 top-2 h-6 w-6 rounded-lg ring-1 ring-black/45 [&_svg]:h-3.5 [&_svg]:w-3.5" /><div className="flex items-end gap-3"><span className="inline-flex h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35"><ChampionPortrait row={pick} champion={pick.champion} alt={pick.champion} className="h-full w-full object-cover" /></span><div className="min-w-0"><p className="truncate text-xl font-black text-white">{championDisplayName(pick.champion)}</p><p className="mt-1 truncate text-xs font-bold text-slate-200">{compositionIdentity([pick]).tags.slice(0, 3).map(([tag]) => tagLabel(tag)).join(" · ") || "Standard"}</p></div></div><button type="button" onClick={() => onChange(role, { playerId: player?.id || "", poolId: "" })} className="mt-3 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-200 transition hover:border-rose-300/30 hover:text-rose-100">Vider</button></div> : <div className="flex h-full flex-col items-center justify-center text-center"><Sparkles className="h-5 w-5 text-cyan-100/70" /><p className="mt-3 text-sm font-black text-white">Glisse un champion ici</p><p className="mt-1 text-xs font-semibold text-slate-300">Pool {player?.name || role}</p></div>}
      </div>
    </div>
  </div>;
}

function CompositionChampionBank({ players, rows, slots, onPick }) {
  const tierOrder = { lock: 0, pocket: 1, work: 2, danger: 3 };
  function dragStart(event, row, role) {
    event.dataTransfer.setData("application/json", JSON.stringify({ role, playerId: row.player_id || "", poolId: row.id }));
    event.dataTransfer.effectAllowed = "copy";
  }
  return <div className="mt-4 rounded-xl border border-white/10 bg-black/18 p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/80">Banque de champions</p><p className="mt-1 text-sm font-semibold text-slate-300">Glisse une icône vers le cadre de compo correspondant.</p></div>
      <div className="flex flex-wrap gap-2">
        {CHAMPION_TIERS.map((tier) => <span key={tier.id} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/24 px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.14em] text-white">
          <ChampionTierMark tier={tier} active className="h-7 w-7 rounded-xl border-white/18 bg-black/20 [&_svg]:h-4 [&_svg]:w-4" />
          {tier.title}
        </span>)}
      </div>
    </div>
    <div className="mt-4 grid gap-3 xl:grid-cols-2 2xl:grid-cols-5">
      {COMP_ROLES.map((role) => {
        const slot = slots[role] || {};
        const player = players.find((item) => item.id === slot.playerId) || players.find((item) => item.role === role);
        const pool = rows
          .filter((row) => (String(row.player_id || "") === String(player?.id || "") || row.player_name === player?.name) && String(row.role || role).toUpperCase() === role)
          .sort((a, b) => {
            const tierDiff = (tierOrder[championPoolStatus(a)] ?? 9) - (tierOrder[championPoolStatus(b)] ?? 9);
            if (tierDiff) return tierDiff;
            return championDisplayName(a.champion).localeCompare(championDisplayName(b.champion));
          });
        return <div key={role} className="min-w-0 rounded-xl border border-white/10 bg-black/18 p-3">
          <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white"><RoleIcon role={role} className="h-5 w-5" />{role}</span><span className="truncate text-[0.66rem] font-bold text-cyan-100/80">{player?.name || "Profil manquant"}</span></div>
          <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5 xl:grid-cols-4 2xl:grid-cols-5">{pool.length ? pool.map((row) => <CompositionChampionTile key={row.id} row={row} active={row.id === slot.poolId} onPick={() => onPick(role, { playerId: row.player_id || player?.id || "", poolId: row.id })} onDragStart={(event) => dragStart(event, row, role)} />) : <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-center text-xs font-semibold text-slate-300">Aucun champion.</div>}</div>
        </div>;
      })}
    </div>
  </div>;
}

function CompositionCounterPanel({ slots, rows, compact = false }) {
  const groups = compositionCounterRecommendations(slots, rows, compact ? 1 : 3).filter((group) => group.counters.length);
  if (!groups.length) return <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/18 p-3 text-sm font-semibold text-slate-300">Ajoute des champions dans la compo pour afficher les counters probables par rôle.</div>;
  const allCounters = groups.flatMap((group) => group.counters.map((counter) => ({ ...counter, role: group.role }))).sort((a, b) => b.score - a.score);
  if (compact) return <div className="mt-4 rounded-xl border border-rose-300/14 bg-rose-500/[0.045] p-3">
    <div className="mb-3 flex items-center justify-between gap-2"><Badge tone="red">Counters à prévoir</Badge></div>
    <div className="flex flex-wrap gap-2">{allCounters.slice(0, 5).map((counter) => <div key={`${counter.role}-${counter.champion}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/24 py-1.5 pl-1.5 pr-3"><ChampionPortrait champion={counter.champion} alt={counter.champion} className="h-8 w-8 rounded-lg object-cover" /><span className="text-xs font-black text-white">{counter.role} · {championDisplayName(counter.champion)}</span></div>)}</div>
  </div>;
  return <div className="mt-4 rounded-xl border border-rose-300/14 bg-black/18 p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><Badge tone="red">Counter system</Badge><h3 className="mt-3 text-xl font-black text-white">Counters probables à anticiper</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-300">Lecture inspirée matchup/tag : les picks ci-dessous sont ceux qui peuvent rendre cette compo pénible à jouer.</p></div>
    </div>
    <div className="mt-4 grid gap-3 xl:grid-cols-5">
      {groups.map((group) => <div key={group.role} className="min-w-0 rounded-2xl border border-white/10 bg-black/24 p-3">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white"><RoleIcon role={group.role} className="h-5 w-5" />{group.role}</span><Badge tone="red">{group.counters.length}</Badge></div>
        <div className="space-y-2">{group.counters.map((counter) => <div key={counter.champion} className="rounded-xl border border-white/10 bg-white/[0.035] p-2">
          <div className="flex min-w-0 items-center gap-2"><ChampionPortrait champion={counter.champion} alt={counter.champion} className="h-10 w-10 shrink-0 rounded-xl border border-white/10 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{championDisplayName(counter.champion)}</p><p className="truncate text-[0.62rem] font-bold text-rose-100">Counter probable</p></div></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{counter.reasons.map((reason) => <span key={reason} className="rounded-lg border border-rose-200/12 bg-rose-500/10 px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.08em] text-rose-50">{String(reason).toUpperCase()}</span>)}</div>
        </div>)}</div>
      </div>)}
    </div>
  </div>;
}

function CompositionCard({ composition, rows, canManage, saving, onEdit, onDuplicate, onDelete }) {
  const slots = compositionSlots(composition.slots);
  const tags = jsonList(composition.tags);
  const mastery = compositionMastery(slots, rows);
  const slotPicks = COMP_ROLES.map((role) => ({ role, pick: rows.find((row) => row.id === slots[role]?.poolId) }));
  const picks = slotPicks.map((slot) => slot.pick).filter(Boolean);
  const identity = compositionIdentity(picks);
  return <Surface className="group relative overflow-hidden p-0 transition duration-200 hover:border-cyan-300/28">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/55 via-white/30 to-fuchsia-200/35" />
    <div className="relative z-10 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={mastery.tone}>{mastery.label}</Badge><Badge tone="cyan">{picks.length}/5 picks</Badge>{tags.map((tag) => <Badge key={tag} tone="purple">{tagLabel(tag)}</Badge>)}</div>
          <h3 className="mt-3 truncate text-2xl font-black text-white">{composition.title}</h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/72">Créée par {composition.created_by_name || "un membre"}</p>
          {composition.notes && <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-200">{composition.notes}</p>}
        </div>
        {canManage && <div className="flex shrink-0 gap-1 rounded-xl border border-white/10 bg-black/24 p-1">
          <button type="button" onClick={() => onEdit(composition)} disabled={saving} title="Modifier" className="rounded-xl p-2 text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-100"><Clipboard className="h-4 w-4" /></button>
          <button type="button" onClick={() => onDuplicate(composition)} disabled={saving} title="Dupliquer" className="rounded-xl p-2 text-slate-300 transition hover:bg-violet-400/10 hover:text-violet-100"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => onDelete(composition.id)} disabled={saving} title="Supprimer" className="rounded-xl p-2 text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button>
        </div>}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/24">
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
          {slotPicks.map(({ role, pick }) => {
            const pickStatus = pick ? championPoolStatus(pick) : "";
            const tier = pick ? championTierByStatus(pickStatus) : null;
            return <div key={role} className={cx("relative min-h-[140px] overflow-hidden bg-[#07101f] p-3", pick ? "text-white" : "text-slate-400")}>
              {pick && <ChampionBackdrop champion={pick.champion} />}
              <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-[#06101f]/74 to-[#050814]" />
              <div className="relative z-10 flex h-full min-h-[116px] flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[0.66rem] font-black uppercase tracking-[0.14em]"><RoleIcon role={role} className="h-4 w-4 text-cyan-100" />{role}</span>
                  {tier && <ChampionTierMark tier={tier} active className="h-8 w-8 rounded-xl ring-1 ring-black/45 [&_svg]:h-4 [&_svg]:w-4" />}
                </div>
                {pick ? <div className="mt-5">
                  <div className="flex items-end gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/45"><ChampionPortrait row={pick} champion={pick.champion} alt={pick.champion} className="h-full w-full object-cover" /></span>
                    <div className="min-w-0 pb-1">
                      <p className="truncate text-lg font-black text-white">{championDisplayName(pick.champion)}</p>
                      <p className="truncate text-xs font-bold text-slate-200">{pick.player_name || "Joueur"}</p>
                    </div>
                  </div>
                  <p className="mt-3 truncate rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-cyan-100">{championPoolStatusLabel(pickStatus)}</p>
                </div> : <div className="flex flex-1 items-center justify-center text-sm font-black uppercase tracking-[0.16em] text-slate-500">Slot vide</div>}
              </div>
            </div>;
          })}
        </div>
      </div>
      {(identity.tags.length > 0 || picks.length > 0) && <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={championStyleTone(identity.primary)}>{tagLabel(identity.primary)}</Badge>
        {identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>)}
      </div>}
      <CompositionCounterPanel slots={slots} rows={rows} compact />
    </div>
  </Surface>;
}

function CompositionTagLexicon({ open }) {
  if (!open) return null;
  return <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="mt-4 overflow-hidden rounded-[1.35rem] border border-cyan-200/16 bg-[#050914]/82 p-4 shadow-[0_0_34px_rgba(34,211,238,.08)] backdrop-blur-xl">
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><Badge tone="cyan">Sommaire</Badge><h3 className="mt-3 text-xl font-black text-white">Lexique des tags champions</h3><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-200">Ces tags décrivent l'identité d'un champion dans une Compo Type. Ils servent à lire rapidement le plan de draft, pas à juger automatiquement la compo.</p></div><div className="hidden rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100 md:block">NXT5 Draft</div></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{CHAMPION_TAG_DEFINITIONS.map(([tag, definition]) => <div key={tag} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center justify-between gap-2"><Badge tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge></div><p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{definition}</p></div>)}</div>
    <div className="mt-4 rounded-2xl border border-violet-300/14 bg-violet-400/[0.055] p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100">Tags de classement</p><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{COMPOSITION_TAG_DEFINITIONS.map(([tag, definition]) => <div key={tag} className="rounded-xl border border-white/10 bg-black/20 p-3"><Badge tone="purple">{tagLabel(tag)}</Badge><p className="mt-2 text-xs font-semibold leading-5 text-slate-200">{definition}</p></div>)}</div></div>
  </motion.div>;
}

function ChampionPoolColorSummary() {
  return <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 shadow-[0_0_18px_rgba(34,211,238,.05)]">
    <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-300">Couleurs pool</span>
    {CHAMPION_TIERS.map((tier) => <span key={tier.id} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] py-1 pl-1 pr-2.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-100"><ChampionTierMark tier={tier} className="h-6 w-6 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5" />{tier.title}</span>)}
  </div>;
}

function CompositionSummaryStrip({ players, rows, compositions, formPicks }) {
  const locked = rows.filter((row) => ["lock", "pocket"].includes(championPoolStatus(row))).length;
  const items = [
    ["Roster", `${players.length}/5`, "Profils lanes"],
    ["Pool draft", rows.length, `${locked} prêts`],
    ["Compos", compositions.length, "Enregistrées"],
    ["Builder", `${formPicks.length}/5`, "Picks actifs"],
  ];
  return <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{items.map(([label, value, detail]) => <div key={label} className="rounded-xl border border-white/10 bg-black/18 px-3 py-2.5"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><div className="mt-1 flex items-end justify-between gap-3"><span className="text-xl font-black text-white">{value}</span><span className="truncate text-xs font-semibold text-cyan-100/75">{detail}</span></div></div>)}</div>;
}

function Compositions({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const isStaff = canStaffManage(currentMember?.role);
  const canCreate = Boolean(currentMember);
  const players = (data.players || []).filter((player) => player.team_id === selectedTeamId && COMP_ROLES.includes(player.role));
  const rows = (data.championPool || []).filter((row) => row.team_id === selectedTeamId && ["manual", "riot_manual"].includes(String(row.source || "")));
  const compositions = (data.compositions || []).filter((item) => item.team_id === selectedTeamId);
  const [form, setForm] = useState({ id: null, title: "", notes: "", tags: [], slots: emptyCompositionSlots(players) });
  const [saving, setSaving] = useState(false);
  const [sideFilter, setSideFilter] = useState("all");
  const [showTagLexicon, setShowTagLexicon] = useState(false);
  const tagOptions = ["blue side", "red side"];

  useEffect(() => {
    setForm((current) => ({ ...current, slots: { ...emptyCompositionSlots(players), ...(current.slots || {}) } }));
  }, [players.map((player) => player.id).join("|")]);

  function updateSlot(role, slot) {
    setForm((current) => ({ ...current, slots: { ...current.slots, [role]: slot } }));
  }

  function toggleCompTag(tag) {
    setForm((current) => ({ ...current, tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag] }));
  }

  function resetCompositionForm() {
    setForm({ id: null, title: "", notes: "", tags: [], slots: emptyCompositionSlots(players) });
  }

  function editComposition(composition) {
    setForm({ id: composition.id, title: composition.title || "", notes: composition.notes || "", tags: jsonList(composition.tags), slots: { ...emptyCompositionSlots(players), ...compositionSlots(composition.slots) } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicateComposition(composition) {
    setForm({ id: null, title: `${composition.title || "Compo"} copie`, notes: composition.notes || "", tags: jsonList(composition.tags), slots: { ...emptyCompositionSlots(players), ...compositionSlots(composition.slots) } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveComposition(event) {
    event.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    try {
      await apiFetch("composition-types-manage", { method: "POST", body: JSON.stringify({ action: form.id ? "update" : "create", teamId: selectedTeamId, compositionId: form.id, title: form.title, notes: form.notes, tags: form.tags, slots: form.slots }) });
      resetCompositionForm();
      await refreshAll();
      pushToast({ type: "green", title: form.id ? "Compo mise à jour" : "Compo créée", text: "La Compo Type est disponible pour la team." });
    } catch (err) {
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteComposition(compositionId) {
    const composition = compositions.find((item) => item.id === compositionId);
    const canManageComposition = isStaff || composition?.created_by === user?.id;
    if (!canManageComposition || !window.confirm("Supprimer cette Compo Type ?")) return;
    setSaving(true);
    try {
      await apiFetch("composition-types-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, compositionId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Compo supprimée", text: "La liste est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const mastery = compositionMastery(form.slots, rows);
  const filteredCompositions = compositions.filter((composition) => sideFilter === "all" || jsonList(composition.tags).includes(sideFilter));
  const sideOptions = [
    { id: "all", label: "Toutes" },
    { id: "blue side", label: "Blue Side" },
    { id: "red side", label: "Red Side" },
  ];
  const formPicks = COMP_ROLES.map((role) => rows.find((row) => row.id === form.slots?.[role]?.poolId)).filter(Boolean);
  const formIdentity = compositionIdentity(formPicks);
  return (
    <div className="nxt5-data-dense min-w-0 overflow-hidden">
      <PageHeader eyebrow="Draft Room" title="Compos Types" subtitle="Construis des Compos a partir des Champion Pools reels, avec une lecture immediate des categories poste par poste.">
        <button type="button" onClick={() => setShowTagLexicon((open) => !open)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-400/16">
          <BookOpen className="h-4 w-4" />
          Tags
          <ChevronDown className={cx("h-4 w-4 transition", showTagLexicon && "rotate-180")} />
        </button>
        <ChampionPoolColorSummary />
      </PageHeader>

      <CompositionSummaryStrip players={players} rows={rows} compositions={compositions} formPicks={formPicks} />

      <AnimatePresence initial={false}>
        <CompositionTagLexicon open={showTagLexicon} />
      </AnimatePresence>

      {players.length ? (
        <form onSubmit={saveComposition} className="mt-4">
          <Surface glow className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="cyan">Builder 5 lanes</Badge>
                  <Badge tone={mastery.tone}>{mastery.label}</Badge>
                </div>
                <h3 className="mt-3 text-2xl font-black text-white md:text-3xl">{form.id ? "Modifier la Compo" : "Nouvelle Compo"}</h3>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Choisis les champions directement dans le pool de chaque poste. Drag & drop ou clic, la categorie se met a jour instantanement.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {form.id && <Button type="button" variant="ghost" icon={X} onClick={resetCompositionForm}>Annuler</Button>}
                <Button type="submit" icon={saving ? Loader2 : form.id ? Check : Plus} disabled={!canCreate || saving || !form.title.trim()}>{form.id ? "Enregistrer" : "Creer"}</Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,.32fr)] xl:items-start">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <TextInput label="Nom de la Compo" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} placeholder="Ex: Engage Dragon, Front-to-Back Jinx..." required icon={Sparkles} />
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((tag) => <button key={tag} type="button" onClick={() => toggleCompTag(tag)} className={cx("rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition", form.tags.includes(tag) ? "border-violet-300/35 bg-violet-400/10 text-violet-100" : "border-white/10 bg-white/[0.035] text-slate-300 hover:text-white")}>{tagLabel(tag)}</button>)}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">Resume</span>
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Plan de jeu, conditions de draft..." rows={3} className="nxt5-input-shell w-full resize-none rounded-xl border border-cyan-100/14 bg-[#030712]/70 px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/65 focus:ring-4 focus:ring-cyan-300/12" />
              </label>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2 2xl:grid-cols-5">
              {COMP_ROLES.map((role) => <CompositionSlot key={role} role={role} slot={form.slots[role] || {}} players={players} rows={rows} onChange={updateSlot} />)}
            </div>

            {formPicks.length > 0 && <div className="nxt5-flat-block mt-4 rounded-xl border p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Badge tone={championStyleTone(formIdentity.primary)}>Identite en cours</Badge>
                  <h4 className="mt-2 text-xl font-black text-white">{tagLabel(formIdentity.primary)}</h4>
                  <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-200">{formIdentity.text}</p>
                </div>
                <Badge tone="cyan">{formPicks.length}/5 picks</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{formIdentity.tags.length ? formIdentity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Standard</Badge>}</div>
            </div>}

            <CompositionCounterPanel slots={form.slots} rows={rows} />
            <CompositionChampionBank players={players} rows={rows} slots={form.slots} onPick={updateSlot} />
          </Surface>
        </form>
      ) : <EmptyState icon={Users} title="Roster incomplet" text="Ajoute les joueurs TOP, JGL, MID, ADC et SUP pour creer des Compos Types." />}

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-300">Compos enregistrees</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">{filteredCompositions.length} / {compositions.length} visibles</p>
        </div>
        <div className="flex w-full rounded-xl border border-white/10 bg-black/20 p-1 md:w-auto">
          {sideOptions.map((option) => <button key={option.id} type="button" onClick={() => setSideFilter(option.id)} className={cx("flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition md:flex-none", sideFilter === option.id ? "bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.24)]" : "text-slate-300 hover:bg-white/[0.05] hover:text-white")}>{option.label}</button>)}
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        {filteredCompositions.length ? filteredCompositions.map((composition) => <CompositionCard key={composition.id} composition={composition} rows={rows} canManage={isStaff || composition.created_by === user?.id} saving={saving} onEdit={editComposition} onDuplicate={duplicateComposition} onDelete={deleteComposition} />) : compositions.length ? <EmptyState icon={Sparkles} title="Aucune Compo pour ce side" text="Change le filtre ou ajoute le tag Blue Side / Red Side sur une Compo." /> : <EmptyState icon={Sparkles} title="Aucune Compo Type" text="Cree une premiere Compo a partir des Champion Pools de tes joueurs." />}
      </div>
    </div>
  );
}

function Planning({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const gameplayPlayers = useMemo(() => sortPlayersByRole((data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role))), [data.players, selectedTeamId]);
  const staffProfiles = useMemo(() => (data.players || []).filter((player) => player.team_id === selectedTeamId && isStaffRole(player.role)).sort((a, b) => String(roleLabel(a.role)).localeCompare(String(roleLabel(b.role))) || String(a.name || "").localeCompare(String(b.name || ""))), [data.players, selectedTeamId]);
  const players = useMemo(() => [...gameplayPlayers, ...staffProfiles], [gameplayPlayers, staffProfiles]);
  const planningUnitTotal = gameplayPlayers.length + (staffProfiles.length ? 1 : 0);
  const baseWeekStart = useMemo(() => mondayOfWeek(), []);
  const weekOptions = useMemo(() => [
    { id: "current", label: "Semaine en cours", start: dateKey(baseWeekStart), range: formatWeekRange(baseWeekStart) },
    { id: "next", label: "Semaine d’après", start: dateKey(addDays(baseWeekStart, 7)), range: formatWeekRange(addDays(baseWeekStart, 7)) },
  ], [baseWeekStart]);
  const [selectedWeekStart, setSelectedWeekStart] = useState(weekOptions[0].start);
  const selectedWeek = useMemo(() => weekOptions.find((week) => week.start === selectedWeekStart) || weekOptions[0], [selectedWeekStart, weekOptions]);
  const weekStartDate = useMemo(() => dateFromKey(selectedWeek.start), [selectedWeek.start]);
  const weekDays = useMemo(() => PLANNING_DAYS.map(([day, label], index) => [day, label, addDays(weekStartDate, index)]), [weekStartDate]);
  const availability = useMemo(() => (data.availability || []).filter((item) => {
    const itemWeek = item.week_start ? String(item.week_start).slice(0, 10) : weekOptions[0].start;
    return item.team_id === selectedTeamId && itemWeek === selectedWeek.start;
  }), [data.availability, selectedTeamId, selectedWeek.start, weekOptions]);
  const playersKey = players.map((player) => `${player.id}:${player.role}:${player.name || ""}:${player.user_id || ""}`).join("|");
  const gameplayPlayersKey = gameplayPlayers.map((player) => `${player.id}:${player.role}:${player.name || ""}:${player.user_id || ""}`).join("|");
  const staffProfilesKey = staffProfiles.map((player) => `${player.id}:${player.role}:${player.name || ""}:${player.user_id || ""}`).join("|");
  const staffProfileIdSet = useMemo(() => new Set(staffProfiles.map((player) => String(player.id))), [staffProfilesKey]);
  const availabilityKey = availability.map((row) => `${row.id}:${row.player_id}:${row.updated_at || ""}`).join("|");
  const planningLookup = useMemo(() => {
    const slotsByPlayer = new Map();
    const playerIdsByCell = new Map();
    const events = {};
    for (const row of availability) {
      const playerId = String(row.player_id || "");
      const slots = availabilitySlots(row?.slots);
      slotsByPlayer.set(playerId, slots);
      for (const [day, times] of Object.entries(slots)) {
        for (const time of times || []) {
          const key = planningEventKey(day, time);
          const list = playerIdsByCell.get(key) || [];
          list.push(playerId);
          playerIdsByCell.set(key, list);
        }
      }
      for (const [key, event] of Object.entries(availabilityEvents(row?.slots))) {
        if (event?.label && !events[key]) events[key] = { ...event, playerId: row.player_id };
      }
    }
    return { slotsByPlayer, playerIdsByCell, events };
  }, [availabilityKey, playersKey]);
  const linkedGameplayPlayer = gameplayPlayers.find((player) => player.user_id && String(player.user_id) === String(user?.id || ""));
  const linkedStaffProfile = staffProfiles.find((player) => player.user_id && String(player.user_id) === String(user?.id || ""));
  const staffPlanningPlayer = linkedStaffProfile || staffProfiles.find((player) => String(player.role || "").toUpperCase() === "COACH") || staffProfiles[0] || null;
  const staffPlanningPlayerId = String(staffPlanningPlayer?.id || "");
  const canManagePlanningStaff = canStaffManage(currentMember?.role);
  const linkedPlayer = linkedGameplayPlayer || (staffPlanningPlayer && canManagePlanningStaff ? staffPlanningPlayer : linkedStaffProfile) || (currentMember ? { teamOnly: true } : null);
  const [draftSlots, setDraftSlots] = useState({});
  const [slotEvents, setSlotEvents] = useState({});
  const [eventMenu, setEventMenu] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [planningDirty, setPlanningDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const changeSeqRef = useRef(0);

  const selectedPlayer = linkedPlayer?.teamOnly ? null : linkedPlayer || null;
  const selectedIsStaff = selectedPlayer ? isStaffRole(selectedPlayer.role) : false;
  const selectedDisplayName = selectedIsStaff ? "Coaching Staff" : selectedPlayer?.name || "Profil non lié";
  const selectedDisplayRole = selectedIsStaff ? "Coaching Staff" : selectedPlayer ? roleLabel(selectedPlayer.role) : "Aucun profil";
  const staffPlanningAvailabilityExists = Boolean(staffPlanningPlayerId && availability.some((item) => String(item.player_id || "") === staffPlanningPlayerId));
  const selectedAvailability = availability.find((item) => item.player_id === selectedPlayer?.id) || null;
  const eventStoreRow = availability.find((item) => Object.keys(availabilityEvents(item?.slots)).length);
  const eventStorePlayer = selectedPlayer || players.find((player) => player.id === eventStoreRow?.player_id) || gameplayPlayers[0] || staffProfiles[0] || null;
  const eventStoreAvailability = availability.find((item) => item.player_id === eventStorePlayer?.id) || null;
  const canEditSelected = Boolean(selectedPlayer && (String(selectedPlayer.user_id || "") === String(user?.id || "") || (selectedIsStaff && canManagePlanningStaff)));
  const canEditEvents = Boolean(currentMember && eventStorePlayer);

  useEffect(() => {
    setDraftSlots(availabilitySlots(selectedAvailability?.slots));
    setEventMenu(null);
    setNotes(selectedAvailability?.notes || "");
    setPlanningDirty(false);
    setSaveStatus("idle");
  }, [selectedAvailability?.id, selectedAvailability?.updated_at, selectedPlayer?.id, selectedWeek.start]);

  useEffect(() => {
    setSlotEvents(availabilityEvents(eventStoreAvailability?.slots));
    setEventMenu(null);
  }, [eventStoreAvailability?.id, eventStoreAvailability?.updated_at, eventStorePlayer?.id, selectedWeek.start]);

  useEffect(() => {
    if (!planningDirty || saving) return undefined;
    const timer = window.setTimeout(() => {
      saveAvailability({ silent: true });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [planningDirty, saving, draftSlots, slotEvents, notes, eventStorePlayer?.id, selectedTeamId, selectedWeek.start, canEditSelected, canEditEvents]);

  function markPlanningDirty() {
    changeSeqRef.current += 1;
    setPlanningDirty(true);
    setSaveStatus("dirty");
  }

  useEffect(() => {
    if (!eventMenu) return undefined;
    function closeMenu() {
      setEventMenu(null);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setEventMenu(null);
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [eventMenu]);

  function slotList(playerId, day) {
    return planningLookup.slotsByPlayer.get(String(playerId || ""))?.[day] || [];
  }

  function toggleSlot(day, time) {
    if (!canEditSelected) return;
    markPlanningDirty();
    setDraftSlots((current) => {
      const list = Array.isArray(current[day]) ? current[day] : [];
      const nextList = list.includes(time) ? list.filter((item) => item !== time) : PLANNING_TIMES.filter((item) => [...list, time].includes(item));
      return { ...current, [day]: nextList };
    });
    if ((draftSlots[day] || []).includes(time)) {
      setSlotEvents((current) => {
        const next = { ...current };
        delete next[planningEventKey(day, time)];
        return next;
      });
    }
  }

  function setDaySlots(day, times) {
    if (!canEditSelected) return;
    markPlanningDirty();
    const nextTimes = PLANNING_TIMES.filter((time) => times.includes(time));
    setDraftSlots((current) => ({ ...current, [day]: nextTimes }));
    setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
      const [eventDay, eventTime] = key.split("|");
      return eventDay !== day || nextTimes.includes(eventTime);
    })));
  }

  function setTimeForWeek(time) {
    if (!canEditSelected) return;
    markPlanningDirty();
    const allActive = weekDays.every(([day]) => (draftSlots[day] || []).includes(time));
    setDraftSlots((current) => {
      return Object.fromEntries(weekDays.map(([day]) => {
        const list = Array.isArray(current[day]) ? current[day] : [];
        const nextList = allActive ? list.filter((item) => item !== time) : PLANNING_TIMES.filter((item) => [...list, time].includes(item));
        return [day, nextList];
      }));
    });
    if (allActive) {
      setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key.split("|")[1] !== time)));
    }
  }

  function applyAvailabilityPreset(kind) {
    if (!canEditSelected) return;
    markPlanningDirty();
    const presets = {
      evenings: ["20:00", "21:00", "22:00", "23:00"],
      scrim: ["19:00", "20:00", "21:00", "22:00"],
      weekend: [],
    };
    if (kind === "clear") {
      setDraftSlots({});
      setSlotEvents({});
      return;
    }
    if (kind === "weekend") {
      const nextSlots = Object.fromEntries(weekDays.map(([day]) => [day, ["20:00", "21:00", "22:00", "23:00"].filter(() => ["SAT", "SUN"].includes(day))]));
      setDraftSlots(nextSlots);
      setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
        const [day, time] = key.split("|");
        return (nextSlots[day] || []).includes(time);
      })));
      return;
    }
    const times = presets[kind] || [];
    const nextSlots = Object.fromEntries(weekDays.map(([day]) => [day, PLANNING_TIMES.filter((time) => times.includes(time))]));
    setDraftSlots(nextSlots);
    setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
      const [day, time] = key.split("|");
      return (nextSlots[day] || []).includes(time);
    })));
  }

  function openPlanningEventMenu(event, day, time) {
    event.preventDefault();
    if (!canEditEvents) return;
    setEventMenu({
      day,
      time,
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 260),
    });
  }

  function applyPlanningEventType(type) {
    if (!eventMenu || !canEditEvents) return;
    markPlanningDirty();
    const { day, time } = eventMenu;
    const key = planningEventKey(day, time);
    const meta = planningEventMeta(type);
    setSlotEvents((currentEvents) => {
      const next = { ...currentEvents };
      next[key] = { label: meta.label, type };
      return next;
    });
    setEventMenu(null);
  }

  function removePlanningEvent() {
    if (!eventMenu || !canEditEvents) return;
    markPlanningDirty();
    const key = planningEventKey(eventMenu.day, eventMenu.time);
    setSlotEvents((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setEventMenu(null);
  }

  function teamEventFor(day, time) {
    const key = planningEventKey(day, time);
    return availability.map((row) => {
      const event = availabilityEvents(row?.slots)[key];
      return event?.label ? { ...event, playerId: row.player_id } : null;
    }).find(Boolean) || null;
  }

  async function saveAvailability({ silent = false } = {}) {
    if (!eventStorePlayer || !selectedTeamId || (!canEditSelected && !canEditEvents)) return;
    const changeVersion = changeSeqRef.current;
    const baseSlots = canEditSelected ? draftSlots : availabilitySlots(eventStoreAvailability?.slots);
    const baseNotes = canEditSelected ? notes : eventStoreAvailability?.notes || "";
    setSaving(true);
    setSaveStatus("saving");
    try {
      await apiFetch("player-availability-manage", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, playerId: eventStorePlayer.id, weekStart: selectedWeek.start, slots: planningSlotsPayload(baseSlots, slotEvents), notes: baseNotes }) });
      if (changeSeqRef.current === changeVersion) {
        setPlanningDirty(false);
        setSaveStatus("saved");
      }
      if (!silent) {
        await refreshAll();
        pushToast({ type: "green", title: "Planning mis a jour", text: "Planning enregistre." });
      }
    } catch (err) {
      setSaveStatus("error");
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const selectedPlayerId = String(selectedPlayer?.id || "");
  const effectivePlayerIdsByCell = useMemo(() => {
    const map = new Map();
    for (const [day] of weekDays) {
      for (const time of PLANNING_TIMES) {
        const key = planningEventKey(day, time);
        const baseIds = planningLookup.playerIdsByCell.get(key) || [];
        const hasStaffBase = staffPlanningAvailabilityExists && baseIds.some((id) => String(id) === staffPlanningPlayerId);
        const ids = new Set(baseIds.filter((id) => {
          const normalizedId = String(id);
          if (selectedPlayerId && normalizedId === selectedPlayerId) return false;
          return !staffProfileIdSet.has(normalizedId);
        }));
        if (!selectedIsStaff && hasStaffBase && staffPlanningPlayerId) ids.add(staffPlanningPlayerId);
        if (selectedPlayerId && (draftSlots[day] || []).includes(time)) ids.add(selectedIsStaff && staffPlanningPlayerId ? staffPlanningPlayerId : selectedPlayerId);
        map.set(key, Array.from(ids));
      }
    }
    return map;
  }, [draftSlots, planningLookup, selectedIsStaff, selectedPlayerId, staffPlanningAvailabilityExists, staffPlanningPlayerId, staffProfileIdSet, weekDays]);
  const planningUnitCountForIds = (ids = []) => {
    const availableIds = new Set(ids.map((id) => String(id)));
    const playerCount = gameplayPlayers.filter((player) => availableIds.has(String(player.id))).length;
    const coachingStaffCount = staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId) ? 1 : 0;
    return playerCount + coachingStaffCount;
  };
  const bestCells = useMemo(() => weekDays.flatMap(([day]) => PLANNING_TIMES.map((time, timeIndex) => ({
    day,
    time,
    timeIndex,
    count: planningUnitCountForIds(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []),
  }))).sort((a, b) => b.count - a.count || a.timeIndex - b.timeIndex).slice(0, 4), [effectivePlayerIdsByCell, gameplayPlayers, staffProfiles, weekDays]);
  const selectedFilledSlots = useMemo(() => weekDays.reduce((sum, [day]) => sum + (draftSlots[day] || []).length, 0), [draftSlots, weekDays]);
  const selectedFilledDays = useMemo(() => weekDays.filter(([day]) => (draftSlots[day] || []).length).length, [draftSlots, weekDays]);
  const teamEvents = planningLookup.events;
  const visibleSlotEvents = useMemo(() => ({ ...teamEvents, ...slotEvents }), [teamEvents, slotEvents]);
  const selectedEventCount = useMemo(() => Object.keys(visibleSlotEvents).length, [visibleSlotEvents]);
  const fullTeamSlots = useMemo(() => {
    const target = Math.min(5, gameplayPlayers.length);
    if (!target) return 0;
    return weekDays.reduce((total, [day]) => total + PLANNING_TIMES.reduce((sum, time) => {
      const availableIds = new Set(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []);
      const playerCount = gameplayPlayers.filter((player) => availableIds.has(String(player.id))).length;
      return sum + (playerCount >= target ? 1 : 0);
    }, 0), 0);
  }, [effectivePlayerIdsByCell, gameplayPlayers, weekDays]);
  const staffAvailableSlots = useMemo(() => weekDays.reduce((total, [day]) => total + PLANNING_TIMES.reduce((sum, time) => {
    const availableIds = new Set(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []);
    return sum + (staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId) ? 1 : 0);
  }, 0), 0), [effectivePlayerIdsByCell, staffPlanningPlayerId, weekDays]);
  const eventMenuCurrent = eventMenu ? slotEvents[planningEventKey(eventMenu.day, eventMenu.time)] : null;
  const eventMenuDay = eventMenu ? weekDays.find(([day]) => day === eventMenu.day) : null;
  const roleSlots = useMemo(() => COMP_ROLES.map((role) => ({ role, player: gameplayPlayers.find((player) => normalizeProfileRole(player.role) === role) })), [gameplayPlayersKey]);
  const selectedRole = selectedIsStaff ? "" : normalizeProfileRole(selectedPlayer?.role);
  const selectedRoleLabel = selectedPlayer ? `${selectedDisplayRole} · ${selectedDisplayName}` : "Aucun profil";
  const frameTone = (slotEvent) => {
    if (slotEvent) return planningEventMeta(slotEvent.type).cell;
    return "bg-[#050914] text-slate-500";
  };
  const saveStatusMeta = saveStatus === "saving"
    ? { tone: "yellow", label: "Sauvegarde..." }
    : saveStatus === "dirty"
      ? { tone: "cyan", label: "Modification locale" }
      : saveStatus === "error"
        ? { tone: "red", label: "Erreur sauvegarde" }
        : saveStatus === "saved"
          ? { tone: "green", label: "Synchronisé" }
          : { tone: "slate", label: "Sauvegarde auto" };
  const planningGridRows = useMemo(() => PLANNING_TIMES.map((time) => ({
    time,
    cells: weekDays.map(([day], dayIndex) => {
      const key = planningEventKey(day, time);
      const activeSlot = (draftSlots[day] || []).includes(time);
      const availableIds = new Set(effectivePlayerIdsByCell.get(key) || []);
      const staffLit = Boolean(staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId));
      const availableNames = [
        ...roleSlots.filter(({ player }) => player && availableIds.has(String(player.id))).map(({ role, player }) => `${roleLabel(role)} · ${player.name}`),
        staffLit ? "Coaching Staff" : null,
      ].filter(Boolean);
      const slotEvent = visibleSlotEvents[key];
      const slotEventLabel = slotEvent ? planningEventMeta(slotEvent.type).label : "";
      return {
        day,
        dayIndex,
        time,
        key,
        activeSlot,
        slotEvent,
        slotEventLabel,
        title: [slotEventLabel, availableNames.join(" · ") || "Aucun profil allumé"].filter(Boolean).join(" · "),
        roles: roleSlots.map(({ role, player }) => ({
          role,
          player,
          lit: Boolean(player && availableIds.has(String(player.id))),
          selectedRoleHere: selectedRole === role && activeSlot,
        })),
        staffUnit: staffPlanningPlayerId ? {
          lit: staffLit,
          selectedStaffHere: selectedIsStaff && activeSlot,
          title: staffLit ? "Coaching Staff disponible" : "Coaching Staff indisponible",
        } : null,
      };
    }),
  })), [draftSlots, effectivePlayerIdsByCell, roleSlots, selectedIsStaff, selectedRole, staffPlanningPlayerId, visibleSlotEvents, weekDays]);

  if (!selectedTeamId) return <EmptyState icon={CalendarDays} title="Aucune équipe sélectionnée" text="Choisis une équipe pour configurer les disponibilités." />;
  if (!players.length) return <EmptyState icon={Users} title="Aucun profil" text="Ajoute des joueurs ou du coaching staff pour construire le planning de team." />;
  if (!linkedPlayer) return <EmptyState icon={Users} title="Aucun profil lié" text="Les joueurs doivent être liés à un compte pour renseigner leurs disponibilités. Le coaching staff utilise désormais une seule entrée partagée dans le planning." />;

  return (
    <div>
      <PageHeader eyebrow="Organisation" title="Planning" subtitle="Dispos joueurs et présence Coaching Staff groupée, en vue compacte.">
        <div className="flex flex-wrap gap-2">
          {weekOptions.map((week) => (
            <button key={week.id} type="button" onClick={() => setSelectedWeekStart(week.start)} className={cx("rounded-lg border px-2.5 py-1.5 text-left transition", selectedWeek.start === week.start ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/25 hover:text-white")}>
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.14em]">{week.label}</span>
              <span className="mt-0.5 block text-xs font-semibold opacity-80">{week.range}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {bestCells[0]?.count > 0 && <Badge tone="cyan">Top créneau : {bestCells[0].count}/{planningUnitTotal}</Badge>}
          <Badge tone={fullTeamSlots ? "green" : "slate"}>{fullTeamSlots} slots 5 joueurs</Badge>
          {staffProfiles.length > 0 && <Badge tone={staffAvailableSlots ? "purple" : "slate"}>{staffAvailableSlots} slots CS</Badge>}
        </div>
      </PageHeader>
      {eventMenu && <div onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()} className="fixed z-[80] w-[210px] overflow-hidden rounded-2xl border border-cyan-200/22 bg-[#050814]/98 p-2 text-white shadow-[0_24px_70px_rgba(0,0,0,.70),0_0_34px_rgba(34,211,238,.16)] ring-1 ring-white/10 backdrop-blur-xl" style={{ left: eventMenu.x, top: eventMenu.y }}>
        <div className="px-2 pb-2 pt-1">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-cyan-100/80">Choisir un type</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-300">{eventMenuDay?.[1] || eventMenu.day} · {eventMenu.time}</p>
        </div>
        <div className="grid gap-1">
          {PLANNING_EVENT_TYPES.map((item) => <button key={item.id} type="button" onClick={() => applyPlanningEventType(item.id)} className="flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-cyan-200/20 hover:bg-white/[0.06]">
            <span className={cx("h-2.5 w-2.5 rounded-full", item.dot)} />
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-100">{item.label}</span>
          </button>)}
        </div>
        {eventMenuCurrent && <div className="mt-2 border-t border-white/10 pt-2">
          <button type="button" onClick={removePlanningEvent} className="flex w-full items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-500/10 px-2.5 py-2 text-left text-rose-100 transition hover:border-rose-200/35 hover:bg-rose-500/16">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-xs font-black uppercase tracking-[0.12em]">Supprimer</span>
          </button>
        </div>}
      </div>}

      <div className="space-y-5">
        {false && <div className="hidden">
          <Surface glow className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Profils</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Choisis le planning à éditer.</p>
              </div>
              <Badge tone={canManageAll ? "purple" : "slate"}>{canManageAll ? "Staff" : "Joueur"}</Badge>
            </div>
            <div className="mt-3 grid gap-1.5">
              {players.map((player) => {
                const selected = player.id === selectedPlayerId;
                const filled = weekDays.reduce((sum, [day]) => sum + slotList(player.id, day).length, 0);
                return (
                  <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={cx("flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition", selected ? "border-cyan-300/35 bg-cyan-400/10 text-white" : "border-white/10 bg-white/[0.028] text-slate-400 hover:border-cyan-300/18 hover:bg-white/[0.055] hover:text-white")}>
                    <span className="flex min-w-0 items-center gap-2">
                      <RoleIcon role={player.role} className="h-5 w-5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{player.name}</span>
                        <span className="mt-0.5 block text-[0.6rem] font-black uppercase tracking-[0.14em] text-slate-300">{roleLabel(player.role)}{player.user_id === user?.id ? " · Moi" : ""}</span>
                      </span>
                    </span>
                    <Badge tone={filled ? "cyan" : "slate"}>{filled} slots</Badge>
                  </button>
                );
              })}
            </div>
          </Surface>

          <Surface className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Créneaux forts</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">Top rendez-vous semaine.</p>
              </div>
              <Badge tone="cyan">Top {bestCells.length}</Badge>
            </div>
            <div className="mt-3 grid gap-1.5">
              {bestCells.map((cell) => (
                <div key={`${cell.day}-${cell.time}`} className={cx("rounded-xl border px-2.5 py-2", cell.count === players.length ? tone("green") : cell.count > 0 ? tone("cyan") : tone("slate"))}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black">{weekDays.find(([day]) => day === cell.day)?.[1]} · {cell.time}</span>
                    <span className="text-xs font-black">{cell.count}/{players.length}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {players.filter((player) => slotList(player.id, cell.day).includes(cell.time)).map((player) => <span key={player.id} title={`${roleLabel(player.role)} · ${player.name}`} className="inline-flex items-center rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em]">{String(player.role || "?").slice(0, 3)}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        </div>}

        <div className="space-y-5">
          <Surface glow className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Planning team</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{canEditSelected ? "Clique un créneau pour indiquer ta dispo. Clic droit = Scrim, Match ou Review." : "Lecture seule."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPlayer && <Badge tone={selectedIsStaff ? "purple" : "blue"}>{selectedDisplayRole}</Badge>}
                {staffProfiles.length > 0 && <Badge tone={staffAvailableSlots ? "purple" : "slate"}>{staffAvailableSlots} CS</Badge>}
                <Badge tone={selectedFilledSlots ? "cyan" : "slate"}>{selectedFilledSlots} slots</Badge>
                <Badge tone={selectedFilledDays >= 4 ? "green" : selectedFilledDays ? "purple" : "slate"}>{selectedFilledDays}/7 jours</Badge>
                <Badge tone={selectedEventCount ? "purple" : "slate"}>{selectedEventCount} event</Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/18 p-3">
              <div className="flex min-w-0 items-center gap-3">
                {selectedIsStaff ? <span title="Coaching Staff" className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-fuchsia-200/40 bg-gradient-to-br from-fuchsia-400/20 via-cyan-400/12 to-black/20 text-fuchsia-50 shadow-[0_0_18px_rgba(217,70,239,.16)]"><BookOpen className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rotate-45 rounded-[2px] border border-cyan-100/60 bg-cyan-200 shadow-[0_0_10px_rgba(125,211,252,.75)]" /></span> : <RoleIcon role={selectedPlayer?.role} className="h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{selectedDisplayName}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{selectedPlayer ? `${selectedDisplayRole} · ${selectedIsStaff ? "présence staff groupée" : "compte lié"}` : "Lie ton compte à un profil dans Gestion."}</p>
                </div>
              </div>
              <Badge tone={canEditSelected ? "green" : "slate"}>{canEditSelected ? (selectedIsStaff ? "Planning CS" : "Mon planning") : "Lecture seule"}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("evenings")} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50">Soirées</button>
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("scrim")} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50">Bloc scrim</button>
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("weekend")} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50">Week-end</button>
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("clear")} className="rounded-lg border border-rose-300/15 bg-rose-500/10 px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-rose-100 transition hover:border-rose-200/35 disabled:cursor-not-allowed disabled:opacity-50">Vider</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Type de créneau</span>
              {PLANNING_EVENT_TYPES.map((item) => <span key={item.id} className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-100">{item.label}</span>)}
              <span className="ml-auto text-[0.62rem] font-black uppercase tracking-[0.14em] text-cyan-100">{selectedRoleLabel}</span>
            </div>
            <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <div className="min-w-[660px]">
                <div className="nxt5-planning-grid grid grid-cols-[3.4rem_repeat(7,minmax(4.65rem,1fr))] overflow-hidden rounded-lg border border-cyan-200/22 bg-cyan-300/18 shadow-[inset_0_0_0_1px_rgba(255,255,255,.045)] [contain:layout_paint]">
                  <div />
                  {weekDays.map(([day, label, date], dayIndex) => {
                    const dayActive = (draftSlots[day] || []).length;
                    return <button key={day} type="button" disabled={!canEditSelected} onClick={() => setDaySlots(day, dayActive ? [] : PLANNING_TIMES)} title={dayActive ? "Vider la journée" : "Remplir la journée"} className={cx("nxt5-planning-day-header px-1.5 py-1 text-center text-[0.54rem] font-black uppercase tracking-[0.08em] transition", dayIndex % 2 ? "nxt5-planning-day-alt" : "nxt5-planning-day-base", dayActive ? "nxt5-planning-day-active text-cyan-50" : "text-slate-300 hover:text-white", !canEditSelected && "cursor-not-allowed opacity-70")} ><span className="block">{label}</span><span className="block text-[0.52rem] text-cyan-100/70">{formatPlanningDate(date)}</span></button>;
                  })}
                  {planningGridRows.map(({ time, cells }) => (
                    <React.Fragment key={time}>
                      <button type="button" disabled={!canEditSelected} onClick={() => setTimeForWeek(time)} title="Basculer cette heure sur toute la semaine" className="flex items-center bg-[#08111f] px-1.5 py-0.5 text-[0.7rem] font-black text-white transition hover:bg-[#101b2d] disabled:cursor-not-allowed disabled:opacity-70">{time}</button>
                      {cells.map((cell) => {
                        const day = cell.day;
                        return <button key={cell.key} type="button" disabled={!canEditSelected && !canEditEvents} onClick={() => toggleSlot(day, time)} onContextMenu={(event) => openPlanningEventMenu(event, day, time)} title={cell.title} className={cx("nxt5-planning-cell relative min-h-[2.35rem] px-1.5 py-1 text-left transition", cell.dayIndex % 2 ? "nxt5-planning-day-alt" : "nxt5-planning-day-base", frameTone(cell.slotEvent), !cell.slotEvent && "hover:bg-cyan-300/[0.055]", !canEditSelected && "cursor-context-menu opacity-90", !canEditSelected && !canEditEvents && "cursor-not-allowed opacity-70")} >
                          {cell.slotEvent && <span className="absolute left-1 top-0.5 text-[0.44rem] font-black uppercase tracking-[0.09em] opacity-75">{cell.slotEventLabel}</span>}
                          <div className="flex h-full flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1">
                              {cell.roles.map(({ role, player, lit, selectedRoleHere }) => {
                                return <span key={role} title={player ? `${roleLabel(role)} · ${player.name}` : `${roleLabel(role)} · non lié`} className={cx("inline-flex items-center justify-center transition", lit ? "nxt5-planning-role-lit" : "nxt5-planning-role-dim", selectedRoleHere && "nxt5-planning-role-selected")}>
                                  <RoleIcon role={role} lightweight className="h-4 w-4" />
                                </span>;
                              })}
                              {cell.staffUnit && <span title={cell.staffUnit.title} className={cx("relative inline-flex h-[1.2rem] w-[1.2rem] items-center justify-center rounded-md border transition", cell.staffUnit.lit ? "border-fuchsia-200/55 bg-gradient-to-br from-fuchsia-400/30 via-cyan-400/14 to-black/10 text-fuchsia-50 shadow-[0_0_14px_rgba(217,70,239,.24)]" : "border-white/5 bg-black/12 text-slate-700 opacity-35 grayscale", cell.staffUnit.selectedStaffHere && "border-white/70 bg-white/20 text-white opacity-100 grayscale-0 shadow-[0_0_16px_rgba(255,255,255,.14)]")}><BookOpen className="h-3 w-3" />{cell.staffUnit.lit && <span className="absolute -right-px -top-px h-1.5 w-1.5 rotate-45 rounded-[1px] bg-cyan-200 shadow-[0_0_8px_rgba(125,211,252,.8)]" />}</span>}
                            </div>
                          </div>
                        </button>;
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Note planning</label>
              <textarea value={notes} onChange={(event) => { setNotes(event.target.value); markPlanningDirty(); }} disabled={!canEditSelected} rows={2} placeholder="Contraintes, retard possible, préférence de scrim..." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/24 px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35 disabled:cursor-not-allowed disabled:opacity-60" />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-400">Chaque clic est sauvegardé automatiquement. Clic droit sur un créneau = type de session.</p>
              <Badge tone={saveStatusMeta.tone}>{saveStatusMeta.label}</Badge>
            </div>
          </Surface>

          {false && null}
        </div>
      </div>
    </div>
  );
}

function DraftPickCard({ pick, label }) {
  const winrate = Number(pick?.winrate || 0);
  const toneName = winrate >= 55 ? "green" : winrate <= 40 ? "red" : "yellow";
  const styleTags = championStyleTags(pick?.champion).slice(0, 2);
  return <div className="nxt5-panel group relative min-h-[250px] overflow-hidden border border-cyan-200/14 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/34 hover:shadow-[0_0_34px_rgba(34,211,238,.12)]"><ChampionBackdrop champion={pick?.champion} /><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-fuchsia-200/60" /><div className="relative z-10 flex min-h-[210px] flex-col justify-between"><div><div className="flex items-center justify-between gap-3"><Badge tone="cyan">{label}</Badge></div><h3 className="mt-5 text-3xl font-black text-white">{pick ? championDisplayName(pick.champion) : "À définir"}</h3><p className="mt-1 text-sm font-bold text-slate-300">{pick?.player_name || "Pas assez de données"}</p>{pick && <div className="mt-3 flex flex-wrap gap-2">{styleTags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div>}</div><div className="mt-6"><StatBar value={winrate} max={100} tone={toneName} /><div className="mt-3 flex flex-wrap gap-2"><Badge tone={toneName}>{pick?.winrate ?? "?"}% WR</Badge><Badge tone="slate">{pick?.games ?? 0} games</Badge><Badge tone="purple">{pick?.kda ? Number(pick.kda).toFixed(1) : "?"} KDA</Badge></div><p className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">{pick?.verdict || "Importe plus de matchs pour alimenter la préparation de draft."}</p></div></div></div>;
}

function DraftSlot({ pick, index, side = "blue" }) {
  const sideTone = side === "blue" ?"border-cyan-300/28 bg-cyan-400/[0.08] shadow-[inset_0_0_34px_rgba(34,211,238,.06)]" : "border-fuchsia-300/28 bg-fuchsia-400/[0.08] shadow-[inset_0_0_34px_rgba(217,70,239,.06)]";
  const indexTone = side === "blue" ?"border-cyan-300/30 text-cyan-100" : "border-fuchsia-300/30 text-fuchsia-100";
  return <div className={cx("nxt5-panel grid min-h-[92px] grid-cols-[3rem_1fr_auto] items-center gap-3 border p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.055]", sideTone)}><div className={cx("flex h-10 w-10 items-center justify-center rounded-xl border bg-black/34 text-sm font-black", indexTone)}>{index + 1}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{pick ?championDisplayName(pick.champion) : "Open Pick"}</p><p className="truncate text-xs font-semibold text-slate-400">{pick?.player_name || "À déterminer"}</p></div><div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">{pick ?<ChampionPortrait row={pick} champion={pick.champion} alt={pick.champion} /> : <Crown className="m-3 h-6 w-6 text-slate-300" />}</div></div>;
}

function DraftBoard({ comfort, risk }) {
  const blue = [comfort[0], comfort[2], comfort[4], comfort[6], comfort[8]];
  const red = [comfort[1], comfort[3], comfort[5], risk[0], risk[1]];
  return <Surface glow className="nxt5-hud-lines"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="nxt5-metal-text text-2xl font-black">Draft Protocol</h3><p className="mt-1 text-sm font-semibold text-slate-400">Une table tactique pour discuter ordre de Pick, sécurisation et réponses.</p></div><Badge tone="purple">Five-stack prep</Badge></div><div className="grid gap-4 lg:grid-cols-2"><div><div className="mb-3 flex items-center gap-2"><Badge tone="cyan">Blue Side</Badge><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Priorité confiance</span></div><div className="space-y-2">{blue.map((pick, index) => <DraftSlot key={"blue-" + index} pick={pick} index={index} side="blue" />)}</div></div><div><div className="mb-3 flex items-center gap-2"><Badge tone="pink">Red Side</Badge><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Réponse Et Flex</span></div><div className="space-y-2">{red.map((pick, index) => <DraftSlot key={"red-" + index} pick={pick} index={index} side="red" />)}</div></div></div></Surface>;
}

function BanRecommendations({ risk, comfort }) {
  const bans = [...risk.slice(0, 3), ...comfort.filter((pick) => Number(pick.winrate || 0) < 50).slice(0, 2)].slice(0, 5);
  return <Surface><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Champions à surveiller</h3><p className="mt-1 text-sm font-semibold text-slate-300">Liste de champions issue des volumes et winrates disponibles.</p></div><Badge tone="red">Data list</Badge></div>{bans.length ?<div className="space-y-3">{bans.map((pick, index) => <div key={pick.id || index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"><div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><ChampionPortrait row={pick} champion={pick.champion} alt={pick.champion} /></div><div className="min-w-0"><p className="truncate font-black text-white">{championDisplayName(pick.champion)}</p><p className="truncate text-xs font-semibold text-slate-300">{pick.player_name || "Roster"} · {pick.games || 0} games</p></div><Badge tone={Number(pick.winrate || 0) <= 40 ?"red" : "yellow"}>{pick.winrate || 0}% WR</Badge></div>)}</div> : <EmptyState icon={Shield} title="Aucune donnée" text="Importe plus de matchs pour enrichir la liste." />}</Surface>;
}

function RolePrepMatrix({ players, championPool }) {
  const roles = COMP_ROLES;
  return <Surface glow><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Roster par rôle</h3><p className="mt-1 text-sm font-semibold text-slate-300">Champions liés aux profils à partir des données disponibles.</p></div><Badge tone="cyan">roster</Badge></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{roles.map((role) => { const player = players.find((item) => item.role === role); const picks = player ?playerChampionRows(player, championPool).slice(0, 3) : []; return <div key={role} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><Badge tone={role === "COACH" ?"purple" : "blue"}>{role}</Badge><span className="truncate text-sm font-black text-white">{player?.name || "Slot ouvert"}</span></div><div className="mt-4 flex gap-2">{picks.length ?picks.map((pick) => <div key={pick.id} className="h-12 w-12 overflow-hidden rounded-full border border-cyan-300/20 bg-black/30"><ChampionPortrait row={pick} champion={pick.champion} alt={pick.champion} /></div>) : <p className="text-sm font-semibold leading-6 text-slate-300">Pas encore assez de données champion.</p>}</div><p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Données</p><p className="mt-1 text-sm font-bold leading-6 text-slate-300">{picks.length ? ` champion affiché` : "Aucune donnée liée"}</p></div>; })}</div></Surface>;
}

function CompositionIdentityPanel({ picks }) {
  const identity = compositionIdentity(picks);
  return <Surface><div className="flex items-start justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Identité de Compo</h3><p className="mt-1 text-sm font-semibold text-slate-300">La tendance de Draft selon les champions conforts actuels.</p></div><Badge tone={championStyleTone(identity.primary)}>{tagLabel(identity.primary)}</Badge></div><p className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-bold leading-6 text-white">{identity.text}</p><div className="mt-4 flex flex-wrap gap-2">{identity.tags.length ? identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Pas assez de Picks</Badge>}</div></Surface>;
}

function reportMatchIds(report) {
  if (Array.isArray(report.match_ids)) return report.match_ids;
  if (typeof report.match_ids === "string") {
    try {
      const parsed = JSON.parse(report.match_ids);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  if (report.match_id) return [report.match_id];
  return [];
}

function reportTitleFromMatchIds(matchIds = [], matches = [], fallback = "Review") {
  const linked = matches.filter((match) => matchIds.includes(match.id));
  if (linked.length === 1) return matchDisplayName(linked[0], fallback);
  if (linked.length > 1) {
    const names = linked.slice(0, 2).map((match) => matchDisplayName(match, "Game"));
    return `${names.join(" + ")}${linked.length > 2 ? ` +${linked.length - 2}` : ""}`;
  }
  return fallback;
}

function reportDisplayName(report, matches = [], fallback = "Review") {
  return reportTitleFromMatchIds(reportMatchIds(report), matches, report?.title || fallback);
}

function reportRows(matches, matchIds) {
  const selected = matches.filter((match) => matchIds.includes(match.id));
  return selected.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match }))).filter((row) => row.team_key === "ALLY");
}

function reportObjectiveLines(matches, matchIds) {
  const selected = matches.filter((match) => matchIds.includes(match.id));
  return selected.flatMap((match) => {
    const events = objectiveEvents(match);
    if (!events.length) return [];
    return events.map((event) => `${matchDisplayName(match)} · ${event.time} · ${event.teamKey === "ALLY" ? "NXT5" : "Adversaire"} prend ${event.label}`);
  });
}

function roleRows(rows, role) {
  const needle = String(role || "").replace(/["']/g, "").toUpperCase();
  return rows.filter((row) => String(row.role || "").toUpperCase() === needle);
}

function commandResult(command, rows) {
  const raw = String(command || "").trim();
  const teamMatch = raw.match(/^\/TEAM\s+(KDA|DAMAGE|VISION|GOLD|KP)/i);
  if (teamMatch) {
    if (!rows.length) return `${raw} -> aucune game liée.`;
    const key = teamMatch[1].toUpperCase();
    const avg = (field) => Math.round(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length);
    const avgFloat = (field) => (rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length).toFixed(2);
    if (key === "KDA") return `Team KDA moyen: ${avgFloat("kda")} sur ${rows.length} lignes joueur.`;
    if (key === "DAMAGE") return `Team dégâts moyens par joueur: ${formatPoints(avg("damage"))}.`;
    if (key === "VISION") return `Team vision moyenne par joueur: ${avg("vision")}.`;
    if (key === "GOLD") return `Team gold moyen par joueur: ${formatPoints(avg("gold"))}.`;
    return `Team KP moyen: ${Math.round(Number(avgFloat("kp")) * 100)}%`;
  }
  const match = raw.match(/^\/(KDA|DAMAGE|VISION|GOLD|KP)\s+["']?([A-Z]{2,3})["']?/i);
  if (!match) return null;
  const [, key, role] = match;
  const scoped = roleRows(rows, role);
  if (!scoped.length) return `${raw} -> aucune donnée pour ${role.toUpperCase()}.`;
  const avg = (field) => Math.round(scoped.reduce((sum, row) => sum + Number(row[field] || 0), 0) / scoped.length);
  const avgFloat = (field) => (scoped.reduce((sum, row) => sum + Number(row[field] || 0), 0) / scoped.length).toFixed(2);
  const label = role.toUpperCase();
  if (key.toUpperCase() === "KDA") return `${label} KDA moyen: ${avgFloat("kda")} sur ${scoped.length} game${scoped.length > 1 ? "s" : ""}.`;
  if (key.toUpperCase() === "DAMAGE") return `${label} dégâts moyens: ${formatPoints(avg("damage"))}.`;
  if (key.toUpperCase() === "VISION") return `${label} vision moyenne: ${avg("vision")}.`;
  if (key.toUpperCase() === "GOLD") return `${label} gold moyen: ${formatPoints(avg("gold"))}.`;
  return `${label} KP moyen: ${Math.round(Number(avgFloat("kp")) * 100)}%`;
}

function renderReportContent(content, rows) {
  const blockedSections = [/points?\s+forts?/i, /points?\s+à?\s*corriger/i, /focus/i, /objectif\s+principal/i, /axes?\s+de\s+travail/i];
  return String(content || "").split("\n").filter((line) => !blockedSections.some((pattern) => pattern.test(line))).map((line, index) => {
    const result = commandResult(line, rows);
    return result ? <p key={index} className="min-h-[1.5rem] break-words whitespace-pre-wrap font-mono text-[0.76rem] font-bold leading-6 text-cyan-50 sm:text-[0.82rem]">{result}</p> : <p key={index} className="min-h-[1.5rem] break-words whitespace-pre-wrap">{line}</p>;
  });
}

function ReportObjectivePanel({ matches, matchIds }) {
  const lines = reportObjectiveLines(matches, matchIds);
  if (!matchIds?.length) return null;
  return <div className="mb-3 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.055] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Objectifs neutres</p><Badge tone="cyan">{lines.length}</Badge></div>
    <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">{lines.map((line, index) => <p key={`${line}-${index}`} className="text-xs font-semibold leading-5 text-slate-100">{line}</p>)}</div>
  </div>;
}

function ReportPreview({ content, rows, matches = [], matchIds = [] }) {
  return <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/[0.26] p-3 text-[0.82rem] leading-6 text-slate-100 shadow-inner shadow-black/35 sm:p-4 sm:text-sm sm:leading-7">{String(content || "").trim() ? renderReportContent(content, rows) : <p className="text-sm font-semibold text-slate-300">L’aperçu apparaîtra ici.</p>}</div>;
}

const REPORT_REWRITE_MARKER = "[NXT5_REPORT_V2]";

function stripGeneratedReportContent(content) {
  const text = String(content || "").trim();
  if (!text) return "";
  const preserved = text.split(REPORT_REWRITE_MARKER).pop().trim();
  return preserved.replace(/^Notes (précédentes|conservées)\s*:?\s*/i, "").trim();
}

function reportRawGameLine(match) {
  const rows = (match.participants || []).filter((row) => row.team_key === "ALLY");
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const kills = sum("kills");
  const deaths = sum("deaths");
  const assists = sum("assists");
  const damage = sum("damage");
  const towerDmg = rows.reduce((total, row) => total + towerDamage(row), 0);
  const gold = sum("gold");
  const vision = sum("vision");
  const objectives = match.objective_score ? ` · Objectifs: ${match.objective_score}` : "";
  const core = `${matchDisplayName(match, "Adversaire inconnu")} · ${match.game_id || "Game ID"} · ${match.result || "Résultat ?"} · ${match.side || "Side ?"} · ${match.duration || "--:--"}`;
  if (!rows.length) return `${core} · Données joueurs absentes`;
  return `${core} · KDA ${kills}/${deaths}/${assists} · DMG ${formatPoints(damage)} · Tours ${formatPoints(towerDmg)} · Gold ${formatPoints(gold)} · Vision ${vision}${objectives}`;
}

function reportRawSummaryLines(matches) {
  if (!matches.length) return ["Aucune game liée."];
  const rows = matches.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY"));
  if (!rows.length) return ["Games liées, mais données joueurs absentes."];
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const towerTotal = rows.reduce((total, row) => total + towerDamage(row), 0);
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const games = matches.length;
  return [
    `Games: ${games} · ${wins}W - ${games - wins}L · WR ${Math.round((wins / Math.max(1, games)) * 100)}%`,
    `KDA équipe: ${sum("kills")}/${sum("deaths")}/${sum("assists")}`,
    `Moyennes joueur/game: ${formatPoints(sum("damage") / Math.max(1, rows.length))} DMG · ${formatPoints(towerTotal / Math.max(1, rows.length))} Tours · ${formatPoints(sum("gold") / Math.max(1, rows.length))} Gold · ${Math.round(sum("vision") / Math.max(1, rows.length))} Vision`,
  ];
}

function buildArchiveReportContent(name, matches) {
  const linked = Array.isArray(matches) ? matches.filter(Boolean) : [];
  const gameLines = linked.length ? linked.map((match, index) => `${index + 1}. ${reportRawGameLine(match)}`).join("\n") : "Aucune game liée.";
  return [
    "Review de groupe",
    "",
    `Groupe: ${name || "Groupe"}`,
    "",
    "Résumé",
    ...reportRawSummaryLines(linked),
    "",
    "Games",
    gameLines,
    "",
    REPORT_REWRITE_MARKER,
    "Notes staff",
    "",
  ].join("\n");
}

function buildReportRewriteContent(report, matches) {
  const ids = reportMatchIds(report);
  const linked = matches.filter((match) => ids.includes(match.id));
  const previousNotes = stripGeneratedReportContent(report.content);
  const gameLines = linked.length ? linked.map((match, index) => `${index + 1}. ${reportRawGameLine(match)}`).join("\n") : "Aucune game liée.";
  const body = [
    "Review brute",
    "",
    "Résumé",
    ...reportRawSummaryLines(linked),
    "",
    "Games",
    gameLines,
  ];
  if (previousNotes) body.push("", REPORT_REWRITE_MARKER, "Notes conservées", previousNotes);
  return body.join("\n");
}

function Reports({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const reports = (data.reports || []).filter((report) => report.team_id === selectedTeamId);
  const matches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const archives = (data.matchArchives || []).filter((archive) => archive.team_id === selectedTeamId);
  const urlReportId = new URLSearchParams(window.location.search).get("report") || "";
  const urlMatchId = new URLSearchParams(window.location.search).get("match") || "";
  const canCaptainDelete = canStaffManage(currentMember?.role);
  const [form, setForm] = useState({ id: null, title: "", content: "", matchIds: [] });
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(urlReportId || null);
  const [lexiconOpen, setLexiconOpen] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const selected = reports.find((report) => report.id === selectedReportId) || reports[0];
  const selectedArchive = archives.find((archive) => archive.id === selectedArchiveId);
  const scopedMatches = selectedArchive ? matches.filter((match) => archiveMatchIds(selectedArchive).includes(match.id)) : matches;
  const scopedReports = selectedArchive ? reports.filter((report) => reportMatchIds(report).some((id) => archiveMatchIds(selectedArchive).includes(id))) : reports;
  const selectedRows = selected ? reportRows(matches, reportMatchIds(selected)) : [];
  const formRows = reportRows(matches, form.matchIds);
  const canEditSelected = selected && (canCaptainDelete || selected.created_by === user?.id);
  const selectedMatchForReport = selected ? matches.find((match) => reportMatchIds(selected).includes(match.id) && (!urlMatchId || match.id === urlMatchId)) || matches.find((match) => reportMatchIds(selected).includes(match.id)) : null;
  const formDisplayTitle = reportTitleFromMatchIds(form.matchIds, matches, form.title || "Review");
  const reviewMatches = form.matchIds.length ? matches.filter((match) => form.matchIds.includes(match.id)) : [];
  const selectedMatchIds = selected ? reportMatchIds(selected) : [];
  const selectedMatches = selected ? matches.filter((match) => selectedMatchIds.includes(match.id)) : [];
  const reviewWins = reviewMatches.filter((match) => match.result === "Victoire").length;
  const selectedWins = selectedMatches.filter((match) => match.result === "Victoire").length;
  const newestReview = reports.slice().sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0];
  const searchNeedle = reportSearch.trim().toLowerCase();
  const filteredReports = scopedReports.filter((report) => {
    if (!searchNeedle) return true;
    const title = reportDisplayName(report, matches).toLowerCase();
    const author = String(report.author_name || "").toLowerCase();
    return title.includes(searchNeedle) || author.includes(searchNeedle) || String(report.content || "").toLowerCase().includes(searchNeedle);
  });
  const selectionLabel = reviewMatches.length ? `${reviewWins}W - ${reviewMatches.length - reviewWins}L · ${Math.round((reviewWins / Math.max(1, reviewMatches.length)) * 100)}% WR` : "Aucune game sélectionnée";

  function startBlankReview() {
    resetReportForm();
    setComposerOpen(true);
    setLexiconOpen(false);
  }

  function selectReport(report) {
    setSelectedReportId(report.id);
    window.history.replaceState({}, "", "/rapports?report=" + report.id);
  }

  function selectAllScopedMatches() {
    setForm((current) => ({ ...current, matchIds: scopedMatches.map((match) => match.id) }));
  }

  useEffect(() => {
    if (urlReportId && reports.some((report) => report.id === urlReportId)) setSelectedReportId(urlReportId);
    else if (urlMatchId) {
      const report = reports.find((item) => reportMatchIds(item).includes(urlMatchId));
      if (report) setSelectedReportId(report.id);
    }
  }, [urlReportId, urlMatchId, reports.map((report) => report.id).join("|")]);

  function toggleMatch(id) {
    setForm((current) => ({ ...current, matchIds: current.matchIds.includes(id) ? current.matchIds.filter((item) => item !== id) : [...current.matchIds, id] }));
  }

  function useArchiveForReport(archive) {
    const ids = archiveMatchIds(archive).filter((id) => matches.some((match) => match.id === id));
    setSelectedArchiveId((current) => current === archive.id ? "" : archive.id);
    setForm((current) => ({
      ...current,
      title: current.title || archive.name || "",
      matchIds: current.matchIds.length ? current.matchIds : ids,
    }));
  }

  function insertCommand(command) {
    setForm((current) => ({ ...current, content: `${current.content}${current.content.endsWith("\n") || !current.content ? "" : "\n"}${command}` }));
  }

  function editReport(report) {
    setForm({ id: report.id, title: reportDisplayName(report, matches), content: report.content || "", matchIds: reportMatchIds(report) });
    setComposerOpen(true);
    setLexiconOpen(false);
  }

  function duplicateReport(report) {
    setForm({ id: null, title: `${reportDisplayName(report, matches)} copie`, content: report.content || "", matchIds: reportMatchIds(report) });
    setComposerOpen(true);
    setLexiconOpen(false);
  }

  function resetReportForm() {
    setForm({ id: null, title: "", content: "", matchIds: [] });
  }

  async function saveReport(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const title = reportTitleFromMatchIds(form.matchIds, matches, form.title || "Review");
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: form.id ? "update" : "create", teamId: selectedTeamId, reportId: form.id, title, content: form.content, matchIds: form.matchIds }) });
      resetReportForm();
      setComposerOpen(false);
      setLexiconOpen(false);
      await refreshAll();
      pushToast({ type: "green", title: form.id ? "Review mise à jour" : "Review créée", text: "Le contenu de review est enregistré." });
    } catch (err) {
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport(report) {
    const canDelete = canCaptainDelete || report.created_by === user?.id;
    if (!canDelete || !window.confirm("Supprimer cette review ?")) return;
    setSaving(true);
    try {
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, reportId: report.id }) });
      await refreshAll();
      pushToast({ type: "green", title: "Review supprimée", text: "La review a été retirée." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const commands = [[`/KDA "ADC"`, "KDA moyen d’un rôle."], [`/DAMAGE "MID"`, "Dégâts moyens d’un rôle."], [`/VISION "SUP"`, "Vision moyenne d’un rôle."], [`/GOLD "JGL"`, "Gold moyen d’un rôle."], [`/KP "TOP"`, "Participation moyenne aux kills."], ["/TEAM KDA", "KDA moyen de l’équipe."], ["/TEAM DAMAGE", "Dégâts moyens par joueur."]];
  return (
    <div className="nxt5-data-dense min-w-0 overflow-hidden">
      <PageHeader
        eyebrow="Review room"
        title="Review"
        subtitle="Lecture d'abord : retrouve une review, lis les décisions, puis crée ou édite seulement quand tu en as besoin."
      >
        <Button icon={Plus} onClick={startBlankReview}>Créer une review</Button>
        <Button variant="ghost" icon={BarChart3} onClick={() => openAppPath("/statistiques")}>Voir les stats</Button>
      </PageHeader>

      <Surface className="mb-5 p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">Lecture</Badge>
              <Badge tone={selectedArchive ? "purple" : "slate"}>{selectedArchive?.name || "Toutes les reviews"}</Badge>
              <Badge tone="green">{reports.length} review{reports.length > 1 ? "s" : ""}</Badge>
            </div>
            <h3 className="mt-3 break-words text-2xl font-black text-white">{selected ? reportDisplayName(selected, matches) : "Aucune review sélectionnée"}</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">La création est rangée dans une fenêtre dédiée. Ici, tu lis, tu retrouves, tu ouvres les stats et tu prends une décision.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-center"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Reviews</p><p className="mt-1 text-xl font-black text-white">{reports.length}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-center"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Games</p><p className="mt-1 text-xl font-black text-white">{selectedMatches.length}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-center"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">WR</p><p className="mt-1 text-xl font-black text-white">{selectedMatches.length ? `${Math.round((selectedWins / Math.max(1, selectedMatches.length)) * 100)}%` : "--"}</p></div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setSelectedArchiveId("")} className={cx("shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-black uppercase tracking-[0.12em] transition", !selectedArchiveId ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/20")}>Toutes</button>
          {archives.map((archive) => {
            const ids = archiveMatchIds(archive);
            const active = selectedArchiveId === archive.id;
            return <button key={archive.id} type="button" onClick={() => setSelectedArchiveId(active ? "" : archive.id)} className={cx("min-w-[150px] shrink-0 rounded-xl border px-3 py-2 text-left transition", active ? "border-purple-300/40 bg-purple-400/12 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-purple-300/25")}><p className="truncate text-xs font-black text-white">{archive.name}</p><p className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">{ids.length} game{ids.length > 1 ? "s" : ""}</p></button>;
          })}
        </div>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Surface className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-xl font-black text-white">Bibliothèque</h3><p className="mt-1 text-sm font-semibold text-slate-400">{filteredReports.length} / {reports.length} review{reports.length > 1 ? "s" : ""}</p></div>
            <Button type="button" icon={Plus} onClick={startBlankReview}>Créer</Button>
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <Search className="h-4 w-4 text-cyan-100/70" />
            <input value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Chercher une review..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500" />
          </label>
          <div className="mt-4 max-h-[680px] space-y-2 overflow-auto pr-1">
            {filteredReports.length ? filteredReports.map((report) => {
              const active = selected?.id === report.id;
              const ids = reportMatchIds(report);
              return <button key={report.id} type="button" onClick={() => selectReport(report)} className={cx("w-full rounded-xl border p-3 text-left transition", active ? "border-cyan-300/45 bg-cyan-400/12 shadow-[0_0_24px_rgba(34,211,238,.10)]" : "border-white/10 bg-white/[0.03] hover:border-cyan-300/18 hover:bg-white/[0.055]")}>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><p className="min-w-0 break-words font-black text-white">{reportDisplayName(report, matches)}</p><Badge tone={active ? "cyan" : "slate"}>{ids.length} game{ids.length > 1 ? "s" : ""}</Badge></div>
                <p className="mt-1 truncate text-xs font-semibold text-slate-300">Par {report.author_name || "NXT5"} · {new Date(report.updated_at || report.created_at).toLocaleDateString("fr-FR")}</p>
              </button>;
            }) : <EmptyState icon={FileText} title="Aucune review" text="Crée une review depuis le bouton en haut, elle apparaîtra ici." />}
          </div>
        </Surface>

        <Surface glow={Boolean(selected)} className="p-5">
          {selected ? <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <Badge tone="purple">Review active</Badge>
                <h3 className="mt-3 break-words text-3xl font-black text-white">{reportDisplayName(selected, matches)}</h3>
                <p className="mt-2 text-sm font-semibold text-slate-300">Par {selected.author_name || "NXT5"} · {selectedMatches.length} game{selectedMatches.length > 1 ? "s" : ""} liée{selectedMatches.length > 1 ? "s" : ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                <Button variant="ghost" icon={ArrowRight} onClick={() => selectedMatchForReport && openAppPath(`/statistiques?match=${selectedMatchForReport.id}`)} disabled={!selectedMatchForReport}>Stats</Button>
                <Button variant="ghost" icon={RefreshCw} onClick={() => duplicateReport(selected)} disabled={saving}>Dupliquer</Button>
                {canEditSelected && <Button variant="ghost" icon={Clipboard} onClick={() => editReport(selected)} disabled={saving}>Éditer</Button>}
                {canEditSelected && <Button variant="ghost" icon={Trash2} onClick={() => deleteReport(selected)} disabled={saving}>Supprimer</Button>}
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Games</p><p className="mt-1 text-lg font-black text-white">{selectedMatches.length}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">Record</p><p className="mt-1 text-lg font-black text-white">{selectedMatches.length ? `${selectedWins}W - ${selectedMatches.length - selectedWins}L` : "--"}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"><p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-400">WR</p><p className="mt-1 text-lg font-black text-white">{selectedMatches.length ? `${Math.round((selectedWins / Math.max(1, selectedMatches.length)) * 100)}%` : "--"}</p></div>
            </div>
            <div className="mt-5">
              <ReportPreview content={selected.content} rows={selectedRows} matches={matches} matchIds={reportMatchIds(selected)} />
            </div>
          </> : <EmptyState icon={FileText} title="Aucune review sélectionnée" text="Choisis une review dans la bibliothèque ou crée-en une nouvelle." />}
        </Surface>
      </div>

      {composerOpen && <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/72 px-3 py-6 backdrop-blur-xl sm:px-5">
        <div className="w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-cyan-200/22 bg-[#050814] shadow-[0_30px_120px_rgba(0,0,0,.75),0_0_48px_rgba(34,211,238,.16)]">
          <form onSubmit={saveReport} className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0"><Badge tone={form.id ? "yellow" : "green"}>{form.id ? "Modifier la review" : "Nouvelle review"}</Badge><h3 className="mt-3 break-words text-2xl font-black text-white sm:text-3xl">{formDisplayTitle || "Créer une review"}</h3><p className="mt-1 text-sm font-semibold text-slate-300">Cette fenêtre sert uniquement à créer ou modifier. La lecture reste derrière.</p></div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"><Button type="button" variant="ghost" icon={Clipboard} onClick={() => setLexiconOpen((value) => !value)}>Commandes</Button><Button type="button" variant="ghost" icon={X} onClick={() => { setComposerOpen(false); setLexiconOpen(false); resetReportForm(); }}>Fermer</Button><Button type="submit" icon={saving ? Loader2 : form.id ? Check : Plus} disabled={saving || !selectedTeamId || !formDisplayTitle.trim() || !form.content.trim()}>{form.id ? "Enregistrer" : "Créer"}</Button></div>
            </div>

            {lexiconOpen && <div className="mt-4 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.055] p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{commands.map(([command, text]) => <button key={command} type="button" onClick={() => insertCommand(command)} className="rounded-xl border border-white/10 bg-black/22 p-3 text-left transition hover:border-cyan-300/25 hover:bg-cyan-400/10"><p className="font-mono text-sm font-black text-cyan-100">{command}</p><p className="mt-1 text-xs font-semibold text-slate-300">{text}</p></button>)}</div></div>}

            <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Games liées</p><p className="mt-1 text-xs font-semibold text-slate-400">{selectionLabel}</p></div><Badge tone={form.matchIds.length ? "cyan" : "slate"}>{form.matchIds.length}</Badge></div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setSelectedArchiveId("")} className={cx("shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-black uppercase tracking-[0.12em] transition", !selectedArchiveId ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300")}>Toutes</button>{archives.map((archive) => { const ids = archiveMatchIds(archive); const active = selectedArchiveId === archive.id; return <button key={archive.id} type="button" onClick={() => useArchiveForReport(archive)} className={cx("min-w-[140px] shrink-0 rounded-xl border px-3 py-2 text-left transition", active ? "border-purple-300/40 bg-purple-400/12 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-purple-300/25")}><p className="truncate text-xs font-black text-white">{archive.name}</p><p className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">{ids.length} game{ids.length > 1 ? "s" : ""}</p></button>; })}</div>
                <div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="ghost" icon={Check} onClick={selectAllScopedMatches} disabled={!scopedMatches.length}>Tout lier</Button><Button type="button" variant="ghost" icon={X} onClick={() => setForm((current) => ({ ...current, matchIds: [] }))} disabled={!form.matchIds.length}>Vider</Button></div>
                <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">{scopedMatches.length ? scopedMatches.map((match) => { const checked = form.matchIds.includes(match.id); return <button key={match.id} type="button" onClick={() => toggleMatch(match.id)} className={cx("w-full rounded-xl border p-3 text-left transition", checked ? "border-cyan-300/40 bg-cyan-400/12" : "border-white/10 bg-white/[0.03] hover:border-cyan-300/22 hover:bg-white/[0.055]")}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Game"}</Badge>{checked && <Badge tone="cyan">Liée</Badge>}</div><p className="mt-2 truncate text-sm font-black text-white">{matchDisplayName(match)}</p><p className="mt-1 truncate text-xs font-semibold text-slate-400">{match.duration || "--:--"} · {match.side || "Side ?"}</p></div><span className={cx("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", checked ? "border-cyan-200 bg-cyan-300 text-slate-950" : "border-white/15 bg-black/30 text-transparent")}><Check className="h-3 w-3" /></span></div></button>; }) : <EmptyState icon={Swords} title="Aucune game" text="Importe une game ou retire le filtre actif." />}</div>
              </div>

              <div className="min-w-0 space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]"><TextInput label="Titre de secours" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} placeholder="Ex: Review scrim bloc 2" icon={FileText} /><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-400">Bilan sélection</p><p className="mt-2 text-xl font-black text-white">{reviewMatches.length ? `${reviewWins}W - ${reviewMatches.length - reviewWins}L` : "--"}</p><p className="mt-1 text-xs font-semibold text-slate-400">{reviewMatches.length ? `${Math.round((reviewWins / Math.max(1, reviewMatches.length)) * 100)}% winrate` : "Sélectionne des games"}</p></div></div>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Notes staff</span><textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder={`Décisions\n- Ce qu'on garde\n- Ce qu'on corrige\n- Action pour la prochaine game\n\n/KDA "ADC"`} required rows={18} className="min-h-[460px] w-full resize-y rounded-2xl border border-cyan-300/14 bg-black/[0.28] px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/45" /></label><div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-300">Preview live</p><Badge tone="slate">Live</Badge></div><ReportPreview content={form.content} rows={formRows} matches={matches} matchIds={form.matchIds} /></div></div>
              </div>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}

function VerifyEmailPage() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search || "").get("token") || "";
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    window.location.replace(`${API_BASE}/verify-email${query}`);
  }, []);

  return <div className="relative min-h-screen text-white"><AmbientBackground /><main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-10"><Surface glow className="w-full p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"><Loader2 className="h-6 w-6 animate-spin" /></div><h1 className="mt-5 text-3xl font-black text-white">Vérification en cours</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-300">On confirme ton adresse e-mail et on te redirige automatiquement.</p></Surface></main></div>;
}

function VerifiedPage({ navigate }) {
  const params = new URLSearchParams(window.location.search || "");
  const success = params.get("success") === "true";
  const error = params.get("error");
  const copy = success
    ? ["Email vérifié !", "Tu peux maintenant recevoir les notifications.", "green"]
    : error === "expired"
      ? ["Lien expiré", "Ce lien a expiré. Renvoie un email de vérification depuis tes paramètres.", "yellow"]
      : ["Lien invalide", "Lien invalide ou déjà utilisé.", "red"];
  const [title, text, tone] = copy;
  return <div className="relative min-h-screen text-white"><AmbientBackground /><main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-10"><Surface glow className="w-full p-6 text-center"><Badge tone={tone}>{success ? "Vérifié" : "Vérification"}</Badge><h1 className="mt-5 text-3xl font-black text-white">{title}</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{text}</p><div className="mt-6 flex justify-center"><Button icon={ArrowRight} onClick={() => navigate("/parametres")}>{success ? "Ouvrir mes paramètres" : "Retour aux paramètres"}</Button></div></Surface></main></div>;
}

function AccountSettings({ user, onUserUpdate, pushToast }) {
  const [profileForm, setProfileForm] = useState({ name: user?.name || user?.account_name || "", email: user?.email || "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [notificationForm, setNotificationForm] = useState({ notif_match: user?.notif_match !== false, notif_report: user?.notif_report !== false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);

  useEffect(() => {
    setProfileForm({ name: user?.name || user?.account_name || "", email: user?.email || "" });
  }, [user?.id, user?.name, user?.email, user?.account_name]);

  useEffect(() => {
    setNotificationForm({ notif_match: user?.notif_match !== false, notif_report: user?.notif_report !== false });
  }, [user?.id, user?.notif_match, user?.notif_report]);

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const result = await apiFetch("auth-update-profile", { method: "POST", body: JSON.stringify(profileForm) });
      onUserUpdate?.(result.user);
      pushToast?.({ type: "green", title: "Compte mis à jour", text: "Ton pseudo et ton e-mail sont enregistrés." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Mise à jour impossible", text: err.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      pushToast?.({ type: "red", title: "Confirmation incorrecte", text: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("auth-change-password", { method: "POST", body: JSON.stringify({ currentPassword: passwordForm.currentPassword, nextPassword: passwordForm.nextPassword }) });
      setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" });
      pushToast?.({ type: "green", title: "Mot de passe changé", text: "Ton compte NXT5 est à jour." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Changement impossible", text: err.message });
    } finally {
      setSavingPassword(false);
    }
  }

  async function resendVerificationEmail() {
    setResendingVerify(true);
    try {
      const result = await apiFetch("resend-verify-email", { method: "POST" });
      onUserUpdate?.(result.user);
      pushToast?.({ type: "green", title: "E-mail envoyé", text: "Un nouveau lien de vérification vient d’être envoyé." });
    } catch (err) {
      pushToast?.({ type: "red", title: "Envoi impossible", text: preciseErrorText(err, "email-verification") });
    } finally {
      setResendingVerify(false);
    }
  }

  async function updateNotifications(next) {
    const previous = notificationForm;
    setNotificationForm(next);
    setSavingNotifications(true);
    try {
      const result = await apiFetch("/api/user/notifications", { method: "PATCH", body: JSON.stringify(next) });
      onUserUpdate?.(result.user);
      pushToast?.({ type: "green", title: "Préférences enregistrées", text: "Tes notifications e-mail sont à jour." });
    } catch (err) {
      setNotificationForm(previous);
      pushToast?.({ type: "red", title: "Préférences non enregistrées", text: err.message });
    } finally {
      setSavingNotifications(false);
    }
  }

  return <div className="nxt5-data-dense min-w-0">
    <PageHeader eyebrow="Compte" title="Paramètres" subtitle="Modifie ton pseudo, ton e-mail de récupération et ton mot de passe NXT5." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
      <Surface glow className="p-5">
        <div className="flex items-start justify-between gap-3"><div><Badge tone="cyan">Identité</Badge><h3 className="mt-3 text-2xl font-black text-white">Pseudo et e-mail</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Ces informations servent à te reconnaître dans NXT5 et à récupérer ton compte.</p></div><Settings className="h-5 w-5 shrink-0 text-cyan-100" /></div>
        {user?.email && (user?.email_verified ? <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100"><Check className="h-4 w-4" />Email vérifié</div> : <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-black text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />Ton email n'est pas vérifié.</p><p className="mt-1 text-xs font-semibold leading-5 text-amber-50/80">Les notifications sont désactivées jusqu'à validation de ton adresse.</p></div><Button type="button" variant="ghost" icon={resendingVerify ? Loader2 : Mail} onClick={resendVerificationEmail} disabled={resendingVerify}>{resendingVerify ? "Envoi..." : "Renvoyer l'email de vérification"}</Button></div></div>)}
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <TextInput label="Pseudo" value={profileForm.name} onChange={(name) => setProfileForm((current) => ({ ...current, name }))} placeholder="Ton pseudo NXT5" required icon={UserPlus} />
          <TextInput label="E-mail" value={profileForm.email} onChange={(email) => setProfileForm((current) => ({ ...current, email }))} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
          <Button type="submit" icon={savingProfile ? Loader2 : Check} disabled={savingProfile || !profileForm.name.trim() || !profileForm.email.trim()}>{savingProfile ? "Enregistrement..." : "Enregistrer le compte"}</Button>
        </form>
      </Surface>

      <Surface className="p-5">
        <div className="flex items-start justify-between gap-3"><div><Badge tone="yellow">Sécurité</Badge><h3 className="mt-3 text-2xl font-black text-white">Mot de passe</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Choisis un mot de passe différent de l’actuel, avec au moins 8 caractères.</p></div><Shield className="h-5 w-5 shrink-0 text-amber-100" /></div>
        <form onSubmit={savePassword} className="mt-5 space-y-4">
          <TextInput label="Mot de passe actuel" value={passwordForm.currentPassword} onChange={(currentPassword) => setPasswordForm((current) => ({ ...current, currentPassword }))} placeholder="••••••••" type="password" required icon={Lock} />
          <TextInput label="Nouveau mot de passe" value={passwordForm.nextPassword} onChange={(nextPassword) => setPasswordForm((current) => ({ ...current, nextPassword }))} placeholder="8 caractères minimum" type="password" required icon={Shield} />
          <TextInput label="Confirmer" value={passwordForm.confirmPassword} onChange={(confirmPassword) => setPasswordForm((current) => ({ ...current, confirmPassword }))} placeholder="Répète le nouveau mot de passe" type="password" required icon={Check} />
          <Button type="submit" icon={savingPassword ? Loader2 : ShieldCheck} disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword}>{savingPassword ? "Mise à jour..." : "Changer le mot de passe"}</Button>
        </form>
      </Surface>

      <Surface className="p-5 xl:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone="purple">Notifications</Badge>
            <h3 className="mt-3 text-2xl font-black text-white">E-mails d'équipe</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Choisis les alertes envoyées sur ton adresse vérifiée.</p>
          </div>
          {savingNotifications && <Badge tone="cyan">Enregistrement...</Badge>}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <PremiumToggle checked={notificationForm.notif_match} onChange={(checked) => updateNotifications({ ...notificationForm, notif_match: checked })} title="Recevoir un email à chaque import de match" text="Pratique pour suivre les nouvelles games ajoutées à ta team." />
          <PremiumToggle checked={notificationForm.notif_report} onChange={(checked) => updateNotifications({ ...notificationForm, notif_report: checked })} title="Recevoir un email a chaque review generee" text="Tu es prevenu des qu'une nouvelle review d'equipe est disponible." />
        </div>
      </Surface>
    </div>
  </div>;
}

function MissingEmailModal({ user, onUserUpdate, pushToast }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch("auth-update-profile", { method: "POST", body: JSON.stringify({ name: user?.name || user?.account_name || "Compte NXT5", email }) });
      onUserUpdate(result.user);
      pushToast({ type: "green", title: "E-mail ajouté", text: "Un lien de vérification vient de t’être envoyé." });
    } catch (err) {
      setError(err.message || "Impossible d’ajouter cet e-mail.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 text-white backdrop-blur-xl">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-xl overflow-hidden rounded-[1.65rem] border border-cyan-300/25 bg-[#090d1a]/95 p-6 shadow-2xl shadow-black/50">
        <Badge tone="orange">Action requise</Badge>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-white">Ajoute ton e-mail de récupération</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Les anciens comptes n’avaient pas d’e-mail. Ajoute le tien maintenant pour recevoir les liens de mot de passe oublié.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <TextInput label="E-mail de récupération" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
          {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
          <Button type="submit" disabled={saving || !email.trim()} icon={saving ?Loader2 : Mail} className="w-full py-4">{saving ?"Enregistrement..." : "Enregistrer l’e-mail"}</Button>
        </form>
      </motion.div>
    </div>
  );
}

function EmailVerificationRequiredModal({ user, onUserUpdate, pushToast }) {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setSending(true);
    setError("");
    try {
      const result = await apiFetch("resend-verify-email", { method: "POST" });
      onUserUpdate?.(result.user);
      setSent(true);
      pushToast?.({ type: "green", title: "Lien envoyé", text: "Ouvre ta boîte mail puis clique sur le lien de vérification." });
    } catch (err) {
      setError(preciseErrorText(err, "email-verification"));
    } finally {
      setSending(false);
    }
  }

  async function refreshStatus() {
    setChecking(true);
    setError("");
    try {
      const result = await apiFetch("auth-me");
      onUserUpdate?.(result.user);
      if (result.user?.email_verified) {
        pushToast?.({ type: "green", title: "Email vérifié", text: "Ton profil est validé." });
      } else {
        setError("Ton email n'est pas encore vérifié. Clique sur le lien reçu par mail, puis réessaie.");
      }
    } catch (err) {
      setError(err.message || "Impossible de vérifier ton statut.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/78 px-4 text-white backdrop-blur-2xl">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-xl overflow-hidden rounded-[1.65rem] border border-amber-300/28 bg-[#090d1a]/96 p-6 shadow-2xl shadow-black/55">
        <Badge tone="orange">Vérification obligatoire</Badge>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-white">Vérifie ton profil</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Ton compte utilise l'adresse <span className="font-black text-white">{user?.email}</span>. Pour continuer à recevoir les notifications NXT5, confirme cette adresse avec le lien envoyé par e-mail.</p>
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />Profil non vérifié</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-50/80">Les notifications restent bloquées tant que l'e-mail n'est pas confirmé.</p>
        </div>
        {sent && <div className="mt-4 rounded-2xl border border-emerald-300/22 bg-emerald-400/10 p-3 text-sm font-bold leading-6 text-emerald-100">Lien envoyé. Clique dessus dans ta boîte mail, puis reviens ici vérifier le statut.</div>}
        {error && <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold leading-6 text-rose-100">{error}</div>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" icon={sending ? Loader2 : Mail} onClick={resend} disabled={sending || checking} className="w-full py-4">{sending ? "Envoi..." : sent ? "Renvoyer le lien" : "M'envoyer le lien"}</Button>
          <Button type="button" variant="ghost" icon={checking ? Loader2 : RefreshCw} onClick={refreshStatus} disabled={sending || checking} className="w-full py-4">{checking ? "Vérification..." : "J'ai vérifié mon email"}</Button>
        </div>
      </motion.div>
    </div>
  );
}

function AppLoadingScreen() {
  const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
  const stages = [
    ["Roster", Users],
    ["Games", Swords],
    ["Draft", Crown],
    ["Review", FileText],
    ["Prêt", Check],
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020511] px-4 py-6 text-white sm:px-6">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(103,232,249,.16),transparent_31%),radial-gradient(circle_at_78%_26%,rgba(217,70,239,.12),transparent_28%),linear-gradient(90deg,rgba(2,5,17,.76),transparent_34%,transparent_66%,rgba(2,5,17,.8))]" />
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.62, ease: "easeOut" }} className="relative z-10 flex w-full max-w-6xl flex-col items-center">
        <div className="nxt5-loader-kicker">
          <span />
          <p>Synchronisation NXT5</p>
        </div>

        <Nxt5Wordmark className="nxt5-loader-wordmark mt-6 h-16 w-full max-w-[24rem] object-center sm:h-20" />
        <h1 className="nxt5-loader-title mt-4 text-center text-3xl font-black leading-tight text-white sm:text-5xl">Préparation du terrain</h1>

        <div className="nxt5-loader-cinema mt-7 w-full">
          <div className="nxt5-loader-cinema-grid" />
          <div className="nxt5-loader-cinema-scan" />
          <div className="nxt5-loader-arena" aria-hidden="true">
            <span className="nxt5-loader-arena-ring nxt5-loader-arena-ring-one" />
            <span className="nxt5-loader-arena-ring nxt5-loader-arena-ring-two" />
            <span className="nxt5-loader-arena-ring nxt5-loader-arena-ring-three" />
            {roles.map((role, index) => (
              <span key={role} className={cx("nxt5-loader-role", `nxt5-loader-role-${index}`)} style={{ "--delay": `${index * 170}ms` }}>
                {role}
              </span>
            ))}
            {roles.map((role, index) => (
              <span key={`${role}-beam`} className={cx("nxt5-loader-beam", `nxt5-loader-beam-${index}`)} style={{ "--delay": `${index * 150}ms` }} />
            ))}
            <div className="nxt5-loader-core">
              <img src="/assets/nxt5-loader-favicon.png?v=1" alt="NXT5" />
            </div>
          </div>

          <div className="nxt5-loader-stages">
            {stages.map(([stage, Icon], index) => (
              <div key={stage} className="nxt5-loader-stage" style={{ "--delay": `${index * 170}ms` }}>
                <Icon className="h-4 w-4" />
                <span>{stage}</span>
              </div>
            ))}
            <span className="nxt5-loader-stage-line" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MainApp({ user, onLogout, onUserUpdate, pushToast, navigate, route }) {
  const initialPage = new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path);
  const [active, setActiveState] = useState(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [data, setData] = useState(DEFAULT_DATA);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [apiError, setApiError] = useState("");

  function setActive(pageId) {
    setActiveState(pageId);
    const keepInvite = pageId === "teams" && new URLSearchParams(window.location.search).has("invite");
    navigate(`${pathFromPage(pageId)}${keepInvite ?window.location.search : ""}`);
  }

  function openTeamCreation() {
    navigate("/equipes?create=1");
  }

  function openTeamManagement() {
    navigate("/gestion-equipe");
  }

  async function refreshAll() {
    setLoading(true); setApiError("");
    try { const result = await apiFetch("bootstrap"); setData({ ...DEFAULT_DATA, ...result }); if (!selectedTeamId && result.teams?.[0]?.id) setSelectedTeamId(result.teams[0].id); }
    catch (err) { setApiError(err.message || "Impossible de charger les données."); if (!bootstrapped) setData(DEFAULT_DATA); }
    finally { setLoading(false); setBootstrapped(true); }
  }
  async function logout() { try { await apiFetch("auth-logout", { method: "POST" }); } catch {} pushToast({ type: "cyan", title: "Déconnecté", text: "Tu es bien déconnecté." }); navigate("/connexion", { replace: true }); onLogout(); }
  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { setActiveState(new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path)); }, [route.path, route.search]);

  const currentTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0] || null;
  const currentMember = currentTeam ?(data.teamMembers || []).find((member) => member.team_id === currentTeam.id && member.user_id === user.id) : null;

  const page = useMemo(() => {
    if (active === "teams") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />;
    if (active === "team-management") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} managementOnly />;
    if (active === "matches" || active === "stats" || active === "reports") return <GameWorkspace data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} route={route} />;
    if (active === "trends") return <TrendsPage data={data} selectedTeamId={selectedTeamId} />;
    if (active === "champions") return <Champions data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "planning") return <Planning data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "compositions") return <Compositions data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "profile") return <PlayerUltimateProfile data={data} selectedTeamId={selectedTeamId} currentMember={currentMember} user={user} refreshAll={refreshAll} pushToast={pushToast} route={route} navigate={navigate} />;
    if (active === "account-settings") return <AccountSettings user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />;
    if (active === "guide") return <GuidePage />;
    return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />;
  }, [active, data, loading, selectedTeamId, currentMember, route.path, route.search, pushToast, user, onUserUpdate, navigate]);

  const linkedPlayer = currentTeam ?(data.players || []).find((player) => player.team_id === currentTeam.id && player.user_id === user.id) : null;
  if (!bootstrapped) return <AppLoadingScreen />;
  if (!data.teams.length) return <div className="relative min-h-screen text-white"><AmbientBackground /><main className="relative z-10 mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-8"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><img src="/assets/nxt5-mark.png?v=8" alt="NXT5" className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_22px_rgba(34,211,238,.45)] sm:h-14 sm:w-14" /><div className="min-w-0"><Nxt5Wordmark className="h-11 w-[13rem] max-w-[52vw] object-left sm:h-12 sm:w-[15rem]" /><p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-100/55 sm:tracking-[0.24em]">Team access</p></div></div><Button variant="ghost" icon={LogOut} onClick={logout} className="px-3 sm:px-4"><span className="hidden sm:inline">Déconnexion</span></Button></div><ApiBanner error={apiError} /><Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} /></main><LegalLinks navigate={navigate} />{!user?.email && <MissingEmailModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}{user?.email && user.email_verified === false && <EmailVerificationRequiredModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}</div>;
  return <div className="relative min-h-screen text-white"><AmbientBackground /><Sidebar active={active} setActive={setActive} open={sidebarOpen} setOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={user} currentMember={currentMember} linkedPlayer={linkedPlayer} onLogout={logout} /><div className={cx("relative z-10 transition-all duration-300", sidebarCollapsed ?"lg:pl-24" : "lg:pl-[19rem]")}><Topbar active={active} setOpen={setSidebarOpen} currentTeam={currentTeam} teams={data.teams} onSelectTeam={setSelectedTeamId} onCreateTeam={openTeamCreation} onManageTeam={openTeamManagement} /><main className="mx-auto w-full max-w-[1720px] px-3 py-5 sm:px-4 sm:py-7 lg:px-6 xl:px-8 2xl:px-10"><ApiBanner error={apiError} /><AnimatePresence mode="wait"><motion.div key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="min-w-0">{page}</motion.div></AnimatePresence></main><LegalLinks navigate={navigate} /></div>{!user?.email && <MissingEmailModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}{user?.email && user.email_verified === false && <EmailVerificationRequiredModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}</div>;
}

export default function NXT5() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [route, setRoute] = useState(readRoute);

  function navigate(path, options = {}) {
    const method = options.replace ?"replaceState" : "pushState";
    window.history[method]({}, "", path);
    setRoute(readRoute());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pushToast(toast) {
    const id = crypto.randomUUID ?crypto.randomUUID() : String(Date.now() + Math.random());
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4500);
  }
  function removeToast(id) { setToasts((current) => current.filter((item) => item.id !== id)); }
  function handleAuth(nextUser) {
    setUser(nextUser);
  }

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let mounted = true;
    apiFetch("auth-me").then((result) => { if (mounted) setUser(result.user); }).catch(() => { if (mounted) setUser(null); }).finally(() => { if (mounted) setCheckingSession(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const navTitle = route.path === "/mon-profil" || route.path.startsWith("/mon-profil/")
      ? `Profil > ${profileViewLabel(profileViewFromPath(route.path))}`
      : ["/integration", "/statistiques", "/rapports"].includes(route.path)
        ? `Games & review > ${gameWorkspaceSectionLabel(gameWorkspaceSectionFromPath(route.path))}`
      : NAV.find((item) => item.path === route.path)?.label;
    const publicTitles = {
      "/": "NXT5",
      "/connexion": "Connexion — NXT5",
      "/creer-un-compte": "Créer un compte — NXT5",
      "/inscription": "Créer un compte — NXT5",
      "/mot-de-passe-oublie": "Mot de passe oublié — NXT5",
      "/reinitialiser-mot-de-passe": "Réinitialiser le mot de passe — NXT5",
      "/verify-email": "Vérification e-mail — NXT5",
      "/verified": "E-mail vérifié — NXT5",
      "/mentions-legales": "Mentions légales — NXT5",
      "/confidentialite": "Confidentialité — NXT5",
      "/conditions": "Conditions — NXT5",
      "/contact": "Contact — NXT5",
    };
    document.title = publicTitles[route.path] || (navTitle ?`${navTitle} — NXT5` : "NXT5");
  }, [route.path]);

  useEffect(() => {
    if (!checkingSession && user && (route.path === "/" || authModeFromPath(route.path))) {
      navigate("/equipes", { replace: true });
    }
  }, [checkingSession, user, route.path]);

  useEffect(() => {
    if (checkingSession || user || !isAppPath(route.path)) return;
    const params = new URLSearchParams(route.search);
    if (route.path === "/equipes" && params.has("invite")) {
      navigate(`/creer-un-compte?invite=${encodeURIComponent(params.get("invite"))}`, { replace: true });
      return;
    }
    navigate(buildLoginRedirect(route.path, route.search), { replace: true });
  }, [checkingSession, user, route.path, route.search]);

  if (checkingSession) return <AppLoadingScreen />;

  const inviteMode = new URLSearchParams(route.search).has("invite") ?"register" : null;
  const mode = authModeFromPath(route.path) || inviteMode;
  const routeIsPrivate = isAppPath(route.path);
  const unknownRoute = !isKnownPath(route.path);
  const view = unknownRoute
    ?<NotFoundPage navigate={navigate} />
      : LEGAL_PAGES[route.path]
      ?<LegalPage route={route} navigate={navigate} user={user} />
      : route.path === "/verify-email"
        ?<VerifyEmailPage />
      : route.path === "/verified"
        ?<VerifiedPage navigate={navigate} />
      : user
      ?<MainApp user={user} onLogout={() => setUser(null)} onUserUpdate={setUser} pushToast={pushToast} navigate={navigate} route={route} />
      : route.path === "/mot-de-passe-oublie"
        ?<ForgotPasswordPage navigate={navigate} />
      : route.path === "/reinitialiser-mot-de-passe"
        ?<ResetPasswordPage navigate={navigate} />
      : mode
        ?<AuthPage mode={mode} onAuth={handleAuth} pushToast={pushToast} navigate={navigate} />
        : routeIsPrivate
          ?<AuthPage mode="login" onAuth={handleAuth} pushToast={pushToast} navigate={navigate} />
          : <HomeScreen navigate={navigate} />;

  return <>{view}<ToastStack toasts={toasts} removeToast={removeToast} /></>;
}
