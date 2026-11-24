# Compositions : champions hors pool (24/11/2026)

Reprise de la PR #227 de Codex (« Autoriser les champions hors pool et clarifier les compositions »,
branche `codex/compositions-catalog-and-layout`), reportée sur le `main` actuel.

## Ce qui est repris

- **Choix hors pool** : la liste **Champion** de chaque poste garde les champions déclarés du joueur,
  groupés par maîtrise, puis un groupe **Autres champions** avec le reste du catalogue. La liste n'est
  plus désactivée quand le pool est vide.
- **Sauvegarde** : le choix libre est stocké dans le champ JSON facultatif `champion` de l'emplacement
  (`{ playerId, poolId: "", champion }`). Pas de changement de schéma SQL. Le serveur
  (`composition-types-manage`) n'accepte qu'un champion connu du catalogue et refuse un emplacement
  qui porte à la fois `poolId` et `champion`.
- **Affichage** : la carte de composition affiche le badge **Hors pool** ; la maîtrise globale reste
  **Maîtrise non renseignée** tant qu'un choix libre n'est pas déclaré. Si le joueur déclare ensuite ce
  champion à ce poste, son niveau est repris (`resolveCompositionPick`).
- **Aide au choix** : les champions choisis librement aux autres postes sont exclus des suggestions.
- **Catalogue partagé** : `shared/champion-catalog.js` (étiquettes de style + `CHAMPION_IDS` +
  `knownChampionId`) sert à l'interface et à la validation serveur ; `workspace-shared.jsx` le réexporte.
- **Pools** : le nom du niveau est affiché à côté de chaque icône ; les cadres de poste restent neutres
  au clic ; portraits à gauche du nom sur grand écran ; libellés de poste entiers à 320 px.
- **Correspondance stricte joueur ↔ pool** : une ligne de pool rattachée à un `player_id` n'est plus
  associée à un autre joueur homonyme.

## Ajouts par rapport à #227

- **Administration** : la vue « Compositions » d'une équipe (`admin-team-tools`) affiche aussi le
  champion choisi hors pool (`coalesce(pool.champion, slot.champion)`), avec un test PGlite.
- **Message d'équipe sans pool** : l'encart « Déclare les champions… avant de créer une composition »
  contredisait le choix hors pool ; il indique désormais qu'on peut choisir dans « Autres champions »
  (FR/EN/ES).

Le bot Discord (`discord-bot-read.ts`) lisait déjà `slot.champion` : rien à changer.

## Vérification

`npm run verify` (i18n, typage, tests, build).
