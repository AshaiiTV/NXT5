# Récap visuel des parties — versions publiées et affinements locaux

23 octobre 2026. La version initiale et l’ajustement Drafting ont été publiés par la [PR nº 211](https://github.com/AshaiiTV/NXT5/pull/211), fusionnée au commit `c5720a31b7d7f299734a7c53f73c7ce59839adf0`. Le [déploiement Netlify](https://app.netlify.com/projects/nxt5/deploys/6adbaaa9bdee1cd79aa97038) est confirmé prêt et publié sur [nxt5.org](https://nxt5.org) à 20 h 46 min 13 s, heure de Paris. Les preuves de cette publication sont conservées dans `release.json` et les captures `production-drafting-desktop.png` et `production-drafting-bans-320.png`.

Les affinements de la version 1.99 ont été publiés par la [PR nº 213](https://github.com/AshaiiTV/NXT5/pull/213), fusionnée au commit `3fc79b4b4ae896c15388d9b49bf0c84761058c71`. Le [déploiement Netlify](https://app.netlify.com/projects/nxt5/deploys/6adbb7143598bf7b122ed417) est confirmé prêt et publié le 23 octobre 2026 à 21 h 38 min 57 s, heure de Paris. Preuves : `release213.json`, `release213-production-http.json` et captures `release213-*-production*.png`.

La disposition compacte du Face-à-face (version 1.100) et la courbe d’or bleue/rouge (version 1.101) sont réalisées localement sur `codex/compact-head-to-head`, dans la même [PR nº 214 ouverte](https://github.com/AshaiiTV/NXT5/pull/214), et ne sont pas publiées. La production reste en version 1.99 / PR nº 213. L’aperçu emploie uniquement des données fictives ; les validations ci-dessous ne certifient pas ces nouvelles versions en production.

## Version 1.101 locale — Courbe d’or bleue/rouge

- À la demande de l’utilisateur, la courbe est bleue (`#60a5fa`) quand notre équipe mène, rouge (`#f87171`) quand l’adversaire mène et neutre à zéro. La convention suit le signe de l’écart « Notre équipe − adversaires » ; elle ne change pas quand notre équipe joue côté rouge.
- Des variables locales `match-gold` appliquent ces couleurs au trait, à un aplat à 16 % jusqu’à zéro, à la légende, aux points de fin, au repère et aux valeurs affichées au survol. Les couleurs globales de l’application ne sont pas modifiées.
- Le trait est découpé par signe aux croisements géométriques de zéro. Ce découpage de dessin ne crée aucun relevé interpolé et les interruptions restent visibles. Le survol dans tout le cadre, la sélection du relevé mesuré le plus proche et les commandes clavier restent inchangés.

### Vérification de la courbe bleue/rouge

- **Tests :** 29 tests ciblés de courbe réussissent. Le contrôle complet `npm run verify` réussit : 232 suites, 4 395 tests, 3 774 messages explicitement traduits en anglais et espagnol, typage et compilation avec 13 pages prérendues ; journal `blue-red-gold-verify.log`. La revue finale du découpage du trait est validée.
- **Navigateur :** scénario fictif « Avantage alterné » de 32 relevés, avec croisements bleu/rouge contrôlés à 1440 et 320 px. Le survol hors de la courbe a affiché 5:00 / +1 800 en bleu et 25:00 / −2 400 en rouge avant la dernière correction du dessin, qui ne change pas la sélection des relevés. Le clavier est vérifié à 320 px sur la version finale. Le scénario de zéros mesurés garde tous les points gris et un trait uniformément neutre ; l’état incomplet montre le message d’indisponibilité sans sélecteur de relevé ni débordement.
- **Captures et console :** `blue-red-gold-desktop.png` et `blue-red-gold-320.png` ont été refaites avec le trait final découpé par signe ; `blue-red-gold-zero-320.png` confirme le zéro neutre. Aucune nouvelle erreur console après le dernier chargement neuf.
- **Portée :** vrais composants avec fixtures synthétiques, sans modification de données, de permissions ou de production. Le Face-à-face compact de la version 1.100 reste inclus dans la même PR nº 214.

## Version 1.100 locale — Face-à-face compact

- Les cinq rôles deviennent des lignes compactes. Chaque portrait et chaque équipement ou sort apparaît une seule fois, avec jusqu’à neuf icônes par joueur. Les K/D/A et CS sont intégrés à l’identité.
- Trois barres Or/Dégâts/Vision restent visibles simultanément, avec les valeurs exactes des deux joueurs et l’écart signé. L’échelle est commune aux cinq rôles pour chaque métrique. Les icônes et une légende partagée remplacent les titres répétés.
- Les cinq boutons de rôle, d’au moins 44 px, ouvrent le `ModalDialog` commun. Il contient uniquement sept repères secondaires : CS à 10 et 20 minutes, participation aux éliminations, parts des dégâts, de l’or, de la vision et des morts. Aucun sous-onglet ni tableau ne répète les portraits, équipements ou comparaisons principales.
- Les totaux collectifs, objectifs, données absentes, rôles incertains et droits existants sont conservés. L’ordre reste notre équipe à gauche, y compris côté rouge. Cette itération ne modifie ni les données ni les permissions.

### Vérification de la disposition compacte

- **Tests :** 89 tests ciblés réussissent ; journal `compact-face-tests.log`. Le contrôle complet `npm run verify` réussit ensuite : 232 suites, 4 388 tests, 3 774 messages explicitement traduits en anglais et espagnol, typage et compilation avec 13 pages prérendues ; journal `compact-verify.log`.
- **Navigateur à 320 px :** vrais composants avec données fictives, scénario complet avec neuf icônes par joueur, scénario incomplet avec treize comparaisons indisponibles, scénario de zéros mesurés avec quinze comparaisons égales, notre équipe côté rouge et noms longs. Aucun débordement ni texte coupé dans ces contrôles.
- **Autres formats et langues :** contrôles des formats 390, 768, 1024 et 1440 px sans débordement, avec des largeurs intérieures effectivement mesurées de 391, 759, 1015 et 1431 px. Les lignes du scénario complet à neuf icônes par joueur mesurent 124 px sur ordinateur et 344 px à 320 px. Le dialogue à 320 px reste sans débordement en français, anglais et espagnol.
- **Dialogue et clavier :** Entrée et Espace ouvrent le dialogue natif modal ; le focus arrive sur « Fermer ». Échap ferme le dialogue et restitue le focus au bouton de rôle. Les sept repères secondaires sont distincts des données déjà visibles dans les lignes principales.
- **Captures :** `compact-face-desktop.png`, `compact-face-320.png`, `compact-details-320.png` et `compact-long-320.png`. Aucune nouvelle erreur console après chargement neuf. Les trois avertissements antérieurs concernent le remontage de l’aperçu pendant le rechargement à chaud. Après le dernier ajustement d’alignement des boutons de rôle, la compilation et les 13 pages prérendues repassent (`compact-final-build.log`).
- **Portée :** inspection de l’aperçu local et de ses composants réels, avec les seules fixtures synthétiques. Aucune publication ou mutation de données de production n’est effectuée par ces contrôles. Les résultats des versions précédentes ci-dessous sont historiques et ne remplacent pas la validation de cette itération.

## Version 1.99 publiée — quatre demandes complémentaires

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
