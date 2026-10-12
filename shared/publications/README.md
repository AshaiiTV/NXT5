# Publications de game NXT5

`game-publication.js` est un module JavaScript pur, sans React, API distante, DOM ni génération IA. `GameWorkspace.jsx` utilise ce moteur pour la lecture coach, les textes de review et le téléchargement PNG d'une game. Le worker Discord utilise le même snapshot et le même PNG complet.

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

La composition unique utilise les primitives de `src/utils/png-report.js`, le fond bleu nuit, le verre violet et le wordmark officiel chargé depuis le dépôt. Les en-têtes et mesures essentielles portent les reflets fixes ; les tables longues restent sur un verre de lecture plus calme. Aucune URL fournie dans un snapshot n’est récupérée côté serveur. Les noms longs font grandir le dessin au lieu de disparaître.

- `game-publication-canvas.js` produit le PNG complet, large de 1 440 px : dix joueurs, statistiques, sorts, builds et objectifs, bleu avant rouge.
- `group-publication-canvas.js` conserve le format compact Discord de 960 px, son bilan et toutes les parties du groupe dans leur ordre. Il reste distinct du rapport analytique de groupe du site. Les surfaces, repères et textes reprennent le verre violet sans changer les résultats ni leur dénominateur.
- Les adaptateurs serveur et navigateur utilisent toujours ce modèle : téléchargement, publication automatique ou manuelle, aperçu et test de connexion. La composition Discord distincte et le sélecteur `layout` sont supprimés.
- La galerie du site propose uniquement ses six exports PNG et CSV, dont un seul modèle de game. Les modèles et la catégorie Discord en sont retirés. Le test de connexion reste disponible dans les réglages du bot et conserve ses données fictives dans ce même modèle.

`game-publication-browser.js` charge les quatre graisses Inter de manière différée via Vite, sous le nom de police **NXT5 Export** ; cela ne change pas la police CSS du site. L'adaptateur serveur enregistre les mêmes fichiers avec `@napi-rs/canvas` puis renvoie de vrais octets PNG. Le PNG reste toujours factuel : l’option historique `includeHints` est acceptée mais ne change plus l’image. Une seule observation et une action courtes peuvent apparaître dans le message Discord si l’option est active ; les reviews NXT gardent leurs données complètes.

`game-publication-assets.js` charge les portraits de champions et icônes du build pour les deux adaptateurs, à partir des mêmes sources de `shared/riot-assets.js`. Le navigateur passe par le proxy existant ; le serveur accepte uniquement les PNG Data Dragon construits depuis les noms nettoyés et IDs numériques, sans redirection, avec une limite de 4 secondes et 2 Mio par tentative. Les deux premières versions sont essayées. Les cinq objectifs emploient les PNG locaux existants de `public/assets/objectives/`, chargés par une liste fixe commune ; ils ne déclenchent aucun appel distant sur le serveur. Une icône indisponible garde le repli textuel existant, sans changer les statistiques ni la géométrie. Les IDs d’objets ou de sorts bruts ne sont jamais affichés. Un build entièrement observé à zéro reste « aucun objet », un build absent reste indisponible. Les côtés bleu/rouge possèdent leurs couleurs propres, séparées de victoire/défaite.

Pour Netlify : conserver `@napi-rs/canvas` en module externe natif, embarquer `public/assets/nxt5-wordmark.png`, les cinq `public/assets/objectives/*.png` et les quatre fichiers `node_modules/@fontsource/inter/files/inter-latin-{400,500,600,700}-normal.woff2`. Le contrôle `tools/verify-discord-bundle.mjs` vérifie leur présence. Vérifier le bundle Linux avant le pilote ; un benchmark macOS ne certifie pas le déploiement Lambda. Aucun secret n'est nécessaire pour le rendu.

Le schéma v1 diffuse une game ; l’analyse reste `nxt5-game-2` et le template devient `nxt5-game-png-5`. Le groupe Discord utilise `nxt5-discord-group-2`. Ces versions entrent dans le hash et la comparaison des snapshots, pour éviter de reprendre les anciens PNG sur une nouvelle publication. Les publications historiques ne sont pas renvoyées automatiquement. L'export historique de groupe reste séparé. La publication de notes staff n'est pas incluse dans le modèle de game.

## Vérification reproductible

```sh
node tools/benchmark-publication-render.mjs
node node_modules/vitest/vitest.mjs run src/__tests__/publication-model.test.js src/__tests__/publication-render.test.ts src/__tests__/review-backfill-generator.test.jsx
```

Le benchmark produit cinq exemples fictifs de partie, tous factuels (dont un appel de compatibilité `includeHints:false`), puis trois groupes : courant, noms longs et 80 parties. Les PNG, snapshots JSON et mesures vont dans `artifacts/discord-render/`, ou dans le dossier passé en argument. Ne pas utiliser leurs identités ou leurs chiffres comme données réelles. Les tests PNG vérifient la signature, les dimensions, le déterminisme avec icônes simulées, l’égalité du rendu serveur avec la composition du navigateur et le budget effectif de 3 Mio des aperçus et publications, y compris le groupe de 80 parties. Ils couvrent les échecs et limites des icônes, l'absence des objectifs locaux, ainsi que l’invalidation des anciens visuels en cache. Le jeu de tests vérifie aussi les corrections de côté/rôle, les valeurs nulles, les lignes incomplètes, la timeline manquante et l'absence de données privées non destinées à la publication. Le message natif résume résultat/score/durée, intègre le PNG et propose un seul accès à la game ; sans image, un champ restitue les chiffres collectifs disponibles.

Documentation du moteur Canvas : https://github.com/Brooooooklyn/canvas#usage.
