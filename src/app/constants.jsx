import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  FileText,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";

const NXT5_IMPORTER_DOWNLOAD_URL = "/.netlify/functions/importer-download";

export const NXT5_IMPORTER_WINDOWS_URL = `${NXT5_IMPORTER_DOWNLOAD_URL}?platform=windows&arch=x64`;
export const NXT5_IMPORTER_MAC_URL = `${NXT5_IMPORTER_DOWNLOAD_URL}?platform=mac&arch=arm64`;
export const NXT5_IMPORTER_MAC_INTEL_URL = `${NXT5_IMPORTER_DOWNLOAD_URL}?platform=mac&arch=x64`;

export const NAV = [
  { id: "teams", label: "Équipe", hint: "Retrouver tes joueurs", icon: Users, shortcut: "T", path: "/equipes" },
  { id: "matches", label: "Parties", hint: "Importer et revoir une partie", icon: Swords, shortcut: "G", path: "/games" },
  { id: "bot-discord", label: "Bot Discord", hint: "Connexion et publications", icon: Bot, path: "/bot-discord" },
  { id: "trends", label: "Analyses", hint: "Suivre plusieurs parties", icon: Activity, shortcut: "N", path: "/tendances" },
  { id: "planning", label: "Planning", hint: "Organiser les séances", icon: CalendarDays, shortcut: "L", path: "/planning" },
  { id: "draft", label: "Draft", hint: "Choisir les champions", icon: Sparkles, shortcut: "D", path: "/draft/pool" },
  { id: "reports", label: "Débriefs", hint: "Noter les points à travailler", icon: FileText, shortcut: "R", path: "/rapports" },
  { id: "profile", label: "Mon profil", hint: "Suivre ta progression", icon: Activity, shortcut: "P", path: "/mon-profil" },
  { id: "guide", label: "Guide d’utilisation", hint: "Les étapes et les mots utiles", icon: BookOpen, shortcut: "A", path: "/guide", hidden: true },
  { id: "account-settings", label: "Paramètres", icon: Settings, shortcut: "P", path: "/parametres", hidden: true },
  { id: "team-management", label: "Gestion équipe", icon: Settings, shortcut: "G", path: "/gestion-equipe", hidden: true },
  { id: "audience", label: "Fréquentation", hint: "Audience et conversions", icon: BarChart3, path: "/admin/frequentation", hidden: true },
  { id: "admin", label: "Administration", hint: "Vue plateforme", icon: ShieldCheck, shortcut: "D", path: "/admin", hidden: true },
  { id: "access-requests", label: "Demandes d’accès", hint: "Validation des offres", icon: Users, path: "/admin/demandes-acces", hidden: true },
  { id: "account-subscriptions", label: "Profils et abonnements", hint: "Attributions manuelles", icon: Users, path: "/admin/abonnements", hidden: true },
];

export const PRIMARY_NAV_IDS = ["teams", "matches", "planning", "profile"];
export const MORE_NAV_IDS = ["reports", "trends", "draft", "bot-discord"];

export const DRAFT_VIEW_ROUTES = [
  { id: "pool", label: "Champion Pool", path: "pool" },
  { id: "compositions", label: "Compositions", path: "compositions" },
];

export const PROFILE_VIEW_ROUTES = [
  { id: "overview", label: "Synthèse", path: "" },
  { id: "champions", label: "Champions", path: "champions" },
  { id: "pool", label: "Pool déclaré", path: "pool" },
  { id: "history", label: "Historique", path: "historique" },
  { id: "coaching", label: "Suivi", path: "coaching" },
];

export const AUTH_ROUTES = {
  "/connexion": "login",
  "/creer-un-compte": "register",
  "/inscription": "register",
};

export const PUBLIC_ROUTES = ["/", "/fonctionnalites", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/verify-email", "/verified", "/mentions-legales", "/confidentialite", "/cookies", "/conditions", "/reglement", "/contact", "/reseaux", "/soutenir"];
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
  { id: "scrim", label: "Scrim", dot: "bg-fuchsia-200", cell: "bg-fuchsia-400/10 text-fuchsia-100" },
  { id: "match", label: "Match", dot: "bg-cyan-200", cell: "bg-cyan-400/10 text-cyan-100" },
  { id: "review", label: "Review", dot: "bg-violet-200", cell: "bg-violet-400/10 text-violet-100" },
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
