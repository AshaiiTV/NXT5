# Suppression de compte en libre-service — 30 septembre 2026

Portage de la suppression de compte de `3099fdb` (branche `feat/pricing-validation`, 14 septembre, jamais fusionnée), réécrite pour le schéma actuel. Les textes légaux reprennent ceux de `c32b78c` (`fix/legal-harmonization-20260923`), adaptés. Branche `claude/suppression-compte-20260930`, construite sur la PR #97 (`claude/audit-croise-20260929`), qui contient les lots fix1.

## Principe

La ligne `users` n’est **jamais supprimée**. `teams.owner_id` est en `ON DELETE CASCADE` : un `DELETE FROM users` effacerait les équipes du propriétaire et les données des autres membres. La fonction `nxt5_delete_account` traite explicitement chaque clé étrangère, puis anonymise la ligne du compte et la marque `deleted_at`. Un déclencheur refuse désormais le `DELETE` d’un propriétaire dont l’équipe compte d’autres membres (`ACCOUNT_OWNS_SHARED_TEAM`).

## Parcours

1. **Paramètres › Supprimer mon compte** (en bas de page). `inspect` renvoie les équipes possédées et leurs successeurs possibles, l’existence d’un mot de passe, les fournisseurs associés et une éventuelle liaison Discord.
2. **Confirmation 1 :** l’utilisateur lit les conséquences, choisit un nouveau propriétaire pour chaque équipe partagée et donne un accord distinct pour supprimer ses équipes sans autre membre. `prepare` enregistre ces choix dans `account_deletion_confirmations` : empreinte d’un jeton aléatoire, compte, session, validité de 15 minutes.
3. **Confirmation 2 :** saisie de `SUPPRIMER`, puis :
   - **mot de passe actuel**, pour un compte qui en a un ;
   - pour un compte **sans mot de passe** (connexion sociale uniquement), **reconnexion avec un fournisseur déjà associé**. Le parcours social `reauth` réutilise start, callback et finish. Comme `link`, il est lié au compte, à la session et à `social_link_revision`. `finish` vérifie que le couple (fournisseur, sujet) appartient au compte, puis enregistre une preuve dans `account_reauthentications`, valable 10 minutes pour cette session. La fonction SQL consomme cette preuve. Un autre compte chez le même fournisseur renvoie `?reauth=mismatch`. Le jeton de confirmation survit à la redirection via `sessionStorage`, sans aucun secret.
4. **`delete` :** un seul appel à `nxt5_delete_account`, atomique. Il verrouille le compte, revalide mot de passe ou preuve, confirmation, session, équipes et successeurs. Toute erreur annule l’ensemble, trace comprise.
5. **Reçu :** la référence et la date s’affichent à l’écran, puis retour à la connexion. Le jeton permet de retrouver le reçu pendant 24 h, même sans session (`status`, et au redémarrage de l’application après une réponse perdue). Le même envoi ne peut jamais s’appliquer deux fois.

**Protections de l’API** (`netlify/functions/auth-delete-account.ts`) :
- POST uniquement, `assertTrustedMutation` (origine et `Sec-Fetch-Site`), corps limité à 8 Ko ;
- quotas : 20 requêtes par minute et par IP, 10 par 5 minutes et par compte, 5 essais de mot de passe par 5 minutes et par compte ;
- `assertMatchSourceMutationEnvironment`, car les suppressions touchent les déclencheurs de publication des parties ;
- refus pour l’administrateur de plateforme configuré (`DELETION_PLATFORM_ADMIN`) ;
- aucune journalisation du mot de passe, du jeton ou des paramètres SQL.

## Décision pour chaque clé étrangère vers `users`

Recensement avec `git grep "references users" -- database/`, puis confirmé sur le schéma migré par `pg_constraint`. On compte **44 clés** : 42 existantes et 2 nouvelles. Le test `documents a treatment for every foreign key to users` échoue si une nouvelle clé apparaît sans décision. Chaque scénario vérifie aussi qu’aucune ligne ne référence encore le compte supprimé.

