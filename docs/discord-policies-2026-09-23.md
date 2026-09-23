# Information sur le bot Discord — 23 septembre 2026

Les pages Confidentialité, CGU, Règlement et Contact décrivent désormais le fonctionnement du bot. La page Bot Discord donne accès aux politiques avant la configuration, même sans équipe ou sans rôle de gestion. Les ajouts suivent les sections existantes pour conserver leurs ancres.

## Périmètre

- Données reçues de Discord et données de game publiées, dont noms ou pseudonymes et statistiques des participants.
- Permission Administrateur, lecture ponctuelle de messages pour vérifier un envoi incertain et visibilité selon les permissions du salon.
- Réglages par équipe, commandes des responsables de serveur, publications manuelles et automatiques, mises à jour et tests fictifs.
- Journaux techniques, conservation, pause, déconnexion, retrait explicite et copies externes.
- Signalements et droits, y compris pour les participants sans compte NXT5.

La version juridique `2026-09-23` est synchronisée dans la page d’inscription et `netlify/functions/auth-register.ts`. Les preuves historiques d’acceptation ne sont pas réécrites ; aucun contrôle supplémentaire n’est ajouté à la connexion des comptes existants. Un formulaire d’inscription ouvert avant la mise à jour doit être rechargé.

Aucun comportement de publication, paiement, accès ou conservation n’est modifié par cette mise à jour documentaire. Elle ne constitue pas un audit complet de conformité du service ni une vérification de l’exécution des nettoyages en production.

## Sources techniques examinées

| Texte | Sources |
| --- | --- |
| Permission Administrateur et secrets serveur | `shared/discord-command.js`, `netlify/functions/_lib/discord-config.ts` |
| Rôles, code temporaire, commandes, pause et déconnexion | `netlify/functions/_lib/discord-access.ts`, `team-discord-connection.ts`, `discord-interactions.ts` |
| Données des publications et lecture ponctuelle du salon | `shared/publications/game-publication.js`, `netlify/functions/_lib/discord-client.ts`, `discord-worker.ts` |
| Publication automatique et actualisation des publications manuelles | `database/migrations/20260915_discord_publications.sql` |
| Tests fictifs et retrait explicite | `netlify/functions/_lib/discord-test.ts`, `team-discord-retry.ts` |
| Conservation, exceptions et purge quotidienne | `netlify/functions/_lib/discord-maintenance.ts`, `discord-maintenance.ts`, `_lib/auth.ts` |
| Configuration et historique conservés avec l’équipe | `database/migrations/20260915_discord_publications.sql`, `20260921_discord_connection_tests.sql` |
| Statistiques d’exploitation réservées à la plateforme | `netlify/functions/admin-discord-analytics.ts`, `_lib/discord-analytics.ts` |

Les délais de 7, 30 et 90 jours ne désignent pas une purge intégrale du bot. Les références et dernières versions publiées, les réglages et les résultats des tests restent associés à l’équipe ; les opérations non résolues sont conservées. Les suppressions de games ou d’équipes ne déclenchent pas une suppression automatique des messages sur Discord. Le texte annonce ces limites au lieu de promettre un effacement externe que le code n’effectue pas.

## Références externes consultées

- [Information des personnes et transparence — CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence).
- [Politique de confidentialité Discord](https://discord.com/privacy), notamment visibilité, conservation et transferts internationaux.
- [Permissions Discord](https://docs.discord.com/developers/topics/permissions), notamment Administrateur.
- [Conditions Discord](https://discord.com/terms) et [règles de la communauté](https://discord.com/guidelines).

Les liens Discord sont également accessibles dans les références des pages publiques concernées. Les bases juridiques décrites complètent celles du service ; l’activation par un responsable n’est pas présentée comme le consentement de tous les joueurs.
