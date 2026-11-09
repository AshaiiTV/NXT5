# Logo NXT5 : le 5 de la page d’accueil partout — 9 novembre 2026

Après la présentation des [cinq pistes](logo-verre-pistes-2026-11-09.md), l’utilisateur retient d’abord **Monolithe (A)** pour le logo et **Écrin (C)** pour les icônes. En relisant l’aperçu, il demande ensuite que le 5 soit partout **le 5 de la page d’accueil**, avec son rendu Three.js : les 5 vectoriels dessinés pour les pistes en différaient (contour, inclinaison, position de la barre médiane, absence de reflets). Ce rapport consigne la livraison finale. Il ne remplace pas la [charte graphique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md), absente de ce checkout : les points à y reporter sont listés plus bas.

## Système retenu

| Élément | Dessin | Usage |
| --- | --- | --- |
| Le 5 | Rendu par la scène Three.js de l’accueil (`src/pages/home/glass-scene.js`, non modifiée) : même contour, extrusion biseautée, verre physique, studio de lumière, pose de repos de l’accueil, fond transparent, 4 096 px. | Source de tous les éléments ci-dessous. |
| Logo | NXT en verre dépoli presque blanc, incliné comme le 5 (0,24), et le 5 rendu en 3D, 1,32 fois plus haut, posé sur la ligne de base. Lueur violette en CSS. | En-têtes, barre latérale, chargement, pied de page, exports PNG, rendu Discord, image de partage. |
| Symbole | Le 5 rendu en 3D, seul, fond transparent. | Cartes joueur et Wrapped, kit de marque. |
| Icône | Le 5 rendu en 3D sur une tuile bleu nuit, halo violet, filet violet discret. | Barre repliée, accueil connecté, emblème d’équipe par défaut, données structurées. |
| Icônes d’installation | Même composition : Apple plein cadre (le système arrondit), Android arrondie, Android « maskable » avec le 5 dans la zone sûre. | Écran d’accueil iPhone et Android. |
| Favicon | Le 5 rendu en 3D, seul ; à 16, 32 et 48 px, éclaircissement modéré et légère accentuation pour rester lisible sur les onglets sombres. | Onglets, favoris, historique. |
| Une couleur | Contour exact du 5 de l’accueil et NXT, en aplat blanc `#f1f5f9` ou nuit `#111827`. | Fonds clairs, impression, broderie. Le logo en couleur n’est pas prévu pour un fond clair. |

L’ancien emblème lance, ailes et anneau ainsi que l’ancien wordmark chromé sont retirés du site.

## Fichiers

1. `node tools/logo-verre/render-glass-five.mjs` rend le 5 avec la scène réelle dans Chromium et écrit `public/assets/brand/nxt5-5-verre-4096.png`. Le banc relève seulement le plafond de résolution de la scène ; la géométrie, les matériaux et l’éclairage sont ceux de l’accueil.
2. `node tools/logo-verre/build-brand.mjs` produit toute la famille à partir de ce rendu (`glass-five.mjs`) et du dessin de NXT (`brand.mjs`). Chromium de Playwright requis ; `NXT5_CHROMIUM` peut indiquer un autre exécutable.

Le dossier `/assets/` est servi avec un cache immuable d’un an : chaque nouvelle version d’un fichier prend une nouvelle adresse (suffixe `-3d`).

- `public/assets/brand/` : `nxt5-logo-3d.png` (1 600 × 573), `nxt5-logo-3d-640.webp`, `nxt5-logo-3d-320.webp` ; `nxt5-symbole-3d-512.png`, `nxt5-symbole-3d-256.webp` ; `nxt5-icone-3d-512.png`, `nxt5-icone-3d-256.webp` ; versions une couleur `nxt5-logo-blanc.svg`, `nxt5-logo-nuit.svg`, `nxt5-icone-blanc.svg`, `nxt5-icone-nuit.svg` ; rendu source `nxt5-5-verre-4096.png`.
- Racine de `public/` : `favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico` (16, 32 et 48 px), `apple-touch-icon.png` (180), `android-chrome-192x192.png`, `android-chrome-512x512.png` et le nouveau `android-chrome-maskable-512x512.png`.
- `public/og-nxt5.png` : régénérée par `tools/generate-social-card.mjs` avec le nouveau logo et le 5 en verre de l’accueil à la place de l’emblème.
- Retirés : `public/assets/nxt5-logo*.{png,webp}`, `nxt5-wordmark*.{png,webp}`, `nxt5-loader-favicon*.{png,webp}`. Plus aucune référence dans le code du site.

## Intégration

