# Import automatique des parties

Guide d’exploitation de la liaison entre NXT5 Importer et une équipe, visible dans Parties → Import automatique. Préparation locale au 5 novembre 2026 : la partie serveur et le site sont décrits ici ; l’onglet « Collecte automatique » de NXT5 Importer qui les utilise fait l’objet d’une livraison distincte (version 0.4.0), suivie d’un pilote sur une vraie custom.

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
- Une partie déjà présente dans l’équipe est confirmée comme importée sans écriture. Les parties en attente conservent leur contenu jusqu’à finalisation ou abandon ; les autres ne gardent que l’identifiant et le motif.
- Journal d’audit : `team_import.link.create`, `team_import.link.revoke`, `team_import.imported`, `team_import.pending`, `team_import.skipped`.
- Aucun mot de passe Riot ni accès au compte Riot : l’Importer lit uniquement les interfaces locales du client, comme pour l’export manuel.

## Vérifications

- [team-import-server.test.ts](../src/__tests__/team-import-server.test.ts) : code, liaison, plafond, révocation, import reconnu avec profils et tag, côté rouge avec remplaçant, parties ignorées ou en attente, finalisation par l’import manuel, inférence des postes.
- [importer-auto-link.test.jsx](../src/__tests__/importer-auto-link.test.jsx) : panneau de Parties, génération du code, finalisation, révocation, lecture seule.
- Le pilote réel (custom 5v5, coupure réseau pendant l’envoi, révocation en cours de session) se fait avec NXT5 Importer 0.4.0 ; ces tests locaux ne le remplacent pas.
