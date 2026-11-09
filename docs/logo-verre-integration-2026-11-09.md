# Logo « verre » : piste A pour le logo, piste C pour les icônes — 9 novembre 2026

Après la présentation des [cinq pistes](logo-verre-pistes-2026-11-09.md), l’utilisateur retient **Monolithe (A)** pour le logo et **Écrin (C)** pour les icônes. Ce rapport consigne la livraison : dessin final, déclinaisons, intégration et contrôles. Il ne remplace pas la [charte graphique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md), absente de ce checkout : les points à y reporter sont listés plus bas.

## Système retenu

| Élément | Dessin | Usage |
| --- | --- | --- |
| Logo | NXT en verre dépoli presque blanc, 5 en cristal violet facetté, 1,32 fois plus haut et posé sur la même ligne de base. Pas de halo intégré : la lueur violette vient du CSS. | En-têtes, barre latérale, chargement, pied de page, exports PNG, rendu Discord, image de partage. |
| Symbole | Le 5 en cristal seul, fond transparent. | Décor des cartes joueur et Wrapped ; le poster 3D de l’accueil reste l’image des grandes scènes. |
| Icône | Le 5 gravé et éclairé dans une tuile de verre fumé, liseré spectral, tranche cyan → fuchsia. | Icônes d’installation, barre repliée, accueil connecté, emblème d’équipe par défaut, données structurées. |
| Favicon | Le 5 en verre de l’accueil lui-même : rendu par la scène Three.js de `src/pages/home/glass-scene.js` (même contour, extrusion biseautée, verre physique, studio de lumière), pose de repos de l’accueil, fond transparent. À 16, 32 et 48 px : éclaircissement modéré et légère accentuation pour rester lisible sur les onglets sombres. | Onglets, favoris, historique. Choisi par l’utilisateur après deux versions vectorielles jugées trop éloignées du 5 de l’accueil. |
| Une couleur | Logo et icône en aplat blanc `#f1f5f9` ou nuit `#111827`. | Fonds clairs, impression, broderie. Le logo en verre n’est pas prévu pour un fond clair. |

L’ancien emblème lance, ailes et anneau ainsi que l’ancien wordmark chromé sont retirés du site.

## Fichiers

Tous les fichiers de marque sont générés par `node tools/logo-verre/build-brand.mjs` à partir de `tools/logo-verre/brand.mjs` (Chromium de Playwright requis ; `NXT5_CHROMIUM` peut indiquer un autre exécutable). Le dossier `/assets/` est servi avec un cache immuable d’un an : les nouveaux fichiers ont donc de nouvelles adresses dans `public/assets/brand/`.

- SVG maîtres (kit de marque public) : `nxt5-logo.svg`, `nxt5-logo-blanc.svg`, `nxt5-logo-nuit.svg`, `nxt5-symbole.svg`, `nxt5-icone.svg`, `nxt5-icone-blanc.svg`, `nxt5-icone-nuit.svg`.
- Logo : `nxt5-logo.png` (1 280 × 461), `nxt5-logo-640.webp`, `nxt5-logo-320.webp`.
- Symbole : `nxt5-symbole-512.png`, `nxt5-symbole-256.webp`. Icône : `nxt5-icone-512.png` (512 × 529, tranche comprise), `nxt5-icone-256.webp`.
- Racine de `public/` : `favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico` (16, 32 et 48 px), tirés du rendu 3D, `apple-touch-icon.png` (180, plein cadre), `android-chrome-192x192.png`, `android-chrome-512x512.png` et le nouveau `android-chrome-maskable-512x512.png` (5 dans la zone sûre de 80 %).
- `public/og-nxt5.png` : régénérée par `tools/generate-social-card.mjs` avec le nouveau logo et le 5 en verre de l’accueil à la place de l’emblème.
- Rendu 3D du 5 de l’accueil : `public/assets/brand/nxt5-5-verre-4096.png` (4 096 × 4 096, fond transparent), produit par `node tools/logo-verre/render-glass-five.mjs` à partir de la scène réelle ; le banc relève seulement le plafond de résolution. Il sert de source aux favicons (`tools/logo-verre/glass-favicon.mjs`) et de fichier de marque.
- Retirés : `public/assets/nxt5-logo*.{png,webp}`, `nxt5-wordmark*.{png,webp}`, `nxt5-loader-favicon*.{png,webp}`. Plus aucune référence dans le code du site.

## Intégration

