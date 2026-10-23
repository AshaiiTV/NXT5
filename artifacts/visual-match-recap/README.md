# Récap visuel des parties — publication initiale et affinements locaux

23 octobre 2026. La version initiale et l’ajustement Drafting ont été publiés par la [PR nº 211](https://github.com/AshaiiTV/NXT5/pull/211), fusionnée au commit `c5720a31b7d7f299734a7c53f73c7ce59839adf0`. Le [déploiement Netlify](https://app.netlify.com/projects/nxt5/deploys/6adbaaa9bdee1cd79aa97038) est confirmé prêt et publié sur [nxt5.org](https://nxt5.org) à 20 h 46 min 13 s, heure de Paris. Les preuves de cette publication sont conservées dans `release.json` et les captures `production-drafting-desktop.png` et `production-drafting-bans-320.png`.

Les affinements ci-dessous, correspondant à la version 1.99 de la charte, sont réalisés localement sur `codex/gold-chart-hover` et ne sont pas encore publiés. Leur aperçu emploie uniquement des données fictives ; il ne certifie pas le comportement de cette nouvelle version en production.

## Affinements locaux — quatre demandes complémentaires

1. **Courbe d’or :** afficher dynamiquement l’heure, l’or des deux équipes et l’écart selon la position horizontale du pointeur dans tout le cadre. Le point retenu est le relevé mesuré le plus proche ; aucune interpolation ni valeur inventée. Le parcours au clavier et le tableau des relevés restent disponibles.
2. **Texte retiré :** supprimer de cette page « Un écart final ne suffit pas à expliquer le résultat. ».
3. **Impact dans chaque équipe :** remplacer le duel au plus fort écart d’or par « Qui a le plus d’impact ? ». Le critère affiché est « Dégâts aux champions » : portraits, noms, dégâts et parts d’équipe des leaders, avec tous les ex æquo. Un effectif incomplet, une valeur manquante ou une identité dupliquée ne produit pas de leader définitif ; cinq zéros mesurés ne produisent pas de classement. Le bouton « Comparer les équipes » ouvre le Face-à-face sans présélection de rôle.
4. **Face-à-face unique :** présenter les totaux collectifs, puis les statistiques, équipements et sorts directement avec les cinq confrontations de rôles, et enfin les objectifs. Retirer le sélecteur de métrique, le second détail de duel et la comparaison complète répétée dans un volet. Conserver les données absentes, les rôles incertains, les côtés et l’ordre de notre équipe à gauche.

### Vérification des affinements

- **Tests :** `npm run verify` réussit : 232 suites, 4 386 tests, 3 773 messages EN/ES, typage et compilation avec 13 pages prérendues. Journal : `refinements-final-verify.log`. Les tests ciblés couvrent le survol du cadre et les relevés proches, le clavier, les leaders par équipe et leurs égalités, les valeurs manquantes et nulles, les identités ambiguës, les contenus uniques du Face-à-face, les équipements, objectifs, formats historiques du CS à 20 minutes et changements de partie. Relecture indépendante finale sans défaut restant identifié sur ces changements.
- **Navigateur :** vérification des vrais composants et styles communs dans l’aperçu local de 320 à 1440 px (320, 360, 390, 768, 1024 et 1440). Les scénarios synthétiques couvrent les équipes complètes, les données incomplètes, les zéros mesurés, notre équipe côté rouge, les noms longs et deux leaders ex æquo dans chaque équipe. Le contrôle porte sur la lisibilité dans le cadre complet, les débordements, le survol hors du tracé, l’accès au Face-à-face et la navigation au clavier. Traductions FR/EN/ES vérifiées ; aucune erreur console dans la session finale.
- **Captures de cette passe :** `refinements-recap-desktop.png`, `refinements-recap-320.png`, `refinements-face-desktop.png` et `refinements-face-320.png`. Les captures et journaux historiques ci-dessous correspondent à leurs versions respectives.
- **Sources et portée :** `preview.jsx` utilise les composants réels de l’application ; `fixture.js` fournit les seules données de parties, joueurs, équipes et drafts. L’en-tête de l’aperçu indique « Données fictives ». Aucun compte, partie ou équipe de production n’est modifié ou interrogé par cet aperçu. Les dialogues et actions externes y sont simulés ; les scénarios automatisés vérifient leurs contrats séparément.

## Version 1.98 publiée — changement initial

La fiche ouvre le récap : compositions, écart final disponible, relevés d’or et piste à explorer. Face-à-face, Drafting et Chronologie restent accessibles par les quatre onglets. Le face-à-face compare Or, Dégâts ou Vision par rôle ; un rôle fiable ouvre ses détails. L’action de débrief et les associations adversaire/draft restent disponibles.

La courbe ne crée ni zéro ni point final ; ses interruptions reflètent les relevés absents. Les rôles ambigus, les participants manquants et les statistiques indisponibles restent explicites. Notre équipe reste à gauche, même côté rouge.

## Vérification initiale du récap

- `npm run verify` : 231 suites, 4 338 tests, 3 782 messages EN/ES, typage et compilation avec 13 pages prérendues. Journal : `verify.log`.
- Relecture indépendante des données, du comparateur, des liens ARIA et de la synchronisation du nom adverse.
- Navigateur : rendu des composants réels avec les styles communs, dans le cadre de l’aperçu local. Largeurs vérifiées de 320 à 1440 px, absence de débordement global dans les vues contrôlées. Captures du récap à 390 px, de l’état incomplet à 320 px et des vues de bureau inspectées.
- Interactions vérifiées : passage au face-à-face depuis la piste ; sélection d’un rôle, focus des détails ; navigation des onglets au clavier ; choix Or/Dégâts/Vision ; accès aux contenus Drafting et Chronologie ; traductions EN/ES ; vrai zéro ; données incomplètes ; alliés côté rouge.
- Correctifs issus du navigateur : grille d’onglets mobile, icônes au-dessus des libellés sur le plus petit format, repositionnement du focus et du défilement après passage au comparateur.

Les tests de composants couvrent aussi le rafraîchissement d’une même partie, le changement de partie, les données ambiguës et les réponses tardives ou refusées du chargement d’adversaire. Les derniers contrôles après ajustements figurent dans `final-targeted.log` et `final-build.log`.

## Ajustement de Drafting

L’onglet affiche directement le `DraftBoard` de la draft liée : picks, bans, source et commandes de relecture. L’analyse indicative « La leur / La nôtre » est retirée de cet onglet. L’ajout, le remplacement et le détachement restent dans le dialogue de gestion. Sans draft liée, l’état vide propose au staff d’en ajouter une ; aucun ban n’est déduit des participants de la partie.

- `npm run verify` : 231 suites, 4 351 tests, 3 783 messages EN/ES, typage et compilation avec 13 pages prérendues. Journal : `verify-inline-draft.log`.
- Les tests couvrent la draft unique, les droits de gestion, le chargement, l’erreur et la reprise, les réponses tardives, le changement de partie et la conservation de la relecture sans requête supplémentaire. Les réponses reçues dans un onglet masqué ne déplacent pas le focus.
- Navigateur : dix picks et dix bans affichés dans l’aperçu synthétique, relecture et clavier fonctionnels, position conservée après changement d’onglet. Inspection visuelle sur ordinateur et dans un cadre de 320 px (`mobile.html`) ; les bans deviennent des lignes compactes sur petit écran.
- Revue finale : conservation du bouton déclencheur après ajout ou détachement pour que la fermeture du dialogue lui rende le focus. Après ce correctif, les 25 tests du panneau, les traductions, le typage et la compilation repassent ; journaux : `inline-draft-tests.log` et `build-inline-draft-final.log`.
- Captures locales inspectées : `drafting-desktop.png` et `drafting-bans-320.png`.

## Préparation de publication

La préparation de publication a révélé des alertes de sécurité dans les outils de développement : la CI et Netlify validaient les 4 352 tests et la compilation, puis bloquaient sur l’audit. Vite est corrigé de 7.3.6 à 7.3.7 et Vitest de 5.0.2 à 5.0.5, avec leurs dépendances associées dans le lockfile. L’audit npm ne signale plus de vulnérabilité et la politique de contrôle reste inchangée. La vérification complète repasse avec ces versions : 231 suites, 4 352 tests, 3 783 messages EN/ES, typage, compilation et 13 pages prérendues. Preuves locales : `audit-security-patches.json`, `audit-security-patches.log` et `verify-security-patches.log`.

## Reproduire l’aperçu

Depuis la racine du dépôt :

```sh
npx vite --config artifacts/visual-match-recap/preview-vite.config.mjs
```

Ouvrir `http://127.0.0.1:5177/artifacts/visual-match-recap/preview.html`.

L’aperçu utilise les vrais composants de fiche et de draft, avec des parties et des drafts synthétiques. Son serveur d’images réutilise les portraits locaux disponibles ou les sources publiques Riot autorisées. Il n’appelle aucune API de compte et ne modifie aucune donnée utilisateur. L’action de gestion de draft est simulée ; les mutations réelles sont vérifiées dans les tests de composants.

La vérification locale ne certifie ni une session authentifiée complète ni le site publié. La charte graphique unique a été actualisée à sa source, sans copie dans ce checkout.
