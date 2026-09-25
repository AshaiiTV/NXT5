# Carnets de matchups

Le carnet rassemble les parties, le plan de jeu et les essais d'un joueur pour un duel précis. Il se trouve dans **Mon profil > Champions > fiche d'un champion > Matchups**, à côté de l'onglet **Statistiques**. Il n'ajoute pas de rubrique principale au profil.

## Retrouver un duel

Les parties du champion et de la catégorie active sont regroupées automatiquement par **champion adverse et poste**. La liste affiche le nombre de parties, le taux de victoire sur les résultats connus, l'écart moyen de CS à 10 minutes disponible et l'état du carnet. La recherche porte sur le champion adverse ou le poste ; les lignes sont classées par nombre de parties décroissant.

Le regroupement exige un seul adversaire identifié au même poste parmi les participants ennemis. Une partie sans poste explicite ou avec plusieurs adversaires possibles ne crée pas un duel supposé. Le nombre de parties exclues est signalé ; corriger les postes dans Parties permet de réexaminer leur attribution. Un swap réel ne peut pas être déduit de ce seul regroupement.

Un carnet enregistré reste dans la liste du champion même s'il ne possède aucune partie dans la catégorie active. Les nouvelles parties du même duel rejoignent automatiquement les statistiques ; leur association à un essai est un choix du joueur ou du staff.

## Préparer le plan et les essais

Le plan comporte trois champs :

- **Plan de départ** : l'approche prévue pour jouer le duel.
- **Points de vigilance** : les difficultés ou situations à surveiller.
- **À conserver** : les enseignements retenus par le joueur et le staff.

Un essai contient un titre, une approche à tester, les observations du joueur, la conclusion du joueur et du staff et les parties associées. Ses états sont **À tester**, **En cours** et **Terminé**. Les essais se consultent dans des sections repliables ; leurs parties sources peuvent être rouvertes dans Parties.

L'action **Préparer le carnet** ou **Modifier le carnet** ouvre le formulaire. **Enregistrer le carnet** partage les changements ; **Annuler** abandonne le brouillon après confirmation lorsqu'il a été modifié. Le retrait d'un essai renseigné demande aussi confirmation et n'est enregistré qu'à la sauvegarde du carnet.

La sélection de parties propose les parties du duel dans la catégorie courante et conserve les associations précédentes. Les références hors de la catégorie actuelle restent présentes. Le serveur vérifie qu'une partie associée appartient à la même équipe, au joueur lié au profil et au même duel. Une partie supprimée ou dont les postes ou profils ont changé peut donc empêcher une sauvegarde tant que la référence n'est pas corrigée.

## Comprendre la portée du carnet

| Élément | Portée |
| --- | --- |
| Identité d'un carnet | Équipe + profil joueur + champion joué + champion adverse + poste. |
| Plan et essais enregistrés | Partagés entre les catégories et les patches de ce duel. |
| Parties et statistiques affichées | Catégorie du profil, puis filtre local de patch pour les statistiques du duel. |
| Lecture | Membres de l'équipe et propriétaire. |
| Modification | Compte lié au profil joueur, propriétaire et staff de l'équipe. |

Les rôles de staff autorisés sont `captain`, `coach`, `assistant`, `analyst`, `manager` et `board`. Le lien du compte au profil est vérifié côté serveur ; un même pseudo ne donne pas de droit d'édition. Les notes d'un joueur dans une autre équipe ne font pas partie de ce carnet.

## Lire les statistiques et leurs limites

Les relevés à 10, 15 et 20 minutes sont regroupés dans un détail repliable. Le plan, les essais et les parties sources restent directement accessibles. Le filtre de patch concerne les statistiques ; il ne modifie ni le plan ni les essais.

Le détail calcule les écarts **joueur moins adversaire** à 10, 15 et 20 minutes pour les CS, l'or total et l'expérience. Chaque mesure indique sa couverture, par exemple « 3/5 parties renseignées ». Le taux de victoire utilise les résultats connus de la partie entière ; il ne mesure pas à lui seul la réussite de la lane.

- Les deux joueurs utilisent le même relevé de timeline, à la minute cible ou dans la minute suivante. Aucun relevé antérieur n'est prolongé artificiellement.
- Les parties terminées avant une échéance sont exclues de cette mesure lorsque leur durée est connue.
- Sans timeline, les résumés de CS à 10 et 20 minutes peuvent servir de repli lorsqu'ils sont présents. Ils ne créent pas de valeurs d'or, d'XP ou de CS à 15 minutes.
- Une valeur absente s'affiche comme indisponible et sort de la moyenne. Un zéro effectivement renseigné reste un zéro.
- Le détail complet des parties est chargé à la demande. En cas d'échec partiel, les mesures reçues restent visibles, avec un message et une action pour réessayer.

