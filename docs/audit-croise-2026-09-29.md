# Audit croisé Claude ↔ GPT — 29 septembre 2026

Audits successifs à tour de rôle (GPT puis Claude), chaque constat contre-vérifié par l’autre modèle avant correction.

## Backend

Corrections du tour 1 réalisées le 29 septembre 2026, à partir du rapport `audit1-back.md` et des décisions produit fournies. Aucun commit, push, installation de dépendances ou accès métier en production. Les fichiers de journalisation, les `console.error` existants, `match-archives-manage.ts`, le front hors tests, `importer-app/` et `shared/` restent inchangés.

| Constat | Correction | Régression |
| --- | --- | --- |
| B1 — accès après renvoi | Le planning et le Champion Pool exigent une adhésion actuelle ou la propriété de l’équipe. Liaison et renvoi prennent le même verrou `teams FOR UPDATE`, puis revalident les accès et l’adhésion avant les mutations et l’audit dans une transaction. | [match-import-atomic.test.ts](../src/__tests__/match-import-atomic.test.ts) : lien résiduel refusé en 403 sur planning/pool/création/suppression ; renvoi intercalé avant liaison ; déliaison effective ; rollback du renvoi sur échec de l’audit. |
| N1 — promotion implicite | La liaison à un profil staff ne promeut un membre `player` que si l’appelant est propriétaire ou capitaine, avec revalidation sous verrou. Le rôle du profil est lu dans la transaction. | Même suite : appelants coach, manager, board, captain et owner ; les trois premiers lient sans promouvoir. |
| B9 — planning manager | Ajout du rôle manager via `TEAM_STAFF_ROLES` dans [_lib/teams.ts](../netlify/functions/_lib/teams.ts), partagé avec la liaison, le pool et la gestion des parties. | Même suite : manager sans profil lié enregistrant les disponibilités d’un profil COACH partagé. |
| B2 — débrief manuel supprimé | `reports.source` distingue `manual` et `auto`. Supprimer une partie ne supprime que ses rapports automatiques ; les autres perdent la référence et prennent le premier `match_ids` restant comme référence principale, ou `null`. | Même suite : notes manuelles multi-parties et orphelines conservées ; rapport auto supprimé. |
| B5 — réimport non idempotent | Index unique partiel sur `(team_id, match_id) WHERE source='auto'`, insertion avec `ON CONFLICT DO NOTHING`. L’upsert de partie remonte `inserted` via `xmax=0` ; les deux endpoints ne notifient que la première insertion. | Même suite : rapport inchangé après réimport avec statistiques différentes ; une notification sur deux appels, pour chacun des deux endpoints ; migration conservatrice, doublons, idempotence et contraintes. |
| B6 — Champion Pool périmé | Suppression et correction des rôles exécutent `championPoolRefreshQueries` dans leur transaction, après verrou d’équipe. | Même suite : agrégats recalculés après suppression et permutation des profils ; rollback intégral des parties, rapports et agrégats sur échec du recalcul. |
| B7 — affectations incohérentes | Construction de l’état final en mémoire avant écriture : participants de cette partie, rôles valides et distincts par côté, profils alliés de jeu non nuls et distincts. Revalidation du snapshot et des profils sous verrou ; erreur 400 française, ou 409 si concurrence. | Même suite : rôle/profil dupliqué, profil staff ou nul, participant étranger refusés ; permutation valide acceptée ; correction concurrente détectée. |
| B8 — catégorie supprimée réintroduite | La modification ordinaire prend le verrou d’équipe et revalide toutes les catégories dans la transaction ; `22012` et `23503` deviennent un HTTP 409. | Même suite : suppression d’une catégorie secondaire entre la validation initiale et la transaction, sans réécriture ni audit partiel. |
| B3 — conflit social révélateur | Conflit e-mail explicite seulement pour l’adresse normalisée vérifiée par le fournisseur. Toute adresse non vérifiée par le fournisseur reçoit le même HTTP 202 et le même message qu’`auth-register`, qu’elle soit disponible ou déjà utilisée, sans compte, association, session, e-mail ou consommation du ticket. Les conflits SQL restent explicites uniquement dans le contexte vérifié ; le traitement de secours neutralise `23505` et `P0001/SOCIAL_EMAIL_EXISTS` dans un contexte non vérifié. Quota partagé de cinq tentatives par ticket haché sur cinq minutes. | [social-auth-flows.test.ts](../src/__tests__/social-auth-flows.test.ts) : adresse tierce, fournisseur non vérifié, conflits SQL, compte/session/cookies/ticket inchangés, égalité des réponses adresse occupée/disponible et quota réel PostgreSQL par ticket ; maintien du conflit explicite pour une adresse vérifiée. |
| B4 — récupération sans budget destinataire | Quota partagé de trois demandes par heure sur le SHA-256 de l’adresse normalisée, avant lecture du compte, invalidation ou envoi. Dépassement : réponse neutre `{ ok: true }`. | [auth-security-regressions.test.ts](../src/__tests__/auth-security-regressions.test.ts) : IP différentes et variantes de casse/espaces, trois envois, quatrième demande sans envoi ni altération des jetons ; fenêtre expirée ; destinataire absent. |

