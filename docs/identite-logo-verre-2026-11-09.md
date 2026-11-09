# Logo NXT5 en verre : Sculpture et Monolithe — 9 novembre 2026

L’utilisateur demande de refaire les logos NXT5 dans la direction artistique « verre » déjà appliquée au site (accueil, connexion, chargement). Parmi cinq pistes proposées, il retient **Sculpture** pour le logo principal et le wordmark, et **Monolithe** pour l’emblème : icônes, avatar d’équipe par défaut et image de partage. Cette livraison remplace les anciens visuels (trident, lettrage chromé, traits « glitch »).

La [charte graphique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) reste la référence ; elle doit être mise à jour dans le dépôt principal avec la section « Logo » décrite ci-dessous. Ce rapport n’en est pas une copie.

## Système de marque

| Élément | Piste | Source | Usage |
| --- | --- | --- | --- |
| Logo principal | Sculpture | `public/assets/brand/nxt5-logo.svg` | `BrandLogo`, hero, documents. Le 5 est extrudé et facetté comme le poster de l’accueil ; « NXT » est clair, légèrement lavande. |
| Wordmark | Sculpture compacte | `public/assets/brand/nxt5-wordmark.svg` | `Nxt5Wordmark` : navigation, pied de page, chargement, exports PNG. Mêmes proportions que le logo, sans extrusion pour rester net en petit. |
| Emblème | Monolithe | `public/assets/brand/nxt5-emblem.svg` | Favicons, icônes Android et Apple, symbole de la barre latérale repliée, avatar d’équipe par défaut, image Open Graph. Tuile de verre `rx` 28/128 avec le 5 à facettes. |
| Monochrome | Silhouette | `public/assets/brand/nxt5-wordmark-mono.svg`, `nxt5-mark-mono.svg` | Une couleur (`currentColor`) pour impression, broderie, filigranes. |

Règles retenues :

- Géométrie unique du 5 : boîte 100 × 120, chanfreins 8, inclinaison `skewX(-8)`. Toutes les déclinaisons partagent cette silhouette.
- Couleurs issues des tokens existants : corps violet (`#9d8cf7 → #6b5ae0 → #5a3fc0`), arêtes du spectre (`#a5f3fc → #c4b5fd → #f0abfc`), tuile `--nxt5-glass-background`, halo `--nxt5-glow-violet`. Les lueurs cyan `rgba(34,211,238)` des anciens composants deviennent violettes.
- Lettrage : Chakra Petch 600 italique, déjà présente dans `public/assets/fonts/chakra-petch` (OFL), convertie en tracés dans les SVG pour un rendu sans police externe. Approche −0,035 em.
- Le 5 en verre du chargement (`glass-poster.webp`) est inchangé : il est la même sculpture.

## Réalisation

- Nouvelles sources SVG dans `public/assets/brand/`.
- `tools/generate-brand-assets.mjs` rasterise ces sources vers les fichiers déjà servis, aux noms inchangés : `nxt5-logo.png` (1500 × 510), `nxt5-wordmark.png` (1204 × 350), `nxt5-loader-favicon.png` (512), `favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico` (16, 32, 48 en PNG), `apple-touch-icon.png` (180), `android-chrome-192x192.png`, `android-chrome-512x512.png`, puis les WebP 320/640 et 256/512 via `optimizeAsset`. Chromium Playwright est requis ; `NXT5_CHROMIUM_PATH` désigne un binaire déjà installé.
- `tools/generate-social-card.mjs` dessine l’emblème Monolithe directement, sans panneau supplémentaire (la tuile est le panneau), et régénère `public/og-nxt5.png`.
- `BrandAssets.jsx` : dimensions intrinsèques mises à jour, lueurs violettes, `TeamAvatar` sans emblème d’équipe affiche la tuile Monolithe centrée au lieu de l’ancien logo calé à gauche. Cache-busters `?v=` incrémentés sur le wordmark, le logo, l’emblème et les favicons.
- `index.html` et `manifest.webmanifest` : `theme-color` et `background_color` alignés sur le fond nuit `#111827`.
- Les exports PNG (`pngHeader`, carte joueur, tendances) continuent d’utiliser `nxt5-wordmark.png` en `contain` ; seule la proportion change (3,44 au lieu de 3,19).

Aucun parcours, calcul, API ou donnée n’est modifié.

## Vérifications

- `npm run verify` : i18n (3 910 messages couverts en anglais et espagnol), TypeScript, **240 suites / 4 574 tests** Vitest, build Vite et prérendu SEO des 13 pages (404 réelle, routes privées noindex, sitemap, robots).
- `npm run test:layout` : 10 contrôles navigateur valides (marges, chevauchements, surcharges, débordements, focus) de 320 à 1 920 px, dans les deux ordres de chargement CSS.
- Harnais local avec les vrais composants : `BrandLogo`, wordmark de la barre latérale (164 × 58) et du chargement, symbole replié (46 px), `TeamAvatar` sans emblème à 32, 36, 48, 62 et 38 px, avatar personnalisé inchangé, favicons 16/32 et icône Apple. Aucune erreur JavaScript.
- Pages publiques Accueil, Fonctionnalités et Connexion rendues à 1 280 px : wordmark en en-tête, 5 en verre existant conservé. `git diff --check` propre.

Ces contrôles utilisent des données fictives et le serveur Vite ; ils ne certifient pas le rendu des exports PNG en production. Les captures restent dans le dossier de travail de la session, hors dépôt.
