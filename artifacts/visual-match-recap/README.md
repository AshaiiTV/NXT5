# Récap visuel des parties — validation locale

23 octobre 2026. Données entièrement fictives. Aucune publication en production confirmée.

## Changement

La fiche ouvre le récap : compositions, écart final disponible, relevés d’or et piste à explorer. Face-à-face, Drafting et Chronologie restent accessibles par les quatre onglets. Le face-à-face compare Or, Dégâts ou Vision par rôle ; un rôle fiable ouvre ses détails. L’action de débrief et les associations adversaire/draft restent disponibles.

La courbe ne crée ni zéro ni point final ; ses interruptions reflètent les relevés absents. Les rôles ambigus, les participants manquants et les statistiques indisponibles restent explicites. Notre équipe reste à gauche, même côté rouge.

## Vérification

- `npm run verify` : 231 suites, 4 338 tests, 3 782 messages EN/ES, typage et compilation avec 13 pages prérendues. Journal : `verify.log`.
- Relecture indépendante des données, du comparateur, des liens ARIA et de la synchronisation du nom adverse.
- Navigateur : rendu des composants réels avec les styles communs, dans le cadre de l’aperçu local. Largeurs vérifiées de 320 à 1440 px, absence de débordement global dans les vues contrôlées. Captures du récap à 390 px, de l’état incomplet à 320 px et des vues de bureau inspectées.
- Interactions vérifiées : passage au face-à-face depuis la piste ; sélection d’un rôle, focus des détails ; navigation des onglets au clavier ; choix Or/Dégâts/Vision ; accès aux contenus Drafting et Chronologie ; traductions EN/ES ; vrai zéro ; données incomplètes ; alliés côté rouge.
- Correctifs issus du navigateur : grille d’onglets mobile, icônes au-dessus des libellés sur le plus petit format, repositionnement du focus et du défilement après passage au comparateur.

Les tests de composants couvrent aussi le rafraîchissement d’une même partie, le changement de partie, les données ambiguës et les réponses tardives ou refusées du chargement d’adversaire. Les derniers contrôles après ajustements figurent dans `final-targeted.log` et `final-build.log`.

## Reproduire l’aperçu

Depuis la racine du dépôt :

```sh
npx vite --config artifacts/visual-match-recap/preview-vite.config.mjs
```

Ouvrir `http://127.0.0.1:5177/artifacts/visual-match-recap/preview.html`.

L’aperçu utilise les vrais composants de fiche, avec des parties synthétiques. Son serveur d’images réutilise les portraits locaux disponibles ou les sources publiques Riot autorisées. Il n’appelle aucune API de compte et ne modifie aucune donnée utilisateur. Les actions externes de son bandeau sont simulées.

La vérification locale ne certifie ni une session authentifiée complète ni le site publié. La charte graphique unique a été actualisée à sa source, sans copie dans ce checkout.