La migration [20260929_report_source.sql](../database/migrations/20260929_report_source.sql) ne reconnaît un ancien rapport automatique que si le titre, les références, l’en-tête complet et les cinq lignes de participants correspondent exactement au générateur courant. Les rapports modifiés, enrichis, devenus impossibles à reconstruire ou autrement incertains restent manuels. Parmi plusieurs correspondances identiques, seul le plus ancien par équipe/partie devient automatique, avec départage par identifiant. Les autres doublons sont conservés.

Le runner utilisait directement `schema.sql` comme migration initiale avec checksum immuable. Pour permettre sa mise à jour sans casser les bases déjà migrées, [20260906_baseline.sql](../database/migrations/20260906_baseline.sql) fige exactement les octets de l’ancien `schema.sql` (SHA-256 `95b431df47f548702c4716f5dc8886de9358b9fd2001ab9ba6fea73fc269661e`). Le runner conserve la même clé initiale et son checksum. [migrations.test.ts](../src/__tests__/migrations.test.ts) couvre aussi la montée depuis ce schéma historique sans colonne `source`, la conservation des contenus incertains et le second passage sans migration réappliquée. Exécuter les migrations avant de déployer les fonctions utilisant `source` ; aucune migration distante n’a été exécutée ici.

Fichiers modifiés ou créés :

- Base et runner : `database/MIGRATIONS.md`, `database/schema.sql`, `database/migrations/20260906_baseline.sql` (nouveau), `database/migrations/20260929_report_source.sql` (nouveau), `tools/migration-runner.mjs`.
- Fonctions : `netlify/functions/_lib/teams.ts`, `_lib/analytics.ts`, `players-link-account.ts`, `team-member-remove.ts`, `player-availability-manage.ts`, `champion-pool-manual.ts`, `matches-manage.ts`, `matches-import.ts`, `matches-import-file.ts`, `auth-social-complete.ts`, `auth-request-password-reset.ts`.
- Tests : `src/__tests__/match-import-atomic.test.ts`, `auth-security-regressions.test.ts`, `social-auth-flows.test.ts`, `migrations.test.ts`, `password-recovery-atomicity.test.ts` (mock du nouveau quota, sans changer ses assertions métier).
- Documentation : `docs/audit-croise-2026-09-29.md`, uniquement cette section Backend.

