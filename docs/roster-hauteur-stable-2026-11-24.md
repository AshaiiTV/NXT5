# Effectif : hauteur stable des cartes joueur (24 novembre 2026)

## Symptôme

Depuis la fusion de #305, `npm run test:layout` échouait sur la CI (Linux) avec
`390px / reset-last: stable player card height`, alors qu'il passait sur macOS.

## Cause

Dans une carte titulaire chargée, la ligne de bilan (« 3 parties · 0 % de victoires »)
était en `flex-wrap: wrap`. Pendant le chargement, elle est remplacée par un emplacement
invisible d'une seule ligne. Si le texte ne tient pas sur une ligne, la carte chargée
gagne environ 25 px et l'effectif « saute » à l'arrivée de l'historique.

Avec Inter, le texte tient tout juste ; avec une police de repli plus large (affichée
pendant le chargement d'Inter, `font-display: swap`, ou les polices Linux de la CI) ou une
traduction plus longue, il passe à la ligne. Reproduit localement en forçant une police
plus large : 320 px passe de 284 à 309 px. Le changement d'ordre de chargement des modules
de #305 a seulement rendu la course de police visible sur la CI à 390 px.

## Correction

`src/pages/workspace/Teams.css` : la ligne de bilan reste sur une ligne dans tous les
états. Le nombre de parties ne rétrécit pas ; le libellé du taux de victoire se tronque
avec une ellipse quand la place manque.

Après ce correctif, la CI a encore échoué une fois, de façon intermittente, à
`768px / reset-last`. Dans l'ordre `reset-last`, `index.css` (qui déclare Inter) arrive en
dernier : `document.fonts.ready` peut se résoudre avant qu'aucune police Inter ne soit
demandée, et une carte est alors mesurée avec la police de repli. `tools/verify-roster-layout.mjs`
charge désormais explicitement les polices Inter et attend deux images avant de mesurer ;
en cas d'échec, l'assertion affiche la hauteur de chaque partie de la carte et l'état des
polices. La tolérance (1 px) n'a pas été assouplie.

## Vérification

- `npm run test:layout` : hauteurs identiques entre état complet et partiel, avec Inter
  et avec une police large forcée (Verdana), de 320 à 1 920 px, dans les deux ordres CSS.
- `npm run verify`.
