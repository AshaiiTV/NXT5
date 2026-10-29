# Factorisation des doublons — 30 septembre 2026

Ce lot regroupe les fonctions recopiées que l'audit du 29 septembre avait relevées. Il ne change aucun comportement. Chaque constat a été revérifié sur le code qui intègre l'audit croisé (#97) et la journalisation sécurisée (#89) avant toute modification, puis de nouveau après le rebase sur `main`. Chaque regroupement fait l'objet d'un commit séparé, et la suite complète passe à chaque étape.

## Regroupements

| Sujet | Avant | Après |
| --- | --- | --- |
| `cleanText` serveur | 10 copies identiques dans `netlify/functions/*.ts`, avec des longueurs par défaut différentes | [`_lib/text.ts`](../netlify/functions/_lib/text.ts). La longueur maximale est obligatoire ; les deux appels qui utilisaient la valeur par défaut locale (80) la passent explicitement. |
| `escapeHtml` serveur | 5 copies (`_mailer.js`, `_lib/email.ts`, `matches-import.ts`, `matches-import-file.ts`, `reports-manage.ts`) | `_lib/text.ts` |
| Client Resend | `sendResendEmail` (`_lib/email.ts`) et `sendNotification` (`_mailer.js`) écrivaient chacun leur requête et leur fonction `env()` | Une seule requête `postResendEmail` dans [`_lib/email.ts`](../netlify/functions/_lib/email.ts). `sendNotification` y est déplacé et `_mailer.js` est supprimé. Le délai de 8 s reste réservé aux e-mails de compte, les notifications ne lèvent toujours pas d'erreur et les journaux sont inchangés. |
| Destinataires des notifications | `netlify/functions/_getTeamMembers.js` | [`_lib/team-member-emails.ts`](../netlify/functions/_lib/team-member-emails.ts), contenu inchangé |
| `ensure*` locaux | 13 fonctions non exportées qui ne faisaient qu'`await assertSchemaReady()`, dont `ensureTeamMemberRoleConstraint`, présente en double | Appels directs à `assertSchemaReady()`. Les deux appels successifs de `persistAnalyzedMatch` n'en font plus qu'un, puisque la fonction est mémoïsée. |
| Table des rôles | 7 conversions JUNGLE→JGL… (`_lib/analytics.ts`, `_lib/player-matchups.ts`, `game-publication.js`, `NextPhase.jsx`, `matchup-notebook.js`, `workspace-shared.jsx`, `GameOperations.jsx`) | [`shared/roles.js`](../shared/roles.js) : `normalizeRole` (renvoie toute valeur non reconnue en majuscules), `canonicalRole` (variante stricte qui accepte BOT et renvoie `''` sinon) et `ROLE_SORT_ORDER`, testée égale à l'ancienne table d'ordre |
| Clé de nom de champion | Calculée dans `canonicalChampion` et recopiée dans `championKey` de `workspace-shared.jsx` | `championNameKey` dans [`shared/champions.js`](../shared/champions.js) ; `championKey` reste le nom public côté interface |
| Code mort | `src/utils/riot.js` (seul son test l'importait), `_lib/riot.ts` : `getChampionNameMap`, `fetchTopChampionMastery` et le cache `championNameCache` (écrit, jamais lu), `downloadGamePublicationPng`, `HomeActionSummary`, `pngTint`, `championKey` de `champion-pool-manual.ts`, enveloppe `timelineFrames` de `GameWorkspace.jsx` | Supprimés |

## Laissés en place volontairement

- **Variantes de `cleanText`** qui font autre chose : `matches-import.ts` fusionne les espaces, `assistant-chat.ts` retire les octets nuls et les modules `shared/publications/*` remplacent les caractères de contrôle.
- **`escapeHtml` de `src/seo/metadata.js`** : ce module convertit la valeur avec `String(value)`, sans repli sur une chaîne vide. `0` ou `null` y donnent `"0"` ou `"null"`, alors que la version serveur renvoie `''`.
- **`env()` de `_lib/shopify.ts`** : cette version utilise `??` et applique `trim()`, ce que ne fait pas celle de `_lib/email.ts`.
- **Rôles de `discord-bot-read.ts`** : seuls JUNGLE et SUPPORT y sont convertis avant la validation. Y brancher `normalizeRole` ferait accepter MIDDLE, BOTTOM et UTILITY aux commandes du bot. `importer-app` fait la conversion inverse, vers les positions Riot.
- **`timelineFrames` de `_lib/analytics.ts` et de `matchup-notebook.js`** : les sources lues et la règle de sélection diffèrent : objet timeline dans un cas, première liste non vide parmi les formats stockés dans l'autre.
- **`championKey` de `matchup-notebook.js`** : cette fonction applique les alias Riot avant de passer en minuscules, ce que ne fait pas `championNameKey`.
- **`ensure*` exportés** (`_lib/schema.ts`, `auth.ts`, `engagement.ts`, `player-roster.ts`, `match-categories.ts`, `team-member-emails.ts`…) : de nombreux tests les simulent un par un. Les remplacer demanderait de réécrire ces simulations.
- **`BrandLogo`** : il n'a aucun appelant, mais la charte graphique le désigne comme le composant du logo complet.
- **Hors périmètre, par consigne** : les `Object.assign(new Error(...), { status })` et les migrations de `database/`.

## Tests ajoutés

- [`server-text.test.ts`](../src/__tests__/server-text.test.ts) : troncature, valeurs vides et échappement HTML.
- [`email-resend-request.test.ts`](../src/__tests__/email-resend-request.test.ts) : URL, en-têtes, ordre du corps et délai pour les deux usages de la requête Resend. Ce test passe aussi sur le code d'avant la fusion de `_mailer.js`.
- [`shared-roles.test.js`](../src/__tests__/shared-roles.test.js) : les deux normalisations, la protection contre les clés du prototype et l'égalité avec l'ancienne table d'ordre.
- [`shared-champions.test.js`](../src/__tests__/shared-champions.test.js) : `championNameKey` et son usage dans `canonicalChampion`.

## Vérification

- `npm run verify` réussi après le rebase sur `main` (TypeScript, suite complète, build, 13 pages SEO) ; résultat détaillé dans la pull request.
- Les 91 fonctions de `netlify/functions` se regroupent avec esbuild (`--bundle --platform=node`) sans erreur ni avertissement : tous les imports déplacés se résolvent.
- `npm run discord:check-bundle` n'a pas pu être lancé localement : il lit `.netlify/functions/manifest.json`, qui n'est produit que par un build Netlify.