Validation finale : `npm run verify` **réussi (code de sortie 0)** — TypeScript, **127 suites / 2 270 tests réussis**, build Vite et pré-rendu SEO des 13 pages. `git diff --check` est propre et les liens locaux du rapport sont valides. Une tentative précédente a rencontré un timeout isolé de 5 secondes dans `review-backfill.test.jsx` ; cette suite a ensuite réussi seule, puis dans le contrôle complet final. Le pré-rendu affiche un avertissement WebSocket `EPERM` sur le port 24678, lié au sandbox ; les vérifications SEO terminent correctement et la commande retourne 0. Les tests exécutent le SQL réel via le transport Neon sur PGlite ; les services d’identité et d’envoi sont simulés. Les scénarios de concurrence imposent une mutation entre la lecture et la transaction, sans reproduire la contention de connexions Neon distinctes.

Points à relire par Claude :

- **Front à adapter :** [SocialAccounts.jsx](../src/components/account/SocialAccounts.jsx), fonction `submit`, lignes 147–149 : un résultat sans `user.id` déclenche « La création du compte n’a pas pu être confirmée. Réessaie. ». Le HTTP 202 neutre doit être traité comme une acceptation et son message affiché. Aucun changement front réalisé.
- **Conséquence produit B3 :** une adresse absente, non vérifiée par le fournisseur ou modifiée dans le formulaire ne crée plus de compte par cette route. La réponse neutre ne déclenche pas d’envoi d’e-mail ; elle reprend textuellement celle d’`auth-register` comme demandé. Le parcours social reste opérationnel pour l’adresse vérifiée fournie par le service. Claude doit prévoir cette conséquence dans l’adaptation de l’interface.
- Le rattrapage préfère conserver un ancien rapport en manuel à risquer de supprimer des notes humaines. Il ne cherche pas à dédupliquer ou supprimer les anciens rapports non sélectionnés.
- Pour respecter l’interdiction d’écriture hors checkout, le lien global `node_modules` a été remplacé localement par un répertoire de liens vers les dépendances déjà présentes, avec caches Vite locaux. Aucune dépendance téléchargée ou installée.

## Frontend

Corrections du tour 1 réalisées dans `fix1-front`, pour relecture par Claude. Références lues : les consignes locales, `/Users/sachadegouzon/Documents/Codex/AGENTS.md`, la charte graphique canonique et le rapport `/Users/sachadegouzon/Documents/NXT5/.claude/runs/audit1-front.md`. Aucun commit, push ou ajout de dépendance. Aucun fichier des périmètres exclus modifié ; seule exception serveur autorisée : `match-archives-manage.ts`.

### Corrections et régressions

