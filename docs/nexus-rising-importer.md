# Nexus Rising : portail et collecte automatique

État des sources au 1er novembre 2026. Ce guide décrit le portail et le protocole prévu pour l’importeur ; les preuves de publication web et le pilote sur une partie réelle restent deux vérifications distinctes. Voir également le [système de tournois](nexus-rising-tournois.md).

## Accès décidés

- `/nexus-rising` est accessible sans compte NXT5 : calendrier, noms des équipes et résultats acceptés par le staff.
- Les équipes Nexus Rising sont les équipes NXT5 existantes, dans la même base. Un compte NXT5 appartenant à une équipe d’une rencontre accède aux statistiques détaillées **acceptées de cette rencontre**, y compris les adversaires de la rencontre. Avoir seulement un compte ne donne pas accès aux statistiques privées de la ligue.
- Le staff utilise les droits d’administration de plateforme existants. Il peut créer les rencontres et liaisons, examiner les contributions, accepter ou rejeter une source et révoquer une liaison.
- L’importeur fonctionne avec un code de rencontre, indépendamment de la connexion NXT5 du capitaine. Aucun mot de passe Riot n’est demandé.
- L’entrée Nexus Rising du menu NXT5 ouvre `/nexus-rising` dans le même onglet. La V0 hébergée sur `nexus-rising-admin-nxt5.ashaii.chatgpt.site` reste une maquette distincte.

## Parcours d’une rencontre

1. Le staff prépare une saison et valide les inscriptions d’équipes NXT5. Le calendrier associe obligatoirement deux équipes inscrites et approuvées ; les nouvelles rencontres ne sont plus créées à partir de simples noms d’équipe ou de Riot ID saisis librement.
2. Le staff programme la rencontre et choisit cinq joueurs dans chaque effectif NXT5 autorisé. Les dix profils et Riot ID sont conservés avec la rencontre. Dès qu’une liaison importeur existe, cette composition et la fenêtre sont verrouillées ; une modification ultérieure de l’effectif NXT5 ne réécrit pas cet historique. La fenêtre doit englober les parties du BO.
3. Le staff génère un code personnel pour un capitaine présent dans le roster. Le code est à usage unique et expire après 15 minutes. Le jeton obtenu expire 24 heures après la fin de la fenêtre de rencontre et reste révocable.
4. Dans l’onglet Nexus Rising de l’importeur, le capitaine colle le code, vérifie la rencontre et les dix joueurs, autorise l’envoi, puis active la collecte **avant la fin de la partie**. Recommandation opérationnelle : un capitaine dans chaque équipe.
5. Garder l’importeur et le client LoL ouverts. Seules les customs observées en cours après activation (ou déjà observées et sauvegardées avant une interruption) sont éligibles. L’écran de fin d’une ancienne partie au premier démarrage n’est pas importé.
6. Après la fin, l’importeur sauvegarde puis envoie les données disponibles. Une coupure déclenche des tentatives espacées ; chaque accusé de réception est mémorisé. Une révocation arrête les envois.
7. Le staff examine les contributions. Les deux capitaines ont des contributions distinctes pour une game ; une seule peut être acceptée dans toute la ligue. Les games acceptées déterminent le score du BO, le classement et la progression du tableau. La réception seule ne publie pas le résultat.

Le bouton Arrêter suspend la collecte. Un redémarrage de l’application restaure la liaison mais demande une nouvelle activation explicite. En cas d’échec persistant, l’export manuel reste accessible. « Archiver les résultats et délier la rencontre » propose une archive personnelle avant de supprimer les envois locaux de la liaison ; l’annulation du dialogue conserve la file. L’archive contient des statistiques privées : la transmettre uniquement au staff. Elle sert de récupération, pas de preuve d’authenticité Riot.

## Sources et limites des statistiques

Le collecteur lit uniquement les interfaces HTTPS locales : `/riotclient/region-locale`, `/lol-gameflow/v1/session`, l’historique de parties et `/lol-end-of-game/v1/eog-stats-block`. Aucune injection, lecture mémoire, modification du jeu, automatisation d’entrée ou désactivation de Vanguard.

