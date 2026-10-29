# Charte 1.116 — tokens, tons, rayons, titres, boutons et dosage du verre

Preuves locales de la préparation du 29 octobre 2026 sur la branche `charte-propositions-2026-10-29` (base `origin/main` `b7ca7f03`). Données fictives seulement ; aucune API réelle, aucune donnée privée.

## Vérification

- `npm run i18n:check` : 3 821 messages couverts EN/ES.
- `npm run typecheck` : réussi.
- `npm test` : 242 suites, 4 662 tests (`test.log`), dont `src/__tests__/design-scale.test.js`.
- `npm run build` : 13 pages prérendues (`build.log`).

## Captures inspectées

Pane navigateur de l’application, largeur ordinateur ≈ 800 px, téléphone 375 × 812 et 320 × 700. `document.documentElement.scrollWidth === innerWidth` vérifié à 320 px sur les trois pages : aucun débordement horizontal.

| Fichier | Page | Ce qui est vérifié |
| --- | --- | --- |
| `qa-games-desktop-top.jpg` | `tools/match-reading-qa.mjs`, `/games?qa=full&open=both` | Badges `success` (Victoire), `info` (Côté bleu), `danger` (Côté rouge) ; bouton `primary` ; onglets ; panneau `scene` de la partie ; cadre connecté en verre. |
| `qa-games-desktop-killmap.jpg`, `qa-games-desktop-timeline.jpg` | idem, défilement | Boutons `ghost` de filtre ; lignes de chronologie sur fond stable ; écarts signés. |
| `qa-games-mobile-375-top.jpg`, `qa-games-mobile-375-gold.jpg` | idem, 375 px | Boutons pleine largeur à 44 px ; écart d’or final et courbe lisibles ; onglets lisibles. |
| `qa-games-320-top.jpg` | idem, 320 px | Titre sur deux lignes, badges et bouton sans débordement. |
| `preview-demo-desktop-top.jpg`, `preview-demo-desktop-list.jpg`, `preview-demo-desktop-cta-footer.jpg` | `vite preview` du build, `/demo` | Liste des parties en lecture (fond stable, `reading` par défaut) ; puces de champions à 8 px ; bloc d’appel à l’action en verre ; pied de page. |
| `preview-demo-320-list.jpg` | `/demo`, 320 px | Filtres, sélecteurs à 10 px et carte de partie empilés sans débordement. |
| `preview-connexion-320.jpg` | `/connexion`, 320 px | Carte d’authentification en verre explicite ; champs à 16 px ; message d’indisponibilité des connexions sociales en `danger-soft`. |

Le message « Les préférences sont momentanément indisponibles » vient de l’absence de l’API de consentement dans `vite preview` ; il ne concerne pas ce changement.

## Non couvert ici

Les pages connectées hors harness (Tendances, Mon profil, Planning, Paramètres, administration) n’ont pas été capturées : elles exigent une session et une API interceptées que les deux harness locaux ne fournissent pas. Leur passage en `reading` par défaut est attendu ; le relire dans le vrai cadre avant publication. Les captures ne certifient ni la fusion ni la production.