| Constat | Résultat | Tests |
| --- | --- | --- |
| B1 | Le dialogue de vérification permet la déconnexion et la correction e-mail + mot de passe actuel via `auth-update-profile`. Le statut `hasPassword` vient de `auth-social-status` ; les comptes sociaux sans mot de passe disposent de la déconnexion et d’une explication. Chargement, erreur, désactivation pendant l’envoi et labels conservés. | [frontend-async-regressions.test.jsx](../src/__tests__/frontend-async-regressions.test.jsx) : correction, erreur de réauthentification, déconnexion, compte social. |
| B2 | L’identifiant créé est conservé avant la demande de débrief. Une erreur du débrief annonce explicitement la réussite partielle et laisse le formulaire en mise à jour. `refreshAll` est appelé même en cas d’échec. Au-delà de 20 parties, création sans débrief avec avertissement avant validation. | [archive-creation-regressions.test.jsx](../src/__tests__/archive-creation-regressions.test.jsx) : échec partiel, nouvel essai sans doublon, 21 parties, erreur de création. |
| NEW-1 | Sélection plafonnée à 80 côté interface, y compris « Tout sélectionner » ; au-delà, l’action s’appelle « Sélectionner les 80 premières ». Le serveur rejette plus de 80 identifiants avec une erreur 400 explicite au lieu de tronquer la liste. | [archive-creation-regressions.test.jsx](../src/__tests__/archive-creation-regressions.test.jsx), [match-archives-limit.test.ts](../src/__tests__/match-archives-limit.test.ts). |
| B3 | La valeur envoyée et le contexte équipe/joueur sont mémorisés dans un ref. La réponse serveur ne remplace pas une note modifiée après l’envoi. | [frontend-async-regressions.test.jsx](../src/__tests__/frontend-async-regressions.test.jsx) : envoi de A, saisie de B pendant la requête, retour serveur sans perte de B ; normalisation et actualisations suivantes appliquées au brouillon intact. |
| B4 | Le store envoie les modifications au démontage, puis vide la file sérialisée si une nouvelle révision attend derrière une requête. Les callbacks et notifications des abonnés sont ignorés après démontage. `beforeunload` reste actif pour les entrées non enregistrées ou en cours d’envoi. | [planning.test.jsx](../src/__tests__/planning.test.jsx) : debounce non déclenché, révision derrière un envoi, callbacks ignorés, activation/retrait du garde. |
| B5 | Filtres, pagination et actualisation des demandes sont désactivés avec une explication tant qu’un brouillon existe. Le garde administratif ajoute `beforeunload` pendant un brouillon ou une sauvegarde. | [access-requests-admin.test.jsx](../src/__tests__/access-requests-admin.test.jsx), [admin-navigation.test.jsx](../src/__tests__/admin-navigation.test.jsx). |
| NEW-2 | Vérification de `mutate` : ses rejets sont déjà attendus et interceptés par `RequestCard.save` / `RequestCard.remove`, qui affichent une erreur locale. Pas de modification inutile de ce contrat. Un résultat sans `ok: true` reste une erreur et conserve la saisie. | [access-requests-admin.test.jsx](../src/__tests__/access-requests-admin.test.jsx) : rejet réseau existant et nouvelle régression de confirmation serveur absente, sans promesse rejetée non gérée. |
| B6 | « Encadrement » utilise le premier profil COACH par id stable, sinon le premier profil staff par id, indépendamment du compte connecté. | [planning-interactions.test.jsx](../src/__tests__/planning-interactions.test.jsx) : deux comptes, mêmes données, avec et sans COACH. |
| B7 | Ajout, déplacement et suppression du pool appellent `refreshAll` après réussite pour actualiser les données communes. | [draft-workspace.test.jsx](../src/__tests__/draft-workspace.test.jsx) : mutations et parcours Pool → Compositions → Pool. |
| B8 | Les interrupteurs sont désactivés pendant l’écriture ; un ref bloque aussi un second appel immédiat. La génération invalide les réponses d’un ancien compte ou après démontage. Le rollback ne touche que la préférence modifiée. `PremiumToggle` expose le `disabled` natif. | [frontend-async-regressions.test.jsx](../src/__tests__/frontend-async-regressions.test.jsx) : sérialisation, désactivation native, rollback ciblé et réponse dépassée. |
| B9 | `handleAuth` et `handleLogout` incrémentent la génération d’authentification. La réponse initiale `auth-me`, positive ou négative, n’écrit plus dans un contexte ultérieur. | [app-loading.test.jsx](../src/__tests__/app-loading.test.jsx) : connexion réussie avant ancienne réponse vide ou rejetée. |
| B10 | `ToastStack` est rendu par portail dans la dernière `dialog[open]`, avec suivi des ouvertures et fermetures. Les erreurs de fichier et d’envoi apparaissent aussi dans le panneau d’import avec `role="alert"`. | [frontend-async-regressions.test.jsx](../src/__tests__/frontend-async-regressions.test.jsx) : cible du portail, région live et fermeture ; [import-game-flow.test.jsx](../src/__tests__/import-game-flow.test.jsx) : JSON invalide annoncé dans le panneau. |
| B11 | Le minuteur et le relais du signal restent actifs jusqu’à la fin de `json()`. Un abandon de la lecture rejette la promesse avec un message de délai/annulation, puis nettoie les ressources. | [api-client-regressions.test.js](../src/__tests__/api-client-regressions.test.js) : corps différé, délai et annulation externe. |
| B12 | Le transport XHR utilise un délai de 120 s par défaut, rejette sur timeout/abort et accepte `{ signal, timeoutMs }` en quatrième argument. Les états occupés sont libérés par les `finally` existants de l’import. | [api-client-regressions.test.js](../src/__tests__/api-client-regressions.test.js), [import-game-flow.test.jsx](../src/__tests__/import-game-flow.test.jsx) : timeout, signal, signal déjà annulé, import de nouveau disponible. |
| B13 + N2 | La grille transmet explicitement le bouton de cellule à l’ouverture du menu ; Maj+F10 retrouve ce bouton pour l’ancrage et le retour du focus. La création de séances exige `canEditSelected || canManagePlanningStaff` et un profil de stockage. | [planning-interactions.test.jsx](../src/__tests__/planning-interactions.test.jsx), [planning-grid-accessibility.test.jsx](../src/__tests__/planning-grid-accessibility.test.jsx) : sélection, Échap, vues jour/semaine et membre sans profil lié. |

