# Pistes de logo dans la direction « 5 en verre » — 9 novembre 2026

L’utilisateur demande plusieurs propositions pour refaire les logos NXT5 avec la nouvelle direction artistique : le 5 en verre violet de l’accueil, du chargement et de la connexion. Ce rapport consigne les cinq pistes présentées. Aucune n’est encore choisie : le site, les favicons et la [charte graphique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) restent inchangés.

## Point de départ

- Logo actuel : emblème lance, ailes et anneau néon au-dessus de NXT5 et de la signature « Draft. Strategize. Win. » (`public/assets/nxt5-logo.png`).
- Wordmark actuel : NXT chromé et 5 en dégradé cyan vers fuchsia (`public/assets/nxt5-wordmark.png`).
- Favicon actuel : l’emblème seul (`public/assets/nxt5-loader-favicon*.webp`, `public/favicon-*.png`).
- Référence de la direction : le 5 facetté en verre violet (`public/assets/home-motion/glass-poster.webp`).

## Pistes

| Piste | Idée | Points forts | À surveiller |
| --- | --- | --- | --- |
| A · Monolithe | Le 5 en verre violet facetté devient le symbole ; NXT passe en verre dépoli presque blanc. | Lien direct avec l’accueil ; structure du logo actuel conservée ; le 5 seul sert de favicon. | Le 5 plus haut que NXT demande de l’air ; épaisseur du verre perdue sous 24 px. |
| B · Prisme | Tout le nom en verre clair, traversé par une bande prismatique ; le 5 garde un cœur violet. | Le plus fidèle au verre ; très fort en grand format. | Contraste dépendant du fond ; lisibilité réduite en petit. |
| C · Écrin | Le 5 gravé dans une tuile de verre fumé à liseré spectral ; nom NXT5 en aplat. | Meilleur rendu à 16 et 32 px ; sert de favicon, d’icône mobile, d’avatar et d’emblème d’équipe par défaut. | Plus sobre ; format d’icône courant. |
| D · Héritage | La lance, les ailes et l’anneau actuels reconstruits en éclats de verre, NXT5 dessous. | Continuité maximale pour la communauté ; format blason. | Le 5 n’est plus le héros ; illisible sous 32 px. |
| E · Cinq éclats | Le 5 assemblé de cinq éclats, un par rôle (top, jungle, mid, ADC, support), teintés sur le spectre. | Raconte l’équipe de cinq ; animation naturelle pour le chargement. | Joints refermés sous 24 px ; cinq teintes à tenir en impression. |

Recommandation présentée : **Monolithe pour le logo, Écrin pour les icônes**, puisque les deux partagent le même 5. Les Cinq éclats peuvent servir d’animation de chargement qui se termine sur le 5 de Monolithe. La décision revient à l’utilisateur.

## Fichiers

- Générateur : `tools/logo-verre/` (`geometry.mjs`, `materials.mjs`, `proposals.mjs`). `node tools/logo-verre/export.mjs` régénère les SVG.
- Exports : `docs/assets/logo-verre-2026-11-09/<piste>/` avec `symbol.svg`, `lockup.svg`, `favicon.svg`, `mono-blanc.svg` et `mono-nuit.svg`. Ces fichiers de travail ne sont pas chargés par le site.
- Planche de présentation : page privée sur claude.ai, partagée avec l’utilisateur dans la conversation du 9 novembre 2026. Elle montre chaque piste sur l’atmosphère de verre, ses déclinaisons, une version une couleur sur fond sombre et clair, les favicons à 64, 32 et 16 px, et quatre mises en situation (navigation, onglet, Discord, écran d’accueil mobile).

## Méthode et limites

- Dessin vectoriel SVG : lettres N, X, T et le 5 sur une grille commune (capitale de 130 unités, fût de 26, italique de 12°), proche de la silhouette du 5 de l’accueil. Les lettres sont un dessin de travail, à affiner après le choix.
- Le verre est simulé par couches : épaisseur décalée, dégradés, facettes pseudo-aléatoires à graine fixe, reflets et liserés. Ce n’est pas un rendu 3D ; le poster 3D de l’accueil reste l’image des grandes scènes.
- Contrôles réalisés : rendu Chromium de la planche à 1 280 et 390 px de large, sans débordement horizontal ni erreur JavaScript ; favicons relus à 192, 32 et 16 px. L’évaluation comparative des pistes est un avis de conception, pas une mesure auprès des utilisateurs.

## Suite après le choix

1. Affiner le dessin retenu : approches, épaisseur du verre, teinte du violet, version dédiée aux 16 px.
2. Exporter la famille : SVG, `favicon.ico` 16 et 32, icône Apple 180, Android 192 et 512, logo et wordmark en WebP 320 et 640, image de partage 1 200 × 630.
3. Intégrer dans `src/components/brand/BrandAssets.jsx` (`BrandLogo`, `Nxt5Wordmark`, emblème d’équipe par défaut), `index.html` et `public/manifest.webmanifest`.
4. Mettre à jour la charte unique dans le même travail, puis exécuter `npm run verify` et `npm run test:layout`.
