# Cartes des titulaires plus visuelles — 23 novembre 2026

Page : **Équipe → Titulaires** (`PremiumRosterTable` dans `src/pages/workspace/Teams.jsx`, styles dans `Teams.css`).

## Changements

- **Illustration du champion signature** : l'artwork de chargement Riot du champion le plus joué par le joueur
  occupe le coin supérieur droit de la carte, fondu vers la gauche et vers le bas (masque CSS). Il passe par
  `assetProxyUrl` (même source que la vitrine de profil, autorisée par la CSP) et disparaît si l'image échoue.
- **Bilan du joueur** : nombre de parties importées et pourcentage de victoires sous les champions.
- **Zone de données opaque** : les champions et le bilan sont regroupés dans un panneau `--nxt5-field`,
  conformément au niveau « Lecture » de la charte (aucune image derrière une valeur).
- **Vignettes plus grandes** (52 px, 46 px en 5 colonnes) ; le champion principal reçoit une arête cyan.
- **« Toi »** devient une pastille cyan, et la carte du joueur connecté a une bordure cyan.
- Fond de carte : dégradé de cadre de la charte (`#191C38 → #17112E → #11172A`), arête cyan → lavande de 1 px.
- Survol : l'illustration s'éclaire et zoome légèrement ; désactivé avec `prefers-reduced-motion`.

## Charte

Palette, surfaces et intensité respectent la charte Prisme 2.8 (identité du joueur à la place du volume de
marque sur une page dense ; pas de magenta fonctionnel ; textes sur fond opaque ou ombre portée sombre).

## Vérifications

- Rendu contrôlé à 1 400 px (5 colonnes), 1 100 px (3 colonnes) et 375 px (mobile) avec des données fictives.
- `npm run verify` vert.

## Suite du 23 novembre 2026

- **4 champions** par carte titulaire ; les vignettes rétrécissent dans les colonnes étroites au lieu de déborder
  (hauteur réservée de 52 px, identique pendant le chargement).
- Bouton **« Ajouter un joueur »** retiré des titres Titulaires/Remplaçants : l'ajout se fait depuis
  « Gestion de l'équipe ». Il reste uniquement dans l'état vide d'une équipe sans joueur.
- **Encadrement** refait en cartes (initiales, rôle avec icône, pastille « Toi »). La liste réunit les profils
  staff du roster et les comptes membres ayant un accès staff (coach, assistant, analyste, manager, board) sans
  profil, triés par rôle. Un compte lié à un profil joueur n'y figure pas.
- `tools/verify-roster-layout.mjs` vérifie désormais le focus clavier sur la première carte.
