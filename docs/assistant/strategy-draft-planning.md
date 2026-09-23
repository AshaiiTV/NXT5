# Tendances, profils, pools, compositions et planning

## Tendances

`/tendances` analyse les games avec un filtre « Catégorie » et une période : toutes les games ou les 5, 10 ou 20 dernières games. Ces filtres s’appliquent aux cinq rubriques :

- « Synthèse » présente les repères d’équipe, les rôles, les signaux de review et un axe de travail proposé.
- « Évolution » suit les mesures game après game et permet d’ouvrir la game examinée.
- « Comparer » confronte deux sélections et leurs moyennes par bloc.
- « Draft » rassemble les champions, compositions et duos joués avec leurs résultats.
- « Objectifs » propose des cibles d’équipe et par joueur avec leurs sources.

Les écarts d’or, de dégâts et de vision comparent notre équipe aux adversaires à la fin des games. Une valeur positive indique un avantage sur cette mesure. « — » signifie que la donnée est indisponible. Un petit volume de games ne suffit pas à confirmer une tendance ; les plans de jeu et objectifs proposés doivent être vérifiés dans les games sources.

« Exporter la synthèse » télécharge une image PNG du périmètre sélectionné.

### Détails des tendances de draft

Depuis Draft, les titres des catégories ouvrent leurs pages détaillées, qui conservent les filtres de catégorie et de période :

| Page | Chemin | Lecture |
| --- | --- | --- |
| Pick repère | `/tendances/draft/pick-repere` | Pick de confort le plus joué ; à défaut, pick le plus joué. |
| Picks de confort | `/tendances/draft/confort` | Champion et rôle avec au moins 2 games et au moins 50 % de victoires. |
| Profil des compositions | `/tendances/draft/profil` | Marqueurs de style des champions, leur présence et leurs résultats. |
| Compositions fréquentes | `/tendances/draft/compositions` | Identités de composition selon le marqueur de style dominant. |
| Duos fréquents | `/tendances/draft/duos` | Champions joués ensemble pour Jungle + Mid, ADC + Support et Top + Jungle. |
| À revoir en équipe | `/tendances/draft/a-revoir` | Picks joués au moins 2 fois avec moins de 50 % de victoires et signaux de draft à examiner. |
| Picks les plus joués par rôle | `/tendances/draft/roles` | Tous les champions par rôle, y compris ceux joués une seule fois. |

Les pages détaillées proposent les filtres adaptés, notamment la recherche par champion et le rôle ou la paire de rôles. Ouvrir les games sources pour replacer les résultats dans leur contexte. Une identité de composition décrit ses possibilités, pas la manière dont la game a été jouée.

## Profils joueurs

Le profil (`/mon-profil`) permet de choisir un joueur et une catégorie, puis de parcourir « Synthèse », « Champions », « Pool déclaré », « Historique » et « Suivi ». « Exporter le résumé » télécharge une seule image PNG du joueur sur la catégorie sélectionnée.

Dans « Champions », sélectionner un champion puis ouvrir « Statistiques moyennes et adversaires » pour consulter les adversaires rencontrés et les résultats associés. Ces confrontations viennent des games importées. Les données ne constituent pas à elles seules une preuve de maîtrise d’un champion.

« Pool déclaré » présente les picks renseignés pour la draft et permet d’« Exporter la tier list ». « Historique » retrouve les games liées au joueur. Dans « Suivi » (`/mon-profil/coaching`), les objectifs suivent les games de la catégorie sélectionnée ; les notes restent communes à toutes les catégories du joueur et s’enregistrent avec « Enregistrer les notes » selon les permissions.

Si le profil paraît vide, retirer d’abord un éventuel filtre de catégorie, vérifier la liaison du compte au profil dans Gestion équipe et contrôler l’assignation du joueur dans les imports.

## Champion Pool

`/draft/pool` organise les picks déclarés de chaque joueur dans les colonnes « Confiance », « Situationnel », « En validation » et « En training ». Ces statuts sont renseignés pour préparer la draft ; ils ne sont pas déduits automatiquement des résultats importés.

Choisir le joueur, rechercher un champion dans le catalogue et filtrer par rôle si nécessaire. Ajouter ou déplacer le champion avec le menu de classement ou par glisser-déposer. Le staff et le joueur lié peuvent modifier son pool ; les autres membres le consultent en lecture seule. « Exporter PNG » télécharge la tier list.

## Compositions

`/draft/compositions` prépare les cinq rôles à partir des Champion Pools. Sélectionner ou glisser un champion vers son rôle, renseigner le nom de la composition, les tags Blue Side / Red Side et le « Résumé » du plan de jeu, puis créer la composition. Le lexique explique les tags et les marqueurs de style.

Les compositions enregistrées peuvent être filtrées par side, dupliquées pour préparer une variante et modifiées selon les permissions. La page actuelle présente un seul espace de compositions.

## Planning

`/planning` affiche « Semaine en cours » ou « Semaine d’après ». Chaque joueur renseigne les disponibilités de son compte lié ; le staff dispose d’une présence groupée « Coaching Staff ». En l’absence de profil lié, vérifier la liaison dans Gestion équipe.

Cliquer sur un créneau pour changer sa disponibilité, ou utiliser « Soirées », « Bloc scrim » et « Week-end ». Des notes permettent de préciser les contraintes et retards possibles. Les disponibilités et notes sont sauvegardées automatiquement ; le statut indique l’enregistrement et propose « Réessayer » en cas d’erreur.

Pour ajouter une session Scrim, Match ou Review, utiliser « Modifier les événements » puis choisir un créneau. Le clic droit sur un créneau ouvre aussi les types de session. La gestion des événements est disponible aux membres de l’équipe lorsqu’un profil permet d’enregistrer le planning ; elle n’est pas réservée au staff. La disponibilité personnelle reste liée aux permissions du profil.
