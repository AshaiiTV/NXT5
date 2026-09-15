# Publications de game NXT5

`game-publication.js` est un module JavaScript pur, sans React, API distante, DOM ni génération IA. `GameWorkspace.jsx` utilise ce moteur pour la lecture coach, les textes de review et le téléchargement PNG d'une game. Le worker utilise le même snapshot et le même dessin.

## Contrat

```js
const snapshot = buildGamePublicationSnapshot({
  team,              // { id, name }
  match,             // détail complet + participants corrigés ; pas le résumé bootstrap
  categories,        // catégories de l'équipe ; filtrées par category_ids/category_id
  sourceRevision,    // révision métier opaque, sérialisée en chaîne
  generatedAt,       // date ISO explicite ; absente => null, jamais une horloge cachée
});
const { bytes, mimeType, width, height, filename } = await renderGamePublicationPng(snapshot);
```

Le snapshot comprend `schemaVersion`, `analysisVersion`, `templateVersion`, `teamId`, `entityType`, `entityId`, `sourceRevision`, `publicationKind`, `playedAt`, `generatedAt`, `context`, `coverage`, `facts`, `participants`, `coach`, `reviewHints` et `links`. Il contient uniquement des champs sélectionnés ; les notes staff, archives brutes, puuid, IDs utilisateurs et dates d'import n'y entrent pas.

Une métrique d'équipe contient `{ ally, enemy, diff, unit, available, source }`. Une valeur mesurée est cherchée dans la ligne normalisée, puis `raw.participant`, `raw.stats` et `raw`, comme dans les autres exports NXT. Un champ normalisé absent peut être complété par la mesure brute enregistrée ; sans mesure disponible, la valeur reste `null`. Un zéro observé reste `0`. Les totaux participants exigent cinq lignes connues par équipe et refusent les identités dupliquées. Les côtés proviennent des participants corrigés avant le champ de secours `match.side`. Des côtés contradictoires désactivent les objectifs. Les événements de combat sont attribués depuis les participants corrigés.

Une timeline de simples milestones ne permet pas d'afficher zéro fight. Le classement des fenêtres de combat est une heuristique de kills rapprochés (24 secondes), pas une reconstruction certaine des combats. Les écarts finaux sont des observations et les consignes sont des pistes à vérifier dans la VOD. `playedAt` ne reprend jamais `created_at`.

Les données du snapshot sont une copie indépendante de l'entrée. Les consommateurs doivent traiter cette copie comme immuable. Le calcul du hash et la persistance sont à la charge de l'outbox ; exclure `generatedAt` du hash de contenu.

## PNG

`game-publication-canvas.js` mesure puis dessine le même layout pour les deux runtimes. Les primitives viennent de `src/utils/png-report.js`. Le dessin adopte les tokens de la charte sans changer la palette des autres exports. Le wordmark officiel est chargé depuis le dépôt ; aucune URL fournie dans un snapshot ne sera récupérée côté serveur. Le format factuel mesure 1 440 px de large. Les noms longs font grandir le dessin. Les équipes apparaissent dans deux sections pleine largeur (bleu avant rouge), avec K/D/A, CS, participation, or, dégâts aux champions, vision, sorts, objectifs, patch et date de partie.

`game-publication-browser.js` charge les quatre graisses Inter de manière différée via Vite, sous le nom de police **NXT5 Export** ; cela ne change pas la police CSS du site. L'adaptateur serveur enregistre les mêmes fichiers avec `@napi-rs/canvas` puis renvoie de vrais octets PNG. Le PNG reste toujours factuel : l’option historique `includeHints` est acceptée mais ne change plus l’image. Les observations et pistes restent disponibles uniquement pour le texte Discord et les reviews NXT. Dans les comparaisons en colonnes, le côté bleu est à gauche et le rouge à droite ; les métriques indiquent explicitement « notre équipe / adversaire ».

Le navigateur injecte les portraits de champions et icônes du build via les chargeurs NXT existants. Le serveur ne fait aucun appel HTTP : il affiche les noms français des sorts et un renvoi lisible au détail du build dans NXT5 quand les icônes ne sont pas disponibles. Il n’affiche jamais les IDs d’objets ou de sorts bruts. Ces IDs sélectionnés restent dans le snapshot pour l’enrichissement visuel ; le layout et les statistiques sont identiques entre runtimes, les icônes sont un enrichissement facultatif. Un build entièrement observé à zéro reste « aucun objet », un build absent reste indisponible.

Pour Netlify : conserver `@napi-rs/canvas` en module externe natif, embarquer `public/assets/nxt5-wordmark.png` et les quatre fichiers `node_modules/@fontsource/inter/files/inter-latin-{400,500,600,700}-normal.woff2`. Vérifier le bundle Linux avant le pilote ; un benchmark macOS ne certifie pas le déploiement Lambda. Aucun secret n'est nécessaire pour le rendu.

Le schéma v1 diffuse une game ; les versions d’analyse et de template `nxt5-game-2` identifient les règles de lecture et le dessin factuel issus de main6139f1a. L'export historique de groupe reste séparé, comme l'extension groupe du plan. La publication de notes staff n'est pas incluse dans le modèle de game.

## Vérification reproductible

```sh
node tools/benchmark-publication-render.mjs
node node_modules/vitest/vitest.mjs run src/__tests__/publication-model.test.js src/__tests__/publication-render.test.ts src/__tests__/review-backfill-generator.test.jsx
```

Le benchmark produit cinq exemples fictifs, tous factuels (dont un appel de compatibilité `includeHints:false`), snapshots JSON et mesures dans `artifacts/discord-render/`. Ne pas utiliser leurs identités ou leurs chiffres comme données réelles. Les PNG natifs vérifient la signature, les dimensions, le déterminisme et un budget maximal de 8 Mio. Le jeu de tests vérifie aussi les corrections de côté/rôle, les valeurs nulles, les lignes incomplètes, la timeline manquante et l'absence de données privées non destinées à la publication.

Documentation du moteur Canvas : https://github.com/Brooooooklyn/canvas#usage.
