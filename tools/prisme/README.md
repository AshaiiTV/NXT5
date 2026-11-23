# Outils Prisme

La charte unique est liée dans `../../AGENTS.md` ; ne pas en créer une copie.

Depuis la racine du checkout, avec Node 24 et les dépendances installées :

- `node tools/prisme/build-soude-signature.mjs` reconstruit la signature soudée 2.9 : masters SVG, rendus PNG et WebP, variante d’interface, favicon vectoriel et copie PNG de l’Importer. Sa géométrie vient de `soude-geometry.mjs`, lui-même dérivé par `derive-soude-geometry.py` (Python et shapely, hors build) si le dessin évolue.
- `node tools/prisme/build-neon-signature.mjs` reconstruit la signature lumineuse 2.7, désormais historique. Ses fichiers restent servis pour les emails déjà envoyés ; ne plus les brancher sur le produit.
- `node tools/prisme/build-assets.mjs` reconstruit les icônes web, ICO Windows, ICNS macOS et alias compatibles depuis les masters Prisme suivis par Git.
- `node tools/generate-social-card.mjs` reconstruit le visuel Open Graph.
- `node tools/prisme/render-sample.mjs /chemin/specimen.png` rend un spécimen fictif des primitives PNG de production.
- Avec Vite, `/tools/prisme/qa.html` présente les composants de production sur données fictives ; `?loading` présente le chargement 3/8. Cette entrée de recette n’est pas incluse au build du site.

Les petits logos des exports, du spécimen, des emails, de l’Importer et du visuel Open Graph utilisent `nxt5-soude-interface-640.png` : contour cyan/lavande renforcé et 5 dans le verre de la sculpture 3D, identique à toutes les tailles. La navigation web utilise ses déclinaisons WebP 320/640. Ne pas réintroduire le blanc plein rejeté par l’utilisateur. Le gabarit 8:3 reste identique aux grands emplacements. Les icônes et favicons utilisent `soude-icon-*`. Comme `/assets/` est mis en cache un an, une signature modifiée reçoit de nouveaux noms de fichiers. Après une évolution des tracés, reconstruire la signature, puis les icônes et alias, puis le visuel Open Graph.

Les captures, échanges Claude et logs de la signature 2.6 sont dans `2026-11-17/nxt5-neon-identity/` à la racine de l’espace Codex ; la correction 2.7 des petits logos est dans son sous-dossier `color-compact/`. Le master transparent mesure 1 600 × 600 ; le site utilise les WebP adaptés et les exports le PNG couleur. La recette historique 2.2 reste dans `2026-11-10/nxt5-prisme-integration/`.

### Signature unifiée 2.5 — historique, 11 novembre 2026

`src/components/brand/brand-geometry.js` définit le dessin 2.5 : NXT s’accordait au 5 historique sans le redessiner. Ce moteur reste la source du signe 5 et des icônes. Pour recréer les masters historiques, rendre `/tools/prisme/glass.html?glyph=N` (puis X, T, 5) à 729 × 665, DPR3 et mouvement réduit, en PNG transparent `glyph-N.png` etc. Inspecter les quatre rendus, puis exécuter :

```
node tools/prisme/build-unified-brand.mjs /chemin/vers/rendus
node tools/prisme/build-assets.mjs
node tools/generate-social-card.mjs
```

Les consommateurs 2.6 conservent `nxt5-unified-5-*` et `unified-icon-*` pour le signe 5 et les icônes ; les signatures complètes utilisent `nxt5-neon-*`. Le master historique 7 680 × 2 160 assemble quatre rendus ; l’échelle exacte est rapportée par le compilateur. Les alias historiques restent compatibles et sont reconstruits depuis la signature active par `build-assets.mjs`. La recette 2.5 et les revues Claude se trouvent dans `2026-11-11/nxt5-unified-mobile/` à la racine de l’espace Codex. La charte reste uniquement au chemin indiqué dans AGENTS.md.
