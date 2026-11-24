# Parties : onglet Équipes sans rechargement (24 novembre 2026)

## Constat

Le chargement d’ouverture récupère l’équipe et ses parties, pas les fiches adversaires.
Sur Parties, le compteur de l’onglet Équipes affichait donc « — » le temps d’une requête
légère, puis l’ouverture de l’onglet relançait la lecture complète des adversaires avec un
squelette de chargement, à chaque visite. Le compteur repassait aussi à « — » pendant
cette lecture.

## Changement

- `src/api/draft-history.js` garde en mémoire (onglet du navigateur, par compte et par
  équipe) la dernière collection d’adversaires lue, et peut la préparer en arrière-plan.
- Parties prépare cette collection environ 1 s après l’affichage du compteur : l’onglet
  Équipes s’ouvre directement sur ses fiches, puis se rafraîchit en silence.
- Le compteur garde sa dernière valeur connue pendant une lecture au lieu de revenir à « — ».
- Une perte d’accès (401/403) efface la collection mémorisée ; changer d’équipe ou de
  compte n’affiche jamais les données d’une autre portée.

## Vérification

`npm run verify` : 255 fichiers, 4 829 tests, construction réussie. Nouveau test dans
`unified-games-view.test.jsx` (échoue sans le changement).
