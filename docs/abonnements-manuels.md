# NXT5 — abonnements manuels des profils

8 septembre 2026.

L’administrateur plateforme peut attribuer un abonnement à un compte depuis **Profils et abonnements**, à l’adresse `/admin/abonnements`. L’attribution est enregistrée en base avec sa formule, ses dates et son historique de modifications. Le titulaire retrouve son abonnement personnel dans Paramètres.

Cette attribution appartient au profil utilisateur. Elle ne crée pas de paiement, de facture ou de renouvellement automatique. Les rôles, appartenances aux équipes et quotas produit restent ceux de l’application actuelle ; attribuer ou retirer un abonnement manuel ne les modifie pas. La future facturation en ligne restera rattachée aux équipes, selon le [brief d’intégration paiement](brief-integration-paiement-ia.md).

La Découverte administrative décrite ici est un code historique de profil sans dates, distinct de la proposition commerciale du 9 septembre 2026 : **14 jours d’accès complet pour l’équipe, puis Pass Équipe requis pour continuer à utiliser les outils**. Attribuer `free` à un profil ne démarre aucun essai et ne lui donne pas une nouvelle validité de 14 jours. Les attributions et données historiques restent inchangées, sans conversion automatique en essai ou souscription d’équipe ; aucun blocage commercial n’est activé avant le lancement.

## Attribuer ou modifier un abonnement

1. Ouvrir `/admin`, puis **Profils et abonnements**, avec le compte administrateur plateforme.
2. Rechercher le compte concerné, le sélectionner et vérifier son identité avant de modifier son abonnement.
3. Choisir la formule. Pour un Pass, définir son début de validité et sa dernière date incluse, ou une validité sans date de fin. Découverte n’utilise pas de dates.
4. Renseigner au besoin la note privée de suivi, puis enregistrer.
5. Vérifier le statut et les dates retournés par le serveur. Le titulaire peut consulter ce résultat dans Paramètres.

| Formule | Code |
| --- | --- |
| Découverte | `free` |
| Pass Équipe | `team_monthly` |
| Pass Saison | `team_season` |
| Pass Structure | `structure` |

Les codes identifient la formule attribuée au profil. Ils ne constituent pas une preuve de paiement et ne déclenchent pas les fonctions multi-équipes du Pass Structure. Les dates enregistrées déterminent la validité de l’attribution ; aucun prix du catalogue Tarifs n’est encaissé par cette action.

La liste des profils est recherchable et paginée. Une note administrative reste privée : elle sert au suivi de l’attribution, pas à un message envoyé au titulaire.

## Validité et retrait

Le serveur calcule le statut à partir des dates et du retrait enregistré. Pour un Pass, un début omis prend la date courante du serveur ; une fin absente signifie une validité sans date de fin. La fin est exclusive : l’attribution expire dès que cet instant est atteint. Découverte attribuée explicitement est active sans dates. Aucune nouvelle période n’est créée automatiquement.

L’interface utilise les jours du fuseau local du navigateur : le début correspond à minuit et le champ « Fin incluse » comprend la journée choisie. Cette dernière journée est convertie en une fin API à minuit le lendemain. Les instants sont transmis avec leur fuseau puis stockés comme dates horodatées. Le résumé personnel propose « Actualiser l’abonnement » pour relire le statut serveur.

| Statut API | Signification | Formule effective |
| --- | --- | --- |
| `none` | Aucune attribution enregistrée pour ce profil. | `free` |
| `active` | Attribution valide à l’instant présent. | Formule attribuée |
| `scheduled` | Début de validité futur. | `free` |
| `expired` | Fin de validité atteinte. | `free` |
| `revoked` | Attribution retirée par l’administrateur. | `free` |

Le retrait est prioritaire sur les dates, puis le serveur examine un début futur et la fin de validité. `planCode` conserve la formule enregistrée ; `effectivePlanCode` indique celle qui est valide maintenant. Ces valeurs décrivent l’abonnement personnel ; les quotas produit ne sont pas encore activés à partir de ce statut.

Le retrait met fin à l’attribution manuelle et reste tracé dans l’historique. Il ne supprime ni le compte, ni ses équipes, ni ses données. L’expiration et le retrait ne changent pas les rôles ou quotas actuels.

Un profil possède une seule attribution courante. Enregistrer une nouvelle formule remplace la précédente et conserve la modification dans l’audit. Si son début est futur, le statut devient immédiatement `scheduled` et la formule effective revient à Découverte jusqu’à cette date : l’ancien Pass ne continue pas en parallèle. Il ne s’agit pas d’une file de renouvellements programmés.

Chaque modification utilise la révision du dossier consulté. Si un autre administrateur a modifié l’attribution entre-temps, le serveur refuse l’écrasement : recharger le dossier, relire son état, puis décider de la modification à effectuer.

## Contrat des API

Les routes ci-dessous sont des Netlify Functions, sous `/.netlify/functions/`.

| Requête | Accès et réponse |
| --- | --- |
| `GET admin-account-subscriptions?q=…&page=1&pageSize=10` | Administrateur uniquement. Renvoie `{ accounts, pagination }`. Chaque compte contient `id`, `name`, `accountName`, `email` et `subscription`. La pagination fournit `page`, `pageSize`, `total`, `totalPages`. |
| `GET admin-account-subscriptions?userId=…` | Administrateur uniquement. Renvoie `{ account, history }` pour le compte choisi. |
| `POST admin-account-subscriptions` | Administrateur uniquement. Attribue ou retire l’abonnement ; renvoie `{ ok: true, account, history }`. |
| `GET account-subscription` | Utilisateur connecté. Renvoie `{ subscription }` pour la session courante uniquement. Aucun choix d’un autre compte n’est accepté. |

