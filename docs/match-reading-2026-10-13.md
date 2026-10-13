# Lecture détaillée d’une partie — 13 octobre 2026

Refonte de l’intérieur de « Points à approfondir » et « Chronologie de la partie », sur `0d88e52`, branche `codex/match-reading-20261013`.

## Résultat

Les points à approfondir commencent par une introduction courte, puis deux chapitres : contexte des morts et composition effectivement jouée. Les faits enregistrés restent distincts des hypothèses ; la répartition des dégâts renseigne cette partie. Les sources incomplètes affichent un tiret, tandis qu’un zéro mesuré reste visible.

À la demande explicite de ne pas faire doublon avec les autres onglets, le comparatif par rôle et les données finales restent dans Statistiques/5v5. L’introduction ne répète plus le bilan ; les maxima individuels, les cinq portraits répétés et les propositions déjà présentes dans le débrief sont retirés. Les totaux d’objectifs restent dans Statistiques, leur frise et les horaires rejoignent exclusivement la Chronologie. Le profil de composition et les dégâts réellement infligés restent propres à cette partie : la préparation dans Draft et les tendances multi-parties sont distinctes.

La chronologie présente l’écart d’or, les repères 10/15/20 minutes et un journal vertical complet. Les filtres permettent de parcourir les phases sans supprimer l’accès aux autres événements. Les lacunes interrompent la courbe, son relevé textuel reste disponible et les libellés des objectifs et structures sont lisibles. Sur petit écran, l’axe conserve ses deux extrémités ; les trois repères détaillés se trouvent sous le graphique.

Les trois volets natifs de la fiche restent repliés au départ, montent leur contenu à la demande et se réinitialisent au changement de partie. Les noms saisis, données enregistrées, droits, exports et accès au débrief sont conservés. La modification ne change aucun backend. La publication utilise le circuit de fusion dans `main`, puis la construction Netlify de production.

## Fichiers

- `src/pages/workspace/GameWorkspace.jsx` : présentation et lectures préservant les valeurs absentes.
- `match-deep-reading.css` et `match-timeline-reading.css` dans le même dossier : styles locaux et adaptation à la largeur du conteneur.
- `src/i18n/messages/en.json` et `es.json` : nouvelles traductions.
- `src/__tests__/match-reading.test.jsx` : contrats de données, filtres, lacunes, zéros et noms.
- `tools/match-reading-qa.mjs` et `tools/match-reading-qa/` : aperçu local avec le véritable cadre connecté et des données explicitement fictives.

La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) est actualisée en version 1.67 dans le dépôt principal. Ce compte rendu ne la remplace pas.

## Vérifications

- Contrôle complet après suppression des doublons : **218 fichiers, 4 061 tests** ; 4 060 réussis à la première passe et un dépassement de délai de 5 secondes dans `review-backfill`. Cette suite repasse séparément (**9/9**) avec un délai local de 20 secondes, sans modifier les tests ni la configuration. Le test ajouté vérifie que les objectifs restent comptés dans le 5 contre 5 sans y répéter leur chronologie.
- TypeScript : réussi. Contrôle i18n : **3 652 messages explicites**, placeholders valides en anglais et en espagnol.
- Compilation finale et pré-rendu : réussis, **13 pages vérifiées**. L’avertissement existant sur les bundles supérieurs à 500 ko subsiste.
- Captures dans le cadre connecté à **360, 390, 768, 1024 et 1440 px** ; absence de débordement global et interne des volets.
- Scénarios : complet, chronologie compacte, sans chronologie, statistiques partielles et noms longs ; français, anglais et espagnol, mouvement réduit et mode performance.
- Clavier : ouverture native, sélection des phases par Espace, focus visible et conservé, accès aux 27 relevés textuels. Les 24 moments fictifs restent accessibles, dont 13 dans la première phase.
- `git diff --check` : propre. Revue indépendante des contrats et des états manquants.

Ces contrôles utilisent des fixtures synthétiques et ne constituent pas un test utilisateur ni une certification des données de production. Les regroupements temporels restent des hypothèses, explicitement présentées comme telles.

## Aperçu local

Lancer `node tools/match-reading-qa.mjs`, puis ouvrir `http://127.0.0.1:5198/games?qa=full&open=both`. Les autres scénarios sont `compact`, `no-timeline`, `partial` et `long-names`. `lang=en` ou `lang=es` change la langue. Les images publiques sont facultatives (`NXT5_QA_PUBLIC_ASSETS=1`) ; aucune API de compte ou de partie réelle n’est appelée.

Captures et sorties de contrôle : `artifacts/match-reading/`. La passe sans doublons est tracée dans `dedup-verify.log`, `dedup-recheck.log`, `dedup-build.log`, `dedup-visual.log` et `dedup-interactions.log`. Les captures et les comptes rendus JSON reflètent cette dernière passe.
