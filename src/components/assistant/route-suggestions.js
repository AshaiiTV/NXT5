import { normalizePath, profileViewFromPath } from "../../app/routing.js";
import { isTrendDetailPath, readTrendsRoute } from "../../app/trends-navigation.js";

const ROUTE_SUGGESTIONS = [
  { matches: ["/equipes", "/gestion-equipe"], prompts: ["Comment ajouter un joueur ?", "Comment organiser la Main Team et les Subs ?", "Où modifier les accès de l'équipe ?"] },
  { matches: ["/games", "/integration", "/statistiques"], prompts: ["Comment lire les statistiques de cette game ?", "Comment importer une game ?", "Comment publier une game sur Discord ?"] },
  { matches: ["/rapports"], prompts: ["Comment créer une review ?", "Comment lier plusieurs games à une review ?", "Où retrouver mes anciennes reviews ?"] },
  { matches: ["/planning"], prompts: ["Comment renseigner les disponibilités ?", "Qui peut modifier le planning ?", "Comment préparer une session d'équipe ?"] },
  { matches: ["/draft", "/draft/pool", "/champion-pool"], prompts: ["Comment modifier le pool d'un joueur ?", "Comment classer un champion par tier ?", "À quoi servent les statuts des picks ?"] },
  { matches: ["/draft/compositions", "/compositions-types"], prompts: ["Comment créer une composition ?", "Comment utiliser les tiers du Champion Pool ?", "Comment préparer nos drafts ?"] },
  { matches: ["/bot-discord"], prompts: ["Comment lier mon compte Discord à NXT5 ?", "Comment connecter le bot au serveur de l'équipe ?", "Comment choisir les salons, tester et activer les publications ?"] },
  { matches: ["/parametres"], prompts: ["Comment associer mon compte Google à NXT5 ?", "Où gérer mes connexions associées ?", "Comment définir un mot de passe NXT5 après une inscription avec Google ?"] },
];

const TREND_SUGGESTIONS = {
  coach: ["Comment lire la Synthèse des tendances ?", "Comment filtrer par Catégorie et Période d'analyse ?", "Comment retrouver les games sources d'une priorité ?"],
  evolution: ["Comment lire la courbe dans Évolution ?", "Comment changer de métrique et de game à examiner ?", "Pourquoi une valeur est-elle indisponible dans Évolution ?"],
  comparison: ["Comment comparer le Bloc de référence au Bloc observé ?", "Comment interpréter les écarts dans Comparer ?", "Que signifie la présence de games communes aux deux blocs ?"],
  draft: ["Comment lire les picks et compositions dans Tendances Draft ?", "Où consulter tous les duos de champions ?", "Comment retrouver les games sources d'un pick ?"],
  "ai-objectives": ["Comment lire les Objectifs de l'équipe ?", "Où ouvrir les Contrats joueurs ?", "Comment retrouver les games sources d'un objectif ?"],
};

const DRAFT_DETAIL_SUGGESTIONS = {
  "pick-repere": ["Comment le Pick repère est-il choisi ?", "Comment distinguer fréquence et taux de victoire d'un pick ?", "Où ouvrir les games sources du Pick repère ?"],
  confort: ["Quels sont les critères des Picks de confort ?", "Comment filtrer les Picks de confort par rôle ?", "Pourquoi un champion n'apparaît-il pas dans les Picks de confort ?"],
  profil: ["Comment lire le Profil de draft ?", "Que signifient les marqueurs de style des champions ?", "Où retrouver les games sources du Profil de draft ?"],
  compositions: ["Comment les compositions sont-elles classées dans Tendances ?", "Comment rechercher une composition dans Tendances Draft ?", "Comment ouvrir les games sources d'une composition ?"],
  duos: ["Quelles paires de rôles sont suivies dans les Duos ?", "Comment rechercher et filtrer tous les Duos ?", "Comment distinguer fréquence et taux de victoire d'un duo ?"],
  "a-revoir": ["Quels sont les critères des picks À revoir ?", "Comment interpréter les signaux de style À revoir ?", "Comment ouvrir les games du bloc À revoir ?"],
  roles: ["Comment lire le pool complet par rôle dans Tendances ?", "Comment rechercher un champion et filtrer son rôle ?", "Pourquoi un champion apparaît-il sur plusieurs rôles ?"],
};

const PROFILE_SUGGESTIONS = {
  overview: ["Comment choisir le joueur et la Catégorie du profil ?", "Comment lire la Synthèse d'un joueur ?", "Où retrouver ses champions et matchups ?"],
  champions: ["Comment rechercher et trier les Champions d'un joueur ?", "Comment comparer les statistiques et équipements d'un matchup ?", "Où retrouver l'inventaire final et la chronologie des achats ?"],
  pool: ["Quelle différence entre Champions et Pool déclaré ?", "Comment modifier le Pool déclaré d'un joueur ?", "Comment exporter la tier list du Pool déclaré ?"],
  history: ["Comment filtrer l'Historique par champion et résultat ?", "Comment ouvrir une game depuis l'Historique du profil ?", "Pourquoi une game manque-t-elle dans le profil du joueur ?"],
  coaching: ["Où retrouver les objectifs et notes dans Suivi ?", "Comment suivre la progression d'un joueur ?", "Comment préparer la prochaine review du joueur ?"],
};

const IMPORT_SUGGESTIONS = [
  "Où télécharger NXT5 Importer pour Windows ou Mac ?",
  "Où trouver l'aide si NXT5 Importer ne s'ouvre pas ?",
  "Comment confirmer le côté, les postes et les profils à l'import ?",
];

const DEFAULT_SUGGESTIONS = [
  "Comment utiliser cette page ?",
  "Quelle est la prochaine étape conseillée ?",
  "Où trouver la fonctionnalité que je cherche ?",
];

export function suggestionsForRoute(route = {}) {
  const path = normalizePath(route?.path || "");
  const params = new URLSearchParams(route?.search || "");
  if (["/games", "/integration", "/statistiques"].includes(path) && params.get("import") === "1") return IMPORT_SUGGESTIONS;
  if (path === "/tendances" || isTrendDetailPath(path)) {
    const { detail, panel } = readTrendsRoute({ path, search: route?.search });
    return detail ? DRAFT_DETAIL_SUGGESTIONS[detail] : TREND_SUGGESTIONS[panel];
  }
  if (path === "/mon-profil" || path.startsWith("/mon-profil/") || path === "/profil" || path.startsWith("/profil/")) {
    return PROFILE_SUGGESTIONS[profileViewFromPath(path)];
  }
  return ROUTE_SUGGESTIONS.find((item) => item.matches.includes(path))?.prompts || DEFAULT_SUGGESTIONS;
}
