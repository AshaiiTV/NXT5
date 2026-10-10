# Langues du site NXT5

Le site propose le français (par défaut), l’anglais et l’espagnol. Le sélecteur est présent dans les en-têtes public, connecté et administration. Le choix est conservé sur l’appareil (`nxt5:language:v1`) et synchronisé entre les onglets du même site.

## Fonctionnement

- [`src/i18n/locale.js`](../src/i18n/locale.js) gère le choix de langue et les codes utilisés par `Intl` et Riot. Le premier rendu reste français pour correspondre au HTML pré-rendu ; la préférence est restaurée après hydratation.
- [`LanguageSwitcher.jsx`](../src/i18n/LanguageSwitcher.jsx) utilise un sélecteur natif accessible au clavier et au toucher. Pendant le téléchargement d’un catalogue, la langue actuelle et les formulaires restent affichés. Une erreur permet de réessayer sans perdre le choix précédent.
- [`translate.js`](../src/i18n/translate.js) charge les catalogues anglais et espagnol uniquement à la demande. La traduction s’effectue dans React, sans réécriture du DOM et sans service externe à l’exécution.
- [`useLanguage.js`](../src/i18n/useLanguage.js) abonne les composants au changement. Les dates et nombres utilisent `getLocale()` au moment du rendu ; les données originales restent inchangées.

Les catalogues JSON sont une base de traduction automatisée, complétée par les formulations revues dans les fichiers `overrides*.js`, `component-overrides.js` et `quality-overrides.js`. Ils peuvent être améliorés sans modifier les données métier. Les tests vérifient des parcours et formulations représentatifs ; ils ne constituent pas une relecture linguistique exhaustive.

## Ajouter ou modifier un texte

1. Appeler `useLanguage()` dans le composant qui affiche le texte (y compris les composants mémorisés).
2. Traduire le texte produit avec `t("Texte français")` à son point d’affichage. Pour les valeurs variables, préférer une phrase entière : `t("{0} parties reçues sur {1}", [received, total])`. Définir séparément singulier et pluriel lorsque nécessaire.
3. Ajouter la même clé et ses traductions aux deux catalogues ou à un fichier de formulations revues déjà adapté au contexte. Préserver exactement les paramètres `{0}`, `{1}`, etc.
4. Ne pas traduire les noms, notes, messages ou autres textes saisis par les utilisateurs. Ne pas traduire les clés de routes, valeurs de filtres, codes API ou valeurs enregistrées ; traduire uniquement leur libellé visible.
5. Exécuter `npm run i18n:check`, les tests du parcours modifié, puis `npm run verify` pour la vérification complète.

Le vérificateur [`tools/check-i18n.mjs`](../tools/check-i18n.mjs) contrôle les clés littérales des appels `t()` et les paramètres des deux catalogues. Les textes construits ou issus de tableaux nécessitent aussi une vérification du rendu. [`tools/i18n-inventory.mjs`](../tools/i18n-inventory.mjs) facilite leur inventaire ; ses résultats doivent être relus avant ajout.

## Périmètre

La langue concerne les pages publiques, les formulaires, la démo, l’espace équipe/joueur, la préparation, les profils, les statistiques, le planning, les interfaces Discord et l’administration. L’assistant reçoit la langue choisie et dispose d’une base de réponses en trois langues. Les noms et descriptions de runes/objets Riot utilisent le catalogue Riot correspondant. Les libellés des exports PNG suivent la langue ; leurs contenus saisis restent intacts.

Les URL et les valeurs métier restent stables. Les métadonnées du navigateur suivent le choix ; les pages HTML pré-rendues et les liens canoniques restent français. Cette fonctionnalité ne crée pas des URL SEO `/en` ou `/es`.

Le sélecteur du site ne modifie pas la langue de l’application Windows Importer, des services externes, des anciens messages de l’assistant ou des publications déjà envoyées sur Discord. Les emails et publications automatiques hors site conservent leur propre contenu.
