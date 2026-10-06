# Entrées des globs Tailwind — 6 octobre 2026

Le verrou du site utilise Tailwind 3.4.19, qui dépend de `braces@3.0.3` par sa chaîne de surveillance et de recherche de fichiers. L’[avis GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) décrit un déni de service par motifs profondément imbriqués ; aucun correctif publié n’est disponible pour cette version au moment du contrôle. L’alerte de dépendance reste présente.

[`tailwind.config.js`](../tailwind.config.js) utilise désormais cinq motifs littéraux sans accolades : `./index.html`, puis `./src/**/*.js`, `.jsx`, `.ts` et `.tsx`. Ils couvrent les mêmes fichiers que le motif groupé précédent. Ils ne dépendent d’aucune donnée utilisateur, variable d’environnement ou réponse réseau.

Le [test dédié](../src/__tests__/tailwind-content-security.test.js) examine la syntaxe de cette configuration : une seule exportation d’objet, aucune propriété calculée ni propagation, un unique tableau `content` et uniquement les cinq chaînes approuvées. Une expression calculée qui produirait par hasard des chemins sûrs sur la CI ne suffit donc pas à passer le contrôle.

La dépendance demeure limitée aux outils de développement et au build dans le verrou inspecté. Aucun handler serveur ne reçoit de motif utilisateur dans ce chemin. Cette réduction d’exposition ne corrige pas le paquet upstream et ne permet pas d’annoncer un audit npm sans alerte.

L’exception existante de [`tools/audit-policy.mjs`](../tools/audit-policy.mjs) reste strictement inchangée : cet avis précis et ses dépendances transitives de build, expiration le **5 novembre 2026 à 00:00 UTC**. Les autres avis et toute présence dans les dépendances de production restent bloquants. Le changement de motifs ne prolonge pas cette échéance.

Une migration vers Tailwind 4 supprimerait cette chaîne ancienne mais exige une vérification visuelle séparée : le [guide officiel](https://tailwindcss.com/docs/upgrade-guide) documente des changements de cascade, de preflight, d’espacement et d’utilitaires. La configuration JavaScript compatible ne garantit pas à elle seule le rendu Tailwind 3. Aucune migration de styles n’est incluse ici.