| Table.colonne | Règle SQL d’origine | Décision | Raison |
| --- | --- | --- | --- |
| `teams.owner_id` | CASCADE | **Transférer** au membre choisi (il devient `captain`), ou **supprimer** l’équipe si elle n’a aucun autre membre, après accord explicite | Ne jamais effacer une équipe partagée |
| `team_members.user_id` | CASCADE | Supprimer | Adhésions personnelles |
| `players.user_id` | SET NULL | **Supprimer les profils liés** : cascade sur pools, disponibilités, objectifs, notes de coaching, carnets de matchups et objectifs Discord du joueur. Les participations sont anonymisées : « Joueur supprimé », `riot_id` nul, identifiants Riot retirés du `raw` (puuid, summonerName/Id, riotIdGameName/Tagline/Name, profileIcon, summonerLevel) | Données personnelles sur la personne, historique d’équipe conservé |
| `sessions.user_id` | CASCADE | Supprimer | Accès |
| `password_reset_tokens.user_id` | CASCADE | Supprimer | Accès |
| `social_identities.user_id` | CASCADE | Supprimer | Libère l’identité externe ; une nouvelle inscription reste possible |
| `social_auth_flows.user_id` | CASCADE | Supprimer | Parcours en cours |
| `social_auth_tickets.user_id` | CASCADE | Supprimer | Parcours en cours |
| `account_reauthentications.user_id` (nouvelle) | CASCADE | Supprimer | Preuve consommée |
| `account_deletion_confirmations.user_id` (nouvelle) | CASCADE | Supprimer | Confirmation consommée |
| `account_subscriptions.user_id` | CASCADE | Supprimer | Le droit d’usage prend fin ; les achats (`purchases`, sans clé) restent pour la comptabilité |
| `account_subscriptions.updated_by` | SET NULL | Référence nulle | Action d’administration sur d’autres comptes |
| `inactivity_reminder_deliveries.user_id` | CASCADE | Supprimer | Contient l’adresse e-mail |
| `inactivity_reminder_pending.user_id` | CASCADE | Supprimer | Contient l’adresse e-mail |
| `discord_user_links.user_id` | CASCADE | Supprimer (cascade sur `discord_user_team_choices` et `discord_bot_pending`) | Liaison du compte Discord au bot |
| `discord_account_link_requests.user_id` | CASCADE | Supprimer, ainsi que les demandes non rattachées du même identifiant Discord | Identifiant Discord |
| `discord_event_responses.user_id` | CASCADE | Supprimer | Réponses personnelles aux événements |
| `discord_review_reads.user_id` | CASCADE | Supprimer | État de lecture personnel |
| `discord_review_recipients.user_id` | CASCADE | Supprimer | Destinataire personnel |
| `discord_link_codes.created_by` | CASCADE | Supprimer les codes **non consommés**, référence nulle pour les codes consommés | Un code de liaison de serveur ne doit pas rester actif |
| `matches.created_by`, `matches.reviewed_by` | SET NULL | Référence nulle | Historique partagé |
| `match_categories.created_by`, `match_archives.created_by` | SET NULL | Référence nulle | Contenu d’équipe |
| `reports.created_by` | SET NULL | Référence nulle | Débrief partagé |
| `composition_types.created_by` | SET NULL | Référence nulle | Contenu d’équipe |
| `team_invite_codes.created_by` | SET NULL | Référence nulle | Invitation d’équipe (le lien reste révocable par l’équipe) |
| `player_goals.created_by`, `player_availability.updated_by`, `player_coaching_notes.updated_by`, `player_matchup_notebooks.updated_by` | SET NULL | Référence nulle | Contenus portant sur d’autres joueurs |
| `discord_connections.created_by`, `discord_connection_tests.created_by`, `discord_routes.created_by`, `discord_group_exports.created_by` | SET NULL | Référence nulle | Configuration et historique du bot de l’équipe |
| `discord_team_events.created_by`, `discord_team_goals.created_by` | SET NULL | Référence nulle | Planning et objectifs d’équipe |
| `discord_draft_notes.author_id`, `discord_goal_updates.user_id`, `discord_player_goal_updates.user_id` | SET NULL | Référence nulle, texte conservé | Notes partagées avec l’équipe |
| `discord_community_announcements.created_by`, `discord_community_settings.updated_by` | SET NULL | Référence nulle | Administration de la plateforme |
| `access_requests.updated_by` | SET NULL | Référence nulle ; les demandes envoyées depuis **l’adresse vérifiée** du compte sont supprimées | Seule une adresse vérifiée établit l’appartenance |
| `audit_logs.user_id` | SET NULL | Auteur retiré ; cible et métadonnées vidées lorsqu’elles contiennent l’UUID, l’e-mail ou un identifiant Discord lié | Journaux sans identité, conservés 12 mois |

