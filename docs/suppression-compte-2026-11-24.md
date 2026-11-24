# Suppression de compte en libre-service — 24 novembre 2026

Remplace la PR #110 (`claude/suppression-compte-v2-20260930`, 30 septembre, jamais fusionnée, environ 186 commits de retard). Branche `claude/suppression-compte-v3-20261124`, construite sur `main` à jour (après #303, #304 et #305). La branche #110 et `feat/pricing-validation` sont conservées.

## Reprise du 24 novembre

**Ce qui existait déjà sur `main` :**
- suppression **par l’administration** (`admin-account-lifecycle.ts`, #304) : suspension, réactivation et suppression d’un compte avec inventaire confirmé des équipes possédées, garde Nexus. Cette suppression fait un vrai `DELETE FROM users` et efface en cascade les équipes possédées : elle reste réservée à l’administration ;
- transfert de propriété d’une équipe par l’administration (`admin-team-transfer.ts`) ;
- garde Nexus Rising (`_lib/nexus-team-lifecycle.ts`) ;
- budget commun des essais de mot de passe (`verifyReauthenticationPassword`, #303) et alertes de sécurité par e-mail (`_lib/account-notices.ts`) ;
- changement d’e-mail confirmé (`users.pending_email*`, #303), liaison Discord par le bot (#302).

Aucune suppression **en libre-service** n’existait : rien de #110 n’était déjà présent. Tout a été repris, puis adapté :
- migration renumérotée `20261124_account_deletion.sql` (`account-deletion-20261124-v1`), placée **après** la dernière migration de `main` ; l’ancienne clé `account-deletion-20260930-v1` n’a jamais été appliquée ;
- **7 nouvelles clés étrangères** vers `users` traitées (49 existantes, 51 avec les 2 tables créées par la migration) : `team_opponents.created_by`, `opponent_drafts.imported_by`, `nexus_registrations.registered_by`, `scrim_offers.created_by`, `scrim_requests.created_by`, `team_import_links.created_by`, `draft_rooms.created_by` ;
- `users.pending_email`, `pending_email_token`, `pending_email_expires_at` effacés ; l’adresse en attente est aussi retirée des journaux ;
- une équipe sans autre membre inscrite à une saison Nexus Rising en cours n’est pas supprimée (`NEXUS_TEAM_ENGAGED`, 409), même règle que la suppression d’équipe ;
- le garde contre le `DELETE` direct laisse passer la suppression administrative existante, et elle seule, par `set_config('nxt5.admin_account_delete','on',true)` dans sa transaction ;
- le mot de passe est vérifié avec le budget commun de #303 au lieu d’un quota propre ;
- un dernier e-mail « Ton compte NXT5 a été supprimé » part vers l’adresse vérifiée (lue avant la suppression, jamais conservée) ;
- interface : section traduite (anglais, espagnol) avec `t()` et `src/i18n/account-deletion-overrides.js`, reçu affiché par `AppRouter.jsx` (nouveau point d’entrée depuis #305), section « Abonnement » retirée de main donc non réintroduite ;
- textes légaux portés dans `LegalPage.jsx` (découpage de #305), version `2026-11-24`.

## Principe

La ligne `users` n’est **jamais supprimée**. `teams.owner_id` est en `ON DELETE CASCADE` : un `DELETE FROM users` effacerait les équipes du propriétaire et les données des autres membres. La fonction `nxt5_delete_account` traite explicitement chaque clé étrangère, puis anonymise la ligne du compte et la marque `deleted_at`. Un déclencheur refuse désormais le `DELETE` d’un propriétaire dont l’équipe compte d’autres membres (`ACCOUNT_OWNS_SHARED_TEAM`).

## Parcours

1. **Paramètres › Supprimer mon compte** (en bas de page). `inspect` renvoie les équipes possédées et leurs successeurs possibles, l’existence d’un mot de passe, les fournisseurs associés et une éventuelle liaison Discord.
2. **Confirmation 1 :** l’utilisateur lit les conséquences, choisit un nouveau propriétaire pour chaque équipe partagée et donne un accord distinct pour supprimer ses équipes sans autre membre. `prepare` enregistre ces choix dans `account_deletion_confirmations` : empreinte d’un jeton aléatoire, compte, session, validité de 15 minutes.
3. **Confirmation 2 :** saisie de `SUPPRIMER`, puis :
   - **mot de passe actuel**, pour un compte qui en a un ;
   - pour un compte **sans mot de passe** (connexion sociale uniquement), **reconnexion avec un fournisseur déjà associé**. Le parcours social `reauth` réutilise start, callback et finish. Comme `link`, il est lié au compte, à la session et à `social_link_revision`. `finish` vérifie que le couple (fournisseur, sujet) appartient au compte, puis enregistre une preuve dans `account_reauthentications`, valable 10 minutes pour cette session. La fonction SQL consomme cette preuve. Un autre compte chez le même fournisseur renvoie `?reauth=mismatch`.
   - **Seule une identité associée avant l’ouverture de la session compte** (`social_identities.linked_at < sessions.created_at`). Sinon, quiconque tient la session d’un compte sans mot de passe pourrait associer son propre compte Google ou Discord par `link`, puis s’en servir pour confirmer. La règle est appliquée au démarrage (`auth-social-start`), à l’enregistrement de la preuve (`recordSocialReauthentication`), dans la liste des fournisseurs proposés (`inspect`) et dans `nxt5_delete_account`.
   - L’URL d’autorisation du seul parcours `reauth` force une interaction : `prompt=select_account` et `max_age=0` chez Google (qui refuse `prompt=login`), `prompt=consent` chez Discord (seule valeur disponible). Apple demande toujours une action ; Riot RSO ne documente pas d’option équivalente, la règle d’antériorité reste la protection. Le jeton de confirmation survit à la redirection via `sessionStorage`, sans aucun secret.
4. **`delete` :** un seul appel à `nxt5_delete_account`, atomique. Il verrouille le compte, revalide mot de passe ou preuve, confirmation, session, équipes et successeurs. Toute erreur annule l’ensemble, trace comprise.
5. **Reçu :** la référence et la date s’affichent à l’écran, puis retour à la connexion. Le jeton permet de retrouver le reçu pendant 24 h, même sans session (`status`, et au redémarrage de l’application après une réponse perdue). Le même envoi ne peut jamais s’appliquer deux fois.

**Protections de l’API** (`netlify/functions/auth-delete-account.ts`) :
- POST uniquement, `assertTrustedMutation` (origine et `Sec-Fetch-Site`), corps limité à 8 Ko ;
- quotas : 20 requêtes par minute et par IP, 10 par 5 minutes et par compte ; essais de mot de passe dans le budget commun des revérifications (5 par 15 minutes, 20 par jour) ;
- `assertMatchSourceMutationEnvironment`, car les suppressions touchent les déclencheurs de publication des parties ;
- refus pour l’administrateur de plateforme configuré (`DELETION_PLATFORM_ADMIN`) ;
- aucune journalisation du mot de passe, du jeton ou des paramètres SQL.

## Décision pour chaque clé étrangère vers `users`

Recensement sur le schéma entièrement migré (PGlite, toutes les migrations de `main`) par `pg_constraint`. On compte **51 clés** : 49 existantes et 2 nouvelles (42 existaient en septembre ; 7 ont été ajoutées depuis, listées ci-dessus).

Tests par table : chaque clé est couverte par au moins un scénario qui insère une ligne référençant le compte, puis vérifie la décision et l’absence de toute référence restante (`allReferencesTo`). Le test `documents a treatment for every foreign key to users` échoue si une nouvelle clé apparaît sans décision. Chaque scénario vérifie aussi qu’aucune ligne ne référence encore le compte supprimé.

| Table.colonne | Règle SQL d’origine | Décision | Raison |
| --- | --- | --- | --- |
| `teams.owner_id` | CASCADE | **Transférer** au membre choisi (il devient `captain`), ou **supprimer** l’équipe si elle n’a aucun autre membre, après accord explicite | Ne jamais effacer une équipe partagée |
| `team_members.user_id` | CASCADE | Supprimer | Adhésions personnelles |
| `players.user_id` | SET NULL | **Détacher et anonymiser les profils liés, sans les supprimer** : `user_id` nul, `name = Joueur supprimé`, `riot_id`, `opgg_url` nuls, `most_played` vide ; `champion_pool.player_name` renommé. Poste, statut, score et données d’équipe rattachées (pools, disponibilités, objectifs, notes de coaching, mises à jour d’objectifs Discord, carnets de matchups) conservés. Les participations gardent leur `player_id` et sont anonymisées : « Joueur supprimé », `riot_id` nul, identifiants Riot retirés du `raw` (puuid, summonerName/Id, riotIdGameName/Tagline/Name, profileIcon, summonerLevel) | Un profil appartient aussi à l’équipe : le supprimer effacerait en cascade les notes, objectifs et carnets écrits par les autres membres, dans toutes les équipes du compte. L’équipe peut ensuite supprimer le profil elle-même |
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
| `team_opponents.created_by`, `opponent_drafts.imported_by` | SET NULL | Référence nulle | Adversaires et drafts d’équipe |
| `nexus_registrations.registered_by` | SET NULL | Référence nulle ; inscription conservée. Une équipe inscrite à une saison en cours ne peut être supprimée (transfert possible) | Ligue partagée |
| `scrim_offers.created_by`, `scrim_requests.created_by` | SET NULL | Référence nulle | Propositions et demandes de l’équipe |
| `team_import_links.created_by` | SET NULL | Référence nulle ; la liaison reste active et révocable par l’équipe | Liaison NXT5 Importer de l’équipe |
| `draft_rooms.created_by` | SET NULL | Référence nulle | Salle de draft de l’équipe |
| `audit_logs.user_id` | SET NULL | Auteur retiré **seulement s’il s’agit du compte** ; cible retirée si c’est le compte ; dans les métadonnées, seules les valeurs texte **exactement égales** à l’UUID, à l’e-mail (sans casse) ou à un identifiant Discord lié deviennent `null`, à toute profondeur (`nxt5_scrub_json_values`). Le reste des métadonnées et l’auteur des journaux d’autres comptes sont conservés | Journaux sans identité, conservés 12 mois. Une recherche de sous-chaîne ne sert que de préfiltre : `joann@x.fr` n’est jamais touché pour `ann@x.fr` |

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
- `email`, `pending_email` et son jeton nuls, mot de passe `!deleted`, inutilisable ;
- notifications, vérification et acceptation des textes remises à zéro ;
- `social_link_revision` incrémenté.

L’identifiant et les dates de création et de dernière activité restent.

Un déclencheur empêche toute modification ou réactivation. Un autre refuse (`ACCOUNT_DELETED`) toute nouvelle référence à un compte supprimé dans les tables d’accès et de rattachement : sessions, récupérations, identités et parcours sociaux, équipes, adhésions, profils joueur, abonnement, liaisons Discord, réponses, rappels.

Ce refus vaut aussi pour une requête déjà en cours. Le verrou `FOR KEY SHARE`, celui de la clé étrangère, attend la suppression, puis relit la ligne. Un compte inexistant reste signalé par la clé étrangère (23503).

Les colonnes d’auteur ne sont pas surveillées. Une écriture concurrente ne pourrait y pointer que vers la ligne anonymisée.

Le tableau de bord d’administration exclut les comptes supprimés des totaux et des comptes actifs. Les créations de comptes restent comptées à leur date. L’annuaire d’administration les affiche sous « Compte supprimé » ; une suspension y est refusée (ligne immuable).

## Traces, conservation et limites

- **Reçu** (`account_deletion_receipts`) et événement `auth.account_deleted` : ils partagent une référence aléatoire. Ils contiennent la version de politique, la date et des nombres, sans identifiant, nom, e-mail, IP ni session. Ils sont purgés après 12 mois par `auth-account-deletion-cleanup` (tous les jours à 3 h 50), qui retire aussi les confirmations et preuves expirées.
- **Publications Discord :** les messages déjà envoyés ne sont pas supprimés. Anonymiser les participations modifie l’empreinte des parties concernées. Les publications encore suivies par une connexion active peuvent donc être actualisées avec « Joueur supprimé ».
- **Ce qui n’est pas purgé automatiquement :**
  - JSON bruts importés, qui contiennent les Riot IDs des dix joueurs ;
  - copies des publications Discord (`publication_snapshots.body`) et charges utiles de la file du bot (`discord_bot_outbox.payload`), qui peuvent contenir l’ancien pseudo : les modifier casserait les empreintes et la déduplication des publications, elles ne sont donc pas réécrites ; les textes légaux l’annoncent ;
  - textes libres des débriefs et des notes ;
  - profils joueur non liés au compte, et profils liés (conservés anonymisés dans leur équipe) ;
  - demandes commerciales d’une adresse non vérifiée ;
  - sauvegardes Neon (30 jours) et journaux de l’hébergeur.

  Un import ultérieur peut réintroduire un Riot ID public. Les textes légaux l’annoncent et renvoient vers le contact.
- **Comptes bloqués :** un compte dont l’e-mail n’est pas vérifié voit la fenêtre de vérification avant les Paramètres. Il doit vérifier ou corriger son adresse. Un compte sans mot de passe et sans fournisseur disponible est invité à créer un mot de passe ou à écrire au contact.

## Textes légaux

`LEGAL_VERSION` passe de `2026-10-30` à `2026-11-24` ; `LEGAL_UPDATED_LABEL` devient « 24 novembre 2026 ». Le libre-service change les CGU et la politique de confidentialité : sans nouvelle version, les nouveaux textes seraient enregistrés sous une version déjà acceptée avec d’autres textes. Le reçu enregistre `policyVersion: 2026-11-24`. Un formulaire d’inscription ouvert pendant le déploiement devra être rechargé. **Limite :** NXT5 ne redemande pas l’acceptation aux comptes existants ; la version ne sert qu’à dater l’acceptation des nouvelles inscriptions.

- **Confidentialité :**
  - nouvelles sections « Suppression de ton compte » et « Traces de la suppression », reprises de `c32b78c` et complétées (reconnexion sociale, Discord, profils joueurs conservés anonymisés avec leurs données d’équipe, participations anonymisées, publications suivies et copies techniques des publications, journaux nettoyés valeur par valeur, purge quotidienne des reçus) ;
  - « Durées de conservation » et « Connexions externes » mises à jour ; la section mentionne aussi les adversaires, salles de draft, scrims, inscriptions Nexus Rising et liaisons NXT5 Importer, la garde Nexus et le dernier e-mail de confirmation.
- **CGU :** « Fin d’utilisation » décrit le parcours au lieu du renvoi vers l’e-mail ; nouvelle section « Données après suppression du compte ».
- **Contact :** « Supprimer ton compte » renvoie d’abord vers Paramètres.
- **Assistant :** nouvelle fiche « Supprimer mon compte ».

## Fichiers

- **Migration :** `database/migrations/20261124_account_deletion.sql` (`account-deletion-20261124-v1`), enregistrée en fin de liste dans `tools/migration-runner.mjs`. `database/schema.sql` reçoit `users.deleted_at`. Aucune migration publiée n’est modifiée.
- **Serveur :**
  - `auth-delete-account.ts` et `auth-account-deletion-cleanup.ts` ;
  - `_lib/migrations.ts` (`assertAccountDeletionSchemaReady`) et `_lib/auth.ts` (`clearSessionCookie`) ;
  - parcours `reauth` : `_lib/social-auth.ts`, `auth-social-start.ts`, `auth-social-finish.ts` ;
  - filtres de l’administration : `admin-dashboard.ts` ; garde levé pour la suppression administrative : `admin-account-lifecycle.ts` ;
  - alerte « compte supprimé » : `_lib/account-notices.ts` ;
  - fiche de l’assistant.
- **Interface :**
  - `src/pages/workspace/AccountDeletion.jsx` : section et reçu, avec `Surface`, `Badge`, `Button`, `SelectInput` et `TextInput` de `Core.jsx` ;
  - états de chargement, d’erreur (`role="alert"`) et de succès ;
  - focus replacé sur l’étape, boutons pleine largeur sur mobile, cases de 44 px avec focus cyan ;
  - fichiers modifiés : `AccountSettings.jsx`, `account-settings.css`, `AppContent.jsx` (transmission de `onAccountDeleted`), `AppRouter.jsx` (reçu, reprise au démarrage, sortie de l’espace privé sans requête de déconnexion), `LegalPage.jsx`, catalogues `catalogue-en.js` et `catalogue-es.js`.

## Vérifications

- `src/__tests__/account-deletion.test.ts` (PGlite, historique complet des migrations, vrai client Neon) :
  - protections de l’API ;
  - confirmations et quota de mot de passe ;
  - confirmation expirée, autre session ou mot de passe changé ;
  - administrateur ;
  - **propriétaire d’une équipe avec d’autres membres** : transfert, données des autres membres intactes, historique conservé, profil anonymisé et conservé, participations anonymisées, `updated_at` préservé, journaux nettoyés, aucune référence restante ;
  - **journaux d’autres comptes** : `joann@x.fr` intact pour la suppression de `ann@x.fr`, valeur exacte retirée dans un tableau imbriqué (sans casse), texte libre conservé ;
  - **profil dans une équipe d’un autre propriétaire** : notes de coaching, objectifs, mises à jour Discord, carnets, disponibilités et participations conservés ;
  - conflit d’unicité inattendu : message générique `DELETION_CONFLICT`, rien n’est appliqué ;
  - refus du `DELETE` direct ;
  - successeur parti, équipe solitaire, nouveau membre arrivé entre-temps, échec d’écriture de la trace (tout est annulé) ;
  - **compte uniquement social** : suppression refusée sans reconnexion, mauvais compte fournisseur refusé, preuve liée à la session et expirée, puis suppression ;
  - **identité associée après l’ouverture de la session** : absente de `inspect`, refusée au démarrage, à l’enregistrement de la preuve et par la fonction SQL ; reconnexion forcée demandée au fournisseur (`freshLogin`, testée aussi dans `social-auth-protocol.test.ts`) ;
  - **compte lié à Discord** : liaison, demandes, reçus d’interaction, réponses, lectures, codes, contenus partagés conservés ;
  - reçu idempotent sans session, blocage après suppression ;
  - inventaire des clés étrangères ;
  - **clés ajoutées depuis #110** : lignes conservées sans auteur dans une équipe transférée, supprimées avec une équipe solitaire, refus d’une équipe engagée dans une saison Nexus en cours, `updated_by` des formules et demandes d’accès, rappel d’inactivité en attente, e-mail en attente effacé ;
  - garde levé uniquement dans la transaction de la suppression administrative.
- `src/__tests__/account-deletion-ui.test.jsx` : confirmations, successeur et accord distinct, envoi unique, erreurs, réponse perdue, état incertain, reconnexion sociale, reprise après redirection, mauvais compte, confirmation expirée, reçu.
- `src/__tests__/app-loading.test.jsx` : reçu retrouvé au démarrage après une réponse perdue.
- Tests adaptés :
  - `migrations.test.ts` : deux tests supposaient que leur migration était la dernière de la liste ; ils la cherchent désormais par clé ;
  - version légale dans `public-admin-tour2`.
- `npm run verify` : voir la PR.

**Non vérifié :**
- navigateur réel ;
- vrai retour OAuth Google, Discord, Apple ou Riot ;
- contention sur plusieurs connexions Neon ;
- vrai comportement de `max_age=0` chez Google (paramètre OIDC non documenté par Google, ignoré s’il n’est pas pris en charge).

## Déploiement et conflits

- Appliquer la migration (`npm run db:migrate`) avant les fonctions. La route répond 503 tant que le marqueur manque.
- La migration du 24 novembre est en fin de liste dans `tools/migration-runner.mjs`. Si une autre migration est fusionnée sur `main` avant cette PR, la placer avant celle-ci (ordre d’application) ou renuméroter, sans modifier une migration publiée.

### Vérification avant fusion

La migration n’a été appliquée nulle part (ni la version du 30 septembre, ni celle-ci). Avant la fusion, vérifier en lecture seule sur la base de production :

```sql
select to_regclass('account_deletion_receipts'), to_regproc('nxt5_delete_account');
```

Les deux valeurs doivent être `null`. Sinon, une version antérieure a été appliquée : ne pas fusionner en l’état, écrire une nouvelle migration.

### Limite connue : coût sur un compte très actif

Non mesuré. Chaque participation anonymisée déclenche `discord_participant_changed` (déclencheur différé sur `match_participants`), qui recalcule et met en file les publications Discord suivies des parties concernées. Sur un compte avec un très grand historique, la transaction unique de `nxt5_delete_account` peut donc être longue et produire beaucoup de publications. Le nettoyage des journaux parcourt aussi toute la table `audit_logs` (préfiltre textuel, puis parcours exact des seules lignes candidates). À mesurer sur une copie de taille représentative avant d’ouvrir la fonction à de gros comptes.