Champs du `POST` :

| Champ | Attribution `action: "assign"` | Retrait `action: "revoke"` |
| --- | --- | --- |
| `userId` | UUID du compte existant | UUID du compte existant |
| `expectedRevision` | Révision entière reçue lors de la lecture ; `0` s’il n’existe aucune attribution | Révision entière reçue lors de la lecture |
| `planCode` | `free`, `team_monthly`, `team_season` ou `structure` | Absent |
| `startsAt` | Date ISO ou `null`, facultative ; début serveur par défaut pour un Pass | Absent |
| `endsAt` | Date ISO ou `null`, facultative ; `null` signifie sans fin | Absent |
| `note` | Note privée facultative, 1 000 caractères maximum | Note privée facultative, 1 000 caractères maximum |

Les dates ISO doivent préciser l’heure et le fuseau (`Z` ou décalage UTC). Pour `free`, omettre les dates ou transmettre `null` ; toute date non nulle est refusée. Pour un Pass à durée définie, la fin doit être postérieure au début. Une note omise lors d’une attribution devient vide ; lors d’un retrait, son omission conserve la note existante.

Le corps JSON est limité à 8 Kio et les champs inconnus sont refusés. La recherche porte sur le nom, l’identifiant de compte et l’e-mail, avec 100 caractères maximum ; `pageSize` accepte de 1 à 100 résultats, 10 par défaut. Un compte absent renvoie `404 ACCOUNT_NOT_FOUND`, une ancienne révision `409 SUBSCRIPTION_CONFLICT` et une saisie invalide `400 INVALID_ACCOUNT_SUBSCRIPTION`.

La représentation administrateur de `subscription` comprend `planCode`, `effectivePlanCode`, `status`, `startsAt`, `endsAt`, `revokedAt`, `note`, `updatedAt` et `revision`. Sans attribution, elle indique `none`, une révision `0`, la formule `free` et des dates nulles. La réponse personnelle expose le même statut sans la note privée.

Le détail administrateur retourne les dix modifications les plus récentes dans `history`, avec `id`, `action` (`assign` ou `revoke`), `actorName`, `planCode`, `startsAt`, `endsAt`, `note` et `createdAt`. Cette limite d’affichage ne supprime pas les événements plus anciens de l’audit.

## Installation et recette

La migration additive `database/migrations/20260908_account_subscriptions.sql` crée `account_subscriptions` et un index pour son historique dans la table `audit_logs` existante. Les API vérifient le marqueur `account-subscriptions-20260908-v1`. Appliquer les migrations manquantes avec le mécanisme existant `npm run db:migrate` ; ne pas modifier les migrations déjà publiées. Aucun secret de paiement supplémentaire n’est nécessaire.

Pour la recette, utiliser une base dédiée et les contrôles du dépôt (`npm run verify`). Vérifier les parcours suivants :

- refus des fonctions administrateur sans session ou avec un compte ordinaire ;
- recherche et pagination des profils, puis lecture du compte choisi ;
- attribution de chacune des quatre formules et restitution après rechargement ;
- début futur, début atteint, fin atteinte, validité sans fin et retrait ;
- refus d’un écrasement avec une ancienne révision ;
- conservation de l’auteur, de la note privée et des dates dans l’historique ;
- lecture personnelle limitée à l’utilisateur connecté, sans note ni historique administratif ;
- accès au formulaire au clavier et rendu mobile ;
- conservation des rôles, appartenances, données et quotas existants.

## Confidentialité et contrôle des accès

Seul l’administrateur plateforme peut rechercher tous les comptes, lire les notes et l’historique administratif, attribuer un abonnement ou le retirer. Les contrôles sont appliqués aux API, indépendamment de la visibilité des boutons.

Un utilisateur connecté peut lire uniquement son propre abonnement depuis Paramètres. Cette réponse personnelle ne contient pas les notes privées ni l’historique administratif. Le fait d’être capitaine, manager ou membre d’une équipe ne donne pas accès aux abonnements des autres profils.

Les attributions et retraits sont audités avec leur auteur et leur date. Conserver cet historique lors de toute évolution vers la facturation en ligne ; ne pas convertir automatiquement une attribution de profil en souscription payante d’équipe.

## Relation avec les demandes d’accès et le paiement

Les demandes d’accès de [la validation commerciale](validation-commerciale.md) restent un parcours séparé. Leur réception ou leur confirmation commerciale n’attribue aucun abonnement. L’administrateur choisit explicitement un compte dans **Profils et abonnements** pour effectuer une attribution.

Les quatre formules manuelles sont disponibles, y compris Structure. La collecte des besoins Structure et son attribution à un profil ne mettent pas en place la facturation centralisée, une administration de structure ou des droits multi-équipes.

Lors de l’intégration future de Stripe, conserver les abonnements manuels et leur audit. Définir explicitement comment ils coexistent avec les souscriptions d’équipe avant d’en déduire des droits ou des limites produit.
