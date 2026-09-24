import { rosterPlayersByStatus } from "./roster.js";
import { sortTrendMatches } from "./trends.js";

const MAIN_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const GAMEPLAY_ROLES = new Set([...MAIN_ROLES, "SUB"]);
// Keep these aligned with players-create and matches-import-file authorization.
const MANAGE_ROLES = new Set(["captain", "coach", "assistant", "analyst", "manager", "board"]);
const ROSTER_PATH = "/gestion-equipe?section=roster";
const STAFF_REASON = "Le capitaine ou le staff peut ajouter les joueurs et importer les parties.";
const IMPORT_ROSTER_REASON = "Ajoute au moins 5 profils joueurs distincts pour importer une partie.";

const sameId = (left, right) => left != null && right != null && String(left) !== "" && String(left) === String(right);

/** Actions and completion use only the active team's data and the current account's access. */
export function getOnboardingSteps({ data = {}, currentTeam, currentMember, user } = {}) {
  if (!currentTeam?.id) return [];
  const forTeam = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => sameId(row?.team_id, currentTeam.id));
  const players = forTeam(data.players);
  const matches = forTeam(data.matches).filter((match) => match.id);
  const reports = forTeam(data.reports).filter((report) => report.id);
  const isOwner = sameId(currentTeam.owner_id, user?.id);
  const isMember = sameId(currentMember?.team_id, currentTeam.id) && sameId(currentMember?.user_id, user?.id);
  const canManage = isOwner || (isMember && MANAGE_ROLES.has(String(currentMember.role || "").toLowerCase()));
  const canReview = isOwner || isMember;
  const mainRoles = new Set(rosterPlayersByStatus(players, "MAIN")
    .map((player) => String(player.role || "").toUpperCase())
    .filter((role) => MAIN_ROLES.includes(role)));
  // ImportGameFlow accepts five distinct gameplay profiles, including substitutes
  // and profiles outside Main Team. Completing the main lineup is a separate goal.
  const importPlayerIds = new Set(players
    .filter((player) => player.id && GAMEPLAY_ROLES.has(String(player.role || "").toUpperCase()))
    .map((player) => String(player.id)));
  const importReady = importPlayerIds.size >= 5;
  const rosterDone = mainRoles.size === MAIN_ROLES.length;

  function importAction() {
    if (canManage) return importReady
      ? { action: "Importer une partie", path: "/games?import=1", disabled: false, reason: "" }
      : { action: "Ajouter les joueurs", path: ROSTER_PATH, disabled: false, reason: IMPORT_ROSTER_REASON };
    return { action: "Importer une partie", path: "", disabled: true, reason: STAFF_REASON };
  }

  const latestMatch = sortTrendMatches(matches)[0];
  const firstReport = reports[0];
  const reviewAction = firstReport
    ? { action: "Voir le débrief", path: `/rapports?report=${encodeURIComponent(firstReport.id)}`, disabled: false, reason: "" }
    : !latestMatch
      ? { action: "Créer un débrief", path: "", disabled: true, reason: "Importe une partie pour préparer le débrief." }
      : canReview
        ? { action: "Créer un débrief", path: `/rapports?match=${encodeURIComponent(latestMatch.id)}&compose=1`, disabled: false, reason: "" }
        : { action: "Créer un débrief", path: "", disabled: true, reason: "Rejoins cette équipe pour créer un débrief." };

  return [
    {
      id: "teams", label: "Joueurs", detail: `${mainRoles.size} / 5 postes renseignés`, done: rosterDone,
      action: canManage && !rosterDone ? "Ajouter les joueurs" : "Voir les joueurs",
      path: canManage && !rosterDone ? ROSTER_PATH : "/equipes",
      disabled: !canManage && !rosterDone,
      reason: !canManage && !rosterDone ? STAFF_REASON : "",
    },
    {
      id: "matches", label: "Première partie", detail: `${matches.length} partie${matches.length > 1 ? "s" : ""} importée${matches.length > 1 ? "s" : ""}`,
      done: matches.length >= 1,
      ...(matches.length >= 1
        ? { action: "Voir les parties", path: "/games", disabled: false, reason: "" }
        : importAction()),
    },
    {
      id: "trends", label: "Premières analyses", detail: `${Math.min(matches.length, 3)} / 3 parties importées`, done: matches.length >= 3,
      ...(matches.length >= 3
        ? { action: "Voir les analyses", path: "/tendances", disabled: false, reason: "" }
        : importAction()),
    },
    {
      id: "reports", label: "Premier débrief", detail: `${reports.length} débrief${reports.length > 1 ? "s" : ""} créé${reports.length > 1 ? "s" : ""}`,
      done: reports.length >= 1, ...reviewAction,
    },
  ];
}
