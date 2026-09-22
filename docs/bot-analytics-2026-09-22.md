# Statistiques du bot Discord

La rubrique **Administration → Pilotage → Statistiques du bot** est accessible à `/admin/bot-discord`. Elle utilise les données enregistrées par le bot, sans appeler Discord ni déclencher de publication.

## Périmètre

- Périodes de 7, 30 et 90 jours calendaires UTC, journée actuelle partielle. La période figure dans l’URL (`?days=30`).
- Implantation actuelle : équipes reliées et actives/en pause, serveurs et salons distincts, file d’envoi et blocages.
- Activité sur la période : publications diffusées, envois confirmés, tentatives en échec ou incertaines, tests de connexion et commandes reçues.
- Évolution quotidienne, détail des serveurs et salons, recherche par identifiant ou nom d’équipe/salon, et trente opérations récentes maximum.

Une publication est une destination game × salon ayant une tentative confirmée avec un identifiant de message. Une mise à jour de cette destination ne crée pas une deuxième publication, mais compte comme un envoi confirmé supplémentaire. Les publications retirées restent des publications historiquement diffusées. Le premier succès dans la période détermine le jour attribué à une publication dans le graphique et son tableau.

Les tentatives `succeeded` et `withdrawn` sont confirmées ; `blocked` et `retry_wait` comptent comme tentatives en échec. Le taux de réussite est `confirmées / (confirmées + échecs)`, sans les envois en cours ou incertains. Les tests de connexion sont présentés séparément et n’entrent pas dans ce taux.

Les commandes traitées ont terminé leur traitement par le bot ; cela ne garantit ni modification de connexion ni réception de la réponse dans Discord. Les suggestions de saisie ne sont pas des commandes. Un salon partagé agrège les règles de plusieurs équipes ; son état activé signifie qu’au moins une règle est activée.

## Données disponibles et accès

`GET /.netlify/functions/admin-discord-analytics?days=7|30|90` exige l’administrateur de plateforme configuré côté serveur. Les réponses ne sont pas mises en cache. Les tables sont interrogées dans un seul instantané SQL ; les agrégations précèdent les jointures pour éviter de compter plusieurs fois un serveur ou un salon partagé.

L’historique existant conserve les commandes sept jours et les tentatives quatre-vingt-dix jours. Une journée antérieure à la conservation des commandes affiche « Non conservées », jamais un zéro fabriqué. Le premier jour de leur fenêtre glissante peut être partiel. Supprimer une équipe supprime aussi son historique par les cascades existantes. Les noms de serveurs ne sont pas stockés : leur identifiant et les noms des équipes/salons permettent de les reconnaître. Les installations du bot sans liaison ni activité connue de NXT5 ne sont pas recensées.

Le rapport n’expose ni identifiant d’utilisateur Discord, ni contenu des réponses/commandes, ni jeton, ni corps d’erreur du fournisseur. Une table Discord manquante donne un état d’initialisation requis, une panne de base de données donne une erreur. Les rafraîchissements transitoirement échoués conservent les dernières données avec une explication ; un refus 401/403 les efface. Changer de période masque immédiatement les données de la période précédente et ignore les réponses devenues obsolètes.

Aucune migration n’est ajoutée et aucun envoi du bot n’est nécessaire pour utiliser le rapport.

## Vérification locale

- Tests SQL avec les migrations réelles exécutées dans PGlite : serveurs/salons partagés, plusieurs tentatives et révisions, retrait, tests fictifs séparés, ancien serveur après changement de liaison, périodes UTC, conservation, absence de données, limite d’activité, accès administrateur et erreurs.
- Tests React : données affichées, chargement, erreurs, absence de schéma, vide, changement de période, annulation/réponses obsolètes, rafraîchissement, refus d’accès, recherche historique et pagination, tableau quotidien et contrôle clavier du graphique.
- Navigation d’administration : route, titre, menu ordinateur/mobile et accès protégé.
- Navigateur sur l’application locale avec données synthétiques interceptées : 360, 390, 768, 1024 et 1440 px, absence de débordement global, contrôles tactiles, focus clavier, détails, graphique, filtres et états.

Les captures de [vérification visuelle](../artifacts/bot-analytics/) contiennent uniquement des données synthétiques. Elles ne représentent pas les statistiques de production. Le script `qa.mjs` et son relevé `qa-results.json` documentent les contrôles.
