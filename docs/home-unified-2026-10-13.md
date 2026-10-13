# Accueil connecté : scène et prochaine action réunies

Le cadre de l’équipe contient désormais son introduction et la prochaine séance ou action contextuelle. Un filet intérieur organise la lecture. Le raccourci générique « Importer une partie » et le grand pictogramme du deuxième panneau sont retirés. Le démarrage et les actions d’import contextuelles des équipes vides ou sans activité récente conservent leurs droits et destinations.

Le composant `GlassScene` partage le cycle de vie du moteur du Hero avec la connexion. Sur bureau, le pointeur est suivi dans tout le cadre de l’accueil ; la sculpture revient au repos à la sortie. Le poster original reste immédiat et sert de repli sur mobile, en mouvement réduit, en mode performance ou en cas d’échec WebGL. Le moteur suspend déjà son rendu hors vue et lorsque l’onglet est masqué, puis libère ses ressources au démontage.

La [charte canonique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) est mise à jour en version 1.63 dans le dépôt principal. Aucune copie de charte n’est ajoutée ici.

## Vérifications

- `npm run verify` : traductions, typage, 216 fichiers / 3 998 tests et build avec 13 pages prérendues réussis.
- 7 tests de cycle de vie couvrent pointeur, modes statiques, annulation pendant le chargement, repli et nettoyage.
- Vrai cadre connecté, données de démonstration : 320, 360, 390, 768, 1024 et 1440 px, sans débordement, image manquante ni erreur JavaScript.
- FR/EN/ES et nom d’équipe long à 320, 390 et 1024 px, sans débordement.
- Navigateur : mouvement visible du 5 entre deux positions de souris, repli après activation de mouvement réduit / mode performance et navigation vers le planning validés.

Les scripts, captures et journaux locaux sont dans `artifacts/home-unified/` (non versionnés). Ils utilisent uniquement des données fictives et ne vérifient pas une session de production.
