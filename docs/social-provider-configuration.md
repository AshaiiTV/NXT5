# Connexions Google, Discord, Apple et Riot

Le compte NXT5 conserve son identifiant interne. Les identités externes sont associées par le couple fournisseur / identifiant stable. Une adresse e-mail, même vérifiée par un fournisseur, ne suffit pas à fusionner deux comptes. Un utilisateur qui possède déjà un compte doit s’y connecter puis ajouter sa méthode de connexion depuis les paramètres.

Voir aussi [les parcours, la migration et la récupération](social-auth.md).

## Configuration commune

Définir les variables de `.env.example` dans les secrets **Functions** de l’environnement concerné. Ne jamais exposer une clé via `VITE_`, le bundle du navigateur, une URL ou les journaux. Les trois nouveaux fournisseurs restent désactivés sans leur drapeau exact `true` et leur configuration complète. Riot exige en plus son approbation séparée.

`SOCIAL_AUTH_SITE_ORIGIN` vaut par défaut `https://nxt5.org`. Il doit être une origine HTTPS exacte, sans chemin ni `/` final. Pour Google, Discord et Apple, enregistrer exactement cette URL de retour :

```text
https://nxt5.org/.netlify/functions/auth-social-callback
```

Pour un environnement de recette, utiliser une origine HTTPS fixe et des identifiants dédiés. Les secrets de production ne doivent pas être disponibles dans les Deploy Previews. Le fournisseur appelé au retour est déterminé par la transaction serveur, jamais par une identité soumise par le navigateur.

## Google

### Mise en service prioritaire — 23 septembre 2026

