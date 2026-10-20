import { en as home } from './home-overrides.js';
import base from './messages/en.json' with { type: 'json' };
import { en as quality } from './quality-overrides.js';
import { en as reviewed } from './overrides.js';
import { en as components } from './component-overrides.js';
import { en as interfaceCopy } from './overrides-ui.js';
import { en as showcase } from './showcase-overrides.js';
import { en as draftAssistance } from './draft-assistance-overrides.js';
import { en as opponents } from './opponents-overrides.js';
import { en as groupOpponents } from './group-opponents-overrides.js';
import { en as draftIntelligence } from './draft-intelligence-overrides.js';
import { en as helpFeatures } from './help-features-overrides.js';
import { en as playerComparison } from './player-comparison-overrides.js';
import { en as socialCalendar } from './social-calendar-overrides.js';
const teamManagement = {
  "Effectif": "Roster",
  "Titulaires": "Starters",
  "Encadrement": "Staff",
  "Hors effectif actif": "Outside the active roster",
  "Poste ou fonction": "Position or role",
  "Nom visible": "Display name",
  "Accès de {0}": "Access for {0}",
  "Corrige le nom, le Riot ID ou l’OP.GG du profil.": "Edit the profile's name, Riot ID or OP.GG.",
  "Profils joueurs : {0}/5 minimum. Les membres du staff ne comptent pas parmi ces cinq joueurs.": "Player profiles: {0}/5 minimum. Staff members do not count towards these five players.",
  "Invitations et accès": "Invitations and access",
  "Ajouter un profil": "Add a profile",
  "Fermer l’ajout": "Close form",
  "Crée son profil ici. Tu pourras ensuite l’associer à son compte NXT5.": "Create their profile here. You can then link it to their NXT5 account.",
  "Modifier {0}": "Edit {0}",
  "Compte NXT5 associé": "Linked NXT5 account",
  "Associe le compte de connexion à ce profil. Ce choix est enregistré immédiatement.": "Link the sign-in account to this profile. This change is saved immediately.",
  "Retirer ce profil": "Remove this profile",
  "Le profil sera supprimé de l’effectif. Pour le conserver, choisis « Hors effectif actif ».": "The profile will be deleted from the roster. To keep it, choose “Outside the active roster”.",
  "Supprimer le profil": "Delete profile",
  "Inviter dans l’équipe": "Invite to the team",
  "Comptes de l’équipe": "Team accounts",
  "Ces comptes peuvent se connecter à l’espace d’équipe. Les droits sont enregistrés dès leur modification.": "These accounts can access the team workspace. Changes to permissions are saved immediately.",
  "Seuls le propriétaire, le capitaine et le manager peuvent créer une invitation.": "Only the owner, captain and manager can create an invitation.",
  "Seuls le propriétaire et le capitaine peuvent modifier les droits d’accès.": "Only the owner and captain can change access permissions.",
  "Profil associé : {0}": "Linked profile: {0}",
  "Aucun profil associé": "No linked profile",
  "Propriétaire": "Owner",
  "Droit d’accès": "Access role",
  "Retirer l’accès": "Remove access",
  "Ce compte ne pourra plus accéder à l’équipe. Son profil joueur sera conservé.": "This account will no longer have access to the team. Its player profile will be kept.",
  "Retirer l’accès de {0}": "Remove access for {0}",
  "Aucun compte dans cette équipe. Partage une invitation pour commencer.": "This team has no accounts yet. Share an invitation to get started.",
  "Pour associer un compte à un joueur, ouvre « Modifier » sur son profil dans Effectif.": "To link an account to a player, select “Edit” on their profile in Roster.",
  "Le nom, le tag et l’image affichés dans votre espace.": "The name, tag and image shown in your workspace.",
  "Enregistrer l’équipe": "Save team",
  "Seuls le propriétaire, le capitaine et le manager peuvent modifier l’identité de l’équipe.": "Only the owner, captain and manager can edit the team identity.",
  "Supprimer l’équipe": "Delete team",
  "Cette suppression est définitive : profils, parties, débriefs et invitations seront supprimés.": "This is permanent: profiles, games, debriefs and invitations will be deleted.",
  "Supprimer définitivement l’équipe": "Permanently delete team",
  "Gère l’effectif, les invitations et les informations de ton équipe.": "Manage your team's roster, invitations and details.",
};
export default { ...base, ...quality, ...reviewed, ...components, ...interfaceCopy, ...showcase, ...draftAssistance, ...opponents, ...groupOpponents, ...draftIntelligence, ...helpFeatures, ...home, ...teamManagement, ...playerComparison, ...socialCalendar,
  "Tuto vidéo : importer une partie sur Windows": "Video tutorial: import a game on Windows",
  "YouTube · 2 min 31 · En français · Nouvel onglet": "YouTube · 2 min 31 · In French · New tab",
};