### Fichiers modifiés

Code :

- `src/AppContent.jsx`
- `src/api/client.js`
- `src/components/ui/Core.jsx`
- `src/components/games/PlanningAvailabilityGrid.jsx`
- `src/pages/admin/AccessRequestsPage.jsx`
- `src/pages/admin/AdministrationPage.jsx`
- `src/pages/workspace/AccountSettings.jsx`
- `src/pages/workspace/DraftWorkspace.jsx`
- `src/pages/workspace/GameOperations.jsx`
- `src/pages/workspace/GameWorkspace.jsx`
- `src/pages/workspace/Planning.jsx`
- `src/pages/workspace/PlayerUltimateProfile.jsx`
- `src/utils/planning-store.js`
- `netlify/functions/match-archives-manage.ts`

Tests existants étendus : `access-requests-admin.test.jsx`, `admin-navigation.test.jsx`, `app-loading.test.jsx`, `draft-workspace.test.jsx`, `import-game-flow.test.jsx`, `planning-grid-accessibility.test.jsx`, `planning-interactions.test.jsx`, `planning.test.jsx`, dans `src/__tests__/`.

Nouveaux tests : `api-client-regressions.test.js`, `archive-creation-regressions.test.jsx`, `frontend-async-regressions.test.jsx`, `match-archives-limit.test.ts`, dans `src/__tests__/`.

Documentation : le présent fichier, uniquement la section Frontend.

### Validation

- **`VITEST_MAX_WORKERS=1 npm run verify` : réussi (code de sortie 0)** sur la version finale : typecheck, **131 suites / 2 271 tests**, build Vite et pré-rendu SEO de 13 pages. Les régressions ciblées passent également.
- Le lien initial `node_modules` pointait vers le dépôt principal. Pour empêcher Vite d’y écrire `.vite-temp` et `.vite`, il a été remplacé localement par un répertoire de liens vers les dépendances existantes, avec caches propres au checkout. Aucune dépendance installée ou modifiée.
- Le premier passage de la suite a exposé des dépassements de délais dans des tests SQL existants ; la relance complète utilise `VITEST_MAX_WORKERS=1` pour limiter la concurrence, sans modifier les tests ni leurs délais.
- Le pré-rendu émet un message `listen EPERM 0.0.0.0:24678` : le sandbox refuse le port WebSocket de développement. Ce message est non bloquant ; le pré-rendu vérifie les 13 pages, la vraie 404, les routes privées en noindex, sitemap et robots.
- `git diff --check` : aucun problème d’espacement ; tous les liens internes du rapport existent.

### Points de doute et limites de recette

