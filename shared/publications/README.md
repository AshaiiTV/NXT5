# Publications de game NXT5

`game-publication.js` est un module JavaScript pur, sans React, API distante, DOM ni génération IA. `GameWorkspace.jsx` utilise ce moteur pour la lecture coach, les textes de review et le téléchargement PNG d'une game. Le worker utilise le même snapshot, avec une synthèse graphique dédiée aux salons Discord.

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

Les deux compositions utilisent les primitives de `src/utils/png-report.js`, la palette NXT5 et le wordmark officiel chargé depuis le dépôt. Aucune URL fournie dans un snapshot n’est récupérée côté serveur. Les noms longs font grandir le dessin au lieu de disparaître.

- `discord-publication-canvas.js` produit la synthèse du bot, large de 960 px : résultat, équipes, côté, date/durée/patch, score, écart d’or, tours/dragons/Nashors, puis les cinq alliés (joueur, champion, K/D/A, dégâts aux champions et participation). Les comparaisons sont explicitement « nous / adversaires », quel que soit le côté. Les catégories sont limitées aux deux premières, avec un compteur supplémentaire. Les données partielles sont signalées sans ajouter les avertissements de timeline aux seules statistiques finales.
- `game-publication-canvas.js` conserve le téléchargement complet de Games, large de 1 440 px : dix joueurs, statistiques, sorts, builds et objectifs, bleu avant rouge. Aucun détail de cet export n’est retiré.
- L’adaptateur serveur choisit la synthèse par défaut (publication, aperçu et test de connexion), avec `layout: 'full'` disponible pour vérification. L’adaptateur navigateur conserve le détail par défaut et accepte `layout: 'discord'` pour la galerie de modèles.

`game-publication-browser.js` charge les quatre graisses Inter de manière différée via Vite, sous le nom de police **NXT5 Export** ; cela ne change pas la police CSS du site. L'adaptateur serveur enregistre les mêmes fichiers avec `@napi-rs/canvas` puis renvoie de vrais octets PNG. Le PNG reste toujours factuel : l’option historique `includeHints` est acceptée mais ne change plus l’image. Une seule observation et une action courtes peuvent apparaître dans le message Discord si l’option est active ; les reviews NXT gardent leurs données complètes.

Dans le rendu complet, le navigateur injecte les portraits de champions et icônes du build via les chargeurs NXT existants. L’enrichissement ne change ni géométrie ni données. La synthèse Discord ne demande aucun de ces assets : seuls le wordmark et les polices locales sont requis, sans appel HTTP. Les IDs d’objets ou de sorts bruts ne sont jamais affichés. Dans le détail, un build entièrement observé à zéro reste « aucun objet », un build absent reste indisponible.

Pour Netlify : conserver `@napi-rs/canvas` en module externe natif, embarquer `public/assets/nxt5-wordmark.png` et les quatre fichiers `node_modules/@fontsource/inter/files/inter-latin-{400,500,600,700}-normal.woff2`. Vérifier le bundle Linux avant le pilote ; un benchmark macOS ne certifie pas le déploiement Lambda. Aucun secret n'est nécessaire pour le rendu.

Le schéma v1 diffuse une game ; l’analyse reste `nxt5-game-2` et le template devient `nxt5-discord-3`. Ce changement entre dans le hash et la comparaison des snapshots, pour éviter de reprendre l’ancien PNG sur une nouvelle publication. Les publications historiques ne sont pas renvoyées automatiquement. L'export historique de groupe reste séparé. La publication de notes staff n'est pas incluse dans le modèle de game.

## Vérification reproductible

```sh
node tools/benchmark-publication-render.mjs
node node_modules/vitest/vitest.mjs run src/__tests__/publication-model.test.js src/__tests__/publication-render.test.ts src/__tests__/review-backfill-generator.test.jsx
```

Le benchmark produit cinq exemples fictifs, tous factuels (dont un appel de compatibilité `includeHints:false`), snapshots JSON et mesures dans `artifacts/discord-render/`. Ne pas utiliser leurs identités ou leurs chiffres comme données réelles. Les PNG natifs vérifient la signature, les dimensions, le déterminisme, l’absence d’HTTP et le budget effectif de 3 Mio des aperçus et publications. Le jeu de tests vérifie aussi les corrections de côté/rôle, les valeurs nulles, les lignes incomplètes, la timeline manquante et l'absence de données privées non destinées à la publication. Le message natif résume résultat/score/durée, intègre le PNG et propose un seul accès à la game ; sans image, un champ restitue les chiffres collectifs disponibles.

Documentation du moteur Canvas : https://github.com/Brooooooklyn/canvas#usage.
