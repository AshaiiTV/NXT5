# Liste des parties plus visuelle (24 novembre 2026)

Demande : retirer l’exemple de recherche (« Essaie « Jinx défaite » »), retirer le statut de débrief (« À revoir » / « Terminé ») et rendre la liste plus visuelle.

## Changements

- `src/components/games/ImportedGames.jsx`
  - Suppression de l’indice de recherche, du filtre « Débrief » et du statut « À revoir / Terminé » sur chaque ligne (libellé accessible compris).
  - Nouvel aperçu des résultats filtrés à droite du compteur : victoires, défaites, barre et taux de victoire.
  - Chaque partie devient une carte : liseré et pastille V/D colorés, catégories en étiquettes, identifiant discret, compositions alliée et ennemie face à face (« VS ») avec portraits plus grands bordés de la couleur du côté (bleu/rouge) et point de couleur ; le nom du côté reste lu par les lecteurs d’écran. Durée mise en avant, date et heure en dessous.
- `src/components/games/imported-games.css` : nouvelle mise en page (une ligne au-delà de 1 000 px de conteneur, deux lignes entre 600 et 999 px, trois lignes sur mobile ; portraits réduits sous 360 px).
- Tests : retrait des cas du filtre « Débrief », heure séparée de la durée dans `imported-games-timezone.test.jsx`.

La fonction `filterImportedGames` accepte toujours `review` (aucun appelant ne l’envoie désormais).

## Vérifications

- Rendu contrôlé sur la démo publique à 1 440 px et 375 px (aucun débordement horizontal).
- `i18n:check`, `typecheck`, `build` et les tests de la liste passent. `review-backfill` et `social-password-recovery` dépassent parfois le délai de 5 s selon la charge de la machine, avec ou sans ce changement.
