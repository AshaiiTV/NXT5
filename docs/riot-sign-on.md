# Riot Sign On dans NXT5

État au 23 septembre 2026 : intégration préparée, **inactive par défaut**. Aucun accès RSO n’est présumé accordé, aucune demande Riot n’est soumise par ce changement, aucun secret réel ni appel authentifié Riot n’est nécessaire aux tests. Une clé `RIOT_API_KEY` de l’API de jeu ne suffit pas à activer RSO.

## Références et choix de protocole

La [présentation RSO de Riot](https://support-developer.riotgames.com/hc/en-us/articles/22801670382739-RSO-Riot-Sign-On) réserve les clients RSO aux applications de production approuvées. La [documentation League of Legends](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends) indique le parcours code et l’identification par `GET /riot/account/v1/accounts/me`, avec le jeton d’accès dans l’en-tête `Authorization: Bearer`. Elle précise que les clusters Europe, Americas et Asia renvoient les mêmes données de compte.

Les guides liés par Riot sont [Client Secret Basic](https://docs.google.com/document/d/1_8i2PvPA3edFHIh1IwfO5vs5rcl04O62Xfj0o7zCP3c/edit) et [Private Key JWT](https://docs.google.com/document/d/e/2PACX-1vTSthxkWOIqPFe8Xqqjv4Ona5pRa5W3X6bLg4I47X15gJjG9ae-HU5a0by7VIVLWdPMgB9fTr5gvQcY/pub). Le second contient les deux modes d’authentification : les anciens clients peuvent conserver un secret Basic, les nouveaux reçoivent des éléments pour `private_key_jwt`. L’éditeur du premier document n’a pas fourni son contenu à l’outil de lecture ; les exemples Basic ont été vérifiés dans le second guide publié.

Le [document de découverte officiel](https://auth.riotgames.com/.well-known/openid-configuration), consulté le 23 septembre 2026, annonce Authorization Code, les deux modes de client ci-dessus, PKCE `S256` et des signatures d’ID token RSA/ECDSA. Le module relit ces capacités avant l’autorisation et l’échange et refuse une réponse incompatible. Les URL d’émetteur, d’autorisation, de jetons et de JWKS sont fixées au domaine officiel ; une découverte ne peut pas substituer un autre serveur. Les requêtes serveur refusent les redirections HTTP, limitent la taille de réponse et expirent après dix secondes.

NXT5 demande uniquement `openid`, avec `state`, `nonce` et PKCE `S256`. Il ne demande ni e-mail, ni profil étendu, ni `offline_access`. La réponse de jetons doit avoir un ID token signé : [jose](https://github.com/panva/jose) vérifie sa signature, son émetteur, son audience, son expiration, son émission, son sujet et le nonce enregistré. Le module vérifie également `azp` lorsqu’il est présent ou nécessaire et `at_hash` lorsqu’il est fourni. Une tolérance d’horloge de trente secondes est appliquée ; les ID tokens datant de plus de dix minutes sont refusés.

Le **PUUID reçu par l’endpoint authentifié `accounts/me`** est l’unique clé d’identité Riot. Le `sub` OIDC ne lui est pas substitué. Les jetons d’accès, d’identité et l’éventuel refresh token inattendu sont abandonnés après l’échange en mémoire ; aucun n’est renvoyé au navigateur, enregistré en base ou journalisé. Aucun rafraîchissement périodique du compte Riot n’est réalisé.

## Parcours et conservation des comptes

- Depuis Paramètres, un utilisateur NXT5 authentifié choisit « Associer mon compte Riot ». Le retour doit correspondre au même utilisateur et à la même session NXT5 ; un changement de compte ou de session impose de recommencer.
- Depuis Connexion, « Se connecter avec Riot » retrouve uniquement une identité déjà associée. Sinon, l’utilisateur doit se connecter ou terminer l’inscription NXT5 habituelle, puis associer Riot depuis ses paramètres. Aucun compte sans mot de passe ni fusion automatique n’est créé.
- L’unicité en base interdit d’associer un même PUUID à deux utilisateurs ou plusieurs PUUID à un même utilisateur. Les conflits ne révèlent aucune information sur l’autre compte.
- La dissociation exige le mot de passe NXT5 actuel et un compte disposant d’un identifiant et d’un mot de passe utilisables. Elle conserve la session courante, révoque les autres sessions, supprime les associations et les parcours d’association en attente, puis invalide les retours déjà en cours par une révision du compte. Elle ne change pas les identifiants internes, les équipes, droits, rosters, imports ou historiques.

`players.riot_id` reste une donnée déclarative et `players.user_id` reste un rattachement au roster. Ni l’un ni l’autre ne participe à l’autorisation RSO. Les changements d’e-mail et récupérations par mot de passe existants restent applicables.

Le dépôt de référence ne contient pas de fonction `auth-delete-account` ni de suppression autonome du compte. La demande de suppression conserve son parcours privé actuel via Contact. Lorsque la ligne `users` est effectivement supprimée, les clés étrangères `ON DELETE CASCADE` retirent l’identité Riot et ses associations en attente. Toute future suppression autonome doit conserver cette suppression effective et ses contrôles habituels.

## Migration

Exécuter `npm run db:migrate` avec la connexion serveur prévue pour l’environnement concerné **avant toute activation**. Le runner inclut [20260923_riot_sign_on.sql](../database/migrations/20260923_riot_sign_on.sql) ; aucune création de table ne se fait dans les requêtes web.

`database/schema.sql` est le baseline déjà enregistré avec une somme de contrôle : il reste inchangé. Une base neuve doit également passer par le runner complet. Le contrôle `assertRiotSchemaReady` vérifie séparément la migration RSO ; le login par mot de passe conserve sa version de schéma précédente.

La migration ajoute :

- `users.riot_link_revision`, compteur empêchant une association ou session issue d’un parcours invalidé par une dissociation ;
- `riot_identities`, une ligne par utilisateur : PUUID unique, Riot ID reçu à l’association facultatif (`game_name`, `tag_line`) et date d’association ;
- `riot_auth_flows`, état provisoire de cinq minutes : empreintes du state et du cookie navigateur, parcours `login`/`link`, compte/session/révision pour l’association, nonce, vérificateur PKCE et préférence de durée de session ;
- `unlink_riot_identity`, opération atomique de dissociation, avec verrou sur l’utilisateur et vérification du mot de passe et de la session déjà contrôlés par le serveur.

Le callback réclame le state par `DELETE … RETURNING` : deux requêtes concurrentes ne peuvent pas récupérer le même état. La session de liaison et le cookie de navigateur sont contrôlés ; les destinations applicatives sont des chemins locaux fixés par le serveur. Le cookie de flux `__Host-nxt5_riot_flow` est `Secure`, `HttpOnly`, `SameSite=Lax`, sans domaine et limité à cinq minutes. Les endpoints de mutation exigent l’origine HTTPS configurée et une requête JSON ; les limites de débit du projet s’appliquent.

Les états abandonnés expirent après cinq minutes et ne peuvent plus être consommés ; le nettoyage planifié quotidien à 03:45 UTC et le démarrage d’un nouveau parcours les retirent physiquement. Les nonce/vérificateurs abandonnés peuvent donc subsister jusqu’au prochain nettoyage, sans être utilisables après expiration. Les flux d’association sont aussi supprimés à la dissociation et avec la suppression du compte. Ne pas exporter ces colonnes dans les outils d’analytics ou les logs. Contrôler le bon fonctionnement du nettoyage dans l’environnement déployé.

## Variables serveur

Configurer les valeurs uniquement dans les secrets/variables **Netlify Functions** de l’environnement approuvé. Aucun nom `VITE_` ou `PUBLIC_`, aucune valeur dans Git, dans le chat ou dans une commande qui l’imprimerait. Les contrôles locaux utilisent des valeurs fictives générées en mémoire.

| Variable | Valeur ou rôle |
| --- | --- |
| `RIOT_RSO_ENABLED` | `true` seulement au moment d’une activation expressément autorisée. Absente ou autre valeur : flux inactif. |
| `RIOT_RSO_APPROVAL_CONFIRMED` | `true` seulement après vérification de l’approbation du client, de son type, des URI et des capacités ci-dessous. Cette déclaration opérateur n’est pas une vérification automatique de l’approbation par Riot. |
| `RIOT_RSO_CLIENT_ID` | Identifiant du client RSO approuvé, obligatoire. |
| `RIOT_RSO_CLIENT_AUTH_METHOD` | Exactement `client_secret_basic` ou `private_key_jwt`, selon l’approbation. Aucun choix implicite. |
| `RIOT_RSO_SITE_ORIGIN` | Origine HTTPS exacte sans slash final. Défaut : `https://nxt5.org`. Un autre environnement exige une origine explicitement approuvée. |
| `RIOT_RSO_REDIRECT_URI` | URI HTTPS exacte enregistrée chez Riot. Défaut : `https://nxt5.org/.netlify/functions/auth-riot-callback`. Même origine que ci-dessus, chemin inchangé, sans paramètres ni fragment. |
| `RIOT_RSO_POST_LOGOUT_REDIRECT_URI` | URI approuvée après déconnexion. Défaut : `https://nxt5.org/connexion`. Même origine, chemin `/connexion`, sans paramètres ni fragment. |
| `RIOT_RSO_ACCOUNT_REGION` | `europe` par défaut ; également `americas` ou `asia`. Choisir le cluster proche du serveur, sans l’utiliser comme preuve de la région de jeu du joueur. |
| `RIOT_RSO_CLIENT_SECRET` | Secret serveur requis exclusivement pour `client_secret_basic`. |
| `RIOT_RSO_PRIVATE_KEY` | Clé privée PEM RSA, au moins 2048 bits, requise exclusivement pour `private_key_jwt`. Les retours à la ligne littéraux ou encodés `\n` sont acceptés. |
| `RIOT_RSO_PRIVATE_KEY_ID` | `kid` de la clé publique enregistrée pour le client approuvé. Vérifier la correspondance avec Riot. |
| `RIOT_RSO_PRIVATE_KEY_AUDIENCE` | Audience d’assertion explicitement confirmée pour le client approuvé : `https://auth.riotgames.com/token` ou `https://auth.riotgames.com`. Aucun défaut ni tentative de repli automatique. |

Pour `private_key_jwt`, le serveur signe une nouvelle assertion `RS256` avec `iss` et `sub` égaux au client, un `jti` aléatoire et une validité de soixante secondes. Il n’utilise pas le JWT de démonstration valable cent ans mentionné dans le tutoriel Riot. Celui-ci ne fixe pas les claims de l’assertion générée : confirmer l’audience, le `kid` et la possibilité de signer de nouvelles assertions avec les paramètres effectivement remis. Une clé ECDSA de client ou toute autre méthode approuvée nécessite une adaptation explicite avant activation ; elle est refusée par cette version. La validation des ID tokens Riot accepte, elle, les algorithmes RSA et ECDSA autorisés et annoncés par la découverte.

L’URI de retour après déconnexion est maintenue cohérente avec le formulaire préparé. Cette version termine la session **NXT5** par son mécanisme existant ; elle ne conserve pas d’ID token pour déclencher une fermeture globale de la session Riot. Dissocier NXT5 ne supprime pas le compte Riot et ne prétend pas révoquer le consentement chez Riot.

## Activation et validation réelle

1. Obtenir l’accès RSO séparément et relever les valeurs réellement approuvées. Ne pas interpréter la préparation de ce code comme une approbation Riot.
2. Vérifier explicitement Authorization Code, `openid`, PKCE `S256`, nonce renvoyé dans l’ID token, signatures d’ID token compatibles et accès `accounts/me`. La découverte publique confirme les capacités du serveur ; elle ne garantit pas l’octroi de ces capacités au client NXT5.
3. Vérifier l’authentification du client reçue et les paramètres privés ci-dessus. Si une exigence diffère, laisser les deux drapeaux d’activation désactivés et adapter/tester le module ; ne pas supprimer PKCE ou la vérification du nonce pour contourner un refus.
4. Appliquer la migration, configurer les variables serveur de l’environnement approuvé et vérifier que les identifiants de production ne sont pas hérités par les Deploy Previews. L’origine du callback ne doit pas venir d’un en-tête de requête ou d’un paramètre navigateur.
5. Après autorisation explicite d’activation, effectuer un essai avec de vrais comptes de test consentants : liaison, connexion, Riot non associé, refus, expiration, changement de compte, conflit, dissociation puis reconnexion par mot de passe. Vérifier le type de jeton et les scopes effectivement renvoyés. Une réponse avec un scope autre que `openid` est refusée par cette version.
6. Vérifier les URI approuvées, les cookies HTTPS et l’absence de jetons/codes dans les traces applicatives et analytics. Le code de retour OAuth arrive nécessairement sur le callback ; éviter de collecter sa query string dans tout outil d’observabilité ou proxy ajouté autour du site.

Pour arrêter les nouveaux parcours, retirer `RIOT_RSO_ENABLED=true`. Le démarrage et le callback RSO refusent alors proprement et l’interface indique l’indisponibilité ; les comptes NXT5 et mots de passe existants continuent de fonctionner. La lecture de l’association par son propriétaire et la dissociation par mot de passe restent disponibles sans identifiant RSO ni appel Riot, sous réserve de la migration et de l’origine HTTPS locale valides. Ce drapeau ne révoque pas les sessions NXT5 déjà établies. Conserver la migration et les identités lors d’un arrêt temporaire, sauf demande de suppression correspondante.

## Vérifications locales

`src/__tests__/riot-rso-protocol.test.ts` utilise exclusivement un `fetch` simulé et des clés de test générées localement : configuration absente/invalide, URI exactes, capacité découverte, S256, échange Basic et assertion privée signée, vérification cryptographique et claims OIDC, erreurs réseau/jetons et preuve d’identité `accounts/me`. Aucun jeton réel ne doit être ajouté aux fixtures.

Les tests des endpoints complètent les cas de navigateur/session, state à usage unique, conflits et concurrence, dissociation, suppression par cascade et conservation des comptes/droits. `npm run verify` exécute le contrôle TypeScript, les tests du dépôt et la construction de l’interface. Les résultats de ces contrôles locaux ne certifient ni l’approbation Riot ni le fonctionnement d’un client réel : l’étape de validation avec les identifiants approuvés reste nécessaire.

Les suites PGlite exécutent PostgreSQL en mémoire mais sérialisent leurs requêtes. Pour vérifier les attentes de verrous avec des connexions réellement indépendantes, lancer aussi :

```sh
node tools/verify-riot-concurrency.mjs --postgres-bin-dir=/chemin/vers/postgresql/bin
```

Le répertoire doit contenir `initdb`, `pg_ctl` et `postgres`. Le lanceur crée systématiquement une instance jetable dans `/tmp`, applique toutes les migrations du dépôt, utilise un socket Unix privé et désactive l’écoute TCP (`listen_addresses=''`). Il n’accepte aucune URL de base distante, ne charge aucun fichier `.env`, puis arrête et supprime son instance. `src/__tests__/riot-rso-postgres.test.ts` est ignoré lors du test standard et activé uniquement par ce lanceur. Les tests exécutent les requêtes de production d’association, création de session et consommation du state, ainsi que la fonction SQL de dissociation ; ils attendent une contention effectivement observée dans `pg_stat_activity` avant de libérer le verrou.

Validation locale du 23 septembre 2026 : les douze scénarios passent sur PostgreSQL 18.4 natif (macOS ARM64). Ils couvrent les deux ordres connexion/dissociation et association/dissociation, la révocation de session pendant une attente, l’unicité du PUUID et de l’utilisateur, le rejeu du callback sur deux connexions ainsi que l’expiration du state ou de la session pendant une attente de verrou suivie d’un rollback. Les binaires temporaires provenaient de `@embedded-postgres/darwin-arm64@18.4.0-beta.17`, avec contrôle SHA-512 de l’archive ; aucune dépendance PostgreSQL supplémentaire n’est ajoutée au projet.
