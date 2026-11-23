# Outils Prisme

La charte unique est liée dans `../../AGENTS.md` ; ne pas en créer une copie. Sa section 4 décrit la signature et ses fichiers.

Depuis la racine du checkout, avec les dépendances installées, dans cet ordre :

1. `node tools/prisme/build-soude-signature.mjs` reconstruit la signature soudée : masters SVG, rendus PNG et WebP, variante d’interface, déclinaisons fond clair et monochromes, favicon vectoriel et copie PNG de l’Importer.
2. `node tools/prisme/build-assets.mjs` reconstruit les icônes web, les favicons, l’ICO Windows et l’ICNS macOS de l’Importer à partir du favicon vectoriel, ainsi que le rendu WebP du 5 en verre.
3. `node tools/generate-social-card.mjs` reconstruit le visuel Open Graph.

Autres outils :

- `node tools/prisme/render-sample.mjs /chemin/specimen.png` rend un spécimen fictif des primitives PNG de production.
- Avec Vite, `/tools/prisme/qa.html` présente les composants de production sur données fictives ; `?loading` présente le chargement 3/8. `/tools/prisme/glass.html` rend la sculpture 3D isolée. Ces entrées de recette ne sont pas incluses au build du site.

## Géométrie de la signature

`soude-geometry.mjs` contient les tracés de la signature dans le gabarit 1 600 × 600. Ce fichier est généré : ne pas le modifier à la main. Si le dessin évolue, ajuster les constantes de `derive-soude-geometry.py` puis le relancer avec Python et shapely (`pip install shapely`). Ce script ne fait pas partie du build.

`src/components/brand/brand-geometry.js` reste la source du 5 en vraie 3D de la scène d’accueil.

## Règles à ne pas oublier

- Le verre du 5 est relevé sur le poster de la sculpture 3D et reste identique à toutes les tailles. Ne pas l’éclaircir pour les petits formats : c’est le contour, et l’arête du favicon sous 48 px, qui portent la lisibilité.
- Les petits logos des exports, des emails, de l’Importer et du visuel Open Graph utilisent `nxt5-soude-interface-640.png`. Ne pas réintroduire un logo blanc plein.
- `/assets/` est mis en cache un an. Une signature modifiée reçoit de nouveaux noms de fichiers, et les adresses de l’ancienne s’ajoutent à `RETIRED_BRAND_ASSETS` dans `tools/seo-build.mjs` avant la suppression de ses fichiers.
- Les rendus ne se retouchent pas à la main : corriger le générateur, puis tout reconstruire dans l’ordre ci-dessus.
