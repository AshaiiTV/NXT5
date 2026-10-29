# Vérification de sécurité du 23 septembre 2026

## Référence examinée

Revue du `main` GitHub `f28b3f17a173c8a668f56c86969b07cba783d91a` et contrôles HTTP limités sur `https://nxt5.org`. Le checkout local historique diffère de cette branche : ses protections supplémentaires ne prouvent pas celles de la version publiée.

Cette revue n'est pas un test d'intrusion complet. Aucun compte de production, message, clé ou enregistrement métier n'a été modifié pour les vérifications.

## Résultats observés

| Contrôle | Résultat |
| --- | --- |
| Dépendances web | `npm audit --json` : aucune vulnérabilité connue signalée pour le lockfile de `main`. |
| Dépendances Importer | `pnpm audit --json` : aucune vulnérabilité connue signalée. |
| CI du commit examiné | [Web checks 35830838097](https://github.com/AshaiiTV/NXT5/actions/runs/35830838097) terminé avec succès. |
| HTTP public | `http://nxt5.org/` redirige en 301 vers HTTPS. La réponse HTTPS contient CSP, HSTS un an, anti-framing, `nosniff`, politique de permissions et restrictions d'origine. |
| API sans session | `auth-me` retourne 401, `Cache-Control: no-store` et un cookie de suppression `Secure; HttpOnly; SameSite=Lax`. Aucun compte utilisé. |
| Protection GitHub au début de la revue | `main` annoncé `protected: false` ; aucune ruleset. Règle préparée dans l'interface : PR obligatoire, contrôle `verify` de GitHub Actions requis, branche à jour et conversations résolues, règles également appliquées à l'administrateur, sans force-push ni suppression. Enregistrement en attente de la confirmation d'identité demandée par GitHub. |
| Accès Netlify | Connecteur refusé : réauthentification nécessaire. Valeurs des secrets, contextes de preview, droits et réglages de sauvegarde non inspectés. |

## Correctifs préparés

- Politique de signalement privé `SECURITY.md` et découverte standard via `/.well-known/security.txt`, avec expiration explicite et type `text/plain`.
- CSP sans styles ou scripts inline : les feuilles CSS restent limitées à l'origine. Contrôle navigateur avec React réel : largeurs, transformations et variables CSS dynamiques préservées ; bloc de style, attribut de style et script injectés refusés. Page de connexion compilée affichée avec cette CSP sans erreur CSP observée.
- Réponses JSON du helper HTTP protégées dans le code des fonctions : CSP restrictive et CORP, en plus des en-têtes existants. Les règles `[[headers]]` de Netlify ne s'appliquent pas aux fonctions.
- Journal du helper limité au statut et au code : plus de sérialisation de l'objet d'erreur pouvant contenir paramètres SQL, identifiants ou réponse d'un fournisseur. Ce correctif ne couvre pas tous les appels à `console` du projet.
- Parcours de récupération atomique : remplacement du mot de passe, invalidation des liens et révocation des sessions dans une même écriture PostgreSQL. Un lien créé depuis un état du compte devenu obsolète est refusé ; une panne du fournisseur e-mail conserve la réponse générique.
- Changement d’adresse e-mail : invalidation atomique des anciens liens de récupération après confirmation du mot de passe. Connexion : une session ne peut pas être créée depuis un mot de passe invalidé entre sa vérification et son insertion.
- Erreurs du fournisseur e-mail : le corps de sa réponse est éliminé sans être recopié dans les journaux ou exceptions.
- Audit npm bloquant dans les commandes Netlify, avant la migration de production, au même seuil `moderate` que GitHub Actions.

Validation locale : `npm run verify` réussi (TypeScript, 84 suites / 1 424 tests et build de production), `git diff --check` sans erreur. Le build copie `security.txt` à l’identique dans `dist/.well-known/` ; sa route répond en texte dans le serveur local de vérification. Les tests de concurrence utilisent le SQL réel via Neon/PGlite avec des ordres contrôlés ; PGlite sérialise les requêtes et ne reproduit pas une contention entre connexions Neon. Les résultats figurent également dans la pull request associée. Un changement dans cette branche n'atteste pas son déploiement en production.

## Vérifications d'exploitation restantes

Confirmer l'enregistrement de la règle GitHub et relire son état. Reconnecter Netlify pour inspecter les périmètres des secrets et isoler les previews. Vérifier les accès privilégiés/MFA et la fenêtre de restauration Neon ; effectuer une restauration dans un environnement isolé avec les accès appropriés. Après déploiement, contrôler les réponses HTTP et le parcours de récupération sur un compte de recette.

HSTS reste limité au domaine visité. L'extension `includeSubDomains` et l'inscription en preload ne sont pas activées sans inventaire de tous les sous-domaines et validation de leur HTTPS. La configuration actuelle impose déjà HTTPS aux visiteurs ayant reçu l'en-tête.

## Références techniques

- [MDN : style-src-attr et propriétés CSS modifiées par JavaScript](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr).
- [Netlify : en-têtes des fonctions dans leur Response](https://www.netlify.com/knowledge-base/how-to-add-a-backend-api-endpoint-with-netlify-functions/).
- [GitHub : branches protégées](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
- [RFC 9116 : security.txt](https://www.rfc-editor.org/rfc/rfc9116.html).
