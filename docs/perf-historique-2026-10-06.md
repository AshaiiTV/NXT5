# Historique : pagination avant projection JSON — 6 octobre 2026

## Correction

[`loadMatchPage`](../netlify/functions/_lib/match-page.ts) matérialise désormais la page de parties avant de construire les résumés JSON et d’extraire les objectifs de la timeline. Le tri reste `created_at desc, id desc`. La barrière `MATERIALIZED` empêche PostgreSQL de projeter les lignes écartées par `OFFSET`.

Aucune colonne n’est supprimée et aucune migration n’est nécessaire. Les participants restent chargés en une requête par page. Le hook `useTeamData` demeure inchangé : il attend toutes les pages et ne publie qu’un historique complet.

## Vérifications

- Les tests PostgreSQL comparent les pages regroupées à l’historique complet, y compris lorsque toutes les dates de création sont identiques, et vérifient la page vide au-delà du total.
- La réponse SQL complète est comparée à celle de l’ancienne requête, en conservant exactement la même projection.
- Un test `EXPLAIN ANALYZE` vérifie que l’agrégat des objectifs n’est exécuté que cinq fois pour une page de cinq parties à l’offset 55.
- Le banc complet monte le vrai hook et le vrai handler bootstrap. Il contrôle le nombre de parties, les dix participants par partie, les jalons CS, les offsets et l’absence de publication d’un historique intermédiaire.
- À 3 000 parties, le banc compare aussi l’ancienne et la nouvelle requête sur les mêmes données, sur la même machine, et conserve les trois plans de chaque variante aux offsets 0 et 2 900.

Commandes :

```sh
npm test -- --configLoader native src/__tests__/match-import-atomic.test.ts src/__tests__/team-data.test.jsx src/__tests__/match-archives-limit.test.ts src/__tests__/match-source-environment.test.ts src/__tests__/archive-creation-regressions.test.jsx
npm run bench:history
```

Les cinq fichiers ciblés passent : 211 tests. Ils couvrent aussi les corrections transactionnelles des groupes de parties et du statut de review : révocation d’accès pendant la requête, rétrogradation d’un membre du staff, suppression concurrente d’une partie et annulation de l’écriture si le journal d’audit échoue. Le statut de review corrige également le typage SQL de `reviewed_by` (`uuid`), qui provoquait auparavant l’erreur PostgreSQL `42804`.

## Méthode de mesure

Les résultats bruts sont enregistrés dans [`bench-history/results-2026-10-06.json`](bench-history/results-2026-10-06.json). Le [rapport initial](perf-historique-2026-09-29.md) et son JSON restent conservés.

Machine de cette mesure : Windows x64, AMD Ryzen 7 7800X3D, Node 24.15.0, PGlite 0.5.8 / PostgreSQL 18.3 en WASM. Trois chargements mesurés après échauffement par palier. Les durées serveur additionnent les handlers de toutes les pages ; elles incluent SQL et sérialisation mais aucun réseau réel, authentification distante, cold start ou contention Neon.

Le harness passe à la méthode 2 : les dates du transport PGlite → Neon suivent le format textuel PostgreSQL, afin de ne plus devenir `null` dans le parseur ; les attentes React laissent les rendus se terminer entre deux `act`, au lieu d’attendre à l’intérieur d’un `act` une promesse résolue par un rendu futur. Ces changements concernent uniquement le banc et les tests. La sérialisation corrigée des dates augmente légèrement les octets mesurés par rapport au banc initial.

La machine du rapport initial était un Apple M2 : ses 60,7 secondes à 3 000 parties ne constituent pas une comparaison contrôlée avec les durées Windows. La comparaison ancienne/nouvelle requête de ce nouveau banc, exécutée sur la même base, sert à mesurer le gain SQL. Les durées absolues dépendent aussi de la charge locale ; d’autres travaux sur ce poste peuvent varier pendant la mesure.

## Résultats

Mesure finale complète : 249 secondes, préparation des fixtures comprise. Médianes de trois chargements après échauffement :

| Parties | Appels bootstrap | Temps serveur total | JSON non compressé | Gzip potentiel |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 1 | 451 ms | 1,40 Mo | 0,11 Mo |
| 500 | 5 | 1 400 ms | 6,93 Mo | 0,53 Mo |
| 1 000 | 10 | 2 716 ms | 13,84 Mo | 1,05 Mo |
| 3 000 | 30 | 7 758 ms | 41,49 Mo | 3,14 Mo |

La durée reste approximativement proportionnelle à la taille de l’historique. Un premier passage sur le même poste avait mesuré 5,77 secondes à 3 000 parties ; il précédait la correction de sérialisation des dates du harness et une période de charge locale supérieure. Le tableau retient uniquement le passage final reproductible et son JSON conservé.

Comparaison SQL contrôlée sur les mêmes 3 000 parties :

| Offset | Ancienne requête, médiane | Nouvelle requête, médiane | Agrégations d’objectifs avant / après |
| ---: | ---: | ---: | ---: |
| 0 | 166,6 ms | 181,8 ms | 100 / 100 |
| 2 900 | 4 709,8 ms | 170,6 ms | 3 000 / 100 |

La page profonde est donc environ **27,6 fois plus rapide** pour la requête de résumés. La première page reste du même ordre de coût. Les trois mesures de la nouvelle requête profonde vont de 165,4 à 171,0 ms, contre 4 630 à 5 085 ms auparavant. Le plan démontre que les 2 900 parties sautées ne subissent plus la projection JSON. Les lignes retournées par l’ancienne et la nouvelle requête sont intégralement égales aux deux offsets.

## Limites conservées

Le coût des résumés et des participants demeure proportionnel au nombre total de parties. Le chargement complet transmet toujours toutes les données nécessaires aux analyses, et toutes les reviews arrivent dans le bootstrap initial. Le banc ne démontre ni la compression HTTP ni les limites de taille des réponses sur la plateforme déployée. Il ne remplace pas une mesure Neon ou navigateur en production.
