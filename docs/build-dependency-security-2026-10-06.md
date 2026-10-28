# Dépendances de construction et audit

## Mise à jour du 28 octobre 2026

Le site utilise désormais Tailwind 4 avec `@tailwindcss/postcss`. Les sources restent explicitement limitées à `index.html` et `src/` ; le thème JavaScript et les couleurs historiques sont conservés pour préserver le rendu NXT5. Autoprefixer a été retiré, cette étape étant intégrée à Tailwind 4.

L’[avis GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) a été retiré le 23 octobre 2026. L’exception temporaire correspondante a été supprimée de `tools/audit-policy.mjs`. L’audit bloque désormais tous les avis modérés, élevés ou critiques, y compris dans les outils de construction, sans exception. Ses tests contrôlent également le rejet d’une réponse d’audit invalide.

Les versions directes et transitives sont verrouillées dans `package-lock.json` et `importer-app/pnpm-lock.yaml`. Les scripts d’installation nécessaires à Argon2, esbuild et fsevents sont autorisés par version dans le manifest du site pour les installations utilisant npm 12. Les autres versions de npm conservent leur fonctionnement habituel.

L’Importer utilise Electron 45 et pnpm 12. Son audit ne conserve aucune exception de sécurité. Les constructions locales ne remplacent pas les artefacts signés du workflow officiel.

## Compatibilité des mises à jour majeures

- Neon 1.2 : les requêtes paramétrées en texte passent par `sql.query(texte, paramètres)`. Les templates SQL et les transactions gardent leur fonctionnement ; des tests avec transport intercepté vérifient que les requêtes restent différées et que les valeurs ne sont pas concaténées au SQL.
- Vite 8 : le découpage des modules utilise `rolldownOptions.output.codeSplitting`, avec un module React partagé et des modules séparés pour les icônes, GSAP et Three.js.
- TypeScript 7 : le contrôle de types appelle explicitement `node node_modules/typescript/bin/tsc`, pour éviter la collision de binaires avec le paquet de compatibilité. Les outils d’inventaire/traduction et le contrôle des sources Tailwind utilisent l’API stable `@typescript/typescript6`, recommandée par Microsoft pour les outils qui reposent sur l’ancienne API du compilateur.
- Tailwind 4 : les utilitaires conservent la cascade sans couche CSS du site, les palettes sRGB existantes, le thème local, les placeholders et les contours de focus. La migration ne change pas la charte graphique.

## Exports PNG des groupes

Canvas 1.0.12 active un tramage des dégradés qui augmente fortement le poids des groupes de nombreuses parties. Le serveur rend ces groupes sur une surface F16, convertit le résultat en PNG 8 bits, puis ne recompresse les données filtrées que si le fichier dépasse 3 Mio. Cette recompression zlib est asynchrone et sans perte ; elle conserve les dimensions, tous les textes et toutes les parties. Le flux évite d’allouer un second tampon de pixels décompressés complet.

Le test de 80 parties conserve son plafond de 3 Mio et vérifie le vrai encodeur utilisé en production. Un test supplémentaire compare exactement les pixels décodés avant et après recompression. Les bornes existantes sur le nombre de parties et la hauteur restent appliquées avant la grande allocation.

## Vérifications du 28 octobre 2026

- Installation propre du site depuis le verrou (`npm ci`), contrôle de types TypeScript 7.0.2, 3 821 messages de traduction et leurs paramètres vérifiés.
- `npm run verify` : 241 suites et 4 659 tests réussis, build Vite et 13 pages publiques pré-rendues avec contrôle SEO.
- Audits npm et pnpm : zéro vulnérabilité signalée. Aucun paquet direct obsolète signalé par `npm outdated` ou `pnpm outdated`.
- Importer 0.3.9 : 49 tests unitaires, 23 scénarios Electron réels, installation figée, ZIP Mac arm64 et x64 construits sans signature et intégrité vérifiée. Windows et publication officielle restent contrôlés par le workflow GitHub.
- Interfaces : 42 rendus avant/après sur sept familles à 1440, 390 et 320 px ; 678 éléments comparés sans écart de géométrie supérieur à 1 px. Compléments à 360, 768 et 1024 px, chargement, noms longs, clavier, menus et dialogue de débrief. Aucune erreur JavaScript ni débordement dans les scénarios contrôlés ; relecture indépendante des captures.
- PNG du groupe de 80 parties : 960 × 14 450 px, 2 963 916 octets avec Inter et le logo, sous la limite de 3 145 728 octets. Compression sans perte des pixels vérifiée.

La validation visuelle concerne Chromium local avec mouvement réduit et API interceptées/données fictives, notamment l’état d’erreur de l’administration. Elle ne certifie pas chaque écran ni la production. Les captures et journaux sont conservés dans l’espace de travail. Quelques dépendances transitives dépréciées restent imposées par les outils amont ; leurs majeures ne sont pas forcées hors des contraintes compatibles.

## Historique du 6 octobre 2026

Le verrou du site utilise Tailwind 3.4.19, qui dépend de `braces@3.0.3` par sa chaîne de surveillance et de recherche de fichiers. L’[avis GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) décrit un déni de service par motifs profondément imbriqués ; aucun correctif publié n’est disponible pour cette version au moment du contrôle. L’alerte de dépendance reste présente.

[`tailwind.config.js`](../tailwind.config.js) utilise désormais cinq motifs littéraux sans accolades : `./index.html`, puis `./src/**/*.js`, `.jsx`, `.ts` et `.tsx`. Ils couvrent les mêmes fichiers que le motif groupé précédent. Ils ne dépendent d’aucune donnée utilisateur, variable d’environnement ou réponse réseau.

Le [test dédié](../src/__tests__/tailwind-content-security.test.js) examine la syntaxe de cette configuration : une seule exportation d’objet, aucune propriété calculée ni propagation, un unique tableau `content` et uniquement les cinq chaînes approuvées. Une expression calculée qui produirait par hasard des chemins sûrs sur la CI ne suffit donc pas à passer le contrôle.

La dépendance demeure limitée aux outils de développement et au build dans le verrou inspecté. Aucun handler serveur ne reçoit de motif utilisateur dans ce chemin. Cette réduction d’exposition ne corrige pas le paquet upstream et ne permet pas d’annoncer un audit npm sans alerte.

L’exception existante de [`tools/audit-policy.mjs`](../tools/audit-policy.mjs) reste strictement inchangée : cet avis précis et ses dépendances transitives de build, expiration le **5 novembre 2026 à 00:00 UTC**. Les autres avis et toute présence dans les dépendances de production restent bloquants. Le changement de motifs ne prolonge pas cette échéance.

Une migration vers Tailwind 4 supprimerait cette chaîne ancienne mais exige une vérification visuelle séparée : le [guide officiel](https://tailwindcss.com/docs/upgrade-guide) documente des changements de cascade, de preflight, d’espacement et d’utilitaires. La configuration JavaScript compatible ne garantit pas à elle seule le rendu Tailwind 3. Aucune migration de styles n’est incluse ici.
