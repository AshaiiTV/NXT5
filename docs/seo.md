# Référencement de NXT5

État du chantier : 6 septembre 2026. Les corrections ci-dessous sont préparées dans cette branche ; leur présence sur le domaine public doit être contrôlée après publication. Aucun changement de schéma ou de données en base n’est introduit par ce chantier.

## Constats et corrections

L’audit de production a relevé plusieurs obstacles techniques : `/robots.txt` et `/sitemap.xml` renvoyaient le document HTML de l’application avec un statut HTTP 200 ; le conteneur `root` du HTML initial était vide ; les titres étaient génériques et les URL canoniques absentes. Une URL inconnue recevait également un statut 200, créant un risque de « soft 404 ». Le site pouvait déjà apparaître dans les recherches, mais son contenu dépendait du rendu JavaScript.

Le build produit désormais le HTML de **10 pages publiques**, à partir des composants React partagés avec le navigateur : accueil, six pages légales/contact et trois guides. Le texte, les liens et les titres sont présents dès la réponse HTTP. Cette approche suit les recommandations de [Google sur le référencement JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Les guides répondent à trois besoins distincts :

- `/analyse-equipe-lol` : importer, attribuer et analyser les matchs d’une équipe ;
- `/review-scrim-lol` : structurer une review et préparer une action vérifiable ;
- `/draft-champion-pool-lol` : organiser les pools et préparer les compositions.

Chaque page dispose d’un titre, d’une description et d’une URL canonique propres. L’accueil mentionne explicitement League of Legends ; les guides sont reliés depuis l’accueil, entre eux et dans le pied de page. Les balises sociales et le JSON-LD `WebSite`, `WebPage` et `BreadcrumbList` décrivent le site et ses pages. Le balisage `WebSite` renseigne notamment le nom NXT5, conformément à la documentation [Site names](https://developers.google.com/search/docs/appearance/site-names).

Le build génère un véritable sitemap XML, un fichier robots texte et une réponse HTTP 404 pour les URL inconnues. Les pages de connexion et les espaces privés portent `noindex` ; elles restent explorables pour que les robots puissent lire cette consigne. Les API sont exclues de l’exploration.

## Maintenir les pages et le build

Pour ajouter un guide, crée une entrée dans `MARKETING_PAGES`, dans `src/pages/public/marketing-content.js`. Sa clé est le chemin sans slash final ; renseigne `title`, `description`, `heading`, `eyebrow`, `intro` et `sections`, avec éventuellement des étapes. Écris un contenu utile fondé sur les fonctions réelles, accompagné d’un exemple et de ses limites.

Cette entrée alimente automatiquement le rendu, les routes publiques, les métadonnées, les cartes de découverte et le sitemap. Le pied de page possède une liste explicite : ajoute le lien si nécessaire. Vérifie également le libellé du bouton de découverte, puis exécute `npm run verify`.

`npm run build` lance Vite puis `tools/prerender.mjs`. `PUBLIC_SITE_URL` définit l’origine canonique ; sa valeur par défaut est `https://nxt5.org`. Utilise une origine complète, sans chemin, paramètre ni fragment. Les fichiers générés sont plats, par exemple `analyse-equipe-lol.html`, pour correspondre aux Pretty URLs Netlify sans slash final. Les variantes `.html` redirigent vers les URL publiques.

Lorsque `CONTEXT` est défini et différent de `production`, les pages de prévisualisation reçoivent `noindex` et le sitemap est vide. Le build local sans `CONTEXT` utilise le comportement de production. Ne publie donc pas une prévisualisation comme site principal.

## Vérifications et suivi après publication

La validation locale comprend **165 tests réussis**, le contrôle TypeScript et le build, ainsi que **22 routes vérifiées en HTTP** et un contrôle dans le navigateur à **390 pixels de largeur**. Ces vérifications ne remplacent pas les contrôles sur Netlify après déploiement. L’API PageSpeed a répondu avec une erreur de quota 429 : aucun score réel ni résultat Core Web Vitals certifié n’est disponible dans cet audit.

Après publication :

1. Vérifier dans Google Search Console la propriété du domaine par enregistrement DNS, puis soumettre `https://nxt5.org/sitemap.xml`. Contrôler sa lecture, comme décrit dans le [guide Google sur les sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
2. Inspecter l’accueil et les trois guides : accessibilité, HTML rendu, canonique choisie et état d’indexation. Demander leur indexation si nécessaire.
3. Suivre les exclusions dans le rapport d’indexation. Dans les performances, comparer les impressions, clics et taux de clic par page et requête, en isolant les recherches hors marque, le mobile et la France. Relier ensuite cette acquisition aux inscriptions lorsque leur mesure sera définie.
4. Enrichir progressivement les guides : tutoriel NXT5 Importer, checklist de review et organisation du planning, avec captures réelles du produit. Ajouter des liens naturels depuis les profils publics et les partenaires pertinents ; aucun message ni démarchage n’est envoyé automatiquement.

Aucune donnée de trafic, position ou volume de recherche n’a été inventée. L’objectif est d’améliorer l’accès au contenu et son utilité ; l’indexation et le classement restent décidés par Google. Les [Search Essentials](https://developers.google.com/search/docs/essentials) constituent la référence pour poursuivre ce travail.
