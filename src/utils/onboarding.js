import { sortTrendMatches } from "./trends.js";
import { availabilitySlots } from "./planning.js";

const MANAGE_ROLES = new Set(["captain", "coach", "assistant", "analyst", "manager", "board"]);
const sameId = (a, b) => a != null && b != null && String(a) !== "" && String(a) === String(b);

export function canManageOnboarding({ currentTeam, currentMember, user } = {}) {
  return Boolean(currentTeam && user && (sameId(currentTeam.owner_id, user.id)
    || (sameId(currentMember?.team_id, currentTeam.id) && sameId(currentMember?.user_id, user.id)
      && MANAGE_ROLES.has(String(currentMember.role || "").toLowerCase()))));
}

/** Team milestones come from the server; discovered only stores personal UI visits. */
export function getOnboardingSteps({ data = {}, currentTeam, currentMember, user, discovered = [] } = {}) {
  if (!currentTeam?.id) return [];
  const teamRows = (key) => (data[key] || []).filter(row => sameId(row.team_id, currentTeam.id));
  const matches = sortTrendMatches(teamRows("matches").filter(row => row.id));
  const reports = [...teamRows("reports")].filter(row => row.id).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const latestMatch = matches[0];
  const latestReport = reports[0];
  const matchPath = latestMatch ? `/games?match=${encodeURIComponent(latestMatch.id)}` : "";
  const reportPath = latestReport ? `/rapports?report=${encodeURIComponent(latestReport.id)}` : "";
  const seen = (id) => discovered.includes(id);
  const manager = canManageOnboarding({ currentTeam, currentMember, user });
  if (manager) return [
    { id: "matches", label: "Importer", title: "Ajoute ta première partie", description: "Récupère le fichier d’une partie avec NXT5 Importer, puis ajoute-le ici.",
      detail: matches.length ? "Première partie ajoutée" : "Les profils peuvent être créés pendant l’import.",
      done: Boolean(latestMatch), disabled: false, action: "Importer une partie", path: "/games?import=1", help: "imports-and-games" },
    { id: "reading", label: "Résumé", title: "Ouvre le résumé de ta partie", description: "Commence par le résultat et les écarts entre les équipes. Garde un point à discuter pour le débrief.",
      detail: seen("reading") ? "Résumé ouvert" : "Un premier regard sur votre jeu.",
      done: Boolean(latestMatch && seen("reading")), disabled: !latestMatch, action: "Voir ma partie", path: matchPath, help: "statistics", reason: !latestMatch ? "Le résumé sera disponible après ton premier import." : "" },
    { id: "reports", label: "Débriefer", title: "Prépare ton premier débrief", description: "Note ce que l’équipe garde, ce qu’elle corrige et une action à travailler à la prochaine séance.",
      detail: latestReport ? "Premier débrief enregistré" : "Un point concret pour la prochaine séance.",
      done: Boolean(latestReport), disabled: !latestMatch && !latestReport, action: latestReport ? "Voir le débrief" : "Préparer le débrief",
      path: reportPath || (latestMatch ? `/rapports?match=${encodeURIComponent(latestMatch.id)}&compose=1` : ""), help: "reviews", reason: !latestMatch && !latestReport ? "Importe une partie pour préparer le débrief." : "" },
  ];
  const player = teamRows("players").find(row => sameId(row.user_id, user?.id));
  const hasAvailability = player && teamRows("availability").some(row => sameId(row.player_id, player.id)
    && (String(row.notes || "").trim() || Object.values(availabilitySlots(row.slots)).some(times => times.length)));
  return [
    { id: "profile", label: "Mon profil", title: "Fais connaissance avec ton espace", description: "Ton profil rassemble tes champions, tes parties et les points à travailler avec ton coach.",
      detail: seen("profile") ? "Profil ouvert" : player ? "Ton profil est relié à ton compte." : "Ton profil doit être relié par le responsable.",
      done: Boolean(player && seen("profile")), disabled: !player, action: "Ouvrir mon profil", path: player ? `/mon-profil?player=${encodeURIComponent(player.id)}` : "", help: "player-profile",
      reason: !player ? "Demande au responsable de relier ton compte NXT5 à ton profil joueur dans la gestion de l’équipe." : "" },
    { id: "planning", label: "Dispos", title: "Prépare ta prochaine séance", description: "Indique quand tu peux jouer. Ton équipe pourra organiser les entraînements en fonction de vos disponibilités.",
      detail: hasAvailability ? "Disponibilités renseignées" : "Choisis tes créneaux dans le planning.",
      done: Boolean(hasAvailability), disabled: !player, action: "Donner mes disponibilités", path: player ? "/planning" : "", help: "planning", reason: !player ? "Tes disponibilités seront accessibles une fois ton profil relié." : "" },
    { id: "team-review", label: "Notre jeu", title: latestReport ? "Retrouve le débrief de ton équipe" : "Découvre une partie de ton équipe", description: latestReport ? "Retrouve les observations du staff et les points à travailler ensemble." : "Ouvre une partie pour découvrir son résumé et les résultats de l’équipe.",
      detail: seen("team-review") ? "Espace de l’équipe ouvert" : "Les mêmes repères pour toute l’équipe.",
      done: Boolean((latestMatch || latestReport) && seen("team-review")), disabled: !latestMatch && !latestReport, action: latestReport ? "Ouvrir le débrief" : "Voir une partie", path: reportPath || matchPath,
      help: latestReport ? "reviews" : "statistics", reason: !latestMatch && !latestReport ? "Le staff prépare les premières parties. Tu les retrouveras ici dès leur import." : "" },
  ];
}

/** Record only real, team-scoped destinations. Opening a menu never completes a visit. */
export function onboardingVisitsForRoute({ route, data = {}, currentTeam, user } = {}) {
  if (!currentTeam?.id || !route) return [];
  const params = new URLSearchParams(route.search || "");
  const inTeam = (key, id) => id && (data[key] || []).some(row => sameId(row.team_id, currentTeam.id) && sameId(row.id, id));
  if (["/games", "/integration", "/statistiques"].includes(route.path) && inTeam("matches", params.get("match"))) return ["reading", "team-review"];
  if (route.path === "/rapports" && params.get("compose") !== "1" && inTeam("reports", params.get("report"))) return ["team-review"];
  if (route.path === "/mon-profil" || route.path.startsWith("/mon-profil/")) {
    const linked = (data.players || []).find(row => sameId(row.team_id, currentTeam.id) && sameId(row.user_id, user?.id));
    if (linked && (!params.get("player") || sameId(linked.id, params.get("player")))) return ["profile"];
  }
  return [];
}