- `src/components/brand/BrandAssets.jsx` : `BrandLogo` et `Nxt5Wordmark` affichent le nouveau logo ; nouveau composant `BrandIcon` ; `TeamAvatar` sans emblème d’équipe affiche l’icône centrée au lieu de l’ancien logo calé à gauche. Lueur CSS passée du cyan au violet.
- `AppChrome.jsx` (barre repliée) et `AppContent.jsx` (accueil connecté) utilisent `BrandIcon` ; la signature de `ProductStory.jsx` utilise l’icône.
- Exports PNG (statistiques globales, profil, analyses, tendances, groupes de parties), rendu des publications dans le navigateur et côté serveur (`netlify/functions/_lib/publication-render.ts`, `included_files` de `netlify.toml`) : nouveau logo PNG. Carte joueur et Wrapped : nouveau logo et symbole 3D.
- `src/seo/metadata.js` : logo de l’organisation dans les données structurées = icône 512 px, lisible sur fond blanc.
- `index.html` : versions de cache des favicons incrémentées (`?v=12`, Apple `?v=8`). `public/manifest.webmanifest` : ajout de l’icône `maskable`.
- `tools/optimize-assets.mjs` : la liste des conversions du logo est retirée, remplacée par le générateur. Guides `docs/seo.md` et `docs/kofi-nxt5.md` mis à jour.

## Hors périmètre

- **NXT5 Importer** (`importer-app/`) garde son wordmark, son icône `.ico`/`.icns` et son emblème jusqu’à sa prochaine version : la changer demande une publication de l’application.
- **Avatars externes** (bot Discord, serveur Discord, Ko-fi) : à remplacer à la main avec `public/android-chrome-maskable-512x512.png`, adapté aux avatars ronds.
- `theme_color` du manifeste et de `index.html` reste cyan (`#00d8ff`) : à décider séparément si la barre du navigateur mobile doit passer au bleu nuit.
- Les réseaux sociaux gardent l’ancienne image de partage en cache quelques jours ; l’adresse `og-nxt5.png` n’a pas changé.

## À reporter dans la charte unique

La charte n’étant pas accessible depuis ce checkout, ces changements restent à reporter dans sa source unique :

1. Le 5 de la marque est le 5 de la page d’accueil, rendu par sa scène Three.js ; aucun 5 redessiné à côté. L’emblème lance et ailes est retiré.
2. Logo officiel : NXT en verre dépoli incliné comme le 5, suivi du 5 rendu en 3D (fichiers ci-dessus).
3. Icône officielle : le 5 rendu en 3D sur tuile bleu nuit, pour toute surface carrée ou de moins de 64 px ; favicon : le 5 seul.
4. Versions une couleur blanc et nuit, au contour exact du 5, pour les fonds clairs, l’impression et la broderie.
5. Source des fichiers : `tools/logo-verre/render-glass-five.mjs` puis `tools/logo-verre/build-brand.mjs` ; ne pas modifier les PNG à la main.

## Vérifications

- `npm run verify` : contrôle i18n (3 910 messages en anglais et espagnol, paramètres valides) et TypeScript réussis. Vitest : **239 suites sur 240 et 4 573 tests sur 4 574**. L’échec concerne `discord-setup.test.ts` (« rejects a valid HMAC outside the 120-second window (-121) ») : la signature datée de 121 s peut retomber à 120 s quand une seconde s’écoule pendant le test sous charge. Le fichier relancé seul passe trois fois sur trois (44/44). Aucun code Discord n’a été modifié.
- `npm run build` relancé séparément (le premier échec arrête `verify` avant cette étape) : compilation Vite et pré-rendu des **13 pages publiques** vérifiés, vraie 404, routes privées noindex, sitemap et robots. Avertissement préexistant sur la taille de certains bundles.
- `npm run test:layout` : 10 contrôles navigateur réussis. Le Chromium préinstallé de l’environnement de travail a été imposé par un préchargement local, sans modification du dépôt.
- Banc de rendu Chromium (composants réels, CSS réelles) : barre latérale, barre repliée, accueil connecté, en-tête de l’accueil, pied de page, page d’erreur, administration, Nexus, `BrandLogo`, emblème d’équipe par défaut de 32 à 62 px et signature de 28 px, à 1 100 et 390 px ; écran de chargement à 1 440 × 900 et 390 × 844. Aucune erreur JavaScript, image cassée ou débordement horizontal.
- Pages compilées `/`, `/connexion` et `/fonctionnalites` à 1 440 et 390 px via `vite preview` : nouveaux logos chargés, aucune requête d’asset en erreur ni débordement, favicons `?v=9`, Apple `?v=7`, logo des données structurées sur l’icône 512 px. Les API sont absentes de ce serveur local : les messages d’indisponibilité visibles sur les captures en résultent.
- Favicons relus à 16, 32 et 48 px ; image de partage relue à 1 200 × 630.

Ces contrôles ne couvrent ni la CSP de production, ni les comptes connectés réels, ni l’affichage des icônes après installation sur un téléphone.
