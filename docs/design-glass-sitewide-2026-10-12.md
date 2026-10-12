# Verre violet dans l’ensemble du site — 12 octobre 2026

L’accueil public publié devient la référence de matière et de couleur pour les autres pages de NXT5 : fond nuit, verre violet, reflets cyan et fuchsia, portraits de champions et repères des cinq rôles. Cette livraison applique la direction validée par l’utilisateur aux composants partagés puis à chaque famille de pages. La charte de référence reste la source unique indiquée dans [AGENTS.md](../AGENTS.md) ; ce rapport documente l’implémentation et sa vérification.

## Réalisation

| Périmètre | Évolution |
| --- | --- |
| Composants partagés | Tokens de verre et d’éclairage dans `src/index.css`. `Surface` utilise le verre par défaut ; `variant="reading"` offre un fond stable et `variant="scene"` renforce la lumière périphérique. `PageHeader`, onglets, boutons, états vides et dialogues reprennent cette matière. |
| Cadre connecté | Navigation violette, sélection lumineuse, ambiance cyan/violet/fuchsia, menus et assistant accordés au nouveau cadre. |
| Accueil connecté, équipe et profils | Emblème réel de l’équipe, accès aux cinq titulaires, composition du roster sur grand écran, identité du joueur et portrait de son champion le plus joué dans le périmètre consulté. |
| Planning et compte | Repères des cinq rôles, semaine et choix actifs plus présents, panneaux et contrôles cohérents avec les autres pages. |
| Parties, Draft et Analyses | Enveloppes, filtres, compositions, pools, fiches champion, évolution et objectifs harmonisés. Les portraits et rôles existants apportent le contexte League of Legends. |
| Pages publiques et authentification | Atmosphère issue de l’accueil à la connexion, cinq rôles en verre, emblème officiel sur Fonctionnalités, chapitres et surfaces retravaillés. Les documents longs conservent une surface de lecture stable. |
| Guides, Discord et administration | Navigation, en-têtes et panneaux adaptés, avec données et états conservés. |

L’accueil immersif validé conserve sa composition et son moteur. L’application `importer-app` et les règles particulières de la carte joueur / Wrapped restent distinctes. Cette passe ne modifie pas les calculs, les API, les droits ni les règles d’enregistrement. Les habillages supplémentaires de l’espace connecté reposent sur du CSS et les composants de marque existants, sans nouvelle dépendance ni chargement d’un moteur 3D.

## Vérification

- `npm run verify` : traductions, typage, **208 suites / 3 903 tests**, compilation et pré-rendu des 13 pages réussis.
- `node tools/audit-dependencies.mjs` : conforme à la politique du dépôt, avec son exception temporaire de build préexistante.
- `git diff --check` : réussi.
- 72 contrôles de mise en page sur 12 vues de l’espace connecté à 320, 360, 390, 768, 1024 et 1440 px, sans débordement global ni erreur JavaScript.
- 84 contrôles publics et administratifs : 28 vues à 320, 390 et 1440 px, dont les 14 rubriques d’administration ; aucun débordement global, erreur JavaScript ou image cassée relevé.
- Contrôles ciblés des compositions et pools, sélection de champions, filtres, évolution des analyses et dialogue des sources. Le dialogue d’import a été vérifié à 320, 390 et 1440 px.
- Clavier, fermeture des menus et dialogues avec Échap, restitution du focus, couleurs sémantiques, mouvement réduit et mode performance vérifiés. Le mode performance conserve un verre statique sans flou.
- Build final testé sous la CSP exacte de `netlify.toml` : connexion, fonctionnalités, mentions légales et accueil en français, anglais et espagnol sur ordinateur, puis en espagnol sur mobile. Zéro violation CSP, erreur d’hydratation/JavaScript, requête en erreur ou débordement relevé sur ces vues.
- Revue indépendante des composants partagés et des captures sans régression majeure restante identifiée.

Les contrôles connectés utilisent les vrais composants et des données fictives avec API simulées. Les portraits locaux remplacent le proxy Netlify absent du serveur Vite. Ces contrôles ne certifient pas tous les états possibles d’un compte privé en production. Les preuves, scripts et captures restent dans `artifacts/glass-sitewide/` du checkout de livraison ; ils ne sont pas embarqués dans le site.