- Les tests montent les composants React et simulent les réponses réseau. La cible de portail, les rôles accessibles, la désactivation et le retour du focus sont testés, mais aucun navigateur pilotable n’est disponible dans cette session. La recette visuelle à 360, 390, 768, 1024 et 1440 px et l’annonce effective par lecteur d’écran restent à effectuer. Les composants, tokens, règles mobiles et règles de mouvement réduit existants sont réutilisés ; aucune évolution d’identité ni nouvelle animation.
- `beforeunload` avertit lors d’une sortie de page ; il ne garantit pas une écriture réseau si le navigateur est fermé de force ou hors ligne. Le flush au démontage est vérifié pour une navigation dans l’application.
- Un débrief échoué laisse le groupe en édition ; enregistrer à nouveau met ce groupe à jour. La génération automatique reste limitée à la création et à 20 parties, conformément au parcours demandé.

## Import, publications et outils

Corrections du tour 1 (`audit1-shared.md`), réalisées dans le checkout `fix1-import`, sans commit, push ni installation de dépendances.

### Changements

- **B1 — Copies temporaires des débriefs.** Nouvelle fonction planifiée [`review-backfill-cleanup`](../netlify/functions/review-backfill-cleanup.ts), tous les jours à 03:55 UTC. Elle supprime les copies dont `backed_up_at` remonte à au moins 30 jours. L’absence de la table (`42P01`) est tolérée ; les autres erreurs restent visibles. Les suppressions en cascade existantes du débrief et de l’équipe sont conservées. La politique de confidentialité et [la procédure de réécriture](review-backfill.md) décrivent l’expiration, la purge quotidienne et la limite de restauration.
- **B2 — Repères temporels.** [`MILESTONE_TOLERANCE_MS`](../shared/timeline-milestones.js) fixe la tolérance commune du site à 5 000 ms après le jalon, borne incluse, comme l’Importer. Publications, lecture des timelines et export des tendances l’utilisent. Une frame à 11 minutes ne fournit plus de CS10 ; au-delà de cinq secondes, le jalon reste `null`.
- **B3 — CS incomplets.** L’Importer et `csAtMinute` exigent deux composantes numériques finies. Une composante absente, `null`, une chaîne ou un nombre non fini rend le CS indisponible ; deux zéros explicites donnent zéro. Les moyennes de profil et de tendances excluent les valeurs indisponibles et conservent les zéros mesurés.
- **B4 — Identité des champions.** Le catalogue de l’Importer associe la clé numérique à `champion.id`, notamment `MonkeyKing` et `LeeSin`. Un catalogue indisponible ou un identifiant absent bloque la conversion qui en a besoin avec « Catalogue des champions indisponible, réessaie connecté. ». Aucun libellé `Champion <id>` n’est produit par le catalogue. Les alias existants sont mutualisés dans [`shared/champions.js`](../shared/champions.js), puis réutilisés par le site, le champion pool manuel et la normalisation des participants importés. Les nouveaux imports regroupent ainsi les variantes dans les statistiques et le champion pool. **Aucune migration des données existantes** : les anciennes lignes et les fichiers bruts restent inchangés ; les anciennes identités divergentes peuvent encore apparaître séparément.
- **B5 — Résultat de partie.** Les validateurs Importer et serveur exigent exactement une équipe gagnante, sur l’un ou l’autre côté. Deux victoires ou deux défaites sont rejetées avant enregistrement, avec un message explicite.
- **B6 — Couverture des combats.** Une timeline sans élimination est déclarée indisponible pour les combats si les statistiques finales comportent des kills ou morts, ou si les objectifs d’équipe comptent des éliminations. Le modèle conserve les repères statistiques, affiche « combats indisponibles » et retire les faux bilans de fights 0–0 et les affirmations d’absence de mort non échangée. Une partie réellement sans élimination conserve ses zéros observables.

### Fichiers modifiés ou créés

