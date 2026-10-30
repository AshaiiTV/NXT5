import { es as adminTeams } from "./admin-team-overrides.js";
import { es as compositions } from './composition-overrides.js';
import { es as home } from './home-overrides.js';
import base from './messages/es.json' with { type: 'json' };
import { es as quality } from './quality-overrides.js';
import { es as reviewed } from './overrides.js';
import { es as components } from './component-overrides.js';
import { es as interfaceCopy } from './overrides-ui.js';
import { es as showcase } from './showcase-overrides.js';
import { es as draftAssistance } from './draft-assistance-overrides.js';
import { es as opponents } from './opponents-overrides.js';
import { es as groupOpponents } from './group-opponents-overrides.js';
import { es as draftIntelligence } from './draft-intelligence-overrides.js';
import { es as helpFeatures } from './help-features-overrides.js';
import { es as playerComparison } from './player-comparison-overrides.js';
import { es as socialCalendar } from './social-calendar-overrides.js';
import { es as matchRecap } from './match-recap-overrides.js';
import { es as debrief } from './debrief-overrides.js';
const teamManagement = {
  "Effectif": "Plantilla",
  "Encadrement": "Cuerpo técnico",
  "Hors effectif actif": "Fuera de la plantilla activa",
  "Riot ID": "Riot ID",
  "Riot ID manquant": "Falta el Riot ID",
  "Horizontal": "Horizontal",
  "Vertical": "Vertical",
  "Profils joueurs : {0}/5 minimum. Les membres du staff ne comptent pas parmi ces cinq joueurs.": "Perfiles de jugadores: {0}/5 como mínimo. Los miembros del cuerpo técnico no cuentan entre estos cinco jugadores.",
  "Les profils joueurs sont prêts. Tu pourras vérifier qui a joué avant d’enregistrer la partie.": "Los perfiles de los jugadores están listos. Podrás comprobar quién jugó antes de guardar la partida.",
  "Invitations et accès": "Invitaciones y acceso",
  "Ajouter un profil": "Añadir un perfil",
  "Fermer l’ajout": "Cerrar formulario",
  "Crée son profil ici. Tu pourras ensuite l’associer à son compte NXT5.": "Crea su perfil aquí. Después podrás vincularlo a su cuenta de NXT5.",
  "Modifier {0}": "Editar {0}",
  "Compte NXT5 associé": "Cuenta de NXT5 vinculada",
  "Associe le compte de connexion à ce profil. Ce choix est enregistré immédiatement.": "Vincula la cuenta de inicio de sesión a este perfil. El cambio se guarda inmediatamente.",
  "Retirer ce profil": "Retirar este perfil",
  "Le profil sera supprimé de l’effectif. Pour le conserver, choisis « Hors effectif actif ».": "El perfil se eliminará de la plantilla. Para conservarlo, elige «Fuera de la plantilla activa».",
  "Supprimer le profil": "Eliminar perfil",
  "Inviter dans l’équipe": "Invitar al equipo",
  "Comptes de l’équipe": "Cuentas del equipo",
  "Ces comptes peuvent se connecter à l’espace d’équipe. Les droits sont enregistrés dès leur modification.": "Estas cuentas pueden acceder al espacio del equipo. Los cambios en los permisos se guardan inmediatamente.",
  "Seuls le propriétaire, le capitaine et le manager peuvent créer une invitation.": "Solo el propietario, el capitán y el mánager pueden crear una invitación.",
  "Seuls le propriétaire et le capitaine peuvent modifier les droits d’accès.": "Solo el propietario y el capitán pueden cambiar los permisos de acceso.",
  "Profil associé : {0}": "Perfil vinculado: {0}",
  "Aucun profil associé": "Ningún perfil vinculado",
  "Propriétaire": "Propietario",
  "Droit d’accès": "Rol de acceso",
  "Retirer l’accès": "Retirar acceso",
  "Ce compte ne pourra plus accéder à l’équipe. Son profil joueur sera conservé.": "Esta cuenta ya no podrá acceder al equipo. Su perfil de jugador se conservará.",
  "Retirer l’accès de {0}": "Retirar el acceso de {0}",
  "Aucun compte dans cette équipe. Partage une invitation pour commencer.": "Este equipo aún no tiene cuentas. Comparte una invitación para empezar.",
  "Pour associer un compte à un joueur, ouvre « Modifier » sur son profil dans Effectif.": "Para vincular una cuenta a un jugador, selecciona «Editar» en su perfil en Plantilla.",
  "Le nom, le tag et l’image affichés dans votre espace.": "El nombre, la etiqueta y la imagen que aparecen en tu espacio.",
  "Enregistrer l’équipe": "Guardar equipo",
  "Seuls le propriétaire, le capitaine et le manager peuvent modifier l’identité de l’équipe.": "Solo el propietario, el capitán y el mánager pueden editar la identidad del equipo.",
  "Supprimer l’équipe": "Eliminar equipo",
  "Cette suppression est définitive : profils, parties, débriefs et invitations seront supprimés.": "Esta acción es definitiva: se eliminarán los perfiles, las partidas, los análisis y las invitaciones.",
  "Supprimer définitivement l’équipe": "Eliminar equipo definitivamente",
  "Gère l’effectif, les invitations et les informations de ton équipe.": "Gestiona la plantilla, las invitaciones y los datos de tu equipo.",
};
const matchKillMap = {
  "Filtrer les éliminations": "Filtrar eliminaciones",
  "Les deux": "Ambos",
  "Mon équipe": "Mi equipo",
  "Aucune élimination localisée pour cette équipe": "No hay eliminaciones localizadas para este equipo",
  "1 élimination localisée": "1 eliminación ubicada",
  "1 élimination non localisable": "1 eliminación no se puede ubicar",
  "Carte des éliminations": "Mapa de eliminaciones",
  "À {0} : {1} → {2}. {3}.": "A las {0}: {1} → {2}. {3}.",
  "Équipe indéterminée": "Equipo desconocido",
  "Chargement de la carte…": "Cargando el mapa…",
  "Impossible de charger les éliminations.": "No se pudieron cargar las eliminaciones.",
  "Carte disponible pour la Faille de l’invocateur.": "Mapa disponible para la Grieta del Invocador.",
  "Positions des éliminations indisponibles": "Ubicaciones de eliminaciones no disponibles",
  "Fond de carte indisponible": "Fondo del mapa no disponible",
  "Utilisez les flèches pour parcourir les éliminations, Début et Fin pour la première et la dernière.": "Usa las flechas para recorrer las eliminaciones e Inicio y Fin para la primera y la última.",
  "{0} éliminations localisées": "{0} eliminaciones ubicadas",
  "Élimination précédente": "Eliminación anterior",
  "Élimination suivante": "Siguiente eliminación",
  "Assistances : {0}": "Asistencias: {0}",
  "Survolez ou touchez un point.": "Pasa el cursor o toca un punto.",
  "Aucune élimination enregistrée": "No hay eliminaciones registradas",
  "{0} éliminations non localisables": "{0} eliminaciones no se pueden ubicar",
  "Événements incomplets": "Eventos incompletos",
  "Exécution": "Ejecución",
};
export default { ...base, ...adminTeams, ...quality, ...reviewed, ...components, ...interfaceCopy, ...showcase, ...draftAssistance, ...opponents, ...groupOpponents, ...draftIntelligence, ...helpFeatures, ...home, ...teamManagement, ...playerComparison, ...socialCalendar, ...matchRecap, ...matchKillMap, ...compositions,
  ...debrief,
  "Tuto vidéo : importer une partie sur Windows": "Vídeo tutorial: importar una partida en Windows",
  "YouTube · 2 min 31 · En français · Nouvel onglet": "YouTube · 2 min 31 · En francés · Nueva pestaña",
};
