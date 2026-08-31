# Games, statistiques et reviews

## Importer une game

1. Générer un JSON avec la dernière version de NXT5 Importer.
2. Déposer le fichier dans `/integration`.
3. Nommer la game et choisir son contexte.
4. Confirmer le side, les lanes et les profils.
5. Valider l'import.

Une game peut ensuite être renommée ou corrigée depuis son historique. Les pages Statistiques, Tendances, Profil et Review utilisent automatiquement la nouvelle assignation.

## Lire les statistiques

`/statistiques` permet de rechercher une game, de lire les deux sides, de comparer les rôles à 10 et 20 minutes et de suivre les objectifs. Les groupes servent à réunir toutes les games d'un même bloc.

CS10 et CS20 indiquent le farm du joueur. DIFF10 et DIFF20 comparent ce farm à l'adversaire du même rôle. Cette lecture doit être rapprochée de l'or, des morts et des objectifs.

## Créer une review

Une review peut partir d'une game ou d'un groupe. Elle doit contenir une décision conservée, un point à corriger et une action vérifiable pour la prochaine game. Les games liées restent les sources de preuve et peuvent être rouvertes depuis la review.

La bibliothèque de `/rapports` permet de rechercher, filtrer, ouvrir, modifier ou supprimer une review selon les permissions du membre.
