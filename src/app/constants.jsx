import {
  Activity,
  BarChart3,
  CalendarDays,
  Crown,
  FileText,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";

const NXT5_IMPORTER_VERSION = "0.2.10";
const NXT5_IMPORTER_RELEASE_URL = "https://github.com/AshaiiTV/NXT5/releases/download/nxt5-match-exporter-latest";

export const NXT5_IMPORTER_WINDOWS_URL = `${NXT5_IMPORTER_RELEASE_URL}/NXT5-Importer-Windows-${NXT5_IMPORTER_VERSION}.exe`;
export const NXT5_IMPORTER_MAC_URL = `${NXT5_IMPORTER_RELEASE_URL}/NXT5-Importer-Mac-arm64-${NXT5_IMPORTER_VERSION}.zip`;

export const NAV = [
  { id: "teams", label: "Équipe", hint: "Roster et accès", icon: Users, shortcut: "T", path: "/equipes" },
  { id: "matches", label: "Games", hint: "Importer, lire, review", icon: Swords, shortcut: "G", path: "/integration" },
  { id: "stats", label: "Statistiques", hint: "Lecture détaillée", icon: BarChart3, shortcut: "S", path: "/statistiques" },
  { id: "trends", label: "Tendances", hint: "Comprendre l'équipe", icon: Activity, shortcut: "N", path: "/tendances" },
  { id: "champions", label: "Pool équipe", hint: "Picks par joueur", icon: Crown, shortcut: "C", path: "/champion-pool" },
  { id: "planning", label: "Planning", hint: "Dispos et sessions", icon: CalendarDays, shortcut: "L", path: "/planning" },
  { id: "compositions", label: "Compos", hint: "Drafts préparées", icon: Sparkles, shortcut: "V", path: "/compositions-types" },
  { id: "reports", label: "Review", hint: "Décisions staff", icon: FileText, shortcut: "R", path: "/rapports" },
  { id: "profile", label: "Profil", hint: "Ton espace joueur", icon: Activity, shortcut: "P", path: "/mon-profil" },
  { id: "account-settings", label: "Paramètres", icon: Settings, shortcut: "P", path: "/parametres", hidden: true },
  { id: "team-management", label: "Gestion équipe", icon: Settings, shortcut: "G", path: "/gestion-equipe", hidden: true },
  { id: "admin", label: "Administration", hint: "Vue plateforme", icon: ShieldCheck, shortcut: "D", path: "/admin", hidden: true },
];

export const PRIMARY_NAV_IDS = ["teams", "matches", "planning", "profile"];
export const MORE_NAV_IDS = ["trends", "champions", "compositions"];

export const PROFILE_VIEW_ROUTES = [
  { id: "overview", label: "Synthèse", path: "" },
  { id: "champions", label: "Champions", path: "champions" },
  { id: "pool", label: "Pool", path: "pool" },
  { id: "history", label: "Historique", path: "historique" },
  { id: "coaching", label: "Coaching", path: "coaching" },
];

export const AUTH_ROUTES = {
  "/connexion": "login",
  "/creer-un-compte": "register",
  "/inscription": "register",
};

export const PUBLIC_ROUTES = ["/", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/verify-email", "/verified", "/mentions-legales", "/confidentialite", "/cookies", "/conditions", "/reglement", "/contact"];
export const AUTH_PATHS = Object.keys(AUTH_ROUTES);
export const REMEMBER_ME_STORAGE_KEY = "nxt5_remember_me";
export const DISCORD_INVITE_URL = "https://discord.gg/esPcQAeNWu";

export const PLANNING_DAYS = [
  ["MON", "Lun"],
  ["TUE", "Mar"],
  ["WED", "Mer"],
  ["THU", "Jeu"],
  ["FRI", "Ven"],
  ["SAT", "Sam"],
  ["SUN", "Dim"],
];

export const PLANNING_EVENT_TYPES = [
  { id: "scrim", label: "Scrim", dot: "bg-fuchsia-100 shadow-[0_0_16px_rgba(240,171,252,.92)]", cell: "bg-[#2a123f] text-fuchsia-50 shadow-[inset_0_0_0_1px_rgba(240,171,252,.28),inset_0_0_24px_rgba(217,70,239,.18)]" },
  { id: "match", label: "Match", dot: "bg-emerald-200 shadow-[0_0_12px_rgba(167,243,208,.72)]", cell: "bg-[#0e3329] text-emerald-50 shadow-[inset_0_0_0_1px_rgba(110,231,183,.2)]" },
  { id: "review", label: "Review", dot: "bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,.72)]", cell: "bg-[#3a2b10] text-amber-50 shadow-[inset_0_0_0_1px_rgba(253,230,138,.2)]" },
];

export const PLANNING_TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];

export const DEFAULT_DATA = {
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
  playerGoals: [],
};
