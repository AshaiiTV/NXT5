# Parties, bilans et débriefs

## Importer une partie

`/games` réunit les parties et leurs bilans. Pour un import manuel, choisir le fichier JSON produit par NXT5 Importer, le côté de l’équipe, les postes, cinq profils joueurs distincts, un nom et au moins une catégorie. Les profils manquants peuvent être créés pendant l’import. Une fiche d’équipe adverse reste facultative. Les associations peuvent être corrigées depuis les options de la partie.

Dans **Parties → Import automatique**, le staff génère un code de liaison à usage unique valable 15 minutes. Le coller dans **Collecte automatique** de NXT5 Importer et laisser l’application ouverte pendant les customs. Les parties reconnues arrivent automatiquement ; les autres apparaissent dans **Parties reçues** avec **Finaliser**. La liaison expire après 90 jours et peut être révoquée.

Depuis NXT5 Importer 0.4.1, la navigation regroupe **Exporter**, **Collecte automatique**, **Historique** et **Paramètres** dans une barre latérale, remplacée par une barre supérieure sous 900 px. Les fonctions et raccourcis de collecte restent ceux de la version 0.4.0. Voir le [journal de l’Importer](../../importer-app/CHANGELOG.md).

## Lire une partie

Le bilan dans `/games` présente Débrief, Face-à-face et Drafting. Débrief rassemble le résultat, les compositions, la courbe d’or, la carte des éliminations et les moments clés. Dans Face-à-face, ouvrir chaque poste pour comparer les deux joueurs ; les valeurs se lisent côté bleu puis côté rouge et la flèche indique le côté devant. Un tiret signifie que la donnée est indisponible. Une draft publique terminée de Drafter.lol peut être rattachée à une partie indépendamment de sa fiche adverse.

## Préparer un débrief

`/rapports` conserve les observations et actions de l’équipe liées à une ou plusieurs parties. **En 10 secondes** propose une synthèse visuelle ; **Les écarts par poste** compare l’or final, les dégâts aux champions et la vision. Les notes restent accessibles au clic. L’engrenage **Gérer ce débrief** donne accès à Dupliquer et, selon les droits, Supprimer. Un débrief peut relier jusqu’à 20 parties.