- `src/components/brand/BrandAssets.jsx` : `BrandLogo` et `Nxt5Wordmark` affichent le nouveau logo ; nouveau composant `BrandIcon` ; `TeamAvatar` sans emblème d’équipe affiche l’icône centrée au lieu de l’ancien logo calé à gauche. Lueur CSS passée du cyan au violet.
- `AppChrome.jsx` (barre repliée) et `AppContent.jsx` (accueil connecté) utilisent `BrandIcon` ; la signature de `ProductStory.jsx` utilise l’icône.
- Exports PNG (statistiques globales, profil, analyses, tendances, groupes de parties), rendu des publications dans le navigateur et côté serveur (`netlify/functions/_lib/publication-render.ts`, `included_files` de `netlify.toml`) : nouveau logo PNG. Carte joueur et Wrapped : nouveau logo et symbole en cristal.
- `src/seo/metadata.js` : logo de l’organisation dans les données structurées = icône 512 px, lisible sur fond blanc.
- `index.html` : versions de cache des favicons incrémentées (`?v=11`, Apple `?v=7`). `public/manifest.webmanifest` : ajout de l’icône `maskable`.
- `tools/optimize-assets.mjs` : la liste des conversions du logo est retirée, remplacée par le générateur. Guides `docs/seo.md` et `docs/kofi-nxt5.md` mis à jour.

## Hors périmètre

- **NXT5 Importer** (`importer-app/`) garde son wordmark, son icône `.ico`/`.icns` et son emblème jusqu’à sa prochaine version : la changer demande une publication de l’application.
- **Avatars externes** (bot Discord, serveur Discord, Ko-fi) : à remplacer à la main avec `public/android-chrome-maskable-512x512.png`, adapté aux avatars ronds.
- `theme_color` du manifeste et de `index.html` reste cyan (`#00d8ff`) : à décider séparément si la barre du navigateur mobile doit passer au bleu nuit.
- Les réseaux sociaux gardent l’ancienne image de partage en cache quelques jours ; l’adresse `og-nxt5.png` n’a pas changé.

## À reporter dans la charte unique

La charte n’étant pas accessible depuis ce checkout, ces changements restent à reporter dans sa source unique :

1. Logo officiel : piste A « Monolithe » (fichiers et règles ci-dessus) ; l’emblème lance et ailes est retiré.
2. Icône officielle : piste C « Écrin » pour toute surface carrée ou de moins de 64 px.
3. Symbole : le 5 en cristal ; le poster 3D de l’accueil reste l’image des grandes scènes.
4. Versions une couleur blanc et nuit pour les fonds clairs, l’impression et la broderie.
5. Source des fichiers : `tools/logo-verre/build-brand.mjs` ; ne pas modifier les PNG à la main.

## Vérifications

- `npm run verify` : contrôle i18n (3 910 messages en anglais et espagnol, paramètres valides) et TypeScript réussis. Vitest : **239 suites sur 240 et 4 573 tests sur 4 574**. L’échec concerne `discord-setup.test.ts` (« rejects a valid HMAC outside the 120-second window (-121) ») : la signature datée de 121 s peut retomber à 120 s quand une seconde s’écoule pendant le test sous charge. Le fichier relancé seul passe trois fois sur trois (44/44). Aucun code Discord n’a été modifié.
- `npm run build` relancé séparément (le premier échec arrête `verify` avant cette étape) : compilation Vite et pré-rendu des **13 pages publiques** vérifiés, vraie 404, routes privées noindex, sitemap et robots. Avertissement préexistant sur la taille de certains bundles.
- `npm run test:layout` : 10 contrôles navigateur réussis. Le Chromium préinstallé de l’environnement de travail a été imposé par un préchargement local, sans modification du dépôt.
- Banc de rendu Chromium (composants réels, CSS réelles) : barre latérale, barre repliée, accueil connecté, en-tête de l’accueil, pied de page, page d’erreur, administration, Nexus, `BrandLogo`, emblème d’équipe par défaut de 32 à 62 px et signature de 28 px, à 1 100 et 390 px ; écran de chargement à 1 440 × 900 et 390 × 844. Aucune erreur JavaScript, image cassée ou débordement horizontal.
- Pages compilées `/`, `/connexion` et `/fonctionnalites` à 1 440 et 390 px via `vite preview` : nouveaux logos chargés, aucune requête d’asset en erreur ni débordement, favicons `?v=9`, Apple `?v=7`, logo des données structurées sur l’icône 512 px. Les API sont absentes de ce serveur local : les messages d’indisponibilité visibles sur les captures en résultent.
- Favicons relus à 16, 32 et 48 px ; image de partage relue à 1 200 × 630.

Ces contrôles ne couvrent ni la CSP de production, ni les comptes connectés réels, ni l’affichage des icônes après installation sur un téléphone.
