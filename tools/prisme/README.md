# Outils Prisme

La charte unique est liée dans `../../AGENTS.md` ; ne pas en créer une copie.

Depuis la racine du checkout, avec Node 24 et les dépendances installées :

- `node tools/prisme/build-assets.mjs` reconstruit les icônes web, ICO Windows, ICNS macOS et alias compatibles depuis les masters Prisme suivis par Git.
- `node tools/generate-social-card.mjs` reconstruit le visuel Open Graph.
- `node tools/prisme/render-sample.mjs /chemin/specimen.png` rend un spécimen fictif des primitives PNG de production.
- Avec Vite, `/tools/prisme/qa.html` présente les composants de production sur données fictives ; `?loading` présente le chargement 3/8. Cette entrée de recette n’est pas incluse au build du site.

Les captures, échanges Claude et logs sont dans `2026-11-10/nxt5-prisme-integration/` à la racine de l’espace Codex. Le master 8K reste dans le kit de marque : le site utilise les WebP adaptés et les SVG monochromes.
