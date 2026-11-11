# Outils Prisme

La charte unique est liée dans `../../AGENTS.md` ; ne pas en créer une copie.

Depuis la racine du checkout, avec Node 24 et les dépendances installées :

- `node tools/prisme/build-assets.mjs` reconstruit les icônes web, ICO Windows, ICNS macOS et alias compatibles depuis les masters Prisme suivis par Git.
- `node tools/generate-social-card.mjs` reconstruit le visuel Open Graph.
- `node tools/prisme/render-sample.mjs /chemin/specimen.png` rend un spécimen fictif des primitives PNG de production.
- Avec Vite, `/tools/prisme/qa.html` présente les composants de production sur données fictives ; `?loading` présente le chargement 3/8. Cette entrée de recette n’est pas incluse au build du site.

Les captures, échanges Claude et logs sont dans `2026-11-10/nxt5-prisme-integration/` à la racine de l’espace Codex. Le master 8K reste dans le kit de marque : le site utilise les WebP adaptés et les SVG monochromes.

### Signature unifiée — 11 novembre 2026

`src/components/brand/brand-geometry.js` est le dessin commun : NXT s’accorde au 5 historique sans le redessiner. Pour recréer les masters, rendre `/tools/prisme/glass.html?glyph=N` (puis X, T, 5) à 729 × 665, DPR3 et mouvement réduit, en PNG transparent `glyph-N.png` etc. Inspecter les quatre rendus, puis exécuter :

```
node tools/prisme/build-unified-brand.mjs /chemin/vers/rendus
node tools/prisme/build-assets.mjs
node tools/generate-social-card.mjs
```

Les consommateurs utilisent `nxt5-unified-*` et `unified-icon-*` pour ne pas conserver l’ancienne signature en cache. Le master 7 680 × 2 160 assemble quatre rendus ; l’échelle exacte est rapportée par le compilateur. Les alias historiques restent compatibles. La recette locale et les revues Claude se trouvent dans `2026-11-11/nxt5-unified-mobile/` à la racine de l’espace Codex. La charte reste uniquement au chemin indiqué dans AGENTS.md.
