# Nettoyage du code — 24 novembre 2026

Objectif : un code plus lisible, **sans aucun changement visible ni fonctionnel**
(textes, styles, comportements, API, schéma, URL inchangés).

## Méthode

- Recherche du code mort avec `knip` (points d’entrée : `src/main.jsx`, chaque
  fichier de `netlify/functions`, `tools/**`, tests, `vite.config.js`) puis
  vérification manuelle par `grep` (imports dynamiques, chaînes, docs, workflows).
- Recherche des doublons avec `jscpd` et par nom de fonction.
- Référence : `npm run build` avant toute modification, copie de `dist/`
  (le build est reproductible : deux builds successifs sont identiques octet par octet).

## Retiré

| Élément | Raison |
| --- | --- |
| `src/components/brand/PrismeScene.jsx` et `prisme-scene.css` | Composant importé nulle part ; son CSS n’était chargé que par lui. Les images qu’il citait restent utilisées ailleurs. |
| `getSeriesResult` et `generatePlayoffs` (`shared/nexus-tournament.js`) | Alias jamais importés de `resolveSeries` et `generatePlayoffBracket`. |
| Réexport `DISCORD_INVITE_URL` (`src/app/constants.jsx`) | Jamais importé par ce chemin ; la constante reste dans `src/app/social-links.js`. |
| `profileStatusTone` (`src/app/helpers.js`) | Aucun appelant. |
| `brandGlyphPath` (`src/components/brand/brand-geometry.js`) | Aucun appelant ; `BRAND_CONTOURS` et `BRAND_SHEAR` restent la source du 5 en 3D. |
| `loadReportContent` et `clearReportContentCache` (`src/api/report-content.js`) | Aucun appelant ; `loadFullReport` et `useFullReports` restent. |
| Clés `Recto` / `Verso` en double (`src/i18n/showcase-overrides.js`, en et es) | Doublons de valeur identique dans le même objet. |

## Factorisé

- `runAfterMatchPersistence(scope, label, task)` dans
  `netlify/functions/_lib/match-import-request.ts` remplace trois copies
  (`matches-import.ts`, `matches-import-file.ts`, `_lib/analytics.ts`). Le message
  journalisé est identique (`[match-import]` ou `[match-import-file]`).

## Commentaires ajoutés

- En-têtes courts : `src/pages/workspace/workspace-shared.jsx`, `src/utils/png-report.js`.
- `src/pages/public/PublicPages.jsx` : le retrait de ce module de compatibilité
  modifie le découpage du build (AuthPages fusionné dans AppRouter) — essayé puis annulé.

## Preuve d’absence de changement

- `npm run verify` : i18n, typecheck, 259 fichiers / 4 905 tests, build et SEO OK.
- `dist/` après modifications : **identique** à la référence (231 fichiers, même
  liste, mêmes contenus, `diff -r` vide).
- Fonctions Netlify (hors `dist/`) : typecheck, tests et bundle esbuild des deux
  fonctions d’import.

## Laissé de côté par prudence

- `argon2` signalé inutilisé par knip : chargé dynamiquement pour vérifier les
  anciens hachages, conservé.
- `BrandLogo` sans appelant : la charte le désigne comme composant du logo complet.
- `DRAFTER_ORDER_CLIENT_ASSETS` : trace documentaire d’une inspection Drafter.
- Exports utilisés seulement dans leur propre fichier (liste d’export de
  `workspace-shared.jsx`, etc.) : simple retrait du mot `export`, faible gain,
  risque de conflit avec le travail en cours.
- Petits utilitaires identiques (`championKey` dans quatre fichiers, `sameId`) :
  les factoriser modifierait le découpage du bundle.
- Scripts de `tools/` non cités (`admin-opgg-qa.mjs`, `draft-room-qa.mjs`) : bancs
  de QA encore valides pour des fonctions existantes.
- `allowScripts` de `package.json` vise `argon2@0.45.1` alors que 0.45.2 est installé
  (avertissement `npm ci`) : touche l’installation, hors périmètre.