La [FAQ Riot sur Vanguard](https://developer.riotgames.com/docs/faqs#vanguard) indique que les applications utilisant le LCU et les API du jeu sont censées continuer à fonctionner. Cela ne certifie pas NXT5 Importer. Le [LCU n’offre pas de garantie de stabilité](https://developer.riotgames.com/docs/lol#league-client-api) ; l’usage doit être décrit dans l’application du portail développeur Riot.

L’historique est privilégié quand sa réponse est valide. Le résumé de fin de partie sert de secours : il possède une date de fin réelle et des identifiants de participants attribués localement. **Aucune timeline d’historique ne lui est rattachée**, et aucune date de début n’est inventée. Le contrôle de fenêtre utilise sa fin mesurée et sa durée. Le catalogue du client fournit les noms internes des champions ; Data Dragon sert de secours.

Les statistiques absentes restent absentes, y compris vision, gold, dégâts et objectifs. Les positions de wards et les CS aux minutes précises dépendent d’une timeline valide. Cette version ne promet pas toutes les données Riot et ne collecte pas la télémétrie en direct.

## Réception et protection des données

- Fonctions `nexus-import-connect`, `nexus-import-session`, `nexus-import-submissions`, `nexus-registration`, `nexus-admin`, `nexus-overview` sur l’origine HTTPS NXT5 configurée. Les jetons sont envoyés dans l’en-tête Authorization, jamais dans une URL ; les redirections réseau sont refusées.
- Codes et jetons sont hachés côté serveur. Electron protège le jeton et la file par le chiffrement du système. Si ce chiffrement est indisponible, l’importeur refuse une sauvegarde en clair. L’interface n’obtient jamais le jeton.
- Le serveur valide le type, la région, les horaires, le vainqueur, les dix identités et la composition des équipes. Il répète le contrôle d’autorisation dans la transaction d’écriture ; les quotas et répétitions ne peuvent écraser une contribution existante.
- Les contributions brutes sont réservées au staff. Les vues invitée et membre utilisent un résumé à champs explicitement sélectionnés. Aucun envoi Discord/email et aucune copie dans les matchs privés d’équipe ne sont déclenchés.
- Les données envoyées par une application locale restent déclaratives. Le code de liaison authentifie un accès, **pas les chiffres fournis par Riot**. Une divergence exige une vérification staff.

Rétention effectivement implémentée : les données locales d’une contribution reçue sont retirées de la file, qui conserve un reçu ; les données en échec restent jusqu’à l’action d’archivage/abandon. Les tentatives automatiques sont bornées à douze et à 24 heures d’âge. La file est limitée à 200 entrées et à la capacité de stockage autorisée. Aucune purge automatique des tables Nexus n’est ajoutée ici. Avant ouverture, fixer les durées de conservation de la ligue et le traitement des demandes d’effacement, puis adapter la notice et l’exploitation conformément au [guide juridique existant](shopify-et-checklist-juridique.md). Les libellés d’information et la case d’autorisation locale ne valent pas certification de conformité.

## Mise en service et vérification

- Migrations : [réception importeur](../database/migrations/20261031_nexus_import.sql), puis [tournois et équipes natives](../database/migrations/20261101_nexus_tournament.sql), enregistrées dans le runner existant. Ne pas exécuter aveuglément les autres migrations en attente d’un checkout modifié. Suivre [MIGRATIONS.md](../database/MIGRATIONS.md). Les anciennes rencontres sans identité NXT5 restent des archives distinctes ; aucune correspondance n’est inventée à partir d’un nom.
- Tests : `npm --prefix importer-app test`, tests `nexus-import`, `nexus-tournament`, `nexus-tournament-flow`, `nexus-tournament-ui`, `nexus-rising-ui`, `nexus-rising-navigation` et `migrations`, puis `npm run verify`.
- Rendu importeur : `node tools/verify-nexus-importer.mjs` (API simulée, fenêtres 820/1180/1440 px). Les captures du portail utilisent aussi des réponses simulées.
- Pilote réel requis : custom 5v5, deux capitaines, comparaison des dix joueurs aux écrans de fin de partie, présence/absence de timeline, arrêt/redémarrage, réseau coupé puis rétabli et révocation pendant envoi. Vérifier explicitement le comportement avec Vanguard actif ; ne jamais demander sa désactivation.
- Publier le backend et sa migration avant de distribuer l’importeur. Un exécutable compilé localement ne remplace pas la chaîne de release officielle et ne prouve pas que le serveur est en ligne.

La release web du 1er novembre est préparée dans un checkout isolé du commit de production `d0860bc220ef61983c6fb65a4a5910ed7ebdd39b`, avec les seuls ajouts Nexus. `npm run verify` y réussit : 235 fichiers et 4 530 tests, compilation et contrôle des routes SEO inclus. Le contrôle TypeScript et l’audit des dépendances passent également. Les tests de migration couvrent le périmètre dédié, les empreintes, les schémas incomplets et la répétition. Les captures du portail vérifient les vues invité, membre et staff à 320 et 1 280 px, avec des réponses simulées. Traces locales de cette release : `artifacts/nexus-production-verify.log` et `artifacts/nexus-tournament-ui-2026-11-01/checks.json`.

Validation initiale du 31 octobre : 82 tests importeur et 65 tests Nexus/navigation/migrations réussis, compilation du site réussie. L’audit de production du site ne signalait aucune vulnérabilité. L’importeur utilise Electron 44.9.1 et electron-builder 26.15.7 ; les mises à jour compatibles réduisent son audit de 20 alertes à une alerte modérée `minimatch`, dans l’outillage de compilation (aucune élevée/critique). Décision : ne pas forcer de changements majeurs transitifs non validés ; suivre le correctif amont du builder avant la release officielle. Les motifs de compilation viennent du dépôt maîtrisé ; ne pas accepter de motifs externes non fiables. Preuve : `artifacts/nexus-importer-audit-final.json`.

Les vérifications antérieures de l’importeur et leurs artefacts appartiennent au checkout de développement. L’exécutable de bureau n’est pas distribué par cette release web. Aucun test automatisé n’a envoyé de statistiques à une ligue en production ; le pilote LoL et Vanguard reste à réaliser.
