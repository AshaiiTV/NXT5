# Mesurer le chargement de l’historique

Depuis la racine du dépôt, avec Node 24 et les dépendances installées par `npm ci` :

```sh
npm run bench:history
```

Le banc utilise une base PGlite en mémoire et des parties synthétiques ; il ne lit pas `DATABASE_URL` et ne contacte aucun service externe. Il monte le vrai hook `useTeamData`, le client API et le handler `bootstrap` avec un transport HTTP en mémoire. Il vérifie les pages, les dix participants et les jalons CS, puis mesure les paliers de 100, 500, 1 000 et 3 000 parties. Après un échauffement, trois chargements sont mesurés par palier ; la variable d’environnement `BENCH_HISTORY_RUNS` permet de choisir de 1 à 20 répétitions.

Une exécution peut durer plusieurs minutes ; le délai maximal du test est de deux heures. Les résultats sont réécrits après chaque palier dans `artifacts/bench-history/results.json`, ignoré par Git. Le fichier contient l’environnement, les migrations, les mesures serveur et client, les octets JSON et les plans SQL. Ce banc est distinct des suites exécutées par `npm test` et `npm run verify`.

À 3 000 parties, le banc compare sur les mêmes données la requête actuelle, qui pagine avant la projection JSON, et l’ancienne disposition de cette projection. Il conserve trois plans `EXPLAIN ANALYZE` de chaque variante aux offsets 0 et 2 900 et vérifie l’égalité des lignes renvoyées. Comparer ces variantes sur une même machine ; des mesures anciennes réalisées sur un autre poste ne constituent pas une comparaison contrôlée.

La méthode 3 mesure séparément l’ouverture après la première page de 100 parties et la demande explicite d’analyse complète. Elle vérifie qu’aucune pagination automatique ne démarre après cette ouverture. Les [règles du chargement](../../docs/chargement-historique.md) décrivent les vues exigeant un historique complet. Le coût des résumés et participants de cet historique demeure proportionnel au nombre de parties ; les débriefs sont également inclus dans le bootstrap initial. Ces mesures locales ne valident ni la compression HTTP, ni les limites de réponse Netlify, ni la latence ou la contention Neon en production.

Les résultats historiques de `docs/bench-history/` et les rapports qui les citent sont conservés. Une nouvelle exécution écrit uniquement dans `artifacts/` et ne remplace pas ces preuves datées. Pour conserver plusieurs campagnes locales, copier le résultat dans un fichier daté avant la suivante.
