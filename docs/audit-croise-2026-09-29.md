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
