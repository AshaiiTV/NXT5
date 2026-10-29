# Entretien du dépôt — 29 octobre 2026

## Branches GitHub

Le dépôt comptait 89 branches distantes avant le nettoyage. Les 69 branches supprimées correspondaient chacune au dernier commit exact d’une pull request fusionnée ; leur commit de fusion a également été vérifié dans l’ascendance de `main`. Les suppressions ont été envoyées atomiquement, avec une vérification du commit attendu de chaque branche pour refuser toute modification concurrente.

Les 20 autres branches restent disponibles : `main`, les neuf branches de PR ouvertes, dont la [PR #228](https://github.com/AshaiiTV/NXT5/pull/228), et dix branches dont l’intégration complète n’est pas démontrée. Les branches locales et les dossiers de travail existants sont conservés. Les noms, commits et PR des branches supprimées sont enregistrés dans un relevé local, avec des références Git locales de récupération sous `refs/archive/nxt5-cleanup-20261029/`.

## Conservation des sources et des preuves

La [PR #121](https://github.com/AshaiiTV/NXT5/pull/121) est remise à jour avec `main` du 28 octobre (`b7ca7f03`). Les rapports datés, leurs captures, les résultats historiques de benchmark, les licences, les fixtures et les outils de vérification restent versionnés à leur emplacement. Les résultats datés des guides SEO et OAuth restent identifiés comme historiques.

Les nouveaux fichiers de travail dans `artifacts/`, `tmp/` et `output/` sont ignorés. Cela ne retire pas les fichiers déjà suivis dans ces dossiers. Le banc d’historique écrit désormais `artifacts/bench-history/results.json` et préserve les anciens JSON de `docs/bench-history/`. La méthode actuelle et la conservation des campagnes sont expliquées dans son [guide](../tools/bench-history/README.md).

Les guides d’installation, des migrations, de fréquentation, du bot, de l’assistant et de vérification sont alignés sur les sources actuelles. La politique de sécurité décrit l’audit sans exception introduit le 28 octobre, ainsi que les règles de journalisation et de reprise des rappels. Les sources du site et de l’Importer, les dépendances et les migrations restent identiques à `main` ; le seul changement de code concerne la destination locale des résultats du banc.

## Vérifications

- `npm ci` depuis le lockfile, puis `npm run verify` : 3 821 messages EN/ES, typage, 241 suites et 4 659 tests, compilation et 13 pages pré-rendues vérifiées.
- `node tools/audit-dependencies.mjs` : réussi, sans exception.
- `BENCH_HISTORY_RUNS=1 npm run bench:history` : réussi aux paliers de 100, 500, 1 000 et 3 000 parties, avec les comparaisons SQL à 3 000 parties. Le résultat est écrit dans le nouveau dossier ignoré ; les résultats historiques restent inchangés. Une seule répétition mesurée vérifie ici le fonctionnement du banc, sans établir de conclusion de performance.
- Compilation du script de rendu Discord par esbuild puis exécution dans un dossier local distinct : cinq exemples de parties et trois groupes, dont le groupe de 80 parties, produits sans remplacer les preuves précédentes.
- 460 liens internes vérifiés dans 99 documents : aucune cible manquante dans le dépôt. Les références à la charte extérieure au dépôt restent conservées et sont hors de ce contrôle de chemins internes.
- `git diff --check`, exclusions Git et absence de modification des sources applicatives, des dépendances, des migrations et des preuves conservées : vérifiés.

Ces contrôles locaux ne constituent pas une validation de la production.