Les retraits d’auteur conservent `updated_at` grâce au réglage transactionnel `nxt5.preserve_updated_at`, lu par `set_updated_at()`. Un débrief ne paraît donc pas modifié le jour de la suppression. Les modifications ordinaires ne changent pas.

**Données sans clé étrangère :**
- `discord_interaction_receipts` du même identifiant Discord : supprimés ;
- `purchases` (nom du client) : conservés, obligations comptables, sans lien avec le compte ;
- `rate_limits` : empreintes supprimées après 24 h ;
- fréquentation (`audience_*`) : jamais rattachée aux comptes ;
- JSON bruts des parties et archives (`matches.raw`, `match_raw_archives`), textes libres, messages Discord déjà envoyés, profils joueurs non liés au compte : non modifiés, voir les limites ci-dessous.

## Ligne du compte et accès après suppression

`users` est conservée avec :
- `deleted_at` ;
- `account_name = deleted-<id>` et `name = Compte supprimé` ;
- `email` nul et mot de passe `!deleted`, inutilisable ;
- notifications, vérification et acceptation des textes remises à zéro ;
- `social_link_revision` incrémenté.

L’identifiant et les dates de création et de dernière activité restent.

Un déclencheur empêche toute modification ou réactivation. Un autre refuse (`ACCOUNT_DELETED`) toute nouvelle référence à un compte supprimé dans les tables d’accès et de rattachement : sessions, récupérations, identités et parcours sociaux, équipes, adhésions, profils joueur, abonnement, liaisons Discord, réponses, rappels.

Ce refus vaut aussi pour une requête déjà en cours. Le verrou `FOR KEY SHARE`, celui de la clé étrangère, attend la suppression, puis relit la ligne. Un compte inexistant reste signalé par la clé étrangère (23503).

Les colonnes d’auteur ne sont pas surveillées. Une écriture concurrente ne pourrait y pointer que vers la ligne anonymisée.

L’administration exclut les comptes supprimés de la recherche « Comptes et abonnements », de l’attribution d’un abonnement, des totaux et des comptes actifs. Les créations de comptes restent comptées à leur date.

## Traces, conservation et limites

- **Reçu** (`account_deletion_receipts`) et événement `auth.account_deleted` : ils partagent une référence aléatoire. Ils contiennent la version de politique, la date et des nombres, sans identifiant, nom, e-mail, IP ni session. Ils sont purgés après 12 mois par `auth-account-deletion-cleanup` (tous les jours à 3 h 50), qui retire aussi les confirmations et preuves expirées.
- **Publications Discord :** les messages déjà envoyés ne sont pas supprimés. Anonymiser les participations modifie l’empreinte des parties concernées. Les publications encore suivies par une connexion active peuvent donc être actualisées avec « Joueur supprimé ».
- **Ce qui n’est pas purgé automatiquement :**
  - JSON bruts importés, qui contiennent les Riot IDs des dix joueurs ;
  - textes libres des débriefs et des notes ;
  - profils joueur non liés au compte ;
  - demandes commerciales d’une adresse non vérifiée ;
  - sauvegardes Neon (30 jours) et journaux de l’hébergeur.

  Un import ultérieur peut réintroduire un Riot ID public. Les textes légaux l’annoncent et renvoient vers le contact.
- **Comptes bloqués :** un compte dont l’e-mail n’est pas vérifié voit la fenêtre de vérification avant les Paramètres. Il doit vérifier ou corriger son adresse. Un compte sans mot de passe et sans fournisseur disponible est invité à créer un mot de passe ou à écrire au contact.

## Textes légaux

`LEGAL_VERSION` passe de `2026-09-23` à `2026-09-30`, et `LEGAL_UPDATED_LABEL` à « 30 septembre 2026 ». Le libre-service change les CGU acceptées. Un formulaire d’inscription ouvert pendant le déploiement devra être rechargé.

- **Confidentialité :**
  - nouvelles sections « Suppression de ton compte » et « Traces de la suppression », reprises de `c32b78c` et complétées (reconnexion sociale, Discord, carnets, participations anonymisées, publications suivies, purge quotidienne des reçus) ;
  - « Durées de conservation » et « Connexions Google, Discord, Apple et Riot » datées du 30 septembre.
