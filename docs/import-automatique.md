# Import automatique des parties

Guide d’exploitation de la liaison entre NXT5 Importer et une équipe, visible dans Parties → Import automatique, et de l’onglet « Collecte automatique » de NXT5 Importer 0.4.0. Préparation locale au 5 novembre 2026 ; le pilote sur une vraie custom (ci-dessous) reste à effectuer avant de considérer la fonctionnalité comme en service.

## Parcours

1. Dans Parties, le staff (propriétaire, capitaine, coach, assistant, analyste, manager, board) clique sur « Lier NXT5 Importer », choisit éventuellement le tag à appliquer aux parties reçues, et obtient un code à usage unique valable 15 minutes.
2. Dans NXT5 Importer, onglet Collecte automatique, le code est collé une fois. L’application reçoit un jeton valable 90 jours, le nom de l’équipe, son tag et les Riot ID de l’effectif actif, puis affiche la liaison dans Parties avec le nom de l’ordinateur.
3. À la fin de chaque custom observée avec l’Importer ouvert, l’application envoie la partie (données Riot converties depuis le client local, avec la chronologie quand elle existe) et une clé de répétition. Un envoi répété de la même partie ne crée rien de plus.
4. Le serveur reconnaît l’équipe par les Riot ID de l’effectif : au moins quatre joueurs sur un même côté. Il déduit le côté, les postes (positions Riot, sinon rôle du profil, sinon Smite pour la jungle et le dernier poste libre) et les cinq profils, puis enregistre la partie comme un import manuel, avec le tag choisi ou le tag par défaut de l’équipe. Les notifications et publications habituelles suivent.
5. Une partie non reconnue (joueur hors effectif, postes ambigus, aucun tag) reste dans « Parties reçues » avec son motif et le bouton Finaliser, qui ouvre le formulaire d’import habituel pré-rempli. Une partie sans lien avec l’équipe est ignorée et listée comme telle.
6. Le staff révoque une liaison d’un clic ; les envois suivants sont refusés. Cinq liaisons actives au plus par équipe.

## Données et limites

- Tables `team_import_links` et `team_import_submissions` (migration `team-import-links-20261105-v1`). Les lignes suivent l’équipe. Le code et le jeton sont stockés hachés ; le jeton n’est jamais relu.
- Fonctions : `team-import-link` (staff, session NXT5), `team-import-connect` (code → jeton), `team-import-session` (contrôle de liaison), `team-import-submissions` (réception, 5 Mo par partie, 30 envois par minute et par adresse, 500 parties par liaison).
- Une partie déjà présente dans l’équipe est confirmée comme importée sans écriture. Une seule réception par partie et par équipe : le premier envoi réclame la ligne (`receiving`), un envoi concurrent d’un autre ordinateur reçoit l’état existant sans écrire, une réception bloquée depuis dix minutes est reprise. La liaison est verrouillée et revérifiée dans la transaction d’écriture : une révocation terminée avant l’écriture annule l’import (401).
- Les parties en attente conservent leur contenu (une seule copie de la chronologie) jusqu’à finalisation ou abandon, et restent toutes listées quel que soit le nombre de réceptions suivantes ; les autres ne gardent que l’identifiant et le motif. Une partie nouvellement importée déclenche les e-mails de notification et les publications Discord habituels.
- Journal d’audit : `team_import.link.create`, `team_import.link.revoke`, `team_import.imported`, `team_import.pending`, `team_import.skipped`.
- Aucun mot de passe Riot ni accès au compte Riot : l’Importer lit uniquement les interfaces locales du client, comme pour l’export manuel.

## Côté NXT5 Importer

- L’onglet Collecte automatique garde le jeton dans le processus principal (`collector.json` dans le dossier de données de l’application) ; l’interface ne reçoit qu’un résumé. Les parties récupérées sont conservées dans `collector-games/` jusqu’à leur envoi (ou plus longtemps si elles restent à finaliser).
- Toutes les dix secondes, l’application lit `/lol-gameflow/v1/session` : une partie vue en cours (`InProgress`) après l’activation est mémorisée ; dès que le client en sort, la partie est lue dans l’historique du client (jusqu’à dix-huit essais) puis envoyée avec sa chronologie.
- Une coupure réseau ou une indisponibilité de NXT5 reprogramme l’envoi (1, 2, 5, 15, 30 puis 60 minutes) ; un refus 401 marque la liaison révoquée et arrête la collecte ; un autre refus est final et affiché. « Envoyer une partie manquée » accepte un Game ID.
- Un redémarrage conserve la liaison et les parties en attente, mais la collecte doit être réactivée explicitement.

## Pilote à réaliser

1. Sur le site, générer un code ; dans l’Importer 0.4.0, le coller, vérifier que l’équipe et l’effectif s’affichent, puis constater la liaison « Connectée » dans Parties.
2. Activer la collecte, jouer une custom 5v5 avec au moins quatre joueurs de l’effectif, laisser l’Importer ouvert : la partie doit apparaître dans Parties sous deux minutes après la fin, importée avec le bon côté et les bons profils.
3. Rejouer une custom en coupant le réseau pendant l’envoi : la partie reste « Nouvel essai prévu », puis part seule au retour du réseau, sans doublon.
4. Révoquer la liaison depuis NXT5 pendant la collecte : l’Importer doit s’arrêter avec le motif, et un nouveau code doit la rétablir.
5. Jouer avec un joueur hors effectif : la partie doit arriver « À finaliser » et s’importer via Finaliser.

## Vérifications

- [team-import-server.test.ts](../src/__tests__/team-import-server.test.ts) : code, liaison, plafond, révocation, import reconnu avec profils et tag, côté rouge avec remplaçant, parties ignorées ou en attente, finalisation par l’import manuel, inférence des postes.
- [importer-auto-link.test.jsx](../src/__tests__/importer-auto-link.test.jsx) : panneau de Parties, génération du code, finalisation, révocation, lecture seule.
- Le pilote réel (custom 5v5, coupure réseau pendant l’envoi, révocation en cours de session) se fait avec NXT5 Importer 0.4.0 ; ces tests locaux ne le remplacent pas.
