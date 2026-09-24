# Vérification du parcours de prise en main

Contrôle du 24 septembre 2026, sur la branche `codex/clarte-parcours-20260924`, issue de `e18f126`. Le [plan détaillé](plan-clarte-parcours-2026-09-24.md) décrit les quatre axes et leurs critères de réussite.

## Résultat

Les changements du parcours d’entrée sont implémentés : vocabulaire et destinations, lecture progressive des parties, continuité équipe → joueurs → import, et lisibilité des écrans concernés. La suite complète `npm run verify` passe : **vérification des types réussie, 104 fichiers de tests et 1 803 tests réussis**, puis compilation de production réussie. `git diff --check` ne signale aucune erreur.

Les tests de comportement couvrent notamment les sections repliables, les liens contextualisés, les prérequis d’import, l’ordre côté → joueurs → confirmation et les permissions. Un rôle de staff appartenant à une autre équipe ou à un autre utilisateur n’autorise pas l’import. Le nombre de profils requis compte des identifiants de joueurs distincts et exclut l’encadrement.

## Contrôles dans le navigateur

Les composants réels de l’application ont été montés dans un environnement local avec des données fictives. Les requêtes de données et les écritures ont été interceptées ; aucun import réel n’a été effectué.

| Écran ou état | 360 px | 390 px | 768 px | 1 024 px | 1 440 px |
| --- | --- | --- | --- | --- | --- |
| Accueil public | OK | OK | OK | OK | OK |
| Équipe vide, vue du staff | OK | OK | OK | OK | OK |
| Formulaire d’ajout des joueurs | OK | OK | OK | OK | OK |
| Import après aperçu et choix du côté | OK | OK | OK | OK | OK |
| Liste de parties renseignée | OK | OK | OK | OK | OK |
| Bilan de partie et statistiques ouvertes | OK | OK | OK | OK | OK |
| Guide d’utilisation | OK | OK | OK | OK | OK |
| Bibliothèque de débriefs | OK | OK | OK | OK | OK |

« OK » signifie que la largeur du document ne dépasse pas celle du viewport disponible. Pour l’import, la largeur intérieure du dialogue a également été contrôlée. Ces 40 compositions complètent l’inspection visuelle des écrans principaux ; elles ne constituent pas un audit exhaustif de toutes les pages et de tous les contenus possibles.

Interactions vérifiées dans le navigateur :

- Le bouton « Ajouter les joueurs » ouvre directement le formulaire et place le focus dans le premier champ.
- Le tiroir mobile s’ouvre ; Échap le ferme et rend le focus au bouton du menu. Le guide reste accessible dans le menu réduit.
- Les sections de la partie s’ouvrent et se referment au clavier ; les statistiques détaillées restent accessibles.
- Le chargement d’un fichier fictif affiche d’abord les côtés. Le choix du côté révèle les joueurs, puis le nom et les catégories près de la confirmation.
- Un poste manquant désactive la confirmation avec une explication visible. Sa correction rend la confirmation disponible.
- Une erreur simulée lors de l’enregistrement conserve les sélections du brouillon et permet de réessayer.
- Un membre sans droit de gestion accédant directement à l’import reçoit une explication et un retour vers les parties ; aucun sélecteur de fichier n’est proposé.

## Charte et limites

La [charte canonique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) a été actualisée dans son emplacement de référence, avec la section « Clarté et prise en main — évolution du 24 septembre 2026 ». Aucune copie de charte n’est ajoutée à ce checkout. L’identité visuelle et les assets de marque sont conservés.

Cette livraison porte sur l’entrée dans le produit et le parcours jusqu’au premier bilan/débrief. Elle ne réécrit pas les notes déjà enregistrées, le contenu des exports ni tous les outils avancés. Certaines images distantes ont été remplacées par leurs états de repli pendant le contrôle local.

L’import réel en production et les tests avec de nouveaux utilisateurs n’ont pas été réalisés. L’amélioration de compréhension devra être mesurée avec ces utilisateurs selon le protocole du plan ; aucun gain chiffré de facilité d’utilisation n’est revendiqué. La validation locale ne vaut pas mise en production.
