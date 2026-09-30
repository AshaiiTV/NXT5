# Mesure du chargement de l’historique — 29 septembre 2026

## Objet et périmètre

Mesurer avant d’optimiser. Aucun code de production n’est modifié. Banc écrit le 29 septembre, mesures finales du 30 septembre 2026 sur `main` à `9fa7103` (Apple M2, Node 24.19, PGlite 0.5.8 / PostgreSQL 18.3 en WASM, Vitest 4.1.11 du `node_modules` partagé).

Le banc est dans [`tools/bench-history/`](../tools/bench-history/). Lancer depuis la racine, avec les dépendances déjà présentes :

```sh
npm run bench:history
# Facultatif : changer le nombre de répétitions mesurées (1 à 20).
BENCH_HISTORY_RUNS=5 npm run bench:history
```

Le test unique couvre tous les paliers ; son délai est porté à 2 h (le premier passage, limité à 10 min, s’arrêtait pendant le palier 3 000). Une exécution complète dure environ 7 min sur machine calme. Le JSON est réécrit après chaque palier, pour conserver les mesures d’un passage interrompu.

La configuration dédiée inclut exclusivement `tools/bench-history/history.bench.jsx`. Le motif normal `src/**/*.test.{js,jsx,ts,tsx}` ne le découvre pas : ni `npm test` ni `npm run verify` n’exécutent le banc. `--configLoader native` évite l’écriture du fichier temporaire de configuration dans le `node_modules` partagé. Aucune dépendance n’est ajoutée. Le résultat brut est réécrit dans [`bench-history/results-2026-09-29.json`](bench-history/results-2026-09-29.json).

## Méthode

