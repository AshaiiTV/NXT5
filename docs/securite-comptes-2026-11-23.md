# Sécurité des comptes — 23 novembre 2026

Durcissement de l’authentification (fonctions Netlify `auth-*`, `verify-email`).

## Changements

1. **Re-vérification du mot de passe** : un seul budget par compte (`verifyReauthenticationPassword`,
   `_lib/auth.ts`) partagé par le changement de mot de passe, le changement d’e-mail et la dissociation
   d’un compte social : 5 essais / 15 min et 20 / 24 h. Chaque essai est débité avant la vérification
   (pas de contournement par requêtes concurrentes) puis rendu si le mot de passe est correct : seuls les
   échecs comptent. Limite par IP ajoutée sur `auth-change-password` (10/min) et `auth-update-profile` (20/min).
2. **Changement d’e-mail confirmé** : la nouvelle adresse est stockée dans `users.pending_email`
   (+ `pending_email_token` haché, `pending_email_expires_at`, 24 h). Le lien est envoyé à la nouvelle
   adresse ; l’adresse ne change qu’à l’ouverture du lien par `verify-email`, depuis un navigateur connecté
   au compte (règle inchangée). À la confirmation : adresse vérifiée, liens de récupération consommés,
   autres sessions déconnectées, avis à l’ancienne adresse (si elle était vérifiée). Avis aussi envoyé à la
   demande. L’adresse en attente ne réserve rien (pas d’accaparement) : l’unicité est revérifiée à la
   confirmation (`/verified?error=in-use`). Annulation : `auth-update-profile` avec `{ cancelEmailChange: true }`.
   Une réinitialisation de mot de passe annule la demande en attente.
3. **Énumération par le temps** : `auth-request-password-reset` et `auth-register` envoient l’e-mail via
   `context.waitUntil` et répondent après un temps minimal commun de 500 ms (`_lib/response-timing.ts`).
4. **Connexion** : le budget par compte ne compte plus que les échecs (succès rendus) ; message de blocage
   orientant vers « Mot de passe oublié » ou la connexion sociale. La limite par IP reste sur chaque essai.
5. **Argon2** : l’import dynamique d’une variable n’était pas embarqué par esbuild (repli bcrypt silencieux
   en production, hachages argon2 en local). Désormais bcrypt (coût 12) partout ; les anciens hachages
   `$argon2` restent vérifiés si le module natif est présent, sinon un journal sans donnée personnelle
   (`ARGON2_UNAVAILABLE`).
6. **Plafonds d’e-mails** : 5 réinitialisations / jour / destinataire, 5 e-mails de vérification / jour /
   destinataire (inscription, renvoi, changement d’adresse), 5 demandes de changement d’adresse / jour / compte.
7. **« Rester connecté » décoché** : cookie de session de navigateur (sans Max-Age), expiration serveur 12 h.
   La session longue exige `rememberMe === true` (connexion et connexion sociale).
8. **Avis de sécurité** : e-mail après un changement et après une réinitialisation du mot de passe,
   en arrière-plan, sans jamais bloquer ni faire échouer la requête.

## Migration

`database/migrations/20261123_email_change_confirmation.sql` (`email-change-confirmation-20261123-v1`) :
trois colonnes nullables sur `users` et un index partiel sur `pending_email_token`. Reproduit dans
`database/schema.sql`. Idempotente, sans réécriture de données.

## Non traité

- Préfixe `__Host-` du cookie : renommer déconnecterait tout le monde ; à planifier.
- Normalisation NFKC des e-mails : impossible de garantir que les adresses déjà enregistrées restent
  retrouvables (non-ASCII possible) ; bénéfice faible puisque toute adresse doit être vérifiée.