- **CGU :** « Fin d’utilisation » décrit le parcours au lieu du renvoi vers l’e-mail ; nouvelle section « Données après suppression du compte ».
- **Contact :** « Supprimer ton compte » renvoie d’abord vers Paramètres.
- **Assistant :** nouvelle fiche « Supprimer mon compte ».

## Fichiers

- **Migration :** `database/migrations/20260930_account_deletion.sql` (`account-deletion-20260930-v1`), enregistrée en fin de liste dans `tools/migration-runner.mjs`. `database/schema.sql` reçoit `users.deleted_at`. Aucune migration publiée n’est modifiée.
- **Serveur :**
  - `auth-delete-account.ts` et `auth-account-deletion-cleanup.ts` ;
  - `_lib/migrations.ts` (`assertAccountDeletionSchemaReady`) et `_lib/auth.ts` (`clearSessionCookie`) ;
  - parcours `reauth` : `_lib/social-auth.ts`, `auth-social-start.ts`, `auth-social-finish.ts` ;
  - filtres de l’administration : `admin-dashboard.ts`, `admin-account-subscriptions.ts` ;
  - fiche de l’assistant.
- **Interface :**
  - `src/pages/workspace/AccountDeletion.jsx` : section et reçu, avec `Surface`, `Badge`, `Button`, `SelectInput` et `TextInput` de `Core.jsx` ;
  - états de chargement, d’erreur (`role="alert"`) et de succès ;
  - focus replacé sur l’étape, boutons pleine largeur sur mobile, cases de 44 px avec focus cyan ;
  - fichiers modifiés : `AccountSettings.jsx`, `account-settings.css`, `AppContent.jsx` (reçu, reprise au démarrage, sortie de l’espace privé sans requête de déconnexion).

## Vérifications

- `src/__tests__/account-deletion.test.ts` (PGlite, historique complet des migrations, vrai client Neon) :
  - protections de l’API ;
  - confirmations et quota de mot de passe ;
  - confirmation expirée, autre session ou mot de passe changé ;
  - administrateur ;
  - **propriétaire d’une équipe avec d’autres membres** : transfert, données des autres membres intactes, historique conservé, participations anonymisées, `updated_at` préservé, journaux nettoyés, aucune référence restante ;
  - refus du `DELETE` direct ;
  - successeur parti, équipe solitaire, nouveau membre arrivé entre-temps, échec d’écriture de la trace (tout est annulé) ;
  - **compte uniquement social** : suppression refusée sans reconnexion, mauvais compte fournisseur refusé, preuve liée à la session et expirée, puis suppression ;
  - **compte lié à Discord** : liaison, demandes, reçus d’interaction, réponses, lectures, codes, contenus partagés conservés ;
  - reçu idempotent sans session, blocage après suppression ;
  - inventaire des clés étrangères.
- `src/__tests__/account-deletion-ui.test.jsx` : confirmations, successeur et accord distinct, envoi unique, erreurs, réponse perdue, état incertain, reconnexion sociale, reprise après redirection, mauvais compte, confirmation expirée, reçu.
- `src/__tests__/app-loading.test.jsx` : reçu retrouvé au démarrage après une réponse perdue.
- Tests adaptés :
  - `migrations.test.ts` : deux tests supposaient que leur migration était la dernière de la liste ; ils la cherchent désormais par clé ;
  - version légale dans `public-admin-tour2`, `auth-security-regressions` et `social-account-ui`.
- `npm run verify` : voir la PR.

**Non vérifié :**
- navigateur réel ;
- vrai retour OAuth Google, Discord, Apple ou Riot ;
- contention sur plusieurs connexions Neon ;
- durée de la fonction sur un compte avec un très grand historique : les mises à jour de participations déclenchent la file de publication.

## Déploiement et conflits

- Appliquer la migration (`npm run db:migrate`) avant les fonctions. La route répond 503 tant que le marqueur manque.
- **Dépend de la PR #97**, qui contient les lots fix1 et 7 migrations. Rebaser sur `main` après sa fusion ; la migration du 30 septembre reste en fin de liste.
- **Conflits textuels probables :**
  - `shared/legal.js` et `PublicPages.jsx` avec #91 (textes) et #93 (adresse de contact). Les textes utilisent `NXT5_CONTACT_EMAIL` et suivront l’adresse retenue ;
  - `tools/migration-runner.mjs` si #97 ajoute une migration.
