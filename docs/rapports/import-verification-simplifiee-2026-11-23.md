# Écran de vérification d'import simplifié (23/11/2026)

Demande : l'écran affiché après le chargement d'une game (choix du côté, des postes et des profils) était trop chargé pour ce qu'il demande.

## Avant

- Deux grandes cartes de côté listant les dix champions avec leur nom.
- « Notre équipe » : dix menus déroulants pleine largeur, chacun répétant le Riot ID (dans l'option puis en dessous).
- « Équipe adverse » : section séparée, cinq colonnes avec un menu « Poste » sous chaque champion et deux textes d'aide.
- Champ « Équipe adverse (facultatif) » toujours déplié avec son paragraphe d'explication.

## Après

- Choix du côté : deux boutons compacts (côté, résultat, portraits seuls). Le message de reconnaissance tient sur la ligne du titre.
- Les deux compositions côte à côte (5v5), bordées de la couleur de leur côté, une ligne par joueur.
- Menus « discrets » (`.game-import-chip`) : ils se lisent comme du texte et prennent un cadre au survol ou au focus. Un menu vide est signalé en ambre Vigilance (`#FCD34D`, pointillés).
- Options raccourcies : le champion seul (le Riot ID reste affiché en dessous) ; le nom du profil seul, avec son Riot ID uniquement en cas d'homonyme.
- L'équipe adverse facultative passe dans un volet repliable, ouvert d'office si une équipe est déjà choisie ou en création.
- En dessous de 760 px les deux compositions s'empilent ; en dessous de 560 px le profil passe sous le champion.

Logique inchangée : détection du côté, échange de postes, création des profils manquants, validations et messages du pied de page. Les libellés accessibles des menus sont conservés.

## Vérification

- `tools/import-review-qa/` : rendu de production avec une game fictive (`?unknown` pour une équipe non reconnue), contrôlé à 1280 et 390 px, sans débordement horizontal.
- `npm run verify` : OK.
