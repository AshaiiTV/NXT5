# Corrections du back-office d’administration — 23 novembre 2026

Suite à une revue en lecture seule des outils d’administration.

## Serveur

- **Suppression d’équipe et Nexus Rising** (`admin-team-tools`, action `team-delete`) : même garde que
  `teams-delete` et la suppression de compte. Contrôle avant la transaction, puis contrôle verrouillé dans
  la transaction ; une équipe inscrite (inscription en attente ou approuvée) à une saison non clôturée
  n’est plus supprimée en cascade. Le refus renvoie `NEXUS_TEAM_ENGAGED` et le message Nexus.
- **Motif Nexus en cas de course** : lorsqu’une transaction échoue (22012) alors que plusieurs gardes
  existent, `nexusFailureOr` relit l’engagement pour distinguer le refus Nexus d’un dossier périmé
  (suppression d’équipe et suppression de compte).
- **Portée administrateur du garde Nexus** : `NexusTeamScope` accepte `{ teamId }` sans propriétaire,
  réservé aux administrateurs de la plateforme ; les appels côté propriétaire restent limités à ses équipes.
- **Journal plus utile** :
  - suspension, réactivation, suppression de compte : `accountName`, `accountEmailMasked` (`maskEmail`),
    `reason` et, pour la suppression, l’inventaire validé des équipes possédées (`ownedTeams`) ;
  - motif obligatoire (5 à 500 caractères) pour suspendre ou supprimer un compte, validé côté serveur ;
  - renommage de compte : `previousName` et `newName` ;
  - suppression de profil : nom du profil.
- **Annonces Discord** : `admin.community.configure` et `admin.community.publish` sont journalisés dans
  la même instruction SQL que l’écriture (référence, serveurs et salons, empreinte SHA-256 du contenu,
  jamais le texte).
- **Session administrateur** : le contrôle transactionnel de `admin-team-tools` exige aussi
  `suspended_at is null`, comme les autres outils.
- **Annuaire** (`admin-directory`) : le journal et l’activité d’un compte renvoient `entity_id` et un
  résumé `summary` construit à partir d’une liste blanche de champs (jamais les métadonnées brutes).

## Interface

- Champ « Motif » dans la suspension et la suppression de compte.
- Le journal affiche le résumé de chaque action (ancien → nouveau, équipe supprimée et volumes, motif…)
  et l’identifiant de l’entité ; libellés ajoutés pour `team_member.remove` et les annonces Discord.
- Un refus 4xx n’est plus traité comme un résultat incertain (outils d’équipe et cycle de vie du
  compte) : l’éditeur reste ouvert, la saisie est conservée et l’action peut être relancée. Seuls
  l’absence de statut, un 408 ou un 5xx bloquent jusqu’au rechargement (`mutation-outcome.js`).
- Tableau de bord : la fiche équipe annule sa requête au changement d’équipe ou au démontage.

## Tests

PGlite : refus de suppression d’une équipe engagée (saison ouverte ou en cours), suppression autorisée
après rejet ou clôture, course pendant la transaction, métadonnées d’audit, motif obligatoire, journal
des annonces Discord. Interface : issue des écritures et résumé du journal.