Dans **Parties, runes et équipements**, ouvrir une partie pour comparer les deux joueurs : runes importées, fragments, ordre des améliorations de compétences, inventaires et achats disponibles. Les noms des runes proviennent du catalogue français Data Dragon ; un catalogue de repli peut être utilisé. Une entrée inconnue garde son identifiant, et l'indisponibilité des noms peut être réessayée. Aucun bonus chiffré de rune n'est reconstruit. L'ordre des compétences montre les événements d'amélioration disponibles en A / Z / E / R et leur temps de jeu, pas les lancements de sorts.

Les résultats sont des observations. Le site ne déclare pas automatiquement qu'un essai, une rune ou un achat cause une victoire ; les conclusions sont écrites par le joueur et le staff.

## Sauvegarde et modifications concurrentes

Les versions enregistrées sont stockées côté serveur avec l'auteur, la date de dernière modification et une révision. Une sauvegarde n'est acceptée que si la révision consultée correspond encore à la version partagée. Deux créations concurrentes d'un même carnet sont aussi protégées.

Si une autre personne a enregistré entre-temps, le formulaire conserve le brouillon et affiche le conflit. **Copier mon brouillon** en copie le contenu au format JSON ; **Recharger le carnet** demande confirmation avant d'abandonner la saisie et de récupérer la version partagée. Il n'y a pas de fusion automatique ni d'historique consultable de toutes les versions.

Les brouillons sont conservés **en mémoire du navigateur pendant la navigation dans l'application**, séparés par compte et par carnet. Ils ne sont pas persistés dans le stockage local. Une alerte de sortie est installée tant qu'un brouillon existe ; fermer ou recharger malgré l'alerte perd la saisie non enregistrée. Il faut enregistrer pour la partager et la retrouver dans une autre session.

Si le droit d'édition est retiré, le carnet affiche la version partagée. Le brouillon reste récupérable via **Copier mon brouillon** et revient dans le formulaire si le droit d'édition est rétabli pendant cette session.

### Limites de saisie

| Contenu | Limite |
| --- | --- |
| Chaque champ du plan | 4 000 caractères. |
| Essais dans un carnet | 20. |
| Titre d'un essai | 120 caractères, obligatoire. |
| Approche, observation ou conclusion d'un essai | 2 000 caractères par champ. |
| Parties associées à un essai | 50, sans doublon. |
| Parties distinctes associées dans un carnet | 200. |

## Intégration et exploitation

La fonctionnalité réutilise les données déjà importées. Elle ne change pas l'application NXT5 Importer et ne garantit pas que les imports anciens contiennent les runes ou les relevés nécessaires.

- Interface : `src/components/profile/MatchupNotebook.jsx`, `matchup-notebook.css`, `ParticipantRunes.jsx` et `participant-runes.css` ; intégration dans `src/pages/workspace/PlayerUltimateProfile.jsx`.
- Regroupement et mesures : `src/utils/matchup-notebook.js`.
- Chargements, sauvegardes et brouillons : `src/hooks/useMatchupNotebooks.js`.
- API : `netlify/functions/player-matchups.ts` et `_lib/player-matchups.ts` ; requêtes POST `list` et `save`, contrôles de session, d'équipe, de profil et de parties associées.
- Stockage : migration `database/migrations/20260915_player_matchups.sql`, table `player_matchup_notebooks`, marqueur `player-matchups-20260915-v1`. La clé unique comprend l'équipe, le profil, les deux champions et le poste ; la suppression de l'équipe ou du profil supprime ses carnets.

La migration doit être appliquée avec le runner du dépôt avant l'utilisation de l'API. Si elle manque, l'API signale temporairement l'indisponibilité des carnets, sans tenter de créer le schéma pendant la requête. Le parcours de migration et les règles de preview sont décrits dans [Migrations de la base](../database/MIGRATIONS.md).

Les règles visuelles et d'accessibilité figurent dans la [charte graphique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md), section « Carnets de matchups dans les champions » : onglets accessibles au clavier, focus restitué au retour, contrôles tactiles et formulaires recomposés sur mobile.