Le projet Google Cloud **NXT5**, identifiant `nxt5-509508`, a été créé. [Reprendre la configuration Google Auth Platform](https://console.cloud.google.com/auth/overview/create?project=nxt5-509508&supportedpurview=project). Le nom NXT5 est renseigné dans le formulaire initial ; la sélection du contact d’assistance public attend le choix du propriétaire. Aucun client OAuth ni secret n’a encore été créé, et Google reste désactivé sur le site.

Valeurs à enregistrer pour le client Web :

| Paramètre | Valeur |
| --- | --- |
| Audience | Externe |
| Nom de l’application | NXT5 |
| Domaine autorisé | `nxt5.org` |
| Page d’accueil | `https://nxt5.org/` |
| Politique de confidentialité | `https://nxt5.org/confidentialite` |
| Conditions d’utilisation | `https://nxt5.org/conditions` |
| URI de redirection | `https://nxt5.org/.netlify/functions/auth-social-callback` |
| Autorisations | `openid email` |

Google est la première connexion à mettre en service. Apple et Discord restent désactivés ; la demande Riot est déjà envoyée et attend sa réponse. La prévisualisation de la PR 60 est publiée, mais le code d’authentification sociale n’est pas encore en production. La migration `social-auth-20260923-v1` doit être confirmée sur la base cible avant l’activation.

### Paramètres techniques

Créer un client OAuth de type application Web dans Google Cloud, configurer le nom NXT5, le domaine, les pages de confidentialité et conditions ainsi que l’URL de retour ci-dessus. Renseigner `GOOGLE_AUTH_CLIENT_ID` et `GOOGLE_AUTH_CLIENT_SECRET`, puis `GOOGLE_AUTH_ENABLED=true` lorsque le client est prêt pour le public visé. Les autorisations demandées sont `openid email` ; le code serveur emploie PKCE S256 et un nonce. Aucun accès Drive, Contacts ou Calendar n’est demandé. [Configuration et flux OpenID Connect Google](https://developers.google.com/identity/openid-connect/openid-connect), [capacités publiées par Google](https://accounts.google.com/.well-known/openid-configuration).

## Discord

Créer/configurer une application dans le portail développeur Discord, enregistrer l’URL de retour OAuth2 puis renseigner `DISCORD_AUTH_CLIENT_ID` et `DISCORD_AUTH_CLIENT_SECRET`. Activer `DISCORD_AUTH_ENABLED=true` lorsque cette configuration est prête. Ces identifiants servent à la connexion utilisateur ; le jeton du bot de publication n’intervient pas.

Le flux demande uniquement `identify email`, échange le code côté serveur et lit `/users/@me`. L’identifiant Discord stable sert de référence ; le booléen `verified` détermine si l’adresse est vérifiée. La connexion ne rejoint aucun serveur et n’accorde aucune permission au bot. Le flux OAuth confidentiel documenté n’annonce pas PKCE ; la transaction est liée au navigateur par un état à usage unique. [OAuth2 Discord](https://docs.discord.com/developers/topics/oauth2), [profil utilisateur Discord](https://docs.discord.com/developers/resources/user).

## Apple et préparation de la future application

Dans Apple Developer, créer un **Services ID** web et l’associer à un **Primary App ID** avec Sign in with Apple. Choisir cette association en tenant compte de la future application iOS : elle permet de préparer la continuité entre les identités du site et celles de l’app. Enregistrer le domaine `nxt5.org` et l’URL de retour ci-dessus. [Configuration Apple pour le Web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web).

Renseigner `APPLE_AUTH_CLIENT_ID` avec le Services ID, `APPLE_AUTH_TEAM_ID`, `APPLE_AUTH_KEY_ID` et `APPLE_AUTH_PRIVATE_KEY` avec la clé privée Sign in with Apple `.p8` au format PEM (P-256). Le serveur signe un secret client ES256 de cinq minutes à chaque échange. Activer `APPLE_AUTH_ENABLED=true` après configuration et validation réelles.

L’autorisation Apple demande `email` et utilise `response_mode=form_post`. Le retour HTTP POST est traité côté serveur avant une redirection vers la finalisation sur NXT5. Le nonce est vérifié dans le jeton signé ; les données `user` non signées envoyées par le navigateur ne sont pas utilisées comme preuve d’identité. Apple ne publie pas de prise en charge PKCE dans sa découverte actuelle. [Autorisation Apple](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.), [découverte Apple](https://appleid.apple.com/.well-known/openid-configuration).

Une adresse `@privaterelay.appleid.com` est acceptée. Enregistrer les sources d’envoi NXT5 et configurer SPF/DKIM pour acheminer les e-mails via le relais privé Apple. Cette étape conditionne la réception des messages sur ces adresses. [Relais privé Apple](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service).

L’application native future nécessitera son propre parcours de connexion et sa configuration de distribution. La table des identités permet de conserver le compte NXT5 lors de cet ajout ; ne pas élargir dès maintenant les audiences JWT acceptées à des clients mobiles non configurés.

## Riot après approbation

Conserver `RIOT_RSO_ENABLED=false` et `RIOT_RSO_APPROVAL_CONFIRMED=false` jusqu’à l’autorisation RSO. Une clé API Riot de production ne vaut pas approbation RSO. `RIOT_RSO_SITE_ORIGIN` doit correspondre à `SOCIAL_AUTH_SITE_ORIGIN`. Conserver dans `RIOT_RSO_REDIRECT_URI` **exactement l’URL déjà soumise ou approuvée par Riot** ; aucune nouvelle soumission n’est présumée nécessaire. Le chemin d’origine `https://nxt5.org/.netlify/functions/auth-riot-callback` reste pris en charge et constitue la valeur par défaut. Le callback commun `https://nxt5.org/.netlify/functions/auth-social-callback` est également accepté s’il correspond à la configuration enregistrée auprès de Riot. Seuls ces deux chemins exacts sur l’origine configurée sont autorisés.

Renseigner le client approuvé et la méthode de secret fournie (`client_secret_basic` ou `private_key_jwt`). Pour la seconde, configurer la clé RSA, son `kid` et l’audience explicitement confirmée. Le protocole conserve la validation de découverte, le nonce et PKCE. L’identité retenue est le **PUUID retourné par ACCOUNT-V1 authentifié**, jamais un Riot ID tapé ou une adresse e-mail supposée. Le fournisseur ne fournit pas d’adresse e-mail à ce parcours. [Documentation OAuth Riot](https://support-developer.riotgames.com/hc/en-us/articles/22897607341075-OAuth-Client-Documentation).

## Validation avant activation

Les tests automatiques vérifient signatures, audience, émetteur, expiration, nonce, `azp`, `at_hash`, clés Apple, adresses non vérifiées, réponses malformées et configurations inactives. Ils ne remplacent pas un essai réel avec les identifiants enregistrés. Avant activation publique, valider inscription, connexion, annulation, rattachement à un compte existant et retour Apple depuis un navigateur mobile. Vérifier aussi la réception d’un e-mail via le relais Apple.

Les jetons d’accès, de rafraîchissement et d’identité restent en mémoire pendant l’échange. Le résultat conserve uniquement le fournisseur, son identifiant stable, l’adresse et son statut de vérification, ainsi qu’un éventuel nom d’affichage. Chaque appel fournisseur impose un délai maximal et une taille de réponse maximale ; les erreurs exposées au client sont génériques.

Références consultées le 23 septembre 2026. Les règles de distribution mobile devront être vérifiées de nouveau lors de la préparation de l’application.
