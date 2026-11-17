# Outils Prisme

La charte unique est liée dans `../../AGENTS.md` ; ne pas en créer une copie.

Depuis la racine du checkout, avec Node 24 et les dépendances installées :

- `node tools/prisme/build-neon-signature.mjs` reconstruit la signature lumineuse et sa variante couleur compacte 2.7, ainsi que la copie PNG de l’Importer. Les monochromes restent des archives et ne sont plus utilisés dans le produit.
- `node tools/prisme/build-assets.mjs` reconstruit les icônes web, ICO Windows, ICNS macOS et alias compatibles depuis les masters Prisme suivis par Git.
- `node tools/generate-social-card.mjs` reconstruit le visuel Open Graph.
- `node tools/prisme/render-sample.mjs /chemin/specimen.png` rend un spécimen fictif des primitives PNG de production.
- Avec Vite, `/tools/prisme/qa.html` présente les composants de production sur données fictives ; `?loading` présente le chargement 3/8. Cette entrée de recette n’est pas incluse au build du site.

Les petits logos des exports, du spécimen, des emails, de l’Importer et du visuel Open Graph utilisent `nxt5-neon-interface-640.png` : contour cyan/lavande renforcé et même 5 violet facetté. La navigation web utilise ses déclinaisons WebP 320/640. Ne pas réintroduire le blanc plein rejeté par l’utilisateur. Le ratio 8:3 reste identique aux grands emplacements. Après une évolution des tracés, reconstruire les signatures avant les alias et le visuel Open Graph.

Les captures, échanges Claude et logs de la signature 2.6 sont dans `2026-11-17/nxt5-neon-identity/` à la racine de l’espace Codex ; la correction 2.7 des petits logos est dans son sous-dossier `color-compact/`. Le master transparent mesure 1 600 × 600 ; le site utilise les WebP adaptés et les exports le PNG couleur. La recette historique 2.2 reste dans `2026-11-10/nxt5-prisme-integration/`.

### Signature unifiée 2.5 — historique, 11 novembre 2026

`src/components/brand/brand-geometry.js` définit le dessin 2.5 : NXT s’accordait au 5 historique sans le redessiner. Ce moteur reste la source du signe 5 et des icônes. Pour recréer les masters historiques, rendre `/tools/prisme/glass.html?glyph=N` (puis X, T, 5) à 729 × 665, DPR3 et mouvement réduit, en PNG transparent `glyph-N.png` etc. Inspecter les quatre rendus, puis exécuter :

```
node tools/prisme/build-unified-brand.mjs /chemin/vers/rendus
node tools/prisme/build-assets.mjs
node tools/generate-social-card.mjs
```

Les consommateurs 2.6 conservent `nxt5-unified-5-*` et `unified-icon-*` pour le signe 5 et les icônes ; les signatures complètes utilisent `nxt5-neon-*`. Le master historique 7 680 × 2 160 assemble quatre rendus ; l’échelle exacte est rapportée par le compilateur. Les alias historiques restent compatibles et sont reconstruits depuis la signature active par `build-assets.mjs`. La recette 2.5 et les revues Claude se trouvent dans `2026-11-11/nxt5-unified-mobile/` à la racine de l’espace Codex. La charte reste uniquement au chemin indiqué dans AGENTS.md.
