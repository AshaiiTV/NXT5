# Inscription et connexions externes NXT5

Implémentation préparée le 23 septembre 2026 sur `feat/social-login-20260923`. Les quatre fournisseurs sont désactivés tant que leur configuration serveur n’est pas complète. Leur activation réelle nécessite les identifiants des portails et les essais décrits dans [la configuration des fournisseurs](social-provider-configuration.md). Une clé d’API Riot ou un jeton du bot Discord ne sont pas des identifiants de connexion utilisateur.

## Parcours

- E-mail et mot de passe : parcours existant conservé.
- Google, Discord, Apple ou Riot déjà associé : connexion au même identifiant utilisateur NXT5, avec ses équipes, données, permissions et abonnement existants.
- Première connexion externe : formulaire de confirmation du pseudo, de l’e-mail de récupération et des textes en vigueur. Aucun mot de passe NXT5 n’est demandé. Un e-mail différent ou non vérifié par le fournisseur nécessite une vérification NXT5. L’adresse masquée Apple est acceptée ; Riot demande une adresse de récupération car le scope utilisé ne fournit pas d’e-mail.
- Adresse déjà utilisée : invitation à se connecter au compte existant, puis à associer le service depuis Paramètres. Aucune fusion automatique par adresse e-mail, Riot ID déclaré ou pseudo.
- Association : départ depuis une session NXT5 active, retour lié au même utilisateur et à la même session. Une identité fournisseur ne peut appartenir qu’à un compte ; un compte ne peut associer qu’une identité par fournisseur.
- Dissociation : confirmation par le mot de passe NXT5 pour conserver un accès utilisable. La session courante est conservée, les autres sont révoquées et les associations en cours sont invalidées.
- Premier mot de passe et récupération : lien à usage unique reçu par e-mail. La récupération termine toutes les sessions, retire les connexions externes et invalide les parcours d’association en cours. L’utilisateur peut les associer à nouveau après connexion avec son nouveau mot de passe. Cette règle empêche qu’une ancienne connexion externe continue d’accéder à un compte récupéré par son propriétaire.

Les invitations d’équipe et destinations internes autorisées sont conservées pendant les allers-retours. La création reste une action explicite, même après authentification chez le fournisseur. Les boutons publics ne s’affichent que pour les services réellement configurés.

## Données et protections

L’authentification historique PostgreSQL et ses sessions serveur sont conservées. `social_identities` ajoute une correspondance `(provider, subject)` vers `users.id`. Pour Riot, le sujet enregistré est le PUUID reçu par l’API authentifiée, pas le `sub` OIDC ni un Riot ID saisi. Le schéma peut accueillir les identités de l’application mobile future ; le parcours natif et ses clients ne sont pas activés par cette version.

Les états OAuth ont cinq minutes de validité et sont consommés atomiquement, avec une empreinte d’un cookie navigateur aléatoire. Les ID tokens Google, Apple et Riot sont vérifiés cryptographiquement (émetteur, audience, expiration, émission, nonce, claims complémentaires). Google et Riot utilisent PKCE S256. Discord lit le profil auprès de l’API authentifiée avec `identify email` ; aucune adhésion à un serveur ni permission de bot n’est accordée.

Apple revient par un POST intersite. Le cookie temporaire de parcours utilise `SameSite=None; Secure; HttpOnly` pendant cette étape. Le callback échange le code, vérifie l’identité et écrit un résultat temporaire ; une redirection 303 vers une route du site permet ensuite de relire la session NXT5 `SameSite=Lax`. Le résultat est lié au navigateur et consommé une seule fois. Les autres étapes utilisent des cookies Lax. Aucun code ou jeton n’est propagé dans l’URL de finalisation.

La base conserve seulement l’identité externe, son nom d’affichage et sa date d’association. Les informations de création de compte restent au plus cinq minutes utilisables dans un ticket. Les jetons fournisseur ne sont jamais conservés. Les appels réseau imposent délais, tailles maximales et refus des redirections. Les erreurs de ces routes ne journalisent pas les réponses fournisseurs, secrets ou paramètres SQL.

Les verrous sur l’utilisateur et la révision `social_link_revision` empêchent les retours d’association/connexion déjà en cours de rétablir un accès supprimé. Les connexions et changements de mot de passe vérifient également les identifiants et la session encore valides lors de l’écriture.

## Migration et déploiement

1. Exécuter `npm run db:migrate` sur la base de l’environnement concerné avant l’activation. Le runner applique `20260923_social_auth.sql` dans sa transaction habituelle.
2. La migration ajoute les tables sociales, la révision utilisateur, un instantané d’e-mail aux liens de récupération et la fonction atomique de récupération. Elle **invalide les anciens liens de réinitialisation encore inutilisés**, car ils ne comportent pas cet instantané : les utilisateurs doivent en demander un nouveau. Les comptes, mots de passe, données d’équipes et abonnements sont conservés.
3. Déployer le code avec les drapeaux des fournisseurs désactivés. L’e-mail/mot de passe continue de fonctionner avant la migration ; les opérations sociales exigent la nouvelle version du schéma. La récupération refuse une migration sociale partielle.
4. Configurer un fournisseur avec son callback HTTPS exact et des secrets limités aux Functions de cet environnement. Ne pas hériter des secrets de production dans les previews. Tester avec un compte de recette puis activer le service concerné. Riot exige son approbation séparée.
5. Contrôler le nettoyage planifié `auth-social-cleanup` à 03:45 UTC. Les états et tickets périmés deviennent immédiatement inutilisables, puis sont retirés physiquement au démarrage suivant ou au nettoyage quotidien.

Retirer le drapeau d’un fournisseur arrête les nouveaux démarrages, callbacks et inscriptions en attente. Les comptes et associations sont conservés ; une association peut encore être dissociée avec le mot de passe NXT5. Les sessions NXT5 déjà établies continuent jusqu’à leur expiration ou révocation.

Les clés étrangères suppriment les identités et parcours associés lorsque `users` est effectivement supprimé. Le parcours actuel de demande d’effacement via Contact continue de s’appliquer ; cette évolution n’introduit pas de nouvel écran de suppression du compte.

## Vérification

`npm run verify` lance TypeScript, les tests du dépôt et la construction Vite. Les suites ajoutées couvrent les signatures réelles de jetons de test, les refus de claims/configuration, les requêtes HTTP et contraintes PostgreSQL via PGlite, les doublons, les tentatives de rejeu, le retour Apple et la récupération concurrente. Aucune clé réelle ni requête d’authentification d’un utilisateur réel n’est nécessaire à ces tests.

Le rendu local est contrôlé entre 320 et 1440 px avec des réponses API fictives signalant les différents états. Cela vérifie l’interface ; les authentifications réelles et les e-mails relayés Apple doivent encore être vérifiés avec les clients enregistrés.

Résultats locaux du 23 septembre 2026 : TypeScript et construction Vite réussis ; suites ciblées des protocoles (139 tests), des parcours PostgreSQL et de récupération (37 tests), et de l’interface avec chargement/routage (51 tests) réussies. La dernière exécution complète compte 1 552 succès et 6 délais dépassés à 5 secondes dans les suites existantes `migrations.test.ts` et `review-backfill.test.jsx`, sans échec d’assertion. Une autre vérification du dépôt tournait sur la même machine lors du diagnostic ; une exécution complète sans cette concurrence reste à confirmer avant fusion.
