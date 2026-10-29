# Accueil connecté : scène unifiée et débrief personnel

Le cadre de l’équipe contient désormais son introduction et la prochaine séance ou action contextuelle. Un filet intérieur organise la lecture. Le raccourci générique « Importer une partie » et le grand pictogramme du deuxième panneau sont retirés. Le démarrage et les actions d’import contextuelles des équipes vides ou sans activité récente conservent leurs droits et destinations.

Le composant `GlassScene` partage le cycle de vie du moteur du Hero avec la connexion. Sur bureau, le pointeur est suivi dans tout le cadre de l’accueil ; la sculpture revient au repos à la sortie. Le poster original reste immédiat et sert de repli sur mobile, en mouvement réduit, en mode performance ou en cas d’échec WebGL. Le moteur suspend déjà son rendu hors vue et lorsque l’onglet est masqué, puis libère ses ressources au démontage.

La [charte canonique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) est mise à jour en version 1.64 dans le dépôt principal. Aucune copie de charte n’est ajoutée ici.

Le bloc latéral du joueur contient les rubriques enregistrées qui lui sont attribuées dans le débrief accessible du dernier groupe créé. Les groupes n’ayant pas de statut « en cours », leur ordre existant (`created_at`, puis `id` décroissants) sert de référence. L’ensemble des identifiants de parties doit correspondre exactement au débrief. Un groupe récent sans débrief ne déclenche aucun repli vers un groupe plus ancien.

`home-player-debrief.js` lit le contenu stocké, sans générer de nouvelle analyse ni charger les timelines. Il utilise le profil lié et les alias fiables des participants associés par `player_id`, y compris après un changement de poste. Il refuse les noms ambigus, les rubriques adverses, les consignes collectives et les brouillons. Les notes individuelles de l’équipe sont affichées en premier ; les rubriques gardent leur contexte de partie et restent dépliables au clavier. Si aucune rubrique n’est attribuable, le panneau le dit et conserve l’accès au débrief.

Les rôles coach/assistant/analyst/manager/board et les profils d’encadrement n’ont pas ce bloc : les dernières parties occupent toute la largeur. Un propriétaire ou capitaine lié à un profil de jeu conserve son débrief personnel. Sans profil lié, un joueur reçoit une explication pour demander la liaison de son compte.

## Vérifications

- `npm run verify` : traductions, typage, 217 fichiers / 4 046 tests et build avec 13 pages prérendues réussis. Les dernières corrections d’attribution sont ensuite vérifiées par les 85 tests ciblés et un nouveau build.
- 26 tests de sélection/extraction vérifient les équipes, groupes, brouillons, identités, frontières, rubriques adverses et noms identiques aux titres collectifs ; les tests d’accueil couvrent aussi les rôles, les profils joueur/staff multiples et le changement de compte/équipe.
- 7 tests de cycle de vie couvrent pointeur, modes statiques, annulation pendant le chargement, repli et nettoyage.
- Vrai cadre connecté, données de démonstration : 320, 360, 390, 768, 1024 et 1440 px, sans débordement, image manquante ni erreur JavaScript.
- Vues joueur et coach contrôlées aux six largeurs : extraits individuels seulement, dernière partie en pleine largeur pour le coach, aucun débordement ni erreur JavaScript. Ouverture/fermeture des rubriques au clavier vérifiée.
- FR/EN/ES et nom d’équipe long à 320, 390 et 1024 px, sans débordement.
- Navigateur : mouvement visible du 5 entre deux positions de souris, repli après activation de mouvement réduit / mode performance et navigation vers le planning validés.

Les scripts, captures et journaux locaux sont dans `artifacts/home-unified/` (non versionnés). Ils utilisent uniquement des données fictives et ne vérifient pas une session de production.