- Même moteur PostgreSQL embarqué PGlite et même pont Neon que [`match-import-atomic.test.ts`](../src/__tests__/match-import-atomic.test.ts) : vrai générateur de requêtes Neon, paramètres, protocole de lots, encodage des types et transactions PostgreSQL. Seul le transport Neon est remplacé. Base en mémoire, aucune lecture de `DATABASE_URL`, aucun service externe.
- Toutes les migrations de [`loadMigrations`](../tools/migration-runner.mjs) sont appliquées dans l’ordre du déploiement. Comme dans les tests, seule l’extension `pgcrypto` indisponible est retirée et l’entropie du code d’invitation est remplacée. Les index de production sont conservés ; aucun index expérimental n’est ajouté. Les noms, définitions et sommes de contrôle des migrations figurent dans le JSON.
- Création d’un propriétaire, d’une équipe et de cinq profils. Dix variantes déterministes passent réellement par `persistAnalyzedMatch`, avec dix participants, victoires/défaites, deux côtés, objets, sorts, objectifs, statistiques et timeline de 26 à 35 frames. La fonction de production produit elle-même les résumés, les participants, l’archive brute et le rapport automatique.
- Les enregistrements persistés servent de modèles pour atteindre successivement 100, 500, 1 000 et 3 000 parties. Identifiants, références, dates et identifiants Riot sont réécrits ; la structure est conservée. Un rapport automatique et une archive brute sont conservés par partie. Le champion pool est reconstruit et `ANALYZE` est exécuté après chaque palier. Préparation et insertion sont exclues des chronométrages.
- Le vrai [`useTeamData`](../src/hooks/useTeamData.js) est monté avec `react-test-renderer`, appelle le vrai `apiFetch` et le vrai [`bootstrap`](../netlify/functions/bootstrap.ts), puis suit ses propres pages de 100. Aucune réimplémentation de la boucle de pagination. Les assertions vérifient les offsets, le total final, dix participants par partie, les jalons CS, `historyComplete`, `bootstrapReady` et l’absence de publication d’un nombre intermédiaire de parties.
- L’ouverture d’un port local est interdite dans cet environnement (`listen EPERM`). Comme les tests d’endpoints, le banc utilise des objets HTTP `Request`/`Response` en mémoire. Le nombre « HTTP » désigne les appels du client à bootstrap ; aucun paquet TCP n’est émis. L’authentification renvoie le propriétaire synthétique, mais la sélection de l’équipe et les requêtes d’autorisation du handler restent réelles.
- Un chargement complet d’échauffement par palier, puis trois répétitions mesurées. Les tableaux utilisent les médianes. Ce sont des mesures à chaud, sur un seul moteur local, sans concurrence extérieure volontaire. L’échauffement est également enregistré ; il ne constitue pas un démarrage à froid Netlify.
- **Temps serveur** : de l’entrée du handler à la création de sa `Response`, sérialisation JSON incluse, cumulé sur toutes les pages. Inclut le pont Neon local et le moteur WASM. **Temps SQL** : durée de chaque `PGlite.query`, retour des résultats compris, après entrée dans une file sérialisée ; l’attente de cette file est exclue. Les familles SQL sont capturées sans modifier `loadMatchPage`.
- **Octets JSON** : `Buffer.byteLength` UTF-8 du corps exact de chaque réponse, somme de toutes les pages, sans en-têtes ni compression. Gzip est calculé séparément hors chronométrage, à titre de potentiel de compression, sans affirmer que Netlify utilise ce format ou ce niveau.
- **Client** : médiane de cinq exécutions après échauffement des fonctions réelles, sur le résultat complet. JSON.parse et construction/validation de Map sont isolés. Le rendu `TrendsPage` utilise `renderToString` : estimation CPU React/JS de la synthèse complète, sans DOM, peinture, téléchargement des modules ni effets navigateur. Il ne mesure pas un temps d’affichage mobile. Les temps des fonctions incluses dans ce rendu ne doivent pas être additionnés à celui-ci.
- À 3 000 parties, les requêtes et paramètres réellement émis par `loadMatchPage` sont repris dans `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, trois fois chacun, offsets 0 et 2 900. Les plans complets sont conservés dans le JSON.

## Limites d’interprétation

Les données sont synthétiques et utilisent dix modèles : ce n’est pas un échantillon de clients. La taille des timelines, la quantité de rapports, la variété des noms/champions et leur compressibilité peuvent différer en production. Le banc ne mesure ni TLS, ni latence navigateur–Netlify–Neon, ni authentification réelle, ni cold start, ni contention multiéquipes, ni rendu DOM. La base contient une seule équipe ; les choix du planificateur doivent être reconfirmés sur une distribution de production. Les résultats PGlite/WASM ne sont pas des prédictions absolues de durée sur Neon.

Le temps local global enregistré dans le JSON inclut aussi l’instrumentation (copie des corps, assertions de rendu et React de développement). Pour décider, privilégier les temps du handler, la décomposition SQL, les octets et les mesures CPU séparées.

Condition de mesure : un premier passage complet a été fait alors que la machine était très chargée par d’autres processus (charge moyenne ≈ 30 sur 8 cœurs) ; ses temps étaient 2 à 5 fois plus élevés et il a été écarté. Les chiffres ci-dessous proviennent du second passage (charge ≈ 5 à 8), dont les trois répétitions sont à ±3 % l’une de l’autre. Ils recoupent le passage partiel du 29 septembre (500 : 2 165 ms ; 1 000 : 8 781 ms).

## Résultats

Médianes de trois chargements complets à chaud. « Temps serveur » = somme des temps du handler sur toutes les pages.

| Parties | Appels bootstrap | Temps serveur | dont requête `matches` | dont participants | 1re page | Dernière page | JSON total | Gzip (potentiel) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 1 | 182 ms | 118 ms | 36 ms | 182 ms | — | 1,39 Mo | 0,11 Mo |
| 500 | 5 | 2 151 ms | 1 868 ms | 175 ms | 196 ms | 618 ms | 6,90 Mo | 0,52 Mo |
| 1 000 | 10 | 7 284 ms | 6 752 ms | 348 ms | 212 ms | 1 173 ms | 13,79 Mo | 1,05 Mo |
| 3 000 | 30 | 60 741 ms | 58 768 ms | 1 229 ms | 325 ms | 3 608 ms | 41,36 Mo | 3,13 Mo |

Nombre total de requêtes SQL pour un chargement : 20 / 36 / 56 / 136 (16 requêtes fixes au premier appel, puis 3 à 4 par page). Aucune requête N+1 : les participants d’une page sont lus en une seule requête `match_id = any(...)`.

À 3 000 parties, le temps d’une page `matchesOnly` croît linéairement avec l’offset : 294 ms à l’offset 100, 1 298 ms à 1 000, 3 163 ms à 2 000, 3 651 ms à 2 900. La requête participants reste stable (35 à 55 ms par page, hors pics isolés). Le temps total croît donc comme N² : ×11,8 de 100 à 500, ×3,4 de 500 à 1 000, ×8,3 de 1 000 à 3 000.

### Plans EXPLAIN ANALYZE à 3 000 parties

Requêtes et paramètres réellement émis par `loadMatchPage`, trois exécutions chacune (plans complets dans le JSON) :

| Requête | Offset 0 | Offset 2 900 |
| --- | ---: | ---: |
| Comptage (`count(*)`) | 1,5 à 4,7 ms | 1,2 à 1,9 ms |
| `matches` réelle (projection JSON complète) | 115 ms | 3 427 à 3 531 ms |
| Contrôle : mêmes filtre, jointure, tri, LIMIT et OFFSET, projection réduite à l’identifiant | 0,2 ms | 3,7 à 4,8 ms |
| Participants de la page (1 000 lignes) | 26 ms | 27 à 28 ms |

- Offset 0 : parcours de `idx_matches_team`, 101 lignes lues, projection calculée pour 100 lignes.
- Offset 2 900 : le planificateur passe à un parcours séquentiel + tri de 3 000 lignes (1,6 s sous le tri, qui inclut `to_jsonb(matches)`), puis le nœud `Result` calcule la projection pour les **3 000 lignes** avant que `Limit` n’en garde 100 (3,5 s). Le sous-agrégat des objectifs (`jsonb_path_query_array` sur les frames) est exécuté 3 000 fois.
- La sélection des lignes elle-même coûte moins de 5 ms : l’index existe et fonctionne ; ce n’est pas un index manquant.
- Stockage : la colonne `raw` pèse en moyenne 120 Ko en texte et 14 Ko compressée (TOAST) par partie ; elle est décompressée pour chaque ligne projetée.

### Composition des réponses

Taille moyenne d’une partie : 12,5 Ko de JSON, constante quel que soit N.

| Partie de la réponse | Par partie | À 3 000 parties | Part |
| --- | ---: | ---: | ---: |
| Participants (10 × ≈ 920 o) | 9,2 Ko | 27,7 Mo | 67 % |
| Résumé `raw` (objectifs, jalons CS, équipes) | 2,4 Ko | 7,3 Mo | 18 % |
| Colonnes de la partie | 0,8 Ko | 2,5 Mo | 6 % |
| Reviews (toutes, dans la 1re réponse) | 1,3 Ko | 3,9 Mo | 9 % |

La première réponse contient toutes les reviews de l’équipe, sans pagination : 1,39 Mo à 100 parties, 5,15 Mo à 3 000. Le JSON se compresse d’un facteur 13 environ en gzip ; le banc ne vérifie pas si la réponse de production est effectivement compressée.

### Coût côté client après chargement

Médianes de cinq exécutions sur l’historique complet (CPU Node, sans DOM) :

| Opération | 100 | 500 | 1 000 | 3 000 |
| --- | ---: | ---: | ---: | ---: |
| `JSON.parse` de toutes les pages | 3,0 ms | 14,9 ms | 31,2 ms | 92,7 ms |
| Map + validation (`useTeamData`) | < 0,1 ms | < 0,1 ms | 0,1 ms | 0,3 ms |
| `filterImportedGames` | 0,1 ms | 0,2 ms | 0,3 ms | 0,6 ms |
| `buildTrendEvolution` | 0,1 ms | 0,2 ms | 0,2 ms | 0,3 ms |
| `playerIntegratedRows` × 5 joueurs | 1,3 ms | 7,8 ms | 14,4 ms | 60,7 ms |
| `buildDraftTrendModel` | 2,1 ms | 9,4 ms | 20,6 ms | 56,6 ms |
| `buildStaffAlerts` | 0,4 ms | 1,4 ms | 4,7 ms | 13,7 ms |
| Rendu `TrendsPage` (`renderToString`, inclut les calculs ci-dessus) | 13,0 ms | 51,1 ms | 110,9 ms | 379,0 ms |

Le coût client est à peu près linéaire et reste inférieur à 1 % du temps serveur à 3 000 parties (≈ 0,5 s contre 60,7 s). Sur un téléphone lent il peut être plusieurs fois plus élevé, mais ce n’est pas le goulot actuel.

## Causes dominantes mesurées

1. **Projection JSON calculée sur les lignes sautées par OFFSET.** À 3 000 parties, la requête `matches` représente 58,8 s des 60,7 s (97 %). À l’offset 2 900, elle prend 3,5 s contre 3,7 ms pour la même sélection sans projection : 99,9 % du temps sert à construire le JSON de 2 900 lignes jetées ensuite. Coût mesuré ≈ 1,17 ms par ligne projetée, identique à l’offset 0 et 2 900. Sur un chargement complet, environ N²/200 lignes sont projetées (≈ 46 500 à 3 000 parties au lieu de 3 000), d’où la croissance quadratique.
2. **Coût de la projection elle-même : ≈ 1,17 ms par partie** (115 ms pour une page de 100 à l’offset 0, sélection 0,2 ms). Elle inclut `to_jsonb(matches)` sur la ligne entière (colonne `raw` de 120 Ko décompressée) et l’extraction des objectifs dans les frames de la timeline. Le banc ne sépare pas ces deux termes.
3. **Volume : 12,5 Ko par partie, dont 74 % de participants** (67 % de l’ensemble des réponses), soit 41 Mo non compressés à 3 000 parties, plus toutes les reviews dans la première réponse. Ce volume est constant par partie ; il ne cause pas la croissance quadratique mais pèsera sur le réseau mobile si la réponse n’est pas compressée.
4. Non causes, mesurées : ni N+1 (3 à 4 requêtes par page), ni index manquant (sélection < 5 ms à 3 000), ni comptage (< 5 ms), ni calculs client (< 1 %).

## Pistes d’optimisation classées

Toutes conservent la garantie actuelle : `useTeamData` continue de charger toutes les pages et de ne publier qu’un historique complet (`historyComplete`), les analyses ne s’affichant qu’ensuite. Aucune ne change le contrat de pagination vu par le client.

| Rang | Piste | Gain estimé (à partir des mesures) | Risque | Effort |
| ---: | --- | --- | --- | --- |
| 1 | **Projeter après la pagination** : sélectionner d’abord les 100 identifiants (`order by created_at desc, id desc limit … offset …`, sous-requête ou CTE), puis construire le JSON uniquement pour ces lignes, dans le même ordre. | Lignes projetées : N au lieu de ≈ N²/200. À 3 000 parties, ≈ 3,5 s de projection + 1,2 s de participants + < 1 s fixe ≈ **5 à 6 s au lieu de 60,7 s** (×10) ; à 1 000, ≈ 2 s au lieu de 7,3 s. Page profonde : ≈ 120 ms au lieu de 3,6 s. | Faible : même résultat, même ordre, même réponse ; une seule requête dans `match-page.ts`. Vérifier le plan sur Neon et ajouter un test d’égalité des pages. | Faible (≈ ½ journée avec tests). Une pagination par curseur (keyset) supprimerait aussi le tri de 3 000 lignes, mais celui-ci ne coûte que ≈ 4 ms ; elle ne vaut pas le changement de contrat. |
| 2 | **Stocker le résumé compact à l’import** (colonne `summary jsonb` ou champs dédiés remplis par `persistAnalyzedMatch`, avec rattrapage des parties existantes) pour ne plus lire `raw` ni parcourir les frames au chargement. | Supprime l’essentiel des ≈ 1,17 ms par partie restant après la piste 1 : jusqu’à ≈ 3,5 s à 3 000 parties, ≈ 1,2 s à 1 000. | Moyen : migration et rattrapage, cohérence à garantir entre `raw` et résumé lors des réimports et corrections. | Moyen (1 à 2 jours). À n’engager qu’après la piste 1, en re-mesurant. |
| 3 | **Réduire le volume transféré** : vérifier d’abord que la réponse de production est compressée (gzip mesuré ×13 : 41 → 3,1 Mo à 3 000) ; puis ne renvoyer que les colonnes de participants réellement lues par le client (67 % du JSON) et sortir les reviews complètes de la première réponse. | Réseau : jusqu’à ≈ 38 Mo évités à 3 000 parties si rien n’est compressé aujourd’hui ; `JSON.parse` client ≈ 93 ms au maximum. Gain serveur limité (sérialisation). | Moyen pour l’allègement des colonnes (champs utilisés à inventorier dans tout le front) ; nul pour la vérification de compression. | Faible pour la vérification ; moyen pour l’allègement. |

Recommandation : commencer par la piste 1, qui traite la seule cause de croissance quadratique pour un risque faible, relancer `npm run bench:history`, puis décider de la piste 2 selon le temps restant par partie.
