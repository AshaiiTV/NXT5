# Scrims entre équipes NXT5

Guide d’exploitation de la recherche de scrims, disponible dans l’espace de travail à `/scrims` (menu « Plus »). Préparation locale au 4 novembre 2026 ; ce document ne prouve pas le comportement du site déployé.

## Parcours

1. Le staff d’une équipe (propriétaire, capitaine, coach, assistant, analyste, manager, board) publie une proposition : date et heure, durée (30 à 360 minutes), nombre de games (1 à 10), niveau minimum et maximum (Fer à Maître et plus, déclarés par l’équipe) et une précision facultative de 500 caractères.
2. Les autres équipes NXT5 voient les propositions ouvertes à venir, avec le nom et le tag de l’équipe, le créneau, le niveau et le nombre d’équipes déjà intéressées. Le staff d’une équipe répond avec un message de 300 caractères ; une seule réponse en attente par équipe et par proposition, retirable tant qu’elle n’est pas traitée.
3. Le staff de l’équipe qui a publié confirme une réponse. Les autres réponses en attente sont refusées, la proposition passe en « Confirmée » et une séance de type scrim est créée dans la table des séances d’équipe de chacune des deux équipes (`discord_team_events`). Elle apparaît dans le Planning NXT5 et dans `/nxt planning`, et bénéficie des rappels du bot si l’équipe les a activés.
4. Si l’équipe a une diffusion Discord active et un salon « planning » configuré, le bot annonce le scrim confirmé dans ce salon lors de son prochain passage (toutes les cinq minutes). L’absence de Discord n’empêche pas la confirmation.

Les membres sans rôle de staff consultent les propositions sans pouvoir publier, répondre ni confirmer. Une proposition annulée refuse ses réponses en attente et disparaît des autres équipes ; une proposition dont l’heure est passée n’est plus affichée aux autres équipes.

## Données et limites

- Tables `scrim_offers` et `scrim_requests` (migration `scrim-finder-20261104-v1`). Les lignes suivent l’équipe : supprimer l’équipe supprime ses propositions et réponses.
- Dix propositions ouvertes au plus par équipe ; un créneau entre 30 minutes et 60 jours après la publication.
- Les mutations sont limitées à 30 requêtes par minute et par adresse. La confirmation vérifie la révision de la proposition et verrouille la ligne : deux confirmations simultanées ne créent pas deux séances.
- Les propositions exposent le nom et le tag de l’équipe, la région, le créneau, le niveau déclaré et la précision saisie. Le planning, les joueurs et les autres données de l’équipe restent privés. Le contact entre équipes passe par la précision ou le message de réponse ; aucun identifiant Discord personnel n’est révélé automatiquement.
- Journal d’audit : `scrim.offer.create`, `scrim.offer.cancel`, `scrim.request.create`, `scrim.offer.accept`.

## Vérifications

- [scrims-server.test.ts](../src/__tests__/scrims-server.test.ts) : droits, validation, plafond, réponses, confirmation, séances créées, annonce Discord et annulation sur une base PostgreSQL embarquée avec l’historique complet des migrations.
- [scrims-ui.test.jsx](../src/__tests__/scrims-ui.test.jsx) : chargement, réponse, confirmation, publication, lecture seule, erreurs et plage de niveau.

## Suites possibles

- Révéler, avec accord, le pseudo Discord lié du staff une fois le scrim confirmé.
- Filtrer les propositions par semaine et par niveau lorsque le volume le justifiera.
- Annuler une séance confirmée depuis le site, avec notification de l’autre équipe.
