# Reprise des correctifs restés sur `feat/pricing-validation` — 30 septembre 2026

La branche `origin/feat/pricing-validation` contient des commits postérieurs à sa fusion (PR #26) qui n’ont jamais atteint `main`. L’analyse du 29 septembre 2026 en a retenu quatre points. Pour chacun : relecture du commit d’origine, comparaison avec le code actuel, puis report de **ce qui manquait encore**, adapté au code. Chaque point a un test de régression.

La comparaison porte sur la PR #97 (audit croisé, qui inclut les lots « fix1 », fusionnée depuis dans `main`) et non sur l’ancien `main`. #97 modifie déjà le client API, `AppContent.jsx`, `GameWorkspace.jsx` et `asset-proxy.ts`. Porter les correctifs par-dessus l’ancien `main` aurait dupliqué ou contredit son travail.

## 1. Reprise après erreur et chargement des modules (commit 76dbb10)

| Élément | État avant | Report |
| --- | --- | --- |
| Écran de secours en cas d’erreur de rendu | #97 ajoute `WorkspaceErrorBoundary` autour des rubriques de l’espace équipe. Rien ne couvre le module principal (`AppContent`), les pages publiques ni l’écran de chargement : une erreur donne une page vide. | `src/components/ui/AppErrorBoundary.jsx`, placé dans `App.jsx` au-dessus d’`AppLoadingProvider`. Il remplace l’écran de chargement et ne montre aucun détail technique. |
| Rechargement après déploiement (`vite:preloadError`) | Aucun écouteur. | `src/app/chunk-recovery.js`, installé dans `main.jsx` : un rechargement au plus par minute (garde en `sessionStorage`). La reprise reste manuelle hors ligne ou si le stockage est bloqué. |
| `asset-proxy.ts` | Seule fonction en signature v1 (`Handler`). Le fetch des images suit les redirections et n’a pas de délai maximal. Les messages d’erreur réseau sont renvoyés tels quels (400). #97 ajoute le catalogue de runes, borné (4 s, `redirect: 'error'`). | Signature `Request`/`Response` avec `config = { method: 'GET' }`, comme les autres fonctions. Images : `redirect: 'manual'`, délai de 10 s couvrant la connexion et le corps, lecture en flux limitée à 2 Mo, 404 conservé, autres statuts en 502, délai dépassé en 504, messages génériques. Le catalogue de runes de #97 reprend le même lecteur borné, sans changer ses règles. |
| Client API | #97 a refait les délais, l’annulation par l’appelant et le délai d’envoi des fichiers. | Seuls deux éléments manquaient. Une réponse 2xx qui n’est ni un objet ni un tableau JSON (page HTML, corps vide) est rejetée avec un message clair, `INVALID_API_RESPONSE`, au lieu d’arriver comme `null` chez l’appelant ; les 204 restent acceptés. Le message `SESSION_SECRET_MISCONFIGURED` ne révèle plus la configuration du serveur. |

Charte : l’écran de secours réutilise `Surface`, `Button` et `Badge` (`Core.jsx`), le wordmark officiel (`BrandAssets.jsx`) et le fond d’`AmbientBackground`. Ce fond est repris par ses classes, car `AppChrome.jsx` appartient au module chargé à la demande. Le titre reçoit le focus et le message est annoncé (`role="alert"`). Sur mobile, les actions s’empilent en pleine largeur. Aucune animation n’est ajoutée ; le mouvement réduit global s’applique aux transitions des boutons.

Coût : l’écran de secours ne doit dépendre d’aucun module chargé à la demande. `Core.jsx` et `helpers.js` rejoignent donc le module d’entrée, qui passe de 25,05 à 36,42 Ko (9,71 → 13,06 Ko gzip). Ces fichiers sont déplacés, pas dupliqués : ils étaient déjà téléchargés juste après l’entrée, avec `AppContent`.

Tests : `app-recovery.test.jsx`, `asset-proxy.test.ts` (les cas E1 de #97 et ceux de 76dbb10, réécrits pour la nouvelle signature), `api-client-regressions.test.js`.

## 2. Écritures en base à chaque requête authentifiée (commit b1d8f1b)

Avant : `requireAuth` exécutait toujours deux `UPDATE` après la lecture de la session (`sessions.last_seen_at`, puis `users.last_active_at` via `recordUserActivity`), même quand l’activité datait de moins de cinq minutes.

Report du seul gain de ce commit (le reste concerne l’administration et l’audience) : la requête d’authentification calcule `session_activity_due` et `user_activity_due` avec l’horloge de la base. Une activité récente coûte une seule requête. Les écritures dues gardent leurs gardes SQL, ce qui empêche une double écriture en cas de requêtes concurrentes. Si les indicateurs sont absents, le comportement antérieur s’applique. La PR #89, fusionnée depuis, ne modifie pas `requireAuth`.

Test : `auth-activity-performance.test.ts` (SQL réel via PGlite, nombre d’allers-retours, avis de retour après 90 jours, sessions révoquées ou expirées, concurrence).

## 3. Équipe supprimée ou accès retiré (commit b818225)

Avant : quand `bootstrap` renvoyait 403 pour l’équipe active, le hook affichait l’erreur mais gardait les données de l’équipe, et `bootstrapReady` restait vrai. Après une suppression, `Teams.jsx` pouvait aussi resélectionner l’équipe supprimée depuis l’instantané précédent, ce qui provoquait ce 403.

Report adapté à `useTeamData.js` :

- vider la sélection efface l’instantané ;
- un 403 sur une équipe présente dans les adhésions connues efface ses données et recharge les adhésions. On arrive alors sur une autre équipe ou sur l’écran « sans équipe », qui existe déjà.

Adaptation : les liens `?team=` sont arrivés après ce commit. Un lien vers une équipe jamais chargée garde son erreur explicite, sans basculer vers une autre équipe, comme le prévoit le test existant. La partie du commit sur `AppContent.jsx` et la barre latérale n’est pas reprise : `AppContent` affiche déjà l’écran sans équipe quand la liste est vide.

Test : `team-data.test.jsx`, bloc « revoked team membership ».

## 4. Repli local de l’icône du héraut

`OBJECTIVE_ICON_SOURCES.herald` reçoit `/assets/objectives/herald.png` en deuxième position, comme dragon, baron et larves. Test : `objective-icons.test.jsx`.

## Hors périmètre

D’autres éléments de 76dbb10 ne sont toujours pas sur `main` et n’ont pas été repris ici, faute d’être dans la liste retenue le 29 septembre :

- le message `<noscript>` ;
- le dossier `build/` avec son cache immuable et sa 404 ;
- le contrôle plus strict d’`isSafeInternalPath` (antislash, caractères de contrôle, origine). Les appels sensibles (`next` des connexions sociales, destination serveur) filtrent déjà ces caractères eux-mêmes.

## Vérification

- `npm run verify` : typecheck, 146 fichiers et 2 598 tests, build et contrôle SEO réussis.
- Le build contient bien l’événement `vite:preloadError`.
- Rendu de l’écran de secours vérifié dans le navigateur, sur ordinateur et à 375 px : pas de défilement horizontal, boutons de 44 px empilés, focus sur le titre.
- Chaque nouveau test échoue quand on remet le fichier corrigé dans son état antérieur.
