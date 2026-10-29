# Journaux serveur sécurisés — 29 septembre 2026

## Règle

Dans `netlify/functions/**` et les modules `shared/**` exécutés côté serveur, ne jamais journaliser une erreur brute, son message, sa pile, une requête SQL, ses paramètres ou une réponse de fournisseur. Une erreur peut contenir des identifiants ou des secrets, même lorsque son message semble technique.

## Utilitaire commun

Employer [`logFailure`](../netlify/functions/_lib/safe-log.ts) pour les erreurs interceptées :

```ts
logFailure('[match-import] auto report creation failed after match persistence.', err);
logFailure('Auth retention cleanup failed: sessions', err, { stage: 'cleanup' }, 'warn');
```

Le filtre ne lit que `name`, `code`, `status`, `riotStatus` et `discordStatus`. Le nom est un identifiant de classe de 80 caractères maximum ; le code respecte `/^[A-Z0-9_]{1,80}$/`. Les trois statuts doivent être des nombres entiers entre 400 et 599. Les sauts de ligne sont refusés. Aucun objet d'erreur n'est transmis à la console.

`context` doit rester un libellé contrôlé par le code, limité à 200 caractères. `extra` accepte des métadonnées explicitement choisies et non sensibles : au plus 20 champs, clés de 40 caractères maximum, chaînes de 160 caractères maximum sans caractères de contrôle, nombres finis, booléens ou `null`. Les champs sensibles et objets imbriqués sont rejetés ; les champs réservés subissent le même filtre que ceux de l'erreur. Les métadonnées valides de l'erreur priment sur les valeurs par défaut de `extra`. Ne jamais y placer des données utilisateur, des identifiants, des jetons, ni étaler une erreur : le filtre ne peut pas reconnaître un secret dans une chaîne arbitraire.

## Couverture

Les imports de parties, l'authentification, Discord, l'audience, l'assistant et les nettoyages utilisent ce filtre pour leurs métadonnées d'erreur. `handleError` conserve son journal `{ status, code }` et ses réponses HTTP. Les niveaux `warn` existants et les préfixes sont conservés. Le rappel d'inactivité ne journalise plus l'identifiant utilisateur.

Les journaux déjà limités à des constantes, une étape interne ou au statut numérique d'une `Response` restent inchangés. Aucun appel à `console` n'a été trouvé dans `shared/**`. Le frontend et `importer-app` ne sont pas modifiés.

Les tests [`safe-log.test.ts`](../src/__tests__/safe-log.test.ts) couvrent une erreur PostgreSQL contenant des secrets, les bornes et types des métadonnées, les compléments, les accesseurs et le niveau d'avertissement. Les tests existants [`http-response-security.test.ts`](../src/__tests__/http-response-security.test.ts) contrôlent la compatibilité de `handleError`. Vérification complète : `npm run verify`.

Validation locale : `npm run verify` réussi (code 0 ; TypeScript, 128 suites / 2 283 tests, build et 13 pages SEO vérifiées). Le pré-rendu signale un refus d'ouverture du port WebSocket 24678 dans l'environnement restreint, sans empêcher sa réussite. Les caches ont été isolés dans le checkout avec les dépendances existantes, sans installation ; le lien `node_modules` initial a été restauré après contrôle.