- Partagés : `shared/champions.js`, `shared/timeline-milestones.js`, `shared/publications/game-publication.js`.
- Importer : `importer-app/src/core.js`, `importer-app/src/main.js`, `importer-app/src/network.js`, `importer-app/test/core.test.mjs`, `importer-app/test/conversion.test.mjs`, `importer-app/test/network.test.mjs`, `importer-app/CHANGELOG.md`.
- Serveur : `netlify/functions/review-backfill-cleanup.ts`, `netlify/functions/_lib/import-validation.ts`, `netlify/functions/_lib/analytics.ts`, `netlify/functions/champion-pool-manual.ts`.
- Site : `src/utils/match-timeline.js`, `src/pages/workspace/TrendsPage.jsx`, `src/pages/workspace/workspace-shared.jsx`, `src/pages/public/PublicPages.jsx`.
- Tests site/serveur : `src/__tests__/review-backfill-cleanup.test.ts`, `src/__tests__/timeline-milestones.test.ts`, `src/__tests__/publication-model.test.js`, `src/__tests__/import-validation.test.ts`, `src/__tests__/match-import-atomic.test.ts`, `src/__tests__/png-data.test.jsx`.
- Documentation : `docs/review-backfill.md`, `docs/audit-croise-2026-09-29.md`.

### Validation

- **`npm run verify` : réussi (code 0)** au second lancement : typage TypeScript, **128 suites / 2 263 tests**, build Vite et prérendu SEO de 13 pages validés. Le premier passage avait rencontré des dépassements de délai PGlite dans quatre suites hors corrections ; aucun changement de tests ou de délais n’a été nécessaire pour le second passage.
- **Tests ciblés : 159 réussis**, notamment les bornes CS, les consommateurs profil/tendances, les résultats contradictoires, la normalisation des champions dans les imports SQL et la purge des sauvegardes. Les tests de publication sont également validés par la suite complète.
- **`npm test --prefix importer-app` : 33 réussis / 36**, deux passages concordants. Trois tests réseau existants échouent sur `listen EPERM 127.0.0.1` : cette sandbox interdit l’ouverture du serveur local utilisé par les tests HTTP (JSON/limites de taille, délai, annulation). Aucun test n’a été désactivé ; conversion, catalogue, CS et validation de résultat passent. Ces trois tests restent à relancer dans un environnement autorisant l’écoute locale.
- **`npm run build` : réussi séparément (code 0)**. Le prérendu affiche un message `listen EPERM 0.0.0.0:24678` lié au serveur HMR dans cette sandbox, sans empêcher la génération ni la vérification SEO.
- **`git diff --check` : réussi.** Aucune dépendance installée. Le lien local `node_modules` pointant hors du checkout a été remplacé temporairement par des liens vers les dépendances existantes et des dossiers de cache locaux pour éviter les écritures externes, puis restauré après les contrôles. Les artefacts temporaires de validation ont été supprimés.

### Périmètre et limites pour la relecture

- Les endpoints `matches-*`, `reports-manage`, l’authentification, le planning et `access-requests-cleanup.ts` ne sont pas modifiés. Dans `analytics.ts`, seuls l’import de l’utilitaire et la normalisation du nom de champion changent ; l’insertion des rapports reste intacte.
- **Point restant hors périmètre imposé :** `buildNxt5TimelineSummary` dans `analytics.ts` utilise encore la première frame après le jalon sans borne de cinq secondes et remplace les composantes CS absentes par zéro. Ce calcul serveur n’a pas été modifié, conformément à l’instruction de ne toucher qu’au nom de champion dans ce fichier. Les consommateurs de timelines détaillées corrigés ici relisent les frames ; un résumé seul issu de cet ancien calcul ne permet pas de reconstituer la validité de sa mesure.
- Le moteur Electron, le packaging Windows/macOS, Riot/LCU réel, la base de production et l’exécution planifiée Netlify ne sont pas testés dans cet environnement. Le test SQL local vérifie les bornes de rétention, l’absence de table, l’idempotence et la remontée des erreurs.
